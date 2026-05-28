"""
Normalizadores genéricos para colunas e dados.
Transformam dados brutos em formatos padronizados.
"""

import numpy as np
import pandas as pd
from .parsers import parse_num, smart_date


def normalize_columns(
    df: pd.DataFrame,
    col_map: dict,
    numeric_cols: list = None,
    text_cols: list = None,
    date_cols: list = None,
    date_period_col: str = None,
) -> pd.DataFrame:
    """
    Normaliza colunas de um DataFrame conforme mapeamento genérico.
    
    Funciona para QUALQUER modelo — recebe o col_map como parâmetro.
    
    Args:
        df: DataFrame com colunas em nomes variados (com/sem acento, etc.)
        col_map: dict {canonical_name: [alias1, alias2, ...]}
                 Ex: {"SlpName": ["Nome do Vendedor", "SlpName", ...]}
        numeric_cols: lista de colunas para converter a float
        text_cols: lista de colunas para converter a string (strip)
        date_cols: lista de colunas para converter a data
        date_period_col: coluna de data para extrair período (ex: "ReceiveDate")
                         Cria coluna "Período" automaticamente se existir
        
    Returns:
        DataFrame normalizado com colunas canonicalizadas
        
    Process:
        1. Renomeia colunas conforme col_map (case-insensitive, com acento)
        2. Converte tipos conforme especificado
        3. Trata NaN e valores inválidos
        4. Cria colunas derivadas (ex: período a partir de data)
    """
    df = df.copy()
    
    # ── Step 1: Renomear colunas (case-insensitive, com/sem acento) ──
    rev = {
        alias.upper().strip(): canon
        for canon, aliases in col_map.items()
        for alias in aliases
    }
    
    df = df.rename(columns={
        col: rev[col.upper().strip()]
        for col in df.columns
        if col.upper().strip() in rev
    })
    
    df.columns = [str(c).strip() for c in df.columns]
    
    # ── Step 2: Converter tipos ──
    
    # Numéricos
    if numeric_cols is None:
        numeric_cols = []
    for c in numeric_cols:
        if c in df.columns:
            df[c] = df[c].apply(parse_num)
    
    # Texto
    if text_cols is None:
        text_cols = []
    for c in text_cols:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()
    
    # Datas
    if date_cols is None:
        date_cols = []
    for c in date_cols:
        if c in df.columns:
            df[c] = df[c].apply(smart_date)
            df = df[df[c].notna()].copy()
    
    # ── Step 3: Colunas derivadas (período a partir de data) ──
    if date_period_col and date_period_col in df.columns:
        # Cria coluna "Period_${column_name}" com formato YYYY-MM
        period_col_name = f"{date_period_col}_Period"
        df[period_col_name] = np.where(
            df[date_period_col].notna(),
            df[date_period_col].dt.to_period("M").astype(str),
            "N/D",
        )
    
    return df


def validate_required_columns(df: pd.DataFrame, required: list) -> list:
    """
    Valida se colunas obrigatórias existem no DataFrame.
    
    Args:
        df: DataFrame
        required: lista de nomes de colunas esperadas
        
    Returns:
        lista de colunas faltando (vazia se tudo OK)
        
    Example:
        >>> missing = validate_required_columns(df, ["SlpName", "LineTotal"])
        >>> if missing:
        ...     print(f"Faltam: {missing}")
    """
    return [c for c in required if c not in df.columns]
