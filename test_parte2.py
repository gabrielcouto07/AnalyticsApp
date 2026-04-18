#!/usr/bin/env python
"""Teste rápido da Parte 2: Zustand Store + Distribution Endpoint"""
import sys
sys.path.insert(0, ".")

import json
from backend.session import create_session
from backend.services.parser import load_dataframe
from backend.routers.charts import chart_distribution
from backend.routers.data import get_semantic

def test_parte2():
    print("\n=== TESTE PARTE 2: Zustand Store + Distribution Endpoint ===\n")
    
    try:
        # 1. Carregar dados
        print("[1] Carregando test_data.csv...")
        with open("test_data.csv", "rb") as f:
            content = f.read()
        
        df, sheets = load_dataframe(content, "test_data.csv")
        session_id = create_session(df)
        print(f"    ✓ Session: {session_id}")
        print(f"    ✓ Colunas: {df.columns.tolist()}")
        
        # 2. Testar endpoint /semantic
        print("\n[2] Testando GET /semantic...")
        semantic_response = get_semantic(session_id)
        profile = semantic_response["dataset_profile"]
        
        # Encontrar coluna numérica
        numeric_cols = profile["primary_numeric_cols"]
        if not numeric_cols:
            numeric_cols = [col["name"] for col in profile["columns"] 
                          if col["semantic_type"] == "monetario"]
        
        if numeric_cols:
            print(f"    ✓ Colunas numéricas encontradas: {numeric_cols}")
        else:
            print(f"    ⚠ Sem colunas numéricas, usando primeira numérica do DF")
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                print(f"    ✓ Usando: {numeric_cols[0]}")
        
        # 3. Testar endpoint /distribution
        if numeric_cols:
            col_name = numeric_cols[0]
            print(f"\n[3] Testando POST /distribution/{col_name}...")
            
            dist_response = chart_distribution(session_id, col_name)
            
            print(f"    ✓ Resposta recebida para coluna: {dist_response['column']}")
            print(f"    ✓ Total valores: {dist_response['count']}")
            print(f"    ✓ Nulos: {dist_response['null_count']}")
            
            if "histogram" in dist_response:
                print(f"    ✓ Histograma: {len(dist_response['histogram']['bins'])} bins")
            
            if "boxplot" in dist_response:
                bp = dist_response["boxplot"]
                print(f"    ✓ Boxplot - Q1: {bp['q1']}, Median: {bp['median']}, Q3: {bp['q3']}")
                print(f"             Min: {bp['min']}, Max: {bp['max']}, Outliers: {len(bp['outliers'])}")
            
            if "basic_stats" in dist_response:
                stats = dist_response["basic_stats"]
                print(f"    ✓ Stats - Mean: {stats['mean']}, Std: {stats['std']}")
            
            # Validar estrutura completa
            required_keys = ["column", "dtype", "count", "null_count"]
            for key in required_keys:
                assert key in dist_response, f"Falta key: {key}"
            
            print(f"\n✓ PARTE 2 - Estrutura validada!")
            print(f"\nExemplo de resposta (primeiras keys):")
            for key in list(dist_response.keys())[:5]:
                print(f"  - {key}: {type(dist_response[key]).__name__}")
        
        return True
    
    except Exception as e:
        print(f"\n✗ ERRO na Parte 2: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_parte2()
    sys.exit(0 if success else 1)
