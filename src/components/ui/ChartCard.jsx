import React from 'react';
import { motion } from 'motion/react';

export default function ChartCard({ title, subtitle, children, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-medium text-white">{title}</h3>
          {subtitle && <p className="text-lg font-light text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}
