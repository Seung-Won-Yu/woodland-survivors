import {paintTerrain,paintBlock,paintSiteGround,paintSite,paintSiteLabel} from './field-art.js';
import {region} from './campaign.js';
import {actor,prop,vehicle} from '../mission/art.js';
import {distance,clamp} from './content.js';
import {partPosition} from './model.js';
const TAU=Math.PI*2;
function circle(c,x,y,r,fill,stroke=null,width=1){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function bar(c,x,y,width,ratio,color){c.fillStyle='#101d26';c.fillRect(x-width/2,y,width,5);c.fillStyle=color;c.fillRect(x-width/2,y,width*clamp(ratio,0,1),5);}
function flame(c,x,y,height,phase){
 const sway=Math.sin(phase)*height*.14;c.fillStyle='#df562cc0';c.beginPath();c.moveTo(x-height*.25,y);c.lineTo(x-height*.3,y-height*.42);c.lineTo(x+sway,y-height);c.lineTo(x+height*.12,y-height*.36);c.lineTo(x+height*.29,y-height*.56);c.lineTo(x+height*.22,y);c.closePath();c.fill();c.fillStyle='#ffcf7edc';c.beginPath();c.moveTo(x-height*.12,y);c.lineTo(x+sway*.5,y-height*.6);c.lineTo(x+height*.13,y);c.fill();
}
export function createRenderer(canvas,art){
 const c=canvas.getContext('2d');let size={w:0,h:0,dpr:1},view={w:960,h:540},terrainCache=null,terrainKey='',siteStates=new Map();
 function resize(){size={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);}
 function draw(s,reduced=false){
  if(size.w!==innerWidth||size.h!==innerHeight)resize();const mobile=size.w<=700;let worldWidth=mobile?520:960;
  if(s.boss.active)worldWidth=Math.max(worldWidth,Math.abs(s.player.x-s.boss.x)*1.2+300);const scale=size.w/worldWidth;view={w:worldWidth,h:size.h/scale};
  const focusX=s.boss.active?s.player.x*.65+s.boss.x*.35:s.player.x,focusY=s.boss.active?s.player.y*.65+s.boss.y*.35:s.player.y;
  const cx=clamp(focusX,view.w/2,Math.max(view.w/2,1600-view.w/2)),cy=clamp(focusY,view.h/2,Math.max(view.h/2,1200-view.h/2));
  c.setTransform(size.dpr,0,0,size.dpr,0,0);c.clearRect(0,0,size.w,size.h);c.fillStyle='#263a44';c.fillRect(0,0,size.w,size.h);c.translate(size.w/2,size.h/2);c.scale(scale,scale);c.translate(-cx,-cy);c.imageSmoothingEnabled=false;
  const shake=!reduced&&s.player.hurt>0?Math.sin(s.t*75)*3:0;c.translate(shake,0);
  const index=s.operation?.region||0,key=`${index}:${s.seed}`;
  if(canvas.ownerDocument&&key!==terrainKey){terrainKey=key;siteStates.clear();terrainCache=canvas.ownerDocument.createElement('canvas');terrainCache.width=1600;terrainCache.height=1200;const tc=terrainCache.getContext('2d');tc.imageSmoothingEnabled=false;paintTerrain(tc,index,s.seed,art);}
  if(terrainCache)c.drawImage(terrainCache,0,0);else paintTerrain(c,index,s.seed,art);
  for(const n of s.sites){const previous=siteStates.get(n.id);siteStates.set(n.id,{state:n.state,collected:previous&&previous.state!=='done'&&n.state==='done'?s.t:previous?.collected});}
  for(const n of s.sites)paintSiteGround(c,n,distance(n,s.player)<185,n.state==='active');
  for(const n of s.sites)if(n.kind==='relay'&&n.state==='active'){circle(c,n.x,n.y,125,'#83c5a40b','#c7dfb566',1);c.strokeStyle='#e8d49a';c.lineWidth=2;c.beginPath();c.arc(n.x,n.y,125,-Math.PI/2,-Math.PI/2+n.progress/5*TAU);c.stroke();}
  for(const z of s.zones){circle(c,z.x,z.y,z.r,'#552f282d','#cb753769',1);circle(c,z.x,z.y,z.r*.75,'#e7a05a30');for(let i=0;i<5;i++){const a=i*2.4+z.x,r=z.r*(.25+(i%3)*.22);flame(c,z.x+Math.cos(a)*r,z.y+Math.sin(a)*r,14+(reduced?0:Math.sin(s.t*12+i)*4),s.t*9+i);}}
  for(const g of s.gems){c.save();c.translate(g.x,g.y);c.rotate(Math.PI/4);c.fillStyle=g.value>=8?'#ffdc8c':'#b5e0d1';c.fillRect(-3,-3,6,6);c.restore();}
  if(s.stage==='field'){c.fillStyle='#293c34';c.fillRect(718,326,42,16);c.fillRect(840,326,42,16);c.fillStyle='#d8b471';for(let i=0;i<3;i++){c.fillRect(720+i*13,326,6,16);c.fillRect(842+i*13,326,6,16);}if(distance(s.player,{x:800,y:350})<190){c.fillStyle='#1c302de8';c.fillRect(727,363,146,24);c.fillStyle='#efcf90';c.font='11px Galmuri';c.textAlign='center';c.fillText('F · 보스전 진입',800,379);}}
  if(s.stage==='holdout'){if(art)prop(c,art,2,3,800,420,112);for(let i=0;i<3;i++){c.fillStyle='#d2d9ac';c.beginPath();c.moveTo(790,450+i*17);c.lineTo(800,442+i*17);c.lineTo(810,450+i*17);c.lineTo(800,447+i*17);c.fill();}if(distance(s.player,{x:800,y:420})<200){c.fillStyle='#1c302de8';c.fillRect(710,487,180,24);c.fillStyle='#d9e7b2';c.font='11px Galmuri';c.textAlign='center';c.fillText(s.operation&&s.operation.region<2?'F · 다음 전선 / 잔류':'F · 귀환 / 잔류',800,503);}}
  const entities=[...s.sites.map(e=>({y:e.y,kind:'site',e})),...s.blocks.map(e=>({y:e.y+e.h,kind:'block',e})),...s.enemies.map(e=>({y:e.y,kind:'enemy',e})),{y:s.player.y,kind:'player',e:s.player}];
  if(s.raid?.state==='active')entities.push({y:s.raid.target.y,kind:'courier',e:s.raid.target});if(s.boss.active||s.boss.dead||s.stage==='field')entities.push({y:s.boss.y,kind:'boss',e:s.boss});
  for(const item of entities.sort((a,b)=>a.y-b.y)){
   const e=item.e;if(Math.abs(e.x-cx)>view.w/2+220||Math.abs(e.y-cy)>view.h/2+220)continue;c.save();
   if(item.kind==='site'){paintSite(c,e,s,art,s.t-(siteStates.get(e.id)?.collected??-99));c.restore();continue;}
   if(item.kind==='block'){paintBlock(c,e,index,art);if(e.hp>0&&e.hp<e.maxHp)bar(c,e.x+e.w/2,e.y-34,e.w,e.hp/e.maxHp,'#dfbc78');c.restore();continue;}
   if(item.kind==='enemy'){
    if(e.dead){const fall=1-e.death/.3;c.globalAlpha=Math.max(0,e.death/.3)*.7;c.translate(e.x,e.y);c.rotate(fall*.4*(e.x>s.player.x?1:-1));c.scale(1,1-fall*.45);c.translate(-e.x,-e.y);}else c.globalAlpha=Math.min(1,e.spawnAge*3);circle(c,e.x,e.y,14,'#263b3338');
    if(e.hurt>0)c.filter='brightness(1.7)';if(art)actor(c,art.enemies,({rifle:0,shield:1,mortar:2,officer:3})[e.type],Math.floor(e.walk)%4,e.x,e.y,e.type==='officer'?62:e.type==='shield'?55:49,Math.cos(e.aim)<0);else{c.fillStyle=e.type==='officer'?'#ba6d53':'#48533c';c.fillRect(e.x-12,e.y-34,24,34);}c.filter='none';
    if(e.burn>0&&!e.dead){circle(c,e.x,e.y-18,15,'#ff994925');flame(c,e.x-7,e.y-18,18,s.t*13+e.x);flame(c,e.x+6,e.y-22,13,s.t*12+e.y);}if(e.type==='officer'&&!e.dead)bar(c,e.x,e.y-68,45,e.hp/e.maxHp,'#f2b780');
   }else if(item.kind==='player'){
    circle(c,e.x,e.y,19,'#283d3549',e.overdrive>0?'#ffdb82':'#c3e3cd',1);if(e.hurt>0)c.filter='brightness(1.8)';const bx=e.attack>0?-Math.cos(e.aim)*2:0;
    if(art)actor(c,art.operators,2+(Math.sin(e.aim)<-.6?1:0),e.moving?Math.floor(e.walk)%4:0,e.x+bx,e.y,64,Math.cos(e.aim)<0);else{c.fillStyle='#edb063';c.fillRect(e.x-13,e.y-44,26,44);}c.filter='none';
    if(e.overdrive>0){c.strokeStyle='#ffce72aa';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-24,35,s.t*3,s.t*3+4.6);c.stroke();}
   }else if(item.kind==='courier'){
    if(art){c.save();c.translate(e.x,e.y);c.rotate(e.aim);prop(c,art,2,3,0,15,125);c.restore();}else{c.fillStyle='#81927c';c.fillRect(e.x-40,e.y-25,80,45);}bar(c,e.x,e.y-78,120,e.hp/e.maxHp,'#ddadff');
   }else{
    if(s.operation?.region===1){c.fillStyle='#28393c';c.fillRect(e.x-130,e.y-35,260,65);c.fillStyle='#85958b';c.fillRect(e.x-125,e.y-55,250,48);c.fillStyle='#c0b891';for(let i=-2;i<=2;i++){c.fillRect(e.x+i*45-16,e.y-48,32,25);circle(c,e.x+i*45,e.y+31,12,'#26363c','#8f9b91',3);}for(const part of e.parts){const p=partPosition(s,part);c.save();c.translate(p.x,p.y-20);c.rotate(e.aim);c.fillStyle=part.hp>0?'#b6bd99':'#4c5650';c.fillRect(-15,-12,40,24);c.fillRect(10,-5,55,10);c.restore();}}else if(art)vehicle(c,art,{x:e.x,y:e.y,width:s.operation?.region===2?225:185,enemy:true,body:e.body,turret:e.aim,kick:e.kick,tread:s.t*80,moving:e.mode==='charge',flash:e.flash,damaged:e.hp<e.maxHp*.5,wreck:e.dead,reduced});else{c.save();c.translate(e.x,e.y);c.rotate(e.body);c.fillStyle=e.dead?'#384747':'#667263';c.fillRect(-70,-45,140,90);c.restore();}if(e.active&&!e.dead)for(const part of e.parts){if(part.hp<=0)continue;const p=partPosition(s,part);circle(c,p.x,p.y,17,'#ffc96024','#ffdc8c',2);bar(c,p.x,p.y-25,35,part.hp/part.maxHp,'#ffcd7e');}
   }if(item.kind!=='enemy'&&item.kind!=='player'&&e.burn>0&&!e.dead){for(let i=-1;i<=1;i++)flame(c,e.x+i*28,e.y-18,24,s.t*11+i);}
   c.restore();
  }
  for(const n of s.sites)paintSiteLabel(c,n,s);
  if(s.boss.active&&s.boss.mode==='windup'){const b=s.boss;c.save();c.translate(b.x,b.y);c.rotate(b.body);c.fillStyle='#d9633b35';c.strokeStyle='#ffd588';c.lineWidth=2;c.fillRect(20,-55,300,110);c.strokeRect(20,-55,300,110);c.restore();}
  for(const h of s.hazards){if(h.hit)continue;if(h.lane){c.fillStyle='#d9813828';c.fillRect(h.x-h.w/2,h.y-h.h/2,h.w,h.h);c.strokeStyle='#ffd087';c.lineWidth=3;c.strokeRect(h.x-h.w/2,h.y-h.h/2,h.w,h.h);c.fillStyle='#f8d79b';c.font='bold 13px Galmuri';c.textAlign='center';c.fillText('포격 예고',h.x,s.player.y-50);continue;}circle(c,h.x,h.y,h.r,'#d77b331e','#f6c78b',2);circle(c,h.x,h.y,h.r*clamp(1-h.timer/(h.duration||.9),0,1),null,'#f4d28d',1);}
  for(const q of s.enemyShots)circle(c,q.x,q.y-18,6,'#b0422c','#ffe1a1',2);
  for(const q of s.shots){const a=Math.atan2(q.vy,q.vx),payload=q.source==='payload';c.save();c.translate(q.x,q.y-18);c.rotate(a);c.fillStyle=payload?'#8df3eb':q.rocket?'#f69145':'#ffdd87';c.shadowColor=payload?'#8df3eb':q.rocket?'#ff984a':'#ffdf9e';c.shadowBlur=reduced?0:7;c.fillRect(-q.r*2,-q.r*.7,q.r*3,q.r*1.4);c.fillStyle='#fff3c8';c.fillRect(0,-1,q.r+3,2);c.restore();}
  for(const f of s.effects){const t=f.age/f.life;c.save();c.globalAlpha=1-t;
   if(f.type==='barrage'){c.fillStyle=reduced?'#df985325':'#ffd39345';c.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);for(let y=f.y-f.h/2;y<f.y+f.h/2;y+=80)circle(c,f.x,y,20+t*30,'#f3ae6944','#ffcc87',2);}
   else if(f.type==='explosion'||f.type==='break'||f.type==='shrapnel'){const r=(f.r||80)*(.35+t*.7);circle(c,f.x,f.y,r,'#ec963b30','#ffd384',2);circle(c,f.x,f.y,r*.45,'#ffe0a178');for(let i=0;i<7;i++){const a=i*TAU/7;c.fillStyle='#efbd76';c.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,4,4);}}
   else if(f.type==='heat'){const r=(f.r||100)*(.25+t*.85);circle(c,f.x,f.y,r,null,'#ffc48a',reduced?2:5*(1-t)+1);if(!reduced)circle(c,f.x,f.y,r*.55,'#fff1c2'+(t<.15?'bb':'25'));for(let i=0;i<8;i++){const a=i*TAU/8;flame(c,f.x+Math.cos(a)*r*.65,f.y+Math.sin(a)*r*.5,16*(1-t)+4,i+t*8);}c.textAlign='center';c.font='bold 12px Galmuri';c.fillStyle='#ffe1aa';c.fillText('열압',f.x,f.y-r*.55-10);}
   else if(f.type==='raid-success'){const color=({common:'#ffe0a1',rare:'#90e0da',prototype:'#dcafff'})[f.quality];circle(c,f.x,f.y,25+t*110,null,color,4);for(let i=0;i<10;i++){const a=i*TAU/10;c.fillStyle=color;c.fillRect(f.x+Math.cos(a)*t*120,f.y+Math.sin(a)*t*75-20,4,8);}}
   else if(f.type==='payload'){circle(c,f.x,f.y,12+t*48,null,'#9bf2e8',3);circle(c,f.x,f.y,6+t*20,'#b7f4e44');}
   else if(f.type==='lightning'||f.type==='ricochet'||f.type==='fire-spread'){c.strokeStyle=f.type==='fire-spread'?'#ff965e':f.type==='lightning'?'#a1f5ef':'#f8dc8f';c.lineWidth=f.type==='lightning'?3:1.5;c.beginPath();c.moveTo(f.x,f.y);c.lineTo((f.x+f.x2)/2+Math.sin(s.t*40)*10,(f.y+f.y2)/2);c.lineTo(f.x2,f.y2);c.stroke();}
   else if(f.type==='flame'){
    c.translate(f.x,f.y-18);c.rotate(f.angle);const half=f.cone*Math.PI/360,gradient=c.createRadialGradient(0,0,6,0,0,f.r);gradient.addColorStop(0,'#fff0c5d0');gradient.addColorStop(.35,'#ffbc6690');gradient.addColorStop(1,'#ed553000');c.fillStyle=gradient;c.beginPath();c.moveTo(0,0);c.arc(0,0,f.r,-half,half);c.closePath();c.fill();
    for(let i=0;i<15;i++){const at=.12+(i%5)*.17,a=Math.sin(i*8.4+f.age*10)*half*.8,x=Math.cos(a)*f.r*at,y=Math.sin(a)*f.r*at,r=7+at*21;c.save();c.translate(x,y);c.rotate(Math.PI/2+a);flame(c,0,r*.35,r*1.7,i+f.age*14);c.restore();}

   }
   else if(f.type==='shot'||f.type==='rocket-shot'){c.translate(f.x,f.y);c.rotate(f.angle);c.fillStyle='#ffedb0';c.beginPath();c.moveTo(0,-6);c.lineTo(24,0);c.lineTo(0,6);c.closePath();c.fill();}
   else if(f.type==='impact'||f.type==='kill'){c.strokeStyle=f.type==='kill'?'#f9dcb4':'#fff1be';c.lineWidth=2;for(let i=0;i<4;i++){const a=i*TAU/4+f.age*4,r=5+t*16;c.beginPath();c.moveTo(f.x+Math.cos(a)*r,f.y-18+Math.sin(a)*r);c.lineTo(f.x+Math.cos(a)*(r+7),f.y-18+Math.sin(a)*(r+7));c.stroke();}}
   c.restore();
  }
  c.setTransform(size.dpr,0,0,size.dpr,0,0);const vignette=c.createRadialGradient(size.w/2,size.h/2,size.h*.2,size.w/2,size.h/2,size.w*.75);vignette.addColorStop(0,'#12232c00');vignette.addColorStop(1,'#12232c65');c.fillStyle=vignette;c.fillRect(0,0,size.w,size.h);
 }
 return{draw,view:()=>view,resize};
}
