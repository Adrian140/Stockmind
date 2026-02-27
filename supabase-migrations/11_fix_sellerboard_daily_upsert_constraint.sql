-- Ensure ON CONFLICT (user_id, sku, marketplace, report_date) is valid
-- for sellerboard_daily upserts used by API/cron sync.

-- 1) Remove duplicate rows on the SKU conflict key (keep latest id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, sku, marketplace, report_date
      ORDER BY id DESC
    ) AS rn
  FROM public.sellerboard_daily
  WHERE sku IS NOT NULL
)
DELETE FROM public.sellerboard_daily d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- 2) Create supporting unique index for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellerboard_daily_unique
  ON public.sellerboard_daily (user_id, sku, marketplace, report_date);
