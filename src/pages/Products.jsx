import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Tag, X, Edit2, ExternalLink, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import ChartCard from '../components/ui/ChartCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchMetricsByDateRange } from '../services/sellerboardDaily.service';

const statusColors = {
  active: 'success',
  clearance: 'danger',
  watchlist: 'warning',
  paused: 'neutral'
};

export default function Products() {
  const { user } = useAuth();
  const { filteredProducts, categories, selectedMarketplace } = useApp();
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unitRangeKey, setUnitRangeKey] = useState('90d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [rangeMetricsMap, setRangeMetricsMap] = useState({});
  const [rangeLoading, setRangeLoading] = useState(false);

  const unitRanges = [
    { key: '30d', label: '30D', days: 30 },
    { key: '60d', label: '60D', days: 60 },
    { key: '90d', label: '90D', days: 90 },
    { key: '365d', label: '365D', days: 365 },
    { key: 'all', label: 'All Time', days: null },
    { key: 'custom', label: 'Custom', days: null }
  ];

  const unitRangeLabel = unitRanges.find(r => r.key === unitRangeKey)?.label || '30D';

  const allTags = [...new Set(filteredProducts.flatMap(p => p.tags || []))];

  const displayProducts = filteredProducts.filter(p => {
    const term = search.trim().toLowerCase();
    const searchMatch = !term || Object.values(p).some((val) => {
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) {
        return val.join(" ").toLowerCase().includes(term);
      }
      if (typeof val === "object") return false;
      return String(val).toLowerCase().includes(term);
    });
    const tagMatch = !tagFilter || (p.tags && p.tags.includes(tagFilter));
    return searchMatch && tagMatch;
  });

  const normalizeKey = (sku, asin) => (sku || asin || '').trim();

  const resolveMetricsForRow = (row) => {
    const fallbacks = {
      units: 0,
      revenue: 0,
      profit: 0,
      profitUnit: 0,
      volatility: 0
    };

    const keyBase = normalizeKey(row.sku, row.asin);
    if (!keyBase) return fallbacks;

    if (row.marketplace === 'ALL' && Array.isArray(row.sourceMarketplaces)) {
      return row.sourceMarketplaces.reduce((acc, mp) => {
        const key = `${keyBase}|${mp}`;
        const metrics = rangeMetricsMap[key];
        if (!metrics) return acc;
        acc.units += metrics.units || 0;
        acc.revenue += metrics.revenue || 0;
        acc.profit += metrics.profit || 0;
        acc.profitUnit = acc.units > 0 ? acc.profit / acc.units : 0;
        acc.volatility = Math.max(acc.volatility, metrics.volatility || 0);
        return acc;
      }, { ...fallbacks });
    }

    const key = `${keyBase}|${(row.marketplace || '').toUpperCase()}`;
    return rangeMetricsMap[key] || fallbacks;
  };

  const displayProductsWithUnits = useMemo(() => {
    return displayProducts.map(p => ({
      ...p,
      ...(() => {
        const metrics = resolveMetricsForRow(p);
        return {
          unitsSelected: metrics.units,
          profitSelected: metrics.profit,
          profitUnitSelected: metrics.profitUnit,
          volatilitySelected: metrics.volatility
        };
      })()
    }));
  }, [displayProducts, unitRangeKey, rangeMetricsMap]);

  useEffect(() => {
    if (!user) return;

    const load = async ({ startDate, endDate }) => {
      try {
        setRangeLoading(true);
        if (!startDate || !endDate) {
          setRangeMetricsMap({});
          return;
        }

        const result = await fetchMetricsByDateRange({
          userId: user.id,
          startDate,
          endDate,
          marketplace: selectedMarketplace === 'all' ? null : selectedMarketplace
        });
        setRangeMetricsMap(result || {});
      } catch (error) {
        console.error("❌ Failed to load range units:", error);
        setRangeMetricsMap({});
      } finally {
        setRangeLoading(false);
      }
    };

    if (unitRangeKey === 'custom') {
      if (customStart && customEnd) {
        load({ startDate: new Date(customStart), endDate: new Date(customEnd) });
      } else {
        setRangeMetricsMap({});
      }
      return;
    }

    const now = new Date();
    let days = 30;
    if (unitRangeKey === '60d') days = 60;
    if (unitRangeKey === '90d') days = 90;
    if (unitRangeKey === '365d') days = 365;
    if (unitRangeKey === 'all') {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 10);
      const end = now;
      load({ startDate: start, endDate: end });
      return;
    }
    const endDate = now;
    const startDate = new Date(now);
    startDate.setDate(endDate.getDate() - days);
    load({ startDate, endDate });
  }, [unitRangeKey, customStart, customEnd, selectedMarketplace, user]);

  const formatUnits = (val, { dashOnZero = false, muted = false } = {}) => {
    const hasValue = val !== undefined && val !== null && (!dashOnZero || val > 0);
    const text = hasValue ? val.toLocaleString() : '-';
    const className = clsx('font-mono', muted && !hasValue ? 'text-slate-500' : '');
    return <span className={className}>{text}</span>;
  };

  const columns = [
    {
      key: 'imageUrl',
      label: 'Image',
      sortable: false,
      render: (val, row) => (
        <div className="w-12 h-12 rounded-lg bg-dashboard-bg border border-dashboard-border overflow-hidden flex items-center justify-center">
          {val ? (
            <img src={val} alt={row.title || "Product"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-700/40" />
          )}
        </div>
      )
    },
    {
      key: 'title',
      label: 'Product',
      render: (val, row) => (
        <div className="max-w-xs">
          <p className="text-lg font-light text-white truncate">{val}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-lg font-mono text-slate-500">{row.asin || "-"}</span>
              <span className="text-sm font-mono text-slate-500">{row.sku || "-"}</span>
              {row.sourceMarketplaces?.length > 0 && (
                <span className="text-xs font-mono text-slate-500">
                  {row.sourceMarketplaces.join(", ")}
                </span>
              )}
            </div>
            <div className="text-sm font-mono text-slate-400">
              COGS: €{row.cogs !== undefined && row.cogs !== null ? row.cogs.toFixed(2) : "0.00"}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'unitsSelected',
      label: `Units ${unitRangeLabel}`,
      render: (val) => formatUnits(val, { dashOnZero: true, muted: unitRangeKey !== '30d' })
    },
    {
      key: 'profitSelected',
      label: 'Profit',
      render: (_, row) => {
        const profit = row.profitSelected !== undefined && row.profitSelected !== null ? row.profitSelected : 0;
        return (
          <span className={`font-mono ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            €{profit.toLocaleString()}
          </span>
        );
      }
    },
    {
      key: 'bbCurrent',
      label: 'BB Current',
      render: (val) => <span className="font-mono text-green-400">€{val !== undefined && val !== null ? val.toFixed(2) : '0.00'}</span>
    },
    {
      key: 'bbAvg30d',
      label: 'BB Avg 30d',
      render: (val) => <span className="font-mono">€{val !== undefined && val !== null ? val.toFixed(2) : '0.00'}</span>
    },
    {
      key: 'profitUnitSelected',
      label: 'Est. Profit/U',
      render: (val) => {
        const profit = val !== undefined && val !== null ? val : 0;
        return (
          <span className={`font-mono ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            €{profit.toFixed(2)}
          </span>
        );
      }
    },
    {
      key: 'cogs',
      label: 'Purchase Cost',
      render: (val) => <span className="font-mono">€{val !== undefined && val !== null ? val.toFixed(2) : '0.00'}</span>
    },
    {
      key: 'volatilitySelected',
      label: 'Volatility',
      render: (val) => {
        const volatility = val !== undefined && val !== null ? val : 0;
        return (
          <span className={`font-mono ${volatility <= 0.10 ? 'text-green-400' : volatility <= 0.20 ? 'text-yellow-400' : 'text-red-400'}`}>
            {(volatility * 100).toFixed(1)}%
          </span>
        );
      }
    },
    {
      key: 'tags',
      label: 'Tags',
      sortable: false,
      render: (val) => (
        <div className="flex items-center gap-1 flex-wrap max-w-[150px]">
          {val?.slice(0, 2).map(tag => (
            <Badge key={tag} variant="info">{tag}</Badge>
          ))}
          {val?.length > 2 && (
            <span className="text-lg font-light text-slate-500">+{val.length - 2}</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div id="products-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Products</h1>
          <p className="text-lg font-light text-slate-400 mt-1">
            {displayProducts.length} products • Extended analytics view
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, ASINs, brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dashboard-card border border-dashboard-border rounded-lg pl-10 pr-4 py-3 text-lg font-light text-white placeholder:text-slate-500 focus:outline-none focus:border-amazon-orange"
          />
        </div>

        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-1 bg-dashboard-card rounded-lg p-1 border border-dashboard-border">
            <button
              onClick={() => setTagFilter('')}
              className={`px-3 py-1.5 rounded-md text-lg font-light transition-colors ${
                !tagFilter ? 'bg-amazon-orange text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {allTags.slice(0, 5).map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                className={`px-3 py-1.5 rounded-md text-lg font-light transition-colors ${
                  tagFilter === tag ? 'bg-amazon-orange text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Units Range</label>
          <select
            value={unitRangeKey}
            onChange={(e) => setUnitRangeKey(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            {unitRanges.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {unitRangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
            />
          </div>
        )}

        {(unitRangeKey === '60d' || unitRangeKey === 'custom') && rangeLoading && (
          <div className="text-sm text-slate-400">Loading range data…</div>
        )}
      </div>

      <DataTable 
        columns={columns} 
        data={displayProductsWithUnits}
        pageSize={50}
        defaultSortKey="unitsSelected"
        onRowClick={setSelectedProduct}
        emptyMessage="No products found matching your criteria."
      />

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailPanel 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductDetailPanel({ product, onClose }) {
  const [historyRange, setHistoryRange] = useState('90d');
  const historyRanges = [
    { key: '30d', label: '30D', months: 1 },
    { key: '60d', label: '60D', months: 2 },
    { key: '90d', label: '90D', months: 3 },
    { key: '365d', label: '365D', months: 12 },
    { key: 'all', label: 'All Time', months: null }
  ];

  const historyData = useMemo(() => {
    const all = product.salesHistory || [];
    if (historyRange === 'all') return all;
    const months = historyRanges.find(r => r.key === historyRange)?.months || 3;
    return all.slice(-months);
  }, [product.salesHistory, historyRange]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
          <p className="text-lg font-light text-slate-400">{label}</p>
          <p className="text-lg font-medium text-white">{payload[0].value} units</p>
        </div>
      );
    }
    return null;
  };

  const bbAvg7d = product.bbAvg7d !== undefined && product.bbAvg7d !== null ? product.bbAvg7d : product.bbAvg30d || product.bbCurrent || 0;
  const cogs = product.cogs !== undefined && product.cogs !== null ? product.cogs : 0;
  const maxBuyPrice = bbAvg7d - (bbAvg7d * 0.15 + cogs * 0.3);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-dashboard-card border-l border-dashboard-border z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-dashboard-card border-b border-dashboard-border p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-medium text-white">{product.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg font-mono text-slate-400">{product.asin}</span>
              <Badge variant={statusColors[product.status]}>{product.status}</Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dashboard-bg rounded-lg p-4">
              <p className="text-lg font-light text-slate-400">Current Buy Box</p>
              <p className="text-2xl font-mono text-green-400 mt-1">€{(product.bbCurrent || 0).toFixed(2)}</p>
            </div>
            <div className="bg-dashboard-bg rounded-lg p-4">
              <p className="text-lg font-light text-slate-400">COGS</p>
              <p className="text-2xl font-mono text-white mt-1">€{(product.cogs || 0).toFixed(2)}</p>
            </div>
            <div className="bg-dashboard-bg rounded-lg p-4">
              <p className="text-lg font-light text-slate-400">Est. Profit/Unit</p>
              <p className={`text-2xl font-mono mt-1 ${(product.profitUnit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                €{(product.profitUnit || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-dashboard-bg rounded-lg p-4">
              <p className="text-lg font-light text-slate-400">ROI</p>
              <p className="text-2xl font-mono text-amazon-orange mt-1">{(product.roi || 0).toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-amazon-orange/10 border border-amazon-orange/30 rounded-lg p-4">
            <p className="text-lg font-light text-slate-300">Max Buy Price Calculator</p>
            <p className="text-3xl font-mono text-amazon-orange mt-2">€{maxBuyPrice.toFixed(2)}</p>
            <p className="text-lg font-light text-slate-400 mt-1">
              Based on 25% target margin after fees
            </p>
          </div>

          <ChartCard title="Sales History" subtitle="Monthly units sold">
            <div className="flex items-center justify-end mb-3">
              <select
                value={historyRange}
                onChange={(e) => setHistoryRange(e.target.value)}
                className="bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
              >
                {historyRanges.map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="units" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div>
            <h3 className="text-lg font-medium text-white mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {product.tags?.map(tag => (
                <Badge key={tag} variant="info">{tag}</Badge>
              ))}
              <button className="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-slate-600 text-lg font-light text-slate-400 hover:border-amazon-orange hover:text-amazon-orange transition-colors">
                <Edit2 className="w-3 h-3" />
                Add tag
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-white mb-3">Internal Notes</h3>
            <textarea
              placeholder="Add notes about this product..."
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg p-4 text-lg font-light text-white placeholder:text-slate-500 focus:outline-none focus:border-amazon-orange resize-none h-24"
            />
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://www.amazon.de/dp/${product.asin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amazon-orange text-white hover:bg-orange-600 transition-colors text-lg font-light"
            >
              <ExternalLink className="w-4 h-4" />
              View on Amazon
            </a>
            <button className="px-4 py-2 rounded-lg border border-dashboard-border text-lg font-light text-slate-300 hover:bg-dashboard-hover transition-colors">
              Add to Watchlist
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
