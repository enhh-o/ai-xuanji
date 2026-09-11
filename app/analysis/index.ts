import {compareStages} from './transitions';
import type {LocalInput} from './types';
import {buildFacts} from './facts';
import {assessNatal,specialCandidates} from './natal';
import {assessPatterns} from './patterns';
import {assessClimate} from './climate';
import {assessUseful} from './useful';
import {assessTiming} from './timing';
import {assessDomains} from './domains';
import {reviewAdded} from './fortune';
export {climateTable} from './climate-data';
export function analyzeLocal(input:LocalInput){
  const canonical=JSON.stringify({pillars:input.pillars,gender:input.gender,birthDate:input.birthDate,asOf:input.asOf,horizon:input.horizon,hiddenStems:input.hiddenStems,fortunes:input.fortunes});
  // 用于追踪同一输入版本，不作为加密、匿名化或安全凭证。
  let digest=2166136261;for(const ch of canonical)digest=Math.imul(digest^ch.charCodeAt(0),16777619)>>>0;
  const facts=buildFacts(input),natal=assessNatal(facts,input),pattern=assessPatterns(facts,natal),special=specialCandidates(facts,natal,pattern.mechanisms),climate=assessClimate(facts,natal,special),useful=assessUseful(facts,natal,pattern,climate,special),timing=assessTiming(facts,useful,input);
  const fortunes=input.fortunes.map(s=>({...s,...reviewAdded(input,[s.pillar],pattern,useful)}));
  const transitions=compareStages(input,fortunes,useful);
  return {version:'local-2026-09-07',inputFingerprint:digest.toString(16),calculatedFor:input.asOf,facts,natal,pattern,special,climate,useful,timing,fortunes,transitions,domains:assessDomains(facts,natal,pattern,useful,timing,input.gender),limits:['这是传统命理规则的可追溯解释，不是经过科学验证的人生预测。','旺衰采用月令本气、透藏与根气的定性条件；人元司令逐日分野、复杂制化强度尚未完整覆盖。','调候表保留原资料待核对状态；特殊格局只列候选，不自动翻转喜忌。','岁运窗口是规则触发的观察期，不等同必然升职、结婚或破财。','本模块目前复核八字；紫微作为本命盘面补充，不伪称已完成两套体系的统一裁决。']};
}
export type LocalReport=ReturnType<typeof analyzeLocal>;
