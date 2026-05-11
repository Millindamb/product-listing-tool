import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ─── BUSINESS RULES (mirrored from backend for instant UI validation) ─────────
const MARGIN_RULES_FE = {
  "Tapware": { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Accessories": { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Showers": { margin: 35, overThreshold: 60, threshold: 150, capAtRRP: true },
  "Basins": { margin: 65 }, "Sinks": { margin: 80 },
  "Vanities": { margin: 250 }, "Cabinets": { margin: 250 }, "Laundry Cabinets": { margin: 250 },
  "Toilets": { margin: 175 }, "Toilets Johnson Suisse": { margin: 300 },
  "Toilets Under $300": { hardMin: 300 },
  "Shaving Cabinet": { margin: 150 }, "Tiles": { margin: 35 }, "Saunas": { margin: 300 },
  "Bathtubs": { margin: 300 }, "Spa Bathtubs": { margin: 500 },
  "Riva Transparent Bathtubs": { margin: 700 },
  "Shower Screens Wall-to-Wall": { margin: 250 },
  "Shower Screens Covey Return Panel": { margin: 125 },
  "Heating": { margin: 100 }, "Lighting": { margin: 100 },
  "Toilet Paper Holders": { hardMin: 30 }, "Robe Hooks": { hardMin: 20 },
};

const WEIGHT_RULES_FE = {
  "Tapware": "formula", "Accessories": "formula", "Showers": "formula",
  "Heating": 150, "Lighting": 150,
  "Shower Screens": 900, "Bathtubs": 900, "Spa Bathtubs": 900,
  "Vanities": 150, "Toilets": 150, "Mirrors": 20, "Basins": 20, "Sinks": 20,
  "Tiles": 150, "Saunas": 900,
};

const TITLE_FORMATS_FE = {
  "Tapware": "Brand > Collection > Product Type > Size (if applicable) > Colour",
  "Accessories": "Brand > Collection > Product Type > Size (if applicable) > Colour",
  "Showers": "Brand > Collection > Product Type > Size (if applicable) > Colour",
  "Shower Screens": "Brand > Collection > Framing > Type > Colour > Size",
  "Bathtubs": "Brand > Collection > Type of Bath > Colour > Size",
  "Vanities": "Brand > Collection > Colour > Size > Bowl Configuration > Vanity Type",
  "Basins": "Brand > Collection > Basin Type > Colour > Size",
  "Mirrors": "Brand > Collection > Shape > Mirror Type > Colour > Size",
  "Toilets": "Brand > Collection > Type > Colour",
  "Tiles": "Brand > Collection > Colour > Finish > Size > Shape (PER BOX)",
  "Heating": "Brand > Collection > Type of Heating > Colour > Size",
  "Lighting": "Brand > Collection > Type of Lighting > Colour > Size",
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
  Tapware: ["colour","size","material","type","wels","flowRate","welsReg","additional"],
  Basins: ["colour","size","material","mounting","compatible","additional"],
  Vanities: ["colour","size","material","mounting","bowl","drawer","mechanism","handles","additional"],
  Showers: ["colour","size","material","type","wels","flowRate","additional"],
  Mirrors: ["colour","size","shape","type","ipRating","voltage","additional"],
  Toilets: ["colour","size","type","flushing","waterRating","additional"],
  Tiles: ["colour","size","finish","shape","coverage","additional"],
  default: ["colour","size","material","type","additional"],
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcWeight(cat, sp, brand) {
  if (["TOTO","Lafeme"].includes(brand)) return { w: 1, note: "TOTO/Lafeme = 1kg" };
  const r = WEIGHT_RULES_FE[cat];
  if (r === "formula") {
    if (+sp < 150) return { w: +(+sp / 150).toFixed(3), note: `SP/150 = ${sp}/150` };
    return { w: 1, note: "SP ≥ $150 → 1kg" };
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

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
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
  const bg = variant==="primary"?"#c9933a": variant==="danger"?"#7f1d1d": variant==="success"?"#14532d":"#2a2a2a";
  const col = variant==="ghost"?"#aaa":"#fff";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:bg, color:col, border:"none", borderRadius:8, padding: small?"6px 14px":"10px 20px",
        fontSize: small?12:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?.6:1, transition:"opacity .2s" }}>
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
  <div style={{ fontSize:11, fontWeight:700, color:"#c9933a", textTransform:"uppercase", letterSpacing:2, marginBottom:16, paddingBottom:8, borderBottom:"1px solid #222" }}>
    {children}
  </div>
);

// ─── PRICING CALCULATOR PANEL ─────────────────────────────────────────────────
function PricingPanel({ category, brand, onResult }) {
  const [cpRaw, setCp] = useState("");
  const [cpGST, setCpGST] = useState(false);
  const [rrpRaw, setRrp] = useState("");
  const [rrpGST, setRrpGST] = useState(false);
  const [manualSP, setManualSP] = useState("");
  const [result, setResult] = useState(null);

  const calculate = useCallback(() => {
    if (!cpRaw) return;
    const cp = cpGST ? +cpRaw : +(+cpRaw * 1.1).toFixed(2);
    const rrp = rrpRaw ? (rrpGST ? Math.round(+rrpRaw) : Math.round(+rrpRaw * 1.1)) : null;
    const { sp, required, ok, hardMin } = calcMargin(category, cp, rrp);
    const finalSP = manualSP ? Math.round(+manualSP) : sp;
    const finalRRP = rrp || Math.round(finalSP * 1.1);
    const { w, note } = calcWeight(category, finalSP, brand);
    const actualMargin = +(finalSP - cp).toFixed(2);
    const marginOk = hardMin ? finalSP >= required : actualMargin >= required;
    const r = { cp, rrp: finalRRP, sp: finalSP, actualMargin, required, marginOk, weight: w, weightNote: note };
    setResult(r);
    onResult?.(r);
  }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, category, brand, onResult]);

  useEffect(() => { if (cpRaw) calculate(); }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, calculate]);

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-dollar-sign"></i> Pricing Calculator</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Cost Price (CP)" hint="Supplier's price — GST added automatically if not included">
          <Input value={cpRaw} onChange={setCp} placeholder="90.00" type="number" />
          <label style={{ fontSize:11, color:"#888", marginTop:4, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={cpGST} onChange={e=>setCpGST(e.target.checked)} />
            Already includes GST
          </label>
        </Field>
        <Field label="RRP" hint="From supplier catalogue — add 10% GST if not included">
          <Input value={rrpRaw} onChange={setRrp} placeholder="200.00" type="number" />
          <label style={{ fontSize:11, color:"#888", marginTop:4, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={rrpGST} onChange={e=>setRrpGST(e.target.checked)} />
            Already includes GST
          </label>
        </Field>
      </div>
      <Field label="Override SP (optional)" hint="Leave blank to auto-calculate from margin rules">
        <Input value={manualSP} onChange={setManualSP} placeholder="Leave blank for auto" type="number" />
      </Field>

      {result && (
        <div style={{ marginTop:12, background:"#0d0d0d", borderRadius:10, padding:16, border:`1px solid ${result.marginOk?"#16a34a44":"#dc262644"}` }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
            {[
              { label:"CP (inc GST)", val:`$${result.cp}`, color:"#aaa" },
              { label:"RRP", val:`$${result.rrp}`, color:"#aaa" },
              { label:"Selling Price", val:`$${result.sp}`, color:"#c9933a" },
              { label:"Weight", val:`${result.weight} kg`, color:"#aaa" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center" }}>
            <Badge ok={result.marginOk}>
              {result.marginOk ? "✓ Margin OK" : "✗ Margin Too Low"}
            </Badge>
            <span style={{ fontSize:12, color:"#888" }}>
              Margin: ${result.actualMargin} / Required: ${result.required}
            </span>
            {result.weightNote && <span style={{ fontSize:11, color:"#666" }}>{result.weightNote}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TITLE BUILDER ────────────────────────────────────────────────────────────
function TitleBuilder({ category, onChange }) {
  const format = TITLE_FORMATS_FE[category] || "Brand > Collection > Product Type > Colour";
  const parts = format.split(" > ").map(p => p.replace(/\(.*?\)/g,"").trim()).filter(Boolean);
  const [vals, setVals] = useState({});

  const setVal = (k, v) => {
    const next = { ...vals, [k]: v };
    setVals(next);
    const title = parts.map(p => next[p] || "").filter(Boolean).join(" ").toUpperCase();
    onChange(title);
  };

  return (
    <div>
      <SectionTitle>🏷️ Title Builder</SectionTitle>
      <div style={{ background:"#0d0d0d", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#c9933a", fontFamily:"monospace" }}>
        Format: {format}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {parts.map(p => (
          <Field key={p} label={p}>
            <Input value={vals[p]||""} onChange={v=>setVal(p,v)} placeholder={p} />
          </Field>
        ))}
      </div>
      <div style={{ background:"#1a1a1a", borderRadius:8, padding:12, marginTop:8, border:"1px solid #c9933a44" }}>
        <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>Generated Title</div>
        <div style={{ fontSize:14, fontWeight:700, color:"#fff", wordBreak:"break-word" }}>
          {parts.map(p=>vals[p]).filter(Boolean).join(" ").toUpperCase() || "— fill fields above —"}
        </div>
      </div>
    </div>
  );
}

// ─── DESCRIPTION BUILDER ──────────────────────────────────────────────────────
// ─── DESCRIPTION BUILDER ──────────────────────────────────────────────────────
function DescriptionBuilder({ title, category }) {
  const fields = (DESCRIPTION_FEATURES[category] || DESCRIPTION_FEATURES.default);
  const [features, setFeatures] = useState({});
  const [colours, setColours] = useState("");
  const [sizes, setSizes] = useState("");
  const [warranty, setWarranty] = useState("");
  const [domWarranty, setDomWarranty] = useState("");
  const [comWarranty, setComWarranty] = useState("");
  const [aiModel, setAiModel] = useState("gemini");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDesc, setAiDesc] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const setFeature = (k, v) => setFeatures(prev => ({ ...prev, [k]: v }));

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 2);
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages(prev => prev.filter((_,idx)=>idx!==i));
    setPreviews(prev => prev.filter((_,idx)=>idx!==i));
  };

  const featureBlock = fields.map(f => `• ${FEATURE_LABELS[f] || f}: ${features[f] || ""}`).join("\n");

  const fullDescription =
`**${(title || "PRODUCT TITLE").toUpperCase()}**
Also Available in ${colours || "______"}
${sizes ? `Also Available in Sizes: ${sizes}` : ""}

**Product Features:**
${featureBlock}

**Warranty Information:**
${domWarranty ? `• Domestic: ${domWarranty} years replacement warranty` : `• ${warranty || "__"} years replacement warranty`}
${comWarranty ? `• Commercial: ${comWarranty} years replacement warranty` : ""}

${aiDesc || "[Click Generate AI Description below]"}`.trim();

  const generateAI = async () => {
    setAiLoading(true); setAiError(""); setAiNote("");
    try {
      const formData = new FormData();
      formData.append("name", title || "");
      formData.append("colours", colours);
      formData.append("material", features.material || "");
      formData.append("compatibility", features.compatible || "");
      formData.append("warranty", warranty || domWarranty || "");
      formData.append("category", category || "");
      formData.append("model", aiModel);
      images.forEach(img => formData.append("images", img));

      const { data } = await axios.post(`${API}/description/generate`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAiDesc(data.description);
      if (data.note) setAiNote(data.note);
    } catch (e) {
      setAiError(e.response?.data?.error || "Generation failed — check API key in .env");
    }
    setAiLoading(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(fullDescription);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const MODEL_INFO = {
    gemini: { label:"Gemini 2.0 Flash",info:"Gemini", tag:"Free · Supports images", color:"#4285f4" },
    groq:   { label:"Groq Llama 3.3 70B",info:"Groq", tag:"Free · Text only · Very fast", color:"#f55036" },
  };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-file-pen"></i> Description Builder</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <Field label="Available in Colours">
          <Input value={colours} onChange={setColours} placeholder="Chrome, Black, Gold" />
        </Field>
        <Field label="Available in Sizes (if applicable)">
          <Input value={sizes} onChange={setSizes} placeholder="600mm, 750mm, 900mm" />
        </Field>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {fields.map(f => (
          <Field key={f} label={FEATURE_LABELS[f] || f}>
            <Input value={features[f]||""} onChange={v=>setFeature(f,v)} placeholder={FEATURE_LABELS[f] || f} />
          </Field>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <Field label="General Warranty (years)">
          <Input value={warranty} onChange={setWarranty} placeholder="5" />
        </Field>
        <Field label="Domestic Warranty (years)">
          <Input value={domWarranty} onChange={setDomWarranty} placeholder="5" />
        </Field>
        <Field label="Commercial Warranty (years)">
          <Input value={comWarranty} onChange={setComWarranty} placeholder="2" />
        </Field>
      </div>

      {/* AI Generator */}
      <div style={{ background:"#0d0d0d", borderRadius:10, padding:14, marginBottom:14, border:"1px solid #333" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#c9933a", marginBottom:12 }}><i className="fa-solid fa-robot"></i>  AI Description (75 words)</div>

        {/* Model selector cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
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

        {/* Image upload — Gemini only */}
        {aiModel === "gemini" && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>
              Upload 1–2 product images (optional) — Gemini analyses them visually
            </div>
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
                        cursor:"pointer", lineHeight:"18px", textAlign:"center" }}>✕</button>
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
            ℹ Groq is text-only — image upload not supported. Switch to Gemini for image analysis.
          </div>
        )}

        <Btn onClick={generateAI} disabled={aiLoading}>
          {aiLoading ? `Generating with ${MODEL_INFO[aiModel].label}...` : `Generate with ${MODEL_INFO[aiModel].info}`}
        </Btn>

        {aiError && (
          <div style={{ color:"#ef4444", fontSize:12, marginTop:8, padding:"8px 12px",
            background:"#7f1d1d22", borderRadius:6, border:"1px solid #ef444433" }}>⚠ {aiError}</div>
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

      {/* Full Preview */}
      <div style={{ background:"#0a0a0a", borderRadius:10, padding:14, border:"1px solid #222" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#888" }}>Full Description Preview</span>
          <Btn onClick={copyAll} variant={copied?"success":"ghost"} small>
            {copied ? <><i className="fa-solid fa-check"></i> Copied!</> : <><i className="fa-regular fa-copy"></i> Copy All</>}
          </Btn>
        </div>
        <pre style={{ color:"#ccc", fontSize:12, lineHeight:1.7, whiteSpace:"pre-wrap", margin:0, fontFamily:"inherit" }}>
          {fullDescription}
        </pre>
      </div>
    </div>
  );
}

// ─── TAGS & METAFIELDS PANEL ──────────────────────────────────────────────────
function TagsPanel({ category, brand, colour, size, style: pStyle, productType }) {
  const colourTag = colour ? `Colour_${colour}` : "";
  const brandTag = brand ? `Brand_${brand}` : "";
  const styleTag = pStyle ? `Style_${pStyle}` : "";
  const sizeTag = size ? `Size_${size}` : "";

  const tags = [category, brand, colour, pStyle, productType, colourTag, brandTag, styleTag, sizeTag]
    .filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);

  const metafields = { Brand: brand, Colour: colour, Size: size, Style: pStyle, Type: productType, Collections: category };

  const [copied, setCopied] = useState("");
  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(""),1500); };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-tags"></i> Tags & Metafields</SectionTitle>
      <Field label="Tags (comma separated — paste into Shopify)">
        <div style={{ background:"#0d0d0d", borderRadius:8, padding:10, border:"1px solid #333", position:"relative" }}>
          <div style={{ fontSize:13, color:"#ccc", wordBreak:"break-all", marginBottom:8 }}>{tags.join(", ") || "— fill product details —"}</div>
          <Btn onClick={()=>copy(tags.join(", "),"tags")} variant="ghost" small>
            {copied==="tags"?"✓ Copied":"Copy Tags"}
          </Btn>
        </div>
      </Field>
      <Field label="Metafields">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {Object.entries(metafields).map(([k,v])=>(
            <div key={k} style={{ background:"#0d0d0d", borderRadius:8, padding:"8px 12px", border:"1px solid #222" }}>
              <div style={{ fontSize:10, color:"#666", marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, color: v?"#fff":"#444" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─── PRODUCT LIST TABLE ───────────────────────────────────────────────────────
function ProductList({ products, onDelete, onExport }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Product Queue ({products.length})</div>
        <Btn onClick={onExport} variant="success">⬇ Export Google Sheet (.xlsx)</Btn>
      </div>
      {products.length === 0 && (
        <div style={{ textAlign:"center", color:"#555", padding:40 }}>No products yet — add one using the form</div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {products.map((p, i) => (
          <div key={p._id || i} style={{ background:"#111", border:"1px solid #222", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:2 }}>{p.productTitle || p.sku}</div>
              <div style={{ fontSize:11, color:"#888" }}>{p.category} · {p.brand} · SKU: {p.sku}</div>
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:16, fontWeight:800, color:"#c9933a" }}>${p.sp}</div>
                <div style={{ fontSize:11, color:"#555" }}>RRP ${p.rrp}</div>
              </div>
              <Badge ok={p.marginOk}>{p.marginOk?"✓ Margin OK":"✗ Margin"}</Badge>
              <Btn onClick={()=>onDelete(p._id||i)} variant="danger" small>✕</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("form");
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Form state
  const [supplierUrl, setSupplierUrl] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [collection, setCollection] = useState("");
  const [colour, setColour] = useState("");
  const [size, setSize] = useState("");
  const [style, setStyle] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [pricing, setPricing] = useState(null);
  const [notes, setNotes] = useState("");

  // Load products from backend
  useEffect(() => {
    axios.get(`${API}/products`).then(r => setProducts(r.data)).catch(()=>{});
  }, []);

  const saveProduct = async () => {
    if (!sku || !category) { setSaveMsg("SKU and Category are required"); return; }
    setSaving(true);
    const payload = {
      supplierUrl, sku, productTitle: generatedTitle, category, productType,
      brand, collection, colour, size, style,
      cpGST: pricing?.cp, rrp: pricing?.rrp, sp: pricing?.sp,
      weight: pricing?.weight, marginOk: pricing?.marginOk,
      notes, status: "draft",
    };
    try {
      const { data } = await axios.post(`${API}/products`, payload);
      setProducts(prev => [data, ...prev]);
      setSaveMsg("✓ Product saved to queue");
      setTimeout(()=>setSaveMsg(""), 3000);
    } catch {
      // DB not running — save locally
      setProducts(prev => [{ ...payload, _id: Date.now() }, ...prev]);
      setSaveMsg("✓ Saved locally (DB offline)");
      setTimeout(()=>setSaveMsg(""), 3000);
    }
    setSaving(false);
  };

  const deleteProduct = async (id) => {
    try { await axios.delete(`${API}/products/${id}`); } catch {}
    setProducts(prev => prev.filter(p => p._id !== id));
  };

  const exportSheet = async () => {
    try {
      const res = await axios.post(`${API}/export/xlsx`, { products }, { responseType:"blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url;
      a.download = `Austpek_Products_${Date.now()}.xlsx`; a.click();
    } catch {
      // fallback: build CSV in browser
      const headers = ["SKU","Product Title","Category","Brand","CP","RRP","SP","Weight","Status"];
      const rows = products.map(p=>[p.sku,p.productTitle,p.category,p.brand,p.cpGST,p.rrp,p.sp,p.weight,p.status]);
      const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
      const blob = new Blob([csv],{type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download="Austpek_Products.csv"; a.click();
    }
  };

  const NAV = [
    { key:"form", label:`+ Add Product` },
    {key: "queue",label: (<><i className="fa-solid fa-list"></i>{" "}Queue ({products.length})</>)}
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", color:"#fff", fontFamily:"system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#0d0d0d", borderBottom:"1px solid #1a1a1a", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:18, fontWeight:900, color:"#c9933a", letterSpacing:1 }}>AUSTPEK</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}><i className="fa-solid fa-screwdriver-wrench"></i> Product Listing Tool</div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={()=>setTab(n.key)}
              style={{ background: tab===n.key?"#c9933a22":"transparent", border: tab===n.key?"1px solid #c9933a44":"1px solid transparent",
                borderRadius:8, padding:"6px 16px", color: tab===n.key?"#c9933a":"#888",
                fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" }}>

        {/* ── ADD PRODUCT FORM ── */}
        {tab === "form" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

            {/* LEFT COLUMN */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <Card>
                <SectionTitle>📦 Product Details</SectionTitle>
                <Field label="Supplier URL">
                  <Input value={supplierUrl} onChange={setSupplierUrl} placeholder="https://supplier.com/product" />
                </Field>
                <Field label="SKU *">
                  <Input value={sku} onChange={setSku} placeholder="ABC-123" />
                </Field>
                <Field label="Category *">
                  <Select value={category} onChange={setCategory} options={ALL_CATEGORIES} placeholder="Select category" />
                </Field>
                <Field label="Brand">
                  <Input value={brand} onChange={setBrand} placeholder="e.g. Caroma, TOTO, Riva" />
                </Field>
                <Field label="Collection (Series)">
                  <Input value={collection} onChange={setCollection} placeholder="e.g. Liano, Urbane" />
                </Field>
                <Field label="Colour / Finish">
                  <Input value={colour} onChange={setColour} placeholder="e.g. Chrome, Matte Black" />
                </Field>
                <Field label="Size">
                  <Input value={size} onChange={setSize} placeholder="e.g. 600mm, 900mm" />
                </Field>
                <Field label="Style">
                  <Select value={style} onChange={setStyle}
                    options={["Contemporary","Traditional","Hamptons","Smart Bathroom","Beach","Coastal"]} />
                </Field>
                <Field label="Notes">
                  <Input value={notes} onChange={setNotes} placeholder="Any special notes..." />
                </Field>
              </Card>

              {category && (
                <Card>
                  <TagsPanel category={category} brand={brand} colour={colour} size={size} style={style} productType={productType} />
                </Card>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {category && (
                <Card>
                  <TitleBuilder category={category} onChange={setGeneratedTitle} />
                </Card>
              )}

              <Card>
                <PricingPanel category={category} brand={brand} onResult={setPricing} />
              </Card>

              {category && (
                <Card>
                  <DescriptionBuilder title={generatedTitle} category={category} />
                </Card>
              )}

              {/* Save button */}
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <Btn onClick={saveProduct} disabled={saving} variant="primary">
                  {saving ? "Saving..." : <><i className="fa-solid fa-floppy-disk"></i> Save to Queue</>}
                </Btn>
                {saveMsg && <span style={{ fontSize:13, color: saveMsg.includes("✓")?"#16a34a":"#ef4444" }}>{saveMsg}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCT QUEUE ── */}
        {tab === "queue" && (
          <ProductList products={products} onDelete={deleteProduct} onExport={exportSheet} />
        )}
      </div>
    </div>
  );
}
