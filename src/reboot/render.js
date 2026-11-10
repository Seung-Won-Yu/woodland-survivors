import {paintTerrain,paintTerrainMargins,paintBlock,paintSiteGround,paintSite,paintSiteLabel,paintGate,paintGateApproach,paintWreckGround,paintWreckSmoke,paintFrontEntry,paintEntryRoutes,paintPortGantry} from './field-art.js';
import {exitGate,portCoreWindow,portCoreDisrupted,portCoreReach,portFlankPoint,portTurretShutter,portGantry,portGantryBypass,portTurretSide,portAidCue,portAidCounterReady,railGunOf,COAST_MORTAR,coastLead,coastLeadColor,coastEncounterCue,coastMortarAiming,coastMortarThreatens,activeEntry} from './campaign.js';
import {actor,prop,vehicle} from '../mission/art.js';
import {distance,blastContactRadius,clamp} from './content.js';
import {activeManeuver,partPosition,pickupReach,portTurretInSight} from './model.js';
import {DEFENSE_ZONE,SIGNAL_COLOR,signalRoute,signalCourier} from './campaign.js';
import {RAID_MARKS,raidAhead,raidOnNose} from './raid.js';
import {COAST_CHARGE,coastChargeLane} from './coast-charge.js';
import {operatorOf,focusLane,canUseSkill} from './operator.js';
const TAU=Math.PI*2;
function circle(c,x,y,r,fill,stroke=null,width=1){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function paintFocusSight(c,s){
 const p=s.player,lane=focusLane(s),end=Math.min(118,lane.length);
 if(end<24)return;
 c.save();c.translate(p.x,p.y);c.rotate(lane.angle);
 c.strokeStyle='#efd09b';c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();c.moveTo(22,0);c.lineTo(end-3,0);c.stroke();c.setLineDash([]);
 c.beginPath();c.moveTo(end-12,-6);c.lineTo(end,0);c.lineTo(end-12,6);c.stroke();c.restore();
}
function paintFocusShot(c,f,t,reduced){
 c.save();c.translate(f.x,f.y);c.rotate(f.angle);
 c.fillStyle='#edaa5f3d';c.fillRect(0,-f.width,f.length,f.width*2);
 c.restore();c.translate(f.x,f.y-13);c.rotate(f.angle);
 c.fillStyle='#d38f51';c.fillRect(0,-(reduced?2:5*(1-t)+2),f.length,reduced?4:10*(1-t)+4);
 c.fillStyle='#fff0be';c.fillRect(0,-1,f.length,2);
 if(!reduced&&f.length>8){c.fillRect(4,-6,Math.min(22,f.length-4),12);c.fillRect(f.length-6,-3,6,6);}
}
function bar(c,x,y,width,ratio,color){c.fillStyle='#101d26';c.fillRect(x-width/2,y,width,5);c.fillStyle=color;c.fillRect(x-width/2,y,width*clamp(ratio,0,1),5);}
function paintChargeLane(c,b,lane,outline=false){
 const {endX,endY,r}=lane,warning=b.mode==='windup';
 const x=warning?lane.x:b.x,y=warning?lane.y:b.y,angle=b.body;
 const sideX=-Math.sin(angle)*r,sideY=Math.cos(angle)*r;
 c.save();c.beginPath();
 c.moveTo(x+sideX,y+sideY);c.lineTo(endX+sideX,endY+sideY);
 c.arc(endX,endY,r,angle+Math.PI/2,angle-Math.PI/2,true);
 c.lineTo(x-sideX,y-sideY);c.arc(x,y,r,angle-Math.PI/2,angle+Math.PI/2,true);c.closePath();
 if(!outline){c.fillStyle=warning?'#9b5d312e':'#ac46282c';c.fill();c.restore();return;}
 c.strokeStyle='#483625';c.lineWidth=5;c.stroke();
 c.strokeStyle=warning?'#f3be79':'#eb9668';c.lineWidth=2;c.setLineDash(warning?[11,8]:[]);c.stroke();c.setLineDash([]);
 c.translate(x,y);c.rotate(angle);
 const remaining=Math.hypot(endX-x,endY-y);
 c.fillStyle=warning?'#ffe1a9':'#fbb882';
 if(warning&&lane.blockId)c.fillRect(remaining-2,-19,4,38);
 for(let d=64;d<remaining-12;d+=72){
  c.beginPath();c.moveTo(d+13,0);c.lineTo(d-8,-10);c.lineTo(d-3,0);c.lineTo(d-8,10);c.closePath();c.fill();
 }
 c.restore();
}
function paintCoastRear(c,s){
 const b=s.boss;
 if(s.operation?.region>0||!b.active||b.dead||b.mode!=='recover')return;
 const rear=b.body+Math.PI,half=Math.acos(-COAST_CHARGE.rearDot),reach=b.r+13;
 const x=b.x+Math.cos(rear)*reach,y=b.y+Math.sin(rear)*reach;
 c.save();
 c.beginPath();c.arc(b.x,b.y,reach,rear-half,rear+half);c.strokeStyle='#513425';c.lineWidth=6;c.stroke();
 c.strokeStyle='#f9bc74';c.lineWidth=3;c.stroke();
 c.translate(x,y);c.rotate(rear);c.fillStyle='#ffe1ac';
 for(const sy of [-10,5])c.fillRect(-5,sy,10,5);
 c.restore();
}
function paintEscapeLane(c,path,color,dashes,visible){
 const end=path.at(-1),prior=path.at(-2);
 c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();
 path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
 c.strokeStyle='#233634';c.lineWidth=6;c.stroke();
 c.strokeStyle=color;c.lineWidth=2.5;c.setLineDash(dashes);c.stroke();c.setLineDash([]);
 if(visible(end.x,end.y,75)){
  c.save();c.translate(end.x,end.y);c.rotate(Math.atan2(end.y-prior.y,end.x-prior.x));
  c.fillStyle='#253635';c.fillRect(-9,-51,18,102);
  c.fillStyle=color;for(let i=-45;i<=36;i+=18)c.fillRect(-6,i,12,9);
  c.restore();
  const labelY=end.y<130?end.y+20:end.y-70;
  c.font='bold 12px Galmuri';c.textAlign='center';c.fillStyle='#263635';c.fillRect(end.x-47,labelY,94,22);
  c.fillStyle=color;c.fillText('탈출 검문선',end.x,labelY+15);
 }
 c.restore();
}
function paintCoastCue(c,s,site,guns,size,cx,cy,scale){
 const prefix=site.coastApproach?.toUpperCase();
 const name=site.opening?'포로 구출':site.name;
 const label=coastEncounterCue(s,site)||(site.state==='ready'&&site.opening?'접근해 구출':prefix?`${prefix} · ${name}`:name);
 const target=guns.find(e=>coastMortarAiming(s,e))||guns.reduce((near,e)=>!near||distance(e,s.player)<distance(near,s.player)?e:near,null)||site;
 const targetX=size.w/2+(target.x-cx)*scale;
 const targetY=size.h/2+(target.y-cy)*scale;
 const mobile=size.w<=700;
 const color=coastLeadColor(site);
 c.save();
 c.font='bold 11px Galmuri, sans-serif';
 const width=Math.ceil(c.measureText(label).width)+32;
 const compactMargin=mobile&&size.h<590?Math.min(114,size.w-width-12):12;
 const x=Math.round(clamp(targetX,width/2+compactMargin,size.w-width/2-12));
 const left=x-width/2<204;
 const top=mobile?(size.h<590?224:left?310:124):112;
 const bottom=mobile?Math.max(top+18,size.h-(left?324:155)):Math.max(top+18,size.h-112);
 const y=Math.round(clamp(targetY-Math.max(56,88*scale),top,bottom));
 const overlapsWarning=s.hazards.some(h=>!h.hit&&h.coastMortar
  &&Math.abs(size.w/2+(h.x-cx)*scale-x)<width/2+(h.r+18)*scale
  &&Math.abs(size.h/2+(h.y-cy)*scale-y)<15+(h.r+18)*scale);
 if(overlapsWarning){c.restore();return;}
 c.fillStyle='#152a28f2';
 c.fillRect(x-width/2,y-13,width,26);
 c.strokeStyle=color;
 c.lineWidth=1;
 c.strokeRect(x-width/2+.5,y-12.5,width-1,25);
 c.fillStyle=color;
 c.textAlign='left';
 c.textBaseline='middle';
 c.fillText(label,x-width/2+23,y+1);
 if(site.coastApproach==='r'&&coastMortarThreatens(s,site)){
  c.fillRect(x-width/2+11,y-5,2,6);
  c.fillRect(x-width/2+11,y+3,2,2);
  c.restore();return;
 }
 c.translate(x-width/2+12,y);
 c.rotate(Math.atan2(targetY-y,targetX-x));
 c.beginPath();
 c.moveTo(5,0);c.lineTo(-4,-4);c.lineTo(-2,0);c.lineTo(-4,4);c.closePath();c.fill();
 c.restore();
}
function paintCoastGuard(c,s,e){
 const mortar=e.type==='mortar',aiming=mortar&&coastMortarAiming(s,e);
 const color=aiming?'#ffe29b':mortar?'#a8ded0':'#dfbc82';
 c.save();c.translate(e.x,e.y);
 c.strokeStyle='#23352e';c.lineWidth=5;
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(side*24,0);c.lineTo(side*20,7);c.lineTo(side*12,7);c.stroke();
 }
 c.strokeStyle=color;c.lineWidth=2;
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(side*24,0);c.lineTo(side*20,7);c.lineTo(side*12,7);c.stroke();
 }
 if(aiming){
  c.fillStyle='#28372f';c.fillRect(-8,-56,16,13);
  c.fillStyle=color;c.fillRect(-1,-54,2,5);c.fillRect(-1,-47,2,2);
 }
 c.restore();
}
function paintCoastMortarFlight(c,h){
 const t=clamp(1-h.timer/COAST_MORTAR.warning,0,1);
 const point=p=>({x:h.fromX+(h.x-h.fromX)*p,y:h.fromY+(h.y-h.fromY)*p-18*(1-p)-Math.sin(Math.PI*p)*88});
 const head=point(t),tail=point(Math.max(0,t-.085));
 c.save();c.translate(head.x,head.y);
 c.rotate(Math.atan2(head.y-tail.y,head.x-tail.x));
 c.fillStyle='#2a2c2a';c.fillRect(-11,-3,16,6);
 c.fillStyle='#edcf85';c.fillRect(-8,-1,11,2);
 c.fillStyle='#fff0bd';c.fillRect(1,-2,4,4);
 c.restore();
}
const overlapsBox=(x,y,hw,hh,box)=>x+hw>box.left&&x-hw<box.right&&y+hh>box.top&&y-hh<box.bottom;
const aidObscured=(size,{x,y},r,hud)=>x<r||x>size.w-r||y<r||y>size.h-r||hud.some(box=>overlapsBox(x,y,r,r,box));
export function aidBearingPosition(size,target,radius,width,hud,warnings){
 const {x,y}=target;
 if(!aidObscured(size,target,radius,hud))return null;
 const hw=width/2,hh=12,margin=8;
 const minX=hw+margin,maxX=size.w-hw-margin,minY=hh+margin,maxY=size.h-hh-margin;
 if(minX>maxX||minY>maxY)return null;
 const blocked=[...hud,...warnings],xs=[clamp(x,minX,maxX)],ys=[clamp(y,minY,maxY)];
 for(const box of blocked){
  xs.push(box.left-hw-margin,box.right+hw+margin);
  ys.push(box.top-hh-margin,box.bottom+hh+margin);
 }
 let position=null,nearest=Infinity;
 for(const px of xs)for(const py of ys){
  if(px<minX||px>maxX||py<minY||py>maxY||blocked.some(box=>overlapsBox(px,py,hw,hh,box)))continue;
  const gap=Math.hypot(px-x,py-y);
  if(gap<nearest){nearest=gap;position={x:px,y:py};}
 }
 return position;
}
function paintAidBearing(c,s,aid,size,cx,cy,scale,hud){
 const screen=point=>({x:size.w/2+(point.x-cx)*scale,y:size.h/2+(point.y-cy)*scale});
 const target=screen(aid.point),radius=Math.max(14,27*scale);
 if(!aidObscured(size,target,radius,hud))return;
 const warnings=s.hazards.filter(h=>h.portRound&&!h.hit).map(h=>{
  const {x,y}=screen(h),r=blastContactRadius(h)*scale;
  return {left:x-r,right:x+r,top:y-r,bottom:y+r};
 });
 const labels={blocked:'착탄 뒤 회수',evade:'원 밖으로 회피',safe:'안전 회수',collect:'구급 화물',bait:'조준 유도',incoming:'투하 예정'};
 const state=aid.endangered?'evade':aid.state;
 const alert=['blocked','evade','bait'].includes(state),color=alert?'#ffba91':'#d7f0b8';
 c.save();c.font='bold 11px Galmuri, sans-serif';
 const label=labels[state],width=Math.ceil(c.measureText(label).width)+32;
 const position=aidBearingPosition(size,target,radius,width,hud,warnings);
 if(position){
  const {x,y}=position,left=x-width/2;
  c.fillStyle='#182c27';c.fillRect(left,y-12,width,24);
  c.strokeStyle=color;c.lineWidth=1;c.strokeRect(left+.5,y-11.5,width-1,23);
  c.fillStyle=color;c.textAlign='left';c.fillText(label,left+23,y+4);
  c.translate(left+12,y);
  if(alert){c.fillRect(-1,-5,2,6);c.fillRect(-1,3,2,2);}
  else{
   c.rotate(Math.atan2(target.y-y,target.x-x));
   c.beginPath();c.moveTo(5,0);c.lineTo(-4,-4);c.lineTo(-2,0);c.lineTo(-4,4);c.closePath();c.fill();
  }
 }
 c.restore();
}
function paintPortCue(c,s,aid){
 const b=s.boss;
 if(s.operation?.region!==2||!b.active||b.dead)return;
 c.save();
 const turret=b.parts[0],flank=portTurretInSight(s);
 if(portTurretShutter(s)&&!flank){
  const p=partPosition(s,turret);
  circle(c,p.x,p.y,27,'#b580453d','#edb272',3);
 }
 if(portGantryBypass(s)){
  const p=partPosition(s,turret);
  c.setLineDash([7,5]);circle(c,p.x,p.y,30,null,'#b6e1c5',2);c.setLineDash([]);
 }
 if(s.operation.support==='breach'&&turret?.hp>0){
  const side=portTurretSide(b),{x,y}=portFlankPoint(b);
  c.strokeStyle=flank?'#c8f4ff':'#a9d6e9b0';c.lineWidth=3;
  c.beginPath();c.moveTo(x+side*12,y-12);c.lineTo(x,y);c.lineTo(x+side*12,y+12);c.stroke();
  const suppressed=b.turretSuppressedCycle===b.cycle&&b.mode!=='aim';
  if(suppressed){
   const p=partPosition(s,turret);
   circle(c,p.x,p.y,26,null,'#c8f4ff',3);
   c.strokeStyle='#c8f4ff';c.lineWidth=3;c.beginPath();
   c.moveTo(p.x-7,p.y-37);c.lineTo(p.x+7,p.y-27);
   c.moveTo(p.x+7,p.y-37);c.lineTo(p.x-7,p.y-27);c.stroke();
  }else if(flank){
   const p=partPosition(s,turret);
   circle(c,p.x,p.y,25,null,'#c8f4ff',3);c.fillStyle='#c8f4ff';c.fillRect(p.x-2,p.y-30,4,10);
  }
 }else if(portCoreWindow(s)){
  const reach=portCoreReach(b),p=s.player;
  c.setLineDash([9,7]);circle(c,b.x,b.y,reach,null,'#ffc889b8',2);c.setLineDash([]);
  circle(c,b.x,b.y-21,22,'#432820aa','#ffd0a1',3);
  c.fillStyle='#ffe6bb';c.beginPath();c.moveTo(b.x-9,b.y-22);c.lineTo(b.x+9,b.y-22);c.lineTo(b.x,b.y-33);c.closePath();c.fill();c.fillRect(b.x-3,b.y-22,6,12);
  if(p.dashCd<=0&&distance(p,b)<=reach){
   c.strokeStyle='#ffe6bb';c.lineWidth=3;
   for(const side of [-1,1]){
    const x=p.x+side*32,y=p.y+5;
    c.beginPath();c.moveTo(x-side*7,y-6);c.lineTo(x,y);c.lineTo(x-side*7,y+6);c.stroke();
   }
  }
 }else if(portCoreDisrupted(s)){
  circle(c,b.x,b.y-21,25,'#faab573d','#ffe2a3',3);
 }
 if(portAidCounterReady(s)&&b.parts[1].hp>0){
  const p=partPosition(s,b.parts[1]);
  c.setLineDash([5,4]);circle(c,p.x,p.y,31,null,'#d7f0b8',2);c.setLineDash([]);
  c.fillStyle='#d7f0b8';c.fillRect(p.x-9,p.y-34,18,3);c.fillRect(p.x-2,p.y-41,4,10);
 }
 if(aid&&!aid.preview){
  const {x,y}=aid.point,blocked=aid.state==='blocked',early=aid.state==='safe';
  const color=blocked?'#ffba91':early?'#f8e6a6':'#c8f0ae';
  circle(c,x,y,32,'#12292375',color,early?3:2);
  c.fillStyle='#253d32';c.fillRect(x-19,y-24,38,25);c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x-19,y-24,38,25);
  c.fillStyle=color;
  if(blocked){c.fillRect(x-2,y-20,4,10);c.fillRect(x-2,y-7,4,4);}
  else{c.fillRect(x-3,y-20,6,17);c.fillRect(x-8,y-15,16,6);}
 }else if(aid){
  const {x,y}=aid.point,risk=aid.state==='bait'||aid.endangered,color=risk?'#f9c184':'#d7f0b8';
  c.setLineDash([6,5]);circle(c,x,y,32,'#12292345',color,2);c.setLineDash([]);
  c.fillStyle=color;c.font='bold 11px Galmuri';c.textAlign='center';c.fillText(aid.endangered?'회피 우선':risk?'포격 위험':'투하 예정',x,y+4);
 }
 c.restore();
}
function flame(c,x,y,height,phase){
 const sway=Math.sin(phase)*height*.14;c.fillStyle='#df562cc0';c.beginPath();c.moveTo(x-height*.25,y);c.lineTo(x-height*.3,y-height*.42);c.lineTo(x+sway,y-height);c.lineTo(x+height*.12,y-height*.36);c.lineTo(x+height*.29,y-height*.56);c.lineTo(x+height*.22,y);c.closePath();c.fill();c.fillStyle='#ffcf7edc';c.beginPath();c.moveTo(x-height*.12,y);c.lineTo(x+sway*.5,y-height*.6);c.lineTo(x+height*.13,y);c.fill();
}
function paintInferno(c,f,t,reduced){
 const reach=f.r*(reduced?.91:.87+t*.12);
 const spread=Math.min(70,Math.tan(f.cone*Math.PI/360)*reach*.73);
 const swell=reduced?0:Math.sin(t*Math.PI*2)*spread*.13;
 c.translate(f.x,f.y-18);c.rotate(f.angle);
 c.fillStyle='#ba4f2e9e';c.beginPath();c.moveTo(9,0);
 c.quadraticCurveTo(reach*.27,-3,reach*.39,-spread*.44);
 c.quadraticCurveTo(reach*.58,-spread*.91+swell,reach*.62,-spread*.57+swell);
 c.quadraticCurveTo(reach*.86,-spread+swell,reach*.84,-spread*.42);
 c.quadraticCurveTo(reach*1.04,-spread*.48,reach*.96,0);
 c.quadraticCurveTo(reach,spread*.41+swell,reach*.79,spread*.39+swell);
 c.quadraticCurveTo(reach*.81,spread*.82+swell,reach*.59,spread*.55);
 c.quadraticCurveTo(reach*.53,spread*.66,reach*.36,spread*.28);
 c.closePath();c.fill();
 c.fillStyle='#f09148d4';c.beginPath();c.moveTo(9,0);
 c.quadraticCurveTo(reach*.31,-4,reach*.48,-spread*.30);
 c.quadraticCurveTo(reach*.72,-spread*.62+swell,reach*.68,-spread*.22);
 c.quadraticCurveTo(reach*.95,-spread*.32,reach*.85,spread*.15);
 c.quadraticCurveTo(reach*.72,spread*.39,reach*.58,spread*.28);
 c.quadraticCurveTo(reach*.43,spread*.41,reach*.29,7);
 c.closePath();c.fill();
 c.fillStyle='#ffe3a7';c.beginPath();c.moveTo(10,0);
 c.quadraticCurveTo(reach*.28,-7,reach*.45,-spread*.13);
 c.quadraticCurveTo(reach*.67,-spread*.32,reach*.59,spread*.07);
 c.quadraticCurveTo(reach*.43,spread*.24,reach*.27,5);c.closePath();c.fill();
 if(!reduced)for(let i=0;i<5;i++){
  const x=reach*(.64+i*.07),y=spread*(i%2?.53:-.63)+swell;
  c.fillStyle=i%2?'#efb065':'#9e5234';c.fillRect(x,y,4+i%3,3);
 }
}
function paintWake(c,z,time,reduced){
 circle(c,z.x,z.y,z.r,'#39271f35','#6e443143',1);
 for(let i=0;i<6;i++){
  const a=i*2.4+z.x,r=z.r*(.35+(i%3)*.22),x=z.x+Math.cos(a)*r,y=z.y+Math.sin(a)*r;
  c.fillStyle='#3e2c2699';c.fillRect(x-6,y-2,12,4);
  c.fillStyle=i%2?'#e08b49':'#a75530';c.fillRect(x-2,y-2,4,2);
  if(!reduced&&i%2===0)flame(c,x,y,9+Math.sin(time*9+i)*3,time*8+i);
 }
}
function paintHeatImpulse(c,f,t,reduced){
 const r=(f.r??100)*(reduced?.84:.48+t*.58);
 c.strokeStyle='#f2ac6c';c.lineWidth=reduced?2:3;
 for(let i=0;i<3;i++){
  const a=i*TAU/3+.2;
  c.beginPath();c.arc(f.x,f.y,r,a,a+1.3);c.stroke();
 }
 if(t<.42){
  c.fillStyle='#ffe1a9';c.fillRect(f.x-6,f.y-17,12,4);
  if(!reduced)flame(c,f.x,f.y-10,27*(1-t),t*7);
 }
}
function paintArmorHeat(c,f,t){
 c.fillStyle='#e4a05d';
 c.fillRect(f.x-14,f.y-17,28,3);c.fillRect(f.x-11,f.y-23,22,2);
 c.fillStyle='#ffcf86';c.fillRect(f.x-6,f.y-29-t*5,12,2);
}
function paintConduitImpact(c,f,t,reduced){
 const reach=f.r*(reduced?.7:.4+t*.55);
 c.translate(f.x,f.y-12);
 c.strokeStyle='#82c9bd';c.lineWidth=2;
 for(let i=0;i<3;i++){
  const a=i*TAU/3+.15;
  c.beginPath();c.ellipse(0,12,reach,reach*.42,0,a,a+1.12);c.stroke();
 }
 if(t<.45){c.fillStyle='#dcfff4';c.fillRect(-10,-2,20,4);c.fillRect(-2,-10,4,20);}
 if(reduced||t>.68)return;
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
  c.translate(f.x,f.y-18);c.rotate(Math.atan2(dy,dx));
  c.fillStyle='#b8fff2';c.fillRect(-5,-6,13,2);c.fillRect(-5,4,13,2);
  if(!reduced){c.fillStyle='#70bfb3';c.fillRect(-7-t*16,-3,8,6);}
  return;
 }
 const at=reduced?[1]:[t*.68,t*.87,t];
 c.fillStyle='#ffae68';
 for(const u of at)c.fillRect(f.x+dx*u-2,f.y+dy*u-14-9*u,5,4);
}
function paintConduitTrail(c,q,history){
 let points=history.get(q);
 if(!points){points=[];history.set(q,points);}
 const last=points.at(-1),gap=last?distance(last,q):Infinity;
 if(gap>72)points.length=0;
 if(gap>=8){points.push({x:q.x,y:q.y});if(points.length>5)points.shift();}
 if(points.length<2)return;
 c.beginPath();c.moveTo(points[0].x,points[0].y-18);
 for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y-18);
 c.lineTo(q.x,q.y-18);c.lineJoin='round';
 c.strokeStyle=q.relay?'#4bb2a9a3':'#438e857e';c.lineWidth=6;c.stroke();
 c.strokeStyle=q.relay?'#b2fff1':'#80d2c6';c.lineWidth=2;c.stroke();
}
function paintFormationEntry(c,f,reduced){
 const fire=f.showcase==='flame',t=f.age/f.life;
 c.save();c.globalAlpha=(1-t)*.75;c.translate(f.x,f.y);c.rotate(f.angle??0);
 c.fillStyle=fire?'#c78850':'#77b8ad';
 for(const offset of [-15,15]){
  c.fillRect(-25,offset-2,16,4);c.fillRect(-27,offset-5,4,10);
  if(!reduced){c.fillStyle=fire?'#e4bc79':'#b8e1cd';c.fillRect(-26-t*14,offset+(offset>0?5:-7),5,3);c.fillStyle=fire?'#c78850':'#77b8ad';}
 }
 c.restore();
}
function paintInfantryFall(c,e,reduced){
 const remaining=clamp(e.death/.3,0,1),fall=1-remaining,side=Math.cos(e.aim)<0?1:-1;
 c.globalAlpha=remaining*(e.deathFlavor ? .9 : .7);
 if(reduced)return;
 c.translate(e.x,e.y);
 if(e.deathFlavor==='fire'){
  c.rotate(side*fall*.15);c.scale(1+fall*.12,1-fall*.72);
 }else if(e.deathFlavor==='arc'){
  const snap=Math.min(1,fall*4);
  c.translate(side*snap*8,0);c.rotate(side*snap*.62);c.scale(1,1-fall*.42);
 }else{
  c.rotate(side*fall*.4);c.scale(1,1-fall*.45);
 }
 c.translate(-e.x,-e.y);
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
 c.fillStyle='#252d27';c.fillRect(x-107,y-37,214,63);c.fillRect(x-101,y-49,202,12);
 for(const dx of [-88,-52,52,88])circle(c,x+dx,y+27,10,'#252e28',dead?'#4a5146':'#899282',3);
 c.fillStyle=dead?'#465149':'#657262';c.fillRect(x-102,y-42,204,49);
 c.fillStyle=dead?'#333e36':'#343f35';c.fillRect(x-98,y+6,196,17);
 c.fillStyle=dead?'#5a6050':'#adb29b';c.fillRect(x-97,y-41,194,4);
 for(const side of [-1,1]){
  const cx=x+side*60;
  c.fillStyle=dead?'#333e36':'#515e51';c.fillRect(cx-33,y-32,66,28);
  c.fillStyle=dead?'#6d705b':'#929782';
  for(let i=0;i<4;i++)c.fillRect(cx-26+i*16,y-30,3,19);
  c.fillStyle=dead?'#5e604d':'#b09a6e';c.fillRect(cx-30,y+10,17,3);c.fillRect(cx+13,y+10,17,3);
 }
 c.fillStyle=dead?'#242d26':'#29362d';c.fillRect(x-22,y-29,44,37);
 c.fillStyle=dead?'#535746':'#a8ab90';
 for(let i=0;i<5;i++)c.fillRect(x-16,y-24+i*6,32,2);
 if(dead){
  c.fillStyle='#263530';c.beginPath();c.moveTo(x-28,y-55);c.lineTo(x+40,y-44);c.lineTo(x+27,y-6);c.lineTo(x-19,y-19);c.fill();
  c.fillStyle='#d28d55';c.fillRect(x-17,y-29,5,3);c.fillRect(x+16,y-33,4,2);
 }
 b.parts.forEach((part,i)=>{
  const p=partPosition(s,part),round=s.hazards.find(h=>h.lane&&railGunOf(h)===i),live=part.hp>0&&!dead;
  const aim=round?Math.atan2(round.y-p.y,round.x-p.x):b.aim;
  const kick=live&&round?.hit?clamp(1+round.timer/.17,0,1):0;
  c.save();c.translate(p.x,p.y-20);c.rotate(live?aim:Math.PI/2+Math.sign(part.ox)*.45);
  c.fillStyle='#263631';c.fillRect(-19,-15,44,30);
  c.fillStyle=live?'#b6bd99':'#4c5650';c.fillRect(-15,-12,37,24);
  c.fillStyle=live?'#838d79':'#424c47';c.fillRect(10-kick*13,-6,live?55:34,12);
  if(live){
   c.fillStyle=round&&!round.hit?'#f8b877':'#c2c3a0';c.fillRect(58-kick*13,-6,7,12);
   if(kick>.55){c.fillStyle='#ffde9c';c.beginPath();c.moveTo(53,-8);c.lineTo(80,0);c.lineTo(53,8);c.closePath();c.fill();}
  }
  c.restore();
 });
}
function paintRailWarning(c,h,y){
 const x=h.x-h.w/2,top=h.y-h.h/2,bottom=top+h.h;
 c.fillStyle=h.tracked?'#da783b4a':'#b5843a2c';c.fillRect(x,top,h.w,h.h);
 c.strokeStyle='#3e2e24';c.lineWidth=6;c.strokeRect(x,top,h.w,h.h);
 c.strokeStyle=h.tracked?'#ffc07a':'#d9aa6f';c.lineWidth=h.tracked?3:2;c.strokeRect(x,top,h.w,h.h);
 if(h.tracked){
  c.setLineDash([9,15]);c.beginPath();c.moveTo(h.x,top);c.lineTo(h.x,bottom);c.stroke();c.setLineDash([]);
 }
 const labelY=clamp(y-59,top+18,bottom-8);
 c.fillStyle='#3b2c26e8';c.fillRect(h.x-38,labelY-16,76,22);
 c.fillStyle='#ffdfac';c.font='bold 12px Galmuri';c.textAlign='center';
 c.fillText(h.tracked?'조준 고정':h.railGun!=null?'측면 포격':'포격 예고',h.x,labelY);
}
function paintPortPerimeter(c,rounds){
 const circles=rounds.map(h=>({x:h.x,y:h.y,r:blastContactRadius(h)}));
 c.beginPath();
 for(const {x,y,r} of circles){c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
 c.fillStyle='#b14b372f';c.fill();
 c.beginPath();
 circles.forEach(({x,y,r},i)=>{
  if(circles.slice(0,i).some(p=>p.x===x&&p.y===y&&p.r===r))return;
  const edges=[0,TAU],neighbors=circles.filter(p=>p.x!==x||p.y!==y||p.r!==r);
  for(const p of neighbors){
   const d=Math.hypot(p.x-x,p.y-y);
   if(d>=r+p.r||d<=Math.abs(r-p.r))continue;
   const angle=Math.atan2(p.y-y,p.x-x),half=Math.acos(clamp((d*d+r*r-p.r*p.r)/(2*d*r),-1,1));
   edges.push((angle-half+TAU)%TAU,(angle+half+TAU)%TAU);
  }
  edges.sort((a,b)=>a-b);
  for(let j=1;j<edges.length;j++){
   const start=edges[j-1],end=edges[j],mid=(start+end)/2;
   const px=x+Math.cos(mid)*r,py=y+Math.sin(mid)*r;
   if(neighbors.some(p=>Math.hypot(p.x-px,p.y-py)<p.r))continue;
   c.moveTo(x+Math.cos(start)*r,y+Math.sin(start)*r);c.arc(x,y,r,start,end);
  }
 });
 c.strokeStyle='#39272a';c.lineWidth=6;c.stroke();
 c.strokeStyle='#ffb78c';c.lineWidth=3;c.stroke();
}
export function createRenderer(canvas,art,combatHud={rects:[]}){
 const c=canvas.getContext('2d');let size={w:0,h:0,dpr:1},view={w:960,h:540},terrainCache=null,terrainKey='',siteStates=new Map();
 const conduitTrails=new WeakMap();
 let showcaseLead=0,coastShiftX=0,coastShiftY=0,previousTime=0;
 function resize(){size={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);}
 function draw(s,reduced=false,approach=activeEntry(s)){
  if(size.w!==innerWidth||size.h!==innerHeight)resize();const mobile=size.w<=700;let worldWidth=mobile?520:960;
  const gate=exitGate(s),lead=coastLead(s),aid=portAidCue(s);
  const guns=lead?.coastApproach==='r'&&lead.state==='active'?s.enemies.filter(e=>!e.dead&&e.siteId===lead.id):[];
  const follow=s.boss.active?1:!reduced&&s.operation&&s.stage==='holdout'?Math.max(0,1-s.holdTime/.65)**2:0;
  worldWidth+=(Math.max(worldWidth,Math.abs(s.player.x-s.boss.x)*1.2+300)-worldWidth)*follow;
  const scale=size.w/worldWidth;view={w:worldWidth,h:size.h/scale};
  const rescueLead=mobile&&lead?.opening&&distance(s.player,lead)<300?(lead.x-s.player.x)*.18:0;
  const elapsed=clamp(s.t-previousTime,0,.1);
  if(s.t<previousTime||s.operation?.region>0||follow>0)coastShiftX=coastShiftY=0;
  previousTime=s.t;
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
  const focusX=s.player.x+(s.boss.x-s.player.x)*.35*follow+rescueLead+showcaseLead;
  let focusY=s.player.y+(s.boss.y-s.player.y)*.35*follow;
  // A gate near a boundary needs room beside the objective rail and tactical map.
  const edgeMargin=gate&&s.operation?112*(1-follow):0;
  // Keep northern bosses and their barrels below the portrait HUD.
  const portraitBoss=mobile&&size.h>size.w&&follow>0;
  const bossMargin=portraitBoss?Math.min(235,Math.max(0,Math.min(310,size.h*.38)/scale-s.boss.y))*follow:0;
  // The coast weak point can draw the pilot north of the tank, under the boss HUD.
  const portBoss=s.operation?.region===2&&s.boss.active;
  const pilotLine=portBoss?Math.min(286,size.h*.45):Math.min(260,size.h*.39);
  const pilotMargin=portraitBoss&&s.boss.active&&(portBoss||!(s.operation?.region>0))
   ?Math.max(0,pilotLine/scale-s.player.y):0;
  let framedX=focusX;
  let sightX=0,sightY=0;
  if(mobile&&size.h>size.w&&guns.length){
   const x=Math.min(...guns.map(e=>e.x))-26,y=Math.min(...guns.map(e=>e.y))-49;
   const screenX=size.w/2+(x-focusX)*scale,screenY=size.h/2+(y-focusY)*scale;
   const inRail=screenX<125&&screenY<300;
   if(inRail){
    sightY=clamp((Math.min(246,size.h*.39)-screenY)/scale,0,90);
    sightX=clamp((110-screenX)/scale,0,92);
   }
  }
  const settle=reduced?1:1-Math.exp(-elapsed*16);
  coastShiftX+=(sightX-coastShiftX)*settle;
  coastShiftY+=(sightY-coastShiftY)*settle;
  framedX-=coastShiftX;focusY-=coastShiftY;
  if(mobile&&size.h>size.w&&s.boss.active&&s.operation?.portEntry==='gantry'){
   const b=s.boss,opening=b.cycle===0||b.cycle===1&&b.mode==='salvo';
   const blend=opening?1:b.cycle===1&&b.mode==='recover'?clamp((b.timer-1.95)/.65,0,1):0;
   const mapClear=b.x+Math.max(0,size.w/2-143)/scale;
   framedX-=Math.max(0,focusX-mapClear)*blend;
  }
  const cx=clamp(framedX,view.w/2-edgeMargin,Math.max(view.w/2,1600-view.w/2)+edgeMargin);
  const cy=clamp(focusY,view.h/2-Math.max(bossMargin,pilotMargin),Math.max(view.h/2,1200-view.h/2));
  c.setTransform(size.dpr,0,0,size.dpr,0,0);c.clearRect(0,0,size.w,size.h);c.fillStyle='#263a44';c.fillRect(0,0,size.w,size.h);c.translate(size.w/2,size.h/2);c.scale(scale,scale);c.translate(-cx,-cy);c.imageSmoothingEnabled=false;
  const shake=!reduced&&s.player.hurt>0?Math.sin(s.t*75)*3:0;c.translate(shake,0);
  const index=s.operation?.region||0,key=`${index}:${s.seed}`;
  if(edgeMargin)paintTerrainMargins(c,index,edgeMargin);
  if(canvas.ownerDocument&&key!==terrainKey){terrainKey=key;siteStates.clear();terrainCache=canvas.ownerDocument.createElement('canvas');terrainCache.width=1600;terrainCache.height=1200;const tc=terrainCache.getContext('2d');tc.imageSmoothingEnabled=false;paintTerrain(tc,index,s.seed,art);}
  if(terrainCache)c.drawImage(terrainCache,0,0);else paintTerrain(c,index,s.seed,art);
  const visible=(x,y,padding=48)=>Math.abs(x-cx)<=view.w/2+padding&&Math.abs(y-cy)<=view.h/2+padding;
  for(const b of s.blocks)if(b.hp===0&&visible(b.x,b.y,220))paintBlock(c,b,index,art);
  const gateNear=gate&&distance(gate,s.player)<(s.operation?92:140);
  if(gate&&s.operation){
   if(visible(s.boss.x,s.boss.y,150))paintWreckGround(c,s.boss.x,s.boss.y,index);
   if(visible(gate.x,gate.y,80))paintGateApproach(c,gate,gateNear);
  }
  const raid=s.raid?.state==='active'?s.raid:null;
  const gantry=portGantry(s);
  if(raid)paintEscapeLane(c,raidAhead(raid),RAID_MARKS[raid.contract].color,raid.contract==='light'?[14,9]:[5,9],visible);else if(approach)paintEntryRoutes(c,approach);
  if(gantry){if(!raid)paintEntryRoutes(c,{routes:[gantry]});if(visible(gantry.x,gantry.y))paintPortGantry(c,gantry,art);}
  const chargeLane=coastChargeLane(s);if(chargeLane)paintChargeLane(c,s.boss,chargeLane);
  const entry=s.effects.find(f=>f.type==='region-entry');
  if(entry)paintFrontEntry(c,entry.x,entry.y,index,entry.age,reduced);
  for(const n of s.sites){const previous=siteStates.get(n.id);siteStates.set(n.id,{state:n.state,collected:previous&&previous.state!=='done'&&n.state==='done'?s.t:previous?.collected});}
  for(const n of s.sites)paintSiteGround(c,n,distance(n,s.player)<185,n.state==='active');
  for(const n of s.sites)if(n.kind==='relay'&&n.state==='active'){circle(c,n.x,n.y,125,'#83c5a40b','#c7dfb566',1);c.strokeStyle='#e8d49a';c.lineWidth=2;c.beginPath();c.arc(n.x,n.y,125,-Math.PI/2,-Math.PI/2+n.progress/5*TAU);c.stroke();}
  for(const z of s.zones){
   if(!visible(z.x,z.y,z.r+25))continue;
   if(z.source==='wake'){paintWake(c,z,s.t,reduced);continue;}
   circle(c,z.x,z.y,z.r,'#552f282d','#cb753769',1);circle(c,z.x,z.y,z.r*.75,'#e7a05a30');
   for(let i=0;i<5;i++){const a=i*2.4+z.x,r=z.r*(.25+(i%3)*.22);flame(c,z.x+Math.cos(a)*r,z.y+Math.sin(a)*r,14+(reduced?0:Math.sin(s.t*12+i)*4),s.t*9+i);}
  }
  const reach=pickupReach(s);
  const signal=signalCourier(s);
  if(s.operator==='marco'&&canUseSkill(s))paintFocusSight(c,s);
  for(const f of s.effects)if(f.type==='formation'&&visible(f.x,f.y,48))paintFormationEntry(c,f,reduced);
  if(s.challenge?.state==='active'&&s.challenge.type==='defend'){
   const {x,y,r}=DEFENSE_ZONE,inside=distance(s.player,DEFENSE_ZONE)<=r;
   circle(c,x,y,r,'#a085c023',inside?'#e6c4f2':'#a98ebd',2);
   c.strokeStyle='#f4d1ff';c.lineWidth=4;c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*s.challenge.progress/s.challenge.duration);c.stroke();
   c.fillStyle='#34263b';c.fillRect(x-53,y-11,106,22);c.fillStyle='#f4d1ff';c.font='11px Galmuri';c.textAlign='center';c.fillText('중계기 방어',x,y+4);
  }
  if(signal)paintEscapeLane(c,signalRoute(s),SIGNAL_COLOR,[9,12],visible);
  for(const g of s.gems)if(!g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  if(s.stage==='field'){c.fillStyle='#293c34';c.fillRect(718,326,42,16);c.fillRect(840,326,42,16);c.fillStyle='#d8b471';for(let i=0;i<3;i++){c.fillRect(720+i*13,326,6,16);c.fillRect(842+i*13,326,6,16);}if(distance(s.player,{x:800,y:350})<190){c.fillStyle='#1c302de8';c.fillRect(727,363,146,24);c.fillStyle='#efcf90';c.font='11px Galmuri';c.textAlign='center';c.fillText('보스전 진입',800,379);}}
  const entities=[...s.sites.map(e=>({y:e.y,kind:'site',e})),...s.blocks.filter(e=>e.hp!==0).map(e=>({y:e.y+e.h,kind:'block',e})),...s.enemies.map(e=>({y:e.y,kind:'enemy',e})),{y:s.player.y,kind:'player',e:s.player}];
  if(gate)entities.push({y:gate.y,kind:'gate',e:gate});
  if(signal)entities.push({y:signal.y,kind:'courier',e:signal});
  if(raid)entities.push({y:raid.target.y,kind:'courier',e:raid.target});if(s.boss.active||s.boss.dead||s.stage==='field')entities.push({y:s.boss.y,kind:'boss',e:s.boss});
  for(const item of entities.sort((a,b)=>a.y-b.y)){
   const e=item.e;if(!visible(e.x,e.y,220))continue;c.save();
   if(item.kind==='gate'){if(s.operation)paintGate(c,e,s.holdTime,reduced);else if(art)prop(c,art,2,3,e.x,e.y,112);c.restore();continue;}
   if(item.kind==='site'){paintSite(c,e,s,art,s.t-(siteStates.get(e.id)?.collected??-99));c.restore();continue;}
   if(item.kind==='block'){paintBlock(c,e,index,art);if(e.hp>0&&e.hp<e.maxHp)bar(c,e.x+e.w/2,e.y-34,e.w,e.hp/e.maxHp,'#dfbc78');c.restore();continue;}
   if(item.kind==='enemy'){
    const guard=!e.dead&&e.cohort==='coast-guard'&&index===0&&s.stage==='field';
    if(guard)paintCoastGuard(c,s,e);
    if(e.dead)paintInfantryFall(c,e,reduced);
    else{
     const visibility=e.showcase ? .84 : guard ? (reduced?1:.82) : 0;
     c.globalAlpha=Math.min(1,visibility+e.spawnAge*3);
    }
    circle(c,e.x,e.y,14,'#263b3338');
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
    const burst=s.operator==='marco'&&s.effects.findLast(f=>f.type==='focus-shot'&&f.age<.14),aim=burst?burst.angle:e.aim;
    if(art)actor(c,art.operators,operatorOf(s).row+(Math.sin(aim)<-.6?1:0),e.moving?Math.floor(e.walk)%4:0,e.x+bx,e.y,64,Math.cos(aim)<0);else{c.fillStyle='#edb063';c.fillRect(e.x-13,e.y-44,26,44);}c.filter='none';
    if(e.overdrive>0){c.strokeStyle='#ffce72aa';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-24,35,s.t*3,s.t*3+4.6);c.stroke();}
    const maneuver=activeManeuver(e);if(maneuver){c.fillStyle=maneuver==='brace'?'#f8cf7e':'#9becbe';for(const side of [-1,1])c.fillRect(e.x+side*22-3,e.y+6,6,2);}
   }else if(item.kind==='courier'){
    const armored=e===raid?.target&&raid.contract==='armored',color=e===raid?.target?RAID_MARKS[raid.contract].color:SIGNAL_COLOR;
    if(art&&armored)vehicle(c,art,{x:e.x,y:e.y,width:108,enemy:true,body:e.aim,turret:e.aim,tread:raid.progress,moving:true,damaged:e.hp<e.maxHp*.5,reduced});
    else if(art){c.save();c.translate(e.x,e.y);c.rotate(e.aim);prop(c,art,2,3,0,15,115);c.restore();}
    else{c.fillStyle='#81927c';c.fillRect(e.x-40,e.y-25,80,45);}
    if(armored){
     const front=raidOnNose(s);
     c.strokeStyle=front?'#ffe1a4':color+'ae';c.lineWidth=front?4:2;c.beginPath();c.arc(e.x,e.y,61,e.aim-.75,e.aim+.75);c.stroke();
    }
    bar(c,e.x,e.y-66,100,e.hp/e.maxHp,color);
   }else{
    if(s.operation?.region===1)paintRailBoss(c,e,s);
    else if(art){
     const moving=!e.dead&&e.mode==='charge';
     const tread=moving&&chargeLane?Math.hypot(e.x-chargeLane.x,e.y-chargeLane.y)*2:s.t*80;
     const pitch=chargeLane?(moving?.035:-.025):0;
     vehicle(c,art,{x:e.x,y:e.y,width:s.operation?.region===2?225:185,enemy:true,body:e.body,turret:e.aim,kick:e.kick,tread,moving,pitch,flash:e.dead?0:e.flash,damaged:e.hp<e.maxHp*.5,wreck:e.dead,reduced});
    }
    else{c.save();c.translate(e.x,e.y);c.rotate(e.body);c.fillStyle=e.dead?'#384747':'#667263';c.fillRect(-70,-45,140,90);c.restore();}
    if(e.dead&&gate)paintWreckSmoke(c,e.x,e.y,s.holdTime,reduced);
    if(e.active&&!e.dead)for(const part of e.parts){if(part.hp<=0)continue;const p=partPosition(s,part);circle(c,p.x,p.y,17,'#ffc96024','#ffdc8c',2);bar(c,p.x,p.y-25,35,part.hp/part.maxHp,'#ffcd7e');}
   }if(item.kind!=='enemy'&&item.kind!=='player'&&e.burn>0&&!e.dead){for(let i=-1;i<=1;i++)flame(c,e.x+i*28,e.y-18,24,s.t*11+i);}
   c.restore();
  }
  for(const g of s.gems)if(g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  paintCoastRear(c,s);
  paintPortCue(c,s,aid);
  for(const n of s.sites)if(n!==lead)paintSiteLabel(c,n,s);
  if(gate&&distance(s.player,gate)<220){
   const label=gate.name;
   c.fillStyle='#152a26e8';c.fillRect(gate.x-55,gate.y+72,110,22);
   c.fillStyle=gateNear?'#e0f5c5':'#aac6a7';c.font='11px Galmuri';c.textAlign='center';c.fillText(label,gate.x,gate.y+87);
  }
  for(const q of s.shots){
   if(!visible(q.x,q.y,68))continue;
   const a=Math.atan2(q.vy,q.vx),payload=q.source==='payload';
   c.save();if(payload&&!reduced)paintConduitTrail(c,q,conduitTrails);
   c.translate(q.x,q.y-18);c.rotate(a);
   if(payload){
    c.fillStyle='#43a9ad';c.fillRect(-17,-2,17,4);
    c.fillStyle='#8ce4d7';c.fillRect(-9,-4,16,8);
    c.fillStyle='#effff1';c.fillRect(-4,-2,14,4);
    if(q.relay){c.fillStyle='#b8fff2';c.fillRect(-10,-6,7,2);c.fillRect(-10,4,7,2);}
   }else{
    c.fillStyle=q.rocket?'#f69145':'#ffdd87';c.shadowColor=q.rocket?'#ff984a':'#ffdf9e';c.shadowBlur=reduced?0:7;
    c.fillRect(-q.r*2,-q.r*.7,q.r*3,q.r*1.4);c.fillStyle='#fff3c8';c.fillRect(0,-1,q.r+3,2);
   }
   if(q.breachLane&&q.target===s.boss.parts[0]?.id){
    c.fillStyle='#d6f5ff';c.fillRect(0,-2,q.r+4,4);
   }
   c.restore();
  }
  const latestInferno=s.effects.findLast(f=>f.type==='flame'&&f.evolved);
  for(const f of s.effects){const t=f.age/f.life;c.save();c.globalAlpha=1-t;
   if(f.type==='xp-pickup'){
    const {x,y}=s.player,label=`+${f.value} XP`,rise=reduced?0:Math.max(0,t-.55)*15;
    c.globalAlpha=Math.min(1,(1-t)*2.5);c.textAlign='center';c.font=`bold ${f.salvage?14:12}px Galmuri`;
    c.fillStyle='#142922';c.fillText(label,x+1,y-68-rise+2);
    c.fillStyle=f.salvage?'#ffe3a0':'#c8ead2';c.fillText(label,x,y-68-rise);
   }
   else if(f.type==='boss-down'&&visible(f.x,f.y,150))paintBossImpact(c,f,reduced?0:t,reduced);
   else if(f.type==='charge-impact'&&visible(f.x,f.y,110)){
    c.translate(f.x,f.y);c.rotate(f.angle);
    c.fillStyle=f.crushed?'#dca171':'#b2ac89';
    for(let i=0;i<8;i++){
     const spread=(i-3.5)*12,travel=reduced?12:t*(34+i%3*10);
     c.fillRect(-travel+Math.abs(spread)*.27,spread*(.5+t*.6),6+i%4,3+i%3);
    }
   }
   else if(f.type==='mortar-fire'&&visible(f.x,f.y)){
    circle(c,f.x,f.y-26,reduced?4:4+t*11,'#9d82676e','#e9c18a',1);
    if(!reduced){c.fillStyle='#f6db9e';c.fillRect(f.x-2,f.y-29,4,6);}
   }
   else if(f.type==='barrage'){c.fillStyle=reduced?'#df985325':'#ffd39345';c.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);for(let y=f.y-f.h/2;y<f.y+f.h/2;y+=80)circle(c,f.x,y,20+t*30,'#f3ae6944','#ffcc87',2);}
   else if(f.type==='explosion'||f.type==='break'||f.type==='shrapnel'){const r=(f.r||80)*(.35+t*.7);circle(c,f.x,f.y,r,'#ec963b30','#ffd384',2);circle(c,f.x,f.y,r*.45,'#ffe0a178');for(let i=0;i<7;i++){const a=i*TAU/7;c.fillStyle='#efbd76';c.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,4,4);}}
   else if(f.type==='overheat'||f.type==='heat'&&f.text){if(visible(f.x,f.y))paintArmorHeat(c,f,reduced?0:t);}
   else if(f.type==='heat'){if(visible(f.x,f.y,f.r??100))paintHeatImpulse(c,f,t,reduced);}
   else if(f.type==='raid-success'){const color=({common:'#ffe0a1',rare:'#90e0da',prototype:'#dcafff'})[f.quality];circle(c,f.x,f.y,25+t*110,null,color,4);for(let i=0;i<10;i++){const a=i*TAU/10;c.fillStyle=color;c.fillRect(f.x+Math.cos(a)*t*120,f.y+Math.sin(a)*t*75-20,4,8);}}
   else if(f.type==='armor-impact'){
    c.strokeStyle='#ffe6b5';c.lineWidth=2;c.beginPath();
    for(const spread of [-.65,0,.65]){
     const a=f.angle+spread,r=8+t*17;
     c.moveTo(f.x,f.y);c.lineTo(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r);
    }
    c.stroke();
   }
   else if(f.type==='focus-shot')paintFocusShot(c,f,t,reduced);
   else if(f.type==='payload'&&visible(f.x,f.y)){c.fillStyle='#bcf9e9';c.fillRect(f.x-7,f.y-18,14,3);c.fillRect(f.x-2,f.y-23,4,13);}
   else if(f.type==='payload-relay'||f.type==='fire-spread'){
    if(visible(f.x,f.y,100)||visible(f.x2,f.y2,60))paintTransfer(c,f,t,reduced);
   }
   else if(f.type==='payload-impact'){
    if(visible(f.x,f.y,f.r+25))paintConduitImpact(c,f,t,reduced);
   }
   else if(f.type==='salvo-impact'||f.type==='aid-counter'){
    const aid=f.type==='aid-counter',r=(aid?68:f.r)*(.4+t*.65),edge=aid?'#d7f0b8':'#ffe49a';
    circle(c,f.x,f.y,r,aid?'#b2d59928':'#ff913b32',edge,3);
    circle(c,f.x,f.y,r*.48,null,edge,2);
    if(!reduced)for(let i=0;i<8;i++){const a=i*TAU/8;circle(c,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,5,edge);}
   }
   else if(f.type==='pierce'){c.translate(f.x,f.y-18);c.rotate(f.angle);c.fillStyle='#fff2ae';c.fillRect(-12,-2,34+t*24,4);}
   else if(f.type==='lightning'||f.type==='ricochet'){c.strokeStyle=f.type==='lightning'?'#a1f5ef':'#f8dc8f';c.lineWidth=f.type==='lightning'?3:1.5;c.beginPath();c.moveTo(f.x,f.y);c.lineTo((f.x+f.x2)/2+Math.sin(s.t*40)*10,(f.y+f.y2)/2);c.lineTo(f.x2,f.y2);c.stroke();}
   else if(f.type==='flame'&&f.evolved){
    if(f===latestInferno&&visible(f.x,f.y,f.r+25))paintInferno(c,f,t,reduced);
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
  if(chargeLane)paintChargeLane(c,s.boss,chargeLane,true);
  for(const q of s.enemyShots)if(visible(q.x,q.y))circle(c,q.x,q.y-18,6,'#b0422c','#ffe1a1',2);
  const portRounds=s.hazards.filter(h=>h.portRound&&!h.hit&&visible(h.x,h.y,blastContactRadius(h)));
  if(portRounds.length)paintPortPerimeter(c,portRounds);
  for(const h of s.hazards){
   const wide=h.portRound||h.coastMortar;
   if(h.hit||!visible(h.x,h.lane?s.player.y:h.y,h.lane?h.w:wide?blastContactRadius(h):h.r))continue;
   if(h.lane){paintRailWarning(c,h,s.player.y);continue;}
   if(h.coastMortar){
    if(!reduced&&Number.isFinite(h.fromX)&&Number.isFinite(h.fromY))paintCoastMortarFlight(c,h);
   }
   if(!h.portRound){
    if(h.coastMortar)circle(c,h.x,h.y,blastContactRadius(h),null,'#ffc09c80',2);
    circle(c,h.x,h.y,h.r,'#d83d4120','#321e25',6);
    circle(c,h.x,h.y,h.r,null,'#ffada0',3);
   }
   circle(c,h.x,h.y,(h.portRound?24:h.r)*clamp(1-h.timer/(h.duration||.9),0,1),null,'#fff0bb',h.timer<.25?3:1);
   if(h.portRound==='rake'){
    c.strokeStyle='#ffd1a4';c.lineWidth=2;c.beginPath();
    for(const side of [-1,1]){
     const x=h.x+side*(h.r-10);
     c.moveTo(x,h.y-9);c.lineTo(x+side*5,h.y);c.lineTo(x,h.y+9);
    }
    c.stroke();
   }
   if(h.portRound==='lock'){
    c.strokeStyle='#ffe1bc';c.lineWidth=3;c.beginPath();
    for(let i=0;i<4;i++){
     const a=i*Math.PI/2,x=Math.cos(a),y=Math.sin(a);
     c.moveTo(h.x+x*10,h.y+y*10);c.lineTo(h.x+x*23,h.y+y*23);
    }
    c.stroke();
   }
  }
  if(portBoss&&art&&s.player.y<s.boss.y&&s.boss.y-s.player.y<145&&Math.abs(s.player.x-s.boss.x)<97){
   const {x,y}=s.player;
   circle(c,x,y,16,null,'#182a2c',6);
   circle(c,x,y,16,null,'#d8e9b8',2);
   c.strokeStyle='#d8e9b8';c.lineWidth=3;
   c.beginPath();c.moveTo(x-6,y-27);c.lineTo(x,y-21);c.lineTo(x+6,y-27);c.stroke();
  }
  c.setTransform(size.dpr,0,0,size.dpr,0,0);const vignette=c.createRadialGradient(size.w/2,size.h/2,size.h*.2,size.w/2,size.h/2,size.w*.75);vignette.addColorStop(0,'#12232c00');vignette.addColorStop(1,'#12232c65');c.fillStyle=vignette;c.fillRect(0,0,size.w,size.h);
  if(lead)paintCoastCue(c,s,lead,guns,size,cx,cy,scale);
  if(mobile&&aid)paintAidBearing(c,s,aid,size,cx,cy,scale,combatHud.rects);
 }
 return{draw,view:()=>view,resize};
}
