from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from difflib import get_close_matches
from typing import Any

import pandas as pd


def strip_accents(s: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(s or ""))
    return normalized.encode("ascii", "ignore").decode("ascii")


def _normalize_token(value: Any) -> str:
    text = strip_accents(str(value or "")).upper().strip()
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return " ".join(text.split())


def _coerce_numeric(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    cleaned = (
        series.astype(str)
        .str.replace("\xa0", " ", regex=False)
        .str.replace(r"R\$\s*", "", regex=True)
        .str.replace(r"\s+", "", regex=True)
        .str.replace(r"\.(?=\d{3}(?:[.,]|$))", "", regex=True)
        .str.replace(",", ".", regex=False)
        .str.replace(r"[^0-9.\-]", "", regex=True)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def _coerce_date(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", dayfirst=True)


def _strip_strings(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series) or pd.api.types.is_datetime64_any_dtype(series):
        return series
    return series.astype("string").str.strip().replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})


def _is_numeric_target(column: str) -> bool:
    token = _normalize_token(column)
    return any(
        keyword in token
        for keyword in (
            "VALOR",
            "QTD",
            "QUANTIDADE",
            "CUSTO",
            "SALDO",
            "TOTAL",
            "PCT",
            "PERCENT",
            "TAXA",
            "MES",
            "REALIZADO",
            "VERBA",
            "COUNT",
        )
    )


def _is_date_target(column: str) -> bool:
    token = _normalize_token(column)
    return any(keyword in token for keyword in ("DATA", "VENCTO", "VENCIMENTO", "RECBTO", "RECEBTO"))


def fuzzy_column_match(df_cols: Iterable[Any], target_cols: Iterable[Any]) -> dict[str, str]:
    normalized_df_cols = {_normalize_token(column): str(column) for column in df_cols}
    matches: dict[str, str] = {}

    for target_col in target_cols:
        target_key = str(target_col)
        normalized_target = _normalize_token(target_col)
        if not normalized_target:
            continue

        if normalized_target in normalized_df_cols:
            matches[target_key] = normalized_df_cols[normalized_target]
            continue

        close = get_close_matches(normalized_target, list(normalized_df_cols.keys()), n=1, cutoff=0.7)
        if close:
            matches[target_key] = normalized_df_cols[close[0]]

    return matches


def normalize_df(df: pd.DataFrame, column_map: dict[str, Any]) -> pd.DataFrame:
    """
    Normalize a DataFrame to a canonical schema.

    ``column_map`` accepts:
    - ``{"target": "source alias"}``
    - ``{"target": ["alias 1", "alias 2"]}``
    - ``{"target": None}`` to match the target name itself
    """
    if df.empty:
        return pd.DataFrame(columns=list(column_map.keys()))

    rename_map: dict[str, str] = {}
    for target_col, aliases in column_map.items():
        candidates: list[str]
        if aliases is None:
            candidates = [target_col]
        elif isinstance(aliases, str):
            candidates = [aliases, target_col]
        elif isinstance(aliases, Iterable):
            candidates = [str(alias) for alias in aliases] + [target_col]
        else:
            candidates = [target_col]

        matched = fuzzy_column_match(df.columns, candidates)
        for candidate in candidates:
            source_col = matched.get(str(candidate))
            if source_col is not None:
                rename_map[source_col] = target_col
                break

    normalized = df.rename(columns=rename_map).copy()
    if normalized.columns.duplicated().any():
        normalized = normalized.T.groupby(level=0).first().T
    selected_cols = [column for column in column_map.keys() if column in normalized.columns]
    normalized = normalized.loc[:, selected_cols]

    for column in selected_cols:
        if _is_date_target(column):
            normalized[column] = _coerce_date(normalized[column])
        elif _is_numeric_target(column):
            normalized[column] = _coerce_numeric(normalized[column])
        else:
            normalized[column] = _strip_strings(normalized[column])

    if selected_cols:
        normalized = normalized.dropna(how="all", subset=selected_cols)

    return normalized.reset_index(drop=True)


def paginate_df(df: pd.DataFrame, page: int = 1, page_size: int = 500) -> dict[str, Any]:
    total = len(df)
    safe_page = max(page, 1)
    safe_page_size = max(page_size, 1)
    start = (safe_page - 1) * safe_page_size
    end = start + safe_page_size

    return {
        "data": df.iloc[start:end].to_dict(orient="records"),
        "total": total,
        "page": safe_page,
        "page_size": safe_page_size,
        "pages": (total + safe_page_size - 1) // safe_page_size,
    }
