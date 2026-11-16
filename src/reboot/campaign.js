import {FIELD,MODULES,RULES,INFERNO_CORE_DISTANCE,isCapturedTurret,isConductiveFusion,isFocusedInferno,isTrailInferno,blastContactRadius,clamp,distance,layout,moduleRank,rayBoxDistance,railSpareForFlame} from './content.js';
import {routeCursor} from './raid.js';
import {COAST_SALVAGE,RESCUE_COIL,coastAtShore,coastTurretReturned,isCoastRailSortie,isSalvageCampaign,canAdvanceFront,railSortieReturned} from './coast-salvage.js';

export const REGIONS=[
 {id:'beach',name:'해안 침투',mission:'장갑 수송차를 격파하고 철도로 진입하라',boss:'장갑 수송차',hp:4200,partHp:450,theme:{ground:'#a49874',tile:'#c0ae88',road:'#59584a',edge:'#415d69'},hint:'해변에서 무기를 확보하고 분화를 정하세요.'},
 {id:'rail',name:'철도 차단',mission:'포격 열차의 양쪽 포대를 부수고 항구로 진입하라',boss:'포격 열차',hp:6200,partHp:650,theme:{ground:'#64716a',tile:'#a0aaa0',road:'#343f41',edge:'#344d4c'},hint:'화차 사이를 우회하세요. 포격 예고 밖이 안전합니다.'},
 {id:'port',name:'항구 결전',mission:'지휘 병기를 파괴하고 살아서 귀환하라',boss:'지휘 병기',hp:9000,partHp:850,theme:{ground:'#4b606b',tile:'#8fa1a8',road:'#2e414c',edge:'#1b3a50'},hint:'관제소를 확보하면 최종전 증원을 줄일 수 있습니다.'}
];
export const region=s=>REGIONS[s.operation?.region||0];
export const HOLDOUT={grace:6,tierSeconds:10,maxTier:6,rareKills:8,coastReserveDelay:2.25,railReserveDelay:3.1};
export const HOLDOUT_CONTRACTS=[
 {id:'hunt',name:'지휘부 소탕',goal:'지휘관 2명 제압',risk:'양쪽에서 오는 장교의 부채꼴 사격'},
 {id:'defend',name:'중계기 방어',goal:'안전한 방어 범위에서 8초 송신',risk:'포격 원 안에서는 송신 중단'},
 {id:'intercept',name:'탈출 차량 저지',goal:'18초 안에 통신 차량 파괴',risk:'하역장 바깥 굽이에서 차량의 진로를 끊으세요.'}
];
export const SORTIE_ORDERS={
 wire:{name:'전파 절단',site:'해안 통신소',action:'박격포 제압 · 5초 해킹 · 철도 조준 유인',fee:70,bonus:180,color:'#bde3cf',recordRevision:'cipher-supply'},
 convoy:{name:'보급선 절단',site:'해안 무기고',action:'무기고에서 보급을 걸고 경량 보급차 저지',fee:70,bonus:180,color:'#f2ce91'}
};
export const sortieOrder=id=>Object.hasOwn(SORTIE_ORDERS,id)?SORTIE_ORDERS[id]:null;
export const orderRecordScope=(scope,revision)=>revision?`${scope}/${revision}`:scope;
export const orderBonus=r=>r.won&&r.operation?.orderDone?sortieOrder(r.operation.order)?.bonus||0:0;
export function orderTarget(s){
 if(s.operation?.region!==0||s.stage==='boss'||s.operation.orderDone||!sortieOrder(s.operation.order))return null;
 return s.sites.find(site=>site.id==='arsenal'&&site.state!=='done')||null;
}
const WIRE_GARRISON={crew:'박격포',unit:'문',range:245,hint:'바깥쪽 박격포를 끊고 통신소를 해킹하세요.',guards:[
 ['shield',22,44],['rifle',-50,25],['mortar',-86,-100]
]};
export const wireSupplyUnlocked=s=>s.operation?.order==='wire'&&s.operation.orderRevision===SORTIE_ORDERS.wire.recordRevision&&s.operation.orderDone===true;
const hasWireOrder=s=>s.operation?.order==='wire'&&[SORTIE_ORDERS.wire.recordRevision,'rail-lure'].includes(s.operation.orderRevision);
export const wireGarrison=(s,site)=>s.operation?.region===0&&hasWireOrder(s)&&site?.id==='arsenal'?WIRE_GARRISON:null;
export const FRONT_SUPPORTS={
 breach:{name:'철갑 급탄',role:'부위 조준',art:'ammo',impact:'보스 부위 우선 조준 · 피해 +55%',detail:'측면에서 부위가 사거리에 들어오면 차체보다 먼저 조준합니다.',tactics:['조준 중인 포대를 부수면 해당 포격이 멈춥니다.','포탑을 먼저 파괴하면 재장전 직전 부채꼴 사격이 멈춥니다.']},
 overrun:{name:'돌격 신관',role:'재장전 돌입',art:'coil',impact:'회피 충격파 · 빈틈에 기본 피해 260',detail:'회피가 끝날 때 일반 적을 폭파하고, 재장전 중인 보스에도 근접 충격을 줍니다.',tactics:['포격이 끝나면 차선 밖에서 열차 쪽으로 회피하세요.','집중 포격을 벗어난 뒤 노출 코어 쪽으로 회피하세요.']},
 recovery:{name:'회수 의무 장비',role:'측면 순환',art:'medic',impact:'XP 회수 반경 +55 · 측면 구조 화물',detail:'보스의 첫 세 번 재장전 때 측면에 XP 18이 떨어집니다. XP를 회수해 체력을 회복합니다.',tactics:['재장전 때 좌우 선로 밖으로 돌아 구조 화물을 회수하세요.','포격 직후 컨테이너 앞 측면의 구조 화물을 주우세요.']},
 vanguard:{name:'선발 지원',role:'첫 포격 선행 경보',art:'medic',heal:20,stabilize:.6,charge:20,warning:1,tactics:['첫 차선 경고가 1초 길어집니다. 빈 차선으로 이동하세요.','첫 집중 포격 경고가 1초 길어집니다. 포격원을 보고 이동하세요.']}
};
const RARE_PARTS=['breach','overrun','recovery'];
export function holdoutParts(seed,front){
 const missing=(((seed^(seed>>>16))>>>0)+front*2+2)%RARE_PARTS.length;
 return RARE_PARTS.filter((_,index)=>index!==missing);
}
export const canAdvanceWithVanguard=s=>canAdvanceFront(s)&&!isCoastRailSortie(s)&&!(isSalvageCampaign(s)&&coastAtShore(s))&&s.stage==='holdout'&&s.holdTime<HOLDOUT.grace&&!s.challenge&&!s.operation.nextSupport;
export function vanguardAid(player){
 const kit=FRONT_SUPPORTS.vanguard;
 return {
  hp:Math.min(player.maxHp,Math.max(player.hp+kit.heal,Math.ceil(player.maxHp*kit.stabilize))),
  charge:Math.min(100,player.charge+kit.charge)
 };
}
export const PORT_TURRET={shutterDamage:.16};
export const PORT_BARRAGE={warning:.95,radius:58,batteryOffset:114,turretOffset:116,turretSpread:54};
export const PORT_CENTER={x:800,y:390};
export const PORT_CROSSFIRE={distance:208,halfWidth:24,halfDepth:12,flightLead:.42};
export const portCrossfireCuts=(s,cycle)=>s.operation?.tactic==='crossfire'&&s.boss.crossfireCycle===cycle;
export function portCrossfireZone(s){
 const b=s.boss;
 if(s.operation?.region!==2||s.operation.tactic!=='crossfire'||!b.active||b.dead||b.parts.some(p=>p.hp<=0)||!s.weapons.some(isCapturedTurret))return null;
 const {distance:gap,halfWidth,halfDepth,flightLead}=PORT_CROSSFIRE;
 const x=b.x,y=b.y+gap,inside=Math.abs(s.player.x-x)<=halfWidth&&Math.abs(s.player.y-y)<=halfDepth;
 return {x,y,halfWidth,halfDepth,inside,ready:inside&&b.mode==='recover'&&b.timer>=flightLead&&!portCrossfireCuts(s,b.cycle+1)};
}
export function portBarrageAxis(s,cycle){
 const gantry=s.operation.portEntry==='gantry';
 return (cycle%2===0)===gantry?'horizontal':'vertical';
}
export const portJamsSweep=(s,cycle)=>s.operation.jammed&&cycle===(s.operation.portEntry==='gantry'?2:1);
export const portRelayCuts=(s,cycle,part)=>s.operation?.region===2&&s.operation.support==='overrun'
 &&s.boss.harborRelayPart===part&&s.boss.harborArcCycle+1===cycle
 &&(part!=='armor'||portBarrageAxis(s,cycle)!=='horizontal'||!portJamsSweep(s,cycle));
export function portSignalCuts(s,cycle,part){
 const b=s.boss,signal=b.portSignal;
 if(!signal||s.operation?.region!==2||s.operation.tactic!=='signal'||signal.part!==part||signal.cycle+1!==cycle||portRelayCuts(s,cycle,part))return false;
 return part==='turret'?b.parts[0].hp>0:b.parts[1].hp>0&&b.armorSuppressedCycle!==cycle&&!(portBarrageAxis(s,cycle)==='horizontal'&&portJamsSweep(s,cycle));
}
export function portAuxiliaryRound(s,cycle,applyCrossfire=true){
 if(applyCrossfire&&portCrossfireCuts(s,cycle))return null;
 if(s.boss.parts[1].hp<=0||s.boss.armorSuppressedCycle===cycle||portRelayCuts(s,cycle,'armor')||portSignalCuts(s,cycle,'armor'))return null;
 if(portBarrageAxis(s,cycle)==='vertical')return 'battery';
 return portJamsSweep(s,cycle)?null:'rake';
}
export const portBarrageMark=(axis,side)=>axis==='horizontal'?'↑↓':side>0?'←':side<0?'→':'←→';
export function portBarrageRounds(s,cycle,applyCrossfire=true){
 const {boss:b,player:p}=s,plan=PORT_BARRAGE,auxiliary=portAuxiliaryRound(s,cycle,applyCrossfire),rounds=[];
 const crossfire=applyCrossfire&&portCrossfireCuts(s,cycle);
 const push=(dx,dy,portRound)=>rounds.push({
  x:clamp(p.x+dx,FIELD.left,FIELD.right),y:clamp(p.y+dy,FIELD.top,FIELD.bottom),r:plan.radius,portRound
 });
 push(0,0,'lock');
 for(const side of [-1,1]){
  if(auxiliary==='rake')push(side*plan.batteryOffset,0,auxiliary);
  else if(auxiliary==='battery')push(0,side*plan.batteryOffset,auxiliary);
  if(!crossfire&&b.parts[0].hp>0&&b.emberCycle!==cycle&&!portRelayCuts(s,cycle,'turret')&&!portSignalCuts(s,cycle,'turret'))push(portTurretSide(b)*plan.turretOffset,side*plan.turretSpread,'turret');
 }
 return rounds;
}
const PORT_ESCAPE_X=[{dx:-1,dy:0,label:'왼쪽'},{dx:1,dy:0,label:'오른쪽'}];
const PORT_ESCAPE_Y=[{dx:0,dy:-1,label:'위'},{dx:0,dy:1,label:'아래'}];
const PORT_ESCAPE_AXES=[...PORT_ESCAPE_X,...PORT_ESCAPE_Y];
const portDiagonals=angles=>PORT_ESCAPE_X.flatMap(x=>PORT_ESCAPE_Y.flatMap(y=>angles.map(angle=>({
 dx:x.dx*Math.cos(angle*Math.PI/180),dy:y.dy*Math.sin(angle*Math.PI/180),label:`${x.label} ${y.label}`
}))));
const PORT_ESCAPE_DIAGONAL=portDiagonals([45]),PORT_ESCAPE_ANALOG=portDiagonals([30,45,60]);
export function portEscapeLanes(s,rounds,analog=false){
 const p=s.player,threats=rounds.map(round=>({round,r:blastContactRadius(round),gap:distance(p,round)}));
 const inside=threats.filter(h=>h.gap<h.r);
 if(!inside.length)return [];
 const locked=inside.some(h=>h.round.portRound==='lock');
 const preferred=locked&&(rounds.some(h=>h.portRound==='rake')?PORT_ESCAPE_Y
  :rounds.some(h=>h.portRound==='battery')?PORT_ESCAPE_X:null);
 const boss=s.boss?.active&&!s.boss.dead?s.boss:null;
 const diagonals=analog?PORT_ESCAPE_ANALOG:PORT_ESCAPE_DIAGONAL;
 function route(lane){
  const {dx,dy}=lane;
  const projection=h=>(h.x-p.x)*dx+(h.y-p.y)*dy;
  // The endpoint needs to clear every circle the player is standing in.
  const reach=Math.max(...inside.map(({round,r,gap})=>{
   const depth=projection(round);
   return depth+Math.sqrt(r*r-gap*gap+depth*depth);
  }))+10;
  const x=p.x+dx*reach,y=p.y+dy*reach;
  if(x<FIELD.left+16||x>FIELD.right-16||y<FIELD.top+16||y>FIELD.bottom-16)return null;
  if(s.blocks.some(b=>b.hp!==0&&rayBoxDistance(p,dx,dy,b,16)<reach))return null;
  function clears(h,r,alreadyInside){
   const at=alreadyInside?reach:clamp(projection(h),0,reach);
   return Math.hypot(p.x+dx*at-h.x,p.y+dy*at-h.y)>=r;
  }
  // Give the drifting hull extra room. A pilot already within that margin must head away.
  if(boss){
   const margin=boss.r+32,inHull=distance(p,boss)<margin;
   if((inHull&&projection(boss)>0)||!clears(boss,margin,inHull))return null;
  }
  return threats.every(({round,r,gap})=>clears(round,r,gap<r))?{...lane,reach}:null;
 }
 if(preferred){
  const cardinal=preferred.map(route).filter(Boolean);
  if(cardinal.length)return cardinal;
 }
 return [...PORT_ESCAPE_AXES,...diagonals].map(route).filter(Boolean)
  .sort((a,b)=>a.reach-b.reach).slice(0,1);
}
export const PORT_LANDING={range:215,guards:[
 ['shield',52,30],['shield',98,8],['rifle',-25,25],['rifle',15,-29],
 ['mortar',-45,-180],['mortar',-83,-130]
]};
export const PORT_SUPPORT={
 breach:{impact:'포탑 쪽은 탄막 차단 · 장갑 쪽은 보조포 차단',detail:'포탑 측면 피해 +65%. 반대편 장갑의 급탄부는 조준 중 선제 타격하거나 착탄 전에 끊을 수 있습니다.',hint:'끊고 싶은 포대 쪽으로 돌아 사선 확보',flank:105,boost:1.65},
 overrun:{impact:'재장전 중 회피로 코어 직격 320 · 장갑 해제',detail:'코어 원 밖에서는 안으로, 안에서는 좌우로 회피하세요. 코어 장갑이 풀리고 재장전이 0.9초 늘어납니다.',hint:'포격 뒤 재장전 · 이동하며 회피',reach:100,focusedReach:260,sideStep:48,damage:320,delay:.9,arcDamage:210,wakeDamage:320},
 recovery:{impact:'측면 화물 → 차체 또는 장갑에 반격',detail:'화물로 체력 +12, 전탄 +20. 경고 중 안전 회수는 전탄 +45와 회피 재정비. 안전한 곳에서 장갑탄 원 가장자리에 접근하면 지원 포격 표적이 차체에서 장갑으로 바뀝니다.',hint:'화물 회수 · 장갑탄 가장자리에서 표적 변경',heal:12,charge:20,warningCharge:45,dashDelay:.35,counterDamage:360,interceptMargin:24,reach:36,limit:3,lanes:[625,975],y:335}
};
export const supportTactic=(id,index)=>(index===2&&PORT_SUPPORT[id]?.hint)||FRONT_SUPPORTS[id]?.tactics[index-1]||'';
export const portTurretSide=boss=>Math.sign(boss.parts[0]?.ox)||-1;
export const portSideName=side=>side<0?'왼쪽':'오른쪽';
export const portFlankPoint=(boss,side=portTurretSide(boss))=>({x:boss.x+side*142,y:boss.y+95});
export function portPartStaging(s){
 if(s.operation?.region!==2||s.stage!=='field')return null;
 const b=s.boss,part=s.operation.support,turret=portTurretSide(b);
 if(part==='breach'&&portAuxiliaryRound(s,1)){
  return {x:b.x-turret*164,y:b.y+144,r:44,name:`${portSideName(-turret)} 보조포`,color:'#f0cf9c',part,
   sign:'보조포 선제 사격',hint:'조준 중 장갑을 쏘고 남은 포격을 피하세요.'};
 }
 if(part==='overrun'){
  const arc=s.weapons.some(isConductiveFusion),trail=s.weapons.some(isTrailInferno),side=arc&&!trail?turret:-turret;
  return {x:b.x+side*128,y:b.y+178,r:36,name:`${portSideName(side)} 돌입선`,color:'#ffb399',part,
   sign:'재장전 돌입',hint:'첫 포격을 피한 뒤 재장전 때 코어로 회피하세요.'};
 }
 if(part==='recovery'){
  const crate=portAidPoint(b,1),side=Math.sign(crate.x-b.x);
  return {x:crate.x,y:crate.y+102,r:24,name:`${portSideName(side)} 화물 유인점`,color:'#c7e9b0',part,
   sign:'구급 화물 회수',hint:'조준원이 고정되면 위쪽 화물로 이동하세요.'};
 }
 return null;
}
export const portWakePoint=boss=>({x:boss.x-portTurretSide(boss)*134,y:boss.y+86,r:12});
const portOpeningShutter=s=>s.operation?.region===2&&s.boss.active&&!s.boss.dead&&s.boss.parts[0]?.hp>0&&(s.boss.cycle===0&&s.boss.mode==='aim'||s.boss.cycle===1&&s.boss.mode==='salvo');
const portTurretFlank=s=>(s.player.x-s.boss.x)*portTurretSide(s.boss)>=PORT_SUPPORT.breach.flank;
export const portGantryBypass=s=>s.operation?.portEntry==='gantry'&&portOpeningShutter(s)&&portTurretFlank(s);
export const portTurretShutter=s=>portOpeningShutter(s)&&!portGantryBypass(s);
export const portBreachFlank=s=>s.operation?.region===2&&s.operation.support==='breach'&&s.boss.active&&!s.boss.dead&&s.boss.parts[0]?.hp>0&&portTurretFlank(s);
export const portArmorExposed=s=>s.operation?.region===2&&s.operation.support==='breach'&&s.boss.active&&!s.boss.dead
 &&s.boss.parts[1]?.hp>0;
export const portArmorRound=s=>portArmorExposed(s)&&s.boss.mode==='salvo'
 ?s.hazards.find(h=>!h.hit&&(h.portRound==='rake'||h.portRound==='battery'))?.portRound
 :null;
export function portArmorOpportunity(s){
 if(!portArmorExposed(s))return;
 const b=s.boss;
 if(b.mode==='aim'&&portAuxiliaryRound(s,b.cycle+1))return b.cycle+1;
 if(portArmorRound(s))return b.cycle;
}
export const portArmorFlank=s=>(s.player.x-s.boss.x)*-portTurretSide(s.boss)>=PORT_SUPPORT.breach.flank;
export const portCoreWindow=s=>s.operation?.region===2&&s.operation.support==='overrun'&&s.boss.active&&!s.boss.dead&&s.boss.mode==='recover'&&s.boss.harborStrikeCycle!==s.boss.cycle;
export const portCoreDisrupted=s=>s.operation?.region===2&&s.operation.support==='overrun'&&s.boss.active&&!s.boss.dead&&s.boss.mode==='recover'&&s.boss.harborStrikeCycle===s.boss.cycle;
export const portWakeBreach=s=>s.operation?.region===2&&s.operation.support==='overrun'&&s.weapons.some(isTrailInferno);
export function portWakeMode(s){
 const b=s.boss,control=s.operation?.tactic==='wake';
 if(s.operation?.region!==2||!b.active||b.dead||b.mode!=='recover'||b.harborWakeCycle===b.cycle||control&&b.tacticCycle===b.cycle)return null;
 if(portWakeBreach(s)&&portCoreDisrupted(s))return 'overrun';
 return control?'control':null;
}
export const portCoreReach=s=>s.weapons.some(isFocusedInferno)?PORT_SUPPORT.overrun.focusedReach:s.boss.r+PORT_SUPPORT.overrun.reach;
export const portCompressionBand=(s,gap=distance(s.player,s.boss))=>s.weapons.some(isFocusedInferno)&&gap>=INFERNO_CORE_DISTANCE&&gap<=PORT_SUPPORT.overrun.focusedReach;
export const portCompressionRange=`${INFERNO_CORE_DISTANCE/10}~${PORT_SUPPORT.overrun.focusedReach/10}m`;
export const portAidCounterReady=s=>s.operation?.region===2&&s.operation.support==='recovery'&&s.boss.active&&!s.boss.dead&&s.boss.harborCounter===true;
export const PORT_AID_INTERCEPT={
 lock:{key:'locks',label:'발밑 조준탄 차단',short:'발밑탄 차단'},
 rake:{key:'rakes',label:'가로 장갑탄 차단',short:'가로탄 차단'},
 battery:{key:'batteries',label:'세로 장갑탄 차단',short:'세로탄 차단'}
};
export function portAidCounterRound(s){
 if(!portAidCounterReady(s))return null;
 const rounds=s.hazards.filter(h=>!h.hit&&Object.hasOwn(PORT_AID_INTERCEPT,h.portRound));
 const threatened=rounds.filter(h=>roundThreatens(h,s.player));
 if(threatened.length)return threatened.sort((a,b)=>a.timer-b.timer||distance(a,s.player)-distance(b,s.player)||Number(a.portRound==='lock')-Number(b.portRound==='lock'))[0];
 // From safety, approach either auxiliary line's rim to switch the counterstrike to armor.
 const auxiliary=rounds.filter(h=>h.portRound!=='lock'&&distance(h,s.player)<blastContactRadius(h)+PORT_SUPPORT.recovery.interceptMargin)
  .sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];
 return auxiliary||rounds.find(h=>h.portRound==='lock')||null;
}
export function portAidCounterTarget(s,round=portAidCounterRound(s)){
 if(!portAidCounterReady(s))return null;
 const b=s.boss;
 if(round?.portRound==='lock')return b;
 return b.parts[1].hp>0?b.parts[1]:null;
}
export function portAidPoint(boss,cycle){
 const kit=PORT_SUPPORT.recovery,side=(cycle%2?-1:1)*portTurretSide(boss);
 return {x:kit.lanes[side<0?0:1],y:kit.y};
}
export function portAidPreview(s){
 const {boss:b}=s;
 if(s.operation?.region!==2||s.operation.support!=='recovery'||!b.active||b.dead||b.harborSupply)return null;
 const duringWarning=b.mode==='salvo'&&b.harborSupplyCycle!==b.cycle;
 const cycle=duringWarning?b.cycle:b.cycle+1;
 return cycle>0&&cycle<=PORT_SUPPORT.recovery.limit?portAidPoint(b,cycle):null;
}
export function portAidWindow(s,position){
 const b=s.boss,crate=b.harborSupply;
 if(!crate||b.mode!=='salvo'||b.harborSupplyCycle!==b.cycle)return false;
 const pending=s.hazards.filter(h=>h.portRound&&!h.hit);
 return pending.length>0&&pending.every(h=>!roundThreatens(h,crate)&&(!position||!roundThreatens(h,position)));
}
const roundThreatens=(round,point)=>distance(round,point)<blastContactRadius(round);
export const portAidBaitRisk=(s,point)=>s.boss.mode!=='salvo'&&portBarrageRounds(s,s.boss.cycle+1).some(round=>roundThreatens(round,point));
export function portAidCue(s){
 const b=s.boss;
 const point=b.harborSupply||portAidPreview(s);
 if(!point||s.operation?.region!==2||!b.active||b.dead)return null;
 const pending=s.hazards.filter(h=>h.portRound&&!h.hit);
 const endangered=pending.some(h=>roundThreatens(h,s.player));
 if(!b.harborSupply){
  const risk=portAidBaitRisk(s,point);
  return {point,preview:true,state:risk?'bait':'incoming',endangered};
 }
 const threatened=pending.some(h=>roundThreatens(h,point));
 const fresh=pending.length>0&&b.mode==='salvo'&&b.harborSupplyCycle===b.cycle;
 const state=threatened?'blocked':endangered?'evade':fresh?'safe':'collect';
 return {point,state,endangered,timer:fresh?Math.min(...pending.map(h=>h.timer)):0};
}
export const RAIL_BARRAGE={width:180,depth:900,y:600,outerOffset:300,warning:1.25,recover:2.2};
export const railDisarmed=boss=>boss.parts.every(part=>part.hp<=0);
// Fixed outer lanes in old checkpoints also belong to a gun.
export const railGunOf=hazard=>hazard.railGun??(hazard.x===500?0:hazard.x===1100?1:null);
export const railGunLabel=index=>index===0?'좌포':index===1?'우포':'포대';
export const RAIL_GUN_COLORS=['#f2cb8f','#a8dcd4'];
export const railLaneLabel=(h,locked=false)=>`${railGunLabel(railGunOf(h))} · ${h.tracked?(locked?'유인':'추적'):'측면'}`;
export const railHasRelay=s=>s.sites.some(site=>site.kind==='relay'&&site.state==='done');
export const railHasWire=s=>s.operation?.region===1&&hasWireOrder(s)&&s.operation.orderDone===true;
export const railDecoyReady=s=>s.operation?.region===1&&s.stage==='boss'&&s.boss.active&&!s.boss.dead
 &&s.boss.mode==='aim'&&!s.boss.railDecoy&&!railDisarmed(s.boss)&&(railHasRelay(s)||railHasWire(s));
export const railDecoyLocked=s=>s.operation?.region===1&&s.boss.active&&s.boss.mode==='aim'
 &&s.boss.railDecoy?.cycle===s.boss.cycle+1;
export function railBarrageAim(s,cycle){
 const {boss:b,player:p}=s;
 const near=p.x===b.x?cycle%2:p.x<b.x?0:1;
 return {x:p.x,lead:b.parts[near]?.hp>0?near:1-near};
}
export function railBarrageRounds(s,cycle){
 const b=s.boss,plan=RAIL_BARRAGE;
 const {x,lead}=b.railDecoy?.cycle===cycle?b.railDecoy:railBarrageAim(s,cycle);
 const wing=1-lead;
 const left=Math.max(FIELD.left,x-plan.width/2),right=Math.min(FIELD.right,x+plan.width/2);
 const round=(x,w,railGun,tracked)=>({x,y:plan.y,w,h:plan.depth,r:0,lane:true,railGun,tracked});
 const rounds=[];
 if(b.parts[lead]?.hp>0)rounds.push(round((left+right)/2,right-left,lead,true));
 if(b.parts[wing]?.hp>0)rounds.push(round(b.x+(wing===0?-1:1)*plan.outerOffset,plan.width,wing,false));
 return rounds;
}
export function railBarragePreview(s){
 return s.operation?.region===1&&s.boss.active&&s.boss.mode==='aim'&&(railHasRelay(s)||railHasWire(s)&&!s.boss.railDecoy||railDecoyLocked(s))?railBarrageRounds(s,s.boss.cycle+1):[];
}
export function railLaneBounds(h){
 const width=h.w+32,height=h.h+32;
 return {left:h.x-width/2,right:h.x+width/2,top:h.y-height/2,bottom:h.y+height/2,width,height};
}
export function railLaneContains(h,p){
 const lane=railLaneBounds(h);
 return p.x>lane.left&&p.x<lane.right&&p.y>lane.top&&p.y<lane.bottom;
}
export function railEscapeSlot(s,rounds){
 const {player:p,boss}=s;
 const lanes=rounds.map(railLaneBounds).filter(lane=>p.y>lane.top&&p.y<lane.bottom);
 if(!lanes.some(lane=>p.x>lane.left&&p.x<lane.right))return {danger:false,slot:null};
 for(const h of s.hazards){
  const radius=blastContactRadius(h),dy=h.y-p.y;
  if(h.hit||h.lane||Math.abs(dy)>=radius)continue;
  const width=Math.sqrt(radius**2-dy**2);
  lanes.push({left:h.x-width,right:h.x+width});
 }
 lanes.sort((a,b)=>a.left-b.left);
 let left=FIELD.left+16,right=FIELD.right-16;
 const cover=s.blocks.filter(b=>b.hp!==0&&p.y>b.y-16&&p.y<b.y+b.h+16).map(b=>[b.x-16,b.x+b.w+16]);
 if(boss?.active&&Math.abs(boss.y-p.y)<boss.r+16){
  const reach=Math.sqrt((boss.r+16)**2-(boss.y-p.y)**2);
  cover.push([boss.x-reach,boss.x+reach]);
 }
 for(const [from,to] of cover){
  if(to<=p.x)left=Math.max(left,to);
  else if(from>=p.x)right=Math.min(right,from);
  else return {danger:true,slot:null};
 }
 const slots=[];
 const add=(from,to)=>{
  if(to-from<24)return;
  const inset=Math.min(24,(to-from)/2);
  const x=p.x<from?from+inset:to-inset;
  slots.push({x,y:p.y,left:from,right:to});
 };
 let cursor=left;
 for(const lane of lanes){
  if(lane.right<=cursor)continue;
  add(cursor,Math.min(right,lane.left));
  cursor=Math.max(cursor,lane.right);
  if(cursor>=right)break;
 }
 add(cursor,right);
 const slot=slots.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||null;
 return {danger:true,slot};
}
export function railBossGuide(s,fan){
 if(s.operation?.region!==1||!s.boss.active)return null;
 const rounds=s.hazards.filter(h=>h.lane&&!h.hit&&h.timer>0);
 const stray=s.hazards.filter(h=>!h.lane&&!h.hit&&h.timer>0);
 const mortar=stray.reduce((soonest,h)=>distance(s.player,h)<blastContactRadius(h)&&
  (!soonest||h.timer<soonest.timer)?h:soonest,null);
 const padBlocked=fan&&stray.some(h=>{
  const x=clamp(h.x,fan.x-fan.halfWidth,fan.x+fan.halfWidth),y=clamp(h.y,fan.y-fan.halfDepth,fan.y+fan.halfDepth);
  return Math.hypot(h.x-x,h.y-y)<blastContactRadius(h);
 });
 const locked=railDecoyLocked(s),forecast=railBarragePreview(s),lanes=locked?forecast:rounds;
 const cycle=locked?s.boss.cycle+1:s.boss.cycle;
 const bait=s.boss.railDecoy?.cycle===cycle?lanes.find(h=>h.tracked)??null:null;
 const dodge=lanes.length?railEscapeSlot(s,lanes):null;
 const time=rounds.length?Math.min(...rounds.map(h=>h.timer)):null;
 // Leave room to walk out after launch, even if a shell is stopped by cover.
 const wait=fan?.state==='ready'&&!mortar&&!padBlocked&&(!dodge?.danger||!!dodge.slot&&
  fan.cooldown+Math.abs(dodge.slot.x-s.player.x)/RULES.player.speed+.12<time);
 const escape=!!dodge?.danger&&!wait;
 const pad=fan&&!mortar&&!padBlocked&&!escape&&(['approach','hold','recover'].includes(fan.state)||wait)?fan:null;
 return {fan,rounds,mortar,locked,forecast,lanes,bait,time,wait,escape,slot:escape?dodge.slot:null,pad};
}
export const FRONT_TACTICS={
 1:{
  heat:{name:'냉각 밸브 차단',role:'화염 · 측면 진입',impact:'재장전 중 측면에 붙어 분사하면 포대와 차체 피해 +45%',hint:'고정된 조준선을 피한 뒤 열차 옆에 붙어 불을 쏘세요.',range:176,side:55,boost:1.45},
  signal:{name:'포대 신호 역송',role:'전도 · 원거리 연쇄',impact:'원거리 역송 · 담당 포격 차단 · 재장전 +0.8초',hint:'포격선 밖에서 22m 이상 거리를 두고 역송하세요.',range:220,hop:220,delay:.8}
 },
 2:{
  heat:{name:'코어 냉각 차단',role:'화염 · 근접 돌파',impact:'근접 분사 · 코어·장갑 피해 +55%',hint:'붉은 포격 범위를 피해 노출 코어에 붙으세요.',range:168,boost:1.55},
  wake:{name:'냉각 배관 점화',role:'연료 살포 · 측면 우회',impact:'재장전 중 배관에 불길이 닿으면 장갑 또는 차체 피해 180',hint:'포격 뒤 표시된 냉각 배관 옆을 달려 지나가세요.',damage:180},
  signal:{name:'포탑 교신 탈취',role:'로켓·전기 · 원거리 제압',impact:'원거리 적중 · 포탑 전류 도약',hint:'재장전 중 원거리에서 사격해 증원을 늦춥니다.',range:220,hop:280,delay:3},
  lens:{name:'코어 재장전 지연',role:'압축 분사 · 사선 유지',impact:'코어 직격으로 재장전 +0.8초',hint:'포격 뒤 중거리에서 멈춰 압축 분사를 코어에 맞히세요.',delay:.8},
  ember:{name:'포탑 급탄선 단선',role:'점화 탄두 · 포탑 유폭',impact:'포탑 옆 유폭 · 이번 또는 다음 포탑탄 차단',hint:'살아 있는 포탑과 보병 한 명을 화약에 넣으세요.'},
  crossfire:{name:'양쪽 급탄 차단',role:'노획 포탑 · 정면 중거리',impact:'한 번에 두 부위 직격 · 다음 양측 포격 차단',hint:'재장전 중 차체 앞 20m 사격선에 서면 부채꼴 바깥 탄이 두 부위를 노립니다.'}
 }
};
export const PORT_CONDUCTIVE_SIGNAL={side:72,damage:210,name:'측면 교신 역송',role:'전도 격발망 · 좌우 포대 선택',impact:'선택한 쪽의 다음 포격 차단',hint:'재장전 중 차체에서 22m 이상 거리를 두고 좌우로 이동해 자동 사격을 맞히세요.'};
export const portConductiveSignal=s=>isSalvageCampaign(s)&&s.operation.region===2&&s.weapons.some(isConductiveFusion);
export function frontTactic(s,key=s.operation?.tactic){
 return key==='signal'&&portConductiveSignal(s)?PORT_CONDUCTIVE_SIGNAL:FRONT_TACTICS[s.operation?.region]?.[key];
}
export function portBuildApproach(s){
 if(!isSalvageCampaign(s)||s.operation.region<1)return null;
 const fan=s.weapons.find(w=>w.evolved&&isCapturedTurret(w)),conductive=s.weapons.find(isConductiveFusion);
 const selected=s.operation.region===2?s.operation.tactic:null;
 if(fan&&(!selected||selected==='crossfire'))return {key:'crossfire',color:'#f4ca87',art:'turret',weapon:fan,
  name:FRONT_TACTICS[2].crossfire.name,position:'정면 20m · 재장전 중 양쪽 직격'};
 if(conductive&&(!selected||selected==='signal'))return {key:'signal',color:'#9cdde1',art:'h',weapon:conductive,
  name:PORT_CONDUCTIVE_SIGNAL.name,position:'측면 22m 이상 · 재장전 중 포대 선택'};
 return null;
}
export function portTacticKeys(s){
 const fire=s.weapons.some(isFocusedInferno)?'lens':s.weapons.some(isTrailInferno)?'wake':'heat';
 const incendiary=s.weapons.some(w=>w.fusion?.branch==='incendiary');
 if(isSalvageCampaign(s)){
  const fan=s.weapons.some(isCapturedTurret);
  return [...(fan?['crossfire']:[]),...(s.weapons.some(w=>w.id==='f')?[fire]:[]),
   ...(!fan||s.weapons.some(w=>w.fusion)?[incendiary?'ember':'signal']:[])];
 }
 return [fire,incendiary?'ember':'signal'];
}
const PORT_COUNTERBATTERY={id:'battery',name:'포격 진지 제압',goal:'양쪽 박격포 2문 제압',risk:'교차 포격 · 엄폐를 돌아 한 문씩'};
export function holdoutContract(s,tier=(s.operation?.challengeTier||0)+1){
 const front=s.operation?.region||0;
 const legacy=s.challenge?.state==='active'&&s.challenge.type==='intercept'&&s.challenge.tier===tier;
 return front===2&&tier%2===0&&!legacy?PORT_COUNTERBATTERY:HOLDOUT_CONTRACTS[front];
}
const BATTERY_POSITIONS=[{x:565,y:400},{x:1100,y:365}];
export const portBatteryPositions=seed=>BATTERY_POSITIONS.map(({x,y})=>({x:seed%2?x:1600-x,y}));
export const portBatterySide=point=>point.x<800?'서쪽':'동쪽';
export function portBatteries(s){
 const c=s.challenge;
 return c?.type==='battery'&&c.state==='active'?s.enemies.filter(e=>!e.dead&&e.hp>0&&c.targets.includes(e.id)):[];
}
export const signalCourier=s=>s.challenge?.type==='intercept'&&s.challenge.state==='active'&&!s.challenge.secured?s.challenge.target:null;
export const signalCargo=s=>s.challenge?.type==='intercept'&&s.challenge.state==='active'&&s.challenge.recoverCargo&&s.challenge.secured?s.challenge.target:null;
export const SIGNAL_CARGO_REACH=76;
const SIGNAL_SCREEN=[
 ['shield',477,637],['rifle',428,661],['rifle',398,713],['mortar',292,582]
];
export const SIGNAL_ESCORT_COUNT=SIGNAL_SCREEN.length;
export const signalEscortPlan=lane=>SIGNAL_SCREEN.map(([type,x,y])=>({type,x:lane==='east'?1600-x:x,y}));
export const signalGuardCount=s=>s.enemies.filter(e=>!e.dead&&e.cohort==='signal-guard').length;
export const DEFENSE_ZONE={x:800,y:560,r:108,seconds:8};
export const RELAY_SHELL={radius:42,warning:.95,interval:2.7};
export const defenseSeconds=tier=>DEFENSE_ZONE.seconds+Math.min(8,(tier-1)*2);
export const relayDefenseRound=s=>s.hazards.find(h=>h.relayDefense&&!h.hit);
export const SIGNAL_SECONDS=18;
export const SIGNAL_COLOR='#e6bcf6';
const YARD_ROUTE=[[420,940],[425,804],[435,640],[410,540],[200,510],[200,325],[325,235],[330,105]];
const signalPath=(points,flip=false)=>points.map(([x,y])=>({x:flip?1600-x:x,y}));
const SIGNAL_PATHS={west:signalPath(YARD_ROUTE),east:signalPath(YARD_ROUTE,true),center:signalPath([[800,920],[800,95]])};
export const signalLane=seed=>mapSeed(seed,2)%2?'west':'east';
export const signalLaneLabel={west:'서쪽 하역로',east:'동쪽 하역로',center:'중앙 통로'};
export function signalPosition(lane,timeLeft){
 const path=SIGNAL_PATHS[lane||'center'];
 const {segment,fraction}=routeCursor(path,clamp(1-timeLeft/SIGNAL_SECONDS,0,1));
 const a=path[segment],b=path[segment+1];
 return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,aim:Math.atan2(b.y-a.y,b.x-a.x)};
}
export function signalRoute(s){
 const target=signalCourier(s);
 if(!target)return SIGNAL_PATHS[signalLane(s.seed)];
 const {lane,timeLeft}=s.challenge,path=SIGNAL_PATHS[lane||'center'];
 const {segment}=routeCursor(path,clamp(1-timeLeft/SIGNAL_SECONDS,0,1));
 return [target,...path.slice(segment+1)];
}
export const MANEUVERS={
 assault:{name:'돌파 격발',impact:'회피 시 1.25초간 이동 사격 가속',detail:'이동 중 기본 발사 간격 −22%. 달려서 포위망에 틈을 냅니다.'},
 brace:{name:'거치 사격',impact:'0.45초 정지하면 기본 사격 피해 +25%',detail:'움직이는 즉시 해제. 포격 사이의 빈틈에 화력을 집중합니다.'}
};
export function gatePosition(s){
 const b=s.boss,offset=b.r+48;
 const points=[[0,offset],[offset,0],[-offset,0],[0,-offset],[0,0]];
 for(const [dx,dy] of points){
  const x=clamp(b.x+dx,FIELD.left+55,FIELD.right-55),y=clamp(b.y+dy,FIELD.top+55,FIELD.bottom-48);
  if(!s.blocks.some(w=>w.hp!==0&&x+52>w.x&&x-52<w.x+w.w&&y+24>w.y&&y-32<w.y+w.h))return{x,y};
 }
 return{x:b.x,y:b.y};
}
export function exitGate(s){
 if(s.stage!=='holdout')return null;
 if(!s.operation)return {x:800,y:420,name:'귀환 출구'};
 const name=isSalvageCampaign(s)&&s.operation.region===1?'철도 게이트':canAdvanceFront(s)?'전진 게이트':'귀환 게이트';
 return {...(s.operation.gate||gatePosition(s)),name};
}
export function holdoutTier(time){
 return time<HOLDOUT.grace?0:Math.min(HOLDOUT.maxTier,1+Math.floor((time-HOLDOUT.grace)/HOLDOUT.tierSeconds));
}
export const groundXp=s=>s.gems.reduce((sum,g)=>sum+g.value,0);
const BEACH_ROUTES=[
 {name:'서쪽 난파선',gun:'r',points:[[590,920],[385,650],[1165,530],[1000,900]]},
 {name:'동쪽 포대',gun:'f',points:[[1010,920],[1240,650],[355,510],[590,900]]},
 {name:'방파제 횡단',gun:'r',points:[[600,890],[1070,885],[1245,490],[340,645]]},
 {name:'벙커 횡단',gun:'f',points:[[1000,890],[555,875],[355,450],[1230,645]]}
];
export const beachRoute=seed=>BEACH_ROUTES[(seed>>>0)%BEACH_ROUTES.length];
export const COAST_PREEMPT_RANGE=155;
export const COAST_PREEMPT_ESCORT=[['shield',0,35,42],['rifle',-47,-22],['rifle',47,-22]];
export const COAST_RAID_PATROL_DELAY=4;
export const COAST_SHIELD_BRACE=1.65;
export const COAST_SHIELD_BEARING=Math.PI/2;
const SHIELD_COVER_COSINE=.45;
export const SHIELD_HALF_ANGLE=Math.acos(SHIELD_COVER_COSINE);
export const shieldCovers=(shield,angle)=>Math.cos(angle-shield.aim)>SHIELD_COVER_COSINE;
export const shieldFaces=(shield,p)=>shieldCovers(shield,Math.atan2(p.y-shield.y,p.x-shield.x));
export const bracingCoastEscort=e=>e.coastRaidShield===true&&!e.dead&&e.hp>0&&e.spawnAge<COAST_SHIELD_BRACE;
export const COAST_RESPONSE={
 f:{name:'보급차 역습',hint:'옆에서 호위를 모아 분사',reach:194,
  guards:[['shield',-30,0],['rifle',-8,-33],['rifle',-8,33],['rifle',24,-25],['rifle',24,25]]},
 r:{name:'포대 반격',hint:'거리를 두고 포대에 로켓',reach:244,
  guards:[['mortar',14,0],['rifle',-23,-29],['rifle',-23,29],['rifle',21,-40],['rifle',21,40]]}
};
export function coastResponseCue(s){
 const gun=s.stats.coastResponse;
 if(s.operation?.region!==0||s.stage!=='field'||!Object.hasOwn(COAST_RESPONSE,gun))return null;
 const guards=s.enemies.filter(e=>!e.dead&&e.hp>0&&e.coastResponse===gun&&distance(e,s.player)<430);
 const target=guards.find(e=>e.type===(gun==='r'?'mortar':'shield'))||guards[0];
 return target?{gun,target,count:guards.length,...COAST_RESPONSE[gun]}:null;
}
export function coastPreemptGun(seed){
 const [,truck,,battery]=beachRoute(seed).points;
 const gap=([x,y])=>Math.hypot(x-800,y-1040);
 return gap(truck)<gap(battery)?'f':'r';
}
export const isOpeningGun=id=>id==='f'||id==='r';
export const coastOpeningGun=s=>s.operation?.openingGun||coastPreemptGun(s.seed);
export function coastPreemptSite(s){
 if(s.operation?.region!==0||s.stage!=='field'||coastAtShore(s)&&!isSalvageCampaign(s)||s.operation.order||s.operation.requisition||s.operation.trialProof||s.trials?.length||s.firstNew||s.sites[0]?.state==='done')return null;
 const gun=coastOpeningGun(s);
 if(s.weapons.some(w=>w.id===gun&&!w.fusion))return null;
 return s.sites.find(site=>site.coastApproach===gun&&site.state!=='done')||null;
}
export const COAST_APPROACHES={
 f:{name:'이동 보급차',label:'화염 · 근접 돌파',formation:'밀집 호위',hint:'붙어서 호위를 함께 태우기',module:'catalyst',range:215,
  guards:[['shield',0,54],['rifle',-33,26],['rifle',33,26],['rifle',-40,-13],['rifle',40,-13],['rifle',0,-30]]},
 r:{name:'박격포 진지',label:'로켓 · 원거리 제압',formation:'집결 포대',hint:'멀리서 두 포대 사이에 폭발',module:'coil',range:300,
  guards:[['mortar',-47,-42],['mortar',47,-42]]}
};
const SPLIT_COAST={
 f:{...COAST_APPROACHES.f,formation:'양갈래 호위',hint:'방패 없는 쪽부터 태우거나 옆으로 돌아 분사',
  guards:[['shield',-64,54],['rifle',-70,18],['rifle',-38,19],['rifle',64,54],['rifle',70,18],['rifle',38,19]]},
 r:{...COAST_APPROACHES.r,formation:'분산 포대',hint:'포격 원 옆으로 빠지면 반격탄 1회',
  guards:[['mortar',-78,-42],['mortar',78,-42]],firstSalvo:[.6,1.45]}
};
export const coastApproach=site=>(site?.coastPlan==='split'?SPLIT_COAST:COAST_APPROACHES)[site?.coastApproach];
export const COAST_SERVICE_COST=1;
const turretInvestment=s=>s.firstNew==='h'||s.stats.choices.some(c=>c.id===RESCUE_COIL);
export function coastService(s,site){
 const id=site?.coastApproach;
 const turretService=id==='r'&&isSalvageCampaign(s)&&s.operation.coastSalvage.loadout==='turret'&&s.weapons.some(isCapturedTurret)&&turretInvestment(s);
 if(s.operation?.region!==0||s.stage!=='field'||s.tuning<COAST_SERVICE_COST||(!turretService&&id!==s.firstNew)||!Object.hasOwn(COAST_APPROACHES,id))return null;
 const weapon=s.weapons.find(w=>w.id===id&&!w.evolved&&!w.fusion&&w.level<4);
 return weapon?{weapon,level:Math.min(4,weapon.level+2)}:null;
}
export const COAST_WING={offset:64,hold:1.25,release:1.6};
export const COAST_MORTAR={range:400,tell:.36,warning:.9,spacing:.85,volleyDistance:160,volleyBeat:.55,counterSide:44};
export function coastMortarWait(s,e){
 if(e.cohort!=='coast-guard'||!s.sites.some(n=>n.id===e.siteId&&n.coastPlan==='split'))return 0;
 // The far gun can rejoin after a retreat, but not lock the same position in the same frame.
 const overlap=COAST_MORTAR.warning-COAST_MORTAR.spacing;
 return s.hazards.reduce((wait,h)=>h.coastMortar===e.siteId&&!h.hit?Math.max(wait,h.timer-overlap):wait,0);
}
export const coastMortarAiming=(s,e)=>(e.cohort==='coast-guard'||e.coastResponse==='r')&&e.type==='mortar'&&!e.dead
 &&e.timer<=COAST_MORTAR.tell&&coastMortarWait(s,e)<=COAST_MORTAR.tell
 &&Math.hypot(e.x-s.player.x,e.y-s.player.y)<COAST_MORTAR.range;
export const coastMortarThreatens=(s,site)=>s.hazards.some(h=>h.coastMortar===site.id&&!h.hit
 &&Math.hypot(h.x-s.player.x,h.y-s.player.y)<h.r+16);
export const COAST_STRIKES={
 f:{name:'연료관 점화',impact:'후면 엔진 점화 · 추가 피해 560',hint:'돌진을 피한 뒤 후면 엔진에 불을 맞히세요.',detail:'재장전 2초 연장. 장갑 수송차에 한 번 적용됩니다.',damage:560,delay:2},
 r:{name:'신호탄 포착',impact:'전용 로켓으로 돌진 차단 · 차체 피해 +780',hint:'예고 중 돌진선 밖에서 16m 이상 거리를 두고 사선을 여세요.',detail:'전용탄이 차체에 맞으면 한 번 돌진을 차단합니다.',damage:780,range:160}
};
export function coastStrike(s){
 const id=s.operation?.coastStrike;
 return s.operation?.region===0&&Object.hasOwn(COAST_STRIKES,id)?COAST_STRIKES[id]:null;
}
export const coastStrikeArmed=(s,id=s.operation?.coastStrike)=>s.weapons.some(w=>w.id===id||id==='r'&&w.fusion?.secondary==='r');
export function coastStrikeForSite(s,site){
 const gun=site?.coastApproach;
 if(s.operation?.region!==0||s.stage!=='field'||s.operation.coastStrike||!Object.hasOwn(COAST_STRIKES,gun))return null;
 return coastStrikeArmed(s,gun)?COAST_STRIKES[gun]:null;
}
export const BOSS_ENTRY={x:800,y:350,r:130};
export function coastStagingPoint(s){
 const gun=s.operation?.coastStrike||s.firstNew;
 if(s.operation?.region!==0||s.stage!=='field'||!Object.hasOwn(COAST_STRIKES,gun)||!coastStrikeArmed(s,gun))return null;
 const side=s.seed%2?1:-1,cover=s.blocks.some(b=>b.id==='b2'&&b.hp>0);
 return gun==='f'
  ?{x:BOSS_ENTRY.x+side*86,y:300,name:cover?'엄폐 유인 위치':'근접 측면',color:'#ffd0a0'}
  :{x:BOSS_ENTRY.x+(side>0?-55:100),y:side>0?424:367,name:'원거리 사선',color:'#bcece4'};
}
export function claimedCoastLead(s){
 const gun=s.operation?.coastStrike||s.firstNew;
 return s.operation?.region===0&&Object.hasOwn(COAST_STRIKES,gun)&&s.sites.find(site=>site.coastApproach===gun&&site.state==='done');
}
export function coastalThermalPrep(s){
 return s.operation?.region===0&&s.stage==='field'&&s.firstNew==='f'&&s.weapons.some(w=>w.id==='f')
  &&!s.modules.some(m=>m.id==='coil')&&!s.excluded.includes('coil')
  &&(s.trials?.includes('thermal')||s.operation.requisition==='thermal');
}
export function coastLead(s){
 if(s.operation?.region!==0||s.stage!=='field')return null;
 const rescue=s.sites.find(site=>site.opening&&site.state!=='done');
 const preempt=coastPreemptSite(s);
 if(s.operation.openingGun&&rescue&&rescue.state!=='waiting'&&distance(rescue,s.player)<120)return rescue;
 if(preempt&&(s.operation.openingGun||distance(preempt,s.player)<COAST_PREEMPT_RANGE||preempt.preempt&&distance(preempt,s.player)<260))return preempt;
 if(rescue)return rescue;
 if(isSalvageCampaign(s)&&s.operation.coastSalvage.loadout==='turret'&&s.weapons.some(isCapturedTurret)){
  const battery=s.sites.find(site=>site.coastApproach==='r'&&site.state!=='done');
  const trial=s.trials?.includes('shrapnel')&&!s.excluded.includes('shrapnel')&&!moduleRank(s,'shrapnel');
  if(battery&&(trial||turretInvestment(s)&&(coastService(s,battery)||moduleRank(s,'coil')<2&&!s.excluded.includes('coil'))))return battery;
 }
 if(!s.firstNew||!s.weapons.some(w=>w.id===s.firstNew))return null;
 const coilSite=coastalThermalPrep(s)&&s.sites.find(site=>site.coastApproach==='r'&&site.state!=='done');
 return coilSite||s.sites.find(site=>site.coastApproach===s.firstNew&&site.state!=='done')||null;
}
export const COAST_SALVAGE_LEVEL=2;
export function coastCrossGun(s,site){
 const id=site?.coastApproach;
 return s.operation?.region===0&&s.stage==='field'&&s.weapons.length<3&&Object.hasOwn(COAST_APPROACHES,id)&&id!==s.firstNew
  &&Object.hasOwn(COAST_APPROACHES,s.firstNew)&&s.weapons.some(w=>w.id===s.firstNew)
  &&!s.excluded.includes(id)&&!coastStrikeArmed(s,id)?id:null;
}
export const coastTacticalLootAvailable=(s,site)=>!!coastCrossGun(s,site)&&!s.operation.coastStrike
 &&(s.operation.requisitionClaimed||site!==requisitionStation(s));
const COAST_GUIDE_INSET=45,COAST_GUIDE_RETAIN=25;
export function coastFork(s,primary=coastLead(s),previousLead=null){
 if(primary&&primary.coastApproach!==s.firstNew||s.operation?.region!==0||s.stage!=='field'||orderTarget(s))return null;
 const cross=s.sites.find(site=>site!==primary&&site.state!=='done'&&(coastCrossGun(s,site)||coastStrikeForSite(s,site)));
 if(!cross)return null;
 const engaged=site=>site&&site.state!=='waiting'&&distance(site,s.player)<=coastApproach(site).range+24;
 const committed=cross.id===previousLead;
 const approach=coastApproach(cross).range-COAST_GUIDE_INSET+(committed?COAST_GUIDE_RETAIN:0);
 const followingCross=engaged(cross)&&(!primary||distance(cross,s.player)<=approach
  &&(committed||!engaged(primary)||distance(cross,s.player)<distance(primary,s.player)));
 return {lead:followingCross?cross:primary,other:followingCross?primary:cross};
}
export const coastLeadColor=site=>site.coastApproach==='f'?'#ffd0a0':site.coastApproach==='r'?'#bcece4':'#f6d58b';
export function coastShieldImpact(s,site){
 if(site.coastApproach!=='f'||site.state!=='active')return null;
 const impact=s.effects.findLast(f=>f.coastScreen===site.id);
 return impact&&s.enemies.some(e=>e.id===impact.shieldId&&!e.dead&&e.hp>0)?impact:null;
}
export function coastEncounterCue(s,site,volley,counter){
 const approach=coastApproach(site);
 if(!approach)return null;
 if(coastPreemptSite(s)===site){
  if(site.state==='waiting')return site.preempt?'경비 접근 중':`${site.coastApproach.toUpperCase()} L${COAST_SALVAGE_LEVEL} · 기습 가능`;
  if(site.state==='ready')return `${site.coastApproach.toUpperCase()} L${COAST_SALVAGE_LEVEL} · 접근해 노획`;
 }
 if(site.state==='ready'){
  if(site.coastApproach==='r'&&s.effects.some(f=>f.type==='coast-volley'))return '로켓 한 발 · 두 문 제압';
  const salvage=coastCrossGun(s,site);
  if(salvage)return `접근해 회수 · ${salvage.toUpperCase()} L${COAST_SALVAGE_LEVEL}${coastTacticalLootAvailable(s,site)?' / L1 전술':''}`;
  const service=coastService(s,site);
  if(service&&site!==requisitionStation(s))return `접근해 회수 · ${isCapturedTurret(service.weapon)?'포탑':service.weapon.id.toUpperCase()} L${service.level} 정비`;
  return `접근해 회수 · ${MODULES[approach.module].name} 후보`;
 }
 if(site.state!=='active')return null;
 const guards=s.enemies.filter(e=>!e.dead&&e.siteId===site.id);
 if(site.coastApproach==='f'){
  const shield=guards.find(bracingCoastEscort);
  if(shield){
   const direction=s.player.x<shield.x?'←':'→';
   return shieldFaces(shield,s.player)?`방패 정면 · ${direction} 옆으로 이동`:'방패 옆 노출 · 사선 유지';
  }
  if(!coastStrikeArmed(s,'f'))return `${coastStrikeArmed(s,'r')?'거리 유지 · 호위를 모아 폭발':'호위를 따라 측면 사격'} · 경비 ${guards.length}명`;
  const wings=new Set(guards.map(e=>e.coastWing).filter(Boolean)).size;
  const screened=coastShieldImpact(s,site);
  const move=screened?'방패에 막힘 · 측면 분사':site.coastPlan!=='split'?'붙어서 분사':wings===1?'남은 호위 추격':'바깥에서 한쪽부터';
  return `${move} · 경비 ${guards.length}명`;
 }
 const fired=s.effects.some(f=>f.coastCounter===site.id);
 const aim=coastMortarThreatens(s,site)?(counter?'포격 원 옆으로 · 반격 장전':'포격 원 밖으로')
  :fired?'측면 반격탄 발사':counter?.state==='blocked'?'측면에서 포대 사선 확보'
  :counter?.state==='far'?'포대 사거리까지 접근'
  :counter?.state==='close'?`포대와 ${COAST_MORTAR.volleyDistance/10}m 이상 거리 확보`:counter?.state==='sidestep'?'포격 사선 옆으로'
  :guards.some(e=>coastMortarAiming(s,e))?'박격포 조준 중'
  :volley?({ready:'사선 확보 · 동시 타격',inflight:'포대 사이로 로켓 비행',close:'포대와 거리 벌리기',far:'사거리까지 접근',blocked:'옆으로 돌아 사선 열기'})[volley.state]
  :guards.length===1?'남은 포대를 노려라':site.coastPlan==='split'?'교대 포격 · 한 문씩':'포대를 향해 사선 잡기';
 return `${aim} · ${guards.length}문`;
}
export const mapSeed=(seed,index)=>seed+index*7919;
export const RAIL_SALVAGE_ROUTES={
 'rail-cache':{name:'화차 정비대',color:'#f4ca87',fight:'양쪽 대열에 일제사격',boss:'열차 정면에서 양쪽 포격 차단'},
 'rail-relay':{name:'통신 중계기',color:'#9cd4da',fight:'후방 박격포 먼저 제압',boss:'교신으로 열차 조준 유인'}
};
export const RAIL_WORKSHOP_FAN={approach:118,position:34,setup:.85};
export const RAIL_GARRISONS={
 spread:{name:'갈라진 보병',crew:'보병',unit:'명',type:'rifle',range:225,hint:'열린 쪽에서 양쪽 대열을 부채꼴 안에 두세요.',guards:[
  ['rifle',-77,4,27],['rifle',-90,-24,27],['rifle',-69,-40,27],['rifle',-86,-57,27],
  ['rifle',77,4,27],['rifle',90,-24,27],['rifle',69,-40,27],['rifle',86,-57,27]
 ]},
 battery:{name:'집중 박격포',crew:'박격포',unit:'문',type:'mortar',range:300,hint:'선로를 따라 긴 사선을 잡아 뒤쪽 포대를 먼저 치세요.',guards:[
  ['rifle',-24,45],['rifle',24,45],['rifle',-22,15],['mortar',-20,-131],['mortar',24,-131]
 ]},
 shield:{name:'방패 검문',crew:'방패병',unit:'명',range:215,hint:'방패병 옆으로 돌아 사선을 여세요.',guards:[
  ['shield',-36,55],['shield',36,55],['rifle',-41,22],['rifle',41,22],['rifle',-24,-23],['rifle',24,-23]
 ]},
 mortar:{name:'박격포 경계',crew:'박격포',unit:'문',range:255,hint:'포격 원을 피해 뒤쪽 박격포를 먼저 끊으세요.',guards:[
  ['rifle',-34,43],['rifle',34,43],['rifle',-32,-23],['rifle',32,-23],['mortar',-8,-136],['mortar',54,-125]
 ]}
};
export const railGarrison=site=>Object.hasOwn(RAIL_GARRISONS,site?.guardPlan)?RAIL_GARRISONS[site.guardPlan]:null;
export function railCrewLeft(s,site){
 const garrison=railGarrison(site);
 return garrison?s.enemies.filter(e=>!e.dead&&e.siteId===site.id&&e.type===(garrison.type||site.guardPlan)).length:0;
}
export const relayCrewLeft=(s,site)=>wireGarrison(s,site)
 ?s.enemies.filter(e=>!e.dead&&e.hp>0&&e.siteId===site.id&&e.type==='mortar').length:railCrewLeft(s,site);
const ENTRY={
 1:{arrival:{x:800,y:1040},routes:[
  {site:'rail-cache',sign:'화차 정비대',color:'#edce8e',path:[[800,1040],[665,1002],[562,947],[535,850]]},
  {site:'rail-relay',sign:'중계기 해킹',color:'#b1dfcb',path:[[800,1040],[936,980],[1120,835],[1120,580]]}
 ]},
 2:{arrival:{x:720,y:1040},routes:[
  {site:'port-landing',sign:'해치 · 포탑 측면 기습',color:'#edce8e',path:[[720,1040],[620,992],[520,900]]},
  {site:'port-control',sign:'관제소 · 전술 또는 증원 절반',color:'#b5dce7',path:[[720,1040],[875,1010],[995,929],[1030,821],[1090,740],[1180,690],[1180,620]]}
 ]}
};
const MIRRORED_ENTRY=Object.fromEntries(Object.entries(ENTRY).map(([index,entry])=>[index,{
 arrival:{x:1600-entry.arrival.x,y:entry.arrival.y},
 routes:entry.routes.map(route=>({...route,path:route.path.map(([x,y])=>[1600-x,y])}))
}]));
export const frontEntry=(sectorSeed,index)=>(sectorSeed%2===0?MIRRORED_ENTRY:ENTRY)[index];
export function railWorkshopEntry(route,arrival){
 const [x,y]=route.path.at(-1),flankY=y+244;
 return [[arrival.x,arrival.y],[(arrival.x+x)/2,flankY],[x,flankY],[x,y]];
}
export function railWorkshopFan({x,y}){
 return {x,y:y+RAIL_GARRISONS.spread.range-15,dx:0,dy:1};
}
export function railCenterRoute(seed,origin='arrival'){
 const entry=frontEntry(mapSeed(seed,1),1);
 const cache=entry.routes[0].path.at(-1),relay=entry.routes[1].path.at(-1);
 const path=origin==='rail-cache'?[cache,[cache[0],710],[800,710],[800,350]]
  :origin==='rail-relay'?[relay,[800,580],[800,350]]:[[800,1040],[800,920],[800,350]];
 return {site:'rail-center',name:'포격 열차',sign:'포격 열차 직행',path,color:'#cab9a4'};
}
const GANTRY_PATH=[[520,900],[510,812],[510,630],[550,520],[595,400],[595,340]];
const GANTRY_MIRRORED=GANTRY_PATH.map(([x,y])=>[1600-x,y]);
export function portCenterRoute(seed,origin='arrival'){
 const entry=frontEntry(mapSeed(seed,2),2),{x,y}=entry.arrival;
 const path=origin==='control'?[entry.routes[1].path.at(-1),[800,620],[800,605],[800,350]]
  :origin==='dock'?[entry.routes[0].path.at(-1),[800,900],[800,868],[800,350]]
  :[[x,y],[800,990],[800,350]];
 return {site:'port-center',name:'정면 돌입',sign:'정면 · 첫 가로 포격',path,labelAt:-1,color:'#cab9a4'};
}
export function portGantry(s){
 if(s.operation?.region!==2||!s.operation.portDock||s.stage!=='field')return null;
 const path=s.seed%2===0?GANTRY_MIRRORED:GANTRY_PATH,[x,y]=path.at(-1);
 return {x,y,path,name:'측면 해치',sign:'측면 해치',site:'port-gantry',labelAt:-1,color:'#b6e1c5'};
}
export function activeEntry(s){
 const index=s.operation?.region;
 if(!index||s.stage!=='field')return null;
 const entry=frontEntry(mapSeed(s.seed,index),index);
 if(!entry)return null;
 const routes=entry.routes.flatMap(route=>{
  const [x,y]=route.path.at(-1);
  const site=s.sites.find(n=>n.id===route.site&&n.x===x&&n.y===y&&n.state!=='done');
  if(!site)return [];
  if(site.id==='rail-cache'){
   const sign=s.operation.requisition?'정비대 · 예약품':route.sign;
   const liveWings=site.state==='waiting'||site.state==='active'&&[0,1].every(wing=>
    s.enemies.some(e=>e.siteId===site.id&&e.railWing===wing&&!e.dead&&e.hp>0));
   if(site.guardPlan==='spread'&&liveWings&&!s.stats.railFanSweep&&s.weapons.some(isCapturedTurret)){
    return [{...route,sign,path:railWorkshopEntry(route,entry.arrival),fan:railWorkshopFan(site)}];
   }
   if(s.operation.requisition)return [{...route,sign}];
  }
  return [site.id==='port-landing'&&!site.gantry?{...route,sign:'하역장 보급'}:route];
 });
 if(index===2){
  const control=s.sites.find(site=>site.id==='port-control'&&site.state==='done');
  const dock=s.operation.portDock&&s.sites.find(site=>site.id==='port-landing');
  const origin=control&&(!dock||distance(s.player,control)<distance(s.player,dock))?'control':dock?'dock':'arrival';
  const direct=portCenterRoute(s.seed,origin);
  if(s.operation.jammed)direct.sign='정면 · 첫 장갑탄 차단';
  const staging=portPartStaging(s);
  if(staging){
   direct.name=staging.name;direct.sign=`${staging.name} · ${staging.sign}`;direct.color=staging.color;
   direct.path=staging.part==='breach'?[...direct.path,[staging.x,staging.y]]
    :[...direct.path.slice(0,-1),[PORT_CENTER.x,staging.y],[staging.x,staging.y]];
  }
  return {...entry,routes,direct};
 }
 const origin=s.sites.filter(site=>['rail-cache','rail-relay'].includes(site.id)&&site.state==='done')
  .sort((a,b)=>distance(s.player,a)-distance(s.player,b))[0]?.id;
 const transferY=969;
 const stop=id=>entry.routes.find(route=>route.site===id).path.at(-1);
 const linkedRoutes=origin?routes.map(route=>{
  if(route.site!==(origin==='rail-relay'?'rail-cache':'rail-relay'))return route;
  const from=stop(origin),to=route.path.at(-1);
  const crossY=route.fan?to[1]+244:transferY;
  return {...route,path:[from,[from[0],crossY],[to[0],crossY],to]};
 }):routes;
 const ammo=s.sites.find(site=>site.id==='rail-ammo'&&site.state!=='done');
 if(ammo&&origin&&(railSpareForFlame(s)||!s.weapons.some(w=>w.evolved||w.fusion))){
  const [x,y]=stop(origin),[relayX,relayY]=stop('rail-relay');
  const relayOpen=s.sites.some(site=>site.id==='rail-relay'&&site.state!=='done');
  const path=origin==='rail-relay'?[[x,y],[ammo.x,y],[ammo.x,ammo.y]]
   :relayOpen?[[x,y],[x,transferY],[800,transferY],[800,500],[ammo.x,500],[ammo.x,ammo.y]]
    :[[x,y],[x,transferY],[relayX,transferY],[relayX,relayY],[ammo.x,relayY],[ammo.x,ammo.y]];
  linkedRoutes.push({site:ammo.id,sign:'포대 탄약고 · 추가 보급',color:'#ecd197',path,
   ...(origin==='rail-cache'&&relayOpen?{warning:'중계기 경계 구역 인접'}:null)});
 }
 return {...entry,routes:linkedRoutes,direct:railCenterRoute(s.seed,origin)};
}
export function entryWaypoint(path,p){
 let best=Infinity,next=path.at(-1);
 for(let i=1;i<path.length;i++){
  const [x,y]=path[i-1],[tx,ty]=path[i],dx=tx-x,dy=ty-y;
  const fraction=Math.max(0,Math.min(1,((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy)));
  const gap=Math.hypot(p.x-x-fraction*dx,p.y-y-fraction*dy);
  if(gap<=best){best=gap;next=fraction>.85?path[Math.min(i+1,path.length-1)]:path[i];}
 }
 return best<=145?next:path.at(-1);
}
export function regionLayout(seed,index=0,order=null,salvageRail=false){
 const map=layout(seed);
 if(index===0){
  const route=beachRoute(seed);
  return {...map,sites:map.sites.map((site,i)=>{
   const approach=i===1?'f':i===3?'r':null;
   const split=approach&&((seed>>>2)&(approach==='f'?1:2));
   const objective=site.id==='arsenal'&&sortieOrder(order);
   return {...site,x:route.points[i][0],y:route.points[i][1],...(objective?{name:objective.site,...(order==='wire'?{kind:'relay',progress:0}:{})}:i===0?{gun:route.gun,opening:true}:approach?{coastApproach:approach,name:COAST_APPROACHES[approach].name,module:COAST_APPROACHES[approach].module,...(split?{coastPlan:'split'}:{})}:{})};
  })};
 }
 const mirror=seed%2===0,p=(x,y)=>({x:mirror?1600-x:x,y});
 const entry=frontEntry(seed,index),landing=i=>{const [x,y]=entry.routes[i].path.at(-1);return {x,y};};
 const block=(id,x,y,w,h,hp=-1)=>({id,x:mirror?1600-x-w:x,y,w,h,hp,maxHp:hp});
 const mortarAtWorkshop=(seed>>>1&1)!==0;
 if(index===1)return {...map,sites:[
  {id:'rail-cache',kind:'supply',name:'화차 정비대',...landing(0),guardPlan:salvageRail?'spread':mortarAtWorkshop?'mortar':'shield',state:'waiting'},
  {id:'rail-relay',kind:'relay',name:'통신 중계기',...landing(1),guardPlan:salvageRail?'battery':mortarAtWorkshop?'shield':'mortar',state:'waiting',progress:0},
  {id:'arsenal',kind:'armory',name:'선로 정비창',...p(350,430),state:'waiting'},
  {id:'rail-ammo',kind:'supply',name:'포대 탄약고',...p(1160,300),state:'waiting'}
 ],blocks:[block('r1',640,730,100,185),block('r2',640,385,100,180),block('r3',950,600,105,180),block('r4',950,250,105,160),block('r5',400,630,100,70,200)]};
 return {...map,sites:[
  {id:'port-landing',kind:'supply',name:'하역장 해치',...landing(0),state:'waiting',gantry:true},
  {id:'port-control',kind:'control',name:'항구 관제소',...landing(1),state:'waiting'},
  {id:'arsenal',kind:'armory',name:'시험 병기 창고',...p(280,475),state:'waiting'},
  {id:'port-ammo',kind:'supply',name:'지휘부 탄약',...p(1100,320),state:'waiting'}
 ],blocks:[block('p1',550,690,210,100),block('p2',850,470,235,100),block('p3',340,350,170,100),block('p4',1120,800,160,100),block('p5',1070,170,160,75,280)]};
}
export function regionBoss(index,seed=1){const d=REGIONS[index],turretSide=index===2&&seed%2===0?1:-1;return{id:'boss',type:'boss',x:800,y:180,hp:d.hp,maxHp:d.hp,r:index===1?76:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:60*turretSide,hp:d.partHp,maxHp:d.partHp,r:25},{id:'part-b',type:'part',ox:-60*turretSide,hp:d.partHp,maxHp:d.partHp,r:25}]};}
export const RESEARCH={
 medic:{name:'응급 주사기',cost:300,condition:'첫 작전 완주',detail:'정예를 잡으면 체력12 회복 · 재사용12초. 보급 후보로 추가되며 모듈 한 칸을 씁니다.',fieldBrief:'포로 구출 보상에서 장착하고, 정예를 제압해 체력을 회복하세요.',fitting:'정예 제압으로 발동'},
 shrapnel:{name:'분열 수류탄',cost:350,condition:'격발망 합체로 보스 격파',detail:'포탑·로켓·유탄·합체 연쇄탄에서 파쇄 폭발 3개 · 재사용 0.65초. 모듈 한 칸을 씁니다.',fieldGun:'r',fieldBrief:'로켓이나 노획 포탑으로 시험합니다. 박격포 진지에서 분열 수류탄과 축전 코일 중 하나를 고르세요.',fitting:'포탑·로켓·유탄·합체 연쇄탄에서 발동'},
 thermal:{name:'흡열 코일',cost:350,condition:'인페르노로 보스 격파',detail:'불붙은 적에 전기가 적중하면 전탄 충전+2 · 재사용0.25초. 화염과 코일이 필요합니다.',fieldGun:'f',fieldBrief:'F와 박격포 진지의 축전 코일을 챙기세요. 시험품 장착 후 스킬을 써서 충전할 자리를 만드세요.',fitting:'축전 코일과 연소 무장 필요'}
};
export const REQUISITION_FEE=120;
export const RESEARCH_PROOF_CREDITS=REQUISITION_FEE;
export const RESEARCH_PROOFS={
 medic:{counter:'medicRecovered',amount:1,label:'정예 제압으로 체력 회복',short:'회복'},
 shrapnel:{counter:'shrapnelHits',amount:8,label:'파편 적중 8회',short:'파편 적중'},
 thermal:{counter:'thermalRecovered',amount:8,label:'연소·전기로 충전 +8',short:'흡열 충전'}
};
export const pickedResearchTrials=stats=>Array.isArray(stats.researchTrialsPicked)?stats.researchTrialsPicked:[stats.researchTrialPicked].filter(Boolean);
export function researchProofProgress(s,id){
 const proof=RESEARCH_PROOFS[id];
 if(s.operation?.trialProof!==true||!proof||!pickedResearchTrials(s.stats).includes(id))return null;
 const value=s.stats[proof.counter];
 const progress=Number.isFinite(value)?Math.max(0,value):0;
 return {...proof,progress,done:progress>=proof.amount};
}
export const completedResearchProofs=s=>Object.keys(RESEARCH_PROOFS).filter(id=>researchProofProgress(s,id)?.done);
export const requisitionFront=operation=>operation?.requisitionAt==='coast'?0:1;
export const requisitionDestination=op=>requisitionFront(op)===0?COAST_APPROACHES[RESEARCH[op.requisition]?.fieldGun]?.name||'해안 보급':'화차 정비대';
export function requisitionStation(s){
 const op=s.operation;
 if(!op?.requisition||op.region!==requisitionFront(op))return null;
 if(op.region===1)return s.sites.find(site=>site.id==='rail-cache')||null;
 const gun=RESEARCH[op.requisition]?.fieldGun;
 return gun?s.sites.find(site=>site.coastApproach===gun)||null:null;
}
export function requisitionSite(s){
 if(s.stage==='boss'||s.operation?.requisitionClaimed)return null;
 const station=requisitionStation(s);
 return station?.state!=='done'?station:null;
}
export const CARGO_CREDITS=70;
export const COUNTERBATTERY_CREDITS=60;
export function operationPayout(r,firstWin=false,proofs=completedResearchProofs(r)){
 if(!r.operation)return {credits:0,lines:{}};
 const s=r.stats,lines={
  fronts:[90,120,180].slice(0,r.operation.cleared).reduce((a,b)=>a+b,0),
  extraction:r.won?120:railSortieReturned(r)?60:0,
  combat:Math.floor(Math.min(s.kills,900)/15)+Math.min(s.elites,9)*10,
  supply:Math.min(s.sitesCleared||0,6)*40,
  raids:Math.min(s.raidSuccess,3)*40,
  holdout:Math.min(s.challengeWins||s.challenge,3)*20,
  cargo:s.holdoutCargo?CARGO_CREDITS:0,
  firstClear:firstWin&&r.won?200:0,
  order:orderBonus(r)
 };
 if(proofs.length)lines.trial=proofs.length*RESEARCH_PROOF_CREDITS;
 if(coastTurretReturned(r))lines.turret=COAST_SALVAGE.credits;
 if(isSalvageCampaign(r)&&r.won&&r.operation.region===2&&r.operation.cleared===3&&r.operation.extracted===true&&s.portCounterbatteryCargo===true)lines.counterbattery=COUNTERBATTERY_CREDITS;
 return {credits:Object.values(lines).reduce((total,value)=>total+value,0),lines};
}
export const operationCredits=(r,firstWin=false)=>operationPayout(r,firstWin).credits;
