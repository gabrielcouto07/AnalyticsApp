import io
import json
import re
import numpy as np
import pandas as pd
from typing import Optional, Dict, Tuple
import chardet
import pdfplumber
import sqlparse
from io import BytesIO

try:
    import camelot
except ImportError:
    camelot = None


def detect_encoding(file_bytes: bytes) -> str:
    """Detecta o encoding de um arquivo usando chardet."""
    result = chardet.detect(file_bytes)
    return result.get("encoding", "utf-8") or "utf-8"


def detect_and_parse(df: pd.DataFrame) -> pd.DataFrame:
    """Converte tipos de colunas detectando automaticamente."""
    if not isinstance(df, pd.DataFrame):
        return df
    
    df = df.copy()
    for col in df.columns:
        try:
            if not hasattr(df[col], 'dtype') or df[col].dtype != object:
                continue
        except Exception:
            continue
            
        try:
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().sum() / len(df) > 0.7:
                df[col] = parsed
                continue
        except Exception:
            pass

        try:
            cleaned = (
                df[col].astype(str)
                .str.replace(r"[R$%\s]", "", regex=True)
                .str.replace(".", "", regex=False)
                .str.replace(",", ".", regex=False)
            )
            numeric = pd.to_numeric(cleaned, errors="coerce")
            if numeric.notna().sum() / len(df) > 0.7:
                df[col] = numeric
        except Exception:
            pass
    return df


def get_col_types(df: pd.DataFrame) -> dict:
    """Retorna classificação de tipos de colunas no formato {col_name: type}."""
    col_types = {}
    
    # Date columns
    for col in df.select_dtypes(include=["datetime64"]).columns:
        col_types[col] = "date"
    
    # Numeric columns
    for col in df.select_dtypes(include=[np.number]).columns:
        col_types[col] = "numeric"
    
    # Categorical/string columns
    for col in df.select_dtypes(include=["object", "category"]).columns:
        col_types[col] = "categorical"
    
    return col_types


def _load_csv(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Carrega arquivo CSV com detecção automática de separador e encoding."""
    encoding = detect_encoding(file_bytes)
    buf = BytesIO(file_bytes)
    sample = file_bytes[:2048].decode(encoding, errors="ignore")
    
    # Detecta separador
    sep = ";" if sample.count(";") > sample.count(",") else ","
    
    buf.seek(0)
    df = pd.read_csv(buf, sep=sep, on_bad_lines="skip", encoding=encoding)
    
    # Detecta e remove múltiplos cabeçalhos
    df = _skip_header_rows(df)
    
    return df


def _skip_header_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove linhas de cabeçalho múltiplas detectando quando há grande aumento 
    na proporção de células preenchidas (indicando início dos dados reais).
    
    Exemplo:
    - Linhas 0-5: Metadados/headers com muitos NaN
    - Linha 6: Header real com ~87% colunas preenchidas
    - Linhas 7+: Dados reais
    
    Função detecta o salto da linha 5 para 6 e usa linha 6 como headers.
    """
    if df.empty or len(df) <= 1:
        return df
    
    # Calcula proporção de células preenchidas por linha
    filled_ratios = []
    for idx in range(len(df)):
        row = df.iloc[idx]
        # Conta células não-nulas e não-string vazia
        filled = sum(1 for val in row if pd.notna(val) and str(val).strip())
        ratio = filled / len(df.columns) if len(df.columns) > 0 else 0
        filled_ratios.append(ratio)
    
    # Encontra o maior salto na proporção (indicador de header → dados)
    max_jump = 0
    header_row_idx = 0
    
    for i in range(1, len(filled_ratios)):
        jump = filled_ratios[i] - filled_ratios[i-1]
        # Queremos o ponto onde muitas mais colunas ficam preenchidas
        if jump > max_jump and filled_ratios[i] > 0.6:
            max_jump = jump
            header_row_idx = i
    
    # Se houver detecção clara de headers múltiplos (grande salto), remove as linhas anteriores
    if header_row_idx > 0 and max_jump > 0.25:
        # A linha header_row_idx contém os nomes das colunas
        new_headers = df.iloc[header_row_idx].astype(str).tolist()
        # Descarta as linhas 0 até header_row_idx, e usa a próxima como primeiro dado
        df = df.iloc[header_row_idx + 1:].reset_index(drop=True)
        df.columns = new_headers
    
    return df


def _load_excel_multisheet(file_bytes: bytes) -> Tuple[pd.DataFrame, Dict[str, int]]:
    """
    Carrega Excel com suporte a múltiplas abas.
    Retorna: (df_merged, available_sheets)
    """
    buf = BytesIO(file_bytes)
    xls = pd.ExcelFile(buf)
    sheets = xls.sheet_names
    available_sheets = {sheet: i for i, sheet in enumerate(sheets)}
    
    # Carrega primeira aba por padrão
    df = pd.read_excel(buf, sheet_name=sheets[0])
    
    # Se houver múltiplas abas com mesma estrutura, tenta unificar
    if len(sheets) > 1:
        dfs = []
        for sheet in sheets:
            try:
                sheet_df = pd.read_excel(buf, sheet_name=sheet)
                if set(sheet_df.columns) == set(df.columns):
                    dfs.append(sheet_df)
            except Exception:
                pass
        
        if len(dfs) > 1:
            df = pd.concat(dfs, ignore_index=True)
    
    return df, available_sheets


def _load_pdf(file_bytes: bytes) -> pd.DataFrame:
    """Carrega dados de PDF usando pdfplumber (primário) ou camelot (fallback)."""
    buf = BytesIO(file_bytes)
    
    # Tenta pdfplumber primeiro
    try:
        with pdfplumber.open(buf) as pdf:
            tables = []
            for page in pdf.pages:
                table = page.extract_table()
                if table:
                    tables.append(pd.DataFrame(table[1:], columns=table[0]))
            
            if tables:
                df = pd.concat(tables, ignore_index=True)
                return df
    except Exception as e:
        print(f"[INFO] pdfplumber falhou: {e}")
    
    # Fallback para camelot (requer ghostscript)
    if camelot:
        try:
            buf.seek(0)
            temp_path = "/tmp/temp_pdf.pdf"
            with open(temp_path, "wb") as f:
                f.write(buf.getvalue())
            
            tables = camelot.read_pdf(temp_path, pages="all")
            if tables:
                dfs = [table.df for table in tables]
                df = pd.concat(dfs, ignore_index=True)
                return df
        except Exception as e:
            print(f"[WARN] camelot também falhou: {e}")
    
    raise ValueError("Não foi possível extrair tabelas do PDF")


def _load_sql(file_bytes: bytes) -> pd.DataFrame:
    """Carrega dados de arquivo SQL extraindo INSERT INTO statements."""
    encoding = detect_encoding(file_bytes)
    content = file_bytes.decode(encoding, errors="ignore")
    
    # Encontra todos os INSERT INTO
    insert_pattern = r"INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)"
    matches = re.findall(insert_pattern, content, re.IGNORECASE | re.DOTALL)
    
    if not matches:
        raise ValueError("Nenhum INSERT INTO encontrado no arquivo SQL")
    
    # Extrai primeira tabela encontrada
    table_name, columns_str, values_str = matches[0]
    columns = [col.strip().strip("`'\"") for col in columns_str.split(",")]
    
    # Parse dos valores (simplificado)
    rows = []
    values_matches = re.findall(r"\((.*?)\)", values_str, re.DOTALL)
    for value_set in values_matches:
        values = [v.strip().strip("'\"") for v in value_set.split(",")]
        rows.append(values)
    
    if rows:
        df = pd.DataFrame(rows, columns=columns)
        return df
    
    raise ValueError("Não foi possível parsear valores SQL")


def _load_json(file_bytes: bytes) -> pd.DataFrame:
    """Carrega dados de JSON."""
    buf = BytesIO(file_bytes)
    raw = json.load(buf)
    
    if isinstance(raw, list):
        df = pd.json_normalize(raw)
    elif isinstance(raw, dict):
        for v in raw.values():
            if isinstance(v, list):
                df = pd.json_normalize(v)
                break
        else:
            df = pd.DataFrame([raw])
    else:
        raise ValueError("Estrutura JSON não reconhecida")
    
    return df


def _load_txt(file_bytes: bytes) -> pd.DataFrame:
    """Carrega arquivo TXT com detecção automática de separador."""
    encoding = detect_encoding(file_bytes)
    buf = BytesIO(file_bytes)
    sample = file_bytes[:2048].decode(encoding, errors="ignore")
    
    # Detecta separador
    sep = "\t" if "\t" in sample else ("|" if "|" in sample else ",")
    
    buf.seek(0)
    df = pd.read_csv(buf, sep=sep, on_bad_lines="skip", encoding=encoding)
    return df


def _load_docx(file_bytes: bytes) -> pd.DataFrame:
    """Carrega dados de DOCX (busca tabelas)."""
    try:
        from docx import Document
    except ImportError:
        raise ValueError("python-docx não instalado")
    
    buf = BytesIO(file_bytes)
    doc = Document(buf)
    
    for table in doc.tables:
        rows = []
        for row in table.rows:
            cells = [cell.text for cell in row.cells]
            rows.append(cells)
        
        if rows:
            df = pd.DataFrame(rows[1:], columns=rows[0])
            return df
    
    raise ValueError("Nenhuma tabela encontrada no DOCX")


def load_dataframe(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, Optional[Dict[str, int]]]:
    """
    Carrega DataFrame de arquivo em qualquer formato suportado.
    Retorna: (df, available_sheets ou None)
    """
    name = filename.lower()
    available_sheets = None
    
    if name.endswith((".xlsx", ".xls")):
        df, available_sheets = _load_excel_multisheet(file_bytes)
    elif name.endswith(".csv"):
        df = _load_csv(file_bytes, filename)
    elif name.endswith(".txt"):
        df = _load_txt(file_bytes)
    elif name.endswith(".json"):
        df = _load_json(file_bytes)
    elif name.endswith(".pdf"):
        df = _load_pdf(file_bytes)
    elif name.endswith((".sql", ".sql.txt")):
        df = _load_sql(file_bytes)
    elif name.endswith(".docx"):
        df = _load_docx(file_bytes)
    else:
        raise ValueError(f"Formato não suportado: {filename}")
    
    # Aplicar conversão de tipos
    df = detect_and_parse(df)
    
    # Limpar nomes de coluna
    df.columns = [col.strip().lower().replace(" ", "_").replace("-", "_") for col in df.columns]
    
    return df, available_sheets

