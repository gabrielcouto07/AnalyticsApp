from __future__ import annotations

import re
import unicodedata
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..session import get_session
from ..utils.json_utils import _json_safe


router = APIRouter(prefix="/api/custos", tags=["custos"])


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


def _has_columns(df: pd.DataFrame, candidates: list[list[str]]) -> bool:
    if not isinstance(df, pd.DataFrame) or df.empty:
        return False
    try:
        return all(_find_column(df, options, required=False) for options in candidates)
    except HTTPException:
        return False


def _get_session_or_404(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _get_nfs_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    required = [["FORNECEDOR"], ["NF"], ["VALOR"]]
    candidates = [session.df, session.extras.get("nfs")]
    for frame in candidates:
        if _has_columns(frame, required):
            return frame.copy()
    raise HTTPException(status_code=422, detail="Dados de NFs nao estao disponiveis nesta sessao")


def _get_consolidado_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    required = [["FORNECEDOR"], ["NF"], ["VALOR"]]
    candidates = [session.extras.get("consolidado"), session.df, session.extras.get("nfs")]
    for frame in candidates:
        if _has_columns(frame, required):
            return frame.copy()
    raise HTTPException(status_code=422, detail="Dados de consolidado nao estao disponiveis nesta sessao")


def _get_resumo_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    frame = session.extras.get("resumo")
    if isinstance(frame, pd.DataFrame) and not frame.empty:
        return frame.copy()
    return pd.DataFrame()


def _get_orcado_realizado_frame(session_id: str) -> pd.DataFrame:
    session = _get_session_or_404(session_id)
    frame = session.extras.get("orcado_realizado")
    if isinstance(frame, pd.DataFrame) and not frame.empty:
        return frame.copy()
    return pd.DataFrame()


def _rename_columns(df: pd.DataFrame, mapping: dict[str, str]) -> pd.DataFrame:
    working = df.copy()
    rename_map: dict[str, str] = {}
    for target, source_candidates in mapping.items():
        source = _find_column(working, source_candidates, required=False)
        if source:
            rename_map[source] = target
    if rename_map:
        working = working.rename(columns=rename_map)
    return working


@router.get("/{session_id}/nfs")
async def get_custos_nfs(session_id: str) -> list[dict[str, Any]]:
    frame = _get_nfs_frame(session_id)
    frame = _rename_columns(
        frame,
        {
            "Nº CONSOLIDADO": ["Nº CONSOLIDADO", "N CONSOLIDADO", "NUMCONSOLIDADO"],
            "COD": ["COD"],
            "FORNECEDOR": ["FORNECEDOR"],
            "NF": ["NF"],
            "MAPA PREÇOS": ["MAPA PREÇOS", "MAPA PRECOS", "MAPAPRECOS"],
            "NATUREZA": ["NATUREZA"],
            "BOLETO/DEPÓSITO": ["BOLETO/DEPÓSITO", "BOLETO/DEPOSITO", "BOLETO DEPÓSITO", "COND PAGTO"],
            "DATA VENCTO": ["DATA VENCTO"],
            "VALOR": ["VALOR"],
            "SITUAÇÃO PLANILHA": ["SITUAÇÃO PLANILHA", "SITUACAO PLANILHA"],
            "SALDO PLANILHA": ["SALDO PLANILHA"],
        },
    )
    return _json_safe(frame.to_dict(orient="records"))


@router.get("/{session_id}/consolidado")
async def get_custos_consolidado(session_id: str) -> list[dict[str, Any]]:
    frame = _get_consolidado_frame(session_id)
    frame = _rename_columns(
        frame,
        {
            "Nº CONSOLIDADO": ["Nº CONSOLIDADO", "N CONSOLIDADO", "NUMCONSOLIDADO"],
            "FORNECEDOR": ["FORNECEDOR"],
            "NF": ["NF"],
            "MAPA": ["MAPA", "MAPA PREÇOS", "MAPA PRECOS"],
            "NATUREZA": ["NATUREZA"],
            "COND.PAGTO": ["COND.PAGTO", "COND PAGTO", "BOLETO/DEPÓSITO", "BOLETO/DEPOSITO"],
            "DATA VENCTO": ["DATA VENCTO"],
            "VALOR": ["VALOR"],
            "ITEM APROPRIAÇÃO": ["ITEM APROPRIAÇÃO", "ITEM APROPRIACAO", "APROPRIITEM"],
            "VALOR APROPRIADO": ["VALOR APROPRIADO", "APROPRIVALOR"],
        },
    )
    return _json_safe(frame.to_dict(orient="records"))


@router.get("/{session_id}/orcado_realizado")
async def get_custos_orcado_realizado(session_id: str) -> list[dict[str, Any]]:
    frame = _get_orcado_realizado_frame(session_id)
    if frame.empty:
        return []
    item_col = _find_column(frame, ["ITEM/SUBITEM", "ITEM SUBITEM", "ITEM"], required=False)
    descricao_col = _find_column(frame, ["DESCRIÇÃO", "DESCRICAO"])
    verba_col = _find_column(frame, ["VERBA TOTAL CUSTO DIRETO"])
    periodo_col = _find_column(frame, ["PERIODO", "MES"])
    desembolso_col = _find_column(frame, ["DESEMBOLSO", "REALIZADO"])

    working = frame.copy()
    working[verba_col] = pd.to_numeric(working[verba_col], errors="coerce").fillna(0)
    working[periodo_col] = pd.to_numeric(working[periodo_col], errors="coerce").astype("Int64")
    working[desembolso_col] = pd.to_numeric(working[desembolso_col], errors="coerce").fillna(0)
    working = working.dropna(subset=[periodo_col])

    items: list[dict[str, Any]] = []
    group_columns = [descricao_col, verba_col]
    if item_col:
        group_columns.insert(0, item_col)

    grouped = working.groupby(group_columns, dropna=False, sort=False)
    for group_values, group_df in grouped:
        if item_col:
            item_value, descricao_value, verba_total_value = group_values
        else:
            descricao_value, verba_total_value = group_values
            item_value = descricao_value

        periodos = (
            group_df.sort_values(periodo_col)
            [[periodo_col, desembolso_col]]
            .to_dict(orient="records")
        )
        items.append(
            {
                "item": str(item_value),
                "descricao": str(descricao_value),
                "verba_total": round(float(verba_total_value), 2),
                "periodos": [
                    {
                        "periodo": int(periodo["PERIODO"] if "PERIODO" in periodo else periodo[periodo_col]),
                        "desembolso": round(float(periodo["DESEMBOLSO"] if "DESEMBOLSO" in periodo else periodo[desembolso_col]), 2),
                    }
                    for periodo in periodos
                ],
            }
        )
    return _json_safe(items)


@router.get("/{session_id}/resumo")
async def get_custos_resumo(session_id: str) -> list[dict[str, Any]]:
    frame = _get_resumo_frame(session_id)
    if frame.empty:
        return []
    frame = _rename_columns(
        frame,
        {
            "Nº CONSOLIDADO": ["Nº CONSOLIDADO", "N CONSOLIDADO"],
            "MATERIAL/SERVIÇO": ["MATERIAL/SERVIÇO", "MATERIAL/SERVICO"],
            "MÃO OBRA EMPREITADA": ["MÃO OBRA EMPREITADA", "MAO OBRA EMPREITADA"],
            "MÃO OBRA TEMPO": ["MÃO OBRA TEMPO", "MAO OBRA TEMPO"],
            "STAFF": ["STAFF"],
            "SERVIÇO sem TAXA ADM": ["SERVIÇO sem TAXA ADM", "SERVIÇO SEM TAXA ADM", "SERVICO SEM TAXA ADM"],
            "TOTAL": ["TOTAL"],
            "TAXA ADMINISTRAÇÃO": ["TAXA ADMINISTRAÇÃO", "TAXA ADMINISTRACAO"],
            "DATA VENCTO": ["DATA VENCTO"],
            "DATA RECBTO": ["DATA RECBTO"],
            "TOTAL GERAL": ["TOTAL GERAL"],
        },
    )
    return _json_safe(frame.to_dict(orient="records"))
