// Perfume dupe matching engine. Pure functions, no DOM.
// Works in the browser (window.DupeMatch) and in node (module.exports).
(function (root) {
  "use strict";

  var LAYERS = [["t", 0.25], ["h", 0.35], ["ba", 0.40]];
  var TIERS = ["budget", "mid", "designer", "niche"];
  var CROSS_LAYER = 0.5;   // same note, different layer
  var SAME_FAMILY = 0.25;  // different note, same family, same layer
  // A layer's score is how much of the original the candidate covers (recall),
  // discounted when the candidate is mostly other notes (precision). Precision
  // alone never earns points, so a tiny note list can't score high.
  var PRECISION = 0.4;
  var CHEAPER = 0.7;       // "cheaper" = at most 70% of the original's price
  var CUTOFF = 28;         // weak matches below this aren't shown
  var LIMIT = 10;

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/&/g, " and ").replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  // "Baccarat Rouge 540" -> "br540"
  function initialism(name) {
    var words = norm(name).split(" ");
    if (words.length < 2) return null;
    return words.map(function (w) { return /^\d+$/.test(w) ? w : w[0]; }).join("");
  }

  function buildIndex(data) {
    var perfumes = data.perfumes, byId = {}, df = {}, famDf = {}, noteByName = {};
    Object.keys(data.notes).forEach(function (id) { noteByName[norm(data.notes[id][0])] = id; });
    perfumes.forEach(function (p) {
      byId[p.id] = p;
      p.all = p.t.concat(p.h, p.ba);
      var seen = {}, seenFam = {};
      p.all.forEach(function (n) {
        if (!seen[n]) { seen[n] = 1; df[n] = (df[n] || 0) + 1; }
        var f = fam(data, n);
        if (!seenFam[f]) { seenFam[f] = 1; famDf[f] = (famDf[f] || 0) + 1; }
      });
      var keys = [norm(p.b + " " + p.n), norm(p.n)].concat((p.al || []).map(norm));
      var ini = initialism(p.n);
      if (ini) keys.push(ini);
      p.keys = keys;
      p.dupes = [];  // filled below: perfumes that list this one in dupeOf
    });
    perfumes.forEach(function (p) {
      (p.d || []).forEach(function (o) { if (byId[o]) byId[o].dupes.push(p.id); });
    });
    var N = perfumes.length, weight = {};
    Object.keys(data.notes).forEach(function (n) {
      weight[n] = Math.log((N + 1) / ((df[n] || 0) + 1)) + 0.1;
    });
    return { data: data, perfumes: perfumes, byId: byId, weight: weight, noteByName: noteByName };
  }

  function fam(data, n) { return (data.notes[n] || [n, "Other"])[1]; }

  // How much of `notes` is found in `layerNotes` (or elsewhere in `b`),
  // weighted by note rarity.
  function coverage(idx, notes, layerNotes, b) {
    if (!notes.length) return null;
    var fams = {};
    layerNotes.forEach(function (n) { fams[fam(idx.data, n)] = 1; });
    var got = 0, total = 0;
    notes.forEach(function (n) {
      var w = idx.weight[n] || 1, credit = 0, f = fam(idx.data, n);
      if (layerNotes.indexOf(n) >= 0) credit = 1;
      else if (b.all.indexOf(n) >= 0) credit = CROSS_LAYER;
      else if (fams[f] && f !== "Other") credit = SAME_FAMILY;
      got += w * credit; total += w;
    });
    return got / total;
  }

  function blend(recall, prec) {
    return prec === null ? recall : recall * (1 - PRECISION + PRECISION * prec);
  }

  function similarity(idx, o, c) {
    // A perfume known only by a flat note list is compared as one layer.
    if (o.fl || c.fl) {
      var s = blend(coverage(idx, o.all, c.all, c) || 0, coverage(idx, c.all, o.all, o));
      return {
        score: Math.round(100 * s),
        layers: [{ layer: "all", shared: o.all.filter(function (n) { return c.all.indexOf(n) >= 0; }) }],
      };
    }
    var sum = 0, wsum = 0, layers = [];
    LAYERS.forEach(function (lw) {
      var l = lw[0], recall = coverage(idx, o[l], c[l], c);
      if (recall === null) return;
      sum += lw[1] * blend(recall, coverage(idx, c[l], o[l], o)); wsum += lw[1];
      layers.push({ layer: l, shared: o[l].filter(function (n) { return c.all.indexOf(n) >= 0; }) });
    });
    return { score: wsum ? Math.round(100 * sum / wsum) : 0, layers: layers };
  }

  function tierRank(p) { return TIERS.indexOf(p.tier); }

  // -1 cheaper, 0 about the same, 1 pricier. Uses prices when both are known,
  // otherwise the brand-based price tier.
  function priceCompare(o, c) {
    if (o.p && c.p) {
      if (c.p <= CHEAPER * o.p) return -1;
      if (c.p <= 1.15 * o.p) return 0;
      return 1;
    }
    var d = tierRank(c) - tierRank(o);
    return d < 0 ? -1 : d > 0 ? 1 : 0;
  }

  function result(idx, o, c, kind) {
    var sim = similarity(idx, o, c);
    return {
      perfume: c, score: sim.score, layers: sim.layers, kind: kind,
      knownDupe: (c.d || []).indexOf(o.id) >= 0 || (o.d || []).indexOf(c.id) >= 0,
      savings: o.p && c.p ? Math.round(100 * (1 - c.p / o.p)) : null,
    };
  }

  function rank(list) {
    return list.sort(function (a, b) {
      return (b.knownDupe - a.knownDupe) || (b.score - a.score);
    });
  }

  // Candidates matching `o`, filtered by price relation `rel` (array of allowed
  // priceCompare values). Known dupes are always kept; others need CUTOFF.
  function matches(idx, o, rel, kind) {
    var out = [];
    idx.perfumes.forEach(function (c) {
      if (c.id === o.id || (c.b === o.b && sameLine(c, o))) return;
      // A perfume sold as a dupe of `o` counts as cheaper unless known prices say
      // otherwise: brand tiers can't tell a $400 Tom Ford Private Blend from a $120 one.
      var dupeOfO = (c.d || []).indexOf(o.id) >= 0;
      var cheaperDupe = dupeOfO && kind === "cheaper" && !(o.p && c.p && c.p > CHEAPER * o.p);
      if (!cheaperDupe && rel.indexOf(priceCompare(o, c)) < 0) return;
      var r = result(idx, o, c, kind);
      if (r.knownDupe || r.score >= CUTOFF) out.push(r);
    });
    return rank(out).slice(0, LIMIT);
  }

  // Flankers of the same line ("Aventus" / "Aventus Absolu") aren't dupes.
  var FILLER = { eau: 1, de: 1, du: 1, la: 1, le: 1, l: 1, the: 1, my: 1, by: 1, pour: 1, a: 1 };
  function sameLine(a, b) {
    function head(p) { return norm(p.n).split(" ").filter(function (w) { return !FILLER[w]; })[0]; }
    var x = head(a), y = head(b);
    return !!x && x === y;
  }

  // Main entry: what to show for perfume `o`.
  function findDupes(idx, o) {
    var affordable = tierRank(o) <= 1 || (o.p && o.p < 90);
    if (!affordable) return { mode: "cheaper", cheaper: matches(idx, o, [-1], "cheaper") };
    var originals = (o.d || []).map(function (id) { return idx.byId[id]; }).filter(Boolean)
      .map(function (c) { return result(idx, o, c, "original"); });
    var pricier = matches(idx, o, [1], "pricier").filter(function (r) {
      return !originals.some(function (x) { return x.perfume.id === r.perfume.id; });
    });
    return {
      mode: "affordable",
      smellsLike: rank(originals.concat(pricier)).slice(0, LIMIT),
      similar: matches(idx, o, [-1, 0], "similar"),
    };
  }

  // Live lookup: score the data against a pyramid of note names.
  function pyramidPerfume(idx, pyr) {
    function ids(list) {
      return (list || []).map(function (n) { return idx.noteByName[norm(n)]; })
        .filter(function (n, i, a) { return n && a.indexOf(n) === i; });
    }
    var p = {
      id: "__lookup", n: pyr.name || "", b: pyr.brand || "", t: ids(pyr.top), h: ids(pyr.heart),
      ba: ids(pyr.base), p: pyr.price || null, d: [], al: [], tier: pyr.tier || "designer",
    };
    if (p.p) p.tier = p.p < 40 ? "budget" : p.p < 90 ? "mid" : p.p < 200 ? "designer" : "niche";
    p.all = p.t.concat(p.h, p.ba);
    return p;
  }

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [], cur;
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Each query word must match a word of a key: prefix, or one typo for words of 4+ letters.
  function search(idx, query, limit) {
    var q = norm(query);
    if (!q) return [];
    var qw = q.split(" ");
    var hits = [];
    idx.perfumes.forEach(function (p) {
      var best = 0;
      p.keys.forEach(function (k) {
        if (k === q) { best = Math.max(best, 100); return; }
        var kw = k.split(" "), s = 0;
        for (var i = 0; i < qw.length; i++) {
          var w = qw[i], m = 0;
          for (var j = 0; j < kw.length; j++) {
            if (kw[j] === w) m = Math.max(m, 3);
            else if (kw[j].indexOf(w) === 0) m = Math.max(m, 2);
            else if (w.length >= 4 && editDistance(w, kw[j].slice(0, w.length + 1)) <= 1) m = Math.max(m, 1);
          }
          if (!m) return;
          s += m;
        }
        best = Math.max(best, s * 10 - kw.length);
      });
      if (best > 0) hits.push({ p: p, s: best + (p.pop ? 5 - Math.min(5, p.pop / 200) : 0) });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    return hits.slice(0, limit || 8).map(function (h) { return h.p; });
  }

  var api = {
    buildIndex: buildIndex, search: search, findDupes: findDupes, similarity: similarity,
    pyramidPerfume: pyramidPerfume, norm: norm, TIERS: TIERS, CUTOFF: CUTOFF,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DupeMatch = api;
})(this);
