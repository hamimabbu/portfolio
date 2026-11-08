// Local test server. It serves the site and the /api/chat address, with the same security headers as vercel.json.
//   node dev/server.js        then open http://localhost:3000
// Keys can go in a file called .env.local in the site folder (see dev/env.example).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// reads KEY=value lines from .env.local if it exists; real environment variables win
function loadEnvFile(env) {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !line.trim().startsWith("#") && match[2] && env[match[1]] === undefined) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  });
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function createServer(options = {}) {
  const env = Object.assign({}, options.env || process.env);
  if (!options.env) loadEnvFile(env);

  const { createHandler } = require(path.join(ROOT, "api", "_bot", "app"));
  const chat = createHandler({ env, fetch: options.fetch, log: options.log });
  const { createContactHandler } = require(path.join(ROOT, "api", "_bot", "contact"));
  const contact = createContactHandler({ env, fetch: options.fetch, log: options.log });

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const headers = {};
  for (const rule of config.headers) for (const h of rule.headers) headers[h.key] = h.value;

  return http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(req.url.split("?")[0]);
    } catch (error) {
      url = "/__bad__";
    }

    if (url === "/api/chat" || url === "/api/contact") {
      Object.keys(headers).forEach((name) => res.setHeader(name, headers[name]));
      return (url === "/api/chat" ? chat : contact)(req, res);
    }

    if (url === "/") url = "/index.html";
    if (!path.extname(url) && fs.existsSync(path.join(ROOT, url + ".html"))) url += ".html";

    const file = path.join(ROOT, url);
    const parts = url.split("/").filter(Boolean);
    // like the live host: no key files, no server code, no test files
    const hidden = parts.some((p) => p.startsWith(".") && p !== ".well-known") || ["api", "dev", "node_modules"].includes(parts[0]);
    const found = !hidden && file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();

    const body = found ? fs.readFileSync(file) : fs.readFileSync(path.join(ROOT, "404.html"));
    const type = found ? types[path.extname(file)] || "application/octet-stream" : types[".html"];
    res.writeHead(found ? 200 : 404, Object.assign({ "Content-Type": type }, headers));
    res.end(req.method === "HEAD" ? undefined : body);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, "127.0.0.1", () => {
    console.log("Site and assistant running at http://localhost:" + port);
    console.log("Press Ctrl+C to stop.");
  });
}
