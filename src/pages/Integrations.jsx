import React, { useState, useEffect } from "react";
import { Key, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import ProductImporter from "../components/admin/ProductImporter";
import { parseCSV } from "../services/sellerboard.service";

export default function Integrations() {
  const { user } = useAuth();
  const [keepaKey, setKeepaKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagesFile, setImagesFile] = useState(null);
  const [imagesImporting, setImagesImporting] = useState(false);
  const [imagesImported, setImagesImported] = useState(0);

  useEffect(() => {
    loadIntegrations();
  }, [user]);

  const loadIntegrations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setKeepaKey(data.keepa_api_key || "");
      }
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveIntegrations = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("integrations")
        .upsert({
          user_id: user.id,
          keepa_api_key: keepaKey,
          keepa_connected_at: keepaKey ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      toast.success("API keys saved successfully!");
    } catch (error) {
      console.error("Error saving integrations:", error);
      toast.error("Failed to save API keys");
    } finally {
      setSaving(false);
    }
  };

  const importImagesCsv = async () => {
    if (!user) return;
    if (!imagesFile) {
      toast.error("Select an image CSV first");
      return;
    }

    try {
      setImagesImporting(true);
      setImagesImported(0);

      const text = await imagesFile.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        toast.error("CSV has no data rows");
        return;
      }

      const normalizeImageUrl = (value) => {
        if (!value) return "";
        const trimmed = String(value).trim();
        if (!trimmed) return "";

        if (trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              const first = parsed.find((item) => typeof item === "string" && item.trim());
              if (first) return first.trim();
            }
          } catch (error) {
            // Fallback below for malformed JSON-like arrays
          }

          const inner = trimmed.replace(/^\[\s*"?/, "").replace(/"?\s*\]$/, "");
          const first = inner.split(",")[0] || "";
          return first.trim().replace(/^"+|"+$/g, "");
        }

        return trimmed.replace(/^"+|"+$/g, "");
      };

      const mapped = [];
      for (const row of rows) {
        const asin = row["ASIN"] || row["asin"] || row["Asin"] || "";
        const rawImageUrl =
          row["Image"] ||
          row["ImageURL"] ||
          row["image_url"] ||
          row["image_urls"] ||
          row["ImageURLs"] ||
          row["Image Urls"] ||
          row["URL"] ||
          row["url"] ||
          "";
        const imageUrl = normalizeImageUrl(rawImageUrl);
        if (!asin || !imageUrl) continue;
        mapped.push({
          user_id: user.id,
          asin,
          image_url: imageUrl,
          source: "upload",
          updated_at: new Date().toISOString()
        });
      }

      if (!mapped.length) {
        toast.error("No ASIN + image URL pairs found in CSV");
        return;
      }

      const { data, error } = await supabase
        .from("asin_images")
        .upsert(mapped, { onConflict: "user_id,asin" })
        .select("asin");

      if (error) throw error;

      const importedCount = data?.length || mapped.length;
      setImagesImported(importedCount);

      const byAsin = new Map();
      for (const item of mapped) {
        if (!byAsin.has(item.asin)) byAsin.set(item.asin, item.image_url);
      }
      for (const [asin, imageUrl] of byAsin.entries()) {
        await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("user_id", user.id)
          .eq("asin", asin)
          .is("image_url", null);
      }

      toast.success(`Imported ${importedCount} images`);
    } catch (error) {
      console.error("Error importing images:", error);
      toast.error("Failed to import images");
    } finally {
      setImagesImporting(false);
    }
  };

  return (
    <div id="integrations-page" className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-white">Integrations</h1>
        <p className="text-lg font-extralight text-slate-400 mt-1">
          Connect your data sources for real-time analytics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-amazon-orange/10">
              <Key className="w-6 h-6 text-amazon-orange" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white">Keepa API</h2>
              <p className="text-lg font-extralight text-slate-400">Product tracking & analytics</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-lg font-extralight text-slate-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={keepaKey}
                onChange={(e) => setKeepaKey(e.target.value)}
                placeholder="Enter your Keepa API key"
                className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-3 text-lg font-extralight text-white placeholder:text-slate-500 focus:outline-none focus:border-amazon-orange"
              />
            </div>

            <div className="flex items-center gap-2 text-lg font-extralight text-slate-400">
              {keepaKey ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Not configured</span>
                </>
              )}
            </div>

            <p className="text-lg font-extralight text-slate-500">
              Get your API key from{" "}
              <a
                href="https://keepa.com/#!api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amazon-orange hover:underline"
              >
                keepa.com/#!api
              </a>
            </p>
          </div>
        </div>
      </div>

      <ProductImporter />

      <div className="flex justify-end">
        <button
          onClick={saveIntegrations}
          disabled={saving || loading}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amazon-orange text-white hover:bg-orange-600 transition-colors disabled:opacity-50 text-lg font-extralight"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Save API Keys
            </>
          )}
        </button>
      </div>
    </div>
  );
}
