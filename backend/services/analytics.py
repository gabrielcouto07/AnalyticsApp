import pandas as pd
import numpy as np
import logging
from typing import List, Dict, Any

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


def calculate_kpis(df: pd.DataFrame) -> List[Dict[str, Any]]:
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