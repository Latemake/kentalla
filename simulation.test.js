import test from 'node:test';
import assert from 'node:assert/strict';
import { formations, advance, suggestions, substituteMany, substitute, resumeMatch, undoChange, setAvailability, assignPosition, addParticipant } from './engine.js';

function setup(mode=7,bench=5,periods=2) {
  const players=Array.from({length:mode+bench},(_,i)=>({id:String(i),weight:1}));
  return {players,m:{mode,duration:60,periods,period:1,elapsed:0,running:true,finished:false,interval:5,nextSub:300,roster:players.map(p=>p.id),slots:formations[mode].map((pos,i)=>({pos,id:String(i)})),stats:{},events:[],fair:true,rotateKeeper:false,unavailable:[]}};
}
function consistent(m) {
  const field=m.slots.map(s=>s.id).filter(Boolean);
  assert.equal(new Set(field).size,field.length,'no player may occupy two positions');
  assert.ok(field.every(id=>m.roster.includes(id)&&!m.unavailable.includes(id)));
  for(const s of Object.values(m.stats)){
    assert.ok(s.total>=0&&s.total<=m.elapsed+1e-7,'player time is within match duration');
    assert.ok(Math.abs(s.total-Object.values(s.positions).reduce((sum,v)=>sum+v,0))<1e-7,'position times equal total');
  }
}
const summary=[];
for(const mode of [5,7,8,11])for(const bench of [0,1,2,3,5,10])for(const periods of [1,2,3,4])for(const rotateKeeper of [false,true]){
  test(`full match ${mode}v${mode}, ${bench} substitutes, ${periods} periods, keeper rotation ${rotateKeeper}`,()=>{
    const {m,players}=setup(mode,bench,periods);m.rotateKeeper=rotateKeeper;
    let ticks=0;
    while(m.elapsed<3600){
      assert.ok(++ticks<100,'simulation must finish');
      if(m.intermission){const before=JSON.stringify(m.stats);advance(m,900);assert.equal(JSON.stringify(m.stats),before,'breaks add no minutes');resumeMatch(m);}
      if(m.elapsed>=m.nextSub){const group=suggestions(m,players);if(group.length)assert.equal(substituteMany(m,group),true);else m.nextSub=m.elapsed+300;}
      advance(m,Math.min(300,3600-m.elapsed));consistent(m);
    }
    assert.equal(m.running,false);
    assert.equal(Object.values(m.stats).reduce((sum,s)=>sum+s.total,0),mode*3600,'every occupied field second accounted for');
    if(!rotateKeeper)assert.equal(m.stats['0'].positions.MV,3600);
    const ids=rotateKeeper?m.roster:m.roster.slice(1);
    const minutes=ids.map(id=>(m.stats[id]?.total||0)/60);
    assert.ok(Math.max(...minutes)-Math.min(...minutes)<=5,'fair time spread stays within one rotation interval');
    if(bench===5&&periods===2&&!rotateKeeper)summary.push({mode,min:Math.min(...minutes),max:Math.max(...minutes)});
  });
}
test('group validation is atomic and rejected changes do not alter the match',()=>{
  const {m}=setup();advance(m,300);const before=JSON.stringify(m);
  for(const changes of [[{outId:'1',inId:'7'},{outId:'2',inId:'7'}],[{outId:'1',inId:'7'},{outId:'1',inId:'8'}],[{outId:'1',inId:'7'},{outId:'2',inId:'0'}]]){
    assert.equal(substituteMany(m,changes),false);assert.equal(JSON.stringify(m),before);
  }
});
test('undo after elapsed time and reload restores all group minutes and positions',()=>{
  const {m,players}=setup();advance(m,300);const before=structuredClone(m);
  assert.equal(substituteMany(m,suggestions(m,players)),true);advance(m,37);
  const restored=JSON.parse(JSON.stringify(m));assert.equal(undoChange(restored),true);
  advance(before,37);
  assert.deepEqual(restored.stats,before.stats);assert.deepEqual(restored.slots,before.slots);
  assert.equal(restored.events.length,0);assert.equal(restored.nextSub,300);consistent(restored);
});
test('early and additional swaps do not keep postponing the rotation',()=>{
  const {m}=setup();advance(m,90);substitute(m,'1','7');assert.equal(m.nextSub,300);
  advance(m,210);substitute(m,'2','8');assert.equal(m.nextSub,600);
  advance(m,12);substitute(m,'3','9');assert.equal(m.nextSub,600);
});
test('injury, an empty position, replacement, return and late arrival preserve minutes',()=>{
  const {m,players}=setup();advance(m,120);
  assert.equal(setAvailability(m,'1',false),true);advance(m,30);
  assert.equal(m.stats['1'].total,120);
  assert.ok(!suggestions(m,players).some(s=>s.inId==='1'||s.outId==='1'));
  assert.equal(assignPosition(m,1,'7'),true);advance(m,60);assert.equal(m.stats['7'].total,60);
  assert.equal(setAvailability(m,'1',true),true);
  assert.equal(addParticipant(m,'late'),true);players.push({id:'late',weight:1});
  assert.equal(substitute(m,'7','late'),true);advance(m,20);assert.equal(m.stats.late.total,20);consistent(m);
});
test('undo of injury restores the missing players minutes retroactively',()=>{
  const {m}=setup();advance(m,120);setAvailability(m,'2',false);advance(m,20);undoChange(m);
  assert.equal(m.stats['2'].total,140);assert.equal(m.slots[2].id,'2');assert.deepEqual(m.unavailable,[]);consistent(m);
});
test('position change and undo correctly allocate time',()=>{
  const {m}=setup();advance(m,60);assignPosition(m,1,'5');advance(m,25);
  assert.equal(m.stats['5'].positions.P,25);undoChange(m);
  assert.equal(m.stats['5'].positions.P,undefined);assert.equal(m.stats['5'].positions.H,85);consistent(m);
});
test('background delay stops at halftime and waits for explicit resume',()=>{
  const {m}=setup();advance(m,4000);assert.equal(m.elapsed,1800);assert.equal(m.intermission,true);
  advance(m,600);assert.equal(m.elapsed,1800);resumeMatch(m);advance(m,4000);
  assert.equal(m.elapsed,3600);assert.equal(m.intermission,false);assert.equal(resumeMatch(m),false);
});
test('pause, invalid deltas and finished-match changes cannot corrupt accounting',()=>{
  const {m}=setup();advance(m,20);m.running=false;const before=JSON.stringify(m.stats);advance(m,100);assert.equal(JSON.stringify(m.stats),before);
  m.running=true;for(const delta of [-2,NaN,Infinity,0])assert.equal(advance(m,delta),0);
  m.finished=true;assert.equal(substitute(m,'1','7'),false);assert.equal(assignPosition(m,1,'7'),false);assert.equal(advance(m,10),0);
});
test('weighted group rotation gives a double-weight player approximately double minutes',()=>{
  const {m,players}=setup(5,4,1);m.fair=false;players[1].weight=2;
  while(m.running){advance(m,300);if(m.running)substituteMany(m,suggestions(m,players));consistent(m);}
  assert.ok(m.stats['1'].total>=3000);
  const others=players.slice(2).map(p=>m.stats[p.id].total);
  assert.ok(others.every(seconds=>seconds>=1500&&seconds<=1800));
});
test('weights above field capacity never target more than a full match',()=>{
  const {m,players}=setup(5,1,1);m.fair=false;players[1].weight=10;
  while(m.running){advance(m,300);if(m.running)substituteMany(m,suggestions(m,players));consistent(m);}
  assert.equal(m.stats['1'].total,3600);
});
test('pre-match lineup edits do not appear as in-game substitutions',()=>{
  const {m}=setup();m.running=false;
  substitute(m,'1','7');assignPosition(m,2,'5');
  assert.equal(m.events.length,0);assert.ok(m.undo);assert.equal(undoChange(m),true);
});
test('simulation result summary',()=>console.log('60-minute matches with five substitutes and fixed keeper:',JSON.stringify(summary)));
