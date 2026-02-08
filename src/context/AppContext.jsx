import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useSellerboard } from "./SellerboardContext";
import { useAuth } from "./AuthContext";
import { productsService } from "../services/products.service";

const AppContext = createContext(null);

export const marketplaces = [
  { id: "BE", name: "Belgium", flag: "🇧🇪", currency: "€" },
  { id: "FR", name: "France", flag: "🇫🇷", currency: "€" },
  { id: "DE", name: "Germany", flag: "🇩🇪", currency: "€" },
  { id: "IE", name: "Ireland", flag: "🇮🇪", currency: "€" },
  { id: "IT", name: "Italy", flag: "🇮🇹", currency: "€" },
  { id: "NL", name: "Netherlands", flag: "🇳🇱", currency: "€" },
  { id: "PL", name: "Poland", flag: "🇵🇱", currency: "zł" },
  { id: "ES", name: "Spain", flag: "🇪🇸", currency: "€" },
  { id: "SE", name: "Sweden", flag: "🇸🇪", currency: "kr" },
  { id: "UK", name: "United Kingdom", flag: "🇬🇧", currency: "£" }
];

export const categories = [
  { id: "all", name: "All Categories" },
  { id: "electronics", name: "Electronics" },
  { id: "home", name: "Home & Kitchen" },
  { id: "sports", name: "Sports & Outdoors" },
  { id: "toys", name: "Toys & Games" },
  { id: "beauty", name: "Beauty & Personal Care" },
  { id: "fashion", name: "Fashion" },
  { id: "books", name: "Books" },
  { id: "office", name: "Office Products" },
  { id: "automotive", name: "Automotive" },
  { id: "tools", name: "Tools" },
  { id: "garden", name: "Garden" },
  { id: "pets", name: "Pet Supplies" },
  { id: "baby", name: "Baby" },
  { id: "other", name: "Other" }
];

export function AppProvider({ children }) {
  const { user } = useAuth();
  const { products: sellerboardProducts, loading: sellerboardLoading } = useSellerboard();
  const [selectedMarketplace, setSelectedMarketplace] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [supabaseProducts, setSupabaseProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [settings, setSettings] = useState({
    minRoi: 25,
    minUnits: 20,
    minProfitUnit: 2,
    volatilityThreshold: 0.20
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadSupabaseProducts();
    } else {
      setSupabaseProducts([]);
      setLoadingProducts(false);
    }
  }, [user]);

  // Removed auto-import of 30-day Sellerboard aggregates to avoid repopulating products on refresh.


  const loadSupabaseProducts = async () => {
    try {
      setLoadingProducts(true);
      const products = await productsService.getProductsWithSalesHistory(user.id);
      setSupabaseProducts(products);
      console.log("📦 Loaded products from Supabase:", products.length);
    } catch (error) {
      console.error("❌ Error loading Supabase products:", error);
      setSupabaseProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const allProducts = useMemo(() => {
    if (supabaseProducts.length > 0) {
      console.log("📦 Using Supabase Products:", supabaseProducts.length);
      return supabaseProducts;
    }
    console.log("⚠️ No products available from Supabase");
    return [];
  }, [supabaseProducts]);

  const filteredProducts = useMemo(() => {
    const upper = (v) => (v || "").toUpperCase();
    let base = allProducts;
    if (selectedMarketplace !== "all") {
      base = base.filter((product) => upper(product.marketplace) === selectedMarketplace);
    }

    const categoryFiltered = base.filter((product) => {
      const categoryMatch = selectedCategory === "all" || product.category === selectedCategory;
      return categoryMatch;
    });

    if (selectedMarketplace !== "all") {
      console.log("✅ Filtered Products:", categoryFiltered.length, "from", allProducts.length);
      return categoryFiltered;
    }

    // Aggregate across marketplaces by SKU when "All Markets" is selected
    const bySku = new Map();
    for (const p of categoryFiltered) {
      const key = p.sku || p.asin || `${p.marketplace}-${p.id}`;
      if (!bySku.has(key)) {
        bySku.set(key, {
          ...p,
          marketplace: "ALL",
          sourceMarketplaces: new Set([upper(p.marketplace)])
        });
      } else {
        const agg = bySku.get(key);
        agg.units30d += p.units30d || 0;
        agg.units90d += p.units90d || 0;
        agg.units365d += p.units365d || 0;
        agg.unitsAllTime += p.unitsAllTime || 0;
        agg.revenue30d += p.revenue30d || 0;
        agg.profit30d += p.profit30d || 0;
        agg.stockQty += p.stockQty || 0;
        agg.sourceMarketplaces.add(upper(p.marketplace));
      }
    }

    const aggregated = Array.from(bySku.values()).map((p) => ({
      ...p,
      sourceMarketplaces: Array.from(p.sourceMarketplaces)
    }));

    console.log("✅ Filtered Products:", aggregated.length, "from", allProducts.length);
    return aggregated;
  }, [allProducts, selectedMarketplace, selectedCategory]);

  const buyRecommendations = useMemo(() => {
    return filteredProducts.filter(p => 
      p.roi >= settings.minRoi && 
      p.units30d >= settings.minUnits && 
      p.profitUnit >= settings.minProfitUnit &&
      p.volatility30d <= settings.volatilityThreshold
    );
  }, [filteredProducts, settings]);

  const seasonalWinners = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const upcomingMonths = [currentMonth, (currentMonth % 12) + 1, ((currentMonth + 1) % 12) + 1];
    return filteredProducts.filter(p => 
      p.peakMonths && p.peakMonths.some(m => upcomingMonths.includes(m))
    );
  }, [filteredProducts]);

  const clearanceStock = useMemo(() => {
    return filteredProducts.filter(p => 
      (p.units90d === 0 && p.stockQty > 0) || 
      p.profitUnit < 0 ||
      p.daysSinceLastSale > 30
    );
  }, [filteredProducts]);

  const value = {
    selectedMarketplace,
    setSelectedMarketplace,
    selectedCategory,
    setSelectedCategory,
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    filteredProducts,
    buyRecommendations,
    seasonalWinners,
    clearanceStock,
    marketplaces,
    categories,
    allProducts,
    loadingProducts,
    sellerboardLoading,
    refreshProducts: loadSupabaseProducts
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
