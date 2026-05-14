const express = require("express");
const router =  express.Router();
const axios =   require("axios");
const cheerio = require("cheerio");
const multer =  require("multer");
const Groq =    require("groq-sdk");
const { buildAIPrompt, getDescriptionFeatures } = require("../data/rules");

// ── Multer — store uploaded images in memory ──────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Helper: buffer → Gemini inline image part ─────────────────────────────────
function bufferToGeminiPart(buffer, mimeType) {
  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

// ── Helper: trim to ~75 words ─────────────────────────────────────────────────
function trimTo75(text) {
  return text.trim().split(/\s+/).slice(0, 85).join(" ");
}

// ── Gemini model name — use the stable API name ───────────────────────────────
// gemini-2.0-flash is the latest but some accounts may only have gemini-1.5-flash
// We try 2.0 first then fall back to 1.5 automatically
const GEMINI_MODELS = [
  "gemini-2.5-flash",        // Best — latest stable, multimodal
  "gemini-2.0-flash",        // Good fallback
  "gemini-2.0-flash-lite",   // Lighter/faster fallback
  "gemini-2.5-flash-lite",   // Another good option
];

async function callGemini(apiKey, parts) {
  let lastError = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await axios.post(
        url,
        { contents: [{ parts }] },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) {
        console.log(`[Gemini] Success with model: ${modelName}`);
        return { text, model: modelName };
      }

      // Empty response — log and try next
      console.warn(`[Gemini] Empty response from ${modelName}:`, JSON.stringify(res.data));
      lastError = new Error(`Empty response from ${modelName}`);

    } catch (err) {
      // Log the full Gemini error response for debugging
      const status = err.response?.status;
      const errData = err.response?.data;
      console.error(`[Gemini] Error with model ${modelName}:`, status, JSON.stringify(errData));

      // 404 = model not found → try next model
      if (status === 404) { lastError = err; continue; }

      // 400 = bad request (invalid key format, bad payload)
      if (status === 400) {
        const msg = errData?.error?.message || "Bad request";
        throw new Error(`Gemini 400 Error: ${msg}`);
      }

      // 403 = API key invalid or not enabled
      if (status === 403) {
        const msg = errData?.error?.message || "API key invalid or Gemini API not enabled";
        throw new Error(`Gemini 403: ${msg} — Enable the Generative Language API at console.cloud.google.com`);
      }

      // 429 = rate limit
      if (status === 429) {
        console.warn(`[Gemini] Rate limit on ${modelName}, trying next model...`);
        lastError = new Error(`Rate limit on ${modelName}`);
        continue;
      }

      // Any other error — stop trying
      const msg = errData?.error?.message || err.message;
      throw new Error(`Gemini error (${status}): ${msg}`);
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

// ── POST /api/description/generate ───────────────────────────────────────────
router.post("/generate", upload.array("images", 2), async (req, res) => {
  const {
    name, colours, material, compatibility,
    warranty, category, model = "gemini",
  } = req.body;

  console.log(`[generate] model=${model} name="${name}" category="${category}"`);

  const basePrompt = buildAIPrompt({ name, colours, material, compatibility, warranty, category });
  const images = req.files || [];

  try {
    let description = "";
    let usedModel = model;

    // ── GEMINI (primary — free, multimodal) ───────────────────────────────────
    if (model === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY not set in .env — " +
          "get a free key at https://aistudio.google.com/app/apikey"
        );
      }

      // Build text prompt — add visual instruction if images provided
      const textPrompt = images.length > 0
        ? "You are a professional bathroom product copywriter for a premium Australian retailer.\n" +
          "Carefully analyse the product image(s) provided AND the product details below.\n" +
          "Use visible details from the images (design, finish, shape, mounting style) " +
          "to write a 75-word premium ecommerce product description.\n\n" +
          basePrompt
        : basePrompt;

      const parts = [{ text: textPrompt }];
      images.forEach((img) => parts.push(bufferToGeminiPart(img.buffer, img.mimetype)));

      const result = await callGemini(apiKey, parts);
      description = result.text;
      usedModel = `gemini/${result.model}`;

    // ── GROQ (secondary — free, text only) ───────────────────────────────────
    } else if (model === "groq") {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GROQ_API_KEY not set in .env — " +
          "get a free key at https://console.groq.com/keys"
        );
      }

      const groq = new Groq({ apiKey });
      const groqRes = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a professional bathroom product copywriter for a premium Australian retailer. " +
              "Write concise, customer-friendly 75-word product descriptions that highlight " +
              "design, durability, and usability in a premium tone. No bullet points.",
          },
          { role: "user", content: basePrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      description = groqRes.choices?.[0]?.message?.content || "";

    } else {
      throw new Error(`Unknown model "${model}". Valid options: gemini, groq`);
    }

    if (!description) throw new Error("AI returned an empty response — please try again");

    const trimmed = trimTo75(description);
    console.log(`[generate] Success — ${trimmed.split(/\s+/).length} words`);

    res.json({
      description: trimmed,
      wordCount: trimmed.split(/\s+/).length,
      model: usedModel,
      imagesUsed: images.length,
      note:
        model === "groq" && images.length > 0
          ? "Groq is text-only — images were ignored. Switch to Gemini for image analysis."
          : undefined,
    });

  } catch (err) {
    console.error("[generate] Final error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/description/template ───────────────────────────────────────────
router.post("/template", (req, res) => {
  const {
    title, colours, sizes, features, warranty,
    domesticWarranty, commercialWarranty, category,
  } = req.body;

  const featureFields = getDescriptionFeatures(category);
  const featureLines = featureFields
    .map((f) => {
      const key = f.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
      return `• ${f}: ${features?.[key] || ""}`;
    })
    .join("\n");

  const template = `**${title?.toUpperCase()}**
Also Available in ${colours || "______"}
${sizes ? `Also Available in Sizes: ${sizes}` : ""}

**Product Features:**
${featureLines}

**Warranty Information:**
${domesticWarranty
    ? `• Domestic: ${domesticWarranty} years replacement warranty`
    : `• ${warranty || "__"} years replacement warranty`}
${commercialWarranty ? `• Commercial: ${commercialWarranty} years replacement warranty` : ""}

[AI description goes here — generate above]`;

  res.json({ template: template.trim() });
});

// ── GET /api/description/features/:category ───────────────────────────────────
router.get("/features/:category", (req, res) => {
  res.json({ features: getDescriptionFeatures(req.params.category) });
});

// ── GET /api/description/test-gemini ─────────────────────────────────────────
// Hit this in browser to diagnose Gemini issues: http://localhost:5000/api/description/test-gemini
router.get("/test-gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ ok: false, error: "GEMINI_API_KEY not set in .env" });

  const results = [];
  for (const modelName of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const r = await axios.post(url,
        { contents: [{ parts: [{ text: "Say hello in 5 words." }] }] },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      results.push({ model: modelName, ok: true, response: text.slice(0, 60) });
      break; // stop at first working model
    } catch (e) {
      results.push({ model: modelName, ok: false, status: e.response?.status, error: e.response?.data?.error?.message || e.message });
    }
  }
  res.json({ results });
});

// ── POST /api/description/fetch-rrp ──────────────────────────────────────────
// Strategy:
// 1. Try to fetch the supplier page HTML directly
// 2. If blocked (403) — fallback to Gemini knowledge about brand + SKU
// 3. Parse whatever we get and return a price or helpful message
router.post("/fetch-rrp", async (req, res) => {
  const { supplierUrl, sku } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set in .env" });
  if (!supplierUrl && !sku) return res.json({ rrp: null, message: "Enter a Supplier URL or SKU first" });

  // ── Extract brand name and product name from the URL for Gemini fallback ───
  let brandHint = "";
  let productHint = "";
  if (supplierUrl) {
    try {
      const urlObj = new URL(supplierUrl);
      brandHint = urlObj.hostname.replace("www.", "").split(".")[0];
      productHint = urlObj.pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    } catch {}
  }

  // ── Strategy 1: Try fetching the actual page ──────────────────────────────
  let pageContent = null;
  let fetchBlocked = false;

  if (supplierUrl) {
    try {
      console.log(`[fetch-rrp] Attempting page fetch: ${supplierUrl}`);
      const pageRes = await axios.get(supplierUrl, {
        timeout: 10000,
        headers: {
          "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-AU,en;q=0.9",
          "Cache-Control":   "no-cache",
        },
        maxRedirects: 5,
      });

      const $ = cheerio.load(pageRes.data);
      $("script, style, nav, footer, header, .menu, .cookie, .popup, .cart, .sidebar").remove();

      // Target price-specific elements first
      const priceSelectors = [
        ".price", ".product-price", ".regular-price", ".rrp", ".was-price",
        "[class*='price']", "[class*='rrp']", "[class*='retail']",
        ".woocommerce-Price-amount", ".amount", "ins", "del",
        '[itemprop="price"]', '[itemprop="offers"]',
      ];
      let priceText = "";
      priceSelectors.forEach(sel => {
        $(sel).each((_, el) => { priceText += " " + $(el).text().trim(); });
      });

      const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2500);
      pageContent = `PRICE ELEMENTS:
${priceText.slice(0, 500)}

PAGE TEXT:
${bodyText}`;
      console.log(`[fetch-rrp] Page fetched OK — ${bodyText.length} chars`);

    } catch (fetchErr) {
      fetchBlocked = true;
      console.log(`[fetch-rrp] Page fetch blocked/failed (${fetchErr.response?.status || fetchErr.message}) — using Gemini knowledge fallback`);
    }
  }

  // ── Strategy 2: Build Gemini prompt based on what we have ─────────────────
  let prompt;

  if (pageContent) {
    // We have real page content — ask Gemini to extract the price
    prompt = `You are a pricing extraction assistant for an Australian bathroom retailer.
    Extract the RRP (Recommended Retail Price), list price, or standard retail price from this page content.
    Prices are in AUD and typically include GST.
    If multiple prices exist, return the original/highest price (not sale/discounted price).
    SKU: ${sku || "not provided"}

    Return ONLY valid JSON, no markdown, no extra text:
    {"rrp": 190, "includesGST": true}
    OR if no price found:
    {"rrp": null, "message": "No price visible on page"}

    ${pageContent}`;
  } else {
    // Page was blocked — use Gemini's knowledge about this brand + SKU
    prompt = `You are a pricing expert for Australian bathroom products.
    A supplier page could not be accessed directly.
    Based on your knowledge of Australian bathroom product pricing, what is the typical RRP for:
    Brand/Supplier: ${brandHint || "unknown"}
    Product: ${productHint || "unknown"}
    SKU: ${sku || "not provided"}
    URL: ${supplierUrl || "not provided"}

    If you know or can reasonably estimate this product's Australian RRP (inc GST), return:
    {"rrp": 190, "includesGST": true, "source": "estimated"}

    If you have no reliable knowledge of this specific product's price, return:
    {"rrp": null, "message": "Supplier site blocked access — please check the URL and enter RRP manually"}

    Return ONLY valid JSON, no markdown, no extra text.`;
  }

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 20000 }
    );

    const raw = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    console.log(`[fetch-rrp] Gemini response: ${clean}`);

    const parsed = JSON.parse(clean);

    // If it's an estimate, add a note so the user knows to verify
    if (parsed.source === "estimated" && parsed.rrp) {
      parsed.message = `Estimated RRP — please verify against supplier catalogue`;
    }

    res.json(parsed);

  } catch (geminiErr) {
    console.error("[fetch-rrp] Gemini error:", geminiErr.message);
    res.json({
      rrp: null,
      message: fetchBlocked
        ? "Supplier site blocked access — enter RRP manually from their catalogue"
        : "Could not extract RRP — enter manually",
    });
  }
});

module.exports = router;
