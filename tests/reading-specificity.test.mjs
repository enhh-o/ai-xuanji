import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPageModel } from './helpers/page-model.mjs';
const m=loadPageModel();
const chart={palaces:[]};
// 组合单元测试盘，不作为真实用户命例或预测准确率样本。
const read=(pillars,gender='女')=>m.buildLifeReadings(m.buildAnalysis(pillars),chart,gender);

test('财星透藏与食伤生财、同辈分财不能给出同一财富总判',()=>{
  const revenue=read(['丙寅','戊戌','甲寅','壬子'])[1];
  const sharing=read(['甲寅','己巳','甲辰','乙卯'])[1];
  assert.notEqual(revenue.headline,sharing.headline);
  assert.match(revenue.verdict,/产出|技能|生财/);
  assert.match(sharing.verdict,/分配|分财|竞争/);
  assert.notEqual(revenue.advice,sharing.advice);
});
test('官印同透有根与伤官官星同透有根的事业判断区分',()=>{
  const supported=read(['辛酉','癸子','甲寅','戊辰'])[0];
  const friction=read(['辛酉','丁午','甲寅','戊辰'])[0];
  assert.notEqual(supported.headline,friction.headline);
  assert.match(supported.verdict,/支持|资历|学习/);
  assert.match(friction.verdict,/标准|规则|分歧/);
});
test('只有暗藏伴侣星不能用透干同根的感情总结',()=>{
  const visible=read(['辛酉','癸亥','甲寅','戊辰'])[2];
  const hidden=read(['丙寅','戊戌','甲寅','壬子'])[2];
  assert.notEqual(visible.headline,hidden.headline);
  assert.match(hidden.verdict,/暗藏|未透/);
  assert.doesNotMatch(hidden.verdict,/注定|一生无婚/);
});
test('同一命盘不同运按新增作用区分，并有具体依据而非默认稳进',()=>{
  const e=m.calculateBazi('2002-09-01','12:00','女');
  const p=['壬午','己酉','戊子','壬子'];
  const synthetic={...e,pillars:p,fortunes:e.fortunes.slice(0,4).map((f,i)=>({...f,pillar:['丙午','壬申','庚午','丁巳'][i]}))};
  const fs=m.buildLuck(p,'女',m.buildAnalysis(p),chart,synthetic).fortunes;
  assert.equal(fs[0].mode,'支持增加');
  // 新规则纳入藏干：壬申中有壬财，也有戊比肩支持，不能只凭壬水判单向制耗。
  assert.equal(fs[1].mode,'作用交织');
  assert.match(fs[1].modeReason,/申藏戊.*比肩/);
  // 庚金泄土与午火生土并列，子午冲作为另一个维度。
  assert.equal(fs[2].mode,'作用交织');
  assert.equal(fs[2].movement,'有冲动关系');
  // 丁巳提供火土支持，巳中庚金泄身不能漏掉。
  assert.equal(fs[3].mode,'作用交织');
  for(const f of fs){
    assert.ok(f.modeReason.length>15);
    assert.ok(f.turnReasons.includes(f.modeReason));
  }
});
test('透干根被冲不能作为畅通组合直接给有利结论',()=>{
  const r=read(['辛酉','癸子','甲寅','丁午'])[0];
  assert.match(r.verdict,/受冲|受扰|不稳/);
  assert.doesNotMatch(r.headline,/支持路径较清楚/);
});
