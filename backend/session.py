import uuid
from typing import Optional, Any
from dataclasses import dataclass, field
import pandas as pd

@dataclass
class Session:
    """Represents an analysis session with filters and optional extra DataFrames."""
    df: pd.DataFrame
    df_filtered: Optional[pd.DataFrame] = None
    active_filters: dict[str, Any] = field(default_factory=dict)
    cache_invalidated: bool = False
    template_type: Optional[str] = None
    extras: dict[str, Any] = field(default_factory=dict)  # e.g. {"consolidado": df, "custos_meta": {...}}


_sessions: dict[str, Session] = {}


def create_session(df: pd.DataFrame, template_type: Optional[str] = None, extras: dict = None) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = Session(
        df=df.copy(),
        template_type=template_type,
        extras=extras or {},
    )
    return session_id


def get_session(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def get_active_df(session_id: str) -> Optional[pd.DataFrame]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    return session.df_filtered if session.df_filtered is not None else session.df


def get_session_extra(session_id: str, key: str) -> Any:
    """Retrieve an extra stored value (e.g. consolidado DataFrame)."""
    session = _sessions.get(session_id)
    if session is None:
        return None
    return session.extras.get(key)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)

def list_sessions() -> list[str]:
    return list(_sessions.keys())

def invalidate_chart_cache(session_id: str):
    session = get_session(session_id)
    if session: session.cache_invalidated = True

def reset_cache_flag(session_id: str):
    session = get_session(session_id)
    if session: session.cache_invalidated = False

def get_session_info(session_id: str) -> Optional[dict]:
    session = get_session(session_id)
    if session is None: return None
    total_rows = len(session.df)
    filtered_rows = len(session.df_filtered) if session.df_filtered is not None else total_rows
    filter_count = 0
    if "date_range" in session.active_filters and session.active_filters["date_range"]: filter_count += 1
    if "categorical" in session.active_filters and session.active_filters["categorical"]: filter_count += len(session.active_filters["categorical"])
    if "numeric" in session.active_filters and session.active_filters["numeric"]: filter_count += len(session.active_filters["numeric"])
    return {
        "total_rows": total_rows, "filtered_rows": filtered_rows,
        "is_filtered": session.df_filtered is not None,
        "filter_count": filter_count, "active_filters": session.active_filters,
        "cache_invalidated": session.cache_invalidated,
    }
