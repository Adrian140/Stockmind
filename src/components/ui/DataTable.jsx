import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

export default function DataTable({ 
  columns, 
  data, 
  onRowClick,
  defaultSortKey,
  defaultSortDir = 'desc',
  emptyMessage = 'No data available',
  pageSize = 50
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pagedData = sortedData.slice(startIdx, endIdx);

  if (data.length === 0) {
    return (
      <div className="bg-dashboard-card rounded-xl border border-dashboard-border p-12 text-center">
        <p className="text-lg font-light text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-card rounded-xl border border-dashboard-border overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dashboard-border bg-dashboard-bg/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left text-lg font-light text-slate-400 whitespace-nowrap',
                    col.sortable !== false && 'cursor-pointer hover:text-white transition-colors'
                  )}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable !== false && (
                      sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronsUpDown className="w-4 h-4 opacity-40" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, idx) => (
              <motion.tr
                key={row.id || `${safePage}-${idx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'border-b border-dashboard-border last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-dashboard-hover'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-4 text-lg font-light text-slate-300 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-dashboard-border">
          <div className="text-sm text-slate-400">
            {startIdx + 1}-{Math.min(endIdx, sortedData.length)} of {sortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 rounded-md text-sm text-slate-300 bg-dashboard-bg border border-dashboard-border disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-slate-400">
              Page {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 rounded-md text-sm text-slate-300 bg-dashboard-bg border border-dashboard-border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
