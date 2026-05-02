from __future__ import annotations

import unicodedata
from typing import Iterable

import pandas as pd


def _normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip())
    return text.encode("ascii", "ignore").decode("ascii").upper()


def _normalize_columns(columns: Iterable[object]) -> set[str]:
    normalized: set[str] = set()
    for column in columns:
        text = _normalize_text(column)
        if text:
            normalized.add(text)
    return normalized


def _count_day_columns(dataframe: pd.DataFrame) -> int:
    return sum(
        1
        for column in dataframe.columns
        if _normalize_text(column).isdigit() and 1 <= int(_normalize_text(column)) <= 31
    )


def _looks_like_efetivo_structure(sheet_name: str, dataframe: pd.DataFrame) -> bool:
    normalized_sheet = _normalize_text(sheet_name)
    month_names = {
        "JANEIRO",
        "FEVEREIRO",
        "MARCO",
        "ABRIL",
        "MAIO",
        "JUNHO",
        "JULHO",
        "AGOSTO",
        "SETEMBRO",
        "OUTUBRO",
        "NOVEMBRO",
        "DEZEMBRO",
    }
    if normalized_sheet not in month_names:
        return False
    if dataframe.shape[1] < 20:
        return False
    first_column = dataframe.iloc[:, 0].dropna().astype(str).str.strip()
    if first_column.empty:
        return False
    non_empty_labels = first_column[first_column != ""]
    if len(non_empty_labels) < 5:
        return False
    sample = dataframe.iloc[: min(len(dataframe), 12), 1: min(dataframe.shape[1], 10)]
    flattened = [str(value).strip() for value in sample.to_numpy().flatten() if str(value).strip()]
    dash_like = sum(1 for value in flattened if value in {"-", "–", "—"})
    numeric_like = sum(1 for value in flattened if value.isdigit())
    return dash_like + numeric_like >= 5


def _has_medicao_sheet_name(sheet_names: Iterable[str], filename: str) -> bool:
    candidates = [_normalize_text(name) for name in sheet_names]
    candidates.append(_normalize_text(filename))
    return any(
        value in {"MP", "MEDICAO", "MEDICAO 01", "PROPOSTA"}
        or value.startswith("MED ")
        or "BOLETIM MEDICAO" in value
        or "MP-" in value
        for value in candidates
    )


def _has_custos_sheet_hint(sheet_names: Iterable[str], filename: str) -> bool:
    candidates = [_normalize_text(name) for name in sheet_names]
    candidates.append(_normalize_text(filename))
    return any(
        any(token in value for token in ("NFS", "CONSOLIDADO", "RESUMO CONSOLIDADOS", "CONTROLE CUSTOS"))
        for value in candidates
    )


def _has_orcamento_sheet_hint(sheet_names: Iterable[str], filename: str) -> bool:
    candidates = [_normalize_text(name) for name in sheet_names]
    candidates.append(_normalize_text(filename))
    return any(
        any(token in value for token in ("ORCAMENTO", "ORCADO X REALIZADO", "ORCADOXREALIZADO", "MAPA"))
        for value in candidates
    )


def detect_schema(sheets: dict[str, pd.DataFrame], filename: str = "") -> list[str]:
    """
    Detect dataset schema types from worksheet columns and structural hints.
    """
    detected: list[str] = []
    all_cols: set[str] = set()
    sampled_values: set[str] = set()
    sheet_names_upper = [_normalize_text(sheet_name) for sheet_name in sheets.keys()]
    filename_upper = _normalize_text(filename)

    for dataframe in sheets.values():
        if isinstance(dataframe, pd.DataFrame):
            all_cols.update(_normalize_columns(dataframe.columns))
            sample = dataframe.head(40).iloc[:, : min(dataframe.shape[1], 12)] if not dataframe.empty else dataframe
            for value in sample.to_numpy().flatten():
                text = _normalize_text(value)
                if text:
                    sampled_values.add(text)

    efetivo_signals = {"CARGO/FUNCAO", "FORNECEDOR", "FILIAL/OBRA", "PERIODO"}
    has_day_cols = any(_count_day_columns(dataframe) >= 20 for dataframe in sheets.values())
    has_efetivo_structure = any(
        _looks_like_efetivo_structure(sheet_name, dataframe)
        for sheet_name, dataframe in sheets.items()
        if isinstance(dataframe, pd.DataFrame)
    )
    if len(efetivo_signals & all_cols) >= 2 or has_day_cols or has_efetivo_structure:
        detected.append("efetivo")

    medicao_signals = {"ITEM", "DESCRICAO", "QUANTIDADE", "UNIDADE", "VALOR", "VALOR INICIAL", "VALOR NEGOCIADO"}
    medicao_sheet_hint = _has_medicao_sheet_name(sheet_names_upper, filename)
    medicao_headers = any(
        {"ITEM", "DESCRICAO"} <= _normalize_columns(dataframe.columns)
        or len(medicao_signals & _normalize_columns(dataframe.columns)) >= 3
        for dataframe in sheets.values()
        if isinstance(dataframe, pd.DataFrame)
    )
    medicao_marker_columns = {
        "VALOR UNITARIO",
        "VALOR_UNITARIO",
        "VALOR NEGOCIADO",
        "VALOR_NEGOCIADO",
        "TOTAL DESTA MEDICAO",
        "PERIODO MEDICAO",
        "BM",
        "BOLETIM",
        "MEDICAO",
    }
    medicao_structure = medicao_sheet_hint and (
        {"OBRA", "ITEM"} <= {value.split(":", 1)[0] for value in sampled_values}
        or (
            "ITEM" in sampled_values
            and any("VALOR INICIAL" in value or "VALOR NEGOCIADO" in value or "TOTAL DESTA MEDICAO" in value for value in sampled_values)
        )
        or bool(medicao_marker_columns & all_cols)
        or any(any(marker in value for marker in medicao_marker_columns) for value in sampled_values)
    )
    if medicao_sheet_hint and (medicao_headers or medicao_structure):
        detected.append("medicao")

    custos_signals = {"NATUREZA", "FORNECEDOR", "NF", "DATA VENCTO", "VALOR"}
    filename_has_custos_hint = any(token in filename_upper for token in ("CUSTO", "CONSOLIDADO", "CONSOLIDADOS", "BD PLANILHA"))
    custos_sheet_hint = _has_custos_sheet_hint(sheet_names_upper, filename)
    if (
        len(custos_signals & all_cols) >= 3
        or (filename_has_custos_hint and len(all_cols & {"FORNECEDOR", "NF", "VALOR"}) >= 2)
        or (custos_sheet_hint and len(all_cols & {"FORNECEDOR", "VALOR"}) >= 1)
    ):
        detected.append("custos")

    orcamento_signals = {"CUSTO TOTAL", "CUSTO UNITARIO", "QTD", "DESCRICAO", "UNID"}
    filename_has_orcamento_hint = any(token in filename_upper for token in ("ORCAMENTO", "MAPA", "CONCORR"))
    orcamento_sheet_hint = _has_orcamento_sheet_hint(sheet_names_upper, filename)
    if (
        len(orcamento_signals & all_cols) >= 3
        or (filename_has_orcamento_hint and len(all_cols & {"ITEM", "DESCRICAO", "QTD"}) >= 2)
        or (orcamento_sheet_hint and len(all_cols & {"ITEM", "DESCRICAO"}) >= 1)
    ):
        detected.append("orcamento")

    if not detected:
        detected.append("generic")

    return detected
