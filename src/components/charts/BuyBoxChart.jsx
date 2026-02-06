import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { buyBoxTrend } from '../../data/mockData';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
        <p className="text-lg font-light text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-medium text-white">
          €{payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function BuyBoxChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={buyBoxTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={14} />
        <YAxis stroke="#64748b" fontSize={14} domain={['dataMin - 1', 'dataMax + 1']} />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="avg" 
          stroke="#22c55e" 
          strokeWidth={2}
          dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
