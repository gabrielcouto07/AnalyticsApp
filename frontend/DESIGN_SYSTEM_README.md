# 🎨 Design System Setup

Seu Dashboard agora tem um **Design System profissional** com 4 fases implementadas!

## 📦 Componentes Criados

```
✅ Card.tsx          - Container base para todos os elementos
✅ KPI.tsx           - Métricas com hierarquia visual (Lucide Icons)
✅ StatusBadge.tsx   - Pílulas de status com cores contextuais
✅ Table.tsx         - Tabelas com Zebra Styling
```

## 🚀 Como Usar

### Import Básico

```tsx
import { Card, KPI, StatusBadge, Table } from '@/components/DesignSystem';
import { BarChart3, TrendingUp, Zap, TrendingDown } from 'lucide-react';
```

### Exemplo de Página

```tsx
export function MyDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-8">
      
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <KPI 
          icon={BarChart3} 
          label="Total" 
          value="R$ 2.5M" 
          color="blue"
          subtext="valor total"
        />
        <KPI 
          icon={TrendingUp} 
          label="Média" 
          value="R$ 125K" 
          color="purple"
          subtext="por período"
        />
        {/* ... mais KPIs */}
      </div>

      {/* Gráfico em Card */}
      <Card variant="elevated" className="mb-8">
        <YourChartHere />
      </Card>

      {/* Tabela em Card */}
      <Card>
        <Table 
          data={data}
          columns={[
            { key: 'date', header: 'Data' },
            { 
              key: 'status', 
              header: 'Status',
              render: (s) => <StatusBadge status={s} />
            },
          ]}
        />
      </Card>

    </div>
  );
}
```

## 📖 Documentação Completa

Leia os arquivos:

1. **[DESIGN_SYSTEM_GUIDE.md](./src/DESIGN_SYSTEM_GUIDE.md)** - Guia completo das 4 fases
2. **[COPILOT_PROMPTS.md](./COPILOT_PROMPTS.md)** - Prompts para usar com IA
3. **[DesignSystemExample.tsx](./src/pages/DesignSystemExample.tsx)** - Exemplo interativo

## 🎯 Regras de Ouro

- ✅ **Sempre**: Use Cards para containers
- ✅ **Sempre**: Padding 24px
- ✅ **Sempre**: Lucide Icons (sem emojis)
- ✅ **Sempre**: Cores da paleta (#0284c7, #10b981, #dc2626)
- ❌ **Nunca**: Texto solto no fundo
- ❌ **Nunca**: Preto puro (#000)
- ❌ **Nunca**: Emojis

## 🎨 Cores Padrão

```
Blue (Receita):    #0284c7
Emerald (Positivo): #10b981
Red (Alerta):      #dc2626
Amber (Atenção):   #f59e0b
Purple (Média):    #7c3aed
Cyan (Mínimo):     #0891b2
```

## 🤖 Quando Usar com IA

Use o **COPILOT_PROMPTS.md** como referência. Comece com:

> "Este app é um Dashboard de BI Premium. Use apenas componentes do Design System: Card, KPI, StatusBadge, Table. Proíbido emojis - use Lucide Icons. Fundo nunca preto puro. Tudo em Cards com padding 24px."

## 📝 Próximas Tarefas

- [ ] Integrar TemporalPage com novos componentes
- [ ] Integrar DistributionPage com novos componentes
- [ ] Integrar RankingPage com novos componentes
- [ ] Validar `lucide-react` instalado
- [ ] Testar no navegador

## ✨ Teste o Design System

Visite a página de exemplo:

```
http://localhost:5173/design-system-example
```

(Após adicionar rota no router)

---

**Versão**: 1.0  
**Data**: 2026-04-20  
**Status**: ✅ Pronto para integração
