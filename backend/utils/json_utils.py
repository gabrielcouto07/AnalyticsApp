from __future__ import annotations

from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd


def json_safe(value: Any) -> Any:
    """Converte valores não serializáveis em JSON para tipos seguros."""
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, pd.DataFrame):
        return json_safe(value.to_dict(orient="records"))
    if isinstance(value, pd.Series):
        return json_safe(value.tolist())
    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        value = float(value)
    if isinstance(value, float):
        return value if np.isfinite(value) else None
    try:
        if pd.api.types.is_scalar(value) and pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _json_safe(value: Any) -> Any:
    """Mantém compatibilidade com imports antigos."""
    return json_safe(value)
