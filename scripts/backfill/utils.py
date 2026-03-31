"""
Utility functions for Sagitine backfill pipeline.

Common helpers for logging, file I/O, text processing.
"""

import json
import logging
import re
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def setup_logging(level: str = "INFO") -> None:
    """Configure logging level."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.getLogger().setLevel(log_level)
    logger.setLevel(log_level)


def load_json(file_path: Path) -> Dict[str, Any]:
    """Load JSON file with error handling."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        return {}


def save_json(data: Any, file_path: Path) -> bool:
    """Save data to JSON file with error handling."""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Saved: {file_path}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to save {file_path}: {e}")
        return False


def load_json_files(directory: Path) -> List[Dict[str, Any]]:
    """Load all JSON files from a directory."""
    results = []
    json_files = list(directory.glob("*.json"))
    logger.info(f"Loading {len(json_files)} files from {directory}")

    for json_file in json_files:
        data = load_json(json_file)
        if data:
            results.append(data)

    return results


def clean_whitespace(text: str) -> str:
    """Remove excessive whitespace while preserving meaning."""
    if not text:
        return ""
    # Replace multiple spaces with single space
    text = re.sub(r' +', ' ', text)
    # Replace multiple newlines with double newline
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Strip leading/trailing whitespace
    return text.strip()


def remove_email_signatures(text: str) -> str:
    """Remove common email signature patterns."""
    if not text:
        return ""

    # Signature markers
    sig_patterns = [
        r'-- \n.*',           # Standard "--" signature marker
        r'Best regards,.*',
        r'Regards,.*',
        r'Cheers,.*',
        r'Thanks,.*',
        r'Kind regards,.*',
        r'Warmly,.*',
        r'Sent from my.*',
        r'Get Outlook.*',
    ]

    for pattern in sig_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

    return text.strip()


def remove_email_threads(text: str) -> str:
    """Remove email thread/history patterns."""
    if not text:
        return ""

    # Common thread indicators
    thread_patterns = [
        r'-{3,}Original Message-{3,}.*',
        r'From:.*Sent:.*To:.*Subject:.*',
        r'On .* wrote:.*',
        r'-----BEGIN PGP SIGNED MESSAGE-----.*',
        r'\*?\*?From:\*?\*?',
    ]

    for pattern in thread_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

    return text.strip()


def extract_order_number(text: str) -> str | None:
    """Extract order number from text (if present)."""
    # Match # followed by 4+ digits, or just 4-6 digits
    patterns = [
        r'#(\d{4,})',           # #12345
        r'order\s*#?[:\s]*(\d{4,})',  # order #12345
        r'(\d{5,6})',           # 5-6 digit number
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


def truncate_text(text: str, max_length: int = 500) -> str:
    """Truncate text to max length, preserving word boundaries."""
    if not text or len(text) <= max_length:
        return text

    truncated = text[:max_length]
    # Find last complete word
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.8:  # If we can keep most of it
        truncated = truncated[:last_space]

    return truncated + '...'


def calculate_word_count(text: str) -> int:
    """Calculate word count of text."""
    if not text:
        return 0
    return len(text.split())


def validate_category(category: str, valid_categories: List[str]) -> bool:
    """Validate category is in allowed list."""
    return category in valid_categories


def standardise_category_name(category: str) -> str:
    """Convert category name to lowercase with underscores."""
    if not category:
        return ""
    # Convert to lowercase, replace spaces/hyphens with underscores
    return re.sub(r'[\s-]+', '_', category.lower().strip())


def get_timestamp() -> str:
    """Get current timestamp for logging."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def print_progress(current: int, total: int, prefix: str = "") -> None:
    """Print progress bar."""
    percent = (current / total) * 100 if total > 0 else 0
    bar_length = 40
    filled = int(bar_length * current / total) if total > 0 else 0
    bar = '█' * filled + '░' * (bar_length - filled)

    print(f'\r{prefix} [{bar}] {percent:.1f}% ({current}/{total})', end='', flush=True)

    if current == total:
        print()  # New line when complete


class PipelineStats:
    """Track pipeline execution statistics."""

    def __init__(self):
        self.start_time = datetime.now()
        self.stats = {
            "total_processed": 0,
            "success_count": 0,
            "error_count": 0,
            "filtered_count": 0,
            "categories": {},
            "errors": [],
        }

    def record_success(self, category: str = None) -> None:
        """Record a successful processing."""
        self.stats["success_count"] += 1
        self.stats["total_processed"] += 1

        if category:
            if category not in self.stats["categories"]:
                self.stats["categories"][category] = 0
            self.stats["categories"][category] += 1

    def record_error(self, error_msg: str) -> None:
        """Record a processing error."""
        self.stats["error_count"] += 1
        self.stats["total_processed"] += 1
        self.stats["errors"].append(error_msg)

    def record_filtered(self) -> None:
        """Record a filtered item."""
        self.stats["filtered_count"] += 1

    def get_summary(self) -> str:
        """Get summary statistics as string."""
        duration = (datetime.now() - self.start_time).total_seconds()

        summary = f"""
╔════════════════════════════════════════════════════════╗
║           PIPELINE EXECUTION SUMMARY                   ║
╠════════════════════════════════════════════════════════╣
║ Total Processed:  {self.stats["total_processed"]:>6}                          ║
║ Success:         {self.stats["success_count"]:>6}                          ║
║ Errors:          {self.stats["error_count"]:>6}                          ║
║ Filtered:        {self.stats["filtered_count"]:>6}                          ║
║ Duration:        {duration:>6.1f} seconds                      ║
╠════════════════════════════════════════════════════════╣
║ Category Breakdown:                                     ║
"""

        for category, count in sorted(self.stats["categories"].items(), key=lambda x: -x[1]):
            summary += f"║  {category:<40} {count:>6}                ║\n"

        summary += "╚════════════════════════════════════════════════════════╝"

        return summary

    def save_summary(self, output_path: Path) -> None:
        """Save summary to JSON file."""
        summary_data = {
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": (datetime.now() - self.start_time).total_seconds(),
            **self.stats
        }
        save_json(summary_data, output_path)
