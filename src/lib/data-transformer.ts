import type { HubMvpData } from '../features/notification-hub/types/mvp';
import type { CategorySummaryItem, RiskLevel, CriticalityLevel } from '../features/notification-hub/types';

/**
 * Transform actual working API responses into HubMvpData format.
 *
 * This version works with the REAL Sagitine API structure:
 * - /api/hub/metrics (working)
 * - /api/hub/categories (working)
 * - /api/hub/queue/:category (working)
 */

// Mock categories until we fetch them
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

interface ApiMetricsResponse {
  totalOpen: number;
  urgentCount: number;
  avgResponseTimeMinutes: number;
  criticality: string;
}

export function transformApiToHubData(apiResponse: ApiMetricsResponse): HubMvpData {
  const { totalOpen, urgentCount, avgResponseTimeMinutes, criticality } = apiResponse;

  // Build categories (for now, just return empty categories - will be fetched when clicked)
  const categories: CategorySummaryItem[] = Object.keys(CATEGORY_CONFIG).map(categoryId => {
    const config = CATEGORY_CONFIG[categoryId];
    return {
      id: categoryId,
      label: config.label,
      shortLabel: config.shortLabel,
      count: 0, // Will be fetched when category is clicked
      urgency: config.urgency,
      hasNew: false,
      avgConfidence: 0,
      avgAgeMinutes: 0,
    };
  });

  return {
    categories,
    metrics: {
      totalOpen,
      urgentCount,
      reviewCount: totalOpen,
      avgResponseTimeMinutes,
      avgConfidence: 0,
      criticality: criticality as CriticalityLevel,
    },
    queueByCategory: {}, // Will be fetched when category is clicked
    consoleByTicketId: {}, // Will be fetched when ticket is clicked
    lastUpdatedAt: new Date().toISOString(),
  };
}
