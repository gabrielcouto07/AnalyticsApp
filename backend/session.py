from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

import pandas as pd


def _clone_df(dataframe: pd.DataFrame | None) -> pd.DataFrame:
    if not isinstance(dataframe, pd.DataFrame):
        return pd.DataFrame()
    return dataframe.copy()


def _clone_sheets(sheets: dict[str, pd.DataFrame] | None) -> dict[str, pd.DataFrame]:
    return {name: sheet.copy() for name, sheet in (sheets or {}).items() if isinstance(sheet, pd.DataFrame)}


@dataclass
class SessionFile:
    file_id: str
    filename: str
    schema_types: list[str] = field(default_factory=list)
    sheets: dict[str, pd.DataFrame] = field(default_factory=dict)
    df: pd.DataFrame = field(default_factory=pd.DataFrame)
    metadata: dict[str, Any] = field(default_factory=dict)
    quality_report: dict[str, Any] = field(default_factory=dict)
    parsed_data: dict[str, Any] = field(default_factory=dict)
    detected_sheets: list[str] = field(default_factory=list)
    rows: int = 0
    columns: int = 0
    template_type: Optional[str] = None
    extras: dict[str, Any] = field(default_factory=dict)


@dataclass
class Session:
    """Representa uma sessao de analise com arquivos anexados e metadados ativos."""

    df: pd.DataFrame = field(default_factory=pd.DataFrame)
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
    files: list[SessionFile] = field(default_factory=list)
    cross_data: dict[str, Any] | None = None


_sessions: dict[str, Session] = {}


def _unique_schema_types(values: Iterable[str]) -> list[str]:
    filtered = [value for value in values if value]
    ordered = list(dict.fromkeys(filtered))
    if len(ordered) > 1 and "generic" in ordered:
        ordered = [value for value in ordered if value != "generic"]
    return ordered or ["generic"]


def build_session_file(
    df: pd.DataFrame,
    sheets: Optional[dict[str, pd.DataFrame]] = None,
    filename: str = "",
    detected_sheets: Optional[list[str]] = None,
    template_type: Optional[str] = None,
    extras: Optional[dict[str, Any]] = None,
    schema_types: Optional[list[str]] = None,
    metadata: Optional[dict[str, Any]] = None,
    quality_report: Optional[dict[str, Any]] = None,
    parsed_data: Optional[dict[str, Any]] = None,
) -> SessionFile:
    stored_df = _clone_df(df)
    stored_sheets = _clone_sheets(sheets)
    return SessionFile(
        file_id=str(uuid.uuid4()),
        filename=filename,
        schema_types=_unique_schema_types(schema_types or []),
        sheets=stored_sheets,
        df=stored_df,
        metadata=dict(metadata or {}),
        quality_report=dict(quality_report or {}),
        parsed_data=dict(parsed_data or {}),
        detected_sheets=list(detected_sheets or stored_sheets.keys()),
        rows=int(len(stored_df)),
        columns=int(len(stored_df.columns)),
        template_type=template_type,
        extras=dict(extras or {}),
    )


def _apply_active_file(session: Session, file_entry: SessionFile) -> None:
    session.df = _clone_df(file_entry.df)
    session.sheets = _clone_sheets(file_entry.sheets)
    session.filename = file_entry.filename
    session.detected_sheets = list(file_entry.detected_sheets)
    session.rows = int(file_entry.rows)
    session.columns = int(file_entry.columns)
    session.template_type = file_entry.template_type
    session.extras = dict(file_entry.extras)


def _refresh_session_schema_types(session: Session) -> None:
    session.schema_types = _unique_schema_types(
        schema
        for file_entry in session.files
        for schema in file_entry.schema_types
    )


def create_session(
    df: pd.DataFrame,
    sheets: Optional[dict[str, pd.DataFrame]] = None,
    filename: str = "",
    detected_sheets: Optional[list[str]] = None,
    template_type: Optional[str] = None,
    extras: Optional[dict[str, Any]] = None,
    schema_types: Optional[list[str]] = None,
    metadata: Optional[dict[str, Any]] = None,
    quality_report: Optional[dict[str, Any]] = None,
    parsed_data: Optional[dict[str, Any]] = None,
) -> str:
    session_id = str(uuid.uuid4())
    file_entry = build_session_file(
        df=df,
        sheets=sheets,
        filename=filename,
        detected_sheets=detected_sheets,
        template_type=template_type,
        extras=extras,
        schema_types=schema_types,
        metadata=metadata,
        quality_report=quality_report,
        parsed_data=parsed_data,
    )
    session = Session(files=[file_entry])
    _apply_active_file(session, file_entry)
    _refresh_session_schema_types(session)
    _sessions[session_id] = session
    return session_id


def append_file_to_session(
    session_id: str,
    df: pd.DataFrame,
    sheets: Optional[dict[str, pd.DataFrame]] = None,
    filename: str = "",
    detected_sheets: Optional[list[str]] = None,
    template_type: Optional[str] = None,
    extras: Optional[dict[str, Any]] = None,
    schema_types: Optional[list[str]] = None,
    metadata: Optional[dict[str, Any]] = None,
    quality_report: Optional[dict[str, Any]] = None,
    parsed_data: Optional[dict[str, Any]] = None,
) -> Session:
    session = _sessions.get(session_id)
    if session is None:
        raise KeyError(f"Session not found: {session_id}")

    file_entry = build_session_file(
        df=df,
        sheets=sheets,
        filename=filename,
        detected_sheets=detected_sheets,
        template_type=template_type,
        extras=extras,
        schema_types=schema_types,
        metadata=metadata,
        quality_report=quality_report,
        parsed_data=parsed_data,
    )
    session.files.append(file_entry)
    _apply_active_file(session, file_entry)
    _refresh_session_schema_types(session)
    return session


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


def find_session_file(session: Session, required_schemas: str | Iterable[str]) -> SessionFile | None:
    targets = {required_schemas} if isinstance(required_schemas, str) else set(required_schemas)
    for file_entry in reversed(session.files):
        if any(schema in file_entry.schema_types for schema in targets):
            return file_entry
    return None


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
        "files_count": len(session.files),
    }
