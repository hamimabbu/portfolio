const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { SITE } = require("./helpers");
const knowledge = require("../../api/_bot/knowledge");
const { OPENING_FOLLOW, PROJECT_ASKS } = require("../../api/_bot/brain");

const dir = path.join(SITE, "api", "_bot", "knowledge");
const kb = knowledge.loadKnowledge(dir);
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8");
const siteHtml = ["index.html", "upload-scanner.html", "arp-detector.html", "ad-lab.html", "layerlens.html"].map(read).join("\n");
const siteText = siteHtml.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");

function termData() {
  const m = read("index.html").match(/<script type="application\/json" id="term-data">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}

test("every topic file loads with a title, questions and an answer", () => {
  assert.ok(kb.topics.length >= 20);
  kb.topics.forEach((t) => {
    assert.ok(t.title, t.id);
    assert.ok(t.asks.length >= 1, t.id + " needs at least one question");
    assert.ok(t.body.length >= 1, t.id + " needs an answer");
    assert.ok(t.keywords.length >= 1, t.id + " needs keywords");
  });
});

test("no written question belongs to two topics", () => {
  const total = kb.topics.reduce((sum, t) => sum + t.asks.length, 0);
  assert.equal(kb.byAsk.size, total);
});

test("every follow-up and starter question has its own written answer", () => {
  const missing = [];
  kb.topics.forEach((t) => {
    assert.ok(t.follow.length >= 2 && t.follow.length <= 3, t.id + " should offer 2 or 3 follow-ups");
    t.follow.forEach((q) => {
      if (!knowledge.findByAsk(kb, q)) missing.push(t.id + ": " + q);
      assert.notEqual(knowledge.findByAsk(kb, q), t, t.id + " follows itself");
    });
  });
  termData().bot.starters.forEach((q) => {
    if (!knowledge.findByAsk(kb, q)) missing.push("starter: " + q);
  });
  OPENING_FOLLOW.forEach((q) => {
    if (!knowledge.findByAsk(kb, q)) missing.push("opening: " + q);
  });
  assert.deepEqual(missing, []);
});

test("the page and the knowledge files agree on the facts", () => {
  const knowledgeText = kb.topics.map((t) => t.body.join(" ")).join(" ");
  const numbers = knowledgeText.match(/\d[\d,.]*/g).map((n) => n.replace(/[.,]+$/, ""));
  const strange = [...new Set(numbers)].filter((n) => !siteText.includes(n));
  assert.deepEqual(strange, [], "numbers in the knowledge files that are not on the site");
});

test("key facts match between the terminal data and the knowledge files", () => {
  const all = kb.topics.map((t) => t.body.join(" ")).join(" ");
  const facts = [
    "December 2026", "Wollongong", "30+ commits", "14 unit tests", "3 alerts", "86 end-to-end tests",
    "14 backend unit tests", "18-screen", "19-slide", "marvel.local", "Java 21", "Micromax Technology",
    "PNPT", "Windows Server 2022", "CSCI262", "CSCI318", "CSIT314", "CSCI316", "LayerLens", "62 automated tests",
  ];
  facts.forEach((fact) => {
    assert.ok(all.includes(fact), "knowledge is missing: " + fact);
    assert.ok(siteText.includes(fact), "site is missing: " + fact);
  });
});

test("links in the knowledge files are links the site already has", () => {
  kb.topics.forEach((t) =>
    t.links.forEach(([label, url]) => {
      assert.ok(label.length > 0);
      assert.ok(siteHtml.includes(url.replace(/&/g, "&amp;")) || siteHtml.includes(url), t.id + " links to " + url);
    })
  );
});

test("knowledge files are plain ASCII with no em dashes", () => {
  fs.readdirSync(dir).forEach((f) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(!/[^\x00-\x7f]/.test(text), f);
  });
});

// questions people might type, and the topic that should come first
const lookups = [
  ["does he know kerberoasting", "ad-lab"],
  ["what is the capstone about", "capstone"],
  ["tell me about the arp detector", "arp-detector"],
  ["any python experience?", "tools"],
  ["is he open to relocating", "location"],
  ["can he work from home", "location"],
  ["does he have a visa", "work-rights"],
  ["what certifications does he have", "education"],
  ["how do I hire him", "contact"],
  ["can I see his CV", "contact"],
  ["what is his email", "contact"],
  ["does this site use cookies", "privacy"],
  ["are you chatgpt", "assistant"],
  ["tell me about the kafka project", "retail-system"],
  ["what about his loan project", "loan-prediction"],
  ["any machine learning", "loan-prediction"],
  ["where did he work before", "work"],
  ["what is the pnpt", "education"],
  ["tell me about kerberoasting", "ad-lab"],
  ["is he studying anything now", "education"],
  ["what is the talentmatch app", "talentmatch"],
  ["does he have security clearance", "work-rights"],
  ["which uni does he go to", "education"],
  ["can he start immediately", "availability"],
  ["tell me about the expiry app", "expirytracker"],
  ["what did he do with wireshark", "arp-detector"],
  // questions a recruiter asks that used to find nothing, or the wrong topic
  ["what is his name", "about"],
  ["what is his full name", "about"],
  ["summarise his profile", "about"],
  ["can I see his github", "code"],
  ["show me his code", "code"],
  ["is the code public", "code"],
  ["where is the arp repo", "code"],
  ["show me his projects", "projects"],
  ["how many projects has he done", "projects"],
  ["does he have a portfolio", "projects"],
  ["tell me about his projects", "projects"],
  ["what was his role in the team project", "team-role"],
  ["what did he contribute to the capstone", "team-role"],
  ["what was his contribution", "team-role"],
  ["what are his career goals", "goals"],
  ["why does he want to work in cyber security", "goals"],
  ["does he prefer offensive or defensive security", "goals"],
  ["is he interested in pentesting", "goals"],
  ["which project is he most proud of", "favourite"],
  ["what is his proudest achievement", "favourite"],
  ["is he open to contract work", "work-type"],
  ["is he open to part-time roles", "work-type"],
  ["is he looking for an internship", "work-type"],
  ["can he work in melbourne", "location"],
  ["is he available for an interview", "contact"],
  ["what is his phone number", "contact"],
  ["what can you do", "assistant"],
  ["who are you", "assistant"],
  ["is he a good fit for a soc analyst role", "roles"],
  // new topics must not take questions that belong to a project or to his jobs
  ["what is his job at coles", "work"],
  ["what does he do at coles", "work"],
  ["does he work part-time", "work"],
  ["what is he interested in learning", "learning"],
  ["tell me about the talentmatch team project", "talentmatch"],
  ["what is the retail team project", "retail-system"],
  ["what is the capstone team project about", "capstone"],
  ["which of his projects uses scapy", "arp-detector"],
  ["what did he do in the capstone", "capstone"],
  ["tell me about layerlens", "layerlens"],
  ["what is the threat model in his web app", "layerlens"],
  ["does his project protect against ssrf", "layerlens"],
  ["which projects are public", "code"],
  ["does he have personal projects", "projects"],
  ["any side projects", "projects"],
  // a single word is enough to reach the right topic
  ["github", "code"],
  ["GitHub?", "code"],
  ["git", "tools"],
  // the same "why" question asked in different words
  ["why did he go into cyber security", "goals"],
  ["what got him into cyber security", "goals"],
  ["what drew him to security", "goals"],
  ["what made him pick cyber security", "goals"],
  ["what inspired him", "goals"],
];

test("free-text questions find the right topic", () => {
  const wrong = [];
  lookups.forEach(([q, id]) => {
    const hits = knowledge.search(kb, q, 3);
    if (!hits.length || hits[0].topic.id !== id) wrong.push(q + " -> " + (hits[0] ? hits[0].topic.id : "nothing") + " (wanted " + id + ")");
  });
  assert.deepEqual(wrong, []);
});

test("the answers about his part, his code and what he prefers only say what the site says", () => {
  const body = (id) => kb.topics.find((t) => t.id === id).body.join(" ");

  // the part he played in each team project comes from the project topics
  const team = body("team-role");
  ["Product and Inventory services", "18-screen interactive prototype", "19-slide presentation", "role-based permissions"].forEach((fact) => {
    assert.ok(team.includes(fact), "team-role is missing: " + fact);
    assert.ok(kb.topics.some((t) => t.id !== "team-role" && t.body.join(" ").includes(fact)), fact + " is not in any project topic");
  });

  // the code topic keeps the public and non-public repositories apart
  const code = body("code");
  assert.ok(code.includes("github.com/hamimabbu"));
  assert.ok(code.includes("ARP detector is a public repository"));
  assert.ok(!code.includes("private for now"));
  assert.ok(code.includes("not public"));

  // the topics that answer "why" and "which is your favourite" say the site does not give it
  assert.ok(body("favourite").includes("does not say which project"));
  assert.ok(body("goals").includes("does not say why he chose cyber security"));
  assert.ok(body("goals").includes("what his longer-term plans are"));
  assert.ok(body("work-type").includes("does not say whether he would also consider"));
});

test("the LayerLens answer keeps its limits and the code answer links it", () => {
  const layerlens = kb.topics.find((x) => x.id === "layerlens").body.join(" ");
  [
    "It is not deployed",
    "has not been run against real TLS traffic",
    "only run against a local test DNS server",
    "no independent security audit",
  ].forEach((limit) => assert.ok(layerlens.includes(limit), "layerlens topic is missing: " + limit));
  const code = kb.topics.find((x) => x.id === "code");
  assert.ok(code.links.some(([, url]) => url === "https://github.com/hamimabbu/layerlens"), "code topic has no LayerLens link");
});

test("the project count in the all-projects answer matches the projects on the page", () => {
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const count = termData().projects.length;
  const body = kb.topics.find((x) => x.id === "projects").body.join(" ");
  assert.ok(body.includes("lists " + numberWords[count] + " projects"), "the projects topic does not say " + numberWords[count]);
});

test("each project number has a follow-up question that leads to that project", () => {
  termData().projects.forEach((project) => {
    const ask = PROJECT_ASKS[project.n];
    assert.ok(ask, "no follow-up for project " + project.n);
    const topic = knowledge.findByAsk(kb, ask);
    assert.ok(topic, "no written answer for: " + ask);
    const body = (topic.title + " " + topic.body.join(" ")).toLowerCase();
    assert.ok(project.keys.some((key) => body.includes(key)), "follow-up for project " + project.n + " leads to " + topic.id);
  });
});

test("no answer says more than the site shows", () => {
  // wording that would claim a detector stops attacks, that he has already run attacks, or that he rates himself
  const banned = [
    /\bstops? (the )?attacks?\b/i,
    /\bprevents? (the )?attacks?\b/i,
    /\bpractises (the )?attacks\b/i,
    /\bwhere he practises\b/i,
    /\bexpert\b/i,
    /\byears of experience\b/i,
  ];
  const found = [];
  kb.topics.forEach((t) => {
    t.body.forEach((line) => {
      banned.forEach((pattern) => {
        if (pattern.test(line)) found.push(t.id + ": " + line);
      });
    });
  });
  assert.deepEqual(found, []);

  // the home page says the same: the lab was built to practise the attacks, and the attacks come next
  assert.ok(!/where I practise/i.test(read("index.html")), "the home page says he already practises attacks in a lab");
});

test("an answer that says the site does not have something also says where to ask", () => {
  const missing = [];
  kb.topics.forEach((t) => {
    t.body.forEach((line, i) => {
      const admitsGap = /(site|it) does not (say|list|describe|give|show)/i.test(line);
      const pointer = /linkedin/i.test(line) || /linkedin/i.test(t.body[i + 1] || "");
      if (admitsGap && !pointer) missing.push(t.id + ": " + line);
    });
  });
  assert.deepEqual(missing, []);
});

test("questions about things that are not on the site find nothing", () => {
  [
    "does he know rust", "what is the capital of france", "does hamim play football", "how old is he",
    "what is his salary expectation", "does he have a girlfriend", "what is the weather", "write me a poem",
  ].forEach((q) => assert.equal(knowledge.search(kb, q, 3).length, 0, q));
});
