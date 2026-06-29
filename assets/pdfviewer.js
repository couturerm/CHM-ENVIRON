/* ============================================================
   CHM-ENVIRON — inline PDF.js slide reader
   Loads medias/<deck>.pdf BY URL (never base64-embedded).
   prev/next, page jump, zoom, arrow keys, download, fullscreen.
   Lazy-loads the deck (IntersectionObserver) so big decks don't
   block first paint.

   Markup on a page:
     <div class="pdfviewer" data-pdf="../medias/cosmochimie.pdf"
          data-title="Diapositives — Cosmochimie"></div>
   data-pdf is used verbatim as the URL (give it relative to the page).
   ============================================================ */
(function () {
  "use strict";

  var PDFJS_VER = "3.11.174";
  var CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/";
  var libPromise = null;

  function loadLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (libPromise) return libPromise;
    libPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = CDN + "pdf.min.js";
      s.onload = function () {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "pdf.worker.min.js";
          res(window.pdfjsLib);
        } else rej(new Error("pdfjsLib missing"));
      };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return libPromise;
  }

  function setup(host) {
    var url = host.getAttribute("data-pdf");
    if (!url) return;
    var title = host.getAttribute("data-title") || "Diapositives";

    host.innerHTML =
      '<div class="pdf-toolbar">' +
      '<button class="prev" title="Page précédente">◀</button>' +
      '<input class="pagenum" type="text" value="1" aria-label="Page">' +
      '<span class="pg">/ <span class="total">?</span></span>' +
      '<button class="next" title="Page suivante">▶</button>' +
      '<button class="zout" title="Zoom −">−</button>' +
      '<button class="zin" title="Zoom +">+</button>' +
      '<span class="grow"></span>' +
      '<button class="full" title="Plein écran">⤢ Plein écran</button>' +
      '<a class="btn dl" href="' + url + '" download title="Télécharger">⤓ PDF</a>' +
      "</div>" +
      '<div class="pdf-canvas-wrap"><div class="pdf-loading">Chargement des diapositives…</div></div>';

    var wrap = host.querySelector(".pdf-canvas-wrap");
    var canvas = null, ctx = null;
    var pdf = null, page = 1, total = 0, scale = 1.1, rendering = false, queued = null;
    var elPrev = host.querySelector(".prev"),
        elNext = host.querySelector(".next"),
        elNum = host.querySelector(".pagenum"),
        elTot = host.querySelector(".total"),
        elZin = host.querySelector(".zin"),
        elZout = host.querySelector(".zout"),
        elFull = host.querySelector(".full");

    function fit(viewport) {
      // scale to container width on first render
      var avail = wrap.clientWidth - 32;
      if (avail > 0 && viewport.width > avail) return avail / (viewport.width / scale);
      return scale;
    }

    function render(n) {
      if (rendering) { queued = n; return; }
      rendering = true;
      pdf.getPage(n).then(function (pg) {
        var vp = pg.getViewport({ scale: scale });
        if (!canvas) {
          canvas = document.createElement("canvas");
          ctx = canvas.getContext("2d");
          wrap.innerHTML = "";
          wrap.appendChild(canvas);
        }
        canvas.width = vp.width; canvas.height = vp.height;
        return pg.render({ canvasContext: ctx, viewport: vp }).promise;
      }).then(function () {
        rendering = false;
        elNum.value = n;
        elPrev.disabled = n <= 1;
        elNext.disabled = n >= total;
        if (queued !== null) { var q = queued; queued = null; render(q); }
      }).catch(function () { rendering = false; });
    }

    function go(n) {
      n = Math.max(1, Math.min(total, n | 0 || 1));
      page = n; render(page);
    }

    elPrev.addEventListener("click", function () { go(page - 1); });
    elNext.addEventListener("click", function () { go(page + 1); });
    elNum.addEventListener("change", function () { go(parseInt(elNum.value, 10)); });
    elZin.addEventListener("click", function () { scale = Math.min(3, scale + 0.2); render(page); });
    elZout.addEventListener("click", function () { scale = Math.max(0.4, scale - 0.2); render(page); });

    elFull.addEventListener("click", function () {
      host.classList.toggle("fullscreen");
      var on = host.classList.contains("fullscreen");
      elFull.textContent = on ? "✕ Quitter" : "⤢ Plein écran";
      document.body.style.overflow = on ? "hidden" : "";
      render(page);
    });

    // Arrow keys when the viewer (or fullscreen) is active
    host.setAttribute("tabindex", "0");
    function keyh(e) {
      if (host.classList.contains("fullscreen") || host.contains(document.activeElement) ||
          document.activeElement === host) {
        if (e.key === "ArrowRight" || e.key === "PageDown") { go(page + 1); e.preventDefault(); }
        else if (e.key === "ArrowLeft" || e.key === "PageUp") { go(page - 1); e.preventDefault(); }
        else if (e.key === "Escape" && host.classList.contains("fullscreen")) {
          elFull.click();
        }
      }
    }
    host.addEventListener("keydown", keyh);
    document.addEventListener("keydown", function (e) {
      if (host.classList.contains("fullscreen")) keyh(e);
    });

    loadLib().then(function (lib) {
      return lib.getDocument(url).promise;
    }).then(function (doc) {
      pdf = doc; total = doc.numPages; elTot.textContent = total;
      go(1);
    }).catch(function (err) {
      wrap.innerHTML = '<div class="pdf-loading">Impossible de charger le PDF.<br>' +
        '<a href="' + url + '">Ouvrir / télécharger le fichier</a></div>';
    });
  }

  function lazy(host) {
    if (!("IntersectionObserver" in window)) { setup(host); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.disconnect(); setup(host); }
      });
    }, { rootMargin: "200px" });
    io.observe(host);
  }

  function init() {
    document.querySelectorAll(".pdfviewer[data-pdf]").forEach(lazy);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
