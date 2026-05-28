"""
File loaders genéricos.
Detecta formato (xlsx/csv), encoding, separador.
"""

import io
import pandas as pd


def load_file(f, col_map: dict = None):
    """
    Carrega arquivo (xlsx/csv) com detecção automática.
    
    Funciona para QUALQUER modelo.
    
    Args:
        f: file-like object com métodos .read(), .seek(), .name
        col_map: dict {canonical: [alias1, alias2, ...]} opcional
                 Se fornecido, tenta encontrar melhor sheet/header baseado
                 em quantas colunas do col_map são encontradas.
                 
    Returns:
        tuple (df, error_message)
        - Se sucesso: (pd.DataFrame, None)
        - Se erro: (None, "mensagem de erro")
        
    Process:
        1. Tenta Excel (.xlsx, .xls)
           - Testa todas as sheets se col_map fornecido (score)
           - Senão, retorna primeira sheet com dados
        2. Tenta CSV com vários encodings (utf-8, latin-1, cp1252)
           e separadores (tab, semicolon, comma)
        3. Retorna erro se nada funcionar
    """
    try:
        f.seek(0)
    except Exception:
        pass
    
    content = f.read()
    if not content:
        return None, "Arquivo vazio."
    
    # ── Fix #1: usar getattr para não quebrar com BytesIO ──
    name = getattr(f, 'name', 'arquivo.xlsx').lower()
    
    # Se col_map fornecido, criar set de aliases para scoring
    all_aliases_upper = set()
    if col_map:
        all_aliases_upper = {
            alias.upper().strip()
            for aliases in col_map.values()
            for alias in aliases
        }
    
    # ── Tentar Excel ──
    if name.endswith((".xlsx", ".xls")):
        try:
            xl = pd.ExcelFile(io.BytesIO(content))
            sheet_list = xl.sheet_names
        except Exception:
            sheet_list = [0]
        
        best_df, best_score = None, -1
        
        for sheet in sheet_list:
            for hrow in [0, 1, 2]:
                try:
                    df = pd.read_excel(
                        io.BytesIO(content),
                        dtype=str,
                        header=hrow,
                        sheet_name=sheet,
                        na_filter=False,
                    )
                    df.columns = [str(c).strip() for c in df.columns]
                    
                    if len(df.columns) < 5 or len(df) == 0:
                        continue
                    
                    # Score: quantas colunas encontradas no col_map
                    if all_aliases_upper:
                        score = sum(
                            1 for col in df.columns
                            if col.upper().strip() in all_aliases_upper
                        )
                    else:
                        score = len(df.columns)  # Sem col_map, prefer mais colunas
                    
                    if score > best_score:
                        best_score, best_df = score, df
                except Exception:
                    continue
        
        if best_df is not None:
            return best_df, None
    
    # ── Tentar CSV com vários encodings ──
    for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = content.decode(enc, errors="replace")
            for sep in ["\t", ";", ","]:
                try:
                    df = pd.read_csv(
                        io.StringIO(text),
                        sep=sep,
                        dtype=str,
                        na_filter=False,
                    )
                    if len(df.columns) >= 5:
                        df.columns = [str(c).strip() for c in df.columns]
                        return df, None
                except Exception:
                    continue
        except Exception:
            continue
    
    return None, f"Formato não reconhecido: {name}"


def to_excel(sheets: dict) -> bytes:
    """
    Converte dict de DataFrames em arquivo Excel.
    
    Args:
        sheets: dict {sheet_name: pd.DataFrame, ...}
                Ex: {"Vendedor": df1, "Filial": df2}
                
    Returns:
        bytes do arquivo Excel
    """
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, data in sheets.items():
            # Excel limita nome a 31 caracteres
            data.to_excel(writer, sheet_name=name[:31], index=False)
    return buf.getvalue()
