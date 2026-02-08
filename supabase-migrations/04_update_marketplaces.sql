-- ============================================
-- PRODUCTS: EXPAND MARKETPLACE CHECK CONSTRAINT
-- ============================================

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_marketplace_check;

ALTER TABLE products
  ADD CONSTRAINT products_marketplace_check
  CHECK (marketplace IN ('DE','FR','IT','ES','UK','US','BE','NL','PL','SE','IE'));
