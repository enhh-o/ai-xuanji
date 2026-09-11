import {god,branchRelations,buildFacts} from './facts';
import {assessInfluence} from './influence';
import type {LocalInput} from './types';
import type {assessUseful} from './useful';
export function describeYear(input:LocalInput,fortune:string,annual:string,kind:'overall'|'career'|'relationship',position:number,u:ReturnType<typeof assessUseful>,year:number){
 const f=buildFacts(input,[fortune,annual]),power=assessInfluence(f,annual[0],5);
 const annualGod=god(f.day,annual[0]);
 const direct=branchRelations(annual[1],input.pillars[position][1]);
 const via=branchRelations(annual[1],fortune[1]);
 const movement=direct.includes('冲')||via.includes('冲');
 const binding=direct.includes('六合');
 const favorable=u.favorable.includes(f.nodes.find(n=>n.pillar===5&&n.layer==='stem')!.element);
 const avoided=u.avoid.includes(f.nodes.find(n=>n.pillar===5&&n.layer==='stem')!.element);
 const tone=favorable?(power.level==='作用受扰'?'支持伴随制约':'支持线索'):avoided?'制约线索':'方向待辨';
 let title='',scenarios:string[]=[],observe='';
 const age=year-Number(input.birthDate.slice(0,4));
 if(age<6){title='家庭生活安排';scenarios=['可能对应照护安排、居住环境或家庭日常节奏的调整；幼年不能套用成人事业或婚恋事件。'];observe='由监护人核对实际照护、居住和日常作息是否改变。';}
 else if(age<18){title='学习与生活节奏';scenarios=[movement?'可能对应班级、课程安排或学习环境调整，需结合实际学段核验。':'可能对应学习任务、同伴合作或家庭安排的重新协调。'];observe='核对课程、学校通知与日常作息，不据此判断升学结果。';}
 else if(kind==='relationship'){
  title=binding?'关系承诺与共同安排':movement?'关系与生活安排调整':'相处中的边界与协调';
  scenarios=[binding?'若已有伴侣，可能进入共同计划、居住或承诺的协商；若单身，只能作为观察交往机会的线索。':movement?'若已有伴侣，可能面临异地、相处时间或共同安排的调整；若单身，可观察生活圈变化是否带来接触机会。':'可能需要重新谈清相处边界、时间投入或共同责任。'];
  observe='观察联系频率、实际承诺和共同安排是否改变，不把一次争执当成关系结论。';
 }else if(['正财','偏财'].includes(annualGod)){
  title='收入与支出安排';scenarios=[favorable?'可能出现项目结算、收入渠道或预算调整的机会，能否兑现仍需核对承接能力。':'可能遇到收入节奏、回款或必要开支的变化，应先核对现金安排。'];observe='核对合同付款节点、到账金额与固定支出；不据此判断投资涨跌。';
 }else if(['正官','七杀'].includes(annualGod)){
  title='岗位职责与考核';scenarios=[favorable?'可能对应承担新职责、牵头任务或接受新的考核；是否升职需有实际任命支持。':'可能对应责任增加、考核要求变化或权限与任务不匹配，需要确认资源。'];observe='查看岗位说明、项目负责人、考核标准和可用权限是否实际改变。';
 }else if(['食神','伤官'].includes(annualGod)){
  title='项目交付与表达';scenarios=[favorable?'可能对应作品发布、项目交付或技能成果获得应用的机会。':'可能对应交付任务增加、方案反复修改，或表达方式与评价要求之间的摩擦。'];observe='观察验收标准、修改轮次、交付量与合作反馈，而不只看主观感受。';
 }else if(['正印','偏印'].includes(annualGod)){
  title='学习、资格与支持资源';scenarios=[favorable?'可能对应培训、资格准备、导师帮助或组织支持；受制时，资源到位与执行日程可能反复。':'可能对应准备和审批时间增加，或学习安排与实际产出之间需要重新分配精力。'];observe='核对是否有真实培训、资格要求或资源承诺，以及是否按计划落实。';
 }else{
  title='合作分工与资源安排';scenarios=[favorable?'可能通过同伴协作或重新分工获得支持，同时需要确认责任归属。':'可能对应分工、费用分担或资源使用上的协商，注意目标是否一致。'];observe='把分工、交付边界和费用约定落实到可核对的记录。';
 }
 if(age>=18&&kind!=='relationship'&&movement)scenarios.push(position===1?'月柱受到引动，以上变化可能通过团队、岗位环境或学习安排的调整表现。':'存在岁运冲动关系，上述主题可能伴随日程、地点或合作安排改变，具体落点仍需现实信息。');
 return {title,tone,power,scenarios,observe,basis:['原局'+input.pillars.join('、')+'，本命取用'+(u.favorable.join('、')||'待辨'),'大运'+fortune+'，流年'+annual+'（'+annualGod+'）','流年对'+['年','月','日','时'][position]+'柱：'+(direct.join('、')||'未见直接合冲刑害')+'；对大运：'+(via.join('、')||'未见直接合冲刑害'),...power.evidence],caveat:'这些是传统规则映射出的待核对情境，不是已经发生的事实；未提供职业、关系状态等背景时不能确定具体事件。'};
}
