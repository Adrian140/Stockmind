import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Package, TrendingDown, Check, ArrowRight, LoaderCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { productsService } from '../services/products.service';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

const workflowStates = ['proposed', 'in_clearance', 'cleared'];
const workflowLabels = {
  proposed: 'Proposed',
  in_clearance: 'In Clearance',
  cleared: 'Cleared'
};

function mapWorkflowState(status) {
  if (status === 'clearance') return 'in_clearance';
  if (status === 'archived') return 'cleared';
  return 'proposed';
}

function mapProductStatus(workflowState) {
  if (workflowState === 'in_clearance') return 'clearance';
  if (workflowState === 'cleared') return 'archived';
  return 'active';
}

export default function Clearance() {
  const { clearanceStock, refreshProducts, loadingProducts } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingIds, setPendingIds] = useState([]);

  const displayProducts = useMemo(() => {
    return clearanceStock.filter((product) => {
      if (statusFilter === 'all') return true;
      return mapWorkflowState(product.status) === statusFilter;
    });
  }, [clearanceStock, statusFilter]);

  const stateCounts = useMemo(() => ({
    proposed: clearanceStock.filter((product) => mapWorkflowState(product.status) === 'proposed').length,
    in_clearance: clearanceStock.filter((product) => mapWorkflowState(product.status) === 'in_clearance').length,
    cleared: clearanceStock.filter((product) => mapWorkflowState(product.status) === 'cleared').length
  }), [clearanceStock]);

  const getSuggestedExitPrice = (product) => {
    const discount = product.daysSinceLastSale > 60 ? 0.4 : product.daysSinceLastSale > 30 ? 0.25 : 0.15;
    return product.bbCurrent * (1 - discount);
  };

  const updateWorkflowState = async (row, nextState) => {
    const ids = Array.isArray(row.sourceProductIds) && row.sourceProductIds.length > 0 ? row.sourceProductIds : [row.id];
    const userId = row.userId;
    if (!userId) return;

    setPendingIds((current) => [...current, ...ids]);
    try {
      await Promise.all(ids.map((productId) =>
        productsService.updateProduct(productId, userId, { status: mapProductStatus(nextState) })
      ));
      await refreshProducts();
    } finally {
      setPendingIds((current) => current.filter((id) => !ids.includes(id)));
    }
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
          <span className="font-mono">{val || 0}</span>
        </div>
      )
    },
    {
      key: 'daysSinceLastSale',
      label: 'Days No Sale',
      render: (val) => (
        <Badge variant={val > 60 ? 'danger' : val > 30 ? 'warning' : 'neutral'}>
          {val || 0} days
        </Badge>
      )
    },
    {
      key: 'profitUnit',
      label: 'Profit/Unit',
      render: (val) => (
        <span className={`font-mono ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          €{Number(val || 0).toFixed(2)}
        </span>
      )
    },
    {
      key: 'bbCurrent',
      label: 'Current Price',
      render: (val) => <span className="font-mono">€{Number(val || 0).toFixed(2)}</span>
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
        const state = mapWorkflowState(row.status);
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
        const state = mapWorkflowState(row.status);
        if (state === 'cleared') return null;

        const nextState = state === 'proposed' ? 'in_clearance' : 'cleared';
        const isPending = pendingIds.includes(row.id) || (Array.isArray(row.sourceProductIds) && row.sourceProductIds.some((id) => pendingIds.includes(id)));

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateWorkflowState(row, nextState);
            }}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dashboard-hover text-slate-300 hover:bg-amazon-orange hover:text-white transition-colors text-lg font-light disabled:opacity-50 disabled:cursor-not-allowed"
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
            {clearanceStock.length} in-stock products requiring attention
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
          <p className="text-lg font-light text-slate-400 mt-1">Persisted in products.status</p>
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
          <p className="text-lg font-light text-slate-400 mt-1">Archived from clearance queue</p>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-dashboard-card rounded-lg p-1 border border-dashboard-border">
          {['all', ...workflowStates].map((state) => (
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
        data={loadingProducts ? [] : displayProducts}
        defaultSortKey="daysSinceLastSale"
        emptyMessage={
          loadingProducts ? (
            <div className="flex min-h-[120px] items-center justify-center gap-3 text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin text-amazon-orange" />
              <span>Se încarcă produsele și stocurile Sellerboard...</span>
            </div>
          ) : "No products in clearance status."
        }
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
              Consider 15-25% price reduction. Candidates are limited to products with Amazon stock and real Sellerboard sales history.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <p className="text-lg font-medium text-white">60-90 days no sales</p>
            </div>
            <p className="text-lg font-light text-slate-400">
              Use stronger discounting. Workflow state now persists in the `products` table.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <p className="text-lg font-medium text-white">Negative profit or stale demand</p>
            </div>
            <p className="text-lg font-light text-slate-400">
              Products appear here only if they still have stock and also have negative unit profit or stale demand.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
