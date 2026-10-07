const $ = (id) => document.getElementById(id);
const moduleMap = Object.fromEntries(STUDY.modules.map((module) => [module.id, module]));
const sourceMap = Object.fromEntries([...STUDY.sources,...(STUDY.webSources||[]),...(STUDY.markLibrary?.documents||[]).map(d=>({...d,name:'马克资料 · '+d.title,kind:'mark'}))].map((source) => [source.id, source]));
const sourcePageMap = new Map();
const loadedSources = new Map();
async function loadSource(id) {
  if(sourceMap[id]?.kind==='mark')return loadMarkDoc(id).then(doc=>{const pages=new Map();for(const u of doc.units)for(const b of u.blocks){if(!pages.has(b.page))pages.set(b.page,new Set());pages.get(b.page).add(b.text);}for(const [page,texts] of pages)sourcePageMap.set(id+':'+page,[...texts].join('\n'));});
  if (!loadedSources.has(id)) loadedSources.set(id, fetch('references/'+id+'.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(rows=>{for(const row of rows)sourcePageMap.set(id+':'+row.p,row.t);}).catch(e=>{loadedSources.delete(id);throw e;}));
  return loadedSources.get(id);
}
const SUBJECTS = [
 ['法律',['m01','m02','m03']],['哲学',['m04']],['政治与党史',['m05','m06']],
 ['经济',['m07']],['公文',['m08']],['管理',['m09']],['历史',['m10']],
 ['文学与文化',['m11']],['科技与地理',['m12']],['吉林省情',['m14']],
];
const pointMap = new Map(STUDY.knowledge.map(p=>[p.id,p]));
const modulePoints = Object.fromEntries(STUDY.modules.map(m=>[m.id,STUDY.knowledge.filter(p=>p.module===m.id)]));
let currentPoint = null, selectedTimeline = 'history', coverageLimit = 60;
const NAV_KEY='gongji-course-navigation-v1';
let courseNavigation={open:{}};
try {const saved=JSON.parse(localStorage.getItem(NAV_KEY)||'{}');if(saved.open&&typeof saved.open==='object')courseNavigation.open=saved.open;} catch {}
const directoryModules=new Map(),directoryGroups=new Map(),directoryPointButtons=new Map(),directoryTopicButtons=new Map();
let directoryQuery=null,previousDirectoryPoint=null,previousDirectoryModule=null,previousDirectoryTopic=null;
const sectionKey=(id,title)=>JSON.stringify([id,title]);
function saveCourseNavigation(){try{localStorage.setItem(NAV_KEY,JSON.stringify(courseNavigation));}catch{}}
function rememberDisclosure(node,key,fallback=false,transient=false){
 node.dataset.navigationKey=key;node.open=typeof courseNavigation.open[key]==='boolean'?courseNavigation.open[key]:fallback;
 node.ontoggle=()=>{if(transient||node.isConnected===false)return;if(courseNavigation.open[key]!==node.open){courseNavigation.open[key]=node.open;saveCourseNavigation();}};
}
function captureDirectory(){
 if(directoryQuery)return;
 for(const node of [...directoryModules.values(),...directoryGroups.values()])courseNavigation.open[node.dataset.navigationKey]=node.open;
}
function captureLessonSections(){
 for(const node of $('lessonPoints').children)if(node.dataset.navigationKey)courseNavigation.open[node.dataset.navigationKey]=node.open;
}
function pointGroup(p){return topicMap.get(STUDY.pointTopics?.[p.id])?.title||'专题讲解';}
const moduleTopics=id=>[...topicMap.values()].filter(t=>t.module===id&&t.pointIds.length&&!t.overviewOnly);
const questionAttempt = q => {const a=state.attempts[q.id];return a && (!q.revision || a.lastQuestionRevision===q.revision) ? a : undefined;};
const pointDone = p => p.questionIds.some(id=>questionMap.has(id)&&questionAttempt(questionMap.get(id))?.count);
const pointCorrect = p => p.questionIds.some(id=>questionMap.has(id)&&questionAttempt(questionMap.get(id))?.lastCorrect);
function el(tag,text,cls) {const x=document.createElement(tag); if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;}
function action(text,click,cls='btn secondary') {const x=el('button',text,cls);x.onclick=click;return x;}
const visualReferences=STUDY.visualReferences||[];
const topicMap=new Map((STUDY.topicExpansions||[]).map(t=>[t.id,t]));
let currentTopic=null;
const pointPictures=ids=>{const selected=new Set(ids);return visualReferences.filter(image=>image.pointIds.some(id=>selected.has(id)));};
function visualGallery(items,linkPoints=false){
 const gallery=el('div',undefined,'visual-gallery');
 for(const item of items){
  const figure=el('figure',undefined,'visual-card');const large=el('a',undefined,'visual-image-link');large.href=item.asset;large.target='_blank';large.rel='noopener';large.setAttribute('aria-label','查看'+item.title+'大图');
  const image=el('img');image.src=item.asset;image.alt=item.alt;image.loading='lazy';image.decoding='async';image.width=item.width||960;image.height=item.height||720;
  const zoom=el('span','查看大图','visual-zoom');large.append(image,zoom);
  image.onerror=()=>{image.hidden=true;large.href=item.sourcePage;large.classList.add('image-unavailable');zoom.textContent='图片暂无法显示，查看来源';};
  const caption=el('figcaption');caption.append(el('h4',item.title),el('p',item.observation,'visual-observation'));
  if(item.note)caption.append(el('p',item.note,'visual-note'));
  const attribution=el('p',undefined,'visual-attribution');const source=el('a','图片来源');source.href=item.sourcePage;source.target='_blank';source.rel='noopener';attribution.append(source,document.createTextNode(' · '+item.author+' · '));
  if(item.licenseUrl){const license=el('a',item.license);license.href=item.licenseUrl;license.target='_blank';license.rel='noopener';attribution.append(license);}else attribution.append(document.createTextNode(item.license));caption.append(attribution);
  if(linkPoints){const links=el('div',undefined,'visual-point-links');for(const id of item.pointIds){const p=pointMap.get(id);if(p)links.append(action('学习：'+p.title,()=>openPoint(id),'visual-point-link'));}if(links.children.length)caption.append(links);}
  if(linkPoints&&item.topicIds?.length){const links=el('div',undefined,'visual-point-links');for(const id of item.topicIds){const t=topicMap.get(id);if(t)links.append(action('专题：'+t.title,()=>openTopic(id),'visual-point-link'));}caption.append(links);}
  figure.append(large,caption);gallery.append(figure);
 }
 return gallery;
}
function topicDiagram(t){
 const figure=el('figure',undefined,'topic-diagram');figure.setAttribute('aria-label',t.title+'知识框架');
 figure.append(el('figcaption',t.layout==='timeline'?'时间线 · 按节点与成果复习':'知识结构 · 按条件与关系对照'));
 const grid=el('dl',undefined,'topic-grid'+(t.layout==='timeline'?' is-timeline':''));
 for(const row of t.diagram){const cell=el('div',undefined,'topic-cell');cell.append(el('dt',row.label),el('dd',row.text));grid.append(cell);}figure.append(grid);
 if(t.diagramAsset){const link=el('a','查看 / 保存知识框架图 ↗','topic-diagram-link');link.href=t.diagramAsset;link.target='_blank';link.rel='noopener';figure.append(link);}return figure;
}
function topicExpansion(t,{excludeVisualIds=[],full=false}={}){
 const section=el('section',undefined,'topic-expansion');section.dataset.topicId=t.id;
 section.append(el('p',full?'专题课程':'本题关联专题','topic-eyebrow'),el(full?'h2':'h3',t.title),el('p',t.overview),topicDiagram(t));
 for(const g of t.foundations||[])section.append(foundationGuide(g));
 section.append(el('h4','把知识连起来'),el('p',t.connection),el('h4','易混点与适用边界'),el('p',t.boundary),el('h4','换个条件怎么考'),el('p',t.variant));
 const pictures=t.visualIds.map(id=>visualReferences.find(v=>v.id===id)).filter(v=>v&&!excludeVisualIds.includes(v.id));
 if(pictures.length){section.append(el('h4','图片与知识对照'),visualGallery(pictures.slice(0,4)));if(pictures.length>4){const more=el('details',undefined,'reading-detail');more.append(el('summary',`再看 ${pictures.length-4} 张相关图片`),visualGallery(pictures.slice(4)));section.append(more);}}
 if(full){const materials=markCourseReferences(t);if(materials)section.append(materials);}
 if(t.sourceFigures?.length){const originals=el('details',undefined,'reading-detail');originals.append(el('summary','对照学霸笔记中的相关原页图表'));for(const info of t.sourceFigures)originals.append(sourcePageFigure(info,referenceLabel(info.source,info.page)+' · 相关章节图表'));section.append(originals);}
 const recall=el('details',undefined,'reading-detail topic-recall');recall.append(el('summary','合上解析，试着复述这组知识'),el('p',t.recall));section.append(recall);
 const related=t.pointIds.map(id=>pointMap.get(id)).filter(p=>p&&p.status!=='needs-review');
 if(full&&related.length){section.append(el('h3','考点讲解与应用'));for(let i=0;i<related.length;i+=10){const part=el('details',undefined,'reading-detail lesson-facts');part.open=i===0;part.append(el('summary',`考点讲解 ${i+1}–${Math.min(i+10,related.length)} · ${related.slice(i,i+10).map(p=>p.title).slice(0,3).join('、')}`));for(const p of related.slice(i,i+10)){const article=el('article',undefined,'lesson-fact');article.append(el('h4',p.title),el('p',p.statement));if(p.studyGuide)article.append(conceptGuide(p.studyGuide));else if(p.reasoning)article.append(el('p',p.reasoning,'muted'));const controls=el('div',undefined,'actions');controls.append(action('查看考点与出处',()=>openPoint(p.id),'btn ghost'));if(p.questionIds.length)controls.append(action('练习应用',()=>startQuiz(p.questionIds.map(id=>questionMap.get(id)).filter(Boolean)),'btn secondary'));article.append(controls);part.append(article);}section.append(part);}}
 if(!full&&related.length){const links=el('details',undefined,'reading-detail');links.append(el('summary',`继续学这组知识 · ${related.length} 个考点`));const list=el('div',undefined,'topic-point-list');for(const p of related)list.append(action(p.title,()=>openPoint(p.id),'point-link'));links.append(list);section.append(links);}
 const sources=el('details',undefined,'reading-detail topic-sources');sources.append(el('summary','整理依据与资料出处'));sources.append(el('p','知识框架、关系说明、变式考法由本站整理；以下资料可用于对读。','muted'));
 for(const ref of t.refs){const link=el('a',referenceLabel(ref.source,ref.page));link.href=sourceLink(ref.source,ref.page);link.target='_blank';link.rel='noopener';sources.append(el('p'),link);}
 for(const [index,url] of t.authorities.entries()){const link=el('a','权威依据 '+(index+1)+' ↗');link.href=url;link.target='_blank';link.rel='noopener';sources.append(el('p'),link);}section.append(sources);
 const actions=el('div',undefined,'actions');if(!full)actions.append(action('打开完整专题',()=>openTopic(t.id),'btn secondary'));
 if(t.questionIds.length)actions.append(action(`连续练这组知识 · ${t.questionIds.length} 题`,()=>startQuiz(t.questionIds.map(id=>questionMap.get(id)).filter(Boolean)),'btn secondary'));section.append(actions);
 if(full&&t.relatedTopicIds.length){section.append(el('h4','同学科的其他知识体系'));const links=el('div',undefined,'topic-point-list');for(const id of t.relatedTopicIds){const related=topicMap.get(id);if(related)links.append(action(related.title,()=>openTopic(id),'point-link'));}section.append(links);}return section;
}
function openTopic(id){
 const t=topicMap.get(id);if(!t)return;captureLessonSections();currentTopic=t;currentPoint=null;currentChapter=null;currentModule=t.module;directoryMode='subjects';
 $('moduleLesson').classList.add('hidden');$('chapterLesson').classList.add('hidden');$('pointLesson').classList.remove('hidden');
 const box=$('pointLesson');box.replaceChildren();const nav=el('nav',undefined,'point-navigation');nav.setAttribute('aria-label','专题阅读导航');const path=el('div',undefined,'point-path'),controls=el('div',undefined,'point-navigation-actions');path.append(action(moduleMap[t.module].title+' · 返回学科',()=>openLesson(t.module),'point-breadcrumb'));controls.append(action('查看课程目录',()=>{$('courseSidebar').scrollIntoView({block:'start',behavior:'auto'});},'btn ghost'));nav.append(path,controls);box.append(nav,topicExpansion(t,{full:true}));renderCourseDirectory();show('lesson',false,{view:'lesson',module:t.module,topic:id});renderCourseActions();$('courseContent').scrollIntoView({block:'start',behavior:'auto'});
}

function renderModuleVisuals(id){
 const items=visualReferences.filter(image=>image.moduleIds.includes(id)),topics=[...topicMap.values()].filter(t=>t.module===id&&!t.overviewOnly),box=$('lessonVisuals');box.replaceChildren();box.classList.toggle('hidden',!items.length&&!topics.length);$('lessonViewImages').classList.toggle('hidden',!items.length&&!topics.length);
 $('lessonViewImages').textContent=`图解与图片 · ${topics.length} 个专题${items.length?' · '+items.length+' 张图片':''}`;
 box.append(el('h3','专题图解与图片学习'),el('p','先建立知识框架，再用实物图片和原页图表理解。专题中有相关概念、易混点、变式考法和连续练习入口。','muted'));
 for(const t of topics){const detail=el('details',undefined,'reading-detail topic-preview');detail.append(el('summary',t.title),el('p',t.overview),topicDiagram(t),action('学习完整专题',()=>openTopic(t.id),'btn secondary'));box.append(detail);}
 if(items.length)box.append(el('h3','实物、作品与科学图片'),visualGallery(items,true));
}
const LEGACY_KEY = 'gongji-study-v1';
const emptyState = () => ({ planDay: 1, learned: {}, attempts: {} });
let state = emptyState();
let accountReady = false;
let lastRevision = -1;
let pendingAnswer = null;
let signedIn = false;
let accountId = null, answerOutbox = [], syncing = false, syncTimer = null, syncError = false;
const sessionDeviceId=crypto.randomUUID();let deviceSequence=0;
const questionMap = new Map(STUDY.questions.map((q) => [q.id, q]));
let currentModule = 'm01';
let currentChapter = null, chapterPage = 0;
const chapterMap = Object.fromEntries([...STUDY.curriculum, ...(STUDY.books || [])].map((chapter) => [chapter.id, chapter]));
for(const [oldId,newId] of Object.entries(STUDY.readingAliases||{}))if(chapterMap[newId])chapterMap[oldId]=chapterMap[newId];
let queue = [], questionVisits = [], practicePool = [], at = 0, sessionCorrect = 0, answered = false;
let endless = true, sessionAnswered = 0, displayCorrectIndex = 0, displayOrder = [];
let recentQuestions = [], lastConcept = null, selectedChoices = new Set();
let practiceActive = false;
const navigationSessionId=crypto.randomUUID();
let navigationEntries = [{route:{view:'home'},scroll:0}], navigationIndex = 0;
let navigationInitializing = true, navigationRestoring = false, navigationRestoreVersion = 0;
const correctChoices = q => q.answers || [q.answer];
function choiceCorrect(q,choice) {const selected=Array.isArray(choice)?choice:[choice],expected=correctChoices(q);return selected.length===expected.length&&expected.every(index=>selected.includes(index));}
function typeFiltered(items) {const type=$('quizType').value||'mixed';return items.filter(q=>type==='mixed'||(type==='multiple')===!!q.answers);}

function notice(message) {
  $('storageNotice').textContent = message;
  $('storageNotice').classList.remove('hidden');
}

function accountMessage(message, login = false) {
  $('accountEntry').textContent = signedIn ? '我的学习账号' : '登录并同步错题';
  $('accountEntry').onclick=()=>{$('accountEntry').href='/account?returnTo='+encodeURIComponent(navigationUrl(navigationEntries[navigationIndex].route));};
  const box = $('accountStatus');
  box.replaceChildren();
  box.append(document.createTextNode(message));
  if (login) {
    const link = document.createElement('a');
   link.href = '/account';link.onclick=()=>{link.href='/account?returnTo='+encodeURIComponent(navigationUrl(navigationEntries[navigationIndex].route));};
    link.textContent = ' 登录并同步学习记录 →';
    box.append(link);
  } else if (signedIn) {
    const link = document.createElement('a'); link.href = '/account'; link.textContent = ' 查看账号 →'; box.append(link);
  }
}

async function loadAccount() {
  const wasSignedIn=signedIn;
  try {
    const response = await fetch('/api/progress', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) {
      accountReady = true;
      signedIn = false;
      accountMessage('当前尚未登录。登录后可在不同设备同步课程进度与错题。', true);
      renderHome();
      return;
    }
    if (!response.ok) throw new Error('学习记录暂时无法读取');
    let data = await response.json();
    accountId = data.accountId;
    signedIn = true;
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const imported = await sendAction({ type: 'import', state: JSON.parse(legacy) });
        data = imported;
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (error) {
      notice('旧版浏览器记录暂未迁入账号，请保留本浏览器数据并稍后刷新重试。');
    }
    state = data.state; lastRevision = data.revision;
    try { answerOutbox = JSON.parse(localStorage.getItem('gongji-answer-drafts:' + accountId) || '[]').filter((a) => a.type === 'answer' && typeof a.questionId==='string' && (Array.isArray(a.choice) ? a.choice.length>0 && a.choice.every(i=>Number.isInteger(i)&&i>=0&&i<4) : Number.isInteger(a.choice)&&a.choice>=0&&a.choice<4) && typeof a.mutationId === 'string'); } catch { answerOutbox = []; }
    rebasePending(); updateSyncStatus();
    accountReady = true;
    accountMessage('已登录。课程进度、答题记录和错题保存在你的账号中，可跨设备同步。');
    renderHome();
    if(!wasSignedIn&&navigationEntries[navigationIndex].route.view==='interview')renderInterview(navigationEntries[navigationIndex].route);
    try{const pending=JSON.parse(sessionStorage.getItem('gongji-pending-practice')||'null');sessionStorage.removeItem('gongji-pending-practice');if(pending&&Array.isArray(pending.ids)){if(['mixed','single','multiple'].includes(pending.type))$('quizType').value=pending.type;const ids=new Set(pending.ids);startQuiz(STUDY.questions.filter(q=>ids.has(q.id)),pending.mode==='specific'?'specific':'endless');}}catch{}
    if (answerOutbox.length) void flushAnswers();
  } catch (error) {
    accountReady = false;
    accountMessage('学习记录暂时无法读取。请刷新页面重试；此时答题不会开始。');
    $('accountStatus').append(action('重试加载',()=>loadAccount(),'btn ghost'));
  }
}

function requireAccount() {
  if (!accountReady) { notice('正在加载账号学习记录，请稍候再试。'); return false; }
  if (!signedIn) { window.location.href = '/account?returnTo='+encodeURIComponent(navigationUrl(navigationEntries[navigationIndex].route)); return false; }
  return true;
}

async function sendAction(action) {
  const response = await fetch('/api/progress', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutationId: crypto.randomUUID(), expectedAccountId: accountId, ...action }),
  });
  if (response.status === 401) {
    signedIn = false;
    accountMessage('登录状态已失效。请重新登录以继续保存学习记录。', true);
    throw new Error('登录状态已失效');
  }
  if(response.status===409){const error=await response.json();if(error.error?.startsWith('Account changed')){signedIn=false;accountMessage('账号已切换，请刷新页面；未同步记录仍属于原账号。',true);}throw new Error('记录暂未保存，请重试');}
  if (!response.ok) throw new Error('保存失败，请稍后重试');
  return response.json();
}

async function persist(action) {
  const data = await sendAction(action);
  if (data.revision >= lastRevision) { state = data.state; lastRevision = data.revision; rebasePending(); }
  $('storageNotice').classList.add('hidden');
  return data;
}

function applyOptimisticAnswer(action) {
  if (state.receipts?.[action.mutationId] || (action.deviceId && action.sequence <= (state.deviceCursors?.[action.deviceId]||0))) return;
  const q = questionMap.get(action.questionId); if (!q || (q.revision && action.questionRevision!==q.revision)) return;
  const ok = choiceCorrect(q,action.choice), old = state.attempts[q.id] || {count:0,wrong:0,streak:0};
  const streak = ok ? old.streak + 1 : 0, now = action.at || Date.now();
  state.attempts[q.id] = {count:old.count+1,wrong:old.wrong+(ok?0:1),streak,lastCorrect:ok,lastQuestionRevision:q.revision||'',lastChoiceText:(Array.isArray(action.choice)?action.choice:[action.choice]).map(i=>q.options[i]),lastChoice:Array.isArray(action.choice)?[...action.choice]:action.choice,lastAt:now,due:ok?now+[0,1,3,7,14,30][Math.min(streak,5)]*86400000:now};
  state.receipts ??= {}; state.receipts[action.mutationId] = {correct:ok,localDraft:true};
}
function rebasePending() { for (const action of answerOutbox) applyOptimisticAnswer(action); }
function storeAnswerDrafts() {
  if (!accountId) return;
  try { if (answerOutbox.length) localStorage.setItem('gongji-answer-drafts:' + accountId, JSON.stringify(answerOutbox)); else localStorage.removeItem('gongji-answer-drafts:' + accountId); }
  catch { notice('未同步答案暂存失败，请保持本页打开，点击重试同步。'); }
}
function updateSyncStatus() {
  $('syncStatus').textContent = answerOutbox.length ? `${answerOutbox.length} 条答题记录${syncError ? '暂未同步，点击重试' : '正在后台同步'}，你可以继续答题。` : '答题记录已同步到账号';
  $('retrySync').classList.toggle('hidden', !syncError);
}
async function flushAnswers() {
  if (syncing || !signedIn || !answerOutbox.length) return;
  syncing = true; syncError = false; updateSyncStatus();
  const sent = answerOutbox.slice(0,20), ids = new Set(sent.map((a) => a.mutationId));
  try {
    const data = await sendAction({type:'answers',actions:sent});
    if (data.accountId !== accountId) throw new Error('账号已变化，请刷新页面');
    answerOutbox = answerOutbox.filter((a) => !ids.has(a.mutationId));
    if (data.revision >= lastRevision) { state = data.state; lastRevision = data.revision; rebasePending(); }
    storeAnswerDrafts();
  } catch { syncError = true; storeAnswerDrafts(); }
  finally { syncing = false; updateSyncStatus(); }
  if (answerOutbox.length && !syncError) { clearTimeout(syncTimer); syncTimer = setTimeout(() => void flushAnswers(),250); }
}

function sourceLink(source, page) { const s=sourceMap[source];if(s.kind==='mark'){const unit=s.units.find(u=>page>=u.start&&page<=u.end);return 'study.html?view=materials&doc='+encodeURIComponent(source)+(unit?'&unit='+encodeURIComponent(unit.id):'');}return s.url || ('source.html?source=' + encodeURIComponent(source) + '&page=' + page); }
function referenceLabel(source,page) {const s=sourceMap[source];return s.url?`${s.name} · 核对 ${s.checkedAt}`:`${s.name} · PDF 第 ${page} 页`; }
function countCorrect(module) { return STUDY.questions.filter((q) => (!module || q.module === module) && questionAttempt(q)?.lastCorrect).length; }
function wrongQuestions() { return STUDY.questions.filter((q) => state.attempts[q.id] && !state.attempts[q.id].lastCorrect); }
function dueQuestions() { const now = Date.now(); return STUDY.questions.filter((q) => state.attempts[q.id] && (!state.attempts[q.id].lastCorrect || state.attempts[q.id].due <= now)); }
function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }

function selectNextQuestion() {
  // Read the account's latest returned attempts for every draw. There is no round to reshuffle.
  const fresh = practicePool.filter((q) => !questionAttempt(q)?.count);
  let candidates;
  if (fresh.length) {
    // Every independently assessed point counts, including all four options in
    // authored comparison questions. Prioritize the largest uncovered set.
    const practicedPoints = new Set(STUDY.questions.filter(q => questionAttempt(q)?.count).flatMap(q => q.pointIds || []));
    const uncovered = q => (q.pointIds || []).filter(id => !practicedPoints.has(id)).length;
    const maximum = Math.max(...fresh.map(uncovered));
    candidates = fresh.filter(q => uncovered(q) === maximum);
    const practicedConcepts = new Set(STUDY.questions.filter(q => questionAttempt(q)?.count).map(q => q.concept || q.id));
    const freshConcepts = candidates.filter(q => !practicedConcepts.has(q.concept || q.id));
    if (freshConcepts.length) candidates = freshConcepts;
  } else {
    const recentCount = Math.min(20, Math.max(1, Math.floor(practicePool.length / 3)));
    const recent = new Set(recentQuestions.slice(-recentCount));
    candidates = practicePool.filter((q) => !recent.has(q.id));
    if (!candidates.length) candidates = practicePool;
    const least = Math.min(...candidates.map((q) => questionAttempt(q)?.count || 0));
    candidates = candidates.filter((q) => (questionAttempt(q)?.count || 0) === least);
    const due = candidates.filter((q) => !questionAttempt(q)?.lastCorrect || questionAttempt(q)?.due <= Date.now());
    if (due.length) candidates = due;
    // Review an older subset at random instead of replaying an identical ordered round.
    candidates = candidates.sort((a,b) => (questionAttempt(a)?.lastAt || 0) - (questionAttempt(b)?.lastAt || 0));
    candidates = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
  }
  const different = candidates.filter((q) => (q.concept || q.id) !== lastConcept);
  if (different.length) candidates = different;
  return shuffle(candidates)[0];
}

function navigationUrl(route) {
 const params=new URLSearchParams();
 params.set('view',route.view);
 if(route.point)params.set('point',route.point);
 if(route.topic)params.set('topic',route.topic);
 if(route.module)params.set('module',route.module);
 if(route.chapter){params.set('chapter',route.chapter);params.set('page',route.page);}
 if(route.setup)params.set('setup','1');
 if(route.doc)params.set('doc',route.doc);
 if(route.unit)params.set('unit',route.unit);
 return (window.location.pathname||'study.html')+'?'+params.toString();
}
function saveNavigationEntry() {
 const entry=navigationEntries[navigationIndex];
 entry.scroll=window.scrollY||0;entry.sidebarScroll=$('courseSidebar').scrollTop||0;
 entry.timeline=selectedTimeline;
 entry.coverage={module:$('coverageModule').value,status:$('coverageStatus').value,search:$('coverageSearch').value,limit:coverageLimit};
}
function rememberNavigation(route) {
 if(navigationRestoring)return;
 if(navigationInitializing){navigationEntries[0]={route,scroll:0};window.history?.replaceState({gongjiStudyNavigation:navigationSessionId,index:0},'',navigationUrl(route));return;}
 if(JSON.stringify(navigationEntries[navigationIndex].route)===JSON.stringify(route))return;
 saveNavigationEntry();navigationEntries.splice(navigationIndex+1);navigationEntries.push({route,scroll:0});navigationIndex++;
 window.history?.pushState({gongjiStudyNavigation:navigationSessionId,index:navigationIndex},'',navigationUrl(route));
}
function updateReadingNavigation() {
 const entry=navigationEntries[navigationIndex];
 if(entry.route.chapter===currentChapter?.id){entry.route.page=chapterPage;window.history?.replaceState({gongjiStudyNavigation:navigationSessionId,index:navigationIndex},'',navigationUrl(entry.route));}
}
function returnLabel(route) {
 if(route.view==='quiz')return !practiceActive?'返回练习方式':route.setup?'返回练习设置':'返回刷题';
 if(route.point)return '返回知识点';
 if(route.topic)return '返回知识专题';
 if(route.chapter)return '返回资料阅读';
 if(route.view==='interview')return route.doc==='practice'?'返回面试练习':route.doc?'返回题型框架':'返回面试目录';
 return {home:'返回学科目录',lesson:'返回课程讲解',library:'返回资料目录',materials:'返回马克资料',wrong:'返回错题复习',coverage:'返回知识点覆盖',tools:'返回时间线与方法'}[route.view]||'返回上一页';
}
function renderNavigationReturn(view) {
 const previous=navigationEntries[navigationIndex-1];
 for(const id of ['navigationReturn','lessonReturn']){
  const box=$(id);box.replaceChildren();
  if(previous)box.append(action(returnLabel(previous.route),goBack,'btn secondary'));
  if(practiceActive&&view!=='quiz'&&previous?.route.view!=='quiz')box.append(action('返回当前题',resumePractice,'btn'));
  box.classList.toggle('hidden',!box.children.length||(id==='navigationReturn'&&view==='lesson'));
 }
 $('lesson').classList.toggle('has-return-navigation',!!$('lessonReturn').children.length);
 $('resumePractice').classList.toggle('hidden',!practiceActive);
 $('homeEndless').textContent=practiceActive?'继续当前练习':'一直随机刷题';
 $('startEndless').textContent=practiceActive?'重新开始随机刷题':'一直随机刷题';
}
async function restoreNavigation(index) {
 const entry=navigationEntries[index];if(!entry)return;
 saveNavigationEntry();navigationIndex=index;navigationRestoring=true;const version=++navigationRestoreVersion;
 try {
  const route=entry.route;selectedTimeline=entry.timeline||selectedTimeline;
  if(entry.coverage){for(const [name,id] of [['module','coverageModule'],['status','coverageStatus'],['search','coverageSearch']])$(id).value=entry.coverage[name];coverageLimit=entry.coverage.limit;}
  if(route.topic)openTopic(route.topic);
  else if(route.point)openPoint(route.point);
  else if(route.chapter)await openChapter(route.chapter,route.page);
  else if(route.module)openLesson(route.module);
  else if(route.view==='lesson')openCourses();
  else show(route.view,false,route);
  if(version!==navigationRestoreVersion)return;
  $('courseSidebar').scrollTop=entry.sidebarScroll||0;window.scrollTo({top:entry.scroll||0,behavior:'auto'});
 } finally {if(version===navigationRestoreVersion){navigationRestoring=false;renderNavigationReturn(entry.route.view);}}
}
function goBack() {
 if(navigationIndex<=0)return;
 if(window.history?.back)window.history.back();
 else void restoreNavigation(navigationIndex-1);
}
window.addEventListener('popstate',event=>{
 if(event.state?.gongjiStudyNavigation===navigationSessionId&&navigationEntries[event.state.index])void restoreNavigation(event.state.index);
 else window.location.reload?.();
});
function show(view,scroll=true,route={view}) {
 if(view!=='interview')interviewStopClock();
 rememberNavigation(route);
 document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === view));
 document.querySelectorAll('.nav button[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
 document.querySelectorAll('.nav button[data-view]').forEach((el) => {if(el.dataset.view===view)el.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});});
 if (view === 'home') renderHome();
 if (view === 'library') renderLibrary();
 if (view === 'materials') void renderMark(route);
 if (view === 'interview') {interviewStopClock();renderInterview(route);}
 if (view === 'wrong') renderWrong();
 if (view === 'quiz') {
  if(practiceActive&&!route.setup){$('quizSetup').classList.add('hidden');$('quizPlay').classList.remove('hidden');}
  else showQuizSetup();
 }
 if (view === 'tools') renderTools();
 if (view === 'coverage') renderCoverage();
 renderNavigationReturn(view);
 if(scroll)window.scrollTo({ top: 0, behavior: 'auto' });
}
function resumePractice() {
 if(!practiceActive)return false;
 const entry=[...navigationEntries.slice(0,navigationIndex+1)].reverse().find(e=>e.route.view==='quiz'&&!e.route.setup);
 show('quiz',false);window.scrollTo({top:entry?.scroll||0,behavior:'auto'});return true;
}
function openPractice(){if(!resumePractice())startEndless();}
function showPracticeSettings(){show('quiz',true,{view:'quiz',setup:true});}
function endPractice(){practiceActive=false;show('home');}

function renderHome() {
 $('statLessons').textContent=Object.keys(state.learned).filter(id=>state.learned[id]&&(moduleMap[id]||pointMap.has(id)||chapterMap[id])).length;
 $('statCorrect').textContent=STUDY.knowledge.filter(pointCorrect).length;
 $('statWrong').textContent=wrongQuestions().length;
 $('contentCoverage').textContent=`${STUDY.modules.length} 个课程单元 · ${STUDY.knowledge.length} 个已整理考点 · ${STUDY.questions.length} 道题 · ${STUDY.curriculum.length} 个资料章节。${STUDY.coverage.withQuestions} 个考点均已配练习；在“知识点覆盖”查看各考点题目和已练进度。`;
 const sources=$('sourceCoverage');sources.replaceChildren();
 if(STUDY.coverage.jilinPoints){const p=el('p','吉林省情专题');p.append(el('span',`${STUDY.coverage.jilinPoints} 个考点 · ${STUDY.coverage.jilinQuestions} 道原创练习 · ${STUDY.webSources.length} 项官方来源`));sources.append(p);}
 if(markLibrary.documents.length){const p=el('p','马克资料合集');p.append(el('span',`${markLibrary.stats.files} 份非视频文件 · ${markLibrary.stats.documents} 组学习资料 · ${markLibrary.stats.units} 节`),action('打开学习馆',()=>openMark(),'point-link'),action('马克资料专项 · '+STUDY.markQuiz.questions+' 题',()=>startMarkQuiz(),'point-link'));sources.append(p);}
 const interviewEntry=el('p','结构化面试');interviewEntry.append(el('span','8 个框架模块 · '+interviewLibrary.questions.length+' 道真题 · 提纲与复盘'),action('进入面试学习',()=>openInterview(),'point-link'));sources.append(interviewEntry);
 for(const source of STUDY.sources){const p=el('p',source.name);p.append(el('span',`${source.pages} 页可读资料 · ${STUDY.questions.filter(q=>q.source===source.id).length} 道题附出处`));sources.append(p);}
 const grid=$('moduleGrid');grid.className='subject-grid';grid.replaceChildren();
 SUBJECTS.forEach(([title,ids],index)=>{
   const card=el('section',undefined,'subject-card');card.append(el('span',String(index+1).padStart(2,'0'),'subject-number'),el('h3',title));
   const points=STUDY.knowledge.filter(p=>ids.includes(p.module));card.append(el('p',`已练 ${points.filter(pointDone).length} / ${points.length} 个考点`,'muted small'));
   for(const id of ids)card.append(action(moduleMap[id].title,()=>openLesson(id),'subject-link'));
   const actions=el('div',undefined,'actions');actions.append(action('连续练习',()=>startQuiz(STUDY.questions.filter(q=>ids.includes(q.module)))));card.append(actions);grid.append(card);
 });
}

function courseChapters(moduleId) {
  const source = $('courseBook').value || 'all';
  const query = $('courseSearch').value.trim();
  return STUDY.curriculum.filter((chapter) => (!moduleId || chapter.module === moduleId) &&
    (source === 'all' || chapter.source === source) &&
    (!query || chapter.title.includes(query) || moduleMap[chapter.module]?.title.includes(query)));
}
function openCourse(id) { openLesson(id); }
function openCourses() {if(currentChapter){openChapter(currentChapter.id,chapterPage);return;}if(currentTopic){openTopic(currentTopic.id);return;}if(currentPoint)openPoint(currentPoint.id);else openLesson(currentModule);}
function renderCourseDirectory() {
 $('directoryHelp').textContent='展开模块，进入专题课程；搜索可直达考点。目录会保留展开位置。';$('courseSearchLabel').textContent='查找专题或考点';
 if(directoryMode==='books'){renderReadingDirectory();return;}
 $('directoryTitle').textContent='学科 · 模块 · 专题';$('directorySubjects').classList.add('active');$('directoryBooks').classList.remove('active');$('courseSearch').placeholder='搜索专题或考点，如四项基本原则';
 const box=$('courseDirectory'),query=$('courseSearch').value.trim();
 if(directoryQuery===query&&box.children.length){updateDirectorySelection();return;}
 const scrollTop=$('courseSidebar').scrollTop;captureDirectory();directoryQuery=query;
 box.replaceChildren();directoryModules.clear();directoryGroups.clear();directoryPointButtons.clear();directoryTopicButtons.clear();
 let matches=0;
 for(const [subject,ids] of SUBJECTS){
  const matched=ids.filter(id=>!query||moduleMap[id].title.includes(query)||moduleTopics(id).some(t=>t.title.includes(query))||modulePoints[id].some(p=>p.title.includes(query)||p.statement.includes(query)));
  if(!matched.length)continue;box.append(el('h3',subject));
  for(const id of matched){
   const unit=el('details',undefined,'directory-module');rememberDisclosure(unit,'module:'+id,id===currentModule,!!query);if(query)unit.open=true;
   const summary=el('summary');summary.append(el('span',moduleMap[id].title,'directory-module-title'));unit.append(summary);
   unit.append(action('阅读模块讲解',()=>openLesson(id),'directory-overview'));
   for(const t of moduleTopics(id)){
    const all=t.pointIds.map(pid=>pointMap.get(pid)),list=all.filter(p=>!query||moduleMap[id].title.includes(query)||t.title.includes(query)||p.title.includes(query)||p.statement.includes(query));
    if(!list.length)continue;matches+=list.length;
    const key=sectionKey(id,t.title),details=el('details',undefined,'book-directory');rememberDisclosure(details,'group:'+key,t.id===currentTopic?.id||all.some(p=>p.id===currentPoint?.id),!!query);if(query)details.open=true;
    const heading=el('span',undefined,'directory-heading');heading.append(el('span',t.title,'directory-title'),el('span',`${all.length} 个考点`,'directory-count'));const label=el('summary');label.append(heading);details.append(label);
    const button=action('学习完整专题',()=>openTopic(t.id),'directory-overview');directoryTopicButtons.set(t.id,button);details.append(button);
    if(query){for(const p of list){const b=action(p.title,()=>openPoint(p.id),'subtopic');directoryPointButtons.set(p.id,b);details.append(b);}}
    directoryGroups.set(key,details);unit.append(details);
   }
   directoryModules.set(id,unit);box.append(unit);
  }
 }
 const count=[...topicMap.values()].filter(t=>t.pointIds.length&&!t.overviewOnly).length;
 $('courseDirectoryMeta').textContent=query?`找到 ${matches} 个考点`:`${SUBJECTS.length} 门学科 · ${STUDY.modules.length} 个模块 · ${count} 个专题`;
 if(!box.children.length)box.append(el('p','没有匹配内容，请换关键词。'));
 updateDirectorySelection();$('courseSidebar').scrollTop=scrollTop;
}
function updateDirectorySelection(){
 if(previousDirectoryPoint){const old=directoryPointButtons.get(previousDirectoryPoint);if(old){old.classList.remove('current');old.removeAttribute('aria-current');}}
 if(previousDirectoryModule)directoryModules.get(previousDirectoryModule)?.children[0].classList.remove('current');
 const unit=directoryModules.get(currentModule);if(unit){unit.children[0].classList.add('current');if(previousDirectoryModule!==currentModule)unit.open=true;}
 for(const [id,button] of directoryPointButtons){const p=pointMap.get(id);button.textContent=`${pointDone(p)?'✓ ':''}${p.title}`;}
 for(const [tid,b] of directoryTopicButtons){const selected=tid===(currentTopic?.id||STUDY.pointTopics?.[currentPoint?.id]);b.classList.toggle('current',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 if(currentPoint){const button=directoryPointButtons.get(currentPoint.id);if(button){button.classList.add('current');button.setAttribute('aria-current','page');}if(previousDirectoryPoint!==currentPoint.id){const group=directoryGroups.get(sectionKey(currentModule,pointGroup(currentPoint)));if(group)group.open=true;if(unit)unit.open=true;}}
 if(currentTopic&&previousDirectoryTopic!==currentTopic.id){const group=directoryGroups.get(sectionKey(currentModule,currentTopic.title));if(group)group.open=true;}
 previousDirectoryTopic=currentTopic?.id||null;
 previousDirectoryPoint=currentPoint?.id||null;previousDirectoryModule=currentModule;
 captureDirectory();saveCourseNavigation();
}
function locateCurrentPoint(){
 if(directoryMode==='books'){for(const b of $('courseDirectory').children)if(b.dataset?.chapterId===currentChapter?.id)b.scrollIntoView({block:'nearest',behavior:'auto'});return;}
 const unit=directoryModules.get(currentModule);if(unit)unit.open=true;
 if(currentPoint){const group=directoryGroups.get(sectionKey(currentModule,pointGroup(currentPoint)));if(group)group.open=true;(directoryPointButtons.get(currentPoint.id)||directoryTopicButtons.get(STUDY.pointTopics[currentPoint.id]))?.scrollIntoView({block:'nearest',behavior:'auto'});}
 else unit?.scrollIntoView({block:'nearest',behavior:'auto'});
 captureDirectory();saveCourseNavigation();
}
function showCourseContent(target){const route=target==='pointLesson'?{view:'lesson',point:currentPoint.id}:target==='chapterLesson'?{view:'lesson',chapter:currentChapter.id,page:chapterPage}:{view:'lesson',module:currentModule};show('lesson',false,route);renderCourseActions();$('courseContent').scrollIntoView({behavior:'auto',block:'start'});}
function chapterQuestions(chapter){
 const pointIds=new Set(STUDY.knowledge.filter(p=>p.chapters?.includes(chapter.id)||(p.source===chapter.source&&p.page>=chapter.start&&p.page<=chapter.end)).map(p=>p.id));
 return STUDY.questions.filter(q=>(q.pointIds||[]).some(id=>pointIds.has(id))||[{source:q.source,page:q.page},...(q.optionRefs||[])].some(r=>r.source===chapter.source&&r.page>=chapter.start&&r.page<=chapter.end));
}
function renderCourseActions(){
 const box=$('courseActions');box.replaceChildren();
 box.append(action('打开目录',()=>{locateCurrentPoint();$('courseSidebar').scrollIntoView({behavior:'auto',block:'start'});$('courseSearch').focus({preventScroll:true});},'btn secondary'));
 const bank=currentChapter?chapterQuestions(currentChapter):currentPoint?STUDY.questions.filter(q=>q.pointIds.includes(currentPoint.id)):currentTopic?STUDY.questions.filter(q=>q.pointIds.some(id=>currentTopic.pointIds.includes(id))):STUDY.questions.filter(q=>q.module===currentModule);
 const label=currentChapter?'本章关联知识':currentPoint?'此考点':currentTopic?'此专题':'本单元';
 const practice=action(`练${label} · ${bank.length}题`,()=>startQuiz(bank),'btn');practice.disabled=!bank.length;box.append(practice);
 if(currentPoint||currentTopic||currentChapter)box.append(action('单元总览',()=>openLesson(currentModule),'btn ghost'));
}
function correctionNotice(row){const box=el('aside',undefined,'content-correction');box.append(el('strong','知识订正 · '+row.title),el('p',row.correction),el('p',row.statement),el('p',row.reasoning));const a=el('a','核对权威依据 ↗','point-link');a.href=row.authority;a.target='_blank';a.rel='noopener';box.append(a);return box;}
function renderGuide(id) {
 const g=STUDY.guides[id],box=$('lessonGuide');box.replaceChildren();
 box.append(el('p',g.thesis,'thesis'));box.append(el('h3','理解这门课的主线'));
 g.reasoning.forEach((text,i)=>box.append(el('p',`${i+1}. ${text}`)));
 box.append(el('h3','把易混概念放在一起看'));
 const table=el('table',undefined,'compare-table');const head=el('tr');['概念','含义','判断时看什么'].forEach(t=>head.append(el('th',t)));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
 g.compare.forEach(row=>{const tr=el('tr');row.forEach(t=>tr.append(el('td',t)));body.append(tr);});table.append(body);const scroll=el('div',undefined,'table-scroll');scroll.append(table);box.append(scroll);
 box.append(el('h3','案例：一步一步推导'),el('p',g.case[0],'case-prompt'),el('p',g.case[1]));
 const transfer=el('details',undefined,'reading-detail');transfer.append(el('summary','换个问法，合上解析再说一遍'),el('p',g.case[2]));box.append(transfer);
 box.append(el('h3','这门课怎么学'),el('p',g.method,'method-box'));
 const links=el('div',undefined,'actions');links.append(action('时间线、事件线与方法',()=>{selectedTimeline=STUDY.timelines.find(t=>t.module===id)?.id||'history';show('tools');}),action('查看本单元考点覆盖',()=>{$('coverageModule').value=id;show('coverage');}));box.append(links);
}
function renderLessonPoints(id) {
 captureLessonSections();const box=$('lessonPoints');box.replaceChildren();const points=modulePoints[id],topics=moduleTopics(id);
 box.append(el('h3',`本模块 ${topics.length} 个专题 · ${points.length} 个考点`),el('p','沿专题建立框架，再学习具体考点。每个专题包含基础内容、概念关系、易混辨析与练习。','muted'));
 let sectionIndex=0;
 for(const t of topics){const list=t.pointIds.map(pid=>pointMap.get(pid));const detail=el('details',undefined,'reading-detail course-section');rememberDisclosure(detail,'lesson:'+sectionKey(id,t.title),sectionIndex===0);const summary=el('summary');const heading=el('span',undefined,'section-heading');heading.append(el('span',t.title,'section-title'),el('span',`${list.length} 个考点 · 已练 ${list.filter(pointDone).length} 个`,'section-meta'));summary.append(el('span',String(++sectionIndex).padStart(2,'0'),'section-index'),heading);detail.append(summary,el('p',t.overview),topicDiagram(t));
   for(const g of t.foundations||[])detail.append(foundationGuide(g));
   detail.append(el('p',t.connection),el('p','易混点：'+t.boundary,'method-box'));
   const links=el('div',undefined,'actions');links.append(action('学习完整专题',()=>openTopic(t.id),'btn'));if(t.questionIds.length)links.append(action('连续练这个专题',()=>startQuiz(t.questionIds.map(qid=>questionMap.get(qid)).filter(Boolean)),'btn secondary'));detail.append(links);box.append(detail);}
 const ref=el('details',undefined,'reading-detail');ref.append(el('summary',id==='m14'?'需要核对时：吉林专题官方来源':'需要核对时：本单元的资料章节'));const list=el('div',undefined,'chapter-links');
 for(const c of STUDY.curriculum.filter(c=>c.module===id))list.append(action(`${c.title} · ${sourceMap[c.source].name}`,()=>openChapter(c.id),'btn ghost'));if(id==='m14'){for(const s of STUDY.webSources){const a=el('a',s.name,'btn ghost');a.href=s.url;a.target='_blank';list.append(a);}}ref.append(list);box.append(ref);
}
function foundationGuide(guide){
 const section=el('section',undefined,'foundation-guide');section.dataset.foundationId=guide.id;section.append(el('h4','基础补全 · '+guide.title));
 const list=el('ol',undefined,'concept-members');for(const member of guide.members){const row=el('li');row.append(el('strong',member.name),el('p',member.meaning));list.append(row);}section.append(list,el('p','易混辨析：'+guide.distinction),el('p','回忆方法：'+guide.recall,'method-box'));
 if(guide.authority){const link=el('a','核对权威依据 ↗');link.href=guide.authority;link.target='_blank';link.rel='noopener';section.append(link);}return section;
}
function conceptGuide(guide) {
 const section=el('section',undefined,'concept-guide');section.setAttribute('aria-label','考点的具体内容');
 section.append(el('h3','具体内容：逐项记忆'));const list=el('ol',undefined,'concept-members');
 for(const member of guide.members){const row=el('li');row.append(el('strong',member.name),el('p',member.meaning));list.append(row);}
 section.append(list,el('h4','易混辨析'),el('p',guide.distinction),el('h4','怎样记住'),el('p',guide.recall,'method-box'));return section;
}
function openPoint(id) {
 if(directoryMode!=='subjects'){directoryQuery=null;readerDirectorySource=null;}directoryMode='subjects';
 const p=pointMap.get(id);if(!p)return;captureLessonSections();currentTopic=null;currentPoint=p;currentModule=p.module;currentChapter=null;
 $('moduleLesson').classList.add('hidden');$('chapterLesson').classList.add('hidden');$('pointLesson').classList.remove('hidden');
 const box=$('pointLesson');box.replaceChildren();const nav=el('nav',undefined,'point-navigation');nav.setAttribute('aria-label','考点阅读导航');const path=el('div',undefined,'point-path');path.append(action(moduleMap[p.module].title,()=>openLesson(p.module),'point-breadcrumb'),el('span',pointGroup(p),'point-path-group'),action('目录',()=>{$('courseSidebar').scrollIntoView({block:'start',behavior:'auto'});locateCurrentPoint();},'point-directory-return'));const controls=el('div',undefined,'point-navigation-actions');const points=modulePoints[p.module],index=points.findIndex(item=>item.id===p.id);const previous=action('上一考点',()=>openPoint(points[index-1].id),'btn ghost'),next=action('下一考点',()=>openPoint(points[index+1].id),'btn secondary');previous.disabled=index===0;next.disabled=index===points.length-1;controls.append(el('span',`${index+1} / ${points.length}`,'point-position'),previous,next);nav.append(path,controls);box.append(nav);box.append(el('span',moduleMap[p.module].title,'badge'),el('h2',p.title),el('p',p.statement,'thesis'));
 if(p.studyGuide)box.append(conceptGuide(p.studyGuide));
 for(const g of p.prerequisites||[])box.append(foundationGuide(g));
 const pictures=pointPictures([p.id]);if(pictures.length)box.append(el('h3','图片对照'),visualGallery(pictures));
 const topic=topicMap.get(STUDY.pointTopics?.[p.id]);if(topic)box.append(topicExpansion(topic,{excludeVisualIds:pictures.map(v=>v.id)}));
 if(p.checkedAt)box.append(el('p',`官方资料核对：${p.checkedAt}${p.dataYear?' · 数据所属年度：'+p.dataYear:''}`,'muted small'));
 box.append(el('h3','怎样把这个考点学明白'));
 const s=p.statement,relation=s.match(/是|属于|包括|分为|决定|负责|称为|对应/);
 box.append(el('p',p.reasoning || (relation?`先圈出“${p.title}”和关系词“${relation[0]}”。分别回答：讨论的对象是谁、说明了哪种关系、结论适用于什么条件。不要把定义、组成、功能和原因混成同一种问题。`:'先用自己的话复述结论，再找题干的条件和限制词。记住答案后，还需要解释干扰项为什么不符合这个问题。')));
 const unit=STUDY.unitGuides[p.group||chapterMap[p.chapters[0]]?.title];if(unit){if(unit.explanation!==p.reasoning)box.append(el('p',unit.explanation));box.append(el('p',unit.method,'method-box'));}
 const qs=p.questionIds.map(id=>questionMap.get(id)).filter(Boolean),q=qs[0];
 if(q){box.append(el('h3','通过选项对照理解'));
   q.options.forEach((text,i)=>{const row=el('details',undefined,'reading-detail');row.append(el('summary',text),el('p',q.optionExplanations[i]));box.append(row);});
   box.append(el('h3','本题补充提醒'),el('p',q.extension));}
 box.append(el('h3','主动回忆'));
 const recall=el('details',undefined,'reading-detail');recall.append(el('summary',`合上材料：怎样解释“${p.title}”？它与相近概念有何不同？`),el('p',p.statement));box.append(recall);
 box.append(el('p',STUDY.guides[p.module].method,'method-box'));
 const a=el('a',`核对资料：${referenceLabel(p.source,p.page)}`);a.href=sourceLink(p.source,p.page);a.target='_blank';box.append(a);
 if(p.authority){const link=el('a','核对现行权威依据');link.href=p.authority;link.target='_blank';link.rel='noopener';box.append(el('p',p.correction||'本考点已结合现行依据整理。','muted'),link);}
 if(p.reviewReason&&p.status!=='ready')box.append(el('p',p.reviewReason,'method-box'));
 const actions=el('div',undefined,'actions');if(qs.length)actions.append(action('练这个考点',()=>startQuiz(qs),'btn'));actions.append(action('在本单元继续随机练',()=>startQuiz(STUDY.questions.filter(q=>q.module===p.module))),action('返回课程讲解',()=>openLesson(p.module)));box.append(actions);
 renderCourseDirectory();showCourseContent('pointLesson');
}

function renderUnitPicker() {
 $('unitMenuValue').textContent=moduleMap[currentModule].title;
 const options=$('unitMenuOptions');options.replaceChildren();
 for(const m of STUDY.modules){const button=action('',()=>{const scrollTop=$('unitMenuOptions').scrollTop;openLesson(m.id);if($('unitMenu').open)$('unitMenuOptions').children[STUDY.modules.findIndex(item=>item.id===m.id)].focus({preventScroll:true});$('unitMenuOptions').scrollTop=scrollTop;},'unit-option'+(m.id===currentModule?' current':''));
  button.setAttribute('aria-pressed',String(m.id===currentModule));const text=el('span',undefined,'unit-option-text');text.append(el('span',m.title,'unit-option-title'),el('span',`${modulePoints[m.id].length} 个考点`,'unit-option-count'));const check=el('span',m.id===currentModule?'✓':'','unit-option-check');check.setAttribute('aria-hidden','true');button.append(text,check);options.append(button);}
}

function openLesson(id) {
  currentTopic=null;
  if(directoryMode!=='subjects'){directoryQuery=null;readerDirectorySource=null;}directoryMode='subjects';
  currentModule = id; currentChapter = null; currentPoint = null; const module = moduleMap[id];
  $('pointLesson').classList.add('hidden'); renderGuide(id); renderLessonPoints(id); renderModuleVisuals(id);
  $('moduleLesson').classList.remove('hidden'); $('chapterLesson').classList.add('hidden');
  $('lessonSelect').value = id; renderUnitPicker(); $('lessonTitle').textContent = module.title; $('lessonGoal').textContent = module.goal;
  $('lessonReading').textContent = '建议阅读：' + module.reading;
  const refs = $('lessonRefs'); refs.replaceChildren();
  for (const [source, page] of module.refs) {
    const a = document.createElement('a'); a.href = sourceLink(source, page); a.target = '_blank';
    a.textContent = referenceLabel(source,page); refs.append(a);
  }
  const cards = $('lessonCards'); cards.replaceChildren();
  module.cards.forEach(([title, body], index) => {
    const el = document.createElement('div'); el.id = `lesson-card-${index}`; el.className = 'lesson-card';
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = body; el.append(h, p); cards.append(el);
  });
  const extracts = $('lessonExtracts'); extracts.replaceChildren();
  for (const [source, page] of module.refs) {
    const detail = document.createElement('details'); detail.className = 'reading-detail';
    const summary = document.createElement('summary'); summary.textContent = referenceLabel(source,page);
    const text = document.createElement('pre'); text.textContent = '展开后加载资料文字…';
    if(sourceMap[source].url){text.textContent=`官方来源：${sourceMap[source].name}\n发布时间：${sourceMap[source].published}\n本站核对：${sourceMap[source].checkedAt}\n课程已整理讲解、对照和练习，可打开官方网页核对原文。`;}
    detail.ontoggle = async () => {if(!detail.open||sourceMap[source].url)return;try{await loadSource(source);text.textContent=sourcePageMap.get(source+':'+page)||'本页没有可提取文字。';}catch{text.textContent='资料加载失败，请关闭后再展开重试。';}};
    const link = document.createElement('a'); link.href = sourceLink(source, page); link.target = '_blank'; link.textContent = sourceMap[source].url?'打开官方原文 ↗':'打开资料页并继续读前后页 ↗';
    detail.append(summary, text, link); extracts.append(detail);
  }
  const recall = $('lessonRecall'); recall.replaceChildren();
  for (const text of module.recall) { const li = document.createElement('li'); li.textContent = text; recall.append(li); }
  $('markLearned').textContent = state.learned[id] ? '已标记学过' : '标记已学';
  $('lessonQuiz').disabled = !STUDY.questions.some((q) => q.module === id);
  $('lessonQuiz').textContent = $('lessonQuiz').disabled ? '本单元暂无配套题' : '连续练本单元';
  renderCourseDirectory(); showCourseContent('moduleLesson');
}

async function openChapter(id, page) {
 currentTopic=null;
  const candidate=chapterMap[id];
  if(candidate?.isBook){const chapters=readingChapters(candidate.source);const target=chapters.find(c=>page>=c.start&&page<=c.end)||(page?chapters.find(c=>c.start>=page)||chapters.at(-1):chapters[0]);if(target)return openChapter(target.id,page&&page>=target.start?page:undefined);}
  currentChapter = candidate; if (!currentChapter) return;
  directoryMode='books';readingSource=currentChapter.source; currentPoint=null; $('pointLesson').classList.add('hidden');
  if (!currentChapter.isBook) currentModule = currentChapter.module;
  if ($('courseBook').value !== 'all') $('courseBook').value = currentChapter.source;
  const desiredPage=page||state.reading?.[id]?.page||currentChapter.start;
  chapterPage = chapterReadingPages(currentChapter).find(n=>n>=desiredPage)||chapterReadingPages(currentChapter).at(-1);
  $('moduleLesson').classList.add('hidden'); $('chapterLesson').classList.remove('hidden');
  renderChapter(); renderCourseDirectory(); showCourseContent('chapterLesson');
  const requested=currentChapter.id;try{await Promise.all([loadSource(currentChapter.source),loadEdition(currentChapter.source)]);if(currentChapter?.id===requested)renderChapter();}catch{if(currentChapter?.id===requested){$('chapterText').textContent='资料暂时加载失败，请重新打开本章重试。';$('chapterBody').replaceChildren(el('p','学习版暂时加载失败，请重新打开本章重试。'));}}
}
function renderChapter() {
  const chapter = currentChapter;
  renderReadingChapter(chapter);
  $('chapterTitle').textContent = chapter.title;
  const topics = $('chapterTopics'); topics.replaceChildren();
  for (const topic of chapter.topics || []) { const button = document.createElement('button'); button.textContent = topic.title + ' · 第 ' + topic.page + ' 页'; button.onclick = () => { openChapter(chapter.id, topic.page); $('chapterBody').scrollIntoView({behavior:'auto',block:'start'}); }; topics.append(button); }
  $('chapterMeta').textContent = `${sourceMap[chapter.source].name} · PDF 第 ${chapter.start}–${chapter.end} 页 · 当前第 ${chapterPage} 页`;
  $('chapterProgress').textContent = state.learned[chapter.id] ? '本章已标记学过，可随时再读。' : signedIn ? '翻页会保存阅读位置，换设备登录后可接着读。' : '登录后可保存章节进度。';
  $('chapterText').textContent = sourcePageMap.get(chapter.source + ':' + chapterPage) || (loadedSources.has(chapter.source)?'这一页没有可提取的文字，请核对原 PDF。':'正在加载本章资料…');
  $('chapterPageInput').value = chapterPage; $('chapterPageInput').max = sourceMap[chapter.source].pages;
  $('nextChapter').disabled = !!chapter.isBook || STUDY.curriculum.filter((item) => item.source === chapter.source).at(-1)?.id === chapter.id;
  $('chapterPrevious').disabled = chapterPage === chapter.start;
  $('chapterNext').disabled = chapterPage === chapter.end;
  $('chapterSource').href = sourceLink(chapter.source, chapterPage);
  $('markChapter').textContent = state.learned[chapter.id] ? '本章已学' : '标记本章已学';
  const questions = chapterQuestions(chapter);
  $('chapterQuiz').textContent = questions.length ? `连续练本章关联知识 · ${questions.length} 题` : '本章暂无关联练习，去单元总览学习';
  $('chapterQuiz').disabled = !questions.length;
  const box = $('parallelChapters'); box.replaceChildren();
  for (const source of STUDY.sources.filter((source) => source.id !== chapter.source)) {
    const alternatives = STUDY.curriculum.filter((item) => item.module === currentModule && item.source === source.id);
    if (!alternatives.length) continue;
    const button = document.createElement('button'); button.textContent = `${source.name} · 打开同学科目录`;
    button.onclick = () => { $('courseBook').value = source.id; $('courseSearch').value = ''; openCourse(currentModule); };
    box.append(button);
  }
}
async function turnChapterPage(delta) {
  if (!currentChapter) return;
  const chapter=currentChapter,available=chapterReadingPages(chapter),index=available.indexOf(chapterPage),page=available[Math.max(0,Math.min(available.length-1,index+delta))];
  chapterPage = page; updateReadingNavigation(); renderChapter(); $('chapterBody').scrollIntoView({behavior:'auto',block:'start'});
  if (signedIn && accountReady) {
    try { await persist({ type:'read', chapterId:chapter.id, page }); }
    catch (error) { notice('阅读位置未同步：' + error.message); }
  }
}

function startMarkQuiz(doc=null,unit=null){const bank=STUDY.questions.filter(q=>q.kind==='mark-authored'&&(!doc||q.markRefs.some(r=>r.doc===doc&&(!unit||r.unit===unit))));if(!bank.length){notice('本节尚未有经过核对的练习题。');return;}startQuiz(bank,'endless');}
function showQuizSetup() { $('bankInfo').textContent = `${STUDY.questions.length} 题 · ${STUDY.coverage.multipleQuestions||0} 道多选 · ${STUDY.coverage.withQuestions} 个已整理考点。优先练未做题和未练考点，做完后持续复习；马克 ${STUDY.markQuiz.questions} 题已包含在混合题库中。`; $('quizSetup').classList.remove('hidden'); $('quizPlay').classList.add('hidden');  }
function startQuiz(items, mode = 'endless') {
  if(accountReady&&!signedIn){try{sessionStorage.setItem('gongji-pending-practice',JSON.stringify({ids:items.map(q=>q.id),mode,type:$('quizType').value}));}catch{}}
  if (!requireAccount()) return;
  if(mode!=='specific')items=typeFiltered(items);
  if (!items.length) { notice('当前题型和范围没有可练题目，请切换题型或范围。'); showPracticeSettings(); return; }
  practiceActive=true;
  endless = true; practicePool = items;
  recentQuestions = []; lastConcept = null;
  queue = [selectNextQuestion()]; questionVisits = [];
  at = 0; sessionAnswered = 0; sessionCorrect = 0; answered = false;
  show('quiz'); $('quizSetup').classList.add('hidden'); $('quizPlay').classList.remove('hidden');  renderQuestion();
}
function startEndless() { startQuiz(STUDY.questions.filter((q) => q.module !== 'm13'), 'endless'); }
function updateQuizProgress(){
 const remaining=practicePool.filter(item=>!questionAttempt(item)?.count).length;
  const scopeIds=new Set(practicePool.flatMap(item=>item.pointIds||[]));
  const practicedIds=new Set(STUDY.questions.filter(item=>questionAttempt(item)?.count).flatMap(item=>item.pointIds||[]));
  const scopeDone=[...scopeIds].filter(id=>practicedIds.has(id)).length;
  $('practiceStatus').textContent = `当前范围已练 ${scopeDone}/${scopeIds.size} 个考点，尚未练 ${scopeIds.size-scopeDone} 个。` + (remaining ? `还剩 ${remaining} 道未做题，优先补齐未练考点；账号记录支持跨设备继续。` : `当前 ${practicePool.length} 道题均已做过，继续复习错题、到期题和较少练习的题。`);
 $('quizBar').style.width=((practicePool.length-remaining)/practicePool.length*100)+'%';
}
function updateQuizCounter(){const q=queue[at],visit=questionVisits[at];$('quizCounter').textContent=`连续第 ${at+1} 题${at<queue.length-1?'（回看）':''} · ${visit.choice!==undefined?'本题已作答':visit.count?'复习题（已做 '+visit.count+' 次）':'未做过的新题'} · 本次答对 ${sessionCorrect}/${sessionAnswered} · ${moduleMap[q.module].title}`;}
function renderQuestion() {
  pendingAnswer = null; const q = queue[at];
  const visit=questionVisits[at] ||= {order:shuffle(q.options.map((_,index)=>index)),draft:[],count:questionAttempt(q)?.count||0};
  answered = visit.choice!==undefined; selectedChoices=new Set(visit.draft);
  const remaining = practicePool.filter((item) => !questionAttempt(item)?.count).length;
  updateQuizCounter();
  updateQuizProgress();
 const negative=/不正确|错误的[是有]|不符合|不属于|不包括/.test(q.prompt);
  $('questionType').textContent=(q.answers?'多选题 · ':'单选题 · ')+(negative?'留意否定词，选择符合题意的'+(q.answers?'所有项':'一项'):q.answers?'选出所有符合题意的项':'选择符合题意的一项');
  $('questionType').classList.toggle('negative-question',negative);
  $('answerRule').textContent=q.answers?'本练习按全部选对判分：漏选、错选均记为错题。选好后点击提交答案。':'点击选项立即判分。';
  $('question').textContent = q.prompt;
  const box = $('options'); box.replaceChildren();
  displayOrder = visit.order; displayCorrectIndex = displayOrder.indexOf(q.answer);
  displayOrder.forEach((originalIndex, displayIndex) => {
    const button = document.createElement('button'); button.className = 'option';
    button.textContent = `${'ABCD'[displayIndex]}. ${q.options[originalIndex]}`;
    if(q.answers){const selected=selectedChoices.has(originalIndex);button.setAttribute('aria-pressed',String(selected));button.textContent=(selected?'☑ ':'□ ')+button.textContent;button.classList.toggle('selected',selected);}
    button.onclick = () => q.answers?toggleChoice(originalIndex):choose(originalIndex, displayIndex); box.append(button);
  });
  $('feedback').className = 'feedback hidden'; $('feedback').replaceChildren();
  $('nextQuestion').classList.remove('hidden');$('nextQuestion').disabled=!answered;$('previousQuestion').disabled=at===0;
  $('submitAnswer').classList.toggle('hidden',!q.answers||answered);$('submitAnswer').disabled=!selectedChoices.size;
  $('answerStatus').textContent=q.answers?`已选 ${selectedChoices.size} 项`:'请选择答案';
  $('nextQuestion').textContent = '下一题';
  if(answered){$('answerRule').textContent='本题已作答，回看保留原选项顺序和选择；使用下一题返回继续练习。';renderAnswer(visit.choice);}
}

function toggleChoice(originalIndex) {
 if(answered||!requireAccount())return;
 if(selectedChoices.has(originalIndex))selectedChoices.delete(originalIndex);else selectedChoices.add(originalIndex);
 questionVisits[at].draft=[...selectedChoices];
 displayOrder.forEach((original,index)=>{const button=$('options').children[index],selected=selectedChoices.has(original);button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.textContent=`${selected?'☑':'□'} ${'ABCD'[index]}. ${queue[at].options[original]}`;});
 $('submitAnswer').disabled=!selectedChoices.size;$('answerStatus').textContent=`已选 ${selectedChoices.size} 项，可取消或修改`;
}
function submitMultiple() {if(!answered&&selectedChoices.size)choose([...selectedChoices].sort((a,b)=>a-b));}
function choose(originalIndex, displayIndex) {
  if (answered || !requireAccount()) return;
  answered = true; const q = queue[at], buttons = [...$('options').children]; buttons.forEach((button) => { button.disabled = true; });
  pendingAnswer = { type:'answer', questionId:q.id, questionRevision:q.revision||'', choice:originalIndex, mutationId:crypto.randomUUID(), deviceId:sessionDeviceId, sequence:++deviceSequence, at:Date.now() };
  const ok=choiceCorrect(q,originalIndex);
  answerOutbox.push(pendingAnswer); applyOptimisticAnswer(pendingAnswer); storeAnswerDrafts();
  sessionAnswered++; if (ok) sessionCorrect++;
  recentQuestions.push(q.id); recentQuestions = recentQuestions.slice(-20); lastConcept = q.concept || q.id;
  questionVisits[at].choice=Array.isArray(originalIndex)?[...originalIndex]:originalIndex;
  renderAnswer(originalIndex);
  updateSyncStatus(); void flushAnswers();
}
function renderAnswer(originalIndex){
  updateQuizCounter();updateQuizProgress();
  const q=queue[at],buttons=[...$('options').children];buttons.forEach(button=>{button.disabled=true;});
  const expected=correctChoices(q),selected=Array.isArray(originalIndex)?originalIndex:[originalIndex],ok=choiceCorrect(q,originalIndex);
  buttons.forEach((button,index)=>{const original=displayOrder[index];if(expected.includes(original))button.classList.add('correct');else if(selected.includes(original))button.classList.add('wrong');});
  const feedback = $('feedback'); feedback.className = 'feedback ' + (ok ? 'good' : 'bad');
  const labels=displayOrder.map((original,index)=>expected.includes(original)?'ABCD'[index]:null).filter(Boolean).join('、');
  const missed=expected.filter(index=>!selected.includes(index)),extra=selected.filter(index=>!expected.includes(index));
  const reason=ok?'答对了':(q.answers?[extra.length?'错选':'',missed.length?'漏选':''].filter(Boolean).join('、'):'答错了');
  const lead = document.createElement('strong'); lead.textContent = `${ok?'答对了':'答错了'} · ${!ok&&q.answers?reason+' · ':''}正确答案：${labels}${!q.answers?'. '+q.options[q.answer]:''}`;
  $('answerStatus').textContent=`${reason} · 正确答案 ${labels}`;$('submitAnswer').classList.add('hidden');$('nextQuestion').disabled=false;
  const explanation = document.createElement('p'); explanation.textContent = q.explanation;
  const optionHeading = document.createElement('h3'); optionHeading.textContent = '四个选项逐项解析';
  const optionNotes = document.createElement('div'); optionNotes.className = 'option-notes';
  displayOrder.forEach((originalIndex, displayIndex) => {
    const row = document.createElement('section'); row.className = 'option-note' + (expected.includes(originalIndex) ? ' is-answer' : '');
    const title = document.createElement('strong');
    title.textContent = `${'ABCD'[displayIndex]}. ${q.options[originalIndex]} · ${expected.includes(originalIndex) ? '本题应选' : '本题不选'}${selected.includes(originalIndex) ? ' · 你的选择' : ''}${expected.includes(originalIndex)&&!selected.includes(originalIndex)?' · 漏选':''}${!expected.includes(originalIndex)&&selected.includes(originalIndex)?' · 错选':''}`;
    const detail = document.createElement('p'); detail.textContent = q.optionExplanations[originalIndex];
    row.append(title, detail);
    if (q.optionRefs?.[originalIndex]) {
      const ref = q.optionRefs[originalIndex], link = document.createElement('a'); link.href = sourceLink(ref.source,ref.page); link.target = '_blank';
      link.textContent = `核对本项：${referenceLabel(ref.source,ref.page)} ↗`; row.append(link);
    }
    optionNotes.append(row);
  });
  const extensionHeading = document.createElement('h3'); extensionHeading.textContent = '本题解题提醒';
  const extension = document.createElement('p'); extension.textContent = q.extension;
  const source = document.createElement('a'); source.href = sourceLink(q.source, q.page); source.target = '_blank';
  source.textContent = `查看出处：${referenceLabel(q.source,q.page)} ↗`;
  feedback.append(lead, explanation, optionHeading, optionNotes);
  const groupedPoint=pointMap.get(q.concept);
  if(groupedPoint?.studyGuide)feedback.append(conceptGuide(groupedPoint.studyGuide));
  else feedback.append(extensionHeading,extension);
  feedback.append(source);
  if(q.markRefs?.length){const refs=el('div',undefined,'actions');for(const r of q.markRefs){const u=markDocs.get(r.doc)?.units.find(u=>u.id===r.unit);refs.append(action('阅读：'+(u?.title||'对应马克资料'),()=>openMark(r.doc,r.unit),'btn secondary'));}feedback.append(refs,el('p','本题是依据资料整理的自编练习，来源按钮打开对应阅读单元；返回当前题可继续作答。','muted small'));}
  const pictures=pointPictures(q.pointIds||[]);if(pictures.length)feedback.append(el('h3','看图巩固本题考点'),visualGallery(pictures));
  const topicIds=STUDY.questionTopicIds?.[q.id]||[STUDY.questionTopics?.[q.id]];
  for(const [index,tid] of topicIds.entries()){const topic=topicMap.get(tid);if(!topic)continue;const expansion=topicExpansion(topic,{excludeVisualIds:pictures.map(v=>v.id)});if(index===0)feedback.append(expansion);else{const part=el('details',undefined,'reading-detail assessed-topic');part.append(el('summary','本题还考查：'+topic.title),expansion);feedback.append(part);}}
  for(const ref of q.extraRefs||[]){if(ref.source===q.source&&ref.page===q.page)continue;const link=el('a',`其他依据：${referenceLabel(ref.source,ref.page)}`);link.href=sourceLink(ref.source,ref.page);link.target='_blank';feedback.append(el('p'),link);}
  if(q.authority){const official=el('a','核对现行权威依据 ↗');official.href=q.authority;official.target='_blank';official.rel='noopener';feedback.append(el('p'),official);}
  for(const url of q.additionalAuthorities||[]){const link=el('a','核对本专题其他权威依据 ↗');link.href=url;link.target='_blank';link.rel='noopener';feedback.append(el('p'),link);}
  const point=q.pointIds?.[0];if(point)feedback.append(el('p'),action('回到本题知识点讲解',()=>openPoint(point)));
  if(q.optionAssessments){const related=el('div',undefined,'actions');related.append(el('span','逐项学习本题考点：','muted small'));for(const id of q.pointIds){const p=pointMap.get(id);if(p)related.append(action(p.title,()=>openPoint(id)));}feedback.append(related);} $('nextQuestion').classList.remove('hidden');
}
function nextQuestion() {
 if(!answered)return;
 if(at===queue.length-1)queue.push(selectNextQuestion());
 at++;renderQuestion();$('quizPlay').scrollIntoView({behavior:'auto',block:'start'});
}

function previousQuestion(){
 if(at===0)return;at--;renderQuestion();$('quizPlay').scrollIntoView({behavior:'auto',block:'start'});
}

let datesHidden=false;
function renderTools() {
 const tabs=$('timelineTabs');tabs.replaceChildren();
 for(const t of STUDY.timelines)tabs.append(action(t.title,()=>{selectedTimeline=t.id;renderTools();},t.id===selectedTimeline?'btn':'btn secondary'));
 const t=STUDY.timelines.find(x=>x.id===selectedTimeline)||STUDY.timelines[0],box=$('timelineContent');box.replaceChildren();box.append(el('h3',t.title),el('p',t.method,'method-box'));
 const line=el('div',undefined,'timeline');
 for(const [time,name,meaning] of t.events){const node=el('section',undefined,'timeline-node');
  if(datesHidden)node.append(action('回忆时间 → 点击揭晓',event=>{},'recall-date'));else node.append(el('div',time,'timeline-date'));
  if(datesHidden)node.children[0].onclick=()=>{node.children[0].textContent=time;};
  node.append(el('h3',name),el('p',meaning));line.append(node);
 }box.append(line);box.append(action('进入相关课程',()=>openLesson(t.module)),action('连续练相关学科',()=>startQuiz(STUDY.questions.filter(q=>q.module===t.module))));
 $('hideDates').textContent=datesHidden?'显示全部时间':'遮住时间，练回忆';
 const events=$('eventContent');events.replaceChildren();
 for(const e of STUDY.eventLines){events.append(el('h3',e.title));const steps=el('div',undefined,'event-steps');e.steps.forEach(([stage,text],i)=>{const x=el('div',undefined,'event-step');x.append(el('b',`${i+1} → ${stage}`),el('p',text));steps.append(x);});events.append(steps);}
 const methods=$('methodContent');methods.replaceChildren();
 for(const m of STUDY.modules){const card=el('section',undefined,'module');card.append(el('h3',m.title),el('p',STUDY.guides[m.id].method),action('带着方法学这门课',()=>openLesson(m.id)));methods.append(card);}
}
function filteredPoints() {
 const id=$('coverageModule').value||'all',status=$('coverageStatus').value||'all',query=$('coverageSearch').value.trim();
 return STUDY.knowledge.filter(p=>(id==='all'||p.module===id)&&(!query||p.title.includes(query)||p.statement.includes(query))&&(status==='all'||status==='new'&&!pointDone(p)||status==='correct'&&pointCorrect(p)||status==='wrong'&&p.questionIds.some(id=>state.attempts[id]&&!state.attempts[id].lastCorrect)));
}
function renderCoverage() {
 const points=filteredPoints(),done=STUDY.knowledge.filter(pointDone).length;
 $('coverageSummary').textContent=`已整理 ${STUDY.knowledge.length} 个考点，其中 ${STUDY.coverage.withQuestions} 个已配练习，${STUDY.coverage.pendingReview||0} 个待核对，${STUDY.coverage.pendingQuestions||0} 个待编题；题库 ${STUDY.questions.length} 道。你的账号已练 ${done} 个考点，还未练 ${STUDY.knowledge.length-done} 个。`;
 $('coverageCount').textContent=`当前筛选 ${points.length} 个，显示前 ${Math.min(coverageLimit,points.length)} 个。`;
 const box=$('coverageList');box.replaceChildren();
 for(const p of points.slice(0,coverageLimit)){const row=el('div',undefined,'coverage-row'),body=el('div');body.append(el('strong',p.title),el('p',`${moduleMap[p.module].title} · ${p.status==='needs-review'?'资料待核对':!p.questionIds.length?'待编题':pointDone(p)?pointCorrect(p)?'最近答对':'已练，待巩固':'尚未练过'} · 配套 ${p.questionIds.length} 道题`,'muted small'));
 const buttons=el('div',undefined,'actions');buttons.append(action('学习',()=>openPoint(p.id)));if(p.questionIds.length)buttons.append(action('练习',()=>startQuiz(p.questionIds.map(id=>questionMap.get(id)).filter(Boolean)),'btn ghost'));row.append(body,buttons);box.append(row);}
 if(!points.length)box.append(el('p','没有匹配考点，换个筛选条件试试。'));
 $('coverageMore').classList.toggle('hidden',coverageLimit>=points.length);
 const refs=$('referenceGaps');refs.replaceChildren();
 const gaps=STUDY.curriculum.filter(c=>!c.pointIds?.length);
 refs.append(el('p',`${STUDY.curriculum.length-gaps.length}/${STUDY.curriculum.length} 个资料章节已关联整理考点；以下 ${gaps.length} 个章节尚需补充核对。内容相同的不同资料章节会共用考点，不重复统计。`));
 for(const c of gaps)refs.append(action(`${c.title} · ${sourceMap[c.source].name} 第 ${c.start} 页`,()=>openChapter(c.id),'point-link'));
}
function renderWrong() {
  const box = $('wrongList'); box.replaceChildren();
  if (!signedIn) { const p = document.createElement('p'); p.textContent = '登录后可查看和同步错题。'; box.append(p); return; }
  const archivedWrong=Object.entries(state.attempts).filter(([id,a])=>!questionMap.has(id)&&!a.lastCorrect);if(archivedWrong.length){box.append(el('p',`${archivedWrong.length} 道旧版错题已因题干或依据问题退出练习，原答题记录仍保存在账号中。`,'method-box'));const archive=el('details',undefined,'reading-detail');archive.append(el('summary','查看已撤下题目的历史记录'));for(const [id,a] of archivedWrong){const point=pointMap.get(id.replace(/^k-/,''));archive.append(el('p',`${point?.title||id} · 已错 ${a.wrong} 次${a.lastChoiceText?' · 旧版选择：'+a.lastChoiceText.join('；'):''}`));if(point)archive.append(action('查看考点状态',()=>openPoint(point.id),'btn ghost'));}box.append(archive);}
  const wrong = wrongQuestions(), due = dueQuestions();
  const summary = document.createElement('p'); summary.textContent = `待订正错题 ${wrong.length} 道；今日到期（含错题）${due.length} 道。`; box.append(summary);
  if (!wrong.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = '目前没有待订正题。可以先完成一个单元的练习。'; box.append(p); return; }
  for (const q of wrong) {
    const row = document.createElement('div'); row.className = 'lesson-card';
    const title = document.createElement('strong'); title.textContent = `${q.id} · ${q.prompt}`;
    const detail = document.createElement('p'); detail.className = 'muted small'; detail.textContent = `${moduleMap[q.module].title} · 已错 ${state.attempts[q.id].wrong} 次`;
    const button = document.createElement('button'); button.className = 'btn secondary'; button.textContent = '重做此题'; button.onclick = () => startQuiz([q],'specific');
    row.append(title, detail);const previous=state.attempts[q.id].lastChoice;if(q.revision&&!questionAttempt(q)){row.append(el('p','本题已改写。旧答题记录保留，重做后更新订正状态。','muted'));if(state.attempts[q.id].lastChoiceText)row.append(el('p','旧版选择：'+state.attempts[q.id].lastChoiceText.join('；')));}else if(previous!==undefined){const selected=Array.isArray(previous)?previous:[previous];row.append(el('p','上次选择：'+selected.map(i=>q.options[i]).join('；')));row.append(el('p','正确内容：'+correctChoices(q).map(i=>q.options[i]).join('；')));}row.append(button); box.append(row);
  }
}
for (const button of document.querySelectorAll('.nav button[data-view]')) {
  button.onclick = () => button.dataset.view === 'lesson' ? openCourses() : button.dataset.view === 'quiz' ? openPractice() : show(button.dataset.view);
}
$('searchLink').onclick = () => { window.open('search.html','_blank','noopener'); };
$('homeEndless').onclick = openPractice;
$('homeWrong').onclick = () => startQuiz(wrongQuestions());
for (const module of STUDY.modules) {
  for (const id of ['lessonSelect', 'quizModule']) {
    if (id === 'quizModule' && !STUDY.questions.some((q) => q.module === module.id)) continue;
    const option = document.createElement('option'); option.value = module.id; option.textContent = module.title; $(id).append(option);
  }
}
$('lessonSelect').onchange = (event) => openLesson(event.target.value);
$('unitMenu').onkeydown=event=>{if(event.key==='Escape'&&$('unitMenu').open){event.preventDefault();$('unitMenu').open=false;$('unitMenuTrigger').focus();}};
window.addEventListener('pointerdown',event=>{if(!$('unitMenu').contains(event.target))$('unitMenu').open=false;});
$('markLearned').onclick = async () => { if (!requireAccount()) return; try { await persist({ type: 'learn', moduleId: currentModule }); $('markLearned').textContent = '已标记学过'; } catch (error) { notice('学习记录未保存：' + error.message); } };
$('lessonQuiz').onclick = () => startQuiz(STUDY.questions.filter((q) => q.module === currentModule), 'endless');
$('startEndless').onclick = startEndless;
$('startMark').onclick=()=>startMarkQuiz();
$('startMultiple').onclick=()=>{$('quizType').value='multiple';startEndless();};
$('startModule').onclick = () => startQuiz(STUDY.questions.filter((q) => q.module === $('quizModule').value), 'endless');
$('startDue').onclick = () => startQuiz(shuffle(dueQuestions()));
$('nextQuestion').onclick = nextQuestion;
$('previousQuestion').onclick = previousQuestion;
$('submitAnswer').onclick = submitMultiple;
$('practiceSettings').onclick = showPracticeSettings;
$('resumePractice').onclick = resumePractice;
$('exitQuiz').onclick = endPractice;
$('practiceWrong').onclick = () => startQuiz(shuffle(wrongQuestions()));
$('practiceDue').onclick = () => startQuiz(shuffle(dueQuestions()));
$('chapterPrevious').onclick = () => turnChapterPage(-1);
$('chapterNext').onclick = () => turnChapterPage(1);
$('markChapter').onclick = async () => { if (!currentChapter || !requireAccount()) return; try { await persist({type:'learn',moduleId:currentChapter.id}); renderChapter(); renderCourseDirectory(); } catch(error) { notice('章节进度未保存：' + error.message); } };
$('chapterOverview').onclick = () => openLesson(currentModule);
$('chapterQuiz').onclick = () => { if(currentChapter)startQuiz(chapterQuestions(currentChapter), 'endless'); };
$('nextChapter').onclick = () => { const chapters = STUDY.curriculum.filter((chapter) => chapter.source === currentChapter.source); const index = chapters.findIndex((chapter) => chapter.id === currentChapter.id); if (index >= 0 && index + 1 < chapters.length) openChapter(chapters[index + 1].id); else notice('这份资料的最后一章已读完，可选择其他学科或资料。'); };
$('lessonViewImages').onclick=()=>{$('lessonVisuals').scrollIntoView({behavior:'auto',block:'start'});};
$('lessonStartReading').onclick = () => {$('lessonPoints').scrollIntoView({behavior:'smooth'});};
$('courseSearch').oninput = renderCourseDirectory;
$('locateCurrentPoint').onclick=()=>{if($('courseSearch').value){$('courseSearch').value='';renderCourseDirectory();}locateCurrentPoint();};
for (const source of STUDY.sources) { const option = document.createElement('option'); option.value = source.id; option.textContent = source.name; $('courseBook').append(option); }
$('courseBook').value = 'all';
$('courseBook').onchange = () => {if($('courseBook').value!=='all')openReadingBook($('courseBook').value);};
$('fullBook').onclick = () => { const source = $('courseBook').value !== 'all' ? $('courseBook').value : currentChapter?.source || 'top'; return openReadingBook(source); };
$('chapterJump').onclick = async () => {
  const page = Number($('chapterPageInput').value), source = currentChapter?.source;
  if (!source || !Number.isInteger(page) || page < 1 || page > sourceMap[source].pages) { notice('请输入这份 PDF 范围内的整数页码。'); return; }
  const chapter = STUDY.curriculum.find((item) => item.source === source && item.start <= page && item.end >= page) || chapterMap['book-' + source];
  await openChapter(chapter.id, page);
  if(chapterPage!==page)notice('第 '+page+' 页为目录或空白页，已定位到第 '+chapterPage+' 页学习正文。');
  if (signedIn && accountReady) { try { await persist({type:'read',chapterId:currentChapter.id,page:chapterPage}); } catch(error) { notice('阅读位置未同步：' + error.message); } }
};
let refreshInFlight = false;
async function refreshProgress() {
  if (!signedIn || !accountReady || refreshInFlight) return;
  refreshInFlight = true;
  try {
    const response = await fetch('/api/progress', {credentials:'same-origin',cache:'no-store'});
    if (response.status === 401) { signedIn = false; accountMessage('登录已失效，请重新登录。', true); return; }
    if (!response.ok) throw new Error();
    const data = await response.json();
    if(data.accountId!==accountId){signedIn=false;accountMessage('账号已切换，请刷新页面后继续。',true);return;}
    if (data.revision >= lastRevision) { state = data.state; lastRevision = data.revision; rebasePending(); }
    renderHome(); renderWrong(); if (currentChapter) renderChapter();
  } catch { notice('最新学习记录暂未同步，请稍后刷新。'); }
  finally { refreshInFlight = false; }
}
window.addEventListener('focus', refreshProgress);
window.addEventListener('online', () => void flushAnswers());
$('retrySync').onclick = () => void flushAnswers();
$('hideDates').onclick=()=>{datesHidden=!datesHidden;renderTools();};
for(const m of STUDY.modules){const option=el('option',m.title);option.value=m.id;$('coverageModule').append(option);}
for(const id of ['coverageModule','coverageStatus'])$(id).onchange=()=>{coverageLimit=60;renderCoverage();};
$('coverageSearch').oninput=()=>{coverageLimit=60;renderCoverage();};
$('coverageMore').onclick=()=>{coverageLimit+=60;renderCoverage();};
$('coveragePractice').onclick=()=>{const ids=new Set(filteredPoints().map(p=>p.id));startQuiz(STUDY.questions.filter(q=>q.pointIds.some(id=>ids.has(id))));};
$('jilinEntry').onclick=()=>openLesson('m14');
$('homeReading').onclick=()=>show('library');
$('readerLibrary').onclick=()=>show('library');
$('readerFont').onclick=()=>{readingPreferences.large=!readingPreferences.large;saveReadingPreferences();applyReadingPreferences();};
$('readerPaper').onclick=()=>{readingPreferences.paper=!readingPreferences.paper;saveReadingPreferences();applyReadingPreferences();};
$('readerPreviousChapter').onclick=()=>moveReadingChapter(-1);
$('readerNextChapter').onclick=()=>moveReadingChapter(1);
$('directorySubjects').onclick=()=>{directoryMode='subjects';directoryQuery=null;$('courseSearch').value='';renderCourseDirectory();};
$('directoryBooks').onclick=()=>{directoryMode='books';readerDirectorySource=null;$('courseSearch').value='';renderCourseDirectory();};
const editionPageMap=new Map(),editionMetaMap=new Map(),loadedEditions=new Map();
let readerGuideId=null,readerBodyKey=null,readerDirectorySource=null,readerDirectoryQuery=null;
let directoryMode='subjects',readingSource='top';
const READING_KEY='gongji-reading-preferences-v1';
let readingPreferences={large:false,paper:false,recent:{}};
try{readingPreferences={...readingPreferences,...JSON.parse(localStorage.getItem(READING_KEY)||'{}')};}catch{}
function saveReadingPreferences(){try{localStorage.setItem(READING_KEY,JSON.stringify(readingPreferences));}catch{}}
function applyReadingPreferences(){
 $('lesson').classList.toggle('reader-large',!!readingPreferences.large);$('lesson').classList.toggle('reader-paper',!!readingPreferences.paper);
 $('readerFont').textContent=readingPreferences.large?'标准字号':'大字阅读';$('readerFont').setAttribute('aria-pressed',String(!!readingPreferences.large));
 $('readerPaper').textContent=readingPreferences.paper?'白色底色':'护眼底色';$('readerPaper').setAttribute('aria-pressed',String(!!readingPreferences.paper));
}
async function loadEdition(source){
 if(!loadedEditions.has(source))loadedEditions.set(source,fetch('editions/'+source+'.json?v='+STUDY.contentVersion).then(r=>{if(!r.ok)throw new Error('reading unavailable');return r.json();}).then(rows=>{for(const row of rows){editionPageMap.set(source+':'+row.p,row.blocks);editionMetaMap.set(source+':'+row.p,row);}}).catch(e=>{loadedEditions.delete(source);throw e;}));
 return loadedEditions.get(source);
}
const bookDescriptions={top:'民法、刑法、法理与宪法、行政与诉讼、劳动与事业单位、哲学、党史和政治理论。',bottom:'经济、公文、管理、历史、文学、古代文化、科技、生活常识与天文地理。',tricolor:'五大学科板块，用于知识复盘和查漏；可与详细笔记对照阅读。',color:'覆盖法律、政治、经济与常识等内容，按知识章节阅读与查找。',mindmap:'用框架建立联系；阅读前先看结构，阅读后用空白框架主动回忆。'};
function chapterReadingPages(chapter){return chapter.readingPages||Array.from({length:chapter.end-chapter.start+1},(_,i)=>chapter.start+i);}
function readingChapters(source){return STUDY.curriculum.filter(c=>c.source===source);}
function openReadingBook(source){
 const chapters=readingChapters(source),last=readingPreferences.recent[source];
 const saved=last&&chapters.find(c=>c.id===last.chapter);
 const account=chapters.filter(c=>state.reading?.[c.id]).sort((a,b)=>(state.reading[b.id].at||0)-(state.reading[a.id].at||0))[0];
 const selected=saved||account||chapters[0];if(selected)return openChapter(selected.id,saved?last.page:undefined);
}
function renderLibrary(){
 const box=$('bookLibrary');box.replaceChildren();

 for(const source of ['top','bottom','tricolor','color','mindmap'].map(id=>sourceMap[id]).filter(Boolean)){
  const chapters=readingChapters(source.id),card=el('article',undefined,'book-card');const cover=el('div',undefined,'book-cover');cover.setAttribute('aria-hidden','true');cover.append(el('small','PUBLIC KNOWLEDGE'),el('span',source.id==='top'?'学霸\n上册':source.id==='bottom'?'学霸\n下册':source.id==='mindmap'?'思维\n导图':source.id==='tricolor'?'三色\n笔记':'彩色\n笔记'));card.append(cover);
  const text=el('div');text.append(el('h3',source.name),el('p',`${chapters.length} 章 · ${source.readingPages||source.pages} 页学习正文`,'book-meta'),el('p',bookDescriptions[source.id],'book-description'));
  const authored=chapters.filter(c=>STUDY.readingEdition[c.id]?.authored).length;text.append(el('p',authored?`${authored} 章独立导读 · 易混提醒 · 合上资料自测`:'章节框架 · 考点对读 · 回忆提示'));
  const last=readingPreferences.recent[source.id];if(last)text.append(el('p',`上次读到：${chapterMap[last.chapter]?.title||''} · 第 ${last.page} 页`,'reader-current'));
  const controls=el('div',undefined,'actions');controls.append(action(last?'继续阅读':'开始阅读',()=>openReadingBook(source.id),'btn'),action('查看目录',async()=>{readingSource=source.id;directoryMode='books';readerDirectorySource=null;await openChapter(chapters[0].id);$('courseSidebar').scrollIntoView({behavior:'auto',block:'start'});},'btn secondary'));if(['top','bottom'].includes(source.id)){const download=el('a','下载学习版 PDF','btn ghost');download.href='downloads/'+source.id+'-study.pdf';download.setAttribute('download',source.id==='top'?'公基学霸笔记-上册-学习版.pdf':'公基学霸笔记-下册-学习版.pdf');controls.append(download);}text.append(controls);card.append(text);box.append(card);
 }
 if(markLibrary.documents.length){const card=el('article',undefined,'book-card mark-library-entry');const text=el('div');text.append(el('p','新资料合集','topic-eyebrow'),el('h3','马克资料学习馆'),el('p',`${markLibrary.stats.documents} 组资料 · 系统讲义、86专题、导图、笔记、时政与题本`),action('进入学习馆',()=>openMark(),'btn'));card.append(text);box.append(card);}
}
function readingPart(chapter){
 const boundaries=chapter.source==='top'?[[9,'法律 · 民法'],[82,'法律 · 刑法'],[125,'法律 · 法理学'],[147,'法律 · 宪法'],[180,'法律 · 行政法'],[219,'法律 · 诉讼法'],[237,'法律 · 劳动与劳动合同'],[247,'事业单位相关法'],[253,'马克思主义与哲学'],[335,'毛泽东思想与党史'],[373,'中国特色社会主义理论']]:chapter.source==='bottom'?[[9,'经济'],[59,'公文'],[93,'管理'],[109,'历史'],[156,'文学'],[195,'古代文化'],[235,'科技与生活常识'],[291,'天文与地理']]:[];
 return boundaries.filter(([page])=>chapter.start>=page).at(-1)?.[1]||moduleMap[chapter.module]?.title||'章节';
}
function renderReadingDirectory(){
 $('directoryHelp').textContent='按大模块浏览资料章节，选择章节进入学习正文。';$('courseSearchLabel').textContent='查找本书章节或考点';

 const box=$('courseDirectory'),query=$('courseSearch').value.trim(),source=currentChapter?.source||readingSource;
 $('directoryTitle').textContent='资料目录';$('directorySubjects').classList.remove('active');$('directoryBooks').classList.add('active');
 $('courseSearch').placeholder='查找本书章节或知识点';
 const chapters=readingChapters(source);$('courseDirectoryMeta').textContent=`${source==='top'?'学霸上册':source==='bottom'?'学霸下册':sourceMap[source].name} · ${chapters.length} 章`;
 if(readerDirectorySource!==source||readerDirectoryQuery!==query){
  const top=$('courseSidebar').scrollTop;box.replaceChildren();readerDirectorySource=source;readerDirectoryQuery=query;directoryQuery=null;
  const picker=el('div',undefined,'book-selector');for(const id of ['top','bottom','tricolor','color','mindmap'])picker.append(action(id==='top'?'学霸上':id==='bottom'?'学霸下':id==='tricolor'?'三色':id==='color'?'彩色':'导图',()=>{readingSource=id;$('courseSearch').value='';openReadingBook(id);},id===source?'current':''));box.append(picker);
  let group=null,count=0;
  for(const c of chapters){if(query&&!`${c.title} ${(c.topics||[]).map(t=>t.title).join(' ')}`.includes(query))continue;const part=readingPart(c);if(part!==group){box.append(el('h3',part,'book-directory-heading'));group=part;}
   const button=action(c.title,()=>openChapter(c.id),'book-chapter-button');button.dataset.chapterId=c.id;button.append(el('span',`${c.start}–${c.end}`));box.append(button);count++;
  }
  if(!count)box.append(el('p','本书没有匹配章节，请换关键词。','muted'));$('courseSidebar').scrollTop=top;
 }
 for(const button of box.children)if(button.dataset?.chapterId){const selected=button.dataset.chapterId===currentChapter?.id;button.classList.toggle('current',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
function readerCompare(table){
 const scroll=el('div',undefined,'table-scroll'),node=el('table',undefined,'compare-table reader-compare'),head=el('thead'),tr=el('tr');for(const cell of table.headers)tr.append(el('th',cell));head.append(tr);node.append(head);const body=el('tbody');for(const row of table.rows){const r=el('tr');for(const cell of row)r.append(el('td',cell));body.append(r);}node.append(body);scroll.append(node);return scroll;
}
function sourcePageFigure(info,title){
 const figure=el('figure',undefined,'reading-source-figure'),link=el('a');link.href=info.src;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',title+'，打开原页大图');
 const image=el('img');image.src=info.src;image.alt=title;image.width=info.width;image.height=info.height;image.loading='lazy';image.decoding='async';link.append(image);figure.append(link,el('figcaption',title+' · 点击图片放大'));
 image.onerror=()=>{image.hidden=true;figure.append(el('p','原页图片暂时加载失败，可刷新页面重试。','muted'));};return figure;
}
function renderReadingChapter(chapter){
 const guide=STUDY.readingEdition[chapter.id],box=$('chapterGuide');
 if(readerGuideId!==chapter.id){
  readerGuideId=chapter.id;box.replaceChildren();$('chapterReview').replaceChildren();
  if(guide){
   for(const number of chapter.overviewPages||[]){const image=STUDY.readingImages?.[chapter.source+':'+number];if(image){const outline=el('details',undefined,'reading-detail reading-outline');outline.append(el('summary','本章框架图 · 原资料第 '+number+' 页'),sourcePageFigure(image,chapter.title+'相关框架 · 原 PDF 第 '+number+' 页'));box.append(outline);}}
   box.append(el('p',guide.thesis,'reader-thesis'),el('h3','怎么读这一章'),el('p',guide.route,'reader-route'));
   const trap=el('div',undefined,'reader-trap');trap.append(el('b','容易混淆'),el('span',guide.trap));box.append(trap);
   if(guide.table){box.append(el('h3',guide.table.title),readerCompare(guide.table));if(guide.table.url){const cite=el('p',undefined,'reader-source-note');const link=el('a',guide.table.sourceTitle);link.href=guide.table.url;link.target='_blank';link.rel='noopener';cite.append(link);box.append(cite);}}
   if(guide.case){box.append(el('h3','用一个情境想清楚'));const example=el('details',undefined,'reading-detail');example.append(el('summary',guide.case[0]),el('p',guide.case[1],'recall-answer'));box.append(example);}
   const points=guide.pointIds.map(id=>pointMap.get(id)).filter(Boolean),useful=points.filter(p=>p.explanation||p.statement);
   if(useful.length){const detail=el('details',undefined,'reading-detail');detail.append(el('summary',`本章考点对读 · ${useful.length} 个`));for(const p of useful){const item=el('section',undefined,'reader-point');item.append(el('h4',p.title),el('p',p.explanation||p.statement),action('查看讲解与练习',()=>openPoint(p.id),'btn ghost'));detail.append(item);}box.append(detail);}
   const review=$('chapterReview');review.append(el('h3','合上资料，检验理解'));const recall=el('details');recall.append(el('summary',guide.recall));recall.append(el('p','回看线索：'+guide.thesis+' '+guide.trap,'recall-answer'));review.append(recall,el('p','先口头回答，再展开线索；解释一个例子，最后补一个反例。','muted small'));
  }
 }
 const body=$('chapterBody'),key=chapter.source+':'+chapterPage,blocks=editionPageMap.get(key),row=editionMetaMap.get(key);
 if(readerBodyKey!==key||(!body.dataset.ready&&blocks)){
  readerBodyKey=key;body.dataset.ready=blocks?'yes':'';body.replaceChildren();body.append(el('div',`正文 · PDF 第 ${chapterPage} 页`,'reading-page-label'));
  for(const row of STUDY.contentCorrections||[])if(row.source===chapter.source&&row.page===chapterPage)body.append(correctionNotice(row));
  if(!blocks)body.append(el('p',loadedEditions.has(chapter.source)?'正在整理本页内容…':'正在加载学习版…','muted'));
  else if(!blocks.length)body.append(el('p','此页没有可读取文字，请核对原 PDF。','muted'));
  else{
   if(row?.image){const title=sourceMap[chapter.source].name+' · 原 PDF 第 '+chapterPage+' 页';if(row.diagram)body.append(sourcePageFigure(row.image,title));else{const detail=el('details',undefined,'reading-detail reading-page-image');detail.open=!!row.illustrated;detail.append(el('summary','原页图片与图表对照 · 第 '+chapterPage+' 页'),sourcePageFigure(row.image,title));body.append(detail);}}
   let labels=null;
   for(const block of row?.diagram&&row?.image?[]:blocks){
    // Short, adjacent diagram labels stay as labels, without inventing arrows.
    if(block.type==='paragraph'&&block.text.length<=13&&!/[。；：:]$/.test(block.text)){if(!labels){labels=el('div',undefined,'reading-labels');body.append(labels);}labels.append(el('span',block.text));continue;}
    labels=null;body.append(el(block.type==='heading'?'h3':'p',block.text,block.type==='note'?'reading-note':block.type==='item'?'reading-item':''));
   }
  }
 }
 const chapters=readingChapters(chapter.source),index=chapters.findIndex(c=>c.id===chapter.id);
 $('readerPosition').textContent=`第 ${index+1} / ${chapters.length} 章 · 本章 ${chapterReadingPages(chapter).indexOf(chapterPage)+1} / ${chapterReadingPages(chapter).length} 页`;
 $('readerPreviousChapter').disabled=index<=0;$('readerNextChapter').disabled=index<0||index>=chapters.length-1;
 readingPreferences.recent[chapter.source]={chapter:chapter.id,page:chapterPage};saveReadingPreferences();applyReadingPreferences();
}
function moveReadingChapter(delta){const chapters=readingChapters(currentChapter?.source||readingSource),index=chapters.findIndex(c=>c.id===currentChapter?.id),target=chapters[index+delta];if(target)openChapter(target.id);}

/*__MARK_APP__*/
/*__INTERVIEW_APP__*/
renderHome(); loadAccount();
const readingParams=new URLSearchParams(window.location.search||''),initialView=readingParams.get('view');
if(topicMap.has(readingParams.get('topic')))openTopic(readingParams.get('topic'));
else if(pointMap.has(readingParams.get('point')))openPoint(readingParams.get('point'));
else if(chapterMap[readingParams.get('chapter')])openChapter(readingParams.get('chapter'),Number(readingParams.get('page'))||undefined);
else if(moduleMap[readingParams.get('module')])openLesson(readingParams.get('module'));
else if(initialView==='interview')openInterview(readingParams.get('doc'),readingParams.get('unit'));
else if(initialView==='materials')openMark(readingParams.get('doc'),readingParams.get('unit'));
else if(['home','library','quiz','wrong','tools','coverage'].includes(initialView))show(initialView,true,initialView==='quiz'&&readingParams.get('setup')==='1'?{view:'quiz',setup:true}:{view:initialView});
else show('home',false);
navigationInitializing=false;
