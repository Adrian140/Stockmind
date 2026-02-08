import React, { createContext, useContext, useState, useEffect } from "react";
import { sellerboardService } from "../services/sellerboard.service";
import toast from "react-hot-toast";

const SellerboardContext = createContext(null);

export function SellerboardProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const fetchSellerboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerboardService.getAllData();
      setProducts(data);
      setLastSync(new Date());
      if (data.length > 0) {
        toast.success(`Loaded ${data.length} products from Sellerboard!`);
      } else {
        toast.error("No products found. Check your Sellerboard URL configuration.");
      }
    } catch (error) {
      console.error("Error syncing Sellerboard data:", error);
      setError(error.message);
      toast.error("Failed to sync Sellerboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerboardData();

    const interval = setInterval(() => {
      fetchSellerboardData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    sellerboardService.clearCache();
    await fetchSellerboardData();
  };

  const value = {
    products,
    loading,
    lastSync,
    error,
    refreshData
  };

  return (
    <SellerboardContext.Provider value={value}>
      {children}
    </SellerboardContext.Provider>
  );
}

export function useSellerboard() {
  const context = useContext(SellerboardContext);
  if (!context) {
    throw new Error("useSellerboard must be used within SellerboardProvider");
  }
  return context;
}
