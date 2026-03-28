import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";

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
const maxWaitForTokenMs = Math.max(60_000, Number(process.env.KEEPA_MAX_WAIT_FOR_TOKEN_MS || 900_000)); // 15m default
// Un ASIN pe request pentru planul 1 token/min; ajustabil via KEEPA_BATCH_SIZE (dar limitat la 1 implicit).
const batchSize = Math.max(1, Math.min(10, Number(process.env.KEEPA_BATCH_SIZE || 1)));
const maxItems = Math.max(0, Number(process.env.KEEPA_ITEMS_PER_RUN || 0));
const defaultItemsPerRun = Math.max(1, Number(process.env.KEEPA_DEFAULT_ITEMS_PER_RUN || 1000));
const itemsPerRun = maxItems > 0 ? maxItems : defaultItemsPerRun;
const maxRequestsRaw = Number(process.env.KEEPA_MAX_REQUESTS_PER_RUN || 60);
const maxRequestsPerRun = maxRequestsRaw <= 0 ? Infinity : Math.max(1, maxRequestsRaw);
// Oprim cu 10 minute înainte de limita de 5h a jobului GitHub Actions.
const maxRuntimeMs = Math.max(
  60_000,
  Number(process.env.KEEPA_MAX_RUNTIME_MS || (290 * 60 * 1000))
);
const retryMaxMs = Math.max(10_000, Number(process.env.KEEPA_RETRY_MAX_MS || 120_000));
const targetUserId = (process.env.SUPABASE_ADMIN_USER_ID || process.env.TARGET_USER_ID || "").trim();
const updateAll = process.env.KEEPA_UPDATE_ALL_PRODUCTS !== "0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskKeepaKey(key) {
  if (!key) return "none";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
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

function dedupeProducts(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.user_id || !row?.asin) continue;
    const key = `${row.user_id}::${row.asin}::${row.marketplace || ""}`;
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
  return dedupeProducts(data || []);
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
    err.status = 429;
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

function getKeepaBuyBoxTotal(keepaData) {
  const basePriceRaw = keepaData?.buyBoxPrice ?? keepaData?.stats?.buyBoxPrice;
  const shippingRaw = keepaData?.buyBoxShipping;

  const basePrice = keepaPriceToDecimal(basePriceRaw);
  if (basePrice === null) return null;

  const shipping = keepaPriceToDecimal(shippingRaw) ?? 0;
  return Number((basePrice + shipping).toFixed(2));
}

async function getTokenBalance(keepaKey) {
  const params = new URLSearchParams({ key: keepaKey });
  const url = `https://api.keepa.com/token?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return { tokensLeft: 0, refillIn: 60000 };
  const json = await res.json().catch(() => ({}));
  return {
    tokensLeft: json.tokensLeft ?? 0,
    refillIn: json.refillIn ? Number(json.refillIn) * 1000 : 60000
  };
}

async function buildWorkerKeys(userIds, integrationKeys) {
  const workers = [];
  const seen = new Set();

  for (const userId of userIds) {
    const key = integrationKeys.get(userId);
    if (!key || seen.has(key)) continue;
    workers.push({ key, source: "integration", ownerUserId: userId });
    seen.add(key);
  }

  for (const key of keyPool) {
    if (!key || seen.has(key)) continue;
    workers.push({ key, source: "pool", ownerUserId: null });
    seen.add(key);
  }

  return workers;
}

async function waitForTokenSlot(keepaKey, label) {
  // Ensure we only proceed when at least one token above safetyRemaining is available.
  while (true) {
    const { tokensLeft, refillIn } = await getTokenBalance(keepaKey);
    if (tokensLeft > safetyRemaining) return tokensLeft;
    const waitMs = Math.max(refillIn || 60000, delayMs);
    if (waitMs > maxWaitForTokenMs) {
      const err = new Error(`No tokens for ${label || "keepaKey"}; wait ${waitMs}ms exceeds cap ${maxWaitForTokenMs}ms`);
      err.status = 429;
      err.retryIn = waitMs;
      err.stopForTokens = true;
      throw err;
    }
    console.warn(`No tokens available${label ? ` for ${label}` : ""}. tokensLeft=${tokensLeft}, waiting ${waitMs}ms...`);
    await sleep(waitMs);
  }
}

async function updateProductBuyBoxByAsin(userId, asin, marketplace, updates) {
  if (!updates || Object.keys(updates).length === 0) return;
  const { error } = await supabase
    .from("products")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("asin", asin)
    .eq("marketplace", marketplace);
  if (error) throw error;
}

async function run() {
  console.log("Starting Keepa buy box sync");
  const startTime = Date.now();
  const candidates = await loadTargetProducts(itemsPerRun);
  if (!candidates.length) {
    console.log("No products require Buy Box sync.");
    return;
  }

  const userIds = [...new Set(candidates.map((row) => row.user_id))];
  const integrationKeys = await loadUserIntegrationKeys(userIds);
  const workerKeys = await buildWorkerKeys(userIds, integrationKeys);
  const interRequestDelayMs = workerKeys.length > 1 ? 0 : delayMs;
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
  let requestsUsed = 0;
  const queue = [];
  let queuedItems = 0;

  for (const [key, items] of grouped.entries()) {
    const [userId, domain] = key.split("::");
    const batches = chunkArray(items, Math.min(batchSize, 100));
    for (const batch of batches) {
      if (itemsPerRun > 0 && queuedItems >= itemsPerRun) break;
      queue.push({ userId, domain, batch });
      queuedItems += batch.length;
    }
  }

  if (!workerKeys.length) {
    console.warn("No Keepa keys available from integration or pool.");
  } else {
    console.log(`Starting ${workerKeys.length} Keepa workers in parallel.`);
  }

  let queueIndex = 0;

  async function workerLoop(worker) {
    while (true) {
      if (requestsUsed >= maxRequestsPerRun) return;
      if (Date.now() - startTime >= maxRuntimeMs) {
        stoppedForTokens = true;
        return;
      }

      const task = queueIndex < queue.length ? queue[queueIndex++] : null;
      if (!task) return;

      const { userId, domain, batch } = task;
      const asins = batch.map((item) => item.asin).filter(Boolean);
      if (!asins.length) continue;

      console.log(
        `Using Keepa key source=${worker.source} user=${userId} key=${maskKeepaKey(worker.key)} workerOwner=${worker.ownerUserId || "pool"}`
      );

      let done = false;
      while (!done) {
        try {
          await waitForTokenSlot(worker.key, `user=${userId} domain=${domain} key=${maskKeepaKey(worker.key)}`);
          const keepaProducts = await fetchBuyBoxFromKeepa(worker.key, domain, asins);
          requestsUsed += 1;
          processed += batch.length;

          const productMap = new Map((keepaProducts || []).map((prod) => [prod.asin, prod]));
          for (const product of batch) {
            const keepaData = productMap.get(product.asin);
            const price = getKeepaBuyBoxTotal(keepaData);
            const updates = {};
            if (price !== null) {
              updates.bb_current = price;
              updates.bb_avg_7d = price;
              updates.bb_avg_30d = price;
            }
            await updateProductBuyBoxByAsin(product.user_id, product.asin, product.marketplace, updates);
            if (updates.bb_current) updated += 1;
          }

          done = true;
        } catch (error) {
          if (error.status === 429 || error.retryIn) {
            if (error.stopForTokens) {
              console.warn(
                `Stopped waiting for tokens for user=${userId} domain=${domain} key=${maskKeepaKey(worker.key)}; wait exceeded cap (${maxWaitForTokenMs} ms).`
              );
              stoppedForTokens = true;
              return;
            }
            const retryIn = Math.max(error.retryIn || 60000, delayMs);
            if (retryIn > maxWaitForTokenMs) {
              console.warn(
                `Skipping key for current run user=${userId} domain=${domain} key=${maskKeepaKey(worker.key)}; retryIn ${retryIn}ms exceeds cap ${maxWaitForTokenMs}ms.`
              );
              stoppedForTokens = true;
              return;
            }
            console.warn(
              `Rate limit hit for user=${userId} domain=${domain} key=${maskKeepaKey(worker.key)}. Waiting ${retryIn}ms for tokens, then retrying same batch...`
            );
            await sleep(retryIn);
            continue;
          }

          console.error(
            `Keepa buy box fetch failed for user=${userId} domain=${domain} key=${maskKeepaKey(worker.key)}:`,
            error.message
          );
          failed += batch.length;
          done = true;
        }
      }

      if (interRequestDelayMs > 0 && requestsUsed < maxRequestsPerRun) {
        await sleep(interRequestDelayMs);
      }
    }
  }

  await Promise.all(workerKeys.map((worker) => workerLoop(worker)));

  if (requestsUsed >= maxRequestsPerRun) {
    console.log(`Reached max requests per run (${requestsUsed}/${maxRequestsPerRun}). Stopping to respect rate.`);
  }

  if (Date.now() - startTime >= maxRuntimeMs) {
    console.log(`Reached max runtime (${maxRuntimeMs} ms). Stopping gracefully.`);
    stoppedForTokens = true;
  }

  console.log(`Completed Keepa buy box sync. Processed=${processed}, Updated=${updated}, Failed=${failed}, Requests=${requestsUsed}, StoppedForTokens=${stoppedForTokens}`);

  // Expune rezultate pentru GitHub Actions (pasul trebuie să aibă un id).
  if (process.env.GITHUB_OUTPUT) {
    const lines = [
      `processed=${processed}`,
      `updated=${updated}`,
      `failed=${failed}`,
      `stopped_for_tokens=${stoppedForTokens ? "true" : "false"}`
    ];
    await fs.appendFile(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  }
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error("Keepa buy box sync failed:", error);
    process.exit(1);
  }
})();
