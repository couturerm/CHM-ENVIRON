#!/usr/bin/env python3
"""
import_quiz.py — build data/<slug>.quiz.json from source questionnaires.

STATUS: SKELETON — BLOCKED. Do not trust output until the two blockers below
are resolved. The parsing scaffold, schema, and exam-exclusion guard are in
place so that finishing this is a fill-in, not a rewrite.

Blocker 1 (decision): every questionnaire must be tagged `formative` or `exam`.
  Exam pools must NEVER be published to the static site. This script refuses to
  emit any question from a source whose tag is `exam` or missing. Provide the
  tagging as tools/quiz_tags.json:  { "cosmochimie": "formative", ... }

Blocker 2 (missing artefacts): the professor's answer/rétroaction Word docs and
  the `reviseur_quiz.html` vetting UI referenced in the build spec are not in the
  repo or the export mount. Énoncés without a matching answer doc are emitted
  with "answer": null and "verified": false so they cannot render as gradable.

Output schema (matches data/cosmochimie.quiz.json):
  { "module": <slug>, "questions": [ {id,type,q,options,answer,fb,
    source,verified,note}, ... ] }
Where type in {mc, tf, multi, figure}; verified=false until a réviseur pass.

Usage (once unblocked):
    python3 tools/import_quiz.py cosmochimie \
        --enonces "path/to/enonces" --answers "path/to/answers.docx"
"""

import argparse
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS = os.path.join(REPO, "tools", "quiz_tags.json")


def load_tags():
    if not os.path.exists(TAGS):
        sys.exit(
            "BLOCKED: tools/quiz_tags.json not found.\n"
            "Create it as {\"<slug>\": \"formative\"|\"exam\", ...} before running.\n"
            "Exam-tagged pools are never published."
        )
    return json.load(open(TAGS, encoding="utf-8"))


def guard_publishable(slug, tags):
    tag = tags.get(slug)
    if tag != "formative":
        sys.exit(
            f"REFUSING: module '{slug}' is tagged '{tag}'. "
            "Only 'formative' pools may be imported to the public site."
        )


def parse_enonces(path):
    """TODO: parse exported énoncés into question dicts (q/type/options)."""
    raise NotImplementedError(
        "Énoncé parser not implemented — pending the export format sample."
    )


def parse_answers(path):
    """TODO: parse the professor's Word answer/rétroaction doc (Blocker 2)."""
    raise NotImplementedError(
        "Answer-doc parser not implemented — Word answer docs not yet located."
    )


def build(slug, enonces_path, answers_path):
    guard_publishable(slug, load_tags())
    questions = parse_enonces(enonces_path)
    answers = parse_answers(answers_path) if answers_path else {}
    for q in questions:
        a = answers.get(q["id"])
        q["answer"] = a["answer"] if a else None
        q["fb"] = a["fb"] if a else ""
        q["source"] = "word" if a else "enonce"
        q["verified"] = False  # always requires a réviseur pass
    return {"module": slug, "questions": questions}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--enonces", required=True)
    ap.add_argument("--answers")
    args = ap.parse_args()

    out = build(args.slug, args.enonces, args.answers)
    dest = os.path.join(REPO, "data", f"{args.slug}.quiz.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"wrote {dest} ({len(out['questions'])} questions, all verified=false)")


if __name__ == "__main__":
    main()
