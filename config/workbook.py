"""Configuração de negócio do workbook (fiscal/vendas) — fora do código.

Centraliza tudo que é específico do formato do cliente para que dá para ajustar
sem editar a lógica dos serviços:

- aliases de abas (canônica / brutas / lookup / dashboards / instruções);
- assinaturas de colunas-chave que identificam cada modelo de aba;
- colunas esperadas da Base Unificada canônica;
- CNPJs intercompany;
- prioridade de fonte analítica (Base Unificada → reconstrução bruta).

Override sem tocar no código: aponte a env var `ANALYTICS_WORKBOOK_CONFIG` para
um arquivo JSON com quaisquer dos campos abaixo (merge raso sobre os padrões).
"""
from __future__ import annotations

import json
import os
import unicodedata
from dataclasses import dataclass, field, replace
from functools import lru_cache


def normalize_name(text: str) -> str:
    """Nome de aba/coluna normalizado: sem acento, minúsculo, espaços colapsados.

    Hífens e underscores viram espaço ('Leia-me' → 'leia me') para que os
    aliases casem independentemente do separador.
    """
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", str(text)) if unicodedata.category(c) != "Mn"
    )
    stripped = stripped.replace("-", " ").replace("_", " ")
    return " ".join(stripped.lower().split())


@dataclass(frozen=True)
class WorkbookConfig:
    # ---- Aliases de abas (comparados sobre o nome NORMALIZADO) ----
    canonical_base_aliases: tuple[str, ...] = ("base unificada", "base consolidada", "fato")
    raw_saida_aliases: tuple[str, ...] = ("dados saida", "saida", "nf saida", "notas saida")
    raw_entrada_aliases: tuple[str, ...] = ("dados entrada", "entrada", "nf entrada", "devolucoes")
    raw_venda_aliases: tuple[str, ...] = ("dados venda", "venda", "vendas", "faturamento")
    lookup_aliases: tuple[str, ...] = (
        "dados linha de negocio", "linha de negocio", "de para", "depara", "de-para",
    )
    dashboard_aliases: tuple[str, ...] = ("dashboard", "painel", "painel graficos", "graficos")
    instructions_aliases: tuple[str, ...] = ("leia me", "leiame", "read me", "readme", "notas", "instrucoes")

    # ---- Assinaturas de colunas-chave por modelo de aba (colunas normalizadas) ----
    fiscal_key_signature: tuple[str, ...] = ("mes/ano", "no documento", "valor contabil", "nome pn")
    venda_key_signature: tuple[str, ...] = ("mes/ano", "no do documento", "total do documento", "nome do vendedor")

    # ---- Base Unificada canônica ----
    # Colunas-chave mínimas (normalizadas) que uma Base Unificada válida precisa ter.
    canonical_key_columns: tuple[str, ...] = (
        "mes/ano", "tipo movimento", "valor (r$)", "cnpj",
    )
    # Categorias de movimento que uma base válida precisa conter (pelo menos uma).
    required_movements: tuple[str, ...] = ("saída", "entrada")
    min_data_rows: int = 20                 # menos que isso → provável staging/stub
    max_header_scan_rows: int = 25          # quantas linhas iniciais varrer p/ achar cabeçalho

    # ---- Regras de negócio ----
    intercompany_cnpjs: frozenset[str] = frozenset({
        "33921755000188", "29268037000187", "17403114000185", "27205945000104",
    })
    nao_mapeado_label: str = "NÃO MAPEADO"

    # ---- Prioridade da fonte analítica ----
    source_priority: tuple[str, ...] = ("base_unificada", "raw_reconstruction")
    # Tolerância relativa ao comparar total de Saída (Base × bruto) antes de avisar.
    saida_total_tolerance: float = 0.02     # 2%

    workbook_model: str = "scientific_dental_medical"

    def matches(self, normalized: str, aliases: tuple[str, ...]) -> bool:
        """True se o nome normalizado casar (prefixo/contém) com algum alias."""
        return any(normalized == a or normalized.startswith(a) or a in normalized for a in aliases)


_OVERRIDABLE = {
    "canonical_base_aliases", "raw_saida_aliases", "raw_entrada_aliases", "raw_venda_aliases",
    "lookup_aliases", "dashboard_aliases", "instructions_aliases",
    "fiscal_key_signature", "venda_key_signature", "canonical_key_columns",
    "required_movements", "min_data_rows", "max_header_scan_rows",
    "nao_mapeado_label", "source_priority", "saida_total_tolerance", "workbook_model",
}


@lru_cache(maxsize=1)
def get_config() -> WorkbookConfig:
    """Config padrão, com merge raso de overrides de `ANALYTICS_WORKBOOK_CONFIG`."""
    cfg = WorkbookConfig()
    path = os.environ.get("ANALYTICS_WORKBOOK_CONFIG")
    if not path or not os.path.exists(path):
        return cfg
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return cfg
    patch: dict = {}
    for key, value in raw.items():
        if key not in _OVERRIDABLE:
            continue
        if isinstance(value, list):
            value = tuple(value)
        patch[key] = value
    if "intercompany_cnpjs" in raw and isinstance(raw["intercompany_cnpjs"], list):
        patch["intercompany_cnpjs"] = frozenset(str(x) for x in raw["intercompany_cnpjs"])
    return replace(cfg, **patch) if patch else cfg
