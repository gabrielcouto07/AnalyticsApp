from __future__ import annotations

import pandas as pd

from backend.session import create_session, get_active_df, get_session, get_session_info, invalidate_chart_cache


def _apply_filters_test(df: pd.DataFrame, filters: dict):
    df_filtered = df.copy()
    applied_filters = {}

    if filters.get("date_range"):
        date_range = filters["date_range"]
        column = date_range.get("col")
        start = pd.to_datetime(date_range.get("start"))
        end = pd.to_datetime(date_range.get("end"))
        if column in df_filtered.columns:
            df_filtered[column] = pd.to_datetime(df_filtered[column], errors="coerce")
            df_filtered = df_filtered[(df_filtered[column] >= start) & (df_filtered[column] <= end)]
            applied_filters["date_range"] = date_range

    if filters.get("categorical"):
        applied_filters["categorical"] = []
        for cat_filter in filters["categorical"]:
            column = cat_filter.get("col")
            values = cat_filter.get("values", [])
            if column in df_filtered.columns and values:
                df_filtered = df_filtered[df_filtered[column].isin(values)]
                applied_filters["categorical"].append(cat_filter)

    if filters.get("numeric"):
        applied_filters["numeric"] = []
        for num_filter in filters["numeric"]:
            column = num_filter.get("col")
            minimum = num_filter.get("min")
            maximum = num_filter.get("max")
            if column in df_filtered.columns:
                if minimum is not None:
                    df_filtered = df_filtered[df_filtered[column] >= minimum]
                if maximum is not None:
                    df_filtered = df_filtered[df_filtered[column] <= maximum]
                applied_filters["numeric"].append(num_filter)

    return df_filtered, applied_filters


def test_session_creation_and_helpers():
    df = pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "date": pd.date_range("2020-01-01", periods=5),
            "amount": [100, 200, 150, 300, 250],
            "category": ["A", "B", "A", "C", "B"],
        }
    )

    session_id = create_session(df)
    session = get_session(session_id)

    assert session is not None
    assert len(session.df) == 5
    assert session.df_filtered is None
    assert session.active_filters == {}
    assert get_active_df(session_id) is not None


def test_filter_helpers_and_session_info():
    df = pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "date": pd.date_range("2020-01-01", periods=5),
            "amount": [100, 200, 150, 300, 250],
            "category": ["A", "B", "A", "C", "B"],
        }
    )

    session_id = create_session(df)
    session = get_session(session_id)

    filtered_df, applied = _apply_filters_test(
        df,
        {
            "date_range": {"col": "date", "start": "2020-01-02", "end": "2020-01-04"},
            "categorical": [{"col": "category", "values": ["A", "B"]}],
            "numeric": [{"col": "amount", "min": 100, "max": 250}],
        },
    )

    assert len(filtered_df) == 2
    assert applied["date_range"]["col"] == "date"
    assert len(applied["categorical"]) == 1
    assert len(applied["numeric"]) == 1

    session.df_filtered = df[df["category"] == "A"]
    session.active_filters = {"categorical": [{"col": "category", "values": ["A"]}]}

    info = get_session_info(session_id)
    assert info is not None
    assert info["total_rows"] == 5
    assert info["filtered_rows"] == 2
    assert info["is_filtered"] is True
    assert info["filter_count"] == 1

    assert session.cache_invalidated is False
    invalidate_chart_cache(session_id)
    assert session.cache_invalidated is True
