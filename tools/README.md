# tools/ — the module factory (Phase 1 pipelines)

Three scripts that encode the per-module process once, so each new module is
authoring, not manual assembly. Run from the repo root.

## 1. build_search_index.py  ✅ ready
Regenerates `search-index.json` from every `*.html` + `modules/*.html`, folding
in each module's deck text (via `pdftotext` on the `data-pdf` deck). Closes the
slide-only-terms gap and the hand-maintenance drift.

    python3 tools/build_search_index.py           # write
    python3 tools/build_search_index.py --check    # CI: fail if stale
    python3 tools/build_search_index.py --stdout    # preview

Validated on Cosmochimie: page set unchanged; deck-only terms (e.g. "Putirka",
"Goldschmidt") now indexed. Note: `medias/isotopie.pdf` is missing — Isotopie
gets page text only until its deck is added.

## 2. extract_keywords.py  ✅ ready (needs open network for verification)
Deck PDF → salient French terms → **Wikipedia-verified** `fr.wikipedia.org`
links → paste-ready `<div class="kwcloud">` block. Verification uses the fr.wp
API to keep only terms with a real article and to fix accents/redirects, so no
404s. The extraction was validated offline; the verify step needs network
(blocked in the build sandbox, fine locally).

    python3 tools/extract_keywords.py medias/<slug>.pdf --max 15
    python3 tools/extract_keywords.py medias/<slug>.pdf --no-verify   # offline, may 404

Review the emitted list before pasting — it is a starting point, not final copy.

## 3. import_quiz.py  ⛔ blocked (skeleton only)
Builds `data/<slug>.quiz.json` from exported énoncés + the professor's answer
docs, excluding anything tagged `exam`. Two blockers before it can run:

1. **Exam-tagging decision.** Create `tools/quiz_tags.json` mapping each module
   slug to `"formative"` or `"exam"`. The script refuses to publish anything not
   tagged `formative`.
2. **Missing artefacts.** The Word answer/rétroaction docs and `reviseur_quiz.html`
   vetting UI are not in the repo/export. Énoncés without answers import as
   `answer: null, verified: false` so they cannot render as gradable.

All questions import with `verified: false` until a réviseur pass.

## Per-module workflow (once #3 is unblocked)
1. Drop deck → `medias/<slug>.pdf`
2. Copy `modules/cosmochimie.html` → `modules/<slug>.html`; set `data-pdf`, title, objectives (reuse plan de cours), guest card
3. `extract_keywords.py medias/<slug>.pdf` → paste Enrichissement block
4. `import_quiz.py <slug> …` → réviseur pass → `data/<slug>.quiz.json`
5. `build_search_index.py`
6. Commit; Pages redeploys
