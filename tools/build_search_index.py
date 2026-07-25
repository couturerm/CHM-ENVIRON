#!/usr/bin/env python3
"""
build_search_index.py — regenerate search-index.json for CHM-ENVIRON.

Walks every top-level *.html and modules/*.html, strips tags to visible text,
and (for module pages) folds in the text of the deck referenced by the page's
`data-pdf="..."` attribute via `pdftotext`. This closes two gaps the hand-made
index had: silent drift from page edits, and slide-only terms being unsearchable.

Usage (from repo root):
    python3 tools/build_search_index.py            # writes search-index.json
    python3 tools/build_search_index.py --check     # diff vs existing, exit 1 if changed
    python3 tools/build_search_index.py --stdout     # print, don't write

No third-party deps. `pdftotext` (poppler-utils) must be on PATH for slide text.
"""

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "search-index.json")

# Page order the site expects (nav order); anything found but unlisted is appended.
PAGE_ORDER = [
    "index.html", "accueil.html",
]

# Tags whose *content* is not visible course text and must be dropped whole.
STRIP_BLOCKS = re.compile(
    r"<(script|style|noscript|template|svg)\b[^>]*>.*?</\1>",
    re.IGNORECASE | re.DOTALL,
)
TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")
TITLE_TAG = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
H1_TAG = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
DATA_PDF = re.compile(r'data-pdf="([^"]+)"')


def visible_text(raw: str) -> str:
    raw = STRIP_BLOCKS.sub(" ", raw)
    raw = TAG.sub(" ", raw)
    raw = html.unescape(raw)
    return WS.sub(" ", raw).strip()


def page_title(raw: str, fallback: str) -> str:
    m = H1_TAG.search(raw)  # prefer the on-page <h1>
    if m:
        t = WS.sub(" ", TAG.sub("", html.unescape(m.group(1)))).strip()
        if t:
            return t
    m = TITLE_TAG.search(raw)
    if m:
        # "<title>Cosmochimie · CHM-4152</title>" -> "Cosmochimie"
        return WS.sub(" ", html.unescape(m.group(1))).split("·")[0].strip()
    return fallback


def pdftotext(pdf_path: str) -> str:
    if not shutil.which("pdftotext"):
        sys.stderr.write("WARN: pdftotext not on PATH; slide text skipped for "
                         f"{pdf_path}\n")
        return ""
    if not os.path.exists(pdf_path):
        sys.stderr.write(f"WARN: deck not found: {pdf_path}\n")
        return ""
    try:
        out = subprocess.run(
            ["pdftotext", "-nopgbrk", "-q", pdf_path, "-"],
            capture_output=True, text=True, timeout=120,
        )
        return WS.sub(" ", out.stdout).strip()
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"WARN: pdftotext failed on {pdf_path}: {e}\n")
        return ""


def calendrier_text() -> str:
    """Texte plat du calendrier (rendu en JS, donc invisible au strip de tags)."""
    path = os.path.join(REPO, "data", "calendrier.json")
    if not os.path.exists(path):
        return ""
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"WARN: calendrier.json illisible: {e}\n")
        return ""
    bits = [b.get("label", "") for b in data.get("blocs", [])]
    for s in data.get("seances", []):
        bits += [s.get("label", ""), s.get("presentateur", ""),
                 s.get("desc", ""), s.get("date") or s.get("libelle", "")]
    return WS.sub(" ", " ".join(x for x in bits if x)).strip()


def collect_pages():
    pages = []
    for name in PAGE_ORDER:
        p = os.path.join(REPO, name)
        if os.path.exists(p):
            pages.append(("", name))
    # any other top-level html not in PAGE_ORDER
    for name in sorted(os.listdir(REPO)):
        if name.endswith(".html") and name not in PAGE_ORDER:
            pages.append(("", name))
    # module pages, alphabetical
    mod_dir = os.path.join(REPO, "modules")
    if os.path.isdir(mod_dir):
        for name in sorted(os.listdir(mod_dir)):
            if name.endswith(".html"):
                pages.append(("modules", name))
    return pages


def build():
    records = []
    for subdir, name in collect_pages():
        fpath = os.path.join(REPO, subdir, name) if subdir else os.path.join(REPO, name)
        url = f"{subdir}/{name}" if subdir else name
        raw = open(fpath, encoding="utf-8").read()
        title = page_title(raw, os.path.splitext(name)[0])
        text = visible_text(raw)

        # index.html rend son calendrier en JS : replier data/calendrier.json
        # pour que les noms de modules restent trouvables par la recherche.
        if name == "index.html":
            text = f"{text} {calendrier_text()}"

        # Fold in the module's deck text so slide-only terms are searchable.
        m = DATA_PDF.search(raw)
        if m:
            pdf_rel = m.group(1)  # e.g. "../medias/cosmochimie.pdf"
            pdf_abs = os.path.normpath(os.path.join(os.path.dirname(fpath), pdf_rel))
            deck = pdftotext(pdf_abs)
            if deck:
                text = f"{text} {deck}"

        records.append({"url": url, "title": title, "text": WS.sub(" ", text).strip()})
    return records


def dumps(records) -> str:
    # Compact-ish, one record per logical block, matches the repo's readable style.
    parts = []
    for r in records:
        parts.append(
            "  { "
            f'"url": {json.dumps(r["url"], ensure_ascii=False)}, '
            f'"title": {json.dumps(r["title"], ensure_ascii=False)},\n'
            f'    "text": {json.dumps(r["text"], ensure_ascii=False)} ' + "}"
        )
    return "[\n" + ",\n".join(parts) + "\n]\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if the on-disk index would change")
    ap.add_argument("--stdout", action="store_true", help="print instead of write")
    args = ap.parse_args()

    out = dumps(build())

    if args.stdout:
        sys.stdout.write(out)
        return 0
    if args.check:
        old = open(INDEX, encoding="utf-8").read() if os.path.exists(INDEX) else ""
        if old.strip() != out.strip():
            sys.stderr.write("search-index.json is OUT OF DATE (run without --check)\n")
            return 1
        print("search-index.json up to date")
        return 0
    open(INDEX, "w", encoding="utf-8").write(out)
    print(f"wrote {INDEX} ({len(build())} pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
