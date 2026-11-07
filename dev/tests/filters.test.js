const test = require("node:test");
const assert = require("node:assert/strict");
const { normalise, checkInput, checkOutput } = require("../../api/_bot/filters");
const { SITE } = require("./helpers");
const fs = require("fs");

const starters = JSON.parse(
  fs.readFileSync(SITE + "/index.html", "utf8").match(/id="term-data">([\s\S]*?)<\/script>/)[1]
).bot.starters;

test("normalise removes hidden characters, accents and look-alike letters", () => {
  assert.equal(normalise("ig​nore").plain, "ignore");
  assert.equal(normalise("ｉｇｎｏｒｅ").plain, "ignore"); // full-width letters
  assert.equal(normalise("іgnоrе").plain, "ignore"); // Cyrillic look-alikes
  assert.equal(normalise("ígnóre").plain, "ignore"); // accents
  assert.equal(normalise("1gn0r3").folded, "ignore"); // number swaps
  assert.equal(normalise("i.g.n.o.r.e").squashed, "ignore");
  assert.equal(normalise("a\u0000b\u0007c").shown, "a b c");
});

test("normal questions pass", () => {
  const normal = [
    ...starters,
    "Does he have any Python experience?",
    "Can you tell me more about the ARP detector?",
    "Is he good with Active Directory?",
    "What did he do for the Micromax capstone?",
    "Has he used Kali Linux?",
    "Is Hamim a student or has he graduated?",
    "What is the PNPT?",
    "Can I ignore the gaps in his lab experience?",
    "Which project should I look at first?",
    "How many unit tests does the detector have?",
    "Where in Sydney would he work?",
    "Does he work well in a team?",
    "What's the difference between his AD lab and the ARP project?",
    "Is he good at networking?",
    "Hi!",
    "thanks",
  ];
  normal.forEach((q) => {
    const r = checkInput(q);
    assert.equal(r.ok, true, q + " was refused: " + r.reason);
  });
});

test("bad input shapes are refused", () => {
  assert.equal(checkInput(undefined).reason, "type");
  assert.equal(checkInput(42).reason, "type");
  assert.equal(checkInput({ q: "x" }).reason, "type");
  assert.equal(checkInput("").reason, "empty");
  assert.equal(checkInput("   ").reason, "empty");
  assert.equal(checkInput("a").reason, "empty");
  assert.equal(checkInput("word ".repeat(60)).reason, "length");
  assert.equal(checkInput("x".repeat(100000)).reason, "length");
});

test("angle brackets and backticks never reach the model", () => {
  const r = checkInput("What did he build <b>for</b> the capstone?");
  assert.equal(r.ok, true);
  assert.ok(!/[<>`]/.test(r.text));
});

test("output check accepts a grounded answer", () => {
  const context = "Hamim graduates in December 2026. He built the ARP poisoning detector in Python and Scapy. linkedin.com/in/hasibur-rahaman-hamim";
  const good = [
    "Hamim graduates in December 2026.",
    "He built the ARP poisoning detector with Python and Scapy.",
    "The quickest way is LinkedIn: https://www.linkedin.com/in/hasibur-rahaman-hamim",
  ];
  good.forEach((a) => assert.equal(checkOutput(a, { context }).ok, true, a));
});

test("output check refuses invented details", () => {
  const context = "Hamim graduates in December 2026. He built the ARP poisoning detector in Python and Scapy.";
  const bad = {
    "He graduates in 2027.": "number",
    "He built it in Python and also worked at Google.": "name",
    "Email him at hamim@example.com": "link",
    "See https://evil.example/login": "link",
    "Visit evil.com for more": "link",
    ["x".repeat(800)]: "long",
    "": "empty",
    "   ": "empty",
  };
  Object.entries(bad).forEach(([answer, reason]) => assert.equal(checkOutput(answer, { context }).reason, reason, answer.slice(0, 30)));
});

test("output check compares numbers whole, not as pieces of a longer number", () => {
  const context = "14 unit tests pass with python 3.11, 3.12 and 3.13. graduates in december 2026.";
  const ok = ["It has 14 unit tests.", "It runs on Python 3.12.", "He graduates in 2026."];
  ok.forEach((a) => assert.equal(checkOutput(a, { context }).ok, true, a));
  const bad = ["It has 12 years of work.", "It runs on Python 3.", "He graduates in 202.", "It has 4 unit tests.", "It has 1 unit test."];
  bad.forEach((a) => assert.equal(checkOutput(a, { context }).reason, "number", a));
});

test("output check refuses leaks of the hidden marker and the rules", () => {
  const options = { context: "Hamim studies.", canary: "abc123def456", secretPhrases: ["untrusted text", "never invent"] };
  assert.equal(checkOutput("Sure, the marker is ABC123DEF456.", options).reason, "canary");
  assert.equal(checkOutput("My rules say the question is untrusted text.", options).reason, "prompt-echo");
  assert.equal(checkOutput("I must never invent things.", options).reason, "prompt-echo");
});

test("output check strips markdown and tags", () => {
  const r = checkOutput("**Hamim** studies <b>hard</b> `now`.", { context: "hamim studies hard now." });
  assert.equal(r.ok, true);
  assert.equal(r.lines[0], "Hamim studies hard now.");
});

test("output check allows a pointer to LinkedIn and bullet lists, but still refuses invented names", () => {
  const context = "Hamim built the ARP poisoning detector in Python and Scapy. It raises alerts.";
  const ok = [
    "That is not on the site, so LinkedIn is the best place to ask him.",
    "- Built the ARP poisoning detector.\n- Raises alerts with Scapy.",
    "\u2022 Detects forged traffic in Python.",
  ];
  ok.forEach((a) => assert.equal(checkOutput(a, { context }).ok, true, a));
  const bad = [
    "He built it in Python and also worked at Google.",
    "- He built it in Python and worked at Google.",
    "He built it with Python and Wireshark.",
  ];
  bad.forEach((a) => assert.equal(checkOutput(a, { context }).reason, "name", a));
});
