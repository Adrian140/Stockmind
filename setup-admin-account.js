import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  console.log("\nMake sure you have:");
  console.log("VITE_SUPABASE_URL=your_url");
  console.log("VITE_SUPABASE_ANON_KEY=your_key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_USER_ID = "79e11c7f-8c35-4091-b6de-f9b7909f1495";
const ADMIN_EMAIL = "contact@prep-center.eu";
const KEEPA_API_KEY = "fmp0pac4j28u1binprtjhdtk54guq7f30sj1g4j8qs5i2ndrcf4naiknm8rs6kft";

async function setupFullAdmin() {
  console.log("🔐 Setting up FULL ADMIN account...\n");
  console.log("User ID:", ADMIN_USER_ID);
  console.log("Email:", ADMIN_EMAIL);
  console.log("\n" + "=".repeat(50));

  // Step 1: Verify user exists
  console.log("\n📋 Step 1: Verifying user exists in Supabase Auth...");
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(ADMIN_USER_ID);
  if (userError) {
    console.log("⚠️  Cannot verify user (this is normal with anon key)");
    console.log("   Proceeding with setup anyway...\n");
  } else {
    console.log("✅ User verified:");
    console.log("   Email:", userData?.user?.email);
    console.log("   Confirmed:", userData?.user?.confirmed_at ? "Yes" : "No");
  }

  // Step 2: Setup ENTERPRISE subscription
  console.log("\n💎 Step 2: Setting up ENTERPRISE subscription...");
  // First, delete existing subscription to avoid conflicts
  const { error: deleteSubError } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", ADMIN_USER_ID);

  if (deleteSubError && !deleteSubError.message.includes("0 rows")) {
    console.log("⚠️  Could not delete old subscription:", deleteSubError.message);
  }

  // Insert new ENTERPRISE subscription
  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1); // Valid for 1 year

  const { data: subData, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: ADMIN_USER_ID,
      tier: "enterprise",
      status: "active",
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
    })
    .select()
    .single();

  if (subError) {
    console.error("❌ Error creating ENTERPRISE subscription:", subError.message);
    console.log("\n💡 Try running the SQL script manually:");
    console.log("   supabase-migrations/01_setup_admin.sql\n");
  } else {
    console.log("✅ ENTERPRISE subscription created!");
    console.log("   Tier:", subData.tier);
    console.log("   Status:", subData.status);
    console.log("   Expires:", currentPeriodEnd.toLocaleDateString());
  }

  // Step 3: Setup integrations (Keepa + Sellerboard)
  console.log("\n🔗 Step 3: Setting up API integrations...");

  // Delete existing integrations
  const { error: deleteIntError } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", ADMIN_USER_ID);

  if (deleteIntError && !deleteIntError.message.includes("0 rows")) {
    console.log("⚠️  Could not delete old integrations:", deleteIntError.message);
  }

  // Insert new integrations
  const { data: intData, error: intError } = await supabase
    .from("integrations")
    .insert({
      user_id: ADMIN_USER_ID,
      keepa_api_key: KEEPA_API_KEY,
      sellerboard_api_key: "sb_test_api_key_full_access",
      keepa_connected_at: new Date().toISOString(),
      sellerboard_connected_at: new Date().toISOString(),
      keepa_last_sync: new Date().toISOString(),
      sellerboard_last_sync: new Date().toISOString(),
    })
    .select()
    .single();

  if (intError) {
    console.error("❌ Error creating integrations:", intError.message);
  } else {
    console.log("✅ API integrations configured!");
    console.log("   Keepa API:", intData.keepa_api_key ? "Connected ✅" : "Not connected");
    console.log("   Sellerboard API:", intData.sellerboard_api_key ? "Connected ✅" : "Not connected");
  }

  // Step 4: Verify complete setup
  console.log("\n🔍 Step 4: Verifying admin setup...");
  const { data: verifyData, error: verifyError } = await supabase
    .from("subscriptions")
    .select(`
      *,
      integrations:integrations(*)
    `)
    .eq("user_id", ADMIN_USER_ID)
    .single();

  if (verifyError) {
    console.error("❌ Error verifying setup:", verifyError.message);
  } else {
    console.log("\n" + "=".repeat(50));
    console.log("✅ FULL ADMIN SETUP COMPLETE!");
    console.log("=".repeat(50));
    console.log("\n📊 Admin Account Summary:");
    console.log("───────────────────────────────────────────────────");
    console.log("User ID:", ADMIN_USER_ID);
    console.log("Email:", ADMIN_EMAIL);
    console.log("Subscription Tier:", verifyData.tier.toUpperCase());
    console.log("Subscription Status:", verifyData.status.toUpperCase());
    console.log("Valid Until:", new Date(verifyData.current_period_end).toLocaleDateString());
    console.log("\n🔌 Integrations:");
    console.log("├─ Keepa API:", verifyData.integrations?.[0]?.keepa_api_key ? "✅ Connected" : "❌ Not connected");
    console.log("└─ Sellerboard API:", verifyData.integrations?.[0]?.sellerboard_api_key ? "✅ Connected" : "❌ Not connected");
    console.log("───────────────────────────────────────────────────");
    console.log("\n🎉 Admin can now login and access ALL features!");
    console.log("\n💡 Next steps:");
    console.log("1. Login to the app with: contact@prep-center.eu");
    console.log("2. Access Dashboard, Products, Seasonality, Clearance");
    console.log("3. Manage integrations in Settings");
    console.log("\n");
  }
}

setupFullAdmin().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
