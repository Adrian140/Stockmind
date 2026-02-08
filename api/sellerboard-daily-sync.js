import { createClient } from "@supabase/supabase-js";
import { parseCSV, mapCSVToDailyRows } from "../src/services/sellerboard.service.js";

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

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

const listDailyUrls = () =>
  Object.entries(DAILY_URLS).filter(([, url]) => typeof url === "string" && url.trim() !== "");

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
    const key = `${r.report_date}|${r.marketplace}|${r.asin}`;
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
        onConflict: "user_id,asin,marketplace,report_date"
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
    const todayLocal = getTodayInBucharest();
    const skuSet = new Set();
    for (const [, url] of entries) {
      const csvText = await fetchCsvText(url);
      const csvData = parseCSV(csvText);
      if (csvData.length === 0) continue;
      const rows = mapCSVToDailyRows(csvData).filter((r) => r.report_date === todayLocal);
      if (rows.length === 0) continue;
      imported += await upsertDaily(supabase, userId, rows);
      marketplaces += 1;
      rows.forEach((r) => r.sku && skuSet.add(r.sku));
    }

    if (imported > 0) {
      await supabase.rpc("refresh_products_from_daily_skus", {
        p_user: userId,
        p_skus: Array.from(skuSet),
        p_marketplace: null
      });
    }

    res.status(200).json({ ok: true, imported, marketplaces, report_date: todayLocal });
  } catch (error) {
    console.error("Daily sync error:", error);
    res.status(500).json({ error: error.message });
  }
}
