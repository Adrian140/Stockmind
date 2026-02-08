-- Refresh products only for SKUs affected in a date range (faster, avoids timeouts)
CREATE OR REPLACE FUNCTION refresh_products_from_daily_range(
  p_user UUID,
  p_marketplace TEXT DEFAULT NULL,
  p_start DATE DEFAULT NULL,
  p_end DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);

  WITH affected AS (
    SELECT DISTINCT d.user_id, d.sku, d.marketplace
    FROM sellerboard_daily d
    WHERE d.user_id = p_user
      AND (p_marketplace IS NULL OR d.marketplace = p_marketplace)
      AND (p_start IS NULL OR d.report_date >= p_start)
      AND (p_end IS NULL OR d.report_date <= p_end)
  )
  INSERT INTO products (
    user_id,
    asin,
    sku,
    title,
    category,
    marketplace,
    status,
    tags,
    image_url,
    cogs,
    units_30d,
    units_90d,
    units_365d,
    units_all_time,
    revenue_30d,
    profit_30d,
    profit_unit,
    roi
  )
  SELECT
    d.user_id,
    MIN(d.asin) AS asin,
    d.sku,
    MAX(d.title) AS title,
    'other' AS category,
    d.marketplace,
    'active' AS status,
    ARRAY[]::TEXT[] AS tags,
    MAX(ai.image_url) AS image_url,
    (
      SELECT d2.cost_of_goods
      FROM sellerboard_daily d2
      WHERE d2.user_id = d.user_id
        AND d2.sku = d.sku
        AND d2.marketplace = d.marketplace
        AND d2.cost_of_goods IS NOT NULL
      ORDER BY d2.report_date DESC
      LIMIT 1
    ) AS cogs,
    SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.units_total ELSE 0 END) AS units_30d,
    SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '90 days' THEN d.units_total ELSE 0 END) AS units_90d,
    SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '365 days' THEN d.units_total ELSE 0 END) AS units_365d,
    SUM(d.units_total) AS units_all_time,
    SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.revenue_total ELSE 0 END) AS revenue_30d,
    SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.net_profit ELSE 0 END) AS profit_30d,
    CASE
      WHEN SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.units_total ELSE 0 END) > 0
      THEN SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.net_profit ELSE 0 END)
           / SUM(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.units_total ELSE 0 END)
      ELSE 0
    END AS profit_unit,
    AVG(CASE WHEN d.report_date >= CURRENT_DATE - INTERVAL '30 days' THEN d.roi ELSE NULL END) AS roi
  FROM sellerboard_daily d
  JOIN affected a
    ON a.user_id = d.user_id
    AND a.sku = d.sku
    AND a.marketplace = d.marketplace
  LEFT JOIN asin_images ai
    ON ai.user_id = d.user_id
    AND ai.asin = d.asin
  WHERE d.user_id = p_user
  GROUP BY d.user_id, d.sku, d.marketplace
  ON CONFLICT (user_id, sku, marketplace)
  DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    image_url = COALESCE(products.image_url, EXCLUDED.image_url),
    cogs = COALESCE(EXCLUDED.cogs, products.cogs),
    units_30d = EXCLUDED.units_30d,
    units_90d = EXCLUDED.units_90d,
    units_365d = EXCLUDED.units_365d,
    units_all_time = EXCLUDED.units_all_time,
    revenue_30d = EXCLUDED.revenue_30d,
    profit_30d = EXCLUDED.profit_30d,
    profit_unit = EXCLUDED.profit_unit,
    roi = EXCLUDED.roi,
    updated_at = NOW();
END;
$$;
