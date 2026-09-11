import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const get=()=>loadTs('app/fortune-years.ts').fortuneYears;
const w=(kind,start,end)=>({kind,position:2,startsAt:start,endsAt:end,year:2031,pillar:'辛亥',reason:'具体依据'});
const rows=[{year:2031,pillar:'辛亥',fortune:'癸卯',startsAt:'2031-02-04',endsAt:'2031-05-03',windows:[w('career','2031-02-04','2031-05-03'),w('relationship','2031-02-04','2031-05-03')]},{year:2031,pillar:'辛亥',fortune:'壬寅',startsAt:'2031-05-03',endsAt:'2032-02-04',windows:[w('overall','2031-05-03','2032-02-04')]}];
test('同年事业与感情合并成一个年份入口，交运两侧不串运',()=>{
 const result=get()(rows,{pillar:'癸卯',startsAt:'2021-05-03',endsAt:'2031-05-03'});
 assert.equal(result.length,1);assert.deepEqual(result[0].labels,['事业','感情']);
 assert.equal(result[0].windows.length,2);
 assert.ok(result[0].windows.every(w=>w.endsAt==='2031-05-03'));
 assert.deepEqual(get()(rows,{pillar:'壬寅',startsAt:'2031-05-03',endsAt:'2041-05-03'})[0].labels,['综合变化']);
});
test('不为没有符合条件的流年制造变化标签',()=>{assert.deepEqual(get()([{...rows[0],windows:[]}],{pillar:'癸卯',startsAt:'2021-05-03',endsAt:'2031-05-03'}),[]);});
