"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { provinces } from "./china-cities";

type Gender = "男" | "女";
type CalendarKind = "solar" | "lunar";
type ElementName = "木" | "火" | "土" | "金" | "水";
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
const hiddenStem: Record<string, string> = { 子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙戊庚", 午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲" };
const stems = "甲乙丙丁戊己庚辛壬癸".split("");
const branches = "子丑寅卯辰巳午未申酉戌亥".split("");
const branchClashes: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
const branchHarmonies: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
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

function buildAnalysis(pillars: string[]) {
  const dayStem = pillars[2]?.[0] || "庚";
  const dayElement = elementOf[dayStem] || "金";
  const scores: Record<ElementName, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  pillars.forEach((pillar, index) => {
    const stemEl = elementOf[pillar[0]];
    const branchEl = elementOf[pillar[1]];
    if (stemEl) scores[stemEl] += 12;
    if (branchEl) scores[branchEl] += index === 1 ? 25 : 14;
    (hiddenStem[pillar[1]] || "").split("").forEach((stem, hiddenIndex) => {
      const el = elementOf[stem];
      if (el) scores[el] += hiddenIndex === 0 ? 5 : 2;
    });
  });
  const resource = (Object.keys(produces) as ElementName[]).find((key) => produces[key] === dayElement) || "土";
  const support = scores[dayElement] + scores[resource];
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const ratio = support / total;
  const strength = ratio > 0.62 ? "身强" : ratio < 0.38 ? "身弱" : "中和偏旺";
  const favorable = strength === "身弱" ? [resource, dayElement] : [produces[dayElement], controls[dayElement]];
  const avoid = (Object.keys(scores) as ElementName[]).filter((el) => !favorable.includes(el)).sort((a, b) => scores[b] - scores[a]).slice(0, 2);
  const max = Math.max(...Object.values(scores), 1);
  const normalized = (Object.keys(scores) as ElementName[]).map((name) => ({ name, value: Math.round((scores[name] / max) * 100), raw: scores[name] }));
  const tenGods = pillars.map((pillar, index) => ({
    label: ["年柱", "月柱", "日柱", "时柱"][index],
    god: index === 2 ? "日主" : tenGod(dayStem, pillar[0]),
    hidden: hiddenStem[pillar[1]] || "—",
  }));
  const godCounts: Record<string, number> = {};
  pillars.forEach((pillar, index) => {
    if (index !== 2) {
      const god = tenGod(dayStem, pillar[0]);
      godCounts[god] = (godCounts[god] || 0) + 1;
    }
    (hiddenStem[pillar[1]] || "").split("").forEach((stem, hiddenIndex) => {
      const god = tenGod(dayStem, stem);
      godCounts[god] = (godCounts[god] || 0) + (hiddenIndex === 0 ? 0.7 : 0.35);
    });
  });
  const natalBranches = pillars.map((pillar) => pillar[1]).filter(Boolean);
  const interactions: string[] = [];
  natalBranches.forEach((branch, index) => natalBranches.slice(index + 1).forEach((other) => {
    const orderedPair = [branch, other].sort((a, b) => branches.indexOf(a) - branches.indexOf(b)).join("");
    if (branchClashes[branch] === other) interactions.push(`${orderedPair}相冲`);
    if (branchHarmonies[branch] === other) interactions.push(`${orderedPair}六合`);
  }));
  const rankedElements = (Object.keys(scores) as ElementName[]).sort((a, b) => scores[b] - scores[a]);
  return {
    dayStem, dayElement, scores, normalized, strength, ratio, favorable, avoid, tenGods, godCounts,
    natalBranches, interactions: [...new Set(interactions)], dominantElement: rankedElements[0], weakestElement: rankedElements[rankedElements.length - 1],
  };
}

function nextPillar(pillar: string, direction: number, step: number) {
  const stem = stems[(stems.indexOf(pillar[0]) + direction * step + 100) % 10];
  const branch = branches[(branches.indexOf(pillar[1]) + direction * step + 120) % 12];
  return `${stem}${branch}`;
}

const solarTermMinutes = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
  263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];
const solarTermNames = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
  "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];
const jieIndexes = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
const dayMs = 86400000;

function wallTimeMs(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

function solarTermsForYear(year: number) {
  const base = Date.UTC(1900, 0, 6, 2, 5);
  return solarTermMinutes.map((minutes, index) => ({
    name: solarTermNames[index],
    // 通用定气算法先得到 UTC 时刻，再加八小时转为中国标准时间的“墙上时间”。
    time: base + 31556925974.7 * (year - 1900) + minutes * 60000 + 8 * 3600000,
    isJie: jieIndexes.has(index),
  }));
}

function formatWallDate(time: number, withTime = false) {
  const value = new Date(time);
  const date = `${value.getUTCFullYear()}年${pad(value.getUTCMonth() + 1)}月${pad(value.getUTCDate())}日`;
  return withTime ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` : date;
}

function formatStartAge(yearsFloat: number) {
  const years = Math.floor(yearsFloat);
  const monthsFloat = (yearsFloat - years) * 12;
  const months = Math.floor(monthsFloat);
  const days = Math.round((monthsFloat - months) * 30.44);
  return `${years}年${months}个月${days}天`;
}

function palaceStars(palace?: Palace) {
  const stars = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
  return stars.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join("、") || "空宫借对宫";
}

function buildLuck(pillars: string[], gender: Gender, solar: ReturnType<typeof trueSolarTime>, analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe) {
  const yearStemIndex = stems.indexOf(pillars[0]?.[0] || "庚");
  const forward = (yearStemIndex % 2 === 0 && gender === "男") || (yearStemIndex % 2 === 1 && gender === "女");
  const direction = forward ? 1 : -1;
  const birthTime = wallTimeMs(solar.date, solar.time);
  const birthYear = new Date(birthTime).getUTCFullYear();
  const jie = [birthYear - 1, birthYear, birthYear + 1]
    .flatMap(solarTermsForYear)
    .filter((item) => item.isJie)
    .sort((a, b) => a.time - b.time);
  const selectedJie = forward
    ? jie.find((item) => item.time > birthTime) || jie[jie.length - 1]
    : [...jie].reverse().find((item) => item.time <= birthTime) || jie[0];
  const distanceDays = Math.abs(selectedJie.time - birthTime) / dayMs;
  // 子平法通行换算：三日折一年，一日折四个月；由实际节气距离推导起运日。
  const startAgeYears = distanceDays / 3;
  const startTime = birthTime + startAgeYears * 365.2422 * dayMs;
  const startYear = new Date(startTime).getUTCFullYear();
  const draftFortunes = Array.from({ length: 8 }, (_, index) => {
    const age = startAgeYears + index * 10;
    const pillar = nextPillar(pillars[1] || "戊子", direction, index + 1);
    const stemElement = elementOf[pillar[0]] || "土";
    const branchElement = elementOf[pillar[1]] || "土";
    const clashes = analysis.natalBranches.filter((branch) => branchClashes[pillar[1]] === branch);
    const harmonies = analysis.natalBranches.filter((branch) => branchHarmonies[pillar[1]] === branch);
    const midpointAge = age + 5;
    const decadalPalace = chart.palaces.find((palace) => {
      const range = palace.decadal?.range;
      return range && midpointAge >= range[0] && midpointAge <= range[1];
    });
    const majorStars = decadalPalace?.majorStars || [];
    const mutagens = majorStars.filter((star) => star.mutagen).map((star) => `${star.name}化${star.mutagen}`);
    const changeStars = majorStars.filter((star) => ["七杀", "破军", "贪狼", "廉贞"].includes(star.name)).map((star) => star.name);
    const supportiveStars = majorStars.filter((star) => ["紫微", "天府", "天相", "天梁", "武曲"].includes(star.name)).map((star) => star.name);
    let quality = 0;
    if (analysis.favorable.includes(stemElement)) quality += 2;
    if (analysis.favorable.includes(branchElement)) quality += 1;
    if (analysis.avoid.includes(stemElement)) quality -= 2;
    if (analysis.avoid.includes(branchElement)) quality -= 1;
    quality += supportiveStars.length;
    if (mutagens.some((item) => item.endsWith("化忌"))) quality -= 2;
    if (mutagens.some((item) => /化禄|化权|化科/.test(item))) quality += 1;
    const mode = quality >= 2 ? "进取" : quality <= -2 ? "蓄势" : "稳进";
    const turnScore = clashes.length * 4 + harmonies.length * 1.5 + changeStars.length * 2 + mutagens.length * 2
      + (decadalPalace && ["命宫", "官禄", "财帛", "夫妻", "迁移"].some((name) => decadalPalace.name.includes(name)) ? 1 : 0)
      + (Math.abs(quality) >= 2 ? 1 : 0);
    const turnReasons = [
      clashes.length ? `大运${pillar[1]}冲原局${clashes.join("、")}，环境或角色更容易发生实质变动` : "",
      harmonies.length ? `大运${pillar[1]}与原局${harmonies.join("、")}六合，合作与关系会成为推动力` : "",
      decadalPalace ? `紫微大限落${decadalPalace.name}（${palaceStars(decadalPalace)}）` : "",
      changeStars.length ? `${changeStars.join("、")}加强重整、换轨或突破的倾向` : "",
      mutagens.length ? `大限见${mutagens.join("、")}` : "",
    ].filter(Boolean);
    return {
      pillar,
      age,
      ageText: index === 0 ? `${formatStartAge(startAgeYears)}起` : `${Math.floor(age)}岁`,
      years: `${startYear + index * 10}–${startYear + index * 10 + 9}`,
      mode,
      element: stemElement,
      branchElement,
      quality,
      turnScore,
      turnReasons,
      decadalPalace: decadalPalace?.name || "未落入当前大限范围",
      decadalStars: palaceStars(decadalPalace),
    };
  });
  const turningIndexes = [...draftFortunes]
    .map((fortune, index) => ({ index, score: fortune.turnScore }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .filter((item, index, all) => item.score > 1 || (index === 0 && all.length > 0))
    .map((item) => item.index);
  const fortunes = draftFortunes.map((fortune, index) => ({ ...fortune, isTurningPoint: turningIndexes.includes(index) }));
  const currentYear = new Date().getFullYear();
  const currentFortune = fortunes.find((_, index) => currentYear >= startYear + index * 10 && currentYear <= startYear + index * 10 + 9) || fortunes[0];
  return {
    fortunes,
    forward,
    directionLabel: forward ? "顺排" : "逆排",
    selectedJie,
    distanceDays,
    startAgeYears,
    startAgeText: formatStartAge(startAgeYears),
    startDateText: formatWallDate(startTime, true),
    jieDateText: formatWallDate(selectedJie.time, true),
    currentFortune,
  };
}

function normalizeSolarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return year && month && day ? `${year}-${pad(month)}-${pad(day)}` : "";
}

function solarDateFromLunar(year: number, month: number, day: number, time: string, gender: Gender, isLeapMonth: boolean) {
  try {
    const chart = window.iztro?.astro.byLunar(`${year}-${month}-${day}`, getTimeIndex(time), gender, isLeapMonth, true, "zh-CN");
    return chart?.solarDate ? normalizeSolarDate(chart.solarDate) : "";
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
  紫微: "重统筹、主见与责任感", 天机: "善推演、应变快，也容易反复衡量", 太阳: "重公开表达、担当与影响力",
  武曲: "看重效率、数字与资源兑现", 天同: "重体验与和谐，行动节奏偏稳", 廉贞: "企图心与边界意识都较鲜明",
  天府: "擅长守成、配置资源与建立秩序", 太阴: "观察细腻，重安全感与长期积累", 贪狼: "欲望驱动强，社交与多元尝试活跃",
  巨门: "靠思辨和表达打开局面，也要防口舌", 天相: "善协调、重规则与体面", 天梁: "原则性强，适合顾问、守护与解难",
  七杀: "决断快，适合在压力中突破", 破军: "敢于重构旧秩序，人生转折感较强",
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

function brightnessText(palace?: Palace) {
  const bright = palace?.majorStars.filter((star) => ["庙", "旺", "得", "利"].includes(star.brightness || "")).length || 0;
  const dim = palace?.majorStars.filter((star) => ["陷", "不"].includes(star.brightness || "")).length || 0;
  if (bright > dim && bright > 0) return "主星状态较能直接发挥，优势容易被外界看见";
  if (dim > bright && dim > 0) return "主星需要经过现实磨合才能发挥，越急于证明自己越容易用力失衡";
  return "主星强弱并不极端，成效更取决于选择的环境和后天方法";
}

function buildZiweiReading(chart: Astrolabe, analysis: ReturnType<typeof buildAnalysis>) {
  const targetNames = ["命宫", "官禄", "财帛", "夫妻", "迁移", "福德"];
  const cards = targetNames.map((target) => {
    const palace = palaceByName(chart, target);
    const major = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
    const starNames = major.map((star) => star.name);
    const explanations = starNames.map((name) => starMeanings[name]).filter(Boolean);
    const brightness = major.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join(" / ");
    const support = [...(palace?.minorStars || []), ...(palace?.adjectiveStars || [])].slice(0, 4).map((star) => star.name).join("、");
    const related = relatedPalaces(chart, palace);
    const triadText = related.triads.map((item) => `${item.name}（${palaceStars(item)}）`).join("；") || "三方宫位资料不足";
    const oppositeText = related.opposite ? `${related.opposite.name}（${palaceStars(related.opposite)}）` : "对宫资料不足";
    const emptyBorrow = major.length === 0 && related.opposite ? `本宫无十四主星，重点借对宫${oppositeText}立意，并看三方是否承接。` : "";
    return {
      name: target,
      branch: palace ? `${palace.heavenlyStem}${palace.earthlyBranch}` : "—",
      stars: brightness || "空宫借对宫参看",
      support: support || "辅曜信息平稳",
      core: `${palaceRoles[target]}。${emptyBorrow}${explanations.length ? `${starNames.join("、")}组合显示：${explanations.join("；")}；${brightnessText(palace)}。` : "不能只因空宫就断作薄弱或无缘。"}`,
      triad: `三方宫位是${triadText}。它们不是陪衬：分别补充此主题背后的个人驱动力、资源兑现方式和可持续性。`,
      opposite: `对宫是${oppositeText}，代表外部情境、另一端需求或事件触发点；本宫想怎么做，要用对宫检验现实是否允许。`,
      action: `${palaceActions[target]} 八字同时喜${analysis.favorable.join("、")}，可把它落实为“${labels[analysis.favorable[0]]}、${labels[analysis.favorable[1]]}”两类行动。`,
    };
  });
  const life = cards[0];
  const bodyPalace = chart.palaces.find((item) => item.isBodyPalace)?.name || "未标注";
  return {
    headline: `${chart.fiveElementsClass || "五行局"} · 命主${chart.soul || "—"} · 身主${chart.body || "—"}`,
    overview: `命宫落${life.branch}，主星组合为${life.stars}；身宫落在${bodyPalace}。本次不是用一句“三方四正”带过：每张卡都把本宫、两个三方宫和对宫逐一列出，并说明它们如何共同影响同一主题。八字部分的${analysis.strength}与喜${analysis.favorable.join("、")}也会同步用于最终建议。`,
    cards,
  };
}

function godTotal(analysis: ReturnType<typeof buildAnalysis>, names: string[]) {
  return names.reduce((sum, name) => sum + (analysis.godCounts[name] || 0), 0);
}

function formatGodCount(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
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
  const careerHeadline = careerGods >= outputGods && careerGods >= 1.5 ? "权责与规则是职业主轴" : outputGods >= 1.5 ? "靠专业输出打开局面" : resourceGods >= 1.5 ? "先深耕方法，再放大影响" : "用稳定赛道承接能力";
  const wealthHeadline = wealthGods >= 2 && analysis.strength !== "身弱" ? "财星有源，关键在承接" : wealthGods >= 1 ? "机会可见，现金流先行" : "先经营能力，再等财路显形";
  const relationHeadline = spouseGods >= 2 ? "关系机会不弱，边界更重要" : spouseGods >= 1 ? "慢确认，比快定性更适合" : "缘分不宜催，先建立共同节奏";
  return [
    {
      icon: "业", label: "事业", headline: careerHeadline,
      text: `八字官杀约${formatGodCount(careerGods)}处、食伤约${formatGodCount(outputGods)}处、印星约${formatGodCount(resourceGods)}处，日主为${analysis.strength}；紫微官禄宫落${careerPalace?.heavenlyStem || "—"}${careerPalace?.earthlyBranch || "—"}，见${palaceStars(careerPalace)}。${careerGods >= outputGods ? "适合把责任边界、标准和决策权说清楚" : "适合凭作品、表达和解决问题的能力获得位置"}，并用喜${analysis.favorable.join("、")}的方式持续积累。`,
      keywords: `${careerPalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"} / ${analysis.favorable.join(" / ")}`,
    },
    {
      icon: "财", label: "财富", headline: wealthHeadline,
      text: `八字财星约${formatGodCount(wealthGods)}处，${analysis.strength === "身弱" ? "承载力比机会数量更重要，扩张前要先补现金流与执行能力" : "具备一定任财基础，但仍要区分稳定收入和高波动机会"}；紫微财帛宫见${palaceStars(wealthPalace)}。具体策略是先用${labels[analysis.favorable[0]]}建立可重复收入，再按可承受损失配置风险。`,
      keywords: `财星 ${formatGodCount(wealthGods)} / ${wealthPalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"} / 现金流`,
    },
    {
      icon: "情", label: "情感", headline: relationHeadline,
      text: `${gender}命以${gender === "男" ? "财星" : "官杀"}观察伴侣线索，本盘约${formatGodCount(spouseGods)}处；日支为${analysis.natalBranches[2] || "—"}，是亲密关系中的落脚点。紫微夫妻宫见${palaceStars(spousePalace)}。${spouseGods >= 1.5 ? "互动机会较多时更要提前说清承诺、金钱与个人空间" : "不宜用进度衡量关系，先验证价值观和日常节奏是否相容"}。`,
      keywords: `${gender === "男" ? "财星" : "官杀"} / 日支${analysis.natalBranches[2] || "—"} / ${spousePalace?.majorStars?.slice(0, 2).map((star) => star.name).join(" / ") || "借对宫"}`,
    },
  ];
}

function buildPatternInsight(analysis: ReturnType<typeof buildAnalysis>) {
  const visible = analysis.tenGods.filter((item) => item.god !== "日主").map((item) => `${item.label}${item.god}`).join("、");
  const relation = analysis.interactions.length ? `地支见${analysis.interactions.join("、")}` : "地支未见明显六合或六冲成对出现";
  return `本盘五行以${analysis.dominantElement}最重、${analysis.weakestElement}相对较少；天干十神为${visible}，${relation}。因此行动策略应从喜${analysis.favorable.join("、")}落地：${labels[analysis.favorable[0]]}优先，${labels[analysis.favorable[1]]}辅助，而不是套用同一套性格结论。`;
}

function answerQuestion(question: string, analysis: ReturnType<typeof buildAnalysis>, chart: Astrolabe, luck: ReturnType<typeof buildLuck>, gender: Gender) {
  const readings = buildLifeReadings(analysis, chart, gender);
  const current = luck.currentFortune;
  const opening = `直说结论：此盘为${analysis.dayStem}${analysis.dayElement}日主、${analysis.strength}，喜${analysis.favorable.join("、")}；当前对应${current.pillar}大运（${current.mode}），紫微大限走${current.decadalPalace}，见${current.decadalStars}。`;
  if (/事业|工作|职业|跳槽|创业/.test(question)) return `${opening} ${readings[0].headline}。${readings[0].text}${current.turnReasons[0] ? ` 这一运的变化依据是：${current.turnReasons.join("；")}。` : ""}`;
  if (/财|钱|投资|收入|买房/.test(question)) return `${opening} ${readings[1].headline}。${readings[1].text}任何借贷、投资和房产决定仍应以真实现金流、合同与专业意见为准。`;
  if (/感情|婚姻|对象|恋爱/.test(question)) return `${opening} ${readings[2].headline}。${readings[2].text}这里判断的是互动倾向，不以单星或单一十神断定婚期与吉凶。`;
  if (/今年|流年|明年|阶段|转折/.test(question)) return `${opening} 这一阶段是否是转折，不看固定年龄，而看大运与原局的合冲、喜忌强弱，以及紫微大限落宫共同判断。当前证据为：${current.turnReasons.join("；") || "未见强烈合冲，宜按稳进节奏观察现实信号"}。`;
  return `${opening} 八字给出的行动抓手是${labels[analysis.favorable[0]]}与${labels[analysis.favorable[1]]}；紫微则提示把当前${current.decadalPalace}的主题作为现实验证场。若你补充具体事件、时间范围与可选方案，我可以继续按同一张双盘细分。`;
}

export default function Home() {
  const [form, setForm] = useState({
    name: "林先生", gender: "男" as Gender, calendar: "solar" as CalendarKind, date: "1990-01-01",
    lunarYear: 1990, lunarMonth: 1, lunarDay: 5, isLeapMonth: false,
    time: "12:30", province: "北京市", city: "北京市",
  });
  const [submitted, setSubmitted] = useState(form);
  const [chart, setChart] = useState<Astrolabe>(() => ({ solarDate: form.date, lunarDate: "庚午年腊月初五", chineseDate: "庚午 戊子 丙寅 甲午", fiveElementsClass: "金四局", soul: "贪狼", body: "天相", palaces: fallbackPalaces }));
  const [solar, setSolar] = useState(() => trueSolarTime(form.date, form.time, provinces[0].cities[0].longitude));
  const [isCalculating, setIsCalculating] = useState(false);
  const [formError, setFormError] = useState("");
  const [chartTab, setChartTab] = useState<"bazi" | "ziwei">("bazi");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "命盘已就绪。你可以直接问事业、财富、情感或某个阶段的选择，我会结合四柱与紫微盘直说重点。" },
  ]);
  const resultRef = useRef<HTMLElement>(null);
  const pillars = useMemo(() => chart.chineseDate.split(/\s+/).slice(0, 4), [chart]);
  const analysis = useMemo(() => buildAnalysis(pillars), [pillars]);
  const selectedProvince = useMemo(() => provinces.find((item) => item.name === form.province) || provinces[0], [form.province]);
  const luck = useMemo(() => buildLuck(pillars, submitted.gender, solar, analysis, chart), [pillars, submitted.gender, solar, analysis, chart]);
  const fortunes = luck.fortunes;
  const ziweiReading = useMemo(() => buildZiweiReading(chart, analysis), [chart, analysis]);
  const lifeReadings = useMemo(() => buildLifeReadings(analysis, chart, submitted.gender), [analysis, chart, submitted.gender]);
  const patternInsight = useMemo(() => buildPatternInsight(analysis), [analysis]);
  const turningFortunes = fortunes.filter((fortune) => fortune.isTurningPoint);
  const progressFortunes = fortunes.filter((fortune) => fortune.mode === "进取");
  const cautiousFortunes = fortunes.filter((fortune) => fortune.mode === "蓄势");

  function submitBirth(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const baseDate = form.calendar === "solar"
      ? form.date
      : solarDateFromLunar(form.lunarYear, form.lunarMonth, form.lunarDay, form.time, form.gender, form.isLeapMonth);
    if (!baseDate) {
      setFormError("这个农历日期无法排盘，请确认当月日期以及是否为闰月。");
      return;
    }
    setIsCalculating(true);
    const province = provinces.find((item) => item.name === form.province) || provinces[0];
    const city = province.cities.find((item) => item.name === form.city) || province.cities[0];
    const adjusted = trueSolarTime(baseDate, form.time, city.longitude);
    window.setTimeout(() => {
      const nextChart = getAstrolabe(adjusted.date, adjusted.time, form.gender);
      setSolar(adjusted);
      setChart(nextChart);
      setSubmitted(form);
      setMessages([{ role: "assistant", text: `${form.name || "命主"}的双盘已重新排好。接下来的回答只使用这次输入的八字、紫微命盘与大运，不沿用上一位的结论。` }]);
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
          <div className="eyebrow"><span>✦</span> 四柱八字 × 紫微斗数 · 双盘合参</div>
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
          <div><span className="section-kicker">YOUR DESTINY MAP</span><h2>{submitted.name || "命主"}的命盘</h2></div>
          <div className="solar-proof"><span>真太阳时 · {submitted.calendar === "lunar" ? "农历换算后" : "公历输入"}</span><strong>{solar.date.replaceAll("-", ".")} · {solar.time}</strong><small>{submitted.province} · {submitted.city} {solar.longitude.toFixed(2)}°E · 较北京时间 {solar.minutes >= 0 ? "+" : ""}{solar.minutes} 分钟</small></div>
        </div>

        <div className="chart-tabs" role="tablist">
          <button className={chartTab === "bazi" ? "active" : ""} onClick={() => setChartTab("bazi")} role="tab">四柱八字 <small>BAZI</small></button>
          <button className={chartTab === "ziwei" ? "active" : ""} onClick={() => setChartTab("ziwei")} role="tab">紫微命盘 <small>ZI WEI</small></button>
        </div>

        {chartTab === "bazi" ? (
          <div className="bazi-panel">
            <div className="pillars">
              {heroPillars.map((pillar, index) => (
                <div className={`pillar pillar-${index}`} key={`${pillar}-${index}`}>
                  <span>{["年柱", "月柱", "日柱", "时柱"][index]}</span>
                  <div className={`stem element-${elementClass[elementOf[pillar[0]] || "土"]}`}>{pillar[0]}<i>{elementOf[pillar[0]] || "土"}</i></div>
                  <div className={`branch element-${elementClass[elementOf[pillar[1]] || "土"]}`}>{pillar[1]}<i>{elementOf[pillar[1]] || "土"}</i></div>
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
              <div className="balance-mini"><span>旺衰</span><strong>{analysis.strength}</strong><div><i style={{ width: `${Math.round(analysis.ratio * 100)}%` }} /></div><small>扶身力量 {Math.round(analysis.ratio * 100)}%</small></div>
              <div className="useful-gods"><span>喜用</span><div>{analysis.favorable.map((item) => <b key={item}>{item}</b>)}</div><small>宜顺势而用</small></div>
            </div>
          </div>
        ) : (
          <>
            <div className="ziwei-grid">
              {chart.palaces.map((palace, index) => {
                const position = ringPositions[index] || ringPositions[0];
                return <div className={`palace ${palace.name.includes("命") ? "life-palace" : ""}`} style={{ gridColumn: position.col, gridRow: position.row }} key={`${palace.name}-${index}`}>
                  <div className="palace-head"><b>{palace.name}</b><span>{palace.heavenlyStem}{palace.earthlyBranch}</span></div>
                  <div className="stars">{palace.majorStars.slice(0, 3).map((star) => <strong key={star.name}>{star.name}<small>{star.brightness}</small></strong>)}</div>
                  <p>{palace.minorStars.slice(0, 3).map((star) => star.name).join(" · ") || "辅星平守"}</p>
                  {palace.isBodyPalace && <i>身宫</i>}
                </div>;
              })}
              <div className="ziwei-center">
                <span className="mini-seal">玄</span><p>{submitted.gender}命 · {chart.fiveElementsClass || "五行局"}</p><h3>{heroPillars.join(" · ")}</h3><small>{chart.lunarDate}</small><div><span>命主 {chart.soul || "—"}</span><span>身主 {chart.body || "—"}</span></div>
              </div>
            </div>
            <div className="ziwei-reading">
              <div className="ziwei-reading-head"><span>紫微重点解读</span><h3>{ziweiReading.headline}</h3><p>{ziweiReading.overview}</p></div>
              <div className="ziwei-reading-grid">
                {ziweiReading.cards.map((item) => <article key={item.name}>
                  <div><span>{item.name}</span><b>{item.branch}</b></div>
                  <h4>{item.stars}</h4><small>辅曜：{item.support}</small>
                  <p>{item.core}</p>
                  <dl><dt>三方怎么合看</dt><dd>{item.triad}</dd><dt>对宫在看什么</dt><dd>{item.opposite}</dd></dl>
                  <em>{item.action}</em>
                </article>)}
              </div>
              <p className="ziwei-method-note">三方四正不是一句模糊提醒：本宫定主题，两个三方宫看资源与协同，对宫看外部触发和制衡；四处信息能互相印证时，结论才更有分量。</p>
            </div>
          </>
        )}
        <p className="chart-footnote">排盘采用真太阳时；子初换日、节气交界与早晚子时等流派差异，正式版将提供规则切换与人工复核。</p>
      </section>

      <section className="reading-section" id="reading">
        <div className="reading-heading"><span>命 理 初 解</span><h2>先辨旺衰，再论人生</h2><p>不堆砌术语，只把命局中真正影响选择的关系讲清楚。</p></div>
        <div className="reading-grid">
          <article className="strength-card">
            <div className="article-title"><span>01</span><div><small>体用平衡</small><h3>{analysis.dayStem}{analysis.dayElement}日主 · {analysis.strength}</h3></div><b>{Math.round(analysis.ratio * 100)}<small>%</small></b></div>
            <p>日主得令与否，要同时看月令、通根、透干和全局制化。此盘扶身力量约占 {Math.round(analysis.ratio * 100)}%，{analysis.strength === "身弱" ? "宜先补足承载力，再担财官。" : "已有承载力，宜以泄耗制衡打开格局。"}</p>
            <div className="element-bars">{analysis.normalized.map((item) => <div key={item.name}><span>{item.name}</span><div><i style={{ width: `${Math.max(item.value, 6)}%` }} /></div><b>{item.raw}</b></div>)}</div>
            <div className="god-row"><span>用神 <b>{analysis.favorable[0]}</b></span><span>喜神 <b>{analysis.favorable[1]}</b></span><span>慎用 <b>{analysis.avoid.join("、")}</b></span></div>
          </article>
          <article className="pattern-card">
            <div className="article-title compact"><span>02</span><div><small>十神关系</small><h3>看见行为模式</h3></div></div>
            <div className="ten-gods">{analysis.tenGods.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.god}</strong><small>{item.hidden}</small></div>)}</div>
            <blockquote>“旺者宜泄，弱者宜扶。取用之道，不离中和。”</blockquote>
            <p>{patternInsight}</p>
          </article>
          <article className="life-card">
            {lifeReadings.map((item) => <div className="life-item" key={item.label}><span className="life-icon">{item.icon}</span><div><small>{item.label}</small><h3>{item.headline}</h3><p>{item.text}</p><b>本盘依据 · {item.keywords}</b></div></div>)}
          </article>
        </div>
      </section>

      <section className="fortune-section" id="fortune">
        <div className="fortune-heading"><div><span>十年一步</span><h2>大运走势</h2></div><p>顺势借力，逆势蓄能。每一步运不是吉凶判决，而是不同的行动窗口。</p></div>
        <div className="luck-start-card">
          <div><span>实际起运时刻</span><strong>{luck.startDateText}</strong><small>出生后 {luck.startAgeText} 起运</small></div>
          <div><span>推算依据</span><strong>{luck.directionLabel} · 取{luck.selectedJie.name}</strong><small>{luck.jieDateText}，相距 {luck.distanceDays.toFixed(2)} 天</small></div>
          <p>按年干阴阳配合性别定顺逆，以出生时刻至相邻“节”的实际时差，采用“三日折一年、一日折四个月”换算。</p>
        </div>
        <div className="fortune-legend"><span><i className="dot progress" />适合进取</span><span><i className="dot steady" />稳中求进</span><span><i className="dot pause" />蓄势调整</span></div>
        <div className="timeline">
          {fortunes.map((fortune) => <div className={`fortune-node ${fortune.mode === "进取" ? "progress" : fortune.mode === "蓄势" ? "pause" : "steady"}`} key={fortune.pillar}>
            <span className="node-age">{Math.floor(fortune.age)}<small>岁</small></span><i /><strong>{fortune.pillar}</strong><small>{fortune.ageText}<br />{fortune.years}</small><b>{fortune.mode}</b>{fortune.isTurningPoint && <em>关键转折</em>}
          </div>)}
        </div>
        <div className="fortune-advice">
          <div><span>↗</span><h3>适合突破的阶段</h3><p>{progressFortunes.length ? `${progressFortunes.slice(0, 3).map((item) => `${item.pillar}运（${item.years}，紫微大限${item.decadalPalace}）`).join("；")}。这些阶段喜用得力，可主动争取职位、市场与资源。` : `本盘前八步运暂未出现明显“进取”档，宜以${labels[analysis.favorable[0]]}逐步创造窗口。`}</p></div>
          <div><span>⌁</span><h3>需要稳守的阶段</h3><p>{cautiousFortunes.length ? `${cautiousFortunes.slice(0, 3).map((item) => `${item.pillar}运（${item.years}，紫微大限${item.decadalPalace}）`).join("；")}。此时优先守现金流、身体节律和合作边界。` : "没有明显需要全面收缩的阶段，但重大决定仍应保留复核窗口。"}</p></div>
          <div><span>◇</span><h3>判断方式</h3><p>“进取/稳进/蓄势”由大运干支喜忌与紫微大限星曜共同给出；“关键转折”看合冲、四化和杀破狼等变化信号，不再按固定年龄贴标签。</p></div>
        </div>
        <div className="turning-detail">
          <div><span>双盘合参</span><h3>关键转折的依据与建议</h3><p>标记表示变化强度较高，不等于必然走好运；最后仍要用现实事件验证。</p></div>
          <section>
            {turningFortunes.map((fortune) => <article key={`turn-${fortune.pillar}`}>
              <div><strong>{fortune.pillar}运</strong><span>{fortune.years} · {fortune.mode}</span></div>
              <p>{fortune.turnReasons.join("；") || `大运五行为${fortune.element}${fortune.branchElement}，与原局喜忌形成明显阶段差异。`}</p>
              <em>{fortune.mode === "进取" ? `建议：围绕${labels[analysis.favorable[0]]}主动争取可量化的权责，但分阶段投入。` : fortune.mode === "蓄势" ? `建议：先稳现金流与关系边界，避免在变化信号最强时一次性押注。` : `建议：小步试错、季度复盘，以${fortune.decadalPalace}相关现实事件决定是否加码。`}</em>
            </article>)}
          </section>
        </div>
        <p className="calculation-note">起运已按真实出生时刻、真太阳时与定气节气计算，不再统一使用固定年龄。若出生恰在节气交界前后，建议用出生证明时间复核；不同门派的早晚子时规则仍可能造成细微差异。</p>
      </section>

      <section className="consult-section" id="consult">
        <div className="consult-copy"><span>ASK YOUR CHART</span><h2>心中有惑，<br />不妨直问</h2><p>回答会结合当前八字与紫微盘，但保留你的现实选择权。</p><div className="suggestions">{["我适合创业吗？", "未来三年财运如何？", "感情里要注意什么？"].map((item) => <button onClick={() => sendQuestion(item)} key={item}>{item}<span>→</span></button>)}</div></div>
        <div className="chat-card">
          <div className="chat-head"><div><span className="avatar">玄</span><div><strong>玄机解盘</strong><small><i /> 在线 · 规则引擎演示版</small></div></div><span>双盘合参</span></div>
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
