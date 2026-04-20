# 📊 Excel Files - Arquivos para Upload

Pasta com arquivos Excel prontos para teste do modelo **Materiais**.

## Arquivos Disponíveis (9 total)

Todos os arquivos seguem o padrão **"Mapa de Concorrência"** (15.2.x):

```
├── 15.2.1 - PROJETO DE PISCINA E AQUECIMENTO.xlsx
├── 15.2.2 - PROJETO ESTRUTURAL.xlsx
├── 15.2.2 - PROJETO ESTRUTURAL (1).xlsx
├── 15.2.2 - PROJETO DE AR CONDICIONADO.xlsx
├── 15.2.7 - MADEIRAS PARA CANTEIRO DE OBRA.xlsx
├── 15.2.7 - MADEIRAS PARA CANTEIRO DE OBRA (1).xlsx
├── 15.2.10 - BETONEIRA.xlsx
├── 15.2.10 - ARGAMASSADEIRA.xlsx
└── 15.2.14 - MARMORARIA.xlsx
```

## Como Usar

1. **Copie** um arquivo desta pasta
2. **Abra** http://localhost:5173 (Dashboard)
3. Vá para: **Upload**
4. **Selecione** o arquivo
5. Sistema detecta automaticamente como: 🏗️ **Materiais**

## Estrutura de Um Arquivo

```
Linha 2:    MAPA DE CONCORRÊNCIA
Linha 8:    OBRA: Obra RIL - RESIDENCIA ISABELA
Linha 10:   ASSUNTO: Piscina e Aquecimento
Linha 13:   Headers (ITEM, DESCRIÇÃO, QUANT, etc)
Linha 14+:  Dados dos materiais
```

### Para Múltiplos Fornecedores

O arquivo pode ter múltiplas seções:

```
FORNECEDOR 1
NOME: Bom Calor
CONTATO: Eduardo T.
TELEFONE: (31) 99941-0200
EMAIL: comercial@bomcalor.com
(Items)

FORNECEDOR 2
NOME: Outro Fornecedor
... (repete)
```

## Dados de Exemplo

| Campo | Exemplo |
|-------|---------|
| Item | 1 |
| Descrição | Concreto 28MPa |
| Quant | 50 |
| Unid | m³ |
| Fornecedor | Bom Calor |
| Preço Unit | 450.00 |
| Preço Negociado | 420.00 |
| Total | 21000.00 |

## Próximos Passos

1. ✅ Arquivo já está organizado nesta pasta
2. ⏭️ Copie um arquivo para testar
3. ⏭️ Faça upload no Dashboard
4. ⏭️ Veja os 5 gráficos + 4 filtros

---

**Arquivos prontos para teste** ✨
