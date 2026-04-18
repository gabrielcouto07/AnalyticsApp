"""
Efetivo Parser — Extracts structured data from "Controle de Efetivo" Excel files.

These files have a non-standard layout:
- Row 1: Obra name (cell A1) + title "Controle de Efetivo" (cell B1)
- Row 2: Month name in cell AI2 (col 35) with label "Mês:" in AH2 (col 34)
- Row 3: Header row with "Função:" in A3, days 1-31 in cols B-AF (2-32),
          "Diárias Totais:" in AH3 (col 34), total value in AI3 (col 35)
- Row 6+: Fornecedor blocks separated by empty rows:
    - Fornecedor name in column A of the first row of each block
    - Below: Serviço rows with Função in col A, day counts in cols B-AF,
      monthly total in col AI (35)
- Year is extracted from the filename (e.g., "Efetivo_2026.xlsx" → 2026)
- Each sheet = one month (Janeiro, Fevereiro, Março, Abril, Maio, etc.)
"""

import re
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from io import BytesIO
import openpyxl


# Month name → number mapping (Portuguese)
MONTH_MAP = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3,
    "abril": 4, "maio": 5, "junho": 6, "julho": 7,
    "agosto": 8, "setembro": 9, "outubro": 10,
    "novembro": 11, "dezembro": 12,
}

# Sheets to skip (not month data)
SKIP_SHEETS = {"CONSULTA (ATIV - SERV)", "CONSULTA"}


def extract_year_from_filename(filename: str) -> int:
    """Extract year from filename like '11_2_-_Efetivo_2026.xlsx'."""
    match = re.search(r'(\d{4})', filename)
    return int(match.group(1)) if match else 2026


def _is_empty_row(ws, row: int, max_col: int = 32) -> bool:
    """Check if a row is empty (no values in cols A through AF)."""
    for col in range(1, max_col + 1):
        v = ws.cell(row=row, column=col).value
        if v is not None and str(v).strip() not in ("", "-", "NA"):
            return False
    return True


def _is_fornecedor_row(ws, row: int) -> bool:
    """
    A fornecedor row has a value in col A but NO numeric values in day columns (B-AF).
    Also the next row should be a serviço row (has a Função name).
    """
    val_a = ws.cell(row=row, column=1).value
    if val_a is None or str(val_a).strip() == "":
        return False

    # Check that day columns (2-32) have no values
    for col in range(2, 33):
        v = ws.cell(row=row, column=col).value
        if v is not None and str(v).strip() not in ("", "-", "NA"):
            return False

    # Also check col 34 and 35 — fornecedor rows don't have summary labels
    val_34 = ws.cell(row=row, column=34).value
    if val_34 is not None and str(val_34).strip() != "":
        return False

    return True


def _is_servico_row(ws, row: int) -> bool:
    """A serviço row has a Função name in col A and a summary label in col 34."""
    val_a = ws.cell(row=row, column=1).value
    val_34 = ws.cell(row=row, column=34).value
    if val_a is None or str(val_a).strip() == "":
        return False
    if val_34 is not None and str(val_34).strip() != "":
        return True
    # Fallback: if col A has text but col 34 is empty, still could be serviço
    # if it has any numeric in day columns
    for col in range(2, 33):
        v = ws.cell(row=row, column=col).value
        if v is not None:
            try:
                float(v)
                return True
            except (ValueError, TypeError):
                continue
    return False


def _parse_day_value(v) -> float:
    """Parse a cell value from a day column. Returns 0.0 for non-work markers."""
    if v is None:
        return 0.0
    s = str(v).strip()
    if s in ("", "-", "NA", "nan", "None"):
        return 0.0
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def parse_sheet(ws, month_name: str, year: int, obra: str) -> List[Dict[str, Any]]:
    """
    Parse a single sheet (one month) into flat records.

    Returns list of dicts with keys:
        Obra, Ano, Mes, MesNome, Fornecedor, Funcao, Dia, Quantidade, DiariasTotal
    """
    records = []
    month_num = MONTH_MAP.get(month_name.lower().strip(), 0)
    if month_num == 0:
        return records

    max_row = ws.max_row
    current_fornecedor = None
    row = 6  # Fornecedores start at row 6

    while row <= max_row:
        # Skip empty rows
        if _is_empty_row(ws, row):
            row += 1
            continue

        # Check if this is a fornecedor header
        if _is_fornecedor_row(ws, row):
            current_fornecedor = str(ws.cell(row=row, column=1).value).strip()
            row += 1
            continue

        # Check if this is a serviço row (under current fornecedor)
        if current_fornecedor and _is_servico_row(ws, row):
            funcao = str(ws.cell(row=row, column=1).value).strip()
            diarias_total = _parse_day_value(ws.cell(row=row, column=35).value)

            # Extract day-by-day values (cols 2-32 = days 1-31)
            for col in range(2, 33):
                day_num = col - 1  # col 2 = day 1, col 3 = day 2, etc.
                qty = _parse_day_value(ws.cell(row=row, column=col).value)

                records.append({
                    "Obra": obra,
                    "Ano": year,
                    "Mes": month_num,
                    "MesNome": month_name.strip(),
                    "Fornecedor": current_fornecedor,
                    "Funcao": funcao,
                    "Dia": day_num,
                    "Quantidade": qty,
                    "DiariasTotal": diarias_total,
                })

        row += 1

    return records


def parse_efetivo_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Main entry point: parse the entire Efetivo Excel file into a flat DataFrame.

    Args:
        file_bytes: raw bytes of the .xlsx file
        filename: original filename (used to extract year)

    Returns:
        DataFrame with columns:
            Obra, Ano, Mes, MesNome, Fornecedor, Funcao, Dia,
            Quantidade, DiariasTotal, Data
    """
    year = extract_year_from_filename(filename)
    wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)

    all_records = []

    for sheet_name in wb.sheetnames:
        if sheet_name in SKIP_SHEETS:
            continue

        ws = wb[sheet_name]

        # Extract obra from cell A1
        obra = str(ws.cell(row=1, column=1).value or "").strip()

        # Extract month name from cell AI2 (col 35) or use sheet name
        month_cell = ws.cell(row=2, column=35).value
        month_name = str(month_cell).strip() if month_cell else sheet_name

        records = parse_sheet(ws, month_name, year, obra)
        all_records.extend(records)

    if not all_records:
        return pd.DataFrame()

    df = pd.DataFrame(all_records)

    # Create proper date column
    def _make_date(row):
        try:
            return pd.Timestamp(year=row["Ano"], month=row["Mes"], day=row["Dia"])
        except (ValueError, TypeError):
            return pd.NaT

    df["Data"] = df.apply(_make_date, axis=1)

    # Remove rows where day exceeds month length (e.g., Feb 30)
    df = df[df["Data"].notna()].copy()

    # Add derived columns useful for analytics
    df["DiaSemana"] = df["Data"].dt.day_name()
    df["Periodo"] = df["Ano"].astype(str) + "-" + df["Mes"].astype(str).str.zfill(2)
    df["FornecedorFuncao"] = df["Fornecedor"] + " | " + df["Funcao"]
    df["Trabalhou"] = (df["Quantidade"] > 0).astype(int)

    return df


def get_efetivo_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate summary statistics from parsed efetivo data."""
    if df.empty:
        return {}

    # Filter to actual work days
    df_work = df[df["Quantidade"] > 0]

    return {
        "total_diarias": float(df_work["Quantidade"].sum()),
        "total_fornecedores": int(df["Fornecedor"].nunique()),
        "total_funcoes": int(df["Funcao"].nunique()),
        "meses_cobertos": int(df["Mes"].nunique()),
        "obra": df["Obra"].iloc[0] if len(df) > 0 else "",
        "ano": int(df["Ano"].iloc[0]) if len(df) > 0 else 0,
        "periodo_inicio": str(df["Data"].min().date()) if df["Data"].notna().any() else "",
        "periodo_fim": str(df["Data"].max().date()) if df["Data"].notna().any() else "",
        "fornecedores": sorted(df["Fornecedor"].unique().tolist()),
        "funcoes": sorted(df["Funcao"].unique().tolist()),
        "meses": sorted(df["MesNome"].unique().tolist()),
    }


def get_fornecedor_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate diárias by Fornecedor."""
    if df.empty:
        return pd.DataFrame()
    return (
        df[df["Quantidade"] > 0]
        .groupby("Fornecedor")
        .agg(
            TotalDiarias=("Quantidade", "sum"),
            Funcoes=("Funcao", "nunique"),
            DiasAtivos=("Data", "nunique"),
        )
        .reset_index()
        .sort_values("TotalDiarias", ascending=False)
    )


def get_funcao_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate diárias by Função."""
    if df.empty:
        return pd.DataFrame()
    return (
        df[df["Quantidade"] > 0]
        .groupby("Funcao")
        .agg(
            TotalDiarias=("Quantidade", "sum"),
            Fornecedores=("Fornecedor", "nunique"),
            DiasAtivos=("Data", "nunique"),
        )
        .reset_index()
        .sort_values("TotalDiarias", ascending=False)
    )


def get_monthly_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate diárias by month."""
    if df.empty:
        return pd.DataFrame()
    return (
        df[df["Quantidade"] > 0]
        .groupby(["Mes", "MesNome"])
        .agg(
            TotalDiarias=("Quantidade", "sum"),
            Fornecedores=("Fornecedor", "nunique"),
            Funcoes=("Funcao", "nunique"),
        )
        .reset_index()
        .sort_values("Mes")
    )


def get_daily_timeline(df: pd.DataFrame) -> pd.DataFrame:
    """Get daily total workforce count."""
    if df.empty:
        return pd.DataFrame()
    return (
        df[df["Quantidade"] > 0]
        .groupby("Data")
        .agg(TotalTrabalhadores=("Quantidade", "sum"))
        .reset_index()
        .sort_values("Data")
    )


# ─── Test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "11_2_-_Efetivo_2026.xlsx"
    with open(path, "rb") as f:
        content = f.read()
    df = parse_efetivo_file(content, path)
    print(f"Parsed {len(df)} records")
    print(f"Columns: {list(df.columns)}")
    print(f"\nSummary:")
    summary = get_efetivo_summary(df)
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print(f"\nFornecedor breakdown:")
    print(get_fornecedor_breakdown(df).to_string(index=False))
    print(f"\nFunção breakdown:")
    print(get_funcao_breakdown(df).to_string(index=False))
    print(f"\nMonthly breakdown:")
    print(get_monthly_breakdown(df).to_string(index=False))
