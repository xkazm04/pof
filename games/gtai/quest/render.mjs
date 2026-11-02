#!/usr/bin/env node
/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
// render.mjs - council proposals + guard verdicts -> one self-contained fuse page (`<runDir>/fuse.html`).
//
//   node games/gtai/quest/render.mjs <runDir>        (council.mjs render <runDir> calls renderFuse)
//
// The page is published as a claude.ai Artifact with capabilities {db:{}, user:{}}. The owner ticks the
// elements to keep (keys match FusionSource.elements: spine, giver, beat:<id>, line:<id>, mechanic:<id>,
// character:<id>), writes notes, and "Save fusion" writes ONE db doc `fusion/current`
// ({ runId, sources: FusionSource[], notes, savedAt }). Without db it shows the JSON to copy.
// A seat that was skipped or delivered invalid output renders as an honest card; a path is never faked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SEAT_ORDER = ['claude', 'grok'];
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readIf = (f) => (fs.existsSync(f) ? readJson(f) : null);

/** Everything the page needs, read from the run folder. */
export function collectCouncil(runDir) {
  const meta = readIf(path.join(runDir, 'run.json')) ?? { runId: path.basename(runDir) };
  const seats = readIf(path.join(runDir, 'seats.json'));
  const verdicts = readIf(path.join(runDir, 'verdicts.json')) ?? {};
  const economy = readIf(path.join(ROOT, 'games', 'gtai', 'balance', 'quest-economy.json'));
  const slots = [];
  for (const seat of SEAT_ORDER) {
    const good = readIf(path.join(runDir, `proposals.${seat}.json`));
    if (Array.isArray(good)) {
      for (const p of good) slots.push({ kind: 'path', seat, proposal: p });
      continue;
    }
    const bad = readIf(path.join(runDir, `proposals.${seat}.invalid.json`));
    const rec = seats?.seats?.[seat];
    let reason;
    if (bad) reason = `invalid output: ${[].concat(bad.reason ?? []).slice(0, 4).join('; ')}`;
    else if (rec?.status === 'skipped') reason = `seat skipped: ${rec.reason ?? 'probe failed'}`;
    else if (rec) reason = `seat ${rec.status}: ${rec.reason ?? 'no proposals written'}`;
    else reason = seats ? 'seat skipped: not in this run' : 'seat skipped: the council has not run yet';
    slots.push({ kind: 'skip', seat, reason });
  }
  const act = meta.act ?? slots.find((s) => s.kind === 'path')?.proposal.act ?? null;
  return {
    runId: meta.runId, act, goal: meta.goal ?? '', constraints: meta.constraints ?? '',
    band: act && economy ? economy.acts?.[act] ?? null : null,
    economyRevision: economy?.revision ?? null, economyProvisional: economy?.provisional ?? null,
    seats: seats?.seats ?? {}, slots, verdicts,
  };
}

const CSS = `
:root{--paper:#f3ead6;--card:#fbf6ea;--ink:#211b2e;--muted:#5e566b;--line:#d9ccb1;--accent:#d63d22;--accent-ink:#fff8ee;--dead:#17807e;--dead-soft:#d6ece9;--red-soft:#f8ddd6;--unm:#6d6478;--focus:#d63d22}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#16131d;--card:#201b29;--ink:#efe6d2;--muted:#a99fb6;--line:#3a3247;--accent:#ff6a4d;--accent-ink:#1a0f0c;--dead:#4fc3bd;--dead-soft:#173634;--red-soft:#3d1d18;--unm:#a99fb6;--focus:#ff6a4d}}
:root[data-theme="dark"]{--paper:#16131d;--card:#201b29;--ink:#efe6d2;--muted:#a99fb6;--line:#3a3247;--accent:#ff6a4d;--accent-ink:#1a0f0c;--dead:#4fc3bd;--dead-soft:#173634;--red-soft:#3d1d18;--unm:#a99fb6;--focus:#ff6a4d}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-x:hidden}
main{max-width:1680px;margin:0 auto;padding:20px 16px 64px}
h1{font-size:28px;letter-spacing:.02em;margin:0 0 4px;text-transform:uppercase}
h1 span{color:var(--accent)}
.meta{color:var(--muted);font-size:13px;margin:0 0 4px;overflow-wrap:anywhere}
.goal{border-left:4px solid var(--accent);padding:6px 12px;margin:12px 0;background:var(--card);overflow-wrap:anywhere}
.legend{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--muted);margin:8px 0 16px}
.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
@media (min-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1440px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.card{background:var(--card);border:2px solid var(--ink);border-radius:4px;padding:14px;min-width:0;box-shadow:4px 4px 0 var(--accent)}
.card.skip{box-shadow:4px 4px 0 var(--dead);border-style:dashed}
.badge{display:inline-block;font:700 12px/1 ui-monospace,Menlo,Consolas,monospace;padding:4px 7px;border:2px solid var(--ink);margin-right:6px;text-transform:uppercase}
.badge.v{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.card h2{font-size:19px;margin:10px 0 4px;overflow-wrap:anywhere}
.card h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 6px;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:3px}
.card p{margin:4px 0;overflow-wrap:anywhere}
.lbl{font-weight:700}
ul.items{list-style:none;padding:0;margin:0}
ul.items li{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px dotted var(--line);min-width:0}
ul.items li>div{min-width:0;overflow-wrap:anywhere}
input[type=checkbox],input[type=radio]{margin-top:4px;flex:0 0 auto;accent-color:var(--accent);width:16px;height:16px}
label.pick{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.chip{display:inline-block;font-size:11px;line-height:1;padding:3px 6px;border-radius:10px;border:1px solid var(--line);margin:2px 4px 2px 0;white-space:nowrap}
.chip.new{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.chip.dead{background:var(--dead-soft);color:var(--dead);border-color:var(--dead)}
.spk{font-weight:700}
.small{font-size:12px;color:var(--muted)}
.band{font-size:12px;color:var(--muted)}
.out{color:var(--accent);font-weight:700}
.guards{display:flex;flex-wrap:wrap;gap:6px}
.g{font:700 12px/1 ui-monospace,Menlo,Consolas,monospace;padding:5px 7px;border:2px solid currentColor;border-radius:3px}
.g.green{color:var(--dead);background:var(--dead-soft)}
.g.red{color:var(--accent);background:var(--red-soft)}
.g.unmeasured{color:var(--unm);border-style:dashed;background:transparent}
details{margin-top:6px}
summary{cursor:pointer;font-size:13px}
.finding{font-size:12px;margin:3px 0;overflow-wrap:anywhere}
.panel{margin-top:24px;background:var(--card);border:2px solid var(--ink);padding:14px;border-radius:4px}
textarea{width:100%;min-height:110px;font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);padding:8px;border-radius:3px}
button{font:700 14px/1 ui-sans-serif,system-ui,sans-serif;padding:10px 14px;border:2px solid var(--ink);background:var(--accent);color:var(--accent-ink);cursor:pointer;border-radius:3px;margin:8px 8px 0 0}
button.ghost{background:transparent;color:var(--ink)}
button:disabled{opacity:.5;cursor:not-allowed}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--paper);border:1px solid var(--line);padding:10px;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;max-height:340px;overflow:auto}
.status{font-size:13px;margin-top:8px;color:var(--muted)}
.status.warn{color:var(--accent);font-weight:700}
`;

const SCRIPT = `
(function(){
var D=JSON.parse(document.getElementById('council-data').textContent);
var ORDER=['story','economy','lines','uniqueness'];
var GLYPH={green:'\\u2713 pass',red:'\\u2715 block',unmeasured:'\\u2013 unmeasured'};
function h(tag,attrs){var el=document.createElement(tag);if(attrs)for(var k in attrs){var v=attrs[k];if(v==null||v===false)continue;if(k==='text')el.textContent=v;else if(k==='cls')el.className=v;else el.setAttribute(k,v===true?'':v);}for(var i=2;i<arguments.length;i++){var c=arguments[i];if(c==null||c===false)continue;if(Array.isArray(c))c.forEach(function(x){if(x!=null&&x!==false)el.appendChild(typeof x==='string'?document.createTextNode(x):x);});else el.appendChild(typeof c==='string'?document.createTextNode(c):c);}return el;}
function chip(text,cls){return h('span',{cls:'chip'+(cls?' '+cls:''),text:text});}
var uid=0;
function pick(pathId,key,content){var id='k'+(++uid);return h('li',null,h('input',{type:'checkbox',id:id,'data-path':pathId,'data-key':key,'aria-label':'keep '+key+' from '+pathId}),h('div',null,h('label',{for:id,cls:'pick'},content)));}
function inBand(v,min,max){return (min==null||v>=min)&&(max==null||v<=max);}
function cmp(label,value,min,max,suffix){var ok=inBand(value,min,max);var band=(min!=null&&max!=null)?(min+'\\u2013'+max):(max!=null?('\\u2264 '+max):('\\u2265 '+min));return h('p',null,h('span',{cls:'lbl',text:label+': '}),String(value)+(suffix||'')+' ',h('span',{cls:'band',text:'(band '+band+')'}),ok?null:h('span',{cls:'out',text:' ! outside band'}));}
function verdictBlock(pathId){var v=D.verdicts[pathId];var wrap=h('div');if(!v){wrap.appendChild(h('div',{cls:'guards'},ORDER.map(function(g){return h('span',{cls:'g unmeasured',text:g+' \\u2013 not assessed'});})));wrap.appendChild(h('p',{cls:'small',text:'No verdict for this path in verdicts.json (assess not run, or the loader returned nothing).'}));return wrap;}
var by={};(v.guards||[]).forEach(function(g){by[g.guard]=g;});
wrap.appendChild(h('div',{cls:'guards'},ORDER.map(function(g){var x=by[g];var st=x?x.state:'unmeasured';return h('span',{cls:'g '+st,title:x?x.basis:'missing',text:g+' '+(GLYPH[st]||st)});})));
if(v.blocked)wrap.appendChild(h('p',{cls:'out',text:'Blocked by: '+v.blockedBy.join(', ')}));
var n=0;ORDER.forEach(function(g){if(by[g])n+=by[g].findings.length;});
var det=h('details',null,h('summary',{text:'Findings ('+n+')'}));
ORDER.forEach(function(g){var x=by[g];if(!x)return;det.appendChild(h('p',{cls:'small'},h('b',{text:g}),' \\u2014 '+x.state+', basis: '+x.basis));x.findings.forEach(function(f){det.appendChild(h('p',{cls:'finding',text:'['+f.severity+'] '+f.code+(f.ref?' ('+f.ref+')':'')+': '+f.message}));});});
wrap.appendChild(det);return wrap;}
function pathCard(p){var id=p.pathId;var card=h('article',{cls:'card','aria-label':'path '+id});
var sp='s'+(++uid);
card.appendChild(h('div',null,h('span',{cls:'badge',text:p.seat}),h('span',{cls:'badge v',text:'variant '+p.variant}),h('span',{cls:'small',text:p.variant==='A'?'expected tone':'deliberate swerve'})));
card.appendChild(h('h2',{text:p.title}));
card.appendChild(h('p',null,h('i',{text:p.logline})));
card.appendChild(h('p',null,h('span',{cls:'lbl',text:'Goal: '}),p.goal));
card.appendChild(h('p',null,h('span',{cls:'lbl',text:'Why not filler: '}),p.whyNotFiller));
card.appendChild(h('p',null,h('label',{cls:'pick',for:sp},h('input',{type:'radio',name:'spine',id:sp,value:id,'data-spine':id}),h('b',{text:"Take this path's spine"}))));
card.appendChild(h('ul',{cls:'items'},pick(id,'giver',[h('span',{cls:'lbl',text:'Giver: '}),p.fingerprint.giver])));
var fp=p.fingerprint;card.appendChild(h('p',{cls:'small',text:'verb '+fp.coreVerb+' \\u00b7 payoff '+fp.payoffKind+' \\u00b7 '+fp.location+' \\u00b7 new mechanic '+(fp.newMechanic==null?'none':fp.newMechanic)}));
card.appendChild(h('h3',{text:'Guards'}));card.appendChild(verdictBlock(id));
card.appendChild(h('h3',{text:'Characters'}));
card.appendChild(h('ul',{cls:'items'},p.characters.map(function(c){return pick(id,'character:'+c.id,[h('span',{cls:'spk',text:c.name+' '}),chip(c.status,c.status==='new'?'new':''),chip(c.role),c.designNote?h('div',{cls:'small',text:c.designNote}):null]);})));
card.appendChild(h('h3',{text:'Beats'}));
card.appendChild(h('ul',{cls:'items'},p.beats.map(function(b){var o=b.objective||{};return pick(id,'beat:'+b.id,[h('b',{text:b.title}),h('div',{cls:'small',text:[o.verb,o.target,o.location?('@ '+o.location):null].filter(Boolean).join(' \\u00b7 ')}),h('div',{text:b.summary})]);})));
card.appendChild(h('h3',{text:'Lines ('+p.lines.length+')'}));
card.appendChild(h('ul',{cls:'items'},p.lines.map(function(l){return pick(id,'line:'+l.id,[h('span',{cls:'spk',text:l.speaker+': '}),l.text,h('div',null,l.purpose.map(function(x){return chip(x,x==='character'?'dead':'');}),(l.when||[]).map(function(w){return chip('when '+w);}))]);})));
card.appendChild(h('h3',{text:'Mechanics'}));
card.appendChild(p.mechanics.length?h('ul',{cls:'items'},p.mechanics.map(function(m){return pick(id,'mechanic:'+m.id,[h('b',{text:m.name+' '}),chip(m.status,m.status==='new'?'new':''),chip('home: '+m.home),h('div',{cls:'small',text:m.summary})]);})):h('p',{cls:'small',text:'none'}));
card.appendChild(h('h3',{text:'Reward and difficulty vs act band'}));
var b=D.band;var r=p.reward,d=p.difficulty;
if(b){card.appendChild(cmp('Cash',r.cash,b.cash.min,b.cash.max));card.appendChild(cmp('Heat peak',d.heatPeak,null,b.heatCeiling));card.appendChild(cmp('Enemies',d.enemyCount,null,b.enemyCount.max));card.appendChild(cmp('Waves',d.enemyWaves,null,b.enemyWaves.max));card.appendChild(cmp('Minutes',d.minutes,b.minutes.min,b.minutes.max));
card.appendChild(h('p',null,h('span',{cls:'lbl',text:'Timer: '}),d.timeLimitS==null?'none':(d.timeLimitS+' s'),' ',h('span',{cls:'band',text:'(timer '+(b.timerAllowed?'allowed':'not allowed')+')'}),(d.timeLimitS!=null&&!b.timerAllowed)?h('span',{cls:'out',text:' ! outside band'}):null));
card.appendChild(h('p',{cls:'small',text:'Band: quest-economy.json r'+D.economyRevision+(D.economyProvisional?' (provisional)':'')+'. Display only; the economy guard is the verdict.'}));}
else{card.appendChild(h('p',null,'Cash '+r.cash+', heat '+d.heatPeak+', '+d.enemyCount+' enemies in '+d.enemyWaves+' waves, '+d.minutes+' min'));card.appendChild(h('p',{cls:'small',text:'No act band found.'}));}
card.appendChild(h('p',null,h('span',{cls:'lbl',text:'Unlocks: '}),r.unlocks.length?r.unlocks.join(', '):'none'));
card.appendChild(h('p',null,h('span',{cls:'lbl',text:'Fail states: '}),d.failStates.join('; ')));
var s=p.story||{reads:[],writes:[]};card.appendChild(h('p',{cls:'small',text:'Story reads: '+(s.reads.join(', ')||'none')+' \\u00b7 writes: '+(s.writes.map(function(w){return w.var+'='+JSON.stringify(w.value);}).join(', ')||'none')}));
return card;}
function skipCard(slot){return h('article',{cls:'card skip','aria-label':'seat '+slot.seat+' skipped'},h('span',{cls:'badge',text:slot.seat}),h('h2',{text:'No path from this seat'}),h('p',{text:slot.reason}),h('p',{cls:'small',text:'Nothing here is invented: the seat delivered no valid proposal, so its two variants are missing from this fuse.'}));}
var grid=document.getElementById('paths');
D.slots.forEach(function(s){grid.appendChild(s.kind==='path'?pathCard(s.proposal):skipCard(s));});
var notes=document.getElementById('notes');var out=document.getElementById('fusion-json');var status=document.getElementById('status');var saveBtn=document.getElementById('save');
function collect(){var map={};var order=[];D.slots.forEach(function(s){if(s.kind==='path'){map[s.proposal.pathId]=[];order.push(s.proposal.pathId);}});
var sp=document.querySelector('input[name=spine]:checked');if(sp&&map[sp.value])map[sp.value].push('spine');
Array.prototype.forEach.call(document.querySelectorAll('input[data-key]:checked'),function(el){var k=el.getAttribute('data-path');if(map[k])map[k].push(el.getAttribute('data-key'));});
var sources=order.filter(function(k){return map[k].length;}).map(function(k){return {pathId:k,elements:map[k]};});
return {runId:D.runId,sources:sources,notes:notes.value,savedAt:new Date().toISOString()};}
function refresh(){out.textContent=JSON.stringify(collect(),null,2);}
function apply(doc){if(!doc||!Array.isArray(doc.sources))return;doc.sources.forEach(function(src){(src.elements||[]).forEach(function(k){if(k==='spine'){var r=document.querySelector('input[data-spine="'+CSS.escape(src.pathId)+'"]');if(r)r.checked=true;return;}var el=document.querySelector('input[data-path="'+CSS.escape(src.pathId)+'"][data-key="'+CSS.escape(k)+'"]');if(el)el.checked=true;});});if(typeof doc.notes==='string')notes.value=doc.notes;refresh();}
document.addEventListener('change',refresh);notes.addEventListener('input',refresh);refresh();
document.getElementById('copy').addEventListener('click',function(){var t=out.textContent;function sel(){var r=document.createRange();r.selectNodeContents(out);var s=window.getSelection();s.removeAllRanges();s.addRange(r);status.textContent='Selected: press Ctrl+C / Cmd+C to copy.';}
try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){status.textContent='Fusion JSON copied.';},sel);}else sel();}catch(e){sel();}});
function timeout(p,ms){return Promise.race([p,new Promise(function(res){setTimeout(function(){res('__timeout');},ms);})]);}
var db=null;
function unavailable(){status.className='status warn';status.textContent='Saving unavailable here; copy the JSON below.';saveBtn.disabled=true;}
saveBtn.disabled=true;status.textContent='Connecting to the artifact store\\u2026';
var useP=(window.claude&&typeof window.claude.use==='function')?timeout(Promise.resolve(window.claude.use('db')).catch(function(){return null;}),10000):Promise.resolve(null);
useP.then(function(ns){if(!ns||ns==='__timeout'){unavailable();return;}db=ns;saveBtn.disabled=false;status.className='status';status.textContent='Saving available. Reading any saved fusion\\u2026';
return timeout(db.doc('fusion/current').get(),10000).then(function(snap){if(snap==='__timeout'){status.textContent='Saving available. The saved fusion did not load within 10 s.';return;}
if(snap&&snap.exists){var d=snap.data();if(d&&d.runId&&d.runId!==D.runId){status.textContent='Saving available. The saved fusion is from run '+d.runId+', not this run; it was not applied (saving here replaces it).';return;}apply(d);status.textContent='Loaded the saved fusion from '+(d&&d.savedAt?d.savedAt:'an earlier save')+'.';}
else status.textContent='Saving available. No fusion saved yet.';}).catch(function(e){status.textContent='Saving available. Reading the saved fusion failed ('+((e&&e.code)||'error')+').';});}).catch(function(){unavailable();});
saveBtn.addEventListener('click',function(){if(!db){unavailable();return;}var doc=collect();out.textContent=JSON.stringify(doc,null,2);saveBtn.disabled=true;status.className='status';status.textContent='Saving\\u2026';
function attempt(n){return db.doc('fusion/current').set(doc).catch(function(e){if(e&&e.code==='unavailable'&&n===0)return new Promise(function(res){setTimeout(res,400+Math.random()*600);}).then(function(){return attempt(1);});throw e;});}
attempt(0).then(function(){status.textContent='Saved fusion/current at '+doc.savedAt+' ('+doc.sources.length+' source path(s)).';}).catch(function(e){status.className='status warn';status.textContent='Save failed ('+((e&&e.code)||'error')+(e&&e.message?': '+e.message:'')+'). Copy the JSON below instead.';}).then(function(){saveBtn.disabled=false;});});
})();
`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** JSON safe inside a <script> element. */
const LS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');
const embed = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(LS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

export function renderHtml(data) {
  const live = data.slots.filter((s) => s.kind === 'path').length;
  const seatLine = Object.entries(data.seats).map(([k, v]) => `${k}: ${v.status}${v.cost_usd != null ? ` ($${Number(v.cost_usd).toFixed(2)})` : ''}`).join(' · ') || 'no seats.json';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quest Council Fuse</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Quest Council <span>Fuse</span></h1>
<p class="meta">GTAI: Uprising · run ${esc(data.runId)} · act ${esc(data.act ?? '?')} · ${live} path(s) · ${esc(seatLine)}</p>
<div class="goal"><b>Owner goal:</b> ${esc(data.goal) || '<i>(none recorded)</i>'}${data.constraints ? `<br><b>Constraints:</b> ${esc(data.constraints)}` : ''}</div>
<div class="legend" aria-label="Legend">
<span class="g green">✓ pass</span><span class="g red">✕ block</span><span class="g unmeasured">– unmeasured (never a pass)</span>
<span>Tick what to keep from each path; pick one spine; write notes; save.</span>
</div>
<section id="paths" class="grid" aria-label="Council paths"></section>
<section class="panel" aria-labelledby="fuse-h">
<h2 id="fuse-h" style="margin:0 0 8px;font-size:18px">Fuse</h2>
<label for="notes" class="lbl">Owner notes (copied verbatim into the quest package)</label>
<textarea id="notes" placeholder="What to keep, what to change, the tone you want..."></textarea>
<div><button id="save" type="button">Save fusion</button><button id="copy" type="button" class="ghost">Copy fusion JSON</button></div>
<p id="status" class="status" role="status" aria-live="polite"></p>
<pre id="fusion-json" aria-label="Fusion JSON"></pre>
</section>
</main>
<script type="application/json" id="council-data">${embed(data)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export function renderFuse(runDir) {
  const data = collectCouncil(runDir);
  const html = renderHtml(data);
  const file = path.join(runDir, 'fuse.html');
  fs.writeFileSync(file, html);
  return { file, bytes: Buffer.byteLength(html), paths: data.slots.filter((s) => s.kind === 'path').length, skipped: data.slots.filter((s) => s.kind === 'skip').length };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: render.mjs <runDir>'); process.exit(2); }
  const out = renderFuse(path.resolve(dir));
  console.log(`fuse: ${out.file} (${Math.round(out.bytes / 1024)} KB, ${out.paths} paths, ${out.skipped} skipped)`);
}
