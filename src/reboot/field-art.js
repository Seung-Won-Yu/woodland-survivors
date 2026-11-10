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
export function paintTerrain(c,index,seed,art){
 const scene=fieldScene(index,seed);c.fillStyle=scene.ground;c.fillRect(0,0,1600,1200);
 for(const s of scene.shapes){c.beginPath();if(s.type==='rect'){c.fillStyle=s.fill;c.fillRect(s.x,s.y,s.w,s.h);continue;}s.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(s.fill){c.closePath();c.fillStyle=s.fill;c.fill();}if(s.stroke){c.strokeStyle=s.stroke;c.lineWidth=s.width;c.setLineDash(s.dash||[]);c.stroke();c.setLineDash([]);}}
 // Sparse wear breaks large flat surfaces without drawing a tile grid.
 for(let i=0;i<2600;i++){const x=(i*137+(seed%211))%1600,y=(i*263+(seed%137))%1200;if(x<80||x>1560)continue;c.fillStyle=scene.grain[i%2]+(i%3?'28':'38');c.fillRect(x,y,i%5+2,i%3+1);}
 if(index===0){for(let y=0;y<1200;y+=23){const center=y>650?850+(y-650)*.025:915-y*.1;for(const dx of [-65,65]){c.fillStyle='#353e3027';c.fillRect(center+dx,y,6,13);c.fillStyle='#a99b7427';c.fillRect(center+dx+7,y,3,13);}}}
 for(let i=0;i<55;i++){const x=130+(i*271+seed%97)%1320,y=75+(i*173+seed%113)%1050;c.fillStyle='#2f3d3025';c.fillRect(x,y,7+i%7,3);c.fillStyle='#c4b48d33';c.fillRect(x+2,y-2,5,2);}
 if(index===2){c.strokeStyle='#c6d0bd24';c.lineWidth=2;for(let x=160;x<1480;x+=160){c.beginPath();c.moveTo(x,0);c.lineTo(x,1200);c.stroke();}for(let y=0;y<1200;y+=160){c.beginPath();c.moveTo(115,y);c.lineTo(1485,y);c.stroke();}for(const x of [73,1524])for(let y=80;y<1200;y+=160){c.fillStyle='#172c2d';c.fillRect(x-7,y,14,9);c.fillStyle='#bcc4a5';c.fillRect(x-7,y,14,3);}}
 for(const points of scene.rails||[]){c.strokeStyle='#333b34';c.lineWidth=50;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j],length=Math.hypot(bx-ax,by-ay),angle=Math.atan2(by-ay,bx-ax);for(let d=0;d<length;d+=24){c.save();c.translate(ax+Math.cos(angle)*d,ay+Math.sin(angle)*d);c.rotate(angle);c.fillStyle='#84795e';c.fillRect(-3,-33,6,66);c.fillStyle='#ad9b76';c.fillRect(-3,-33,2,66);c.restore();}}for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j],length=Math.hypot(bx-ax,by-ay);for(const offset of [-16,16]){const dx=-(by-ay)/length*offset,dy=(bx-ax)/length*offset;c.strokeStyle='#a7ada1';c.lineWidth=4;c.beginPath();c.moveTo(ax+dx,ay+dy);c.lineTo(bx+dx,by+dy);c.stroke();}}}
 if(art)for(const [r,col,x,y,w]of scene.landmarks)environmentProp(c,art,r,col,x,y,w,.9);
}
export function paintBlock(c,b,index,art){
 if(b.hp===0){c.fillStyle='#343b3444';c.fillRect(b.x,b.y,b.w,b.h);if(art)environmentProp(c,art,3,0,b.x+b.w/2,b.y+b.h,b.w,.55);return;}
 c.fillStyle='#182a2b33';c.beginPath();c.ellipse(b.x+b.w/2+5,b.y+b.h-3,b.w*.53,Math.min(b.h*.35,26),0,0,Math.PI*2);c.fill();
 if(art&&index===0){if(b.hp>0)prop(c,art,3,2,b.x+b.w/2,b.y+b.h,b.w);else environmentProp(c,art,0,2,b.x+b.w/2,b.y+b.h,b.w);return;}
 if(art&&index===2){environmentProp(c,art,1,b.x%3?0:1,b.x+b.w/2,b.y+b.h,b.w);return;}
 if(art&&b.w>b.h){environmentProp(c,art,1,2,b.x+b.w/2,b.y+b.h,b.w);return;}
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
  const [x,y]=route.path[1],labelY=y-43;
  c.font='bold 12px Galmuri';c.textAlign='center';
  const width=c.measureText(route.sign).width+20;
  c.fillStyle='#182a2ade';c.fillRect(x-width/2,labelY-14,width,23);
  c.fillStyle=route.color;c.fillRect(x-width/2,labelY+7,width,2);c.fillText(route.sign,x,labelY+2);
 }
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
 if(art){if(kind==='rescue'){prop(c,art,2,1,n.x,n.y,65);prop(c,art,2,0,n.x+39,n.y+7,32);}else if(kind==='truck')prop(c,art,2,3,n.x,n.y,104);else if(kind==='armory'){environmentProp(c,art,3,3,n.x,n.y,112);prop(c,art,2,0,n.x+9,n.y+5,40);}else if(kind==='relay'||kind==='control'){prop(c,art,3,3,n.x,n.y,kind==='control'?90:70);}else{environmentProp(c,art,1,3,n.x-9,n.y,72);prop(c,art,2,0,n.x+16,n.y+4,48);}}
 else{c.fillStyle='#7d8966';c.fillRect(n.x-25,n.y-30,50,30);}
 if(ready){c.fillStyle='#f4d386';c.fillRect(n.x-4,n.y-76,8,8);c.fillStyle='#273d34';c.fillRect(n.x-1,n.y-75,2,4);}
}
export function paintSiteLabel(c,n,s){
 if(n.state==='done'||Math.hypot(n.x-s.player.x,n.y-s.player.y)>185)return;
 const info=sitePresentation(n),guards=s.enemies.filter(e=>!e.dead&&e.siteId===n.id).length,text=n.state==='ready'?`${info.name} · 회수`:n.kind==='relay'&&n.state==='active'?`해킹 ${Math.round(n.progress/5*100)}%`:n.state==='active'?`${info.name} · 경비 ${guards}`:info.name;
 c.font='10px Galmuri';const width=c.measureText(text).width+16,x=n.x-width/2,y=n.y+14;c.fillStyle='#1c302de6';c.fillRect(x,y,width,20);c.fillStyle=n.state==='ready'?'#ffdb8e':'#e7dfbb';c.textAlign='center';c.fillText(text,n.x,y+14);
}
