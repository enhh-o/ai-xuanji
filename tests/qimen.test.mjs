import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadTs} from './helpers/load-ts.mjs';

const present=fs.existsSync('app/qimen-engine.ts');
const engine=present?loadTs('app/qimen-engine.ts'):{};
const layout=(...args)=>{assert.equal(typeof engine.layoutQimen,'function','应提供真实奇门布局引擎');return engine.layoutQimen(...args);};
const calculate=(date,time,extra={})=>{assert.equal(typeof engine.calculateQimen,'function','应提供出生时间排盘');return engine.calculateQimen({date,time,standardDate:date,standardTime:time,...extra});};
// 布局样例来源 arc119226/qimen_dunjia test.js (MIT)，顺序为巽离坤震中兑艮坎乾。
// 八神采用白虎玄武，不套用该来源阳遁的勾陈朱雀异名。
test('阳五局庚申的星门天盘与独立样例一致',()=>{
 const c=layout('庚申',5,true);
 assert.equal(c.chiefStar,'天蓬');assert.equal(c.chiefDoor,'休门');
 assert.deepEqual(c.palaces.map(p=>p.earthStem),['乙','壬','丁','丙','戊','庚','辛','癸','己']);
 assert.deepEqual(c.palaces.map(p=>p.heavenStem),['丁','庚','己','壬',null,'癸','乙','丙','辛']);
 assert.deepEqual(c.palaces.map(p=>p.door),['死门','惊门','开门','景门',null,'休门','杜门','伤门','生门']);
 assert.equal(c.chiefStarPalace,7);assert.equal(c.chiefDoorPalace,7);
});
test('阴三局辛亥按九宫逆推值使，星盘仍整体旋转',()=>{
 const c=layout('辛亥',3,false);
 assert.equal(c.chiefStar,'天任');assert.equal(c.chiefStarPalace,9);assert.equal(c.chiefDoorPalace,1);
 assert.deepEqual(c.palaces.map(p=>p.heavenStem),['庚','壬','戊','丁',null,'乙','癸','己','辛']);
 assert.deepEqual(c.palaces.map(p=>p.door),['景门','死门','惊门','杜门',null,'开门','伤门','生门','休门']);
});
test('甲遁伏吟保留地盘且中宫不伪造第九门',()=>{
 const c=layout('甲午',7,true);
 assert.equal(c.xunHead,'甲午');assert.equal(c.hiddenJia,'辛');
 for(const p of c.palaces.filter(p=>p.id!==5))assert.equal(p.heavenStem,p.earthStem);
 const center=c.palaces.find(p=>p.id===5);assert.equal(center.door,null);assert.equal(center.deity,null);
 const rui=c.palaces.find(p=>p.star==='天芮');assert.equal(rui.guestStem,center.earthStem);assert.equal(rui.guestStar,'天禽');
});
test('时干落中宫时值符与值使在坤宫，宫位标注与盘面一致',()=>{
 const c=layout('壬戌',1,true);assert.equal(c.chiefStarPalace,2);assert.equal(c.chiefDoorPalace,2);
 assert.equal(c.palaces.find(p=>p.id===2).star,'天心');
});
test('出生节气按标准时判定，不将经度校正移到节气另一侧',()=>{
 const before=calculate('2024-06-21','02:00',{standardTime:'04:50'});
 const after=calculate('2024-06-21','02:00',{standardTime:'04:52'});
 assert.equal(before.term,'芒种');assert.equal(before.yang,true);
 assert.equal(after.term,'夏至');assert.equal(after.yang,false);
 assert.deepEqual(before.pillars.slice(2),after.pillars.slice(2));
});
test('真太阳时23点子初换日和跨年可复现',()=>{
 const a=calculate('2024-01-01','22:59'),b=calculate('2024-01-01','23:00'),c=calculate('2024-01-02','00:00');
 assert.notEqual(a.pillars[2],b.pillars[2]);assert.equal(b.pillars[2],c.pillars[2]);assert.equal(b.pillars[3],c.pillars[3]);
 assert.equal(calculate('1990-01-01','12:30').palaces.length,9);
});
test('甲己符头定三元，不按距交节的天数分桶',()=>{
 for(const [date,fuTou,yuan,ju] of [['2024-01-01','甲子','上元',1],['2024-01-06','己巳','中元',8],['2024-01-11','甲戌','下元',5],['2024-01-16','己卯','上元',2]]){
   const c=calculate(date,'12:00');assert.equal(c.fuTou,fuTou);assert.equal(c.yuan,yuan);assert.equal(c.ju,ju);
 }
});
test('拒绝不存在的日期、越界时间与非法干支',()=>{
 for(const [d,t] of [['2024-02-30','12:00'],['2023-02-29','12:00'],['2024-01-01','24:00'],['','12:00']])assert.throws(()=>calculate(d,t));
 assert.throws(()=>layout('甲丑',1,true));assert.throws(()=>layout('甲子',0,true));
});
test('九宫解释包含本盘依据，换时辰会改变组合说明，中宫解释寄宫',()=>{
 assert.ok(fs.existsSync('app/qimen-reading.ts'),'应提供九宫解读');
 const {explainQimenPalace}=loadTs('app/qimen-reading.ts');
 const a=calculate('1990-01-01','12:30'),b=calculate('1990-01-01','16:30');
 for(const p of a.palaces){const r=explainQimenPalace(a,p.id);assert.ok(r.summary);assert.ok(r.evidence.length);assert.ok(r.terms.length);}
 assert.notEqual(explainQimenPalace(a,1).summary,explainQimenPalace(b,1).summary);
 assert.match(explainQimenPalace(a,5).summary,/寄/);
 assert.throws(()=>explainQimenPalace(a,10));
});
