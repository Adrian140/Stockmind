export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { endpoint, ...params } = req.query;

    if (!endpoint) {
      res.status(400).json({ error: "Missing endpoint parameter" });
      return;
    }

    // Get Keepa API key from environment
    const keepaApiKey = process.env.VITE_KEEPA_API_KEY;
    if (!keepaApiKey) {
      res.status(500).json({ error: "Keepa API key not configured" });
      return;
    }

    // Build Keepa API URL
    const queryParams = new URLSearchParams({
      key: keepaApiKey,
      ...params,
    });

    const keepaUrl = `https://api.keepa.com${endpoint}?${queryParams.toString()}`;

    // Make request to Keepa API
    const keepaResponse = await fetch(keepaUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!keepaResponse.ok) {
      const errorData = await keepaResponse.json().catch(() => ({}));
      res.status(keepaResponse.status).json({
        error: errorData.error || `Keepa API error: ${keepaResponse.status}`,
      });
      return;
    }

    const data = await keepaResponse.json();

    if (data.error) {
      res.status(400).json({ error: data.error });
      return;
    }

    // Return successful response
    res.status(200).json(data);
  } catch (error) {
    console.error("Keepa Proxy Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
