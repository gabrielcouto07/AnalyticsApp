# 🎨 Premium UI Components Guide

## Overview

Este guia documenta o novo sistema de componentes premium criados para modernizar as páginas de análise. Todos os componentes seguem um design system consistente baseado em um tema dark premium com bordas sutis, destaques de cor e espaçamento profissional.

## 🎯 Componentes Criados

### 1. **PageLayout** - Master Container
Componente wrapper principal para todas as páginas.

```tsx
<PageLayout 
  icon="📈" 
  title="Série Temporal" 
  subtitle="Acompanhe a evolução temporal dos seus dados"
>
  {/* Seu conteúdo aqui */}
</PageLayout>
```

**Sub-componentes:**
- `<Section>` - Container com espaçamento (space-y-6)
- `<Row cols={1|2|3}>` - Grid responsivo
- `<EmptyState icon="📊" title="..." description="..." />` - Estado vazio
- `<LoadingState />` - Spinner de carregamento
- `<Divider />` - Linha horizontal gradiente
- `<Badge label="..." variant="success|warning|error|info" />` - Indicadores
- `<StatisticRow icon="💰" label="..." value="..." color="..." />`

### 2. **FilterCard** - Configuração
Card com filtros e ações para a seção de configuração.

```tsx
<FilterCard title="Configuração" accentColor="blue">
  <SelectField 
    label="Data" 
    value={dateCol} 
    onChange={setDateCol}
    options={[
      { value: 'data_venda', label: 'Data Venda' },
      { value: 'data_entrega', label: 'Data Entrega' }
    ]}
  />
  <ActionButton 
    label="Atualizar" 
    onClick={fetchData}
    loading={loading}
    variant="primary"
  />
</FilterCard>
```

**Props:**
- `title` - Título do filtro
- `accentColor` - Cor da barra lateral (blue|purple|emerald|amber|cyan|red|indigo|pink)
- Children: `<SelectField />` e `<ActionButton />`

### 3. **ChartCard** - Gráficos
Container para visualizações com título e tamanho configurável.

```tsx
<ChartCard 
  title="Evolução Temporal" 
  accentColor="blue"
  size="large"
>
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid />
      <XAxis />
      <YAxis />
      <Line type="monotone" dataKey="value" />
    </LineChart>
  </ResponsiveContainer>
</ChartCard>
```

**Tamanhos:**
- `small` - h-64 (256px)
- `medium` - h-80 (320px)
- `large` - h-96 (384px)

### 4. **InfoGrid** - KPI Metrics
Grid de 5 colunas para exibir métricas chave.

```tsx
<InfoGrid 
  items={[
    { 
      icon: '📅', 
      label: 'Período', 
      value: '12 meses',
      accentColor: 'blue' 
    },
    { 
      icon: '💰', 
      label: 'Total', 
      value: 'R$ 2.5M',
      accentColor: 'emerald' 
    },
    // ... mais items
  ]}
/>
```

**Cores disponíveis:**
- `blue` - Primária
- `purple` - Complementar
- `emerald` - Sucesso
- `amber` - Alerta
- `cyan` - Informação
- `red` - Erro
- `indigo` - Premium
- `pink` - Destaque

### 5. **PremiumCard** - Cartão Base
Componente versátil para cards com variantes múltiplas.

```tsx
<PremiumCard 
  variant="elevated"
  accentColor="blue"
  title="Card Title"
  subtitle="Optional subtitle"
>
  {/* Conteúdo */}
</PremiumCard>
```

**Variantes:**
- `default` - Fundo semi-transparente básico
- `elevated` - Elevado com sombra adicional
- `gradient` - Gradiente de fundo
- `glass` - Efeito vidro fosco

## 🎨 Design System

### Cores Semânticas

```
Primary (Blue):
  Light: #3b82f6
  Dark: #1e40af
  Gradient: linear-gradient(to right, #3b82f6, #1e40af)
  Border: border-blue-500/30

Success (Emerald):
  Light: #10b981
  Dark: #059669
  Gradient: linear-gradient(to right, #10b981, #059669)

Warning (Amber):
  Light: #f59e0b
  Dark: #d97706

Error (Red):
  Light: #ef4444
  Dark: #dc2626

Info (Cyan):
  Light: #06b6d4
  Dark: #0891b2
```

### Espaçamento

- Padding: 24px-32px nos cards
- Gap entre cards: 16px-24px
- Seções: space-y-6 (24px)
- Header: pb-20 (80px)

### Tipografia

- Títulos: 48px, font-black, letter-spacing -1px
- H2: 20px, font-bold
- H3: 18px, font-bold
- Labels: 12px, uppercase, letter-spacing 1px
- Valores: 32px, font-black

### Bordas e Sombras

```
Borders: 
  1px solid rgba(71, 85, 105, 0.5)
  Accent: left 4-6px solid {color}

Shadows:
  Default: 0 4px 12px rgba(0, 0, 0, 0.15)
  Hover: 0 12px 32px rgba(0, 0, 0, 0.2)
  Elevado: 0 8px 24px rgba(0, 0, 0, 0.25)

Backdrop: blur(8px)
```

## 📋 Padrão de Uso Completo

```tsx
// TemporalPage.tsx - Exemplo Completo
export default function TemporalPage() {
  const { sessionId, dateCols, numericCols } = useContext(DataContext);
  const [dateCol, setDateCol] = useState('');
  const [metricCol, setMetricCol] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getTemporalData(sessionId, { date_col: dateCol, metric_col: metricCol });
      setResponse(res);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <PageLayout 
      icon="📈" 
      title="Série Temporal" 
      subtitle="Evolução dos seus dados ao longo do tempo"
    >
      {/* 1. Filter Card */}
      <FilterCard title="Configuração" accentColor="blue">
        <SelectField 
          label="Data" 
          value={dateCol}
          onChange={setDateCol}
          options={dateCols.map(col => ({ value: col, label: col }))}
        />
        <SelectField 
          label="Métrica" 
          value={metricCol}
          onChange={setMetricCol}
          options={numericCols.map(col => ({ value: col, label: col }))}
        />
        <ActionButton 
          label="Atualizar" 
          onClick={fetchData}
          loading={loading}
        />
      </FilterCard>

      {/* 2. KPI Metrics */}
      {!loading && !error && response && (
        <>
          <InfoGrid items={[
            { icon: '📅', label: 'Período', value: `${response.stats.period_start} a ${response.stats.period_end}`, accentColor: 'blue' },
            { icon: '💰', label: 'Total', value: `R$ ${response.stats.total.toLocaleString()}`, accentColor: 'emerald' },
            { icon: '📈', label: 'Média', value: `R$ ${response.stats.average.toLocaleString()}`, accentColor: 'amber' },
            { icon: '⚡', label: 'Máximo', value: `R$ ${response.stats.max.toLocaleString()}`, accentColor: 'cyan' },
            { icon: '📊', label: 'Dados', value: `${response.data.length} registros`, accentColor: 'purple' },
          ]} />

          {/* 3. Charts */}
          <ChartGrid cols={2}>
            <ChartCard title="Evolução Temporal" accentColor="blue" size="large">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={response.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis />
                  <YAxis />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Acumulado" accentColor="emerald" size="large">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={response.cumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis />
                  <YAxis />
                  <Line type="monotone" dataKey="cumulative" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </ChartGrid>

          {/* 4. Data Table */}
          <ChartCard title="Detalhes" accentColor="indigo" size="large">
            <Table columns={response.table_columns} data={response.data} />
          </ChartCard>
        </>
      )}

      {/* 5. States */}
      {loading && <LoadingState />}
      {error && <Badge label={`Erro: ${error}`} variant="error" />}
      {!response && !loading && <EmptyState icon="📈" title="Nenhum dado" description="Configure e clique em Atualizar" />}
    </PageLayout>
  );
}
```

## 🚀 Implementação Rápida

Para implementar em uma nova página:

1. **Importe os componentes:**
   ```tsx
   import { 
     PageLayout, 
     FilterCard, 
     ChartCard, 
     InfoGrid 
   } from '@/components';
   ```

2. **Estruture a página:**
   - Wrapper: `<PageLayout>`
   - Filtros: `<FilterCard>`
   - Métricas: `<InfoGrid>`
   - Gráficos: `<ChartCard>` dentro de `<ChartGrid>`
   - Estados: `<EmptyState>`, `<LoadingState>`, `<Badge>`

3. **Aplique cores:**
   - Use `accentColor` nos componentes
   - Escolha da paleta: blue, purple, emerald, amber, cyan, red, indigo, pink

4. **Teste responsividade:**
   - Mobile: 1 coluna
   - Tablet (md): 2 colunas
   - Desktop (lg): 3+ colunas

## 📝 Notas

- Todos os componentes usam Tailwind CSS
- Background padrão: `bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950`
- Transições: 0.3s ease
- Tipos: TypeScript para segurança de tipos
- Responsivo: Mobile-first com breakpoints md/lg

## 🔄 Aplicação em Todas as Páginas

Este padrão será aplicado a:
- ✅ TemporalPage (DONE)
- 🔄 DistributionPage (NEXT)
- 🔄 RankingPage (NEXT)
- ⏳ Dashboard (depois)
- ⏳ Overview (depois)
- ⏳ Todas as outras 8+ páginas

---

**Última atualização:** Hoje
**Versão:** 1.0
**Status:** Pronto para uso
