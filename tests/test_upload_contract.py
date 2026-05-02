from __future__ import annotations

from io import BytesIO
from pathlib import Path

from backend.routers.upload import choose_primary_template


def test_upload_returns_schema_types_and_detected_sheets(client) -> None:
    content = (
        b"NATUREZA,FORNECEDOR,NF,DATA VENCTO,VALOR\n"
        b"Material / Servico,Fornecedor A,1001,2026-01-10,1500.0\n"
    )

    response = client.post(
        "/api/upload",
        files={"file": ("custos.csv", BytesIO(content), "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_types"] == ["custos"]
    assert payload["detected_schema"] == ["custos"]
    assert payload["detected_sheets"] == ["custos"]
    assert "data_quality" in payload


def test_choose_primary_template_prefers_custos_when_financial_workbook_is_dominant() -> None:
    selected = choose_primary_template(
        ["custos", "orcamento"],
        custos_nfs_rows=180,
        custos_consolidado_rows=320,
        custos_resumo_rows=30,
        orcamento_budget_rows=40,
        orcamento_mapas_rows=80,
        orcado_realizado_rows=24,
    )

    assert selected == "custos"


def test_upload_sample_12_1_returns_custos_as_default_template(client) -> None:
    sample_path = Path("data/samples") / "12.1 - BD_Planilha Controle Custos_Consolidados NOVA 09_2024 (1).xlsx"

    with sample_path.open("rb") as handle:
        response = client.post(
            "/api/upload",
            files={"file": (sample_path.name, handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert "custos" in payload["schema_types"]
    assert "orcamento" in payload["schema_types"]
    assert payload["template"] == "custos"
