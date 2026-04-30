"""
Orcamento parser with dynamic header detection and mapa extraction.
"""

from __future__ import annotations

from io import BytesIO

import pandas as pd

from .core.header_detector import find_header_row
from .core.normalizer import normalize_df, strip_accents


ORCAMENTO_COLUMN_MAP: dict[str, list[str]] = {
    "item": ["ITEM"],
    "subitem": ["SUBITEM"],
    "descricao": ["DESCRIÇÃO", "DESCRICAO"],
    "unid": ["UNID"],
    "qtd": ["QTD", "QUANTIDADE"],
    "custo_unitario": ["CUSTO UNITÁRIO", "CUSTO UNITARIO"],
    "custo_total": ["CUSTO TOTAL"],
}


def _normalize_text(value: object) -> str:
    return " ".join(
        strip_accents(str(value or "")).upper().strip().replace("_", " ").split()
    )


def _match_orcamento_sheet(sheet_names: list[str]) -> str | None:
    for sheet_name in sheet_names:
        normalized = _normalize_text(sheet_name)
        if "ORCAMENTO" in normalized:
            return sheet_name
    return sheet_names[0] if sheet_names else None


def _promote_header(df_raw: pd.DataFrame) -> pd.DataFrame:
    df_raw.attrs["source_name"] = df_raw.attrs.get("source_name", "orcamento")
    header_row = find_header_row(df_raw, ["ITEM", "DESCRIÇÃO", "CUSTO TOTAL", "CUSTO UNITÁRIO", "QTD"])
    dataframe = df_raw.iloc[header_row + 1 :].copy().reset_index(drop=True)
    dataframe.columns = [
        str(value).strip() if pd.notna(value) and str(value).strip() else f"COL_{index + 1}"
        for index, value in enumerate(df_raw.iloc[header_row].tolist())
    ]
    return dataframe.dropna(axis=0, how="all").dropna(axis=1, how="all").reset_index(drop=True)


def _build_mapas(table: pd.DataFrame) -> pd.DataFrame:
    if table.empty or len(table.columns) <= 9:
        return pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"])

    working = table.copy()
    rename_map: dict[str, str] = {}
    for column in working.columns:
        normalized = _normalize_text(column)
        if normalized == "ITEM":
            rename_map[column] = "item"
        elif normalized == "SUBITEM":
            rename_map[column] = "subitem"
        elif normalized == "DESCRICAO":
            rename_map[column] = "descricao"
    working = working.rename(columns=rename_map)

    mapa_columns = list(table.columns[9:])
    id_columns = [column for column in ["item", "subitem", "descricao"] if column in working.columns]
    if "item" not in id_columns or "descricao" not in id_columns:
        return pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"])

    mapas = (
        working[id_columns + mapa_columns]
        .melt(id_vars=id_columns, value_vars=mapa_columns, var_name="mapa_num", value_name="valor_alocado")
        .assign(valor_alocado=lambda frame: pd.to_numeric(frame["valor_alocado"], errors="coerce"))
        .dropna(subset=["valor_alocado"])
    )
    mapas = mapas[mapas["valor_alocado"] != 0].reset_index(drop=True)
    if "subitem" not in mapas.columns:
        mapas["subitem"] = pd.NA
    return mapas.loc[:, ["item", "subitem", "descricao", "mapa_num", "valor_alocado"]]


def parse_orcamento_file(file_bytes: bytes, filename: str) -> dict[str, pd.DataFrame]:
    workbook = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
    if not workbook:
        return {"flat": pd.DataFrame(), "mapas": pd.DataFrame()}

    sheet_name = _match_orcamento_sheet(list(workbook.keys()))
    if sheet_name is None:
        return {"flat": pd.DataFrame(), "mapas": pd.DataFrame()}

    raw = workbook[sheet_name]
    raw.attrs["source_name"] = sheet_name
    table = _promote_header(raw)
    budget_source = table.iloc[:, : min(9, len(table.columns))].copy()
    flat = normalize_df(budget_source, ORCAMENTO_COLUMN_MAP)
    if {"item", "custo_total"}.issubset(flat.columns):
        flat = flat[
            ~(
                flat["item"].astype("string").str.strip().fillna("").eq("")
                & flat["custo_total"].fillna(0).eq(0)
            )
        ].reset_index(drop=True)
    mapas = _build_mapas(table)
    return {"flat": flat, "mapas": mapas}


def detect_orcamento_file(file_bytes: bytes, filename: str) -> bool:
    try:
        parsed = parse_orcamento_file(file_bytes, filename)
    except Exception:
        return False
    return not parsed["flat"].empty
