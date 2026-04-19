import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Ler a estrutura da 12.csv original
df_original = pd.read_csv('12.csv', sep=';', encoding='latin-1')

# Detectar e pular linhas de cabeçalho
filled_ratios = []
for idx in range(len(df_original)):
    row = df_original.iloc[idx]
    filled = sum(1 for val in row if pd.notna(val) and str(val).strip())
    ratio = filled / len(df_original.columns)
    filled_ratios.append(ratio)

max_jump = 0
header_row_idx = 0
for i in range(1, len(filled_ratios)):
    jump = filled_ratios[i] - filled_ratios[i-1]
    if jump > max_jump and filled_ratios[i] > 0.6:
        max_jump = jump
        header_row_idx = i

if header_row_idx > 0 and max_jump > 0.25:
    new_headers = df_original.iloc[header_row_idx].astype(str).tolist()
    df_original = df_original.iloc[header_row_idx + 1:].reset_index(drop=True)
    df_original.columns = new_headers

print(f"📊 Dados originais: {df_original.shape}")
print(f"📋 Colunas: {list(df_original.columns)}\n")

# Pegar apenas linhas com VALOR válido
df_valid = df_original[df_original['VALOR'].notna()].copy()

# Limpar VALOR: converter para float válido
def parse_valor(v):
    try:
        v_str = str(v).strip()
        if v_str in ['', 'nan', '-', ' -   ']:
            return np.nan
        v_str = v_str.replace('.', '').replace(',', '.')
        return float(v_str)
    except:
        return np.nan

df_valid['VALOR'] = df_valid['VALOR'].apply(parse_valor)
df_valid = df_valid.dropna(subset=['VALOR'])
print(f"✅ Dados válidos (com VALOR): {df_valid.shape[0]} NFs\n")

# Criar teste expandido (5x os dados originais com variações)
data_list = []
for i in range(5):
    df_copy = df_valid.copy().reset_index(drop=True)
    
    # Variar VALOR
    df_copy['VALOR'] = df_copy['VALOR'] * (1 + np.random.uniform(-0.15, 0.25, len(df_copy)))
    
    # Variar NFs adicionando sufixo
    df_copy['NF'] = df_copy['NF'].astype(str) + f"_{i+1:02d}"
    
    # Variar datas vencimento
    if 'DATA VENCTO' in df_copy.columns:
        df_copy['DATA VENCTO'] = df_copy['DATA VENCTO'].astype(str)
    
    data_list.append(df_copy)

df_teste = pd.concat(data_list, ignore_index=True)

print(f"🎯 Dados teste criados: {df_teste.shape[0]} NFs")

# Calcular total (VALOR já está em float)
valor_total = df_teste['VALOR'].sum()
print(f"💰 Valor total: R$ {valor_total:,.2f}")
print(f"📈 Fornecedores únicos: {df_teste['FORNECEDOR'].nunique()}")

# Converter VALOR de volta para formato brasileiro para salvar
df_teste['VALOR'] = df_teste['VALOR'].apply(lambda x: f"{x:,.2f}".replace(',', ';').replace('.', ',').replace(';', '.'))

# Salvar
df_teste.to_csv('12_teste_expanded.csv', sep=';', encoding='latin-1', index=False)
print("\n✅ Arquivo criado: 12_teste_expanded.csv")
