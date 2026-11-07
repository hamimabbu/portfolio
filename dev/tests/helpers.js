// Small helpers shared by the tests
const http = require("http");
const path = require("path");
const { Readable } = require("stream");
const { createHandler } = require("../../api/_bot/app");

const SITE = path.resolve(__dirname, "..", "..");

// runs the handler with a pretend request and returns what it answered
async function call(handler, options = {}) {
  const headers = Object.assign({ host: "site.test", "content-type": "application/json" }, options.headers);
  const raw = options.raw !== undefined ? options.raw : JSON.stringify(options.body);

  let req;
  if (options.parsed !== undefined) {
    // some hosts read the body for us
    req = { body: options.parsed };
  } else {
    req = Readable.from(raw === undefined ? [] : [Buffer.from(raw)]);
  }
  req.method = options.method || "POST";
  req.headers = headers;
  req.socket = { remoteAddress: options.ip || "10.0.0.1" };

  return new Promise((resolve) => {
    const out = { headers: {} };
    const res = {
      statusCode: 200,
      setHeader(name, value) { out.headers[name.toLowerCase()] = value; },
      end(text) {
        let body = null;
        try { body = JSON.parse(text); } catch (error) { body = text; }
        resolve({ status: res.statusCode, headers: out.headers, body, text });
      },
    };
    handler(req, res);
  });
}

function makeHandler(env = {}, extra = {}) {
  const logs = [];
  const handler = createHandler(Object.assign({ env, log: (line) => logs.push(line) }, extra));
  return { handler, logs };
}

const ask = (handler, q, extra) => call(handler, Object.assign({ body: { q } }, extra));

// a pretend AI service. `respond(request)` returns { status, json } or { hang: true }
function fakeService(respond) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body = null;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (error) { /* leave null */ }
      const request = { method: req.method, url: req.url, headers: req.headers, body };
      seen.push(request);
      const reply = respond(request, seen.length);
      if (reply.hang) return; // never answers, to test timeouts
      res.writeHead(reply.status || 200, { "Content-Type": "application/json" });
      res.end(reply.raw !== undefined ? reply.raw : JSON.stringify(reply.json));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: "http://127.0.0.1:" + server.address().port,
        seen,
        close: () => { server.closeAllConnections && server.closeAllConnections(); return new Promise((r) => server.close(r)); },
      });
    });
  });
}

const groqReply = (content, finish = "stop") => ({ json: { choices: [{ message: { content }, finish_reason: finish }] } });
const geminiReply = (text, finish = "STOP") => ({ json: { candidates: [{ content: { parts: [{ text }] }, finishReason: finish }] } });

module.exports = { SITE, call, makeHandler, ask, fakeService, groqReply, geminiReply };
