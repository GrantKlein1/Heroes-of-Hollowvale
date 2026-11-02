import json,random
from PIL import Image,ImageDraw
A=json.load(open('atlas.json'));S={k:Image.open('gfx/'+k).convert('RGBA') for k in ['Overworld.png','character.png']}
def g(n):
  x,y,w,h=A[n]['rect'];return S[A[n]['sheet']].crop((x,y,x+w,y+h))
R=random.Random(7);W,H=20,12;m=Image.new('RGBA',(320,192))
grid=[['grass']*W for _ in range(H)]
for y in range(H):
  for x in range(W):
    if R.random()<.08: grid[y][x]=R.choice(['grass_detail1','grass_detail2'])
road=(8,9,10)
for y in range(H):
  if y in (8,9,10): continue
  cap=None
  for x,side in zip(road,'wce'):
    if cap: grid[y][x]={'w':f'sand_{cap}w','c':f'sand_{cap}','e':f'sand_{cap}e'}[side].replace('sand_nw','sand_nw') if side!='c' else f'sand_{cap}'
    else: grid[y][x]='sand_'+side
for x in range(W): grid[8][x]='water_n';grid[9][x]='water_c';grid[10][x]='water_s'
for y in range(H):
  for x in range(W): m.paste(g(grid[y][x]),(x*16,y*16))
objs=[];fp=[]
def put(n,x,y,foot=None):  # x,y = bottom-left anchor in px
  im=g(n);objs.append((y,n,x,y-im.height))
  if foot: fp.append(foot)
put('house',16,96,(16,64,96,96))
for i in range(5): put('fence_h',16+i*16,110,(16+i*16,104,32+i*16,110))
put('barrel',100,96,(100,88,116,96));put('crate',116,62,(116,54,132,62))
for (tx,ty) in [(208,40),(232,30),(256,44),(284,34),(304,48),(220,70),(264,76),(300,80),(240,104),(290,112)]:
  put('tree',tx,ty,(tx+10,ty-6,tx+22,ty))
put('rock',120,180,(120,171,131,180));put('rock',60,170,(60,161,71,170))
put('bush',170,120,(170,112,185,120));put('flowers',40,186);put('flowers_scatter',182,40);put('flowers',110,30)
br=g('bridge_v');put('bridge_v',144+11,8*16+br.height+6)
put('hero_down',145,72)
for y0,n,x,y in sorted(objs, key=lambda o:(o[1]!='bridge_v',o[0])):
  m.alpha_composite(g(n),(x,y))
m.resize((1280,768),0).save('test-screen.png')
c=m.copy();o=Image.new('RGBA',c.size);d=ImageDraw.Draw(o)
bx0,bx1=155,155+br.width
for a,b in [(0,bx0-1),(bx1,319)]: d.rectangle([a,8*16+10,b,10*16+5],fill=(255,0,0,110))
for f in fp: d.rectangle(f,fill=(255,0,0,90),outline=(255,0,0,255))
c.alpha_composite(o);c.resize((1280,768),0).save('test-screen-collision.png')
