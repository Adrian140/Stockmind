import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  console.log("\nRequired environment variables:");
  console.log("VITE_SUPABASE_URL=your_url");
  console.log("VITE_SUPABASE_ANON_KEY=your_anon_key");
  console.log("\nOptional (for service role access):");
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log("🚀 Starting Supabase migration...\n");

  try {
    const sqlFilePath = path.join(__dirname, "supabase-migrations", "00_complete_schema.sql");
    if (!fs.existsSync(sqlFilePath)) {
      console.error("❌ Migration file not found:", sqlFilePath);
      process.exit(1);
    }

    console.log("📄 Reading migration file...");
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

    console.log("📊 Migration contains:");
    console.log("  - Subscriptions table");
    console.log("  - Integrations table");
    console.log("  - Products table (extended with all fields)");
    console.log("  - Product notes table");
    console.log("  - Sales history table");
    console.log("  - Imports log table");
    console.log("  - RLS policies");
    console.log("  - Indexes");
    console.log("  - Auto-update triggers\n");

    console.log("⚠️  NOTE: This script cannot execute raw SQL directly.");
    console.log("📋 Please follow these steps:\n");
    console.log("1. Go to Supabase Dashboard → SQL Editor");
    console.log("2. Create a new query");
    console.log("3. Copy the content from: supabase-migrations/00_complete_schema.sql");
    console.log("4. Paste it into the SQL Editor");
    console.log("5. Click 'Run' to execute the migration\n");

    console.log("✅ The SQL file is ready at:");
    console.log("   " + sqlFilePath + "\n");

    console.log("🔍 Checking if tables already exist...");
    const tables = ["subscriptions", "integrations", "products", "product_notes", "sales_history", "imports_log"];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        if (error.message.includes("does not exist") || error.code === "PGRST204") {
          console.log(`  ❌ ${table} - NOT created yet`);
        } else {
          console.log(`  ⚠️  ${table} - Error: ${error.message}`);
        }
      } else {
        console.log(`  ✅ ${table} - Already exists`);
      }
    }

    console.log("\n📖 After running the migration SQL, run:");
    console.log("   npm run setup");
    console.log("   (This will create the test account and seed data)\n");

  } catch (error) {
    console.error("\n❌ Migration error:", error.message);
    process.exit(1);
  }
}

runMigration();
