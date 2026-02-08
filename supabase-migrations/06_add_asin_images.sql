CREATE TABLE IF NOT EXISTS asin_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asin text NOT NULL,
  image_url text NOT NULL,
  source text DEFAULT 'upload',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asin_images_user_asin
  ON asin_images (user_id, asin);

ALTER TABLE asin_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own asin images" ON asin_images;
CREATE POLICY "Users can view own asin images"
  ON asin_images FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own asin images" ON asin_images;
CREATE POLICY "Users can insert own asin images"
  ON asin_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own asin images" ON asin_images;
CREATE POLICY "Users can update own asin images"
  ON asin_images FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own asin images" ON asin_images;
CREATE POLICY "Users can delete own asin images"
  ON asin_images FOR DELETE
  USING (auth.uid() = user_id);
