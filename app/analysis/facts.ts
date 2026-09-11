import type {Element,Facts,LocalInput,Node,Relation} from './types';
export const stems=[...'甲乙丙丁戊己庚辛壬癸'];
export const branches=[...'子丑寅卯辰巳午未申酉戌亥'];
export const elements:Record<string,Element>={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水',子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
export const hidden:Record<string,string>={子:'癸',丑:'己癸辛',寅:'甲丙戊',卯:'乙',辰:'戊乙癸',巳:'丙戊庚',午:'丁己',未:'己丁乙',申:'庚壬戊',酉:'辛',戌:'戊辛丁',亥:'壬甲'};
export const produces:Record<Element,Element>={木:'火',火:'土',土:'金',金:'水',水:'木'};
export const controls:Record<Element,Element>={木:'土',土:'水',水:'火',火:'金',金:'木'};
export const combinations:Record<string,Element>={甲己:'土',乙庚:'金',丙辛:'水',丁壬:'木',戊癸:'火'};
export const clash=(a:string,b:string)=>['子午','丑未','寅申','卯酉','辰戌','巳亥'].some(p=>p.includes(a)&&p.includes(b)&&a!==b);
export const pair=(a:string,b:string)=>[a,b].sort((x,y)=>stems.indexOf(x)-stems.indexOf(y)).join('');
export const combines=(a:string,b:string)=>Boolean(combinations[pair(a,b)]);
export function god(day:string,s:string){const a=elements[day],b=elements[s],same=stems.indexOf(day)%2===stems.indexOf(s)%2;return a===b?(same?'比肩':'劫财'):produces[a]===b?(same?'食神':'伤官'):controls[a]===b?(same?'偏财':'正财'):controls[b]===a?(same?'七杀':'正官'):(same?'偏印':'正印');}
export function branchRelations(a:string,b:string){
  const has=(pairs:string[])=>a!==b&&pairs.some(p=>p.includes(a)&&p.includes(b));
  const out:string[]=[];
  if(clash(a,b))out.push('冲');
  if(has(['子丑','寅亥','卯戌','辰酉','巳申','午未']))out.push('六合');
  if(has(['子未','丑午','寅巳','卯辰','申亥','酉戌']))out.push('害');
  if(has(['子酉','丑辰','寅亥','卯午','巳申','未戌']))out.push('破');
  if(has(['子卯','寅巳','巳申','寅申','丑戌','戌未','丑未']))out.push('刑');
  if(a===b&&'辰午酉亥'.includes(a))out.push('自刑');
  return out;
}
export function buildFacts(input:LocalInput,extra:string[]=[]):Facts{
  if(input.pillars.length!==4||input.pillars.some(p=>p.length!==2||!stems.includes(p[0])||!branches.includes(p[1])||stems.indexOf(p[0])%2!==branches.indexOf(p[1])%2))throw Error('四柱格式不正确，请重新排盘');
  const pillars=[...input.pillars,...extra];
  if(extra.some(p=>p.length!==2||!stems.includes(p[0])||!branches.includes(p[1])||stems.indexOf(p[0])%2!==branches.indexOf(p[1])%2))throw Error('岁运干支格式不正确');
  const day=input.pillars[2][0],nodes:Node[]=[],relations:Relation[]=[];
  pillars.forEach((p,i)=>{
    const disturbed=pillars.some((q,j)=>j!==i&&clash(p[1],q[1]));
    const add=(stem:string,layer:'stem'|'hidden',depth:number)=>nodes.push({id:i+'-'+layer+'-'+depth,stem,god:god(day,stem),element:elements[stem],pillar:i,layer,depth,branch:p[1],disturbed});
    add(p[0],'stem',0);[...(input.hiddenStems?.[i]||hidden[p[1]])].forEach((s,d)=>add(s,'hidden',d));
  });
  for(let i=0;i<pillars.length;i++)for(let j=i+1;j<pillars.length;j++){
    const a=pillars[i],b=pillars[j],el=combinations[pair(a[0],b[0])];
    if(el)relations.push({id:'stem-'+i+'-'+j,name:a[0]+b[0]+'五合',positions:[i,j],layer:'stem',nodes:[i+'-stem-0',j+'-stem-0'],element:el});
    for(const name of branchRelations(a[1],b[1]))relations.push({id:'branch-'+i+'-'+j+'-'+name,name:a[1]+b[1]+name,positions:[i,j],layer:'branch',nodes:nodes.filter(n=>n.layer==='hidden'&&[i,j].includes(n.pillar)).map(n=>n.id)});
  }
  for(const [set,name,element] of [['申子辰','三合','水'],['亥卯未','三合','木'],['寅午戌','三合','火'],['巳酉丑','三合','金'],['亥子丑','三会','水'],['寅卯辰','三会','木'],['巳午未','三会','火'],['申酉戌','三会','金']]){
    const positions=pillars.flatMap((p,i)=>set.includes(p[1])?[i]:[]);
    if([...set].every(b=>pillars.some(p=>p[1]===b)))relations.push({id:set,name:set+name+'（未直接判化）',positions,layer:'branch',element:element as Element,nodes:nodes.filter(n=>n.layer==='hidden'&&positions.includes(n.pillar)).map(n=>n.id)});
  }
  const profiles=stems.map(stem=>{
    const exposed=nodes.filter(n=>n.layer==='stem'&&n.pillar!==2&&n.stem===stem),roots=nodes.filter(n=>n.layer==='hidden'&&n.stem===stem);
    // 只把多方争合作为本轮作用待辨门槛；单一五合不等于已经合绊或合化。
    const sameElementRoots=nodes.filter(n=>n.layer==='hidden'&&n.stem!==stem&&n.element===elements[stem]);
    const tied=exposed.some(n=>relations.filter(r=>r.layer==='stem'&&r.nodes.includes(n.id)).length>1);
    return {stem,god:god(day,stem),element:elements[stem],exposed,roots,sameElementRoots,stable:exposed.length>0&&[...roots,...sameElementRoots].some(n=>!n.disturbed)&&!tied,tied,seasonal:nodes.some(n=>n.layer==='hidden'&&n.pillar===1&&n.depth===0&&n.stem===stem)};
  });
  const resource=(Object.keys(produces) as Element[]).find(e=>produces[e]===elements[day])!;
  return {pillars,day,nodes,profiles,relations,support:[elements[day],resource]};
}
export function nodeText(n:Node){return ['年柱','月柱','日柱','时柱','大运','流年'][n.pillar]+(n.layer==='stem'?n.stem:n.branch+'藏'+n.stem+'（'+['本气','中气','余气'][n.depth]+'）')+'为'+n.god+(n.layer==='hidden'&&n.disturbed?'，根气受冲但未直接判拔根':'');}
