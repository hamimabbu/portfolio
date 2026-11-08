// Two small helpers for the home page. Both are optional.
// Without this file every project stays visible and the "check a job ad" link just scrolls to the chat.
(function () {
  "use strict";

  // ---------- project filter ----------
  const bar = document.getElementById("filters");
  const note = document.getElementById("filter-note");
  const items = Array.prototype.slice.call(document.querySelectorAll("#cases [data-kinds]"));

  const filters = [
    ["all", "All"],
    ["software", "Software"],
    ["systems", "Systems and IT"],
    ["security", "Security"],
    ["data", "Data"],
  ];

  function kindsOf(item) {
    return (item.getAttribute("data-kinds") || "").split(" ");
  }

  function countFor(key) {
    return items.filter(function (item) {
      return key === "all" || kindsOf(item).indexOf(key) !== -1;
    }).length;
  }

  const buttons = [];

  function show(key) {
    let shown = 0;
    items.forEach(function (item) {
      const match = key === "all" || kindsOf(item).indexOf(key) !== -1;
      item.hidden = !match;
      if (match) shown++;
    });

    // hide a whole tier (and its label) when none of its projects match
    Array.prototype.forEach.call(document.querySelectorAll("#cases .tier"), function (tier) {
      const any = Array.prototype.some.call(tier.querySelectorAll("[data-kinds]"), function (card) {
        return !card.hidden;
      });
      tier.hidden = !any;
    });

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-filter") === key ? "true" : "false");
    });
    if (note) note.textContent = key === "all" ? "" : "Showing " + shown + " of " + items.length + " projects.";
  }

  if (bar && items.length) {
    filters.forEach(function (entry) {
      const count = countFor(entry[0]);
      if (!count) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.setAttribute("data-filter", entry[0]);
      button.setAttribute("aria-pressed", entry[0] === "all" ? "true" : "false");
      button.append(entry[1] + " ");
      const number = document.createElement("span");
      number.textContent = String(count);
      button.appendChild(number);
      button.addEventListener("click", function () {
        show(entry[0]);
      });
      bar.appendChild(button);
      buttons.push(button);
    });

    // a link such as "Seen in Case 05" must never land on a hidden project
    document.addEventListener("click", function (event) {
      const link = event.target.closest ? event.target.closest('a[href^="#case-"], a[href="#expirytracker"]') : null;
      if (!link) return;
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (target && target.hidden) show("all");
    });
  }

  // ---------- "check a job ad" link ----------
  // A link with data-fill scrolls to the chat and types that text into the question box.
  document.addEventListener("click", function (event) {
    const link = event.target.closest ? event.target.closest("a[data-fill]") : null;
    if (!link) return;
    const input = document.getElementById("term-input");
    if (!input) return;
    input.value = link.getAttribute("data-fill").slice(0, 120);
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  });
})();
