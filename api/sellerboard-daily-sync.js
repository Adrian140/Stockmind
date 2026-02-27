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
  "amazon.com": "US",
  "amazon.ca": "CA",
  "amazon.com.mx": "MX",
  "amazon.co.jp": "JP",
  "amazon.com.au": "AU"
};

function mapMarketplace(sellerboardMarketplace) {
  if (!sellerboardMarketplace) return "DE";
  const marketplace = sellerboardMarketplace.toLowerCase().trim();
  return MARKETPLACE_MAP[marketplace] || String(sellerboardMarketplace).toUpperCase().trim() || "DE";
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
  let day = p2;
  let month = p1;
  if (p1 > 12) {
    day = p1;
    month = p2;
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

function mapCSVToDailyRows(csvData) {
  const rows = [];
  for (const row of csvData) {
    const asin = row["ASIN"] || row["asin"] || "";
    const sku = row["SKU"] || row["sku"] || "";
    const marketplace = row["Marketplace"] || row["marketplace"] || "";
    const date = parseCsvDate(row["Date"]);
    if (!asin || !sku || !marketplace || !date) continue;

    const units =
      parseNumber(row["UnitsOrganic"]) +
      parseNumber(row["UnitsPPC"]) +
      parseNumber(row["UnitsSponsoredProducts"]) +
      parseNumber(row["UnitsSponsoredDisplay"]);

    const revenue =
      parseNumber(row["SalesOrganic"]) +
      parseNumber(row["SalesPPC"]) +
      parseNumber(row["SalesSponsoredProducts"]) +
      parseNumber(row["SalesSponsoredDisplay"]);

    const netProfit = parseNumber(row["NetProfit"]);
    const roi = Math.max(-9999.99, Math.min(9999.99, parseNumber(row["ROI"])));

    rows.push({
      report_date: date,
      marketplace: mapMarketplace(marketplace),
      asin,
      sku,
      title: row["Name"] || row["Title"] || "",
      units_total: Math.round(units),
      revenue_total: Number(revenue.toFixed(2)),
      net_profit: Number(netProfit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
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

const listDailyUrls = () => {
  const specific = Object.entries(DAILY_URLS).filter(([, url]) => typeof url === "string" && url.trim() !== "");
  if (specific.length > 0) return specific;

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
      raw: r.raw || null
    }));

    const { data, error } = await supabase
      .from("sellerboard_daily")
      .upsert(batch, {
        onConflict: "user_id,sku,marketplace,report_date"
      })
      .select("id");

    if (error) throw error;
    total += data?.length || 0;
  }
  return total;
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
    const failures = [];
    const processed = [];
    const skuSet = new Set();
    for (const [market, url] of entries) {
      try {
        const csvText = await fetchCsvText(url);
        const csvData = parseCSV(csvText);
        if (csvData.length === 0) {
          processed.push({ market, imported: 0, report_date: null, reason: "empty_csv" });
          continue;
        }

        const rowsAll = mapCSVToDailyRows(csvData);
        if (rowsAll.length === 0) {
          processed.push({ market, imported: 0, report_date: null, reason: "no_mappable_rows" });
          continue;
        }

        // Use latest date available in each marketplace export; some accounts receive T-1 data.
        const latestDate = rowsAll.reduce((acc, row) => (row.report_date > acc ? row.report_date : acc), rowsAll[0].report_date);
        const rows = rowsAll.filter((r) => r.report_date === latestDate);
        if (rows.length === 0) {
          processed.push({ market, imported: 0, report_date: latestDate, reason: "no_rows_for_latest_date" });
          continue;
        }

        imported += await upsertDaily(supabase, userId, rows);
        marketplaces += 1;
        rows.forEach((r) => r.sku && skuSet.add(r.sku));
        processed.push({ market, imported: rows.length, report_date: latestDate });
      } catch (error) {
        failures.push({ market, error: error.message });
      }
    }

    if (imported > 0) {
      await supabase.rpc("refresh_products_from_daily_skus", {
        p_user: userId,
        p_skus: Array.from(skuSet),
        p_marketplace: null
      });
    }

    res.status(200).json({
      ok: failures.length === 0,
      imported,
      marketplaces,
      processed,
      failures
    });
  } catch (error) {
    console.error("Daily sync error:", error);
    res.status(500).json({ error: error.message });
  }
}
