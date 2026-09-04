import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("公开配置模板不含真实密钥且说明 Cloudflare Secret", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(example, /^AI_API_KEY=$/m);
  assert.match(example, /^AI_CHAT_COMPLETIONS_URL=$/m);
  assert.match(example, /^AI_MODEL=$/m);
  assert.match(readme, /Cloudflare Secret/);
  assert.doesNotMatch(example, /sk-|ark\.cn-beijing\.volces\.com|deepseek-v4-pro/);
});

test("pnpm 工作区声明根项目，供 Cloudflare 安装依赖", async () => {
  const workspace = await readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
  assert.match(workspace, /^packages:\r?\n\s+- ['"]\.['"]$/m);
});
