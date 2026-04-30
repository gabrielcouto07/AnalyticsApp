from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..services.custos_analyzer import (
    canonicalize_budget_frame,
    canonicalize_mapas_frame,
    canonicalize_orcado_realizado_frame,
)
from ..session import Session, get_session
from ..utils.json_utils import json_safe


router = APIRouter(tags=["orcamento"])


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


def _get_budget_frame(session: Session) -> pd.DataFrame:
    """Obtém o orçamento estruturado da sessão."""
    structured = _structured_data(session)
    orcamento = structured.get("orcamento") if isinstance(structured.get("orcamento"), dict) else {}
    return _first_non_empty_frame(
        [orcamento.get("budget"), session.extras.get("orcamento_budget"), session.extras.get("flat"), session.df],
        canonicalize_budget_frame,
    )


def _get_mapas_frame(session: Session) -> pd.DataFrame:
    """Obtém os mapas de compra pivotados da sessão."""
    structured = _structured_data(session)
    orcamento = structured.get("orcamento") if isinstance(structured.get("orcamento"), dict) else {}
    return _first_non_empty_frame(
        [orcamento.get("mapas"), session.extras.get("orcamento_mapas"), session.extras.get("mapas")],
        canonicalize_mapas_frame,
    )


def _get_orcado_realizado_frame(session: Session) -> pd.DataFrame:
    """Obtém a aba Orçado x Realizado da sessão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("orcado_realizado"), session.extras.get("orcado_realizado")],
        canonicalize_orcado_realizado_frame,
    )


def _require_orcamento(frame: pd.DataFrame) -> pd.DataFrame:
    """Valida se a sessão contém dados de orçamento."""
    if not frame.empty and {"descricao", "custo_total"}.issubset(frame.columns):
        return frame
    raise HTTPException(status_code=422, detail="Arquivo não contém dados de Orçamento")


def _to_float(value: Any) -> float:
    """Converte valor escalar para float seguro."""
    parsed = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    return float(parsed) if pd.notna(parsed) else 0.0


def _budget_item(row: pd.Series) -> dict[str, Any]:
    """Serializa uma linha de orçamento."""
    return {
        "item": str(row.get("item", "") or ""),
        "subitem": str(row.get("subitem", "") or ""),
        "descricao": str(row.get("descricao", "") or ""),
        "unid": str(row.get("unid", "") or ""),
        "qtd": _to_float(row.get("qtd")),
        "custo_unitario": round(_to_float(row.get("custo_unitario")), 2),
        "custo_total": round(_to_float(row.get("custo_total")), 2),
    }


@router.get("/{session_id}/budget")
async def get_orcamento_budget(session_id: str) -> dict[str, Any]:
    """Retorna linhas de orçamento e total orçado."""
    session = _get_session_or_404(session_id)
    frame = _require_orcamento(_get_budget_frame(session))
    items = [_budget_item(row) for _, row in frame.iterrows()]
    total_orcado = sum(item["custo_total"] for item in items)
    return json_safe({"items": items, "total_orcado": round(float(total_orcado), 2)})


@router.get("/{session_id}/mapas")
async def get_orcamento_mapas(session_id: str, mapa_num: str | None = Query(None)) -> dict[str, Any]:
    """Retorna mapas de compra em formato longo."""
    session = _get_session_or_404(session_id)
    frame = _get_mapas_frame(session)
    if frame.empty:
        return json_safe({"items": []})
    working = frame.copy()
    if mapa_num:
        working = working[working["mapa_num"].astype(str) == mapa_num].copy()
    items = [
        {
            "item": str(row.get("item", "") or ""),
            "subitem": str(row.get("subitem", "") or ""),
            "descricao": str(row.get("descricao", "") or ""),
            "mapa_num": str(row.get("mapa_num", "") or ""),
            "valor_alocado": round(_to_float(row.get("valor_alocado")), 2),
        }
        for _, row in working.iterrows()
    ]
    return json_safe({"items": items})


@router.get("/{session_id}/variancia")
async def get_orcamento_variancia(session_id: str) -> dict[str, Any]:
    """Retorna variação entre orçamento aprovado e realizado."""
    session = _get_session_or_404(session_id)
    frame = _get_orcado_realizado_frame(session)
    if frame.empty:
        return json_safe({"items": [], "total_orcado": 0.0, "total_realizado": 0.0, "variancia_total": 0.0})

    month_columns = sorted([column for column in frame.columns if str(column).isdigit()], key=lambda value: int(value))
    items: list[dict[str, Any]] = []
    total_orcado = 0.0
    total_realizado = 0.0
    for _, row in frame.iterrows():
        verba_total = _to_float(row.get("verba_total"))
        realizado = sum(_to_float(row.get(column)) for column in month_columns)
        variancia = verba_total - realizado
        items.append(
            {
                "item": str(row.get("item", "") or ""),
                "descricao": str(row.get("descricao", "") or ""),
                "verba_total": round(verba_total, 2),
                "realizado": round(realizado, 2),
                "variancia": round(variancia, 2),
                "variancia_pct": round((variancia / verba_total) * 100, 2) if verba_total else None,
            }
        )
        total_orcado += verba_total
        total_realizado += realizado
    return json_safe(
        {
            "items": items,
            "total_orcado": round(total_orcado, 2),
            "total_realizado": round(total_realizado, 2),
            "variancia_total": round(total_orcado - total_realizado, 2),
        }
    )


@router.get("/{session_id}/evolucao_mensal")
async def get_orcamento_evolucao_mensal(session_id: str) -> dict[str, Any]:
    """Retorna evolução acumulada do realizado por mês."""
    session = _get_session_or_404(session_id)
    frame = _get_orcado_realizado_frame(session)
    if frame.empty:
        return json_safe({"meses": []})

    month_columns = sorted([column for column in frame.columns if str(column).isdigit()], key=lambda value: int(value))
    acumulado = 0.0
    meses: list[dict[str, Any]] = []
    for column in month_columns:
        realizado = float(pd.to_numeric(frame[column], errors="coerce").fillna(0).sum())
        acumulado += realizado
        meses.append(
            {
                "mes": str(column),
                "realizado": round(realizado, 2),
                "realizado_acumulado": round(acumulado, 2),
            }
        )
    return json_safe({"meses": meses})


@router.get("/{session_id}/flat")
async def get_orcamento_flat(session_id: str) -> list[dict[str, Any]]:
    """Mantém o contrato legado de orçamento flat."""
    session = _get_session_or_404(session_id)
    frame = _require_orcamento(_get_budget_frame(session))
    payload = [
        {
            "ITEM": row.get("item"),
            "SUBITEM": row.get("subitem"),
            "DESCRIÇÃO": row.get("descricao"),
            "DESCRIÃ‡ÃƒO": row.get("descricao"),
            "UNID": row.get("unid"),
            "QTD": row.get("qtd"),
            "CUSTO UNITÁRIO": row.get("custo_unitario"),
            "CUSTO UNITÃRIO": row.get("custo_unitario"),
            "CUSTO TOTAL": row.get("custo_total"),
        }
        for _, row in frame.iterrows()
    ]
    return json_safe(payload)
