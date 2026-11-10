import {paintTerrain,paintTerrainMargins,paintBlock,paintSiteGround,paintSite,paintSiteLabel,paintGate,paintGateApproach,paintWreckGround,paintWreckSmoke,paintFrontEntry,paintEntryRoutes} from './field-art.js';
import {exitGate,portBreachFlank,portCoreWindow,portTurretShutter,portTurretSide,coastLead,coastLeadColor,activeEntry} from './campaign.js';
import {actor,prop,vehicle} from '../mission/art.js';
import {distance,clamp} from './content.js';
import {activeManeuver,partPosition,pickupReach} from './model.js';
import {DEFENSE_ZONE,SIGNAL_ROUTE,signalCourier} from './campaign.js';
const TAU=Math.PI*2;
function circle(c,x,y,r,fill,stroke=null,width=1){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function bar(c,x,y,width,ratio,color){c.fillStyle='#101d26';c.fillRect(x-width/2,y,width,5);c.fillStyle=color;c.fillRect(x-width/2,y,width*clamp(ratio,0,1),5);}
function paintCoastCue(c,site,size,cx,cy,scale){
 const prefix=site.coastApproach?.toUpperCase();
 const name=site.opening?'포로 구출':site.name;
 const label=site.state==='ready'?(site.opening?'접근해 구출':'접근해 회수'):prefix?`${prefix} · ${name}`:name;
 const targetX=size.w/2+(site.x-cx)*scale;
 const targetY=size.h/2+(site.y-cy)*scale;
 const mobile=size.w<=700;
 const color=coastLeadColor(site);
 c.save();
 c.font='bold 11px Galmuri, sans-serif';
 const width=Math.ceil(c.measureText(label).width)+32;
 const x=Math.round(clamp(targetX,width/2+12,size.w-width/2-12));
 const left=x-width/2<165;
 const top=mobile?(left?Math.min(300,size.h*.45):124):112;
 const bottom=mobile?Math.max(top+18,size.h-(left?324:155)):Math.max(top+18,size.h-112);
 const y=Math.round(clamp(targetY-64*scale,top,bottom));
 c.fillStyle='#152a28f2';
 c.fillRect(x-width/2,y-13,width,26);
 c.strokeStyle=color;
 c.lineWidth=1;
 c.strokeRect(x-width/2+.5,y-12.5,width-1,25);
 c.fillStyle=color;
 c.textAlign='left';
 c.textBaseline='middle';
 c.fillText(label,x-width/2+23,y+1);
 c.translate(x-width/2+12,y);
 c.rotate(Math.atan2(targetY-y,targetX-x));
 c.beginPath();
 c.moveTo(5,0);c.lineTo(-4,-4);c.lineTo(-2,0);c.lineTo(-4,4);c.closePath();c.fill();
 c.restore();
}
function paintPortCue(c,s){
 const b=s.boss;
 if(s.operation?.region!==2||!b.active||b.dead)return;
 c.save();
 const turret=b.parts[0],flank=portBreachFlank(s);
 if(portTurretShutter(s)&&!flank){
  const p=partPosition(s,turret);
  circle(c,p.x,p.y,27,'#b580453d','#edb272',3);
 }
 if(s.operation.support==='breach'&&turret?.hp>0){
  const side=portTurretSide(b),x=b.x+side*142,y=b.y+58;
  c.strokeStyle=flank?'#c8f4ff':'#a9d6e9b0';c.lineWidth=3;
  c.beginPath();c.moveTo(x+side*12,y-12);c.lineTo(x,y);c.lineTo(x+side*12,y+12);c.stroke();
  if(flank){
   const p=partPosition(s,turret);
   circle(c,p.x,p.y,25,null,'#c8f4ff',3);c.fillStyle='#c8f4ff';c.fillRect(p.x-2,p.y-30,4,10);
  }
 }else if(portCoreWindow(s)){
  circle(c,b.x,b.y-21,22,'#432820aa','#ffd0a1',3);
  c.fillStyle='#ffe6bb';c.beginPath();c.moveTo(b.x-9,b.y-22);c.lineTo(b.x+9,b.y-22);c.lineTo(b.x,b.y-33);c.closePath();c.fill();c.fillRect(b.x-3,b.y-22,6,12);
 }
 if(b.harborSupply){
  const {x,y}=b.harborSupply;
  circle(c,x,y,32,'#12292375','#c8f0ae',2);
  c.fillStyle='#253d32';c.fillRect(x-19,y-24,38,25);c.strokeStyle='#d7f0b8';c.lineWidth=2;c.strokeRect(x-19,y-24,38,25);
  c.fillStyle='#e0f4b9';c.fillRect(x-3,y-20,6,17);c.fillRect(x-8,y-15,16,6);
 }
 c.restore();
}
function flame(c,x,y,height,phase){
 const sway=Math.sin(phase)*height*.14;c.fillStyle='#df562cc0';c.beginPath();c.moveTo(x-height*.25,y);c.lineTo(x-height*.3,y-height*.42);c.lineTo(x+sway,y-height);c.lineTo(x+height*.12,y-height*.36);c.lineTo(x+height*.29,y-height*.56);c.lineTo(x+height*.22,y);c.closePath();c.fill();c.fillStyle='#ffcf7edc';c.beginPath();c.moveTo(x-height*.12,y);c.lineTo(x+sway*.5,y-height*.6);c.lineTo(x+height*.13,y);c.fill();
}
function paintInferno(c,f,t,reduced){
 const half=f.cone*Math.PI/360,travel=reduced?.88:.73+t*.19;
 c.translate(f.x,f.y-18);c.rotate(f.angle);
 for(let lane=-2;lane<=2;lane++){
  const angle=half*lane*.39,reach=f.r*travel*(1-Math.abs(lane)*.10);
  c.save();c.rotate(angle);
  c.fillStyle=lane===0?'#ffd080d9':'#db6a3d9e';
  c.beginPath();
  c.moveTo(13,0);c.lineTo(reach*.37,-11);c.lineTo(reach*.66,-15);
  c.lineTo(reach,0);c.lineTo(reach*.69,9);c.lineTo(reach*.26,7);
  c.closePath();c.fill();
  c.fillStyle=lane===0?'#fff0b7':'#ffad62c8';
  c.fillRect(reach*.25,-2,reach*.37,4);
  if(!reduced){
   c.fillStyle='#ffbc6e';
   c.fillRect(reach*.79,-10+t*5,5,3);
   c.fillStyle='#8143319e';
   c.fillRect(reach*.89,5+t*7,8,5);
  }
  c.restore();
 }
}
function paintConduitImpact(c,f,t,reduced){
 const reach=f.r*(reduced?.7:.4+t*.55);
 c.translate(f.x,f.y-12);
 c.strokeStyle='#7dc5bb';c.lineWidth=2;
 c.beginPath();c.ellipse(0,12,reach,reach*.42,0,0,TAU);c.stroke();
 c.fillStyle='#dcfff4';
 c.fillRect(-10,-2,20,4);c.fillRect(-2,-10,4,20);
 if(reduced)return;
 c.strokeStyle='#bcf7ed';c.lineWidth=3;c.beginPath();
 for(let i=0;i<5;i++){
  const a=i*TAU/5+.3,x=Math.cos(a)*reach,y=Math.sin(a)*reach*.66;
  c.moveTo(x*.28,y*.28);c.lineTo(x*.55-y*.22,y*.55+x*.16);c.lineTo(x,y);
 }
 c.stroke();
}
function paintTransfer(c,f,t,reduced){
 const dx=f.x2-f.x,dy=f.y2-f.y;
 if(f.type==='payload-relay'){
  c.translate(f.x,f.y-14);c.rotate(Math.atan2(dy,dx));
  const jump=reduced?0:t*20;
  c.fillStyle='#b8fff2';
  c.fillRect(jump,-2,15,4);c.fillRect(jump+9,-7,6,3);c.fillRect(jump+9,5,6,3);
  return;
 }
 const at=reduced?[1]:[t*.68,t*.87,t];
 c.fillStyle='#ffae68';
 for(const u of at)c.fillRect(f.x+dx*u-2,f.y+dy*u-14-9*u,5,4);
}
function paintCapstoneKill(c,f,t,reduced){
 const fire=f.flavor==='fire',spread=reduced?0:t;
 c.fillStyle=fire?'#e98d4a':'#a9f2e6';
 c.fillRect(f.x-3,f.y-18,6,4);
 if(reduced)return;
 for(let i=0;i<4;i++){
  const dx=(i-1.5)*(5+spread*9);
  const rise=fire?spread*(12+(i%2)*18):Math.abs(dx)*.35;
  c.fillStyle=fire?(i%2?'#ffd083':'#a96241'):(i%2?'#e4fff9':'#66c9c2');
  c.fillRect(f.x+dx,f.y-18-rise,i%2?4:6,3);
 }
}
function paintXp(c,g,player,reach,reduced){
 const pull=distance(g,player)<reach;
 c.save();c.translate(g.x,g.y);
 if(g.salvage){c.fillStyle='#26393177';c.beginPath();c.ellipse(0,0,8,3,0,0,TAU);c.fill();}
 if(pull&&!reduced){
  const angle=Math.atan2(g.y-player.y,g.x-player.x);
  c.strokeStyle=g.salvage?'#ffe4a594':'#d2eeda7b';c.lineWidth=g.salvage?2:1;
  c.beginPath();c.moveTo(0,-3);c.lineTo(Math.cos(angle)*13,-3+Math.sin(angle)*13);c.stroke();
 }
 const lift=g.salvage?6+(reduced?0:Math.sin(g.age*4+g.x*.09)*2):0;
 c.translate(0,-lift);c.rotate(Math.PI/4);
 const size=g.salvage?8:6;
 c.fillStyle=g.salvage||g.value>=8?'#ffdc8c':'#b5e0d1';
 c.fillRect(-size/2,-size/2,size,size);
 if(g.salvage){c.fillStyle='#fff1b1';c.fillRect(-4,-4,3,5);}
 c.restore();
}
function paintBossImpact(c,f,t,reduced){
 c.save();c.translate(f.x,f.y);
 const r=(f.r||68)*(1+t*.8);
 if(!reduced){
  for(let i=0;i<12;i++){
   const angle=i*TAU/12,radius=r*(.55+i%4*.13),dx=Math.cos(angle)*radius,dy=Math.sin(angle)*radius*.55;
   c.fillStyle=i%4?'#9d8762':'#efc37b';
   c.fillRect(dx,dy-6-t*(i%3+1)*18,5+i%5,4+i%4);
  }
 }
 c.strokeStyle='#e6c491';c.lineWidth=2;
 c.beginPath();c.ellipse(0,3,r,r*.42,0,0,TAU);c.stroke();
 c.restore();
}
function paintRailBoss(c,b,s){
 const {x,y,dead}=b;
 c.fillStyle='#28393c';c.fillRect(x-130,y-35,260,65);
 c.fillStyle=dead?'#48554f':'#85958b';c.fillRect(x-125,y-55,250,48);
 c.fillStyle=dead?'#5d6352':'#c0b891';
 for(let i=-2;i<=2;i++){c.fillRect(x+i*45-16,y-48,32,25);circle(c,x+i*45,y+31,12,'#26363c',dead?'#646c5c':'#8f9b91',3);}
 if(dead){
  c.fillStyle='#263530';c.beginPath();c.moveTo(x-28,y-55);c.lineTo(x+40,y-44);c.lineTo(x+27,y-6);c.lineTo(x-19,y-19);c.fill();
  c.fillStyle='#d28d55';c.fillRect(x-17,y-29,5,3);c.fillRect(x+16,y-33,4,2);
 }
 for(const part of b.parts){
  const p=partPosition(s,part);
  c.save();c.translate(p.x,p.y-20);c.rotate(dead?b.aim+Math.sign(part.ox)*.45:b.aim);
  c.fillStyle=part.hp>0&&!dead?'#b6bd99':'#4c5650';c.fillRect(-15,-12,40,24);c.fillRect(10,-5,dead?36:55,10);c.restore();
 }
}
export function createRenderer(canvas,art){
 const c=canvas.getContext('2d');let size={w:0,h:0,dpr:1},view={w:960,h:540},terrainCache=null,terrainKey='',siteStates=new Map();
 let showcaseLead=0,previousTime=0;
 function resize(){size={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);}
 function draw(s,reduced=false){
  if(size.w!==innerWidth||size.h!==innerHeight)resize();const mobile=size.w<=700;let worldWidth=mobile?520:960;
  const gate=exitGate(s),lead=coastLead(s);
  const follow=s.boss.active?1:!reduced&&s.operation&&s.stage==='holdout'?Math.max(0,1-s.holdTime/.65)**2:0;
  worldWidth+=(Math.max(worldWidth,Math.abs(s.player.x-s.boss.x)*1.2+300)-worldWidth)*follow;
  const scale=size.w/worldWidth;view={w:worldWidth,h:size.h/scale};
  const rescueLead=mobile&&lead?.opening&&distance(s.player,lead)<300?(lead.x-s.player.x)*.18:0;
  const elapsed=clamp(s.t-previousTime,0,.1);previousTime=s.t;
  if(!mobile||reduced||follow>0)showcaseLead=0;
  else{
   const showcase=s.powerWave?.showcase;
   const strike=showcase&&s.effects.findLast(f=>{
    if(f.type==='formation')return true;
    return showcase==='flame'?f.type==='flame'&&f.evolved:f.type==='payload-impact'||f.type==='payload-relay';
   });
   const relay=showcase==='fusion'&&s.shots.findLast(q=>q.source==='payload'&&q.relay);
   const targetX=relay?relay.x:strike?.type==='payload-relay'?strike.x2:strike?.x;
   const nextLead=strike?.type==='flame'?Math.cos(strike.angle)*85:clamp(((targetX??s.player.x)-s.player.x)*.55,-85,85);
   showcaseLead+=(nextLead-showcaseLead)*(1-Math.exp(-elapsed*8));
  }
  const focusX=s.player.x+(s.boss.x-s.player.x)*.35*follow+rescueLead+showcaseLead,focusY=s.player.y+(s.boss.y-s.player.y)*.35*follow;
  // A gate near a boundary needs room beside the objective rail and tactical map.
  const edgeMargin=gate&&s.operation?112*(1-follow):0;
  // Leave the harbor target below the two tactical lines on portrait displays.
  const bossMargin=mobile&&size.h>size.w&&s.boss.active&&s.operation?.region===2?
   Math.min(235,Math.max(0,Math.min(310,size.h*.38)/scale-s.boss.y)):0;
  const cx=clamp(focusX,view.w/2-edgeMargin,Math.max(view.w/2,1600-view.w/2)+edgeMargin);
  const cy=clamp(focusY,view.h/2-bossMargin,Math.max(view.h/2,1200-view.h/2));
  c.setTransform(size.dpr,0,0,size.dpr,0,0);c.clearRect(0,0,size.w,size.h);c.fillStyle='#263a44';c.fillRect(0,0,size.w,size.h);c.translate(size.w/2,size.h/2);c.scale(scale,scale);c.translate(-cx,-cy);c.imageSmoothingEnabled=false;
  const shake=!reduced&&s.player.hurt>0?Math.sin(s.t*75)*3:0;c.translate(shake,0);
  const index=s.operation?.region||0,key=`${index}:${s.seed}`;
  if(edgeMargin)paintTerrainMargins(c,index,edgeMargin);
  if(canvas.ownerDocument&&key!==terrainKey){terrainKey=key;siteStates.clear();terrainCache=canvas.ownerDocument.createElement('canvas');terrainCache.width=1600;terrainCache.height=1200;const tc=terrainCache.getContext('2d');tc.imageSmoothingEnabled=false;paintTerrain(tc,index,s.seed,art);}
  if(terrainCache)c.drawImage(terrainCache,0,0);else paintTerrain(c,index,s.seed,art);
  const visible=(x,y,padding=48)=>Math.abs(x-cx)<=view.w/2+padding&&Math.abs(y-cy)<=view.h/2+padding;
  const gateNear=gate&&distance(gate,s.player)<(s.operation?92:140);
  if(gate&&s.operation){
   if(visible(s.boss.x,s.boss.y,150))paintWreckGround(c,s.boss.x,s.boss.y,index);
   if(visible(gate.x,gate.y,80))paintGateApproach(c,gate,gateNear);
  }
  const approach=activeEntry(s);if(approach)paintEntryRoutes(c,approach);
  const entry=s.effects.find(f=>f.type==='region-entry');
  if(entry)paintFrontEntry(c,entry.x,entry.y,index,entry.age,reduced);
  for(const n of s.sites){const previous=siteStates.get(n.id);siteStates.set(n.id,{state:n.state,collected:previous&&previous.state!=='done'&&n.state==='done'?s.t:previous?.collected});}
  for(const n of s.sites)paintSiteGround(c,n,distance(n,s.player)<185,n.state==='active');
  for(const n of s.sites)if(n.kind==='relay'&&n.state==='active'){circle(c,n.x,n.y,125,'#83c5a40b','#c7dfb566',1);c.strokeStyle='#e8d49a';c.lineWidth=2;c.beginPath();c.arc(n.x,n.y,125,-Math.PI/2,-Math.PI/2+n.progress/5*TAU);c.stroke();}
  for(const z of s.zones){const wake=z.source==='wake';circle(c,z.x,z.y,z.r,wake?'#8d3e293a':'#552f282d',wake?'#f0815099':'#cb753769',wake?2:1);circle(c,z.x,z.y,z.r*.75,'#e7a05a30');for(let i=0;i<(wake?7:5);i++){const a=i*2.4+z.x,r=z.r*(.25+(i%3)*.22);flame(c,z.x+Math.cos(a)*r,z.y+Math.sin(a)*r,(wake?23:14)+(reduced?0:Math.sin(s.t*12+i)*4),s.t*9+i);}}
  const reach=pickupReach(s);
  const signal=signalCourier(s);
  if(s.challenge?.state==='active'&&s.challenge.type==='defend'){
   const {x,y,r}=DEFENSE_ZONE,inside=distance(s.player,DEFENSE_ZONE)<=r;
   circle(c,x,y,r,'#a085c023',inside?'#e6c4f2':'#a98ebd',2);
   c.strokeStyle='#f4d1ff';c.lineWidth=4;c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*s.challenge.progress/s.challenge.duration);c.stroke();
   c.fillStyle='#34263b';c.fillRect(x-53,y-11,106,22);c.fillStyle='#f4d1ff';c.font='11px Galmuri';c.textAlign='center';c.fillText('중계기 방어',x,y+4);
  }
  if(signal){
   c.strokeStyle='#d7a3e692';c.lineWidth=2;c.setLineDash([8,12]);c.beginPath();c.moveTo(SIGNAL_ROUTE.x,SIGNAL_ROUTE.end);c.lineTo(signal.x,signal.y);c.stroke();c.setLineDash([]);
  }
  for(const g of s.gems)if(!g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  if(s.stage==='field'){c.fillStyle='#293c34';c.fillRect(718,326,42,16);c.fillRect(840,326,42,16);c.fillStyle='#d8b471';for(let i=0;i<3;i++){c.fillRect(720+i*13,326,6,16);c.fillRect(842+i*13,326,6,16);}if(distance(s.player,{x:800,y:350})<190){c.fillStyle='#1c302de8';c.fillRect(727,363,146,24);c.fillStyle='#efcf90';c.font='11px Galmuri';c.textAlign='center';c.fillText('보스전 진입',800,379);}}
  const entities=[...s.sites.map(e=>({y:e.y,kind:'site',e})),...s.blocks.map(e=>({y:e.y+e.h,kind:'block',e})),...s.enemies.map(e=>({y:e.y,kind:'enemy',e})),{y:s.player.y,kind:'player',e:s.player}];
  if(gate)entities.push({y:gate.y,kind:'gate',e:gate});
  if(signal)entities.push({y:signal.y,kind:'courier',e:signal});
  if(s.raid?.state==='active')entities.push({y:s.raid.target.y,kind:'courier',e:s.raid.target});if(s.boss.active||s.boss.dead||s.stage==='field')entities.push({y:s.boss.y,kind:'boss',e:s.boss});
  for(const item of entities.sort((a,b)=>a.y-b.y)){
   const e=item.e;if(!visible(e.x,e.y,220))continue;c.save();
   if(item.kind==='gate'){if(s.operation)paintGate(c,e,s.holdTime,reduced);else if(art)prop(c,art,2,3,e.x,e.y,112);c.restore();continue;}
   if(item.kind==='site'){paintSite(c,e,s,art,s.t-(siteStates.get(e.id)?.collected??-99));c.restore();continue;}
   if(item.kind==='block'){paintBlock(c,e,index,art);if(e.hp>0&&e.hp<e.maxHp)bar(c,e.x+e.w/2,e.y-34,e.w,e.hp/e.maxHp,'#dfbc78');c.restore();continue;}
   if(item.kind==='enemy'){
    if(e.dead){const fall=1-e.death/.3;c.globalAlpha=Math.max(0,e.death/.3)*.7;c.translate(e.x,e.y);c.rotate(fall*.4*(e.x>s.player.x?1:-1));c.scale(1,1-fall*.45);c.translate(-e.x,-e.y);}else c.globalAlpha=Math.min(1,e.spawnAge*3);circle(c,e.x,e.y,14,'#263b3338');
    if(e.hurt>0)c.filter='brightness(1.7)';if(art)actor(c,art.enemies,({rifle:0,shield:1,mortar:2,officer:3})[e.type],Math.floor(e.walk)%4,e.x,e.y,e.type==='officer'?62:e.type==='shield'?55:49,Math.cos(e.aim)<0);else{c.fillStyle=e.type==='officer'?'#ba6d53':'#48533c';c.fillRect(e.x-12,e.y-34,24,34);}c.filter='none';
    if(e.burn>0&&!e.dead){circle(c,e.x,e.y-18,15,'#ff994925');flame(c,e.x-7,e.y-18,18,s.t*13+e.x);flame(c,e.x+6,e.y-22,13,s.t*12+e.y);}if(e.type==='officer'&&!e.dead){
     const marked=e.cohort==='challenge';
     bar(c,e.x,e.y-68,45,e.hp/e.maxHp,marked?'#efb6ff':'#f2b780');
     if(marked){
      c.fillStyle='#3d2b46';c.fillRect(e.x-13,e.y-85,26,14);
      c.fillStyle='#f4d5ff';c.font='10px Galmuri';c.textAlign='center';c.fillText(`D${s.challenge?.tier||1}`,e.x,e.y-74);
     }
    }
   }else if(item.kind==='player'){
    circle(c,e.x,e.y,19,'#283d3549',e.overdrive>0?'#ffdb82':'#c3e3cd',1);if(e.hurt>0)c.filter='brightness(1.8)';const bx=e.attack>0?-Math.cos(e.aim)*2:0;
    if(art)actor(c,art.operators,2+(Math.sin(e.aim)<-.6?1:0),e.moving?Math.floor(e.walk)%4:0,e.x+bx,e.y,64,Math.cos(e.aim)<0);else{c.fillStyle='#edb063';c.fillRect(e.x-13,e.y-44,26,44);}c.filter='none';
    if(e.overdrive>0){c.strokeStyle='#ffce72aa';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-24,35,s.t*3,s.t*3+4.6);c.stroke();}
    const maneuver=activeManeuver(e);if(maneuver){c.fillStyle=maneuver==='brace'?'#f8cf7e':'#9becbe';for(const side of [-1,1])c.fillRect(e.x+side*22-3,e.y+6,6,2);}
   }else if(item.kind==='courier'){
    if(art){c.save();c.translate(e.x,e.y);c.rotate(e.aim);prop(c,art,2,3,0,15,125);c.restore();}else{c.fillStyle='#81927c';c.fillRect(e.x-40,e.y-25,80,45);}bar(c,e.x,e.y-78,120,e.hp/e.maxHp,'#ddadff');
   }else{
    if(s.operation?.region===1)paintRailBoss(c,e,s);
    else if(art)vehicle(c,art,{x:e.x,y:e.y,width:s.operation?.region===2?225:185,enemy:true,body:e.body,turret:e.aim,kick:e.kick,tread:s.t*80,moving:!e.dead&&e.mode==='charge',flash:e.dead?0:e.flash,damaged:e.hp<e.maxHp*.5,wreck:e.dead,reduced});
    else{c.save();c.translate(e.x,e.y);c.rotate(e.body);c.fillStyle=e.dead?'#384747':'#667263';c.fillRect(-70,-45,140,90);c.restore();}
    if(e.dead&&gate)paintWreckSmoke(c,e.x,e.y,s.holdTime,reduced);
    if(e.active&&!e.dead)for(const part of e.parts){if(part.hp<=0)continue;const p=partPosition(s,part);circle(c,p.x,p.y,17,'#ffc96024','#ffdc8c',2);bar(c,p.x,p.y-25,35,part.hp/part.maxHp,'#ffcd7e');}
   }if(item.kind!=='enemy'&&item.kind!=='player'&&e.burn>0&&!e.dead){for(let i=-1;i<=1;i++)flame(c,e.x+i*28,e.y-18,24,s.t*11+i);}
   c.restore();
  }
  for(const g of s.gems)if(g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  paintPortCue(c,s);
  for(const n of s.sites)if(n!==lead)paintSiteLabel(c,n,s);
  if(gate&&distance(s.player,gate)<220){
   const label=gate.name;
   c.fillStyle='#152a26e8';c.fillRect(gate.x-55,gate.y+72,110,22);
   c.fillStyle=gateNear?'#e0f5c5':'#aac6a7';c.font='11px Galmuri';c.textAlign='center';c.fillText(label,gate.x,gate.y+87);
  }
  for(const q of s.shots){
   if(!visible(q.x,q.y,68))continue;
   const a=Math.atan2(q.vy,q.vx),payload=q.source==='payload';
   c.save();c.translate(q.x,q.y-18);c.rotate(a);
   if(payload){
    const tail=reduced?18:q.relay?48:36;
    c.fillStyle='#43a9ad9e';c.fillRect(-tail,-2,tail,4);
    c.fillStyle='#b9fff0';c.fillRect(-tail*.68,-1,tail*.68,2);
    c.fillStyle='#8ce4d7';c.fillRect(-9,-4,16,8);
    c.fillStyle='#effff1';c.fillRect(-4,-2,15,4);
   }else{
    c.fillStyle=q.rocket?'#f69145':'#ffdd87';c.shadowColor=q.rocket?'#ff984a':'#ffdf9e';c.shadowBlur=reduced?0:7;
    c.fillRect(-q.r*2,-q.r*.7,q.r*3,q.r*1.4);c.fillStyle='#fff3c8';c.fillRect(0,-1,q.r+3,2);
   }
   c.restore();
  }
  for(const f of s.effects){const t=f.age/f.life;c.save();c.globalAlpha=1-t;
   if(f.type==='xp-pickup'){
    const {x,y}=s.player,label=`+${f.value} XP`,rise=reduced?0:Math.max(0,t-.55)*15;
    c.globalAlpha=Math.min(1,(1-t)*2.5);c.textAlign='center';c.font=`bold ${f.salvage?14:12}px Galmuri`;
    c.fillStyle='#142922';c.fillText(label,x+1,y-68-rise+2);
    c.fillStyle=f.salvage?'#ffe3a0':'#c8ead2';c.fillText(label,x,y-68-rise);
   }
   else if(f.type==='boss-down'&&visible(f.x,f.y,150))paintBossImpact(c,f,reduced?0:t,reduced);
   else if(f.type==='barrage'){c.fillStyle=reduced?'#df985325':'#ffd39345';c.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);for(let y=f.y-f.h/2;y<f.y+f.h/2;y+=80)circle(c,f.x,y,20+t*30,'#f3ae6944','#ffcc87',2);}
   else if(f.type==='explosion'||f.type==='break'||f.type==='shrapnel'){const r=(f.r||80)*(.35+t*.7);circle(c,f.x,f.y,r,'#ec963b30','#ffd384',2);circle(c,f.x,f.y,r*.45,'#ffe0a178');for(let i=0;i<7;i++){const a=i*TAU/7;c.fillStyle='#efbd76';c.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,4,4);}}
   else if(f.type==='heat'){const r=(f.r||100)*(.25+t*.85);circle(c,f.x,f.y,r,null,'#ffc48a',reduced?2:5*(1-t)+1);if(!reduced)circle(c,f.x,f.y,r*.55,'#fff1c2'+(t<.15?'bb':'25'));for(let i=0;i<8;i++){const a=i*TAU/8;flame(c,f.x+Math.cos(a)*r*.65,f.y+Math.sin(a)*r*.5,16*(1-t)+4,i+t*8);}c.textAlign='center';c.font='bold 12px Galmuri';c.fillStyle='#ffe1aa';c.fillText('열압',f.x,f.y-r*.55-10);}
   else if(f.type==='raid-success'){const color=({common:'#ffe0a1',rare:'#90e0da',prototype:'#dcafff'})[f.quality];circle(c,f.x,f.y,25+t*110,null,color,4);for(let i=0;i<10;i++){const a=i*TAU/10;c.fillStyle=color;c.fillRect(f.x+Math.cos(a)*t*120,f.y+Math.sin(a)*t*75-20,4,8);}}
   else if(f.type==='payload'){circle(c,f.x,f.y,12+t*48,null,'#9bf2e8',3);circle(c,f.x,f.y,6+t*20,'#b7f4e444');}
   else if(f.type==='formation'){
    const r=29+t*15;c.strokeStyle=f.showcase==='flame'?'#efb477':'#b3e7da';c.lineWidth=2;c.strokeRect(f.x-r,f.y-r,r*2,r*2);
   }
   else if(f.type==='payload-relay'||f.type==='fire-spread'){
    if(visible(f.x,f.y,f.type==='fire-spread'?120:60))paintTransfer(c,f,t,reduced);
   }
   else if(f.type==='payload-impact'){
    if(visible(f.x,f.y,f.r+25))paintConduitImpact(c,f,t,reduced);
   }
   else if(f.type==='salvo-impact'){
    const r=f.r*(.4+t*.65),edge='#ffe49a';
    circle(c,f.x,f.y,r,'#ff913b32',edge,3);
    circle(c,f.x,f.y,r*.48,null,edge,2);
    if(!reduced)for(let i=0;i<8;i++){const a=i*TAU/8;circle(c,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,5,edge);}
   }
   else if(f.type==='pierce'){c.translate(f.x,f.y-18);c.rotate(f.angle);c.fillStyle='#fff2ae';c.fillRect(-12,-2,34+t*24,4);}
   else if(f.type==='lightning'||f.type==='ricochet'){c.strokeStyle=f.type==='lightning'?'#a1f5ef':'#f8dc8f';c.lineWidth=f.type==='lightning'?3:1.5;c.beginPath();c.moveTo(f.x,f.y);c.lineTo((f.x+f.x2)/2+Math.sin(s.t*40)*10,(f.y+f.y2)/2);c.lineTo(f.x2,f.y2);c.stroke();}
   else if(f.type==='flame'&&f.evolved){
    if(visible(f.x,f.y,f.r+25))paintInferno(c,f,t,reduced);
   }
   else if(f.type==='flame'){
    c.translate(f.x,f.y-18);c.rotate(f.angle);const half=f.cone*Math.PI/360,gradient=c.createRadialGradient(0,0,6,0,0,f.r);gradient.addColorStop(0,'#fff0c5d0');gradient.addColorStop(.35,'#ffbc6690');gradient.addColorStop(1,'#ed553000');c.fillStyle=gradient;c.beginPath();c.moveTo(0,0);c.arc(0,0,f.r,-half,half);c.closePath();c.fill();
    for(let i=0;i<15;i++){const at=.12+(i%5)*.17,a=Math.sin(i*8.4+f.age*10)*half*.8,x=Math.cos(a)*f.r*at,y=Math.sin(a)*f.r*at,r=7+at*21;c.save();c.translate(x,y);c.rotate(Math.PI/2+a);flame(c,0,r*.35,r*1.7,i+f.age*14);c.restore();}

   }
   else if(f.type==='shot'||f.type==='rocket-shot'){c.translate(f.x,f.y);c.rotate(f.angle);c.fillStyle='#ffedb0';c.beginPath();c.moveTo(0,-6);c.lineTo(24,0);c.lineTo(0,6);c.closePath();c.fill();}
   else if(f.type==='kill'&&f.flavor){
    if(visible(f.x,f.y))paintCapstoneKill(c,f,t,reduced);
   }
   else if(f.type==='impact'||f.type==='kill'){c.strokeStyle=f.type==='kill'?'#f9dcb4':'#fff1be';c.lineWidth=2;for(let i=0;i<4;i++){const a=i*TAU/4+f.age*4,r=5+t*16;c.beginPath();c.moveTo(f.x+Math.cos(a)*r,f.y-18+Math.sin(a)*r);c.lineTo(f.x+Math.cos(a)*(r+7),f.y-18+Math.sin(a)*(r+7));c.stroke();}}
   c.restore();
  }
  if(s.boss.active&&s.boss.mode==='windup'){
   const b=s.boss;
   c.save();c.translate(b.x,b.y);c.rotate(b.body);
   c.fillStyle='#d9633b35';c.strokeStyle='#ffd588';c.lineWidth=2;
   c.fillRect(20,-55,300,110);c.strokeRect(20,-55,300,110);c.restore();
  }
  for(const q of s.enemyShots)if(visible(q.x,q.y))circle(c,q.x,q.y-18,6,'#b0422c','#ffe1a1',2);
  for(const h of s.hazards){
   if(h.hit||!visible(h.x,h.lane?s.player.y:h.y,h.lane?h.w:h.r))continue;
   if(h.lane){c.fillStyle='#d9813828';c.fillRect(h.x-h.w/2,h.y-h.h/2,h.w,h.h);c.strokeStyle='#ffd087';c.lineWidth=3;c.strokeRect(h.x-h.w/2,h.y-h.h/2,h.w,h.h);c.fillStyle='#f8d79b';c.font='bold 13px Galmuri';c.textAlign='center';c.fillText('포격 예고',h.x,s.player.y-50);continue;}
   circle(c,h.x,h.y,h.r,'#d83d4120','#321e25',6);
   circle(c,h.x,h.y,h.r,null,'#ffada0',3);
   circle(c,h.x,h.y,h.r*clamp(1-h.timer/(h.duration||.9),0,1),null,'#fff0bb',h.timer<.25?3:1);
  }
  c.setTransform(size.dpr,0,0,size.dpr,0,0);const vignette=c.createRadialGradient(size.w/2,size.h/2,size.h*.2,size.w/2,size.h/2,size.w*.75);vignette.addColorStop(0,'#12232c00');vignette.addColorStop(1,'#12232c65');c.fillStyle=vignette;c.fillRect(0,0,size.w,size.h);
  if(lead)paintCoastCue(c,lead,size,cx,cy,scale);
 }
 return{draw,view:()=>view,resize};
}
