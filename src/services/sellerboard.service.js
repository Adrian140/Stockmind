import { supabase } from "../lib/supabase";

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================

const SELLERBOARD_API_BASE = "https://api.sellerboard.com/v1";

// Marketplace mapping
const MARKETPLACE_MAP = {
  "amazon.de": "DE",
  "amazon.co.uk": "UK",
  "amazon.fr": "FR",
  "amazon.it": "IT",
  "amazon.es": "ES",
  "amazon.com": "US",
  "amazon.ca": "CA",
  "amazon.com.mx": "MX",
  "amazon.co.jp": "JP",
  "amazon.com.au": "AU"
};

// Category mapping from Sellerboard categories to our simplified categories
const CATEGORY_MAP = {
  "Electronics": "electronics",
  "Computers & Accessories": "electronics",
  "Cell Phones & Accessories": "electronics",
  "Home & Kitchen": "home",
  "Kitchen & Dining": "home",
  "Sports & Outdoors": "sports",
  "Toys & Games": "toys",
  "Beauty & Personal Care": "beauty",
  "Health & Household": "beauty",
  "Clothing, Shoes & Jewelry": "fashion",
  "Books": "books",
  "Office Products": "office",
  "Automotive": "automotive",
  "Tools & Home Improvement": "tools",
  "Garden & Outdoor": "garden",
  "Pet Supplies": "pets",
  "Baby": "baby"
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Map Sellerboard marketplace to our marketplace code
 */
function mapMarketplace(sellerboardMarketplace) {
  if (!sellerboardMarketplace) return "DE";
  const marketplace = sellerboardMarketplace.toLowerCase().trim();
  return MARKETPLACE_MAP[marketplace] || "DE";
}

/**
 * Map Sellerboard category to our simplified category
 */
function mapCategory(sellerboardCategory) {
  if (!sellerboardCategory) return "other";
  // Try exact match first
  if (CATEGORY_MAP[sellerboardCategory]) {
    return CATEGORY_MAP[sellerboardCategory];
  }
  // Try partial match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (sellerboardCategory.includes(key)) {
      return value;
    }
  }
  return "other";
}

/**
 * Parse CSV string into array of objects (handles quoted commas)
 */
function parseCSV(csvText) {
  if (!csvText || csvText.trim() === "") {
    console.warn("⚠️ Empty CSV received");
    return [];
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"' && next === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) {
    console.warn("⚠️ CSV has no data rows");
    return [];
  }

  const headers = rows[0].map(h => h.trim());
  console.log("📋 CSV HEADERS:", headers);
  console.log("📊 TOTAL COLUMNS:", headers.length);
  console.log("📊 TOTAL DATA ROWS:", rows.length - 1);

  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (!values || values.length === 0) continue;
    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = (values[index] ?? "").trim();
    });
    data.push(rowObj);
  }

  console.log("✅ PARSED ROWS:", data.length);
  return data;
}

/**
 * Map CSV columns to our product structure
 */
function mapCSVToProducts(csvData) {
  console.log("🔧 MAPPING CSV TO PRODUCTS...");
  console.log("📥 Input rows:", csvData.length);

  // 🔍 COLUMN DETECTION - Log what we're looking for
  console.log("🔍 LOOKING FOR THESE COLUMNS:");
  console.log('  - ASIN: "ASIN", "asin", "SKU", "sku"');
  console.log('  - Title: "Title", "title", "Product Name", "Name"');
  console.log('  - Marketplace: "Marketplace", "marketplace", "Market"');
  console.log('  - Category: "Category", "category", "Product Group"');
  console.log('  - Units30d: "Units (Last 30 days)", "Units30", "Sales30"');
  console.log('  - Revenue30d: "Revenue (Last 30 days)", "Revenue30"');
  console.log('  - Price: "Price", "price", "Current Price"');

  if (csvData.length > 0) {
    console.log("🔍 AVAILABLE COLUMNS IN CSV:", Object.keys(csvData[0]));
  }

  // Aggregate daily rows into 30d per ASIN
  const byAsin = new Map();
  for (const row of csvData) {
    const asin = row["ASIN"] || row["asin"] || "";
    if (!asin) continue;

    const title = row["Name"] || row["Title"] || row["Product Name"] || "";
    const marketplace = row["Marketplace"] || row["marketplace"] || "";
    const category = row["Category"] || row["Product Group"] || "";

    const units =
      parseFloat(row["UnitsOrganic"] || 0) +
      parseFloat(row["UnitsPPC"] || 0) +
      parseFloat(row["UnitsSponsoredProducts"] || 0) +
      parseFloat(row["UnitsSponsoredDisplay"] || 0);

    const revenue =
      parseFloat(row["SalesOrganic"] || 0) +
      parseFloat(row["SalesPPC"] || 0) +
      parseFloat(row["SalesSponsoredProducts"] || 0) +
      parseFloat(row["SalesSponsoredDisplay"] || 0);

    const netProfit = parseFloat(row["NetProfit"] || 0);
    const roi = parseFloat(row["ROI"] || 0);

    if (!byAsin.has(asin)) {
      byAsin.set(asin, {
        ASIN: asin,
        Title: title,
        Marketplace: mapMarketplace(marketplace),
        Category: mapCategory(category),
        Units30d: 0,
        Revenue30d: 0,
        Profit30d: 0,
        ROI: 0,
        rows: 0
      });
    }

    const agg = byAsin.get(asin);
    agg.Units30d += units;
    agg.Revenue30d += revenue;
    agg.Profit30d += netProfit;
    agg.ROI += roi;
    agg.rows += 1;
  }

  const validProducts = Array.from(byAsin.values()).map(p => ({
    ...p,
    ProfitUnit: p.Units30d > 0 ? p.Profit30d / p.Units30d : 0,
    ROI: p.rows > 0 ? p.ROI / p.rows : 0
  }));

  console.log("🔧 SELLERBOARD PRODUCTS PROCESSED:");
  console.table(validProducts.slice(0, 5).map(p => ({
    ASIN: p.ASIN,
    Title: p.Title,
    Marketplace: p.Marketplace,
    Category: p.Category,
    Units30d: p.Units30d
  })));

  console.log(`✅ Valid products: ${validProducts.length} / ${products.length}`);

  return validProducts;
}

/**
 * Fetch data from Sellerboard via proxy
 */
async function fetchFromSellerboard(reportType) {
  try {
    const response = await fetch(`/api/sellerboard?reportType=${reportType}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${reportType}: ${response.status}`);
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error fetching ${reportType}:`, error);
    throw error;
  }
}

// ==========================================
// SELLERBOARD SERVICE CLASS
// ==========================================

class SellerboardService {
  constructor() {
    this.cache = {
      products: [],
      lastFetch: null
    };
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all data from Sellerboard
   */
  async getAllData() {
    try {
      // Check cache
      if (this.cache.products.length > 0 && this.cache.lastFetch) {
        const cacheAge = Date.now() - this.cache.lastFetch;
        if (cacheAge < this.cacheDuration) {
          console.log("✅ Using cached Sellerboard data");
          return this.cache.products;
        }
      }

      console.log("🔄 Fetching fresh Sellerboard data...");
      // Fetch sales data
      const salesData = await fetchFromSellerboard("sales_30d");
      const products = mapCSVToProducts(salesData);

      // Update cache
      this.cache.products = products;
      this.cache.lastFetch = Date.now();

      return products;
    } catch (error) {
      console.error("❌ Error fetching Sellerboard data:", error);
      // Return cached data if available
      if (this.cache.products.length > 0) {
        console.log("⚠️ Returning stale cached data");
        return this.cache.products;
      }
      // Return empty array if no cache
      return [];
    }
  }

  /**
   * Clear cache to force fresh data fetch
   */
  clearCache() {
    this.cache.products = [];
    this.cache.lastFetch = null;
    console.log("🗑️ Sellerboard cache cleared");
  }
}

// ==========================================
// EXPORTS
// ==========================================

// Export service instance
export const sellerboardService = new SellerboardService();

// Export individual functions for direct use
export async function saveSellerboardCredentials(userId, credentials) {
  try {
    const { data, error } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: userId,
        integration_type: "sellerboard",
        api_key: credentials.apiKey,
        refresh_token: credentials.refreshToken,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id,integration_type"
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error("❌ Error saving Sellerboard credentials:", error);
    return { success: false, error: error.message };
  }
}

export async function getSellerboardCredentials(userId) {
  try {
    const { data, error } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("integration_type", "sellerboard")
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "No credentials found" };
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("❌ Error getting Sellerboard credentials:", error);
    return { success: false, error: error.message };
  }
}

export async function testSellerboardConnection(apiKey, refreshToken) {
  try {
    console.log("🔍 Testing Sellerboard connection...");

    const response = await fetch("/api/sellerboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "test",
        apiKey,
        refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log("✅ Sellerboard connection successful");
      return { success: true };
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (error) {
    console.error("❌ Sellerboard connection test failed:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchSellerboardProducts(userId) {
  try {
    console.log("📡 Fetching Sellerboard products for user:", userId);

    const credentialsResult = await getSellerboardCredentials(userId);
    if (!credentialsResult.success) {
      console.warn("⚠️ No Sellerboard credentials found");
      return { success: false, error: "No credentials found" };
    }

    const { api_key, refresh_token } = credentialsResult.data;

    console.log("🚀 Calling Sellerboard API...");
    const response = await fetch("/api/sellerboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "getProducts",
        apiKey: api_key,
        refreshToken: refresh_token
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const csvText = await response.text();
    console.log("📦 Received CSV data, length:", csvText.length);

    const csvData = parseCSV(csvText);
    const products = mapCSVToProducts(csvData);

    console.log("✅ Sellerboard products fetched:", products.length);

    return { success: true, products };
  } catch (error) {
    console.error("❌ Error fetching Sellerboard products:", error);
    return { success: false, error: error.message, products: [] };
  }
}

export async function removeSellerboardIntegration(userId) {
  try {
    const { error } = await supabase
      .from("user_integrations")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("integration_type", "sellerboard");

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("❌ Error removing Sellerboard integration:", error);
    return { success: false, error: error.message };
  }
}
