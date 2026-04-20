#!/usr/bin/env python3
"""Test Efetivo parser"""
import sys
sys.path.insert(0, 'c:/Users/GABRIEL.CARDOSO/Desktop/Dashboards_Project/sdfbg/AnalyticsApp')

from backend.services.efetivo_parser import parse_efetivo_file, get_efetivo_summary

# Test file path
efetivo_file = "c:\\Users\\GABRIEL.CARDOSO\\Desktop\\Dashboards_Project\\sdfbg\\AnalyticsApp\\11.2 - Efetivo_2026.xlsx"

# Read file
with open(efetivo_file, 'rb') as f:
    content = f.read()

filename = "11.2 - Efetivo_2026.xlsx"

print(f"Testing file: {filename}")
print()

# Parse
df = parse_efetivo_file(content, filename)

print(f"✓ Parsed shape: {df.shape}")
print(f"✓ Columns: {list(df.columns)}")
print()

if not df.empty:
    print("✓ First 5 rows:")
    print(df.head())
    print()
    
    print("✓ Summary:")
    summary = get_efetivo_summary(df)
    for key, value in summary.items():
        print(f"  {key}: {value}")
else:
    print("❌ DataFrame is empty!")
