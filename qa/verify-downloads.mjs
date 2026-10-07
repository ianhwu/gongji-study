import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpile(fs.readFileSync('app/downloads/[filename]/route.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}).replace('export async function GET','async function GET');
let calls=[],available=true;
const context=vm.createContext({Response,encodeURIComponent,fetch:async(url,options)=>{calls.push({url,options});return new Response(available?'%PDF-1.7 test':'unavailable',{status:available?200:404});}});vm.runInContext(code+';this.handler=GET;',context);
for(const filename of ['top-study.pdf','bottom-study.pdf','interview-100.pdf','interview-framework.pdf']){
 const response=await context.handler(new Request('https://example.test/downloads/'+filename,{headers:{Authorization:'private-account-value'}}),{params:Promise.resolve({filename})});
 assert.equal(response.status,200);assert((await response.text()).startsWith('%PDF'));assert.equal(response.headers.get('Content-Type'),'application/pdf');assert(response.headers.get('Content-Disposition').includes('attachment;'));
 assert.equal(calls.at(-1).url,'https://ianhwu.github.io/gongji-study/downloads/'+filename);assert.equal(calls.at(-1).options.headers,undefined,'account headers are not sent to Pages');
}
const before=calls.length;const missing=await context.handler(new Request('https://example.test/downloads/unknown'),{params:Promise.resolve({filename:'../../other.pdf'})});assert.equal(missing.status,404);assert.equal(calls.length,before,'only fixed documents are fetchable');
available=false;const failure=await context.handler(new Request('https://example.test/downloads/top-study.pdf'),{params:Promise.resolve({filename:'top-study.pdf'})});assert.equal(failure.status,503);
console.log('Edition download routes passed: PDF streaming, fixed filenames, no account header forwarding, unavailable source recovery.');
