"""Testes de API sobre o workbook fiscal (upload → dashboard → table → export).

Totais verificados à mão no fixture (ver generate_medical_mini.py):
- Saída 01/2026 = 4000.00 · Saída 2026 = 4000.00 · Saída 2025 = 1000.00
- Entrada 01/2026 = 250.00 · Líquido 01/2026 = 3750.00
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app

FIXTURE = Path(__file__).parent / "fixtures" / "medical_mini.xlsx"

client = TestClient(app)


@pytest.fixture(scope="module")
def upload():
    with FIXTURE.open("rb") as f:
        resp = client.post("/api/upload", files={"file": (FIXTURE.name, f)})
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture(scope="module")
def session_id(upload):
    return upload["session_id"]


def test_upload_detects_model_and_sheets(upload):
    assert upload["model"] == "medical_fiscal"
    roles = {s["name"]: s["role"] for s in upload["sheets"]}
    assert roles["Dashboard"] == "dashboard"
    assert roles["Dados Saída"] == "raw_saida"
    assert "Fato Consolidado" in upload["datasets"]
    # metadados de fonte analítica expostos (aditivo)
    assert upload["source"]["fact_source"] in ("base_unificada", "raw_reconstruction")
    # preview JSON-safe (sem NaN cru)
    assert isinstance(upload["preview"], list)


def test_dashboard_totals_match_hand_checked_values(session_id):
    resp = client.get(f"/api/data/{session_id}/dashboard", params={"ano": 2026, "mes": 1})
    assert resp.status_code == 200
    kpis = resp.json()["kpis"]
    assert kpis["saida"] == pytest.approx(4000.00)
    assert kpis["entrada"] == pytest.approx(250.00)
    assert kpis["liquido"] == pytest.approx(3750.00)


def test_dashboard_annual_comparative(session_id):
    # Ano inteiro: 2026 = 4000.00 vs 2025 = 1000.00 → +300%
    resp = client.get(f"/api/data/{session_id}/dashboard", params={"ano": 2026})
    kpis = resp.json()["kpis"]
    assert kpis["saida"] == pytest.approx(4000.00)
    assert kpis["saida_ano_anterior"] == pytest.approx(1000.00)
    assert kpis["variacao_ano_anterior"] == pytest.approx(300.0)
    assert kpis["ytd"] == pytest.approx(4000.00)


def test_dashboard_month_without_previous_year_data_returns_null_variation(session_id):
    # 01/2025 não existe no fixture → variação None (nunca número inventado)
    resp = client.get(f"/api/data/{session_id}/dashboard", params={"ano": 2026, "mes": 1})
    assert resp.json()["kpis"]["variacao_ano_anterior"] is None


def test_dashboard_excluding_intercompany(session_id):
    resp = client.get(
        f"/api/data/{session_id}/dashboard",
        params={"ano": 2026, "mes": 1, "excluir_intercompany": True},
    )
    kpis = resp.json()["kpis"]
    # remove a linha intercompany de 150.00 → 3850.00
    assert kpis["saida"] == pytest.approx(3850.00)


def test_dashboard_charts_present(session_id):
    resp = client.get(f"/api/data/{session_id}/dashboard", params={"ano": 2026, "mes": 1})
    body = resp.json()
    por_linha = {i["name"]: i["value"] for i in body["por_linha_negocio"]}
    assert por_linha["MORITA"] == pytest.approx(1000.00)
    assert por_linha["NÃO MAPEADO"] == pytest.approx(549.25)
    assert len(body["mensal"]) == 12
    assert body["mensal"][0]["saida"] == pytest.approx(4000.00)  # janeiro
    assert any(v["name"] == "VENDEDOR A" for v in body["por_vendedor"])


def test_dashboard_on_generic_session_returns_400():
    csv = b"a,b\n1,2\n3,4\n"
    resp = client.post("/api/upload", files={"file": ("generic.csv", csv)})
    generic_id = resp.json()["session_id"]
    resp = client.get(f"/api/data/{generic_id}/dashboard")
    assert resp.status_code == 400


def test_table_pagination_and_sort(session_id):
    resp = client.get(
        f"/api/data/{session_id}/table",
        params={"page": 1, "page_size": 5, "sort_by": "Valor (R$)", "sort_dir": "desc"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 13  # 8 saída + 2 entrada + 3 venda
    assert len(body["rows"]) == 5
    values = [r["Valor (R$)"] for r in body["rows"]]
    assert values == sorted(values, reverse=True)


def test_table_dataset_switch(session_id):
    resp = client.get(f"/api/data/{session_id}/table", params={"dataset": "Dados Venda"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 3


def test_table_unknown_dataset_404(session_id):
    resp = client.get(f"/api/data/{session_id}/table", params={"dataset": "Nada"})
    assert resp.status_code == 404


def test_distribution(session_id):
    resp = client.post(
        f"/api/charts/{session_id}/distribution",
        json={"column": "Valor (R$)", "bins": 10},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["stats"]["count"] == 13
    assert sum(b["count"] for b in body["bins"]) == 13


def test_distribution_non_numeric_400(session_id):
    resp = client.post(
        f"/api/charts/{session_id}/distribution",
        json={"column": "Mês/Ano", "bins": 10},
    )
    assert resp.status_code == 400


def test_temporal_guard_on_non_date_column(session_id):
    resp = client.post(
        f"/api/charts/{session_id}/temporal",
        json={"date_col": "Mês/Ano", "metric_col": "Valor (R$)"},
    )
    assert resp.status_code == 400  # 'MM/AAAA' é texto — nunca tratado como data


def test_export_csv_current_view(session_id):
    resp = client.get(
        f"/api/export/{session_id}/csv",
        params={"columns": "Mês/Ano,Tipo Movimento,Valor (R$)", "sort_by": "Valor (R$)", "sort_dir": "desc"},
    )
    assert resp.status_code == 200
    lines = resp.text.strip().splitlines()
    assert len(lines) == 14  # header + 13 linhas
    header = lines[0].lstrip("﻿")
    assert header.split(",")[:2] == ["Mês/Ano", "Tipo Movimento"]


def test_kpis_have_trend_and_format(session_id):
    resp = client.get(f"/api/data/{session_id}/kpis")
    assert resp.status_code == 200
    kpis = resp.json()["kpis"]
    assert kpis, "esperava KPIs"
    valor = next(k for k in kpis if k["title"] == "Valor (R$)")
    assert valor["format"] == "currency"
    assert valor["total"] == pytest.approx(4000 + 1000 + 250 + 2500)
