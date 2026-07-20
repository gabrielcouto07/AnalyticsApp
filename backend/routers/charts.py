from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.session import get_session
from backend.services.serialize import json_safe

router = APIRouter(prefix="/api/charts", tags=["charts"])

_GRANULARITIES = {"D", "W", "ME", "QE", "YE"}
_AGG_FNS = {"sum", "mean", "count", "max", "min"}


def _get_df(session_id: str):
    df = get_session(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada.")
    return df


def _require_column(df, col: str):
    if col not in df.columns:
        raise HTTPException(404, f"Coluna '{col}' não encontrada.")


class TemporalRequest(BaseModel):
    date_col: str
    metric_col: str
    granularity: str = "ME"   # D, W, ME, QE, YE


@router.post("/{session_id}/temporal")
def chart_temporal(session_id: str, body: TemporalRequest):
    df = _get_df(session_id)
    _require_column(df, body.date_col)
    _require_column(df, body.metric_col)
    if body.granularity not in _GRANULARITIES:
        raise HTTPException(422, f"Granularidade inválida: {body.granularity}")
    if not pd.api.types.is_datetime64_any_dtype(df[body.date_col]):
        raise HTTPException(400, f"Coluna '{body.date_col}' não é de datas.")
    if not pd.api.types.is_numeric_dtype(df[body.metric_col]):
        raise HTTPException(400, f"Coluna '{body.metric_col}' não é numérica.")

    ts = (
        df.dropna(subset=[body.date_col])
        .set_index(body.date_col)[body.metric_col]
        .resample(body.granularity)
        .sum()
        .reset_index()
    )
    ts["cumulative"] = ts[body.metric_col].cumsum()
    # Datas precisam virar string para serialização JSON
    ts[body.date_col] = ts[body.date_col].dt.strftime("%Y-%m-%d")

    return json_safe({"data": ts.to_dict(orient="records")})


class CrossRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_fn: str = "sum"   # sum, mean, count, max, min
    top_n: int = Field(20, ge=1, le=100)


@router.post("/{session_id}/cross")
def chart_cross(session_id: str, body: CrossRequest):
    df = _get_df(session_id)
    _require_column(df, body.cat_col)
    _require_column(df, body.num_col)
    if body.agg_fn not in _AGG_FNS:
        raise HTTPException(422, f"Agregação inválida: {body.agg_fn}")
    if body.agg_fn != "count" and not pd.api.types.is_numeric_dtype(df[body.num_col]):
        raise HTTPException(400, f"Coluna '{body.num_col}' não é numérica.")

    grp = (
        df.dropna(subset=[body.cat_col])
        .groupby(body.cat_col, observed=True)[body.num_col]
        .agg(body.agg_fn)
        .reset_index()
        .rename(columns={body.num_col: body.agg_fn})
        .sort_values(body.agg_fn, ascending=False)
        .head(body.top_n)
    )
    grp[body.cat_col] = grp[body.cat_col].astype(str)
    return json_safe({"data": grp.to_dict(orient="records")})


class DistributionRequest(BaseModel):
    column: str
    bins: int = Field(30, ge=5, le=100)


@router.post("/{session_id}/distribution")
def chart_distribution(session_id: str, body: DistributionRequest):
    """Histograma + estatísticas descritivas de uma coluna numérica."""
    df = _get_df(session_id)
    _require_column(df, body.column)
    if not pd.api.types.is_numeric_dtype(df[body.column]):
        raise HTTPException(400, f"Coluna '{body.column}' não é numérica.")

    values = df[body.column].dropna()
    values = values[np.isfinite(values)]
    if values.empty:
        return {"bins": [], "stats": None}

    counts, edges = np.histogram(values, bins=body.bins)
    bins = [
        {"x0": round(float(edges[i]), 6), "x1": round(float(edges[i + 1]), 6), "count": int(c)}
        for i, c in enumerate(counts)
    ]
    stats = {
        "count": int(values.count()),
        "mean": float(values.mean()),
        "median": float(values.median()),
        "std": float(values.std()) if len(values) > 1 else 0.0,
        "min": float(values.min()),
        "max": float(values.max()),
        "q1": float(values.quantile(0.25)),
        "q3": float(values.quantile(0.75)),
    }
    return json_safe({"bins": bins, "stats": stats})


@router.get("/{session_id}/correlation")
def chart_correlation(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Colunas constantes geram NaN na correlação — ficam de fora
    num_cols = [c for c in num_cols if df[c].nunique(dropna=True) > 1]
    if len(num_cols) < 2:
        return {"data": [], "columns": []}
    num_cols = num_cols[:30]  # matriz legível; 305 colunas não cabem num heatmap
    corr = df[num_cols].corr().round(3)
    corr = corr.where(pd.notna(corr), None)
    return {
        "columns": num_cols,
        "data": [[v if v is not None else None for v in row] for row in corr.values.tolist()],
    }
