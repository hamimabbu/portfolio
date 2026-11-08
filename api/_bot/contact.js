// The contact form handler. api/contact.js is a one line file that exports what this builds.
//
// A visitor writes a message on the page. This code checks it and mails it to the owner through a mail service
// (Resend by default). The owner's address only lives in an environment variable on the host (CONTACT_TO),
// so it is never in the page, in the repository or in any response.
//
// Settings (all environment variables):
//   RESEND_API_KEY   key from resend.com
//   CONTACT_TO       the address that receives the messages. With Resend's free test sender this must be
//                    the same address the Resend account was made with.
//   CONTACT_FROM     optional, default "Portfolio contact <onboarding@resend.dev>"
//   CONTACT_DAILY_CAP optional, default 30 messages a day for the whole site
const { readBody, originAllowed, clientId } = require("./app");
const { getConfig } = require("./config");
const { createLimiter } = require("./limits");

const BODY_LIMIT = 8192;
const MAX = { name: 80, email: 120, message: 2000 };
const MIN_MESSAGE = 10;
const MAIL_URL = "https://api.resend.com/emails";

// removes control characters (keeps new lines in the message) and collapses odd spacing
function clean(text, keepLines) {
  let out = String(text).replace(/\r\n?/g, "\n");
  out = out.replace(keepLines ? /[\u0000-\u0009\u000b-\u001f\u007f\u0085\u2028\u2029]/g : /[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, " ");
  out = out.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "");
  if (keepLines) out = out.replace(/\n{3,}/g, "\n\n");
  else out = out.replace(/\s+/g, " ");
  return out.trim();
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

// returns { ok, value } or { ok: false, field, message }
function check(body) {
  const asText = (v) => (typeof v === "string" ? v : "");
  const name = clean(asText(body.name), false);
  const email = clean(asText(body.email), false);
  const message = clean(asText(body.message), true);

  if (!name) return { ok: false, field: "name", message: "Please add your name." };
  if (name.length > MAX.name) return { ok: false, field: "name", message: "That name is too long." };
  if (!email || !EMAIL.test(email) || email.length > MAX.email) {
    return { ok: false, field: "email", message: "Please add an email address I can reply to, like name@example.com." };
  }
  if (message.length < MIN_MESSAGE) return { ok: false, field: "message", message: "Please write a little more, at least " + MIN_MESSAGE + " characters." };
  if (message.length > MAX.message) return { ok: false, field: "message", message: "That message is too long. Please keep it under " + MAX.message + " characters." };
  return { ok: true, value: { name, email, message } };
}

function createContactHandler(options = {}) {
  const env = options.env || process.env;
  const cfg = getConfig(env);
  const key = (env.RESEND_API_KEY || "").trim();
  const to = (env.CONTACT_TO || "").trim();
  const from = (env.CONTACT_FROM || "Portfolio contact <onboarding@resend.dev>").trim();
  const dailyCap = Number(env.CONTACT_DAILY_CAP) > 0 ? Number(env.CONTACT_DAILY_CAP) : 30;
  const fetchImpl = options.fetch || globalThis.fetch;
  const now = options.now || Date.now;
  const log = options.log || ((event) => console.log(JSON.stringify(Object.assign({ t: new Date().toISOString() }, event))));
  // a few messages per visitor, and a daily cap for the whole site so nobody can flood the inbox or the free mail quota
  const limiter = createLimiter({ perMinute: 2, perDay: 6, now });
  let day = { key: "", count: 0 };

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
      if (req.method !== "POST" && req.method !== "GET") {
        return send(405, { ok: false, message: "Use GET or POST." }, { Allow: "GET, POST" });
      }
      if (!originAllowed(req, cfg)) {
        log({ ev: "contact", result: "origin" });
        return send(403, { ok: false, message: "Not allowed from here." });
      }
      // The page asks this before it shows the form, so a visitor never types a message that cannot be sent.
      // It only says yes or no. No setting is ever shown.
      if (req.method === "GET") return send(200, { ok: true, ready: Boolean(key && to) });
      if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
        return send(415, { ok: false, message: "Send JSON." });
      }

      const body = await readBody(req, BODY_LIMIT);
      if (body.tooLarge) return send(413, { ok: false, message: "That message is too big." });
      if (body.bad || !body.json || typeof body.json !== "object" || Array.isArray(body.json)) {
        return send(400, { ok: false, message: "I couldn't read that." });
      }

      // switched off until the two settings exist
      if (!key || !to) {
        log({ ev: "contact", result: "not-set-up" });
        return send(503, { ok: false, code: "not-set-up", message: "Messages are not switched on yet. Please use LinkedIn for now." });
      }

      // the hidden box was filled in, which only a bot does. It gets a normal looking answer and nothing is sent.
      if (typeof body.json.site === "string" && body.json.site.trim() !== "") {
        log({ ev: "contact", result: "bot" });
        return send(200, { ok: true, message: "Thanks. Your message is on its way." });
      }

      const checked = check(body.json);
      if (!checked.ok) return send(422, { ok: false, field: checked.field, message: checked.message });

      const limit = limiter.check(clientId(req));
      if (!limit.ok) {
        log({ ev: "contact", result: "rate-limited" });
        return send(429, { ok: false, message: "That is a few messages in a short time. Please try again later, or use LinkedIn." }, { "Retry-After": String(limit.retryAfter) });
      }
      const today = new Date(now()).toISOString().slice(0, 10);
      if (day.key !== today) day = { key: today, count: 0 };
      if (day.count >= dailyCap) {
        log({ ev: "contact", result: "daily-cap" });
        return send(503, { ok: false, message: "The inbox is full for today. Please use LinkedIn." });
      }

      const { name, email, message } = checked.value;
      const text = "Name: " + name + "\nEmail: " + email + "\n\n" + message + "\n\n--\nSent from the contact form on the portfolio site.";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      let response;
      try {
        response = await fetchImpl(MAIL_URL, {
          method: "POST",
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [to],
            reply_to: email,
            subject: ("Portfolio message from " + name).slice(0, 100),
            text,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response || !response.ok) {
        // the provider's reply is never passed on, because it can name the address or the account
        log({ ev: "contact", result: "provider-error", status: response ? response.status : 0 });
        return send(502, { ok: false, message: "I could not send that just now. Please try again in a minute, or use LinkedIn." });
      }

      day.count += 1;
      log({ ev: "contact", result: "sent" });
      return send(200, { ok: true, message: "Thanks. Your message is on its way." });
    } catch (error) {
      log({ ev: "contact", result: "error", reason: String(error && error.name).slice(0, 30) });
      return send(502, { ok: false, message: "I could not send that just now. Please try again in a minute, or use LinkedIn." });
    }
  };
}

module.exports = { createContactHandler, check, clean };
