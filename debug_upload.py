"""Debug upload flow for 12.csv"""
import sys
sys.path.insert(0, '.')

import traceback
from backend.services.parser import load_dataframe
from backend.services.efetivo_template import detect_efetivo_file
from backend.services.efetivo_parser import parse_efetivo_file
from backend.services.orcamento_template import detect_orcamento_file
from backend.services.orcamento_parser import parse_orcamento_file

# Load 12.csv
print("Loading 12.csv...")
with open('12.csv', 'rb') as f:
    content = f.read()

filename = '12.csv'

try:
    print("\n1. Checking Efetivo...")
    is_efetivo = detect_efetivo_file(content, filename)
    print(f"   Is Efetivo: {is_efetivo}")
    
    if is_efetivo:
        print("   Parsing as Efetivo...")
        df = parse_efetivo_file(content, filename)
        print(f"   [OK] Efetivo parse OK: {df.shape}")
    else:
        print("\n2. Checking Orcamento...")
        is_orcamento = detect_orcamento_file(content, filename)
        print(f"   Is Orcamento: {is_orcamento}")
        
        if is_orcamento:
            print("   Parsing as Orcamento...")
            result = parse_orcamento_file(content, filename)
            df = result['flat']
            print(f"   [OK] Orcamento parse OK: {df.shape}")
        else:
            print("\n3. Standard parsing...")
            df, sheets, audit_result = load_dataframe(content, filename)
            print(f"   [OK] Standard parse OK: {df.shape}")
            print(f"   Sheets: {sheets}")
    
    print(f"\n[SUCCESS] - DataFrame: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    
except Exception as e:
    print(f"\n[ERROR]: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
