/* CHM-ENVIRON — quiz formatif. Reads .quiz[data-quiz] -> data/<module>.quiz.json.
   Schema: { questions:[ {type:mc|multi|tf, q, options[], answer, fb, verified} ] }.
   One feedback per question. Instant rétroaction. Unlimited attempts. No grades stored. */
(function () {
  var wrap = document.querySelector('.quiz[data-quiz]'); if (!wrap) return;
  var host = document.getElementById('qhost');
  var qc = document.getElementById('qc'), qp = document.getElementById('qp'), qs = document.getElementById('qs');
  var QUESTIONS = [], qi = 0, sc = 0;

  fetch(wrap.getAttribute('data-quiz')).then(function (r) { return r.json(); }).then(function (d) {
    var all = d.questions || d;
    var ok = all.filter(function (x) { return x.verified !== false; });   // publish verified
    QUESTIONS = ok.length ? ok : all;                                      // fallback: show all (demo)
    rq();
  }).catch(function () { host.innerHTML = '<div style="color:var(--muted)">Quiz à venir.</div>'; });

  function eq(a, b) { a = a.slice().sort(); b = b.slice().sort(); return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

  function rq() {
    var Q = QUESTIONS[qi];
    qc.textContent = 'Question ' + (qi + 1) + ' / ' + QUESTIONS.length;
    qp.style.width = (qi / QUESTIONS.length * 100) + '%';
    qs.textContent = 'Score : ' + sc;
    var multi = Q.type === 'multi', it = multi ? 'checkbox' : 'radio';
    host.innerHTML = '<div class="qtext">' + Q.q + '</div>' +
      Q.options.map(function (o, i) { return '<label class="opt" data-i="' + i + '"><input type="' + it + '" name="o">' + o + '</label>'; }).join('') +
      '<div class="fb" id="fb"><span class="v"></span><span id="ft"></span></div>' +
      '<div style="margin-top:13px"><button class="btn" id="ck" disabled>Valider</button> ' +
      '<button class="btn" id="nx" style="display:none">' + (qi + 1 < QUESTIONS.length ? 'Suivante ›' : 'Résultat') + '</button></div>';
    var els = [].slice.call(host.querySelectorAll('.opt'));
    els.forEach(function (e) {
      e.onclick = function () {
        if (!multi) { els.forEach(function (x) { x.classList.remove('sel'); }); e.classList.add('sel'); e.querySelector('input').checked = true; }
        else e.classList.toggle('sel');
        document.getElementById('ck').disabled = !host.querySelector('input:checked');
      };
    });
    document.getElementById('ck').onclick = ck;
    document.getElementById('nx').onclick = function () { qi++; qi < QUESTIONS.length ? rq() : fin(); };
  }

  function ck() {
    var Q = QUESTIONS[qi], els = [].slice.call(host.querySelectorAll('.opt'));
    var chosen = els.filter(function (e) { return e.querySelector('input').checked; }).map(function (e) { return +e.dataset.i; });
    var ans = Q.type === 'multi' ? Q.answer : [Q.answer];
    var ok = Q.type === 'multi' ? eq(chosen, Q.answer) : chosen[0] === Q.answer;
    els.forEach(function (e) { e.classList.add('locked'); var i = +e.dataset.i; if (ans.indexOf(i) >= 0) e.classList.add('correct'); else if (chosen.indexOf(i) >= 0) e.classList.add('wrong'); });
    if (ok) sc++;
    var fb = document.getElementById('fb'); fb.classList.add('show', ok ? 'good' : 'bad');
    fb.querySelector('.v').textContent = ok ? '✓ Bonne réponse' : '✗ À revoir';
    document.getElementById('ft').innerHTML = Q.fb || '';
    document.getElementById('ck').style.display = 'none';
    document.getElementById('nx').style.display = 'inline-block';
    qs.textContent = 'Score : ' + sc;
  }

  function fin() {
    qp.style.width = '100%'; qc.textContent = 'Terminé';
    var pct = Math.round(sc / QUESTIONS.length * 100);
    host.innerHTML = '<div class="result"><div class="sc">' + sc + ' / ' + QUESTIONS.length + '</div>' +
      '<div style="color:var(--muted);margin:6px 0 14px">' + pct + '%</div>' +
      '<button class="btn" id="again">↻ Recommencer</button></div>';
    document.getElementById('again').onclick = function () { qi = 0; sc = 0; rq(); };
  }
})();
