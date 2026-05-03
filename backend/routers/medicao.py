"""
Medição (BM / Proposta MP) endpoints.

Adapted from the GABRIEL branch to BACK-API's session model:
GABRIEL stores parsed payloads under `file_entry.parsed_data["medicao"]` because
its Session holds multiple FileEntry objects. BACK-API has a single Session per
upload, so we keep the parsed payload (metadata, summary, items, boletins,
quality_report, periods) inside `session.extras["medicao"]` instead.
"""
from __future__ import annotations

import json as _json
import math
from typing import Any

from fastapi import APIRouter, HTTPException

from ..session import get_session


router = APIRouter(prefix="/api/medicao", tags=["medicao"])


def _json_safe(value: Any) -> Any:
    """Replace NaN/inf with None and lists/dicts recursively. Mirrors
    GABRIEL's utils.json_utils.json_safe contract."""
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    return value


def _df_to_records(df) -> list[dict]:
    """DataFrame → list of dicts with NaN replaced by None."""
    if df is None:
        return []
    if hasattr(df, "to_json"):
        return _json.loads(df.to_json(orient="records", default_handler=str, force_ascii=False))
    if isinstance(df, list):
        return df
    return []


def _get_medicao_payload(session_id: str) -> dict:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if session.template_type != "medicao":
        raise HTTPException(status_code=422, detail="Sessão não contém dados de Medição")
    payload = session.extras.get("medicao")
    if not payload:
        raise HTTPException(status_code=422, detail="Payload de Medição ausente na sessão")
    return payload


@router.get("/{session_id}/summary")
async def get_medicao_summary(session_id: str) -> dict:
    payload = _get_medicao_payload(session_id)
    metadata = dict(payload.get("metadata") or {})
    summary = dict(payload.get("summary") or {})
    num_boletins = metadata.get("num_boletins") or summary.get("num_boletins") or 0
    return _json_safe({
        "metadata": {
            "obra": metadata.get("obra"),
            "assunto": metadata.get("assunto"),
            "fornecedor": metadata.get("fornecedor"),
            "data": metadata.get("data"),
            "contato": metadata.get("contato"),
            "telefone": metadata.get("telefone"),
            "email": metadata.get("email"),
            "endereco": metadata.get("endereco"),
            "periodo_medicao": metadata.get("periodo_medicao"),
            "vencimento": metadata.get("vencimento"),
            "num_boletins": num_boletins,
            "tipo_documento": metadata.get("tipo_documento") or summary.get("tipo_documento"),
            "recommended_view": "consolidado_e_boletins" if num_boletins > 1 else "proposta",
        },
        "boletins": payload.get("boletins") or [],
        **summary,
    })


@router.get("/{session_id}/items")
async def get_medicao_items(session_id: str) -> dict:
    payload = _get_medicao_payload(session_id)
    items = payload.get("items")
    return _json_safe({"items": _df_to_records(items)})


@router.get("/{session_id}/periods")
async def get_medicao_periods(session_id: str) -> dict:
    payload = _get_medicao_payload(session_id)
    periods = payload.get("periods") or payload.get("boletins") or []
    return _json_safe({"items": periods, "total": len(periods)})


@router.get("/{session_id}/quality")
async def get_medicao_quality(session_id: str) -> dict:
    payload = _get_medicao_payload(session_id)
    return _json_safe(payload.get("quality_report") or {})
