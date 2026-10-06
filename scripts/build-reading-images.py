"""Render source page screenshots for study editions; originals are read-only."""
import sys,json,argparse
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from reading_edition import compile_editions
parser=argparse.ArgumentParser();parser.add_argument('--source-directory',type=Path,default=Path('/Users/ian/Desktop/学习'));args=parser.parse_args()
def render_book(task):
 import fitz
 source,path,numbers=task;doc=fitz.open(path);folder=ROOT/'public/images/reading'/source;folder.mkdir(parents=True,exist_ok=True);rows={}
 for count,n in enumerate(numbers,1):
  page=doc[n-1];dest=folder/f'{n:03d}.jpg'
  if not dest.exists():
   pix=page.get_pixmap(matrix=fitz.Matrix(1200/page.rect.width,1200/page.rect.width),alpha=False)
   pix.pil_save(str(dest),format='JPEG',quality=78,optimize=True)
  from PIL import Image
  with Image.open(dest) as im:w,h=im.size
  rows[source+':'+str(n)]={'src':f'images/reading/{source}/{n:03d}.jpg','width':w,'height':h,'source':source,'page':n}
  if count%60==0:print(f'{source}: {count}/{len(numbers)} source pages',flush=True)
 return rows
if __name__=='__main__':
 study=json.loads((ROOT/'src/learning.json').read_text());pages=json.loads((ROOT/'src/active-data.json').read_text());compile_editions(study,pages)
 tasks=[]
 for source,name in [('top','公基学霸笔记  上册.pdf'),('bottom','公基学霸笔记  下册.pdf')]:
  chapters=[c for c in study['curriculum'] if c['source']==source]
  numbers=sorted({n for c in chapters for n in c['readingPages']+c.get('overviewPages',[])})
  tasks.append((source,str(args.source_directory/name),numbers))
 rows={}
 with ProcessPoolExecutor(max_workers=2) as pool:
  for result in pool.map(render_book,tasks):rows.update(result)
 (ROOT/'src/reading-images.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
 print(json.dumps({'screenshots':len(rows),'manifest':'src/reading-images.json'}),flush=True)
