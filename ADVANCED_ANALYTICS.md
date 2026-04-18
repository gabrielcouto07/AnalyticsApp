# FASE 3: Motor Analítico Avançado

## Análises Avançadas Implementadas

### 1. **Detecção de Anomalias** 
- **Endpoint**: `POST /api/advanced/{session_id}/anomalies`
- **Métodos**:
  - **IQR (Interquartile Range)**: Detecta outliers usando Q1-1.5*IQR e Q3+1.5*IQR
  - **Z-Score**: Identifica valores com |z-score| > 3
  - **Isolation Forest**: Machine Learning baseado em árvores de decisão
- **Uso**: Identificar dados suspeitos ou errados

### 2. **Análise de Tendências**
- **Endpoint**: `POST /api/advanced/{session_id}/trends`
- **Saída**:
  - Direction: up/down/flat
  - Strength: forte/moderada/fraca (baseado em R²)
  - Slope: Inclinação da tendência
  - Média recente: Últimos N valores
- **Uso**: Entender padrões de crescimento/queda

### 3. **Clustering (Agrupamento)**
- **Endpoint**: `POST /api/advanced/{session_id}/clustering`
- **Métodos**:
  - **K-Means**: Agrupa dados em K clusters
    - Retorna: silhouette_score, inertia, cluster_sizes
  - **PCA (Principal Component Analysis)**: Reduz dimensionalidade
    - Retorna: explained_variance, cumulative explained variance
- **Uso**: Segmentar dados em grupos automáticos

### 4. **Segmentação**
- **Endpoint**: `POST /api/advanced/{session_id}/segmentation`
- **Métodos**:
  - **Quartis**: Q1 (0-25%), Q2 (25-50%), Q3 (50-75%), Q4 (75-100%)
  - **Threshold**: Segmenta por limiares customizados
- **Uso**: Dividir dados em faixas de valor

### 5. **Comparação de Métodos de Anomalia**
- **Endpoint**: `GET /api/advanced/{session_id}/anomalies/compare/{column}`
- **Retorna**: Comparação entre IQR, Z-Score e Isolation Forest
- **Uso**: Ver qual método detecta mais anomalias

---

## Exemplos de Uso

### Detectar Anomalias
```bash
POST /api/advanced/session-123/anomalies
{
  "column": "valor",
  "methods": ["iqr", "zscore"]
}
```

### Análise de Tendência
```bash
POST /api/advanced/session-123/trends
{
  "column": "vendas",
  "window": 5
}
```

### Clustering K-Means
```bash
POST /api/advanced/session-123/clustering
{
  "n_clusters": 3
}
```

### Segmentação por Quartis
```bash
POST /api/advanced/session-123/segmentation
{
  "column": "preco",
  "method": "quartiles"
}
```

---

## Arquivos Implementados

### Backend
- **`backend/services/advanced_analytics.py`**: 
  - `AnomalyDetector`: Classe com métodos de detecção
  - `TrendAnalyzer`: Análise de tendências
  - `ClusterAnalyzer`: Clustering e PCA
  - `SegmentationAnalyzer`: Segmentação de dados

- **`backend/routers/advanced.py`**: 
  - Endpoints REST para todas as análises
  - Validação de entrada e tratamento de erros

### Frontend
- **Integração manual**: Endpoints estão prontos para consumo

---

## Dependências Externas

### Instaladas
- scikit-learn: Clustering, PCA, Isolation Forest
- scipy: Estatísticas avançadas
- pandas, numpy: Manipulação de dados

### Opcionais
- statsmodels: Para decomposição sazonal (seasonal_decompose)

---

## Status de Implementação

✅ Anomaly Detection: Completo (IQR, Z-Score, Isolation Forest)
✅ Trend Analysis: Completo
✅ Clustering: Completo (K-Means, PCA)
✅ Segmentation: Completo (Quartis, Threshold)
✅ Endpoints: Todos registrados e funcionando

---

## Próximos Passos (FASE 4+)

- Frontend: Integrar análises avançadas nas páginas
- Performance: Otimizar para datasets grandes
- Exportação: Salvar resultados de análises
- Visualização: Criar gráficos para anomalias e clusters

---

## Notas de Implementação

1. **Normalização**: Dados são normalizados (StandardScaler) antes de clustering
2. **Tratamento de Nulls**: Valores NaN são removidos automaticamente
3. **Logging**: Todas as análises são registradas em logs
4. **Exceções**: Erros são capturados e retornados como HTTP 500 com detalhes
5. **Performance**: Isolation Forest pode ser lento em datasets muito grandes (>1M registros)
