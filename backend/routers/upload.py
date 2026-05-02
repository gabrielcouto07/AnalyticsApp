from __future__ import annotations

import json as _json
import logging
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from ..services.analytics import calculate_kpis
from ..services.cross_analyzer import build_cross_dataset
from ..services.custos_parser import parse_custos_file
from ..services.custos_template import detect_custos_file
from ..services.data_quality import build_quality_report, merge_quality_reports
from ..services.efetivo_parser import parse_efetivo_workbook
from ..services.medicao_analyzer import parse_medicao_workbook
from ..services.orcamento_parser import parse_orcamento_file
from ..services.orcamento_template import detect_orcamento_file
from ..services.parser import load_dataframe, load_file_bundle
from ..services.schema_detector import detect_schema
from ..session import append_file_to_session, create_session, find_session_file, get_session


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["upload"])

TABULAR_EXTENSIONS = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json"}


def _safe_preview(df: pd.DataFrame) -> list[dict[str, Any]]:
    return _json.loads(df.head(10).to_json(orient="records", default_handler=str, force_ascii=False))


def _pick_template_type(schema_types: list[str]) -> str:
    for candidate in ("efetivo", "medicao", "custos", "orcamento"):
        if candidate in schema_types:
            return candidate
    return "generic"


def choose_primary_template(
    schema_types: list[str],
    *,
    custos_nfs_rows: int = 0,
    custos_consolidado_rows: int = 0,
    custos_resumo_rows: int = 0,
    orcamento_budget_rows: int = 0,
    orcamento_mapas_rows: int = 0,
    orcado_realizado_rows: int = 0,
) -> str:
    priority_candidates = [schema for schema in schema_types if schema in {"efetivo", "medicao", "custos", "orcamento"}]
    if not priority_candidates:
        return "generic"
    if "efetivo" in priority_candidates:
        return "efetivo"
    if "medicao" in priority_candidates:
        return "medicao"
    if {"custos", "orcamento"} <= set(priority_candidates):
        financial_score = (
            custos_nfs_rows
            + (custos_consolidado_rows * 1.4)
            + (custos_resumo_rows * 1.8)
        )
        budget_score = (
            (orcamento_budget_rows * 1.3)
            + min(orcamento_mapas_rows, max(orcamento_budget_rows * 2, 1)) * 0.25
            + (orcado_realizado_rows * 1.1)
        )
        return "orcamento" if budget_score > financial_score * 1.1 else "custos"
    return priority_candidates[0]


def _first_non_empty(dataframes: list[pd.DataFrame | None]) -> pd.DataFrame:
    for dataframe in dataframes:
        if isinstance(dataframe, pd.DataFrame) and not dataframe.empty:
            return dataframe
    return pd.DataFrame()


def _row_count(dataframe: Any) -> int:
    return int(len(dataframe)) if isinstance(dataframe, pd.DataFrame) else 0


def _build_custos_payload(workbook_bytes: bytes, filename: str) -> tuple[pd.DataFrame, dict[str, Any], dict[str, Any]]:
    custos_result = parse_custos_file(workbook_bytes, filename)
    orcamento_result = parse_orcamento_file(workbook_bytes, filename)
    structured_data = {
        "nfs": custos_result.get("nfs"),
        "consolidado": custos_result.get("consolidado"),
        "resumo": custos_result.get("resumo"),
        "orcado_realizado": custos_result.get("orcado_realizado"),
        "orcamento": {
            "budget": orcamento_result.get("flat"),
            "mapas": orcamento_result.get("mapas"),
        },
    }
    session_df = _first_non_empty(
        [
            custos_result.get("nfs"),
            orcamento_result.get("flat"),
            custos_result.get("consolidado"),
        ]
    )
    extras = {
        "structured_data": structured_data,
        "custos_meta": custos_result.get("meta") or {},
        "resumo_meta": custos_result.get("meta") or {},
        "nfs": custos_result.get("nfs"),
        "consolidado": custos_result.get("consolidado"),
        "resumo": custos_result.get("resumo"),
        "flat": orcamento_result.get("flat"),
        "mapas": orcamento_result.get("mapas"),
        "orcamento_budget": orcamento_result.get("flat"),
        "orcamento_mapas": orcamento_result.get("mapas"),
        "orcado_realizado": custos_result.get("orcado_realizado"),
    }
    parsed_data = {
        "custos": {
            "structured_data": structured_data,
            "metadata": custos_result.get("meta") or {},
            "quality_reports": custos_result.get("quality_reports") or {},
        }
    }
    quality_report = merge_quality_reports(list((custos_result.get("quality_reports") or {}).values()))
    return session_df, {"metadata": custos_result.get("meta") or {}, "quality_report": quality_report}, {**extras, "parsed_data": parsed_data}


def _resolve_primary_upload(content: bytes, filename: str) -> tuple[pd.DataFrame, dict[str, pd.DataFrame], list[str]]:
    extension = Path(filename).suffix.lower()
    if extension in TABULAR_EXTENSIONS:
        primary_df, sheets, detected_sheets, _ = load_file_bundle(content, filename)
        return primary_df, sheets, detected_sheets
    primary_df, _, _ = load_dataframe(content, filename)
    sheet_name = Path(filename).stem or "Sheet1"
    return primary_df, {sheet_name: primary_df.copy()}, [sheet_name]


def _recompute_cross_data(session_id: str) -> None:
    session = get_session(session_id)
    if session is None:
        return
    efetivo_file = find_session_file(session, "efetivo")
    medicao_file = find_session_file(session, "medicao")
    if efetivo_file is None or medicao_file is None:
        session.cross_data = None
        return
    medicao_payload = medicao_file.parsed_data.get("medicao") or {}
    session.cross_data = build_cross_dataset(efetivo_file.df, medicao_payload)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    session_id: str | None = Form(None),
    force_template: str | None = Query(None, pattern="^(efetivo|medicao|orcamento|custos|generic)$"),
) -> dict[str, Any]:
    allowed = {".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".json", ".pdf", ".sql", ".docx"}
    filename = file.filename or "arquivo"
    extension = Path(filename).suffix.lower()
    if extension not in allowed:
        raise HTTPException(status_code=400, detail=f"Formato nao suportado: {extension}")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    try:
        primary_df, sheets, detected_sheets = _resolve_primary_upload(content, filename)
        detected_schema = detect_schema(sheets, filename=filename)
        if extension in {".xlsx", ".xls", ".xlsm"}:
            if detect_custos_file(content, filename) and "custos" not in detected_schema:
                detected_schema.append("custos")
            if detect_orcamento_file(content, filename) and "orcamento" not in detected_schema:
                detected_schema.append("orcamento")
        session_df = primary_df
        template_type = choose_primary_template(detected_schema)
        extras: dict[str, Any] = {}
        parsed_data: dict[str, Any] = {}
        metadata: dict[str, Any] = {"filename": filename}
        quality_report = build_quality_report(sheets).to_dict()
        has_medicao_schema = force_template == "medicao" or "medicao" in detected_schema

        if extension in {".xlsx", ".xls", ".xlsm"} and (force_template == "efetivo" or "efetivo" in detected_schema):
            efetivo_payload = parse_efetivo_workbook(content, filename)
            if not efetivo_payload["records"].empty:
                session_df = efetivo_payload["records"]
                parsed_data["efetivo"] = efetivo_payload
                metadata = {**metadata, **(efetivo_payload.get("metadata") or {})}
                quality_report = efetivo_payload.get("quality_report") or quality_report
                extras["consulta_lookup"] = efetivo_payload.get("consulta_lookup") or {}
                template_type = "efetivo" if force_template in {None, "efetivo"} else template_type

        if extension in {".xlsx", ".xls", ".xlsm"} and has_medicao_schema:
            medicao_payload = parse_medicao_workbook(content, filename)
            if not medicao_payload["items"].empty:
                if session_df.empty or template_type == "generic" or force_template == "medicao":
                    session_df = medicao_payload["items"]
                parsed_data["medicao"] = medicao_payload
                metadata = {**metadata, **(medicao_payload.get("metadata") or {})}
                quality_report = medicao_payload.get("quality_report") or quality_report
                if force_template == "medicao" or template_type == "generic":
                    template_type = "medicao"

        has_custos_or_orcamento = bool(({force_template} & {"custos", "orcamento"}) or {"custos", "orcamento"} & set(detected_schema))
        if extension in {".xlsx", ".xls", ".xlsm"} and has_custos_or_orcamento and not has_medicao_schema:
            custos_df, custos_meta, custos_payload = _build_custos_payload(content, filename)
            if not custos_df.empty and (session_df.empty or template_type in {"generic", "custos", "orcamento"}):
                session_df = custos_df
            parsed_data.update(custos_payload.pop("parsed_data"))
            extras.update(custos_payload)
            metadata = {**metadata, **custos_meta.get("metadata", {})}
            quality_report = custos_meta.get("quality_report") or quality_report
            recommended_financial_view = choose_primary_template(
                detected_schema,
                custos_nfs_rows=_row_count(custos_payload.get("nfs")),
                custos_consolidado_rows=_row_count(custos_payload.get("consolidado")),
                custos_resumo_rows=_row_count(custos_payload.get("resumo")),
                orcamento_budget_rows=_row_count(custos_payload.get("flat")),
                orcamento_mapas_rows=_row_count(custos_payload.get("mapas")),
                orcado_realizado_rows=_row_count(custos_payload.get("orcado_realizado")),
            )
            metadata["recommended_dashboard"] = recommended_financial_view
            if force_template in {"custos", "orcamento"}:
                template_type = force_template
            elif {"custos", "orcamento"} & set(detected_schema):
                template_type = recommended_financial_view

        if session_df.empty:
            session_df = primary_df
        if session_df.empty:
            raise HTTPException(status_code=422, detail="Arquivo processado sem registros")

        merged_schema_types = list(dict.fromkeys(([template_type] if template_type != "generic" else []) + detected_schema))
        if len(merged_schema_types) > 1 and "generic" in merged_schema_types:
            merged_schema_types = [schema for schema in merged_schema_types if schema != "generic"]
        if not merged_schema_types:
            merged_schema_types = ["generic"]

        if session_id:
            existing = get_session(session_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Sessao nao encontrada para anexar arquivo")
            append_file_to_session(
                session_id=session_id,
                df=session_df,
                sheets=sheets,
                filename=filename,
                detected_sheets=detected_sheets,
                template_type=template_type,
                extras=extras,
                schema_types=merged_schema_types,
                metadata=metadata,
                quality_report=quality_report,
                parsed_data=parsed_data,
            )
            response_session_id = session_id
        else:
            response_session_id = create_session(
                df=session_df,
                sheets=sheets,
                filename=filename,
                detected_sheets=detected_sheets,
                template_type=template_type,
                extras=extras,
                schema_types=merged_schema_types,
                metadata=metadata,
                quality_report=quality_report,
                parsed_data=parsed_data,
            )

        _recompute_cross_data(response_session_id)
        stored_session = get_session(response_session_id)
        if stored_session is not None:
            stored_session.schema_types = list(dict.fromkeys(stored_session.schema_types))
            calculate_kpis(session_df)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erro ao processar upload %s", filename)
        raise HTTPException(status_code=422, detail=f"Erro ao processar arquivo: {exc}") from exc

    return {
        "session_id": response_session_id,
        "filename": filename,
        "rows": int(len(session_df)),
        "columns": int(len(session_df.columns)),
        "template": template_type,
        "schema_types": stored_session.schema_types if stored_session is not None else merged_schema_types,
        "detected_schema": merged_schema_types,
        "detected_sheets": detected_sheets,
        "data_quality": quality_report,
        "preview": _safe_preview(session_df),
    }
