import logging
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from ..session import get_active_df, get_session
from ..services.analytics import (
    calculate_kpis, calculate_stats, calculate_quality,
    get_column_distributions, get_correlations, detect_anomalies,
    get_categorical_insights, generate_data_profile, get_summary_statistics
)
from ..services.semantic import SemanticAnalyzer

router = APIRouter(prefix="/api/data", tags=["data"])
logger = logging.getLogger(__name__)


def _get_df(session_id: str):
    df = get_active_df(session_id)
    if df is None:
        raise HTTPException(404, "Session not found")
    return df


def _get_session_df(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=422, detail="Session not found")
    df = session.df_filtered if session.df_filtered is not None else session.df
    return session, df


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
    df = session.df_filtered if session.df_filtered is not None else session.df
    try:
        insights = generate_insights(df)
        return {"insights": insights}
    except Exception as e:
        logger.error(f"Insights error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/audit")
def get_audit_trail(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=422, detail=f"Session '{session_id}' not found")
    if not hasattr(session, "audit") or session.audit is None:
        return {"steps": [], "message": "No audit trail available for this session."}
    return {"steps": session.audit.to_dict(), "total_steps": len(session.audit.steps)}


# ============================================================================
# COMPREHENSIVE ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/{session_id}/profile/complete")
def get_complete_profile(session_id: str):
    """Get comprehensive data profile with all analytics."""
    df = _get_df(session_id)
    try:
        profile = generate_data_profile(df)
        return {
            "profile": profile,
            "timestamp": pd.Timestamp.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Profile error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/distributions")
def get_distributions(session_id: str):
    """Get distribution statistics for numeric columns."""
    df = _get_df(session_id)
    try:
        distributions = get_column_distributions(df)
        return {"distributions": distributions}
    except Exception as e:
        logger.error(f"Distributions error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/correlation")
def get_correlation_matrix(session_id: str):
    """Get correlation matrix for numeric columns."""
    df = _get_df(session_id)
    try:
        correlations = get_correlations(df)
        return {"correlations": correlations}
    except Exception as e:
        logger.error(f"Correlation error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/anomalies")
def get_data_anomalies(session_id: str, threshold: float = 3.0):
    """Detect anomalies in numeric columns."""
    df = _get_df(session_id)
    try:
        anomalies = detect_anomalies(df, threshold=threshold)
        return {"anomalies": anomalies}
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/categorical")
def get_categorical_analysis(session_id: str):
    """Get detailed analysis of categorical columns."""
    df = _get_df(session_id)
    try:
        categorical_data = get_categorical_insights(df)
        return {"categorical_analysis": categorical_data}
    except Exception as e:
        logger.error(f"Categorical analysis error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/summary")
def get_full_summary(session_id: str):
    """Get complete summary statistics and KPIs."""
    df = _get_df(session_id)
    try:
        summary = get_summary_statistics(df)
        return {
            "summary": summary,
            "rows": len(df),
            "columns": len(df.columns),
        }
    except Exception as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/views/available")
def get_available_views(session_id: str):
    """Get list of available dashboard views."""
    df = _get_df(session_id)
    try:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=["object"]).columns.tolist()
        date_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
        
        views = {
            "overview": {
                "id": "overview",
                "label": "Overview",
                "icon": "📊",
                "description": "High-level data summary with KPIs and quality metrics",
                "requires": {"numeric_cols": len(numeric_cols) > 0},
            },
            "distribution": {
                "id": "distribution",
                "label": "Distribution Analysis",
                "icon": "📉",
                "description": "Histograms and distribution analysis for numeric columns",
                "requires": {"numeric_cols": len(numeric_cols) > 0},
            },
            "correlation": {
                "id": "correlation",
                "label": "Correlation Matrix",
                "icon": "🔗",
                "description": "Heatmap showing correlations between numeric columns",
                "requires": {"numeric_cols": len(numeric_cols) >= 2},
            },
            "categorical": {
                "id": "categorical",
                "label": "Categorical Analysis",
                "icon": "🏷️",
                "description": "Top values and frequency analysis for text columns",
                "requires": {"categorical_cols": len(categorical_cols) > 0},
            },
            "temporal": {
                "id": "temporal",
                "label": "Temporal Analysis",
                "icon": "📈",
                "description": "Time series and trend analysis",
                "requires": {"date_cols": len(date_cols) > 0},
            },
            "anomalies": {
                "id": "anomalies",
                "label": "Anomaly Detection",
                "icon": "⚠️",
                "description": "Statistical anomaly detection in numeric data",
                "requires": {"numeric_cols": len(numeric_cols) > 0},
            },
            "quality": {
                "id": "quality",
                "label": "Data Quality",
                "icon": "✅",
                "description": "Data quality metrics, null rates, and completeness",
                "requires": {},
            },
            "explorer": {
                "id": "explorer",
                "label": "Data Explorer",
                "icon": "🔍",
                "description": "Full data table with filtering and sorting",
                "requires": {},
            },
        }
        
        # Filter to only available views
        available = {k: v for k, v in views.items() if all(v["requires"].values())}
        
        return {
            "available_views": list(available.keys()),
            "views": available,
            "columns_summary": {
                "numeric": len(numeric_cols),
                "categorical": len(categorical_cols),
                "temporal": len(date_cols),
            },
        }
    except Exception as e:
        logger.error(f"Available views error: {e}")
        raise HTTPException(500, str(e))


@router.get("/{session_id}/filter-options")
def get_all_filter_options(session_id: str):
    """Get available values for all filterable columns."""
    df = _get_df(session_id)
    try:
        options = {}
        
        # Numeric column ranges
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        options["numeric_columns"] = []
        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) > 0:
                options["numeric_columns"].append({
                    "column": col,
                    "min": float(series.min()),
                    "max": float(series.max()),
                    "mean": float(series.mean()),
                    "median": float(series.median()),
                })
        
        # Categorical value lists
        categorical_cols = df.select_dtypes(include=["object"]).columns.tolist()
        options["categorical_columns"] = {}
        for col in categorical_cols:
            top_values = df[col].value_counts().head(100).index.tolist()
            options["categorical_columns"][col] = [str(v) for v in top_values if pd.notna(v)]
        
        # Date ranges
        date_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
        options["date_columns"] = []
        for col in date_cols:
            series = df[col].dropna()
            if len(series) > 0:
                options["date_columns"].append({
                    "column": col,
                    "min": series.min().isoformat() if pd.notna(series.min()) else None,
                    "max": series.max().isoformat() if pd.notna(series.max()) else None,
                })
        
        return options
    except Exception as e:
        logger.error(f"Filter options error: {e}")
        raise HTTPException(500, str(e))
