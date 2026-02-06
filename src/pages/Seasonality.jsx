import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Badge from '../components/ui/Badge';
import ChartCard from '../components/ui/ChartCard';
import SeasonalityHeatmap from '../components/charts/SeasonalityHeatmap';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Seasonality() {
  const { seasonalWinners, filteredProducts } = useApp();
  const [selectedProduct, setSelectedProduct] = useState(seasonalWinners[0] || null);
  const currentMonth = new Date().getMonth();
  const reorderWindow = filteredProducts.filter(p => {
    if (!p.peakMonths) return false;
    return p.peakMonths.some(peak => {
      const monthsUntilPeak = (peak - 1 - currentMonth + 12) % 12;
      return monthsUntilPeak >= 6 && monthsUntilPeak <= 8;
    });
  });

  const getRecurringWinners = () => {
    return filteredProducts.filter(p => {
      if (!p.salesHistory) return false;
      const avgUnits = p.salesHistory.reduce((sum, m) => sum + m.units, 0) / 12;
      const peakMonths = p.salesHistory.filter(m => m.units > avgUnits * 1.5);
      return peakMonths.length >= 2;
    });
  };

  const recurringWinners = getRecurringWinners();

  return (
    <div id="seasonality-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Seasonality Analysis</h1>
          <p className="text-lg font-light text-slate-400 mt-1">
            Identify peak periods and optimize reorder timing
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amazon-orange/20">
              <TrendingUp className="w-5 h-5 text-amazon-orange" />
            </div>
            <div>
              <h3 className="text-xl font-medium text-white">Seasonal Winners</h3>
              <p className="text-lg font-light text-slate-400">Upcoming peak periods</p>
            </div>
          </div>
          <p className="text-4xl font-mono text-amazon-orange">{seasonalWinners.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Calendar className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-medium text-white">Recurring Winners</h3>
              <p className="text-lg font-light text-slate-400">Annual pattern products</p>
            </div>
          </div>
          <p className="text-4xl font-mono text-green-400">{recurringWinners.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-medium text-white">Reorder Window</h3>
              <p className="text-lg font-light text-slate-400">6-8 weeks before peak</p>
            </div>
          </div>
          <p className="text-4xl font-mono text-blue-400">{reorderWindow.length}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard 
          title="Seasonality Heatmap" 
          subtitle={selectedProduct ? selectedProduct.title : 'Select a product'}
        >
          {selectedProduct ? (
            <SeasonalityHeatmap product={selectedProduct} />
          ) : (
            <p className="text-lg font-light text-slate-400 py-12 text-center">
              Select a product to view its seasonality pattern
            </p>
          )}
        </ChartCard>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Recurring Winners</h3>
          <div className="bg-dashboard-card rounded-xl border border-dashboard-border divide-y divide-dashboard-border max-h-[400px] overflow-y-auto custom-scrollbar">
            {recurringWinners.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedProduct(product)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedProduct?.id === product.id 
                    ? 'bg-amazon-orange/10' 
                    : 'hover:bg-dashboard-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-light text-white truncate">{product.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-light text-slate-400">{product.brand}</span>
                      <span className="text-slate-600">•</span>
                      <div className="flex gap-1">
                        {product.peakMonths?.slice(0, 3).map(m => (
                          <Badge key={m} variant="orange">{shortMonths[m - 1]}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <ChartCard title="Reorder Calendar" subtitle="Products needing reorder 6-8 weeks before peak">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {monthNames.map((month, idx) => {
            const productsThisMonth = reorderWindow.filter(p => 
              p.peakMonths?.some(peak => {
                const reorderMonth = (peak - 2 + 12) % 12;
                return reorderMonth === idx;
              })
            );
            const isCurrentMonth = idx === currentMonth;
            const hasProducts = productsThisMonth.length > 0;

            return (
              <motion.div
                key={month}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className={`p-3 rounded-lg text-center transition-all ${
                  isCurrentMonth 
                    ? 'bg-amazon-orange/20 border-2 border-amazon-orange' 
                    : hasProducts
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'bg-dashboard-bg border border-dashboard-border'
                }`}
              >
                <p className={`text-lg font-light ${isCurrentMonth ? 'text-amazon-orange' : 'text-slate-400'}`}>
                  {shortMonths[idx]}
                </p>
                {hasProducts && (
                  <p className="text-xl font-mono text-blue-400 mt-1">{productsThisMonth.length}</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {reorderWindow.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-lg font-medium text-white">Products to Reorder Now</h4>
            <div className="flex flex-wrap gap-2">
              {reorderWindow.slice(0, 8).map(p => (
                <Badge key={p.id} variant="info">{p.title.substring(0, 30)}...</Badge>
              ))}
              {reorderWindow.length > 8 && (
                <Badge variant="neutral">+{reorderWindow.length - 8} more</Badge>
              )}
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
