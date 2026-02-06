import React, { useState } from "react";
import { motion } from "motion/react";
import { Upload, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSellerboard } from "../../context/SellerboardContext";
import { productsService } from "../../services/products.service";
import toast from "react-hot-toast";

export default function ProductImporter() {
  const { user } = useAuth();
  const { products: sellerboardProducts, refreshData } = useSellerboard();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

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

      let successCount = 0;
      let errorCount = 0;

      for (const product of sellerboardProducts) {
        try {
          const productData = {
            asin: product.ASIN || product.asin,
            title: product.Title || product.title || "Unknown Product",
            brand: product.Brand || product.brand || "Unknown",
            category: product.Category || product.category || "other",
            marketplace: product.Marketplace || product.marketplace || "DE",
            status: "active",
            tags: [],
            units30d: product.Units30d || product.units30d || 0,
            units90d: (product.Units30d || product.units30d || 0) * 3,
            units365d: (product.Units30d || product.units30d || 0) * 12,
            revenue30d: product.Revenue30d || product.revenue30d || 0,
            profit30d: product.Profit30d || product.profit30d || 0,
            profitUnit: product.ProfitUnit || product.profitUnit || 0,
            cogs: product.COGS || product.cogs || 0,
            bbCurrent: product.Price || product.price || 0,
            bbAvg7d: product.Price || product.price || 0,
            bbAvg30d: product.Price || product.price || 0,
            volatility30d: 0.1,
            roi: product.ROI || product.roi || 0,
            stockQty: product.Stock || product.stock || 0,
            daysSinceLastSale: 0,
            peakMonths: []
          };

          const result = await productsService.saveProduct(user.id, productData);
          if (result.success) {
            successCount++;
            setImported(successCount);
          } else {
            errorCount++;
            console.error("Failed to import product:", product.ASIN, result.error);
          }
        } catch (err) {
          errorCount++;
          console.error("Error importing product:", product.ASIN, err);
        }
      }

      console.log(`✅ Import complete: ${successCount} success, ${errorCount} errors`);
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} products to Supabase!`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} products. Check console for details.`);
      }

      window.location.reload();
    } catch (error) {
      console.error("❌ Error during import:", error);
      toast.error("Import failed: " + error.message);
    } finally {
      setImporting(false);
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
