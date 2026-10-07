// Non-video source collection: independent document state and race-safe lazy loading.
const markLibrary=STUDY.markLibrary||{documents:[],groups:[],stats:{}};
const markDocs=new Map(markLibrary.documents.map(d=>[d.id,d]));
const markGroups=new Map(markLibrary.groups.map(g=>[g.id,g]));
const markCache=new Map(),markSidebarPositions=new Map();
let markSubject='all',markCategory='all',markQuery='',markActiveDoc=null,markActiveUnit=null,markRenderVersion=0,markSearchRows=null,markSearchTimer=null;
async function loadMarkDoc(id){
 if(!markCache.has(id))markCache.set(id,fetch('materials/'+id+'.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error('资料暂时无法加载');return r.json();}).catch(e=>{markCache.delete(id);throw e;}));
 return markCache.get(id);
}
function openMark(doc=null,unit=null){if(markActiveDoc&&document.querySelector('.mark-reader-sidebar'))markSidebarPositions.set(markActiveDoc,document.querySelector('.mark-reader-sidebar').scrollTop);show('materials',true,{view:'materials',...(doc?{doc}:{}),...(unit?{unit}:{})});}
function markOption(label,value){const option=el('option',label);option.value=value;return option;}
function markLink(label,doc,unit){return action(label,()=>openMark(doc,unit),'point-link');}
function markUnitLinks(topicId){
 const links=[];
 for(const d of markLibrary.documents)for(const u of d.units)if(u.topicIds.includes(topicId))links.push({d,u});
 return links;
}
function markCourseReferences(t){
 if(t.markRef){const box=el('div',undefined,'mark-course-links');box.append(markLink('对读本节马克讲义',t.markRef.doc,t.markRef.unit));return box;}
 const matches=markUnitLinks(t.id);if(!matches.length)return null;
 const details=el('details',undefined,'reading-detail mark-course-links');details.append(el('summary',`马克资料补充 · ${matches.length} 节`),el('p','对读讲义、导图与专项资料。按知识体系归类，相关资料保留具体内容和出处。','muted'));
 const box=el('div',undefined,'topic-point-list');for(const {d,u} of matches)box.append(markLink(u.title+' · '+d.category,d.id,u.id));details.append(box);return details;
}
function markImage(info){
 const fig=el('figure',undefined,'mark-source-image'),link=el('a');link.href=info.asset;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','查看原图：'+info.caption);
 const image=el('img');image.src=info.asset;image.alt=info.caption;image.loading='lazy';image.decoding='async';image.width=info.width;image.height=info.height;link.append(image);
 image.onerror=()=>{image.classList.add('hidden');if(!fig.dataset.failed){fig.dataset.failed='yes';fig.append(el('p','图片暂时无法加载，可点击原图链接重试，或核对下方原资料。','muted small'));}};
 fig.append(link,el('figcaption',info.caption+(info.page?' · 原资料第 '+info.page+' 页':'')+' · 点击放大'));return fig;
}
function markTree(tree,depth=0){
 const wrapper=el('div',undefined,'mark-tree-node');if(!tree.title&&!tree.children?.length)return wrapper;
 if(tree.children?.length){const details=el('details');details.open=depth<2;details.append(el('summary',tree.title||'补充内容'));if(tree.note)details.append(el('p',tree.note));for(const child of tree.children)details.append(markTree(child,depth+1));wrapper.append(details);}
 else wrapper.append(el('p',tree.title));return wrapper;
}
async function renderMark(route={view:'materials'}){
 const version=++markRenderVersion,box=$('markContent');box.replaceChildren();
 if(route.doc&&markDocs.has(route.doc)){
  markActiveDoc=route.doc;markActiveUnit=route.unit||null;box.append(el('p','正在打开学习资料…','muted'));
  try{const doc=await loadMarkDoc(route.doc);if(version!==markRenderVersion)return;box.replaceChildren();renderMarkReader(doc,route.unit,box);}
  catch(e){if(version!==markRenderVersion)return;box.replaceChildren(el('p',e.message,'muted'),action('重试',()=>renderMark(route),'btn'));}return;
 }
 markActiveDoc=null;markActiveUnit=null;renderMarkCatalog(box,version);
}
function renderMarkCatalog(box,version){
 const header=el('div',undefined,'mark-intro');header.append(el('p','系统讲义 · 专题补充 · 图解复习','topic-eyebrow'),el('h2','马克资料学习馆'),el('p','讲义建立框架，导图梳理关系，专题补齐细节，题本用来复盘。'));
 const s=markLibrary.stats;header.append(el('p',`${s.files} 份非视频文件 · 合并为 ${s.documents} 组资料 · ${s.units} 个阅读单元 · 86 个专项专题`,'mark-summary'));header.append(el('p',`${STUDY.markQuiz.questions} 道专题练习 · ${STUDY.markQuiz.points} 项核心辨析 · 86 个专题＋20组基础知识`,'mark-summary'),action('连续刷马克资料题',()=>startMarkQuiz(),'btn'));box.append(header);
 const method=el('div',undefined,'mark-methods');for(const m of markLibrary.methods||[]){const card=el('article');card.append(el('h3',m.title),el('p',m.text));method.append(card);}box.append(method);
 const filter=el('div',undefined,'mark-filter');const subject=el('select');subject.setAttribute('aria-label','马克资料学科');subject.append(markOption('全部学科','all'));for(const g of markLibrary.groups)subject.append(markOption(g.title,g.id));subject.value=markSubject;
 const category=el('select');category.setAttribute('aria-label','马克资料类型');category.append(markOption('全部类型','all'));for(const c of [...new Set(markLibrary.documents.map(d=>d.category))])category.append(markOption(c,c));category.value=markCategory;
 const search=el('input');search.type='search';search.placeholder='搜索全文、概念或资料名';search.setAttribute('aria-label','搜索马克资料全文');search.value=markQuery;filter.append(subject,category,search);box.append(filter);
 const status=el('p',undefined,'muted'),results=el('div',undefined,'mark-catalog');box.append(status,results);
 let searchVersion=0;
 async function update(){
  const request=++searchVersion;markSubject=subject.value;markCategory=category.value;markQuery=search.value.trim();
  const scoped=markLibrary.documents.filter(d=>(markSubject==='all'||d.subject===markSubject||d.units.some(u=>u.subject===markSubject))&&(markCategory==='all'||d.category===markCategory));
  let shown=scoped,matches=null;
  if(markQuery){status.textContent='正在搜索整理后的全文…';try{if(!markSearchRows)markSearchRows=await fetch('materials/search.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error();return r.json();});if(version!==markRenderVersion||request!==searchVersion)return;const q=markQuery.toLocaleLowerCase(),allowed=new Set(scoped.map(d=>d.id));matches=markSearchRows.filter(r=>allowed.has(r.doc)&&(r.title+' '+r.text).toLocaleLowerCase().includes(q));shown=scoped.filter(d=>d.search.toLocaleLowerCase().includes(q)||matches.some(m=>m.doc===d.id));}
   catch{if(request!==searchVersion)return;status.textContent='全文暂时无法加载，先按资料目录搜索。';shown=scoped.filter(d=>d.search.includes(markQuery));}}
  if(version!==markRenderVersion||request!==searchVersion)return;
  results.replaceChildren();status.textContent=`${shown.length} 组资料${matches?' · '+matches.length+' 节匹配内容':''}`;
  for(const group of [...markLibrary.groups].sort((a,b)=>(a.id==='comprehensive'?-1:0)-(b.id==='comprehensive'?-1:0))){const docs=shown.filter(d=>d.subject===group.id);if(!docs.length)continue;const section=el('section',undefined,'mark-group');section.append(el('h3',group.title),el('p',group.overview,'muted'));const grid=el('div',undefined,'mark-doc-grid');
   for(const d of docs){const card=el('article',undefined,'mark-doc-card');card.append(el('span',d.category,'mark-tag'),el('h4',d.title),el('p',`${d.unitCount} 节 · ${d.pages} 页 / 张${d.imageCount?' · '+d.imageCount+' 张原图':''}`,'muted small'));
    if(d.historical||d.legal)card.append(el('p',d.historical?d.edition+' · 历史归档':(d.subject==='law'?'法规资料 · 保留原版本':'含法规专题 · 保留原版本'),'mark-version'));
    const found=matches?.filter(m=>m.doc===d.id)||[];
    if(found.length){const links=el('div',undefined,'mark-search-matches');for(const m of found.slice(0,3))links.append(markLink(m.title,d.id,m.unit));if(found.length>3)links.append(el('p','另有 '+(found.length-3)+' 节，可打开后查看目录。','muted small'));card.append(links);}
    card.append(action('开始学习',()=>openMark(d.id,found[0]?.unit||(markSubject!=='all'?d.units.find(u=>u.subject===markSubject)?.id:undefined)),'btn secondary'));grid.append(card);
   }section.append(grid);results.append(section);
  }
  if(!shown.length)results.append(el('p','没有匹配内容，试试另一关键词或取消筛选。','muted'));
 }
 subject.onchange=()=>void update();category.onchange=()=>void update();search.oninput=()=>{clearTimeout(markSearchTimer);markSearchTimer=setTimeout(()=>void update(),250);};void update();
 const provenance=el('details',undefined,'reading-detail mark-provenance');provenance.append(el('summary','整理范围与原文件清单'),el('p',`已处理 ${s.uniqueFiles} 份内容不同的文件；${s.duplicateFiles} 份完全重复文件合并记录。${s.pdfPages.toLocaleString()} 页 PDF、${s.xmindFiles} 份 XMind、${s.imageFiles} 张图片；另有 ${s.emptyMarkers} 个空文件标记。视频未纳入。`),el('p','目录页、重复宣传信息已过滤。摘记用于复习，原页图用于核对；法条和时政保留资料年代。新增资料中的原题属于题本阅读，尚未逐题核对的原题不会自动加入判分题库。','muted'));
 const button=action('查看全部非视频文件',async()=>{button.disabled=true;try{const rows=await fetch('materials/manifest.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error();return r.json();});const list=el('div',undefined,'mark-file-list');for(const row of rows){const p=el('p');p.append(el('b',row.name),el('span',' · '+row.status,'muted'));if(markDocs.has(row.document))p.append(markLink('打开整理内容',row.document));list.append(p);}provenance.append(list);button.remove();}catch{button.disabled=false;button.textContent='加载失败，点击重试';}},'btn ghost');provenance.append(button);box.append(provenance);
}
function renderMarkReader(doc,requestedUnit,box){
 const selected=doc.units.find(u=>u.id===requestedUnit)||doc.units[0];markActiveUnit=selected.id;
 const nav=el('nav',undefined,'mark-reader-toolbar');nav.setAttribute('aria-label','马克资料阅读导航');nav.append(action('← 返回资料目录',()=>openMark(),'btn secondary'));
 const at=doc.units.indexOf(selected);const prev=action('上一节',()=>openMark(doc.id,doc.units[at-1].id),'btn ghost'),next=action('下一节',()=>openMark(doc.id,doc.units[at+1].id),'btn');prev.disabled=at===0;next.disabled=at===doc.units.length-1;nav.append(prev,el('span',`${at+1} / ${doc.units.length}`,'muted small'),next);if(doc.answerUnitId)nav.append(action('题本答案区',()=>openMark(doc.id,doc.answerUnitId),'btn secondary'));if(practiceActive)nav.append(action('返回当前题',resumePractice,'btn secondary'));const practice=STUDY.questions.filter(q=>q.kind==='mark-authored'&&q.markRefs.some(r=>r.doc===doc.id&&r.unit===selected.id));if(practice.length)nav.append(action('练本节知识 · '+practice.length+' 题',()=>startMarkQuiz(doc.id,selected.id),'btn secondary'));box.append(nav);
 const layout=el('div',undefined,'mark-reader-layout'),sidebar=el('aside',undefined,'mark-reader-sidebar');sidebar.append(el('h3',doc.title),el('p',doc.category+' · '+doc.edition,'muted small'));
 const search=el('input');search.type='search';search.placeholder='查找本资料章节';search.setAttribute('aria-label','查找马克资料章节');sidebar.append(search);const list=el('div',undefined,'mark-reader-directory');const links=[];
 for(const u of doc.units){const b=action(u.title,()=>openMark(doc.id,u.id),'mark-unit-link'+(u===selected?' current':''));b.setAttribute('aria-current',u===selected?'page':'false');b.append(el('small',`原页 ${u.start}–${u.end}`));list.append(b);links.push({b,u});}search.oninput=()=>{for(const {b,u} of links)b.hidden=!(u.title+' '+u.overview).includes(search.value.trim());};sidebar.append(list);
 const article=el('article',undefined,'card mark-reader-body');article.append(el('p',(markGroups.get(selected.subject)?.title||'资料学习')+' · '+doc.category,'topic-eyebrow'),el('h2',selected.title),el('p',selected.overview,'mark-unit-overview'));
 for(const p of STUDY.knowledge)if(p.markRef?.doc===doc.id&&p.markRef.unit===selected.id&&p.correction&&p.authority)article.append(correctionNotice(p));
 const guide=el('section',undefined,'mark-study-guide');guide.append(el('h3','这一节怎么学'),el('p',selected.method),el('h4','容易混淆的边界'),el('p',selected.boundary));article.append(guide);
 if(selected.teaching){const lesson=el('section',undefined,'mark-study-guide space');lesson.append(el('h3',selected.teaching.title),el('p',selected.teaching.text));article.append(lesson);}
 const assessedTopics=STUDY.topicExpansions.filter(t=>t.markRef?.doc===doc.id&&t.markRef.unit===selected.id);
 for(const t of assessedTopics){const lesson=el('section',undefined,'mark-study-guide space');lesson.append(el('h3','本节核心辨析与练习'),topicDiagram(t),el('p',t.connection),action('学习这组完整知识',()=>openTopic(t.id),'btn secondary'));article.append(lesson);}
 // Existing authored topic lessons explain the matched source subject without adding guessed quiz answers.
 const topics=selected.topicIds.map(id=>topicMap.get(id)).filter(Boolean);
 if(topics.length){const teaching=el('section',undefined,'mark-teaching');teaching.append(el('h3','课程讲解与相关练习'));
  for(const t of topics){const part=el('details',undefined,'reading-detail');part.open=false;part.append(el('summary',t.title),el('p',t.overview),topicDiagram(t));for(const g of t.foundations||[])part.append(foundationGuide(g));part.append(el('p',t.connection),el('p',t.boundary));const controls=el('div',undefined,'actions');controls.append(action('学习完整专题',()=>openTopic(t.id),'btn secondary'));if(t.questionIds.length)controls.append(action('练相关题',()=>startQuiz(t.questionIds.map(id=>questionMap.get(id)).filter(Boolean)),'btn'));part.append(controls);teaching.append(part);}article.append(teaching);
 }
 if(selected.trees?.length){article.append(el('h3','按层级梳理知识'));const tree=el('div',undefined,'mark-tree');for(const root of selected.trees)tree.append(markTree(root));article.append(tree);}
 if(selected.facts.length){article.append(el('h3','重点摘记'));const facts=el('ol',undefined,'mark-facts');for(const fact of selected.facts)facts.append(el('li',fact));article.append(facts);}
 const originals=doc.images.filter(i=>i.page>=selected.start&&i.page<=selected.end);
 if(originals.length){article.append(el('h3','对照原图理解'));for(const info of originals.slice(0,2))article.append(markImage(info));if(originals.length>2){const more=el('details',undefined,'reading-detail');more.append(el('summary','继续看本节 '+(originals.length-2)+' 张原页图'));for(const info of originals.slice(2))more.append(markImage(info));article.append(more);}}
 if(selected.blocks.length&&!selected.trees?.length){const detail=el('details',undefined,'reading-detail mark-complete-notes');detail.open=doc.category==='默写与回忆';detail.append(el('summary',doc.category==='题本复盘'?'阅读原题与题本答案资料':'展开本节完整整理笔记'));let p=null;
  for(const block of selected.blocks){if(block.page!==p){p=block.page;detail.append(el('h4','原资料第 '+p+' 页'));}detail.append(el('p',block.text,'mark-note'+(block.ocr?' mark-ocr':'')));}article.append(detail);}
 const recall=el('section',undefined,'mark-recall');recall.append(el('h3','合上资料，主动回忆'),el('p',selected.recall));article.append(recall);
 if(doc.variantNotes?.length){const variants=el('details',undefined,'reading-detail');variants.append(el('summary',`其他格式补充 · ${doc.variantNotes.length} 条`),el('p','不同格式出现的额外内容保留在这里，可与本资料一起对读。','muted'));for(const row of doc.variantNotes){variants.append(el('h4',row.name+' · 原页 '+row.page),el('p',row.text,'mark-note'));}article.append(variants);}
 const source=el('details',undefined,'reading-detail');source.append(el('summary','资料出处与版本'),el('p',doc.sourceNote));for(const v of doc.variants)source.append(el('p',v.name+' · '+v.format.toUpperCase()+' · '+v.pages+' 页 / 张'));for(const ref of doc.authorities||[]){const a=el('a',ref.title+' ↗');a.href=ref.url;a.target='_blank';a.rel='noopener';source.append(el('p'),a);}article.append(source);
 layout.append(sidebar,article);box.append(layout);sidebar.scrollTop=markSidebarPositions.get(doc.id)||0;const active=list.querySelector?.('.current');if(active&&sidebar.getBoundingClientRect){const outer=sidebar.getBoundingClientRect(),inner=active.getBoundingClientRect();if(inner.top<outer.top||inner.bottom>outer.bottom)sidebar.scrollTop+=inner.top-outer.top-sidebar.clientHeight/2;}
}
