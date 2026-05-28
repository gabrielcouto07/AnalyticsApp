from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import pandas as pd
from backend.session import get_session

router = APIRouter(prefix="/api/charts", tags=["charts"])


def _get_df(session_id: str):
    df = get_session(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada.")
    return df


class TemporalRequest(BaseModel):
    date_col: str
    metric_col: str
    granularity: str = "ME"   # D, W, ME, QE, YE


@router.post("/{session_id}/temporal")
def chart_temporal(session_id: str, body: TemporalRequest):
    df = _get_df(session_id)

    ts = (
        df.set_index(body.date_col)[body.metric_col]
        .resample(body.granularity)
        .sum()
        .reset_index()
    )
    ts["cumulative"] = ts[body.metric_col].cumsum()
    # Datas precisam virar string para serialização JSON
    ts[body.date_col] = ts[body.date_col].astype(str)

    return {"data": ts.to_dict(orient="records")}


class CrossRequest(BaseModel):
    cat_col: str
    num_col: str
    agg_fn: str = "sum"   # sum, mean, count, max, min
    top_n: int = 20


@router.post("/{session_id}/cross")
def chart_cross(session_id: str, body: CrossRequest):
    df = _get_df(session_id)
    grp = (
        df.groupby(body.cat_col)[body.num_col]
        .agg(body.agg_fn)
        .reset_index()
        .rename(columns={body.num_col: body.agg_fn})
        .sort_values(body.agg_fn, ascending=False)
        .head(body.top_n)
    )
    return {"data": grp.to_dict(orient="records")}


@router.get("/{session_id}/correlation")
def chart_correlation(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(num_cols) < 2:
        return {"data": [], "columns": []}
    corr = df[num_cols].corr().round(3)
    return {
        "columns": num_cols,
        "data": corr.values.tolist(),
    }
