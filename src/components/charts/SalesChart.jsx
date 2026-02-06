import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { salesPerformance } from '../../data/mockData';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
        <p className="text-lg font-light text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-medium text-white">
          {payload[0].value.toLocaleString()} units
        </p>
        <p className="text-lg font-light text-amazon-orange">
          €{payload[1]?.value?.toLocaleString() || 0}
        </p>
      </div>
    );
  }
  return null;
};

export default function SalesChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={salesPerformance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF9900" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#FF9900" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#64748b" fontSize={14} />
        <YAxis stroke="#64748b" fontSize={14} />
        <Tooltip content={<CustomTooltip />} />
        <Area 
          type="monotone" 
          dataKey="units" 
          stroke="#3b82f6" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorUnits)" 
        />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke="#FF9900" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorRevenue)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
