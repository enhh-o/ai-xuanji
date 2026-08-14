"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { provinces } from "./china-cities";

type Gender = "男" | "女";
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
  return { dayStem, dayElement, scores, normalized, strength, ratio, favorable, avoid, tenGods };
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

function buildLuck(pillars: string[], gender: Gender, solar: ReturnType<typeof trueSolarTime>, analysis: ReturnType<typeof buildAnalysis>) {
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
  const fortunes = Array.from({ length: 8 }, (_, index) => {
    const age = startAgeYears + index * 10;
    const pillar = nextPillar(pillars[1] || "戊子", direction, index + 1);
    const element = elementOf[pillar[0]] || "土";
    const mode = analysis.favorable.includes(element) ? "进取" : analysis.avoid.includes(element) ? "蓄势" : "稳进";
    return {
      pillar,
      age,
      ageText: index === 0 ? `${formatStartAge(startAgeYears)}起` : `${Math.floor(age)}岁`,
      years: `${startYear + index * 10}–${startYear + index * 10 + 9}`,
      mode,
      element,
    };
  });
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
  };
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

function buildZiweiReading(chart: Astrolabe) {
  const targetNames = ["命宫", "官禄", "财帛", "夫妻", "迁移", "福德"];
  const cards = targetNames.map((target) => {
    const palace = chart.palaces.find((item) => item.name.includes(target));
    const major = palace?.majorStars?.filter((star) => star.name).slice(0, 3) || [];
    const starNames = major.map((star) => star.name);
    const explanations = starNames.map((name) => starMeanings[name]).filter(Boolean);
    const brightness = major.map((star) => `${star.name}${star.brightness ? `·${star.brightness}` : ""}${star.mutagen ? `·化${star.mutagen}` : ""}`).join(" / ");
    const support = [...(palace?.minorStars || []), ...(palace?.adjectiveStars || [])].slice(0, 4).map((star) => star.name).join("、");
    return {
      name: target,
      branch: palace ? `${palace.heavenlyStem}${palace.earthlyBranch}` : "—",
      stars: brightness || "空宫借对宫参看",
      support: support || "辅曜信息平稳",
      text: explanations.length
        ? explanations.join("；") + "。这里显示的是倾向，仍要结合三方四正与现实经历验证。"
        : "本宫主星信息较少，应借对宫与三方四正合参，不能仅以空宫直接下结论。",
      action: palaceActions[target],
    };
  });
  const life = cards[0];
  const bodyPalace = chart.palaces.find((item) => item.isBodyPalace)?.name || "未标注";
  return {
    headline: `${chart.fiveElementsClass || "五行局"} · 命主${chart.soul || "—"} · 身主${chart.body || "—"}`,
    overview: `命宫落${life.branch}，主星组合为${life.stars}；身宫落在${bodyPalace}。命宫更像先天反应方式，身宫更像成年后反复投入的方向，两者需要合看。`,
    cards,
  };
}

function answerQuestion(question: string, analysis: ReturnType<typeof buildAnalysis>) {
  const opening = `直说结论：你的日主为${analysis.dayStem}${analysis.dayElement}，目前判断为${analysis.strength}，喜${analysis.favorable.join("、")}，对${analysis.avoid.join("、")}过旺要保持克制。`;
  if (/事业|工作|职业|跳槽|创业/.test(question)) return `${opening} 事业上最怕方向太多、执行分散。适合把${labels[analysis.favorable[0]]}变成核心能力：先建立可复制的方法与现金流，再谈激进扩张。若处于“进取”运，可主动争取权责；“蓄势”运宜修内功，不宜高杠杆。`;
  if (/财|钱|投资|收入|买房/.test(question)) return `${opening} 财运不是单看“有没有财星”，还要看日主能否任财。你的策略应是先守住稳定收入与应急金，再配置高波动机会；任何借贷、投资和房产决定都应以现实数据为准，不建议只凭命理解读下注。`;
  if (/感情|婚姻|对象|恋爱/.test(question)) return `${opening} 情感里的关键不是“有没有缘”，而是表达方式与边界。你容易在压力下先讲道理、后讲感受，关系里要把期待说具体。出现冲突时，先确认事实，再讨论立场，避免用沉默替代沟通。`;
  if (/今年|流年|明年/.test(question)) return `${opening} 流年要与原局、大运一并判断。演示版先给策略：重要决定分成可逆与不可逆两类，可逆事项快速试错，不可逆事项至少保留一次复核窗口。上线正式版后可进一步细化到月度节奏。`;
  return `${opening} 从体用平衡看，你现在最值得做的不是追求“改命捷径”，而是把有利五行对应成现实行动：${labels[analysis.favorable[0]]}、${labels[analysis.favorable[1]]}。如果你告诉我具体事件、时间范围和可选方案，我会给出更有针对性的分析。`;
}

export default function Home() {
  const [form, setForm] = useState({ name: "林先生", gender: "男" as Gender, date: "1990-01-01", time: "12:30", province: "北京市", city: "北京市" });
  const [submitted, setSubmitted] = useState(form);
  const [chart, setChart] = useState<Astrolabe>(() => ({ solarDate: form.date, lunarDate: "庚午年腊月初五", chineseDate: "庚午 戊子 丙寅 甲午", fiveElementsClass: "金四局", soul: "贪狼", body: "天相", palaces: fallbackPalaces }));
  const [solar, setSolar] = useState(() => trueSolarTime(form.date, form.time, provinces[0].cities[0].longitude));
  const [isCalculating, setIsCalculating] = useState(false);
  const [chartTab, setChartTab] = useState<"bazi" | "ziwei">("bazi");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "命盘已就绪。你可以直接问事业、财富、情感或某个阶段的选择，我会结合四柱与紫微盘直说重点。" },
  ]);
  const resultRef = useRef<HTMLElement>(null);
  const pillars = useMemo(() => chart.chineseDate.split(/\s+/).slice(0, 4), [chart]);
  const analysis = useMemo(() => buildAnalysis(pillars), [pillars]);
  const selectedProvince = useMemo(() => provinces.find((item) => item.name === form.province) || provinces[0], [form.province]);
  const luck = useMemo(() => buildLuck(pillars, submitted.gender, solar, analysis), [pillars, submitted.gender, solar, analysis]);
  const fortunes = luck.fortunes;
  const ziweiReading = useMemo(() => buildZiweiReading(chart), [chart]);

  function submitBirth(event: FormEvent) {
    event.preventDefault();
    setIsCalculating(true);
    const province = provinces.find((item) => item.name === form.province) || provinces[0];
    const city = province.cities.find((item) => item.name === form.city) || province.cities[0];
    const adjusted = trueSolarTime(form.date, form.time, city.longitude);
    window.setTimeout(() => {
      setSolar(adjusted);
      setChart(getAstrolabe(adjusted.date, adjusted.time, form.gender));
      setSubmitted(form);
      setIsCalculating(false);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 650);
  }

  function sendQuestion(text = question) {
    const clean = text.trim();
    if (!clean) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: clean }, { role: "assistant", text: answerQuestion(clean, analysis) }]);
  }

  const maxScore = Math.max(...analysis.normalized.map((item) => item.raw), 1);
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
          <div className="form-grid">
            <label>生理性别<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}><option>男</option><option>女</option></select></label>
            <label>出生省份<select value={form.province} onChange={(e) => {
              const province = provinces.find((item) => item.name === e.target.value) || provinces[0];
              setForm({ ...form, province: province.name, city: province.cities[0].name });
            }}>{provinces.map((province) => <option key={province.name}>{province.name}</option>)}</select></label>
            <label>出生城市<select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{selectedProvince.cities.map((city) => <option key={city.name}>{city.name}</option>)}</select></label>
            <label>公历生日<input type="date" min="1900-01-01" max="2100-12-31" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>出生时间<input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          </div>
          <div className="solar-hint"><span>◐</span><div><strong>自动校准真太阳时</strong><small>依据出生地经度与当日均时差修正</small></div><i>已开启</i></div>
          <button className="primary-button" type="submit" disabled={isCalculating}>{isCalculating ? "正在观天察时…" : "开启命盘"}<span>{isCalculating ? "◌" : "→"}</span></button>
          <p className="privacy">◇ 出生信息仅在当前设备中处理，不会保存</p>
        </form>
      </section>

      <section className="result-section" ref={resultRef} id="chart">
        <div className="section-intro">
          <div><span className="section-kicker">YOUR DESTINY MAP</span><h2>{submitted.name || "命主"}的命盘</h2></div>
          <div className="solar-proof"><span>真太阳时</span><strong>{solar.date.replaceAll("-", ".")} · {solar.time}</strong><small>{submitted.province} · {submitted.city} {solar.longitude.toFixed(2)}°E · 较北京时间 {solar.minutes >= 0 ? "+" : ""}{solar.minutes} 分钟</small></div>
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
                  <p>{item.text}</p><em>{item.action}</em>
                </article>)}
              </div>
              <p className="ziwei-method-note">解读顺序：先看命身，再看官禄、财帛、夫妻等重点宫位，最后以三方四正交叉验证；不以单星、单宫直接断吉凶。</p>
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
            <p>你的优势不在蛮力，而在把信息整理成路径；需防止想得过满、启动过慢。真正的突破点是缩短从判断到行动的距离。</p>
          </article>
          <article className="life-card">
            <div className="life-item"><span className="life-icon">业</span><div><small>事业</small><h3>先立方法，再扩边界</h3><p>适合需要判断、规划与整合资源的角色。顺势阶段可争取更大权责，逆势阶段要守住专业信用。</p><b>关键词 · 聚焦 / 复利 / 权责对等</b></div></div>
            <div className="life-item"><span className="life-icon">财</span><div><small>财富</small><h3>现金流优先于故事</h3><p>财星能否为用，关键在自身承载力。先建立安全垫，再配置高波动机会，忌因短期顺利放大杠杆。</p><b>关键词 · 稳健 / 分散 / 留有余地</b></div></div>
            <div className="life-item"><span className="life-icon">情</span><div><small>情感</small><h3>坦诚，但不急于定性</h3><p>关系里容易重逻辑、轻感受。把期待说清，比等待对方猜中更有效；遇分歧先确认事实。</p><b>关键词 · 表达 / 边界 / 共同成长</b></div></div>
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
          {fortunes.map((fortune, index) => <div className={`fortune-node ${fortune.mode === "进取" ? "progress" : fortune.mode === "蓄势" ? "pause" : "steady"}`} key={fortune.pillar}>
            <span className="node-age">{Math.floor(fortune.age)}<small>岁</small></span><i /><strong>{fortune.pillar}</strong><small>{fortune.ageText}<br />{fortune.years}</small><b>{fortune.mode}</b>{index === 2 && <em>关键转折</em>}
          </div>)}
        </div>
        <div className="fortune-advice">
          <div><span>↗</span><h3>适合突破的阶段</h3><p>在“进取”大运，主动争取职位、市场与资源，但仍需用阶段目标控制风险。</p></div>
          <div><span>⌁</span><h3>需要稳守的阶段</h3><p>在“蓄势”大运，重点是现金流、身体节律与关系维护，重大决定留出复核期。</p></div>
          <div><span>◇</span><h3>全程提醒</h3><p>命理只描述倾向，不替代事实调查、专业意见与个人选择。越重要的决定，越要回到现实依据。</p></div>
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
