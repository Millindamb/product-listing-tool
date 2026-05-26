import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Field, Input, Btn, Badge, SectionTitle } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";
import { calcMargin, calcWeight } from "../utils/pricing";

const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";

const MODES = [
  { key: "margin",       label: "CP + Min Margin", desc: "Default — adds minimum margin to CP" },
  { key: "rrp85",        label: "RRP x 0.85",      desc: "15% off RRP"                         },
  { key: "rrp90",        label: "RRP x 0.90",      desc: "10% off RRP"                         },
  { key: "cpMultiplier", label: "CP = RRP x ?",    desc: "Custom CP from RRP multiplier"       },
  { key: "spMultiplier", label: "SP = RRP x ?",    desc: "Custom SP from RRP multiplier"       },
];

export default function PricingPanel({ category, brand, supplierUrl, sku, onResult, autoRrp, autoRrpIncludesGST }) {
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
    setResult(r);
    onResult?.(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, pricingMode, cpMultiplier, spMultiplier, category, brand]);

  useEffect(() => {
    const canCalc =
      (pricingMode === "cpMultiplier" && rrpRaw && cpMultiplier) ||
      (pricingMode === "spMultiplier" && rrpRaw && spMultiplier) ||
      (["margin","rrp85","rrp90"].includes(pricingMode) && cpRaw);
    if (canCalc) calculate();
  }, [cpRaw, cpGST, rrpRaw, rrpGST, manualSP, pricingMode, cpMultiplier, spMultiplier, calculate]);

  const rrpNum = getRRP();

  return (
    <div>
      <SectionTitle><i className="fa-solid fa-dollar-sign"></i> Pricing Calculator</SectionTitle>

      {/* MODE SELECTOR */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>PRICING MODE</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 6 }}>
          {MODES.map(m => (
            <div key={m.key} onClick={() => setPricingMode(m.key)}
              style={{
                border: `1px solid ${pricingMode === m.key ? "#c9933a" : "#333"}`, borderRadius: 8,
                padding: "8px 10px", cursor: "pointer",
                background: pricingMode === m.key ? "#c9933a22" : "#111", transition: "all .15s",
              }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: pricingMode === m.key ? "#c9933a" : "#888" }}>{m.label}</div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MULTIPLIER INPUTS */}
      {(pricingMode === "cpMultiplier" || pricingMode === "spMultiplier") && (
        <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 12, marginBottom: 12, border: "1px solid #c9933a33" }}>
          <div style={{ fontSize: 11, color: "#c9933a", fontWeight: 700, marginBottom: 8 }}>
            <i className="fa-solid fa-pen-to-square"></i> Custom Multiplier — RRP must be entered below
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {pricingMode === "cpMultiplier" && (
              <Field label="CP Multiplier" hint="CP = RRP x this number">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#888", fontSize: 12, whiteSpace: "nowrap" }}>RRP x</span>
                  <Input value={cpMultiplier} onChange={setCpMultiplier} placeholder="e.g. 0.65" type="number" style={{ flex: 1 }} />
                </div>
                {rrpNum && cpMultiplier && (
                  <div style={{ fontSize: 11, color: "#c9933a", marginTop: 4 }}>= ${(rrpNum * +cpMultiplier).toFixed(2)} CP (inc GST)</div>
                )}
              </Field>
            )}
            <Field label={pricingMode === "cpMultiplier" ? "SP Multiplier (optional)" : "SP Multiplier"} hint="SP = RRP x this number">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#888", fontSize: 12, whiteSpace: "nowrap" }}>RRP x</span>
                <Input value={spMultiplier} onChange={setSpMultiplier} placeholder="e.g. 0.85" type="number" style={{ flex: 1 }} />
              </div>
              {rrpNum && spMultiplier && (
                <div style={{ fontSize: 11, color: "#c9933a", marginTop: 4 }}>= ${Math.round(rrpNum * +spMultiplier)} SP</div>
              )}
            </Field>
          </div>
        </div>
      )}

      {/* CP & RRP INPUTS */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="Cost Price (CP)" hint={pricingMode === "cpMultiplier" ? "Auto-calculated from RRP x multiplier" : "Supplier's price — GST added if not included"}>
          {pricingMode === "cpMultiplier" ? (
            <Input value={rrpNum && cpMultiplier ? (rrpNum * +cpMultiplier).toFixed(2) : ""}
              onChange={() => {}} placeholder="Auto from RRP x multiplier" style={{ opacity: 0.5, cursor: "not-allowed" }} />
          ) : (
            <>
              <Input value={cpRaw} onChange={setCp} placeholder="90.00" type="number" />
              <label style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={cpGST} onChange={e => setCpGST(e.target.checked)} />
                Already includes GST
              </label>
            </>
          )}
        </Field>
        <Field label="RRP" hint={autoRrp ? "Auto-filled from URL fetch" : "From supplier catalogue — or click Fetch below"}>
          <Input value={rrpRaw} onChange={setRrp} placeholder="200.00" type="number"
            style={autoRrp && rrpRaw === String(autoRrp) ? { borderColor: "#c9933a55" } : {}} />
          <label style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={rrpGST} onChange={e => setRrpGST(e.target.checked)} />
            Already includes GST
          </label>
        </Field>
      </div>

      {/* FETCH RRP BUTTON */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn onClick={fetchRRP} disabled={fetching || (!supplierUrl && !sku)} variant="ghost" small>
          {fetching
            ? <><i className="fa-solid fa-spinner fa-spin"></i> Scraping page...</>
            : <><i className="fa-solid fa-magnifying-glass"></i> Fetch RRP from Supplier Page</>}
        </Btn>
        {!supplierUrl && !sku && (
          <span style={{ fontSize: 11, color: "#555" }}>Enter Supplier URL above first</span>
        )}
        {fetchMsg && (
          <span style={{ fontSize: 11, color: fetchMsg.startsWith("✓") ? "#16a34a" : fetchMsg.includes("estimated") || fetchMsg.includes("verify") ? "#f59e0b" : "#ef4444" }}>
            {fetchMsg}
          </span>
        )}
      </div>

      <Field label="Override SP (optional)" hint="Leave blank to auto-calculate">
        <Input value={manualSP} onChange={setManualSP} placeholder="Leave blank for auto" type="number" />
      </Field>

      {/* RESULT */}
      {result && (
        <div style={{ marginTop: 12, background: "#0d0d0d", borderRadius: 10, padding: 16, border: `1px solid ${result.marginOk ? "#16a34a44" : "#dc262644"}` }}>
          <div style={{ fontSize: 10, color: "#555", textAlign: "center", marginBottom: 8 }}>
            Mode: {MODES.find(m => m.key === pricingMode)?.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
            {[
              { label: "CP (inc GST)", val: `$${result.cp}`,       color: "#aaa"     },
              { label: "RRP",          val: `$${result.rrp}`,      color: "#aaa"     },
              { label: "Selling Price",val: `$${result.sp}`,       color: "#c9933a"  },
              { label: "Weight",       val: `${result.weight} kg`, color: "#aaa"     },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Badge ok={result.marginOk}>
              {result.marginOk ? <><i className="fa-solid fa-check"></i> Margin OK</> : <>Margin Too Low <i className="fa-solid fa-arrow-trend-down"></i></>}
            </Badge>
            <span style={{ fontSize: 12, color: "#888" }}>Margin: ${result.actualMargin} / Required: ${result.required}</span>
            {result.weightNote && <span style={{ fontSize: 11, color: "#666" }}>{result.weightNote}</span>}
          </div>
        </div>
      )}
    </div>
  );
}