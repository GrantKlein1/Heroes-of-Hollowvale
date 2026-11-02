import json
from PIL import Image,ImageDraw
O=Image.open('gfx/Overworld.png').convert('RGBA');C=Image.open('gfx/character.png').convert('RGBA')
T=lambda c,r:{'sheet':'Overworld.png','rect':[c*16,r*16,16,16]}
def obj(sheet,c0,r0,c1,r1):
  im={'Overworld.png':O,'character.png':C}[sheet]
  x,y=c0*16,r0*16;bb=im.crop((x,y,c1*16,r1*16)).getbbox()
  return {'sheet':sheet,'rect':[x+bb[0],y+bb[1],bb[2]-bb[0],bb[3]-bb[1]]}
A={'grass':T(0,9),'grass_detail1':T(1,9),'grass_detail2':T(0,10),
 # sand/path: 3x3 outer (sand patch on grass) + inner corners (grass blob on sand)
 'sand_nw':T(0,3),'sand_n':T(1,3),'sand_ne':T(2,3),'sand_w':T(0,4),'sand_c':T(1,4),'sand_e':T(2,4),'sand_sw':T(0,5),'sand_s':T(1,5),'sand_se':T(2,5),
 'sand_inner_nw':T(0,6),'sand_inner_ne':T(1,6),'sand_inner_sw':T(0,7),'sand_inner_se':T(1,7),
 'water_nw':T(2,6),'water_n':T(3,6),'water_ne':T(4,6),'water_w':T(2,7),'water_c':T(3,7),'water_e':T(4,7),'water_sw':T(2,8),'water_s':T(3,8),'water_se':T(4,8),
 'water_inner_nw':T(2,9),'water_inner_ne':T(3,9),'water_inner_sw':T(2,10),'water_inner_se':T(3,10),'water_deep':T(3,3),
 'house':obj('Overworld.png',6,0,11,5),'tree':obj('Overworld.png',5,16,7,18),
 'fence_h':obj('Overworld.png',4,17,5,18),'fence_square':obj('Overworld.png',2,17,4,19),'fence_post_v':obj('Overworld.png',0,17,1,19),
 'bridge_v':obj('Overworld.png',5,6,8,9),'bridge_h':obj('Overworld.png',8,6,10,8),
'crate':obj('Overworld.png',30,0,31,2),'barrel':obj('Overworld.png',33,0,34,2),
 'rock':obj('Overworld.png',6,5,7,6),'bush':obj('Overworld.png',2,14,3,15),'flowers':obj('Overworld.png',1,8,2,9),'flowers_scatter':obj('Overworld.png',0,8,1,9),
 'hero_down':obj('character.png',0,0,1,2)}
json.dump(A,open('atlas.json','w'),indent=1)
S={'Overworld.png':O,'character.png':C}
def get(n):
  x,y,w,h=A[n]['rect'];return S[A[n]['sheet']].crop((x,y,x+w,y+h))
cells=[];W=0
sh=Image.new('RGBA',(1200,900),(60,60,70,255));d=ImageDraw.Draw(sh);x=y=8;rowh=0
for n in A:
  im=get(n).resize((get(n).width*4,get(n).height*4),0);w=max(im.width,90)
  if x+w>1190: x=8;y+=rowh+24;rowh=0
  sh.alpha_composite(im,(x,y));d.rectangle([x-1,y-1,x+im.width,y+im.height],outline=(255,255,0));d.text((x,y+im.height+3),n,fill='white')
  x+=w+10;rowh=max(rowh,im.height)
sh.crop((0,0,1200,y+rowh+24)).save('contact-sheet.png')
