from __future__ import annotations

import pandas as pd


def _upload_sample(client, tmp_path):
    csv_path = tmp_path / "endpoints_sample.csv"
    pd.DataFrame(
        {
            "data": pd.date_range("2024-01-01", periods=24, freq="D"),
            "categoria": ["A", "B", "A", "C"] * 6,
            "vendas": [10, 20, 30, 40] * 6,
            "custo": [5, 9, 15, 18] * 6,
        }
    ).to_csv(csv_path, index=False)

    with csv_path.open("rb") as handle:
        response = client.post("/api/upload", files={"file": handle})
    assert response.status_code == 200
    return response.json()


def test_end_to_end_data_endpoints(client, tmp_path):
    upload = _upload_sample(client, tmp_path)
    session_id = upload["session_id"]

    assert upload["rows"] > 0
    assert upload["columns"] > 0
    assert upload["detected_schema"]

    kpis_response = client.get(f"/api/data/{session_id}/kpis")
    assert kpis_response.status_code == 200
    assert "kpis" in kpis_response.json()

    temporal_response = client.post(
        f"/api/charts/{session_id}/temporal",
        json={"date_col": "data", "metric_col": "vendas"},
    )
    assert temporal_response.status_code == 200
    assert temporal_response.json()["data"]

    cross_response = client.post(
        f"/api/charts/{session_id}/cross",
        json={"cat_col": "categoria", "num_col": "vendas"},
    )
    assert cross_response.status_code == 200
    assert cross_response.json()["data"]

    correlation_response = client.get(f"/api/charts/{session_id}/correlation")
    assert correlation_response.status_code == 200
    assert len(correlation_response.json()["columns"]) >= 2

    quality_response = client.get(f"/api/data/{session_id}/quality")
    assert quality_response.status_code == 200
    assert quality_response.json()["quality"]
