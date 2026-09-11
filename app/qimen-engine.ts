import {Solar} from 'lunar-javascript';

export type QimenElement = '木'|'火'|'土'|'金'|'水';
export type QimenPalace = {
  id:number; name:string; direction:string; element:QimenElement;
  earthStem:string; heavenStem:string|null; star:string|null; door:string|null; deity:string|null;
  guestStem?:string; guestStar?:string;
};
const STEMS='甲乙丙丁戊己庚辛壬癸', BRANCHES='子丑寅卯辰巳午未申酉戌亥';
const cycle=Array.from({length:60},(_,i)=>STEMS[i%10]+BRANCHES[i%12]);
const ring=[1,8,3,4,9,2,7,6];
const display=[4,9,2,3,5,7,8,1,6];
const names=['','坎一宫','坤二宫','震三宫','巽四宫','中五宫','乾六宫','兑七宫','艮八宫','离九宫'];
const directions=['','北','西南','东','东南','中央','西北','西','东北','南'];
const elements:QimenElement[]=['土','水','土','木','木','土','金','金','土','火'];
const stars=['','天蓬','天芮','天冲','天辅','天禽','天心','天柱','天任','天英'];
const doors=['','休门','死门','伤门','杜门','','开门','惊门','生门','景门'];
const deities=['值符','腾蛇','太阴','六合','白虎','玄武','九地','九天'];
const terms=['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪'];
const juTable=['174','285','396','852','963','174','396','417','528','417','528','639','936','825','714','258','147','936','714','693','582','693','582','471'];
const mod=(n:number,d:number)=>((n%d)+d)%d;
const host=(id:number)=>id===5?2:id;

/** 时家转盘。宫号与数组显示顺序分开；中宫寄干明确输出，不造第九门。 */
export function layoutQimen(hourPillar:string,ju:number,yang:boolean){
  const hourIndex=cycle.indexOf(hourPillar);
  if(hourIndex<0 || !Number.isInteger(ju) || ju<1 || ju>9)throw new Error('奇门干支或局数无效');
  const direction=yang?1:-1;
  const earth=Array<string>(10).fill('');
  [...'戊己庚辛壬癸丁丙乙'].forEach((stem,i)=>{earth[mod(ju-1+direction*i,9)+1]=stem;});
  const hiddenJia='戊己庚辛壬癸'[Math.floor(hourIndex/10)];
  const xunHead=cycle[Math.floor(hourIndex/10)*10];
  const source=earth.indexOf(hiddenJia);
  const effective=hourPillar[0]==='甲'?hiddenJia:hourPillar[0];
  const target=earth.indexOf(effective);
  const sourceRing=ring.indexOf(host(source)),targetRing=ring.indexOf(host(target));
  const rawDoorTarget=mod(source-1+direction*(hourIndex%10),9)+1;
  const doorTarget=host(rawDoorTarget),doorRing=ring.indexOf(doorTarget);
  const byId=new Map<number,QimenPalace>();
  for(let step=0;step<8;step++){
    const id=ring[mod(targetRing+step,8)],origin=ring[mod(sourceRing+step,8)];
    byId.set(id,{id,name:names[id],direction:directions[id],element:elements[id],earthStem:earth[id],heavenStem:earth[origin],star:stars[origin],door:null,deity:null,
      ...(origin===2?{guestStem:earth[5],guestStar:'天禽'}:{})});
  }
  for(let step=0;step<8;step++){
    byId.get(ring[mod(doorRing+step,8)])!.door=doors[ring[mod(sourceRing+step,8)]];
    byId.get(ring[mod(targetRing+direction*step,8)])!.deity=deities[step];
  }
  byId.set(5,{id:5,name:names[5],direction:'中央',element:'土',earthStem:earth[5],heavenStem:null,star:null,door:null,deity:null});
  return {ju,yang,xunHead,hiddenJia,chiefStar:stars[source],chiefDoor:doors[host(source)],chiefStarPalace:host(target),chiefDoorPalace:doorTarget,
    chiefStarInCenter:target===5,chiefDoorInCenter:rawDoorTarget===5,
    guestPalace:[...byId.values()].find(p=>p.guestStar==='天禽')!.id,palaces:display.map(id=>byId.get(id)!)};
}

function parseSolar(date:string,time:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new Error('请输入完整出生日期与时间');
  const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1900||y>2100||m<1||m>12||d<1||d>days[m-1]||h>23||min>59)throw new Error('奇门首版支持1900—2100年的有效日期与00:00—23:59时间');
  return Solar.fromYmdHms(y,m,d,h,min,0);
}

export type QimenInput={date:string;time:string;standardDate:string;standardTime:string};
export function calculateQimen(input:QimenInput){
  const local=parseSolar(input.date,input.time).getLunar();
  const standard=parseSolar(input.standardDate,input.standardTime).getLunar();
  const previousTerm=standard.getPrevJieQi();
  const term=previousTerm.getName();
  const termIndex=terms.indexOf(term);
  if(termIndex<0)throw new Error('节气资料未识别，暂不生成奇门盘');
  // 年月以物理交节时刻，日时以真太阳时子初换日；两种时间不混比。
  const pillars=[standard.getYearInGanZhiExact(),standard.getMonthInGanZhiExact(),local.getDayInGanZhiExact(),local.getTimeInGanZhi()] as [string,string,string,string];
  const dayIndex=cycle.indexOf(pillars[2]);
  const fuTou=cycle[dayIndex-dayIndex%5];
  const yuanIndex='子午卯酉'.includes(fuTou[1])?0:'寅申巳亥'.includes(fuTou[1])?1:2;
  const ju=Number(juTable[termIndex][yuanIndex]);
  return {...layoutQimen(pillars[3],ju,termIndex<12),pillars,term,fuTou,yuan:['上元','中元','下元'][yuanIndex],
    termAt:previousTerm.getSolar().toYmdHms(),date:input.date,time:input.time,standardDate:input.standardDate,standardTime:input.standardTime,
    method:'时家转盘 · 拆补（甲己符头） · 中宫寄坤',purpose:'birth' as const};
}
export type QimenChart=ReturnType<typeof calculateQimen>;
