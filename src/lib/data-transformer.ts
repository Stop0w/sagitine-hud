import type { HubMvpData, HubTicketHydration } from '../features/notification-hub/types/mvp';
import type { CategorySummaryItem, QueueTicketItem, RiskLevel, UrgencyLevel, CriticalityLevel, ResolutionConsoleData } from '../features/notification-hub/types';

// ─── API Response Shapes (from /api/hub-dashboard) ───────────────────────────
// PostgreSQL normalises unquoted aliases to lowercase.

export interface ApiQueueItem {
  ticket_id: string;
  email_id: string;
  status: string;
  sendstatus: string | null;
  fromemail: string;
  fromname: string | null;
  subject: string;
  categoryprimary: string;
  confidence: string;         // arrives as a numeric string, e.g. "0.750"
  urgency: number;            // 0–10 integer
  risklevel: string;
  customerintentsummary: string | null;
  replysubject: string | null;
  receivedat: string;         // ISO timestamp
  createdat: string;          // ISO timestamp
}

export interface ApiCategoryItem {
  category: string;
  categoryLabel: string;
  count: number;
  urgency: string;            // 'low' | 'medium' | 'high'
  avgConfidence: number;
}

export interface ApiDashboardResponse {
  total_queue: number;
  urgent_count: number;
  sent_today: number;
  pending_review: number;
  approved: number;
  rejected: number;
  queue: ApiQueueItem[];
  categories: ApiCategoryItem[];
  _timezone: string;
}

// ─── Display config (labels + short labels for all canonical categories) ─────

const CATEGORY_CONFIG: Record<string, { label: string; shortLabel: string }> = {
  damaged_missing_faulty:        { label: 'Damaged & Faulty',       shortLabel: 'Damaged' },
  shipping_delivery_order_issue: { label: 'Shipping & Delivery',    shortLabel: 'Shipping' },
  return_refund_exchange:        { label: 'Returns & Exchanges',    shortLabel: 'Returns' },
  order_modification_cancellation:{ label: 'Order Modifications',  shortLabel: 'Modifications' },
  product_usage_guidance:        { label: 'Product Guidance',       shortLabel: 'Guidance' },
  pre_purchase_question:         { label: 'Pre-Purchase Questions', shortLabel: 'Pre-Purchase' },
  stock_availability:            { label: 'Stock & Availability',   shortLabel: 'Stock' },
  brand_feedback_general:        { label: 'General Feedback',       shortLabel: 'Feedback' },
  partnership_wholesale_press:   { label: 'Partnerships & Press',   shortLabel: 'Partnerships' },
  account_billing_payment:       { label: 'Account & Billing',      shortLabel: 'Billing' },
  praise_testimonial_ugc:        { label: 'Praise & Testimonials',  shortLabel: 'Praise' },
  spam_solicitation:             { label: 'Spam & Solicitation',    shortLabel: 'Spam' },
  other_uncategorized:           { label: 'Uncategorised',          shortLabel: 'Other' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyIntToLevel(urgency: number): UrgencyLevel {
  if (urgency >= 7) return 'high';
  if (urgency >= 4) return 'medium';
  return 'low';
}

function waitingMinutes(receivedAt: string): number {
  const diff = Date.now() - new Date(receivedAt).getTime();
  return Math.max(0, Math.floor(diff / 60_000));
}

function normaliseStatus(status: string): QueueTicketItem['status'] {
  const map: Record<string, QueueTicketItem['status']> = {
    new:              'new',
    classified:       'triaged',
    drafted:          'drafted',
    review_required:  'review_required',
  };
  return map[status] ?? 'new';
}

// ─── Main transformer ─────────────────────────────────────────────────────────

export function transformApiToHubData(api: ApiDashboardResponse): HubMvpData {
  // 1. Pre-compute average waiting minutes per category from the queue items
  //    (limited to the 50 most recent tickets in the payload, so approximate for large queues)
  const categoryAgeMap: Record<string, { totalMinutes: number; count: number }> = {};
  for (const item of api.queue) {
    const cat = item.categoryprimary;
    const mins = waitingMinutes(item.receivedat);
    if (!categoryAgeMap[cat]) categoryAgeMap[cat] = { totalMinutes: 0, count: 0 };
    categoryAgeMap[cat].totalMinutes += mins;
    categoryAgeMap[cat].count += 1;
  }

  // 2. Build categories with real counts from the API
  const categories: CategorySummaryItem[] = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => {
    const apiCat = api.categories.find(c => c.category === id);
    const ageEntry = categoryAgeMap[id];
    return {
      id,
      label: cfg.label,
      shortLabel: cfg.shortLabel,
      count: apiCat?.count ?? 0,
      urgency: (apiCat?.urgency as UrgencyLevel) ?? 'low',
      hasNew: (apiCat?.count ?? 0) > 0,
      avgConfidence: apiCat?.avgConfidence ?? 0,
      avgAgeMinutes: ageEntry ? Math.round(ageEntry.totalMinutes / ageEntry.count) : 0,
    };
  });

  // 3. Map queue items and group by category
  const queueByCategory: Record<string, QueueTicketItem[]> = {};

  for (const item of api.queue) {
    const categoryId = item.categoryprimary;

    const ticket: QueueTicketItem = {
      id:             item.ticket_id,
      emailId:        item.email_id,
      customerName:   item.fromname ?? item.fromemail,
      subject:        item.subject,
      preview:        (item.customerintentsummary ?? item.subject).slice(0, 150),
      categoryId,
      urgency:        urgencyIntToLevel(item.urgency),
      confidence:     parseFloat(item.confidence) || 0,
      receivedAt:     item.receivedat,
      waitingMinutes: waitingMinutes(item.receivedat),
      riskLevel:      (item.risklevel as RiskLevel) ?? 'low',
      status:         normaliseStatus(item.status),
    };

    if (!queueByCategory[categoryId]) {
      queueByCategory[categoryId] = [];
    }
    queueByCategory[categoryId].push(ticket);
  }

  // 4. Derive criticality from urgent / total ratio
  const ratio = api.total_queue > 0 ? api.urgent_count / api.total_queue : 0;
  const criticality: CriticalityLevel =
    ratio >= 0.5 ? 'CRITICAL' : ratio >= 0.2 ? 'ELEVATED' : 'NOMINAL';

  // 5. Derive overall avgConfidence as a weighted average across all categories
  const totalCatTickets = api.categories.reduce((sum, c) => sum + c.count, 0);
  const avgConfidence = totalCatTickets > 0
    ? api.categories.reduce((sum, c) => sum + c.avgConfidence * c.count, 0) / totalCatTickets
    : 0;

  return {
    categories,
    metrics: {
      totalOpen:              api.total_queue,
      urgentCount:            api.urgent_count,
      reviewCount:            api.pending_review,
      avgResponseTimeMinutes: 0,    // not derivable without sent audit data
      avgConfidence:          Math.round(avgConfidence * 1000) / 1000,
      criticality,
    },
    queueByCategory,
    consoleByTicketId: {},  // fetched on-demand via /api/hub/ticket/:id
    lastUpdatedAt: new Date().toISOString(),
  };
}

// ─── Transformer for Individual Ticket Console ────────────────────────────────
export function transformApiToConsoleData(apiItem: any): ResolutionConsoleData {
  const isHighAttention = !!(apiItem.ishighattentioncustomer || apiItem.isHighAttentionCustomer);

  return {
    ticketId: apiItem.ticket_id,
    emailId: apiItem.email_id || apiItem.ticket_id,
    customerName: apiItem.fromname || apiItem.fromName || apiItem.fromemail || apiItem.fromEmail,
    customerEmail: apiItem.fromemail || apiItem.fromEmail,
    customerSocialHandle: apiItem.instagramhandle || apiItem.instagramHandle,
    subject: apiItem.subject,
    fullMessage: apiItem.bodyplain || apiItem.bodyPlain,
    categoryId: apiItem.categoryprimary || apiItem.categoryPrimary,
    urgency: urgencyIntToLevel(apiItem.urgency),
    confidence: parseFloat(apiItem.confidence) || 0,
    riskLevel: (apiItem.risklevel || apiItem.riskLevel) as RiskLevel || 'low',
    aiSummary: apiItem.customerintentsummary || apiItem.customerIntentSummary || 'No summary available.',
    draftResponse: apiItem.replybody || apiItem.replyBody || '',
    recommendedAction: apiItem.recommendednextaction || apiItem.recommendedNextAction || 'Awaiting action...',
    totalContacts: parseInt(apiItem.totalcontacts || apiItem.totalContacts) || 0,
    thirtyDayVol: parseInt(apiItem.thirtydayvolume || apiItem.thirtyDayVolume) || 0,
    lastContactDate: apiItem.lastcontactat || apiItem.lastContactAt || new Date().toISOString(),
    customerTier: isHighAttention ? 'VIP' : 'Standard',
  };
}

export function transformApiToMvpConsoleData(apiItem: any): HubTicketHydration {
  const isHighAttention = !!(apiItem.ishighattentioncustomer || apiItem.isHighAttentionCustomer);

  return {
    ticket: {
      id: apiItem.ticket_id,
      status: apiItem.status || 'new',
      sendStatus: apiItem.sendstatus || apiItem.sendStatus || 'pending',
      receivedAt: apiItem.receivedat || apiItem.receivedAt,
      category: apiItem.categoryprimary || apiItem.categoryPrimary,
      categoryLabel: CATEGORY_CONFIG[apiItem.categoryprimary || apiItem.categoryPrimary]?.label || 'Uncategorised',
      confidence: parseFloat(apiItem.confidence) || 0,
      urgency: parseInt(apiItem.urgency) || 0,
      riskLevel: (apiItem.risklevel || apiItem.riskLevel) as RiskLevel || 'low',
      customerIntentSummary: apiItem.customerintentsummary || apiItem.customerIntentSummary,
      recommendedNextAction: apiItem.recommendednextaction || apiItem.recommendedNextAction,
      waitingMinutes: waitingMinutes(apiItem.receivedat || apiItem.receivedAt),
    },
    customer: {
      id: apiItem.customerprofileid || apiItem.customerProfileId || 'unknown',
      name: apiItem.fromname || apiItem.fromName || apiItem.fromemail || apiItem.fromEmail,
      email: apiItem.fromemail || apiItem.fromEmail,
      firstContactAt: null,
      lastContactAt: apiItem.lastcontactat || apiItem.lastContactAt || new Date().toISOString(),
      lastContactChannel: 'email',
      totalContactCount: parseInt(apiItem.totalcontacts || apiItem.totalContacts) || 1,
      thirtyDayVolume: parseInt(apiItem.thirtydayvolume || apiItem.thirtyDayVolume) || 1,
      isRepeatContact: (parseInt(apiItem.totalcontacts || apiItem.totalContacts) || 0) > 1,
      isHighAttentionCustomer: isHighAttention,
      shopifyOrderCount: null,
      shopifyLtv: null,
      lastContactCategory: null,
      patternSummary: null,
    },
    message: {
      subject: apiItem.subject,
      fullMessage: apiItem.bodyplain || apiItem.bodyPlain,
      preview: (apiItem.customerintentsummary || apiItem.customerIntentSummary || apiItem.subject || '').slice(0, 150),
    },
    triage: {
      aiSummary: apiItem.customerintentsummary || apiItem.customerIntentSummary || 'No summary available.',
      draftResponse: apiItem.replybody || apiItem.replyBody || '',
      wasHumanEdited: !!(apiItem.humanedited || apiItem.humanEdited),
      proofingSuggestions: [],
    },
    strategy: {
      requiresManagementApproval: false,
      managementEscalationReason: null,
    },
    ui: {
      showCustomerSince: false,
      showThirtyDayVolume: true,
      showRepeatBadge: true,
      showHighAttentionBadge: true,
      showShopifyOrderCount: false,
      showShopifyLtv: false,
      showSocialHandles: false,
      showVipBadge: isHighAttention,
      showInteractionTimeline: false,
      canEditDraft: true,
      canSend: true,
    }
  };
}
