const test = require("node:test");
const assert = require("node:assert/strict");
const { askModels, configuredProviders } = require("../../api/_bot/providers");
const { getConfig } = require("../../api/_bot/config");
const { fakeService, groqReply, geminiReply } = require("./helpers");

const prompt = { system: "SYSTEM TEXT", user: "<question>hello</question>" };

function setup(groq, gemini, extra) {
  const logs = [];
  const cfg = getConfig(Object.assign({
    GROQ_API_KEY: "gk-secret-key", GEMINI_API_KEY: "gm-secret-key",
    GROQ_BASE_URL: groq ? groq.url : "http://127.0.0.1:1", GEMINI_BASE_URL: gemini ? gemini.url : "http://127.0.0.1:1",
    GROQ_MODEL: "test-model", GEMINI_MODEL: "gem-test",
  }, extra));
  return { cfg, logs, options: { fetchImpl: fetch, log: (l) => logs.push(l), totalMs: 4000 } };
}

test("Groq request has the documented shape", async () => {
  const groq = await fakeService(() => groqReply("hello from groq"));
  const { cfg, options } = setup(groq, null);
  const result = await askModels(cfg, prompt, options);
  await groq.close();

  assert.deepEqual(result, { provider: "groq", text: "hello from groq" });
  const r = groq.seen[0];
  assert.equal(r.method, "POST");
  assert.equal(r.url, "/chat/completions");
  assert.equal(r.headers.authorization, "Bearer gk-secret-key");
  assert.equal(r.body.model, "test-model");
  assert.deepEqual(r.body.messages, [{ role: "system", content: "SYSTEM TEXT" }, { role: "user", content: "<question>hello</question>" }]);
  assert.equal(r.body.temperature, 0.2);
  assert.ok(r.body.max_completion_tokens >= 500);
});

test("Gemini request has the documented shape", async () => {
  const gemini = await fakeService(() => geminiReply("hello from gemini"));
  const { cfg, options } = setup(null, gemini, { AI_PROVIDERS: "gemini" });
  const result = await askModels(cfg, prompt, options);
  await gemini.close();

  assert.deepEqual(result, { provider: "gemini", text: "hello from gemini" });
  const r = gemini.seen[0];
  assert.equal(r.url, "/models/gem-test:generateContent");
  assert.equal(r.headers["x-goog-api-key"], "gm-secret-key");
  assert.equal(r.headers.authorization, undefined);
  assert.deepEqual(r.body.systemInstruction, { parts: [{ text: "SYSTEM TEXT" }] });
  assert.deepEqual(r.body.contents, [{ role: "user", parts: [{ text: "<question>hello</question>" }] }]);
  assert.equal(r.body.generationConfig.temperature, 0.2);
});

test("when the first provider fails the next one answers", async () => {
  const groq = await fakeService(() => ({ status: 500, json: { error: "down" } }));
  const gemini = await fakeService(() => geminiReply("backup answer"));
  const { cfg, options, logs } = setup(groq, gemini);
  const result = await askModels(cfg, prompt, options);
  await Promise.all([groq.close(), gemini.close()]);

  assert.equal(result.provider, "gemini");
  assert.equal(result.text, "backup answer");
  assert.deepEqual(logs, [{ ev: "provider-error", provider: "groq", reason: "http 500" }]);
});

test("the order can be changed with AI_PROVIDERS", async () => {
  const groq = await fakeService(() => groqReply("from groq"));
  const gemini = await fakeService(() => geminiReply("from gemini"));
  const { cfg, options } = setup(groq, gemini, { AI_PROVIDERS: "gemini,groq" });
  const result = await askModels(cfg, prompt, options);
  await Promise.all([groq.close(), gemini.close()]);
  assert.equal(result.provider, "gemini");
  assert.equal(groq.seen.length, 0);
});

test("answers that are cut off, empty or the wrong shape are treated as failures", async () => {
  const bad = [
    ["groq", groqReply("partial", "length")],
    ["groq", { json: { choices: [] } }],
    ["groq", { json: { nothing: true } }],
    ["groq", { raw: "this is not json" }],
    ["gemini", geminiReply("partial", "MAX_TOKENS")],
    ["gemini", geminiReply("blocked", "SAFETY")],
    ["gemini", { json: { candidates: [] } }],
    ["gemini", { json: { promptFeedback: { blockReason: "SAFETY" } } }],
  ];
  for (const [name, reply] of bad) {
    const service = await fakeService(() => reply);
    const { cfg, options } = setup(name === "groq" ? service : null, name === "gemini" ? service : null, { AI_PROVIDERS: name });
    const result = await askModels(cfg, prompt, options);
    await service.close();
    assert.equal(result, null, name + " " + JSON.stringify(reply).slice(0, 60));
  }
});

test("a provider that never answers is given up on", async () => {
  const slow = await fakeService(() => ({ hang: true }));
  const { cfg, options } = setup(slow, null, { AI_PROVIDERS: "groq" });
  options.totalMs = 1000;
  const started = Date.now();
  const result = await askModels(cfg, prompt, options);
  await slow.close();
  assert.equal(result, null);
  assert.ok(Date.now() - started < 3000, "took too long");
});

test("providers without a key, or that do not exist, are skipped", async () => {
  const groq = await fakeService(() => groqReply("x"));
  const { cfg } = setup(groq, null, { GROQ_API_KEY: "", AI_PROVIDERS: "groq,gemini,madeup" });
  cfg.geminiKey = "";
  assert.deepEqual(configuredProviders(cfg), []);
  assert.equal(await askModels(cfg, prompt, { fetchImpl: fetch, log() {} }), null);
  assert.equal(groq.seen.length, 0);
  await groq.close();
});

test("logs never contain keys, questions or answers", async () => {
  const groq = await fakeService(() => ({ status: 401, json: { error: "bad key gk-secret-key" } }));
  const gemini = await fakeService(() => ({ status: 429, json: { error: "quota" } }));
  const { cfg, options, logs } = setup(groq, gemini);
  await askModels(cfg, prompt, options);
  await Promise.all([groq.close(), gemini.close()]);
  const text = JSON.stringify(logs);
  assert.ok(logs.length === 2);
  ["gk-secret-key", "gm-secret-key", "SYSTEM TEXT", "hello", "bad key"].forEach((s) => assert.ok(!text.includes(s), s));
});
