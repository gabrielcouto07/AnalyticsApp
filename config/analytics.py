import numpy as np
import pandas as pd
from typing import Dict, Tuple, List


def calculate_trend(series: pd.Series, periods: int = 2) -> Dict[str, any]:
    """
    Calcula tendencia entre periodos consecutivos.
    Retorna: {value_curr, value_prev, change_pct, direction, arrow}
    """
    try:
        clean_series = pd.to_numeric(series, errors="coerce").dropna()
        if len(clean_series) <= periods:
            return {"change_pct": 0, "direction": "→", "arrow": "→"}

        current = clean_series.iloc[-1]
        previous = clean_series.iloc[-(periods + 1)]

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
    Detecta outliers usando o metodo IQR.
    Retorna: (lista de indices com outliers, percentual de outliers)
    """
    try:
        numeric_series = pd.to_numeric(series, errors="coerce").dropna()
        q1 = numeric_series.quantile(0.25)
        q3 = numeric_series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr

        outlier_indices = numeric_series[(numeric_series < lower_bound) | (numeric_series > upper_bound)].index.tolist()
        pct = (len(outlier_indices) / len(numeric_series)) * 100 if len(numeric_series) > 0 else 0
        return outlier_indices, pct
    except Exception:
        return [], 0.0


def generate_kpi_insights(df: pd.DataFrame, col: str, period_col: str = None) -> str:
    """
    Gera texto descritivo com insights sobre um KPI.
    Exemplo: "Valor total de R$ 1.2M, com crescimento de 15% vs periodo anterior"
    """
    try:
        total = df[col].sum()
        media = df[col].mean()

        if total > 1_000_000:
            formatted = f"R$ {total / 1_000_000:.1f}M"
        elif total > 1_000:
            formatted = f"R$ {total / 1_000:.0f}K"
        else:
            formatted = f"R$ {total:.0f}"

        return f"{formatted} · Media: R$ {media:,.0f}"
    except Exception:
        return "Sem dados"


def categorize_dataset(df: pd.DataFrame) -> Dict[str, str]:
    """
    Tenta detectar o tipo de dataset baseado em nomes de colunas.
    Retorna: {type: "sales|financial|ops|hr|generic", description: str}
    """
    col_names = " ".join([str(column).lower() for column in df.columns])

    if any(keyword in col_names for keyword in ["vend", "produto", "cliente", "pedido", "quantidade", "ticket"]):
        return {"type": "sales", "description": "Dataset de Vendas"}

    if any(keyword in col_names for keyword in ["receita", "despesa", "lucro", "fluxo", "caixa", "fatura"]):
        return {"type": "financial", "description": "Dataset Financeiro"}

    if any(keyword in col_names for keyword in ["volume", "processado", "sla", "throughput", "operacao"]):
        return {"type": "ops", "description": "Dataset de Operacoes"}

    if any(keyword in col_names for keyword in ["funcionario", "departamento", "salario", "rh", "contratar"]):
        return {"type": "hr", "description": "Dataset RH"}

    return {"type": "generic", "description": "Dataset Generico"}


def _detect_zscore_anomalies(numeric_series: pd.Series, threshold_z: float) -> List[int]:
    from scipy import stats

    z_scores = np.abs(stats.zscore(numeric_series, nan_policy="omit"))
    if np.isscalar(z_scores):
        z_scores = np.array([z_scores])
    return numeric_series.index[np.asarray(z_scores) > threshold_z].tolist()


def _detect_iqr_anomalies(numeric_series: pd.Series) -> List[int]:
    q1 = numeric_series.quantile(0.25)
    q3 = numeric_series.quantile(0.75)
    iqr = q3 - q1
    if iqr <= 0:
        return []

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return numeric_series[(numeric_series < lower_bound) | (numeric_series > upper_bound)].index.tolist()


def identify_anomalies(df: pd.DataFrame, numeric_cols: List[str], threshold_z: float = 2.5) -> Dict[str, List[int]]:
    """
    Identifica anomalias usando Z-score para cada coluna numerica.
    Se o Z-score nao capturar nenhum ponto extremo, usa IQR como fallback.
    """
    anomalies: Dict[str, List[int]] = {}

    for col in numeric_cols:
        if col not in df.columns:
            continue

        numeric_series = pd.to_numeric(df[col], errors="coerce").dropna()
        if numeric_series.empty:
            continue

        try:
            anomaly_indices = _detect_zscore_anomalies(numeric_series, threshold_z)
        except Exception:
            mean = numeric_series.mean()
            std = numeric_series.std()
            anomaly_indices = []
            if std > 0:
                z_scores = np.abs((numeric_series - mean) / std)
                anomaly_indices = numeric_series.index[z_scores > threshold_z].tolist()

        if not anomaly_indices:
            anomaly_indices = _detect_iqr_anomalies(numeric_series)

        if anomaly_indices:
            anomalies[col] = anomaly_indices

    return anomalies


def get_kpi_suggestions(dataset_type: str) -> List[Dict[str, str]]:
    """
    Retorna sugestoes de KPIs contextuais conforme o tipo de dataset.
    """
    kpi_map = {
        "sales": [
            {"name": "Receita Total", "icon": "💵"},
            {"name": "Ticket Medio", "icon": "🏷️"},
            {"name": "Quantidade Vendida", "icon": "📦"},
            {"name": "Margem Media", "icon": "📈"},
        ],
        "financial": [
            {"name": "Receita", "icon": "📥"},
            {"name": "Despesa", "icon": "📤"},
            {"name": "Lucro Liquido", "icon": "💰"},
            {"name": "Fluxo de Caixa", "icon": "💸"},
        ],
        "ops": [
            {"name": "Volume Processado", "icon": "📊"},
            {"name": "SLA %", "icon": "✅"},
            {"name": "Tempo Medio", "icon": "⏱️"},
            {"name": "Taxa de Erro", "icon": "⚠️"},
        ],
        "hr": [
            {"name": "Total de Funcionarios", "icon": "👥"},
            {"name": "Folha de Pagamento", "icon": "💼"},
            {"name": "Taxa de Rotatividade", "icon": "🔄"},
            {"name": "Produtividade Media", "icon": "⚡"},
        ],
        "generic": [
            {"name": "Total", "icon": "📊"},
            {"name": "Media", "icon": "📈"},
            {"name": "Maximo", "icon": "🔺"},
            {"name": "Minimo", "icon": "🔻"},
        ],
    }

    return kpi_map.get(dataset_type, kpi_map["generic"])


def calculate_percentile_rank(value: float, series: pd.Series) -> float:
    """Retorna em qual percentil um valor se encontra (0-100)."""
    try:
        return (series < value).sum() / len(series) * 100
    except Exception:
        return 50.0
