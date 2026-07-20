"""Classificação de abas do workbook por conteúdo + schema (não só pelo nome).

Papéis possíveis:
  canonical_base · raw_saida · raw_entrada · raw_venda ·
  lookup · dashboard · instructions · helper · unknown

Regras (combinadas — nunca só o título, nunca só a contagem de linhas):
- nome normalizado (aliases configuráveis);
- assinatura de colunas-chave (fiscal / venda via fact.detect_sheet_model; base canônica);
- densidade de dados, colunas vazias, formato de tabela;
- volume de linhas.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from config.workbook import get_config, normalize_name
from backend.services import fact
from backend.services.regions import extract_region


@dataclass
class SheetProfile:
    name: str
    role: str
    model: Optional[str] = None          # "fiscal" | "venda" | None
    rows: int = 0
    columns: int = 0
    header_row: int = 0
    empty_col_pct: float = 0.0
    detail: str = ""
    region_columns: list[str] = field(default_factory=list)


def _key(name: str) -> str:
    return normalize_name(name).replace(" ", "")


def _canonical_hits(region_cols: list[str]) -> int:
    cfg = get_config()
    keys = {_key(c) for c in region_cols}
    return sum(1 for c in cfg.canonical_key_columns if _key(c) in keys)


def _data_density(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0
    return float(df.notna().to_numpy().mean())


def _empty_col_pct(df: pd.DataFrame) -> float:
    if df.shape[1] == 0:
        return 1.0
    empty = sum(1 for c in df.columns if df[c].notna().sum() == 0)
    return empty / df.shape[1]


def classify_sheet(name: str, raw: pd.DataFrame) -> SheetProfile:
    """Classifica uma aba a partir do seu nome e do conteúdo bruto (header=None)."""
    cfg = get_config()
    norm = normalize_name(name)

    region = extract_region(raw, expected=cfg.canonical_key_columns, max_scan=cfg.max_header_scan_rows)
    rdf = region.df
    rows, cols = int(len(rdf)), int(rdf.shape[1])
    density = _data_density(rdf)
    empty_pct = _empty_col_pct(rdf)

    fiscal_venda = fact.detect_sheet_model(region.columns)   # "fiscal" | "venda" | None
    base_hits = _canonical_hits(region.columns)
    n_canonical = len(cfg.canonical_key_columns)

    def profile(role, model=None, detail=""):
        return SheetProfile(name=name, role=role, model=model, rows=rows, columns=cols,
                            header_row=region.header_row, empty_col_pct=round(empty_pct, 3),
                            detail=detail, region_columns=list(region.columns))

    # 1) Instruções (Leia-me) — nome + poucas colunas de texto
    if cfg.matches(norm, cfg.instructions_aliases) and cols <= 3:
        return profile("instructions", detail="Aba de instruções/notas — ignorada.")

    # 2) Schema fiscal forte → aba bruta de Saída/Entrada (independe do nome)
    if fiscal_venda == "fiscal":
        if cfg.matches(norm, cfg.raw_entrada_aliases) or "entrada" in norm or "devolu" in norm:
            return profile("raw_entrada", model="fiscal", detail="Aba fiscal bruta (Entrada).")
        return profile("raw_saida", model="fiscal", detail="Aba fiscal bruta (Saída).")

    # 3) Schema de venda → aba bruta de Venda
    if fiscal_venda == "venda":
        return profile("raw_venda", model="venda", detail="Aba de venda bruta.")

    # 4) Base canônica por schema + volume (não só o nome)
    if base_hits >= max(2, n_canonical - 1) and rows >= cfg.min_data_rows:
        return profile("canonical_base", detail="Candidata a Base Unificada (schema canônico).")

    # 5) Dashboard / painel por nome — ANTES do heurístico genérico de 2 colunas
    if cfg.matches(norm, cfg.dashboard_aliases):
        return profile("dashboard", detail="Dashboard/painel pré-montado — ignorado.")

    # 6) Base Unificada por nome (schema/volume fracos) → candidata; validação decide
    if cfg.matches(norm, cfg.canonical_base_aliases):
        return profile("canonical_base", detail="Base Unificada por nome (validação pendente).")

    # 7) Lookup / de-para (por nome, ou formato de 2 colunas pequeno)
    if cfg.matches(norm, cfg.lookup_aliases) or (cols == 2 and 0 < rows <= 500):
        return profile("lookup", detail="Tabela de-para (enriquecimento).")

    # 8) Bloco-resumo / helper: pouquíssimos dados ou muito esparso
    if rows < cfg.min_data_rows or density < 0.25 or empty_pct > 0.6:
        return profile("helper", detail="Tabela auxiliar/resumo — ignorada por padrão.")

    # 9) Não reconhecida — pode virar dataset genérico no Explorer
    return profile("unknown", detail="Aba não reconhecida.")


# Papéis que NÃO devem ser materializados em DataFrames grandes / analisados
IGNORED_ROLES = {"dashboard", "instructions", "helper"}
RAW_FISCAL_ROLES = {"raw_saida", "raw_entrada"}
