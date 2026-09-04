# AI 问询与 Cloudflare 部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“玄机解盘”聊天框通过 Cloudflare Worker 安全调用用户配置的兼容聊天模型，并准备可推送到用户 GitHub 仓库的代码。

**Architecture:** 浏览器仅请求同源 `/api/chat`，携带问题、当前命盘摘要与最近六条对话。`worker/chat.ts` 负责校验、拼接服务端提示词、调用配置的聊天接口并将错误转换为中文提示；`worker/index.ts` 负责把该路径分发给处理器，其余请求仍交给 Vinext。

**Tech Stack:** React 19、TypeScript、Vinext、Cloudflare Worker、Node 内置测试、火山引擎方舟 OpenAI 兼容 chat/completions API。

**Spec:** `docs/superpowers/specs/2026-09-04-ai-chat-cloudflare-design.md`

## Global Constraints

- 真实 API Key 仅存在于本地 `.env` 与 Cloudflare Secret，禁止提交、渲染或返回给浏览器。
- `.env.example` 只含通用字段 `AI_API_KEY`、`AI_CHAT_COMPLETIONS_URL`、`AI_MODEL` 与中文说明，不写死服务商、URL 或模型。
- 模型回答必须以命盘倾向与现实建议呈现；单一合冲、单一十神或单个流年不得被写成确定事件。
- 不引入数据库、账户、消息持久化、流式输出、文件上传或多模型路由。
- 所有 API 错误必须转换为中文用户提示，不能泄露密钥、上游 URL 或原始错误栈。
- GitHub 目标仓库：`https://github.com/enhh-o/ai-xuanji.git`；推送前需取得该仓库的显式写入授权，且 `.env` 不得进入暂存区。

---

## 文件结构

- `worker/chat.ts`：独立的聊天请求校验、服务端提示词、上游调用与错误映射。
- `worker/index.ts`：在现有图片优化与 Vinext 路由前分发 `/api/chat`。
- `app/page.tsx`：生成当前命盘摘要、异步发送聊天请求、维护加载与失败状态。
- `app/globals.css`：聊天按钮禁用态与状态文字的轻量样式。
- `.env`：本机私密配置模板，保持 Git 忽略。
- `.env.example`：安全的配置说明模板，可提交。
- `.gitignore`：继续忽略 `.env`，但明确允许提交 `.env.example`。
- `tests/chat-api.test.mjs`：端到端调用构建后的 Worker，覆盖 API 的核心错误和成功路径。
- `tests/rendered-html.test.mjs`：确认前端已切换到安全 API 调用和可见状态文案。

## Task 1: 建立安全配置与 Worker 聊天接口

**Files:**
- Create: `.env`
- Create: `.env.example`
- Create: `worker/chat.ts`
- Modify: `.gitignore`
- Modify: `worker/index.ts:1-47`
- Create: `tests/chat-api.test.mjs`

**Interfaces:**
- Consumes: `Request`、`env.AI_API_KEY`、`env.AI_CHAT_COMPLETIONS_URL`、`env.AI_MODEL`。
- Produces: `handleChatRequest(request: Request, env: AiChatEnv): Promise<Response>`，供 `worker/index.ts` 在 `POST /api/chat` 时调用。
- Response: 成功为 `{ answer: string }`；失败为 `{ error: string }`，状态码为 400、503、502 或 504。

- [ ] **Step 1: 写入 Worker 接口的失败测试**

在 `tests/chat-api.test.mjs` 写入三个测试：

```js
test("chat API rejects an empty question", async () => {
  const response = await worker.fetch(jsonRequest({ question: "   ", chartContext: validContext, history: [] }), minimalEnv, testContext);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /问题/);
});

test("chat API explains when model configuration is missing", async () => {
  const response = await worker.fetch(jsonRequest({ question: "事业如何", chartContext: validContext, history: [] }), minimalEnv, testContext);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /尚未配置模型服务/);
});

test("chat API forwards a validated request and returns provider text", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (request) => {
    upstreamRequest = request;
    return Response.json({ choices: [{ message: { content: "先稳住节奏，再看机会。" } }] });
  };
  try {
    const response = await worker.fetch(
      jsonRequest({ question: "事业如何", chartContext: validContext, history: [] }),
      { ...minimalEnv, AI_API_KEY: "test-key", AI_CHAT_COMPLETIONS_URL: "https://model.example/chat/completions", AI_MODEL: "test-model" },
      testContext,
    );
    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

其中 `minimalEnv` 包含当前 Worker 所需的 `ASSETS`，但不包含 AI 配置；`jsonRequest` 以 `POST http://localhost/api/chat` 和 `content-type: application/json` 创建请求。

- [ ] **Step 2: 运行测试，确认因聊天接口不存在而失败**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/chat-api.test.mjs
```

预期：测试因 `/api/chat` 仍进入 Vinext 的 404 或非预期响应失败，而不是测试语法报错。

- [ ] **Step 3: 创建通用环境变量模板并允许提交示例文件**

创建 `.env` 与 `.env.example`，内容完全相同且不含具体值：

```env
# 模型服务的 API 密钥；真实值仅填写在 .env 或 Cloudflare Secret 中
AI_API_KEY=

# 完整聊天接口地址，例如服务商提供的 /chat/completions 地址
AI_CHAT_COMPLETIONS_URL=

# 服务商要求的模型标识
AI_MODEL=
```

在 `.gitignore` 的 `.env*` 规则后加上：

```gitignore
!.env.example
```

确保 `.env` 仍被忽略，`.env.example` 可被提交。

- [ ] **Step 4: 实现 `worker/chat.ts` 的最小安全处理器**

定义：

```ts
export interface AiChatEnv {
  AI_API_KEY?: string;
  AI_CHAT_COMPLETIONS_URL?: string;
  AI_MODEL?: string;
}

export async function handleChatRequest(request: Request, env: AiChatEnv): Promise<Response>
```

实现顺序：

1. 仅接受 JSON 对象；读取失败或 `question.trim()` 为空、超过 800 字时返回 `400`。
2. 缺少任一 AI 配置时返回 `503` 与 `{ error: "模型服务尚未配置，请先完成环境变量设置。" }`。
3. 将 `history` 过滤为 `user` / `assistant` 两种角色、每条文本非空、最多保留最后 6 条；将 `chartContext` 截断为可信的短文本字段。
4. 使用固定的 `buildSystemPrompt(chartContext)` 生成中文系统提示词：命盘关系为结构事实但不直接等于应事；大运先定阶段、流年才是触发；证据不足时明确说不确定；不做确定性预言或健康诊断。
5. 用 `fetch(env.AI_CHAT_COMPLETIONS_URL, { method: "POST", headers: { Authorization: \`Bearer ${env.AI_API_KEY}\`, "content-type": "application/json" }, body })` 调用上游，body 使用 `{ model: env.AI_MODEL, messages, temperature: 0.6 }`。
6. 对上游非 2xx 或缺失 `choices[0].message.content` 返回 `502` 与“模型服务暂时没有返回有效答复，请稍后重试。”；对 `AbortError` 返回 `504` 与“模型响应超时，请稍后重试。”。
7. 只返回去除首尾空白后的模型文本，不透传上游响应对象。

- [ ] **Step 5: 在 Worker 入口挂载 `/api/chat`**

扩展 `Env`：

```ts
interface Env extends AiChatEnv {
  ASSETS: Fetcher;
  // 保留现有 DB 与 IMAGES 定义
}
```

在图片优化判断前添加：

```ts
if (url.pathname === "/api/chat") {
  return handleChatRequest(request, env);
}
```

非 `/api/chat` 请求继续执行当前图片优化和 `handler.fetch` 分支。

- [ ] **Step 6: 完成成功与上游失败测试**

在成功测试中临时替换 `globalThis.fetch`，断言上游请求包含以下真实行为：

```js
assert.equal(upstreamRequest.headers.get("authorization"), "Bearer test-key");
assert.equal(upstreamBody.model, "test-model");
assert.equal(upstreamBody.messages.at(-1).content, "事业如何");
assert.equal((await response.json()).answer, "先稳住节奏，再看机会。");
```

额外写入上游 `Response("bad", { status: 500 })` 返回 `502` 的测试。每个测试结束时恢复原来的 `globalThis.fetch`。

- [ ] **Step 7: 运行聊天接口测试与全量构建测试**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/chat-api.test.mjs
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
```

预期：聊天接口测试与现有 11 项页面测试均通过。

- [ ] **Step 8: 提交安全接口实现**

```powershell
git add .gitignore .env.example worker/chat.ts worker/index.ts tests/chat-api.test.mjs
git commit -m "feat: add secure AI chat worker endpoint"
```

提交前执行 `git status --ignored --short .env .env.example`，确认 `.env` 显示为 ignored 且不在暂存区，`.env.example` 可被提交。

## Task 2: 让页面使用模型接口并保留可理解的失败状态

**Files:**
- Create: `app/chat-context.ts`
- Modify: `app/page.tsx:1093-1442`
- Modify: `app/globals.css:137-139`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: 当前 `pillars`、`analysis`、`chart`、`luck`、`submitted.gender`。
- Produces: `buildChatContext(input): ChartContext`，返回与 `/api/chat` 契约一致的 `bazi`、`ziweiSummary`、`fortuneSummary`、`gender`。
- Frontend request: `fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(...) })`。

- [ ] **Step 1: 写入前端模型聊天的失败断言**

在 `tests/rendered-html.test.mjs` 加入测试：

```js
test("问询框通过同源 AI 接口发送命盘上下文并显示状态", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /fetch\("\/api\/chat"/);
  assert.match(source, /isChatLoading/);
  assert.match(source, /正在整理命盘信息/);
  assert.match(source, /buildChatContext/);
  assert.doesNotMatch(source, /规则引擎演示版/);
});
```

- [ ] **Step 2: 运行页面测试，确认新断言失败**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
```

预期：新增断言因页面仍使用 `answerQuestion()` 的本地演示逻辑而失败。

- [ ] **Step 3: 创建纯函数的命盘上下文构造器**

在 `app/chat-context.ts` 导出：

```ts
export interface ChartContext {
  bazi: string[];
  ziweiSummary: string;
  fortuneSummary: string;
  gender: "女" | "男";
}

export function buildChatContext(input: {
  pillars: string[];
  ziweiSoul: string;
  ziweiBody: string;
  selectedPalace: string;
  favorable: string[];
  avoid: string[];
  strength: string;
  fortuneSummary: string;
  gender: "女" | "男";
}): ChartContext
```

将命盘内容压缩为事实性摘要：四柱、身强弱与喜忌、当前选中紫微宫位/主星、前 3 步大运的阶段摘要。不得在此处生成新的判断或把远期大运写成确定事件。

- [ ] **Step 4: 以异步发送替换本地演示回复**

在 `Home` 增加 `isChatLoading` 与 `chatError` 状态；将 `sendQuestion` 改为 `async`：

1. 校验并保留 `clean` 问题；追加用户消息，清空输入并设置加载状态。
2. 将已有 `messages` 的最后 6 条作为 `history`，用 `buildChatContext` 构造 `chartContext`。
3. 请求 `/api/chat`；成功时追加 `{ role: "assistant", text: payload.answer }`。
4. 失败时追加服务端 `payload.error` 或“问询暂时无法完成，请稍后重试。”作为助手消息，同时将原问题放回输入框。
5. 在 `finally` 中恢复按钮可点击状态。

不要删除本地排盘与 `answerQuestion` 之外的功能；若 `answerQuestion` 不再被其他功能调用，再删除它与仅供它使用的死代码。

- [ ] **Step 5: 更新聊天可见状态与可访问性**

调整问询区：

```tsx
<small><i /> {isChatLoading ? "正在整理命盘信息…" : "模型问询"}</small>
<button disabled={isChatLoading} aria-busy={isChatLoading}>...</button>
<p>{chatError || "模型会结合当前命盘回答；命理判断仅供文化与个人反思参考。"}</p>
```

在 `app/globals.css` 为 `.chat-input button:disabled` 添加低透明度与 `not-allowed` 光标，不改变整体视觉风格。

- [ ] **Step 6: 运行前端测试与全量构建测试**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' lint
```

预期：所有测试通过，lint 没有错误。

- [ ] **Step 7: 提交前端问询接入**

```powershell
git add app/chat-context.ts app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: connect chart inquiry to AI chat endpoint"
```

## Task 3: 配置验证、GitHub 推送与 Cloudflare 交接

**Files:**
- Modify: `README.md`
- Verify: `.env`, `.env.example`, `.gitignore`, `worker/index.ts`

**Interfaces:**
- Consumes: 已通过测试的 `main` 分支与用户仓库 `https://github.com/enhh-o/ai-xuanji.git`。
- Produces: 推送到用户 GitHub 仓库的源码，以及 Cloudflare 环境变量配置说明。

- [ ] **Step 1: 写入部署说明的失败断言**

在 `tests/rendered-html.test.mjs` 或新增 `tests/config-safety.test.mjs` 写入：

```js
test("公开配置模板不含真实密钥且说明 Cloudflare Secret", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(example, /AI_API_KEY=$/m);
  assert.match(example, /AI_CHAT_COMPLETIONS_URL=$/m);
  assert.match(example, /AI_MODEL=$/m);
  assert.match(readme, /Cloudflare Secret/);
  assert.doesNotMatch(example, /sk-|ark\.cn-beijing\.volces\.com|deepseek-v4-pro/);
});
```

- [ ] **Step 2: 运行安全配置测试，确认 README 尚未具备部署说明**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/config-safety.test.mjs
```

预期：测试因 README 缺少 Cloudflare Secret 说明失败。

- [ ] **Step 3: 补充最小部署与配置说明**

在 `README.md` 增加“AI 问询与 Cloudflare 配置”章节，说明：

1. 复制 `.env.example` 为 `.env` 并填写本地值；不要提交 `.env`。
2. Cloudflare 中将 `AI_API_KEY` 设为 Secret，将 `AI_CHAT_COMPLETIONS_URL` 与 `AI_MODEL` 设为普通环境变量。
3. 使用发布前的 `/api/chat` 测试确认配置；503 表示未配置，502/504 表示上游服务问题。
4. 不在文档中写入用户当前的模型名、完整服务地址或任何 Key。

- [ ] **Step 4: 运行全套安全、构建与测试检查**

运行：

```powershell
$taskRuntimeBin = 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = "$taskRuntimeBin;$env:Path"
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
& 'C:\Users\ehh\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' lint
git diff --cached -- .env
git check-ignore -v .env
```

预期：测试与 lint 通过；暂存差异不显示 `.env`；`git check-ignore` 指向 `.gitignore` 的 `.env*` 规则。

- [ ] **Step 5: 提交部署文档与安全测试**

```powershell
git add README.md tests/config-safety.test.mjs
git commit -m "docs: explain AI chat Cloudflare configuration"
```

- [ ] **Step 6: 推送到用户 GitHub 仓库**

在用户明确授权通过 GitHub 登录或提供仅限该仓库 `Contents: Read and write` 权限的临时令牌后，配置一次性远程地址并推送当前 `main`：

```powershell
git remote add user-github https://github.com/enhh-o/ai-xuanji.git
git push user-github main
```

如果仓库已经带有 README 或初始化提交，先拉取其 `main` 并使用无破坏方式合并；若出现冲突，停止并向用户报告冲突文件，不使用强制推送。

- [ ] **Step 7: Cloudflare 真实环境验收**

在用户将三个变量配置到 Cloudflare 后，用页面建议问题“未来三年财运如何？”执行一次实际调用：

- 回答出现且不泄露密钥：通过；
- 显示“尚未配置模型服务”：检查 Cloudflare Secret 与变量名；
- 显示上游不可用或超时：检查服务商余额、模型标识和完整接口地址；
- 出现原始 JSON/报错：视为失败，回到 Task 1 的错误映射处理。

## 计划自检

- 规格覆盖：Task 1 覆盖安全 API、配置和错误处理；Task 2 覆盖 UI、上下文与命理边界；Task 3 覆盖安全说明、GitHub、Cloudflare 与真实验收。
- 无占位符：每项任务均包含文件、接口、测试与具体命令；真实密钥与用户令牌均被明确排除。
- 类型一致性：`AiChatEnv` 由 Worker 环境消费；`ChartContext` 在前端构造并作为 `/api/chat` 请求体的一部分；成功响应统一为 `{ answer: string }`。
