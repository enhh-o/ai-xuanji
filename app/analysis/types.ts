export type Element = '木'|'火'|'土'|'金'|'水';
export type Status = 'supported'|'candidate'|'rejected'|'absent';
export type Decision = {id:string;name:string;status:Status;summary:string;evidence:string[];against:string[];elements:Element[]};
export type LocalInput = {pillars:string[];gender:'男'|'女';birthDate:string;asOf:string;horizon:number;monthPhase?:string;hiddenStems?:string[];fortunes:{pillar:string;startsAt:string;endsAt:string}[]};
export type Node = {id:string;stem:string;god:string;element:Element;pillar:number;layer:'stem'|'hidden';depth:number;branch:string;disturbed:boolean};
export type Relation = {id:string;name:string;nodes:string[];positions:number[];layer:'stem'|'branch';element?:Element};
export type Profile = {stem:string;god:string;element:Element;exposed:Node[];roots:Node[];sameElementRoots:Node[];stable:boolean;tied:boolean;seasonal:boolean};
export type Facts = {pillars:string[];day:string;nodes:Node[];profiles:Profile[];relations:Relation[];support:Element[]};
