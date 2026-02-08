-- ============================================
-- PRODUCTS: ADD ALL-TIME UNITS
-- ============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS units_all_time INTEGER DEFAULT 0;
