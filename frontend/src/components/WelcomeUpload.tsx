import { UploadZone } from './UploadZone'

const FEATURES = [
  {
    icon: '📊',
    title: 'KPIs Automáticos',
    desc: 'Extrai automaticamente métricas principais, médias e tendências dos seus dados',
  },
  {
    icon: '📈',
    title: 'Gráficos Avançados',
    desc: 'Temporal, explorador de categorias, correlação e muito mais para visualizar dados',
  },
  {
    icon: '✨',
    title: 'Análise de Qualidade',
    desc: 'Identifica nulos, duplicados, tipos de dados e problemas de integridade',
  },
]

const FORMATS = ['Excel (.xlsx)', 'Excel 97 (.xls)', 'CSV', 'TXT', 'JSON']

const STEPS = [
  { num: '1', text: 'Carregue seu arquivo' },
  { num: '2', text: 'Processamos em tempo real' },
  { num: '3', text: 'Explore insights profundos' },
]

export function WelcomeUpload() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1a1f3a] to-[#0f172a] space-y-20 py-20">
      {/* Hero Section - Premium */}
      <div className="text-center space-y-8 py-16 px-4">
        <div className="relative">
          <div className="text-9xl mb-6 animate-bounce drop-shadow-2xl" style={{ animationDelay: '0s' }}>
            📊
          </div>
          <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-primary/30 via-secondary/20 to-transparent opacity-50 -z-10" />
        </div>
        <h2 className="text-7xl font-black bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent leading-tight drop-shadow-2xl">
          Explore seus Dados com <br /> <span className="inline-block">Inteligência Artificial</span>
        </h2>
        <p className="text-2xl text-muted/90 max-w-4xl mx-auto leading-relaxed font-medium drop-shadow-lg">
          Carregue qualquer arquivo de dados e descubra padrões, tendências e correlações em tempo
          real com análise automática e visualizações avançadas.
        </p>
      </div>

      {/* Upload Zone - Premium */}
      <div className="max-w-3xl mx-auto w-full px-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/10 blur-2xl rounded-3xl" />
          <div className="relative bg-gradient-to-br from-primary/30 via-card/90 to-secondary/10 rounded-3xl p-16 border-2 border-gradient-to-r from-primary/50 to-secondary/30 shadow-2xl hover:shadow-3xl hover:border-primary/70 transition-all duration-300">
            <UploadZone />
          </div>
        </div>
      </div>

      {/* Steps - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto px-6">
        {STEPS.map((step, idx) => (
          <div key={step.num} className="text-center space-y-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary border-3 border-white/20 flex items-center justify-center mx-auto group-hover:scale-125 transition-all duration-300 shadow-xl">
                <span className="text-white font-black text-3xl">{step.num}</span>
              </div>
            </div>
            <p className="text-base text-text font-bold group-hover:text-primary transition-colors">{step.text}</p>
          </div>
        ))}
      </div>

      {/* Features - Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
        {FEATURES.map((feature, idx) => (
          <div
            key={idx}
            className="group relative bg-gradient-to-br from-card/80 via-card/60 to-card/40 rounded-2xl p-10 border border-primary/20 hover:border-primary/60 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(135deg, rgba(79, 142, 247, 0.1) 0%, transparent 100%)` }}
            />
            <div className="relative z-10">
              <div className="text-6xl mb-6 group-hover:scale-150 group-hover:-rotate-12 transition-all duration-300 inline-block">
                {feature.icon}
              </div>
              <h3 className="font-bold text-text mb-3 text-2xl group-hover:text-primary transition-colors">{feature.title}</h3>
              <p className="text-muted/80 text-sm leading-relaxed group-hover:text-muted transition-colors">{feature.desc}</p>
            </div>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ))}
      </div>

      {/* Info Section - Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto px-6">
        <div className="group relative bg-gradient-to-br from-primary/15 via-card/80 to-card/40 rounded-2xl p-12 border border-primary/30 hover:border-primary/70 transition-all shadow-2xl hover:shadow-3xl hover:shadow-primary/20">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, rgba(79, 142, 247, 0.15) 0%, transparent 100%)` }}
          />
          <div className="relative z-10">
            <h3 className="font-black text-text text-3xl mb-8 flex items-center gap-3 group-hover:text-primary transition-colors">
              <span className="text-4xl">📁</span> Formatos Suportados
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {FORMATS.map((format) => (
                <div
                  key={format}
                  className="bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/40 rounded-xl p-4 text-center text-sm text-primary font-bold hover:bg-primary/40 hover:border-primary/70 hover:scale-105 transition-all cursor-pointer shadow-lg"
                >
                  {format}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="group relative bg-gradient-to-br from-success/15 via-card/80 to-card/40 rounded-2xl p-12 border border-success/30 hover:border-success/70 transition-all shadow-2xl hover:shadow-3xl hover:shadow-success/20">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, rgba(52, 201, 126, 0.15) 0%, transparent 100%)` }}
          />
          <div className="relative z-10">
            <h3 className="font-black text-text text-3xl mb-8 flex items-center gap-3 group-hover:text-success transition-colors">
              <span className="text-4xl">⚡</span> Capacidades
            </h3>
            <ul className="space-y-4 text-base text-muted/80">
              <li className="flex gap-4 items-start group/item">
                <span className="text-success text-2xl font-bold flex-shrink-0 group-hover/item:scale-125 transition-transform">✓</span>
                <span className="group-hover/item:text-muted transition-colors">Processa até 100K+ linhas instantaneamente</span>
              </li>
              <li className="flex gap-4 items-start group/item">
                <span className="text-success text-2xl font-bold flex-shrink-0 group-hover/item:scale-125 transition-transform">✓</span>
                <span className="group-hover/item:text-muted transition-colors">Detecção automática de tipos de dados</span>
              </li>
              <li className="flex gap-4 items-start group/item">
                <span className="text-success text-2xl font-bold flex-shrink-0 group-hover/item:scale-125 transition-transform">✓</span>
                <span className="group-hover/item:text-muted transition-colors">Gráficos interativos e responsivos</span>
              </li>
              <li className="flex gap-4 items-start group/item">
                <span className="text-success text-2xl font-bold flex-shrink-0 group-hover/item:scale-125 transition-transform">✓</span>
                <span className="group-hover/item:text-muted transition-colors">Exportar resultados em Excel/CSV</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Note - Premium */}
      <div className="relative text-center py-12 border-t border-primary/20 max-w-4xl mx-auto px-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <p className="text-muted/70 text-sm font-semibold flex items-center justify-center gap-2">
          <span className="text-lg">🔒</span> Todos os dados são processados localmente. Nenhum dado é armazenado ou enviado para servidores externos.
        </p>
      </div>
    </div>
  )
}
