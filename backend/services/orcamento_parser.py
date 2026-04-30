"""
OrcamentoParser - extracts flat budget lines and purchase-map allocations from workbook uploads.
Called by: backend.routers.upload.
"""

from __future__ import annotations

import re
import unicodedata
from io import BytesIO
from typing import Any

import pandas as pd


def _normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()


def _clean_sheet_frame(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    working = working.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if working.empty:
        return working

    columns: list[str] = []
    for index, column in enumerate(working.columns):
        text = str(column).strip() if pd.notna(column) else ""
        columns.append(text or f"COL_{index + 1}")
    working.columns = columns
    return working.reset_index(drop=True)


def _detect_header_row(df_raw: pd.DataFrame) -> int:
    for row_index in range(min(len(df_raw), 20)):
        row_values = [str(value).strip() for value in df_raw.iloc[row_index].tolist() if pd.notna(value) and str(value).strip()]
        normalized = [_normalize_text(value) for value in row_values]
        if "item" in normalized and any(value.startswith("descricao") for value in normalized):
            return row_index
    return 0


def _find_column(df: pd.DataFrame, candidates: list[str], required: bool = False) -> str | None:
    normalized_map = {_normalize_text(column): column for column in df.columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        for normalized_name, original_name in normalized_map.items():
            if normalized_candidate == normalized_name:
                return original_name
    if required:
        raise KeyError(f"Coluna esperada nao encontrada: {', '.join(candidates)}")
    return None


def _extract_budget_sheet(file_bytes: bytes) -> pd.DataFrame:
    workbook = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
    for sheet_name, raw_df in workbook.items():
        if "orc" not in _normalize_text(sheet_name):
            continue
        header_row = _detect_header_row(raw_df)
        parsed = raw_df.iloc[header_row + 1 :].copy().reset_index(drop=True)
        parsed.columns = raw_df.iloc[header_row].tolist()
        cleaned = _clean_sheet_frame(parsed)
        if not cleaned.empty:
            return cleaned

    first_sheet_name = next(iter(workbook.keys()))
    raw_df = workbook[first_sheet_name]
    header_row = _detect_header_row(raw_df)
    parsed = raw_df.iloc[header_row + 1 :].copy().reset_index(drop=True)
    parsed.columns = raw_df.iloc[header_row].tolist()
    return _clean_sheet_frame(parsed)


def parse_orcamento_file(file_bytes: bytes, filename: str) -> dict[str, pd.DataFrame]:
    budget_df = _extract_budget_sheet(file_bytes)
    if budget_df.empty:
        return {"flat": pd.DataFrame(), "mapas": pd.DataFrame()}

    item_col = _find_column(budget_df, ["ITEM"], required=True)
    subitem_col = _find_column(budget_df, ["SUBITEM"], required=False)
    descricao_col = _find_column(budget_df, ["DESCRICAO", "DESCRIÇÃO"], required=True)
    unid_col = _find_column(budget_df, ["UNID"], required=False)
    qtd_col = _find_column(budget_df, ["QTD"], required=False)
    custo_unitario_col = _find_column(budget_df, ["CUSTO UNITARIO", "CUSTO UNITÁRIO"], required=False)
    custo_total_col = _find_column(budget_df, ["CUSTO TOTAL"], required=False)

    flat_source_columns = [
        column
        for column in [item_col, subitem_col, descricao_col, unid_col, qtd_col, custo_unitario_col, custo_total_col]
        if column
    ]
    flat_df = budget_df.loc[:, flat_source_columns].copy()
    flat_df = flat_df.rename(
        columns={
            item_col: "ITEM",
            subitem_col: "SUBITEM",
            descricao_col: "DESCRIÇÃO",
            unid_col: "UNID",
            qtd_col: "QTD",
            custo_unitario_col: "CUSTO UNITÁRIO",
            custo_total_col: "CUSTO TOTAL",
        }
    )

    key_columns = [column for column in ["ITEM", "SUBITEM", "DESCRIÇÃO"] if column in flat_df.columns]
    if key_columns:
        empty_key_mask = flat_df[key_columns].apply(
            lambda column: column.astype(str).str.strip().replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})
        )
        flat_df = flat_df[~empty_key_mask.isna().all(axis=1)]

    budget_fixed_cols = [
        column
        for column in [item_col, subitem_col, descricao_col, unid_col, qtd_col, custo_unitario_col, custo_total_col]
        if column
    ]
    id_cols = [column for column in [item_col, subitem_col, descricao_col] if column]
    value_cols = [column for column in budget_df.columns if column not in id_cols + budget_fixed_cols]

    mapas_df = pd.DataFrame(columns=["ITEM", "SUBITEM", "MAPA", "VALOR_MAPA"])
    if not flat_df.empty and value_cols:
        maps_source = budget_df.loc[:, [column for column in id_cols + value_cols if column in budget_df.columns]].copy()
        maps_source = maps_source.dropna(how="all", subset=id_cols)
        mapas_df = maps_source.melt(id_vars=id_cols, value_vars=value_cols, var_name="MAPA", value_name="VALOR_MAPA")
        mapas_df["VALOR_MAPA"] = pd.to_numeric(mapas_df["VALOR_MAPA"], errors="coerce")
        mapas_df = mapas_df[mapas_df["VALOR_MAPA"].notna() & (mapas_df["VALOR_MAPA"] != 0)].reset_index(drop=True)
        if subitem_col is None:
            mapas_df["SUBITEM"] = None
            subitem_col = "SUBITEM"
        mapas_df = mapas_df.rename(
            columns={
                item_col: "ITEM",
                descricao_col: "DESCRIÇÃO",
                subitem_col: "SUBITEM",
            }
        )
        mapas_df = mapas_df.loc[:, ["ITEM", "SUBITEM", "MAPA", "VALOR_MAPA"]]

    return {
        "flat": flat_df.reset_index(drop=True),
        "mapas": mapas_df.reset_index(drop=True),
    }


def detect_orcamento_file(file_bytes: bytes, filename: str) -> bool:
    try:
        budget_df = _extract_budget_sheet(file_bytes)
        normalized_columns = {_normalize_text(column) for column in budget_df.columns}
        return "item" in normalized_columns and "custo total" in normalized_columns
    except Exception:
        return False
