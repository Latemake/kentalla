export const formations = {
  5: ['MV', 'P', 'P', 'KH', 'H'],
  7: ['MV', 'P', 'P', 'KH', 'KH', 'H', 'H'],
  8: ['MV', 'P', 'P', 'P', 'KH', 'KH', 'H', 'H'],
  11: ['MV', 'P', 'P', 'P', 'P', 'KH', 'KH', 'KH', 'H', 'H', 'H']
};
export function advance(match, seconds) {
  if (!match.running || match.finished || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const end = periodEnd(match);
  const delta = Math.max(0, Math.min(seconds, end - match.elapsed));
  match.elapsed += delta;
  accrue(match, delta);
  if (match.elapsed >= end) {
    match.running = false;
    match.intermission = match.elapsed < match.duration * 60;
  }
  return delta;
}
function accrue(match, delta) {
  match.slots.forEach(slot => {
    if (!slot.id) return;
    const stat = match.stats[slot.id] ||= { total: 0, positions: {} };
    stat.total += delta;
    stat.positions[slot.pos] = (stat.positions[slot.pos] || 0) + delta;
  });
}
export function periodEnd(match) {
  return match.duration * 60 * (match.period || 1) / (match.periods || 1);
}
export function resumeMatch(match) {
  if (match.finished || match.elapsed >= match.duration * 60) return false;
  if (match.intermission) { match.period = (match.period || 1) + 1; match.intermission = false; }
  match.running = true;
  return true;
}
export function suggestions(match, players) {
  if (match.finished) return [];
  const field = match.slots.map(s => s.id).filter(Boolean);
  const bench = players.filter(p => match.roster.includes(p.id) && !field.includes(p.id) && !(match.unavailable || []).includes(p.id));
  const eligible = players.filter(p => match.roster.includes(p.id) && !(match.unavailable || []).includes(p.id) && (match.rotateKeeper || !match.slots.some(s => s.id===p.id && s.pos==='MV')));
  const capacity = match.slots.filter(s => s.id && (s.pos!=='MV'||match.rotateKeeper)).length;
  const rates = {};
  let remaining = [...eligible], budget = capacity;
  while(remaining.length) {
    const weightSum=remaining.reduce((sum,p)=>sum+(p.weight||1),0);
    const saturated=remaining.filter(p=>budget*(p.weight||1)/weightSum>=1);
    if(!saturated.length){for(const p of remaining)rates[p.id]=budget*(p.weight||1)/weightSum;break;}
    for(const p of saturated)rates[p.id]=1;
    budget-=saturated.length;remaining=remaining.filter(p=>!saturated.includes(p));
  }
  const horizon=Math.min(match.duration*60,match.elapsed+match.interval*60);
  const score = id => (match.stats[id]?.total || 0) - (match.fair ? 0 : (rates[id]||0)*horizon);
  bench.sort((a,b) => score(a.id) - score(b.id));
  const outgoing = [...match.slots].filter(s => s.id && (s.pos !== 'MV' || match.rotateKeeper)).sort((a,b) => score(b.id) - score(a.id));
  const count = Math.min(bench.length, outgoing.length, Number(match.batchSize) || Infinity);
  const assigned=new Map();
  function place(incoming,seen=new Set()) {
    const options=outgoing.filter(slot=>canPlay(match,incoming.id,match.slots.indexOf(slot))&&(match.fair||score(incoming.id)<score(slot.id)-1e-7));
    // Keep priority order, but reassign a flexible player if that frees the
    // only compatible place for a player with a restricted rotation.
    for(const slot of options.filter(s=>!assigned.has(s))) {if(!seen.has(slot)){assigned.set(slot,incoming);return true;}}
    for(const slot of options) {
      if(seen.has(slot))continue;seen.add(slot);
      if(place(assigned.get(slot),seen)){assigned.set(slot,incoming);return true;}
    }
    return false;
  }
  for(const incoming of bench){if(assigned.size>=count)break;place(incoming);}
  return outgoing.filter(slot=>assigned.has(slot)).map(slot=>({inId:assigned.get(slot).id,outId:slot.id,pos:slot.pos}));
}
export function canPlay(match,id,index,rules=match.rotationRules) {
  const slot=match.slots[index],rule=rules?.[id];
  return !!slot&&(!rule?.roles||rule.roles.includes(slot.pos))&&(!rule?.slots||rule.slots.includes(index));
}
export function initialLineup(mode,roster,rules={},template=null) {
  const match={slots:template?template.map(slot=>({...slot,id:null})):formations[mode].map(pos=>({pos,id:null})),rotationRules:rules};
  function place(id,seen=new Set()) {
    const options=match.slots.map((s,i)=>i).filter(i=>canPlay(match,id,i)&&!seen.has(i));
    for(const i of options)if(!match.slots[i].id){match.slots[i].id=id;return true;}
    for(const i of options){seen.add(i);if(place(match.slots[i].id,seen)){match.slots[i].id=id;return true;}}
    return false;
  }
  for(const id of roster){if(match.slots.every(s=>s.id))break;place(id);}
  return match.slots;
}
export function slotCoordinates(match,index) {
  const slot=match.slots[index];
  if(Number.isFinite(slot.x)&&Number.isFinite(slot.y))return {x:slot.x,y:slot.y};
  const rows=[...new Set(formations[match.mode]||match.slots.map(s=>s.pos))].reverse();
  const group=match.slots.map((s,i)=>({...s,index:i})).filter(s=>s.pos===slot.pos);
  return {x:(group.findIndex(s=>s.index===index)+1)*100/(group.length+1),y:16+Math.max(0,rows.indexOf(slot.pos))*68/Math.max(1,rows.length-1)};
}
export function moveSlot(match,index,x,y) {
  if(match.finished||!match.slots[index]||!Number.isFinite(x)||!Number.isFinite(y))return false;
  x=Math.max(8,Math.min(92,x));y=Math.max(10,Math.min(90,y));
  if(match.slots.some((s,i)=>i!==index&&Math.hypot(slotCoordinates(match,i).x-x,slotCoordinates(match,i).y-y)<10))return false;
  checkpoint(match);Object.assign(match.slots[index],{x,y});return true;
}
export function setSlotRole(match,index,pos) {
  const slot=match.slots[index];
  if(match.finished||!slot||!['MV','P','KH','H'].includes(pos)||slot.pos===pos)return false;
  if(slot.id&&match.rotationRules?.[slot.id]?.roles&&!match.rotationRules[slot.id].roles.includes(pos))return false;
  checkpoint(match);
  // Freeze all coordinates before changing role so no other player moves.
  const coordinates=match.slots.map((s,i)=>slotCoordinates(match,i));
  match.slots.forEach((s,i)=>Object.assign(s,coordinates[i]));
  const previous=slot.pos;slot.pos=pos;
  recordEvent(match,{at:match.elapsed,type:'role',inId:slot.id,pos,previous});return true;
}
export function resetLayout(match) {
  if(match.finished)return false;checkpoint(match);
  match.slots.forEach(slot=>{delete slot.x;delete slot.y;});return true;
}
export function configureSlot(match,index,{id,pos,x,y}) {
  if(match.finished||!match.slots[index]||!['MV','P','KH','H'].includes(pos))return false;
  const draft=JSON.parse(JSON.stringify(match)),oldPos=draft.slots[index].pos;
  draft.slots.forEach((slot,i)=>Object.assign(slot,slotCoordinates(match,i)));
  draft.slots[index].pos=pos;
  if(id!==draft.slots[index].id&&!assignPosition(draft,index,id))return false;
  if(id&&!canPlay(draft,id,index))return false;
  const coords=slotCoordinates(draft,index);
  if((x!==coords.x||y!==coords.y)&&!moveSlot(draft,index,x,y))return false;
  if(oldPos!==pos)recordEvent(draft,{at:match.elapsed,type:'role',inId:id,pos,previous:oldPos});
  checkpoint(match);const undo=match.undo;
  Object.assign(match,draft,{undo});return true;
}
export function suggestion(match, players) { return suggestions(match, players)[0] || null; }
function checkpoint(match) {
  match.undo = JSON.parse(JSON.stringify({ at: match.elapsed, slots: match.slots, stats: match.stats, nextSub: match.nextSub, events: match.events.length, roster: match.roster, unavailable: match.unavailable || [] }));
}
function recordEvent(match, event) {
  if(match.elapsed>0 || match.running) match.events.push(event);
}
export function substituteMany(match, changes) {
  if (match.finished || !Array.isArray(changes) || !changes.length) return false;
  const outs = changes.map(c => c.outId), ins = changes.map(c => c.inId);
  if (new Set(outs).size !== outs.length || new Set(ins).size !== ins.length) return false;
  if (changes.some(c => !c.outId || !match.slots.some(s => s.id === c.outId) || !match.roster.includes(c.inId) || match.slots.some(s => s.id === c.inId) || (match.unavailable || []).includes(c.inId) || !canPlay(match,c.inId,match.slots.findIndex(s=>s.id===c.outId)))) return false;
  checkpoint(match);
  for (const {outId, inId} of changes) {
    const slot = match.slots.find(s => s.id === outId);
    slot.id = inId;
    recordEvent(match,{ at: match.elapsed, type: 'sub', outId, inId, pos: slot.pos });
  }
  // An early or additional change must not postpone the scheduled rotation.
  if (match.elapsed >= match.nextSub) match.nextSub = match.elapsed + match.interval * 60;
  return true;
}
export function substitute(match, outId, inId) { return substituteMany(match, [{outId, inId}]); }
export function assignPosition(match, index, id) {
  const slot = match.slots[index];
  if (match.finished || !slot || slot.id === id || !match.roster.includes(id) || (match.unavailable || []).includes(id)) return false;
  const other = match.slots.find(s => s.id === id);
  if(!canPlay(match,id,index)||(other&&slot.id&&!canPlay(match,slot.id,match.slots.indexOf(other))))return false;
  if (!other && slot.id) return substitute(match, slot.id, id);
  checkpoint(match);
  const old = slot.id;
  if (other) other.id = old;
  slot.id = id;
  recordEvent(match,{ at: match.elapsed, type: other ? 'position' : 'fill', inId: id, outId: old, pos: slot.pos, otherPos: other?.pos });
  return true;
}
export function setAvailability(match, id, available) {
  if (match.finished || !match.roster.includes(id)) return false;
  const unavailable = match.unavailable || [];
  if (available === !unavailable.includes(id)) return false;
  checkpoint(match);
  match.unavailable = available ? unavailable.filter(p => p !== id) : [...unavailable, id];
  const slot = match.slots.find(s => s.id === id);
  if (!available && slot) slot.id = null;
  recordEvent(match,{ at: match.elapsed, type: available ? 'available' : 'unavailable', inId: id, pos: slot?.pos });
  return true;
}
export function addParticipant(match, id) {
  if (match.finished || match.roster.includes(id)) return false;
  checkpoint(match);
  match.roster.push(id);
  recordEvent(match,{ at: match.elapsed, type: 'joined', inId: id });
  return true;
}
export function undoChange(match) {
  if (!match.undo || match.finished) return false;
  const saved = match.undo;
  match.slots = saved.slots;
  match.stats = saved.stats;
  match.roster = saved.roster;
  match.unavailable = saved.unavailable;
  match.nextSub = saved.nextSub;
  match.events.length = saved.events;
  // Reassign all play since the mistaken action to the original lineup.
  accrue(match, Math.max(0, match.elapsed - saved.at));
  match.undo = null;
  return true;
}
export const time = seconds => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
