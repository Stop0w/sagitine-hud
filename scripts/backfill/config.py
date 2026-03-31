"""
Configuration for Sagitine backfill pipeline.

Centralised settings for paths, categories, and processing rules.
"""

import os
from pathlib import Path

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "raw_data"
DATA_DIR = PROJECT_ROOT / "data"

# Pipeline stage directories
RAW_PARSED_DIR = DATA_DIR / "raw_parsed"
CLEANED_DIR = DATA_DIR / "cleaned"
CLASSIFIED_DIR = DATA_DIR / "classified"
FILTERED_DIR = DATA_DIR / "filtered"
KNOWLEDGE_DIR = DATA_DIR / "knowledge"

# Output files
GOLD_RESPONSES_OUTPUT = KNOWLEDGE_DIR / "gold_responses.json"
KNOWLEDGE_SNIPPETS_OUTPUT = KNOWLEDGE_DIR / "knowledge_snippets.json"

# Mandatory canonical category IDs (DO NOT SHORTEN THESE)
CATEGORIES = [
    "damaged_missing_faulty",
    "shipping_delivery_order_issue",
    "product_usage_guidance",
    "pre_purchase_question",
    "return_refund_exchange",
    "stock_availability",
    "partnership_wholesale_press",
    "brand_feedback_general",
]

# Category display labels (for human readability)
CATEGORY_LABELS = {
    "damaged_missing_faulty": "Damaged/Missing/Faulty",
    "shipping_delivery_order_issue": "Shipping/Delivery",
    "product_usage_guidance": "Product Usage",
    "pre_purchase_question": "Pre-Purchase",
    "return_refund_exchange": "Return/Refund/Exchange",
    "stock_availability": "Stock Availability",
    "partnership_wholesale_press": "Partnership/Wholesale/Press",
    "brand_feedback_general": "Brand Feedback/General",
}

# Sentiment values
SENTIMENTS = ["positive", "neutral", "negative", "critical"]

# Tone values
TONES = [
    "warm_composed",
    "professional_direct",
    "empathetic_confident",
    "clarifying_helpful",
]

# Filtering thresholds
MIN_RESPONSE_QUALITY_SCORE = 8  # Keep only 8+ quality
MIN_CONFIDENCE_SCORE = 0.7      # Minimum AI confidence for training

# LLM API (optional - can run in stub mode)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Processing flags
ENABLE_LLM_CLASSIFICATION = False  # Set to True when API key is ready
LOG_LEVEL = "INFO"                 # DEBUG, INFO, WARNING, ERROR

# Sagitine brand rules
BRAND_TERMS = {
    "storage_product": "Box",      # Always "Box", never "drawer"
    "company_name": "Sagitine",
}

TONE_RULES = {
    "warm_composed": "Warm but not effusive, composed and confident",
    "professional_direct": "Clear and direct, not defensive",
    "empathetic_confident": "Understanding but not overly apologetic",
    "clarifying_helpful": "Helpful guidance without uncertainty",
}

AVOID_PHRASES = [
    "sorry for the inconvenience",
    "we apologise",
    "regret to inform",
    "unfortunately we",
    "i'm afraid",
]

# Ensure all directories exist
for dir_path in [RAW_PARSED_DIR, CLEANED_DIR, CLASSIFIED_DIR, FILTERED_DIR, KNOWLEDGE_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

print(f"[OK] Configuration loaded")
print(f"   Raw data: {RAW_DATA_DIR}")
print(f"   Output root: {DATA_DIR}")
