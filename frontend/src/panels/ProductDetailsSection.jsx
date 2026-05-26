import { Field, Input, Select, SectionTitle } from "../components/ui";
import { ALL_CATEGORIES, ALL_PRODUCT_TYPES_FLAT, PRODUCT_TITLE_FORMATS, PRODUCT_TAG_MAP_FE } from "../businessRule";

export default function ProductDetailsSection({
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
      <div style={{ background: "#0a0f0a", border: "2px solid #c9933a44", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, background: "#c9933a22", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="fa-solid fa-list-check" style={{ color: "#c9933a", fontSize: 14 }}></i>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c9933a", letterSpacing: 0.3 }}>AUTO-FILL FROM URL</div>
            <div style={{ fontSize: 11, color: "#555" }}>Paste supplier URL → AI scrapes and fills all fields + generates description</div>
          </div>
        </div>

        <Field label="Supplier URL">
          <Input value={supplierUrl} onChange={setSupplierUrl} placeholder="https://supplier.com/product-page" />
        </Field>

        <button
          onClick={handleAutoFill}
          disabled={autoFilling || !supplierUrl}
          style={{
            width: "100%", marginTop: 2,
            background: autoFilling ? "#1a1a1a" : "linear-gradient(135deg,#c9933a,#e6a93e)",
            border: "none", borderRadius: 8, padding: "11px 16px",
            color: autoFilling ? "#888" : "#000", fontSize: 13, fontWeight: 800,
            cursor: autoFilling || !supplierUrl ? "not-allowed" : "pointer",
            opacity: !supplierUrl ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            letterSpacing: 0.3, transition: "all .2s",
          }}>
          {autoFilling
            ? <><i className="fa-solid fa-spinner fa-spin"></i> Analysing with AI...</>
            : <><i className="fa-solid fa-bolt"></i> Auto-fill All Fields from URL</>}
        </button>

        {autoFillMsg && (
          <div style={{ fontSize: 11, marginTop: 8, padding: "6px 10px", borderRadius: 6, background: msgBg, color: msgColor, border: `1px solid ${msgBorder}` }}>
            {msgText}
          </div>
        )}

        {/* EXTRACTED DATA PREVIEW */}
        {autoFillPreview && (
          <div style={{ marginTop: 10, background: "#0d0d0d", borderRadius: 8, padding: 12, border: "1px solid #1e1e1e" }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              Extracted Data Preview
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Product Name", val: autoFillPreview.name       },
                { label: "Brand",        val: autoFillPreview.brand      },
                { label: "Collection",   val: autoFillPreview.collection },
                { label: "Colour",       val: autoFillPreview.colour     },
                { label: "Size",         val: autoFillPreview.size       },
                { label: "RRP",          val: autoFillPreview.rrp ? `$${autoFillPreview.rrp}` : null },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: "#111", borderRadius: 6, padding: "5px 8px" }}>
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 1, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 11, color: val ? "#e0e0e0" : "#444", fontWeight: val ? 600 : 400, wordBreak: "break-word" }}>{val || "—"}</div>
                </div>
              ))}
            </div>
            {autoFillPreview.imageUrls?.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#555" }}>Images found:</span>
                {autoFillPreview.imageUrls.slice(0, 3).map((src, i) => (
                  <img key={i} src={src} alt={`img-${i}`}
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #333" }}
                    onError={e => { e.target.style.display = "none"; }} />
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "#555" }}>Confidence:</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: autoFillPreview.confidence === "high" ? "#16a34a" : autoFillPreview.confidence === "medium" ? "#f59e0b" : "#ef4444",
              }}>
                {(autoFillPreview.confidence || "medium").toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: "#444" }}>·</span>
              <span style={{ fontSize: 10, color: "#555" }}>{autoFillPreview.scrapedOk ? "Page scraped" : "URL-based estimate"}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#c9933a", background: "#c9933a11", border: "1px solid #c9933a22", borderRadius: 6, padding: "5px 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <i className="fa-solid fa-list"></i> Brand, Collection, Colour and Size sync automatically to Title Builder and Description
      </div>

      <Field label="SKU *"><Input value={sku} onChange={setSku} placeholder="ABC-123" /></Field>

      <Field label="Category *">
        <Select value={category} onChange={setCategory} options={ALL_CATEGORIES} placeholder="Select category" />
      </Field>

      <Field label="Product Type" hint="Sets the exact title format and Shopify tag structure for this product">
        <Select value={productType} onChange={setProductType} options={ALL_PRODUCT_TYPES_FLAT} placeholder="Select product type…" />
        {productType && PRODUCT_TAG_MAP_FE[productType] && (
          <div style={{ fontSize: 10, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <i className="fa-solid fa-circle-check"></i>
            {PRODUCT_TITLE_FORMATS[productType]
              ? <>Title: <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{PRODUCT_TITLE_FORMATS[productType].parts.join(" › ")}</span></>
              : "Tag schema loaded"}
            {PRODUCT_TAG_MAP_FE[productType].noBrand && <span style={{ color: "#f59e0b", marginLeft: 4 }}>· Brand_ omitted</span>}
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