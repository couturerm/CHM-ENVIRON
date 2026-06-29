/* CHM-ENVIRON — shared chrome: topbar, sidebar, search, theme toggle, mobile menu, capsules.
   Markup matches the approved mockup verbatim. Each page sets:
     <body data-page="<id>" data-depth="0|1">  and contains a <main class="content">…</main> */

(function () {
  var depth = parseInt(document.body.getAttribute('data-depth') || '0', 10);
  var P = depth ? '../' : '';
  var current = document.body.getAttribute('data-page') || 'index';

  var NAV = [
    {t:'link', page:'index',                  href:'index.html',                     label:'Contenu et activités'},
    {t:'link', page:'accueil',                href:'accueil.html',                   label:'Accueil'},
    {t:'link', page:'nouvelles',              href:'nouvelles.html',                 label:'Nouvelles'},
    {t:'link', page:'plan',                   href:'plan-de-cours.html',             label:'Plan de cours'},
    {t:'group', label:'Biogéochimie'},
    {t:'item', page:'cosmochimie',            href:'modules/cosmochimie.html',       label:'Cosmochimie'},
    {t:'item', page:'isotopie',               href:'modules/isotopie.html',          label:'Isotopie'},
    {t:'item', page:'cycle-carbone',          href:'modules/cycle-carbone.html',     label:'Cycle global du carbone'},
    {t:'item', page:'limnologie',             href:'modules/limnologie.html',        label:'Limnologie'},
    {t:'item', page:'travaux-terrain',        href:'modules/travaux-terrain.html',   label:'Travaux de terrain'},
    {t:'group', label:'Eau, Atmosphère et Neige'},
    {t:'item', page:'atmosphere',             href:'modules/atmosphere.html',        label:'Atmosphère'},
    {t:'item', page:'neige',                  href:'modules/neige.html',             label:'Neige'},
    {t:'item', page:'traitement-eau',         href:'modules/traitement-eau.html',    label:"Traitement de l'eau"},
    {t:'group', label:'Contaminants'},
    {t:'item', page:'nanoparticules',         href:'modules/nanoparticules.html',    label:'Nanoparticules'},
    {t:'item', page:'contaminants-emergents', href:'modules/contaminants-emergents.html', label:'Contaminants émergents'},
    {t:'item', page:'ecotoxicologie',         href:'modules/ecotoxicologie.html',    label:'Écotoxicologie'},
    {t:'item', page:'pfas',                   href:'modules/pfas.html',              label:'Produits persistants (PFAS)'},
    {t:'group', label:'Cours'},
    {t:'item', page:'evaluations',            href:'evaluations.html',               label:'Évaluations'},
    {t:'item', page:'mediagraphie',           href:'mediagraphie.html',              label:'Médiagraphie'}
  ];

  // ---- topbar ----
  var topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML =
    '<button class="menubtn" id="menubtn">☰</button>' +
    '<span class="tt">CHM-4152</span><span class="muted">Chimie de l\'environnement · Automne 2026</span>' +
    '<span class="sp"></span>' +
    '<div class="search"><input id="q" type="search" placeholder="Rechercher dans le cours…" autocomplete="off"><div class="results" id="results"></div></div>' +
    '<button class="toggle" id="modeToggle">☀ Clair</button>';
  document.body.insertBefore(topbar, document.body.firstChild);

  // ---- sidebar ----
  var nav = '<div class="brand"><div class="code">CHM-4152 · NRC 83001</div><div class="ttl">Chimie de l\'environnement</div></div>';
  NAV.forEach(function (n) {
    if (n.t === 'group') { nav += '<div class="navgroup">' + n.label + '</div>'; return; }
    var cls = (n.t === 'link' ? 'navlink' : 'navitem') + (n.page === current ? ' active' : '');
    nav += '<a class="' + cls + '" href="' + P + n.href + '">' + n.label + '</a>';
  });
  var side = document.createElement('aside');
  side.className = 'side'; side.id = 'side'; side.innerHTML = nav;

  var content = document.querySelector('.content');
  var app = document.createElement('div'); app.className = 'app';
  content.parentNode.insertBefore(app, content);
  app.appendChild(side); app.appendChild(content);

  // ---- mobile menu ----
  document.getElementById('menubtn').onclick = function () { side.classList.toggle('open'); };

  // ---- light / dark (persisted) ----
  var html = document.documentElement, mt = document.getElementById('modeToggle');
  try { var saved = localStorage.getItem('chm_mode'); if (saved) html.setAttribute('data-mode', saved); } catch (e) {}
  function syncToggle() { mt.textContent = html.getAttribute('data-mode') === 'dark' ? '☀ Clair' : '☾ Sombre'; }
  syncToggle();
  mt.onclick = function () {
    var d = html.getAttribute('data-mode') === 'dark';
    html.setAttribute('data-mode', d ? 'light' : 'dark');
    try { localStorage.setItem('chm_mode', d ? 'light' : 'dark'); } catch (e) {}
    syncToggle();
  };

  // ---- capsule inset player ----
  document.querySelectorAll('.cap[data-vp]').forEach(function (c) {
    c.addEventListener('click', function (e) {
      e.preventDefault();
      var tt = document.getElementById('vt-' + c.dataset.vp);
      if (tt) tt.textContent = c.dataset.title;
      c.parentElement.querySelectorAll('.cap[data-vp]').forEach(function (x) { x.classList.remove('activecap'); });
      c.classList.add('activecap');
    });
  });

  // ---- tabs (if a page uses them) ----
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      t.parentElement.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
    });
  });

  // ---- search over search-index.json ----
  var qel = document.getElementById('q'), rel = document.getElementById('results');
  var INDEX = [];
  fetch(P + 'search-index.json').then(function (r) { return r.json(); })
    .then(function (d) { INDEX = d; }).catch(function () {});
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  qel.addEventListener('input', function () {
    var raw = qel.value.trim();
    if (raw.length < 2) { rel.classList.remove('show'); rel.innerHTML = ''; return; }
    var q = norm(raw), hits = [];
    INDEX.forEach(function (p) {
      var hay = norm((p.title || '') + ' ' + (p.text || ''));
      var i = hay.indexOf(q);
      if (i >= 0) {
        var base = (p.title || '') + ' — ' + (p.text || '');
        var t = norm(base), j = t.indexOf(q), s = Math.max(0, j - 32);
        var snip = (s > 0 ? '… ' : '') + base.slice(s, j + raw.length + 46) + ' …';
        snip = esc(snip).replace(new RegExp('(' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<b style="color:var(--ink)">$1</b>');
        hits.push({ url: p.url, title: p.title, snip: snip });
      }
    });
    if (!hits.length) { rel.innerHTML = '<div class="none">Aucun résultat pour « ' + esc(raw) + ' »</div>'; rel.classList.add('show'); return; }
    rel.innerHTML = hits.map(function (h) {
      return '<a class="ritem" href="' + P + h.url + '" style="display:block"><div class="rt">' + h.title + '</div><div class="rs">' + h.snip + '</div></a>';
    }).join('');
    rel.classList.add('show');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) rel.classList.remove('show'); });
})();
