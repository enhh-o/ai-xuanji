import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/chat-context.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { buildChatContext } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const input = { pillars: ["壬辰", "丙午", "庚戌", "辛巳"], selectedPalace: "命宫", favorable: ["土"], avoid: ["木"], strength: "偏弱", gender: "女", fortuneStages: Array.from({ length: 9 }, (_, i) => `第${i + 1}运`), palaceSummaries: Array.from({ length: 12 }, (_, i) => `第${i + 1}宫星曜`), chartDetails: "起运资料", annualSummary: "2027丁未" };

test("聊天保留最后一步大运和第十二宫，不止前三运", () => {
  const context = buildChatContext({ ...input, ziweiReady: true });
  assert.ok(context.fortuneSummary.includes("第9运"));
  assert.ok(context.fortuneSummary.includes("程序初判（待核对）"));
  assert.ok(context.ziweiSummary.includes("第12宫星曜"));
  assert.equal(context.annualSummary, "2027丁未");
  assert.equal(context.chartDetails, "起运资料");
});
test("紫微未就绪时不把示例星曜作为真实命盘", () => {
  const context = buildChatContext({ ...input, ziweiReady: false, ziweiSoul: "占位测试星甲" });
  assert.ok(context.ziweiSummary.includes("尚未就绪"));
  assert.ok(!context.ziweiSummary.includes("占位测试星甲"));
  assert.ok(!context.ziweiSummary.includes("第12宫"));
});
