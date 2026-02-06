import React from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const years = ['2022', '2023', '2024'];

export default function SeasonalityHeatmap({ product }) {
  const getIntensity = (monthIdx, yearIdx) => {
    if (!product?.salesHistory) return 0;
    const monthData = product.salesHistory[monthIdx];
    if (!monthData) return 0;
    const maxUnits = Math.max(...product.salesHistory.map(m => m.units));
    return monthData.units / maxUnits;
  };

  const getColor = (intensity) => {
    if (intensity >= 0.8) return 'bg-green-500';
    if (intensity >= 0.6) return 'bg-green-600/80';
    if (intensity >= 0.4) return 'bg-green-700/60';
    if (intensity >= 0.2) return 'bg-green-800/40';
    return 'bg-slate-700/30';
  };

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-13 gap-1">
          <div className="h-10" />
          {months.map(month => (
            <div key={month} className="h-10 flex items-center justify-center text-lg font-light text-slate-400">
              {month}
            </div>
          ))}
        </div>

        {years.map((year, yearIdx) => (
          <div key={year} className="grid grid-cols-13 gap-1 mt-1">
            <div className="h-12 flex items-center text-lg font-light text-slate-400">
              {year}
            </div>
            {months.map((_, monthIdx) => {
              const intensity = getIntensity(monthIdx, yearIdx);
              return (
                <motion.div
                  key={monthIdx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (yearIdx * 12 + monthIdx) * 0.02 }}
                  className={clsx(
                    'h-12 rounded-md cursor-pointer transition-all hover:ring-2 hover:ring-white/30',
                    getColor(intensity)
                  )}
                  title={`${months[monthIdx]} ${year}: ${Math.round(intensity * 100)}%`}
                />
              );
            })}
          </div>
        ))}

        <div className="flex items-center gap-4 mt-6">
          <span className="text-lg font-light text-slate-400">Intensity:</span>
          <div className="flex items-center gap-2">
            {['Low', '', '', '', 'High'].map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={clsx(
                  'w-6 h-6 rounded',
                  i === 0 && 'bg-slate-700/30',
                  i === 1 && 'bg-green-800/40',
                  i === 2 && 'bg-green-700/60',
                  i === 3 && 'bg-green-600/80',
                  i === 4 && 'bg-green-500'
                )} />
                {label && <span className="text-lg font-light text-slate-400">{label}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
