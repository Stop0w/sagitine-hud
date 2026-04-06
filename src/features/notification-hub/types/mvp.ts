// src/features/notification-hub/types/mvp.ts

export type UrgencyLevel = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

export type ProofState =
  | "not_proofed"
  | "proofing"
  | "proofed"
  | "invalidated"
  | "sending"
  | "send_failed"
  | "sent";

export type BackendProofStatus = "proofed" | "warning" | "error";

export interface ProofSuggestion {
  type: "grammar" | "tone" | "clarity" | "spelling" | "risk" | "duplication";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ProofSummary {
  tone: "pass" | "fixes_applied" | "warning";
  grammar: "pass" | "fixes_applied" | "warning";
  clarity: "pass" | "fixes_applied" | "warning";
  risk: "low" | "medium" | "high";
}

export interface ProofResponse {
  proofStatus: BackendProofStatus;
  changesDetected: boolean;
  correctedDraft: string;
  suggestions: ProofSuggestion[];
  summary: ProofSummary;
  proofedAt: string;
}

export interface ProofApiResponse {
  success: boolean;
  data: ProofResponse;
  timestamp: string;
}

export interface CategorySummaryItem {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
  urgency: UrgencyLevel;
  hasNew: boolean;
  avgConfidence: number;
  avgAgeMinutes: number;
}

export interface HubTicketHydration {
  ticket: {
    id: string;
    status: string;
    sendStatus: string;
    receivedAt: string;
    category: string;
    categoryLabel: string;
    confidence: number;
    urgency: number;
    riskLevel: RiskLevel;
    customerIntentSummary: string | null;
    recommendedNextAction: string | null;
    waitingMinutes?: number;
  };
  customer: {
    id: string;
    name: string | null;
    email: string;
    firstContactAt: string | null;
    lastContactAt: string | null;
    lastContactChannel: string | null;
    totalContactCount: number;
    thirtyDayVolume: number;
    isRepeatContact: boolean;
    isHighAttentionCustomer: boolean;
    shopifyOrderCount: number | null;
    shopifyLtv: number | null;
    lastContactCategory?: string | null;
    patternSummary?: string | null;
  };
  message: {
    subject: string;
    fullMessage: string;
    preview: string | null;
  };
  triage: {
    aiSummary: string | null;
    draftResponse: string | null;
    wasHumanEdited: boolean;
    proofingSuggestions?: string[];
  };
  strategy?: {
    requiresManagementApproval: boolean;
    managementEscalationReason: string | null;
  };
  ui: {
    showCustomerSince: boolean;
    showThirtyDayVolume: boolean;
    showRepeatBadge: boolean;
    showHighAttentionBadge: boolean;
    showShopifyOrderCount: boolean;
    showShopifyLtv: boolean;
    showSocialHandles: boolean;
    showVipBadge: boolean;
    showInteractionTimeline: boolean;
    canEditDraft: boolean;
    canSend: boolean;
  };
}

export interface HubMetrics {
  totalOpen: number;
  urgentCount: number;
  reviewCount: number;
  avgResponseTimeMinutes: number;
  avgConfidence: number;
  criticality: 'NOMINAL' | 'ELEVATED' | 'CRITICAL';
}

export interface HubMvpData {
  categories: CategorySummaryItem[];
  metrics: HubMetrics;
  queueByCategory: Record<string, any[]>;
  consoleByTicketId: Record<string, HubTicketHydration>;
  lastUpdatedAt: string;
}
