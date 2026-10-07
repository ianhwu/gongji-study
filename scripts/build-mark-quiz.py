import json, hashlib, random, re
from pathlib import Path
R=Path(__file__).resolve().parents[1]
S=R/'src'
seeds=json.load(open(S/'mark-topic-seeds.json'))
core=[1,2,3,4,5,8,10,11,12,15,16,18,21,22,24,26,27,37,40,42]
doc=json.loads((R/'public/materials/mk-666be31682a8.json').read_text())
coremodules=['m04']*5+['m05']*2+['m06']*2+['m07']*3+['m09']*2+['m08']*3+['m01','m01','m03']
for n,m in zip(core,coremodules):
 u=next(u for u in doc['units'] if u['id'].endswith('-u'+str(n)))
 seeds.append(dict(doc=doc['id'],unit=u['id'],title=u['title'],module=m,blocks=u['blocks'],method=u['method'],boundary=u['boundary']))
mods={'science':'m12','geography':'m12','culture':'m11','history':'m10','politics':'m05','law':'m03','economy':'m07','management':'m09','documents':'m08','rural':'m10'}
for i,a in enumerate(seeds):
 if 'module' not in a:a['module']=mods[a['subject']]
 if i==23:a['module']='m06'
 if i==9:a['module']='m11'
 if i in [55]:a['module']='m06'
 if i in [68,39]:a['module']='m02'
 if i in [71,76]:a['module']='m01'
 # Use the exact source unit, never the broad old automatic subject match.
 full=json.loads((R/'public/materials'/ (a['doc']+'.json')).read_text())
 u=next(u for u in full['units'] if u['id']==a['unit']);a.update(method=u['method'],boundary=u['boundary'])
rows={i:[] for i in range(106)}
for line in (S/'mark-quiz-facts.txt').read_text().splitlines():
 i,anchor,true,false,note=line.split('|');rows[int(i)].append(dict(anchor=anchor,true=true,false=false,note=note))
assert all(len(v)==4 for v in rows.values())
# Replace literal or unrelated distractors with plausible near-neighbour confusion.
fixes={
 (44,2):('唐代飞钱是可在市场普遍直接购买商品的国家纸币。','飞钱主要用于异地汇兑，并非普遍流通纸币；北宋四川交子属于不同金融形态。'),
 (64,2):('雁门关位于甘肃，是著名关隘。','山西雁门关与甘肃嘉峪关都属著名关隘，按省份和长城位置区分。'),
 (69,3):('直捣黄龙在岳飞相关历史语境中指向南宋都城临安进军。','黄龙联系金国腹地，临安是南宋都城；进攻目标与己方都城不是同一地点。'),
 (79,1):('三元里抗英斗争发生于第二次鸦片战争期间。','1841年三元里抗英属第一次鸦片战争；第二次鸦片战争在1856年以后。'),
 (81,2):('秦岭四宝通常指朱鹮、大熊猫、东北虎、梅花鹿。','秦岭四宝为朱鹮、大熊猫、金丝猴、羚牛，不能混入其他地区常见珍稀动物。'),
 (86,0):('哲学的基本问题是唯物主义与辩证法的关系问题。','基本问题是思维和存在的关系；唯物与唯心、辩证与形而上学是不同哲学分类维度。'),
 (105,1):('传统四要件包括犯罪客体、客观方面、犯罪动机、犯罪目的。','主观方面包括故意过失等，不可用动机目的替代主体与整个主观方面；主体还涉及责任能力等资格。'),
}
for (i,n),(f,note) in fixes.items():rows[i][n].update(false=f,note=note)
rows[14][2]['true']=rows[14][2]['true'].replace('北半球','北半球中纬度地区')
authorities={45:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_e81d115419b4463ebb59ec46467fb136.html',76:'https://wb.flk.npc.gov.cn/flfg/PDF/e4ab62be00d1476d97f65aaa5b56c336.pdf',71:'https://www.npc.gov.cn/zgrdw/pc/13_2/2018-03/22/content_2071091.htm',104:'https://www.npc.gov.cn/zgrdw/pc/13_2/2018-03/22/content_2071091.htm',16:'https://www.mee.gov.cn/ywgz/fgbz/fl/201404/t20140425_271040.shtml',38:'https://cicc.court.gov.cn/html/1/218/62/83/443.html',41:'https://fgk.chinatax.gov.cn/zcfgk/c100009/c5193053/content.html',68:'https://www.cnipa.gov.cn/art/2021/5/27/art_2073_159683.html',75:'https://www.pbc.gov.cn/rmyh/109339/2025080818580470423/index.html',78:'https://chinajob.mohrss.gov.cn/c/2023-03-01/370681.shtml',100:'https://www.miit.gov.cn/xwdt/szyw/art/2020/art_6afb8ee6d07540dcacccbeb47dbc0fd4.html',101:'https://www.miit.gov.cn/xwdt/szyw/art/2020/art_6afb8ee6d07540dcacccbeb47dbc0fd4.html',102:'https://www.miit.gov.cn/xwdt/szyw/art/2020/art_6afb8ee6d07540dcacccbeb47dbc0fd4.html'}
source_docs={d['id']:d for d in json.loads((S/'mark-library.json').read_text())['documents']}
for i, nums in {93:[12],94:[13],97:[20]}.items():
 for n in nums:
  extra=next(u for u in doc['units'] if u['id'].endswith('-u'+str(n)))
  seeds[i]['blocks'] += [dict(b,sourceUnit=extra['id']) for b in extra['blocks']]
aliases={(47,0):'卡塔尔',(84,1):'神州九号',(89,3):'认识的发展',(91,3):'工农武装割据',(94,0):'先进生产力',(94,3):'执政为民'}
for (i,n),a in aliases.items():rows[i][n]['anchor']=a
allpoints=[];questions=[];topics=[];unmatched=[]
normalize=lambda s: re.sub(r'\s+','',s).replace('％','%').replace('·','').replace('“','').replace('”','')
for i,seed in enumerate(seeds):
 title=re.sub(r'^\d+ · ','',seed['title']);tid=f'topic-mark-{i+1:03d}'
 for n,row in enumerate(rows[i]):
  pid=f'mark-point-{i+1:03d}-{n+1}'
  block=next((b for b in seed['blocks'] if normalize(row['anchor']) in normalize(b['text'])),None)
  if not block:unmatched.append([i,n,row['anchor'],title])
  page=(block or seed['blocks'][0])['page']
  row.update(pointId=pid,page=page,source=seed['doc'],unit=(block or {}).get('sourceUnit',seed['unit']))
  p=dict(id=pid,module=seed['module'],title=title+'：'+row['anchor'],statement=row['true'],source=seed['doc'],page=page,chapters=[],questionIds=[],originalTitle=title,status='ready',reasoning=row['note'],markAuthored=True,markRef=dict(doc=seed['doc'],unit=row['unit']),checkedAt='2026-10-07')
  if i in authorities:p['authority']=authorities[i]
  if i==41 and n==3:p['authority']='https://shanxi.chinatax.gov.cn/web/detail/sx-11400-545-1751470'
  if i==75 and n==3:p['correction']='本条已更新为人民银行自2025年1月数据起启用的M1口径；原讲义所列旧口径不用于本题判分。'
  allpoints.append(p)
 diagram=[dict(label=row['anchor'],text=row['true']) for row in rows[i]]
 topics.append(dict(id=tid,module=seed['module'],title=title+' · 马克资料专题',overview='本节按'+ '、'.join(r['anchor'] for r in rows[i])+'四个线索展开。先确认完整定义和对应关系，再用相邻概念比较，避免只记关键词。',diagram=diagram,connection=' '.join(r['note'] for r in rows[i]),boundary=seed['boundary'],variant='题目会改变人物、年份、机构、分类或适用条件。逐项核对完整表述；遇到“所有”“只能”“必然”时，检查是否遗漏条件或法定例外。',recall='不看答案，按知识框架复述四项内容，再分别说明一个容易混淆的错误说法及其理由。',layout='compare',markRef=dict(doc=seed['doc'],unit=seed['unit']),keywords=[]))
 # One single and one multiple question per group; each option is independently assessed.
 # Every option has an authored distinction; truth masks are stable by ID.
 for v in [0,3]:
  rng=random.Random(f'mark:{i}:{v}');batch=rows[i].copy();rng.shuffle(batch)
  multiple=v>=3
  if multiple:
   number=2 if (i*3+v-3)%20<13 else (3 if (i*3+v-3)%20<19 else 4)
   
   correct=sorted(rng.sample(range(4),number));truth=[j in correct for j in range(4)]
   prompt=f'下列关于{title}的说法，正确的有（ ）。'
  else:
   positive=i%3!=1;correct_index=rng.randrange(4);truth=[(j==correct_index)==positive for j in range(4)]
   prompt=f'下列关于{title}的说法，'+('正确' if positive else '不正确')+'的是（ ）。'
  q=dict(id=f'mark-q-{i+1:03d}-{v+1}',module=seed['module'],kind='mark-authored',type='multiple' if multiple else 'single',prompt=prompt,options=[r['true'] if truth[j] else r['false'] for j,r in enumerate(batch)],answer=correct[0] if multiple else correct_index,pointIds=[r['pointId'] for r in batch],concept=f'mark-unit-{i+1:03d}',source=batch[0]['source'],page=batch[0]['page'],explanation='本题考查'+title+'。'+('多选题须选全符合表述的选项，漏选、错选均不算正确。' if multiple else ('题干要求选择不正确的表述；不要把成立的说法选作答案。' if not positive else '逐项核对条件及对应关系，再选择正确表述。')),optionExplanations=[('本项表述正确。知识依据：'+r['true']+'。常见干扰：'+r['false']+'。' if truth[j] else '本项表述错误。正确内容：'+r['true']+'。')+'辨析：'+r['note'] for j,r in enumerate(batch)],extension=' '.join(r['true']+' '+r['note'] for r in rows[i]),markRefs=[dict(doc=seed['doc'],unit=unit) for unit in sorted({r['unit'] for r in batch}|{seed['unit']})],optionRefs=[dict(source=r['source'],page=r['page']) for r in batch],extraRefs=[dict(source=r['source'],page=r['page']) for r in batch],optionAssessments=[dict(pointId=r['pointId'],optionIndex=j,statementIsTrue=truth[j],verifiedStatement=r['true']) for j,r in enumerate(batch)])
  if multiple:q['answers']=correct
  if i in authorities:q['authority']=authorities[i]
  if i==41:q['additionalAuthorities']=['https://shanxi.chinatax.gov.cn/web/detail/sx-11400-545-1751470','https://www.beijing.gov.cn/zhengce/zcjd/zcwd/cswhjss/index.html']
  q['revision']='mark-'+hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:16]
  questions.append(q)
# Persist to raw data for server grading; preserve IDs and versions of the old bank.
study=json.loads((S/'learning.json').read_text());study['questions']=[q for q in study['questions'] if q.get('kind')!='mark-authored']+questions;study['knowledge']=[p for p in study['knowledge'] if not p.get('markAuthored')]+allpoints
for p in allpoints:p['questionIds']=[q['id'] for q in questions if p['id'] in q['pointIds']]
study['markQuiz']={'questions':len(questions),'points':len(allpoints),'specialtyUnits':86,'coreUnits':20,'sourceDocuments':sorted({s['doc'] for s in seeds}),'unitCoverage':[{'doc':s['doc'],'unit':s['unit'],'title':re.sub(r'^\d+ · ','',s['title']),'topicId':topics[i]['id'],'questionIds':[q['id'] for q in questions if q['concept']==f'mark-unit-{i+1:03d}']} for i,s in enumerate(seeds)],'basis':'已整理并核对的86个专题及系统讲义20个基础单元；每节四项核心辨析，题目为本站自编。未声称覆盖全部原文或全部题本原题。'}
(S/'learning.json').write_text(json.dumps(study,ensure_ascii=False,indent=2)+'\n')
(S/'mark-quiz-topics.json').write_text(json.dumps(topics,ensure_ascii=False,indent=2)+'\n')
(S/'mark-quiz-facts.json').write_text(json.dumps([{'index':i,'doc':s['doc'],'unit':s['unit'],'title':s['title'],'facts':rows[i]} for i,s in enumerate(seeds)],ensure_ascii=False,indent=2)+'\n')
mp=json.loads((S/'course-topic-map.json').read_text());mp={k:v for k,v in mp.items() if not k.startswith('mark-point-')};mp.update({p['id']:f'topic-mark-{int(p["id"].split("-")[2]):03d}' for p in allpoints});(S/'course-topic-map.json').write_text(json.dumps(mp,ensure_ascii=False,indent=2)+'\n')
assert not unmatched, unmatched
print(json.dumps({'points':len(allpoints),'questions':len(questions),'units':len(seeds),'unmatchedAnchors':unmatched},ensure_ascii=False))
