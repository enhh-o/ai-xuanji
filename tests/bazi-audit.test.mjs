import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {buildFacts}=loadTs('app/analysis/facts.ts');
const {assessNatal}=loadTs('app/analysis/natal.ts');
const {assessPatterns}=loadTs('app/analysis/patterns.ts');
const {assessUseful}=loadTs('app/analysis/useful.ts');
const input=pillars=>({pillars,gender:'女',birthDate:'2002-09-12',asOf:'2026-09-12',horizon:1,fortunes:[]});
const climate={entries:[],summary:'未触发',exceptions:[],override:false,sourceConflict:false};
test('月令同类且本气根充足，无带根制耗，不因印比未另透根而漏判偏旺',()=>{
  // 构造合法干支结构检验旺衰条件，不用于验证出生历法。
  const i=input(['癸卯','癸卯','甲寅','癸卯']);
  assert.equal(assessNatal(buildFacts(i),i).strong,true);
});
test('多条已支持制化路径取用不依赖数组排列，也不把流通必要五行直接列忌',()=>{
  const i=input(['庚申','癸亥','戊子','甲子']),f=buildFacts(i),n=assessNatal(f,i);
  // 条件单测：上游提供两条支持路径，只检验下游优先级一致性。
  const mechanism=(id,elements)=>({id,name:id,status:'supported',summary:'条件已提供',evidence:['0-stem-0'],against:[],elements});
  const mechanisms=[mechanism('shizhi',['金','木']),mechanism('caiguanyin',['水','木','火'])];
  const pattern={mechanisms,diseases:[],summary:''};
  const one=assessUseful(f,n,pattern,climate,[]);
  const two=assessUseful(f,n,{...pattern,mechanisms:[...mechanisms].reverse()},climate,[]);
  assert.deepEqual([...one.favorable].sort(),[...two.favorable].sort());
  assert.ok(one.favorable.includes('火'));
  assert.ok(!one.avoid.includes('水'));
  assert.ok(!one.avoid.includes('木'));
  assert.ok(one.conflicts.length>0);
});
test('身弱生财仍须承接闸门，不能越过扶抑自动成格',()=>{
  const i=input(['壬午','己酉','戊子','壬子']),f=buildFacts(i),n=assessNatal(f,i);
  assert.equal(n.weak,true);
  const p=assessPatterns(f,n);
  assert.ok(!p.mechanisms.some(m=>['shengcai','shangcai'].includes(m.id)&&m.status==='supported'));
  assert.ok(assessUseful(f,n,p,climate,[]).favorable.includes('火'));
});
test('比劫财并见但未证身旺，不自动用官杀食伤进一步制泄弱身',()=>{
  const i=input(['壬午','己酉','戊子','壬子']),f=buildFacts(i),n=assessNatal(f,i);
  // 隔离病药前提：给出比劫财稳定存在，不能冒充比劫旺而财弱的证据。
  for(const god of ['劫财','正财']){
    const p=f.profiles.find(p=>p.god===god);
    p.exposed=[{...f.nodes[0],stem:p.stem,god:p.god,element:p.element}];p.stable=true;
  }
  const p=assessPatterns(f,n);
  assert.notEqual(p.diseases.find(d=>d.id==='jiecai').status,'supported');
  const u=assessUseful(f,n,p,climate,[]);
  assert.ok(u.favorable.includes('火'));
});
