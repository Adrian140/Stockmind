# 🚀 Setup Instructions - Amazon Seller Analytics

## Pasul 1: Creează Tabelele în Supabase

Accesează Supabase Dashboard → SQL Editor și rulează următoarele comenzi:

### 1.1 Creează tabelul `subscriptions`

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

CREATE POLICY "Users can insert own subscription" 
  ON subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```

### 1.2 Creează tabelul `integrations`

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

### 1.3 Creează tabelul `products` (opțional, pentru viitor)

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

### 1.4 Configurează Email Authentication în Supabase

1. Du-te la **Authentication** → **Providers** → **Email**
2. Asigură-te că **Enable Email provider** este activat
3. **IMPORTANT**: Dezactivează **Confirm email** (pentru testing rapid)
   - Găsește opțiunea "Confirm email" și setează-o la OFF
   - Altfel, va trebui să confirmi emailul manual

## Pasul 2: Creează Contul de Test

După ce ai creat tabelele, rulează scriptul de creare a contului:

```bash
node create-test-user.js
```

Ar trebui să vezi:

```
Creating test account...
✅ Account created successfully!
User ID: [uuid]
Email: contact@prep-center.eu

Creating subscription record...
✅ Subscription created (tier: pro)

Adding Keepa API key...
✅ Keepa API key added successfully

========================================
TEST ACCOUNT READY!
========================================
Email: contact@prep-center.eu
Password: Parola.1234
Keepa API Key: Connected
Subscription: Pro (active)
========================================
```

## Pasul 3: Testează Autentificarea

1. Deschide aplicația în browser
2. Folosește credențialele:
   - **Email**: contact@prep-center.eu
   - **Password**: Parola.1234
3. Ar trebui să te loghezi cu succes!

---

## 🔧 Troubleshooting

### Eroare: "User already registered"
- Contul există deja, poți să te loghezi direct
- SAU șterge userul din Supabase Dashboard → Authentication → Users

### Eroare: "relation does not exist"
- Tabelele nu au fost create în Supabase
- Verifică din nou SQL Editor și rulează comenzile de la Pasul 1

### Eroare: "Failed to fetch"
- Verifică că URL-ul și cheia Supabase din `.env` sunt corecte
- Verifică că Email Authentication este activat în Supabase
- Verifică că "Confirm email" este dezactivat (pentru testing)

### Email-ul necesită confirmare
- Du-te la Supabase Dashboard → Authentication → Providers → Email
- Dezactivează "Confirm email"
- SAU confirmă manual emailul din Authentication → Users → Click pe user → Confirm email
