import {paintTerrain,paintTerrainMargins,paintNorthBoundary,paintCoastOpening,paintBlock,paintCoverShadow,coverMasksPilot,paintLandmark,paintSiteGround,paintSite,paintSiteLabel,paintGate,paintGateApproach,paintWreckGround,paintWreckSmoke,paintFrontEntry,paintEntryRoutes,paintEntrySigns,paintPortGantry} from './field-art.js';
import {fieldScene} from './field-scene.js';
import {exitGate,BOSS_ENTRY,coastStagingPoint,portPartStaging,portCoreWindow,portCoreDisrupted,portCoreReach,portCrossfireCuts,portCrossfireZone,PORT_SUPPORT,portFlankPoint,portArmorExposed,portTurretShutter,portGantry,portGantryBypass,portTurretSide,portWakePoint,portWakeBreach,portWakeMode,portAidCue,portAidCounterTarget,portAidCounterRound,portEscapeLanes,railGunOf,railLaneLabel,COAST_MORTAR,orderTarget,coastFork,coastLead,coastLeadColor,coastEncounterCue,coastShieldImpact,coastMortarAiming,coastMortarThreatens,activeEntry,railBossGuide,railLaneBounds} from './campaign.js';
import {actor,prop,vehicle} from '../mission/art.js';
import {INFERNO_CORE_DISTANCE,distance,blastContactRadius,clamp,coastFanAngle,isCapturedTurret} from './content.js';
import {activeManeuver,partPosition,pickupReach,portTurretInSight,portArmorLine,harborArcTarget,harborSignalLine,coastRocketVolley,coastRocketCounter,coastSignalPlan,coastFlameLine,emberChargeCue,infernoWakeLinks,conduitMortarCue,railFanCutCue} from './model.js';
import {DEFENSE_ZONE,relayDefenseRound,SIGNAL_COLOR,SIGNAL_CARGO_REACH,signalRoute,signalCourier,signalCargo,RAIL_GUN_COLORS,railGunLabel,bracingCoastEscort,shieldFaces,SHIELD_HALF_ANGLE} from './campaign.js';
import {RAID_MARKS,raidAhead,raidOnNose} from './raid.js';
import {COAST_CHARGE,coastChargeLane} from './coast-charge.js';
import {operatorOf,focusLane,canUseSkill} from './operator.js';
import {COAST_SALVAGE,coastSalvage,coastRoleTarget,coastTurretLane,coastSalvageWreck} from './coast-salvage.js';
const TAU=Math.PI*2;
const FORMATION_INK={flame:'#f1b477',fusion:'#abe5d7',rocket:'#edd3a3'};
function circle(c,x,y,r,fill,stroke=null,width=1){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const relaySet={x:DEFENSE_ZONE.x,y:DEFENSE_ZONE.y-13};
function paintRelayGround(c,s,round){
 const {x,y,r}=DEFENSE_ZONE;
 const connected=distance(s.player,DEFENSE_ZONE)<=r&&(!round||distance(s.player,round)>=blastContactRadius(round));
 c.save();c.setLineDash([10,7]);
 circle(c,x,y,r,'#a9ba9011','#c9d6a78c',2);
 c.setLineDash([]);c.lineWidth=4;c.strokeStyle=connected?'#deedbb':'#b7be99';
 c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*s.challenge.progress/s.challenge.duration);c.stroke();
 c.strokeStyle='#c9c49b90';c.lineWidth=3;
 c.beginPath();c.moveTo(x-40,y+5);c.lineTo(x-40,y+16);c.lineTo(x-26,y+16);
 c.moveTo(x+40,y+5);c.lineTo(x+40,y+16);c.lineTo(x+26,y+16);c.stroke();c.restore();
}
function paintFocusSight(c,s,plan){
 const p=s.player,lane=plan?.lane||focusLane(s),end=plan?lane.length:Math.min(118,lane.length);
 if(!plan&&end<24)return;
 c.save();c.translate(p.x,p.y);c.rotate(lane.angle);
 if(plan){
  c.fillStyle='#f2ce931c';c.fillRect(0,-lane.width,end,lane.width*2);
  c.strokeStyle='#e4c396';c.lineWidth=2;c.setLineDash([7,8]);
  c.beginPath();c.moveTo(0,-lane.width);c.lineTo(end,-lane.width);c.moveTo(0,lane.width);c.lineTo(end,lane.width);c.stroke();c.setLineDash([]);
  c.strokeStyle=lane.blocked?'#fff0c6':'#bdab8c';c.lineWidth=lane.blocked?3:1;
  c.beginPath();c.moveTo(end,-lane.width-3);c.lineTo(end,lane.width+3);c.stroke();
  c.restore();return;
 }
 c.strokeStyle='#efd09b';c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();c.moveTo(22,0);c.lineTo(end-3,0);c.stroke();c.setLineDash([]);
 c.beginPath();c.moveTo(end-12,-6);c.lineTo(end,0);c.lineTo(end-12,6);c.stroke();c.restore();
}
function paintFocusTargets(c,plan,visible){
 for(const {enemy,point,weak,roleWeak} of plan.impacts){
  if(!visible(point.x,point.y,36))continue;
  const x=point.x,y=point.y-13,r=clamp(enemy.r+4,19,38);
  c.save();c.strokeStyle=weak||roleWeak?'#ffe09e':'#d5ebc7';c.lineWidth=weak||roleWeak?3:2;c.beginPath();
  for(const side of [-1,1]){
   c.moveTo(x+side*r,y-8);c.lineTo(x+side*r,y+8);
   c.moveTo(x+side*r,y-8);c.lineTo(x+side*(r-6),y-8);
   c.moveTo(x+side*r,y+8);c.lineTo(x+side*(r-6),y+8);
  }
  c.stroke();c.restore();
 }
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
function paintStaging(c,s,point){
 const {x,y,color,name}=point;
 c.save();
 c.fillStyle='#293c34';
 for(const side of [-1,1]){
  const left=x+side*46-18;
  c.fillRect(left,y-6,36,12);
  c.fillStyle=color;
  for(let i=0;i<3;i++)c.fillRect(left+3+i*11,y-6,5,12);
  c.fillStyle='#293c34';
 }
 if(distance(s.player,point)<190){
  c.font='11px Galmuri';c.textAlign='center';
  const width=c.measureText(name).width+24;
  c.fillRect(x-width/2,y+15,width,22);
  c.fillStyle=color;c.fillText(name,x,y+30);
 }
 c.restore();
}
function paintCoastRear(c,s){
 const b=s.boss;
 if(s.operation?.region>0||!b.active||b.dead||b.mode!=='recover')return;
 const rear=b.body+Math.PI,half=Math.acos(-COAST_CHARGE.rearDot),reach=b.r+13,ready=coastFlameLine(s)==='ready';
 const x=b.x+Math.cos(rear)*reach,y=b.y+Math.sin(rear)*reach;
 c.save();
 c.beginPath();c.arc(b.x,b.y,reach,rear-half,rear+half);c.strokeStyle='#513425';c.lineWidth=6;c.stroke();
 c.strokeStyle=ready?'#ffdf9e':'#f9bc74';c.lineWidth=ready?4:3;c.stroke();
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
function paintCoastCue(c,s,site,guns,volley,counter,size,cx,cy,scale,hud,opening=false){
 const prefix=site.coastApproach?.toUpperCase();
 const name=site.opening?'포로 구출':site.name;
 const screen=coastShieldImpact(s,site);
 const escaping=counter?.state==='escape';
 const reply=site.state==='active'&&s.effects.findLast(f=>f.coastCounter===site.id);
 const target=screen||(escaping?s.player:null)||reply||guns.find(e=>coastMortarAiming(s,e))||volley||guns.reduce((near,e)=>!near||distance(e,s.player)<distance(near,s.player)?e:near,null)||site;
 const targetX=size.w/2+(target.x-cx)*scale;
 const targetY=size.h/2+(target.y-cy)*scale;
 const mobile=size.w<=700;
 const color=coastLeadColor(site);
 const point={x:targetX,y:targetY};
 const warnings=s.hazards.filter(h=>!h.hit&&h.coastMortar).map(h=>{
  const x=size.w/2+(h.x-cx)*scale,y=size.h/2+(h.y-cy)*scale,r=blastContactRadius(h)*scale;
  return {left:x-r,right:x+r,top:y-r,bottom:y+r};
 });
 if(mobile&&site.state==='active'&&site.coastApproach&&s.raid?.state!=='active'&&!orderTarget(s)){
  if(coastMortarThreatens(s,site))return;
  const spot=coastCuePosition(size,point,18,hud,warnings,40,8);
  if(!spot)return;
  const {x,y}=spot;
  c.save();c.translate(x,y);c.rotate(Math.atan2(targetY-y,targetX-x));
  c.beginPath();c.moveTo(-5,-5);c.lineTo(0,0);c.lineTo(-5,5);
  c.strokeStyle='#192b29';c.lineWidth=6;c.stroke();
  c.strokeStyle=color;c.lineWidth=2;c.stroke();
  c.restore();return;
 }
 c.save();
 const label=screen?'방패 옆으로':escaping?'옆으로 이동':reply?'반격탄':coastEncounterCue(s,site,volley,counter)||(site.state==='ready'&&site.opening?'접근해 구출':prefix?`${prefix} · ${name}`:name);
 c.font='bold 11px Galmuri, sans-serif';
 const width=Math.min(size.w-16,Math.ceil(c.measureText(label).width)+32);
 const lift=Math.max(46,76*scale);
 const spot=opening&&site.opening?clearBearingPosition(size,{x:targetX,y:targetY-lift},width,[...hud,...warnings],13)
  :coastCuePosition(size,point,width,hud,warnings,lift);
 if(!spot){c.restore();return;}
 const {x,y}=spot;
 c.fillStyle='#152a28f2';
 c.fillRect(x-width/2,y-13,width,26);
 c.strokeStyle=color;
 c.lineWidth=1;
 c.strokeRect(x-width/2+.5,y-12.5,width-1,25);
 c.fillStyle=color;
 c.textAlign='left';
 c.textBaseline='middle';
 c.fillText(label,x-width/2+23,y+1,width-28);
 const bounds={left:x-width/2,right:x+width/2,top:y-13,bottom:y+13};
 if(site.coastApproach==='r'&&coastMortarThreatens(s,site)){
  c.fillRect(x-width/2+11,y-5,2,6);
  c.fillRect(x-width/2+11,y+3,2,2);
  c.restore();return bounds;
 }
 c.translate(x-width/2+12,y);
 c.rotate(Math.atan2(targetY-y,targetX-x));
 c.beginPath();
 c.moveTo(5,0);c.lineTo(-4,-4);c.lineTo(-2,0);c.lineTo(-4,4);c.closePath();c.fill();
 c.restore();return bounds;
}
function paintCoastVolley(c,volley){
 const {x,y,state}=volley,aligned=state==='ready'||state==='inflight';
 c.save();c.translate(x,y);
 circle(c,0,0,13,aligned?'#26443e':'#38443d','#28342d',5);
 circle(c,0,0,13,null,aligned?'#c4f6da':'#a5c6b0',2);
 c.fillStyle=aligned?'#c4f6da':'#a5c6b0';
 c.fillRect(-18,-1,9,2);c.fillRect(9,-1,9,2);
 if(aligned)c.fillRect(-2,-2,4,4);
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
function paintCoastShieldBrace(c,e,pilot){
 const exposed=!shieldFaces(e,pilot),color=exposed?'#c7ead2':'#ffc077',radius=e.r+9;
 c.save();c.translate(e.x,e.y);
 c.beginPath();c.arc(0,0,radius,e.aim-SHIELD_HALF_ANGLE,e.aim+SHIELD_HALF_ANGLE);
 c.strokeStyle='#302a22';c.lineWidth=8;c.stroke();
 c.strokeStyle='#e5a45e';c.lineWidth=3;c.stroke();
 for(const side of [-1,1]){
  c.save();c.rotate(e.aim+side*Math.PI/2);c.translate(radius+9,0);
  c.beginPath();c.moveTo(-3,-6);c.lineTo(3,0);c.lineTo(-3,6);
  c.strokeStyle='#21352e';c.lineWidth=7;c.stroke();
  c.strokeStyle=color;c.lineWidth=3;c.stroke();
  c.restore();
 }
 c.restore();
}
function paintCoastMortarFlight(c,h){
 const t=clamp(1-h.timer/(h.duration??COAST_MORTAR.warning),0,1);
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
const relayContactLife=.62,fireSpreadContactLife=.58;
function touchesCircle({x,y,r},box){
 const dx=x-clamp(x,box.left,box.right),dy=y-clamp(y,box.top,box.bottom);
 return dx*dx+dy*dy<r*r;
}
export function coveredCombatPanels(s,panels,project,scale){
 if(!panels.length)return [];
 const circles=[],formations=[],lanes=[];
 const mark=(x,y,r)=>circles.push({...project(x,y),r:r*scale});
 for(const f of s.effects){
  if(f.relayArrival&&f.contact&&f.age<f.life*relayContactLife)mark(f.contact.x,f.contact.y-7,21);
  else if(f.type==='fire-spread'&&f.age<f.life*fireSpreadContactLife)mark(f.x2,f.y2-4,13);
  else if(f.type==='kill'&&f.wake&&f.age<f.life*.52)mark(f.x,f.y-3,13);
  else if(f.type==='wake-flash'&&f.age<f.life*.65){mark(f.x,f.y,f.r);mark(f.x2,f.y2,f.r);}
  else if(f.type==='rail-fan-sweep'&&f.age<f.life*.6){mark(f.x,f.y-3,17);mark(f.x2,f.y2-3,17);}
  else if(f.type==='formation'&&f.age<.4)formations.push({...project(f.x,f.y),r:28*scale});
 }
 for(const h of s.hazards){
  if(h.hit||h.timer<=0)continue;
  if(h.lane){
   const {left,top,right,bottom}=railLaneBounds(h),start=project(left,top),end=project(right,bottom);
   lanes.push({left:start.x,top:start.y,right:end.x,bottom:end.y});
  }else mark(h.x,h.y,blastContactRadius(h));
 }
 return panels.filter(({id,rect})=>(id!=='field-objective'||s.stage==='field')&&
  (circles.some(circle=>touchesCircle(circle,rect))||id==='weapons'&&formations.some(formation=>touchesCircle(formation,rect))||lanes.some(lane=>
   lane.left<rect.right&&lane.right>rect.left&&lane.top<rect.bottom&&lane.bottom>rect.top))).map(({id})=>id);
}
const bearingObscured=(size,{x,y},r,hud)=>x<r||x>size.w-r||y<r||y>size.h-r||hud.some(box=>overlapsBox(x,y,r,r,box));
function clearBearingPosition(size,target,width,blocked,hh){
 const {x,y}=target;
 const hw=width/2,margin=8;
 const minX=hw+margin,maxX=size.w-hw-margin,minY=hh+margin,maxY=size.h-hh-margin;
 if(minX>maxX||minY>maxY)return null;
 const xs=[clamp(x,minX,maxX)],ys=[clamp(y,minY,maxY)];
 if(!blocked.some(box=>overlapsBox(xs[0],ys[0],hw,hh,box)))return {x:xs[0],y:ys[0]};
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
export function coastCuePosition(size,target,width,hud,warnings,lift,halfHeight=13){
 const anchor=bearingObscured(size,target,12,hud)?target:{x:target.x,y:target.y-lift};
 return clearBearingPosition(size,anchor,width,[...hud,...warnings],halfHeight);
}
export function aidBearingPosition(size,target,radius,width,hud,warnings){
 return bearingObscured(size,target,radius,hud)?clearBearingPosition(size,target,width,[...hud,...warnings],12):null;
}
function paintAidBearing(c,s,aid,size,cx,cy,scale,hud){
 const screen=point=>({x:size.w/2+(point.x-cx)*scale,y:size.h/2+(point.y-cy)*scale});
 const target=screen(aid.point),radius=Math.max(14,27*scale);
 if(!bearingObscured(size,target,radius,hud))return;
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
function paintPortFlank(c,b,side,label,color){
 const {x,y}=portFlankPoint(b,side);
 c.strokeStyle=color;c.lineWidth=3;
 c.beginPath();c.moveTo(x+side*12,y-12);c.lineTo(x,y);c.lineTo(x+side*12,y+12);c.stroke();
 c.font='bold 11px Galmuri, sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#223033';
 c.strokeText(label,x,y+26);c.fillStyle=color;c.fillText(label,x,y+26);
}
function paintPortCue(c,s,aid){
 const b=s.boss;
 if(s.operation?.region!==2||!b.active||b.dead)return;
 c.save();
 const turret=b.parts[0],flank=portTurretInSight(s);
 const crossfire=portCrossfireZone(s);
 if(crossfire&&!portCrossfireCuts(s,b.mode==='salvo'?b.cycle:b.cycle+1)){
  const {x,y,halfWidth:w,halfDepth:h,ready}=crossfire;
  const color=ready?'#ffe4a4':'#c8ad7e';
  c.strokeStyle=color;c.lineWidth=ready?3:2;c.fillStyle=ready?'#ecd89139':'#1e2e287d';
  c.fillRect(x-w,y-h,2*w,2*h);
  c.setLineDash(ready?[]:[5,4]);c.strokeRect(x-w,y-h,2*w,2*h);c.setLineDash([]);
  c.beginPath();c.moveTo(x-7,y+3);c.lineTo(x,y-4);c.lineTo(x+7,y+3);c.stroke();
  if(b.mode==='recover')for(const part of b.parts){
   const point=partPosition(s,part);
   circle(c,point.x,point.y,part.r+3,null,color,2);
  }
 }
 if(portTurretShutter(s)&&!flank){
  const p=partPosition(s,turret);
  circle(c,p.x,p.y,27,'#b580453d','#edb272',3);
 }
 if(portGantryBypass(s)){
  const p=partPosition(s,turret);
  c.setLineDash([7,5]);circle(c,p.x,p.y,30,null,'#b6e1c5',2);c.setLineDash([]);
 }
 if(s.operation.support==='breach'&&turret?.hp>0){
  paintPortFlank(c,b,portTurretSide(b),'포탑',flank?'#d1f7ff':'#a9d6e9');
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
 }
 if(portArmorExposed(s)){
  const lane=portArmorLine(s),side=-portTurretSide(b);
  const prepared=b.mode!=='recover'&&b.armorSuppressedCycle===(b.mode==='aim'?b.cycle+1:b.cycle);
  const color=prepared?'#d7edb4':lane==='ready'?'#fff1c5':lane?'#f0cc9c':'#c4b491';
  paintPortFlank(c,b,side,prepared?'급탄 차단':'보조포',color);
  if(lane||prepared){
   const p=partPosition(s,b.parts[1]);
   if(lane!=='ready')c.setLineDash([5,4]);
   circle(c,p.x,p.y,28,null,color,2.5);c.setLineDash([]);
  }
 }else if(portCoreWindow(s)){
  const reach=portCoreReach(s),p=s.player;
  c.setLineDash([9,7]);circle(c,b.x,b.y,reach,null,'#ffc889b8',2);
  if(reach===PORT_SUPPORT.overrun.focusedReach)circle(c,b.x,b.y,INFERNO_CORE_DISTANCE,null,'#ffc88970',1.5);
  c.setLineDash([]);
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
 const signal=harborSignalLine(s),relay=signal?.target||harborArcTarget(s);
 if(relay){
  const p=partPosition(s,relay),color=signal?.state==='ready'?'#bcf5ff':'#a6edf9';
  if(signal?.state!=='ready')c.setLineDash([5,4]);circle(c,p.x,p.y,relay.r+5,null,color,2);c.setLineDash([]);
  c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();
  c.moveTo(p.x+3,p.y-45);c.lineTo(p.x-4,p.y-38);c.lineTo(p.x+3,p.y-38);c.lineTo(p.x-2,p.y-31);c.stroke();
  if(signal?.state==='ready'){
   const b=s.boss;c.strokeStyle='#87dce788';c.lineWidth=2;c.setLineDash([4,6]);
   c.beginPath();c.moveTo(b.x,b.y);c.lineTo(p.x,p.y);c.stroke();c.setLineDash([]);
  }
 }
 const counterTarget=portAidCounterTarget(s);
 if(counterTarget){
  const p=counterTarget===b?b:partPosition(s,counterTarget),r=counterTarget.r+5;
  c.setLineDash([5,4]);circle(c,p.x,p.y,r,null,'#d7f0b8',2);c.setLineDash([]);
  c.fillStyle='#d7f0b8';c.fillRect(p.x-9,p.y-r-3,18,3);c.fillRect(p.x-2,p.y-r-10,4,10);
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
function paintPortWakeCue(c,s){
 const b=s.boss;
 if(s.operation?.region!==2||!b.active||b.dead||s.operation.tactic!=='wake'&&!portWakeBreach(s))return;
 const {x,y,r}=portWakePoint(b),ready=!!portWakeMode(s);
 c.save();
 const color=ready?'#ffd6a3':'#ad9d7e';
 if(ready){
  circle(c,x,y,26,'#2d241cc2','#292322',6);
  c.setLineDash([6,5]);circle(c,x,y,26,null,color,2.5);c.setLineDash([]);
 }
 c.fillStyle='#283238';c.fillRect(x-r-4,y-10,2*r+8,20);
 c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x-r-4,y-10,2*r+8,20);
 c.fillStyle=color;
 for(const dx of [-7,0,7])c.fillRect(x+dx-1,y-5,2,10);
 c.restore();
}
function flame(c,x,y,height,phase){
 const sway=Math.sin(phase)*height*.14;c.fillStyle='#df562cc0';c.beginPath();c.moveTo(x-height*.25,y);c.lineTo(x-height*.3,y-height*.42);c.lineTo(x+sway,y-height);c.lineTo(x+height*.12,y-height*.36);c.lineTo(x+height*.29,y-height*.56);c.lineTo(x+height*.22,y);c.closePath();c.fill();c.fillStyle='#ffcf7edc';c.beginPath();c.moveTo(x-height*.12,y);c.lineTo(x+sway*.5,y-height*.6);c.lineTo(x+height*.13,y);c.fill();
}
function paintInferno(c,f,t,reduced){
 const reach=f.coreDistance||f.r*(reduced?.91:.87+t*.12);
 const spread=Math.min(f.coreDistance?22:f.focused?41:70,Math.tan(f.cone*Math.PI/360)*reach*.73);
 const swell=reduced?0:Math.sin(t*Math.PI*2)*spread*.13;
 c.translate(f.x,f.y-18);c.rotate(f.angle);
 if(f.focused&&!f.coreDistance){
  const half=f.cone*Math.PI/360;
  const heat=c.createRadialGradient(0,0,0,0,0,f.r);
  heat.addColorStop(0,'#c8744932');heat.addColorStop(.78,'#c8744924');heat.addColorStop(1,'#c8744908');
  c.fillStyle=heat;c.beginPath();c.moveTo(0,0);c.arc(0,0,f.r,-half,half);c.closePath();c.fill();
 }
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
 if(f.coreDistance){c.fillStyle='#fff0ba';c.fillRect(reach-13,-3,22,6);c.fillRect(reach-4,-10,4,20);}
 if(!reduced)for(let i=0;i<5;i++){
  const x=reach*(.64+i*.07),y=spread*(i%2?.53:-.63)+swell;
  c.fillStyle=i%2?'#efb065':'#9e5234';c.fillRect(x,y,4+i%3,3);
 }
}
function paintEmberCharge(c,s,z){
 const {armed,hostiles,railTarget,rollInReach}=emberChargeCue(s,z);
 const contact=hostiles>0||railTarget,ready=rollInReach&&s.player.dashCd<=0;
 c.save();c.setLineDash([6,7]);
 circle(c,z.x,z.y,z.r,'#40342828',contact?'#ffcc86c7':armed?'#a5d9a7ad':'#b2b3a470',contact?3:2);
 c.setLineDash([]);
 c.fillStyle='#2e3531';c.fillRect(z.x-13,z.y-7,26,14);
 c.strokeStyle='#89ae98';c.strokeRect(z.x-13.5,z.y-7.5,27,15);
 for(const [i,dx] of [-6,6].entries()){
  c.fillStyle=armed&&(hostiles>i||railTarget&&i===0)?'#ffca79':'#aaa190';
  c.fillRect(z.x+dx-3,z.y-3,6,6);
 }
 if(ready){
  c.strokeStyle='#ffe0a2';c.lineWidth=3;c.beginPath();
  c.moveTo(z.x-7,z.y-17);c.lineTo(z.x,z.y-11);c.lineTo(z.x+7,z.y-17);c.stroke();
 }
 c.restore();
}
function paintWake(c,z,time,reduced){
 c.save();c.globalAlpha=Math.min(1,z.life/.42);
 circle(c,z.x,z.y,z.r,'#6e342a49','#d5814b68',1.5);
 for(let i=0;i<6;i++){
  const a=i*2.4+z.x,r=z.r*(.35+(i%3)*.22),x=z.x+Math.cos(a)*r,y=z.y+Math.sin(a)*r;
  c.fillStyle='#3e2c2699';c.fillRect(x-6,y-2,12,4);
  c.fillStyle=i%2?'#e08b49':'#a75530';c.fillRect(x-2,y-2,4,2);
  if(!reduced&&i%2===0)flame(c,x,y,12+Math.sin(time*9+i)*3,time*8+i);
 }
 c.restore();
}
function paintWakeLink(c,a,b){
 c.save();c.strokeStyle='#e2a369a8';c.lineWidth=3;c.setLineDash([6,6]);
 c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.restore();
}
function paintWakeFlash(c,f,t,reduced){
 c.strokeStyle='#ffcb82';c.lineWidth=reduced?3:4;
 c.beginPath();c.moveTo(f.x,f.y);c.lineTo(f.x2,f.y2);c.stroke();
 for(const [x,y] of [[f.x,f.y],[f.x2,f.y2]]){
  circle(c,x,y,f.r,'#d87b3022','#ffd392',2);
  if(!reduced)for(const offset of [-20,0,20])flame(c,x+offset,y-7,20*(1-t)+7,offset+t*8);
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
 const embers=f.incendiary||f.type==='ember-burst';
 if(f.relayArrival&&f.contact&&t<relayContactLife){
  const {x,y}=f.contact,radius=reduced?15:12+t*13;
  c.strokeStyle='#d1fff4';c.lineWidth=2;c.beginPath();
  for(const side of [-1,1]){
   c.moveTo(x+side*(radius-5),y-11);
   c.lineTo(x+side*radius,y-11);
   c.lineTo(x+side*radius,y-3);
  }
  c.stroke();
 }
 c.translate(f.x,f.y-12);
 c.strokeStyle=embers?'#dfad63':'#82c9bd';c.lineWidth=2;
 for(let i=0;i<3;i++){
  const a=i*TAU/3+.15;
  c.beginPath();c.ellipse(0,12,reach,reach*.42,0,a,a+1.12);c.stroke();
 }
 if(t<.45){c.fillStyle=embers?'#fff2bc':'#dcfff4';c.fillRect(-10,-2,20,4);c.fillRect(-2,-10,4,20);}
 if(reduced||t>.68)return;
 c.strokeStyle=embers?'#f3cc91':'#bcf7ed';c.lineWidth=3;c.beginPath();
 for(let i=0;i<5;i++){
  const a=i*TAU/5+.3,x=Math.cos(a)*reach,y=Math.sin(a)*reach*.66;
  c.moveTo(x*.28,y*.28);c.lineTo(x*.55-y*.22,y*.55+x*.16);c.lineTo(x,y);
 }
 c.stroke();
}
function paintEmberBurst(c,f,t,reduced){
 const r=f.r*(reduced?.72:.27+t*.76);
 c.save();c.translate(f.x,f.y);
 c.globalAlpha=(1-t)*.82;
 circle(c,0,0,r,'#a54f3036','#e9955e',3);
 if(!reduced){
  for(let i=0;i<8;i++){
   const a=i*TAU/8+.18,reach=r*(.5+i%3*.14),x=Math.cos(a)*reach,y=Math.sin(a)*reach;
   c.fillStyle=i%2?'#ec8a42':'#b14d31';
   c.beginPath();c.moveTo(x-7,y);c.lineTo(x-3,y-12-t*9);c.lineTo(x+5,y-7);c.lineTo(x+7,y+2);c.closePath();c.fill();
   if(t<.45){c.fillStyle='#ffe4a1';c.fillRect(x-2,y-4,4,4);}
  }
 }
 c.restore();
}
function paintTransfer(c,f,t,reduced){
 const dx=f.x2-f.x,dy=f.y2-f.y;
 if(f.type==='payload-relay'){
  if(f.thirdPack&&t<.55){
   c.strokeStyle='#b8fff2';c.lineWidth=2;c.beginPath();
   for(const side of [-1,1]){
    const x=f.x2+side*19,y=f.y2-6;
    c.moveTo(x-side*7,y-8);c.lineTo(x,y-8);c.lineTo(x,y+4);
   }
   c.stroke();
  }
  c.translate(f.x,f.y-18);c.rotate(Math.atan2(dy,dx));
  c.fillStyle='#b8fff2';c.fillRect(-5,-6,13,2);c.fillRect(-5,4,13,2);
  if(!reduced){c.fillStyle='#70bfb3';c.fillRect(-7-t*16,-3,8,6);}
  return;
 }
 const at=reduced?[1]:[t*.68,t*.87,t];
 c.fillStyle='#ffae68';
 for(const u of at)c.fillRect(f.x+dx*u-2,f.y+dy*u-14-9*u,5,4);
 if(t<fireSpreadContactLife){
  c.fillStyle='#ffc681';
  c.fillRect(f.x2-10,f.y2-4,5,2);
  c.fillRect(f.x2+5,f.y2-4,5,2);
 }
}
function recordMissileTrail(q,history){
 let points=history.get(q);
 if(!points){points=[];history.set(q,points);}
 const last=points.at(-1),gap=last?distance(last,q):Infinity;
 if(gap>72)points.length=0;
 if(gap>=8){points.push({x:q.x,y:q.y});if(points.length>(q.relay?14:5))points.shift();}
 return points;
}
function paintMissileTrail(c,q,points){
 if(points.length<2)return;
 const [tail]=points;
 c.beginPath();c.moveTo(tail.x,tail.y-18);
 for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y-18);
 c.lineTo(q.x,q.y-18);c.lineJoin='round';
 if(q.relay){
  const gradient=c.createLinearGradient(tail.x,tail.y-18,q.x,q.y-18);
  gradient.addColorStop(0,'#4bb2a900');
  gradient.addColorStop(.42,'#71c8bf91');
  gradient.addColorStop(1,'#b5fcf0');
  c.lineCap='round';c.strokeStyle='#26595964';c.lineWidth=6;c.stroke();
  c.strokeStyle=gradient;c.lineWidth=2.5;c.stroke();return;
 }
 if(q.capturedFan){
  c.strokeStyle='#3e2a26b8';c.lineWidth=7;c.stroke();
  c.strokeStyle=q.railFanCut?RAIL_GUN_COLORS[q.railFanCut.gun]:'#e4af6b';c.lineWidth=2.5;c.stroke();
 }else{
  c.strokeStyle=q.salvo?'#9e795486':'#438e857e';c.lineWidth=q.salvo?8:6;c.stroke();
  c.strokeStyle=q.salvo?'#ffbb78':'#80d2c6';c.lineWidth=2;c.stroke();
 }
}
function paintFormationEntry(c,f,reduced){
 const fire=f.showcase==='flame',t=f.age/f.life;
 const line=FORMATION_INK[f.showcase]||FORMATION_INK.fusion;
 const dust=fire?'#e4bc79':f.showcase==='rocket'?'#f8e3af':'#b8e1cd';
 c.save();c.globalAlpha=Math.min(1,(1-t)*2);c.translate(f.x,f.y);c.rotate(f.angle??0);
 c.lineJoin='bevel';c.beginPath();
 for(const side of [-1,1]){
  c.moveTo(-9,side*23);c.lineTo(-27,side*23);c.lineTo(-27,side*8);
  if(!reduced){c.fillStyle=dust;c.fillRect(-33-t*14,side*19-2,5,4);}
 }
 if(Number.isFinite(f.angle)){c.moveTo(14,-10);c.lineTo(24,0);c.lineTo(14,10);}
 c.strokeStyle='#29332b';c.lineWidth=7;c.stroke();
 c.strokeStyle=line;c.lineWidth=3;c.stroke();
 c.restore();
}
function paintSalvoImpact(c,f,t,reduced){
 const r=f.r*(reduced?.76:.43+t*.55);
 c.globalAlpha*=.75;
 circle(c,f.x,f.y,r,'#c6763422','#d9a779',2);
 c.translate(f.x,f.y-10);
 if(t<.48){
  c.fillStyle='#d67940';c.fillRect(-14,-6,28,12);c.fillRect(-7,-12,14,24);
  c.fillStyle='#fff0be';c.fillRect(-9,-3,18,6);c.fillRect(-3,-8,6,16);
 }
 if(reduced)return;
 for(let i=0;i<8;i++){
  const a=i*TAU/8+.25,reach=r*(.42+(i%3)*.16);
  c.fillStyle=i%2?'#ffb26c':'#dd7848';
  c.fillRect(Math.cos(a)*reach,Math.sin(a)*reach*.62-t*10,i%2?5:8,4);
 }
}
function paintCapturedVolley(c,f,t,reduced){
 c.translate(f.x,f.y-18);
 c.rotate(f.angle);
 if(!reduced&&t<.5){
  c.fillStyle='#f5ba68';c.beginPath();
  c.moveTo(21,-8);c.lineTo(36,-3);c.lineTo(48,0);c.lineTo(36,3);c.lineTo(21,8);c.closePath();c.fill();
  c.fillStyle='#fff6cc';c.fillRect(23,-3,14,6);
 }
 for(let i=0;i<f.count;i++){
  c.save();
  c.rotate(coastFanAngle(i,f.count));
  c.fillStyle='#ae6a3c';c.fillRect(26+t*11,-2,20+t*10,4);
  c.fillStyle='#ffe7a6';c.fillRect(29+t*11,-1,14+t*7,2);
  c.restore();
 }
}
function paintCapturedMount(c,art,p,volley,reduced){
 const image=art.vehicleLayers,cell=image.width/2,size=42;
 const recoil=volley&&!reduced?6*(1-volley.age/volley.life)**2:0;
 c.save();c.translate(p.x,p.y-18);c.rotate(volley?.angle??p.aim);
 c.translate(-recoil,0);
 c.drawImage(image,cell,cell,cell,cell,-size*.32,-size*.49,size,size);
 c.restore();
}
function paintRailFanSweep(c,f,t,reduced){
 const color='#ffe3a4';
 c.globalAlpha=Math.min(1,(1-t)*2.4);
 for(const [px,py] of [[f.x,f.y],[f.x2,f.y2]]){
  const r=reduced?12:11+Math.min(t*20,9);
  c.lineWidth=2;c.strokeStyle=color;c.beginPath();
  c.moveTo(px-r,py-6);c.lineTo(px-r,py+2);c.lineTo(px-r+7,py+2);
  c.moveTo(px+r,py-6);c.lineTo(px+r,py+2);c.lineTo(px+r-7,py+2);c.stroke();
 }
}
function paintRailFanLine(c,cue){
 const {x,y,state,guns,edges,halfWidth,halfDepth,inPosition}=cue;
 const active=cue.clear,color=active?'#fff0b9':'#edc382';
 const top=y-halfDepth,bottom=y+halfDepth;
 c.save();
 for(let i=0;i<edges.length;i++){
  const edge=edges[i],gun=guns[i],ink=RAIL_GUN_COLORS[i];
  c.setLineDash(state==='ready'?[]:active?[14,7]:[4,13]);c.beginPath();
  c.moveTo(x+(i===0?-1:1)*8,top-6);c.lineTo(edge.x,edge.y+12);
  c.strokeStyle='#172322d9';c.lineWidth=state==='ready'?7:5;c.stroke();
  c.strokeStyle=ink+(active?'ef':'a6');c.lineWidth=state==='ready'?3:2;c.stroke();
  c.setLineDash([]);
  if(active){
   c.strokeStyle=ink;c.lineWidth=3;c.beginPath();
   c.moveTo(gun.x-15,gun.y+4);c.lineTo(gun.x-15,gun.y+13);c.lineTo(gun.x-5,gun.y+13);
   c.moveTo(gun.x+15,gun.y+4);c.lineTo(gun.x+15,gun.y+13);c.lineTo(gun.x+5,gun.y+13);c.stroke();
  }
 }
 c.fillStyle=inPosition?'#9f723c48':'#182b28d9';c.fillRect(x-halfWidth,top,halfWidth*2,halfDepth*2);
 c.lineWidth=6;c.strokeStyle='#142422';c.strokeRect(x-halfWidth,top,halfWidth*2,halfDepth*2);
 c.lineWidth=2;c.strokeStyle=color;c.strokeRect(x-halfWidth,top,halfWidth*2,halfDepth*2);
 c.fillStyle=color;
 for(const side of [-1,1])c.fillRect(x+side*(halfWidth+4)-2,top+5,4,halfDepth*2-10);
 if(!inPosition){
  c.beginPath();c.moveTo(x-8,y+5);c.lineTo(x,y-4);c.lineTo(x+8,y+5);
  c.lineWidth=3;c.stroke();
 }
 c.restore();
}
function paintRailWing(c,e){
 const color=e.railWing===0?'#f2cc85':'#c3e5d7',side=e.railWing===0?-1:1;
 const {x,y}=e;
 c.save();c.beginPath();
 c.moveTo(x-side*8,y+6);c.lineTo(x+side*13,y+6);c.lineTo(x+side*19,y-1);
 c.strokeStyle='#283832';c.lineWidth=6;c.stroke();
 c.strokeStyle=color;c.lineWidth=2;c.stroke();c.restore();
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
 if(f.wake){
  c.fillStyle='#ffc27b';
  c.fillRect(f.x-9,f.y-3,6,2);
  c.fillRect(f.x+4,f.y-3,6,2);
 }
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
function paintRailBoss(c,b,s,art,rail,reduced){
 const {x,y,dead}=b;
 if(art?.railBoss){
  c.save();
  c.fillStyle='#18252275';c.beginPath();c.ellipse(x+6,y+15,118,28,0,0,TAU);c.fill();
  if(dead)c.filter='brightness(.59) saturate(.55)';
  c.drawImage(art.railBoss,x-116,y-47,232,68);
  c.restore();
 }else{
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
 }
 if(dead){
  c.fillStyle='#263530';c.beginPath();c.moveTo(x-28,y-55);c.lineTo(x+40,y-44);c.lineTo(x+27,y-6);c.lineTo(x-19,y-19);c.fill();
  c.fillStyle='#d28d55';c.fillRect(x-17,y-29,5,3);c.fillRect(x+16,y-33,4,2);
 }
 b.parts.forEach((part,i)=>{
  const p=partPosition(s,part),live=part.hp>0&&!dead,ink=RAIL_GUN_COLORS[i];
  const round=s.hazards.find(h=>h.lane&&railGunOf(h)===i)||rail?.forecast.find(h=>railGunOf(h)===i);
  const aim=round?Math.atan2(round.y-p.y,round.x-p.x):b.aim;
  const kick=live&&round?.hit?clamp(1+round.timer/.2,0,1):0;
  c.save();c.translate(p.x,p.y-21);
  c.fillStyle='#192824';c.fillRect(-23,-16,46,32);
  c.fillStyle='#656c5d';c.fillRect(-19,-18,38,34);
  c.fillStyle=live?ink:'#6d7061';c.fillRect(-19,-18,38,3);c.fillRect(-19,12,38,4);
  c.fillStyle='#293631';c.fillRect(-16,-12,32,24);
  c.rotate(live?aim:Math.PI/2-Math.sign(part.ox)*.68);
  c.translate(reduced?0:-kick*12,0);
  c.fillStyle='#151f1e';c.fillRect(-15,-12,35,24);
  c.fillStyle=live?'#828671':'#44473e';c.fillRect(-12,-9,29,18);
  c.fillStyle=live?'#b7b39a':'#6c6858';c.fillRect(-11,-9,25,3);
  if(live){
   c.fillStyle='#172321';c.fillRect(16,-8,49,16);
   c.fillStyle='#878771';c.fillRect(16,-5,44,10);
   c.fillStyle='#c4b99b';c.fillRect(20,-5,36,2);
   c.fillStyle=ink;c.fillRect(53,-7,5,14);
   c.fillStyle=round&&!round.hit?'#fbe3aa':'#b4b9a3';c.fillRect(60,-7,7,14);
   c.fillStyle='#2d3029';c.fillRect(64,-4,3,8);
   if(kick>.5){
    c.fillStyle='#ffde9c';c.beginPath();c.moveTo(66,-9);c.lineTo(88,0);c.lineTo(66,9);c.closePath();c.fill();
   }
  }else{
   c.fillStyle='#272d27';c.fillRect(14,-7,16,14);
   c.fillStyle='#c38059';c.fillRect(28,-6,4,4);c.fillRect(26,1,4,5);
  }
  c.restore();
 });
}
function paintRailWarning(c,h,y,forecast=false,locked=false){
 const {left,top,bottom,width,height}=railLaneBounds(h);
 const bait=locked&&h.tracked;
 if(forecast){
  c.fillStyle=bait?'#e7c39326':'#92c3a914';c.fillRect(left,top,width,height);
  c.strokeStyle=bait?'#ffe0a9':'#b9ddc4';c.lineWidth=bait?3:2;c.setLineDash([8,12]);c.strokeRect(left,top,width,height);c.setLineDash([]);
  if(!locked)return;
 }else{
  c.fillStyle=h.tracked?'#dc64402e':'#c55a3624';c.fillRect(left,top,width,height);
  c.strokeStyle='#3d2424';c.lineWidth=6;c.strokeRect(left,top,width,height);
  c.strokeStyle=h.tracked?'#ffc88a':'#efa578';c.lineWidth=h.tracked?4:3;c.strokeRect(left,top,width,height);
  c.fillStyle='#f1a375b0';
  for(let row=top+30;row<bottom-18;row+=72){
   c.fillRect(left+5,row,12,3);c.fillRect(left+5,row+8,8,3);
   c.fillRect(left+width-17,row,12,3);c.fillRect(left+width-13,row+8,8,3);
  }
  if(h.tracked){
   c.setLineDash([9,15]);c.beginPath();c.moveTo(h.x,top);c.lineTo(h.x,bottom);c.stroke();c.setLineDash([]);
  }
 }
 const labelY=clamp(y-59,top+18,bottom-8),label=railLaneLabel(h,locked);
 c.font='bold 12px Galmuri';c.textAlign='center';
 const lead=bait?16:0;
 const labelWidth=c.measureText(label).width+16+lead;
 const labelX=h.x-labelWidth/2;
 c.fillStyle='#332b24e8';c.fillRect(labelX,labelY-16,labelWidth,22);
 c.fillStyle='#ffdfac';c.fillText(label,h.x+lead/2,labelY);
 if(bait){
  const x=labelX+12,cy=labelY-5;
  c.beginPath();c.moveTo(x,cy-6);c.lineTo(x+6,cy);c.lineTo(x,cy+6);c.lineTo(x-6,cy);c.closePath();c.fill();
 }
}
function paintRailStop(c,p,slot){
 const {x,y,left,right}=slot,side=Math.sign(x-p.x);
 const from=Math.max(left,x-22),to=Math.min(right,x+22);
 c.save();
 if(Math.abs(x-p.x)>35){
  c.beginPath();c.moveTo(p.x+side*21,y);c.lineTo(side>0?from:to,y);c.setLineDash([6,7]);
  c.strokeStyle='#162925';c.lineWidth=6;c.stroke();c.strokeStyle='#c7f2e3';c.lineWidth=2.5;c.stroke();
  c.setLineDash([]);
 }
 c.fillStyle='#183935eb';c.fillRect(from,y-14,to-from,28);
 c.strokeStyle='#142322';c.lineWidth=6;c.strokeRect(from,y-14,to-from,28);
 c.strokeStyle='#c7f2e3';c.lineWidth=2.5;c.strokeRect(from,y-14,to-from,28);
 c.beginPath();c.moveTo(x-side*5,y-6);c.lineTo(x+side*3,y);c.lineTo(x-side*5,y+6);c.stroke();
 c.restore();
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
function paintPortEscape(c,s,lanes){
 if(!lanes.length)return;
 c.save();c.translate(s.player.x,s.player.y);c.beginPath();
 for(const {dx,dy,reach} of lanes){
  if(reach<36)continue;
  const start=dy<0?Math.max(31,Math.min(66/-dy,24/Math.abs(dx))):31;
  const depths=reach>=start+23?[start,start+11]:[Math.min(start,reach-16)];
  for(const depth of depths){
   c.moveTo(depth*dx+7*dy,depth*dy-7*dx);
   c.lineTo((depth+7)*dx,(depth+7)*dy);
   c.lineTo(depth*dx-7*dy,depth*dy+7*dx);
  }
 }
 c.lineJoin='miter';c.strokeStyle='#242525';c.lineWidth=8;c.stroke();
 c.strokeStyle='#fff1d4';c.lineWidth=3.5;c.stroke();
 for(const {dx,dy,reach} of lanes)circle(c,dx*reach,dy*reach,5,'#e6efc4','#242525',3);
 c.restore();
}
export function createRenderer(canvas,art,combatHud={rects:[]}){
 const c=canvas.getContext('2d');let size={w:0,h:0,dpr:1},view={w:960,h:540},terrainCache=null,terrainKey='',siteStates=new Map();
 const missileTrails=new WeakMap();
 let showcaseLead=0,coastShiftX=0,coastShiftY=0,previousTime=0;
 function resize(){size={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);}
 function draw(s,reduced=false,approach=activeEntry(s),focus=null,lead=coastFork(s)?.lead||coastLead(s),opening=null,rail=railBossGuide(s,railFanCutCue(s))){
  if(size.w!==innerWidth||size.h!==innerHeight)resize();const mobile=size.w<=700;let worldWidth=mobile?520:960;
  const gate=exitGate(s),aid=portAidCue(s),conduit=conduitMortarCue(s);
  const harborWarnings=s.operation?.region===2&&s.boss.active?s.hazards.filter(h=>!h.lane&&!h.hit):[];
  const portRounds=harborWarnings.filter(h=>h.portRound);
  const intercept=portRounds.length&&canUseSkill(s)&&portAidCounterRound(s)?.portRound;
  const threatened=intercept&&harborWarnings.filter(h=>distance(s.player,h)<blastContactRadius(h));
  const interceptCovers=threatened?.length>0&&threatened.every(h=>h.portRound===intercept);
  const escapeLanes=harborWarnings.length&&!interceptCovers?portEscapeLanes(s,harborWarnings,combatHud.analog):[];
  const showAid=aid&&!interceptCovers&&!(aid.preview&&aid.endangered&&escapeLanes.length);
  const guns=lead?.coastApproach==='r'&&lead.state==='active'?s.enemies.filter(e=>!e.dead&&e.siteId===lead.id):[];
  const volley=guns.length===2?coastRocketVolley(s,lead):null;
  const counter=guns.length?coastRocketCounter(s,lead):null;
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
   const wake=showcase==='flame'&&s.effects.findLast(f=>f.type==='wake-flash'&&f.age<.22);
   const strike=wake||showcase&&s.effects.findLast(f=>{
    if(f.type==='formation')return true;
    if(showcase==='rocket')return f.type==='salvo-impact';
    return showcase==='flame'?f.type==='flame'&&f.evolved:f.type==='payload-impact'||f.type==='payload-relay';
   });
   const relay=showcase==='fusion'&&s.shots.findLast(q=>q.source==='payload'&&q.relay);
   const arrival=showcase==='fusion'&&s.effects.findLast(f=>f.relayArrival&&f.contact&&f.age<.18);
   const salvo=showcase==='rocket'&&s.shots.findLast(q=>q.salvo);
   const destination=relay&&relay.relayGroup!==undefined&&s.enemies.find(e=>!e.dead&&e.id===relay.target);
   let targetX=strike?.x;
   if(wake)targetX=(wake.x+wake.x2)/2;
   else if(relay)targetX=destination?(relay.x+destination.x*2)/3:relay.x;
   else if(arrival)targetX=arrival.contact.x;
   else if(strike?.type==='payload-relay')targetX=strike.x2;
   else if(salvo&&(!strike||strike.type==='formation'))targetX=salvo.x;
   const limit=wake||destination||arrival?116:85;
   const nextLead=strike?.type==='flame'?Math.cos(strike.angle)*85:clamp(((targetX??s.player.x)-s.player.x)*.55,-limit,limit);
   showcaseLead+=(nextLead-showcaseLead)*(1-Math.exp(-elapsed*8));
  }
  const focusX=s.player.x+(s.boss.x-s.player.x)*.35*follow+rescueLead+showcaseLead;
  let focusY=s.player.y+(s.boss.y-s.player.y)*.35*follow;
  // A gate near a boundary needs room beside the objective rail and tactical map.
  const edgeMargin=gate&&s.operation?112*(1-follow):0;
  // Keep northern bosses and their barrels below the portrait HUD.
  const portraitBoss=mobile&&size.h>size.w&&follow>0;
  const bossMargin=portraitBoss?Math.min(235,Math.max(0,Math.min(310,size.h*.38)/scale-s.boss.y))*follow:0;
  // Keep a close-range flank or rail charge from leading the pilot beneath the boss HUD.
  const portBoss=s.operation?.region===2&&s.boss.active;
  const pilotLine=s.operation?.region>0?Math.min(286,size.h*.45):Math.min(260,size.h*.39);
  const pilotMargin=portraitBoss&&s.boss.active?Math.max(0,pilotLine/scale-s.player.y):0;
  let framedX=focusX;
  let sightX=0,sightY=0;
  if(mobile&&size.h>size.w&&guns.length){
   const x=Math.min(...guns.map(e=>e.x))-26,y=Math.min(...guns.map(e=>e.y))-49;
   const screenX=size.w/2+(x-focusX)*scale,screenY=size.h/2+(y-focusY)*scale;
   const inRail=screenX<125&&screenY<300;
   if(inRail){
    const verticalRoom=lead.coastPlan==='split'&&size.h<=700?145:90;
    sightY=clamp((Math.min(246,size.h*.39)-screenY)/scale,0,verticalRoom);
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
  const portraitGate=mobile&&size.h>size.w&&gate&&s.operation;
  const gateFocus=portraitGate?clamp((240-distance(s.player,gate))/145,0,1):0;
  const gateLine=Math.min(size.h*.53,410);
  const gateTop=portraitGate?gateFocus*clamp(gateLine/scale-gate.y,0,345):0;
  const fieldBottom=Math.max(view.h/2,1200-view.h/2);
  let cy=clamp(focusY-gateTop,view.h/2-Math.max(bossMargin,pilotMargin,gateTop),fieldBottom);
  if(portraitBoss&&rail){
   const top=(combatHud.railFrame?.top??size.h*.29)+8;
   const bottom=(combatHud.railFrame?.bottom??size.h*.68)-12;
   const roof=s.boss.y-51;
   const trainLimit=roof+(size.h/2-top)/scale;
   const pilotLimit=s.player.y+(size.h/2-bottom)/scale;
   // The pilot and the active escape lane take priority when the two cannot fit.
   cy=Math.min(fieldBottom,Math.max(pilotLimit,Math.min(cy,trainLimit)));
  }
  c.setTransform(size.dpr,0,0,size.dpr,0,0);c.clearRect(0,0,size.w,size.h);c.fillStyle='#263a44';c.fillRect(0,0,size.w,size.h);c.translate(size.w/2,size.h/2);c.scale(scale,scale);c.translate(-cx,-cy);c.imageSmoothingEnabled=false;
  const shake=!reduced&&s.player.hurt>0?Math.sin(s.t*75)*3:0;c.translate(shake,0);
  const index=s.operation?.region||0,key=`${index}:${s.seed}`;
  if(edgeMargin)paintTerrainMargins(c,index,edgeMargin);
  const northMargin=view.h/2-cy;
  if(gateTop||rail&&northMargin>0)paintNorthBoundary(c,index,Math.ceil(Math.max(gateTop,northMargin))+1);
  if(canvas.ownerDocument&&key!==terrainKey){terrainKey=key;siteStates.clear();terrainCache=canvas.ownerDocument.createElement('canvas');terrainCache.width=1600;terrainCache.height=1200;const tc=terrainCache.getContext('2d');tc.imageSmoothingEnabled=false;paintTerrain(tc,index,s.seed,art);}
  if(terrainCache)c.drawImage(terrainCache,0,0);else paintTerrain(c,index,s.seed,art);
  if(opening)paintCoastOpening(c,{routes:opening.routes.filter(route=>route.site===lead?.id)});
  const visible=(x,y,padding=48)=>Math.abs(x-cx)<=view.w/2+padding&&Math.abs(y-cy)<=view.h/2+padding;
  for(const b of s.blocks)if(b.hp!==0&&visible(b.x,b.y,220))paintCoverShadow(c,b,index);
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
  for(const [a,b] of infernoWakeLinks(s))if(visible(a.x,a.y,a.r)||visible(b.x,b.y,b.r))paintWakeLink(c,a,b);
  for(const z of s.zones){
   if(!visible(z.x,z.y,z.r+25))continue;
   if(z.source==='wake'){paintWake(c,z,s.t,reduced);continue;}
   if(z.source==='ember-charge'){paintEmberCharge(c,s,z);continue;}
   circle(c,z.x,z.y,z.r,'#552f282d','#cb753769',1);circle(c,z.x,z.y,z.r*.75,'#e7a05a30');
   for(let i=0;i<5;i++){const a=i*2.4+z.x,r=z.r*(.25+(i%3)*.22);flame(c,z.x+Math.cos(a)*r,z.y+Math.sin(a)*r,14+(reduced?0:Math.sin(s.t*12+i)*4),s.t*9+i);}
  }
  const reach=pickupReach(s);
  const signal=signalCourier(s);
  const cargo=signalCargo(s);
  if(s.operator==='marco'&&s.phase==='playing'&&canUseSkill(s))paintFocusSight(c,s,focus);
  for(const f of s.effects)if(f.type==='formation'&&visible(f.x,f.y,48))paintFormationEntry(c,f,reduced);
  const relayDefense=s.challenge?.state==='active'&&s.challenge.type==='defend'&&!s.challenge.secured;
  if(relayDefense)paintRelayGround(c,s,relayDefenseRound(s));
  if(signal)paintEscapeLane(c,signalRoute(s),SIGNAL_COLOR,[9,12],visible);
  if(cargo&&visible(cargo.x,cargo.y,SIGNAL_CARGO_REACH)){
   c.save();
   c.setLineDash([8,7]);
   circle(c,cargo.x,cargo.y,SIGNAL_CARGO_REACH,'#f4d89412','#f4d894',2);
   c.restore();
  }
  for(const g of s.gems)if(!g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  const salvage=coastSalvage(s),wreck=coastSalvageWreck(s),roleTarget=coastRoleTarget(s);
  const railFanLine=rail?.pad,hasTurret=s.weapons.some(isCapturedTurret);
  const turretVolley=hasTurret&&s.effects.findLast(f=>f.type==='captured-volley');
  const railWings=s.operation?.region===1&&s.stage==='field'&&!s.stats.railFanSweep&&hasTurret
   ?[0,1].map(wing=>s.enemies.find(e=>e.railWing===wing&&!e.dead&&visible(e.x,e.y,24))):[];
  if(wreck&&visible(wreck.x,wreck.y,COAST_SALVAGE.reach)){
   c.save();c.setLineDash([9,7]);
   circle(c,wreck.x,wreck.y,COAST_SALVAGE.reach,'#e9bf641c','#f0d290',2);
   c.setLineDash([]);
   if(salvage.work>0){
    c.beginPath();c.strokeStyle='#fff0b7';c.lineWidth=4;
    c.arc(wreck.x,wreck.y,COAST_SALVAGE.reach,-Math.PI/2,-Math.PI/2+TAU*salvage.work/COAST_SALVAGE.seconds);
    c.stroke();
   }
   c.restore();
  }
  if(s.stage==='field'){
   const staging=coastStagingPoint(s),part=portPartStaging(s);
   if(part&&visible(part.x,part.y,54))paintStaging(c,s,part);
   if(staging)paintStaging(c,s,staging);
   else{
    c.fillStyle='#293c34';c.fillRect(718,326,42,16);c.fillRect(840,326,42,16);
    c.fillStyle='#d8b471';
    for(let i=0;i<3;i++){c.fillRect(720+i*13,326,6,16);c.fillRect(842+i*13,326,6,16);}
    if(distance(s.player,BOSS_ENTRY)<190){
     c.fillStyle='#1c302de8';c.fillRect(727,363,146,24);c.fillStyle='#efcf90';
     c.font='11px Galmuri';c.textAlign='center';c.fillText('보스전 진입',800,379);
    }
   }
  }
  const entities=[...s.sites.map(e=>({y:e.y,kind:'site',e})),...s.blocks.filter(e=>e.hp!==0).map(e=>({y:e.y+e.h,kind:'block',e})),...s.enemies.map(e=>({y:e.y,kind:'enemy',e})),{y:s.player.y,kind:'player',e:s.player}];
  if(art)for(const [row,col,x,y,w] of fieldScene(index,s.seed).landmarks)
   entities.push({y,kind:'landmark',e:{row,col,x,y,w}});
  if(relayDefense)entities.push({y:relaySet.y,kind:'relay-defense',e:relaySet});
  if(gate)entities.push({y:gate.y,kind:'gate',e:gate});
  if(signal)entities.push({y:signal.y,kind:'courier',e:signal});
  if(cargo)entities.push({y:cargo.y,kind:'signal-cargo',e:cargo});
  if(raid)entities.push({y:raid.target.y,kind:'courier',e:raid.target});if(s.boss.active||s.boss.dead||s.stage==='field')entities.push({y:s.boss.y,kind:'boss',e:s.boss});
  for(const item of entities.sort((a,b)=>a.y-b.y)){
   const e=item.e;if(!visible(e.x,e.y,220))continue;c.save();
   if(item.kind==='landmark'){
    if(s.player.y<=e.y&&Math.abs(s.player.x-e.x)<e.w*.48&&e.y-s.player.y<e.w)c.globalAlpha=.32;
    paintLandmark(c,art,e);c.restore();continue;
   }
   if(item.kind==='gate'){if(s.operation)paintGate(c,e,s.holdTime,reduced);else if(art)prop(c,art,2,3,e.x,e.y,112);c.restore();continue;}
   if(item.kind==='site'){paintSite(c,e,s,art,s.t-(siteStates.get(e.id)?.collected??-99));c.restore();continue;}
   if(item.kind==='relay-defense'){
    if(art)prop(c,art,3,3,e.x,e.y,62);
    else{c.fillStyle='#303a31';c.fillRect(e.x-21,e.y-25,42,25);c.fillStyle='#c6d49e';c.fillRect(e.x-12,e.y-20,18,6);c.fillRect(e.x+14,e.y-39,2,16);}
    c.restore();continue;
   }
   if(item.kind==='block'){
    if(coverMasksPilot(e,index,s.player))c.globalAlpha=.34;
    paintBlock(c,e,index,art);
    if(e.hp>0&&e.hp<e.maxHp)bar(c,e.x+e.w/2,e.y-44,e.w,e.hp/e.maxHp,'#dfbc78');
    c.restore();continue;
   }
   if(item.kind==='enemy'){
    const guard=!e.dead&&(e.cohort==='coast-guard'||e.coastResponse)&&index===0&&s.stage==='field';
    if(guard)paintCoastGuard(c,s,e);
    if(!e.dead&&e.cohort==='signal-guard'){
     circle(c,e.x,e.y,e.r+4,'#8a4e2425','#e9a66e',2);
     if(e.type==='mortar'){
      c.fillStyle='#e9a66e';c.fillRect(e.x-10,e.y-59,20,4);
      c.fillRect(e.x-2,e.y-64,4,6);
     }
    }
    if(e.dead)paintInfantryFall(c,e,reduced);
    else{
     const visibility=e.showcase ? .84 : guard ? (reduced?1:.82) : 0;
     c.globalAlpha=Math.min(1,visibility+e.spawnAge*3);
    }
    circle(c,e.x,e.y,14,'#263b3338');
    const wireMortar=e.cohort==='wire-guard'&&e.type==='mortar'&&s.stage!=='boss';
    const relayMortar=e.siteId==='rail-relay'&&e.cohort==='rail-guard'&&e.type==='mortar'&&s.stage==='field';
    if(!e.dead&&(e.cohort==='port-battery'||wireMortar||relayMortar||e===conduit?.gun)){
     const color=relayMortar||e===conduit?.gun&&conduit.clear?'#a4e3e3':'#ffcf9a';
     circle(c,e.x,e.y,22,'#8a4e2425',color,2);
     bar(c,e.x,e.y-58,45,e.hp/e.maxHp,'#f4be83');
     c.fillStyle=color;c.font='10px Galmuri';c.textAlign='center';c.fillText(wireMortar?'통신소 박격포':relayMortar?'후방 박격포':'박격포',e.x,e.y-66);
    }
    if(e.hurt>0)c.filter='brightness(1.7)';if(art)actor(c,art.enemies,({rifle:0,shield:1,mortar:2,officer:3})[e.type],Math.floor(e.walk)%4,e.x,e.y,e.type==='officer'?62:e.type==='shield'?55:49,Math.cos(e.aim)<0);else{c.fillStyle=e.type==='officer'?'#ba6d53':'#48533c';c.fillRect(e.x-12,e.y-34,24,34);}c.filter='none';
    if(railWings.includes(e))paintRailWing(c,e);
    if(bracingCoastEscort(e))paintCoastShieldBrace(c,e,s.player);
    else if(!e.dead&&roleTarget&&s.operator==='marco'&&!e.coastScanned&&(e.coastArmor||roleTarget.id===e.id)){
     const radius=e.r+(roleTarget.id===e.id?13:8);
     c.beginPath();c.arc(e.x,e.y,e.r+9,e.aim+2.03,e.aim+4.25);
     c.strokeStyle='#3b3023';c.lineWidth=7;c.stroke();
     c.strokeStyle='#f6c47d';c.lineWidth=3;c.stroke();
     if(roleTarget.id===e.id){
      for(const side of [-1,1]){
       const a=e.aim+Math.PI+side*.9,x=e.x+Math.cos(a)*radius,y=e.y+Math.sin(a)*radius;
       c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#ffe2a0';
       c.beginPath();c.moveTo(-4,-5);c.lineTo(4,0);c.lineTo(-4,5);c.closePath();c.fill();c.restore();
      }
     }
    }
    if(!e.dead&&roleTarget&&s.operator!=='marco'&&(e.coastCarrier||roleTarget.id===e.id)){
     c.save();c.translate(e.x,e.y-59);c.rotate(Math.PI/4);
     c.fillStyle='#213e33';c.fillRect(-6,-6,12,12);
     c.fillStyle='#a6f0d6';c.fillRect(-3.5,-3.5,7,7);c.restore();
    }
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
    if(art&&hasTurret)paintCapturedMount(c,art,e,turretVolley,reduced);
    if(e.overdrive>0){c.strokeStyle='#ffce72aa';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-24,35,s.t*3,s.t*3+4.6);c.stroke();}
    const maneuver=activeManeuver(e);if(maneuver){c.fillStyle=maneuver==='brace'?'#f8cf7e':'#9becbe';for(const side of [-1,1])c.fillRect(e.x+side*22-3,e.y+6,6,2);}
   }else if(item.kind==='signal-cargo'){
    if(art){
     c.save();c.translate(e.x,e.y);c.rotate(e.aim);c.filter='saturate(.42) brightness(.68)';
     prop(c,art,2,3,0,15,115);c.restore();
    }else{c.fillStyle='#34403a';c.fillRect(e.x-35,e.y-20,70,40);}
    paintWreckSmoke(c,e.x,e.y,s.holdTime,reduced);
    c.fillStyle='#263933';c.fillRect(e.x-19,e.y-25,38,24);
    c.strokeStyle='#f4d894';c.lineWidth=2;c.strokeRect(e.x-19,e.y-25,38,24);
    c.fillStyle='#f4d894';c.fillRect(e.x-15,e.y-18,30,3);c.fillRect(e.x-3,e.y-23,6,20);
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
    if(s.operation?.region===1)paintRailBoss(c,e,s,art,rail,reduced);
    else if(art){
     const moving=!e.dead&&e.mode==='charge';
     const tread=moving&&chargeLane?Math.hypot(e.x-chargeLane.x,e.y-chargeLane.y)*2:s.t*80;
     const pitch=chargeLane?(moving?.035:-.025):0;
     const harbor=index===2;
     const turretRemoved=index===0&&!!salvage&&(e.parts[0].hp<=0||salvage.turret==='secured');
     vehicle(c,art,{x:e.x,y:e.y,width:harbor?225:185,enemy:true,body:e.body,turret:e.aim,kick:e.kick,tread,moving,pitch,flash:e.dead?0:e.flash,
      damaged:e.hp<e.maxHp*.5,wreck:e.dead,reduced,hull:harbor?art.portBoss:null,turretDisabled:harbor&&e.parts[0].hp<=0,turretRemoved});
    }
    else{c.save();c.translate(e.x,e.y);c.rotate(e.body);c.fillStyle=e.dead?'#384747':'#667263';c.fillRect(-70,-45,140,90);c.restore();}
    if(e.dead&&gate)paintWreckSmoke(c,e.x,e.y,s.holdTime,reduced);
    if(e.active&&!e.dead&&index!==1)e.parts.forEach(part=>{
     if(part.hp<=0)return;
     const p=partPosition(s,part),color=salvage&&!coastTurretLane(s)?'#a1d9c2':'#ffdc8c';
     circle(c,p.x,p.y,17,color+'24',color,2);bar(c,p.x,p.y-25,35,part.hp/part.maxHp,color);
    });
   }if(item.kind!=='enemy'&&item.kind!=='player'&&e.burn>0&&!e.dead){for(let i=-1;i<=1;i++)flame(c,e.x+i*28,e.y-18,24,s.t*11+i);}
   c.restore();
  }
  for(const g of s.gems)if(g.salvage&&visible(g.x,g.y))paintXp(c,g,s.player,reach,reduced);
  if(salvage)for(const part of salvage.parts)if(visible(part.x,part.y)){
   circle(c,part.x,part.y,12,'#223a38b0','#91dbc1',1.5);
   c.fillStyle='#abf1d7';c.fillRect(part.x-6,part.y-2,12,4);c.fillRect(part.x-2,part.y-6,4,12);
  }
  paintCoastRear(c,s);
  const signalPlan=coastSignalPlan(s);
  if(signalPlan?.state==='flying')paintCoastVolley(c,{x:s.boss.x,y:s.boss.y-s.boss.r-12,state:'inflight'});
  paintPortCue(c,s,showAid?aid:null);
  if(!raid&&approach)paintEntrySigns(c,approach,s.player,(x,y,hw,hh)=>{
   const sx=size.w/2+(x-cx+shake)*scale,sy=size.h/2+(y-cy)*scale;
   return sx-hw*scale>=5&&sx+hw*scale<=size.w-5&&sy>8&&sy<size.h-20
    &&!combatHud.rects.some(box=>overlapsBox(sx,sy,hw*scale,hh*scale,box));
  });
  for(const n of s.sites)if(n!==lead)paintSiteLabel(c,n,s);
  if(gate&&distance(s.player,gate)<220){
   const label=gate.name;
   c.fillStyle='#152a26e8';c.fillRect(gate.x-55,gate.y+72,110,22);
   c.fillStyle=gateNear?'#e0f5c5':'#aac6a7';c.font='11px Galmuri';c.textAlign='center';c.fillText(label,gate.x,gate.y+87);
  }
  for(const q of s.shots){
   const onScreen=visible(q.x,q.y,68),payload=q.source==='payload';
   const trail=!reduced&&(q.relay||onScreen&&(payload||q.salvo||q.capturedFan))?recordMissileTrail(q,missileTrails):null;
   if(!onScreen)continue;
   const a=Math.atan2(q.vy,q.vx);
   c.save();if(trail)paintMissileTrail(c,q,trail);
   c.translate(q.x,q.y-18);c.rotate(a);
   if(payload){
    c.fillStyle='#43a9ad';c.fillRect(-17,-2,17,4);
    c.fillStyle=q.incendiary?'#e5ad63':'#8ce4d7';c.fillRect(-9,-4,16,8);
    c.fillStyle='#effff1';c.fillRect(-4,-2,14,4);
    if(q.relay){c.fillStyle='#b8fff2';c.fillRect(-10,-6,7,2);c.fillRect(-10,4,7,2);}
   }else if(q.capturedFan){
    c.fillStyle='#a55e3d';c.fillRect(-14,-3,19,6);
    c.fillStyle=q.railFanCut?RAIL_GUN_COLORS[q.railFanCut.gun]:'#ffe4a4';c.fillRect(-8,-2,19,4);
    c.fillStyle='#fff5ca';c.fillRect(4,-1,9,2);
   }else if(q.salvo){
    c.fillStyle='#a45734';c.fillRect(-12,-5,15,10);
    c.fillStyle='#e8b779';c.fillRect(-9,-3,17,6);
    c.fillStyle='#fff0bd';c.fillRect(2,-2,9,4);
    c.fillStyle='#ea9861';c.fillRect(-13,-6,5,2);c.fillRect(-13,4,5,2);
   }else{
    c.fillStyle=q.rocket?'#f69145':'#ffdd87';c.shadowColor=q.rocket?'#ff984a':'#ffdf9e';c.shadowBlur=reduced?0:7;
    c.fillRect(-q.r*2,-q.r*.7,q.r*3,q.r*1.4);c.fillStyle='#fff3c8';c.fillRect(0,-1,q.r+3,2);
   }
   if(q.coastCounter||q.coastSignal){
    c.shadowBlur=0;c.fillStyle='#b9e9d4';
    c.fillRect(-13,-5,6,2);c.fillRect(-13,3,6,2);
   }
   if(q.breachLane&&q.target===s.boss.parts[0]?.id){
    c.fillStyle='#d6f5ff';c.fillRect(0,-2,q.r+4,4);
   }
   c.restore();
  }
  const latestInferno=s.effects.findLast(f=>f.type==='flame'&&f.evolved);
  let railSweep=null;
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
   else if(f.type==='rail-decoy'&&visible(f.x,f.y)){
    const radius=reduced?27:16+t*48;
    c.setLineDash([4,5]);circle(c,f.x,f.y,radius,null,'#e5d8a9',2);c.setLineDash([]);
    c.fillStyle='#e5d8a9';c.fillRect(f.x-3,f.y-3,6,6);
   }
   else if(f.type==='barrage'){c.fillStyle=reduced?'#df985325':'#ffd39345';c.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);for(let y=f.y-f.h/2;y<f.y+f.h/2;y+=80)circle(c,f.x,y,20+t*30,'#f3ae6944','#ffcc87',2);}
   else if(f.type==='explosion'||f.type==='break'||f.type==='shrapnel'){const r=(f.r||80)*(.35+t*.7);circle(c,f.x,f.y,r,'#ec963b30','#ffd384',2);circle(c,f.x,f.y,r*.45,'#ffe0a178');for(let i=0;i<7;i++){const a=i*TAU/7;c.fillStyle='#efbd76';c.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,4,4);}}
   else if(f.interrupted&&t<.4){
    c.globalAlpha=1-t/.4;
    c.strokeStyle='#c8f4ff';c.lineWidth=3;
    circle(c,f.x,f.y,reduced?26:24+t*28,null,'#c8f4ff',3);
    for(const {x,y} of f.interrupted){
     c.beginPath();c.moveTo(x-9,y-9);c.lineTo(x+9,y+9);
     c.moveTo(x+9,y-9);c.lineTo(x-9,y+9);c.stroke();
    }
   }
   else if(f.type==='barrage-cancel'&&(f.crossfire||f.railFanCut)){
    const r=reduced?31:24+t*28;
    for(const [i,x,y] of [[0,f.x,f.y],[1,f.x2,f.y2]])if(visible(x,y,r)){
     const color=f.railFanCut?RAIL_GUN_COLORS[i]:'#ffe4a4';
     circle(c,x,y,r,null,color,3);
     c.strokeStyle=color;c.lineWidth=3;c.beginPath();
     c.moveTo(x-9,y-9);c.lineTo(x+9,y+9);c.moveTo(x+9,y-9);c.lineTo(x-9,y+9);c.stroke();
    }
   }
   else if(f.type==='barrage-cancel'&&f.coastSignal){
    const radius=28+t*68;
    circle(c,f.x,f.y,radius,null,'#bce5cf',3);
    if(!reduced)circle(c,f.x,f.y,radius*.7,null,'#f1e5bc',2);
   }
   else if(f.type==='barrage-cancel'&&f.conduitCut){
    const color='#b4f1e8',r=17+t*23;
    for(const [x,y] of [[f.x,f.y],[f.x2,f.y2]])if(visible(x,y,r)){
     circle(c,x,y,r,null,color,2);
     c.strokeStyle=color;c.lineWidth=3;c.beginPath();
     c.moveTo(x-8,y-6);c.lineTo(x+8,y+6);c.moveTo(x+8,y-6);c.lineTo(x-8,y+6);c.stroke();
    }
   }
   else if(f.type==='overheat'||f.type==='heat'&&f.text){if(visible(f.x,f.y))paintArmorHeat(c,f,reduced?0:t);}
   else if(f.type==='heat'){if(visible(f.x,f.y,f.r??100))paintHeatImpulse(c,f,t,reduced);}
   else if(f.type==='raid-success'){const color=({common:'#ffe0a1',rare:'#90e0da',prototype:'#dcafff'})[f.quality];circle(c,f.x,f.y,25+t*110,null,color,4);for(let i=0;i<10;i++){const a=i*TAU/10;c.fillStyle=color;c.fillRect(f.x+Math.cos(a)*t*120,f.y+Math.sin(a)*t*75-20,4,8);}}
   else if(f.type==='armor-impact'){
    c.strokeStyle=f.coastScreen?'#ffb96a':'#ffe6b5';c.lineWidth=f.coastScreen?3:2;c.beginPath();
    for(const spread of [-.65,0,.65]){
     const a=f.angle+spread,r=8+t*17;
     c.moveTo(f.x,f.y);c.lineTo(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r);
    }
    c.stroke();
   }
   else if(f.type==='focus-shot')paintFocusShot(c,f,t,reduced);
   else if(f.type==='wake-flash'&&(visible(f.x,f.y,f.r)||visible(f.x2,f.y2,f.r)))paintWakeFlash(c,f,t,reduced);
   else if(f.type==='payload'&&visible(f.x,f.y)){c.fillStyle='#bcf9e9';c.fillRect(f.x-7,f.y-18,14,3);c.fillRect(f.x-2,f.y-23,4,13);}
   else if(f.type==='payload-relay'||f.type==='fire-spread'){
    if(visible(f.x,f.y,100)||visible(f.x2,f.y2,60))paintTransfer(c,f,t,reduced);
   }
   else if(f.type==='payload-impact'||f.type==='ember-burst'){
    if(visible(f.x,f.y,f.r+25)){
     if(f.type==='ember-burst')paintEmberBurst(c,f,t,reduced);
     else paintConduitImpact(c,f,t,reduced);
    }
   }
   else if(f.type==='ember-dash'){
    c.save();c.globalAlpha=1-t;c.beginPath();c.moveTo(f.x2,f.y2);c.lineTo(f.x,f.y);
    c.strokeStyle='#f6bd75';c.lineWidth=3;c.stroke();c.restore();
   }
   else if(f.type==='captured-volley'&&visible(f.x,f.y,66))paintCapturedVolley(c,f,t,reduced);
   else if(f.type==='rail-fan-sweep'&&(visible(f.x,f.y,30)||visible(f.x2,f.y2,30))){paintRailFanSweep(c,f,t,reduced);railSweep=f;}
   else if(f.type==='salvo-impact'||f.type==='captured-impact'){
    if(visible(f.x,f.y,f.r+20))paintSalvoImpact(c,f,t,reduced);
   }
   else if(f.type==='aid-counter'){
    const r=68*(.4+t*.65),edge='#d7f0b8';
    for(const {x,y} of [f,...(f.secondary||[])]){
     if(!visible(x,y,r))continue;
     circle(c,x,y,r,'#b2d59928',edge,3);
     circle(c,x,y,r*.48,null,edge,2);
     if(!reduced)for(let i=0;i<8;i++){const a=i*TAU/8;circle(c,x+Math.cos(a)*r,y+Math.sin(a)*r,5,edge);}
    }
   }
   else if(f.type==='pierce'){c.translate(f.x,f.y-18);c.rotate(f.angle);c.fillStyle='#fff2ae';c.fillRect(-12,-2,34+t*24,4);}
   else if(f.type==='thermal-charge'&&visible(f.x,f.y)){
    c.globalAlpha=Math.min(1,(1-t)*2);
    const y=f.y-63-(reduced?0:t*18);
    c.fillStyle='#192e2a';c.fillRect(f.x-25,y-9,50,18);
    c.fillStyle='#c5f2c4';c.font='bold 11px Galmuri';c.textAlign='center';
    c.fillText(`충전 +${Math.round(f.gain*10)/10}`,f.x,y+4);
   }
   else if(f.type==='lightning'||f.type==='ricochet'){c.strokeStyle=f.type==='lightning'?'#a1f5ef':'#f8dc8f';c.lineWidth=f.type==='lightning'?3:1.5;c.beginPath();c.moveTo(f.x,f.y);c.lineTo((f.x+f.x2)/2+Math.sin(s.t*40)*10,(f.y+f.y2)/2);c.lineTo(f.x2,f.y2);c.stroke();}
   else if(f.type==='flame'&&f.evolved){
    if(f===latestInferno&&visible(f.x,f.y,f.r+25))paintInferno(c,f,t,reduced);
   }
   else if(f.type==='flame'){
    c.translate(f.x,f.y-18);c.rotate(f.angle);
    const half=f.cone*Math.PI/360,screen=f.screen;
    const left=screen?clamp(screen.angle-screen.half,-half,half):half;
    const right=screen?clamp(screen.angle+screen.half,-half,half):half;
    const gradient=c.createRadialGradient(0,0,6,0,0,f.r);
    gradient.addColorStop(0,'#fff0c5d0');gradient.addColorStop(.35,'#ffbc6690');gradient.addColorStop(1,'#ed553000');
    c.fillStyle=gradient;c.beginPath();
    const fan=(from,to,range)=>{
     if(from>=to)return;
     c.moveTo(0,0);c.arc(0,0,range,from,to);c.closePath();
    };
    fan(-half,left,f.r);
    if(screen)fan(left,right,screen.range);
    fan(right,half,f.r);c.fill();
    for(let i=0;i<15;i++){
     const at=.12+(i%5)*.17,a=Math.sin(i*8.4+f.age*10)*half*.8,length=f.r*at,r=7+at*21;
     if(screen&&a>=left&&a<=right&&length>screen.range)continue;
     c.save();c.translate(Math.cos(a)*length,Math.sin(a)*length);c.rotate(Math.PI/2+a);flame(c,0,r*.35,r*1.7,i+f.age*14);c.restore();
    }
   }
   else if(f.type==='shot'||f.type==='rocket-shot'){c.translate(f.x,f.y);c.rotate(f.angle);c.fillStyle='#ffedb0';c.beginPath();c.moveTo(0,-6);c.lineTo(24,0);c.lineTo(0,6);c.closePath();c.fill();}
   else if(f.type==='kill'&&f.flavor){
    if(visible(f.x,f.y))paintCapstoneKill(c,f,t,reduced);
   }
   else if(f.type==='impact'||f.type==='kill'){c.strokeStyle=f.type==='kill'?'#f9dcb4':'#fff1be';c.lineWidth=2;for(let i=0;i<4;i++){const a=i*TAU/4+f.age*4,r=5+t*16;c.beginPath();c.moveTo(f.x+Math.cos(a)*r,f.y-18+Math.sin(a)*r);c.lineTo(f.x+Math.cos(a)*(r+7),f.y-18+Math.sin(a)*(r+7));c.stroke();}}
   c.restore();
  }
  if(volley&&visible(volley.x,volley.y,20))paintCoastVolley(c,volley);
  if(chargeLane)paintChargeLane(c,s.boss,chargeLane,true);
  for(const q of s.enemyShots)if(visible(q.x,q.y))circle(c,q.x,q.y-18,6,'#b0422c','#ffe1a1',2);
  for(const h of rail?.forecast||[])if(visible(h.x,s.player.y,h.w))paintRailWarning(c,h,s.player.y,true,h===rail.bait);
  if(portRounds.length)paintPortPerimeter(c,portRounds.filter(h=>visible(h.x,h.y,blastContactRadius(h))));
  for(const h of s.hazards){
   const wide=h.portRound||h.coastMortar||h.signalCut||h.portBattery||h.relayDefense||h.conduitGun||(portBoss||rail)&&!h.lane;
   if(h.hit||!visible(h.x,h.lane?s.player.y:h.y,h.lane?h.w:wide?blastContactRadius(h):h.r))continue;
   if(h.lane){paintRailWarning(c,h,s.player.y,false,h===rail?.bait);continue;}
   if(h.coastMortar||h.signalCut||h.portBattery||h.conduitGun){
    if(!reduced&&Number.isFinite(h.fromX)&&Number.isFinite(h.fromY))paintCoastMortarFlight(c,h);
   }
   if(!h.portRound){
    if(wide)circle(c,h.x,h.y,blastContactRadius(h),null,'#ffc09c80',2);
    circle(c,h.x,h.y,h.r,'#d83d4120','#321e25',6);
    circle(c,h.x,h.y,h.r,null,'#ffada0',3);
   }
   circle(c,h.x,h.y,(h.portRound?24:h.r)*clamp(1-h.timer/(h.duration||.9),0,1),null,'#fff0bb',h.timer<.25?3:1);
   if(h.portRound==='rake'||h.portRound==='battery'){
    c.save();c.translate(h.x,h.y);
    if(h.portRound==='battery')c.rotate(Math.PI/2);
    c.strokeStyle='#ffd1a4';c.lineWidth=2;c.beginPath();
    for(const side of [-1,1]){
     const x=side*(h.r-10);
     c.moveTo(x,-9);c.lineTo(x+side*5,0);c.lineTo(x,9);
    }
    c.stroke();c.restore();
   }
   if(h.portRound==='lock'){
    c.strokeStyle='#ffe1bc';c.lineWidth=3;c.beginPath();
    for(let i=0;i<4;i++){
     const a=i*Math.PI/2,x=Math.cos(a),y=Math.sin(a);
     c.moveTo(h.x+x*10,h.y+y*10);c.lineTo(h.x+x*23,h.y+y*23);
    }
    c.stroke();
   }
   if(intercept&&h.portRound===intercept){
    circle(c,h.x,h.y,27,'#263a28b8','#e0f4ba',3);
    c.strokeStyle='#e0f4ba';c.lineWidth=3;c.beginPath();
    c.moveTo(h.x-10,h.y+9);c.lineTo(h.x+10,h.y-9);c.stroke();
   }
  }
  if(railFanLine&&visible(railFanLine.x,railFanLine.y,55))paintRailFanLine(c,railFanLine);
  if(rail?.slot)paintRailStop(c,s.player,rail.slot);
  if(portBoss&&art&&s.player.y<s.boss.y&&s.boss.y-s.player.y<145&&Math.abs(s.player.x-s.boss.x)<97){
   const {x,y}=s.player;
   circle(c,x,y,16,null,'#182a2c',6);
   circle(c,x,y,16,null,'#d8e9b8',2);
   c.strokeStyle='#d8e9b8';c.lineWidth=3;
   c.beginPath();c.moveTo(x-6,y-27);c.lineTo(x,y-21);c.lineTo(x+6,y-27);c.stroke();
  }
  if(focus)paintFocusTargets(c,focus,visible);
  paintPortWakeCue(c,s);
  paintPortEscape(c,s,escapeLanes);
  c.setTransform(size.dpr,0,0,size.dpr,0,0);const vignette=c.createRadialGradient(size.w/2,size.h/2,size.h*.2,size.w/2,size.h/2,size.w*.75);vignette.addColorStop(0,'#12232c00');vignette.addColorStop(1,'#12232c65');c.fillStyle=vignette;c.fillRect(0,0,size.w,size.h);
  const project=(x,y)=>({x:size.w/2+(x-cx+shake)*scale,y:size.h/2+(y-cy)*scale});
  const railMark=rail?.slot||railFanLine;
  if(railMark&&distance(s.player,railMark)<230){
   const ink=rail.slot?'#c7f2e3':'#ffe2a0';
   const label=rail.slot?(rail.mortar?'안전 위치':'차선 밖'):railFanLine.clear?'발사 대기':'포탑 사격 위치';
   const point=project(railMark.x,railMark.y);
   c.save();c.font='bold 12px Galmuri';
   const width=Math.ceil(c.measureText(label).width)+20;
   const at=clearBearingPosition(size,{x:point.x,y:point.y+25},width,combatHud.rects,10);
   if(at){
    c.beginPath();c.moveTo(point.x,point.y+9);c.lineTo(at.x,at.y-10);
    c.strokeStyle='#172822';c.lineWidth=4;c.stroke();
    c.strokeStyle=ink;c.lineWidth=1.5;c.stroke();
    c.fillStyle='#172822f5';c.fillRect(at.x-width/2,at.y-10,width,20);
    c.fillStyle=ink;c.fillRect(at.x-width/2,at.y-10,2,20);
    c.textAlign='center';c.fillText(label,at.x+1,at.y+4);
   }
   c.restore();
  }
  const equipped=s.stage==='field'&&s.phase==='playing'&&s.effects.findLast(f=>f.type==='complete'&&f.showcase&&f.text);
  if(equipped&&!s.hazards.some(h=>!h.hit&&h.timer>0&&distance(h,s.player)<blastContactRadius(h)+56)){
   const label=equipped.text.split(' · ')[0],ink=FORMATION_INK[equipped.showcase];
   c.save();c.font='bold 13px Galmuri';
   const width=Math.ceil(c.measureText(label).width)+27;
   const at=clearBearingPosition(size,project(s.player.x,s.player.y-77),width,combatHud.rects,12);
   if(at){
    const x=at.x-width/2,y=at.y-11;
    c.globalAlpha=reduced?1:clamp((1-equipped.age/equipped.life)*3,0,1);
    c.fillStyle='#162925ed';c.fillRect(x,y,width,22);
    c.fillStyle=ink;c.fillRect(x,y,3,22);c.fillRect(x+8,y+9,5,5);
    c.textAlign='left';c.fillText(label,x+19,at.y+4);
   }
   c.restore();
  }
  if(railSweep&&s.phase==='playing'&&!s.hazards.some(h=>!h.hit&&h.timer>0)){
   const {x,y,x2,y2,age,life}=railSweep,label='양쪽 대열 명중';
   const center=project((x+x2)/2,(y+y2)/2-40);
   c.save();c.font='bold 12px Galmuri';
   const at=clearBearingPosition(size,center,c.measureText(label).width+12,combatHud.rects,10);
   if(at){
    c.globalAlpha=Math.min(1,(1-age/life)*2.4);
    c.textAlign='center';c.lineWidth=4;c.strokeStyle='#20322c';c.strokeText(label,at.x,at.y+4);
    c.fillStyle='#ffe3a4';c.fillText(label,at.x,at.y+4);
   }
   c.restore();
  }
  if(lead)paintCoastCue(c,s,lead,guns,volley,counter,size,cx-shake,cy,scale,combatHud.rects,!!opening);
  if(mobile&&showAid)paintAidBearing(c,s,aid,size,cx,cy,scale,combatHud.rects);
  if(mobile&&size.h>size.w&&combatHud.passive?.length&&s.phase==='playing'){
   return coveredCombatPanels(s,combatHud.passive,project,scale);
  }
 }
 return{draw,view:()=>view,resize};
}
