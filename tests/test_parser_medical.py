"""Testes do modelo fiscal/vendas (workbook DASHBOARD_MEDICAL).

Usa o fixture sintético tests/fixtures/medical_mini.xlsx (gerado por
generate_medical_mini.py) — totais verificados à mão:
- Saída 01/2026 = 4000.00 · Saída 06/2025 = 1000.00 · Entrada 01/2026 = 250.00
"""
from pathlib import Path

import pandas as pd
import pytest

from backend.services import fact
from backend.services.parser import (
    classify_sheet,
    detect_and_parse,
    get_col_types,
    load_bundle,
    meaningful_columns,
)

FIXTURE = Path(__file__).parent / "fixtures" / "medical_mini.xlsx"


@pytest.fixture(scope="module")
def bundle():
    return load_bundle(FIXTURE.read_bytes(), FIXTURE.name)


@pytest.fixture(scope="module")
def fato(bundle):
    return bundle["df"]


# ------------------------------------------------------------
# Classificação de abas
# ------------------------------------------------------------

def test_model_detected(bundle):
    assert bundle["model"] == "medical_fiscal"


def test_sheet_roles(bundle):
    roles = {s["name"]: s["role"] for s in bundle["sheets"]}
    assert roles["Painel Gráficos"] == "ignore"
    assert roles["Dashboard"] == "ignore"
    assert roles["Base Unificada"] == "ignore"
    assert roles["Leia-me"] == "ignore"
    assert roles["Dados Saída"] == "data"
    assert roles["Dados Entrada"] == "data"
    assert roles["Dados Venda"] == "data"
    assert roles["Dados Linha de Negócio"] == "lookup"


def test_classify_sheet_by_name():
    assert classify_sheet("Dashboard (Excl. Intercompany)") == "ignore"
    assert classify_sheet("painel qualquer") == "ignore"
    assert classify_sheet("Dados Saída") == "data"


def test_sheet_model_detection(bundle):
    models = {s["name"]: s["model"] for s in bundle["sheets"]}
    assert models["Dados Saída"] == "fiscal"
    assert models["Dados Entrada"] == "fiscal"
    assert models["Dados Venda"] == "venda"


def test_user_can_override_sheet():
    override = load_bundle(FIXTURE.read_bytes(), FIXTURE.name, sheet="Dados Venda")
    assert override["model"] == "generic"
    assert "Nome do vendedor" in override["df"].columns


# ------------------------------------------------------------
# Tipagem exata (regras do §1.1)
# ------------------------------------------------------------

def test_mes_ano_is_text_never_date(fato):
    assert not pd.api.types.is_datetime64_any_dtype(fato["Mês/Ano"])
    valid = fato["Mês/Ano"].dropna()
    assert valid.str.match(r"^\d{2}/\d{4}$").all()


def test_mes_ano_excel_corruption_repaired(fato):
    # doc 101 tinha Mês/Ano gravado como data (2026-01-01) → vira texto '01/2026'
    row = fato[fato["Serial"] == "76"].iloc[0]
    assert row["Mês/Ano"] == "01/2026"


def test_cnpj_cpf_are_strings_with_leading_zeros(bundle):
    saida = bundle["datasets"]["Dados Saída"]
    assert saida["CNPJ"].dropna().map(type).eq(str).all()
    # CPF numérico 8076748852 → '08076748852' (11 dígitos)
    assert "08076748852" in saida["CPF"].dropna().tolist()


def test_serie_serial_are_strings(fato):
    assert fato["Série"].dropna().map(type).eq(str).all()
    assert fato["Serial"].dropna().map(type).eq(str).all()
    assert "26" in fato["Série"].dropna().tolist()


def test_dates_are_datetimes(fato):
    assert pd.api.types.is_datetime64_any_dtype(fato["Data do Documento"])


def test_gratuito_is_bool(bundle):
    saida = bundle["datasets"]["Dados Saída"]
    assert pd.api.types.is_bool_dtype(saida["Gratuito"])


def test_quantidade_valor_numeric(fato):
    assert pd.api.types.is_numeric_dtype(fato["Quantidade"])
    assert pd.api.types.is_numeric_dtype(fato["Valor (R$)"])


def test_ano_mes_derived_as_integers(fato):
    jan = fato[(fato["Mês/Ano"] == "01/2026")]
    assert (jan["Ano"] == 2026).all()
    assert (jan["Mês"] == 1).all()


# ------------------------------------------------------------
# Tabela fato: totais verificados à mão (correção não-negociável)
# ------------------------------------------------------------

def test_fact_has_canonical_columns(fato):
    assert list(fato.columns) == fact.CANONICAL_COLUMNS


def test_saida_total_matches_hand_checked_value(fato):
    saida_jan = fato[(fato["Tipo Movimento"] == "Saída") & (fato["Mês/Ano"] == "01/2026")]
    assert saida_jan["Valor (R$)"].sum() == pytest.approx(4000.00, abs=1e-9)

    saida_jun = fato[(fato["Tipo Movimento"] == "Saída") & (fato["Mês/Ano"] == "06/2025")]
    assert saida_jun["Valor (R$)"].sum() == pytest.approx(1000.00, abs=1e-9)


def test_entrada_total_matches_hand_checked_value(fato):
    entrada = fato[fato["Tipo Movimento"] == "Entrada"]
    assert entrada["Valor (R$)"].sum() == pytest.approx(250.00, abs=1e-9)
    assert len(entrada) == 2  # linhas fantasma em branco descartadas


def test_venda_total(fato):
    venda = fato[fato["Tipo Movimento"] == "Venda"]
    assert venda["Valor (R$)"].sum() == pytest.approx(2500.00, abs=1e-9)


# ------------------------------------------------------------
# Enriquecimentos (de-para, vendedor, intercompany)
# ------------------------------------------------------------

def test_linha_negocio_lookup(fato):
    saida = fato[fato["Tipo Movimento"] == "Saída"]
    by_grupo = dict(zip(saida["Grupo Item"], saida["Linha de Negócio"]))
    assert by_grupo["EQUIPAMENTOS MORITA"] == "MORITA"
    assert by_grupo["PECAS CARESTREAM"] == "CARESTREAM"
    # Grupo sem cadastro no de-para expõe a lacuna
    assert by_grupo["GRUPO NOVO XYZ"] == fact.NAO_MAPEADO


def test_venda_rows_without_grupo_item_stay_unmapped_as_na(fato):
    venda = fato[fato["Tipo Movimento"] == "Venda"]
    # chave ausente ≠ chave sem mapeamento: não deve poluir o NÃO MAPEADO
    assert venda["Linha de Negócio"].isna().all()


def test_intercompany_flag(fato):
    flagged = fato[fato["CNPJ Excluído"] == "Sim"]
    assert len(flagged) == 1
    assert flagged.iloc[0]["Cliente/Fornecedor"] == "FILIAL INTERCOMPANY SA"


def test_vendedor_lookup_from_venda(fato):
    # Saída doc 100 deve receber o vendedor do Dados Venda ('VENDEDOR A')
    row = fato[(fato["Tipo Movimento"] == "Saída") & (fato["Serial"] == "75")].iloc[0]
    assert row["Vendedor"] == "VENDEDOR A"


def test_venda_mes_ano_derived_from_saida(fato):
    venda = fato[fato["Tipo Movimento"] == "Venda"]
    derived = venda[venda["Cliente/Fornecedor"] == "CLINICA ALFA LTDA"]
    # doc 100: Mês/Ano vazio na aba → derivado da Saída (01/2026)
    assert "01/2026" in derived["Mês/Ano"].tolist()
    # doc 9999 não existe na Saída → permanece vazio (sem número inventado)
    orphan = venda[venda["Cliente/Fornecedor"] == "CLIENTE SEM NOTA"]
    assert orphan["Mês/Ano"].isna().all()


# ------------------------------------------------------------
# Colunas significativas (planilha larga)
# ------------------------------------------------------------

def test_meaningful_columns_drop_all_zero_tax_columns(bundle):
    saida = bundle["datasets"]["Dados Saída"]
    useful = meaningful_columns(saida)
    assert "Valor contábil" in useful
    assert "Nome PN" in useful
    assert "Valor base ICMS" not in useful   # tudo zero
    assert "Valor frete" not in useful        # tudo zero
    assert len(useful) < len(saida.columns)


# ------------------------------------------------------------
# Pipeline genérico (pandas 3: dtype str) — datas, moeda pt-BR, MM/AAAA
# ------------------------------------------------------------

def test_detect_and_parse_generic_types():
    df = pd.DataFrame({
        "data": ["01/02/2024", "02/02/2024", "03/02/2024"],
        "valor": ["R$ 1.234,56", "R$ 10,00", "R$ 0,44"],
        "periodo": ["01/2024", "02/2024", "03/2024"],
        "categoria": ["A", "B", "A"],
    })
    parsed = detect_and_parse(df)
    types = get_col_types(parsed)
    assert "data" in types["date"]
    assert "valor" in types["numeric"]
    assert parsed["valor"].sum() == pytest.approx(1245.00)
    # 'MM/AAAA' continua texto — nunca vira data
    assert "periodo" in types["categorical"]
    assert parsed["periodo"].tolist() == ["01/2024", "02/2024", "03/2024"]
