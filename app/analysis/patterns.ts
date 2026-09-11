import type {Facts,Decision} from './types';
import type {assessNatal} from './natal';
export function assessPatterns(f:Facts,n:ReturnType<typeof assessNatal>){
  const has=(g:string)=>f.profiles.filter(p=>p.god===g&&p.exposed.length);
  const active=(g:string)=>has(g).some(p=>p.stable);
  const rule=(id:string,name:string,gods:string[],condition:boolean,blockers:string[],summary:string):Decision=>{
    const found=gods.flatMap(has),present=gods.every(g=>has(g).length),ready=present&&gods.every(active)&&condition;
    const bad=blockers.filter(active);
    return {id,name,status:!present?'absent':ready&&!bad.length?'supported':'candidate',summary,evidence:found.flatMap(p=>[...p.exposed,...p.roots,...(p.exposed.length?p.sameElementRoots:[])].map(x=>x.id)),against:[...(!condition?['强弱或格局前提未满足']:[]),...found.filter(p=>!p.stable).map(p=>p.god+(p.tied?'参与五合，作用可能受牵制':'根气未稳或不足')),...bad.map(g=>g+'可能破坏该链条，须另辨救应')],elements:ready&&!bad.length ? [...new Set(found.map(p=>p.element))] : []};
  };
  const mechanisms=[
    rule('caiguanyin','财官印流通',['正财','正官','正印'],!n.strong,['伤官'],'资源先承接职责，再通过知识与制度提供支持；不能因财印同见就直接判财坏印。'),
    rule('shizhi','食神制杀',['食神','七杀'],true,['偏印'],'技能与具体产出有机会回应外部压力；这不等于必然掌权。'),
    rule('shayin','杀印相生',['七杀','正印'],n.weak,['正财','偏财'],'借助学习、制度资源承接压力；印的支持需实际到位。'),
    rule('guanyin','官印相生',['正官','正印'],!n.strong,['伤官','正财','偏财'],'职责与知识支持有衔接，较适合依靠专业积累承担责任。'),
    rule('peiyin','伤官佩印',['伤官','正印'],n.weak,['正财','偏财'],'通过方法和规则约束表达，让改进有可执行的尺度。'),
    rule('renjia','羊刃驾杀',['七杀'],n.base==='羊刃格',['食神','伤官'],'同类力量有约束条件，仍需避免责任与控制过量。'),
    rule('shengcai','食神生财',['食神','偏财'],!n.weak,['偏印','劫财'],'产出与资源兑现有衔接，关注能否持续交付与回款。'),
    rule('shangcai','伤官生财',['伤官','正财'],!n.weak,['正印','劫财'],'改进、表达与收入线索相连，需要需求和成本检验。'),
  ];
  const diseases=[
    rule('xiaoshi','偏印制食神',['偏印','食神'],true,['正财','偏财'],'准备与产出有制约；不能混称正印克伤官为枭神夺食。'),
    rule('shangguan','伤官与正官相碍',['伤官','正官'],true,['正印','偏印','正财','偏财'],'个人表达与既有评价标准可能有摩擦，优先核对协调路径。'),
    rule('caiyin','财印相碍',['正财','正印'],n.weak,['正官','七杀','比肩','劫财'],'资源投入可能牵动原有支持；财为药时不能反判坏印。'),
    rule('jiecai','比劫与财争用',['劫财','正财'],n.strong,['正官','七杀','食神','伤官'],'须先有身旺比劫争财前提；身弱时比劫可能助身任财，不能仅因比劫财同见就定争财用制泄。'),
    rule('hunza','官杀并透',['正官','七杀'],true,['食神','正印','偏印'],'不同标准与责任可能同时出现，不能凭官杀数量断婚姻次数。'),
    rule('shawu','七杀缺少显性制化',['七杀'],n.weak,['食神','正印','偏印'],'压力线索突出，支持与权限应先到位，不直接预测灾祸。'),
    rule('caiduo','财星有根、承接需辨',['偏财'],n.weak,[],'财务机会与投入负担须分开看，优先控制承接规模。'),
    rule('yinzhong','印星生扶与身旺叠加',['正印'],n.strong,['正财','偏财','食神','伤官'],'支持增加不一定带来行动，宜让学习转为交付。'),
    rule('yinweak','七杀有根而印未稳',['七杀'],n.weak&&has('正印').length>0&&!active('正印'),[],'印星虽见，但支持未稳，不能按完整杀印相生论。'),
    {...rule('renwu','羊刃待制泄',[],n.base==='羊刃格',['七杀','食神','伤官'],'同类力量需要约束或产出渠道，不作伤灾判断。'),...(n.base==='羊刃格'?{evidence:n.baseEvidence}:{status:'absent' as const})},
  ];
  const relevant=mechanisms.filter(x=>x.status==='supported');
  const breaking=diseases.filter(x=>x.status==='supported');
  return {base:n.base,secondary:n.secondary,baseEvidence:n.baseEvidence,mechanisms,diseases,status:relevant.length&&!breaking.length?'成格配合条件较齐':breaking.length?'存在受阻条件，需辨救应':'格名已取，成败仍有未定条件',summary:relevant.length?relevant.map(x=>x.name).join('、')+'的本轮条件得到支持；仍不把结构直接等同现实成就。':breaking.length?breaking.map(x=>x.name).join('、')+'是当前重点，不能只凭格名判断发展好坏。':'暂未形成清楚的成格链条；按具体透藏与岁运新增条件解读。'};
}
