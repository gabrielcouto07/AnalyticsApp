"""Parse de arquivos enviados (Excel multi-aba, CSV, TXT, JSON).

Pipeline do modelo fiscal (workbook DASHBOARD_MEDICAL), em estágios nomeados:

  1. Lendo estrutura da planilha        (abre o Excel, lista abas)
  2. Identificando abas relevantes      (classifica por conteúdo + schema)
  3. Validando Base Unificada           (fonte canônica preferida)
  4. Processando dados fiscais          (Base OU reconstrução Saída/Entrada/Venda)
  5. Aplicando regras de negócio        (de-para, vendedor, intercompany, avisos)

Decisão central da fonte analítica:

  Base Unificada válida → usar como fonte principal → NÃO concatenar com brutas.
  Base Unificada ausente/inválida → reconstruir a fato com Saída + Entrada + Venda.

Nunca somamos a Base Unificada com as abas brutas (duplicaria registros).
"""
import io
import json
import re
import unicodedata
import warnings
from typing import Any, Optional

import numpy as np
import pandas as pd

from backend.errors import ProcessingError, Stage
from backend.services import classify as classify_mod
from backend.services import fact
from backend.services import base_unificada as bu
from config.workbook import get_config, normalize_name

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
    """Normaliza um valor de 'Mês/Ano' para o texto 'MM/AAAA'."""
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

        as_str = non_null.astype(str)
        if (as_str.str.match(MES_ANO_RE).mean()) > 0.7:
            df[col] = s.map(normalize_mes_ano)
            continue

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                parsed = pd.to_datetime(s, errors="coerce", dayfirst=True)
            if parsed.notna().sum() / len(df) > 0.7:
                df[col] = parsed
                continue
        except Exception:
            pass

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
    """Colunas úteis para análise: descarta as totalmente vazias ou constantes."""
    keep = []
    for col in df.columns:
        s = df[col]
        if s.notna().sum() == 0:
            continue
        try:
            if s.nunique(dropna=True) <= 1:
                continue
        except TypeError:
            pass
        keep.append(col)
    return keep


# ============================================================
# Leitura de Excel (calamine preferido, openpyxl como fallback)
# ============================================================

def _open_excel(buf: io.BytesIO) -> pd.ExcelFile:
    """Abre o workbook UMA vez (calamine → openpyxl). Reusar o handle evita
    reabrir/reparsear o arquivo de 23MB a cada aba (era o gargalo de perf)."""
    try:
        buf.seek(0)
        return pd.ExcelFile(buf, engine="calamine")
    except Exception:
        buf.seek(0)
        return pd.ExcelFile(buf, engine="openpyxl")


def _read_all_raw(xl: pd.ExcelFile) -> dict[str, pd.DataFrame]:
    """Todas as abas com header=None (para detecção de região de tabela)."""
    return {name: xl.parse(name, header=None) for name in xl.sheet_names}


def _typed_sheet(xl: pd.ExcelFile, sheet: str, header_row: int) -> pd.DataFrame:
    """Aba tipada (header=0 quando o cabeçalho é a 1ª linha — dtypes corretos,
    ex.: Gratuito como bool). Reusa o handle aberto."""
    if header_row == 0:
        return xl.parse(sheet, header=0)
    raw = xl.parse(sheet, header=None)
    return _raw_to_header0(raw, header_row)


def _raw_value_sum(raw: pd.DataFrame, column: str, header_row: int = 0) -> Optional[float]:
    """Soma numérica de uma coluna de uma aba lida com header=None (barato)."""
    header = list(raw.iloc[header_row])
    try:
        idx = next(j for j, v in enumerate(header) if str(v).strip() == column)
    except StopIteration:
        return None
    values = pd.to_numeric(raw.iloc[header_row + 1:, idx], errors="coerce")
    return float(values.sum())


def _raw_to_header0(raw: pd.DataFrame, header_row: int) -> pd.DataFrame:
    """Converte uma aba header=None em header=<linha> (sem re-ler o arquivo)."""
    header = [str(x) if pd.notna(x) else f"col{j}" for j, x in enumerate(raw.iloc[header_row])]
    body = raw.iloc[header_row + 1:].copy()
    body.columns = header
    return body.dropna(how="all")


# ============================================================
# Reconstrução bruta (Saída + Entrada + Venda) — reutiliza fact.py
# ============================================================

def _reconstruct_from_raw(
    profiles: list[classify_mod.SheetProfile],
    typed_by_name: dict[str, pd.DataFrame],
    lookup_df: Optional[pd.DataFrame],
) -> pd.DataFrame:
    """Reconstrói a tabela fato canônica a partir das abas fiscais/venda brutas."""
    sheets: dict[str, tuple[pd.DataFrame, str]] = {}
    for prof in profiles:
        if prof.model in ("fiscal", "venda") and prof.name in typed_by_name:
            sheets[prof.name] = (typed_by_name[prof.name], prof.model)
    if not sheets:
        raise ProcessingError(
            Stage.PARSING_FISCAL,
            "Nenhuma aba de dados fiscais foi encontrada para reconstruir a base analítica.",
            "no fiscal/venda sheets after classification",
            "no_fiscal_sheets",
        )
    return fact.build_fact_table(sheets, lookup=lookup_df)


# ============================================================
# Avisos de negócio
# ============================================================

def _business_warnings(fact_df: pd.DataFrame, fact_source: str) -> list[dict]:
    cfg = get_config()
    out: list[dict] = []
    mv = fact_df["Tipo Movimento"].astype("string").str.strip().str.lower()
    n_saida = int((mv == "saída").sum())
    n_entrada = int((mv == "entrada").sum())
    n_venda = int((mv == "venda").sum())

    if n_saida and (n_entrada == 0 or n_entrada < n_saida * 0.02):
        out.append({"level": "partial",
                    "message": "A aba Dados Entrada parece incompleta — os KPIs de Entrada/Receita "
                               "Líquida podem estar subestimados."})

    if n_venda:
        venda = fact_df[mv == "venda"]
        cov = float(venda["Mês/Ano"].notna().mean()) if len(venda) else 1.0
        if cov < 0.9:
            out.append({"level": "partial",
                        "message": f"Cobertura de Mês/Ano em Venda é parcial ({round(cov*100)}%) — "
                                   "período recuperado por junção de documento."})

    if "Linha de Negócio" in fact_df.columns:
        nao_map = int((fact_df["Linha de Negócio"].astype("string") == cfg.nao_mapeado_label).sum())
        if nao_map:
            out.append({"level": "info",
                        "message": f"{nao_map} linhas sem mapeamento de Linha de Negócio ({cfg.nao_mapeado_label})."})

    saida_df = fact_df[mv == "saída"]
    if len(saida_df):
        vend_missing = float(saida_df["Vendedor"].isna().mean())
        if vend_missing > 0.1:
            out.append({"level": "info",
                        "message": f"{round(vend_missing*100)}% das saídas sem Vendedor associado."})

    inter = int((fact_df.get("CNPJ Excluído", pd.Series(dtype=str)).astype("string") == "Sim").sum())
    if inter:
        out.append({"level": "info",
                    "message": f"{inter} linhas marcadas como intercompany (excluíveis nos cálculos)."})

    return out


def _consistency_check(base_fact: pd.DataFrame, raw_saida: Optional[pd.DataFrame],
                       saida_header_row: int = 0) -> list[dict]:
    """Compara o total de Saída da Base × aba bruta de Saída (usa raw em memória,
    sem reabrir o arquivo)."""
    if raw_saida is None:
        return []
    cfg = get_config()
    raw_total = None
    for col in ("Valor contábil", "Valor mercadorias"):
        raw_total = _raw_value_sum(raw_saida, col, saida_header_row)
        if raw_total is not None:
            break
    if raw_total is None or raw_total == 0:
        return []

    mv = base_fact["Tipo Movimento"].astype("string").str.strip().str.lower()
    base_total = float(pd.to_numeric(base_fact.loc[mv == "saída", "Valor (R$)"], errors="coerce").sum())
    diff = abs(base_total - raw_total) / abs(raw_total)
    if diff > cfg.saida_total_tolerance:
        return [{"level": "partial",
                 "message": (f"Total de Saída da Base Unificada (R$ {base_total:,.2f}) diverge da aba "
                             f"bruta (R$ {raw_total:,.2f}) em {round(diff*100,1)}%.")}]
    return []


# ============================================================
# Carregamento principal
# ============================================================

def load_bundle(file_bytes: bytes, filename: str, sheet: Optional[str] = None) -> dict:
    """Carrega um arquivo e retorna um bundle de análise (ver docstring do módulo)."""
    cfg = get_config()
    name = filename.lower()
    buf = io.BytesIO(file_bytes)

    # ---- Arquivos planos (CSV/TXT/JSON) — caminho genérico ----
    if not name.endswith((".xlsx", ".xls")):
        try:
            df = _load_flat_file(buf, name)
            df = detect_and_parse(df)
        except ValueError:
            raise
        except Exception as e:
            raise ProcessingError(Stage.READING, "Não foi possível ler o arquivo enviado.",
                                  str(e), "flat_read_failed")
        return {
            "df": df, "model": "generic",
            "sheets": [{"name": filename, "role": "unknown", "model": None,
                        "rows": len(df), "columns": df.shape[1], "selected": True, "header_row": 0}],
            "datasets": {filename: df},
            "source": {"workbook_model": None, "fact_source": "flat_file",
                       "fallback_used": False, "sheets": {filename: "unknown"}, "warnings": []},
        }

    # ---- Excel: STAGE 1 — Lendo estrutura (abre o handle UMA vez) ----
    try:
        xl = _open_excel(buf)
        raw_sheets = _read_all_raw(xl)
    except Exception as e:
        raise ProcessingError(Stage.READING,
                              "Não foi possível abrir o arquivo Excel. Ele pode estar corrompido ou protegido.",
                              str(e), "excel_open_failed")
    if not raw_sheets:
        raise ProcessingError(Stage.READING, "O arquivo Excel não contém abas legíveis.",
                              "no sheets", "no_sheets")

    # ---- Override manual do usuário (opção avançada): analisar 1 aba ----
    if sheet is not None:
        if sheet not in raw_sheets:
            raise ProcessingError(Stage.IDENTIFYING, f"Aba '{sheet}' não encontrada no arquivo.",
                                  f"sheet {sheet!r} missing", "sheet_not_found")
        prof = classify_mod.classify_sheet(sheet, raw_sheets[sheet])
        chosen = detect_and_parse(_raw_to_header0(raw_sheets[sheet], prof.header_row))
        sheets_meta = [_profile_meta(classify_mod.classify_sheet(n, raw_sheets[n]), selected=(n == sheet))
                       for n in raw_sheets]
        return {"df": chosen, "model": "generic", "sheets": sheets_meta,
                "datasets": {sheet: chosen}, "lazy_datasets": {},
                "source": {"workbook_model": None, "fact_source": f"sheet_override:{sheet}",
                           "fallback_used": False,
                           "sheets": {m["name"]: m["role"] for m in sheets_meta}, "warnings": []}}

    # ---- STAGE 2 — Identificando abas relevantes ----
    profiles = [classify_mod.classify_sheet(n, raw) for n, raw in raw_sheets.items()]
    by_role: dict[str, list[classify_mod.SheetProfile]] = {}
    for p in profiles:
        by_role.setdefault(p.role, []).append(p)
    prof_by_name = {p.name: p for p in profiles}

    lookup_df: Optional[pd.DataFrame] = None
    lookups = by_role.get("lookup") or []
    # Prefere a de-para reconhecida pelo NOME (ex.: 'Dados Linha de Negócio')
    # a uma tabela genérica de 2 colunas que só coincidiu no formato.
    lookup_prof = next(
        (p for p in lookups if cfg.matches(normalize_name(p.name), cfg.lookup_aliases)),
        lookups[0] if lookups else None,
    )
    if lookup_prof is not None:
        lookup_df = _raw_to_header0(raw_sheets[lookup_prof.name], lookup_prof.header_row)

    warnings_out: list[dict] = []
    fact_df: Optional[pd.DataFrame] = None
    fact_source = "raw_reconstruction"
    fallback_used = True
    base_stats: dict = {}

    # ---- STAGE 3 — Validando Base Unificada (fonte preferida) ----
    base_prof = (by_role.get("canonical_base") or [None])[0]
    base_result = None
    if base_prof is not None and "base_unificada" in cfg.source_priority:
        base_result = bu.validate_and_normalize(raw_sheets[base_prof.name])
        base_stats = base_result.stats
        if base_result.valid:
            fact_df = base_result.fact
            fact_source = "base_unificada"
            fallback_used = False
            warnings_out.extend({"level": "partial", "message": m} for m in base_result.warnings)
            saida_prof = (by_role.get("raw_saida") or [None])[0]
            if saida_prof is not None:
                warnings_out.extend(_consistency_check(
                    fact_df, raw_sheets.get(saida_prof.name), saida_prof.header_row))
        else:
            warnings_out.append({
                "level": "info",
                "message": ("A aba Base Unificada não pôde ser utilizada integralmente. O sistema "
                            "reconstruiu a base analítica a partir das abas Dados Saída, Dados Entrada "
                            "e Dados Venda."),
            })

    # ---- STAGE 4 — Processando dados fiscais (reconstrução, se necessário) ----
    typed_by_name: dict[str, pd.DataFrame] = {}
    if fact_df is None:
        for prof in profiles:
            if prof.model in ("fiscal", "venda"):
                typed_by_name[prof.name] = fact.enforce_medical_types(
                    _typed_sheet(xl, prof.name, prof.header_row))
        try:
            fact_df = _reconstruct_from_raw(profiles, typed_by_name, lookup_df)
        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(Stage.PARSING_FISCAL,
                                  "Falha ao reconstruir a base analítica a partir das abas brutas.",
                                  str(e), "fact_build_failed")
        fact_source = "raw_reconstruction"
        fallback_used = True

    if fact_df is None or fact_df.empty:
        raise ProcessingError(Stage.PARSING_FISCAL,
                              "Não foi possível gerar dados analíticos a partir desta planilha.",
                              "empty fact table", "empty_fact")

    # ---- STAGE 5 — Aplicando regras de negócio (avisos) ----
    warnings_out.extend(_business_warnings(fact_df, fact_source))

    # Datasets navegáveis (Explorer): o fato é EAGER; abas brutas são LAZY quando
    # a Base foi usada (não materializamos as 305 colunas no fluxo do dashboard).
    datasets: dict[str, pd.DataFrame] = {fact.FACT_DATASET_NAME: fact_df}
    lazy_datasets: dict[str, int] = {}
    for prof in profiles:
        if prof.model in ("fiscal", "venda"):
            if prof.name in typed_by_name:              # já materializada (fallback)
                datasets[prof.name] = typed_by_name[prof.name]
            else:                                       # base válida → sob demanda
                lazy_datasets[prof.name] = int(prof.header_row)

    sheets_meta = [_profile_meta(p, selected=(p.model in ("fiscal", "venda") and fallback_used)
                                 or (p.role == "canonical_base" and not fallback_used))
                   for p in profiles]

    source = {
        "workbook_model": cfg.workbook_model,
        "fact_source": fact_source,
        "fallback_used": fallback_used,
        "sheets": {p.name: p.role for p in profiles},
        "warnings": warnings_out,
        "base_validation": {"valid": bool(base_result.valid) if base_result else None,
                            "reasons": base_result.reasons if base_result else [],
                            "stats": base_stats} if base_result else None,
    }

    return {"df": fact_df, "model": "medical_fiscal", "sheets": sheets_meta,
            "datasets": datasets, "lazy_datasets": lazy_datasets, "source": source}


def load_lazy_dataset(file_bytes: bytes, sheet: str, header_row: int = 0) -> pd.DataFrame:
    """Materializa sob demanda uma aba bruta (Explorer) — tipada, reusando 1 handle."""
    buf = io.BytesIO(file_bytes)
    xl = _open_excel(buf)
    return fact.enforce_medical_types(_typed_sheet(xl, sheet, header_row))


def _profile_meta(p: classify_mod.SheetProfile, selected: bool = False) -> dict:
    model_out = p.model if p.model in ("fiscal", "venda") else None
    return {"name": p.name, "role": p.role, "model": model_out,
            "rows": int(p.rows), "columns": int(p.columns),
            "selected": bool(selected), "header_row": int(p.header_row)}


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
