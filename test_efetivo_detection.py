#!/usr/bin/env python3
"""Test Efetivo file detection"""
import sys
sys.path.insert(0, 'c:/Users/GABRIEL.CARDOSO/Desktop/Dashboards_Project/sdfbg/AnalyticsApp')

from backend.services.efetivo_template import detect_efetivo_file
from backend.services.orcamento_template import detect_orcamento_file

# Test file path
efetivo_file = "c:\\Users\\GABRIEL.CARDOSO\\Desktop\\Dashboards_Project\\sdfbg\\AnalyticsApp\\11.2 - Efetivo_2026.xlsx"

# Read file
with open(efetivo_file, 'rb') as f:
    content = f.read()

filename = "11.2 - Efetivo_2026.xlsx"

print(f"Testing file: {filename}")
print(f"File size: {len(content)} bytes")
print()

# Test detection
is_efetivo = detect_efetivo_file(content, filename)
is_orcamento = detect_orcamento_file(content, filename)

print(f"✓ detect_efetivo_file(): {is_efetivo}")
print(f"✓ detect_orcamento_file(): {is_orcamento}")
print()

# Test filename parsing
name_lower = filename.lower()
print(f"Filename lowercase: {name_lower}")
print(f"Contains 'efetivo': {'efetivo' in name_lower}")
