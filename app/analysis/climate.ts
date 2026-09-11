import {climateTable} from './climate-data';
import type {Facts,Decision} from './types';
import type {assessNatal} from './natal';
export function assessClimate(f:Facts,n:ReturnType<typeof assessNatal>,special:Decision[]){
  const key=f.day+f.pillars[1][1],source=climateTable[key];
  const entries=source.stems.map(stem=>{const p=f.profiles.find(x=>x.stem===stem)!;return {stem,element:p.element,available:p.stable,presence:p.exposed.length?'透出':p.roots.length?'暗藏':'原局未见',evidence:[...p.exposed,...p.roots,...(p.exposed.length?p.sameElementRoots:[])].map(x=>x.id),reason:p.stable?'透出且有未受直接六冲的同干或同五行根气':p.tied?'参与五合，作用待辨':p.roots.some(x=>x.disturbed)?'藏根受冲，未直接判失效':'尚不构成稳定透根配合'};});
  const sourceConflict=['戊午','辛亥','壬卯','壬午','甲未','乙午','乙酉','壬丑','癸未'].includes(key);
  const completeClimate=f.relations.some(r=>(r.name.includes('三会')||r.name.includes('三合'))&&['火','水'].includes(r.element||'')&&((r.element==='火'&&'巳午未'.includes(f.pillars[1][1]))||(r.element==='水'&&'亥子丑'.includes(f.pillars[1][1]))));
  const exceptions=[
    {name:'身极弱不从时先保支撑',active:n.strength==='偏弱'&&!special.some(s=>s.id==='from'&&s.status==='candidate')},
    {name:'从势路线未定，不以调候覆盖',active:special.some(s=>s.id==='from'&&s.status==='candidate')},
    {name:'专旺路线未定，不以调候覆盖',active:special.some(s=>s.id==='zhuanwang'&&s.status==='candidate')},
    {name:'化气条件未定，不以调候覆盖',active:special.some(s=>s.id==='huaqi'&&s.status==='candidate')},
    {name:'首选调候神未具备稳定透根条件',active:!entries[0]?.available},
  ];
  const override=completeClimate&&!exceptions.some(e=>e.active)&&!sourceConflict;
  return {key,verified:false,source:'yueyuan v1.8 / mingli_rules.py / TIAO_HOU',note:source.note,sourceConflict,entries,exceptions,override,summary:'此日主与月令的专项参考为'+source.stems.join('、')+'。'+(sourceConflict?'本条存在顺序、注释或月内分段差异，不直接据首项定用神。':override?'局中季节与完整会合同时支持寒暖偏向，且首选神具备条件，调候列为优先参考。':'目前以格局和扶抑为主，调候作为条件参考。')+'表格尚待经典逐条核对，不代表已经定出的喜忌。'};
}
