from __future__ import annotations

import logging
import math
import re
from dataclasses import asdict
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd

from .core.header_detector import HeaderNotFoundError, find_header_row
from .core.normalizer import normalize_df, strip_accents
from .core.validator import DataQualityReport, validate_df


logger = logging.getLogger(__name__)


NFS_COLUMN_MAP: dict[str, list[str]] = {
    "n_consolidado": ["Nº CONSOLIDADO", "N CONSOLIDADO", "NUM CONSOLIDADO"],
    "cod": ["COD"],
    "fornecedor": ["FORNECEDOR"],
    "nf": ["NF"],
    "mapa_precos": ["MAPA PREÇOS", "MAPA PRECOS", "MAPA"],
    "natureza": ["NATUREZA"],
    "boleto_deposito": ["BOLETO/DEPÓSITO", "BOLETO/DEPOSITO", "COND.PAGTO", "COND PAGTO"],
    "data_vencimento": ["DATA VENCTO", "DATA VENCIMENTO", "DATA"],
    "valor": ["VALOR"],
    "item_planilha": ["ITEM PLANILHA", "ITEM"],
    "valor_item": ["VALOR ITEM", "VALOR APROPRIADO ITEM"],
    "situacao_planilha": ["SITUAÇÃO PLANILHA", "SITUACAO PLANILHA", "SITUAÇÃO"],
    "situacao_mapa_compra": ["SITUAÇÃO MAPA COMPRA", "SITUACAO MAPA COMPRA"],
    "saldo_planilha": ["SALDO PLANILHA", "SALDO"],
    "observacoes": ["OBSERVAÇÕES", "OBSERVACOES"],
}

CONSOLIDADO_COLUMN_MAP: dict[str, list[str]] = {
    "n_consolidado": ["Nº CONSOLIDADO", "N CONSOLIDADO", "NUM CONSOLIDADO"],
    "fornecedor": ["FORNECEDOR"],
    "nf": ["NF"],
    "mapa": ["MAPA", "MAPA PREÇOS", "MAPA PRECOS"],
    "natureza": ["NATUREZA"],
    "cond_pagto": ["COND.PAGTO", "COND PAGTO", "BOLETO/DEPÓSITO", "BOLETO/DEPOSITO"],
    "data_vencimento": ["DATA VENCTO", "DATA VENCIMENTO", "DATA"],
    "valor": ["VALOR"],
    "apropriacao_item": ["ITEM APROPRIAÇÃO", "ITEM APROPRIACAO", "APROPRIITEM"],
    "apropriacao_valor": ["VALOR APROPRIADO", "APROPRIVALOR"],
}

ORCAMENTO_BUDGET_COLUMN_MAP: dict[str, list[str]] = {
    "item": ["ITEM"],
    "subitem": ["SUBITEM"],
    "descricao": ["DESCRIÇÃO", "DESCRICAO"],
    "unid": ["UNID"],
    "qtd": ["QTD", "QUANTIDADE"],
    "custo_unitario": ["CUSTO UNITÁRIO", "CUSTO UNITARIO"],
    "custo_total": ["CUSTO TOTAL"],
}

RESUMO_COLUMN_MAP: dict[str, list[str]] = {
    "n_consolidado": ["Nº CONSOLIDADO", "N CONSOLIDADO"],
    "fornecedor": ["FORNECEDOR", "CLIENTE"],
    "material_servico": ["MATERIAL/SERVIÇO", "MATERIAL/SERVICO"],
    "mao_obra_empr": ["MÃO OBRA EMPREITADA", "MAO OBRA EMPREITADA"],
    "mao_obra_tempo": ["MÃO OBRA TEMPO", "MAO OBRA TEMPO"],
    "staff": ["STAFF"],
    "servicos_sem_taxa_adm": ["SERVIÇO sem TAXA ADM", "SERVIÇO SEM TAXA ADM", "SERVICO SEM TAXA ADM"],
    "total": ["TOTAL"],
    "taxa_administracao": ["TAXA ADMINISTRAÇÃO", "TAXA ADMINISTRACAO"],
    "taxa_pct": ["%", "TAXA %"],
    "nf_administracao": ["NF ADMINISTRAÇÃO", "NF ADMINISTRACAO"],
    "data_vencimento": ["DATA VENCTO", "DATA VENCIMENTO"],
    "data_recebimento": ["DATA RECBTO", "DATA RECBTº", "DATA RECBIMENTO", "DATA RECEBIMENTO"],
    "total_geral": ["TOTAL GERAL"],
}

MONTH_NAME_MAP = {
    "JAN": "1",
    "FEV": "2",
    "MAR": "3",
    "ABR": "4",
    "MAI": "5",
    "JUN": "6",
    "JUL": "7",
    "AGO": "8",
    "SET": "9",
    "OUT": "10",
    "NOV": "11",
    "DEZ": "12",
    "JANEIRO": "1",
    "FEVEREIRO": "2",
    "MARCO": "3",
    "MARCO/": "3",
    "ABRIL": "4",
    "MAIO": "5",
    "JUNHO": "6",
    "JULHO": "7",
    "AGOSTO": "8",
    "SETEMBRO": "9",
    "OUTUBRO": "10",
    "NOVEMBRO": "11",
    "DEZEMBRO": "12",
}

RISK_LOW = "baixo"
RISK_MEDIUM = "medio"
RISK_HIGH = "alto"


def _normalize_text(value: Any) -> str:
    text = strip_accents(str(value or "")).upper().strip()
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return " ".join(text.split())


def _match_sheet_name(sheet_names: list[str], candidates: list[str]) -> str | None:
    normalized_names = {_normalize_text(name): name for name in sheet_names}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        for normalized_name, original_name in normalized_names.items():
            if normalized_candidate in normalized_name:
                return original_name
    return None


def _read_sheet_raw(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame | None:
    if not sheet_name:
        return None
    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=None)
    dataframe.attrs["source_name"] = sheet_name
    return dataframe


def _promote_header(df_raw: pd.DataFrame, required_cols: list[str]) -> pd.DataFrame:
    header_row = find_header_row(df_raw, required_cols)
    table = df_raw.iloc[header_row + 1 :].copy().reset_index(drop=True)
    table.columns = [
        str(value).strip() if pd.notna(value) and str(value).strip() else f"COL_{index + 1}"
        for index, value in enumerate(df_raw.iloc[header_row].tolist())
    ]
    table = table.dropna(axis=0, how="all").dropna(axis=1, how="all")
    table.attrs["source_name"] = df_raw.attrs.get("source_name", "")
    table["_source_sheet"] = table.attrs["source_name"]
    table["_source_row"] = [header_row + 2 + index for index in range(len(table))]
    return table.reset_index(drop=True)


def _append_source_columns(normalized: pd.DataFrame, source: pd.DataFrame) -> pd.DataFrame:
    if normalized.empty:
        return normalized
    for column in ("_source_sheet", "_source_row"):
        if column in source.columns and column not in normalized.columns:
            normalized[column] = source[column].values[: len(normalized)]
    return normalized


def _not_blank(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().ne("")


def _attach_quality(df: pd.DataFrame, report: DataQualityReport) -> pd.DataFrame:
    df.attrs["quality_report"] = asdict(report)
    return df


def _empty_report() -> dict[str, Any]:
    return asdict(DataQualityReport(total_rows=0, valid_rows=0))


def _parse_month_key(column_name: Any) -> str | None:
    if isinstance(column_name, (int, float)) and not isinstance(column_name, bool):
        if float(column_name).is_integer():
            month_num = int(column_name)
            if 1 <= month_num <= 24:
                return str(month_num)

    raw_text = str(column_name).strip()
    if re.fullmatch(r"\d+(?:\.0+)?", raw_text):
        month_num = int(float(raw_text))
        if 1 <= month_num <= 24:
            return str(month_num)

    normalized = _normalize_text(column_name)
    if not normalized:
        return None
    if normalized.isdigit():
        month_num = int(normalized)
        if 1 <= month_num <= 24:
            return str(month_num)
        return None

    if re.fullmatch(r"\d+\.0", normalized):
        month_num = int(float(normalized))
        if 1 <= month_num <= 24:
            return str(month_num)
        return None

    direct = MONTH_NAME_MAP.get(normalized)
    if direct:
        return direct

    for token, month_value in MONTH_NAME_MAP.items():
        if token in normalized:
            return month_value
    return None


def _extract_metadata_from_resumo(df_raw: pd.DataFrame | None) -> dict[str, Any]:
    if df_raw is None or df_raw.empty:
        return {}

    metadata: dict[str, Any] = {}
    for _, row in df_raw.head(12).iterrows():
        values = [str(value).strip() for value in row.tolist() if pd.notna(value) and str(value).strip()]
        normalized = [_normalize_text(value) for value in values]
        for index, token in enumerate(normalized):
            next_value = values[index + 1] if index + 1 < len(values) else ""
            if token == "OBRA" and next_value and "obra" not in metadata:
                metadata["obra"] = next_value
            if token == "CLIENTE" and next_value and "cliente" not in metadata:
                metadata["cliente"] = next_value
            if token.startswith("TAXA ADM") and next_value and "taxa_adm_pct" not in metadata:
                metadata["taxa_adm_pct"] = next_value
            if token.startswith("INICIO") and next_value and "data_inicio" not in metadata:
                parsed = pd.to_datetime(next_value, errors="coerce", dayfirst=True)
                if pd.notna(parsed):
                    metadata["data_inicio"] = parsed.date().isoformat()
    return metadata


def canonicalize_nfs_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys()))
    normalized = normalize_df(df, NFS_COLUMN_MAP)
    normalized = _append_source_columns(normalized, df)
    if "data_vencimento" in normalized.columns:
        normalized["data_vencimento"] = pd.to_datetime(normalized["data_vencimento"], errors="coerce", dayfirst=True)
    if "valor" in normalized.columns:
        normalized["valor"] = pd.to_numeric(normalized["valor"], errors="coerce")
    if {"fornecedor", "valor"}.issubset(normalized.columns):
        has_supplier = _not_blank(normalized["fornecedor"])
        has_value = normalized["valor"].notna() & normalized["valor"].ne(0)
        normalized = normalized[has_supplier & has_value].copy()
    if "natureza" in normalized.columns:
        normalized = normalized[_not_blank(normalized["natureza"])].copy()
    return normalized.reset_index(drop=True)


def canonicalize_consolidado_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=list(CONSOLIDADO_COLUMN_MAP.keys()))
    normalized = normalize_df(df, CONSOLIDADO_COLUMN_MAP)
    normalized = _append_source_columns(normalized, df)
    if "data_vencimento" in normalized.columns:
        normalized["data_vencimento"] = pd.to_datetime(normalized["data_vencimento"], errors="coerce", dayfirst=True)
    if "valor" in normalized.columns:
        normalized["valor"] = pd.to_numeric(normalized["valor"], errors="coerce")
    if {"fornecedor", "natureza", "valor"}.issubset(normalized.columns):
        normalized = normalized[
            _not_blank(normalized["fornecedor"])
            & _not_blank(normalized["natureza"])
            & normalized["valor"].notna()
            & normalized["valor"].ne(0)
        ].copy()
    return normalized.reset_index(drop=True)


def canonicalize_budget_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=list(ORCAMENTO_BUDGET_COLUMN_MAP.keys()))
    normalized = normalize_df(df, ORCAMENTO_BUDGET_COLUMN_MAP)
    normalized = _append_source_columns(normalized, df)
    if "item" in normalized.columns and "custo_total" in normalized.columns:
        normalized = normalized[
            ~(
                normalized["item"].astype("string").str.strip().fillna("").eq("")
                & (normalized["custo_total"].fillna(0) == 0)
            )
        ]
    return normalized.reset_index(drop=True)


def canonicalize_mapas_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"])
    return normalize_df(
        df,
        {
            "item": ["ITEM"],
            "subitem": ["SUBITEM"],
            "descricao": ["DESCRIÇÃO", "DESCRICAO"],
            "mapa_num": ["MAPA", "MAPA_NUM", "MAPA NUM"],
            "valor_alocado": ["VALOR ALOCADO", "VALOR_ALOCADO", "VALOR_MAPA"],
        },
    )


def canonicalize_resumo_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=list(RESUMO_COLUMN_MAP.keys()))
    normalized = normalize_df(df, RESUMO_COLUMN_MAP)
    normalized = _append_source_columns(normalized, df)
    numeric_cols = [
        column
        for column in normalized.columns
        if column
        not in {"n_consolidado", "fornecedor", "nf_administracao", "data_vencimento", "data_recebimento"}
    ]
    for column in numeric_cols:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce").fillna(0)
    for column in ["data_vencimento", "data_recebimento"]:
        if column in normalized.columns:
            normalized[column] = pd.to_datetime(normalized[column], errors="coerce", dayfirst=True)
    value_columns = [column for column in ["total", "total_geral", "taxa_administracao"] if column in normalized.columns]
    if value_columns:
        has_money = pd.Series(False, index=normalized.index)
        for column in value_columns:
            has_money = has_money | pd.to_numeric(normalized[column], errors="coerce").fillna(0).ne(0)
        normalized = normalized[has_money].copy()
    return normalized.reset_index(drop=True)


def canonicalize_orcado_realizado_frame(df: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(columns=["item", "subitem", "descricao", "verba_total"])
    explicit = normalize_df(
        df,
        {
            "item": ["item", "ITEM", "ITEM/SUBITEM", "ITEM SUBITEM"],
            "subitem": ["subitem", "SUBITEM"],
            "descricao": ["descricao", "DESCRIÇÃO", "DESCRICAO"],
            "verba_total": ["verba_total", "VERBA TOTAL CUSTO DIRETO", "VERBA TOTAL", "VERBA"],
        },
    )
    remaining_months: dict[str, pd.Series] = {}
    for column in df.columns:
        month_key = _parse_month_key(column)
        if month_key is not None:
            remaining_months[month_key] = pd.to_numeric(df[column], errors="coerce").fillna(0)
    for column_name, series in remaining_months.items():
        explicit[column_name] = series.values[: len(explicit)]
    explicit = _append_source_columns(explicit, df)
    return explicit.reset_index(drop=True)


def _parse_nfs_sheet(workbook_bytes: bytes, sheet_name: str | None) -> tuple[pd.DataFrame, dict[str, Any]]:
    if not sheet_name:
        return pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys())), _empty_report()

    raw = _read_sheet_raw(workbook_bytes, sheet_name)
    if raw is None or raw.empty:
        return pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys())), _empty_report()

    table = _promote_header(raw, ["FORNECEDOR", "NF", "VALOR", "NATUREZA", "DATA"])
    normalized = canonicalize_nfs_frame(table)
    report = validate_df(
        normalized,
        {
            "required": ["fornecedor", "nf", "valor"],
            "numeric": ["valor", "valor_item", "saldo_planilha"],
            "date": ["data_vencimento"],
            "non_empty": ["fornecedor", "natureza"],
        },
    )
    return _attach_quality(normalized, report), asdict(report)


def _parse_consolidado_sheet(workbook_bytes: bytes, sheet_name: str | None) -> tuple[pd.DataFrame, dict[str, Any]]:
    if not sheet_name:
        return pd.DataFrame(columns=list(CONSOLIDADO_COLUMN_MAP.keys())), _empty_report()

    raw = _read_sheet_raw(workbook_bytes, sheet_name)
    if raw is None or raw.empty:
        return pd.DataFrame(columns=list(CONSOLIDADO_COLUMN_MAP.keys())), _empty_report()

    table = _promote_header(raw, ["FORNECEDOR", "NF", "VALOR", "NATUREZA", "DATA"])
    normalized = canonicalize_consolidado_frame(table)
    report = validate_df(
        normalized,
        {
            "required": ["fornecedor", "nf", "valor"],
            "numeric": ["valor", "apropriacao_valor"],
            "date": ["data_vencimento"],
            "non_empty": ["fornecedor", "natureza"],
        },
    )
    return _attach_quality(normalized, report), asdict(report)


def _parse_orcamento_sheet(
    workbook_bytes: bytes,
    sheet_name: str | None,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    if not sheet_name:
        return (
            pd.DataFrame(columns=list(ORCAMENTO_BUDGET_COLUMN_MAP.keys())),
            pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"]),
            _empty_report(),
        )

    raw = _read_sheet_raw(workbook_bytes, sheet_name)
    if raw is None or raw.empty:
        return (
            pd.DataFrame(columns=list(ORCAMENTO_BUDGET_COLUMN_MAP.keys())),
            pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"]),
            _empty_report(),
        )

    table = _promote_header(raw, ["ITEM", "DESCRIÇÃO", "CUSTO TOTAL", "CUSTO UNITÁRIO", "QTD"])
    first_nine = table.iloc[:, : min(9, len(table.columns))].copy()
    budget_rename_map: dict[str, str] = {}
    for column in first_nine.columns:
        normalized = _normalize_text(column)
        if normalized == "ITEM":
            budget_rename_map[column] = "item"
        elif normalized == "SUBITEM":
            budget_rename_map[column] = "subitem"
        elif normalized == "DESCRICAO":
            budget_rename_map[column] = "descricao"
        elif normalized == "UNID":
            budget_rename_map[column] = "unid"
        elif normalized in {"QTD", "QUANTIDADE"}:
            budget_rename_map[column] = "qtd"
        elif normalized == "CUSTO UNITARIO":
            budget_rename_map[column] = "custo_unitario"
        elif normalized == "CUSTO TOTAL":
            budget_rename_map[column] = "custo_total"

    budget_source = first_nine.rename(columns=budget_rename_map)
    budget_df = canonicalize_budget_frame(budget_source)
    if {"item", "custo_total"}.issubset(budget_df.columns):
        budget_df = budget_df[
            ~(
                budget_df["item"].astype("string").str.strip().fillna("").eq("")
                & budget_df["custo_total"].fillna(0).eq(0)
            )
        ].reset_index(drop=True)

    report = validate_df(
        budget_df,
        {
            "required": ["item", "descricao", "custo_total"],
            "numeric": ["qtd", "custo_unitario", "custo_total"],
            "date": [],
            "non_empty": ["item", "descricao"],
        },
    )

    mapas_df = pd.DataFrame(columns=["item", "subitem", "descricao", "mapa_num", "valor_alocado"])
    if len(table.columns) > 9 and not budget_df.empty:
        mapa_values = table.iloc[:, 9:].copy().reset_index(drop=True)
        id_columns = [column for column in ["item", "subitem", "descricao"] if column in budget_source.columns]
        if "item" in id_columns and "descricao" in id_columns:
            melt_source = pd.concat([budget_source[id_columns].reset_index(drop=True), mapa_values], axis=1)
            mapa_columns = list(mapa_values.columns)
            mapas_df = (
                melt_source.melt(
                    id_vars=id_columns,
                    value_vars=mapa_columns,
                    var_name="mapa_num",
                    value_name="valor_alocado",
                )
                .assign(valor_alocado=lambda frame: pd.to_numeric(frame["valor_alocado"], errors="coerce"))
                .dropna(subset=["valor_alocado"])
            )
            mapas_df = mapas_df[mapas_df["valor_alocado"] != 0].reset_index(drop=True)

    return _attach_quality(budget_df, report), mapas_df, asdict(report)


def _parse_orcado_realizado_sheet(workbook_bytes: bytes, sheet_name: str | None) -> tuple[pd.DataFrame, dict[str, Any]]:
    if not sheet_name:
        return pd.DataFrame(columns=["item", "subitem", "descricao", "verba_total"]), _empty_report()

    raw = _read_sheet_raw(workbook_bytes, sheet_name)
    if raw is None or raw.empty:
        return pd.DataFrame(columns=["item", "subitem", "descricao", "verba_total"]), _empty_report()

    try:
        table = _promote_header(raw, ["DESCRIÇÃO", "VERBA", "ITEM", "SUBITEM"])
    except HeaderNotFoundError:
        table = _promote_header(raw, ["DESCRIÇÃO", "VERBA", "ITEM"])
    rename_map: dict[str, str] = {}
    for column in table.columns:
        normalized = _normalize_text(column)
        if normalized in {"ITEM", "ITEM SUBITEM"}:
            rename_map[column] = "item"
        elif normalized == "SUBITEM":
            rename_map[column] = "subitem"
        elif normalized == "DESCRICAO":
            rename_map[column] = "descricao"
        elif normalized.startswith("VERBA"):
            rename_map[column] = "verba_total"

    working = table.rename(columns=rename_map).copy()
    month_columns: dict[str, str] = {}
    for column in working.columns:
        month_key = _parse_month_key(column)
        if month_key is not None and column not in {"item", "subitem", "descricao", "verba_total"}:
            month_columns[column] = month_key

    working = working.rename(columns=month_columns)
    base_columns = [column for column in ["item", "subitem", "descricao", "verba_total"] if column in working.columns]
    selected_columns = base_columns + list(month_columns.values())
    normalized = working.loc[:, selected_columns].copy()
    for column in ["verba_total", *month_columns.values()]:
        if column in normalized.columns:
            normalized[column] = pd.to_numeric(normalized[column], errors="coerce").fillna(0)
    if "item" in normalized.columns:
        normalized = normalized[~normalized["item"].astype("string").str.strip().fillna("").eq("")]
    report = validate_df(
        normalized,
        {
            "required": ["descricao", "verba_total"],
            "numeric": ["verba_total", *month_columns.values()],
            "date": [],
            "non_empty": ["descricao"],
        },
    )
    return _attach_quality(normalized.reset_index(drop=True), report), asdict(report)


def _parse_resumo_sheet(
    workbook_bytes: bytes,
    sheet_name: str | None,
) -> tuple[pd.DataFrame, dict[str, Any], dict[str, Any]]:
    if not sheet_name:
        return pd.DataFrame(columns=list(RESUMO_COLUMN_MAP.keys())), _empty_report(), {}

    raw = _read_sheet_raw(workbook_bytes, sheet_name)
    if raw is None or raw.empty:
        return pd.DataFrame(columns=list(RESUMO_COLUMN_MAP.keys())), _empty_report(), {}

    metadata = _extract_metadata_from_resumo(raw)
    try:
        table = _promote_header(
            raw,
            ["TOTAL GERAL", "TAXA ADMINISTRAÇÃO", "MATERIAL", "MÃO OBRA", "FORNECEDOR"],
        )
    except HeaderNotFoundError:
        table = _promote_header(raw, ["TOTAL GERAL", "TAXA ADMINISTRAÇÃO", "MATERIAL"])

    normalized = canonicalize_resumo_frame(table)
    report = validate_df(
        normalized,
        {
            "required": ["total_geral"],
            "numeric": [
                "material_servico",
                "mao_obra_empr",
                "mao_obra_tempo",
                "staff",
                "servicos_sem_taxa_adm",
                "total",
                "taxa_administracao",
                "taxa_pct",
                "total_geral",
            ],
            "date": ["data_vencimento", "data_recebimento"],
            "non_empty": [],
        },
    )
    return _attach_quality(normalized, report), asdict(report), metadata


def parse_custos_workbook_bytes(workbook_bytes: bytes) -> dict[str, Any]:
    try:
        workbook = pd.ExcelFile(BytesIO(workbook_bytes))
    except Exception as exc:
        logger.exception("Falha ao abrir workbook de custos: %s", exc)
        return {
            "nfs": pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys())),
            "orcamento": {"budget": pd.DataFrame(), "mapas": pd.DataFrame()},
            "orcado_realizado": pd.DataFrame(),
            "consolidado": pd.DataFrame(),
            "resumo": pd.DataFrame(),
            "quality_reports": {},
            "metadata": {},
        }

    sheet_names = workbook.sheet_names
    nfs_sheet = _match_sheet_name(sheet_names, ["PLANILHA NFs - Entrada de Dados", "PLANILHA NFs", "NFs"])
    consolidado_sheet = _match_sheet_name(sheet_names, ["PLANILHA CONSOLIDADO", "CONSOLIDADO"])
    orcamento_sheet = _match_sheet_name(sheet_names, ["PLANILHA ORÇAMENTO - Entrada de", "PLANILHA ORCAMENTO"])
    orcado_realizado_sheet = _match_sheet_name(
        sheet_names,
        ["PLANILHA ORÇADOxREALIZADO", "PLANILHA ORCADOxREALIZADO"],
    )
    resumo_sheet = _match_sheet_name(sheet_names, ["RESUMO CONSOLIDADOS - CLIENTE", "RESUMO CONSOLIDADOS"])

    result: dict[str, Any] = {
        "nfs": pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys())),
        "orcamento": {"budget": pd.DataFrame(), "mapas": pd.DataFrame()},
        "orcado_realizado": pd.DataFrame(),
        "consolidado": pd.DataFrame(columns=list(CONSOLIDADO_COLUMN_MAP.keys())),
        "resumo": pd.DataFrame(columns=list(RESUMO_COLUMN_MAP.keys())),
        "quality_reports": {},
        "metadata": {},
    }

    try:
        result["nfs"], result["quality_reports"]["nfs"] = _parse_nfs_sheet(workbook_bytes, nfs_sheet)
    except Exception as exc:
        logger.exception("Falha ao processar sheet NFs: %s", exc)
        result["nfs"] = pd.DataFrame(columns=list(NFS_COLUMN_MAP.keys()))
        result["quality_reports"]["nfs"] = _empty_report()

    try:
        result["consolidado"], result["quality_reports"]["consolidado"] = _parse_consolidado_sheet(
            workbook_bytes,
            consolidado_sheet,
        )
    except Exception as exc:
        logger.exception("Falha ao processar sheet Consolidado: %s", exc)
        result["consolidado"] = pd.DataFrame(columns=list(CONSOLIDADO_COLUMN_MAP.keys()))
        result["quality_reports"]["consolidado"] = _empty_report()

    try:
        budget_df, mapas_df, budget_report = _parse_orcamento_sheet(workbook_bytes, orcamento_sheet)
        result["orcamento"] = {"budget": budget_df, "mapas": mapas_df}
        result["quality_reports"]["orcamento"] = budget_report
    except Exception as exc:
        logger.exception("Falha ao processar sheet Orcamento: %s", exc)
        result["orcamento"] = {"budget": pd.DataFrame(), "mapas": pd.DataFrame()}
        result["quality_reports"]["orcamento"] = _empty_report()

    try:
        result["orcado_realizado"], result["quality_reports"]["orcado_realizado"] = _parse_orcado_realizado_sheet(
            workbook_bytes,
            orcado_realizado_sheet,
        )
    except Exception as exc:
        logger.exception("Falha ao processar sheet Orcado x Realizado: %s", exc)
        result["orcado_realizado"] = pd.DataFrame()
        result["quality_reports"]["orcado_realizado"] = _empty_report()

    try:
        resumo_df, resumo_report, metadata = _parse_resumo_sheet(workbook_bytes, resumo_sheet)
        result["resumo"] = resumo_df
        result["quality_reports"]["resumo"] = resumo_report
        result["metadata"] = metadata
    except Exception as exc:
        logger.exception("Falha ao processar sheet Resumo: %s", exc)
        result["resumo"] = pd.DataFrame(columns=list(RESUMO_COLUMN_MAP.keys()))
        result["quality_reports"]["resumo"] = _empty_report()

    return result


def parse_custos_workbook(path: str) -> dict[str, Any]:
    return parse_custos_workbook_bytes(Path(path).read_bytes())


def _safe_month_label(timestamp: pd.Timestamp) -> str:
    month_labels = {
        1: "Jan",
        2: "Fev",
        3: "Mar",
        4: "Abr",
        5: "Mai",
        6: "Jun",
        7: "Jul",
        8: "Ago",
        9: "Set",
        10: "Out",
        11: "Nov",
        12: "Dez",
    }
    return month_labels.get(timestamp.month, str(timestamp.month))


def _positive_value_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Retorna apenas linhas de Custos com VALOR numerico maior que zero."""
    if df.empty or "valor" not in df.columns:
        return pd.DataFrame(columns=df.columns)
    working = df.copy()
    working["valor"] = pd.to_numeric(working["valor"], errors="coerce")
    return working[working["valor"].notna() & (working["valor"] != 0)].copy()


def _extract_tax_pct(resumo: pd.DataFrame, total_valor: float, valor_com_taxa: float) -> float:
    """Extrai a taxa administrativa percentual do resumo ou calcula por diferença."""
    taxa_pct = 0.0
    if not resumo.empty and "taxa_pct" in resumo.columns:
        taxa_values = pd.to_numeric(resumo["taxa_pct"], errors="coerce").dropna()
        taxa_values = taxa_values[taxa_values != 0]
        if not taxa_values.empty:
            raw_value = float(taxa_values.median())
            taxa_pct = raw_value * 100 if 0 < raw_value <= 1 else raw_value
    if taxa_pct == 0 and total_valor and valor_com_taxa > 0:
        calculated_pct = ((valor_com_taxa - total_valor) / total_valor) * 100
        taxa_pct = calculated_pct if calculated_pct > 0 else 0.0
    return round(float(taxa_pct), 2)


def build_custos_summary(
    nfs: pd.DataFrame,
    resumo: pd.DataFrame | None = None,
    default_tax_pct: float = 0.0,
) -> dict[str, Any]:
    """Calcula KPIs de Custos com as formulas oficiais do dashboard."""
    nfs_frame = canonicalize_nfs_frame(nfs)
    resumo_frame = canonicalize_resumo_frame(resumo)
    valid_nfs = _positive_value_frame(nfs_frame)
    total_valor = float(valid_nfs["valor"].sum()) if "valor" in valid_nfs.columns else 0.0
    total_nfs = int(len(valid_nfs))

    if not resumo_frame.empty and "total_geral" in resumo_frame.columns:
        total_geral = pd.to_numeric(resumo_frame["total_geral"], errors="coerce").fillna(0)
        valor_com_taxa = float(total_geral[total_geral != 0].sum())
    else:
        valor_com_taxa = 0.0

    taxa_adm_pct = _extract_tax_pct(resumo_frame, total_valor, valor_com_taxa)
    if taxa_adm_pct == 0 and default_tax_pct:
        taxa_adm_pct = default_tax_pct * 100 if 0 < default_tax_pct <= 1 else default_tax_pct
    if valor_com_taxa == 0:
        valor_com_taxa = total_valor * (1 + (taxa_adm_pct / 100))

    situacao = (
        valid_nfs["situacao_planilha"].fillna("").astype(str).map(_normalize_text)
        if "situacao_planilha" in valid_nfs.columns
        else pd.Series([""] * len(valid_nfs), index=valid_nfs.index)
    )
    datas = (
        pd.to_datetime(valid_nfs["data_vencimento"], errors="coerce", dayfirst=True)
        if "data_vencimento" in valid_nfs.columns
        else pd.Series(pd.NaT, index=valid_nfs.index)
    )
    nfs_em_aberto = int(((~situacao.eq("PAGO")) & datas.notna()).sum())

    by_natureza: list[dict[str, Any]] = []
    if "natureza" in valid_nfs.columns and "valor" in valid_nfs.columns:
        grouped = (
            valid_nfs.groupby("natureza", dropna=False)["valor"]
            .sum()
            .reset_index()
            .sort_values("valor", ascending=False)
        )
        by_natureza = [
            {
                "natureza": str(row["natureza"] or "Nao informado"),
                "valor": round(float(row["valor"] or 0), 2),
                "percentual": round((float(row["valor"] or 0) / total_valor) * 100, 2) if total_valor else 0.0,
            }
            for _, row in grouped.iterrows()
        ]

    return {
        "total_nfs": total_nfs,
        "total_valor": round(total_valor, 2),
        "valor_com_taxa": round(float(valor_com_taxa), 2),
        "taxa_adm_pct": round(float(taxa_adm_pct), 2),
        "nfs_em_aberto": nfs_em_aberto,
        "by_natureza": by_natureza,
    }


def get_top_fornecedores(path: str, limit: int = 10) -> list[dict[str, Any]]:
    """Retorna os principais fornecedores de um workbook de custos."""
    structured = parse_custos_workbook(path)
    frame = canonicalize_nfs_frame(structured.get("nfs"))
    if frame.empty:
        frame = canonicalize_consolidado_frame(structured.get("consolidado"))
    valid = _positive_value_frame(frame)
    if valid.empty or "fornecedor" not in valid.columns:
        return []
    grouped = (
        valid.assign(fornecedor=valid["fornecedor"].fillna("").astype(str).str.strip())
        .query("fornecedor != ''")
        .groupby("fornecedor", dropna=False)
        .agg(total_valor=("valor", "sum"), count_nfs=("nf", "count"))
        .reset_index()
        .sort_values("total_valor", ascending=False)
        .head(limit)
    )
    total = float(valid["valor"].sum())
    return [
        {
            "fornecedor": str(row["fornecedor"]),
            "total_valor": round(float(row["total_valor"] or 0), 2),
            "count_nfs": int(row["count_nfs"]),
            "pct_do_total": round((float(row["total_valor"] or 0) / total) * 100, 2) if total else 0.0,
        }
        for _, row in grouped.iterrows()
    ]


class CustosAnalyzer:
    def __init__(
        self,
        nfs: pd.DataFrame,
        consolidado: pd.DataFrame,
        meta: dict[str, Any] | None = None,
        resumo: pd.DataFrame | None = None,
    ):
        self.nfs = canonicalize_nfs_frame(nfs)
        self.cons = canonicalize_consolidado_frame(consolidado)
        self.meta = meta or {}
        self.resumo = canonicalize_resumo_frame(resumo)

    def _nfs_with_dates(self) -> pd.DataFrame:
        if "data_vencimento" not in self.nfs.columns:
            return pd.DataFrame(columns=self.nfs.columns)
        working = self.nfs.copy()
        working["data_vencimento"] = pd.to_datetime(working["data_vencimento"], errors="coerce", dayfirst=True)
        return working[working["data_vencimento"].notna()].copy()

    def get_summary(self) -> dict[str, Any]:
        official_summary = build_custos_summary(self.nfs, self.resumo)
        total_valor = official_summary["total_valor"]
        total_nfs = official_summary["total_nfs"]
        unique_forn = int(self.nfs.get("fornecedor", pd.Series(dtype=object)).nunique())
        unique_cons = int(self.nfs.get("n_consolidado", pd.Series(dtype=object)).nunique())
        avg_nf = total_valor / total_nfs if total_nfs else 0.0

        dated = self._nfs_with_dates()
        data_min = dated["data_vencimento"].min() if not dated.empty else None
        data_max = dated["data_vencimento"].max() if not dated.empty else None
        cons_total = float(self.cons.get("valor", pd.Series(dtype=float)).fillna(0).sum())

        return {
            "obra": self.meta.get("obra", self.meta.get("Obra", "")),
            "periodo": self.meta.get("periodo", self.meta.get("Periodo", "")),
            "total_nfs": total_nfs,
            "total_valor": round(total_valor, 2),
            "valor_com_taxa": official_summary["valor_com_taxa"],
            "taxa_adm_pct": official_summary["taxa_adm_pct"],
            "nfs_em_aberto": official_summary["nfs_em_aberto"],
            "by_natureza": official_summary["by_natureza"],
            "valor_medio_nf": round(avg_nf, 2),
            "unique_fornecedores": unique_forn,
            "unique_consolidados": unique_cons,
            "data_inicio": data_min.date().isoformat() if pd.notna(data_min) else "",
            "data_fim": data_max.date().isoformat() if pd.notna(data_max) else "",
            "consolidado_atual": {
                "total_nfs": int(len(self.cons)),
                "total_valor": round(cons_total, 2),
            },
        }

    def get_fornecedor_ranking(self, limit: int = 20) -> list[dict[str, Any]]:
        if self.nfs.empty or "fornecedor" not in self.nfs.columns:
            return []

        working = self.nfs.copy()
        working["fornecedor"] = (
            working["fornecedor"]
            .fillna("")
            .astype(str)
            .map(str.strip)
        )
        working = working[working["fornecedor"] != ""].copy()
        if working.empty:
            return []

        working["_fornecedor_key"] = working["fornecedor"].str.casefold()
        grouped = (
            working.groupby("_fornecedor_key", dropna=False)
            .agg(
                fornecedor=("fornecedor", "first"),
                valor=("valor", "sum"),
                count=("nf", "count"),
            )
            .reset_index()
            .sort_values("valor", ascending=False)
            .head(limit)
        )
        total_geral = float(working.get("valor", pd.Series(dtype=float)).fillna(0).sum())
        return [
            {
                "fornecedor": str(row["fornecedor"] or "Sem fornecedor"),
                "valor": round(float(row["valor"] or 0), 2),
                "participacao": round((float(row["valor"] or 0) / total_geral) * 100, 2) if total_geral else 0.0,
                "count": int(row["count"]),
                "total_valor": round(float(row["valor"] or 0), 2),
                "pct_total": round((float(row["valor"] or 0) / total_geral) * 100, 2) if total_geral else 0.0,
                "qtd_nfs": int(row["count"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_natureza_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "natureza" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("natureza", dropna=False)
            .agg(total_valor=("valor", "sum"), qtd_nfs=("nf", "count"))
            .reset_index()
            .sort_values("total_valor", ascending=False)
        )
        return [
            {
                "natureza": str(row["natureza"] or ""),
                "total_valor": round(float(row["total_valor"] or 0), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_pagamento_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "boleto_deposito" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("boleto_deposito", dropna=False)
            .agg(total_valor=("valor", "sum"), qtd_nfs=("nf", "count"))
            .reset_index()
            .sort_values("total_valor", ascending=False)
        )
        return [
            {
                "metodo": str(row["boleto_deposito"] or ""),
                "total_valor": round(float(row["total_valor"] or 0), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_monthly_timeline(self) -> list[dict[str, Any]]:
        working = self._nfs_with_dates()
        if working.empty:
            return []
        working["mes_ano"] = working["data_vencimento"].dt.to_period("M").dt.to_timestamp()
        grouped = (
            working.groupby("mes_ano")
            .agg(total_valor=("valor", "sum"), qtd_nfs=("nf", "count"), fornecedores=("fornecedor", "nunique"))
            .reset_index()
            .sort_values("mes_ano")
        )
        return [
            {
                "mes": row["mes_ano"].date().isoformat(),
                "mes_nome": _safe_month_label(row["mes_ano"]),
                "total_valor": round(float(row["total_valor"] or 0), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
                "fornecedores": int(row["fornecedores"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_consolidado_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "n_consolidado" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("n_consolidado", dropna=False)
            .agg(total_valor=("valor", "sum"), qtd_nfs=("nf", "count"), fornecedores=("fornecedor", "nunique"))
            .reset_index()
            .sort_values("n_consolidado")
        )
        return [
            {
                "consolidado": str(row["n_consolidado"] or ""),
                "total_valor": round(float(row["total_valor"] or 0), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
                "fornecedores": int(row["fornecedores"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_top_nfs(self, limit: int = 20) -> list[dict[str, Any]]:
        if self.nfs.empty:
            return []
        ordered = self.nfs.sort_values("valor", ascending=False).head(limit)
        return [
            {
                "fornecedor": str(row.get("fornecedor", "") or ""),
                "nf": str(row.get("nf", "") or ""),
                "mapa": str(row.get("mapa_precos", "") or ""),
                "valor": round(float(row.get("valor", 0) or 0), 2),
                "data_vencto": (
                    pd.to_datetime(row.get("data_vencimento"), errors="coerce", dayfirst=True).date().isoformat()
                    if pd.notna(pd.to_datetime(row.get("data_vencimento"), errors="coerce", dayfirst=True))
                    else ""
                ),
                "cond_pagto": str(row.get("boleto_deposito", "") or ""),
                "consolidado": str(row.get("n_consolidado", "") or ""),
            }
            for _, row in ordered.iterrows()
        ]

    def get_consolidado_detail(self) -> list[dict[str, Any]]:
        if self.cons.empty:
            return []
        rows: list[dict[str, Any]] = []
        for _, row in self.cons.iterrows():
            parsed_date = pd.to_datetime(row.get("data_vencimento"), errors="coerce", dayfirst=True)
            rows.append(
                {
                    "num": str(row.get("n_consolidado", "") or ""),
                    "fornecedor": str(row.get("fornecedor", "") or ""),
                    "nf": str(row.get("nf", "") or ""),
                    "mapa": str(row.get("mapa", "") or ""),
                    "natureza": str(row.get("natureza", "") or ""),
                    "cond_pagto": str(row.get("cond_pagto", "") or ""),
                    "data_vencto": parsed_date.date().isoformat() if pd.notna(parsed_date) else "",
                    "valor": round(float(row.get("valor", 0) or 0), 2),
                }
            )
        return rows

    def get_all_nfs(self) -> list[dict[str, Any]]:
        if self.nfs.empty:
            return []
        rows: list[dict[str, Any]] = []
        for _, row in self.nfs.iterrows():
            parsed_date = pd.to_datetime(row.get("data_vencimento"), errors="coerce", dayfirst=True)
            rows.append(
                {
                    "fornecedor": str(row.get("fornecedor", "") or ""),
                    "nf": str(row.get("nf", "") or ""),
                    "num_consolidado": str(row.get("n_consolidado", "") or ""),
                    "mapa": str(row.get("mapa_precos", "") or ""),
                    "natureza": str(row.get("natureza", "") or ""),
                    "cond_pagto": str(row.get("boleto_deposito", "") or ""),
                    "data_vencto": parsed_date.date().isoformat() if pd.notna(parsed_date) else "",
                    "valor": round(float(row.get("valor", 0) or 0), 2),
                }
            )
        return rows

    def get_consolidated_report(self) -> dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "fornecedor_ranking": self.get_fornecedor_ranking(20),
            "natureza_breakdown": self.get_natureza_breakdown(),
            "pagamento_breakdown": self.get_pagamento_breakdown(),
            "monthly_timeline": self.get_monthly_timeline(),
            "consolidado_breakdown": self.get_consolidado_breakdown(),
            "top_nfs": self.get_top_nfs(20),
            "consolidado_detail": self.get_consolidado_detail(),
        }
