CREATE TABLE IF NOT EXISTS sellerboard_stock_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  title TEXT,
  stock_qty INTEGER DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  inbound_qty INTEGER DEFAULT 0,
  stock_value DECIMAL(12,2) DEFAULT 0,
  days_of_stock_left INTEGER DEFAULT 0,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellerboard_stock_daily_unique
  ON sellerboard_stock_daily(user_id, snapshot_date, marketplace, sku, asin);

CREATE INDEX IF NOT EXISTS idx_sellerboard_stock_daily_user_id
  ON sellerboard_stock_daily(user_id);

CREATE INDEX IF NOT EXISTS idx_sellerboard_stock_daily_snapshot_date
  ON sellerboard_stock_daily(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_sellerboard_stock_daily_sku
  ON sellerboard_stock_daily(sku);

CREATE INDEX IF NOT EXISTS idx_sellerboard_stock_daily_asin
  ON sellerboard_stock_daily(asin);

ALTER TABLE sellerboard_stock_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sellerboard stock daily" ON sellerboard_stock_daily;
CREATE POLICY "Users can view own sellerboard stock daily"
  ON sellerboard_stock_daily FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sellerboard stock daily" ON sellerboard_stock_daily;
CREATE POLICY "Users can insert own sellerboard stock daily"
  ON sellerboard_stock_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sellerboard stock daily" ON sellerboard_stock_daily;
CREATE POLICY "Users can update own sellerboard stock daily"
  ON sellerboard_stock_daily FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sellerboard stock daily" ON sellerboard_stock_daily;
CREATE POLICY "Users can delete own sellerboard stock daily"
  ON sellerboard_stock_daily FOR DELETE
  USING (auth.uid() = user_id);
