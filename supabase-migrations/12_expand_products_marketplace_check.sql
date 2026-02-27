-- Allow all EU marketplaces used by Sellerboard daily sync in products table.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_marketplace_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_marketplace_check
  CHECK (marketplace IN ('DE', 'FR', 'IT', 'ES', 'UK', 'US', 'BE', 'NL', 'PL', 'SE', 'IE'));
