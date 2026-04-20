import React from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  children,
  accentColor = 'blue',
  size = 'medium',
  loading = false,
}: ChartCardProps) {
  const accentMap = {
    blue: { bar: 'bg-blue-500' },
    purple: { bar: 'bg-purple-500' },
    emerald: { bar: 'bg-emerald-500' },
    amber: { bar: 'bg-amber-500' },
    cyan: { bar: 'bg-cyan-500' },
  };

  const sizeClasses = {
    small: 'h-64',
    medium: 'h-80',
    large: 'h-96',
  };

  const accent = accentMap[accentColor];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-1 h-6 ${accent.bar} rounded-full`}></div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-400 ml-4">{subtitle}</p>}
      </div>

      <div className={`p-6 ${sizeClasses[size]} ${loading ? 'flex items-center justify-center' : ''}`}>
        {loading ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-2"></div>
            <p className="text-slate-400 text-sm">Carregando...</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// Grid of chart cards - responsive layout
export function ChartGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div
      className={`grid grid-cols-1 ${cols === 2 ? 'lg:grid-cols-2' : ''} gap-6`}
    >
      {children}
    </div>
  );
}

// Info Grid - For displaying key information in mini cards
interface InfoGridItemProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan' | 'red';
}

export function InfoGridItem({
  label,
  value,
  unit,
  icon,
  accentColor = 'blue',
}: InfoGridItemProps) {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' },
  };

  const color = colorMap[accentColor];

  return (
    <div className={`${color.bg} border ${color.border} rounded-lg p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <p className={`text-xs font-bold ${color.text} uppercase tracking-wider`}>{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {unit && <p className="text-xs text-slate-400 mt-1">{unit}</p>}
    </div>
  );
}

export function InfoGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan' | 'red';
  }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item, idx) => (
        <InfoGridItem key={idx} {...item} />
      ))}
    </div>
  );
}
