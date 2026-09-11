import type {Facts,Decision,Element} from './types';
import {produces,controls,elements} from './facts';
import type {assessNatal} from './natal';
import type {assessPatterns} from './patterns';
import type {assessClimate} from './climate';
export function assessUseful(f:Facts,n:ReturnType<typeof assessNatal>,p:ReturnType<typeof assessPatterns>,c:ReturnType<typeof assessClimate>,special:Decision[]){
  const day=elements[f.day],resource=f.support[1],output=produces[day],wealth=controls[day];
  const officer=(Object.keys(controls) as Element[]).find(e=>controls[e]===day)!;
  const balance:Element[]=n.weak?[resource,day]:n.strong?[output,wealth]:[];
  const mechanisms=p.mechanisms.filter(m=>m.status==='supported');
  const mechanismNames=mechanisms.map(m=>m.name).join('、');
  const keyElements:Record<string,Element>={shizhi:output,shengcai:output,shangcai:output,caiguanyin:resource,shayin:resource,guanyin:resource,peiyin:resource,renjia:officer};
  const patternElements=[...new Set(mechanisms.flatMap(m=>keyElements[m.id]?[keyElements[m.id]]:[]))];
  const mechanismEvidence=[...new Set(mechanisms.flatMap(m=>m.evidence))];
  const diseases=p.diseases.filter(m=>m.status==='supported');
  const medicine:Element[]=diseases.some(m=>m.id==='yinzhong')?[wealth]:diseases.some(m=>m.id==='caiduo')?[resource,day]:diseases.some(m=>m.id==='jiecai')?[officer,output]:[];
  const bridge=p.mechanisms.find(m=>m.status==='supported'&&['caiguanyin','shayin','guanyin'].includes(m.id));
  const dimension=(id:string,name:string,els:Element[],summary:string,evidence:string[],against:string[]=[]):Decision=>({id,name,elements:els,summary,evidence,against,status:els.length?'supported':'candidate'});
  const dimensions=[
    dimension('balance','扶抑',balance,n.summary,n.evidence,n.against),
    dimension('pattern','格局',patternElements,mechanisms.length?mechanisms.map(m=>m.name+'：'+m.summary).join('；'):p.summary,mechanisms.length?mechanismEvidence:n.baseEvidence,mechanisms.flatMap(m=>m.against)),
    dimension('climate','调候',c.entries.map(e=>e.element),c.summary,c.entries.flatMap(e=>e.evidence),['参考表待核对',...c.exceptions.filter(e=>e.active).map(e=>e.name)]),
    dimension('medicine','病药',medicine,diseases.length?diseases.map(d=>d.name+'：'+d.summary).join('；'):'未识别出满足本轮条件的主要受阻链条，不等于没有其他问题。',diseases.flatMap(d=>d.evidence)),
    dimension('bridge','通关',bridge?[resource]:[],bridge?'官杀—印—日主具备透根链条；需要维持印星支持。':'未见已满足本轮条件的通关链，不自动补一个五行。',bridge?.evidence||[]),
    dimension('special','变格',[],special.length?special.map(s=>s.name+'：'+s.summary).join('；'):'按普通格局分析，未触发本轮特殊格局候选。',special.flatMap(s=>s.evidence),special.flatMap(s=>s.against)),
  ];
  const routeCompetition=special.some(s=>s.status==='candidate'&&s.id!=='huaqi')||special.some(s=>s.id==='huaqi'&&s.status==='candidate'&&!f.nodes.some(x=>x.layer==='hidden'&&x.element===day)&&!f.profiles.some(p=>f.support.includes(p.element)&&p.stable));
  let favorable:Element[]=c.override?[c.entries[0].element]:patternElements.length?patternElements:medicine.length?medicine:balance;
  const rationale=c.override?'调候优先条件满足':patternElements.length?'以已满足条件的'+mechanismNames+'配合为先':medicine.length?'先处理已识别的受阻结构':balance.length?'未发现已成立的反向制化，暂按扶抑方向':'强弱中和，尚无单一取用方向';
  const conflicts:string[]=[];
  if(patternElements.length>1)conflicts.push('多条配合分别需要不同五行，当前并列保留条件性方向，未完成主次裁决；不表示可以同时无条件增补。');
  if(patternElements.length&&balance.length&&!patternElements.some(e=>balance.includes(e)))conflicts.push('格局取用与简单扶抑不同，优先维持'+mechanismNames+'，不能机械把食伤或财官列忌。');
  if(c.sourceConflict)conflicts.push('调候条目存在版本或月内分段差异，只作参考，不覆盖当前主判断。');
  if(routeCompetition){conflicts.push('特殊格局与普通格局可能改变取用方向，暂不输出唯一喜忌。');favorable=[];}
  const conditionalElements=mechanisms.flatMap(m=>m.elements);
  const avoid:Element[]=favorable.length?(n.weak?[output,officer,wealth]:n.strong?[day,resource]:[]).filter(e=>!favorable.includes(e)&&!conditionalElements.includes(e)):[];
  const uncertainty=routeCompetition?'高':n.against.length||c.sourceConflict||conflicts.length||!favorable.length?'中':'低';
  return {dimensions,favorable:[...new Set(favorable)],avoid:[...new Set(avoid)],uncertainty,conflicts,routeCompetition,status:favorable.length?'条件性取用':'取用待辨',summary:rationale+'。'+(favorable.length?'当前取用侧重'+favorable.join('、')+'；须保持对应结构条件，而非无条件补这些五行。':'当前不强行指定用神。'),evidence:mechanisms.length?mechanismEvidence:n.evidence};
}
