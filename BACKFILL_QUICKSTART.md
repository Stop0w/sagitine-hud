# 🚀 Sagitine Backfill Pipeline - Quick Start

**Historical Email → Knowledge Objects (Appendix B)**

---

## What This Does

Transforms 1,041 historical Outlook `.msg` files into:
- **Gold response templates** (reusable for RAG)
- **Knowledge snippets** (policy/fact/guidance objects)

**Scope:** Data pipeline only. No API routes, no frontend, no dashboard.

---

## One-Command Execution

```bash
cd sagitine-hud/scripts/backfill
pip install -r requirements.txt
python run_all.py
```

**Time:** ~2-3 minutes (stub mode) or ~15-20 minutes (LLM mode)

---

## Outputs

```
data/knowledge/
├── gold_responses.json       # 8 response templates (one per category)
├── knowledge_snippets.json   # ~30-40 policy/fact/guidance items
├── db_insertion.sql          # SQL import script
└── export_summary.json       # Execution summary
```

---

## Import to Database

```bash
psql $DATABASE_URL -f sagitine-hud/data/knowledge/db_insertion.sql
```

---

## Documentation

**Full guide:** `scripts/backfill/README.md`
**Delivery summary:** `scripts/backfill/DELIVERY_SUMMARY.md`

---

## Files Created

- 11 Python scripts (7 pipeline steps + 4 supporting files)
- 2 documentation files
- Complete config system
- Error handling & logging

---

## Categories (Canonical Long-Form IDs)

1. `damaged_missing_faulty`
2. `shipping_delivery_order_issue`
3. `product_usage_guidance`
4. `pre_purchase_question`
5. `return_refund_exchange`
6. `stock_availability`
7. `partnership_wholesale_press`
8. `brand_feedback_general`

---

## Tone Rules

✅ Warm, composed, confident, clear
✅ "Thank you" not "sorry"
✅ "Box" not "drawer"

❌ Over-apologetic
❌ Uncertain language
❌ Defensive tone

---

## Next Steps

1. ✅ Run pipeline: `python run_all.py`
2. 📋 Review outputs in `data/knowledge/`
3. 💾 Import to database: `psql ... -f db_insertion.sql`
4. 🎯 Integrate with LLM/RAG system

---

**Location:** `sagitine-hud/scripts/backfill/`
**Input:** `sagitine-hud/raw_data/` (1,041 .msg files)
**Output:** `sagitine-hud/data/knowledge/`
