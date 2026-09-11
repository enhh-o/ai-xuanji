import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadPageModel } from "./helpers/page-model.mjs";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the complete Xuanji destiny experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /玄机/);
  assert.match(html, /为你排盘/);
  assert.match(html, /自动校准真太阳时/);
  assert.match(html, /出生省份/);
  assert.match(html, /出生城市/);
  assert.match(html, /生日历法/);
  assert.match(html, /农历/);
  assert.match(html, /四柱八字/);
  assert.match(html, /五行颜色图例/);
  assert.match(html, /紫微命盘/);
  assert.match(html, /大运走势/);
  assert.match(html, /实际起运时刻/);
  assert.match(html, /点击一段大运/);
  assert.match(html, /判断结论/);
  assert.match(html, /行动参考/);
  assert.match(html, /需要节制/);
  assert.match(html, /element-metal/);
  assert.match(html, /心中有惑/);
  assert.match(html, /iztro\.min\.js/);
  assert.doesNotMatch(html, /而不是套用同一套性格结论/);
  assert.doesNotMatch(html, /约\d+(?:\.\d+)?处/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("紫微命盘以宫位聚焦与宫间连线呈现三方和对宫职责", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /buildZiweiPalaceDetail/);
  assert.match(source, /PalaceRelationMap/);
  assert.match(source, /宫位连线详解/);
  assert.match(source, /三方/);
  assert.match(source, /对宫/);
  assert.match(source, /relatedPalacePurposes/);
  assert.match(styles, /\.palace-relation-map/);
  assert.match(styles, /\.palace-relation-line/);
});

test("转折可在未来十年与全部岁运间切换，且不隐藏其他满足条件的年份", () => {
  const m = loadPageModel();
  const e = m.calculateBazi("1990-01-01","12:30","女");
  const a = m.buildAnalysis(e.pillars,e);
  const near = m.buildLuck(e.pillars,"女",a,{palaces:[]},e,new Date("2026-09-07"),10);
  const all = m.buildLuck(e.pillars,"女",a,{palaces:[]},e,new Date("2026-09-07"),120);
  const windows = luck => luck.fortunes.flatMap(f => Object.values(f.annualSignals).flatMap(s => s.windows));
  assert.ok(windows(all).length > 0);
  assert.ok(windows(near).every(w => w.year >= 2026 && w.year <= 2036));
  assert.ok(windows(all).length >= windows(near).length);
});

test("判词避免夸张与恭维式话术", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /优势容易被别人看见|机会可见|关系机会不弱|贵人资源成为关键/);
  assert.doesNotMatch(source, /敏感但不软弱/);
  assert.match(source, /命盘给的是倾向/);
  assert.match(source, /综合判断/);
  assert.match(source, /personalityByGod/);
  assert.doesNotMatch(source, /扶身力量约占|扶身力量约/);
});

test("默认使用女性示例并补足大运卡片信息", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /name: "林女士", gender: "女" as Gender/);
  assert.match(source, /fortuneGod/);
  assert.match(source, /dayRelation/);
  assert.match(source, /FortuneYearPanel/);
  assert.match(styles, /\.turning-card-facts/);
});

test("四柱八字只呈现关键关系的紧凑连线并可点开通俗解释", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /buildBaziRelations/);
  assert.match(source, /buildStemRelation/);
  assert.match(source, /buildBranchRelation/);
  assert.match(source, /BaziRelationMap/);
  assert.match(source, /干支之间的互动/);
  assert.doesNotMatch(source, /只标出真正需要看的线|连线放在字的上、下方|只画出这步大运/);
  assert.match(source, /relation-map-pillars/);
  assert.match(source, /relation-map-nodes/);
  assert.match(source, /stemRelations/);
  assert.match(source, /branchRelations/);
  assert.match(source, /relation-map-stem-nodes/);
  assert.match(source, /relation-map-branch-nodes/);
  assert.match(source, /relation-end-left/);
  assert.match(source, /relation-end-right/);
  assert.match(source, /RelationDetail/);
  assert.match(source, /相害/);
  assert.match(source, /相刑/);
  assert.match(source, /半合/);
  assert.match(source, /半会/);
  assert.match(source, /关系本身不直接等同于吉凶/);
  assert.match(styles, /\.bazi-relation-map/);
  assert.match(styles, /\.relation-map-link/);
  assert.match(styles, /\.relation-map-pillars/);
  assert.match(styles, /\.relation-map-row \.relation-end/);
});

test("每步大运按干支五行着色并以关键连线查看与八字的配合", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /function ColoredPillar/);
  assert.match(source, /buildFortuneCompatibility/);
  assert.match(source, /selectedFortuneIndex/);
  assert.match(source, /查看.*大运与八字的配合关系/);
  assert.match(source, /FortuneRelationMap/);
  assert.doesNotMatch(source, /只显示这步大运与出生八字之间真正需要看的关键连线/);
  assert.match(source, /本运依据/);
  assert.match(source, /出生八字/);
  assert.match(styles, /\.colored-pillar/);
  assert.match(styles, /\.fortune-relation-map/);
  assert.match(styles, /\.fortune-relation-link/);
  assert.match(styles, /\.fortune-node\.selected/);
});

test("旺衰区域不显示过程性保留说明与资料完整度卡片", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /为什么保留程度为|排盘资料|完整度较高/);
  assert.match(source, /判断结论/);
  assert.match(source, /行动参考/);
});

test("性格与三类主题都提供简明结论和建议", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /buildPersonalitySummary/);
  assert.match(source, /性格总判/);
  const { loadPageModel } = await import('./helpers/page-model.mjs');
  const model = loadPageModel();
  const readings = model.buildLifeReadings(model.buildAnalysis(['壬午','己酉','戊子','壬子']), {palaces:[]}, '女');
  assert.deepEqual(Array.from(readings, item => item.label), ['事业','财富','情感']);
  assert.ok(readings.every(item => item.headline && item.verdict && item.advice));
  assert.match(source, /\{item\.label\}总判/);
  assert.match(source, /综合判断/);
});

test("历法引擎输出固定样例与连续十年交运边界", () => {
  const m = loadPageModel();
  assert.equal(m.solarFromLunarDate(2024,1,1,false),"2024-02-10");
  assert.equal(m.calculateAnnualPillar(2026),"丙午");
  const e = m.calculateBazi("1987-08-01","12:00","女");
  assert.deepEqual(Array.from(e.pillars),["丁卯","丁未","壬午","丙午"]);
  assert.equal(e.fortunes[0].endsAt,e.fortunes[1].startsAt);
});

test("页面不向用户显示英文规则分层标签", async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /YOUR DESTINY MAP|ASK YOUR CHART|A\/STRUCTURAL|B\/STRUCTURAL|C\/CORE|>BAZI<|>ZI WEI</);
});

test("问询框通过同源 AI 接口发送命盘上下文并显示状态", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /fetch\("\/api\/chat"/);
  assert.match(source, /isChatLoading/);
  assert.match(source, /aria-busy=\{isChatLoading\}/);
  assert.match(source, /buildChatContext/);
  assert.doesNotMatch(source, /规则引擎演示版/);
});
