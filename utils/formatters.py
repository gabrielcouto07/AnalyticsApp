"""
Formatadores genéricos para exibição de dados.
Reutilizáveis em todos os modelos.
"""

def fmt_brl(v: float) -> str:
    """
    Formata número como moeda brasileira (R$ X.XXX,XX).
    
    Args:
        v: valor numérico
        
    Returns:
        string formatada como R$
        
    Example:
        >>> fmt_brl(1234.56)
        'R$ 1.234,56'
        >>> fmt_brl(-100.00)
        '-R$ 100,00'
    """
    try:
        s = f"R$ {abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"-{s}" if v < 0 else s
    except Exception:
        return "R$ 0,00"


def pct_fmt(v: float) -> str:
    """
    Formata número como percentual com 2 casas decimais.
    
    Args:
        v: valor em formato decimal (ex: 0.5 para 50%)
        
    Returns:
        string formatada como "X,XX%"
        
    Example:
        >>> pct_fmt(0.15)
        '15,00%'
        >>> pct_fmt(0.051234)
        '5,12%'
    """
    try:
        return f"{float(v):.2f}%"
    except Exception:
        return "0,00%"


def fmt_date(v, fmt: str = "%d/%m/%Y") -> str:
    """
    Formata Timestamp/datetime como string.
    
    Args:
        v: Timestamp ou datetime
        fmt: formato strftime (padrão: %d/%m/%Y)
        
    Returns:
        data formatada ou string vazia se inválido
    """
    try:
        return v.strftime(fmt) if hasattr(v, 'strftime') else str(v)
    except Exception:
        return ""


def fmt_int(v: int) -> str:
    """
    Formata inteiro com separador de milhares (ponto).
    
    Args:
        v: valor inteiro
        
    Returns:
        string formatada ex: "1.234"
    """
    try:
        return f"{int(v):,}".replace(",", ".")
    except Exception:
        return "0"
