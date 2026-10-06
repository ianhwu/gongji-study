# -*- coding: utf-8 -*-
"""Reproducible, explicitly authored coverage questions; no mechanical PDF fragments.

Each option assesses its own stated knowledge point. The two variants use the
same curated facts with different truth masks; they are practice, not past exams.
The snapshot fixes the original missing set and makes this operation idempotent.
"""
from collections import defaultdict, Counter
from pathlib import Path
import hashlib
import json
import random

SRC = Path(__file__).parent
TITLES = {
8:'意识的客观来源',20:'共同富裕的本质要求',23:'三个代表的时代课题',25:'科学发展观的历史地位',31:'民主集中制',32:'国务院的紧急状态职权',37:'生育纠纷与离婚',41:'滥用职权与玩忽职守',42:'刑事案件地域管辖',44:'行政处罚决定权限',45:'复议加重损害的赔偿',56:'无差异曲线',57:'价格歧视的三级分类',58:'国民总收入与常住单位',59:'未预期通胀的利益影响',60:'短期菲利普斯曲线',62:'财政支出功能与经济分类',64:'间接标价法',66:'通报的适用范围',67:'纪要与会议记录',68:'重要公文起草与签发',69:'商圣范蠡',71:'萨尔浒战役',78:'张若虚与春江花月夜',79:'将进酒的夸张手法',80:'黄河源头与入海口',86:'老子的道与无为',87:'古田会议思想建党政治建军',92:'百团大战参战力量',96:'叶圣陶与现代童话',100:'沙俄侵占中国领土',105:'安全需要',108:'矩阵式组织结构',109:'职能制与多头领导',112:'事业单位年度考核等次',113:'公务员定期考核等次',114:'事业单位处分种类',115:'事业单位处分生效与开除',116:'事业单位处分决定权限',117:'事业单位履职回避',118:'事业单位处分申诉期限',119:'回族的形成与发展',127:'中国太阳能资源分布',128:'羊八井地热',138:'天文单位与地日距离',139:'岩石圈与板块模型',144:'生物质能',147:'人工智能的主要能力',155:'千足金旧称与足金命名',157:'二氧化碳与澄清石灰水',158:'水垢成分与传热',159:'鳄鱼眼泪的生理作用',160:'补钙时间与个体差异',164:'传统中医五味归经',169:'西汉太初历',186:'世界贸易组织与关贸总协定',192:'法律关系主体',193:'法律责任归责要求',196:'人民主权原则',216:'事业单位处分复核期限',217:'事业单位复核决定期限',218:'税费征收与征用',220:'省级政府自行复议后的救济',225:'父母与未成年子女监护',228:'民法典的遗嘱形式',232:'劳动合同即时解除',236:'南极洲平均海拔',248:'中国南极考察站',249:'北极黄河站',255:'六大板块模型',256:'喜马拉雅山脉成因',330:'肺动脉与肺静脉',333:'疫苗与特异性免疫',334:'霍乱病原与传播',335:'疟疾病原与传播',336:'晕动病的感觉机制',337:'心肺复苏适用情形',339:'绿色食品认证',355:'攀登计划与基础研究',356:'火炬计划与产业化',360:'传统航天发射场',376:'导弹射程分类',445:'社会治理的完整要求',450:'古田会议的建设原则',460:'邻里尊重与互助',451:'党的十二大总任务',331:'人体最长骨与听小骨',257:'喀斯特与砂岩峰林',244:'太阳大气层次',263:'物种丰富度与生物多样性',386:'茅盾文学奖的设立',359:'全球四大导航系统',373:'量子比特与测量',409:'僧一行与大衍历',493:'阳历、阴历与阴阳合历',494:'青花瓷与釉下彩',501:'赵州桥与李春',495:'隋代大运河',499:'都江堰与郑国渠',292:'汉谟拉比法典',293:'马可波罗与元代中国',301:'光与颜料的三原色',317:'碘酒的成分',318:'原麦汁浓度与酒精度',68:'重要公文起草与签发',454:'外交和平共处五项原则'}
# Corrections to extraction/classification, not changes to the reference PDFs.
MOVES = {80:'m12',87:'m05',100:'m10',101:'m10',119:'m11',120:'m11',149:'m11',164:'m11',201:'m06',216:'m09',217:'m09',223:'m03',399:'m12',414:'m07',476:'m02',497:'m10',500:'m10'}
AUTH = {
 'constitution':'https://www.npc.gov.cn/zgrdw/pc/13_2/2018-03/22/content_2071091.htm',
 'civil':'https://www.court.gov.cn/zixun/xiangqing/233181.html',
 'marriage':'https://www.court.gov.cn/fabu/xiangqing/282071.html',
 'penalty':'https://www.npc.gov.cn/npc/c2/c30834/202101/t20210122_309857.html',
 'compensation':'https://www.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_qtxgfl/202110/t20211029_575987.html',
 'review':'https://www.sse.com.cn/lawandrules/rules/law/adminis/c/10758095/files/502e0813ea99456c81b025a744cdba1e.pdf',
 'public-servant':'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_6af2e9cf52224593b4dc15258bb34860.html',
 'staff':'https://rsj.panjin.gov.cn/2023_11/24_15/content-437188.html',
 'assessment':'https://chinajob.mohrss.gov.cn/h5/c/2023-03-01/370681.shtml',
 'labor':'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/fl/202011/t20201102_394622.html',
 'documents':'https://www.miit.gov.cn/xwdt/szyw/art/2020/art_6afb8ee6d07540dcacccbeb47dbc0fd4.html',
 'gni':'https://zjzd.stats.gov.cn/gjtjjtzdcd/dczs/tjzbjs/art/2022/art_f2679fa00a114df1b029f2cd5df4d5de.html',
 'calcium':'https://www.nhc.gov.cn/xcs/c100122/202508/8458a47948274283ab01c6cc672d8015.shtml',
 'vaccine':'https://www.nhc.gov.cn/wjw/jbyfykz/201604/e73973a39ece42fdba98e3d8a001acd7.shtml',
 'cholera':'https://www.chinacdc.cn/jkts/202509/t20250911_310377.html',
 'malaria':'https://www.chinacdc.cn/jkkp/crb/ycr/202408/t20240822_294964.html',
 'cpr':'https://www.nhc.gov.cn/wjw/pyl/201212/34555/files/1739779685831_69462.pdf',
 'food':'https://fgs.moa.gov.cn/flfg/202201/t20220127_6387807.htm',
 'gold':'https://amr.sz.gov.cn/xxgk/qt/ztlm/zlzl/jgtb_cp/content/post_1938928.html',
 'polar':'https://www.moj.gov.cn/gwxw/ttxw/202402/t20240207_494600.html',
 'twelfth':'https://www.safe.gov.cn/shanghai/2021/0924/1615.html',
}
BY_INDEX = {}
for key, indexes in {
 'constitution':[31,32,33,195,196,197,198,199,200,202,203,204,205,206,207,208,209],
 'civil':[34,35,36,224,225,226,227,228,229,464,465,476], 'marriage':[37], 'penalty':[44,219],
 'compensation':[45,222,223],'review':[220,221], 'public-servant':[113,213,214,215],
 'staff':[114,115,116,118,216,217],'assessment':[112], 'labor':[231,232],
 'documents':[66,67,68], 'gni':[58], 'calcium':[160], 'vaccine':[333], 'cholera':[334], 'malaria':[335],
 'cpr':[337], 'food':[339], 'gold':[155], 'polar':[248], 'twelfth':[451],
}.items():
 for index in indexes: BY_INDEX[index]=AUTH[key]


def apply_full_coverage(study):
    baseline=json.loads((SRC/'coverage-targets.json').read_text())
    points={p['id']:p for p in study['knowledge']}
    rows=[]
    for line in (SRC/'coverage-facts.txt').read_text().splitlines():
        if not line or line.startswith('#'): continue
        index, topic, true, false=line.split('|'); index=int(index)
        p=points[baseline[index]['id']]
        assert true != false and len(true)>=8 and len(false)>=8
        p.setdefault('originalStatement',baseline[index].get('originalStatement',baseline[index]['statement']))
        p['statement']=true+'。'
        p['title']=TITLES.get(index,p['title'])
        p['module']=MOVES.get(index,p['module'])
        p['status']='ready';p.pop('reviewReason',None)
        p['checkedAt']='2026-10-06'
        p['group']=topic
        p['coverageAuthored']=True
        p['reasoning']='辨析时注意：'+false+'，这一说法不成立。应记为：'+true+'。'
        if index in BY_INDEX:
            p['authority']=BY_INDEX[index]
            p['correction']='已补全原资料上下文，并按链接中的权威依据核对；练习使用上方整理后的表述。'
        elif baseline[index]['status']=='needs-review' or index in TITLES:
            p['correction']='已结合原资料上下文补全主体、时间或适用条件；学习和练习使用上方整理后的表述。'
        rows.append(dict(index=index,point=p,topic=topic,true=true,false=false))
    assert len(rows)==len(baseline)==502
    # There are three missing document facts: use the already curated request rule
    # as a fourth independently assessed option, instead of repeating one fact.
    request=next(p for p in study['knowledge'] if p['module']=='m08' and p['title']=='一文一事')
    rows.append(dict(index=502,point=request,topic='公文文种与办理',true='请示用于向上级请求指示或批准，原则上一文一事',false='请示可在一个文件中把多件无关联事项一并报批'))
    buckets=defaultdict(list)
    for row in rows:buckets[(row['point']['module'],row['topic'])].append(row)
    # Very short topic groups are merged within the same subject; no unrelated
    # subject is used as an obviously false distractor.
    preferred={'资本与积累':'劳动价值与货币','极地与区域常识':'中国区域与交通','抗美援朝与战争':'抗战与解放战争','史书与思想':'思想流派与文化','统一战线与外交':'革命战争与近代史','理论与实践':'现代化建设'}
    for module in sorted({m for m,t in buckets}):
        while True:
            short=sorted(key for key in buckets if key[0]==module and len(buckets[key])<4)
            if not short:break
            key=short[0]
            options=[other for other in buckets if other[0]==module and other!=key]
            if not options:raise ValueError(('not enough facts',key))
            wanted=(module,preferred.get(key[1],''))
            other=wanted if wanted in options else max(options,key=lambda x:len(buckets[x]))
            merged=buckets.pop(other)+buckets.pop(key)
            buckets[(module, other[1]+'及'+key[1])]=merged
    existing=[q for q in study['questions'] if q.get('kind')!='coverage-authored']
    new=[]
    for (module,topic),facts in sorted(buckets.items()):
        for start in range(0,len(facts),4):
            batch=facts[start:start+4]
            for row in facts:
                if len(batch)==4:break
                if row not in batch:batch.append(row)
            assert len(batch)==4 and len({r['point']['id'] for r in batch})==4, (module,topic,[r['index'] for r in batch],len(facts))
            seed='|'.join(r['point']['id'] for r in batch)
            rng=random.Random(seed); order=list(range(4));rng.shuffle(order)
            batch=[batch[i] for i in order]
            for variant in ['single','multiple']:
                digest=hashlib.sha256((seed+variant).encode()).hexdigest()[:14]
                rng=random.Random(digest)
                if variant=='single':
                    positive=rng.choice([True,False])
                    correct_index=rng.randrange(4)
                    truth=[(i==correct_index)==positive for i in range(4)]
                    prompt=f'下列关于{topic}的说法，'+('正确' if positive else '不正确')+'的是（ ）。'
                else:
                    number=rng.choices([2,3,4],weights=[65,30,5])[0]
                    correct=sorted(rng.sample(range(4),number))
                    truth=[i in correct for i in range(4)]
                    prompt=f'下列关于{topic}的说法，正确的有（ ）。'
                options=[r['true'] if truth[i] else r['false'] for i,r in enumerate(batch)]
                explanations=[('该说法正确。' if truth[i] else '该说法错误。正确表述是：')+r['true']+'。'+('易混说法：'+r['false']+'，应注意上述主体、条件或分类。' if truth[i] else '对比本项，将两种概念的条件或对应关系分开记忆。') for i,r in enumerate(batch)]
                point_ids=[r['point']['id'] for r in batch]
                q=dict(id='cov-'+digest,module=module,kind='coverage-authored',prompt=prompt,options=options,
                    explanation='逐项判断表述是否成立，再按照题干的“正确”或“不正确”作答；选项中的主体、时间、层次与适用条件都属于判断依据。',
                    optionExplanations=explanations,pointIds=point_ids,concept='coverage-'+hashlib.sha256(seed.encode()).hexdigest()[:12],
                    source=batch[0]['point']['source'],page=batch[0]['point']['page'],
                    optionRefs=[dict(source=r['point']['source'],page=r['point']['page']) for r in batch],
                    optionAssessments=[dict(pointId=r['point']['id'],optionIndex=i,statementIsTrue=truth[i],verifiedStatement=r['true']) for i,r in enumerate(batch)],
                    extraRefs=[dict(source=r['point']['source'],page=r['point']['page']) for r in batch[1:]],
                    extension='同主题对照：'+'；'.join(r['true'] for r in batch)+'。复习方法：闭卷说明每一项的判断依据，再结合下方专题框架比较相近概念。')
                if variant=='single':q['answer']=correct_index
                else:q['answers']=correct;q['answer']=correct[0]
                authority=next((r['point'].get('authority') for r in batch if r['point'].get('authority')),None)
                if authority:q['authority']=authority
                q['revision']='coverage-'+hashlib.sha256(json.dumps([prompt,options,q.get('answers',q['answer'])],ensure_ascii=False).encode()).hexdigest()[:12]
                new.append(q)
    study['questions']=existing+new
    for p in points.values():p['questionIds']=[]
    for q in study['questions']:
        for pid in q['pointIds']:
            assert pid in points
            points[pid]['questionIds'].append(q['id'])
    assert all(p['questionIds'] for p in points.values())
    for p in points.values():
        if p['questionIds']:p['status']='ready';p.pop('reviewReason',None)
    study['coverage'].update(points=len(points),withQuestions=len(points),questions=len(study['questions']),
        multipleQuestions=sum(bool(q.get('answers')) for q in study['questions']),pendingReview=0,pendingQuestions=0,
        addedCoveragePoints=len(baseline),addedCoverageQuestions=len(new),coverageBasis='已整理知识点')
    study['coverageAudit']=dict(checkedAt='2026-10-06',basis='网站已整理知识点；不将未提炼的PDF全文计入已覆盖',
        missingPointIds=[],addedQuestionIds=[q['id'] for q in new],
        byModule=[dict(module=m['id'],points=sum(p['module']==m['id'] for p in points.values()),withQuestions=sum(p['module']==m['id'] and bool(p['questionIds']) for p in points.values()),questions=sum(q['module']==m['id'] for q in study['questions'])) for m in study['modules']])
    return new

if __name__=='__main__':
    path=SRC/'learning.json';study=json.loads(path.read_text())
    new=apply_full_coverage(study)
    path.write_text(json.dumps(study,ensure_ascii=False,separators=(',',':')))
    report=SRC.parent/'qa/full-coverage-report.json'
    report.write_text(json.dumps(study['coverageAudit']|dict(coverage=study['coverage'],multipleAnswerCounts=dict(Counter(len(q['answers']) for q in new if q.get('answers')))),ensure_ascii=False,indent=2))
    print(json.dumps(study['coverage'],ensure_ascii=False))
