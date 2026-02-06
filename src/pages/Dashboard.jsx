import React from 'react';
import { ShoppingCart, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/ui/ChartCard';
import SalesChart from '../components/charts/SalesChart';
import BuyBoxChart from '../components/charts/BuyBoxChart';
import SeasonalProducts from '../components/widgets/SeasonalProducts';
import ClearanceAlerts from '../components/widgets/ClearanceAlerts';
import RecommendationsTable from '../components/widgets/RecommendationsTable';

export default function Dashboard() {
  const { buyRecommendations, seasonalWinners, clearanceStock, filteredProducts } = useApp();

  return (
    <div id="dashboard-page" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Buy Recommendations"
          value={buyRecommendations.length}
          change={12}
          changeLabel="vs last week"
          icon={ShoppingCart}
          to="/products?filter=recommendations"
          color="green"
        />
        <KpiCard
          title="Seasonal Winners"
          value={seasonalWinners.length}
          change={8}
          changeLabel="upcoming"
          icon={TrendingUp}
          to="/seasonality"
          color="orange"
        />
        <KpiCard
          title="Clearance Stock"
          value={clearanceStock.length}
          change={-15}
          changeLabel="vs last month"
          icon={AlertTriangle}
          to="/clearance"
          color="red"
        />
        <KpiCard
          title="Total Products"
          value={filteredProducts.length}
          change={5}
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
