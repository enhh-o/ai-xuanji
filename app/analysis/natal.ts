import type {Facts,LocalInput,Decision} from './types';
import {elements,combines} from './facts';
export function assessNatal(f:Facts,input:LocalInput){
  const month=f.nodes.find(n=>n.pillar===1&&n.layer==='hidden'&&n.depth===0)!;
  const own=f.nodes.filter(n=>n.layer==='hidden'&&n.element===elements[f.day]);
  const deep=own.filter(n=>n.depth===0&&!n.disturbed);
  const support=f.profiles.filter(p=>f.support.includes(p.element)&&p.stable);
  const pressure=f.profiles.filter(p=>!f.support.includes(p.element)&&p.stable);
  const seasonalSupport=f.support.includes(month.element);
  const disturbed=own.some(n=>n.disturbed);
  let strength='中和',weak=false,strong=false;
  if(!seasonalSupport&&!own.length&&!support.length){strength='偏弱';weak=true;}
  else if(!seasonalSupport&&!deep.length){strength='中和偏弱';weak=true;}
  else if(seasonalSupport&&deep.length&&!disturbed&&(support.length||(month.element===elements[f.day]&&!pressure.length))){strength=pressure.length?'中和偏旺':'偏旺';strong=true;}
  else if(!seasonalSupport&&deep.length&&support.length){strength='中和';}
  else if(seasonalSupport&&!deep.length){strength='中和偏弱';weak=true;}
  const evidence=[month.id,...own.map(n=>n.id),...support.flatMap(p=>p.exposed.map(n=>n.id)),...pressure.flatMap(p=>p.exposed.map(n=>n.id))];
  const summary=(seasonalSupport?'月令有生扶背景':'月令偏向泄耗或制约')+'；'+(deep.length?'有未受直接六冲的本气支持':own.length?'同类根气存在，但本气或稳定性有限':'地支未见同类根气')+'；'+(support.length?'天干另有带根生扶':'天干未见明确带根生扶')+'。综合暂定为'+strength+'。';
  const monthHidden=f.nodes.filter(n=>n.pillar===1&&n.layer==='hidden');
  const exposed=monthHidden.filter(n=>f.profiles.find(p=>p.stem===n.stem)!.exposed.length);
  const baseNode=exposed[0]||month;
  const lu:Record<string,string>={甲:'寅',乙:'卯',丙:'巳',丁:'午',戊:'巳',己:'午',庚:'申',辛:'酉',壬:'亥',癸:'子'};
  const blade:Record<string,string>={甲:'卯',丙:'午',戊:'午',庚:'酉',壬:'子'};
  const base=lu[f.day]===input.pillars[1][1]?'建禄格':blade[f.day]===input.pillars[1][1]?'羊刃格':baseNode.god+'格';
  const counter=disturbed?['同类根受冲，未量化其损伤，强弱程度仍需保留。']:[];
  if(pressure.length&&support.length)counter.push('透干生扶和制耗并存，需要结合制化，不可仅按存在与否计票。');
  return {strength,weak,strong,summary,evidence,against:counter,base,baseEvidence:[baseNode.id],secondary:exposed.slice(1).map(n=>n.god),seasonalSupport,deepRoots:deep.length>0};
}
export function specialCandidates(f:Facts,n:ReturnType<typeof assessNatal>,mechanisms:Decision[]){
  const out:Decision[]=[];
  const effectiveHelp=f.profiles.filter(p=>p.stable&&f.support.includes(p.element));
  // 受冲根仍是反证：没有拔根裁决时，不能先删根再宣称无根从势。
  const selfRoots=f.nodes.filter(x=>x.layer==='hidden'&&x.element===elements[f.day]);
  const rescue=mechanisms.some(m=>['shizhi','shayin','peiyin'].includes(m.id)&&m.status==='supported');
  if(n.weak&&!n.deepRoots&&!effectiveHelp.length){out.push({id:'from',name:'普通身弱与从势辨别',status:rescue||selfRoots.length?'rejected':'candidate',summary:rescue?'有带根制化自救，不直接判从。':selfRoots.length?'仍保留同类根（含受冲根），本轮不能直接确定从势。':'有从势嫌疑；根气实际抵抗、制化自救与气势纯度未全部确定，保留普通身弱路线。',evidence:n.evidence,against:rescue?mechanisms.filter(m=>m.status==='supported').map(m=>m.name):['不能以无本气根单独定从'],elements:[]});}
  if(n.strong&&!f.profiles.some(p=>p.stable&&!f.support.includes(p.element))){out.push({id:'zhuanwang',name:'普通身旺与专旺辨别',status:f.nodes.some(x=>x.layer==='hidden'&&!f.support.includes(x.element))?'rejected':'candidate',summary:'专旺要求气势纯粹；有异类根不能直接套顺旺取用。',evidence:n.evidence,against:['专旺不与从势共用喜忌翻转规则'],elements:[]});}
  const matches=f.profiles.filter(p=>p.exposed.length&&combines(f.day,p.stem));
  if(matches.length)out.push({id:'huaqi',name:'日主合化复核',status:'candidate',summary:'日主参与五合，只确认相合；化神当令成局、无强根及无破化尚需逐项确认，当前不改日主五行。',evidence:matches.flatMap(p=>p.exposed.map(x=>x.id)),against:selfRoots.length?['日主仍有同类根（受冲不直接删根），构成不化的反向条件']:['未因五合直接认定成化'],elements:[]});
  return out;
}
