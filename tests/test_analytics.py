import pytest
import pandas as pd
import numpy as np
from config.analytics import (
    calculate_trend,
    detect_outliers_iqr,
    categorize_dataset,
    identify_anomalies,
)


class TestAnalytics:
    """Testes para funções de análise"""
    
    def test_calculate_trend_positive(self):
        """Trend crescente deve retornar change_pct positivo"""
        series = pd.Series([100, 110, 120, 130, 140])
        result = calculate_trend(series, periods=1)
        assert result["change_pct"] > 0
        assert result["direction"] == "crescimento"
    
    def test_calculate_trend_negative(self):
        """Trend decrescente deve retornar change_pct negativo"""
        series = pd.Series([100, 90, 80, 70, 60])
        result = calculate_trend(series, periods=1)
        assert result["change_pct"] < 0
        assert result["direction"] == "queda"
    
    def test_detect_outliers_iqr(self):
        """IQR outlier detection com valores extremos"""
        series = pd.Series([1, 2, 3, 4, 5, 100])  # 100 é outlier
        outlier_indices, pct = detect_outliers_iqr(series)
        assert 5 in outlier_indices  # Índice do valor 100
        assert pct > 0
    
    def test_categorize_sales_dataset(self):
        """Detecção automática de dataset Vendas"""
        df = pd.DataFrame({
            "vendedor": ["João", "Maria"],
            "produto": ["A", "B"],
            "quantidade": [5, 3],
            "valor": [150, 200]
        })
        result = categorize_dataset(df)
        assert result["type"] == "sales"
    
    def test_categorize_financial_dataset(self):
        """Detecção automática de dataset Financeiro"""
        df = pd.DataFrame({
            "data": ["2024-01-01", "2024-01-02"],
            "receita": [1000, 1500],
            "despesa": [500, 600],
            "lucro": [500, 900]
        })
        result = categorize_dataset(df)
        assert result["type"] == "financial"
    
    def test_identify_anomalies_zscore(self):
        """Z-score anomaly detection"""
        df = pd.DataFrame({
            "valores": [1, 2, 3, 4, 5, 100]  # 100 é anomalia
        })
        anomalies = identify_anomalies(df, ["valores"], threshold_z=2.5)
        assert "valores" in anomalies
        assert len(anomalies["valores"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
