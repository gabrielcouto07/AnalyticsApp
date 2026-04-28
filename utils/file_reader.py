from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd


def _read_csv_buffer(buffer: BytesIO) -> pd.DataFrame:
    try:
        df = pd.read_csv(buffer)
        if df.shape[1] == 1:
            buffer.seek(0)
            fallback = pd.read_csv(buffer, sep=";")
            if fallback.shape[1] > df.shape[1]:
                return fallback
        return df
    except Exception:
        buffer.seek(0)
        return pd.read_csv(buffer, sep=";")


def read_file(path, extension) -> pd.DataFrame:
    """Read a structured file into a DataFrame based on its extension."""
    ext = str(extension or "").lower()
    if not ext.startswith("."):
        ext = f".{ext}"

    file_path = Path(path)

    if ext in {".xlsx", ".xls", ".xlsm"}:
        return pd.read_excel(file_path)

    if ext == ".csv":
        try:
            df = pd.read_csv(file_path)
            if df.shape[1] == 1:
                fallback = pd.read_csv(file_path, sep=";")
                if fallback.shape[1] > df.shape[1]:
                    return fallback
            return df
        except Exception:
            return pd.read_csv(file_path, sep=";")

    if ext == ".json":
        return pd.read_json(file_path)

    if ext == ".txt":
        try:
            return pd.read_csv(file_path, sep="\t")
        except Exception:
            return pd.read_csv(file_path)

    raise ValueError(f"Formato nao suportado: {extension}")


def read_file_bytes(file_bytes: bytes, extension) -> pd.DataFrame:
    """Read a structured file from bytes using the same extension routing."""
    ext = str(extension or "").lower()
    if not ext.startswith("."):
        ext = f".{ext}"

    buffer = BytesIO(file_bytes)

    if ext in {".xlsx", ".xls", ".xlsm"}:
        return pd.read_excel(buffer)

    if ext == ".csv":
        return _read_csv_buffer(buffer)

    if ext == ".json":
        return pd.read_json(buffer)

    if ext == ".txt":
        try:
            return pd.read_csv(buffer, sep="\t")
        except Exception:
            buffer.seek(0)
            return pd.read_csv(buffer)

    raise ValueError(f"Formato nao suportado: {extension}")
