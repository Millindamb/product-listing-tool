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

// ── Rotate User-Agents to avoid bot detection ─────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];
function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

// ═══════════════════════════════════════════════════════════════════════════════
// IMPROVED scrapePage — stronger extraction with multiple strategies
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapePage(supplierUrl) {
  // ── Fetch with retry + fallback headers ──────────────────────────────────
  let html = "";
  let finalUrl = supplierUrl;

  const fetchAttempts = [
    // Attempt 1: Chrome-like desktop headers
    {
      headers: {
        "User-Agent":      randomUA(),
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-AU,en-GB;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control":   "no-cache",
        "Pragma":          "no-cache",
        "Sec-Fetch-Dest":  "document",
        "Sec-Fetch-Mode":  "navigate",
        "Sec-Fetch-Site":  "none",
        "Sec-Fetch-User":  "?1",
        "Upgrade-Insecure-Requests": "1",
        "DNT":             "1",
      },
    },
    // Attempt 2: Simpler headers (some sites block the complex ones)
    {
      headers: {
        "User-Agent":      randomUA(),
        "Accept":          "text/html,*/*;q=0.9",
        "Accept-Language": "en-AU,en;q=0.9",
      },
    },
    // Attempt 3: Mobile User-Agent (bypasses some desktop blocks)
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        "Accept":     "text/html,*/*;q=0.9",
      },
    },
  ];

  let lastFetchError = null;
  for (const attempt of fetchAttempts) {
    try {
      const res = await axios.get(supplierUrl, {
        timeout: 15000,
        maxRedirects: 10,
        ...attempt,
        // Follow redirects and capture final URL
        validateStatus: (status) => status < 400,
      });
      html     = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      finalUrl = res.request?.res?.responseUrl || supplierUrl;
      console.log(`[scrapePage] Fetched OK (${html.length} chars) from ${finalUrl}`);
      break;
    } catch (err) {
      lastFetchError = err;
      console.warn(`[scrapePage] Fetch attempt failed: ${err.message}`);
    }
  }

  if (!html) throw new Error(lastFetchError?.message || "All fetch attempts failed");

  const $ = cheerio.load(html);

  // ── Remove noise elements ─────────────────────────────────────────────────
  $(
    "script, style, nav, footer, header, .menu, .cookie, .popup, .cart, " +
    ".sidebar, .breadcrumb, .related, .reviews, iframe, .newsletter, " +
    ".social, .share, .back-to-top, noscript, .chatbot, .live-chat, " +
    "[class*='cookie'], [class*='popup'], [class*='modal'], [id*='cookie'], " +
    "[id*='popup'], [class*='banner'], [class*='notification']"
  ).remove();

  // ── 1. PRODUCT TITLE ──────────────────────────────────────────────────────
  const titleSelectors = [
    "h1.product-title", "h1.product_title", "h1.product-name",
    ".product-title h1", ".product-header h1",
    '[itemprop="name"]', ".entry-title",
    "h1[class*='product']", "h1[class*='title']",
    ".product__title", ".product-single__title",
    "h1",  // fallback
  ];
  let productTitle = "";
  for (const sel of titleSelectors) {
    const t = $(sel).first().text().trim();
    if (t && t.length > 3 && t.length < 300) { productTitle = t; break; }
  }

  // ── 2. PRICE — enhanced multi-strategy extraction ─────────────────────────
  let priceText = "";

  // Strategy A: Structured data (JSON-LD) — most reliable
  const jsonLdPrices = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const entries = Array.isArray(json) ? json : [json];
      entries.forEach(entry => {
        const checkEntry = (obj) => {
          if (!obj || typeof obj !== "object") return;
          if (obj["@type"] === "Product") {
            const offers = obj.offers || obj.Offers;
            if (offers) {
              const offerList = Array.isArray(offers) ? offers : [offers];
              offerList.forEach(o => {
                if (o.price)            jsonLdPrices.push(`RRP: $${o.price}`);
                if (o.highPrice)        jsonLdPrices.push(`High: $${o.highPrice}`);
                if (o.lowPrice)         jsonLdPrices.push(`Low: $${o.lowPrice}`);
                if (o.priceSpecification) {
                  const specs = Array.isArray(o.priceSpecification) ? o.priceSpecification : [o.priceSpecification];
                  specs.forEach(ps => { if (ps.price) jsonLdPrices.push(`Spec: $${ps.price}`); });
                }
              });
            }
          }
          // Recurse into nested objects
          if (obj["@graph"]) (Array.isArray(obj["@graph"]) ? obj["@graph"] : [obj["@graph"]]).forEach(checkEntry);
        };
        checkEntry(entry);
      });
    } catch {}
  });
  if (jsonLdPrices.length > 0) {
    priceText = jsonLdPrices.join(" | ");
    console.log(`[scrapePage] JSON-LD prices found: ${priceText}`);
  }

  // Strategy B: Meta tags (OpenGraph / standard)
  const metaPrice = $('meta[property="product:price:amount"]').attr("content")
    || $('meta[name="twitter:data1"]').attr("content")
    || $('meta[itemprop="price"]').attr("content")
    || $('[itemprop="price"]').attr("content")
    || $('[itemprop="price"]').text().trim();
  if (metaPrice) priceText += ` | Meta: $${metaPrice}`;

  // Strategy C: CSS class selectors
  const priceSelectors = [
    ".price",          ".product-price",   ".regular-price",
    ".rrp",            ".was-price",        ".original-price",
    ".price--regular", ".price__regular",
    "[class*='price']","[class*='rrp']",    "[class*='retail']",
    ".woocommerce-Price-amount", ".amount",
    "ins",             "del",
    ".product__price", ".price-item--regular",
    ".price-box .price", ".product-info-price .price",
    "[data-price]",
  ];
  let cssPrice = "";
  priceSelectors.forEach(sel => {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t && /\$|AUD|price/i.test(t)) cssPrice += " " + t;
    });
  });
  if (cssPrice) priceText += " | CSS: " + cssPrice.trim();

  // Strategy D: data-* attributes on elements
  $("[data-price], [data-regular-price], [data-compare-price], [data-product-price]").each((_, el) => {
    const p = $(el).attr("data-price") || $(el).attr("data-regular-price")
           || $(el).attr("data-compare-price") || $(el).attr("data-product-price");
    if (p) priceText += ` | data-attr: $${p}`;
  });

  // Fallback: regex search through the raw HTML for price patterns
  if (!priceText || priceText.length < 5) {
    const pricePattern = /\$\s?\d{1,5}(?:[.,]\d{2,3})?(?:\s*(?:AUD|inc\.?\s*GST|ex\.?\s*GST))?/gi;
    const rawPriceMatches = html.match(pricePattern) || [];
    if (rawPriceMatches.length > 0) {
      priceText += " | raw: " + [...new Set(rawPriceMatches)].slice(0, 6).join(" ");
    }
  }

  // ── 3. PRODUCT IMAGES — enhanced ─────────────────────────────────────────
  let imageUrls = [];

  // Strategy A: Common product image containers (highest quality)
  const imageContainerSelectors = [
    ".woocommerce-product-gallery__image img",
    ".product-images img", ".product-gallery img",
    ".product__media img", ".product-single__photo img",
    '[data-product-featured-media] img',
    "[class*='product-image'] img", "[class*='product-photo'] img",
    '[itemprop="image"]',
    ".product img",
  ];
  for (const sel of imageContainerSelectors) {
    $(sel).each((_, el) => {
      // Prefer high-res sources: data-src, data-large_image, srcset
      const src = $(el).attr("data-large_image")
        || $(el).attr("data-src")
        || $(el).attr("data-lazy-src")
        || $(el).attr("data-zoom-image")
        || $(el).attr("src");
      if (src && src.startsWith("http") && !/placeholder|logo|icon|sprite/i.test(src) && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
    if (imageUrls.length >= 3) break;
  }

  // Strategy B: JSON-LD image
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const entries = Array.isArray(json) ? json : [json];
      entries.forEach(entry => {
        const img = entry.image;
        if (!img) return;
        const urls = Array.isArray(img) ? img : typeof img === "string" ? [img] : img.url ? [img.url] : [];
        urls.forEach(u => { if (u && u.startsWith("http") && !imageUrls.includes(u)) imageUrls.push(u); });
      });
    } catch {}
  });

  // Strategy C: Open Graph image
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && ogImage.startsWith("http") && !imageUrls.includes(ogImage)) imageUrls.push(ogImage);

  // ── 4. SPECS / ATTRIBUTES — enhanced ─────────────────────────────────────
  let specsText = "";

  // Strategy A: Structured table rows (key → value)
  const specRows = [];
  $(".product-attributes tr, .specifications tr, .woocommerce-product-attributes tr, table tr, .tech-specs tr").each((_, row) => {
    const cells = $(row).find("td, th").map((_, c) => $(c).text().trim()).get();
    if (cells.length >= 2 && cells[0] && cells[1]) {
      specRows.push(`${cells[0]}: ${cells[1]}`);
    }
  });
  if (specRows.length > 0) {
    specsText = specRows.join(" | ");
    console.log(`[scrapePage] Spec rows found: ${specRows.length}`);
  }

  // Strategy B: Definition lists
  $("dl").each((_, dl) => {
    const dts = $(dl).find("dt").map((_, dt) => $(dt).text().trim()).get();
    const dds = $(dl).find("dd").map((_, dd) => $(dd).text().trim()).get();
    dts.forEach((key, i) => { if (dds[i]) specRows.push(`${key}: ${dds[i]}`); });
  });

  // Strategy C: Generic spec containers by class
  const specContainerSelectors = [
    "[class*='spec']", "[class*='attribute']", "[class*='feature']",
    "[class*='detail']", ".additional-info", ".product-meta",
    ".product-details", "[id*='spec']", "[id*='detail']",
  ];
  specContainerSelectors.forEach(sel => {
    $(sel).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t && t.length > 10) specsText += " " + t;
    });
  });

  // ── 5. DESCRIPTION TEXT — enhanced ───────────────────────────────────────
  let descriptionText = "";
  const descSelectors = [
    ".product-description",
    ".woocommerce-product-details__short-description",
    '[itemprop="description"]',
    ".description",
    "#description",
    ".product-summary",
    ".product__description",
    ".product-single__description",
    "[class*='product-desc']",
    "[class*='product-detail']",
    ".tab-content .active", // tab-based descriptions
    ".product-tabs .active",
    "#tab-description",
    ".short-description",
  ];
  for (const sel of descSelectors) {
    const t = $(sel).first().text().replace(/\s+/g, " ").trim();
    if (t && t.length > 30) { descriptionText = t.slice(0, 1200); break; }
  }

  // ── 6. BRAND / COLLECTION hints from page ────────────────────────────────
  let brandHint = "";
  let collectionHint = "";

  // From breadcrumbs
  const breadcrumb = $(".breadcrumb, [class*='breadcrumb'], nav[aria-label*='breadcrumb']").text().replace(/\s+/g, " ").trim();

  // From meta tags
  const ogBrand = $('meta[property="product:brand"]').attr("content")
    || $('[itemprop="brand"] [itemprop="name"]').text().trim()
    || $('[itemprop="brand"]').text().trim();
  if (ogBrand) brandHint = ogBrand;

  // From URL segments (e.g. /brands/caroma/ or /collections/liano/)
  try {
    const urlPath = new URL(supplierUrl).pathname;
    const brandMatch = urlPath.match(/\/brands?\/([\w-]+)/i) || urlPath.match(/\/manufacturers?\/([\w-]+)/i);
    if (brandMatch) brandHint = brandMatch[1].replace(/-/g, " ");
    const collMatch = urlPath.match(/\/collections?\/([\w-]+)/i) || urlPath.match(/\/series\/([\w-]+)/i) || urlPath.match(/\/range\/([\w-]+)/i);
    if (collMatch) collectionHint = collMatch[1].replace(/-/g, " ");
  } catch {}

  // ── 7. COLOUR / FINISH hints ──────────────────────────────────────────────
  let colourHint = "";

  // From swatches or variant selectors
  $("[class*='swatch'], [class*='color'], [class*='colour'], [class*='variant'], [class*='finish']").each((_, el) => {
    const t = $(el).attr("data-value") || $(el).attr("title") || $(el).attr("aria-label") || $(el).text().trim();
    if (t && t.length < 50 && /(chrome|black|white|gold|brushed|matte|polished|gunmetal|bronze|nickel|silver)/i.test(t)) {
      colourHint = t.trim();
      return false; // break
    }
  });

  // From selected option in select dropdowns
  if (!colourHint) {
    $("select option[selected], select option[data-selected='true']").each((_, el) => {
      const t = $(el).text().trim();
      if (/(chrome|black|white|gold|brushed|matte|polished)/i.test(t)) {
        colourHint = t;
        return false;
      }
    });
  }

  // ── 8. WELS / WATERMARK from page ────────────────────────────────────────
  let welsHint = "";
  const welsPattern = /(\d)\s*star\s*wels|wels[\s\:]*([\d.]+)\s*[Ll]\/min|watermark/i;
  const welsMatch = html.match(welsPattern);
  if (welsMatch) welsHint = welsMatch[0];

  // ── 9. WARRANTY hints ─────────────────────────────────────────────────────
  let warrantyHint = "";
  const warrantyPattern = /(\d+)\s*(?:year|yr)s?\s*(?:product|parts?|labour|labor|replacement|limited)?\s*warranty/gi;
  const warrantyMatches = [...html.matchAll(warrantyPattern)].map(m => m[0]);
  if (warrantyMatches.length > 0) warrantyHint = [...new Set(warrantyMatches)].slice(0, 3).join(", ");

  // ── 10. FULL BODY TEXT (trimmed, de-duped) ────────────────────────────────
  // Instead of raw body text, get the main content area
  let bodyText = "";
  const mainSelectors = ["main", "#main", ".main-content", ".site-main", "article", ".product-area", "#content", ".content"];
  for (const sel of mainSelectors) {
    const t = $(sel).first().text().replace(/\s+/g, " ").trim();
    if (t && t.length > 200) { bodyText = t.slice(0, 3000); break; }
  }
  if (!bodyText) bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  // ── Score the quality of the scrape ─────────────────────────────────────
  let qualityScore = 0;
  if (productTitle)              qualityScore += 25;
  if (priceText && jsonLdPrices.length > 0) qualityScore += 30; // JSON-LD is reliable
  else if (priceText)            qualityScore += 15;
  if (specsText && specRows.length > 0) qualityScore += 20;     // structured specs
  else if (specsText)            qualityScore += 10;
  if (descriptionText)           qualityScore += 15;
  if (imageUrls.length > 0)      qualityScore += 10;

  const confidence = qualityScore >= 75 ? "high" : qualityScore >= 40 ? "medium" : "low";
  console.log(`[scrapePage] Quality score: ${qualityScore}/100 → confidence: ${confidence}`);
  console.log(`[scrapePage] title="${productTitle}" price="${priceText.slice(0,80)}" specs=${specRows.length} desc=${descriptionText.length} images=${imageUrls.length}`);

  return {
    productTitle,
    priceText:       priceText.slice(0, 800),
    specsText:       specsText.slice(0, 1500),
    descriptionText,
    imageUrls:       imageUrls.slice(0, 3),
    bodyText,
    breadcrumb,
    brandHint,
    collectionHint,
    colourHint,
    welsHint,
    warrantyHint,
    qualityScore,
    scrapeConfidence: confidence,
    specRows: specRows.slice(0, 30),  // structured rows passed to Gemini
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/description/fetch-from-url
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/fetch-from-url", async (req, res) => {
  const { supplierUrl, category } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`[fetch-from-url] URL: ${supplierUrl} category: ${category}`);

  if (!supplierUrl) return res.status(400).json({ error: "supplierUrl is required" });
  if (!apiKey)      return res.status(500).json({ error: "GEMINI_API_KEY not set in .env" });

  // ── Step 1: Scrape ────────────────────────────────────────────────────────
  let scraped   = null;
  let scrapeErr = null;

  try {
    scraped = await scrapePage(supplierUrl);
    console.log(`[fetch-from-url] Scrape OK — score: ${scraped.qualityScore}/100 confidence: ${scraped.scrapeConfidence}`);
  } catch (err) {
    scrapeErr = err.message;
    console.warn(`[fetch-from-url] Scrape failed: ${scrapeErr} — Gemini knowledge fallback`);
  }

  // ── Step 2: Build Gemini prompt ───────────────────────────────────────────
  let urlHints = "";
  try {
    const urlObj  = new URL(supplierUrl);
    const brand   = urlObj.hostname.replace("www.", "").split(".")[0];
    const product = urlObj.pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    urlHints = `Brand hint from domain: ${brand}\nProduct hint from URL path: ${product}`;
  } catch {}

  // Build a rich, structured data block for Gemini
  let pageDataSection = "";
  if (scraped) {
    const structuredSpecs = scraped.specRows.length > 0
      ? `STRUCTURED SPEC ROWS (key: value):\n${scraped.specRows.join("\n")}`
      : "";

    pageDataSection = `
    PRODUCT TITLE: ${scraped.productTitle || "not found"}

    ${structuredSpecs}

    PRICE DATA:
    ${scraped.priceText || "none found"}

    PRODUCT DESCRIPTION FROM PAGE:
    ${scraped.descriptionText || "none found"}

    BRAND HINT FROM PAGE: ${scraped.brandHint || "none"}
    COLLECTION HINT FROM PAGE: ${scraped.collectionHint || "none"}
    BREADCRUMBS: ${scraped.breadcrumb || "none"}
    COLOUR/FINISH DETECTED: ${scraped.colourHint || "none"}
    WELS/WATERMARK DETECTED: ${scraped.welsHint || "none"}
    WARRANTY DETECTED: ${scraped.warrantyHint || "none"}

    SPECS / FEATURES TEXT:
    ${scraped.specsText || "none found"}

    MAIN PAGE BODY TEXT (for context):
    ${scraped.bodyText}`.trim();
      } else {
        pageDataSection = `PAGE COULD NOT BE SCRAPED (${scrapeErr})
    ${urlHints}
    Use your knowledge of Australian bathroom products to fill in as much as possible.`;
  }

  const extractPrompt = `You are a product data extraction assistant for an Australian bathroom products retailer (Austpek).

  Analyse the following supplier product page data and extract structured product information.
  Then write a 75-word premium ecommerce description.

  URL: ${supplierUrl}
  Category hint: ${category || "bathroom product"}

  ${pageDataSection}

  IMPORTANT INSTRUCTIONS:
  - For "rrp": extract the FULL retail price (not sale/discounted), in AUD. Australian prices almost always include GST.
  - For "brand": extract the manufacturer brand name only (e.g. "Caroma", "Grohe", "TOTO").
  - For "collection": extract the product series/range name (e.g. "Liano", "Urbane", "Essence").
  - For "colour": extract the exact finish/colour (e.g. "Matte Black", "Brushed Nickel", "Chrome").
  - For "size": extract dimensions (e.g. "600mm", "900 x 465mm").
  - For "wels": include star rating and flow rate if available (e.g. "4 Star 7.5L/min").
  - For "warranty": use the longest warranty mentioned (e.g. "15 Year Product Warranty").
  - For "confidence": score based on how much data you could reliably extract:
      "high" = name, brand, price, colour all found with certainty
      "medium" = most fields found but some uncertain
      "low" = few fields found, mostly guessing

  Return ONLY valid JSON with NO markdown, NO backticks, NO extra text.
  Use null for any field you cannot determine with reasonable confidence.

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
    // ── Step 3: Call Gemini with text + images ────────────────────────────
    const parts = [{ text: extractPrompt }];

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

    console.log(`[fetch-from-url] Gemini raw (first 300 chars): ${clean.slice(0, 300)}`);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error("Gemini returned non-JSON response");
    }

    // ── Merge scraped hints into parsed if Gemini missed them ─────────────
    if (scraped) {
      if (!parsed.imageUrls?.length && scraped.imageUrls.length > 0) parsed.imageUrls = scraped.imageUrls;
      if (!parsed.brand      && scraped.brandHint)      parsed.brand      = scraped.brandHint;
      if (!parsed.collection && scraped.collectionHint) parsed.collection = scraped.collectionHint;
      if (!parsed.colour     && scraped.colourHint)     parsed.colour     = scraped.colourHint;
      if (!parsed.wels       && scraped.welsHint)       parsed.wels       = scraped.welsHint;
      if (!parsed.warranty   && scraped.warrantyHint)   parsed.warranty   = scraped.warrantyHint;
    }

    // ── Confidence: use scrape quality score to validate/override ─────────
    // If scrape was high quality but Gemini says low, trust the data and upgrade
    if (scraped?.qualityScore >= 70 && parsed.confidence === "low") {
      parsed.confidence = "medium";
    }
    // If scrape quality was low, don't let Gemini claim high
    if (scraped && scraped.qualityScore < 30 && parsed.confidence === "high") {
      parsed.confidence = "medium";
    }
    // No scrape at all → cap at low
    if (!scraped) parsed.confidence = "low";

    parsed.scrapedOk         = !!scraped;
    parsed.usedModel         = `gemini/${geminiResult.model}`;
    parsed.imagesUsed        = parts.length - 1;
    parsed.scrapeQualityScore = scraped?.qualityScore || 0;

    console.log(`[fetch-from-url] Done — name: "${parsed.name}" rrp: ${parsed.rrp} confidence: ${parsed.confidence} score: ${parsed.scrapeQualityScore}`);
    res.json(parsed);

  } catch (err) {
    console.error("[fetch-from-url] Error:", err.message);
    res.status(500).json({
      error: err.message,
      scrapedOk: !!scraped,
      partialData: scraped ? {
        name:       scraped.productTitle,
        imageUrls:  scraped.imageUrls,
        brand:      scraped.brandHint,
        colour:     scraped.colourHint,
        wels:       scraped.welsHint,
        warranty:   scraped.warrantyHint,
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
      // Use the richer structured price data from the improved scraper
      pageContent = `PRICE DATA:\n${scraped.priceText}\n\nSPEC ROWS:\n${scraped.specRows.join("\n")}\n\nPAGE TEXT:\n${scraped.bodyText}`;
      console.log(`[fetch-rrp] Page fetched OK — price text: ${scraped.priceText.slice(0, 100)}`);
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