from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass, field
from typing import Any

import pandas as pd


@dataclass
class DataQualityReport:
    total_cells: int = 0
    empty_cells: int = 0
    zero_cells: int = 0
    dash_cells: int = 0
    na_cells: int = 0
    error_cells: int = 0
    formula_cells: int = 0
    fractional_values: int = 0
    inconsistent_types: list[str] = field(default_factory=list)
    cell_errors_detail: list[dict[str, Any]] = field(default_factory=list)
    schema_warnings: list[str] = field(default_factory=list)
    normalization_notes: list[str] = field(default_factory=list)
    format_confidence: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


ERROR_PREFIX = "#"
DASH_MARKERS = {"-", "–", "—", "â€“", "â€”"}
NA_MARKERS = {"NA", "N/A"}


def _is_missing_scalar(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float):
        return math.isnan(value)
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _is_numeric_string(text: str) -> bool:
    cleaned = (
        text.replace("R$", "")
        .replace("\xa0", " ")
        .replace(".", "")
        .replace(",", ".")
        .strip()
    )
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if not cleaned or cleaned in {"-", ".", "-."}:
        return False
    try:
        float(cleaned)
    except ValueError:
        return False
    return True


def _coerce_float(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str) and _is_numeric_string(value):
        cleaned = (
            value.replace("R$", "")
            .replace("\xa0", " ")
            .replace(".", "")
            .replace(",", ".")
            .strip()
        )
        cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _collect_inconsistent_types(sheet_name: str, dataframe: pd.DataFrame) -> list[str]:
    inconsistencies: list[str] = []
    for column in dataframe.columns:
        column_data = dataframe[column]
        if isinstance(column_data, pd.DataFrame):
            flat_values = column_data.to_numpy().flatten().tolist()
        else:
            flat_values = column_data.tolist()
        values = [value for value in flat_values if not _is_missing_scalar(value)]
        if not values:
            continue
        has_text = False
        has_number = False
        for value in values[:250]:
            numeric_value = _coerce_float(value)
            if numeric_value is not None:
                has_number = True
            else:
                has_text = True
            if has_text and has_number:
                inconsistencies.append(f"{sheet_name}:{column}")
                break
    return inconsistencies


def build_quality_report(
    sheets: dict[str, pd.DataFrame],
    schema_warnings: list[str] | None = None,
    normalization_notes: list[str] | None = None,
    format_confidence: float = 1.0,
) -> DataQualityReport:
    report = DataQualityReport(
        schema_warnings=list(schema_warnings or []),
        normalization_notes=list(normalization_notes or []),
        format_confidence=float(format_confidence),
    )

    for sheet_name, dataframe in sheets.items():
        if not isinstance(dataframe, pd.DataFrame) or dataframe.empty:
            continue

        report.total_cells += int(dataframe.shape[0] * dataframe.shape[1])
        report.inconsistent_types.extend(_collect_inconsistent_types(sheet_name, dataframe))

        for row_idx, row in enumerate(dataframe.itertuples(index=False), start=1):
            for col_idx, value in enumerate(row, start=1):
                if _is_missing_scalar(value):
                    report.empty_cells += 1
                    continue

                if isinstance(value, str):
                    text = _normalize_text(value)
                    upper = text.upper()
                    if text.startswith(ERROR_PREFIX):
                        report.error_cells += 1
                        report.cell_errors_detail.append(
                            {
                                "sheet": sheet_name,
                                "row": row_idx,
                                "col": col_idx,
                                "raw_value": text,
                            }
                        )
                        continue
                    if upper in DASH_MARKERS:
                        report.dash_cells += 1
                        continue
                    if upper in NA_MARKERS:
                        report.na_cells += 1
                        continue
                    if text.startswith("="):
                        report.formula_cells += 1

                numeric_value = _coerce_float(value)
                if numeric_value is None:
                    continue

                if numeric_value == 0:
                    report.zero_cells += 1
                if not float(numeric_value).is_integer():
                    report.fractional_values += 1

    report.inconsistent_types = sorted(set(report.inconsistent_types))
    return report


def merge_quality_reports(reports: list[dict[str, Any] | DataQualityReport]) -> dict[str, Any]:
    merged = DataQualityReport()
    for item in reports:
        if isinstance(item, DataQualityReport):
            current = item
        else:
            allowed_keys = set(DataQualityReport.__dataclass_fields__.keys())
            filtered = {key: value for key, value in item.items() if key in allowed_keys}
            current = DataQualityReport(**filtered)
        merged.total_cells += current.total_cells
        merged.empty_cells += current.empty_cells
        merged.zero_cells += current.zero_cells
        merged.dash_cells += current.dash_cells
        merged.na_cells += current.na_cells
        merged.error_cells += current.error_cells
        merged.formula_cells += current.formula_cells
        merged.fractional_values += current.fractional_values
        merged.inconsistent_types.extend(current.inconsistent_types)
        merged.cell_errors_detail.extend(current.cell_errors_detail)
        merged.schema_warnings.extend(current.schema_warnings)
        merged.normalization_notes.extend(current.normalization_notes)
        merged.format_confidence = min(merged.format_confidence, current.format_confidence)

    merged.inconsistent_types = sorted(set(merged.inconsistent_types))
    merged.schema_warnings = list(dict.fromkeys(merged.schema_warnings))
    merged.normalization_notes = list(dict.fromkeys(merged.normalization_notes))
    return merged.to_dict()
