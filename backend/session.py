"""Sessões de análise — cache em memória + persistência durável em disco.

Cada sessão válida é gravada em `data/sessions/{id}/` de forma ATÔMICA:
escrevemos em um diretório temporário e só então renomeamos para o definitivo,
para que uma falha no meio nunca deixe uma sessão parcial ativa.

Conteúdo persistido:
- fact.parquet        → tabela fato canônica
- datasets/*.parquet  → datasets materializados (ex.: abas brutas do fallback)
- source.bin          → arquivo original (para materializar abas brutas sob demanda)
- meta.json           → metadados (modelo, abas, fonte, avisos, lazy datasets)

Lookup de sessão: memória primeiro; se ausente, tenta recarregar do disco;
404 só quando não existe em lugar nenhum. Uma sessão corrompida no disco nunca
derruba o backend — é tratada como inexistente.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from backend.services import fact

logger = logging.getLogger("analytics.session")

FACT_NAME = fact.FACT_DATASET_NAME
DATA_DIR = Path(os.environ.get("ANALYTICS_DATA_DIR", "data/sessions"))

# Cache em memória: {id: {df, meta, file_bytes, datasets, lazy_datasets, status}}
_sessions: dict[str, dict[str, Any]] = {}


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(name))[:120] or "dataset"


def _dir(sid: str) -> Path:
    return DATA_DIR / sid


# ============================================================
# Criação (ativação atômica) + persistência
# ============================================================

def create_session(
    df: pd.DataFrame,
    meta: Optional[dict] = None,
    file_bytes: Optional[bytes] = None,
    datasets: Optional[dict[str, pd.DataFrame]] = None,
    lazy_datasets: Optional[dict[str, int]] = None,
) -> str:
    sid = str(uuid.uuid4())
    entry = {
        "df": df,
        "meta": meta or {},
        "file_bytes": file_bytes,
        "datasets": dict(datasets or {}),
        "lazy_datasets": dict(lazy_datasets or {}),
        "status": "ready",
    }
    _sessions[sid] = entry
    try:
        _persist(sid, entry)
    except Exception as e:  # persistência é best-effort — memória segue válida
        logger.warning("Falha ao persistir sessão %s: %s", sid, e)
    return sid


def _persist(sid: str, entry: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_DIR / f".tmp-{sid}"
    final = _dir(sid)
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)

    entry["df"].to_parquet(tmp / "fact.parquet", index=False)

    eager = []
    ds_dir = tmp / "datasets"
    ds_dir.mkdir(exist_ok=True)
    for name, d in entry["datasets"].items():
        if name == FACT_NAME:
            continue
        safe = _safe(name)
        try:
            d.to_parquet(ds_dir / f"{safe}.parquet", index=False)
            eager.append([name, safe])
        except Exception as e:
            logger.warning("Dataset %r não pôde ser persistido: %s", name, e)

    if entry.get("file_bytes"):
        (tmp / "source.bin").write_bytes(entry["file_bytes"])

    meta_out = {
        "meta": entry["meta"],
        "status": "ready",
        "eager_datasets": eager,
        "lazy_datasets": entry["lazy_datasets"],
        "has_source": bool(entry.get("file_bytes")),
    }
    (tmp / "meta.json").write_text(json.dumps(meta_out, default=str, ensure_ascii=False),
                                   encoding="utf-8")

    # swap atômico
    if final.exists():
        shutil.rmtree(final, ignore_errors=True)
    os.replace(tmp, final)


# ============================================================
# Recarga do disco (tolerante a corrupção)
# ============================================================

def _reload(sid: str) -> Optional[dict]:
    d = _dir(sid)
    if not d.exists() or not (d / "fact.parquet").exists() or not (d / "meta.json").exists():
        return None
    try:
        df = pd.read_parquet(d / "fact.parquet")
        meta_j = json.loads((d / "meta.json").read_text(encoding="utf-8"))
        datasets = {FACT_NAME: df}
        for name, safe in meta_j.get("eager_datasets", []):
            p = d / "datasets" / f"{safe}.parquet"
            if p.exists():
                datasets[name] = pd.read_parquet(p)
        file_bytes = (d / "source.bin").read_bytes() if (d / "source.bin").exists() else None
        entry = {
            "df": df,
            "meta": meta_j.get("meta", {}),
            "file_bytes": file_bytes,
            "datasets": datasets,
            "lazy_datasets": meta_j.get("lazy_datasets", {}),
            "status": meta_j.get("status", "ready"),
        }
        _sessions[sid] = entry
        return entry
    except Exception as e:
        logger.warning("Sessão %s no disco está corrompida/incompleta: %s", sid, e)
        return None


def _entry(sid: str) -> Optional[dict]:
    return _sessions.get(sid) or _reload(sid)


# ============================================================
# Acesso
# ============================================================

def get_session(session_id: str) -> Optional[pd.DataFrame]:
    e = _entry(session_id)
    return e["df"] if e else None


def get_session_meta(session_id: str) -> Optional[dict]:
    e = _entry(session_id)
    return e["meta"] if e else None


def get_dataset(session_id: str, name: Optional[str] = None) -> Optional[pd.DataFrame]:
    """DataFrame navegável por nome; materializa abas brutas sob demanda (lazy)."""
    e = _entry(session_id)
    if e is None:
        return None
    if not name or name == FACT_NAME:
        return e["df"]
    if name in e["datasets"]:
        return e["datasets"][name]
    if name in e["lazy_datasets"] and e.get("file_bytes"):
        from backend.services.parser import load_lazy_dataset
        try:
            df = load_lazy_dataset(e["file_bytes"], name, int(e["lazy_datasets"][name]))
        except Exception as ex:
            logger.warning("Falha ao materializar dataset lazy %r: %s", name, ex)
            return None
        e["datasets"][name] = df  # cacheia após o 1º acesso
        return df
    return None


def dataset_names(session_id: str) -> list[str]:
    e = _entry(session_id)
    if e is None:
        return []
    names = [FACT_NAME]
    names += [n for n in e["datasets"] if n != FACT_NAME]
    names += [n for n in e["lazy_datasets"] if n not in e["datasets"]]
    return names


def delete_session(session_id: str):
    _sessions.pop(session_id, None)
    d = _dir(session_id)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)


def list_sessions() -> list[str]:
    return list(_sessions.keys())
