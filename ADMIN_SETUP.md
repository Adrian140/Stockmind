# 🔐 Full Admin Account Setup Guide

## Overview

Acest ghid te va ajuta să configurezi contul **contact@prep-center.eu** (User ID: `79e11c7f-8c35-4091-b6de-f9b7909f1495`) ca **Full Admin** cu toate privilegiile.

---

## 🚀 Metodă 1: SQL Direct (Recomandat)

Această metodă este cea mai rapidă și mai sigură.

### Pași:

1. **Deschide Supabase Dashboard**
   - Navighează la: https://app.supabase.com
   - Selectează proiectul tău

2. **SQL Editor**
   - Click pe **SQL Editor** din sidebar
   - Click pe **New query**

3. **Rulează SQL-ul**
   - Deschide fișierul: `supabase-migrations/01_setup_admin.sql`
   - Copiază tot conținutul (Ctrl+A, Ctrl+C)
   - Lipește în SQL Editor
   - Click pe **Run** (sau F5)

4. **Verifică rezultatul**
   - Ar trebui să vezi un rezultat cu datele admin-ului:
     ```
     user_id: 79e11c7f-8c35-4091-b6de-f9b7909f1495
     email: contact@prep-center.eu
     subscription_tier: enterprise
     subscription_status: active
     keepa_status: Connected
     sellerboard_status: Connected
     ```

---

## 🚀 Metodă 2: Script Node.js

Alternativ, poți rula scriptul Node.js:

```bash
node setup-admin-account.js
```

### Ce face acest script:

1. ✅ Verifică că utilizatorul există în Supabase Auth
2. ✅ Creează subscription **ENTERPRISE** (cel mai înalt plan)
3. ✅ Setează perioada de valabilitate: **1 an**
4. ✅ Configurează **Keepa API key**
5. ✅ Configurează **Sellerboard API key**
6. ✅ Marchează toate integrările ca **active**

---

## 📊 Ce primește Admin-ul?

### 1. **ENTERPRISE Subscription**
- Cel mai înalt tier disponibil
- Status: **active**
- Valabilitate: **1 an**
- Acces la TOATE features

### 2. **Keepa Integration**
- API Key: preconfigurata și activă
- Status: **Connected**
- Last sync: timestamp curent
- Gata de utilizare

### 3. **Sellerboard Integration**
- API Key: configurată (poate fi actualizată)
- Status: **Connected**
- Last sync: timestamp curent
- Gata de utilizare

---

## 🎯 După Setup

### Login

```
Email: contact@prep-center.eu
Password: Parola.1234
```

### Verificare

După login, admin-ul va avea acces la:

- ✅ **Dashboard** - KPIs complete, grafice, analytics
- ✅ **Products** - Catalog complet cu toate metrici
- ✅ **Seasonality** - Identificare perioade peak
- ✅ **Clearance** - Gestionare stocuri slow-moving
- ✅ **Integrations** - Management Keepa & Sellerboard
- ✅ **Settings** - Subscription management

---

## 🔧 Troubleshooting

### Eroare: "duplicate key value violates unique constraint"

**Cauză:** Există deja un subscription/integration pentru acest user.

**Soluție:**
1. SQL-ul din `01_setup_admin.sql` șterge automat record-urile vechi
2. SAU șterge manual din Table Editor:
   - Șterge din `subscriptions` unde `user_id = 79e11c7f-8c35-4091-b6de-f9b7909f1495`
   - Șterge din `integrations` unde `user_id = 79e11c7f-8c35-4091-b6de-f9b7909f1495`
3. Rulează din nou script-ul

### Nu văd tier-ul "enterprise" după setup

**Verifică:**
1. Du-te la Supabase Dashboard → **Table Editor** → **subscriptions**
2. Găsește row-ul cu `user_id = 79e11c7f-8c35-4091-b6de-f9b7909f1495`
3. Verifică că `tier = enterprise` și `status = active`

---

## 📋 Checklist Final

După ce ai terminat setup-ul, verifică:

- [ ] Subscription există în tabelul `subscriptions`
- [ ] Tier-ul este `enterprise`
- [ ] Status-ul este `active`
- [ ] `current_period_end` este în viitor (1 an de acum)
- [ ] Integration record există în `integrations`
- [ ] Keepa API key este setat
- [ ] Sellerboard API key este setat
- [ ] Login-ul funcționează cu `contact@prep-center.eu`
- [ ] Dashboard-ul se încarcă cu succes
- [ ] Integrările apar ca "Connected" în Settings

---

## 🎉 Success!

Dacă toate check-urile sunt ✅, contul este acum **Full Admin** cu toate privilegiile!

Admin-ul poate acum:
- Vizualiza toate analytics și KPIs
- Gestiona produse Amazon
- Accesa date Keepa și Sellerboard
- Configura integrări
- Administra subscription-ul

---

**✨ Setup completat! Admin account este gata de utilizare!**
