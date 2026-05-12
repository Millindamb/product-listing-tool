const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");

// ── Helper: generate Shopify Handle from title ────────────────────────────────
function toHandle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Helper: clean price to whole number string ────────────────────────────────
function fmtPrice(val) {
  if (!val && val !== 0) return "";
  return Math.round(+val).toString();
}

// ── Helper: clean price with $ for import CSV ─────────────────────────────────
function fmtPriceImport(val) {
  if (!val && val !== 0) return "";
  return `$${Math.round(+val)}.00`;
}

// ── Competitive Pricing Logic (from Special_Guidelines.pdf) ───────────────────
function evaluateReprice(cp, rrp, competitorPrice, minMargin) {
  const potentialMargin = competitorPrice - cp;
  const minSP = cp + minMargin;

  if (potentialMargin >= minMargin) {
    // Can reprice — but don't exceed RRP
    const newSP = rrp ? Math.min(competitorPrice, rrp) : competitorPrice;
    return {
      canReprice: true,
      newSP: Math.round(newSP),
      potentialMargin: +potentialMargin.toFixed(2),
      reason: `Potential margin $${potentialMargin.toFixed(2)} ≥ min margin $${minMargin}`,
    };
  } else {
    // Cannot match competitor — use CP + min margin
    const newSP = rrp && minSP > rrp ? rrp : minSP;
    return {
      canReprice: false,
      newSP: Math.round(newSP),
      potentialMargin: +potentialMargin.toFixed(2),
      reason: `Potential margin $${potentialMargin.toFixed(2)} < min margin $${minMargin} — use CP + min margin`,
    };
  }
}

// ── POST /api/export/shopify-csv ──────────────────────────────────────────────
// Exports the EXACT 7-column format that Shopify's import accepts
// Matches: the_shopify_imported_CSV_file.csv template provided by HR
router.post("/shopify-csv", (req, res) => {
  const { products } = req.body;
  if (!products || products.length === 0) {
    return res.status(400).json({ error: "No products to export" });
  }

  // Exact headers matching the Shopify import template
  const headers = [
    "Title",
    "Variant SKU",
    "Variant Grams",
    "Variant Price",
    "Variant Compare At Price",
    "Supplier URL (product.metafields.custom.supplier_url)",
    "Cost per item",
  ];

  const rows = products.map((p) => [
    p.productTitle || "",
    p.sku || "",
    // Weight in grams — convert from kg
    p.weight ? Math.round(+p.weight * 1000) : "",
    // Variant Price = SP (selling price) — whole number with $ and .00
    p.sp ? fmtPriceImport(p.sp) : "",
    // Variant Compare At Price = RRP
    p.rrp ? fmtPriceImport(p.rrp) : "",
    // Supplier URL
    p.supplierUrl || "",
    // Cost per item = CP including GST
    p.cpGST ? fmtPriceImport(p.cpGST) : "",
  ]);

  // Build CSV string
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      r
        .map((cell) => {
          const str = String(cell);
          // Quote cells that contain commas or quotes
          return str.includes(",") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const csv = csvLines.join("\r\n");

  res.setHeader("Content-Disposition", `attachment; filename="Austpek_Shopify_Import_${Date.now()}.csv"`);
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

// ── POST /api/export/xlsx ─────────────────────────────────────────────────────
// Exports two sheets: "Final Pricing" + "Competitor Analysis" (per Special Guidelines)
router.post("/xlsx", (req, res) => {
  const { products } = req.body;
  if (!products || products.length === 0) {
    return res.status(400).json({ error: "No products to export" });
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Final Pricing ──────────────────────────────────────────────────
  // Matches the Shopify import CSV columns exactly for developer handoff
  const finalPricingHeaders = [
    "Title",
    "Variant SKU",
    "Variant Grams",
    "Variant Price",
    "Variant Compare At Price",
    "Supplier URL (product.metafields.custom.supplier_url)",
    "Cost per item",
    // Extra columns for internal reference
    "Category",
    "Brand",
    "Colour",
    "Size",
    "Weight (kg)",
    "Margin",
    "Margin OK?",
    "Status",
  ];

  const finalPricingRows = products.map((p) => {
    const margin = p.sp && p.cpGST ? Math.round(p.sp - p.cpGST) : "";
    return [
      p.productTitle || "",
      p.sku || "",
      p.weight ? Math.round(+p.weight * 1000) : "",
      p.sp ? fmtPrice(p.sp) : "",
      p.rrp ? fmtPrice(p.rrp) : "",
      p.supplierUrl || "",
      p.cpGST ? p.cpGST : "",
      p.category || "",
      p.brand || "",
      p.colour || "",
      p.size || "",
      p.weight || "",
      margin,
      p.marginOk ? "✓ YES" : "✗ NO",
      p.status || "draft",
    ];
  });

  const wsFinalPricing = XLSX.utils.aoa_to_sheet([finalPricingHeaders, ...finalPricingRows]);

  // Style header row
  wsFinalPricing["!cols"] = finalPricingHeaders.map((_, i) => ({
    wch: [50, 18, 14, 14, 20, 40, 14, 20, 15, 15, 12, 12, 10, 12, 10][i] || 15,
  }));

  XLSX.utils.book_append_sheet(wb, wsFinalPricing, "Final Pricing");

  // ── Sheet 2: Competitor Analysis ───────────────────────────────────────────
  // Per Special Guidelines: Name, SKU, Sell Price, RRP, Cost Price + Competitor columns
  const compHeaders = [
    "Product Name",
    "SKU",
    "Current Sell Price",
    "RRP",
    "Cost Price (inc GST)",
    "Min Margin",
    "Competitor 1 Price",
    "Competitor 1 Potential Margin",
    "Competitor 1 Can Reprice?",
    "Competitor 1 New SP",
    "Competitor 2 Price",
    "Competitor 2 Potential Margin",
    "Competitor 2 Can Reprice?",
    "Competitor 2 New SP",
    "Final Recommended SP",
    "Notes",
  ];

  const compRows = products.map((p) => {
    const cp = p.cpGST || 0;
    const minMargin = p.requiredMargin || 0;
    // Placeholders for competitor prices — team fills these in manually
    return [
      p.productTitle || "",
      p.sku || "",
      p.sp || "",
      p.rrp || "",
      cp,
      minMargin,
      "", // Competitor 1 Price — team fills
      "", // C1 Potential Margin — formula
      "", // C1 Can Reprice
      "", // C1 New SP
      "", // Competitor 2 Price — team fills
      "", // C2 Potential Margin
      "", // C2 Can Reprice
      "", // C2 New SP
      p.sp || "", // Final SP starts as current SP
      "",
    ];
  });

  const wsComp = XLSX.utils.aoa_to_sheet([compHeaders, ...compRows]);
  wsComp["!cols"] = compHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsComp, "Competitor Analysis");

  // ── Sheet 3: Pricing Reference ─────────────────────────────────────────────
  const refData = [
    ["AUSTPEK BATHROOMS — PRICING REFERENCE (Special Guidelines)"],
    [""],
    ["PRICING FORMULAS"],
    ["Sale Price (15% off RRP)", "= RRP × 0.85"],
    ["Sale Price (10% off RRP)", "= RRP × 0.90"],
    ["RRP (when not provided)", "= Sale Price × 1.10"],
    ["Cost Price (inc GST)", "= Cost Price (ex GST) × 1.10"],
    ["Cost Price (alt formula)", "= RRP × 0.65"],
    ["Potential Margin", "= Competitor Price − Cost Price (inc GST)"],
    [""],
    ["REPRICING RULE"],
    ["If Potential Margin ≥ Min Margin", "→ Can reprice to competitor price (capped at RRP)"],
    ["If Potential Margin < Min Margin", "→ New SP = Cost Price + Min Margin (capped at RRP)"],
    ["RRP Constraint", "→ If CP + Min Margin > RRP, then SP = RRP"],
    [""],
    ["MINIMUM MARGIN TABLE"],
    ["Category", "Minimum Margin"],
    ["Tapware | Accessories | Showers (CP < $150)", "$35.00"],
    ["Tapware | Accessories | Showers (CP ≥ $150)", "$60.00"],
    ["Towel Rails (SP > $1500)", "$175.00"],
    ["Grates (SP > $800)", "$150.00"],
    ["Toilet Paper Holders", "Min Price $30.00"],
    ["Robe Hooks", "Min Price $20.00"],
    ["Heating | Lighting", "$100.00 (fine to exceed RRP)"],
    ["Shower | Bath Screens Wall-to-Wall", "$250.00"],
    ["Shower | Bath Screens Covey Return Panel", "$125.00"],
    ["Bathtubs (excl. spa baths)", "$300.00"],
    ["Riva Transparent Bathtubs", "$700.00"],
    ["Spa Bathtubs", "$500.00"],
    ["Vanities | Cabinets", "$250.00"],
    ["Laundry Cabinets", "$250.00"],
    ["Basins", "$65.00"],
    ["Sinks", "$80.00"],
    ["Toilets (excl. Johnson Suisse)", "$175.00"],
    ["Toilets (Johnson Suisse)", "$300.00"],
    ["Toilets Under $300", "Make them $300.00"],
    ["Shaving Cabinet", "$150.00"],
    ["Tiles", "$35.00"],
    ["Saunas", "$300.00"],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef["!cols"] = [{ wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Pricing Reference");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Austpek_Final_Pricing_${Date.now()}.xlsx"`
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.send(buffer);
});

// ── POST /api/export/reprice ──────────────────────────────────────────────────
// Competitive repricing calculator — used by frontend reprice tool
// Body: { cp, rrp, currentSP, competitorPrices: [315, 299], category }
router.post("/reprice", (req, res) => {
  const { cp, rrp, currentSP, competitorPrices = [], minMargin } = req.body;

  if (!cp) return res.status(400).json({ error: "Cost price (cp) required" });

  const results = competitorPrices.map((price, i) => ({
    competitor: i + 1,
    competitorPrice: +price,
    ...evaluateReprice(+cp, rrp ? +rrp : null, +price, +minMargin || 0),
  }));

  // Best recommended SP = lowest viable competitor price that meets margin
  const validOptions = results.filter((r) => r.canReprice).map((r) => r.newSP);
  const recommendedSP = validOptions.length > 0
    ? Math.min(...validOptions)
    : results[0]?.newSP || Math.round(+cp + (+minMargin || 0));

  res.json({
    cp: +cp,
    rrp: rrp ? +rrp : null,
    currentSP: +currentSP,
    minMargin: +minMargin,
    results,
    recommendedSP,
    saving: currentSP ? Math.round(+currentSP - recommendedSP) : 0,
  });
});

module.exports = router;
