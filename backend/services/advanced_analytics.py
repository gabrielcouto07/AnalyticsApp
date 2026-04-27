"""
Motor Analítico Avançado - FASE 3
Análises avançadas: Anomalias, Clustering, Tendências, Segmentação
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detector de anomalias usando múltiplos métodos."""
    
    @staticmethod
    def iqr_method(series: pd.Series, multiplier: float = 1.5) -> Dict[str, Any]:
        """
        Detecção de anomalias usando IQR (Interquartile Range).
        
        Retorna:
        {
            "method": "IQR",
            "anomalies": [...],
            "count": n,
            "percentage": x%,
            "bounds": {"lower": x, "upper": y},
            "threshold_multiplier": 1.5
        }
        """
        series = pd.to_numeric(series, errors="coerce").dropna()
        if len(series) < 4:
            return {"method": "IQR", "anomalies": [], "count": 0, "percentage": 0}
        
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        mask = (series < lower_bound) | (series > upper_bound)
        anomalies = series[mask].tolist()
        
        return {
            "method": "IQR",
            "anomalies": [round(float(a), 4) for a in anomalies],
            "count": int(mask.sum()),
            "percentage": round(float(mask.sum() / len(series) * 100), 2),
            "bounds": {
                "lower": round(float(lower_bound), 4),
                "upper": round(float(upper_bound), 4)
            },
            "threshold_multiplier": multiplier
        }
    
    @staticmethod
    def zscore_method(series: pd.Series, threshold: float = 3.0) -> Dict[str, Any]:
        """
        Detecção de anomalias usando Z-Score.
        
        Valores com |z-score| > threshold são considerados anomalias.
        """
        series = pd.to_numeric(series, errors="coerce").dropna()
        if len(series) < 2:
            return {"method": "Z-Score", "anomalies": [], "count": 0, "percentage": 0}
        
        z_scores = np.abs(scipy_stats.zscore(series))
        mask = z_scores > threshold
        anomalies = series[mask].tolist()
        
        return {
            "method": "Z-Score",
            "anomalies": [round(float(a), 4) for a in anomalies],
            "count": int(mask.sum()),
            "percentage": round(float(mask.sum() / len(series) * 100), 2),
            "threshold": threshold,
            "mean": round(float(series.mean()), 4),
            "std": round(float(series.std()), 4)
        }
    
    @staticmethod
    def isolation_forest_method(df: pd.DataFrame, contamination: float = 0.1) -> Dict[str, Any]:
        """
        Detecção de anomalias usando Isolation Forest (baseado em DataFrame).
        Retorna resumo de anomalias para todo o dataset.
        """
        try:
            from sklearn.ensemble import IsolationForest
            
            # Selecionar apenas colunas numéricas
            numeric_df = df.select_dtypes(include=[np.number]).copy()
            if numeric_df.empty or len(numeric_df) < 2:
                return {"method": "Isolation Forest", "anomalies": 0, "percentage": 0}
            
            # Remover NaN
            numeric_df = numeric_df.dropna()
            
            # Normalizar
            scaler = StandardScaler()
            scaled = scaler.fit_transform(numeric_df)
            
            # Detectar anomalias
            clf = IsolationForest(contamination=contamination, random_state=42)
            predictions = clf.fit_predict(scaled)
            
            anomaly_count = (predictions == -1).sum()
            
            return {
                "method": "Isolation Forest",
                "anomalies": int(anomaly_count),
                "percentage": round(float(anomaly_count / len(numeric_df) * 100), 2),
                "contamination_threshold": contamination,
                "total_records": len(numeric_df)
            }
        except ImportError:
            logger.warning("scikit-learn not available for Isolation Forest")
            return {"method": "Isolation Forest", "available": False}


class TrendAnalyzer:
    """Analisador de tendências em séries temporais."""
    
    @staticmethod
    def detect_trend(series: pd.Series, window: int = 5) -> Dict[str, Any]:
        """
        Detecta tendência em uma série usando regressão linear.
        
        Retorna:
        {
            "direction": "up" | "down" | "flat",
            "slope": valor,
            "r_squared": valor,
            "strength": "forte" | "moderada" | "fraca",
            "recent_avg": média dos últimos N valores
        }
        """
        series = pd.to_numeric(series, errors="coerce").dropna()
        if len(series) < 2:
            return {"direction": "unknown", "strength": "fraca"}
        
        x = np.arange(len(series))
        slope, intercept, r_value, _, _ = scipy_stats.linregress(x, series.values)
        
        r_squared = r_value ** 2
        
        # Determinar força e direção
        if abs(r_squared) < 0.3:
            strength = "fraca"
        elif abs(r_squared) < 0.6:
            strength = "moderada"
        else:
            strength = "forte"
        
        direction = "up" if slope > 0 else ("down" if slope < 0 else "flat")
        
        # Média recente
        recent_count = min(window, len(series))
        recent_avg = float(series.tail(recent_count).mean())
        
        return {
            "direction": direction,
            "slope": round(float(slope), 6),
            "r_squared": round(float(r_squared), 4),
            "strength": strength,
            "recent_avg": round(recent_avg, 4),
            "period_analyzed": len(series)
        }
    
    @staticmethod
    def seasonal_decomposition(df: pd.DataFrame, date_col: str, metric_col: str, period: int = 12) -> Dict[str, Any]:
        """
        Decomposição sazonal usando Seasonal Decomposition.
        """
        try:
            from statsmodels.tsa.seasonal import seasonal_decompose
            
            # Preparar série temporal
            df_copy = df[[date_col, metric_col]].copy()
            df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors="coerce")
            df_copy[metric_col] = pd.to_numeric(df_copy[metric_col], errors="coerce")
            df_copy = df_copy.dropna().sort_values(date_col)
            
            if len(df_copy) < period * 2:
                return {
                    "method": "Seasonal Decomposition",
                    "available": False,
                    "reason": f"Insufficient data: {len(df_copy)} < {period * 2}"
                }
            
            df_copy.set_index(date_col, inplace=True)
            df_copy = df_copy.resample('D').mean().ffill()
            
            result = seasonal_decompose(df_copy[metric_col], model='additive', period=period)
            
            return {
                "method": "Seasonal Decomposition",
                "trend_direction": "up" if result.trend.iloc[-1] > result.trend.iloc[0] else "down",
                "seasonal_strength": round(float(np.std(result.seasonal) / np.std(df_copy[metric_col])), 4),
                "residual_variance": round(float(result.resid.var()), 4),
                "period": period
            }
        except Exception as e:
            logger.warning(f"Seasonal decomposition error: {e}")
            return {"method": "Seasonal Decomposition", "available": False, "error": str(e)}


class ClusterAnalyzer:
    """Analisador de clustering (agrupamento) de dados."""
    
    @staticmethod
    def kmeans_clustering(df: pd.DataFrame, n_clusters: int = 3, numeric_only: bool = True) -> Dict[str, Any]:
        """
        Clustering usando K-Means.
        
        Retorna:
        {
            "method": "K-Means",
            "n_clusters": 3,
            "inertia": valor,
            "silhouette_score": valor,
            "cluster_sizes": [...],
            "cluster_centers": [...]
        }
        """
        try:
            # Selecionar colunas numéricas
            if numeric_only:
                X = df.select_dtypes(include=[np.number]).copy()
            else:
                X = df.copy()
            
            if X.empty or len(X) < n_clusters:
                return {"method": "K-Means", "available": False, "reason": "Insufficient data"}
            
            # Remover NaN
            X = X.dropna()
            
            if len(X) < n_clusters:
                return {"method": "K-Means", "available": False, "reason": "Fewer rows than clusters"}
            
            # Normalizar
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # K-Means
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X_scaled)
            
            # Silhouette score
            from sklearn.metrics import silhouette_score
            silhouette = silhouette_score(X_scaled, labels)
            
            # Cluster sizes
            unique, counts = np.unique(labels, return_counts=True)
            cluster_sizes = {int(u): int(c) for u, c in zip(unique, counts)}
            
            return {
                "method": "K-Means",
                "n_clusters": n_clusters,
                "inertia": round(float(kmeans.inertia_), 4),
                "silhouette_score": round(float(silhouette), 4),
                "cluster_sizes": cluster_sizes,
                "total_records": len(X),
                "features_used": len(X.columns)
            }
        except ImportError:
            logger.warning("scikit-learn not available for K-Means")
            return {"method": "K-Means", "available": False, "reason": "scikit-learn not installed"}
        except Exception as e:
            logger.error(f"K-Means error: {e}")
            return {"method": "K-Means", "available": False, "error": str(e)}
    
    @staticmethod
    def pca_analysis(df: pd.DataFrame, n_components: int = 2) -> Dict[str, Any]:
        """
        Análise de Componentes Principais (PCA).
        """
        try:
            # Selecionar colunas numéricas
            X = df.select_dtypes(include=[np.number]).copy()
            
            if X.empty or len(X) < n_components:
                return {"method": "PCA", "available": False}
            
            X = X.dropna()
            
            if len(X) < n_components:
                n_components = len(X) - 1
            
            # Normalizar
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # PCA
            pca = PCA(n_components=n_components)
            pca.fit(X_scaled)
            
            explained_var = pca.explained_variance_ratio_.tolist()
            cumsum_var = np.cumsum(explained_var).tolist()
            
            return {
                "method": "PCA",
                "n_components": n_components,
                "explained_variance": [round(float(v), 4) for v in explained_var],
                "cumulative_explained_variance": [round(float(v), 4) for v in cumsum_var],
                "total_variance_explained": round(float(np.sum(explained_var)), 4),
                "features_original": X.shape[1]
            }
        except Exception as e:
            logger.warning(f"PCA error: {e}")
            return {"method": "PCA", "available": False, "error": str(e)}


class SegmentationAnalyzer:
    """Analisador de segmentação de dados."""
    
    @staticmethod
    def segment_by_threshold(series: pd.Series, thresholds: List[float]) -> Dict[str, Any]:
        """
        Segmenta dados por limiares definidos.
        """
        series = pd.to_numeric(series, errors="coerce").dropna()
        
        thresholds = sorted(thresholds)
        segments = {}
        
        # Primeiro segmento: valores < primeiro threshold
        segments[f"< {thresholds[0]}"] = int((series < thresholds[0]).sum())
        
        # Segmentos intermediários
        for i in range(len(thresholds) - 1):
            key = f"{thresholds[i]} - {thresholds[i+1]}"
            count = int(((series >= thresholds[i]) & (series < thresholds[i+1])).sum())
            segments[key] = count
        
        # Último segmento: valores >= último threshold
        segments[f">= {thresholds[-1]}"] = int((series >= thresholds[-1]).sum())
        
        return {
            "method": "Threshold Segmentation",
            "segments": segments,
            "total": int(len(series)),
            "thresholds": thresholds
        }
    
    @staticmethod
    def segment_by_quartiles(series: pd.Series) -> Dict[str, Any]:
        """
        Segmenta dados em quartis.
        """
        series = pd.to_numeric(series, errors="coerce").dropna()
        
        if len(series) < 4:
            return {"method": "Quartile Segmentation", "available": False}
        
        q1, q2, q3 = series.quantile([0.25, 0.5, 0.75])
        
        segments = {
            "Q1 (0-25%)": int((series <= q1).sum()),
            "Q2 (25-50%)": int(((series > q1) & (series <= q2)).sum()),
            "Q3 (50-75%)": int(((series > q2) & (series <= q3)).sum()),
            "Q4 (75-100%)": int((series > q3).sum())
        }
        
        return {
            "method": "Quartile Segmentation",
            "segments": segments,
            "quartile_values": {
                "Q1": round(float(q1), 4),
                "Q2": round(float(q2), 4),
                "Q3": round(float(q3), 4)
            },
            "total": int(len(series))
        }


# ─── Funções Wrapper ────────────────────────────────────────────────────────

def analyze_anomalies(df: pd.DataFrame, column: str, methods: Optional[List[str]] = None) -> Dict[str, Any]:
    """Detecta anomalias usando múltiplos métodos."""
    if methods is None:
        methods = ["iqr", "zscore"]
    
    series = df[column] if column in df.columns else pd.Series()
    results = {}
    
    if "iqr" in methods:
        results["iqr"] = AnomalyDetector.iqr_method(series)
    if "zscore" in methods:
        results["zscore"] = AnomalyDetector.zscore_method(series)
    if "isolation_forest" in methods:
        results["isolation_forest"] = AnomalyDetector.isolation_forest_method(df)
    
    return results


def analyze_trends(series: pd.Series) -> Dict[str, Any]:
    """Detecta tendências em série temporal."""
    return TrendAnalyzer.detect_trend(series)


def analyze_clustering(df: pd.DataFrame, n_clusters: int = 3) -> Dict[str, Any]:
    """Realiza análise de clustering."""
    results = {
        "kmeans": ClusterAnalyzer.kmeans_clustering(df, n_clusters),
        "pca": ClusterAnalyzer.pca_analysis(df)
    }
    return results


def segment_data(series: pd.Series, method: str = "quartiles", thresholds: Optional[List[float]] = None) -> Dict[str, Any]:
    """Segmenta dados usando método especificado."""
    if method == "quartiles":
        return SegmentationAnalyzer.segment_by_quartiles(series)
    elif method == "threshold" and thresholds:
        return SegmentationAnalyzer.segment_by_threshold(series, thresholds)
    else:
        return {"error": "Invalid segmentation method"}
