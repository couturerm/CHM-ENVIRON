/* CHM-ENVIRON — inline PDF reader. Loads the deck BY URL from .slidecard[data-pdf].
   Requires pdf.js loaded on the page (CDN). IDs match the mockup. */
(function () {
  var card = document.querySelector('.slidecard'); if (!card) return;
  var url = card.getAttribute('data-pdf'); if (!url) return;
  if (typeof pdfjsLib === 'undefined') { console.warn('pdf.js not loaded'); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var dl = document.getElementById('dl'); if (dl) dl.href = url;
  var canvas = document.getElementById('pdfcanvas'), cx = canvas.getContext('2d');
  var pdfDoc = null, pageNum = 1, scale = 1.25, rendering = false, pending = null;
  function rp(n) {
    rendering = true;
    pdfDoc.getPage(n).then(function (p) {
      var v = p.getViewport({ scale: scale });
      canvas.width = v.width; canvas.height = v.height;
      p.render({ canvasContext: cx, viewport: v }).promise.then(function () {
        rendering = false; if (pending !== null) { var q = pending; pending = null; rp(q); }
      });
    });
    document.getElementById('pageNum').value = n;
    document.getElementById('prev').disabled = n <= 1;
    document.getElementById('next').disabled = pdfDoc && n >= pdfDoc.numPages;
  }
  function q(n) { if (rendering) pending = n; else rp(n); }
  pdfjsLib.getDocument(url).promise.then(function (d) {
    pdfDoc = d; document.getElementById('pageCount').textContent = d.numPages; rp(1);
  }).catch(function () {
    var st = document.getElementById('stage');
    if (st) st.innerHTML = '<div style="color:var(--muted);padding:24px">Diapositives à venir.</div>';
  });
  document.getElementById('prev').onclick = function () { if (pageNum > 1) { pageNum--; q(pageNum); } };
  document.getElementById('next').onclick = function () { if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; q(pageNum); } };
  document.getElementById('zoomIn').onclick = function () { scale = Math.min(3, scale + 0.2); q(pageNum); };
  document.getElementById('zoomOut').onclick = function () { scale = Math.max(0.5, scale - 0.2); q(pageNum); };
  document.getElementById('pageNum').onchange = function (e) { var n = parseInt(e.target.value); if (n >= 1 && pdfDoc && n <= pdfDoc.numPages) { pageNum = n; q(n); } };
  document.getElementById('fs').onclick = function () { if (!document.fullscreenElement) card.requestFullscreen(); else document.exitFullscreen(); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') document.getElementById('next').click();
    if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  });
})();
