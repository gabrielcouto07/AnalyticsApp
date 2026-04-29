from __future__ import annotations

import re
import unicodedata
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..session import get_session
from ..utils.json_utils import _json_safe


router = APIRouter(prefix="/api/orcamento", tags=["orcamento"])


def _normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()


def _find_column(df: pd.DataFrame, candidates: list[str], required: bool = True) -> str | None:
    normalized_map = {_normalize_text(column): column for column in df.columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        for normalized_name, original_name in normalized_map.items():
            if normalized_candidate == normalized_name:
                return original_name
    if required:
        raise HTTPException(status_code=422, detail=f"Coluna esperada nao encontrada: {', '.join(candidates)}")
    return None


def _has_budget_columns(df: pd.DataFrame) -> bool:
    if not isinstance(df, pd.DataFrame) or df.empty:
        return False
    try:
        return bool(_find_column(df, ["ITEM"], required=False)) and bool(_find_column(df, ["CUSTO TOTAL"], required=False))
    except HTTPException:
        return False


def _get_session_or_404(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _get_flat_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    candidates = [
        session.df,
        session.extras.get("flat"),
        session.extras.get("orcamento_budget"),
        session.extras.get("budget"),
    ]
    for frame in candidates:
        if _has_budget_columns(frame):
            return frame.copy()
    raise HTTPException(status_code=422, detail="Dados de orcamento nao estao disponiveis nesta sessao")


def _get_mapas_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    candidates = [session.extras.get("mapas"), session.extras.get("orcamento_mapas")]
    for frame in candidates:
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame.copy()
    raise HTTPException(status_code=422, detail="Dados de mapas nao estao disponiveis nesta sessao")


@router.get("/{session_id}/flat")
async def get_orcamento_flat(session_id: str) -> list[dict[str, Any]]:
    frame = _get_flat_frame(session_id)
    return _json_safe(frame.to_dict(orient="records"))


@router.get("/{session_id}/mapas")
async def get_orcamento_mapas(session_id: str) -> list[dict[str, Any]]:
    try:
        frame = _get_mapas_frame(session_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise
        return []
    item_col = _find_column(frame, ["ITEM"])
    subitem_col = _find_column(frame, ["SUBITEM"], required=False)
    mapa_col = _find_column(frame, ["MAPA", "MAPA_NUM", "MAPA NUM"])
    valor_col = _find_column(frame, ["VALOR_MAPA", "VALOR ALOCADO", "VALOR_ALOCADO"])

    normalized = pd.DataFrame(
        {
            "ITEM": frame[item_col],
            "SUBITEM": frame[subitem_col] if subitem_col else None,
            "MAPA": frame[mapa_col],
            "VALOR_MAPA": pd.to_numeric(frame[valor_col], errors="coerce"),
        }
    )
    normalized = normalized.dropna(subset=["VALOR_MAPA"])
    normalized = normalized[normalized["VALOR_MAPA"] != 0]
    return _json_safe(normalized.to_dict(orient="records"))
