import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'bordered';
}

/**
 * Card Component - Base container for all dashboard elements
 * 
 * Design System Rule:
 * - Fundo: #1e293b (slate-800)
 * - Borda: 1px sólida #334155 (slate-700)
 * - Border Radius: 12px
 * - Padding: 24px (sempre)
 */
export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  variant = 'default' 
}) => {
  const baseStyles = 'rounded-xl p-6 backdrop-blur-sm transition-all duration-300';
  
  const variants = {
    default: 'bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/80 hover:shadow-lg',
    elevated: 'bg-slate-800/80 border border-slate-700 shadow-xl hover:shadow-2xl',
    bordered: 'bg-transparent border-2 border-slate-700 hover:border-slate-600',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
