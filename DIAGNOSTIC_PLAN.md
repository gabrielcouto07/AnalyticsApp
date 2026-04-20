# 🚨 DIAGNÓSTICO: MATERIAIS (15.2.x) NÃO RETORNA RESULTADOS

## Problemas Encontrados

### 1. ❌ Estrutura do Arquivo
- Arquivo tem metadados nas primeiras linhas (Obra, Assunto, etc.)
- Tabela de dados começa na linha 13+
- `load_dataframe()` lê APENAS a tabela de dados (5 linhas)
- **Resultado**: Metadados perdidos ❌

### 2. ❌ Parser Incompleto
- `MateriaisParser.parse()` espera ter metadados
- Se não encontrar, retorna dados muito reduzidos
- Colunas esperadas não são preenchidas
- **Resultado**: Dashboard tenta acessar colunas que não existem ❌

### 3. ❌ Frontend Não Reconhece "Materiais"
- Frontend não tem suporte específico para template "materiais"
- Tenta renderizar como se fosse NF/Orcamento
- **Resultado**: "Failed to fetch" ❌

### 4. ❌ Falta Camadas de Análise
- Não há: cost_breakdown, fornecedor_performance, projeto_custo
- Não há: time_series
- Não há: anomalies, inefficiency
- Não há: matrix_categoria_fornecedor
- Não há: calculation_log (diferencial)

---

## 🎯 PLANO DE AÇÃO

### FASE 1: Corrigir Detecção e Parsing (URGENTE)

#### 1.1 - Melhorar `load_dataframe()` para Mapa de Concorrência
- [ ] Detectar se é arquivo "Mapa de Concorrência"
- [ ] Extrair TODAS as informações (Obra, Assunto, etc.)
- [ ] Preservar metadados em colunas

#### 1.2 - Robustecer `MateriaisParser.parse()`
- [ ] Garantir que coloca dados corretamente
- [ ] Preencher colunas faltantes com valores default
- [ ] Retornar estrutura padronizada

#### 1.3 - Adicionar Suporte no Upload
- [ ] Validar que dados foram parseados
- [ ] Retornar erro claro se falhar
- [ ] Adicionar logs de debug

### FASE 2: Criar Camadas de Análise (6 NÍVEIS)

#### 2.1 - Visão Executiva
- [ ] KPIs: Total, Qtd Registros, Ticket Médio, Fornecedores, Projetos
- [ ] Cards com ícones
- [ ] Gráfico de tendência
- [ ] Gráfico de distribuição (pizza)

#### 2.2 - Estrutura de Custos
- [ ] Tabela: cost_breakdown
- [ ] Tabela: fornecedor_performance  
- [ ] Tabela: projeto_custo
- [ ] Gráficos: Bar, Bar Horizontal, Pie

#### 2.3 - Análise Temporal
- [ ] Tabela: time_series
- [ ] Gráficos: Linha de valor, Linha acumulada, Barras

#### 2.4 - Eficiência e Problemas
- [ ] Tabela: anomalies (detectar outliers)
- [ ] Tabela: inefficiency (comparar real vs esperado)
- [ ] Highlights e ranking de risco

#### 2.5 - Dashboard de Relacionamento
- [ ] Matriz: categoria x fornecedor
- [ ] Heatmap
- [ ] Stacked bar

#### 2.6 - Dashboard de Explicação (DIFERENCIAL)
- [ ] Tabela: calculation_log
- [ ] Timeline visual
- [ ] Mostrar cada etapa de processamento
- [ ] Explicar fórmulas usadas

### FASE 3: Melhorar Frontend (Menos IA, Mais Profissional)

#### 3.1 - Layout Executivo
- [ ] Cards grandes e claros
- [ ] Sem borders desnecessários
- [ ] Tipografia profissional
- [ ] Cores consistentes

#### 3.2 - Página de Materiais
- [ ] Layout dedicado (não genérico)
- [ ] Menu lateral com as 6 seções
- [ ] Transições suaves
- [ ] Responsivo

#### 3.3 - Páginas Brancas
- [ ] Adicionar conteúdo real
- [ ] Remover botões genéricos
- [ ] Layouts específicos para cada página

---

## 📊 IMPLEMENTAÇÃO DETALHADA

### Estrutura de Dados Esperada para Materiais

```python
{
    "Obra": "PROJETO DE PISCINA E AQUECIMENTO",
    "Assunto": "Piscina",
    "Item": 1,
    "Descricao": "Concreto 28MPa",
    "Quant": 50,
    "Unid": "m³",
    "FornecedorNome": "Bom Calor",
    "Contato": "Eduardo T.",
    "Telefone": "(31) 99941-0200",
    "Email": "comercial@bomcalor.com",
    "ValorUnitario": 450.00,
    "ValorNegociado": 420.00,
    "ValorTotal": 21000.00,
    "Data": "2024-01-15"
}
```

### Análises Necessárias

**cost_breakdown:**
```
categoria    | total      | %     | qtd_itens | ticket_medio
Concreto     | 250000.00  | 35.2% | 120       | 2083.33
Aço          | 180000.00  | 25.3% | 85        | 2117.65
Acabamento   | 150000.00  | 21.1% | 110       | 1363.64
```

**fornecedor_performance:**
```
fornecedor          | total      | qtd | media     | %_total
Bom Calor           | 250000.00  | 45  | 5555.56   | 35.2%
Fornecedor Central  | 180000.00  | 38  | 4736.84   | 25.3%
Materiais & Cia     | 150000.00  | 42  | 3571.43   | 21.1%
```

---

## 🔧 PRÓXIMOS PASSOS

1. **Hoje**: Corrigir Parser (Fase 1)
2. **Hoje**: Implementar camadas de análise (Fase 2)
3. **Hoje**: Melhorar Frontend (Fase 3)
4. **Teste**: Upload do arquivo 15.2.1
5. **Validação**: Verificar todos os 9 arquivos

---

Status: 🔴 BLOQUEADO (Failed to Fetch)
Prioridade: 🔥 ALTA
Estimativa: 6-8 horas de desenvolvimento
