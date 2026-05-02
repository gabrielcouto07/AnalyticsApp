from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..session import get_session
from ..utils.json_utils import json_safe


router = APIRouter(prefix="/api/quality", tags=["quality"])


@router.get("/{session_id}")
async def get_quality_report(session_id: str) -> dict:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    if session.files:
        latest = session.files[-1]
        return json_safe(latest.quality_report)
    return json_safe({})
