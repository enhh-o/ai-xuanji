import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {analyzeLocal}=loadTs('app/analysis/index.ts');
test('用户四柱丙午运保留火土支持并单列子午冲',()=>{
 const r=analyzeLocal({pillars:['壬午','己酉','戊子','壬子'],gender:'女',birthDate:'2002-09-01',asOf:'2026-09-12',horizon:1,fortunes:[{pillar:'丙午',startsAt:'2025-01-01',endsAt:'2035-01-01'}]});
 assert.deepEqual(new Set(r.useful.favorable),new Set(['火','土']));
 assert.equal(r.fortunes[0].mode,'支持增加');
 assert.equal(r.fortunes[0].movement,'有冲动关系');
 assert.equal(r.fortunes[0].modeTone,'progress');
 assert.match(r.fortunes[0].reason,/子午冲|午子冲/);
 assert.match(r.fortunes[0].reason,/不能据此抵消/);
 assert.match(r.fortunes[0].reason,/年柱壬克大运丙/);
 assert.match(r.fortunes[0].reason,/时柱壬克大运丙/);
});

test('壬水透出可得子中癸水同类根气，但不冒充同干根',()=>{
 const {buildFacts}=loadTs('app/analysis/facts.ts');
 const r=buildFacts({pillars:['壬子','己酉','戊辰','壬子']});
 const ren=r.profiles.find(p=>p.stem==='壬');
 assert.equal(ren.roots.length,0);
 assert.ok(ren.sameElementRoots.length>0);
 assert.equal(ren.stable,true);
});
