import sys
from pathlib import Path

# Sobe dois níveis: backend/services/ → backend/ → AnalyticsApp/
sys.path.append(str(Path(__file__).parent.parent.parent))

from config.analytics import calculate_trend, detect_outliers_iqr, identify_anomalies, categorize_dataset

__all__ = ["calculate_trend", "detect_outliers_iqr", "identify_anomalies", "categorize_dataset"]
