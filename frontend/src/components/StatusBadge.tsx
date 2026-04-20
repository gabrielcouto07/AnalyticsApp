import React from 'react';

interface StatusBadgeProps {
  status: 'above' | 'below' | 'neutral' | 'warning' | 'success';
  label?: string;
}

/**
 * StatusBadge Component - Pílula de status com cores contextuais
 * 
 * Design System Rules:
 * - Acima (above): fundo verde opaco, texto verde brilhante
 * - Abaixo (below): fundo vermelho/laranja opaco, texto vermelho brilhante
 * - Neutral: fundo cinza
 * - Warning: fundo amarelo
 * - Success: fundo verde
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const statusMap = {
    above: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      label: 'Acima'
    },
    below: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      label: 'Abaixo'
    },
    neutral: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      label: 'Neutro'
    },
    warning: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      label: 'Aviso'
    },
    success: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      label: 'OK'
    }
  };

  const config = statusMap[status];

  return (
    <span className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.text}`} style={{backgroundColor: 'currentColor'}} />
      {label || config.label}
    </span>
  );
};

export default StatusBadge;
