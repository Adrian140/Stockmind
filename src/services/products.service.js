import { supabase } from "../lib/supabase";

class ProductsService {
  constructor() {
    this.cache = {
      products: [],
      salesHistory: [],
      lastFetch: null
    };
    this.cacheDuration = 2 * 60 * 1000;
  }

  normalizeImageUrl(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
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
      return first.trim().replace(/^"+|"+$/g, "") || null;
    }
    return trimmed.replace(/^"+|"+$/g, "") || null;
  }

  async getAllProducts(userId) {
    try {
      if (!userId) {
        console.warn("⚠️ No userId provided to getAllProducts");
        return [];
      }

      const cacheAge = this.cache.lastFetch ? Date.now() - this.cache.lastFetch : Infinity;
      if (this.cache.products.length > 0 && cacheAge < this.cacheDuration) {
        console.log("✅ Using cached products from Supabase");
        return this.cache.products;
      }

      console.log("🔄 Fetching products from Supabase for user:", userId);

      const pageSize = 1000;
      let allData = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("❌ Error fetching products:", error);
          throw error;
        }

        allData = allData.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      const { data: imageData } = await supabase
        .from("asin_images")
        .select("asin,image_url")
        .eq("user_id", userId);

      const imageMap = new Map((imageData || []).map((row) => [row.asin, row.image_url]));

      const products = (allData || []).map(p => ({
        id: p.id,
        asin: p.asin,
        sku: p.sku,
        title: p.title,
        imageUrl: this.normalizeImageUrl(p.image_url) || this.normalizeImageUrl(imageMap.get(p.asin)) || this.normalizeImageUrl(p.image) || null,
        brand: p.brand,
        category: p.category,
        targetUser: p.target_user,
        marketplace: p.marketplace,
        status: p.status,
        tags: p.tags || [],
        units30d: Number(p.units_30d) || 0,
        units90d: Number(p.units_90d) || 0,
        units365d: Number(p.units_365d) || 0,
        unitsAllTime: Number(p.units_all_time) || 0,
        revenue30d: parseFloat(p.revenue_30d) || 0,
        profit30d: parseFloat(p.profit_30d) || 0,
        profitUnit: parseFloat(p.profit_unit) || 0,
        cogs: parseFloat(p.cogs) || 0,
        bbCurrent: parseFloat(p.bb_current) || 0,
        bbAvg7d: parseFloat(p.bb_avg_7d) || 0,
        bbAvg30d: parseFloat(p.bb_avg_30d) || 0,
        volatility30d: parseFloat(p.volatility_30d) || 0,
        roi: parseFloat(p.roi) || 0,
        stockQty: p.stock_qty || 0,
        daysSinceLastSale: p.days_since_last_sale || 0,
        peakMonths: p.peak_months || [],
        salesHistory: []
      }));

      this.cache.products = products;
      this.cache.lastFetch = Date.now();

      console.log("✅ Fetched products from Supabase:", products.length);
      return products;
    } catch (error) {
      console.error("❌ Error in getAllProducts:", error);
      return this.cache.products.length > 0 ? this.cache.products : [];
    }
  }

  async getProductsWithSalesHistory(userId) {
    try {
      const products = await this.getAllProducts(userId);

      const { data: salesData, error } = await supabase
        .from("sales_history")
        .select("*")
        .eq("user_id", userId)
        .order("year", { ascending: true })
        .order("month", { ascending: true });

      if (error) {
        console.error("❌ Error fetching sales history:", error);
        return products;
      }

      const salesByProduct = {};
      (salesData || []).forEach(sale => {
        if (!salesByProduct[sale.product_id]) {
          salesByProduct[sale.product_id] = [];
        }
        salesByProduct[sale.product_id].push({
          month: this.getMonthName(sale.month),
          year: sale.year,
          units: sale.units || 0,
          revenue: parseFloat(sale.revenue) || 0,
          profit: parseFloat(sale.profit) || 0
        });
      });

      const productsWithHistory = products.map(p => ({
        ...p,
        salesHistory: salesByProduct[p.id] || []
      }));

      return productsWithHistory;
    } catch (error) {
      console.error("❌ Error in getProductsWithSalesHistory:", error);
      return [];
    }
  }

  async getAggregatedSalesData(userId) {
    try {
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from("sales_history")
        .select("month, year, units, revenue")
        .eq("user_id", userId)
        .eq("year", currentYear)
        .order("month", { ascending: true });

      if (error) throw error;

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const aggregated = {};
      (data || []).forEach(row => {
        const monthKey = row.month;
        if (!aggregated[monthKey]) {
          aggregated[monthKey] = {
            month: monthNames[row.month - 1],
            units: 0,
            revenue: 0
          };
        }
        aggregated[monthKey].units += row.units || 0;
        aggregated[monthKey].revenue += parseFloat(row.revenue) || 0;
      });

      const result = Object.values(aggregated);

      while (result.length < 10) {
        const monthIdx = result.length;
        result.push({
          month: monthNames[monthIdx],
          units: 0,
          revenue: 0
        });
      }

      return result.slice(0, 10);
    } catch (error) {
      console.error("❌ Error getting aggregated sales:", error);
      return [];
    }
  }

  async getBuyBoxTrendData(userId) {
    try {
      const products = await this.getAllProducts(userId);

      if (products.length === 0) {
        return [];
      }

      const currentDate = new Date();
      const trendData = [];

      for (let i = 9; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const avgBB = products.reduce((sum, p) => sum + (p.bbAvg30d || 0), 0) / products.length;

        trendData.push({
          date: monthKey,
          avg: parseFloat(avgBB.toFixed(2))
        });
      }

      return trendData;
    } catch (error) {
      console.error("❌ Error calculating buy box trend:", error);
      return [];
    }
  }

  async saveProduct(userId, productData) {
    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: userId,
          asin: productData.asin,
          sku: productData.sku,
          title: productData.title,
          brand: productData.brand,
          category: productData.category,
          target_user: productData.targetUser,
          marketplace: productData.marketplace,
          status: productData.status || "active",
          tags: productData.tags || [],
          units_30d: productData.units30d || 0,
          units_90d: productData.units90d || 0,
          units_365d: productData.units365d || 0,
          revenue_30d: productData.revenue30d || 0,
          profit_30d: productData.profit30d || 0,
          profit_unit: productData.profitUnit || 0,
          cogs: productData.cogs || 0,
          bb_current: productData.bbCurrent || 0,
          bb_avg_7d: productData.bbAvg7d || 0,
          bb_avg_30d: productData.bbAvg30d || 0,
          volatility_30d: productData.volatility30d || 0,
          roi: productData.roi || 0,
          stock_qty: productData.stockQty || 0,
          days_since_last_sale: productData.daysSinceLastSale || 0,
          peak_months: productData.peakMonths || []
        })
        .select()
        .single();

      if (error) throw error;

      this.clearCache();

      return { success: true, data };
    } catch (error) {
      console.error("❌ Error saving product:", error);
      return { success: false, error: error.message };
    }
  }

  async updateProduct(productId, userId, updates) {
    try {
      const dbUpdates = {};
      if (updates.sku !== undefined) dbUpdates.sku = updates.sku;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.units30d !== undefined) dbUpdates.units_30d = updates.units30d;
      if (updates.units90d !== undefined) dbUpdates.units_90d = updates.units90d;
      if (updates.units365d !== undefined) dbUpdates.units_365d = updates.units365d;
      if (updates.revenue30d !== undefined) dbUpdates.revenue_30d = updates.revenue30d;
      if (updates.profit30d !== undefined) dbUpdates.profit_30d = updates.profit30d;
      if (updates.profitUnit !== undefined) dbUpdates.profit_unit = updates.profitUnit;
      if (updates.cogs !== undefined) dbUpdates.cogs = updates.cogs;
      if (updates.bbCurrent !== undefined) dbUpdates.bb_current = updates.bbCurrent;
      if (updates.bbAvg7d !== undefined) dbUpdates.bb_avg_7d = updates.bbAvg7d;
      if (updates.bbAvg30d !== undefined) dbUpdates.bb_avg_30d = updates.bbAvg30d;
      if (updates.volatility30d !== undefined) dbUpdates.volatility_30d = updates.volatility30d;
      if (updates.roi !== undefined) dbUpdates.roi = updates.roi;
      if (updates.stockQty !== undefined) dbUpdates.stock_qty = updates.stockQty;
      if (updates.daysSinceLastSale !== undefined) dbUpdates.days_since_last_sale = updates.daysSinceLastSale;
      if (updates.peakMonths !== undefined) dbUpdates.peak_months = updates.peakMonths;

      const { data, error } = await supabase
        .from("products")
        .update(dbUpdates)
        .eq("id", productId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      this.clearCache();

      return { success: true, data };
    } catch (error) {
      console.error("❌ Error updating product:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteProduct(productId, userId) {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("user_id", userId);

      if (error) throw error;

      this.clearCache();

      return { success: true };
    } catch (error) {
      console.error("❌ Error deleting product:", error);
      return { success: false, error: error.message };
    }
  }

  async saveSalesHistory(userId, productId, salesData) {
    try {
      const records = salesData.map(sale => ({
        user_id: userId,
        product_id: productId,
        month: sale.month,
        year: sale.year,
        units: sale.units || 0,
        revenue: sale.revenue || 0,
        profit: sale.profit || 0
      }));

      const { data, error } = await supabase
        .from("sales_history")
        .upsert(records, {
          onConflict: "product_id,month,year"
        })
        .select();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("❌ Error saving sales history:", error);
      return { success: false, error: error.message };
    }
  }

  async upsertSellerboardProducts(userId, products) {
    try {
      if (!userId || !Array.isArray(products) || products.length === 0) {
        return { success: true, count: 0 };
      }

      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

      const recordsRaw = products.map(p => ({
        user_id: userId,
        asin: p.asin,
        sku: p.sku,
        title: p.title,
        category: p.category,
        marketplace: p.marketplace,
        status: p.status || "active",
        tags: p.tags || [],
        units_30d: p.units30d || 0,
        units_90d: p.units90d || 0,
        units_365d: p.units365d || 0,
        units_all_time: p.unitsAllTime || 0,
        revenue_30d: p.revenue30d || 0,
        profit_30d: p.profit30d || 0,
        profit_unit: p.profitUnit || 0,
        cogs: p.cogs || 0,
        bb_current: p.bbCurrent || 0,
        bb_avg_7d: p.bbAvg7d || 0,
        bb_avg_30d: p.bbAvg30d || 0,
        volatility_30d: p.volatility30d || 0,
        roi: clamp(Number.isFinite(p.roi) ? p.roi : 0, -999.99, 999.99),
        stock_qty: p.stockQty || 0,
        days_since_last_sale: p.daysSinceLastSale || 0,
        peak_months: p.peakMonths || []
      }));

      const deduped = new Map();
      for (const r of recordsRaw) {
        const key = `${r.user_id}|${r.sku}|${r.marketplace}`;
        if (!deduped.has(key)) deduped.set(key, r);
      }
      const records = Array.from(deduped.values());

      const { data, error } = await supabase
        .from("products")
        .upsert(records, {
          onConflict: "user_id,sku,marketplace"
        })
        .select("id");

      if (error) throw error;

      this.clearCache();

      return { success: true, count: data?.length || 0 };
    } catch (error) {
      console.error("❌ Error upserting Sellerboard products:", error);
      return { success: false, error: error.message };
    }
  }

  async refreshProductsFromDaily(userId) {
    try {
      if (!userId) return { success: false, error: "Missing userId" };
      const { error } = await supabase
        .rpc("refresh_products_from_daily", { p_user: userId });
      if (error) throw error;
      this.clearCache();
      return { success: true };
    } catch (error) {
      console.error("❌ Error refreshing products from daily:", error);
      return { success: false, error: error.message };
    }
  }

  getMonthName(monthNum) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthNum - 1] || "Jan";
  }

  clearCache() {
    this.cache.products = [];
    this.cache.salesHistory = [];
    this.cache.lastFetch = null;
    console.log("🗑️ Products cache cleared");
  }
}

export const productsService = new ProductsService();
