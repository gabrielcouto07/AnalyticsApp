from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from .normalizer import normalize_df


TEXT_DATE_MARKERS = {"PAGO", "A PAGAR", "PENDENTE", "ABERTO", "VENCIDO"}


@dataclass
class DataQualityReport:
    total_rows: int
    valid_rows: int
    issues: list[dict[str, Any]] = field(default_factory=list)
    completeness_pct: float = 0.0
    warnings: list[str] = field(default_factory=list)


def _append_issue(issues: list[dict[str, Any]], row: int, column: str, issue_type: str, value: Any) -> None:
    issues.append(
        {
            "row": int(row),
            "column": column,
            "issue_type": issue_type,
            "value": None if pd.isna(value) else str(value),
        }
    )


def validate_df(df: pd.DataFrame, schema: dict[str, list[str]]) -> DataQualityReport:
    required = schema.get("required", [])
    numeric_cols = schema.get("numeric", [])
    date_cols = schema.get("date", [])
    non_empty_cols = schema.get("non_empty", [])

    report = DataQualityReport(total_rows=int(len(df)), valid_rows=int(len(df)))
    if df.empty:
        return report

    missing_required = [column for column in required if column not in df.columns]
    if missing_required:
        report.warnings.append(f"Colunas obrigatorias ausentes: {', '.join(missing_required)}")

    issues: list[dict[str, Any]] = []
    issue_rows: set[int] = set()

    for column in non_empty_cols:
        if column not in df.columns:
            continue
        for index, value in df[column].items():
            if pd.isna(value) or str(value).strip() == "":
                _append_issue(issues, index, column, "null_non_empty", value)
                issue_rows.add(int(index))

    for column in numeric_cols:
        if column not in df.columns:
            continue
        numeric_series = normalize_df(df[[column]], {column: None})[column] if column in df.columns else pd.Series(dtype=float)
        for index, value in df[column].items():
            numeric_value = numeric_series.iloc[index] if index < len(numeric_series) else pd.NA
            if pd.notna(value) and pd.isna(numeric_value):
                _append_issue(issues, index, column, "non_numeric", value)
                issue_rows.add(int(index))
            if pd.notna(numeric_value) and float(numeric_value) < 0 and column in {"valor", "quantidade", "qtd"}:
                _append_issue(issues, index, column, "negative_value", numeric_value)
                issue_rows.add(int(index))
            if pd.notna(numeric_value) and float(numeric_value) == 0 and column in {"valor", "quantidade", "qtd"}:
                _append_issue(issues, index, column, "zero_value", numeric_value)
                issue_rows.add(int(index))

    for column in date_cols:
        if column not in df.columns:
            continue
        parsed_dates = pd.to_datetime(df[column], errors="coerce", dayfirst=True)
        for index, value in df[column].items():
            text_value = str(value).strip().upper() if pd.notna(value) else ""
            if text_value in TEXT_DATE_MARKERS:
                _append_issue(issues, index, column, "text_in_date_field", value)
                issue_rows.add(int(index))
            elif pd.notna(value) and pd.isna(parsed_dates.iloc[index]):
                _append_issue(issues, index, column, "non_date", value)
                issue_rows.add(int(index))

    if {"fornecedor", "nf"}.issubset(df.columns):
        duplicate_mask = df.duplicated(subset=["fornecedor", "nf"], keep=False)
        duplicates = df[duplicate_mask]
        if not duplicates.empty:
            report.warnings.append(f"{len(duplicates)} linhas com par fornecedor+nf duplicado.")
            for index, row in duplicates.iterrows():
                _append_issue(issues, index, "fornecedor,nf", "duplicate_pair", f"{row['fornecedor']}|{row['nf']}")
                issue_rows.add(int(index))

    filled_cells = 0
    tracked_columns = [column for column in dict.fromkeys(required + non_empty_cols + numeric_cols + date_cols) if column in df.columns]
    total_cells = max(len(tracked_columns) * len(df), 1)
    for column in tracked_columns:
        filled_cells += int(df[column].notna().sum())

    report.issues = issues
    report.valid_rows = max(int(len(df) - len(issue_rows)), 0)
    report.completeness_pct = round((filled_cells / total_cells) * 100, 2)
    return report
