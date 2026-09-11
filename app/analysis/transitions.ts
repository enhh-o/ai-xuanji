import {elements,hidden,branchRelations,combines} from './facts';
import type {LocalInput} from './types';
import type {reviewAdded} from './fortune';
import type {assessUseful} from './useful';
type Fortune=LocalInput['fortunes'][number]&ReturnType<typeof reviewAdded>;
export function compareStages(input:LocalInput,fortunes:Fortune[],useful:ReturnType<typeof assessUseful>){
  const role=(s:string)=>useful.favorable.includes(elements[s])?'取用支持':useful.avoid.includes(elements[s])?'取用制约':'方向待辨';
  const profile=(f:Fortune)=>{
    const primary=[role(f.pillar[0]),role(hidden[f.pillar[1]][0])];
    const relations=input.pillars.flatMap((p,i)=>[
      ...branchRelations(f.pillar[1],p[1]).map(r=>({key:i+':'+r,label:['年','月','日','时'][i]+'柱'+p+'的'+r+'关系'})),
      ...(combines(f.pillar[0],p[0])?[{key:i+':五合',label:['年','月','日','时'][i]+'柱'+p+'的天干五合（未判化）'}]:[])
    ]);
    const mechanisms=[...f.pattern.mechanisms,...f.pattern.diseases].filter(m=>m.status==='supported');
    return {primary,relations,mechanisms,summary:'运干'+f.pillar[0]+'：'+primary[0]+'；运支本气'+hidden[f.pillar[1]][0]+'：'+primary[1]+'；含藏干总体为'+f.mode};
  };
  const ordered=[...fortunes].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  return ordered.slice(1).map((after,i)=>{
    const before=ordered[i],a=profile(before),b=profile(after);
    const directionChanged=a.primary.join('|')!==b.primary.join('|');
    const gained=b.mechanisms.filter(m=>!a.mechanisms.some(n=>n.id===m.id));
    const lost=a.mechanisms.filter(m=>!b.mechanisms.some(n=>n.id===m.id));
    const added=b.relations.filter(r=>!a.relations.some(q=>q.key===r.key));
    const removed=a.relations.filter(r=>!b.relations.some(q=>q.key===r.key));
    const continuous=before.endsAt===after.startsAt;
    const changed=continuous&&(directionChanged||gained.length>0||lost.length>0||added.length>0||removed.length>0);
    const evidence=[
      ...(directionChanged?['取用方向变化：'+a.summary+' → '+b.summary]:[]),
      ...gained.map(m=>'新满足条件：'+m.name),...lost.map(m=>'原先支持条件不再齐备：'+m.name),
      ...added.map(r=>'下一运新增对原局'+r.label),...removed.map(r=>'下一运不再延续对原局'+r.label),
    ];
    if(!continuous)evidence.unshift('两步大运时间不连续，不能把资料空档直接视作阶段交接。');
    if(!evidence.length)evidence.push('运干与运支本气的取用方向、已覆盖制化状态及原局作用类型未识别到差异；不代表两步运完全相同。');
    return {directionChanged,mechanismsChanged:gained.length>0||lost.length>0,affectedPositions:[...new Set([...added,...removed].map(r=>Number(r.key.split(':')[0])))],from:before.pillar,to:after.pillar,at:after.startsAt,endsAt:after.endsAt,previousStartsAt:before.startsAt,changed,before:a.summary,after:b.summary,evidence,summary:!continuous?'交接资料待核对':changed?'阶段条件变化候选':'未识别到明确阶段差异'};
  });
}
