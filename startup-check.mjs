import assert from 'node:assert/strict';
import { seedTestTeam } from './browser-fixture.mjs';
const pages = await (await fetch('http://localhost:9222/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let serial = 0;
const pending = new Map();
const messages = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { pending.get(message.id)(message.result); pending.delete(message.id); }
  if (message.method === 'Log.entryAdded') messages.push(message.params.entry.text);
  if (message.method === 'Runtime.exceptionThrown') messages.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++serial; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value;
await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
const url = process.argv[2] || 'file:///C:/Users/nimbl/Downloads/football/index.html';
await send('Page.navigate', { url });
await new Promise(resolve => setTimeout(resolve, 1200));
const before = await evaluate('({players: document.querySelectorAll(".pitch-player").length, secure: isSecureContext, uuid: typeof crypto.randomUUID})');
console.log(JSON.stringify({url, ...before, messages}, null, 2));
if (process.argv.includes('--assert')) {
  await seedTestTeam(evaluate);
  assert.ok(await evaluate('document.querySelectorAll(".pitch-player").length') >= 5, 'The match must render');
  for (const [selector, result] of [
    ['[data-tab="pelaajat"]', 'document.querySelectorAll("[data-action=edit-player]").length > 0'],
    ['[data-tab="ottelu"]', 'document.querySelectorAll(".pitch-player").length > 0'],
    ['[data-action="new"]', 'document.querySelector("#dialog").open'],
    ['[data-action="close"]', '!document.querySelector("#dialog").open'],
    ['[data-action="toggle"]', 'document.querySelector("#clock-state").textContent.includes("KÄYNNISSÄ")'],
    ['[data-action="toggle"]', '!document.querySelector("#clock-state").textContent.includes("KÄYNNISSÄ")'],
  ]) {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    assert.equal(await evaluate(result), true, selector);
  }
  console.log('Actual pointer clicks passed: navigation, new match dialog, close, start, pause.');
}
ws.close();
