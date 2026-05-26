import { Badge, Btn } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";

export default function ProductList({ products, onDelete, onExportXlsx, onExportCSV }) {
  const { isMobile } = useResponsive();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Product Queue ({products.length})</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={onExportCSV}  variant="primary" disabled={products.length === 0}>
            <i className="fa-solid fa-cloud-arrow-down"></i>{!isMobile && " Shopify Import CSV"}
          </Btn>
          <Btn onClick={onExportXlsx} variant="success" disabled={products.length === 0}>
            <i className="fa-solid fa-cloud-arrow-down"></i>{!isMobile && " Final Pricing + Competitor (.xlsx)"}
          </Btn>
        </div>
      </div>

      <div style={{ background: "#0d0d0d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: "#666", border: "1px solid #1a1a1a" }}>
        <span style={{ color: "#c9933a", fontWeight: 700 }}>Shopify Import CSV</span> — exact 7-column format &nbsp;·&nbsp;
        <span style={{ color: "#16a34a", fontWeight: 700 }}>Final Pricing .xlsx</span> — 3 sheets: Final Pricing + Competitor Analysis + Pricing Reference
      </div>

      {products.length === 0 && (
        <div style={{ textAlign: "center", color: "#555", padding: 40, background: "#0d0d0d", borderRadius: 10 }}>
          No products in queue yet — add products using the Add Product tab
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {products.map((p, i) => (
          <div key={p._id || i} style={{
            background: "#111", border: "1px solid #222", borderRadius: 10,
            padding: "12px 16px", display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: isMobile ? "100%" : 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2, wordBreak: "break-word" }}>{p.productTitle || p.sku}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{p.category} · {p.brand} · SKU: {p.sku}</div>
            </div>
            <div style={{ display: "flex", gap: isMobile ? 10 : 16, alignItems: "center", flexWrap: "wrap" }}>
              {[
                { label: "CP (inc GST)", val: p.cpGST  ? `$${p.cpGST}`  : "—"        },
                { label: "SP",           val: p.sp      ? `$${p.sp}`     : "—", gold: true },
                { label: "RRP",          val: p.rrp     ? `$${p.rrp}`    : "—"        },
                { label: "Weight",       val: p.weight  ? `${p.weight}kg`: "—"        },
              ].map(({ label, val, gold }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#555" }}>{label}</div>
                  <div style={{ fontSize: gold ? 16 : 13, fontWeight: gold ? 800 : 400, color: gold ? "#c9933a" : "#aaa" }}>{val}</div>
                </div>
              ))}
              <Badge ok={p.marginOk}>
                {p.marginOk ? <><i className="fa-solid fa-check"></i> Margin</> : <><i className="fa-solid fa-xmark"></i> Margin</>}
              </Badge>
              <Btn onClick={() => onDelete(p._id || i)} variant="danger" small>
                <i className="fa-solid fa-xmark"></i>
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}