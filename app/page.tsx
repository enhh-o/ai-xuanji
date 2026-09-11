"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { provinces } from "./china-cities";
import { calculateAnnualPillar, calculateBazi, solarFromLunarDate, type EngineBazi } from "./bazi-engine";
import { buildChatContext } from "./chat-context";
import { analyzeLocal, type LocalReport } from "./analysis";
import { nodeText } from "./analysis/facts";
import { FortuneYearPanel } from "./fortune-year-panel";
import { LocalReview } from "./local-review";
import { calculateQimen } from "./qimen-engine";
import { QimenPanel } from "./qimen-panel";

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
  const structuralNames = [...new Set(structural.map((item) => item.relation))];
  const structureText = structuralNames.length
    ? `地支较明显的互动是${structuralNames.join("；")}。`
    : "大运地支与出生八字没有明显合冲刑害破，影响更像缓慢叠加。";
  const groupText = completed.length ? `大运加入后还凑齐${completed.map((group) => `${group.members.join("")}${group.kind}${group.element}局`).join("、")}，相关五行主题会更集中，但能否形成稳定力量仍要看全盘强弱和现实条件。` : "大运没有额外凑齐完整的三合或三会。";
  return {
    stemRelations, branchRelations, fortuneGod,
    visualRelations: [...stemRelations.filter((item) => item.structural), ...structural, ...completedRelations],
    summary: `大运天干${fortunePillar[0]}对日主${analysis.dayStem}来说是${fortuneGod}。${structureText}${groupText}原局暂定${analysis.strength}，取用仍待格局与调候复核，不能按合冲条数定吉凶。建议先观察被引动的柱位在实际生活中的变化，再决定投入与调整。`,
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
  const rootBranches = pillars.map((pillar, index) => ({ branch: pillar[1], hidden: hidden[index],
    disturbed: pillars.some((other, otherIndex) => otherIndex !== index && branchClashes[pillar[1]] === other[1]),
  }));
  const rootLocations = (target: ElementName) => rootBranches.flatMap((item, index) => [...new Set(item.hidden.split("").filter((stem) => elementOf[stem] === target))].map((stem) => `${pillarLabels[index]}${item.branch}藏${stem}（${item.hidden[0] === stem ? "本气" : "中余气"}${item.disturbed ? "，逢冲受扰，不直接视为拔根" : ""}）`));
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
  const stableSelfRoot = rootBranches.some(item => elementOf[item.hidden[0]] === dayElement && !item.disturbed);
  const rootConflict = rootBranches.some(item => item.disturbed && item.hidden.split("").some(stem => [dayElement, resource].includes(elementOf[stem])));
  const strength = monthSupports && stableSelfRoot && hasSupportStem && !rootConflict
    ? "中和偏旺"
    : monthPressures && !supportExists
      ? "偏弱"
      : monthPressures && !stableSelfRoot ? "中和偏弱" : "强弱待辨";
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
  // 分开保留透干、藏干和根气，出现次数只描述分布，不代表力量。
  const godProfiles = Object.keys(godCounts).map(god => {
    const exposed = pillars.flatMap((p, i) => i !== 2 && tenGod(dayStem, p[0]) === god ? [`${pillarLabels[i]}${p[0]}`] : []);
    const rooted = rootBranches.flatMap((r, i) => r.hidden.split("").filter(s => tenGod(dayStem, s) === god).map(s => `${pillarLabels[i]}${r.branch}藏${s}${r.disturbed ? "（根气受冲，需复核）" : ""}`));
    const seasonal = hidden[1]?.[0] && tenGod(dayStem, hidden[1][0]) === god;
    const effective = exposed.length > 0 && rooted.length > 0;
    return { god, exposed, rooted, seasonal: Boolean(seasonal), effective };
  });
  const combinations = [
    { gods: ["七杀", "食神"], name: "食神与七杀同见", question: "须分辨食神能否制杀，还是食神受制、七杀仍形成压力" },
    { gods: ["七杀", "正印"], name: "七杀与正印同见", question: "须核实官杀生印、印再生身的链条是否通畅" },
    { gods: ["伤官", "正官"], name: "伤官与正官同见", question: "须核实是否有印制伤或财星通关，不能直接断官非或失业" },
    { gods: ["正财", "正印"], name: "财与印同见", question: "须区分财印相碍与各有所用，不能直接把财列忌" },
  ].filter(rule => rule.gods.every(god => godProfiles.some(p => p.god === god && p.exposed.length > 0)));
  const climate = ["亥", "子", "丑"].includes(pillars[1][1]) ? "冬月，需另查寒暖与调候，不能只按生扶选用神" : ["巳", "午", "未"].includes(pillars[1][1]) ? "夏月，需另查燥湿与调候，不能只按泄耗选用神" : "还需结合全局寒暖燥湿核对取用";
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
  const uncertainty = strength === "强弱待辨" || rootConflict || !supportExists ? "高" : "中";
  const strengthReason = `${monthSupports ? "月令有生扶背景" : "月令有泄耗或制约背景"}；${selfRootDetails.length ? `同类根气见${selfRootDetails.join("、")}` : "地支未见同类根气"}；${supportStemDetails.length ? `天干${supportStemDetails.join("、")}提供支持` : "天干印比支持不显"}。按常规扶抑暂定为${strength}，不是最终用神裁决。${!supportExists ? "生扶稀少时还须辨别普通身弱与从势，二者取用可能相反。" : rootConflict ? "根气受冲后的实际状态会影响方向，不能见根就当有力。" : "格局、制化与调候仍需另行核对。"}`;
  const usefulReason = `扶抑候选为${favorable.join("、")}，并非已定用神。${climate}。${combinations.map(item => `${item.name}：${item.question}。`).join("")}${strength === "强弱待辨" || !supportExists ? "当前不宜据此判定岁运吉凶或选择职业。" : "候选方向只有在不破坏格局、制化链条时才适用。"}`;
  return {
    dayStem, dayElement, strength, favorable, avoid, tenGods, godCounts, pillars,
    natalBranches, interactions: [...new Set(interactions)], evidence, uncertainty, strengthReason, usefulReason,
    godProfiles, combinations, climate, usefulStatus: "待复核" as const,
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
  if (!palace) return "紫微资料未就绪";
  const stars = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
  return stars.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join("、") || "空宫借对宫";
}

function buildLuck(pillars: string[], gender: Gender, analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, engine: EngineBazi, now = new Date(), horizon = 10, sharedReport?: LocalReport) {
  const report=sharedReport || analyzeLocal({pillars,gender,birthDate:engine.birthDate,asOf:now.toISOString().slice(0,10),horizon,fortunes:engine.fortunes});
  const currentYear = now.getFullYear();
  const birthYear = Number(engine.birthDate?.slice(0, 4) || engine.fortunes[0]?.startYear - engine.fortunes[0]?.startAge + 1);
  const spouseGods = gender === "男" ? ["正财", "偏财"] : ["正官", "七杀"];
  const branchHit = (a: string, b: string) => a === b || branchClashes[a] === b || branchHarmonies[a] === b || branchHarmPairs.has(orderedPair(a, b, branches)) || branchPunishmentPairs.has(orderedPair(a, b, branches));
  const relationText = (a: string, b: string) => a === b ? `${a}重见` : buildBranchRelation(a, b, "岁运", "原局").relation;
  const fortunes = engine.fortunes.slice(0, 8).map((source, index) => {
    const { pillar, startYear, endYear } = source;
    const fortuneGod = tenGod(analysis.dayStem, pillar[0]);
    const day = pillars[2][1], month = pillars[1][1];
    const natalRoots = analysis.natalBranches.flatMap(b => hiddenStem[b].split(""));
    const luckDay = branchHit(pillar[1], day), luckMonth = branchHit(pillar[1], month);
    const luckNatal = analysis.natalBranches.some(b => branchHit(pillar[1], b));
    const luckSpouse = spouseGods.includes(fortuneGod) || hiddenStem[pillar[1]].split("").some(s => spouseGods.includes(tenGod(analysis.dayStem, s)));
    const natalSpouse = analysis.godProfiles.filter(p => spouseGods.includes(p.god));
    const stemElement = elementOf[pillar[0]], branchElement = elementOf[pillar[1]];
    const reviewed=report.fortunes[index];
    const assessment={...reviewed, modeReason:reviewed.reason};
    const { mode, modeReason, modeTone } = assessment;
    const turnReasons = [
      `原局暂定${analysis.strength}；本运透${pillar[0]}（${fortuneGod}），地支${pillar[1]}藏${hiddenStem[pillar[1]]}`,
      ...pillars.flatMap((p,i) => branchHit(pillar[1],p[1]) ? [`大运与${pillarLabels[i]}${p[1]}：${relationText(pillar[1],p[1])}`] : []),
      modeReason,
    ];
    const careerReasons = [`本运天干${pillar[0]}为${fortuneGod}；原局官杀印与食伤须分别核对`,
      luckMonth ? `本运${pillar[1]}与月支${month}形成${relationText(pillar[1],month)}，职业环境或学习路径是观察重点` : "本运未直接引动月支，不能单凭十神名称断升迁或换职"];
    const relationshipReasons = [
      `原局伴侣星：${natalSpouse.map(p => `${p.god}（${p.exposed.length ? p.exposed.join("、") + "透出" : "仅暗藏"}）`).join("、") || "未见，不能据此断无婚姻"}`,
      luckDay ? `本运${pillar[1]}与夫妻宫${day}形成${relationText(pillar[1],day)}，相处方式需要留意` : "本运未直接引动夫妻宫",
      luckSpouse ? "运中见伴侣星，需等待流年星、宫配合，不能直接当作婚期" : "运中伴侣星不显，仍需结合原局与具体流年",
    ];
    const pick = (kind:TurningKind) => {
      const eligible=report.timing.filter(s=>s.fortune===pillar && s.startsAt>=source.startsAt && s.startsAt<source.endsAt).flatMap(s=>s.windows).filter(w=>w.kind===kind);
      const first=eligible[0];
      return {year:first?.year||startYear,pillar:first?.pillar||calculateAnnualPillar(startYear),ready:eligible.length>0,signals:eligible.map(w=>w.reason),reason:first?.reason||"当前范围没有符合条件的观察窗口，不表示没有变化。",windows:eligible.map(w=>({...w,reason:w.startsAt+"至"+w.endsAt+"前："+w.reason}))};
    };
    const annualSignals = {overall:pick("overall"),career:pick("career"),relationship:pick("relationship")};
    return {key:`${index}-${pillar}-${startYear}`,pillar,age:source.startAge,
      ageText:index===0 ? `${formatEngineStart(engine.start)}起` : `${source.startAge}岁（引擎口径）`,
      years:`${startYear}–${endYear}`,mode,movement:assessment.movement,modeReason,modeTone,strategy:assessment.strategy,element:stemElement,branchElement,turnReasons,careerReasons,relationshipReasons,annualSignals,fortuneGod,
      dayRelation:luckDay ? relationText(pillar[1],day) : "与夫妻宫无本轮直接引动",
      careerAdvice:luckMonth ? "先核对岗位职责、学习方向或合作分工是否变化，再决定投入；有机会时先做小规模验证。" : "先以作品、技能与项目记录积累证据，不仅凭运名换工作。",
      relationshipAdvice:luckDay ? "把距离、生活安排与承诺逐项谈清，再判断是磨合还是方向不同。" : "关注真实互动与共同计划，不因命盘年份催促或拖延关系。",
      decadalPalace:"须按事件日期另排",decadalStars:chart.palaces.length===12 ? "仅有本命盘，不以本命四化冒充大限或流年四化" : "紫微尚未就绪",
      startsAt:source.startsAt,endsAt:source.endsAt,
      isTurningPoint:annualSignals.overall.ready,isCareerTurningPoint:annualSignals.career.ready,isRelationshipTurningPoint:annualSignals.relationship.ready,
    };
  });
  const currentFortune = fortunes.find(f=> f.startsAt && f.endsAt && now >= new Date(f.startsAt.replace(" ","T")+"+08:00") && now < new Date(f.endsAt.replace(" ","T")+"+08:00")) || null;
  return {fortunes,currentFortune,directionLabel:engine.direction,startAgeText:formatEngineStart(engine.start),startDateText:engine.start.solar.replace(/(\d{4})-(\d{2})-(\d{2}) /,"$1年$2月$3日 ")};
}

function selectedAnnualYears(question: string, birthYear: number, nowYear = new Date().getFullYear()) {
  const requested = [...question.matchAll(/(?:19|20|21|22)\d{2}/g)].map(m=>Number(m[0])).filter(y=>y>=birthYear && y<=birthYear+120);
  const count = /十年|全盘|综合复核/.test(question) ? 11 : /三年/.test(question) ? 3 : 2;
  return [...new Set([...Array.from({length:count},(_,i)=>nowYear+i),...requested])].filter(y=>y>=birthYear && y<=birthYear+120).sort((a,b)=>a-b);
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
  } catch { /* Never replace a failed personal chart with demonstration data. */ }
  return {
    solarDate: date,
    lunarDate: "农历日期载入中",
    chineseDate: "",
    palaces: [],
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
  return `${target}的星曜强弱需要逐颗看，不能用庙旺与落陷的数量相互抵消。`;
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
      action: `${palaceActions[target]} 就${target}先做两件事：①以喜${analysis.favorable[0]}入手，${palaceElementActions[analysis.favorable[0]]?.[target]}；②用喜${analysis.favorable[1]}辅助，${palaceElementActions[analysis.favorable[1]]?.[target]}。`,
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
  const palace = palaceByName(chart, palaceName) || chart.palaces[0] || { name: "紫微未就绪", heavenlyStem: "", earthlyBranch: "", isBodyPalace: false, majorStars: [], minorStars: [] };
  const major = palace?.majorStars.filter((star) => star.name).slice(0, 3) || [];
  const starNames = major.map((star) => star.name);
  const related = relatedPalaces(chart, palace);
  const baseRole = palaceRoles[palace?.name || ""] || "看这个生活领域的默认条件与现实落点";
  const starText = starNames.length ? compactPalaceSignal(palace) : "本宫无十四主星，先借对宫的星曜来定调。";
  const watch = starNames.slice(0, 2).map((name) => starWatchouts[name]).filter(Boolean).join("；");
  const direct = starNames.length
    ? `结构解读：${palace?.name}${starNames.length > 1 ? `以${starNames.slice(0, 2).join("、")}同宫` : `见${starNames[0]}`}，${baseRole}。${starText}`
    : `结构解读：${palace?.name}为空宫，这个领域不能只凭“空”下结论，要看对宫怎么把力量借来使用。`;
  const action = palaceActions[palace.name] || `把${palace.name}拆成具体目标、边界与复盘节点，避免只凭一时感觉判断。`;
  const relations: PalaceRelation[] = [
    ...related.triads.map((item) => ({
      target: item, relation: "三方" as const, tone: "neutral" as RelationTone,
      meaning: `${palace?.name}与${item.name}属于三方关系：${item.name}${relatedPalacePurposes[item.name] || palaceRoles[item.name] || "提供现实支援"}。${compactPalaceSignal(item)}`,
    })),
    ...(related.opposite ? [{
      target: related.opposite, relation: "对宫" as const, tone: "neutral" as RelationTone,
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

function assessFortuneStructure(pillars: string[], luck: string, analysis: ReturnType<typeof buildAnalysis>) {
  const god=tenGod(analysis.dayStem,luck[0]);
  const supportGods=["正印","偏印","比肩","劫财"];
  const support=supportGods.includes(god);
  const branchesInPlay=[...pillars.map(p=>p[1]),luck[1]];
  const roots=branchesInPlay.filter(b=>(hiddenStem[b]||"").includes(luck[0]));
  const clashes=pillars.flatMap((p,i)=>branchClashes[luck[1]]===p[1] ? [pillarLabels[i]+p[1]] : []);
  const rootUnsettled=roots.length>0 && roots.every(b=>branchesInPlay.some(other=>branchClashes[b]===other));
  const stemTied=pillars.some(p=>Boolean(stemCombinationElements[orderedPair(luck[0],p[0],stems)]));
  const branchGod=tenGod(analysis.dayStem,hiddenStem[luck[1]][0]);
  const branchSupports=supportGods.includes(branchGod);
  const weak=/偏弱/.test(analysis.strength),strong=/偏旺/.test(analysis.strength);
  const source=luck[0]+"为"+god+"，"+(roots.length ? "同干根见"+[...new Set(roots)].join("、") : "未见同干根气")+"；"+luck[1]+"本气"+hiddenStem[luck[1]][0]+"为"+branchGod;
  let mode="作用交织",modeTone="steady";
  let interpretation="运干与运支作用不完全同向，不能把整步运概括为单边有利或不利。";
  let strategy="把新增机会与附带成本分开核算，按具体项目和年份决定是否扩大投入。";
  if(clashes.length){
    mode="变动明显";modeTone="pause";
    interpretation=luck[1]+"冲"+clashes.join("、")+"，原有安排更需要调整；冲不是必凶，也可能推动改变。";
    strategy=clashes.some(x=>x.startsWith("日")) ? "涉及共同生活、居住或合作的改变，先确认双方安排及可退回的方案。" : clashes.some(x=>x.startsWith("月")) ? "岗位、团队或学习安排变化时，先核对新职责和过渡成本，再作长期承诺。" : "面对家庭环境或长期计划的调整，保留缓冲时间，分步执行。";
  }else if(rootUnsettled||stemTied||!roots.length){
    mode="条件待辨";
    interpretation=rootUnsettled ? "运干的根气也受冲，不能把名义上的支持视为稳定可用。" : stemTied ? "运干与原局天干相合，其生克作用可能受牵制；合化与争合还需复核。" : "运干未见同干根，不能仅凭十神名称把这一运判好或判坏。";
  }else if(support&&branchSupports){
    mode="支持增加";modeTone="progress";
    interpretation=weak ? "在目前偏弱的扶抑判断下，生扶条件增加，较前更有承接任务的基础；仍须防印星压制原有产出。" : strong ? "原局已有生扶，再添同类或印星未必更有利，需防支持变成依赖或资源竞争。" : "生扶条件增加，但原局强弱仍待辨，支持增加不等于事业或财富必然上升。";
    strategy=strong ? "把资源转成实际交付；合作先定分工和收益，不因人手变多就扩大支出。" : "优先补足技能、团队和工作方法，完成小规模交付后再增加职责。";
  }else if(!support&&!branchSupports){
    mode="制耗增加";modeTone="pause";
    interpretation=weak ? "目前偏弱初判下，任务、产出或资源投入的要求增加；若形成有效制化，也可能把压力转成成果。" : strong ? "原局已有支撑，新增产出、财务或职责要求可能提供发挥空间；仍需核对是否损伤关键支持。" : "向外产出、投入或承担约束的要求增加，利弊取决于承接能力与制化是否成立。";
    strategy=["正官","七杀"].includes(god) ? "接受新职责前确认权限、可调用资源与考核标准，避免只加责任不加支持。" : ["食神","伤官"].includes(god) ? "围绕作品和交付安排投入，先检验客户需求与回款，再扩大产出。" : "项目投入先做预算、回款与退出预案，不把机会数量当可承受规模。";
  }
  return {mode,modeTone,modeReason:source+"。"+interpretation,strategy};
}

function buildLifeReadings(analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, gender: Gender) {
  const ps=analysis.godProfiles;
  const visible=(...gods:string[])=>ps.filter(p=>gods.includes(p.god)&&p.exposed.length);
  const grounded=(...gods:string[])=>visible(...gods).filter(p=>p.rooted.some(r=>!r.includes("受冲")));
  const present=(...gods:string[])=>ps.filter(p=>gods.includes(p.god));
  const describe=(profiles:typeof ps)=>profiles.map(p=>p.god+"见"+(p.exposed.join("、")||"地支暗藏")+"，"+(p.rooted.join("、")||"未见同干根气")).join("；");
  const weak=/偏弱/.test(analysis.strength);
  const officers=grounded("正官","七杀"),resources=grounded("正印","偏印"),outputs=grounded("食神","伤官"),money=grounded("正财","偏财"),peers=grounded("比肩","劫财");
  type Choice={headline:string;summary:string;advice:string;gods:string[]};
  let career:Choice;
  if(grounded("伤官").length&&grounded("正官").length){
    career={headline:resources.length ? "有改进能力，也有协调规则的条件" : "有主见，但与既有标准的磨合较多",summary:resources.length ? "伤官与正官都透出有根，印星同时提供学习和规范路径，表达与规则之间有协调条件；印能否制伤护官仍看其实际作用。" : "伤官与正官都透出有根，改进意愿与外部规则同时突出，事业难点更偏向评价标准、权限与表达方式的分歧，不宜简单归为能力不足。",advice:"提出改进时同时提交事实、替代方案和验收标准；先争取试点权限，再调整现有流程。",gods:["伤官","正官","正印","偏印"]};
  }else if(officers.length&&resources.length){
    career={headline:"责任与学习支持同时存在",summary:"官杀和印星均透出并有未受直接六冲的根气，具备通过学习、资历和组织支持承担职责的条件。"+(weak ? "偏弱初判下，重点是支持能否先于责任到位，不宜只靠硬扛。" : "官印同见不等于已经成格，支持仍需转成实际行动。"),advice:"选任务时核对培训、导师或团队资源；用具体成果争取职责，不只累积证书或头衔。",gods:["正官","七杀","正印","偏印","食神","伤官"]};
  }else if(grounded("七杀").length&&grounded("食神").length){
    career={headline:"面对压力，专业产出是主要突破口",summary:"食神与七杀均透出有根，存在用技能、方案和交付回应压力的条件；食神若被偏印制约，这条路径会受影响，不能只凭同见就称制杀成格。",advice:"把高压任务拆成有期限的交付物，优先争取解决问题所需的工具和资源，而非仅承诺结果。",gods:["七杀","食神","偏印"]};
  }else if(outputs.length){
    career={headline:money.length ? "事业更重成果兑现，作品要接得住需求" : "专业产出较突出，变现路径仍要建立",summary:outputs.map(p=>p.god).join("、")+"透出有根，职业线索更集中在技能、表达和作品。"+(money.length ? "财星同时透出有根，产出与收入有衔接线索，但不保证创业回报。" : "财星未同时形成清楚的透干根气支撑，擅长产出与能卖出去需要分别验证。"),advice:money.length ? "先做能够交付、定价和回款的小项目，用付费需求验证方向。" : "把一项技能做成可展示的案例，再测试客户愿意为什么付费，不急于扩大规模。",gods:["食神","伤官","正财","偏财"]};
  }else if(officers.length){
    career={headline:"职责与竞争突出，支持条件是关键",summary:officers.map(p=>p.god).join("、")+"透出有根，而印、食伤未同时提供明确的透干根气配合。"+(weak ? "偏弱初判下，更应留意责任超过可调用资源的情况。" : "能否把职责转成空间，需要看现实权限和后续岁运支持。"),advice:"接新岗位前问清权限、团队配置、考核标准与升级通道；资源不足时先缩小承诺范围。",gods:["正官","七杀","正印","偏印","食神","伤官"]};
  }else if(resources.length){
    career={headline:"准备和积累较突出，需打通实践环节",summary:"印星透出有根，学习和方法积累的线索较清楚；官杀或食伤未形成同样清楚的配合，不能把准备充分直接当作职业进展。",advice:"为每轮学习配一个实际项目和截止日期，以完成的交付检验方法，不无限延长准备。",gods:["正印","偏印","正官","七杀","食神","伤官"]};
  }else{
    career={headline:"职业路径尚不能从原局单独定型",summary:"相关十神没有形成清楚的透干与稳定根气配合，这反映规则条件不足，不是能力或发展机会不足。具体还要看工作方式和大运新增的配合。",advice:"比较已经完成的项目：更擅长研究、交付还是组织协调；据此选择一条可验证的职业路径。",gods:["正官","七杀","正印","偏印","食神","伤官"]};
  }
  const disturbedCareer=visible(...career.gods).filter(p=>p.rooted.length&&p.rooted.every(r=>r.includes("受冲")));
  if(disturbedCareer.length) career.summary+=" "+disturbedCareer.map(p=>p.god).join("、")+"的根气受冲，这一部分支持不稳，不能当作已经畅通。";
  let wealth:Choice;
  if(money.length&&peers.length){
    wealth={headline:"有收入线索，但收益分配需要先谈清",summary:"财星与比劫均透出有根，收入机会和同辈合作、资源竞争同时存在。重点不是一概认定破财，而是收入最终如何留存、分配；有官杀约束或食伤生财时，合作也可能形成助力。",advice:"合作前写清出资、劳动、分红和退出四项；个人与项目分账，避免未核算就扩大投入。",gods:["正财","偏财","比肩","劫财","正官","七杀","食神","伤官"]};
  }else if(money.length&&outputs.length){
    wealth={headline:weak ? "有产出换收入的条件，承接规模要控制" : "技能与收入有衔接，重在持续兑现",summary:"食伤和财星都透出有根，存在通过产出、服务或技能生财的路径。"+(weak ? "偏弱初判下，机会增加也可能带来超出精力的投入，收入潜力与承接规模应分开看。" : "这比只见财星多了一条收入来源线索，但回款、分配和长期留存仍取决于实际经营。"),advice:weak ? "先稳定一种可重复交付的收入，设置接单量与投入上限，留出回款缓冲。" : "把产品或服务的成本、定价和复购分开记录，用持续回款验证而不是只看流水。",gods:["食神","伤官","正财","偏财"]};
  }else if(money.length){
    wealth={headline:weak ? "财星有根，承接与留存更需留意" : "财星条件可见，收入来源需落实",summary:money.map(p=>p.god).join("、")+"透出有根，资源与财务事务是明显线索。"+(weak ? "偏弱初判下，不能把可见机会等同于实际可支配收入，应先看成本和支持。" : "食伤未形成同样清楚的透根配合，收入从何而来仍应具体核对，不能凭财星断富裕。"),advice:"把每项收入对应的时间成本、前期垫资和回款周期写清，优先保留净收入稳定的来源。",gods:["正财","偏财","食神","伤官","比肩","劫财"]};
  }else{
    const hiddenMoney=present("正财","偏财");
    wealth={headline:hiddenMoney.length ? "财务线索偏隐，不能直接论财旺" : "原局财星不显，不据此判断贫富",summary:hiddenMoney.length ? "财星"+(visible("正财","偏财").length ? "虽透出，但同干根气不足或受冲" : "以暗藏为主，未透干")+"，当前看不出稳定的产出与财星衔接。"+(peers.length ? "同辈分配和资源竞争更值得关注。" : "需结合大运是否使财星透出、得根，以及现实收入来源继续判断。") : "原局没有登记到财星，并不能推出没有收入；职业收入和财产状况不能用一个十神是否出现决定。",advice:hiddenMoney.length ? "先梳理已有回款的渠道，区别稳定与偶发收入；不要因看到机会就预支未来收益。" : "以实际收支建立预算，检验技能与需求的连接，不为所谓缺财额外购买开运产品。",gods:["正财","偏财","比肩","劫财","食神","伤官"]};
  }
  const spouseGods=gender==="男" ? ["正财","偏财"] : ["正官","七杀"];
  const spouse=present(...spouseGods),spouseVisible=visible(...spouseGods),spouseRoot=grounded(...spouseGods),day=analysis.natalBranches[2];
  const dayClashes=analysis.pillars.flatMap((p,i)=>i!==2&&branchClashes[day]===p[1] ? ["日支"+day+"与"+pillarLabels[i]+p[1]+"相冲"] : []);
  const dayCombines=analysis.pillars.flatMap((p,i)=>i!==2&&branchHarmonies[day]===p[1] ? ["日支"+day+"与"+pillarLabels[i]+p[1]+"六合"] : []);
  let relationship:Choice;
  if(dayClashes.length){
    relationship={headline:"相处中的安排与边界需要多磨合",summary:dayClashes.join("；")+"，传统上对应共同生活与其他安排之间的牵动。"+(spouseRoot.length ? "伴侣星也透出有根，关系议题较显，但相冲不能直接推断分手或离婚。" : "伴侣星未形成清楚的透根配合，单看夫妻宫相冲不足以判断关系结果。"),advice:"涉及居住、工作距离和家庭安排时，把各自不能让步的事项及可调整方案谈清，再作长期承诺。",gods:spouseGods};
  }else if(spouseVisible.length>1){
    relationship={headline:"关系中的不同期待需要理清",summary:spouseVisible.map(p=>p.god).join("、")+"同时透出，按传统口径，关系中不同标准或角色期待值得观察。"+(spouseRoot.length ? "其中存在根气支持，但不等于有多个对象。" : "同干根气不稳或不足，更不能把星的数量当成关系数量。")+dayCombines.join("；"),advice:"把择偶标准分为必需条件和可协商条件；已有关系时核对双方对承诺的理解是否一致。",gods:spouseGods};
  }else if(spouseRoot.length){
    relationship={headline:dayCombines.length ? "关系连接较显，协调共同安排很重要" : "关系期待较明确，稳定仍靠日常相处",summary:spouseRoot.map(p=>p.god).join("、")+"透出有根，关系期待在原局中较显。"+(dayCombines.length ? dayCombines.join("；")+"，共同生活与外部关系容易相互牵连，合并不直接等于美满。" : "本轮夫妻宫未见直接六冲，只排除一种冲突线索，不能保证感情顺遂。")+"婚期仍须结合岁运星宫配合。",advice:dayCombines.length ? "重大安排先明确两人的优先级，区分双方协商与来自家人、工作的要求。" : "用时间投入、冲突后的修复和共同计划检验关系，不只看口头承诺或条件匹配。",gods:spouseGods};
  }else{
    relationship={headline:spouse.length ? "关系线索较含蓄，不宜催定结果" : "伴侣星不显，不等于缺少感情机会",summary:spouse.length ? "伴侣星"+(spouseVisible.length ? "虽透出，但未见稳定同干根气" : "只在地支暗藏、未透干")+"，不能按星透得根的标准直接判断关系进展。"+(dayCombines.length ? dayCombines.join("；")+"，仍需星与岁运共同验证。" : "原局不足以直接判断早婚、晚婚或关系结果。") : "按本项目伴侣星口径，原局未见相关星，不代表没有伴侣或终身单身；还要看岁运是否带入关系线索。",advice:"关注真实接触和持续互动；已有关系时直接讨论双方期待，不因命盘星曜不显推迟或否定关系。",gods:spouseGods};
  }
  return [career,wealth,relationship].map((item,index)=>{
    const palaceName=["官禄","财帛","夫妻"][index],palace=palaceByName(chart,palaceName);
    return {icon:["业","财","情"][index],label:["事业","财富","情感"][index],headline:item.headline,verdict:"综合判断："+item.summary,advice:item.advice,
      text:"八字依据："+(describe(present(...item.gods))||"未见相关十神")+"。"+(palace ? "紫微补充："+palaceName+"宫见"+palaceStars(palace)+"；"+compactPalaceSignal(palace)+mutagenText(palace) : "紫微尚未就绪，以上为八字结构解读。")+"行动建议："+item.advice,
      keywords:(present(...item.gods).filter(p=>p.exposed.length).map(p=>p.god).join(" / ")||"藏干与岁运")+" · "+palaceName};
  });
}
function buildPersonalitySummary(analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe) {
  const lifePalace = palaceByName(chart, "命");
  const stars = lifePalace?.majorStars.filter((star) => star.name).slice(0, 2).map((star) => star.name) || [];
  const candidates = [...analysis.godProfiles].filter(p => p.exposed.length > 0 || p.seasonal).sort((a,b) => Number(b.effective)-Number(a.effective) || Number(b.seasonal)-Number(a.seasonal));
  const primaryGod = candidates[0]?.god || "比肩";
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
  const starTone = stars.length ? `${stars.join("、")}让你在外在表现上更重${stars.map((name) => starMeanings[name]).filter(Boolean).join("；")}` : "命宫主星信息不完整，性格以八字结构为主判断";
  return {
    headline: candidates[0]?.effective ? personality.headline : "先看行事线索，不急于贴性格标签",
    summary: `八字线索：${candidates.slice(0,2).map(p => `${p.god}见${p.exposed.join("、") || "月支本气"}，${p.rooted.length ? `根气见${p.rooted.join("、")}` : "未见同干根气，标签不宜放大"}`).join("；")}。${candidates[0]?.effective ? personality.tone : "这些是待核对的行为倾向，不能用数量直接定性"}。${lifePalace ? `紫微命宫落${lifePalace.heavenlyStem}${lifePalace.earthlyBranch}，${starTone}；${mutagenText(lifePalace)}` : "紫微尚未就绪，暂不作两盘合断。"}`,
    verdict: `综合判断：${analysis.combinations.length ? analysis.combinations.map(c=>`${c.name}，${c.question}`).join("；") : `先核对${primaryGod}在现实中更体现为助力还是压力，再确认性格方向`}。`,
    advice: `行动建议：${personality.advice}。这属于现实行为建议，不是改变命运的保证。`,
  };
}

function buildPatternInsight(analysis: ReturnType<typeof buildAnalysis>) {
  const visible = analysis.tenGods.filter((item) => item.god !== "日主").map((item) => `${item.label}${item.god}`).join("、");
  const relation = analysis.interactions.length ? `地支见${analysis.interactions.join("、")}` : "地支未见明显六合或六冲成对出现";
  return `原局线索：${visible}；${relation}。${analysis.usefulReason}下面的行动建议属于现实安排，不把五行象征作为效果保证。`;
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
  if (/(相合|六合|半合|半会)/.test(item.relation)) return "影响：这是连接或牵制的线索，不一定有利。需分辨合住的是用神还是忌神、是否争合，以及成化条件是否成立。";
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
    <em>{relationImpact(item)} 建议：核对这条关系涉及的十神、柱位与现实事项，不能仅凭连线颜色判断好坏。</em>
  </div>;
}

function BaziRelationMap({ pillars, relations, selectedKey, onSelect }: { pillars: string[]; relations: RelationItem[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (!relations.length) return <p className="relation-empty">本盘没有需要特别标出的合、冲、刑、害、破或半合半会；重点放在五行强弱与日常取舍即可。</p>;
  const stemRelations = relations.filter((item) => item.layer === "stem");
  const branchRelations = relations.filter((item) => item.layer === "branch");
  const rowGap = 27;
  const stemRowStart = 14;
  const stemNodeTop = stemRowStart + Math.max(1, stemRelations.length) * rowGap + 16;
  const branchNodeTop = stemNodeTop + 71;
  const branchRowStart = branchNodeTop + 52;
  const canvasHeight = branchRowStart + Math.max(1, branchRelations.length) * rowGap + 13;
  const renderRelations = (items: RelationItem[], top: number) => items.map((item, index) => {
    const key = relationKey(item, "bazi");
    const from = ((item.leftIndex || 0) + .5) * 25;
    const to = ((item.rightIndex || 1) + .5) * 25;
    return <button type="button" className={`relation-map-link relation-map-row ${item.tone} ${selectedKey === key ? "selected" : ""}`} key={key} style={{ left: `${from}%`, width: `${to - from}%`, top: `${top + index * rowGap}px` }} aria-label={`${item.leftLabel}${item.left}与${item.rightLabel}${item.right}：${item.relation}`} aria-pressed={selectedKey === key} onClick={() => onSelect(key)}>
      <i className={`relation-end relation-end-left element-${elementClass[elementOf[item.left] || "土"]}`}>{item.left}</i>
      <span>{shortRelationLabel(item)}</span>
      <i className={`relation-end relation-end-right element-${elementClass[elementOf[item.right] || "土"]}`}>{item.right}</i>
    </button>;
  });
  return <div className="bazi-relation-map" aria-label="八字关键关系连线图">
    <div className="relation-map-canvas relation-map-pillars" style={{ height: `${canvasHeight}px` }}>
      {renderRelations(stemRelations, stemRowStart)}
      <div className="relation-map-nodes relation-map-stem-nodes" style={{ top: `${stemNodeTop}px` }}>
        {pillars.map((pillar, index) => <div className="relation-map-node" key={`bazi-node-${index}`}>
          <small>{pillarLabels[index]}</small>
          <span className={`element-${elementClass[elementOf[pillar[0]] || "土"]}`}>{pillar[0]}</span>
        </div>)}
      </div>
      <div className="relation-map-nodes relation-map-branch-nodes" style={{ top: `${branchNodeTop}px` }}>
        {pillars.map((pillar, index) => <div className="relation-map-node" key={`bazi-branch-${index}`}>
          <b className={`element-${elementClass[elementOf[pillar[1]] || "土"]}`}>{pillar[1]}</b>
        </div>)}
      </div>
      {renderRelations(branchRelations, branchRowStart)}
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
    palaces: [],
  }));
  const [isCalculating, setIsCalculating] = useState(false);
  const [ziweiRetry, setZiweiRetry] = useState(0);
  const fortuneHorizon = 120;
  const [formError, setFormError] = useState("");
  const [chartTab, setChartTab] = useState<"bazi" | "ziwei" | "qimen">("bazi");
  const [selectedQimenPalace, setSelectedQimenPalace] = useState(1);
  const qimenResult = useMemo(() => {
    try {
      const standardDate = submitted.calendar === "solar" ? submitted.date : solarDateFromLunar(submitted.lunarYear, submitted.lunarMonth, submitted.lunarDay, submitted.isLeapMonth);
      if (!standardDate) throw new Error("出生日期未就绪");
      return { chart: calculateQimen({date:solar.date,time:solar.time,standardDate,standardTime:submitted.time}), error:"" };
    } catch (error) {
      return { chart:null, error:error instanceof Error ? error.message : "奇门排盘暂不可用" };
    }
  }, [submitted, solar.date, solar.time]);
  const [selectedBaziRelationKey, setSelectedBaziRelationKey] = useState<string | null>(null);
  const [selectedFortuneIndex, setSelectedFortuneIndex] = useState<number | null>(null);
  const [selectedFortuneRelationKey, setSelectedFortuneRelationKey] = useState<string | null>(null);
  const [selectedPalaceName, setSelectedPalaceName] = useState("命宫");
  const [selectedZiweiRelationKey, setSelectedZiweiRelationKey] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "当前查看八字。你可以询问四柱结构或某个阶段；切换命盘后，问询也会切换到对应体系。" },
  ]);
  const resultRef = useRef<HTMLElement>(null);
  const chartRevision = useRef(0);
  const chatController = useRef<AbortController | null>(null);
  const chatHistories = useRef<Partial<Record<'bazi'|'ziwei'|'qimen',Array<{role:'user'|'assistant';text:string}>>>>({});
  const currentChartLabel = chartTab === 'bazi' ? '八字' : chartTab === 'ziwei' ? '紫微' : '奇门';
  function switchChart(next: 'bazi'|'ziwei'|'qimen') {
    if(next === chartTab) return;
    chatHistories.current[chartTab] = messages;
    chartRevision.current += 1;
    chatController.current?.abort();
    setIsChatLoading(false);setChatError('');setQuestion('');
    setMessages(chatHistories.current[next] || [{role:'assistant',text:`已切换到${next==='bazi'?'八字':next==='ziwei'?'紫微本命':'出生奇门'}。可以针对当前命盘提问；自动解析仍可直接在上方查看。`}]);
    setChartTab(next);
  }
  const pillars = engine.pillars;
  const localReport = useMemo(() => analyzeLocal({pillars, gender:submitted.gender, birthDate:solar.date, asOf:new Date().toISOString().slice(0,10), horizon:fortuneHorizon, hiddenStems:engine.hiddenStems, fortunes:engine.fortunes}), [pillars, submitted.gender, solar.date, fortuneHorizon, engine]);
  const analysis = useMemo(() => ({...buildAnalysis(pillars, engine), strength:localReport.natal.strength, strengthReason:localReport.natal.summary, favorable:localReport.useful.favorable, avoid:localReport.useful.avoid, uncertainty:localReport.useful.uncertainty, usefulReason:localReport.useful.summary, evidence:localReport.natal.evidence.map(id=>localReport.facts.nodes.find(n=>n.id===id)).filter(Boolean).map(n=>nodeText(n!))}), [pillars, engine, localReport]);
  const baziRelations = useMemo(() => buildBaziRelations(pillars), [pillars]);
  const selectedBaziRelation = baziRelations.visualRelations.find((item) => relationKey(item, "bazi") === selectedBaziRelationKey) || null;
  const selectedProvince = useMemo(() => provinces.find((item) => item.name === form.province) || provinces[0], [form.province]);
  const luck = useMemo(() => buildLuck(pillars, submitted.gender, analysis, chart, engine, new Date(), fortuneHorizon, localReport), [pillars, submitted.gender, analysis, chart, engine, fortuneHorizon, localReport]);
  const fortunes = luck.fortunes;
  const selectedFortune = selectedFortuneIndex === null ? null : fortunes[selectedFortuneIndex];
  const selectedCompatibility = useMemo(
    () => selectedFortune ? buildFortuneCompatibility(pillars, selectedFortune.pillar, analysis) : null,
    [pillars, selectedFortune, analysis],
  );
  const selectedFortuneRelation = selectedCompatibility?.visualRelations.find((item) => relationKey(item, `fortune-${selectedFortune?.pillar || ""}`) === selectedFortuneRelationKey) || null;
  const selectedPalaceDetail = useMemo(() => buildZiweiPalaceDetail(chart, analysis, selectedPalaceName), [chart, analysis, selectedPalaceName]);
  const selectedZiweiRelation = selectedPalaceDetail.relations.find((item) => `${selectedPalaceDetail.palace.name}-${item.target.name}-${item.relation}` === selectedZiweiRelationKey) || null;
  const lifeReadings = localReport.domains.slice(1).map((d,i)=>({icon:["业","财","情"][i], label:d.label, headline:d.headline, verdict:d.summary, text:"建议："+d.advice, keywords:d.evidence.slice(0,3).join("；")}));
  const personality = localReport.domains[0];
  const personalitySummary = {headline:personality.headline, summary:personality.summary, verdict:personality.evidence.slice(0,2).join("；"), advice:personality.advice};
  const patternInsight = localReport.pattern.summary;

  useEffect(() => {
    let attempts = 0;
    const syncZiwei = () => {
      if (!window.iztro) return false;
      const nextChart = getAstrolabe(solar.date, solar.time, submitted.gender);
      setChart({ ...nextChart, lunarDate: engine.lunarText, chineseDate: engine.pillars.join(" ") });
      return nextChart.palaces.length === 12;
    };
    if (syncZiwei()) return;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (syncZiwei() || attempts >= 20) window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [engine, solar.date, solar.time, submitted.gender, ziweiRetry]);

  useEffect(() => () => { chatController.current?.abort(); }, []);

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
    chartRevision.current += 1;
    chatController.current?.abort();
    setIsChatLoading(false);
    setChatError("");
    setQuestion("");
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
      chatHistories.current = {};
      setSelectedQimenPalace(1);
      setMessages([{ role: "assistant", text: `${form.name || "命主"}的出生资料已更新。当前为${currentChartLabel}问询；上方可切换三种命盘查看对应分析。` }]);
      setIsCalculating(false);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 650);
  }

  async function sendQuestion(text = question) {
    const clean = text.trim();
    if (!clean || isChatLoading || isCalculating) return;
    if (chartTab === 'qimen' && !qimenResult.chart) { setChatError('奇门尚未排出，请先核对出生信息。'); return; }
    if (chartTab === 'ziwei' && chart.palaces.length !== 12) { setChatError('紫微尚未排出，请先重新加载命盘。'); return; }
    const revision = chartRevision.current;
    const controller = new AbortController();
    chatController.current = controller;
    setQuestion("");
    setChatError("");
    setIsChatLoading(true);
    setMessages((current) => [...current, { role: "user", text: clean }]);

    const chartContext = buildChatContext({
      analysisSystem: chartTab,
      qimenSummary: qimenResult.chart ? JSON.stringify({ ...qimenResult.chart, selectedPalace:selectedQimenPalace, note:'出生奇门；按所列规则计算，不能当作当前事件起局' }) : '',
      ziweiReady: chart.palaces.length === 12,
      palaceSummaries: chart.palaces.map((palace) => `${palace.name}（${palace.heavenlyStem}${palace.earthlyBranch}${palace.isBodyPalace ? "，身宫" : ""}）：主星${palace.majorStars.map((star) => `${star.name}${star.brightness || ""}${star.mutagen ? `本命化${star.mutagen}` : ""}`).join("、") || "空宫"}；辅星${palace.minorStars.map((star) => star.name).join("、") || "无"}；杂曜${palace.adjectiveStars?.map((star) => star.name).join("、") || "未提供"}；紫微大限年龄${palace.decadal?.range?.join("–") || "未提供"}`),
      chartDetails: `校正后真太阳时${solar.date} ${solar.time}（校正${solar.minutes}分钟）；农历${engine.lunarText}；四柱藏干${engine.hiddenStems.join(" / ")}；天干十神${engine.tenGods.join(" / ")}；起运${engine.start.solar}，出生后${engine.start.years}年${engine.start.months}月${engine.start.days}日${engine.start.hours}小时，${engine.direction}；大运年龄为引擎口径，不等于生日精确周岁；紫微五行局${chart.palaces.length === 12 ? chart.fiveElementsClass || "未提供" : "未就绪"}；本地综合判断（可复核，不是定论）：${localReport.pattern.base}；${analysis.usefulReason}；领域结论：${localReport.domains.map(d=>d.label+"："+d.summary).join("；")}；结构登记：${analysis.godProfiles.map(p => `${p.god}透${p.exposed.join("、") || "无"}，藏${p.rooted.join("、") || "无"}`).join("；")}`,
      annualSummary: selectedAnnualYears(clean, Number(solar.date.slice(0, 4))).map((year) => {
        const stages = engine.fortunes.filter((item) => year >= Number(item.startsAt.slice(0,4)) && year <= Number(item.endsAt.slice(0,4)));
        return `${year}年${calculateAnnualPillar(year)}，出生后约${year - Number(solar.date.slice(0, 4))}年，${stages.length ? stages.map(stage => `${stage.pillar}运（${stage.startsAt}至${stage.endsAt}前）`).join(" / 交运年须按日期区分 / ") : "未覆盖大运（不可推定）"}`;
      }).join("；") + "。流年以该年立春至次年立春为界；交运年须结合起运日期核对，年份归运为引擎年度口径；未提供紫微流年四化。",
      pillars: chartTab === 'qimen' && qimenResult.chart ? qimenResult.chart.pillars : pillars,
      ziweiSoul: chart.soul,
      ziweiBody: chart.body,
      selectedPalace: selectedPalaceDetail.palace.name,
      favorable: analysis.favorable,
      avoid: analysis.avoid,
      strength: analysis.strength,
      fortuneStages: engine.fortunes.map((fortune) => `${fortune.pillar}运（${fortune.startsAt}起至${fortune.endsAt}前，年度口径${fortune.startYear}–${fortune.endYear}，引擎年龄${fortune.startAge}–${fortune.endAge}）`),
      gender: submitted.gender,
    });
    const fallback = "问询暂时无法完成，请稍后重试。";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: clean, chartContext, history: messages.slice(-6) }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as { answer?: unknown; error?: unknown } | null;
      if (!response.ok || typeof payload?.answer !== "string" || !payload.answer.trim()) {
        throw new Error(typeof payload?.error === "string" ? payload.error : fallback);
      }
      if (revision !== chartRevision.current || controller.signal.aborted) return;
      const answer = payload.answer.trim();
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (error) {
      if (revision !== chartRevision.current || controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : fallback;
      setChatError(message);
      setQuestion(clean);
    } finally {
      if (revision === chartRevision.current) setIsChatLoading(false);
    }
  }

  const heroPillars = pillars.length === 4 ? pillars : ["庚午", "戊子", "丙寅", "甲午"];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="玄机首页"><span className="brand-mark">玄</span><span>玄机</span><small>知命 · 明势 · 笃行</small></a>
        <nav aria-label="主要导航"><a href="#chart">命盘</a><a href="#reading">解读</a>{chartTab === "bazi" && <a href="#fortune">大运</a>}</nav>
        <a className="nav-action" href="#consult">开始问询 <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="hero-copy">
          <div className="eyebrow"><span>✦</span> 四柱八字 · 紫微斗数 · 奇门遁甲</div>
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

        <div className="chart-tabs" role="tablist" aria-label="选择命盘与分析">
          {([['bazi','四柱八字'],['ziwei','紫微命盘'],['qimen','奇门遁甲']] as const).map(([key,label],index)=><button type="button" id={`tab-${key}`} key={key} className={chartTab===key?'active':''} aria-selected={chartTab===key} aria-controls="active-chart-panel" tabIndex={chartTab===key?0:-1} onClick={()=>switchChart(key)} onKeyDown={event=>{ const keys=['bazi','ziwei','qimen'] as const;const next=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;if(next>=0){event.preventDefault();switchChart(keys[next]);document.getElementById(`tab-${keys[next]}`)?.focus();}}} role="tab">{label}</button>)}
        </div>
        <div id="active-chart-panel" role="tabpanel" aria-labelledby={`tab-${chartTab}`}>
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
              <div className="useful-gods"><span>扶抑候选</span><div>{analysis.favorable.map((item) => <b className={`element-${elementClass[item]}`} key={item}>{item}</b>)}</div><small>待格局与调候复核</small></div>
            </div>
            <div className="bazi-key-relations">
              <div className="key-relations-head"><div><span>四柱关系</span><h3>干支之间的互动</h3><p>{baziRelations.summary}</p></div></div>
              <BaziRelationMap pillars={heroPillars} relations={baziRelations.visualRelations} selectedKey={selectedBaziRelationKey} onSelect={(key) => setSelectedBaziRelationKey((current) => current === key ? null : key)} />
              {selectedBaziRelation && <RelationDetail item={selectedBaziRelation} title="八字关系详解" />}
            </div>
          </div>
        ) : chartTab === "qimen" ? (
          qimenResult.chart ? <QimenPanel chart={qimenResult.chart} selectedId={selectedQimenPalace} onSelect={setSelectedQimenPalace} /> : <div className="ziwei-focus-panel" id="reading" role="status"><h3>奇门暂未排出</h3><p>{qimenResult.error}。请核对出生信息后重新排盘。</p></div>
        ) : chart.palaces.length !== 12 ? (
          <div className="ziwei-focus-panel" id="reading" role="status"><h3>紫微暂未排出</h3><p>八字仍可正常查看。这里不会使用示例星曜代替你的命盘。</p><button type="button" onClick={() => setZiweiRetry(value => value + 1)}>重新加载紫微</button></div>
        ) : (
          <>
            <div className="ziwei-grid">
              {chart.palaces.map((palace, index) => {
                const position = ringPositions[branches.indexOf(palace.earthlyBranch)] || ringPositions[0];
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
            <div className="ziwei-focus-panel" id="reading">
              <div className="ziwei-focus-head"><span>点击宫位查看</span><h3>{selectedPalaceDetail.palace.name} · {selectedPalaceDetail.palace.heavenlyStem}{selectedPalaceDetail.palace.earthlyBranch}</h3><p>主星：{selectedPalaceDetail.stars}</p></div>
              <p className="ziwei-direct"><b>{selectedPalaceDetail.direct}</b></p>
              <PalaceRelationMap palace={selectedPalaceDetail.palace} relations={selectedPalaceDetail.relations} selectedKey={selectedZiweiRelationKey} onSelect={(key) => setSelectedZiweiRelationKey((current) => current === key ? null : key)} />
              {selectedZiweiRelation && <div className={`ziwei-relation-detail ${selectedZiweiRelation.tone}`}><span>宫位连线详解 · {selectedZiweiRelation.relation}</span><h4>{selectedPalaceDetail.palace.name} ↔ {selectedZiweiRelation.target.name}</h4><p>{selectedZiweiRelation.meaning}</p><em>作用：这条线用于把本宫的判断放到{selectedZiweiRelation.target.name}所代表的现实领域里核验，不能只看单一宫位。</em></div>}
              <div className="ziwei-focus-advice"><span>落地建议</span><p>{selectedPalaceDetail.action}</p><small>提醒：{selectedPalaceDetail.watch}</small></div>
            </div>
          </>
        )}
        </div>
        <p className="chart-footnote">{chartTab === "bazi" ? "四柱采用真太阳时与节气历法，日柱按零点换日（历法库 sect=2）；起运按性别与节气时差换算。出生在节气或子时交界前后，建议核对出生记录。" : chartTab === "ziwei" ? "当前为紫微本命盘，采用历法库默认晚子时归次日口径。点击十二宫查看本宫主星、三方与对宫；此处不将八字喜用神作为紫微结论。" : "当前按出生时间起局。点击九宫查看对应分析；事件时间起局将在后续版本加入。"}</p>
      </section>

      {chartTab === "bazi" && <>
      <section className="reading-section" id="reading">
        <div className="reading-heading"><span>命 理 初 解</span><h2>先给结论，再讲依据</h2><p>先用一句话说清性格、事业、财富与情感的重点，再展开命盘依据与可执行建议。命盘给的是倾向，不替代现实能力、经验与选择。</p></div>
        <LocalReview report={localReport} />
        <div className="reading-grid">
          <article className="personality-card">
            <div className="personality-mark"><span>人</span><small>八字原局</small></div>
            <div><span>性格总判</span><h3>{personalitySummary.headline}</h3><p>{personalitySummary.summary}</p></div>
            <div className="personality-conclusion"><b>{personalitySummary.verdict}</b><p>{personalitySummary.advice}</p></div>
          </article>
          <article className="strength-card">
            <div className="article-title"><span>01</span><div><small>体用平衡</small><h3>{analysis.dayStem}{analysis.dayElement}日主 · {analysis.strength}</h3></div><b className="certainty-mark">{analysis.uncertainty === "高" ? "较高" : analysis.uncertainty === "中" ? "中等" : "较低"}<small>结论保留程度</small></b></div>
            <p>这里的“身强、身弱”说的是在这张命局里承受压力、调动资源的相对状态，不是身体好坏，也不是性格强弱。判断先看出生月份，再看地支根气、天干帮扶与泄耗是否同向；它不适合被简化成固定百分比。{analysis.strengthReason}</p>
            <div className="evidence-list" aria-label="旺衰判断依据">
              {analysis.evidence.map((evidence, index) => <div key={evidence}><b>{index < 4 ? "原局依据" : "综合参考"}</b><span>{evidence}</span></div>)}
            </div>
            <div className="god-row"><span>取用侧重 <b className={`element-${elementClass[analysis.favorable[0]]}`}>{analysis.favorable[0] || "待辨"}</b></span><span>辅助参考 <b className={`element-${elementClass[analysis.favorable[1]]}`}>{analysis.favorable[1] || "不另指定"}</b></span><span>制耗方向 <b>{analysis.avoid.join("、")}</b></span></div>
            <div className="balance-insights">
              <div><span>判断结论</span><strong>当前定为{analysis.strength}</strong><p>{analysis.usefulReason}</p></div>
              <div><span>行动参考</span><strong>{localReport.domains[1].advice}</strong><p>以下是一般生活建议，五行只作文化象征；并非已经确定的用神处方。</p></div>
              <div><span>需要节制</span><strong>{analysis.avoid.length ? analysis.avoid.join("、")+"须结合条件" : "不强行指定忌神"}</strong><p>{analysis.interactions.length ? `出生八字又见${analysis.interactions.join("、")}，遇到相似的大运时应多留一次复核。` : "出生八字的合冲信号不重，更适合稳定积累，不必为了变化而变化。"}</p></div>
            </div>
          </article>
          <article className="pattern-card">
            <div className="article-title compact"><span>02</span><div><small>十神关系</small><h3>看见行为模式</h3></div></div>
            <div className="ten-gods">{analysis.tenGods.map((item) => <div key={item.label}><span>{item.label}</span><strong className={`element-${elementClass[item.element]}`}><span>{item.god}</span><i>{item.element}</i></strong><small>藏干 {item.hidden}</small></div>)}</div>
            <blockquote>{localReport.pattern.base} · {localReport.pattern.status}</blockquote>
            <p>{patternInsight}</p>
            <div className="useful-action-list">
              {[...localReport.pattern.mechanisms,...localReport.pattern.diseases].filter(r=>r.status==="supported" || r.status==="candidate").sort((a,b)=>Number(b.status==="supported")-Number(a.status==="supported")).slice(0,2).map(r=><div key={r.id}><b>{r.status==="supported"?"条件支持":"尚待辨别"}</b><strong>{r.name}</strong><p>{r.status==="supported"?r.summary:r.against.join("；") || "现有条件尚未齐全，不按已成格判断。"}</p></div>)}
            </div>
          </article>
          <article className="life-card">
            {lifeReadings.map((item) => <div className="life-item" key={item.label}><span className="life-icon">{item.icon}</span><div><small>{item.label}总判</small><h3>{item.headline}</h3><b className="life-verdict">{item.verdict}</b><p>{item.text}</p><b>本盘依据 · {item.keywords}</b></div></div>)}
          </article>
        </div>
      </section>

      <section className="fortune-section" id="fortune">
        <div className="fortune-heading"><div><span>十年一步</span><h2>大运走势</h2></div><p>大运反映十年左右的阶段重点，不是简单的“好或坏”；点击任一步大运，可以查看它与出生八字怎样配合。</p></div>
        <p className="timeline-instruction">点击一段大运，查看整体变化与运内年份；年份按事业、感情、综合变化标记。</p>
        <div className="luck-start-card">
          <div><span>实际起运时刻</span><strong>{luck.startDateText}</strong><small>出生后 {luck.startAgeText} 起运</small></div>
          <div><span>推算依据</span><strong>{luck.directionLabel} · 节气精确换算</strong><small>性别、出生时刻与相邻节气时差共同参与计算</small></div>
          <p>起运按节气历法的分钟换算口径推算；日期精度仍受出生记录、城市经度与真太阳时近似校正影响。</p>
        </div>
        <div className="fortune-legend"><span><i className="dot progress" />取用支持</span><span><i className="dot steady" />混合或待辨</span><span><i className="dot pause" />制耗增加</span><small>颜色区分作用类型，不代表吉凶等级</small></div>
        <div className="timeline">
          {fortunes.map((fortune, index) => <button type="button" className={`fortune-node ${fortune.modeTone} ${selectedFortuneIndex === index ? "selected" : ""}`} key={`${fortune.pillar}-${index}`} aria-expanded={selectedFortuneIndex === index} aria-controls="fortune-compatibility" aria-label={`查看${fortune.pillar}大运与八字的配合关系`} onClick={() => { setSelectedFortuneIndex((current) => current === index ? null : index); setSelectedFortuneRelationKey(null); }}>
            <span className="node-age">{Math.floor(fortune.age)}<small>岁</small></span><i /><strong><ColoredPillar pillar={fortune.pillar} /></strong><small>{fortune.ageText}<br />{fortune.years}</small><b>{fortune.mode}</b>{fortune.movement === "有冲动关系" && <small>另有冲动关系</small>}
            {(fortune.isTurningPoint || fortune.isCareerTurningPoint || fortune.isRelationshipTurningPoint) && <span className="turn-tags">{fortune.isTurningPoint && <em className="overall">全盘</em>}{fortune.isCareerTurningPoint && <em className="career">事业</em>}{fortune.isRelationshipTurningPoint && <em className="relationship">感情</em>}</span>}
          </button>)}
        </div>
        {selectedFortune && selectedCompatibility && <div className="fortune-combo-panel" id="fortune-compatibility">
          <div className="combo-head">
            <div><span>已选择</span><h3><ColoredPillar pillar={selectedFortune.pillar} suffix="大运" /></h3><p>{selectedFortune.years} · {selectedFortune.mode} · 大运天干对日主来说是{selectedCompatibility.fortuneGod}</p></div>
            <button type="button" onClick={() => { setSelectedFortuneIndex(null); setSelectedFortuneRelationKey(null); }}>收起</button>
          </div>
          <FortuneYearPanel key={selectedFortune.startsAt} report={localReport} fortune={selectedFortune} />
          <details className="fortune-technical"><summary>查看大运与原局的详细配合</summary>
          <p className="combo-summary"><b>本运依据：</b>{selectedFortune.modeReason}</p>
          <p className="combo-summary"><b>建议：</b>{selectedFortune.strategy}</p>
          <FortuneRelationMap fortune={selectedFortune.pillar} relations={selectedCompatibility.visualRelations} selectedKey={selectedFortuneRelationKey} onSelect={(key) => setSelectedFortuneRelationKey((current) => current === key ? null : key)} />
          {selectedFortuneRelation && <RelationDetail item={selectedFortuneRelation} title={`${selectedFortune.pillar}大运关系详解`} />}
          </details>
        </div>}
        <p className="calculation-note">起运已按真实出生时刻、真太阳时与定气节气计算，不再统一使用固定年龄。若出生恰在节气交界前后，建议用出生证明时间复核；不同门派的早晚子时规则仍可能造成细微差异。</p>
      </section>

      </>}
      <section className="consult-section" id="consult">
        <div className="consult-copy"><span>{currentChartLabel}问询</span><h2>心中有惑，<br />不妨直问</h2><p>回答以当前{currentChartLabel}盘为依据。切换入口可查看另一套分析，各体系的对话分别保留。</p><div className="suggestions">{(chartTab==='qimen'?["解释当前宫位的门星神", "值符和值使分别说明什么？", "这张出生局有哪些解读边界？"]:chartTab==='ziwei'?["解释当前宫位", "命宫和身宫如何一起看？", "三方与对宫怎么理解？"]:["我适合创业吗？", "未来三年财运如何？", "感情里要注意什么？"]).map((item) => <button disabled={isChatLoading} onClick={() => sendQuestion(item)} key={item}>{item}<span>→</span></button>)}</div></div>
        <div className="chat-card">
          <div className="chat-head"><div><span className="avatar">玄</span><div><strong>玄机解盘</strong><small><i /> {isChatLoading ? "正在结合命盘分析，正在等待模型返回" : "模型问询"}</small></div></div><span>{currentChartLabel}分析</span></div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === "assistant" ? "玄机" : submitted.name}</small><p>{message.text}</p></div>)}
          </div>
          <div className="chat-input"><textarea disabled={isChatLoading} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }} placeholder="说说你当下最困惑的事…" aria-label="输入你的问题" /><button disabled={isChatLoading} aria-busy={isChatLoading} onClick={() => sendQuestion()} aria-label="发送问题">↑</button></div>
          <p>{chatError || "模型会结合当前命盘回答；命理判断仅供文化与个人反思参考。"}</p>
        </div>
      </section>

      <footer><div className="footer-brand"><span>玄</span><div><strong>玄机</strong><small>传统智慧 · 现代洞察</small></div></div><p>命理是一种观察视角，而非人生判决。愿你知命而不困于命，明势而后笃行。</p><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}
