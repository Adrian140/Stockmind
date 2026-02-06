import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { keepaService } from "../services/keepa.service";

const KeepaContext = createContext();

export const useKeepa = () => {
  const context = useContext(KeepaContext);
  if (!context) {
    throw new Error("useKeepa must be used within KeepaProvider");
  }
  return context;
};

// Helper pentru verificare dacă e aceeași zi
const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Helper pentru timestamp miezul nopții de azi
const getMidnightToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

// Helper pentru timestamp miezul nopții de mâine
const getNextMidnight = () => {
  const midnight = getMidnightToday();
  midnight.setDate(midnight.getDate() + 1);
  return midnight;
};

export const KeepaProvider = ({ children }) => {
  const [tokenBalance, setTokenBalance] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [nextSync, setNextSync] = useState(null);
  const [productsCache, setProductsCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verifică dacă trebuie să facă refresh (după miezul nopții)
  const shouldRefreshData = useCallback(() => {
    const lastSyncStr = localStorage.getItem("keepa_last_sync");
    if (!lastSyncStr) return true; // Prima rulare

    const lastSyncDate = new Date(lastSyncStr);
    const now = new Date();
    const midnightToday = getMidnightToday();

    // Dacă ultima sincronizare a fost înainte de miezul nopții de azi → refresh necesar
    return lastSyncDate < midnightToday && now >= midnightToday;
  }, []);

  // Salvează timestamp-ul sincronizării
  const updateLastSync = useCallback(() => {
    const now = new Date();
    localStorage.setItem("keepa_last_sync", now.toISOString());
    setLastSync(now);
    setNextSync(getNextMidnight());
  }, []);

  // Încarcă cache din localStorage
  const loadCacheFromStorage = useCallback(() => {
    try {
      const cached = localStorage.getItem("keepa_products_cache");
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setProductsCache(parsedCache);
        return parsedCache;
      }
    } catch (err) {
      console.error("Error loading Keepa cache:", err);
    }
    return {};
  }, []);

  // Salvează cache în localStorage
  const saveCacheToStorage = useCallback((cache) => {
    try {
      localStorage.setItem("keepa_products_cache", JSON.stringify(cache));
    } catch (err) {
      console.error("Error saving Keepa cache:", err);
    }
  }, []);

  // Fetch token balance (no cache)
  const fetchTokenBalance = useCallback(async () => {
    try {
      const balance = await keepaService.getTokenBalance();
      setTokenBalance(balance);
      return balance;
    } catch (err) {
      console.error("Error fetching token balance:", err);
      setError(err.message);
      return null;
    }
  }, []);

  // Fetch produse cu cache inteligent (refresh doar la miezul nopții)
  const fetchProducts = useCallback(
    async (asins, domain = "US", options = {}) => {
      const cacheKey = `${asins.join(",")}_${domain}`;

      // Verifică dacă trebuie refresh
      if (!shouldRefreshData() && productsCache[cacheKey]) {
        console.log("✅ Using cached Keepa data (no midnight refresh needed)");
        return productsCache[cacheKey];
      }

      // Dacă e după miezul nopții → fetch fresh data
      console.log("🔄 Fetching fresh Keepa data (midnight refresh)");
      setLoading(true);
      setError(null);

      try {
        const products = await keepaService.queryProducts(asins, domain, options);

        // Update cache
        const newCache = { ...productsCache, [cacheKey]: products };
        setProductsCache(newCache);
        saveCacheToStorage(newCache);

        // Update last sync timestamp
        updateLastSync();

        setLoading(false);
        return products;
      } catch (err) {
        console.error("Error fetching products:", err);
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [productsCache, shouldRefreshData, saveCacheToStorage, updateLastSync]
  );

  // Force refresh manual (pentru cazuri speciale)
  const forceRefresh = useCallback(async (asins, domain = "US", options = {}) => {
    console.log("🔄 Force refresh Keepa data (manual trigger)");
    setLoading(true);
    setError(null);

    try {
      const products = await keepaService.queryProducts(asins, domain, options);

      const cacheKey = `${asins.join(",")}_${domain}`;
      const newCache = { ...productsCache, [cacheKey]: products };
      setProductsCache(newCache);
      saveCacheToStorage(newCache);
      updateLastSync();

      setLoading(false);
      return products;
    } catch (err) {
      console.error("Error force refreshing:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [productsCache, saveCacheToStorage, updateLastSync]);

  // Clear cache complet
  const clearCache = useCallback(() => {
    setProductsCache({});
    localStorage.removeItem("keepa_products_cache");
    localStorage.removeItem("keepa_last_sync");
    setLastSync(null);
    setNextSync(getNextMidnight());
    console.log("🗑️ Keepa cache cleared");
  }, []);

  // Setup: încarcă cache și verifică dacă trebuie refresh
  useEffect(() => {
    // Încarcă cache din localStorage
    loadCacheFromStorage();

    // Încarcă last sync timestamp
    const lastSyncStr = localStorage.getItem("keepa_last_sync");
    if (lastSyncStr) {
      setLastSync(new Date(lastSyncStr));
    }
    setNextSync(getNextMidnight());

    // Fetch token balance (lightweight, nu consumă mulți tokeni)
    fetchTokenBalance();

    // Scheduler: verifică la fiecare minut dacă e miezul nopții
    const checkMidnight = setInterval(() => {
      const now = new Date();
      const midnight = getMidnightToday();
      const nextMidnight = getNextMidnight();

      // Dacă suntem între 00:00 și 00:01 și trebuie refresh
      if (now >= midnight && now < new Date(midnight.getTime() + 60000) && shouldRefreshData()) {
        console.log("🌙 Midnight reached - triggering auto-refresh");
        // Trigger refresh pentru produsele din cache
        const cachedKeys = Object.keys(productsCache);
        if (cachedKeys.length > 0) {
          const firstKey = cachedKeys[0];
          const [asinsStr, domain] = firstKey.split("_");
          const asins = asinsStr.split(",");
          fetchProducts(asins, domain, { stats: 365, history: true, buybox: true });
        }
      }

      // Update next sync time
      setNextSync(nextMidnight);
    }, 60000); // Check every minute

    return () => clearInterval(checkMidnight);
  }, [fetchTokenBalance, loadCacheFromStorage, shouldRefreshData, fetchProducts, productsCache]);

  const value = {
    tokenBalance,
    lastSync,
    nextSync,
    productsCache,
    loading,
    error,
    fetchTokenBalance,
    fetchProducts,
    forceRefresh,
    clearCache,
  };

  return <KeepaContext.Provider value={value}>{children}</KeepaContext.Provider>;
};
