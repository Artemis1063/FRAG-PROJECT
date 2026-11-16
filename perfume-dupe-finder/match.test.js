// Run: node match.test.js  (exits 1 on any failure)
const M = require("./match.js");
const data = JSON.parse(require("fs").readFileSync(__dirname + "/data.json", "utf8"));
const idx = M.buildIndex(data);

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok || !detail ? "" : "  -- " + detail));
  if (!ok) failed++;
}
const find = (q) => M.search(idx, q, 1)[0];
const label = (p) => p ? p.b + " " + p.n : "(none)";
const listOf = (r) => r.mode === "cheaper" ? r.cheaper : r.smellsLike.concat(r.similar);

// Search
for (const [q, want] of [
  ["BR540", "Baccarat Rouge 540"], ["baccarat", "Baccarat Rouge 540"],
  ["tobaco vanile", "Tobacco Vanille"], ["club de nuit intense", "Club de Nuit Intense"],
  ["santal 33", "Santal 33"], ["angels share", "Angels' Share"], ["aventus", "Aventus"],
]) {
  const p = find(q);
  check(`search "${q}" finds ${want}`, p && p.n.indexOf(want) === 0, label(p));
}

// Note-based matching finds a famous clone without any dupe link.
const aventus = find("creed aventus");
const avRes = M.findDupes(idx, aventus).cheaper;
check("Aventus: Armaf Club de Nuit Intense Man among the results",
  avRes.some((r) => r.perfume.n === "Club de Nuit Intense Man"),
  avRes.map((r) => label(r.perfume)).join("; "));

// Sharing only very common notes isn't a match.
const common = M.pyramidPerfume(idx, { top: ["Bergamot"], heart: ["Jasmine"], base: ["Musk", "Vanilla"] });
const s = M.similarity(idx, aventus, common).score;
check(`common notes only score below cutoff (${s} < ${M.CUTOFF})`, s < M.CUTOFF);

// Rules over every perfume.
let pricey = [], order = [], missingKnown = [], bounds = [];
for (const o of data.perfumes) {
  const r = M.findDupes(idx, o);
  const all = listOf(r);
  for (const x of all) if (x.score < 0 || x.score > 100) bounds.push(label(x.perfume));
  if (r.mode === "cheaper") {
    if (r.cheaper.length > 10) bounds.push(label(o) + " has >10");
    for (const x of r.cheaper) if (o.p && x.perfume.p && x.perfume.p > 0.7 * o.p) pricey.push(label(o) + " -> " + label(x.perfume));
    const firstOther = r.cheaper.findIndex((x) => !x.knownDupe);
    if (firstOther >= 0 && r.cheaper.slice(firstOther).some((x) => x.knownDupe)) order.push(label(o));
    // Every cheaper perfume that lists `o` in dupeOf must show (up to the 10 shown).
    const known = o.dupes.map((id) => idx.byId[id]).filter((c) => !(o.p && c.p && c.p > 0.7 * o.p));
    const shown = new Set(r.cheaper.map((x) => x.perfume.id));
    if (known.length <= 10) for (const c of known) if (!shown.has(c.id)) missingKnown.push(label(o) + " -> " + label(c));
  }
}
check("scores within 0-100 and at most 10 results", !bounds.length, bounds.slice(0, 5).join("; "));
check("no 'cheaper' result costs more than 70% of the original", !pricey.length, pricey.slice(0, 5).join("; "));
check("known dupes are listed before other matches", !order.length, order.slice(0, 5).join("; "));
check("every known cheaper dupe is shown", !missingKnown.length, missingKnown.slice(0, 5).join("; "));

// Affordable originals get the two-section view.
const khamrah = find("lattafa khamrah");
const kr = M.findDupes(idx, khamrah);
check("Khamrah gets 'smells like' and 'similar' sections", kr.mode === "affordable" && kr.similar.length > 0);
if (khamrah.d.length) {
  check("Khamrah 'smells like' starts with what it's a dupe of",
    khamrah.d.indexOf(kr.smellsLike[0].perfume.id) >= 0, label(kr.smellsLike[0] && kr.smellsLike[0].perfume));
}

// Flat-note perfumes still match.
const santal = find("santal 33");
check("Santal 33 (flat notes) returns results", santal && listOf(M.findDupes(idx, santal)).length > 0);

// Spot-check famous dupe pairs once the research data links them.
for (const [orig, dupe] of [
  ["kilian angels share", "lattafa khamrah"], ["creed aventus", "armaf club de nuit intense man"],
  ["baccarat rouge 540", "ariana grande cloud"], ["tom ford tobacco vanille", "afnan"],
]) {
  const o = find(orig), d = find(dupe);
  if (!o || !d || (d.d || []).indexOf(o.id) < 0) { console.log(`skip ${orig} <- ${dupe} (no dupe link yet)`); continue; }
  const top = listOf(M.findDupes(idx, o)).slice(0, 3).map((x) => x.perfume.id);
  check(`${label(d)} is a top-3 result for ${label(o)}`, top.indexOf(d.id) >= 0, top.join(", "));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
