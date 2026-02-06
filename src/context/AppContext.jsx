import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { products as mockProducts, marketplaces, categories } from "../data/mockData";
import { useSellerboard } from "./SellerboardContext";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { products: sellerboardProducts, loading: sellerboardLoading } = useSellerboard();
  const [selectedMarketplace, setSelectedMarketplace] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [useSellerboardData, setUseSellerboardData] = useState(true);
  const [settings, setSettings] = useState({
    minRoi: 25,
    minUnits: 20,
    minProfitUnit: 2,
    volatilityThreshold: 0.20
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const allProducts = useMemo(() => {
    if (useSellerboardData && sellerboardProducts.length > 0) {
      console.log("📦 Using Sellerboard Data:", sellerboardProducts.length, "products");
      return sellerboardProducts;
    }
    console.log("📦 Using Mock Data:", mockProducts.length, "products");
    console.table(mockProducts.map(p => ({
      ASIN: p.asin,
      Title: p.title,
      Marketplace: p.marketplace,
      Category: p.category
    })));
    return mockProducts;
  }, [useSellerboardData, sellerboardProducts]);

  const filteredProducts = useMemo(() => {
    console.log("🔍 FILTER STATUS:");
    console.log("  - Selected Marketplace:", selectedMarketplace);
    console.log("  - Selected Category:", selectedCategory);
    console.log("  - Total Products Before Filter:", allProducts.length);

    const filtered = allProducts.filter(product => {
      const marketplaceMatch = selectedMarketplace === "all" || product.marketplace === selectedMarketplace;
      const categoryMatch = selectedCategory === "all" || product.category === selectedCategory;
      if (!marketplaceMatch || !categoryMatch) {
        console.log(`  ❌ Product ${product.asin} filtered out:`, {
          marketplace: product.marketplace,
          marketplaceMatch,
          category: product.category,
          categoryMatch
        });
      }
      return marketplaceMatch && categoryMatch;
    });

    console.log("  ✅ Products After Filter:", filtered.length);
    if (filtered.length === 0) {
      console.warn("⚠️ WARNING: NO PRODUCTS MATCHED THE FILTERS!");
      console.log("Available marketplaces in data:", [...new Set(allProducts.map(p => p.marketplace))]);
      console.log("Available categories in data:", [...new Set(allProducts.map(p => p.category))]);
    }

    return filtered;
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

  // Debug effect to monitor data source changes
  useEffect(() => {
    console.log("🔄 DATA SOURCE CHANGED:");
    console.log("  - Use Sellerboard Data:", useSellerboardData);
    console.log("  - Sellerboard Products:", sellerboardProducts.length);
    console.log("  - Sellerboard Loading:", sellerboardLoading);
    console.log("  - Active Data Source:", allProducts.length, "products");
  }, [useSellerboardData, sellerboardProducts, sellerboardLoading, allProducts]);

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
    useSellerboardData,
    setUseSellerboardData,
    sellerboardLoading
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
