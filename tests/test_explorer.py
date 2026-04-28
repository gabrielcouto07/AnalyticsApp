from __future__ import annotations


def test_available_views_includes_explorer(client, sample_data_path):
    with sample_data_path.open("rb") as handle:
        upload = client.post("/api/upload", files={"file": handle})

    assert upload.status_code == 200
    session_id = upload.json()["session_id"]

    response = client.get(f"/api/data/{session_id}/views/available")
    assert response.status_code == 200

    payload = response.json()
    assert "explorer" in payload["available_views"]
    assert "explorer" in payload["views"]
    assert payload["views"]["explorer"]["label"] == "Data Explorer"
