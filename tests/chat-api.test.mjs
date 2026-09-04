import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("chat-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const validContext = {
  bazi: ["壬辰", "丙午", "庚戌", "辛巳"],
  ziweiSummary: "命宫主星为天府，当前查看命宫。",
  fortuneSummary: "当前大运为戊申，重点看大运与原局的配合。",
  gender: "女",
};

const minimalEnv = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const testContext = { waitUntil() {}, passThroughOnException() {} };

function jsonRequest(body) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("chat API rejects an empty question", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    jsonRequest({ question: "   ", chartContext: validContext, history: [] }),
    minimalEnv,
    testContext,
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /问题/);
});

test("chat API explains when model configuration is missing", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    jsonRequest({ question: "事业如何", chartContext: validContext, history: [] }),
    minimalEnv,
    testContext,
  );

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /模型服务尚未配置/);
});

test("chat API forwards a validated request and returns provider text", async () => {
  const worker = await loadWorker();
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (input, init) => {
    upstreamRequest = input instanceof Request ? input : new Request(input, init);
    return Response.json({ choices: [{ message: { content: "先稳住节奏，再看机会。" } }] });
  };

  try {
    const response = await worker.fetch(
      jsonRequest({ question: "事业如何", chartContext: validContext, history: [] }),
      {
        ...minimalEnv,
        AI_API_KEY: "test-key",
        AI_CHAT_COMPLETIONS_URL: "https://model.example/chat/completions",
        AI_MODEL: "test-model",
      },
      testContext,
    );

    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
    assert.equal(upstreamRequest.headers.get("authorization"), "Bearer test-key");
    assert.equal((await upstreamRequest.json()).model, "test-model");
    assert.equal((await response.json()).answer, "先稳住节奏，再看机会。");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat API converts an upstream failure into a safe Chinese error", async () => {
  const worker = await loadWorker();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad", { status: 500 });

  try {
    const response = await worker.fetch(
      jsonRequest({ question: "事业如何", chartContext: validContext, history: [] }),
      {
        ...minimalEnv,
        AI_API_KEY: "test-key",
        AI_CHAT_COMPLETIONS_URL: "https://model.example/chat/completions",
        AI_MODEL: "test-model",
      },
      testContext,
    );

    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /模型服务暂时没有返回有效答复/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
