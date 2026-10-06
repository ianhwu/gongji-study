import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=path.resolve('dist-pages'),html=fs.readFileSync(root+'/index.html','utf8');
const app=fs.readFileSync(root+'/study-app.js','utf8');
const config=JSON.parse(fs.readFileSync('pages-config.json'));
const elements=new Map();
class Element{
 constructor(id=''){this.id=id;this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.className='';this.disabled=false;this.open=false;this.classList={add:s=>{this.className+=' '+s},remove:s=>{this.className=this.className.split(' ').filter(x=>x!==s).join(' ')},toggle:(s,a)=>this.classList[a?'add':'remove'](s)};}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(k,v){this[k]=v}
 removeAttribute(k){delete this[k]}
 scrollIntoView(){}
 focus(){}
 querySelectorAll(s){return this.children.filter(x=>s==='details'&&x.tag==='details')}
 get firstChild(){return this.children[0]}
}
for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],new Element(match[1]));
const $=id=>{assert(elements.has(id),'real element exists: '+id);return elements.get(id)};
const views=['home','lesson','quiz','wrong','tools','coverage'].map($),nav=views.map(e=>{const n=new Element();n.dataset.view=e.id;return n});
let fetches=0;
const document={getElementById:$,createElement:tag=>{const e=new Element();e.tag=tag;return e},createTextNode:text=>({textContent:text}),querySelectorAll:s=>s==='.view'?views:nav};
const context=vm.createContext({document,window:{location:{search:'?module=m14',href:''},scrollTo(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},crypto:webcrypto,URLSearchParams,Date,Math,Map,Set,JSON,console,setTimeout,clearTimeout,encodeURIComponent,fetch:async()=>{fetches++;throw new Error('Pages must not call server API')}});
vm.runInContext(fs.readFileSync(root+'/learning-data.js','utf8')+fs.readFileSync(root+'/data.js','utf8')+app,context);
assert.equal(fetches,0,'static course does not request /api/progress');
assert.equal(vm.runInContext('currentModule',context),'m14');assert.equal(vm.runInContext('accountReady',context),true);assert.equal(vm.runInContext('signedIn',context),false);
assert.equal(vm.runInContext('STUDY.visualReferences.length',context),67);
const imagePaths=vm.runInContext('STUDY.visualReferences.map(i=>i.asset)',context);
for(const asset of imagePaths){assert(!asset.startsWith('/'));assert(fs.existsSync(path.join(root,asset)));assert.equal(new URL(asset,'https://test.github.io/gongji-study/').pathname,'/gongji-study/'+asset)}
const topicPaths=vm.runInContext('STUDY.topicExpansions.map(t=>t.diagramAsset).filter(Boolean)',context);
for(const asset of topicPaths){assert(!asset.startsWith('/'));assert(fs.existsSync(path.join(root,asset)));}
const codes=['index.html','study.html','search.html','source.html'];
for(const filename of codes){const text=fs.readFileSync(root+'/'+filename,'utf8');for(const m of text.matchAll(/(?:src|href)="([^"#]+)"/g)){const value=m[1];if(/^(https?:|data:|mailto:)/.test(value))continue;assert(!value.startsWith('/'),filename+' has repository-relative link '+value);const rel=value.split(/[?#]/)[0];if(rel)assert(fs.existsSync(path.join(root,rel)),filename+' local link exists '+rel)}}
const walk=e=>[e,...(e.children||[]).flatMap(walk)];
vm.runInContext("openPoint('jl-point-crater-lake')",context);assert(walk($('pointLesson')).some(e=>e.tag==='img'&&e.src==='images/visual/changbai-tianchi.jpg'));
vm.runInContext('startEndless()',context);assert(context.window.location.href.startsWith(config.accountOrigin+'/study.html'));assert.equal(fetches,0,'account practice uses existing service without fake local account');
assert(html.includes('href="'+config.accountOrigin+'/account"'),'account links use configured service');
assert(fs.existsSync(root+'/.nojekyll'));assert(!fs.existsSync(root+'/.openai'));assert(!fs.existsSync(root+'/.git'));
console.log(JSON.stringify({status:'passed',checks:['course and Jilin entry initialize without server','67 images and all current knowledge diagrams load below repository subpath','all local HTML assets and links exist','account practice and login lead to configured account service','no Pages request to dynamic progress API','static artifact has no repository or hosting metadata']},null,2));
