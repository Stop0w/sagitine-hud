#!/usr/bin/env python3
"""
Sagitine Backfill Pipeline - Complete Execution

Runs all 7 steps from .msg parsing to knowledge export.

Usage:
    python run_all.py

This will execute:
    Step 1: Parse .msg files
    Step 2: Clean emails
    Step 3: Classify (stub or LLM mode)
    Step 4: Filter by quality
    Step 5: Extract patterns
    Step 6: Generate knowledge
    Step 7: Export outputs
"""

import sys
import subprocess
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import ENABLE_LLM_CLASSIFICATION
from utils import logger


def run_step(script_name: str, step_number: int, description: str) -> bool:
    """Run a single pipeline step."""
    logger.info(f"\n{'='*60}")
    logger.info(f"STEP {step_number}: {description}")
    logger.info(f"{'='*60}\n")

    script_path = Path(__file__).parent / script_name

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=Path(__file__).parent,
            capture_output=False,
            text=True
        )

        if result.returncode == 0:
            logger.info(f"✅ Step {step_number} complete")
            return True
        else:
            logger.error(f"❌ Step {step_number} failed (exit code: {result.returncode})")
            return False

    except Exception as e:
        logger.error(f"❌ Step {step_number} error: {e}")
        return False


def main():
    """Run complete pipeline."""
    start_time = datetime.now()

    logger.info("\n" + "="*60)
    logger.info("  SAGITINE BACKFILL PIPELINE")
    logger.info("  Historical Email → Knowledge Objects")
    logger.info("="*60)

    logger.info(f"\n📋 Configuration:")
    logger.info(f"   Classification mode: {'LLM (Claude API)' if ENABLE_LLM_CLASSIFICATION else 'STUB (keyword matching)'}")
    logger.info(f"   Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    # Define pipeline steps
    steps = [
        ("parse_msg.py", 1, "Parse .msg files"),
        ("clean_email.py", 2, "Clean email data"),
        ("run_classification.py", 3, "Classify emails"),
        ("filter_emails.py", 4, "Filter by quality"),
        ("extract_patterns.py", 5, "Extract patterns"),
        ("generate_knowledge.py", 6, "Generate knowledge objects"),
        ("export_outputs.py", 7, "Export final outputs"),
    ]

    # Execute pipeline
    completed_steps = []
    failed_at = None

    for script, step_num, description in steps:
        success = run_step(script, step_num, description)
        completed_steps.append(step_num)

        if not success:
            failed_at = step_num
            logger.error(f"\n❌ Pipeline failed at step {step_num}")
            break

    # Calculate duration
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    # Print final summary
    logger.info("\n" + "="*60)
    logger.info("  PIPELINE EXECUTION SUMMARY")
    logger.info("="*60)

    if failed_at:
        logger.info(f"\n❌ Status: FAILED at step {failed_at}")
        logger.info(f"   Completed: {completed_steps}")
        logger.info(f"   Duration:  {duration:.1f} seconds")
        logger.info(f"\n🔧 Troubleshooting:")
        logger.info(f"   1. Check error messages above")
        logger.info(f"   2. Review intermediate outputs in data/ directory")
        logger.info(f"   3. Fix issue and re-run from failed step")
        sys.exit(1)

    else:
        logger.info(f"\n✅ Status: COMPLETE")
        logger.info(f"   All steps: {completed_steps}")
        logger.info(f"   Duration:  {duration:.1f} seconds")
        logger.info(f"   Finished: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")

        logger.info(f"\n📁 Final Outputs:")
        logger.info(f"   Gold Response Templates:  data/knowledge/gold_responses.json")
        logger.info(f"   Knowledge Snippets:      data/knowledge/knowledge_snippets.json")
        logger.info(f"   SQL Import Script:       data/knowledge/db_insertion.sql")
        logger.info(f"   Export Summary:          data/knowledge/export_summary.json")

        logger.info(f"\n🎯 Next Steps:")
        logger.info(f"   1. Review gold_responses.json for quality")
        logger.info(f"   2. Review knowledge_snippets.json for accuracy")
        logger.info(f"   3. Import to Neon database:")
        logger.info(f"      psql $DATABASE_URL -f data/knowledge/db_insertion.sql")
        logger.info(f"   4. Verify records in database")
        logger.info(f"   5. Test retrieval in application")

        logger.info(f"\n✨ Pipeline complete!")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n⚠️  Pipeline interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
