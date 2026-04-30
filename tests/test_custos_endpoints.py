from __future__ import annotations

import pandas as pd

from backend.session import create_session


def _seed_custos_session() -> str:
    dataframe = pd.DataFrame(
        [
            {
                "n_consolidado": "1",
                "fornecedor": "Fornecedor A",
                "nf": "1001",
                "natureza": "Material / Serviço",
                "valor": 1500.0,
                "data_vencimento": "2026-01-10",
                "boleto_deposito": "Boleto",
                "situacao_planilha": "A PAGAR",
                "saldo_planilha": 1500.0,
            },
            {
                "n_consolidado": "2",
                "fornecedor": "Fornecedor B",
                "nf": "1002",
                "natureza": "Staff",
                "valor": 900.0,
                "data_vencimento": "2026-02-05",
                "boleto_deposito": "Deposito",
                "situacao_planilha": "PAGO",
                "saldo_planilha": 0.0,
            },
        ]
    )
    return create_session(dataframe, filename="custos.csv", schema_types=["custos"])


def test_custos_resumo_returns_expected_keys(client) -> None:
    session_id = _seed_custos_session()

    response = client.get(f"/api/custos/{session_id}/resumo")

    assert response.status_code == 200
    payload = response.json()
    assert "total_nfs" in payload
    assert "total_valor" in payload
    assert "by_natureza" in payload


def test_custos_nfs_returns_items(client) -> None:
    session_id = _seed_custos_session()

    response = client.get(f"/api/custos/{session_id}/nfs")

    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert isinstance(payload["items"], list)


def test_custos_fluxo_returns_months(client) -> None:
    session_id = _seed_custos_session()

    response = client.get(f"/api/custos/{session_id}/fluxo")

    assert response.status_code == 200
    payload = response.json()
    assert "months" in payload


def test_custos_invalid_session_returns_404(client) -> None:
    response = client.get("/api/custos/invalid-session/resumo")

    assert response.status_code == 404
