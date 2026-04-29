export const SCHEMA_REQUIRED_COLUMNS: Record<string, string[]> = {
  efetivo: ['CARGO/FUNÇÃO', 'FORNECEDOR', 'FILIAL/OBRA', 'PERÍODO'],
  custos: ['NATUREZA', 'FORNECEDOR', 'NF', 'DATA VENCTO', 'VALOR'],
  orcamento: ['CUSTO TOTAL', 'CUSTO UNITÁRIO', 'QTD', 'DESCRIÇÃO', 'UNID'],
  generic: [],
}
