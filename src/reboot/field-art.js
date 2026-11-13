import {environmentProp,prop} from '../mission/art.js';
import {fieldScene,sitePresentation} from './field-scene.js';
import {orderTarget,sortieOrder,railGarrison,wireGarrison,relayCrewLeft} from './campaign.js';
import {FIELD} from './content.js';

export function paintTerrainMargins(c,index,margin){
 const scene=fieldScene(index);
 c.fillStyle=scene.water||scene.ground;c.fillRect(-margin,0,margin+1,1200);
 c.fillStyle=index===2?scene.water:scene.ground;c.fillRect(1599,0,margin+1,1200);
 if(index===0){c.fillStyle=scene.water;c.fillRect(1599,FIELD.bottom,margin+1,1200-FIELD.bottom);}
 if(!scene.water)return;
 c.fillStyle='#85a49c36';
 for(let i=0;i<15;i++){
  const x=-18-(i*23)%88,y=35+i*79;
  c.fillRect(x,y,13+i%4*3,2);
  if(index===2)c.fillRect(1600-x-20,y+31,16,2);
 }
}
export function paintNorthBoundary(c,index,margin){
 const ground=fieldScene(index).ground;
 c.fillStyle=ground;c.fillRect(-112,-margin,1824,margin+1);
 c.fillStyle='#172729a3';c.fillRect(-112,-margin,1824,margin);
 c.fillStyle='#101f24b5';c.fillRect(-112,-26,1824,26);
 c.fillStyle='#9aa99479';c.fillRect(-112,-5,1824,3);
 for(let x=8;x<1600;x+=54){
  c.fillStyle='#141f25';c.fillRect(x,-39,10,39);
  c.fillStyle='#858a7585';c.fillRect(x+2,-39,3,36);
  c.fillStyle='#a3a38982';c.fillRect(x+10,-22,44,2);
 }
}
function paintRailTrack(c,points,seed){
 c.strokeStyle='#302e25';c.lineWidth=68;c.lineJoin='round';c.beginPath();
 points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
 for(let i=1;i<points.length;i++){
  const [ax,ay]=points[i-1],[bx,by]=points[i],length=Math.hypot(bx-ax,by-ay),angle=Math.atan2(by-ay,bx-ax);
  c.save();c.translate(ax,ay);c.rotate(angle);
  for(let d=0;d<length;d+=23){
   for(let j=0;j<7;j++){
    const y=(seed+j*19+d*3)%63-31;
    c.fillStyle=j%2?'#615742':'#493f30';c.fillRect(d+(j*11)%21,y,3+j%3,2+j%2);
   }
   c.fillStyle='#262923';c.fillRect(d-5,-30,10,62);
   c.fillStyle='#76664c';c.fillRect(d-4,-28,7,57);
   c.fillStyle='#9c8763';c.fillRect(d-4,-28,2,57);
   c.fillStyle='#b29a6c';
   for(const y of [-18,14])c.fillRect(d-3,y,5,5);
  }
  for(const y of [-17,17]){
   c.fillStyle='#242b28';c.fillRect(0,y-3,length,7);
   c.fillStyle='#99998a';c.fillRect(0,y-2,length,4);
   c.fillStyle='#c3bca1';c.fillRect(0,y-2,length,1);
  }
  c.restore();
 }
}
function paintSurface(c,materials,index){
 if(!materials)return;
 const w=materials.width/2,h=materials.height/2;
 const sx=index===1?w:0,sy=index>=2?h:0;
 c.save();
 c.globalCompositeOperation='soft-light';
 c.globalAlpha=[.82,.69,.68][index];
 c.drawImage(materials,sx,sy,w,h,0,0,1600,1200);
 c.restore();
}
function paintWater(c,materials,index){
 if(!materials||index===1)return;
 const w=materials.width/2,h=materials.height/2;
 c.save();
 c.beginPath();
 c.rect(0,0,FIELD.left,1200);
 c.rect(0,FIELD.bottom,1600,1200-FIELD.bottom);
 if(index===2)c.rect(1562,0,38,1200);
 c.clip();
 c.globalAlpha=.76;
 c.drawImage(materials,w,h,w,h,0,0,1600,1200);
 c.restore();
}
const STENCIL={
 0:['111','101','101','101','111'],1:['010','110','010','010','111'],
 2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001']
};
function paintMark(c,x,y,label,color){
 c.fillStyle=color;
 for(let i=0;i<label.length;i++){
  const left=x-label.length*8+i*16;
  STENCIL[label[i]].forEach((row,j)=>{for(let k=0;k<3;k++)if(row[k]==='1')c.fillRect(left+k*4,y-20+j*4,4,4);});
 }
 c.fillRect(x-19,y+4,36,2);
}
function paintQuay(c,seed){
 for(let i=0;i<48;i++){
  const x=(seed+i*137)%1542+25,y=1164+(i*11)%32;
  c.fillStyle=i%3?'#597d7f72':'#1b3e527d';c.fillRect(x,y,9+i%9*3,1+i%2);
 }
 for(let i=0;i<26;i++){
  const y=22+i*44;
  c.fillStyle='#597d7f67';c.fillRect(4+i%5*4,y,12,2);c.fillRect(1570+i%5*4,y+15,13,2);
 }
 for(let x=78;x<1540;x+=142){
  c.fillStyle='#21363d';c.fillRect(x-8,1137,19,17);c.fillRect(x-12,1148,29,5);
  c.fillStyle='#a6a485';c.fillRect(x-8,1137,19,4);c.fillStyle='#c4aa70';c.fillRect(x-5,1144,12,3);
  c.fillStyle='#9eaa8c';c.fillRect(x-33,1152,12,2);c.fillRect(x+27,1152,12,2);
 }
 for(let i=0;i<75;i++){
  const x=132+(seed+i*151)%1318,y=978+(i*67)%148;
  c.fillStyle=i%3?'#283d434d':'#9aaea652';c.fillRect(x,y,7+i%9*3,2);
 }
}
function paintCoastGround(c,scene,seed,art){
 const variation=(seed>>>0)%173;
 c.save();
 // The beach is traversable up to this wet lip, even where the breakers overlap it.
 for(let i=0;i<54;i++){
  const x=42+i*29,y=FIELD.bottom-4-((i*13+i*i)%9),width=12+(i*17)%29;
  c.fillStyle='#435d596c';c.fillRect(x,y-2,width,4);
  c.fillStyle=i%4===0?'#dde5bdad':'#9fb8a698';c.fillRect(x+3,y+2,width-5,2);
  if(i%3===0)c.fillRect(x+7,y+5,8,1);
 }
 // Worn landing mat pieces lead into the beach from the strip of surf.
 for(const x of [622,784,946]){
  c.fillStyle='#3f42374d';c.fillRect(x-31,1108,66,39);
  for(let y=1110;y<1144;y+=7){
   c.fillStyle='#656556';c.fillRect(x-32,y,63,5);
   c.fillStyle='#a39674';c.fillRect(x-31,y,60,1);
  }
  for(const side of [-1,1]){c.fillStyle='#c0aa77';c.fillRect(x+side*28,1110,3,33);}
 }
 c.restore();
 for(let i=0;i<58;i++){
  const x=48+(i*139+variation)%1510,y=FIELD.bottom+6+(i*7)%28;
  c.fillStyle=i%3?'#678f8b':'#4c747a';c.fillRect(x,y,7+i%5*4,2);
  if(i%4===0)c.fillRect(8+(i*9)%19,28+i*19,10,2);
 }
 for(let i=0;i<24;i++){
  const x=48+i*65,y=FIELD.bottom-5-(i*7)%4;
  c.fillStyle=i%3?'#b4b093':'#d0bb88';c.fillRect(x,y,15+i%4*5,2);
  c.fillStyle='#6f8376';c.fillRect(x+8,y+3,11,2);
 }
 for(const track of scene.tracks){
  for(let i=1;i<track.length;i++){
   const [ax,ay]=track[i-1],[bx,by]=track[i],length=Math.hypot(bx-ax,by-ay);
   c.save();c.translate(ax,ay);c.rotate(Math.atan2(by-ay,bx-ax));
   for(const side of [-1,1]){
    for(let x=7;x<length-4;x+=18){
     const offset=side*(13+(Math.floor(x/18)+i)%3);
     c.fillStyle='#564d383f';c.fillRect(x,offset,Math.min(length-x,12),4);
     c.fillStyle='#d2b98947';c.fillRect(x+1,offset+4,7,2);
    }
   }
   c.restore();
  }
 }
 for(let i=0;i<39;i++){
  const x=98+(i*263+variation*3)%1392,y=282+(i*173+variation)%820;
  const w=16+i%7*9,light=i%3===0;
  c.fillStyle=light?'#c5a97855':'#6d69483c';
  c.fillRect(x+8,y,w-12,3);c.fillRect(x,y+3,w,6);c.fillRect(x+3,y+9,w-15,3);
  c.fillStyle=light?'#dbc09459':'#4e503a34';
  c.fillRect(x+12,y+2,9+i%4*3,2);c.fillRect(x+4,y+7,6,2);
  if(i%4===0){
   c.fillStyle='#756e4a';c.fillRect(x+4,y+2,2,4);c.fillRect(x+7,y+4,2,3);
  }
 }
 if(art)for(const [x,y,w] of [[702,1110,94],[1019,963,122],[1390,602,101],[243,805,85]]){
  c.save();c.translate(x,y);c.scale(1,.55);
  environmentProp(c,art,3,0,0,0,w,.48);c.restore();
 }
}
export function paintCoastOpening(c,{routes}){
 for(const {path,kind,color,recommended} of routes)for(let leg=1;leg<path.length;leg++){
  const [ax,ay]=path[leg-1],[bx,by]=path[leg],dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
  c.save();c.translate(ax,ay);c.rotate(Math.atan2(dy,dx));
  // Scuffed paint sits on the sand. The footsteps and tire marks stay distinct without color.
  const footsteps=kind==='rescue',start=footsteps?48:52,stride=footsteps?28:34;
  for(let d=start,i=0;d<length-61;d+=stride,i++){
   c.fillStyle='#3d413269';
   if(footsteps){
    const y=i%2===0?-6:6;
    c.fillRect(d-5,y-2,16,8);c.fillStyle=color+'c7';
    c.fillRect(d-4,y,5,4);c.fillRect(d+3,y-1,7,6);
   }else for(const y of [-13,10]){
    c.fillStyle='#3d413269';c.fillRect(d-3,y-1,17,6);
    c.fillStyle=color+(recommended?'eb':'b3');c.fillRect(d,y,5,4);c.fillRect(d+7,y,5,4);
   }
  }
  if(length>110){
   c.fillStyle=recommended?'#223a30b8':'#283b335e';c.fillRect(82,-11,24,22);
   c.strokeStyle=color;c.lineWidth=3;c.beginPath();
   c.moveTo(89,-6);c.lineTo(97,0);c.lineTo(89,6);c.stroke();
  }
  c.restore();
 }
}
export function paintTerrain(c,index,seed,art){
 const scene=fieldScene(index,seed);c.fillStyle=scene.ground;c.fillRect(0,0,1600,1200);
 for(const s of scene.shapes){c.beginPath();if(s.type==='rect'){c.fillStyle=s.fill;c.fillRect(s.x,s.y,s.w,s.h);continue;}s.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(s.fill){c.closePath();c.fillStyle=s.fill;c.fill();}if(s.stroke){c.strokeStyle=s.stroke;c.lineWidth=s.width;c.setLineDash(s.dash||[]);c.stroke();c.setLineDash([]);}}
 paintSurface(c,art?.materials,index);
 paintWater(c,art?.materials,index);
 const grainCount=index===0?1500:1260;
 for(let i=0;i<grainCount;i++){const x=(i*137+(seed%211))%1600,y=(i*263+(seed%137))%1200;if(x<80||x>1560||(index===0||index===2)&&y>=1146)continue;c.fillStyle=scene.grain[i%2]+(i%3?'28':'38');c.fillRect(x,y,i%5+2,i%3+1);}
 if(index===0)paintCoastGround(c,scene,seed,art);
 for(let i=0;i<55;i++){const x=130+(i*271+seed%97)%1320,y=75+(i*173+seed%113)%1050;c.fillStyle='#2f3d3025';c.fillRect(x,y,7+i%7,3);c.fillStyle='#c4b48d33';c.fillRect(x+2,y-2,5,2);}
 if(index===2)paintQuay(c,seed);
 for(const points of scene.rails||[])paintRailTrack(c,points,seed);
 for(const [x,y,label]of scene.marks||[])paintMark(c,x,y,label,index===1?'#c6b17d9c':'#bad1c894');
}
export function paintLandmark(c,art,landmark){
 const {x,y,w,row,col}=landmark;
 c.fillStyle='#18272548';
 c.beginPath();c.ellipse(x+8,y-2,w*.49,w*.11,0,0,Math.PI*2);c.fill();
 environmentProp(c,art,row,col,x,y,w,.9);
}
export function coverDepth(b,index){
 if(index===0)return b.hp<0?38:15;
 if(index===1&&b.hp<0)return 37;
 return Math.min(40,Math.max(22,b.w*.19));
}
export function coverMasksPilot(b,index,p){
 const overhang=coverDepth(b,index);
 return p.x>b.x-10&&p.x<b.x+b.w+10&&p.y>b.y-overhang&&p.y<b.y+8;
}
function paintRailWagon(c,b,sprite){
 const {x,y,w,h}=b,rust=b.id==='r2'||b.id==='r4',depth=coverDepth(b,1),roof=y-depth,end=y+h;
 if(sprite){
  c.save();
  if(rust)c.filter='sepia(.54) hue-rotate(-24deg) saturate(1.3)';
  c.drawImage(sprite,x,roof,w,h+depth);
  c.restore();
  return;
 }
 const paint=rust?['#512f2d','#865749','#bc8c66','#cfaa78']:['#2f423e','#527065','#80927a','#b4b38b'];
 c.fillStyle='#192723';c.fillRect(x+3,y,w-6,h);c.fillRect(x+w/2-8,end-8,16,10);
 c.fillStyle=paint[0];c.fillRect(x+3,end-depth-6,w-6,depth);
 c.fillStyle=paint[1];c.fillRect(x+8,end-depth-5,w-17,depth-10);
 c.fillStyle='#171f20';c.fillRect(x+10,end-8,w-20,6);
 c.fillStyle='#d49355';
 for(const side of [17,w-24])c.fillRect(x+side,end-14,7,4);
 c.fillStyle='#292e28';c.fillRect(x,roof+9,w,h-18);c.fillRect(x+8,roof,w-16,h);
 c.fillStyle=paint[1];c.fillRect(x+4,roof+9,w-8,h-18);
 c.fillStyle=paint[2];c.fillRect(x+15,roof+5,w-30,h-14);
 c.fillStyle=paint[3];c.fillRect(x+16,roof+5,4,h-14);
 c.fillStyle=paint[0];c.fillRect(x+w-16,roof+8,5,h-16);
 for(let rib=20;rib<h-12;rib+=23){
  c.fillStyle='#2c302a70';c.fillRect(x+5,roof+rib,w-10,5);
  c.fillStyle='#e4cba185';c.fillRect(x+13,roof+rib-2,w-30,2);
  c.fillStyle=paint[0];c.fillRect(x+7,roof+rib,5,6);c.fillRect(x+w-12,roof+rib,5,6);
 }
 c.fillStyle='#272f2a';c.fillRect(x+w/2-16,roof+31,32,22);
 c.fillStyle=paint[1];c.fillRect(x+w/2-13,roof+33,26,16);
 c.fillStyle=paint[3];c.fillRect(x+w/2-12,roof+34,24,2);
 c.fillStyle='#d6c39b';c.fillRect(x+19,end-19,18,5);
 for(let i=0;i<32;i++){
  c.fillStyle=i%2?'#d1a47366':'#30292355';
  c.fillRect(x+11+(i*23)%(w-23),roof+12+(i*31)%(h-22),3+i%6,1+i%2);
 }
}
function paintLoadedCover(c,b,art,row,col){
 const cell=art.environment.rows[row].cells[col],height=cell.h/cell.w*b.w;
 const projection=b.h+coverDepth(b,row===0?0:2);
 c.save();c.translate(b.x+b.w/2,b.y+b.h);c.scale(1,Math.min(1,projection/height));
 environmentProp(c,art,row,col,0,0,b.w);c.restore();
}
function paintDebris(c,b){
 c.fillStyle='#293a364c';c.fillRect(b.x+4,b.y+5,b.w-8,b.h-10);
 for(let i=0;i<12;i++){
  const x=b.x+7+i*37%(b.w-20),y=b.y+7+i*19%(b.h-15);
  c.fillStyle=i%3?'#33443d':'#986d49';c.fillRect(x,y,5+i%7,3+i%3);
 }
}
export function paintCoverShadow(c,b,index){
 const {x,y,w,h}=b,shift=index===2?14:22,soft=index===0?'#3b362a':'#182724';
 c.fillStyle=soft+'30';c.fillRect(x+shift,y+9,w,h+3);
 c.fillStyle=soft+'43';c.fillRect(x+4,y+h-11,w+shift-8,18);
 c.fillStyle=soft+'60';c.fillRect(x+3,y+h-8,w-6,12);
}
export function paintBlock(c,b,index,art){
 if(b.hp===0){if(index>0){paintDebris(c,b);return;}c.fillStyle='#343b3444';c.fillRect(b.x,b.y,b.w,b.h);if(art)environmentProp(c,art,3,0,b.x+b.w/2,b.y+b.h,b.w,.55);return;}
 if(art&&index===0){if(b.hp>0)prop(c,art,3,2,b.x+b.w/2,b.y+b.h,b.w);else paintLoadedCover(c,b,art,0,2);return;}
 if(art&&index===2){paintLoadedCover(c,b,art,1,b.hp>0?3:b.id==='p2'||b.id==='p4'?1:0);return;}
 if(index===1&&b.hp<0&&b.id?.startsWith('r')){paintRailWagon(c,b,art?.railWagon);return;}
 if(art&&index===1&&b.hp>0){paintLoadedCover(c,b,art,1,3);return;}
 c.fillStyle='#4a5b49';c.fillRect(b.x,b.y-18,b.w,b.h+18);c.fillStyle='#839074';c.fillRect(b.x+3,b.y-18,b.w-6,17);c.fillStyle='#a1a887';c.fillRect(b.x+4,b.y-17,b.w-8,3);c.fillStyle='#283e32';c.fillRect(b.x,b.y,b.w*.08,b.h);c.fillRect(b.x+b.w-6,b.y,6,b.h);
 for(let y=b.y+7;y<b.y+b.h-6;y+=17){c.fillStyle='#273b32';c.fillRect(b.x+8,y,b.w-16,3);c.fillStyle='#85906c';c.fillRect(b.x+10,y+3,b.w-20,2);}for(let i=0;i<12;i++){c.fillStyle=i%2?'#b2a46b66':'#23362a88';c.fillRect(b.x+12+(i*19)%Math.max(1,b.w-24),b.y+12+(i*31)%Math.max(1,b.h-25),6+i%7,3);}c.fillStyle='#c2b67b';c.fillRect(b.x+b.w-25,b.y+b.h-18,12,7);
}
export function paintSiteGround(c,n,near,active){
 c.save();
 if(n.coastApproach){
  const truck=n.coastApproach==='f',width=truck?156:88;
  c.save();c.translate(truck?(n.baseX??n.x):n.x,n.y);
  c.fillStyle='#4d4a3538';c.fillRect(-width/2+8,-20,width-16,38);c.fillRect(-width/2,-12,width,21);
  c.fillStyle='#c5ad785f';
  for(const side of [-1,1]){
   const x=side*(width/2-13);
   c.fillRect(x-5,12,10,3);c.fillRect(x-1,1,3,12);
  }
  if(!truck&&active){
   c.fillStyle='#3a453760';c.fillRect(-36,-11,72,16);
   for(let i=0;i<6;i++){
    const x=-38+i*13,y=i%2===0?-9:-12;
    c.fillStyle='#74684b';c.fillRect(x,y,14,11);
    c.fillStyle='#ae9d74';c.fillRect(x+2,y+1,10,4);
    c.fillStyle='#584f3c';c.fillRect(x+6,y+7,2,4);
   }
  }
  c.restore();
 }
 c.translate(n.x,n.y);
 c.fillStyle='#273b3035';c.beginPath();c.ellipse(0,0,48,19,0,0,Math.PI*2);c.fill();
 if(n.state==='done'){c.fillStyle='#71816877';c.fillRect(-25,-11,50,16);c.restore();return;}
 if(near||active){const color=n.state==='ready'?'#f2ce80':'#e5d4a577';c.strokeStyle=color;c.lineWidth=2;for(const side of [-1,1]){c.beginPath();c.moveTo(side*43,-19);c.lineTo(side*43,8);c.lineTo(side*31,8);c.stroke();}}
 c.restore();
}
export function paintGate(c,gate,age,reduced){
 const progress=Math.min(1,age/.75),opened=reduced?1:1-(1-progress)**3;
 c.save();c.translate(gate.x,gate.y);
 c.fillStyle='#14282966';c.beginPath();c.ellipse(3,9,65,22,0,0,Math.PI*2);c.fill();
 c.fillStyle='#101e20';c.fillRect(-57,-68,11,80);c.fillRect(46,-68,11,80);
 c.fillStyle='#354442';c.fillRect(-56,-62,8,69);c.fillRect(48,-62,8,69);
 c.fillStyle='#21342f';c.fillRect(-52,-14,104,37);
 c.fillStyle='#687f70';c.fillRect(-48,-12,96,31);
 for(let i=0;i<12;i++){
  c.fillStyle=i%2?'#9b854b':'#31483e';c.fillRect(-47+i*8,13,8,6);
 }
 c.fillStyle='#142827';c.fillRect(-44,-67,88,79);
 c.fillStyle='#182f2b';c.fillRect(-32,-56,64,69);
 c.fillStyle='#528f6b';c.fillRect(-31,-54,2,62);c.fillRect(29,-54,2,62);
 const light=c.createRadialGradient(0,8,2,0,8,59);light.addColorStop(0,'#9fef9bb3');light.addColorStop(.54,'#6fbf8b4d');light.addColorStop(1,'#6fbf8b00');
 c.fillStyle=light;c.fillRect(-30,-54,60,66);
 for(let i=0;i<8;i++){
  const y=7-(i*17+(reduced?0:age*26))%54,x=i*19%51-25;
  c.fillStyle=i%3?'#abe9a977':'#e7f5bdc0';c.fillRect(x,y,i%3?1:2,3+i%3);
 }
 for(const side of [-1,1]){
  const x=side<0?-48:34;
  c.fillStyle='#253b36';c.fillRect(x,-61,14,69);
  c.fillStyle='#809183';c.fillRect(x+2,-61,4,65);
  c.fillStyle='#1a302c';c.fillRect(x-4,4,22,8);
  c.fillStyle='#8fdab0';c.fillRect(x+4,-53,5,10);
  c.fillStyle='#b2b093';c.fillRect(x+3,-27,3,3);c.fillRect(x+3,-8,3,3);
  const panelX=side<0?-32:32*opened,panelWidth=32*(1-opened);
  c.fillStyle='#4a6356';c.fillRect(panelX,-56,panelWidth,67);
  c.fillStyle='#2c483e';for(let y=-52;y<10;y+=9)c.fillRect(panelX,y,panelWidth,2);
 }
 c.fillStyle='#53695c';c.fillRect(-50,-68,100,12);
 c.fillStyle='#b0b28e';c.fillRect(-48,-68,96,3);
 c.fillStyle='#143027';c.fillRect(-27,-65,54,10);
 c.fillStyle='#c3edaf';c.fillRect(-22,-62,44,3);
 c.fillStyle='#20352d';c.fillRect(-39,-65,5,4);c.fillRect(34,-65,5,4);
 for(const side of [-1,1]){
  c.fillStyle='#1b2927';c.fillRect(side*50-6,-51,12,13);
  c.fillStyle='#e4bd67';c.fillRect(side*50-4,-49,8,4);
  c.fillStyle='#a48754';c.fillRect(side*50-4,-45,8,3);
 }
 c.fillStyle='#d6ecc0';c.beginPath();c.moveTo(-9,3);c.lineTo(0,-5);c.lineTo(9,3);c.lineTo(9,7);c.lineTo(0,0);c.lineTo(-9,7);c.fill();
 c.restore();
}
export function paintGateApproach(c,gate,near){
 c.save();c.translate(gate.x,gate.y);
 c.fillStyle='#314d3b66';c.beginPath();c.moveTo(-43,16);c.lineTo(43,16);c.lineTo(59,70);c.lineTo(-59,70);c.fill();
 c.strokeStyle=near?'#bee3a7':'#86a482';c.lineWidth=2;
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(side*43,24);c.lineTo(side*54,61);c.lineTo(side*43,61);c.stroke();
  c.fillStyle='#ced698';c.fillRect(side*45-3,30,6,3);
 }
 c.strokeStyle='#b5dda581';
 for(let y=32;y<=55;y+=12){c.beginPath();c.moveTo(-9,y+4);c.lineTo(0,y-2);c.lineTo(9,y+4);c.stroke();}
 c.restore();
}
export function paintWreckGround(c,x,y,index){
 c.save();c.translate(x,y);
 for(const [dx,dy,w,h,fill] of [[0,7,index===1?133:83,35,'#17282843'],[12,17,60,24,'#26302b55'],[-25,10,29,15,'#2c312b66']]){
  c.fillStyle=fill;c.beginPath();c.ellipse(dx,dy,w,h,-.08,0,Math.PI*2);c.fill();
 }
 for(let i=0;i<14;i++){
  const x=(i*31)%167-83,y=(i*23)%45;
  c.fillStyle=i%4?'#364036':'#ba895a';c.fillRect(x,y,3+i%5,2+i%3);
 }
 c.restore();
}
export function paintWreckSmoke(c,x,y,age,reduced){
 c.save();c.translate(x,y);
 for(let i=0;i<7;i++){
  const rise=reduced?i/8:(age*.38+i/7)%1;
  const drift=rise*35+(i%3-1)*11,sz=9+rise*13,top=-28-rise*62;
  c.globalAlpha=(1-rise)*.38;
  c.fillStyle='#28312b';c.fillRect(drift-sz/2,top,sz,sz*.74);
  c.fillStyle='#465047';c.fillRect(drift-sz*.63,top+sz*.3,sz*.72,sz*.52);
 }
 c.restore();
}
export function paintEntryRoutes(c,entry){
 c.save();
 c.lineWidth=3;c.lineCap='round';c.lineJoin='round';
 for(const route of entry.direct?[entry.direct,...entry.routes]:entry.routes){
  const markedRail=route.recommended&&['rail-cache','rail-relay','rail-ammo'].includes(route.site);
  if(markedRail){
   const [x,y]=route.path.at(-1);
   c.lineWidth=9;c.strokeStyle='#202e2bba';c.setLineDash([15,11]);c.beginPath();
   route.path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
   c.setLineDash([]);c.lineWidth=2;c.strokeStyle=route.color+'bc';
   c.beginPath();c.moveTo(x-28,y+18);c.lineTo(x-28,y+32);c.lineTo(x-14,y+32);
   c.moveTo(x+28,y+18);c.lineTo(x+28,y+32);c.lineTo(x+14,y+32);c.stroke();
  }
  c.lineWidth=route.recommended?4:3;
  c.strokeStyle=route.color+(markedRail?'e5':route.recommended?'b8':'86');c.setLineDash(route.recommended?[15,11]:[9,15]);c.beginPath();
  route.path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  c.setLineDash([]);
  for(let i=1;i<route.path.length;i++){
   const [x,y]=route.path[i-1],[tx,ty]=route.path[i],dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy);
   c.save();c.translate(x,y);c.rotate(Math.atan2(dy,dx));
   c.strokeStyle=route.color+'af';
   for(let at=52;at<length-29;at+=102){
    c.beginPath();c.moveTo(at-6,-7);c.lineTo(at+2,0);c.lineTo(at-6,7);c.stroke();
   }
   c.restore();
  }
 }
 c.restore();
}
export function paintEntrySigns(c,entry,pilot,canPlace){
 c.save();
 for(const route of entry.direct?[entry.direct,...entry.routes]:entry.routes){
  const [x,y]=route.path.at(route.labelAt??1);
  if(Math.hypot(x-pilot.x,y-pilot.y)>265)continue;
  c.font='bold 12px Galmuri';c.textAlign='center';
  const width=c.measureText(route.sign).width+20;
  const labelY=[-43,-107,-75,28].map(offset=>y+offset).find(y=>canPlace(x,y-2,width/2,15));
  if(labelY===undefined)continue;
  c.fillStyle='#26332c';c.fillRect(x-2,labelY+7,4,24);
  c.fillStyle=route.recommended?'#252b22f7':'#172824ef';c.fillRect(x-width/2,labelY-14,width,23);
  c.fillStyle=route.color;c.fillRect(x-width/2,labelY-14,3,23);c.fillText(route.sign,x,labelY+2);
 }
 c.restore();
}
export function paintPortGantry(c,gantry,art){
 const {x,y,color}=gantry;
 c.save();c.translate(x,y);
 c.fillStyle='#182e309c';c.fillRect(-42,-5,84,18);
 if(art)environmentProp(c,art,3,3,0,6,94);
 else{
  c.fillStyle='#526f69';c.fillRect(-32,-33,64,7);
  for(const side of [-1,1]){
   c.fillStyle='#536963';c.fillRect(side*26-4,-26,8,37);
  }
 }
 c.fillStyle=color;c.fillRect(-41,8,82,3);
 c.strokeStyle=color;c.lineWidth=2;c.beginPath();
 c.moveTo(-10,3);c.lineTo(0,-6);c.lineTo(10,3);
 c.moveTo(-10,11);c.lineTo(0,2);c.lineTo(10,11);c.stroke();
 c.restore();
}
export function paintFrontEntry(c,x,y,index,age,reduced){
 c.save();c.translate(x,y);
 c.globalAlpha=Math.max(0,1-age/1.6);
 c.strokeStyle=index===1?'#dce4b0':'#b7dfcf';c.lineWidth=2;
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(side*36,-35);c.lineTo(side*54,-35);c.lineTo(side*54,15);c.lineTo(side*36,15);c.stroke();
 }
 for(let i=0;i<3;i++){
  const y=-24-i*13-(reduced?0:age*12);
  c.beginPath();c.moveTo(-14,y);c.lineTo(0,y-8);c.lineTo(14,y);c.stroke();
 }
 c.restore();
}
export function paintSite(c,n,s,art,collectedAge=99){
 const kind=sitePresentation(n).icon,ready=n.state==='ready';if(n.state==='done'){if(art&&kind==='rescue'&&collectedAge<2.2)prop(c,art,2,2,n.x+Math.min(35,collectedAge*25),n.y,32,1-collectedAge/2.2);return;}
 if(kind==='battery'&&n.state==='active')return;
 if(kind==='workshop'){
  const {x,y}=n;
  if(art)environmentProp(c,art,1,3,x-31,y+3,54);
  c.fillStyle='#282f2b';c.fillRect(x-29,y-33,69,32);
  c.fillStyle='#687e72';c.fillRect(x-26,y-31,63,20);
  c.fillStyle='#989b79';c.fillRect(x-30,y-36,72,6);
  c.fillStyle='#bea574';c.fillRect(x-16,y-27,38,12);
  c.fillStyle='#40463a';c.fillRect(x-13,y-23,29,4);
  c.fillStyle='#8aa995';c.fillRect(x+28,y-49,7,13);
  c.fillStyle='#d8cf9d';c.fillRect(x+22,y-53,19,5);
 }else if(art&&kind==='battery'){
  if(ready)prop(c,art,2,0,n.x,n.y,48);
  else prop(c,art,3,0,n.x,n.y,82);
 }else if(art){if(kind==='rescue'){prop(c,art,2,1,n.x,n.y,65);prop(c,art,2,0,n.x+39,n.y+7,32);}else if(kind==='truck')prop(c,art,2,3,n.x,n.y,104);else if(kind==='armory'){environmentProp(c,art,3,3,n.x,n.y,112);prop(c,art,2,0,n.x+9,n.y+5,40);}else if(kind==='relay'||kind==='control'){prop(c,art,3,3,n.x,n.y,kind==='control'?90:70);}else{environmentProp(c,art,1,3,n.x-9,n.y,72);prop(c,art,2,0,n.x+16,n.y+4,48);}}
 else{c.fillStyle='#7d8966';c.fillRect(n.x-25,n.y-30,50,30);}
 if(ready){c.fillStyle='#f4d386';c.fillRect(n.x-4,n.y-76,8,8);c.fillStyle='#273d34';c.fillRect(n.x-1,n.y-75,2,4);}
}
export function paintSiteLabel(c,n,s){
 if(n.state==='done'||Math.hypot(n.x-s.player.x,n.y-s.player.y)>185)return;
 const info=sitePresentation(n),guards=s.enemies.filter(e=>!e.dead&&e.siteId===n.id).length;
 const dispatch=orderTarget(s)===n?sortieOrder(s.operation.order):null;
 const crew=n.kind==='relay'&&n.state==='active'?relayCrewLeft(s,n):0,garrison=railGarrison(n)||wireGarrison(s,n);
 const label=n.state==='ready'?`${info.name} · 회수`:crew?`${garrison.crew} ${crew}${garrison.unit} · 해킹 차단`:n.kind==='relay'&&n.state==='active'?`해킹 ${Math.round(n.progress/5*100)}%`:n.state==='active'?`${info.name} · 경비 ${guards}`:info.name;
 const text=dispatch?`◇ ${label}`:label;
 c.font='10px Galmuri';const width=c.measureText(text).width+16,x=n.x-width/2,y=n.y+14;c.fillStyle='#1c302de6';c.fillRect(x,y,width,20);c.fillStyle=dispatch?.color||(n.state==='ready'?'#ffdb8e':'#e7dfbb');c.textAlign='center';c.fillText(text,n.x,y+14);
}
