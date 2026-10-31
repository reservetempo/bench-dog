/* Unit Tree: draws data/units.js as a clickable breakdown tree. */
(() => {
  "use strict";

  const DATA = window.UNIT_DATA;
  const Q = DATA.quantities;
  const BASE_ORDER = ["kg", "m", "s", "A", "K", "mol", "cd"];
  const DEFAULT_ROOT = "energy";

  const $ = (sel) => document.querySelector(sel);
  const treeEl = $("#tree");
  const canvasEl = $("#canvas");
  const libEl = $("#library");
  const searchEl = $("#search");
  const problemsEl = $("#problems");

  // ---------- Text formatting ----------
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const LETTER = /[A-Za-zΑ-Ωα-ω]/; // Latin + Greek

  // "^2" → superscript, "_k" → subscript. With italic on, single letters
  // (quantity symbols like F, m, v) are italicised the way textbooks print them.
  function fmt(src, italic) {
    let out = "";
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "^" || c === "_") {
        let j = i + 1;
        let tok = "";
        if (src[j] === "-") { tok = "−"; j++; }
        while (j < src.length && /[A-Za-z0-9]/.test(src[j])) tok += src[j++];
        out += c === "^" ? `<sup>${esc(tok)}</sup>` : `<sub>${esc(tok)}</sub>`;
        i = j;
      } else if (italic && LETTER.test(c) && c !== "Δ") {
        let j = i;
        while (j < src.length && LETTER.test(src[j]) && src[j] !== "Δ") j++;
        const word = src.slice(i, j);
        out += word.length === 1 ? `<i>${esc(word)}</i>` : esc(word);
        i = j;
      } else {
        out += esc(c);
        i++;
      }
    }
    return out;
  }
  const fmtMath = (s) => fmt(s, true);
  const fmtUnit = (s) => fmt(s, false);

  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const supText = (n) => String(n).split("").map((c) => SUP[c]).join("");

  // ---------- Base-unit maths ----------
  // A quantity's "dims" is its make-up in SI base units, e.g. joule → {kg:1, m:2, s:-2}.
  const dimsCache = {};

  function dimsOf(id, stack = []) {
    if (dimsCache[id]) return dimsCache[id];
    const q = Q[id];
    if (!q) throw new Error(`Unknown quantity “${id}”`);
    if (q.base) return (dimsCache[id] = { [q.unit]: 1 });
    if (stack.includes(id)) throw new Error(`Loop in main formulas: ${[...stack, id].join(" → ")}`);
    if (!q.ways || !q.ways.length) throw new Error(`“${id}” has no formulas and isn't marked as a base unit`);
    return (dimsCache[id] = dimsOfTerms(q.ways[0].terms, [...stack, id]));
  }

  function dimsOfTerms(terms, stack = []) {
    const d = {};
    for (const [cid, p] of terms) {
      const cd = dimsOf(cid, stack);
      for (const k in cd) d[k] = (d[k] || 0) + cd[k] * p;
    }
    for (const k in d) if (d[k] === 0) delete d[k];
    return d;
  }

  const sameDims = (a, b) =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => (a[k] || 0) === (b[k] || 0));

  function safeDims(id) {
    try { return dimsOf(id); } catch { return null; }
  }

  // {kg:1, m:2, s:-2} → "kg·m²/s²"
  function fmtDims(d, plain = false) {
    const pw = (n) => (n === 1 ? "" : plain ? supText(n) : `<sup>${n}</sup>`);
    const num = BASE_ORDER.filter((k) => d[k] > 0).map((k) => k + pw(d[k]));
    const den = BASE_ORDER.filter((k) => d[k] < 0).map((k) => k + pw(-d[k]));
    if (!num.length && !den.length) return "dimensionless";
    let s = num.length ? num.join("·") : "1";
    if (den.length) s += "/" + (den.length > 1 ? `(${den.join("·")})` : den[0]);
    return s;
  }

  // Unit equation for one formula, e.g. force terms → "kg · (m/s²)"
  function unitExpr(terms) {
    const many = terms.length > 1;
    const term = ([id, p]) => {
      const u = Q[id] ? Q[id].unit : id;
      const n = Math.abs(p);
      const compound = /[/·]/.test(u);
      const powered = /\^/.test(u);
      let h = fmtUnit(u);
      if ((compound && (many || p !== 1)) || (powered && n !== 1)) h = `(${h})`;
      if (n !== 1) h += `<sup>${n}</sup>`;
      return h;
    };
    const num = terms.filter((t) => t[1] > 0).map(term);
    const den = terms.filter((t) => t[1] < 0).map(term);
    let s = num.length ? num.join(" · ") : "1";
    if (den.length) s += " / " + (den.length > 1 ? `(${den.join(" · ")})` : den[0]);
    return s;
  }

  const rhs = (formula) => {
    const i = formula.indexOf("=");
    return i >= 0 ? formula.slice(i + 1).trim() : formula;
  };

  const kindOf = (q) => (q.base ? "base" : q.unitName ? "named" : "compound");

  // ---------- Data check ----------
  // Every alternative formula must reduce to the same base units as the main one.
  const problems = [];
  for (const [id, q] of Object.entries(Q)) {
    if (q.base) continue;
    let main;
    try { main = dimsOf(id); } catch (err) { problems.push(esc(err.message)); continue; }
    (q.ways || []).forEach((w, i) => {
      if (i === 0) return;
      try {
        const d = dimsOfTerms(w.terms);
        if (!sameDims(d, main)) {
          w.bad = `This gives ${fmtDims(d, true)} but ${q.name} should be ${fmtDims(main, true)}`;
          problems.push(`${esc(q.name)}: “${esc(w.formula)}” gives ${fmtDims(d)}, expected ${fmtDims(main)}`);
        }
      } catch (err) {
        problems.push(`${esc(q.name)}: “${esc(w.formula)}”: ${esc(err.message)}`);
      }
    });
  }
  for (const [id, q] of Object.entries(Q)) {
    if (q.group && !DATA.groups.some((g) => g.id === q.group)) problems.push(`${esc(id)}: unknown group “${esc(q.group)}”`);
  }

  // Reverse lookup: which quantities is each one used to build?
  const usedIn = {};
  for (const [id, q] of Object.entries(Q)) {
    for (const w of q.ways || []) {
      for (const [cid] of w.terms) if (cid !== id) (usedIn[cid] ||= new Set()).add(id);
    }
  }

  // ---------- State ----------
  // Each card in the tree has a path like "energy>0.0:force>0.1:acceleration"
  // (way index . child index : id), so the same unit can appear in several
  // branches and open/close independently.
  const state = { root: DEFAULT_ROOT, open: new Set(), ways: new Map(), zoom: 1, fresh: null };

  // ---------- Rendering ----------
  function opBadge(p) {
    const n = Math.abs(p);
    const word = p > 0 ? "multiply by" : "divide by";
    const extra = n === 2 ? " (squared)" : n === 3 ? " (cubed)" : n !== 1 ? ` (to the power ${n})` : "";
    return `<span class="op" title="${word} this${extra}">${p > 0 ? "×" : "÷"}${n !== 1 ? `<sup>${n}</sup>` : ""}</span>`;
  }

  function usedInHtml(id) {
    const list = [...(usedIn[id] || [])].sort((a, b) => Q[a].name.localeCompare(Q[b].name));
    if (!list.length) return "";
    const chips = list
      .map((x) => `<button type="button" class="chip" data-act="root" data-id="${esc(x)}">${esc(Q[x].name)}</button>`)
      .join("");
    return `<div class="chips"><span class="lbl">Used to build</span>${chips}</div>`;
  }

  function renderNode(id, path, ancestors, power) {
    const q = Q[id];
    const op = power === undefined ? "" : opBadge(power);
    if (!q) return `<li class="node">${op}<div class="card missing">Unknown quantity “${esc(id)}”</div></li>`;

    const kind = kindOf(q);
    const loop = ancestors.includes(id);
    const open = !loop && state.open.has(path);
    const nWays = (q.ways || []).length;
    const wi = Math.min(state.ways.get(path) || 0, Math.max(nWays - 1, 0));
    const way = nWays ? q.ways[wi] : null;
    const isRoot = ancestors.length === 0;
    const P = esc(path);

    const dims = safeDims(id);
    const unitPlain = q.unit.replace(/\^(-?\d+)/g, (_, n) => supText(n));
    const baseLine = loop
      ? "↺ already further up this branch"
      : q.base ? "SI base unit"
      : !dims ? "?"
      : fmtDims(dims, true) === unitPlain ? `<span class="same">already in base units</span>`
      : fmtDims(dims);

    let h = `<li class="node">${op}`;
    h += `<div class="card k-${kind}${open ? " open" : ""}${loop ? " loop" : ""}" data-path="${P}">`;
    h += `<button type="button" class="card-head" data-act="toggle" data-path="${P}" aria-expanded="${open}"${loop ? " disabled" : ""}>`;
    h += `<span class="q-name">${esc(q.name)}${q.sym ? ` <span class="q-sym">${fmtMath(q.sym)}</span>` : ""}</span>`;
    h += `<span class="q-unit"><span class="u-sym">${fmtUnit(q.unit)}</span>`;
    h += q.unitName ? `<span class="u-name">${esc(q.unitName)}</span>` : "";
    h += `</span><span class="q-base"${!q.base && !loop ? ' title="In SI base units"' : ""}>${baseLine}</span>`;
    if (!loop) h += `<span class="chev" aria-hidden="true"></span>`;
    h += `</button>`;

    if (open) {
      h += `<div class="card-body">`;
      if (q.base || !way) {
        h += `<p class="note">${esc(q.note || "")}</p>`;
      } else {
        h += `<div class="formula">${fmtMath(way.formula)}</div>`;
        h += `<div class="ueq"><b>${fmtUnit(q.unit)}</b> = ${unitExpr(way.terms)}</div>`;
        if (way.note) h += `<p class="note">${esc(way.note)}</p>`;
        if (nWays > 1) {
          h += `<div class="chips"><span class="lbl">${nWays} ways to build it</span>`;
          q.ways.forEach((w, i) => {
            const on = i === wi;
            h += `<button type="button" class="chip way${on ? " on" : ""}" data-act="way" data-path="${P}" data-i="${i}" aria-pressed="${on}"`;
            h += w.bad ? ` title="${esc(w.bad)}">` : ">";
            h += `${fmtMath(rhs(w.formula))}${w.bad ? " ⚠" : ""}</button>`;
          });
          h += `</div>`;
        }
      }
      if (q.base || isRoot) h += usedInHtml(id);
      h += `</div>`;
    }
    h += `</div>`;

    if (open && way && !q.base) {
      h += `<ul class="kids${state.fresh === path ? " fresh" : ""}">`;
      way.terms.forEach(([cid, p], i) => {
        h += renderNode(cid, `${path}>${wi}.${i}:${cid}`, [...ancestors, id], p);
      });
      h += `</ul>`;
    }
    return h + `</li>`;
  }

  function render() {
    treeEl.innerHTML = renderNode(state.root, state.root, [], undefined);
    treeEl.style.zoom = state.zoom;
    $("#zoomReset").textContent = `${Math.round(state.zoom * 100)}%`;
    state.fresh = null;
  }

  function matches(q, term) {
    if (!term) return true;
    return [q.name, q.unit, q.unitName, q.sym].some((v) => v && v.toLowerCase().includes(term));
  }

  function renderSidebar() {
    const term = searchEl.value.trim().toLowerCase();
    let html = "";
    for (const g of DATA.groups) {
      const items = Object.entries(Q).filter(([, q]) => q.group === g.id && matches(q, term));
      if (!items.length) continue;
      html += `<section class="grp"><h3>${esc(g.name)}</h3><ul>`;
      for (const [id, q] of items) {
        html += `<li><button type="button" class="lib-item k-${kindOf(q)}${id === state.root ? " on" : ""}" data-id="${esc(id)}"${id === state.root ? ' aria-current="true"' : ""}>`;
        html += `<span>${esc(q.name)}</span><span class="li-unit">${fmtUnit(q.unit)}</span></button></li>`;
      }
      html += `</ul></section>`;
    }
    libEl.innerHTML = html || `<p class="empty">Nothing matches “${esc(searchEl.value)}”.</p>`;
  }

  // ---------- Actions ----------
  function setRoot(id, { push = true } = {}) {
    if (!Q[id]) return;
    state.root = id;
    state.open = new Set([id]);
    state.ways = new Map();
    try {
      if (push && location.hash.slice(1) !== id) location.hash = id;
      else if (!push) history.replaceState(null, "", `#${id}`);
    } catch { /* some browsers block history changes on local files */ }
    render();
    renderSidebar();
    canvasEl.scrollTo({ top: 0, left: 0 });
  }

  function expandAll(id, path, ancestors) {
    const q = Q[id];
    if (!q || q.base || !q.ways || ancestors.includes(id)) return;
    state.open.add(path);
    const wi = state.ways.get(path) || 0;
    q.ways[wi].terms.forEach(([cid], i) => expandAll(cid, `${path}>${wi}.${i}:${cid}`, [...ancestors, id]));
  }

  function redraw(path, focusSel) {
    render();
    treeEl.querySelector(focusSel)?.focus({ preventScroll: true });
    if (!state.open.has(path)) return;
    const card = treeEl.querySelector(`.card[data-path="${CSS.escape(path)}"]`);
    const kids = card && card.parentElement.querySelector(":scope > .kids");
    (kids || card)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  treeEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const { act, path } = btn.dataset;
    if (act === "toggle") {
      if (state.open.has(path)) state.open.delete(path);
      else { state.open.add(path); state.fresh = path; }
      redraw(path, `[data-act="toggle"][data-path="${CSS.escape(path)}"]`);
    } else if (act === "way") {
      state.ways.set(path, Number(btn.dataset.i));
      state.fresh = path;
      redraw(path, `[data-act="way"][data-path="${CSS.escape(path)}"][data-i="${btn.dataset.i}"]`);
    } else if (act === "root") {
      setRoot(btn.dataset.id);
    }
  });

  libEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    setRoot(btn.dataset.id);
    if (window.matchMedia("(max-width: 760px)").matches) canvasEl.scrollIntoView({ behavior: "smooth" });
  });

  searchEl.addEventListener("input", renderSidebar);
  searchEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = libEl.querySelector("[data-id]");
    if (first) setRoot(first.dataset.id);
  });

  $("#expandAll").addEventListener("click", () => { expandAll(state.root, state.root, []); render(); });
  $("#collapseAll").addEventListener("click", () => { state.open = new Set([state.root]); render(); });

  const setZoom = (z) => { state.zoom = Math.round(Math.min(1.6, Math.max(0.5, z)) * 10) / 10; render(); };
  $("#zoomOut").addEventListener("click", () => setZoom(state.zoom - 0.1));
  $("#zoomIn").addEventListener("click", () => setZoom(state.zoom + 0.1));
  $("#zoomReset").addEventListener("click", () => setZoom(1));

  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (Q[id] && id !== state.root) setRoot(id, { push: false });
  });

  // ---------- Start ----------
  if (problems.length) {
    problemsEl.hidden = false;
    problemsEl.innerHTML = `<strong>Data check found ${problems.length} problem${problems.length > 1 ? "s" : ""} in data/units.js:</strong><ul>${problems.map((p) => `<li>${p}</li>`).join("")}</ul>`;
  }
  const start = decodeURIComponent(location.hash.slice(1));
  setRoot(Q[start] ? start : DEFAULT_ROOT, { push: false });
})();
