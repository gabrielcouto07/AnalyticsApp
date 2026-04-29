import json
import re
import unicodedata
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import chardet
import numpy as np
import pandas as pd
import pdfplumber
from utils.file_reader import read_file_bytes

try:
    import camelot
except ImportError:
    camelot = None


EMPTY_MARKERS = {"-", "--", "pago", "#n/d", "#value!", "n/a", "na", "nan", "none", ""}
MONTH_MAP = {
    "jan": 1,
    "fev": 2,
    "mar": 3,
    "abr": 4,
    "mai": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "set": 9,
    "out": 10,
    "nov": 11,
    "dez": 12,
}


def normalize_col_name(col: Any) -> str:
    """Normalize column name: remove accents, convert to lowercase, replace spaces with underscores."""
    value = unicodedata.normalize("NFKD", str(col).strip())
    value = value.encode("ascii", "ignore").decode("ascii")
    # Replace all whitespace and special chars with underscores
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    # Clean up multiple underscores
    value = re.sub(r"_+", "_", value)
    return value or "col"


def _clean_whitespace(value: Any) -> Any:
    """Aggressively clean whitespace from values."""
    # Ensure we're working with a scalar, not a Series
    if isinstance(value, pd.Series):
        return value.apply(_clean_whitespace)
    
    if value is None:
        return np.nan
    if isinstance(value, float) and np.isnan(value):
        return np.nan
    
    try:
        if pd.isna(value):
            return np.nan
    except (ValueError, TypeError):
        # If pd.isna fails, try to convert to string
        pass
    
    text = str(value).strip()
    if not text:
        return np.nan
    
    # Normalize internal whitespace (multiple spaces → single space)
    text = re.sub(r"\s+", " ", text)
    # Replace non-breaking spaces and other unicode whitespace
    text = re.sub(r"[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+", " ", text)
    
    # Final check for empty string
    if not text or text.isspace():
        return np.nan
    
    return text.strip()


def _is_text_cell(value: Any) -> bool:
    """Determine if a value should be considered text."""
    if pd.isna(value):
        return False
    text = _clean_whitespace(value)
    if text is None or pd.isna(text):
        return False
    # Ensure text is a scalar string
    if not isinstance(text, str):
        text = str(text).strip()
    if not text or len(text) == 0:
        return False
    lowered = text.lower()
    if lowered in EMPTY_MARKERS:
        return False
    # Check if it's NOT a number
    if re.fullmatch(r"[-+]?\d+([\.,]\d+)?", text):
        return False
    return len(text) < 60


def _is_numeric_like(value: Any) -> bool:
    """Determine if a value looks like a number."""
    if pd.isna(value):
        return False
    text = _clean_whitespace(value)
    # Use safe checks for potentially Series-like objects
    if text is None or pd.isna(text):
        return False
    # Ensure text is a scalar string
    if not isinstance(text, str):
        text = str(text).strip()
    if not text or len(text) == 0:
        return False
    lowered = text.lower()
    if lowered in EMPTY_MARKERS:
        return False
    # Remove currency and percentage symbols, but keep numbers
    cleaned = re.sub(r"[R$%\s]", "", text)
    # Handle Brazilian thousands separator (remove dots before groups of 3 digits)
    cleaned = re.sub(r"\.(?=\d{3}(?:[\.,]|$))", "", cleaned)
    # Replace comma with dot (Brazilian decimal separator)
    cleaned = cleaned.replace(",", ".")
    # Remove any remaining non-numeric characters
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if not cleaned or cleaned in {"-", "."}:
        return False
    numeric_val = pd.to_numeric(cleaned, errors="coerce")
    return bool(pd.notna(numeric_val))


def _detect_header_row(df_raw: pd.DataFrame) -> Tuple[int, float]:
    if df_raw.empty:
        return 0, 0.0

    best_row = 0
    best_score = -1.0
    scan_limit = min(len(df_raw), 20)

    for idx in range(scan_limit):
        row = df_raw.iloc[idx]
        cells = [value for value in row.tolist() if pd.notna(value) and str(value).strip()]
        if not cells:
            continue

        text_cells = sum(1 for value in cells if _is_text_cell(value))
        score = text_cells / len(cells)

        if idx + 1 < len(df_raw):
            next_row = df_raw.iloc[idx + 1]
            next_cells = [value for value in next_row.tolist() if pd.notna(value) and str(value).strip()]
            if next_cells:
                numeric_ratio = sum(1 for value in next_cells if _is_numeric_like(value)) / len(next_cells)
                if numeric_ratio >= 0.3:
                    score += 0.2

        if score > best_score:
            best_score = score
            best_row = idx

    return best_row, best_score


def _clean_empty_markers(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Remove empty markers and standardize empty values."""
    cleaned = df.copy()
    replacements = 0

    for col in cleaned.columns:
        if not pd.api.types.is_object_dtype(cleaned[col]) and not pd.api.types.is_string_dtype(cleaned[col]):
            continue

        def _replace(value: Any) -> Any:
            nonlocal replacements
            if pd.isna(value):
                return np.nan
            # First clean whitespace
            cleaned_val = _clean_whitespace(value)
            if pd.isna(cleaned_val):
                replacements += 1
                return np.nan
            # Then check if it's an empty marker
            if cleaned_val.lower() in EMPTY_MARKERS:
                replacements += 1
                return np.nan
            return cleaned_val

        cleaned[col] = cleaned[col].apply(_replace)

    return cleaned, replacements


def _parse_br_date_value(value: Any) -> Any:
    if pd.isna(value):
        return pd.NaT
    if isinstance(value, (pd.Timestamp, datetime)):
        return pd.Timestamp(value)

    text = str(value).strip()
    if not text:
        return pd.NaT

    match = re.fullmatch(r"(\d{1,2})[\/\-\s]([a-zA-Z]{3})[\/\-\s](\d{2,4})", text)
    if match:
        day, month_text, year_text = match.groups()
        month = MONTH_MAP.get(month_text.lower())
        if month:
            year = int(year_text)
            if year < 100:
                year += 2000
            try:
                return pd.Timestamp(datetime(year, month, int(day)))
            except ValueError:
                return pd.NaT

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2})?", text):
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=False)
    else:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    return parsed if pd.notna(parsed) else pd.NaT


def _convert_to_br_date(series: pd.Series) -> Tuple[pd.Series, float]:
    parsed = series.apply(_parse_br_date_value)
    parsed_ratio = parsed.notna().sum() / max(len(series), 1)
    return parsed, parsed_ratio


def _convert_to_numeric(series: pd.Series) -> Tuple[pd.Series, float]:
    text = series.astype(str).str.strip()
    cleaned = text.str.replace(r"[R$%\s]", "", regex=True)
    cleaned = cleaned.str.replace(r"\.(?=\d{3}(?:[\.,]|$))", "", regex=True)
    cleaned = cleaned.str.replace(",", ".", regex=False)
    cleaned = cleaned.str.replace(r"[^0-9.\-]", "", regex=True)
    numeric = pd.to_numeric(cleaned, errors="coerce")
    parsed_ratio = numeric.notna().sum() / max(len(series), 1)
    return numeric, parsed_ratio


def _infer_column_type(series: pd.Series) -> Tuple[str, pd.Series, float]:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date", pd.to_datetime(series, errors="coerce"), 1.0
    if pd.api.types.is_numeric_dtype(series):
        return "numeric", pd.to_numeric(series, errors="coerce"), 1.0

    date_series, date_ratio = _convert_to_br_date(series)
    if date_ratio >= 0.6:
        return "date", date_series, date_ratio

    numeric_series, numeric_ratio = _convert_to_numeric(series)
    if numeric_ratio >= 0.6:
        return "numeric", numeric_series, numeric_ratio

    return "categorical", series.astype(str), max(date_ratio, numeric_ratio)


def _dedupe_columns(columns: pd.Index) -> Tuple[list[str], Dict[str, int]]:
    seen: Dict[str, int] = {}
    result: list[str] = []

    for column in columns:
        base = normalize_col_name(column)
        count = seen.get(base, 0)
        if count == 0:
            result.append(base)
        else:
            result.append(f"{base}_{count}")
        seen[base] = count + 1

    duplicates = {name: count for name, count in seen.items() if count > 1}
    return result, duplicates


def detect_encoding(file_bytes: bytes) -> str:
    """Detecta o encoding de um arquivo usando chardet."""
    result = chardet.detect(file_bytes)
    return result.get("encoding", "utf-8") or "utf-8"


def detect_and_parse(df: pd.DataFrame, audit: Optional[Any] = None) -> pd.DataFrame:
    """Converte tipos de colunas detectando automaticamente e registra audit trail quando fornecido."""
    if not isinstance(df, pd.DataFrame):
        return df

    df = df.copy()
    for col in df.columns:
        series = df[col]
        try:
            inferred_type, parsed_series, confidence = _infer_column_type(series)
        except Exception:
            inferred_type = "categorical"
            parsed_series = series
            confidence = 0.0

        if inferred_type == "date":
            df[col] = pd.to_datetime(parsed_series, errors="coerce")
            if audit is not None:
                audit.add(
                    "typing",
                    f"Date Column: '{col}'",
                    f"Column '{col}' was interpreted as a date field. BR date formats were handled automatically.",
                    {
                        "column": col,
                        "non_null_count": int(df[col].notna().sum()),
                        "confidence": round(float(confidence), 3),
                    },
                    "success",
                )
            continue

        if inferred_type == "numeric":
            df[col] = pd.to_numeric(parsed_series, errors="coerce")
            if audit is not None:
                numeric_series = df[col].dropna()
                audit.add(
                    "typing",
                    f"Numeric Column: '{col}'",
                    f"Column '{col}' was converted to numbers. Brazilian separators such as 1.435,00 were normalized.",
                    {
                        "column": col,
                        "non_null_count": int(df[col].notna().sum()),
                        "min": round(float(numeric_series.min()), 2) if len(numeric_series) else None,
                        "max": round(float(numeric_series.max()), 2) if len(numeric_series) else None,
                        "mean": round(float(numeric_series.mean()), 2) if len(numeric_series) else None,
                        "confidence": round(float(confidence), 3),
                    },
                    "success" if len(numeric_series) else "info",
                )
            continue

        df[col] = series.astype(str)
        if audit is not None:
            non_null_count = int(series.notna().sum())
            audit.add(
                "typing",
                f"Categorical Column: '{col}'",
                f"Column '{col}' remains as text because it did not look like a date or a number.",
                {
                    "column": col,
                    "unique_count": int(df[col].nunique(dropna=True)),
                    "non_null_count": non_null_count,
                },
                "info",
            )
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
    """Carrega arquivo CSV com detecção automática de separador, encoding e cabeçalho."""
    encoding = detect_encoding(file_bytes)
    buf = BytesIO(file_bytes)
    sample = file_bytes[:2048].decode(encoding, errors="ignore")
    
    # Detecta separador
    sep = ";" if sample.count(";") > sample.count(",") else ","
    
    buf.seek(0)
    df_raw = pd.read_csv(buf, sep=sep, on_bad_lines="skip", encoding=encoding, header=None, dtype=str, keep_default_na=False)
    
    # NOVO: Pré-processamento para pular linhas de metadata pura
    # Detecta linhas que têm muitas poucas colunas preenchidas (indicando metadata/cabeçalho vazio)
    metadata_lines = 0
    for idx in range(min(len(df_raw), 15)):  # Procura nos primeiros 15 linhas
        row = df_raw.iloc[idx]
        filled_count = sum(1 for val in row if pd.notna(val) and str(val).strip())
        filled_ratio = filled_count / len(row) if len(row) > 0 else 0
        
        # Se menos de 50% das colunas têm valor (ou menos de 10 colunas), é provavelmente metadata
        if filled_ratio < 0.5 or filled_count < 10:
            # Mas verifica se parece ser um header: procura por palavras-chave de header
            row_text = " ".join([str(v)[:20] for v in row if pd.notna(v) and str(v).strip()])
            # Se tem palavras chave de header (como palavras completas), não é metadata pura
            header_keywords = r'\b(consolidado|cod|fornecedor|valor|data|natureza|boleto|deposito)\b'
            if re.search(header_keywords, row_text, re.IGNORECASE):
                break  # Para aqui - encontrou header
            metadata_lines += 1
        else:
            # Para quando encontra a primeira linha com mais dados
            break
    
    # Remove as linhas de metadata detectadas
    if metadata_lines > 0:
        df_raw = df_raw.iloc[metadata_lines:].reset_index(drop=True)
    
    # Agora detecta o header na parte remaining
    header_row, _ = _detect_header_row(df_raw)
    df = df_raw.iloc[header_row + 1 :].copy().reset_index(drop=True)
    df.columns = df_raw.iloc[header_row].tolist()
    
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
    buf.seek(0)
    raw_first = pd.read_excel(buf, sheet_name=sheets[0], header=None, dtype=str)
    header_row, _ = _detect_header_row(raw_first)
    buf.seek(0)
    df = pd.read_excel(buf, sheet_name=sheets[0], header=header_row, dtype=str)
    
    # Se houver múltiplas abas com mesma estrutura, tenta unificar
    if len(sheets) > 1:
        dfs = []
        for sheet in sheets:
            try:
                buf.seek(0)
                raw_sheet = pd.read_excel(buf, sheet_name=sheet, header=None, dtype=str)
                sheet_header_row, _ = _detect_header_row(raw_sheet)
                buf.seek(0)
                sheet_df = pd.read_excel(buf, sheet_name=sheet, header=sheet_header_row, dtype=str)
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
    df_raw = pd.read_csv(buf, sep=sep, on_bad_lines="skip", encoding=encoding, header=None, dtype=str, keep_default_na=False)
    header_row, _ = _detect_header_row(df_raw)
    df = df_raw.iloc[header_row + 1 :].copy().reset_index(drop=True)
    df.columns = df_raw.iloc[header_row].tolist()
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


def _detect_end_of_data(df: pd.DataFrame, blank_threshold: int = 10, min_active_cols: int = 2) -> Tuple[pd.DataFrame, int]:
    """
    Detecta o fim dos dados verificando quando múltiplas colunas ficam em branco.
    
    Algoritmo:
    1. Identifica colunas "ativas" (com dados reais consistentes no início)
    2. Para cada coluna ativa, encontra o último índice com dado real (não-vazio)
    3. Verifica se há gap de 10+ linhas em branco após os dados
    4. Trunca a partir do último índice se padrão detectado
    
    Returns: (DataFrame truncado, última linha com dados)
    """
    if df.empty:
        return df, 0
    
    # Identifica colunas ativas (com dados REAIS não-vazios nos primeiros 50%)
    # Não apenas notna(), mas strings não-vazias após strip
    mid_point = len(df) // 2
    active_cols = []
    for col_idx in range(len(df.columns)):
        try:
            col_data = df.iloc[:mid_point, col_idx].fillna("").astype(str).str.strip()
            non_empty_count = (col_data != "").sum()
            ratio = float(non_empty_count) / float(max(mid_point, 1))
            if ratio >= 0.3:  # Pelo menos 30% de dados reais (não-vazios)
                active_cols.append(col_idx)
        except Exception:
            continue
    
    if len(active_cols) < min_active_cols:
        # Não há colunas suficientes para análise
        return df, len(df) - 1
    
    # Para cada coluna ativa, encontra a última linha com dados reais
    last_data_indices = []
    for col_idx in active_cols:
        try:
            col_data = df.iloc[:, col_idx].fillna("").astype(str).str.strip()
            non_empty = (col_data != "")
            if non_empty.any():
                last_idx = int(non_empty[::-1].idxmax())
                last_data_indices.append(last_idx)
        except Exception:
            continue
    
    if not last_data_indices:
        return df, len(df) - 1
    
    # Agrupa índices similares (permitindo pequenas variações)
    last_data_indices.sort()
    
    # Se há muita variação, a estrutura é inconsistente, retorna original
    max_idx = int(max(last_data_indices))
    min_idx = int(min(last_data_indices))
    
    # Se a diferença entre as colunas é muito grande, considera a mais conservadora
    # (última coluna a ter dados)
    if max_idx - min_idx > len(df) * 0.2:
        # Variação grande demais, usa a mínima
        cutoff_idx = min_idx
    else:
        # Usa o máximo como referência
        cutoff_idx = max_idx
    
    # Verifica se há gap de linhas em branco após cutoff_idx
    # Conta linhas consecutivas vazias a partir de cutoff_idx+1
    consecutive_empty = 0
    for idx in range(cutoff_idx + 1, len(df)):
        try:
            row_data = df.iloc[idx].fillna("").astype(str).str.strip()
            if (row_data == "").all():
                consecutive_empty += 1
                if consecutive_empty >= blank_threshold:
                    # Encontrou 10+ linhas vazias consecutivas, trunca aqui
                    return df.iloc[:cutoff_idx + 1].copy(), cutoff_idx
            else:
                # Linha não-vazia, reset counter
                consecutive_empty = 0
        except Exception:
            consecutive_empty += 1
    
    # Se não detectou padrão de fim, retorna original
    return df, len(df) - 1


def _prepare_dataframe(df: pd.DataFrame, audit: Optional[Any] = None) -> pd.DataFrame:
    """Prepare DataFrame by cleaning, normalizing, and validating data."""
    working = df.copy()
    
    # Detecta e remove linhas em branco no fim do arquivo
    working, end_row = _detect_end_of_data(working, blank_threshold=10, min_active_cols=2)
    
    rows_removed = len(df) - len(working)
    if audit is not None and rows_removed > 0:
        audit.add(
            "cleaning",
            "End-of-Data Detected",
            f"Detected end of data at row {end_row}. Removed {rows_removed} trailing blank rows.",
            {
                "original_rows": len(df),
                "cleaned_rows": len(working),
                "removed_rows": rows_removed,
            },
            "info",
        )

    # Clean whitespace in all string columns
    for col in working.select_dtypes(include=['object']).columns:
        working[col] = working[col].apply(_clean_whitespace)

    if audit is not None:
        audit.add(
            "cleaning",
            "Empty Values Replaced",
            "Known placeholders such as '-', 'PAGO', '#N/D' and blanks were converted to missing values.",
            {
                "replaced_count": 0,
                "markers_checked": sorted(EMPTY_MARKERS),
            },
            "success",
        )

    working, replacements = _clean_empty_markers(working)
    working = working.replace(r"^\s*$", np.nan, regex=True)
    
    before_rows = len(working)
    before_cols = len(working.columns)
    working = working.dropna(axis=0, how="all").dropna(axis=1, how="all")
    rows_removed = before_rows - len(working)
    cols_removed = before_cols - len(working.columns)

    if audit is not None and audit.steps:
        audit.steps[-1].details["replaced_count"] = int(replacements)

    if audit is not None:
        audit.add(
            "cleaning",
            "Empty Rows/Columns Removed",
            f"Removed {rows_removed} empty rows and {cols_removed} empty columns.",
            {
                "rows_removed": int(rows_removed),
                "cols_removed": int(cols_removed),
            },
            "success" if rows_removed or cols_removed else "info",
        )

    normalized_columns, duplicates = _dedupe_columns(working.columns)
    original_columns = list(working.columns)
    working.columns = normalized_columns

    if audit is not None:
        changed_columns = sum(1 for original, normalized in zip(original_columns, normalized_columns) if normalize_col_name(original) != normalized)
        audit.add(
            "parsing",
            "Column Names Normalized",
            "Column names were cleaned to use lower-case ASCII identifiers with underscores.",
            {
                "column_count": len(working.columns),
                "changed_columns": int(changed_columns),
                "duplicate_groups": duplicates,
            },
            "success",
        )

    working = detect_and_parse(working, audit=audit)
    return working


def load_dataframe(file_bytes: bytes, filename: str, audit: Optional[Any] = None) -> Tuple[pd.DataFrame, Optional[Dict[str, int]], Any]:
    """
    Carrega DataFrame de arquivo em qualquer formato suportado.
    Retorna: (df, available_sheets ou None, audit)
    """
    name = filename.lower()
    available_sheets = None

    if audit is None:
        from .audit import AuditTrail

        audit = AuditTrail()

    ext = name[name.rfind("."):] if "." in name else name
    audit.add(
        "parsing",
        "File Format Detected",
        f"File '{filename}' was identified as {ext.upper() or 'UNKNOWN'}. Loading started.",
        {
            "filename": filename,
            "ext": ext,
        },
        "success",
    )
    
    if name.endswith((".xlsx", ".xls")):
        df, available_sheets = _load_excel_multisheet(file_bytes)
        audit.add(
            "parsing",
            "Worksheet Detected",
            f"Workbook contains {len(available_sheets or {})} worksheet(s). The first compatible sheet was loaded.",
            {
                "sheet_count": len(available_sheets or {}),
                "sheets": list((available_sheets or {}).keys()),
            },
            "info",
        )
    elif name.endswith((".csv", ".txt", ".json")):
        df = read_file_bytes(file_bytes, ext)
    elif name.endswith(".pdf"):
        df = _load_pdf(file_bytes)
    elif name.endswith((".sql", ".sql.txt")):
        df = _load_sql(file_bytes)
    elif name.endswith(".docx"):
        df = _load_docx(file_bytes)
    else:
        raise ValueError(f"Formato não suportado: {filename}")
    
    if name.endswith((".csv", ".txt")):
        audit.add(
            "parsing",
            "Encoding Detected",
            f"Text file encoding detected as {detect_encoding(file_bytes)}.",
            {"encoding": detect_encoding(file_bytes)},
            "success",
        )
    else:
        audit.add(
            "parsing",
            "Encoding Detected",
            "Binary file format detected; encoding does not apply.",
            {"encoding": "binary"},
            "info",
        )

    df = _prepare_dataframe(df, audit=audit)

    # Perform semantic analysis and emit audit steps
    try:
        from .semantic import SemanticAnalyzer
        semantic_analyzer = SemanticAnalyzer()
        semantic_profile = semantic_analyzer.build_dataset_profile(df)
        
        # Emit audit step for semantic classification completion
        audit.add(
            "semantic",
            "Semantic Classification Complete",
            f"Analyzed {len(df.columns)} columns and classified them into semantic types (temporal, monetary, category, etc.).",
            {
                "total_columns": len(df.columns),
                "column_groups": {k: len(v) for k, v in semantic_profile.get("column_groups", {}).items()},
                "primary_temporal_col": semantic_profile.get("primary_temporal_col"),
                "primary_category_cols": semantic_profile.get("primary_category_cols", []),
            },
            "success",
        )
    except Exception as e:
        # If semantic analysis fails, just log a warning step
        audit.add(
            "semantic",
            "Semantic Classification Skipped",
            f"Semantic analysis could not be completed: {str(e)}",
            {"error": str(e)},
            "warning",
        )

    # Perform data quality analysis and emit audit steps
    try:
        null_analysis = {}
        null_rate = {}
        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            null_pct = float(df[col].isnull().mean() * 100)
            null_analysis[col] = {"null_count": null_count, "null_pct": round(null_pct, 1)}
            if null_pct > 0:
                null_rate[col] = round(null_pct, 1)
        
        if null_rate:
            audit.add(
                "validation",
                "Null Rate Analyzed",
                f"Analyzed null values across {len(null_rate)} columns. See details for per-column breakdown.",
                {
                    "columns_with_nulls": len(null_rate),
                    "null_analysis": null_rate,
                },
                "warning" if max(null_rate.values()) > 50 else "info",
            )
        
        # Detect duplicate keys (for NF-like data with supplier + NF columns)
        potential_key_cols = [col for col in df.columns if 'fornecedor' in col.lower() or 'nf' in col.lower()]
        if len(potential_key_cols) >= 2:
            try:
                key_col1, key_col2 = potential_key_cols[0], potential_key_cols[1]
                if df[key_col1].notna().any() and df[key_col2].notna().any():
                    duplicate_keys = df.groupby([key_col1, key_col2]).size()
                    duplicates_count = len(duplicate_keys[duplicate_keys > 1])
                    if duplicates_count > 0:
                        audit.add(
                            "validation",
                            "Duplicate Keys Detected",
                            f"Found {duplicates_count} duplicate supplier-invoice pairs in the data.",
                            {
                                "key_columns": [key_col1, key_col2],
                                "duplicate_key_pairs": duplicates_count,
                                "total_rows": len(df),
                            },
                            "warning",
                        )
            except Exception:
                pass
        
        # Detect outliers in numeric columns (>3σ from mean)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        outlier_report = {}
        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) > 3:
                mean = series.mean()
                std = series.std()
                if std > 0:
                    z_scores = np.abs((series - mean) / std)
                    outliers_count = int((z_scores > 3).sum())
                    if outliers_count > 0:
                        outlier_report[col] = {
                            "outlier_count": outliers_count,
                            "outlier_pct": round(float(outliers_count / len(series) * 100), 1),
                            "mean": round(float(mean), 2),
                            "std": round(float(std), 2),
                        }
        
        if outlier_report:
            audit.add(
                "validation",
                "Outlier Detection Complete",
                f"Statistical analysis detected outliers (>3σ from mean) in {len(outlier_report)} numeric columns.",
                {
                    "columns_with_outliers": len(outlier_report),
                    "outlier_analysis": outlier_report,
                },
                "info",
            )
    except Exception as e:
        # If data quality analysis fails, continue without error
        audit.add(
            "validation",
            "Data Quality Analysis Skipped",
            f"Could not complete data quality analysis: {str(e)}",
            {"error": str(e)},
            "info",
        )

    return df, available_sheets, audit


SKIP_WORKBOOK_SHEETS = {
    "calendario",
    "entenda como operar",
}


def _sheet_has_only_empty_intro_rows(df_raw: pd.DataFrame) -> bool:
    if df_raw.empty:
        return True
    intro = df_raw.head(10)
    return bool(intro.dropna(axis=0, how="all").empty)


def detect_format(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    by_extension = {
        ".xlsx": "xlsx",
        ".xls": "xls",
        ".xlsm": "xlsx",
        ".csv": "csv",
        ".json": "json",
        ".txt": "txt",
    }
    if extension in by_extension:
        return by_extension[extension]

    if content.startswith(b"PK\x03\x04"):
        return "xlsx"
    if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "xls"

    stripped = content.lstrip()
    if stripped.startswith((b"{", b"[")):
        return "json"

    try:
        sample = stripped[:1024].decode("utf-8", errors="ignore")
    except Exception:
        sample = ""

    if "," in sample or ";" in sample or "\t" in sample:
        return "csv"
    return "txt"


def _clean_sheet_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    working = working.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if working.empty:
        return working

    renamed_columns: list[str] = []
    for index, column in enumerate(working.columns):
        if isinstance(column, str):
            text = column.strip()
            renamed_columns.append(text or f"COL_{index + 1}")
        elif pd.notna(column):
            renamed_columns.append(str(column).strip() or f"COL_{index + 1}")
        else:
            renamed_columns.append(f"COL_{index + 1}")

    working.columns = renamed_columns
    return working.reset_index(drop=True)


def _extract_sheet_with_detected_header(df_raw: pd.DataFrame) -> pd.DataFrame:
    if df_raw.empty:
        return pd.DataFrame()

    header_row, _ = _detect_header_row(df_raw)
    if header_row >= len(df_raw):
        return _clean_sheet_dataframe(df_raw)

    sheet = df_raw.iloc[header_row + 1 :].copy().reset_index(drop=True)
    header_values = df_raw.iloc[header_row].tolist()
    sheet.columns = header_values
    return _clean_sheet_dataframe(sheet)


def _is_ignored_sheet(sheet_name: str) -> bool:
    normalized = (
        unicodedata.normalize("NFKD", sheet_name.strip().lower())
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return normalized in {
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        for value in SKIP_WORKBOOK_SHEETS
    }


def _pick_primary_sheet(sheets: dict[str, pd.DataFrame]) -> tuple[str | None, pd.DataFrame]:
    for sheet_name, dataframe in sheets.items():
        if _is_ignored_sheet(sheet_name):
            continue
        if not dataframe.empty:
            return sheet_name, dataframe
    for sheet_name, dataframe in sheets.items():
        if not dataframe.empty:
            return sheet_name, dataframe
    return None, pd.DataFrame()


def _load_excel_sheets(file_bytes: bytes) -> dict[str, pd.DataFrame]:
    workbook = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
    sheets: dict[str, pd.DataFrame] = {}
    for sheet_name, raw_df in workbook.items():
        if _is_ignored_sheet(sheet_name) or _sheet_has_only_empty_intro_rows(raw_df):
            continue
        parsed_df = _extract_sheet_with_detected_header(raw_df)
        if not parsed_df.empty:
            sheets[sheet_name] = parsed_df
    return sheets


def _load_delimited_text(file_bytes: bytes) -> pd.DataFrame:
    return pd.read_csv(BytesIO(file_bytes), sep=None, engine="python")


def _load_json_flexible(file_bytes: bytes) -> pd.DataFrame:
    raw = json.load(BytesIO(file_bytes))
    if isinstance(raw, list):
        return pd.json_normalize(raw)
    if isinstance(raw, dict):
        if all(not isinstance(value, list) for value in raw.values()):
            return pd.DataFrame([raw])
        for value in raw.values():
            if isinstance(value, list):
                return pd.json_normalize(value)
    raise ValueError("Estrutura JSON nao suportada")


def load_file_bundle(file_bytes: bytes, filename: str) -> tuple[pd.DataFrame, dict[str, pd.DataFrame], list[str], str]:
    detected_format = detect_format(filename, file_bytes)
    filename_stem = Path(filename).stem or "Sheet1"

    if detected_format in {"xlsx", "xls"}:
        sheets = _load_excel_sheets(file_bytes)
    elif detected_format == "json":
        dataframe = _clean_sheet_dataframe(_load_json_flexible(file_bytes))
        sheets = {filename_stem: dataframe}
    else:
        dataframe = _clean_sheet_dataframe(_load_delimited_text(file_bytes))
        sheets = {filename_stem: dataframe}

    primary_sheet_name, primary_sheet = _pick_primary_sheet(sheets)
    if primary_sheet_name is None or primary_sheet.empty:
        raise ValueError("Nenhuma planilha com dados foi encontrada no arquivo enviado")

    prepared_df = _prepare_dataframe(primary_sheet)
    detected_sheets = list(sheets.keys())
    return prepared_df, sheets, detected_sheets, detected_format

