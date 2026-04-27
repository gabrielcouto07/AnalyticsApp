"""
Endpoints de Análises Avançadas - FASE 3
Anomalias, Clustering, Tendências, Segmentação
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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
