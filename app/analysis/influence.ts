import {elements,produces,controls,nodeText} from './facts';
import type {Facts} from './types';
export function assessInfluence(f:Facts,stem:string,pillar:number){
 const p=f.profiles.find(p=>p.stem===stem)!;
 const roots=[...p.roots,...p.sameElementRoots];
 const month=f.nodes.find(n=>n.pillar===1&&n.layer==='hidden'&&n.depth===0)!;
 const season=month.element===elements[stem]?'同类当令':produces[month.element]===elements[stem]?'月令生扶':'月令不直接生扶';
 const healthy=roots.filter(r=>!r.disturbed),deep=healthy.some(r=>r.depth===0);
 const attackers=f.profiles.filter(q=>q.stable&&controls[q.element]===elements[stem]);
 const restricted=p.tied||roots.some(r=>r.disturbed)||attackers.length>0;
 const level=restricted?'作用受扰':deep&&season!=='月令不直接生扶'?'支撑较强':healthy.length?'有根支撑':'支撑有限';
 const evidence=[season,...roots.map(r=>nodeText(r)+(r.stem===stem?'（同干根）':'（同五行支持）')),...attackers.map(a=>a.stem+a.god+'透根并有克制关系，须另看制化是否解救'),...(p.tied?['有多方争合，未直接判合化']:[])];
 if(!roots.length)evidence.push('原局与当前岁运中未见同五行藏根');
 return {stem,pillar,god:p.god,level,season,roots:roots.map(r=>({id:r.id,depth:r.depth,disturbed:r.disturbed,pillar:r.pillar})),evidence,caveat:'定性力量条件，非能量分数；受冲或受克保留根气，不直接判失效。四柱远近与合化强度尚无经校准的数值权重。'};
}
