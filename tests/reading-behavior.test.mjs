import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPageModel } from './helpers/page-model.mjs';
const m = loadPageModel();

test('旺衰正文不会否定同一结果中的标题', () => {
  const e = m.calculateBazi('1987-08-01', '12:00', '女');
  const a = m.buildAnalysis(e.pillars, e);
  assert.ok(a.strengthReason.includes(`暂定为${a.strength}`));
  assert.ok(!a.strengthReason.includes(`不直接定为“${a.strength}”`));
});

test('根气受冲不能仍作为无条件稳固支持', () => {
  const a = m.buildAnalysis(['甲申', '丙寅', '甲申', '庚午']);
  assert.ok(a.evidence.some(x => /寅/.test(x) && /冲|受扰/.test(x)));
  assert.ok(a.usefulReason?.includes('候选'));
});

test('紫微引擎不可用时不返回示例星曜', () => {
  const c = m.getAstrolabe('2002-01-01','12:00','女');
  assert.equal(c.palaces.length, 0);
  assert.equal(c.soul, undefined);
});

test('未起运时不把第一步大运当成当前大运', () => {
  const e = m.calculateBazi('2026-09-01','12:00','女');
  const a = m.buildAnalysis(e.pillars,e);
  const luck = m.buildLuck(e.pillars,'女',a,{palaces:[]},e,new Date('2026-09-02T00:00:00Z'));
  assert.equal(luck.currentFortune, null);
});

test('未成年不展示成人事业或感情年份', () => {
  const e = m.calculateBazi('2012-06-12','12:00','女');
  const luck = m.buildLuck(e.pillars,'女',m.buildAnalysis(e.pillars,e),{palaces:[]},e);
  for (const f of luck.fortunes) for (const kind of ['career','relationship']) {
    if (f.annualSignals[kind].ready) assert.ok(f.annualSignals[kind].year >= 2031);
  }
});

test('本命四化不能被写作大限四化', () => {
  const e = m.calculateBazi('2002-09-01','12:00','女');
  const c = {palaces:[{name:'夫妻', majorStars:[{name:'武曲',mutagen:'忌'}],minorStars:[],decadal:{range:[1,120]}}]};
  const luck = m.buildLuck(e.pillars,'女',m.buildAnalysis(e.pillars,e),c,e);
  assert.ok(luck.fortunes.every(f => !f.turnReasons.some(r => r.includes('大限见武曲化忌'))));
});

test('三方与对宫不直接被标为吉凶', () => {
  const palaces = Array.from({length:12},(_,i)=>({name:i===0?'命宫':`宫${i}`,earthlyBranch:'子丑寅卯辰巳午未申酉戌亥'[i],majorStars:[],minorStars:[]}));
  const a = m.buildAnalysis(['壬午','己酉','戊子','壬子']);
  const detail = m.buildZiweiPalaceDetail({palaces},a,'命宫');
  assert.equal(detail.relations.length,3);
  assert.ok(detail.relations.every(r => r.tone === 'neutral'));
});

test('普通问题不发送一百多年，点名年份仍保留',()=>{
  assert.deepEqual(Array.from(m.selectedAnnualYears('2039年的感情如何',2000,2026)),[2026,2027,2039]);
  assert.deepEqual(Array.from(m.selectedAnnualYears('未来三年',2000,2026)),[2026,2027,2028]);
});

test('交运时刻前后只属于相邻一运',()=>{
  const e=m.calculateBazi('1987-08-01','12:00','女');
  const a=m.buildAnalysis(e.pillars,e);
  const boundary=new Date(e.fortunes[1].startsAt.replace(' ','T')+'+08:00');
  const before=m.buildLuck(e.pillars,'女',a,{palaces:[]},e,new Date(boundary.getTime()-1));
  const after=m.buildLuck(e.pillars,'女',a,{palaces:[]},e,boundary);
  assert.equal(before.currentFortune.pillar,e.fortunes[0].pillar);
  assert.equal(after.currentFortune.pillar,e.fortunes[1].pillar);
});
