# AUSTPEK — Product Listing Tool

> Internal tool for the Austpek Bathrooms product listing team.
> Automates pricing, title formatting, AI descriptions, tags, competitive repricing and Shopify export.

**README last synced with source:** `src/` as uploaded (App.js, businessRule.js, panels/, utils/, hooks/, components/)

---

## Table of Contents

- [What's New](#whats-new)
- [What It Does](#what-it-does)
- [File Structure](#file-structure)
- [Where to Make Changes](#where-to-make-changes)
- [Data Flow](#data-flow)
- [Responsive Layout](#responsive-layout)
- [Business Rules Reference](#business-rules-reference)
  - [Categories](#categories-28)
  - [Margin Rules](#margin-rules)
  - [Weight Rules](#weight-rules)
  - [Pricing Modes & Formulas](#pricing-modes--formulas)
  - [Title Formats](#title-formats)
  - [Tag Schemas](#tag-schemas)
  - [Description Fields](#description-fields)
- [Setup & Run Locally](#setup--run-locally)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Offline / Fallback Behaviour](#offline--fallback-behaviour)
- [Workflow](#workflow)
- [Deployment](#deployment)
- [Known Issues & Data Gaps](#known-issues--data-gaps)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## What's New

| Feature | v1 | v2 | v2.1 | v2.2 (current src) |
|---|---|---|---|---|
| AI Models | Gemini only | Gemini 2.0 Flash + Groq Llama 3.3 70B | Same | Same |
| Image Upload | ✗ | ✅ Up to 2 images (Gemini only) | Same | Same |
| Export | Single .xlsx | Shopify Import CSV + Final Pricing .xlsx | Same | ✅ + local CSV fallback when backend is down |
| Reprice Tool | ✗ | ✅ Competitive Repricing Calculator | Same | ✅ + local fallback calculation |
| Pricing Formulas | ✗ | ✅ Special Guidelines reference panel | Same | Same |
| Queue View | Basic cards | CP / SP / RRP / Weight per product | Same | ✅ Loads saved queue from API on mount |
| Responsive Layout | ✗ | ✗ | ✅ Mobile + Tablet | Same |
| Mobile Navigation | ✗ | ✗ | ✅ Section tab bar | Same |
| Sticky Header | ✗ | ✗ | ✅ Fixed top nav | Same |
| **Auto-fill from URL** | ✗ | ✗ | ✗ | ✅ Scrapes supplier page → fills all fields + description |
| **Extracted Data Preview** | ✗ | ✗ | ✗ | ✅ Shows scraped values, images and confidence (high/medium/low) |
| **Fetch RRP button** | ✗ | ✗ | ✗ | ✅ Standalone RRP scrape from Supplier URL or SKU |
| **Description Auto / Manual mode** | ✗ | ✗ | ✗ | ✅ Toggle between scraped description and manual build |
| **Product Type selector** | ✗ | ✗ | ✗ | ✅ 45 product types — locks exact title format + tag schema |
| **Product Spec + Attributes** | ✗ | ✗ | ✗ | ✅ Extra spec text + 16 selectable attribute chips appended to title |
| **Reset button** | ✗ | ✗ | ✗ | ✅ Clears the whole Add Product form from the header |
| **AUTO field badges** | ✗ | ✗ | ✗ | ✅ Shows which fields are synced from Product Details |
| **Business rules file** | — | `constants/index.js` | Same | ⚠ Renamed to `src/businessRule.js` |

---

## What It Does

| Feature | Detail |
|---|---|
| **Auto-fill from URL** | Paste a supplier product URL → backend scrapes the page and fills Brand, Collection, Colour, Size, RRP, feature fields, warranty and a generated description. Returns a confidence rating so the lister knows how carefully to review |
| **Title Builder** | Builds titles from the exact part sequence for the selected **Product Type** (61 formats), or falls back to the **Category** format (19 formats). Output is always UPPERCASE |
| **Pricing Calculator** | 5 pricing modes, GST handling on CP and RRP, validates SP against the category minimum margin, flags violations, calculates dispatch weight |
| **Description Builder** | Category-specific feature fields + editable multi-row warranty block + AI copy, assembled into one copy-ready description |
| **AI Description** | ~75-word product copy via Gemini 2.0 Flash (accepts 1–2 images) or Groq Llama 3.3 70B (text only) |
| **Tags & Metafields** | Generates Shopify tags from the product type's tag schema (`Collections_`, `Brand_`, `Colour_`, `Style_`, `Configuration_`, `Size_`, `Shape_`, `Finish_`) plus metafield values |
| **Reprice Tool** | Checks whether competitor prices can be matched while holding the category minimum margin; warns when the result exceeds RRP |
| **Product Queue** | Batch multiple products, review CP / SP / RRP / weight / margin status before export |
| **Shopify Import CSV** | Exact 7-column format ready to import into Shopify |
| **Final Pricing .xlsx** | 3-sheet Excel: Final Pricing + Competitor Analysis + Pricing Reference |

---

## File Structure

```
src/
├── index.js                         ← React entry point (createRoot + StrictMode)
├── App.js                           ← Routing, shared state, layout, save/delete/export
├── businessRule.js                  ← ALL business rules & lookup tables:
│                                       MARGIN_RULES_FE, WEIGHT_RULES_FE, ALL_CATEGORIES,
│                                       TAG_FIELD_DEFS, SCHEMAS_FE, PRODUCT_TAG_MAP_FE,
│                                       ALL_PRODUCT_TYPES_FLAT, PRODUCT_TITLE_FORMATS,
│                                       CATEGORY_TITLE_FORMATS, DESCRIPTION_FEATURES,
│                                       FEATURE_LABELS, PRODUCT_SPEC_TAGS
│
├── hooks/
│   └── useResponsive.js             ← Breakpoint hook (isMobile, isTablet, isDesktop, width)
│
├── utils/
│   └── pricing.js                   ← Pure logic: calcMargin(), calcWeight(), buildTagsFromSchema()
│
├── components/
│   └── ui.jsx                       ← Base components: Badge, Field, Input, Select, Btn, Card, SectionTitle
│
└── panels/
    ├── ProductDetailsSection.jsx    ← SKU, Category, Product Type, Brand/Collection/Colour/Size, Auto-fill from URL
    ├── TitleBuilder.jsx             ← Title part fields + Product Spec + attribute chips + live preview
    ├── PricingPanel.jsx             ← CP/RRP/SP calculator, 5 pricing modes, Fetch RRP
    ├── DescriptionBuilder.jsx       ← Auto/Manual mode, feature fields, warranty rows, AI generation
    ├── TagsPanel.jsx                ← Schema-driven Shopify tags + metafields
    ├── ProductList.jsx              ← Queue view with CSV / XLSX export
    └── RepriceCalculator.jsx        ← Competitive repricing tool
```

> ⚠ **Changed from the previous README:** business rules now live in **`src/businessRule.js`**, not `src/constants/index.js`. `src/index.js` is the React entry point, not the constants file. The main app file is **`App.js`**, not `App.jsx`. All panels import rules as `../businessRule`.

### How to install

Drop all files into `src/`, keeping the folder layout above. `App.js` sits at the root of `src/` alongside `index.js` and `businessRule.js`.

---

## Where to Make Changes

| What you want to change | File to edit | Export to edit |
|---|---|---|
| Add/edit a product category | `businessRule.js` | `ALL_CATEGORIES` |
| Change margin rules | `businessRule.js` | `MARGIN_RULES_FE` |
| Change weight rules | `businessRule.js` | `WEIGHT_RULES_FE` |
| Add a new product type | `businessRule.js` | `PRODUCT_TAG_MAP_FE` **and** `PRODUCT_TITLE_FORMATS` |
| Change tag schemas / prefixes | `businessRule.js` | `SCHEMAS_FE`, `TAG_FIELD_DEFS` |
| Change category-level title format | `businessRule.js` | `CATEGORY_TITLE_FORMATS` |
| Change description feature fields | `businessRule.js` | `DESCRIPTION_FEATURES`, `FEATURE_LABELS` |
| Change title attribute chips | `businessRule.js` | `PRODUCT_SPEC_TAGS` |
| Fix pricing / weight / tag-build logic | `utils/pricing.js` | `calcMargin`, `calcWeight`, `buildTagsFromSchema` |
| Change a UI component (button, input) | `components/ui.jsx` | — |
| Add a new pricing mode | `panels/PricingPanel.jsx` | `MODES` |
| Change AI model options | `panels/DescriptionBuilder.jsx` | `MODEL_INFO` |
| Change the description template | `panels/DescriptionBuilder.jsx` | `fullDescription` |
| Change title builder UI | `panels/TitleBuilder.jsx` | — |
| Change tags panel / tag colours | `panels/TagsPanel.jsx` | `tagColor` |
| Change product details form | `panels/ProductDetailsSection.jsx` | — |
| Change queue view / export buttons | `panels/ProductList.jsx` | — |
| Change reprice logic | `panels/RepriceCalculator.jsx` | — |
| Change layout / nav / tabs / save payload | `App.js` | `NAV`, `MOBILE_SECTIONS`, `saveProduct` |
| Change breakpoints | `hooks/useResponsive.js` | — |

> **Adding a product type is a two-table job.** `ALL_PRODUCT_TYPES_FLAT` is derived from `PRODUCT_TAG_MAP_FE` keys, so a type added only to `PRODUCT_TITLE_FORMATS` never appears in the dropdown. See [Known Issues](#known-issues--data-gaps).

---

## Data Flow

`App.js` owns all shared state and passes it down. Nothing is stored in a global store or context.

```
App.js
 ├── shared fields ── sharedBrand / sharedCollection / sharedColour / sharedSize
 │     └── consumed by ProductDetailsSection, TitleBuilder, TagsPanel, DescriptionBuilder
 │         → fields fed from these show an AUTO badge in the child panel
 │
 ├── category ──────► resets productType on change; gates TitleBuilder / TagsPanel / DescriptionBuilder
 ├── productType ───► selects the exact title format + tag schema
 ├── generatedTitle ◄─ TitleBuilder onChange (UPPERCASE)
 ├── pricing ───────◄─ PricingPanel onResult  { cp, rrp, sp, actualMargin, required, marginOk, weight, weightNote, pricingMode }
 ├── autoFilled ────► DescriptionBuilder (feature fields, warranty, description)
 ├── autoFilledRrp ─► PricingPanel (pre-fills RRP + its GST flag)
 └── products[] ────► ProductList (queue + export)
```

### Title assembly

```
[ ...title format parts ] + [ Product Specification ] + [ selected attribute chips ]  → .toUpperCase()
```

### Save payload (`POST /api/products`)

```
supplierUrl, sku, productTitle, category, productType,
brand, collection, colour, size, style,
cpGST, rrp, sp, weight, marginOk, requiredMargin,
notes, status: "draft"
```

---

## Responsive Layout

Breakpoints come from `useResponsive()` — no external library.

| Screen | Width | Layout |
|---|---|---|
| **Desktop** | ≥ 1024px | 2-column grid — Details + Tags on left; Title + Pricing + Description + Save on right |
| **Tablet** | 640px – 1023px | Single column with section tab bar |
| **Mobile** | < 640px | Single column with section tab bar, compact 48px header |

### Mobile / Tablet Section Tabs

```
[ Details ] [ Title ] [ Pricing ] [ Desc ] [ Tags ]
```

- **Save to Queue** stays visible at the bottom regardless of the active section.
- Title / Desc / Tags sections show "Select a Category first" until a category is chosen.
- Header shows a **Reset** button whenever the Add Product tab is active.

---

## Business Rules Reference

All values below are read directly from `src/businessRule.js`.

### Categories (28)

```
Tapware · Accessories · Showers · Shower Screens · Bathtubs · Vanities · Basins
Mirrors · Heating · Lighting · Kitchen · Laundry · Bidets · Toilets · Tiles · Sinks
Shaving Cabinet · Smart Toilet · Saunas · Toilet Paper Holders · Robe Hooks
Laundry Cabinets · Toilets Johnson Suisse · Toilets Under $300
Riva Transparent Bathtubs · Spa Bathtubs · Shower Screens Wall-to-Wall
Shower Screens Covey Return Panel
```

### Margin Rules

`calcMargin(category, cp, rrp)` in `utils/pricing.js`.

| Category | Rule |
|---|---|
| Tapware / Accessories / Showers | +$35 — or **+$60 if CP ≥ $150** — capped at RRP |
| Basins | +$65 |
| Sinks | +$80 |
| Vanities / Cabinets / Laundry Cabinets | +$250 |
| Toilets | +$175 |
| Toilets Johnson Suisse | +$300 |
| Toilets Under $300 | **Hard min SP $300** |
| Bathtubs | +$300 |
| Spa Bathtubs | +$500 |
| Riva Transparent Bathtubs | +$700 |
| Shower Screens Wall-to-Wall | +$250 |
| Shower Screens Covey Return Panel | +$125 |
| Shaving Cabinet | +$150 |
| Tiles | +$35 |
| Saunas | +$300 |
| Heating / Lighting | +$100 |
| Toilet Paper Holders | **Hard min SP $30** |
| Robe Hooks | **Hard min SP $20** |

**Mechanics**

- `capAtRRP` (Tapware / Accessories / Showers only): if `SP > RRP`, SP is pulled back down to RRP.
- Hard-min categories: `SP = max(hardMin, cp + 1)` and the margin badge checks `SP >= hardMin`, not `SP - CP`.
- All other categories: `SP = round(cp + margin)` and the badge checks `SP - CP >= margin`.
- **No rule for the category → `SP = CP + 1`, required margin `0`, badge shows green.** Affects 6 categories, see [Known Issues](#known-issues--data-gaps).

### Weight Rules

`calcWeight(category, sp, brand)` in `utils/pricing.js`. Values as stored in `WEIGHT_RULES_FE`:

| Category | Value |
|---|---|
| Tapware / Accessories / Showers | `formula` |
| Mirrors / Basins / Sinks | 20 |
| Heating / Lighting / Vanities / Toilets / Tiles | 150 |
| Shower Screens / Bathtubs / Spa Bathtubs / Saunas | 900 |
| Any category not listed | 1 |

**Overrides and formula**

- **Brand override, evaluated first:** brand `TOTO` or `Lafeme` → always `1` ("TOTO/Lafeme = 1kg"), whatever the category.
- `formula` categories: `SP < $150` → `SP / 150` (3 dp); `SP ≥ $150` → `1`.
- The UI labels the result **kg**, and the CSV export writes `weight × 1000` into Variant Grams. The 20 / 150 / 900 entries are almost certainly intended as grams — flagged in [Known Issues](#known-issues--data-gaps).

### Pricing Modes & Formulas

Five modes, selectable in the Pricing Calculator:

| Mode | Key | How it works |
|---|---|---|
| **CP + Min Margin** | `margin` | Default — adds the category minimum margin to CP |
| **RRP × 0.85** | `rrp85` | SP = 15% off RRP |
| **RRP × 0.90** | `rrp90` | SP = 10% off RRP |
| **CP = RRP × ?** | `cpMultiplier` | Derives CP from an RRP multiplier (e.g. 0.65). CP input becomes read-only. SP uses the optional SP multiplier, else falls back to CP + min margin |
| **SP = RRP × ?** | `spMultiplier` | SP from a custom RRP multiplier (e.g. 0.85) |

Special Guidelines formulas (also shown in the Reprice tab):

| Formula | Calculation |
|---|---|
| Sale Price (15% off RRP) | RRP × 0.85 |
| Sale Price (10% off RRP) | RRP × 0.90 |
| RRP (when not provided) | Sale Price × 1.10 |
| Cost Price (inc GST) | Cost Price (ex GST) × 1.10 |
| Cost Price (alt) | RRP × 0.65 |
| Potential Margin | Competitor Price − CP (inc GST) |

**GST handling**

- CP and RRP each have an "Already includes GST" checkbox. Unchecked → the value is multiplied by 1.10 before use.
- RRP is rounded to a whole dollar; SP is rounded to a whole dollar; CP keeps 2 dp.
- **Override SP** beats every mode when filled in.
- Calculation re-runs automatically on any input change — there is no Calculate button.

### Title Formats

- **`PRODUCT_TITLE_FORMATS`** — 61 exact per-product-type formats. Used when a Product Type is selected; the panel shows an `EXACT FORMAT` badge.
- **`CATEGORY_TITLE_FORMATS`** — 19 category-level fallbacks, plus a `default` of `Brand > Collection > Product Type > Colour`.
- Each entry carries a `note` shown under the format bar (e.g. *"Consider Length"*, *"Always state unit: PER BOX / PER PACK / PER SLAB / PER TILE"*).
- `Brand`, `Collection`, `Colour` and `Size` parts auto-populate from Product Details and are marked `AUTO`.

**Product Attribute chips** (`PRODUCT_SPEC_TAGS`, 16) appended after the Product Specification:

```
Gooseneck · Lead Free · Watermark Approved · WELS Approved
Wall Mounted · Floor Mounted · Freestanding · Back to Wall
Rimless · Dual Flush · Single Lever · Double Handle
Thermostatic · Brushed · Matte · Polished
```

Custom attributes can be typed in and added ad-hoc.

### Tag Schemas

45 product types in `PRODUCT_TAG_MAP_FE`, each with a `collection` and a `schema`.

**Tag prefixes** (`TAG_FIELD_DEFS`)

| Field | Prefix | Colour in UI |
|---|---|---|
| brand | `Brand_` | blue |
| colour | `Colour_` | purple |
| style | `Style_` | green |
| configuration | `Configuration_` | orange |
| size | `Size_` (labelled "Size Range") | pink |
| shape | `Shape_` | sky |
| finish | `Finish_` | lime |
| — | `Collections_` | gold |

**Schemas** (`SCHEMAS_FE`)

| Schema | Fields |
|---|---|
| `styleOnly` | style |
| `brandColourOnly` | *(none — Brand_ + Colour_ only)* |
| `configOnly` | configuration |
| `configSize` | configuration, size |
| `configSizeStyle` | configuration, size, style |
| `sizeOnly` | size |
| `sizeStyle` | size, style |
| `shapeOnly` | shape |
| `tileSchema` | size, finish |

**Build order** (`buildTagsFromSchema`)

```
Collections_<collection>  →  schema fields  →  extraFields  →  Brand_<brand>  →  Colour_<colour>
```

- A product type can add `extraFields` on top of its schema (e.g. Heated Towel Rails adds `style`).
- Options per field come from `<field>Options` on the type (e.g. `configOptions: ["Single Bowl","Double Bowl"]`) and render as a dropdown; fields with no options render as free text.
- **`noBrand: true`** — all three tile types omit `Brand_` entirely. The panel shows a "Brand_ omitted (tiles)" warning.
- With no Product Type selected, the panel falls back to a loose tag list built from category / brand / colour / style.

**Metafields** emitted: `Brand`, `Colour`, `Size`, `Style`, `Collections` (the product type's collection, or the category as fallback).

### Description Fields

`DESCRIPTION_FEATURES` — feature fields per category (8 categories + `default`):

| Category | Fields |
|---|---|
| Accessories | colour, size, shape, material, type, wels, flowRate, welsReg, ipRating, voltage, additional |
| Tapware | colour, size, material, type, wels, flowRate, welsReg, additional |
| Basins | colour, size, material, mounting, compatible, additional |
| Vanities | colour, size, material, mounting, bowl, drawer, mechanism, handles, additional |
| Showers | colour, size, material, type, wels, flowRate, additional |
| Mirrors | colour, size, shape, type, ipRating, voltage, additional |
| Toilets | colour, size, type, flushing, waterRating, additional |
| Tiles | colour, size, finish, shape, coverage, additional |
| **default** | colour, size, material, type, additional |

Labels come from `FEATURE_LABELS` (e.g. `wels` → "WELS Rating", `coverage` → "Coverage (per box/pack)").

**Assembled description template**

```
**PRODUCT TITLE**
Also Available in <colours>
Also Available in Sizes: <sizes>          ← only when sizes are filled

**Product Features:**
• <Label>: <value>            ← one line per category feature field

**Warranty Information:**
• <warranty row 1>
• <warranty row 2>            ← rows are add/remove, defaults:
                                 "5 years Product Warranty", "2 years Labour Warranty"

<AI description>
```

**Auto vs Manual mode**

- **Auto** — shows the description returned by the URL scrape, editable, with a "Reset to original" button and a live word count. Selected automatically when a scrape returns a description.
- **Manual** — full feature fields + warranty editor + AI generation block.
- Gemini accepts up to 2 images (previews with remove buttons); Groq is text-only and says so.

---

## Setup & Run Locally

### Step 1 — Backend

```bash
cd austpek-tool/backend
npm install
cp .env.example .env
# Open .env and add your API keys (see Environment Variables below)
node server.js
# Backend running at http://localhost:5000
```

### Step 2 — Frontend

```bash
cd austpek-tool/frontend
npm install
npm start
# Frontend opens at http://localhost:3000
```

### Step 3 — MongoDB (optional)

The app works fully without MongoDB — products live in React state for the session and the queue export still works.
To persist products across sessions, add a connection string to the backend `.env`:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/austpek
```

Free MongoDB Atlas cluster: https://www.mongodb.com/atlas

---

## Environment Variables

### Backend — `backend/.env`

```env
# Gemini API — get free key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_key_here

# Groq API — get free key at https://console.groq.com/keys
GROQ_API_KEY=your_groq_key_here

# MongoDB (optional)
MONGODB_URI=mongodb://localhost:27017/austpek

# Port (default 5000)
PORT=5000
```

> ⚠ Never commit `.env` to GitHub. It is already in `.gitignore`.
> The app runs without AI keys — the AI description field just returns an error.

### Frontend — API base URL

All four files that call the API (`App.js`, `PricingPanel.jsx`, `DescriptionBuilder.jsx`, `RepriceCalculator.jsx`) resolve it the same way:

```js
const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";
```

> ⚠ **This line is currently broken and always falls through to the hardcoded Render URL.** `import.meta.env` is Vite's accessor, while `REACT_APP_` is the Create React App prefix — the two never combine. Fix it to match your bundler before relying on the env var:
> - **Create React App:** `process.env.REACT_APP_API_URL`
> - **Vite:** rename the variable to `VITE_API_URL` and use `import.meta.env.VITE_API_URL`
>
> Whichever you pick, change it in all four files.

### API Keys

| Key | Source | Cost | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | Free | 1,500 req/day · supports images |
| `GROQ_API_KEY` | https://console.groq.com/keys | Free | ~14,400 req/day · text only |

### AI Models

```
User selects model in the Description Builder
      ├── gemini  → Gemini 2.0 Flash (primary, free, image-aware)
      │             Fallback chain: gemini-2.0-flash → gemini-2.0-flash-lite → gemini-2.5-flash
      │             Auto-retries the next model on 429 rate limit
      └── groq    → Groq Llama 3.3 70B (text-only, very fast)
```

---

## API Endpoints

| Method | Endpoint | Used by | Description |
|---|---|---|---|
| GET | `/api/products` | `App.js` on mount | Load the saved product queue |
| POST | `/api/products` | `App.js` Save to Queue | Save a product |
| DELETE | `/api/products/:id` | `ProductList` | Delete a product |
| POST | `/api/description/generate` | `DescriptionBuilder` | Generate AI description — `multipart/form-data`, fields: `name`, `colours`, `material`, `compatibility`, `warranty`, `category`, `model`, `images[]` |
| POST | `/api/description/fetch-from-url` | `App.js` Auto-fill, `PricingPanel` | Scrape supplier page → all fields + RRP + description + confidence |
| POST | `/api/description/fetch-rrp` | `PricingPanel` | Fetch RRP from Supplier URL or SKU |
| POST | `/api/export/xlsx` | `ProductList` | Download Final Pricing + Competitor .xlsx |
| POST | `/api/export/shopify-csv` | `ProductList` | Download Shopify Import CSV |
| POST | `/api/export/reprice` | `RepriceCalculator` | Calculate competitive repricing |
| POST | `/api/description/template` | *(backend only — not called by this frontend)* | Build structured description block |
| GET | `/api/description/features/:category` | *(backend only — feature fields are local in `businessRule.js`)* | Feature fields for a category |
| GET | `/api/description/test-gemini` | *(diagnostic, open in browser)* | Check Gemini key + model availability |

### Shopify Import CSV — exact columns

```
Title
Variant SKU
Variant Grams
Variant Price
Variant Compare At Price
Supplier URL (product.metafields.custom.supplier_url)
Cost per item
```

Price, Compare At Price and Cost are written as whole dollars with `.00`; Grams is `weight × 1000`, rounded.

---

## Offline / Fallback Behaviour

The frontend degrades instead of failing when the backend is unreachable:

| Action | Fallback |
|---|---|
| Load queue on mount | Silently starts with an empty queue |
| Save to Queue | Saves to React state with a local `_id`; message reads "✓ Saved locally (DB offline)" |
| Delete product | Removed from local state regardless of the API result |
| Shopify Import CSV | Built client-side and downloaded as `Austpek_Shopify_Import.csv` |
| Final Pricing .xlsx | **No fallback** — alerts "Export failed — make sure backend is running" |
| Reprice calculation | Recalculated locally with the same margin logic |
| Fetch RRP / Auto-fill | Shows an inline error and asks for manual entry |

> Locally-saved products live in browser memory only. **Export before closing the tab.**

---

## Workflow

1. Open the tool on **Add Product**.
2. *(Optional)* Paste a supplier URL → **Auto-fill All Fields from URL**. Review the Extracted Data Preview and its confidence rating; low confidence means verify everything by hand.
3. Enter **SKU** *(required)*.
4. Select **Category** *(required)* → title format, description fields and tag panel unlock.
5. Select **Product Type** → locks the exact title part sequence and Shopify tag schema.
6. Fill **Brand, Collection, Colour, Size** → they sync to Title Builder, Tags and Description with `AUTO` badges.
7. Title tab: fill any remaining parts, add a Product Specification and attribute chips → title builds live in UPPERCASE.
8. Pricing tab: pick a pricing mode, enter CP (tick "Already includes GST" if it does), enter or **Fetch RRP** → SP, weight and the margin badge update automatically. Green ✓ = margin OK, red ✗ = below minimum.
9. Description tab: in **Auto** mode review the scraped copy; in **Manual** mode fill feature fields and warranty rows, then **Generate with Gemini** (optionally 1–2 images) or **Generate with Groq**. Edit the output as needed.
10. Tags tab: fill schema fields → copy the generated tag string.
11. **Save to Queue**, then **Reset** and repeat for the batch.
12. Go to the **Queue** tab and check every row shows a green Margin badge.
13. **Shopify Import CSV** → the Shopify-ready file.
14. **Final Pricing + Competitor (.xlsx)** → the pricing review sheet.
15. Send both files to the developer for Shopify upload.

---

## Deployment

| Service | URL |
|---|---|
| Frontend (Vercel) | https://product-listing-tool.vercel.app |
| Backend (Render) | https://austpek-backend.onrender.com |

### Frontend — Vercel

Set the API base URL in Vercel → Settings → Environment Variables, using the name that matches the fix you applied in [Environment Variables](#environment-variables):

```
REACT_APP_API_URL = https://austpek-backend.onrender.com/api     # Create React App
VITE_API_URL      = https://austpek-backend.onrender.com/api     # Vite
```

Until that line is fixed, the hardcoded Render URL is used and this variable has no effect.

### Backend — Render

- Region: **Oregon, USA** (required — Singapore blocks the Gemini free tier)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node server.js`
- Add `GEMINI_API_KEY` and `GROQ_API_KEY` under Render → Environment

> ⚠ Render's free tier spins down after 15 minutes idle. The first request after that takes ~30 seconds.

---

## Known Issues & Data Gaps

Found by cross-checking the lookup tables in `businessRule.js`. None of these break the build — they cause silent wrong output, so they matter for listing accuracy.

### 1. 16 title formats are unreachable from the UI

The Product Type dropdown is `ALL_PRODUCT_TYPES_FLAT`, derived from `PRODUCT_TAG_MAP_FE` keys. These have a title format but no tag-map entry, so they can never be selected:

```
Wall Mixer · Bath Spouts / Outlets · Channel Grates · Point Drains · Basin Wastes
Mirrored Shaving Cabinets · LED Mirrored Shaving Cabinets · Freestanding Basins
Heated Towel Rails (Heating) · Hand Dryers · Back to Wall Toilets
Close Coupled Toilets · Wall Faced Toilets · Rimless Toilets
In-Wall Cisterns · Integrated Smart Toilets
```

**Fix:** add a `PRODUCT_TAG_MAP_FE` entry for each (collection + schema).

### 2. Six categories have no margin rule

`Shower Screens`, `Mirrors`, `Kitchen`, `Laundry`, `Bidets`, `Smart Toilet` fall into the `calcMargin` default: **SP = CP + $1, required margin $0, and the badge still shows green "Margin OK."** A lister can ship a $1-margin product with no warning.

**Fix:** add rules, or change the default branch to flag unmapped categories instead of passing them.

### 3. `Cabinets` has a margin rule but is not a selectable category

`MARGIN_RULES_FE["Cabinets"]` (+$250) is dead code — `Cabinets` is not in `ALL_CATEGORIES`. Either add it or drop the rule.

### 4. Weight units are inconsistent

`WEIGHT_RULES_FE` stores 20 / 150 / 900 for lookup categories, but the `formula` branch and the TOTO/Lafeme override return ~1. The UI labels all of them **kg** and the CSV multiplies by 1000 for grams — so a vanity exports as **150,000 g (150 kg)**. The lookup values look like grams stored in a kg field.

**Fix:** decide the unit, then normalise the table and the CSV conversion together.

### 5. 13 categories have no weight rule

They fall back to `1`. Includes `Shower Screens Wall-to-Wall`, `Shower Screens Covey Return Panel`, `Riva Transparent Bathtubs`, `Laundry Cabinets`, `Toilets Johnson Suisse`, `Toilets Under $300`, `Shaving Cabinet`, `Kitchen`, `Laundry`, `Bidets`, `Smart Toilet`, `Toilet Paper Holders`, `Robe Hooks` — several of which are heavy items.

### 6. 10 categories have no category-level title format

`Saunas`, `Toilet Paper Holders`, `Robe Hooks`, `Laundry Cabinets`, `Toilets Johnson Suisse`, `Toilets Under $300`, `Riva Transparent Bathtubs`, `Spa Bathtubs`, `Shower Screens Wall-to-Wall`, `Shower Screens Covey Return Panel` fall back to the generic `default` format (`Brand > Collection > Product Type > Colour`). Fine if a Product Type is selected; wrong if not.

### 7. `import.meta.env` + `REACT_APP_` mismatch

See [Environment Variables](#environment-variables). The env var never resolves; the hardcoded Render URL is always used, in all four API-calling files.

### 8. Minor

- **`Size_` label mismatch** — `TAG_FIELD_DEFS.size.label` is "Size Range" while the tag prefix is `Size_`; the tag panel shows "Size Range" as the field label.
- **`Toilets Under $300`** is modelled as a category rather than a price condition on `Toilets`, so the lister has to pick the right one manually.
- **`.xlsx` export has no offline fallback**, unlike the CSV.

---

## Troubleshooting

| Error / symptom | Fix |
|---|---|
| `Gemini rate limit reached` | Switch to Groq, or wait for the midnight PT quota reset (1,500 req/day free) |
| `User location is not supported` | Render region is Singapore — delete the service and recreate it in Oregon, USA |
| `GEMINI_API_KEY not set` | Add the key to `.env` (local) or Render → Environment (production) |
| `Generation failed — check API key` | Key is invalid — verify at aistudio.google.com/app/apikey |
| `500 Internal Server Error` | Check the Node terminal for the exact error |
| `DB offline — saved locally` | MongoDB not running — products are in browser memory only, **export before closing** |
| `Margin Too Low` badge | SP is below the category minimum — raise SP or check CP was entered correctly (and its GST checkbox) |
| Margin badge green but margin looks tiny | The category probably has no margin rule — see [Known Issues #2](#2-six-categories-have-no-margin-rule) |
| Title Builder / Tags / Description not rendering | Select a Category first — those panels are gated on it |
| Title format looks generic | No Product Type selected, or the type has no `PRODUCT_TITLE_FORMATS` entry — the `EXACT FORMAT` badge tells you which |
| Product Type missing from the dropdown | It has no `PRODUCT_TAG_MAP_FE` entry — see [Known Issues #1](#1-16-title-formats-are-unreachable-from-the-ui) |
| `Brand_` tag missing on tiles | Expected — all tile types set `noBrand: true` |
| Tags panel shows only a loose list | No Product Type selected, so no schema is loaded |
| Auto-fill low confidence | The page could not be fully scraped — verify every field before saving |
| `Fetch RRP` disabled | Enter a Supplier URL or SKU first |
| RRP fetch says "estimated — verify" | Value was inferred, not read from the page — confirm against the supplier catalogue |
| Env var change had no effect | See [Known Issues #7](#7-importmetaenv--react_app_-mismatch) |
| Mobile layout not updating | Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) |
| Weight looks 1000× off in the CSV | See [Known Issues #4](#4-weight-units-are-inconsistent) |

**Diagnose Gemini directly:**

```
https://austpek-backend.onrender.com/api/description/test-gemini
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (`createRoot` + `StrictMode`), Axios |
| Styling | Inline styles only — no CSS framework. Accent `#c9933a` on a `#0a0a0a` dark base |
| Icons | Font Awesome (loaded via the host page, `fa-solid` / `fa-regular` classes) |
| Responsive | Custom `useResponsive()` hook — no external library |
| State | React `useState` in `App.js`, props down to panels. No Redux / Context |
| Backend | Node.js, Express, Multer (image upload) |
| Database | MongoDB + Mongoose (optional) |
| AI — images | Google Gemini 2.0 Flash |
| AI — text | Groq Llama 3.3 70B |
| Export | ExcelJS (.xlsx), native CSV (+ client-side CSV fallback) |
| Hosting — frontend | Vercel |
| Hosting — backend | Render |
| Version control | GitHub |

> ⚠ **Bundler is ambiguous.** The code uses `import.meta.env` (Vite) with `REACT_APP_` variable names (Create React App), and the panels are `.jsx` while `App.js` and `index.js` are `.js`. Confirm which bundler the project actually runs on and make the env access and file extensions consistent.
---
---