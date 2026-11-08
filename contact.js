// The message form on the home page.
// It checks the fields in the browser, then sends them to /api/contact on the same site.
// That address mails the message to the owner. This page never holds an email address for the owner.
(function () {
  const form = document.getElementById("contact-form");
  const fallback = document.getElementById("contact-fallback");
  const intro = document.getElementById("contact-intro");
  const wrap = document.querySelector(".contact-wrap");
  if (!form) return;

  // A page opened from a folder cannot reach the server, so the form only appears on the real site.
  if (!/^https?:$/.test(window.location.protocol)) {
    if (fallback) fallback.textContent = "The message form works on the live site. Please use LinkedIn from here.";
    if (wrap) wrap.classList.add("no-form");
    return;
  }

  const fields = {
    name: document.getElementById("cf-name"),
    email: document.getElementById("cf-email"),
    message: document.getElementById("cf-message"),
  };
  const errors = {
    name: document.getElementById("cf-name-err"),
    email: document.getElementById("cf-email-err"),
    message: document.getElementById("cf-message-err"),
  };
  const counter = document.getElementById("cf-message-count");
  const trap = document.getElementById("cf-site");
  const button = document.getElementById("cf-send");
  const status = document.getElementById("cf-status");
  const MAX_MESSAGE = 2000;
  const MIN_MESSAGE = 10;

  // The form only appears when the server says mail is set up, so nobody writes a message that cannot be sent.
  async function mailIsReady() {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 5000);
    try {
      const response = await fetch("/api/contact", { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      return response.ok && body && body.ready === true ? "ready" : "off";
    } catch (error) {
      return "unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  // hide the no-scripts note while the check runs, so it does not flash up and disappear
  if (fallback) fallback.hidden = true;
  mailIsReady().then(function (state) {
    if (state === "ready") {
      form.hidden = false;
      if (intro) intro.textContent = "Hiring, a question or feedback: write here and I will reply by email. My address stays private, and yours is only used to answer you.";
    } else if (wrap) {
      // no form: the contact links get the whole row instead of leaving an empty column
      wrap.classList.add("no-form");
    }
  });

  function setError(name, text) {
    const field = fields[name];
    const box = errors[name];
    if (text) {
      field.setAttribute("aria-invalid", "true");
      box.textContent = text;
      box.hidden = false;
    } else {
      field.removeAttribute("aria-invalid");
      box.textContent = "";
      box.hidden = true;
    }
  }

  // the first problem found for each field, or an empty string
  function problem(name) {
    const value = fields[name].value.trim();
    if (name === "name") return value ? "" : "Please add your name.";
    if (name === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? "" : "Please add an email address I can reply to, like name@example.com.";
    }
    return value.length >= MIN_MESSAGE ? "" : "Please write a little more, at least " + MIN_MESSAGE + " characters.";
  }

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle("err", !!isError);
  }

  // errors show when someone leaves a field, and clear as soon as it is fixed
  Object.keys(fields).forEach(function (name) {
    fields[name].addEventListener("blur", function () {
      if (fields[name].value.trim() !== "") setError(name, problem(name));
    });
    fields[name].addEventListener("input", function () {
      if (fields[name].hasAttribute("aria-invalid") && !problem(name)) setError(name, "");
    });
  });

  fields.message.addEventListener("input", function () {
    const length = fields.message.value.length;
    counter.textContent = length + " of " + MAX_MESSAGE + " characters.";
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (button.disabled) return;

    let firstBad = null;
    Object.keys(fields).forEach(function (name) {
      const text = problem(name);
      setError(name, text);
      if (text && !firstBad) firstBad = fields[name];
    });
    if (firstBad) {
      setStatus("Please fix the highlighted fields.", true);
      firstBad.focus();
      return;
    }

    button.disabled = true;
    setStatus("Sending...", false);

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.value,
          email: fields.email.value,
          message: fields.message.value,
          site: trap ? trap.value : "",
        }),
        signal: controller.signal,
      });
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }

      if (response.ok && body && body.ok) {
        setStatus(typeof body.message === "string" ? body.message : "Thanks. Your message is on its way.", false);
        form.reset();
        counter.textContent = "Up to " + MAX_MESSAGE + " characters.";
      } else if (body && body.field && fields[body.field]) {
        setError(body.field, String(body.message || "Please check this field.").slice(0, 160));
        setStatus("Please fix the highlighted field.", true);
        fields[body.field].focus();
      } else {
        // the words come from the server, so they are cut to a sensible length and shown as plain text
        setStatus(body && typeof body.message === "string" ? body.message.slice(0, 200) : "I could not send that just now. Please use LinkedIn.", true);
      }
    } catch (error) {
      setStatus("I could not reach the server. Please try again, or use LinkedIn.", true);
    } finally {
      clearTimeout(timer);
      button.disabled = false;
    }
  });
})();
