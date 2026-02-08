-- Disable statement timeout for refresh_products_from_daily to avoid large-history timeouts
CREATE OR REPLACE FUNCTION refresh_products_from_daily(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Disable statement timeout for this function invocation
  PERFORM set_config('statement_timeout', '0', true);

  INSERT INTO products (
    user_id,
    asin,
    sku,
    title,
    category,
    marketplace,
    status,
    tags,
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
    user_id,
    asin,
    sku,
    MAX(title) AS title,
    'other' AS category,
    marketplace,
    'active' AS status,
    ARRAY[]::TEXT[] AS tags,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN units_total ELSE 0 END) AS units_30d,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '90 days' THEN units_total ELSE 0 END) AS units_90d,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '365 days' THEN units_total ELSE 0 END) AS units_365d,
    SUM(units_total) AS units_all_time,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN revenue_total ELSE 0 END) AS revenue_30d,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN net_profit ELSE 0 END) AS profit_30d,
    CASE
      WHEN SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN units_total ELSE 0 END) > 0
      THEN SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN net_profit ELSE 0 END)
           / SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN units_total ELSE 0 END)
      ELSE 0
    END AS profit_unit,
    AVG(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN roi ELSE NULL END) AS roi
  FROM sellerboard_daily
  WHERE user_id = p_user
  GROUP BY user_id, asin, sku, marketplace
  ON CONFLICT (user_id, sku, marketplace)
  DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
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
