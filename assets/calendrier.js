/* CHM-ENVIRON — calendrier des séances.
   Source unique : data/calendrier.json. Deux vues d'une même donnée :
     · « Par bloc » — regroupé par bloc thématique (vue par défaut), avec la description du bloc
     · « Par date » — ordre chronologique, plat
   Le choix de vue est mémorisé (localStorage). Un module `ouvert:false` est affiché sans lien
   (« à venir ») jusqu'à l'enregistrement de sa capsule. Les lignes sans `slug` (premier cours,
   semaine de lecture, examen, remise) sont des repères de calendrier, sans page.
   Aucune donnée d'évaluation ici : voir BRIO. */

(function () {
  var mount = document.getElementById('cal');
  if (!mount) return;
  var depth = parseInt(document.body.getAttribute('data-depth') || '0', 10);
  var P = depth ? '../' : '';

  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
              'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function fdate(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    var d = parseInt(p[2], 10);
    return (d === 1 ? '1er' : d) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function byDate(a, c) { return (a.date || '0').localeCompare(c.date || '0'); }

  function rows(list, showBloc, blocLabel) {
    return list.map(function (s) {
      var when = s.date ? fdate(s.date) : '<span class="muted">' + esc(s.libelle || 'Date à venir') + '</span>';
      var tag = (showBloc && s.bloc) ? '<span class="blocpill">' + esc(blocLabel(s.bloc)) + '</span>' : '';
      var title;
      if (!s.slug) {
        title = '<span class="evt">' + esc(s.label) + '</span>';
      } else if (s.ouvert === false) {
        title = '<span class="closedmod">' + esc(s.label) + '</span><span class="soon">à venir</span>';
      } else {
        title = '<a href="' + P + 'modules/' + esc(s.slug) + '.html">' + esc(s.label) + '</a>';
      }
      return '<tr' + (s.slug ? '' : ' class="evtrow"') + '>' +
        '<td>' + title + tag +
          (s.desc ? '<div class="sd">' + esc(s.desc) + '</div>' : '') + '</td>' +
        '<td>' + esc(s.presentateur) + '</td>' +
        '<td class="wdate">' + when + '</td>' +
        '</tr>';
    }).join('');
  }

  function render(data, mode) {
    var blocLabel = function (id) {
      var b = data.blocs.filter(function (x) { return x.id === id; })[0];
      return b ? b.label : id;
    };
    var head = '<tr><th>Module</th><th>Présentateur</th><th>Date</th></tr>';
    var body;

    if (mode === 'bloc') {
      body = data.blocs.map(function (b) {
        var list = data.seances.filter(function (s) { return s.bloc === b.id; }).slice().sort(byDate);
        if (!list.length) return '';
        var n = list.filter(function (s) { return s.date; }).length;
        return '<tr><th colspan="3">' + esc(b.label) +
               ' <span class="cnt">' + n + ' séance' + (n > 1 ? 's' : '') + '</span></th></tr>' +
               (b.desc ? '<tr class="blocdesc"><td colspan="3">' + esc(b.desc) + '</td></tr>' : '') +
               rows(list, false, blocLabel);
      }).join('');
      var autres = data.seances.filter(function (s) { return !s.bloc; }).slice().sort(byDate);
      if (autres.length) {
        body += '<tr><th colspan="3">Autres dates</th></tr>' + rows(autres, false, blocLabel);
      }
    } else {
      var dated = data.seances.filter(function (s) { return s.date; }).slice().sort(byDate);
      var undated = data.seances.filter(function (s) { return !s.date; });
      body = rows(undated.concat(dated), true, blocLabel);
    }

    mount.innerHTML = '<table class="eval sched">' + head + body + '</table>';
  }

  var MODE = 'bloc';
  try { MODE = localStorage.getItem('chm_cal_view2') || 'bloc'; } catch (e) {}

  fetch(P + 'data/calendrier.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var tabs = document.querySelectorAll('#calview .tab');
      function apply(m) {
        MODE = m;
        try { localStorage.setItem('chm_cal_view2', m); } catch (e) {}
        tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.view === m); });
        render(data, m);
      }
      tabs.forEach(function (t) {
        t.addEventListener('click', function () { apply(t.dataset.view); });
      });
      apply(MODE);
    })
    .catch(function () {
      mount.innerHTML = '<div class="legalnote">Le calendrier n\'a pas pu être chargé. ' +
        'Consulter le <a href="' + P + 'medias/plan-de-cours-chm-4152.pdf">plan de cours officiel (PDF)</a>.</div>';
    });
})();
