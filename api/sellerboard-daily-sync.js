import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const MARKETPLACE_MAP = {
  "amazon.de": "DE",
  "amazon.co.uk": "UK",
  "amazon.fr": "FR",
  "amazon.it": "IT",
  "amazon.es": "ES",
  "amazon.nl": "NL",
  "amazon.pl": "PL",
  "amazon.se": "SE",
  "amazon.com.be": "BE",
  "amazon.ie": "IE",
  "amazon.be": "BE",
  "amazon.com": "US",
  "amazon.ca": "CA",
  "amazon.com.mx": "MX",
  "amazon.co.jp": "JP",
  "amazon.com.au": "AU"
};

const ALLOWED_MARKETS = new Set(["DE", "FR", "IT", "ES", "UK", "BE", "NL", "PL", "SE", "IE"]);

function mapMarketplace(sellerboardMarketplace) {
  if (!sellerboardMarketplace) return "DE";
  const raw = String(sellerboardMarketplace).trim();
  const normalized = raw.toLowerCase();

  let market = MARKETPLACE_MAP[normalized];
  if (!market) {
    const upper = raw.toUpperCase();
    if (ALLOWED_MARKETS.has(upper)) {
      market = upper;
    } else if (upper.startsWith("AMAZON.")) {
      if (upper === "AMAZON.COM.BE") market = "BE";
      else if (upper === "AMAZON.CO.UK") market = "UK";
      else market = upper.replace("AMAZON.", "").replace("CO.", "").replace("COM.", "").trim();
    }
  }

  return ALLOWED_MARKETS.has(market) ? market : null;
}

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseCsvDate(value) {
  if (!value) return null;
  const parts = String(value).split("/");
  if (parts.length !== 3) return null;
  const [p1, p2, p3] = parts.map((n) => parseInt(n, 10));
  if (!p1 || !p2 || !p3) return null;
  // Sellerboard export este dd/mm/yyyy (format european). Dacă totuși luna apare >12, inversăm.
  let day = p1;
  let month = p2;
  if (month > 12 && day <= 12) {
    const tmp = day;
    day = month;
    month = tmp;
  }
  const yyyy = p3;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseCSV(csvText) {
  if (!csvText || csvText.trim() === "") return [];
  const firstLine = csvText.split(/\r?\n/)[0] || "";
  const countDelimiter = (line, delimiter) => {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && next === '"') {
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && char === delimiter) count += 1;
    }
    return count;
  };

  const commaCount = countDelimiter(firstLine, ",");
  const semicolonCount = countDelimiter(firstLine, ";");
  const delimiter = semicolonCount > commaCount ? ";" : ",";

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
    if (char === delimiter && !inQuotes) {
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

  if (rows.length < 2) return [];
  const headers = rows[0].map((h, idx) => {
    const trimmed = (h || "").trim();
    if (idx === 0 && trimmed.charCodeAt(0) === 0xfeff) return trimmed.slice(1);
    return trimmed;
  });
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
  return data;
}

function mapCSVToDailyRows(csvData, fallbackMarket = null) {
  const rows = [];
  const getField = (row, variants) => {
    for (const key of variants) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
        return row[key];
      }
    }
    return null;
  };

  for (const row of csvData) {
    const asin = getField(row, ["ASIN", "asin"]) || "";
    const sku = getField(row, ["SKU", "sku"]) || "";
    const marketplace = getField(row, ["Marketplace", "marketplace"]) || "";
    const date = parseCsvDate(getField(row, ["Date", "date"]));
    if (!asin || !sku || !date) continue;
    let mappedMarketplace = mapMarketplace(marketplace);
    if (!mappedMarketplace && fallbackMarket) {
      mappedMarketplace = mapMarketplace(fallbackMarket);
    }
    if (!mappedMarketplace) continue;

    // Fallback pentru exporturile de tip „Dashboard Products” (Units/Sales/Ads/Cost of Goods)
    const units = parseNumber(getField(row, [
      "UnitsOrganic",
      "UnitsPPC",
      "UnitsSponsoredProducts",
      "UnitsSponsoredDisplay",
      "Units"
    ]));

    const revenue =
      parseNumber(getField(row, ["SalesOrganic", "Sales"])) +
      parseNumber(getField(row, ["SalesPPC", "Sponsored products (PPC)"])) +
      parseNumber(getField(row, ["SalesSponsoredProducts"])) +
      parseNumber(getField(row, ["SalesSponsoredDisplay", "Sponsored Display"]));

    const netProfit = parseNumber(getField(row, ["NetProfit", "Net profit"]));
    const roi = Math.max(-9999.99, Math.min(9999.99, parseNumber(getField(row, ["ROI"]))));
    const costTotal = parseNumber(
      getField(row, ["Cost of Goods", "ProductCost Sales", "ProductCost Sales "])
    );
    const costPerUnit = units > 0 ? Math.abs(costTotal) / units : null;

    rows.push({
      report_date: date,
      marketplace: mappedMarketplace,
      asin,
      sku,
      title: row["Name"] || row["Title"] || "",
      units_total: Math.round(units),
      revenue_total: Number(revenue.toFixed(2)),
      net_profit: Number(netProfit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      cost_of_goods: costPerUnit !== null ? Number(costPerUnit.toFixed(4)) : null,
      raw: row
    });
  }
  return rows;
}

const DAILY_URLS = {
  BE: process.env.SELLERBOARD_DAILY_URL_BE,
  DE: process.env.SELLERBOARD_DAILY_URL_DE,
  FR: process.env.SELLERBOARD_DAILY_URL_FR,
  IE: process.env.SELLERBOARD_DAILY_URL_IE,
  IT: process.env.SELLERBOARD_DAILY_URL_IT,
  NL: process.env.SELLERBOARD_DAILY_URL_NL,
  PL: process.env.SELLERBOARD_DAILY_URL_PL,
  SE: process.env.SELLERBOARD_DAILY_URL_SE,
  ES: process.env.SELLERBOARD_DAILY_URL_ES,
  UK: process.env.SELLERBOARD_DAILY_URL_UK
};

const STOCK_URL = process.env.SELLERBOARD_STOCK_URL || process.env.VITE_SELLERBOARD_STOCK_URL;

const parseMarketplaceUrlMap = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Accept JSON map: {"DE":"https://...","FR":"https://..."}
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Object.entries(parsed || {})
        .map(([k, v]) => [String(k || "").toUpperCase().trim(), String(v || "").trim()])
        .filter(([k, v]) => k && v);
    } catch (error) {
      console.warn("Invalid SELLERBOARD_DAILY_URLS JSON:", error.message);
    }
  }

  // Accept line format: DE=https://... (one per line)
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("=");
      if (idx <= 0) return null;
      const market = line.slice(0, idx).trim().toUpperCase();
      const url = line.slice(idx + 1).trim();
      return market && url ? [market, url] : null;
    })
    .filter(Boolean);
};

const listDailyUrls = () => {
  const specific = Object.entries(DAILY_URLS).filter(([, url]) => typeof url === "string" && url.trim() !== "");
  const mapped = parseMarketplaceUrlMap(process.env.SELLERBOARD_DAILY_URLS);
  const combined = [...specific, ...mapped];
  if (combined.length > 0) return combined;

  const fallback = process.env.SELLERBOARD_DAILY_URL;
  if (typeof fallback === "string" && fallback.trim() !== "") {
    return [["DEFAULT", fallback]];
  }

  return [];
};

const fetchCsvText = async (url) => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/csv",
      "User-Agent": "StockmindDailySync/1.0"
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sellerboard CSV fetch failed (${res.status}): ${text.substring(0, 200)}`);
  }
  return res.text();
};

const dedupeRows = (rows) => {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.report_date}|${r.marketplace}|${r.sku}`;
    if (!map.has(key)) map.set(key, r);
  }
  return Array.from(map.values());
};

function getField(row, variants) {
  for (const key of variants) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

function mapCSVToStockRows(csvData) {
  const rows = [];

  for (const row of csvData) {
    const asin = getField(row, ["ASIN", "asin", "Asin"]) || "";
    const sku = getField(row, ["SKU", "sku", "Sku", "SellerSKU", "Seller SKU"]) || "";
    const title = getField(row, ["Title", "title", "Name", "name"]) || "";
    const marketplaceRaw = getField(row, ["Marketplace", "marketplace", "Country", "country", "Market"]);
    const marketplace = mapMarketplace(marketplaceRaw);
    const quantity = parseNumber(
      getField(row, [
        "FBA/FBM Stock",
        "FBA / FBM Stock",
        "Available",
        "available",
        "Qty",
        "qty",
        "Quantity",
        "quantity",
        "Stock",
        "stock",
        "Inventory",
        "inventory",
        "Total stock",
        "Total Stock",
        "Available stock",
        "Available Stock",
        "FBA available",
        "FBA Available",
        "Your available qty",
        "Your Available Qty"
      ])
    );
    const stockValue = parseNumber(getField(row, ["Stock value", "stock value", "Stock Value"]));
    const reservedQty = Math.max(0, Math.round(parseNumber(getField(row, ["Reserved", "reserved"]))));
    const inboundQty = Math.max(
      0,
      Math.round(
        parseNumber(getField(row, ["Sent  to FBA", "Sent to FBA", "sent to FBA"])) +
          parseNumber(getField(row, ["Ordered", "ordered"]))
      )
    );
    const daysOfStockLeft = Math.max(
      0,
      Math.round(parseNumber(getField(row, ["Days  of stock  left", "Days of stock left"])))
    );

    if (!sku && !asin) continue;

    rows.push({
      asin,
      sku,
      title,
      marketplace,
      stock_qty: Math.max(0, Math.round(quantity)),
      reserved_qty: reservedQty,
      inbound_qty: inboundQty,
      stock_value: Number(stockValue.toFixed(2)),
      days_of_stock_left: daysOfStockLeft,
      raw: row
    });
  }

  return rows;
}

async function upsertStockSnapshots(supabase, userId, stockRows, snapshotDate, batchSize = 500) {
  if (!stockRows.length) return 0;

  const byKey = new Map();
  for (const row of stockRows) {
    const key = `${snapshotDate}|${row.marketplace || ""}|${row.sku || ""}|${row.asin || ""}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  const uniqueRows = Array.from(byKey.values()).map((row) => ({
    user_id: userId,
    snapshot_date: snapshotDate,
    marketplace: row.marketplace || "DE",
    asin: row.asin || "",
    sku: row.sku || "",
    title: row.title || "",
    stock_qty: row.stock_qty || 0,
    reserved_qty: row.reserved_qty || 0,
    inbound_qty: row.inbound_qty || 0,
    stock_value: row.stock_value || 0,
    days_of_stock_left: row.days_of_stock_left || 0,
    raw: row.raw || {}
  }));

  let total = 0;
  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const batch = uniqueRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("sellerboard_stock_daily")
      .upsert(batch, {
        onConflict: "user_id,snapshot_date,marketplace,sku,asin"
      });
    if (error) throw error;
    total += batch.length;
  }

  return total;
}

async function applyStockToProducts(supabase, userId, stockRows) {
  if (!stockRows.length) return { updated: 0, matched: 0 };

  const byKey = new Map();
  for (const row of stockRows) {
    const key = `${row.marketplace || ""}::${row.sku || ""}::${row.asin || ""}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  const uniqueRows = Array.from(byKey.values());
  let updated = 0;

  for (const row of uniqueRows) {
    let query = supabase
      .from("products")
      .update({
        stock_qty: row.stock_qty,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    if (row.marketplace) {
      query = query.eq("marketplace", row.marketplace);
    }

    if (row.sku) {
      query = query.eq("sku", row.sku);
    } else {
      query = query.eq("asin", row.asin);
    }

    const { data, error } = await query.select("id");
    if (error) throw error;
    updated += data?.length || 0;
  }

  return { updated, matched: uniqueRows.length };
}

const getTodayInBucharest = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
};

const upsertDaily = async (supabase, userId, rows, batchSize = 500) => {
  const uniqueRows = dedupeRows(rows);
  let total = 0;
  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const batch = uniqueRows.slice(i, i + batchSize).map((r) => ({
      user_id: userId,
      report_date: r.report_date,
      marketplace: r.marketplace,
      asin: r.asin,
      sku: r.sku,
      title: r.title,
      units_total: r.units_total || 0,
      revenue_total: r.revenue_total || 0,
      net_profit: r.net_profit || 0,
      roi: r.roi || 0,
      cost_of_goods: r.cost_of_goods ?? null,
      raw: r.raw || null
    }));

    const { data, error } = await supabase
      .from("sellerboard_daily")
      .upsert(batch, {
        onConflict: "user_id,sku,marketplace,report_date"
      })
      .select("id");

    if (error) throw error;

    // PostgREST usually returns affected rows due `.select("id")`.
    // Fallback to attempted batch size to avoid false zero counters.
    total += data?.length ?? batch.length;
  }
  return total;
};

const isStatementTimeoutError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("statement timeout") || message.includes("canceling statement due to statement timeout");
};

const refreshProductsFromDailyAdaptive = async (supabase, userId, skuList, warnings) => {
  const configuredBatchSize = parseInt(process.env.SB_REFRESH_BATCH_SIZE || "50", 10);
  const initialBatchSize = Math.max(10, Math.min(200, configuredBatchSize));

  const refreshBatch = async (batch, batchIndex, depth = 0) => {
    if (!batch.length) return;

    const { error } = await supabase.rpc("refresh_products_from_daily_skus", {
      p_user: userId,
      p_skus: batch,
      p_marketplace: null
    });

    if (!error) return;

    if (isStatementTimeoutError(error) && batch.length > 1) {
      const midpoint = Math.ceil(batch.length / 2);
      warnings.push({
        market: "REFRESH",
        warning: "batch_split_after_timeout",
        batch_size: batch.length,
        batch_index: batchIndex,
        depth
      });
      await refreshBatch(batch.slice(0, midpoint), batchIndex, depth + 1);
      await refreshBatch(batch.slice(midpoint), batchIndex, depth + 1);
      return;
    }

    if (isStatementTimeoutError(error)) {
      warnings.push({
        market: "REFRESH",
        warning: error.message,
        batch_size: batch.length,
        batch_index: batchIndex,
        depth
      });
      return;
    }

    throw error;
  };

  for (let i = 0; i < skuList.length; i += initialBatchSize) {
    const batch = skuList.slice(i, i + initialBatchSize);
    await refreshBatch(batch, Math.floor(i / initialBatchSize));
  }
};

export default async function handler(req, res) {
  try {
    const userId = process.env.SUPABASE_ADMIN_USER_ID;
    if (!userId) {
      res.status(500).json({ error: "Missing SUPABASE_ADMIN_USER_ID" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const entries = listDailyUrls();
    if (entries.length === 0) {
      res.status(500).json({ error: "No SELLERBOARD_DAILY_URL_* configured" });
      return;
    }

    let imported = 0;
    let marketplaces = 0;
    let csvRowsTotal = 0;
    let mappableRowsTotal = 0;
    let latestRowsTotal = 0;
    const failures = [];
    const warnings = [];
    const processed = [];
    const skuSet = new Set();
    for (const [market, url] of entries) {
      try {
        const csvText = await fetchCsvText(url);
        const csvData = parseCSV(csvText);
        csvRowsTotal += csvData.length;
        if (csvData.length === 0) {
          processed.push({ market, imported: 0, csv_rows: 0, mapped_rows: 0, latest_rows: 0, report_date: null, reason: "empty_csv" });
          continue;
        }

        const rowsAll = mapCSVToDailyRows(csvData, market === "DEFAULT" ? null : market);
        mappableRowsTotal += rowsAll.length;
        if (rowsAll.length === 0) {
          processed.push({
            market,
            imported: 0,
            csv_rows: csvData.length,
            mapped_rows: 0,
            latest_rows: 0,
            report_date: null,
            reason: "no_mappable_rows"
          });
          continue;
        }

        if (market === "DEFAULT") {
          // Single export may contain multiple marketplaces.
          const byMarket = new Map();
          for (const row of rowsAll) {
            const m = row.marketplace || "DE";
            if (!byMarket.has(m)) byMarket.set(m, []);
            byMarket.get(m).push(row);
          }

          for (const [actualMarket, marketRows] of byMarket.entries()) {
            const latestDate = marketRows.reduce(
              (acc, row) => (row.report_date > acc ? row.report_date : acc),
              marketRows[0].report_date
            );
            const rows = marketRows.filter((r) => r.report_date === latestDate);
            latestRowsTotal += rows.length;
            if (rows.length === 0) {
              processed.push({
                market: actualMarket,
                imported: 0,
                csv_rows: csvData.length,
                mapped_rows: marketRows.length,
                latest_rows: 0,
                report_date: latestDate,
                reason: "no_rows_for_latest_date"
              });
              continue;
            }

          const inserted = await upsertDaily(supabase, userId, rows);
          imported += inserted;
          marketplaces += 1;
          rows.forEach((r) => r.sku && skuSet.add(r.sku));
          processed.push({
            market: actualMarket,
            imported: inserted,
            csv_rows: csvData.length,
            mapped_rows: marketRows.length,
              latest_rows: rows.length,
              report_date: latestDate,
              duplicates_or_unchanged: Math.max(0, rows.length - inserted)
            });
          }
        } else {
          // Use latest date available in each marketplace export; some accounts receive T-1 data.
          const latestDate = rowsAll.reduce((acc, row) => (row.report_date > acc ? row.report_date : acc), rowsAll[0].report_date);
          const rows = rowsAll.filter((r) => r.report_date === latestDate);
          latestRowsTotal += rows.length;
          if (rows.length === 0) {
            processed.push({
              market,
              imported: 0,
              csv_rows: csvData.length,
              mapped_rows: rowsAll.length,
              latest_rows: 0,
              report_date: latestDate,
              reason: "no_rows_for_latest_date"
            });
            continue;
          }

          const inserted = await upsertDaily(supabase, userId, rows);
          imported += inserted;
          marketplaces += 1;
          rows.forEach((r) => r.sku && skuSet.add(r.sku));
          processed.push({
            market,
            imported: inserted,
            csv_rows: csvData.length,
            mapped_rows: rowsAll.length,
            latest_rows: rows.length,
            report_date: latestDate,
            duplicates_or_unchanged: Math.max(0, rows.length - inserted)
          });
        }
      } catch (error) {
        failures.push({ market, error: error.message });
      }
    }

    if (imported > 0 && skuSet.size > 0) {
      const skuList = Array.from(skuSet);
      try {
        await refreshProductsFromDailyAdaptive(supabase, userId, skuList, warnings);
      } catch (refreshError) {
        failures.push({ market: "REFRESH", error: refreshError.message });
      }
    }

    let stockUpdated = 0;
    let stockMatched = 0;
    let stockSnapshotsSaved = 0;
    if (typeof STOCK_URL === "string" && STOCK_URL.trim() !== "") {
      try {
        const stockCsvText = await fetchCsvText(STOCK_URL);
        const stockCsvData = parseCSV(stockCsvText);
        const stockRows = mapCSVToStockRows(stockCsvData);
        const stockSnapshotDate = getTodayInBucharest();
        stockSnapshotsSaved = await upsertStockSnapshots(supabase, userId, stockRows, stockSnapshotDate);
        const stockResult = await applyStockToProducts(supabase, userId, stockRows);
        stockUpdated = stockResult.updated;
        stockMatched = stockResult.matched;
      } catch (stockError) {
        failures.push({ market: "STOCK", error: stockError.message });
      }
    } else {
      warnings.push({
        market: "STOCK",
        warning: "SELLERBOARD_STOCK_URL not configured"
      });
    }

    // Propagăm COGS: ultimul cost non-null per SKU în products.cogs (nu rescriem cu NULL).
    if (skuSet.size > 0) {
      const skuList = Array.from(skuSet);
      const { data: costRows, error: costError } = await supabase
        .from("sellerboard_daily")
        .select("sku,cost_of_goods,report_date")
        .in("sku", skuList)
        .gt("cost_of_goods", 0)
        .order("sku", { ascending: true })
        .order("report_date", { ascending: false });

      if (costError) {
        failures.push({ market: "COGS", error: costError.message });
      } else {
        const latestCostBySku = new Map();
        for (const row of costRows || []) {
          if (!latestCostBySku.has(row.sku)) {
            latestCostBySku.set(row.sku, row.cost_of_goods);
          }
        }

        for (const [sku, cost] of latestCostBySku.entries()) {
          if (cost === null || cost === undefined || cost <= 0) continue;
          const { error: updateError } = await supabase
            .from("products")
            .update({ cogs: cost, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("sku", sku)
            .or(`cogs.is.null,cogs.eq.0,cogs.lt.0,cogs.neq.${cost}`);
          if (updateError) {
            failures.push({ market: "COGS", sku, error: updateError.message });
          }
        }
      }
    }

    res.status(200).json({
      ok: failures.length === 0,
      imported,
      marketplaces,
      csv_rows_total: csvRowsTotal,
      mappable_rows_total: mappableRowsTotal,
      latest_rows_total: latestRowsTotal,
      stock_updated: stockUpdated,
      stock_matched: stockMatched,
      stock_snapshots_saved: stockSnapshotsSaved,
      processed,
      failures,
      warnings
    });
  } catch (error) {
    console.error("Daily sync error:", error);
    res.status(500).json({ error: error.message });
  }
}
