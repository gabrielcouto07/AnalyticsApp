# 📊 Analytics Dashboard — Fase 2.0 ✨

Dashboard profissional de análise de dados com **dupla arquitetura**: versão moderna em **React + FastAPI** (frontend premium) e versão interativa em **Streamlit** (análise rápida).

Detecção automática de tipos, filtros inteligentes, KPIs com trends, análises avançadas e insights automáticos com detecção de anomalias.

---

## 🚀 Features

### ✅ Carregamento Inteligente
- 📁 **Multi-formato**: Excel (.xlsx, .xls), CSV, TXT, JSON
- 🔍 **Auto-detecção de tipos**: data, numérico, categórico
- 🧹 **Limpeza automática**: R$, %, separadores decimais
- ⚡ **Caching de performance**: Sessão mantida em memória

### ✅ Filtros Avançados
- 📅 Intervalo de datas inteligente
- 🔢 Sliders para ranges numéricos
- 🏷️ Multi-select para categóricas
- 🎛️ Filtros contextuais em tempo real

### ✅ KPIs Premium (v2.0)
- 💎 **Smart KPI Cards** com indicadores de tendência ↑↓
- 📊 Trends em % com cores dinâmicas (verde/vermelho)
- 📉 **Detecção de anomalias** (Z-score + IQR)
- 🔍 **Auto-detecção de schema**: Vendas, Financeiro, Ops, RH
- 💡 **Insights automáticos** com alertas visuais

### ✅ 5+ Abas de Análise (Streamlit)
1. **📋 Visão Geral** — Dados + Qualidade + Anomalias detectadas
2. **📅 Temporal** — Séries temporais com múltiplas granularidades
3. **🔎 Explorador** — Distribuições + Análise cruzada
4. **📈 Estatísticas** — Descritivas, correlação, scatter plots
5. **💾 Exportação** — Download Excel/CSV com filtros aplicados

### ✅ 8 Páginas (React Frontend)
1. **Welcome** — Upload intuitivo
2. **Overview** — Dashboard executivo
3. **Temporal** — Gráficos de série temporal
4. **Distribution** — Histogramas e box plots
5. **Ranking** — Top N categorias
6. **Explorer** — Análise livre
7. **Correlation** — Matriz de correlação
8. **Quality** — Análise de qualidade de dados
9. **Export** — Exportação de dados

---

## 📁 Arquitetura do Projeto

```
AnalyticsApp/
│
├── 📦 BACKEND (FastAPI)
│   ├── backend/
│   │   ├── main.py              # FastAPI app + CORS
│   │   ├── session.py           # Gerenciamento de sessões UUID
│   │   ├── routers/
│   │   │   ├── upload.py        # POST /api/upload
│   │   │   ├── data.py          # GET /api/data/*
│   │   │   ├── charts.py        # POST /api/charts/*
│   │   │   └── export.py        # GET /api/export/*
│   │   └── services/
│   │       ├── parser.py        # Parse de arquivos
│   │       ├── analytics.py     # Análises avançadas
│   │       └── export.py        # Exportação de dados
│   │
│   ├── config/
│   │   ├── colors.py            # Paleta de cores
│   │   └── analytics.py         # Funções de análise
│   │
│   └── requirements.txt         # Dependências Python
│
├── 🎨 FRONTEND (React + Vite)
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx          # Root component
│   │   │   ├── main.tsx         # Entry point
│   │   │   ├── api/
│   │   │   │   ├── client.ts    # Axios config
│   │   │   │   └── analytics.ts # API functions
│   │   │   ├── store/
│   │   │   │   └── session.ts   # Zustand state
│   │   │   ├── components/      # Componentes React
│   │   │   ├── pages/           # Páginas
│   │   │   ├── lib/             # Utilitários
│   │   │   ├── App.css
│   │   │   └── index.css
│   │   ├── package.json         # Dependências Node
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│
├── 🧪 STREAMLIT (Análise Rápida)
│   ├── app.py                   # App principal Streamlit
│   ├── templates/
│   │   ├── ui.py                # Componentes UI
│   │   └── smart_kpi.py         # KPIs inteligentes
│   ├── theme.css                # CSS tema premium
│   └── .streamlit/config.toml   # Config Streamlit
│
├── run_backend.bat              # Script para rodar FastAPI
├── run_frontend.bat             # Script para rodar React
├── run_streamlit.bat            # Script para rodar Streamlit
├── ARQUITETURA.md               # Documentação técnica
└── README.md                    # Este arquivo
```

---

## 🏃 Como Executar

### ⚡ Opção 1: Streamlit (Recomendado para começar)
Análise rápida e intuitiva com interface web em tempo real.

**Windows:**
```bash
run_streamlit.bat
```
Abrirá em [http://localhost:8501](http://localhost:8501)

**Linux/Mac:**
```bash
# Criar venv
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Rodar Streamlit
streamlit run app.py
```

### 🚀 Opção 2: Full Stack (FastAPI + React)
Arquitetura profissional com separação frontend/backend.

**Terminal 1 — Backend (FastAPI):**
```bash
run_backend.bat
```
API disponível em [http://localhost:8000](http://localhost:8000)  
Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

**Terminal 2 — Frontend (React):**
```bash
run_frontend.bat
```
App disponível em [http://localhost:5173](http://localhost:5173)

---

## 🎨 Design System

### Cores (Paleta Escura Premium)
```css
Primary: #4f8ef7   (Azul)
Secondary: #a78bfa (Roxo)
Success: #34c97e   (Verde)
Warning: #f5a623   (Laranja)
Danger: #f87171    (Vermelho)
Accent: #06b6d4    (Ciano)
Background: #0f172a (Super escuro)
Surface: #1e293b   (Card background)
Text: #e2e8f0      (Branco suave)
```

### Componentes
- **Smart KPI Cards** — Gradientes + trend badges + animações
- **Insight Cards** — Alertas contextuais com cores dinâmicas
- **Gráficos Plotly** — Tema escuro consistente
- **Transições** — Cubic bezier suave (0.34, 1.56, 0.64, 1)
- **Shadows** — Glow effects em hover

---

## 📊 Análises Automáticas

### Detecção de Schema
Identifica o tipo de dataset automaticamente:
- 🛍️ **Vendas** — detecta: vendedor, produto, cliente, quantidade
- 💰 **Financeiro** — detecta: receita, despesa, lucro, fluxo de caixa
- ⚙️ **Operações** — detecta: volume, SLA, throughput, operações
- 👥 **RH** — detecta: funcionário, departamento, salário, contratação

### Qualidade de Dados
- ✅ Null count e percentual
- ✅ Unique values
- ✅ Tipo de dados
- ✅ Exemplos de valores
- ⚠️ Flagging de problemas

### Anomalias
- Z-score detection (threshold 2.5)
- IQR method (multiplicador 1.5)
- Percentual de outliers
- Alertas visuais em cards

---

## 📥 Uso Prático

### Streamlit:
1. Clique em "Carregar Dados" na sidebar
2. Selecione arquivo (Excel, CSV, JSON, TXT)
3. Auto-detecta tipos de colunas
4. Configure filtros (data, numérico, categórico)
5. Explore em 5 abas temáticas
6. Exporte resultados em Excel ou CSV

### React Frontend:
1. Faça upload do arquivo
2. Visualize dashboard executivo
3. Explore gráficos por página
4. Use filtros avançados
5. Exporte dados

---

## 🔧 Dependências

### Python
- `streamlit` - Interface web
- `pandas` - Processamento de dados
- `plotly` - Gráficos interativos
- `fastapi` - API REST
- `uvicorn` - ASGI server
- `scipy` - Análises estatísticas

### Node.js (Frontend)
- `react` - UI components
- `typescript` - Type safety
- `vite` - Dev server + bundler
- `plotly.js` - Gráficos
- `tailwind` - Utilitários CSS
- `zustand` - State management

---

## 🎯 Roadmap Futuro

- ✅ v2.0 — Dupla arquitetura (Streamlit + React)
- ⏳ v2.1 — ML predictions e forecasting
- ⏳ v2.2 — Multi-file consolidation
- ⏳ v2.3 — Database backend (PostgreSQL)
- ⏳ v3.0 — Deploy em cloud (Docker + Azure)

---

## 📝 Licença

Projeto aberto para uso educacional e comercial.

---

**Versão:** 2.0.0  
**Último Update:** Abril 2026  
**Status:** ✅ Production Ready

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
