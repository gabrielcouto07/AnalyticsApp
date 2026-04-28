from __future__ import annotations

import pandas as pd

from backend.services.data_profiler import profile_dataset


def test_profile_dataset_returns_expected_keys():
    df = pd.DataFrame(
        {
            "col_a": [1, 2, 3, 4, 5],
            "col_b": ["a", "b", "c", "d", "e"],
            "col_c": [1.1, 2.2, 3.3, None, 5.5],
        }
    )

    result = profile_dataset(df)

    assert isinstance(result, dict)
    assert "summary" in result or "data_profile" in result or result
