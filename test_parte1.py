#!/usr/bin/env python
"""Teste rápido da Parte 1: Parser Universal + SemanticAnalyzer"""
import sys
sys.path.insert(0, ".")

import pandas as pd
from backend.services.parser import load_dataframe, get_col_types
from backend.services.semantic import SemanticAnalyzer

def test_parte1():
    print("\n=== TESTE PARTE 1: Parser Universal + Semantic Analyzer ===\n")
    
    try:
        # 1. Testar Parser
        print("[1] Testando Parser com test_data.csv...")
        with open("test_data.csv", "rb") as f:
            content = f.read()
        
        df, sheets = load_dataframe(content, "test_data.csv")
        print(f"    ✓ Carregado: {len(df)} linhas, {len(df.columns)} colunas")
        print(f"    ✓ Available sheets: {sheets}")
        
        # 2. Testar SemanticAnalyzer
        print("\n[2] Testando SemanticAnalyzer...")
        analyzer = SemanticAnalyzer()
        profile = analyzer.build_dataset_profile(df)
        
        print(f"    ✓ Análise concluída: {len(profile['columns'])} colunas classificadas")
        print(f"\n    Colunas por tipo semântico:")
        for sem_type, cols in profile["column_groups"].items():
            if cols:
                print(f"      - {sem_type}: {cols}")
        
        print(f"\n    Coluna temporal primária: {profile['primary_temporal_col']}")
        print(f"    Categorias primárias: {profile['primary_category_cols']}")
        print(f"    Numéricas primárias: {profile['primary_numeric_cols']}")
        
        # 3. Exibir confidence scores de algumas colunas
        print(f"\n    Exemplos de confiança (confidence score):")
        for col in profile["columns"][:3]:
            print(f"      - {col['name']}: {col['semantic_type']} ({col['confidence']})")
        
        print("\n✓ PARTE 1 funcionando corretamente!\n")
        return True
    
    except Exception as e:
        print(f"\n✗ ERRO na Parte 1: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_parte1()
    sys.exit(0 if success else 1)
