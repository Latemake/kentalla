import { formations, advance, suggestion, suggestions, substitute, substituteMany, assignPosition, undoChange, setAvailability, addParticipant, periodEnd, resumeMatch, time, canPlay, slotCoordinates, moveSlot, setSlotRole, resetLayout, configureSlot, initialLineup } from './engine.js';
const $ = s => document.querySelector(s);
const icons = {
  pitch:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 9h4v6H3m18-6h-4v6h4"/><circle cx="12" cy="12" r="3"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
  chart:'<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 10 8 14 5-4 13-9 8-14Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  swap:'<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.pitch}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
let state, lastSavedRaw = null, storageConflict = false;
try { lastSavedRaw=localStorage.getItem('kentalla-v1'); state = JSON.parse(lastSavedRaw); if (!Array.isArray(state?.players) || !Array.isArray(state?.history)) state = null; } catch {}
state ||= { players: [], history:[], match:null, onboardingVersion:1 };
const legacyNames=['Elias','Oliver','Leo','Eino','Noel','Onni','Väinö','Aatos','Emil','Toivo','Aapo','Otso'];
const legacyDemo=!state.onboardingVersion&&state.players.length===12&&legacyNames.every((name,i)=>state.players.some(p=>p.name===name&&p.number===i+1&&p.weight===1));
if(legacyDemo)state.legacyDemoRoster=true;
if(legacyDemo&&!state.match?.elapsed&&!state.match?.running&&!(state.match?.events?.length)&&(!state.match||state.match.home==='Oma joukkue'&&state.match.away==='Vierasjoukkue')) {
  state.players=[];state.match=null;
}
state.onboardingVersion=1;
function createMatch(config = {}) {
  const mode = Number(config.mode || 7);
  const roster = config.roster || state.players.map(p => p.id);
  const rotationRules=Object.fromEntries(state.players.map(p=>[p.id,{roles:p.rotationRoles||['MV','P','KH','H']} ]));
  return { id:newId(), date:new Date().toISOString(), home:'Oma joukkue', away:'Vierasjoukkue', venue:'Kotikenttä', duration:60, periods:2, period:1, intermission:false, batchSize:0, unavailable:[], interval:5, fair:true, rotateKeeper:false, countdown:false, ...config, mode, roster, rotationRules, slots:initialLineup(mode,roster,rotationRules), stats:{}, elapsed:0, running:false, finished:false, events:[], nextSub:Number(config.interval || 5)*60, lastTick:Date.now() };
}
if(state.match) {
  state.match.periods ||= 1; // Existing matches keep their original single-period timing.
  state.match.period ||= 1;
  state.match.unavailable ||= [];
  state.match.rotationRules ||= Object.fromEntries(state.players.map(p=>[p.id,{roles:p.rotationRoles||['MV','P','KH','H']}]));
}
let tab = 'ottelu', pitchView = 'pitch', allMinutes = false, lastAlert = null, audioContext, displayedSuggestion = null;
const player = id => state.players.find(p=>p.id===id) || {name:'Poistettu pelaaja',number:'–',weight:1};
let storageFailed = false;
function lockStaleTab() {
  if(storageConflict)return;
  storageConflict=true;updateWakeLock();
  $('#dialog').close();$('#main').inert=true;
  $('.save-status').hidden=false;
  $('.save-status').innerHTML='Tiedot muuttuivat toisessa välilehdessä. Päivitä tämä näkymä ennen jatkamista. <button class="btn" data-action="reload">Lataa uusin tilanne</button>';
}
function save() {
  if(storageConflict)return;
  try {
    if(localStorage.getItem('kentalla-v1')!==lastSavedRaw){lockStaleTab();return;}
    const raw=JSON.stringify(state);localStorage.setItem('kentalla-v1',raw);lastSavedRaw=raw;
  } catch { if (!storageFailed) { storageFailed=true; $('.save-status').hidden=false; $('.save-status').textContent='Tallennus ei ole käytettävissä. Lataa raportti talteen.'; toast('Selaimen tallennustila ei ole käytettävissä. Lataa raportti talteen.'); } }
}
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000); }
function modal(title,content) { $('#dialog-content').innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="Sulje">${icon('close')}</button></div>${content}`; if (!$('#dialog').open) $('#dialog').showModal(); }
function heading(title,subtitle,action='') { return `<div class="page-heading"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>`; }
const named = id => escape(player(id).name);
function pitch(m) {
  if (pitchView==='list') return `<div class="list-view">${m.slots.map((s,i)=>`<div class="bench-row"><span class="number">${escape(player(s.id).number)}</span><div class="bench-info"><strong>${s.id?named(s.id):'Valitse pelaaja'}</strong><small>${s.pos} · <span data-stat="${s.id}">${time(m.stats[s.id]?.total||0)}</span></small></div><button class="btn" data-action="position" data-index="${i}" ${m.finished?'disabled':''}>Muuta</button></div>`).join('')}</div>`;
  return `<div class="pitch-container"><div class="pitch"><div class="pitch-lines"><div class="halfway"></div><div class="center-circle"></div><div class="box top"></div><div class="box bottom"></div><div class="goal top"></div><div class="goal bottom"></div></div>${m.slots.map((s,i)=>{
    const {x,y}=slotCoordinates(m,i);
    return `<button class="pitch-player ${s.pos==='MV'?'keeper':''} ${s.id?'':'vacant'}" style="left:${x}%;top:${y}%" data-action="position" data-index="${i}" data-drag-slot="${i}" aria-label="${s.pos}: ${s.id?named(s.id):'Tyhjä paikka'}, vedä paikkaa tai avaa napauttamalla" ${m.finished?'disabled':''}><span class="jersey">${s.id?escape(player(s.id).number):'+'}</span><strong>${s.id?named(s.id):'Lisää pelaaja'}</strong><small>${s.pos} ${m.rotationRules?.[s.id]?.slots?'· 🔒':''} · <span data-stat="${s.id}">${time(m.stats[s.id]?.total||0)}</span></small></button>`;
  }).join('')}</div><div class="pitch-tools"><span>Vedä paikkaa. Napauta muokataksesi.</span><button class="text-btn" data-action="reset-layout" ${m.finished?'disabled':''}>Palauta muoto</button></div></div>`;
}
function swapPanel(m) {
  const changes=suggestions(m,state.players), due=m.elapsed>=m.nextSub;
  displayedSuggestion = changes;
  const person=(id,enter)=>`<div><span class="direction ${enter?'in':'out'}">${enter?'↗ SISÄÄN':'↙ ULOS'}</span><div class="swap-player"><span class="number">${escape(player(id).number)}</span><div><strong>${named(id)}</strong><small><span data-stat="${id}">${time(m.stats[id]?.total||0)}</span> pelattu</small></div></div></div>`;
  return `<section class="panel swap-panel"><div class="panel-head"><h2 class="panel-title">${changes.length>1?'Seuraavat vaihdot':'Seuraava vaihto'}</h2></div><div class="swap-body">${m.finished?'<p class="swap-intro">Ottelu päättynyt. Raportti tallennettu.</p>':changes.length?`<p class="swap-intro" id="next-sub-copy">${due?'<strong>Vaihdon aika!</strong>':`Vaihtoon <strong>${time(m.nextSub-m.elapsed)}</strong>`}</p><div class="swap-group">${changes.map(s=>`<div class="swap-players">${person(s.outId,false)}${icon('arrow')}${person(s.inId,true)}</div>`).join('')}</div><div class="swap-actions"><button class="btn primary" data-action="auto-swap">${icon('swap')}${changes.length>1?`Tee ${changes.length} vaihtoa`:'Tee vaihto'}</button><button class="btn" data-action="manual-swap">Valitse pelaajat</button></div>`:'<p class="swap-intro">Ei ehdotettavia vaihtoja.</p>'}${m.undo&&!m.finished?'<button class="text-btn undo-btn" data-action="undo">Peruuta viimeisin muutos</button>':''}</div></section>`;
}
function minutesTable(m,full=false,report=false) {
  const ids=m.roster;
  const getPlayer=id=>report?(m.players?.find(p=>p.id===id)||player(id)):player(id);
  return `<div class="table-wrap"><table><thead><tr><th>Pelaaja</th><th>${report?'Viimeinen paikka':'Paikka'}</th><th>Pelattu</th>${full?'<th>MV</th><th>Puolustus</th><th>Keskikenttä</th><th>Hyökkäys</th>':''}</tr></thead><tbody>${ids.map(id=>{
    const p=getPlayer(id),stat=m.stats[id]||{total:0,positions:{}},slot=m.slots.find(s=>s.id===id);
    return `<tr><td><div class="player-cell"><span class="number">${escape(p.number)}</span>${escape(p.name)}</div></td><td><span class="state-label ${slot?'':'benched'}">${slot?slot.pos:'Vaihdossa'}</span></td><td><strong data-stat="${id}">${time(stat.total)}</strong></td>${full?['MV','P','KH','H'].map(pos=>`<td data-position-stat="${id}:${pos}">${time(stat.positions[pos]||0)}</td>`).join(''):''}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function renderMatch() {
  if(!state.match) return heading('Ottelu','')+`<section class="panel empty onboarding"><h2>${state.players.length?'Valmistele ensimmäinen ottelu':'Lisää oman joukkueesi pelaajat'}</h2><p>${state.players.length>=5?'Valitse pelimuoto, osallistujat ja peliaika.':`Otteluun tarvitaan vähintään 5 pelaajaa.${state.players.length?` Lisättynä ${state.players.length}/5.`:''}`}</p><button class="btn primary" data-action="${state.players.length>=5?'new':'setup-players'}">${icon('plus')}${state.players.length>=5?'Luo ottelu':'Lisää pelaajat'}</button><button class="btn" data-action="new">Suunnittele tyhjä kokoonpano</button></section>`;
  const m=state.match,field=m.slots.map(s=>s.id),bench=m.roster.filter(id=>!field.includes(id));
  return heading('Ottelu','',`<button class="btn" data-action="new">${icon('plus')}Uusi ottelu</button>`)+
  `<div id="alert-slot" aria-live="polite"></div><section class="match-card"><div class="match-top"><div class="match-info"><h2>${escape(m.home)} <span>–</span> ${escape(m.away)}</h2><p>${new Date(m.date).toLocaleDateString('fi-FI')}<span>·</span>${m.mode}v${m.mode}<span>·</span>${m.periods>1?`${m.periods} × ${m.duration/m.periods}`:m.duration} min${m.venue?`<span>·</span>${escape(m.venue)}`:''}</p></div><button class="btn" data-action="settings" ${m.finished?'disabled':''}>${icon('settings')}Asetukset</button></div><div class="match-body"><div class="clock-wrap"><div class="clock" id="match-clock">${time(m.countdown?periodEnd(m)-m.elapsed:m.elapsed)}</div><div class="clock-state" id="clock-state"></div></div><div class="clock-controls"><button class="btn primary" data-action="toggle" id="toggle-clock" ${m.finished?'disabled':''}>${icon(m.running?'pause':'play')}${m.intermission?`Aloita ${m.period+1}. jakso`:m.running?'Tauko':m.elapsed?'Jatka ottelua':'Aloita ottelu'}</button><button class="btn" data-action="finish" ${m.finished?'disabled':''}>Lopeta</button></div></div><div class="match-meta"><span>Vaihtoväli <strong>${m.interval} min</strong></span><span id="wake-status"></span><span>${m.fair?'Tasainen peliaika':'Painotettu peliaika'}</span></div></section>
  ${lineupPanels(m)}
  <section class="panel minutes-panel"><div class="panel-head"><h2 class="panel-title">Peliajat</h2><button class="text-btn" data-action="all-minutes" aria-expanded="${allMinutes}">${allMinutes?'Piilota pelipaikat':'Näytä pelipaikoittain'}</button></div>${minutesTable(m,allMinutes)}</section>`;
}
function lineupPanels(m) {
  const field=m.slots.map(s=>s.id),bench=m.roster.filter(id=>!field.includes(id));
  return `  <div class="dashboard"><section class="panel lineup-panel"><div class="panel-head"><h2 class="panel-title">Kokoonpano <span class="count">${field.filter(Boolean).length}/${m.mode}</span></h2><div class="segmented" aria-label="Kokoonpanon näkymä"><button data-action="pitch" aria-pressed="${pitchView==='pitch'}" class="${pitchView==='pitch'?'selected':''}">Kenttä</button><button data-action="list" aria-pressed="${pitchView==='list'}" class="${pitchView==='list'?'selected':''}">Lista</button></div></div>${pitch(m)}</section><div class="right-column">${swapPanel(m)}<section class="panel bench-panel"><div class="panel-head"><h2 class="panel-title">Vaihdossa <span class="count">${bench.length}</span></h2><button class="text-btn" data-action="participants" ${m.finished?'disabled':''}>Osallistujat</button></div><div class="bench-list"><p class="form-help">Vedä pelaajan numero kenttäpaikan päälle.</p>${bench.length?bench.map(id=>`<div class="bench-row"><button class="number bench-drag" data-drag-player="${id}" data-action="bench-swap" data-id="${id}" aria-label="Vedä ${named(id)} kentälle" ${m.finished||m.unavailable.includes(id)?'disabled':''}>${escape(player(id).number)}</button><div class="bench-info"><strong>${named(id)}</strong>${m.unavailable.includes(id)?'<small>Ei käytettävissä</small>':''}</div><span class="bench-time" data-stat="${id}">${time(m.stats[id]?.total||0)}</span><button class="icon-btn" data-action="bench-swap" data-id="${id}" aria-label="Vaihda ${named(id)} kentälle" title="Vaihda kentälle" ${m.finished||m.unavailable.includes(id)?'disabled':''}>${icon('swap')}</button></div>`).join(''):'<p class="form-help">Kaikki pelaajat ovat kentällä.</p>'}<button class="btn add-bench" data-action="add-to-match" ${m.finished?'disabled':''}>+ Lisää pelaaja</button></div></section></div></div>
`;
}
function renderLineup() {
  const m=state.match;if(!m)return renderMatch();
  return heading('Kokoonpano',`${m.mode}v${m.mode} · ${m.finished?'Ottelu päättynyt':m.intermission?'Jaksotauko':m.running?'Ottelu käynnissä':m.elapsed?'Ottelu tauolla':'Valmistelu'}`,'<button class="btn" data-tab="ottelu">Ottelukello</button>')+`<div class="lineup-view">${lineupPanels(m)}</div>`;
}
function renderPlayers() {
  if(!state.players.length)return heading('Pelaajat','')+`<section class="panel empty onboarding"><h2>Oma joukkue alkaa tästä</h2><p>Lisää pelaajan nimi ja pelinumero.</p><button class="btn primary" data-action="add-player">${icon('plus')}Lisää ensimmäinen pelaaja</button></section>`;
  const demo=state.legacyDemoRoster&&state.players.length===12&&legacyNames.every((name,i)=>state.players.some(p=>p.name===name&&p.number===i+1&&p.weight===1));
  return heading('Pelaajat',`${state.players.length} pelaajaa`, `<div class="heading-actions">${!state.match&&state.players.length>=5?'<button class="btn" data-action="new">Luo ottelu</button>':''}<button class="btn primary" data-action="add-player">${icon('plus')}Lisää pelaaja</button></div>`)+(demo?'<div class="notice">Nämä ovat vanhan version esimerkkipelaajia. Voit poistaa ne ja lisätä oman joukkueesi. Keskeneräinen ottelu säilytetään raporttina. <button class="btn" data-action="clear-demo">Poista demopelaajat</button></div>':'')+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>Pelaaja</th><th>Peliaikapaino</th><th></th></tr></thead><tbody>${state.players.map(p=>`<tr><td><div class="player-cell"><span class="number">${escape(p.number)}</span><div>${escape(p.name)}<small class="player-rotation">${escape(rotationLabel(p))}</small></div></div></td><td>${p.weight}×</td><td><button class="btn" data-action="edit-player" data-id="${p.id}">Muokkaa</button></td></tr>`).join('')}</tbody></table></div></section>`;
}
function renderReports() {
  return heading('Raportit',`${state.history.length} tallennettua ottelua`)+`${state.history.length?state.history.slice().reverse().map(m=>`<article class="report-card"><div><h3>${escape(m.home)} – ${escape(m.away)}</h3><p>${new Date(m.date).toLocaleDateString('fi-FI')} · ${m.mode}v${m.mode} · ${time(m.elapsed)}</p></div><button class="btn" data-action="report" data-id="${m.id}">Avaa raportti ${icon('arrow')}</button></article>`).join(''):'<section class="panel empty">Ei vielä raportteja.<br>Raportti tallentuu, kun päätät ottelun.</section>'}<p class="form-help">Raportit säilyvät tässä selaimessa. Lataa CSV-tiedosto, jos haluat säilyttää raportin muualla.</p>`;
}
function render() {
  $('#main').innerHTML=tab==='kokoonpano'?renderLineup():tab==='ottelu'?renderMatch():tab==='pelaajat'?renderPlayers():renderReports();
  document.querySelectorAll('[data-tab]').forEach(b=>{ b.classList.toggle('active',b.dataset.tab===tab); if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current'); });
  updateClock();wakeStatus();notifySubstitution();
}
function updateClock() {
  const m=state.match;
  if(tab==='kokoonpano'&&m){document.querySelectorAll('[data-stat]').forEach(el=>el.textContent=time(m.stats[el.dataset.stat]?.total||0));return;}
  if (tab!=='ottelu'||!m) return;
  const next = suggestions(m,state.players);
  if (JSON.stringify(next)!==JSON.stringify(displayedSuggestion)) {
    const panel=$('.swap-panel');
    if(panel) panel.outerHTML=swapPanel(m);
  }
  $('#match-clock').textContent=time(m.countdown?periodEnd(m)-m.elapsed:m.elapsed);
  $('#clock-state').innerHTML=`<span class="status-dot"></span>${m.finished?'OTTELU PÄÄTTYNYT':m.intermission?'JAKSOTAUKO':m.running?'OTTELU KÄYNNISSÄ':m.elapsed?'OTTELU TAUOLLA':'VALMIINA ALOITUKSEEN'}${m.periods>1&&!m.finished?` · ${m.period}/${m.periods}`:''}`;
  document.querySelectorAll('[data-stat]').forEach(el=>el.textContent=time(m.stats[el.dataset.stat]?.total||0));
  document.querySelectorAll('[data-position-stat]').forEach(el=>{const [id,pos]=el.dataset.positionStat.split(':');el.textContent=time(m.stats[id]?.positions[pos]||0);});
  document.querySelectorAll('[data-progress]').forEach(el=>el.style.width=`${m.elapsed?(m.stats[el.dataset.progress]?.total||0)/m.elapsed*100:0}%`);
  const due=m.elapsed>=m.nextSub&&!m.finished&&!m.intermission&&suggestion(m,state.players);
  $('#alert-slot').innerHTML=m.intermission?`<div class="alert-banner">${m.period}. jakso päättyi. Kello on pysähtynyt. Aloita seuraava jakso, kun peli jatkuu.</div>`:m.slots.some(s=>!s.id)?'<div class="alert-banner">Kentällä on tyhjä paikka. Valitse pelaaja napauttamalla paikkaa kentällä.</div>':due?`<div class="alert-banner"><span>↔ Vaihdon aika — tarkista ehdotus ja vahvista vaihto.</span><button class="text-btn" data-action="snooze">Siirrä 1 min</button></div>`:'';
  const copy=$('#next-sub-copy'); if(copy) copy.innerHTML=m.intermission?'Jakso tauolla':due?'<strong>Vaihdon aika!</strong>':`Vaihtoon <strong>${time(m.nextSub-m.elapsed)}</strong>`;
}
function notifySubstitution(){const m=state.match;if(storageConflict||!m?.running||m.finished||m.intermission||m.elapsed<m.nextSub||lastAlert===m.nextSub||!suggestion(m,state.players))return;lastAlert=m.nextSub;beep();toast(tab==='ottelu'?'Vaihdon aika! Vahvista ehdotetut vaihdot.':'Vaihdon aika! Näet ehdotukset Ottelu-välilehdeltä.');}
function beep() { try { if(!audioContext)return; const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(); oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.12,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.5);oscillator.start();oscillator.stop(audioContext.currentTime+.5); } catch {} }
let lastPerf = null, wakeLock = null, wakePending = false;
function sync() {
  if(storageConflict)return;
  const m=state.match, now=Date.now(), perf=performance.now();
  if(m?.running) {
    const seconds=lastPerf===null?(now-m.lastTick)/1000:(perf-lastPerf)/1000;
    advance(m,seconds); m.lastTick=now; lastPerf=perf;
    if(m.elapsed>=m.duration*60){finishMatch();return;}
    if(m.intermission){save();updateWakeLock();render();beep();toast(`${m.period}. jakso päättyi. Aloita seuraava jakso pelin jatkuessa.`);return;}
    save();
  }
  lastPerf=perf;
  updateClock();notifySubstitution();
}
function wakeStatus() {
  const el=$('#wake-status');
  if(el) el.textContent=state.match?.running ? (wakeLock&&!wakeLock.released?'Näyttö pidetään päällä':'Varmista, että näyttö pysyy päällä') : '';
}
async function updateWakeLock() {
  const needed=()=>!storageConflict&&state.match?.running&&state.match.keepAwake!==false&&!document.hidden;
  if(!needed()) { if(wakeLock) {await wakeLock.release().catch(()=>{});wakeLock=null;}wakeStatus();return; }
  if(wakePending||wakeLock&&!wakeLock.released)return;
  if(!navigator.wakeLock){wakeStatus();return;}
  wakePending=true;
  try {
    const lock=await navigator.wakeLock.request('screen');
    if(!needed()) {await lock.release();return;}
    wakeLock=lock;
    lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;wakeStatus();});
  } catch {} finally {wakePending=false;wakeStatus();}
}
function finishMatch() {
  const m=state.match;if(m.finished)return;m.running=false;m.finished=true;m.intermission=false;m.undo=null;updateWakeLock();
  if(!state.history.some(h=>h.id===m.id))state.history.push(structuredClone({...m,players:state.players.filter(p=>m.roster.includes(p.id))}));
  save();render();toast('Ottelu päättynyt. Raportti on tallennettu.');
}
function settings(isNew=false) {
  sync(); const m=state.match||createMatch({mode:state.players.length<7?5:7}),locked=!isNew&&m.elapsed>0;
  modal(isNew?'Uusi ottelu':'Ottelun asetukset',`<form id="match-form"><div class="form-grid"><label>Oma joukkue<input name="home" value="${escape(m.home)}" maxlength="35" required></label><label>Vastustaja<input name="away" value="${escape(m.away)}" maxlength="35" required></label><label>Pelimuoto<select name="mode" ${locked?'disabled':''}>${[5,7,8,11].map(n=>`<option value="${n}" ${n===m.mode?'selected':''}>${n}v${n}</option>`).join('')}</select></label><label>Peliaika yhteensä (min)<input name="duration" type="number" min="${locked?Math.floor(m.elapsed/60)+1:1}" max="240" value="${m.duration}" ${locked?'readonly':''} required></label><label>Jaksoja<select name="periods" ${locked?'disabled':''}>${[1,2,3,4].map(n=>`<option value="${n}" ${n===m.periods?'selected':''}>${n}${n===1?' (ei jaksotaukoa)':''}</option>`).join('')}</select></label><label>Vaihtoja kerralla<select name="batchSize"><option value="0" ${!m.batchSize?'selected':''}>Automaattinen ryhmä</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===m.batchSize?'selected':''}>${n} pelaaja${n>1?'a':''}</option>`).join('')}</select></label><label>Vaihtoväli (min)<input name="interval" type="number" min="1" max="60" value="${m.interval}" required></label><label>Pelikello<select name="countdown"><option value="false" ${!m.countdown?'selected':''}>Ylöspäin (00:00 →)</option><option value="true" ${m.countdown?'selected':''}>Alaspäin (→ 00:00)</option></select></label><label>Kenttä<input name="venue" maxlength="60" value="${escape(m.venue)}"></label><label>Peliajan tavoite<select name="fair"><option value="true" ${m.fair?'selected':''}>Tasainen peliaika</option><option value="false" ${!m.fair?'selected':''}>Painotettu peliaika</option></select></label><label class="checkbox wide"><input type="checkbox" name="rotateKeeper" ${m.rotateKeeper?'checked':''}>Maalivahti mukana automaattisessa kierrossa</label><label class="checkbox wide"><input type="checkbox" name="keepAwake" ${m.keepAwake!==false?'checked':''}>Pidä näyttö päällä ottelun aikana</label><button type="button" class="btn wide" data-action="test-sound">Testaa hälytysääni</button>${!locked?`<div class="wide"><p class="form-help">Otteluun osallistuvat pelaajat. Ensimmäiset pelaajat muodostavat avauksen, jota voit muokata kenttänäkymässä.</p><div class="roster-select">${state.players.map(p=>`<label><input type="checkbox" name="roster" value="${p.id}" ${isNew||m.roster.includes(p.id)?'checked':''}>${escape(p.number)} · ${escape(p.name)}</label>`).join('')}</div></div>`:'<p class="form-help wide">Pelimuoto ja jaksotus lukitaan ottelun alettua. Muuta pelaajien saatavuutta Osallistujat-painikkeesta.</p>'}</div>${isNew&&m.elapsed&&!m.finished?'<p class="notice">Keskeneräinen ottelu päätetään ja tallennetaan raportiksi, kun luot uuden.</p>':''}<div class="modal-actions"><button type="button" class="btn" data-action="close">Peruuta</button><button class="btn primary">${isNew?'Luo ottelu':'Tallenna asetukset'}</button></div></form>`);
  $('#match-form').onsubmit=e=>{e.preventDefault();sync();const data=new FormData(e.target),config={home:data.get('home').trim(),away:data.get('away').trim(),venue:data.get('venue').trim(),mode:locked?m.mode:Number(data.get('mode')),duration:locked?m.duration:Number(data.get('duration')),periods:locked?m.periods:Number(data.get('periods')),batchSize:Number(data.get('batchSize')),interval:Number(data.get('interval')),countdown:data.get('countdown')==='true',fair:data.get('fair')==='true',rotateKeeper:data.has('rotateKeeper'),keepAwake:data.has('keepAwake'),roster:locked?m.roster:data.getAll('roster')};
    if(!config.home||!config.away){toast('Anna joukkueiden nimet.');return;}
    if(config.duration%config.periods!==0){toast('Peliajan pitää jakautua kokonaisiin minuutteihin jaksojen kesken.');return;}
    if(!isNew&&m.finished){toast('Päättynyttä ottelua ei voi muokata. Luo uusi ottelu.');return;}
    if(isNew){if(m.elapsed&&!m.finished)finishMatch();state.match=createMatch(config);}else{const sameMode=m.mode===config.mode,previousSlots=m.slots;const intervalChanged=m.interval!==config.interval;const changed=m.mode!==config.mode||JSON.stringify(m.roster)!==JSON.stringify(config.roster);Object.assign(m,config);if(changed){if(!sameMode)m.rotationRules=Object.fromEntries(state.players.map(p=>[p.id,{roles:p.rotationRoles||['MV','P','KH','H']}]));m.slots=initialLineup(m.mode,m.roster,m.rotationRules,sameMode?previousSlots:null);}if(intervalChanged)m.nextSub=m.elapsed+m.interval*60;m.undo=null;}
    lastAlert=null;updateWakeLock();save();$('#dialog').close();tab='ottelu';render();toast(isNew?'Uusi ottelu on valmis.':'Asetukset tallennettu.');
  };
}
function swapDialog(inId) {
  const m=state.match,group=suggestions(m,state.players),bench=m.roster.filter(id=>!m.slots.some(slot=>slot.id===id)&&!m.unavailable.includes(id));
  if(m.finished||!bench.length)return;
  const proposed=inId?[{outId:group[0]?.outId||m.slots.find(s=>s.id&&s.pos!=='MV')?.id,inId}]:group;
  modal('Valitse vaihdot',`<form id="swap-form"><p class="form-help">Valitse kunkin poistuvan pelaajan tilalle vaihtopelaaja. Voit tehdä useita vaihtoja samalla kertaa.</p><div class="manual-swap-list">${m.slots.filter(s=>s.id).map(slot=>`<label>${named(slot.id)} · ${slot.pos}<select name="${slot.id}"><option value="">Jatkaa kentällä</option>${bench.filter(id=>canPlay(m,id,m.slots.indexOf(slot))).map(id=>`<option value="${id}" ${proposed.some(c=>c.outId===slot.id&&c.inId===id)?'selected':''}>${named(id)} tilalle</option>`).join('')}</select></label>`).join('')}</div><div class="modal-actions"><button type="button" class="btn" data-action="close">Peruuta</button><button class="btn primary">Tee valitut vaihdot</button></div></form>`);
  $('#swap-form').onsubmit=e=>{e.preventDefault();const changes=[...new FormData(e.target)].filter(([,id])=>id).map(([outId,inId])=>({outId,inId}));sync();if(m.finished){$('#dialog').close();return;}if(!changes.length){toast('Valitse vähintään yksi vaihto.');return;}if(!substituteMany(m,changes)){toast('Tarkista kiertopaikat. Sama pelaaja voi tulla vain yhteen sallittuun paikkaan.');return;}save();render();$('#dialog').close();toast(`${changes.length} vaihtoa tehty.`);};
}
function doSwap(outId,inId) {sync();if(state.match.finished)return;if(substitute(state.match,outId,inId)){save();render();toast(`${player(inId).name} kentälle, ${player(outId).name} vaihtoon.`);}}
function positionDialog(index) {
  const m=state.match,s=m.slots[index];if(m.finished)return;
  const {x,y}=slotCoordinates(m,index);
  modal(`Pelipaikka ${index+1}: ${s.pos}`,`<form id="position-form"><label>Pelaaja<select name="player">${!s.id?'<option value="">Tyhjä paikka</option>':''}${m.roster.filter(id=>!m.unavailable.includes(id)).map(id=>`<option value="${id}" ${id===s.id?'selected':''}>${named(id)}${m.slots.some(v=>v.id===id)?' · kentällä':' · vaihdossa'}</option>`).join('')}</select></label><button type="button" class="text-btn" data-action="add-at-slot" data-index="${index}">+ Luo uusi pelaaja tähän</button><div class="form-grid"><label class="wide">Rooli peliajan seurannassa<select name="role">${['MV','P','KH','H'].map(pos=>`<option value="${pos}" ${s.pos===pos?'selected':''}>${roleName(pos)}</option>`).join('')}</select></label><label>Vaakasijainti (%)<input name="x" type="number" min="8" max="92" step="any" value="${x}" required></label><label>Pystysijainti (%)<input name="y" type="number" min="10" max="90" step="any" value="${y}" required></label></div><p class="form-help">Muodon siirto säilyttää roolin. Roolin muutos vaikuttaa vain tästä hetkestä eteenpäin kertyviin minuutteihin.</p>${s.id?`<button type="button" class="text-btn" data-action="edit-player" data-id="${s.id}">Muokkaa pelaajaa ja kiertopaikkoja</button>`:''}<div class="modal-actions"><button type="button" class="btn" data-action="close">Peruuta</button><button class="btn primary">Vahvista</button></div></form>`);
  $('#position-form').onsubmit=e=>{e.preventDefault();sync();if(m.finished){$('#dialog').close();return;}const d=new FormData(e.target);if(!configureSlot(m,index,{id:d.get('player')||null,pos:d.get('role'),x:Number(d.get('x')),y:Number(d.get('y'))})){toast('Tarkista pelaajien kiertopaikat ja paikkojen välinen etäisyys.');return;}save();render();toast('Kokoonpano päivitetty.');$('#dialog').close();};
}
function roleName(pos){return {MV:'Maalivahti',P:'Puolustus',KH:'Keskikenttä',H:'Hyökkäys'}[pos]||pos;}
function rotationLabel(p){const rule=state.match&&!state.match.finished?state.match.rotationRules?.[p.id]:null;const roles=rule?.roles||p.rotationRoles||['MV','P','KH','H'];return rule?.slots?`Paikka ${rule.slots.map(i=>i+1).join(', ')} + vaihtopenkki`:roles.length===4?'Kaikki kiertoroolit':roles.map(roleName).join(', ');}
function participantsDialog() {
  const m=state.match;if(m.finished)return;
  const extra=state.players.filter(p=>!m.roster.includes(p.id));
  modal('Ottelun osallistujat',`<p class="form-help">Merkitse loukkaantunut tai lähtenyt pelaaja pois käytöstä. Hänelle ei enää ehdoteta vaihtoja. Kentälle jäävän tyhjän paikan voi täyttää kenttänäkymässä.</p><div class="participant-list">${m.roster.map(id=>`<div class="bench-row"><span class="number">${escape(player(id).number)}</span><div class="bench-info"><strong>${named(id)}</strong><small>${m.unavailable.includes(id)?'Ei käytettävissä':m.slots.some(s=>s.id===id)?'Kentällä':'Vaihdossa'}</small></div><button class="btn" data-action="availability" data-id="${id}">${m.unavailable.includes(id)?'Palauta':'Pois käytöstä'}</button></div>`).join('')}</div>${extra.length?`<form id="join-form"><label>Lisää saapunut pelaaja<select name="id">${extra.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></label><button class="btn" style="margin-top:10px">Lisää otteluun</button></form>`:'<p class="form-help">Uuden pelaajan nimen voit lisätä Pelaajat-välilehdellä ja valita hänet sitten tässä otteluun.</p>'}<div class="modal-actions"><button class="btn primary" data-action="close">Valmis</button></div>`);
  const form=$('#join-form');if(form)form.onsubmit=e=>{e.preventDefault();sync();const id=new FormData(e.target).get('id');if(addParticipant(m,id)){save();render();participantsDialog();toast('Pelaaja lisätty vaihtopenkille.');}};
}
function eventText(e,name) {
  switch(e.type) {
    case 'sub':return `${name(e.outId)} → ${name(e.inId)} · ${e.pos}`;
    case 'position':return `${name(e.inId)} ja ${name(e.outId)} vaihtoivat pelipaikkoja`;
    case 'fill':return `${name(e.inId)} kentälle · ${e.pos}`;
    case 'unavailable':return `${name(e.inId)} pois käytöstä`;
    case 'available':return `${name(e.inId)} jälleen käytettävissä`;
    case 'joined':return `${name(e.inId)} saapui otteluun`;
    case 'role':return `${e.inId?name(e.inId):'Tyhjä paikka'}: ${e.previous} → ${e.pos}`;
    default:return 'Kokoonpanon muutos';
  }
}
function editPlayer(id,context={}) {
  const p=id?player(id):{name:'',number:Math.max(0,...state.players.map(p=>Number(p.number)))+1,weight:1};
  const m=state.match,rule=m?.rotationRules?.[id],roles=rule?.roles||p.rotationRoles||['MV','P','KH','H'];
  const inMatch=m&&!m.finished&&(m.roster.includes(id)||context.joinMatch||context.slotIndex!==undefined);
  modal(id?'Muokkaa pelaajaa':'Lisää pelaaja',`<form id="player-form"><div class="form-grid"><label class="wide">Nimi<input name="name" value="${escape(p.name)}" maxlength="35" required autofocus></label><label>Pelinumero<input name="number" type="number" min="1" max="99" value="${p.number}" required></label><label>Peliaikapaino<select name="weight">${[.5,1,1.5,2].map(n=>`<option value="${n}" ${n===p.weight?'selected':''}>${n}×${n===1?' (normaali)':''}</option>`).join('')}</select></label><fieldset class="wide rotation-roles"><legend>Sallitut kiertoroolit</legend>${['MV','P','KH','H'].map(pos=>`<label class="checkbox"><input type="checkbox" name="roles" value="${pos}" ${roles.includes(pos)?'checked':''}>${roleName(pos)}</label>`).join('')}</fieldset>${inMatch?`<label class="wide">Kierto tässä ottelussa<select name="lock"><option value="">Kaikki valittujen roolien paikat</option>${m.slots.map((slot,i)=>`<option value="${i}" ${rule?.slots?.includes(i)?'selected':''}>Vain paikka ${i+1} · ${roleName(slot.pos)} ja vaihtopenkki</option>`).join('')}</select></label>`:''}</div><p class="form-help">Valitse yksi tai useampi rooli. Lukitus rajaa kierrosta muut kenttäpaikat pois. Kiinteä maalivahti ei osallistu automaattiseen vaihtokiertoon.</p><div class="modal-actions">${id?`<button type="button" class="btn danger" data-action="delete-player" data-id="${id}">Poista</button>`:''}<button type="button" class="btn" data-action="close">Peruuta</button><button class="btn primary">${context.slotIndex!==undefined?'Lisää kentälle':'Tallenna'}</button></div></form>`);
  $('#player-form').onsubmit=e=>{
    e.preventDefault();sync();const d=new FormData(e.target),name=d.get('name').trim(),number=Number(d.get('number')),selected=d.getAll('roles');
    if(!name)return;if(!selected.length){toast('Valitse vähintään yksi kiertorooli.');return;}
    if(state.players.some(p=>p.id!==id&&p.number===number)){toast('Tämä pelinumero on jo käytössä.');return;}
    const lock=d.get('lock'),newRule={roles:selected,...(lock!==null&&lock!==''?{slots:[Number(lock)]}:{})};
    const playerId=id||newId(),current=m?.slots.findIndex(s=>s.id===playerId)??-1,target=context.slotIndex??current;
    if(inMatch&&!m.finished){
      if(newRule.slots&&!selected.includes(m.slots[newRule.slots[0]].pos)){toast('Lukitun paikan roolin on kuuluttava valittuihin kiertorooleihin.');return;}
      if(target>=0&&!canPlay(m,playerId,target,{[playerId]:newRule})){toast('Pelaajan nykyisen kenttäpaikan on kuuluttava kiertoon. Vaihda ensin pelaajan paikka tai valitse sen rooli.');return;}
    }
    const val={name,number,weight:Number(d.get('weight')),rotationRoles:selected};if(id)Object.assign(p,val);else state.players.push({id:playerId,...val});
    if(m&&!m.finished){m.rotationRules ||= {};m.rotationRules[playerId]=newRule;m.undo=null;
      if(inMatch&&!m.roster.includes(playerId))addParticipant(m,playerId);
      if(context.slotIndex!==undefined)assignPosition(m,context.slotIndex,playerId);
    }
    save();$('#dialog').close();render();toast('Pelaaja tallennettu.');
  };
}
function report(id) {
  const m=state.history.find(m=>m.id===id);if(!m)return;
  const pname=id=>escape((m.players.find(p=>p.id===id)||player(id)).name);
  modal('Otteluraportti',`<p class="form-help">${escape(m.home)} – ${escape(m.away)} · ${new Date(m.date).toLocaleDateString('fi-FI')} · ${time(m.elapsed)}</p>${minutesTable(m,true,true)}<p class="form-help">MV = maalivahti, P = puolustus, KH = keskikenttä, H = hyökkäys. Ajat muodossa minuutit:sekunnit.</p><h3 style="font-size:13px">Ottelun tapahtumat</h3><div class="events">${m.events.length?m.events.map(e=>`<div class="event"><time>${time(e.at)}</time><span>${eventText(e,pname)}</span></div>`).join(''):'Ei kirjattuja vaihtoja.'}</div><div class="modal-actions"><button class="btn" data-action="close">Sulje</button><button class="btn primary" data-action="csv" data-id="${m.id}">${icon('download')}Lataa CSV</button></div>`);
}
function downloadCSV(id) {
  const m=state.history.find(m=>m.id===id);if(!m)return;
  const rows=[['Päivä','Kotijoukkue','Vierasjoukkue','Pelaaja','Numero','Pelattu (min)','MV (min)','Puolustus (min)','Keskikenttä (min)','Hyökkäys (min)'],...m.roster.map(id=>{const p=m.players.find(p=>p.id===id),s=m.stats[id]||{total:0,positions:{}};return [new Date(m.date).toLocaleDateString('fi-FI'),m.home,m.away,p?.name||'',p?.number||'',s.total/60,...['MV','P','KH','H'].map(pos=>(s.positions[pos]||0)/60)].map(v=>typeof v==='number'?v.toFixed(2).replace('.',','):v);})];
  const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`kentalla-${m.date.slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let drag=null, suppressClickUntil=0, dragFrame=null;
function dragTarget(x,y) {return document.elementFromPoint(x,y)?.closest('.pitch-player');}
function stopDrag(){
  if(dragFrame)cancelAnimationFrame(dragFrame);dragFrame=null;
  drag?.ghost?.remove();document.querySelectorAll('.drop-target,.drag-source').forEach(el=>el.classList.remove('drop-target','drag-source'));drag=null;
}
function drawDrag(){
  if(!drag?.moved)return;
  const {x,y}=drag;drag.ghost.style.left=`${x}px`;drag.ghost.style.top=`${y}px`;
  document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
  if(drag.playerId)dragTarget(x,y)?.classList.add('drop-target');
  if(y<95)window.scrollBy(0,-10);else if(y>innerHeight-95)window.scrollBy(0,10);
  dragFrame=requestAnimationFrame(drawDrag);
}
document.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||storageConflict||state.match?.finished||$('#dialog').open)return;
  const source=e.target.closest('[data-drag-slot],[data-drag-player]');if(!source||source.disabled)return;
  drag={source,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,matchId:state.match.id,slotIndex:source.hasAttribute('data-drag-slot')?Number(source.dataset.dragSlot):null,playerId:source.dataset.dragPlayer,moved:false};
  source.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.moved&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>8){
    drag.moved=true;drag.source.classList.add('drag-source');
    drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=drag.playerId?player(drag.playerId).name:(state.match.slots[drag.slotIndex].id?player(state.match.slots[drag.slotIndex].id).name:state.match.slots[drag.slotIndex].pos);document.body.append(drag.ghost);drawDrag();
  }
  if(drag.moved)e.preventDefault();
},{passive:false});
document.addEventListener('pointerup',e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  const current=drag;if(!current.moved){stopDrag();return;}
  suppressClickUntil=performance.now()+500;
  const target=dragTarget(e.clientX,e.clientY),bounds=$('.pitch')?.getBoundingClientRect();
  stopDrag();sync();const m=state.match;if(storageConflict||m.id!==current.matchId||m.finished)return;
  let ok=false;
  if(current.playerId){if(target)ok=assignPosition(m,Number(target.dataset.index),current.playerId);if(!ok)toast('Pudota pelaaja sallittuun kenttäpaikkaan. Tarkista tarvittaessa kiertopaikat.');}
  else if(bounds&&e.clientX>=bounds.left&&e.clientX<=bounds.right&&e.clientY>=bounds.top&&e.clientY<=bounds.bottom){ok=moveSlot(m,current.slotIndex,(e.clientX-bounds.left)/bounds.width*100,(e.clientY-bounds.top)/bounds.height*100);if(!ok)toast('Jätä hieman tilaa kenttäpaikkojen väliin.');}
  if(ok){save();render();toast(current.playerId?'Pelaaja vaihdettu kentälle.':'Kentän muoto päivitetty.');}
});
document.addEventListener('pointercancel',()=>{if(drag?.moved)suppressClickUntil=performance.now()+500;stopDrag();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){suppressClickUntil=performance.now()+500;stopDrag();}});
document.addEventListener('lostpointercapture',()=>{if(drag)stopDrag();});
document.addEventListener('click',e=>{
  if(performance.now()<suppressClickUntil){e.preventDefault();return;}
  if(e.target.closest('[data-action="reload"]')){location.reload();return;}
  if(storageConflict)return;
  const nav=e.target.closest('[data-tab]');if(nav){tab=nav.dataset.tab;render();return;}
  const b=e.target.closest('[data-action]');if(!b)return;const m=state.match;
  switch(b.dataset.action){
    case 'close':$('#dialog').close();break;
    case 'new':settings(true);break;
    case 'setup-players':tab='pelaajat';render();editPlayer();break;
    case 'clear-demo':sync();if(m?.elapsed&&!m.finished)finishMatch();state.players=[];state.match=null;state.legacyDemoRoster=false;updateWakeLock();save();render();toast('Demopelaajat poistettu. Lisää oma joukkueesi.');break;
    case 'settings':if(m.finished)toast('Luo uusi ottelu muokataksesi asetuksia.');else settings();break;
    case 'toggle':{if(e.detail>1)break;const wasRunning=m.running;sync();if(m.finished)break;if(wasRunning&&!m.running)break;if(m.running)m.running=false;else {if(!m.slots.some(s=>s.id)||(!m.elapsed&&m.slots.some(s=>!s.id))){toast('Täytä avauskokoonpanon paikat ennen aloitusta.');break;}resumeMatch(m);}m.lastTick=Date.now();lastPerf=performance.now();if(m.running){try{audioContext ||=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}}updateWakeLock();save();render();break;}
    case 'finish':modal('Päätetäänkö ottelu?',`<p class="help-copy">Pelattu aika ja pelaajien minuutit tallennetaan otteluraporttiin. Päättynyttä ottelua ei voi jatkaa.</p><div class="modal-actions"><button class="btn" data-action="close">Jatka ottelua</button><button class="btn primary" data-action="confirm-finish">Päätä ja tallenna</button></div>`);break;
    case 'confirm-finish':sync();finishMatch();$('#dialog').close();tab='raportit';render();break;
    case 'auto-swap':{if(e.detail>1)break;const changes=displayedSuggestion;sync();if(substituteMany(m,changes)){save();render();toast(`${changes.length} vaihto${changes.length>1?'a':''} tehty. Voit perua viimeisimmän muutoksen.`);}break;}
    case 'undo':sync();if(undoChange(m)){lastAlert=null;save();render();toast('Muutos peruttu. Myös peliminuutit korjattu.');}break;
    case 'participants':participantsDialog();break;
    case 'availability':sync();if(setAvailability(m,b.dataset.id,m.unavailable.includes(b.dataset.id))){save();render();participantsDialog();}break;
    case 'test-sound':try{audioContext ||=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().then(()=>beep());toast('Testiääni. Tarkista, että kuulet merkkiäänen.');}catch{toast('Ääni ei ole käytettävissä tässä selaimessa.');}break;
    case 'manual-swap':swapDialog();break;
    case 'bench-swap':swapDialog(b.dataset.id);break;
    case 'position':positionDialog(Number(b.dataset.index));break;
    case 'reset-layout':sync();if(resetLayout(m)){save();render();toast('Kentän muoto palautettu.');}break;
    case 'add-to-match':editPlayer(null,{joinMatch:true});break;
    case 'add-at-slot':editPlayer(null,{slotIndex:Number(b.dataset.index)});break;
    case 'pitch':pitchView='pitch';render();break;
    case 'list':pitchView='list';render();break;
    case 'all-minutes':allMinutes=!allMinutes;render();break;
    case 'snooze':m.nextSub=m.elapsed+60;save();render();break;
    case 'add-player':editPlayer();break;
    case 'edit-player':editPlayer(b.dataset.id);break;
    case 'delete-player':if(m?.roster.includes(b.dataset.id)){toast(m.finished?'Luo ensin uusi ottelu ilman tätä pelaajaa.':'Pelaaja on ottelun kokoonpanossa. Poista hänet ensin ottelun asetuksista.');break;}state.players=state.players.filter(p=>p.id!==b.dataset.id);save();$('#dialog').close();render();break;
    case 'report':report(b.dataset.id);break;
    case 'csv':downloadCSV(b.dataset.id);break;
  }
});
$('#help-btn').onclick=()=>modal('Valmentajan pikaohje',`<div class="help-copy"><p><strong>1. Valmistele ottelu.</strong> Valitse Uusi ottelu: aseta pelimuoto, peliaika, vaihtoväli ja osallistujat. Lisää ensin omat pelaajasi Pelaajat-välilehdellä.</p><p><strong>2. Säädä kokoonpano.</strong> Kokoonpano-välilehdellä voit vetää kenttäpaikkoja. Vedä vaihtopelaajan numero kenttäpaikan päälle tehdäksesi vaihdon. Napauttamalla paikkaa voit luoda pelaajan tai muuttaa roolia. Pelaajan muokkauksessa valitaan sallitut kiertoroolit ja mahdollinen lukitus yhteen paikkaan.</p><p><strong>3. Aloita kello.</strong> Peliminuutit kertyvät kentällä oleville. Tauko pysäyttää sekä ottelukellon että minuuttien kertymisen. Jakson päättyessä kello pysähtyy automaattisesti. Aloita seuraava jakso vasta pelin jatkuessa.</p><p><strong>4. Vahvista vaihdot.</strong> Sovellus ehdottaa vaihtoryhmää. Tee vaihdot painamalla Tee vaihdot. Viimeisimmän muutoksen voi perua, jolloin myös peliminuutit korjataan. Vaihtoaika näkyy ilmoituksena ja siitä kuuluu ääni, kun selain sallii sen. Pidä sovellus näkyvissä, jotta saat hälytyksen ajallaan.</p><p><strong>5. Tallenna raportti.</strong> Lopeta ottelu tai anna peliajan täyttyä. Raportista näet minuutit pelipaikoittain ja voit ladata CSV:n.</p><p>Tiedot säilyvät vain tässä selaimessa. Kiinteä maalivahti ei osallistu automaattiseen vaihtokiertoon.</p></div><div class="modal-actions"><button class="btn primary" data-action="close">Selvä, kentälle!</button></div>`);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync();updateWakeLock();}});
window.addEventListener('storage',e=>{if(e.key==='kentalla-v1'&&e.newValue!==lastSavedRaw)lockStaleTab();});
$('.brand').addEventListener('click',e=>{e.preventDefault();tab='ottelu';render();});
window.addEventListener('pagehide',()=>{sync();save();});
render();sync();updateWakeLock();save();setInterval(sync,1000);
