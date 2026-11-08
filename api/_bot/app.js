// The web handler. api/chat.js is a one line file that exports what this builds.
const path = require("path");
const { getConfig } = require("./config");
const { loadKnowledge } = require("./knowledge");
const { createLimiter } = require("./limits");
const { createBrain } = require("./brain");

const BODY_LIMIT = 2048;

function readBody(req, limit) {
  return new Promise((resolve) => {
    // some hosts have already read and parsed the body for us
    if (req.body !== undefined) {
      let value = req.body;
      if (Buffer.isBuffer(value)) value = value.toString("utf8");
      if (typeof value === "string") {
        if (Buffer.byteLength(value) > limit) return resolve({ tooLarge: true });
        try {
          return resolve({ json: JSON.parse(value) });
        } catch (error) {
          return resolve({ bad: true });
        }
      }
      if (value && typeof value === "object") {
        return resolve(JSON.stringify(value).length > limit ? { tooLarge: true } : { json: value });
      }
      return resolve({ bad: true });
    }

    const chunks = [];
    let size = 0;
    let over = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) over = true;
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (over) return resolve({ tooLarge: true });
      try {
        resolve({ json: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch (error) {
        resolve({ bad: true });
      }
    });
    req.on("error", () => resolve({ bad: true }));
  });
}

// only the same site (or the sites listed in ALLOWED_ORIGINS) may call this
function originAllowed(req, cfg) {
  const origin = req.headers.origin;
  if (!origin) return true; // tools like curl send none
  if (cfg.allowedOrigins.length) return cfg.allowedOrigins.includes(origin.toLowerCase());
  try {
    return new URL(origin).host === req.headers.host;
  } catch (error) {
    return false;
  }
}

function clientId(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || "unknown";
}

function createHandler(options = {}) {
  const cfg = getConfig(options.env || process.env);
  const kb = loadKnowledge(options.knowledgeDir || path.join(__dirname, "knowledge"));
  const limiter = createLimiter(Object.assign({ now: options.now }, cfg.limits));
  const log = options.log || ((event) => console.log(JSON.stringify(Object.assign({ t: new Date().toISOString() }, event))));
  const brain = createBrain({ kb, cfg, limiter, fetchImpl: options.fetch || globalThis.fetch, log, skills: options.skills });

  return async function handler(req, res) {
    function send(status, body, headers) {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      Object.keys(headers || {}).forEach((name) => res.setHeader(name, headers[name]));
      res.end(JSON.stringify(body));
    }

    try {
      if (req.method !== "POST") {
        return send(405, { ok: false, message: "Use POST." }, { Allow: "POST" });
      }
      if (!originAllowed(req, cfg)) {
        log({ ev: "rejected", reason: "origin" });
        return send(403, { ok: false, message: "Not allowed from here." });
      }
      if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
        return send(415, { ok: false, message: "Send JSON." });
      }

      const body = await readBody(req, BODY_LIMIT);
      if (body.tooLarge) return send(413, { ok: false, message: "That request is too big." });
      if (body.bad || !body.json || typeof body.json !== "object") {
        return send(400, { ok: false, message: "I couldn't read that." });
      }

      const limit = limiter.check(clientId(req));
      if (!limit.ok) {
        log({ ev: "rate-limited" });
        return send(
          429,
          { ok: false, message: "That's a lot of questions in a short time. Give it a minute and try again." },
          { "Retry-After": String(limit.retryAfter) }
        );
      }

      const started = Date.now();
      const result = await brain.ask(body.json.q);
      // the question itself is never logged, only what kind of answer it got
      log({ ev: "answered", mode: result.mode, ms: Date.now() - started });
      return send(200, result);
    } catch (error) {
      log({ ev: "error", reason: String(error && error.message).slice(0, 60) });
      return send(500, { ok: false, message: "Something went wrong on my side. Please try again." });
    }
  };
}

module.exports = { createHandler };
