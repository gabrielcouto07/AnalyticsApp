"""Tabela fato canônica para o modelo fiscal/vendas (NF-e brasileiro).

Colapsa as planilhas largas ('Dados Saída'/'Dados Entrada', 305 colunas,
esquema idêntico) e 'Dados Venda' (82 colunas) em uma tabela unificada e
tipada, no formato da aba 'Base Unificada' do workbook de referência:

Mês/Ano · Tipo Movimento · Data do Documento · Série · Serial ·
Cliente/Fornecedor · CNPJ · UF · Município · Grupo Item · Descrição do Item ·
Utilização · Quantidade · Valor (R$) · Vendedor · Ano · Mês ·
Linha de Negócio · CNPJ Excluído

Regras de tipagem críticas deste dataset:
- 'Mês/Ano' é TEXTO 'MM/AAAA', nunca data (o Excel converte sozinho e quebra
  filtros de período — bug documentado no próprio Leia-me do workbook).
- CNPJ/CPF/IE/Série/Serial são STRINGS (zeros à esquerda importam).
- Valores monetários → float; Datas → datetime; 'Gratuito' → bool.
"""
import re
import unicodedata
from typing import Optional

import numpy as np
import pandas as pd

FACT_DATASET_NAME = "Fato Consolidado"

NAO_MAPEADO = "NÃO MAPEADO"

# CNPJs intercompany (documentados no 'Leia-me' / aba 'Dashboard (Excl.
# Intercompany)' do workbook). Marcados na coluna 'CNPJ Excluído' para que o
# usuário possa excluí-los dos cálculos, como no dashboard original.
INTERCOMPANY_CNPJS = {
    "33921755000188",
    "29268037000187",
    "17403114000185",
    "27205945000104",
}

CANONICAL_COLUMNS = [
    "Mês/Ano", "Tipo Movimento", "Data do Documento", "Série", "Serial",
    "Cliente/Fornecedor", "CNPJ", "UF", "Município", "Grupo Item",
    "Descrição do Item", "Utilização", "Quantidade", "Valor (R$)", "Vendedor",
    "Ano", "Mês", "Linha de Negócio", "CNPJ Excluído",
]

# Colunas-chave para reconhecer cada modelo de aba
_FISCAL_REQUIRED = {"Mês/Ano", "Nº Documento", "Valor contábil", "Nome PN"}
_VENDA_REQUIRED = {"Mês/Ano", "Nº do documento", "Total do Documento", "Nome do vendedor"}

_MES_ANO_RE = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{4})\s*$")

# Identificadores fiscais que devem SEMPRE ser texto. O Excel/pandas os lê
# como número e destrói zeros à esquerda (CPF '08076748852' vira 8076748852.0).
_ID_NAME_RE = re.compile(
    r"cnpj|cpf|inscr|\bie\b|\bim\b|chave|ncm|cfop|cest|ibge|serie|serial"
    r"|modelo|situacao|\bcst\b|codigo|\bcod\b|conta contabil|nome fiscal",
    re.I,
)
# Larguras oficiais para re-preencher zeros à esquerda perdidos pelo Excel
_DOC_WIDTHS = {"cnpj": 14, "cpf": 11}


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", str(text)) if unicodedata.category(c) != "Mn")


def detect_sheet_model(columns) -> Optional[str]:
    """Detecta se uma aba segue o esquema fiscal (Saída/Entrada) ou Venda."""
    cols = set(map(str, columns))
    if _FISCAL_REQUIRED.issubset(cols):
        return "fiscal"
    if _VENDA_REQUIRED.issubset(cols):
        return "venda"
    return None


def _normalize_mes_ano_value(value):
    try:
        if pd.isna(value):
            return pd.NA
    except (TypeError, ValueError):
        pass
    if hasattr(value, "month") and hasattr(value, "year"):
        # Célula já corrompida para data pelo Excel — recupera o período
        return f"{int(value.month):02d}/{int(value.year)}"
    match = _MES_ANO_RE.match(str(value))
    if match:
        mes, ano = int(match.group(1)), int(match.group(2))
        if 1 <= mes <= 12:
            return f"{mes:02d}/{ano}"
    return pd.NA


def _to_id_str(value, width: int = 0):
    """Número/texto → identificador string, sem '.0' e com zfill opcional."""
    try:
        if pd.isna(value):
            return pd.NA
    except (TypeError, ValueError):
        pass
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    if not text:
        return pd.NA
    if width and text.isdigit():
        text = text.zfill(width)
    return text


def _to_numeric_ptbr(s: pd.Series) -> pd.Series:
    """'R$ 1.234,56' → 1234.56 (usado quando a coluna veio como texto)."""
    cleaned = (
        s.astype(str)
        .str.replace(r"[R$\s]", "", regex=True)
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def _is_text(s: pd.Series) -> bool:
    return s.dtype == object or pd.api.types.is_string_dtype(s)


def enforce_medical_types(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica as regras de tipagem do §modelo fiscal em uma aba já lida."""
    df = df.dropna(how="all").copy()
    for col in df.columns:
        s = df[col]
        norm = _strip_accents(str(col)).lower()

        if norm in ("mes/ano", "mes /ano", "mes/ ano"):
            df[col] = s.map(_normalize_mes_ano_value)
            continue

        if norm.startswith("data") and not pd.api.types.is_datetime64_any_dtype(s):
            if _is_text(s):
                df[col] = pd.to_datetime(s, errors="coerce", dayfirst=True)
            continue

        if pd.api.types.is_bool_dtype(s):
            continue

        if _ID_NAME_RE.search(norm):
            width = next((w for key, w in _DOC_WIDTHS.items() if key in norm), 0)
            df[col] = s.map(lambda v, w=width: _to_id_str(v, w))
            continue

        # Colunas de valor/percentual que vieram como texto (ex.: CSV pt-BR)
        if _is_text(s) and re.search(r"valor|total|base|quantidade|qtde|aliq|%|peso", norm):
            converted = _to_numeric_ptbr(s)
            if converted.notna().sum() >= s.notna().sum() * 0.7:
                df[col] = converted
    return df


# ============================================================
# Normalização por tipo de aba
# ============================================================

def _first_existing(df: pd.DataFrame, *names: str) -> Optional[str]:
    for name in names:
        if name in df.columns:
            return name
    return None


def _fiscal_to_fact(df: pd.DataFrame, tipo: str) -> pd.DataFrame:
    """Aba fiscal (Saída/Entrada) → linhas da tabela fato."""
    valor_col = _first_existing(df, "Valor contábil", "Valor mercadorias")
    out = pd.DataFrame({
        "Mês/Ano": df["Mês/Ano"],
        "Tipo Movimento": tipo,
        "Data do Documento": df.get("Data do doc."),
        "Série": df.get("Série"),
        "Serial": df.get("Serial"),
        "Cliente/Fornecedor": df.get("Nome PN"),
        "CNPJ": df.get("CNPJ"),
        "UF": df.get("UF"),
        "Município": df.get("Municipio", df.get("Município")),
        "Grupo Item": df.get("Grupo Item"),
        "Descrição do Item": df.get("Descrição do item"),
        "Utilização": df.get("Utilização"),
        "Quantidade": pd.to_numeric(df.get("Quantidade"), errors="coerce"),
        "Valor (R$)": pd.to_numeric(df[valor_col], errors="coerce") if valor_col else np.nan,
        "Vendedor": pd.NA,  # preenchido via lookup no Dados Venda (Nº Documento)
        "_doc": pd.to_numeric(df.get("Nº Documento"), errors="coerce"),
    })
    return out


def _venda_to_fact(df: pd.DataFrame) -> pd.DataFrame:
    """Aba Venda (nível documento) → linhas da tabela fato.

    Venda não tem data própria nem CNPJ/Grupo Item; Data e Mês/Ano são
    resolvidos depois via join com a Saída pelo nº do documento (mesma
    estratégia da Base Unificada do workbook).
    """
    out = pd.DataFrame({
        "Mês/Ano": df["Mês/Ano"],
        "Tipo Movimento": "Venda",
        "Data do Documento": pd.NaT,
        "Série": pd.NA,
        "Serial": pd.NA,
        "Cliente/Fornecedor": df.get("Nome do PN"),
        "CNPJ": pd.NA,
        "UF": df.get("Estado"),
        "Município": pd.NA,
        "Grupo Item": pd.NA,
        "Descrição do Item": pd.NA,
        "Utilização": df.get("Utilização"),
        "Quantidade": np.nan,
        "Valor (R$)": pd.to_numeric(df.get("Total do Documento"), errors="coerce"),
        "Vendedor": df.get("Nome do vendedor"),
        "_doc": pd.to_numeric(df.get("Nº do documento"), errors="coerce"),
    })
    return out


def apply_lookup(
    df: pd.DataFrame,
    lookup: pd.DataFrame,
    key_col: str,
    new_col: Optional[str] = None,
    unmapped: str = NAO_MAPEADO,
) -> pd.DataFrame:
    """Enriquecimento genérico via tabela de-para de 2 colunas.

    Chave presente mas sem mapeamento → `unmapped` (expõe lacunas do de-para,
    convenção do próprio workbook). Chave ausente (NaN) → continua ausente.
    """
    lookup = lookup.dropna(how="all")
    lookup_key, lookup_value = lookup.columns[0], lookup.columns[1]
    new_col = new_col or str(lookup_value)

    mapping = dict(zip(lookup[lookup_key].astype(str).str.strip(),
                       lookup[lookup_value]))

    df = df.copy()
    keys = df[key_col]
    mapped = keys.astype(str).str.strip().map(mapping)
    # Garante dtype object: se o de-para não casar nada, `mapped` viria float64
    # (tudo NaN) e a atribuição da string 'NÃO MAPEADO' quebraria no pandas 3.
    mapped = mapped.astype(object)
    mapped = mapped.where(keys.notna(), pd.NA)          # chave ausente → NA
    mapped = mapped.fillna(pd.NA)
    mapped[keys.notna() & mapped.isna()] = unmapped      # chave sem de-para
    df[new_col] = mapped
    return df


def build_fact_table(
    sheets: dict[str, tuple[pd.DataFrame, str]],
    lookup: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """Une abas fiscais + venda na tabela fato canônica.

    `sheets`: {nome_da_aba: (df tipado, "fiscal"|"venda")}
    `lookup`: de-para opcional (2 colunas, ex.: Grupo Item → Linha de Negócio)
    """
    parts: list[pd.DataFrame] = []
    fiscal_frames: list[pd.DataFrame] = []
    venda_frames: list[pd.DataFrame] = []

    for name, (df, model) in sheets.items():
        norm = _strip_accents(name).lower()
        if model == "fiscal":
            # Distingue Saída de Entrada pelo nome da aba ou pela coluna Processo
            if "entrada" in norm:
                tipo = "Entrada"
            elif "saida" in norm:
                tipo = "Saída"
            else:
                processo = str(df.get("Processo", pd.Series(dtype=str)).dropna().head(1).tolist())
                tipo = "Entrada" if "entrada" in _strip_accents(processo).lower() or "devolu" in _strip_accents(processo).lower() else "Saída"
            frame = _fiscal_to_fact(df, tipo)
            fiscal_frames.append(frame)
            parts.append(frame)
        elif model == "venda":
            frame = _venda_to_fact(df)
            venda_frames.append(frame)
            parts.append(frame)

    if not parts:
        raise ValueError("Nenhuma aba compatível com o modelo fiscal/venda.")

    # ---- Lookups cruzados por nº do documento (estratégia da Base Unificada)
    if fiscal_frames and venda_frames:
        venda_all = pd.concat(venda_frames, ignore_index=True)
        venda_docs = venda_all.dropna(subset=["_doc"]).drop_duplicates("_doc")
        vendedor_by_doc = dict(zip(venda_docs["_doc"], venda_docs["Vendedor"]))

        saida_frames = [f for f in fiscal_frames if (f["Tipo Movimento"] == "Saída").any()]
        if saida_frames:
            saida_all = pd.concat(saida_frames, ignore_index=True)
            saida_docs = saida_all.dropna(subset=["_doc"]).drop_duplicates("_doc")
            data_by_doc = dict(zip(saida_docs["_doc"], saida_docs["Data do Documento"]))
            mesano_by_doc = dict(zip(saida_docs["_doc"], saida_docs["Mês/Ano"]))
        else:
            data_by_doc, mesano_by_doc = {}, {}

        for frame in fiscal_frames:
            frame["Vendedor"] = frame["_doc"].map(vendedor_by_doc)
        for frame in venda_frames:
            frame["Data do Documento"] = frame["_doc"].map(data_by_doc)
            # Mês/Ano da própria aba tem prioridade; senão, vem da Saída
            derived = frame["_doc"].map(mesano_by_doc)
            frame["Mês/Ano"] = frame["Mês/Ano"].fillna(derived)

    fact = pd.concat(parts, ignore_index=True).drop(columns=["_doc"])

    # ---- Ano / Mês derivados do texto 'MM/AAAA' (nunca do Excel-data)
    extracted = fact["Mês/Ano"].astype("string").str.extract(r"^(\d{2})/(\d{4})$")
    fact["Ano"] = pd.to_numeric(extracted[1], errors="coerce").astype("Int64")
    fact["Mês"] = pd.to_numeric(extracted[0], errors="coerce").astype("Int64")

    # Fallback: períodos ausentes derivados da data do documento
    missing = fact["Ano"].isna() & fact["Data do Documento"].notna()
    if missing.any():
        dates = pd.to_datetime(fact.loc[missing, "Data do Documento"], errors="coerce")
        fact.loc[missing, "Ano"] = dates.dt.year.astype("Int64")
        fact.loc[missing, "Mês"] = dates.dt.month.astype("Int64")
        fact.loc[missing, "Mês/Ano"] = dates.dt.strftime("%m/%Y")

    # ---- Linha de Negócio via de-para (lacunas viram NÃO MAPEADO)
    if lookup is not None and lookup.shape[1] == 2:
        fact = apply_lookup(fact, lookup, key_col="Grupo Item", new_col="Linha de Negócio")
    else:
        fact["Linha de Negócio"] = pd.NA

    # ---- Flag intercompany ('Sim'/'Não', como na Base Unificada)
    cnpj_digits = fact["CNPJ"].astype("string").str.replace(r"\D", "", regex=True)
    fact["CNPJ Excluído"] = np.where(cnpj_digits.isin(INTERCOMPANY_CNPJS), "Sim", "Não")

    return fact[CANONICAL_COLUMNS]
