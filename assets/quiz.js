/* ============================================================
   CHM-ENVIRON — quiz engine (quiz formatif)
   Reads data/<module>.quiz.json. Types: mc | multi | tf | figure.
   One rétroaction (fb) per question. Instant feedback.
   Unlimited attempts. NO grades stored, nothing sent anywhere.

   Markup on a page:
     <div class="quiz" data-src="../data/cosmochimie.quiz.json"></div>
   or <div class="quiz" data-module="cosmochimie"></div>
   (data-module resolves to <prefix>data/<module>.quiz.json).

   JSON schema (shared with the réviseur tool):
     { "module":"...", "questions":[
       { "id":"q1","type":"mc|multi|tf|figure","q":"...",
         "options":["..."], "answer":1|[0,2]|true,
         "fb":"...", "figure":{plotlyData,layout},
         "source":"word|ia|manuel","verified":true,"note":"" } ] }
   Only verified items should ship; the engine renders whatever it is given.
   ============================================================ */
(function () {
  "use strict";

  var INMOD = /\/modules\//.test(location.pathname);
  var P = INMOD ? "../" : "";
  var plotlyPromise = null;

  function loadPlotly() {
    if (window.Plotly) return Promise.resolve(window.Plotly);
    if (plotlyPromise) return plotlyPromise;
    plotlyPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.0/plotly.min.js";
      s.onload = function () { res(window.Plotly); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return plotlyPromise;
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function arr(a) { return Array.isArray(a) ? a : [a]; }

  /* normalize the "answer" into a sorted index array of correct options */
  function correctSet(qn) {
    if (qn.type === "tf") {
      // options assumed ["Vrai","Faux"]; answer true|false|0|1
      var v = qn.answer;
      var idx = (v === true || v === 0 || v === "0" || v === "Vrai") ? 0 : 1;
      return [idx];
    }
    return arr(qn.answer).map(Number).sort(function (a, b) { return a - b; });
  }

  function renderQuestion(qn, i) {
    var card = el("div", "qcard");
    card.appendChild(el("div", "qnum", "Question " + (i + 1) +
      (qn.type === "multi" ? " · réponses multiples" : "")));
    card.appendChild(el("div", "qtext", esc(qn.q)));

    // Figure (Plotly) above the options, if present
    var figId = null;
    if (qn.type === "figure" || qn.figure) {
      figId = "fig_" + (qn.id || i) + "_" + Math.random().toString(36).slice(2, 7);
      var fig = el("div", "qfig");
      fig.id = figId;
      card.appendChild(fig);
    }

    var opts = qn.type === "tf"
      ? (qn.options && qn.options.length ? qn.options : ["Vrai", "Faux"])
      : (qn.options || []);
    var multi = qn.type === "multi";
    var inputType = multi ? "checkbox" : "radio";
    var name = "q_" + (qn.id || i) + "_" + Math.random().toString(36).slice(2, 7);

    var list = el("ul", "opts");
    opts.forEach(function (opt, oi) {
      var li = el("li", "opt");
      var input = document.createElement("input");
      input.type = inputType; input.name = name; input.value = oi;
      var lab = el("span", null, esc(opt));
      li.appendChild(input); li.appendChild(lab);
      li.addEventListener("click", function (e) {
        if (e.target !== input) { input.checked = multi ? !input.checked : true; }
      });
      list.appendChild(li);
    });
    card.appendChild(list);

    var btn = el("button", "check", "Vérifier");
    var fb = el("div", "fb");
    card.appendChild(btn);
    card.appendChild(fb);

    btn.addEventListener("click", function () {
      var correct = correctSet(qn);
      var chosen = [];
      list.querySelectorAll("input").forEach(function (inp, oi) {
        if (inp.checked) chosen.push(oi);
      });
      // reset visual state (allows re-attempts)
      list.querySelectorAll(".opt").forEach(function (li) {
        li.classList.remove("correct", "wrong");
      });
      if (!chosen.length) {
        fb.className = "fb show no";
        fb.innerHTML = '<span class="verdict">Choisissez une réponse.</span>';
        return;
      }
      var correctOk = correct.length === chosen.length &&
        correct.every(function (c) { return chosen.indexOf(c) >= 0; });

      list.querySelectorAll(".opt").forEach(function (li, oi) {
        if (correct.indexOf(oi) >= 0) li.classList.add("correct");
        else if (chosen.indexOf(oi) >= 0) li.classList.add("wrong");
      });

      fb.className = "fb show " + (correctOk ? "ok" : "no");
      fb.innerHTML = '<span class="verdict">' +
        (correctOk ? "Bonne réponse." : "À revoir.") + "</span> " +
        (qn.fb ? esc(qn.fb) : "");
    });

    return { card: card, figId: figId };
  }

  function renderQuiz(container, data) {
    var qs = (data && data.questions) || [];
    container.innerHTML = "";
    if (!qs.length) {
      container.appendChild(el("p", "quiz-note",
        "Aucune question vérifiée pour ce module pour l’instant."));
      return;
    }
    var head = el("p", "quiz-note",
      "Quiz formatif · rétroaction immédiate · tentatives illimitées · aucune note enregistrée.");
    container.appendChild(head);

    var pendingFigs = [];
    qs.forEach(function (qn, i) {
      var r = renderQuestion(qn, i);
      container.appendChild(r.card);
      if (r.figId && (qn.figure)) pendingFigs.push({ id: r.figId, fig: qn.figure });
    });

    if (pendingFigs.length) {
      loadPlotly().then(function (Plotly) {
        pendingFigs.forEach(function (pf) {
          var node = document.getElementById(pf.id);
          if (!node) return;
          try {
            Plotly.newPlot(node, pf.fig.data || [], pf.fig.layout || {},
              { responsive: true, displmodeBar: false, displayModeBar: false });
          } catch (e) {
            node.innerHTML = '<p class="quiz-note">Figure indisponible.</p>';
          }
        });
      }).catch(function () {});
    }
  }

  function initOne(container) {
    var src = container.getAttribute("data-src");
    if (!src) {
      var m = container.getAttribute("data-module");
      if (!m) return;
      src = P + "data/" + m + ".quiz.json";
    }
    container.innerHTML = '<p class="quiz-note">Chargement du quiz…</p>';
    fetch(src)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { renderQuiz(container, data); })
      .catch(function () {
        container.innerHTML = '<p class="quiz-note">Quiz non disponible (' +
          esc(src) + ").</p>";
      });
  }

  function init() {
    document.querySelectorAll(".quiz[data-src], .quiz[data-module]").forEach(initOne);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
