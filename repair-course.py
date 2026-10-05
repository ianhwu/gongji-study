from pathlib import Path
import shutil
import json
r=Path(__file__).parent
out=r/'dist'
if out.exists(): shutil.rmtree(out)
shutil.copytree(r/'release-baseline',out)
p=out/'index.html'
s=p.read_text()
old="for(const b of document.querySelectorAll('.nav button[data-view]'))b.onclick=()=>show(b.dataset.view);"
new="for(const b of document.querySelectorAll('.nav button[data-view]'))b.onclick=()=>b.dataset.view==='lesson'?openLesson(currentModule):show(b.dataset.view);"
assert s.count(old)==1
p.write_text(s.replace(old,new))
print('Repaired course navigation; existing published content retained.')
