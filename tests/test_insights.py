from __future__ import annotations

import pandas as pd


def test_insights_endpoint_returns_summary(client, tmp_path):
    csv_path = tmp_path / "insights_sample.csv"
    pd.DataFrame(
        {
            "data": pd.date_range("2024-01-01", periods=24, freq="D"),
            "valor": list(range(1, 25)),
            "valor_duplicado": [value * 2 for value in range(1, 25)],
            "categoria": ["A", "B", "A", "C"] * 6,
        }
    ).to_csv(csv_path, index=False)

    with csv_path.open("rb") as handle:
        upload = client.post("/api/upload", files={"file": handle})

    assert upload.status_code == 200
    session_id = upload.json()["session_id"]

    insights_response = client.get(f"/api/data/{session_id}/insights")
    assert insights_response.status_code == 200

    payload = insights_response.json()["insights"]
    assert isinstance(payload, list)
    assert payload
    assert all(isinstance(item, dict) for item in payload)
    assert any("severity" in item for item in payload)
