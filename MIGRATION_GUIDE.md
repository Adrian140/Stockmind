# 🗄️ Database Migration Guide - Amazon Seller Analytics

## Overview

Acest ghid te va ajuta să creezi și să configurezi complet baza de date Supabase pentru aplicația Amazon Seller Analytics.

## 📊 Tabele Create

Migrarea va crea următoarele **6 tabele**:

### 1. **subscriptions**
Planurile utilizatorilor (free, starter, pro, enterprise)
- Gestionare stripe_customer_id și stripe_subscription_id
- Status tracking (active, inactive, cancelled, past_due)

### 2. **integrations**
API keys pentru integrări externe
- Keepa API key
- Sellerboard API key
- Timestamps pentru ultima sincronizare

### 3. **products** (Extended)
Produse Amazon cu toate datele necesare
- ASIN, title, brand, category
- Metrici vânzări (30d, 90d, 365d)
- Pricing (COGS, Buy Box, volatilitate)
- Inventory tracking
- Peak months (seasonality)
- Tags și status

### 4. **product_notes**
Notițe interne despre produse
- Format text
- Legături la produse

### 5. **sales_history**
Istoric lunar vânzări
- Units, revenue, profit per month/year
- Linked to products

### 6. **imports_log**
Log pentru importuri CSV (Sellerboard)
- Filename, marketplace, period
- Status tracking (pending, processing, completed, failed)
- Records count și error messages

## 🚀 Pași de Migrare

### Pasul 1: Rulează SQL-ul în Supabase Dashboard

1. **Deschide Supabase Dashboard**
   - Navighează la: https://app.supabase.com
   - Selectează proiectul tău

2. **SQL Editor**
   - Click pe **SQL Editor** din sidebar
   - Click pe **New query**

3. **Copiază SQL-ul**
   - Deschide fișierul: `supabase-migrations/00_complete_schema.sql`
   - Selectează tot conținutul (Ctrl+A)
   - Copiază (Ctrl+C)

4. **Execută Migrarea**
   - Lipește conținutul în SQL Editor
   - Click pe **Run** (sau F5)
   - Așteaptă confirmarea: "Success. No rows returned"

### Pasul 2: Verifică Crearea Tabelelor

1. **Table Editor**
   - Click pe **Table Editor** din sidebar
   - Ar trebui să vezi toate cele 6 tabele:
     - subscriptions
     - integrations
     - products
     - product_notes
     - sales_history
     - imports_log

2. **Verificare RLS**
   - Click pe fiecare tabel
   - Click pe **RLS** tab
   - Ar trebui să vezi politicile configurate

### Pasul 3: Configurează Email Authentication

1. **Authentication Settings**
   - Navighează la **Authentication** → **Providers**
   - Click pe **Email**

2. **Configurări IMPORTANTE**
   - ✅ **Enable Email provider** - ON
   - ❌ **Confirm email** - **OFF** (pentru development)
   - ✅ **Enable sign ups** - ON

3. **Email Templates** (Opțional)
   - Poți personaliza template-urile pentru emailuri
   - Pentru development, default templates sunt OK

### Pasul 4: Rulează Script-ul de Verificare

```bash
node migrate-to-supabase.js
```

Acest script va:
- Verifica conexiunea la Supabase
- Detecta ce tabele există deja
- Confirma că migrarea s-a făcut corect

### Pasul 5: Creează Contul de Test și Date de Seed

```bash
npm run setup
```

Sau:

```bash
node setup-database.js
```

Acest script va crea:
- ✅ Cont de test: `contact@prep-center.eu` / `Parola.1234`
- ✅ Subscription Pro activă
- ✅ Keepa API key conectat

## 🔧 Troubleshooting

### Eroare: "relation already exists"

**Cauză:** Tabelele au fost deja create.

**Soluție:**
1. Dacă vrei să reîncepi de la zero:
   - Du-te la Table Editor
   - Șterge toate tabelele existente
   - Rulează din nou migration SQL-ul

2. Dacă vrei să păstrezi datele:
   - Skip migrarea
   - Mergi direct la Pasul 5

### Eroare: "permission denied for schema public"

**Cauză:** Probleme cu permisiunile în Supabase.

**Soluție:**
Rulează acest SQL în SQL Editor:

```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

### Eroare: "cannot execute INSERT in a read-only transaction"

**Cauză:** Folosești anon key în loc de service role key pentru operații sensibile.

**Soluție:**
- Pentru development, asigură-te că RLS policies permit operațiile
- SAU adaugă în `.env`: `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`

## 📋 Checklist Final

După ce ai terminat migrarea, verifică:

- [ ] Toate cele 6 tabele există în Table Editor
- [ ] RLS este activat pe toate tabelele
- [ ] Policies sunt configurate corect
- [ ] Email authentication este activat
- [ ] Confirm email este dezactivat (pentru dev)
- [ ] Test account funcționează (login cu credențialele de test)
- [ ] Subscription record există pentru test user

## 🎯 Next Steps

După migrare, poți:

1. **Testa autentificarea** în aplicație
2. **Importa produse** prin CSV sau manual
3. **Explora dashboard-ul** cu datele de test
4. **Configura integrări** (Keepa, Sellerboard)

## 📚 Resurse Utile

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Editor Guide](https://supabase.com/docs/guides/database/overview)

---

**✨ Migrare realizată! Database-ul tău este gata de utilizare!**
