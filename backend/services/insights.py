import pandas as pd
import numpy as np
import logging
from typing import List, Dict, Any
from scipy import stats as scipy_stats

logger = logging.getLogger(__name__)


def generate_insights(df: pd.DataFrame) -> List[Dict[str, Any]]:
    insights: List[Dict[str, Any]] = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    date_cols = list(df.select_dtypes(include=["datetime64"]).columns)
    for col in df.select_dtypes(include=["object"]).columns:
        try:
            pd.to_datetime(df[col].dropna().head(20), errors="raise")
            date_cols.append(col)
        except Exception:
            pass

    for col in df.columns:
        pct = df[col].isnull().mean()
        if pct > 0.20:
            insights.append({
                "type": "missing_data",
                "severity": "critical" if pct > 0.5 else "warning",
                "title": f"Alta taxa de nulos em '{col}'",
                "description": (
                    f"A coluna '{col}' tem {pct * 100:.1f}% de valores nulos. "
                    "Isso pode distorcer médias e totais."
                ),
                "affected_columns": [col],
                "chart_suggestion": None,
            })

    for col in numeric_cols:
        try:
            if df[col].dropna().std() == 0:
                insights.append({
                    "type": "pattern",
                    "severity": "info",
                    "title": f"Coluna constante: '{col}'",
                    "description": f"'{col}' tem valor idêntico em todas as linhas. Pode ser removida sem perda de informação.",
                    "affected_columns": [col],
                    "chart_suggestion": None,
                })
        except Exception:
            pass

    for col in numeric_cols[:10]:
        series = df[col].dropna()
        if len(series) < 20:
            continue
        q1  = series.quantile(0.25)
        q3  = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        out_mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)
        out_cnt  = int(out_mask.sum())
        out_pct  = out_cnt / len(series) * 100
        if out_pct > 3:
            insights.append({
                "type": "outlier",
                "severity": "critical" if out_pct > 15 else "warning",
                "title": f"Outliers em '{col}'",
                "description": (
                    f"{out_cnt} valores ({out_pct:.1f}%) estão além de 1.5×IQR em '{col}'. "
                    "Verifique se são erros de digitação ou casos legítimos."
                ),
                "affected_columns": [col],
                "chart_suggestion": {"type": "distribution", "x_col": col, "y_col": None},
            })

    if len(numeric_cols) >= 2:
        try:
            num_df = df[numeric_cols[:15]].select_dtypes(include=[np.number])
            corr = num_df.corr()
            for i in range(len(corr.columns)):
                for j in range(i + 1, len(corr.columns)):
                    val = corr.iloc[i, j]
                    if pd.isna(val):
                        continue
                    val_float = float(val)  # type: ignore
                    col_a, col_b = corr.columns[i], corr.columns[j]
                    if abs(val_float) >= 0.999:
                        insights.append({
                            "type": "pattern",
                            "severity": "warning",
                            "title": f"Possível coluna duplicada: '{col_a}' ≈ '{col_b}'",
                            "description": f"Correlação de {val_float:.4f} sugere que são derivadas uma da outra.",
                            "affected_columns": [col_a, col_b],
                            "chart_suggestion": None,
                        })
                    elif abs(val_float) >= 0.80:
                        direction = "positiva" if val_float > 0 else "negativa"
                        insights.append({
                            "type": "correlation",
                            "severity": "info",
                            "title": f"Correlação forte: '{col_a}' × '{col_b}'",
                            "description": f"Correlação {direction} forte (r={val_float:.2f}) entre as duas colunas.",
                            "affected_columns": [col_a, col_b],
                            "chart_suggestion": {"type": "scatter", "x_col": col_a, "y_col": col_b},
                        })
        except Exception as e:
            logger.debug(f"Correlation insight skipped: {e}")

    if date_cols and numeric_cols:
        date_col = date_cols[0]
        for num_col in numeric_cols[:4]:
            try:
                d = df[[date_col, num_col]].copy()
                d[date_col] = pd.to_datetime(d[date_col], errors="coerce")
                d[num_col]  = pd.to_numeric(d[num_col], errors="coerce")
                d = d.dropna().sort_values(date_col)
                if len(d) < 15:
                    continue
                x = np.arange(len(d), dtype=float)
                y = d[num_col].values.astype(float)
                slope, _, r_val, p_val, _ = scipy_stats.linregress(x, y)
                mean_y = abs(float(y.mean()))  # type: ignore
                slope_pct = abs(float(slope)) / mean_y * 100 if mean_y > 0 else 0  # type: ignore
                if float(p_val) < 0.05 and slope_pct > 5:  # type: ignore
                    direction = "crescimento" if float(slope) > 0 else "queda"  # type: ignore
                    insights.append({
                        "type": "trend",
                        "severity": "info",
                        "title": f"Tendência de {direction} em '{num_col}'",
                        "description": (
                            f"'{num_col}' apresenta tendência de {direction} estatisticamente significativa "
                            f"(p={float(p_val):.3f}, R²={float(r_val) ** 2:.2f})."  # type: ignore
                        ),
                        "affected_columns": [date_col, num_col],
                        "chart_suggestion": {"type": "temporal", "x_col": date_col, "y_col": num_col},
                    })
            except Exception as e:
                logger.debug(f"Trend skipped for {num_col}: {e}")

    order = {"critical": 0, "warning": 1, "info": 2}
    insights.sort(key=lambda x: order.get(x["severity"], 3))
    return insights[:15]