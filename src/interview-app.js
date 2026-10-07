const interviewLibrary=STUDY.interviewLibrary||{modules:[],questions:[],sources:[]};
const interviewModules=new Map(interviewLibrary.modules.map(m=>[m.id,m]));
const interviewQuestions=new Map(interviewLibrary.questions.map(q=>[q.id,q]));
let interviewFilter='all',interviewQuery='',interviewQueue=[],interviewAt=-1,interviewDrafts=new Map(),interviewSources=null,interviewClock={running:false,start:0,elapsed:0,phase:'思考'},interviewClockTimer=null,interviewRender=0;
let interviewClockQuestion=null;
function interviewSavedDraft(key,id){
 let draft=interviewDrafts.get(key);
 try{if(!draft)draft=JSON.parse(sessionStorage.getItem('gongji-interview-draft:'+key)||'null');if(signedIn){const handoff=JSON.parse(sessionStorage.getItem('gongji-interview-login-draft')||'null');if(handoff?.id===id){draft={outline:handoff.outline,review:handoff.review};sessionStorage.removeItem('gongji-interview-login-draft');sessionStorage.setItem('gongji-interview-draft:'+key,JSON.stringify(draft));}}}catch{}
 return draft||state.interview?.[id]||{outline:'',review:''};
}
function openInterview(doc=null,unit=null){show('interview',true,{view:'interview',...(doc?{doc}:{}),...(unit?{unit}:{})});}
function interviewParagraphs(text,box){for(const p of text.split(/\n\n+/)){box.append(el('p',p,'interview-source-text'));}}
function interviewCourse(module,box,lessonId){
 const toolbar=el('div',undefined,'interview-toolbar');if(interviewAt>=0)toolbar.append(action('返回正在练的题',()=>openInterview('practice',interviewQueue[interviewAt].id),'btn secondary'));toolbar.append(action('返回面试目录',()=>openInterview(),'btn secondary'),action('练习这类题',()=>{interviewFilter=module.id;interviewNext(true);},'btn'));box.append(toolbar);
 const layout=el('div',undefined,'interview-layout'),nav=el('aside',undefined,'interview-sidebar');nav.setAttribute('aria-label','面试题型目录');
 for(const m of interviewLibrary.modules){const details=el('details');details.open=m.id===module.id;details.append(el('summary',m.title));details.append(action('框架与方法',()=>openInterview(m.id),'subject-link'));for(const l of m.lessons)details.append(action(l.title,()=>openInterview(m.id,l.id),'subject-link'));nav.append(details);}layout.append(nav);
 const article=el('article',undefined,'interview-article');article.append(el('p','结构化面试 · '+module.title,'topic-eyebrow'),el('h2',module.title),el('p',module.overview,'interview-lead'),el('h3','怎样组织答案'));
 const steps=el('ol');for(const s of module.steps)steps.append(el('li',s));article.append(steps,el('h3','把框架用在题目上'));for(const t of module.methods)article.append(el('p',t));const trap=el('div',undefined,'interview-trap');trap.append(el('strong','常见失误'),el('p',module.pitfall));article.append(trap);
 const lesson=module.lessons.find(l=>l.id===lessonId);article.append(el('h3',lesson?lesson.title:'教程细读'));
 if(!lesson){for(const l of module.lessons)article.append(action(l.title,()=>openInterview(module.id,l.id),'subject-link'));}
 else{for(const p of lesson.pages){for(const image of interviewLibrary.images||[])if(image.source==='framework'&&image.page===p.page)article.append(markImage(image));const section=el('section',undefined,'interview-page');section.append(el('h4','原教程第 '+p.page+' 页'));interviewParagraphs(p.text,section);article.append(section);}const index=module.lessons.indexOf(lesson),bottom=el('div',undefined,'actions');if(index>0)bottom.append(action('上一节',()=>openInterview(module.id,module.lessons[index-1].id),'btn secondary'));if(index<module.lessons.length-1)bottom.append(action('下一节',()=>openInterview(module.id,module.lessons[index+1].id),'btn'));article.append(bottom);}
 const source=el('a','查看原教程 PDF','point-link');source.href='downloads/interview-framework.pdf#page='+(lesson?.start||module.start);source.target='_blank';source.rel='noopener';article.append(source);layout.append(article);box.append(layout);
}
function interviewNext(reset=false){
 const candidates=interviewLibrary.questions.filter(q=>q.kind==='question'&&(interviewFilter==='all'||q.module===interviewFilter));if(!candidates.length){notice('这类题在当前真题资料中还没有独立练习，可先学习框架。');return;}
 if(reset){interviewQueue=[];interviewAt=-1;}
 if(interviewAt+1<interviewQueue.length)interviewAt++;
 else{const seen=new Set(interviewQueue.map(q=>q.id));let remaining=candidates.filter(q=>!seen.has(q.id));if(!remaining.length)remaining=candidates.filter(q=>q.id!==interviewQueue[interviewAt]?.id);if(!remaining.length)remaining=candidates;interviewQueue.push(shuffle(remaining)[0]);interviewAt++;}
 interviewStopClock();interviewClock={running:false,start:0,elapsed:0,phase:'思考'};openInterview('practice',interviewQueue[interviewAt].id);
}
function interviewPrevious(){if(interviewAt>0){interviewAt--;interviewStopClock();interviewClock={running:false,start:0,elapsed:0,phase:'思考'};openInterview('practice',interviewQueue[interviewAt].id);}}
function interviewStopClock(){if(interviewClock.running)interviewClock.elapsed+=Date.now()-interviewClock.start;interviewClock.running=false;if(interviewClockTimer){clearTimeout(interviewClockTimer);interviewClockTimer=null;}}
function interviewPractice(q,box,version){
 if(!q){interviewNext(true);return;}
 if(q.kind==='method'){interviewMethod(q,box,version);return;}
 if(interviewClockQuestion!==q.id){interviewStopClock();interviewClock={running:false,start:0,elapsed:0,phase:'思考'};interviewClockQuestion=q.id;}
 const toolbar=el('div',undefined,'interview-toolbar');const prev=action('上一题',interviewPrevious,'btn secondary');prev.disabled=interviewAt<=0;toolbar.append(action('目录',()=>{interviewStopClock();openInterview();},'btn secondary'),prev,action('下一题',()=>interviewNext(),'btn'));box.append(toolbar);
 const article=el('article',undefined,'interview-article');article.append(el('p',`老夏真题100题 · 第 ${q.number} 题 · ${interviewModules.get(q.module)?.title||'综合练习'}`,'topic-eyebrow'),el('h2',q.title),el('p',q.stem,'interview-question'),el('p',`出处：原 PDF 第 ${q.start}–${q.end} 页 · 题干经过扫描识别，可用原页核对。`,'muted small'));
 const clock=el('div',undefined,'interview-clock'),display=el('strong'),limit=el('input');limit.id='interviewTargetMinutes';limit.type='number';limit.min='1';limit.max='30';limit.value='3';limit.setAttribute('aria-label','练习目标分钟');
 function tick(){const seconds=Math.floor((interviewClock.elapsed+(interviewClock.running?Date.now()-interviewClock.start:0))/1000);display.textContent=interviewClock.phase+' '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');display.className=seconds>=Number(limit.value)*60?'interview-time-over':'';if(interviewClock.running)interviewClockTimer=setTimeout(tick,250);}
 const targetLabel=el('label','目标分钟');targetLabel.setAttribute('for','interviewTargetMinutes');
 const toggle=action('开始 / 暂停',()=>{if(interviewClock.running)interviewStopClock();else{interviewClock.running=true;interviewClock.start=Date.now();}tick();},'btn secondary');clock.append(display,toggle,action('进入答题',()=>{interviewStopClock();interviewClock={running:true,start:Date.now(),elapsed:0,phase:'答题'};tick();},'btn secondary'),targetLabel,limit);tick();article.append(clock);
 const key=accountId||'guest',draftKey=key+':'+q.id,saved=interviewSavedDraft(draftKey,q.id);const outline=el('textarea');outline.value=saved.outline;outline.rows=5;outline.maxLength=12000;outline.placeholder='身份与任务 → 核心矛盾 → 三四个答题要点';outline.setAttribute('aria-label','面试答题提纲');const review=el('textarea');review.value=saved.review;review.rows=3;review.maxLength=6000;review.placeholder='哪一点没讲清？下一次怎样说得更具体？';review.setAttribute('aria-label','面试练习复盘');
 const save=el('p',signedIn?'保存到账号后，可在其他设备继续。':'可以直接练习；登录后可保存提纲和复盘。','muted');
 const remember=()=>{const draft={outline:outline.value,review:review.value};interviewDrafts.set(draftKey,draft);try{sessionStorage.setItem('gongji-interview-draft:'+draftKey,JSON.stringify(draft));}catch{}save.textContent='本标签页草稿已保留（刷新可恢复），请保存到账号。';};outline.oninput=remember;review.oninput=remember;
 article.append(el('h3','我的答题提纲'),outline,el('h3','练后复盘'),el('p','检查：任务是否答全；理由是否紧扣材料；措施是否可执行；重点是否突出；语言是否自然、时间是否合适。'),review,action('保存提纲与复盘',async()=>{if(accountReady&&!signedIn){try{sessionStorage.setItem('gongji-interview-login-draft',JSON.stringify({id:q.id,outline:outline.value,review:review.value}));}catch{}}if(!requireAccount())return;save.textContent='正在保存…';try{await persist({type:'interview',questionId:q.id,outline:outline.value,review:review.value});interviewDrafts.delete(draftKey);try{sessionStorage.removeItem('gongji-interview-draft:'+draftKey);}catch{}save.textContent='已保存到账号，可跨设备查看。';}catch(e){save.textContent=e.message+'；当前页面草稿仍保留。';}},'btn'),save);
 const module=interviewModules.get(q.module);
 if(module){
  const hint=el('details',undefined,'interview-hint');hint.append(el('summary','答题路径与复盘要点（展开前先独立作答）'),el('p','先确认身份、任务和材料中的矛盾，再按题型组织回答。以下是本题所属题型的练习框架，具体措施仍须结合本题情境。'));
  const steps=el('ol');for(const step of module.steps)steps.append(el('li',step));hint.append(steps,el('strong','检查是否踩了这些坑'),el('p',module.pitfall),action('深入学习这类题的框架',()=>{interviewStopClock();openInterview(module.id);},'point-link'));article.append(hint);
 }
 article.append(el('p','历史题干按原资料的时间语境阅读；人物职务和政策表述不代表今天的状态。复盘时，将当时材料与现行情况分别梳理。','muted small'));
 const reference=el('details',undefined,'reading-detail');reference.append(el('summary','查看原资料讲解与原页'));const body=el('div');reference.append(body);let opened=false;reference.ontoggle=async()=>{if(!reference.open||opened)return;body.replaceChildren(el('p','正在读取讲解…'));try{if(!interviewSources)interviewSources=await fetch('interview/questions.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error('讲解暂时无法加载');return r.json();});if(version!==interviewRender)return;body.replaceChildren();for(const page of interviewSources[q.id]||[]){body.append(el('h4','原 PDF 第 '+page.page+' 页'));for(const image of interviewLibrary.images||[])if(image.source==='laoxia'&&image.page===page.page)body.append(markImage(image));interviewParagraphs(page.text,body);}opened=true;}catch(e){body.replaceChildren(el('p',e.message));}};
 const pdf=el('a','打开原 PDF 核对','point-link');pdf.href='downloads/interview-100.pdf#page='+q.start;pdf.target='_blank';pdf.rel='noopener';reference.append(pdf);article.append(reference);box.append(article);
}
function renderInterview(route={}){
 const version=++interviewRender,box=$('interviewContent');box.replaceChildren();
 if(route.doc==='practice'){const q=interviewQuestions.get(route.unit);if(q){let index=interviewQueue.findIndex(item=>item.id===q.id);if(index<0){interviewQueue.push(q);index=interviewQueue.length-1;}interviewAt=index;}interviewPractice(q,box,version);return;}
 const module=interviewModules.get(route.doc);if(module){interviewCourse(module,box,route.unit);return;}
 box.append(el('p','学习框架 · 真题开口练 · 提纲复盘','topic-eyebrow'),el('h2','结构化面试'),el('p',`两个教程已接入：8 个学习模块、${interviewLibrary.questions.length} 个案例与方法专题，97 个含题干的专题可随机练习。按题型学习，按需求练习。`,'interview-lead'));
 const entries=el('div',undefined,'interview-entry');entries.append(action('随机开始练习',()=>interviewNext(true),'btn'));if(interviewAt>=0)entries.append(action('继续刚才的题',()=>openInterview('practice',interviewQueue[interviewAt].id),'btn secondary'));box.append(entries);
 const grid=el('div',undefined,'interview-module-grid');for(const m of interviewLibrary.modules){const card=el('article',undefined,'interview-module-card');card.append(el('h3',m.title),el('p',m.overview),el('p',`${m.lessons.length} 节教程细读 · ${interviewLibrary.questions.filter(q=>q.kind==='question'&&q.module===m.id).length} 道练习`,'muted small'),action('学习框架',()=>openInterview(m.id),'btn secondary'));grid.append(card);}box.append(grid);
 box.append(el('h3','真题目录'));const filter=el('select');filter.setAttribute('aria-label','面试真题题型');filter.append(markOption('全部题型','all'));for(const m of interviewLibrary.modules)filter.append(markOption(m.title,m.id));filter.value=interviewFilter;const search=el('input');search.type='search';search.placeholder='搜索题目、场景或关键词';search.value=interviewQuery;search.setAttribute('aria-label','搜索面试真题');const controls=el('div',undefined,'mark-filter');controls.append(filter,search);box.append(controls);const list=el('div',undefined,'interview-question-list'),status=el('p',undefined,'muted small');box.append(status,list);
 function update(){interviewFilter=filter.value;interviewQuery=search.value.trim();const qs=interviewLibrary.questions.filter(q=>(interviewFilter==='all'||q.module===interviewFilter)&&(q.title+' '+q.stem).includes(interviewQuery));status.textContent=`找到 ${qs.length} 个专题`;list.replaceChildren();for(const q of qs)list.append(action(String(q.number).padStart(3,'0')+' · '+q.title,()=>{interviewStopClock();interviewQueue=[q];interviewAt=0;openInterview('practice',q.id);},'subject-link'));}filter.onchange=update;search.oninput=update;update();
 const materials=el('details',undefined,'reading-detail');materials.append(el('summary','两份原教程'));for(const s of interviewLibrary.sources){const a=el('a',s.name+' · '+s.pages+' 页','subject-link');a.href=s.download;a.target='_blank';a.rel='noopener';materials.append(a);}box.append(materials);
}

async function interviewMethod(q,box,version){
 box.append(action('返回面试目录',()=>openInterview(),'btn secondary'),el('h2',q.title),el('p','原资料方法专题 · 第 '+q.start+'–'+q.end+' 页','muted'));
 const body=el('article',undefined,'interview-article');box.append(body);try{if(!interviewSources)interviewSources=await fetch('interview/questions.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error('资料暂时无法加载');return r.json();});if(version!==interviewRender)return;for(const page of interviewSources[q.id]||[]){body.append(el('h3','原 PDF 第 '+page.page+' 页'));for(const image of interviewLibrary.images||[])if(image.source==='laoxia'&&image.page===page.page)body.append(markImage(image));interviewParagraphs(page.text,body);}}catch(e){body.append(el('p',e.message),action('重试',()=>openInterview('practice',q.id),'btn'));}
}
