import { useState, useEffect } from "react";
import { Field, Input, Select, Btn, SectionTitle } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";
import { PRODUCT_TAG_MAP_FE, SCHEMAS_FE, TAG_FIELD_DEFS } from "../businessRule";
import { buildTagsFromSchema } from "../utils/pricing";

function tagColor(tag) {
  if (tag.startsWith("Collections_"))   return "#c9933a";
  if (tag.startsWith("Brand_"))         return "#60a5fa";
  if (tag.startsWith("Colour_"))        return "#a78bfa";
  if (tag.startsWith("Style_"))         return "#34d399";
  if (tag.startsWith("Configuration_")) return "#fb923c";
  if (tag.startsWith("Size_"))          return "#f472b6";
  if (tag.startsWith("Shape_"))         return "#38bdf8";
  if (tag.startsWith("Finish_"))        return "#a3e635";
  return "#ccc";
}

export default function TagsPanel({ productType, category, brand, colour, size, style: pStyle }) {
  const { isMobile } = useResponsive();

  const spec         = productType ? PRODUCT_TAG_MAP_FE[productType] : null;
  const schema       = spec ? SCHEMAS_FE[spec.schema] || [] : [];
  const extraFields  = spec ? spec.extraFields || [] : [];
  const schemaFields = [...new Set([...schema, ...extraFields])];

  const [localVals, setLocalVals] = useState({ style: "", configuration: "", size: size || "", shape: "", finish: "" });
  const [copied, setCopied]       = useState("");

  useEffect(() => { setLocalVals(prev => ({ ...prev, style: pStyle || "" })); }, [pStyle]);
  useEffect(() => { setLocalVals(prev => ({ ...prev, size: size || "" })); },   [size]);
  useEffect(() => { setLocalVals({ style: pStyle || "", configuration: "", size: size || "", shape: "", finish: "" }); }, [productType]);

  const setLocal = (k, v) => setLocalVals(prev => ({ ...prev, [k]: v }));

  const tags = spec
    ? buildTagsFromSchema(productType, { ...localVals, brand, colour })
    : [category, brand, colour, pStyle,
       colour ? `Colour_${colour}` : "", brand  ? `Brand_${brand}`  : "",
       pStyle ? `Style_${pStyle}`  : "", size   ? `Size_${size}`    : ""]
        .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1500); };

  const metafields = { Brand: brand, Colour: colour, Size: size, Style: pStyle, Collections: spec ? spec.collection : category };

  const renderField = (fieldKey) => {
    const def    = TAG_FIELD_DEFS[fieldKey];
    const opts   = spec?.[`${fieldKey}Options`] || [];
    const val    = localVals[fieldKey] || "";
    const isAuto = (fieldKey === "size" && val === size) || (fieldKey === "style" && val === pStyle);
    return (
      <Field key={fieldKey} label={def.label}>
        {opts.length > 0
          ? <Select value={val} onChange={v => setLocal(fieldKey, v)} options={opts} placeholder={`Select ${def.label}...`} />
          : <div style={{ position: "relative" }}>
              <Input value={val} onChange={v => setLocal(fieldKey, v)} placeholder={def.label}
                style={isAuto ? { borderColor: "#c9933a55", paddingRight: 52 } : {}} />
              {isAuto && (
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#c9933a", fontWeight: 800, background: "#c9933a22", borderRadius: 3, padding: "1px 5px", pointerEvents: "none" }}>AUTO</span>
              )}
            </div>}
        <div style={{ fontSize: 10, color: tagColor(`${def.prefix}x`), marginTop: 3 }}>→ {def.prefix}{val || "…"}</div>
      </Field>
    );
  };

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-tags"></i> Tags & Metafields</SectionTitle>

      {spec
        ? <div style={{ fontSize: 11, color: "#16a34a", background: "#14532d22", border: "1px solid #16a34a44", borderRadius: 6, padding: "6px 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <i className="fa-solid fa-circle-check"></i> Tag schema loaded for <strong>{productType}</strong>
            {spec.noBrand && <span style={{ color: "#f59e0b", marginLeft: 6, fontWeight: 700 }}>· Brand_ omitted (tiles)</span>}
          </div>
        : <div style={{ fontSize: 11, color: "#f59e0b", background: "#78350f22", border: "1px solid #f59e0b44", borderRadius: 6, padding: "6px 10px", marginBottom: 14 }}>
            <i className="fa-solid fa-triangle-exclamation fa-fade"></i>{" "}
            Select a <strong>Product Type</strong> to load the precise tag structure.
          </div>}

      {spec && schemaFields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {schemaFields.map(fk => renderField(fk))}
        </div>
      )}

      <Field label="Generated Tags (paste into Shopify)">
        <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 10, border: "1px solid #333" }}>
          {tags.length > 0
            ? <>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {tags.map((tag, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#111", borderRadius: 6, padding: "5px 10px", border: "1px solid #1a1a1a" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tagColor(tag), fontFamily: "monospace", wordBreak: "break-all" }}>{tag}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 8, wordBreak: "break-all" }}>{tags.join(", ")}</div>
              </>
            : <div style={{ color: "#444", fontSize: 12, marginBottom: 8 }}>— fill Brand and Colour to generate tags —</div>}
          <Btn onClick={() => copy(tags.join(", "), "tags")} variant="ghost" small>
            {copied === "tags" ? <><i className="fa-solid fa-check"></i> Copied!</> : <><i className="fa-regular fa-copy"></i> Copy Tags</>}
          </Btn>
        </div>
      </Field>

      {/* TAG PREFIX LEGEND */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, background: "#0a0a0a", borderRadius: 8, padding: "8px 12px", border: "1px solid #1a1a1a" }}>
        {[["Collections_","#c9933a"],["Style_","#34d399"],["Config_","#fb923c"],
          ["Size_","#f472b6"],["Shape_","#38bdf8"],["Finish_","#a3e635"],
          ["Brand_","#60a5fa"],["Colour_","#a78bfa"]].map(([p, c]) => (
          <span key={p} style={{ fontSize: 9, fontWeight: 700, color: c, fontFamily: "monospace" }}>{p}</span>
        ))}
      </div>

      <Field label="Metafields">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 8 }}>
          {Object.entries(metafields).map(([k, v]) => (
            <div key={k} style={{ background: "#0d0d0d", borderRadius: 8, padding: "8px 12px", border: "1px solid #222" }}>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 13, color: v ? "#fff" : "#444", wordBreak: "break-word" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}