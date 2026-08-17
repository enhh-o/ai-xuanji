import assert from "node:assert/strict";
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
  assert.match(html, /心中有惑/);
  assert.match(html, /iztro\.min\.js/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
