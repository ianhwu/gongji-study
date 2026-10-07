"""Reviewed teaching overlays. Keep original PDFs and historical question versions intact."""
import copy
import hashlib
import json
from pathlib import Path

TITLES = {
 'point-d36cea56d5008a':'人民币上的五种文字',
 'point-4bb9f06a3d1037':'特别行政区设立及制度的决定权',
 'point-702c3d26c80085':'全国或省级紧急状态决定权',
 'point-feae43efcccbb5':'条约和重要协定批准与废除的决定权',
 'point-5d12f66ad630d5':'国家主席的条约职权',
 'point-5f1055a3d0b71c':'国家勋章与荣誉称号授予',
 'point-61a5d665848bf9':'省级部分地区紧急状态决定权',
 'point-0396db75415eb4':'行政处罚程序',
 'point-5530fde0d85308':'劳动法调整对象',
 'point-e93495f9330f2d':'原子弹与氢弹的核反应',
 'point-abdc56227f989f':'张仲景与《伤寒杂病论》',
}
CORRECTIONS = {
 'point-87ac20c0c281a9':dict(title='哈雷彗星的运行周期与回归',statement='哈雷彗星的平均回归周期约76年，实际周期会变化；上一次回归是1986年，预计下一次回归为2061年。',reasoning='约76年是平均值，不能用1986加76机械推断下一次回归。记忆时分开写：平均周期、上次回归、预计下次回归。',authority='https://science.nasa.gov/solar-system/comets/1p-halley/',correction='原讲义“下一次约2062年”不准确，按 NASA 的2061年预测整理。'),
 'point-183b99fc2d2398':dict(title='社会保险',statement='我国建立基本养老、基本医疗、工伤、失业和生育等社会保险制度，保障公民在年老、疾病、工伤、失业、生育等情况下依法获得物质帮助的权利。',reasoning='社会保险不只覆盖建立劳动关系的职工，基本养老、基本医疗也有面向城乡居民的制度。保险强调依法参保与待遇；社会救助侧重困难群体的基本生活保障，福利与优抚则有不同的对象和目标。',authority='https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_e81d115419b4463ebb59ec46467fb136.html',correction='补全《社会保险法》第二条的五类保险、五类风险；原摘要的对象和风险范围过窄。'),
 'point-b0f0abc094aae9':dict(title='行政许可的注销',statement='行政许可有效期届满未延续、特定资格许可的公民死亡或丧失行为能力、法人或其他组织依法终止、许可被依法撤销或撤回、许可证件被依法吊销等法定情形发生时，行政机关依法办理有关许可的注销手续。',reasoning='按四个触发条件对照：撤销通常针对违法作出的许可；撤回针对合法许可因法律依据或客观情况变化而为公共利益收回；吊销许可证件是行政处罚；注销是许可终止后的手续，不能把四者当成同义词。不可抗力使许可事项无法实施，以及法律法规规定的其他情形，也属法定注销情形。',authority='https://www.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_qtxgfl/202110/t20211029_575972.html',correction='修复“注销许”残字，并按《行政许可法》第六十九、七十条补全注销与撤销等概念的边界。'),
}
LEGAL_PERSON = dict(statement='法人是具有民事权利能力和民事行为能力，依法独立享有民事权利并承担民事义务的组织。',reasoning='法人是组织，法定代表人是依法代表法人从事民事活动的自然人，两者不能混用。法人的民事权利能力和民事行为能力从法人成立时产生，到法人终止时消灭。',authority='https://www.court.gov.cn/zixun/xiangqing/233181.html',correction='按《民法典》第五十七、五十九条补全定义及能力起止。')
for pid in ('point-39598632bd971c','point-ece536ac76e9d3'):
 CORRECTIONS[pid]=dict(title='法人',**LEGAL_PERSON)

# Authored replacements remove malformed unrelated distractors from these items.
PRESETS = {
 'k-point-87ac20c0c281a9':('哈雷彗星上一次于1986年回归。根据 NASA 的轨道预测，其下一次回归的年份是（ ）。',
  ['2061年','2062年','2060年','2064年'],[
  'NASA列出的下次预计回归年份为2061年。约76年是平均周期，实际周期会变化。',
  '这是把1986机械加76得到的年份。平均周期不能替代具体轨道预测，正确年份为2061年。',
  '2060年与预测年份相近，但不是 NASA 给出的下一次回归年份；记忆应保留2061这一时间锚点。',
  '2064年不是本次轨道预测年份，不能只凭“七十多年后”的模糊印象确定具体年份。']),
 'k-point-b0f0abc094aae9':('某企业的行政许可有效期届满，且未申请延续。行政机关依法办理许可终止的相关手续，属于（ ）。',
  ['行政许可的注销','行政许可的撤销','行政许可的撤回','行政处罚中的吊销许可证件'],[
  '有效期届满未延续，是《行政许可法》第七十条列举的注销情形；注销是办理许可终止手续。',
  '撤销通常处理违法作出的许可决定，例如越权或违反法定程序；本题未给出原许可违法的事实。',
  '撤回针对合法许可因依据或客观情况重大变化，为公共利益而收回；本题是届满未延续。',
  '吊销许可证件是行政处罚，需要违法事实及处罚依据，不能用普通届满替代。']),
 'k-point-183b99fc2d2398':('依据《社会保险法》，下列对我国社会保险制度的理解正确的是（ ）。',[
  '包括基本养老、基本医疗、工伤、失业和生育等保险，依法保障相应风险下的物质帮助',
  '城乡居民未与用人单位建立劳动关系，因而不能参加任何基本养老或基本医疗保险',
  '养老保险的待遇资格完全取决于家庭是否低于最低生活保障标准',
  '五类社会保险都只针对丧失劳动能力这一种风险'],[
  '《社会保险法》第二条列出五类制度，覆盖年老、疾病、工伤、失业、生育等情形。',
  '基本养老和基本医疗有居民制度，不能把全部社会保险的对象限于职工。',
  '养老保险以依法参保、缴费与法定待遇条件等为依据；最低生活保障属于社会救助，不能混用资格标准。',
  '制度覆盖五类风险，例如失业与生育不能一律归为丧失劳动能力。']),
 'k-point-ece536ac76e9d3':('依据《民法典》，关于法人及其法定代表人，下列表述正确的是（ ）。',[
  '法人是依法独立享有民事权利并承担民事义务，具有民事权利能力和民事行为能力的组织',
  '法人是代表公司签字的自然人，法定代表人则是公司本身',
  '法人的民事权利能力在筹建活动开始时产生，民事行为能力在法人成立时产生',
  '法人终止时只丧失民事行为能力，其民事权利能力继续存在'],[
  '第五十七条完整定义包含两种能力、独立权利义务以及组织属性。',
  '两者身份颠倒：法人是组织，法定代表人是依法代表法人从事民事活动的自然人。',
  '第五十九条规定两种能力都从法人成立时产生，不能将筹建活动与成立时间混同。',
  '两种能力到法人终止时一并消灭，不能只终止其中一种；终止后的责任处理另按法律规定判断。']),
 'k-point-50d42bec64e031':('我国首次火星探测任务中，探测器与火星车名称的对应关系正确的是（ ）。',
  ['天问一号—祝融号','天问一号—玉兔号','嫦娥三号—祝融号','嫦娥四号—玉兔二号'],[
  '天问一号执行我国首次火星探测任务，祝融号是该任务的火星车。',
  '探测器名称正确，但玉兔号是嫦娥三号任务的月球车，不是火星车。',
  '祝融号名称正确，但所属任务是天问一号；嫦娥三号是探月任务。',
  '该组合确属探月任务的对应关系，但题目问的是首次火星探测任务，不能仅凭组合熟悉就选。']),
}

def apply_review(study):
 points={p['id']:p for p in study['knowledge']}
 changes=[]
 replacements={}
 replacements['法人是依法独立享有民事权利并承担民事义务的组织']=LEGAL_PERSON['statement']
 replacements['法人是依法独立享有民事权利并承担民事义务的组织。']=LEGAL_PERSON['statement']
 for pid, values in CORRECTIONS.items():
  p=points[pid]
  old=p['statement'];new=values['statement']
  # Original statement remains independently inspectable.
  if old!=new:replacements[old]=new
  p.setdefault('originalStatement',old)
  p.update(values,checkedAt='2026-10-07')
  changes.append(dict(pointId=pid,source=p['source'],page=p['page'],**values))
 for pid,title in TITLES.items():points[pid]['title']=title
 points['mark-point-085-2']['title']=points['mark-point-085-2']['title'].replace('神州九号','神舟九号')
 for q in study['questions']:
  before=copy.deepcopy(q)
  def replace(text):
   for a,b in sorted(replacements.items(),key=lambda pair:-len(pair[0])):text=text.replace(a,b)
   return text.replace('注销许','行政许可的注销')
  # Replace outdated positive explanations. Preserve historical versions separately.
  for field in ('explanation','extension','prompt'):
   if field in q:q[field]=replace(q[field])
  for field in ('options','optionExplanations'):
   q[field]=[replace(x) for x in q[field]]
  for assessment in q.get('optionAssessments',[]):
   assessment['verifiedStatement']=replace(assessment['verifiedStatement'])
  if q['id'] in PRESETS:
   prompt,options,notes=PRESETS[q['id']]
   p=points[q['pointIds'][0]]
   q.update(prompt=prompt,options=options,optionExplanations=notes,answer=0,
    explanation=notes[0],extension=p.get('reasoning',p['statement']),
    optionRefs=[dict(source=p['source'],page=p['page']) for _ in range(4)])
   if p.get('authority'):q['authority']=p['authority']
  if before!=q:
   payload={k:v for k,v in q.items() if k!='revision'}
   q['revision']='review-'+hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:16]
 study['contentCorrections']=changes
 return study

if __name__=='__main__':
 root=Path(__file__).parent
 study=json.loads((root/'learning.json').read_text())
 before={q['id']:copy.deepcopy(q) for q in study['questions']}
 from grouped_concepts import apply_grouped
 apply_grouped(study)
 apply_review(study)
 history=json.loads((root/'question-history.json').read_text())
 known={(q['id'],q.get('revision')) for q in history}
 changed=[]
 for q in study['questions']:
  old=before[q['id']]
  if old!=q:
   changed.append(q['id'])
   if (old['id'],old.get('revision')) not in known:history.append(old)
 (root/'learning.json').write_text(json.dumps(study,ensure_ascii=False,indent=2)+'\n')
 (root/'question-history.json').write_text(json.dumps(history,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps(dict(correctedPoints=len(CORRECTIONS),renamedHeadings=len(TITLES)+1,updatedQuestions=len(changed),authoredReplacements=len(PRESETS)),ensure_ascii=False))
