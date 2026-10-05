#!/usr/bin/env python3
"""Keep the full course, preserve question IDs, and validate enriched exercises."""
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'src'))
from extra_questions import QUESTIONS
from option_notes import NOTES
from question_families import FAMILIES

def normal(s):
    return re.sub(r'\s+', '', s).replace('：', ':').replace('（', '(').replace('）', ')')

study = json.loads((ROOT / 'src/learning.json').read_text())
documents = json.loads((ROOT / 'src/data.json').read_text())
pages = {(p['s'], p['p']): p['t'] for p in documents['pages']}
base = json.loads((ROOT / 'src/learning-base.json').read_text())['questions']
questions = base + [{'id': f'q{i:03}', **q} for i, q in enumerate(QUESTIONS, 73)]
for question in questions:
    if 'evidence' in question:
        assert normal(question['evidence']) in normal(pages[question['source'], question['page']]), question['id']
    question.update(NOTES[question['id']])
    question['concept'] = question['id']

# Correct a too-broad old question without changing its answer, ID or wrong-book history.
questions[70]['prompt'] = '多数真核细胞中，有氧呼吸的重要阶段主要在哪种结构中进行？'
questions[70]['explanation'] = '线粒体是多数真核细胞有氧呼吸的重要场所；糖酵解在细胞质中进行。'

def concept_id(family, label):
    return family + '-' + hashlib.sha256(label.encode()).hexdigest()[:8]

for family, module, source, (start, end), extension, raw in FAMILIES:
    facts = []
    for line in raw.strip().splitlines():
        label, definition, prompt, tokens = line.split('|')
        tokens = tokens.split('&')
        candidates = [(p, pages.get((source, p), '')) for p in range(start, end + 1)]
        matches = [(p, text) for p, text in candidates if all(normal(t) in normal(text) for t in tokens)]
        if not matches:
            raise ValueError(f'{family} {label} evidence missing in {source} {start}..{end}: {tokens}')
        page, text = matches[0]
        facts.append(dict(label=label, definition=definition, prompt=prompt, page=page, tokens=tokens))
    assert len(facts) >= 4
    for index, fact in enumerate(facts):
        # Four distinct related concepts; deterministic composition, randomized display in the app.
        chosen = [facts[(index + j) % len(facts)] for j in range(4)]
        concept = concept_id(family, fact['label'])
        questions.append(dict(id='f-' + concept, concept=concept, module=module, source=source,
            page=fact['page'], prompt=fact['prompt'], options=[f['label'] for f in chosen], answer=0,
            explanation=f"题干对应{fact['label']}。{fact['definition']}",
            optionExplanations=[f['definition'] for f in chosen], extension=extension,
            optionRefs=[{'source':source,'page':f['page']} for f in chosen],
            evidence=fact['tokens']))

# Equivalent knowledge points share a concept so a fresh knowledge point is preferred.
equivalent = {
    'law-effects': {'评价作用':[1], '指引作用':[], '预测作用':[93], '教育作用':[118], '强制作用':[]},
    'law-rules': {'授权性规则':[74], '禁止性规则':[75]},
    'civil-principles': {'平等原则':[117]},
    'crime-stages': {'犯罪未遂':[14], '犯罪中止':[15]},
    'money': {'价值尺度':[82], '支付手段':[83]},
    'costs': {'机会成本':[39,84], '沉没成本':[85]},
    'market-forms': {'完全竞争':[40]},
    'documents': {'请示':[43,105], '报告':[46], '函':[47], '公告':[88], '纪要':[140]},
    'management-functions': {'计划':[51]},
    'theorists': {'泰勒':[143], '梅奥':[144]},
    'needs': {'自我实现需要':[145]},
    'cognitive-bias': {'晕轮效应':[53]},
    'party-meetings': {'中共一大':[27], '中共二大':[28]},
    'history-systems': {'秦朝':[55,56], '隋朝':[57], '元朝':[106], '夏朝':[148]},
    'historiography': {'纪传体':[92]},
    'poet-titles': {'李白':[63,109]},
    'literature-authors': {'司马迁':[62]},
    'science-books': {'祖冲之':[110], '宋应星':[111]},
    'inventions': {'指南针':[149]},
    'medicine-history': {'李时珍':[150]},
    'waterways': {'苏伊士运河':[68]},
    'cell-structures': {'叶绿体':[70], '线粒体':[71]},
}
by_id = {q['id']: q for q in questions}
for family, entries in equivalent.items():
    for label, ids in entries.items():
        for number in ids:
            by_id[f'q{number:03}']['concept'] = concept_id(family, label)
for ids in [(7,76),(2,),(5,120),(26,128),(37,78),(38,133),(54,142),(94,119)]:
    for number in ids[1:]: by_id[f'q{number:03}']['concept'] = by_id[f'q{ids[0]:03}']['concept']

assert len(by_id) == len(questions)
assert len({q['prompt'] for q in questions}) == len(questions)
assert {q['source'] for q in questions} == {s['id'] for s in study['sources']}
for q in questions:
    assert len(q['options']) == len(set(q['options'])) == 4, q['id']
    assert q['answer'] in range(4) and len(q['optionExplanations']) == 4
    assert all(len(x) >= 12 for x in q['optionExplanations']) and len(q['extension']) >= 20, q['id']
    assert (q['source'], q['page']) in pages
study['questions'] = questions
(ROOT / 'src/learning.json').write_text(json.dumps(study, ensure_ascii=False, separators=(',', ':')))
report = {'questions':len(questions),'concepts':len({q['concept'] for q in questions}),
          'sources':dict(collections.Counter(q['source'] for q in questions)),
          'four_option_explanations':len(questions),'chapters_preserved':len(study['curriculum'])}
(ROOT / 'src/question-coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
