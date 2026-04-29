from __future__ import annotations

import pandas as pd
import pytest

from backend.services.schema_detector import detect_schema


@pytest.mark.parametrize(
    ("columns", "expected"),
    [
        (["CARGO/FUNÇÃO", "FORNECEDOR", "OUTRA"], ["efetivo"]),
        (["NATUREZA", "FORNECEDOR", "NF", "VALOR"], ["custos"]),
        (["DESCRIÇÃO", "QTD", "CUSTO TOTAL", "UNID"], ["orcamento"]),
        (["FORNECEDOR", "NATUREZA", "NF", "VALOR", "DESCRIÇÃO", "QTD", "CUSTO TOTAL"], ["custos", "orcamento"]),
        (["foo", "bar"], ["generic"]),
    ],
)
def test_detect_schema(columns: list[str], expected: list[str]) -> None:
    sheets = {"Sheet1": pd.DataFrame(columns=columns)}
    assert detect_schema(sheets) == expected
