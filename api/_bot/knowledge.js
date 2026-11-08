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
    // short whole-question phrases, such as "show me a project". They only match when the visitor types exactly that.
    exact: split(fields.exact, "|").map(words).filter(Boolean),
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
  topics.forEach((t) =>
    t.exact.forEach((phrase) => {
      const other = byAsk.get(phrase);
      if (other && other !== t) throw new Error('"' + phrase + '" belongs to both ' + other.id + " and " + t.id);
      byAsk.set(phrase, t);
    })
  );

  return { topics, byAsk };
}

// "could you show me a project please" should work like "show me a project"
const POLITE_START = /^(?:hey |hi |hello |ok |okay |so |and |please |pls |plz |can you |could you |would you |will you |can i |could i |may i |i want to |i would like to |i d like to |id like to |i wanna |let me |lets |let s )/;
const POLITE_END = / (?:please|pls|plz|for me|thanks|thank you|thx)$/;

function withoutPoliteness(text) {
  let plain = words(text);
  let before = "";
  while (plain !== before) {
    before = plain;
    plain = plain.replace(POLITE_START, "").replace(POLITE_END, "").trim();
  }
  return plain;
}

// "what has hamim built" should work like "what has he built"
function asHe(plain) {
  const name = "(?:hasibur rahaman hamim|hasibur rahaman|hasibur|hamim|this guy|this person|this man|the guy)";
  return plain.replace(new RegExp("\\b" + name + " s\\b", "g"), "his").replace(new RegExp("\\b" + name + "\\b", "g"), "he");
}

// a question that matches one of the written questions or short phrases word for word
function findByAsk(kb, question) {
  const plain = withoutPoliteness(question);
  return kb.byAsk.get(words(question)) || kb.byAsk.get(plain) || kb.byAsk.get(asHe(plain)) || null;
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
