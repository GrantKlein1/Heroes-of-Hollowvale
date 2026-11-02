import sys
from PIL import Image,ImageDraw
f,c0,r0,c1,r1,S=sys.argv[1],*map(int,sys.argv[2:7])
s=Image.open('gfx/'+f).convert('RGBA').crop((c0*16,r0*16,c1*16,r1*16))
bg=Image.new('RGBA',s.size,(255,0,255,255));bg.alpha_composite(s)
im=bg.resize((s.width*S,s.height*S),0);d=ImageDraw.Draw(im)
for i in range(c1-c0+1): d.line([(i*16*S,0),(i*16*S,im.height)],fill=(255,0,0))
for j in range(r1-r0+1): d.line([(0,j*16*S),(im.width,j*16*S)],fill=(255,0,0))
for i in range(c1-c0):
  for j in range(r1-r0): d.text((i*16*S+2,j*16*S+2),f'{c0+i},{r0+j}',fill=(255,255,0))
im.save(sys.argv[7])
