# 🚀 Quick Start - Analytics Dashboard v2.0

## Instalação Rápida (5 minutos)

### 1️⃣ Requisitos do Sistema
- Python 3.10+ (verifique: `python --version`)
- Node.js 16+ (verifique: `node --version`)
- Git

### 2️⃣ Clone e Setup (apenas se necessário)
```bash
# Já feito! Pulamos para o próximo passo.
```

### 3️⃣ Começar com Streamlit (Recomendado 🎯)

**Opção A - Windows:**
```bash
# Clique duplo em: run_streamlit.bat
```

**Opção B - Terminal:**
```bash
cd "c:\Users\GABRIEL.CARDOSO\Documents\Treinin\New folder (2)"

# Criar ambiente virtual (primeira vez)
python -m venv .venv
.\.venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Rodar app
streamlit run app.py
```

✅ **Resultado**: App abrirá em http://localhost:8501

---

### 4️⃣ Começar com Full Stack (Backend + Frontend)

**Terminal 1 - FastAPI Backend:**
```bash
run_backend.bat
```
✅ API disponível em http://localhost:8000/docs

**Terminal 2 - React Frontend:**
```bash
run_frontend.bat
```
✅ App disponível em http://localhost:5173

---

## 📋 Checklist de Funcionamento

### Streamlit ✅
- [ ] App carrega sem erros
- [ ] Sidebar mostra "Carregar Dados"
- [ ] Upload de arquivo funciona
- [ ] Smart KPI cards aparecem
- [ ] Abas se alternam
- [ ] Exportação funciona

### Backend ✅
- [ ] Servidor sobe em localhost:8000
- [ ] Docs swagger em /docs
- [ ] Upload endpoint funciona
- [ ] GET /data endpoints retornam JSON

### Frontend ✅
- [ ] App abre sem erros
- [ ] Página de Welcome mostra
- [ ] Upload funciona
- [ ] Páginas se alternam
- [ ] Gráficos renderizam

---

## 🔧 Troubleshooting

### ❌ "ModuleNotFoundError: No module named 'streamlit'"
```bash
pip install -r requirements.txt
```

### ❌ Porta 8501 (Streamlit) já em uso
```bash
streamlit run app.py --server.port 8502
```

### ❌ Porta 8000 (FastAPI) já em uso
```bash
python -m uvicorn backend.main:app --port 8001
```

### ❌ Porta 5173 (React) já em uso
No frontend: `npm run dev -- --port 5174`

### ❌ "SyntaxError" em app.py
- Reinstale: `pip install --upgrade streamlit`
- Verifique Python version: `python --version` (deve ser 3.10+)

### ❌ CSV/Excel não carrega
- Verifique encoding: use UTF-8
- Se erro em parsing: tente CSV simples primeiro
- Verifique tamanho (máx 200MB no Streamlit)

### ❌ Smart KPIs não aparecem
- Verifique se há colunas numéricas
- Check browser console para erros
- Reinstale theme: limpe cache do Streamlit
  ```bash
  streamlit cache clear
  ```

---

## 📊 Dataset de Teste

Recomendo testar com dados reais primeiro, mas aqui estão boas opções:

**1. Dataset Vendas (CSV):**
```csv
data,vendedor,produto,quantidade,valor
2024-01-01,João,Produto A,5,150.00
2024-01-01,Maria,Produto B,3,200.00
```

**2. Dataset Financeiro (XLSX):**
Crie em Excel com colunas: data, receita, despesa, lucro

**3. Dataset HR (JSON):**
```json
[
  {"funcionario": "Ana", "departamento": "TI", "salario": 5000},
  {"funcionario": "Bruno", "departamento": "RH", "salario": 4000}
]
```

---

## 🎯 Próximos Passos

1. ✅ Rode Streamlit e teste upload
2. ✅ Explore as 5 abas
3. ✅ Teste filtros
4. ✅ Exporte dados
5. ✅ (Opcional) Rode Backend + React

---

## 📞 Comandos Úteis

```bash
# Limpar cache Streamlit
streamlit cache clear

# Listar portas em uso (Windows)
netstat -ano | findstr :8501

# Matar processo na porta (Windows)
taskkill /PID <PID> /F

# Versão Python
python --version

# Versão pip
pip --version

# Versão Node
node --version

# Versão npm
npm --version
```

---

**Versão:** 2.0.0  
**Testado em:** Python 3.10+, Node 16+  
**Status:** ✅ Ready to Go!
