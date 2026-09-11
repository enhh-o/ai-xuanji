import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTs} from './helpers/load-ts.mjs';
test('九宫按钮与当前宫位解释一致，切到中宫显示寄宫去向',()=>{
 assert.ok(fs.existsSync('app/qimen-panel.tsx'),'奇门交互组件尚未实现');
 const {QimenPanel}=loadTs('app/qimen-panel.tsx');
 const {calculateQimen}=loadTs('app/qimen-engine.ts');
 const chart=calculateQimen({date:'1990-01-01',time:'12:30',standardDate:'1990-01-01',standardTime:'12:30'});
 const html=id=>renderToStaticMarkup(React.createElement(QimenPanel,{chart,selectedId:id,onSelect:()=>{}}));
 const first=html(1),center=html(5);
 assert.equal((first.match(/aria-pressed=/g)||[]).length,9);
 assert.equal((first.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(first,/坎一宫.*?本盘依据/s);assert.match(first,/门宫关系/);
 assert.match(center,/中宫不另设八门、八神/);assert.match(center,/天禽/);
 assert.doesNotMatch(first,/undefined|NaN/);assert.doesNotMatch(center,/undefined|NaN/);
});
