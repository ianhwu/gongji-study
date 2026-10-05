"""Generate two offline reading editions without changing the supplied PDFs."""
import sys,json,re,shutil
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from reading_edition import compile_editions
font=Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
if not font.exists():raise SystemExit('Set up an embeddable CJK font before regenerating offline editions.')
pdfmetrics.registerFont(TTFont('StudyCJK',str(font)))
INK=colors.HexColor('#253247');BLUE=colors.HexColor('#315d83');GRAY=colors.HexColor('#6b7888')
styles={
 'body':ParagraphStyle('body',fontName='StudyCJK',fontSize=10.5,leading=18,textColor=INK,spaceAfter=7,wordWrap='CJK'),
 'small':ParagraphStyle('small',fontName='StudyCJK',fontSize=8.5,leading=14,textColor=GRAY,spaceAfter=7,wordWrap='CJK'),
 'h1':ParagraphStyle('h1',fontName='StudyCJK',fontSize=23,leading=34,textColor=INK,spaceAfter=18,wordWrap='CJK'),
 'h2':ParagraphStyle('h2',fontName='StudyCJK',fontSize=14,leading=23,textColor=BLUE,spaceBefore=12,spaceAfter=9,keepWithNext=True,wordWrap='CJK'),
 'h3':ParagraphStyle('h3',fontName='StudyCJK',fontSize=11.5,leading=20,textColor=BLUE,spaceBefore=12,spaceAfter=8,keepWithNext=True,wordWrap='CJK'),
 'callout':ParagraphStyle('callout',fontName='StudyCJK',fontSize=11,leading=20,textColor=colors.HexColor('#365c61'),backColor=colors.HexColor('#eef4f2'),borderPadding=12,spaceBefore=8,spaceAfter=18,wordWrap='CJK'),
 'item':ParagraphStyle('item',fontName='StudyCJK',fontSize=10.5,leading=18,textColor=INK,leftIndent=10,spaceAfter=7,wordWrap='CJK'),
 'cell':ParagraphStyle('cell',fontName='StudyCJK',fontSize=9,leading=15,textColor=INK,wordWrap='CJK'),
 'toc':ParagraphStyle('toc',fontName='StudyCJK',fontSize=10.5,leading=20,textColor=INK,leftIndent=0,rightIndent=24,spaceBefore=3,wordWrap='CJK'),
}
def p(text,style='body'):
 return Paragraph(escape(str(text)).replace('\n','<br/>'),styles[style])
class ReadingDoc(BaseDocTemplate):
 def __init__(self,path,title):
  super().__init__(str(path),pagesize=A4,leftMargin=46,rightMargin=46,topMargin=49,bottomMargin=44,title=title,author='公基学习台')
  self.bookTitle=title;self.currentChapter='学习导读';self.bookmarks=set()
  self.addPageTemplates(PageTemplate(id='Reading',frames=[Frame(46,44,A4[0]-92,A4[1]-93,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=self.decorate))
 def decorate(self,c,doc):
  c.saveState();c.setFont('StudyCJK',8);c.setFillColor(GRAY);c.drawString(46,A4[1]-29,self.bookTitle);c.drawRightString(A4[0]-46,A4[1]-29,'公基学习台 · 学习版');c.setStrokeColor(colors.HexColor('#dce3e9'));c.line(46,A4[1]-35,A4[0]-46,A4[1]-35);c.drawString(46,25,'正文依据原资料提取文字重排；原 PDF 页码另行标注');c.drawRightString(A4[0]-46,25,str(doc.page));c.restoreState()
 def afterFlowable(self,flowable):
  if isinstance(flowable,Paragraph) and hasattr(flowable,'chapterKey'):
   key=flowable.chapterKey;text=flowable.getPlainText();self.canv.bookmarkPage(key)
   self.notify('TOCEntry',(0,text,self.page,key))
   self.canv.addOutlineEntry(text,key,0,False)
study=json.loads((ROOT/'src/learning.json').read_text());data=json.loads((ROOT/'src/active-data.json').read_text());guides,editions=compile_editions(study,data)
output=ROOT/'output/pdf';output.mkdir(parents=True,exist_ok=True);web=ROOT/'public/downloads';web.mkdir(exist_ok=True)
for source,label in [('top','上册'),('bottom','下册')]:
 chapters=[c for c in study['curriculum'] if c['source']==source];rows={r['p']:r['blocks'] for r in editions[source]};title='公基学霸笔记 · '+label+'学习版';path=output/f'公基学霸笔记-{label}-学习版.pdf';story=[]
 story.extend([Spacer(1,90),p(title,'h1'),p('章节导读 / 知识正文 / 易混对照 / 主动回忆','h2'),Spacer(1,22),p(f'{len(chapters)} 个章节，按主题自由阅读，不按天安排。'),p('学习顺序：先读导读并带着问题进入正文；遇到相近概念做对照；合上资料口头复述，再查缺补漏。'),Spacer(1,24),p('版本说明','h2'),p('依据用户提供的《公基学霸笔记》2023年版上下册整理。导读、易混提醒、情境与部分对照表由公基学习台编写。正文保留纳入范围的学习内容，清理页眉、宣传信息与页脚，重排为可阅读段落。'),p('复杂表格、框架图的文字顺序及个别字符仍可能有识别误差，本版尚未逐字校勘，不能替代原 PDF 的图表关系。法律与政策中的期限、金额和程序需核对现行规定。下册山东省情专题未纳入。','small'),p('网站：gongji-study-2026.ianhwu.chatgpt.site','small'),PageBreak(),p('章节目录','h1')])
 toc=TableOfContents();toc.levelStyles=[styles['toc']];toc.dotsMinLevel=0;story.extend([toc,PageBreak()])
 for i,c in enumerate(chapters,1):
  h=p(f'{i:02d}  {c["title"]}','h1');h.chapterKey=c['id'];story.extend([h,p(f'原 PDF 第 {c["start"]}-{c["end"]} 页 · 以下正文中的页码均按原文件页序','small')]);g=guides[c['id']]
  story.extend([p(g['thesis'],'callout'),p('怎么读这一章','h2'),p(g['route']),p('容易混淆','h2'),p(g['trap'])])
  if g.get('table'):
   t=g['table'];story.append(p(t['title'],'h2'));cells=[[p(x,'cell') for x in row] for row in [t['headers']]+t['rows']];table=Table(cells,colWidths=[(A4[0]-92)/len(t['headers'])]*len(t['headers']),repeatRows=1,hAlign='LEFT');table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eaf0f3')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#dce3e9')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));story.extend([table,Spacer(1,10)])
   if t.get('sourceTitle'):story.append(p('依据：'+t['sourceTitle'],'small'))
  if g.get('case'):story.extend([p('用一个情境想清楚','h2'),p(g['case'][0]),p('推导：'+g['case'][1])])
  story.extend([p('带着问题阅读','h2'),p(g['recall']),p('下面进入本章正文。先回答问题，再回看相应知识。','small'),Spacer(1,12)])
  for number in range(c['start'],c['end']+1):
   story.append(p(f'正文 · 原 PDF 第 {number} 页','h3'))
   blocks=rows.get(number,[])
   if not blocks:story.append(p('本页无可读文字，请核对原 PDF。','small'))
   short=[]
   def flush():
    if short:story.append(p(' / '.join(short),'small'));short.clear()
   for b in blocks:
    if b['type']=='paragraph' and len(b['text'])<=13 and not re.search('[。；：:]$',b['text']):short.append(b['text']);continue
    flush();story.append(p(b['text'],'h3' if b['type']=='heading' else 'item' if b['type']=='item' else 'body'))
   flush()
  story.extend([p('合上资料自测','h2'),p(g['recall']),p('检查：能否说清概念、条件和一个例子？能否指出与相邻概念的区别？','small')])
  if i<len(chapters):story.append(PageBreak())
 doc=ReadingDoc(path,title);doc.multiBuild(story);shutil.copyfile(path,web/f'{source}-study.pdf');print(json.dumps({'source':source,'file':str(path),'bytes':path.stat().st_size},ensure_ascii=False),flush=True)
