#!/usr/bin/env python3
"""Merge course additions and validate every new question against its PDF page."""
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))
from course_supplement import CARDS, REFS, NEW_MODULE
from extra_questions import QUESTIONS
from curriculum import CURRICULUM

def normalize(value):
    return re.sub(r"\s+", "", value).replace("：", ":").replace("（", "(").replace("）", ")")

base = json.loads((SRC / "learning-base.json").read_text())
documents = json.loads((SRC / "data.json").read_text())
pages = {(page["s"], page["p"]): page["t"] for page in documents["pages"]}
errors = []
for index, question in enumerate(QUESTIONS, 73):
    text = pages.get((question["source"], question["page"]), "")
    if normalize(question["evidence"]) not in normalize(text):
        errors.append(f"q{index:03}: {question['source']} p{question['page']} evidence missing: {question['evidence']}")
    if len(question["options"]) != 4 or question["answer"] not in range(4):
        errors.append(f"q{index:03}: invalid options")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)

source_names = {source["id"]: source["name"] for source in base["sources"]}
for module in base["modules"]:
    module["cards"] += CARDS[module["id"]]
    module["refs"] += [ref for ref in REFS[module["id"]] if ref not in module["refs"]]
    module["reading"] = "多资料对读：" + "、".join(source_names[source] for source in dict.fromkeys(ref[0] for ref in module["refs"])) + "。点击下方页码阅读相应章节。"
base["modules"].append(NEW_MODULE)
for index, question in enumerate(QUESTIONS, 73):
    base["questions"].append({"id": f"q{index:03}", **{key: value for key, value in question.items() if key != "evidence"}})
base.pop("days", None)
base["curriculum"] = CURRICULUM
for chapter in CURRICULUM:
    assert chapter["start"] <= chapter["end"]
    assert all((chapter["source"], p) in pages for p in range(chapter["start"], chapter["end"] + 1))
module_ids = {module["id"] for module in base["modules"]}
assert all(question["module"] in module_ids for question in base["questions"])
assert len({question["id"] for question in base["questions"]}) == len(base["questions"])
assert len({question["prompt"] for question in base["questions"]}) == len(base["questions"])
for module in base["modules"]:
    for source, page in module["refs"]:
        assert (source, page) in pages, (module["id"], source, page)

(SRC / "learning.json").write_text(json.dumps(base, ensure_ascii=False, separators=(",", ":")))
report = {
    "modules": len(base["modules"]),
    "knowledge_cards": sum(len(module["cards"]) for module in base["modules"]),
    "reading_chapters": len(CURRICULUM),
    "questions": len(base["questions"]),
    "question_sources": dict(collections.Counter(question["source"] for question in base["questions"])),
    "new_questions_with_page_evidence": len(QUESTIONS),
}
(SRC / "coverage-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
