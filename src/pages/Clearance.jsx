import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Package, Clock, TrendingDown, Check, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

const workflowStates = ['proposed', 'in_clearance', 'cleared'];
const workflowLabels = {
  proposed: 'Proposed',
  in_clearance: 'In Clearance',
  cleared: 'Cleared'
};

export default function Clearance() {
  const { clearanceStock, filteredProducts } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [productStates, setProductStates] = useState({});

  const getProductState = (id) => productStates[id] || 'proposed';
  const advanceState = (id) => {
    const currentState = getProductState(id);
    const currentIdx = workflowStates.indexOf(currentState);
    if (currentIdx < workflowStates.length - 1) {
      setProductStates(prev => ({
        ...prev,
        [id]: workflowStates[currentIdx + 1]
      }));
    }
  };

  const displayProducts = clearanceStock.filter(p => {
    if (statusFilter === 'all') return true;
    return getProductState(p.id) === statusFilter;
  });

  const getSuggestedExitPrice = (product) => {
    const discount = product.daysSinceLastSale > 60 ? 0.4 : product.daysSinceLastSale > 30 ? 0.25 : 0.15;
    return product.bbCurrent * (1 - discount);
  };

  const stateCounts = {
    proposed: clearanceStock.filter(p => getProductState(p.id) === 'proposed').length,
    in_clearance: clearanceStock.filter(p => getProductState(p.id) === 'in_clearance').length,
    cleared: clearanceStock.filter(p => getProductState(p.id) === 'cleared').length
  };

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
      key: 'stockQty',
      label: 'Stock',
      render: (val) => (
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400" />
          <span className="font-mono">{val}</span>
        </div>
      )
    },
    {
      key: 'daysSinceLastSale',
      label: 'Days No Sale',
      render: (val) => (
        <Badge variant={val > 60 ? 'danger' : val > 30 ? 'warning' : 'neutral'}>
          {val} days
        </Badge>
      )
    },
    {
      key: 'profitUnit',
      label: 'Profit/Unit',
      render: (val) => (
        <span className={`font-mono ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          €{val.toFixed(2)}
        </span>
      )
    },
    {
      key: 'bbCurrent',
      label: 'Current Price',
      render: (val) => <span className="font-mono">€{val.toFixed(2)}</span>
    },
    {
      key: 'exitPrice',
      label: 'Exit Price',
      render: (_, row) => (
        <span className="font-mono text-amazon-orange">€{getSuggestedExitPrice(row).toFixed(2)}</span>
      )
    },
    {
      key: 'state',
      label: 'Status',
      render: (_, row) => {
        const state = getProductState(row.id);
        return (
          <Badge variant={state === 'cleared' ? 'success' : state === 'in_clearance' ? 'warning' : 'danger'}>
            {workflowLabels[state]}
          </Badge>
        );
      }
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => {
        const state = getProductState(row.id);
        if (state === 'cleared') return null;
        return (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              advanceState(row.id);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dashboard-hover text-slate-300 hover:bg-amazon-orange hover:text-white transition-colors text-lg font-light"
          >
            {state === 'proposed' ? 'Start Clearance' : 'Mark Cleared'}
            <ArrowRight className="w-4 h-4" />
          </button>
        );
      }
    }
  ];

  return (
    <div id="clearance-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Clearance Management</h1>
          <p className="text-lg font-light text-slate-400 mt-1">
            {clearanceStock.length} products requiring attention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-medium text-white">Proposed</h3>
          </div>
          <p className="text-4xl font-mono text-red-400">{stateCounts.proposed}</p>
          <p className="text-lg font-light text-slate-400 mt-1">Awaiting action</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <TrendingDown className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-medium text-white">In Clearance</h3>
          </div>
          <p className="text-4xl font-mono text-yellow-400">{stateCounts.in_clearance}</p>
          <p className="text-lg font-light text-slate-400 mt-1">Price reduced</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-green-500/10 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <Check className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-medium text-white">Cleared</h3>
          </div>
          <p className="text-4xl font-mono text-green-400">{stateCounts.cleared}</p>
          <p className="text-lg font-light text-slate-400 mt-1">Stock resolved</p>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-dashboard-card rounded-lg p-1 border border-dashboard-border">
          {['all', ...workflowStates].map(state => (
            <button
              key={state}
              onClick={() => setStatusFilter(state)}
              className={`px-4 py-2 rounded-md text-lg font-light transition-colors ${
                statusFilter === state
                  ? 'bg-amazon-orange text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {state === 'all' ? 'All' : workflowLabels[state]}
              {state !== 'all' && (
                <span className="ml-2 text-lg opacity-60">({stateCounts[state]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={displayProducts}
        defaultSortKey="daysSinceLastSale"
        emptyMessage="No products in clearance status."
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dashboard-card rounded-xl border border-dashboard-border p-6"
      >
        <h3 className="text-xl font-medium text-white mb-4">Clearance Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <p className="text-lg font-medium text-white">30-60 days no sales</p>
            </div>
            <p className="text-lg font-light text-slate-400">
              Consider 15-25% price reduction. Monitor competitor pricing.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <p className="text-lg font-medium text-white">60-90 days no sales</p>
            </div>
            <p className="text-lg font-light text-slate-400">
              Apply 25-40% discount. Consider bundling or FBA removal.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <p className="text-lg font-medium text-white">90+ days no sales</p>
            </div>
            <p className="text-lg font-light text-slate-400">
              Aggressive pricing or removal. Calculate storage fees vs loss.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
