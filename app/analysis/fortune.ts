import {assessInfluence} from './influence';
import {buildFacts,nodeText,produces,controls} from './facts';
import {assessNatal} from './natal';
import {assessPatterns} from './patterns';
import type {LocalInput} from './types';
import type {assessUseful} from './useful';
export function reviewAdded(input:LocalInput,extra:string[],base:ReturnType<typeof assessPatterns>,u:ReturnType<typeof assessUseful>){
  const facts=buildFacts(input,extra),n=assessNatal(buildFacts(input),input),pattern=assessPatterns(facts,n);
  const gained=pattern.mechanisms.filter(x=>x.status==='supported'&&!base.mechanisms.some(b=>b.id===x.id&&b.status==='supported'));
  const lost=base.mechanisms.filter(x=>x.status==='supported'&&!pattern.mechanisms.some(b=>b.id===x.id&&b.status==='supported'));
  const diseases=pattern.diseases.filter(x=>x.status==='supported'&&!base.diseases.some(b=>b.id===x.id&&b.status==='supported'));
  const newNodes=facts.nodes.filter(x=>x.pillar>=4),good=newNodes.filter(x=>u.favorable.includes(x.element)),bad=newNodes.filter(x=>u.avoid.includes(x.element));
  const interactions=facts.relations.filter(r=>r.positions.some(i=>i>=4));
  const labels=['年柱','月柱','日柱','时柱','大运','流年'];
  const visible=facts.nodes.filter(x=>x.layer==='stem');
  const stemRelations:string[]=[];
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
    const a=visible[i],b=visible[j];if(b.pillar<4)continue;
    const name=(x:typeof a)=>labels[x.pillar]+x.stem;
    if(produces[a.element]===b.element)stemRelations.push(name(a)+'生'+name(b));
    else if(produces[b.element]===a.element)stemRelations.push(name(b)+'生'+name(a));
    else if(controls[a.element]===b.element)stemRelations.push(name(a)+'克'+name(b));
    else if(controls[b.element]===a.element)stemRelations.push(name(b)+'克'+name(a));
  }
  const moving=interactions.some(r=>r.name.includes('冲'));
  // 取用方向与冲动关系分别表达；冲不等于喜神变忌神，也不直接判拔根。
  const movement=moving?'有冲动关系':'未见新增六冲';
  const mode: '支持增加'|'制耗增加'|'作用交织'|'条件待辨'=!u.favorable.length?'条件待辨':good.length&&bad.length?'作用交织':good.length?'支持增加':bad.length?'制耗增加':'条件待辨';
  const influences=extra.map((p,i)=>assessInfluence(facts,p[0],i+4));
  const changes=[...gained.map(x=>x.name+'新增支持条件'),...lost.map(x=>x.name+'原有条件受扰'),...diseases.map(x=>x.name+'新增受阻条件')];
  const reason='取用方向：'+mode+'（依本命已列喜忌，含藏干，不表示整步大运吉凶）。'+(moving?'另有冲动关系，不能据此抵消生扶或直接判为不利。':'')+newNodes.map(nodeText).join('；')+'。'+(interactions.length?'新增关系：'+interactions.map(r=>r.positions.map(i=>labels[i]+facts.pillars[i]).join('与')+'：'+r.name).join('；')+'。':'未见本轮直接合冲刑害关系。')+(stemRelations.length?'天干生克：'+stemRelations.join('；')+'。力量条件：'+influences.map(p=>p.stem+p.god+'为'+p.level+'（'+p.season+'）').join('；')+'。具体根气与制约见力量条件；远近与合化不套未经校准的数值权重。':'')+(changes.length?changes.join('；')+'。':'未触发已覆盖制化链条的状态改变。');
  const strategy=lost.length?'先保护'+lost.map(x=>x.name).join('、')+'所需的支持条件，职责和投入不要同时扩张。':gained.length?'围绕'+gained.map(x=>x.name).join('、')+'对应的技能、支持或约束做小规模验证，观察是否转为实际成果。':mode==='制耗增加'?'先核对新增责任、资源支出与可用支持，给投入设明确上限。':moving?'先确认变化影响的是哪项安排，保留交接时间与备选方案，不把变化自动当作坏事。':mode==='支持增加'?'新增支持条件可以尝试运用；先设一个可验收的目标，用结果判断是否扩大。':'支持和制约尚未分出清楚主次，先处理已有任务，再根据实际反馈调整投入。';
  return {influences,mode,movement,modeTone:mode==='支持增加'?'progress' as const:mode==='制耗增加'?'pause' as const:'steady' as const,reason,strategy,changes,interactions,stemRelations,evidence:newNodes.map(x=>x.id),starStates:facts.profiles.map(p=>({stem:p.stem,god:p.god,stable:p.stable,tied:p.tied,hasRoot:p.roots.length>0||p.sameElementRoots.length>0})),pattern};
}
