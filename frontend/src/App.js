import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useResponsive() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile:  width < 640,
    isTablet:  width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
}

// ─── BUSINESS RULES ───────────────────────────────────────────────────────────
const MARGIN_RULES_FE = {
  "Tapware":                           { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Accessories":                       { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Showers":                           { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Basins":                            { margin: 65  },
  "Sinks":                             { margin: 80  },
  "Vanities":                          { margin: 250 }, "Cabinets": { margin: 250 }, "Laundry Cabinets": { margin: 250 },
  "Toilets":                           { margin: 175 }, "Toilets Johnson Suisse": { margin: 300 },
  "Toilets Under $300":                { hardMin: 300},
  "Shaving Cabinet":                   { margin: 150 }, "Tiles": { margin: 35 }, "Saunas": { margin: 300 },
  "Bathtubs":                          { margin: 300 }, "Spa Bathtubs": { margin: 500 },
  "Riva Transparent Bathtubs":         { margin: 700 },
  "Shower Screens Wall-to-Wall":       { margin: 250 },
  "Shower Screens Covey Return Panel": { margin: 125 },
  "Heating":                           { margin: 100 }, "Lighting": { margin: 100 },
  "Toilet Paper Holders":              { hardMin: 30 }, "Robe Hooks": { hardMin: 20 },
};

const WEIGHT_RULES_FE = {
  "Tapware": "formula", "Accessories": "formula", "Showers": "formula",
  "Heating": 150, "Lighting": 150,
  "Shower Screens": 900, "Bathtubs": 900, "Spa Bathtubs": 900,
  "Vanities": 150, "Toilets": 150, "Mirrors": 20, "Basins": 20, "Sinks": 20,
  "Tiles": 150, "Saunas": 900,
};

const PRODUCT_TITLE_FORMATS = {
  "Basin Mixer":                    { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Tall Basin Mixer":               { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Sink Mixer":                     { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Pull-Out Sink Mixer":            { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Free Standing Bath Mixer":       { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Wall Mixer":                     { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Bath Spouts / Outlets":          { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Heated Towel Rails":             { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add size at end — consider Length" },
  "Non-Heated Towel Rails":         { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add size at end — consider Length" },
  "Robe Hooks":                     { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size needed (under 100mm)" },
  "Toilet Accessories":             { parts:["Brand","Collection","Product Type","Colour"],                            note:"" },
  "Soap Dish Holders":              { parts:["Brand","Collection","Product Type","Colour"],                            note:"" },
  "Channel Grates":                 { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add size at end — consider Length" },
  "Point Drains":                   { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add size at end — consider Length" },
  "Basin Wastes":                   { parts:["Brand","Collection","Product Type","Colour"],                            note:"" },
  "Shower on Rails":                { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size for basic showers (under 100mm)" },
  "Hand Held Showers":              { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size for basic showers (under 100mm)" },
  "Shower Systems":                 { parts:["Brand","Collection","Product Type","Colour"],                            note:"No size for basic showers (under 100mm)" },
  "Shower Heads":                   { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add Size — consider Head dimension" },
  "Shower Arms":                    { parts:["Brand","Collection","Product Type","Size","Colour"],                     note:"Add Size — consider Height or Length according to direction of Arm" },
  "Framed Shower Screens":          { parts:["Brand","Collection","Framing","Type of Shower Screen","Colour","Size"],  note:"" },
  "Semi-Frameless Shower Screens":  { parts:["Brand","Collection","Framing","Type of Shower Screen","Colour","Size"],  note:"" },
  "Frameless Shower Screens":       { parts:["Brand","Collection","Framing","Type of Shower Screen","Colour","Size"],  note:"" },
  "Corner Baths":                   { parts:["Brand","Collection","Type of Bath","Colour","Size"],                     note:"Consider Length" },
  "Freestanding Baths":             { parts:["Brand","Collection","Type of Bath","Colour","Size"],                     note:"Consider Length" },
  "Spa Baths":                      { parts:["Brand","Collection","Type of Bath","Colour","Size"],                     note:"Consider Length" },
  "Built in Baths":                 { parts:["Brand","Collection","Type of Bath","Colour","Size"],                     note:"Consider Length" },
  "Wall Hung Vanities":             { parts:["Brand","Collection","Colour","Size","Bowl Configuration","Vanity Type"], note:"Consider Length" },
  "Floor Standing Vanities":        { parts:["Brand","Collection","Colour","Size","Bowl Configuration","Vanity Type"], note:"Consider Length" },
  "Tall Boys":                      { parts:["Brand","Collection","Colour","Size","Vanity Type"],                      note:"Consider Length and Height" },
  "Mirrored Shaving Cabinets":      { parts:["Brand","Collection","Colour","Cabinet Type","Size"],                     note:"Consider Length or Height according to direction of cabinet" },
  "LED Mirrored Shaving Cabinets":  { parts:["Brand","Collection","Colour","Cabinet Type","Size"],                     note:"Consider Length or Height according to direction of cabinet" },
  "Above Counter Basins":           { parts:["Brand","Collection","Basin Type","Colour","Size"],                       note:"Consider Length" },
  "Under Counter Basins":           { parts:["Brand","Collection","Basin Type","Colour","Size"],                       note:"Consider Length" },
  "Wall Hung Basins":               { parts:["Brand","Collection","Basin Type","Colour","Size"],                       note:"Consider Length" },
  "Freestanding Basins":            { parts:["Brand","Collection","Basin Type","Colour","Size"],                       note:"Consider Length AND Height" },
  "Undermount Sinks":               { parts:["Brand","Collection","Sink Type","Colour","Size"],                        note:'Consider Length. Add "Kitchen Accessories" if applicable' },
  "Overmount Sinks":                { parts:["Brand","Collection","Sink Type","Colour","Size"],                        note:'Consider Length. Add "Kitchen Accessories" if applicable' },
  "Laundry Sinks":                  { parts:["Brand","Collection","Sink Type","Colour","Size"],                        note:"Consider Length" },
  "Kitchen Accessories":            { parts:["Brand","Collection","Product Type","Colour","Size"],                     note:"" },
  "LED Mirrors":                    { parts:["Brand","Collection","Shape","Mirror Type","Colour","Size"],              note:"Consider Length and Height" },
  "Non-LED Mirrors":                { parts:["Brand","Collection","Shape","Mirror Type","Colour","Size"],              note:"Consider Length and Height" },
  "Magnifying Mirrors":             { parts:["Brand","Collection","Shape","Mirror Type","Colour","Size"],              note:"Consider Length and Height" },
  "Heated Towel Rails (Heating)":   { parts:["Brand","Collection","Type of Heating","Colour","Size"],                  note:"Size if applicable" },
  "Hand Dryers":                    { parts:["Brand","Collection","Type","Colour","Size"],                             note:"Use full dimension for Size" },
  "Wall Lights":                    { parts:["Brand","Collection","Type of Lighting","Colour","Size"],                 note:"Consider Length or Height according to direction of the light" },
  "Exhausts":                       { parts:["Brand","Collection","Type of Lighting","Colour","Size"],                 note:"Size if applicable" },
  "Bidets & Washlets":              { parts:["Brand","Collection","Bidet Type","Control Type","Washlet Shape","Colour"],note:"Washlet Shape if applicable" },
  "Back to Wall Smart Toilets":     { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Rimless Smart Toilets":          { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Wall Hung Smart Toilets":        { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Back to Wall Toilets":           { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Close Coupled Toilets":          { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Wall Faced Toilets":             { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Rimless Toilets":                { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "In-Wall Cisterns":               { parts:["Brand","Collection","Type","Colour"],                                    note:"" },
  "Integrated Smart Toilets":       { parts:["Brand","Collection","Toilet Type","Bidet Type","Control Type","Washlet Shape","Colour"], note:"Smart Toilet format" },
  "Rectangle Tiles":                { parts:["Brand","Collection","Colour","Finish","Size","Shape Tile (PER BOX)"],    note:"Always state unit: PER BOX / PER PACK / PER SLAB / PER TILE" },
  "Square Tiles":                   { parts:["Brand","Collection","Colour","Finish","Size","Shape Tile (PER BOX)"],    note:"Always state unit: PER BOX / PER PACK / PER SLAB / PER TILE" },
  "Mosaic Tiles":                   { parts:["Brand","Collection","Colour","Finish","Size","Shape Tile (PER BOX)"],    note:"Always state unit: PER BOX / PER PACK / PER SLAB / PER TILE" },
  "Laundry Cabinets":               { parts:["Brand","Collection","Product Type","Colour","Size"],                     note:"Consider Length" },
};

const CATEGORY_TITLE_FORMATS = {
  "Tapware":        { parts:["Brand","Collection","Product Type","Size","Colour"],                      note:"No size for basic tapware (under 100mm)" },
  "Accessories":    { parts:["Brand","Collection","Product Type","Size","Colour"],                      note:"" },
  "Showers":        { parts:["Brand","Collection","Product Type","Size","Colour"],                      note:"No size for basic showers (under 100mm)" },
  "Shower Screens": { parts:["Brand","Collection","Framing","Type of Shower Screen","Colour","Size"],   note:"" },
  "Bathtubs":       { parts:["Brand","Collection","Type of Bath","Colour","Size"],                      note:"Consider Length" },
  "Vanities":       { parts:["Brand","Collection","Colour","Size","Bowl Configuration","Vanity Type"],  note:"Consider Length" },
  "Shaving Cabinet":{ parts:["Brand","Collection","Colour","Cabinet Type","Size"],                      note:"Consider Length or Height" },
  "Basins":         { parts:["Brand","Collection","Basin Type","Colour","Size"],                        note:"Consider Length" },
  "Sinks":          { parts:["Brand","Collection","Sink Type","Colour","Size"],                         note:"Consider Length" },
  "Mirrors":        { parts:["Brand","Collection","Shape","Mirror Type","Colour","Size"],               note:"Consider Length and Height" },
  "Heating":        { parts:["Brand","Collection","Type of Heating","Colour","Size"],                   note:"" },
  "Lighting":       { parts:["Brand","Collection","Type of Lighting","Colour","Size"],                  note:"Consider Length or Height" },
  "Bidets":         { parts:["Brand","Collection","Bidet Type","Control Type","Washlet Shape","Colour"],note:"" },
  "Toilets":        { parts:["Brand","Collection","Type","Colour"],                                     note:"" },
  "Smart Toilet":   { parts:["Brand","Collection","Toilet Type","Bidet Type","Control Type","Washlet Shape","Colour"], note:"" },
  "Tiles":          { parts:["Brand","Collection","Colour","Finish","Size","Shape Tile (PER BOX)"],     note:"Always state unit" },
  "Kitchen":        { parts:["Brand","Collection","Product Type","Colour","Size"],                      note:"" },
  "Laundry":        { parts:["Brand","Collection","Product Type","Colour","Size"],                      note:"Consider Length" },
  "default":        { parts:["Brand","Collection","Product Type","Colour"],                             note:"" },
};

const ALL_CATEGORIES = [
  "Tapware","Accessories","Showers","Shower Screens","Bathtubs","Vanities","Basins",
  "Mirrors","Heating","Lighting","Kitchen","Laundry","Bidets","Toilets","Tiles","Sinks",
  "Shaving Cabinet","Smart Toilet","Saunas","Toilet Paper Holders","Robe Hooks",
  "Laundry Cabinets","Toilets Johnson Suisse","Toilets Under $300",
  "Riva Transparent Bathtubs","Spa Bathtubs","Shower Screens Wall-to-Wall",
  "Shower Screens Covey Return Panel",
];

const DESCRIPTION_FEATURES = {
  Accessories: ["colour","size","shape","material","type","wels","flowRate","welsReg","ipRating","voltage","additional"],
  Tapware:     ["colour","size","material","type","wels","flowRate","welsReg","additional"],
  Basins:      ["colour","size","material","mounting","compatible","additional"],
  Vanities:    ["colour","size","material","mounting","bowl","drawer","mechanism","handles","additional"],
  Showers:     ["colour","size","material","type","wels","flowRate","additional"],
  Mirrors:     ["colour","size","shape","type","ipRating","voltage","additional"],
  Toilets:     ["colour","size","type","flushing","waterRating","additional"],
  Tiles:       ["colour","size","finish","shape","coverage","additional"],
  default:     ["colour","size","material","type","additional"],
};

const FEATURE_LABELS = {
  colour:"Colour", size:"Size", shape:"Shape", material:"Material", type:"Type",
  wels:"WELS Rating", flowRate:"Flow Rate", welsReg:"WELS Reg. No.",
  ipRating:"IP Rating", voltage:"Voltage", additional:"Additional Information",
  mounting:"Mounting", compatible:"Compatible with", bowl:"Bowl Option",
  drawer:"Drawer/Door", mechanism:"Mechanism", handles:"Handles",
  flushing:"Flushing System", waterRating:"Water Rating",
  finish:"Finish", coverage:"Coverage (per box/pack)",
};

const PRODUCT_SPEC_TAGS = [
  "Gooseneck", "Lead Free", "Watermark Approved", "WELS Approved",
  "Wall Mounted", "Floor Mounted", "Freestanding", "Back to Wall",
  "Rimless", "Dual Flush", "Single Lever", "Double Handle",
  "Thermostatic", "Brushed", "Matte", "Polished",
];

const TAG_FIELD_DEFS = {
  brand:         { prefix: "Brand_",         label: "Brand"         },
  colour:        { prefix: "Colour_",        label: "Colour"        },
  style:         { prefix: "Style_",         label: "Style"         },
  configuration: { prefix: "Configuration_", label: "Configuration" },
  size:          { prefix: "Size_",          label: "Size Range"    },
  shape:         { prefix: "Shape_",         label: "Shape"         },
  finish:        { prefix: "Finish_",        label: "Finish"        },
};

const SCHEMAS_FE = {
  styleOnly:       ["style"],
  brandColourOnly: [],
  configOnly:      ["configuration"],
  configSize:      ["configuration", "size"],
  configSizeStyle: ["configuration", "size", "style"],
  sizeOnly:        ["size"],
  sizeStyle:       ["size", "style"],
  shapeOnly:       ["shape"],
  tileSchema:      ["size", "finish"],
};

const PRODUCT_TAG_MAP_FE = {
  "Basin Mixer":               { collection:"Basin Mixers",                schema:"styleOnly",       styleOptions:["Contemporary","Traditional","Smart Bathroom"] },
  "Tall Basin Mixer":          { collection:"Tall Basin Mixers",           schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Sink Mixer":                { collection:"Sink Mixers",                 schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Pull-Out Sink Mixer":       { collection:"Pull-Out Sink Mixers",        schema:"styleOnly",       styleOptions:["Contemporary"] },
  "Free Standing Bath Mixer":  { collection:"Free Standing Bath Mixers",   schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Heated Towel Rails":        { collection:"Heated Towel Rails",          schema:"configSize",      configOptions:["Towel Bars","Single Towel Rails","Double Towel Rails"], extraFields:["style"], styleOptions:["Smart Bathrooms"] },
  "Non-Heated Towel Rails":    { collection:"Non-Heated Towel Rails",      schema:"configOnly",      configOptions:["Towel Rails"] },
  "Robe Hooks":                { collection:"Robe Hooks",                  schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Toilet Accessories":        { collection:"Toilet Accessories",          schema:"brandColourOnly" },
  "Soap Dish Holders":         { collection:"Soap Dish Holders",           schema:"brandColourOnly" },
  "Shower on Rails":           { collection:"Shower on Rails",             schema:"styleOnly",       styleOptions:["Contemporary","Traditional","Hamptons"] },
  "Hand Held Showers":         { collection:"Hand Held Showers",           schema:"styleOnly",       styleOptions:["Contemporary"] },
  "Shower Systems":            { collection:"Shower Systems",              schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Shower Heads":              { collection:"Shower Heads",                schema:"styleOnly",       styleOptions:["Contemporary","Traditional"] },
  "Shower Arms":               { collection:"Shower Arms",                 schema:"brandColourOnly" },
  "Undermount Sinks":          { collection:"Undermount Sinks",            schema:"configOnly",      configOptions:["Single Bowl","Double Bowl"] },
  "Overmount Sinks":           { collection:"Overmount Sinks",             schema:"configOnly",      configOptions:["Single Bowl","Double Bowl"] },
  "Kitchen Accessories":       { collection:"Kitchen Accessories",         schema:"brandColourOnly" },
  "Corner Baths":              { collection:"Corner Baths",                schema:"styleOnly",       styleOptions:["Contemporary"] },
  "Freestanding Baths":        { collection:"Freestanding Baths",          schema:"styleOnly",       styleOptions:["Contemporary","Luxury"] },
  "Spa Baths":                 { collection:"Spa Baths",                   schema:"brandColourOnly" },
  "Built in Baths":            { collection:"Built In Baths",              schema:"brandColourOnly" },
  "Framed Shower Screens":     { collection:"Framed Shower Screens",        schema:"configOnly", configOptions:["Pivot","Sliding"] },
  "Semi-Frameless Shower Screens":{ collection:"Semi-Frameless Shower Screens",schema:"configOnly", configOptions:["Pivot","Sliding"] },
  "Frameless Shower Screens":  { collection:"Frameless Shower Screens",     schema:"brandColourOnly" },
  "Wall Hung Vanities":        { collection:"Wall Hung Vanities",          schema:"configSize",      configOptions:["Single Bowl","Double Bowl"] },
  "Floor Standing Vanities":   { collection:"Floor Standing Vanities",     schema:"configSize",      configOptions:["Single Bowl","Double Bowl"] },
  "Tall Boys":                 { collection:"Tall Boys",                   schema:"brandColourOnly" },
  "Above Counter Basins":      { collection:"Above Counter Basins",        schema:"shapeOnly",       shapeOptions:["Round","Rectangle","Oval"] },
  "Under Counter Basins":      { collection:"Under Counter Basins",        schema:"brandColourOnly" },
  "Wall Hung Basins":          { collection:"Wall Hung Basins",            schema:"brandColourOnly" },
  "LED Mirrors":               { collection:"LED Mirrors",                 schema:"shapeOnly",       shapeOptions:["Round","Rectangle"] },
  "Non-LED Mirrors":           { collection:"Non-LED Mirrors",             schema:"shapeOnly",       shapeOptions:["Round","Rectangle"] },
  "Magnifying Mirrors":        { collection:"Magnifying Mirrors",          schema:"brandColourOnly" },
  "Wall Lights":               { collection:"Wall Lights",                 schema:"styleOnly",       styleOptions:["Modern","Contemporary"] },
  "Exhausts":                  { collection:"Exhausts",                    schema:"brandColourOnly" },
  "Laundry Cabinets":          { collection:"Laundry Cabinets",            schema:"sizeOnly" },
  "Laundry Sinks":             { collection:"Laundry Sinks",               schema:"configOnly",      configOptions:["Single Bowl","Double Bowl"] },
  "Bidets & Washlets":         { collection:"Bidets & Washlets",           schema:"styleOnly",       styleOptions:["Smart Bathroom"] },
  "Back to Wall Smart Toilets":{ collection:"Back to Wall Smart Toilets",  schema:"styleOnly",       styleOptions:["Smart Bathroom"] },
  "Rimless Smart Toilets":     { collection:"Rimless Smart Toilets",       schema:"styleOnly",       styleOptions:["Smart Bathroom"] },
  "Wall Hung Smart Toilets":   { collection:"Wall Hung Smart Toilets",     schema:"styleOnly",       styleOptions:["Smart Bathroom"] },
  "Rectangle Tiles":           { collection:"Rectangle Tiles",             schema:"tileSchema",      noBrand:true, finishOptions:["Matte","Gloss"] },
  "Square Tiles":              { collection:"Square Tiles",                schema:"tileSchema",      noBrand:true, finishOptions:["Matte","Gloss"] },
  "Mosaic Tiles":              { collection:"Mosaic Tiles",                schema:"brandColourOnly", noBrand:true, extraFields:["finish"], finishOptions:["Matte","Gloss"] },
};

const ALL_PRODUCT_TYPES_FLAT = Object.keys(PRODUCT_TAG_MAP_FE).sort();

function buildTagsFromSchema(productType, vals) {
  const spec = PRODUCT_TAG_MAP_FE[productType];
  if (!spec) return [];
  const schema      = SCHEMAS_FE[spec.schema] || [];
  const extraFields = spec.extraFields || [];
  const allFields   = [...new Set([...schema, ...extraFields])];
  const tags = [`Collections_${spec.collection}`];
  for (const fk of allFields) {
    const def = TAG_FIELD_DEFS[fk];
    if (!def) continue;
    const v = vals[fk];
    if (v && String(v).trim()) tags.push(`${def.prefix}${String(v).trim()}`);
  }
  if (!spec.noBrand && vals.brand && String(vals.brand).trim()) tags.push(`Brand_${String(vals.brand).trim()}`);
  if (vals.colour && String(vals.colour).trim()) tags.push(`Colour_${String(vals.colour).trim()}`);
  return tags;
}

function calcWeight(cat, sp, brand) {
  if (["TOTO","Lafeme"].includes(brand)) return { w: 1, note: "TOTO/Lafeme = 1kg" };
  const r = WEIGHT_RULES_FE[cat];
  if (r === "formula") {
    if (+sp < 150) return { w: +(+sp / 150).toFixed(3), note: `SP/150 = ${sp}/150` };
    return { w: 1, note: "SP >= $150 -> 1kg" };
  }
  return { w: r || 1, note: "" };
}

function calcMargin(cat, cp, rrp) {
  const r = MARGIN_RULES_FE[cat];
  if (!r) return { sp: Math.round(cp + 1), ok: true, required: 0 };
  if (r.hardMin) return { sp: Math.max(r.hardMin, Math.round(cp + 1)), ok: true, required: r.hardMin, hardMin: true };
  let margin = r.margin || 0;
  if (r.threshold && cp >= r.threshold) margin = r.overThreshold;
  let sp = Math.round(cp + margin);
  if (r.capAtRRP && rrp && sp > rrp) sp = rrp;
  return { sp, required: margin, ok: sp - cp >= margin };
}

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Badge = ({ ok, children }) => (
  <span style={{
    display:"inline-block", padding:"2px 10px", borderRadius:12, fontSize:12, fontWeight:700,
    background: ok ? "#14532d22" : "#7f1d1d22",
    color: ok ? "#16a34a" : "#dc2626", border: `1px solid ${ok?"#16a34a":"#dc2626"}`,
  }}>{children}</span>
);

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#aaa", marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize:11, color:"#666", marginTop:3 }}>{hint}</div>}
  </div>
);

const Input = ({ value, onChange, placeholder, type="text", style={} }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
    style={{ width:"100%", background:"#1a1a1a", border:"1px solid #333", borderRadius:8, padding:"9px 12px",
      color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box", ...style }} />
);

const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width:"100%", background:"#1a1a1a", border:"1px solid #333", borderRadius:8, padding:"9px 12px",
      color: value ? "#fff" : "#666", fontSize:14, outline:"none", boxSizing:"border-box" }}>
    <option value="">{placeholder || "Select..."}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Btn = ({ onClick, children, variant="primary", disabled=false, small=false }) => {
  const bg  = variant==="primary"?"#c9933a": variant==="danger"?"#7f1d1d": variant==="success"?"#14532d":"#2a2a2a";
  const col = variant==="ghost"?"#aaa":"#fff";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:bg, color:col, border:"none", borderRadius:8,
        padding: small?"6px 14px":"10px 20px", fontSize: small?12:14, fontWeight:700,
        cursor: disabled?"not-allowed":"pointer", opacity: disabled?.6:1, transition:"opacity .2s" }}>
      {children}
    </button>
  );
};

const Card = ({ children, style={} }) => (
  <div style={{ background:"#111", border:"1px solid #222", borderRadius:12, padding:20, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:700, color:"#c9933a", textTransform:"uppercase", letterSpacing:2,
    marginBottom:16, paddingBottom:8, borderBottom:"1px solid #222" }}>
    {children}
  </div>
);

// ─── PRICING CALCULATOR ───────────────────────────────────────────────────────
function PricingPanel({ category, brand, supplierUrl, sku, onResult, autoRrp, autoRrpIncludesGST }) {
  const { isMobile } = useResponsive();
  const [cpRaw, setCp]                  = useState("");
  const [cpGST, setCpGST]               = useState(false);
  const [rrpRaw, setRrp]                = useState("");
  const [rrpGST, setRrpGST]             = useState(false);
  const [manualSP, setManualSP]         = useState("");
  const [pricingMode, setPricingMode]   = useState("margin");
  const [cpMultiplier, setCpMultiplier] = useState("");
  const [spMultiplier, setSpMultiplier] = useState("");
  const [result, setResult]             = useState(null);
  const [fetching, setFetching]         = useState(false);
  const [fetchMsg, setFetchMsg]         = useState("");

  useEffect(() => {
    if (autoRrp) {
      setRrp(String(autoRrp));
      setRrpGST(autoRrpIncludesGST !== false);
      setFetchMsg(`✓ RRP auto-filled from URL: $${autoRrp}`);
    }
  }, [autoRrp, autoRrpIncludesGST]);

  const fetchRRP = async () => {
    if (!supplierUrl && !sku) { setFetchMsg("Enter Supplier URL or SKU first"); return; }
    setFetching(true); setFetchMsg("Scraping supplier page for RRP...");
    try {
      if (supplierUrl) {
        const { data } = await axios.post(`${API}/description/fetch-from-url`, { supplierUrl, category: category || "" });
        if (data.rrp) {
          setRrp(String(data.rrp));
          setRrpGST(data.rrpIncludesGST !== false);
          const conf = data.confidence === "low" ? " (low confidence — verify)" : data.scrapedOk ? "" : " (estimated — verify)";
          setFetchMsg(`✓ RRP fetched: $${data.rrp} ${data.rrpIncludesGST !== false ? "(inc GST)" : "(ex GST)"}${conf}`);
          setFetching(false);
          return;
        }
      }
      const { data: rrpData } = await axios.post(`${API}/description/fetch-rrp`, { supplierUrl, sku });
      if (rrpData.rrp) {
        setRrp(String(rrpData.rrp));
        setRrpGST(rrpData.includesGST !== false);
        const tag = rrpData.source === "estimated" ? " (estimated — verify)" : "";
        setFetchMsg(`✓ RRP fetched: $${rrpData.rrp} ${rrpData.includesGST ? "(inc GST)" : "(ex GST)"}${tag}`);
      } else {
        setFetchMsg(rrpData.message || "Could not extract RRP — enter manually");
      }
    } catch {
      setFetchMsg("Fetch failed — enter RRP manually");
    }
    setFetching(false);
  };

  const getRRP = () => rrpRaw ? (rrpGST ? Math.round(+rrpRaw) : Math.round(+rrpRaw * 1.1)) : null;

  const calculate = useCallback(() => {
    const rrp = getRRP();
    let cp;
    if (pricingMode === "cpMultiplier") {
      if (!rrp || !cpMultiplier) return;
      cp = +(rrp * +cpMultiplier).toFixed(2);
    } else {
      if (!cpRaw) return;
      cp = cpGST ? +cpRaw : +(+cpRaw * 1.1).toFixed(2);
    }
    let finalSP;
    if (manualSP)                                                    { finalSP = Math.round(+manualSP); }
    else if (pricingMode === "rrp85" && rrp)                         { finalSP = Math.round(rrp * 0.85); }
    else if (pricingMode === "rrp90" && rrp)                         { finalSP = Math.round(rrp * 0.90); }
    else if (pricingMode === "spMultiplier" && rrp && spMultiplier)  { finalSP = Math.round(rrp * +spMultiplier); }
    else if (pricingMode === "cpMultiplier")                         { finalSP = (rrp && spMultiplier) ? Math.round(rrp * +spMultiplier) : calcMargin(category, cp, rrp).sp; }
    else                                                             { finalSP = calcMargin(category, cp, rrp).sp; }

    const { required, hardMin } = calcMargin(category, cp, rrp);
    const finalRRP    = rrp || Math.round(finalSP * 1.1);
    const { w, note } = calcWeight(category, finalSP, brand);
    const actualMargin = +(finalSP - cp).toFixed(2);
    const marginOk    = hardMin ? finalSP >= required : actualMargin >= required;
    const r = { cp, rrp: finalRRP, sp: finalSP, actualMargin, required, marginOk, weight: w, weightNote: note, pricingMode };
    setResult(r); onResult?.(r);
  }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, pricingMode, cpMultiplier, spMultiplier, category, brand, onResult]);

  useEffect(() => {
    const canCalc =
      (pricingMode === "cpMultiplier" && rrpRaw && cpMultiplier) ||
      (pricingMode === "spMultiplier" && rrpRaw && spMultiplier) ||
      (["margin","rrp85","rrp90"].includes(pricingMode) && cpRaw);
    if (canCalc) calculate();
  }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, pricingMode, cpMultiplier, spMultiplier, calculate]);

  const MODES = [
    { key:"margin",       label:"CP + Min Margin", desc:"Default — adds minimum margin to CP" },
    { key:"rrp85",        label:"RRP x 0.85",      desc:"15% off RRP"                         },
    { key:"rrp90",        label:"RRP x 0.90",      desc:"10% off RRP"                         },
    { key:"cpMultiplier", label:"CP = RRP x ?",    desc:"Custom CP from RRP multiplier"       },
    { key:"spMultiplier", label:"SP = RRP x ?",    desc:"Custom SP from RRP multiplier"       },
  ];
  const rrpNum = getRRP();

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-dollar-sign"></i> Pricing Calculator</SectionTitle>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#888", marginBottom:6, fontWeight:600 }}>PRICING MODE</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:6 }}>
          {MODES.map(m => (
            <div key={m.key} onClick={() => setPricingMode(m.key)}
              style={{ border:`1px solid ${pricingMode===m.key?"#c9933a":"#333"}`, borderRadius:8,
                padding:"8px 10px", cursor:"pointer",
                background: pricingMode===m.key ? "#c9933a22" : "#111", transition:"all .15s" }}>
              <div style={{ fontSize:11, fontWeight:700, color:pricingMode===m.key?"#c9933a":"#888" }}>{m.label}</div>
              <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {(pricingMode === "cpMultiplier" || pricingMode === "spMultiplier") && (
        <div style={{ background:"#0d0d0d", borderRadius:8, padding:12, marginBottom:12, border:"1px solid #c9933a33" }}>
          <div style={{ fontSize:11, color:"#c9933a", fontWeight:700, marginBottom:8 }}>
            <i className="fa-solid fa-pen-to-square"></i> Custom Multiplier — RRP must be entered below
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10 }}>
            {pricingMode === "cpMultiplier" && (
              <Field label="CP Multiplier" hint="CP = RRP x this number">
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:"#888", fontSize:12, whiteSpace:"nowrap" }}>RRP x</span>
                  <Input value={cpMultiplier} onChange={setCpMultiplier} placeholder="e.g. 0.65" type="number" style={{ flex:1 }} />
                </div>
                {rrpNum && cpMultiplier && (
                  <div style={{ fontSize:11, color:"#c9933a", marginTop:4 }}>= ${(rrpNum * +cpMultiplier).toFixed(2)} CP (inc GST)</div>
                )}
              </Field>
            )}
            <Field label={pricingMode === "cpMultiplier" ? "SP Multiplier (optional)" : "SP Multiplier"} hint="SP = RRP x this number">
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:"#888", fontSize:12, whiteSpace:"nowrap" }}>RRP x</span>
                <Input value={spMultiplier} onChange={setSpMultiplier} placeholder="e.g. 0.85" type="number" style={{ flex:1 }} />
              </div>
              {rrpNum && spMultiplier && (
                <div style={{ fontSize:11, color:"#c9933a", marginTop:4 }}>= ${Math.round(rrpNum * +spMultiplier)} SP</div>
              )}
            </Field>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12 }}>
        <Field label="Cost Price (CP)" hint={pricingMode === "cpMultiplier" ? "Auto-calculated from RRP x multiplier" : "Supplier's price — GST added if not included"}>
          {pricingMode === "cpMultiplier" ? (
            <Input value={rrpNum && cpMultiplier ? (rrpNum * +cpMultiplier).toFixed(2) : ""}
              onChange={() => {}} placeholder="Auto from RRP x multiplier" style={{ opacity:0.5, cursor:"not-allowed" }} />
          ) : (
            <>
              <Input value={cpRaw} onChange={setCp} placeholder="90.00" type="number" />
              <label style={{ fontSize:11, color:"#888", marginTop:4, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <input type="checkbox" checked={cpGST} onChange={e=>setCpGST(e.target.checked)} />
                Already includes GST
              </label>
            </>
          )}
        </Field>
        <Field label="RRP" hint={autoRrp ? "Auto-filled from URL fetch" : "From supplier catalogue — or click Fetch below"}>
          <Input value={rrpRaw} onChange={setRrp} placeholder="200.00" type="number"
            style={autoRrp && rrpRaw === String(autoRrp) ? { borderColor:"#c9933a55" } : {}} />
          <label style={{ fontSize:11, color:"#888", marginTop:4, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={rrpGST} onChange={e=>setRrpGST(e.target.checked)} />
            Already includes GST
          </label>
        </Field>
      </div>

      <div style={{ marginBottom:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <Btn onClick={fetchRRP} disabled={fetching || (!supplierUrl && !sku)} variant="ghost" small>
          {fetching
            ? <><i className="fa-solid fa-spinner fa-spin"></i> Scraping page...</>
            : <><i className="fa-solid fa-magnifying-glass"></i> Fetch RRP from Supplier Page</>}
        </Btn>
        {!supplierUrl && !sku && (
          <span style={{ fontSize:11, color:"#555" }}>Enter Supplier URL above first</span>
        )}
        {fetchMsg && (
          <span style={{ fontSize:11, color: fetchMsg.startsWith("✓") ? "#16a34a" : fetchMsg.includes("estimated") || fetchMsg.includes("verify") ? "#f59e0b" : "#ef4444" }}>
            {fetchMsg}
          </span>
        )}
      </div>

      <Field label="Override SP (optional)" hint="Leave blank to auto-calculate">
        <Input value={manualSP} onChange={setManualSP} placeholder="Leave blank for auto" type="number" />
      </Field>

      {result && (
        <div style={{ marginTop:12, background:"#0d0d0d", borderRadius:10, padding:16, border:`1px solid ${result.marginOk?"#16a34a44":"#dc262644"}` }}>
          <div style={{ fontSize:10, color:"#555", textAlign:"center", marginBottom:8 }}>
            Mode: {MODES.find(m=>m.key===pricingMode)?.label}
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:10, marginBottom:12 }}>
            {[
              { label:"CP (inc GST)",  val:`$${result.cp}`,       color:"#aaa" },
              { label:"RRP",           val:`$${result.rrp}`,      color:"#aaa" },
              { label:"Selling Price", val:`$${result.sp}`,       color:"#c9933a" },
              { label:"Weight",        val:`${result.weight} kg`, color:"#aaa" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <Badge ok={result.marginOk}>{result.marginOk ? <><i class="fa-solid fa-check"></i> Margin OK</> : <>Margin Too Low <i className="fa-solid fa-arrow-trend-down"></i></>}</Badge>
            <span style={{ fontSize:12, color:"#888" }}>Margin: ${result.actualMargin} / Required: ${result.required}</span>
            {result.weightNote && <span style={{ fontSize:11, color:"#666" }}>{result.weightNote}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TITLE BUILDER ────────────────────────────────────────────────────────────
function TitleBuilder({ category, productType, onChange, sharedBrand, sharedCollection, sharedColour, sharedSize }) {
  const { isMobile } = useResponsive();
  const titleSpec = productType && PRODUCT_TITLE_FORMATS[productType]
    ? PRODUCT_TITLE_FORMATS[productType]
    : CATEGORY_TITLE_FORMATS[category] || CATEGORY_TITLE_FORMATS["default"];

  const parts     = titleSpec.parts;
  const formatNote = titleSpec.note;
  const formatDisplay = parts.join(" > ");

  const [vals, setVals]                 = useState({});
  const [productSpec, setProductSpec]   = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag]       = useState("");

  const SHARED_MAP = {
    "Brand":      sharedBrand,
    "Collection": sharedCollection,
    "Colour":     sharedColour,
    "Size":       sharedSize,
  };

  useEffect(() => {
    setVals(prev => {
      const updated = { ...prev }; let changed = false;
      Object.entries(SHARED_MAP).forEach(([key, val]) => {
        if (parts.includes(key) && val !== undefined && val !== prev[key]) {
          updated[key] = val; changed = true;
        }
      });
      return changed ? updated : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedBrand, sharedCollection, sharedColour, sharedSize, productType, category]);

  useEffect(() => {
    setVals(prev => {
      const next = {};
      parts.forEach(p => { next[p] = SHARED_MAP[p] || prev[p] || ""; });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType, category]);

  useEffect(() => {
    const baseParts = parts.map(p => vals[p] || "").filter(Boolean);
    const specPart  = productSpec.trim() ? [productSpec.trim()] : [];
    const tagsPart  = selectedTags.length > 0 ? [selectedTags.join(" ")] : [];
    onChange([...baseParts, ...specPart, ...tagsPart].join(" ").toUpperCase());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, productSpec, selectedTags]);

  const setVal       = (k, v) => setVals(prev => ({ ...prev, [k]: v }));
  const toggleTag    = (tag)  => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
    setCustomTag("");
  };

  const isActive = productType && PRODUCT_TITLE_FORMATS[productType];

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-medal"></i> Title Builder</SectionTitle>

      <div style={{ background:"#0d0d0d", borderRadius:8, padding:"10px 14px", marginBottom: formatNote ? 6 : 14,
        fontSize:12, color:"#c9933a", fontFamily:"monospace", overflowX:"auto", whiteSpace: isMobile ? "normal" : "nowrap" }}>
        {isActive && <span style={{ fontSize:9, color:"#16a34a", fontWeight:700, marginRight:8, background:"#14532d22", borderRadius:3, padding:"1px 6px" }}>EXACT FORMAT</span>}
        {formatDisplay}
      </div>

      {formatNote && (
        <div style={{ fontSize:11, color:"#888", background:"#0a0a0a", borderRadius:6, padding:"5px 10px",
          marginBottom:14, border:"1px solid #1a1a1a", display:"flex", alignItems:"center", gap:6 }}>
          <i className="fa-solid fa-circle-info" style={{ color:"#c9933a" }}></i>
          {formatNote}
        </div>
      )}

      {!isActive && (
        <div style={{ fontSize:11, color:"#f59e0b", background:"#78350f22", border:"1px solid #f59e0b44",
          borderRadius:6, padding:"5px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          Select a <strong>Product Type</strong> in Product Details to get the exact title format for that product.
        </div>
      )}

      {(sharedBrand || sharedCollection || sharedColour || sharedSize) && (
        <div style={{ fontSize:11, color:"#c9933a", background:"#c9933a11", border:"1px solid #c9933a33",
          borderRadius:6, padding:"5px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
          <i className="fa-solid fa-bolt"></i> Fields marked <b>AUTO</b> are synced from Product Details
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10 }}>
        {parts.map(p => (
          <Field key={p} label={p}>
            <div style={{ position:"relative" }}>
              <Input value={vals[p]||""} onChange={v => setVal(p, v)} placeholder={p}
                style={SHARED_MAP[p] && vals[p] === SHARED_MAP[p] ? { borderColor:"#c9933a55", paddingRight:52 } : {}} />
              {SHARED_MAP[p] && vals[p] === SHARED_MAP[p] && (
                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                  fontSize:8, color:"#c9933a", fontWeight:800, background:"#c9933a22",
                  borderRadius:3, padding:"1px 5px", pointerEvents:"none" }}>AUTO</span>
              )}
            </div>
          </Field>
        ))}
      </div>

      <div style={{ background:"#0d0d0d", borderRadius:8, padding:12, marginTop:10, border:"1px solid #333" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#c9933a", marginBottom:4 }}>
          <i className="fa-solid fa-star"></i> Product Specification <span style={{ color:"#555", fontWeight:400 }}>(optional — appended after title)</span>
        </div>
        <div style={{ fontSize:10, color:"#555", marginBottom:8 }}>
          Extra spec — e.g. "500 x 400mm", "4 Star WELS 7.5L/min", "PER BOX"
        </div>
        <Input value={productSpec} onChange={setProductSpec} placeholder="e.g. 500 x 400mm Basin" />
        {productSpec.trim() && (
          <div style={{ fontSize:10, color:"#c9933a", marginTop:4 }}>Will append: {productSpec.trim().toUpperCase()}</div>
        )}
      </div>

      <div style={{ background:"#0d0d0d", borderRadius:8, padding:12, marginTop:10, border:"1px solid #333" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#c9933a", marginBottom:4 }}>
          <i className="fa-solid fa-bars-staggered"></i> Product Attributes <span style={{ color:"#555", fontWeight:400 }}>(optional — appended at end)</span>
        </div>
        <div style={{ fontSize:10, color:"#555", marginBottom:8 }}>Select applicable attributes</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {PRODUCT_SPEC_TAGS.map(tag => (
            <div key={tag} onClick={() => toggleTag(tag)}
              style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all .15s",
                background: selectedTags.includes(tag) ? "#c9933a" : "#1a1a1a",
                color:      selectedTags.includes(tag) ? "#0a0a0a" : "#888",
                border:     `1px solid ${selectedTags.includes(tag) ? "#c9933a" : "#333"}` }}>
              {tag}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Input value={customTag} onChange={setCustomTag} placeholder="Add custom attribute..." style={{ flex:1 }} />
          <Btn onClick={addCustomTag} variant="ghost" small disabled={!customTag.trim()}>+ Add</Btn>
        </div>
        {selectedTags.length > 0 && (
          <div style={{ marginTop:10, background:"#111", borderRadius:6, padding:"8px 12px", border:"1px solid #222" }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>Selected</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {selectedTags.map(tag => (
                <div key={tag} style={{ display:"flex", alignItems:"center", gap:4,
                  background:"#c9933a22", border:"1px solid #c9933a44", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#c9933a" }}>
                  {tag}
                  <span onClick={() => toggleTag(tag)} style={{ cursor:"pointer", fontWeight:700, marginLeft:2 }}>×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background:"#1a1a1a", borderRadius:8, padding:12, marginTop:10, border:"1px solid #c9933a44" }}>
        <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>Generated Title Preview</div>
        <div style={{ fontSize:14, fontWeight:700, color:"#fff", wordBreak:"break-word" }}>
          {[...parts.map(p => vals[p]).filter(Boolean),
            ...(productSpec.trim() ? [productSpec.trim()] : []),
            ...(selectedTags.length > 0 ? [selectedTags.join(" ")] : []),
          ].join(" ").toUpperCase() || "— fill fields above —"}
        </div>
      </div>
    </div>
  );
}

// ─── DESCRIPTION BUILDER ──────────────────────────────────────────────────────
function DescriptionBuilder({ title, category, sharedColour, sharedSize, autoFilled }) {
  const { isMobile } = useResponsive();
  const fields = (DESCRIPTION_FEATURES[category] || DESCRIPTION_FEATURES.default);

  const [descMode, setDescMode]         = useState("manual");
  const [features, setFeatures]         = useState({});
  const [colours, setColours]           = useState("");
  const [sizes, setSizes]               = useState("");
  const [warrantyRows, setWarrantyRows] = useState(["5 years Product Warranty", "2 years Labour Warranty"]);
  const [aiModel, setAiModel]           = useState("gemini");
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiDesc, setAiDesc]             = useState("");
  const [aiDescAuto, setAiDescAuto]     = useState("");
  const [aiError, setAiError]           = useState("");
  const [aiNote, setAiNote]             = useState("");
  const [copied, setCopied]             = useState(false);
  const [images, setImages]             = useState([]);
  const [previews, setPreviews]         = useState([]);

  useEffect(() => { if (sharedColour) setColours(prev => prev || sharedColour); }, [sharedColour]);
  useEffect(() => { if (sharedSize)   setSizes(prev   => prev || sharedSize);   }, [sharedSize]);

  useEffect(() => {
    if (!autoFilled) return;
    if (autoFilled.colour)   setColours(autoFilled.colour);
    if (autoFilled.size)     setSizes(autoFilled.size);
    if (autoFilled.warranty) setWarrantyRows(prev => { const r = [...prev]; r[0] = autoFilled.warranty; return r; });
    const nf = {};
    if (autoFilled.material)   nf.material   = autoFilled.material;
    if (autoFilled.type)       nf.type        = autoFilled.type;
    if (autoFilled.wels)       nf.wels        = autoFilled.wels;
    if (autoFilled.flowRate)   nf.flowRate    = autoFilled.flowRate;
    if (autoFilled.mounting)   nf.mounting    = autoFilled.mounting;
    if (autoFilled.additional) nf.additional  = autoFilled.additional;
    if (Object.keys(nf).length > 0) setFeatures(prev => ({ ...prev, ...nf }));
    if (autoFilled.description) {
      setAiDescAuto(autoFilled.description);
      setAiDesc(autoFilled.description);
      setDescMode("auto");
    }
  }, [autoFilled]);

  const setFeature        = (k, v) => setFeatures(prev => ({ ...prev, [k]: v }));
  const addWarrantyRow    = ()      => setWarrantyRows(prev => [...prev, ""]);
  const removeWarrantyRow = (i)     => setWarrantyRows(prev => prev.filter((_, idx) => idx !== i));
  const updateWarrantyRow = (i, v)  => setWarrantyRows(prev => prev.map((r, idx) => idx === i ? v : r));

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 2);
    setImages(files); setPreviews(files.map(f => URL.createObjectURL(f)));
  };
  
  const removeImage = (i) => {
    setImages(prev   => prev.filter((_,idx)=>idx!==i));
    setPreviews(prev => prev.filter((_,idx)=>idx!==i));
  };

  const featureBlock = fields.map(f => `• ${FEATURE_LABELS[f] || f}: ${features[f] || ""}`).join("\n");
  const activeDesc   = aiDesc || "[Click Generate AI Description below]";
  const fullDescription =
  `**${(title || "PRODUCT TITLE").toUpperCase()}**
  Also Available in ${colours || "______"}
  ${sizes ? `Also Available in Sizes: ${sizes}` : ""}

  **Product Features:**
  ${featureBlock}

  **Warranty Information:**
  ${warrantyRows.filter(r => r.trim()).map(r => `• ${r.trim()}`).join("\n")}

  ${activeDesc}`.trim();

  const generateAI = async () => {
    setAiLoading(true); setAiError(""); setAiNote("");
    try {
      const fd = new FormData();
      fd.append("name",          title || "");
      fd.append("colours",       colours);
      fd.append("material",      features.material || "");
      fd.append("compatibility", features.compatible || "");
      fd.append("warranty",      warrantyRows.filter(r=>r.trim()).join(", ") || "");
      fd.append("category",      category || "");
      fd.append("model",         aiModel);
      images.forEach(img => fd.append("images", img));
      const { data } = await axios.post(`${API}/description/generate`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAiDesc(data.description);
      setDescMode("manual");
      if (data.note) setAiNote(data.note);
    } catch (e) { setAiError(e.response?.data?.error || "Generation failed — check API key in .env"); }
    setAiLoading(false);
  };

  const copyAll = () => { navigator.clipboard.writeText(fullDescription); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const MODEL_INFO = {
    gemini: { label:"Gemini 2.0 Flash",   info:"Gemini", tag:"Free · Supports images", color:"#4285f4" },
    groq:   { label:"Groq Llama 3.3 70B", info:"Groq",   tag:"Free · Text only · Very fast", color:"#f55036" },
  };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-file-pen"></i> Description Builder</SectionTitle>

      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:11, color:"#888", fontWeight:600 }}>MODE : </div>
        <div style={{ display:"flex", background:"#0d0d0d", borderRadius:8, padding:3, border:"1px solid #333", gap:3 }}>
          {[
            { key:"auto",   label:"Auto", hint:"Filled from URL scrape" },
            { key:"manual", label:"Manual", hint:"Fill & generate below" },
          ].map(m => (
            <button key={m.key} onClick={() => setDescMode(m.key)} title={m.hint}
              style={{
                background: descMode===m.key ? "#c9933a" : "transparent",
                color:      descMode===m.key ? "#000"    : "#666",
                border:     "none", borderRadius:6, padding:"5px 14px",
                fontSize:11, fontWeight:700, cursor:"pointer", transition:"all .15s",
              }}>
              {m.label}
            </button>
          ))}
        </div>
        {descMode==="auto" && aiDescAuto && (
          <span style={{ fontSize:10, color:"#16a34a", background:"#14532d22", borderRadius:4, padding:"2px 8px", border:"1px solid #16a34a33" }}>
            AI-generated from supplier URL
          </span>
        )}
        {descMode==="auto" && !aiDescAuto && (
          <span style={{ fontSize:10, color:"#f59e0b" }}>
            No auto description yet — use Auto-Fill from URL first
          </span>
        )}
      </div>

      {descMode === "auto" && (
        <div style={{ background:"#0a140a", border:"2px solid #16a34a44", borderRadius:10, padding:16, marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#16a34a", display:"flex", alignItems:"center", gap:8 }}>
              <i className="fa-solid fa-arrows-rotate"></i>
              Auto-Generated Description
            </div>
            <span style={{ fontSize:10, color:"#555" }}>From supplier URL · Review and edit if needed</span>
          </div>
          {aiDescAuto ? (
            <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)}
              style={{ width:"100%", background:"#111", border:"1px solid #16a34a33", borderRadius:8,
                padding:10, color:"#ddd", fontSize:13, lineHeight:1.7, minHeight:100,
                resize:"vertical", boxSizing:"border-box" }} />
          ) : (
            <div style={{ color:"#555", fontSize:13, textAlign:"center", padding:"20px 0" }}>
              <i className="fa-solid fa-circle-info"></i>{" "}
              Auto-fill from URL first to get an AI-generated description here
            </div>
          )}
          {aiDescAuto && (
            <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:11, color:"#555" }}>{aiDesc ? aiDesc.split(/\s+/).length : 0} words</span>
              <button onClick={() => { setAiDesc(aiDescAuto); }}
                style={{ fontSize:10, background:"transparent", border:"1px solid #333", borderRadius:4,
                  color:"#666", cursor:"pointer", padding:"2px 8px" }}>
                Reset to original
              </button>
            </div>
          )}
        </div>
      )}

      {descMode === "manual" && (
        <>
          {(sharedColour || sharedSize) && !autoFilled && (
            <div style={{ fontSize:11, color:"#c9933a", background:"#c9933a11", border:"1px solid #c9933a33",
              borderRadius:6, padding:"5px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              <i className="fa-solid fa-bolt"></i> Colour and Size pre-filled from Product Details
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10, marginBottom:14 }}>
            <Field label="Available in Colours">
              <div style={{ position:"relative" }}>
                <Input value={colours} onChange={setColours} placeholder="Chrome, Black, Gold"
                  style={sharedColour && colours === sharedColour ? { borderColor:"#c9933a55", paddingRight:52 } : {}} />
                {sharedColour && colours === sharedColour && (
                  <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                    fontSize:8, color:"#c9933a", fontWeight:800, background:"#c9933a22",
                    borderRadius:3, padding:"1px 5px", pointerEvents:"none" }}>AUTO</span>
                )}
              </div>
            </Field>
            <Field label="Available in Sizes (if applicable)">
              <div style={{ position:"relative" }}>
                <Input value={sizes} onChange={setSizes} placeholder="600mm, 750mm, 900mm"
                  style={sharedSize && sizes === sharedSize ? { borderColor:"#c9933a55", paddingRight:52 } : {}} />
                {sharedSize && sizes === sharedSize && (
                  <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                    fontSize:8, color:"#c9933a", fontWeight:800, background:"#c9933a22",
                    borderRadius:3, padding:"1px 5px", pointerEvents:"none" }}>AUTO</span>
                )}
              </div>
            </Field>
          </div>

          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10, marginBottom:14 }}>
            {fields.map(f => (
              <Field key={f} label={FEATURE_LABELS[f] || f}>
                <Input value={features[f]||""} onChange={v=>setFeature(f,v)} placeholder={FEATURE_LABELS[f] || f} />
              </Field>
            ))}
          </div>

          <div style={{ background:"#0d0d0d", borderRadius:10, padding:14, marginBottom:14, border:"1px solid #333" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#c9933a" }}>
                <i className="fa-solid fa-shield-halved"></i> Warranty Information
              </div>
              <Btn onClick={addWarrantyRow} variant="ghost" small>+ Add Row</Btn>
            </div>
            <div style={{ fontSize:10, color:"#555", marginBottom:10 }}>
              Type the full warranty line — e.g. "15 Year Product or Parts Warranty"
            </div>
            {warrantyRows.map((row, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 32px", gap:8, marginBottom:8, alignItems:"center" }}>
                <Input value={row} onChange={v => updateWarrantyRow(i, v)}
                  placeholder={i===0 ? "e.g. 15 Year Product or Parts Warranty" : i===1 ? "e.g. 1 Year Labour Warranty" : "e.g. Lifetime Stainless Steel 316 Warranty"} />
                <button onClick={() => removeWarrantyRow(i)}
                  style={{ background:"#7f1d1d44", border:"1px solid #7f1d1d", borderRadius:6,
                    color:"#ef4444", cursor:"pointer", fontSize:14, height:36, width:32 }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
            {warrantyRows.some(r => r.trim()) && (
              <div style={{ marginTop:10, background:"#111", borderRadius:6, padding:"8px 12px", border:"1px solid #222" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Preview</div>
                {warrantyRows.filter(r => r.trim()).map((r, i) => (
                  <div key={i} style={{ fontSize:12, color:"#ccc" }}>• {r.trim()}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background:"#0d0d0d", borderRadius:10, padding:14, marginBottom:14, border:"1px solid #333" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#c9933a", marginBottom:12 }}>
              <i className="fa-solid fa-microchip"></i> AI Description (75 words)
            </div>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:8, marginBottom:12 }}>
              {Object.entries(MODEL_INFO).map(([key, info]) => (
                <div key={key} onClick={() => setAiModel(key)}
                  style={{ border:`1px solid ${aiModel===key?info.color:"#333"}`, borderRadius:8,
                    padding:"10px 12px", cursor:"pointer",
                    background: aiModel===key ? `${info.color}11` : "#111", transition:"all .15s" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:aiModel===key?info.color:"#888" }}>{info.label}</div>
                  <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{info.tag}</div>
                </div>
              ))}
            </div>

            {aiModel === "gemini" && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>Upload 1-2 product images (optional) — Gemini analyses them visually</div>
                <label style={{ display:"inline-block", padding:"7px 14px", borderRadius:8, fontSize:12,
                  fontWeight:600, background:"#1a1a1a", border:"1px dashed #444", color:"#aaa", cursor:"pointer" }}>
                  <i className="fa-solid fa-paperclip"></i> Choose Images (max 2)
                  <input type="file" accept="image/*" multiple onChange={handleImages} style={{ display:"none" }} />
                </label>
                {previews.length > 0 && (
                  <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
                    {previews.map((src, i) => (
                      <div key={i} style={{ position:"relative" }}>
                        <img src={src} alt={`preview-${i}`}
                          style={{ width:72, height:72, objectFit:"cover", borderRadius:6, border:"1px solid #333" }} />
                        <button onClick={() => removeImage(i)}
                          style={{ position:"absolute", top:-6, right:-6, background:"#ef4444", border:"none",
                            borderRadius:"50%", width:18, height:18, color:"#fff", fontSize:10,
                            cursor:"pointer", lineHeight:"18px", textAlign:"center" }}>×</button>
                      </div>
                    ))}
                    <span style={{ fontSize:11, color:"#555" }}>{previews.length} image{previews.length>1?"s":""} ready</span>
                  </div>
                )}
              </div>
            )}

            {aiModel === "groq" && (
              <div style={{ fontSize:11, color:"#666", marginBottom:10, padding:"6px 10px",
                background:"#111", borderRadius:6, border:"1px solid #222" }}>
                Groq is text-only — image upload not supported. Switch to Gemini for image analysis.
              </div>
            )}

            <Btn onClick={generateAI} disabled={aiLoading}>
              {aiLoading ? `Generating with ${MODEL_INFO[aiModel].info}...` : `Generate with ${MODEL_INFO[aiModel].info}`}
            </Btn>

            {aiError && (
              <div style={{ color:"#ef4444", fontSize:12, marginTop:8, padding:"8px 12px",
                background:"#7f1d1d22", borderRadius:6, border:"1px solid #ef444433" }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {aiError}
              </div>
            )}
            {aiNote && <div style={{ color:"#f59e0b", fontSize:11, marginTop:6 }}>ℹ {aiNote}</div>}

            {aiDesc && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>
                  Generated ({aiDesc.split(/\s+/).length} words) — edit if needed:
                </div>
                <textarea value={aiDesc} onChange={e=>setAiDesc(e.target.value)}
                  style={{ width:"100%", background:"#1a1a1a", border:"1px solid #333", borderRadius:8,
                    padding:10, color:"#ddd", fontSize:13, lineHeight:1.6, minHeight:100,
                    resize:"vertical", boxSizing:"border-box" }} />
              </div>
            )}
            <div style={{ fontSize:11, color:"#444", marginTop:8 }}>
              Both models 100% free · Gemini: aistudio.google.com · Groq: console.groq.com
            </div>
          </div>
        </>
      )}

      <div style={{ background:"#0a0a0a", borderRadius:10, padding:14, border:"1px solid #222" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#888" }}>Full Description Preview</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {descMode==="auto" && (
              <span style={{ fontSize:10, color:"#16a34a", background:"#14532d22", borderRadius:4, padding:"2px 8px", border:"1px solid #16a34a33" }}>AUTO</span>
            )}
            <Btn onClick={copyAll} variant={copied?"success":"ghost"} small>
              {copied ? <><i className="fa-solid fa-check"></i> Copied!</> : <><i className="fa-regular fa-copy"></i> Copy All</>}
            </Btn>
          </div>
        </div>
        <pre style={{ color:"#ccc", fontSize:12, lineHeight:1.7, whiteSpace:"pre-wrap", margin:0, fontFamily:"inherit", wordBreak:"break-word" }}>
          {fullDescription}
        </pre>
      </div>
    </div>
  );
}

// ─── TAGS & METAFIELDS ────────────────────────────────────────────────────────
function TagsPanel({ productType, category, brand, colour, size, style: pStyle }) {
  const { isMobile } = useResponsive();
  const spec         = productType ? PRODUCT_TAG_MAP_FE[productType] : null;
  const schema       = spec ? SCHEMAS_FE[spec.schema] || [] : [];
  const extraFields  = spec ? spec.extraFields || [] : [];
  const schemaFields = [...new Set([...schema, ...extraFields])];

  const [localVals, setLocalVals] = useState({ style:"", configuration:"", size: size||"", shape:"", finish:"" });
  const [copied, setCopied]       = useState("");

  useEffect(() => { setLocalVals(prev => ({ ...prev, style: pStyle||"" })); }, [pStyle]);
  useEffect(() => { setLocalVals(prev => ({ ...prev, size:  size ||"" })); }, [size]);
  useEffect(() => { setLocalVals({ style: pStyle||"", configuration:"", size: size||"", shape:"", finish:"" }); }, [productType]);

  const setLocal = (k, v) => setLocalVals(prev => ({ ...prev, [k]: v }));

  const tags = spec
    ? buildTagsFromSchema(productType, { ...localVals, brand, colour })
    : [category, brand, colour, pStyle,
       colour ? `Colour_${colour}` : "", brand  ? `Brand_${brand}`  : "",
       pStyle ? `Style_${pStyle}`  : "", size   ? `Size_${size}`    : ""]
        .filter(Boolean).filter((v,i,a) => a.indexOf(v)===i);

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(""),1500); };

  const metafields = { Brand: brand, Colour: colour, Size: size, Style: pStyle, Collections: spec ? spec.collection : category };

  const tagColor = (tag) => {
    if (tag.startsWith("Collections_"))   return "#c9933a";
    if (tag.startsWith("Brand_"))         return "#60a5fa";
    if (tag.startsWith("Colour_"))        return "#a78bfa";
    if (tag.startsWith("Style_"))         return "#34d399";
    if (tag.startsWith("Configuration_")) return "#fb923c";
    if (tag.startsWith("Size_"))          return "#f472b6";
    if (tag.startsWith("Shape_"))         return "#38bdf8";
    if (tag.startsWith("Finish_"))        return "#a3e635";
    return "#ccc";
  };

  const renderField = (fieldKey) => {
    const def        = TAG_FIELD_DEFS[fieldKey];
    const opts       = spec?.[`${fieldKey}Options`] || [];
    const val        = localVals[fieldKey] || "";
    const isAuto     = (fieldKey==="size" && val===size) || (fieldKey==="style" && val===pStyle);
    return (
      <Field key={fieldKey} label={def.label}>
        {opts.length > 0
          ? <Select value={val} onChange={v=>setLocal(fieldKey,v)} options={opts} placeholder={`Select ${def.label}...`} />
          : <div style={{ position:"relative" }}>
              <Input value={val} onChange={v=>setLocal(fieldKey,v)} placeholder={def.label}
                style={isAuto ? { borderColor:"#c9933a55", paddingRight:52 } : {}} />
              {isAuto && <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                fontSize:8, color:"#c9933a", fontWeight:800, background:"#c9933a22",
                borderRadius:3, padding:"1px 5px", pointerEvents:"none" }}>AUTO</span>}
            </div>}
        <div style={{ fontSize:10, color:tagColor(`${def.prefix}x`), marginTop:3 }}>→ {def.prefix}{val||"…"}</div>
      </Field>
    );
  };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-tags"></i> Tags & Metafields</SectionTitle>

      {spec
        ? <div style={{ fontSize:11, color:"#16a34a", background:"#14532d22", border:"1px solid #16a34a44", borderRadius:6,
            padding:"6px 10px", marginBottom:14, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <i className="fa-solid fa-circle-check"></i> Tag schema loaded for <strong>{productType}</strong>
            {spec.noBrand && <span style={{ color:"#f59e0b", marginLeft:6, fontWeight:700 }}>· Brand_ omitted (tiles)</span>}
          </div>
        : <div style={{ fontSize:11, color:"#f59e0b", background:"#78350f22", border:"1px solid #f59e0b44",
            borderRadius:6, padding:"6px 10px", marginBottom:14 }}>
            <i className="fa-solid fa-triangle-exclamation"></i>{" "}
            Select a <strong>Product Type</strong> to load the precise tag structure.
          </div>}

      {spec && schemaFields.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10, marginBottom:14 }}>
          {schemaFields.map(fk => renderField(fk))}
        </div>
      )}

      <Field label="Generated Tags (paste into Shopify)">
        <div style={{ background:"#0d0d0d", borderRadius:8, padding:10, border:"1px solid #333" }}>
          {tags.length > 0
            ? <>
                <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                  {tags.map((tag,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                      background:"#111", borderRadius:6, padding:"5px 10px", border:"1px solid #1a1a1a" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:tagColor(tag), fontFamily:"monospace", wordBreak:"break-all" }}>{tag}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:"#444", marginBottom:8, wordBreak:"break-all" }}>{tags.join(", ")}</div>
              </>
            : <div style={{ color:"#444", fontSize:12, marginBottom:8 }}>— fill Brand and Colour to generate tags —</div>}
          <Btn onClick={() => copy(tags.join(", "), "tags")} variant="ghost" small>
            {copied==="tags" ? <><i className="fa-solid fa-check"></i> Copied!</> : <><i className="fa-regular fa-copy"></i> Copy Tags</>}
          </Btn>
        </div>
      </Field>

      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14,
        background:"#0a0a0a", borderRadius:8, padding:"8px 12px", border:"1px solid #1a1a1a" }}>
        {[["Collections_","#c9933a"],["Style_","#34d399"],["Config_","#fb923c"],
          ["Size_","#f472b6"],["Shape_","#38bdf8"],["Finish_","#a3e635"],
          ["Brand_","#60a5fa"],["Colour_","#a78bfa"]].map(([p,c]) => (
          <span key={p} style={{ fontSize:9, fontWeight:700, color:c, fontFamily:"monospace" }}>{p}</span>
        ))}
      </div>

      <Field label="Metafields">
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap:8 }}>
          {Object.entries(metafields).map(([k,v]) => (
            <div key={k} style={{ background:"#0d0d0d", borderRadius:8, padding:"8px 12px", border:"1px solid #222" }}>
              <div style={{ fontSize:10, color:"#666", marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, color: v?"#fff":"#444", wordBreak:"break-word" }}>{v||"—"}</div>
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─── REPRICE CALCULATOR ───────────────────────────────────────────────────────
function RepriceCalculator() {
  const { isMobile } = useResponsive();
  const [cp,setCp]=useState(""); const [rrp,setRrp]=useState(""); const [currentSP,setCurrentSP]=useState("");
  const [minMargin,setMinMargin]=useState(""); const [c1,setC1]=useState(""); const [c2,setC2]=useState("");
  const [result,setResult]=useState(null); const [loading,setLoading]=useState(false);

  const calculate = async () => {
    if (!cp || !minMargin) return;
    setLoading(true);
    const competitors = [c1,c2].filter(Boolean).map(Number);
    try {
      const { data } = await axios.post(`${API}/export/reprice`, { cp:+cp, rrp:rrp?+rrp:null, currentSP:+currentSP, minMargin:+minMargin, competitorPrices:competitors });
      setResult(data);
    } catch {
      const results = competitors.map((price,i) => {
        const pot=price-+cp; const can=pot>=+minMargin;
        const newSP=can?(rrp?Math.min(price,+rrp):price):Math.round(+cp+ +minMargin);
        return { competitor:i+1, competitorPrice:price, potentialMargin:+pot.toFixed(2), canReprice:can, newSP:Math.round(newSP),
          reason: can ? `Potential margin $${pot.toFixed(2)} >= min margin $${minMargin}` : `Margin too low — use CP + min margin` };
      });
      const valid=results.filter(r=>r.canReprice).map(r=>r.newSP);
      const recommendedSP=valid.length>0?Math.min(...valid):Math.round(+cp+ (+minMargin||0));
      setResult({ cp:+cp, rrp:rrp?+rrp:null, currentSP:+currentSP, minMargin:+minMargin,
        results, recommendedSP, saving:currentSP?Math.round(+currentSP-recommendedSP):0 });
    }
    setLoading(false);
  };

  return (
    <Card>
      <SectionTitle><i className="fa-solid fa-square-root-variable"></i> Competitive Repricing Calculator</SectionTitle>
      <div style={{ fontSize:11, color:"#666", marginBottom:14, padding:"6px 10px", background:"#0d0d0d", borderRadius:6 }}>
        From Special Guidelines: Potential Margin = Competitor Price - Cost Price (inc GST)
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:12 }}>
        <Field label="Cost Price (inc GST)"><Input value={cp} onChange={setCp} placeholder="220.00" type="number" /></Field>
        <Field label="RRP (optional)"><Input value={rrp} onChange={setRrp} placeholder="350.00" type="number" /></Field>
        <Field label="Current SP"><Input value={currentSP} onChange={setCurrentSP} placeholder="350.00" type="number" /></Field>
        <Field label="Min Margin for Category"><Input value={minMargin} onChange={setMinMargin} placeholder="e.g. 65 for Basins" type="number" /></Field>
        <Field label="Competitor 1 Price"><Input value={c1} onChange={setC1} placeholder="315.00" type="number" /></Field>
        <Field label="Competitor 2 Price"><Input value={c2} onChange={setC2} placeholder="299.00" type="number" /></Field>
      </div>
      <Btn onClick={calculate} disabled={loading||!cp||!minMargin}>{loading?"Calculating...":"Calculate Reprice"}</Btn>
      {result && (
        <div style={{ marginTop:16 }}>
          {result.results.map(r => (
            <div key={r.competitor} style={{ background:"#0d0d0d", borderRadius:8, padding:14, marginBottom:8,
              border:`1px solid ${r.canReprice?"#16a34a44":"#ef444433"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, flexWrap:"wrap", gap:8 }}>
                <span style={{ fontWeight:700, color:"#fff" }}>Competitor {r.competitor} — ${r.competitorPrice}</span>
                <Badge ok={r.canReprice}>{r.canReprice?"✓ Can Reprice":"✗ Cannot Match"}</Badge>
              </div>
              <div style={{ fontSize:12, color:"#888" }}>{r.reason}</div>
              <div style={{ fontSize:13, color:"#c9933a", fontWeight:700, marginTop:4 }}>New SP → ${r.newSP}</div>
            </div>
          ))}
          <div style={{ background:"#c9933a22", border:"1px solid #c9933a44", borderRadius:8, padding:14, marginTop:8 }}>
            <div style={{ fontSize:12, color:"#c9933a", fontWeight:700, marginBottom:4 }}>Recommended Final SP</div>
            <div style={{ fontSize:28, fontWeight:900, color:"#c9933a" }}>${result.recommendedSP}</div>
            {result.saving>0 && <div style={{ fontSize:12, color:"#888", marginTop:4 }}>Price reduction from current: ${result.saving}</div>}
            {result.rrp && result.recommendedSP>result.rrp && (
              <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Exceeds RRP ${result.rrp} — needs senior approval
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── PRODUCT LIST ─────────────────────────────────────────────────────────────
function ProductList({ products, onDelete, onExportXlsx, onExportCSV }) {
  const { isMobile } = useResponsive();
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Product Queue ({products.length})</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn onClick={onExportCSV}  variant="primary" disabled={products.length===0}><i className="fa-solid fa-cloud-arrow-down"></i>{!isMobile && " Shopify Import CSV"}</Btn>
          <Btn onClick={onExportXlsx} variant="success" disabled={products.length===0}><i className="fa-solid fa-cloud-arrow-down"></i>{!isMobile && " Final Pricing + Competitor (.xlsx)"}</Btn>
        </div>
      </div>
      <div style={{ background:"#0d0d0d", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:11, color:"#666", border:"1px solid #1a1a1a" }}>
        <span style={{ color:"#c9933a", fontWeight:700 }}>Shopify Import CSV</span> — exact 7-column format &nbsp;·&nbsp;
        <span style={{ color:"#16a34a", fontWeight:700 }}>Final Pricing .xlsx</span> — 3 sheets: Final Pricing + Competitor Analysis + Pricing Reference
      </div>
      {products.length===0 && (
        <div style={{ textAlign:"center", color:"#555", padding:40, background:"#0d0d0d", borderRadius:10 }}>
          No products in queue yet — add products using the Add Product tab
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {products.map((p,i) => (
          <div key={p._id||i} style={{ background:"#111", border:"1px solid #222", borderRadius:10,
            padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
            <div style={{ flex:1, minWidth: isMobile ? "100%" : 200 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:2, wordBreak:"break-word" }}>{p.productTitle||p.sku}</div>
              <div style={{ fontSize:11, color:"#888" }}>{p.category} · {p.brand} · SKU: {p.sku}</div>
            </div>
            <div style={{ display:"flex", gap: isMobile ? 10 : 16, alignItems:"center", flexWrap:"wrap" }}>
              {[{label:"CP (inc GST)",val:p.cpGST?`$${p.cpGST}`:"—"},{label:"SP",val:p.sp?`$${p.sp}`:"—",gold:true},
                {label:"RRP",val:p.rrp?`$${p.rrp}`:"—"},{label:"Weight",val:p.weight?`${p.weight}kg`:"—"}].map(({label,val,gold})=>(
                <div key={label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#555" }}>{label}</div>
                  <div style={{ fontSize:gold?16:13, fontWeight:gold?800:400, color:gold?"#c9933a":"#aaa" }}>{val}</div>
                </div>
              ))}
              <Badge ok={p.marginOk}>{p.marginOk?<><i className="fa-solid fa-check"></i> Margin</>:<><i className="fa-solid fa-xmark"></i> Margin</>}</Badge>
              <Btn onClick={() => onDelete(p._id||i)} variant="danger" small><i className="fa-solid fa-xmark"></i></Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { isMobile, isTablet }                  = useResponsive();
  const [tab, setTab]                           = useState("form");
  const [products, setProducts]                 = useState([]);
  const [saving, setSaving]                     = useState(false);
  const [saveMsg, setSaveMsg]                   = useState("");

  const [sharedBrand,      setSharedBrand]      = useState("");
  const [sharedCollection, setSharedCollection] = useState("");
  const [sharedColour,     setSharedColour]     = useState("");
  const [sharedSize,       setSharedSize]       = useState("");

  const [supplierUrl,    setSupplierUrl]        = useState("");
  const [sku,            setSku]                = useState("");
  const [category,       setCategory]           = useState("");
  const [productType,    setProductType]        = useState("");
  const [style,          setStyle]              = useState("");
  const [generatedTitle, setGeneratedTitle]     = useState("");
  const [pricing,        setPricing]            = useState(null);
  const [notes,          setNotes]              = useState("");

  const [autoFilled,       setAutoFilled]       = useState(null);
  const [autoFilledRrp,    setAutoFilledRrp]    = useState(null);
  const [autoFilledRrpGST, setAutoFilledRrpGST] = useState(true);
  const [autoFilling,      setAutoFilling]      = useState(false);
  const [autoFillMsg,      setAutoFillMsg]      = useState("");
  const [autoFillPreview,  setAutoFillPreview]  = useState(null);

  // Mobile: track which column/section is active
  const [mobileSection, setMobileSection]       = useState("details"); // details | title | pricing | description | tags

  useEffect(() => {
    axios.get(`${API}/products`).then(r => setProducts(r.data)).catch(() => {});
  }, []);

  useEffect(() => { setProductType(""); }, [category]);

  const handleAutoFill = async () => {
    if (!supplierUrl) { setAutoFillMsg("warn|Enter a Supplier URL first"); return; }
    setAutoFilling(true); setAutoFillMsg(""); setAutoFillPreview(null);
    setAutoFilled(null); setAutoFilledRrp(null);
    try {
      const { data } = await axios.post(`${API}/description/fetch-from-url`, { supplierUrl, category: category||"" });
      if (data.brand)      setSharedBrand(data.brand);
      if (data.collection) setSharedCollection(data.collection);
      if (data.colour)     setSharedColour(data.colour);
      if (data.size)       setSharedSize(data.size);
      if (data.rrp)        { setAutoFilledRrp(data.rrp); setAutoFilledRrpGST(data.rrpIncludesGST!==false); }
      setAutoFilled(data);
      setAutoFillPreview({ name:data.name, brand:data.brand, collection:data.collection, colour:data.colour,
        size:data.size, rrp:data.rrp, confidence:data.confidence, imageUrls:data.imageUrls||[], scrapedOk:data.scrapedOk });
      const conf=data.confidence||"medium"; const src=data.scrapedOk?"page scraped":"URL-based estimate";
      setAutoFillMsg(conf==="high"?`success|✓ All fields auto-filled (${src} · high confidence)`:
        conf==="medium"?`warn|✓ Fields filled (${src} · medium confidence) — review carefully`:
        `warn|⚠ Low confidence (${src}) — verify all fields manually`);
    } catch (err) {
      setAutoFillMsg(`error|❌ ${err.response?.data?.error||"Auto-fill failed — fill fields manually"}`);
    }
    setAutoFilling(false);
  };

  const [msgType,msgText]=autoFillMsg.includes("|")?autoFillMsg.split("|"):["info",autoFillMsg];
  const msgColor=msgType==="success"?"#16a34a":msgType==="error"?"#ef4444":"#f59e0b";
  const msgBg=msgType==="success"?"#14532d22":msgType==="error"?"#7f1d1d22":"#78350f22";
  const msgBorder=msgType==="success"?"#16a34a44":msgType==="error"?"#ef444433":"#f59e0b44";

  const saveProduct = async () => {
    if (!sku||!category) { setSaveMsg("SKU and Category are required"); return; }
    setSaving(true);
    const payload = { supplierUrl, sku, productTitle:generatedTitle, category, productType,
      brand:sharedBrand, collection:sharedCollection, colour:sharedColour, size:sharedSize, style,
      cpGST:pricing?.cp, rrp:pricing?.rrp, sp:pricing?.sp, weight:pricing?.weight,
      marginOk:pricing?.marginOk, requiredMargin:pricing?.required, notes, status:"draft" };
    try {
      const { data } = await axios.post(`${API}/products`, payload);
      setProducts(prev => [data,...prev]); setSaveMsg("✓ Product saved to queue");
    } catch {
      setProducts(prev => [{...payload,_id:Date.now()},...prev]); setSaveMsg("✓ Saved locally (DB offline)");
    }
    setTimeout(()=>setSaveMsg(""),3000); setSaving(false);
  };

  const deleteProduct = async (id) => {
    try { await axios.delete(`${API}/products/${id}`); } catch {}
    setProducts(prev => prev.filter(p => p._id!==id));
  };

  const exportCSV = async () => {
    try {
      const res = await axios.post(`${API}/export/shopify-csv`,{products},{responseType:"blob"});
      const url=URL.createObjectURL(res.data); const a=document.createElement("a"); a.href=url;
      a.download=`Austpek_Shopify_Import_${Date.now()}.csv`; a.click();
    } catch {
      const headers=["Title","Variant SKU","Variant Grams","Variant Price","Variant Compare At Price","Supplier URL (product.metafields.custom.supplier_url)","Cost per item"];
      const rows=products.map(p=>[p.productTitle||"",p.sku||"",p.weight?Math.round(+p.weight*1000):"",
        p.sp?`$${Math.round(p.sp)}.00`:"",p.rrp?`$${Math.round(p.rrp)}.00`:"",p.supplierUrl||"",p.cpGST?`$${Math.round(p.cpGST)}.00`:""]);
      const csv=[headers,...rows].map(r=>r.join(",")).join("\r\n");
      const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download="Austpek_Shopify_Import.csv"; a.click();
    }
  };

  const exportXlsx = async () => {
    try {
      const res = await axios.post(`${API}/export/xlsx`,{products},{responseType:"blob"});
      const url=URL.createObjectURL(res.data); const a=document.createElement("a"); a.href=url;
      a.download=`Austpek_Final_Pricing_${Date.now()}.xlsx`; a.click();
    } catch { alert("Export failed — make sure backend is running"); }
  };

  const NAV=[
    { key:"form",    label: isMobile ? "Add" : <><i className="fa-solid fa-plus"></i> Add Product</> },
    { key:"queue",   label: isMobile ? `Queue (${products.length})` : <><i className="fa-solid fa-list"></i> Queue [ {products.length} ]</> },
    { key:"reprice", label: isMobile ? "Reprice" : <><i className="fa-solid fa-coins"></i> Reprice Tool <i className="fa-solid fa-angle-right"></i></> },
  ];

  // Mobile section nav for the form tab
  const MOBILE_SECTIONS = [
    { key:"details",     label:"Details"  },
    { key:"title",       label:"Title"    },
    { key:"pricing",     label:"Pricing"  },
    { key:"description", label:"Desc"     },
    { key:"tags",        label:"Tags"     },
  ];

  const isSingleCol = isMobile || isTablet;

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#fff", fontFamily:"system-ui,sans-serif" }}>
      {/* HEADER */}
      <div style={{ background:"#0d0d0d", borderBottom:"1px solid #1a1a1a", padding: isMobile ? "0 12px" : "0 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between", height: isMobile ? 48 : 56, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 12 }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight:900, color:"#c9933a", letterSpacing:1 }}>AUSTPEK</div>
          {!isMobile && <div style={{ fontSize:12, color:"#555", marginTop:2 }}><i className="fa-solid fa-box-open"></i> Product Listing Tool</div>}
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {NAV.map(n=>(
            <button key={n.key} onClick={()=>setTab(n.key)}
              style={{ background:tab===n.key?"#c9933a22":"transparent", border:tab===n.key?"1px solid #c9933a44":"1px solid transparent",
                borderRadius:8, padding: isMobile ? "5px 10px" : "6px 16px", color:tab===n.key?"#c9933a":"#888",
                fontSize: isMobile ? 12 : 13, fontWeight:600, cursor:"pointer" }}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding: isMobile ? "12px 10px" : "24px 16px" }}>

        {/* ADD PRODUCT */}
        {tab==="form" && (
          <>
            {/* Mobile section tabs */}
            {isSingleCol && (
              <div style={{ display:"flex", gap:4, marginBottom:14, overflowX:"auto", paddingBottom:4,
                scrollbarWidth:"none", msOverflowStyle:"none" }}>
                {MOBILE_SECTIONS.map(s => (
                  <button key={s.key} onClick={()=>setMobileSection(s.key)}
                    style={{ background: mobileSection===s.key ? "#c9933a" : "#1a1a1a",
                      color:   mobileSection===s.key ? "#000"    : "#888",
                      border:  `1px solid ${mobileSection===s.key ? "#c9933a" : "#333"}`,
                      borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700,
                      cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop: 2-column layout */}
            {!isSingleCol && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                {/* LEFT COLUMN */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <Card>
                    <ProductDetailsSection
                      supplierUrl={supplierUrl} setSupplierUrl={setSupplierUrl}
                      sku={sku} setSku={setSku}
                      category={category} setCategory={setCategory}
                      productType={productType} setProductType={setProductType}
                      sharedBrand={sharedBrand} setSharedBrand={setSharedBrand}
                      sharedCollection={sharedCollection} setSharedCollection={setSharedCollection}
                      sharedColour={sharedColour} setSharedColour={setSharedColour}
                      sharedSize={sharedSize} setSharedSize={setSharedSize}
                      style={style} setStyle={setStyle}
                      notes={notes} setNotes={setNotes}
                      autoFilling={autoFilling} autoFillMsg={autoFillMsg}
                      autoFillPreview={autoFillPreview} handleAutoFill={handleAutoFill}
                      msgType={msgType} msgText={msgText} msgColor={msgColor} msgBg={msgBg} msgBorder={msgBorder}
                    />
                  </Card>
                  {(category||productType) && (
                    <Card>
                      <TagsPanel productType={productType} category={category} brand={sharedBrand}
                        colour={sharedColour} size={sharedSize} style={style} />
                    </Card>
                  )}
                </div>
                {/* RIGHT COLUMN */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {(category||productType) && (
                    <Card>
                      <TitleBuilder category={category} productType={productType} onChange={setGeneratedTitle}
                        sharedBrand={sharedBrand} sharedCollection={sharedCollection}
                        sharedColour={sharedColour} sharedSize={sharedSize} />
                    </Card>
                  )}
                  <Card>
                    <PricingPanel category={category} brand={sharedBrand} supplierUrl={supplierUrl} sku={sku}
                      onResult={setPricing} autoRrp={autoFilledRrp} autoRrpIncludesGST={autoFilledRrpGST} />
                  </Card>
                  {category && (
                    <Card>
                      <DescriptionBuilder title={generatedTitle} category={category}
                        sharedColour={sharedColour} sharedSize={sharedSize} autoFilled={autoFilled} />
                    </Card>
                  )}
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <Btn onClick={saveProduct} disabled={saving} variant="primary">
                      {saving?"Saving...":<><i className="fa-solid fa-floppy-disk"></i> Save to Queue</>}
                    </Btn>
                    {saveMsg && (
                      <span style={{ fontSize:13, color:saveMsg.includes("✓")?"#16a34a":"#ef4444" }}>{saveMsg}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile/Tablet: single column, section-by-section */}
            {isSingleCol && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {mobileSection === "details" && (
                  <Card>
                    <ProductDetailsSection
                      supplierUrl={supplierUrl} setSupplierUrl={setSupplierUrl}
                      sku={sku} setSku={setSku}
                      category={category} setCategory={setCategory}
                      productType={productType} setProductType={setProductType}
                      sharedBrand={sharedBrand} setSharedBrand={setSharedBrand}
                      sharedCollection={sharedCollection} setSharedCollection={setSharedCollection}
                      sharedColour={sharedColour} setSharedColour={setSharedColour}
                      sharedSize={sharedSize} setSharedSize={setSharedSize}
                      style={style} setStyle={setStyle}
                      notes={notes} setNotes={setNotes}
                      autoFilling={autoFilling} autoFillMsg={autoFillMsg}
                      autoFillPreview={autoFillPreview} handleAutoFill={handleAutoFill}
                      msgType={msgType} msgText={msgText} msgColor={msgColor} msgBg={msgBg} msgBorder={msgBorder}
                    />
                  </Card>
                )}
                {mobileSection === "title" && (
                  <Card>
                    {(category||productType)
                      ? <TitleBuilder category={category} productType={productType} onChange={setGeneratedTitle}
                          sharedBrand={sharedBrand} sharedCollection={sharedCollection}
                          sharedColour={sharedColour} sharedSize={sharedSize} />
                      : <div style={{ color:"#555", textAlign:"center", padding:20 }}>Select a Category first</div>}
                  </Card>
                )}
                {mobileSection === "pricing" && (
                  <Card>
                    <PricingPanel category={category} brand={sharedBrand} supplierUrl={supplierUrl} sku={sku}
                      onResult={setPricing} autoRrp={autoFilledRrp} autoRrpIncludesGST={autoFilledRrpGST} />
                  </Card>
                )}
                {mobileSection === "description" && (
                  <Card>
                    {category
                      ? <DescriptionBuilder title={generatedTitle} category={category}
                          sharedColour={sharedColour} sharedSize={sharedSize} autoFilled={autoFilled} />
                      : <div style={{ color:"#555", textAlign:"center", padding:20 }}>Select a Category first</div>}
                  </Card>
                )}
                {mobileSection === "tags" && (
                  <Card>
                    {(category||productType)
                      ? <TagsPanel productType={productType} category={category} brand={sharedBrand}
                          colour={sharedColour} size={sharedSize} style={style} />
                      : <div style={{ color:"#555", textAlign:"center", padding:20 }}>Select a Category first</div>}
                  </Card>
                )}
                {/* Save button always visible on mobile */}
                <div style={{ display:"flex", gap:12, alignItems:"center", padding:"8px 0" }}>
                  <Btn onClick={saveProduct} disabled={saving} variant="primary">
                    {saving?"Saving...":<><i className="fa-solid fa-floppy-disk"></i> Save to Queue</>}
                  </Btn>
                  {saveMsg && (
                    <span style={{ fontSize:13, color:saveMsg.includes("✓")?"#16a34a":"#ef4444" }}>{saveMsg}</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* QUEUE */}
        {tab==="queue" && (
          <ProductList products={products} onDelete={deleteProduct} onExportCSV={exportCSV} onExportXlsx={exportXlsx} />
        )}

        {/* REPRICE TOOL */}
        {tab==="reprice" && (
          <div style={{ maxWidth:700, margin:"0 auto" }}>
            <RepriceCalculator />
            <div style={{ marginTop:16, background:"#0d0d0d", borderRadius:10, padding:16, border:"1px solid #1a1a1a" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#c9933a", marginBottom:10 }}>Pricing Formulas (Special Guidelines)</div>
              {[["Sale Price (15% off RRP)","= RRP x 0.85"],["Sale Price (10% off RRP)","= RRP x 0.90"],
                ["RRP (when not provided)","= Sale Price x 1.10"],["Cost Price (inc GST)","= Cost Price (ex GST) x 1.10"],
                ["Cost Price (alt)","= RRP x 0.65"],["Potential Margin","= Competitor Price - CP (inc GST)"]
              ].map(([label,formula])=>(
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  padding:"6px 0", borderBottom:"1px solid #1a1a1a", fontSize:12, flexWrap:"wrap", gap:4 }}>
                  <span style={{ color:"#888" }}>{label}</span>
                  <span style={{ color:"#fff", fontFamily:"monospace" }}>{formula}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PRODUCT DETAILS SECTION (extracted to avoid duplication between desktop/mobile) ──
function ProductDetailsSection({
  supplierUrl, setSupplierUrl, sku, setSku, category, setCategory,
  productType, setProductType, sharedBrand, setSharedBrand,
  sharedCollection, setSharedCollection, sharedColour, setSharedColour,
  sharedSize, setSharedSize, style, setStyle, notes, setNotes,
  autoFilling, autoFillMsg, autoFillPreview, handleAutoFill,
  msgType, msgText, msgColor, msgBg, msgBorder,
}) {
  return (
    <>
      <SectionTitle><i className="fa-solid fa-circle-info"></i> Product Details</SectionTitle>

      {/* AUTO-FILL BLOCK */}
      <div style={{ background:"#0a0f0a", border:"2px solid #c9933a44", borderRadius:10, padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ width:32, height:32, background:"#c9933a22", borderRadius:8,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <i className="fa-solid fa-list-check" style={{ color:"#c9933a", fontSize:14 }}></i>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"#c9933a", letterSpacing:.3 }}>AUTO-FILL FROM URL</div>
            <div style={{ fontSize:11, color:"#555" }}>Paste supplier URL → AI scrapes and fills all fields + generates description</div>
          </div>
        </div>

        <Field label="Supplier URL">
          <Input value={supplierUrl} onChange={setSupplierUrl} placeholder="https://supplier.com/product-page" />
        </Field>

        <button onClick={handleAutoFill} disabled={autoFilling||!supplierUrl}
          style={{ width:"100%", marginTop:2,
            background:autoFilling?"#1a1a1a":"linear-gradient(135deg,#c9933a,#e6a93e)",
            border:"none", borderRadius:8, padding:"11px 16px",
            color:autoFilling?"#888":"#000", fontSize:13, fontWeight:800,
            cursor:autoFilling||!supplierUrl?"not-allowed":"pointer", opacity:!supplierUrl?.5:1,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:.3, transition:"all .2s" }}>
          {autoFilling
            ? <><i className="fa-solid fa-spinner fa-spin"></i> Analysing with AI...</>
            : <><i className="fa-solid fa-bolt"></i> Auto-fill All Fields from URL</>}
        </button>

        {autoFillMsg && (
          <div style={{ fontSize:11, marginTop:8, padding:"6px 10px", borderRadius:6,
            background:msgBg, color:msgColor, border:`1px solid ${msgBorder}` }}>
            {msgText}
          </div>
        )}

        {autoFillPreview && (
          <div style={{ marginTop:10, background:"#0d0d0d", borderRadius:8, padding:12, border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:8, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
              Extracted Data Preview
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[{label:"Product Name",val:autoFillPreview.name},{label:"Brand",val:autoFillPreview.brand},
                {label:"Collection",val:autoFillPreview.collection},{label:"Colour",val:autoFillPreview.colour},
                {label:"Size",val :autoFillPreview.size},{label:"RRP",val:autoFillPreview.rrp?`$${autoFillPreview.rrp}`:null}].map(({label,val})=>(
                <div key={label} style={{ background:"#111", borderRadius:6, padding:"5px 8px" }}>
                  <div style={{ fontSize:9, color:"#555", marginBottom:1, textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontSize:11, color:val?"#e0e0e0":"#444", fontWeight:val?600:400, wordBreak:"break-word" }}>{val||"—"}</div>
                </div>
              ))}
            </div>
            {autoFillPreview.imageUrls?.length>0 && (
              <div style={{ marginTop:8, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:10, color:"#555" }}>Images found:</span>
                {autoFillPreview.imageUrls.slice(0,3).map((src,i)=>(
                  <img key={i} src={src} alt={`img-${i}`}
                    style={{ width:40, height:40, objectFit:"cover", borderRadius:4, border:"1px solid #333" }}
                    onError={e=>{e.target.style.display="none";}} />
                ))}
              </div>
            )}
            <div style=   {{ marginTop:8, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"#555" }}>Confidence:</span>
              <span style={{ fontSize:10, fontWeight:700,
                color:autoFillPreview.confidence==="high"?"#16a34a":autoFillPreview.confidence==="medium"?"#f59e0b":"#ef4444" }}>
                {(autoFillPreview.confidence||"medium").toUpperCase()}
              </span>
              <span style={{ fontSize:10, color:"#444" }}>·</span>
              <span style={{ fontSize:10, color:"#555" }}>{autoFillPreview.scrapedOk?"Page scraped":"URL-based estimate"}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize:11, color:"#c9933a", background:"#c9933a11", border:"1px solid #c9933a22",
        borderRadius:6, padding:"5px 10px", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
        <i className="fa-solid fa-list"></i> Brand, Collection, Colour and Size sync automatically to Title Builder and Description
      </div>

      <Field label="SKU *"><Input value={sku} onChange={setSku} placeholder="ABC-123" /></Field>
      <Field label="Category *">
        <Select value={category} onChange={setCategory} options={ALL_CATEGORIES} placeholder="Select category" />
      </Field>

      <Field label="Product Type" hint="Sets the exact title format and Shopify tag structure for this product">
        <Select value={productType} onChange={setProductType}
          options={ALL_PRODUCT_TYPES_FLAT} placeholder="Select product type…" />
        {productType && PRODUCT_TAG_MAP_FE[productType] && (
          <div style={{ fontSize:10, color:"#16a34a", marginTop:4, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            <i className="fa-solid fa-circle-check"></i>
            {PRODUCT_TITLE_FORMATS[productType]
              ? <>Title: <span style={{ fontFamily:"monospace", wordBreak:"break-all" }}>{PRODUCT_TITLE_FORMATS[productType].parts.join(" › ")}</span></>
              : "Tag schema loaded"}
            {PRODUCT_TAG_MAP_FE[productType].noBrand && <span style={{ color:"#f59e0b", marginLeft:4 }}>· Brand_ omitted</span>}
          </div>
        )}
      </Field>

      <Field label="Brand">
        <Input value={sharedBrand} onChange={setSharedBrand} placeholder="e.g. Caroma, TOTO, Riva" />
      </Field>
      <Field label="Collection (Series)">
        <Input value={sharedCollection} onChange={setSharedCollection} placeholder="e.g. Liano, Urbane" />
      </Field>
      <Field label="Colour / Finish">
        <Input value={sharedColour} onChange={setSharedColour} placeholder="e.g. Chrome, Matte Black" />
      </Field>
      <Field label="Size">
        <Input value={sharedSize} onChange={setSharedSize} placeholder="e.g. 600mm, 900mm" />
      </Field>
      <Field label="Style">
        <Select value={style} onChange={setStyle}
          options={["Contemporary","Traditional","Hamptons","Smart Bathroom","Beach","Coastal"]} />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={setNotes} placeholder="Any special notes..." />
      </Field>
    </>
  );
}