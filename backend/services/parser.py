"""Parse de arquivos enviados (Excel multi-aba, CSV, TXT, JSON).

Responsabilidades:
- Carregar qualquer arquivo suportado em DataFrames tipados corretamente.
- Classificar abas de um Excel: dados primários vs. abas a ignorar
  (dashboards prontos, staging, leia-me) vs. tabelas de-para (lookup).
- Detectar o modelo fiscal/vendas (NF-e brasileiro, 305 colunas) e delegar
  a construção da tabela fato a `backend.services.fact`.
- Expor o subconjunto de "colunas significativas" (não vazias/constantes)
  para que os dashboards padrão não afundem em ~250 colunas de impostos zeradas.
"""
import io
import json
import re
import unicodedata
import warnings
from typing import Any, Optional

import numpy as np
import pandas as pd

from backend.services import fact

# ============================================================
# Compatibilidade de dtypes (pandas 2.x usa object, 3.x usa str)
# ============================================================

def is_text_series(s: pd.Series) -> bool:
    """True para colunas object/str/string/category — pandas 2 e 3."""
    return (
        s.dtype == object
        or isinstance(s.dtype, pd.CategoricalDtype)
        or pd.api.types.is_string_dtype(s)
    )


# Padrão "MM/AAAA" — período em texto. O Excel adora converter isso em data
# silenciosamente e quebrar filtros; nós fazemos questão de manter como texto.
MES_ANO_RE = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{4})\s*$")


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", str(text)) if unicodedata.category(c) != "Mn")


def normalize_mes_ano(value: Any) -> Any:
    """Normaliza um valor de 'Mês/Ano' para o texto 'MM/AAAA'.

    Aceita texto ('3/2026' → '03/2026') e também datas (caso o Excel já
    tenha corrompido a célula para data, ex.: 2026-03-01 → '03/2026').
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return pd.NA
    if isinstance(value, (pd.Timestamp,)) or hasattr(value, "month") and hasattr(value, "year"):
        try:
            return f"{int(value.month):02d}/{int(value.year)}"
        except (TypeError, ValueError):
            return pd.NA
    match = MES_ANO_RE.match(str(value))
    if match:
        mes, ano = int(match.group(1)), int(match.group(2))
        if 1 <= mes <= 12:
            return f"{mes:02d}/{ano}"
    return pd.NA


def detect_and_parse(df: pd.DataFrame) -> pd.DataFrame:
    """Inferência genérica de tipos para arquivos sem modelo conhecido."""
    df = df.copy()
    for col in df.columns:
        s = df[col]
        if not is_text_series(s) or isinstance(s.dtype, pd.CategoricalDtype):
            continue

        non_null = s.dropna()
        if len(non_null) == 0:
            continue

        # Períodos 'MM/AAAA' ficam como texto — nunca viram data (bug clássico do Excel)
        as_str = non_null.astype(str)
        if (as_str.str.match(MES_ANO_RE) .mean()) > 0.7:
            df[col] = s.map(normalize_mes_ano)
            continue

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")  # formatos mistos caem no dateutil
                parsed = pd.to_datetime(s, errors="coerce", dayfirst=True)
            if parsed.notna().sum() / len(df) > 0.7:
                df[col] = parsed
                continue
        except Exception:
            pass

        # Limpeza pt-BR: "R$ 1.234,56" → 1234.56
        cleaned = (
            s.astype(str)
            .str.replace(r"[R$%\s]", "", regex=True)
            .str.replace(".", "", regex=False)
            .str.replace(",", ".", regex=False)
        )
        numeric = pd.to_numeric(cleaned, errors="coerce")
        if numeric.notna().sum() / len(df) > 0.7:
            df[col] = numeric
    return df


def get_col_types(df: pd.DataFrame) -> dict:
    """Classifica colunas em date/numeric/categorical (pandas 2 e 3)."""
    types: dict[str, list] = {"date": [], "numeric": [], "categorical": []}
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            types["date"].append(col)
        elif pd.api.types.is_bool_dtype(s):
            types["categorical"].append(col)
        elif pd.api.types.is_numeric_dtype(s):
            types["numeric"].append(col)
        else:
            types["categorical"].append(col)
    return types


def meaningful_columns(df: pd.DataFrame) -> list[str]:
    """Colunas úteis para análise: descarta as totalmente vazias ou constantes.

    Nas planilhas fiscais de 305 colunas, ~190 são impostos zerados/vazios;
    elas continuam disponíveis na visão de tabela, mas não guiam KPIs/gráficos.
    """
    keep = []
    for col in df.columns:
        s = df[col]
        if s.notna().sum() == 0:
            continue
        try:
            if s.nunique(dropna=True) <= 1:
                continue
        except TypeError:
            # valores não-hashable (listas/dicts de JSON) — mantém por segurança
            pass
        keep.append(col)
    return keep


# ============================================================
# Classificação de abas de um Excel
# ============================================================

# Abas que são dashboards/pivôs prontos ou notas — o app regenera tudo isso
IGNORE_SHEET_RE = re.compile(
    r"^(dashboard|painel|base unificada|leia[\s\-_]?me|read[\s\-_]?me|notas?$)", re.I
)


def classify_sheet(name: str, df: Optional[pd.DataFrame] = None) -> str:
    """Retorna o papel de uma aba: 'ignore' | 'lookup' | 'data'."""
    normalized = _strip_accents(name).strip().lower()
    if IGNORE_SHEET_RE.match(normalized):
        return "ignore"
    if df is not None and df.shape[1] == 2 and 0 < len(df) <= 500:
        # Tabela de-para (ex.: Grupo Item → Linha de Negócio)
        return "lookup"
    return "data"


def _read_excel_sheets(buf: io.BytesIO) -> dict[str, pd.DataFrame]:
    """Lê todas as abas. Prefere calamine (~6x mais rápido em arquivos grandes)."""
    try:
        return pd.read_excel(buf, sheet_name=None, header=0, engine="calamine")
    except Exception:
        buf.seek(0)
        return pd.read_excel(buf, sheet_name=None, header=0, engine="openpyxl")


# ============================================================
# Carregamento principal
# ============================================================

def load_bundle(file_bytes: bytes, filename: str, sheet: Optional[str] = None) -> dict:
    """Carrega um arquivo e retorna um bundle de análise.

    Retorna dict com:
    - df: DataFrame principal (tabela fato se o modelo fiscal for detectado)
    - model: "medical_fiscal" | "generic"
    - sheets: metadados por aba [{name, role, model, rows, columns, selected}]
    - datasets: DataFrames navegáveis por nome (abas de dados + "Fato Consolidado")
    """
    name = filename.lower()
    buf = io.BytesIO(file_bytes)

    if not name.endswith((".xlsx", ".xls")):
        df = _load_flat_file(buf, name)
        df = detect_and_parse(df)
        return {
            "df": df,
            "model": "generic",
            "sheets": [{"name": filename, "role": "data", "model": None,
                        "rows": len(df), "columns": df.shape[1], "selected": True}],
            "datasets": {filename: df},
        }

    raw_sheets = _read_excel_sheets(buf)

    sheets_meta: list[dict] = []
    datasets: dict[str, pd.DataFrame] = {}
    typed: dict[str, pd.DataFrame] = {}
    lookup_df: Optional[pd.DataFrame] = None
    lookup_name: Optional[str] = None
    models: dict[str, Optional[str]] = {}

    for sheet_name, sdf in raw_sheets.items():
        sdf = sdf.dropna(how="all")
        role = classify_sheet(sheet_name, sdf)
        model = None
        if role == "data":
            model = fact.detect_sheet_model(sdf.columns)
            if model is not None:
                sdf = fact.enforce_medical_types(sdf)
            else:
                sdf = detect_and_parse(sdf)
            typed[sheet_name] = sdf
        elif role == "lookup" and lookup_df is None:
            lookup_df = sdf
            lookup_name = sheet_name
        models[sheet_name] = model
        sheets_meta.append({
            "name": sheet_name,
            "role": role,
            "model": model,
            "rows": int(len(sdf)),
            "columns": int(sdf.shape[1]),
            "selected": False,
        })

    if not typed:
        raise ValueError("Nenhuma aba de dados encontrada no arquivo Excel.")

    datasets.update(typed)

    # Override manual do usuário: analisar uma aba específica
    if sheet is not None:
        if sheet not in raw_sheets:
            raise ValueError(f"Aba '{sheet}' não encontrada no arquivo.")
        chosen = typed.get(sheet)
        if chosen is None:
            chosen = detect_and_parse(raw_sheets[sheet].dropna(how="all"))
            datasets[sheet] = chosen
        for meta in sheets_meta:
            meta["selected"] = meta["name"] == sheet
        return {"df": chosen, "model": "generic", "sheets": sheets_meta, "datasets": datasets}

    fiscal_or_venda = {n: df for n, df in typed.items() if models.get(n)}
    if fiscal_or_venda:
        fact_df = fact.build_fact_table(
            {n: (df, models[n]) for n, df in fiscal_or_venda.items()},
            lookup=lookup_df,
        )
        datasets[fact.FACT_DATASET_NAME] = fact_df
        for meta in sheets_meta:
            meta["selected"] = meta["name"] in fiscal_or_venda
        if lookup_name is not None:
            for meta in sheets_meta:
                if meta["name"] == lookup_name:
                    meta["role"] = "lookup"
        return {"df": fact_df, "model": "medical_fiscal", "sheets": sheets_meta, "datasets": datasets}

    # Genérico: analisa a maior aba de dados
    main_name = max(typed, key=lambda n: len(typed[n]))
    for meta in sheets_meta:
        meta["selected"] = meta["name"] == main_name
    return {"df": typed[main_name], "model": "generic", "sheets": sheets_meta, "datasets": datasets}


def _load_flat_file(buf: io.BytesIO, name: str) -> pd.DataFrame:
    if name.endswith(".csv"):
        sample = buf.read(2048).decode("utf-8", errors="ignore")
        buf.seek(0)
        sep = ";" if sample.count(";") > sample.count(",") else ","
        return pd.read_csv(buf, sep=sep, on_bad_lines="skip")
    if name.endswith(".txt"):
        sample = buf.read(2048).decode("utf-8", errors="ignore")
        buf.seek(0)
        sep = "\t" if "\t" in sample else ("|" if "|" in sample else ",")
        return pd.read_csv(buf, sep=sep, on_bad_lines="skip")
    if name.endswith(".json"):
        raw = json.load(buf)
        if isinstance(raw, list):
            return pd.json_normalize(raw)
        if isinstance(raw, dict):
            for v in raw.values():
                if isinstance(v, list):
                    return pd.json_normalize(v)
            return pd.DataFrame([raw])
        raise ValueError("Estrutura JSON não reconhecida")
    raise ValueError(f"Formato não suportado: {name}")


def load_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Compatibilidade: retorna apenas o DataFrame principal."""
    return load_bundle(file_bytes, filename)["df"]
