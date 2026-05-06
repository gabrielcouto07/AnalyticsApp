"""
Medicao router — endpoints for Boletim de Medição analysis.

Routes live at /api/medicao/{session_id}/{endpoint} (separate from /api/templates/).
The ERP backend proxies these via AnalyticsController::medicaoProxy().
"""

from fastapi import APIRouter, HTTPException
from ..session import get_session_extra
from ..services.medicao_analyzer import MedicaoAnalyzer

router = APIRouter(prefix="/api/medicao", tags=["medicao"])


def _get_data(session_id: str) -> dict:
    data = get_session_extra(session_id, "medicao_data")
    if data is None:
        raise HTTPException(404, "Session not found or not a medicao file")
    return data


@router.get("/{session_id}/summary")
async def get_medicao_summary(session_id: str):
    return MedicaoAnalyzer(_get_data(session_id)).get_summary()


@router.get("/{session_id}/items")
async def get_medicao_items(session_id: str):
    return MedicaoAnalyzer(_get_data(session_id)).get_items()


@router.get("/{session_id}/quality")
async def get_medicao_quality(session_id: str):
    return MedicaoAnalyzer(_get_data(session_id)).get_quality()
