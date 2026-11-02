/* Fuse page client. Inlined by render.mjs. Reads #council-data, renders the comparison dossier, and saves
   ONE db doc `fusion/current` = { runId, sources: FusionSource[], notes, savedAt } via claude.use("db").
   Element keys (FusionSource.elements): spine, giver, beat:<id>, line:<id>, mechanic:<id>, character:<id>. */
(function () {
  var D = JSON.parse(document.getElementById('council-data').textContent);
  var GUARDS = ['story', 'economy', 'lines', 'uniqueness'];
  var GLYPH = { green: '✓', red: '✕', unmeasured: '–' };
  var WORD = { green: 'pass', red: 'block', unmeasured: 'unmeasured' };
  var paths = D.slots.filter(function (s) { return s.kind === 'path'; }).map(function (s) { return s.proposal; });

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function chip(text, cls) { return h('span', { cls: 'chip' + (cls ? ' ' + cls : ''), text: text }); }
  function key(p) { return h('span', { cls: 'key' + (p.variant === 'B' ? ' vB' : ''), 'data-p': p.pathId }, p.seat + ' · ' + p.variant); }
  function tone(p) { return p.variant === 'A' ? 'expected tone' : 'deliberate swerve'; }
  var uid = 0;
  function box(pathId, k) {
    return h('input', { type: 'checkbox', id: 'k' + (++uid), 'data-path': pathId, 'data-key': k, 'aria-label': 'Keep ' + k + ' from ' + pathId });
  }
  function pick(pathId, k, content, cls) {
    var input = box(pathId, k);
    return h('label', { cls: 'pick' + (cls ? ' ' + cls : ''), for: input.id }, input, h('span', null, content));
  }
  function row(p, body) {
    return h('div', { cls: 'row' }, h('div', { cls: 'row-key' }, key(p), h('span', { cls: 't', text: p.title })), h('div', { cls: 'row-body' }, body));
  }
  function fill(id, nodes) { var el = document.getElementById(id); if (el) add(el, nodes); }
  function verdict(p) { return D.verdicts[p.pathId] || null; }
  function guardOf(p, g) { var v = verdict(p); if (!v) return null; for (var i = 0; i < v.guards.length; i++) if (v.guards[i].guard === g) return v.guards[i]; return null; }
  function gchip(state, label) { return h('span', { cls: 'g ' + state }, GLYPH[state] + ' ' + (label || WORD[state])); }

  // ── overview ──
  fill('overview', D.slots.map(function (s) {
    if (s.kind !== 'path') {
      return h('article', { cls: 'ov skip' }, h('div', { cls: 'ov-head' }, h('span', { cls: 'key vB' }, s.seat)),
        h('h3', { text: 'No path from this seat' }), h('p', { text: s.reason }),
        h('p', { cls: 't', text: 'Nothing is invented here: this seat delivered no valid proposal.' }));
    }
    var p = s.proposal, fp = p.fingerprint, v = verdict(p);
    var spineId = 'spine-' + p.pathId;
    return h('article', { cls: 'ov', 'aria-label': 'Path ' + p.pathId },
      h('div', { cls: 'ov-head' }, key(p), chip(tone(p))),
      h('h3', { text: p.title }),
      h('p', { cls: 'logline', text: p.logline }),
      h('div', { cls: 'fp' }, chip('giver ' + fp.giver), chip('verb ' + fp.coreVerb), chip('payoff ' + fp.payoffKind), chip(fp.location),
        fp.newMechanic ? chip('new: ' + fp.newMechanic, 'new') : null, p.claimsBeat ? chip('realises ' + p.claimsBeat) : null),
      h('div', { cls: 'fp' }, GUARDS.map(function (g) { var x = guardOf(p, g); return gchip(x ? x.state : 'unmeasured', g); }),
        v && v.blocked ? h('span', { cls: 'chip', text: 'blocked by ' + v.blockedBy.join(', ') }) : null),
      h('label', { cls: 'spine', for: spineId }, h('input', { type: 'radio', name: 'spine', id: spineId, value: p.pathId, 'data-spine': p.pathId }),
        'Use this path as the spine'),
      pick(p.pathId, 'giver', 'Keep the giver (' + fp.giver + ')'));
  }));

  // ── cast register: who each name is, and each character's timeline (owner rule, 2026-11-02) ──
  (function () {
    var ledger = D.ledger || [];
    var ACTS = { prologue: 'Prologue', 'clock-out': 'Clock-Out', act1: 'Act 1', act2: 'Act 2', act3: 'Act 3', act4: 'Act 4', finale: 'Finale' };
    var order = [], byId = {};
    function note(id) { if (!byId[id]) { byId[id] = { id: id, here: [], past: [] }; order.push(id); } return byId[id]; }
    ledger.forEach(function (q) { q.characters.forEach(function (c) { note(c.id).past.push({ q: q, c: c }); }); });
    paths.forEach(function (p) { p.characters.forEach(function (c) { note(c.id).here.push({ p: p, c: c }); }); });
    // Rivet first, then whoever this quest introduces, then the rest of the known cast.
    order.sort(function (a, b) {
      function rank(id) { return id === 'rivet' ? 0 : byId[id].here.length ? (byId[id].past.length ? 1 : 2) : 3; }
      return rank(a) - rank(b) || byId[b].here.length - byId[a].here.length;
    });
    var cards = order.map(function (id) {
      var e = byId[id];
      var names = {};
      e.past.forEach(function (x) { names[x.c.name] = true; }); e.here.forEach(function (x) { names[x.c.name] = true; });
      var nameList = Object.keys(names);
      var status = e.past.length ? 'met in ' + e.past.length + ' earlier quest(s)' : 'first appearance';
      var look = e.here.map(function (x) { return x.c.designNote ? h('li', null, key(x.p), ' ', x.c.designNote) : null; }).filter(Boolean);
      var timeline = e.past.map(function (x) {
        return h('li', null, h('b', { text: (ACTS[x.q.act] || x.q.act) + ' · ' + x.q.title }), ' (' + x.c.role + ', ' + x.q.status + ')');
      });
      timeline.push(h('li', { cls: 'now' }, h('b', { text: 'This quest (proposed)' }), ' ',
        e.here.length ? e.here.map(function (x) { return h('span', { cls: 'nowrole' }, key(x.p), ' ' + x.c.role + ' ' + '“' + x.c.name + '”'); })
          : 'not in any path'));
      return h('article', { cls: 'who' },
        h('div', { cls: 'who-head' }, h('h3', { text: nameList.join(' / ') || id }), h('code', { text: id })),
        h('p', { cls: 't', text: status + (e.here.length < paths.length && e.here.length ? ' · in ' + e.here.length + ' of ' + paths.length + ' paths' : '') }),
        look.length ? [h('span', { cls: 'sub', text: 'Look' }), h('ul', { cls: 'findings' }, look)] : null,
        h('span', { cls: 'sub', text: 'Timeline' }), h('ul', { cls: 'timeline' }, timeline));
    });
    fill('body-register', [
      h('p', { cls: 'meta', text: ledger.length ? ledger.length + ' earlier quest(s) in the ledger.' : 'No earlier quests: every character below is met for the first time.' }),
      h('div', { cls: 'register' }, cards)]);
  })();

  // ── story goal ──
  fill('body-story', paths.map(function (p) {
    return row(p, h('div', { cls: 'pair' },
      h('div', null, h('h4', { text: 'Story goal' }), h('p', { text: p.goal })),
      h('div', null, h('h4', { text: 'Why it is not filler' }), h('p', { text: p.whyNotFiller }))));
  }));

  // ── numbers: one comparison table ──
  (function () {
    var b = D.band;
    function rng(min, max) { return min != null && max != null ? min + '–' + max : max != null ? '≤ ' + max : '≥ ' + min; }
    var rows = [
      ['Cash', function (p) { return p.reward.cash; }, b && b.cash.min, b && b.cash.max, '$'],
      ['Heat peak', function (p) { return p.difficulty.heatPeak; }, null, b && b.heatCeiling],
      ['Enemies', function (p) { return p.difficulty.enemyCount; }, null, b && b.enemyCount.max],
      ['Waves', function (p) { return p.difficulty.enemyWaves; }, null, b && b.enemyWaves.max],
      ['Minutes', function (p) { return p.difficulty.minutes; }, b && b.minutes.min, b && b.minutes.max],
    ];
    var head = h('tr', null, h('th', { scope: 'col', text: 'Measure' }), h('th', { scope: 'col', text: 'Act band' }),
      paths.map(function (p) { return h('th', { scope: 'col' }, key(p)); }));
    var body = rows.map(function (r) {
      return h('tr', null, h('th', { scope: 'row', text: r[0] }), h('td', { cls: 'band', text: b ? (r[4] || '') + rng(r[2], r[3]) : 'no band' }),
        paths.map(function (p) {
          var v = r[1](p), low = r[2] != null && v < r[2], high = r[3] != null && v > r[3];
          return h('td', { cls: 'num' + (b && (low || high) ? ' out' + (low ? ' low' : '') : ''), text: (r[4] || '') + v });
        }));
    });
    body.push(h('tr', null, h('th', { scope: 'row', text: 'Timer' }), h('td', { cls: 'band', text: b ? (b.timerAllowed ? 'allowed' : 'not allowed') : '' }),
      paths.map(function (p) {
        var t = p.difficulty.timeLimitS, bad = b && t != null && !b.timerAllowed;
        return h('td', { cls: 'num' + (bad ? ' out' : ''), text: t == null ? 'none' : t + ' s' });
      })));
    body.push(h('tr', null, h('th', { scope: 'row', text: 'Unlocks' }), h('td', { cls: 'band', text: '' }),
      paths.map(function (p) { return h('td', null, p.reward.unlocks.length ? p.reward.unlocks.map(function (u) { return chip(u); }) : 'none'); })));
    body.push(h('tr', null, h('th', { scope: 'row', text: 'Fail states' }), h('td', { cls: 'band', text: '' }),
      paths.map(function (p) { return h('td', null, h('ul', { cls: 'findings' }, p.difficulty.failStates.map(function (f) { return h('li', { text: f }); }))); })));
    fill('body-numbers', [h('div', { cls: 'tbl-wrap' }, h('table', { cls: 'cmp-t' }, h('thead', null, head), h('tbody', null, body))),
      h('p', { cls: 'meta', text: 'Band: quest-economy.json r' + D.economyRevision + (D.economyProvisional ? ' (provisional)' : '') + ' for ' + D.act + '. Display only; the economy guard decides.' })]);
  })();

  // ── guards: comparison table + findings per path ──
  (function () {
    var head = h('tr', null, h('th', { scope: 'col', text: 'Guard' }), paths.map(function (p) { return h('th', { scope: 'col' }, key(p)); }));
    var body = GUARDS.map(function (g) {
      return h('tr', null, h('th', { scope: 'row', text: g }), paths.map(function (p) {
        var x = guardOf(p, g);
        if (!x) return h('td', null, gchip('unmeasured', 'not assessed'));
        var errs = x.findings.filter(function (f) { return f.severity === 'error'; }).length;
        return h('td', null, gchip(x.state), h('div', { cls: 't', text: x.findings.length + ' finding(s)' + (errs ? ', ' + errs + ' blocking' : '') }));
      }));
    });
    var detail = paths.map(function (p) {
      var v = verdict(p);
      var items = [];
      if (v) v.guards.forEach(function (x) { x.findings.forEach(function (f) {
        items.push(h('li', null, h('span', { cls: 'sev ' + f.severity, text: f.severity }), h('b', { text: x.guard + ' ' }), h('code', { text: f.code }), ' ' + (f.ref ? '(' + f.ref + ') ' : '') + f.message));
      }); });
      return row(p, items.length ? h('details', { cls: 'fold' }, h('summary', { text: 'Findings (' + items.length + ')' }), h('ul', { cls: 'findings' }, items))
        : h('p', { cls: 't', text: v ? 'No findings.' : 'Not assessed yet.' }));
    });
    fill('body-guards', [h('div', { cls: 'tbl-wrap' }, h('table', { cls: 'cmp-t' }, h('thead', null, head), h('tbody', null, body)))].concat(detail));
  })();

  // ── cast ──
  fill('body-cast', paths.map(function (p) {
    return row(p, h('div', { cls: 'pills' }, p.characters.map(function (c) {
      return pick(p.pathId, 'character:' + c.id, [h('b', { text: c.name }), ' ', chip(c.status, c.status === 'new' ? 'new' : ''), ' ', chip(c.role),
        c.designNote ? h('span', { cls: 'note', text: c.designNote }) : null], 'pill');
    })));
  }));

  // ── beats ──
  fill('body-beats', paths.map(function (p) {
    return row(p, h('ol', { cls: 'beats' }, p.beats.map(function (bt) {
      var o = bt.objective || {};
      var obj = [o.verb, o.target, o.location ? '@ ' + o.location : null, o.durationS ? o.durationS + ' s' : null].filter(Boolean).join(' · ');
      var input = box(p.pathId, 'beat:' + bt.id);
      return h('li', { cls: 'beat' }, h('label', { cls: 'pick', for: input.id }, input, h('span', { cls: 'n' })),
        h('b', { text: bt.title }), h('div', { cls: 'obj', text: obj }), h('p', { text: bt.summary }));
    })));
  }));

  // ── lines (the script) ──
  fill('body-lines', paths.map(function (p) {
    var list = h('div', { cls: 'lines' }, p.lines.map(function (l) {
      var input = box(p.pathId, 'line:' + l.id);
      return h('label', { cls: 'line', for: input.id }, input, h('span', { cls: 'spk', text: l.speaker }), h('span', { cls: 'txt', text: l.text }),
        h('span', { cls: 'tags' }, l.purpose.map(function (x) { return chip(x, 'purpose-' + x); }), (l.when || []).map(function (w) { return chip(w, 'when'); })));
    }));
    return row(p, h('details', { cls: 'fold', open: true }, h('summary', { text: p.lines.length + ' lines' }), list));
  }));

  // ── mechanics ──
  fill('body-mechanics', paths.map(function (p) {
    return row(p, p.mechanics.length ? h('div', { cls: 'mechs' }, p.mechanics.map(function (m) {
      return pick(p.pathId, 'mechanic:' + m.id, [h('b', { text: m.name }), ' ', chip(m.status, m.status === 'new' ? 'new' : ''), ' ', chip('home: ' + m.home),
        h('span', { cls: 'sum', text: m.summary })], 'mech');
    })) : h('p', { cls: 't', text: 'No mechanics declared.' }));
  }));

  // ── story hooks ──
  fill('body-hooks', paths.map(function (p) {
    var s = p.story || { reads: [], writes: [] };
    return row(p, h('div', { cls: 'pair' },
      h('div', null, h('h4', { text: 'Reads' }), s.reads.length ? h('div', { cls: 'fp' }, s.reads.map(function (r) { return h('code', { text: r }); })) : h('p', { text: 'none' })),
      h('div', null, h('h4', { text: 'Writes' + (p.claimsBeat ? ' (realises ' + p.claimsBeat + ')' : '') }),
        s.writes.length ? h('div', { cls: 'fp' }, s.writes.map(function (w) { return h('code', { text: w.var + ' = ' + JSON.stringify(w.value) }); })) : h('p', { text: 'none' }))));
  }));

  // ── fuse: collect, apply, save ──
  var notes = document.getElementById('notes'), out = document.getElementById('fusion-json'), status = document.getElementById('status');
  var saveBtns = [document.getElementById('save'), document.getElementById('save-top')].filter(Boolean);
  var kept = document.getElementById('kept');
  function collect() {
    var map = {}, order = [];
    paths.forEach(function (p) { map[p.pathId] = []; order.push(p.pathId); });
    var sp = document.querySelector('input[name=spine]:checked');
    if (sp && map[sp.value]) map[sp.value].push('spine');
    Array.prototype.forEach.call(document.querySelectorAll('input[data-key]:checked'), function (el) {
      var k = el.getAttribute('data-path'); if (map[k]) map[k].push(el.getAttribute('data-key'));
    });
    var sources = order.filter(function (k) { return map[k].length; }).map(function (k) { return { pathId: k, elements: map[k] }; });
    return { runId: D.runId, sources: sources, notes: notes.value, savedAt: new Date().toISOString() };
  }
  function refresh() {
    var doc = collect();
    out.textContent = JSON.stringify(doc, null, 2);
    var n = doc.sources.reduce(function (a, s) { return a + s.elements.length; }, 0);
    if (kept) kept.textContent = n + ' kept' + (document.querySelector('input[name=spine]:checked') ? '' : ' · no spine yet');
  }
  function apply(doc) {
    if (!doc || !Array.isArray(doc.sources)) return;
    doc.sources.forEach(function (src) { (src.elements || []).forEach(function (k) {
      if (k === 'spine') { var r = document.querySelector('input[data-spine="' + CSS.escape(src.pathId) + '"]'); if (r) r.checked = true; return; }
      var el = document.querySelector('input[data-path="' + CSS.escape(src.pathId) + '"][data-key="' + CSS.escape(k) + '"]'); if (el) el.checked = true;
    }); });
    if (typeof doc.notes === 'string') notes.value = doc.notes;
    refresh();
  }
  document.addEventListener('change', refresh); notes.addEventListener('input', refresh); refresh();
  function setStatus(text, warn) { status.className = 'status' + (warn ? ' warn' : ''); status.textContent = text; }
  function setSave(on) { saveBtns.forEach(function (b) { b.disabled = !on; }); }
  document.getElementById('copy').addEventListener('click', function () {
    var t = out.textContent;
    function sel() { var r = document.createRange(); r.selectNodeContents(out); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); setStatus('Selected. Press Ctrl+C or Cmd+C to copy.'); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { setStatus('Fusion JSON copied.'); }, sel); else sel(); } catch { sel(); }
  });
  function timeout(p, ms) { return Promise.race([p, new Promise(function (res) { setTimeout(function () { res('__timeout'); }, ms); })]); }
  var db = null;
  function unavailable() { setStatus('Saving is unavailable here. Copy the JSON below instead.', true); setSave(false); }
  setSave(false); setStatus('Connecting to the artifact store…');
  var useP = (window.claude && typeof window.claude.use === 'function') ? timeout(Promise.resolve(window.claude.use('db')).catch(function () { return null; }), 10000) : Promise.resolve(null);
  useP.then(function (ns) {
    if (!ns || ns === '__timeout') { unavailable(); return; }
    db = ns; setSave(true); setStatus('Saving available. Reading any saved fusion…');
    return timeout(db.doc('fusion/current').get(), 10000).then(function (snap) {
      if (snap === '__timeout') { setStatus('Saving available. The saved fusion did not load within 10 s.'); return; }
      if (snap && snap.exists) {
        var d = snap.data();
        if (d && d.runId && d.runId !== D.runId) { setStatus('Saving available. The saved fusion is from run ' + d.runId + ', so it was not applied. Saving here replaces it.'); return; }
        apply(d); setStatus('Loaded the fusion saved at ' + (d && d.savedAt ? d.savedAt : 'an earlier time') + '.');
      } else setStatus('Saving available. No fusion saved yet.');
    }).catch(function (e) { setStatus('Saving available. Reading the saved fusion failed (' + ((e && e.code) || 'error') + ').'); });
  }).catch(unavailable);
  function save() {
    if (!db) { unavailable(); return; }
    var doc = collect(); out.textContent = JSON.stringify(doc, null, 2); setSave(false); setStatus('Saving…');
    function attempt(n) {
      return db.doc('fusion/current').set(doc).catch(function (e) {
        if (e && e.code === 'unavailable' && n === 0) return new Promise(function (res) { setTimeout(res, 400 + Math.random() * 600); }).then(function () { return attempt(1); });
        throw e;
      });
    }
    attempt(0).then(function () { setStatus('Saved at ' + doc.savedAt + ' from ' + doc.sources.length + ' path(s).'); })
      .catch(function (e) { setStatus('Save failed (' + ((e && e.code) || 'error') + (e && e.message ? ': ' + e.message : '') + '). Copy the JSON below instead.', true); })
      .then(function () { setSave(true); });
  }
  saveBtns.forEach(function (b) { b.addEventListener('click', save); });
})();
