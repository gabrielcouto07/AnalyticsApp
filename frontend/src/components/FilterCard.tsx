import React from 'react';

interface FilterCardProps {
  children: React.ReactNode;
  title?: string;
  columns?: number;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan';
  className?: string;
}

export function FilterCard({
  children,
  title,
  columns = 5,
  accentColor = 'purple',
  className = '',
}: FilterCardProps) {
  const accentMap = {
    blue: { bar: 'bg-blue-500', accent: 'border-blue-500/30' },
    purple: { bar: 'bg-purple-500', accent: 'border-purple-500/30' },
    emerald: { bar: 'bg-emerald-500', accent: 'border-emerald-500/30' },
    amber: { bar: 'bg-amber-500', accent: 'border-amber-500/30' },
    cyan: { bar: 'bg-cyan-500', accent: 'border-cyan-500/30' },
  };

  const accent = accentMap[accentColor];

  return (
    <div
      className={`rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 md:p-8 shadow-lg hover:shadow-xl transition-all ${className}`}
    >
      {title && (
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-700/50">
          <div className={`w-1.5 h-7 ${accent.bar} rounded-full`}></div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
        {children}
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

export function SelectField({ label, value, onChange, options, disabled = false }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success';
}

export function ActionButton({
  label,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
    secondary: 'bg-slate-700 hover:bg-slate-600',
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full ${variantStyles[variant]} text-white font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
    >
      {loading ? '⏳ Carregando...' : label}
    </button>
  );
}
