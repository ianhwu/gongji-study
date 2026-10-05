"""Turn reviewed statements into complete, source-traceable exam stems and parallel choices.
Unresolved OCR fragments remain references and are excluded from practice.
"""
import hashlib,re
from exam_presets import PRESETS
ALIASES={
 '法的概念法':'法','法人定义法人':'法人','物权概述概念物权':'物权','留置权':'留置权',
 '二审的审判组织裁定':'裁定','法律制裁可':'法律制裁','法的遵守（守法）的主体':'守法主体',
 '元代':'元代','世界观':'世界观','“实事”就':'“实事求是”中的“实事”','实事求':'实事求是','“另起炉灶”就':'“另起炉灶”',
 '港澳强军目标':'强军目标','贯穿其中的一个基本点就':'从中国国情出发',
 '我国最大的实际就':'我国基本国情','人民代表大会制度的实质就':'人民代表大会制度的实质',
 '发展邓小平理论的历史地位':'邓小平理论的历史地位','始终做到“三个代表”':'“三个代表”的地位',
 '发展必须':'新发展理念','政治安全的核心':'政治安全','中国共产党的中心任务就':'中国共产党的中心任务',
 '“小康”讲的':'小康','社会优抚与安置':'社会优抚与安置','“五章”':'外交和平共处五项原则',
 '需求的价格弹性（价格弹性）衡量的':'需求价格弹性','恩格尔系数表示的':'恩格尔系数',
 '经济全球化的':'经济全球化的力量','晕轮效应（光环效应）本质上':'晕轮效应','判断控制工作':'控制工作有效性',
 '首长':'首长负责制','古代五音指的':'古代五音','“嵇琴绝响”说的':'“嵇琴绝响”',
 '“后庭花”指的':'《玉树后庭花》','“不为五斗米折腰”最早':'“不为五斗米折腰”',
 '彼特拉克被认为':'彼特拉克','《庄子》被人':'《庄子》','宋徽宗赵佶也':'赵佶的书法',
 '中国古代将哈雷彗星':'哈雷彗星的古代称谓','蓝色彗尾就':'离子尾','光纤通信光纤通信就':'光纤通信',
 '硬水和软水硬水':'硬水','染色质和染色体就':'染色质与染色体','导热、导电性最好的就':'银的导热导电性',
 '台风和飓风台风':'台风','阳关甘肃省敦煌市阳关':'阳关','“关中”古时':'关中',
 '全球划':'全球时区','全球岩石圈可划':'岩石圈板块划分','地震按其成因可':'地震成因分类',
 '字长总':'计算机字长','固态转化为气态并吸热的过程':'升华','气态转化为固态并放热的过程':'凝华',
 '气态转化为液态并放热的过程':'液化','液态转化为气态并吸热的过程':'汽化',
 '啤酒上标注的度数指的':'啤酒度数','“真金不怕火炼”':'金的化学稳定性',
}
# These records cannot support a determinate answer without restoring their omitted context
# or correcting a substantive issue. Do not teach their text as a verified conclusion.
BLOCK_TITLES=set('民主|⑪依照法律规定|法律责任的归责原则|人民主权|夫妻双方因|未成年人的父母|法定遗嘱的形式|玩忽职守罪滥用职权主观上|被告人|e.|若复议机关的复议|原处分|行政征收|对复议|劳动者可立即解除合同的情形|无论|主题回答和解决的|历史地位|富裕不一定|完善党委领导、政府|邻里互助重要的|a.曲线的形状通常|分三个等级|中国GNP|老实人|纵轴|按用于编制政府预算|采用间接标价法的|前身|适用范围侧重点|第二种|机关|一类|项目|下级行政|考核结果|定期考核的结果|自处分|开除其他人员处分|由事业单位|职责人员|对复核结果不服自接到复核|被后人尊|此战役|中心思想|参加作战的中国军队|被闻一多|盛唐“天上”|“海”|认为“道”|被认为||俄罗斯|华沙条约组织建立|涉及的化学变化|水垢|补钙的最佳时间|五味药|鳄鱼流泪的原因|生物质能|它与太阳的平均距离|将全球地壳划|核心|地热能最多|太阳能最多|海拔最高的|肺动脉中流的|接种疫苗|霍乱|疟疾|晕车|心肺复苏|绿色食品标准|千足金|攀登计划|火炬计划|我国南极科考站|我国北极科考站|中国的卫星发射中心|全球四大导航系统|导弹按射程从近到远可'.split('|'))
BLOCK_TITLES.update(('元代','《太初历》','法律关系的主体'))
BLOCK_TEXT=re.compile(r'印度洋板块|生长激素.*催|战略支援部队|秘书长|急救|补钙|治疗|恢复心跳|复苏|\bGNP\b|夸克.*最小|玉米.*面积最大')
MOVE={'行政效率':'m09','行政决策':'m09','行政外部监督':'m09','社会监督':'m09','商品':'m07','价值':'m07','劳动二重性学说':'m07','价值尺度':'m07','剩余价值':'m07','家庭':'m06','礼仪礼节':'m06','绿色发展、生态道德':'m06','社会主义核心价值观':'m06','海水富营养化':'m12','垃圾可':'m12','可持续发展战略':'m12','低碳生活':'m12','《京都议定书》目标':'m12','《巴黎协定》':'m12','霍桑效应':'m09'}
REVIEW_REASON='原资料片段存在缺句、串行、表述歧义或需核对现行依据，暂不作为练习标准答案。'
def review(p,reason=REVIEW_REASON):
 p['originalStatement']=p.get('originalStatement',p['statement']);p['status']='needs-review';p['reviewReason']=reason;p['questionIds']=[x for x in p['questionIds'] if not x.startswith('k-')]
 p['statement']=reason+' 可打开原资料页查看上下文。'

def normalized(p):
 original=p['title'];title=ALIASES.get(original,original)
 title=re.sub(r'^[✱•⑪]+','',title)
 title=re.sub(r'(?:指的|表示的|最先|古时|在古代|又|回答的|可)$','',title)
 if original in BLOCK_TITLES or BLOCK_TEXT.search(p['statement']):return None
 if re.search(r'之[上下内外]$|分别$|^分子永不',title) and original not in PRESETS:return None
 if not title or len(title)>30 or re.search(r'^[e-z][.．]|^\d|[�✱]|^被|^它|^此|^一类|^第二',title):return None
 if original in MOVE:p['module']=MOVE[original]
 # These transparent heading repairs do not alter the statement's factual content.
 statement=p['statement'].replace(original,title,1).replace('是用与居民生活有关','是与居民生活有关')
 if original=='世界观':statement='世界观是人们对整个世界的总的看法和根本观点。'
 if original=='贯穿其中的一个基本点就':statement='从中国国情出发，要求分析和解决中国问题时立足中国的实际。'
 if title in ('升华','凝华','汽化','液化'):
  transitions={'升华':'固态直接转化为气态，吸热','凝华':'气态直接转化为固态，放热','汽化':'液态转化为气态，吸热','液化':'气态转化为液态，放热'}
  statement=title+'是物质'+transitions[title]+'的过程。'
 p['title']=title;p['statement']=statement
 if title in PRESETS or original in PRESETS:return dict(point=p,title=title,body='',relation='preset',category='preset')
 remainder=statement[len(title):] if statement.startswith(title) else statement
 match=re.match(r'(?:是指|就是|是|指的是|指|属于|包括|分为|由|称为|被称为|决定|负责)',remainder)
 if not match:return None
 relation=match.group();
 if relation in ('决定','负责'):return None
 body=remainder[match.end():].strip('：:，。 ')
 if relation=='由':body='由'+body
 body=re.split(r'[✱]|注意[：:]|第[一二三四]，',body)[0].rstrip('。；; ')
 if re.match(r'^(并|其中|和|着|否|导党|人民，|核心[，,]|灵魂[，,]|保证[，,]|是|就)',body):return None
 if len(body)>180 or len(body)<4 or re.search(r'^[是就指为]|^对本|^补充|[✱�]|^\d+[.．]',body):return None
 return dict(point=p,title=title,body=body,relation=relation,category='composition' if relation in ('包括','分为','由') else 'definition')

def similarity(a,b):
 # Prefer nearby source context and same relationship, then overlap in terminology.
 pa,pb=a['point'],b['point'];ca=set(a['title']+a['body']);cb=set(b['title']+b['body'])
 overlap=len(ca&cb)/max(1,len(ca|cb))
 return 3*bool(set(pa['chapters'])&set(pb['chapters']))+2*(a['category']==b['category'])+overlap-abs(len(a['body'])-len(b['body']))/250

def conflict(a,b):
 # Avoid synonymous answers, duplicate concepts, containing definitions and shared main clauses.
 if a['title']==b['title'] or a['title'] in b['title'] or b['title'] in a['title']:return True
 if a['title'] in b['body'] or b['title'] in a['body']:return True
 x,y=a['body'],b['body']
 if x in y or y in x:return True
 if x.split('，')[0]==y.split('，')[0]:return True
 ca,cb=set(x),set(y)
 return len(ca&cb)/max(1,len(ca|cb))>.65

def family(a):
 title,body,module=a['title'],a['body'],a['point']['module']
 if module=='m04':return 'philosophy'
 if module in ('m07','m08','m09'):return module
 if module in ('m01','m02','m03'):return module+'-'+a['category']
 if module in ('m05','m06'):return module+'-'+a['category']
 if re.search(r'楚辞|汉赋|乐府|诗经',title):return 'literary-forms'
 if '《' in title:
  if re.search(r'民歌|歌曲|歌舞',body):return 'songs'
  if re.search(r'史作|史著|史书|文献|历书|通史|断代史',body):return 'historical-works'
  return 'literary-works'
 if re.search(r'作家|小说家|诗人|戏剧家|赋家',body):return 'authors'
 if re.search(r'战役|战争|起义|革命|运动|会议|事变|大捷|惨案',title):return 'events'
 if re.search(r'制|法|田|税|选官|天朝|分封|三省|六部',title):return 'historical-institutions'
 if re.search(r'节$',title) or re.search(r'^农历',title):return 'festivals'
 if module=='m12':
  if re.search(r'星|太阳|月球|天文|黄赤|黄道|地球公转|地球自转',title):return 'astronomy'
  if re.search(r'山|河|湖|盆地|平原|海洋|海峡|岛|关中|新疆|内蒙古|省|洲|江|岭',title):return 'geography'
  if re.search(r'软件|计算机|电脑|字长|病毒|信息技术|云计算|人工智能|网络|光纤',title):return 'computing'
  if re.search(r'基因|细胞|染色|细菌|DNA|RNA|乳酸|生物|脊髓|血|营养',title):return 'biology'
  if re.search(r'酸|盐|碱|钠|氧|氢|氮|金|银|铜|甲烷|乙烷|乙醇|石墨|金刚石|可燃冰',title):return 'chemistry'
  if re.search(r'光|折射|反射|运动|惯性|热|力|电|压强|声音|波|振动',title):return 'physics'
 return ''

def formal_question(p,records,guides):
 a=next((a for a in records if a['point']['id']==p['id']),None)
 if not a:return None
 preset=PRESETS.get(a['title']) or PRESETS.get(p.get('originalTitle',p['title']))
 if preset:
  prompt,options,notes,extension=preset
  q=dict(id='k-'+p['id'],concept=p['id'],pointIds=[p['id']],module=p['module'],source=p['source'],page=p['page'],prompt=prompt,options=options,answer=0,explanation=notes[0],optionExplanations=notes,optionRefs=[dict(source=p['source'],page=p['page']) for _ in options],extension=extension,kind='authored-exam')
  if p.get('authority'):q['authority']=p['authority']
  if a['title']=='最高人民检察院对全国人大及其常委会':q['authority']='https://www.npc.gov.cn/c2/c30834/201905/t20190521_281393.html'
  return q
 pool=[b for b in records if b['category']!='preset' and family(a) and family(a)==family(b) and b['point']['module']==p['module'] and b['category']==a['category'] and set(p['chapters'])&set(b['point']['chapters']) and not conflict(a,b) and len(set(a['body'])&set(b['body']))/max(1,len(set(a['body'])|set(b['body'])))>=.10]
 chosen=[]
 for b in sorted(pool,key=lambda b:(-similarity(a,b),b['point']['id'])):
  if any(conflict(b,c) for c in chosen):continue
  chosen.append(b)
  if len(chosen)==3:break
 if len(chosen)!=3:return None
 title=a['title'];relation=a['relation'];body=a['body']
 if relation in ('包括','分为','由'):prompt=f'关于{title}，下列表述正确的是（ ）。'
 else:prompt=f'关于{title.strip(chr(8220)+chr(8221))}，下列表述正确的是（ ）。'
 rows=[a]+chosen
 options=[title+(('由'+b['body'].removeprefix('由')) if relation=='由' else relation+b['body'])+'。' for b in rows]
 notes=[f'本项正确。{p["statement"]}']+[f'本项不符合题意。这一描述实际针对“{b["title"]}”：{b["point"]["statement"]} 所问的是“{title}”，两者的对象或含义不同。' for b in chosen]
 q=dict(id='k-'+p['id'],concept=p['id'],pointIds=[p['id']],module=p['module'],source=p['source'],page=p['page'],prompt=prompt,options=options,answer=0,explanation=p['statement'],optionExplanations=notes,optionRefs=[dict(source=b['point']['source'],page=b['point']['page']) for b in rows],extension=guides[p['module']]['method'],kind='exam-definition')
 if p.get('authority'):q['authority']=p['authority'];q['extension']=p.get('correction','')+' '+q['extension']
 return q

def apply_exam_questions(study):
 base=[p for p in study['knowledge'] if not p.get('application') and p['module']!='m14']
 records=[]
 for p in base:
  p['questionIds']=[x for x in p['questionIds'] if not x.startswith('k-')]
  p['originalTitle']=p['title']
  rec=normalized(p)
  if rec:records.append(rec)
  elif p['originalTitle'] in BLOCK_TITLES or BLOCK_TEXT.search(p['statement']):review(p)
  else:p['status']='needs-question';p['reviewReason']='尚未编成题干完整、答案唯一的练习，当前保留课程与资料入口。'
 questions=[];by_revision={}
 for p in base:
  if p.get('status')=='needs-review':continue
  q=formal_question(p,records,study['guides'])
  if not q:
   if not p['questionIds']:p['status']='needs-question';p['reviewReason']='尚未编成题干完整、答案唯一的练习，当前保留课程与资料入口。'
   continue
  q['revision']=hashlib.sha256((q['prompt']+'\n'+'\n'.join(q['options'])).encode()).hexdigest()[:16]
  if q['revision'] in by_revision:
   canonical=by_revision[q['revision']];canonical['pointIds'].append(p['id']);p['questionIds'].insert(0,canonical['id'])
  else:
   by_revision[q['revision']]=q;p['questionIds'].insert(0,q['id']);questions.append(q)
  p.pop('status',None);p.pop('reviewReason',None)
 study['questions']=[q for q in study['questions'] if not q['id'].startswith('k-')]+questions
 # Link retained authored questions as well as the rewritten item.
 for p in study['knowledge']:
  p['questionIds']=list(dict.fromkeys(p['questionIds']+[q['id'] for q in study['questions'] if p['id'] in q.get('pointIds',[])]))
  if p['questionIds'] and p.get('status')=='needs-question':p.pop('status',None);p.pop('reviewReason',None)
 study['coverage'].update(questions=len(study['questions']),withQuestions=sum(bool(p.get('questionIds')) for p in study['knowledge']),pendingReview=sum(p.get('status')=='needs-review' for p in study['knowledge']),pendingQuestions=sum(not p['questionIds'] and p.get('status')!='needs-review' for p in study['knowledge']),rewrittenQuestions=len(questions))
 return questions
