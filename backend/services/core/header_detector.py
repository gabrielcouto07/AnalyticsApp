from __future__ import annotations

import math
from typing import Any, Iterable

import pandas as pd

from .normalizer import strip_accents


class HeaderNotFoundError(ValueError):
    """Raised when a compatible header row cannot be found."""


def _normalize_cell(value: Any) -> str:
    text = strip_accents(str(value or "")).upper().strip()
    return " ".join(text.split())


def _normalize_required(values: Iterable[str]) -> list[str]:
    return [_normalize_cell(value) for value in values if str(value or "").strip()]


def find_header_row(
    df_raw: pd.DataFrame,
    required_cols: list[str],
    search_limit: int = 30,
) -> int:
    """Find the row that best matches the expected header labels."""
    if df_raw.empty:
        source_name = df_raw.attrs.get("source_name", "arquivo desconhecido")
        raise HeaderNotFoundError(f"Nenhuma linha encontrada para detectar o cabecalho em {source_name}.")

    normalized_required = _normalize_required(required_cols)
    threshold = max(1, math.ceil(len(normalized_required) * 0.6))

    best_row = -1
    best_score = -1
    upper_bound = min(len(df_raw), max(search_limit, 1))

    for row_index in range(upper_bound):
        row_values = {
            normalized
            for value in df_raw.iloc[row_index].tolist()
            if pd.notna(value) and (normalized := _normalize_cell(value))
        }
        if not row_values:
            continue

        score = 0
        for required in normalized_required:
            if any(required == cell or required in cell or cell in required for cell in row_values):
                score += 1
        if score > best_score:
            best_score = score
            best_row = row_index

    if best_row >= 0 and best_score >= threshold:
        return best_row

    source_name = df_raw.attrs.get("source_name", "arquivo desconhecido")
    expected = ", ".join(required_cols)
    raise HeaderNotFoundError(
        f"Nao foi possivel detectar o cabecalho em {source_name}. Colunas esperadas: {expected}."
    )
