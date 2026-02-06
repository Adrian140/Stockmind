const KEEPA_DOMAINS = {
  US: 1,
  UK: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
  MX: 11
};

const CSV_TYPES = {
  AMAZON: 0,
  NEW: 1,
  USED: 2,
  SALES: 3,
  LISTPRICE: 4,
  COLLECTIBLE: 5,
  REFURBISHED: 6,
  NEW_FBM: 7,
  LIGHTNING_DEAL: 8,
  WAREHOUSE: 9,
  NEW_FBA: 10,
  COUNT_NEW: 11,
  COUNT_USED: 12,
  COUNT_REFURBISHED: 13,
  COUNT_COLLECTIBLE: 14,
  EXTRA_INFO_UPDATES: 15,
  RATING: 16,
  COUNT_REVIEWS: 17,
  BUY_BOX_SHIPPING: 18,
  USED_NEW_SHIPPING: 19,
  USED_VERY_GOOD_SHIPPING: 20,
  USED_GOOD_SHIPPING: 21,
  USED_ACCEPTABLE_SHIPPING: 22,
  COLLECTIBLE_NEW_SHIPPING: 23,
  COLLECTIBLE_VERY_GOOD_SHIPPING: 24,
  COLLECTIBLE_GOOD_SHIPPING: 25,
  COLLECTIBLE_ACCEPTABLE_SHIPPING: 26,
  REFURBISHED_SHIPPING: 27,
  EBAY_NEW_SHIPPING: 28,
  EBAY_USED_SHIPPING: 29,
  TRADE_IN: 30,
  RENTAL: 31
};

class KeepaService {
  constructor() {
    // Use serverless function in production, mock in dev
    this.proxyUrl = "/api/keepa";
    this.isDev = import.meta.env.DEV;
  }

  async makeRequest(endpoint, params = {}) {
    // DEV MODE: Return mock data instead of making API calls
    if (this.isDev) {
      console.log("🔧 DEV MODE: Using mock Keepa data");
      return this.getMockResponse(endpoint, params);
    }

    // PRODUCTION MODE: Use real API
    try {
      const queryParams = new URLSearchParams({
        endpoint,
        ...params
      });

      const url = `${this.proxyUrl}?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Keepa API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error) {
      console.error("Keepa API Request Error:", error);
      throw error;
    }
  }

  getMockResponse(endpoint, params) {
    // Mock responses pentru development
    if (endpoint === "/token") {
      return {
        tokensLeft: 5000,
        refillRate: 100,
        refillIn: 3600000,
        timestamp: new Date().toISOString()
      };
    }

    if (endpoint === "/product") {
      return {
        products: [],
        tokensConsumed: 0,
        tokensLeft: 5000,
        processingTimeInMs: 50,
        timestamp: new Date().toISOString()
      };
    }

    return {};
  }

  async getTokenBalance() {
    try {
      const data = await this.makeRequest("/token");
      return {
        tokensLeft: data.tokensLeft || 0,
        refillRate: data.refillRate || 0,
        refillIn: data.refillIn || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error fetching token balance:", error);
      throw error;
    }
  }

  async queryProducts(asins, domain = "US", options = {}) {
    try {
      const domainId = KEEPA_DOMAINS[domain] || KEEPA_DOMAINS.US;
      const asinsString = Array.isArray(asins) ? asins.join(",") : asins;

      const params = {
        domain: domainId,
        asin: asinsString,
        stats: options.stats || 365,
        history: options.history !== false ? 1 : 0,
        buybox: options.buybox ? 1 : 0,
        offers: options.offers || 0,
        rating: options.rating ? 1 : 0,
        shipping: options.shipping ? 1 : 0
      };

      const data = await this.makeRequest("/product", params);
      return {
        products: data.products || [],
        tokensConsumed: data.tokensConsumed || 0,
        tokensLeft: data.tokensLeft || 0,
        processingTimeInMs: data.processingTimeInMs || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error querying products:", error);
      throw error;
    }
  }

  async getProductDetails(asin, domain = "US") {
    try {
      const result = await this.queryProducts([asin], domain, {
        stats: 365,
        history: true,
        buybox: true,
        rating: true
      });

      if (!result.products || result.products.length === 0) {
        throw new Error(`Product not found: ${asin}`);
      }

      return result.products[0];
    } catch (error) {
      console.error(`Error fetching product details for ${asin}:`, error);
      throw error;
    }
  }

  async getBuyBoxData(asins, domain = "US") {
    try {
      const result = await this.queryProducts(asins, domain, {
        buybox: true,
        stats: 90,
        history: false
      });

      return result.products.map(product => ({
        asin: product.asin,
        title: product.title,
        currentBuyBoxPrice: product.stats?.buyBoxPrice || null,
        buyBoxSeller: product.buyBoxSellerId || null,
        buyBoxShipping: product.buyBoxShipping || null,
        buyBoxAvailability: product.buyBoxAvailability || null,
        isAmazon: product.buyBoxIsAmazon || false,
        isMAP: product.buyBoxIsMAP || false,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error("Error fetching buy box data:", error);
      throw error;
    }
  }

  async getProductStats(asins, domain = "US", dayRange = 90) {
    try {
      const result = await this.queryProducts(asins, domain, {
        stats: dayRange,
        history: false,
        buybox: false
      });

      return result.products.map(product => {
        const stats = product.stats || {};
        return {
          asin: product.asin,
          title: product.title,
          currentPrice: stats.current?.[0] || null,
          avgPrice: stats.avg?.[0] || null,
          minPrice: stats.min?.[0] || null,
          maxPrice: stats.max?.[0] || null,
          avgSalesRank: stats.avg?.[3] || null,
          currentSalesRank: stats.current?.[3] || null,
          outOfStockPercentage: stats.outOfStockPercentage90 || 0,
          salesRankDrops90: stats.salesRankDrops90 || 0,
          rating: product.csv?.[16] ? product.csv[16][product.csv[16].length - 1] : null,
          reviewCount: product.csv?.[17] ? product.csv[17][product.csv[17].length - 1] : null,
          lastUpdate: new Date().toISOString()
        };
      });
    } catch (error) {
      console.error("Error fetching product stats:", error);
      throw error;
    }
  }

  async getProductHistory(asins, domain = "US", days = 365) {
    try {
      const result = await this.queryProducts(asins, domain, {
        stats: days,
        history: true,
        buybox: true
      });

      return result.products.map(product => {
        const csv = product.csv || [];
        return {
          asin: product.asin,
          title: product.title,
          priceHistory: this.parseCsvData(csv[CSV_TYPES.AMAZON]),
          newPriceHistory: this.parseCsvData(csv[CSV_TYPES.NEW]),
          salesRankHistory: this.parseCsvData(csv[CSV_TYPES.SALES]),
          ratingHistory: this.parseCsvData(csv[CSV_TYPES.RATING]),
          reviewCountHistory: this.parseCsvData(csv[CSV_TYPES.COUNT_REVIEWS]),
          buyBoxHistory: this.parseCsvData(csv[CSV_TYPES.BUY_BOX_SHIPPING]),
          timestamp: new Date().toISOString()
        };
      });
    } catch (error) {
      console.error("Error fetching product history:", error);
      throw error;
    }
  }

  parseCsvData(csvArray) {
    if (!csvArray || csvArray.length === 0) {
      return [];
    }

    const result = [];
    for (let i = 0; i < csvArray.length; i += 2) {
      const timestamp = csvArray[i];
      const value = csvArray[i + 1];
      if (timestamp !== undefined && value !== undefined && value !== -1) {
        result.push({
          timestamp: this.keepaTimeToDate(timestamp),
          value: value
        });
      }
    }
    return result;
  }

  keepaTimeToDate(keepaTime) {
    const keepaEpoch = new Date("2011-01-01T00:00:00Z").getTime();
    const milliseconds = keepaEpoch + (keepaTime * 60 * 1000);
    return new Date(milliseconds).toISOString();
  }

  async searchProducts(searchTerm, domain = "US", options = {}) {
    try {
      const domainId = KEEPA_DOMAINS[domain] || KEEPA_DOMAINS.US;
      const params = {
        domain: domainId,
        type: "product",
        term: searchTerm,
        stats: options.stats || 90,
        ...options
      };

      const data = await this.makeRequest("/search", params);
      return {
        products: data.products || [],
        totalResults: data.totalResults || 0,
        tokensConsumed: data.tokensConsumed || 0
      };
    } catch (error) {
      console.error("Error searching products:", error);
      throw error;
    }
  }

  async getTopSellers(category, domain = "US", options = {}) {
    try {
      const domainId = KEEPA_DOMAINS[domain] || KEEPA_DOMAINS.US;
      const params = {
        domain: domainId,
        category: category,
        range: options.range || 0,
        ...options
      };

      const data = await this.makeRequest("/bestsellers", params);
      return {
        products: data.asinList || [],
        category: category,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error fetching top sellers:", error);
      throw error;
    }
  }
}

export const keepaService = new KeepaService();
export { KEEPA_DOMAINS, CSV_TYPES };
