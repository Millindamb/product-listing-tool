// ─── BASE UI COMPONENTS ───────────────────────────────────────────────────────

export const Badge = ({ ok, children }) => (
  <span style={{
    display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
    background: ok ? "#14532d22" : "#7f1d1d22",
    color: ok ? "#16a34a" : "#dc2626",
    border: `1px solid ${ok ? "#16a34a" : "#dc2626"}`,
  }}>
    {children}
  </span>
);

export const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{
      display: "block", fontSize: 12, fontWeight: 600, color: "#aaa",
      marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{hint}</div>}
  </div>
);

export const Input = ({ value, onChange, placeholder, type = "text", style = {} }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    type={type}
    style={{
      width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
      padding: "9px 12px", color: "#fff", fontSize: 14, outline: "none",
      boxSizing: "border-box", ...style,
    }}
  />
);

export const Select = ({ value, onChange, options, placeholder }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
      padding: "9px 12px", color: value ? "#fff" : "#666", fontSize: 14,
      outline: "none", boxSizing: "border-box",
    }}
  >
    <option value="">{placeholder || "Select..."}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

export const Btn = ({ onClick, children, variant = "primary", disabled = false, small = false }) => {
  const bg  = variant === "primary" ? "#c9933a" : variant === "danger" ? "#7f1d1d" : variant === "success" ? "#14532d" : "#2a2a2a";
  const col = variant === "ghost" ? "#aaa" : "#fff";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color: col, border: "none", borderRadius: 8,
        padding: small ? "6px 14px" : "10px 20px", fontSize: small ? 12 : 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, transition: "opacity .2s",
      }}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, style = {} }) => (
  <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, ...style }}>
    {children}
  </div>
);

export const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: "#c9933a", textTransform: "uppercase",
    letterSpacing: 2, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #222",
  }}>
    {children}
  </div>
);