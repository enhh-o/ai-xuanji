import type {LocalReport} from './analysis';
export const yearLabels={career:'事业',relationship:'感情',overall:'综合变化'};
export function fortuneYears(timing:LocalReport['timing'],fortune:{pillar:string;startsAt:string;endsAt:string}){
 const groups=new Map<number,{year:number;pillar:string;labels:string[];windows:LocalReport['timing'][number]['windows']}>();
 for(const row of timing){
  if(row.fortune!==fortune.pillar||row.startsAt<fortune.startsAt||row.startsAt>=fortune.endsAt)continue;
  for(const window of row.windows){
   const group=groups.get(window.year)||{year:window.year,pillar:window.pillar,labels:[],windows:[]};
   group.windows.push(window);const label=yearLabels[window.kind];if(!group.labels.includes(label))group.labels.push(label);
   groups.set(window.year,group);
  }
 }
 return [...groups.values()].sort((a,b)=>a.year-b.year);
}
