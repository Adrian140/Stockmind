import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

export default function DataTable({ 
  columns, 
  data, 
  onRowClick,
  defaultSortKey,
  defaultSortDir = 'desc',
  emptyMessage = 'No data available'
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultSortDir);

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
            {sortedData.map((row, idx) => (
              <motion.tr
                key={row.id || idx}
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
    </div>
  );
}
