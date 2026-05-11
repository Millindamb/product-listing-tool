const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const {
  calculateSP, calculateRRP, addGST, calculateWeight,
  getMarginRule, resolveColourTag, TITLE_FORMATS,
  PRODUCT_TYPES, ALL_CATEGORIES, STYLES, BRANDS,
} = require("../data/rules");

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.json([]); // return empty array if DB not connected
  }
});

// ── POST /api/products ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.status(201).json(p);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.id, req.body, { new: true });
    res.json(p);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── POST /api/products/calculate ─────────────────────────────────────────────
// Core engine: takes raw inputs, returns all computed fields
router.post("/calculate", (req, res) => {
  const { cpRaw, cpIncludesGST, rrpRaw, rrpIncludesGST, category, brand, colour, sp: manualSP } = req.body;

  // 1. Cost price with GST
  const cpGST = cpIncludesGST ? +cpRaw : +addGST(+cpRaw);

  // 2. RRP with GST
  let rrp = rrpRaw ? (rrpIncludesGST ? Math.round(+rrpRaw) : Math.round(addGST(+rrpRaw))) : null;

  // 3. Selling price
  let sp = manualSP ? Math.round(+manualSP) : calculateSP(cpGST, rrp, category, brand);

  // Special rule: toilets under $300 → make $300
  if (category === "Toilets Under $300") sp = Math.max(sp, 300);

  // If no RRP, derive from SP
  if (!rrp) rrp = calculateRRP(sp);

  // 4. Margin validation
  const rule = getMarginRule(category, sp, cpGST);
  const actualMargin = sp - cpGST;
  const requiredMargin = rule.hardMinPrice ? rule.hardMinPrice - cpGST : (rule.margin || 0);
  const marginOk = rule.hardMinPrice ? sp >= rule.hardMinPrice : actualMargin >= (rule.margin || 0);

  // 5. Weight
  const weightResult = calculateWeight(category, sp, brand);

  // 6. Colour tag
  const colourTag = resolveColourTag(colour);

  // 7. Title format hint
  const titleFormat = TITLE_FORMATS[category] || "Brand > Collection > Product Type > Colour";

  res.json({
    cpGST: +cpGST.toFixed(2),
    rrp,
    sp,
    actualMargin: +actualMargin.toFixed(2),
    requiredMargin: +requiredMargin.toFixed(2),
    marginOk,
    marginNote: rule.note || "",
    weight: weightResult.weight,
    weightUnit: weightResult.unit,
    weightNote: weightResult.note || "",
    colourTag,
    titleFormat,
  });
});

// ── GET /api/products/meta ────────────────────────────────────────────────────
// Return dropdown data for frontend
router.get("/meta", (req, res) => {
  res.json({ ALL_CATEGORIES, PRODUCT_TYPES, STYLES, BRANDS, TITLE_FORMATS });
});

module.exports = router;
