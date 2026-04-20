import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'red';
  trend?: { value: number; isPositive: boolean };
}

/**
 * KPI Component - Hierarchical metric display
 * 
 * Design System Rules:
 * - Ícone vetorial à esquerda (Lucide Icons)
 * - Valor principal: font-size: 2rem (text-4xl), font-weight: 700
 * - Rótulo: color: #94a3b8 (slate-400), font-size: 0.875rem
 * - Sem emojis - usar apenas Lucide Icons
 */
export const KPI: React.FC<KPIProps> = ({ 
  icon: Icon, 
  label, 
  value, 
  subtext,
  color = 'blue',
  trend
}) => {
  const colorMap = {
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    amber: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    red: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  };

  const { icon: iconColor, bg, border } = colorMap[color];

  return (
    <div className={`${bg} ${border} border rounded-lg p-5 shadow-md hover:shadow-lg transition-all`}>
      <div className="flex items-center gap-4 mb-3">
        <Icon className={`${iconColor} w-6 h-6`} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      
      <div className="flex items-baseline justify-between">
        <p className="text-4xl font-bold text-white">{value}</p>
        {trend && (
          <div className={`text-sm font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      
      {subtext && (
        <p className="text-xs text-slate-500 mt-2">{subtext}</p>
      )}
    </div>
  );
};

export default KPI;
