from fastapi import APIRouter, HTTPException
import numpy as np
from backend.session import get_session
from backend.services.parser import get_col_types
from backend.services.analytics import calculate_trend, categorize_dataset, detect_outliers_iqr

router = APIRouter(prefix="/api/data", tags=["data"])


def _get_df(session_id: str):
    df = get_session(session_id)
    if df is None:
        raise HTTPException(404, "Sessão não encontrada. Faça o upload novamente.")
    return df


@router.get("/{session_id}/stats")
def get_stats(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not num_cols:
        return {"stats": {}}
    stats = df[num_cols].describe().round(4).to_dict()
    return {"stats": stats}


@router.get("/{session_id}/kpis")
def get_kpis(session_id: str):
    df = _get_df(session_id)
    col_types = get_col_types(df)
    kpis = []

    for col in col_types["numeric"][:4]:
        total = float(df[col].sum())
        mean = float(df[col].mean())
        trend = None

        # Calcula trend se houver coluna de data
        if col_types["date"]:
            try:
                trend = calculate_trend(df, col_types["date"][0], col)
            except Exception:
                pass

        kpis.append({
            "title": col,
            "total": total,
            "mean": mean,
            "trend": trend,
        })

    dataset_type = categorize_dataset(df)
    return {"kpis": kpis, "dataset_type": dataset_type}


@router.get("/{session_id}/quality")
def get_quality(session_id: str):
    df = _get_df(session_id)
    quality = []
    for col in df.columns:
        quality.append({
            "column": col,
            "type": str(df[col].dtype),
            "nulls": int(df[col].isnull().sum()),
            "null_pct": round(df[col].isnull().mean() * 100, 1),
            "unique": int(df[col].nunique()),
            "sample": str(df[col].dropna().iloc[0]) if df[col].dropna().shape[0] > 0 else "—",
        })
    return {"quality": quality}


@router.get("/{session_id}/outliers/{column}")
def get_outliers(session_id: str, column: str):
    df = _get_df(session_id)
    if column not in df.columns:
        raise HTTPException(404, f"Coluna '{column}' não encontrada.")
    result = detect_outliers_iqr(df, column)
    return {"outliers": result}
