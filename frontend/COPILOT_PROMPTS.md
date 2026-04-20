# 🤖 Prompts para Copilot - Design System

Use estes prompts padrão ao trabalhar com IA para garantir consistência no design do dashboard.

---

## 📌 Prompt Geral (Adicione no início de cada sessão)

```
Este app é um Dashboard de BI Premium com visual profissional.

**Regras de Ouro:**
1. Fundo: Nunca use preto puro (#000), use #0f172a (slate-950)
2. Containers: Todos os elementos devem estar dentro de Cards. Nada de texto solto no fundo.
3. Padding: Sempre use padding: 24px em containers
4. Ícones: Use apenas Lucide Icons, PROÍBIDO usar emojis
5. Cores: Azul profissional (#0284c7) e Verde (#10b981) para dados positivos, Vermelho (#dc2626) para alertas
6. Gráficos: Area Charts com gradiente, nunca barras simples para séries temporais
7. Tabelas: Zebra Styling (linhas alternadas), sem bordas externas pesadas
8. Status: Use BadgeS (pílulas) com cores contextuais (verde=acima, vermelho=abaixo)

Componentes disponíveis: Card, KPI, StatusBadge, Table
```

---

## 🏗️ Fase 1: Quando Criar Cards/Containers

```
Crie uma classe CSS ou componente de Card com as seguintes especificações:
- Fundo: #1e293b (slate-800)
- Borda: 1px sólida #334155 (slate-700)
- Border Radius: 12px
- Padding: 24px OBRIGATÓRIO
- Hover Effect: Aumente a sombra e altere a cor da borda para #475569
- Variantes: default (60% opacity), elevated (80% opacity), bordered (sem background)

Garanta que NENHUM elemento fica solto. Tudo dentro de um Card.
```

---

## 💰 Fase 2: Quando Criar KPIs ou Métricas

```
Crie um componente KPI com hierarquia visual conforme abaixo:

Estrutura:
- ÍCONE vetorial à esquerda (Lucide Icons, NÃO emoji)
- LABEL: font-size 0.875rem, color #94a3b8, UPPERCASE, letter-spacing aumentado
- VALOR PRINCIPAL: font-size 2rem, font-weight 700, color #ffffff
- SUBTEXTO (opcional): font-size 0.75rem, color #64748b

Cores suportadas:
- Blue (#0284c7): Para Total, Receita
- Purple (#7c3aed): Para Média, Performance
- Amber (#d97706): Para Máximo, Pico
- Cyan (#0891b2): Para Mínimo, Vale
- Emerald (#10b981): Para Positivo, Crescimento
- Red (#dc2626): Para Negativo, Alerta

Exemplos de ícones Lucide:
- Total: BarChart3
- Média: TrendingUp
- Máximo: Zap
- Mínimo: TrendingDown
- Positivo: CheckCircle
- Negativo: AlertCircle
```

---

## 📊 Fase 3: Quando Criar Tabelas

```
Implemente Zebra Styling em tabelas seguindo estas regras:

1. Linhas pares: background-color: rgba(30, 41, 59, 0.4) (slate-800/40)
2. Linhas ímpares: background transparente
3. Hover: background-color: rgba(30, 41, 59, 0.6) com transição suave
4. Header: background-color: rgba(15, 23, 42, 0.5), border-bottom: 1px solid #334155
5. Bordas: Apenas border-bottom em linhas, sem bordas laterais pesadas
6. Padding: 1.5rem (24px) em cada célula

Para colunas com Status, use o componente StatusBadge:
- Status "above" ou "acima": fundo verde opaco (#10b981/20), texto verde (#10b981)
- Status "below" ou "abaixo": fundo vermelho opaco (#dc2626/20), texto vermelho (#dc2626)
- Status "warning": fundo amarelo opaco (#f59e0b/20), texto amarelo (#f59e0b)

Remova linhas externas pesadas. Use apenas 1px de borda onde necessário.
```

---

## 🎨 Fase 4: Quando Criar Gráficos

```
Gráficos devem seguir estas especificações:

Tipo de Gráfico:
- Série Temporal: Area Chart com gradiente (NUNCA barras)
- Múltiplas Séries: Composed Chart com Areas + Line
- Distribuição: Bar Chart horizontal
- Comparação: Bar Chart vertical

Gradientes:
- Use linearGradient com opacidade decrescente (80% → 0%)
- Cores: Blue (#0284c7), Emerald (#10b981), Purple (#7c3aed), Amber (#d97706)

Linhas de Série:
- strokeWidth: 2
- tipo: monotone (curvas suaves, não anguladas)

Grid/Tooltip:
- Grid: color #334155, strokeDasharray: 4
- Tooltip: background #1e293b, border 1px #334155, borderRadius 8px
```

---

## ✋ O que PROIBIR

```
❌ Emojis (📊, ⚡, 📈, etc) → Use Lucide Icons
❌ Preto puro (#000) → Use #0f172a
❌ Texto solto no fundo → Envolva em Card
❌ Padding irregular → Use sempre 24px
❌ Borders pesadas → Use 1px onde necessário
❌ Cores muito saturadas → Use opacidade
❌ Barras em série temporal → Use Areas com gradiente
❌ Elementos sem hover effect → Adicione transições
```

---

## ✨ Checklist para Validação

Antes de considerar uma página pronta, valide:

- [ ] Todos os containers são Cards (default/elevated/bordered)
- [ ] KPIs usam Lucide Icons (sem emojis)
- [ ] Valores principais têm font-size 2rem
- [ ] Rótulos estão em UPPERCASE com letter-spacing
- [ ] Tabelas têm Zebra Styling
- [ ] Status badges usam cores corretas (verde/vermelho)
- [ ] Gráficos são Area Charts com gradiente
- [ ] Nenhum elemento fica solto (tudo em Card)
- [ ] Padding é consistente (24px)
- [ ] Cores respeitam a paleta (nunca preto puro)
- [ ] Hover effects em todos os elementos interativos

---

## 🚀 Exemplo de Prompt Completo para IA

```
Refaça a página TemporalPage seguindo nosso Design System:

1. Use o componente Card para todos os containers
2. Crie 5 KPIs no topo com cores diferentes (Blue, Purple, Amber, Cyan, Emerald)
3. Os KPIs devem mostrar: Total, Média, Máximo, Mínimo, Tendência
4. Use Lucide Icons (BarChart3, TrendingUp, Zap, TrendingDown, ArrowUp)
5. Abaixo dos KPIs, coloque um Area Chart com gradiente
6. Na tabela de detalhes, use Zebra Styling
7. Adicione coluna Status com StatusBadge
8. Garanta que tudo está dentro de Cards
9. Use as cores da paleta (nunca preto puro)
10. Validar que nenhum elemento fica solto
```

---

**Última atualização**: 2026-04-20  
**Versão**: 1.0
