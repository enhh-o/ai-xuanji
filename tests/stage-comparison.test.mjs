import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {analyzeLocal}=loadTs('app/analysis/index.ts');
const pillars=['壬午','己酉','戊子','壬子'];
const fortunes=['戊申','丁未','丙午','乙巳','甲辰','癸卯','壬寅','辛丑'].map((pillar,i)=>({pillar,startsAt:(2005+10*i)+'-01-01 00:00:00',endsAt:(2015+10*i)+'-01-01 00:00:00'}));
const input={pillars,gender:'女',birthDate:'2002-09-01',asOf:'2026-09-12',horizon:10,fortunes};
test('十年筛选不截断跨大运比较，全部七次交接都有前后依据',()=>{
 const a=analyzeLocal(input),b=analyzeLocal({...input,horizon:120});
 assert.equal(a.transitions.length,7);
 assert.deepEqual(a.transitions,b.transitions);
 assert.equal(a.transitions[0].from,'戊申');
 assert.equal(a.transitions.at(-1).to,'辛丑');
 assert.ok(a.transitions.every(t=>t.evidence.length&&t.before&&t.after));
 assert.ok(a.transitions.some(t=>t.changed));
});
test('同一作用重复出现不因换运日期就自动制造转折',()=>{
 const r=analyzeLocal({...input,fortunes:fortunes.slice(0,2).map(f=>({...f,pillar:'丙午'}))});
 assert.equal(r.transitions[0].changed,false);
 assert.match(r.transitions[0].summary,/未识别/);
});
test('阶段方向与冲动可以独立变化，不用年度命中数排序',()=>{
 const r=analyzeLocal(input);
 const t=r.transitions.find(t=>t.from==='丁未'&&t.to==='丙午');
 assert.ok(t.evidence.some(e=>e.includes('取用')||e.includes('原局')));
 assert.ok(r.transitions.every(t=>!('score' in t)));
});
