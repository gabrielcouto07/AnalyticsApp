"""
Endpoints de Análises Avançadas - FASE 3
Anomalias, Clustering, Tendências, Segmentação
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any, Optional, List
import pandas as pd
import numpy as np

from ..session import get_session, get_active_df
from ..services.advanced_analytics import (
    analyze_anomalies,
    analyze_trends,
    analyze_clustering,
    segment_data
)

router = APIRouter(prefix="/api/advanced", tags=["advanced"])
logger = logging.getLogger(__name__)


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, pd.DataFrame):
        return _json_safe(value.to_dict(orient="records"))
    if isinstance(value, pd.Series):
        return _json_safe(value.tolist())
    if isinstance(value, np.ndarray):
        return _json_safe(value.tolist())
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
    if isinstance(value, float):
        return value if np.isfinite(value) else None
    if pd.isna(value) if not isinstance(value, (str, bytes, bool)) else False:
        return None
    return value


def _get_df_or_404(session_id: str) -> pd.DataFrame:
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Session not found")
    return df


def _validate_column(df: pd.DataFrame, column: str) -> None:
    if column not in df.columns:
        raise HTTPException(422, f"Column '{column}' not found")


def _normalise_methods(methods: str | None) -> List[str]:
    raw_methods = methods or "iqr,zscore"
    aliases = {
        "forest": "isolation_forest",
        "isolationforest": "isolation_forest",
        "isolation-forest": "isolation_forest",
    }
    result: List[str] = []
    for item in raw_methods.split(","):
        method = item.strip().lower()
        if not method:
            continue
        result.append(aliases.get(method, method))
    return result or ["iqr", "zscore"]


def _anomaly_points(
    df: pd.DataFrame,
    column: str,
    results: dict[str, Any],
    limit: int = 5000,
) -> list[dict[str, Any]]:
    numeric = pd.to_numeric(df[column], errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return []

    anomaly_indices: set[Any] = set()

    iqr = results.get("iqr") or {}
    bounds = iqr.get("bounds") or {}
    lower = bounds.get("lower")
    upper = bounds.get("upper")
    if lower is not None and upper is not None:
        mask = (valid < float(lower)) | (valid > float(upper))
        anomaly_indices.update(valid[mask].index.tolist())

    zscore = results.get("zscore") or {}
    mean = zscore.get("mean")
    std = zscore.get("std")
    threshold = zscore.get("threshold", 3.0)
    if mean is not None and std not in (None, 0):
        mask = ((valid - float(mean)) / float(std)).abs() > float(threshold)
        anomaly_indices.update(valid[mask].index.tolist())

    points = []
    sampled = valid.iloc[:limit]
    for pos, (idx, value) in enumerate(sampled.items()):
        points.append({
            "index": int(pos),
            "row_index": int(idx) if isinstance(idx, (int, np.integer)) else str(idx),
            "value": round(float(value), 6),
            "is_anomaly": idx in anomaly_indices,
        })
    return points


def _linear_fit(series: pd.Series) -> dict[str, float]:
    values = pd.to_numeric(series, errors="coerce").dropna()
    if len(values) < 2:
        return {}
    x = np.arange(len(values), dtype=float)
    slope, intercept = np.polyfit(x, values.to_numpy(dtype=float), 1)
    return {
        "slope": round(float(slope), 6),
        "intercept": round(float(intercept), 6),
    }


@router.get("/{session_id}/columns")
async def get_advanced_columns(session_id: str):
    df = _get_df_or_404(session_id)
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    return {
        "numeric_columns": numeric_cols,
        "all_columns": df.columns.tolist(),
    }


@router.get("/{session_id}/anomalies")
async def get_anomalies(
    session_id: str,
    column: str = Query(...),
    methods: str = Query("iqr,zscore"),
):
    try:
        df = _get_df_or_404(session_id)
        _validate_column(df, column)
        methods_list = _normalise_methods(methods)
        results = analyze_anomalies(df, column, methods_list)
        return _json_safe({
            "anomaly_analysis": results,
            "data_points": _anomaly_points(df, column, results),
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[anomalies:get] error: {e}", exc_info=True)
        raise HTTPException(500, f"Anomaly detection failed: {str(e)}")


@router.get("/{session_id}/trends")
async def get_trends(
    session_id: str,
    column: str = Query(...),
    window: int = Query(5, ge=2),
):
    try:
        df = _get_df_or_404(session_id)
        _validate_column(df, column)
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if len(series) < 2:
            raise HTTPException(422, "Insufficient valid data for trend analysis")

        result = analyze_trends(series)
        fit = _linear_fit(series)
        for key, value in fit.items():
            result.setdefault(key, value)
        result["window"] = window
        result["values"] = [
            {"index": int(i), "value": round(float(value), 6)}
            for i, value in enumerate(series.iloc[:5000].tolist())
        ]

        return _json_safe({"trend_analysis": result})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[trends:get] error: {e}", exc_info=True)
        raise HTTPException(500, f"Trend analysis failed: {str(e)}")


@router.get("/{session_id}/segmentation")
async def get_segmentation(
    session_id: str,
    column: str = Query(...),
    method: str = Query("quartiles"),
    thresholds: str = Query(""),
):
    try:
        df = _get_df_or_404(session_id)
        _validate_column(df, column)
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if len(series) == 0:
            raise HTTPException(422, "No valid numeric data in column")

        parsed_thresholds = None
        if thresholds:
            parsed_thresholds = [float(t.strip()) for t in thresholds.split(",") if t.strip()]

        result = segment_data(series, method, parsed_thresholds)
        return _json_safe({"segmentation_analysis": result})
    except ValueError:
        raise HTTPException(422, "Invalid thresholds")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[segmentation:get] error: {e}", exc_info=True)
        raise HTTPException(500, f"Segmentation failed: {str(e)}")


@router.get("/{session_id}/clustering")
async def get_clustering(
    session_id: str,
    n_clusters: int = Query(3, ge=2, le=12),
):
    try:
        df = _get_df_or_404(session_id)
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty:
            raise HTTPException(422, "No numeric columns found")

        results = analyze_clustering(df, n_clusters)
        return _json_safe({"clustering_analysis": results})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[clustering:get] error: {e}", exc_info=True)
        raise HTTPException(500, f"Clustering analysis failed: {str(e)}")


# ─── Request Models ────────────────────────────────────────────────────────────

class AnomalyRequest(BaseModel):
    column: str
    methods: Optional[List[str]] = None  # ["iqr", "zscore", "isolation_forest"]


class TrendRequest(BaseModel):
    column: str
    window: int = 5


class ClusteringRequest(BaseModel):
    n_clusters: int = 3


class SegmentationRequest(BaseModel):
    column: str
    method: str = "quartiles"  # "quartiles" or "threshold"
    thresholds: Optional[List[float]] = None


# ─── Anomaly Detection ─────────────────────────────────────────────────────────

@router.post("/{session_id}/anomalies")
async def detect_anomalies(session_id: str, body: AnomalyRequest):
    """
    Detecta anomalias em uma coluna usando múltiplos métodos.
    
    Métodos disponíveis:
    - iqr: Interquartile Range
    - zscore: Z-Score
    - isolation_forest: Isolation Forest
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        if body.column not in df.columns:
            raise HTTPException(422, f"Column '{body.column}' not found")
        
        results = analyze_anomalies(df, body.column, body.methods)
        
        logger.info(f"[anomalies] column={body.column} | methods={body.methods}")
        return {"anomaly_analysis": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[anomalies] error: {e}", exc_info=True)
        raise HTTPException(500, f"Anomaly detection failed: {str(e)}")


# ─── Trend Analysis ───────────────────────────────────────────────────────────

@router.post("/{session_id}/trends")
async def detect_trends(session_id: str, body: TrendRequest):
    """
    Detecta tendências em uma série.
    
    Retorna:
    - direction: "up", "down" ou "flat"
    - strength: "forte", "moderada" ou "fraca"
    - slope: inclinação da reta
    - r_squared: coeficiente de determinação
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        if body.column not in df.columns:
            raise HTTPException(422, f"Column '{body.column}' not found")
        
        series = pd.to_numeric(df[body.column], errors="coerce").dropna()
        if len(series) < 2:
            raise HTTPException(422, "Insufficient valid data for trend analysis")
        
        trend_result = analyze_trends(series)
        
        logger.info(f"[trends] column={body.column} | direction={trend_result.get('direction')}")
        return {"trend_analysis": trend_result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[trends] error: {e}", exc_info=True)
        raise HTTPException(500, f"Trend analysis failed: {str(e)}")


# ─── Clustering ───────────────────────────────────────────────────────────────

@router.post("/{session_id}/clustering")
async def perform_clustering(session_id: str, body: ClusteringRequest):
    """
    Realiza análise de clustering nos dados numéricos.
    
    Retorna:
    - K-Means: silhouette_score, inertia, cluster_sizes
    - PCA: explained_variance, cumulative_explained_variance
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty:
            raise HTTPException(422, "No numeric columns found")
        
        results = analyze_clustering(df, body.n_clusters)
        
        logger.info(f"[clustering] n_clusters={body.n_clusters}")
        return {"clustering_analysis": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[clustering] error: {e}", exc_info=True)
        raise HTTPException(500, f"Clustering analysis failed: {str(e)}")


# ─── Segmentation ──────────────────────────────────────────────────────────────

@router.post("/{session_id}/segmentation")
async def segment_data_endpoint(session_id: str, body: SegmentationRequest):
    """
    Segmenta dados em grupos.
    
    Métodos:
    - "quartiles": Divide em Q1, Q2, Q3, Q4
    - "threshold": Divide por limiares customizados
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        if body.column not in df.columns:
            raise HTTPException(422, f"Column '{body.column}' not found")
        
        series = pd.to_numeric(df[body.column], errors="coerce").dropna()
        if len(series) == 0:
            raise HTTPException(422, "No valid numeric data in column")
        
        result = segment_data(series, body.method, body.thresholds)
        
        logger.info(f"[segmentation] column={body.column} | method={body.method}")
        return {"segmentation_analysis": result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[segmentation] error: {e}", exc_info=True)
        raise HTTPException(500, f"Segmentation failed: {str(e)}")


# ─── Comparison: Anomaly Methods ──────────────────────────────────────────────

@router.get("/{session_id}/anomalies/compare/{column}")
async def compare_anomaly_methods(session_id: str, column: str):
    """
    Compara todos os métodos de detecção de anomalias para uma coluna.
    """
    try:
        df = get_active_df(session_id)
        if df is None:
            raise HTTPException(404, "Session not found")
        
        if column not in df.columns:
            raise HTTPException(422, f"Column '{column}' not found")
        
        results = analyze_anomalies(df, column, ["iqr", "zscore", "isolation_forest"])
        
        # Resumo comparativo
        summary = {
            "column": column,
            "dtype": str(df[column].dtype),
            "non_null_count": int(df[column].notna().sum()),
            "null_count": int(df[column].isna().sum()),
            "methods_compared": list(results.keys())
        }
        
        logger.info(f"[anomalies/compare] column={column}")
        return {"comparison": summary, "detailed_results": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[anomalies/compare] error: {e}", exc_info=True)
        raise HTTPException(500, f"Anomaly comparison failed: {str(e)}")
