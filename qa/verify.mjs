import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const history = JSON.parse(fs.readFileSync('src/question-history.json','utf8'));
const rawStudy = JSON.parse(fs.readFileSync('src/learning.json', 'utf8'));
const study = vm.runInNewContext(fs.readFileSync('public/learning-data.js', 'utf8') + ';STUDY;');
let user = { userId:'tester-a',email:'a@example.test' }, unavailable = false;
const rows = new Map();
const db = {
  prepare(sql) {
    return { bind(...args) {
      return {
        async first() { await Promise.resolve(); const row=rows.get(args[0]); return row ? {...row} : null; },
        async run() {
          await Promise.resolve();
          if (sql.startsWith('INSERT')) {
            if (!rows.has(args[0])) rows.set(args[0], {state_json:args[1],revision:0});
            return {meta:{changes:1}};
          }
          const row=rows.get(args[2]);
          if (row.revision !== args[3]) return {meta:{changes:0}};
          rows.set(args[2], {state_json:args[0],revision:row.revision+1});
          return {meta:{changes:1}};
        }
      };
    } };
  }
};
let source = fs.readFileSync('app/api/progress/route.ts','utf8');
source=source.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const api=vm.createContext({Response,Request,URL,Date,Map,Set,JSON,console:{error(){}},learning:rawStudy,history,interviewLibrary:JSON.parse(fs.readFileSync('src/interview-library.json','utf8')),
  getChatGPTUser:async()=>user,getRawDb:()=>{if(unavailable) throw new Error('DB unavailable');return db;}});
vm.runInContext(source+'\nglobalThis.api={GET,POST};',api);
const request=(body,origin='https://study.test')=>new Request('https://study.test/api/progress',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const post=body=>{
  const current=rawStudy.questions.find(q=>q.id===body.questionId);
  if(body.type==='answer' && current?.answers && current.revision && !Object.hasOwn(body,'questionRevision'))
    body={...body,questionRevision:current.revision};
  return api.api.POST(request(body));
};
user=null; assert.equal((await api.api.GET()).status,401); assert.equal((await post({type:'learn',moduleId:'m01'})).status,401);
user={userId:'tester-a',email:'a@example.test'};
assert.equal((await api.api.POST(request({type:'learn',moduleId:'m01'},'https://other.test'))).status,403);
assert.equal((await post({type:'answer',questionId:'q001',choice:99})).status,400);
assert.equal(rows.size,0);
const q=study.questions[0];
let result=await (await post({type:'answer',questionId:q.id,choice:(q.answer+1)%4,userId:'tester-b',mutationId:'operation-test-0001'})).json();
assert.equal(result.correct,false); assert.equal(result.state.attempts[q.id].wrong,1);assert(!rows.has('tester-b'));
result=await (await post({type:'answer',questionId:q.id,choice:(q.answer+1)%4,mutationId:'operation-test-0001'})).json();
assert.equal(result.state.attempts[q.id].count,1,'retry is idempotent');
const writes=await Promise.all([1,2,3].map(i=>post({type:'answer',questionId:q.id,choice:q.answer,mutationId:'concurrent-operation-'+i})));
assert(writes.every(r=>r.status===200));
result=await (await api.api.GET()).json();
assert.equal(result.state.attempts[q.id].count,4,'simultaneous devices preserve all writes');
const chapter=study.curriculum[0];
if(chapter) {
assert.equal((await post({type:'read',chapterId:chapter.id,page:chapter.end+1})).status,400);
assert.equal((await post({type:'read',chapterId:chapter.id,page:chapter.start})).status,200);
assert.equal((await post({type:'learn',moduleId:chapter.id})).status,200);
}
// Multiple answer payloads are validated server-side, graded as sets and persisted under the account.
const multi=study.questions.find(q=>q.answers&&q.answers.length<4),wrongIndex=multi.options.findIndex((_,i)=>!multi.answers.includes(i));
for(const choice of [[],[0,0],[4],['0'],[true],0,null,[[0]]])assert.equal((await post({type:'answer',questionId:multi.id,choice})).status,400,'malformed multi selection rejected');
assert.equal((await post({type:'answer',questionId:q.id,choice:[q.answer]})).status,400,'single question rejects array');
result=await (await post({type:'answer',questionId:multi.id,choice:[...multi.answers].reverse(),mutationId:'multi-correct-000001'})).json();
assert.equal(result.correct,true,'selection order does not affect grading');assert.deepEqual(result.state.attempts[multi.id].lastChoice,[...multi.answers].sort());
const multiCount=result.state.attempts[multi.id].count;
result=await (await post({type:'answer',questionId:multi.id,choice:[...multi.answers].reverse(),mutationId:'multi-correct-000001'})).json();assert.equal(result.state.attempts[multi.id].count,multiCount,'multi retry deduplicated');
result=await (await post({type:'answer',questionId:multi.id,choice:[multi.answers[0]]})).json();assert.equal(result.correct,false,'partial selection is not fully correct');
result=await (await post({type:'answer',questionId:multi.id,choice:[...multi.answers,wrongIndex]})).json();assert.equal(result.correct,false,'extra selection is incorrect');

user={userId:'tester-b',email:'b@example.test'};
result=await (await api.api.GET()).json(); assert.equal(Object.keys(result.state.attempts).length,0,'account isolation');
unavailable=true; assert.equal((await api.api.GET()).status,503);unavailable=false;
user={userId:'frontend-test',email:'f@example.test'};

class Element {
  constructor(id='') {this.id=id;this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.className='';this.disabled=false;this.open=false;
    this.classList={add:(s)=>{this.className+=' '+s},remove:(s)=>{this.className=this.className.split(' ').filter(x=>x!==s).join(' ')},toggle:(s,active)=>{this.classList[active?'add':'remove'](s)}};}
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children=[...children];}
  setAttribute(name,value) {this[name]=value;}
  removeAttribute(name) {delete this[name];}
  scrollIntoView() {}
  focus() {this.focused=true;}
  querySelectorAll(selector) {return this.children.filter(x=>selector==='details' ? x.tag==='details':false);}
  get firstChild(){return this.children[0];}
}
const elements=new Map();
const $=id=>{if(!elements.has(id)) elements.set(id,new Element(id)); return elements.get(id)};
const views=['home','lesson','quiz','wrong','tools','coverage','library','materials','interview'].map($);
const nav=['home','lesson','quiz','wrong','tools','coverage','library','materials','interview'].map(view=>{const e=new Element();e.dataset.view=view;return e});
const document={querySelector:()=>null,getElementById:$,createElement:tag=>{const e=new Element();e.tag=tag;return e},createTextNode:text=>({textContent:text}),querySelectorAll:selector=>selector==='.view'?views:nav};
let loseResponse=false,delayAnswer=false,releaseAnswer;const drafts=new Map();
const browserEvents=new Map(),browserEntries=[];let browserIndex=0;
const browserWindow={location:{search:'?module=m14',pathname:'/study.html'},scrollY:0,
 open(url,target,features){this.opened={url,target,features};},scrollTo({top}){this.scrollY=top;},addEventListener(name,listener){browserEvents.set(name,listener);},
 history:{replaceState(state,unused,url){browserEntries[browserIndex]={state,url};},pushState(state,unused,url){browserEntries.splice(browserIndex+1);browserEntries.push({state,url});browserIndex++;},
 back(){if(browserIndex){browserIndex--;browserEvents.get('popstate')({state:browserEntries[browserIndex].state});}},
 forward(){if(browserIndex+1<browserEntries.length){browserIndex++;browserEvents.get('popstate')({state:browserEntries[browserIndex].state});}}}};
const context=vm.createContext({document,window:browserWindow,localStorage:{getItem:k=>drafts.get(k)||null,setItem:(k,v)=>drafts.set(k,v),removeItem:k=>drafts.delete(k)},crypto:webcrypto,URLSearchParams,Date,Math,Map,JSON,console,setTimeout,clearTimeout,
  fetch:async(url,options={})=>{
    if(url.startsWith('references/')||url.startsWith('editions/')||url.startsWith('materials/')||url.startsWith('interview/'))return Response.json(JSON.parse(fs.readFileSync('public/'+url.split('?')[0],'utf8')));
    if (options.method==='POST') {if(delayAnswer){delayAnswer=false;await new Promise(resolve=>releaseAnswer=resolve);}const response=await api.api.POST(request(JSON.parse(options.body)));if(loseResponse){loseResponse=false;throw new Error('network response lost')}return response;}
    return api.api.GET();
  }});
vm.runInContext(fs.readFileSync('public/learning-data.js','utf8')+fs.readFileSync('public/data.js','utf8')+fs.readFileSync('public/study-app.js','utf8'),context);
assert.equal(vm.runInContext('currentModule',context),'m14','regional deep link opens course');
await vm.runInContext('loadAccount()',context);
assert.equal(vm.runInContext('signedIn && accountReady',context),true);
// True immediate feedback: let the write wait while two answers and Next remain usable.
const drain=async()=>{for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,1));if(vm.runInContext('!syncing',context)){await vm.runInContext('flushAnswers()',context);if(vm.runInContext('answerOutbox.length===0',context))return;}}throw new Error('outbox did not drain');};
function answerQuestion(q,choices=q.answers||[q.answer]) {
 if(q.answers){for(const index of choices)$('options').children.find(b=>b.textContent.endsWith(q.options[index])).onclick();$('submitAnswer').onclick();}
 else $('options').children.find(b=>b.textContent.endsWith(q.options[choices[0]])).onclick();
}
vm.runInContext('startEndless()',context);
delayAnswer=true;
const first=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));
answerQuestion(first);
assert.equal(vm.runInContext('answered',context),true,'grade is synchronous before network response');
assert($('feedback').children.some(x=>x.textContent?.startsWith('答对了')));
assert(!$('nextQuestion').className.includes('hidden'));
vm.runInContext('nextQuestion()',context);
assert.notEqual(vm.runInContext('queue[at].id',context),first.id);
const second=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));
answerQuestion(second);
assert.equal(vm.runInContext('sessionAnswered',context),2);assert.equal(vm.runInContext('answerOutbox.length',context),2);
releaseAnswer();await drain();
assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts[first.id].count,1);
assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts[second.id].count,1);
assert.equal([...drafts.keys()].filter(key=>key.startsWith('gongji-answer-drafts:')).length,0,'confirmed answer drafts removed');
await vm.runInContext('loadAccount()',context);vm.runInContext('startEndless()',context);assert(![first.id,second.id].includes(vm.runInContext('queue[at].id',context)),'account-based restart skips practiced questions');
// Cover the full bank with optimistic local progress, verifying randomized labels and all explanations.
vm.runInContext('startEndless()',context);
const cycleSize=vm.runInContext('practicePool.length',context),seen=new Set();
assert.equal(cycleSize,study.questions.length);
for(let i=0;i<cycleSize+12;i++) {
 const current=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));
 if(i<cycleSize-2){assert(!seen.has(current.id),'new questions never repeat while unseen remain');seen.add(current.id);}
 const correct=current.answer;
 answerQuestion(current);
 const notes=$('feedback').children.find(el=>el.className==='option-notes');assert.equal(notes.children.length,4);
 const order=JSON.parse(vm.runInContext('JSON.stringify(displayOrder)',context));
 order.forEach((original,display)=>assert.equal(notes.children[display].children[1].textContent,current.optionExplanations[original]));
 const guide=study.knowledge.find(p=>p.id===current.concept)?.studyGuide;
 if(guide)for(const member of guide.members)assert(contentText($('feedback')).includes(member.name),'answer expansion contains every grouped member');
 else assert($('feedback').children.some(el=>el.textContent===current.extension));
 assert.equal($('nextQuestion').textContent,'下一题');
 vm.runInContext('nextQuestion()',context);
 if(i===cycleSize-3)assert($('practiceStatus').textContent.includes('均已做过'));
 // Flush every batch boundary, otherwise the real background request could leave synthetic drafts too large.
 if(i%20===19)await drain();
}
await drain();
assert($('quizCounter').textContent.includes('复习题'));
// Lost response: answer remains visible, retry does not regrade or double count.
vm.runInContext("startQuiz(STUDY.questions.filter(q=>q.module==='m01'))",context);
const current=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));
const countBefore=JSON.parse(rows.get('frontend-test').state_json).attempts[current.id]?.count||0;
loseResponse=true;
answerQuestion(current);
for(let i=0;i<100&&vm.runInContext('syncing',context);i++)await new Promise(r=>setTimeout(r,1));
assert.equal(vm.runInContext('answered && syncError',context),true);
assert.equal(vm.runInContext('answerOutbox.length',context),1);
await vm.runInContext('flushAnswers()',context);
assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts[current.id].count,countBefore+1);
assert.equal(vm.runInContext('answerOutbox.length',context),0);
if(chapter) {
await vm.runInContext(`openChapter('${chapter.id}')`,context);
assert.equal($('chapterTitle').textContent,chapter.title);
if(chapter.end>chapter.start){await vm.runInContext('turnChapterPage(1)',context);assert.equal(JSON.parse(rows.get('frontend-test').state_json).reading[chapter.id].page,chapter.start+1);}
await $('markChapter').onclick();
assert.equal(JSON.parse(rows.get('frontend-test').state_json).learned[chapter.id],true);
}
const courseButton=nav.find(button=>button.dataset.view==='lesson');
vm.runInContext('currentChapter = null;currentPoint=null',context);courseButton.onclick();assert($('lessonGuide').children.length>0,'course entry opens authored teaching');assert.equal($('moduleLesson').className.includes('hidden'),false);
$('chapterOverview').onclick();assert($('lessonCards').children.length>0,'knowledge overview is available');
for (const chapter of study.curriculum) {
 await vm.runInContext(`openChapter('${chapter.id}')`,context);
 assert($('chapterText').textContent.length>0, chapter.id+' renders text or explicit OCR empty state');assert($('chapterBody').children.length>1,chapter.id+' has readable content');assert($('chapterGuide').children.length>3,chapter.id+' has chapter teaching');
}
$('courseSearch').value='合同';vm.runInContext('renderCourseDirectory()',context);assert(vm.runInContext('courseChapters().length',context)>0);
$('courseSearch').value='不存在的测试章节';vm.runInContext('renderCourseDirectory()',context);assert.equal(vm.runInContext('courseChapters().length',context),0);
$('courseSearch').value='';$('courseBook').value='bottom';
await $('fullBook').onclick();assert.equal(vm.runInContext('currentChapter.source',context),'bottom');assert.equal(vm.runInContext('currentChapter.isBook',context),undefined,'book opens chapter learning edition rather than front matter');
$('chapterPageInput').value='314';await $('chapterJump').onclick();assert.equal(vm.runInContext('chapterPage',context),312,'blank tail pages are skipped');
assert.equal(JSON.parse(rows.get('frontend-test').state_json).reading[vm.runInContext('currentChapter.id',context)].page,312);
assert($('accountEntry').textContent.includes('账号'));
vm.runInContext("show('tools')",context);assert.equal($('timelineTabs').children.length,study.timelines.length);assert($('methodContent').children.length===study.modules.length);
$('hideDates').onclick();const node=$('timelineContent').children.find(x=>x.className==='timeline').children[0];assert(node.children[0].textContent.includes('回忆时间'));node.children[0].onclick();assert.equal(node.children[0].textContent,study.timelines[0].events[0][0]);
$('coverageModule').value='all';$('coverageStatus').value='all';vm.runInContext("show('coverage')",context);assert.equal($('coverageList').children.length,60);
assert.equal($('moduleGrid').children.length,10,'nine subjects and Jilin regional entry');
for(const m of study.modules){vm.runInContext(`openLesson('${m.id}')`,context);assert($('lessonGuide').children.length>10);assert($('lessonPoints').children.length>2);}
for(const point of study.knowledge){vm.runInContext(`openPoint('${point.id}')`,context);assert($('pointLesson').children.length>8,point.id+' contains teaching and related practice');}
assert(study.knowledge.every(p=>(p.questionIds.length||p.status)&&p.questionIds.every(id=>study.questions.some(q=>q.id===id))));
assert(study.questions.every(q=>q.module!=='m13'&&q.optionExplanations.length===4));
const active=JSON.parse(fs.readFileSync('src/active-data.json','utf8'));assert(!active.pages.some(p=>(p.s==='bottom'&&p.p>=315)||(p.s==='mindmap'&&p.p>=273)));
assert(!fs.readFileSync('public/study.html','utf8').includes('本轮'));
// Regional content is taught, searchable and continuously usable with official evidence.
const jilinPoints=study.knowledge.filter(p=>p.module==='m14'),jilinQuestions=study.questions.filter(q=>q.module==='m14');
assert.equal(jilinPoints.length,63);assert.equal(jilinQuestions.length,91);
assert.equal(new Set(jilinPoints.map(p=>p.group)).size,9);
assert.equal(study.knowledge.filter(p=>p.module!=='m14').length,1089,'base knowledge IDs preserved');
assert(study.questions.filter(q=>q.module!=='m14'&&!q.answers).length>500,'substantial usable base bank');
assert(study.questions.every(q=>!/(概念回忆|对应哪个考点|该考点)/.test(q.prompt)));
assert.equal(study.coverage.withQuestions,study.knowledge.filter(p=>p.questionIds.length).length);
assert.equal(study.coverage.pendingReview+study.coverage.pendingQuestions+study.coverage.withQuestions,study.knowledge.length);
assert(study.questions.every(q=>q.options.length===4&&new Set(q.options).size===4));
$('jilinEntry').onclick();assert.equal($('lessonTitle').textContent,'吉林省情');
assert($('lessonRefs').children.every(a=>a.href.startsWith('https://')&&!a.textContent.includes('PDF')));
for(const detail of $('lessonExtracts').children){detail.open=true;await detail.ontoggle();assert(!detail.children[1].textContent.includes('加载失败'));}
const walk=e=>[e,...(e.children||[]).flatMap(walk)];
vm.runInContext("openPoint('jl-point-gdp2025')",context);
assert(walk($('pointLesson')).some(a=>a.href?.includes('tjj.jl.gov.cn')));
assert(!walk($('pointLesson')).some(a=>a.textContent?.includes('第 0 页')));
vm.runInContext("startQuiz(STUDY.questions.filter(q=>q.module==='m14'))",context);
for(let i=0;i<jilinQuestions.length+3;i++){
 const q=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));assert.equal(q.module,'m14');
 answerQuestion(q);
 assert.equal($('feedback').children.find(e=>e.className==='option-notes').children.length,4);
 vm.runInContext('nextQuestion()',context);if(i%20===19)await drain();
}
await drain();
const searchData=vm.runInNewContext(fs.readFileSync('public/data.js','utf8')+';KB_DATA');
assert.equal(searchData.pages.filter(p=>p.s==='jilin-notes').length,9);
assert(searchData.pages.some(p=>p.s==='jilin-notes'&&p.t.includes('梨树模式')));
assert(!fs.readFileSync('public/search.html','utf8').includes('山东省情专题'));

// Exercise the multi UI explicitly: selection is reversible and grading only happens on submit.
$('quizType').value='mixed';
vm.runInContext(`startQuiz([questionMap.get('${multi.id}')])`,context);
assert($('nextQuestion').disabled);assert(!$('nextQuestion').className.includes('hidden'),'Next stays visible before grading');assert($('submitAnswer').disabled);
const firstOption=$('options').children.find(b=>b.textContent.endsWith(multi.options[multi.answers[0]]));
firstOption.onclick();assert.equal(vm.runInContext('answered',context),false);assert(! $('submitAnswer').disabled);assert(firstOption.className.includes('selected'));
firstOption.onclick();assert($('submitAnswer').disabled);assert.equal(vm.runInContext('selectedChoices.size',context),0,'selection can be cancelled');
firstOption.onclick();$('submitAnswer').onclick();
assert.equal(vm.runInContext('answered',context),true);assert(!$('nextQuestion').disabled);assert($('answerStatus').textContent.includes('漏选'));
assert($('feedback').children.find(e=>e.className==='option-notes').children.some(row=>row.children[0].textContent.includes('漏选')));
await drain();
let serverProgress=await (await api.api.GET()).json();assert.equal(serverProgress.state.attempts[multi.id].lastCorrect,false);assert.deepEqual(serverProgress.state.attempts[multi.id].lastChoice,[multi.answers[0]]);
await vm.runInContext('loadAccount()',context);assert.equal(vm.runInContext(`state.attempts['${multi.id}'].lastChoice.length`,context),1,'selected content reloaded from account');
// Extra + missed options have distinct explanations; all correct options use displayed, shuffled letters.
vm.runInContext(`startQuiz([questionMap.get('${multi.id}')])`,context);answerQuestion(multi,[wrongIndex]);
assert($('answerStatus').textContent.includes('错选')&&$('answerStatus').textContent.includes('漏选'));await drain();
vm.runInContext(`startQuiz([questionMap.get('${multi.id}')])`,context);answerQuestion(multi);
const actualLabels=vm.runInContext("displayOrder.map((original,i)=>queue[at].answers.includes(original)?'ABCD'[i]:null).filter(Boolean).join('、')",context);
assert($('answerStatus').textContent.includes('正确答案 '+actualLabels));assert($('feedback').children[0].textContent.includes('答对了'));await drain();
const allCorrect=study.questions.find(q=>q.answers?.length===4);vm.runInContext(`startQuiz([questionMap.get('${allCorrect.id}')])`,context);answerQuestion(allCorrect);assert($('answerStatus').textContent.includes('A、B、C、D'));await drain();
$('startMultiple').onclick();assert(vm.runInContext('practicePool.every(q=>q.answers)',context),'one-click multi scope');
for(let i=0;i<study.coverage.multipleQuestions+5;i++){const q=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));assert(q.answers);answerQuestion(q);vm.runInContext('nextQuestion()',context);if(i%20===19)await drain();}await drain();
$('quizType').value='single';vm.runInContext('startEndless()',context);assert(vm.runInContext('practicePool.every(q=>!q.answers)',context),'single-only scope');
$('quizType').value='mixed';vm.runInContext('startEndless()',context);assert.equal(vm.runInContext('practicePool.length',context),study.questions.length);
$('quizType').value='multiple';vm.runInContext(`state.attempts['${q.id}'].lastCorrect=false;renderWrong()`,context);const redoRow=$('wrongList').children.find(row=>row.children?.[0]?.textContent?.startsWith(q.id+' ·'));redoRow.children.at(-1).onclick();assert.equal(vm.runInContext('queue[at].id',context),q.id,'direct wrong question ignores unrelated filter');$('quizType').value='mixed';

// Durable device cursor protects a previously confirmed answer even after short receipt history rolls over.
user={userId:'cursor-test',email:'c@example.test'};
const device='device-test-000001',mutation={type:'answer',questionId:q.id,choice:q.answer,deviceId:device,sequence:1,mutationId:'cursor-answer-000001'};
await post(mutation);for(let sequence=2;sequence<=90;sequence++)await post({...mutation,sequence,mutationId:'cursor-answer-'+String(sequence).padStart(6,'0')});
result=await (await post(mutation)).json();assert.equal(result.state.attempts[q.id].count,90);
assert.equal((await post({type:'answers',actions:[{...mutation,sequence:91,mutationId:'cursor-answer-000091'},{type:'answer',questionId:'nonexistent',choice:0,mutationId:'bad-answer-000001'}]})).status,400);
assert.equal((await post({type:'learn',moduleId:'m01',expectedAccountId:'different-account'})).status,409);
// Rewritten selections cannot be interpreted as positions in the old options.
user={userId:'revision-test',email:'r@example.test'};
const revised=study.questions.find(q=>q.revision&&q.kind==='authored-exam');
const legacy=history.find(q=>q.id===revised.id);
result=await (await post({type:'answer',questionId:revised.id,questionRevision:revised.revision,choice:revised.answer,mutationId:'revision-answer-0001'})).json();
assert.equal(result.correct,true);assert.equal(result.state.attempts[revised.id].lastQuestionRevision,revised.revision);
assert.deepEqual(result.state.attempts[revised.id].lastChoiceText,[revised.options[revised.answer]]);
// An old open tab/draft is graded against the original question, and retained as history.
result=await (await post({type:'answer',questionId:legacy.id,choice:1,mutationId:'legacy-answer-000001'})).json();
assert.equal(result.correct,false);assert.equal(result.state.attempts[legacy.id].lastQuestionRevision,'legacy');
assert.deepEqual(result.state.attempts[legacy.id].lastChoiceText,[legacy.options[1]]);
assert.equal(result.state.attempts[legacy.id].count,2);
assert.equal((await post({type:'answer',questionId:revised.id,questionRevision:'wrong-version',choice:0})).status,400);
const removed=history.find(q=>!study.questions.some(active=>active.id===q.id));
assert.equal((await post({type:'answer',questionId:removed.id,choice:1,mutationId:'archived-answer-0001'})).status,200);
const oldAttempt=result.state.attempts[legacy.id];
vm.runInContext(`state.attempts['${legacy.id}']=${JSON.stringify(oldAttempt)};renderWrong()`,context);
assert.equal(vm.runInContext(`questionAttempt(questionMap.get('${legacy.id}'))`,context),undefined,'rewritten question treated as unpracticed');
const changedRow=$('wrongList').children.find(row=>row.children?.[0]?.textContent?.startsWith(legacy.id+' ·'));
assert(changedRow.children.some(x=>x.textContent?.includes('本题已改写')));
assert(!changedRow.children.some(x=>x.textContent?.startsWith('上次选择：')),'old positions are not shown against new options');
assert(study.knowledge.every(p=>p.questionIds.length&&p.status==='ready'),'every organized point has practice');
const coveredPoint=study.knowledge.find(p=>p.coverageAuthored);
vm.runInContext(`openPoint('${coveredPoint.id}')`,context);
assert(walk($('pointLesson')).some(e=>e.textContent==='练这个考点'));
// Course dropdown is a labelled disclosure with full-sized selectable rows.
vm.runInContext("openLesson('m01')",context);assert.equal($('unitMenuOptions').children.length,study.modules.length);
const targetUnit=study.modules.find(m=>m.id==='m07'),targetButton=$('unitMenuOptions').children.find(b=>b.children[0].children[0].textContent===targetUnit.title);
$('unitMenu').open=true;targetButton.onclick();assert.equal($('lessonTitle').textContent,targetUnit.title);assert.equal($('unitMenu').open,true,'choosing a unit preserves the open selector');assert($('unitMenuOptions').children.find(b=>b.className.includes('current')).focused);
$('unitMenu').open=true;$('unitMenu').onkeydown({key:'Escape',preventDefault(){}});assert.equal($('unitMenu').open,false);
const firstSection=$('lessonPoints').children.find(e=>e.className.includes('course-section'));assert(firstSection.open);assert(firstSection.children[0].children.some(e=>e.className==='section-index'));
// Reading a point preserves the directory DOM, expanded siblings and sidebar position.
vm.runInContext("openLesson('m01')",context);
const directoryBefore=$('courseDirectory').children.slice();
const groups=vm.runInContext("Array.from(directoryGroups.values()).filter(d=>JSON.parse(d.dataset.navigationKey.slice(6))[0]==='m01')",context);
assert(groups.length>1);groups[0].open=true;groups[1].open=true;
$('courseSidebar').scrollTop=137;
const pointForNav=study.knowledge.find(p=>p.module==='m01');
vm.runInContext(`openPoint('${pointForNav.id}')`,context);
assert.equal($('courseDirectory').children[0],directoryBefore[0],'directory is updated without replacement');
assert(groups[0].open&&groups[1].open,'expanded siblings stay open');assert.equal($('courseSidebar').scrollTop,137);
assert.equal(vm.runInContext(`directoryTopicButtons.get(STUDY.pointTopics['${pointForNav.id}']).getAttribute?.('aria-current')||directoryTopicButtons.get(STUDY.pointTopics['${pointForNav.id}'])['aria-current']`,context),'page');
vm.runInContext("openLesson('m07');openLesson('m01')",context);assert(groups[0].open&&groups[1].open,'switching units leaves other branches available');
const lessonSection=$('lessonPoints').children.find(e=>e.className.includes('course-section'));lessonSection.open=false;
vm.runInContext(`openPoint('${pointForNav.id}');openLesson('m01')`,context);
assert.equal($('lessonPoints').children.find(e=>e.className.includes('course-section')).open,false,'returning to overview restores explicit collapse');
vm.runInContext(`openPoint('${pointForNav.id}')`,context);const navigator=$('pointLesson').children[0];assert.equal(navigator['aria-label'],'考点阅读导航');
const nextPointButton=navigator.children[1].children.find(b=>b.textContent==='下一考点');nextPointButton.onclick();assert.notEqual(vm.runInContext('currentPoint.id',context),pointForNav.id);
const currentNavPoint=vm.runInContext('currentPoint.id',context);const currentGroup=vm.runInContext('directoryGroups.get(sectionKey(currentModule,pointGroup(currentPoint)))',context);currentGroup.open=false;$('locateCurrentPoint').onclick();assert(currentGroup.open,'manual locate reveals current point');
// Search expansion is temporary and does not overwrite remembered closed branches.
vm.runInContext("openLesson('m01')",context);const remembered=vm.runInContext("Array.from(directoryGroups.values()).find(d=>JSON.parse(d.dataset.navigationKey.slice(6))[0]==='m01')",context);remembered.open=false;remembered.ontoggle();
$('courseSearch').value='法';vm.runInContext('renderCourseDirectory()',context);$('courseSearch').value='';vm.runInContext('renderCourseDirectory()',context);assert.equal(vm.runInContext(`directoryGroups.get(${JSON.stringify(remembered.dataset.navigationKey.slice(6))}).open`,context),false,'clearing search restores manual collapse');
assert(drafts.has('gongji-course-navigation-v1'),'disclosures remembered across page loads');
// Source-backed image assets map to real points and render only after grading.
const visuals=JSON.parse(fs.readFileSync('src/visual-references.json','utf8'));
assert(visuals.length>=37);assert.equal(new Set(visuals.map(i=>i.id)).size,visuals.length);
for(const image of visuals){
 assert(image.title&&image.alt&&image.observation&&image.author&&image.license);
 assert(image.sourcePage.startsWith('https://commons.wikimedia.org/wiki/File:'));
 assert(image.moduleIds.every(id=>study.modules.some(m=>m.id===id)));
 assert(image.pointIds.every(id=>study.knowledge.some(p=>p.id===id)));
 const bytes=fs.readFileSync('public'+image.asset);assert(bytes.length>1000);assert((bytes[0]===255&&bytes[1]===216)||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'valid JPEG or PNG asset');
}
vm.runInContext("openLesson('m14')",context);
assert($('lessonViewImages').textContent.includes('图解与图片 · 5 个专题'));assert(!$('lessonVisuals').className.includes('hidden'));
const moduleImage=walk($('lessonVisuals')).find(e=>e.tag==='img');assert.equal(moduleImage.loading,'lazy');assert.equal(moduleImage.decoding,'async');
walk($('lessonVisuals')).find(e=>e.className==='visual-point-link').onclick();assert.equal(vm.runInContext('currentPoint.id',context),'jl-point-crater-lake');
assert(walk($('pointLesson')).some(e=>e.tag==='img'&&e.alt.startsWith('长白山天池')));
assert(walk($('pointLesson')).some(e=>e.alt?.startsWith('长白山天池')));
vm.runInContext("openPoint('supplement-34f6eb3faf3e83')",context);assert.equal(walk($('pointLesson')).filter(e=>e.tag==='img'&&['花岗岩','玄武岩','黄山'].some(name=>e.alt.startsWith(name))).length,3,'granite basalt and Huangshan remain linked without duplicates');
vm.runInContext(`openPoint('${pointForNav.id}')`,context);assert(!walk($('pointLesson')).some(e=>e.tag==='img'&&['黄山','长白山','火山','峡谷'].some(name=>e.alt?.startsWith(name))),'legal topic does not get unrelated scenery');
vm.runInContext("openLesson('m01')",context);assert(!$('lessonViewImages').className.includes('hidden'));assert(walk($('lessonVisuals')).some(e=>e.className==='topic-diagram'),'abstract subjects have functional concept diagrams');
const pictureQuestion=study.questions.find(q=>q.pointIds?.includes('jl-point-crater-lake'));assert(pictureQuestion);
user={userId:'frontend-test',email:'f@example.test'};
vm.runInContext(`startQuiz([questionMap.get('${pictureQuestion.id}')])`,context);assert.equal(walk($('feedback')).filter(e=>e.tag==='img').length,0,'question has no visual hint before answer');
answerQuestion(pictureQuestion);assert(walk($('feedback')).some(e=>e.tag==='img'&&e.alt.startsWith('长白山天池')));await drain();
const imageLink=walk($('feedback')).find(e=>e.className==='visual-image-link'),feedbackImage=imageLink.children[0];
assert.equal(imageLink.href,visuals.find(i=>i.id==='changbai-tianchi').asset);feedbackImage.onerror();assert(feedbackImage.hidden);assert.equal(imageLink.href,visuals.find(i=>i.id==='changbai-tianchi').sourcePage,'unavailable asset offers original source');

// Previous restores the exact visit without submitting or grading another answer.
const priorSingle=study.questions.find(q=>!q.answers),priorMulti=study.questions.find(q=>q.answers&&q.answers.length<4);
vm.runInContext(`startQuiz([questionMap.get('${priorSingle.id}'),questionMap.get('${priorMulti.id}')])`,context);
assert($('previousQuestion').disabled);$('previousQuestion').onclick();assert.equal(vm.runInContext('at',context),0);
const visitedFirst=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context));
const firstOrder=vm.runInContext('JSON.stringify(displayOrder)',context);
const wrongChoice=visitedFirst.answers?[visitedFirst.answers[0]]:[(visitedFirst.answer+1)%4];
answerQuestion(visitedFirst,wrongChoice);const firstFeedback=$('feedback').children[0].textContent;await drain();
vm.runInContext('nextQuestion()',context);
const visitedSecond=JSON.parse(vm.runInContext('JSON.stringify(queue[at])',context)),secondOrder=vm.runInContext('JSON.stringify(displayOrder)',context);
const secondOptions=$('options').children.map(e=>e.textContent);
if(visitedSecond.answers){$('options').children[0].onclick();assert.equal(vm.runInContext('selectedChoices.size',context),1);}
const beforeVisits=vm.runInContext('sessionAnswered',context),storedVisits=JSON.parse(rows.get('frontend-test').state_json).attempts[visitedFirst.id].count;
$('previousQuestion').onclick();assert.equal(vm.runInContext('queue[at].id',context),visitedFirst.id);assert.equal(vm.runInContext('JSON.stringify(displayOrder)',context),firstOrder);
assert($('quizCounter').textContent.includes('回看'));assert.equal($('feedback').children[0].textContent,firstFeedback);assert($('options').children.every(b=>b.disabled));
answerQuestion(visitedFirst);assert.equal(vm.runInContext('sessionAnswered',context),beforeVisits);assert.equal(vm.runInContext('answerOutbox.length',context),0,'revisiting or clicking read-only options never creates writes');
$('nextQuestion').onclick();assert.equal(vm.runInContext('queue[at].id',context),visitedSecond.id);assert.equal(vm.runInContext('JSON.stringify(displayOrder)',context),secondOrder);assert.equal(vm.runInContext('queue.length',context),2,'forward reuses the existing question');
assert($('nextQuestion').disabled,'unanswered current question still requires answer');
if(visitedSecond.answers){assert.equal(vm.runInContext('selectedChoices.size',context),1);assert($('options').children[0].className.includes('selected'));$('options').children[0].onclick();}
else assert.deepEqual($('options').children.map(e=>e.textContent),secondOptions);
answerQuestion(visitedSecond);await drain();
const afterSecond=vm.runInContext('sessionAnswered',context);$('previousQuestion').onclick();$('nextQuestion').onclick();assert.equal(vm.runInContext('sessionAnswered',context),afterSecond);
assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts[visitedFirst.id].count,storedVisits,'history navigation leaves account count unchanged');
$('nextQuestion').onclick();assert.equal(vm.runInContext('queue.length',context),3,'advancing past latest answered question continues random practice');assert.equal(vm.runInContext('at',context),2);
vm.runInContext(`startQuiz([questionMap.get('${priorSingle.id}')])`,context);assert.equal(vm.runInContext('questionVisits.length',context),1);assert($('previousQuestion').disabled,'new practice scope starts fresh history');

// Unsubmitted multi selections survive going back from the newest visit.
vm.runInContext(`startQuiz([questionMap.get('${priorSingle.id}')])`,context);answerQuestion(priorSingle);await drain();
vm.runInContext(`practicePool=[questionMap.get('${priorMulti.id}')];nextQuestion()`,context);
const draftOrder=vm.runInContext('JSON.stringify(displayOrder)',context);$('options').children[0].onclick();$('options').children[2].onclick();
const draftChoices=vm.runInContext('JSON.stringify([...selectedChoices])',context);$('previousQuestion').onclick();$('nextQuestion').onclick();
assert.equal(vm.runInContext('JSON.stringify(displayOrder)',context),draftOrder);assert.equal(vm.runInContext('JSON.stringify([...selectedChoices])',context),draftChoices);
assert(!$('submitAnswer').disabled);assert(!$('feedback').children.length);assert.equal(vm.runInContext('answered',context),false);

// Every referenced UI ID must exist in the real HTML; the mock should not hide missing elements.
const html=fs.readFileSync('public/study.html','utf8');assert(/\.answer-dock\{position:fixed;inset:auto 0 0/.test(html),'dock anchored to viewport bottom');assert(html.includes('env(safe-area-inset-bottom)'));assert(html.includes('#quizPlay{padding-bottom:150px'),'long explanations have dock clearance');assert(html.includes('aria-label="答题操作"'));assert(html.includes('id="submitAnswer"'));assert(html.indexOf('id="nextQuestion"')>html.indexOf('class="answer-dock"'),'Next lives in dock');const code=fs.readFileSync('public/study-app.js','utf8');for(const m of code.matchAll(/\$\('([^']+)'\)/g))assert(html.includes('id="'+m[1]+'"'),m[1]+' exists');

console.log(JSON.stringify({status:'passed',checks:['previous restores choices order and feedback without duplicate writes','forward returns to unfinished question and keeps multi draft','practice continues after history and resets on new scope','expanded verified licensed images and valid point associations','module image gallery and point jump','lazy image loading and source fallback','answer images shown only after grading','directory branches and scroll survive point/unit navigation','overview disclosure state restored','search does not overwrite collapsed branches','previous/next point navigation','unit selector stays open until explicit dismissal','question revisions preserve historical selections','retired question drafts remain saveable','uncertain references have no dead practice action','anonymous write denial','origin restriction','server answer validation','account isolation','concurrent saves','immediate grading while response is pending','two answers continue during background sync','account-scoped unsynced drafts','durable retry deduplication','idempotent retry after lost response','continuous new questions without reshuffled rounds','no repetition before unseen questions exhausted','account-based restart skips practiced questions','explicit review after bank exhausted','shuffled A-D options keep their own explanations','four explanations and extension on every question','module scope remains stable','multiple payload validation','exact set grading and persisted selection','reversible selection before submit','missed and wrong option explanations','single/multi/mixed continuous scopes','viewport fixed Next action with safe-area clearance','Jilin direct course entry','Jilin official web evidence','Jilin regional continuous practice','Jilin searchable authored notes',...(chapter?['chapter reading position saved','chapter learned saved']:[])],chapters:study.curriculum.length,questions:study.questions.length},null,2));

// Reading edition integrity and navigation, including account and local preferences.
vm.runInContext("show('library')",context);assert.equal($('bookLibrary').children.length,6);
const edition=vm.runInContext('STUDY.readingEdition',context);
assert.equal(Object.keys(edition).length,study.curriculum.length);
assert.equal(study.curriculum.filter(c=>['top','bottom'].includes(c.source)&&edition[c.id].authored).length,108);
for(const c of study.curriculum){assert(c.start<=c.end);assert(edition[c.id].thesis&&edition[c.id].route&&edition[c.id].trap&&edition[c.id].recall);for(const id of edition[c.id].pointIds){const p=study.knowledge.find(p=>p.id===id);assert(p.source===c.source&&p.page>=c.start&&p.page<=c.end);}}
for(const source of study.sources){const rows=JSON.parse(fs.readFileSync('public/editions/'+source.id+'.json','utf8')),original=active.pages.filter(p=>p.s===source.id);const excluded=new Set(study.readingCleanup.excludedPages[source.id]||[]);assert.equal(rows.length,original.filter(p=>!excluded.has(p.p)).length,'only useful source pages appear in reading edition');assert(rows.every(r=>r.blocks.every(b=>!/(微信公众号|售后微信|biguo25)/.test(b.text))));}
await vm.runInContext("openChapter('chapter-top-12')",context);assert.equal(vm.runInContext('chapterPage',context),11,'corrected top book PDF offset');assert.equal(vm.runInContext('directoryMode',context),'books');
const directory=$('courseDirectory');const currentButtons=directory.children.filter(b=>b.dataset?.chapterId);assert.equal(currentButtons.length,57);
const stable=directory.children[2];await vm.runInContext("openChapter('chapter-top-31')",context);assert.equal(directory.children[2],stable,'book directory remains mounted across chapter clicks');
await vm.runInContext('turnChapterPage(1)',context);const page=vm.runInContext('chapterPage',context);assert.equal(page,31);
$('readerFont').onclick();assert($('lesson').className.includes('reader-large'));$('readerPaper').onclick();assert($('lesson').className.includes('reader-paper'));
assert(JSON.parse(drafts.get('gongji-reading-preferences-v1')).recent.top.page===page);
$('directorySubjects').onclick();assert.equal(vm.runInContext('directoryMode',context),'subjects');
assert($('courseDirectory').children.length>0);
console.log('Reading edition passed: 303 chapters, 108 book guides, utility pages excluded, original screenshots preserved, corrected offsets, persistent directory and preferences.');

// Source images must correspond to real retained pages, including image-only diagrams.
assert.equal(study.readingCleanup.removedChapters.length,18);
assert(study.curriculum.every(c=>!c.title.includes('章节框架')&&!c.title.endsWith('总览')));
for(const [key,info] of Object.entries(study.readingImages)){assert.equal(key,info.source+':'+info.page);assert(fs.existsSync('public/'+info.src));assert(info.width>=1200&&info.height>0);assert(!info.src.startsWith('/'));}
for(const name of ['top','bottom']){const pages=JSON.parse(fs.readFileSync('public/editions/'+name+'.json'));assert(pages.every(p=>p.image),'every retained book page has its original screenshot');}
await vm.runInContext("openChapter('chapter-bottom-258',262)",context);assert(walk($('chapterBody')).some(e=>e.tag==='img'&&e.src==='images/reading/bottom/262.jpg'));assert(!walk($('chapterBody')).some(e=>e.textContent?.includes('全老维')),'diagram OCR is not presented as prose');
await vm.runInContext("openChapter('chapter-top-83')",context);assert.equal(vm.runInContext('currentChapter.id',context),'chapter-top-84','old outline link resolves to useful content');
console.log('Original page screenshot and removed-chapter compatibility checks passed.');

// Returning from teaching is navigation, never a new practice session or answer.
const settleNavigation=async()=>{for(let i=0;i<100;i++){if(!vm.runInContext('navigationRestoring',context))return;await new Promise(r=>setTimeout(r,1));}throw new Error('navigation restore stalled');};
const quizNav=nav.find(button=>button.dataset.view==='quiz');
const practiceSnapshot=()=>vm.runInContext('JSON.stringify({queue:queue.map(q=>q.id),visits:questionVisits,pool:practicePool.map(q=>q.id),at,answered,displayOrder,selected:[...selectedChoices],sessionAnswered,sessionCorrect})',context);
const linkedSingle=study.questions.find(q=>!q.answers&&q.pointIds?.some(id=>study.knowledge.some(p=>p.id===id)));
vm.runInContext(`startQuiz([questionMap.get('${linkedSingle.id}')],'specific')`,context);answerQuestion(linkedSingle,[(linkedSingle.answer+1)%4]);await drain();
const beforeTeaching=practiceSnapshot(),originalFeedback=$('feedback').children[0],originalAttempt=JSON.parse(rows.get('frontend-test').state_json).attempts[linkedSingle.id].count;
browserWindow.scrollY=1234;
walk($('feedback')).find(e=>e.textContent==='回到本题知识点讲解').onclick();
assert(walk($('lessonReturn')).some(e=>e.textContent==='返回刷题'),'teaching provides visible return to quiz');
assert(browserEntries[browserIndex].url.includes('point='),'knowledge route is represented in browser URL');
browserWindow.history.back();await settleNavigation();
assert.equal(practiceSnapshot(),beforeTeaching);assert.equal($('feedback').children[0],originalFeedback,'return retains the existing explanation DOM');assert.equal(browserWindow.scrollY,1234,'return restores quiz reading position');assert(!$('quizPlay').className.includes('hidden'));
browserWindow.history.forward();await settleNavigation();assert(!$('pointLesson').className.includes('hidden'));
quizNav.onclick();assert.equal(practiceSnapshot(),beforeTeaching,'top quiz nav resumes without resetting questions');
vm.runInContext(`openPoint('${linkedSingle.pointIds[0]}')`,context);
const sibling=study.knowledge.find(p=>p.module===linkedSingle.module&&p.id!==linkedSingle.pointIds[0]);vm.runInContext(`openPoint('${sibling.id}')`,context);
walk($('lessonReturn')).find(e=>e.textContent==='返回当前题').onclick();assert.equal(practiceSnapshot(),beforeTeaching,'browsing further knowledge points retains a direct return');
$('searchLink').onclick();assert.deepEqual(browserWindow.opened,{url:'search.html',target:'_blank',features:'noopener'});assert.equal(practiceSnapshot(),beforeTeaching,'full-text search leaves current question intact');
$('practiceSettings').onclick();assert(!$('quizSetup').className.includes('hidden'));assert(!$('resumePractice').className.includes('hidden'));$('resumePractice').onclick();assert.equal(practiceSnapshot(),beforeTeaching,'settings can resume the unfinished session');
assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts[linkedSingle.id].count,originalAttempt,'all return paths create no extra answer writes');
vm.runInContext(`startQuiz([questionMap.get('${priorMulti.id}')],'specific')`,context);$('options').children[0].onclick();$('options').children[2].onclick();
const draftBeforeTeaching=practiceSnapshot();vm.runInContext(`openPoint('${linkedSingle.pointIds[0]}')`,context);quizNav.onclick();assert.equal(practiceSnapshot(),draftBeforeTeaching,'unsubmitted multi selection survives lesson navigation');assert(!$('submitAnswer').disabled);
$('exitQuiz').onclick();assert.equal(vm.runInContext('practiceActive',context),false);assert($('resumePractice').className.includes('hidden'),'explicit exit ends resumption');
await vm.runInContext("openChapter('chapter-bottom-258',262)",context);await vm.runInContext('turnChapterPage(1)',context);
walk($('chapterGuide')).find(e=>e.textContent==='查看讲解与练习').onclick();assert(walk($('lessonReturn')).some(e=>e.textContent==='返回资料阅读'));
walk($('lessonReturn')).find(e=>e.textContent==='返回资料阅读').onclick();await settleNavigation();assert.equal(vm.runInContext('chapterPage',context),263,'PDF back restores the latest page rather than chapter start');assert.equal(vm.runInContext('currentChapter.id',context),'chapter-bottom-258');
$('coverageModule').value=linkedSingle.module;$('coverageStatus').value='all';$('coverageSearch').value=study.knowledge.find(p=>p.id===linkedSingle.pointIds[0]).title;vm.runInContext("show('coverage')",context);browserWindow.scrollY=777;
vm.runInContext(`openPoint('${linkedSingle.pointIds[0]}')`,context);walk($('lessonReturn')).find(e=>e.textContent==='返回知识点覆盖').onclick();await settleNavigation();assert.equal($('coverageSearch').value,study.knowledge.find(p=>p.id===linkedSingle.pointIds[0]).title);assert.equal(browserWindow.scrollY,777);
vm.runInContext("show('wrong')",context);walk($('wrongList')).find(e=>e.textContent==='重做此题').onclick();
assert(walk($('navigationReturn')).some(e=>e.textContent==='返回错题复习'));walk($('navigationReturn')).find(e=>e.textContent==='返回错题复习').onclick();await settleNavigation();assert(views.find(e=>e.id==='wrong').className.includes('active'));
console.log('Navigation passed: answer-to-knowledge return, browser back/forward, active quiz resumption, multi drafts, no duplicate writes, settings/exit, PDF page and coverage/wrong-list return.');
// Thematic expansions explain the entire group and retain the active question.
const topicById=new Map(study.topicExpansions.map(t=>[t.id,t]));
assert.equal(study.topicExpansions.filter(t=>!t.overviewOnly).length,91);
for(const question of study.questions){const topic=topicById.get(study.questionTopics[question.id]);assert(topic&&!topic.overviewOnly,'every question has an authored subject-specific expansion');assert.equal(topic.module,question.module);assert(topic.diagram.length>=3);}
for(const point of study.knowledge)assert.equal(topicById.get(study.pointTopics[point.id]).module,point.module);
for(const topic of study.topicExpansions){assert(topic.overview&&topic.connection&&topic.boundary&&topic.variant&&topic.recall);assert(topic.relatedTopicIds.every(id=>topicById.get(id).module===topic.module));if(topic.diagramAsset)assert(fs.existsSync('public/'+topic.diagramAsset));for(const figure of topic.sourceFigures)assert(fs.existsSync('public/'+figure.src));}
assert.equal(study.questionTopics.q001,'topic-law-functions');assert.equal(study.questionTopics['k-point-e9e46719b75d3f'],'topic-culture-values');
vm.runInContext("startQuiz([questionMap.get('q001')],'specific')",context);
assert.equal(walk($('feedback')).filter(e=>e.dataset?.topicId).length,0,'no answer diagram reveals the solution beforehand');
answerQuestion(study.questions.find(q=>q.id==='q001'));await drain();
const answerBeforeTopic=practiceSnapshot(),topicAttempt=JSON.parse(rows.get('frontend-test').state_json).attempts.q001.count;
const expansion=walk($('feedback')).find(e=>e.dataset?.topicId==='topic-law-functions');assert(expansion);
const explanationText=walk(expansion).map(e=>e.textContent||'').join(' ');for(const term of ['指引','评价','预测','教育','强制','易混点与适用边界','换个条件怎么考'])assert(explanationText.includes(term));
walk(expansion).find(e=>e.textContent==='打开完整专题').onclick();assert.equal(vm.runInContext('currentTopic.id',context),'topic-law-functions');assert(browserEntries[browserIndex].url.includes('topic=topic-law-functions'));
walk($('lessonReturn')).find(e=>e.textContent==='返回刷题').onclick();await settleNavigation();assert.equal(practiceSnapshot(),answerBeforeTopic);
browserWindow.history.forward();await settleNavigation();assert.equal(vm.runInContext('currentTopic.id',context),'topic-law-functions','browser forward restores full topic');
vm.runInContext("openTopic('topic-crime-stages')",context);walk($('lessonReturn')).find(e=>e.textContent==='返回当前题').onclick();assert.equal(practiceSnapshot(),answerBeforeTopic);await drain();assert.equal(JSON.parse(rows.get('frontend-test').state_json).attempts.q001.count,topicAttempt,'reading expanded knowledge does not submit another answer');
console.log('Topic expansions passed: 91 authored systems, all 1011 questions and 1152 points linked, functional diagram assets, safe factual image links, full-topic return and history preserve attempts.');

// Every selection subset must be graded against the requested multiple-question version.
const refreshedMulti=rawStudy.questions.filter(q=>q.type==='multiple');
const distribution={2:0,3:0,4:0};
assert.equal(refreshedMulti.length,62);
for(const item of refreshedMulti){
  distribution[item.answers.length]++;
  assert(item.revision?.startsWith('multi-'));
  assert.equal(new Set(item.options).size,4);
  assert.equal(item.optionExplanations.length,4);
  assert(!JSON.stringify(item).match(/暂不使用|改写审核时|麦克斯韦提出三省|全部文件直接销毁/));
  user={userId:'multi-subsets-'+item.id,email:'qa@example.test'};
  for(let mask=0;mask<16;mask++){
    const choice=item.options.map((_,index)=>index).filter(index=>mask&(1<<index));
    const response=await post({type:'answer',questionId:item.id,questionRevision:item.revision,choice});
    if(!mask){assert.equal(response.status,400);continue;}
    assert.equal(response.status,200);
    const answer=await response.json();
    const expected=choice.length===item.answers.length&&item.answers.every(index=>choice.includes(index));
    assert.equal(answer.correct,expected,`${item.id} subset ${mask}`);
    assert.deepEqual(answer.state.attempts[item.id].lastChoiceText,choice.map(index=>item.options[index]));
  }
  const original=history.find(old=>old.id===item.id&&!old.revision);
  assert(original,`${item.id}: original answer key retained`);
  assert.notDeepEqual(item.options,original.options,'rewritten distractors are new content');
  user={userId:'multi-history-'+item.id,email:'history@example.test'};
  const legacyResult=await (await post({type:'answer',questionId:item.id,questionRevision:'',choice:original.answers})).json();
  assert.equal(legacyResult.correct,true,'an open old tab is graded against its own options');
  assert.equal(legacyResult.state.attempts[item.id].lastQuestionRevision,'legacy');
  assert.deepEqual(legacyResult.state.attempts[item.id].lastChoiceText,original.answers.map(i=>original.options[i]));
  const latestResult=await (await post({type:'answer',questionId:item.id,questionRevision:item.revision,choice:item.answers})).json();
  assert.equal(latestResult.correct,true);
  assert.equal(latestResult.state.attempts[item.id].count,2,'history remains counted');
  assert.equal(latestResult.state.attempts[item.id].streak,1,'changed content starts a new mastery streak');
}
assert.deepEqual(distribution,{2:40,3:20,4:2});
const grouped=study.knowledge.filter(p=>p.studyGuide);
assert.equal(grouped.length,21);
const principles=study.knowledge.find(p=>p.title==='四项基本原则');
assert.equal(principles.studyGuide.members.length,4);
vm.runInContext(`openPoint('${principles.id}')`,context);
function contentText(node){return [node.textContent||'',...(node.children||[]).map(contentText)].join('\n');}
const pointText=contentText($('pointLesson'));
for(const member of principles.studyGuide.members){assert(pointText.includes(member.name));assert(pointText.includes(member.meaning));}
assert(pointText.includes('易混辨析')&&pointText.includes('怎样记住'));
const related=study.questions.find(q=>q.concept===principles.id);
for(const member of principles.studyGuide.members)assert(related.extension.includes(member.name));
const peace=study.knowledge.find(p=>p.title==='外交和平共处五项原则');
assert.equal(peace.studyGuide.members.length,5);assert.equal(peace.page,173);
assert(!peace.statement.includes('勋章'),'foreign policy content no longer confused with awards');
console.log('Multiple quality passed: 40 two-answer, 20 three-answer, 2 four-answer questions; all 992 subsets checked; all 62 old/new versions remain saveable.');
console.log('Grouped concepts passed: 21 enriched points; four principles explicitly rendered and included in answer expansion; diplomatic content and source corrected.');

// Full coverage is tied to the independently tested wording of each option.
const baselineCoverage=JSON.parse(fs.readFileSync('src/coverage-targets.json','utf8'));
const addedCoverage=study.questions.filter(q=>q.kind==='coverage-authored');
assert.equal(addedCoverage.length,290);
for(const point of study.knowledge){
 assert(point.questionIds.length>0&&point.status==='ready');
 for(const id of point.questionIds)assert(study.questions.find(q=>q.id===id)?.pointIds.includes(point.id),'bidirectional membership');
}
for(const point of baselineCoverage){
 const testing=addedCoverage.filter(q=>q.pointIds.includes(point.id));
 assert(testing.some(q=>q.answers)&&testing.some(q=>!q.answers),'each restored point has single and multi practice');
 assert(testing.every(q=>q.optionAssessments.some(a=>a.pointId===point.id)),'not an untested association');
}
for(const q of addedCoverage){
 assert.equal(new Set(q.options).size,4);
 assert.equal(q.optionAssessments.length,4);
 q.optionAssessments.forEach((a,i)=>{assert.equal(a.optionIndex,i);assert(q.pointIds.includes(a.pointId));assert(q.optionExplanations[i].includes(a.verifiedStatement));});
}
assert.equal(study.coverage.withQuestions,study.knowledge.length);
assert.equal(study.coverage.pendingQuestions+study.coverage.pendingReview,0);
// Exhaustively grade every subset for new multis and every answer for new singles.
user={userId:'coverage-grading',email:'coverage@example.test'};
let coverageGrades=0;
for(const q of addedCoverage){
 const choices=q.answers?Array.from({length:15},(_,mask)=>[0,1,2,3].filter(i=>(mask+1)&(1<<i))):[0,1,2,3];
 for(const choice of choices){
  const expected=q.answers?JSON.stringify(choice)===JSON.stringify(q.answers):choice===q.answer;
  const response=await (await post({type:'answer',questionId:q.id,questionRevision:q.revision,choice})).json();
  assert.equal(response.correct,expected);coverageGrades++;
 }
}
// Draw continuously with account-shaped records: unseen points outrank variants
// on already seen concepts; no repeated new question before the bank is exhausted.
const savedCoverageState=vm.runInContext('JSON.stringify(state)',context);
vm.runInContext('state={attempts:{},learned:{},planDay:1};practicePool=STUDY.questions;recentQuestions=[];lastConcept=null',context);
const seenQuestionIds=new Set(),seenPointIds=new Set();
while(seenPointIds.size<study.knowledge.length){
 const chosen=JSON.parse(vm.runInContext('JSON.stringify(selectNextQuestion())',context));
 assert(!seenQuestionIds.has(chosen.id));
 assert(chosen.pointIds.some(id=>!seenPointIds.has(id)),'continues adding uncovered knowledge');
 seenQuestionIds.add(chosen.id);chosen.pointIds.forEach(id=>seenPointIds.add(id));
 vm.runInContext(`state.attempts[${JSON.stringify(chosen.id)}]={count:1,lastCorrect:true,lastAt:Date.now(),lastQuestionRevision:${JSON.stringify(chosen.revision||'legacy')}};lastConcept=${JSON.stringify(chosen.concept||chosen.id)}`,context);
}
vm.runInContext(`state=${savedCoverageState}`,context);
console.log(JSON.stringify({fullCoverage:'passed',knowledge:seenPointIds.size,questions:study.questions.length,newQuestions:addedCoverage.length,exhaustiveGrades:coverageGrades,continuousDrawsToCoverKnowledge:seenQuestionIds.size}));

// Curated prerequisites and course associations are shared across every entry point.
const curatedTopics=JSON.parse(fs.readFileSync('src/course-topic-map.json','utf8'));
assert.equal(Object.keys(curatedTopics).length,1152);
for(const q of study.questions){
 const expected=[...new Set(q.pointIds.map(id=>curatedTopics[id]))];
 assert.deepEqual(Array.from(study.questionTopicIds[q.id]),expected,'expansion follows assessed knowledge, including multi-topic questions');
 for(const id of expected)assert(topicById.get(id).questionIds.includes(q.id));
}
assert(study.questions.some(q=>study.questionTopicIds[q.id].length>1));
const originalPointIndex=study.knowledge;
const namedPoint=title=>study.knowledge.find(p=>p.title===title);
assert.equal(study.pointTopics[namedPoint('价格机制').id],'topic-market-demand');
assert.equal(study.pointTopics[namedPoint('四个意识').id],'topic-party-building');
assert.equal(study.pointTopics[namedPoint('中国太阳能资源分布').id],'topic-energy-environment');
assert.equal(study.pointTopics[namedPoint('生产关系的三个要素').id],'topic-commodity-money');
assert.equal(study.foundationCount,38);
vm.runInContext("openLesson('m06')",context);
assert.equal(vm.runInContext('directoryPointButtons.size',context),0,'default directory consists of module and topic entries');
assert.equal(vm.runInContext('directoryGroups.size',context),91,'each thematic lesson appears once');
for(const member of principles.studyGuide.members)assert(contentText($('lessonPoints')).includes(member.name));
vm.runInContext("openTopic('topic-theory-development')",context);
for(const member of principles.studyGuide.members)assert(contentText($('pointLesson')).includes(member.name));
assert(walk($('pointLesson')).some(e=>e.className==='lesson-fact'),'full course has inline fact teaching, not only links or PDFs');
for(const title of ['“两个基本点”','强国之路']){
 const p=namedPoint(title);assert(p.prerequisites?.length);
 vm.runInContext(`openPoint('${p.id}')`,context);
 for(const member of principles.studyGuide.members)assert(contentText($('pointLesson')).includes(member.name));
}
const strongRoad=study.questions.find(q=>q.id==='q130');
vm.runInContext(`queue=[questionMap.get('${strongRoad.id}')];at=0;answered=true;displayOrder=[0,1,2,3];renderQuestion();answered=true;renderAnswer(queue[0].answer)`,context);
for(const member of principles.studyGuide.members)assert(contentText($('feedback')).includes(member.name));
$('courseSearch').value='四项基本原则';vm.runInContext('renderCourseDirectory()',context);
assert(vm.runInContext('directoryPointButtons.has(currentPoint.id)',context),'search can still reach individual point details');
$('courseSearch').value='';vm.runInContext('renderCourseDirectory()',context);
console.log(JSON.stringify({courseModules:'passed',subjects:10,modules:13,topics:91,prerequisiteGroups:38,assessedQuestions:study.questions.length,inlineCourses:true,defaultPointLeaves:0}));

// Source import: every non-video file is accounted for and source figures are usable.
const mark=study.markLibrary;assert.equal(mark.stats.files,282);assert.equal(mark.stats.xmindFiles,60);assert.equal(mark.stats.imageFiles,76);assert(mark.stats.ocrPages>690);
const manifest=JSON.parse(fs.readFileSync('public/materials/manifest.json'));assert.equal(manifest.length,282);assert(manifest.every(f=>f.status==='空文件标记，无学习正文'||mark.documents.some(d=>d.id===f.document)));assert(manifest.every(f=>!f.name.endsWith('.mp4')));
let markUnits=0,markFigures=0,markTrees=0;
for(const entry of mark.documents){const doc=JSON.parse(fs.readFileSync('public/materials/'+entry.id+'.json'));assert.equal(doc.units.length,entry.unitCount);markUnits+=doc.units.length;for(const u of doc.units){assert(u.blocks.length>0,u.id+' contains actual source learning material');assert(u.start<=u.end);assert(u.topicIds.every(id=>study.topicExpansions.some(t=>t.id===id)));assert(u.blocks.every(b=>b.page>=u.start&&b.page<=u.end),u.id+' has exact PDF page provenance');if(u.trees)markTrees++;}for(const image of doc.images){markFigures++;assert(image.width>0&&image.height>0);const bytes=fs.readFileSync('public/'+image.asset);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}if(entry.category==='题本复盘')assert(doc.answerUnitId,'bank answer pages were not mistaken for a contents page');}
assert.equal(markUnits,mark.stats.units);assert.equal(markFigures,mark.stats.images);assert.equal(markTrees,60);
const themes=mark.documents.find(d=>d.category==='86专题');assert.equal(themes.unitCount,86);const themeDoc=JSON.parse(fs.readFileSync('public/materials/'+themes.id+'.json'));assert(themeDoc.units.every(u=>u.overview&&u.method.includes(u.overview)&&u.facts.length));assert.equal(themeDoc.units.filter(u=>u.teaching).length,31);assert(themeDoc.units[18].teaching.text.includes('而立30岁'));
await vm.runInContext(`renderMark({view:'materials',doc:'${themes.id}',unit:'${themeDoc.units[18].id}'})`,context);assert(contentText($('markContent')).includes('而立30岁'),'supplement course has full foundational members');assert(contentText($('markContent')).includes('下一节'));assert(contentText($('markContent')).includes('返回资料目录'));
console.log(JSON.stringify({markMaterials:'passed',files:manifest.length,documents:mark.documents.length,units:markUnits,figures:markFigures,xmindTrees:markTrees,themes:86,legacyQuizUnaffected:true}));
// Interview materials: complete source spans, method units excluded from random practice,
// previous/next and return retain the same prompt, and account notes are validated and isolated.
const interview=study.interviewLibrary;
assert.equal(interview.modules.length,8);assert.equal(interview.questions.length,100);
assert.equal(interview.questions.filter(q=>q.kind==='question').length,97);
const interviewRefs=JSON.parse(fs.readFileSync('public/interview/questions.json','utf8'));
for(const q of interview.questions){assert(interviewRefs[q.id]?.length);assert(interviewRefs[q.id].every(p=>p.page>=q.start&&p.page<=q.end&&p.text.length));if(q.kind==='question')assert(q.stem.length>10);}
assert.equal(JSON.stringify(interview.modules.flatMap(m=>m.lessons.flatMap(l=>l.pages.map(p=>p.page)))),JSON.stringify(Array.from({length:61},(_,i)=>i+6)));
vm.runInContext("interviewFilter='all';interviewNext(true)",context);
const interviewFirst=vm.runInContext('interviewQueue[0].id',context);
for(let i=1;i<97;i++)vm.runInContext('interviewNext()',context);
assert.equal(vm.runInContext('new Set(interviewQueue.map(q=>q.id)).size',context),97);
assert(vm.runInContext("interviewQueue.every(q=>q.kind==='question')",context));
const lastInterview=vm.runInContext('interviewQueue[interviewAt].id',context);
vm.runInContext('interviewPrevious();interviewNext()',context);assert.equal(vm.runInContext('interviewQueue[interviewAt].id',context),lastInterview);
vm.runInContext(`openInterview('practice','${interviewFirst}')`,context);assert.equal(vm.runInContext('interviewAt',context),0);
user={userId:'interview-tester',email:'i@example.test'};
assert.equal((await post({type:'interview',questionId:'unknown',outline:'x',review:''})).status,400);
assert.equal((await post({type:'interview',questionId:interviewFirst,outline:'x'.repeat(12001),review:''})).status,400);
const interviewMutation={type:'interview',questionId:interviewFirst,outline:'身份、目标、措施',review:'措施要更具体',mutationId:'interview-save-000001'};
assert.equal((await post(interviewMutation)).status,200);
assert.equal((await post(interviewMutation)).status,200);
assert.equal((await post({...interviewMutation,outline:'changed'})).status,503);
let interviewState=await (await api.api.GET()).json();assert.equal(interviewState.state.interview[interviewFirst].outline,interviewMutation.outline);assert.equal(interviewState.revision,2);
user={userId:'interview-other',email:'o@example.test'};interviewState=await (await api.api.GET()).json();assert.equal(interviewState.state.interview,undefined);
console.log(JSON.stringify({interview:'passed',modules:8,sourceTopics:100,practiceTopics:97,sourcePages:387,frameworkPages:61,accountIsolation:true,randomCoverage:true}));
