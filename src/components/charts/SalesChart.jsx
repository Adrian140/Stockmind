import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { productsService } from "../../services/products.service";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
        <p className="text-lg font-extralight text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-medium text-white">
          {payload[0].value.toLocaleString()} units
        </p>
        <p className="text-lg font-extralight text-amazon-orange">
          €{payload[1]?.value?.toLocaleString() || 0}
        </p>
      </div>
    );
  }
  return null;
};

export default function SalesChart() {
  const { user } = useAuth();
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSalesData();
    }
  }, [user]);

  const loadSalesData = async () => {
    try {
      setLoading(true);
      const data = await productsService.getAggregatedSalesData(user.id);
      setSalesData(data);
    } catch (error) {
      console.error("Error loading sales data:", error);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-lg font-extralight text-slate-400">Loading sales data...</p>
      </div>
    );
  }

  if (salesData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-lg font-extralight text-slate-400">No sales data available. Add products to see analytics.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
