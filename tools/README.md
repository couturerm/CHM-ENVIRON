# tools/ — scripts utilitaires

## build_search_index.py  ✅
Régénère `search-index.json` à partir des `*.html` + `modules/*.html`, en
incorporant le texte des decks (`pdftotext` sur `data-pdf`). À relancer après
chaque changement de contenu.

    python3 tools/build_search_index.py            # écrit
    python3 tools/build_search_index.py --check     # échoue si périmé
    python3 tools/build_search_index.py --stdout    # aperçu

## extract_keywords.py  ✅ (réseau requis pour la vérification)
Deck PDF → termes français saillants → liens `fr.wikipedia.org` **vérifiés** →
bloc `<div class="kwcloud">` prêt à coller. Sert à générer le bloc
« Enrichissement » d'une page module.

    python3 tools/extract_keywords.py medias/<slug>.pdf --max 15
    python3 tools/extract_keywords.py medias/<slug>.pdf --no-verify   # hors-ligne, peut donner des 404

Réviser la liste avant de coller.

## import_quiz.py  ⛔ déprécié
Remplacé par le flux actuel : les questions vivent dans `banque-questions.html`
(éditée à la main), et les quiz `data/<slug>.quiz.json` sont générés à partir des
questions **vérifiées** de la banque. Conservé pour référence seulement.

## Flux par module
Voir `PROJECT_STATUS.md` (cycle en 5 étapes) et `MODULE_CHAT_SEED.md` (gabarit de page).
