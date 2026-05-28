import requests
import json

# Upload
with open('test_data_full.csv', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8000/api/upload', files=files)
    result = response.json()
    session_id = result['session_id']
    print('✓ Upload OK:', session_id[:8])
    print('  Linhas:', result['rows'], '| Colunas:', result['columns'])
    
    # KPIs
    kpi_resp = requests.get(f'http://localhost:8000/api/data/{session_id}/kpis')
    kpis = kpi_resp.json()
    print('✓ KPIs:', len(kpis['kpis']), 'encontrados')
    
    # Temporal
    temp_resp = requests.post(f'http://localhost:8000/api/charts/{session_id}/temporal', 
                              json={'date_col': 'data', 'metric_col': 'vendas'})
    temp_data = temp_resp.json()
    print('✓ Temporal:', len(temp_data['data']), 'pontos')
    
    # Cross
    cross_resp = requests.post(f'http://localhost:8000/api/charts/{session_id}/cross',
                               json={'cat_col': 'categoria', 'num_col': 'vendas'})
    cross_data = cross_resp.json()
    print('✓ Cross:', len(cross_data['data']), 'categorias')
    
    # Correlation
    corr_resp = requests.get(f'http://localhost:8000/api/charts/{session_id}/correlation')
    corr_data = corr_resp.json()
    print('✓ Correlation:', len(corr_data['columns']), 'variáveis')
    
    # Quality
    qual_resp = requests.get(f'http://localhost:8000/api/data/{session_id}/quality')
    qual_data = qual_resp.json()
    print('✓ Quality:', len(qual_data['quality']), 'colunas')
    
    print('\n✅ TUDO OK!')
