const express = require("express");
const router  = express.Router();
const axios   = require("axios");
const cheerio = require("cheerio");
const multer  = require("multer");
const Groq    = require("groq-sdk");
const { buildAIPrompt, getDescriptionFeatures } = require("../data/rules");

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function bufferToGeminiPart(buffer, mimeType) {
  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

function trimTo75(text) {
  return text.trim().split(/\s+/).slice(0, 85).join(" ");
}

// ── Gemini models (fallback chain) ────────────────────────────────────────────
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
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
        { headers: { "Content-Type": "application/json" }, timeout: 30000 }
      );
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) { console.log(`[Gemini] Success with model: ${modelName}`); return { text, model: modelName }; }
      console.warn(`[Gemini] Empty response from ${modelName}`);
      lastError = new Error(`Empty response from ${modelName}`);
    } catch (err) {
      const status  = err.response?.status;
      const errData = err.response?.data;
      console.error(`[Gemini] Error with model ${modelName}:`, status, JSON.stringify(errData));
      if (status === 404) { lastError = err; continue; }
      if (status === 400) throw new Error(`Gemini 400 Error: ${errData?.error?.message || "Bad request"}`);
      if (status === 403) throw new Error(`Gemini 403: ${errData?.error?.message || "API key invalid"}`);
      if (status === 429) { console.warn(`[Gemini] Rate limit on ${modelName}, trying next...`); lastError = new Error(`Rate limit on ${modelName}`); continue; }
      throw new Error(`Gemini error (${status}): ${errData?.error?.message || err.message}`);
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

// ── Shared page scraper (used by both fetch-rrp and fetch-from-url) ───────────
async function scrapePage(supplierUrl) {
  const pageRes = await axios.get(supplierUrl, {
    timeout: 12000,
    headers: {
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-AU,en;q=0.9",
      "Cache-Control":   "no-cache",
    },
    maxRedirects: 5,
  });

  const $ = cheerio.load(pageRes.data);

  // Remove noise
  $("script, style, nav, footer, header, .menu, .cookie, .popup, .cart, .sidebar, .breadcrumb, .related, .reviews, iframe").remove();

  // ── Extract price ──────────────────────────────────────────────────────────
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

  // ── Extract product title ─────────────────────────────────────────────────
  const titleSelectors = ["h1", ".product-title", ".product-name", '[itemprop="name"]', ".entry-title"];
  let productTitle = "";
  for (const sel of titleSelectors) {
    const t = $(sel).first().text().trim();
    if (t && t.length > 3) { productTitle = t; break; }
  }

  // ── Extract product images ────────────────────────────────────────────────
  const imageSelectors = [
    ".product-image img",    ".woocommerce-product-gallery img",
    '[itemprop="image"]',    ".product img", ".gallery img",
    "img[class*='product']", "img[class*='main']",
  ];
  let imageUrls = [];
  for (const sel of imageSelectors) {
    $(sel).each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (src && src.startsWith("http") && !imageUrls.includes(src)) imageUrls.push(src);
    });
    if (imageUrls.length >= 2) break;
  }

  // ── Extract specs / features table ───────────────────────────────────────
  const specSelectors = [
    ".product-attributes", ".specifications", ".product-specs",
    ".woocommerce-product-attributes", "table", ".tech-specs",
    "[class*='spec']", "[class*='attribute']", "[class*='feature']",
  ];
  let specsText = "";
  specSelectors.forEach(sel => {
    $(sel).each((_, el) => { specsText += " " + $(el).text().replace(/\s+/g, " ").trim(); });
  });

  // ── Extract description text ──────────────────────────────────────────────
  const descSelectors = [
    ".product-description",     ".woocommerce-product-details__short-description",
    '[itemprop="description"]', ".description", "#description", ".product-summary",
  ];
  let descriptionText = "";
  for (const sel of descSelectors) {
    const t = $(sel).first().text().replace(/\s+/g, " ").trim();
    if (t && t.length > 20) { descriptionText = t.slice(0, 800); break; }
  }

  // ── Full body text as fallback ────────────────────────────────────────────
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  return {
    productTitle,
    priceText:       priceText.slice(0, 600),
    specsText:       specsText.slice(0, 1000),
    descriptionText,
    imageUrls:       imageUrls.slice(0, 2),
    bodyText,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ── POST /api/description/fetch-from-url
// Scrapes supplier URL → Gemini extracts all fields + writes description
// Returns: { name, rrp, colour, size, material, type, wels, warranty,
//            description, imageUrls, category, brand, collection }
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/fetch-from-url", async (req, res) => {
  const { supplierUrl, category } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`[fetch-from-url] URL: ${supplierUrl} category: ${category}`);

  if (!supplierUrl) return res.status(400).json({ error: "supplierUrl is required" });
  if (!apiKey)      return res.status(500).json({ error: "GEMINI_API_KEY not set in .env" });

  // ── Step 1: Scrape the page ───────────────────────────────────────────────
  let scraped   = null;
  let scrapeErr = null;

  try {
    scraped = await scrapePage(supplierUrl);
    console.log(`[fetch-from-url] Scrape OK — title: "${scraped.productTitle}" images: ${scraped.imageUrls.length}`);
  } catch (err) {
    scrapeErr = err.message;
    console.warn(`[fetch-from-url] Scrape failed: ${scrapeErr} — using URL-only Gemini fallback`);
  }

  // ── Step 2: Build Gemini prompt ───────────────────────────────────────────
  let urlHints = "";
  try {
    const urlObj  = new URL(supplierUrl);
    const brand   = urlObj.hostname.replace("www.", "").split(".")[0];
    const product = urlObj.pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    urlHints = `Brand hint from URL: ${brand}\nProduct hint from URL: ${product}`;
  } catch {}

  const pageDataSection = scraped
    ? `PRODUCT TITLE FROM PAGE: ${scraped.productTitle || "not found"}
    
    PRICE ELEMENTS FROM PAGE:
    ${scraped.priceText || "none found"}

    SPECS / ATTRIBUTES FROM PAGE:
    ${scraped.specsText || "none found"}

    DESCRIPTION TEXT FROM PAGE:
    ${scraped.descriptionText || "none found"}

    FULL PAGE BODY (first 3000 chars):
    ${scraped.bodyText}`
        : `PAGE COULD NOT BE SCRAPED (${scrapeErr})
    ${urlHints}
    Use your knowledge of Australian bathroom products to fill in as much as possible.`;

      const extractPrompt = `You are a product data extraction assistant for an Australian bathroom products retailer (Austpek).

    Analyse the following supplier product page data and extract structured product information.
    Then write a 75-word premium ecommerce description.

    URL: ${supplierUrl}
    Category hint: ${category || "bathroom product"}

    ${pageDataSection}

    Return ONLY valid JSON with NO markdown, NO backticks, NO extra text.
    Use null for any field you cannot determine.

    {
      "name": "full product title",
      "brand": "brand name only e.g. Caroma",
      "collection": "collection or series name e.g. Liano",
      "rrp": 299,
      "rrpIncludesGST": true,
      "colour": "e.g. Matte Black",
      "size": "e.g. 600mm or 120 x 60mm",
      "material": "e.g. Brass, Ceramic",
      "type": "e.g. Wall Mounted Basin Mixer",
      "wels": "e.g. 4 Star 7.5L/min",
      "flowRate": "e.g. 7.5L/min",
      "mounting": "e.g. Wall Mounted",
      "warranty": "e.g. 15 Year Product Warranty",
      "additional": "any other notable specs",
      "description": "75-word premium ecommerce description — no bullet points, premium Australian retailer tone",
      "imageUrls": [],
      "confidence": "high | medium | low"
    }`;

  try {
    // ── Step 3: Call Gemini with text (+ images if scraped successfully) ──────
    const parts = [{ text: extractPrompt }];

    // If we got image URLs from scraping, fetch and attach up to 2
    if (scraped?.imageUrls?.length > 0) {
      for (const imgUrl of scraped.imageUrls.slice(0, 2)) {
        try {
          const imgRes  = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 8000 });
          const mimeType = imgRes.headers["content-type"] || "image/jpeg";
          if (mimeType.startsWith("image/")) {
            parts.push(bufferToGeminiPart(Buffer.from(imgRes.data), mimeType));
            console.log(`[fetch-from-url] Attached image: ${imgUrl}`);
          }
        } catch (imgErr) {
          console.warn(`[fetch-from-url] Could not fetch image ${imgUrl}: ${imgErr.message}`);
        }
      }
    }

    const geminiResult = await callGemini(apiKey, parts);
    const raw   = geminiResult.text;
    const clean = raw.replace(/```json|```/g, "").trim();

    console.log(`[fetch-from-url] Gemini raw response (first 300 chars): ${clean.slice(0, 300)}`);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // Try to extract JSON from the response if it has surrounding text
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Gemini returned non-JSON response");
      }
    }

    // Merge scraped image URLs if Gemini didn't return any
    if ((!parsed.imageUrls || parsed.imageUrls.length === 0) && scraped?.imageUrls?.length > 0) {
      parsed.imageUrls = scraped.imageUrls;
    }

    // Add metadata
    parsed.scrapedOk   = !!scraped;
    parsed.usedModel   = `gemini/${geminiResult.model}`;
    parsed.imagesUsed  = parts.length - 1;

    console.log(`[fetch-from-url] Success — name: "${parsed.name}" rrp: ${parsed.rrp} confidence: ${parsed.confidence}`);
    res.json(parsed);

  } catch (err) {
    console.error("[fetch-from-url] Error:", err.message);
    res.status(500).json({
      error: err.message,
      scrapedOk: !!scraped,
      partialData: scraped ? {
        name:  scraped.productTitle,
        imageUrls: scraped.imageUrls,
      } : null,
    });
  }
});

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
    let usedModel   = model;

    if (model === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env — get a free key at https://aistudio.google.com/app/apikey");

      const textPrompt = images.length > 0
        ? "You are a professional bathroom product copywriter for a premium Australian retailer.\n" +
          "Carefully analyse the product image(s) provided AND the product details below.\n" +
          "Use visible details from the images (design, finish, shape, mounting style) " +
          "to write a 75-word premium ecommerce product description.\n\n" + basePrompt
        : basePrompt;

      const parts = [{ text: textPrompt }];
      images.forEach((img) => {
        if (img?.buffer?.length > 0) parts.push(bufferToGeminiPart(img.buffer, img.mimetype));
      });

      const result = await callGemini(apiKey, parts);
      description  = result.text;
      usedModel    = `gemini/${result.model}`;

    } else if (model === "groq") {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY not set in .env — get a free key at https://console.groq.com/keys");

      const groq    = new Groq({ apiKey });
      const groqRes = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a professional bathroom product copywriter for a premium Australian retailer. " +
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
      wordCount:   trimmed.split(/\s+/).length,
      model:       usedModel,
      imagesUsed:  images.length,
      note: model === "groq" && images.length > 0
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
  const { title, colours, sizes, features, warranty, domesticWarranty, commercialWarranty, category } = req.body;
  const featureFields = getDescriptionFeatures(category);
  const featureLines  = featureFields
    .map((f) => { const key = f.split(" ")[0].toLowerCase().replace(/[^a-z]/g, ""); return `• ${f}: ${features?.[key] || ""}`; })
    .join("\n");

  const template = `**${title?.toUpperCase()}**
  Also Available in ${colours || "______"}
  ${sizes ? `Also Available in Sizes: ${sizes}` : ""}

  **Product Features:**
  ${featureLines}

  **Warranty Information:**
  ${domesticWarranty ? `• Domestic: ${domesticWarranty} years replacement warranty` : `• ${warranty || "__"} years replacement warranty`}
  ${commercialWarranty ? `• Commercial: ${commercialWarranty} years replacement warranty` : ""}

  [AI description goes here — generate above]`;

  res.json({ template: template.trim() });
});

  // ── GET /api/description/features/:category ───────────────────────────────────
router.get("/features/:category", (req, res) => {
  res.json({ features: getDescriptionFeatures(req.params.category) });
});

  // ── GET /api/description/test-gemini ─────────────────────────────────────────
router.get("/test-gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ ok: false, error: "GEMINI_API_KEY not set in .env" });
  const results = [];
  for (const modelName of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const r   = await axios.post(url,
        { contents: [{ parts: [{ text: "Say hello in 5 words." }] }] },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      results.push({ model: modelName, ok: true, response: text.slice(0, 60) });
      break;
    } catch (e) {
      results.push({ model: modelName, ok: false, status: e.response?.status, error: e.response?.data?.error?.message || e.message });
    }
  }
  res.json({ results });
});

// ── POST /api/description/fetch-rrp ──────────────────────────────────────────
router.post("/fetch-rrp", async (req, res) => {
  const { supplierUrl, sku } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)                return res.status(500).json({ error: "GEMINI_API_KEY not set in .env" });
  if (!supplierUrl && !sku)   return res.json({ rrp: null, message: "Enter a Supplier URL or SKU first" });

  let brandHint = "", productHint = "";
  if (supplierUrl) {
    try {
      const urlObj  = new URL(supplierUrl);
      brandHint     = urlObj.hostname.replace("www.", "").split(".")[0];
      productHint   = urlObj.pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    } catch {}
  }

  let pageContent  = null;
  let fetchBlocked = false;

  if (supplierUrl) {
    try {
      const scraped = await scrapePage(supplierUrl);
      pageContent   = `PRICE ELEMENTS:\n${scraped.priceText}\n\nPAGE TEXT:\n${scraped.bodyText}`;
      console.log(`[fetch-rrp] Page fetched OK`);
    } catch (fetchErr) {
      fetchBlocked = true;
      console.log(`[fetch-rrp] Page blocked (${fetchErr.message}) — Gemini knowledge fallback`);
    }
  }

  const prompt = pageContent
    ? `Extract the RRP (Recommended Retail Price) from this Australian bathroom product page.
    Prices are in AUD and typically include GST.
    If multiple prices exist, return the original/highest price (not sale/discounted).
    SKU: ${sku || "not provided"}
    Return ONLY valid JSON, no markdown:
    {"rrp": 190, "includesGST": true}
    OR {"rrp": null, "message": "No price visible on page"}

    ${pageContent}`
        : `You are a pricing expert for Australian bathroom products.
        A supplier page could not be accessed.
        Brand: ${brandHint || "unknown"} | Product: ${productHint || "unknown"} | SKU: ${sku || "not provided"} | URL: ${supplierUrl || ""}
        If you can reasonably estimate this product's Australian RRP (inc GST), return:
        {"rrp": 190, "includesGST": true, "source": "estimated"}
        Otherwise: {"rrp": null, "message": "Supplier site blocked — enter RRP manually"}
        Return ONLY valid JSON, no markdown.`;

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 20000 }
    );
    const raw    = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const clean  = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed.source === "estimated" && parsed.rrp) parsed.message = "Estimated RRP — verify against supplier catalogue";
    res.json(parsed);
  } catch (geminiErr) {
    console.error("[fetch-rrp] Gemini error:", geminiErr.message);
    res.json({
      rrp: null,
      message: fetchBlocked
        ? "Supplier site blocked access — enter RRP manually"
        : "Could not extract RRP — enter manually",
    });
  }
});

module.exports = router;