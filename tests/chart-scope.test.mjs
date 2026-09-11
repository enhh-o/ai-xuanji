import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from './helpers/load-ts.mjs';
const {buildChatContext}=loadTs('app/chat-context.ts');
const base={pillars:['甲子','丙寅','戊辰','庚申'],gender:'女',selectedPalace:'命宫',favorable:['木'],avoid:['土'],strength:'偏弱',fortuneStages:['甲子运'],ziweiReady:true,palaceSummaries:['命宫天府'],chartDetails:'八字规则结论',annualSummary:'八字流年'};
test('奇门问询带完整九宫资料与选择范围，不附八字推论和紫微结论',()=>{
 const c=buildChatContext({...base,analysisSystem:'qimen',qimenSummary:'出生局：坎一宫天蓬休门'});
 assert.equal(c.analysisSystem,'qimen');assert.equal(c.qimenSummary,'出生局：坎一宫天蓬休门');
 assert.equal(c.chartDetails,'');assert.equal(c.ziweiSummary,'');assert.equal(c.fortuneSummary,'');assert.equal(c.annualSummary,'');
});
test('紫微只保留紫微资料，八字页只保留八字解读',()=>{
 const z=buildChatContext({...base,analysisSystem:'ziwei'}),b=buildChatContext({...base,analysisSystem:'bazi'});
 assert.match(z.ziweiSummary,/天府/);assert.equal(z.fortuneSummary,'');assert.equal(z.chartDetails,'');
 assert.equal(b.ziweiSummary,'');assert.match(b.chartDetails,/八字/);
});
