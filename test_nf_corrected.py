#!/usr/bin/env python3
from backend.services.parser import load_dataframe
from backend.services.nf_analyzer import NFAnalyzer

with open('12.csv', 'rb') as f:
    content = f.read()

df, sheets, audit = load_dataframe(content, '12.csv')
print(f'Loaded: {df.shape}')
print(f'Columns: {list(df.columns)}')
print()

analyzer = NFAnalyzer(df)
summary = analyzer.get_summary()
print('NFAnalyzer Summary:')
print(f'  Total NFs: {summary["total_nfs"]}')
print(f'  Total value: {summary["total_value"]}')
print(f'  Unique suppliers: {summary["unique_suppliers"]}')
print(f'  Valid rows: {summary["data_quality"]["valid_rows"]}')
