"""
Model Detector — Detecção automática do modelo pelos dados

Analisa as colunas presentes em um DataFrame e sugere qual modelo
é mais apropriado (Comissão, Vendas, Compras, etc.)
"""

import pandas as pd
from typing import Tuple, List


def detect_model(df: pd.DataFrame, models: dict) -> tuple[str, float]:
    """
    Compara ALIASES do COL_MAP contra nomes ORIGINAIS do DataFrame.
    NUNCA compara canonical names — eles só existem após normalização.
    
    Args:
        df: DataFrame com dados brutos (colunas originais)
        models: dict {model_name: ModelClass, ...}
        
    Returns:
        (melhor_modelo, confianca_0_a_100)
        
    Example:
        >>> from app import MODELS_AVAILABLE
        >>> detect_model(df_raw, MODELS_AVAILABLE)
        ('VENDAS', 94.0)
    """
    # Uppercased original columns do arquivo carregado
    df_cols_up = {c.upper().strip() for c in df.columns}
    scores = {}
    
    for model_name, ModelClass in models.items():
        # Todos os ALIASES (não canonicos) em uppercase
        all_aliases_up = {
            alias.upper().strip()
            for canon, aliases in ModelClass.COL_MAP.items()
            for alias in aliases
        }
        
        # Aliases das colunas OBRIGATÓRIAS do modelo
        required_aliases_up = set()
        for req_canon in ModelClass.REQUIRED_COLS:
            for alias in ModelClass.COL_MAP.get(req_canon, [req_canon]):
                required_aliases_up.add(alias.upper().strip())
        
        # Quantas required_aliases batem com df_cols_up?
        found_req = sum(1 for a in required_aliases_up if a in df_cols_up)
        total_req = len(ModelClass.REQUIRED_COLS)
        
        # Quantas optional aliases batem?
        found_opt = sum(1 for a in all_aliases_up if a in df_cols_up)
        total_opt = len(all_aliases_up)
        
        # Score ponderado: required tem peso 70%, optional 30%
        if total_req == 0 or found_req == 0:
            scores[model_name] = 0.0
        else:
            req_pct = found_req / total_req
            opt_pct = found_opt / total_opt if total_opt > 0 else 0
            scores[model_name] = req_pct * 0.7 + opt_pct * 0.3
    
    best = max(scores, key=scores.get)
    return best, round(scores[best] * 100, 1)


def detect_model_by_columns(
    df: pd.DataFrame,
    models_available: dict = None
) -> Tuple[str, float, List[str]]:
    """
    Detecta automaticamente qual modelo usar baseado nas colunas presentes.
    
    Args:
        df: DataFrame com colunas a analisar
        models_available: dict {model_key: ModelClass} (opcional)
                          Se None, usa padrões hardcoded
        
    Returns:
        (model_name, confidence_score, matching_columns)
        
    Example:
        >>> from app import MODELS_AVAILABLE
        >>> detect_model_by_columns(df_vendas, MODELS_AVAILABLE)
        ('VENDAS', 0.94, ['SaleDate', 'SlpName', 'LineTotal', ...])
    """
    
    col_names_up = set([c.upper().strip() for c in df.columns])
    
    # Padrões de detecção para cada modelo
    patterns = {
        "COMISSAO": {
            "required": ["RECEIVDATE", "INVDOCNUM", "SLPNAME", "ITEMCODE", "LINETOTAL", "COMMISSIONVALUE"],
            "optional": ["AMOUNTRECEIVED", "COMMISSIONSORT", "BRANCHNAME", "PAYMENTBASE"],
        },
        "VENDAS": {
            "required": ["SALEDATE", "SLPNAME", "LINETOTAL"],
            "optional": ["ITEMCODE", "ITEMDESCRIPTION", "CARDNAME", "INVOICETOTAL", "STATE", "QUANTITY"],
        },
        "COMPRAS": {
            "required": ["PURCHASEDATE", "SUPPLIERNAME", "PURCHASEAMOUNT"],
            "optional": ["ITCODE", "CATEGORYCODE", "QUANTITY", "COST"],
        },
        "DESPESAS": {
            "required": ["EXPENSEDATE", "COSTCENTER", "EXPENSEAMOUNT"],
            "optional": ["CATEGORY", "DEPARTMENT", "DESCRIPTION"],
        },
    }
    
    scores = {}
    matches = {}
    
    for model, pattern in patterns.items():
        # Score = (required_match / total_required) * 0.7 + (optional_match / total_optional) * 0.3
        req_cols = pattern.get("required", [])
        opt_cols = pattern.get("optional", [])
        
        # ── Comparar sempre em UPPERCASE ──
        req_found = sum(1 for c in req_cols if c in col_names_up)
        opt_found = sum(1 for c in opt_cols if c in col_names_up)
        
        req_score = req_found / len(req_cols) if req_cols else 0
        opt_score = opt_found / len(opt_cols) if opt_cols else 0
        
        # Penalizar se faltam required columns
        if req_found == 0:
            score = 0
        elif req_score < 0.6:
            score = 0  # Rejeitar se faltam muchos required
        else:
            score = req_score * 0.7 + opt_score * 0.3
        
        scores[model] = score
        matches[model] = list(set(
            [c for c in req_cols if c in col_names_up] + 
            [c for c in opt_cols if c in col_names_up]
        ))
    
    # Encontrar melhor match
    best_model = max(scores, key=scores.get)
    best_score = scores[best_model]
    best_matches = matches[best_model]
    
    return best_model, best_score, best_matches


def format_detection_message(model: str, score: float, matches: List[str]) -> str:
    """
    Formata uma mensagem legível com o resultado da detecção.
    
    Args:
        model: nome do modelo detectado
        score: score de confiança (0-1)
        matches: lista de colunas que combinaram
        
    Returns:
        string formatada com emoji e informação
    """
    
    icons = {
        "COMISSAO": "💰",
        "VENDAS": "📈",
        "COMPRAS": "🛒",
        "DESPESAS": "💳",
    }
    
    icon = icons.get(model, "📊")
    conf_pct = int(score * 100)
    conf_bar = "█" * conf_pct + "░" * (100 - conf_pct)
    
    return f"""{icon} **{model}** — {conf_pct}% compatível

Colunas reconhecidas: {len(matches)} detectadas
Confiança: [{conf_bar}] {conf_pct}%

✅ Use este modelo para análise automática."""
