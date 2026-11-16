// Perfume layering engine. Pure functions, no DOM. Rules and their sources are in
// perfumery-principles.md; rule numbers below refer to it.
// Works in the browser (window.LayerMatch) and in node (module.exports).
(function (root) {
  "use strict";

  // Rule 1: base and heart notes last longest, so they count most.
  var LAYERS = [["t", 0.25], ["h", 0.35], ["ba", 0.40]];

  // Rule 2: Michael Edwards' wheel, in circular order, and where our families sit.
  var WHEEL = 14;
  var POS = {
    "Fruit": 0, "Floral": 1, "White floral": 1, "Powdery": 2, "Spice": 3,
    "Gourmand": 4, "Resin & incense": 4, "Amber": 5, "Oud": 6, "Wood": 7,
    "Earth & moss": 8, "Smoke & leather": 9, "Aromatic herb": 10, "Citrus": 11,
    "Marine & mineral": 12, "Green": 13,
  };
  var BY_DISTANCE = [1.5, 2, 1, 0, -0.5, -0.5, -1, -1];
  var WHEEL_NAME = ["Fruity", "Floral", "Soft Floral", "Floral Amber", "Soft Amber", "Amber",
    "Woody Amber", "Woods", "Mossy Woods", "Dry Woods", "Aromatic", "Citrus", "Water", "Green"];

  var HEAVY_FAMS = { "Amber": 1, "Gourmand": 1, "Resin & incense": 1, "Oud": 1, "Wood": 1, "Smoke & leather": 1 };
  var HEAVY = 0.5;
  // Rule 5: ambergris-type materials smell marine, so they don't clash with aquatics.
  var MARINE_AMBERS = { ambergris: 1, ambroxan: 1, cetalox: 1, ambrofix: 1, ambrocenide: 1 };
  var ORIENTAL = { "Amber": 1, "Gourmand": 1, "Resin & incense": 1, "Oud": 1 };
  var VANILLIC = { vanilla: 1, "tonka-bean": 1, coumarin: 1 };
  var ROSE = { rose: 1, "rose-de-mai": 1, "turkish-rose": 1, "damask-rose": 1 };
  var ROSE_WOODS = { sandalwood: 1, cedarwood: 1 };

  // Rule 9: named accords, each part satisfied by any of its notes.
  var ACCORDS = [
    ["chypre", [["bergamot"], ["labdanum", "rose", "jasmine"], ["oakmoss"]]],
    ["fougere", [["lavender"], ["coumarin", "tonka-bean"], ["oakmoss"]]],
    ["amber", [["labdanum"], ["vanilla"], ["benzoin"]]],
  ];
  var ACCORD_NAME = { chypre: "chypre", fougere: "foug\u00e8re", amber: "amber" };

  // Score shaping, calibrated on the spot checks in layer.test.js.
  var BASE = 48, SPREAD = 32;          // smell = BASE + SPREAD * mean affinity, before bonuses
  var BRIDGE_MAX = 12, ACCORD_BONUS = 8, CLASH_PENALTY = 8, HEAVY_PENALTY = 12, CITRUS_PENALTY = 6;
  var ALIKE_FLOOR = 75;  // near-identical perfumes always blend
  var CLASH = 45, SAME_POINT = 70, CAP = 50;
  var WEIGHTS = { smell: 0.55, sillage: 0.15, projection: 0.15, longevity: 0.15 };
  var TOO_ALIKE = 70;

  var DM = typeof module !== "undefined" && module.exports ? require("./match.js") : root.DupeMatch;

  function fam(idx, n) { return (idx.data.notes[n] || [n, "Other"])[1]; }
  function noteName(idx, n) { return (idx.data.notes[n] || [n])[0]; }
  function hasNotes(p) { return !!(p && p.all && p.all.length); }

  // Notes with their weight: layer weight times rarity. Flat lists count as heart.
  function weighted(idx, p) {
    var out = [];
    if (p.fl) p.all.forEach(function (n) { out.push([n, 0.35 * (idx.weight[n] || 1)]); });
    else LAYERS.forEach(function (lw) {
      p[lw[0]].forEach(function (n) { out.push([n, lw[1] * (idx.weight[n] || 1)]); });
    });
    return out;
  }

  function heaviness(idx, p) {
    var notes = p.ba && p.ba.length && !p.fl ? p.ba : p.all;
    var counted = notes.filter(function (n) { return fam(idx, n) !== "Musk"; });
    if (!counted.length) return 0;
    return counted.filter(function (n) { return HEAVY_FAMS[fam(idx, n)]; }).length / counted.length;
  }

  function citrusOpening(idx, p) {
    return !p.fl && p.t.filter(function (n) { return fam(idx, n) === "Citrus"; }).length >= 2;
  }

  // Affinity of two notes, -2..2, and which rule decided it.
  function affinity(idx, a, b) {
    var fa = fam(idx, a), fb = fam(idx, b);
    function either(test) { return test(a, fa, b, fb) || test(b, fb, a, fa); }
    // Rule 5: clashes.
    if (either(function (x, fx, y, fy) { return ORIENTAL[fx] && !MARINE_AMBERS[x] && fy === "Marine & mineral"; }))
      return [-2, "clash"];
    if (either(function (x, fx, y, fy) { return fx === "Gourmand" && fy === "Green"; })) return [-2, "clash"];
    // Rule 3: classic pairings.
    if (either(function (x, fx, y, fy) {
      return (fx === "Amber" && fy === "Musk") || (VANILLIC[x] && fy === "Wood") ||
        (ROSE[x] && ROSE_WOODS[y]) || (fx === "Citrus" && fy === "Green");
    })) return [2, "pairing"];
    // Rule 4: musk blends with everything.
    if (fa === "Musk" || fb === "Musk") return [1, "musk"];
    if (!(fa in POS) || !(fb in POS)) return [0, "other"];
    var d = Math.abs(POS[fa] - POS[fb]);
    d = Math.min(d, WHEEL - d);
    return [BY_DISTANCE[d], "wheel"];
  }

  function accordsFormed(A, B) {
    function has(p, part) { return part.some(function (n) { return p.all.indexOf(n) >= 0; }); }
    function complete(p, parts) { return parts.every(function (part) { return has(p, part); }); }
    var both = { all: A.all.concat(B.all) };
    return ACCORDS.filter(function (a) {
      return complete(both, a[1]) && !complete(A, a[1]) && !complete(B, a[1]);
    }).map(function (a) { return a[0]; });
  }

  // "How it smells", 0-100, with the reasons behind it.
  function smell(idx, A, B) {
    var wa = weighted(idx, A), wb = weighted(idx, B);
    var sum = 0, wsum = 0, best = null, worst = null;
    wa.forEach(function (x) {
      wb.forEach(function (y) {
        if (x[0] === y[0]) return;  // shared notes are bridges, scored below
        var w = x[1] * y[1], af = affinity(idx, x[0], y[0]);
        sum += w * af[0]; wsum += w;
        var c = w * af[0];
        if (af[1] !== "wheel" || af[0] >= 2) {
          if (af[0] > 0 && (!best || c > best.c)) best = { c: c, a: x[0], b: y[0], why: af[1] };
          if (af[0] < 0 && (!worst || c < worst.c)) worst = { c: c, a: x[0], b: y[0], why: af[1] };
        }
      });
    });
    var mean = wsum ? sum / wsum : 0;
    var score = BASE + SPREAD * mean;

    // Rule 6: shared notes bridge the two, rare ones more.
    var shared = A.all.filter(function (n) { return B.all.indexOf(n) >= 0; });
    var bridge = shared.reduce(function (s, n) { return s + (idx.weight[n] || 1); }, 0);
    score += Math.min(BRIDGE_MAX, 3 * bridge);
    shared.sort(function (x, y) { return (idx.weight[y] || 1) - (idx.weight[x] || 1); });

    var accords = accordsFormed(A, B);
    if (accords.length) score += ACCORD_BONUS;

    // Rule 5: a clash spoils the blend even when the rest gets along.
    if (worst && worst.why === "clash") score -= CLASH_PENALTY;

    var heavyA = heaviness(idx, A) >= HEAVY, heavyB = heaviness(idx, B) >= HEAVY;
    if (heavyA && heavyB) score -= HEAVY_PENALTY;  // rule 7
    var citrus = citrusOpening(idx, A) && citrusOpening(idx, B);
    if (citrus) score -= CITRUS_PENALTY;            // rule 8

    var reasons = [];
    if (accords.length) reasons.push("Together they complete a classic " + ACCORD_NAME[accords[0]] + " accord.");
    if (best && best.why === "pairing")
      reasons.push(cap(lower(noteName(idx, best.a))) + " and " + lower(noteName(idx, best.b)) + " are a classic pairing.");
    if (shared.length)
      reasons.push("They share " + list(shared.slice(0, 3).map(function (n) { return lower(noteName(idx, n)); })) +
        ", which ties them together.");
    if (!reasons.length) {
      var fa = mainFamily(idx, A), fb = mainFamily(idx, B);
      if (fa && fb) {
        var d = Math.abs(POS[fa] - POS[fb]); d = Math.min(d, WHEEL - d);
        if (d <= 2) reasons.push(d === 0 ? "Both are mainly " + WHEEL_NAME[POS[fa]].toLowerCase() + ", so they blend smoothly."
          : WHEEL_NAME[POS[fa]] + " and " + WHEEL_NAME[POS[fb]].toLowerCase() + " sit side by side on the fragrance wheel.");
        else if (d >= 5) reasons.push(WHEEL_NAME[POS[fa]] + " and " + WHEEL_NAME[POS[fb]].toLowerCase() + " sit on opposite sides of the fragrance wheel, so they contrast.");
      }
    }
    if (worst && worst.why === "clash")
      reasons.push(cap(lower(noteName(idx, worst.a))) + " and " + lower(noteName(idx, worst.b)) + " tend to clash.");
    if (heavyA && heavyB) reasons.push("Both have heavy bases, which can get overwhelming together.");
    if (citrus) reasons.push("Both open on strong citrus, so the openings compete.");

    return { score: clamp(Math.round(score)), reasons: reasons, citrus: citrus, accords: accords };
  }

  // The family with the most weight in a perfume's base and heart.
  function mainFamily(idx, p) {
    var tally = {};
    weighted(idx, p).forEach(function (x) {
      var f = fam(idx, x[0]);
      if (f in POS) tally[f] = (tally[f] || 0) + x[1];
    });
    var best = null;
    Object.keys(tally).forEach(function (f) { if (!best || tally[f] > tally[best]) best = f; });
    return best;
  }

  // Mixture performance: the stronger one leads; two solid ones reinforce each other.
  function mixture(A, B, k) {
    var a = A.perf && A.perf[k], b = B.perf && B.perf[k];
    if (!a || !b) return null;
    var m = Math.max(a, b) + (Math.min(a, b) >= 3 ? 0.5 : 0);
    return Math.round(100 * Math.min(5, m) / 5);
  }

  // Curated cheaper dupes (perfumes whose dupeOf names this one).
  function cheaperDupe(idx, p) {
    var TIERS = ["budget", "mid", "designer", "niche"];
    var best = null;
    (p.dupes || []).forEach(function (id) {
      var d = idx.byId[id];
      if (!d) return;
      var cheaper = p.p && d.p ? d.p <= 0.7 * p.p : TIERS.indexOf(d.tier) < TIERS.indexOf(p.tier) || !!(d.p && !p.p);
      if (!cheaper) return;
      if (!best || (d.p || 999) < (best.p || 999)) best = d;
    });
    return best;
  }

  function pair(idx, A, B) {
    if (!hasNotes(A) || !hasNotes(B)) return { unscorable: true, missing: hasNotes(A) ? B : A };
    var s = smell(idx, A, B);
    var alike = DM.similarity(idx, A, B).score >= TOO_ALIKE;
    if (alike && s.score < ALIKE_FLOOR) s.score = ALIKE_FLOOR;
    var scores = {
      smell: s.score,
      sillage: mixture(A, B, "sillage"),
      projection: mixture(A, B, "projection"),
      longevity: mixture(A, B, "longevity"),
    };
    var tot = 0, wsum = 0, basedOn = 0;
    Object.keys(WEIGHTS).forEach(function (k) {
      if (scores[k] == null) return;
      tot += WEIGHTS[k] * scores[k]; wsum += WEIGHTS[k]; basedOn++;
    });
    var overall = Math.round(tot / wsum);
    var capped = s.score < CLASH && overall > CAP;
    if (capped) overall = CAP;
    var swaps = [A, B].map(function (p) {
      var d = cheaperDupe(idx, p);
      return d ? { from: p, to: d } : null;
    }).filter(Boolean);
    return {
      scores: scores, overall: overall, basedOn: basedOn, capped: capped,
      reasons: s.reasons, tooAlike: alike,
      advice: advice(idx, A, B, s), swaps: swaps,
    };
  }

  // Rule 10.
  function advice(idx, A, B, s) {
    var hA = heaviness(idx, A), hB = heaviness(idx, B);
    var first = hA >= hB ? A : B, second = first === A ? B : A;
    var even = Math.abs(hA - hB) < 0.15;
    var silA = A.perf && A.perf.sillage, silB = B.perf && B.perf.sillage;
    var silDiff = silA && silB ? Math.abs(silA - silB) : null;
    var tips = [];
    var place;
    if (s.score < CLASH) {
      place = "apart";
      tips.push("Not a natural pair. If you wear them together, keep them apart: " + first.n +
        " on your wrists or inner elbows, " + second.n + " on your neck or behind your ears.");
    } else if (s.score >= SAME_POINT && (silDiff == null || silDiff <= 1)) {
      place = "same";
      tips.push((even ? "Spray either one first" : "Spray " + first.n + " first") +
        ", wait a minute or two, then spray " + (even ? "the other" : second.n) + " on the same pulse points (direct layering).");
    } else {
      place = "different";
      tips.push("Use different pulse points (spatial layering): " + first.n + " on your wrists or inner elbows, " +
        second.n + " on your neck or behind your ears, so the scent shifts as people come closer.");
      if (!even) tips.push("Spray " + first.n + " first and let it settle for a minute or two.");
    }
    if (silDiff != null && silDiff >= 2) {
      var loud = silA > silB ? A : B, soft = loud === A ? B : A;
      tips.push(loud.n + " is much louder: try 1 spray of it to 2 of " + soft.n + ".");
    }
    if (s.citrus) tips.push("Both open on citrus: spray one, wait a few minutes, then the other.");
    tips.push("Test on skin first and wait about 15 minutes. A sour, metallic or chemical edge means they clash.");
    return { first: even ? null : first, place: place, tips: tips };
  }

  // Best partners for `p` from My collection, ranked on how they smell together.
  function suggest(idx, p, ids, limit) {
    if (!hasNotes(p)) return [];
    var out = [];
    ids.forEach(function (id) {
      var c = idx.byId[id];
      if (!c || c.id === p.id || !hasNotes(c)) return;
      var r = pair(idx, p, c);
      out.push({ perfume: c, result: r });
    });
    out.sort(function (a, b) {
      return (b.result.scores.smell - a.result.scores.smell) || (b.result.overall - a.result.overall);
    });
    return out.slice(0, limit || 5);
  }

  function clamp(x) { return Math.max(0, Math.min(100, x)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lower(s) { return s.toLowerCase(); }
  function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  var api = {
    pair: pair, suggest: suggest, heaviness: heaviness, affinity: affinity, hasNotes: hasNotes,
    CLASH: CLASH, SAME_POINT: SAME_POINT, CAP: CAP, HEAVY: HEAVY,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LayerMatch = api;
})(this);
