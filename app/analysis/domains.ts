import type {Facts} from './types';
import {nodeText} from './facts';
import type {assessNatal} from './natal';
import type {assessPatterns} from './patterns';
import type {assessUseful} from './useful';
import type {assessTiming} from './timing';
export function assessDomains(f:Facts,n:ReturnType<typeof assessNatal>,p:ReturnType<typeof assessPatterns>,u:ReturnType<typeof assessUseful>,timing:ReturnType<typeof assessTiming>,gender:'男'|'女'){
  const make=(key:string,label:string,gods:string[])=>{
    const profiles=f.profiles.filter(x=>gods.includes(x.god)&&(x.exposed.length||x.roots.length)).sort((a,b)=>Number(b.stable)-Number(a.stable)||Number(b.seasonal)-Number(a.seasonal)||Number(b.exposed.some(n=>n.pillar===1))-Number(a.exposed.some(n=>n.pillar===1))||Number(Boolean(b.exposed.length))-Number(Boolean(a.exposed.length)));
    const visible=profiles.filter(x=>x.exposed.length),rooted=visible.filter(x=>x.stable),latent=profiles.filter(x=>!x.exposed.length);
    const ids=profiles.flatMap(x=>[...x.exposed,...x.roots,...(x.exposed.length?x.sameElementRoots:[])].map(x=>x.id));
    const relevant=p.mechanisms.filter(x=>x.status!=='absent'&&x.evidence.some(id=>ids.includes(id)));
    const friction=p.diseases.filter(x=>x.status==='supported'&&x.evidence.some(id=>ids.includes(id)));
    const palace=key==='relationship'?f.relations.filter(x=>x.layer==='branch'&&x.positions.includes(2)):[];
    const focus=rooted[0]||visible[0]||latent[0];
    const path=focus?.god;
    const actions:Record<string,string>={正官:'把岗位职责、考核标准和可用权限确认清楚，再决定是否承担更多责任。',七杀:'接下高压任务前确认负责人、资源与退出条件，不用硬扛代替解决问题。',食神:'选择一项可持续交付的技能，先做出样品，记录实际反馈与复购。',伤官:'把不同意见整理为可比较的方案和试验结果，减少只表达不验证。',正财:'逐笔记录收入、固定支出与回款日期，先判断收入是否稳定。',偏财:'把项目机会与到账收入分开记录；未经小规模验证，不扩大投入。',正印:'把学习内容变成一份实际成果，检查知识是否真正解决问题。',偏印:'给研究和准备设期限，到期用小实验检验想法，不无限延后行动。',比肩:'独立负责的部分设清晰目标，遇到资源不足时明确提出协作请求。',劫财:'合作前写清分工、费用、收益归属和退出方式。'};
    let headline=focus?focus.stem+focus.god+(rooted.length?'透出有根，是较明确的主题':visible.length?'透出但作用有条件':'主要暗藏，不宜直接下强结论'):'相关十神未形成明确主线';
    if(key==='relationship')headline=palace.length?'日支见'+palace.map(x=>x.name).join('、')+'，关系磨合需单独看':visible.length?'配偶星'+visible.map(x=>x.stem+x.god).join('、')+'可见，不能仅凭此定顺逆':'配偶星显露有限，不等于没有感情机会';
    const evidence=[...new Set([...profiles.flatMap(x=>[...x.exposed,...x.roots,...(x.exposed.length?x.sameElementRoots:[])].map(nodeText)),...relevant.map(x=>x.name+'：'+(x.status==='supported'?'本轮条件支持':'仍缺条件')+'；'+x.against.join('；')),...palace.map(x=>x.name)])];
    const period=timing.flatMap(x=>x.windows).filter(w=>w.kind===(key==='relationship'?'relationship':key==='career'?'career':'overall'))[0];
    const summary=friction.length?friction.map(x=>x.name).join('、')+'是此领域需要先处理的矛盾。'+friction[0].summary:relevant.some(x=>x.status==='supported')?relevant.filter(x=>x.status==='supported').map(x=>x.name+'：'+x.summary).join('；'):visible.length?'原局'+visible.map(x=>x.stem+x.god).join('、')+'显露；'+(rooted.length?'有相应根气，但现实结果还取决于发挥方式。':'根气或合冲条件尚未稳定，不能直接断为优势。'):latent.length?'相关线索主要藏在'+[...new Set(latent.flatMap(x=>x.roots.map(r=>r.branch)))].join('、')+'中，本轮依据不足以给出明显顺逆判断。':'本轮规则没有找到足够的领域证据，保留判断。';
    const advice=key==='relationship'?(palace.some(x=>x.name.includes('冲'))?'关系发生变化时先核实居住、时间安排和承诺是否同步，不把一次争执等同关系终结。':palace.some(x=>x.name.includes('合'))?'确认共同计划时，把各自责任与独立空间说清，不把关系绑定等同于相处融洽。':visible.length>1?'面对不同期待时，先明确自己愿意承担的承诺，不因外部评价仓促作决定。':visible.length?'先观察对方如何处理责任、分歧和日常承诺，再判断是否适合长期相处。':'从稳定联系与日常相处积累信息，不因配偶星未透而回避建立关系。'):friction.some(x=>x.id==='jiecai')?actions['劫财']:friction.some(x=>x.id==='caiyin')?'先保障必要的学习与支持资源，新增赚钱项目单独记账，避免挤占已有承诺。':path?actions[path]:'先补充实际目标与已发生的情况，再决定行动，避免把未定结论当依据。';
    return {key,label,headline,summary,evidence,advice,period:period?period.startsAt.slice(0,10)+'至'+period.endsAt.slice(0,10)+'：'+period.reason:'当前观察范围内未满足本轮多重触发条件；不表示人生没有变化。',caveat:u.routeCompetition?'取用路线仍有分歧，本领域暂不按单一喜忌定论。':n.summary};
  };
  return [make('personality','性格',['比肩','劫财','食神','伤官','正官','七杀','正印','偏印']),make('career','事业',['正官','七杀','食神','伤官','正印']),make('wealth','财富',['正财','偏财','食神','伤官','劫财']),make('relationship','感情',gender==='女'?['正官','七杀']:['正财','偏财'])];
}
