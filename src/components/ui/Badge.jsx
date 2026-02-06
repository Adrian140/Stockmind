import React from 'react';
import clsx from 'clsx';

const variants = {
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  orange: 'bg-amazon-orange/20 text-amazon-orange border-amazon-orange/30'
};

export default function Badge({ children, variant = 'neutral', className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-1 rounded-full text-lg font-light border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
