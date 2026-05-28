# Funções avançadas de análise de dados: trends, outliers, insights
import numpy as np
import pandas as pd
from typing import Dict, Tuple, List


def calculate_trend(series: pd.Series, periods: int = 2) -> Dict[str, any]:
    """
    Calcula tendência entre períodos consecutivos.
    Retorna: {value_curr, value_prev, change_pct, direction, arrow}
    """
    try:
        if len(series) < periods:
            return {"change_pct": 0, "direction": "→", "arrow": "→"}
        
        current = series.iloc[-1]
        previous = series.iloc[-periods]
        
        if previous == 0:
            change_pct = 0
        else:
            change_pct = ((current - previous) / abs(previous)) * 100
        
        if abs(change_pct) < 0.5:
            direction = "stagnado"
            arrow = "→"
        elif change_pct > 0:
            direction = "crescimento"
            arrow = "📈"
        else:
            direction = "queda"
            arrow = "📉"
        
        return {
            "change_pct": change_pct,
            "direction": direction,
            "arrow": arrow,
            "current": current,
            "previous": previous,
        }
    except Exception:
        return {"change_pct": 0, "direction": "—", "arrow": "—"}


def detect_outliers_iqr(series: pd.Series, multiplier: float = 1.5) -> Tuple[List[int], float]:
    """
    Detecta outliers usando método IQR (Interquartile Range).
    Retorna: (lista de índices com outliers, quantidade de outliers encontrados)
    """
    try:
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        outlier_indices = series[(series < lower_bound) | (series > upper_bound)].index.tolist()
        pct = (len(outlier_indices) / len(series)) * 100 if len(series) > 0 else 0
        
        return outlier_indices, pct
    except Exception:
        return [], 0.0


def generate_kpi_insights(df: pd.DataFrame, col: str, period_col: str = None) -> str:
    """
    Gera texto descritivo com insights sobre um KPI.
    Exemplo: "Valor total de R$ 1.2M, com crescimento de 15% vs período anterior"
    """
    try:
        total = df[col].sum()
        media = df[col].mean()
        min_val = df[col].min()
        max_val = df[col].max()
        
        # Formatação
        if total > 1_000_000:
            formatted = f"R$ {total/1_000_000:.1f}M"
        elif total > 1_000:
            formatted = f"R$ {total/1_000:.0f}K"
        else:
            formatted = f"R$ {total:.0f}"
        
        insight = f"{formatted} · Média: R$ {media:,.0f}"
        return insight
    except Exception:
        return "Sem dados"


def categorize_dataset(df: pd.DataFrame) -> Dict[str, str]:
    """
    Tenta detectar o tipo de dataset baseado em nomes de colunas.
    Retorna: {type: "sales|financial|ops|hr|generic", description: str}
    """
    col_names = " ".join([c.lower() for c in df.columns])
    
    # Detecção heurística
    if any(x in col_names for x in ["vend", "produto", "cliente", "pedido", "quantidade", "ticket"]):
        return {"type": "sales", "description": "🛍️ Dataset de Vendas"}
    
    if any(x in col_names for x in ["receita", "despesa", "lucro", "fluxo", "caixa", "fatura"]):
        return {"type": "financial", "description": "💰 Dataset Financeiro"}
    
    if any(x in col_names for x in ["volume", "processado", "sla", "throughput", "operacao"]):
        return {"type": "ops", "description": "⚙️ Dataset de Operações"}
    
    if any(x in col_names for x in ["funcionario", "departamento", "salario", "rh", "contratar"]):
        return {"type": "hr", "description": "👥 Dataset RH"}
    
    return {"type": "generic", "description": "📊 Dataset Genérico"}


def identify_anomalies(df: pd.DataFrame, numeric_cols: List[str], threshold_z: float = 2.5) -> Dict[str, List[int]]:
    """
    Identifica anomalias usando Z-score para cada coluna numérica.
    Retorna dicionário: {coluna: [lista de índices com anomalias]}
    """
    from scipy import stats
    
    anomalies = {}
    try:
        for col in numeric_cols:
            if col in df.columns:
                z_scores = np.abs(stats.zscore(df[col].dropna(), nan_policy='omit'))
                anomaly_indices = df[df[col].notna()][z_scores > threshold_z].index.tolist()
                if anomaly_indices:
                    anomalies[col] = anomaly_indices
    except Exception:
        # Fallback para método simples se scipy não estiver disponível
        for col in numeric_cols:
            if col in df.columns:
                mean = df[col].mean()
                std = df[col].std()
                if std > 0:
                    z_scores = np.abs((df[col] - mean) / std)
                    anomaly_indices = df[z_scores > threshold_z].index.tolist()
                    if anomaly_indices:
                        anomalies[col] = anomaly_indices
    
    return anomalies


def get_kpi_suggestions(dataset_type: str) -> List[Dict[str, str]]:
    """
    Retorna sugestões de KPIs contextuais conforme o tipo de dataset.
    """
    kpi_map = {
        "sales": [
            {"name": "Receita Total", "icon": "💵"},
            {"name": "Ticket Médio", "icon": "🏷️"},
            {"name": "Quantidade Vendida", "icon": "📦"},
            {"name": "Margem Média", "icon": "📈"},
        ],
        "financial": [
            {"name": "Receita", "icon": "📥"},
            {"name": "Despesa", "icon": "📤"},
            {"name": "Lucro Líquido", "icon": "💰"},
            {"name": "Fluxo de Caixa", "icon": "💸"},
        ],
        "ops": [
            {"name": "Volume Processado", "icon": "📊"},
            {"name": "SLA %", "icon": "✅"},
            {"name": "Tempo Médio", "icon": "⏱️"},
            {"name": "Taxa de Erro", "icon": "⚠️"},
        ],
        "hr": [
            {"name": "Total de Funcionários", "icon": "👥"},
            {"name": "Folha de Pagamento", "icon": "💼"},
            {"name": "Taxa de Rotatividade", "icon": "🔄"},
            {"name": "Produtividade Média", "icon": "⚡"},
        ],
        "generic": [
            {"name": "Total", "icon": "📊"},
            {"name": "Média", "icon": "📈"},
            {"name": "Máximo", "icon": "🔺"},
            {"name": "Mínimo", "icon": "🔻"},
        ],
    }
    
    return kpi_map.get(dataset_type, kpi_map["generic"])


def calculate_percentile_rank(value: float, series: pd.Series) -> float:
    """Retorna em qual percentil um valor se encontra (0-100)."""
    try:
        return (series < value).sum() / len(series) * 100
    except Exception:
        return 50.0


def identify_anomalies(df: pd.DataFrame, numeric_cols: List[str], threshold_z: float = 2.5) -> Dict[str, List]:
    """
    Identifica anomalias usando Z-score em colunas numéricas.
    Retorna dicionário com índices anômalos por coluna.
    """
    anomalies = {}
    for col in numeric_cols:
        try:
            z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
            anomaly_indices = z_scores[z_scores > threshold_z].index.tolist()
            anomalies[col] = anomaly_indices
        except Exception:
            anomalies[col] = []
    
    return anomalies
