import { supabase } from "../lib/supabase";

export async function upsertSellerboardDailyRows(userId, rows, batchSize = 500) {
  try {
    if (!userId || !Array.isArray(rows) || rows.length === 0) {
      return { success: true, count: 0 };
    }

    // Deduplicate within payload to avoid ON CONFLICT updating same row twice
    const deduped = new Map();
    for (const r of rows) {
      const key = `${r.report_date}|${r.marketplace}|${r.asin}`;
      if (!deduped.has(key)) {
        deduped.set(key, r);
      }
    }
    const uniqueRows = Array.from(deduped.values());

    let total = 0;
    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize).map(r => ({
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

    return { success: true, count: total };
  } catch (error) {
    console.error("❌ Error upserting sellerboard_daily rows:", error);
    return { success: false, error: error.message };
  }
}
