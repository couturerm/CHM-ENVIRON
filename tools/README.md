# tools/

Scripts du site publie.

- `build_search_index.py` — regenere `search-index.json` a partir des pages et des decks.
- `extract_keywords.py` — extrait les mots-cles d'un deck pour le bloc Enrichissement.
- `import_quiz.py` — **obsolete**, squelette jamais termine. Ne pas utiliser.

## Ou vivent les questions

Aucune banque de questions n'est dans ce depot. Le depot ne contient que les quiz
formatifs consommes par les pages de module (`data/<slug>.quiz.json`).

Les questions, le document maitre Word et les scripts qui les produisent vivent sur
le disque du professeur, hors depot. Les `data/*.quiz.json` sont emis depuis cette
banque et deposes ici ; ils ne doivent pas etre edites a la main.
