import re
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.session import get_dataset, get_session, get_session_meta
from backend.services.analytics import calculate_trend, categorize_dataset, detect_outliers_iqr
from backend.services.parser import get_col_types
from backend.services.serialize import build_view, df_records

router = APIRouter(prefix="/api/data", tags=["data"])

_CURRENCY_NAME_RE = re.compile(r"valor|total|receita|fatur|preço|preco|r\$", re.I)
# Colunas de período (Ano/Mês) são numéricas mas não fazem sentido como KPI (Σ ano = nonsense)
_PERIOD_NAME_RE = re.compile(r"^(ano|m[êe]s|year|month|dia|day)$", re.I)


def _get_df(session_id: str):
    df = get_session(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada. Faça o upload novamente.")
    return df


def _meta(session_id: str) -> dict:
    return get_session_meta(session_id) or {}


@router.get("/{session_id}/stats")
def get_stats(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not num_cols:
        return {"stats": {}}
    stats = df[num_cols].describe().round(4)
    stats = stats.astype(object).where(pd.notna(stats), None)
    return {"stats": stats.to_dict()}


def _monthly_trend_pct(df: pd.DataFrame, date_col: str, metric_col: str) -> Optional[float]:
    """Variação % do último mês vs mês anterior (agregado mensal tipado)."""
    try:
        series = df.dropna(subset=[date_col]).set_index(date_col)[metric_col]
        monthly = series.resample("ME").sum()
        monthly = monthly[monthly.notna()]
        if len(monthly) < 2:
            return None
        pct = calculate_trend(monthly)["change_pct"]
        return round(float(pct), 2)
    except Exception:
        return None


@router.get("/{session_id}/kpis")
def get_kpis(session_id: str):
    df = _get_df(session_id)
    meta = _meta(session_id)
    useful = meta.get("meaningful_columns") or list(df.columns)
    col_types = get_col_types(df[[c for c in useful if c in df.columns]])
    kpis = []

    # Colunas monetárias primeiro — são os KPIs que interessam por padrão
    numeric = sorted(
        (c for c in col_types["numeric"] if not _PERIOD_NAME_RE.match(str(c))),
        key=lambda c: 0 if _CURRENCY_NAME_RE.search(str(c)) else 1,
    )

    for col in numeric[:4]:
        values = df[col].dropna()
        if values.empty:
            continue
        trend = None
        if col_types["date"]:
            trend = _monthly_trend_pct(df, col_types["date"][0], col)
        kpis.append({
            "title": col,
            "total": float(values.sum()),
            "mean": float(values.mean()),
            "trend": trend,
            "format": "currency" if _CURRENCY_NAME_RE.search(str(col)) else "number",
        })

    dataset_type = categorize_dataset(df)
    return {"kpis": kpis, "dataset_type": dataset_type, "model": meta.get("model", "generic")}


@router.get("/{session_id}/quality")
def get_quality(session_id: str):
    df = _get_df(session_id)
    quality = []
    for col in df.columns:
        non_null = df[col].dropna()
        quality.append({
            "column": col,
            "type": str(df[col].dtype),
            "nulls": int(df[col].isnull().sum()),
            "null_pct": round(float(df[col].isnull().mean() * 100), 1),
            "unique": int(df[col].nunique()),
            "sample": str(non_null.iloc[0]) if len(non_null) > 0 else "—",
        })
    return {"quality": quality}


@router.get("/{session_id}/outliers/{column}")
def get_outliers(session_id: str, column: str):
    df = _get_df(session_id)
    if column not in df.columns:
        raise HTTPException(404, f"Coluna '{column}' não encontrada.")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise HTTPException(400, f"Coluna '{column}' não é numérica.")
    indices, pct = detect_outliers_iqr(df[column].dropna())
    return {"outliers": {"count": len(indices), "pct": round(float(pct), 2)}}


@router.get("/{session_id}/table")
def get_table(
    session_id: str,
    dataset: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: Optional[str] = None,
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    columns: Optional[str] = None,
    search: Optional[str] = None,
):
    """Visão paginada/ordenável de um dataset (para tabelas de 13k+ linhas)."""
    df = get_dataset(session_id, dataset)
    if df is None:
        raise HTTPException(404, "Sessão ou dataset não encontrado.")

    all_columns = [{"name": str(c), "dtype": str(df[c].dtype)} for c in df.columns]

    wanted = [c.strip() for c in columns.split(",")] if columns else None
    view = build_view(df, columns=wanted, sort_by=sort_by, sort_dir=sort_dir)

    if search:
        text_cols = [c for c in view.columns
                     if not pd.api.types.is_numeric_dtype(view[c])
                     and not pd.api.types.is_datetime64_any_dtype(view[c])]
        if text_cols:
            mask = pd.Series(False, index=view.index)
            for c in text_cols:
                mask |= view[c].astype("string").str.contains(search, case=False, na=False)
            view = view[mask]

    total = len(view)
    start = (page - 1) * page_size
    rows = df_records(view.iloc[start:start + page_size])

    meta = _meta(session_id)
    return {
        "rows": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "columns": all_columns,
        "meaningful_columns": meta.get("meaningful_columns", []),
        "datasets": list(meta.get("datasets", {}).keys()),
    }


def _mask_eq(series: pd.Series, value) -> pd.Series:
    """Comparação segura para colunas Int64 com NA (NA nunca casa)."""
    return series.eq(value).fillna(False)


def _sum_group(df: pd.DataFrame, group_col: str, value_col: str, top: int = 10) -> list[dict]:
    if group_col not in df.columns or value_col not in df.columns or df.empty:
        return []
    grouped = (
        df.dropna(subset=[group_col])
        .groupby(group_col, observed=True)[value_col]
        .sum()
        .sort_values(ascending=False)
        .head(top)
        .round(2)
    )
    return [{"name": str(k), "value": float(v)} for k, v in grouped.items()]


@router.get("/{session_id}/dashboard")
def get_dashboard(
    session_id: str,
    ano: Optional[int] = None,
    mes: Optional[int] = Query(None, ge=1, le=12),
    excluir_intercompany: bool = False,
):
    """Dashboard executivo da tabela fato (modelo fiscal/vendas).

    Filtro de período com MÊS (1-12, opcional = ano inteiro) e ANO separados —
    numéricos, nunca texto 'MM/AAAA' (evita a conversão silenciosa do Excel).
    Comparativo anual: mesmo período do ano anterior + acumulado do ano (YTD).
    """
    meta = _meta(session_id)
    if meta.get("model") != "medical_fiscal":
        raise HTTPException(400, "Dashboard disponível apenas para o modelo fiscal (tabela fato).")

    fact = _get_df(session_id)
    if excluir_intercompany and "CNPJ Excluído" in fact.columns:
        fact = fact[fact["CNPJ Excluído"] != "Sim"]

    anos = sorted(int(a) for a in fact["Ano"].dropna().unique())
    if not anos:
        raise HTTPException(422, "Nenhum período válido encontrado nos dados.")
    if ano is None:
        ano = anos[-1]

    def _tipo_total(df: pd.DataFrame, tipo: str) -> float:
        sub = df[_mask_eq(df["Tipo Movimento"], tipo)]
        value = sub["Valor (R$)"].sum()
        return round(float(0.0 if pd.isna(value) else value), 2)

    def _period(df: pd.DataFrame, year: int, month: Optional[int]) -> pd.DataFrame:
        mask = _mask_eq(df["Ano"], year)
        if month is not None:
            mask &= _mask_eq(df["Mês"], month)
        return df[mask]

    atual = _period(fact, ano, mes)
    anterior = _period(fact, ano - 1, mes)

    saida = _tipo_total(atual, "Saída")
    entrada = _tipo_total(atual, "Entrada")
    saida_anterior = _tipo_total(anterior, "Saída")

    def _pct(current: float, previous: float) -> Optional[float]:
        if previous == 0:
            return None  # sem base de comparação — não inventamos número
        return round((current - previous) / abs(previous) * 100, 1)

    # Acumulado do ano até o mês selecionado (ou ano inteiro)
    def _ytd(df: pd.DataFrame, year: int) -> float:
        mask = _mask_eq(df["Ano"], year) & _mask_eq(df["Tipo Movimento"], "Saída")
        if mes is not None:
            mask &= df["Mês"].le(mes).fillna(False)
        value = df[mask]["Valor (R$)"].sum()
        return round(float(0.0 if pd.isna(value) else value), 2)

    ytd = _ytd(fact, ano)
    ytd_anterior = _ytd(fact, ano - 1)

    saida_df = atual[_mask_eq(atual["Tipo Movimento"], "Saída")]

    # Evolução mensal: Saída/Entrada do ano + Saída do ano anterior
    mensal = []
    ano_df = fact[_mask_eq(fact["Ano"], ano)]
    ano_ant_df = fact[_mask_eq(fact["Ano"], ano - 1)]
    for m in range(1, 13):
        mensal.append({
            "mes": m,
            "saida": _tipo_total(ano_df[_mask_eq(ano_df["Mês"], m)], "Saída"),
            "entrada": _tipo_total(ano_df[_mask_eq(ano_df["Mês"], m)], "Entrada"),
            "saida_ano_anterior": _tipo_total(ano_ant_df[_mask_eq(ano_ant_df["Mês"], m)], "Saída"),
        })

    return {
        "filtros": {"ano": ano, "mes": mes, "anos_disponiveis": anos,
                    "excluir_intercompany": excluir_intercompany},
        "kpis": {
            "saida": saida,
            "entrada": entrada,
            "liquido": round(saida - entrada, 2),
            "venda": _tipo_total(atual, "Venda"),
            "documentos": int(len(saida_df)),
            "variacao_ano_anterior": _pct(saida, saida_anterior),
            "saida_ano_anterior": saida_anterior,
            "ytd": ytd,
            "ytd_ano_anterior": ytd_anterior,
            "variacao_ytd": _pct(ytd, ytd_anterior),
        },
        "mensal": mensal,
        "por_linha_negocio": _sum_group(saida_df, "Linha de Negócio", "Valor (R$)", top=12),
        "por_uf": _sum_group(saida_df, "UF", "Valor (R$)", top=15),
        "por_vendedor": _sum_group(saida_df, "Vendedor", "Valor (R$)", top=10),
        "top_clientes": _sum_group(saida_df, "Cliente/Fornecedor", "Valor (R$)", top=10),
    }
