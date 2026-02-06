import React, { useState, useEffect } from "react";
import { ShoppingCart, TrendingUp, AlertTriangle, Package } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { productsService } from "../services/products.service";
import KpiCard from "../components/ui/KpiCard";
import ChartCard from "../components/ui/ChartCard";
import SalesChart from "../components/charts/SalesChart";
import BuyBoxChart from "../components/charts/BuyBoxChart";
import SeasonalProducts from "../components/widgets/SeasonalProducts";
import ClearanceAlerts from "../components/widgets/ClearanceAlerts";
import RecommendationsTable from "../components/widgets/RecommendationsTable";

export default function Dashboard() {
  const { buyRecommendations, seasonalWinners, clearanceStock, filteredProducts, allProducts } = useApp();
  const { user } = useAuth();
  const [kpiChanges, setKpiChanges] = useState({
    recommendations: 0,
    seasonal: 0,
    clearance: 0,
    total: 0
  });

  useEffect(() => {
    if (user && allProducts.length > 0) {
      calculateKpiChanges();
    }
  }, [user, allProducts, buyRecommendations, seasonalWinners, clearanceStock, filteredProducts]);

  const calculateKpiChanges = async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const lastWeekProducts = allProducts.filter(p => {
        const created = new Date(p.created_at || new Date());
        return created >= oneWeekAgo;
      });

      const lastMonthProducts = allProducts.filter(p => {
        const created = new Date(p.created_at || new Date());
        return created >= thirtyDaysAgo;
      });

      const recommendationsChange = lastWeekProducts.length > 0 
        ? Math.round((lastWeekProducts.filter(p => 
            p.roi >= 25 && p.units30d >= 20 && p.profitUnit >= 2
          ).length / buyRecommendations.length) * 100) 
        : 0;

      const seasonalChange = seasonalWinners.length > 0 
        ? Math.round((seasonalWinners.length / allProducts.length) * 100)
        : 0;

      const clearanceChange = clearanceStock.length > 0
        ? -Math.round((clearanceStock.length / allProducts.length) * 100)
        : 0;

      const totalChange = lastMonthProducts.length;

      setKpiChanges({
        recommendations: recommendationsChange,
        seasonal: seasonalChange,
        clearance: clearanceChange,
        total: totalChange
      });
    } catch (error) {
      console.error("Error calculating KPI changes:", error);
    }
  };

  return (
    <div id="dashboard-page" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Buy Recommendations"
          value={buyRecommendations.length}
          change={kpiChanges.recommendations}
          changeLabel="vs last week"
          icon={ShoppingCart}
          to="/products?filter=recommendations"
          color="green"
        />
        <KpiCard
          title="Seasonal Winners"
          value={seasonalWinners.length}
          change={kpiChanges.seasonal}
          changeLabel="upcoming"
          icon={TrendingUp}
          to="/seasonality"
          color="orange"
        />
        <KpiCard
          title="Clearance Stock"
          value={clearanceStock.length}
          change={kpiChanges.clearance}
          changeLabel="vs last month"
          icon={AlertTriangle}
          to="/clearance"
          color="red"
        />
        <KpiCard
          title="Total Products"
          value={filteredProducts.length}
          change={kpiChanges.total}
          changeLabel="new this month"
          icon={Package}
          to="/products"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Sales Performance" 
          subtitle="Units sold and revenue trend"
        >
          <SalesChart />
        </ChartCard>
        <ChartCard 
          title="Buy Box Price Trend" 
          subtitle="Average BB price (90 days)"
        >
          <BuyBoxChart />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SeasonalProducts />
        <ClearanceAlerts />
      </div>

      <RecommendationsTable />
    </div>
  );
}
