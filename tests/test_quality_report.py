from __future__ import annotations

import pandas as pd

from backend.services.data_quality import build_quality_report


def test_build_quality_report_tracks_problem_cells() -> None:
    dataframe = pd.DataFrame(
        {
            "A": [1, 0, 1.5, None],
            "B": ["-", "NA", "#VALUE!", "texto"],
            "C": ["1", "abc", "2", None],
        }
    )

    report = build_quality_report({"Sheet1": dataframe}).to_dict()

    assert report["total_cells"] == 12
    assert report["empty_cells"] >= 1
    assert report["zero_cells"] == 1
    assert report["dash_cells"] == 1
    assert report["na_cells"] == 1
    assert report["error_cells"] == 1
    assert report["fractional_values"] == 1
    assert report["cell_errors_detail"][0]["raw_value"] == "#VALUE!"
    assert "Sheet1:C" in report["inconsistent_types"]
