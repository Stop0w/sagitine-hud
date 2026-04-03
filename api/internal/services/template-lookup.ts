/**
 * Template Lookup Service
 *
 * Looks up response templates based on category.
 *
 * Lookup chain:
 * 1. Category → gold_master_index.json → template_id
 * 2. template_id → gold_response_templates.json → template body
 * 3. Personalize template with customer name and details
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface MasterIndex {
  version: string;
  categories: Record<string, {
    urgency: string;
    template_id: string | null;
  }>;
}

interface ResponseTemplate {
  id: string;
  title: string;
  category: string;
  body_template: string;
  tone_notes: string;
  is_active: boolean;
}

interface TemplateLookupResult {
  template_id: string | null;
  template_body: string | null;
  template_found: boolean;
  fallback_used: boolean;
}

// ============================================================================
// MASTER INDEX CACHE
// ============================================================================

let masterIndex: MasterIndex | null = null;
let responseTemplates: ResponseTemplate[] | null = null;

function loadMasterIndex(): MasterIndex {
  if (masterIndex) {
    return masterIndex;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_master_index.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    masterIndex = JSON.parse(fileContent);

    console.log(`✓ Template lookup loaded master index with ${Object.keys(masterIndex.categories).length} categories`);
    return masterIndex;
  } catch (error) {
    console.error('Failed to load master index:', error);
    return { version: '1.0', categories: {} };
  }
}

function loadResponseTemplates(): ResponseTemplate[] {
  if (responseTemplates) {
    return responseTemplates;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_response_templates.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // File is an array directly, not wrapped in a templates property
    responseTemplates = Array.isArray(data) ? data : (data.templates || []);

    console.log(`✓ Template lookup loaded ${responseTemplates.length} response templates`);
    return responseTemplates;
  } catch (error) {
    console.error('Failed to load response templates:', error);
    return [];
  }
}

// ============================================================================
// TEMPLATE LOOKUP
// ============================================================================

function lookupTemplate(category: string): TemplateLookupResult {
  const index = loadMasterIndex();
  const categoryConfig = index.categories[category];

  if (!categoryConfig) {
    console.warn(`Category ${category} not found in master index`);
    return {
      template_id: null,
      template_body: null,
      template_found: false,
      fallback_used: true,
    };
  }

  const templateId = categoryConfig.template_id;

  if (!templateId) {
    // Category exists but has no template (e.g., spam_solicitation, other_uncategorized)
    return {
      template_id: null,
      template_body: null,
      template_found: false,
      fallback_used: false,
    };
  }

  const templates = loadResponseTemplates();
  const template = templates.find(t => t.id === templateId);

  if (!template) {
    console.warn(`Template ${templateId} not found in response templates`);
    return {
      template_id: templateId,
      template_body: null,
      template_found: false,
      fallback_used: true,
    };
  }

  return {
    template_id: template.id,
    template_body: template.body_template,
    template_found: true,
    fallback_used: false,
  };
}

function personalizeTemplate(
  templateBody: string,
  customerName: string,
  context?: {
    productName?: string;
    colour?: string;
    timeframe?: string;
    [key: string]: string | undefined;
  }
): string {
  let personalized = templateBody;

  // Replace customer name
  personalized = personalized.replace(/\[Customer Name\]/g, customerName || 'Customer');

  // Replace context variables if provided
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      if (value) {
        const placeholder = `[${key}]`;
        personalized = personalized.replace(new RegExp(placeholder, 'g'), value);
      }
    });
  }

  return personalized;
}

function generateDraft(
  category: string,
  customerName: string,
  context?: Record<string, string>
): string | null {
  const lookupResult = lookupTemplate(category);

  if (!lookupResult.template_found || !lookupResult.template_body) {
    return null;
  }

  return personalizeTemplate(lookupResult.template_body, customerName, context);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { lookupTemplate, generateDraft, personalizeTemplate };
export type { TemplateLookupResult, MasterIndex, ResponseTemplate };
