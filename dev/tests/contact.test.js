const test = require("node:test");
const assert = require("node:assert/strict");
const { createContactHandler, check, clean } = require("../../api/_bot/contact");
const { call } = require("./helpers");

const ENV = { RESEND_API_KEY: "re_test_key", CONTACT_TO: "owner@example.test" };
const GOOD = { name: "Jo Visitor", email: "jo@example.com", message: "Hello Hamim, I would like to talk about a graduate role." };

// a pretend mail service that records what it was sent
function fakeMail(status = 200) {
  const sent = [];
  const fetch = async (url, options) => {
    sent.push({ url, options, body: JSON.parse(options.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
  };
  return { sent, fetch };
}

function make(env = ENV, mail = fakeMail(), extra = {}) {
  const logs = [];
  const handler = createContactHandler(Object.assign({ env, fetch: mail.fetch, log: (l) => logs.push(l) }, extra));
  return { handler, logs, mail };
}

const post = (handler, body, extra) => call(handler, Object.assign({ body }, extra));

test("a good message is mailed to the owner, with the visitor as the reply address", async () => {
  const { handler, mail } = make();
  const r = await post(handler, GOOD);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(mail.sent.length, 1);
  const sent = mail.sent[0];
  assert.equal(sent.url, "https://api.resend.com/emails");
  assert.equal(sent.options.headers.Authorization, "Bearer re_test_key");
  assert.deepEqual(sent.body.to, ["owner@example.test"]);
  assert.equal(sent.body.reply_to, "jo@example.com");
  assert.match(sent.body.subject, /Jo Visitor/);
  assert.match(sent.body.text, /Hello Hamim/);
});

test("the owner's address and the key never appear in any answer", async () => {
  const { handler } = make();
  const answers = [
    await post(handler, GOOD),
    await post(handler, { name: "", email: "x", message: "y" }),
    await post(handler, GOOD, { method: "GET" }),
    await post(handler, GOOD, { method: "PUT" }),
    await post(handler, GOOD, { headers: { origin: "https://evil.example" } }),
  ];
  const failing = make(ENV, fakeMail(500));
  answers.push(await post(failing.handler, GOOD));
  answers.forEach((a) => {
    assert.ok(!/owner@example\.test|re_test_key|resend/i.test(a.text), a.text);
  });
});

test("nothing is sent and the visitor is told so when the mail settings are missing", async () => {
  for (const env of [{}, { RESEND_API_KEY: "k" }, { CONTACT_TO: "a@b.test" }]) {
    const { handler, mail } = make(env);
    const r = await post(handler, GOOD);
    assert.equal(r.status, 503);
    assert.equal(r.body.code, "not-set-up");
    assert.equal(mail.sent.length, 0);
  }
});

test("fields are checked, and each problem names the field", async () => {
  const { handler, mail } = make();
  const cases = [
    [{ name: "", email: "jo@example.com", message: GOOD.message }, "name"],
    [{ name: "x".repeat(81), email: "jo@example.com", message: GOOD.message }, "name"],
    [{ name: "Jo", email: "not-an-email", message: GOOD.message }, "email"],
    [{ name: "Jo", email: "a b@example.com", message: GOOD.message }, "email"],
    [{ name: "Jo", email: "jo@example.com,other@example.com", message: GOOD.message }, "email"],
    [{ name: "Jo", email: "jo@example.com", message: "short" }, "message"],
    [{ name: "Jo", email: "jo@example.com", message: "x".repeat(2001) }, "message"],
    [{ name: 5, email: {}, message: [] }, "name"],
  ];
  for (const [body, field] of cases) {
    const r = await post(handler, body);
    assert.equal(r.status, 422, JSON.stringify(body).slice(0, 60));
    assert.equal(r.body.field, field);
  }
  assert.equal(mail.sent.length, 0);
});

test("a filled in hidden box looks like a success but sends nothing", async () => {
  const { handler, mail, logs } = make();
  const r = await post(handler, Object.assign({ site: "http://spam.example" }, GOOD));
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(mail.sent.length, 0);
  assert.ok(logs.some((l) => l.result === "bot"));
});

test("line breaks and hidden characters cannot be used to add mail headers", async () => {
  const { handler, mail } = make();
  const r = await post(handler, { name: "Jo\r\nBcc: spam@example.com", email: "jo@example.com", message: GOOD.message });
  assert.equal(r.status, 200);
  const sent = mail.sent[0].body;
  assert.ok(!/[\r\n]/.test(sent.subject));
  assert.ok(!/[\r\n]/.test(sent.reply_to));
  assert.equal(sent.to.length, 1);
  assert.equal(clean("a‮b​c", false), "abc");
  assert.equal(clean("one\n\n\n\ntwo", true), "one\n\ntwo");
});

test("only the same site may post, and only JSON", async () => {
  const { handler, mail } = make();
  assert.equal((await post(handler, GOOD, { headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await post(handler, GOOD, { headers: { origin: "https://site.test" } })).status, 200);
  assert.equal((await post(handler, GOOD, { method: "PUT" })).status, 405);
  assert.equal((await post(handler, GOOD, { method: "DELETE" })).headers.allow, "GET, POST");
  assert.equal((await call(handler, { raw: "name=a", headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await call(handler, { raw: "{oops" })).status, 400);
  assert.equal((await call(handler, { raw: JSON.stringify({ message: "x".repeat(9000) }) })).status, 413);
  assert.equal(mail.sent.length, 1);
});

test("a visitor can only send a few messages, and the whole site has a daily cap", async () => {
  const one = make();
  const results = [];
  for (let i = 0; i < 4; i++) results.push((await post(one.handler, GOOD, { ip: "10.1.1.1" })).status);
  assert.deepEqual(results, [200, 200, 429, 429]);

  const capped = make(Object.assign({ CONTACT_DAILY_CAP: "3" }, ENV));
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post(capped.handler, GOOD, { ip: "10.2.2." + i })).status);
  assert.deepEqual(codes, [200, 200, 200, 503, 503]);
  assert.equal(capped.mail.sent.length, 3);
});

test("when the mail service fails the visitor gets a plain message and the details are not passed on", async () => {
  const down = make(ENV, fakeMail(500));
  const r = await post(down.handler, GOOD);
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
  assert.match(r.body.message, /LinkedIn/);
  assert.ok(down.logs.some((l) => l.result === "provider-error" && l.status === 500));

  const hang = make(ENV, { sent: [], fetch: async () => { throw new Error("socket closed with owner@example.test"); } });
  const r2 = await post(hang.handler, GOOD);
  assert.equal(r2.status, 502);
  assert.ok(!/owner@example\.test/.test(r2.text));
});

test("the message text is never written to the log", async () => {
  const { handler, logs } = make();
  await post(handler, GOOD);
  const text = JSON.stringify(logs);
  assert.ok(!/Hello Hamim|jo@example\.com|Jo Visitor/.test(text), text);
});

test("check() trims and accepts a normal message", () => {
  const r = check({ name: "  Jo  ", email: " jo@example.com ", message: "  Hello there, nice site.  " });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: "Jo", email: "jo@example.com", message: "Hello there, nice site." });
});

test("the page can ask if mail is set up, and only gets a yes or no", async () => {
  const on = make();
  const yes = await call(on.handler, { method: "GET" });
  assert.equal(yes.status, 200);
  assert.deepEqual(yes.body, { ok: true, ready: true });
  assert.equal(yes.headers["cache-control"], "no-store");
  assert.ok(!/owner@example\.test|re_test_key|resend/i.test(yes.text), yes.text);

  for (const env of [{}, { RESEND_API_KEY: "k" }, { CONTACT_TO: "a@b.test" }]) {
    const off = make(env);
    const no = await call(off.handler, { method: "GET" });
    assert.equal(no.status, 200);
    assert.deepEqual(no.body, { ok: true, ready: false });
    assert.equal(off.mail.sent.length, 0);
  }
});

test("asking if mail is set up does not use up the visitor's message allowance and is not from other sites", async () => {
  const { handler, mail } = make();
  for (let i = 0; i < 10; i++) await call(handler, { method: "GET" });
  assert.equal((await post(handler, GOOD)).status, 200);
  assert.equal((await call(handler, { method: "GET", headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal(mail.sent.length, 1);
});
