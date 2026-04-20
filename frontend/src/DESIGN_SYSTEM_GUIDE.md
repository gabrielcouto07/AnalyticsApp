# 🎨 Design System Guide - Analytics Dashboard

> **"Prompt de Sistema" do seu app - Adicione isto ao topo dos seus arquivos de estilo e instrua a IA conforme as regras abaixo**

---

## 📋 Visão Geral

Este app é um **Dashboard de BI Premium** com visual profissional e intuitivo. O objetivo é manter consistência visual em todos os componentes, garantindo uma experiência de usuário de alta qualidade.

---

## 🌈 Fase 1: Padronização de Containers (Cards)

### Objetivo
A IA tende a empilhar elementos sem respeitar hierarquia visual. Definimos uma estrutura fixa para todos os containers.

### Especificações

```css
/* Card Base */
.card {
  background-color: #1e293b;     /* slate-800 */
  border: 1px solid #334155;      /* slate-700 */
  border-radius: 12px;
  padding: 24px;                  /* SEMPRE 24px - Regra de Ouro */
  transition: all 0.3s ease;
}

.card:hover {
  border-color: #475569;          /* slate-600 */
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.3);
}
```

### Variantes de Cards

1. **Default** - Uso geral
   - Background: `#1e293b` com 60% opacity
   - Border: `#334155` com 50% opacity

2. **Elevated** - Seções importantes
   - Background: `#1e293b` com 80% opacity
   - Border: `#334155` (opaco)
   - Shadow: `shadow-xl`

3. **Bordered** - Alternativa estilizada
   - Background: Transparente
   - Border: `2px` ao invés de `1px`

### Quando Usar

- ✅ Usar para: Seções de dados, gráficos, tabelas, formulários
- ❌ Evitar: Texto solto diretamente no fundo

### Comando para Copilot

> "Crie uma classe CSS ou componente de Card com fundo #1e293b, borda de 1px sólida #334155 e border-radius de 12px. Sempre use padding: 24px em todos os containers."

---

## 💰 Fase 2: Hierarquia de Dados (KPIs)

### Objetivo
Criar estrutura visual consistente para métricas, evitando "amontoado de texto".

### Estrutura de KPI

```
┌────────────────────────────────┐
│ 📊 LABEL (texto cinza, small)   │
│                                 │
│ 9.234.567                       │
│ Valor Principal (2rem, bold)    │
│                                 │
│ Subtexto (xs, slate-500)        │
└────────────────────────────────┘
```

### Especificações

- **Ícone**: Vetorial à esquerda (Lucide Icons, NOT emoji)
- **Valor Principal**:
  - Font-size: `2rem` (`text-4xl`)
  - Font-weight: `700` (bold)
  - Color: `#ffffff`
  
- **Rótulo**:
  - Font-size: `0.875rem`
  - Color: `#94a3b8` (slate-400)
  - Texto: UPPERCASE + letter-spacing

- **Subtexto**:
  - Font-size: `0.75rem`
  - Color: `#64748b` (slate-500)

### Paleta de Cores para KPIs

| Status | Cor | Ícone | Background |
|--------|-----|-------|------------|
| Total | Blue | 📊 → `BarChart3` | `#0369a1` |
| Média | Purple | 📈 → `TrendingUp` | `#7c3aed` |
| Máximo | Amber | ⚡ → `Zap` | `#d97706` |
| Mínimo | Cyan | 📉 → `TrendingDown` | `#0891b2` |
| Positivo | Emerald | ✅ → `CheckCircle` | `#059669` |
| Negativo | Red | ❌ → `AlertCircle` | `#dc2626` |

### Comando para Copilot

> "Sempre que exibir um KPI (como Total ou Média), use um Flexbox com ícone vetorial à esquerda (Lucide Icons, sem emojis). O valor principal deve ter font-size: 2rem e font-weight: 700. O rótulo deve ter color: #94a3b8 e font-size: 0.875rem. Adicione suporte a indicadores de tendência."

---

## 📊 Fase 3: Modernização de Tabelas e Listas

### Objetivo
Melhorar leitura dinâmica de dados com Zebra Styling e Badges de Status.

### Especificações - Zebra Styling

```css
/* Linhas pares com background alternado */
tbody tr:nth-child(even) {
  background-color: rgba(30, 41, 59, 0.4);  /* slate-800/40 */
}

/* Hover para interatividade */
tbody tr:hover {
  background-color: rgba(30, 41, 59, 0.6);  /* slate-800/60 */
  transition: background-color 0.2s ease;
}

/* Sem bordas externas pesadas */
table {
  border: 1px solid #334155;
  border-collapse: collapse;
}

thead tr {
  border-bottom: 1px solid #334155;
  background-color: rgba(15, 23, 42, 0.5);  /* slate-900/50 */
}

tbody tr {
  border-bottom: 1px solid rgba(51, 65, 85, 0.3);  /* slate-700/30 */
}
```

### Status Badges

```
Acima   → 🟢 Green   (bg: #10b981/20, text: #10b981)
Abaixo  → 🔴 Red     (bg: #dc2626/20, text: #dc2626)
Aviso   → 🟡 Amber   (bg: #f59e0b/20, text: #f59e0b)
Neutro  → ⚪ Slate   (bg: #64748b/20, text: #64748b)
OK      → ✅ Emerald (bg: #059669/20, text: #059669)
```

### Componente StatusBadge

```tsx
<StatusBadge status="above" label="Acima da Média" />
<StatusBadge status="below" />
<StatusBadge status="warning" label="Atenção Necessária" />
```

### Comando para Copilot

> "Implemente Zebra Styling em tabelas (linhas alternadas). Remova bordas externas pesadas. Crie uma função que retorne um Badge (pílula) para a coluna Status. Se for 'Acima', fundo verde opaco com texto verde brilhante. Se 'Abaixo', tons de vermelho/laranja."

---

## 🎯 Fase 4: Guia de Cores & Brand

### Paleta de Cores Principal

```
Primária (Blue):
  - Escura: #0369a1 (sky-700)
  - Média: #0284c7 (sky-600)
  - Clara: #38bdf8 (sky-400)

Complementar (Emerald):
  - Escura: #047857 (emerald-700)
  - Média: #059669 (emerald-600)
  - Clara: #10b981 (emerald-500)

Alertas/Destaque (Red/Amber):
  - Erro: #dc2626 (red-600)
  - Aviso: #f59e0b (amber-500)

Neutras:
  - Fundo: #0f172a (slate-950)
  - Containers: #1e293b (slate-800)
  - Texto: #e2e8f0 (slate-200)
  - Secundário: #94a3b8 (slate-400)
```

### Regras de Cores

- ❌ **Nunca**: Preto puro (`#000000`)
- ✅ **Sempre**: `#0f172a` para fundos escuros
- ❌ **Nunca**: Cores muito saturadas
- ✅ **Sempre**: Usar opacidade (80%, 60%, 40%, 20%) para profundidade

---

## 📈 Fase 5: Gráficos & Visualizações

### Tipo de Gráfico

- ✅ Area Charts com gradiente
- ✅ Composed Charts (múltiplas séries)
- ✅ Linhas suaves (não anguladas)
- ❌ Barras solidas em série temporal

### Exemplo de Gradiente

```tsx
<defs>
  <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8}/>
    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
  </linearGradient>
</defs>

<Area 
  type="monotone" 
  dataKey="value" 
  fill="url(#gradientBlue)" 
  stroke="#38bdf8"
  strokeWidth={2}
/>
```

---

## 🔧 Implementação no Código

### Imports Recomendados

```tsx
import { Card, KPI, StatusBadge, Table } from '@/components';
import { BarChart3, TrendingUp, Zap, TrendingDown } from 'lucide-react';
```

### Exemplo Completo

```tsx
export function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-8">
      {/* Seção de Título */}
      <h1 className="text-5xl font-bold text-white mb-3">Analytics Dashboard</h1>
      
      {/* Seção de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KPI icon={BarChart3} label="Total" value="R$ 2.5M" color="blue" />
        <KPI icon={TrendingUp} label="Média" value="R$ 125K" color="purple" />
        <KPI icon={Zap} label="Máximo" value="R$ 450K" color="amber" />
        <KPI icon={TrendingDown} label="Mínimo" value="R$ 45K" color="cyan" />
      </div>

      {/* Seção de Gráficos */}
      <Card variant="elevated" className="mb-8">
        {/* Seu gráfico aqui */}
      </Card>

      {/* Seção de Tabelas */}
      <Card>
        <Table 
          data={data}
          columns={[
            { key: 'date', header: 'Data' },
            { key: 'value', header: 'Valor', render: (v) => `R$ ${v}` },
            { 
              key: 'status', 
              header: 'Status', 
              render: (s) => <StatusBadge status={s} />
            }
          ]}
        />
      </Card>
    </div>
  );
}
```

---

## 📝 Checklist de Implementação

- [ ] Componente `Card` criado e integrado
- [ ] Componente `KPI` criado com Lucide Icons
- [ ] Componente `StatusBadge` criado com cores contextuais
- [ ] Componente `Table` com Zebra Styling
- [ ] Paleta de cores definida no Tailwind config
- [ ] Todos os emojis removidos e substituídos por Lucide Icons
- [ ] TemporalPage usando novos componentes
- [ ] DistributionPage usando novos componentes
- [ ] RankingPage usando novos componentes
- [ ] Guia de cores documentado

---

## ✨ Próximas Fases

### Fase 6: Animações
- Fade-in para cards
- Skeleton loading screens
- Transições suaves em gráficos

### Fase 7: Acessibilidade
- ARIA labels em badges
- Contraste de cores validado
- Dark mode completo

### Fase 8: Responsividade
- Mobile-first design
- Touch-friendly buttons
- Layouts adaptáveis

---

**Versão**: 1.0  
**Data**: 2026-04-20  
**Mantido por**: Design System Team
