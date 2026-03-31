// src/features/notification-hub/types/index.ts

export type HubView = "LEVEL_1_HUB" | "LEVEL_2_QUEUE" | "LEVEL_3_CONSOLE";

export const LEVEL_1_HUB: HubView = "LEVEL_1_HUB";
export const LEVEL_2_QUEUE: HubView = "LEVEL_2_QUEUE";
export const LEVEL_3_CONSOLE: HubView = "LEVEL_3_CONSOLE";

export type UrgencyLevel = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type CriticalityLevel = "NOMINAL" | "ELEVATED" | "CRITICAL";

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

export interface QueueTicketItem {
  id: string;
  emailId: string;
  customerName: string;
  subject: string;
  preview: string;
  categoryId: string;
  urgency: UrgencyLevel;
  confidence: number;
  receivedAt: string;
  waitingMinutes: number;
  riskLevel: RiskLevel;
  status: "new" | "triaged" | "drafted" | "review_required";
}

export interface ResolutionConsoleData {
  ticketId: string;
  emailId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  fullMessage: string;
  categoryId: string;
  urgency: UrgencyLevel;
  confidence: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  draftResponse: string;
  recommendedAction: string;
}

export interface HubMetrics {
  totalOpen: number;
  urgentCount: number;
  reviewCount: number;
  avgResponseTimeMinutes: number;
  avgConfidence: number;
  criticality: CriticalityLevel;
}

export interface HubData {
  categories: CategorySummaryItem[];
  metrics: HubMetrics;
  queueByCategory: Record<string, QueueTicketItem[]>;
  consoleByTicketId: Record<string, ResolutionConsoleData>;
  lastUpdatedAt: string;
}