from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import pandas as pd


@dataclass
class Session:
    """Representa uma sessao de analise com filtros e metadados do upload."""

    df: pd.DataFrame
    sheets: dict[str, pd.DataFrame] = field(default_factory=dict)
    filename: str = ""
    detected_sheets: list[str] = field(default_factory=list)
    schema_types: list[str] = field(default_factory=list)
    rows: int = 0
    columns: int = 0
    df_filtered: Optional[pd.DataFrame] = None
    active_filters: dict[str, Any] = field(default_factory=dict)
    cache_invalidated: bool = False
    audit: Any = None
    template_type: Optional[str] = None
    extras: dict[str, Any] = field(default_factory=dict)


_sessions: dict[str, Session] = {}


def create_session(
    df: pd.DataFrame,
    sheets: Optional[dict[str, pd.DataFrame]] = None,
    filename: str = "",
    detected_sheets: Optional[list[str]] = None,
    template_type: Optional[str] = None,
    extras: Optional[dict[str, Any]] = None,
    schema_types: Optional[list[str]] = None,
) -> str:
    session_id = str(uuid.uuid4())
    stored_df = df.copy()
    stored_sheets = {name: sheet.copy() for name, sheet in (sheets or {}).items()}
    _sessions[session_id] = Session(
        df=stored_df,
        sheets=stored_sheets,
        filename=filename,
        detected_sheets=list(detected_sheets or stored_sheets.keys()),
        schema_types=schema_types or [],
        rows=int(len(stored_df)),
        columns=int(len(stored_df.columns)),
        template_type=template_type,
        extras=extras or {},
    )
    return session_id


def get_session_extra(session_id: str, key: str) -> Any:
    session = _sessions.get(session_id)
    if session is None:
        return None
    return session.extras.get(key)


def get_session(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def get_active_df(session_id: str) -> Optional[pd.DataFrame]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    return session.df_filtered if session.df_filtered is not None else session.df


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    return list(_sessions.keys())


def invalidate_chart_cache(session_id: str) -> None:
    session = get_session(session_id)
    if session:
        session.cache_invalidated = True


def reset_cache_flag(session_id: str) -> None:
    session = get_session(session_id)
    if session:
        session.cache_invalidated = False


def get_session_info(session_id: str) -> Optional[dict[str, Any]]:
    session = get_session(session_id)
    if session is None:
        return None

    total_rows = len(session.df)
    filtered_rows = len(session.df_filtered) if session.df_filtered is not None else total_rows

    filter_count = 0
    if "date_range" in session.active_filters and session.active_filters["date_range"]:
        filter_count += 1
    if "categorical" in session.active_filters and session.active_filters["categorical"]:
        filter_count += len(session.active_filters["categorical"])
    if "numeric" in session.active_filters and session.active_filters["numeric"]:
        filter_count += len(session.active_filters["numeric"])

    return {
        "filename": session.filename,
        "total_rows": total_rows,
        "filtered_rows": filtered_rows,
        "is_filtered": session.df_filtered is not None,
        "filter_count": filter_count,
        "active_filters": session.active_filters,
        "cache_invalidated": session.cache_invalidated,
        "schema_types": session.schema_types,
        "detected_sheets": session.detected_sheets,
        "sheet_names": list(session.sheets.keys()),
        "rows": session.rows,
        "columns": session.columns,
    }
