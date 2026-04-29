from __future__ import annotations

import re
from typing import Any
import unicodedata

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..session import get_session, get_session_extra
from ..services.custos_analyzer import build_structured_from_sheets


router = APIRouter(prefix="/api", tags=["schema-data"])


def _normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()


def _find_column(df: pd.DataFrame, candidates: list[str], required: bool = True) -> str | None:
    normalized_map = {_normalize_text(column): column for column in df.columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        if normalized_candidate in normalized_map:
            return normalized_map[normalized_candidate]
    if required:
        raise HTTPException(status_code=422, detail=f"Coluna esperada nao encontrada: {', '.join(candidates)}")
    return None


def _parse_datetime_series(series: pd.Series) -> pd.Series:
    default_parsed = pd.to_datetime(series, errors="coerce")
    dayfirst_parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)
    return default_parsed.fillna(dayfirst_parsed)


def _get_structured_data(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.sheets:
        raise HTTPException(status_code=422, detail="Sessao sem multi-sheet. Re-faca o upload.")

    structured = get_session_extra(session_id, "structured_data")
    if isinstance(structured, dict):
        return structured

    structured = build_structured_from_sheets(
        session.sheets,
        resumo_meta=session.extras.get("resumo_meta"),
    )
    session.extras["structured_data"] = structured
    return structured


def _get_non_empty_frame(session_id: str, path: list[str], label: str) -> pd.DataFrame:
    structured = _get_structured_data(session_id)
    current: Any = structured
    for key in path:
        current = current.get(key) if isinstance(current, dict) else None
    if not isinstance(current, pd.DataFrame) or current.empty:
        raise HTTPException(status_code=422, detail=f"Dados de {label} nao estao disponiveis nesta sessao")
    return current.copy()


@router.get("/custos/{session_id}/resumo")
async def get_custos_resumo(session_id: str) -> dict[str, Any]:
    structured = _get_structured_data(session_id)
    nfs_df = _get_non_empty_frame(session_id, ["nfs"], "NFs")
    resumo_df = structured.get("resumo")
    resumo_meta = structured.get("resumo_meta") if isinstance(structured.get("resumo_meta"), dict) else {}

    natureza_col = _find_column(nfs_df, ["NATUREZA"])
    valor_col = _find_column(nfs_df, ["VALOR"])
    situacao_col = _find_column(nfs_df, ["SITUAÇÃO PLANILHA", "SITUACAO PLANILHA"], required=False)
    saldo_col = _find_column(nfs_df, ["SALDO PLANILHA"], required=False)

    working = nfs_df.copy()
    working[valor_col] = pd.to_numeric(working[valor_col], errors="coerce").fillna(0)

    total_nfs = int(len(working))
    total_valor = float(working[valor_col].sum())

    valor_com_taxa = total_valor
    taxa_adm_pct = float(resumo_meta.get("taxa_adm_pct") or 0.0)
    if isinstance(resumo_df, pd.DataFrame) and not resumo_df.empty:
        total_geral_col = _find_column(resumo_df, ["TOTAL GERAL"], required=False)
        taxa_pct_col = _find_column(resumo_df, ["%"], required=False)
        taxa_valor_col = _find_column(resumo_df, ["TAXA ADMINISTRAÇÃO", "TAXA ADMINISTRACAO"], required=False)
        if total_geral_col:
            resumo_df = resumo_df.copy()
            resumo_df[total_geral_col] = pd.to_numeric(resumo_df[total_geral_col], errors="coerce").fillna(0)
            valor_com_taxa = float(resumo_df[total_geral_col].sum())
        elif taxa_valor_col:
            resumo_df = resumo_df.copy()
            resumo_df[taxa_valor_col] = pd.to_numeric(resumo_df[taxa_valor_col], errors="coerce").fillna(0)
            valor_com_taxa = float(total_valor + resumo_df[taxa_valor_col].sum())

        if taxa_pct_col:
            resumo_df = resumo_df.copy()
            resumo_df[taxa_pct_col] = pd.to_numeric(resumo_df[taxa_pct_col], errors="coerce")
            taxa_series = resumo_df[taxa_pct_col].dropna()
            if not taxa_series.empty and taxa_adm_pct == 0.0:
                taxa_adm_pct = float(taxa_series.mean())
    elif total_valor:
        taxa_adm_pct = round(((valor_com_taxa - total_valor) / total_valor) * 100, 2)

    nfs_em_aberto = 0
    if saldo_col:
        working[saldo_col] = pd.to_numeric(working[saldo_col], errors="coerce").fillna(0)
        nfs_em_aberto = int((working[saldo_col] > 0).sum())
    elif situacao_col:
        status_series = working[situacao_col].astype(str).str.lower()
        nfs_em_aberto = int((~status_series.str.contains("pago|quitado|receb", regex=True)).sum())

    by_natureza = (
        working.groupby(natureza_col, dropna=False)[valor_col]
        .sum()
        .reset_index()
        .sort_values(valor_col, ascending=False)
    )

    return {
        "obra_nome": str(resumo_meta.get("obra_nome") or ""),
        "cliente": str(resumo_meta.get("cliente") or ""),
        "data_inicio": resumo_meta.get("data_inicio"),
        "total_nfs": total_nfs,
        "total_valor": round(total_valor, 2),
        "valor_com_taxa": round(valor_com_taxa, 2),
        "taxa_adm_pct": round(taxa_adm_pct, 2),
        "nfs_em_aberto": nfs_em_aberto,
        "by_natureza": [
            {"natureza": str(row[natureza_col]), "valor": round(float(row[valor_col]), 2)}
            for _, row in by_natureza.iterrows()
        ],
    }


@router.get("/custos/{session_id}/nfs")
async def get_custos_nfs(session_id: str) -> dict[str, Any]:
    nfs_df = _get_non_empty_frame(session_id, ["nfs"], "NFs")
    consolidado_col = _find_column(nfs_df, ["Nº CONSOLIDADO", "N CONSOLIDADO", "NUMCONSOLIDADO"], required=False)
    fornecedor_col = _find_column(nfs_df, ["FORNECEDOR"])
    nf_col = _find_column(nfs_df, ["NF"])
    natureza_col = _find_column(nfs_df, ["NATUREZA"])
    valor_col = _find_column(nfs_df, ["VALOR"])
    data_col = _find_column(nfs_df, ["DATA VENCTO"])
    pagamento_col = _find_column(nfs_df, ["BOLETO/DEPÓSITO", "BOLETO/DEPOSITO"], required=False)
    situacao_col = _find_column(nfs_df, ["SITUAÇÃO PLANILHA", "SITUACAO PLANILHA"], required=False)

    working = nfs_df.copy()
    working[valor_col] = pd.to_numeric(working[valor_col], errors="coerce")
    working[data_col] = _parse_datetime_series(working[data_col])

    items = [
        {
            "consolidado": str(row[consolidado_col]) if consolidado_col else "",
            "fornecedor": str(row[fornecedor_col]),
            "nf": str(row[nf_col]),
            "natureza": str(row[natureza_col]),
            "valor": round(float(row[valor_col]), 2) if pd.notna(row[valor_col]) else 0.0,
            "data_vencto": row[data_col].date().isoformat() if pd.notna(row[data_col]) else None,
            "pagamento": str(row[pagamento_col]) if pagamento_col else "",
            "situacao": str(row[situacao_col]) if situacao_col else "",
        }
        for _, row in working.iterrows()
    ]
    return {"items": items, "total": len(items)}


@router.get("/custos/{session_id}/consolidado")
async def get_custos_consolidado(session_id: str) -> dict[str, Any]:
    structured = _get_structured_data(session_id)
    source_df = structured.get("consolidado")
    if not isinstance(source_df, pd.DataFrame) or source_df.empty:
        source_df = _get_non_empty_frame(session_id, ["nfs"], "NFs")

    fornecedor_col = _find_column(source_df, ["FORNECEDOR"])
    valor_col = _find_column(source_df, ["VALOR"])
    natureza_col = _find_column(source_df, ["NATUREZA"], required=False)
    nf_col = _find_column(source_df, ["NF"], required=False)

    working = source_df.copy()
    working[valor_col] = pd.to_numeric(working[valor_col], errors="coerce").fillna(0)

    grouped = working.groupby(fornecedor_col, dropna=False).agg(
        total_valor=(valor_col, "sum"),
        count_nfs=(nf_col, "count") if nf_col else (valor_col, "count"),
    )
    grouped = grouped.reset_index().sort_values("total_valor", ascending=False)

    items: list[dict[str, Any]] = []
    for _, row in grouped.iterrows():
        fornecedor = row[fornecedor_col]
        subset = working[working[fornecedor_col] == fornecedor]
        naturezas = []
        if natureza_col:
            naturezas = sorted({str(value) for value in subset[natureza_col].dropna().tolist() if str(value).strip()})
        items.append(
            {
                "fornecedor": str(fornecedor),
                "total_valor": round(float(row["total_valor"]), 2),
                "count_nfs": int(row["count_nfs"]),
                "naturezas": naturezas,
            }
        )

    return {"items": items}


@router.get("/custos/{session_id}/fluxo")
async def get_custos_fluxo(session_id: str) -> dict[str, Any]:
    nfs_df = _get_non_empty_frame(session_id, ["nfs"], "NFs")
    natureza_col = _find_column(nfs_df, ["NATUREZA"])
    valor_col = _find_column(nfs_df, ["VALOR"])
    data_col = _find_column(nfs_df, ["DATA VENCTO"])

    working = nfs_df.copy()
    working[valor_col] = pd.to_numeric(working[valor_col], errors="coerce")
    working[data_col] = _parse_datetime_series(working[data_col])
    working = working.dropna(subset=[valor_col, data_col])
    if working.empty:
        return {"months": []}

    working["mes_ref"] = working[data_col].dt.to_period("M").astype(str)
    months: list[dict[str, Any]] = []
    for month, month_df in working.groupby("mes_ref"):
        grouped = month_df.groupby(natureza_col)[valor_col].sum().reset_index()
        months.append(
            {
                "mes": month,
                "valor_total": round(float(month_df[valor_col].sum()), 2),
                "by_natureza": [
                    {"natureza": str(row[natureza_col]), "valor": round(float(row[valor_col]), 2)}
                    for _, row in grouped.iterrows()
                ],
            }
        )
    months.sort(key=lambda item: item["mes"])
    return {"months": months}


@router.get("/orcamento/{session_id}/budget")
async def get_orcamento_budget(session_id: str) -> dict[str, Any]:
    budget_df = _get_non_empty_frame(session_id, ["orcamento", "budget"], "orcamento")
    item_col = _find_column(budget_df, ["ITEM"])
    subitem_col = _find_column(budget_df, ["SUBITEM"], required=False)
    descricao_col = _find_column(budget_df, ["DESCRIÇÃO", "DESCRICAO"])
    unid_col = _find_column(budget_df, ["UNID"], required=False)
    qtd_col = _find_column(budget_df, ["QTD"])
    custo_unitario_col = _find_column(budget_df, ["CUSTO UNITÁRIO", "CUSTO UNITARIO"], required=False)
    custo_total_col = _find_column(budget_df, ["CUSTO TOTAL"])

    working = budget_df.copy()
    for column_name in [qtd_col, custo_unitario_col, custo_total_col]:
        if column_name:
            working[column_name] = pd.to_numeric(working[column_name], errors="coerce")

    items = [
        {
            "item": str(row[item_col]),
            "subitem": str(row[subitem_col]) if subitem_col else "",
            "descricao": str(row[descricao_col]),
            "unid": str(row[unid_col]) if unid_col else "",
            "qtd": float(row[qtd_col]) if pd.notna(row[qtd_col]) else 0.0,
            "custo_unitario": float(row[custo_unitario_col]) if custo_unitario_col and pd.notna(row[custo_unitario_col]) else 0.0,
            "custo_total": float(row[custo_total_col]) if pd.notna(row[custo_total_col]) else 0.0,
        }
        for _, row in working.iterrows()
    ]
    total_orcado = round(float(working[custo_total_col].fillna(0).sum()), 2)
    return {"items": items, "total_orcado": total_orcado}


@router.get("/orcamento/{session_id}/mapas")
async def get_orcamento_mapas(session_id: str) -> dict[str, Any]:
    mapas_df = _get_non_empty_frame(session_id, ["orcamento", "mapas"], "mapas de compra")
    item_col = _find_column(mapas_df, ["ITEM"])
    subitem_col = _find_column(mapas_df, ["SUBITEM"], required=False)
    descricao_col = _find_column(mapas_df, ["DESCRIÇÃO", "DESCRICAO"])
    mapa_col = _find_column(mapas_df, ["mapa_num"])
    valor_col = _find_column(mapas_df, ["valor_alocado"])

    working = mapas_df.copy()
    working[valor_col] = pd.to_numeric(working[valor_col], errors="coerce")

    items = [
        {
            "item": str(row[item_col]),
            "subitem": str(row[subitem_col]) if subitem_col else "",
            "descricao": str(row[descricao_col]),
            "mapa_num": int(row[mapa_col]) if pd.notna(row[mapa_col]) else 0,
            "valor_alocado": round(float(row[valor_col]), 2) if pd.notna(row[valor_col]) else 0.0,
        }
        for _, row in working.iterrows()
    ]
    return {"items": items}


@router.get("/orcamento/{session_id}/variancia")
async def get_orcamento_variancia(session_id: str) -> dict[str, Any]:
    realizado_df = _get_non_empty_frame(session_id, ["orcado_realizado"], "orcado x realizado")
    item_col = _find_column(realizado_df, ["ITEM/SUBITEM", "ITEM SUBITEM"], required=False)
    descricao_col = _find_column(realizado_df, ["DESCRIÇÃO", "DESCRICAO"])
    verba_col = _find_column(realizado_df, ["VERBA TOTAL CUSTO DIRETO"])
    realizado_col = _find_column(realizado_df, ["realizado"])

    working = realizado_df.copy()
    working[verba_col] = pd.to_numeric(working[verba_col], errors="coerce").fillna(0)
    working[realizado_col] = pd.to_numeric(working[realizado_col], errors="coerce").fillna(0)

    group_cols = [descricao_col, verba_col]
    if item_col:
        group_cols.insert(0, item_col)
    grouped = working.groupby(group_cols, dropna=False)[realizado_col].sum().reset_index()

    items: list[dict[str, Any]] = []
    for _, row in grouped.iterrows():
        verba_total = float(row[verba_col])
        realizado = float(row[realizado_col])
        variancia = round(realizado - verba_total, 2)
        variancia_pct = round((variancia / verba_total) * 100, 2) if verba_total else 0.0
        items.append(
            {
                "item": str(row[item_col]) if item_col else str(row[descricao_col]),
                "descricao": str(row[descricao_col]),
                "verba_total": round(verba_total, 2),
                "realizado": round(realizado, 2),
                "variancia": variancia,
                "variancia_pct": variancia_pct,
            }
        )
    return {"items": items}


@router.get("/orcamento/{session_id}/evolucao_mensal")
async def get_orcamento_evolucao_mensal(session_id: str) -> dict[str, Any]:
    realizado_df = _get_non_empty_frame(session_id, ["orcado_realizado"], "orcado x realizado")
    mes_col = _find_column(realizado_df, ["mes"])
    realizado_col = _find_column(realizado_df, ["realizado"])

    working = realizado_df.copy()
    working[mes_col] = pd.to_numeric(working[mes_col], errors="coerce")
    working[realizado_col] = pd.to_numeric(working[realizado_col], errors="coerce").fillna(0)
    grouped = working.groupby(mes_col)[realizado_col].sum().reset_index().sort_values(mes_col)
    grouped["realizado_acumulado"] = grouped[realizado_col].cumsum()

    months = [
        {"mes": int(row[mes_col]), "realizado_acumulado": round(float(row["realizado_acumulado"]), 2)}
        for _, row in grouped.iterrows()
        if pd.notna(row[mes_col])
    ]
    return {"months": months}
