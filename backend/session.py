import uuid
from typing import Optional
import pandas as pd
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Session:
    """Representa uma sessão de análise com filtros"""
    df: pd.DataFrame  # DataFrame original (nunca modificar)
    df_filtered: Optional[pd.DataFrame] = None  # DataFrame com filtros aplicados
    active_filters: dict[str, Any] = field(default_factory=dict)  # Filtros ativos
    cache_invalidated: bool = False  # Flag para invalidar cache de charts
    template_type: Optional[str] = None  # e.g. "efetivo" for custom-parsed files


_sessions: dict[str, Session] = {}


def create_session(df: pd.DataFrame, template_type: Optional[str] = None) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = Session(df=df.copy(), template_type=template_type)
    return session_id


def get_session(session_id: str) -> Optional[pd.DataFrame]:
    return _sessions.get(session_id)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    return list(_sessions.keys())
