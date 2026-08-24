"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { provinces } from "./china-cities";
import { calculateAnnualPillar, calculateBazi, solarFromLunarDate, type EngineBazi } from "./bazi-engine";

type Gender = "男" | "女";
type CalendarKind = "solar" | "lunar";
type ElementName = "木" | "火" | "土" | "金" | "水";
type TurningKind = "overall" | "career" | "relationship";
type RelationTone = "support" | "tension" | "neutral";
type RelationItem = {
  leftLabel: string;
  left: string;
  rightLabel: string;
  right: string;
  relation: string;
  meaning: string;
  tone: RelationTone;
  structural?: boolean;
  leftIndex?: number;
  rightIndex?: number;
  layer?: "stem" | "branch";
};
type PalaceRelation = { target: Palace; relation: "三方" | "对宫"; tone: RelationTone; meaning: string };
type Palace = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  majorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
  minorStars: Array<{ name: string }>;
  adjectiveStars?: Array<{ name: string }>;
  changsheng12?: string;
  decadal?: { range?: [number, number] };
};
type Astrolabe = {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  fiveElementsClass?: string;
  soul?: string;
  body?: string;
  palaces: Palace[];
};

declare global {
  interface Window {
    iztro?: {
      astro: {
        bySolar: (
          date: string,
          timeIndex: number,
          gender: Gender,
          fixLeap?: boolean,
          language?: string,
        ) => Astrolabe;
        byLunar: (
          date: string,
          timeIndex: number,
          gender: Gender,
          isLeapMonth?: boolean,
          fixLeap?: boolean,
          language?: string,
        ) => Astrolabe;
      };
    };
  }
}

const fallbackPalaces: Palace[] = [
  ["命宫", "丙", "寅", "紫微", "天府"], ["父母", "丁", "卯", "天机", "太阴"],
  ["福德", "戊", "辰", "贪狼", ""], ["田宅", "己", "巳", "巨门", "天相"],
  ["官禄", "庚", "午", "天梁", ""], ["交友", "辛", "未", "七杀", ""],
  ["迁移", "壬", "申", "廉贞", "破军"], ["疾厄", "癸", "酉", "武曲", ""],
  ["财帛", "甲", "戌", "太阳", ""], ["子女", "乙", "亥", "天同", ""],
  ["夫妻", "丙", "子", "天机", ""], ["兄弟", "丁", "丑", "太阴", ""],
].map(([name, heavenlyStem, earthlyBranch, a, b], index) => ({
  name,
  heavenlyStem,
  earthlyBranch,
  isBodyPalace: index === 6,
  majorStars: [a, b].filter(Boolean).map((name) => ({ name, brightness: index % 3 === 0 ? "庙" : "旺" })),
  minorStars: [{ name: index % 2 ? "文曲" : "左辅" }],
  decadal: { range: [6 + index * 10, 15 + index * 10] },
}));

const elementOf: Record<string, ElementName> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  寅: "木", 卯: "木", 巳: "火", 午: "火", 辰: "土", 戌: "土", 丑: "土", 未: "土", 申: "金", 酉: "金", 亥: "水", 子: "水",
};
const produces: Record<ElementName, ElementName> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const controls: Record<ElementName, ElementName> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const labels: Record<ElementName, string> = { 木: "生发与规划", 火: "表达与行动", 土: "承载与秩序", 金: "决断与规则", 水: "洞察与流动" };
const elementClass: Record<ElementName, string> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };
const elementGuidance: Record<ElementName, { title: string; steps: [string, string, string] }> = {
  木: { title: "把成长变成路径", steps: ["制定90天学习或项目计划", "每周联系一位能交换信息的同行", "优先接有成长空间的任务" ] },
  火: { title: "让能力被看见", steps: ["每周至少做一次公开输出或成果汇报", "把重要请求当面说清而不只等对方猜", "用规律运动保持稳定行动力" ] },
  土: { title: "先稳住承载力", steps: ["做月度预算并保留应急金", "固定睡眠、饮食和复盘时间", "把反复任务写成清单和交付流程" ] },
  金: { title: "用规则减少内耗", steps: ["重要合作先写清责任、价格和截止日期", "用数据指标取代凭感觉反复摇摆", "每周删掉一项低价值承诺" ] },
  水: { title: "先获得信息与余地", steps: ["重大决定前安排一轮调研和反方验证", "预留现金和时间缓冲而不满负荷", "通过跨圈层或异地渠道补充新信息" ] },
};
const hiddenStem: Record<string, string> = { 子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙戊庚", 午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲" };
const stems = "甲乙丙丁戊己庚辛壬癸".split("");
const branches = "子丑寅卯辰巳午未申酉戌亥".split("");
const branchClashes: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
const branchHarmonies: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
const stemCombinationElements: Record<string, ElementName> = { 甲己: "土", 乙庚: "金", 丙辛: "水", 丁壬: "木", 戊癸: "火" };
const stemClashPairs = new Set(["甲庚", "乙辛", "丙壬", "丁癸"]);
const branchHarmPairs = new Set(["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]);
const branchBreakPairs = new Set(["子酉", "丑辰", "寅亥", "卯午", "巳申", "未戌"]);
const branchPunishmentPairs = new Set(["子卯", "寅巳", "寅申", "巳申", "丑未", "丑戌", "未戌"]);
const selfPunishmentBranches = new Set(["辰", "午", "酉", "亥"]);
const harmonyGroups: Array<{ members: string[]; element: ElementName }> = [
  { members: ["申", "子", "辰"], element: "水" }, { members: ["亥", "卯", "未"], element: "木" },
  { members: ["寅", "午", "戌"], element: "火" }, { members: ["巳", "酉", "丑"], element: "金" },
];
const meetingGroups: Array<{ members: string[]; element: ElementName }> = [
  { members: ["亥", "子", "丑"], element: "水" }, { members: ["寅", "卯", "辰"], element: "木" },
  { members: ["巳", "午", "未"], element: "火" }, { members: ["申", "酉", "戌"], element: "金" },
];
const pillarLabels = ["年柱", "月柱", "日柱", "时柱"];
const lunarYears = Array.from({ length: 201 }, (_, index) => 1900 + index);
const lunarMonths = Array.from({ length: 12 }, (_, index) => index + 1);
const lunarDays = Array.from({ length: 30 }, (_, index) => index + 1);
const ringPositions = [
  { col: 3, row: 4 }, { col: 2, row: 4 }, { col: 1, row: 4 }, { col: 1, row: 3 },
  { col: 1, row: 2 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 },
  { col: 4, row: 1 }, { col: 4, row: 2 }, { col: 4, row: 3 }, { col: 4, row: 4 },
];

function pad(value: number) { return String(value).padStart(2, "0"); }

function trueSolarTime(date: string, time: string, longitude: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const start = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - start) / 86400000);
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  const equation = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const correction = 4 * (longitude - 120) + equation;
  current.setUTCMinutes(current.getUTCMinutes() + correction);
  return {
    date: `${current.getUTCFullYear()}-${pad(current.getUTCMonth() + 1)}-${pad(current.getUTCDate())}`,
    time: `${pad(current.getUTCHours())}:${pad(current.getUTCMinutes())}`,
    minutes: Math.round(correction),
    longitude,
  };
}

function getTimeIndex(time: string) {
  const [hour] = time.split(":").map(Number);
  if (hour === 23) return 12;
  if (hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

function tenGod(dayStem: string, otherStem: string) {
  if (!elementOf[dayStem] || !elementOf[otherStem]) return "—";
  const dayEl = elementOf[dayStem];
  const otherEl = elementOf[otherStem];
  const samePolarity = stems.indexOf(dayStem) % 2 === stems.indexOf(otherStem) % 2;
  if (otherEl === dayEl) return samePolarity ? "比肩" : "劫财";
  if (produces[dayEl] === otherEl) return samePolarity ? "食神" : "伤官";
  if (controls[dayEl] === otherEl) return samePolarity ? "偏财" : "正财";
  if (controls[otherEl] === dayEl) return samePolarity ? "七杀" : "正官";
  return samePolarity ? "偏印" : "正印";
}

function orderedPair(left: string, right: string, order: string[]) {
  return [left, right].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("");
}

function elementRelationship(left: string, right: string) {
  const leftElement = elementOf[left] || "土";
  const rightElement = elementOf[right] || "土";
  if (leftElement === rightElement) return {
    relation: `${leftElement}气相同`,
    meaning: `${left}${leftElement}与${right}${rightElement}的做法相近，容易互相加强；好处是方向一致，过量时也会把同一种倾向一起放大。`,
    tone: "neutral" as RelationTone,
  };
  if (produces[leftElement] === rightElement) return {
    relation: `${left}${leftElement}生${right}${rightElement}`,
    meaning: `${left}${leftElement}像在给${right}${rightElement}提供燃料，前者往往多付出，后者更容易被推动和表现。`,
    tone: "support" as RelationTone,
  };
  if (produces[rightElement] === leftElement) return {
    relation: `${right}${rightElement}生${left}${leftElement}`,
    meaning: `${right}${rightElement}像在给${left}${leftElement}提供燃料，前者往往多付出，后者更容易被推动和表现。`,
    tone: "support" as RelationTone,
  };
  if (controls[leftElement] === rightElement) return {
    relation: `${left}${leftElement}克${right}${rightElement}`,
    meaning: `${left}${leftElement}会约束${right}${rightElement}。处理得当是规则与取舍，力度过大时则容易变成压力。`,
    tone: "tension" as RelationTone,
  };
  return {
    relation: `${right}${rightElement}克${left}${leftElement}`,
    meaning: `${right}${rightElement}会约束${left}${leftElement}。处理得当是规则与取舍，力度过大时则容易变成压力。`,
    tone: "tension" as RelationTone,
  };
}

function buildStemRelation(left: string, right: string, leftLabel: string, rightLabel: string): RelationItem {
  const pair = orderedPair(left, right, stems);
  const elemental = elementRelationship(left, right);
  const combinedElement = stemCombinationElements[pair];
  if (combinedElement) return {
    leftLabel, left, rightLabel, right,
    relation: `${pair}相合（合${combinedElement}）`,
    meaning: `${leftLabel}与${rightLabel}有互相牵引、协调的倾向。所谓“合${combinedElement}”只是可能的方向，是否真能化成${combinedElement}，还要看出生月份和周围五行；五行本身则是${elemental.relation}。`,
    tone: "support", structural: true,
  };
  if (stemClashPairs.has(pair)) return {
    leftLabel, left, rightLabel, right,
    relation: `${pair}相冲`,
    meaning: `${leftLabel}与${rightLabel}的做法容易拉扯，常表现为想法、节奏或规则不一致；这不等于一定冲突，关键是能否提前分清优先级。五行上是${elemental.relation}。`,
    tone: "tension", structural: true,
  };
  return { leftLabel, left, rightLabel, right, ...elemental };
}

function buildBranchRelation(left: string, right: string, leftLabel: string, rightLabel: string): RelationItem {
  const pair = orderedPair(left, right, branches);
  const elemental = elementRelationship(left, right);
  const details: Array<{ label: string; meaning: string; tone: RelationTone }> = [];
  if (branchHarmonies[left] === right) details.push({
    label: `${pair}六合`, tone: "support",
    meaning: "两处倾向容易互相配合，常通过合作、关系或现实安排被连接起来。",
  });
  if (branchClashes[left] === right) details.push({
    label: `${pair}相冲`, tone: "tension",
    meaning: "两处需求容易拉扯，现实中常表现为变化、移动，或原计划需要调整。",
  });
  if (branchHarmPairs.has(pair)) details.push({
    label: `${pair}相害`, tone: "tension",
    meaning: "表面未必正面冲突，但配合中容易有误解、顾虑或隐性消耗。",
  });
  if (branchBreakPairs.has(pair)) details.push({
    label: `${pair}相破`, tone: "tension",
    meaning: "原本的安排容易出现松动，适合提前把规则、交付和边界说清。",
  });
  if (branchPunishmentPairs.has(pair) || (left === right && selfPunishmentBranches.has(left))) details.push({
    label: `${pair}相刑`, tone: "tension",
    meaning: "急躁、较劲或重复同一种问题时，内耗容易增加，需要给决定留复核步骤。",
  });
  harmonyGroups.forEach((group) => {
    if (left !== right && group.members.includes(left) && group.members.includes(right)) details.push({
      label: `${pair}半合${group.element}`, tone: "support",
      meaning: `两支有往${group.element}聚合的倾向，但能否成形，还要看第三支和现实条件。`,
    });
  });
  meetingGroups.forEach((group) => {
    if (left !== right && group.members.includes(left) && group.members.includes(right)) details.push({
      label: `${pair}半会${group.element}`, tone: "support",
      meaning: `季节气势开始往${group.element}集中，但尚未凑齐三支，先看作倾向而不是定论。`,
    });
  });
  if (!details.length) return { leftLabel, left, rightLabel, right, ...elemental };
  const hasTension = details.some((item) => item.tone === "tension");
  return {
    leftLabel, left, rightLabel, right,
    relation: details.map((item) => item.label).join("、"),
    meaning: `${details.map((item) => item.meaning).join(" ")} 五行底层关系是${elemental.relation}。`,
    tone: hasTension ? "tension" : "support",
    structural: true,
  };
}

function buildBaziRelations(pillars: string[]) {
  const stemRelations: RelationItem[] = [];
  const branchRelations: RelationItem[] = [];
  pillars.forEach((pillar, leftIndex) => pillars.slice(leftIndex + 1).forEach((other, offset) => {
    const rightIndex = leftIndex + offset + 1;
    stemRelations.push({ ...buildStemRelation(pillar[0], other[0], `${pillarLabels[leftIndex]}天干`, `${pillarLabels[rightIndex]}天干`), leftIndex, rightIndex, layer: "stem" });
    branchRelations.push({ ...buildBranchRelation(pillar[1], other[1], `${pillarLabels[leftIndex]}地支`, `${pillarLabels[rightIndex]}地支`), leftIndex, rightIndex, layer: "branch" });
  }));
  const natalBranches = pillars.map((pillar) => pillar[1]);
  const completeGroups = [
    ...harmonyGroups.map((group) => ({ ...group, kind: "三合" as const })),
    ...meetingGroups.map((group) => ({ ...group, kind: "三会" as const })),
  ].filter((group) => group.members.every((branch) => natalBranches.includes(branch)));
  const completeGroupRelations: RelationItem[] = completeGroups.map((group) => {
    const indexes = group.members.map((branch) => natalBranches.indexOf(branch)).filter((index) => index >= 0);
    const leftIndex = Math.min(...indexes);
    const rightIndex = Math.max(...indexes);
    return {
      leftLabel: "原局地支",
      left: natalBranches[leftIndex],
      rightLabel: "原局地支",
      right: natalBranches[rightIndex],
      relation: `${group.members.join("")}${group.kind}${group.element}局`,
      meaning: `原局地支已凑齐${group.members.join("、")}，形成${group.kind}${group.element}局的结构信号。它说明${group.element}的主题更集中，但是否真正化成单一力量，仍须结合月令、透干与全盘制化，不能只凭成局断吉凶。`,
      tone: "support",
      structural: true,
      leftIndex,
      rightIndex,
      layer: "branch",
    };
  });
  const filteredBranchRelations = branchRelations.filter((item) => !completeGroups.some((group) => {
    const isSameGroupPair = group.members.includes(item.left) && group.members.includes(item.right);
    return isSameGroupPair && item.relation.includes(`半${group.kind.slice(1)}${group.element}`);
  }));
  const all = [...stemRelations, ...filteredBranchRelations, ...completeGroupRelations];
  const structural = all.filter((item) => item.structural);
  const tensions = structural.filter((item) => item.tone === "tension");
  const supports = structural.filter((item) => item.tone === "support");
  const summary = structural.length
    ? `本盘主要见${structural.length}组干支互动：${supports.length ? `${supports.length}组偏向牵引或配合` : "未见明显牵引结构"}，${tensions.length ? `${tensions.length}组带来冲突、反复或调整` : "未见明显冲突结构"}。关系本身不直接等同于吉凶，仍要结合旺衰与喜忌判断。`
    : "四柱之间没有明显的合、冲、刑、害、破或半合半会，主要看五行之间怎样相生、相克；这通常表示关系更偏日常积累，而不是强烈结构变化。";
  return { stemRelations, branchRelations: filteredBranchRelations, visualRelations: structural, summary };
}

function completedBranchGroupDetails(natalBranches: string[], fortuneBranch: string) {
  const present = new Set([...natalBranches, fortuneBranch]);
  return [
    ...harmonyGroups.filter((group) => group.members.includes(fortuneBranch) && group.members.every((branch) => present.has(branch))).map((group) => ({ ...group, kind: "三合" as const })),
    ...meetingGroups.filter((group) => group.members.includes(fortuneBranch) && group.members.every((branch) => present.has(branch))).map((group) => ({ ...group, kind: "三会" as const })),
  ];
}

function buildFortuneCompatibility(pillars: string[], fortunePillar: string, analysis: ReturnType<typeof buildAnalysis>) {
  const stemRelations = pillars.map((pillar, index) => ({ ...buildStemRelation(pillar[0], fortunePillar[0], `${pillarLabels[index]}天干`, "大运天干"), leftIndex: index, layer: "stem" as const }));
  const branchRelations = pillars.map((pillar, index) => ({ ...buildBranchRelation(pillar[1], fortunePillar[1], `${pillarLabels[index]}地支`, "大运地支"), leftIndex: index, layer: "branch" as const }));
  const completed = completedBranchGroupDetails(analysis.natalBranches, fortunePillar[1]);
  const structural = branchRelations.filter((item) => item.structural && !completed.some((group) => group.members.includes(item.left) && group.members.includes(fortunePillar[1]) && item.relation.includes(`半${group.kind.slice(1)}${group.element}`)));
  const completedRelations: RelationItem[] = completed.map((group) => {
    const natalMember = group.members.find((branch) => branch !== fortunePillar[1] && analysis.natalBranches.includes(branch)) || fortunePillar[1];
    const leftIndex = analysis.natalBranches.indexOf(natalMember);
    return {
      leftLabel: "原局地支",
      left: natalMember,
      rightLabel: "大运地支",
      right: fortunePillar[1],
      relation: `${group.members.join("")}${group.kind}${group.element}局`,
      meaning: `大运${fortunePillar[1]}加入后，原局已具的${group.members.filter((branch) => branch !== fortunePillar[1]).join("、")}与它凑齐${group.kind}${group.element}局。${group.element}主题会更集中，但成局不等于某件事必然发生，仍要看月令、透干、喜忌与现实条件。`,
      tone: "support",
      structural: true,
      leftIndex,
      layer: "branch",
    };
  });
  const fortuneGod = tenGod(analysis.dayStem, fortunePillar[0]);
  const fortuneElements = [elementOf[fortunePillar[0]] || "土", elementOf[fortunePillar[1]] || "土"];
  const helpful = fortuneElements.filter((element) => analysis.favorable.includes(element));
  const cautious = fortuneElements.filter((element) => analysis.avoid.includes(element));
  const balanceText = helpful.length && cautious.length
    ? `大运五行里既有对整体平衡较有帮助的${[...new Set(helpful)].join("、")}，也有需要控制用量的${[...new Set(cautious)].join("、")}，机会和压力往往同时出现。`
    : helpful.length ? `大运五行中的${[...new Set(helpful)].join("、")}较能帮助全盘回到平衡，但仍要靠具体选择落地。`
      : cautious.length ? `大运五行中的${[...new Set(cautious)].join("、")}容易把原有偏向继续放大，重大决定适合分步验证。`
        : "这步大运对五行平衡的推动不算单一，宜以实际事件检验。";
  const structuralNames = [...new Set(structural.map((item) => item.relation))];
  const structureText = structuralNames.length
    ? `地支较明显的互动是${structuralNames.join("；")}。`
    : "大运地支与出生八字没有明显合冲刑害破，影响更像缓慢叠加。";
  const groupText = completed.length ? `大运加入后还凑齐${completed.map((group) => `${group.members.join("")}${group.kind}${group.element}局`).join("、")}，相关五行主题会更集中，但能否形成稳定力量仍要看全盘强弱和现实条件。` : "大运没有额外凑齐完整的三合或三会。";
  const tensionCount = [...stemRelations, ...branchRelations].filter((item) => item.tone === "tension").length;
  const conclusion = tensionCount >= 4
    ? "共同来看，这一步的调整信号多于顺滑信号。适合把变化拆成小步骤，先核实合同、现金流、关系边界和身体承受度。"
    : "共同来看，这一步有可以借力的地方，也仍有需要校准的环节。先把目标说具体，再用阶段结果决定是否继续加码。";
  return {
    stemRelations, branchRelations, fortuneGod,
    visualRelations: [...stemRelations.filter((item) => item.structural), ...structural, ...completedRelations],
    summary: `大运天干${fortunePillar[0]}对日主${analysis.dayStem}来说是${fortuneGod}。${balanceText}${structureText}${groupText}${conclusion}`,
  };
}

function buildAnalysis(pillars: string[], engine?: EngineBazi) {
  const dayStem = pillars[2]?.[0] || "庚";
  const dayElement = elementOf[dayStem] || "金";
  const resource = (Object.keys(produces) as ElementName[]).find((key) => produces[key] === dayElement) || "土";
  const output = produces[dayElement];
  const wealth = controls[dayElement];
  const officer = (Object.keys(controls) as ElementName[]).find((key) => controls[key] === dayElement) || "水";
  const hidden = pillars.map((pillar, index) => engine?.hiddenStems[index] || hiddenStem[pillar[1]] || "");
  const monthElement = elementOf[pillars[1]?.[1]] || "土";
  const rootBranches = pillars.map((pillar, index) => ({ branch: pillar[1], hidden: hidden[index] }));
  const rootLocations = (target: ElementName) => rootBranches.flatMap((item, index) => [...new Set(item.hidden.split("").filter((stem) => elementOf[stem] === target))].map((stem) => `${pillarLabels[index]}${item.branch}藏${stem}`));
  const selfRootDetails = rootLocations(dayElement);
  const resourceRootDetails = rootLocations(resource);
  const supportStemDetails = pillars.flatMap((pillar, index) => index !== 2 && [dayElement, resource].includes(elementOf[pillar[0]] || "土") ? [`${pillarLabels[index]}${pillar[0]}`] : []);
  const pressureStemDetails = pillars.flatMap((pillar, index) => index !== 2 && [output, wealth, officer].includes(elementOf[pillar[0]] || "土") ? [`${pillarLabels[index]}${pillar[0]}`] : []);
  const hasSelfOrPeerRoot = selfRootDetails.length > 0;
  const hasResourceRoot = resourceRootDetails.length > 0;
  const hasSupportStem = supportStemDetails.length > 0;
  const hasPressureStem = pressureStemDetails.length > 0;
  const monthSupports = [dayElement, resource].includes(monthElement);
  const monthPressures = [output, wealth, officer].includes(monthElement);
  const supportExists = hasSelfOrPeerRoot || hasResourceRoot || hasSupportStem;
  const strength = monthSupports && (hasSelfOrPeerRoot || hasSupportStem)
    ? "中和偏旺"
    : monthPressures && !supportExists
      ? "偏弱"
      : monthPressures ? "中和偏弱" : "中和";
  const favorable: ElementName[] = strength === "偏弱" || strength === "中和偏弱"
    ? [resource, dayElement]
    : strength === "中和偏旺" ? [output, wealth] : [output, wealth];
  const avoid = (strength === "偏弱" || strength === "中和偏弱")
    ? [officer, wealth].filter((element, index, all) => all.indexOf(element) === index)
    : [dayElement, resource].filter((element, index, all) => all.indexOf(element) === index);
  const tenGods = pillars.map((pillar, index) => ({
    label: ["年柱", "月柱", "日柱", "时柱"][index],
    god: engine?.tenGods[index] || (index === 2 ? "日主" : tenGod(dayStem, pillar[0])),
    element: elementOf[pillar[0]] || dayElement,
    hidden: hidden[index] || "—",
  }));
  const godCounts: Record<string, number> = {};
  pillars.forEach((pillar, index) => {
    if (index !== 2) {
      const god = tenGod(dayStem, pillar[0]);
      godCounts[god] = (godCounts[god] || 0) + 1;
    }
    [...new Set(hidden[index].split(""))].forEach((stem) => {
      const god = tenGod(dayStem, stem);
      godCounts[god] = (godCounts[god] || 0) + 1;
    });
  });
  const natalBranches = pillars.map((pillar) => pillar[1]).filter(Boolean);
  const interactions: string[] = [];
  natalBranches.forEach((branch, index) => natalBranches.slice(index + 1).forEach((other) => {
    const orderedPair = [branch, other].sort((a, b) => branches.indexOf(a) - branches.indexOf(b)).join("");
    if (branchClashes[branch] === other) interactions.push(`${orderedPair}相冲`);
    if (branchHarmonies[branch] === other) interactions.push(`${orderedPair}六合`);
  }));
  const evidence = [
    `月令：${pillars[1]?.[1] || "—"}${monthSupports ? `对${dayStem}${dayElement}有生扶作用` : monthPressures ? `让${dayStem}${dayElement}处在泄耗或受制的季节背景` : `对${dayStem}${dayElement}不偏向单边生扶或泄耗`}`,
    selfRootDetails.length ? `根气：${selfRootDetails.join("、")}，日主并非全无依托` : "根气：地支未见日主同类根气",
    resourceRootDetails.length ? `印星根气：${resourceRootDetails.join("、")}，可提供间接支持` : "印星根气：不显著",
    supportStemDetails.length ? `天干支持：${supportStemDetails.join("、")}同属日主或印星` : "天干支持：未见明显印比帮扶",
    pressureStemDetails.length ? `天干压力：${pressureStemDetails.join("、")}属泄、财或官杀，需和根气一起衡量` : "天干压力：泄、财、官杀没有集中透出",
  ];
  const uncertainty = (monthPressures && supportExists) || (monthSupports && hasPressureStem) ? "中" : "低";
  const strengthReason = monthPressures
    ? `月令先让日主处于消耗背景；但${[selfRootDetails.length ? "地支有同类根气" : "地支同类根气不显", resourceRootDetails.length ? "印星有根" : "印星根气不显", supportStemDetails.length ? "天干另有印比相助" : "天干印比不显"].join("，")}，所以不直接定为“偏弱”，而暂定为“中和偏弱”。`
    : monthSupports
      ? `月令先给日主生扶，${supportExists ? "根气或天干也有呼应" : "但根气与天干支持仍有限"}，故暂定为${strength}。`
      : `月令不单边，根气、天干支持与泄耗没有形成明显一边倒，故暂定为中和。`;
  return {
    dayStem, dayElement, strength, favorable, avoid, tenGods, godCounts,
    natalBranches, interactions: [...new Set(interactions)], evidence, uncertainty, strengthReason,
    engineEmpty: engine?.empty || { year: "已略", day: "已略" },
    changSheng: engine?.changSheng || "已略",
  };
}

function formatEngineStart(start: EngineBazi["start"]) {
  const parts = [`${start.years}年`, `${start.months}个月`, `${start.days}天`];
  if (start.hours) parts.push(`${start.hours}小时`);
  return parts.join("");
}

function palaceStars(palace?: Palace) {
  const stars = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
  return stars.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join("、") || "空宫借对宫";
}

function buildLuck(pillars: string[], gender: Gender, analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, engine: EngineBazi) {
  const draftFortunes = engine.fortunes.slice(0, 8).map((source, index) => {
    const { pillar, startYear, endYear } = source;
    const stemElement = elementOf[pillar[0]] || "土";
    const branchElement = elementOf[pillar[1]] || "土";
    const clashes = [...new Set(analysis.natalBranches.filter((branch) => branchClashes[pillar[1]] === branch))];
    const harmonies = [...new Set(analysis.natalBranches.filter((branch) => branchHarmonies[pillar[1]] === branch))];
    const midpointAge = source.startAge + 4;
    const decadalPalace = chart.palaces.find((palace) => {
      const range = palace.decadal?.range;
      return range && midpointAge >= range[0] && midpointAge <= range[1];
    });
    const majorStars = decadalPalace?.majorStars || [];
    const mutagens = majorStars.filter((star) => star.mutagen).map((star) => `${star.name}化${star.mutagen}`);
    const changeStars = majorStars.filter((star) => ["七杀", "破军", "贪狼", "廉贞"].includes(star.name)).map((star) => star.name);
    const relationshipStars = majorStars.filter((star) => ["天机", "太阴", "天同", "廉贞", "贪狼", "巨门"].includes(star.name)).map((star) => star.name);
    const fortuneGod = tenGod(analysis.dayStem, pillar[0]);
    const dayBranch = analysis.natalBranches[2];
    const dayBranchClash = Boolean(dayBranch && branchClashes[pillar[1]] === dayBranch);
    const dayBranchHarmony = Boolean(dayBranch && branchHarmonies[pillar[1]] === dayBranch);
    const spouseGods = gender === "男" ? ["正财", "偏财"] : ["正官", "七杀"];
    const luckNatalTrigger = Boolean(clashes.length || harmonies.length || dayBranchClash || dayBranchHarmony);
    const ziweiOverallTrigger = Boolean(decadalPalace && (changeStars.length || mutagens.length));
    const careerPalaceTrigger = Boolean(decadalPalace && ["官禄", "命宫", "迁移", "财帛"].some((name) => decadalPalace.name.includes(name)));
    const relationshipPalaceTrigger = Boolean(decadalPalace && ["夫妻", "命宫", "福德", "迁移"].some((name) => decadalPalace.name.includes(name)));
    const monthBranch = analysis.natalBranches[1];
    const luckHitsMonth = Boolean(monthBranch && (clashes.includes(monthBranch) || harmonies.includes(monthBranch)));
    const careerFortuneTheme = ["正官", "七杀", "正印", "偏印", "食神", "伤官"].includes(fortuneGod) || luckHitsMonth;
    // 感情的“阶段主题”可由夫妻星、夫妻宫（日支）或紫微关系宫位之一带出；
    // 仍须等流年再触及夫妻星或日支，才列为观察窗口，不能只凭一宫下结论。
    const relationshipFortuneTheme = dayBranchClash || dayBranchHarmony || spouseGods.includes(fortuneGod) || relationshipPalaceTrigger;
    const careerGodMeanings: Record<string, string> = {
      正官: "正官透出，职位、责任与组织标准更容易成为主线", 七杀: "七杀透出，竞争、高压任务与快速决策增多",
      食神: "食神透出，专业产出、作品与口碑更容易兑现", 伤官: "伤官透出，创新、表达与职业换轨的需求增强",
      正印: "正印透出，学习、资质与平台资源更值得核实", 偏印: "偏印透出，方法更新、专门技能与非标准路径需要评估",
      正财: "正财透出，收入结构、客户与稳定回报成为重点", 偏财: "偏财透出，市场变化、资源整合与多元收入议题增多",
      比肩: "比肩透出，同行协作与职业自主性同时上升", 劫财: "劫财透出，团队重组、合伙分配与同行竞争需要说清",
    };
    const helpful = [stemElement, branchElement].some((element) => analysis.favorable.includes(element));
    const cautious = [stemElement, branchElement].some((element) => analysis.avoid.includes(element));
    const mode = helpful && !cautious && !mutagens.some((item) => item.endsWith("化忌")) ? "进取" : cautious && !helpful ? "蓄势" : "稳进";
    const turnReasons = [
      clashes.length ? `大运${pillar[1]}冲出生八字的${clashes.join("、")}，环境或角色更容易出现实质调整` : "",
      harmonies.length ? `大运${pillar[1]}与出生八字的${harmonies.join("、")}六合，合作与关系更容易成为推动因素` : "",
      decadalPalace ? `紫微十年主题落在${decadalPalace.name}（${palaceStars(decadalPalace)}）` : "",
      changeStars.length ? `${changeStars.join("、")}使重整、换轨或调整的倾向增加` : "",
      mutagens.length ? `大限见${mutagens.join("、")}` : "",
    ].filter(Boolean);
    const careerReasons = [
      careerGodMeanings[fortuneGod] || "",
      decadalPalace && ["官禄", "命宫", "迁移", "财帛"].some((name) => decadalPalace.name.includes(name)) ? `紫微十年主题走到${decadalPalace.name}（${palaceStars(decadalPalace)}），职业角色与资源安排更需要关注` : "",
      clashes.length ? `大运${pillar[1]}冲出生八字的${clashes.join("、")}，工作环境或责任边界容易调整` : "",
      changeStars.length ? `${changeStars.join("、")}使转岗、重组或调整之意增加` : "",
      mutagens.length ? `事业判断同时参看${mutagens.join("、")}` : "",
    ].filter(Boolean);
    const relationshipReasons = [
      dayBranchClash ? `大运${pillar[1]}冲日支${dayBranch}，亲密关系的相处结构与生活节奏容易重新调整` : "",
      dayBranchHarmony ? `大运${pillar[1]}合日支${dayBranch}，关系确认、合作或共同生活议题更容易被推动` : "",
      spouseGods.includes(fortuneGod) ? `大运天干${pillar[0]}为${fortuneGod}，伴侣与承诺议题更容易被注意` : "",
      decadalPalace && ["夫妻", "命宫", "福德", "迁移"].some((name) => decadalPalace.name.includes(name)) ? `紫微十年主题走到${decadalPalace.name}（${palaceStars(decadalPalace)}），情感需求或现实环境对关系的影响更明显` : "",
      relationshipStars.length ? `${relationshipStars.join("、")}使情绪表达、关系吸引或协商议题增多` : "",
      mutagens.length ? `关系判断同时参看${mutagens.join("、")}` : "",
    ].filter(Boolean);
    const annualCandidates = Array.from({ length: Math.max(1, endYear - startYear + 1) }, (_, yearIndex) => {
      const year = startYear + yearIndex;
      const annualPillar = calculateAnnualPillar(year);
      const annualStem = annualPillar[0];
      const annualBranch = annualPillar[1];
      const annualGod = tenGod(analysis.dayStem, annualStem);
      const annualElement = elementOf[annualStem] || "土";
      const annualBranchElement = elementOf[annualBranch] || "土";
      const annualClashes = [...new Set(analysis.natalBranches.filter((branch) => branchClashes[annualBranch] === branch))];
      const annualHarmonies = [...new Set(analysis.natalBranches.filter((branch) => branchHarmonies[annualBranch] === branch))];
      const annualDayClash = Boolean(dayBranch && branchClashes[annualBranch] === dayBranch);
      const annualDayHarmony = Boolean(dayBranch && branchHarmonies[annualBranch] === dayBranch);
      const annualStrongBalanceTrigger = [annualElement, annualBranchElement].every((element) => analysis.favorable.includes(element))
        || [annualElement, annualBranchElement].every((element) => analysis.avoid.includes(element));
      const annualCareerTheme = ["正官", "七杀", "正印", "偏印", "食神", "伤官"].includes(annualGod);
      const annualHitsNatal = Boolean(annualClashes.length || annualHarmonies.length);
      const annualHitsLuck = annualBranch === pillar[1] || branchClashes[annualBranch] === pillar[1] || branchHarmonies[annualBranch] === pillar[1];
      const annualHitsMonth = Boolean(monthBranch && (annualClashes.includes(monthBranch) || annualHarmonies.includes(monthBranch)));
      const annualHitsDay = annualDayClash || annualDayHarmony;
      const age = Math.max(0, Math.floor(source.startAge + yearIndex));
      const adultCareerWindow = age >= 18;
      const adultRelationshipWindow = age >= 18;
      const qualified: Record<TurningKind, boolean> = {
        // 先有大运与原局的阶段互动，再有流年触发；紫微用于解释这段变化主要落在哪个领域。
        overall: luckNatalTrigger && (annualHitsNatal || annualHitsLuck),
        // 事业只从成年后看：大运先形成职业主题，流年再直接触及月柱，或沿着“大运已触及月柱”的链条完成触发。
        career: adultCareerWindow && careerFortuneTheme && annualCareerTheme && (annualHitsMonth || (luckHitsMonth && annualHitsLuck)),
        // 感情只从成年后看：大运先触及配偶星或夫妻宫，再由流年触及配偶星或日支。
        relationship: adultRelationshipWindow && relationshipFortuneTheme && (annualHitsDay || spouseGods.includes(annualGod)),
      };
      const signals: Record<TurningKind, string[]> = {
        overall: [
          luckNatalTrigger ? "大运先与出生盘形成互动" : "",
          annualHitsNatal ? "流年再触及出生盘" : annualHitsLuck ? "流年再触及大运" : "",
          ziweiOverallTrigger ? "紫微十年主题也见变化信号" : "",
          annualStrongBalanceTrigger ? "流年干支同时触及喜忌" : "",
        ].filter(Boolean),
        career: [
          adultCareerWindow ? "已进入成年后的事业阶段" : "",
          careerFortuneTheme ? `大运先带出${fortuneGod}的事业主题` : "",
          luckHitsMonth ? "大运直接触及月柱（事业环境）" : "",
          annualCareerTheme ? `流年再引动${annualGod}` : "",
          annualHitsMonth ? "流年直接触及月柱（事业环境）" : luckHitsMonth && annualHitsLuck ? "流年触及大运，且该运已连到月柱" : "",
          careerPalaceTrigger ? "紫微十年主题落在事业相关宫位" : "",
        ].filter(Boolean),
        relationship: [
          adultRelationshipWindow ? "已进入成年关系阶段" : "",
          relationshipFortuneTheme ? "大运先带出夫妻星、日支或关系宫位主题" : "",
          annualHitsDay ? "流年触及日支（夫妻宫）" : "",
          spouseGods.includes(annualGod) ? "流年引动配偶星" : "",
          relationshipPalaceTrigger ? "紫微十年主题也落在关系相关宫位" : "",
        ].filter(Boolean),
      };
      const reasons: Record<TurningKind, string> = {
        overall: `${pillar}运已与出生盘形成阶段互动，${annualPillar}年又${annualHitsNatal ? "触及原局" : "触及大运"}${ziweiOverallTrigger ? "，紫微十年主题也有变动提示" : ""}；这是整体节奏的重点观察窗口，不把它直接断成某一件事。`,
        career: `${pillar}运先带出${fortuneGod}的事业主题，${annualPillar}年见${annualGod}，并${annualHitsMonth ? "直接引动原局月柱（事业环境）" : "触及大运，而该运已与原局月柱形成联系"}${careerPalaceTrigger ? "；紫微十年主题也落在事业相关宫位" : ""}。这才列为成年后的事业观察窗口，重点核实岗位、专业方向、职责或工作环境是否出现持续变化。`,
        relationship: `${pillar}运先${dayBranchClash ? `冲日支${dayBranch}` : dayBranchHarmony ? `合日支${dayBranch}` : spouseGods.includes(fortuneGod) ? `引动${fortuneGod}配偶星` : "进入紫微关系相关宫位主题"}，${annualPillar}年又${annualHitsDay ? `触及日支${dayBranch}` : `见${annualGod}配偶星`}${relationshipPalaceTrigger ? "，紫微十年主题也提示关系议题" : ""}；这是关系确认、协商或边界调整的观察窗口，不等同于直接断婚期。`,
      };
      return { year, pillar: annualPillar, signals, reasons, qualified };
    });
    const pickAnnualSignal = (kind: TurningKind) => {
      const ranked = [...annualCandidates].sort((a, b) => {
        const qualifiedGap = Number(b.qualified[kind]) - Number(a.qualified[kind]);
        return qualifiedGap || b.signals[kind].length - a.signals[kind].length || a.year - b.year;
      });
      const selected = ranked[0];
      return { year: selected.year, pillar: selected.pillar, reason: selected.reasons[kind], signals: selected.signals[kind], ready: selected.qualified[kind] };
    };
    const annualSignals = {
      overall: pickAnnualSignal("overall"),
      career: pickAnnualSignal("career"),
      relationship: pickAnnualSignal("relationship"),
    };
    return {
      key: `${index}-${pillar}-${startYear}`,
      pillar,
      age: source.startAge,
      ageText: index === 0 ? `${formatEngineStart(engine.start)}起` : `${source.startAge}岁`,
      years: `${startYear}–${endYear}`,
      mode,
      element: stemElement,
      branchElement,
      turnReasons,
      careerReasons,
      relationshipReasons,
      annualSignals,
      fortuneGod,
      dayRelation: dayBranchClash ? `冲日支${dayBranch}` : dayBranchHarmony ? `合日支${dayBranch}` : `与日支${dayBranch || "—"}无直接合冲`,
      careerAdvice: mode === "进取" ? `可主动争取职位、客户或新赛道，但先用${labels[analysis.favorable[0]]}设定阶段验收点。` : mode === "蓄势" ? "先稳住现金流、职责边界和核心能力，不宜因一时压力裸辞或重仓转轨。" : "先以项目、兼职或小范围试点验证新方向，达到量化标准后再加码。",
      relationshipAdvice: dayBranchClash ? "先处理生活节奏、距离、金钱与边界的重新协商，不在情绪最高点做终局决定。" : dayBranchHarmony ? "适合推进关系确认与共同计划，但要把承诺、金钱和个人空间说具体。" : "重点观察价值观、沟通方式和日常节奏是否经得住现实验证，不用进度代替质量。",
      decadalPalace: decadalPalace?.name || "未落入当前大限范围",
      decadalStars: palaceStars(decadalPalace),
    };
  });
  const strongestKeys = (kind: TurningKind) => new Set(
    draftFortunes
      .filter((fortune) => fortune.annualSignals[kind].ready)
      .sort((a, b) => b.annualSignals[kind].signals.length - a.annualSignals[kind].signals.length || Number(a.years.slice(0, 4)) - Number(b.years.slice(0, 4)))
      .slice(0, 2)
      .map((fortune) => fortune.key),
  );
  const selectedOverall = strongestKeys("overall");
  const selectedCareer = strongestKeys("career");
  const selectedRelationship = strongestKeys("relationship");
  const fortunes = draftFortunes.map((fortune) => ({
    ...fortune,
    isTurningPoint: selectedOverall.has(fortune.key),
    isCareerTurningPoint: selectedCareer.has(fortune.key),
    isRelationshipTurningPoint: selectedRelationship.has(fortune.key),
  }));
  const currentYear = new Date().getFullYear();
  const currentFortune = fortunes.find((fortune) => currentYear >= Number(fortune.years.slice(0, 4)) && currentYear <= Number(fortune.years.slice(-4))) || fortunes[0];
  return {
    fortunes,
    directionLabel: engine.direction,
    startAgeText: formatEngineStart(engine.start),
    startDateText: engine.start.solar.replace(/(\d{4})-(\d{2})-(\d{2}) /, "$1年$2月$3日 "),
    currentFortune,
  };
}

function solarDateFromLunar(year: number, month: number, day: number, isLeapMonth: boolean) {
  try {
    return solarFromLunarDate(year, month, day, isLeapMonth);
  } catch {
    return "";
  }
}

function getAstrolabe(date: string, time: string, gender: Gender): Astrolabe {
  try {
    const chart = window.iztro?.astro.bySolar(date, getTimeIndex(time), gender, true, "zh-CN");
    if (chart?.palaces?.length === 12) return chart;
  } catch { /* fallback keeps the prototype usable */ }
  return {
    solarDate: date,
    lunarDate: "农历日期载入中",
    chineseDate: "庚午 戊子 丙寅 甲午",
    fiveElementsClass: "金四局",
    soul: "贪狼",
    body: "天相",
    palaces: fallbackPalaces,
  };
}

const starMeanings: Record<string, string> = {
  紫微: "重统筹、主见与责任感", 天机: "倾向推演与应变，也容易反复衡量", 太阳: "重公开表达、担当与影响力",
  武曲: "看重效率、数字与资源兑现", 天同: "重体验与和谐，行动节奏偏稳", 廉贞: "企图心与边界意识都较鲜明",
  天府: "偏向守成、配置资源与建立秩序", 太阴: "观察较细，重安全感与长期积累", 贪狼: "欲望驱动较强，社交与多元尝试较多",
  巨门: "重思辨和表达，也要留意口舌", 天相: "重协调、规则与体面", 天梁: "原则性较强，常涉及顾问、守护与解难议题",
  七杀: "决策节奏较快，在压力下容易直接行动", 破军: "倾向调整旧结构，阶段变化感较强",
};

const starWatchouts: Record<string, string> = {
  紫微: "不必事事控场或把责任全揽在自己身上", 天机: "决策时要设截止点，免得反复推演却不落地",
  太阳: "别为了维持表现而透支精力", 武曲: "不要只用效率和数字衡量人情与长期价值",
  天同: "安逸时要为自己设稍有挑战的节点", 廉贞: "野心与边界要同时说清，避免陷入关系拉扯",
  天府: "守成要有止损线，不必为沉没成本继续加码", 太阴: "安全感不足时要用信息核实，不要靠内心猜测",
  贪狼: "选择过多时要定一个主线，免得新鲜感稀释积累", 巨门: "表达要对事不对人，重要结论最好留下书面记录",
  天相: "协调他人时也要保留自己的判断，别只求体面", 天梁: "原则很重要，但不必以教导姿态代替协商",
  七杀: "动作越快越要设风险上限和退路", 破军: "破旧之前先留住现金流、核心关系和可迁移能力",
};

const starPairMeanings: Record<string, string> = {
  "天府紫微": "紫微的统筹与天府的守成同在，建立秩序的倾向较强，也可能因追求周全而放慢决策",
  "天机太阴": "天机的推演配合太阴的细察，预判与布局会占较多比重，不确定时也可能反复求证",
  "巨门天相": "巨门偏辨析，天相偏衡平，遇到复杂协商时需要把判断依据说清",
  "廉贞破军": "廉贞定边界、破军做重构，调整旧结构的倾向较强，但利益和规则未清时不宜贸然重来",
};

const relatedPalacePurposes: Record<string, string> = {
  命宫: "交代你会用什么性格和承压方式处理这件事", 官禄: "检验这个主题能否转化为职业位置、责任与长期能力",
  财帛: "检验能力能否兑现为收入、资源和可承受的风险", 夫妻: "反映亲密关系与契约协商会怎样回应这个主题",
  迁移: "说明外部环境、异地与变化会如何放大此事", 福德: "揭示内在欲望、压力恢复和长期动机能否支撑下去",
  田宅: "检验居住、家庭与长期资产能否提供稳定根基", 交友: "说明团队、合作伙伴与人际资源能给多少支援",
  父母: "说明长辈、制度与专业资源会给什么支持或约束", 子女: "看创造力、作品与长期项目怎样承接这个主题",
  兄弟: "检验同辈之间的分工、竞争与资源分配", 疾厄: "提醒体力、情绪与日常节律是否承受得住",
};

const palaceElementActions: Record<ElementName, Record<string, string>> = {
  木: {
    命宫: "给未来一年定一条成长主线，把学习拆成每周进度", 官禄: "优先选学习曲线和晋升路径清晰的工作，并稳定积累行业人脉",
    财帛: "把一部分收入投到能复用的技能和长期项目中", 夫妻: "和伴侣共同制定一个可成长的目标，用共同行动代替催促对方",
    迁移: "变动前先确认新环境能带来的学习、人脉和发展空间", 福德: "保留阅读、写作或观察自然的时间，让精神有稳定生长感",
  },
  火: {
    命宫: "练习在重要场合清楚表达立场，不让真实需求被隐藏", 官禄: "每周做一次成果汇报或公开输出，让专业能力能被决策者看见",
    财帛: "用内容、展示或销售测试扩大收入渠道，但每次先设成本上限", 夫妻: "在情绪升高前直接说出感受与请求，不用冷处理等对方猜",
    迁移: "到新环境后主动介绍自己、展示作品，迅速建立第一批有效连接", 福德: "用规律运动、日照和适量社交恢复精力，避免长期闷在内心",
  },
  土: {
    命宫: "先固定作息和复盘时间，再处理高压决定", 官禄: "把每个项目拆成交付清单、节点和验收标准",
    财帛: "做月度预算、区分生活与投资账户，并保留应急金", 夫妻: "把家务、金钱、陪伴时间和个人空间约定成双方能执行的节奏",
    迁移: "换城市、换岗位前先落实住行、收入和三个月缓冲资金", 福德: "固定睡眠、进餐和独处时间，先让身体恢复稳定感",
  },
  金: {
    命宫: "为重要决策设三条标准和一个截止日期，到点即做取舍", 官禄: "用合同、职责边界和量化指标说清你要负责什么、不负责什么",
    财帛: "为每类资产设上限、止损和复盘日，不因短期涨跌临时改规则", 夫妻: "明确承诺、金钱和边界，并约定冲突时不讽刺、不失联的底线",
    迁移: "为变动设启动条件、备选方案和撤退线，不在信息不全时孤注一掷", 福德: "每周删掉一项低价值承诺或无效信息输入，给大脑留出空白",
  },
  水: {
    命宫: "重大选择前先做调研和反方验证，同时保留可回头的余地", 官禄: "主动获取跨部门、跨行业或异地信息，用信息差改进职业选择",
    财帛: "优先保留现金流和流动性，不把所有资金锁在同一处", 夫妻: "先听完对方的真实需求再回应，对不确定的部分直接提问核实",
    迁移: "先短住、实地调研或试运行，验证新环境后再扩大投入", 福德: "保留无打扰的独处、写作或冥想时间，让情绪有流动和沉淀的空间",
  },
};

const palaceActions: Record<string, string> = {
  命宫: "把它当作你的默认反应模式，而非无法改变的性格标签。",
  官禄: "事业选择优先看职责结构、成长空间与可沉淀的能力，不只看职位名称。",
  财帛: "财富判断要和现金流、风险承受力一起看，命盘不替代实际财务规划。",
  夫妻: "关系质量更依赖表达、边界与共同目标，不以单颗星断定婚姻吉凶。",
  迁移: "异地、变动与外部环境会放大这里的特质，重要变化宜预留适应期。",
  福德: "这是压力恢复与精神满足的入口，越忙越需要稳定的独处和复盘节奏。",
};

const palaceRoles: Record<string, string> = {
  命宫: "看先天性格、做事底色与面对压力时的第一反应",
  官禄: "看职业形态、责任方式、工作成就感与长期能力沉淀",
  财帛: "看取得资源、管理现金流以及面对风险时的习惯",
  夫妻: "看亲密关系中的需求、互动模式、承诺与边界",
  迁移: "看异地、跨圈层、变化环境与外部机会对人的放大作用",
  福德: "看精神满足、内在欲望、休息方式与长期压力恢复",
  田宅: "看居住环境、资产根基和内在安定感",
  交友: "看合作对象、团队关系与可调用的人际资源",
  父母: "看长辈缘、制度资源与被支持或被要求的方式",
  子女: "看创造力、作品、晚辈互动与长期项目",
  兄弟: "看同辈协作、竞争与资源分配",
  疾厄: "看身心耗损模式与日常节律，不能替代医学判断",
};

function palaceByName(chart: Astrolabe, target: string) {
  return chart.palaces.find((palace) => palace.name.includes(target));
}

function relatedPalaces(chart: Astrolabe, palace?: Palace) {
  if (!palace) return { triads: [] as Palace[], opposite: undefined as Palace | undefined };
  const index = branches.indexOf(palace.earthlyBranch);
  if (index < 0) return { triads: [] as Palace[], opposite: undefined as Palace | undefined };
  const find = (offset: number) => chart.palaces.find((item) => item.earthlyBranch === branches[(index + offset) % 12]);
  return { triads: [find(4), find(8)].filter(Boolean) as Palace[], opposite: find(6) };
}

function brightnessText(palace: Palace | undefined, target: string) {
  const bright = palace?.majorStars.filter((star) => ["庙", "旺", "得", "利"].includes(star.brightness || "")).length || 0;
  const dim = palace?.majorStars.filter((star) => ["陷", "不"].includes(star.brightness || "")).length || 0;
  if (bright > dim && bright > 0) return `这组星在${target}的相关特征较直接，但能否形成结果仍要看现实条件。`;
  if (dim > bright && dim > 0) return `这组星在${target}需经过现实磨合，越急于证明越容易用力失衡。`;
  return `${target}的星曜强弱不走极端，结果更看环境选择和后天方法。`;
}

function pairMeaning(stars: string[]) {
  if (stars.length < 2) return "";
  const key = [...stars.slice(0, 2)].sort().join("");
  return starPairMeanings[key] || `${stars[0]}与${stars[1]}同宫，前者带来“${starMeanings[stars[0]] || "主动性"}”，后者补上“${starMeanings[stars[1]] || "现实考量"}”，两股力量要放在同一目标上才不会互相拉扯。`;
}

function mutagenText(palace?: Palace) {
  const meanings: Record<string, string> = { 禄: "资源流动增多", 权: "主导权与责任同时增加", 科: "评价与可见度增加", 忌: "执念、反复或卡点需要特别处理" };
  return palace?.majorStars.filter((star) => star.mutagen).map((star) => `${star.name}化${star.mutagen}，${meanings[star.mutagen || ""] || "该星的作用被放大"}。`).join("") || "";
}

function compactPalaceSignal(palace: Palace) {
  const names = palace.majorStars.filter((star) => star.name).map((star) => star.name);
  if (!names.length) return "本宫无十四主星，这项作用要借对宫星曜来定调。";
  const traits = names.slice(0, 2).map((name) => starMeanings[name]).filter(Boolean).join("；");
  return `${names.slice(0, 2).join("、")}让这一环节表现为：${traits}。`;
}

function buildZiweiReading(chart: Astrolabe, analysis: ReturnType<typeof buildAnalysis>) {
  const targetNames = ["命宫", "官禄", "财帛", "夫妻", "迁移", "福德"];
  const oppositionTests: Record<string, string> = {
    命宫: "外部环境是真能给你发挥空间，还是只激发一时冲动",
    官禄: "亲密关系、合作契约与职业责任能否并行",
    财帛: "赚钱方式是否真能支持你想要的生活与安心感",
    夫妻: "工作投入和现实责任是否正在挤压关系空间",
    迁移: "外部机会是否符合你的真实意愿与承受方式",
    福德: "收入、消费与风险压力是否能换来真正的稳定感",
  };
  const cards = targetNames.map((target) => {
    const palace = palaceByName(chart, target);
    const major = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
    const starNames = major.map((star) => star.name);
    const brightness = major.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join(" / ");
    const support = [...(palace?.minorStars || []), ...(palace?.adjectiveStars || [])].slice(0, 4).map((star) => star.name).join("、");
    const related = relatedPalaces(chart, palace);
    const oppositeText = related.opposite ? `${related.opposite.name}（${palaceStars(related.opposite)}）` : "对宫资料不足";
    const starDetails = major.slice(0, 2).map((star) => `${star.name}${star.brightness ? `为${star.brightness}` : ""}：${starMeanings[star.name] || "作用要结合同宫星曜判断"}；需留意${starWatchouts[star.name] || "相关特质使用过度"}。`).join("");
    const triadText = related.triads.map((item, index) => `${index + 1}．${item.name}（${palaceStars(item)}）：${relatedPalacePurposes[item.name] || palaceRoles[item.name] || "从另一个现实层面支援本宫"}。${compactPalaceSignal(item)}`).join(" ") || "三方宫位资料不足，暂不做延伸。";
    const emptyBorrow = major.length === 0 && related.opposite ? `本宫无十四主星，应先借${oppositeText}定主调，再看两个三方宫能不能把它落到现实。` : "";
    const combinedMeaning = pairMeaning(starNames);
    const core = major.length
      ? `${palaceRoles[target]}。${starDetails}${combinedMeaning}${combinedMeaning ? "。" : ""}${mutagenText(palace)}${brightnessText(palace, target)}`
      : `${palaceRoles[target]}。${emptyBorrow}空宫不等于这个领域薄弱，重点是对宫的星曜要如何借来用。`;
    return {
      name: target,
      branch: palace ? `${palace.heavenlyStem}${palace.earthlyBranch}` : "—",
      stars: brightness || "空宫借对宫参看",
      support: support || "辅曜信息平稳",
      core,
      triad: triadText,
      opposite: related.opposite ? `对宫是${oppositeText}。它的作用是${relatedPalacePurposes[related.opposite.name] || "从外部条件检验本宫"}。${compactPalaceSignal(related.opposite)}两宫合看时，请重点核实：${oppositionTests[target]}。` : "本盘对宫资料不足，暂不作延伸。",
      action: `${palaceActions[target]} 就${target}先做两件事：①以喜${analysis.favorable[0]}入手，${palaceElementActions[analysis.favorable[0]][target]}；②用喜${analysis.favorable[1]}辅助，${palaceElementActions[analysis.favorable[1]][target]}。`,
    };
  });
  const life = cards[0];
  const bodyPalace = chart.palaces.find((item) => item.isBodyPalace)?.name || "未标注";
  return {
    headline: `${chart.fiveElementsClass || "五行局"} · 命主${chart.soul || "—"} · 身主${chart.body || "—"}`,
    overview: `命宫落${life.branch}，主星为${life.stars}；身宫落${bodyPalace}，显示人生重心更容易投向该宫所主的现实领域。下方分别从命、官禄、财帛、夫妻、迁移与福德六个主题展开，并把${analysis.strength}、喜${analysis.favorable.join("、")}转成可执行建议。`,
    cards,
  };
}

function buildZiweiPalaceDetail(chart: Astrolabe, analysis: ReturnType<typeof buildAnalysis>, palaceName: string) {
  const palace = palaceByName(chart, palaceName) || chart.palaces[0];
  const major = palace?.majorStars.filter((star) => star.name).slice(0, 3) || [];
  const starNames = major.map((star) => star.name);
  const related = relatedPalaces(chart, palace);
  const baseRole = palaceRoles[palace?.name || ""] || "看这个生活领域的默认条件与现实落点";
  const starText = starNames.length ? compactPalaceSignal(palace) : "本宫无十四主星，先借对宫的星曜来定调。";
  const watch = starNames.slice(0, 2).map((name) => starWatchouts[name]).filter(Boolean).join("；");
  const direct = starNames.length
    ? `结构解读：${palace?.name}${starNames.length > 1 ? `以${starNames.slice(0, 2).join("、")}同宫` : `见${starNames[0]}`}，${baseRole}。${starText}`
    : `结构解读：${palace?.name}为空宫，这个领域不能只凭“空”下结论，要看对宫怎么把力量借来使用。`;
  const action = palace && palaceElementActions[analysis.favorable[0]][palace.name]
    ? `建议：先按喜${analysis.favorable[0]}做——${palaceElementActions[analysis.favorable[0]][palace.name]}；再用喜${analysis.favorable[1]}补足${palaceElementActions[analysis.favorable[1]][palace.name] || "规则与执行"}。`
    : `建议：把${palace?.name || "这个领域"}拆成具体目标、边界与复盘节点，避免只凭一时感觉判断。`;
  const relations: PalaceRelation[] = [
    ...related.triads.map((item) => ({
      target: item, relation: "三方", tone: "support" as RelationTone,
      meaning: `${palace?.name}与${item.name}属于三方关系：${item.name}${relatedPalacePurposes[item.name] || palaceRoles[item.name] || "提供现实支援"}。${compactPalaceSignal(item)}`,
    })),
    ...(related.opposite ? [{
      target: related.opposite, relation: "对宫", tone: "tension" as RelationTone,
      meaning: `${palace?.name}的对宫是${related.opposite.name}：${relatedPalacePurposes[related.opposite.name] || "外部条件会检验本宫是否站得住"}。${compactPalaceSignal(related.opposite)}两宫合看，是为了判断内在选择能否经得起现实反馈。`,
    }] : []),
  ];
  return {
    palace,
    stars: palaceStars(palace),
    direct,
    action,
    watch: watch || "本宫的力量宜用在明确的现实目标上，避免过度解读单颗星。",
    relations,
  };
}

function godTotal(analysis: ReturnType<typeof buildAnalysis>, names: string[]) {
  return names.reduce((sum, name) => sum + (analysis.godCounts[name] || 0), 0);
}

function describeGodPresence(value: number) {
  if (value >= 3) return "很突出";
  if (value >= 2) return "较明显";
  if (value >= 1) return "有一定分量";
  if (value > 0) return "略有显现";
  return "不显";
}

function buildLifeReadings(analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, gender: Gender) {
  const careerGods = godTotal(analysis, ["正官", "七杀"]);
  const outputGods = godTotal(analysis, ["食神", "伤官"]);
  const wealthGods = godTotal(analysis, ["正财", "偏财"]);
  const resourceGods = godTotal(analysis, ["正印", "偏印"]);
  const spouseGodNames = gender === "男" ? ["正财", "偏财"] : ["正官", "七杀"];
  const spouseGods = godTotal(analysis, spouseGodNames);
  const careerPalace = palaceByName(chart, "官禄");
  const wealthPalace = palaceByName(chart, "财帛");
  const spousePalace = palaceByName(chart, "夫妻");
  const isWeaker = analysis.strength.includes("弱");
  const careerHeadline = careerGods >= outputGods && careerGods >= 1.5 ? "权责与规则是职业主轴" : outputGods >= 1.5 ? "靠专业输出打开局面" : resourceGods >= 1.5 ? "先深耕方法，再放大影响" : "用稳定赛道承接能力";
  const wealthHeadline = wealthGods >= 2 && !isWeaker ? "财星有一定分量，仍看承接" : wealthGods >= 1 ? "财星有所显现，先看现金流" : "财星不显，收入更看能力与环境";
  const relationHeadline = spouseGods >= 2 ? "伴侣星较多，边界需要说明" : spouseGods >= 1 ? "先观察磨合，再判断关系" : "伴侣星不显，先看共同节奏";
  return [
    {
      icon: "业", label: "事业", headline: careerHeadline,
      verdict: careerGods >= 1.5 || outputGods >= 1.5 ? "综合判断：职业发展更看能力、责任和持续交付，不宜只等机会自己出现。" : "综合判断：职业前期更适合稳定积累，先把一项可沉淀的能力做深，再评估是否换方向。",
      text: `八字中官杀${describeGodPresence(careerGods)}、食伤${describeGodPresence(outputGods)}、印星${describeGodPresence(resourceGods)}，日主为${analysis.strength}；紫微官禄宫落${careerPalace?.heavenlyStem || "—"}${careerPalace?.earthlyBranch || "—"}，见${palaceStars(careerPalace)}。职业判断宜${careerGods >= outputGods ? "把责任边界、标准和决策权说清楚" : "用作品、表达和解决问题的能力验证位置"}，并用喜${analysis.favorable.join("、")}的方式持续积累。`,
      keywords: `${careerPalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"} / ${analysis.favorable.join(" / ")}`,
    },
    {
      icon: "财", label: "财富", headline: wealthHeadline,
      verdict: wealthGods >= 1.5 && !isWeaker ? "综合判断：收入机会可能有，但是否能留下来仍取决于现金流、合同和风险管理；不宜重仓押注。" : "综合判断：财富策略应先放在稳定现金流和可复制能力，快钱、重仓与人情借贷要更谨慎。",
      text: `八字中财星${describeGodPresence(wealthGods)}，${isWeaker ? "承载力比收入机会的数量更值得优先核实，扩张前先补现金流与执行能力" : "仍要区分稳定收入和高波动来源"}；紫微财帛宫见${palaceStars(wealthPalace)}。具体策略是先用${labels[analysis.favorable[0]]}建立可重复收入，再按可承受损失配置风险。`,
      keywords: `财星${describeGodPresence(wealthGods)} / ${wealthPalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"} / 现金流`,
    },
    {
      icon: "情", label: "情感", headline: relationHeadline,
      verdict: spouseGods >= 1.5 ? "综合判断：关系机会与关系质量不是一回事，重点在边界和承诺是否说清；越含糊，越容易反复。" : "综合判断：感情宜慢不宜赶，先看相处节奏与价值观；不适合用关系进度证明自己。",
      text: `${gender}命以${gender === "男" ? "财星" : "官杀"}观察伴侣线索，本盘此类信号${describeGodPresence(spouseGods)}；日支为${analysis.natalBranches[2] || "—"}，是亲密关系中的落脚点。紫微夫妻宫见${palaceStars(spousePalace)}。${spouseGods >= 1.5 ? "相关十神信号较多时，更要提前说清承诺、金钱与个人空间" : "不宜用进度衡量关系，先验证价值观和日常节奏是否相容"}。`,
      keywords: `${gender === "男" ? "财星" : "官杀"} / 日支${analysis.natalBranches[2] || "—"} / ${spousePalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"}`,
    },
  ];
}

function buildPersonalitySummary(analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe) {
  const lifePalace = palaceByName(chart, "命");
  const stars = lifePalace?.majorStars.filter((star) => star.name).slice(0, 2).map((star) => star.name) || [];
  const primaryGod = Object.entries(analysis.godCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "比肩";
  const personalityByGod: Record<string, { headline: string; tone: string; advice: string }> = {
    正官: { headline: "重标准，也需要自己的节奏", tone: "对责任、规则与评价较有感受，做事更愿意先把位置和标准弄清", advice: "把要承担与不承担的事写清，避免把外部标准全变成自我压力" },
    七杀: { headline: "遇压会动，但要先留余地", tone: "面对竞争、变化或高要求时，行动和决断的议题更突出", advice: "重要推进先设风险上限与备选方案，不在压力最高时做不可逆决定" },
    正印: { headline: "先求理解，再求推进", tone: "更依赖知识、方法和可信资源建立安全感，判断前会倾向先把信息弄透", advice: "给研究和准备设截止点，把已确认的信息转成下一步行动" },
    偏印: { headline: "方法感强，别困在反复推演", tone: "对非标准方法、差异化经验和细节变化更敏感，常会先寻找自己的解法", advice: "保留独立判断，同时用小范围试验检验方法是否真的有效" },
    食神: { headline: "靠稳定产出建立底气", tone: "更适合通过技能、作品和持续交付表达价值，不必总用强对抗证明自己", advice: "选一项能长期复利的输出，按周期留存作品与结果" },
    伤官: { headline: "有表达与改进欲，需配合边界", tone: "容易看见不合理处，也有表达、优化或另辟路径的驱动力", advice: "先把建议落到证据、方案和责任分工，再推动改变" },
    正财: { headline: "现实感强，先算清再投入", tone: "会优先看投入产出、稳定回报和长期可承受性，资源安排是性格中的重要抓手", advice: "把安全感落到预算、合同和可复制能力，别只靠节省拖延选择" },
    偏财: { headline: "资源嗅觉较强，取舍比铺开更重要", tone: "容易注意机会、关系网络和多种资源的流动，但选择过多也会分散精力", advice: "同时保留的方向不要超过两项，每项都设成本上限和复盘点" },
    比肩: { headline: "自主性强，合作要先定分工", tone: "更在意自己能否掌握节奏与选择权，同辈协作和自主边界会反复出现", advice: "合作前说清权限、交付与收益分配，避免默契替代约定" },
    劫财: { headline: "重同伴与行动，资源边界要明", tone: "同辈、团队和竞争关系的影响较明显，行动时容易受环境与伙伴带动", advice: "把钱、时间和责任分别记账，不以情面代替规则" },
  };
  const personality = personalityByGod[primaryGod] || personalityByGod.比肩;
  const strengthTone = analysis.strength.includes("弱") ? "当前承载力偏弱，扩张前先补稳定支持" : analysis.strength.includes("旺") ? "当前推动力偏旺，推进时更要避免用力过猛" : "当前承载与输出相对接近，关键在持续取舍";
  const starTone = stars.length ? `${stars.join("、")}让你在外在表现上更重${stars.map((name) => starMeanings[name]).filter(Boolean).join("；")}` : "命宫主星信息不完整，性格以八字结构为主判断";
  return {
    headline: personality.headline,
    summary: `八字以${primaryGod}为较突出的行为线索：${personality.tone}；${strengthTone}。紫微命宫${lifePalace ? `落${lifePalace.heavenlyStem}${lifePalace.earthlyBranch}` : "资料不足"}，${starTone}。两盘合看，性格不是单纯“好或坏”，而是你习惯用什么方式面对压力、关系和选择。`,
    verdict: `综合判断（${analysis.uncertainty}不确定度）：当前优先练的不是“更拼”，而是把喜${analysis.favorable[0]}、${analysis.favorable[1]}的做法变成日常规则。${analysis.avoid.join("、")}太过时，判断更容易变急、节奏更容易失衡。`,
    advice: `建议：${personality.advice}；再${elementGuidance[analysis.favorable[0]].steps[0]}。`,
  };
}

function buildPatternInsight(analysis: ReturnType<typeof buildAnalysis>) {
  const visible = analysis.tenGods.filter((item) => item.god !== "日主").map((item) => `${item.label}${item.god}`).join("、");
  const relation = analysis.interactions.length ? `地支见${analysis.interactions.join("、")}` : "地支未见明显六合或六冲成对出现";
  const primary = elementGuidance[analysis.favorable[0]];
  const secondary = elementGuidance[analysis.favorable[1]];
  return `旺衰先看月令、根气与天干帮扶，不用固定百分比换算。当前结构证据是：${analysis.evidence.slice(0, 3).join("；")}。天干十神为${visible}，${relation}。当下先用喜${analysis.favorable[0]}的方式“${primary.title}”，再以喜${analysis.favorable[1]}的方式“${secondary.title}”辅助；下面给出的是可执行的现实建议，不把单一符号当成必然事件。`;
}

function answerQuestion(question: string, analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, luck: ReturnType<typeof buildLuck>, gender: Gender) {
  const readings = buildLifeReadings(analysis, chart, gender);
  const current = luck.currentFortune;
  const opening = `先说综合判断（${analysis.uncertainty}不确定度）：此盘日主是${analysis.dayStem}${analysis.dayElement}，整体判断为${analysis.strength}，较有助于平衡的五行是${analysis.favorable.join("、")}；当前对应${current.pillar}大运（${current.mode}），紫微这十年的重点在${current.decadalPalace}，见${current.decadalStars}。`;
  if (/事业|工作|职业|跳槽|创业/.test(question)) return `${opening} ${readings[0].headline}。${readings[0].text}${current.turnReasons[0] ? ` 这一运的变化依据是：${current.turnReasons.join("；")}。` : ""}`;
  if (/财|钱|投资|收入|买房/.test(question)) return `${opening} ${readings[1].headline}。${readings[1].text}任何借贷、投资和房产决定仍应以真实现金流、合同与专业意见为准。`;
  if (/感情|婚姻|对象|恋爱/.test(question)) return `${opening} ${readings[2].headline}。${readings[2].text}这里判断的是互动倾向，不以单星或单一十神断定婚期与吉凶。`;
  if (/今年|流年|明年|阶段|转折/.test(question)) return `${opening} 这一阶段是否是转折，不看固定年龄，而要把大运和出生八字的合冲、五行是否平衡，以及紫微十年主题放在一起判断。当前依据是：${current.turnReasons.join("；") || "未见强烈合冲，宜按稳进节奏观察现实信号"}。`;
  return `${opening} 八字给出的行动抓手是${labels[analysis.favorable[0]]}与${labels[analysis.favorable[1]]}；紫微则提示把当前${current.decadalPalace}的主题作为现实验证场。若你补充具体事件、时间范围与可选方案，我可以继续按同一张双盘细分。`;
}

function ColoredPillar({ pillar, suffix = "", className = "" }: { pillar: string; suffix?: string; className?: string }) {
  return <span className={`colored-pillar ${className}`.trim()}>
    <span className={`element-${elementClass[elementOf[pillar[0]] || "土"]}`}>{pillar[0]}</span>
    <span className={`element-${elementClass[elementOf[pillar[1]] || "土"]}`}>{pillar[1]}</span>
    {suffix && <span className="pillar-suffix">{suffix}</span>}
  </span>;
}

function relationKey(item: RelationItem, prefix: string) {
  return `${prefix}-${item.layer || "none"}-${item.leftIndex ?? "x"}-${item.rightIndex ?? "x"}-${item.left}-${item.right}-${item.relation}`;
}

function shortRelationLabel(item: RelationItem) {
  if (item.relation.includes("三合")) return "三合";
  if (item.relation.includes("三会")) return "三会";
  if (item.relation.includes("相冲")) return "冲";
  if (item.relation.includes("相害")) return "害";
  if (item.relation.includes("相刑")) return "刑";
  if (item.relation.includes("相破")) return "破";
  if (item.relation.includes("六合") || item.relation.includes("相合")) return "合";
  if (item.relation.includes("半合")) return "半合";
  if (item.relation.includes("半会")) return "半会";
  return "关系";
}

function relationImpact(item: RelationItem) {
  if (item.relation.includes("相冲")) return "影响：这条线代表变化感较强，常落在节奏、位置、环境或关系安排需要调整的地方。";
  if (/(相害|相刑|相破)/.test(item.relation)) return "影响：这条线不是一定出事，而是提醒这里更容易有误会、反复或消耗，提前把边界和步骤说清会更省力。";
  if (/(相合|六合|半合|半会)/.test(item.relation)) return "影响：这条线代表有可借力之处，适合通过合作、规则或共同目标让力量落到实处，别只停在感觉上。";
  return "影响：这条关系更像长期的相互影响，需放在整体强弱和现实选择里判断。";
}

function RelationDetail({ item, title = "这条关系怎么读" }: { item: RelationItem; title?: string }) {
  const isFortuneDetail = title.includes("大运");
  const plainMeaning = isFortuneDetail
    ? `大运${item.right}与原局${item.leftLabel}${item.left}形成${item.relation}。这条互动贯穿本步大运，具体落点仍以被引动的原局柱位和十神为准。`
    : item.meaning;
  return <div className={`relation-detail ${item.tone}`}>
    <div><span>{title}</span><strong>{item.leftLabel}<b className={`element-${elementClass[elementOf[item.left] || "土"]}`}>{item.left}</b> · {item.rightLabel}<b className={`element-${elementClass[elementOf[item.right] || "土"]}`}>{item.right}</b></strong></div>
    <h4>{item.relation}</h4>
    <p>{plainMeaning}</p>
    <em>{relationImpact(item)} {item.tone === "tension" ? "建议：重要决定留复核，先处理现实条件再处理情绪。" : "建议：把有利的配合落实到明确分工、时间表或可验证的成果。"}</em>
  </div>;
}

function BaziRelationMap({ pillars, relations, selectedKey, onSelect }: { pillars: string[]; relations: RelationItem[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (!relations.length) return <p className="relation-empty">本盘没有需要特别标出的合、冲、刑、害、破或半合半会；重点放在五行强弱与日常取舍即可。</p>;
  return <div className="bazi-relation-map" aria-label="八字关键关系连线图">
    <div className="relation-map-canvas relation-map-pillars" style={{ height: `${Math.max(186, 142 + relations.length * 30)}px` }}>
      <div className="relation-map-nodes">
        {pillars.map((pillar, index) => <div className="relation-map-node" key={`bazi-node-${index}`}>
          <small>{pillarLabels[index]}</small>
          <span className={`element-${elementClass[elementOf[pillar[0]] || "土"]}`}>{pillar[0]}</span>
          <b className={`element-${elementClass[elementOf[pillar[1]] || "土"]}`}>{pillar[1]}</b>
        </div>)}
      </div>
      {relations.map((item, index) => {
        const key = relationKey(item, "bazi");
        const from = ((item.leftIndex || 0) + .5) * 25;
        const to = ((item.rightIndex || 1) + .5) * 25;
        return <button type="button" className={`relation-map-link relation-map-row ${item.tone} ${selectedKey === key ? "selected" : ""}`} key={key} style={{ left: `${from}%`, width: `${to - from}%`, top: `${122 + index * 30}px` }} aria-label={`${item.leftLabel}${item.left}与${item.rightLabel}${item.right}：${item.relation}`} aria-pressed={selectedKey === key} onClick={() => onSelect(key)}>
          <i className={`relation-end relation-end-left element-${elementClass[elementOf[item.left] || "土"]}`}>{item.left}</i>
          <span>{shortRelationLabel(item)}</span>
          <i className={`relation-end relation-end-right element-${elementClass[elementOf[item.right] || "土"]}`}>{item.right}</i>
        </button>;
      })}
    </div>
  </div>;
}

function FortuneRelationMap({ fortune, relations, selectedKey, onSelect }: { fortune: string; relations: RelationItem[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (!relations.length) return <p className="relation-empty dark">这步大运与出生八字没有明显的合、冲、刑、害、破或半合半会，影响更像慢慢叠加，重点看五行是否帮助整体平衡。</p>;
  return <div className="fortune-relation-map" aria-label={`${fortune}大运的关键关系连线图`}>
    <div className="fortune-relation-core"><span>本步大运</span><ColoredPillar pillar={fortune} /></div>
    <div className="fortune-relation-list">
      {relations.map((item) => {
        const key = relationKey(item, `fortune-${fortune}`);
        const rightChar = item.layer === "stem" ? fortune[0] : fortune[1];
        return <div className="fortune-relation-row" key={key}>
          <span className="fortune-relation-node">{item.leftLabel}<b className={`element-${elementClass[elementOf[item.left] || "土"]}`}>{item.left}</b></span>
          <button type="button" className={`fortune-relation-link ${item.tone} ${selectedKey === key ? "selected" : ""}`} aria-pressed={selectedKey === key} onClick={() => onSelect(key)}><span>{shortRelationLabel(item)}</span></button>
          <span className="fortune-relation-node">大运{item.layer === "stem" ? "天干" : "地支"}<b className={`element-${elementClass[elementOf[rightChar] || "土"]}`}>{rightChar}</b></span>
        </div>;
      })}
    </div>
  </div>;
}

function PalaceRelationMap({ palace, relations, selectedKey, onSelect }: { palace: Palace; relations: PalaceRelation[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (!relations.length) return <p className="relation-empty">这个宫位的三方、对宫资料暂不完整，可先从本宫星曜和现实经历判断。</p>;
  return <div className="palace-relation-map" aria-label={`${palace.name}的宫位关系连线图`}>
    <div className="palace-relation-focus"><span>当前查看</span><strong>{palace.name}</strong><small>{palace.heavenlyStem}{palace.earthlyBranch}</small></div>
    <div className="palace-relation-list">
      {relations.map((item) => {
        const key = `${palace.name}-${item.target.name}-${item.relation}`;
        return <div className="palace-relation-row" key={key}>
          <span>{palace.name}</span><button type="button" className={`palace-relation-line ${item.tone} ${selectedKey === key ? "selected" : ""}`} aria-pressed={selectedKey === key} onClick={() => onSelect(key)}><i>{item.relation}</i></button><span>{item.target.name}<small>{item.target.heavenlyStem}{item.target.earthlyBranch}</small></span>
        </div>;
      })}
    </div>
  </div>;
}

function RelationCard({ item }: { item: RelationItem }) {
  return <article className={`relation-item ${item.tone}`}>
    <div className="relation-pair">
      <span>{item.leftLabel}<b className={`element-${elementClass[elementOf[item.left] || "土"]}`}>{item.left}</b></span>
      <i>↔</i>
      <span>{item.rightLabel}<b className={`element-${elementClass[elementOf[item.right] || "土"]}`}>{item.right}</b></span>
    </div>
    <strong>{item.relation}</strong>
    <p>{item.meaning}</p>
  </article>;
}

export default function Home() {
  const [form, setForm] = useState({
    name: "林女士", gender: "女" as Gender, calendar: "solar" as CalendarKind, date: "1990-01-01",
    lunarYear: 1990, lunarMonth: 1, lunarDay: 5, isLeapMonth: false,
    time: "12:30", province: "北京市", city: "北京市",
  });
  const [submitted, setSubmitted] = useState(form);
  const [solar, setSolar] = useState(() => trueSolarTime(form.date, form.time, provinces[0].cities[0].longitude));
  const [engine, setEngine] = useState<EngineBazi>(() => {
    const initialSolar = trueSolarTime(form.date, form.time, provinces[0].cities[0].longitude);
    return calculateBazi(initialSolar.date, initialSolar.time, form.gender);
  });
  const [chart, setChart] = useState<Astrolabe>(() => ({
    solarDate: form.date,
    lunarDate: engine.lunarText,
    chineseDate: engine.pillars.join(" "),
    fiveElementsClass: "金四局",
    soul: "贪狼",
    body: "天相",
    palaces: fallbackPalaces,
  }));
  const [isCalculating, setIsCalculating] = useState(false);
  const [formError, setFormError] = useState("");
  const [chartTab, setChartTab] = useState<"bazi" | "ziwei">("bazi");
  const [selectedBaziRelationKey, setSelectedBaziRelationKey] = useState<string | null>(null);
  const [selectedFortuneIndex, setSelectedFortuneIndex] = useState<number | null>(null);
  const [selectedFortuneRelationKey, setSelectedFortuneRelationKey] = useState<string | null>(null);
  const [selectedPalaceName, setSelectedPalaceName] = useState("命宫");
  const [selectedZiweiRelationKey, setSelectedZiweiRelationKey] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "命盘已就绪。你可以直接问事业、财富、情感或某个阶段的选择，我会结合四柱与紫微盘直说重点。" },
  ]);
  const resultRef = useRef<HTMLElement>(null);
  const pillars = engine.pillars;
  const analysis = useMemo(() => buildAnalysis(pillars, engine), [pillars, engine]);
  const baziRelations = useMemo(() => buildBaziRelations(pillars), [pillars]);
  const selectedBaziRelation = baziRelations.visualRelations.find((item) => relationKey(item, "bazi") === selectedBaziRelationKey) || null;
  const selectedProvince = useMemo(() => provinces.find((item) => item.name === form.province) || provinces[0], [form.province]);
  const luck = useMemo(() => buildLuck(pillars, submitted.gender, analysis, chart, engine), [pillars, submitted.gender, analysis, chart, engine]);
  const fortunes = luck.fortunes;
  const selectedFortune = selectedFortuneIndex === null ? null : fortunes[selectedFortuneIndex];
  const selectedCompatibility = useMemo(
    () => selectedFortune ? buildFortuneCompatibility(pillars, selectedFortune.pillar, analysis) : null,
    [pillars, selectedFortune, analysis],
  );
  const selectedFortuneRelation = selectedCompatibility?.visualRelations.find((item) => relationKey(item, `fortune-${selectedFortune?.pillar || ""}`) === selectedFortuneRelationKey) || null;
  const selectedPalaceDetail = useMemo(() => buildZiweiPalaceDetail(chart, analysis, selectedPalaceName), [chart, analysis, selectedPalaceName]);
  const selectedZiweiRelation = selectedPalaceDetail.relations.find((item) => `${selectedPalaceDetail.palace.name}-${item.target.name}-${item.relation}` === selectedZiweiRelationKey) || null;
  const lifeReadings = useMemo(() => buildLifeReadings(analysis, chart, submitted.gender), [analysis, chart, submitted.gender]);
  const personalitySummary = useMemo(() => buildPersonalitySummary(analysis, chart), [analysis, chart]);
  const patternInsight = useMemo(() => buildPatternInsight(analysis), [analysis]);
  const turningFortunes = fortunes.filter((fortune) => fortune.isTurningPoint);
  const careerTurningFortunes = fortunes.filter((fortune) => fortune.isCareerTurningPoint);
  const relationshipTurningFortunes = fortunes.filter((fortune) => fortune.isRelationshipTurningPoint);
  const turningGroups = [
    { key: "overall", symbol: "全", title: "全盘关键转折", description: "大运先与出生盘形成互动，再由流年催动；看环境、角色与整体节奏的阶段变化。", items: turningFortunes, years: turningFortunes.map((fortune) => fortune.annualSignals.overall) },
    { key: "career", symbol: "业", title: "事业关键转折", description: "仅从成年后开始：大运先形成事业主题，流年再引动原局月柱或沿岁运链完成触发；单一十神、单一宫位不列入。", items: careerTurningFortunes, years: careerTurningFortunes.map((fortune) => fortune.annualSignals.career) },
    { key: "relationship", symbol: "情", title: "感情关键转折", description: "只看成年后：大运先由配偶星、日支或紫微关系宫位带出主题，流年再触及配偶星或日支；用于观察确认、协商与边界变化。", items: relationshipTurningFortunes, years: relationshipTurningFortunes.map((fortune) => fortune.annualSignals.relationship) },
  ] as const;
  const progressFortunes = fortunes.filter((fortune) => fortune.mode === "进取");
  const cautiousFortunes = fortunes.filter((fortune) => fortune.mode === "蓄势");

  useEffect(() => {
    let attempts = 0;
    const syncZiwei = () => {
      if (!window.iztro) return false;
      const nextChart = getAstrolabe(solar.date, solar.time, submitted.gender);
      setChart({ ...nextChart, lunarDate: engine.lunarText, chineseDate: engine.pillars.join(" ") });
      return true;
    };
    if (syncZiwei()) return;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (syncZiwei() || attempts >= 20) window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [engine, solar.date, solar.time, submitted.gender]);

  function submitBirth(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const baseDate = form.calendar === "solar"
      ? form.date
      : solarDateFromLunar(form.lunarYear, form.lunarMonth, form.lunarDay, form.isLeapMonth);
    if (!baseDate) {
      setFormError("这个农历日期无法排盘，请确认当月日期以及是否为闰月。");
      return;
    }
    setIsCalculating(true);
    const province = provinces.find((item) => item.name === form.province) || provinces[0];
    const city = province.cities.find((item) => item.name === form.city) || province.cities[0];
    const adjusted = trueSolarTime(baseDate, form.time, city.longitude);
    window.setTimeout(() => {
      const nextEngine = calculateBazi(adjusted.date, adjusted.time, form.gender);
      const nextChart = getAstrolabe(adjusted.date, adjusted.time, form.gender);
      setSolar(adjusted);
      setEngine(nextEngine);
      setChart({ ...nextChart, lunarDate: nextEngine.lunarText, chineseDate: nextEngine.pillars.join(" ") });
      setSubmitted(form);
      setSelectedBaziRelationKey(null);
      setSelectedFortuneIndex(null);
      setSelectedFortuneRelationKey(null);
      setSelectedPalaceName("命宫");
      setSelectedZiweiRelationKey(null);
      setMessages([{ role: "assistant", text: `${form.name || "命主"}的双盘已重新排好。四柱与起运已按真太阳时、节气与出生性别重新计算；接下来的判断会标明依据与不确定度，不沿用上一位的结论。` }]);
      setIsCalculating(false);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 650);
  }

  function sendQuestion(text = question) {
    const clean = text.trim();
    if (!clean) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: clean }, { role: "assistant", text: answerQuestion(clean, analysis, chart, luck, submitted.gender) }]);
  }

  const heroPillars = pillars.length === 4 ? pillars : ["庚午", "戊子", "丙寅", "甲午"];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="玄机首页"><span className="brand-mark">玄</span><span>玄机</span><small>知命 · 明势 · 笃行</small></a>
        <nav aria-label="主要导航"><a href="#chart">命盘</a><a href="#reading">解读</a><a href="#fortune">大运</a></nav>
        <a className="nav-action" href="#consult">开始问询 <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="hero-copy">
          <div className="eyebrow"><span>✦</span> 四柱八字 × 紫微斗数 · 两张命盘一起看</div>
          <h1>见天地，<br /><em>更见自己</em></h1>
          <p className="hero-lead">以真太阳时为起点，循古法排盘，结合现代语境，为你梳理人生节奏与选择。</p>
          <div className="classic-row"><span>《渊海子平》</span><i>·</i><span>《滴天髓》</span><i>·</i><span>《周易》</span><i>·</i><span>盲派技法</span></div>
          <div className="seal-note"><span>不神化命运</span><span>只提供一面清醒的镜子</span></div>
        </div>

        <form className="birth-card" onSubmit={submitBirth}>
          <div className="card-title"><div><span>起</span><div><h2>为你排盘</h2><p>信息仅用于本次推演</p></div></div><b>天机可参</b></div>
          <label>如何称呼你<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="输入称呼" /></label>
          <div className="calendar-picker" aria-label="历法选择">
            <span>生日历法</span>
            <div>
              <button type="button" className={form.calendar === "solar" ? "active" : ""} onClick={() => setForm({ ...form, calendar: "solar" })}>公历</button>
              <button type="button" className={form.calendar === "lunar" ? "active" : ""} onClick={() => setForm({ ...form, calendar: "lunar" })}>农历</button>
            </div>
            <small>{form.calendar === "solar" ? "按公历日期直接校准" : "先转公历，再校准真太阳时"}</small>
          </div>
          <div className="form-grid">
            <label>生理性别<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}><option>男</option><option>女</option></select></label>
            <label>出生省份<select value={form.province} onChange={(e) => {
              const province = provinces.find((item) => item.name === e.target.value) || provinces[0];
              setForm({ ...form, province: province.name, city: province.cities[0].name });
            }}>{provinces.map((province) => <option key={province.name}>{province.name}</option>)}</select></label>
            <label>出生城市<select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{selectedProvince.cities.map((city) => <option key={city.name}>{city.name}</option>)}</select></label>
            {form.calendar === "solar" ? (
              <label>公历生日<input type="date" min="1900-01-01" max="2100-12-31" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            ) : (
              <label className="lunar-date-field">农历生日
                <div className="lunar-date-row">
                  <select aria-label="农历年" value={form.lunarYear} onChange={(e) => setForm({ ...form, lunarYear: Number(e.target.value) })}>{lunarYears.map((year) => <option key={year} value={year}>{year}年</option>)}</select>
                  <select aria-label="农历月" value={form.lunarMonth} onChange={(e) => setForm({ ...form, lunarMonth: Number(e.target.value), isLeapMonth: false })}>{lunarMonths.map((month) => <option key={month} value={month}>{month}月</option>)}</select>
                  <select aria-label="农历日" value={form.lunarDay} onChange={(e) => setForm({ ...form, lunarDay: Number(e.target.value) })}>{lunarDays.map((day) => <option key={day} value={day}>{day}日</option>)}</select>
                </div>
                <span className="leap-check"><input type="checkbox" checked={form.isLeapMonth} onChange={(e) => setForm({ ...form, isLeapMonth: e.target.checked })} /> 此月为闰月</span>
              </label>
            )}
            <label>出生时间<input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="solar-hint"><span>◐</span><div><strong>自动校准真太阳时</strong><small>依据出生地经度与当日均时差修正</small></div><i>已开启</i></div>
          <button className="primary-button" type="submit" disabled={isCalculating}>{isCalculating ? "正在观天察时…" : "开启命盘"}<span>{isCalculating ? "◌" : "→"}</span></button>
          <p className="privacy">◇ 出生信息仅在当前设备中处理，不会保存</p>
        </form>
      </section>

      <section className="result-section" ref={resultRef} id="chart">
        <div className="section-intro">
          <div><span className="section-kicker">命盘总览</span><h2>{submitted.name || "命主"}的命盘</h2></div>
          <div className="solar-proof"><span>真太阳时 · {submitted.calendar === "lunar" ? "农历换算后" : "公历输入"}</span><strong>{solar.date.replaceAll("-", ".")} · {solar.time}</strong><small>{submitted.province} · {submitted.city} {solar.longitude.toFixed(2)}°E · 较北京时间 {solar.minutes >= 0 ? "+" : ""}{solar.minutes} 分钟</small></div>
        </div>

        <div className="chart-tabs" role="tablist">
          <button className={chartTab === "bazi" ? "active" : ""} onClick={() => setChartTab("bazi")} role="tab">四柱八字</button>
          <button className={chartTab === "ziwei" ? "active" : ""} onClick={() => setChartTab("ziwei")} role="tab">紫微命盘</button>
        </div>

        {chartTab === "bazi" ? (
          <div className="bazi-panel">
            <div className="pillars">
              {heroPillars.map((pillar, index) => (
                <div className={`pillar pillar-${index}`} key={`${pillar}-${index}`}>
                  <span>{["年柱", "月柱", "日柱", "时柱"][index]}</span>
                  <div className={`stem element-${elementClass[elementOf[pillar[0]] || "土"]}`}><span className="glyph">{pillar[0]}</span><i>{elementOf[pillar[0]] || "土"}</i></div>
                  <div className={`branch element-${elementClass[elementOf[pillar[1]] || "土"]}`}><span className="glyph">{pillar[1]}</span><i>{elementOf[pillar[1]] || "土"}</i></div>
                  <strong>{analysis.tenGods[index]?.god || "—"}</strong>
                  <small>藏干 {analysis.tenGods[index]?.hidden || "—"}</small>
                </div>
              ))}
            </div>
            <div className="element-legend" aria-label="五行颜色图例">
              {(["木", "火", "土", "金", "水"] as ElementName[]).map((element) => <span className={`element-${elementClass[element]}`} key={element}><i />{element}<small>{labels[element].split("与")[0]}</small></span>)}
            </div>
            <div className="chart-summary">
              <div className="day-master"><span>日主</span><b>{analysis.dayStem}</b><p>{analysis.dayElement}命 · {labels[analysis.dayElement]}</p></div>
              <div className="balance-mini"><span>旺衰</span><strong>{analysis.strength}</strong><small>月令 · 根气 · 帮扶与泄耗 · {analysis.uncertainty}不确定度</small></div>
              <div className="useful-gods"><span>喜用</span><div>{analysis.favorable.map((item) => <b className={`element-${elementClass[item]}`} key={item}>{item}</b>)}</div><small>宜顺势而用</small></div>
            </div>
            <div className="bazi-key-relations">
              <div className="key-relations-head"><div><span>四柱关系</span><h3>干支之间的互动</h3><p>{baziRelations.summary}</p></div></div>
              <BaziRelationMap pillars={heroPillars} relations={baziRelations.visualRelations} selectedKey={selectedBaziRelationKey} onSelect={(key) => setSelectedBaziRelationKey((current) => current === key ? null : key)} />
              {selectedBaziRelation && <RelationDetail item={selectedBaziRelation} title="八字关系详解" />}
            </div>
          </div>
        ) : (
          <>
            <div className="ziwei-grid">
              {chart.palaces.map((palace, index) => {
                const position = ringPositions[index] || ringPositions[0];
                return <button type="button" className={`palace ${palace.name.includes("命") ? "life-palace" : ""} ${selectedPalaceDetail.palace.name === palace.name ? "selected" : ""}`} style={{ gridColumn: position.col, gridRow: position.row }} key={`${palace.name}-${index}`} aria-pressed={selectedPalaceDetail.palace.name === palace.name} onClick={() => { setSelectedPalaceName(palace.name); setSelectedZiweiRelationKey(null); }}>
                  <div className="palace-head"><b>{palace.name}</b><span>{palace.heavenlyStem}{palace.earthlyBranch}</span></div>
                  <div className="stars">{palace.majorStars.slice(0, 3).map((star) => <strong key={star.name}>{star.name}<small>{star.brightness}</small></strong>)}</div>
                  <p>{palace.minorStars.slice(0, 3).map((star) => star.name).join(" · ") || "辅星平守"}</p>
                  {palace.isBodyPalace && <i>身宫</i>}
                </button>;
              })}
              <div className="ziwei-center">
                <span className="mini-seal">玄</span><p>{submitted.gender}命 · {chart.fiveElementsClass || "五行局"}</p><h3>{heroPillars.join(" · ")}</h3><small>{chart.lunarDate}</small><div><span>命主 {chart.soul || "—"}</span><span>身主 {chart.body || "—"}</span></div>
              </div>
            </div>
            <div className="ziwei-focus-panel">
              <div className="ziwei-focus-head"><span>点击宫位查看</span><h3>{selectedPalaceDetail.palace.name} · {selectedPalaceDetail.palace.heavenlyStem}{selectedPalaceDetail.palace.earthlyBranch}</h3><p>主星：{selectedPalaceDetail.stars}</p></div>
              <p className="ziwei-direct"><b>{selectedPalaceDetail.direct}</b></p>
              <PalaceRelationMap palace={selectedPalaceDetail.palace} relations={selectedPalaceDetail.relations} selectedKey={selectedZiweiRelationKey} onSelect={(key) => setSelectedZiweiRelationKey((current) => current === key ? null : key)} />
              {selectedZiweiRelation && <div className={`ziwei-relation-detail ${selectedZiweiRelation.tone}`}><span>宫位连线详解 · {selectedZiweiRelation.relation}</span><h4>{selectedPalaceDetail.palace.name} ↔ {selectedZiweiRelation.target.name}</h4><p>{selectedZiweiRelation.meaning}</p><em>作用：这条线用于把本宫的判断放到{selectedZiweiRelation.target.name}所代表的现实领域里核验，不能只看单一宫位。</em></div>}
              <div className="ziwei-focus-advice"><span>落地建议</span><p>{selectedPalaceDetail.action}</p><small>提醒：{selectedPalaceDetail.watch}</small></div>
            </div>
          </>
        )}
        <p className="chart-footnote">四柱采用真太阳时、节气历法与子初换日规则；起运按性别与节气时差精确换算。出生恰在节气或子时交界前后，建议用出生证明时间复核。</p>
      </section>

      <section className="reading-section" id="reading">
        <div className="reading-heading"><span>命 理 初 解</span><h2>先给结论，再讲依据</h2><p>先用一句话说清性格、事业、财富与情感的重点，再展开命盘依据与可执行建议。命盘给的是倾向，不替代现实能力、经验与选择。</p></div>
        <div className="reading-grid">
          <article className="personality-card">
            <div className="personality-mark"><span>人</span><small>八字 × 紫微</small></div>
            <div><span>性格总判</span><h3>{personalitySummary.headline}</h3><p>{personalitySummary.summary}</p></div>
            <div className="personality-conclusion"><b>{personalitySummary.verdict}</b><p>{personalitySummary.advice}</p></div>
          </article>
          <article className="strength-card">
            <div className="article-title"><span>01</span><div><small>体用平衡</small><h3>{analysis.dayStem}{analysis.dayElement}日主 · {analysis.strength}</h3></div><b className="certainty-mark">{analysis.uncertainty === "中" ? "中等" : "较低"}<small>结论保留程度</small></b></div>
            <p>这里的“身强、身弱”说的是在这张命局里承受压力、调动资源的相对状态，不是身体好坏，也不是性格强弱。判断先看出生月份，再看地支根气、天干帮扶与泄耗是否同向；它不适合被简化成固定百分比。{analysis.strengthReason}</p>
            <div className="evidence-list" aria-label="旺衰判断依据">
              {analysis.evidence.map((evidence, index) => <div key={evidence}><b>{index < 4 ? "原局依据" : "综合参考"}</b><span>{evidence}</span></div>)}
            </div>
            <div className="god-row"><span>用神 <b className={`element-${elementClass[analysis.favorable[0]]}`}>{analysis.favorable[0]}</b></span><span>喜神 <b className={`element-${elementClass[analysis.favorable[1]]}`}>{analysis.favorable[1]}</b></span><span>慎用 <b>{analysis.avoid.join("、")}</b></span></div>
            <div className="balance-insights">
              <div><span>判断结论</span><strong>当前定为{analysis.strength}</strong><p>{analysis.strengthReason}</p></div>
              <div><span>体用路径</span><strong>先用{analysis.favorable[0]}，再借{analysis.favorable[1]}</strong><p>{elementGuidance[analysis.favorable[0]].title}是主线，{elementGuidance[analysis.favorable[1]].title}用来辅助落地。</p></div>
              <div><span>需要节制</span><strong>{analysis.avoid.join("、")}不宜再过度加码</strong><p>{analysis.interactions.length ? `出生八字又见${analysis.interactions.join("、")}，遇到相似的大运时应多留一次复核。` : "出生八字的合冲信号不重，更适合稳定积累，不必为了变化而变化。"}</p></div>
            </div>
          </article>
          <article className="pattern-card">
            <div className="article-title compact"><span>02</span><div><small>十神关系</small><h3>看见行为模式</h3></div></div>
            <div className="ten-gods">{analysis.tenGods.map((item) => <div key={item.label}><span>{item.label}</span><strong className={`element-${elementClass[item.element]}`}><span>{item.god}</span><i>{item.element}</i></strong><small>藏干 {item.hidden}</small></div>)}</div>
            <blockquote>“旺者宜泄，弱者宜扶。取用之道，不离中和。”</blockquote>
            <p>{patternInsight}</p>
            <div className="useful-action-list">
              {analysis.favorable.map((element, index) => <div key={`action-${element}`}>
                <b className={`element-${elementClass[element]}`}>{index === 0 ? "用神" : "喜神"}·{element}</b>
                <strong>{elementGuidance[element].title}</strong>
                <p>{elementGuidance[element].steps.map((step, stepIndex) => `${stepIndex + 1}．${step}`).join("；")}。</p>
              </div>)}
            </div>
          </article>
          <article className="life-card">
            {lifeReadings.map((item) => <div className="life-item" key={item.label}><span className="life-icon">{item.icon}</span><div><small>{item.label}总判</small><h3>{item.headline}</h3><b className="life-verdict">{item.verdict}</b><p>{item.text}</p><b>本盘依据 · {item.keywords}</b></div></div>)}
          </article>
        </div>
      </section>

      <section className="fortune-section" id="fortune">
        <div className="fortune-heading"><div><span>十年一步</span><h2>大运走势</h2></div><p>大运反映十年左右的阶段重点，不是简单的“好或坏”；点击任一步大运，可以查看它与出生八字怎样配合。</p></div>
        <div className="luck-start-card">
          <div><span>实际起运时刻</span><strong>{luck.startDateText}</strong><small>出生后 {luck.startAgeText} 起运</small></div>
          <div><span>推算依据</span><strong>{luck.directionLabel} · 节气精确换算</strong><small>性别、出生时刻与相邻节气时差共同参与计算</small></div>
          <p>起运使用与四柱同源的节气历法与子初换日规则计算到具体时刻，不再用统一年龄或手工估算替代。</p>
        </div>
        <div className="fortune-legend"><span><i className="dot progress" />适合进取</span><span><i className="dot steady" />稳中求进</span><span><i className="dot pause" />蓄势调整</span></div>
        <div className="timeline">
          {fortunes.map((fortune, index) => <button type="button" className={`fortune-node ${fortune.mode === "进取" ? "progress" : fortune.mode === "蓄势" ? "pause" : "steady"} ${selectedFortuneIndex === index ? "selected" : ""}`} key={`${fortune.pillar}-${index}`} aria-expanded={selectedFortuneIndex === index} aria-controls="fortune-compatibility" aria-label={`查看${fortune.pillar}大运与八字的配合关系`} onClick={() => { setSelectedFortuneIndex((current) => current === index ? null : index); setSelectedFortuneRelationKey(null); }}>
            <span className="node-age">{Math.floor(fortune.age)}<small>岁</small></span><i /><strong><ColoredPillar pillar={fortune.pillar} /></strong><small>{fortune.ageText}<br />{fortune.years}</small><b>{fortune.mode}</b>
            {(fortune.isTurningPoint || fortune.isCareerTurningPoint || fortune.isRelationshipTurningPoint) && <span className="turn-tags">{fortune.isTurningPoint && <em className="overall">全盘</em>}{fortune.isCareerTurningPoint && <em className="career">事业</em>}{fortune.isRelationshipTurningPoint && <em className="relationship">感情</em>}</span>}
          </button>)}
        </div>
        {selectedFortune && selectedCompatibility && <div className="fortune-combo-panel" id="fortune-compatibility">
          <div className="combo-head">
            <div><span>已选择</span><h3><ColoredPillar pillar={selectedFortune.pillar} suffix="大运" /></h3><p>{selectedFortune.years} · {selectedFortune.mode} · 大运天干对日主来说是{selectedCompatibility.fortuneGod}</p></div>
            <button type="button" onClick={() => { setSelectedFortuneIndex(null); setSelectedFortuneRelationKey(null); }}>收起</button>
          </div>
          <p className="combo-summary"><b>这步运的总判：</b>{selectedCompatibility.summary}</p>
          <FortuneRelationMap fortune={selectedFortune.pillar} relations={selectedCompatibility.visualRelations} selectedKey={selectedFortuneRelationKey} onSelect={(key) => setSelectedFortuneRelationKey((current) => current === key ? null : key)} />
          {selectedFortuneRelation && <RelationDetail item={selectedFortuneRelation} title={`${selectedFortune.pillar}大运关系详解`} />}
        </div>}
        <div className="fortune-advice">
          <div><span>↗</span><h3>可适度进取的阶段</h3><p>{progressFortunes.length ? `${progressFortunes.slice(0, 3).map((item) => `${item.pillar}运（${item.years}，紫微十年主题在${item.decadalPalace}）`).join("；")}。这些阶段有助于平衡的条件相对多，可在明确成本、验收点与退出条件后争取职位、市场或资源。` : `本盘前八步运暂未出现明确“进取”档，宜先按${labels[analysis.favorable[0]]}的方式逐步验证。`}</p></div>
          <div><span>⌁</span><h3>需要稳守的阶段</h3><p>{cautiousFortunes.length ? `${cautiousFortunes.slice(0, 3).map((item) => `${item.pillar}运（${item.years}，紫微十年主题在${item.decadalPalace}）`).join("；")}。此时优先守现金流、身体节律和合作边界。` : "没有明显需要全面收缩的阶段，但重大决定仍应保留复核窗口。"}</p></div>
          <div><span>◇</span><h3>判断方式</h3><p>“进取、稳进、蓄势”是把大运五行是否有助于平衡，与紫微这十年的宫位和星曜放在一起比较；“关键转折”表示变化信号较集中，不按固定年龄贴标签。</p></div>
        </div>
        <div className="turning-detail">
          <div><span>八字与紫微一起看 · 三类转折</span><h3>关键转折的依据与建议</h3><p>“关键转折”不是把某年直接断成某件事，而是大运先定阶段主题、流年再给出触发点；紫微对应宫位用于判断变化更可能落在何处。每类只保留最清楚的两处，感情类仅从成年阶段起看。</p></div>
          <div className="turning-groups">
            {turningGroups.map((group) => <section className={`turning-group ${group.key}`} key={group.key}>
              <header><i>{group.symbol}</i><div><span>{group.title}</span><p>{group.description}</p>{group.years.length ? <div className="turning-year-list"><small>重点年份 · 以立春为界</small>{group.years.map((signal) => <div key={`${group.key}-${signal.year}`}><b>{signal.year}</b><span>{signal.pillar} · {signal.reason}</span></div>)}</div> : <p className="turning-empty">未见同时具备阶段主题和流年触发的清楚窗口，本栏不强行输出年份。</p>}</div></header>
              <div className="turning-cards">
                {group.items.length ? group.items.map((fortune) => {
                  const reasons = group.key === "career" ? fortune.careerReasons : group.key === "relationship" ? fortune.relationshipReasons : fortune.turnReasons;
                  const advice = group.key === "career" ? fortune.careerAdvice : group.key === "relationship" ? fortune.relationshipAdvice : fortune.mode === "进取" ? `围绕${labels[analysis.favorable[0]]}主动争取可量化的权责，但分阶段投入。` : fortune.mode === "蓄势" ? "先稳现金流与关系边界，避免在变化信号最强时一次性押注。" : `小步试错、季度复盘，以${fortune.decadalPalace}相关现实事件决定是否加码。`;
                  const annual = group.key === "career" ? fortune.annualSignals.career : group.key === "relationship" ? fortune.annualSignals.relationship : fortune.annualSignals.overall;
                  const basis = group.key === "career" ? `${fortune.fortuneGod} · 紫微十年主题在${fortune.decadalPalace} · ${fortune.mode}` : group.key === "relationship" ? `${fortune.fortuneGod} · ${fortune.dayRelation} · 紫微十年主题在${fortune.decadalPalace}` : `${fortune.element}${fortune.branchElement}运 · 紫微十年主题在${fortune.decadalPalace}`;
                  const verification = group.key === "career" ? "以岗位、合同、收入结构或项目验收的实际变化为证，不只看主观感受。" : group.key === "relationship" ? "以承诺、联系频率、金钱安排和共同计划是否落实为证。" : "观察居住、团队、职责或现金流中，是否出现持续三个月以上的结构变化。";
                  return <article key={`${group.key}-${fortune.pillar}`}>
                    <div><strong><ColoredPillar pillar={fortune.pillar} suffix="运" /></strong><span>{fortune.years} · {fortune.mode}</span></div>
                    <p>{reasons.join("；") || `大运五行为${fortune.element}${fortune.branchElement}，与出生八字的喜忌形成阶段差异。`}</p>
                    <dl className="turning-card-facts">
                      <div><dt>运内重点年</dt><dd>{annual.year} · {annual.pillar}</dd></div>
                      <div><dt>命盘依据</dt><dd>{basis}</dd></div>
                      <div><dt>现实核验</dt><dd>{verification}</dd></div>
                    </dl>
                    <em>建议：{advice}</em>
                  </article>;
                }) : <p className="turning-empty card-empty">本阶段可按大运的进取、稳进或蓄势建议观察；出现岗位、承诺或居住等持续变化后，再结合具体年份复核。</p>}
              </div>
            </section>)}
          </div>
        </div>
        <p className="calculation-note">起运已按真实出生时刻、真太阳时与定气节气计算，不再统一使用固定年龄。若出生恰在节气交界前后，建议用出生证明时间复核；不同门派的早晚子时规则仍可能造成细微差异。</p>
      </section>

      <section className="consult-section" id="consult">
        <div className="consult-copy"><span>命盘问询</span><h2>心中有惑，<br />不妨直问</h2><p>回答会结合当前八字与紫微盘，但保留你的现实选择权。</p><div className="suggestions">{["我适合创业吗？", "未来三年财运如何？", "感情里要注意什么？"].map((item) => <button onClick={() => sendQuestion(item)} key={item}>{item}<span>→</span></button>)}</div></div>
        <div className="chat-card">
          <div className="chat-head"><div><span className="avatar">玄</span><div><strong>玄机解盘</strong><small><i /> 在线 · 规则引擎演示版</small></div></div><span>两盘一起看</span></div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === "assistant" ? "玄机" : submitted.name}</small><p>{message.text}</p></div>)}
          </div>
          <div className="chat-input"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }} placeholder="说说你当下最困惑的事…" aria-label="输入你的问题" /><button onClick={() => sendQuestion()} aria-label="发送问题">↑</button></div>
          <p>演示版为本地规则解读，正式版接入大模型后可进行连续深度问答。</p>
        </div>
      </section>

      <footer><div className="footer-brand"><span>玄</span><div><strong>玄机</strong><small>传统智慧 · 现代洞察</small></div></div><p>命理是一种观察视角，而非人生判决。愿你知命而不困于命，明势而后笃行。</p><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}
