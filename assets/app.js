/* ============================================================
   CHM-ENVIRON — shared app shell
   - Left nav defined ONCE here, injected into every page.
   - Current-page highlight by filename.
   - Client-side search over search-index.json.
   - Mobile hamburger menu + light/dark toggle (persisted).
   Pages include this file with <script src="assets/app.js" defer></script>
   (module pages use ../assets/app.js). Path prefix is auto-detected.
   ============================================================ */
(function () {
  "use strict";

  /* ---- Path prefix: "" at repo root, "../" inside /modules/ ---- */
  var INMOD = /\/modules\//.test(location.pathname);
  var P = INMOD ? "../" : "";

  /* ---- Navigation model (single source of truth) ---- */
  var NAV = {
    top: [
      { label: "Contenu et activités", href: "index.html" },
      { label: "Accueil", href: "accueil.html" },
      { label: "Nouvelles", href: "nouvelles.html" },
      { label: "Plan de cours", href: "plan-de-cours.html" }
    ],
    groups: [
      {
        label: "Biogéochimie",
        items: [
          { label: "Cosmochimie", href: "modules/cosmochimie.html" },
          { label: "Isotopie", href: "modules/isotopie.html" },
          { label: "Cycle global du carbone", href: "modules/cycle-carbone.html" },
          { label: "Limnologie", href: "modules/limnologie.html" },
          { label: "Travaux de terrain", href: "modules/travaux-terrain.html" }
        ]
      },
      {
        label: "Eau, Atmosphère et Neige",
        items: [
          { label: "Atmosphère", href: "modules/atmosphere.html" },
          { label: "Neige", href: "modules/neige.html" },
          { label: "Traitement de l'eau", href: "modules/traitement-eau.html" }
        ]
      },
      {
        label: "Contaminants",
        items: [
          { label: "Nanoparticules", href: "modules/nanoparticules.html" },
          { label: "Contaminants émergents", href: "modules/contaminants-emergents.html" },
          { label: "Écotoxicologie", href: "modules/ecotoxicologie.html" },
          { label: "Produits persistants (PFAS)", href: "modules/pfas.html" }
        ]
      }
    ],
    bottom: [
      { label: "Évaluations", href: "evaluations.html" },
      { label: "Médiagraphie", href: "mediagraphie.html" }
    ]
  };

  function base(href) {
    var s = href.split("/");
    return s[s.length - 1];
  }
  var CURRENT = base(location.pathname) || "index.html";

  function navLink(item) {
    var cur = base(item.href) === CURRENT ? ' class="current"' : "";
    return '<a href="' + P + item.href + '"' + cur + ">" + item.label + "</a>";
  }

  function buildNav() {
    var h = '<ul class="nav">';
    NAV.top.forEach(function (it) { h += "<li>" + navLink(it) + "</li>"; });

    NAV.groups.forEach(function (g, gi) {
      // open the group that contains the current page
      var hasCur = g.items.some(function (it) { return base(it.href) === CURRENT; });
      h += '<li class="group' + (hasCur ? "" : " collapsed") +
        '" data-g="' + gi + '">';
      h += '<button class="group-label" type="button">' + g.label + "</button>";
      h += '<ul class="sub">';
      g.items.forEach(function (it) { h += "<li>" + navLink(it) + "</li>"; });
      h += "</ul></li>";
    });

    h += '<li><hr></li>';
    NAV.bottom.forEach(function (it) { h += "<li>" + navLink(it) + "</li>"; });
    h += "</ul>";
    return h;
  }

  /* ---- Theme ---- */
  var THEME_KEY = "chm-theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var b = document.getElementById("themeBtn");
    if (b) b.textContent = t === "light" ? "☾ Sombre" : "☀ Clair";
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved === "light" ? "light" : "dark");
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    var next = cur === "light" ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  /* ---- Search ---- */
  var INDEX = null, idxLoading = false;
  function loadIndex(cb) {
    if (INDEX) return cb(INDEX);
    if (idxLoading) return;
    idxLoading = true;
    fetch(P + "search-index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { INDEX = Array.isArray(j) ? j : (j.pages || []); cb(INDEX); })
      .catch(function () { INDEX = []; cb(INDEX); });
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function snippet(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text.slice(0, 120)) + "…";
    var start = Math.max(0, i - 40), end = Math.min(text.length, i + q.length + 80);
    var seg = text.slice(start, end);
    var re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return (start > 0 ? "…" : "") + esc(seg).replace(re, "<mark>$1</mark>") +
      (end < text.length ? "…" : "");
  }
  function runSearch(q, box) {
    q = q.trim();
    if (q.length < 2) { box.classList.remove("open"); box.innerHTML = ""; return; }
    loadIndex(function (idx) {
      var ql = q.toLowerCase();
      var hits = idx.filter(function (p) {
        return (p.title + " " + (p.text || "")).toLowerCase().indexOf(ql) >= 0;
      }).slice(0, 12);
      if (!hits.length) {
        box.innerHTML = '<div class="r-empty">Aucun résultat pour « ' + esc(q) + " »</div>";
      } else {
        box.innerHTML = hits.map(function (p) {
          return '<a href="' + P + p.page + '"><div class="r-title">' + esc(p.title) +
            '</div><div class="r-snippet">' + snippet(p.text || "", q) + "</div></a>";
        }).join("");
      }
      box.classList.add("open");
    });
  }

  /* ---- Build the shell ---- */
  function build() {
    var app = document.querySelector(".app");
    if (!app) return;

    // Sidebar
    var side = document.createElement("nav");
    side.className = "sidebar";
    side.innerHTML =
      '<div class="brand"><span class="code">CHM-4152</span>' +
      '<span class="name">Chimie de l\'environnement</span></div>' + buildNav();

    // Backdrop for mobile
    var backdrop = document.createElement("div");
    backdrop.className = "backdrop";

    app.insertBefore(backdrop, app.firstChild);
    app.insertBefore(side, app.firstChild);

    // Topbar (prepended into .content)
    var content = app.querySelector(".content");
    if (content) {
      var bar = document.createElement("div");
      bar.className = "topbar";
      bar.innerHTML =
        '<button class="menu-btn" id="menuBtn" aria-label="Menu">☰</button>' +
        '<div class="search"><input id="searchInput" type="search" ' +
        'placeholder="Rechercher dans le cours…" autocomplete="off">' +
        '<div class="search-results" id="searchResults"></div></div>' +
        '<div class="spacer"></div>' +
        '<button class="theme-btn" id="themeBtn">☀ Clair</button>';
      content.insertBefore(bar, content.firstChild);
    }

    // Group collapse toggles
    side.querySelectorAll(".group-label").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.parentNode.classList.toggle("collapsed");
      });
    });

    // Mobile menu
    var menuBtn = document.getElementById("menuBtn");
    if (menuBtn) menuBtn.addEventListener("click", function () { app.classList.toggle("nav-open"); });
    backdrop.addEventListener("click", function () { app.classList.remove("nav-open"); });

    // Theme
    var themeBtn = document.getElementById("themeBtn");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
    applyTheme(document.documentElement.getAttribute("data-theme") || "dark");

    // Search
    var input = document.getElementById("searchInput");
    var box = document.getElementById("searchResults");
    if (input && box) {
      input.addEventListener("input", function () { runSearch(input.value, box); });
      input.addEventListener("focus", function () { if (input.value.trim().length >= 2) runSearch(input.value, box); });
      document.addEventListener("click", function (e) {
        if (!e.target.closest(".search")) box.classList.remove("open");
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { box.classList.remove("open"); input.blur(); }
      });
    }
  }

  initTheme();                 // set theme before paint (data-theme already on <html> default)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", build);
  else build();
})();
