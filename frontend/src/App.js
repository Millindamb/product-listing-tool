import { useState, useEffect } from "react";
import axios from "axios";

// Hooks
import { useResponsive } from "./hooks/useResponsive";

// UI base components
import { Card, Btn } from "./components/ui";

// Panels / sections
import ProductDetailsSection from "./panels/ProductDetailsSection";
import TitleBuilder          from "./panels/TitleBuilder";
import PricingPanel          from "./panels/PricingPanel";
import DescriptionBuilder    from "./panels/DescriptionBuilder";
import TagsPanel             from "./panels/TagsPanel";
import ProductList           from "./panels/ProductList";
import RepriceCalculator     from "./panels/RepriceCalculator";

const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";

const MOBILE_SECTIONS = [
  { key: "details",     label: "Details"  },
  { key: "title",       label: "Title"    },
  { key: "pricing",     label: "Pricing"  },
  { key: "description", label: "Desc"     },
  { key: "tags",        label: "Tags"     },
];

export default function App() {
  const { isMobile, isTablet } = useResponsive();
  const isSingleCol = isMobile || isTablet;

  // ── Top-level tab ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState("form");

  // ── Product queue ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState("");

  // ── Shared product fields (synced across panels) ───────────────────────────
  const [sharedBrand,      setSharedBrand]      = useState("");
  const [sharedCollection, setSharedCollection] = useState("");
  const [sharedColour,     setSharedColour]     = useState("");
  const [sharedSize,       setSharedSize]       = useState("");

  // ── Form-level fields ──────────────────────────────────────────────────────
  const [supplierUrl,    setSupplierUrl]    = useState("");
  const [sku,            setSku]            = useState("");
  const [category,       setCategory]       = useState("");
  const [productType,    setProductType]    = useState("");
  const [style,          setStyle]          = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [pricing,        setPricing]        = useState(null);
  const [notes,          setNotes]          = useState("");

  // ── Auto-fill state ────────────────────────────────────────────────────────
  const [autoFilled,       setAutoFilled]       = useState(null);
  const [autoFilledRrp,    setAutoFilledRrp]    = useState(null);
  const [autoFilledRrpGST, setAutoFilledRrpGST] = useState(true);
  const [autoFilling,      setAutoFilling]      = useState(false);
  const [autoFillMsg,      setAutoFillMsg]      = useState("");
  const [autoFillPreview,  setAutoFillPreview]  = useState(null);

  // ── Mobile section nav ─────────────────────────────────────────────────────
  const [mobileSection, setMobileSection] = useState("details");

  // ── Load product queue on mount ────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/products`).then(r => setProducts(r.data)).catch(() => {});
  }, []);

  // Reset product type when category changes
  useEffect(() => { setProductType(""); }, [category]);

  // ── Parse auto-fill message type ───────────────────────────────────────────
  const [msgType, msgText] = autoFillMsg.includes("|") ? autoFillMsg.split("|") : ["info", autoFillMsg];
  const msgColor  = msgType === "success" ? "#16a34a" : msgType === "error" ? "#ef4444" : "#f59e0b";
  const msgBg     = msgType === "success" ? "#14532d22" : msgType === "error" ? "#7f1d1d22" : "#78350f22";
  const msgBorder = msgType === "success" ? "#16a34a44" : msgType === "error" ? "#ef444433" : "#f59e0b44";

  // ── Auto-fill handler ──────────────────────────────────────────────────────
  const handleAutoFill = async () => {
    if (!supplierUrl) { setAutoFillMsg("warn|Enter a Supplier URL first"); return; }
    setAutoFilling(true); setAutoFillMsg(""); setAutoFillPreview(null);
    setAutoFilled(null); setAutoFilledRrp(null);
    try {
      const { data } = await axios.post(`${API}/description/fetch-from-url`, { supplierUrl, category: category || "" });
      if (data.brand)      setSharedBrand(data.brand);
      if (data.collection) setSharedCollection(data.collection);
      if (data.colour)     setSharedColour(data.colour);
      if (data.size)       setSharedSize(data.size);
      if (data.rrp)        { setAutoFilledRrp(data.rrp); setAutoFilledRrpGST(data.rrpIncludesGST !== false); }
      setAutoFilled(data);
      setAutoFillPreview({
        name: data.name, brand: data.brand, collection: data.collection, colour: data.colour,
        size: data.size, rrp: data.rrp, confidence: data.confidence,
        imageUrls: data.imageUrls || [], scrapedOk: data.scrapedOk,
      });
      const conf = data.confidence || "medium";
      const src  = data.scrapedOk ? "page scraped" : "URL-based estimate";
      setAutoFillMsg(
        conf === "high"   ? `success|✓ All fields auto-filled (${src} · high confidence)` :
        conf === "medium" ? `warn|✓ Fields filled (${src} · medium confidence) — review carefully` :
                            `warn|⚠ Low confidence (${src}) — verify all fields manually`
      );
    } catch (err) {
      setAutoFillMsg(`error|❌ ${err.response?.data?.error || "Auto-fill failed — fill fields manually"}`);
    }
    setAutoFilling(false);
  };

  // ── Save product ───────────────────────────────────────────────────────────
  const saveProduct = async () => {
    if (!sku || !category) { setSaveMsg("SKU and Category are required"); return; }
    setSaving(true);
    const payload = {
      supplierUrl, sku, productTitle: generatedTitle, category, productType,
      brand: sharedBrand, collection: sharedCollection, colour: sharedColour, size: sharedSize, style,
      cpGST: pricing?.cp, rrp: pricing?.rrp, sp: pricing?.sp, weight: pricing?.weight,
      marginOk: pricing?.marginOk, requiredMargin: pricing?.required, notes, status: "draft",
    };
    try {
      const { data } = await axios.post(`${API}/products`, payload);
      setProducts(prev => [data, ...prev]);
      setSaveMsg("✓ Product saved to queue");
    } catch {
      setProducts(prev => [{ ...payload, _id: Date.now() }, ...prev]);
      setSaveMsg("✓ Saved locally (DB offline)");
    }
    setTimeout(() => setSaveMsg(""), 3000);
    setSaving(false);
  };

  // ── Delete product ─────────────────────────────────────────────────────────
  const deleteProduct = async (id) => {
    try { await axios.delete(`${API}/products/${id}`); } catch {}
    setProducts(prev => prev.filter(p => p._id !== id));
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    try {
      const res = await axios.post(`${API}/export/shopify-csv`, { products }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url;
      a.download = `Austpek_Shopify_Import_${Date.now()}.csv`; a.click();
    } catch {
      const headers = ["Title","Variant SKU","Variant Grams","Variant Price","Variant Compare At Price","Supplier URL (product.metafields.custom.supplier_url)","Cost per item"];
      const rows = products.map(p => [
        p.productTitle || "", p.sku || "", p.weight ? Math.round(+p.weight * 1000) : "",
        p.sp  ? `$${Math.round(p.sp)}.00`  : "",
        p.rrp ? `$${Math.round(p.rrp)}.00` : "",
        p.supplierUrl || "",
        p.cpGST ? `$${Math.round(p.cpGST)}.00` : "",
      ]);
      const csv  = [headers, ...rows].map(r => r.join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = "Austpek_Shopify_Import.csv"; a.click();
    }
  };

  // ── Export XLSX ────────────────────────────────────────────────────────────
  const exportXlsx = async () => {
    try {
      const res = await axios.post(`${API}/export/xlsx`, { products }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement("a"); a.href = url;
      a.download = `Austpek_Final_Pricing_${Date.now()}.xlsx`; a.click();
    } catch { alert("Export failed — make sure backend is running"); }
  };

  // ── Shared props for ProductDetailsSection ─────────────────────────────────
  const detailsProps = {
    supplierUrl, setSupplierUrl, sku, setSku, category, setCategory,
    productType, setProductType, sharedBrand, setSharedBrand,
    sharedCollection, setSharedCollection, sharedColour, setSharedColour,
    sharedSize, setSharedSize, style, setStyle, notes, setNotes,
    autoFilling, autoFillMsg, autoFillPreview, handleAutoFill,
    msgType, msgText, msgColor, msgBg, msgBorder,
  };

  // ── Nav config ─────────────────────────────────────────────────────────────
  const NAV = [
    { key: "form",    label: isMobile ? "Add" : <><i className="fa-solid fa-plus"></i> Add Product</> },
    { key: "queue",   label: isMobile ? `Queue (${products.length})` : <><i className="fa-solid fa-list"></i> Queue [ {products.length} ]</> },
    { key: "reprice", label: isMobile ? "Reprice" : <><i className="fa-solid fa-coins"></i> Reprice Tool <i className="fa-solid fa-angle-right"></i></> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "system-ui,sans-serif" }}>
      {/* ── HEADER ── */}
      <div style={{
        background: "#0d0d0d", borderBottom: "1px solid #1a1a1a",
        padding: isMobile ? "0 12px" : "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: isMobile ? 48 : 56, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: "#c9933a", letterSpacing: 1 }}>AUSTPEK</div>
          {!isMobile && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}><i className="fa-solid fa-box-open"></i> Product Listing Tool</div>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              style={{
                background: tab === n.key ? "#c9933a22" : "transparent",
                border: tab === n.key ? "1px solid #c9933a44" : "1px solid transparent",
                borderRadius: 8, padding: isMobile ? "5px 10px" : "6px 16px",
                color: tab === n.key ? "#c9933a" : "#888",
                fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: "pointer",
              }}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "12px 10px" : "24px 16px" }}>

        {/* ══ ADD PRODUCT TAB ══ */}
        {tab === "form" && (
          <>
            {/* Mobile section tabs */}
            {isSingleCol && (
              <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                {MOBILE_SECTIONS.map(s => (
                  <button key={s.key} onClick={() => setMobileSection(s.key)}
                    style={{
                      background: mobileSection === s.key ? "#c9933a" : "#1a1a1a",
                      color:      mobileSection === s.key ? "#000"    : "#888",
                      border:     `1px solid ${mobileSection === s.key ? "#c9933a" : "#333"}`,
                      borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop: 2-column grid */}
            {!isSingleCol && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card><ProductDetailsSection {...detailsProps} /></Card>
                  {(category || productType) && (
                    <Card>
                      <TagsPanel productType={productType} category={category}
                        brand={sharedBrand} colour={sharedColour} size={sharedSize} style={style} />
                    </Card>
                  )}
                </div>
                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {(category || productType) && (
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
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Btn onClick={saveProduct} disabled={saving} variant="primary">
                      {saving ? <>Saving <i className="fa-solid fa-spinner fa-spin"></i></> : <><i className="fa-solid fa-floppy-disk"></i> Save to Queue</>}
                    </Btn>
                    {saveMsg && (
                      <span style={{ fontSize: 13, color: saveMsg.includes("✓") ? "#16a34a" : "#ef4444" }}>{saveMsg}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile/Tablet: section-by-section */}
            {isSingleCol && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {mobileSection === "details" && (
                  <Card><ProductDetailsSection {...detailsProps} /></Card>
                )}
                {mobileSection === "title" && (
                  <Card>
                    {(category || productType)
                      ? <TitleBuilder category={category} productType={productType} onChange={setGeneratedTitle}
                          sharedBrand={sharedBrand} sharedCollection={sharedCollection}
                          sharedColour={sharedColour} sharedSize={sharedSize} />
                      : <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Select a Category first</div>}
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
                      : <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Select a Category first</div>}
                  </Card>
                )}
                {mobileSection === "tags" && (
                  <Card>
                    {(category || productType)
                      ? <TagsPanel productType={productType} category={category}
                          brand={sharedBrand} colour={sharedColour} size={sharedSize} style={style} />
                      : <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Select a Category first</div>}
                  </Card>
                )}
                {/* Save button always visible */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0" }}>
                  <Btn onClick={saveProduct} disabled={saving} variant="primary">
                    {saving ? <>Saving <i className="fa-solid fa-spinner fa-spin"></i></>: <><i className="fa-solid fa-floppy-disk"></i> Save to Queue</>}
                  </Btn>
                  {saveMsg && (
                    <span style={{ fontSize: 13, color: saveMsg.includes("✓") ? "#16a34a" : "#ef4444" }}>{saveMsg}</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ QUEUE TAB ══ */}
        {tab === "queue" && (
          <ProductList products={products} onDelete={deleteProduct} onExportCSV={exportCSV} onExportXlsx={exportXlsx} />
        )}

        {/* ══ REPRICE TAB ══ */}
        {tab === "reprice" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <RepriceCalculator />
            <div style={{ marginTop: 16, background: "#0d0d0d", borderRadius: 10, padding: 16, border: "1px solid #1a1a1a" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c9933a", marginBottom: 10 }}>Pricing Formulas (Special Guidelines)</div>
              {[
                ["Sale Price (15% off RRP)",    "= RRP x 0.85"                     ],
                ["Sale Price (10% off RRP)",    "= RRP x 0.90"                     ],
                ["RRP (when not provided)",     "= Sale Price x 1.10"              ],
                ["Cost Price (inc GST)",        "= Cost Price (ex GST) x 1.10"     ],
                ["Cost Price (alt)",            "= RRP x 0.65"                     ],
                ["Potential Margin",            "= Competitor Price - CP (inc GST)"],
              ].map(([label, formula]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12, flexWrap: "wrap", gap: 4 }}>
                  <span style={{ color: "#888" }}>{label}</span>
                  <span style={{ color: "#fff", fontFamily: "monospace" }}>{formula}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}