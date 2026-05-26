import { MARGIN_RULES_FE, WEIGHT_RULES_FE, SCHEMAS_FE, TAG_FIELD_DEFS, PRODUCT_TAG_MAP_FE } from "../businessRule";

export function calcMargin(cat, cp, rrp) {
  const r = MARGIN_RULES_FE[cat];
  if (!r) return { sp: Math.round(cp + 1), ok: true, required: 0 };
  if (r.hardMin) return { sp: Math.max(r.hardMin, Math.round(cp + 1)), ok: true, required: r.hardMin, hardMin: true };
  let margin = r.margin || 0;
  if (r.threshold && cp >= r.threshold) margin = r.overThreshold;
  let sp = Math.round(cp + margin);
  if (r.capAtRRP && rrp && sp > rrp) sp = rrp;
  return { sp, required: margin, ok: sp - cp >= margin };
}

export function calcWeight(cat, sp, brand) {
  if (["TOTO", "Lafeme"].includes(brand)) return { w: 1, note: "TOTO/Lafeme = 1kg" };
  const r = WEIGHT_RULES_FE[cat];
  if (r === "formula") {
    if (+sp < 150) return { w: +(+sp / 150).toFixed(3), note: `SP/150 = ${sp}/150` };
    return { w: 1, note: "SP >= $150 -> 1kg" };
  }
  return { w: r || 1, note: "" };
}

export function buildTagsFromSchema(productType, vals) {
  const spec = PRODUCT_TAG_MAP_FE[productType];
  if (!spec) return [];
  const schema      = SCHEMAS_FE[spec.schema] || [];
  const extraFields = spec.extraFields || [];
  const allFields   = [...new Set([...schema, ...extraFields])];
  const tags = [`Collections_${spec.collection}`];
  for (const fk of allFields) {
    const def = TAG_FIELD_DEFS[fk];
    if (!def) continue;
    const v = vals[fk];
    if (v && String(v).trim()) tags.push(`${def.prefix}${String(v).trim()}`);
  }
  if (!spec.noBrand && vals.brand && String(vals.brand).trim()) tags.push(`Brand_${String(vals.brand).trim()}`);
  if (vals.colour && String(vals.colour).trim()) tags.push(`Colour_${String(vals.colour).trim()}`);
  return tags;
}