"""
Parsers genéricos para normalização de dados.
Convertem strings/valores diversos em tipos específicos.
"""

import re
from datetime import datetime
import pandas as pd


def parse_num(v) -> float:
    """
    Parse robusto de valor numérico.
    
    Trata:
    - Strings com pontuação BR (1.234,56)
    - Strings com pontuação US (1,234.56)
    - Excel serials
    - NaN/None/null strings
    - Valores já numéricos
    - [PATCH 5 linhas] Strings com unidades (ex: "25.48 m3", "100 kg")
    
    Args:
        v: string, int, float ou qualquer tipo
        
    Returns:
        float convertido, ou 0.0 se inválido
        
    Example:
        >>> parse_num("1.234,56")
        1234.56
        >>> parse_num("25.48 m3")
        25.48
        >>> parse_num("NaN")
        0.0
    """
    if pd.isna(v):
        return 0.0
    
    s = str(v).strip()
    
    # Strings textuais que representam nulo
    if s.lower() in ("nan", "none", "null", "", "n/a", "-"):
        return 0.0
    
    # ── [PATCH 5 LINHAS] Remover unidades (m3, kg, l, un, etc) ──
    # Detecta padrões como "25.48 m3" e extrai só o número
    s = re.sub(r'\s*[a-za-z%/]+.*$', '', s, flags=re.IGNORECASE)
    s = s.strip()
    # ────────────────────────────────────────────────────────────
    
    # Remover caracteres não-numéricos exceto ponto, vírgula e sinal
    s = re.sub(r"[^\d.,\-]", "", s)
    
    # Após limpar, verifica se sobrou algo com pelo menos um dígito
    if not s or not re.search(r"\d", s):
        return 0.0
    
    # Formato BR: 1.234,56 (ponto = mil, vírgula = decimal)
    if re.search(r"\d{1,3}(\.\d{3})+,\d", s):
        s = s.replace(".", "").replace(",", ".")
    else:
        # Formato US ou sem separador: 1,234.56 → transforma
        s = s.replace(",", ".")
    
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def smart_date(val):
    """
    Parse inteligente de data.
    
    Trata:
    - Excel serials (40000 < n < 60000)
    - Strings em vários formatos (YYYY-MM-DD, DD/MM/YYYY, etc.)
    - pd.Timestamp/datetime
    
    Args:
        val: Excel serial, string, datetime, etc.
        
    Returns:
        pd.Timestamp ou pd.NaT se inválido
        
    Example:
        >>> smart_date("01/01/2023")
        Timestamp('2023-01-01 00:00:00')
        >>> smart_date(44928)  # Excel serial
        Timestamp('2023-01-01 00:00:00')
    """
    if pd.isna(val):
        return pd.NaT
    
    s = str(val).strip()
    
    # Tentar interpret como Excel serial (40000 < n < 60000)
    try:
        n = float(s)
        if 40000 < n < 60000:
            return pd.Timestamp("1899-12-30") + pd.Timedelta(days=n)
    except (ValueError, TypeError):
        pass
    
    # Tentar parse com formatos conhecidos
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
        try:
            return pd.Timestamp(datetime.strptime(s[:10], fmt))
        except Exception:
            continue
    
    # Fallback: deixar pandas tentar
    try:
        return pd.to_datetime(s, errors="coerce")
    except Exception:
        return pd.NaT


def _get_first_mode(x):
    """
    Retorna o modo (valor mais frequente) de uma série.
    Se houver empate ou série vazia, retorna string vazia.
    
    Usado em agregações para preencher texto (ex: ItemDescription).
    
    Args:
        x: pd.Series com valores
        
    Returns:
        valor mais frequente ou ""
    """
    mode_vals = x.mode()
    return mode_vals.iloc[0] if len(mode_vals) > 0 else ""
