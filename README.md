# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## AI 问询与 Cloudflare 配置

### 角色与命盘上下文

角色说明位于 `prompts/mingli-agent.md`，后端通过 Vite 的 `?raw` 导入，在构建时打包进 Worker，每次问询自动附带。修改该文件并发布即可更新角色，无需在 Cloudflare 手动上传 Markdown。它参考 yueyuan 的分析纪律，不代表已载入 Skill 全文或古籍知识库，也不提供独立盲测和长期记忆。

聊天上下文包含四柱、藏干、天干十神、校正时间、起运、全部引擎大运、十二宫星曜与出生后 120 年的流年干支。未就绪的紫微示例盘不发送；未覆盖的大运、未提供的紫微流年四化明确标记缺失。年度归运与精确交运日有区别，交运年须进一步核对。网页旺衰喜忌作为“程序初判”供模型复核。本次不会改变页面自动生成的解读规则。

接口地址与模型标识已在 `vite.config.ts` 的 `vars` 中管理，GitHub 自动部署会带上这两项；API Key 仍只放在 Cloudflare Secret。扩充上下文会增加每次模型调用的输入量；本地自动测试使用模拟模型，不产生模型费用。

网页中的“玄机解盘”会通过同源的 `/api/chat` 请求模型服务。密钥只由 Cloudflare Worker 读取，浏览器和 GitHub 仓库都不应保存真实密钥。

### 本地配置

1. 复制 `.env.example` 为 `.env`。
2. 按注释填写三个变量：`AI_API_KEY`、`AI_CHAT_COMPLETIONS_URL`、`AI_MODEL`。
3. `.env` 已被 Git 忽略；提交代码前请确认它没有出现在 Git 暂存区。

### Cloudflare 配置

在 Cloudflare 的 Worker（或绑定该 Worker 的项目）设置中添加同名变量：

- 将 `AI_API_KEY` 添加为 **Cloudflare Secret**；它只保存在 Cloudflare 侧，不显示在网页中。
- `AI_CHAT_COMPLETIONS_URL` 和 `AI_MODEL` 由 `vite.config.ts` 自动部署；需要更换时修改该文件，控制台临时修改会在后续部署时恢复为代码配置。
- 变量名必须与 `.env.example` 完全一致。发布后，从网页发送一条问询来检查 `/api/chat` 是否能正常返回回答。

若页面提示“模型服务尚未配置”，先检查三个变量的名称和值；若提示模型暂时不可用或超时，则检查模型服务状态、额度、模型标识和接口地址。不要把密钥粘贴到前端代码、公开 Issue 或 GitHub 提交中。

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
