"""
Efetivo parser with dynamic day-header detection and long-format output.
"""

from __future__ import annotations

import calendar
import re
import sys
from dataclasses import asdict
from io import BytesIO
from typing import Any

import openpyxl
import pandas as pd

from .core.validator import DataQualityReport
from .core.normalizer import strip_accents


MONTH_MAP = {
    "JANEIRO": 1,
    "FEVEREIRO": 2,
    "MARCO": 3,
    "MARÇO": 3,
    "ABRIL": 4,
    "MAIO": 5,
    "JUNHO": 6,
    "JULHO": 7,
    "AGOSTO": 8,
    "SETEMBRO": 9,
    "OUTUBRO": 10,
    "NOVEMBRO": 11,
    "DEZEMBRO": 12,
}

SKIP_SHEETS = {"CONSULTA (ATIV - SERV)", "CONSULTA"}


def _normalize_text(value: Any) -> str:
    return " ".join(strip_accents(str(value or "")).upper().strip().split())


def extract_year_from_filename(filename: str) -> int:
    match = re.search(r"(20\d{2})", filename)
    return int(match.group(1)) if match else pd.Timestamp.today().year


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"none", "nan"}:
        return ""
    return text


def _parse_numeric(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = _safe_str(value)
    if not text or text in {"-", "NA"}:
        return 0.0
    cleaned = (
        text.replace("\xa0", " ")
        .replace("R$", "")
        .replace(".", "")
        .replace(",", ".")
        .strip()
    )
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _find_month_number(sheet_name: str, worksheet: openpyxl.worksheet.worksheet.Worksheet) -> int:
    candidates = [sheet_name]
    for row in range(1, min(5, worksheet.max_row) + 1):
        for col in range(1, min(40, worksheet.max_column) + 1):
            value = _safe_str(worksheet.cell(row=row, column=col).value)
            if value:
                candidates.append(value)

    for candidate in candidates:
        normalized = _normalize_text(candidate)
        for token, month in MONTH_MAP.items():
            if token in normalized:
                return month
    return 0


def _find_obra_name(worksheet: openpyxl.worksheet.worksheet.Worksheet) -> str:
    for row in range(1, min(4, worksheet.max_row) + 1):
        for col in range(1, min(6, worksheet.max_column) + 1):
            value = _safe_str(worksheet.cell(row=row, column=col).value)
            if value and "CONTROLE DE EFETIVO" not in _normalize_text(value):
                return value
    return ""


def _find_header_info(worksheet: openpyxl.worksheet.worksheet.Worksheet) -> tuple[int, dict[int, int]]:
    best_row = 0
    best_days: dict[int, int] = {}
    for row in range(1, min(20, worksheet.max_row) + 1):
        day_columns: dict[int, int] = {}
        for col in range(1, min(40, worksheet.max_column) + 1):
            value = worksheet.cell(row=row, column=col).value
            parsed = None
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                parsed = int(value)
            else:
                text = _safe_str(value)
                if text.isdigit():
                    parsed = int(text)
            if parsed is not None and 1 <= parsed <= 31:
                day_columns[col] = parsed
        if len(day_columns) > len(best_days):
            best_row = row
            best_days = day_columns
    if len(best_days) < 5:
        raise ValueError(f"Nao foi possivel localizar as colunas de dias na planilha {worksheet.title}.")
    return best_row, dict(sorted(best_days.items(), key=lambda item: item[1]))


def _build_cargo_lookup(workbook: openpyxl.Workbook) -> dict[str, str]:
    lookup: dict[str, str] = {}
    consulta_sheet = next((name for name in workbook.sheetnames if _normalize_text(name) in SKIP_SHEETS), None)
    if not consulta_sheet:
        return lookup

    worksheet = workbook[consulta_sheet]
    for row in worksheet.iter_rows(values_only=True):
        values = [_safe_str(value) for value in row if _safe_str(value)]
        if len(values) < 2:
            continue
        canonical = values[0]
        for value in values:
            lookup[_normalize_text(value)] = canonical
    return lookup


def _month_days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _build_quality_report(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return asdict(DataQualityReport(total_rows=0, valid_rows=0))

    issues: list[dict[str, Any]] = []
    warnings: list[str] = []
    issue_rows: set[int] = set()

    for index, row in df.iterrows():
        if not _safe_str(row.get("Fornecedor")) and not _safe_str(row.get("Funcao")):
            issues.append(
                {
                    "row": int(index),
                    "column": "Fornecedor/Funcao",
                    "issue_type": "missing_both",
                    "value": "",
                }
            )
            issue_rows.add(int(index))

    duplicate_mask = df.duplicated(subset=["Obra", "Mes", "Data", "Fornecedor", "Funcao"], keep=False)
    duplicates = df[duplicate_mask]
    if not duplicates.empty:
        warnings.append(f"{len(duplicates)} linhas duplicadas exatas foram deduplicadas no parser.")

    near_duplicates = (
        df.groupby(["Obra", "Mes", "normalized_cargo"], dropna=False)["Fornecedor"]
        .nunique()
        .reset_index(name="fornecedores_distintos")
    )
    flagged = near_duplicates[near_duplicates["fornecedores_distintos"] > 1]
    if not flagged.empty:
        warnings.append(
            f"{len(flagged)} combinacoes obra+mes+cargo com fornecedores distintos foram encontradas."
        )

    completeness = round(
        (
            (
                df["Fornecedor"].astype("string").str.strip().fillna("").ne("").sum()
                + df["Funcao"].astype("string").str.strip().fillna("").ne("").sum()
                + df["Data"].notna().sum()
            )
            / max(len(df) * 3, 1)
        )
        * 100,
        2,
    )
    return asdict(
        DataQualityReport(
            total_rows=int(len(df)),
            valid_rows=max(int(len(df) - len(issue_rows)), 0),
            issues=issues,
            completeness_pct=completeness,
            warnings=warnings,
        )
    )


def merge_efetivo_frames(frames: list[pd.DataFrame]) -> pd.DataFrame:
    valid_frames = [frame.copy() for frame in frames if isinstance(frame, pd.DataFrame) and not frame.empty]
    if not valid_frames:
        return pd.DataFrame()
    merged = pd.concat(valid_frames, ignore_index=True)
    merged = merged.drop_duplicates(
        subset=["Obra", "Mes", "Data", "Fornecedor", "Funcao", "Quantidade", "source_sheet"],
        keep="first",
    ).reset_index(drop=True)
    merged.attrs["quality_report"] = _build_quality_report(merged)
    return merged


def _parse_month_sheet(
    worksheet: openpyxl.worksheet.worksheet.Worksheet,
    year: int,
    cargo_lookup: dict[str, str],
) -> pd.DataFrame:
    month_num = _find_month_number(worksheet.title, worksheet)
    if month_num == 0:
        return pd.DataFrame()

    header_row, day_columns = _find_header_info(worksheet)
    leading_columns = [column for column in range(1, min(day_columns.keys()))]
    valid_days = {column: day for column, day in day_columns.items() if day <= _month_days(year, month_num)}

    # Drop day columns that are entirely empty or zero.
    active_days: dict[int, int] = {}
    for column, day in valid_days.items():
        has_activity = False
        for row in range(header_row + 1, worksheet.max_row + 1):
            if _parse_numeric(worksheet.cell(row=row, column=column).value) != 0:
                has_activity = True
                break
        if has_activity:
            active_days[column] = day

    if not active_days:
        active_days = valid_days

    obra = _find_obra_name(worksheet)
    current_fornecedor = ""
    records: list[dict[str, Any]] = []

    for row in range(header_row + 1, worksheet.max_row + 1):
        leading_values = [_safe_str(worksheet.cell(row=row, column=column).value) for column in leading_columns]
        non_empty_leading = [value for value in leading_values if value]
        day_values = {day: _parse_numeric(worksheet.cell(row=row, column=column).value) for column, day in active_days.items()}
        has_any_day_value = any(value != 0 for value in day_values.values())

        if not non_empty_leading and not has_any_day_value:
            continue

        if len(non_empty_leading) == 1 and not has_any_day_value:
            current_fornecedor = non_empty_leading[0]
            continue

        fornecedor = ""
        cargo = ""
        if len(non_empty_leading) >= 2:
            fornecedor, cargo = non_empty_leading[0], non_empty_leading[1]
            current_fornecedor = fornecedor or current_fornecedor
        elif len(non_empty_leading) == 1 and current_fornecedor:
            fornecedor, cargo = current_fornecedor, non_empty_leading[0]
        elif len(non_empty_leading) == 1:
            fornecedor, cargo = non_empty_leading[0], ""
            current_fornecedor = fornecedor

        if not fornecedor and not cargo:
            continue

        normalized_cargo = cargo_lookup.get(_normalize_text(cargo), cargo or "")
        computed_diarias_total = sum(day_values.values())
        sheet_diarias_total = _parse_numeric(worksheet.cell(row=row, column=35).value)
        if abs(sheet_diarias_total - computed_diarias_total) > 0.5:
            print(
                (
                    "WARN: DiariasTotal mismatch for "
                    f"{fornecedor}|{cargo}|{worksheet.title}: "
                    f"sheet={sheet_diarias_total} computed={computed_diarias_total}"
                ),
                file=sys.stderr,
            )
        diarias_total = sheet_diarias_total if sheet_diarias_total else computed_diarias_total
        for day, quantidade in day_values.items():
            try:
                data = pd.Timestamp(year=year, month=month_num, day=day)
            except ValueError:
                continue
            records.append(
                {
                    "Obra": obra,
                    "Ano": year,
                    "Mes": month_num,
                    "MesNome": worksheet.title,
                    "Fornecedor": fornecedor,
                    "Funcao": cargo,
                    "Quantidade": quantidade,
                    "DiariasTotal": diarias_total,
                    "Dia": day,
                    "Data": data,
                    "source_sheet": worksheet.title,
                    "normalized_cargo": normalized_cargo,
                }
            )

    if not records:
        return pd.DataFrame()

    dataframe = pd.DataFrame(records)
    dataframe = dataframe[
        ~(
            dataframe["Fornecedor"].astype("string").str.strip().fillna("").eq("")
            & dataframe["Funcao"].astype("string").str.strip().fillna("").eq("")
        )
    ].reset_index(drop=True)
    dataframe["DiaSemana"] = dataframe["Data"].dt.day_name()
    dataframe["Periodo"] = dataframe["Ano"].astype(str) + "-" + dataframe["Mes"].astype(str).str.zfill(2)
    dataframe["FornecedorFuncao"] = dataframe["Fornecedor"].fillna("") + " | " + dataframe["Funcao"].fillna("")
    dataframe["Trabalhou"] = (pd.to_numeric(dataframe["Quantidade"], errors="coerce").fillna(0) > 0).astype(int)
    return dataframe


def parse_efetivo_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    year = extract_year_from_filename(filename)
    workbook = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    cargo_lookup = _build_cargo_lookup(workbook)
    frames: list[pd.DataFrame] = []

    for sheet_name in workbook.sheetnames:
        if _normalize_text(sheet_name) in {_normalize_text(name) for name in SKIP_SHEETS}:
            continue
        frame = _parse_month_sheet(workbook[sheet_name], year, cargo_lookup)
        if not frame.empty:
            frames.append(frame)

    merged = merge_efetivo_frames(frames)
    if merged.empty:
        return merged

    merged.attrs["quality_report"] = _build_quality_report(merged)
    return merged


def get_efetivo_summary(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {}

    df_work = df[pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0) > 0]
    unique_position_cols = [
        column for column in ["Obra", "Fornecedor", "Funcao", "Periodo"] if column in df_work.columns
    ]
    total_funcionarios = (
        int(df_work.drop_duplicates(subset=unique_position_cols).shape[0])
        if len(unique_position_cols) == 4
        else 0
    )
    return {
        "total_diarias": round(float(df_work["Quantidade"].sum()), 1),
        "total_funcionarios": total_funcionarios,
        "total_fornecedores": int(df_work["Fornecedor"].nunique()),
        "total_funcoes": int(df["Funcao"].nunique()),
        "meses_cobertos": int(df["Mes"].nunique()),
        "obra": df["Obra"].iloc[0] if len(df) > 0 else "",
        "ano": int(df["Ano"].iloc[0]) if len(df) > 0 else 0,
        "periodo_inicio": str(df["Data"].min().date()) if df["Data"].notna().any() else "",
        "periodo_fim": str(df["Data"].max().date()) if df["Data"].notna().any() else "",
        "fornecedores": sorted(df["Fornecedor"].dropna().unique().tolist()),
        "funcoes": sorted(df["Funcao"].dropna().unique().tolist()),
        "meses": sorted(df["MesNome"].dropna().unique().tolist()),
    }


def get_fornecedor_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    working = df[pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0) > 0]
    return (
        working.groupby("Fornecedor")
        .agg(TotalDiarias=("Quantidade", "sum"), Funcoes=("Funcao", "nunique"), DiasAtivos=("Data", "nunique"))
        .reset_index()
        .sort_values("TotalDiarias", ascending=False)
    )


def get_funcao_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    working = df[pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0) > 0]
    return (
        working.groupby("Funcao")
        .agg(
            TotalDiarias=("Quantidade", "sum"),
            Fornecedores=("Fornecedor", "nunique"),
            DiasAtivos=("Data", "nunique"),
        )
        .reset_index()
        .sort_values("TotalDiarias", ascending=False)
    )


def get_monthly_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    working = df[pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0) > 0]
    return (
        working.groupby(["Mes", "MesNome"])
        .agg(TotalDiarias=("Quantidade", "sum"), Fornecedores=("Fornecedor", "nunique"), Funcoes=("Funcao", "nunique"))
        .reset_index()
        .sort_values("Mes")
    )


def get_daily_timeline(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    working = df[pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0) > 0]
    return working.groupby("Data").agg(TotalTrabalhadores=("Quantidade", "sum")).reset_index().sort_values("Data")
