import {environmentProp,prop} from '../mission/art.js';
import {fieldScene,sitePresentation} from './field-scene.js';

export function paintTerrainMargins(c,index,margin){
 const scene=fieldScene(index);
 c.fillStyle=scene.water||scene.ground;c.fillRect(-margin,0,margin+1,1200);
 c.fillStyle=index===2?scene.water:scene.ground;c.fillRect(1599,0,margin+1,1200);
 if(!scene.water)return;
 c.fillStyle='#85a49c36';
 for(let i=0;i<15;i++){
  const x=-18-(i*23)%88,y=35+i*79;
  c.fillRect(x,y,13+i%4*3,2);
  if(index===2)c.fillRect(1600-x-20,y+31,16,2);
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
export function paintTerrain(c,index,seed,art){
 const scene=fieldScene(index,seed);c.fillStyle=scene.ground;c.fillRect(0,0,1600,1200);
 for(const s of scene.shapes){c.beginPath();if(s.type==='rect'){c.fillStyle=s.fill;c.fillRect(s.x,s.y,s.w,s.h);continue;}s.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(s.fill){c.closePath();c.fillStyle=s.fill;c.fill();}if(s.stroke){c.strokeStyle=s.stroke;c.lineWidth=s.width;c.setLineDash(s.dash||[]);c.stroke();c.setLineDash([]);}}
 const grainCount=index===0?2600:1260;
 for(let i=0;i<grainCount;i++){const x=(i*137+(seed%211))%1600,y=(i*263+(seed%137))%1200;if(x<80||x>1560||index===2&&y>=1146)continue;c.fillStyle=scene.grain[i%2]+(i%3?'28':'38');c.fillRect(x,y,i%5+2,i%3+1);}
 if(index===0){for(let y=0;y<1200;y+=23){const center=y>650?850+(y-650)*.025:915-y*.1;for(const dx of [-65,65]){c.fillStyle='#353e3027';c.fillRect(center+dx,y,6,13);c.fillStyle='#a99b7427';c.fillRect(center+dx+7,y,3,13);}}}
 for(let i=0;i<55;i++){const x=130+(i*271+seed%97)%1320,y=75+(i*173+seed%113)%1050;c.fillStyle='#2f3d3025';c.fillRect(x,y,7+i%7,3);c.fillStyle='#c4b48d33';c.fillRect(x+2,y-2,5,2);}
 if(index===2)paintQuay(c,seed);
 for(const points of scene.rails||[])paintRailTrack(c,points,seed);
 for(const [x,y,label]of scene.marks||[])paintMark(c,x,y,label,index===1?'#c6b17d9c':'#bad1c894');
 if(art)for(const [r,col,x,y,w]of scene.landmarks)environmentProp(c,art,r,col,x,y,w,.9);
}
function paintRailWagon(c,b){
 const {x,y,w,h}=b,rust=b.id==='r2'||b.id==='r4';
 c.fillStyle='#242b25';c.fillRect(x,y+10,w,h-20);c.fillRect(x+12,y,w-24,h);
 c.fillStyle=rust?'#5e5141':'#515948';c.fillRect(x+6,y+10,w-12,h-20);
 c.fillStyle=rust?'#746044':'#63674e';c.fillRect(x+15,y+7,w-30,h-14);
 c.fillStyle=rust?'#846f4e':'#77785a';c.fillRect(x+23,y+9,w-46,h-18);
 c.fillStyle=rust?'#8d7b58':'#898365';c.fillRect(x+32,y+9,w-64,h-18);
 for(let rib=18;rib<h-12;rib+=19){
  c.fillStyle='#383b3088';c.fillRect(x+9,y+rib,w-18,4);
  c.fillStyle='#b4a47799';c.fillRect(x+15,y+rib+4,w-30,2);
  c.fillStyle='#343b30';c.fillRect(x+5,y+rib,8,5);c.fillRect(x+w-13,y+rib,8,5);
 }
 for(const end of [y+6,y+h-9]){
  c.fillStyle='#292f27';c.fillRect(x+w/2-12,end,24,4);
  c.fillStyle='#b19b66';c.fillRect(x+20,end,8,3);c.fillRect(x+w-28,end,8,3);
 }
 for(let i=0;i<11;i++){
  c.fillStyle=i%2?'#a78a5b88':'#43423466';
  c.fillRect(x+19+(i*17)%(w-38),y+12+(i*31)%(h-25),4+i%6,2);
 }
}
function paintLoadedCover(c,b,art,row,col){
 const cell=art.environment.rows[row].cells[col],height=cell.h/cell.w*b.w;
 const projection=b.h+Math.min(40,Math.max(22,b.w*.19));
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
export function paintBlock(c,b,index,art){
 if(b.hp===0){if(index>0){paintDebris(c,b);return;}c.fillStyle='#343b3444';c.fillRect(b.x,b.y,b.w,b.h);if(art)environmentProp(c,art,3,0,b.x+b.w/2,b.y+b.h,b.w,.55);return;}
 c.fillStyle='#182a2b33';c.beginPath();c.ellipse(b.x+b.w/2+5,b.y+b.h-3,b.w*.53,Math.min(b.h*.35,26),0,0,Math.PI*2);c.fill();
 if(art&&index===0){if(b.hp>0)prop(c,art,3,2,b.x+b.w/2,b.y+b.h,b.w);else environmentProp(c,art,0,2,b.x+b.w/2,b.y+b.h,b.w);return;}
 if(art&&index===2){paintLoadedCover(c,b,art,1,b.hp>0?3:b.id==='p2'||b.id==='p4'?1:0);return;}
 if(index===1&&b.hp<0&&b.id?.startsWith('r')){paintRailWagon(c,b);return;}
 if(art&&index===1&&b.hp>0){paintLoadedCover(c,b,art,1,3);return;}
 c.fillStyle='#4a5b49';c.fillRect(b.x,b.y-18,b.w,b.h+18);c.fillStyle='#839074';c.fillRect(b.x+3,b.y-18,b.w-6,17);c.fillStyle='#a1a887';c.fillRect(b.x+4,b.y-17,b.w-8,3);c.fillStyle='#283e32';c.fillRect(b.x,b.y,b.w*.08,b.h);c.fillRect(b.x+b.w-6,b.y,6,b.h);
 for(let y=b.y+7;y<b.y+b.h-6;y+=17){c.fillStyle='#273b32';c.fillRect(b.x+8,y,b.w-16,3);c.fillStyle='#85906c';c.fillRect(b.x+10,y+3,b.w-20,2);}for(let i=0;i<12;i++){c.fillStyle=i%2?'#b2a46b66':'#23362a88';c.fillRect(b.x+12+(i*19)%Math.max(1,b.w-24),b.y+12+(i*31)%Math.max(1,b.h-25),6+i%7,3);}c.fillStyle='#c2b67b';c.fillRect(b.x+b.w-25,b.y+b.h-18,12,7);
}
export function paintSiteGround(c,n,near,active){
 c.save();c.translate(n.x,n.y);c.fillStyle='#273b3035';c.beginPath();c.ellipse(0,0,48,19,0,0,Math.PI*2);c.fill();
 if(n.state==='done'){c.fillStyle='#71816877';c.fillRect(-25,-11,50,16);c.restore();return;}
 if(near||active){const color=n.state==='ready'?'#f2ce80':'#e5d4a577';c.strokeStyle=color;c.lineWidth=2;for(const side of [-1,1]){c.beginPath();c.moveTo(side*43,-19);c.lineTo(side*43,8);c.lineTo(side*31,8);c.stroke();}}
 c.restore();
}
export function paintGate(c,gate,age,reduced){
 const progress=Math.min(1,age/.75),opened=reduced?1:1-(1-progress)**3;
 c.save();c.translate(gate.x,gate.y);
 c.fillStyle='#14282966';c.beginPath();c.ellipse(3,9,65,22,0,0,Math.PI*2);c.fill();
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
 c.fillStyle='#a5ad8f';c.fillRect(-48,-68,96,3);
 c.fillStyle='#c3edaf';c.fillRect(-22,-60,44,3);
 c.fillStyle='#20352d';c.fillRect(-39,-65,5,4);c.fillRect(34,-65,5,4);
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
 for(const route of entry.routes){
  c.strokeStyle=route.color+'a0';c.setLineDash([10,11]);c.beginPath();
  route.path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  c.setLineDash([]);
  const [x,y]=route.path.at(route.labelAt??1),labelY=y-43;
  c.font='bold 12px Galmuri';c.textAlign='center';
  const width=c.measureText(route.sign).width+20;
  c.fillStyle='#182a2ade';c.fillRect(x-width/2,labelY-14,width,23);
  c.fillStyle=route.color;c.fillRect(x-width/2,labelY+7,width,2);c.fillText(route.sign,x,labelY+2);
 }
 c.restore();
}
export function paintPortGantry(c,gantry){
 const {x,y,color}=gantry;
 c.save();c.translate(x,y);
 c.fillStyle='#182e30';c.fillRect(-32,-34,64,48);
 c.fillStyle='#526f69';c.fillRect(-27,-29,54,6);
 for(const side of [-1,1]){
  c.fillStyle='#536963';c.fillRect(side*22-4,-26,8,39);
  c.fillStyle=color;c.fillRect(side*22-2,-24,4,9);
 }
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
 }else if(art){if(kind==='rescue'){prop(c,art,2,1,n.x,n.y,65);prop(c,art,2,0,n.x+39,n.y+7,32);}else if(kind==='truck')prop(c,art,2,3,n.x,n.y,104);else if(kind==='armory'){environmentProp(c,art,3,3,n.x,n.y,112);prop(c,art,2,0,n.x+9,n.y+5,40);}else if(kind==='relay'||kind==='control'){prop(c,art,3,3,n.x,n.y,kind==='control'?90:70);}else{environmentProp(c,art,1,3,n.x-9,n.y,72);prop(c,art,2,0,n.x+16,n.y+4,48);}}
 else{c.fillStyle='#7d8966';c.fillRect(n.x-25,n.y-30,50,30);}
 if(ready){c.fillStyle='#f4d386';c.fillRect(n.x-4,n.y-76,8,8);c.fillStyle='#273d34';c.fillRect(n.x-1,n.y-75,2,4);}
}
export function paintSiteLabel(c,n,s){
 if(n.state==='done'||Math.hypot(n.x-s.player.x,n.y-s.player.y)>185)return;
 const info=sitePresentation(n),guards=s.enemies.filter(e=>!e.dead&&e.siteId===n.id).length,text=n.state==='ready'?`${info.name} · 회수`:n.kind==='relay'&&n.state==='active'?`해킹 ${Math.round(n.progress/5*100)}%`:n.state==='active'?`${info.name} · 경비 ${guards}`:info.name;
 c.font='10px Galmuri';const width=c.measureText(text).width+16,x=n.x-width/2,y=n.y+14;c.fillStyle='#1c302de6';c.fillRect(x,y,width,20);c.fillStyle=n.state==='ready'?'#ffdb8e':'#e7dfbb';c.textAlign='center';c.fillText(text,n.x,y+14);
}
