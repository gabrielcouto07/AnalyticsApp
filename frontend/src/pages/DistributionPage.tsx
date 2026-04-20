import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import { DistributionAnalytics } from '../components/DistributionAnalytics';
import {
  PageLayout,
  FilterCard,
  InfoGrid,
  ChartCard,
  EmptyState,
  SelectField,
  ActionButton,
} from '../components';

export function DistributionPage() {
  const { sessionId, numericCols } = useSessionStore();
  const [col, setCol] = useState('');
  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (numericCols.length > 0 && !col) setCol(numericCols[0]);
  }, [numericCols, col]);

  const handleAnalyze = () => {
    if (col) {
      setLoading(true);
      setAnalyzed(true);
      setTimeout(() => setLoading(false), 300);
    }
  };

  const infoItems = col ? [
    { label: '📊 Variável', value: col, sublabel: 'selecionada' },
    { label: '📈 Tipo', value: 'Numérica', sublabel: 'contínua' },
    { label: '✓ Status', value: analyzed ? '✓' : '○', sublabel: analyzed ? 'analisada' : 'pronta' },
    { label: '📊 Gráficos', value: '3+', sublabel: 'visualizações' },
    { label: '⚡ Métricas', value: '8+', sublabel: 'estatísticas' },
  ] : [];

  return (
    <PageLayout icon="📉" title="Distribuição & Densidade" subtitle="Analise a distribuição, concentração e variabilidade dos seus dados">
      <FilterCard title="Seleção da Coluna" accentColor="purple">
        <SelectField
          label="Coluna Numérica"
          value={col}
          onChange={(e) => setCol(e.target.value)}
          options={[
            { value: '', label: 'Selecione...' },
            ...numericCols.map((c) => ({ value: c, label: c })),
          ]}
        />
        <ActionButton
          label={analyzed ? 'Recarregar' : 'Analisar'}
          disabled={!col}
          onClick={handleAnalyze}
          variant="purple"
        />
      </FilterCard>

      {col && (
        <InfoGrid
          items={infoItems}
          columns={5}
        />
      )}

      {!col && (
        <EmptyState
          icon="📊"
          title="Nenhuma coluna selecionada"
          description="Escolha uma coluna numérica para visualizar histogramas, densidade e estatísticas"
        />
      )}

      {sessionId && col && analyzed && !loading && (
        <ChartCard
          title="Análise Detalhada"
          subtitle={`Coluna: ${col}`}
          size="large"
        >
          <DistributionAnalytics sessionId={sessionId} />
        </ChartCard>
      )}

      {col && !analyzed && (
        <EmptyState
          icon="📈"
          title="Pronto para analisar"
          description={`Clique em "Analisar" para visualizar gráficos e estatísticas\nColuna: ${col}`}
        />
      )}
    </PageLayout>
  );
}