#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from backend.services.efetivo_parser import parse_efetivo_file
from backend.services.efetivo_analyzer import EfetivoAnalyzer

with open('excel_files/11.2 - Efetivo_2026.xlsx', 'rb') as f:
    df = parse_efetivo_file(f.read(), '11.2 - Efetivo_2026.xlsx')
    
print('=== PARSER OUTPUT ===')
print('Total rows:', len(df))
print('Columns:', list(df.columns))
print('Non-zero rows:', len(df[df["Quantidade"] > 0]))
print('\nFirst 5 rows:')
print(df.head())

print('\n=== ANALYZER OUTPUT ===')
analyzer = EfetivoAnalyzer(df)
monthly = analyzer.get_monthly_breakdown()
print('Monthly breakdown entries:', len(monthly))
if monthly:
    print('First month:', monthly[0])
