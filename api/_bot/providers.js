// Talks to the AI services. Each one is a small adapter, so adding another is one more function.
// Anything unexpected throws, and the caller falls back to the next provider or to the plain facts.

// Groq and most other services (OpenRouter, Cerebras, Mistral and more) share this request shape.
async function callChat(base, key, model, prompt, fetchImpl, ms) {
  const res = await fetchImpl(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.2,
      max_completion_tokens: 1000, // some models spend part of this thinking before they answer
    }),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error("http " + res.status);

  const json = await res.json();
  const choice = json && json.choices && json.choices[0];
  if (!choice || !choice.message || typeof choice.message.content !== "string") throw new Error("bad shape");
  if (choice.finish_reason === "length") throw new Error("cut off");
  return choice.message.content;
}

const callGroq = (cfg, prompt, fetchImpl, ms) => callChat(cfg.groqBase, cfg.groqKey, cfg.groqModel, prompt, fetchImpl, ms);

// any other service that speaks the same way, set with the OTHER_AI_* settings
const callOther = (cfg, prompt, fetchImpl, ms) => callChat(cfg.otherBase, cfg.otherKey, cfg.otherModel, prompt, fetchImpl, ms);

async function callGemini(cfg, prompt, fetchImpl, ms) {
  const url = cfg.geminiBase + "/models/" + encodeURIComponent(cfg.geminiModel) + ":generateContent";
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
    }),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error("http " + res.status);

  const json = await res.json();
  const candidate = json && json.candidates && json.candidates[0];
  if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) throw new Error("bad shape");
  if (candidate.finishReason && candidate.finishReason !== "STOP") throw new Error("stopped: " + candidate.finishReason);
  return candidate.content.parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
}

const adapters = { groq: callGroq, gemini: callGemini, other: callOther };

function configuredProviders(cfg) {
  return cfg.providers.filter((name) => adapters[name] && cfg[name + "Key"]);
}

// tries each provider in order until one answers, within an overall time limit
async function askModels(cfg, prompt, options) {
  const fetchImpl = options.fetchImpl;
  const deadline = Date.now() + (options.totalMs || 8000);

  for (const name of configuredProviders(cfg)) {
    const left = deadline - Date.now();
    if (left < 500) break;
    try {
      const text = await adapters[name](cfg, prompt, fetchImpl, Math.min(5000, left));
      return { provider: name, text };
    } catch (error) {
      // only the provider name and a short reason, never the question, the answer or the key
      options.log({ ev: "provider-error", provider: name, reason: String(error && error.message).slice(0, 40) });
    }
  }
  return null;
}

module.exports = { askModels, configuredProviders };
