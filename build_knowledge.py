#!/usr/bin/env python3
"""Build traceable factual practice and a coverage catalog; never use unreadable fragments."""
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'src'
sys.path.insert(0,str(SRC))
from teaching import GUIDES, TIMELINES, EVENT_LINES
from jilin import extend_jilin
from multiple_choice import extend_multiple
from exam_questions import apply_exam_questions
from supplements import SUPPLEMENTS, UNIT_GUIDES
def key(text): return re.sub(r'\s+', '', text)
def uid(text): return hashlib.sha256(text.encode()).hexdigest()[:14]

study = json.loads((SRC / 'learning.json').read_text())
raw = json.loads((SRC / 'data.json').read_text())
study['modules'] = [m for m in study['modules'] if m['id'] not in ('m13','m14')]
study['curriculum'] = [c for c in study['curriculum'] if c['module'] != 'm13']
for c in study['curriculum']:
    if c['title'] in ('公司法','合伙企业法','票据法'):c['module']='m02'
for m in study['modules']:
    if m['id']=='m03':m['title']='刑法、行政法与社会法'
study['questions'] = [q for q in study['questions'] if q['module'] not in ('m13','m14') and not q['id'].startswith(('k-','ms-'))]
excluded = {'bottom':(315,388),'mindmap':(273,316)}
raw['pages'] = [p for p in raw['pages'] if not (p['s'] in excluded and excluded[p['s']][0] <= p['p'] <= excluded[p['s']][1])]
for source in raw['sources']:
    source['readablePages'] = sum(p['s']==source['id'] for p in raw['pages'])
    source['excludedRanges'] = [list(excluded[source['id']])] if source['id'] in excluded else []
(SRC / 'active-data.json').write_text(json.dumps(raw,ensure_ascii=False,separators=(',',':')))
page_map = {(p['s'],p['p']):p['t'] for p in raw['pages']}

NOISE = re.compile(r'^.*(?:超格|微信公众号|notes|keyword|公共基础知识笔记|公共基础知识-思维导图|资源分享|www\.|https?://).*$|^\s*[-—]?\s*\d{1,4}\s*[-—]?\s*$',re.M)
UNSTABLE = re.compile(r'山东|齐鲁|目前|现任|现时|最新|截至|五个军种|战略支援部队|秘书长|GDP|排名|救命|急救|蛇咬|触电|烫伤|烧伤|药方|服药|活疫苗|死疫苗|狂犬|治疗|中毒|心脏复苏|止血|维生素.*(治疗|服用)|世界上盐度最高|印度洋和大西洋的分界线|太平洋和印度洋的分界线')
RELATION = re.compile(r'(是|属于|被称为|称为|包括|由.{2,25}组成|负责|决定|标志着|对应|分为)')

def clean(t):
    t=NOISE.sub('',t).replace('【重点】','').replace('（重点）','')
    return t

def statements(source,page,text):
    text=clean(text)
    if source=='tricolor':
        # Numbered facts are paragraph units; join only within that unit, not arbitrary table columns.
        units=re.split(r'(?m)^\s*\d{1,4}[.．、]\s*',text)[1:]
    elif source=='color':
        # Native-text prose: join soft line breaks, retaining heading/bullet boundaries.
        units=re.split(r'\n(?=[①②③④⑤⑥⑦⑧⑨]|[（(][1-9一二三四五六]|\d+[.．、])',text)
    else:
        # OCR tables are not joined; only already complete prose statements are eligible.
        units=[line for line in text.splitlines() if line.endswith('。')]
    for unit in units:
        unit=key(unit)
        for line in re.split('[。；]',unit)[:-1]:
            line=line.strip('：:，、')
            line=re.sub(r'^[①②③④⑤⑥⑦⑧⑨]+','',line)
            line=re.sub(r'^[（(]\d+[）)]','',line)
            if not 18<=len(line)<=155 or UNSTABLE.search(line): continue
            if re.search(r'业务服务对象|会议指出|不过也|Why\?|最小存储单位|普通公文应当|唐氏|被申请人|著作权属于单位|我国播种面积最大|最大.*自然保护区|出生第一针|色盲|声称|最理想|最安全|科学家公认|生产基地|不确定档次|劳动教养|无缴付期限|被胁迫.*次要|胁从犯|我国领域包括|维生素|药物|疾病|肾病|治疗|诊断',line):continue
            if '“' in line and line.count('“')!=line.count('”'):continue
            if re.match(r'^(?:内容上|全称|又称|除由|宗旨|\d{4}年|已满|男女平等|科学家|甲|乙|杜甫的岁数|杜牧深爱|东汉以后，凡|否定是|本质是)',line):continue
            if chapter['module'] in ['m01','m02','m03'] and re.search(r'\d|期限|以上|以下|至少|最多|最少|最低',line):continue
            if re.search(r'[×✗�]|Eg\.|案例|判断[:：]|口诀|选择题|下列|本题|www|了解即可',line): continue
            # Numerical administrative/current rules and personal medical instructions need separate review.
            if source!='tricolor' and re.search(r'\d',line) and re.search('处罚|复议|诉讼|退休|赔偿|税率|工资|公司',line): continue
            if re.search(r'世界.*(?:最|第一|唯一)|历史非法|(^|[，：])(?:补充|拓展|知识点|相关诗句)|[_★]|^(?:的|是|为|年|和|而|但|也|这|该|其|由此|因此|解析|按照|根据|如|要|一是|二是|三是|[—-])',line):continue
            relation=RELATION.search(line)
            if not relation or not 2<=relation.start()<=18: continue
            title=line[:relation.start()]
            if any(x in title for x in '，。：:/\\0123456789') or re.match(r'^(?:在|从|当|对于|由于|只有|凡|所有|每个|明确|强调|语言|法律规定)',title):continue
            if title.endswith(('与','和','而','或','将','其','均','都','一般','只','起')):continue
            if title.count('（')!=title.count('）') or title.count('“')!=title.count('”') or title.count('《')!=title.count('》'):continue
            if re.search(r'[A-Z]\.|注意|口诀|常考|明确|强调|第二个行|不确定|内容|宣言|宗旨|主要|当地|另有',title):continue
            if source=='color' and len(title)>12:continue
            if re.search(r'两个结合是对于|政治领导，即|高\.$|爆发性增殖或高$|地方性法规的制定主体|外国人.*可以|县.*人大.*地方性',line):continue
            if line[-1] in '的与和及如是为于其可能将把以':continue
            if line.count('（')!=line.count('）'):continue
            if re.search(r'不是|不属于|不包括|不得|不能|并非|没有|不具有|不以',line):continue
            if source in ('top','bottom','mindmap'):continue
            if relation.start()>20 and source=='color':continue
            if any(x in line[:relation.start()] for x in '★→：:①②③④⑤⑥⑦⑧⑨<>'):continue
            if len(line)-relation.end()<12:continue
            yield line

facts={}
for chapter in study['curriculum']:
    if '框架' in chapter['title'] or '总览' in chapter['title']:continue
    for page in range(chapter['start'],chapter['end']+1):
        for statement in statements(chapter['source'],page,page_map.get((chapter['source'],page),'')):
            ident=uid(statement)
            if ident not in facts:
                facts[ident]={'id':'point-'+ident,'statement':statement+'。','module':chapter['module'],
                             'title':statement[:RELATION.search(statement).start()].strip('，：:'),
                             'source':chapter['source'],'page':page,'chapters':[chapter['id']]}
            elif chapter['id'] not in facts[ident]['chapters']:facts[ident]['chapters'].append(chapter['id'])

for row in SUPPLEMENTS:
    module,source,page,title,statement,*authority=row
    ident='supplement-'+uid(title+statement)
    chapter=next((c for c in study['curriculum'] if c['module']==module and c['source']==source and c['start']<=page<=c['end']),None)
    fact={'id':ident,'title':title,'statement':statement,'module':module,'source':source,'page':page,'chapters':[chapter['id']] if chapter else [],'authored':True}
    if authority:fact.update(authority=authority[0],correction='如旧资料表述与现行依据冲突，以链接中的现行规则为准。')
    facts[ident]=fact

by_chapter=collections.defaultdict(list)
for fact in facts.values():
    for c in fact['chapters']:by_chapter[c].append(fact)
gaps=[{'id':c['id'],'title':c['title'],'module':c['module'],'source':c['source'],'start':c['start'],'end':c['end']} for c in study['curriculum'] if c['id'] not in by_chapter and '框架' not in c['title'] and '总览' not in c['title']]
(SRC/'knowledge-draft.json').write_text(json.dumps({'facts':list(facts.values()),'gaps':gaps},ensure_ascii=False,indent=2))
print(json.dumps({'facts':len(facts),'by_module':dict(collections.Counter(f['module'] for f in facts.values())),'reference_chapters_without_prose':len(gaps)},ensure_ascii=False))

# Existing manually authored exercises preserve all five references and provide application practice.
for q in study['questions']:
    point_id='exercise-'+q['concept']
    if point_id not in facts:
        chapter=next((c for c in study['curriculum'] if c['source']==q['source'] and c['start']<=q['page']<=c['end']),None)
        facts[point_id]={'id':point_id,'title':q['options'][q['answer']], 'statement':q['explanation'],
                        'module':q['module'],'source':q['source'],'page':q['page'],
                        'chapters':[chapter['id']] if chapter else [],'questionIds':[],'application':True}
    facts[point_id].setdefault('questionIds',[]).append(q['id']);q['pointIds']=[point_id]

knowledge=list(facts.values())
module_facts=collections.defaultdict(list)
for f in knowledge:
    if not f.get('application'):module_facts[f['module']].append(f)

# Exam questions are authored after the regional and multi-select overlays.
# Link reference chapters to the same taught knowledge, rather than make duplicate PDF directories.
for chapter in study['curriculum']:
    unit=UNIT_GUIDES.get(chapter['title'])
    if not unit:
        synonyms={'公文格式':'公文要素格式','公文要素格式':'公文要素格式','微观经济学':'微观经济','宏观经济学':'宏观经济','唯物辩证法':'唯物辩证法','辩证法':'唯物辩证法','法理学':'法的本体','认识论':'认识论','公民基本权利和义务':'公民基本权利和义务','行政法':'行政法概述','天文地理':'天文常识','基础科学':'物理常识'}
        if chapter['title'] in synonyms:unit=UNIT_GUIDES.get(synonyms[chapter['title']])
    linked=[f['id'] for f in knowledge if chapter['id'] in f['chapters']]
    if not linked:
        words=[chapter['title']]+[t['title'].strip('：:•.（）() ') for t in chapter.get('topics',[]) if len(t['title'])>=3]
        linked=[f['id'] for f in knowledge if f['module']==chapter['module'] and any(w in f['title'] or w in f['statement'] for w in words)]
    if unit:
        related=[f['id'] for f in knowledge if f['module']==chapter['module'] and any(w in f['title'] or w in f['statement'] for w in unit[2])]
        linked+=related
    if '框架' in chapter['title'] or '总览' in chapter['title']:linked=[f['id'] for f in knowledge if f['module']==chapter['module']]
    chapter['pointIds']=list(dict.fromkeys(linked))
for source in study['sources']:
    if source['id'] in excluded:
        source.setdefault('originalPages',source['pages']);source['pages']=excluded[source['id']][0]-1
for book in study['books']:
    if book['source'] in excluded:book['end']=excluded[book['source']][0]-1
for fact in knowledge:fact.setdefault('questionIds',[])
study['knowledge']=knowledge
study['guides']=GUIDES
study['unitGuides']={title:{'explanation':row[0],'method':row[1],'keywords':row[2]} for title,row in UNIT_GUIDES.items()}
study['timelines']=TIMELINES
study['eventLines']=EVENT_LINES
study['coverage']={'points':len(knowledge),'withQuestions':sum(bool(f.get('questionIds')) for f in knowledge),
                   'questions':len(study['questions']),'referenceChapters':len(study['curriculum']),
                   'referenceChaptersWithLinkedPoints':sum(bool(c['pointIds']) for c in study['curriculum'])}
# References without a reviewed question remain visible in the course.
assert all(q['module']!='m13' and len(q['optionExplanations'])==4 for q in study['questions'])
assert len({q['id'] for q in study['questions']})==len(study['questions'])
assert all((f['source'],f['page']) in page_map for f in knowledge)
extend_jilin(study)
extend_multiple(study)
apply_exam_questions(study)
# References without a reviewed question remain visible in the course.
(SRC/'learning.json').write_text(json.dumps(study,ensure_ascii=False,separators=(',',':')))
(SRC/'knowledge-coverage.json').write_text(json.dumps(study['coverage'],ensure_ascii=False,indent=2))
print(json.dumps(study['coverage'],ensure_ascii=False))
