import React from 'react';
import { motion } from 'motion/react';
import { Calendar, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Badge from '../ui/Badge';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SeasonalProducts() {
  const { seasonalWinners } = useApp();
  const items = seasonalWinners.slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="bg-dashboard-card rounded-xl border border-dashboard-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-amazon-orange" />
          <h3 className="text-xl font-medium text-white">Upcoming Seasonal Products</h3>
        </div>
        <p className="text-lg font-light text-slate-400">No seasonal products found for upcoming months.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-5 h-5 text-amazon-orange" />
        <h3 className="text-xl font-medium text-white">Upcoming Seasonal Products</h3>
      </div>

      <div className="space-y-3">
        {items.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center justify-between p-3 rounded-lg bg-dashboard-bg/50 hover:bg-dashboard-hover transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-lg font-light text-white truncate">{product.title}</p>
              <p className="text-lg font-light text-slate-400">{product.brand}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {product.peakMonths?.slice(0, 2).map(month => (
                <Badge key={month} variant="orange">
                  {monthNames[month - 1]}
                </Badge>
              ))}
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
