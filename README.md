# 📊 Analytics Dashboard — Fase 1.5 ✨

Dashboard de análise de dados evolutivo com detecção automática de tipos, filtros inteligentes, KPIs com trends, e insights automáticos.

## 🚀 Features

### ✅ Carregamento de Dados (Fase 1)
- 📁 Suporte multi-formato: Excel (.xlsx, .xls), CSV, TXT, JSON
- 🔍 Auto-detecção de tipos (data, numérico, categórico)
- 🧹 Limpeza automática (R$, %, vírgulas)
- ⚡ Caching inteligente para performance

### ✅ Filtros Avançados (Fase 1)
- 📅 Filtro por range de datas
- 🔢 Sliders para ranges numéricos (até 2 colunas)
- 🏷️ Multi-select para categóricas (até 3 colunas)
- 🎛️ Filtros contextuais

### ✅ Frontend Premium (Fase 1.5 — NOVO!)
- 💎 **KPIs Inteligentes** com trend indicators ↑↓ + %
- 🎨 **Cards com gradientes** e hover animations
- 📉 **Detecção de anomalias** (IQR + Z-score)
- 🔍 **Auto-detecção de schema** (Vendas, Financeiro, Ops, RH)
- 💡 **Insights automáticos** sobre outliers e tendências
- 🎯 **Cores dinâmicas** alternando paleta conforme métrica

### ✅ 5 Abas Completas
1. **📋 Visão Geral** — Primeiras linhas + Qualidade de dados + Anomalias
2. **📅 Temporal** — Linha, barras, acumulado com stats
3. **🔎 Explorador** — Distribuições + análise cruzada
4. **📈 Estatísticas** — Descritivas, correlação, scatter
5. **💾 Exportação** — Download em Excel/CSV

## 📁 Estrutura do Projeto

```
AnalyticsApp/
├── app.py                      # App principal Streamlit
├── requirements.txt            # Dependências
├── theme.css                   # Tema escuro com gradientes (Fase 1.5)
├── .streamlit/
│   └── config.toml            # Config Streamlit (tema, upload limit)
├── config/
│   ├── __init__.py
│   ├── colors.py              # Paleta de cores (12 cores + CHART_COLORS)
│   └── analytics.py           # Funções de análise avançada (Fase 1.5)
└── templates/
    ├── __init__.py
    ├── ui.py                  # Componentes UI básicos
    └── smart_kpi.py           # Componentes inteligentes (Fase 1.5)
```

## 💻 Como Usar

### Instalação
```bash
pip install -r requirements.txt
```

### Executar
```bash
streamlit run app.py
```
Abrirá em http://localhost:8501

### Usar o App
1. **Upload** arquivo na sidebar (Excel, CSV, TXT, JSON)
2. **Selecione** colunas para análise (ou use todas)
3. **Configure filtros** por data, valor ou categoria
4. **Explore** dados em 5 abas temáticas
5. **Exporte** dados filtrados em Excel ou CSV

## 🎨 Design System

### Paleta (Fundo Escuro)
- **Primary:** `#4f8ef7` (Azul)
- **Secondary:** `#a78bfa` (Roxo)
- **Success:** `#34c97e` (Verde)
- **Warning:** `#f5a623` (Laranja)
- **Danger:** `#f87171` (Vermelho)
- **Accent:** `#06b6d4` (Ciano)
- **Background:** `#0f172a` (Escuro)
- **Surface:** `#1e293b` (Card)
- **Text:** `#e2e8f0` (Claro)

### Componentes (v1.5)
- **Smart KPI Cards** — Gradientes, sombras, trend badges ↑↓
- **Insight Cards** — Alertas visuais sobre anomalias
- **Gráficos** — Tema escuro consistente com hover interativo
- **Animações** — Loading skeleton, transições suaves

## 📊 Análises Automáticas (Fase 1.5)

### Detecção de Schema
Identifica tipo de dataset automaticamente:
- 🛍️ **Vendas** — vendedor, produto, cliente, quantidade
- 💰 **Financeiro** — receita, despesa, lucro, fluxo
- ⚙️ **Operações** — volume, SLA, throughput
- 👥 **RH** — funcionário, departamento, salário

### Indicators de Tendência
- 📈 **Crescimento** — Seta verde + % positivo
- 📉 **Queda** — Seta vermelha + % negativo
- → **Estagnado** — Seta cinza + variação ~0%

### Detecção de Anomalias
- **IQR Method:** Outliers em distribuições numéricas
- **Z-score:** Anomalias por desvio padrão
- **Visual Alerts:** Badges na aba Overview

## 🔜 Próximas Fases

### Fase 2 — Smart Insights
- [ ] Correlações automáticas com narrativa
- [ ] Sugestões de KPIs por schema
- [ ] Alertas em tempo real

### Fase 3 — Dashboards Temáticos
- [ ] `/pages/sales.py` — Funil, ticket médio, top produtos
- [ ] `/pages/financial.py` — Fluxo de caixa, cash flow
- [ ] `/pages/ops.py` — SLA, throughput, volume

### Fase 4 — Exportação de Relatório
- [ ] Gerar PDF com gráficos
- [ ] Sumário automático
- [ ] Capa com tema corporativo

## 🔧 Dependências

- **streamlit** — Framework web
- **pandas** — Manipulação de dados
- **numpy** — Operações numéricas
- **plotly** — Gráficos interativos
- **openpyxl** — Exportação Excel

## 📝 Notas

- ✨ **Performance:** Otimizado até ~100k registros
- 🔐 **Segurança:** Sem armazenamento de dados (ephemeral)
- 🎨 **Design:** Tema escuro inspirado em marketing sites modernos
- 📱 **Responsivo:** Layout adaptável para mobile/tablet

## 👨‍💻 Desenvolvido com ❤️
Fase 1.5 implementada com foco em UX premium e análises automáticas.
