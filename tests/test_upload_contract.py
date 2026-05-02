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

    session_id = payload["session_id"]
    nfs_response = client.get(f"/api/custos/{session_id}/nfs")
    assert nfs_response.status_code == 200
    nfs_payload = nfs_response.json()
    assert nfs_payload["total"] >= 200
    assert nfs_payload["items"][0]["fornecedor"]
    assert nfs_payload["items"][0]["valor"] > 0
    assert nfs_payload["items"][0]["source_sheet"].startswith("PLANILHA NFs")

    resumo_response = client.get(f"/api/custos/{session_id}/resumo")
    assert resumo_response.status_code == 200
    resumo_payload = resumo_response.json()
    assert resumo_payload["total_nfs"] >= 200
    assert resumo_payload["total_valor"] > 1_000_000
    assert resumo_payload["taxa_adm_pct"] >= 0
    assert resumo_payload["valor_com_taxa"] >= resumo_payload["total_valor"]

    consolidado_response = client.get(f"/api/custos/{session_id}/consolidado")
    assert consolidado_response.status_code == 200
    assert len(consolidado_response.json()["data"]) >= 40
