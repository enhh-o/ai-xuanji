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
  assert.match(html, /做月度预算并保留应急金/);
  assert.match(html, /element-metal/);
  assert.match(html, /心中有惑/);
  assert.match(html, /iztro\.min\.js/);
  assert.doesNotMatch(html, /而不是套用同一套性格结论/);
  assert.doesNotMatch(html, /约\d+(?:\.\d+)?处/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("紫微解读包含具体三方与对宫职责", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /两个三方宫各自负责什么/);
  assert.match(source, /对宫如何触发与制衡本宫/);
  assert.match(source, /relatedPalacePurposes/);
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
  assert.match(source, /仍要用经历、能力与现实条件核实/);
});
