"""Debug script to check actual column names"""
import sys
sys.path.insert(0, '.')

from backend.services.parser import _load_csv
import json

# Load 12.csv
print("Loading 12.csv...")
with open('12.csv', 'rb') as f:
    file_bytes = f.read()

df = _load_csv(file_bytes, '12.csv')
print(f"DataFrame shape: {df.shape}")
print(f"\nColunas (exatas):")
for i, col in enumerate(df.columns, 1):
    print(f"{i:2d}. '{col}'")

print(f"\nProcurando por colunas contendo 'VALOR':")
valor_cols = [col for col in df.columns if 'VALOR' in col.upper()]
print(valor_cols)

print(f"\nProcurando por colunas contendo 'FORNECEDOR':")
forn_cols = [col for col in df.columns if 'FORNECEDOR' in col.upper()]
print(forn_cols)

print("\nAmostra de dados:")
print(df.head(1))
