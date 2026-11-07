// Loads the plain text files in the knowledge folder and finds the best topic for a question.
// To change what the assistant knows, edit those text files. There is no training step.
const fs = require("fs");
const path = require("path");

// lower case, letters and numbers only, one space between words
function words(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
}

// "projects" -> "project", so a plural in the question still matches
function singular(text) {
  return text
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

function parseTopic(file, raw) {
  const parts = raw.replace(/\r\n/g, "\n").split(/\n---\n/);
  if (parts.length < 2) throw new Error(file + ": the line --- is missing");

  const fields = {};
  parts[0].split("\n").forEach((line) => {
    const at = line.indexOf(":");
    if (at > 0) fields[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  });
  if (!fields.title || !fields.asks) throw new Error(file + ": needs a title and asks line");

  const split = (text, mark) => (text || "").split(mark).map((s) => s.trim()).filter(Boolean);

  return {
    id: file.replace(/^\d+-/, "").replace(/\.txt$/, ""),
    title: fields.title,
    keywords: split(fields.keywords, ",").map(words).filter(Boolean),
    asks: split(fields.asks, "|"),
    follow: split(fields.follow, "|"),
    links: split(fields.links, ";").map((item) => split(item, "|")).filter((pair) => pair.length === 2),
    body: parts.slice(1).join("\n---\n").split("\n").map((s) => s.trim()).filter(Boolean),
  };
}

function loadKnowledge(dir) {
  const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.txt$/.test(f)).sort();
  const topics = files.map((f) => parseTopic(f, fs.readFileSync(path.join(dir, f), "utf8")));

  const byAsk = new Map();
  topics.forEach((t) => t.asks.forEach((q) => byAsk.set(words(q), t)));

  return { topics, byAsk };
}

// a question that matches one of the written questions word for word
function findByAsk(kb, question) {
  return kb.byAsk.get(words(question)) || null;
}

// scores every topic by its keywords, and longer phrases count for more
function search(kb, question, limit = 3) {
  const plain = " " + words(question) + " ";
  const plainSingular = " " + singular(words(question)) + " ";

  const scored = kb.topics.map((topic, index) => {
    let score = 0;
    topic.keywords.forEach((keyword) => {
      const tests = [" " + keyword + " ", " " + singular(keyword) + " "];
      if (tests.some((t) => plain.includes(t) || plainSingular.includes(t))) {
        score += keyword.split(" ").length;
      }
    });
    return { topic, score, index };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);
}

module.exports = { loadKnowledge, findByAsk, search, words };
