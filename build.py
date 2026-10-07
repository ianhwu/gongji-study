#!/usr/bin/env python3
"""Build the private static study site from the prepared, sanitized data."""

import json
import hashlib
from pathlib import Path


ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "public"
DIST.mkdir(exist_ok=True)

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' "
    "viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' "
    "fill='%23183254'/%3E%3Cpath d='M15 17h15q4 0 4 4v27q-3-3-7-3H15zM49 17H38q-4 0-4 "
    "4v27q3-3 7-3h8z' fill='%23fff'/%3E%3Cpath d='m20 29 4 4 7-8' "
    "fill='none' stroke='%2366dfaa' stroke-width='3'/%3E%3C/svg%3E"
)


def js_literal(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


pages = json.loads((SRC / "active-data.json").read_text(encoding="utf-8"))
study = json.loads((SRC / "learning.json").read_text(encoding="utf-8"))
import sys
sys.path.insert(0,str(SRC))
from grouped_concepts import apply_grouped
apply_grouped(study)
from full_coverage import apply_full_coverage
apply_full_coverage(study)
from reading_edition import compile_editions
study["readingEdition"], editions = compile_editions(study,pages)
(DIST / "editions").mkdir(exist_ok=True)
for source, rows in editions.items():
    (DIST / "editions" / (source+".json")).write_text(json.dumps(rows,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
pdf_page_count=len(pages['pages'])
pages['sources'].append(dict(id='jilin-notes',name='吉林省情讲解',pages=len(study['regionalPages']),method='原创整理 · 官方核对',edition='2026-10-05核对',uri='study.html?module=m14',kind='study-notes'))
pages['pages']+=study['regionalPages']
study["visualReferences"] = json.loads((SRC / "visual-references.json").read_text(encoding="utf-8"))
from topic_expansions import compile_topics, write_diagrams
study["topicExpansions"], study["pointTopics"], study["questionTopics"] = compile_topics(study)
write_diagrams(study["topicExpansions"], DIST)
study["markLibrary"] = json.loads((SRC / "mark-library.json").read_text(encoding="utf-8"))
study["interviewLibrary"] = json.loads((SRC / "interview-library.json").read_text(encoding="utf-8"))
study["contentVersion"] = hashlib.sha256((js_literal(pages)+js_literal(study["readingEdition"])+js_literal(editions)+js_literal(study["markLibrary"])+js_literal(study["interviewLibrary"])).encode()).hexdigest()[:12]
(DIST / "references").mkdir(exist_ok=True)
for source in pages["sources"]:
    rows = [{"p":p["p"],"t":p["t"]} for p in pages["pages"] if p["s"]==source["id"]]
    (DIST / "references" / (source["id"]+".json")).write_text(json.dumps(rows,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
(DIST / "data.js").write_text("const KB_DATA=" + js_literal(pages) + ";\n", encoding="utf-8")
(DIST / "learning-data.js").write_text("const STUDY=" + js_literal(study) + ";\n", encoding="utf-8")

learning = (SRC / "learning-template.html").read_text(encoding="utf-8")
study_app = (SRC / "study-app.js").read_text(encoding="utf-8").replace("/*__MARK_APP__*/", (SRC / "mark-app.js").read_text(encoding="utf-8")).replace("/*__INTERVIEW_APP__*/", (SRC / "interview-app.js").read_text(encoding="utf-8"))
(DIST / "study-app.js").write_text(study_app, encoding="utf-8")
learning = learning.replace(
    "图片版 OCR 仅用来辅助定位；题目均已核对所标注的 PDF 原页。",
    "网站展示资料的提取文字及 PDF 页码；图片版 OCR 仅用来辅助定位。题目均已核对所标注的原页。",
)
learning = learning.replace(
    "<title>公基系统学习与刷题</title>",
    f'<title>公基学习台 · 系统学习与刷题</title><meta name="description" content="按学科自主学习、{len(study["modules"])} 个课程单元、{len(study["questions"])} 道带解析题目、连续随机刷题与账号错题同步。">',
)
for asset in ("learning-data.js", "data.js", "study-app.js"):
    digest = hashlib.sha256((DIST / asset).read_bytes()).hexdigest()[:12]
    learning = learning.replace(f'src="{asset}"', f'src="{asset}?v={digest}"')
learning = learning.replace("</head>", f'<link rel="icon" href="{FAVICON}"></head>', 1)
(DIST / "study.html").write_text(learning, encoding="utf-8")
(DIST / "index.html").write_text(learning, encoding="utf-8")

search = (SRC / "search-template.html").read_text(encoding="utf-8")
search = search.replace("/*__KB_DATA__*/", "")
search = search.replace('5 份资料', '5 份 PDF + 吉林专题').replace('1,878 个 PDF 页',f'{pdf_page_count:,} 个 PDF 页 · 9 节吉林讲解')
search = search.replace("<script>\n", '<script src="data.js"></script>\n<script>\n', 1)
search = search.replace('href="学习与刷题.html"', 'href="study.html"')
search = search.replace('12 个学习单元 · 72 道题', f'{len(study["modules"])} 个课程单元 · {len(study["questions"])} 道题')
search = search.replace("source.uri+'#page='+page.p", "'source.html?source='+encodeURIComponent(page.s)+'&page='+page.p")
search = search.replace(
    "定位到原 PDF 页。",
    "查看提取文字和对应的 PDF 页码。",
)
search = search.replace(
    "<title>公基知识库</title>",
    '<title>公基学习台 · 全文检索</title><meta name="description" content="检索五份公基资料和吉林省情原创讲解，按主题筛选并查看出处。">',
)
search = search.replace('src="data.js"',f'src="data.js?v={hashlib.sha256((DIST / "data.js").read_bytes()).hexdigest()[:12]}"')
search = search.replace("</head>", f'<link rel="icon" href="{FAVICON}"></head>', 1)
(DIST / "search.html").write_text(search, encoding="utf-8")

source_html = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>资料出处 · 公基学习台</title><meta name="description" content="查看公基资料的提取文字及对应 PDF 页码。">
<link rel="icon" href="__FAVICON__">
<style>
:root{--ink:#172238;--muted:#576579;--line:#e1e7ef;--blue:#24599b;--bg:#f5f7fb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--blue)}header{background:linear-gradient(125deg,#183254,#285f80);color:#fff;padding:24px 0}header a{color:#fff;text-decoration:none}header h1{font-size:clamp(23px,4vw,34px);margin:12px 0 2px;line-height:1.35}header p{margin:0;color:#dceaf3}.wrap{max-width:920px;margin:auto;padding:0 20px}main{padding-top:24px;padding-bottom:56px}.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 4px 18px #16395b08}.meta{color:var(--muted);font-size:14px}.pager{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin:18px 0}.pager a{display:inline-block;border:1px solid #b9c9dc;background:#fff;border-radius:9px;padding:7px 13px;text-decoration:none}.pager a:hover{background:#eaf2fd}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;margin:20px 0 0}.note{font-size:13px;color:var(--muted);margin-top:18px}@media(max-width:600px){.wrap{padding:0 15px}.card{padding:16px}}
</style></head><body><header><div class="wrap"><nav><a href="study.html">学习首页</a>　·　<a href="search.html">全文检索</a></nav><h1 id="title">资料出处</h1><p id="subtitle"></p></div></header><main class="wrap"><div class="pager"><a id="previous" hidden>← 上一页</a><a id="next" hidden>下一页 →</a></div><article class="card"><div class="meta" id="meta"></div><pre id="content"></pre><p class="note">本站展示的是提取文字，图片版资料可能有 OCR 识别误差。页码对应原 PDF 的文件页序；如需核对版式，请在本地原文件中打开相同页码。法律、政策和时政内容请以现行权威文件为准。</p></article></main><script src="data.js"></script><script>
const params=new URLSearchParams(location.search),sourceId=params.get('source'),pageNumber=Number(params.get('page'));
const source=KB_DATA.sources.find(item=>item.id===sourceId);
const row=KB_DATA.pages.find(item=>item.s===sourceId&&item.p===pageNumber);
const valid=source&&Number.isInteger(pageNumber)&&pageNumber>=1&&pageNumber<=source.pages;
if(valid){
  const section=source.kind==='study-notes';
  document.title=`${source.name} · 第 ${pageNumber} ${section?'节':'页'} · 公基学习台`;
  document.getElementById('title').textContent=source.name;
  document.getElementById('subtitle').textContent=`${section?'讲解':'PDF'} 第 ${pageNumber} / ${source.pages} ${section?'节':'页'}`;
  if(section)document.querySelector('.note').textContent='本站原创学习讲解；打开吉林专题可查看官方来源、完整考点和配套练习。';
  document.getElementById('meta').textContent=`提取方式：${source.method} · 来源：${source.edition||'用户提供资料'}`;
  document.getElementById('content').textContent=row?.t?.trim()||'这一页没有可读取的文字。请在本地原 PDF 中核对。';
  if(pageNumber>1){const a=document.getElementById('previous');a.hidden=false;a.href=`source.html?source=${encodeURIComponent(sourceId)}&page=${pageNumber-1}`}
  if(pageNumber<source.pages){const a=document.getElementById('next');a.hidden=false;a.href=`source.html?source=${encodeURIComponent(sourceId)}&page=${pageNumber+1}`}
}else{
  document.getElementById('title').textContent='找不到资料页';
  document.getElementById('content').textContent='来源或页码无效。请返回全文检索重新选择。';
}
</script></body></html>'''.replace("__FAVICON__", FAVICON)
source_html=source_html.replace('src="data.js"',f'src="data.js?v={hashlib.sha256((DIST / "data.js").read_bytes()).hexdigest()[:12]}"')
(DIST / "source.html").write_text(source_html, encoding="utf-8")

print(f"Built {len(pages['sources'])} sources, {len(pages['pages'])} searchable pages, "
      f"{len(study['modules'])} modules, {len(study['questions'])} questions")
