const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const Product = require("../models/Product");

// Column headers matching the actual Google Sheet sent to developer
const SHEET_HEADERS = [
  "Supplier URL","SKU","Product Title","Category","Brand","Collection",
  "Colour","Size","Style","CP (inc GST)","RRP","SP (Selling Price)",
  "Weight (kg)","Tags","Collections","Metafields: Brand","Metafields: Colour",
  "Metafields: Size","Metafields: Style","Metafields: Type","Metafields: Room",
  "Metafields: Material","Metafields: Supplier URL",
  "Description","AI Description","Warranty","Notes","Status",
];

function productToRow(p) {
  return [
    p.supplierUrl || "",
    p.sku || "",
    p.productTitle || "",
    p.category || "",
    p.brand || "",
    p.collection || "",
    p.colour || "",
    p.size || "",
    p.style || "",
    p.cpGST || "",
    p.rrp || "",
    p.sp || "",
    p.weight || "",
    (p.tags || []).join(", "),
    (p.collections || []).join(", "),
    p.metafields?.brand || p.brand || "",
    p.metafields?.colour || p.colour || "",
    p.metafields?.size || p.size || "",
    p.metafields?.style || p.style || "",
    p.metafields?.type || p.productType || "",
    p.metafields?.room || "",
    p.metafields?.material || "",
    p.supplierUrl || "",
    p.description || "",
    p.aiDescription || "",
    p.warranty || "",
    p.notes || "",
    p.status || "draft",
  ];
}

// ── POST /api/export/xlsx ─────────────────────────────────────────────────────
// Body: { products: [...] }  OR fetch all from DB
router.post("/xlsx", async (req, res) => {
  try {
    let products = req.body.products;

    // If no products in body, fetch all ready products from DB
    if (!products || products.length === 0) {
      try {
        products = await Product.find({ status: { $in: ["ready","draft"] } });
      } catch {
        products = [];
      }
    }

    if (products.length === 0) {
      return res.status(400).json({ error: "No products to export" });
    }

    // Build worksheet data
    const wsData = [SHEET_HEADERS, ...products.map(productToRow)];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = SHEET_HEADERS.map((h, i) => ({
      wch: [30,15,50,20,20,20,15,15,20,12,12,12,12,60,50,20,20,20,20,20,20,20,30,100,100,30,40,10][i] || 20,
    }));

    // Style header row (bold)
    SHEET_HEADERS.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws[cellRef]) return;
      ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "1A1A1A" } } };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    // Add a summary sheet
    const summaryData = [
      ["Export Summary"],
      ["Generated", new Date().toLocaleString()],
      ["Total Products", products.length],
      [""],
      ["Category", "Count"],
    ];
    const catCount = {};
    products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });
    Object.entries(catCount).forEach(([cat, count]) => summaryData.push([cat, count]));
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="Austpek_Products_${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
