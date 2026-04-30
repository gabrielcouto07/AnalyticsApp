from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any
import re
import unicodedata

import numpy as np
import pandas as pd


_EXCEL_ERRORS = re.compile(r"^#|^ERRORREF|^ERRORNA|^ERROR", re.IGNORECASE)


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()


def _clean_excel_frame(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    working = working.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if working.empty:
        return working

    renamed_columns: list[str] = []
    for index, column in enumerate(working.columns):
        if isinstance(column, str):
            text = column.strip()
            renamed_columns.append(text or f"COL_{index + 1}")
        elif pd.notna(column):
            renamed_columns.append(str(column).strip() or f"COL_{index + 1}")
        else:
            renamed_columns.append(f"COL_{index + 1}")

    working.columns = renamed_columns
    return working.reset_index(drop=True)


def _clean_error_cells(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    for column in cleaned.select_dtypes(include="object").columns:
        cleaned[column] = cleaned[column].apply(
            lambda value: np.nan
            if isinstance(value, str) and _EXCEL_ERRORS.match(value.strip())
            else value
        )
    return cleaned


def _match_sheet_name(sheet_names: list[str], candidates: list[str]) -> str | None:
    normalized_names = {_normalize_text(name): name for name in sheet_names}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        for normalized_name, original_name in normalized_names.items():
            if normalized_candidate in normalized_name:
                return original_name
    return None


def _find_column(df: pd.DataFrame, candidates: list[str], required: bool = False) -> str | None:
    normalized_map = {_normalize_text(str(column)): column for column in df.columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        if normalized_candidate in normalized_map:
            return normalized_map[normalized_candidate]
    if required:
        raise KeyError(f"Coluna esperada nao encontrada: {', '.join(candidates)}")
    return None


def _read_sheet(workbook_bytes: bytes, sheet_name: str | None, header: int) -> pd.DataFrame | None:
    if sheet_name is None:
        return None
    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=header)
    dataframe = _clean_error_cells(dataframe)
    dataframe = _promote_first_row_to_header(dataframe)
    dataframe = _clean_excel_frame(dataframe)
    return dataframe if not dataframe.empty else None


def _read_sheet_raw(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame | None:
    if sheet_name is None:
        return None
    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=None)
    dataframe = _clean_error_cells(dataframe)
    return dataframe


def _promote_first_row_to_header(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    columns = [str(column).strip() for column in df.columns]
    unnamed_count = sum(column.lower().startswith("unnamed") for column in columns)
    first_row = df.iloc[0]
    first_row_values = [str(value).strip() for value in first_row.tolist() if pd.notna(value) and str(value).strip()]
    normalized_values = [_normalize_text(value) for value in first_row_values]
    header_signals = [
        "fornecedor",
        "natureza",
        "valor",
        "nf",
        "item",
        "descricao",
        "n consolidado",
        "total geral",
        "taxa administracao",
    ]

    should_promote = unnamed_count >= max(1, len(columns) // 2) or any(
        any(signal in value for signal in header_signals) for value in normalized_values
    )
    if not should_promote:
        return df

    promoted = df.iloc[1:].copy().reset_index(drop=True)
    promoted.columns = [
        str(value).strip() if pd.notna(value) and str(value).strip() else f"COL_{index + 1}"
        for index, value in enumerate(first_row.tolist())
    ]
    return promoted


def _promote_matching_row_to_header(
    df: pd.DataFrame | None,
    required_signals: list[str],
    max_rows: int = 6,
) -> pd.DataFrame | None:
    if df is None or df.empty:
        return df

    for row_index in range(min(len(df), max_rows)):
        row_values = [
            str(value).strip()
            for value in df.iloc[row_index].tolist()
            if pd.notna(value) and str(value).strip()
        ]
        normalized_row = [_normalize_text(value) for value in row_values]
        if all(any(signal in cell for cell in normalized_row) for signal in required_signals):
            promoted = df.iloc[row_index + 1 :].copy().reset_index(drop=True)
            promoted.columns = [
                str(value).strip() if pd.notna(value) and str(value).strip() else f"COL_{index + 1}"
                for index, value in enumerate(df.iloc[row_index].tolist())
            ]
            return _clean_excel_frame(promoted)

    return df


def _parse_numeric_value(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)

    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "---", "pago"}:
        return None

    text = text.replace("\xa0", " ")
    text = re.sub(r"^r\$\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", "", text)

    if re.search(r"\d\.\d{3},\d", text):
        text = text.replace(".", "").replace(",", ".")
    elif "," in text and "." not in text:
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")

    try:
        return float(text)
    except ValueError:
        return None


def _coerce_numeric_column(df: pd.DataFrame | None, column_name: str) -> pd.DataFrame | None:
    if df is None or column_name not in df.columns:
        return df
    working = df.copy()
    working[column_name] = working[column_name].apply(_parse_numeric_value)
    return working


def _coerce_datetime_column(df: pd.DataFrame | None, column_name: str) -> pd.DataFrame | None:
    if df is None or column_name not in df.columns:
        return df
    working = df.copy()
    default_parsed = pd.to_datetime(working[column_name], errors="coerce")
    dayfirst_parsed = pd.to_datetime(working[column_name], errors="coerce", dayfirst=True)
    working[column_name] = default_parsed.fillna(dayfirst_parsed)
    return working


def _first_content_columns(df: pd.DataFrame) -> list[str]:
    content_columns: list[str] = []
    for column in df.columns:
        text = str(column).strip()
        if not text or text.lower().startswith("unnamed"):
            continue
        content_columns.append(column)
    return content_columns


def _rename_columns_by_position(df: pd.DataFrame | None, mapping: dict[int, str]) -> pd.DataFrame | None:
    if df is None or df.empty:
        return df

    rename_map: dict[str, str] = {}
    for index, target in mapping.items():
        if index < len(df.columns):
            rename_map[df.columns[index]] = target

    if not rename_map:
        return df

    return df.rename(columns=rename_map)


def _extract_sheet_metadata(raw_df: pd.DataFrame | None) -> dict[str, Any]:
    if raw_df is None or raw_df.empty:
        return {}

    metadata: dict[str, Any] = {
        "obra_nome": "",
        "cliente": "",
        "taxa_adm_pct": 0.0,
        "data_inicio": None,
    }

    for _, row in raw_df.iterrows():
        values = [str(value).strip() for value in row.tolist() if pd.notna(value) and str(value).strip()]
        if not values:
            continue

        normalized_values = [_normalize_text(value) for value in values]
        joined = " | ".join(values)
        normalized_joined = _normalize_text(joined)

        for index, normalized_value in enumerate(normalized_values):
            next_value = values[index + 1] if index + 1 < len(values) else ""
            if normalized_value == "obra" and next_value and not metadata["obra_nome"]:
                metadata["obra_nome"] = next_value
            if normalized_value == "cliente" and next_value and not metadata["cliente"]:
                metadata["cliente"] = next_value
            if normalized_value.startswith("taxa adm") and metadata["taxa_adm_pct"] == 0.0:
                match = re.search(r"(\d+(?:[.,]\d+)?)", next_value or joined)
                if match:
                    metadata["taxa_adm_pct"] = float(match.group(1).replace(",", "."))
            if normalized_value == "inicio" and metadata["data_inicio"] is None:
                parsed_values = pd.to_datetime(pd.Series([next_value] + values), errors="coerce", dayfirst=True).dropna()
                if not parsed_values.empty:
                    metadata["data_inicio"] = parsed_values.iloc[0].date().isoformat()

        if "obra" in normalized_joined and not metadata["obra_nome"]:
            metadata["obra_nome"] = values[-1]
        if "cliente" in normalized_joined and not metadata["cliente"]:
            metadata["cliente"] = values[-1]
        if "taxa adm" in normalized_joined and metadata["taxa_adm_pct"] == 0.0:
            match = re.search(r"(\d+(?:[.,]\d+)?)", joined)
            if match:
                metadata["taxa_adm_pct"] = float(match.group(1).replace(",", "."))
        if "inicio" in normalized_joined and metadata["data_inicio"] is None:
            parsed_values = pd.to_datetime(pd.Series(values), errors="coerce", dayfirst=True).dropna()
            if not parsed_values.empty:
                metadata["data_inicio"] = parsed_values.iloc[0].date().isoformat()

    return metadata


def _prepare_nfs_dataframe(df: pd.DataFrame | None) -> pd.DataFrame | None:
    if df is None or df.empty:
        return df
    working = df.copy()
    fornecedor_col = _find_column(working, ["FORNECEDOR"], required=True)
    valor_col = _find_column(working, ["VALOR"], required=True)
    data_col = _find_column(working, ["DATA VENCTO"], required=False)

    working = _coerce_numeric_column(working, str(valor_col))
    working = _coerce_numeric_column(working, "SALDO PLANILHA")
    if data_col:
        working = _coerce_datetime_column(working, str(data_col))

    working = working[working[fornecedor_col].notna()]
    working = working[working[fornecedor_col].astype(str).str.strip() != "---"]
    working = working[working[valor_col].notna() & (working[valor_col] != 0)]
    return working.reset_index(drop=True)


def _prepare_consolidado_dataframe(df: pd.DataFrame | None) -> pd.DataFrame | None:
    if df is None or df.empty:
        return df
    working = df.copy()
    fornecedor_col = _find_column(working, ["FORNECEDOR"], required=True)
    consolidado_col = _find_column(working, ["N CONSOLIDADO", "Nº CONSOLIDADO", "N CONSOLIDADO"], required=False)
    valor_col = _find_column(working, ["VALOR"], required=False)
    data_col = _find_column(working, ["DATA VENCTO"], required=False)

    if valor_col:
        working = _coerce_numeric_column(working, str(valor_col))
    if data_col:
        working = _coerce_datetime_column(working, str(data_col))

    if consolidado_col:
        working = working[working[consolidado_col].notna()]
    working = working[~working[fornecedor_col].astype(str).str.startswith("---")]
    if valor_col:
        working = working[working[valor_col].notna() & (working[valor_col] != 0)]
    return working.reset_index(drop=True)


def parse_orcamento_sheet(df_raw: pd.DataFrame) -> dict[str, pd.DataFrame]:
    content_columns = _first_content_columns(df_raw)
    if len(content_columns) < 9:
        return {"budget": pd.DataFrame(), "mapas": pd.DataFrame()}

    budget_df = df_raw.loc[:, content_columns[:9]].copy()
    descricao_col = _find_column(budget_df, ["DESCRICAO", "DESCRIÇÃO"], required=False)
    if descricao_col:
        budget_df = budget_df[budget_df[descricao_col].notna()].copy()
        budget_df = budget_df[budget_df[descricao_col].astype(str).str.strip() != ""].copy()

    return {
        "budget": budget_df.reset_index(drop=True),
        "mapas": pd.DataFrame(),
    }


def parse_orcado_realizado_sheet(df_raw: pd.DataFrame) -> pd.DataFrame:
    if df_raw.empty:
        return pd.DataFrame()

    working = _promote_matching_row_to_header(
        _clean_error_cells(df_raw),
        required_signals=["item subitem", "descricao", "verba total"],
    )
    if working is None or working.empty:
        return pd.DataFrame()

    working = _clean_excel_frame(working)
    item_col = _find_column(working, ["ITEM/SUBITEM", "ITEM SUBITEM", "ITEM"], required=False)
    descricao_col = _find_column(working, ["DESCRIÇÃO", "DESCRICAO"], required=False)
    verba_col = _find_column(
        working,
        ["VERBA TOTAL CUSTO DIRETO", "VERBA TOTAL CUSTO DIRETO SEM TAXA DE ADM", "VERBA TOTAL"],
        required=False,
    )

    if descricao_col is None or verba_col is None:
        return pd.DataFrame()

    rename_map: dict[str, str] = {}
    if item_col and item_col != "ITEM/SUBITEM":
        rename_map[item_col] = "ITEM/SUBITEM"
    if descricao_col != "DESCRIÇÃO":
        rename_map[descricao_col] = "DESCRIÇÃO"
    if verba_col != "VERBA TOTAL CUSTO DIRETO":
        rename_map[verba_col] = "VERBA TOTAL CUSTO DIRETO"
    if rename_map:
        working = working.rename(columns=rename_map)
        item_col = "ITEM/SUBITEM" if item_col else None
        descricao_col = "DESCRIÇÃO"
        verba_col = "VERBA TOTAL CUSTO DIRETO"

    month_columns = [column for column in working.columns if str(column).strip().isdigit()]
    if not month_columns:
        columns = list(working.columns)
        desembolso_col = _find_column(working, ["DESEMBOLSOS CONSOLIDADOS"], required=False)
        saldo_col = _find_column(working, ["SALDO A DESEMBOLSAR"], required=False)
        start_index = columns.index(desembolso_col) if desembolso_col in columns else 0
        end_index = columns.index(saldo_col) if saldo_col in columns else len(columns)
        fallback_columns = [
            column
            for column in columns[start_index:end_index]
            if column not in {item_col, descricao_col, verba_col}
        ]
        if fallback_columns:
            working = working.rename(columns={column: str(index + 1) for index, column in enumerate(fallback_columns)})
            month_columns = [column for column in working.columns if str(column).strip().isdigit()]

    if not month_columns:
        return pd.DataFrame()

    melted = working.melt(
        id_vars=[column for column in working.columns if column not in month_columns],
        value_vars=month_columns,
        var_name="PERIODO",
        value_name="DESEMBOLSO",
    )

    if item_col:
        melted = melted[melted[item_col].notna()].copy()
        melted = melted[melted[item_col].astype(str).str.strip() != ""].copy()

    melted["PERIODO"] = pd.to_numeric(melted["PERIODO"].astype(str), errors="coerce").astype("Int64")
    melted["DESEMBOLSO"] = melted["DESEMBOLSO"].apply(_parse_numeric_value)
    melted[verba_col] = melted[verba_col].apply(_parse_numeric_value)
    melted = melted.dropna(subset=["PERIODO", "DESEMBOLSO"]).reset_index(drop=True)
    return melted


def _fallback_structured_payload() -> dict[str, Any]:
    return {
        "nfs": [],
        "orcamento": {"budget": [], "mapas": []},
        "orcamento_flat": [],
        "orcado_realizado": [],
        "consolidado": [],
        "resumo": [],
        "resumo_meta": {},
    }


def _parse_nfs_sheet(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame:
    dataframe = _read_sheet(workbook_bytes, sheet_name, header=7)
    if dataframe is None or dataframe.empty:
        return pd.DataFrame()
    prepared = _prepare_nfs_dataframe(dataframe)
    return prepared if prepared is not None else pd.DataFrame()


def _parse_consolidado_sheet(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame:
    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=7) if sheet_name else pd.DataFrame()
    if dataframe.empty:
        return pd.DataFrame()

    dataframe = _clean_excel_frame(_clean_error_cells(dataframe))
    dataframe = _rename_columns_by_position(
        dataframe,
        {
            1: "NÂº CONSOLIDADO",
            2: "FORNECEDOR",
            3: "NF",
            4: "MAPA",
            5: "NATUREZA",
            6: "COND.PAGTO",
            7: "DATA VENCTO",
            8: "VALOR",
            9: "ITEM APROPRIAÃ‡ÃƒO",
            10: "VALOR APROPRIADO",
        },
    )
    coerced_valor = _coerce_numeric_column(dataframe, "VALOR")
    dataframe = coerced_valor if coerced_valor is not None else dataframe
    coerced_apropriado = _coerce_numeric_column(dataframe, "VALOR APROPRIADO")
    dataframe = coerced_apropriado if coerced_apropriado is not None else dataframe
    coerced_data = _coerce_datetime_column(dataframe, "DATA VENCTO")
    dataframe = coerced_data if coerced_data is not None else dataframe
    prepared = _prepare_consolidado_dataframe(dataframe)
    dataframe = prepared if prepared is not None else pd.DataFrame()
    return dataframe


def _parse_orcamento_flat_sheet(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame:
    dataframe = _read_sheet(workbook_bytes, sheet_name, header=8)
    if dataframe is None or dataframe.empty:
        return pd.DataFrame()
    return parse_orcamento_sheet(dataframe)["budget"]


def _parse_resumo_sheet(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame:
    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=7) if sheet_name else pd.DataFrame()
    if dataframe.empty:
        return pd.DataFrame()

    dataframe = _clean_error_cells(dataframe)
    promoted = _promote_matching_row_to_header(dataframe, ["consolidado", "total geral"], max_rows=6)
    if promoted is None or promoted.empty:
        return pd.DataFrame()

    working = _clean_excel_frame(promoted)
    for candidates in [
        ["MATERIAL/SERVICO", "MATERIAL/SERVIÇO"],
        ["MAO OBRA EMPREITADA", "MÃO OBRA EMPREITADA"],
        ["MAO OBRA TEMPO", "MÃO OBRA TEMPO"],
        ["STAFF"],
        ["SERVICO SEM TAXA ADM", "SERVIÇO SEM TAXA ADM"],
        ["TOTAL"],
        ["TAXA ADMINISTRACAO", "TAXA ADMINISTRAÇÃO"],
        ["%"],
        ["TOTAL GERAL"],
    ]:
        column_name = _find_column(working, candidates, required=False)
        if column_name:
            coerced = _coerce_numeric_column(working, column_name)
            working = coerced if coerced is not None else working

    for candidates in [["DATA VENCTO"], ["DATA RECBTO"], ["DATA RECBTº"]]:
        column_name = _find_column(working, candidates, required=False)
        if column_name:
            coerced = _coerce_datetime_column(working, column_name)
            working = coerced if coerced is not None else working

    total_geral_col = _find_column(working, ["TOTAL GERAL"], required=False)
    if total_geral_col:
        working[total_geral_col] = pd.to_numeric(working[total_geral_col], errors="coerce").fillna(0)

    return working.reset_index(drop=True)


def _parse_orcado_realizado_sheet_defensive(workbook_bytes: bytes, sheet_name: str | None) -> pd.DataFrame:
    if sheet_name is None:
        return pd.DataFrame()

    dataframe = pd.read_excel(BytesIO(workbook_bytes), sheet_name=sheet_name, header=7)
    dataframe = _clean_error_cells(dataframe)
    parsed = parse_orcado_realizado_sheet(dataframe)
    if not parsed.empty:
        return parsed

    fallback = _read_sheet(workbook_bytes, sheet_name, header=10)
    if fallback is None or fallback.empty:
        return pd.DataFrame()

    parsed = parse_orcado_realizado_sheet(fallback)
    if not parsed.empty:
        return parsed

    return pd.DataFrame()


def _build_structured_payload(
    sheets: dict[str, pd.DataFrame],
    resumo_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    sheet_names = list(sheets.keys())
    nfs_sheet = _match_sheet_name(sheet_names, ["PLANILHA NFs - Entrada de Dados", "PLANILHA NFs", "NFs"])
    orcamento_sheet = _match_sheet_name(sheet_names, ["PLANILHA ORÇAMENTO - Entrada de", "PLANILHA ORCAMENTO"])
    orcado_realizado_sheet = _match_sheet_name(sheet_names, ["PLANILHA ORÇADOxREALIZADO", "PLANILHA ORCADOxREALIZADO"])
    consolidado_sheet = _match_sheet_name(sheet_names, ["PLANILHA CONSOLIDADO", "CONSOLIDADO"])
    resumo_sheet = _match_sheet_name(sheet_names, ["RESUMO CONSOLIDADOS - CLIENTE", "RESUMO CONSOLIDADOS"])

    try:
        nfs_df = _prepare_nfs_dataframe(sheets.get(nfs_sheet)) if nfs_sheet else None
    except KeyError:
        nfs_df = sheets.get(nfs_sheet).copy() if nfs_sheet and nfs_sheet in sheets else None

    try:
        consolidado_df = _prepare_consolidado_dataframe(sheets.get(consolidado_sheet)) if consolidado_sheet else None
    except KeyError:
        consolidado_df = sheets.get(consolidado_sheet).copy() if consolidado_sheet and consolidado_sheet in sheets else None

    resumo_df = sheets.get(resumo_sheet).copy() if resumo_sheet and resumo_sheet in sheets else None
    if resumo_df is not None and not resumo_df.empty:
        resumo_df = _clean_error_cells(resumo_df)
        for candidates in [
            ["MATERIAL/SERVICO", "MATERIAL/SERVIÇO"],
            ["MAO OBRA EMPREITADA", "MÃO OBRA EMPREITADA"],
            ["MAO OBRA TEMPO", "MÃO OBRA TEMPO"],
            ["STAFF"],
            ["SERVICO SEM TAXA ADM", "SERVIÇO SEM TAXA ADM"],
            ["TOTAL"],
            ["TAXA ADMINISTRACAO", "TAXA ADMINISTRAÇÃO"],
            ["%"],
            ["TOTAL GERAL"],
        ]:
            column_name = _find_column(resumo_df, candidates, required=False)
            if column_name:
                resumo_df = _coerce_numeric_column(resumo_df, column_name)
        for candidates in [["DATA VENCTO"], ["DATA RECBTO"]]:
            column_name = _find_column(resumo_df, candidates, required=False)
            if column_name:
                resumo_df = _coerce_datetime_column(resumo_df, column_name)

    orcamento_raw = sheets.get(orcamento_sheet).copy() if orcamento_sheet and orcamento_sheet in sheets else None
    if isinstance(orcamento_raw, pd.DataFrame):
        orcamento_raw = _clean_error_cells(orcamento_raw)
    orcamento = parse_orcamento_sheet(orcamento_raw) if isinstance(orcamento_raw, pd.DataFrame) and not orcamento_raw.empty else {"budget": None, "mapas": None}

    orcado_realizado_raw = sheets.get(orcado_realizado_sheet).copy() if orcado_realizado_sheet and orcado_realizado_sheet in sheets else None
    if isinstance(orcado_realizado_raw, pd.DataFrame):
        orcado_realizado_raw = _clean_error_cells(orcado_realizado_raw)
    orcado_realizado = (
        parse_orcado_realizado_sheet(orcado_realizado_raw)
        if isinstance(orcado_realizado_raw, pd.DataFrame) and not orcado_realizado_raw.empty
        else None
    )

    return {
        "nfs": nfs_df,
        "orcamento": {
            "budget": orcamento["budget"] if isinstance(orcamento, dict) else None,
            "mapas": orcamento["mapas"] if isinstance(orcamento, dict) else None,
        },
        "orcado_realizado": orcado_realizado,
        "consolidado": consolidado_df,
        "resumo": resumo_df,
        "resumo_meta": resumo_meta or {},
    }


def build_structured_from_sheets(
    sheets: dict[str, pd.DataFrame],
    resumo_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _build_structured_payload(sheets, resumo_meta=resumo_meta)


def _parse_custos_workbook_bytes(workbook_bytes: bytes) -> dict[str, Any]:
    try:
        workbook = pd.ExcelFile(BytesIO(workbook_bytes))
        sheet_names = workbook.sheet_names

        nfs_sheet = _match_sheet_name(sheet_names, ["PLANILHA NFs - Entrada de Dados", "PLANILHA NFs", "NFs"])
        orcamento_sheet = _match_sheet_name(sheet_names, ["PLANILHA ORÇAMENTO - Entrada de", "PLANILHA ORCAMENTO"])
        orcado_realizado_sheet = _match_sheet_name(sheet_names, ["PLANILHA ORÇADOxREALIZADO", "PLANILHA ORCADOxREALIZADO"])
        consolidado_sheet = _match_sheet_name(sheet_names, ["PLANILHA CONSOLIDADO", "CONSOLIDADO"])
        resumo_sheet = _match_sheet_name(sheet_names, ["RESUMO CONSOLIDADOS - CLIENTE", "RESUMO CONSOLIDADOS"])
        resumo_raw = _read_sheet_raw(workbook_bytes, resumo_sheet)
        payload = _fallback_structured_payload()
        payload["resumo_meta"] = _extract_sheet_metadata(resumo_raw)

        try:
            payload["nfs"] = _parse_nfs_sheet(workbook_bytes, nfs_sheet)
        except Exception as exc:
            print(f"[custos_analyzer] Falha ao processar sheet NFs: {exc}")
            payload["nfs"] = []

        try:
            payload["consolidado"] = _parse_consolidado_sheet(workbook_bytes, consolidado_sheet)
        except Exception as exc:
            print(f"[custos_analyzer] Falha ao processar sheet Consolidado: {exc}")
            payload["consolidado"] = []

        try:
            payload["orcamento_flat"] = _parse_orcamento_flat_sheet(workbook_bytes, orcamento_sheet)
            payload["orcamento"] = {
                "budget": payload["orcamento_flat"],
                "mapas": [],
            }
        except Exception as exc:
            print(f"[custos_analyzer] Falha ao processar sheet Orcamento: {exc}")
            payload["orcamento_flat"] = []
            payload["orcamento"] = {"budget": [], "mapas": []}

        try:
            payload["orcado_realizado"] = _parse_orcado_realizado_sheet_defensive(workbook_bytes, orcado_realizado_sheet)
        except Exception as exc:
            print(f"[custos_analyzer] Falha ao processar sheet Orcado x Realizado: {exc}")
            payload["orcado_realizado"] = []

        try:
            payload["resumo"] = _parse_resumo_sheet(workbook_bytes, resumo_sheet)
        except Exception as exc:
            print(f"[custos_analyzer] Falha ao processar sheet Resumo: {exc}")
            payload["resumo"] = []

        return payload
    except Exception as exc:
        print(f"[custos_analyzer] Falha geral no parse estruturado de custos: {exc}")
        return _fallback_structured_payload()


def parse_custos_workbook_bytes(workbook_bytes: bytes) -> dict[str, Any]:
    return _parse_custos_workbook_bytes(workbook_bytes)


def parse_custos_workbook(path: str) -> dict[str, Any]:
    return _parse_custos_workbook_bytes(Path(path).read_bytes())


class CustosAnalyzer:
    def __init__(self, nfs: pd.DataFrame, consolidado: pd.DataFrame, meta: dict[str, Any] | None = None):
        self.nfs = nfs.copy()
        self.cons = consolidado.copy()
        self.meta = meta or {}
        self._ensure_types()

    def _ensure_types(self) -> None:
        for df in (self.nfs, self.cons):
            for col in ("Valor", "ValorItem", "SaldoPlanilha", "ApropriValor"):
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            for col in ("DataVencto",):
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce")

    def get_summary(self) -> dict[str, Any]:
        nfs = self.nfs
        total_valor = float(nfs["Valor"].sum()) if "Valor" in nfs.columns else 0
        total_nfs = len(nfs)
        unique_forn = int(nfs["Fornecedor"].nunique()) if "Fornecedor" in nfs.columns else 0
        unique_cons = int(nfs["NumConsolidado"].nunique()) if "NumConsolidado" in nfs.columns else 0

        avg_nf = total_valor / total_nfs if total_nfs > 0 else 0

        data_min = nfs["DataVencto"].min() if "DataVencto" in nfs.columns and nfs["DataVencto"].notna().any() else None
        data_max = nfs["DataVencto"].max() if "DataVencto" in nfs.columns and nfs["DataVencto"].notna().any() else None

        cons_total = float(self.cons["Valor"].sum()) if "Valor" in self.cons.columns else 0
        cons_count = len(self.cons)

        return {
            "obra": self.meta.get("Obra", ""),
            "endereco": self.meta.get("Endereco", ""),
            "periodo": self.meta.get("Periodo", ""),
            "total_nfs": total_nfs,
            "total_valor": round(total_valor, 2),
            "valor_medio_nf": round(avg_nf, 2),
            "unique_fornecedores": unique_forn,
            "unique_consolidados": unique_cons,
            "data_inicio": str(data_min.date()) if data_min is not None and pd.notna(data_min) else "",
            "data_fim": str(data_max.date()) if data_max is not None and pd.notna(data_max) else "",
            "consolidado_atual": {
                "total_nfs": cons_count,
                "total_valor": round(cons_total, 2),
            },
        }

    def get_fornecedor_ranking(self, limit: int = 20) -> list[dict[str, Any]]:
        if self.nfs.empty or "Fornecedor" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("Fornecedor")
            .agg(total_valor=("Valor", "sum"), qtd_nfs=("NF", "count"))
            .reset_index()
            .sort_values("total_valor", ascending=False)
            .head(limit)
        )
        total_geral = float(self.nfs["Valor"].sum()) if "Valor" in self.nfs.columns else 0.0
        return [
            {
                "fornecedor": str(row["Fornecedor"]),
                "total_valor": round(float(row["total_valor"]), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
                "pct_total": round(float(row["total_valor"]) / total_geral * 100, 1) if total_geral > 0 else 0.0,
            }
            for _, row in grouped.iterrows()
        ]

    def get_natureza_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "Natureza" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("Natureza")
            .agg(total_valor=("Valor", "sum"), qtd_nfs=("NF", "count"))
            .reset_index()
            .sort_values("total_valor", ascending=False)
        )
        return [
            {
                "natureza": str(row["Natureza"]),
                "total_valor": round(float(row["total_valor"]), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_pagamento_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "CondPagto" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("CondPagto")
            .agg(total_valor=("Valor", "sum"), qtd_nfs=("NF", "count"))
            .reset_index()
            .sort_values("total_valor", ascending=False)
        )
        return [
            {
                "metodo": str(row["CondPagto"]),
                "total_valor": round(float(row["total_valor"]), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_monthly_timeline(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "DataVencto" not in self.nfs.columns:
            return []
        working = self.nfs[self.nfs["DataVencto"].notna()].copy()
        if working.empty:
            return []
        working["MesAno"] = working["DataVencto"].dt.to_period("M").astype(str)
        grouped = (
            working.groupby("MesAno")
            .agg(total_valor=("Valor", "sum"), qtd_nfs=("NF", "count"), fornecedores=("Fornecedor", "nunique"))
            .reset_index()
            .sort_values("MesAno")
        )
        return [
            {
                "mes": str(row["MesAno"]),
                "total_valor": round(float(row["total_valor"]), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
                "fornecedores": int(row["fornecedores"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_consolidado_breakdown(self) -> list[dict[str, Any]]:
        if self.nfs.empty or "NumConsolidado" not in self.nfs.columns:
            return []
        grouped = (
            self.nfs.groupby("NumConsolidado")
            .agg(total_valor=("Valor", "sum"), qtd_nfs=("NF", "count"), fornecedores=("Fornecedor", "nunique"))
            .reset_index()
            .sort_values("NumConsolidado")
        )
        return [
            {
                "consolidado": str(row["NumConsolidado"]),
                "total_valor": round(float(row["total_valor"]), 2),
                "qtd_nfs": int(row["qtd_nfs"]),
                "fornecedores": int(row["fornecedores"]),
            }
            for _, row in grouped.iterrows()
        ]

    def get_top_nfs(self, limit: int = 20) -> list[dict[str, Any]]:
        if self.nfs.empty:
            return []
        top = self.nfs.nlargest(limit, "Valor") if "Valor" in self.nfs.columns else self.nfs.head(limit)
        return [
            {
                "fornecedor": str(row.get("Fornecedor", "")),
                "nf": str(row.get("NF", "")),
                "mapa": str(row.get("MapaPrecos", "")),
                "valor": round(float(row.get("Valor", 0)), 2) if pd.notna(row.get("Valor")) else 0.0,
                "data_vencto": str(row["DataVencto"].date()) if pd.notna(row.get("DataVencto")) else "",
                "cond_pagto": str(row.get("CondPagto", "")),
                "consolidado": str(row.get("NumConsolidado", "")),
            }
            for _, row in top.iterrows()
        ]

    def get_consolidado_detail(self) -> list[dict[str, Any]]:
        if self.cons.empty:
            return []
        return [
            {
                "num": str(row.get("NumConsolidado", "")),
                "fornecedor": str(row.get("Fornecedor", "")),
                "nf": str(row.get("NF", "")),
                "mapa": str(row.get("Mapa", "")),
                "natureza": str(row.get("Natureza", "")),
                "cond_pagto": str(row.get("CondPagto", "")),
                "data_vencto": str(row["DataVencto"].date()) if pd.notna(row.get("DataVencto")) else "",
                "valor": round(float(row.get("Valor", 0)), 2) if pd.notna(row.get("Valor")) else 0.0,
            }
            for _, row in self.cons.iterrows()
        ]

    def get_all_nfs(self) -> list[dict[str, Any]]:
        if self.nfs.empty:
            return []
        result: list[dict[str, Any]] = []
        for _, row in self.nfs.iterrows():
            fornecedor = str(row.get("Fornecedor") or "").strip()
            if not fornecedor:
                continue
            valor = row.get("Valor")
            data_vencto = row.get("DataVencto")
            result.append(
                {
                    "fornecedor": fornecedor,
                    "nf": str(row.get("NF") or ""),
                    "num_consolidado": str(row.get("NumConsolidado") or ""),
                    "mapa": str(row.get("MapaPrecos") or ""),
                    "natureza": str(row.get("Natureza") or ""),
                    "cond_pagto": str(row.get("CondPagto") or ""),
                    "data_vencto": str(data_vencto.date()) if pd.notna(data_vencto) else "",
                    "valor": round(float(valor), 2) if pd.notna(valor) else 0.0,
                }
            )
        return result

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
