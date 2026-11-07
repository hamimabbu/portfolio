// The checks that sit around the assistant.
//   checkInput  looks at the visitor's question before anything else happens
//   checkOutput looks at an AI answer before the visitor sees it
// These are speed bumps, not a wall. The real safety comes from the design: the assistant holds no
// secrets, has no tools, and can only repeat public facts about Hamim.

// Letters from other alphabets that look like English letters (written as codes so the file stays plain ASCII)
const lookalikes = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ј": "j", "ѕ": "s", "к": "k",
  "α": "a", "ε": "e", "ι": "i", "κ": "k", "ο": "o", "ρ": "p", "υ": "u",
  "ν": "v", "τ": "t",
};

// numbers and symbols that people swap in for letters ("1gn0re")
const leet = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalise(input) {
  // what we keep and show: real characters, no hidden ones
  let shown = String(input).normalize("NFKC");
  shown = shown.replace(/[­​-‏‪-‮⁠-⁤︀-️﻿]/g, "");
  shown = shown.replace(/[\u{e0000}-\u{e007f}]/gu, "");
  shown = shown.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();

  // what we match against: no accents, look-alike letters turned into English letters, lower case
  let lower = shown.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  lower = lower.replace(/[Ͱ-ϿЀ-ӿ]/g, (ch) => lookalikes[ch] || ch);

  const flat = (text) => text.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const fold = (one) => flat(lower.replace(/[013457@$!]/g, (ch) => (ch === "1" ? one : leet[ch])));
  const plain = flat(lower);
  const folded = fold("i"); // "1gn0re"
  const foldedL = fold("l"); // "ru1es"
  const squashed = folded.replace(/\s+/g, ""); // catches "i g n o r e" and "i.g.n.o.r.e"
  const squashedL = foldedL.replace(/\s+/g, "");

  return { shown, lower, plain, folded, foldedL, squashed, squashedL };
}

// ---------- things that look like an attack ----------

const patterns = [
  ["override", /\b(ignore|ignoring|disregard|forget|override|bypass|overrule)\b.{0,40}\b(instructions?|rules?|prompts?|guidelines?|guardrails?|restrictions?|polic(y|ies)|above|previous|prior|earlier|system|everything|all|instrucciones|instrucoes|anteriores|anweisungen|istruzioni|precedenti|vorherigen)\b/],
  ["override", /\b(ignora|ignorez|ignoriere|ignorar|ignorare|oublie|oubliez|vergiss|olvida|esquece)\b.{0,30}\b(instrucciones|instrucoes|instructions|anweisungen|istruzioni|regles|reglas|regeln|regras|anteriores|precedentes|vorherigen|precedenti|todo|tout|alles|tutto)\b/],
  ["prompt-leak", /\b(system|developer|hidden|secret|initial|original|internal|your)\b.{0,15}\b(prompts?|instructions?|rules|configuration|config|guidelines)\b/],
  ["prompt-leak", /\b(system|developer|hidden|initial|original|internal)\b.{0,10}\bmessages?\b/],
  ["prompt-leak", /\b(reveal|show|print|display|repeat|output|leak|dump|tell|give|share|read|recite|echo|expose|disclose)\b.{0,40}\b(prompts?|instructions?|rules|system message|configuration|secrets?|passwords?|api keys?|apikeys?|tokens?|credentials?|environment|env vars?|variables?)\b/],
  ["prompt-leak", /\b(what (were|are|was) you (told|instructed|given|programmed)|everything (above|before)|text above|words above|above text|previous (message|messages|text|conversation)|(start|beginning) of (this|the) (conversation|chat))\b/],
  ["role-play", /\b(you are now|from now on|act as|acting as|pretend (to be|you|that)|role ?play|simulate (being|a)|imagine you (are|were)|behave (as|like)|new persona|you must now|your new (role|task|instructions?))\b/],
  ["jailbreak", /\b(developer mode|dan mode|do anything now|jail ?break(ing|er)?|god mode|sudo mode|unrestricted|no restrictions|without (any )?(restrictions|filters|rules|limits)|uncensored|unfiltered|admin mode|debug mode|maintenance mode)\b/],
  ["encoding", /\b(base ?64|rot ?13|hex(adecimal)? (encoded|string)|decode (this|the following)|encoded (message|string)|binary (code|string)|morse)\b/],
  ["internals", /\b(canary|knowledge (base|files?|folder)|context window|system message|api[ _-]?key|secret key)\b/],
];

// the same ideas with the spaces squeezed out, to catch "i g n o r e  p r e v i o u s"
const squashedPhrases = [
  "ignorepreviousinstructions", "ignoreallinstructions", "ignoreyourinstructions", "ignoretheabove",
  "ignoreallprevious", "disregardpreviousinstructions", "disregardallprevious", "forgetallpreviousinstructions",
  "forgetyourinstructions", "systemprompt", "revealyourprompt", "revealyourinstructions", "developermode",
  "jailbreak", "donotfollowyourrules", "youarenow", "pretendtobe", "newinstructions",
];

// fake "system" or "assistant" labels and special tokens people paste in to confuse a model
const markers = /(<\|[^>]*\|>|\[\/?inst\]|<<\s*sys\s*>>|<\/?(system|assistant|user|instructions?|question|context)\b[^>]*>|(^|\n)\s*(system|assistant|developer|human)\s*:|#{3}\s*(system|instruction|human|assistant)|```)/;

function looksLikeAttack(n, rawLower) {
  if (markers.test(rawLower)) return "markers";
  for (const [category, regex] of patterns) {
    if (regex.test(n.plain) || regex.test(n.folded) || regex.test(n.foldedL)) return category;
  }
  for (const phrase of squashedPhrases) {
    if (n.squashed.includes(phrase) || n.squashedL.includes(phrase)) return "override";
  }
  return null;
}

function looksLikePayload(n) {
  if (/\S{31,}/.test(n.shown)) return true; // base64, hex and other long blobs
  if (/(.)\1{9,}/.test(n.shown)) return true; // aaaaaaaaaaaa
  if (n.shown.length > 20) {
    const ordinary = n.shown.replace(/[^A-Za-z0-9\s.,'?!-]/g, "").length;
    if (ordinary / n.shown.length < 0.6) return true;
  }
  return false;
}

function notEnglish(n) {
  const letters = n.lower.match(/\p{L}/gu) || [];
  if (letters.length < 3) return false;
  const latin = n.lower.match(/[a-z]/g) || [];
  return latin.length / letters.length < 0.5;
}

function checkInput(raw, max = 200) {
  if (typeof raw !== "string") return { ok: false, reason: "type" };
  if (raw.length > max * 4) return { ok: false, reason: "length" }; // cheap cut before any real work

  const n = normalise(raw);
  if (n.shown.length < 2) return { ok: false, reason: "empty" };
  if (n.shown.length > max) return { ok: false, reason: "length" };
  if (notEnglish(n)) return { ok: false, reason: "language" };
  if (looksLikePayload(n)) return { ok: false, reason: "payload" };

  const category = looksLikeAttack(n, n.lower);
  if (category) return { ok: false, reason: category };

  // angle brackets and backticks are removed so the question can never close the tag it is wrapped in
  return { ok: true, text: n.shown.replace(/[<>`]/g, "") };
}

// ---------- checking an AI answer ----------

// words that can start a sentence or sit in the middle of one without being a name
const commonWords = new Set(["I", "He", "His", "Hamim", "Hamim's", "The", "It", "This", "That", "There", "Yes", "No", "Please", "AI"]);

function checkOutput(answer, options) {
  const reject = (reason) => ({ ok: false, reason });
  const context = String(options.context || "").toLowerCase();

  if (typeof answer !== "string") return reject("type");

  // plain text only: markdown marks and tags are dropped (the page shows text, never HTML)
  let text = answer.replace(/\r/g, "").replace(/<[^>]*>/g, "").replace(/[*`#]+/g, "").trim();
  if (!text) return reject("empty");
  if (text.length > 700) return reject("long");

  const lower = text.toLowerCase();

  // 1. the hidden marker must never appear, and the rules must not be repeated back
  if (options.canary && lower.includes(String(options.canary).toLowerCase())) return reject("canary");
  for (const phrase of options.secretPhrases || []) {
    if (lower.includes(phrase)) return reject("prompt-echo");
  }

  // 2. no email addresses, and no web addresses that are not already in the facts
  if (lower.includes("@")) return reject("link");
  const addresses = lower.match(/(https?:\/\/|www\.)\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|dev|au|app|ai|co|me|info|edu|gov)(\/\S*)?/g) || [];
  for (const found of addresses) {
    const bare = found.replace(/[.,;:!?)]+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!context.includes(bare)) return reject("link");
  }

  // 3. every number (a year, a count, a percentage) must already be in the facts
  // numbers are compared whole, so "12" does not pass just because the facts say "3.12" or "2012"
  const wholeNumbers = (s) => (s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[.,]+$/, ""));
  const known = new Set(wholeNumbers(context));
  for (const number of wholeNumbers(lower)) {
    if (!known.has(number)) return reject("number");
  }

  // 4. a capitalised word in the middle of a sentence (a company, a tool) must already be in the facts
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    let sentenceStart = true;
    for (const token of line.split(/\s+/)) {
      const word = token.replace(/^[("']+|[)"'.,;:!?]+$/g, "").replace(/'s$/, "");
      if (word && !sentenceStart && /^[A-Z]/.test(word) && !commonWords.has(word)) {
        if (!context.includes(word.toLowerCase())) return reject("name");
      }
      sentenceStart = /[.!?:]$/.test(token);
    }
  }

  return { ok: true, lines: lines.slice(0, 5) };
}

module.exports = { normalise, checkInput, checkOutput };
