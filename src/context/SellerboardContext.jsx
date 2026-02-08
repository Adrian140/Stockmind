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
    // Sellerboard fetch disabled in frontend; data is populated by server-side sync.
    setProducts([]);
    setLastSync(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    // Auto-fetch disabled: only manual refresh should load Sellerboard data.
    return () => {};
  }, []);

  const refreshData = async () => {
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
