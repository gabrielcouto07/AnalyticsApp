"""Serialização de DataFrames para JSON e montagem de 'views' (colunas+ordenação).

Todos os agregados são calculados sobre os dados tipados; a formatação
(pt-BR, moeda) acontece só no frontend — nunca agregamos strings de exibição.
"""
from typing import Optional

import numpy as np
import pandas as pd


def _clean_scalar(value):
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    return value


def df_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame → registros JSON-safe (NaN/NaT → null, datas → ISO)."""
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d")
    out = out.astype(object).where(pd.notna(out), None)
    return [
        {str(k): _clean_scalar(v) for k, v in rec.items()}
        for rec in out.to_dict(orient="records")
    ]


def build_view(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
) -> pd.DataFrame:
    """Aplica seleção de colunas e ordenação (a 'visão atual' da tabela)."""
    if columns:
        valid = [c for c in columns if c in df.columns]
        if valid:
            df = df[valid]
    if sort_by and sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir != "desc"), na_position="last")
    return df
