import uuid
from typing import Any, Optional

import pandas as pd

# Cada sessão guarda o DataFrame principal ("df") e metadados do upload
# ("meta": modelo detectado, abas, datasets navegáveis, colunas úteis).
_sessions: dict[str, dict[str, Any]] = {}


def create_session(df: pd.DataFrame, meta: Optional[dict] = None) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {"df": df, "meta": meta or {}}
    return session_id


def get_session(session_id: str) -> Optional[pd.DataFrame]:
    entry = _sessions.get(session_id)
    return entry["df"] if entry else None


def get_session_meta(session_id: str) -> Optional[dict]:
    entry = _sessions.get(session_id)
    return entry["meta"] if entry else None


def get_dataset(session_id: str, name: Optional[str] = None) -> Optional[pd.DataFrame]:
    """DataFrame navegável por nome (aba ou tabela fato); None → principal."""
    entry = _sessions.get(session_id)
    if entry is None:
        return None
    if not name:
        return entry["df"]
    return entry["meta"].get("datasets", {}).get(name)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    return list(_sessions.keys())
