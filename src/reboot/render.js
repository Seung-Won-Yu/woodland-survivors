import {actor,environmentProp,prop,vehicle} from '../mission/art.js';
import {FIELD,distance,clamp} from './content.js';
import {partPosition} from './model.js';
const TAU=Math.PI*2;
function circle(c,x,y,r,fill,stroke=null,width=1){c.beginPath();c.arc(x,y,r,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function bar(c,x,y,width,ratio,color){c.fillStyle='#101d26';c.fillRect(x-width/2,y,width,5);c.fillStyle=color;c.fillRect(x-width/2,y,width*clamp(ratio,0,1),5);}
export function createRenderer(canvas,art){
 const c=canvas.getContext('2d');let size={w:0,h:0,dpr:1},view={w:960,h:540};
 function resize(){size={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);}
 function draw(s,reduced=false){
  if(size.w!==innerWidth||size.h!==innerHeight)resize();const mobile=size.w<=700;let worldWidth=mobile?520:960;
  if(s.boss.active)worldWidth=Math.max(worldWidth,Math.abs(s.player.x-s.boss.x)*1.2+300);const scale=size.w/worldWidth;view={w:worldWidth,h:size.h/scale};
  const focusX=s.boss.active?s.player.x*.65+s.boss.x*.35:s.player.x,focusY=s.boss.active?s.player.y*.65+s.boss.y*.35:s.player.y;
  const cx=clamp(focusX,view.w/2,Math.max(view.w/2,1600-view.w/2)),cy=clamp(focusY,view.h/2,Math.max(view.h/2,1200-view.h/2));
  c.setTransform(size.dpr,0,0,size.dpr,0,0);c.clearRect(0,0,size.w,size.h);c.fillStyle='#263a44';c.fillRect(0,0,size.w,size.h);c.translate(size.w/2,size.h/2);c.scale(scale,scale);c.translate(-cx,-cy);c.imageSmoothingEnabled=false;
  const shake=!reduced&&s.player.hurt>0?Math.sin(s.t*75)*3:0;c.translate(shake,0);
  c.fillStyle='#a49874';c.fillRect(0,0,1600,1200);c.fillStyle='#786f58';c.fillRect(0,0,100,1200);c.fillStyle='#415d69';c.fillRect(0,0,65,1200);
  for(let x=100;x<1600;x+=64)for(let y=0;y<1200;y+=64){const value=Math.sin(x*3+y*.7+s.seed)*.5+.5;c.fillStyle=value>.6?'#c0ae8829':'#574d3b16';c.fillRect(x,y,62,62);c.fillStyle='#d6c7a744';c.fillRect(x+value*40,y+17,4,2);}
  c.fillStyle='#4f504646';c.beginPath();c.moveTo(700,1200);c.lineTo(1020,1200);c.lineTo(940,600);c.lineTo(1040,0);c.lineTo(780,0);c.lineTo(740,600);c.closePath();c.fill();
  c.setLineDash([18,18]);c.strokeStyle='#dfcc8d55';c.lineWidth=3;c.beginPath();c.moveTo(860,1200);c.lineTo(830,620);c.lineTo(910,0);c.stroke();c.setLineDash([]);
  c.strokeStyle='#decd9a66';c.lineWidth=3;c.strokeRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);
  if(art)for(const d of s.decorations){if(distance(d,{x:cx,y:cy})>Math.hypot(view.w,view.h)*.6)continue;environmentProp(c,art,d.row,d.col,d.x,d.y,80,.5);}
  for(const b of s.blocks){if(b.hp===0){c.fillStyle='#4f483844';c.fillRect(b.x,b.y,b.w,b.h);continue;}c.fillStyle=b.hp<0?'#48565a':'#7b755d';c.fillRect(b.x,b.y-30,b.w,b.h+30);c.fillStyle=b.hp<0?'#637277':'#a59d78';c.fillRect(b.x,b.y-30,b.w,30);c.strokeStyle='#3e433e';c.lineWidth=3;c.strokeRect(b.x,b.y-30,b.w,b.h+30);for(let x=b.x+12;x<b.x+b.w;x+=26){c.strokeStyle='#d9c39944';c.strokeRect(x,b.y-15,21,18);}if(b.hp>0&&b.hp<b.maxHp)bar(c,b.x+b.w/2,b.y-40,b.w,b.hp/b.maxHp,'#d8c483');}
  for(const z of s.zones){circle(c,z.x,z.y,z.r,'#ed75332d');circle(c,z.x,z.y,z.r*.75,'#e7a05a45');}
  for(const g of s.gems){c.save();c.translate(g.x,g.y);c.rotate(Math.PI/4);c.fillStyle=g.value>=8?'#ffdc8c':'#b5e0d1';c.fillRect(-3,-3,6,6);c.restore();}
  for(const n of s.sites){if(n.state==='done')continue;const color=n.kind==='armory'?'#d2b0ff':'#f0d394';circle(c,n.x,n.y,48,`${color}18`,color,2);if(art)prop(c,art,2,n.kind==='armory'?0:1,n.x,n.y,76);else{c.fillStyle=color;c.fillRect(n.x-20,n.y-28,40,28);}c.textAlign='center';c.font='11px Galmuri,monospace';c.lineWidth=4;c.strokeStyle='#243331';c.strokeText(n.name,n.x,n.y+28);c.fillStyle=color;c.fillText(n.name,n.x,n.y+28);if(n.state==='active'){c.font='10px Galmuri';c.fillText(`경비 ${s.enemies.filter(e=>!e.dead&&e.siteId===n.id).length}`,n.x,n.y+44);}if(n.state==='ready'){c.fillText('접근 · 보급 선택',n.x,n.y+44);}}
  if(s.stage==='field'){circle(c,800,350,58,'#e6aa6822','#efc58c',2);c.fillStyle='#f2d29c';c.font='12px Galmuri';c.textAlign='center';c.fillText('BOSS / 언제든 도전',800,350);}
  if(s.stage==='holdout'){circle(c,800,420,75,'#81d8bf22','#b0ebcb',3);c.fillStyle='#def5c9';c.font='bold 14px Galmuri';c.textAlign='center';c.fillText('EVAC / 귀환',800,430);}
  const entities=[...s.enemies.map(e=>({y:e.y,kind:'enemy',e})),{y:s.player.y,kind:'player',e:s.player}];
  if(s.raid?.state==='active')entities.push({y:s.raid.target.y,kind:'courier',e:s.raid.target});if(s.boss.active||s.boss.dead)entities.push({y:s.boss.y,kind:'boss',e:s.boss});
  for(const item of entities.sort((a,b)=>a.y-b.y)){
   const e=item.e;if(Math.abs(e.x-cx)>view.w/2+220||Math.abs(e.y-cy)>view.h/2+220)continue;c.save();
   if(item.kind==='enemy'){
    if(e.dead)c.globalAlpha=Math.max(0,e.death/.3)*.6;else c.globalAlpha=Math.min(1,e.spawnAge*3);circle(c,e.x,e.y,14,'#263b3338');
    if(e.hurt>0)c.filter='brightness(1.7)';if(art)actor(c,art.enemies,({rifle:0,shield:1,mortar:2,officer:3})[e.type],Math.floor(e.walk)%4,e.x,e.y,e.type==='officer'?62:e.type==='shield'?55:49,Math.cos(e.aim)<0);else{c.fillStyle=e.type==='officer'?'#ba6d53':'#48533c';c.fillRect(e.x-12,e.y-34,24,34);}c.filter='none';
    if(e.burn>0&&!e.dead){circle(c,e.x,e.y-20,8,'#ff994944');c.fillStyle='#ffba6d';c.fillRect(e.x-3,e.y-37,6,11);}if(e.type==='officer'&&!e.dead)bar(c,e.x,e.y-68,45,e.hp/e.maxHp,'#f2b780');
   }else if(item.kind==='player'){
    circle(c,e.x,e.y,19,'#283d3549',e.overdrive>0?'#ffdb82':'#c3e3cd',1);if(e.hurt>0)c.filter='brightness(1.8)';const bx=e.attack>0?-Math.cos(e.aim)*2:0;
    if(art)actor(c,art.operators,2+(Math.sin(e.aim)<-.6?1:0),e.moving?Math.floor(e.walk)%4:0,e.x+bx,e.y,64,Math.cos(e.aim)<0);else{c.fillStyle='#edb063';c.fillRect(e.x-13,e.y-44,26,44);}c.filter='none';
    if(e.overdrive>0){c.strokeStyle='#ffce72aa';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-24,35,s.t*3,s.t*3+4.6);c.stroke();}
   }else if(item.kind==='courier'){
    if(art){c.save();c.translate(e.x,e.y);c.rotate(e.aim);prop(c,art,2,3,0,15,125);c.restore();}else{c.fillStyle='#81927c';c.fillRect(e.x-40,e.y-25,80,45);}bar(c,e.x,e.y-78,120,e.hp/e.maxHp,'#ddadff');
   }else{
    if(art)vehicle(c,art,{x:e.x,y:e.y,width:185,enemy:true,body:e.body,turret:e.aim,kick:e.kick,tread:s.t*80,moving:e.mode==='charge',flash:e.flash,damaged:e.hp<e.maxHp*.5,wreck:e.dead,reduced});else{c.save();c.translate(e.x,e.y);c.rotate(e.body);c.fillStyle=e.dead?'#384747':'#667263';c.fillRect(-70,-45,140,90);c.restore();}if(!e.dead)for(const part of e.parts){if(part.hp<=0)continue;const p=partPosition(s,part);circle(c,p.x,p.y,17,'#ffc96024','#ffdc8c',2);bar(c,p.x,p.y-25,35,part.hp/part.maxHp,'#ffcd7e');}
   }c.restore();
  }
  if(s.boss.active&&s.boss.mode==='windup'){const b=s.boss;c.save();c.translate(b.x,b.y);c.rotate(b.body);c.fillStyle='#d9633b35';c.strokeStyle='#ffd588';c.lineWidth=2;c.fillRect(20,-55,300,110);c.strokeRect(20,-55,300,110);c.restore();}
  for(const h of s.hazards){if(h.hit)continue;circle(c,h.x,h.y,h.r,'#d77b331e','#f6c78b',2);circle(c,h.x,h.y,h.r*(1-h.timer/.9),null,'#f4d28d',1);}
  for(const q of s.enemyShots)circle(c,q.x,q.y,6,'#b0422c','#ffe1a1',2);
  for(const q of s.shots){const a=Math.atan2(q.vy,q.vx);c.save();c.translate(q.x,q.y);c.rotate(a);c.fillStyle=q.rocket?'#f69145':'#ffdd87';c.shadowColor=q.rocket?'#ff984a':'#ffdf9e';c.shadowBlur=reduced?0:7;c.fillRect(-q.r*2,-q.r*.7,q.r*3,q.r*1.4);c.fillStyle='#fff3c8';c.fillRect(0,-1,q.r+3,2);c.restore();}
  for(const f of s.effects){const t=f.age/f.life;c.save();c.globalAlpha=1-t;
   if(f.type==='explosion'||f.type==='break'){const r=(f.r||80)*(.35+t*.7);circle(c,f.x,f.y,r,'#ec963b30','#ffd384',2);circle(c,f.x,f.y,r*.45,'#ffe0a178');for(let i=0;i<7;i++){const a=i*TAU/7;c.fillStyle='#efbd76';c.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,4,4);}}
   else if(f.type==='lightning'||f.type==='ricochet'){c.strokeStyle=f.type==='lightning'?'#a1f5ef':'#f8dc8f';c.lineWidth=f.type==='lightning'?3:1.5;c.beginPath();c.moveTo(f.x,f.y);c.lineTo((f.x+f.x2)/2+Math.sin(s.t*40)*10,(f.y+f.y2)/2);c.lineTo(f.x2,f.y2);c.stroke();}
   else if(f.type==='flame'){c.translate(f.x,f.y-18);c.rotate(f.angle);const gradient=c.createRadialGradient(0,0,10,0,0,f.r);gradient.addColorStop(0,'#ffec9ac0');gradient.addColorStop(.35,'#ffae5390');gradient.addColorStop(1,'#f0503000');c.fillStyle=gradient;c.beginPath();c.moveTo(0,0);c.arc(0,0,f.r,-f.cone*Math.PI/360,f.cone*Math.PI/360);c.closePath();c.fill();}
   else if(f.type==='shot'){c.translate(f.x,f.y);c.rotate(f.angle);c.fillStyle='#ffedb0';c.beginPath();c.moveTo(0,-6);c.lineTo(24,0);c.lineTo(0,6);c.closePath();c.fill();}
   else if(f.type==='impact'||f.type==='kill'){c.strokeStyle=f.type==='kill'?'#f9dcb4':'#fff1be';c.lineWidth=2;for(let i=0;i<4;i++){const a=i*TAU/4+f.age*4,r=5+t*16;c.beginPath();c.moveTo(f.x+Math.cos(a)*r,f.y-18+Math.sin(a)*r);c.lineTo(f.x+Math.cos(a)*(r+7),f.y-18+Math.sin(a)*(r+7));c.stroke();}}
   c.restore();
  }
  c.setTransform(size.dpr,0,0,size.dpr,0,0);const vignette=c.createRadialGradient(size.w/2,size.h/2,size.h*.2,size.w/2,size.h/2,size.w*.75);vignette.addColorStop(0,'#12232c00');vignette.addColorStop(1,'#12232c65');c.fillStyle=vignette;c.fillRect(0,0,size.w,size.h);
 }
 return{draw,view:()=>view,resize};
}
