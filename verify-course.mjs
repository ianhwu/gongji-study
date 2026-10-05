import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
  constructor(id=''){this.id=id;this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.className='';this.classList={add(){},remove(){},toggle(){}};}
  append(...elements){this.children.push(...elements)}
  replaceChildren(...elements){this.children=[...elements]}
}
function initialize(html){
  const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const nav=['home','lesson','quiz','wrong','plan'].map(view=>{const e=new Element();e.dataset.view=view;return e});
  const document={getElementById:$,createElement:()=>new Element(),querySelectorAll:selector=>selector==='.view'?[]:nav};
  const context=vm.createContext({document,window:{location:{},scrollTo(){}},localStorage:{getItem(){return null},setItem(){}},Date,Math,JSON,console});
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
  vm.runInContext(fs.readFileSync('release-baseline/learning-data.js','utf8')+inline,context);
  return {context,$,nav};
}
const before=initialize(fs.readFileSync('release-baseline/index.html','utf8'));
before.nav.find(x=>x.dataset.view==='lesson').onclick();
assert.equal(before.$('lessonTitle').textContent,'','reproduced original blank course');
assert.equal(before.$('lessonCards').children.length,0);
const after=initialize(fs.readFileSync('dist/index.html','utf8'));
after.nav.find(x=>x.dataset.view==='lesson').onclick();
assert.equal(after.$('lessonTitle').textContent,'法理与宪法');
assert(after.$('lessonCards').children.length>0,'first course click populates cards');
after.$('lessonSelect').onchange({target:{value:'m02'}});
assert.equal(after.$('lessonTitle').textContent,'民法');
after.nav.find(x=>x.dataset.view==='home').onclick();
after.nav.find(x=>x.dataset.view==='lesson').onclick();
assert.equal(after.$('lessonTitle').textContent,'民法','reopening retains selected module');
for(const name of fs.readdirSync('release-baseline')) {
  if(name!=='index.html') assert.deepEqual(fs.readFileSync('release-baseline/'+name),fs.readFileSync('dist/'+name),'published data unchanged: '+name);
}
const old=fs.readFileSync('release-baseline/index.html','utf8');
const fixed=fs.readFileSync('dist/index.html','utf8');
assert.equal(fixed,old.replace("b.onclick=()=>show(b.dataset.view);","b.onclick=()=>b.dataset.view==='lesson'?openLesson(currentModule):show(b.dataset.view);"),'only course handler changed');
console.log('Verified: original blank reproduced; first click and course switching repaired; all existing published data unchanged.');
