#!/usr/bin/env python3
"""Build a static learning portal; account features stay on the configured service."""
import json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
OUTPUT=ROOT/'dist-pages'
config=json.loads((ROOT/'pages-config.json').read_text())
origin=config['accountOrigin'].rstrip('/')
if config['accountMode']!='linked-site' or not origin.startswith('https://'):
    raise SystemExit('Configure an HTTPS account service before building Pages.')
if OUTPUT.exists():shutil.rmtree(OUTPUT)
shutil.copytree(PUBLIC,OUTPUT)
(OUTPUT/'.nojekyll').touch()
script=(OUTPUT/'study-app.js').read_text()
script='const PAGES_ACCOUNT_ORIGIN='+json.dumps(origin)+';\n'+script
script=script.replace("async function loadAccount() {", """async function loadAccount() {
  if(typeof PAGES_ACCOUNT_ORIGIN!=='undefined'){
    accountReady=true;signedIn=false;
    accountMessage('课程、图片和资料可直接浏览。账号刷题与跨设备学习记录在账号网站中使用。',true);
    renderHome();return;
  }""")
script=script.replace("function requireAccount() {", """function requireAccount() {
  if(typeof PAGES_ACCOUNT_ORIGIN!=='undefined'){
    window.location.href=PAGES_ACCOUNT_ORIGIN+'/study.html?module='+encodeURIComponent(currentModule);
    return false;
  }""")
script=script.replace("'/account'", "PAGES_ACCOUNT_ORIGIN+'/account'")
script=script.replace("'/account?returnTo='", "PAGES_ACCOUNT_ORIGIN+'/account?returnTo='")
(OUTPUT/'study-app.js').write_text(script)
data=(OUTPUT/'learning-data.js').read_text().replace('"asset":"/images/visual/', '"asset":"images/visual/')
(OUTPUT/'learning-data.js').write_text(data)
for name in ['index.html','study.html']:
    file=OUTPUT/name;html=file.read_text()
    html=html.replace('href="/account"','href="'+origin+'/account"')
    html=html.replace('一直随机刷题</button>','进入账号刷题</button>')
    html=html.replace('<h2>学习记录</h2>','<h2>账号学习记录</h2>')
    start=html.index('<div class="stats">');end=html.index('<p class="muted small">登录后记录',start)
    html=html[:start]+'<p>登录账号网站查看课程进度、答题与错题记录。</p><a class="btn secondary" href="'+origin+'/account">查看账号与学习记录</a><div class="hidden"><b id="statLessons"></b><b id="statCorrect"></b><b id="statWrong"></b></div>'+html[end:]
    html=html.replace('登录后记录按账号保存，换设备也能继续。','使用原账号登录，学习记录继续跨设备同步。')
    file.write_text(html)
print('Static Pages portal built in '+str(OUTPUT))
