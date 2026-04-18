#!/usr/bin/env python
"""Teste de integração da Parte 1 via API"""
import asyncio
import json
import sys
from pathlib import Path

# Simular requisição HTTP
def test_integration():
    print("\n=== TESTE DE INTEGRAÇÃO PARTE 1 ===\n")
    
    # 1. Simular upload
    print("[1] Simulando upload + /semantic endpoint...")
    try:
        from backend.session import create_session
        from backend.services.parser import load_dataframe
        from backend.routers.data import get_semantic
        
        # Carregar test_data.csv
        with open("test_data.csv", "rb") as f:
            content = f.read()
        
        df, sheets = load_dataframe(content, "test_data.csv")
        session_id = create_session(df)
        print(f"    ✓ Session criada: {session_id}")
        
        # Chamar endpoint /semantic
        response = get_semantic(session_id)
        profile = response["dataset_profile"]
        
        print(f"    ✓ GET /semantic retornou:")
        print(f"      - Total colunas: {profile['total_cols']}")
        print(f"      - Total linhas: {profile['total_rows']}")
        print(f"      - Tipos encontrados: {list(profile['column_groups'].keys())}")
        
        # Validar estrutura
        assert "columns" in profile, "Falta 'columns' na resposta"
        assert "column_groups" in profile, "Falta 'column_groups' na resposta"
        assert "primary_temporal_col" in profile, "Falta 'primary_temporal_col' na resposta"
        
        # Verificar cada coluna
        print(f"\n    Detalhes das colunas:")
        for col in profile["columns"]:
            print(f"      - {col['name']}: {col['semantic_type']} (conf: {col['confidence']})")
            assert "name" in col
            assert "semantic_type" in col
            assert "confidence" in col
            assert "scores" in col
        
        print(f"\n✓ INTEGRAÇÃO OK - Endpoint /semantic pronto para uso!")
        return True
        
    except Exception as e:
        print(f"\n✗ ERRO na integração: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_integration()
    sys.exit(0 if success else 1)
