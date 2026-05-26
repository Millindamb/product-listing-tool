import { useState } from "react";
import axios from "axios";
import { Field, Input, Btn, Badge, Card, SectionTitle } from "../components/ui";
import { useResponsive } from "../hooks/useResponsive";

const API = import.meta.env.REACT_APP_API_URL || "https://austpek-backend.onrender.com/api";

export default function RepriceCalculator() {
  const { isMobile } = useResponsive();
  const [cp, setCp]             = useState("");
  const [rrp, setRrp]           = useState("");
  const [currentSP, setCurrentSP] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [c1, setC1]             = useState("");
  const [c2, setC2]             = useState("");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const calculate = async () => {
    if (!cp || !minMargin) return;
    setLoading(true);
    const competitors = [c1, c2].filter(Boolean).map(Number);
    try {
      const { data } = await axios.post(`${API}/export/reprice`, {
        cp: +cp, rrp: rrp ? +rrp : null, currentSP: +currentSP, minMargin: +minMargin, competitorPrices: competitors,
      });
      setResult(data);
    } catch {
      // Fallback local calculation
      const results = competitors.map((price, i) => {
        const pot = price - +cp;
        const can = pot >= +minMargin;
        const newSP = can ? (rrp ? Math.min(price, +rrp) : price) : Math.round(+cp + +minMargin);
        return {
          competitor: i + 1, competitorPrice: price, potentialMargin: +pot.toFixed(2), canReprice: can,
          newSP: Math.round(newSP),
          reason: can
            ? `Potential margin $${pot.toFixed(2)} >= min margin $${minMargin}`
            : `Margin too low — use CP + min margin`,
        };
      });
      const valid = results.filter(r => r.canReprice).map(r => r.newSP);
      const recommendedSP = valid.length > 0 ? Math.min(...valid) : Math.round(+cp + (+minMargin || 0));
      setResult({
        cp: +cp, rrp: rrp ? +rrp : null, currentSP: +currentSP, minMargin: +minMargin,
        results, recommendedSP, saving: currentSP ? Math.round(+currentSP - recommendedSP) : 0,
      });
    }
    setLoading(false);
  };

  return (
    <Card>
      <SectionTitle><i className="fa-solid fa-square-root-variable"></i> Competitive Repricing Calculator</SectionTitle>

      <div style={{ fontSize: 11, color: "#666", marginBottom: 14, padding: "6px 10px", background: "#0d0d0d", borderRadius: 6 }}>
        From Special Guidelines: Potential Margin = Competitor Price - Cost Price (inc GST)
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Cost Price (inc GST)">    <Input value={cp}        onChange={setCp}        placeholder="220.00" type="number" /></Field>
        <Field label="RRP (optional)">          <Input value={rrp}       onChange={setRrp}       placeholder="350.00" type="number" /></Field>
        <Field label="Current SP">              <Input value={currentSP} onChange={setCurrentSP} placeholder="350.00" type="number" /></Field>
        <Field label="Min Margin for Category"> <Input value={minMargin} onChange={setMinMargin} placeholder="e.g. 65 for Basins" type="number" /></Field>
        <Field label="Competitor 1 Price">      <Input value={c1}        onChange={setC1}        placeholder="315.00" type="number" /></Field>
        <Field label="Competitor 2 Price">      <Input value={c2}        onChange={setC2}        placeholder="299.00" type="number" /></Field>
      </div>

      <Btn onClick={calculate} disabled={loading || !cp || !minMargin}>
        {loading ? <>Calculating <i className="fa-solid fa-spinner fa-spin"></i></> : "Calculate Reprice"}
      </Btn>

      {result && (
        <div style={{ marginTop: 16 }}>
          {result.results.map(r => (
            <div key={r.competitor} style={{
              background: "#0d0d0d", borderRadius: 8, padding: 14, marginBottom: 8,
              border: `1px solid ${r.canReprice ? "#16a34a44" : "#ef444433"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#fff" }}>Competitor {r.competitor} — ${r.competitorPrice}</span>
                <Badge ok={r.canReprice}>{r.canReprice ? "✓ Can Reprice" : "✗ Cannot Match"}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>{r.reason}</div>
              <div style={{ fontSize: 13, color: "#c9933a", fontWeight: 700, marginTop: 4 }}>New SP → ${r.newSP}</div>
            </div>
          ))}
          <div style={{ background: "#c9933a22", border: "1px solid #c9933a44", borderRadius: 8, padding: 14, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#c9933a", fontWeight: 700, marginBottom: 4 }}>Recommended Final SP</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#c9933a" }}>${result.recommendedSP}</div>
            {result.saving > 0 && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Price reduction from current: ${result.saving}</div>
            )}
            {result.rrp && result.recommendedSP > result.rrp && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                <i className="fa-solid fa-triangle-exclamation fa-fade"></i> Exceeds RRP ${result.rrp} — needs senior approval
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}