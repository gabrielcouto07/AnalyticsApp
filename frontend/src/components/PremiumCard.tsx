import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'gradient' | 'glass';
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan' | 'red' | 'indigo' | 'pink';
  title?: React.ReactNode;
  subtitle?: string;
  className?: string;
  showAccentBar?: boolean;
}

const accentGradients = {
  blue: {
    gradient: 'from-blue-900 to-blue-800',
    text: 'text-blue-300',
    border: 'border-blue-700',
    accent: '#3b82f6',
  },
  purple: {
    gradient: 'from-purple-900 to-purple-800',
    text: 'text-purple-300',
    border: 'border-purple-700',
    accent: '#a855f7',
  },
  emerald: {
    gradient: 'from-emerald-900 to-emerald-800',
    text: 'text-emerald-300',
    border: 'border-emerald-700',
    accent: '#10b981',
  },
  amber: {
    gradient: 'from-amber-900 to-amber-800',
    text: 'text-amber-300',
    border: 'border-amber-700',
    accent: '#f59e0b',
  },
  cyan: {
    gradient: 'from-cyan-900 to-cyan-800',
    text: 'text-cyan-300',
    border: 'border-cyan-700',
    accent: '#06b6d4',
  },
  red: {
    gradient: 'from-red-900 to-red-800',
    text: 'text-red-300',
    border: 'border-red-700',
    accent: '#ef4444',
  },
  indigo: {
    gradient: 'from-indigo-900 to-indigo-800',
    text: 'text-indigo-300',
    border: 'border-indigo-700',
    accent: '#6366f1',
  },
  pink: {
    gradient: 'from-pink-900 to-pink-800',
    text: 'text-pink-300',
    border: 'border-pink-700',
    accent: '#ec4899',
  },
};

export function PremiumCard({
  children,
  variant = 'default',
  accentColor = 'blue',
  title,
  subtitle,
  className = '',
  showAccentBar = false,
}: PremiumCardProps) {
  const accent = accentGradients[accentColor];

  const baseClasses =
    'rounded-xl border transition-all duration-300 hover:shadow-xl hover:border-opacity-100';

  const variantClasses = {
    default: `bg-slate-800/60 border-slate-700 backdrop-blur-sm ${baseClasses}`,
    elevated: `bg-gradient-to-br ${accent.gradient} ${accent.border} backdrop-blur-sm ${baseClasses}`,
    gradient: `bg-gradient-to-br from-slate-800 via-slate-800/50 to-slate-900 border-slate-700 backdrop-blur-sm ${baseClasses}`,
    glass: `bg-slate-900/40 border-slate-700/50 backdrop-blur-md ${baseClasses}`,
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {showAccentBar && (
        <div className="h-1 w-full rounded-t-xl" style={{ background: `linear-gradient(to right, ${accent.accent}, ${accent.accent}99)` }} />
      )}

      {(title || subtitle) && (
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/30">
          <div className="flex items-center gap-3 mb-2">
            {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
          </div>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}

      <div className={title || subtitle ? 'p-6' : 'p-6'}>{children}</div>
    </div>
  );
}

// KPI Card - For highlighting metrics
export function KPICardPremium({
  icon,
  label,
  value,
  unit,
  change,
  changeType = 'neutral',
  accentColor = 'blue',
  onClick,
}: {
  icon?: string;
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  accentColor?: keyof typeof accentGradients;
  onClick?: () => void;
}) {
  const accent = accentGradients[accentColor];
  const changeColor =
    changeType === 'positive' ? '#10b981' : changeType === 'negative' ? '#ef4444' : '#64748b';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-700 bg-slate-800/60 backdrop-blur-sm p-6 transition-all hover:shadow-lg hover:border-slate-600 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{icon} {label}</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-3xl font-black text-white" style={{ lineHeight: 1 }}>
          {value}
        </p>
        {unit && <p className="text-xs text-slate-500 mt-1">{unit}</p>}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-2 pt-3 border-t border-slate-700/30">
          <span style={{ color: changeColor }} className="text-xs font-bold">
            {changeType === 'positive' ? '↑' : changeType === 'negative' ? '↓' : '→'}
          </span>
          <span style={{ color: changeColor }} className="text-xs font-semibold">
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-slate-500">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}

// Stats Group - Multiple KPIs in a row
export function StatsGroup({
  stats,
}: {
  stats: Array<{
    icon?: string;
    label: string;
    value: string | number;
    unit?: string;
    accentColor?: keyof typeof accentGradients;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <KPICardPremium
          key={idx}
          icon={stat.icon}
          label={stat.label}
          value={stat.value}
          unit={stat.unit}
          accentColor={stat.accentColor || 'blue'}
        />
      ))}
    </div>
  );
}
