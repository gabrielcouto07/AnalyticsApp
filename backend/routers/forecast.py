from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..services.custos_analyzer import canonicalize_consolidado_frame, canonicalize_nfs_frame
from ..services.forecasting import forecast_custos, forecast_efetivo
from ..session import Session, get_session
from ..utils.json_utils import json_safe


router = APIRouter(tags=["forecast"])


def _get_session_or_404(session_id: str) -> Session:
    """Obtém a sessão atual ou retorna erro 404."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session


def _structured_data(session: Session) -> dict[str, Any]:
    """Extrai dados estruturados do upload quando disponíveis."""
    structured = session.extras.get("structured_data")
    return structured if isinstance(structured, dict) else {}


def _first_non_empty_frame(candidates: list[Any], canonicalizer: Any) -> pd.DataFrame:
    """Retorna o primeiro DataFrame canônico não vazio."""
    for candidate in candidates:
        frame = canonicalizer(candidate)
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame
    return canonicalizer(None)


def _get_nfs_frame(session: Session) -> pd.DataFrame:
    """Obtém a fonte de NFs para previsão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("nfs"), session.extras.get("nfs"), session.df],
        canonicalize_nfs_frame,
    )


def _get_consolidado_frame(session: Session) -> pd.DataFrame:
    """Obtém a fonte consolidada para previsão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("consolidado"), session.extras.get("consolidado")],
        canonicalize_consolidado_frame,
    )


def _has_efetivo_data(session: Session) -> bool:
    """Indica se a sessão contém dados de Efetivo."""
    return "efetivo" in session.schema_types or {"Periodo", "Quantidade"}.issubset(session.df.columns)


def _has_custos_data(session: Session) -> bool:
    """Indica se a sessão contém dados de Custos."""
    nfs = _get_nfs_frame(session)
    return "custos" in session.schema_types or (not nfs.empty and "valor" in nfs.columns)


def _highlight_from_result(label: str, result: dict[str, Any]) -> dict[str, Any] | None:
    """Monta um card de destaque a partir de uma previsão."""
    historical = result.get("historical") if isinstance(result, dict) else None
    forecast = result.get("forecast") if isinstance(result, dict) else None
    if not isinstance(historical, list) or not historical or not isinstance(forecast, list) or not forecast:
        return None
    current = float(historical[-1].get("value") or 0)
    forecast_value = float(forecast[0].get("value") or 0)
    variation = ((forecast_value - current) / abs(current) * 100) if current else 0.0
    return {
        "label": label,
        "current": round(current, 2),
        "forecast": round(forecast_value, 2),
        "variacao_pct": round(variation, 2),
        "trend": result.get("trend", "estável"),
    }


@router.get("/{session_id}/efetivo")
async def get_forecast_efetivo(
    session_id: str,
    periods: int = Query(3, ge=1, le=12),
    method: str = Query("exponential_smoothing", pattern="^(linear|exponential_smoothing|moving_average)$"),
) -> dict[str, Any]:
    """Retorna previsão de Efetivo para a sessão."""
    session = _get_session_or_404(session_id)
    if not _has_efetivo_data(session):
        raise HTTPException(status_code=422, detail="Arquivo não contém dados de Efetivo")
    result = forecast_efetivo(session.df, periods=periods, method=method)
    return json_safe(
        {
            "headcount_geral": result["headcount_geral"],
            "por_cargo": result["por_cargo"],
            "alertas": result["alertas"],
        }
    )


@router.get("/{session_id}/custos")
async def get_forecast_custos(
    session_id: str,
    periods: int = Query(3, ge=1, le=12),
    method: str = Query("exponential_smoothing", pattern="^(linear|exponential_smoothing|moving_average)$"),
) -> dict[str, Any]:
    """Retorna previsão de Custos para a sessão."""
    session = _get_session_or_404(session_id)
    if not _has_custos_data(session):
        raise HTTPException(status_code=422, detail="Arquivo não contém dados de Custos")
    result = forecast_custos(_get_nfs_frame(session), _get_consolidado_frame(session), periods=periods, method=method)
    return json_safe(
        {
            "total": result["previsao_total"],
            "por_natureza": result["previsao_por_natureza"],
            "alertas": result["alertas"],
        }
    )


@router.get("/{session_id}/summary")
async def get_forecast_summary(session_id: str) -> dict[str, Any]:
    """Retorna resumo de previsões disponíveis para qualquer schema."""
    session = _get_session_or_404(session_id)
    available: list[str] = []
    highlights: list[dict[str, Any]] = []
    next_period_label = ""

    if _has_efetivo_data(session):
        efetivo_result = forecast_efetivo(session.df, periods=1)
        available.append("efetivo")
        highlight = _highlight_from_result("Headcount previsto", efetivo_result["headcount_geral"])
        if highlight is not None:
            highlights.append(highlight)
            forecast = efetivo_result["headcount_geral"].get("forecast", [])
            if forecast and not next_period_label:
                next_period_label = str(forecast[0].get("label", ""))

    if _has_custos_data(session):
        custos_result = forecast_custos(_get_nfs_frame(session), _get_consolidado_frame(session), periods=1)
        available.append("custos")
        highlight = _highlight_from_result("Custo previsto", custos_result["previsao_total"])
        if highlight is not None:
            highlights.append(highlight)
            forecast = custos_result["previsao_total"].get("forecast", [])
            if forecast and not next_period_label:
                next_period_label = str(forecast[0].get("label", ""))

    if not next_period_label:
        next_month = pd.Timestamp.today().to_period("M") + 1
        next_period_label = f"{next_month.month}/{next_month.year}"

    return json_safe(
        {
            "available_forecasts": available,
            "next_period_label": next_period_label,
            "highlights": highlights,
        }
    )
