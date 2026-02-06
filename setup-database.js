import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load .env file
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

async function setupDatabaseAndUser() {
  console.log("🚀 Starting database setup and user creation...\n");

  // Test account credentials
  const email = "contact@prep-center.eu";
  const password = "Parola.1234";
  const keepaApiKey = "fmp0pac4j28u1binprtjhdtk54guq7f30sj1g4j8qs5i2ndrcf4naiknm8rs6kft";

  // Step 1: Create user account
  console.log("📝 Creating test account...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined,
      data: {
        email_confirmed: true
      }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      console.log("⚠️  User already exists. Trying to sign in instead...\n");
      // Try to sign in to verify account works
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("❌ Error signing in:", signInError.message);
        console.log("\n💡 Try resetting the password in Supabase Dashboard");
        process.exit(1);
      }

      console.log("✅ Successfully signed in with existing account!");
      console.log("User ID:", signInData.user?.id);
      console.log("Email:", signInData.user?.email);
      // Check if subscription exists
      const userId = signInData.user?.id;
      if (userId) {
        await setupUserData(userId, keepaApiKey);
      }
      return;
    } else {
      console.error("❌ Error creating account:", signUpError.message);
      console.log("\n🔍 Common issues:");
      console.log("1. Check if Email Authentication is enabled in Supabase");
      console.log("2. Make sure database tables are created (see SETUP_INSTRUCTIONS.md)");
      console.log("3. Verify .env credentials are correct");
      process.exit(1);
    }
  }

  console.log("✅ Account created successfully!");
  console.log("User ID:", signUpData.user?.id);
  console.log("Email:", signUpData.user?.email);

  if (signUpData.user) {
    await setupUserData(signUpData.user.id, keepaApiKey);
  }
}

async function setupUserData(userId, keepaApiKey) {
  // Step 2: Create subscription record
  console.log("\n💳 Creating subscription record...");
  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      tier: "pro",
      status: "active"
    });

  if (subscriptionError) {
    if (subscriptionError.message.includes("duplicate key")) {
      console.log("⚠️  Subscription already exists");
    } else if (subscriptionError.message.includes("relation") && subscriptionError.message.includes("does not exist")) {
      console.error("❌ Table 'subscriptions' does not exist!");
      console.log("\n📖 Please create database tables first:");
      console.log("   See SETUP_INSTRUCTIONS.md for SQL commands");
      process.exit(1);
    } else {
      console.error("❌ Error creating subscription:", subscriptionError.message);
    }
  } else {
    console.log("✅ Subscription created (tier: pro)");
  }

  // Step 3: Add Keepa API key
  console.log("\n🔑 Adding Keepa API key...");
  const { error: integrationError } = await supabase
    .from("integrations")
    .insert({
      user_id: userId,
      keepa_api_key: keepaApiKey
    });

  if (integrationError) {
    if (integrationError.message.includes("duplicate key")) {
      console.log("⚠️  Keepa API key already exists");
    } else if (integrationError.message.includes("relation") && integrationError.message.includes("does not exist")) {
      console.error("❌ Table 'integrations' does not exist!");
      console.log("\n📖 Please create database tables first:");
      console.log("   See SETUP_INSTRUCTIONS.md for SQL commands");
      process.exit(1);
    } else {
      console.error("❌ Error adding Keepa API key:", integrationError.message);
    }
  } else {
    console.log("✅ Keepa API key added successfully");
  }

  // Success summary
  console.log("\n========================================");
  console.log("✅ TEST ACCOUNT READY!");
  console.log("========================================");
  console.log("Email: contact@prep-center.eu");
  console.log("Password: Parola.1234");
  console.log("Keepa API Key: Connected");
  console.log("Subscription: Pro (active)");
  console.log("========================================");
  console.log("\n🎉 You can now login to the application!");
}

setupDatabaseAndUser().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
