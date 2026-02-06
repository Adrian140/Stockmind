import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { productsService } from "../../services/products.service";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
        <p className="text-lg font-extralight text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-medium text-white">
          €{payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function BuyBoxChart() {
  const { user } = useAuth();
  const [buyBoxData, setBuyBoxData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadBuyBoxData();
    }
  }, [user]);

  const loadBuyBoxData = async () => {
    try {
      setLoading(true);
      const data = await productsService.getBuyBoxTrendData(user.id);
      setBuyBoxData(data);
    } catch (error) {
      console.error("Error loading buy box data:", error);
      setBuyBoxData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-lg font-extralight text-slate-400">Loading price trend...</p>
      </div>
    );
  }

  if (buyBoxData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-lg font-extralight text-slate-400">No price data available. Add products to see trends.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={buyBoxData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={14} />
        <YAxis stroke="#64748b" fontSize={14} domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="avg" 
          stroke="#22c55e" 
          strokeWidth={2}
          dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: "#22c55e", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
