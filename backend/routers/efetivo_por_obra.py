from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..services.efetivo_analyzer import EfetivoAnalyzer
from ..session import Session, find_session_file, get_session
from ..utils.json_utils import json_safe


router = APIRouter(tags=["efetivo"])


def _get_session_or_404(session_id: str) -> Session:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    return session


def _get_efetivo_analyzer(session_id: str) -> EfetivoAnalyzer:
    session = _get_session_or_404(session_id)
    file_entry = find_session_file(session, "efetivo")
    if file_entry is None or file_entry.df.empty:
        raise HTTPException(status_code=422, detail="Arquivo nao contem dados de Efetivo")
    return EfetivoAnalyzer(file_entry.df)


@router.get("/{session_id}/summary")
async def get_efetivo_summary_endpoint(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    return json_safe(analyzer.get_summary())


@router.get("/{session_id}/by_supplier")
async def get_efetivo_by_supplier(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    return json_safe({"items": analyzer.get_by_supplier()})


@router.get("/{session_id}/by_function")
async def get_efetivo_by_function(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    return json_safe({"items": analyzer.get_by_function()})


@router.get("/{session_id}/monthly_evolution")
async def get_efetivo_monthly_evolution(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    return json_safe({"months": analyzer.get_monthly_evolution()})


@router.get("/{session_id}/calendar_heatmap")
async def get_efetivo_calendar_heatmap(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    return json_safe({"cells": analyzer.get_calendar_heatmap()})


@router.get("/{session_id}/detail")
async def get_efetivo_detail(
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=500),
) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    rows = analyzer.get_detail()
    start = (page - 1) * per_page
    items = rows[start : start + per_page]
    return json_safe({"items": items, "total": len(rows), "page": page, "per_page": per_page})


@router.get("/{session_id}/filial")
async def get_efetivo_filial(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    rows = analyzer.get_by_supplier()
    return json_safe({"items": rows, "total_funcionarios": len(rows)})


@router.get("/{session_id}/por_obra")
async def get_efetivo_por_obra(session_id: str) -> dict[str, Any]:
    analyzer = _get_efetivo_analyzer(session_id)
    summary = analyzer.get_summary()
    return json_safe(
        {
            "obras": [
                {
                    "obra": summary.get("obra", ""),
                    "headcount": summary.get("funcoes_distintas", 0),
                    "total_diarias": summary.get("total_diarias", 0),
                }
            ],
            "total_geral": {
                "headcount": summary.get("funcoes_distintas", 0),
                "total_diarias": summary.get("total_diarias", 0),
            },
        }
    )
