"""
Deduplicadores genéricos para evitar múltipla contagem.
Específico para modelos que precisam marcar "primeira ocorrência".
"""

import numpy as np
import pandas as pd


def add_dedup_flags(
    df: pd.DataFrame,
    lt_key_cols: list = None,
    ar_key_cols: list = None,
    lt_col_name: str = "_lt_first",
    ar_col_name: str = "_ar_first",
) -> pd.DataFrame:
    """
    Adiciona flags de deduplicação para evitar múltipla contagem.
    
    Genérico para qualquer modelo que precise marcar a primeira ocorrência
    de uma combinação de colunas.
    
    Args:
        df: DataFrame
        lt_key_cols: lista de colunas para agrupar LineTotal (ex: ["InvDocNum", "ItemCode"])
                     Se None, não cria flag _lt_first
        ar_key_cols: lista de colunas para agrupar AmountReceived (ex: ["InvDocNum", "ReceiptNumber"])
                     Se None, não cria flag _ar_first
        lt_col_name: nome da coluna flag para LineTotal (default: "_lt_first")
        ar_col_name: nome da coluna flag para AmountReceived (default: "_ar_first")
        
    Returns:
        DataFrame com flags adicionadas
        
    Example:
        # Comissões: linhas duplicadas por (NF, Recibo)
        df = add_dedup_flags(
            df,
            lt_key_cols=["InvDocNum", "ItemCode"],
            ar_key_cols=["InvDocNum", "ReceiptNumber"],
        )
        
        # Vendas: sem dedup necessária (padrão é None)
        df = add_dedup_flags(df)  # nenhuma flag adicionada
    
    Note:
        Processa NaN/vazio como valores válidos para chave.
    """
    df = df.copy()
    
    # ── LineTotal dedup ──────────────────────────────────────
    if lt_key_cols:
        # ✅ Guard: verifica se TODAS as colunas existem
        missing_lt = [c for c in lt_key_cols if c not in df.columns]
        if missing_lt:
            # Não deduplica — avisa mas não quebra
            import warnings
            warnings.warn(
                f"add_dedup_flags: colunas {missing_lt} não encontradas "
                f"para _lt_first. Dedup ignorado.",
                stacklevel=2
            )
        else:
            lt_key = df[lt_key_cols].astype(str).agg("‖".join, axis=1)
            df[lt_col_name] = ~lt_key.duplicated(keep="first")
    
    # ── AmountReceived dedup ──────────────────────────────────
    if ar_key_cols:
        # ✅ Guard: idem
        missing_ar = [c for c in ar_key_cols if c not in df.columns]
        if missing_ar:
            import warnings
            warnings.warn(
                f"add_dedup_flags: colunas {missing_ar} não encontradas "
                f"para _ar_first. Dedup ignorado.",
                stacklevel=2
            )
        else:
            ar_key = df[ar_key_cols].astype(str).agg("‖".join, axis=1)
            df[ar_col_name] = ~ar_key.duplicated(keep="first")
    
    return df


def get_dedup_subset(df: pd.DataFrame, flag_col: str = "_lt_first") -> pd.DataFrame:
    """
    Retorna subset deduplicado (apenas linhas com flag=True).
    
    Args:
        df: DataFrame com coluna de flag
        flag_col: nome da coluna flag (default: "_lt_first")
        
    Returns:
        subset deduplicado ou DataFrame vazio se flag não existir
    """
    if flag_col not in df.columns:
        return df.copy()
    return df[df[flag_col]].copy()
