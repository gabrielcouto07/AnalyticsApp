# Analytics Hub

Aplicativo em Streamlit para exploracao rapida de planilhas. O usuario faz upload do arquivo e o app tenta identificar o contexto do dataset para montar abas de analise mais relevantes.

## O que o app faz

- carrega arquivos `xlsx`, `xls`, `csv`, `txt` e `json`
- detecta colunas de data, numericas, categoricas e possiveis IDs
- sugere contexto como vendas, comissoes, financeiro, RH, obra, estoque e logistica
- gera visoes de dados brutos, estatisticas, timeline, explorador livre e exportacao

## Estrutura

```text
.
|-- app.py
|-- config/
|   |-- colors.py
|   `-- schema_detector.py
|-- templates/
|   `-- ui.py
|-- .streamlit/config.toml
|-- theme.css
|-- requirements.txt
`-- run_streamlit.bat
```

## Como rodar

```bash
pip install -r requirements.txt
streamlit run app.py
```

No Windows, tambem da para usar:

```bash
run_streamlit.bat
```

## Observacoes

- O projeto foi enxugado para refletir apenas o fluxo atual do app.
- Arquivos de documentacao paralela, modelos legados e utilitarios fora de uso foram removidos.
