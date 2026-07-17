"""Testes de integração da API (upload → kpis → charts → quality).

Usa o TestClient do FastAPI — não requer servidor rodando.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app

FIXTURE = Path(__file__).parent / "fixtures" / "test_data_full.csv"

client = TestClient(app)


@pytest.fixture(scope="module")
def session_id() -> str:
    with FIXTURE.open("rb") as f:
        response = client.post("/api/upload", files={"file": (FIXTURE.name, f, "text/csv")})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["rows"] > 0
    assert payload["columns"] >= 4
    return payload["session_id"]


def test_kpis(session_id):
    resp = client.get(f"/api/data/{session_id}/kpis")
    assert resp.status_code == 200
    assert len(resp.json()["kpis"]) > 0


def test_temporal_chart(session_id):
    resp = client.post(
        f"/api/charts/{session_id}/temporal",
        json={"date_col": "data", "metric_col": "vendas"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) > 0


def test_cross_chart(session_id):
    resp = client.post(
        f"/api/charts/{session_id}/cross",
        json={"cat_col": "categoria", "num_col": "vendas"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) > 0


def test_correlation(session_id):
    resp = client.get(f"/api/charts/{session_id}/correlation")
    assert resp.status_code == 200


def test_quality(session_id):
    resp = client.get(f"/api/data/{session_id}/quality")
    assert resp.status_code == 200
    assert len(resp.json()["quality"]) > 0


def test_unknown_session_returns_404():
    resp = client.get("/api/data/nao-existe/kpis")
    assert resp.status_code == 404
