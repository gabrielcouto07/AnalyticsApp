import uuid
from typing import Optional
import pandas as pd

_sessions: dict[str, pd.DataFrame] = {}


def create_session(df: pd.DataFrame) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = df
    return session_id


def get_session(session_id: str) -> Optional[pd.DataFrame]:
    return _sessions.get(session_id)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    return list(_sessions.keys())
