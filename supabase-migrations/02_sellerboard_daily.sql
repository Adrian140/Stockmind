-- ============================================
-- SELLERBOARD DAILY HISTORY (BACKFILL + INCREMENTAL)
-- ============================================

CREATE TABLE IF NOT EXISTS sellerboard_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL,
  sku TEXT,
  title TEXT,
  units_total INTEGER DEFAULT 0,
  revenue_total DECIMAL(10,2) DEFAULT 0,
  net_profit DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(6,2) DEFAULT 0,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellerboard_daily_unique
  ON sellerboard_daily(user_id, asin, marketplace, report_date);

CREATE INDEX IF NOT EXISTS idx_sellerboard_daily_user_id
  ON sellerboard_daily(user_id);

CREATE INDEX IF NOT EXISTS idx_sellerboard_daily_asin
  ON sellerboard_daily(asin);

CREATE INDEX IF NOT EXISTS idx_sellerboard_daily_date
  ON sellerboard_daily(report_date);

ALTER TABLE sellerboard_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sellerboard daily"
  ON sellerboard_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sellerboard daily"
  ON sellerboard_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sellerboard daily"
  ON sellerboard_daily FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sellerboard daily"
  ON sellerboard_daily FOR DELETE
  USING (auth.uid() = user_id);

-- Rebuild rolling aggregates in products from sellerboard_daily
CREATE OR REPLACE FUNCTION refresh_products_from_daily(p_user UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  INSERT INTO products (
    user_id,
    asin,
    title,
    category,
    marketplace,
    status,
    tags,
    units_30d,
    units_90d,
    units_365d,
    revenue_30d,
    profit_30d,
    profit_unit,
    roi
  )
  SELECT
    user_id,
    asin,
    MAX(title) AS title,
    'other' AS category,
    marketplace,
    'active' AS status,
    ARRAY[]::TEXT[] AS tags,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '30 days' THEN units_total ELSE 0 END) AS units_30d,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '90 days' THEN units_total ELSE 0 END) AS units_90d,
    SUM(CASE WHEN report_date >= CURRENT_DATE - INTERVAL '365 days' THEN units_total ELSE 0 END) AS units_365d,
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
  GROUP BY user_id, asin, marketplace
  ON CONFLICT (user_id, asin, marketplace)
  DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    units_30d = EXCLUDED.units_30d,
    units_90d = EXCLUDED.units_90d,
    units_365d = EXCLUDED.units_365d,
    revenue_30d = EXCLUDED.revenue_30d,
    profit_30d = EXCLUDED.profit_30d,
    profit_unit = EXCLUDED.profit_unit,
    roi = EXCLUDED.roi,
    updated_at = NOW();
$$;
