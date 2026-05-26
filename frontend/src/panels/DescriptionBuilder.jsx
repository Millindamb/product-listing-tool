import { useState, useEffect } from "react";
import axios from "axios";
import { Field, Input, Btn, SectionTitle } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";
import { DESCRIPTION_FEATURES, FEATURE_LABELS } from "../businessRule";

const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";

const MODEL_INFO = {
  gemini: { label: "Gemini 2.0 Flash",   info: "Gemini", tag: "Free · Supports images",          color: "#4285f4" },
  groq:   { label: "Groq Llama 3.3 70B", info: "Groq",   tag: "Free · Text only · Very fast",    color: "#f55036" },
};

export default function DescriptionBuilder({ title, category, sharedColour, sharedSize, autoFilled }) {
  const { isMobile } = useResponsive();
  const fields = DESCRIPTION_FEATURES[category] || DESCRIPTION_FEATURES.default;

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
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages(prev   => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const featureBlock = fields.map(f => `• ${FEATURE_LABELS[f] || f}: ${features[f] || ""}`).join("\n");
  const activeDesc   = aiDesc || "[Click Generate AI Description below]";
  const fullDescription = `**${(title || "PRODUCT TITLE").toUpperCase()}**
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
      fd.append("warranty",      warrantyRows.filter(r => r.trim()).join(", ") || "");
      fd.append("category",      category || "");
      fd.append("model",         aiModel);
      images.forEach(img => fd.append("images", img));
      const { data } = await axios.post(`${API}/description/generate`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAiDesc(data.description);
      setDescMode("manual");
      if (data.note) setAiNote(data.note);
    } catch (e) {
      setAiError(e.response?.data?.error || "Generation failed — check API key in .env");
    }
    setAiLoading(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(fullDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-file-pen"></i> Description Builder</SectionTitle>

      {/* MODE TOGGLE */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>MODE : </div>
        <div style={{ display: "flex", background: "#0d0d0d", borderRadius: 8, padding: 3, border: "1px solid #333", gap: 3 }}>
          {[
            { key: "auto",   label: "Auto",   hint: "Filled from URL scrape" },
            { key: "manual", label: "Manual", hint: "Fill & generate below"  },
          ].map(m => (
            <button key={m.key} onClick={() => setDescMode(m.key)} title={m.hint}
              style={{
                background: descMode === m.key ? "#c9933a" : "transparent",
                color:      descMode === m.key ? "#000"    : "#666",
                border: "none", borderRadius: 6, padding: "5px 14px",
                fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .15s",
              }}>
              {m.label}
            </button>
          ))}
        </div>
        {descMode === "auto" && aiDescAuto && (
          <span style={{ fontSize: 10, color: "#16a34a", background: "#14532d22", borderRadius: 4, padding: "2px 8px", border: "1px solid #16a34a33" }}>
            AI-generated from supplier URL
          </span>
        )}
        {descMode === "auto" && !aiDescAuto && (
          <span style={{ fontSize: 10, color: "#f59e0b" }}>
            No auto description yet — use Auto-Fill from URL first
          </span>
        )}
      </div>

      {/* AUTO MODE */}
      {descMode === "auto" && (
        <div style={{ background: "#0a140a", border: "2px solid #16a34a44", borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-arrows-rotate"></i>
              Auto-Generated Description
            </div>
            <span style={{ fontSize: 10, color: "#555" }}>From supplier URL · Review and edit if needed</span>
          </div>
          {aiDescAuto ? (
            <textarea
              value={aiDesc}
              onChange={e => setAiDesc(e.target.value)}
              style={{
                width: "100%", background: "#111", border: "1px solid #16a34a33", borderRadius: 8,
                padding: 10, color: "#ddd", fontSize: 13, lineHeight: 1.7, minHeight: 100,
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          ) : (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              <i className="fa-solid fa-circle-info"></i>{" "}
              Auto-fill from URL first to get an AI-generated description here
            </div>
          )}
          {aiDescAuto && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555" }}>{aiDesc ? aiDesc.split(/\s+/).length : 0} words</span>
              <button
                onClick={() => setAiDesc(aiDescAuto)}
                style={{
                  fontSize: 10, background: "transparent", border: "1px solid #333", borderRadius: 4,
                  color: "#666", cursor: "pointer", padding: "2px 8px",
                }}>
                Reset to original
              </button>
            </div>
          )}
        </div>
      )}

      {/* MANUAL MODE */}
      {descMode === "manual" && (
        <>
          {(sharedColour || sharedSize) && !autoFilled && (
            <div style={{
              fontSize: 11, color: "#c9933a", background: "#c9933a11", border: "1px solid #c9933a33",
              borderRadius: 6, padding: "5px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
            }}>
              <i className="fa-solid fa-bolt"></i> Colour and Size pre-filled from Product Details
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Field label="Available in Colours">
              <div style={{ position: "relative" }}>
                <Input value={colours} onChange={setColours} placeholder="Chrome, Black, Gold"
                  style={sharedColour && colours === sharedColour ? { borderColor: "#c9933a55", paddingRight: 52 } : {}} />
                {sharedColour && colours === sharedColour && (
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#c9933a", fontWeight: 800, background: "#c9933a22", borderRadius: 3, padding: "1px 5px", pointerEvents: "none" }}>AUTO</span>
                )}
              </div>
            </Field>
            <Field label="Available in Sizes (if applicable)">
              <div style={{ position: "relative" }}>
                <Input value={sizes} onChange={setSizes} placeholder="600mm, 750mm, 900mm"
                  style={sharedSize && sizes === sharedSize ? { borderColor: "#c9933a55", paddingRight: 52 } : {}} />
                {sharedSize && sizes === sharedSize && (
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#c9933a", fontWeight: 800, background: "#c9933a22", borderRadius: 3, padding: "1px 5px", pointerEvents: "none" }}>AUTO</span>
                )}
              </div>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {fields.map(f => (
              <Field key={f} label={FEATURE_LABELS[f] || f}>
                <Input value={features[f] || ""} onChange={v => setFeature(f, v)} placeholder={FEATURE_LABELS[f] || f} />
              </Field>
            ))}
          </div>

          {/* WARRANTY */}
          <div style={{ background: "#0d0d0d", borderRadius: 10, padding: 14, marginBottom: 14, border: "1px solid #333" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c9933a" }}>
                <i className="fa-solid fa-shield-halved"></i> Warranty Information
              </div>
              <Btn onClick={addWarrantyRow} variant="ghost" small>+ Add Row</Btn>
            </div>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 10 }}>
              Type the full warranty line — e.g. "15 Year Product or Parts Warranty"
            </div>
            {warrantyRows.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <Input value={row} onChange={v => updateWarrantyRow(i, v)}
                  placeholder={i === 0 ? "e.g. 15 Year Product or Parts Warranty" : i === 1 ? "e.g. 1 Year Labour Warranty" : "e.g. Lifetime Stainless Steel 316 Warranty"} />
                <button onClick={() => removeWarrantyRow(i)}
                  style={{ background: "#7f1d1d44", border: "1px solid #7f1d1d", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontSize: 14, height: 36, width: 32 }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
            {warrantyRows.some(r => r.trim()) && (
              <div style={{ marginTop: 10, background: "#111", borderRadius: 6, padding: "8px 12px", border: "1px solid #222" }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Preview</div>
                {warrantyRows.filter(r => r.trim()).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#ccc" }}>• {r.trim()}</div>
                ))}
              </div>
            )}
          </div>

          {/* AI GENERATION */}
          <div style={{ background: "#0d0d0d", borderRadius: 10, padding: 14, marginBottom: 14, border: "1px solid #333" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#c9933a", marginBottom: 12 }}>
              <i className="fa-solid fa-microchip"></i> AI Description (75 words)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {Object.entries(MODEL_INFO).map(([key, info]) => (
                <div key={key} onClick={() => setAiModel(key)}
                  style={{
                    border: `1px solid ${aiModel === key ? info.color : "#333"}`, borderRadius: 8,
                    padding: "10px 12px", cursor: "pointer",
                    background: aiModel === key ? `${info.color}11` : "#111", transition: "all .15s",
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: aiModel === key ? info.color : "#888" }}>{info.label}</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{info.tag}</div>
                </div>
              ))}
            </div>

            {aiModel === "gemini" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Upload 1-2 product images (optional) — Gemini analyses them visually</div>
                <label style={{ display: "inline-block", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#1a1a1a", border: "1px dashed #444", color: "#aaa", cursor: "pointer" }}>
                  <i className="fa-solid fa-paperclip"></i> Choose Images (max 2)
                  <input type="file" accept="image/*" multiple onChange={handleImages} style={{ display: "none" }} />
                </label>
                {previews.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {previews.map((src, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={src} alt={`preview-${i}`}
                          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #333" }} />
                        <button onClick={() => removeImage(i)}
                          style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 10, cursor: "pointer", lineHeight: "18px", textAlign: "center" }}>×</button>
                      </div>
                    ))}
                    <span style={{ fontSize: 11, color: "#555" }}>{previews.length} image{previews.length > 1 ? "s" : ""} ready</span>
                  </div>
                )}
              </div>
            )}

            {aiModel === "groq" && (
              <div style={{ fontSize: 11, color: "#666", marginBottom: 10, padding: "6px 10px", background: "#111", borderRadius: 6, border: "1px solid #222" }}>
                Groq is text-only — image upload not supported. Switch to Gemini for image analysis.
              </div>
            )}

            <Btn onClick={generateAI} disabled={aiLoading}>
              {aiLoading ? `Generating with ${MODEL_INFO[aiModel].info}...` : `Generate with ${MODEL_INFO[aiModel].info}`}
            </Btn>

            {aiError && (
              <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8, padding: "8px 12px", background: "#7f1d1d22", borderRadius: 6, border: "1px solid #ef444433" }}>
                <i className="fa-solid fa-triangle-exclamation fa-fade"></i> {aiError}
              </div>
            )}
            {aiNote && <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 6 }}>ℹ {aiNote}</div>}

            {aiDesc && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                  Generated ({aiDesc.split(/\s+/).length} words) — edit if needed:
                </div>
                <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 10, color: "#ddd", fontSize: 13, lineHeight: 1.6, minHeight: 100, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
              Both models 100% free · Gemini: aistudio.google.com · Groq: console.groq.com
            </div>
          </div>
        </>
      )}

      {/* FULL PREVIEW */}
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 14, border: "1px solid #222" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>Full Description Preview</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {descMode === "auto" && (
              <span style={{ fontSize: 10, color: "#16a34a", background: "#14532d22", borderRadius: 4, padding: "2px 8px", border: "1px solid #16a34a33" }}>AUTO</span>
            )}
            <Btn onClick={copyAll} variant={copied ? "success" : "ghost"} small>
              {copied ? <><i className="fa-solid fa-check"></i> Copied!</> : <><i className="fa-regular fa-copy"></i> Copy All</>}
            </Btn>
          </div>
        </div>
        <pre style={{ color: "#ccc", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", wordBreak: "break-word" }}>
          {fullDescription}
        </pre>
      </div>
    </div>
  );
}