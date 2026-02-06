# Supabase Database Setup

## Tables to Create

### 1. subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own subscription" 
  ON subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" 
  ON subscriptions FOR UPDATE 
  USING (auth.uid() = user_id);
```

### 2. integrations
```sql
CREATE TABLE integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  keepa_api_key TEXT,
  sellerboard_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
```

### 3. products (for storing user products)
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  asin TEXT NOT NULL,
  title TEXT,
  brand TEXT,
  category TEXT,
  marketplace TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own products" 
  ON products FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" 
  ON products FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from your Supabase project settings.
