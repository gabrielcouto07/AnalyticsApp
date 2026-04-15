import io
import json
import numpy as np
import pandas as pd


def detect_and_parse(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in df.columns:
        if df[col].dtype != object:
            continue
        try:
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().sum() / len(df) > 0.7:
                df[col] = parsed
                continue
        except Exception:
            pass

        cleaned = (
            df[col].astype(str)
            .str.replace(r"[R$%\s]", "", regex=True)
            .str.replace(".", "", regex=False)
            .str.replace(",", ".", regex=False)
        )
        numeric = pd.to_numeric(cleaned, errors="coerce")
        if numeric.notna().sum() / len(df) > 0.7:
            df[col] = numeric
    return df


def get_col_types(df: pd.DataFrame) -> dict:
    return {
        "date": df.select_dtypes(include=["datetime64"]).columns.tolist(),
        "numeric": df.select_dtypes(include=[np.number]).columns.tolist(),
        "categorical": df.select_dtypes(include=["object", "category"]).columns.tolist(),
    }


def load_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    name = filename.lower()
    buf = io.BytesIO(file_bytes)

    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(buf)
    elif name.endswith(".csv"):
        sample = buf.read(2048).decode("utf-8", errors="ignore")
        buf.seek(0)
        sep = ";" if sample.count(";") > sample.count(",") else ","
        df = pd.read_csv(buf, sep=sep, on_bad_lines="skip")
    elif name.endswith(".txt"):
        sample = buf.read(2048).decode("utf-8", errors="ignore")
        buf.seek(0)
        sep = "\t" if "\t" in sample else ("|" if "|" in sample else ",")
        df = pd.read_csv(buf, sep=sep, on_bad_lines="skip")
    elif name.endswith(".json"):
        raw = json.load(buf)
        if isinstance(raw, list):
            df = pd.json_normalize(raw)
        elif isinstance(raw, dict):
            for v in raw.values():
                if isinstance(v, list):
                    df = pd.json_normalize(v)
                    break
            else:
                df = pd.DataFrame([raw])
        else:
            raise ValueError("Estrutura JSON não reconhecida")
    else:
        raise ValueError(f"Formato não suportado: {filename}")

    return detect_and_parse(df)
