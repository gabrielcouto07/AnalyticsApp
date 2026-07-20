"""Regressão do crash da planilha + robustez de sessão/erro.

Cobre o cenário estrutural que levava à tela preta e as garantias de que uma
falha nunca derruba o backend nem descarta a sessão anterior válida.
"""
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend import session as sess

FIX = Path(__file__).parent / "fixtures"
BASE = FIX / "base_unificada_mini.xlsx"
STUB = FIX / "medical_mini.xlsx"

client = TestClient(app)


def _upload(path):
    with path.open("rb") as f:
        return client.post("/api/upload", files={"file": (path.name, f)})


# ---- Erro estruturado em pt-BR (nunca traceback) ----

def test_broken_xlsx_returns_structured_ptbr_error():
    resp = client.post("/api/upload", files={"file": ("broken.xlsx", b"isto nao e um zip xlsx")})
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body and "stage" in body and "code" in body
    # mensagem pt-BR segura — sem traceback do Python
    assert "Traceback" not in body["detail"]
    assert body["stage"]  # estágio informado


def test_unsupported_extension_rejected():
    resp = client.post("/api/upload", files={"file": ("x.pdf", b"%PDF-1.4")})
    assert resp.status_code == 400


def test_failed_upload_does_not_break_backend_or_prior_session():
    # 1) sessão válida
    ok = _upload(BASE)
    assert ok.status_code == 200
    sid = ok.json()["session_id"]
    # 2) upload que falha
    bad = client.post("/api/upload", files={"file": ("bad.xlsx", b"nope")})
    assert bad.status_code == 422
    # 3) sessão anterior continua íntegra (backend não caiu, sessão não sobrescrita)
    dash = client.get(f"/api/data/{sid}/dashboard", params={"ano": 2026})
    assert dash.status_code == 200
    assert dash.json()["kpis"]["saida"] == pytest.approx(16000.00)  # Saída 01/2026 da Base


def test_unknown_session_returns_404_not_crash():
    resp = client.get("/api/data/sessao-inexistente/dashboard")
    assert resp.status_code == 404


# ---- Persistência durável (Parquet) + recarga ----

def test_session_persists_and_reloads_from_disk():
    up = _upload(BASE).json()
    sid = up["session_id"]
    # limpa a memória — força recarga do disco (Parquet)
    sess._sessions.clear()
    dash = client.get(f"/api/data/{sid}/dashboard", params={"ano": 2026})
    assert dash.status_code == 200
    assert dash.json()["kpis"]["saida"] == pytest.approx(16000.00)


def test_corrupt_session_dir_treated_as_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(sess, "DATA_DIR", tmp_path)
    bad = tmp_path / "corrupta"
    bad.mkdir()
    (bad / "fact.parquet").write_bytes(b"not parquet")
    (bad / "meta.json").write_text("{ broken json", encoding="utf-8")
    sess._sessions.pop("corrupta", None)
    assert sess.get_session("corrupta") is None   # tratada como inexistente, sem crash


# ---- Fato consistente entre as duas estratégias ----

def test_both_strategies_produce_canonical_fact():
    base = _upload(BASE).json()
    stub = _upload(STUB).json()
    assert base["source"]["fact_source"] == "base_unificada"
    assert stub["source"]["fact_source"] == "raw_reconstruction"
    # ambos expõem o mesmo dataset canônico e modelo fiscal
    assert base["model"] == stub["model"] == "medical_fiscal"
    assert "Fato Consolidado" in base["datasets"]
    assert "Fato Consolidado" in stub["datasets"]
