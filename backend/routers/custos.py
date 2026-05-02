from __future__ import annotations

import math
from typing import Any, Literal

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..services.core.normalizer import paginate_df
from ..services.custos_analyzer import (
    build_custos_summary,
    canonicalize_consolidado_frame,
    canonicalize_nfs_frame,
    canonicalize_orcado_realizado_frame,
    canonicalize_resumo_frame,
)
from ..session import Session, find_session_file, get_session
from ..utils.json_utils import json_safe


router = APIRouter(tags=["custos"])


def _get_session_or_404(session_id: str) -> Session:
    """Obtém a sessão atual ou retorna erro 404."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session


def _structured_data(session: Session) -> dict[str, Any]:
    """Extrai dados estruturados do upload quando disponíveis."""
    structured = session.extras.get("structured_data")
    if isinstance(structured, dict):
        return structured
    file_entry = find_session_file(session, {"custos", "orcamento"})
    if file_entry is None:
        return {}
    parsed = file_entry.parsed_data.get("custos") or {}
    structured = parsed.get("structured_data")
    return structured if isinstance(structured, dict) else {}


def _first_non_empty_frame(candidates: list[Any], canonicalizer: Any) -> pd.DataFrame:
    """Retorna o primeiro DataFrame canônico não vazio."""
    for candidate in candidates:
        frame = canonicalizer(candidate)
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame
    return canonicalizer(None)


def _get_nfs_frame(session: Session) -> pd.DataFrame:
    """Obtém a aba de NFs da sessão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("nfs"), session.extras.get("nfs"), session.df],
        canonicalize_nfs_frame,
    )


def _get_consolidado_frame(session: Session) -> pd.DataFrame:
    """Obtém a aba Consolidado da sessão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("consolidado"), session.extras.get("consolidado"), session.df],
        canonicalize_consolidado_frame,
    )


def _get_resumo_frame(session: Session) -> pd.DataFrame:
    """Obtém a aba Resumo da sessão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("resumo"), session.extras.get("resumo")],
        canonicalize_resumo_frame,
    )


def _get_orcado_realizado_frame(session: Session) -> pd.DataFrame:
    """Obtém a aba Orçado x Realizado da sessão."""
    structured = _structured_data(session)
    return _first_non_empty_frame(
        [structured.get("orcado_realizado"), session.extras.get("orcado_realizado")],
        canonicalize_orcado_realizado_frame,
    )


def _require_custos(nfs: pd.DataFrame, consolidado: pd.DataFrame | None = None) -> pd.DataFrame:
    """Valida se a sessão contém dados de custos."""
    if not nfs.empty and "valor" in nfs.columns:
        return nfs
    if consolidado is not None and not consolidado.empty and "valor" in consolidado.columns:
        return canonicalize_nfs_frame(consolidado)
    raise HTTPException(status_code=422, detail="Arquivo não contém dados de Custos")


def _iso_or_none(value: Any) -> str | None:
    """Formata data em ISO ou retorna nulo."""
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    return parsed.date().isoformat() if pd.notna(parsed) else None


def _to_float(value: Any) -> float:
    """Converte valor escalar para float seguro."""
    parsed = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    return float(parsed) if pd.notna(parsed) else 0.0


def _new_nfs_row(row: pd.Series) -> dict[str, Any]:
    """Serializa uma linha de NF no contrato novo."""
    return {
        "consolidado": str(row.get("n_consolidado", "") or ""),
        "fornecedor": str(row.get("fornecedor", "") or ""),
        "nf": str(row.get("nf", "") or ""),
        "natureza": str(row.get("natureza", "") or ""),
        "valor": round(_to_float(row.get("valor")), 2),
        "data_vencto": _iso_or_none(row.get("data_vencimento")),
        "pagamento": str(row.get("boleto_deposito", "") or ""),
        "situacao": str(row.get("situacao_planilha", "") or ""),
    }


def _legacy_nfs_row(row: pd.Series) -> dict[str, Any]:
    """Serializa uma linha de NF no contrato legado da UI."""
    return {
        "Nº CONSOLIDADO": row.get("n_consolidado"),
        "NÂº CONSOLIDADO": row.get("n_consolidado"),
        "COD": row.get("cod"),
        "FORNECEDOR": row.get("fornecedor"),
        "NF": row.get("nf"),
        "MAPA PREÇOS": row.get("mapa_precos"),
        "MAPA PREÃ‡OS": row.get("mapa_precos"),
        "NATUREZA": row.get("natureza"),
        "BOLETO/DEPÓSITO": row.get("boleto_deposito"),
        "BOLETO/DEPÃ“SITO": row.get("boleto_deposito"),
        "DATA VENCTO": _iso_or_none(row.get("data_vencimento")),
        "VALOR": row.get("valor"),
        "ITEM PLANILHA": row.get("item_planilha"),
        "VALOR ITEM": row.get("valor_item"),
        "SITUAÇÃO PLANILHA": row.get("situacao_planilha"),
        "SITUAÃ‡ÃƒO PLANILHA": row.get("situacao_planilha"),
        "SALDO PLANILHA": row.get("saldo_planilha"),
    }


def _apply_nfs_filters(frame: pd.DataFrame, natureza: str | None, fornecedor: str | None) -> pd.DataFrame:
    """Aplica filtros opcionais de natureza e fornecedor."""
    working = frame.copy()
    if natureza and "natureza" in working.columns:
        target = natureza.casefold()
        working = working[working["natureza"].fillna("").astype(str).str.casefold() == target].copy()
    if fornecedor and "fornecedor" in working.columns:
        target = fornecedor.casefold()
        working = working[working["fornecedor"].fillna("").astype(str).str.casefold().str.contains(target)].copy()
    return working


@router.get("/{session_id}/resumo")
async def get_custos_resumo(session_id: str) -> dict[str, Any]:
    """Retorna KPIs consolidados de Custos."""
    session = _get_session_or_404(session_id)
    nfs = _get_nfs_frame(session)
    consolidado = _get_consolidado_frame(session)
    resumo = _get_resumo_frame(session)
    frame = _require_custos(nfs, consolidado)
    payload = build_custos_summary(frame, resumo)

    legacy_rows = []
    for _, row in resumo.iterrows():
        legacy_rows.append(
            {
                "Nº CONSOLIDADO": row.get("n_consolidado"),
                "NÂº CONSOLIDADO": row.get("n_consolidado"),
                "FORNECEDOR": row.get("fornecedor"),
                "MATERIAL/SERVIÇO": row.get("material_servico"),
                "MATERIAL/SERVIÃ‡O": row.get("material_servico"),
                "MÃO OBRA EMPREITADA": row.get("mao_obra_empr"),
                "MÃƒO OBRA EMPREITADA": row.get("mao_obra_empr"),
                "MÃO OBRA TEMPO": row.get("mao_obra_tempo"),
                "MÃƒO OBRA TEMPO": row.get("mao_obra_tempo"),
                "STAFF": row.get("staff"),
                "SERVIÇO sem TAXA ADM": row.get("servicos_sem_taxa_adm"),
                "SERVIÃ‡O sem TAXA ADM": row.get("servicos_sem_taxa_adm"),
                "TOTAL": row.get("total"),
                "TAXA ADMINISTRAÇÃO": row.get("taxa_administracao"),
                "TAXA ADMINISTRAÃ‡ÃƒO": row.get("taxa_administracao"),
                "%": row.get("taxa_pct"),
                "NF ADMINISTRAÇÃO": row.get("nf_administracao"),
                "NF ADMINISTRAÃ‡ÃƒO": row.get("nf_administracao"),
                "DATA VENCTO": _iso_or_none(row.get("data_vencimento")),
                "DATA RECBTO": _iso_or_none(row.get("data_recebimento")),
                "TOTAL GERAL": row.get("total_geral"),
            }
        )
    payload["rows"] = legacy_rows
    return json_safe(payload)


@router.get("/{session_id}/nfs")
async def get_custos_nfs(
    session_id: str,
    natureza: str | None = Query(None),
    fornecedor: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=5000),
) -> dict[str, Any]:
    """Retorna NFs paginadas e filtráveis."""
    session = _get_session_or_404(session_id)
    frame = _apply_nfs_filters(_require_custos(_get_nfs_frame(session), _get_consolidado_frame(session)), natureza, fornecedor)
    total = int(len(frame))
    pages = math.ceil(total / page_size) if total else 0
    start = (page - 1) * page_size
    paged = frame.iloc[start : start + page_size].copy()
    items = [_new_nfs_row(row) for _, row in paged.iterrows()]
    legacy = [_legacy_nfs_row(row) for _, row in paged.iterrows()]
    return json_safe({"items": items, "data": legacy, "total": total, "page": page, "page_size": page_size, "pages": pages})


@router.get("/{session_id}/consolidado")
async def get_custos_consolidado(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    """Retorna fornecedores consolidados por valor total."""
    session = _get_session_or_404(session_id)
    nfs = _require_custos(_get_nfs_frame(session), _get_consolidado_frame(session))
    valid = nfs.copy()
    valid["valor"] = pd.to_numeric(valid["valor"], errors="coerce")
    valid = valid[valid["valor"].notna() & (valid["valor"] != 0)].copy()
    total_valor = float(valid["valor"].sum()) if not valid.empty else 0.0

    grouped = (
        valid.groupby("fornecedor", dropna=False)
        .agg(total_valor=("valor", "sum"), count_nfs=("nf", "count"), naturezas=("natureza", lambda s: sorted({str(v) for v in s.dropna()})))
        .reset_index()
        .sort_values("total_valor", ascending=False)
    )
    items = [
        {
            "fornecedor": str(row["fornecedor"] or "Nao informado"),
            "total_valor": round(float(row["total_valor"] or 0), 2),
            "count_nfs": int(row["count_nfs"]),
            "naturezas": list(row["naturezas"]),
            "pct_do_total": round((float(row["total_valor"] or 0) / total_valor) * 100, 2) if total_valor else 0.0,
        }
        for _, row in grouped.iterrows()
    ]

    legacy_source = _get_consolidado_frame(session)
    if legacy_source.empty:
        legacy_source = canonicalize_consolidado_frame(nfs)
    legacy_payload = pd.DataFrame(
        [
            {
                "Nº CONSOLIDADO": row.get("n_consolidado"),
                "NÂº CONSOLIDADO": row.get("n_consolidado"),
                "FORNECEDOR": row.get("fornecedor"),
                "NF": row.get("nf"),
                "MAPA": row.get("mapa"),
                "NATUREZA": row.get("natureza"),
                "COND.PAGTO": row.get("cond_pagto"),
                "DATA VENCTO": _iso_or_none(row.get("data_vencimento")),
                "VALOR": row.get("valor"),
                "ITEM APROPRIAÇÃO": row.get("apropriacao_item"),
                "ITEM APROPRIAÃ‡ÃƒO": row.get("apropriacao_item"),
                "VALOR APROPRIADO": row.get("apropriacao_valor"),
            }
            for _, row in legacy_source.iterrows()
        ]
    )
    legacy = paginate_df(legacy_payload, page=page, page_size=page_size)
    return json_safe({"items": items, **legacy})


@router.get("/{session_id}/fluxo")
async def get_custos_fluxo(
    session_id: str,
    granularidade: Literal["mensal", "quinzenal"] = Query("mensal"),
) -> dict[str, Any]:
    """Retorna fluxo de caixa por mês ou quinzena."""
    session = _get_session_or_404(session_id)
    frame = _require_custos(_get_nfs_frame(session), _get_consolidado_frame(session)).copy()
    if "data_vencimento" not in frame.columns:
        return json_safe({"months": [], "periodos": []})

    frame["data_vencimento"] = pd.to_datetime(frame["data_vencimento"], errors="coerce", dayfirst=True)
    frame["valor"] = pd.to_numeric(frame["valor"], errors="coerce")
    frame = frame[frame["data_vencimento"].notna() & frame["valor"].notna() & (frame["valor"] != 0)].copy()
    if frame.empty:
        return json_safe({"months": [], "periodos": []})

    if granularidade == "quinzenal":
        frame["periodo"] = frame["data_vencimento"].dt.strftime("%Y-%m") + " Q" + frame["data_vencimento"].dt.day.le(15).map({True: "1", False: "2"})
    else:
        frame["periodo"] = frame["data_vencimento"].dt.to_period("M").astype(str)

    months: list[dict[str, Any]] = []
    for label, group in frame.groupby("periodo", sort=True):
        by_natureza = (
            group.groupby("natureza", dropna=False)["valor"]
            .sum()
            .reset_index()
            .sort_values("valor", ascending=False)
        )
        months.append(
            {
                "mes": str(label),
                "valor_total": round(float(group["valor"].sum()), 2),
                "by_natureza": [
                    {"natureza": str(row["natureza"] or "Nao informado"), "valor": round(float(row["valor"] or 0), 2)}
                    for _, row in by_natureza.iterrows()
                ],
            }
        )
    return json_safe({"months": months, "periodos": months})


@router.get("/{session_id}/orcado_realizado")
async def get_custos_orcado_realizado(session_id: str) -> list[dict[str, Any]]:
    """Mantém o contrato legado da aba Orçado x Realizado."""
    session = _get_session_or_404(session_id)
    frame = _get_orcado_realizado_frame(session)
    if frame.empty:
        return []

    month_columns = sorted([column for column in frame.columns if str(column).isdigit()], key=lambda value: int(value))
    payload = []
    for _, row in frame.iterrows():
        periodos = [
            {"periodo": int(column), "desembolso": round(float(row.get(column, 0) or 0), 2)}
            for column in month_columns
            if float(row.get(column, 0) or 0) != 0
        ]
        payload.append(
            {
                "item": str(row.get("item", "") or ""),
                "descricao": str(row.get("descricao", "") or ""),
                "verba_total": round(float(row.get("verba_total", 0) or 0), 2),
                "periodos": periodos,
            }
        )
    return json_safe(payload)
