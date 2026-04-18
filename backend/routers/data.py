import logging
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from ..session import get_active_df, get_session
from ..services.analytics import calculate_kpis, calculate_stats, calculate_quality
from ..services.semantic import SemanticAnalyzer

router = APIRouter(prefix="/api/data", tags=["data"])
logger = logging.getLogger(__name__)


def _get_df(session_id: str):
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Session not found")
    return df


@router.get("/{session_id}/stats")
def get_stats(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not num_cols:
        return {"stats": {}}
    stats = df[num_cols].describe().round(4).to_dict()
    # Remover NaN e inf
    clean_stats = {}
    for col, col_stats in stats.items():
        clean_stats[col] = {}
        for key, val in col_stats.items():
            if pd.isna(val) or np.isinf(val):
                clean_stats[col][key] = None
            else:
                clean_stats[col][key] = float(val)
    return {"stats": clean_stats}


@router.get("/{session_id}/kpis")
def get_kpis(session_id: str):
    df = _get_df(session_id)
    kpis = calculate_kpis(df)
    return {"kpis": kpis}


@router.get("/{session_id}/quality")
def get_quality(session_id: str):
    df = _get_df(session_id)
    quality = calculate_quality(df)
    return {"quality": quality}


@router.get("/{session_id}/outliers/{column}")
def get_outliers(session_id: str, column: str):
    df = _get_df(session_id)
    if column not in df.columns:
        raise HTTPException(404, "Column not found")
    try:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)
        return {"outliers": series[mask].tolist()}
    except Exception as e:
        logger.error(f"Outlier error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/semantic")
def get_semantic(session_id: str):
    df = _get_df(session_id)
    analyzer = SemanticAnalyzer()
    result = analyzer.build_dataset_profile(df)
    return {"dataset_profile": result}


@router.get("/{session_id}/insights")
async def get_insights(session_id: str):
    from ..services.insights import generate_insights
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=422, detail="Session not found")
    df = getattr(session, "df_filtered", None) or session.df
    try:
        insights = generate_insights(df)
        return {"insights": insights}
    except Exception as e:
        logger.error(f"Insights error: {e}")
        raise HTTPException(500, str(e))
