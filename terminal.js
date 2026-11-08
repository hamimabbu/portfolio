// Small terminal for the home page.
// Short commands are answered here in the browser from the facts in the #term-data block.
// A longer question is sent to the small assistant at /api/chat, which only knows the same facts.
// If the assistant cannot be reached, everything still works from the facts in this page.
(function () {
  const panel = document.getElementById("terminal");
  const log = document.getElementById("term-log");
  const dataTag = document.getElementById("term-data");
  if (!panel || !log || !dataTag) return;

  let data;
  try {
    data = JSON.parse(dataTag.textContent);
  } catch (error) {
    return; // broken data, so the plain list of facts stays on the page
  }

  // The skills check (fit.js) is loaded before this file. If it is missing, only the fit command is lost.
  const fit = window.siteFit && typeof window.siteFit.check === "function" ? window.siteFit : null;

  const MAX_LINES = 250;
  const history = [];
  let historyPos = 0;

  // The assistant needs a real web address. A page opened from a folder cannot reach it.
  const bot = data.bot && typeof data.bot.endpoint === "string" ? data.bot : null;
  let botReachable = !!bot && /^https?:$/.test(window.location.protocol);
  let busy = false; // true while a question is on its way to the assistant
  let lastTrace = null; // how the last assistant answer was made

  // visitors can put their own name in the prompt with the login command
  let userName = "visitor";

  function promptText() {
    return userName + "@hamim:~$";
  }

  // keeps only letters, numbers, dot, dash and underscore,
  // so a name can never carry markup or a whole sentence
  function cleanName(text) {
    return text.trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9._-]/g, "").slice(0, 16);
  }

  // ---------- adding lines to the log ----------
  // Everything goes in with textContent, so typed text can never become HTML.

  function addLine(text, className) {
    const p = document.createElement("p");
    p.className = "out" + (className ? " " + className : "");
    p.textContent = text;
    log.appendChild(p);
    return p;
  }

  function addRow(key, text, className) {
    const p = document.createElement("p");
    p.className = "out row" + (className ? " " + className : "");
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = key;
    const v = document.createElement("span");
    v.textContent = text;
    p.append(k, v);
    log.appendChild(p);
    return v;
  }

  // only the sites this page already links to are allowed as link targets
  function safeHref(url) {
    const outside = /^https:\/\/(github\.com|www\.linkedin\.com|coursera\.org)\//;
    const sameSite = /^[a-z0-9-]+\.html$/;
    return outside.test(url) || sameSite.test(url) ? url : null;
  }

  function addLink(parent, label, url) {
    const href = safeHref(url);
    if (!href) {
      parent.append(label);
      return;
    }
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (href.startsWith("https://")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    parent.append(a);
  }

  function addLinkRow(key, links) {
    const v = addRow(key, "");
    links.forEach(function (link, i) {
      if (i > 0) v.append(" | ");
      addLink(v, link[0], link[1]);
    });
  }

  function addEcho(text) {
    const p = document.createElement("p");
    p.className = "prompt echo";
    const b = document.createElement("b");
    b.textContent = promptText();
    p.append(b, " " + text);
    log.appendChild(p);
  }

  function trimLog() {
    while (log.children.length > MAX_LINES) log.removeChild(log.firstChild);
  }

  // a question (or a command) the visitor can tap instead of typing
  function addAsk(text, isCommand) {
    const p = document.createElement("p");
    p.className = "out ask";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ask-btn";
    button.textContent = text;
    button.addEventListener("click", function () {
      run(text, !isCommand);
    });
    p.appendChild(button);
    log.appendChild(p);
  }

  function addAskList(title, questions) {
    addLine(title, "dim");
    questions.forEach(function (question) {
      addAsk(question);
    });
  }

  // ---------- finding things ----------

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // lower case, letters and numbers only, with a space at both ends
  // so that " arp " matches the word arp but not the word sharp
  function clean(text) {
    return " " + text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim() + " ";
  }

  function mentionsAny(padded, words) {
    return words.some(function (word) {
      return padded.indexOf(" " + word + " ") !== -1;
    });
  }

  function projectByName(padded) {
    return data.projects.find(function (p) {
      return mentionsAny(padded, p.keys);
    });
  }

  // how many single-letter edits turn word a into word b (for typos)
  function distance(a, b) {
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = row;
    }
    return prev[b.length];
  }

  const suggestable = ["help", "whoami", "whoareyou", "about", "projects", "skills", "work", "education", "contact", "links", "login", "privacy", "ask", "trace"];

  function closestCommand(word) {
    let best = null;
    let bestScore = 3;
    suggestable.forEach(function (name) {
      const score = distance(word, name);
      if (score < bestScore) {
        best = name;
        bestScore = score;
      }
    });
    return best;
  }

  // ---------- commands ----------

  const commands = {};

  commands.help = function () {
    addLine("Commands", "head");
    data.help.forEach(function (item) {
      if (item[0] === "fit" && !fit) return;
      addRow(item[0], item[1]);
    });
    addLine(data.tip, "dim");
  };

  commands.whoami = function () {
    data.whoami.forEach(function (item) {
      addRow(item[0], item[1]);
    });
  };

  commands.about = function () {
    data.about.forEach(function (text) {
      addLine(text);
    });
  };

  commands.projects = function () {
    data.projects.forEach(function (p) {
      addRow(String(p.n), p.name + " (" + p.short + ")", "num");
    });
    addLine("Type project 1, or a word like arp, for the details.", "dim");
  };

  function showProject(p) {
    addLine(p.n + ". " + p.name, "head");
    addRow("when", p.when);
    addRow("status", p.status);
    // a project of my own has no team, so it can name this row differently
    addRow(p.partLabel || "my part", p.part);
    addRow("result", p.result);
    addRow("stack", p.stack);
    if (p.links.length) addLinkRow("more", p.links);
  }

  commands.project = function (arg) {
    if (!arg) {
      addLine("Which one? Try project 1, or project arp.", "err");
      return;
    }
    let found;
    if (/^\d+$/.test(arg)) {
      found = data.projects[Number(arg) - 1];
    } else {
      found = projectByName(clean(arg));
    }
    if (!found) {
      addLine("No project matches that. Type projects for the list.", "err");
      return;
    }
    showProject(found);
  };

  commands.skills = function () {
    data.skills.forEach(function (lane) {
      addLine(lane.name, "head");
      lane.items.forEach(function (item) {
        addLine("- " + item);
      });
    });
  };

  // ---------- the skills check ----------

  const fitStyles = { yes: "fit-yes", part: "fit-part", learn: "fit-learn", no: "fit-no" };

  function projectNote(numbers) {
    if (!numbers.length) return "";
    return " (project" + (numbers.length > 1 ? "s " : " ") + numbers.join(", ") + ")";
  }

  function addFitRow(item) {
    const p = document.createElement("p");
    p.className = "out row";
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = item.key;
    const v = document.createElement("span");
    const tag = document.createElement("span");
    tag.className = "fit-tag " + fitStyles[item.status];
    tag.textContent = item.label + ".";
    v.append(tag, " " + item.detail + projectNote(item.projects));
    p.append(k, v);
    log.appendChild(p);
  }

  commands.fit = function (arg, raw) {
    if (!fit) {
      addLine("The skills check did not load, so fit is not available right now.", "err");
      return;
    }
    const text = raw.replace(/^fit\s*/i, "").trim();
    if (!text) {
      addLine("Check a list of skills or a role against what this site shows. Separate the items with commas.", "dim");
      addLine("For example (tap it to run it):", "dim");
      addAsk("fit soc analyst, python, splunk, incident response", true);
      return;
    }

    const result = fit.check(text);
    if (!result.items.length) {
      addLine("I could not pick a skill or a role out of that. Try: fit python, splunk, soc analyst", "dim");
      return;
    }

    addLine("Skills check against this site", "head");
    result.items.forEach(addFitRow);
    const c = result.counts;
    addLine(c.yes + " shown, " + c.part + " partly, " + c.learn + " learning, " + c.no + " not shown.", "head");
    if (result.sentence) addLine("Part of that read like a sentence, so I only picked out the skills I know. Separate items with commas for a full check.", "dim");
    if (result.clipped) addLine("Only the first " + fit.MAX_ITEMS + " items were checked.", "dim");
    if (result.items.some(function (item) { return item.projects.length > 0; })) {
      addLine("Numbers in brackets are project numbers. Type project 2, for example, to open one.", "dim");
    }
    if (c.no > 0) {
      addLine("Not shown means this site does not mention it. It does not mean he has never used it. Type contact to ask about the rest.", "dim");
    }
  };

  commands.work = function () {
    data.work.forEach(function (job) {
      addLine(job.title, "head");
      addLine(job.text);
    });
  };

  commands.education = function () {
    data.education.forEach(function (item) {
      addLine(item.title, "head");
      addLine(item.text);
      if (item.link) addLink(addLine(""), item.link[0], item.link[1]);
    });
  };

  commands.contact = function () {
    addLine(data.contactNote);
    data.links.slice(0, 2).forEach(function (item) {
      addLinkRow(item[0], [[item[1], item[2]]]);
    });
  };

  commands.links = function () {
    data.links.forEach(function (item) {
      addLinkRow(item[0], [[item[1], item[2]]]);
    });
  };

  commands.location = function () {
    addLine(data.location);
  };

  commands.hello = function () {
    addLine(data.hello);
  };

  commands.rights = function () {
    addLine(data.rightsNote);
  };

  commands.clear = function () {
    log.replaceChildren();
  };

  commands.pwd = function () {
    addLine("/home/" + userName);
  };

  commands.cd = function () {
    addLine("cd: there are no other folders here. Try projects.");
  };

  commands.echo = function (arg, raw) {
    addLine(raw.replace(/^echo\s*/i, ""));
  };

  commands.privacy = function () {
    addLine(data.privacy);
    addLine("Type whoareyou to see what any site can read from your browser.", "dim");
  };

  commands.ask = function (arg, raw) {
    const question = raw.replace(/^ask\s*/i, "").trim();
    if (!question) {
      addLine("Try: ask what has Hamim built in software?", "dim");
      return;
    }
    if (!botReachable) {
      addLine("The assistant only runs on the live site. Here is what this page can say about that.", "dim");
      guess(question.toLowerCase());
      return;
    }
    askBot(question);
  };

  commands.trace = function () {
    if (!lastTrace) {
      addLine("Ask the assistant a question first, then type trace to see how the answer was made.", "dim");
      return;
    }
    addLine("How the last answer was made", "head");
    [
      ["input check", lastTrace.input],
      ["topic match", lastTrace.match],
      ["answer by", lastTrace.maker],
      ["output check", lastTrace.check],
    ].forEach(function (pair) {
      if (pair[1]) addRow(pair[0], pair[1]);
    });
    addLine("This is only the route the question took. Type privacy for what is sent and kept.", "dim");
  };

  // The page cannot know who you are. This only shows what the browser itself reports,
  // and it is worked out here in the browser and sent nowhere.
  function guessBrowser(ua) {
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
    if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "unknown";
  }

  function guessSystem(ua) {
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
    if (/CrOS/.test(ua)) return "ChromeOS";
    if (/Linux/.test(ua)) return "Linux";
    return "unknown";
  }

  // only the site name is shown, never the full address the visitor came from
  function referrerHost() {
    try {
      return new URL(document.referrer).hostname || "none";
    } catch (error) {
      return "none";
    }
  }

  commands.whoareyou = function () {
    const ua = navigator.userAgent;
    addLine("What this website can see about you", "head");
    addLine("Your browser tells every site it visits these things. Here they were read in your browser and sent nowhere.", "dim");
    addRow("browser", guessBrowser(ua));
    addRow("system", guessSystem(ua));
    addRow("language", navigator.language || "unknown");
    addRow("time zone", Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown");
    addRow("screen", screen.width + " x " + screen.height);
    if (navigator.hardwareConcurrency) addRow("cpu threads", String(navigator.hardwareConcurrency));
    addRow("dark mode", window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "yes" : "no");
    addRow("touch", navigator.maxTouchPoints > 0 ? "yes" : "no");
    addRow("came from", referrerHost());
    addLine("Browser and system are a guess from the user agent text.", "dim");
    addLine("Your IP address is visible to every site as well. It can point to your internet provider, or to your company on an office network. This page does not look it up.");
    addLine("Browsers do not share your name, your email or the name of your computer.");
  };

  function setName(name) {
    userName = name;
    ps1.textContent = promptText();
    const title = panel.querySelector(".panel-bar span");
    if (title) title.textContent = name + "@hamim: ~";
  }

  commands.login = function (arg) {
    const name = cleanName(arg);
    if (!name) {
      addLine("Try login yourname, using letters and numbers. It only changes the prompt.", "err");
      return;
    }
    setName(name);
    addLine("Hello " + name + ". The prompt now shows your name. It stays in this tab and is not sent anywhere.");
  };

  const leaveText = "There is nowhere to go. Close the tab if you want to leave.";

  commands.logout = function () {
    if (userName === "visitor") {
      addLine(leaveText);
      return;
    }
    setName("visitor");
    addLine("Logged out. You are a visitor again.");
  };

  // other names for the same commands
  commands.ls = commands.projects;
  commands.man = commands.help;
  commands["?"] = commands.help;

  // commands people try out of habit
  const jokes = {};
  function addJoke(names, text) {
    names.forEach(function (name) {
      jokes[name] = text;
    });
  }
  addJoke(["sudo", "su"], "Permission denied. Nice try, but this is just a web page.");
  addJoke(["rm", "rmdir", "mv"], "Nothing to change here. This page is read only.");
  addJoke(["cat", "less", "more", "head", "tail", "vi", "vim", "nano"], "There are no files to open. Type help for the commands.");
  addJoke(["nmap", "nikto", "sqlmap", "hydra", "msfconsole", "metasploit"], "Please do not scan this site. I run my own tests on a private copy in my lab.");
  addJoke(["exit", "quit"], leaveText);

  // ---------- understanding a typed question ----------

  // each topic lists the words that point to it, and the first topic with a match wins
  const topics = [
    ["whoareyou", ["who am i", "about me", "know me", "see me", "know who i am", "my browser", "my ip", "my device", "what can you see", "what do you see", "see about me", "footprint", "reveal"]],
    ["privacy", ["privacy", "cookie", "cookies", "tracker", "trackers", "tracking", "track me", "analytics", "spy", "spying", "fingerprint", "fingerprinting", "my questions", "my question", "my data", "stored", "logged", "logging"]],
    ["rights", ["visa", "rights", "right to work", "citizen", "citizenship", "permanent resident", "sponsorship", "clearance"]],
    ["contact", ["contact", "email", "mail", "phone", "reach", "message", "hire", "hiring", "cv", "resume", "in touch", "talk to", "speak to"]],
    ["links", ["link", "links", "github", "linkedin", "repo", "repos", "repository", "source", "code"]],
    ["projects", ["project", "projects", "built", "build", "made", "portfolio", "demo", "demos"]],
    ["skills", ["skill", "skills", "know", "language", "languages", "tool", "tools", "tech", "technology", "stack", "strengths", "python", "java", "javascript", "node", "react", "linux", "kali", "wireshark", "scapy", "sql", "mongodb", "git", "windows", "c++"]],
    ["whoami", ["available to start", "start after", "when does he graduate", "when do you graduate", "when will you graduate", "when does he finish", "kind of job", "type of job", "kind of role", "type of role", "what roles", "which roles", "what role"]],
    ["education", ["still learning", "currently learning", "what are you learning", "what is he learning", "education", "degree", "university", "uni", "uow", "study", "studies", "studying", "student", "graduating", "graduation", "certificate", "certificates", "certification", "cert", "pnpt", "google", "course", "courses", "subjects", "qualification", "qualifications", "school"]],
    ["location", ["relocate", "relocating", "relocation", "live", "based", "located", "sydney", "work in wollongong", "work from home", "work remotely", "remote", "remotely", "hybrid", "commute"]],
    ["whoami", ["whoami", "who", "available", "availability", "looking", "seeking", "open", "target", "interested", "start", "soc", "pentest", "analyst"]],
    ["work", ["work", "working", "worked", "job", "jobs", "experience", "employer", "employment", "coles", "petroleum", "harvest", "career", "history"]],
    ["location", ["where", "location", "city", "wollongong"]],
    ["about", ["about", "yourself", "name", "intro", "introduce", "introduction", "background", "bio", "summary", "tell", "describe", "what do you do", "what are you"]],
    ["help", ["help", "commands", "command", "options", "menu", "what can you do", "how to use"]],
    ["hello", ["hello", "hi", "hey", "greetings"]]
  ];

  const aiWords = ["chatbot", "chat bot", "chatgpt", "gpt", "llm", "are you ai", "are you an ai", "are you a bot", "are you real", "who made this", "how does this work", "how do you work", "this assistant", "your assistant", "is this ai", "using ai", "use ai"];

  // "does he know splunk?" gets the same honest answer here as from the assistant
  function showSkillAnswer(found) {
    found.lines.forEach(function (line) {
      addLine(line);
    });
    const pages = fit.casePages(found.projects);
    if (pages.length) addLinkRow("more", pages);
    addLine("from: Skills check | straight from the site facts, no AI", "dim");
  }

  function guess(lower) {
    const padded = clean(lower);

    if (mentionsAny(padded, aiWords)) {
      addLine(data.aiNote);
      return;
    }

    if (mentionsAny(padded, ["thanks", "thank you", "cheers"])) {
      addLine("You are welcome.");
      return;
    }

    if (mentionsAny(padded, ["bye", "goodbye", "see you"])) {
      addLine("Bye. Thanks for stopping by.");
      return;
    }

    const skill = fit && fit.answerQuestion(lower);
    if (skill) {
      showSkillAnswer(skill);
      return;
    }

    const project = projectByName(padded);
    if (project) {
      addLine("Closest match: project " + project.n, "dim");
      showProject(project);
      return;
    }

    for (const topic of topics) {
      if (mentionsAny(padded, topic[1])) {
        addLine("Closest match: " + topic[0], "dim");
        commands[topic[0]]("", "");
        return;
      }
    }

    // maybe just the name of a tool, like "splunk"
    const named = fit && fit.answerQuestion(lower, { fallback: true });
    if (named) {
      showSkillAnswer(named);
      return;
    }

    // maybe one word with a typo, like "projcts"
    const words = padded.trim().split(" ");
    if (words.length <= 2 && words[0].length >= 4) {
      const close = closestCommand(words[0]);
      if (close) {
        addLine('Did you mean "' + close + '"?', "dim");
        commands[close](words.slice(1).join(" "), "");
        return;
      }
    }

    addLine(data.fallback, "err");
  }

  // ---------- the assistant ----------

  // Only text and short lists are accepted back, and each part is cut to a sensible length.
  function cleanAnswer(body) {
    if (!body || body.ok !== true || !Array.isArray(body.lines)) return null;
    const strings = function (value, count, length) {
      return Array.isArray(value)
        ? value.filter(function (s) { return typeof s === "string"; }).slice(0, count).map(function (s) { return s.slice(0, length); })
        : [];
    };
    const lines = strings(body.lines, 8, 700);
    if (!lines.length) return null;

    const links = Array.isArray(body.links)
      ? body.links
          .filter(function (pair) { return Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string"; })
          .slice(0, 5)
          .map(function (pair) { return [pair[0].slice(0, 60), pair[1].slice(0, 200)]; })
      : [];

    const trace = {};
    ["input", "match", "maker", "check"].forEach(function (key) {
      if (body.trace && typeof body.trace[key] === "string") trace[key] = body.trace[key].slice(0, 200);
    });

    return {
      mode: ["local", "ai", "blocked", "none"].indexOf(body.mode) !== -1 ? body.mode : "local",
      lines: lines,
      sources: strings(body.sources, 3, 80),
      follow: strings(body.follow, 3, 100),
      links: links,
      trace: trace,
    };
  }

  // resolves to { answer }, { limited: "message" } or { offline: true }
  async function fetchAnswer(question) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      const res = await fetch(bot.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question }), // the question is the only thing sent
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (res.status === 429) {
        let message = "That is a lot of questions in a short time. Give it a minute and try again.";
        try {
          const body = await res.json();
          if (body && typeof body.message === "string") message = body.message.slice(0, 200);
        } catch (error) {
          // keep the default message
        }
        return { limited: message };
      }
      if (!res.ok) return { offline: true };
      const answer = cleanAnswer(await res.json());
      return answer ? { answer: answer } : { offline: true };
    } catch (error) {
      return { offline: true };
    } finally {
      clearTimeout(timer);
    }
  }

  // Scrolls so that the start of the answer is in view. When the whole answer, with its follow-up
  // questions, fits in the log, it scrolls to the bottom instead so those questions show too.
  function scrollToStart(node) {
    if (!node) {
      log.scrollTop = log.scrollHeight;
      return;
    }
    const logTop = log.getBoundingClientRect().top;
    const start = node.getBoundingClientRect().top - logTop + log.scrollTop;
    const end = log.lastElementChild.getBoundingClientRect().bottom - logTop + log.scrollTop;
    log.scrollTop = end - start <= log.clientHeight - 4 ? log.scrollHeight : start - 4;
  }

  function showAnswer(a) {
    a.lines.forEach(function (line) {
      addLine(line);
    });
    if (a.links.length) addLinkRow("more", a.links);
    if (a.mode === "local" || a.mode === "ai") {
      const how = a.mode === "ai" ? "worded by an AI model and checked against the site facts" : "straight from the site facts, no AI";
      addLine("from: " + (a.sources.join(", ") || "the site") + " | " + how, "dim");
    }
    lastTrace = a.trace;
    if (a.follow.length) addAskList("You could also ask:", a.follow);
  }

  async function askBot(question) {
    if (busy) {
      addLine("Still working on your last question. One moment.", "dim");
      return;
    }
    busy = true;
    const waiting = addLine("one moment...", "dim");
    let result;
    try {
      result = await fetchAnswer(question);
    } finally {
      busy = false;
      waiting.remove();
    }

    const start = log.lastElementChild; // the answer begins right after this line
    if (result.answer) {
      showAnswer(result.answer);
    } else if (result.limited) {
      addLine(result.limited, "err");
    } else {
      botReachable = false;
      addLine("I can't reach the assistant right now, so I'll answer from the facts on this page.", "dim");
      guess(question.toLowerCase());
    }
    trimLog();
    scrollToStart(start && start.nextElementSibling);
  }

  // fromButton is true for the example and follow-up questions, which are always questions for the assistant
  function run(text, fromButton) {
    const input = text.trim().slice(0, 120);
    if (!input) return;

    addEcho(input);
    const echoLine = log.lastElementChild; // the output of the command starts right after this line
    if (history[history.length - 1] !== input) history.push(input);
    if (history.length > 100) history.shift();
    historyPos = history.length;

    const lower = input.toLowerCase();
    const parts = lower.split(/\s+/);
    const name = parts[0];
    const arg = parts.slice(1).join(" ");

    if (fromButton && botReachable) {
      askBot(input);
      trimLog();
      log.scrollTop = log.scrollHeight;
      return;
    }

    // has() stops names like "constructor" from finding things on the object itself
    if (has(commands, name)) {
      commands[name](arg, input);
    } else if (has(jokes, name)) {
      addLine(jokes[name]);
    } else if (botReachable && parts.length >= 3) {
      // a full question goes to the assistant, which finishes the screen update itself
      askBot(input);
      trimLog();
      log.scrollTop = log.scrollHeight;
      return;
    } else {
      guess(lower);
    }

    trimLog();
    scrollToStart(echoLine && echoLine.nextElementSibling);
  }

  // ---------- the input row and buttons ----------

  const foot = document.createElement("div");
  foot.className = "term-foot";

  const chips = document.createElement("div");
  chips.className = "chips";
  const chipNames = fit ? ["help", "projects", "skills", "fit", "contact"] : ["help", "projects", "skills", "contact"];
  chipNames.forEach(function (name) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = name;
    button.addEventListener("click", function () {
      run(name);
    });
    chips.appendChild(button);
  });

  const form = document.createElement("form");
  form.className = "term-form";
  form.setAttribute("autocomplete", "off");

  const label = document.createElement("label");
  label.className = "sr-only";
  label.htmlFor = "term-input";
  label.textContent = "Type a command or a question";

  const ps1 = document.createElement("span");
  ps1.className = "term-ps1";
  ps1.setAttribute("aria-hidden", "true");
  ps1.textContent = promptText();

  const input = document.createElement("input");
  input.id = "term-input";
  input.type = "text";
  input.maxLength = 120;
  input.placeholder = "ask a question, or type help";
  input.spellcheck = false;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("enterkeyhint", "send");

  form.append(label, ps1, input);
  foot.append(chips, form);
  panel.querySelector(".panel-body").appendChild(foot);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });

  // Tab fills in a command only when there is exactly one match, so it never traps keyboard users
  function complete() {
    const text = input.value.toLowerCase();
    if (!text || text.indexOf(" ") !== -1) return false;
    const matches = Object.keys(commands).filter(function (name) {
      return name.indexOf(text) === 0;
    });
    if (matches.length !== 1) return false;
    input.value = matches[0];
    return true;
  }

  input.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (historyPos > 0) historyPos--;
      input.value = history[historyPos] || "";
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyPos < history.length) historyPos++;
      input.value = history[historyPos] || "";
    } else if (event.key === "Tab") {
      if (complete()) event.preventDefault();
    } else if (event.key === "Escape") {
      input.value = "";
    } else if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      log.replaceChildren();
    }
  });

  // a soft fade at the bottom edge (see styles.css) tells people there is more below
  function updateMore() {
    log.classList.toggle("more-below", log.scrollHeight - log.clientHeight - log.scrollTop > 8);
  }
  log.addEventListener("scroll", updateMore, { passive: true });
  window.addEventListener("resize", updateMore);
  new MutationObserver(updateMore).observe(log, { childList: true });

  // switch the card from a plain list of facts to the live terminal
  const cursor = log.querySelector(".cursor");
  if (cursor) cursor.remove();
  log.tabIndex = 0; // so keyboard users can scroll the log
  panel.setAttribute("aria-label", "Interactive terminal");
  panel.classList.add("live");

  // A personal link such as ?ref=acme puts that name in the prompt.
  // The name is read here in the browser. The terminal does not send or save it.
  const linkName = cleanName(new URLSearchParams(window.location.search).get("ref") || "");
  if (linkName) {
    setName(linkName);
    const firstPrompt = log.querySelector(".prompt b");
    if (firstPrompt) firstPrompt.textContent = promptText();
    addLine("Hello " + linkName + ". Your link has this name in it, so the prompt shows it. The terminal keeps it in this tab and sends nothing. Type logout to go back to visitor.");
  }

  addLine(data.hint, "dim");

  // example questions, so nobody has to think of one
  if (bot && Array.isArray(bot.starters) && bot.starters.length) {
    addAskList("Try asking:", bot.starters.slice(0, 6));
    log.scrollTop = log.scrollHeight;
  }
})();
