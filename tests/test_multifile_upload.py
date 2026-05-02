from __future__ import annotations

from pathlib import Path


def test_upload_can_append_second_file_and_expose_cross_endpoints(client) -> None:
    base = Path("data/samples")
    efetivo_path = base / "11.2 - Efetivo_2026.xlsx"
    medicao_path = base / "15.2.1 - MP-FKR018-RIL-001 - PROJETO DE PISCINA E AQUECIMENTO.xlsx"

    with efetivo_path.open("rb") as handle:
        first_response = client.post(
            "/api/upload",
            files={"file": (efetivo_path.name, handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert first_response.status_code == 200
    first_payload = first_response.json()
    assert "efetivo" in first_payload["schema_types"]

    with medicao_path.open("rb") as handle:
        second_response = client.post(
            "/api/upload",
            data={"session_id": first_payload["session_id"]},
            files={"file": (medicao_path.name, handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert second_response.status_code == 200
    second_payload = second_response.json()
    assert second_payload["session_id"] == first_payload["session_id"]
    assert "efetivo" in second_payload["schema_types"]
    assert "medicao" in second_payload["schema_types"]

    medicao_summary = client.get(f"/api/medicao/{first_payload['session_id']}/summary")
    assert medicao_summary.status_code == 200
    assert medicao_summary.json()["metadata"]["obra"]

    quality_response = client.get(f"/api/quality/{first_payload['session_id']}")
    assert quality_response.status_code == 200
    assert "total_cells" in quality_response.json()

    linkage_response = client.get(f"/api/cross/{first_payload['session_id']}/linkage")
    assert linkage_response.status_code == 200
    assert "linked" in linkage_response.json()

    dataset_response = client.get(f"/api/cross/{first_payload['session_id']}/dataset")
    assert dataset_response.status_code == 200
    assert "rows" in dataset_response.json()


def test_upload_can_append_boletim_medicao_family_from_sample_16(client) -> None:
    base = Path("data/samples")
    efetivo_path = base / "11.2 - Efetivo_2026.xlsx"
    boletim_path = sorted(base.glob("16.3*.xlsx"))[0]

    with efetivo_path.open("rb") as handle:
        first_response = client.post(
            "/api/upload",
            files={"file": (efetivo_path.name, handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert first_response.status_code == 200
    session_id = first_response.json()["session_id"]

    with boletim_path.open("rb") as handle:
        second_response = client.post(
            "/api/upload",
            data={"session_id": session_id},
            files={"file": (boletim_path.name, handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert second_response.status_code == 200
    second_payload = second_response.json()
    assert "medicao" in second_payload["schema_types"]

    medicao_summary = client.get(f"/api/medicao/{session_id}/summary")
    assert medicao_summary.status_code == 200
    medicao_payload = medicao_summary.json()
    assert medicao_payload["metadata"]["tipo_documento"] == "boletim_medicao"
    assert medicao_payload["metadata"]["num_boletins"] >= 4
    assert medicao_payload["classificacao_variacao"] == "neutro"
    assert medicao_payload["valor_mao_obra"] > 0
    assert medicao_payload["valor_abatido_fornecedor"] > 0
    assert medicao_payload["valor_liquido"] < medicao_payload["valor_mao_obra"]

    dataset_response = client.get(f"/api/cross/{session_id}/dataset")
    assert dataset_response.status_code == 200
    dataset_payload = dataset_response.json()
    assert "boletim" in dataset_payload["columns"]
    assert "valor_liquido" in dataset_payload["columns"]
    assert "source_sheet" in dataset_payload["columns"]
