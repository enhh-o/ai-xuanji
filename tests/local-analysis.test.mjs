import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTs} from './helpers/load-ts.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const path='app/analysis/index.ts';
const a=fs.existsSync(path)?loadTs(path):null;
const requireEngine=()=>assert.ok(a,'本地规则模块尚未实现');
const input=(pillars)=>({pillars,gender:'女',birthDate:'2002-01-01',fortunes:[],asOf:'2026-09-07',horizon:10});
test('本地完整报告有六维裁决与四领域，生成不调用网络',()=>{
  requireEngine();const saved=globalThis.fetch;globalThis.fetch=()=>{throw Error('禁止网络');};
  try{const r=a.analyzeLocal(input(['辛酉','壬子','甲寅','戊辰']));assert.equal(r.domains.length,4);assert.equal(r.useful.dimensions.length,6);assert.ok(r.pattern.base);assert.ok(r.version);assert.ok(r.facts.nodes.every(n=>n.id));}finally{globalThis.fetch=saved;}
});
test('同五行支持不冒充同干根，受冲仍保留根而非删除',()=>{
  requireEngine();const r=a.analyzeLocal(input(['甲申','丙寅','甲申','庚午']));
  const root=r.facts.profiles.find(p=>p.stem==='甲');assert.ok(root.roots.some(x=>x.branch==='寅'&&x.disturbed));
  assert.equal(r.facts.profiles.find(p=>p.stem==='乙').roots.length,0);
});
test('120项调候完整且保留注释和待核对状态',()=>{
  requireEngine();assert.equal(Object.keys(a.climateTable).length,120);
  assert.deepEqual(a.climateTable['丙子'].stems,['壬','戊','己']);
  assert.ok(a.climateTable['戊午'].note.includes('癸'));
  const r=a.analyzeLocal(input(['甲子','丙子','丙寅','戊辰']));assert.equal(r.climate.verified,false);assert.equal(r.climate.entries[0].stem,'壬');
});
test('仅同见不称已经成格，印为忌不称佩印',()=>{
  requireEngine();const r=a.analyzeLocal(input(['壬子','癸卯','甲寅','丙午']));
  assert.ok(!r.pattern.mechanisms.some(x=>x.id==='peiyin'&&x.status==='supported'));
  assert.ok(r.pattern.mechanisms.every(x=>x.evidence.length||x.status==='absent'));
});
test('同输入可重复，姓名或聊天记录不改原局裁决',()=>{
  requireEngine();const i=input(['壬午','己酉','戊子','壬子']);
  assert.deepEqual(a.analyzeLocal(i),a.analyzeLocal({...i,name:'另一位',messages:['我很有钱']}));
});

test('有受冲同类根和比劫透干时，不因根不稳就把普通盘锁成从格待辨',()=>{
  const r=a.analyzeLocal(input(['壬午','己酉','戊子','壬子']));
  assert.equal(r.useful.routeCompetition,false);
  assert.ok(r.useful.favorable.length>0);
});

test('岁运复核保留原月令，关系只列新增，并确实比较制化状态',()=>{
  const i={...input(['辛酉','壬子','甲寅','戊辰']),fortunes:[{pillar:'丁卯',startsAt:'2020-01-01 00:00:00',endsAt:'2030-01-01 00:00:00'}]};
  const r=a.analyzeLocal(i);
  assert.ok(r.fortunes[0].interactions.every(x=>x.positions.some(i=>i>=4)));
  assert.equal(r.facts.pillars[1],'壬子');
  assert.ok(Array.isArray(r.fortunes[0].changes));
});

test('月令本气透出优先，其他透藏记兼格，不把阴干帝旺当阳刃',()=>{
  const r=a.analyzeLocal(input(['壬子','戊辰','甲寅','乙亥']));
  assert.equal(r.pattern.base,'偏财格');assert.ok(r.pattern.secondary.includes('劫财'));
  assert.notEqual(a.analyzeLocal(input(['壬子','己巳','乙卯','丁亥'])).pattern.base,'羊刃格');
});

test('食神制杀有透根才支持，偏印有力时降为候选',()=>{
  const clear=a.analyzeLocal(input(['庚申','癸亥','戊辰','甲子']));
  // 条件单测：明确提供“偏印已有稳定作用”的反例，不伪造非法干支柱。
  const facts=structuredClone(clear.facts);
  const resource=facts.profiles.find(x=>x.god==='偏印');
  resource.exposed=[{...facts.nodes[0],stem:resource.stem,god:resource.god}];resource.stable=true;
  const blocked={pattern:loadTs('app/analysis/patterns.ts').assessPatterns(facts,clear.natal)};
  assert.equal(clear.pattern.mechanisms.find(x=>x.id==='shizhi').status,'supported');
  assert.equal(blocked.pattern.mechanisms.find(x=>x.id==='shizhi').status,'candidate');
  assert.ok(blocked.pattern.mechanisms.find(x=>x.id==='shizhi').against.some(x=>x.includes('偏印')));
});

test('弱而有制杀自救的盘不直接判从，合的事实不改变日主五行',()=>{
  const r=a.analyzeLocal(input(['庚申','癸亥','戊子','甲子']));
  assert.equal(r.special.find(x=>x.id==='from')?.status,'rejected');
  const h=a.analyzeLocal(input(['甲子','己巳','甲寅','丙午']));
  assert.equal(h.facts.day,'甲');assert.ok(h.special.some(x=>x.id==='huaqi'));
});

test('领域结论和建议随实际透藏、制化改变，不靠姓名换文案',()=>{
  const one=a.analyzeLocal(input(['庚申','癸亥','戊辰','甲子']));
  const two=a.analyzeLocal(input(['甲寅','己巳','甲辰','乙卯']));
  for(const key of ['career','wealth','relationship']){
    assert.notEqual(one.domains.find(d=>d.key===key).headline,two.domains.find(d=>d.key===key).headline);
  }
  assert.notEqual(one.domains[2].advice,two.domains[2].advice);
});
test('岁运按真实交运时刻分段，十八岁之前不标成人窗口',()=>{
  requireEngine();const i={...input(['壬午','己酉','戊子','壬子']),birthDate:'2012-06-12',asOf:'2029-01-01',horizon:3,fortunes:[{pillar:'丙午',startsAt:'2020-08-01 12:00:00',endsAt:'2030-08-01 12:00:00'},{pillar:'丁未',startsAt:'2030-08-01 12:00:00',endsAt:'2040-08-01 12:00:00'}]};
  const r=a.analyzeLocal(i),segments=r.timing.filter(s=>s.year===2030);
  assert.equal(segments.length,2);assert.equal(segments[0].endsAt,segments[1].startsAt);
  assert.ok(r.timing.flatMap(s=>s.windows).filter(w=>w.kind!=='overall').every(w=>w.startsAt>='2030-06-12'));
});

test('生日当年的真实感情候选窗口从十八岁生日截起，不做空集合断言',()=>{
  const r=a.analyzeLocal({...input(['庚申','癸亥','甲寅','辛酉']),birthDate:'2013-06-12',asOf:'2031-01-01',horizon:2,fortunes:[{pillar:'戊申',startsAt:'2028-01-01 00:00:00',endsAt:'2038-01-01 00:00:00'}]});
  const windows=r.timing.filter(s=>s.year===2031).flatMap(s=>s.windows).filter(w=>w.kind==='relationship');
  assert.ok(windows.length>0);
  assert.equal(windows[0].startsAt,'2031-06-12 00:00:00');
  assert.match(windows[0].reason,/原局日柱甲寅.*大运戊申.*辛亥/);
});

test('本地复核可以离线渲染，取用待辨和紫微缺失不会报错或显示模型等待',()=>{
  const {LocalReview}=loadTs('app/local-review.tsx');
  const report=a.analyzeLocal(input(['壬子','癸亥','丁酉','辛丑']));
  const saved=globalThis.fetch;globalThis.fetch=()=>{throw Error('不应调用模型');};
  try{const html=renderToStaticMarkup(React.createElement(LocalReview,{report}));
    assert.match(html,/本地规则解读，不调用 AI/);
    assert.match(html,/六个角度核对取用/);
    assert.doesNotMatch(html,/发送给.*模型|正在分析|undefined|NaN/);
    assert.ok(report.useful.favorable.length===0);
  }finally{globalThis.fetch=saved;}
});

test('主页面消费同一份报告，全盘复核不再绑定聊天状态',()=>{
  const source=fs.readFileSync('app/page.tsx','utf8');
  assert.match(source,/localReport\.domains\.slice\(1\)/);
  assert.match(source,/favorable:localReport\.useful\.favorable/);
  assert.match(source,/fortuneHorizon, localReport/);
  assert.doesNotMatch(source,/setFullReview|开始全盘复核/);
  assert.match(source,/fetch\("\/api\/chat"/);
});

test('单一五合不自动抹去生克作用，财官印有通路时不机械判财坏印',()=>{
  const r=a.analyzeLocal(input(['庚申','甲辰','丁亥','壬子']));
  assert.ok(r.facts.relations.some(x=>x.name.includes('丁壬')));
  assert.equal(r.facts.profiles.find(p=>p.stem==='壬').tied,false);
  assert.equal(r.pattern.mechanisms.find(x=>x.id==='caiguanyin')?.status,'supported');
  assert.notEqual(r.pattern.diseases.find(x=>x.id==='caiyin').status,'supported');
  assert.equal(r.useful.routeCompetition,false);
});
