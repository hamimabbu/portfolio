// All settings for the assistant live here.
// Secrets (API keys) are only ever read from environment variables, never from files in the repo.
const crypto = require("crypto");

function list(text, fallback) {
  const items = String(text || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return items.length ? items : fallback;
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getConfig(env = process.env) {
  return {
    maxQuestion: 200,

    // order matters: the first provider with a key is tried first
    providers: list(env.AI_PROVIDERS, ["groq", "gemini"]),

    groqKey: (env.GROQ_API_KEY || "").trim(),
    groqModel: env.GROQ_MODEL || "openai/gpt-oss-20b",
    groqBase: env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",

    geminiKey: (env.GEMINI_API_KEY || "").trim(),
    geminiModel: env.GEMINI_MODEL || "gemini-2.5-flash",
    geminiBase: env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",

    // A random marker hidden in the AI instructions. If it ever shows up in an answer, the answer is dropped.
    canary: env.CANARY || crypto.randomBytes(8).toString("hex"),

    // empty means "same site only"
    allowedOrigins: list(env.ALLOWED_ORIGINS, []),

    limits: {
      perMinute: positive(env.LIMIT_PER_MINUTE, 8),
      perDay: positive(env.LIMIT_PER_DAY, 80),
      aiPerDay: positive(env.AI_DAILY_CAP, 250),
    },
  };
}

module.exports = { getConfig };
