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
  .split(/[\n,]/)
  .map((k) => k.trim())
  .filter(Boolean);

const tokensPerMinute = Math.max(1, Number(process.env.KEEPA_TOKENS_PER_MINUTE || 1));
const delayMs = Math.floor(60000 / tokensPerMinute);
const safetyRemaining = Math.max(0, Number(process.env.KEEPA_TOKEN_SAFETY_REMAINING || 0));
const batchSize = Math.min(100, Math.max(5, Number(process.env.KEEPA_BATCH_SIZE || 50)));
const maxItems = Math.max(0, Number(process.env.KEEPA_ITEMS_PER_RUN || 0));
const targetUserId = (process.env.SUPABASE_ADMIN_USER_ID || process.env.TARGET_USER_ID || "").trim();
const updateAll = process.env.KEEPA_UPDATE_ALL_PRODUCTS === "1";

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

function buildDomainKey(userId, domain) {
  return `${userId}::${domain}`;
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

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadTargetProducts(limit) {
  let query = supabase
    .from("products")
    .select("id,user_id,asin,marketplace")
    .not("asin", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (!updateAll) {
    query = query.or("bb_current.is.null,bb_current.eq.0");
  }

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

async function fetchBuyBoxFromKeepa(keepaKey, domain, asins) {
  const domainId = DOMAIN_MAP[domain] || DOMAIN_MAP[FALLBACK_DOMAIN];
  const params = new URLSearchParams({
    key: keepaKey,
    domain: String(domainId),
    asin: asins.join(","),
    buybox: "1",
    stats: "1"
  });
  const url = `https://api.keepa.com/product?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (res.status === 429) {
    const json = await res.json().catch(() => ({}));
    const retryIn = json.refillIn ? Number(json.refillIn) * 1000 : 60000;
    const err = new Error("Keepa rate limit");
    err.retryIn = retryIn;
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Keepa ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (typeof json.tokensLeft === "number" && json.tokensLeft <= safetyRemaining) {
    const err = new Error(`Keepa tokens safety stop (${json.tokensLeft})`);
    err.retryIn = json.refillIn ? Number(json.refillIn) * 1000 : 60000;
    throw err;
  }
  return json.products || [];
}

function keepaPriceToDecimal(price) {
  if (price === null || price === undefined || price <= 0) {
    return null;
  }
  return Number((price / 100).toFixed(2));
}

async function updateProductBuyBoxByAsin(userId, asin, updates) {
  if (!updates || Object.keys(updates).length === 0) return;
  const { error } = await supabase
    .from("products")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("asin", asin);
  if (error) throw error;
}

async function run() {
  console.log("Starting Keepa buy box sync");
  const candidates = await loadTargetProducts(batchSize);
  if (!candidates.length) {
    console.log("No products require Buy Box sync.");
    return;
  }

  const userIds = [...new Set(candidates.map((row) => row.user_id))];
  const integrationKeys = await loadUserIntegrationKeys(userIds);
  const grouped = new Map();

  for (const candidate of candidates) {
    const domain = resolveDomain(candidate.marketplace);
    const key = buildDomainKey(candidate.user_id, domain);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidate);
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;
  let stoppedForTokens = false;

  for (const [key, items] of grouped.entries()) {
    if (maxItems > 0 && processed >= maxItems) break;
    const [userId, domain] = key.split("::");
    const keepaKey = integrationKeys.get(userId) || nextPoolKey();
    if (!keepaKey) {
      console.warn(`No Keepa key available for user=${userId}`);
      continue;
    }

    const batches = chunkArray(items, Math.min(batchSize, 100));
    for (const batch of batches) {
      if (maxItems > 0 && processed >= maxItems) break;
      const asins = batch.map((item) => item.asin).filter(Boolean);
      if (!asins.length) continue;

      processed += batch.length;
      let done = false;
      while (!done) {
        try {
          const keepaProducts = await fetchBuyBoxFromKeepa(keepaKey, domain, asins);
          const productMap = new Map((keepaProducts || []).map((prod) => [prod.asin, prod]));

          for (const product of batch) {
            const keepaData = productMap.get(product.asin);
            const priceSource = keepaData?.buyBoxPrice ?? keepaData?.stats?.buyBoxPrice;
            const price = keepaPriceToDecimal(priceSource);
            const updates = {};
            if (price !== null) {
              updates.bb_current = price;
              updates.bb_avg_7d = price;
              updates.bb_avg_30d = price;
            }
            await updateProductBuyBoxByAsin(product.user_id, product.asin, updates);
            if (updates.bb_current) updated += 1;
          }
          done = true;
        } catch (error) {
          if (error.status === 429 || error.retryIn) {
            const retryIn = error.retryIn || 60000;
            console.warn(`Rate limit hit for user=${userId} domain=${domain}. Waiting ${retryIn}ms then retrying same batch...`);
            await sleep(retryIn);
            continue;
          }
          console.error(`Keepa buy box fetch failed for user=${userId} domain=${domain}:`, error.message);
          failed += batch.length;
          done = true;
        }
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  console.log(`Completed Keepa buy box sync. Processed=${processed}, Updated=${updated}, Failed=${failed}, StoppedForTokens=${stoppedForTokens}`);
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error("Keepa buy box sync failed:", error);
    process.exit(1);
  }
})();
