import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Badge from '../ui/Badge';

export default function ClearanceAlerts() {
  const { clearanceStock } = useApp();
  const items = clearanceStock.slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="bg-dashboard-card rounded-xl border border-dashboard-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-xl font-medium text-white">Clearance Alerts</h3>
        </div>
        <p className="text-lg font-light text-slate-400">No items requiring clearance attention.</p>
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
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h3 className="text-xl font-medium text-white">Clearance Alerts</h3>
      </div>

      <div className="space-y-3">
        {items.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-lg font-light text-white truncate">{product.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="text-lg font-light text-slate-400">{product.stockQty} units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {product.daysSinceLastSale > 0 && (
                <Badge variant="danger">
                  {product.daysSinceLastSale}d no sales
                </Badge>
              )}
              {product.profitUnit < 0 && (
                <Badge variant="danger">
                  -€{Math.abs(product.profitUnit).toFixed(2)}/u
                </Badge>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
