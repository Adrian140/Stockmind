export const formatKeepaPrice = (price) => {
  if (price === null || price === undefined || price === -1) {
    return null;
  }
  return (price / 100).toFixed(2);
};

export const formatKeepaDate = (keepaTimestamp) => {
  const keepaEpoch = new Date("2011-01-01T00:00:00Z").getTime();
  const milliseconds = keepaEpoch + (keepaTimestamp * 60 * 1000);
  return new Date(milliseconds);
};

export const transformKeepaProductToApp = (keepaProduct) => {
  const stats = keepaProduct.stats || {};
  const csv = keepaProduct.csv || [];

  const getCurrentValue = (csvType) => {
    if (!csv[csvType] || csv[csvType].length === 0) return null;
    return csv[csvType][csv[csvType].length - 1];
  };

  return {
    asin: keepaProduct.asin,
    title: keepaProduct.title || "Unknown Product",
    image: keepaProduct.imagesCSV ? keepaProduct.imagesCSV.split(",")[0] : null,
    category: keepaProduct.categoryTree?.[0]?.name || "Unknown",
    brand: keepaProduct.brand || "Unknown",
    pricing: {
      current: formatKeepaPrice(stats.current?.[0]),
      avg90: formatKeepaPrice(stats.avg?.[0]),
      min90: formatKeepaPrice(stats.min?.[0]),
      max90: formatKeepaPrice(stats.max?.[0]),
      buyBox: formatKeepaPrice(stats.buyBoxPrice),
      listPrice: formatKeepaPrice(getCurrentValue(4))
    },
    salesRank: {
      current: stats.current?.[3] || null,
      avg90: stats.avg?.[3] || null,
      drops90: stats.salesRankDrops90 || 0,
      category: keepaProduct.categoryTree?.[0]?.catId || null
    },
    stock: {
      outOfStockPercentage30: stats.outOfStockPercentage30 || 0,
      outOfStockPercentage90: stats.outOfStockPercentage90 || 0,
      isInStock: getCurrentValue(0) !== -1
    },
    reviews: {
      rating: getCurrentValue(16) ? getCurrentValue(16) / 10 : null,
      count: getCurrentValue(17) || 0
    },
    buyBox: {
      seller: keepaProduct.buyBoxSellerId || null,
      isAmazon: keepaProduct.buyBoxIsAmazon || false,
      isMAP: keepaProduct.buyBoxIsMAP || false,
      shipping: formatKeepaPrice(keepaProduct.buyBoxShipping),
      availability: keepaProduct.buyBoxAvailability || null
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataQuality: stats.current ? "complete" : "partial",
      hasHistory: csv.length > 0
    }
  };
};

export const transformKeepaHistoryForChart = (csvData, type = "price") => {
  if (!csvData || csvData.length === 0) {
    return [];
  }

  const chartData = [];
  for (let i = 0; i < csvData.length; i += 2) {
    const timestamp = csvData[i];
    const value = csvData[i + 1];
    if (value !== undefined && value !== -1) {
      const date = formatKeepaDate(timestamp);
      chartData.push({
        date: date.toISOString().split("T")[0],
        timestamp: date.getTime(),
        value: type === "price" ? formatKeepaPrice(value) : value,
        rawValue: value
      });
    }
  }
  return chartData.sort((a, b) => a.timestamp - b.timestamp);
};

export const calculateProfitMargins = (product, costs = {}) => {
  const {
    purchasePrice = 0,
    shippingCost = 0,
    prepCost = 0,
    amazonFees = 0.15,
    fbaFees = 0
  } = costs;

  const sellingPrice = parseFloat(product.pricing?.buyBox || product.pricing?.current || 0);
  const totalCost = purchasePrice + shippingCost + prepCost + fbaFees;
  const amazonFee = sellingPrice * amazonFees;
  const totalFees = amazonFee + fbaFees;
  const profit = sellingPrice - totalCost - totalFees;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    sellingPrice,
    totalCost,
    totalFees,
    profit,
    margin: margin.toFixed(2),
    roi: roi.toFixed(2),
    breakeven: totalCost + totalFees
  };
};

export const detectSeasonalTrends = (salesRankHistory) => {
  if (!salesRankHistory || salesRankHistory.length < 30) {
    return { isSeasonal: false, confidence: 0 };
  }

  const monthlyData = {};
  salesRankHistory.forEach(point => {
    const date = new Date(point.date);
    const month = date.getMonth();
    if (!monthlyData[month]) {
      monthlyData[month] = [];
    }
    monthlyData[month].push(point.value);
  });

  const monthlyAverages = Object.entries(monthlyData).map(([month, values]) => ({
    month: parseInt(month),
    avgRank: values.reduce((sum, val) => sum + val, 0) / values.length
  }));

  const overallAvg = monthlyAverages.reduce((sum, m) => sum + m.avgRank, 0) / monthlyAverages.length;
  let significantMonths = 0;
  monthlyAverages.forEach(m => {
    const deviation = Math.abs(m.avgRank - overallAvg) / overallAvg;
    if (deviation > 0.3) {
      significantMonths++;
    }
  });

  const isSeasonal = significantMonths >= 2;
  const confidence = (significantMonths / 12) * 100;

  return {
    isSeasonal,
    confidence: Math.round(confidence),
    monthlyAverages,
    peakMonths: monthlyAverages
      .filter(m => m.avgRank < overallAvg * 0.7)
      .map(m => m.month)
  };
};

export const getClearanceScore = (product) => {
  let score = 0;
  const factors = [];

  const outOfStock = product.stock?.outOfStockPercentage90 || 0;
  if (outOfStock > 20) {
    score += 30;
    factors.push(`High out-of-stock: ${outOfStock.toFixed(0)}%`);
  }

  const salesRankDrops = product.salesRank?.drops90 || 0;
  if (salesRankDrops < 5) {
    score += 25;
    factors.push(`Low sales activity: ${salesRankDrops} drops`);
  }

  const currentPrice = parseFloat(product.pricing?.current || 0);
  const avgPrice = parseFloat(product.pricing?.avg90 || currentPrice);
  const priceDiscount = ((avgPrice - currentPrice) / avgPrice) * 100;
  if (priceDiscount > 20) {
    score += 45;
    factors.push(`Price drop: ${priceDiscount.toFixed(0)}% below average`);
  } else if (priceDiscount > 10) {
    score += 25;
    factors.push(`Moderate discount: ${priceDiscount.toFixed(0)}%`);
  }

  const reviewCount = product.reviews?.count || 0;
  if (reviewCount < 50) {
    score += 10;
    factors.push("Low review count");
  }

  return {
    score: Math.min(score, 100),
    level: score > 70 ? "high" : score > 40 ? "medium" : "low",
    factors
  };
};

export const formatCurrency = (value, currency = "USD") => {
  if (value === null || value === undefined) return "N/A";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(value);
};

export const formatNumber = (value) => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
};

export const getProductUrl = (asin, domain = "US") => {
  const domainUrls = {
    US: "amazon.com",
    UK: "amazon.co.uk",
    DE: "amazon.de",
    FR: "amazon.fr",
    IT: "amazon.it",
    ES: "amazon.es",
    CA: "amazon.ca",
    JP: "amazon.co.jp",
    IN: "amazon.in",
    MX: "amazon.com.mx"
  };
  const domainUrl = domainUrls[domain] || domainUrls.US;
  return `https://www.${domainUrl}/dp/${asin}`;
};
