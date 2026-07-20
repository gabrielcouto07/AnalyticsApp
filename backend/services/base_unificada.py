"""Validação e normalização da aba 'Base Unificada' como fonte canônica.

A Base Unificada consolida Saída/Entrada num formato já próximo da tabela fato
(19 colunas). Quando válida, é a fonte analítica preferida — NÃO concatenamos
com as abas brutas (evita duplicar registros). Quando inválida/incompleta,
o pipeline cai para a reconstrução a partir de Dados Saída/Entrada/Venda.

Não confiamos na aba só porque o nome bate: validamos schema, densidade,
classificação de movimento, identificadores, valores e período.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from config.workbook import get_config, normalize_name
from backend.services import fact
from backend.services.regions import extract_region


def _key(name: str) -> str:
    """Chave de match tolerante: sem acento, minúsculo, sem espaços."""
    return normalize_name(name).replace(" ", "")


# Chaves normalizadas das colunas canônicas → nome canônico oficial
_CANON_BY_KEY = {_key(c): c for c in fact.CANONICAL_COLUMNS}


@dataclass
class BaseValidation:
    valid: bool
    reasons: list[str] = field(default_factory=list)   # pt-BR (motivos de rejeição)
    warnings: list[str] = field(default_factory=list)  # pt-BR (avisos, mesmo se válida)
    stats: dict = field(default_factory=dict)
    fact: Optional[pd.DataFrame] = None
    header_row: Optional[int] = None


def _rename_to_canonical(df: pd.DataFrame) -> pd.DataFrame:
    mapping = {}
    for col in df.columns:
        canon = _CANON_BY_KEY.get(_key(str(col)))
        if canon:
            mapping[col] = canon
    return df.rename(columns=mapping)


def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica as regras de tipagem canônicas sobre uma Base Unificada renomeada."""
    out = pd.DataFrame(index=df.index)
    cfg = get_config()

    def col(name):
        return df[name] if name in df.columns else pd.Series([pd.NA] * len(df), index=df.index)

    out["Mês/Ano"] = col("Mês/Ano").map(fact._normalize_mes_ano_value)
    out["Tipo Movimento"] = col("Tipo Movimento").astype("string").str.strip()
    out["Data do Documento"] = pd.to_datetime(col("Data do Documento"), errors="coerce", dayfirst=True)
    out["Série"] = col("Série").map(lambda v: fact._to_id_str(v))
    out["Serial"] = col("Serial").map(lambda v: fact._to_id_str(v))
    out["Cliente/Fornecedor"] = col("Cliente/Fornecedor").astype("string").str.strip()
    out["CNPJ"] = col("CNPJ").map(lambda v: fact._to_id_str(v, 14))
    out["UF"] = col("UF").astype("string").str.strip()
    out["Município"] = col("Município").astype("string").str.strip()
    out["Grupo Item"] = col("Grupo Item").astype("string").str.strip()
    out["Descrição do Item"] = col("Descrição do Item").astype("string").str.strip()
    out["Utilização"] = col("Utilização").astype("string").str.strip()
    out["Quantidade"] = pd.to_numeric(col("Quantidade"), errors="coerce")
    out["Valor (R$)"] = _to_numeric(col("Valor (R$)"))
    out["Vendedor"] = col("Vendedor").astype("string").str.strip()

    # Ano/Mês: derivados do texto MM/AAAA; se faltar, usa as colunas de origem
    extracted = out["Mês/Ano"].astype("string").str.extract(r"^(\d{2})/(\d{4})$")
    ano = pd.to_numeric(extracted[1], errors="coerce")
    mes = pd.to_numeric(extracted[0], errors="coerce")
    ano = ano.fillna(pd.to_numeric(col("Ano"), errors="coerce"))
    mes = mes.fillna(pd.to_numeric(col("Mês"), errors="coerce"))
    out["Ano"] = ano.astype("Int64")
    out["Mês"] = mes.astype("Int64")

    out["Linha de Negócio"] = col("Linha de Negócio").astype("string").str.strip()

    # Flag intercompany recalculada (não confiamos na coluna de origem)
    cnpj_digits = out["CNPJ"].astype("string").str.replace(r"\D", "", regex=True)
    out["CNPJ Excluído"] = np.where(cnpj_digits.isin(cfg.intercompany_cnpjs), "Sim", "Não")

    return out[fact.CANONICAL_COLUMNS]


def _to_numeric(s: pd.Series) -> pd.Series:
    """Converte a coluna de valor para float.

    A Base Unificada guarda números já legíveis (ponto decimal) como texto —
    tentamos o parse direto ANTES de qualquer limpeza pt-BR, senão o '.' decimal
    seria removido e os valores inflariam (ex.: '1099.5' → 10995).
    """
    if pd.api.types.is_numeric_dtype(s):
        return pd.to_numeric(s, errors="coerce")
    direct = pd.to_numeric(s, errors="coerce")
    non_null = s.notna().sum()
    if non_null and float(direct.notna().sum()) / non_null >= 0.9:
        return direct
    return fact._to_numeric_ptbr(s)


def validate_and_normalize(raw_sheet: pd.DataFrame) -> BaseValidation:
    """Valida uma aba candidata a Base Unificada e, se válida, normaliza p/ fato.

    `raw_sheet`: a aba lida com header=None (para localizar o cabeçalho real).
    """
    cfg = get_config()
    reasons: list[str] = []
    warnings: list[str] = []

    region = extract_region(raw_sheet, expected=cfg.canonical_key_columns,
                            max_scan=cfg.max_header_scan_rows)
    df = region.df
    stats = {"header_row": region.header_row, "rows": int(len(df)),
             "columns": int(df.shape[1])}

    # 1) cabeçalho legível/único o suficiente
    norm_cols = [_key(c) for c in region.columns if c]
    if len(set(norm_cols)) < max(2, len(norm_cols) - 1):
        reasons.append("Cabeçalho da Base Unificada tem colunas duplicadas ou ilegíveis.")

    # 2) colunas-chave canônicas presentes (compara chaves normalizadas dos dois lados)
    present_keys = {_key(c) for c in region.columns}
    missing = [k for k in cfg.canonical_key_columns if _key(k) not in present_keys]
    if missing:
        reasons.append(
            "Base Unificada sem colunas-chave esperadas: "
            + ", ".join(missing) + "."
        )

    # 3) linhas de dados suficientes (senão é provável staging/stub/dashboard)
    if len(df) < cfg.min_data_rows:
        reasons.append(
            f"Base Unificada tem apenas {len(df)} linhas de dados "
            f"(mínimo {cfg.min_data_rows}) — parece um resumo, não a base."
        )

    # Sem as chaves não dá para prosseguir com a validação semântica
    if reasons:
        return BaseValidation(valid=False, reasons=reasons, stats=stats,
                              header_row=region.header_row)

    renamed = _rename_to_canonical(df)

    # 4) classificação de movimento presente e com categorias esperadas
    mv = renamed["Tipo Movimento"].astype("string").str.strip()
    mv_norm = mv.map(lambda x: normalize_name(x) if pd.notna(x) else x)
    movements = set(mv_norm.dropna().unique())
    required = {normalize_name(m) for m in cfg.required_movements}
    if not (required & movements):
        reasons.append("Base Unificada sem categorias de movimento reconhecíveis (Saída/Entrada).")

    # 5) valores monetários parseáveis na maioria das linhas
    valor = _to_numeric(renamed["Valor (R$)"])
    valor_ok = float(valor.notna().mean()) if len(valor) else 0.0
    if valor_ok < 0.7:
        reasons.append(f"Valores monetários ilegíveis em {round((1-valor_ok)*100)}% das linhas.")

    # 6) período normalizável (Mês/Ano texto ou datas)
    mesano = renamed["Mês/Ano"].map(fact._normalize_mes_ano_value)
    periodo_ok = float(mesano.notna().mean()) if len(mesano) else 0.0
    if periodo_ok < 0.5:
        data_col = pd.to_datetime(renamed["Data do Documento"], errors="coerce", dayfirst=True)
        if float(data_col.notna().mean()) < 0.5:
            reasons.append("Período (Mês/Ano) e datas ilegíveis na Base Unificada.")

    stats.update({
        "movimentos": {str(k): int(v) for k, v in mv_norm.value_counts(dropna=False).items()},
        "valor_parse_ok_pct": round(valor_ok * 100, 1),
        "periodo_parse_ok_pct": round(periodo_ok * 100, 1),
    })

    if reasons:
        return BaseValidation(valid=False, reasons=reasons, stats=stats,
                              header_row=region.header_row)

    # ---- Válida: normaliza para a tabela fato canônica ----
    fact_df = _coerce_types(renamed)

    # Totais por movimento (para consistência/relatório)
    by_mv = (
        fact_df.assign(_v=pd.to_numeric(fact_df["Valor (R$)"], errors="coerce"))
        .groupby(fact_df["Tipo Movimento"].astype("string"))["_v"].sum()
    )
    stats["totais_por_movimento"] = {str(k): round(float(v), 2) for k, v in by_mv.items()}
    stats["linhas_fato"] = int(len(fact_df))

    # Avisos de completude (informativos — não invalidam)
    n_entrada = int((fact_df["Tipo Movimento"].astype("string").str.strip().str.lower() == "entrada").sum())
    n_saida = int((fact_df["Tipo Movimento"].astype("string").str.strip().str.lower() == "saída").sum())
    if n_saida and n_entrada and n_entrada < n_saida * 0.02:
        warnings.append(
            "A aba Dados Entrada parece incompleta na Base Unificada "
            f"({n_entrada} devoluções para {n_saida} saídas)."
        )

    return BaseValidation(valid=True, reasons=[], warnings=warnings, stats=stats,
                          fact=fact_df, header_row=region.header_row)
