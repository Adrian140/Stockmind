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

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const resolveDomain = (marketplace) => {
  const code = (marketplace || "").toUpperCase();
  if (DOMAIN_MAP[code]) return code;
  if (["BE", "NL", "PL", "SE", "IE"].includes(code)) return FALLBACK_DOMAIN;
  return FALLBACK_DOMAIN;
};

const buildImageUrl = (imagesCSV) => {
  if (!imagesCSV) return null;
  const first = imagesCSV.split(",")[0]?.trim();
  if (!first) return null;
  if (first.startsWith("http")) return first;
  return `https://images-na.ssl-images-amazon.com/images/I/${first}`;
};

const fetchKeepaImage = async (keepaKey, asin, domain) => {
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
    throw new Error(`Keepa error ${res.status}: ${text.substring(0, 200)}`);
  }
  const json = await res.json();
  const product = json.products?.[0];
  if (!product) return null;
  return buildImageUrl(product.imagesCSV);
};

export default async function handler(req, res) {
  try {
    const userId = process.env.SUPABASE_ADMIN_USER_ID;
    if (!userId) {
      res.status(500).json({ error: "Missing SUPABASE_ADMIN_USER_ID" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("keepa_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (integrationError) {
      throw integrationError;
    }

    const keepaKey = integration?.keepa_api_key || process.env.KEEPA_API_KEY;
    if (!keepaKey) {
      res.status(500).json({ error: "Missing KEEPA_API_KEY (integration or env)" });
      return;
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, asin, marketplace")
      .eq("user_id", userId)
      .is("image_url", null)
      .not("asin", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (productError) throw productError;

    if (!product?.asin) {
      res.status(200).json({ ok: true, message: "No products pending image sync" });
      return;
    }

    const domain = resolveDomain(product.marketplace);
    const imageUrl = await fetchKeepaImage(keepaKey, product.asin, domain);
    if (!imageUrl) {
      res.status(200).json({ ok: true, message: "No image found for ASIN", asin: product.asin });
      return;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: imageUrl })
      .eq("user_id", userId)
      .eq("asin", product.asin);

    if (updateError) throw updateError;

    res.status(200).json({ ok: true, asin: product.asin, imageUrl });
  } catch (error) {
    console.error("Keepa image sync error:", error);
    res.status(500).json({ error: error.message });
  }
}
