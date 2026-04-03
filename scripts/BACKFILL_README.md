# Customer Profile Backfill Tool

## Purpose

Build persistent customer service profiles from historical email data and Shopify exports using a two-phase approach:

**Phase 1**: Support-history backfill from historical .msg emails
**Phase 2**: Shopify enrichment (defensive merge of existing profiles only)

---

## Expected Input Structure

### 1. Historical Email Files (.msg format)

**Directory structure:**
```
historical-emails/
├── 2024/
│   ├── January/
│   │   ├── Damaged Items/
│   │   │   ├── Customer - Damaged Box.msg
│   │   │   └── Sarah - Dent in Stand.msg
│   │   ├── Shipping Inquiries/
│   │   └── Orders/
│   └── February/
└── 2023/
    └── ...
```

**.msg file requirements:**
- Must be valid Outlook .msg format
- Must have `From:` header with customer email
- Must have `Date:` header with valid timestamp
- Files without sender email or date are skipped

**What gets extracted:**
- `fromEmail` (normalized lowercase)
- `fromName` (if present)
- `subject`
- `sentAt` (timestamp)
- `category` (from folder/filename heuristics)

**Filters applied:**
- ✅ Customer emails (contains @)
- ❌ Internal domains (sagitine.com, sagitine.com.au)
- ✅ Has valid timestamp
- ❌ Drafts (no sent date)

---

### 2. Shopify Customer Export (CSV)

**Required columns (flexible mapping):**
- Email address (any case): `email`, `Email`, `customer_email`
- Customer ID: `customer_id`, `Customer ID`, `id`
- Order count: `orders_count`, `Orders Count`, `Total Orders`
- Total spent: `total_spent`, `Total Spent`, `Lifetime Sales`
- Last order date: `last_order_date`, `Last Order Date`
- First name: `first_name`, `First Name`
- Last name: `last_name`, `Last Name`

**Sample CSV structure:**
```csv
Email,Customer ID,First Name,Last Name,Orders Count,Total Spent,Last Order Date
customer@example.com,12345678,Jane,Doe,3,450.50,2024-03-15
another@example.com,87654321,John,Smith,1,150.00,2024-02-20
```

**Shopify data is used for:**
- Enriching existing profiles (not creating Shopify-only profiles)
- Matching by normalized email address
- Filling in: `shopify_customer_id`, `shopify_order_count`, `shopify_ltv`, `last_order_at`

---

## Historical Classification Strategy

**Priority order for category detection:**

### 1. Structured project data (if available)
Not implemented in MVP - reserved for future use.

### 2. Folder/filename heuristics
**Category pattern matching:**
- Folder: `Damaged Items/` → `damaged_missing_faulty`
- Filename: `Sarah - Dent in Stand.msg` → `damaged_missing_faulty`
- Subject: "Delivery delay on order #123" → `shipping_delivery_order_issue`

**Full pattern map:**
```
damaged_missing_faulty:   damaged, dent, broken, faulty, smashed, cracked
shipping_delivery:       delivery, shipping, tracking, shipped, dispatch
product_usage:            how to, instruction, assembly, usage, setup, guide
pre_purchase:              pre-purchase, before buying, question, inquiry
return_refund:             return, refund, exchange, send back
stock_availability:       stock, available, back-order
partnership:               wholesale, press, influencer, partnership
praise:                    praise, testimonial, feedback, review, love, amazing
payment:                   payment, billing, invoice, charge
cancellation:              cancel, modification, change order
```

### 3. Fallback: totals-only
If no category detected:
- Creates contact fact with `category = NULL`
- Does NOT populate category-specific counters
- Still counts toward `total_contact_count`

---

## Deduplication Strategy

### Existing Profiles (Merge Logic)

**When a profile already exists:**

1. **Do NOT overwrite existing data**
   - Preserve all existing rollup counters
   - Preserve `first_contact_at`
   - Preserve Shopify fields if already set

2. **Add missing Shopify data only**
   - If `shopify_customer_id` is NULL → set from CSV
   - If `shopify_order_count` is NULL → set from CSV
   - If `shopify_ltv` is NULL → set from CSV
   - If `last_order_at` is NULL → set from CSV

3. **Insert only new contact facts**
   - Build composite key: `contactAt_timestamp + category`
   - Check against existing facts in database
   - Insert only facts not already represented

4. **Recalculate rollups from combined fact set**
   - After inserting new facts, run full recalculation
   - Counts all facts (old + new) atomically
   - Updates flags: `is_repeat_contact`, `is_high_attention_customer`

### Contact Fact Deduplication

**Composite key:**
```
customer_profile_id + contact_at + category + direction + channel
```

**Example:**
- Existing fact: `(profile-123, 2024-03-15T10:00:00Z, damaged_missing_faulty, inbound, email)`
- Historical fact: `(profile-123, 2024-03-15T10:00:00Z, damaged_missing_faulty, inbound, email)`
- Result: **Skip** (duplicate)

**Timeline:**
```
1. Scan all historical emails
2. Build in-memory facts map
3. For each customer:
   a. Load existing profile and facts
   b. Filter out duplicates (composite key match)
   c. Insert only new facts
   d. Recalculate all rollups from combined fact set
```

---

## Dry Run Output Summary

**Example output:**
```
╔══════════════════════════════════════════════════════════════════╗
║     Customer Profile Backfill Tool                                  ║
╚══════════════════════════════════════════════════════════════════╝

Configuration:
  Emails dir:  ./historical-emails
  Shopify CSV: ./shopify-customers.csv
  Dry run:    Yes (no writes)
  Limit:      All
  Since date: All

Step 1: Scanning historical email files...
  Found 1,247 valid customer emails

Step 2: Loading Shopify customer export...
  Parsed 856 Shopify customers

Step 3: Building customer contact facts...
  Built facts for 892 unique customers

Step 4: Checking existing customer profiles...
  Found 145 existing profiles

Step 5: Processing customers and creating profiles...

  Progress: 100/892 customers...

  Processed 892 customers
  Created 747 new profiles
  Merged 145 existing profiles
  Created 1,247 contact facts

Step 6: Recalculating rollups from contact facts...
  ✓ Rollups recalculated

╔══════════════════════════════════════════════════════════════════╗
║     BACKFILL COMPLETE                                                  ║
╚══════════════════════════════════════════════════════════════════╝

Summary:
  Historical emails processed: 1,247
  Unique customers: 892
  Profiles created: 747
  Profiles merged: 145
  Contact facts created: 1,247
  Shopify customers matched: 856

⚠️  DRY RUN - No data written to database
```

---

## Phase 2: Shopify Enrichment (Defensive Merge)

**Purpose**: Enrich existing customer profiles with Shopify data, but never create Shopify-only profiles.

**Execution Order**:
- Runs automatically AFTER Phase 1 (support-history backfill) completes
- Only executes if `--shopify-csv` flag is provided
- Safe to rerun idempotently

**Strict Column Detection**:
- Case-insensitive matching
- Trim spaces from headers
- Treat underscores and spaces as equivalent
- Example: `"First Name"` and `"first_name"` both match

**Merge Rules** (Defensive - never overwrites existing data):

1. **Match by normalized email only**
   - Shopify rows are matched to existing `customer_profiles` by email
   - No match = skip row and log to `shopify_enrichment_skipped.csv`

2. **Field enrichment rules** (only if current value is NULL/blank):
   - `shopify_customer_id` ← `Customer ID`
   - `name` ← `First Name + Last Name` (formatted as "FirstName LastName")
   - `phone` ← `Phone` (primary), `Default Address Phone` (fallback)
   - `shopify_ltv` ← `Total Spent` (parsed as number)
   - `shopify_order_count` ← `Total Orders` (parsed as integer)

3. **Conflict preservation**:
   - If profile has non-null value and Shopify has different value
   - Preserve profile value, log conflict to `shopify_enrichment_conflicts.csv`
   - Increment conflict count for reporting

**CSV Exports**:
- `shopify_enrichment_skipped.csv` - Rows that couldn't match existing profiles
- `shopify_enrichment_conflicts.csv` - Rows where conflicts were preserved

**Example Enrichment Summary**:
```
Phase 2 Complete:
  Total Shopify rows: 856
  Rows with valid email: 856
  Matched existing profiles: 642
  Skipped unmatched rows: 214

  Fields Enriched:
    shopify_customer_id: 642
    name: 128
    phone: 95
    shopify_ltv: 642
    shopify_order_count: 642

  Conflicts Preserved:
    name: 187
    phone: 62
```

**Idempotent**: Safe to rerun - will only update NULL/blank fields, never overwrite existing data.

---

## Usage Examples

### Dry run (recommended first)
```bash
npx tsx scripts/backfill-customer-profiles.ts \
  --emails-dir "./historical-emails" \
  --shopify-csv "./shopify-export.csv" \
  --dry-run
```

### Limited test run
```bash
npx tsx scripts/backfill-customer-profiles.ts \
  --emails-dir "./historical-emails" \
  --limit 100
```

### Recent emails only
```bash
npx tsx scripts/backfill-customer-profiles.ts \
  --emails-dir "./historical-emails" \
  --since-date "2024-01-01T00:00:00Z"
```

### Full backfill
```bash
npx tsx scripts/backfill-customer-profiles.ts \
  --emails-dir "./historical-emails" \
  --shopify-csv "./shopify-export.csv"
```

---

## Rollup Recalculation Logic

**Fact-first approach:**
1. Ingest all facts (historical + existing)
2. Count facts by category flags
3. Update profile atomically with final counts

**Category mapping (fact → counter):**
- `had_damage_claim = true` → `damaged_issue_count++`
- `had_delivery_issue = true` → `delivery_issue_count++`
- `had_refund_request = true` → `return_refund_count++`
- `had_positive_feedback = true` → `praise_ugc_count++`

**Lifetime issue calculation:**
```
damaged_issue_count + delivery_issue_count + return_refund_count
+ (account_billing_payment facts) + (order_modification_cancellation facts)
```

**High-attention flag (automated):**
```
is_high_attention_customer = (lifetime_issue_count >= 3 OR total_contact_count >= 4)
```

---

## Dependencies

Required npm packages:
```bash
npm install msg-parser csv-parse
```

---

## Error Handling

**Skipped files:**
- Missing `From:` header
- Invalid date format
- Internal domain emails
- Draft emails (no sent date)

**Skipped customers:**
- No valid email address
- All parse attempts failed

**Logged warnings:**
All skipped files/customers logged to console with specific reason.

---

## Post-Backfill Validation

**Check results with these queries:**

```sql
-- Total profiles created
SELECT COUNT(*) FROM customer_profiles;

-- High-attention customers
SELECT email, total_contact_count, lifetime_issue_count, is_high_attention_customer
FROM customer_profiles
WHERE is_high_attention_customer = true;

-- Profiles with Shopify data
SELECT email, shopify_customer_id, shopify_order_count, shopify_ltv
FROM customer_profiles
WHERE shopify_customer_id IS NOT NULL;

-- Contact facts by category
SELECT category, COUNT(*) as count
FROM customer_contact_facts
WHERE category IS NOT NULL
GROUP BY category
ORDER BY count DESC;
```
