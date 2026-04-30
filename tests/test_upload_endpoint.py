from __future__ import annotations

from io import BytesIO


def test_upload_csv_detects_efetivo_schema(client) -> None:
    content = b"FORNECEDOR,FILIAL/OBRA,CARGO/FUNCAO,PERIODO\nFornecedor A,Obra 1,Pedreiro,2026-01\n"

    response = client.post(
        "/api/upload",
        files={"file": ("efetivo.csv", BytesIO(content), "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload == {
        "session_id": payload["session_id"],
        "filename": "efetivo.csv",
        "rows": 1,
        "columns": 4,
        "schema_types": ["efetivo"],
        "detected_sheets": ["efetivo"],
        "preview": payload["preview"],
    }
    assert isinstance(payload["session_id"], str)
    assert isinstance(payload["preview"], list)


def test_upload_csv_detects_generic_schema(client) -> None:
    content = b"foo,bar,baz\n1,2,3\n"

    response = client.post(
        "/api/upload",
        files={"file": ("unknown.csv", BytesIO(content), "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["schema_types"] == ["generic"]


def test_upload_empty_file_returns_400(client) -> None:
    response = client.post(
        "/api/upload",
        files={"file": ("empty.csv", BytesIO(b""), "text/csv")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Arquivo vazio"
