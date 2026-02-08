import React from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useSellerboard } from "../../context/SellerboardContext";

export default function SellerboardStatus() {
  const { products, loading, lastSync, error, refreshData } = useSellerboard();

  const formatLastSync = () => {
    if (!lastSync) return "Never";
    const now = new Date();
    const diff = now - lastSync;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 minute ago";
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {loading ? (
            <RefreshCw className="w-5 h-5 text-amazon-orange animate-spin" />
          ) : error ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
          <div>
            <h3 className="text-lg font-medium text-white">Sellerboard Connection</h3>
            <p className="text-lg font-extralight text-slate-400">
              {loading ? "Syncing data..." : error ? "Connection error" : `${products.length} products loaded`}
            </p>
          </div>
        </div>
        <button
          onClick={refreshData}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-extralight text-slate-400">Last sync</span>
          <div className="flex items-center gap-2 text-lg font-extralight text-white">
            <Clock className="w-4 h-4" />
            {formatLastSync()}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-extralight text-slate-400">Data source</span>
          <span className="text-lg font-extralight text-white">Sellerboard</span>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-lg font-extralight text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
