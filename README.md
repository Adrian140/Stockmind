# 🛒 Amazon Seller Analytics Dashboard

Professional analytics platform for Amazon sellers to track products, seasonality, clearance, and buy recommendations.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your Supabase project settings:
- Dashboard → Settings → API

### 3. Database Setup

#### Step A: Run the Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the content from `supabase-migrations/00_complete_schema.sql`
3. Paste and click **Run**

#### Step B: Verify Migration

```bash
npm run migrate
```

This will check which tables were created successfully.

#### Step C: Create Test Account

```bash
npm run setup
```

This creates:
- Test user: `contact@prep-center.eu` / `Parola.1234`
- Pro subscription
- Keepa API key connected

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 and login with test credentials.

## 📊 Database Schema

The project uses **6 main tables**:

1. **subscriptions** - User subscription plans
2. **integrations** - API keys (Keepa, Sellerboard)
3. **products** - Amazon products with full analytics
4. **product_notes** - Internal product notes
5. **sales_history** - Monthly sales data
6. **imports_log** - CSV import tracking

See `MIGRATION_GUIDE.md` for detailed schema documentation.

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run migrate` - Check database migration status
- `npm run setup` - Create test account and seed data

## 🏗️ Project Structure

```
├── src/
│   ├── components/       # React components
│   │   ├── auth/        # Login/Signup forms
│   │   ├── charts/      # Recharts visualizations
│   │   ├── layout/      # Header, Footer, Layout
│   │   ├── modals/      # Settings modal
│   │   ├── ui/          # Reusable UI components
│   │   └── widgets/     # Dashboard widgets
│   ├── context/         # React Context (Auth, App)
│   ├── data/            # Mock data
│   ├── lib/             # Supabase client
│   ├── pages/           # Route pages
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── supabase-migrations/ # Database migrations
├── migrate-to-supabase.js
├── setup-database.js
└── MIGRATION_GUIDE.md   # Detailed migration guide
```

## 🎯 Features

- **Dashboard** - KPIs, sales charts, buy box trends
- **Products** - Complete product catalog with analytics
- **Seasonality** - Identify peak periods and reorder timing
- **Clearance** - Manage slow-moving inventory
- **Integrations** - Connect Keepa and Sellerboard APIs
- **Authentication** - Secure Supabase auth

## 🔐 Authentication

Default test account:
- **Email:** contact@prep-center.eu
- **Password:** Parola.1234

To create additional users:
- Use the signup form in the app
- Or create manually in Supabase Dashboard

## 📖 Documentation

- [Migration Guide](./MIGRATION_GUIDE.md) - Complete database setup guide
- [Supabase Docs](https://supabase.com/docs) - Official Supabase documentation

## 🐛 Troubleshooting

### "Failed to fetch" error
- Check `.env` file has correct Supabase credentials
- Verify Supabase project is active
- Disable "Confirm email" in Supabase Auth settings

### Tables don't exist
- Run the migration SQL in Supabase Dashboard
- Check `npm run migrate` for table status

### Can't login
- Verify user exists in Supabase Dashboard → Authentication
- Check RLS policies are enabled
- Run `npm run setup` to create test account

## 📄 License

MIT

---

Built with React + Vite + Supabase + TailwindCSS
