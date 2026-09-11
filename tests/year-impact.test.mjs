import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const input={pillars:['壬午','己酉','戊子','壬子'],gender:'女',birthDate:'2002-09-01',asOf:'2026-09-12',horizon:10,fortunes:[{pillar:'丙午',startsAt:'2025-01-01 00:00:00',endsAt:'2035-01-01 00:00:00'}]};
test('受冲仍保留根气与生扶，强度不伪装成概率',()=>{
 const {analyzeLocal}=loadTs('app/analysis/index.ts');const r=analyzeLocal(input);
 const power=r.fortunes[0].influences[0];
 assert.ok(power.roots.length);assert.equal(power.level,'作用受扰');
 assert.match(power.evidence.join('；'),/受冲/);
 assert.doesNotMatch(JSON.stringify(power),/%|概率/);
});
test('每个标记窗口有关系驱动的情境、反证和实际观察项',()=>{
 const {analyzeLocal}=loadTs('app/analysis/index.ts');const r=analyzeLocal(input);
 const ws=r.timing.flatMap(t=>t.windows);assert.ok(ws.length);
 for(const w of ws){assert.ok(w.impact.scenarios.length);assert.ok(w.impact.observe);assert.ok(w.impact.basis.length);assert.ok(w.impact.caveat);}
 const a=ws.find(w=>w.year===2026),b=ws.find(w=>w.year===2032);assert.ok(a&&b);
 assert.notEqual(a.impact.scenarios.join(''),b.impact.scenarios.join(''));
 assert.doesNotMatch(JSON.stringify(ws.map(w=>w.impact)),/必然|注定|发生概率|必定/);
});
