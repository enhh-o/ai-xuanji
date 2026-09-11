import type {QimenChart,QimenElement} from './qimen-engine';

const doorMeaning:Record<string,[QimenElement,string,string]>={
  休门:['水','休整、交流与蓄力','先留出恢复和沟通空间，再决定投入节奏'],
  生门:['土','积累、经营与资源增长','把资源投入拆成小步，检查实际收益和持续成本'],
  伤门:['木','行动、竞争与边界摩擦','行动前明确边界和反馈方式，避免把速度当成唯一目标'],
  杜门:['木','收敛、专业钻研与信息边界','适合先补齐资料与技能，同时检查是否过度封闭'],
  景门:['火','表达、呈现与可见度','用作品和事实支撑表达，检查承诺与交付是否一致'],
  死门:['土','停顿、收尾与固化','复盘低效安排，分清值得坚持的部分与需要结束的部分'],
  惊门:['金','声音、争议与警觉','把担忧写成可核对的问题，沟通时先澄清事实'],
  开门:['金','开拓、组织与对外连接','明确合作目标、责任和验收条件，再扩大行动范围'],
};
const starMeaning:Record<string,string>={天蓬:'探索、流动与冒险的象征',天芮:'学习、问题检查与修正的象征，不据此判断疾病',天冲:'启动、执行与推动变化的象征',天辅:'学习、规划与协助的象征',天禽:'居中协调与统摄的象征，随天芮寄宫',天心:'判断、规则与解决问题的象征',天柱:'表达、分歧与结构约束的象征',天任:'承担、积累与持续执行的象征',天英:'呈现、热情与注意力的象征'};
const deityMeaning:Record<string,string>={值符:'统筹、秩序与主导的象征',腾蛇:'联想、疑虑与复杂感受的象征',太阴:'细致、隐性支持与内部筹划的象征',六合:'协作、连接与协调的象征',白虎:'力度、冲突与压力的象征，不据此断伤灾',玄武:'隐情、流动与信息不对称的象征，不据此指认欺骗',九地:'沉稳、承载与渐进积累的象征',九天:'扩展、远景与向外行动的象征'};
const palaceMeaning:Record<number,string>={1:'坎属水，以流动、思考和未知环境为象',2:'坤属土，以承载、配合和资源容纳为象',3:'震属木，以启动、行动和变化为象',4:'巽属木，以沟通、进入和逐步推进为象',5:'中宫属土，是全盘寄宫关系的枢纽',6:'乾属金，以规则、主导和结构为象',7:'兑属金，以表达、交换和反馈为象',8:'艮属土，以边界、停止和积累为象',9:'离属火，以呈现、辨识和可见度为象'};
const generates:Record<QimenElement,QimenElement>={木:'火',火:'土',土:'金',金:'水',水:'木'};
const controls:Record<QimenElement,QimenElement>={木:'土',土:'水',水:'火',火:'金',金:'木'};

export function explainQimenPalace(chart:QimenChart,id:number){
  const palace=chart.palaces.find(p=>p.id===id);
  if(!palace)throw new Error('请选择九宫内的宫位');
  const host=chart.palaces.find(p=>p.id===chart.guestPalace)!;
  if(id===5)return {title:palace.name,summary:`中宫地盘${palace.earthStem}，天禽与该干寄于${host.name}，随天芮一同转动。中宫不另设八门、八神。`,
    evidence:[`中宫地盘干：${palace.earthStem}`,`天禽寄宫：${host.name}，该宫门为${host.door}`],
    terms:[{label:'宫位含义',text:palaceMeaning[5]},{label:'寄宫是什么意思',text:'转盘围绕外圈八宫旋转，中宫的信息通过寄宫保留，并非缺失，也不是额外增加一个门。'}],
    relation:'需连同寄宫查看，不能只对中宫独立作断。',advice:`点击${host.name}查看天禽、寄干与门星神的共同配置。`};
  const [doorElement,meaning,advice]=doorMeaning[palace.door!];
  let relation='门宫比和：门与宫五行相同，表示同类作用叠加，也需考虑是否重复或过量。';
  if(controls[doorElement]===palace.element)relation='门迫：门的五行克宫，象征行动方式与环境约束之间有摩擦；不能仅凭此项断凶。';
  else if(controls[palace.element]===doorElement)relation='宫克门：宫的五行克门，象征环境对行动方式有所约束，先检查资源和权限。';
  else if(generates[doorElement]===palace.element)relation='门生宫：门的五行生宫，可理解为行动向环境投入，需要留意自身投入成本。';
  else if(generates[palace.element]===doorElement)relation='宫生门：宫的五行生门，可理解为环境支持行动；仍需核对现实条件是否具备。';
  const evidence=[`${palace.name} · ${palace.direction} · 属${palace.element}`,`天盘${palace.heavenStem} / 地盘${palace.earthStem}`,`${palace.star}${palace.guestStar?'、'+palace.guestStar:''} · ${palace.door}（${doorElement}） · ${palace.deity}`];
  if(palace.guestStem)evidence.push(`天禽携中宫${palace.guestStem}寄入本宫`);
  if(chart.chiefStarPalace===id)evidence.push(`值符星${chart.chiefStar}落本宫`);
  if(chart.chiefDoorPalace===id)evidence.push(`值使门${chart.chiefDoor}落本宫`);
  return {title:palace.name,summary:`${palace.name}见${palace.door}、${palace.star}${palace.guestStar?'与天禽':''}、${palace.deity}，天盘${palace.heavenStem}临地盘${palace.earthStem}。本宫先从“${meaning}”理解，再结合门宫关系核对。`,evidence,relation,advice:advice+'。这些是反思线索，不能由出生局推出具体事件必然发生。',
    terms:[{label:'宫位含义',text:palaceMeaning[id]+'；方位为盘面方位，不是迁居或摆放指令。'},{label:palace.door!,text:meaning+'；门名是传统术语，不按字面判人生吉凶。'},{label:palace.star!,text:starMeaning[palace.star!]},{label:palace.deity!,text:deityMeaning[palace.deity!]},{label:'天盘干 / 地盘干',text:`本宫${palace.heavenStem}临${palace.earthStem}：分别记录转动后的天盘与固定地盘。首版列出事实，不把全部十干克应解释为已验证结论。`}]};
}
