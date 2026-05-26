import { useState, useEffect } from "react";
import { Field, Input, Btn, SectionTitle } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";
import { PRODUCT_TITLE_FORMATS, CATEGORY_TITLE_FORMATS, PRODUCT_SPEC_TAGS } from "../businessRule";

export default function TitleBuilder({ category, productType, onChange, sharedBrand, sharedCollection, sharedColour, sharedSize }) {
  const { isMobile } = useResponsive();

  const titleSpec = productType && PRODUCT_TITLE_FORMATS[productType]
    ? PRODUCT_TITLE_FORMATS[productType]
    : CATEGORY_TITLE_FORMATS[category] || CATEGORY_TITLE_FORMATS["default"];

  const parts        = titleSpec.parts;
  const formatNote   = titleSpec.note;
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
      const updated = { ...prev };
      let changed = false;
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

      {/* FORMAT DISPLAY */}
      <div style={{
        background: "#0d0d0d", borderRadius: 8, padding: "10px 14px",
        marginBottom: formatNote ? 6 : 14, fontSize: 12, color: "#c9933a",
        fontFamily: "monospace", overflowX: "auto", whiteSpace: isMobile ? "normal" : "nowrap",
      }}>
        {isActive && (
          <span style={{ fontSize: 9, color: "#16a34a", fontWeight: 700, marginRight: 8, background: "#14532d22", borderRadius: 3, padding: "1px 6px" }}>
            EXACT FORMAT
          </span>
        )}
        {formatDisplay}
      </div>

      {formatNote && (
        <div style={{
          fontSize: 11, color: "#888", background: "#0a0a0a", borderRadius: 6,
          padding: "5px 10px", marginBottom: 14, border: "1px solid #1a1a1a",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="fa-solid fa-circle-info" style={{ color: "#c9933a" }}></i>
          {formatNote}
        </div>
      )}

      {!isActive && (
        <div style={{
          fontSize: 11, color: "#f59e0b", background: "#78350f22", border: "1px solid #f59e0b44",
          borderRadius: 6, padding: "5px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="fa-solid fa-triangle-exclamation fa-fade"></i>
          Select a <strong>Product Type</strong> in Product Details to get the exact title format for that product.
        </div>
      )}

      {(sharedBrand || sharedCollection || sharedColour || sharedSize) && (
        <div style={{
          fontSize: 11, color: "#c9933a", background: "#c9933a11", border: "1px solid #c9933a33",
          borderRadius: 6, padding: "5px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="fa-solid fa-bolt"></i> Fields marked <b>AUTO</b> are synced from Product Details
        </div>
      )}

      {/* PART FIELDS */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        {parts.map(p => (
          <Field key={p} label={p}>
            <div style={{ position: "relative" }}>
              <Input
                value={vals[p] || ""}
                onChange={v => setVal(p, v)}
                placeholder={p}
                style={SHARED_MAP[p] && vals[p] === SHARED_MAP[p] ? { borderColor: "#c9933a55", paddingRight: 52 } : {}}
              />
              {SHARED_MAP[p] && vals[p] === SHARED_MAP[p] && (
                <span style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 8, color: "#c9933a", fontWeight: 800, background: "#c9933a22",
                  borderRadius: 3, padding: "1px 5px", pointerEvents: "none",
                }}>AUTO</span>
              )}
            </div>
          </Field>
        ))}
      </div>

      {/* PRODUCT SPEC */}
      <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 12, marginTop: 10, border: "1px solid #333" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#c9933a", marginBottom: 4 }}>
          <i className="fa-solid fa-star"></i> Product Specification{" "}
          <span style={{ color: "#555", fontWeight: 400 }}>(optional — appended after title)</span>
        </div>
        <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>
          Extra spec — e.g. "500 x 400mm", "4 Star WELS 7.5L/min", "PER BOX"
        </div>
        <Input value={productSpec} onChange={setProductSpec} placeholder='e.g. 500 x 400mm Basin' />
        {productSpec.trim() && (
          <div style={{ fontSize: 10, color: "#c9933a", marginTop: 4 }}>Will append: {productSpec.trim().toUpperCase()}</div>
        )}
      </div>

      {/* PRODUCT ATTRIBUTES */}
      <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 12, marginTop: 10, border: "1px solid #333" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#c9933a", marginBottom: 4 }}>
          <i className="fa-solid fa-bars-staggered"></i> Product Attributes{" "}
          <span style={{ color: "#555", fontWeight: 400 }}>(optional — appended at end)</span>
        </div>
        <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>Select applicable attributes</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {PRODUCT_SPEC_TAGS.map(tag => (
            <div key={tag} onClick={() => toggleTag(tag)}
              style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                background: selectedTags.includes(tag) ? "#c9933a" : "#1a1a1a",
                color:      selectedTags.includes(tag) ? "#0a0a0a" : "#888",
                border:     `1px solid ${selectedTags.includes(tag) ? "#c9933a" : "#333"}`,
              }}>
              {tag}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input value={customTag} onChange={setCustomTag} placeholder="Add custom attribute..." style={{ flex: 1 }} />
          <Btn onClick={addCustomTag} variant="ghost" small disabled={!customTag.trim()}>+ Add</Btn>
        </div>
        {selectedTags.length > 0 && (
          <div style={{ marginTop: 10, background: "#111", borderRadius: 6, padding: "8px 12px", border: "1px solid #222" }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>Selected</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedTags.map(tag => (
                <div key={tag} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "#c9933a22", border: "1px solid #c9933a44", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#c9933a",
                }}>
                  {tag}
                  <span onClick={() => toggleTag(tag)} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW */}
      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, marginTop: 10, border: "1px solid #c9933a44" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Generated Title Preview</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", wordBreak: "break-word" }}>
          {[
            ...parts.map(p => vals[p]).filter(Boolean),
            ...(productSpec.trim() ? [productSpec.trim()] : []),
            ...(selectedTags.length > 0 ? [selectedTags.join(" ")] : []),
          ].join(" ").toUpperCase() || "— fill fields above —"}
        </div>
      </div>
    </div>
  );
}