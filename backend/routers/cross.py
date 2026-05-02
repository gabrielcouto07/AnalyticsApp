from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..services.cross_analyzer import build_cross_dataset, detect_common_project, run_cross_regression
from ..session import find_session_file, get_session
from ..utils.json_utils import json_safe


router = APIRouter(prefix="/api/cross", tags=["cross"])


def _get_cross_payload(session_id: str) -> dict:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    efetivo_file = find_session_file(session, "efetivo")
    medicao_file = find_session_file(session, "medicao")
    if efetivo_file is None or medicao_file is None:
        raise HTTPException(status_code=422, detail="Analise cruzada requer ao menos Efetivo e Medicao")

    medicao_payload = medicao_file.parsed_data.get("medicao") or {"metadata": medicao_file.metadata, "summary": {}}
    dataset = build_cross_dataset(efetivo_file.df, medicao_payload)
    linked_project = detect_common_project(
        efetivo_file.metadata or {"obra": ""},
        medicao_payload.get("metadata") or {},
    )
    return {
        "dataset": dataset,
        "linked": bool(linked_project),
        "project_code": linked_project,
        "confidence": 0.9 if linked_project else 0.0,
        "method": "obra_fuzzy" if linked_project else "none",
    }


@router.get("/{session_id}/linkage")
async def get_cross_linkage(session_id: str) -> dict:
    payload = _get_cross_payload(session_id)
    return json_safe(
        {
            "linked": payload["linked"],
            "project_code": payload["project_code"],
            "confidence": payload["confidence"],
            "method": payload["method"],
        }
    )


@router.get("/{session_id}/comparison")
async def get_cross_comparison(session_id: str) -> dict:
    payload = _get_cross_payload(session_id)
    dataset = payload["dataset"]
    return json_safe(
        {
            "efetivo_por_mes": dataset.get("efetivo_por_mes", []),
            "custo_projeto_negociado": dataset.get("custo_projeto_negociado", 0.0),
            "ratio_custo_por_diaria": dataset.get("ratio_custo_por_diaria", 0.0),
            "ratio_custo_por_mes": dataset.get("ratio_custo_por_mes", 0.0),
        }
    )


@router.get("/{session_id}/regression")
async def get_cross_regression(session_id: str) -> dict:
    payload = _get_cross_payload(session_id)
    return json_safe(run_cross_regression(payload["dataset"]))


@router.get("/{session_id}/dataset")
async def get_cross_dataset(session_id: str) -> dict:
    payload = _get_cross_payload(session_id)
    dataset = payload["dataset"]
    return json_safe(
        {
            "rows": dataset.get("rows", []),
            "columns": dataset.get("columns", []),
            "ready_for_regression": dataset.get("ready_for_regression", False),
        }
    )
