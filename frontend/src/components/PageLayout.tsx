import React from 'react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  showHeader?: boolean;
}

/**
 * Premium Page Layout Component
 * Provides consistent dark theme with:
 * - Navy blue background gradient
 * - Professional header section
 * - Proper spacing and padding
 * - Card-based content organization
 */
export function PageLayout({
  title,
  subtitle,
  icon,
  children,
  showHeader = true,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8">
      {showHeader && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            {icon && <span className="text-4xl">{icon}</span>}
            <h1 className="text-5xl font-bold text-white tracking-tight">{title}</h1>
          </div>
          {subtitle && <p className="text-slate-400 text-lg mt-2 ml-12">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-8">{children}</div>
    </div>
  );
}

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className = '' }: SectionProps) {
  return <div className={`space-y-6 ${className}`}>{children}</div>;
}

// Row layout - for organizing content side by side
interface RowProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  gap?: 'small' | 'medium' | 'large';
}

export function Row({ children, cols = 2, gap = 'medium' }: RowProps) {
  const gapClasses = {
    small: 'gap-4',
    medium: 'gap-6',
    large: 'gap-8',
  };

  const colsClasses = {
    1: 'grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
  };

  return (
    <div className={`grid grid-cols-1 ${colsClasses[cols]} ${gapClasses[gap]}`}>
      {children}
    </div>
  );
}

// Empty State - when no data to display
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 backdrop-blur-sm p-16 text-center">
      {icon && <div className="text-6xl mb-4 flex justify-center">{icon}</div>}
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      {description && <p className="text-slate-400 text-sm mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Loading State
export function LoadingState() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 backdrop-blur-sm p-16 flex flex-col items-center justify-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
      <p className="text-slate-300 font-medium">Carregando dados...</p>
    </div>
  );
}

// Divider
export function Divider() {
  return <div className="h-px bg-gradient-to-r from-slate-700/0 via-slate-700/50 to-slate-700/0 my-8" />;
}

// Badge - for status indicators
interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-300 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}

// Statistic row - for displaying key metrics
interface StatisticRowProps {
  icon?: string;
  label: string;
  value: string | number;
  unit?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'purple';
}

export function StatisticRow({
  icon,
  label,
  value,
  unit,
  color = 'blue',
}: StatisticRowProps) {
  const colorMap = {
    blue: 'text-blue-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    purple: 'text-purple-300',
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
      <div className="flex items-center gap-3">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className={`text-xl font-bold ${colorMap[color]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
