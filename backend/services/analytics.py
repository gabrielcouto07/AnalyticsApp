import pandas as pd
import numpy as np
import logging
from typing import List, Dict, Any, Tuple, Optional
from scipy import stats

logger = logging.getLogger(__name__)

# Palavras que indicam coluna de IDENTIFICADOR (não deve entrar nos KPIs)
_ID_KEYWORDS = [
    "id", "nf", "documento", "interno", "numero", "num", "nro", "nr",
    "cod", "code", "chave", "key", "pk", "fk", "ref", "seq",
    "protocolo", "pedido", "ordem", "serial", "cnpj", "cpf", "item",
]

# Palavras que indicam BOA métrica analítica
_METRIC_KEYWORDS = [
    "valor", "value", "total", "amount", "preco", "price",
    "custo", "cost", "receita", "revenue", "lucro", "profit",
    "margem", "margin", "venda", "sale", "quantidade", "qty",
    "qtd", "volume", "peso", "weight", "desconto", "discount",
    "comissao", "commission", "taxa", "rate", "percentual",
    "percent", "pct", "score", "nota", "faturamento", "bruto",
    "liquido", "imposto", "ipi", "icms", "pis", "cofins",
]


def _is_id_column(col: str, series: pd.Series) -> bool:
    c = col.lower().replace("_", "").replace(" ", "").replace("º", "o")
    if any(kw.replace("_", "") in c for kw in _ID_KEYWORDS):
        return True
    if series.dtype in ["int64", "int32", "Int64"]:
        ratio = series.nunique() / max(len(series), 1)
        if ratio > 0.7:
            return True
    return False


def _is_metric_column(col: str) -> bool:
    c = col.lower().replace("_", "").replace(" ", "")
    return any(kw.replace("_", "") in c for kw in _METRIC_KEYWORDS)


def calculate_kpis(df: pd.DataFrame, audit: Any = None) -> List[Dict[str, Any]]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    metric_cols  = [c for c in numeric_cols if _is_metric_column(c) and not _is_id_column(c, df[c])]
    neutral_cols = [c for c in numeric_cols if not _is_metric_column(c) and not _is_id_column(c, df[c])]
    id_cols      = [c for c in numeric_cols if _is_id_column(c, df[c])]

    ordered = metric_cols + neutral_cols + id_cols
    if not ordered:
        ordered = numeric_cols

    kpis = []
    for col in ordered[:4]:
        series = df[col].dropna()
        if len(series) == 0:
            continue

        total = float(series.sum())
        mean  = float(series.mean())

        mid = len(series) // 2
        if mid > 0:
            first  = series.iloc[:mid].mean()
            second = series.iloc[mid:].mean()
            trend  = ((second - first) / abs(first) * 100) if first != 0 else 0.0
        else:
            trend = 0.0

        kpis.append({
            "title": col,
            "total": round(total, 2),
            "mean":  round(mean, 2),
            "trend": round(trend, 1),
        })

        if audit is not None:
            audit.add(
                "kpi",
                f"KPI Computed: '{col}'",
                f"The system summarized column '{col}' using total, average and trend against the second half of the data.",
                {
                    "column": col,
                    "formula_total": f"SUM({col})",
                    "formula_mean": f"MEAN({col})",
                    "total": round(total, 2),
                    "mean": round(mean, 2),
                    "trend_pct": round(trend, 1),
                    "rows_used": int(series.notna().sum()),
                    "rows_skipped": int(df[col].isna().sum()),
                },
                "success",
            )

    return kpis


def calculate_stats(df: pd.DataFrame) -> Dict[str, Any]:
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {}
    return numeric_df.describe().to_dict()  # type: ignore


def calculate_quality(df: pd.DataFrame) -> List[Dict[str, Any]]:
    quality = []
    for col in df.columns:
        series    = df[col]
        null_cnt  = int(series.isnull().sum())
        null_pct  = round(null_cnt / len(df) * 100, 2) if len(df) > 0 else 0
        unique    = int(series.nunique())
        non_null  = series.dropna()
        sample    = str(non_null.iloc[0])[:60] if len(non_null) > 0 else "N/A"

        quality.append({
            "column":       col,
            "dtype":        str(series.dtype),
            "null_count":   null_cnt,
            "null_pct":     null_pct,
            "unique_count": unique,
            "sample":       sample,
        })

    return sorted(quality, key=lambda x: x["null_pct"], reverse=True)


# ============================================================================
# ADVANCED ANALYTICS FUNCTIONS
# ============================================================================

def get_column_distributions(df: pd.DataFrame) -> Dict[str, Any]:
    """Get distribution statistics for all numeric columns."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    distributions = {}
    
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) == 0:
            continue
            
        distributions[col] = {
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "median": float(series.median()),
            "std": float(series.std()),
            "q1": float(series.quantile(0.25)),
            "q3": float(series.quantile(0.75)),
            "skewness": float(series.skew()),
            "kurtosis": float(series.kurtosis()),
            "count": int(len(series)),
        }
    
    return distributions


def get_correlations(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Calculate correlation matrix for numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {}
    
    corr_matrix = numeric_df.corr()
    return corr_matrix.to_dict()


def detect_anomalies(df: pd.DataFrame, threshold: float = 3.0) -> Dict[str, List[Dict[str, Any]]]:
    """Detect anomalies using z-score method."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    anomalies = {}
    
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 3:
            continue
            
        z_scores = np.abs(stats.zscore(series))
        anomaly_mask = z_scores > threshold
        
        if anomaly_mask.any():
            anomaly_indices = np.where(anomaly_mask)[0]
            anomalies[col] = [
                {
                    "index": int(idx),
                    "value": float(series.iloc[idx]),
                    "z_score": float(z_scores[idx]),
                }
                for idx in anomaly_indices[:10]  # Limit to 10
            ]
    
    return anomalies


def get_categorical_insights(df: pd.DataFrame, max_categories: int = 20) -> Dict[str, Any]:
    """Get insights into categorical columns."""
    categorical_cols = df.select_dtypes(include=["object"]).columns
    insights = {}
    
    for col in categorical_cols:
        value_counts = df[col].value_counts()
        
        insights[col] = {
            "unique_count": int(value_counts.count()),
            "top_value": str(value_counts.index[0]) if len(value_counts) > 0 else None,
            "top_count": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            "top_values": dict(value_counts.head(min(10, max_categories))),
            "null_count": int(df[col].isnull().sum()),
        }
    
    return insights


def generate_data_profile(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate comprehensive data profile."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object"]).columns.tolist()
    date_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
    
    total_rows = len(df)
    total_cols = len(df.columns)
    total_cells = total_rows * total_cols
    null_cells = int(df.isnull().sum().sum())
    completeness_pct = round((1 - null_cells / total_cells) * 100, 1) if total_cells > 0 else 0
    
    return {
        "rows": total_rows,
        "columns": total_cols,
        "numeric_columns": len(numeric_cols),
        "categorical_columns": len(categorical_cols),
        "date_columns": len(date_cols),
        "total_cells": total_cells,
        "null_cells": null_cells,
        "completeness_percent": completeness_pct,
        "memory_usage_bytes": int(df.memory_usage(deep=True).sum()),
    }


def get_summary_statistics(df: pd.DataFrame) -> Dict[str, Any]:
    """Get summary statistics across the entire dataset."""
    profile = generate_data_profile(df)
    distributions = get_column_distributions(df)
    categorical_insights = get_categorical_insights(df)
    
    return {
        "profile": profile,
        "distributions": distributions,
        "categorical": categorical_insights,
        "kpis": calculate_kpis(df),
    }