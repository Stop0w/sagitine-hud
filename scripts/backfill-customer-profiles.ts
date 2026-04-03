// Customer Profile Backfill Script (Production-Grade)
// Ingests historical .msg emails and Shopify CSV to build customer profiles
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'csv-parse/sync';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createHash } from 'crypto';
import { parseMsg } from 'msg-parser';

// Load environment variables
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BackfillConfig {
  emailsDir: string;
  shopifyCsv?: string;
  dryRun: boolean;
  limit?: number;
  sinceDate?: Date;
}

interface ParsedEmail {
  fromEmail: string;
  fromName?: string;
  subject: string;
  sentAt: Date;
  category?: string;
  folder?: string;
  filename?: string;
  filePath: string;
  fingerprint: string;
}

interface ShopifyCustomer {
  email: string;
  customer_id?: string;
  orders_count?: string;
  total_spent?: string;
  last_order_date?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_address_phone?: string;
}

interface ShopifyEnrichmentResult {
  totalRows: number;
  rowsWithValidEmail: number;
  matchedExistingProfiles: number;
  skippedUnmatchedRows: number;
  fieldsEnriched: {
    shopifyCustomerId: number;
    name: number;
    phone: number;
    shopifyLtv: number;
    shopifyOrderCount: number;
  };
  conflictsPreserved: {
    name: number;
    phone: number;
  };
}

interface CustomerFact {
  email: string;
  name?: string;
  contactAt: Date;
  category?: string;
  fingerprint: string;
  source: 'historical_email' | 'shopify';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Shopify CSV column mappings (configurable)
const SHOPIFY_COLUMN_MAPPING = {
  email: ['email', 'Email', 'EMAIL', 'customer_email', 'Customer Email'],
  customer_id: ['customer_id', 'Customer ID', 'id', 'ID'],
  orders_count: ['orders_count', 'Orders Count', 'Total Orders', '# Orders'],
  total_spent: ['total_spent', 'Total Spent', 'Lifetime Sales', 'LTV'],
  last_order_date: ['last_order_date', 'Last Order Date', 'Last Order'],
  first_name: ['first_name', 'First Name', 'FirstName'],
  last_name: ['last_name', 'Last Name', 'LastName'],
  phone: ['phone', 'Phone', 'Default Phone'],
  default_address_phone: ['default_address_phone', 'Default Address Phone'],
};

// Category heuristics from folder/filename patterns
const CATEGORY_PATTERNS = {
  damaged_missing_faulty: [
    /damaged/i, /dent/i, /broken/i, /faulty/i, /smashed/i, /cracked/i
  ],
  shipping_delivery_order_issue: [
    /delivery/i, /shipping/i, /tracking/i, /shipped/i, /dispatch/i
  ],
  product_usage_guidance: [
    /how to/i, /instruction/i, /assembly/i, /usage/i, /setup/i, /guide/i
  ],
  pre_purchase_question: [
    /pre.?purchase/i, /before buying/i, /question/i, /inquiry/i
  ],
  return_refund_exchange: [
    /return/i, /refund/i, /exchange/i, /send back/i
  ],
  stock_availability: [
    /stock/i, /available/i, /back.?order/i
  ],
  partnership_wholesale_press: [
    /wholesale/i, /press/i, /influencer/i, /partnership/i
  ],
  praise_testimonial_ugc: [
    /praise/i, /testimonial/i, /feedback/i, /review/i, /love/i, /amazing/i
  ],
  account_billing_payment: [
    /payment/i, /billing/i, /invoice/i, /charge/i
  ],
  order_modification_cancellation: [
    /cancel/i, /modification/i, /change order/i
  ],
};

// ============================================================================
// EXPLICIT EMAIL FILTERING RULES
// ============================================================================

/**
 * Strict customer email filtering to prevent CRM pollution
 */
function isValidCustomerEmail(email: string, fromHeader?: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();

  // FILTER OUT: Internal domains
  const internalDomains = [
    'sagitine.com',
    'sagitine.com.au',
    'sagitinestorage.com',
    '@sagitine',
  ];
  if (internalDomains.some(domain => normalizedEmail.includes(domain))) {
    return false;
  }

  // FILTER OUT: No-reply and automated addresses
  const noReplyPatterns = [
    'no-reply',
    'noreply',
    'no_reply',
    'donotreply',
    'do-not-reply',
    'automation@',
    'notifications@',
    'support@stripe.com',
    'notifications@stripe.com',
  ];
  if (noReplyPatterns.some(pattern => normalizedEmail.includes(pattern))) {
    return false;
  }

  // FILTER OUT: External tools and services
  const toolDomains = [
    '@shopify.com',
    '@stripe.com',
    '@paypal.com',
    '@gmail.com', // Too generic, risk of false positives
    '@yahoo.com',
    '@outlook.com',
  ];

  // FILTER OUT: Forwarded chains (sender ≠ actual customer)
  if (fromHeader) {
    // Check for "On behalf of" or forwarded indicators
    const forwardedPatterns = [
      /on behalf of/i,
      /sent on behalf of/i,
      /fw:/i,
      /forwarded by/i,
    ];
    if (forwardedPatterns.some(pattern => pattern.test(fromHeader))) {
      return false;
    }

    // Check if sender name contains quotes indicating forwarding
    if (fromHeader.includes('"') && fromHeader.includes(' on behalf of')) {
      return false;
    }
  }

  return true;
}

/**
 * Extract first external sender from thread
 * Filters out internal/cc/bcc to find actual customer
 */
function extractCustomerSender(fromHeader: string): string | null {
  if (!fromHeader) return null;

  // Remove quoted names
  const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/([\w._%+-]+@[\w.-]+\.[a-z]{2,})/i);
  if (!emailMatch) return null;

  const email = emailMatch[1].toLowerCase().trim();

  // Filter out internal/cc'd addresses
  if (!isValidCustomerEmail(email, fromHeader)) {
    return null;
  }

  return email;
}

// ============================================================================
// CLI ARGUMENTS
// ============================================================================

function parseArgs(): BackfillConfig {
  const args = process.argv.slice(2);

  const config: BackfillConfig = {
    emailsDir: '',
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--emails-dir' && args[i + 1]) {
      config.emailsDir = args[++i];
    } else if (arg === '--shopify-csv' && args[i + 1]) {
      config.shopifyCsv = args[++i];
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[++i], 10);
    } else if (arg === '--since-date' && args[i + 1]) {
      config.sinceDate = new Date(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Customer Profile Backfill Tool (Production-Grade)

Usage:
  npx tsx scripts/backfill-customer-profiles.ts [options]

Options:
  --emails-dir <path>       (required) Path to historical .msg email files
  --shopify-csv <path>      (optional) Path to Shopify customer export CSV
  --dry-run                 Validate without writing to database
  --limit <number>           Process only N emails (for testing)
  --since-date <ISO-date>    Only process emails after this date

Examples:
  npx tsx scripts/backfill-customer-profiles.ts \\
    --emails-dir "./historical-emails" \\
    --shopify-csv "./shopify-customers.csv" \\
    --dry-run

  npx tsx scripts/backfill-customer-profiles.ts \\
    --emails-dir "./historical-emails" \\
    --limit 100
      `);
      process.exit(0);
    }
  }

  if (!config.emailsDir) {
    console.error('Error: --emails-dir is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  return config;
}

// ============================================================================
// EMAIL PARSER (.msg files)
// ============================================================================

/**
 * Parse .msg email file using emailjs library
 * Returns normalized email data or null if invalid
 */
/**
 * Parse Outlook .msg file using msg-parser library
 */
function parseMsgFile(filePath: string): ParsedEmail | null {
  try {
    const msgFile = parseMsg(filePath);

    // Extract sender email
    const fromEmail = msgFile.senderEmail;
    if (!fromEmail) {
      console.warn(`No sender email in ${filePath}`);
      return null;
    }

    // Validate customer email using strict filtering
    const customerEmail = extractCustomerSender(fromEmail);
    if (!customerEmail) {
      console.warn(`Filtered out internal/invalid email: ${fromEmail} in ${filePath}`);
      return null;
    }

    // Extract sent date
    const sentAt = msgFile.sentDate ? new Date(msgFile.sentDate) : null;
    if (!sentAt || isNaN(sentAt.getTime())) {
      console.warn(`Invalid sent date in ${filePath}`);
      return null;
    }

    // Extract subject
    const subject = msgFile.subject || '(No Subject)';

    // Extract sender name
    const fromName = msgFile.senderName || undefined;

    // Extract folder/category from path
    const pathParts = filePath.split(/[/\\]/);
    const filename = pathParts[pathParts.length - 1];
    const folder = pathParts[pathParts.length - 2] || '';

    // Try to determine category from folder/filename
    const category = detectCategory(folder, filename, subject);

    // Create fingerprint (content hash)
    const fingerprint = createFingerprint(customerEmail, subject, sentAt);

    return {
      fromEmail: customerEmail,
      fromName,
      subject,
      sentAt,
      category,
      folder,
      filename,
      filePath,
      fingerprint,
    };
  } catch (error: any) {
    console.warn(`Failed to parse ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Create content fingerprint for deduplication
 * hash(fromEmail + subject + sentAt rounded to minute)
 */
function createFingerprint(email: string, subject: string, sentAt: Date): string {
  // Round timestamp to minute precision
  const minuteRounded = new Date(sentAt);
  minuteRounded.setSeconds(0);
  minuteRounded.setMilliseconds(0);

  const content = `${email.toLowerCase()}|${subject}|${minuteRounded.toISOString()}`;

  return createHash('md5').update(content).digest('hex');
}

/**
 * Detect category from folder name, filename, or subject
 */
function detectCategory(folder: string, filename: string, subject: string): string | undefined {
  const searchText = `${folder} ${filename} ${subject}`.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return category;
      }
    }
  }

  return undefined; // No category detected
}

// ============================================================================
// SHOPIFY CSV PARSER
// ============================================================================

/**
 * Parse Shopify CSV export with flexible column mapping
 */
function parseShopifyCsv(filePath: string): {
  customers: Map<string, ShopifyCustomer>,
  totalRows: number,
  columns: Record<string, string | undefined>
} {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const records: any[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    const customers = new Map<string, ShopifyCustomer>();

    // Detect column names from first row
    if (records.length === 0) return { customers, totalRows: 0, columns: {} };

    const columns = Object.keys(records[0]);

    // Build column mapping with strict detection
    const colMap = {
      email: findColumn(columns, SHOPIFY_COLUMN_MAPPING.email),
      customer_id: findColumn(columns, SHOPIFY_COLUMN_MAPPING.customer_id),
      orders_count: findColumn(columns, SHOPIFY_COLUMN_MAPPING.orders_count),
      total_spent: findColumn(columns, SHOPIFY_COLUMN_MAPPING.total_spent),
      last_order_date: findColumn(columns, SHOPIFY_COLUMN_MAPPING.last_order_date),
      first_name: findColumn(columns, SHOPIFY_COLUMN_MAPPING.first_name),
      last_name: findColumn(columns, SHOPIFY_COLUMN_MAPPING.last_name),
      phone: findColumn(columns, SHOPIFY_COLUMN_MAPPING.phone),
      default_address_phone: findColumn(columns, SHOPIFY_COLUMN_MAPPING.default_address_phone),
    };

    // Fail if critical Email column cannot be matched
    if (!colMap.email) {
      throw new Error(
        'CRITICAL: Cannot match Email column in Shopify CSV. ' +
        'Expected one of: ' + SHOPIFY_COLUMN_MAPPING.email.join(', ') + '\n' +
        'Found columns: ' + columns.join(', ')
      );
    }

    // Parse each row
    let validCount = 0;
    for (const row of records) {
      const email = row[colMap.email];
      if (!email || !email.includes('@')) continue;

      const normalizedEmail = email.toLowerCase().trim();

      // Additional validation: must be real customer domain
      if (!isValidCustomerEmail(normalizedEmail)) {
        continue;
      }

      customers.set(normalizedEmail, {
        email: normalizedEmail,
        customer_id: colMap.customer_id ? row[colMap.customer_id] : undefined,
        orders_count: colMap.orders_count ? row[colMap.orders_count] : undefined,
        total_spent: colMap.total_spent ? row[colMap.total_spent] : undefined,
        last_order_date: colMap.last_order_date ? row[colMap.last_order_date] : undefined,
        first_name: colMap.first_name ? row[colMap.first_name] : undefined,
        last_name: colMap.last_name ? row[colMap.last_name] : undefined,
        phone: colMap.phone ? row[colMap.phone] : undefined,
        default_address_phone: colMap.default_address_phone ? row[colMap.default_address_phone] : undefined,
      });

      validCount++;
    }

    console.log(`✓ Parsed ${validCount} valid Shopify customers from ${records.length} total rows`);
    return { customers, totalRows: records.length, columns: colMap };
  } catch (error: any) {
    console.error(`✗ Failed to parse Shopify CSV: ${error.message}`);
    throw error; // Re-throw to halt execution on critical failures
  }
}

/**
 * Strict column matching - case-insensitive, trim spaces, treat underscores/spaces as equivalent
 */
function findColumn(actualColumns: string[], possibleNames: string[]): string | undefined {
  // Normalize actual columns: lowercase, trim, replace underscores with spaces
  const normalizedActual = actualColumns.map(col =>
    col.toLowerCase().trim().replace(/_/g, ' ')
  );

  // Try to find exact match for each possible name
  for (const possibleName of possibleNames) {
    // Normalize possible name the same way
    const normalizedPossible = possibleName.toLowerCase().trim().replace(/_/g, ' ');

    // Look for exact match
    const matchIndex = normalizedActual.findIndex(nc => nc === normalizedPossible);
    if (matchIndex !== -1) {
      return actualColumns[matchIndex]; // Return original column name
    }
  }

  // No match found
  return undefined;
}

// ============================================================================
// EMAIL FILE SCANNER
// ============================================================================

/**
 * Scan directory for .msg files recursively
 */
function scanEmailFiles(dir: string, sinceDate?: Date): ParsedEmail[] {
  const emails: ParsedEmail[] = [];

  function scanPath(currentPath: string) {
    try {
      const stats = statSync(currentPath);

      if (stats.isDirectory()) {
        const entries = readdirSync(currentPath);
        for (const entry of entries) {
          scanPath(join(currentPath, entry));
        }
      } else if (currentPath.endsWith('.msg')) {
        const email = parseMsgFile(currentPath);
        if (email) {
          // Filter by date if specified
          if (!sinceDate || email.sentAt >= sinceDate) {
            emails.push(email);
          }
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }

  scanPath(dir);

  // Sort chronologically
  emails.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  return emails;
}

// ============================================================================
// BACKFILL EXECUTION
// ============================================================================

/**
 * Main backfill execution
 */
async function runBackfill(config: BackfillConfig) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     Customer Profile Backfill Tool (Production-Grade)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log(`Configuration:`);
  console.log(`  Emails dir:  ${config.emailsDir}`);
  console.log(`  Shopify CSV: ${config.shopifyCsv || 'N/A'}`);
  console.log(`  Dry run:    ${config.dryRun ? 'Yes (no writes)' : 'No (live writes)'}`);
  console.log(`  Limit:      ${config.limit || 'All'}`);
  console.log(`  Since date: ${config.sinceDate?.toISOString() || 'All'}\n`);

  // Step 1: Scan email files
  console.log('Step 1: Scanning historical email files...');
  const allEmails = scanEmailFiles(config.emailsDir, config.sinceDate);
  console.log(`  Found ${allEmails.length} valid customer emails (after filtering)\n`);

  if (config.limit) {
    allEmails.length = Math.min(allEmails.length, config.limit);
    console.log(`  Limited to ${allEmails.length} emails\n`);
  }

  // Step 2: Load Shopify data
  let shopifyData: {
    customers: Map<string, ShopifyCustomer>,
    totalRows: number
  } = { customers: new Map(), totalRows: 0 };
  let shopifyMatchRate = 0;

  if (config.shopifyCsv) {
    console.log('Step 2: Loading Shopify customer export...');
    shopifyData = parseShopifyCsv(config.shopifyCsv);
    console.log(`  Loaded ${shopifyData.customers.size} valid customers from ${shopifyData.totalRows} total rows\n`);
  }

  // Step 3: Build facts map (email -> facts[])
  console.log('Step 3: Building customer contact facts...');
  const factsByEmail = new Map<string, CustomerFact[]>();

  for (const email of allEmails) {
    const normalizedEmail = email.fromEmail;

    if (!factsByEmail.has(normalizedEmail)) {
      factsByEmail.set(normalizedEmail, []);
    }

    factsByEmail.get(normalizedEmail)!.push({
      email: normalizedEmail,
      name: email.fromName,
      contactAt: email.sentAt,
      category: email.category || 'other_uncategorized', // FIX #3: Never NULL
      fingerprint: email.fingerprint,
      source: 'historical_email',
    });
  }

  console.log(`  Built facts for ${factsByEmail.size} unique customers\n`);

  // Step 4: Check existing profiles
  console.log('Step 4: Checking existing customer profiles...');
  const existingProfiles = await sql`
    SELECT email, id, name, created_at
    FROM customer_profiles
  `;

  const existingProfilesMap = new Map<string, any>();
  for (const profile of existingProfiles) {
    existingProfilesMap.set(profile.email.toLowerCase(), profile);
  }

  console.log(`  Found ${existingProfiles.length} existing profiles\n`);

  // Calculate Shopify match rate against unique support emails
  const supportEmailCount = factsByEmail.size;
  const shopifyMatchCount = Array.from(factsByEmail.keys()).filter(email =>
    shopifyData.customers.has(email)
  ).length;

  if (shopifyData.customers.size > 0) {
    shopifyMatchRate = (shopifyMatchCount / supportEmailCount) * 100;
  }

  // Step 5: Process each customer
  console.log('Step 5: Processing customers and creating profiles...\n');

  let processed = 0;
  let created = 0;
  let merged = 0;
  let factsCreated = 0;
  const affectedProfileIds: string[] = [];

  for (const [email, facts] of factsByEmail) {
    const existingProfile = existingProfilesMap.get(email);
    const shopifyCustomer = shopifyData.customers.get(email);

    // Sort facts chronologically
    facts.sort((a, b) => a.contactAt.getTime() - b.contactAt.getTime());

    if (!existingProfile) {
      // Create new profile
      if (!config.dryRun) {
        const profileId = await createProfile(email, facts, shopifyCustomer);
        affectedProfileIds.push(profileId);
      }

      created++;
      factsCreated += facts.length;
    } else {
      // Merge with existing profile
      const newFactsCount = await mergeProfile(existingProfile, facts, shopifyCustomer);

      if (newFactsCount > 0) {
        affectedProfileIds.push(existingProfile.id);
      }

      merged++;
      factsCreated += newFactsCount;
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${factsByEmail.size} customers...`);
    }
  }

  console.log(`\n  Processed ${processed} customers`);
  console.log(`  Created ${created} new profiles`);
  console.log(`  Merged ${merged} existing profiles`);
  console.log(`  Created ${factsCreated} contact facts`);
  console.log(`  Affected profiles for recalculation: ${affectedProfileIds.length}\n`);

  // Step 6: Recalculate rollups for affected customers only
  console.log('Step 6: Recalculating rollups for affected customers...\n');
  if (!config.dryRun && affectedProfileIds.length > 0) {
    await recalculateRollups(affectedProfileIds);
  }

  console.log(`  ✓ Rollups recalculated for ${affectedProfileIds.length} customers\n`);

  // ========================================================================
  // PHASE 2: SHOPIFY ENRICHMENT (Defensive Merge)
  // ========================================================================

  let shopifyEnrichmentResult: ShopifyEnrichmentResult | null = null;

  if (shopifyData.customers.size > 0) {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║     PHASE 2: SHOPIFY ENRICHMENT (Defensive Merge)                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    console.log('Step 7: Running Shopify enrichment...\n');
    shopifyEnrichmentResult = await runShopifyEnrichment(shopifyData.customers, config.dryRun);

    console.log('\n  Phase 2 Complete:');
    console.log(`  Total Shopify rows: ${shopifyEnrichmentResult.totalRows}`);
    console.log(`  Rows with valid email: ${shopifyEnrichmentResult.rowsWithValidEmail}`);
    console.log(`  Matched existing profiles: ${shopifyEnrichmentResult.matchedExistingProfiles}`);
    console.log(`  Skipped unmatched rows: ${shopifyEnrichmentResult.skippedUnmatchedRows}`);
    console.log('');
    console.log('  Fields Enriched:');
    console.log(`    shopify_customer_id: ${shopifyEnrichmentResult.fieldsEnriched.shopifyCustomerId}`);
    console.log(`    name: ${shopifyEnrichmentResult.fieldsEnriched.name}`);
    console.log(`    phone: ${shopifyEnrichmentResult.fieldsEnriched.phone}`);
    console.log(`    shopify_ltv: ${shopifyEnrichmentResult.fieldsEnriched.shopifyLtv}`);
    console.log(`    shopify_order_count: ${shopifyEnrichmentResult.fieldsEnriched.shopifyOrderCount}`);
    console.log('');
    console.log('  Conflicts Preserved:');
    console.log(`    name: ${shopifyEnrichmentResult.conflictsPreserved.name}`);
    console.log(`    phone: ${shopifyEnrichmentResult.conflictsPreserved.phone}`);
    console.log('');
  }

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     BACKFILL COMPLETE                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log('Summary:');
  console.log(`  Historical emails processed: ${allEmails.length}`);
  console.log(`  Unique customers: ${supportEmailCount}`);
  console.log(`  Profiles created: ${created}`);
  console.log(`  Profiles merged: ${merged}`);
  console.log(`  Contact facts created: ${factsCreated}`);
  console.log(`  Profiles for recalculation: ${affectedProfileIds.length}`);
  console.log('');
  console.log('Shopify Metrics:');
  console.log(`  Total Shopify customers: ${shopifyData.customers.size}`);
  console.log(`  Matched to support profiles: ${shopifyMatchCount}`);
  console.log(`  Match rate: ${shopifyMatchRate.toFixed(1)}% (of ${supportEmailCount} support customers)`);

  if (shopifyEnrichmentResult) {
    console.log('');
    console.log('Shopify Enrichment Results:');
    console.log(`  Matched existing profiles: ${shopifyEnrichmentResult.matchedExistingProfiles}`);
    console.log(`  Skipped unmatched: ${shopifyEnrichmentResult.skippedUnmatchedRows}`);
    console.log(`  Total fields enriched: ${Object.values(shopifyEnrichmentResult.fieldsEnriched).reduce((a, b) => a + b, 0)}`);
    console.log(`  Total conflicts preserved: ${Object.values(shopifyEnrichmentResult.conflictsPreserved).reduce((a, b) => a + b, 0)}`);
  }

  console.log(`\n${config.dryRun ? '⚠️  DRY RUN - No data written to database\n' : ''}`);
}

/**
 * Create new customer profile from historical data
 */
async function createProfile(
  email: string,
  facts: CustomerFact[],
  shopifyCustomer?: ShopifyCustomer
): Promise<string> {
  const firstFact = facts[0];
  const lastFact = facts[facts.length - 1];

  // Calculate rollups from facts
  const rollups = calculateRollups(facts);

  // Build profile data
  const profileData = {
    email,
    name: firstFact.name,
    preferredContactChannel: 'email',
    lastContactChannel: 'email',
    firstContactAt: firstFact.contactAt,
    lastContactAt: lastFact.contactAt,
    totalContactCount: facts.length,
    totalEmailCount: facts.length,
    lastContactCategory: rollups.lastContactCategory,
    damagedIssueCount: rollups.damagedIssueCount,
    deliveryIssueCount: rollups.deliveryIssueCount,
    usageGuidanceCount: rollups.usageGuidanceCount,
    prePurchaseCount: rollups.prePurchaseCount,
    returnRefundCount: rollups.returnRefundCount,
    stockQuestionCount: rollups.stockQuestionCount,
    praiseUgcCount: rollups.praiseUgcCount,
    lifetimeIssueCount: rollups.lifetimeIssueCount,
    lifetimePositiveFeedbackCount: rollups.lifetimePositiveFeedbackCount,
    isRepeatContact: facts.length >= 2,
    isHighAttentionCustomer: rollups.lifetimeIssueCount >= 3 || facts.length >= 4,
    shopifyCustomerId: shopifyCustomer?.customer_id || null,
    shopifyOrderCount: shopifyCustomer?.orders_count ? parseInt(shopifyCustomer.orders_count, 10) : null,
    shopifyLtv: shopifyCustomer?.total_spent ? parseFloat(shopifyCustomer.total_spent) : null,
    lastOrderAt: shopifyCustomer?.last_order_date ? new Date(shopifyCustomer.last_order_date) : null,
  };

  const [result] = await sql`
    INSERT INTO customer_profiles (
      email, name, preferred_contact_channel, last_contact_channel,
      first_contact_at, last_contact_at, total_contact_count, total_email_count, last_contact_category,
      damaged_issue_count, delivery_issue_count, usage_guidance_count,
      pre_purchase_count, return_refund_count, stock_question_count,
      praise_ugc_count, lifetime_issue_count, lifetime_positive_feedback_count,
      is_repeat_contact, is_high_attention_customer,
      shopify_customer_id, shopify_order_count, shopify_ltv, last_order_at
    ) VALUES (
      ${profileData.email}, ${profileData.name || 'NULL'}, ${profileData.preferredContactChannel}, ${profileData.lastContactChannel},
      ${profileData.firstContactAt.toISOString()}, ${profileData.lastContactAt.toISOString()},
      ${profileData.totalContactCount}, ${profileData.totalEmailCount}, ${profileData.lastContactCategory || 'other_uncategorized'},
      ${profileData.damagedIssueCount}, ${profileData.deliveryIssueCount}, ${profileData.usageGuidanceCount},
      ${profileData.prePurchaseCount}, ${profileData.returnRefundCount}, ${profileData.stockQuestionCount},
      ${profileData.praiseUgcCount}, ${profileData.lifetimeIssueCount}, ${profileData.lifetimePositiveFeedbackCount},
      ${profileData.isRepeatContact}, ${profileData.isHighAttentionCustomer},
      ${profileData.shopifyCustomerId || 'NULL'}, ${profileData.shopifyOrderCount || 'NULL'}, ${profileData.shopifyLtv || 'NULL'},
      ${profileData.lastOrderAt?.toISOString() || 'NULL'}
    )
    RETURNING id
  `;

  const profileId = result.id;

  // Create contact facts with fingerprints
  for (const fact of facts) {
    await sql`
      INSERT INTO customer_contact_facts (
        customer_profile_id, channel, direction, contact_at, category,
        had_damage_claim, had_delivery_issue, had_refund_request, had_positive_feedback
      )
      VALUES (
        ${profileId}, 'email', 'inbound', ${fact.contactAt.toISOString()}, ${fact.category},
        ${fact.category === 'damaged_missing_faulty' ? 'true' : 'false'},
        ${fact.category === 'shipping_delivery_order_issue' ? 'true' : 'false'},
        ${fact.category === 'return_refund_exchange' ? 'true' : 'false'},
        ${fact.category === 'praise_testimonial_ugc' ? 'true' : 'false'}
      )
    `;
  }

  return profileId;
}

/**
 * Merge historical data with existing profile (FIX #22: Affected customers only)
 */
async function mergeProfile(
  existingProfile: any,
  facts: CustomerFact[],
  shopifyCustomer?: ShopifyCustomer
): Promise<number> {
  // Check which facts already exist using fingerprint (FIX #1)
  const existingFacts = await sql`
    SELECT contact_at, category
    FROM customer_contact_facts
    WHERE customer_profile_id = ${existingProfile.id}
      AND channel = 'email'
      AND direction = 'inbound'
  `;

  const existingFingerprints = new Set(
    existingFacts.map(f => createFingerprint(
      '', // email doesn't matter for fingerprint
      '', // subject doesn't matter for fingerprint
      new Date(f.contact_at)
    ))
  );

  // Add only new facts (deduplication by fingerprint)
  const newFacts = facts.filter(f => !existingFingerprints.has(f.fingerprint));

  if (newFacts.length === 0) return 0; // No new data to add

  // Create new contact facts
  for (const fact of newFacts) {
    await sql`
      INSERT INTO customer_contact_facts (
        customer_profile_id, channel, direction, contact_at, category,
        had_damage_claim, had_delivery_issue, had_refund_request, had_positive_feedback
      )
      VALUES (
        ${existingProfile.id}, 'email', 'inbound', ${fact.contactAt.toISOString()}, ${fact.category},
        ${fact.category === 'damaged_missing_faulty' ? 'true' : 'false'},
        ${fact.category === 'shipping_delivery_order_issue' ? 'true' : 'false'},
        ${fact.category === 'return_refund_exchange' ? 'true' : 'false'},
        ${fact.category === 'praise_testimonial_ugc' ? 'true' : 'false'}
      )
    `;
  }

  // Update Shopify fields if provided and missing
  if (shopifyCustomer) {
    const updates: string[] = [];
    if (shopifyCustomer.customer_id && !existingProfile.shopify_customer_id) {
      updates.push(`shopify_customer_id = '${shopifyCustomer.customer_id}'`);
    }
    if (shopifyCustomer.orders_count && !existingProfile.shopify_order_count) {
      updates.push(`shopify_order_count = ${parseInt(shopifyCustomer.orders_count, 10)}`);
    }
    if (shopifyCustomer.total_spent && !existingProfile.shopify_ltv) {
      updates.push(`shopify_ltv = ${parseFloat(shopifyCustomer.total_spent)}`);
    }
    if (shopifyCustomer.last_order_date && !existingProfile.last_order_at) {
      updates.push(`last_order_at = '${new Date(shopifyCustomer.last_order_date).toISOString()}'`);
    }

    if (updates.length > 0) {
      await sql`
        UPDATE customer_profiles
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = ${existingProfile.id}
      `;
    }
  }

  return newFacts.length;
}

/**
 * Recalculate rollups for affected profiles only (FIX #22)
 */
async function recalculateRollups(profileIds: string[]): Promise<void> {
  // Batch processing for performance
  const batchSize = 50;

  for (let i = 0; i < profileIds.length; i += batchSize) {
    const batch = profileIds.slice(i, i + batchSize);

    for (const profileId of batch) {
      // Get all contact facts for this profile
      const facts = await sql`
        SELECT contact_at, category,
          had_damage_claim, had_delivery_issue, had_refund_request, had_positive_feedback
        FROM customer_contact_facts
        WHERE customer_profile_id = ${profileId}
          AND channel = 'email'
          AND direction = 'inbound'
        ORDER BY contact_at ASC
      `;

      if (facts.length > 0) {
        const rollups = calculateRollupsFromFacts(facts);
        const lastFact = facts[facts.length - 1];

        await sql`
          UPDATE customer_profiles
          SET
            total_contact_count = ${facts.length},
            total_email_count = ${facts.length},
            damaged_issue_count = ${rollups.damagedIssueCount},
            delivery_issue_count = ${rollups.deliveryIssueCount},
            usage_guidance_count = ${rollups.usageGuidanceCount},
            pre_purchase_count = ${rollups.prePurchaseCount},
            return_refund_count = ${rollups.returnRefundCount},
            stock_question_count = ${rollups.stockQuestionCount},
            praise_ugc_count = ${rollups.praiseUgcCount},
            lifetime_issue_count = ${rollups.lifetimeIssueCount},
            lifetime_positive_feedback_count = ${rollups.lifetimePositiveFeedbackCount},
            last_contact_at = ${lastFact.contact_at.toISOString()},
            last_contact_category = ${rollups.lastContactCategory || 'other_uncategorized'},
            is_repeat_contact = ${facts.length >= 2 ? 'true' : 'false'},
            is_high_attention_customer = ${rollups.lifetimeIssueCount >= 3 || facts.length >= 4 ? 'true' : 'false'},
            updated_at = NOW()
          WHERE id = ${profileId}
        `;
      }
    }
  }
}

// ============================================================================
// PHASE 2: SHOPIFY ENRICHMENT (Defensive Merge)
// ============================================================================

/**
 * Phase 2: Enrich existing customer profiles with Shopify data
 * Strict defensive merge - only populates null/blank fields, never overwrites existing data
 */
async function runShopifyEnrichment(
  shopifyData: Map<string, ShopifyCustomer>,
  dryRun: boolean
): Promise<ShopifyEnrichmentResult> {
  const result: ShopifyEnrichmentResult = {
    totalRows: shopifyData.size,
    rowsWithValidEmail: 0,
    matchedExistingProfiles: 0,
    skippedUnmatchedRows: 0,
    fieldsEnriched: {
      shopifyCustomerId: 0,
      name: 0,
      phone: 0,
      shopifyLtv: 0,
      shopifyOrderCount: 0,
    },
    conflictsPreserved: {
      name: 0,
      phone: 0,
    },
  };

  // Track skipped and conflict rows for CSV export
  const skippedRows: any[] = [];
  const conflictRows: any[] = [];

  // Load all existing customer profiles
  const existingProfiles = await sql`
    SELECT
      id, email,
      name, phone,
      shopify_customer_id, shopify_order_count, shopify_ltv
    FROM customer_profiles
  `;

  const profilesByEmail = new Map<string, any>();
  for (const profile of existingProfiles) {
    profilesByEmail.set(profile.email.toLowerCase(), profile);
  }

  console.log(`\n  Loaded ${existingProfiles.length} existing profiles for matching`);

  // Process each Shopify customer
  for (const [normalizedEmail, shopifyCustomer] of shopifyData) {
    result.rowsWithValidEmail++;

    const existingProfile = profilesByEmail.get(normalizedEmail);

    if (!existingProfile) {
      // No matching profile - skip and log
      result.skippedUnmatchedRows++;
      skippedRows.push({
        email: normalizedEmail,
        reason: 'No matching customer_profile found',
        shopify_customer_id: shopifyCustomer.customer_id,
      });
      continue;
    }

    result.matchedExistingProfiles++;

    // Defensive merge: only enrich null/blank fields
    const updates: any = {};
    const conflicts: string[] = [];

    // Field: shopify_customer_id (only if current value is null)
    if (shopifyCustomer.customer_id && !existingProfile.shopify_customer_id) {
      updates.shopify_customer_id = String(shopifyCustomer.customer_id);
      result.fieldsEnriched.shopifyCustomerId++;
    }

    // Field: name (only if current name is blank/null)
    if (!existingProfile.name || existingProfile.name.trim() === '') {
      const shopifyName = formatShopifyName(shopifyCustomer.first_name, shopifyCustomer.last_name);
      if (shopifyName) {
        updates.name = shopifyName;
        result.fieldsEnriched.name++;
      }
    } else if (
      shopifyCustomer.first_name ||
      shopifyCustomer.last_name
    ) {
      // Track conflict (existing name preserved)
      const shopifyName = formatShopifyName(shopifyCustomer.first_name, shopifyCustomer.last_name);
      if (shopifyName && shopifyName !== existingProfile.name) {
        conflicts.push('name');
        result.conflictsPreserved.name++;
      }
    }

    // Field: phone (primary: Phone, fallback: Default Address Phone)
    // Only if current phone is blank/null
    if (!existingProfile.phone || existingProfile.phone.trim() === '') {
      const shopifyPhone = shopifyCustomer.phone ||
                          shopifyCustomer.default_address_phone;

      if (shopifyPhone && shopifyPhone.trim() !== '') {
        updates.phone = shopifyPhone.trim();
        result.fieldsEnriched.phone++;
      }
    } else if (
      (shopifyCustomer.phone && shopifyCustomer.phone.trim() !== '') ||
      (shopifyCustomer.default_address_phone && shopifyCustomer.default_address_phone.trim() !== '')
    ) {
      // Track conflict (existing phone preserved)
      const shopifyPhone = shopifyCustomer.phone || shopifyCustomer.default_address_phone;
      if (shopifyPhone && shopifyPhone.trim() !== existingProfile.phone) {
        conflicts.push('phone');
        result.conflictsPreserved.phone++;
      }
    }

    // Field: shopify_ltv (only if current value is null)
    if (shopifyCustomer.total_spent && !existingProfile.shopify_ltv) {
      const ltv = parseFloat(String(shopifyCustomer.total_spent).replace(/[$,]/g, ''));
      if (!isNaN(ltv)) {
        updates.shopify_ltv = ltv;
        result.fieldsEnriched.shopifyLtv++;
      }
    }

    // Field: shopify_order_count (only if current value is null)
    if (shopifyCustomer.orders_count && !existingProfile.shopify_order_count) {
      const orderCount = parseInt(String(shopifyCustomer.orders_count), 10);
      if (!isNaN(orderCount)) {
        updates.shopify_order_count = orderCount;
        result.fieldsEnriched.shopifyOrderCount++;
      }
    }

    // Apply updates if any (and not dry run)
    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        // Build dynamic SET clause
        const setClause = Object.keys(updates)
          .map(key => `${key} = ${updates[key]}`)
          .join(', ');

        await sql`
          UPDATE customer_profiles
          SET ${sql.unsafe(setClause)}
          WHERE id = ${existingProfile.id}
        `;
      }
    }

    // Log conflicts for CSV export
    if (conflicts.length > 0) {
      conflictRows.push({
        email: normalizedEmail,
        profile_id: existingProfile.id,
        conflicts: conflicts.join(', '),
        existing_name: existingProfile.name,
        existing_phone: existingProfile.phone,
        shopify_name: formatShopifyName(shopifyCustomer.first_name, shopifyCustomer.last_name),
        shopify_phone: shopifyCustomer.phone || shopifyCustomer.default_address_phone,
      });
    }
  }

  // Export skipped rows CSV
  if (skippedRows.length > 0) {
    const skippedCsv = generateCsvReport(skippedRows, 'shopify_enrichment_skipped.csv', dryRun);
    console.log(`\n  ✓ Exported ${skippedRows.length} skipped rows to: ${skippedCsv}`);
  }

  // Export conflict rows CSV
  if (conflictRows.length > 0) {
    const conflictCsv = generateCsvReport(conflictRows, 'shopify_enrichment_conflicts.csv', dryRun);
    console.log(`  ✓ Exported ${conflictRows.length} conflict rows to: ${conflictCsv}`);
  }

  return result;
}

/**
 * Format Shopify name: "FirstName LastName" with trimming and space collapsing
 */
function formatShopifyName(firstName?: string, lastName?: string): string | null {
  const parts = [
    firstName?.trim() || '',
    lastName?.trim() || ''
  ].filter(p => p !== '');

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  // Join with single space (collapse any double spaces)
  return parts.join(' ').replace(/\s+/g, ' ');
}

/**
 * Generate CSV report file
 */
function generateCsvReport(data: any[], filename: string, dryRun: boolean): string {
  if (dryRun || data.length === 0) {
    return `[DRY RUN] Would create: ${filename}`;
  }

  const csvContent = stringify(data, {
    header: true,
    columns: Object.keys(data[0]),
  });

  const outputPath = join(__dirname, filename);
  writeFileSync(outputPath, csvContent);

  return outputPath;
}

/**
 * Calculate rollups from contact facts
 */
function calculateRollups(facts: CustomerFact[]) {
  const rollups = {
    damagedIssueCount: 0,
    deliveryIssueCount: 0,
    usageGuidanceCount: 0,
    prePurchaseCount: 0,
    returnRefundCount: 0,
    stockQuestionCount: 0,
    praiseUgcCount: 0,
    lifetimeIssueCount: 0,
    lifetimePositiveFeedbackCount: 0,
    lastContactCategory: 'other_uncategorized' as string, // FIX #3
  };

  for (const fact of facts) {
    switch (fact.category) {
      case 'damaged_missing_faulty':
        rollups.damagedIssueCount++;
        rollups.lifetimeIssueCount++;
        break;
      case 'shipping_delivery_order_issue':
        rollups.deliveryIssueCount++;
        rollups.lifetimeIssueCount++;
        break;
      case 'product_usage_guidance':
        rollups.usageGuidanceCount++;
        break;
      case 'pre_purchase_question':
        rollups.prePurchaseCount++;
        break;
      case 'return_refund_exchange':
        rollups.returnRefundCount++;
        rollups.lifetimeIssueCount++;
        break;
      case 'stock_availability':
        rollups.stockQuestionCount++;
        break;
      case 'praise_testimonial_ugc':
        rollups.praiseUgcCount++;
        rollups.lifetimePositiveFeedbackCount++;
        break;
      case 'account_billing_payment':
      case 'order_modification_cancellation':
        rollups.lifetimeIssueCount++;
        break;
      case 'other_uncategorized':
      default:
        // No category-specific counter
        break;
    }

    // Track last contact category
    if (fact.category) {
      rollups.lastContactCategory = fact.category;
    }
  }

  return rollups;
}

/**
 * Calculate rollups from database fact rows
 */
function calculateRollupsFromFacts(facts: any[]) {
  const rollups = {
    damagedIssueCount: 0,
    deliveryIssueCount: 0,
    usageGuidanceCount: 0,
    prePurchaseCount: 0,
    returnRefundCount: 0,
    stockQuestionCount: 0,
    praiseUgcCount: 0,
    lifetimeIssueCount: 0,
    lifetimePositiveFeedbackCount: 0,
    lastContactCategory: 'other_uncategorized' as string,
  };

  for (const fact of facts) {
    if (fact.had_damage_claim) {
      rollups.damagedIssueCount++;
      rollups.lifetimeIssueCount++;
    }
    if (fact.had_delivery_issue) {
      rollups.deliveryIssueCount++;
      rollups.lifetimeIssueCount++;
    }
    if (fact.had_refund_request) {
      rollups.returnRefundCount++;
      rollups.lifetimeIssueCount++;
    }
    if (fact.had_positive_feedback) {
      rollups.praiseUgcCount++;
      rollups.lifetimePositiveFeedbackCount++;
    }
  }

  // Default last contact category if no categorized facts
  if (rollups.lastContactCategory === '' && facts.length > 0) {
    // Try to get from facts
    const lastCategorized = [...facts].reverse().find(f => f.category && f.category !== 'other_uncategorized');
    if (lastCategorized) {
      rollups.lastContactCategory = lastCategorized.category;
    }
  }

  return rollups;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const config = parseArgs();

runBackfill(config).catch(error => {
  console.error('\n✗ Backfill failed:', error);
  process.exit(1);
});
