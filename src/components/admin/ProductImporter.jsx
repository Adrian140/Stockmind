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
  const [historyQueue, setHistoryQueue] = useState([]);
  const [currentHistoryFile, setCurrentHistoryFile] = useState(null);
  const [historyImporting, setHistoryImporting] = useState(false);
  const [historyImported, setHistoryImported] = useState(0);
  const [historyProgress, setHistoryProgress] = useState({ current: 0, total: 0 });
  const [historyMarketplace, setHistoryMarketplace] = useState("FR");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [uploadMode, setUploadMode] = useState("history");
  const [imagesImporting, setImagesImporting] = useState(false);
  const [imagesImported, setImagesImported] = useState(0);
  const [imagesProgress, setImagesProgress] = useState({ current: 0, total: 0 });
  const [imagesQueue, setImagesQueue] = useState([]);
  const [currentImagesFile, setCurrentImagesFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  React.useEffect(() => {
    const storedStart = localStorage.getItem("historyStartDate") || "";
    const storedEnd = localStorage.getItem("historyEndDate") || "";
    const storedMarketplace = localStorage.getItem("historyMarketplace") || "";
    if (storedStart) setHistoryStartDate(storedStart);
    if (storedEnd) setHistoryEndDate(storedEnd);
    if (storedMarketplace) setHistoryMarketplace(storedMarketplace);
  }, []);

  React.useEffect(() => {
    localStorage.setItem("historyStartDate", historyStartDate || "");
  }, [historyStartDate]);

  React.useEffect(() => {
    localStorage.setItem("historyEndDate", historyEndDate || "");
  }, [historyEndDate]);

  React.useEffect(() => {
    localStorage.setItem("historyMarketplace", historyMarketplace || "");
  }, [historyMarketplace]);

  const parseNumberEU = (value) => {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value)
      .replace(/\u00A0/g, " ")
      .replace(/\s/g, "")
      .replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const normalizeImageUrl = (value) => {
    if (!value) return "";
    const trimmed = String(value).trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const first = parsed.find((item) => typeof item === "string" && item.trim());
          if (first) return first.trim();
        }
      } catch (error) {
        // fall through to string cleanup
      }
      const inner = trimmed.replace(/^\[\s*"?/, "").replace(/"?\s*\]$/, "");
      const first = inner.split(",")[0] || "";
      return first.trim().replace(/^"+|"+$/g, "");
    }
    return trimmed.replace(/^"+|"+$/g, "");
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

  const importHistoryCsv = async (file) => {
    if (!user) {
      toast.error("You must be logged in to import history");
      return;
    }
    if (!file) return;

    try {
      setHistoryImporting(true);
      setHistoryImported(0);
      setHistoryProgress({ current: 0, total: 0 });
      setCurrentHistoryFile(file);

      const text = await file.text();
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
        const inferredRange = parseDateRangeFromFilename(file.name);
        const inferred = inferMarketplaceFromFilename(file.name);
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
          const title = row["Product"] || row["Name"] || row["Title"] || "Unknown Product";
          const units = parseNumberEU(row["Units"]);
          const revenue = parseNumberEU(row["Sales"]);
          const profit = parseNumberEU(row["Net profit"] || row["Net Profit"]);
          const roi = parseNumberEU(row["ROI"]);

          const refunds = parseNumberEU(row["Refunds"]);
          const promo = parseNumberEU(row["Promo"]);
          const ads = parseNumberEU(row["Ads"]);
          const sponsoredProducts = parseNumberEU(row["Sponsored products (PPC)"]);
          const sponsoredDisplay = parseNumberEU(row["Sponsored Display"]);
          const sponsoredBrands = parseNumberEU(row["Sponsored brands (HSA)"]);
          const sponsoredBrandsVideo = parseNumberEU(row["Sponsored Brands Video"]);
          const googleAds = parseNumberEU(row["Google ads"]);
          const facebookAds = parseNumberEU(row["Facebook ads"]);
          const refundsPercent = parseNumberEU(row["% Refunds"]);
          const sellableQuota = parseNumberEU(row["Sellable Quota"]);
          const refundCost = parseNumberEU(row["Refund cost"] || row["Refund сost"]);
          const amazonFees = parseNumberEU(row["Amazon fees"]);
          const costOfGoodsTotal = parseNumberEU(row["Cost of Goods"]);
          const costPerUnit = units > 0 ? Math.abs(costOfGoodsTotal) / units : null;
          const vat = parseNumberEU(row["VAT"]);
          const shipping = parseNumberEU(row["Shipping"]);
          const grossProfit = parseNumberEU(row["Gross profit"]);
          const estimatedPayout = parseNumberEU(row["Estimated payout"]);
          const expenses = parseNumberEU(row["Expenses"]);
          const margin = parseNumberEU(row["Margin"]);
          const bsr = parseNumberEU(row["BSR"]);
          const realAcos = parseNumberEU(row["Real ACOS"]);
          const sessions = parseNumberEU(row["Sessions"]);
          const unitSessionPercentage = parseNumberEU(row["Unit Session Percentage"]);

          const distribute = (total, count, scale) => {
            if (count <= 0) return [];
            const totalScaled = Math.round((total || 0) * scale);
            const base = Math.trunc(totalScaled / count);
            let remainder = totalScaled - base * count;
            const step = remainder > 0 ? 1 : -1;
            const result = new Array(count).fill(base);
            for (let i = 0; i < Math.abs(remainder); i++) {
              result[i] += step;
            }
            return result.map((v) => v / scale);
          };

          const perDayUnits = distribute(units, days, 1);
          const perDayRevenue = distribute(revenue, days, 100);
          const perDayProfit = distribute(profit, days, 100);
          const perDayRefunds = distribute(refunds, days, 1);
          const perDayPromo = distribute(promo, days, 100);
          const perDayAds = distribute(ads, days, 100);
          const perDaySponsoredProducts = distribute(sponsoredProducts, days, 100);
          const perDaySponsoredDisplay = distribute(sponsoredDisplay, days, 100);
          const perDaySponsoredBrands = distribute(sponsoredBrands, days, 100);
          const perDaySponsoredBrandsVideo = distribute(sponsoredBrandsVideo, days, 100);
          const perDayGoogleAds = distribute(googleAds, days, 100);
          const perDayFacebookAds = distribute(facebookAds, days, 100);
          const perDayRefundCost = distribute(refundCost, days, 100);
          const perDayAmazonFees = distribute(amazonFees, days, 100);
          const perDayCostOfGoods = distribute(costPerUnit || 0, days, 100);
          const perDayVat = distribute(vat, days, 100);
          const perDayShipping = distribute(shipping, days, 100);
          const perDayGrossProfit = distribute(grossProfit, days, 100);
          const perDayEstimatedPayout = distribute(estimatedPayout, days, 100);
          const perDayExpenses = distribute(expenses, days, 100);
          const perDaySessions = distribute(sessions, days, 1);

          for (let i = 0; i < daysList.length; i++) {
            const day = daysList[i];
            summaryRows.push({
              report_date: day.toISOString().slice(0, 10),
              marketplace: selectedMarketplace,
              asin,
              sku,
              title,
              product_name: title,
              units_total: perDayUnits[i] || 0,
              revenue_total: perDayRevenue[i] || 0,
              net_profit: perDayProfit[i] || 0,
              roi,
              units: perDayUnits[i] || 0,
              refunds: perDayRefunds[i] || 0,
              sales: perDayRevenue[i] || 0,
              promo: perDayPromo[i] || 0,
              ads: perDayAds[i] || 0,
              sponsored_products_ppc: perDaySponsoredProducts[i] || 0,
              sponsored_display: perDaySponsoredDisplay[i] || 0,
              sponsored_brands_hsa: perDaySponsoredBrands[i] || 0,
              sponsored_brands_video: perDaySponsoredBrandsVideo[i] || 0,
              google_ads: perDayGoogleAds[i] || 0,
              facebook_ads: perDayFacebookAds[i] || 0,
              refunds_percent: refundsPercent,
              sellable_quota: sellableQuota,
              refund_cost: perDayRefundCost[i] || 0,
              amazon_fees: perDayAmazonFees[i] || 0,
              cost_of_goods: perDayCostOfGoods[i] || 0,
              vat: perDayVat[i] || 0,
              shipping: perDayShipping[i] || 0,
              gross_profit: perDayGrossProfit[i] || 0,
              estimated_payout: perDayEstimatedPayout[i] || 0,
              expenses: perDayExpenses[i] || 0,
              margin,
              bsr,
              real_acos: realAcos,
              sessions: perDaySessions[i] || 0,
              unit_session_percentage: unitSessionPercentage,
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
      setCurrentHistoryFile(null);
    }
  };

  const importImagesCsv = async (file) => {
    if (!user) {
      toast.error("You must be logged in to import images");
      return;
    }
    if (!file) return;

    try {
      setImagesImporting(true);
      setImagesImported(0);
      setImagesProgress({ current: 0, total: 0 });
      setCurrentImagesFile(file);

      const text = await file.text();
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
        const rawImageUrl = row[imageHeader] || row["Image"] || row["ImageURL"] || row["image_url"] || row["image_urls"] || row["ImageURLs"] || row["URL"] || row["url"] || "";
        const imageUrl = normalizeImageUrl(rawImageUrl);
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
      setImagesProgress({ current: 0, total: uniqueAsins.length });
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
        setImagesProgress((prev) => ({
          current: Math.min(uniqueAsins.length, i + 200),
          total: prev.total
        }));
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
      setImagesProgress({ current: uniqueAsins.length, total: uniqueAsins.length });

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
      setCurrentImagesFile(null);
    }
  };

  const enqueueHistoryFiles = (files) => {
    if (!files || files.length === 0) return;
    setHistoryQueue((prev) => [...prev, ...Array.from(files)]);
    toast.success(`Queued ${files.length} history file(s)`);
  };

  const enqueueImageFiles = (files) => {
    if (!files || files.length === 0) return;
    setImagesQueue((prev) => [...prev, ...Array.from(files)]);
    toast.success(`Queued ${files.length} image file(s)`);
  };

  const handleFileSelection = (files) => {
    if (!files || files.length === 0) {
      toast.error("No files selected");
      return;
    }
    if (uploadMode === "images") {
      enqueueImageFiles(files);
    } else {
      enqueueHistoryFiles(files);
    }
  };

  const formatDateInput = (date) => date.toISOString().slice(0, 10);
  const parseDateInput = (value) => new Date(`${value}T00:00:00`);
  const isLastDayOfMonth = (date) => {
    const test = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return date.getUTCDate() === test.getUTCDate();
  };

  const goToNextMonth = () => {
    if (!historyStartDate || !historyEndDate) {
      toast.error("Selectează mai întâi o perioadă");
      return;
    }
    const start = parseDateInput(historyStartDate);
    const end = parseDateInput(historyEndDate);
    const isFullMonth = start.getUTCDate() === 1 && isLastDayOfMonth(end);

    const nextMonthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    let nextStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
    let nextEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()));

    if (isFullMonth) {
      nextStart = nextMonthStart;
      nextEnd = new Date(Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, 0));
    } else {
      // Clamp end to last day of target month if needed
      const lastDay = new Date(Date.UTC(nextEnd.getUTCFullYear(), nextEnd.getUTCMonth() + 1, 0)).getUTCDate();
      if (nextEnd.getUTCDate() > lastDay) {
        nextEnd = new Date(Date.UTC(nextEnd.getUTCFullYear(), nextEnd.getUTCMonth(), lastDay));
      }
    }

    setHistoryStartDate(formatDateInput(nextStart));
    setHistoryEndDate(formatDateInput(nextEnd));
  };

  React.useEffect(() => {
    if (historyImporting || historyQueue.length === 0) return;
    const [next, ...rest] = historyQueue;
    setHistoryQueue(rest);
    importHistoryCsv(next);
  }, [historyImporting, historyQueue]);

  React.useEffect(() => {
    if (imagesImporting || imagesQueue.length === 0) return;
    const [next, ...rest] = imagesQueue;
    setImagesQueue(rest);
    importImagesCsv(next);
  }, [imagesImporting, imagesQueue]);

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
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="ml-2 px-3 py-2 rounded-lg border border-dashboard-border text-sm text-slate-200 hover:border-amazon-orange hover:text-white transition-colors"
                >
                  Next month
                </button>
              </div>
            </div>
          )}
          <label
            className={`block w-full rounded-lg border border-dashed px-4 py-5 text-sm transition-colors ${
              isDragOver ? "border-amazon-orange bg-amazon-orange/10" : "border-dashboard-border bg-dashboard-bg"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFileSelection(e.dataTransfer.files);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-slate-300">
                Trage fișierele aici sau
                <span className="ml-1 text-amazon-orange">alege fișiere</span>
              </div>
              <input
                type="file"
                accept=".csv,.CSV,text/csv"
                multiple
                onChange={(e) => {
                  handleFileSelection(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </div>
          </label>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-extralight text-slate-400">
              {uploadMode === "images"
                ? currentImagesFile?.name ||
                  (imagesQueue.length
                    ? `Next: ${imagesQueue[0]?.name} (+${Math.max(imagesQueue.length - 1, 0)} pending)`
                    : "No file selected")
                : currentHistoryFile?.name ||
                  (historyQueue.length
                    ? `Next: ${historyQueue[0]?.name} (+${Math.max(historyQueue.length - 1, 0)} pending)`
                    : "No file selected")}
            </span>
            <button
              onClick={() => {
                if (uploadMode === "images") {
                  if (!imagesImporting && imagesQueue.length > 0) {
                    const [next, ...rest] = imagesQueue;
                    setImagesQueue(rest);
                    importImagesCsv(next);
                  }
                } else if (!historyImporting && historyQueue.length > 0) {
                  const [next, ...rest] = historyQueue;
                  setHistoryQueue(rest);
                  importHistoryCsv(next);
                }
              }}
              disabled={uploadMode === "images" ? imagesImporting || imagesQueue.length === 0 : historyImporting || historyQueue.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploadMode === "images"
                ? imagesImporting
                  ? "Importing..."
                  : "Start Images Import"
                : historyImporting
                  ? "Importing..."
                  : "Start History Import"}
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
            <div className="mt-3 text-lg font-extralight text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Importing images...{" "}
                {imagesProgress.total > 0
                  ? `${Math.min(100, Math.round((imagesProgress.current / imagesProgress.total) * 100))}% (${imagesProgress.current}/${imagesProgress.total})`
                  : `${imagesImported}`}
              </span>
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
