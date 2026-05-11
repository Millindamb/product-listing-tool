# Austpek Product Listing Tool — MERN Stack

An internal web app that automates the Austpek Bathrooms product listing
workflow. Team members fill in raw product data, the tool handles all
calculations and formatting, then exports a ready-to-upload Google Sheet
for the developer.

---

## What It Does

| Feature | Detail |
|---|---|
| **Title Builder** | Auto-formats titles per collection rules (Tapware, Basins, Vanities etc.) |
| **Pricing Calculator** | Adds GST, validates SP against minimum margin rules, flags violations |
| **Weight Calculator** | Auto-calculates weight per category (SP/150 formula, fixed weights) |
| **Description Builder** | Structures full description block with features + warranty |
| **AI Description** | Generates 75-word product copy via Gemini / Claude / GPT |
| **Tags & Metafields** | Shows correct tag format and metafield values for Shopify |
| **Product Queue** | Saves multiple products, review before export |
| **Export** | Downloads a .xlsx Google Sheet ready to send to the developer |

---

## Project Structure

```
austpek-tool/
├── backend/
│   ├── server.js              # Express entry point
│   ├── .env.example           # Copy to .env and add API keys
│   ├── data/
│   │   └── rules.js           # ALL business rules (pricing, weight, titles)
│   ├── models/
│   │   └── Product.js         # MongoDB product schema
│   └── routes/
│       ├── product.js         # CRUD + /calculate endpoint
│       ├── description.js     # AI generation (Gemini / Claude / GPT)
│       └── export.js          # XLSX export
└── frontend/
    ├── public/index.html
    └── src/
        ├── index.js
        └── App.js             # Complete React app (all components)
```

---

## Setup & Run

### Step 1 — Backend

```bash
cd austpek-tool/backend
npm install
cp .env.example .env
# Edit .env — add your API keys (see below)
node server.js
# Running on http://localhost:5000
```

### Step 2 — Frontend

```bash
cd austpek-tool/frontend
npm install
npm start
# Opens http://localhost:3000
```

### Step 3 — MongoDB (optional)

The app works without MongoDB — products are stored in React state.
To persist data across sessions, install MongoDB locally or use MongoDB Atlas
free tier and add the connection string to `.env`:

```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/austpek
```

---

## API Keys

Copy `.env.example` to `.env` and fill in:

```
GEMINI_API_KEY=        # Google AI Studio (free) — gemini-1.5-flash
OPENROUTER_API_KEY=    # openrouter.ai — for Claude and GPT
```

**Getting keys:**
- Gemini (free): https://aistudio.google.com/app/apikey
- OpenRouter: https://openrouter.ai/keys (pay-per-use, very cheap)

The app works without any AI keys — AI description field just stays empty.

---

## AI Model Selection Logic

```
User selects model in UI
      ├── gemini  → Google Gemini 1.5 Flash (default, free tier)
      ├── claude  → Claude 3 Haiku via OpenRouter
      └── gpt     → GPT-3.5 Turbo via OpenRouter
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/products | List all saved products |
| POST | /api/products | Save a product |
| POST | /api/products/calculate | Calculate pricing + weight |
| GET | /api/products/meta | Get category/brand/style lists |
| POST | /api/description/generate | Generate AI description |
| POST | /api/description/template | Build description block |
| POST | /api/export/xlsx | Download Google Sheet export |
| GET | /api/health | Health check |

---

## Workflow (How Team Uses It)

1. Open http://localhost:3000
2. Select **Category** → Title format appears automatically
3. Fill in Brand, Collection, Colour, Size → Title builds live
4. Enter CP from supplier → SP auto-calculates with green/red margin indicator
5. Fill in description features → structured description block ready to copy
6. Click **Generate AI Description** → 75-word paragraph generated
7. Click **Save to Queue**
8. Repeat for all products
9. Go to **Queue tab** → click **Export Google Sheet**
10. Send the .xlsx file to the developer → developer uploads to Shopify
