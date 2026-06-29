/* CHM-ENVIRON — quiz formatif (engine v2).
   Reads .quiz[data-quiz] -> data/<module>.quiz.json and renders ALL questions
   on one page; each question is validated independently with instant rétroaction.
   Unlimited attempts. No grades stored.

   Markup contract (unchanged): a .quiz[data-quiz] containing #qhost, and optionally
   a .qbar with #qc / #qp / #qs (a live tally is written there if present).

   Schema: { questions:[ { id, type:"mc|multi|tf|figure", q, options[],
             answer:Number|Number[]|Boolean, fb, figure:{data,layout}, verified } ] }
   - mc / figure: answer = correct option index.
   - multi: answer = array of correct indices.
   - tf: options default ["Vrai","Faux"]; answer = true/false or index.
   - figure: a Plotly chart (figure.data/figure.layout) is drawn above the options. */
(function () {
  var wrap = document.querySelector('.quiz[data-quiz]'); if (!wrap) return;
  var host = wrap.querySelector('#qhost') || document.getElementById('qhost'); if (!host) return;
  var qc = document.getElementById('qc'), qp = document.getElementById('qp'), qs = document.getElementById('qs');

  var QUESTIONS = [], STATE = [], needFigure = false;

  fetch(wrap.getAttribute('data-quiz')).then(function (r) { return r.json(); }).then(function (d) {
    var all = d.questions || d;
    var ok = all.filter(function (x) { return x.verified !== false; });   // publish verified only
    QUESTIONS = ok.length ? ok : all;                                      // fallback: show all (demo)
    render();
  }).catch(function () { host.innerHTML = '<div style="color:var(--muted)">Quiz à venir.</div>'; });

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function arr(a) { return Array.isArray(a) ? a : [a]; }
  function eq(a, b) { a = a.slice().sort(); b = b.slice().sort(); return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

  function options(Q) {
    if (Q.type === 'tf' && !(Q.options && Q.options.length)) return ['Vrai', 'Faux'];
    return Q.options || [];
  }
  function correctIdx(Q) {
    if (Q.type === 'tf') {
      var v = Q.answer;
      if (typeof v === 'boolean') return [v ? 0 : 1];
      return arr(v).map(Number);
    }
    return arr(Q.answer).map(Number);
  }

  function render() {
    host.innerHTML = '';
    QUESTIONS.forEach(function (Q, qi) {
      STATE[qi] = { answered: false, correct: false };
      var multi = Q.type === 'multi', it = multi ? 'checkbox' : 'radio';
      var block = document.createElement('div');
      block.className = 'qblock';
      var figHtml = (Q.type === 'figure' || Q.figure) ? '<div class="qfig" id="qfig-' + qi + '"></div>' : '';
      block.innerHTML =
        '<div class="qnum">Question ' + (qi + 1) + ' / ' + QUESTIONS.length +
          (multi ? ' · réponses multiples' : '') + '</div>' +
        '<div class="qtext">' + esc(Q.q) + '</div>' + figHtml +
        options(Q).map(function (o, i) {
          return '<label class="opt" data-i="' + i + '"><input type="' + it + '" name="o' + qi + '">' + esc(o) + '</label>';
        }).join('') +
        '<div style="margin-top:11px"><button class="btn" data-ck="' + qi + '" disabled>Valider</button></div>' +
        '<div class="fb"><span class="v"></span><span class="ft"></span></div>';
      host.appendChild(block);
      if (figHtml) needFigure = true;

      var opts = [].slice.call(block.querySelectorAll('.opt'));
      var ckBtn = block.querySelector('.btn');
      opts.forEach(function (e) {
        e.onclick = function () {
          if (!multi) { opts.forEach(function (x) { x.classList.remove('sel'); }); e.classList.add('sel'); e.querySelector('input').checked = true; }
          else e.classList.toggle('sel');
          // re-attempt: clear previous verdict the moment the answer changes
          opts.forEach(function (x) { x.classList.remove('correct', 'wrong'); });
          var fb = block.querySelector('.fb'); fb.classList.remove('show', 'good', 'bad');
          ckBtn.disabled = !block.querySelector('input:checked');
        };
      });
      ckBtn.onclick = function () { check(Q, qi, block); };
    });
    tally();
    if (needFigure) drawFigures();
  }

  function check(Q, qi, block) {
    var opts = [].slice.call(block.querySelectorAll('.opt'));
    var chosen = opts.filter(function (e) { return e.querySelector('input').checked; }).map(function (e) { return +e.dataset.i; });
    if (!chosen.length) return;
    var ans = correctIdx(Q);
    var ok = Q.type === 'multi' ? eq(chosen, ans) : chosen[0] === ans[0];
    opts.forEach(function (e) {
      var i = +e.dataset.i;
      e.classList.remove('correct', 'wrong');
      if (ans.indexOf(i) >= 0) e.classList.add('correct');
      else if (chosen.indexOf(i) >= 0) e.classList.add('wrong');
    });
    var fb = block.querySelector('.fb');
    fb.classList.add('show', ok ? 'good' : 'bad'); fb.classList.remove(ok ? 'bad' : 'good');
    fb.querySelector('.v').textContent = ok ? '✓ Bonne réponse' : '✗ À revoir';
    fb.querySelector('.ft').innerHTML = Q.fb || '';
    STATE[qi] = { answered: true, correct: ok };
    tally();
  }

  function tally() {
    var n = QUESTIONS.length;
    var answered = STATE.filter(function (s) { return s && s.answered; }).length;
    var correct = STATE.filter(function (s) { return s && s.correct; }).length;
    if (qc) qc.textContent = answered + ' / ' + n + ' répondues';
    if (qp) qp.style.width = (n ? answered / n * 100 : 0) + '%';
    if (qs) qs.textContent = 'Score : ' + correct + ' / ' + n;
  }

  function drawFigures() {
    function go() {
      QUESTIONS.forEach(function (Q, qi) {
        if (!(Q.type === 'figure' || Q.figure)) return;
        var node = document.getElementById('qfig-' + qi); if (!node || !window.Plotly) return;
        try {
          Plotly.newPlot(node, (Q.figure && Q.figure.data) || [], (Q.figure && Q.figure.layout) || {},
            { displayModeBar: false, responsive: true });
        } catch (e) { node.innerHTML = '<div style="color:#900;padding:18px">Figure indisponible.</div>'; }
      });
    }
    if (window.Plotly) { go(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.0/plotly.min.js';
    s.onload = go;
    s.onerror = function () {
      QUESTIONS.forEach(function (Q, qi) {
        if (!(Q.type === 'figure' || Q.figure)) return;
        var node = document.getElementById('qfig-' + qi); if (node) node.innerHTML = '<div style="color:var(--muted);padding:18px">Figure indisponible (hors ligne).</div>';
      });
    };
    document.head.appendChild(s);
  }
})();
