import { UploadZone } from './UploadZone'
import { tokens } from '../lib'

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
    <div 
      className="min-h-screen space-y-20 py-20"
      style={{ backgroundColor: tokens.colors.surface }}
    >
      {/* Hero Section - Premium */}
      <div className="text-center space-y-8 py-16 px-4">
        <div className="relative">
          <div className="text-9xl mb-6 animate-bounce drop-shadow-2xl" style={{ animationDelay: '0s' }}>
            📊
          </div>
          <div className="absolute inset-0 blur-3xl opacity-50 -z-10"
            style={{ background: `linear-gradient(to right, ${tokens.colors.primary}40, ${tokens.colors.secondary}20, transparent)` }}
          />
        </div>
        <h2 className="text-7xl font-black leading-tight drop-shadow-2xl"
          style={{
            background: `linear-gradient(to right, ${tokens.colors.primary}, ${tokens.colors.secondary}, ${tokens.colors.primary})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Explore seus Dados com <br /> <span className="inline-block">Inteligência Artificial</span>
        </h2>
        <p className="text-2xl max-w-4xl mx-auto leading-relaxed font-medium drop-shadow-lg"
          style={{ color: `${tokens.colors.muted}e6` }}
        >
          Carregue qualquer arquivo de dados e descubra padrões, tendências e correlações em tempo
          real com análise automática e visualizações avançadas.
        </p>
      </div>

      {/* Upload Zone - Premium */}
      <div className="max-w-3xl mx-auto w-full px-6">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl rounded-3xl"
            style={{ background: `linear-gradient(to right, ${tokens.colors.primary}20, ${tokens.colors.secondary}20, ${tokens.colors.primary}10)` }}
          />
          <div className="relative rounded-3xl p-16 shadow-2xl hover:shadow-3xl transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${tokens.colors.primary}30, ${tokens.colors.card}e6, ${tokens.colors.secondary}10)`,
              borderWidth: '2px',
              borderImage: `linear-gradient(to right, ${tokens.colors.primary}80, ${tokens.colors.secondary}50) 1`,
            }}
          >
            <UploadZone />
          </div>
        </div>
      </div>

      {/* Steps - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto px-6">
        {STEPS.map((step) => (
          <div key={step.num} className="text-center space-y-4 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(to right, ${tokens.colors.primary}, ${tokens.colors.secondary})` }}
              />
              <div className="relative w-20 h-20 rounded-full border-3 flex items-center justify-center mx-auto group-hover:scale-125 transition-all duration-300 shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.secondary})`,
                  borderColor: `${tokens.colors.text}33`,
                }}
              >
                <span className="font-black text-3xl" style={{ color: tokens.colors.surface }}>
                  {step.num}
                </span>
              </div>
            </div>
            <p className="text-base font-bold transition-colors group-hover:text-primary" style={{ color: tokens.colors.text }}>
              {step.text}
            </p>
          </div>
        ))}
      </div>

      {/* Features - Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.icon}
            className="group relative rounded-2xl p-10 border transition-all duration-300 hover:shadow-2xl cursor-pointer overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${tokens.colors.card}cc, ${tokens.colors.card}99, ${tokens.colors.card}66)`,
              borderColor: `${tokens.colors.primary}33`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${tokens.colors.primary}99`
              e.currentTarget.style.boxShadow = `0 0 40px ${tokens.colors.primary}33`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `${tokens.colors.primary}33`
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(135deg, ${tokens.colors.primary}15, transparent)` }}
            />
            <div className="relative z-10">
              <div className="text-6xl mb-6 group-hover:scale-150 group-hover:-rotate-12 transition-all duration-300 inline-block">
                {feature.icon}
              </div>
              <h3 className="font-bold mb-3 text-2xl group-hover:text-primary transition-colors" style={{ color: tokens.colors.text }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed transition-colors" style={{ color: `${tokens.colors.muted}cc` }}>
                {feature.desc}
              </p>
            </div>
            <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(to right, transparent, ${tokens.colors.primary}80, transparent)` }}
            />
          </div>
        ))}
      </div>

      {/* Info Section - Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto px-6">
        <div className="group relative rounded-2xl p-12 border shadow-2xl transition-all hover:shadow-3xl"
          style={{
            background: `linear-gradient(135deg, ${tokens.colors.primary}18, ${tokens.colors.card}cc, ${tokens.colors.card}66)`,
            borderColor: `${tokens.colors.primary}4d`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = `${tokens.colors.primary}b3`
            e.currentTarget.style.boxShadow = `0 0 40px ${tokens.colors.primary}33`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${tokens.colors.primary}4d`
            e.currentTarget.style.boxShadow = `0 0 0px rgba(0,0,0,0)`
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, ${tokens.colors.primary}26, transparent)` }}
          />
          <div className="relative z-10">
            <h3 className="font-black text-3xl mb-8 flex items-center gap-3 group-hover:text-primary transition-colors" style={{ color: tokens.colors.text }}>
              <span className="text-4xl">📁</span> Formatos Suportados
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {FORMATS.map((format) => (
                <div
                  key={format}
                  className="rounded-xl p-4 text-center text-sm font-bold transition-all cursor-pointer shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${tokens.colors.primary}4d, ${tokens.colors.primary}19)`,
                    border: `2px solid ${tokens.colors.primary}66`,
                    color: tokens.colors.primary,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${tokens.colors.primary}66, ${tokens.colors.primary}33)`
                    e.currentTarget.style.borderColor = `${tokens.colors.primary}b3`
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${tokens.colors.primary}4d, ${tokens.colors.primary}19)`
                    e.currentTarget.style.borderColor = `${tokens.colors.primary}66`
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {format}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="group relative rounded-2xl p-12 border shadow-2xl transition-all hover:shadow-3xl"
          style={{
            background: `linear-gradient(135deg, ${tokens.colors.success}18, ${tokens.colors.card}cc, ${tokens.colors.card}66)`,
            borderColor: `${tokens.colors.success}4d`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = `${tokens.colors.success}b3`
            e.currentTarget.style.boxShadow = `0 0 40px ${tokens.colors.success}33`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${tokens.colors.success}4d`
            e.currentTarget.style.boxShadow = `0 0 0px rgba(0,0,0,0)`
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, ${tokens.colors.success}26, transparent)` }}
          />
          <div className="relative z-10">
            <h3 className="font-black text-3xl mb-8 flex items-center gap-3 transition-colors" style={{ color: tokens.colors.text }}>
              <span className="text-4xl">⚡</span> Capacidades
            </h3>
            <ul className="space-y-4 text-base">
              {[
                'Processa até 100K+ linhas instantaneamente',
                'Detecção automática de tipos de dados',
                'Gráficos interativos e responsivos',
                'Exportar resultados em Excel/CSV',
              ].map((item) => (
                <li key={item} className="flex gap-4 items-start group/item">
                  <span className="text-2xl font-bold flex-shrink-0 transition-transform group-hover/item:scale-125" style={{ color: tokens.colors.success }}>
                    ✓
                  </span>
                  <span className="transition-colors" style={{ color: `${tokens.colors.muted}cc` }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Note - Premium */}
      <div className="relative text-center py-12 max-w-4xl mx-auto px-6"
        style={{ borderTop: `1px solid ${tokens.colors.primary}33` }}
      >
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${tokens.colors.primary}4d, transparent)` }}
        />
        <p className="text-sm font-semibold flex items-center justify-center gap-2" style={{ color: `${tokens.colors.muted}b3` }}>
          <span className="text-lg">🔒</span> Todos os dados são processados localmente. Nenhum dado é armazenado ou enviado para servidores externos.
        </p>
      </div>
    </div>
  )
}
