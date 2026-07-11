#!/usr/bin/env python3
"""
extract_keywords.py — deck PDF -> Enrichissement block for CHM-ENVIRON.

Reads a module deck (PDF), extracts the most salient French terms (frequency,
stopword-filtered, capitalised/multiword phrases favoured), verifies each
candidate against the French Wikipedia API, and emits a ready-to-paste
<div class="kwcloud"> block whose links are guaranteed to resolve (no 404s).

Only terms with a real article are kept; the article's canonical title is used
for the href so redirects and accents are correct.

Usage (from repo root):
    python3 tools/extract_keywords.py medias/cosmochimie.pdf
    python3 tools/extract_keywords.py medias/cosmochimie.pdf --max 15 --min-len 4
    python3 tools/extract_keywords.py medias/cosmochimie.pdf --no-verify   # offline

Requires: pdftotext on PATH. Verification uses stdlib urllib (no `requests`).
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter

WS = re.compile(r"\s+")
# French stopwords + slide boilerplate; extend freely.
STOP = set("""
au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma
mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses
son sur ta te tes toi ton tu un une vos votre vous c d j l m n s t y été étée étées
étés être ai aie aies ait as avaient avais avait avec avez aviez avions avons ayant
c'est cette celui celle ceux plus moins tres tout tous toute toutes entre chaque
sont est sera seront etait etaient donc alors ainsi comme aussi encore deja apres
avant selon lorsque quand puis enfin ici cela ceci quel quelle quels quelles leurs
figure figures tableau tableaux slide diapositive source sources page pages voir
exemple exemples partie chapitre section fig ref etc via www http https org com
""".split())
# Words that are frequent in decks but not article-worthy.
NOISE = set("""
cours module objectif objectifs notion notions activite activites universite laval
professeur etudiant etudiants question questions reponse reponses environnement chimie
""".split())

TOKEN = re.compile(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]{2,}")
# Two-word phrases starting with a capitalised token look like named concepts.
PHRASE = re.compile(r"\b([A-ZÀ-Þ][a-zà-ÿ'\-]{2,})\s+([a-zà-ÿ][a-zà-ÿ'\-]{2,})\b")

API = "https://fr.wikipedia.org/w/api.php"


def pdftotext(pdf_path: str) -> str:
    if not shutil.which("pdftotext"):
        sys.exit("ERROR: pdftotext not on PATH (install poppler-utils).")
    if not os.path.exists(pdf_path):
        sys.exit(f"ERROR: deck not found: {pdf_path}")
    out = subprocess.run(["pdftotext", "-nopgbrk", "-q", pdf_path, "-"],
                         capture_output=True, text=True, timeout=120)
    return out.stdout


def candidates(text: str, min_len: int):
    words = [w for w in TOKEN.findall(text)]
    low = [w.lower() for w in words]
    single = Counter()
    for w, lw in zip(words, low):
        if len(lw) < min_len or lw in STOP or lw in NOISE or lw.isdigit():
            continue
        single[lw] += 1

    phrases = Counter()
    for a, b in PHRASE.findall(text):
        p = f"{a} {b}"
        pl = p.lower()
        if a.lower() in STOP or b.lower() in STOP:
            continue
        if b.lower() in NOISE or a.lower() in NOISE:
            continue
        phrases[pl] += 1

    # Rank: phrases weighted higher (concept-bearing), then frequent singles.
    ranked = []
    for p, c in phrases.most_common():
        if c >= 2:
            ranked.append((p, c * 3))
    for w, c in single.most_common():
        if c >= 3:
            ranked.append((w, c))
    # dedup keeping best score, drop singles already covered by a phrase
    seen, out = set(), []
    phrase_words = {w for p, _ in ranked if " " in p for w in p.split()}
    for term, score in sorted(ranked, key=lambda x: -x[1]):
        key = term
        if key in seen:
            continue
        if " " not in term and term in phrase_words:
            continue
        seen.add(key)
        out.append(term)
    return out


def wiki_lookup(term: str, timeout=10):
    """Return (canonical_title, url) if a fr.wikipedia article exists, else None."""
    params = {
        "action": "query", "format": "json", "redirects": 1,
        "titles": term, "prop": "info",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "CHM-ENVIRON/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
    except Exception:  # noqa: BLE001
        return None
    pages = data.get("query", {}).get("pages", {})
    for _, p in pages.items():
        if "missing" in p:
            return None
        title = p.get("title")
        if not title:
            return None
        href = "https://fr.wikipedia.org/wiki/" + urllib.parse.quote(
            title.replace(" ", "_"), safe="_()"
        )
        return title, href
    return None


def render_block(pairs):
    lines = ['      <div class="kwcloud">',
             "        <h3>Enrichissement : mots-clés et concepts</h3>",
             '        <div class="kwlist">']
    for label, href in pairs:
        lines.append(
            f'          <a href="{href}" target="_blank" rel="noopener">{label}</a>'
        )
    lines.append("        </div>")
    lines.append('        <div class="src">Termes extraits des diapositives; '
                 "chaque lien mène à l'article Wikipédia. Texte réel, indexé par "
                 "la recherche. Liste et liens révisables.</div>")
    lines.append("      </div>")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck", help="path to the module deck PDF")
    ap.add_argument("--max", type=int, default=15, help="max verified terms (default 15)")
    ap.add_argument("--min-len", type=int, default=4, help="min term length (default 4)")
    ap.add_argument("--no-verify", action="store_true",
                    help="skip Wikipedia verification (offline; emits raw candidates)")
    args = ap.parse_args()

    text = pdftotext(args.deck)
    cands = candidates(text, args.min_len)

    pairs = []
    if args.no_verify:
        for term in cands[:args.max]:
            href = "https://fr.wikipedia.org/wiki/" + urllib.parse.quote(
                term.capitalize().replace(" ", "_"), safe="_()")
            pairs.append((term, href))
        sys.stderr.write("WARN: --no-verify; links NOT checked, may 404.\n")
    else:
        for term in cands:
            if len(pairs) >= args.max:
                break
            hit = wiki_lookup(term)
            if hit:
                title, href = hit
                # show the deck term as label, canonical article as target
                pairs.append((term, href))
        if not pairs:
            sys.exit("No verifiable terms found; try --min-len 3 or --no-verify.")

    print(render_block(pairs))
    sys.stderr.write(f"\n{len(pairs)} verified terms from {args.deck}\n")


if __name__ == "__main__":
    main()
