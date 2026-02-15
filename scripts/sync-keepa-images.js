import { createClient } from "@supabase/supabase-js";

const DOMAIN_MAP = {
  US: 1,
  UK: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
  MX: 11
};

const FALLBACK_DOMAIN = "DE";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const keyPool = (process.env.KEEPA_API_KEYS || "")
  .split(/[,\n]/)
  .map((k) => k.trim())
  .filter(Boolean);

const tokensPerMinute = Math.max(1, Number(process.env.KEEPA_TOKENS_PER_MINUTE || 1));
const delayMs = Math.floor(60000 / tokensPerMinute);
const safetyRemaining = Math.max(0, Number(process.env.KEEPA_TOKEN_SAFETY_REMAINING || 0));
const maxItems = Math.max(0, Number(process.env.KEEPA_ITEMS_PER_RUN || 0));
const batchSize = Math.min(2000, Math.max(50, Number(process.env.KEEPA_BATCH_SIZE || 500)));
const targetUserId = (process.env.SUPABASE_ADMIN_USER_ID || process.env.TARGET_USER_ID || "").trim();

let keyIndex = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextPoolKey() {
  if (!keyPool.length) return null;
  const key = keyPool[keyIndex % keyPool.length];
  keyIndex += 1;
  return key;
}

function resolveDomain(marketplace) {
  const code = (marketplace || "").toUpperCase();
  if (DOMAIN_MAP[code]) return code;
  if (["BE", "NL", "PL", "SE", "IE"].includes(code)) return FALLBACK_DOMAIN;
  return FALLBACK_DOMAIN;
}

function buildImageUrl(imagesCSV) {
  if (!imagesCSV) return null;
  const first = imagesCSV.split(",")[0]?.trim();
  if (!first) return null;
  if (first.startsWith("http")) return first;
  return `https://images-na.ssl-images-amazon.com/images/I/${first}`;
}

function dedupeByUserAsin(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.user_id || !row?.asin) continue;
    const key = `${row.user_id}::${row.asin}`;
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return Array.from(map.values());
}

async function loadMissingProducts(limit) {
  let query = supabase
    .from("products")
    .select("user_id,asin,marketplace")
    .not("asin", "is", null)
    .is("image_url", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return dedupeByUserAsin(data || []);
}

async function loadUserIntegrationKeys(userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await supabase
    .from("integrations")
    .select("user_id,keepa_api_key")
    .in("user_id", userIds);
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (row?.user_id && row?.keepa_api_key) {
      map.set(row.user_id, row.keepa_api_key);
    }
  }
  return map;
}

async function fetchKeepaImage(keepaKey, asin, domain) {
  const params = new URLSearchParams({
    key: keepaKey,
    domain: String(DOMAIN_MAP[domain] || DOMAIN_MAP[FALLBACK_DOMAIN]),
    asin,
    stats: "0",
    history: "0"
  });
  const url = `https://api.keepa.com/product?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Keepa ${res.status}: ${text.slice(0, 180)}`);
  }

  const json = await res.json();
  if (typeof json.tokensLeft === "number" && json.tokensLeft <= safetyRemaining) {
    throw new Error(`Keepa tokens safety stop (${json.tokensLeft})`);
  }

  const imageUrl = buildImageUrl(json.products?.[0]?.imagesCSV);
  return imageUrl || null;
}

async function upsertAsinImage(userId, asin, imageUrl) {
  const { error } = await supabase
    .from("asin_images")
    .upsert(
      {
        user_id: userId,
        asin,
        image_url: imageUrl,
        source: "keepa-sync",
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,asin" }
    );
  if (error) throw error;
}

async function applyImageToProducts(userId, asin, imageUrl) {
  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("asin", asin);
  if (error) throw error;
}

async function getExistingAsinImage(userId, asin) {
  const { data, error } = await supabase
    .from("asin_images")
    .select("image_url")
    .eq("user_id", userId)
    .eq("asin", asin)
    .maybeSingle();
  if (error) throw error;
  return data?.image_url || null;
}

async function run() {
  console.log("Starting Keepa image sync");
  const candidates = await loadMissingProducts(batchSize);

  if (!candidates.length) {
    console.log("No products with missing images.");
    return;
  }

  const userIds = [...new Set(candidates.map((r) => r.user_id))];
  const integrationKeys = await loadUserIntegrationKeys(userIds);

  let processed = 0;
  let reused = 0;
  let found = 0;
  let notFound = 0;
  let failed = 0;
  let stoppedForTokens = false;

  for (const item of candidates) {
    if (maxItems > 0 && processed >= maxItems) break;
    processed += 1;

    const existing = await getExistingAsinImage(item.user_id, item.asin);
    if (existing) {
      await applyImageToProducts(item.user_id, item.asin, existing);
      reused += 1;
      continue;
    }

    const keepaKey = integrationKeys.get(item.user_id) || nextPoolKey();
    if (!keepaKey) {
      failed += 1;
      console.warn(`No Keepa key available for user=${item.user_id} asin=${item.asin}`);
      continue;
    }

    try {
      const domain = resolveDomain(item.marketplace);
      const imageUrl = await fetchKeepaImage(keepaKey, item.asin, domain);
      if (!imageUrl) {
        notFound += 1;
        continue;
      }

      await upsertAsinImage(item.user_id, item.asin, imageUrl);
      await applyImageToProducts(item.user_id, item.asin, imageUrl);
      found += 1;
    } catch (error) {
      failed += 1;
      const message = String(error?.message || "");
      console.warn(`Failed user=${item.user_id} asin=${item.asin}: ${message}`);

      // When Keepa tokens are depleted, stop this run immediately.
      // Nightly schedule will retry next day, avoiding pointless calls and long noisy runs.
      if (message.includes("tokens safety stop") || message.includes("Keepa 429")) {
        stoppedForTokens = true;
        break;
      }
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(
    JSON.stringify(
      {
        processed,
        found,
        reusedFromAsinImages: reused,
        notFound,
        failed,
        stoppedForTokens,
        scanned: candidates.length
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Keepa image sync failed:", error);
  process.exit(1);
});
