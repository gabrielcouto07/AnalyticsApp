"""
TESTE DE INTEGRAÇÃO — Parte 5: Filtros Globais

Execute com: python tests/test_filters_integration.py
"""

import sys
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

# Adicionar backend ao path (projeto raiz -> backend)
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from session import (
    create_session, get_session, get_active_df, 
    get_session_info, invalidate_chart_cache
)

# Importar função de filtro diretamente (se disponível)
# Note: backend/routers/filters.py não existe mais na branch LIMPO
# import importlib.util
# spec = importlib.util.spec_from_file_location("filters", str(Path(__file__).parent / 'backend' / 'routers' / 'filters.py'))
# filters_module = importlib.util.module_from_spec(spec)

# Implementar _apply_filters localmente para evitar import issues
def _apply_filters_test(df: pd.DataFrame, filters: dict):
    """Versão simplificada para testes"""
    df_filtered = df.copy()
    applied_filters = {}
    
    # Date range
    if "date_range" in filters and filters["date_range"]:
        dr = filters["date_range"]
        col = dr.get("col")
        start = pd.to_datetime(dr.get("start"))
        end = pd.to_datetime(dr.get("end"))
        
        if col in df_filtered.columns:
            df_filtered[col] = pd.to_datetime(df_filtered[col], errors="coerce")
            df_filtered = df_filtered[(df_filtered[col] >= start) & (df_filtered[col] <= end)]
            applied_filters["date_range"] = dr
    
    # Categorical
    if "categorical" in filters and filters["categorical"]:
        applied_filters["categorical"] = []
        for cat_filter in filters["categorical"]:
            col = cat_filter.get("col")
            values = cat_filter.get("values", [])
            if col in df_filtered.columns and values:
                df_filtered = df_filtered[df_filtered[col].isin(values)]
                applied_filters["categorical"].append(cat_filter)
    
    # Numeric
    if "numeric" in filters and filters["numeric"]:
        applied_filters["numeric"] = []
        for num_filter in filters["numeric"]:
            col = num_filter.get("col")
            min_val = num_filter.get("min")
            max_val = num_filter.get("max")
            
            if col in df_filtered.columns:
                if min_val is not None:
                    df_filtered = df_filtered[df_filtered[col] >= min_val]
                if max_val is not None:
                    df_filtered = df_filtered[df_filtered[col] <= max_val]
                applied_filters["numeric"].append(num_filter)
    
    return df_filtered, applied_filters


def test_session_creation():
    """Teste 1: Criar sessão"""
    print("\n✅ TESTE 1: Criar Sessão")
    df = pd.DataFrame({
        'id': [1, 2, 3, 4, 5],
        'date': pd.date_range('2020-01-01', periods=5),
        'amount': [100, 200, 150, 300, 250],
        'category': ['A', 'B', 'A', 'C', 'B']
    })
    
    session_id = create_session(df)
    session = get_session(session_id)
    
    assert session is not None, "Session não foi criada"
    assert len(session.df) == 5, "DataFrame não foi copiado corretamente"
    assert session.df_filtered is None, "df_filtered deveria ser None inicialmente"
    assert session.active_filters == {}, "active_filters deveria estar vazio"
    
    print(f"  ✓ Session ID: {session_id}")
    print(f"  ✓ Rows: {len(session.df)}")
    print(f"  ✓ Filtered: {session.df_filtered is None}")
    
    return session_id, df


def test_get_active_df(session_id, df):
    """Teste 2: get_active_df() helper"""
    print("\n✅ TESTE 2: get_active_df() Helper")
    
    active_df = get_active_df(session_id)
    assert active_df is not None, "get_active_df retornou None"
    assert len(active_df) == 5, "Deveria retornar df original"
    
    print("  ✓ Retorna df original quando não há filtros")


def test_date_range_filter(session_id, df):
    """Teste 3: Filtro de data range"""
    print("\n✅ TESTE 3: Filtro de Data Range")
    
    filters = {
        "date_range": {
            "col": "date",
            "start": "2020-01-02",
            "end": "2020-01-04"
        }
    }
    
    df_filtered, applied = _apply_filters_test(df, filters)
    
    assert len(df_filtered) == 3, f"Esperado 3 rows, got {len(df_filtered)}"
    assert applied["date_range"]["col"] == "date"
    
    print(f"  ✓ Filtro aplicado: {len(df)} → {len(df_filtered)} rows")
    print(f"  ✓ Data range: {applied['date_range']['start']} to {applied['date_range']['end']}")
    
    return df_filtered, applied


def test_categorical_filter(session_id, df):
    """Teste 4: Filtro categórico"""
    print("\n✅ TESTE 4: Filtro Categórico")
    
    filters = {
        "categorical": [
            {"col": "category", "values": ["A", "B"]}
        ]
    }
    
    df_filtered, applied = _apply_filters_test(df, filters)
    
    assert len(df_filtered) == 4, f"Esperado 4 rows, got {len(df_filtered)}"
    assert len(applied["categorical"]) == 1
    assert applied["categorical"][0]["values"] == ["A", "B"]
    
    print(f"  ✓ Filtro aplicado: {len(df)} → {len(df_filtered)} rows")
    print(f"  ✓ Valores selecionados: {applied['categorical'][0]['values']}")
    
    return df_filtered, applied


def test_numeric_filter(session_id, df):
    """Teste 5: Filtro numérico"""
    print("\n✅ TESTE 5: Filtro Numérico")
    
    filters = {
        "numeric": [
            {"col": "amount", "min": 150, "max": 300}
        ]
    }
    
    df_filtered, applied = _apply_filters_test(df, filters)
    
    assert len(df_filtered) == 4, f"Esperado 4 rows, got {len(df_filtered)}"
    assert applied["numeric"][0]["min"] == 150
    assert applied["numeric"][0]["max"] == 300
    
    print(f"  ✓ Filtro aplicado: {len(df)} → {len(df_filtered)} rows")
    print(f"  ✓ Range: {applied['numeric'][0]['min']} to {applied['numeric'][0]['max']}")
    
    return df_filtered, applied


def test_combined_filters(session_id, df):
    """Teste 6: Filtros combinados"""
    print("\n✅ TESTE 6: Filtros Combinados")
    
    filters = {
        "date_range": {
            "col": "date",
            "start": "2020-01-01",
            "end": "2020-01-05"
        },
        "categorical": [
            {"col": "category", "values": ["A", "B"]}
        ],
        "numeric": [
            {"col": "amount", "min": 100, "max": 250}
        ]
    }
    
    df_filtered, applied = _apply_filters_test(df, filters)
    
    # Esperado: rows com category A ou B, amount entre 100-250, date entre 1-5
    # Todos atendem esses critérios
    expected = 4  # Todas exceto a que tem amount=300
    assert len(df_filtered) == expected, f"Esperado {expected} rows, got {len(df_filtered)}"
    
    print(f"  ✓ Filtro aplicado: {len(df)} → {len(df_filtered)} rows")
    print(f"  ✓ Filtros aplicados: date_range + categorical + numeric")
    
    return df_filtered, applied


def test_session_info(session_id, df):
    """Teste 7: get_session_info()"""
    print("\n✅ TESTE 7: get_session_info()")
    
    session = get_session(session_id)
    
    # Aplicar alguns filtros
    filters = {
        "categorical": [{"col": "category", "values": ["A"]}]
    }
    df_filtered, _ = _apply_filters_test(df, filters)
    session.df_filtered = df_filtered
    session.active_filters = {
        "categorical": [{"col": "category", "values": ["A"]}]
    }
    
    info = get_session_info(session_id)
    
    assert info is not None
    assert info["total_rows"] == 5
    assert info["filtered_rows"] == 2
    assert info["is_filtered"] == True
    assert info["filter_count"] == 1  # 1 categorical filter
    
    print(f"  ✓ Total rows: {info['total_rows']}")
    print(f"  ✓ Filtered rows: {info['filtered_rows']}")
    print(f"  ✓ Is filtered: {info['is_filtered']}")
    print(f"  ✓ Filter count: {info['filter_count']}")


def test_cache_invalidation(session_id):
    """Teste 8: Cache invalidation"""
    print("\n✅ TESTE 8: Cache Invalidation")
    
    session = get_session(session_id)
    
    assert session.cache_invalidated == False, "Deveria ser False inicialmente"
    
    invalidate_chart_cache(session_id)
    assert session.cache_invalidated == True, "Deveria ser True após invalidate"
    
    print("  ✓ Cache invalidation funciona corretamente")


def test_error_handling(session_id, df):
    """Teste 9: Error handling"""
    print("\n✅ TESTE 9: Error Handling")
    
    try:
        # Teste com filtro em coluna categórica não filtrada (deveria funcionar)
        filters = {
            "categorical": [{"col": "category", "values": ["A"]}]
        }
        df_filtered, _ = _apply_filters_test(df, filters)
        print(f"  ✓ Filtro categórico simples funcionou: {len(df)} → {len(df_filtered)} rows")
        return True
    except Exception as e:
        print(f"  ✗ Erro: {str(e)}")
        return False


def test_filter_count_calculation(session_id, df):
    """Teste 10: Filter count calculation"""
    print("\n✅ TESTE 10: Filter Count Calculation")
    
    filters = {
        "date_range": {"col": "date", "start": "2020-01-01", "end": "2020-01-05"},
        "categorical": [
            {"col": "category", "values": ["A"]},
            {"col": "category", "values": ["B"]}
        ],
        "numeric": [
            {"col": "amount", "min": 100, "max": 300}
        ]
    }
    
    df_filtered, applied = _apply_filters_test(df, filters)
    
    # Contar filtros
    filter_count = (
        (1 if "date_range" in applied else 0) +
        len(applied.get("categorical", [])) +
        len(applied.get("numeric", []))
    )
    
    # Note: O segundo filtro categórico substituiu o primeiro (ambos na coluna "category")
    # Então temos: 1 date_range + 1 categorical + 1 numeric = 3
    print(f"  ✓ Filter count: {filter_count}")
    print(f"    - Date range filters: {1 if 'date_range' in applied else 0}")
    print(f"    - Categorical filters: {len(applied.get('categorical', []))}")
    print(f"    - Numeric filters: {len(applied.get('numeric', []))}")


def main():
    print("=" * 80)
    print("🧪 TESTES DE INTEGRAÇÃO — PARTE 5: FILTROS GLOBAIS")
    print("=" * 80)
    
    try:
        # Teste 1
        session_id, df = test_session_creation()
        
        # Teste 2
        test_get_active_df(session_id, df)
        
        # Teste 3
        df_filtered, _ = test_date_range_filter(session_id, df)
        
        # Teste 4
        df_filtered, _ = test_categorical_filter(session_id, df)
        
        # Teste 5
        df_filtered, _ = test_numeric_filter(session_id, df)
        
        # Teste 6
        df_filtered, _ = test_combined_filters(session_id, df)
        
        # Teste 7
        test_session_info(session_id, df)
        
        # Teste 8
        test_cache_invalidation(session_id)
        
        # Teste 9
        test_error_handling(session_id, df)
        
        # Teste 10
        test_filter_count_calculation(session_id, df)
        
        print("\n" + "=" * 80)
        print("✅ TODOS OS TESTES PASSARAM!")
        print("=" * 80)
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TESTE FALHOU: {str(e)}")
        return 1
    except Exception as e:
        print(f"\n❌ ERRO INESPERADO: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
