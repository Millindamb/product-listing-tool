# AUSTPEK — Product Listing Tool

> Internal tool for the Austpek Bathrooms product listing team.  
> Automates pricing, title formatting, AI descriptions, tags, competitive repricing and Shopify export.

---

## What's New in v2

| Feature | v1 | v2 |
|---|---|---|
| AI Models | Gemini only | Gemini 2.0 Flash + Groq Llama 3.3 70B |
| Image Upload | ✗ | ✅ Up to 2 images (Gemini only) |
| Export | Single .xlsx | Shopify Import CSV + Final Pricing .xlsx |
| Reprice Tool | ✗ | ✅ Competitive Repricing Calculator (new tab) |
| Pricing Formulas | ✗ | ✅ Special Guidelines reference panel |
| Queue View | Basic cards | CP / SP / RRP / Weight per product |

---

## What It Does

| Feature | Detail |
|---|---|
| **Title Builder** | Auto-formats titles per category rules (Tapware, Basins, Vanities, Tiles etc.) |
| **Pricing Calculator** | Adds GST, validates SP against minimum margin rules, flags violations, calculates weight |
| **Description Builder** | Structures full description block with category-specific features + warranty |
| **AI Description** | Generates 75-word product copy via Gemini 2.0 Flash (with images) or Groq Llama 3.3 70B (text-only) |
| **Tags & Metafields** | Auto-generates Shopify tags and metafield values from product data |
| **Reprice Tool** | Competitive repricing calculator — checks if competitor prices can be matched while maintaining minimum margin |
| **Product Queue** | Save multiple products, review pricing + margin status before export |
| **Shopify Import CSV** | Exports exact 7-column format (Title, SKU, Grams, Price, Compare At Price, Supplier URL, Cost) ready to import into Shopify |
| **Final Pricing .xlsx** | 3-sheet Excel file: Final Pricing + Competitor Analysis + Pricing Reference |

---

## Project Structure

```
austpek-tool/
├── backend/
│   ├── server.js                  # Express entry point
│   ├── .env                       # Your API keys (never commit this)
│   ├── .env.example               # Safe template — copy to .env
│   ├── data/
│   │   └── rules.js               # All business rules (pricing, weight, titles, prompts)
│   ├── models/
│   │   └── Product.js             # MongoDB product schema
│   └── routes/
│       ├── product.js             # CRUD endpoints
│       ├── description.js         # AI generation (Gemini + Groq)
│       └── export.js              # Shopify CSV + .xlsx export + reprice endpoint
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        └── App.js                 # Complete React app (all components)
```

---

## Setup & Run Locally

### Step 1 — Backend

```bash
cd austpek-tool/backend
npm install
cp .env.example .env
# Open .env and add your API keys (see API Keys section below)
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

The app works fully without MongoDB — products are stored in React state during the session.
To persist products across sessions, add a MongoDB connection string to `.env`:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/austpek
```

Free MongoDB Atlas cluster: https://www.mongodb.com/atlas

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

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

> ⚠ Never commit `.env` to GitHub. It is in `.gitignore` already.  
> The app works without any AI keys — the AI description field will just return an error.

---

## API Keys

| Key | Source | Cost | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | Free | 1,500 req/day · Supports images |
| `GROQ_API_KEY` | https://console.groq.com/keys | Free | ~14,400 req/day · Text only |

---

## AI Models

```
User selects model in UI
      ├── gemini  → Gemini 2.0 Flash (primary, free, image-aware)
      │             Fallback chain: gemini-2.0-flash → gemini-2.0-flash-lite → gemini-2.5-flash
      │             Auto-retries next model on 429 rate limit
      └── groq    → Groq Llama 3.3 70B (text-only, very fast)
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all saved products |
| POST | `/api/products` | Save a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/api/description/generate` | Generate AI description (Gemini or Groq) |
| POST | `/api/description/template` | Build structured description block |
| GET | `/api/description/features/:category` | Get feature fields for a category |
| GET | `/api/description/test-gemini` | Diagnose Gemini API key + model availability |
| POST | `/api/export/xlsx` | Download Final Pricing + Competitor .xlsx |
| POST | `/api/export/shopify-csv` | Download Shopify Import CSV |
| POST | `/api/export/reprice` | Calculate competitive repricing |

---

## Margin Rules Reference

| Category | Rule |
|---|---|
| Tapware / Accessories / Showers | +$35 (or +$60 if CP ≥ $150), capped at RRP |
| Basins | +$65 |
| Sinks | +$80 |
| Vanities / Cabinets / Laundry Cabinets | +$250 |
| Toilets | +$175 |
| Toilets Johnson Suisse | +$300 |
| Bathtubs | +$300 |
| Spa Bathtubs | +$500 |
| Riva Transparent Bathtubs | +$700 |
| Shower Screens Wall-to-Wall | +$250 |
| Shower Screens Covey Return Panel | +$125 |
| Shaving Cabinet | +$150 |
| Tiles | +$35 |
| Saunas | +$300 |
| Heating / Lighting | +$100 |
| Toilet Paper Holders | Hard min $30 |
| Robe Hooks | Hard min $20 |

---

## Pricing Formulas (Special Guidelines)

| Formula | Calculation |
|---|---|
| Sale Price (15% off RRP) | RRP × 0.85 |
| Sale Price (10% off RRP) | RRP × 0.90 |
| RRP (when not provided) | Sale Price × 1.10 |
| Cost Price (inc GST) | Cost Price (ex GST) × 1.10 |
| Cost Price (alt) | RRP × 0.65 |
| Potential Margin | Competitor Price − CP (inc GST) |

---

## Workflow

1. Open the tool and go to **➕ Add Product**
2. Select **Category** → Title format and description fields appear automatically
3. Fill in Brand, Collection, Colour, Size → title builds live in UPPERCASE
4. Enter CP from supplier → SP auto-calculates with green ✓ / red ✗ margin indicator
5. Fill in description feature fields + warranty years
6. Click **Generate with Gemini** (optionally upload 1–2 product images) or **Generate with Groq**
7. Edit the AI description if needed
8. Click **💾 Save to Queue**
9. Repeat for all products in the batch
10. Go to **📋 Queue** tab
11. Click **⬇ Shopify Import CSV** to download the Shopify-ready file
12. Click **⬇ Final Pricing + Competitor (.xlsx)** for the pricing review sheet
13. Send files to the developer for Shopify upload

---

## Deployment

| Service | URL |
|---|---|
| Frontend (Vercel) | https://your-vercel-url.vercel.app |
| Backend (Render) | https://austpek-backend.onrender.com |

### Frontend — Vercel

Set this environment variable in Vercel dashboard → Settings → Environment Variables:

```
REACT_APP_API_URL = https://austpek-backend.onrender.com/api
```

Then in `frontend/src/App.js`:
```js
const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
```

### Backend — Render

- Region: **Oregon, USA** (required — Singapore blocks Gemini free tier)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node server.js`
- Add `GEMINI_API_KEY` and `GROQ_API_KEY` in Render → Environment

> ⚠ Render free tier spins down after 15 min of inactivity. First request after idle takes ~30 seconds to wake up.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Gemini rate limit reached` | Switch to Groq or wait until midnight PT for quota reset (1,500 req/day free) |
| `User location is not supported` | Render region is set to Singapore — delete service and recreate in Oregon, USA |
| `GEMINI_API_KEY not set` | Add key to `.env` (local) or Render environment variables (production) |
| `Generation failed — check API key` | Key is invalid — verify at aistudio.google.com/app/apikey |
| `500 Internal Server Error` | Check Node.js terminal for exact error message |
| `DB offline — saved locally` | MongoDB not running — products in browser memory only, export before closing |
| `Margin Too Low` badge | SP does not meet minimum margin — increase SP or verify CP is correct |
| Title not showing | Select a Category first — Title Builder only renders after category is chosen |

**Diagnose Gemini directly:**
```
https://austpek-backend.onrender.com/api/description/test-gemini
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Create React App, Axios |
| Backend | Node.js, Express, Multer |
| Database | MongoDB + Mongoose (optional) |
| AI — Images | Google Gemini 2.0 Flash API |
| AI — Text | Groq Llama 3.3 70B API |
| Export | ExcelJS (.xlsx), native CSV |
| Hosting — Frontend | Vercel |
| Hosting — Backend | Render |
| Version Control | GitHub |
