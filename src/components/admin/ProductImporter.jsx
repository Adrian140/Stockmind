import React, { useState } from "react";
import { motion } from "motion/react";
import { Upload, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSellerboard } from "../../context/SellerboardContext";
import { useApp } from "../../context/AppContext";
import { productsService } from "../../services/products.service";
import { parseCSV, mapCSVToDailyRows } from "../../services/sellerboard.service";
import { upsertSellerboardDailyRows } from "../../services/sellerboardDaily.service";
import { supabase } from "../../lib/supabase";
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
  const [historyProgress, setHistoryProgress] = useState({ current: 0, total: 0 });
  const [historyMarketplace, setHistoryMarketplace] = useState("FR");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [uploadMode, setUploadMode] = useState("history");
  const [imagesImporting, setImagesImporting] = useState(false);
  const [imagesImported, setImagesImported] = useState(0);

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

  const eachDayInRange = (start, end) => {
    const days = [];
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (current <= last) {
      days.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return days;
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
      setHistoryProgress({ current: 0, total: 0 });

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
        setHistoryProgress({ current: 0, total: dailyRows.length });
        const result = await upsertSellerboardDailyRows(user.id, dailyRows, 500, setHistoryProgress);
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
        const inferredRange = parseDateRangeFromFilename(historyFile.name);
        const inferred = inferMarketplaceFromFilename(historyFile.name);
        const selectedMarketplace = inferred || historyMarketplace;

        const start = inferredRange?.start || (historyStartDate ? new Date(historyStartDate) : null);
        const end = inferredRange?.end || (historyEndDate ? new Date(historyEndDate) : null);

        if (!start || !end) {
          throw new Error("Summary CSV needs a date range (filename or manual start/end)");
        }

        const daysList = eachDayInRange(start, end);
        const days = Math.max(1, daysList.length);

        const summaryRows = [];
        for (const row of csvData) {
          const asin = row["ASIN"] || row["asin"] || "";
          if (!asin) continue;
          const sku = row["SKU"] || row["sku"] || "";
          const title = row["Product"] || row["Name"] || "Unknown Product";
          const units = parseNumberEU(row["Units"]);
          const revenue = parseNumberEU(row["Sales"]);
          const profit = parseNumberEU(row["Net profit"] || row["Net Profit"]);
          const roi = parseNumberEU(row["ROI"]);

          const perDayUnits = units / days;
          const perDayRevenue = revenue / days;
          const perDayProfit = profit / days;

          for (const day of daysList) {
            summaryRows.push({
              report_date: day.toISOString().slice(0, 10),
              marketplace: selectedMarketplace,
              asin,
              sku,
              title,
              units_total: perDayUnits,
              revenue_total: perDayRevenue,
              net_profit: perDayProfit,
              roi,
              raw: null
            });
          }
        }

        setHistoryProgress({ current: 0, total: summaryRows.length });
        const result = await upsertSellerboardDailyRows(user.id, summaryRows, 500, setHistoryProgress);
        if (!result.success) {
          throw new Error(result.error || "Import failed");
        }
        setHistoryImported(result.count || summaryRows.length);
        const refresh = await productsService.refreshProductsFromDaily(user.id);
        if (!refresh.success) {
          toast.error("History imported, but failed to refresh products");
        } else {
          toast.success(`Imported ${result.count} daily rows from summary CSV`);
        }
      }
    } catch (error) {
      console.error("❌ History import failed:", error);
      toast.error("History import failed: " + error.message);
    } finally {
      setHistoryImporting(false);
    }
  };

  const importImagesCsv = async () => {
    if (!user) {
      toast.error("You must be logged in to import images");
      return;
    }
    if (!historyFile) {
      toast.error("Select an image CSV file first");
      return;
    }

    try {
      setImagesImporting(true);
      setImagesImported(0);

      const text = await historyFile.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        toast.error("CSV has no data rows");
        return;
      }

      const headers = Object.keys(rows[0] || {});
      const normalizeHeader = (h) => h.toLowerCase().replace(/\s/g, "");
      const asinHeader = headers.find((h) => normalizeHeader(h).includes("asin"));
      const imageHeader = headers.find((h) => {
        const key = normalizeHeader(h);
        return key.includes("image") || key.includes("img") || key.includes("url");
      });

      const mapped = [];
      for (const row of rows) {
        const asin = (row[asinHeader] || row["ASIN"] || row["asin"] || "").trim();
        const imageUrl = (row[imageHeader] || row["Image"] || row["ImageURL"] || row["image_url"] || row["URL"] || row["url"] || "").trim();
        if (!asin || !imageUrl) continue;
        mapped.push({
          user_id: user.id,
          asin,
          image_url: imageUrl,
          source: "upload",
          updated_at: new Date().toISOString()
        });
      }

      if (!mapped.length) {
        toast.error("No ASIN + image URL pairs found in CSV");
        return;
      }

      const uniqueAsins = Array.from(new Set(mapped.map((m) => m.asin)));
      const existing = new Set();
      for (let i = 0; i < uniqueAsins.length; i += 200) {
        const batch = uniqueAsins.slice(i, i + 200);
        const { data, error } = await supabase
          .from("asin_images")
          .select("asin")
          .eq("user_id", user.id)
          .in("asin", batch);
        if (error) throw error;
        (data || []).forEach((row) => existing.add(row.asin));
      }

      const toInsert = mapped.filter((m) => !existing.has(m.asin));

      if (!toInsert.length) {
        toast.success("No new images to import");
        return;
      }

      const { data, error } = await supabase
        .from("asin_images")
        .insert(toInsert)
        .select("asin");
      if (error) throw error;

      const importedCount = data?.length || toInsert.length;
      setImagesImported(importedCount);

      const byAsin = new Map();
      for (const item of toInsert) {
        if (!byAsin.has(item.asin)) byAsin.set(item.asin, item.image_url);
      }
      for (const [asin, imageUrl] of byAsin.entries()) {
        await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("user_id", user.id)
          .eq("asin", asin)
          .is("image_url", null);
      }

      toast.success(`Imported ${importedCount} new images`);
    } catch (error) {
      console.error("Error importing images:", error);
      toast.error("Failed to import images");
    } finally {
      setImagesImporting(false);
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
            Import Sellerboard data (CSV)
          </p>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setUploadMode("history")}
              className={`px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
                uploadMode === "history" ? "bg-amazon-orange text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              History CSV
            </button>
            <button
              onClick={() => setUploadMode("images")}
              className={`px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
                uploadMode === "images" ? "bg-amazon-orange text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Add Images CSV
            </button>
          </div>
          <div className="mb-3">
            <label className="block text-sm text-slate-400 mb-1">Marketplace</label>
            <select
              value={historyMarketplace}
              onChange={(e) => setHistoryMarketplace(e.target.value)}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
              disabled={uploadMode === "images"}
            >
              {marketplaces.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.name}
                </option>
              ))}
            </select>
          </div>
          {uploadMode === "history" && (
            <div className="mb-3">
              <label className="block text-sm text-slate-400 mb-1">Summary Date Range (if file has no Date)</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
                />
                <span className="text-slate-500 text-sm">to</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>
          )}
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
              onClick={uploadMode === "images" ? importImagesCsv : importHistoryCsv}
              disabled={(uploadMode === "images" ? imagesImporting : historyImporting) || !historyFile}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploadMode === "images"
                ? imagesImporting
                  ? "Importing..."
                  : "Import Images CSV"
                : historyImporting
                  ? "Importing..."
                  : "Import History CSV"}
            </button>
          </div>
          {historyImporting && uploadMode === "history" && (
            <div className="mt-3 text-lg font-extralight text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Importing history...{" "}
                {historyProgress.total > 0
                  ? `${Math.min(100, Math.round((historyProgress.current / historyProgress.total) * 100))}% (${historyProgress.current}/${historyProgress.total})`
                  : `${historyImported}`}
              </span>
            </div>
          )}
          {imagesImporting && uploadMode === "images" && (
            <div className="mt-3 text-lg font-extralight text-slate-400">
              Importing images... {imagesImported}
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
