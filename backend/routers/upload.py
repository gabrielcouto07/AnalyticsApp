from __future__ import annotations

import json as _json
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from ..session import create_session, get_session
from ..services.analytics import calculate_kpis
from ..services.custos_parser import parse_custos_file
from ..services.custos_template import detect_custos_file
from ..services.efetivo_parser import parse_efetivo_file
from ..services.efetivo_template import detect_efetivo_file
from ..services.orcamento_parser import parse_orcamento_file
from ..services.parser import detect_format, get_col_types, load_dataframe, load_file_bundle
from ..services.schema_detector import detect_schema


router = APIRouter(prefix="/api", tags=["upload"])


def _safe_preview(df: pd.DataFrame) -> list[dict[str, Any]]:
    return _json.loads(df.head(10).to_json(orient="records", default_handler=str, force_ascii=False))


def _pick_template_type(schema_types: list[str]) -> str:
    for candidate in ("efetivo", "custos", "orcamento"):
        if candidate in schema_types:
            return candidate
    return "generic"


def _has_records(dataframe: Any) -> bool:
    return isinstance(dataframe, pd.DataFrame) and not dataframe.empty


def _first_non_empty(dataframes: list[pd.DataFrame | None]) -> pd.DataFrame:
    for dataframe in dataframes:
        if isinstance(dataframe, pd.DataFrame) and not dataframe.empty:
            return dataframe
    return pd.DataFrame()


def _build_structured_extras(workbook_bytes: bytes, filename: str) -> dict[str, Any]:
    custos_result = parse_custos_file(workbook_bytes, filename)
    orcamento_result = parse_orcamento_file(workbook_bytes, filename)
    meta = custos_result.get("meta") or {}
    structured_data = {
        "nfs": custos_result.get("nfs"),
        "consolidado": custos_result.get("consolidado"),
        "resumo": custos_result.get("resumo"),
        "orcado_realizado": custos_result.get("orcado_realizado"),
        "orcamento": {
            "budget": orcamento_result.get("flat"),
            "mapas": orcamento_result.get("mapas"),
        },
        "resumo_meta": meta,
    }
    return {
        "structured_data": structured_data,
        "custos_meta": meta,
        "resumo_meta": meta,
        "nfs": custos_result.get("nfs"),
        "consolidado": custos_result.get("consolidado"),
        "resumo": custos_result.get("resumo"),
        "flat": orcamento_result.get("flat"),
        "mapas": orcamento_result.get("mapas"),
        "orcamento_budget": orcamento_result.get("flat"),
        "orcamento_mapas": orcamento_result.get("mapas"),
        "orcado_realizado": custos_result.get("orcado_realizado"),
    }


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    force_template: str | None = Query(None, pattern="^(efetivo|orcamento|custos|generic)$"),
) -> dict[str, Any]:
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed:
        raise HTTPException(status_code=400, detail=f"Formato nao suportado: {extension}")

    try:
        content = await file.read()
        detected_format = detect_format(file.filename or "arquivo", content)

        if extension in {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json"}:
            primary_df, sheets, detected_sheets, detected_format = load_file_bundle(content, file.filename or "arquivo")
        else:
            primary_df, _, _ = load_dataframe(content, file.filename or "arquivo")
            sheet_name = Path(file.filename or "arquivo").stem or "Sheet1"
            sheets = {sheet_name: primary_df.copy()}
            detected_sheets = [sheet_name]

        schema_types = detect_schema(sheets)
        custos_detected = extension in {".xlsx", ".xls", ".xlsm"} and detect_custos_file(content, file.filename or "")
        template_type = _pick_template_type(schema_types)
        session_df = primary_df
        extras: dict[str, Any] = {}

        if force_template == "efetivo" or (
            extension in {".xlsx", ".xls", ".xlsm"} and detect_efetivo_file(content, file.filename or "")
        ):
            parsed_df = parse_efetivo_file(content, file.filename or "")
            if parsed_df.empty:
                raise HTTPException(status_code=422, detail="Efetivo file parsed but returned no records")
            session_df = parsed_df
            template_type = "efetivo"

        elif force_template == "orcamento" and extension in {".xlsx", ".xls", ".xlsm"} and (
            custos_detected or "custos" in schema_types or "orcamento" in schema_types
        ):
            extras = _build_structured_extras(content, file.filename or "")
            if _has_records(extras.get("nfs")) or _has_records(extras.get("consolidado")):
                schema_types = list(dict.fromkeys(schema_types + ["custos"]))
            if _has_records(extras.get("flat")):
                schema_types = list(dict.fromkeys(schema_types + ["orcamento"]))
            session_df = _first_non_empty(
                [
                    extras.get("flat"),
                    extras.get("nfs"),
                    extras.get("consolidado"),
                    primary_df,
                ]
            )
            if session_df.empty:
                raise HTTPException(status_code=422, detail="Workbook parsed but returned no compatible records")
            template_type = "orcamento"

        elif force_template == "orcamento":
            parsed = parse_orcamento_file(content, file.filename or "")
            session_df = parsed["flat"]
            if session_df.empty:
                raise HTTPException(status_code=422, detail="Orcamento file parsed but returned no records")
            extras = {
                "flat": parsed.get("flat"),
                "mapas": parsed.get("mapas"),
            }
            template_type = "orcamento"

        elif force_template == "custos" or (
            extension in {".xlsx", ".xls", ".xlsm"} and (custos_detected or "custos" in schema_types or "orcamento" in schema_types)
        ):
            extras = _build_structured_extras(content, file.filename or "")
            if _has_records(extras.get("nfs")) or _has_records(extras.get("consolidado")):
                schema_types = list(dict.fromkeys(schema_types + ["custos"]))
            if _has_records(extras.get("flat")):
                schema_types = list(dict.fromkeys(schema_types + ["orcamento"]))
            session_df = _first_non_empty(
                [
                    extras.get("nfs"),
                    extras.get("flat"),
                    extras.get("consolidado"),
                    primary_df,
                ]
            )
            if session_df.empty:
                raise HTTPException(status_code=422, detail="Workbook parsed but returned no compatible records")
            if force_template == "custos":
                template_type = "custos"
            elif force_template == "orcamento":
                template_type = "orcamento"
            elif "custos" in schema_types:
                template_type = "custos"
            elif "orcamento" in schema_types:
                template_type = "orcamento"

        if session_df.empty:
            raise HTTPException(status_code=422, detail="Arquivo processado sem registros")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Erro ao processar arquivo: {exc}") from exc

    merged_schema_types = list(dict.fromkeys(([template_type] if template_type != "generic" else []) + schema_types))
    if not merged_schema_types:
        merged_schema_types = ["generic"]
    if len(merged_schema_types) > 1 and "generic" in merged_schema_types:
        merged_schema_types = [schema for schema in merged_schema_types if schema != "generic"]

    col_types = {str(key): value for key, value in get_col_types(session_df).items()}
    session_id = create_session(
        session_df,
        sheets=sheets,
        filename=file.filename or "",
        detected_sheets=detected_sheets,
        template_type=template_type,
        extras=extras,
        schema_types=merged_schema_types,
    )
    session = get_session(session_id)
    if session is not None:
        calculate_kpis(session_df)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": int(len(session_df)),
        "columns": int(len(session_df.columns)),
        "col_types": col_types,
        "template": template_type,
        "format": detected_format,
        "schema_types": merged_schema_types,
        "detected_schema": merged_schema_types,
        "detected_sheets": detected_sheets,
        "available_sheets": detected_sheets,
        "preview": _safe_preview(session_df),
    }
