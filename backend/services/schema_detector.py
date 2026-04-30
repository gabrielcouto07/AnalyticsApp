from __future__ import annotations

import unicodedata
from typing import Iterable

import pandas as pd


def _normalize_columns(columns: Iterable[object]) -> set[str]:
    normalized: set[str] = set()
    for column in columns:
        if not isinstance(column, str):
            continue
        text = unicodedata.normalize("NFKD", column.strip())
        text = text.encode("ascii", "ignore").decode("ascii").upper()
        if text:
            normalized.add(text)
    return normalized


def detect_schema(sheets: dict[str, pd.DataFrame]) -> list[str]:
    """
    Detect dataset schema types from the union of all worksheet columns.

    For single-sheet files, ``sheets`` should contain a single entry whose key is
    the filename stem.
    """
    detected: list[str] = []
    all_cols: set[str] = set()

    for dataframe in sheets.values():
        if isinstance(dataframe, pd.DataFrame):
            all_cols.update(_normalize_columns(dataframe.columns))

    efetivo_signals = {"CARGO/FUNCAO", "FORNECEDOR", "FILIAL/OBRA", "PERIODO"}
    if len(efetivo_signals & all_cols) >= 2:
        detected.append("efetivo")

    custos_signals = {"NATUREZA", "FORNECEDOR", "NF", "DATA VENCTO", "VALOR"}
    if len(custos_signals & all_cols) >= 3:
        detected.append("custos")

    orcamento_signals = {"CUSTO TOTAL", "CUSTO UNITARIO", "QTD", "DESCRICAO", "UNID"}
    if len(orcamento_signals & all_cols) >= 3:
        detected.append("orcamento")

    if not detected:
        detected.append("generic")

    return detected
