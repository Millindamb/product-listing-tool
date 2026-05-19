// ─── AUSTPEK BUSINESS RULES ───────────────────────────────────────────────────
// Derived from: Adding_Product_to_shopify.pdf + COLLECTIONS_AND_TAGS xlsx

// ── 1. TITLE FORMAT per category ──────────────────────────────────────────────
const TITLE_FORMATS = {
  Tapware:          "Brand > Collection > Product Type > Size (if applicable) > Colour",
  Accessories:      "Brand > Collection > Product Type > Size (if applicable) > Colour",
  Showers:          "Brand > Collection > Product Type > Size (if applicable) > Colour",
  "Shower Screens": "Brand > Collection > Framing > Type of Shower Screen > Colour > Size (if applicable)",
  Bathtubs:         "Brand > Collection > Type of Bath > Colour > Size",
  Vanities:         "Brand > Collection > Colour > Size > Bowl Configuration > Vanity Type",
  "Shaving Cabinet":"Brand > Collection > Colour > Cabinet Type > Size",
  Basins:           "Brand > Collection > Basin Type > Colour > Size",
  Sinks:            "Brand > Collection > Sink Type > Colour > Size",
  Mirrors:          "Brand > Collection > Shape > Mirror Type > Colour > Size",
  Heating:          "Brand > Collection > Type of Heating > Colour > Size (if applicable)",
  "Hand Dryer":     "Brand > Collection > Type > Colour > Size (full dimension)",
  Lighting:         "Brand > Collection > Type of Lighting > Colour > Size (if applicable)",
  Bidets:           "Brand > Collection > Bidet Type (or Washlet) > w/ Control Type > Washlet Shape (if applicable) > Colour",
  Toilets:          "Brand > Collection > Type > Colour",
  "Smart Toilet":   "Brand > Collection > Toilet Type and Bidet Type (or Washlet) > w/ Control Type > Washlet Shape (if applicable) > Colour",
  Tiles:            "Brand > Collection > Colour > Finish > Size > Shape Tile (PER BOX)",
  Kitchen:          "Brand > Collection > Product Type > Colour > Size",
  Laundry:          "Brand > Collection > Product Type > Colour > Size",
};

// ── 2. MINIMUM MARGIN RULES ───────────────────────────────────────────────────
// Returns { margin, note, hardMinPrice }
const MARGIN_RULES = [
  { match: (cat, sp, cp) => ["Tapware","Accessories","Showers"].includes(cat) && cp < 150,margin: 35, note: "If CP+$35 > $150, use $60 margin instead",capAtRRP: true },
  { match: (cat, sp, cp) => ["Tapware","Accessories","Showers"].includes(cat) && cp >= 150,margin: 60, note: "CP is over $150", capAtRRP: true },
  { match: (cat, sp)     => cat === "Accessories" && sp > 1500,margin: 175, capAtRRP: false },
  { match: (cat, sp)     => cat === "Accessories" && sp > 800,margin: 150, capAtRRP: false },
  { match: (cat)         => cat === "Toilet Paper Holders",  hardMinPrice: 30, capAtRRP: false },
  { match: (cat)         => cat === "Robe Hooks",            hardMinPrice: 20, capAtRRP: false },
  { match: (cat)         => ["Heating","Lighting"].includes(cat), margin: 100, capAtRRP: false, note: "Fine to exceed RRP" },
  { match: (cat)         => cat === "Shower Screens Wall-to-Wall", margin: 250, capAtRRP: false },
  { match: (cat)         => cat === "Shower Screens Covey Return Panel", margin: 125, capAtRRP: false },
  { match: (cat)         => cat === "Bathtubs", margin: 300, capAtRRP: false },
  { match: (cat)         => cat === "Riva Transparent Bathtubs", margin: 700, capAtRRP: false },
  { match: (cat)         => cat === "Spa Bathtubs", margin: 500, capAtRRP: false },
  { match: (cat)         => ["Vanities","Cabinets","Laundry Cabinets"].includes(cat), margin: 250, capAtRRP: false },
  { match: (cat)         => cat === "Basins", margin: 65, capAtRRP: false },
  { match: (cat)         => cat === "Sinks",  margin: 80, capAtRRP: false },
  { match: (cat)         => cat === "Toilets", margin: 175, capAtRRP: false },
  { match: (cat)         => cat === "Toilets Johnson Suisse", margin: 300, capAtRRP: false },
  { match: (cat)         => cat === "Toilets Under $300", hardMinPrice: 300, capAtRRP: false },
  { match: (cat)         => cat === "Shaving Cabinet", margin: 150, capAtRRP: false },
  { match: (cat)         => cat === "Tiles",  margin: 35, capAtRRP: false },
  { match: (cat)         => cat === "Saunas", margin: 300, capAtRRP: false },
];

function getMarginRule(category, sp = 0, cp = 0) {
  return MARGIN_RULES.find(r => r.match(category, sp, cp)) || { margin: 0 };
}

// ── 3. WEIGHT RULES ───────────────────────────────────────────────────────────
function calculateWeight(category, sp, brand) {
  if (["TOTO","Lafeme"].includes(brand)) return { weight: 1, unit: "kg", note: "TOTO/Lafeme brand = 1kg" };
  if (["Tapware","Accessories","Showers"].includes(category)) {
    if (sp < 150) return { weight: +(sp / 150).toFixed(3), unit: "kg", note: `SP/150 = ${sp}/150` };
    return { weight: 1, unit: "kg", note: "SP over $150 → 1kg" };
  }
  if (["Heating","Lighting"].includes(category)) return { weight: 150, unit: "kg" };
  if (["Shower Screens","Bath Screens","Bathtubs"].includes(category)) return { weight: 900, unit: "kg" };
  if (["Vanities","Toilets","Mirror Cabinet","Laundry"].includes(category)) return { weight: 150, unit: "kg" };
  if (["Basins","Sinks","Mirrors"].includes(category)) return { weight: 20, unit: "kg" };
  if (category === "Tiles") return { weight: 150, unit: "kg" };
  if (category === "Saunas") return { weight: 900, unit: "kg" };
  return { weight: 1, unit: "kg", note: "Default" };
}

// ── 4. PRICING CALCULATIONS ───────────────────────────────────────────────────
function addGST(price) { return +(price * 1.1).toFixed(2); }

function calculateSP(cp, rrp, category, brand) {
  const rule = getMarginRule(category, 0, cp);
  let sp;
  if (rule.hardMinPrice) {
    sp = Math.max(rule.hardMinPrice, cp + 1);
  } else {
    sp = cp + (rule.margin || 0);
    // Check if CP+margin pushes above $150 threshold for small categories
    if (["Tapware","Accessories","Showers"].includes(category) && cp < 150 && sp > 150) {
      sp = cp + 60; // upgrade to $60 margin rule
    }
    // Cap at RRP for small categories
    if (rule.capAtRRP && rrp && sp > rrp) sp = rrp;
  }
  return Math.round(sp);
}

function calculateRRP(sp) { return Math.round(sp * 1.1); }

// ── 5. COLLECTIONS & TAGS per category ───────────────────────────────────────
// Derived from the Excel sheet
const CATEGORY_META = {
  "Basin Mixer": {
    collections: ["Tapware", "Basin Mixers"],
    tagTemplate: ["Collections_Basin Mixers","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Tall Basin Mixer": {
    collections: ["Tapware", "Tall Basin Mixers"],
    tagTemplate: ["Collections_Tall Basin Mixers","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Sink Mixer": {
    collections: ["Tapware", "Kitchen", "Sink Mixers"],
    tagTemplate: ["Collections_Sink Mixers","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Shower Heads": {
    collections: ["Showers", "Rain Shower Heads & Arms", "Shower Heads"],
    tagTemplate: ["Collections_Shower Heads","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Heated Towel Rails": {
    collections: ["Accessories", "Bathroom Heating", "Towel Rails", "Heated Towel Rails"],
    tagTemplate: ["Collections_Heated Towel Rails","Configuration_<config>","Size_<size>","Brand_<brand>","Colour_<colour>"],
  },
  "Non-Heated Towel Rails": {
    collections: ["Accessories", "Towel Rails", "Non-Heated Towel Rails"],
    tagTemplate: ["Collections_Non-heated Towel Rails","Configuration_<config>","Size_<size>","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Robe Hooks": {
    collections: ["Accessories", "Robe Hooks"],
    tagTemplate: ["Collections_Robe Hooks","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Basin Wastes": {
    collections: ["Accessories","Wastes/Bottle Traps","Grates/Wastes/Bottle Traps"],
    tagTemplate: ["Collections_Wastes","Collections_Basin Wastes","Style_Contemporary","Brand_<brand>","Colour_<colour>"],
  },
  "Channel Grates": {
    collections: ["Accessories","Floor Grates","Grates/Wastes/Bottle Traps"],
    tagTemplate: ["Collections_Channel Grates","Size_<size>","Style_Contemporary","Brand_<brand>","Colour_<colour>"],
  },
  "Above Counter Basins": {
    collections: ["Basins","Above Counter Basins"],
    tagTemplate: ["Collections_Above Counter Basins","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Under Counter Basins": {
    collections: ["Basins","Under Counter Basins"],
    tagTemplate: ["Collections_Under Counter Basins","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Wall Hung Basins": {
    collections: ["Basins","Wall Hung Basins"],
    tagTemplate: ["Collections_Wall Hung Basins","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Freestanding Basins": {
    collections: ["Basins","Freestanding Basins"],
    tagTemplate: ["Collections_Freestanding Basins","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Wall Hung Vanities": {
    collections: ["Vanities","Wall Hung Vanities"],
    tagTemplate: ["Collections_Wall Hung Vanities","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Floor Standing Vanities": {
    collections: ["Vanities","Floor Standing Vanities"],
    tagTemplate: ["Collections_Floor Standing Vanities","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "LED Mirrors": {
    collections: ["Mirrors","LED Mirrors"],
    tagTemplate: ["Collections_LED Mirrors","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Non-LED Mirrors": {
    collections: ["Mirrors","Non-LED Mirrors"],
    tagTemplate: ["Collections_Non-LED Mirrors","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
  "Toilets Back to Wall": {
    collections: ["Toilets","Back to Wall Toilets"],
    tagTemplate: ["Collections_Back to Wall Toilets","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Toilets Wall Faced": {
    collections: ["Toilets","Wall Faced Toilets"],
    tagTemplate: ["Collections_Wall Faced Toilets","Style_<style>","Brand_<brand>","Colour_<colour>"],
  },
  "Rectangle Tiles": {
    collections: ["Tiles","Rectangle Tiles"],
    tagTemplate: ["Collections_Rectangle Tiles","Style_<style>","Brand_<brand>","Colour_<colour>","Size_<size>"],
  },
};

// ── 6. COLOUR TAG MAPPING ─────────────────────────────────────────────────────
const COLOUR_TAG_MAP = {
  Gold:        ["Gold","Brushed Gold","Brass","Brushed Brass","Matte Brass","Antique Brass","Aged Gold"],
  Nickel:      ["Brushed Nickel","Satin Nickel"],
  Silver:      ["Silver","Stainless Steel","Brushed Stainless"],
  Black:       ["Black","Matte Black","Gloss Black","Black Onyx"],
  White:       ["White","Matte White","Gloss White","White Onyx","White Travertine"],
  Chrome:      ["Chrome"],
  "Rose Gold": ["Rose Gold","Copper"],
  Oak:         ["Natural Oak","White Oak","Brown Oak"],
  "Gun Metal": ["Gun Metal","Gunmetal"],
};

function resolveColourTag(colourInput) {
  const c = colourInput?.toLowerCase() || "";
  for (const [tag, variants] of Object.entries(COLOUR_TAG_MAP)) {
    if (variants.some(v => c.includes(v.toLowerCase()))) return tag;
  }
  return colourInput; // keep as-is if no mapping found
}

// ── 7. DESCRIPTION TEMPLATE per category ─────────────────────────────────────
const DESCRIPTION_FEATURES = {
  Accessories: ["Colour","Size","Shape (if available)","Material (if available)","Type (type of product)","WELS Rating (if applicable)","Flow Rate (if applicable)","WELS Reg. No. (if available)","IP Rating (if any)","Voltage (if any)","Additional Information"],
  Tapware:     ["Colour","Size","Material","Type","WELS Rating","Flow Rate","WELS Reg. No.","Additional Information"],
  Basins:      ["Colour","Size","Material","Mounting","Compatible with (above/under-mount)","Additional Information"],
  Vanities:    ["Colour","Size","Material","Mounting (Floor Standing or Wall Hung)","Bowl Option (Single or Double)","Drawer/Door","Mechanism (if available)","Handles (if available)","Additional Information","Waste Hyperlink","Top Option Hyperlink"],
  Showers:     ["Colour","Size","Material","Type","WELS Rating","Flow Rate","Additional Information"],
  Mirrors:     ["Colour","Size","Shape","Type (LED or Non-LED)","IP Rating (if any)","Voltage (if any)","Additional Information"],
  Toilets:     ["Colour","Size","Type","Flushing System","Water Rating","Additional Information"],
  Tiles:       ["Colour","Size","Finish","Shape","Coverage (per box/pack)","Additional Information"],
  default:     ["Colour","Size","Material","Type","Additional Information"],
};

function getDescriptionFeatures(category) {
  return DESCRIPTION_FEATURES[category] || DESCRIPTION_FEATURES.default;
}

// ── 8. AI DESCRIPTION PROMPT BUILDER ─────────────────────────────────────────
function buildAIPrompt({ name, colours, material, compatibility, warranty, category }) {
  return `Write a 75-word bathroom specific industry description using the below words. Be professional, customer-friendly, highlight design, durability, and usability. Match a premium bathroom store tone. Do not copy supplier text.\nName: ${name}\nColours Available: ${colours}\nMaterial: ${material || "N/A"}\nCompatible with: ${compatibility || "N/A"}\nWarranty: ${warranty} years\nCategory: ${category}`;
}

// ── 9. CATEGORY LIST (for dropdowns) ─────────────────────────────────────────
const ALL_CATEGORIES = [
  "Tapware","Accessories","Showers","Shower Screens","Bathtubs","Vanities",
  "Basins","Mirrors","Heating","Lighting","Kitchen","Laundry","Bidets","Toilets","Tiles",
  "Sinks","Shaving Cabinet","Hand Dryer","Smart Toilet","Saunas",
  "Toilet Paper Holders","Robe Hooks","Laundry Cabinets",
  "Toilets Johnson Suisse","Toilets Under $300","Riva Transparent Bathtubs","Spa Bathtubs",
  "Shower Screens Wall-to-Wall","Shower Screens Covey Return Panel",
];

const PRODUCT_TYPES = {
  Tapware:     ["Basin Mixer","Tall Basin Mixer","Sink Mixer","Pull-Out Sink Mixer","Free Standing Bath Mixer","Bath Spouts / Outlets","Wall Mixer","Wall Mixer with Diverter","Wall Top Assembly","Three Piece Set","Wall Basin / Bath Mixer"],
  Accessories: ["Heated Towel Rails","Non-Heated Towel Rails","Robe Hooks","Toilet Accessories","Soap Dish Holders","Shelves","Basin Wastes","Bathtub Wastes","Basket Wastes","Bottle Traps","Channel Grates","Point Drains","Tile Inserts","Hand Dryers"],
  Showers:     ["Shower on Rails","Hand Held Showers","Shower Systems","Shower Heads","Shower Arms","Shower Heads and Arms","Wall Mixer","Wall Mixer with Diverter","Wall Top Assembly"],
  Basins:      ["Above Counter Basins","Under Counter Basins","Wall Hung Basins","Freestanding Basins"],
  Vanities:    ["Wall Hung Vanities","Floor Standing Vanities","Tall Boys","Vanity Tops","Laundry Tubs","Mirrored Shaving Cabinets","LED Mirrored Shaving Cabinets","Samples"],
  Mirrors:     ["Mirrored Shaving Cabinets","LED Mirrored Shaving Cabinets","LED Mirrors","Non-LED Mirrors","Magnifying Mirrors"],
  Toilets:     ["Back to Wall Toilets","Close Coupled Toilets","Wall Hung Toilets","Wall Faced Toilets","Rimless Toilets","In-Wall Cisterns","Back to Wall Smart Toilets","Wall Hung Smart Toilets","Integrated Smart Toilets"],
  Tiles:       ["Rectangle Tiles","Square Tiles","Herringbone Tiles","Diamond Tiles","Hexagon Tiles","Mosaic Tiles"],
};

const STYLES = ["Contemporary","Traditional","Hamptons","Smart Bathroom","Beach","Coastal"];
const BRANDS = ["Aulic","BelBagno","BTH","Ceto","Fienza","Infinity","Joinery By Bears","JR Bespoke","Lukka","Mercio","Orio","Otti","Poseidon","Riva","Timberline","Turner Hastings","Vito","TOTO","Lafeme","Phoenix","Modern National","Hellycar","Caroma"];

module.exports = {
  TITLE_FORMATS, MARGIN_RULES, CATEGORY_META, COLOUR_TAG_MAP, DESCRIPTION_FEATURES,
  PRODUCT_TYPES, STYLES, BRANDS, ALL_CATEGORIES,
  getMarginRule, calculateWeight, calculateSP, calculateRRP, addGST,
  resolveColourTag, getDescriptionFeatures, buildAIPrompt,
};
