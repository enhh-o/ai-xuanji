import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(html, /关键转折的依据与建议/);
  assert.match(html, /旺衰证据/);
  assert.match(html, /体用路径/);
  assert.match(html, /需要节制/);
  assert.match(html, /全盘关键转折/);
  assert.match(html, /事业关键转折/);
  assert.match(html, /感情关键转折/);
  assert.match(html, /重点年份/);
  assert.match(html, /以立春为界/);
  assert.match(html, /运内重点年/);
  assert.match(html, /命盘依据/);
  assert.match(html, /现实核验/);
  assert.match(html, /做月度预算并保留应急金/);
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

test("三类关键转折分别按命盘信号计算", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /careerTurnScore/);
  assert.match(source, /relationshipTurnScore/);
  assert.match(source, /yearPillar/);
  assert.match(source, /annualSignals/);
  assert.match(source, /isCareerTurningPoint/);
  assert.match(source, /isRelationshipTurningPoint/);
  assert.match(source, /dayBranchClash/);
  assert.match(source, /spouseGods\.includes\(fortuneGod\)/);
  assert.match(source, /className="overall"/);
  assert.match(source, /className="career"/);
  assert.match(source, /className="relationship"/);
  assert.match(styles, /em\.overall/);
  assert.match(styles, /em\.career/);
  assert.match(styles, /em\.relationship/);
  assert.match(styles, /\.timeline \{[^}]*overflow: visible/);
  assert.doesNotMatch(styles, /\.timeline \{[^}]*overflow-x:/);
});

test("判词避免夸张与恭维式话术", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /优势容易被别人看见|机会可见|关系机会不弱|贵人资源成为关键/);
  assert.match(source, /命盘给的是倾向/);
  assert.match(source, /直断：/);
});

test("默认使用女性示例并补足大运卡片信息", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /name: "林女士", gender: "女" as Gender/);
  assert.match(source, /fortuneGod/);
  assert.match(source, /dayRelation/);
  assert.match(source, /className="turning-card-facts"/);
  assert.match(styles, /\.turning-card-facts/);
});

test("四柱八字只呈现关键关系连线并可点开通俗解释", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /buildBaziRelations/);
  assert.match(source, /buildStemRelation/);
  assert.match(source, /buildBranchRelation/);
  assert.match(source, /BaziRelationMap/);
  assert.match(source, /只标出真正需要看的线/);
  assert.match(source, /RelationDetail/);
  assert.match(source, /相害/);
  assert.match(source, /相刑/);
  assert.match(source, /半合/);
  assert.match(source, /半会/);
  assert.match(source, /不能单凭一个“合”或“冲”定好坏/);
  assert.match(styles, /\.bazi-relation-map/);
  assert.match(styles, /\.relation-map-link/);
});

test("每步大运按干支五行着色并以关键连线查看与八字的配合", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /function ColoredPillar/);
  assert.match(source, /buildFortuneCompatibility/);
  assert.match(source, /selectedFortuneIndex/);
  assert.match(source, /查看.*大运与八字的配合关系/);
  assert.match(source, /FortuneRelationMap/);
  assert.match(source, /只显示这步大运与出生八字之间真正需要看的关键连线/);
  assert.match(source, /这步运的总判/);
  assert.match(source, /出生八字/);
  assert.match(styles, /\.colored-pillar/);
  assert.match(styles, /\.fortune-relation-map/);
  assert.match(styles, /\.fortune-relation-link/);
  assert.match(styles, /\.fortune-node\.selected/);
});

test("性格与三类主题都提供简明结论和建议", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /buildPersonalitySummary/);
  assert.match(source, /性格总判/);
  assert.match(source, /label: "事业"/);
  assert.match(source, /label: "财富"/);
  assert.match(source, /label: "情感"/);
  assert.match(source, /\{item\.label\}总判/);
  assert.match(source, /结论：/);
});
