#!/usr/bin/env python3
import pandas as pd
from io import BytesIO
import re

# Ler arquivo
with open('12.csv', 'rb') as f:
    content = f.read()

encoding = 'latin-1'
buf = BytesIO(content)
sample = content[:2048].decode(encoding, errors="ignore")

# Detecta separador
sep = ";" if sample.count(";") > sample.count(",") else ","
print(f"Detected separator: {sep}")

buf.seek(0)
df_raw = pd.read_csv(buf, sep=sep, on_bad_lines="skip", encoding=encoding, header=None, dtype=str, keep_default_na=False)
print(f"\n1. Raw DF shape (with all metadata): {df_raw.shape}")
print(f"First 10 rows (first 5 cols):")
for idx in range(min(10, len(df_raw))):
    row = df_raw.iloc[idx]
    filled = sum(1 for v in row if pd.notna(v) and str(v).strip())
    ratio = filled / len(row) if len(row) > 0 else 0
    print(f"  Row {idx}: filled={filled}/{len(row)} ({ratio:.1%}), first_5_cols={list(row[:5])}")

# Aplicar pré-processamento de metadata
print("\n2. Detecting metadata lines with IMPROVED logic (using regex)...")
metadata_lines = 0
for idx in range(min(len(df_raw), 15)):
    row = df_raw.iloc[idx]
    filled_count = sum(1 for val in row if pd.notna(val) and str(val).strip())
    filled_ratio = filled_count / len(row) if len(row) > 0 else 0
    
    # Se menos de 50% das colunas têm valor (ou menos de 10 colunas), é provavelmente metadata
    if filled_ratio < 0.5 or filled_count < 10:
        # Mas verifica se parece ser um header: procura por palavras-chave de header
        row_text = " ".join([str(v)[:20] for v in row if pd.notna(v) and str(v).strip()])
        # Se tem palavras chave de header (como palavras completas), não é metadata pura
        header_keywords = r'\b(consolidado|cod|fornecedor|valor|data|natureza|boleto|deposito)\b'
        if re.search(header_keywords, row_text, re.IGNORECASE):
            print(f"  Row {idx}: {filled_count}/{len(row)} ({filled_ratio:.1%}) - HEADER DETECTED ('{row_text[:50]}...') - stop")
            break  # Para aqui - encontrou header
        print(f"  Row {idx}: {filled_count}/{len(row)} ({filled_ratio:.1%}) - METADATA - skip")
        metadata_lines += 1
    else:
        print(f"  Row {idx}: {filled_count}/{len(row)} ({filled_ratio:.1%}) - BODY DATA - stop")
        # Para quando encontra a primeira linha com mais dados
        break

print(f"\nSkipping first {metadata_lines} lines")
df_after_skip = df_raw.iloc[metadata_lines:].reset_index(drop=True)
print(f"3. After skip: shape={df_after_skip.shape}")
print(f"First 10 rows after skip (first 5 cols):")
for idx in range(min(10, len(df_after_skip))):
    row = df_after_skip.iloc[idx]
    filled = sum(1 for v in row if pd.notna(v) and str(v).strip())
    ratio = filled / len(row) if len(row) > 0 else 0
    print(f"  Row {idx}: {list(row[:6])}")
