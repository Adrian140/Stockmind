import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Filter, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

export default function RecommendationsTable() {
  const { buyRecommendations, settings } = useApp();
  const [quickFilter, setQuickFilter] = useState('all');

  const filteredData = buyRecommendations.filter(p => {
    if (quickFilter === 'highRoi') return p.roi >= 40;
    if (quickFilter === 'highVolume') return p.units30d >= 200;
    if (quickFilter === 'lowVolatility') return p.volatility30d <= 0.10;
    return true;
  });

  const columns = [
    {
      key: 'title',
      label: 'Product',
      render: (val, row) => (
        <div className="max-w-xs">
          <p className="text-lg font-light text-white truncate">{val}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-mono text-slate-500">{row.asin}</span>
            <span className="text-lg font-light text-slate-500">• {row.brand}</span>
          </div>
        </div>
      )
    },
    {
      key: 'units30d',
      label: 'Sales 30d',
      render: (val) => <span className="font-mono">{val.toLocaleString()}</span>
    },
    {
      key: 'cogs',
      label: 'Cost/Unit',
      render: (val) => <span className="font-mono">€{val.toFixed(2)}</span>
    },
    {
      key: 'bbAvg7d',
      label: 'Avg BB 7d',
      render: (val) => <span className="font-mono text-green-400">€{val.toFixed(2)}</span>
    },
    {
      key: 'profitUnit',
      label: 'Est. Profit/U',
      render: (val) => (
        <span className={`font-mono ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          €{val.toFixed(2)}
        </span>
      )
    },
    {
      key: 'roi',
      label: 'ROI',
      render: (val) => (
        <Badge variant={val >= 40 ? 'success' : val >= settings.minRoi ? 'warning' : 'danger'}>
          {val.toFixed(1)}%
        </Badge>
      )
    },
    {
      key: 'volatility30d',
      label: 'Volatility',
      render: (val) => (
        <span className={`font-mono ${val <= 0.10 ? 'text-green-400' : val <= 0.20 ? 'text-yellow-400' : 'text-red-400'}`}>
          {(val * 100).toFixed(1)}%
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amazon-orange/20 text-amazon-orange hover:bg-amazon-orange hover:text-white transition-colors text-lg font-light">
          <ShoppingCart className="w-4 h-4" />
          Reorder
        </button>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-white">Buy Recommendations</h3>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-1 bg-dashboard-card rounded-lg p-1 border border-dashboard-border">
            {[
              { id: 'all', label: 'All' },
              { id: 'highRoi', label: 'High ROI' },
              { id: 'highVolume', label: 'High Volume' },
              { id: 'lowVolatility', label: 'Stable' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setQuickFilter(filter.id)}
                className={`px-3 py-1.5 rounded-md text-lg font-light transition-colors ${
                  quickFilter === filter.id
                    ? 'bg-amazon-orange text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredData}
        defaultSortKey="roi"
        emptyMessage="No products meet current recommendation criteria. Adjust thresholds in settings."
      />
    </motion.div>
  );
}
