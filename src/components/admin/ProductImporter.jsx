import React, { useState } from "react";
import { motion } from "motion/react";
import { Upload, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSellerboard } from "../../context/SellerboardContext";
import { useApp } from "../../context/AppContext";
import { productsService } from "../../services/products.service";
import { parseCSV, mapCSVToDailyRows } from "../../services/sellerboard.service";
import { upsertSellerboardDailyRows } from "../../services/sellerboardDaily.service";
import toast from "react-hot-toast";

export default function ProductImporter() {
  const { user } = useAuth();
  const { products: sellerboardProducts, refreshData } = useSellerboard();
  const { marketplaces } = useApp();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [historyFile, setHistoryFile] = useState(null);
  const [historyImporting, setHistoryImporting] = useState(false);
  const [historyImported, setHistoryImported] = useState(0);
  const [historyMarketplace, setHistoryMarketplace] = useState("FR");

  const parseNumberEU = (value) => {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value)
      .replace(/\u00A0/g, " ")
      .replace(/\s/g, "")
      .replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const parseDateRangeFromFilename = (name) => {
    if (!name) return null;
    const match = name.match(/(\d{2})_(\d{2})_(\d{4})-(\d{2})_(\d{2})_(\d{4})/);
    if (!match) return null;
    const [, d1, m1, y1, d2, m2, y2] = match;
    const start = new Date(Date.UTC(Number(y1), Number(m1) - 1, Number(d1)));
    const end = new Date(Date.UTC(Number(y2), Number(m2) - 1, Number(d2)));
    return { start, end };
  };

  const inferMarketplaceFromFilename = (name) => {
    if (!name) return null;
    const match = name.match(/Buyer-([A-Z]{2})/);
    return match ? match[1] : null;
  };

  const importSellerboardToSupabase = async () => {
    if (!user) {
      toast.error("You must be logged in to import products");
      return;
    }

    if (sellerboardProducts.length === 0) {
      toast.error("No Sellerboard products available. Configure Sellerboard first.");
      return;
    }

    try {
      setImporting(true);
      setImported(0);

      console.log("🚀 Starting import of", sellerboardProducts.length, "products...");

      const result = await productsService.upsertSellerboardProducts(user.id, sellerboardProducts);

      if (result.success) {
        setImported(result.count || 0);
        toast.success(`Successfully imported ${result.count || 0} products to Supabase!`);
      } else {
        toast.error(`Failed to import products. ${result.error || ""}`);
      }

      window.location.reload();
    } catch (error) {
      console.error("❌ Error during import:", error);
      toast.error("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const importHistoryCsv = async () => {
    if (!user) {
      toast.error("You must be logged in to import history");
      return;
    }
    if (!historyFile) {
      toast.error("Select a Sellerboard CSV file first");
      return;
    }

    try {
      setHistoryImporting(true);
      setHistoryImported(0);

      const text = await historyFile.text();
      const csvData = parseCSV(text);
      if (csvData.length === 0) {
        toast.error("CSV has no data rows");
        return;
      }
      const headers = Object.keys(csvData[0] || {});
      const isDaily = headers.includes("Date") && headers.includes("ASIN");

      if (isDaily) {
        const dailyRows = mapCSVToDailyRows(csvData);
        const result = await upsertSellerboardDailyRows(user.id, dailyRows, 500);
        if (!result.success) {
          throw new Error(result.error || "Import failed");
        }
        setHistoryImported(result.count || dailyRows.length);
        const refresh = await productsService.refreshProductsFromDaily(user.id);
        if (!refresh.success) {
          toast.error("History imported, but failed to refresh products");
        } else {
          toast.success(`Imported ${result.count} daily rows and refreshed products`);
        }
      } else {
        // Fallback: summary file (no Date) -> approximate rolling metrics
        const range = parseDateRangeFromFilename(historyFile.name);
        const inferred = inferMarketplaceFromFilename(historyFile.name);
        const selectedMarketplace = inferred || historyMarketplace;
        const days = range ? Math.max(1, Math.round((range.end - range.start) / 86400000) + 1) : 365;

        const summaryProducts = [];
        for (const row of csvData) {
          const asin = row["ASIN"] || row["asin"] || "";
          if (!asin) continue;
          const units = parseNumberEU(row["Units"]);
          const revenue = parseNumberEU(row["Sales"]);
          const profit = parseNumberEU(row["Net profit"] || row["Net Profit"]);
          const cost = parseNumberEU(row["Cost of Goods"]);
          const roi = parseNumberEU(row["ROI"]);
          const avgUnits = units / days;
          const avgRevenue = revenue / days;
          const avgProfit = profit / days;
          const avgCost = cost / days;

          const productData = {
            asin,
            title: row["Product"] || row["Name"] || "Unknown Product",
            category: "other",
            marketplace: selectedMarketplace,
            status: "active",
            tags: [],
            units30d: Math.round(avgUnits * 30),
            units90d: Math.round(avgUnits * 90),
            units365d: Math.round(avgUnits * 365),
            revenue30d: Number((avgRevenue * 30).toFixed(2)),
            profit30d: Number((avgProfit * 30).toFixed(2)),
            profitUnit: avgUnits > 0 ? Number((avgProfit / avgUnits).toFixed(2)) : 0,
            cogs: avgUnits > 0 ? Number((avgCost / avgUnits).toFixed(2)) : 0,
            roi: Number(roi.toFixed(2)) || 0
          };
          summaryProducts.push(productData);
        }
        const result = await productsService.upsertSellerboardProducts(user.id, summaryProducts);
        const importedCount = result.count || summaryProducts.length;
        setHistoryImported(importedCount);
        if (result.success) {
          toast.success(`Imported ${importedCount} products from summary CSV`);
          window.location.reload();
        } else {
          toast.error(`Import failed: ${result.error || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("❌ History import failed:", error);
      toast.error("History import failed: " + error.message);
    } finally {
      setHistoryImporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dashboard-card border border-dashboard-border rounded-lg p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-green-500/10">
          <Database className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-medium text-white">Import to Supabase</h2>
          <p className="text-lg font-extralight text-slate-400">
            Save Sellerboard products to your database
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-dashboard-bg rounded-lg p-4">
          <p className="text-lg font-extralight text-slate-300 mb-2">
            Import Sellerboard full history (CSV)
          </p>
          <div className="mb-3">
            <label className="block text-sm text-slate-400 mb-1">Marketplace</label>
            <select
              value={historyMarketplace}
              onChange={(e) => setHistoryMarketplace(e.target.value)}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              {marketplaces.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setHistoryFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-extralight text-slate-400">
              {historyFile ? historyFile.name : "No file selected"}
            </span>
            <button
              onClick={importHistoryCsv}
              disabled={historyImporting || !historyFile}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {historyImporting ? "Importing..." : "Import History CSV"}
            </button>
          </div>
          {historyImporting && (
            <div className="mt-3 text-lg font-extralight text-slate-400">
              Importing history... {historyImported}
            </div>
          )}
        </div>

        <div className="bg-dashboard-bg rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-lg font-extralight text-slate-300">Sellerboard Products Available</p>
            <p className="text-2xl font-mono text-amazon-orange">{sellerboardProducts.length}</p>
          </div>
          <p className="text-lg font-extralight text-slate-500">
            These products will be imported into your Supabase database
          </p>
        </div>

        {importing && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div>
                <p className="text-lg font-extralight text-white">
                  Importing products... {imported} / {sellerboardProducts.length}
                </p>
                <p className="text-lg font-extralight text-slate-400">
                  This may take a few moments
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={importSellerboardToSupabase}
          disabled={importing || sellerboardProducts.length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-extralight"
        >
          {importing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import {sellerboardProducts.length} Products to Supabase
            </>
          )}
        </button>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-lg font-extralight text-amber-200">
                This will save all Sellerboard products to your Supabase database
              </p>
              <p className="text-lg font-extralight text-slate-400 mt-1">
                After import, you will use Supabase as your primary data source
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
