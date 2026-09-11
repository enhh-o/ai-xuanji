import {describeYear} from './year-impact';
import {Solar} from 'lunar-javascript';
import {branchRelations,combines,god} from './facts';
import type {Facts,LocalInput} from './types';
import type {assessUseful} from './useful';
import {assessNatal} from './natal';
import {assessPatterns} from './patterns';
import {reviewAdded} from './fortune';
export type WindowKind='overall'|'career'|'relationship';
const stamp=(s:string)=>s.length===10?s+' 00:00:00':s.replace('T',' ').slice(0,19);
const spring=(y:number)=>(Solar.fromYmdHms(y,7,1,12,0,0).getLunar().getJieQiTable()['立春']).toYmdHms();
export function assessTiming(f:Facts,u:ReturnType<typeof assessUseful>,input:LocalInput){
  const all=input.horizon>=120,year=Number((all?input.birthDate:input.asOf).slice(0,4)),adult=(Number(input.birthDate.slice(0,4))+18)+input.birthDate.slice(4,10)+' 00:00:00';
  const spouse=input.gender==='女'?['正官','七杀']:['正财','偏财'];
  const touch=(a:string,b:string)=>branchRelations(a,b).filter(x=>['冲','六合','刑'].includes(x));
  const timing=[];
  const base=assessPatterns(f,assessNatal(f,input));
  for(let y=year-1;y<year+Math.min(120,Math.max(1,input.horizon));y++){
    const start=[spring(y),stamp(input.birthDate)].sort().at(-1)!,end=spring(y+1),annual=Solar.fromYmdHms(y,7,1,12,0,0).getLunar().getEightChar().getYear();
    if(end<=(all?input.birthDate:input.asOf))continue;
    const cuts=[start,...input.fortunes.flatMap(x=>[stamp(x.startsAt),stamp(x.endsAt)]).filter(x=>x>start&&x<end),end].filter((x,i,a)=>a.indexOf(x)===i).sort();
    for(let k=0;k<cuts.length-1;k++){
      const startsAt=cuts[k],endsAt=cuts[k+1],fortune=input.fortunes.find(x=>stamp(x.startsAt)<=startsAt&&stamp(x.endsAt)>startsAt);
      const added=fortune?[fortune.pillar,annual]:[annual];
      const evidence=added.flatMap((p,i)=>f.pillars.flatMap((q,j)=>[
        ...branchRelations(p[1],q[1]).map(r=>(fortune&&i===0?'大运':'流年')+p+'与'+['年','月','日','时'][j]+'柱'+q+'见'+r),
        ...(combines(p[0],q[0])?[(fortune&&i===0?'大运':'流年')+p+'与'+['年','月','日','时'][j]+'柱'+q+'天干五合（未判化）']:[])
      ]));
      const review=fortune?reviewAdded(input,added,base,u):null;
      const mode=review?.mode||'条件待辨';
      const windows:{kind:WindowKind;impact:ReturnType<typeof describeYear>;position:number;startsAt:string;endsAt:string;reason:string;year:number;pillar:string}[]=[];
      if(fortune){
        const d=fortune.pillar,annualViaLuck=touch(annual[1],d[1]).length>0;
        for(const kind of ['overall','career','relationship'] as WindowKind[]){
          const pos=kind==='relationship'?2:kind==='career'?1:f.pillars.findIndex(q=>touch(d[1],q[1]).length&&(touch(annual[1],q[1]).length||annualViaLuck));
          if(pos<0)continue;
          const original=f.pillars[pos];
          const decadal=touch(d[1],original[1]),yearly=touch(annual[1],original[1]);
          const natalTopic=kind==='relationship'?f.nodes.filter(n=>spouse.includes(n.god)):kind==='career'?f.nodes.filter(n=>['正官','七杀','食神','伤官'].includes(n.god)):[];
          const topicGods=kind==='relationship'?spouse:['正官','七杀','食神','伤官'];
          const annualState=review?.starStates.find(x=>x.stem===annual[0]);
          const luckState=review?.starStates.find(x=>x.stem===d[0]);
          const annualStar=topicGods.includes(god(f.day,annual[0]))&&Boolean(annualState?.stable);
          const luckStar=topicGods.includes(god(f.day,d[0]))&&Boolean(luckState?.stable);
          const topic=kind==='overall'?true:kind==='career'?annualStar:annualStar||(Boolean(annualState?.hasRoot)&&combines(annual[0],f.day)&&natalTopic.length>0);
          // 两条独立岁运作用，不能把同一地支的刑冲害重复计票。
          const stage=decadal.length>0||(kind==='relationship'&&luckStar);
          const trigger=kind==='relationship'?yearly.length>0:yearly.length>0||annualViaLuck;
          if(!topic||!stage||!trigger)continue;
          const windowStart=kind==='overall'?startsAt:[startsAt,adult].sort().at(-1)!;
          if(windowStart>=endsAt)continue;
          const reason='原局'+['年柱','月柱','日柱','时柱'][pos]+original+'；大运'+d+(decadal.length?'见'+decadal.join('、'):'配偶星透出并见根')+'，流年'+annual+(yearly.length?'触及该柱（'+yearly.join('、')+'）':'通过与大运的关系引动')+(kind!=='overall'?'；流年'+god(f.day,annual[0])+(annualStar?'具备本轮透根条件':'有根并合日主，未直接判化'):'')+(natalTopic.length?'；原局相关十神为'+[...new Set(natalTopic.map(n=>n.stem+n.god))].join('、'):'')+'。'+(review?.changes.join('；')||'已覆盖制化链未出现状态改变')+'。这是多重作用重合的观察期，不是事件已经确定。';
          windows.push({kind,impact:describeYear(input,d,annual,kind,pos,u,y),position:pos,startsAt:windowStart,endsAt,reason,year:y,pillar:annual});
        }
      }
      timing.push({year:y,pillar:annual,fortune:fortune?.pillar||null,startsAt,endsAt,mode,evidence:[...new Set(evidence)],windows,summary:fortune?'大运'+fortune.pillar+'与流年'+annual+'共同加入原局；'+mode+'，须结合具体关系，不等于吉凶评分。':'此段未进入已提供的大运，暂不生成岁运转折。'});
    }
  }
  return timing;
}
