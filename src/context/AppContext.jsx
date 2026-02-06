import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useSellerboard } from "./SellerboardContext";
import { useAuth } from "./AuthContext";
import { productsService } from "../services/products.service";

const AppContext = createContext(null);

export const marketplaces = [
  { id: "DE", name: "Germany", currency: "€" },
  { id: "FR", name: "France", currency: "€" },
  { id: "IT", name: "Italy", currency: "€" },
  { id: "ES", name: "Spain", currency: "€" },
  { id: "UK", name: "United Kingdom", currency: "£" },
  { id: "US", name: "United States", currency: "$" }
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
    if (sellerboardProducts.length > 0) {
      console.log("📦 Using Sellerboard Products:", sellerboardProducts.length);
      return sellerboardProducts;
    }

    console.log("⚠️ No products available from any source");
    return [];
  }, [supabaseProducts, sellerboardProducts]);

  const filteredProducts = useMemo(() => {
    const filtered = allProducts.filter(product => {
      const marketplaceMatch = selectedMarketplace === "all" || product.marketplace === selectedMarketplace;
      const categoryMatch = selectedCategory === "all" || product.category === selectedCategory;
      return marketplaceMatch && categoryMatch;
    });

    console.log("✅ Filtered Products:", filtered.length, "from", allProducts.length);
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
