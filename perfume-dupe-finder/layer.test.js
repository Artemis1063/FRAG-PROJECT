// Run: node layer.test.js  (exits 1 on any failure)
const M = require("./match.js");
const L = require("./layer.js");
const data = JSON.parse(require("fs").readFileSync(__dirname + "/data.json", "utf8"));
const idx = M.buildIndex(data);

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok || !detail ? "" : "  -- " + detail));
  if (!ok) failed++;
}
const find = (q) => M.search(idx, q, 1)[0];
const show = (r) => JSON.stringify(r.scores) + " overall " + r.overall;

// Every pair: scores in range, the clash cap holds, advice matches the score.
const ps = idx.perfumes.filter(L.hasNotes);
let bad = [], capBroken = [], adviceBroken = [];
for (let i = 0; i < ps.length; i += 7) {
  for (let j = 3; j < ps.length; j += 97) {
    if (i === j) continue;
    const r = L.pair(idx, ps[i], ps[j]);
    const vals = Object.values(r.scores).filter((v) => v != null).concat(r.overall);
    if (vals.some((v) => v < 0 || v > 100 || !Number.isInteger(v))) bad.push(ps[i].id + "+" + ps[j].id);
    if (r.scores.smell < L.CLASH && r.overall > L.CAP) capBroken.push(ps[i].id + "+" + ps[j].id);
    if (r.advice.place === "same" && r.scores.smell < L.SAME_POINT) adviceBroken.push(ps[i].id + "+" + ps[j].id);
  }
}
check("all scores are whole numbers from 0 to 100", !bad.length, bad.slice(0, 3).join(", "));
check("overall never above 50 when How it smells is below 45", !capBroken.length, capBroken.slice(0, 3).join(", "));
check("same pulse point only advised at 70+", !adviceBroken.length, adviceBroken.slice(0, 3).join(", "));

// Weights: with no performance data the overall is How it smells.
const khamrah = find("lattafa khamrah"), v28 = find("kayali vanilla 28");
const kv = L.pair(idx, khamrah, v28);
check("no performance data: overall equals How it smells", kv.basedOn === 1 && kv.overall === kv.scores.smell, show(kv));
// With all four: 55/15/15/15.
const tv = find("tobacco vanille"), kt = L.pair(idx, khamrah, tv);
const s = kt.scores, want = Math.round(0.55 * s.smell + 0.15 * (s.sillage + s.projection + s.longevity));
check("all four scores: How it smells weighs 55%", kt.basedOn === 4 && (kt.capped || kt.overall === want), show(kt));

// Spot checks from the design.
check("Khamrah + Vanilla 28 (vanilla gourmands) blend well", kv.scores.smell >= 70, show(kv));
check("Khamrah + Tobacco Vanille blend reasonably", kt.scores.smell >= 55, show(kt));
const bdc = L.pair(idx, find("bleu de chanel"), find("dior sauvage"));
check("Bleu de Chanel + Sauvage blend well", bdc.scores.smell >= 70, show(bdc));
const clash = L.pair(idx, find("tom ford oud wood"), find("acqua di gio"));
check("Oud Wood + Acqua di Gio (oud vs aquatic) score as a clash", clash.scores.smell < L.CLASH, show(clash));
check("a clash is named in the reasons", clash.reasons.some((x) => /clash/.test(x)), clash.reasons.join(" "));
check("a clashing pair is kept apart", clash.advice.place === "apart", clash.advice.place);

// Affinity rules.
check("amber + musk is a classic pairing", L.affinity(idx, "amber", "musk")[0] === 2);
check("vanilla + sandalwood is a classic pairing", L.affinity(idx, "vanilla", "sandalwood")[0] === 2);
check("oud + sea notes clash", L.affinity(idx, "oud", "sea-notes")[0] === -2);
check("ambergris doesn't clash with sea notes", L.affinity(idx, "ambergris", "sea-notes")[0] > -2);
check("musk blends with anything", L.affinity(idx, "musk", "lemon")[0] === 1);

// Spray order: the heavier goes first.
const light = find("dolce gabbana light blue");
const order = L.pair(idx, light, tv).advice;
check("Tobacco Vanille is sprayed before Light Blue", L.heaviness(idx, tv) <= L.heaviness(idx, light) || order.first === tv,
  order.first && order.first.n);

// No notes: can't be layered, and suggestions skip it.
const noNotes = idx.perfumes.find((p) => !L.hasNotes(p));
check("a perfume with no notes is unscorable", L.pair(idx, khamrah, noNotes).unscorable === true);
const sug = L.suggest(idx, khamrah, [khamrah.id, noNotes.id, v28.id, tv.id, "gone-perfume"]);
check("suggestions skip itself, unscorable and unknown ids",
  sug.length === 2 && sug.every((x) => x.perfume.id !== khamrah.id && L.hasNotes(x.perfume)), sug.map((x) => x.perfume.n).join(", "));
check("suggestions rank on How it smells", sug[0].result.scores.smell >= sug[1].result.scores.smell);

// Same combo for less, from curated dupes.
const av = L.pair(idx, find("creed aventus"), find("acqua di gio"));
check("Aventus pair offers a cheaper known dupe", av.swaps.some((x) => x.from.n === "Aventus"),
  av.swaps.map((x) => x.from.n + " -> " + x.to.n).join("; "));

process.exit(failed ? 1 : 0);
