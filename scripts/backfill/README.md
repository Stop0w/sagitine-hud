# Sagitine Backfill Pipeline

**Historical Email Ingestion & Knowledge Base Backfill**

## Overview

This pipeline processes historical Outlook `.msg` files and extracts structured knowledge objects for the Sagitine AI Service Agent.

**What it does:**
1. Parses `.msg` files → Extracts email data
2. Cleans emails → Removes signatures, threads, HTML artifacts
3. Classifies emails → Categories, sentiment, tone (stub or LLM mode)
4. Filters quality → Keeps only training-quality responses (score ≥ 8)
5. Extracts patterns → Response structure, tone, phrasing by category
6. Generates knowledge → Gold response templates + knowledge snippets
7. Exports outputs → DB-ready JSON and SQL insertion scripts

**What it does NOT do:**
- ❌ Create API routes
- ❌ Modify React frontend
- ❌ Build dashboard components
- ❌ Implement Make.com scenarios
- ❌ Connect to Microsoft Graph

This is a **strictly isolated data pipeline**.

---

## Prerequisites

### Python Dependencies

```bash
# Navigate to backfill directory
cd sagitine-hud/scripts/backfill

# Install dependencies
pip install msgextract python-dateutil
```

### Optional: Claude API (for LLM classification)

If you want real AI classification instead of keyword matching:

```bash
# Set environment variable
export ANTHROPIC_API_KEY="your-api-key-here"

# Or create .env file in scripts/backfill/
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

Then edit `config.py` and set:
```python
ENABLE_LLM_CLASSIFICATION = True
```

---

## Directory Structure

```
sagitine-hud/
├── raw_data/                          # INPUT: 1,041 .msg files
├── data/
│   ├── raw_parsed/                    # Step 1 output
│   ├── cleaned/                       # Step 2 output
│   ├── classified/                    # Step 3 output
│   ├── filtered/                      # Step 4 output
│   └── knowledge/                     # Final outputs
│       ├── gold_responses.json        # ✅ Response templates
│       ├── knowledge_snippets.json    # ✅ Policy/fact/guidance
│       └── db_insertion.sql           # ✅ SQL import script
└── scripts/
    └── backfill/
        ├── config.py                  # Centralised configuration
        ├── utils.py                   # Helper functions
        ├── parse_msg.py               # Step 1: Parser
        ├── clean_email.py             # Step 2: Cleaner
        ├── run_classification.py      # Step 3: Classifier
        ├── filter_emails.py           # Step 4: Filter
        ├── extract_patterns.py        # Step 5: Pattern extractor
        ├── generate_knowledge.py      # Step 6: Knowledge generator
        ├── export_outputs.py          # Step 7: Export
        └── README.md                  # This file
```

---

## Usage

### Option A: Run All Steps (Recommended)

```bash
cd sagitine-hud/scripts/backfill
python run_all.py
```

This executes the complete pipeline from `.msg` files to knowledge objects.

### Option B: Run Step-by-Step

Execute each step individually for debugging or validation:

```bash
# Step 1: Parse .msg files
python parse_msg.py

# Step 2: Clean email data
python clean_email.py

# Step 3: Classify (stub mode by default)
python run_classification.py

# Step 4: Filter by quality
python filter_emails.py

# Step 5: Extract patterns
python extract_patterns.py

# Step 6: Generate knowledge objects
python generate_knowledge.py

# Step 7: Export final outputs
python export_outputs.py
```

---

## Step-by-Step Breakdown

### Step 1: Parse .msg Files

**Input:** `raw_data/*.msg` (1,041 files)
**Output:** `data/raw_parsed/*.json`

Extracts:
- Subject
- Sender name/email
- Date/time
- Email body (HTML → plain text)
- Order number (if present)

**What it handles:**
- HTML email bodies
- RTF format
- Missing fields
- Parse errors (logged, not failed)

---

### Step 2: Clean Emails

**Input:** `data/raw_parsed/*.json`
**Output:** `data/cleaned/*.json`

Removes:
- Email signatures (`--`, "Best regards", etc.)
- Email threads/history
- HTML artifacts
- Excessive whitespace

**Preserves:**
- Customer meaning
- Key details (order numbers, product issues)
- Email structure

---

### Step 3: Classify Emails

**Input:** `data/cleaned/*.json`
**Output:** `data/classified/*.json`

**Stub Mode (default):**
- Uses keyword matching
- No API key required
- Fast execution
- Lower accuracy (~70%)

**LLM Mode (Claude API):**
- Uses `claude-3-5-sonnet-20241022`
- Requires `ANTHROPIC_API_KEY`
- Higher accuracy (~85%+)
- Slower execution

**Output fields:**
- `category_primary` - One of 8 canonical categories
- `category_secondary` - Optional secondary category
- `sentiment` - positive/neutral/negative/critical
- `customer_intent` - 1-sentence summary
- `tone_detected` - warm_composed/professional_direct/etc.
- `response_quality_score` - 1-10
- `should_be_used_for_training` - true/false
- `confidence_score` - 0.0-1.0

---

### Step 4: Filter by Quality

**Input:** `data/classified/*.json`
**Output:** `data/filtered/*.json`

**Keeps:**
- `response_quality_score >= 8`
- `should_be_used_for_training = true`

**Removes:**
- Low-quality responses
- Critical sentiment (complaints)
- Very short emails (< 20 words)

**Typical retention:** 30-50% of classified emails

---

### Step 5: Extract Patterns

**Input:** `data/filtered/*.json`
**Output:** `data/filtered/extracted_patterns.json`

**Analyzes by category:**
- Response structure (word count, paragraphs)
- Opening patterns (most common phrases)
- Closing patterns
- Tone patterns (warmth, composure, defensive language)
- Phrasing patterns (Box vs drawer, thank you, etc.)
- What to avoid (over-apologetic language, uncertainty)

---

### Step 6: Generate Knowledge

**Input:** `data/filtered/extracted_patterns.json`
**Output:** `data/knowledge/*.json`

**Creates:**

1. **Gold Response Templates** (`gold_responses.json`)
   - Title
   - Category
   - Body template
   - Tone notes

2. **Knowledge Snippets** (`knowledge_snippets.json`)
   - Type: policy/fact/guidance
   - Category
   - Content
   - Tags

---

### Step 7: Export Outputs

**Input:** `data/knowledge/*.json`
**Output:** Cleaned, validated, DB-ready files

**Ensures:**
- No duplicate IDs
- No empty fields
- Valid categories
- Proper formatting

**Generates:**
- `gold_responses.json` - Final response templates
- `knowledge_snippets.json` - Final knowledge objects
- `db_insertion.sql` - SQL insertion script
- `export_summary.json` - Execution summary

---

## Category System

**Canonical long-form IDs** (never shorten these):

- `damaged_missing_faulty`
- `shipping_delivery_order_issue`
- `product_usage_guidance`
- `pre_purchase_question`
- `return_refund_exchange`
- `stock_availability`
- `partnership_wholesale_press`
- `brand_feedback_general`

---

## Tone Rules (Critical)

All generated outputs follow Sagitine tone:

✅ **DO:**
- Warm but not effusive
- Composed and confident
- Clear and direct
- Non-defensive
- "Thank you" instead of "sorry"

❌ **DON'T:**
- Over-apologise ("sorry for the inconvenience")
- Sound uncertain ("maybe", "perhaps")
- Use weak language
- Refer to "drawers" (always "Boxes")

---

## Outputs

### Gold Response Templates

```json
{
  "id": "damaged_missing_faulty_template",
  "title": "Damaged/Missing/Faulty Response Template",
  "category": "damaged_missing_faulty",
  "body_template": "# Opening\nThank you for reaching out...",
  "tone_notes": "Warm and approachable; Composed and confident",
  "avg_word_count": 150,
  "avg_paragraph_count": 3,
  "sample_count": 42,
  "created_from_patterns": true,
  "created_at": "2026-03-31T12:00:00Z",
  "exported_at": "2026-03-31T14:00:00Z",
  "ready_for_db": true
}
```

### Knowledge Snippets

```json
{
  "id": "damaged_missing_faulty_tone_policy",
  "type": "policy",
  "category": "damaged_missing_faulty",
  "content": "Tone Guidelines for Damaged/Missing/Faulty:\n\n- Warmth: 75%\n- Composure: 82%\n...",
  "tags": ["damaged_missing_faulty", "tone", "policy"],
  "created_at": "2026-03-31T12:00:00Z",
  "exported_at": "2026-03-31T14:00:00Z",
  "ready_for_db": true
}
```

---

## Database Import

After running the pipeline, import knowledge objects into Neon:

### Option A: SQL Script

```bash
# Run the generated SQL script
psql $DATABASE_URL -f data/knowledge/db_insertion.sql
```

### Option B: Programmatic Import

```typescript
// In your API or migration script
import { db } from '@/db';
import { goldResponses, knowledgeSnippets } from '@/db/schema';
import goldResponsesData from './data/knowledge/gold_responses.json';
import snippetsData from './data/knowledge/knowledge_snippets.json';

// Insert gold responses
await db.insert(goldResponses).values(goldResponsesData);

// Insert knowledge snippets
await db.insert(knowledgeSnippets).values(snippetsData);
```

---

## Troubleshooting

### "No .msg files found"

**Error:** `❌ No .msg files found in raw_data/`

**Solution:**
- Check that `raw_data/` folder is at `sagitine-hud/raw_data`
- Verify `.msg` files exist: `ls sagitine-hud/raw_data/*.msg`

---

### "Module 'msgextract' not found"

**Error:** `ModuleNotFoundError: No module named 'msgextract'`

**Solution:**
```bash
pip install msgextract
```

---

### LLM classification fails

**Error:** `LLM classification failed: ...`

**Solution:**
1. Check `ANTHROPIC_API_KEY` is set
2. Verify API key has credits
3. Run in stub mode instead (set `ENABLE_LLM_CLASSIFICATION = False` in `config.py`)

---

### Low retention rate

**Issue:** Only 10-20% of emails pass filtering

**Possible causes:**
- `response_quality_score` threshold too high
- Training emails have low quality
- Stub classifier under-scoring

**Solutions:**
- Lower `MIN_RESPONSE_QUALITY_SCORE` in `config.py`
- Use LLM classification for better scoring
- Review classified emails in `data/classified/`

---

## Performance

**Typical execution times** (1,041 emails):

- **Stub mode:** ~2-3 minutes
- **LLM mode:** ~15-20 minutes (API rate limits)

**Disk usage:**
- Input: ~500MB (raw .msg files)
- Output: ~50MB (parsed JSON files)

---

## Configuration

Edit `config.py` to customise:

```python
# Minimum quality for training data
MIN_RESPONSE_QUALITY_SCORE = 8

# Enable/disable LLM classification
ENABLE_LLM_CLASSIFICATION = False  # Set to True for Claude API

# Filtering thresholds
MIN_CONFIDENCE_SCORE = 0.7

# Logging level
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR
```

---

## Next Steps

After pipeline completes:

1. **Review outputs:**
   - Check `data/knowledge/gold_responses.json`
   - Check `data/knowledge/knowledge_snippets.json`

2. **Validate quality:**
   - Read sample templates
   - Verify tone matches Sagitine brand
   - Check for "drawer" vs "Box" terminology

3. **Import to database:**
   - Run `data/knowledge/db_insertion.sql` in Neon
   - Or use programmatic import

4. **Test retrieval:**
   - Query database for templates by category
   - Verify knowledge snippets are searchable

5. **Integrate with LLM:**
   - Use gold responses for RAG retrieval
   - Inject knowledge snippets into prompts
   - Improve classification accuracy

---

## Support

**Issues?**
- Check logs in each `data/*/summary.json` file
- Review intermediate outputs
- Run pipeline step-by-step to isolate issues

**File locations:**
- Raw data: `sagitine-hud/raw_data/`
- Processed data: `sagitine-hud/data/`
- Scripts: `sagitine-hud/scripts/backfill/`
- Final outputs: `sagitine-hud/data/knowledge/`

---

**Generated by:** Sagitine Backfill Pipeline v1.0
**Created:** 2026-03-31
**Purpose:** Historical email ingestion and knowledge base backfill
