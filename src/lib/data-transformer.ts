import type { HubMvpData } from '../features/notification-hub/types/mvp';
import type { CategorySummaryItem, RiskLevel, CriticalityLevel } from '../features/notification-hub/types';

interface ApiMetricsResponse {
  total_queue: number;
  urgent_count: number;
  sent_today: number;
  pending_review: number;
  approved: number;
  rejected: number;
  queue: Array<{
    id: string;
    from_email: string;
    from_name: string;
    subject: string;
    body_plain: string;
    received_at: string;
    category: string;
    urgency: number;
    risk_level: string;
    status: string;
    waitingMinutes: number;
  }>;
  categories?: Array<{
    category: string;
    categoryLabel: string;
    count: number;
    urgency: 'low' | 'medium' | 'high';
    avgConfidence: number;
  }>;
}

/**
 * Category metadata map for UI display.
 * Defines labels, urgency levels, and display order for all categories.
 */
const CATEGORY_CONFIG: Record<string, { label: string; shortLabel: string; urgency: 'low' | 'medium' | 'high' }> = {
  damaged_missing_faulty: {
    label: 'Damaged & Faulty',
    shortLabel: 'Damaged',
    urgency: 'high',
  },
  shipping_delivery_order_issue: {
    label: 'Shipping & Delivery',
    shortLabel: 'Shipping',
    urgency: 'medium',
  },
  return_refund_exchange: {
    label: 'Returns & Exchanges',
    shortLabel: 'Returns',
    urgency: 'low',
  },
  order_modification_cancellation: {
    label: 'Order Modifications',
    shortLabel: 'Modifications',
    urgency: 'high',
  },
  product_usage_guidance: {
    label: 'Product Guidance',
    shortLabel: 'Guidance',
    urgency: 'low',
  },
  pre_purchase_question: {
    label: 'Pre-Purchase Questions',
    shortLabel: 'Pre-Purchase',
    urgency: 'low',
  },
  stock_availability: {
    label: 'Stock & Availability',
    shortLabel: 'Stock',
    urgency: 'low',
  },
  brand_feedback_general: {
    label: 'General Feedback',
    shortLabel: 'Feedback',
    urgency: 'low',
  },
  partnership_wholesale_press: {
    label: 'Partnerships & Press',
    shortLabel: 'Partnerships',
    urgency: 'low',
  },
  account_billing_payment: {
    label: 'Account & Billing',
    shortLabel: 'Billing',
    urgency: 'medium',
  },
  praise_testimonial_ugc: {
    label: 'Praise & Testimonials',
    shortLabel: 'Praise',
    urgency: 'low',
  },
  spam_solicitation: {
    label: 'Spam & Solicitation',
    shortLabel: 'Spam',
    urgency: 'low',
  },
  other_uncategorized: {
    label: 'Uncategorized',
    shortLabel: 'Other',
    urgency: 'low',
  },
};

/**
 * Transform API metrics response into HubMvpData format.
 *
 * This bridges the gap between the real API response structure
 * and the UI component's expected data structure.
 *
 * @param apiResponse - Raw response from /api/hub/dashboard
 * @returns HubMvpData compatible with NotificationHub components
 */
export function transformApiToHubData(apiResponse: ApiMetricsResponse): HubMvpData {
  const { total_queue, urgent_count, sent_today, pending_review, approved, rejected, queue, categories: apiCategories } = apiResponse;

  // Group tickets by category
  const ticketsByCategory: Record<string, typeof queue> = {};
  queue.forEach(ticket => {
    if (!ticketsByCategory[ticket.category]) {
      ticketsByCategory[ticket.category] = [];
    }
    ticketsByCategory[ticket.category].push(ticket);
  });

  // Build categories list with counts and metadata
  // Use API categories if available, otherwise fall back to calculation
  let categories: CategorySummaryItem[];

  if (apiCategories && apiCategories.length > 0) {
    // Use API-provided categories (more accurate)
    categories = apiCategories.map(cat => {
      const categoryTickets = ticketsByCategory[cat.category] || [];
      const config = CATEGORY_CONFIG[cat.category] || { label: cat.categoryLabel, shortLabel: cat.categoryLabel.substring(0, 10), urgency: cat.urgency };

      // Calculate average age in minutes from actual tickets
      const now = new Date();
      const avgAgeMinutes = categoryTickets.length > 0
        ? categoryTickets.reduce((sum, t) => {
            const received = new Date(t.received_at);
            const minutes = (now.getTime() - received.getTime()) / 60000;
            return sum + minutes;
          }, 0) / categoryTickets.length
        : 0;

      // Check if any tickets in this category are new (not reviewed yet)
      const hasNew = categoryTickets.some(t => t.status === 'new' || t.status === 'classified');

      return {
        id: cat.category,
        label: cat.categoryLabel,
        shortLabel: config.shortLabel,
        count: cat.count,
        urgency: cat.urgency,
        hasNew,
        avgConfidence: cat.avgConfidence,
        avgAgeMinutes: Math.round(avgAgeMinutes),
      };
    });
  } else {
    // Fallback: Calculate categories locally (legacy behavior)
    categories = Object.keys(CATEGORY_CONFIG).map(categoryId => {
      const categoryTickets = ticketsByCategory[categoryId] || [];
      const config = CATEGORY_CONFIG[categoryId];

      // Calculate average confidence (placeholder - will come from API later)
      const avgConfidence = categoryTickets.length > 0
        ? categoryTickets.reduce((sum, t) => sum + (t.urgency / 10), 0) / categoryTickets.length
        : 0;

      // Calculate average age in minutes
      const now = new Date();
      const avgAgeMinutes = categoryTickets.length > 0
        ? categoryTickets.reduce((sum, t) => {
            const received = new Date(t.received_at);
            const minutes = (now.getTime() - received.getTime()) / 60000;
            return sum + minutes;
          }, 0) / categoryTickets.length
        : 0;

      // Check if any tickets in this category are new (not reviewed yet)
      const hasNew = categoryTickets.some(t => t.status === 'new' || t.status === 'classified');

      return {
        id: categoryId,
        label: config.label,
        shortLabel: config.shortLabel,
        count: categoryTickets.length,
        urgency: config.urgency,
        hasNew,
        avgConfidence,
        avgAgeMinutes: Math.round(avgAgeMinutes),
      };
    });
  }

  // Build queueByCategory (map of category ID to ticket list)
  const queueByCategory: HubMvpData['queueByCategory'] = {};
  Object.entries(ticketsByCategory).forEach(([categoryId, tickets]) => {
    queueByCategory[categoryId] = tickets.map(ticket => {
      // Use waitingMinutes from API if available, otherwise calculate
      const waitingMinutes = 'waitingMinutes' in ticket
        ? (ticket as any).waitingMinutes
        : Math.round((Date.now() - new Date(ticket.received_at).getTime()) / 60000);

      return {
        id: ticket.id,
        emailId: ticket.id,
        customerName: ticket.from_name || 'Unknown',
        subject: ticket.subject,
        preview: ticket.body_plain.substring(0, 100) + '...',
        categoryId: ticket.category,
        urgency: ticket.urgency >= 8 ? 'high' : ticket.urgency >= 5 ? 'medium' : 'low',
        confidence: ticket.urgency / 10, // Use urgency as proxy for confidence
        receivedAt: ticket.received_at,
        waitingMinutes,
        riskLevel: ticket.risk_level as RiskLevel,
        status: ticket.status,
      };
    });
  });

  // Build consoleByTicketId (detailed ticket view for right panel)
  const consoleByTicketId: HubMvpData['consoleByTicketId'] = {};
  queue.forEach(ticket => {
    // Use waitingMinutes from API if available, otherwise calculate
    const waitingMinutes = 'waitingMinutes' in ticket
      ? (ticket as any).waitingMinutes
      : Math.round((Date.now() - new Date(ticket.received_at).getTime()) / 60000);

    consoleByTicketId[ticket.id] = {
      ticket: {
        id: ticket.id,
        status: ticket.status,
        sendStatus: 'not_applicable',
        receivedAt: ticket.received_at,
        category: ticket.category,
        categoryLabel: CATEGORY_CONFIG[ticket.category]?.label || ticket.category,
        confidence: ticket.urgency / 10,
        urgency: ticket.urgency,
        riskLevel: ticket.risk_level as RiskLevel,
        customerIntentSummary: 'Customer inquiry pending AI analysis...',
        recommendedNextAction: ticket.risk_level === 'high' ? 'Review urgently' : 'Review and respond',
        waitingMinutes,
      },
      customer: {
        id: `cust_${ticket.from_email.replace(/[^a-zA-Z0-9]/g, '')}`,
        name: ticket.from_name || 'Unknown',
        email: ticket.from_email,
        firstContactAt: ticket.received_at, // Will be updated when real profile data exists
        lastContactAt: ticket.received_at,
        lastContactChannel: 'email',
        totalContactCount: 1, // Will be updated when real profile data exists
        thirtyDayVolume: 1,
        isRepeatContact: false,
        isHighAttentionCustomer: false,
        shopifyOrderCount: 0, // Will be populated from real profile
        shopifyLtv: 0,
        lastContactCategory: CATEGORY_CONFIG[ticket.category]?.label || ticket.category,
        patternSummary: 'New customer',
      },
      message: {
        subject: ticket.subject,
        fullMessage: ticket.body_plain,
        preview: ticket.body_plain.substring(0, 100) + '...',
      },
      triage: {
        aiSummary: 'AI triage pending...',
        draftResponse: null,
        wasHumanEdited: false,
        proofingSuggestions: [],
      },
      ui: {
        showCustomerSince: true,
        showThirtyDayVolume: true,
        showRepeatBadge: false,
        showHighAttentionBadge: false,
        showShopifyOrderCount: false,
        showShopifyLtv: false,
        showSocialHandles: false,
        showVipBadge: false,
        showInteractionTimeline: false,
        canEditDraft: true,
        canSend: false, // Require human review before sending
      },
    };
  });

  // Build metrics object
  const metrics = {
    totalOpen: total_queue,
    urgentCount: urgent_count,
    reviewCount: pending_review,
    avgResponseTimeMinutes: 0, // Will be calculated from real data
    avgConfidence: 0, // Will be calculated from real data
    criticality: (urgent_count > 5 ? 'ELEVATED' : 'NOMINAL') as CriticalityLevel,
  };

  return {
    categories,
    metrics,
    queueByCategory,
    consoleByTicketId,
    lastUpdatedAt: new Date().toISOString(),
  };
}
