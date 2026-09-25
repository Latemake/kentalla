import test from 'node:test';
import assert from 'node:assert/strict';
import {formations,initialLineup,slotCoordinates,moveSlot,resetLayout,setSlotRole,configureSlot,advance,undoChange,canPlay,assignPosition,substitute,suggestions,substituteMany} from './engine.js';
const fixture=()=>({mode:5,duration:60,elapsed:0,running:true,interval:5,nextSub:300,roster:['g','p1','p2','mid','h','bench1','bench2'],slots:formations[5].map((pos,i)=>({pos,id:['g','p1','p2','mid','h'][i]})),stats:{},events:[],unavailable:[],rotationRules:{},fair:true});
test('dragging the formation preserves roles, minutes and player identity',()=>{
 const m=fixture();advance(m,100);const positions=m.slots.map(s=>s.pos);
 assert.equal(moveSlot(m,1,20,40),true);advance(m,50);
 assert.deepEqual(m.slots.map(s=>s.pos),positions);assert.equal(m.slots[1].id,'p1');assert.equal(m.stats.p1.positions.P,150);
 const restored=JSON.parse(JSON.stringify(m));assert.deepEqual(slotCoordinates(restored,1),{x:20,y:40});
 undoChange(restored);assert.equal(restored.slots[1].x,undefined);assert.equal(restored.stats.p1.total,150);
});
test('cancelled/invalid drop has no effect and layout reset keeps the lineup',()=>{
 const m=fixture(),before=JSON.stringify(m),occupied=slotCoordinates(m,2);
 assert.equal(moveSlot(m,1,occupied.x,occupied.y),false);assert.equal(moveSlot(m,1,NaN,12),false);assert.equal(JSON.stringify(m),before);
 moveSlot(m,1,20,40);resetLayout(m);assert.equal(m.slots[1].x,undefined);assert.equal(m.slots[1].id,'p1');
});
test('changing role only affects future minutes and freezes the other coordinates',()=>{
 const m=fixture();advance(m,100);const points=m.slots.map((s,i)=>slotCoordinates(m,i));
 setSlotRole(m,1,'H');advance(m,50);
 assert.equal(m.stats.p1.positions.P,100);assert.equal(m.stats.p1.positions.H,50);assert.deepEqual(m.slots.map((s,i)=>slotCoordinates(m,i)),points);
 undoChange(m);assert.equal(m.stats.p1.positions.P,150);assert.equal(m.stats.p1.positions.H,undefined);
});
test('manual substitutions and swaps enforce exact-place rotation on both players',()=>{
 const m=fixture();m.rotationRules={bench1:{roles:['P'],slots:[1]},p1:{roles:['P'],slots:[1]}};
 assert.equal(canPlay(m,'bench1',1),true);assert.equal(canPlay(m,'bench1',2),false);
 assert.equal(substitute(m,'p2','bench1'),false);assert.equal(assignPosition(m,2,'p1'),false);
 assert.equal(substitute(m,'p1','bench1'),true);assert.equal(m.slots[1].id,'bench1');
});
test('a flexible player does not consume a specialists only substitution slot',()=>{
 const m=fixture();m.rotationRules={bench1:{roles:['P','H']},bench2:{roles:['P'],slots:[1]}};
 m.stats={p1:{total:400},h:{total:300},p2:{total:200},mid:{total:100}};
 const result=suggestions(m,m.roster.map(id=>({id,weight:1})));
 assert.equal(result.length,2);assert.ok(result.some(s=>s.inId==='bench2'&&s.outId==='p1'));
 assert.ok(result.some(s=>s.inId==='bench1'&&s.outId==='h'));assert.equal(substituteMany(m,result),true);
});
test('initial lineup honors role restrictions and leaves unmatched positions empty',()=>{
 const rules={a:{roles:['P']},b:{roles:['MV']},c:{roles:['H']},d:{roles:['P']},e:{roles:['KH']}};
 const slots=initialLineup(5,['a','b','c','d','e'],rules);
 assert.equal(slots[0].id,'b');assert.equal(slots[3].id,'e');assert.equal(slots[4].id,'c');
 assert.equal(initialLineup(5,['a'],rules).filter(s=>s.id).length,1);
});
test('editing player, role and geometry together is atomic on invalid constraints',()=>{
 const m=fixture();m.rotationRules.bench1={roles:['H']};const before=JSON.stringify(m);
 assert.equal(configureSlot(m,1,{id:'bench1',pos:'P',x:20,y:40}),false);assert.equal(JSON.stringify(m),before);
 assert.equal(configureSlot(m,1,{id:'bench1',pos:'H',x:20,y:40}),true);advance(m,30);undoChange(m);
 assert.equal(m.slots[1].id,'p1');assert.equal(m.slots[1].pos,'P');assert.equal(m.stats.p1.total,30);
});
test('full match cycles locked players through their own places and bench',()=>{
 const m=fixture();m.rotationRules={p1:{roles:['P'],slots:[1]},bench1:{roles:['P'],slots:[1]},h:{roles:['H'],slots:[4]},bench2:{roles:['H'],slots:[4]}};
 const players=m.roster.map(id=>({id,weight:1}));
 while(m.running){advance(m,300);if(m.running)substituteMany(m,suggestions(m,players));m.slots.forEach((s,i)=>assert.ok(canPlay(m,s.id,i)));}
 assert.equal(m.stats.p1.total,1800);assert.equal(m.stats.bench1.total,1800);assert.equal(m.stats.bench2.positions.H,1800);
});
