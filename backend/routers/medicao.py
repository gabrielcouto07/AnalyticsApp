from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..session import Session, find_session_file, get_session
from ..utils.json_utils import json_safe


router = APIRouter(prefix="/api/medicao", tags=["medicao"])


def _get_medicao_file(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    file_entry = find_session_file(session, "medicao")
    if file_entry is None:
        raise HTTPException(status_code=422, detail="Arquivo nao contem dados de Medicao")
    return file_entry


@router.get("/{session_id}/summary")
async def get_medicao_summary(session_id: str) -> dict:
    file_entry = _get_medicao_file(session_id)
    parsed = file_entry.parsed_data.get("medicao") or {}
    metadata = dict(parsed.get("metadata") or file_entry.metadata or {})
    summary = dict(parsed.get("summary") or {})
    return json_safe(
        {
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
                "num_boletins": metadata.get("num_boletins"),
                "tipo_documento": metadata.get("tipo_documento"),
                "recommended_view": "consolidado_e_boletins" if (metadata.get("num_boletins") or 0) > 1 else "proposta",
            },
            "boletins": parsed.get("boletins", []),
            **summary,
        }
    )


@router.get("/{session_id}/items")
async def get_medicao_items(session_id: str) -> dict:
    file_entry = _get_medicao_file(session_id)
    parsed = file_entry.parsed_data.get("medicao") or {}
    items = parsed.get("items", file_entry.df)
    return json_safe({"items": items})


@router.get("/{session_id}/periods")
async def get_medicao_periods(session_id: str) -> dict:
    file_entry = _get_medicao_file(session_id)
    parsed = file_entry.parsed_data.get("medicao") or {}
    periods = parsed.get("periods") or parsed.get("boletins") or []
    return json_safe({"items": periods, "total": len(periods)})


@router.get("/{session_id}/quality")
async def get_medicao_quality(session_id: str) -> dict:
    file_entry = _get_medicao_file(session_id)
    return json_safe(file_entry.quality_report)
