"""Test explorer endpoint"""
import requests
import json

# Upload test_data_full.csv
with open('test_data_full.csv', 'rb') as f:
    resp = requests.post('http://localhost:8000/api/upload', files={'file': f})

data = resp.json()
sid = data['session_id']
col_types = data['col_types']

print('Session:', sid)
print('Col Types:', col_types)

numeric_cols = col_types.get('numeric', [])
if len(numeric_cols) >= 2:
    # Test explorer
    payload = {'x_column': numeric_cols[0], 'y_column': numeric_cols[1]}
    resp = requests.post(f'http://localhost:8000/api/charts/{sid}/explorer', json=payload)
    result = resp.json()
    print('\n✅ Explorer Success!')
    print(f'Correlation: {result["statistics"]["correlation"]}')
    print(f'R²: {result["statistics"]["r_squared"]}')
    print(f'Points: {result["statistics"]["count"]}')
    print(f'Trend: {result["statistics"]["trend"]["equation"]}')
else:
    print(f'Need 2+ numeric columns, found {len(numeric_cols)}')
