"""Testes da fonte canônica Base Unificada + fallback + detecção de região.

Fixtures:
- base_unificada_mini.xlsx: Base Unificada VÁLIDA (cabeçalho na 3ª linha, coluna
  repetida no meio, abas brutas presentes). Totais à mão:
  Saída = 18500.00 (21 linhas), Entrada = 300.00 (3 linhas), 24 linhas no total.
- medical_mini.xlsx: Base Unificada é um STUB → deve cair no fallback bruto.
"""
from pathlib import Path

import pandas as pd
import pytest

from backend.services import fact
from backend.services.base_unificada import validate_and_normalize
from backend.services.parser import load_bundle
from backend.services.regions import extract_region

FIX = Path(__file__).parent / "fixtures"
BASE = FIX / "base_unificada_mini.xlsx"
STUB = FIX / "medical_mini.xlsx"


@pytest.fixture(scope="module")
def base_bundle():
    return load_bundle(BASE.read_bytes(), BASE.name)


@pytest.fixture(scope="module")
def stub_bundle():
    return load_bundle(STUB.read_bytes(), STUB.name)


# ---- Seleção de fonte ----

def test_valid_base_unificada_is_selected(base_bundle):
    assert base_bundle["source"]["fact_source"] == "base_unificada"
    assert base_bundle["source"]["fallback_used"] is False


def test_stub_base_falls_back_to_raw(stub_bundle):
    assert stub_bundle["source"]["fact_source"] == "raw_reconstruction"
    assert stub_bundle["source"]["fallback_used"] is True


def test_no_duplication_when_all_sheets_exist(base_bundle):
    # Fato = só a Base (24 linhas), NÃO Base + Saída/Entrada/Venda brutas
    df = base_bundle["df"]
    assert len(df) == 24
    mv = df["Tipo Movimento"].astype("string").str.strip()
    saida = float(pd.to_numeric(df[mv == "Saída"]["Valor (R$)"]).sum())
    assert saida == pytest.approx(18500.00)          # não dobrado com a aba bruta
    assert (mv == "Venda").sum() == 0                # Base não tem Venda; não inventamos


def test_dashboards_and_instructions_ignored(base_bundle):
    roles = base_bundle["source"]["sheets"]
    assert roles["Dashboard"] == "dashboard"
    assert roles["Painel Gráficos"] == "dashboard"
    assert roles["Leia-me"] == "instructions"
    assert roles["Base Unificada"] == "canonical_base"
    assert roles["Dados Saída"] == "raw_saida"


# ---- Detecção de região de tabela ----

def test_table_region_detects_header_not_at_first_row():
    raw = pd.read_excel(BASE, sheet_name="Base Unificada", header=None, engine="calamine")
    region = extract_region(raw, expected=["mes/ano", "tipo movimento", "valor (r$)", "cnpj"])
    assert region.header_row == 2                    # 2 linhas de resumo antes
    assert "Tipo Movimento" in region.columns


def test_repeated_header_row_is_dropped(base_bundle):
    # 24 linhas de dados — a linha de cabeçalho repetida no meio foi descartada
    assert len(base_bundle["df"]) == 24


# ---- Tipagem/enriquecimento preservados a partir da Base ----

def test_base_canonical_columns_and_types(base_bundle):
    df = base_bundle["df"]
    assert list(df.columns) == fact.CANONICAL_COLUMNS
    assert not pd.api.types.is_datetime64_any_dtype(df["Mês/Ano"])   # texto
    assert df["Mês/Ano"].dropna().str.match(r"^\d{2}/\d{4}$").all()
    assert pd.api.types.is_datetime64_any_dtype(df["Data do Documento"])
    assert pd.api.types.is_numeric_dtype(df["Valor (R$)"])
    assert (df["Ano"].dropna() > 2000).all()


def test_base_intercompany_flag_recomputed(base_bundle):
    df = base_bundle["df"]
    flagged = df[df["CNPJ Excluído"] == "Sim"]
    assert len(flagged) == 1


def test_cliente_fornecedor_alias_renamed(base_bundle):
    # 'Cliente / Fornecedor' (com espaços) → canônico 'Cliente/Fornecedor'
    assert "Cliente/Fornecedor" in base_bundle["df"].columns
    assert base_bundle["df"]["Cliente/Fornecedor"].notna().any()


# ---- Validador (unidade) ----

def test_validator_rejects_stub():
    raw = pd.read_excel(STUB, sheet_name="Base Unificada", header=None, engine="calamine")
    result = validate_and_normalize(raw)
    assert result.valid is False
    assert result.reasons                       # motivo em pt-BR


def test_validator_accepts_valid_base():
    raw = pd.read_excel(BASE, sheet_name="Base Unificada", header=None, engine="calamine")
    result = validate_and_normalize(raw)
    assert result.valid is True
    assert list(result.fact.columns) == fact.CANONICAL_COLUMNS
    assert len(result.fact) == 24


# ---- Avisos de negócio / consistência ----

def test_warnings_present_and_typed(base_bundle):
    warnings = base_bundle["source"]["warnings"]
    assert warnings, "esperava avisos"
    assert all(w["level"] in ("info", "partial", "error") for w in warnings)


def test_consistency_divergence_warning_present(base_bundle):
    # O fixture tem abas brutas com totais divergentes de propósito → o check de
    # consistência deve avisar (nunca aceitar a base silenciosamente).
    msgs = " ".join(w["message"] for w in base_bundle["source"]["warnings"])
    assert "diverge" in msgs.lower()
