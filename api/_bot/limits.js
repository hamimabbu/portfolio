// Slows down anyone who sends too many questions.
// It lives in the memory of one running server instance, so on a serverless host it is a speed bump,
// not a hard wall. The daily AI cap is what protects the free quota.
const crypto = require("crypto");

function createLimiter(options = {}) {
  const perMinute = options.perMinute || 8;
  const perDay = options.perDay || 80;
  const aiPerDay = options.aiPerDay || 250;
  const now = options.now || Date.now;

  // IP addresses are hashed with a random salt that only exists in memory, so none are kept
  const salt = crypto.randomBytes(8).toString("hex");
  const clients = new Map();
  let ai = { day: "", count: 0 };

  const today = () => new Date(now()).toISOString().slice(0, 10);

  function check(clientId) {
    const key = crypto.createHash("sha256").update(salt + String(clientId)).digest("hex").slice(0, 16);
    const time = now();

    // stops the table growing forever if someone rotates addresses
    if (clients.size > 5000) clients.delete(clients.keys().next().value);

    let c = clients.get(key);
    if (!c || c.day !== today()) {
      c = { day: today(), count: 0, recent: [] };
      clients.set(key, c);
    }

    c.recent = c.recent.filter((t) => time - t < 60000);
    if (c.recent.length >= perMinute) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((60000 - (time - c.recent[0])) / 1000)) };
    }
    if (c.count >= perDay) {
      return { ok: false, retryAfter: 3600 };
    }

    c.recent.push(time);
    c.count += 1;
    return { ok: true };
  }

  function aiAllowed() {
    if (ai.day !== today()) ai = { day: today(), count: 0 };
    return ai.count < aiPerDay;
  }

  function countAi() {
    if (ai.day !== today()) ai = { day: today(), count: 0 };
    ai.count += 1;
  }

  return { check, aiAllowed, countAi };
}

module.exports = { createLimiter };
