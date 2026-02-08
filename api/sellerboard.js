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
    const { reportType } = req.query;

    if (!reportType) {
      res.status(400).json({ error: "Missing reportType parameter" });
      return;
    }

    // Get Sellerboard URLs from environment
    const urlMap = {
      sales_30d: process.env.SELLERBOARD_SALES_30D_URL,
      sales_monthly: process.env.SELLERBOARD_SALES_MONTHLY_URL,
      cogs: process.env.SELLERBOARD_COGS_URL,
      stock: process.env.SELLERBOARD_STOCK_URL
    };

    const sellerboardUrl = urlMap[reportType];

    if (!sellerboardUrl || sellerboardUrl.trim() === "") {
      res.status(400).json({ 
        error: `Sellerboard URL not configured for report type: ${reportType}`,
        reportType 
      });
      return;
    }

    // Make request to Sellerboard
    const sellerboardResponse = await fetch(sellerboardUrl, {
      method: "GET",
      headers: {
        "Accept": "text/csv",
        "User-Agent": "Mozilla/5.0 (compatible; SellerboardProxy/1.0)"
      }
    });

    if (!sellerboardResponse.ok) {
      const errorText = await sellerboardResponse.text().catch(() => "Unknown error");
      res.status(sellerboardResponse.status).json({
        error: `Sellerboard API error: ${sellerboardResponse.status}`,
        details: errorText,
        reportType
      });
      return;
    }

    const csvData = await sellerboardResponse.text();

    if (!csvData || csvData.trim() === "") {
      res.status(404).json({ 
        error: "Empty response from Sellerboard",
        reportType 
      });
      return;
    }

    // Return CSV data as plain text
    res.setHeader("Content-Type", "text/csv");
    res.status(200).send(csvData);
  } catch (error) {
    console.error("Sellerboard Proxy Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
}
