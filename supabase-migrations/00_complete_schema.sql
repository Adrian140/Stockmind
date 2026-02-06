-- ============================================
-- AMAZON SELLER ANALYTICS - COMPLETE DATABASE SCHEMA
-- ============================================
-- This migration creates ALL tables needed for the project

-- ============================================
-- 1. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own subscription" 
  ON subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" 
  ON subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" 
  ON subscriptions FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================
-- 2. INTEGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  keepa_api_key TEXT,
  sellerboard_api_key TEXT,
  keepa_connected_at TIMESTAMP WITH TIME ZONE,
  sellerboard_connected_at TIMESTAMP WITH TIME ZONE,
  keepa_last_sync TIMESTAMP WITH TIME ZONE,
  sellerboard_last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_integrations_user_id ON integrations(user_id);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own integrations" 
  ON integrations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" 
  ON integrations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" 
  ON integrations FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================
-- 3. PRODUCTS TABLE (Extended)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  asin TEXT NOT NULL,
  title TEXT,
  brand TEXT,
  category TEXT,
  target_user TEXT,
  marketplace TEXT DEFAULT 'DE' CHECK (marketplace IN ('DE', 'FR', 'IT', 'ES', 'UK', 'US')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'clearance', 'watchlist', 'paused', 'archived')),
  tags TEXT[],
  -- Sales metrics
  units_30d INTEGER DEFAULT 0,
  units_90d INTEGER DEFAULT 0,
  units_365d INTEGER DEFAULT 0,
  revenue_30d DECIMAL(10,2) DEFAULT 0,
  profit_30d DECIMAL(10,2) DEFAULT 0,
  profit_unit DECIMAL(8,2),
  -- Pricing
  cogs DECIMAL(8,2),
  bb_current DECIMAL(8,2),
  bb_avg_7d DECIMAL(8,2),
  bb_avg_30d DECIMAL(8,2),
  volatility_30d DECIMAL(5,4),
  -- Inventory
  roi DECIMAL(5,2),
  stock_qty INTEGER DEFAULT 0,
  days_since_last_sale INTEGER DEFAULT 0,
  -- Seasonality
  peak_months INTEGER[],
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_asin ON products(asin);
CREATE INDEX idx_products_marketplace ON products(marketplace);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE UNIQUE INDEX idx_products_user_asin_marketplace ON products(user_id, asin, marketplace);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own products" 
  ON products FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" 
  ON products FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" 
  ON products FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" 
  ON products FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- 4. PRODUCT NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS product_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_notes_product_id ON product_notes(product_id);
CREATE INDEX idx_product_notes_user_id ON product_notes(user_id);

-- Enable RLS
ALTER TABLE product_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own product notes" 
  ON product_notes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product notes" 
  ON product_notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product notes" 
  ON product_notes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product notes" 
  ON product_notes FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- 5. SALES HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  units INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, month, year)
);

-- Indexes
CREATE INDEX idx_sales_history_product_id ON sales_history(product_id);
CREATE INDEX idx_sales_history_user_id ON sales_history(user_id);
CREATE INDEX idx_sales_history_year_month ON sales_history(year, month);

-- Enable RLS
ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own sales history" 
  ON sales_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales history" 
  ON sales_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales history" 
  ON sales_history FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================
-- 6. IMPORTS LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS imports_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  period TEXT,
  import_type TEXT CHECK (import_type IN ('manual', 'monthly', 'weekly', 'daily')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  records_count INTEGER DEFAULT 0,
  error_message TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_imports_log_user_id ON imports_log(user_id);
CREATE INDEX idx_imports_log_status ON imports_log(status);
CREATE INDEX idx_imports_log_imported_at ON imports_log(imported_at DESC);

-- Enable RLS
ALTER TABLE imports_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own import logs" 
  ON imports_log FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import logs" 
  ON imports_log FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import logs" 
  ON imports_log FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_notes_updated_at BEFORE UPDATE ON product_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_history_updated_at BEFORE UPDATE ON sales_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All tables created successfully!
-- Total tables: 6
-- Total indexes: 17
-- Total RLS policies: 20
-- Total triggers: 5
