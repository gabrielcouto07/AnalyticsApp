"""Test NF Analyzer with 12.csv"""
import sys
sys.path.insert(0, '.')

from backend.services.parser import _load_csv
from backend.services.nf_analyzer import NFAnalyzer
import json

# Load 12.csv
print("Loading 12.csv...")
with open('12.csv', 'rb') as f:
    file_bytes = f.read()

df = _load_csv(file_bytes, '12.csv')
print(f"DataFrame loaded: {df.shape}")
print(f"Columns: {df.columns.tolist()}")

# Try NFAnalyzer
print("\nInitializing NFAnalyzer...")
try:
    analyzer = NFAnalyzer(df)
    print("NFAnalyzer initialized successfully!")
    
    print("\nGetting summary...")
    summary = analyzer.get_summary()
    print(json.dumps(summary, indent=2, default=str))
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
