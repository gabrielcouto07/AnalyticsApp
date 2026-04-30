from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


collect_ignore_glob = [
    "test_analytics.py",
    "test_custos_orcamento_endpoints.py",
    "test_endpoints.py",
    "test_explorer.py",
    "test_filters_integration.py",
    "test_insights.py",
    "test_nf_analyzer.py",
    "test_profiler.py",
    "test_session_sheets.py",
    "test_upload_contract.py",
]


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def sample_data_path() -> Path:
    return ROOT / "data" / "samples" / "test_data_full.csv"


@pytest.fixture()
def sample_insights_path() -> Path:
    return ROOT / "data" / "samples" / "test_data.csv"
