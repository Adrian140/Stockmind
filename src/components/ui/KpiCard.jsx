import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import clsx from 'clsx';

export default function KpiCard({ title, value, change, changeLabel, icon: Icon, to, color = 'blue' }) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    orange: 'from-amazon-orange/20 to-orange-600/10 border-amazon-orange/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30'
  };

  const iconColorClasses = {
    blue: 'text-blue-400 bg-blue-500/20',
    green: 'text-green-400 bg-green-500/20',
    orange: 'text-amazon-orange bg-amazon-orange/20',
    red: 'text-red-400 bg-red-500/20'
  };

  const Card = to ? Link : 'div';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        to={to}
        className={clsx(
          'block p-6 rounded-xl border bg-gradient-to-br transition-all duration-300',
          colorClasses[color],
          to && 'cursor-pointer hover:border-opacity-60'
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className={clsx('p-3 rounded-lg', iconColorClasses[color])}>
            <Icon className="w-6 h-6" />
          </div>
          {to && (
            <ArrowUpRight className="w-5 h-5 text-slate-400" />
          )}
        </div>

        <p className="text-lg font-light text-slate-400 mb-1">{title}</p>
        <p className="text-4xl font-mono font-medium text-white mb-3">{value}</p>

        {change !== undefined && (
          <div className="flex items-center gap-2">
            <div className={clsx(
              'flex items-center gap-1 text-lg font-light',
              isPositive && 'text-green-400',
              isNegative && 'text-red-400',
              isNeutral && 'text-slate-400'
            )}>
              {isPositive && <ArrowUpRight className="w-4 h-4" />}
              {isNegative && <ArrowDownRight className="w-4 h-4" />}
              {isNeutral && <Minus className="w-4 h-4" />}
              <span>{Math.abs(change)}%</span>
            </div>
            {changeLabel && (
              <span className="text-lg font-light text-slate-500">{changeLabel}</span>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
