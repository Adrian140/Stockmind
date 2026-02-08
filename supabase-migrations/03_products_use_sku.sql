-- ============================================
-- PRODUCTS: ADD SKU + UNIQUE ON (user_id, sku, marketplace)
-- ============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- Drop old unique index on (user_id, asin, marketplace)
DROP INDEX IF EXISTS idx_products_user_asin_marketplace;

-- New unique index on SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_sku_marketplace
  ON products(user_id, sku, marketplace);

-- Optional: ensure sku is present for new data
-- UPDATE products SET sku = asin WHERE sku IS NULL;
