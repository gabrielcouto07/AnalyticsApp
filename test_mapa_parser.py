"""
Testing script for Mapa de Concorrência parser.
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.services.mapa_concorrencia_parser import MapaConcorrenciaParser
from backend.services.materiais_analytics import MateriaisAnalytics

# Test file
test_file = Path(__file__).parent / "excel_files" / "15.2.1 - MP-FKR018-RIL-001 - PROJETO DE PISCINA E AQUECIMENTO.xlsx"

if not test_file.exists():
    print(f"❌ File not found: {test_file}")
    sys.exit(1)

print(f"📂 Testing: {test_file.name}")

# Read file
with open(test_file, "rb") as f:
    file_bytes = f.read()

print(f"📊 File size: {len(file_bytes) / 1024:.1f} KB")

# Parse
try:
    parser = MapaConcorrenciaParser(file_bytes, test_file.name)
    df, metadata = parser.parse()
    
    print(f"\n✅ Parser successful!")
    print(f"   Shape: {df.shape}")
    print(f"   Metadata: {metadata}")
    print(f"\n📋 Columns: {list(df.columns)}")
    print(f"\n📊 Data preview:")
    print(df.head(3).to_string())
    
    # Test analytics
    print(f"\n🔍 Running analytics...")
    analytics = MateriaisAnalytics(df)
    analysis = analytics.analyze()
    
    print(f"\n✅ Analytics successful!")
    print(f"   Layer 1 KPIs: {list(analysis['layer_1'].get('kpis', {}).keys())}")
    print(f"   Layer 2 Costs: {list(analysis['layer_2'].keys())}")
    print(f"   Layer 6 Log steps: {len(analysis['layer_6'].get('calculation_log', []))}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print(f"\n🎉 All tests passed!")
