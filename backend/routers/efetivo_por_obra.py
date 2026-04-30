from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..services.efetivo_analyzer import EfetivoAnalyzer
from ..session import Session, get_session
from ..utils.json_utils import json_safe


router = APIRouter(tags=["efetivo"])


def _get_session_or_404(session_id: str) -> Session:
    """Obtém a sessão atual ou retorna erro 404."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session


def _resolve_column(dataframe: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {str(column).strip().lower(): str(column) for column in dataframe.columns}
    for candidate in candidates:
        resolved = normalized.get(candidate.strip().lower())
        if resolved:
            return resolved
    return None


def _build_filial_payload(dataframe: pd.DataFrame) -> dict[str, Any]:
    working = dataframe.copy()
    quantidade_col = _resolve_column(working, ["Quantidade"])
    obra_col = _resolve_column(working, ["Filial/Obra", "Obra"])
    cargo_col = _resolve_column(working, ["Cargo/Função", "Cargo/Funcao", "Funcao"])
    fornecedor_col = _resolve_column(working, ["Fornecedor"])
    periodo_col = _resolve_column(working, ["Período", "Periodo"])

    if quantidade_col is None:
        return {"items": [], "total_funcionarios": 0}

    working[quantidade_col] = pd.to_numeric(working[quantidade_col], errors="coerce").fillna(0)
    working = working[working[quantidade_col] > 0].copy()
    if working.empty:
        return {"items": [], "total_funcionarios": 0}

    if obra_col is None:
        working["Filial/Obra"] = "Obra nao identificada"
        obra_col = "Filial/Obra"
    if cargo_col is None:
        working["Cargo/Função"] = "Nao informado"
        cargo_col = "Cargo/Função"

    working[obra_col] = working[obra_col].fillna("").astype(str).str.strip().replace("", "Obra nao identificada")
    working[cargo_col] = working[cargo_col].fillna("").astype(str).str.strip().replace("", "Nao informado")

    unique_cols = [column for column in [obra_col, cargo_col, fornecedor_col, periodo_col] if column is not None]
    if len(unique_cols) >= 3:
        deduped = working.drop_duplicates(subset=unique_cols).copy()
    else:
        deduped = working.copy()

    grouped = (
        deduped.groupby([obra_col, cargo_col], dropna=False)
        .size()
        .reset_index(name="funcionarios")
        .sort_values(["funcionarios", obra_col, cargo_col], ascending=[False, True, True])
    )

    total_funcionarios = int(grouped["funcionarios"].sum()) if not grouped.empty else 0
    items = [
        {
            "filial_obra": str(row[obra_col]),
            "cargo_funcao": str(row[cargo_col]),
            "funcionarios": int(row["funcionarios"]),
        }
        for _, row in grouped.iterrows()
    ]
    return {
        "items": items,
        "total_funcionarios": total_funcionarios,
    }


@router.get("/{session_id}/filial")
async def get_efetivo_filial(session_id: str) -> dict[str, Any]:
    """Retorna headcount agrupado por filial/obra e cargo/função."""
    session = _get_session_or_404(session_id)
    if session.df.empty:
        raise HTTPException(status_code=422, detail="Arquivo não contém dados de Efetivo")
    return json_safe(_build_filial_payload(session.df))


@router.get("/{session_id}/por_obra")
async def get_efetivo_por_obra(session_id: str) -> dict[str, Any]:
    """Retorna a agregação de Efetivo por obra."""
    session = _get_session_or_404(session_id)
    if session.df.empty:
        raise HTTPException(status_code=422, detail="Arquivo não contém dados de Efetivo")
    return json_safe(EfetivoAnalyzer(session.df).get_por_obra_summary())
