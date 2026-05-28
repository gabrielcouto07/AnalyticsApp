import io
import pandas as pd


def to_excel_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Dados")
    return buf.getvalue()


def to_csv_string(df: pd.DataFrame) -> str:
    return df.to_csv(index=False, encoding="utf-8-sig")
