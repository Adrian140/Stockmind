import { supabase } from "../lib/supabase";

export async function upsertSellerboardDailyRows(userId, rows, batchSize = 500, onProgress = null) {
  try {
    if (!userId || !Array.isArray(rows) || rows.length === 0) {
      return { success: true, count: 0 };
    }

    const toNumberOrNull = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const toIntOrNull = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : null;
    };

    // Deduplicate within payload to avoid ON CONFLICT updating same row twice
    const deduped = new Map();
    for (const r of rows) {
      const key = `${r.report_date}|${r.marketplace}|${r.sku}`;
      if (!deduped.has(key)) {
        deduped.set(key, r);
      }
    }
    const uniqueRows = Array.from(deduped.values());

    let total = 0;
    const totalRows = uniqueRows.length;
    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize).map(r => ({
        user_id: userId,
        report_date: r.report_date,
        marketplace: r.marketplace,
        asin: r.asin,
        sku: r.sku,
        title: r.title,
        product_name: r.product_name || null,
        units_total: Math.round(Number(r.units_total) || 0),
        revenue_total: Number(r.revenue_total) || 0,
        net_profit: Number(r.net_profit) || 0,
        roi: Number(r.roi) || 0,
        units: toIntOrNull(r.units),
        refunds: toIntOrNull(r.refunds),
        sales: toNumberOrNull(r.sales),
        promo: toNumberOrNull(r.promo),
        ads: toNumberOrNull(r.ads),
        sponsored_products_ppc: toNumberOrNull(r.sponsored_products_ppc),
        sponsored_display: toNumberOrNull(r.sponsored_display),
        sponsored_brands_hsa: toNumberOrNull(r.sponsored_brands_hsa),
        sponsored_brands_video: toNumberOrNull(r.sponsored_brands_video),
        google_ads: toNumberOrNull(r.google_ads),
        facebook_ads: toNumberOrNull(r.facebook_ads),
        refunds_percent: toNumberOrNull(r.refunds_percent),
        sellable_quota: toNumberOrNull(r.sellable_quota),
        refund_cost: toNumberOrNull(r.refund_cost),
        amazon_fees: toNumberOrNull(r.amazon_fees),
        cost_of_goods: toNumberOrNull(r.cost_of_goods),
        vat: toNumberOrNull(r.vat),
        shipping: toNumberOrNull(r.shipping),
        gross_profit: toNumberOrNull(r.gross_profit),
        estimated_payout: toNumberOrNull(r.estimated_payout),
        expenses: toNumberOrNull(r.expenses),
        margin: toNumberOrNull(r.margin),
        bsr: toIntOrNull(r.bsr),
        real_acos: toNumberOrNull(r.real_acos),
        sessions: toIntOrNull(r.sessions),
        unit_session_percentage: toNumberOrNull(r.unit_session_percentage),
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

      if (typeof onProgress === "function") {
        const current = Math.min(i + batchSize, totalRows);
        onProgress({ current, total: totalRows });
      }
    }

    return { success: true, count: total };
  } catch (error) {
    console.error("❌ Error upserting sellerboard_daily rows:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchMetricsByDateRange({ userId, startDate, endDate, marketplace = null }) {
  try {
    if (!userId || !startDate || !endDate) return {};

    const startIso = new Date(startDate).toISOString().slice(0, 10);
    const endIso = new Date(endDate).toISOString().slice(0, 10);

    const pageSize = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      let query = supabase
        .from("sellerboard_daily")
        .select("sku,asin,marketplace,units_total")
        .eq("user_id", userId)
        .gte("report_date", startIso)
        .lte("report_date", endIso)
        .range(from, from + pageSize - 1);

      if (marketplace) {
        query = query.eq("marketplace", marketplace);
      }

      const { data, error } = await query;
      if (error) throw error;

      allRows = allRows.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    const map = {};
    for (const row of allRows) {
      const keyBase = (row.sku || row.asin || "").trim();
      if (!keyBase) continue;
      const key = `${keyBase}|${(row.marketplace || "").toUpperCase()}`;
      if (!map[key]) {
        map[key] = {
          units: 0,
          revenue: 0,
          profit: 0,
          days: 0,
          sumUnitsSq: 0
        };
      }
      const units = row.units_total || 0;
      map[key].units += units;
      map[key].revenue += row.revenue_total || 0;
      map[key].profit += row.net_profit || 0;
      map[key].days += 1;
      map[key].sumUnitsSq += units * units;
    }

    const finalized = {};
    for (const [key, v] of Object.entries(map)) {
      const mean = v.days > 0 ? v.units / v.days : 0;
      const variance = v.days > 0 ? v.sumUnitsSq / v.days - mean * mean : 0;
      const stddev = variance > 0 ? Math.sqrt(variance) : 0;
      const volatility = mean > 0 ? stddev / mean : 0;
      finalized[key] = {
        units: v.units,
        revenue: v.revenue,
        profit: v.profit,
        profitUnit: v.units > 0 ? v.profit / v.units : 0,
        volatility
      };
    }

    return finalized;
  } catch (error) {
    console.error("❌ Error fetching range units:", error);
    return {};
  }
}
