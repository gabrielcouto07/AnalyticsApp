from __future__ import annotations

import pandas as pd


def test_upload_returns_schema_types_and_detected_sheets(client, tmp_path) -> None:
    csv_path = tmp_path / "custos.csv"
    pd.DataFrame(
        {
            "NATUREZA": ["Material / Serviço"],
            "FORNECEDOR": ["Fornecedor A"],
            "NF": ["1001"],
            "DATA VENCTO": ["2026-01-10"],
            "VALOR": [1500.0],
        }
    ).to_csv(csv_path, index=False)

    with csv_path.open("rb") as handle:
        response = client.post("/api/upload", files={"file": handle})

    assert response.status_code == 200
    payload = response.json()

    assert payload["schema_types"] == ["custos"]
    assert payload["detected_schema"] == ["custos"]
    assert payload["detected_sheets"] == ["custos"]
