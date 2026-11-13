import {REGIONS,RESEARCH,requisitionFront,requisitionStation,MANEUVERS,FRONT_SUPPORTS,PORT_SUPPORT,PORT_AID_INTERCEPT,PORT_TURRET,PORT_BARRAGE,PORT_CENTER,portBarrageAxis,portJamsSweep,portCrossfireCuts,portCrossfireZone,portBarrageRounds,portBarrageMark,portRelayCuts,portSignalCuts,portConductiveSignal,PORT_CONDUCTIVE_SIGNAL,PORT_LANDING,BOSS_ENTRY,railGarrison,wireGarrison,relayCrewLeft,portGantry,portPartStaging,portTacticKeys,FRONT_TACTICS,RAIL_BARRAGE,railDisarmed,railGunOf,railGunLabel,railLaneContains,DEFENSE_ZONE,RELAY_SHELL,relayDefenseRound,SIGNAL_SECONDS,SIGNAL_CARGO_REACH,SIGNAL_ESCORT_COUNT,signalLane,signalPosition,signalCargo,signalEscortPlan,COAST_APPROACHES,COAST_SALVAGE_LEVEL,COAST_PREEMPT_RANGE,COAST_PREEMPT_ESCORT,COAST_RESPONSE,coastPreemptSite,coastPreemptGun,coastCrossGun,coastTacticalLootAvailable,COAST_WING,COAST_MORTAR,coastMortarWait,COAST_STRIKES,coastStrike,coastStrikeArmed,coastStrikeForSite,claimedCoastLead,coastApproach,coastService,COAST_SERVICE_COST,coastLead,frontTactic,portBreachFlank,portArmorRound,portArmorOpportunity,portArmorFlank,portCoreWindow,portCoreDisrupted,portCoreReach,portCompressionBand,portTurretShutter,portTurretSide,portWakePoint,portWakeMode,portAidPoint,portAidWindow,portAidCounterRound,portAidCounterReady,portAidCounterTarget,defenseSeconds,holdoutContract,portBatteryPositions,signalCourier,region,regionLayout,mapSeed,frontEntry,regionBoss,gatePosition,exitGate,sortieOrder,holdoutTier,holdoutParts,canAdvanceWithVanguard,vanguardAid,HOLDOUT,railHasRelay,railHasWire,railDecoyReady,railBarrageAim,railBarrageRounds} from './campaign.js';
import {RULES,VERSION,FIELD,GUNS,MODULES,QUALITY,INFERNO_CORE_DISTANCE,isFocusedInferno,isTrailInferno,INFERNO_WAKE,isConductiveFusion,CONDUIT_MORTAR,EMBER_CHARGE,capstoneName,fusionTitle,makeWeapon,tags,moduleRank,moduleGain,gunEquipLevel,rankChoiceLevel,compatible,canReplaceModule,completionModules,railCalibration,refitWeapons,canEvolve,canFuse,heatSynergyReady,weaponStats,distance,blastContactRadius,clamp,layout,rayBoxDistance,CAPTURED_TURRET,COAST_FAN,coastFanAngle,isCapturedTurret} from './content.js';
import {raidRoute,raidOnNose,raidCursor} from './raid.js';
import {COAST_CHARGE,coastTravel,planCoastCharge,coastChargeLane} from './coast-charge.js';
import {OPERATORS,operatorOf,skillRules,canUseSkill,focusLane,aimFromInput,chargeLabel} from './operator.js';
import {COAST_SALVAGE,coastSalvage,coastAtShore,isCoastRailSortie,isSalvageCampaign,carriesCoastSalvage,sortieFrontCount,canAdvanceFront,coastTurretOwner,COAST_TURRET_STARTER,COAST_TURRET_RECOVERED,coastRole,coastRoleRank,coastRoleBonus,coastGrowthEnemy,coastTurretLane,coastHullFront,coastSalvageWreck} from './coast-salvage.js';
const TAU=Math.PI*2,clone=x=>JSON.parse(JSON.stringify(x));
const rng=(s,key)=>{let a=s.rng[key]=(s.rng[key]+0x6d2b79f5)>>>0;a=Math.imul(a^(a>>>15),a|1);a^=a+Math.imul(a^(a>>>7),a|61);return((a^(a>>>14))>>>0)/4294967296;};
const pick=(s,key,items)=>items[Math.floor(rng(s,key)*items.length)];
const alive=s=>s.enemies.filter(e=>!e.dead);
const isRailWorkshopGuard=e=>e?.siteId==='rail-cache'&&e.cohort==='rail-guard'&&e.type==='rifle';
const emit=(s,type,x=s.player.x,y=s.player.y,extra={})=>{
 const effect={type,x,y,age:0,life:.45,...extra};
 s.events.push(type);s.effects.push(effect);
 if(s.effects.length>180)s.effects.shift();
 return effect;
};
function emitBossWarning(s,signal,x,y,extra){
 emit(s,'boss-warning',x,y,extra);
 s.events.push(signal);
}
const freshStats=()=>({kills:0,elites:0,score:0,damageTaken:0,ricochetHits:0,coilBursts:0,heatBursts:0,raidSuccess:0,raidFailed:0,bestCombo:0,completedBuild:null,bossKilled:false,challenge:0,choices:[],moduleDamage:0});
export function createRun(seed=17){
 const map=layout(seed),s={version:VERSION,balanceRevision:RULES.balanceRevision,seed:seed>>>0,rng:{map:seed>>>0,supply:(seed^0x12345678)>>>0,combat:(seed^0xa5f31021)>>>0,loot:(seed^0xdecafe11)>>>0},phase:'playing',stage:'field',t:0,level:1,xp:0,pendingLevels:0,tuning:1,rerolls:2,banishes:1,refits:1,excluded:[],seenGuns:[],offeredWeapons:[],supplyCount:0,firstNew:null,choice:null,choices:[],queue:[],id:0,
 player:{x:800,y:1040,hp:100,maxHp:100,aim:-Math.PI/2,walk:0,moving:false,attack:0,hurt:0,invuln:0,dash:0,dashCd:0,charge:60,overdrive:0,skillCd:0,doctrine:'reserve',pickup:0,pickupTime:0},weapons:[{...makeWeapon('h'),uid:'w-h0'}],modules:[],boosts:{power:0,vitality:0,pickup:0},...map,enemies:[],shots:[],enemyShots:[],gems:[],zones:[],hazards:[],effects:[],events:[],combo:0,comboTime:0,spawnClock:1,pressure:0,lastPressure:0,coil:0,coilCd:0,heatCd:0,powerWave:null,powerDone:false,view:{w:880,h:500},stats:freshStats(),raid:null,raidUsed:false,challenge:null,boss:{id:'boss',type:'boss',x:800,y:180,hp:6000,maxHp:6000,r:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:-60,hp:450,maxHp:450,r:25},{id:'part-b',type:'part',ox:60,hp:450,maxHp:450,r:25}]},holdTime:0,result:null};
 for(let i=0;i<RULES.spawn.initialCount;i++)spawnAround(s,'rifle',{},340,RULES.spawn.openingGap);
 return s;
}
export function createOperation(seed=17,research=[],trial=null,order=null,operator='fio',loadout=null){
 const dispatch=sortieOrder(order);
 if(order!==null&&!dispatch)throw Error('작전 지령을 확인할 수 없습니다.');
 if(!Object.hasOwn(OPERATORS,operator))throw Error('출전 대원을 확인할 수 없습니다.');
 const s=createRun(seed);s.operation={region:0,cleared:0,regionTime:0,history:[],jammed:false,...(dispatch?{order,orderDone:false}:{})};
 if(dispatch?.recordRevision)s.operation.orderRevision=dispatch.recordRevision;
 s.research=[...research];s.trials=(Array.isArray(trial)?[...trial]:[trial]).filter(Boolean);s.trial=s.trials[0]||null;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[0]};for(const e of s.enemies)e.cohort='ambient';s.stats.sitesCleared=0;s.stats.fusionBosses=0;s.stats.flameBosses=0;Object.assign(s,regionLayout(seed,0,order));s.boss=regionBoss(0);
 if(s.trials.length)s.operation.trialProof=true;
 if(operator==='marco'){
  s.operator=operator;
  Object.assign(s.player,{charge:RULES.marco.initialCharge,doctrine:OPERATORS.marco.start,moveAim:-Math.PI/2,focusChargeAt:0});
 }
 return loadout?prepareCoastSalvage(s,loadout,3):s;
}
export function createCoastSortie(seed,operator,loadout='standard'){
 return prepareCoastSalvage(createOperation(seed,[],null,null,operator),loadout,2);
}
function prepareCoastSalvage(s,loadout,fronts){
 if(!['standard','turret'].includes(loadout))throw Error('해안 시작 무장을 확인하세요.');
 if(fronts===3)s.enemies.splice(COAST_SALVAGE.openingRifles);
 s.operation.coastSalvage={fronts,loadout,progress:0,parts:[],work:0,turret:'aboard',extracted:false};
 if(loadout==='turret')s.weapons=[{...makeWeapon('r'),uid:COAST_TURRET_STARTER,capturedTurret:true}];
 const hp=fronts===2?2100:3100;
 Object.assign(s.boss,{hp,maxHp:hp});
 s.boss.parts[1].hp=0;
 const side=s.seed%2?-1:1;
 for(const offset of fronts===2?[0,44,88,132]:[0,60,120]){
  const guard=spawnEnemy(s,'shield',800+side*(210+offset*.45),930-offset,null,{coastArmor:true});
  clearCoastOverlap(s,guard,guard.r,{x:guard.x,y:1050});
  const carrier=spawnEnemy(s,'rifle',800-side*(200+offset*.45),920-offset,null,{coastCarrier:true});
  clearCoastOverlap(s,carrier,carrier.r,{x:carrier.x,y:1040});
 }
 return s;
}
function advanceRegion(s,card){
 if(!canAdvanceFront(s)||s.stage!=='holdout'||!s.boss.dead||carriesCoastSalvage(s)&&!atExitGate(s))return false;
 const coast=coastAtShore(s);
 if(coast&&card.support&&!s.operation.nextSupport)s.operation.nextSupport=card.support;
 withdrawRaid(s);
 const recoverStrike=s.operation.region===0&&s.operation.coastStrikeUsed;
 const support=s.operation.nextSupport||(canAdvanceWithVanguard(s)?'vanguard':null);
 s.operation.history.push({region:s.operation.region,time:s.operation.regionTime,pressure:s.pressure,holdTime:s.holdTime,holdoutKills:s.operation.holdoutKills||0,nextSupport:support,sites:s.sites.filter(n=>n.state==='done').length});
 s.operation.support=support;delete s.operation.nextSupport;delete s.operation.tactic;
 if(support==='vanguard')Object.assign(s.player,vanguardAid(s.player));
 s.operation.region++;s.operation.regionTime=0;s.operation.jammed=false;s.operation.challengeTier=0;s.operation.holdoutKills=0;delete s.operation.gate;delete s.pursuitClock;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[s.operation.region]};
 delete s.railFanContacts;
 if(s.operation.region===2&&Object.hasOwn(PORT_SUPPORT,support))s.operation.harborPayoff={};
 const sectorSeed=mapSeed(s.seed,s.operation.region),arrival=frontEntry(sectorSeed,s.operation.region).arrival;
 Object.assign(s,regionLayout(sectorSeed,s.operation.region,null,!!coast));s.boss=regionBoss(s.operation.region,s.seed);s.stage='field';s.pressure=0;s.holdTime=0;s.challenge=null;s.raid=null;s.raidUsed=false;s.enemies=[];s.shots=[];s.enemyShots=[];s.hazards=[];s.zones=[];s.gems=[];s.effects=[];s.events=[];s.spawnClock=1;Object.assign(s.player,arrival);s.player.invuln=1;s.player.dash=0;s.choice=null;s.choices=[];s.phase='playing';
 if(coast){
  coast.parts=[];
  if(coast.turret==='securing')coast.turret='intact';
  if(isCoastRailSortie(s)){
   Object.assign(s.boss,{hp:3600,maxHp:3600});
   for(const part of s.boss.parts)Object.assign(part,{hp:430,maxHp:430});
  }
 }
 if(s.powerWave?.showcase&&s.powerWave.paired>0){
  s.powerWave.remaining=Math.max(s.powerWave.remaining,60);s.powerWave.delay=1;delete s.powerWave.retried;
 }else if(s.stats.completedBuild)s.powerWave={delay:3,remaining:60,clock:0};
 if(recoverStrike)s.queue.unshift({type:'supply',source:'장갑 수송차 노획',cards:supplyCards(s,coastRecovery(s)),extra:{coastRecovery:true}});
 for(let i=0;i<(coast?5:10);i++)spawnAround(s,!coast&&i===0?'officer':'rifle',{cohort:'ambient'},360,30);
 emit(s,'region-entry',arrival.x,arrival.y,{text:`${s.operation.region+1}/${sortieFrontCount(s)} · ${region(s).name}`,life:1.6});nextChoice(s);return true;
}
function exitCards(s){
 const active=s.challenge?.state==='active';
 const stay={id:'stay',kind:'stay',title:active?'진행 중인 도전 계속':'전장 복귀 · XP 회수',desc:'게이트는 계속 열려 있습니다.',label:active?'잔류 도전':'잔류 성장'};
 const coast=coastSalvage(s);
 if(isCoastRailSortie(s)&&!canAdvanceFront(s))return [
   {id:'extract',kind:'extract',title:'철도에서 생존 귀환',desc:coast.turret==='secured'?'포탑 반출 · 다음 출격의 시작 무장 개방':'두 전선의 성과와 귀환 수당을 정산합니다.',label:'작전 완료'},stay
  ];
 if(carriesCoastSalvage(s)&&coastAtShore(s)){
  const forward={id:'advance',kind:'advance',title:'철도 진입',desc:'현재 무장과 성장 단계를 가져갑니다.',label:'다음 전선'};
  const remain={...stay,title:coastSalvageWreck(s)?'잔해로 돌아가기':'현장에 더 남기',
   desc:coastSalvageWreck(s)?'증원 속에서 5초 분리 · 포탑 현장 장착':'남은 XP를 회수하고 증원에 대비합니다.'};
  const advances=coast.turret==='broken'&&!s.operation.nextSupport?[
   {...forward,id:'advance:breach',support:'breach',title:'철갑 급탄 · 철도로',desc:'포대를 우선 조준하고 부위 피해 +30%.'},
   {...forward,id:'advance:vanguard',support:'vanguard',title:'후송 정비 · 철도로',desc:'체력과 전탄 +20 · 첫 차선 예고 +1초.'},
  ]:[forward];
  return [...advances,remain,...(isSalvageCampaign(s)?[{id:'extract',kind:'extract',title:'해안에서 철수',desc:'확보 크레딧 정산 · 반출은 철도 돌파부터 가능',label:'작전 중단'}]:[])];
 }
 if(coast&&!isSalvageCampaign(s))return [
  {id:'extract',kind:'extract',title:'해안에서 생존 귀환',desc:coast.turret==='secured'?'포탑을 반출해 다음 출격에 부채꼴 무장을 엽니다.':'해안 확보 보상을 정산합니다.',label:'해안 작전 완료'},
  {...stay,title:'해안에 더 남기',desc:coastSalvageWreck(s)?'잔해에 접근해 포탑을 분리할 수 있습니다.':'남은 XP를 회수할 수 있습니다.'}
 ];
 if(s.operation&&s.operation.region<2){
  const railExtract=isSalvageCampaign(s)&&s.operation.region===1;
  const extract=railExtract?{title:'철도에서 생존 귀환',desc:coast.turret==='secured'?'노획 포탑 반출 · 새 전장 시작 무장 해금':'두 전선의 성과와 생존 귀환 수당을 정산합니다.',label:'철도 귀환'}
   :{title:'확보 보상으로 중도귀환',desc:'현재까지의 크레딧을 정산합니다. 최종 완주 보너스는 없습니다.',label:'작전 중단'};
  return [{id:'advance',kind:'advance',title:`${REGIONS[s.operation.region+1].name} 진입`,desc:'무장·체력·XP 유지. 남은 상자와 바닥 XP는 두고 전진합니다.',label:'다음 전선'},stay,{id:'extract',kind:'extract',...extract}];
 }
 return [{id:'extract',kind:'extract',title:'살아서 귀환',desc:'최종 작전 보상과 기록을 확정합니다.',label:'작전 완수'},stay];
}
function atExitGate(s){
 const gate=exitGate(s);
 return !!(gate&&s.operation&&s.operation.cleared===s.operation.region+1&&s.boss.dead&&s.player.hp>0&&distance(s.player,gate)<92);
}
function atForwardGate(s){
 const gate=exitGate(s);
 return canAdvanceFront(s)&&!!gate&&s.boss.dead&&s.player.hp>0&&distance(s.player,gate)<92;
}
function coastMountCards(s){
 const coast=coastAtShore(s);
 if(!coast||!carriesCoastSalvage(s)||s.stage!=='holdout'||coast.turret!=='secured'||coast.mounted||s.weapons.some(isCapturedTurret))return [];
 const rocket=s.weapons.findIndex(w=>w.id==='r'&&!w.fusion);
 const slots=rocket>=0?[rocket]:s.weapons.length<3?[-1]:s.weapons.flatMap((w,i)=>!w.evolved&&!w.fusion?[i]:[]);
 return slots.map(slot=>{
  const old=s.weapons[slot],level=rocket>=0?old.level:3,count=old?.id==='r'&&old.evolved?7:5;
  return {id:slot<0||rocket>=0?'mount:turret':`mount:turret:${slot}`,kind:'coast-mount',slot,weapon:'r',fanCount:count,
   title:`노획 포탑 L${level}`,label:'현장 장착',desc:`${count}발 부채꼴 · 중거리`,
   detail:rocket>=0?`로켓 R L${level}을 포탑으로 개장`:old?`${GUNS[old.id].name} L${old.level} 교체`:'빈 공격 슬롯에 장착'};
 });
}
export const snapshot=s=>clone(s);
function validReservation(s,c){
 const station=requisitionStation(s),op=s.operation;
 if(station?.state!=='done'||s.stage==='boss'||op.requisitionClaimed||c.kind!=='module'||c.rank!==1
  ||op.requisition!==c.module||c.id!==`requisition:${c.module}`)return false;
 return op.region===1?s.choice?.type==='rail-workshop':s.choice?.type==='supply'&&s.choice.siteId===station.id;
}
function validCoastStrike(s,c){
 const site=s.sites.find(n=>n.id===s.choice?.siteId&&n.state==='done');
 return s.choice?.type==='supply'&&!!coastStrikeForSite(s,site)&&c.key===site.coastApproach&&c.id===`coast:${c.key}`;
}
const isCoastTacticalLoot=c=>c.kind==='gun'&&c.id===`coast-loot:${c.weapon}`;
function validCoastSalvage(s,c){
 const site=s.sites.find(n=>n.id===s.choice?.siteId&&n.state==='done');
 if(s.choice?.preempt)return s.choice.type==='supply'&&c.kind==='gun'&&site?.preempt===true
  &&s.operation?.region===0&&s.stage==='field'&&!s.firstNew&&s.sites[0]?.state!=='done'
  &&c.weapon===site.coastApproach&&c.id===`gun:${c.weapon}`&&c.salvageLevel===COAST_SALVAGE_LEVEL;
 if(s.choice?.type!=='supply'||c.kind!=='gun'||coastCrossGun(s,site)!==c.weapon)return false;
 if(isCoastTacticalLoot(c))return c.salvageLevel===1&&coastTacticalLootAvailable(s,site);
 return c.id===`gun:${c.weapon}`&&c.salvageLevel===COAST_SALVAGE_LEVEL;
}
const isCoastService=c=>c?.coastLevel!==undefined||typeof c?.id==='string'&&c.id.startsWith('coast-service:');
function validCoastService(s,c){
 const site=s.sites.find(n=>n.id===s.choice?.siteId&&n.state==='done');
 const service=coastService(s,site);
 return s.choice?.type==='supply'&&c.kind==='rank'&&service&&service.weapon.id===c.weapon
  &&c.id===`coast-service:${c.weapon}`&&c.coastLevel===service.level;
}
export const canResumeRevision=revision=>[RULES.balanceRevision,'b56-relay-growth','b55-workshop-fan','b54-harbor-extraction','b53-harbor-signal','b52-coast-role-rescue','b51-harbor-crossfire','b50-salvage-campaign','b49-coast-preempt-response','b48-coast-preempt','b47-conduit-mortar','b46-inferno-wake-links','b45-harbor-part-staging','b44-coast-weapon-service','b43-rail-relay-signal','b42-harbor-counter-aim','b41-rail-workshop-rebuild','b40-coast-field-replan','b39-harbor-intercept','b38-rocket-salvos','b37-harbor-relay','b36-counterbattery','b35-coast-requisition','b34-harbor-staging','b33-harbor-fire-control','b32-showcase-escort','b31-harbor-counterattack','b30-port-gantry','b29-rail-workshop','b28-research-dispatch','b27-boss-counterplay','b26-rail-gun-lock','b25-convoy-routes','b24-harbor-counterplay','b23-front-approaches','b22-capstone-impact','b21-field-rhythm','b20-harbor-shutter','b19-coast-opening','b18-harbor-parts','b17-vanguard-triage','b16-holdout-draft','b15-front-tactics','b14-coast-approaches','b13-capstone-showcase','b12-fusion-relay','b11-capstone-combat','b10-beach-routes','b09-front-contracts','b08-pursuit-supply','b07-open-gates','b06-swarms'].includes(revision);
// Older later-front checkpoints contain site coordinates from before the route change.
export function canResumeRun(run){
 if(!canResumeRevision(run.balanceRevision))return false;
 const front=run.operation?.region;
 if(!front||run.balanceRevision===RULES.balanceRevision)return true;
 if((front!==1&&front!==2)||!Array.isArray(run.sites))return false;
 return regionLayout(mapSeed(run.seed,front),front).sites.every(site=>
  run.sites.some(n=>n?.id===site.id&&n.x===site.x&&n.y===site.y));
}
export function restore(raw,{allowPrevious=false}={}){
 const s=clone(raw);if(!allowPrevious&&!canResumeRun(s))throw Error('이전 규칙의 저장 판은 확보 성과를 정산한 뒤 새로 출격해야 합니다.');if(s.version!==VERSION||!Number.isSafeInteger(s.seed)||!s.rng||!s.player||!Array.isArray(s.weapons)||s.weapons.length<1||s.weapons.length>3||!Array.isArray(s.modules)||s.modules.length>4||!Array.isArray(s.sites)||!s.stats||!['playing','choice','paused','result'].includes(s.phase))throw Error('저장 형식을 확인할 수 없습니다.');
 // Earlier coastal saves used the basic R in this same reserved starting slot.
 const starter=s.weapons.find(w=>w?.uid===COAST_TURRET_STARTER&&w.id==='r');
 if(starter&&coastSalvage(s)?.loadout==='turret')starter.capturedTurret=true;
 for(const w of s.weapons)if(!GUNS[w.id]||!Number.isInteger(w.level)||w.level<1||w.level>6||w.branch&&!GUNS[w.id].branches[w.branch])throw Error('무장 저장이 손상됐습니다.');
 for(const m of s.modules)if(!MODULES[m.id]||!Number.isInteger(m.rank)||m.rank<1||m.rank>3)throw Error('모듈 저장이 손상됐습니다.');
 if(!Number.isFinite(s.player.hp)||s.player.hp<0||!Number.isFinite(s.player.maxHp)||s.player.maxHp<=0||s.player.hp>s.player.maxHp||!Number.isFinite(s.t)||s.t<0||s.tuning<0||s.rerolls<0||s.banishes<0)throw Error('작전 저장이 손상됐습니다.');
 const fail=()=>{throw Error('전투 체크포인트가 손상됐습니다.');};
 if(s.weapons.some(w=>w.capturedTurret!==undefined&&(!isCapturedTurret(w)||!coastTurretOwner(s,w.uid))))fail();
 if(s.operator!==undefined&&(s.operator!=='marco'||!s.operation||!Object.hasOwn(OPERATORS.marco.stances,s.player.doctrine)||![s.player.moveAim,s.player.focusChargeAt].every(Number.isFinite)))fail();
 if(s.levelReadyAt!=null&&(!Number.isFinite(s.levelReadyAt)||s.levelReadyAt<0))fail();
 if(!['field','boss','holdout'].includes(s.stage)||!Array.isArray(s.boss?.parts)||!Array.isArray(s.queue)||!Array.isArray(s.choices)||!['map','supply','combat','loot'].every(k=>Number.isInteger(s.rng[k])))fail();
 const chargePath=s.boss.chargePath;
 if(chargePath&&(![chargePath.x,chargePath.y,chargePath.length,chargePath.offset].every(Number.isFinite)||chargePath.length<0||chargePath.offset<0||chargePath.length+chargePath.offset>COAST_CHARGE.distance+.001||chargePath.linear!=null&&typeof chargePath.linear!=='boolean'||chargePath.blockId!=null&&typeof chargePath.blockId!=='string'))fail();
 for(const key of ['blocks','enemies','shots','enemyShots','gems','zones','hazards','effects','excluded','seenGuns','offeredWeapons'])if(!Array.isArray(s[key]))fail();
 if(s.shots.some(q=>q?.coastFuse!==undefined&&(!q.rocket||q.homing||q.source!=='native'||s.operation?.region!==0
  ||!Number.isFinite(q.coastFuse?.x)||!Number.isFinite(q.coastFuse?.y))))fail();
 if(s.shots.some(q=>q?.capturedFan!==undefined&&(q.capturedFan!==true||!q.rocket||q.source!=='native'||
  !coastTurretOwner(s,q.owner)||q.speed!==CAPTURED_TURRET.speed)))fail();
 const rail=s.operation?.region===1&&carriesCoastSalvage(s);
 if(s.enemies.some(e=>e?.railWing!==undefined&&(!rail||!isRailWorkshopGuard(e)||![0,1].includes(e.railWing))))fail();
 if(s.shots.some(q=>q?.railFan!==undefined&&(!rail||!q.capturedFan||!Number.isSafeInteger(q.railFan?.volley)||q.railFan.volley<1
  ||!Number.isSafeInteger(s.stats.turretVolleys)||q.railFan.volley>s.stats.turretVolleys||!Number.isInteger(q.railFan.ray)||q.railFan.ray<0||q.railFan.ray>=CAPTURED_TURRET.evolved.count)))fail();
 if(s.stats.railFanSweep!==undefined&&(s.stats.railFanSweep!==true||!carriesCoastSalvage(s)||s.operation.region<1||!Number.isSafeInteger(s.stats.turretVolleys)||s.stats.turretVolleys<1))fail();
 if(s.railFanContacts!==undefined&&(!rail||s.stats.railFanSweep||!s.railFanContacts||typeof s.railFanContacts!=='object'||Array.isArray(s.railFanContacts)
  ||Object.entries(s.railFanContacts).some(([volley,hits])=>!s.shots.some(q=>String(q.railFan?.volley)===volley)
   ||!Array.isArray(hits)||hits.length!==2||!hits.some(Boolean)||hits.some(hit=>hit!==null&&(!hit||![hit.x,hit.y].every(Number.isFinite)
    ||!Number.isInteger(hit.ray)||hit.ray<0||hit.ray>=CAPTURED_TURRET.evolved.count)))))fail();
 const railCutMark=mark=>rail&&s.boss.active&&Number.isSafeInteger(mark?.volley)&&mark.volley>0&&mark.volley<=s.stats.turretVolleys
  &&Number.isSafeInteger(mark.cycle)&&mark.cycle>0&&mark.cycle<=s.boss.cycle&&[0,1].includes(mark.gun);
 if(s.shots.some(q=>q?.railFanCut!==undefined&&(!q.capturedFan||q.homing||!railCutMark(q.railFanCut))))fail();
 if(s.boss.railFanCutHit!==undefined&&(!railCutMark(s.boss.railFanCutHit)||s.stats.railFanCut===true
  ||!s.shots.some(q=>q.railFanCut?.volley===s.boss.railFanCutHit.volley&&q.railFanCut.gun!==s.boss.railFanCutHit.gun)))fail();
 if(s.stats.railFanCut!==undefined&&(s.stats.railFanCut!==true||!carriesCoastSalvage(s)||s.operation.region<1
  ||!Number.isSafeInteger(s.stats.turretVolleys)||s.stats.turretVolleys<1))fail();
 if(s.shots.some(q=>q?.crossfire!==undefined&&(!q.capturedFan||s.operation?.region!==2||s.operation.tactic!=='crossfire'
  ||!Number.isSafeInteger(q.crossfire?.volley)||q.crossfire.volley<1||q.crossfire.volley>s.stats.turretVolleys
  ||!Number.isSafeInteger(q.crossfire.cycle)||q.crossfire.cycle<1||q.crossfire.cycle>s.boss.cycle)))fail();
 if(s.shots.some(q=>q?.relayGroup!==undefined&&(!q.relay||q.source!=='payload'
  ||!Number.isSafeInteger(q.wavePulse)||!Number.isSafeInteger(q.relayGroup))))fail();
 const conduitRounds=s.hazards.filter(h=>h?.conduitGun!==undefined);
 if(conduitRounds.length>1||conduitRounds.some(h=>typeof h.conduitGun!=='string'||!h.conduitGun||h.lane
  ||![h.x,h.y,h.fromX,h.fromY,h.r,h.duration,h.timer].every(Number.isFinite)||h.r!==CONDUIT_MORTAR.radius||h.duration<=0))fail();
 if(s.shots.some(q=>q?.conduitGun!==undefined&&(typeof q.conduitGun!=='string'||!q.conduitGun||q.source!=='payload'||!q.relay||!q.homing)))fail();
 if(s.zones.some(z=>z?.source==='ember-charge'&&(![z.x,z.y,z.r,z.life,z.tick].every(Number.isFinite)||z.r<=0||z.life<=0||typeof z.owner!=='string')))fail();
 if(new Set(s.modules.map(m=>m.id)).size!==s.modules.length||s.modules.some(m=>RULES.modules[m.id].unique&&m.rank!==1)||new Set(s.weapons.map(w=>w.uid)).size!==s.weapons.length||s.weapons.some(w=>typeof w.uid!=='string'))fail();
 if(s.operation&&(!Array.isArray(s.research)||s.research.some(id=>!RESEARCH[id])||s.trial&&!s.research.includes(s.trial)||s.trials&&(!Array.isArray(s.trials)||s.trials.some(id=>!s.research.includes(id)))||!Number.isInteger(s.operation.region)||s.operation.region<0||s.operation.region>2||!Number.isInteger(s.operation.cleared)||s.operation.cleared<0||s.operation.cleared>3||!Number.isFinite(s.operation.regionTime)||!Array.isArray(s.operation.history)))fail();
 if(s.operation){
  const coast=coastSalvage(s);
  if(coast!==undefined&&(!coast||coast.fronts!==undefined&&!carriesCoastSalvage(s)||s.operation.region>=sortieFrontCount(s)||s.operation.cleared>sortieFrontCount(s)||
   !['standard','turret'].includes(coast.loadout)||!Number.isInteger(coast.progress)||coast.progress<0||coast.progress>COAST_SALVAGE.steps.at(-1)||
   !Number.isFinite(coast.work)||coast.work<0||coast.work>COAST_SALVAGE.seconds||
   !['aboard','broken','intact','securing','secured'].includes(coast.turret)||typeof coast.extracted!=='boolean'||
   !Array.isArray(coast.parts)||coast.parts.length>24||coast.parts.some(part=>typeof part?.id!=='string'||![part.x,part.y].every(Number.isFinite))||
   (coastAtShore(s)&&s.stage==='field'?coast.plan!==undefined:!['break','capture'].includes(coast.plan))||
   (coastAtShore(s)?(s.stage==='holdout')===(coast.turret==='aboard'):coast.turret==='aboard'||coast.turret==='securing'||s.operation.cleared<1||coast.parts.length>0)||
   (coast.mounted!==undefined&&(coast.mounted!==true||!carriesCoastSalvage(s)||coast.turret!=='secured'))||
   coast.extracted&&(s.stage!=='holdout'||s.phase!=='result'||canAdvanceFront(s)&&!(isSalvageCampaign(s)&&s.operation.region===1&&s.operation.cleared===2&&s.result?.reason==='rail-return'))))fail();
  const {order,orderRevision}=s.operation,dispatch=sortieOrder(order);
  if(order!==undefined&&(!dispatch||typeof s.operation.orderDone!=='boolean')||order===undefined&&s.operation.orderDone!==undefined)fail();
  if(orderRevision!==undefined&&orderRevision!==dispatch?.recordRevision)fail();
  if(order&&s.operation.region===0){
   const site=s.sites.find(site=>site.id==='arsenal');
   if(!site||site.kind!==(order==='wire'?'relay':'armory')||s.operation.orderDone&&site.state!=='done')fail();
  }
  s.trials??=s.trial?[s.trial]:[];
  if(s.operation.trialProof!==undefined&&s.operation.trialProof!==true)fail();
  const {requisition,requisitionAt,requisitionClaimed}=s.operation;
  if(requisition!==undefined&&(order!==undefined||!Object.hasOwn(RESEARCH,requisition)||!s.research.includes(requisition)||s.trials?.includes(requisition)))fail();
  if(requisitionAt!==undefined&&(requisitionAt!=='coast'||!RESEARCH[requisition]?.fieldGun))fail();
  const deliveryFront=requisitionFront(s.operation);
  if(requisitionClaimed!==undefined&&(requisitionClaimed!==true||!requisition||s.operation.region<deliveryFront))fail();
  if(requisitionClaimed&&s.operation.region===deliveryFront&&requisitionStation(s)?.state!=='done')fail();
  if(s.sites.some(site=>site.preempt!==undefined&&(site.preempt!==true||s.operation.region!==0||order||requisition||s.operation.trialProof||s.trials.length||site.coastApproach!==coastPreemptGun(s.seed))))fail();
  if(s.stats.coastPreempt!==undefined&&s.stats.coastPreempt!==coastPreemptGun(s.seed))fail();
  if(s.stats.coastResponse!==undefined&&(!Object.hasOwn(COAST_RESPONSE,s.stats.coastResponse)||s.stats.coastResponse!==s.stats.coastPreempt))fail();
  if(s.enemies.some(e=>e.coastResponse!==undefined&&(s.operation.region!==0||e.coastResponse!==s.stats.coastResponse||e.cohort!=='ambient')))fail();
  if(s.enemies.some(e=>e.coastRescueShield!==undefined&&(e.coastRescueShield!==true||!isSalvageCampaign(s)||s.operation.region!==0||s.operator!=='marco'||e.type!=='shield'||e.siteId!==null||e.coastArmor!==true)))fail();
  // The first b30 release opened the hatch before the site stored its variant.
  if(s.operation.region===2&&s.balanceRevision==='b30-port-gantry'){
   const dock=s.sites.find(site=>site.id==='port-landing');
   if(dock)dock.gantry=true;
  }
  if(s.operation.portDock!==undefined&&(s.operation.portDock!==true||s.operation.region!==2||!s.sites.some(site=>site.id==='port-landing'&&site.state==='done')))fail();
  if(s.operation.portEntry!==undefined&&(s.operation.portEntry!=='gantry'||!s.operation.portDock||s.stage==='field'))fail();
  const decoy=s.boss.railDecoy;
  if(decoy!==undefined&&(!decoy||s.operation.region!==1||s.stage==='field'||!(railHasRelay(s)||railHasWire(s))
   ||!Number.isFinite(decoy.x)||decoy.x<FIELD.left||decoy.x>FIELD.right||![0,1].includes(decoy.lead)
   ||!Number.isSafeInteger(decoy.cycle)||decoy.cycle<1||decoy.cycle>s.boss.cycle+1))fail();
  if([s.operation.support,s.operation.nextSupport].some(id=>id!=null&&!Object.hasOwn(FRONT_SUPPORTS,id)))fail();
  const armorCycleLimit=s.boss.cycle+Number(s.boss.mode==='aim');
  if(s.shots.some(q=>q?.armorCycle!==undefined&&(s.operation.region!==2||s.operation.support!=='breach'||q.source!=='native'
   ||!Number.isSafeInteger(q.armorCycle)||q.armorCycle<1||q.armorCycle>armorCycleLimit)))fail();
  const suppression=s.boss.armorSuppressedCycle;
  if(suppression!==undefined&&(s.operation.region!==2||s.operation.support!=='breach'
   ||!Number.isSafeInteger(suppression)||suppression<1||suppression>armorCycleLimit))fail();
  const payoff=s.operation.harborPayoff;
  if(payoff!=null&&(typeof payoff!=='object'||Array.isArray(payoff)||s.operation.region!==2||!Object.hasOwn(PORT_SUPPORT,s.operation.support)||Object.values(payoff).some(n=>!Number.isSafeInteger(n)||n<0)))fail();
  const supply=s.boss.harborSupply;
  if(supply!=null&&(s.operation.region!==2||s.operation.support!=='recovery'||!PORT_SUPPORT.recovery.lanes.includes(supply.x)||supply.y!==PORT_SUPPORT.recovery.y))fail();
  if(s.boss.harborSupplyCycle!=null&&(!Number.isInteger(s.boss.harborSupplyCycle)||s.boss.harborSupplyCycle<1||s.boss.harborSupplyCycle>PORT_SUPPORT.recovery.limit))fail();
  if(s.boss.harborCounter!==undefined&&(s.boss.harborCounter!==true||s.operation.region!==2||s.operation.support!=='recovery'||s.stage!=='boss'))fail();
  const arcCycle=s.boss.harborArcCycle;
  if(arcCycle!==undefined&&(s.operation.region!==2||s.operation.support!=='overrun'||!Number.isSafeInteger(arcCycle)||arcCycle<1||arcCycle>s.boss.cycle))fail();
  if(s.boss.harborRelayPart!==undefined&&(arcCycle===undefined||!['turret','armor'].includes(s.boss.harborRelayPart)))fail();
  const portSignal=s.boss.portSignal;
  if(portSignal!==undefined&&(!portSignal||!isSalvageCampaign(s)||s.operation.region!==2||s.operation.tactic!=='signal'||s.stage==='field'||
   !['turret','armor'].includes(portSignal.part)||!Number.isSafeInteger(portSignal.cycle)||portSignal.cycle<1||portSignal.cycle>s.boss.cycle))fail();
  const wakeCycle=s.boss.harborWakeCycle;
  if(wakeCycle!==undefined&&(s.operation.region!==2||s.operation.support!=='overrun'||!Number.isSafeInteger(wakeCycle)||wakeCycle<1||wakeCycle>s.boss.cycle))fail();
  if(s.boss.emberCycle!==undefined&&(s.operation.region!==2||s.operation.tactic!=='ember'||!Number.isSafeInteger(s.boss.emberCycle)||s.boss.emberCycle<1||s.boss.emberCycle>s.boss.cycle+1))fail();
  const {crossfireCycle,crossfireHit}=s.boss;
  if(s.operation.tactic==='crossfire'&&(!isSalvageCampaign(s)||s.operation.region!==2))fail();
  if(crossfireCycle!==undefined&&(s.operation.tactic!=='crossfire'||!Number.isSafeInteger(crossfireCycle)||crossfireCycle<2||crossfireCycle>s.boss.cycle+1))fail();
  if(crossfireHit!==undefined&&(s.operation.tactic!=='crossfire'||s.boss.mode!=='recover'||crossfireHit?.cycle!==s.boss.cycle
   ||!Number.isSafeInteger(crossfireHit.volley)||crossfireHit.volley<1||crossfireHit.volley>s.stats.turretVolleys||![1,2].includes(crossfireHit.mask)))fail();
  if(s.operation.holdoutKills!=null&&(!Number.isSafeInteger(s.operation.holdoutKills)||s.operation.holdoutKills<0))fail();
  const {coastStrike:planned,coastStrikeUsed}=s.operation;
  if(planned!==undefined&&(!Object.hasOwn(COAST_STRIKES,planned)||s.operation.region===0&&!claimedCoastLead(s)))fail();
  if(coastStrikeUsed!==undefined&&(coastStrikeUsed!==true||planned===undefined||s.operation.region===0&&s.stage==='field'))fail();
  if(s.operation.tactic!=null&&!Object.hasOwn(FRONT_TACTICS[s.operation.region]||{},s.operation.tactic))fail();
  if(s.stage==='boss'){
   if(s.operation.region===1)s.hazards=s.hazards.filter(h=>!h.lane||h.hit||!(s.boss.parts[railGunOf(h)]?.hp<=0));
   if(s.operation.region===2){
    if(s.boss.parts[0]?.hp<=0)clearPortRounds(s,'turret');
    if(s.boss.parts[1]?.hp<=0)clearPortRounds(s,'rake','battery');
   }
  }
 }
 if(s.powerWave?.paired>0&&!s.powerWave.showcase)s.powerWave.showcase='fusion';
 if(s.player.maneuver&&!Object.hasOwn(MANEUVERS,s.player.maneuver))fail();
 if(s.stage==='boss'&&s.boss.active&&!s.boss.dead&&!(s.operation?.region>0)){
  const b=s.boss;
  if(![s.player.x,s.player.y,b.x,b.y,b.r,b.body,b.timer].every(Number.isFinite)||b.r<=0)fail();
  clearCoastOverlap(s,s.player,16,{x:800,y:350});
  if(clearCoastOverlap(s,b,b.r,{x:800,y:180}))delete b.chargePath;
  if(b.chargePath){
   const path=b.chargePath,lane=coastChargeLane(s),progress=coastChargeProgress(b),inset=b.r+25;
   const onField=(x,y)=>x>=FIELD.left+inset-.001&&x<=FIELD.right-inset+.001&&y>=FIELD.top+inset-.001&&y<=FIELD.bottom-inset+.001;
   const clearPath=planCoastCharge(s,path.offset,path);
   if(!lane||!onField(path.x,path.y)||!onField(lane.endX,lane.endY)||path.length>clearPath.length+.001||
    distance(b,{x:path.x+Math.cos(b.body)*progress,y:path.y+Math.sin(b.body)*progress})>.05)fail();
  }
  if(!b.chargePath&&['windup','charge'].includes(b.mode))lockCoastCharge(s);
 }
 const kinds=new Set(['coast-boss','coast-mount','advance','control','rank','module','gun','evolve','fusion','tune','repair','utility','refit','calibrate','resupply','back','stay','extract','maneuver','permit','front-support','cargo','coast-strike']);
 const validRelayRepair=q=>q.extra?.relayRepair===undefined||q.extra.relayRepair===true&&isSalvageCampaign(s)
  &&s.operation.region===1&&s.stage==='field'&&q.type==='supply'&&q.extra.siteId==='rail-relay'&&railHasRelay(s);
 const cardsOk=cards=>Array.isArray(cards)&&cards.length>0&&cards.every(c=>(c.kind!=='resupply'||Number.isFinite(c.heal)&&Number.isFinite(c.charge)&&c.heal>=0&&c.charge>=0)&&typeof c.id==='string'&&kinds.has(c.kind)&&(!c.weapon||GUNS[c.weapon])&&(!c.module||MODULES[c.module])&&(!['rank','gun','evolve'].includes(c.kind)||!!GUNS[c.weapon])&&(!['module','tune'].includes(c.kind)||!!MODULES[c.module])&&(c.kind!=='module'||Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=3));
 if((s.phase==='choice'||s.resumePhase==='choice')&&(!s.choice||!['level','supply','armory','raid-reward','pursuit-reward','assembly','clear','control','rail-workshop','coast-boss','coast-mount'].includes(s.choice.type)||!cardsOk(s.choices)))fail();
 if(s.choice?.relayRepair!==undefined&&!validRelayRepair({type:s.choice.type,extra:s.choice}))fail();
 if(s.choice?.type==='coast-boss'&&(!coastAtShore(s)||s.stage!=='field'||coastSalvage(s).plan||
  s.choices.length!==2||s.choices.some(c=>c.kind!=='coast-boss'||!['coast:break','coast:capture'].includes(c.id))))fail();
 if(s.choice?.type==='coast-mount'){
  const options=coastMountCards(s);
  if(!options.length||s.choices.length!==options.length+1||s.choices.some((c,i)=>
   i===options.length?c.id!=='carry:turret'||c.kind!=='stay':c.id!==options[i].id||c.kind!=='coast-mount'||c.slot!==options[i].slot))fail();
 }
 if(s.choice?.type==='rail-workshop'&&(s.operation?.region!==1||s.stage==='boss'||s.choices.some(c=>c.kind==='calibrate'&&(c.id!==`calibrate:${c.uid}`||!s.weapons.some(w=>w.uid===c.uid&&railCalibration(s,w))))))fail();
 const rebuilds=s.choices.filter(isWorkshopRebuild);
 if(rebuilds.length>1||rebuilds.some(c=>!validWorkshopRebuild(s,c)))fail();
 const reservations=s.choices.filter(c=>typeof c?.id==='string'&&c.id.startsWith('requisition:'));
 if(reservations.length>1||reservations.some(c=>!validReservation(s,c)))fail();
 const strikes=s.choices.filter(c=>c?.kind==='coast-strike');
 if(strikes.length>1||strikes.some(c=>!validCoastStrike(s,c)))fail();
 // The initial b40 draft could save the other card for an excluded weapon.
 if(s.balanceRevision==='b40-coast-field-replan'&&s.operation?.region===0&&s.stage==='field'
  &&s.choice?.type==='supply'&&s.banishes===0&&s.choices.length===4){
  const site=s.sites.find(n=>n.id===s.choice.siteId&&n.state==='done'&&n.coastApproach);
  const gun=site?.coastApproach;
  if(gun&&s.excluded.includes(gun))s.choices=s.choices.filter(c=>!(c.kind==='gun'&&c.weapon===gun
   &&(c.id===`gun:${gun}`&&c.salvageLevel===COAST_SALVAGE_LEVEL||isCoastTacticalLoot(c)&&c.salvageLevel===1)));
 }
 const salvage=s.choices.filter(c=>c?.salvageLevel!==undefined||typeof c?.id==='string'&&c.id.startsWith('coast-loot:'));
 if(new Set(salvage.map(c=>c.id)).size!==salvage.length||salvage.some(c=>!validCoastSalvage(s,c)))fail();
 if(s.choice?.preempt!==undefined&&(s.choice.preempt!==true||salvage.length!==1))fail();
 const service=s.choices.filter(isCoastService);
 if(service.length>1||service.some(c=>!validCoastService(s,c)))fail();
 if(s.choice?.coastRecovery===true&&(s.choice.type!=='supply'||s.choice.source!=='장갑 수송차 노획'||!coastRecovery(s)||s.stage!=='field'||s.operation.regionTime!==0))fail();
 if(s.phase==='result'&&(!s.result||typeof s.result.won!=='boolean'||!Number.isFinite(s.result.score)||!Number.isFinite(s.result.seconds)||!s.result.stats||!Array.isArray(s.result.weapons)||!Array.isArray(s.result.modules)||s.result.weapons.some(w=>!GUNS[w.id])||s.result.modules.some(m=>!MODULES[m.id])))fail();
 const gatePrep=s.choice?.gatePrep;
 if(gatePrep!==undefined&&(gatePrep!==true||!['level','assembly'].includes(s.choice.type)||!atForwardGate(s)||!(s.phase==='choice'||s.phase==='paused'&&s.resumePhase==='choice')))fail();
 if(s.choice?.type==='assembly'){
  const options=gatePrep?capstoneOptions(s):assemblyOptions(s),ids=new Set([...options.map(c=>c.id),'back']);
  if(!s.choices.some(c=>c.id==='back'&&c.kind==='back')||s.choices.some(c=>!ids.has(c.id)))fail();
  if(gatePrep&&(!options.length||s.choices.length!==options.length+1||s.choices.at(-1).id!=='back'||options.some((card,index)=>{
   const saved=s.choices[index];
   return saved.id!==card.id||saved.kind!==card.kind||saved.weapon!==card.weapon||saved.primary!==card.primary||saved.secondary!==card.secondary;
  })))fail();
 }
 if(s.choice?.type==='clear'&&!s.stats.bossKilled)fail();
 if(s.queue.some(q=>!cardsOk(q.cards)||!validRelayRepair(q)||q.extra?.coastRecovery||q.cards.some(c=>c.kind==='coast-strike'||c.salvageLevel!==undefined||isCoastTacticalLoot(c)||isCoastService(c)||isWorkshopRebuild(c))))fail();
 if(s.raid){
  const {state,contract,progress,maxProgress,target,route,segment,quality,wager}=s.raid;
  const pointOk=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
  if(!['active','success','failed','withdrawn'].includes(state)||!Object.hasOwn(RULES.raidContracts,contract)||!Number.isFinite(progress)||progress<0||!(maxProgress>0&&Number.isFinite(maxProgress)))fail();
  if(!pointOk(target)||!Number.isFinite(target.hp)||!Number.isFinite(target.maxHp)||target.maxHp<=0||target.hp<0||target.hp>target.maxHp||!Number.isFinite(target.aim)||!Number.isFinite(target.r)||target.r<=0)fail();
  if(!Object.hasOwn(QUALITY,quality)||!Object.hasOwn(QUALITY,wager?.quality))fail();
  if(!Array.isArray(route)||route.length<2||!route.every((p,i)=>pointOk(p)&&(!i||distance(p,route[i-1])>0))||segment!=null&&(!Number.isInteger(segment)||segment<0||segment>=route.length-1))fail();
  s.raid.segment??=raidCursor(s.raid).segment;
 }
 if(s.operation&&s.stage==='holdout'){
  const gate=s.operation.gate;
  if(gate&&(!Number.isFinite(gate.x)||!Number.isFinite(gate.y)||gate.x<FIELD.left||gate.x>FIELD.right||gate.y<FIELD.top||gate.y>FIELD.bottom))fail();
  if(!gate&&s.balanceRevision!=='b06-swarms'&&canResumeRevision(s.balanceRevision))fail();
  if(!gate&&s.balanceRevision==='b06-swarms'){
   s.operation.gate=gatePosition(s);s.spawnClock=0;
   s.queue=s.queue.filter(item=>item.type!=='clear');
   if(s.choice?.type==='clear'){s.choice=null;s.choices=[];if(s.phase==='choice')s.phase='playing';if(s.resumePhase==='choice')s.resumePhase='playing';}
  }
 }
 const defense=s.challenge?.type==='defend'?s.challenge:null;
 if(s.challenge?.safeTransmission!==undefined&&(!defense||defense.safeTransmission!==true||s.operation?.region!==1||s.stage!=='holdout'))fail();
 if(defense&&(![defense.progress,defense.duration,defense.strike].every(Number.isFinite)
  ||s.balanceRevision===RULES.balanceRevision&&!defense.safeTransmission))fail();
 const relayRounds=s.hazards.filter(h=>h?.relayDefense!==undefined);
 const liveDefense=defense?.state==='active'&&!defense.secured||defense?.state==='withdrawn'&&s.phase==='result';
 if(relayRounds.length>1||relayRounds.some(h=>h.relayDefense!==true||!defense?.safeTransmission||h.lane
  ||![h.x,h.y,h.timer].every(Number.isFinite)||distance(h,DEFENSE_ZONE)>DEFENSE_ZONE.r||h.r!==RELAY_SHELL.radius||h.duration!==RELAY_SHELL.warning
  ||(h.hit?h.hit!==true||h.timer>0||h.timer<=-.3:!liveDefense||h.timer<=0||h.timer>RELAY_SHELL.warning)))fail();
 const earlyCoast=s.operation?.region===0&&s.challenge?.type==='hunt';
 const earlyRail=s.operation?.region===1&&defense?.safeTransmission&&isSalvageCampaign(s);
 if(s.challenge?.reserveAt!==undefined&&(!(earlyCoast||earlyRail)||s.challenge.tier!==1||s.challenge.state!=='active'
  ||!Number.isFinite(s.challenge.reserveAt)||s.challenge.reserveAt<0||s.challenge.reserveAt>=HOLDOUT.grace))fail();
 if(s.challenge?.type==='battery'){
  const {tier,targets,state,destroyed}=s.challenge;
  if(s.operation?.region!==2||s.stage!=='holdout'||!Number.isSafeInteger(tier)||tier<2||tier%2!==0
   ||!['active','complete','withdrawn'].includes(state)||!Array.isArray(targets)||targets.length!==2
   ||targets.some(id=>typeof id!=='string')||new Set(targets).size!==2
   ||!Array.isArray(destroyed)||new Set(destroyed).size!==destroyed.length||destroyed.some(id=>!targets.includes(id))
   ||state==='complete'&&destroyed.length!==targets.length)fail();
  const positions=portBatteryPositions(s.seed);
  for(const [index,id] of targets.entries()){
   const matches=s.enemies.filter(e=>e.id===id),gun=matches[0],cleared=destroyed.includes(id);
   if(matches.length>1||gun&&(gun.type!=='mortar'||gun.cohort!=='port-battery'
    ||gun.x!==positions[index].x||gun.y!==positions[index].y))fail();
   const live=gun&&!gun.dead&&gun.hp>0;
   if(cleared&&live||!cleared&&!live)fail();
  }
 }
 if(s.stats.portCounterbatteryCargo!==undefined&&(s.stats.portCounterbatteryCargo!==true||!isSalvageCampaign(s)||s.stage!=='holdout'||s.operation.region!==2||
  s.operation.challengeTier<2||!Number.isSafeInteger(s.stats.portBatteriesCleared)||s.stats.portBatteriesCleared<2))fail();
 if(s.challenge?.type==='intercept'){
  const {lane,timeLeft,target,tier,recoverCargo,secured}=s.challenge;
  if(![timeLeft,target?.x,target?.y,target?.hp,target?.maxHp].every(Number.isFinite)||timeLeft<0||timeLeft>SIGNAL_SECONDS||lane!==undefined&&lane!==signalLane(s.seed))fail();
  if(recoverCargo!==undefined&&(recoverCargo!==true||tier!==1||s.operation?.region!==2||!lane
   ||secured&&(target.hp!==0||!target.dead)))fail();
 }
 s.events=[];return s;
}
export function pause(s){if(s.phase==='result'||s.phase==='paused')return;s.resumePhase=s.phase;s.phase='paused';}
export function resume(s){if(s.phase==='paused'){s.phase=s.resumePhase||'playing';delete s.resumePhase;}}
export function xpNeeded(s){return s.level<=17?RULES.xpCosts[s.level-1]:90+(s.level-18)*7;}
export function pickupReach(s){return 65+s.boosts.pickup*10+moduleRank(s,'magnet')*30+(s.operation?.support==='recovery'?55:0);}
function gainXp(s,n){s.xp+=n;while(s.xp>=xpNeeded(s)){s.xp-=xpNeeded(s);s.level++;s.pendingLevels++;}}
const gunCard=(w)=>{const before=weaponStats(w),after=weaponStats({...w,level:w.level+1}),changes=[];if(before.count!==after.count)changes.push(`사격 ${before.count} → ${after.count}발`);if(before.damage!==after.damage)changes.push(`피해 ${before.damage} → ${after.damage}`);if(before.interval!==after.interval)changes.push(`간격 ${before.interval.toFixed(2)} → ${after.interval.toFixed(2)}초`);if(before.range!==after.range)changes.push(`사거리 ${before.range} → ${after.range}`);if(before.radius!==after.radius)changes.push(`폭발 범위 ${before.radius} → ${after.radius}`);return{id:`rank:${w.id}`,kind:'rank',weapon:w.id,title:`${GUNS[w.id].name} L${w.level+1}`,desc:w.level===3?'발사 방식을 선택해 전투를 바꿉니다.':changes.join(' · ')||'보유 공격의 위력을 확장합니다.',label:'보유 무기 투자'};};
const moduleCard=(id,rank=1)=>({id:`module:${id}`,kind:'module',module:id,rank:RULES.modules[id].unique?1:rank,title:MODULES[id].name,desc:MODULES[id].desc,label:'조건부 모듈'});
const reservationCard=id=>({...moduleCard(id),id:`requisition:${id}`,label:'예약품 · 이번 작전 장착'});
const utility=(key)=>({id:`utility:${key}`,kind:'utility',key,title:({health:'야전 응급처치',pickup:'회수 숙련',power:'추가 화력',charge:'탄약 보급'})[key],desc:({health:'최대 HP +6 · 체력 +6',pickup:'XP 회수 반경 +10 (최대 3회)',power:'기본 화력 +1% 가산',charge:'전탄 보급 충전 +10'})[key],label:'전술 보조'});
const upgradeable=s=>s.weapons.filter(w=>!w.evolved&&!w.fusion&&w.level<6);
function modulePool(s){
 const reserved=s.operation?.region<=requisitionFront(s.operation)?s.operation.requisition:null;
 return ['ricochet','coil','catalyst','magnet',...(s.research||[])].filter(id=>id!==reserved&&!s.excluded.includes(id)&&compatible(s,id)&&moduleRank(s,id)<(RULES.modules[id].unique?1:3));
}
function currentInvestments(s){return[...upgradeable(s).map(gunCard),...s.modules.filter(m=>!RULES.modules[m.id].unique&&m.rank<3&&compatible(s,m.id)).map(m=>moduleCard(m.id,1))];}
const trialModule=(s,pool,approach)=>{
 const trials=(s.trials||[s.trial]).filter(id=>pool.includes(id));
 return (approach&&trials.find(id=>RESEARCH[id].fieldGun===approach))||trials[0];
};
const trialCard=(id,rank=1)=>({...moduleCard(id,rank),label:'새 연구 · 첫 실전',trial:true});
const newGun=(id,label='새 무기')=>({id:`gun:${id}`,kind:'gun',weapon:id,title:`${GUNS[id].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label});
const coastRecovery=s=>s.operation?.region===1&&s.operation.coastStrikeUsed
 ?{module:COAST_APPROACHES[s.operation.coastStrike].module,coastApproach:s.operation.coastStrike}:null;
function supplyCards(s,site,preempt=false){
 const guns=upgradeable(s),rank=guns.length?gunCard(pick(s,'supply',guns)):currentInvestments(s)[0]||utility('health');
 const pool=modulePool(s),trial=trialModule(s,pool,site?.coastApproach);
 if(site?.opening&&!s.stats.coastPreempt){
  const choices=isSalvageCampaign(s)&&s.weapons.some(isCapturedTurret)?['f','h']:[site.gun,site.gun==='r'?'f':'r'];
  const opening=choices.filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id));
  return fillCards(s,[...opening.map(id=>newGun(id,COAST_APPROACHES[id]?.label||'직선 관통')),trial?trialCard(trial):rank]);
 }
 if(site?.opening)return fillCards(s,[rank,trial&&trialCard(trial)]);
 const key=site?.coastApproach;
 if(preempt){
  const gun={...newGun(key,'전방 보급 선점'),title:`${GUNS[key].name} L${COAST_SALVAGE_LEVEL} 노획`,salvageLevel:COAST_SALVAGE_LEVEL};
  return fillCards(s,[gun,rank]);
 }
 const plan=coastStrikeForSite(s,site);
 const addStrike=cards=>plan?[...cards,{id:`coast:${key}`,kind:'coast-strike',key,title:plan.name,desc:plan.impact,label:'장갑 수송차 공략'}]:cards;
 const signature=pool.includes(site?.module)?{...moduleCard(site.module),label:'이 동선의 특화 모듈'}:null;
 const cross=coastCrossGun(s,site);
 const service=coastService(s,site);
 const matchingRank=service?{...gunCard(service.weapon),id:`coast-service:${key}`,coastLevel:service.level,
  title:`${GUNS[key].name} L${service.level} 정비`,desc:'맞춤 거점에서 회수한 정비 부품',label:'노획 무장 정비'}:rank;
 const reservation=key&&s.operation?.region===0&&!s.operation.requisitionClaimed&&site===requisitionStation(s)
  ?reservationCard(s.operation.requisition):null;
 if(cross){
  if(!s.seenGuns.includes(cross))s.seenGuns.push(cross);
  const gun={...newGun(cross,'교차 노획 · 현장 정비'),title:`${GUNS[cross].name} L${COAST_SALVAGE_LEVEL} 노획`,salvageLevel:COAST_SALVAGE_LEVEL};
  const tactical=coastTacticalLootAvailable(s,site)?{...newGun(cross,'교차 노획 · 수송차 공략'),
   id:`coast-loot:${cross}`,title:`${GUNS[cross].short} L1 · ${COAST_STRIKES[cross].name}`,salvageLevel:1}:null;
  const cards=fillCards(s,[gun,reservation||rank,trial?trialCard(trial):signature]);
  if(tactical)cards.splice(1,0,tactical);
  return cards;
 }
 if(reservation)return addStrike(fillCards(s,[reservation,signature,trial?trialCard(trial):matchingRank]));
 if(site?.coastApproach&&signature&&trial)return addStrike(fillCards(s,[matchingRank,signature,trialCard(trial)]));
 const cards=[matchingRank];
 const unseen=['h','r','f'].filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id)&&!(s.supplyCount<2&&s.seenGuns.includes(id)));
 if(unseen.length){const id=unseen.includes(site?.gun)?site.gun:pick(s,'supply',unseen);cards.push(newGun(id,id===site?.gun?'이 동선의 주력 무장':'새 무기'));if(!s.seenGuns.includes(id))s.seenGuns.push(id);}
 let favored=pool;
 if(s.supplyCount<2){const focus=s.weapons.find(w=>w.id===s.firstNew)||s.weapons[0],requirements=Object.values(RULES.weapons[focus.id].evolution.moduleByBranch).flat();const useful=pool.filter(id=>requirements.includes(id));if(useful.length)favored=useful;}
 if(pool.length)cards.push(trial?trialCard(trial):signature||moduleCard(pick(s,'supply',favored)));
 return addStrike(fillCards(s,cards));
}
function workshopRebuild(s){
 if(s.operation?.region!==1||s.stage!=='field')return null;
 const [h,r,donor]=['h','r','f'].map(id=>s.weapons.find(w=>w.id===id&&!w.fusion&&!w.evolved));
 if(!h||!r||typeof donor?.uid!=='string'||!donor.uid)return null;
 const recipient=h.level<=r.level?h:r;
 if(recipient.level>2)return null;
 return {...gunCard(recipient),id:`rail-strip:${recipient.id}`,railDonor:donor.uid,
  railLevel:recipient.level+2,label:'보조 무장 분해'};
}
const isWorkshopRebuild=c=>c?.railDonor!==undefined||c?.railLevel!==undefined||typeof c?.id==='string'&&c.id.startsWith('rail-strip:');
function validWorkshopRebuild(s,c){
 if(s.choice?.type!=='rail-workshop'||!s.sites.some(n=>n.id==='rail-cache'&&n.state==='done'))return false;
 const rebuild=workshopRebuild(s);
 return !!rebuild&&c.kind==='rank'&&c.id===rebuild.id&&c.weapon===rebuild.weapon
  &&c.railDonor===rebuild.railDonor&&c.railLevel===rebuild.railLevel;
}
export function railWorkshopPlan(s){
 const captured=isSalvageCampaign(s)&&s.weapons.find(isCapturedTurret);
 const focus=captured?'r':s.firstNew||'h';
 const parts=completionModules(s),preferred=({f:'catalyst',r:'coil',h:'ricochet'})[focus];
 const part=parts.includes(preferred)?preferred:parts[0];
 const upgrades=upgradeable(s),gun=upgrades.find(w=>w.id===focus)||upgrades[0];
 const installed=s.weapons.map(w=>({w,change:railCalibration(s,w)})).filter(x=>x.change);
 const pivot=installed.find(x=>x.change.gun===focus)||installed[0];
 const reserved=requisitionFront(s.operation)===1&&!s.operation.requisitionClaimed?s.operation.requisition:null;
 const cards=[];
 if(pivot)cards.push({id:`calibrate:${pivot.w.uid}`,kind:'calibrate',weapon:pivot.w.id,uid:pivot.w.uid,title:'완성 병기 재개장',label:'전선 공방'});
 if(part)cards.push({...moduleCard(part),label:'모듈 투자'});
 if(gun&&cards.length<2)cards.push(gunCard(gun));
 if(reserved)cards.splice(1);
 const rebuild=workshopRebuild(s);
 if(rebuild)cards.push(rebuild);

 // The railway boss can supply the permit. Preview the actual material gap independently.
 const stock=s.tuning>0?s:{...s,tuning:1},known=new Set(capstoneOptions(stock).map(c=>c.id));
 const target=focus==='r'&&!captured?'fusion:h:r':`evolve:${focus}`;
 const investments=[...upgrades.map(gunCard),...parts.filter(id=>id!==reserved).map(id=>moduleCard(id)),...(rebuild?[rebuild]:[])];
 const finishes=investments.flatMap(card=>{
  const recipes=investmentCapstones(stock,card,known);
  const recipe=recipes.find(c=>c.id===target)||recipes[0];
  return recipe?[{card,recipe,needsPermit:s.tuning<=0}]:[];
 });
 const isOffered=finish=>cards.some(c=>c.id===finish.card.id);
 const finish=finishes.find(f=>f.recipe.id===target&&isOffered(f))||finishes.find(f=>f.recipe.id===target)
  ||finishes.find(isOffered)||finishes[0];
 if(finish){
  const card={...finish.card,label:'마지막 조립 재료',workshopFinish:true};
  const offered=cards.findIndex(c=>c.id===card.id);
  const replacement=offered>=0?offered:cards.findIndex(c=>c.kind===card.kind&&!c.railDonor),limit=(reserved?1:2)+Number(!!rebuild);
  if(replacement>=0)cards[replacement]=card;
  else if(cards.length<limit)cards.push(card);
  else cards[limit-1]=card;
 }
 if(reserved)cards.unshift(reservationCard(reserved));
 cards.push({id:'resupply:rail-workshop',kind:'resupply',title:'차내 응급 보급',heal:20,charge:15,label:'생존 투자'});
 return {cards,finish:finish||null};
}
function fillCards(s,cards){const unique=[...new Map(cards.filter(Boolean).map(c=>[c.id,c])).values()];for(const key of ['health','charge','power'])if(unique.length<3&&!unique.some(c=>c.id===`utility:${key}`))unique.push(utility(key));return unique.slice(0,3);}
export function infernoControlRank(s){
 const front=s.operation?.region;
 if(s.stage!=='field'||![1,2].includes(front)||moduleRank(s,'catalyst')<2)return null;
 const weapon=upgradeable(s).find(w=>w.id==='f'&&w.branch&&w.level>=(front===1?4:5));
 return weapon?weapon.level+1:null;
}
function relayInvestmentCards(s){
 if(!isSalvageCampaign(s)||s.operation.region!==1||s.stage!=='field')return [];
 const flame=s.weapons.find(w=>w.id==='f'&&w.level>=3&&!w.evolved&&!w.fusion);
 if(s.firstNew==='f'&&flame){
  const rank=flame.level<6?{...gunCard(flame),label:'분사기 정비'}:null;
  const catalyst=moduleRank(s,'catalyst')<2&&modulePool(s).includes('catalyst');
  return [...(rank?[rank]:[]),...(catalyst?[{...moduleCard('catalyst'),label:'인페르노 재료'}]:[])];
 }
 if(s.firstNew!=='r'||!s.weapons.some(w=>w.id==='r'&&w.level>=4&&!w.fusion&&!w.evolved&&!isCapturedTurret(w)))return [];
 const rifle=s.weapons.find(w=>w.id==='h'&&!w.fusion&&!w.evolved&&w.level>=2);
 if(!rifle)return [];
 const coil=moduleRank(s,'coil')<2&&modulePool(s).includes('coil');
 return [...(rifle.level<4?[{...gunCard(rifle),label:'격발망 조립 재료'}]:[]),...(coil?[{...moduleCard('coil'),label:'격발망 조립 재료'}]:[])];
}
export function railRelayInvestment(s){
 const cards=relayInvestmentCards(s);
 const material=cards.map(card=>card.kind==='rank'
  ?`${GUNS[card.weapon].short} L${rankChoiceLevel(s.weapons.find(w=>w.id===card.weapon),card)}`:`${MODULES[card.module].name} +1`).join(' / ');
 return {cards,material};
}
function controlInvestment(s,cards,siteId){
 const controlSite={1:'rail-relay',2:'port-control'}[s.operation?.region];
 if(!controlSite||siteId!==controlSite)return cards;
 const relay=siteId==='rail-relay'?relayInvestmentCards(s):[];
 if(relay.length){
  const ids=new Set(relay.map(card=>card.id));
  const others=cards.filter(card=>!ids.has(card.id));
  const trial=others.find(card=>card.trial);
  return fillCards(s,[...relay,trial,others.find(card=>card.kind==='utility'),...others]);
 }
 if(!infernoControlRank(s))return cards;
 const flame=upgradeable(s).find(w=>w.id==='f');
 const upgrade={...gunCard(flame),label:flame.level===5?'인페르노 조립 재료':'인페르노 준비'};
 const existing=cards.findIndex(c=>c.id===upgrade.id);
 const current=cards.findIndex(c=>c.kind==='rank');
 const index=existing>=0?existing:current>=0?current:cards.length-1;
 return [upgrade,...cards.filter((_,i)=>i!==index)];
}
function investmentCapstones(s,c,known){
 const opened=new Map(),record=draft=>{
  for(const recipe of capstoneOptions(draft)){
   if(known.has(recipe.id))continue;
   const previous=opened.get(recipe.id);
   const title=previous&&recipe.kind==='fusion'&&previous.title!==recipe.title
    ?fusionTitle(recipe.primary,recipe.secondary):recipe.title;
   opened.set(recipe.id,{...recipe,title});
  }
 };
 if(c?.kind==='module'){
  const rank=moduleRank(s,c.module);
  if(rank&&rank<3&&compatible(s,c.module)){
   const {next}=moduleGain(s,c.module,c.rank);
   record({...s,modules:s.modules.map(m=>m.id===c.module?{...m,rank:next}:m)});
  }
 }else if(c?.kind==='rank'){
  const w=upgradeable(s).find(w=>w.id===c.weapon);
  if(w&&rankChoiceLevel(w,c)>=4){
   const level=rankChoiceLevel(w,c),branches=w.level<4?Object.keys(GUNS[w.id].branches):[w.branch];
   const weapons=c.railDonor?s.weapons.filter(other=>other.id!=='f'||other.uid!==c.railDonor):s.weapons;
   for(const branch of branches)record({...s,weapons:weapons.map(other=>other===w?{...w,level,branch}:other)});
  }
 }
 return [...opened.values()];
}
function closingInvestment(s,offered,rest){
 if(!s.operation||s.tuning<=0||!s.weapons.some(w=>w.level>=3&&!w.evolved&&!w.fusion))return null;
 const already=new Set(capstoneOptions(s).map(c=>c.id));
 const closes=c=>investmentCapstones(s,c,already).length>0;
 if(offered.some(closes))return null;
 const card=rest.find(closes);
 return card?{...card,label:'조립 직전'}:null;
}
function levelCards(s){
 const investments=currentInvestments(s),guns=upgradeable(s),missed=guns.filter(w=>!s.offeredWeapons.slice(-2).some(ids=>ids.includes(w.id))),a=guns.length?gunCard(pick(s,'supply',missed.length?missed:guns)):investments[0];
 const rest=investments.filter(c=>c.id!==a?.id);
 const newModules=s.operation&&s.modules.length<4&&(!rest.length||s.modules.length===0||s.offeredWeapons.length%3===2)?modulePool(s).filter(id=>!moduleRank(s,id)):[];
 const trial=trialModule(s,newModules);
 const b=trial?trialCard(trial):newModules.length?{...moduleCard(pick(s,'supply',newModules)),label:'새 발동 모듈'}:rest.length?pick(s,'supply',rest):null;
 const close=b?.trial?null:closingInvestment(s,[a,b],rest);
 const support=utility(s.boosts.pickup<3&&rng(s,'supply')<.45?'pickup':'health');
 const cards=a||b?fillCards(s,[a,close||b,support]):['power','health','charge'].map(utility);
 s.offeredWeapons.push(cards.filter(c=>c.kind==='rank').map(c=>c.weapon));return cards;
}
function rollQuality(s,key){const p=RULES.quality[key],r=rng(s,'loot');return r<p.common?'common':r<p.common+p.rare?'rare':'prototype';}
function armoryCards(s,quality){
 const cards=[],pool=modulePool(s),amount=quality==='common'?1:quality==='rare'?2:3;
 if(quality==='prototype'&&s.operator!=='marco'&&!moduleRank(s,'overcharger'))cards.push(moduleCard('overcharger',1));
 const trial=trialModule(s,pool);if(trial){cards.push(trialCard(trial,amount));pool.splice(pool.indexOf(trial),1);}
 while(cards.length<3&&pool.length){const full=pool.filter(id=>moduleRank(s,id)+amount<=3),id=pick(s,'loot',full.length?full:pool);pool.splice(pool.indexOf(id),1);cards.push(moduleCard(id,amount));}
 return fillCrate(cards,quality);
}
function fillCrate(cards,quality){const i=['common','rare','prototype'].indexOf(quality),cfg=RULES.crateRewards,packets=[{id:'resupply:medical',kind:'resupply',title:'야전 의료 보급',heal:cfg.medicalHeal[i],charge:0},{id:'resupply:ammo',kind:'resupply',title:'강화 탄창 보급',heal:0,charge:cfg.ammoCharge[i]},{id:'resupply:mixed',kind:'resupply',title:'혼합 재보급',heal:cfg.mixedHeal[i],charge:cfg.mixedCharge[i]}];return [...cards,...packets.map(c=>({...c,desc:`${c.heal?`체력 +${c.heal}`:''}${c.heal&&c.charge?' · ':''}${c.charge?`전탄 충전 +${c.charge}`:''}`,label:'같은 품질 재보급'}))].slice(0,3);}
function crateCards(s,quality,contract=null){
 const base=armoryCards(s,quality),reserved=base.filter(c=>c.module==='overcharger');let special;
 if(contract==='light'){if(refitWeapons(s).length)special={id:'refit:field',kind:'refit',title:'야전 분화 개장',desc:'보유 L4 이상 총 하나의 분화를 전환합니다. 레벨·모듈·조율권 유지.',label:'보급차 작업대'};else{const guns=upgradeable(s);if(guns.length)special={...gunCard(pick(s,'loot',guns)),label:'보급차 무기 강화'};}}
 if(contract==='armored'){const pool=completionModules(s);if(pool.length)special={...moduleCard(pick(s,'loot',pool),quality==='common'?1:quality==='rare'?2:3),support:true,label:'장갑 수송대 · 완성 부품'};}
 return fillCrate([...reserved,...(special?[special]:[]),...base.filter(c=>c.module!=='overcharger'&&c.id!==special?.id)],quality);
}
function openChoice(s,type,cards,source='',extra={}){
 if(s.operation)s.levelReadyAt=s.t+RULES.levelChoiceSpacing;
 s.phase='choice';s.choice={type,source,...extra};s.choices=cards;
}
const SITE_PICKUP_RANGE=74,LEVEL_PICKUP_PRIORITY=120;
const RESCUE_FOCUS_SECONDS=15;
const OPENING_WEAPON_SECONDS=2.5;
const FIRST_CONTACT_SECONDS=6;
function deferOpeningUpgrade(s){
 if(s.operation?.region!==0||s.stage!=='field'||s.player.hp<s.player.maxHp*.45)return false;
 if(s.t<(s.openingFireUntil||0))return true;
 if(s.t>=RESCUE_FOCUS_SECONDS)return false;
 return s.sites.some(site=>(site.opening||site.preempt)&&['active','ready'].includes(site.state)&&distance(site,s.player)<300);
}
export function canOpenLevel(s){
 return s.phase==='playing'&&s.player.hp>0&&s.pendingLevels>0&&!s.queue.length&&!deferOpeningUpgrade(s);
}
function deferContactDraft(s){
 if(!s.openingFireUntil||s.t>=s.openingFireUntil+FIRST_CONTACT_SECONDS-OPENING_WEAPON_SECONDS||s.player.hp<s.player.maxHp*.45)return false;
 if(s.operation?.order&&!s.operation.orderDone||s.raid?.state==='active')return false;
 const site=coastLead(s);
 if(!site?.coastApproach||site.coastApproach!==s.firstNew)return false;
 const gap=distance(s.player,site);
 return site.state==='waiting'?gap<=430:site.state==='active'&&gap<=coastApproach(site).range+130;
}
function openLevel(s,extra){
 s.pendingLevels--;
 openChoice(s,'level',levelCards(s),`LEVEL ${s.level}`,extra);
}
function nextChoice(s){
 if(s.phase!=='playing')return;
 if(s.queue.length){const item=s.queue.shift();openChoice(s,item.type,item.cards,item.source,item.extra);return;}
 if(s.t<(s.levelReadyAt||0)||!canOpenLevel(s)||deferContactDraft(s))return;
 // Let nearby field objectives take precedence over routine upgrades.
 if(s.operation&&s.stage==='holdout'&&interaction(s))return;
 if(s.operation&&s.stage!=='boss'&&s.sites.some(site=>site.state==='ready'&&distance(site,s.player)<LEVEL_PICKUP_PRIORITY))return;
 openLevel(s);
}
export function assemblyOptions(s){
 const options=s.operation&&s.stats.challengeWins>0&&!s.player.maneuver?Object.entries(MANEUVERS).map(([key,m])=>({id:`maneuver:${key}`,kind:'maneuver',key,title:m.name,desc:m.impact,label:'노획 교범 · 한 판에 하나'})):[];
 if(s.tuning<=0)return options;
 for(const w of s.weapons)if(canEvolve(s,w))options.push({id:`evolve:${w.id}`,kind:'evolve',weapon:w.id,title:capstoneName(w),desc:'발사 구조 확장 · 조율권 1 · 모듈 유지',label:'단일 진화'});
 if(moduleRank(s,'coil')>=2)for(const a of s.weapons)for(const b of s.weapons){if(!canFuse(s,a,b))continue;options.push({id:`fusion:${a.id}:${b.id}`,kind:'fusion',primary:a.id,secondary:b.id,title:fusionTitle(a.id,b.id,b.branch),desc:`${GUNS[a.id].short} 사격 유지 + ${GUNS[b.id].short} 폭발 계승 · 총 2개 → 1칸`,label:'태그 합체'});}
 for(const m of s.modules)if(!RULES.modules[m.id].unique&&m.rank<3)options.push({id:`tune:${m.id}`,kind:'tune',module:m.id,title:`${MODULES[m.id].name} 조율`,desc:`${m.rank} → ${m.rank+1}강화 · 조율권 1`,label:'발동 시너지'});
 options.push({id:'tune:repair',kind:'repair',title:'응급 정비',desc:'최대 HP +15 · 체력 +35 · 조율권 1',label:'생존 투자'});return options;
}
const capstoneOptions=s=>assemblyOptions(s).filter(c=>c.kind==='evolve'||c.kind==='fusion');
export function gatePreparation(s){
 if(s.phase!=='choice'||s.choice?.type!=='clear'||!atForwardGate(s))return null;
 return {capstones:capstoneOptions(s),upgrades:canOpenLevel({...s,phase:'playing'})?s.pendingLevels:0};
}
function openAssembly(s,options,gatePrep=false){
 const back={id:'back',kind:'back',title:gatePrep?'게이트로 돌아가기':'전투로 돌아가기',desc:'조율권과 무장을 유지합니다.'};
 openChoice(s,'assembly',[...options,back],gatePrep?'전진 게이트':'병기 조립',gatePrep?{gatePrep:true}:{});
}
function closeChoice(s,next=false){
 if(s.choice.gatePrep){openChoice(s,'clear',exitCards(s),'열린 출구');return;}
 s.phase='playing';s.choice=null;s.choices=[];
 if(next)nextChoice(s);
}
export function choose(s,id,{branch,slot,doctrine,weapon}={}){
 if(s.phase!=='choice')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 const reserved=c.id.startsWith('requisition:');
 if(isWorkshopRebuild(c)&&!validWorkshopRebuild(s,c))return false;
 if(isCoastService(c)&&!validCoastService(s,c))return false;
 if(reserved&&!validReservation(s,c))return false;
 if((c.salvageLevel!==undefined||isCoastTacticalLoot(c))&&(!validCoastSalvage(s,c)||Number.isInteger(slot)&&slot>=0))return false;
 if(c.kind==='coast-boss'){
  const coast=coastAtShore(s),plan=c.id==='coast:break'?'break':c.id==='coast:capture'?'capture':null;
  if(!coast||s.choice.type!=='coast-boss'||s.stage!=='field'||coast.plan||!plan)return false;
  coast.plan=plan;
  closeChoice(s);
  return beginBoss(s);
 }
 if(c.kind==='coast-mount'){
  const option=coastMountCards(s).find(item=>item.id===c.id);
  if(!option||s.choice.type!=='coast-mount')return false;
  const old=s.weapons[option.slot],rocket=old?.id==='r';
  const mount={...(rocket?old:makeWeapon('r')),uid:COAST_TURRET_RECOVERED,capturedTurret:true,
   level:rocket?old.level:3,cd:0,targetId:null,targetUntil:0};
  if(option.slot<0)s.weapons.push(mount);
  else s.weapons[option.slot]=mount;
  coastSalvage(s).mounted=true;
  closeChoice(s);
  emit(s,'complete',s.player.x,s.player.y,{text:'노획 포탑 장착 · 철도에서 사격 가능',life:1.25});
  return true;
 }
 if(c.kind==='advance'){
  if(!canAdvanceFront(s)||s.stage!=='holdout'||!s.boss.dead)return false;
  if(carriesCoastSalvage(s)&&(!atExitGate(s)||s.choice.type!=='clear'||!exitCards(s).some(card=>card.id===c.id&&card.support===c.support)))return false;
  s.stats.choices.push({id:c.id,region:s.operation.region,t:s.t});
  return advanceRegion(s,c);
 }
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen&&!Object.hasOwn(operatorOf(s).stances,doctrine))return false;
 if(c.kind==='rank'){
  const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);
  if(!w||w.level>=6||w.evolved)return false;
  const from=w.level,level=rankChoiceLevel(w,c);
  if(level===4&&!Object.hasOwn(GUNS[w.id].branches,branch))return false;
  w.level=level;
  if(level===4)w.branch=branch;
  if(c.coastLevel){
   s.tuning-=COAST_SERVICE_COST;
   s.stats.coastService={weapon:w.id,from,to:level};
  }
  if(c.railDonor){
   const donor=s.weapons.find(gun=>gun.id==='f'&&gun.uid===c.railDonor);
   s.weapons=s.weapons.filter(gun=>gun!==donor);
   s.stats.railRebuild={weapon:w.id,from,to:level,donor:donor.id,donorLevel:donor.level};
  }
 }
 else if(c.kind==='module'){
  if(!MODULES[c.module]||!reserved&&!compatible(s,c.module))return false;let m=s.modules.find(m=>m.id===c.module);
  const gain=moduleGain(s,c.module,c.rank);
  if(m){if(m.rank>=3||RULES.modules[m.id].unique)return false;m.rank=gain.next;}else{m={id:c.module,rank:gain.next};if(s.modules.length>=4){if(!canReplaceModule(s,c.module,slot))return false;s.modules[slot]=m;}else s.modules.push(m);}
  if(reserved)s.operation.requisitionClaimed=true;
  if((s.trials||[s.trial]).includes(c.module)){s.stats.researchTrialPicked=c.module;(s.stats.researchTrialsPicked??=[]).push(c.module);s.trials=(s.trials||[s.trial]).filter(id=>id!==c.module);s.trial=s.trials[0]||null;}
  if(gain.charge){const before=s.player.charge;s.player.charge=Math.min(100,before+gain.charge);s.stats.overflowCharge=(s.stats.overflowCharge||0)+s.player.charge-before;}
 }
 else if(c.kind==='gun'){
  if(s.weapons.some(w=>w.id===c.weapon&&!w.fusion))return false;const w=makeWeapon(c.weapon);
  if(s.weapons.length>=3||Number.isInteger(slot)&&slot>=0){const old=s.weapons[slot];if(!old||old.evolved||old.fusion)return false;w.level=gunEquipLevel(s,c,old);if(w.level>=4){if(!GUNS[w.id].branches[branch])return false;w.branch=branch;}if(s.refits>0&&s.stage==='field')s.refits--;w.uid=`w-${++s.id}`;s.weapons[slot]=w;}else{w.level=gunEquipLevel(s,c);w.uid=`w-${++s.id}`;s.weapons.push(w);}
  if(!s.firstNew)s.firstNew=w.id;
  if(isCoastTacticalLoot(c))s.operation.coastStrike=w.id;
  if(s.choice.preempt){
   s.stats.coastPreempt=w.id;
   s.spawnClock=Math.min(s.spawnClock,.36);
  }
  if(s.operation?.region===0&&(s.choice.opening||s.choice.preempt))s.openingFireUntil=s.t+OPENING_WEAPON_SECONDS;
 }
 else if(c.kind==='evolve'){if(!assemblyOptions(s).some(o=>o.id===id))return false;const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion&&!w.evolved);w.evolved=true;s.tuning--;buildCompleted(s,'single',{weapon:w.id,captured:isCapturedTurret(w)});}
 else if(c.kind==='fusion'){
  if(!assemblyOptions(s).some(o=>o.id===id))return false;const a=s.weapons.find(w=>w.id===c.primary&&!w.fusion),b=s.weapons.find(w=>w.id===c.secondary&&!w.fusion);a.fusion={secondary:b.id,branch:b.branch,overflow:Math.min(4,a.level+b.level-8)};a.level=6;a.evolved=true;a.payload=RULES.fusion.hitsPerPayload;s.weapons.splice(s.weapons.indexOf(b),1);s.tuning--;buildCompleted(s,'fusion',{incendiary:b.branch==='incendiary'});
 }else if(c.kind==='maneuver'){if(s.choice.type!=='assembly'||!assemblyOptions(s).some(o=>o.id===id&&o.key===c.key))return false;s.player.maneuver=c.key;s.stats.maneuver=c.key;}
 else if(c.kind==='permit'){if(s.choice.type!=='pursuit-reward'||c.id!=='pursuit:permit'||s.stage!=='holdout'||s.challenge?.state!=='complete'||s.challenge.tier!==1)return false;s.tuning++;}
 else if(c.kind==='front-support'){
  if(s.choice.type!=='pursuit-reward'||!s.operation||s.operation.region>=REGIONS.length-1||!Object.hasOwn(FRONT_SUPPORTS,c.key)||c.key==='vanguard'||s.operation.nextSupport)return false;
  s.operation.nextSupport=c.key;
 }
 else if(c.kind==='cargo'){
  if(s.choice.type!=='pursuit-reward'||s.operation?.region!==2||s.stats.holdoutCargo)return false;
  s.stats.holdoutCargo=true;
 }
 else if(c.kind==='coast-strike'){
  if(!validCoastStrike(s,c))return false;
  s.operation.coastStrike=c.key;
 }
 else if(c.kind==='tune'){const m=s.modules.find(m=>m.id===c.module);if(s.tuning<1||!m||m.rank>=3)return false;m.rank++;s.tuning--;}
 else if(c.kind==='repair'){if(s.tuning<1)return false;s.tuning--;s.player.maxHp+=15;s.player.hp=Math.min(s.player.maxHp,s.player.hp+35);}
 else if(c.kind==='utility'){if(c.key==='health'){s.player.maxHp+=6;s.player.hp=Math.min(s.player.maxHp,s.player.hp+6);}if(c.key==='pickup'){if(s.boosts.pickup>=3)return false;s.boosts.pickup++;}if(c.key==='power')s.boosts.power++;if(c.key==='charge')s.player.charge=Math.min(100,s.player.charge+10);}
 else if(c.kind==='refit'){const w=refitWeapons(s).find(w=>w.id===weapon);if(!w||!GUNS[w.id].branches[branch]||w.branch===branch)return false;w.branch=branch;w.targetId=null;s.stats.fieldRefits=(s.stats.fieldRefits||0)+1;}
 else if(c.kind==='calibrate'){
  if(s.choice.type!=='rail-workshop'||s.operation?.region!==1||s.stage==='boss')return false;
  const w=s.weapons.find(w=>w.uid===c.uid),change=w&&railCalibration(s,w);
  if(!change)return false;
  (w.fusion||w).branch=change.to;w.targetId=null;
  s.stats.railCalibration=change;
 }
 else if(c.kind==='resupply'){if(!Number.isFinite(c.heal)||!Number.isFinite(c.charge)||c.heal<0||c.charge<0)return false;s.player.hp=Math.min(s.player.maxHp,s.player.hp+c.heal);s.player.charge=Math.min(100,s.player.charge+c.charge);}
 else if(c.kind==='back'){closeChoice(s);return true;}
 else if(c.kind==='control'){
  if(c.key==='crossfire'&&(!s.choices.some(card=>card.id==='control:crossfire')||!portTacticKeys(s).includes('crossfire')))return false;
  if(c.key==='jam')s.operation.jammed=true;
  else if(c.key==='loot')s.queue.push({type:'armory',source:'관제소 시험 탄약',cards:controlInvestment(s,armoryCards(s,'rare'),'port-control'),extra:{quality:'rare',siteId:'port-control'}});
  else if(c.key==='supply'){
   const relay=railRelayInvestment(s);
   s.queue.push({type:'supply',source:s.choice.source,cards:controlInvestment(s,supplyCards(s),'rail-relay'),
    extra:{siteId:'rail-relay',...(relay.material?{relayRepair:true}:null)}});
  }
  else if(Object.hasOwn(FRONT_TACTICS[s.operation?.region]||{},c.key)&&!s.operation.tactic)s.operation.tactic=c.key;
  else return false;
 }
 else if(c.kind==='extract'){
  const coast=coastSalvage(s);
  if(isSalvageCampaign(s)){
   if(s.choice.type!=='clear'||!atExitGate(s))return false;
   if(s.operation.region===0)return finish(s,false,'retreat');
   coast.extracted=true;
   if(s.operation.region===1)return finish(s,false,'rail-return');
   s.operation.extracted=true;
   return finish(s,true);
  }
  if(coast){
   if(s.choice.type!=='clear'||!atExitGate(s)||canAdvanceFront(s))return false;
   coast.extracted=true;
   return finish(s,false,isCoastRailSortie(s)?'rail-return':'coast-return');
  }
  if(s.operation&&s.operation.cleared===3)s.operation.extracted=true;finish(s,true);return true;
 }
 else if(c.kind==='stay'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else return false;
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen){if(!Object.hasOwn(operatorOf(s).stances,doctrine))return false;s.player.doctrine=doctrine;s.player.branchChosen=true;}
 s.stats.choices.push({t:Math.round(s.t*10)/10,id,branch:branch||null,weapon:weapon||null,source:s.choice.type,contract:s.choice.contract||null,quality:s.choice.quality||null});if(s.choice.type==='supply')s.supplyCount++;
 if(heatSynergyReady(s))buildCompleted(s,'synergy');
 emit(s,'choose');closeChoice(s,true);return true;
}
export function reroll(s){
 const type=s.choice?.type;
 if(s.phase!=='choice'||s.choice?.opening||s.choice?.preempt||!['level','supply','armory','raid-reward'].includes(type)||s.rerolls<=0)return false;
 s.rerolls--;
 if(type==='level')s.choices=levelCards(s);
 else if(type==='supply'){
  const site=s.choice.coastRecovery?coastRecovery(s):s.sites.find(site=>site.id===s.choice.siteId&&site.id!=='rail-relay');
  s.choices=controlInvestment(s,supplyCards(s,site),s.choice.siteId);
 }else{
  const cards=crateCards(s,s.choice.quality,type==='raid-reward'?(s.choice.contract||s.raid?.contract):null);
  s.choices=type==='armory'?controlInvestment(s,cards,s.choice.siteId):cards;
 }
 return true;
}
export function banishOptions(s){if(s.phase!=='choice'||s.choice.preempt||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.banishes<=0)return[];return s.choices.filter(c=>{const id=c.kind==='gun'?c.weapon:c.kind==='module'?c.module:null;return id&&!isCoastTacticalLoot(c)&&!s.weapons.some(w=>w.id===id&&!w.fusion)&&(!moduleRank(s,id)||c.support)&&id!=='overcharger'&&!(c.kind==='gun'&&s.supplyCount<2&&['r','f'].filter(id=>!s.excluded.includes(id)).length<=2);});}
export function banish(s,id){const c=banishOptions(s).find(c=>c.id===id);if(!c)return false;const target=c.kind==='gun'?c.weapon:c.module;if(!moduleRank(s,target))s.excluded.push(target);s.banishes--;
 if(c.kind==='gun')s.choices=s.choices.filter(card=>!(isCoastTacticalLoot(card)&&card.weapon===target));
 const index=s.choices.indexOf(c);
 const used=new Set([...s.choices.filter(card=>card!==c).map(card=>card.id),c.id]);let replacement;
 if(c.kind==='gun'){const pool=['h','r','f'].filter(g=>!s.excluded.includes(g)&&!s.weapons.some(w=>w.id===g&&!w.fusion)&&!used.has(`gun:${g}`));if(pool.length){const g=pick(s,'supply',pool);replacement={id:`gun:${g}`,kind:'gun',weapon:g,title:`${GUNS[g].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:'새 무기'};}}
 const rank=['armory','raid-reward'].includes(s.choice.type)?({common:1,rare:2,prototype:3})[s.choice.quality]:c.kind==='module'?c.rank:1;
 if(!replacement){let pool=modulePool(s).filter(m=>!used.has(`module:${m}`)),support=false;if(c.support){const needed=completionModules(s).filter(m=>pool.includes(m));if(needed.length){pool=needed;support=true;}}if(pool.length)replacement={...moduleCard(pick(s,'supply',pool),rank),...(support?{support:true,label:'장갑 수송대 · 완성 부품'}:{})};}
 if(!replacement)replacement=(['armory','raid-reward'].includes(s.choice.type)?fillCrate([],s.choice.quality):['health','charge','power'].map(utility)).find(card=>!used.has(card.id));s.choices[index]=replacement;return true;
}
export function skip(s){if(s.phase!=='choice'||['assembly','clear','pursuit-reward','coast-boss','coast-mount'].includes(s.choice.type))return false;if(s.player.hp<s.player.maxHp)s.player.hp=Math.min(s.player.maxHp,s.player.hp+s.player.maxHp*.05);else s.player.charge=Math.min(100,s.player.charge+5);if(s.choice.type==='supply')s.supplyCount++;closeChoice(s,true);return true;}

function buildCompleted(s,kind,{weapon,incendiary=false,captured=false}={}){
 if(!s.stats.completedBuild)s.stats.completedBuild={kind,t:s.t};
 if(captured)s.stats.turretEvolvedAt=s.t;
 const showcase=kind==='fusion'?'fusion':weapon==='f'?'flame':weapon==='r'?'rocket':null;
 const revealed=showcase==='fusion'?'fusionReveal':showcase==='rocket'?'rocketReveal':'flameReveal';
 if(showcase&&!s.stats[revealed]){
  s.stats[revealed]=true;
  const remaining=s.powerDone?Math.max(24,s.powerWave?.remaining||0):60;
  s.powerWave={delay:.65,remaining,clock:0,paired:Math.min(4,Math.floor(remaining/8)),showcase};
  s.powerDone=true;
  const text=showcase==='fusion'?`${incendiary?'점화 격발망':'전도 격발망'} 가동 · 분산 편대 접근`
   :showcase==='rocket'?`${captured?CAPTURED_TURRET.evolution:'폭풍 발사대'} 가동 · 갈라진 편대 접근`:'인페르노 가동 · 밀집 보병 접근';
  emit(s,'complete',s.player.x,s.player.y,{life:1.2,showcase,text});
 }else if(!s.powerDone){
  s.powerDone=true;s.powerWave={delay:4,remaining:60,clock:0};
  emit(s,'complete',s.player.x,s.player.y,{life:1.2,text:kind==='single'?'무기 진화 완료':'발동 연계 완성'});
 }
}
export function partPosition(s,part){const b=s.boss;if(s.operation?.region===1)return{x:b.x+part.ox,y:b.y};return{x:b.x+Math.cos(b.body-Math.PI/2)*part.ox,y:b.y+Math.sin(b.body-Math.PI/2)*part.ox};}
function targets(s,breachLane,syncParts=true,armorCycle){
 const list=alive(s),signal=signalCourier(s);
 if(signal?.hp>0)list.push(signal);
 if(s.raid?.state==='active'&&s.raid.target.hp>0)list.push(s.raid.target);
 if(s.boss.active&&!s.boss.dead){
  if(coastAtShore(s)){
   const part=s.boss.parts[0];
   if(coastTurretLane(s)){
    if(syncParts)Object.assign(part,partPosition(s,part));
    list.push(part);
   }else list.push(s.boss);
   return list;
  }
  const breach=s.operation?.region===2?((breachLane??portBreachFlank(s))||armorCycle!==undefined&&armorCycle===portArmorOpportunity(s)):s.operation?.support==='breach';
  if(!breach)list.push(s.boss);
  for(const part of s.boss.parts)if(part.hp>0){
   if(syncParts)Object.assign(part,partPosition(s,part));
   list.push(part);
  }
  if(breach)list.push(s.boss);
 }
 return list;
}
const blocked=(s,x,y,r=0)=>s.blocks.find(b=>b.hp!==0&&x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
function clearCoastOverlap(s,entity,r,fallback){
 const {x,y}=entity;
 if(!blocked(s,x,y,r))return false;
 const faces=s.blocks.filter(b=>b.hp!==0).flatMap(b=>[
  {x:b.x-r-.05,y},{x:b.x+b.w+r+.05,y},{x,y:b.y-r-.05},{x,y:b.y+b.h+r+.05}
 ]);
 const clear=faces.filter(p=>p.x>=FIELD.left+r&&p.x<=FIELD.right-r&&p.y>=FIELD.top+r&&p.y<=FIELD.bottom-r&&!blocked(s,p.x,p.y,r));
 clear.sort((a,b)=>distance(a,entity)-distance(b,entity));
 Object.assign(entity,clear[0]||fallback);
 return true;
}
function move(s,e,dx,dy,r){const x=clamp(e.x+dx,FIELD.left+r,FIELD.right-r),y=clamp(e.y+dy,FIELD.top+r,FIELD.bottom-r);if(!blocked(s,x,e.y,r))e.x=x;if(!blocked(s,e.x,y,r))e.y=y;}
function lineBlocked(s,a,b){const n=Math.ceil(distance(a,b)/20);for(let i=1;i<=n;i++)if(blocked(s,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return true;return false;}
function attackTargets(s,range){return targets(s).filter(e=>e.hp>0&&distance(e,s.player)<range+e.r&&!lineBlocked(s,s.player,e)).sort((a,b)=>distance(a,s.player)-distance(b,s.player));}
const shieldFaces=(shield,p)=>Math.cos(Math.atan2(p.y-shield.y,p.x-shield.x)-shield.aim)>.45;
function coastFlameShield(s,guard){
 if(s.operation?.region!==0||s.stage!=='field'||guard.type!=='rifle'||guard.cohort!=='coast-guard'||!guard.coastWing)return null;
 const p=s.player,dx=guard.x-p.x,dy=guard.y-p.y,reach=dx*dx+dy*dy;
 return s.enemies.find(shield=>{
  if(shield.type!=='shield'||shield.cohort!=='coast-guard'||shield.siteId!==guard.siteId||shield.coastWing!==guard.coastWing
   ||shield.hp<=0||shield.dead||!shieldFaces(shield,p))return false;
  const along=(shield.x-p.x)*dx+(shield.y-p.y)*dy;
  return along>0&&along<reach&&segmentDistance(shield.x,shield.y,p.x,p.y,guard.x,guard.y)<shield.r+5;
 });
}
const rocketTerrainBlocked=(s,origin,dx,dy,length)=>s.blocks.some(b=>b.hp!==0&&rayBoxDistance(origin,dx,dy,b,7)<=length);
export function coastRocketVolley(s,site=s.sites.find(n=>n.coastApproach==='r'),w=s.weapons.find(weapon=>weapon.id==='r')){
 if(s.operation?.region!==0||s.stage!=='field'||site?.coastApproach!=='r'||site.state!=='active'||site.coastPlan==='split'||w?.id!=='r'||isCapturedTurret(w)||w.branch||w.evolved||w.fusion)return null;
 const guns=s.enemies.filter(e=>e.siteId===site.id&&e.type==='mortar'&&!e.dead&&e.hp>0);
 if(guns.length!==2)return null;
 const {player:p}=s,point={x:(guns[0].x+guns[1].x)/2,y:(guns[0].y+guns[1].y)/2};
 const pending=s.shots.find(q=>q.owner===w.uid&&q.coastFuse);
 if(pending)return {...pending.coastFuse,state:'inflight'};
 const gap=distance(p,point),d=weaponStats(w);
 if(guns.some(e=>distance(point,e)>d.radius+e.r||lineBlocked(s,point,e)))return null;
 if(gap<COAST_MORTAR.volleyDistance)return {...point,state:'close'};
 if(gap>=d.range)return {...point,state:'far'};
 const dx=(point.x-p.x)/gap,dy=(point.y-p.y)/gap,origin={x:p.x+dx*22,y:p.y+dy*22};
 const screened=rocketTerrainBlocked(s,origin,dx,dy,gap-22)
  ||s.enemies.some(e=>!e.dead&&e.hp>0&&segmentDistance(e.x,e.y,origin.x,origin.y,point.x,point.y)<=e.r+7);
 return {...point,state:screened?'blocked':'ready'};
}
export function coastRocketCounter(s,site=s.sites.find(n=>n.coastApproach==='r'),w=s.weapons.find(weapon=>weapon.id==='r')){
 if(s.operation?.region!==0||s.stage!=='field'||w?.id!=='r'||isCapturedTurret(w)||site?.coastPlan!=='split'||site.coastApproach!=='r'
  ||site.state!=='active'||site.counterFired)return null;
 const round=s.hazards.find(h=>h.coastMortar===site.id&&h.coastGun&&!h.hit&&h.timer>0);
 if(!round)return null;
 const guns=s.enemies.filter(e=>e.siteId===site.id&&e.type==='mortar'&&!e.dead&&e.hp>0
  &&!s.shots.some(q=>q.rocket&&q.owner===w.uid&&q.target===e.id&&q.life>0));
 if(!guns.length)return null;
 const p=s.player,dx=round.x-round.fromX,dy=round.y-round.fromY;
 if(distance(p,round)<blastContactRadius(round))return {state:'escape'};
 const side=Math.abs(dx*(p.y-round.y)-dy*(p.x-round.x))/Math.hypot(dx,dy);
 if(!(side>=COAST_MORTAR.counterSide))return {state:'sidestep'};
 const distant=guns.filter(gun=>distance(p,gun)>=COAST_MORTAR.volleyDistance);
 if(!distant.length)return {state:'close'};
 const range=weaponStats(w).range;
 const inRange=distant.filter(gun=>distance(p,gun)<range);
 if(!inRange.length)return {state:'far'};
 const line=inRange.filter(gun=>{
  const gap=distance(p,gun),ux=(gun.x-p.x)/gap,uy=(gun.y-p.y)/gap;
  return !rocketTerrainBlocked(s,{x:p.x+ux*22,y:p.y+uy*22},ux,uy,gap-22);
 });
 const target=line.find(gun=>gun.id!==round.coastGun)||line[0];
 return target?{state:'ready',target,site}:{state:'blocked'};
}
export function coastSignalPlan(s){
 const b=s.boss,plan=coastStrike(s);
 if(!plan||s.operation.coastStrike!=='r'||s.operation.coastStrikeUsed||!b.active||b.dead)return null;
 const weapon=s.weapons.find(w=>w.id==='r')||s.weapons.find(w=>w.fusion?.secondary==='r');
 if(!weapon)return {state:'unarmed'};
 if(b.mode!=='windup')return {state:'wait'};
 const lane=coastChargeLane(s),p=s.player;
 if(!lane)return {state:'wait'};
 const danger=segmentDistance(p.x,p.y,lane.x,lane.y,lane.endX,lane.endY)<lane.r;
 if(s.shots.some(q=>q.coastSignal&&q.life>0))return {state:'flying',danger};
 if(danger)return {state:'escape'};
 if(b.coastSignalFired)return {state:'spent'};
 const gap=distance(p,b);
 if(gap<plan.range)return {state:'near'};
 const d=weaponStats(weapon),speed=weapon.fusion?RULES.fusion.payloadSpeed:RULES.weapons.r.projectileSpeed;
 const flight=gap-22-b.r-7;
 if(flight>d.range||flight>speed*b.timer)return {state:'late'};
 const dx=(b.x-p.x)/gap,dy=(b.y-p.y)/gap;
 if(rocketTerrainBlocked(s,{x:p.x+dx*22,y:p.y+dy*22},dx,dy,gap-b.r-22))return {state:'blocked'};
 return {state:'ready',weapon,angle:Math.atan2(dy,dx)};
}
const atCoastRear=(p,b)=>Math.cos(Math.atan2(p.y-b.y,p.x-b.x)-b.body)<COAST_CHARGE.rearDot;
export function coastFlameLine(s){
 const {boss:b,player:p}=s;
 if(!coastStrike(s)||s.operation.coastStrike!=='f'||s.operation.coastStrikeUsed||!b.active||b.dead||b.mode!=='recover')return null;
 if(!atCoastRear(p,b))return 'rear';
 if(!s.weapons.some(w=>w.id==='f'&&distance(p,b)<weaponStats(w).range+b.r))return 'range';
 return lineBlocked(s,p,b)?'blocked':'ready';
}
function fireCoastSignal(s){
 const plan=coastSignalPlan(s);
 if(plan?.state!=='ready')return;
 const {weapon,angle}=plan,b=s.boss,p=s.player;
 const payload=weapon.fusion,incendiary=payload?.branch==='incendiary';
 const options=payload?{source:'payload',radius:RULES.fusion.payloadRadius,homing:!incendiary,incendiary}:{};
 const damage=payload?RULES.fusion.payloadDamage:weaponStats(weapon).damage;
 if(!fire(s,weapon,b,angle,damage,{...options,rocket:true,coastSignal:true}))return;
 b.coastSignalFired=true;
 p.aim=angle;p.attack=.12;
 emit(s,'rocket-shot',p.x+Math.cos(angle)*28,p.y-18+Math.sin(angle)*28,{angle,life:.08});
}
export function portTurretInSight(s){
 if(!portBreachFlank(s))return false;
 const turret=s.boss.parts[0],point=partPosition(s,turret);
 return s.weapons.some(w=>distance(s.player,point)<weaponStats(w).range+turret.r)&&!lineBlocked(s,s.player,point);
}
export function portArmorLine(s){
 if(!portArmorOpportunity(s))return null;
 if(!portArmorFlank(s))return 'flank';
 const armor=s.boss.parts[1],point=partPosition(s,armor);
 if(lineBlocked(s,s.player,point))return 'blocked';
 return s.weapons.some(w=>distance(s.player,point)<weaponStats(w).range+armor.r)?'ready':'range';
}
export function infernoCoreLine(s,w){
 const {player:p,boss:b}=s;
 if(!isFocusedInferno(w)||s.operation?.region!==2||!b.active||b.dead||b.mode!=='recover'||p.moving)return false;
 const gap=distance(p,b),range=weaponStats(w).range;
 if(gap<INFERNO_CORE_DISTANCE||gap>=range+b.r||lineBlocked(s,p,b))return false;
 const turret=b.parts[0];
 if(portBreachFlank(s)){
  const point=partPosition(s,turret);
  if(distance(p,point)<range+turret.r&&!lineBlocked(s,p,point))return false;
 }
 return true;
}
function targetFor(s,w,d,candidates,lance){
 const signal=isConductiveFusion(w)?harborSignalLine(s,w):null;
 if(signal?.state==='ready'&&candidates.includes(s.boss))return s.boss;
 const priority=portBreachFlank(s)?s.boss.parts[0]
  :portArmorOpportunity(s)&&portArmorFlank(s)?s.boss.parts[1]
  :portCoreDisrupted(s)?s.boss:null;
 if(priority&&candidates.includes(priority))return priority;
 if(lance)return s.boss;
 const strike=coastStrike(s);
 if(w.id==='r'&&strike&&s.operation.coastStrike==='r'&&!s.operation.coastStrikeUsed&&s.boss.mode==='windup'
   &&candidates.includes(s.boss)&&distance(s.player,s.boss)>=strike.range)return s.boss;
 const locked=candidates.find(e=>e.id===w.targetId);if(locked&&s.t<(w.targetUntil||0))return locked;
 let selected=candidates[0];
 const part=s.operation?.region!==2&&s.operation?.support==='breach'&&candidates.find(e=>e.type==='part');
 if(part&&selected?.type==='boss')selected=part;
 if(w.id==='f'){
  let best=-1;for(const candidate of candidates.slice(0,24)){const a=Math.atan2(candidate.y-s.player.y,candidate.x-s.player.x);let score=0;
   for(const e of candidates){const b=Math.atan2(e.y-s.player.y,e.x-s.player.x);if(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))<d.cone*Math.PI/360)score+=(1+Math.min(e.hp,d.damage)/d.damage*.1)*(['boss','part','courier'].includes(e.type)?6:moduleRank(s,'catalyst')&&e.burn>0?.3:1);}
   if(score>best){best=score;selected=candidate;}
  }
 }else if(w.id==='r'){
  const mortar=selected&&distance(s.player,selected)>90&&candidates.find(e=>e.type==='mortar'&&(e.cohort==='rail-guard'||e.siteId==='supply-c'&&e.cohort==='coast-guard'||e.coastResponse==='r'));
  selected=mortar||markedBlastTarget(s,candidates,selected,d.radius);
 }
 if(part&&selected?.type==='boss')selected=part;
 w.targetId=selected?.id||null;w.targetUntil=s.t+RULES.player.targetHoldSeconds;return selected;
}
function markedBlastTarget(s,candidates,fallback,radius=100){
 if(!moduleRank(s,'catalyst')||!fallback||distance(fallback,s.player)<75)return fallback;
 const burning=candidates.filter(e=>e.burn>0);if(!burning.length)return fallback;
 return burning.map(e=>({e,score:candidates.filter(o=>distance(e,o)<radius+o.r).length+(['boss','part','courier'].includes(e.type)?3:0)})).sort((a,b)=>b.score-a.score||distance(a.e,s.player)-distance(b.e,s.player))[0].e;
}
function spawnEnemy(s,type,x,y,siteId=null,extra={}){
 if(alive(s).length>=160)return null;const d=RULES.enemies[type],hp=d.hp*(s.operation?[1,1.35,1.8][s.operation.region]:1)*Math.pow(1.05,Math.min(s.pressure,12)),e={id:`e-${++s.id}`,type,x:clamp(x,60,1540),y:clamp(y,60,1140),r:type==='officer'?24:type==='shield'?21:17,hp,maxHp:hp,speed:d.speed*Math.min(1.3,1+s.pressure*.03),timer:1+rng(s,'combat')*2,aim:Math.atan2(s.player.y-clamp(y,60,1140),s.player.x-clamp(x,60,1540)),hurt:0,walk:0,spawnAge:0,siteId,dead:false,death:0,burn:0,...extra};s.enemies.push(e);return e;
}
function spawnAround(s,type='rifle',extra={},radius=null,minGap=0){
 const p=s.player;let point;
 for(let i=0;i<(minGap?64:16);i++){const a=rng(s,'combat')*TAU,r=radius??Math.max(340,Math.min(520,Math.max(s.view.w,s.view.h)*.54));const q={x:clamp(p.x+Math.cos(a)*r,65,1535),y:clamp(p.y+Math.sin(a)*r,65,1135)};if(distance(q,p)>300&&!blocked(s,q.x,q.y,22)&&(!minGap||alive(s).every(e=>distance(q,e)>=minGap))){point=q;break;}}
 if(!point)return null;return spawnEnemy(s,type,point.x,point.y,null,extra);
}
function burn(e,dps=6,life=1.5,depth=0){e.burn=Math.max(e.burn||0,life);e.burnDps=Math.max(e.burnDps||0,dps);e.burnDepth=depth;e.burnTick=e.burnTick??.5;}
function updateBurn(s,e,dt){if(!(e.burn>0)||e.hp<=0)return;e.burn-=dt;e.burnTick=(e.burnTick??.5)-dt;if(e.burnTick<=0){e.burnTick=.5;damage(s,e,e.burnDps*.5,'fire','dot');}if(e.burn<=0)e.burnDps=0;}
function dropXp(s,x,y,value,salvage=false){
 s.stats.xpGenerated=(s.stats.xpGenerated||0)+value;
 s.gems.push({x,y,value,age:0,...(salvage?{salvage}:null)});
 if(s.gems.length>220){const oldest=s.gems.shift();s.gems[0].value+=oldest.value;}
}
function recordSupportUse(s){
 const front=s.operation.region;
 s.stats.supportUses??={};
 s.stats.supportUses[front]=(s.stats.supportUses[front]||0)+1;
}
function recordHarborPayoff(s,key){
 const payoff=s.operation.harborPayoff;
 if(payoff)payoff[key]=(payoff[key]||0)+1;
}
export function harborSignalLine(s,weapon=s.weapons.find(isConductiveFusion)){
 const {boss:b,player:p}=s;
 if(!weapon||!portConductiveSignal(s)||s.operation.tactic!=='signal'||!b.active||b.dead||b.parts.every(part=>part.hp<=0))return null;
 const dx=p.x-b.x,side=portTurretSide(b),index=dx*side>0?0:1,target=b.parts[index];
 const part=index===0?'turret':'armor',point=partPosition(s,target);
 if(b.mode!=='recover')return {state:'wait'};
 if(portCoreDisrupted(s))return null;
 if(b.tacticCycle===b.cycle)return {state:'spent',part:b.portSignal?.part};
 if(Math.abs(dx)<PORT_CONDUCTIVE_SIGNAL.side||target.hp<=0)return {state:'side',side:target.hp>0?0:b.parts[0].hp>0?side:-side};
 const gap=distance(p,b),range=weaponStats(weapon).range+b.r;
 const state=gap<FRONT_TACTICS[2].signal.range?'near':gap>=range?'far':lineBlocked(s,p,b)||lineBlocked(s,b,point)?'blocked':'ready';
 return {state,part,point,target};
}
function activateHarborSignal(s,source,owner){
 if(source!=='native'&&source!=='payload')return;
 const weapon=s.weapons.find(w=>w.uid===owner&&isConductiveFusion(w));
 if(!weapon)return;
 const signal=harborSignalLine(s,weapon);
 if(signal?.state!=='ready')return;
 const b=s.boss,{target,part,point}=signal;
 Object.assign(target,point);
 b.tacticCycle=b.cycle;b.portSignal={cycle:b.cycle,part};
 s.stats.harborSignalHits=(s.stats.harborSignalHits||0)+1;
 recordFrontTactic(s);
 emit(s,'payload-relay',b.x,b.y,{x2:point.x,y2:point.y,life:.38});
 damage(s,target,PORT_CONDUCTIVE_SIGNAL.damage,'electric','front-relay');
 const name=part==='turret'?'포탑':'보조포';
 emit(s,'weakpoint',point.x,point.y,{life:1.2,portRelay:true,text:target.hp<=0?`측면 역송 · ${name} 파괴`:`측면 역송 · 다음 ${name} 차단`});
}
export function harborArcTarget(s){
 const b=s.boss;
 if((!portCoreWindow(s)&&!portCoreDisrupted(s))||b.harborArcCycle===b.cycle||!s.weapons.some(isConductiveFusion))return null;
 const [turret,armor]=b.parts;
 const turretSide=(s.player.x-b.x)*portTurretSide(b)>0;
 const ordered=turretSide?[turret,armor]:[armor,turret];
 return ordered.find(part=>part.hp>0&&!lineBlocked(s,b,partPosition(s,part)))||null;
}
function relayCoreHit(s,owner){
 if(!portCoreDisrupted(s)||!s.weapons.some(w=>w.uid===owner&&isConductiveFusion(w)))return;
 const target=harborArcTarget(s);
 if(!target)return;
 const b=s.boss,turret=target===b.parts[0];
 Object.assign(target,partPosition(s,target));
 b.harborArcCycle=b.cycle;
 b.harborRelayPart=turret?'turret':'armor';
 s.operation.harborPayoff??={};
 recordHarborPayoff(s,turret?'arcTurret':'arcArmor');
 const rounds=s.enemyShots.length;
 if(turret)s.enemyShots=s.enemyShots.filter(q=>{
  if(!q.portFan)return true;
  emit(s,'lightning',q.x-7,q.y-18,{x2:q.x+7,y2:q.y-12,life:.2});
  return false;
 });
 if(s.enemyShots.length<rounds)recordHarborPayoff(s,'arcFanClears');
 emit(s,'lightning',b.x,b.y,{x2:target.x,y2:target.y,life:.35});
 damage(s,target,PORT_SUPPORT.overrun.arcDamage,'electric','front-relay');
 if(target.hp<=0)recordHarborPayoff(s,'arcBreaks');
 const result=target.hp<=0?'파괴':portRelayCuts(s,b.cycle+1,b.harborRelayPart)?'다음 사격 차단':'명중';
 emit(s,'weakpoint',target.x,target.y,{text:`코어 역송 · ${turret?'포탑':'보조포'} ${result}`,portRelay:true,life:1.15});
}
function scoreKill(s,e,source,kind,ignitedPayload){
 const coast=coastAtShore(s);
 if(coast&&s.operator!=='marco'&&coast.progress<COAST_SALVAGE.steps.at(-1)&&
    coastGrowthEnemy(s,e)){
  if(coast.parts.length>=24)coast.parts.shift();
  coast.parts.push({id:e.id,x:e.x,y:e.y});
 }
 const challenge=s.challenge;
 if(e.cohort==='port-battery'&&challenge?.type==='battery'&&challenge.state==='active'&&challenge.targets.includes(e.id))
  challenge.destroyed.push(e.id);
 if(s.operation&&s.stage==='holdout'&&e.cohort==='holdout'){
  s.operation.holdoutKills=(s.operation.holdoutKills||0)+1;
  s.stats.holdoutDefeated=(s.stats.holdoutDefeated||0)+1;
 }
 const wake=source==='wake'||source==='wake-flash';
 if(source==='payload')s.stats.payloadKills=(s.stats.payloadKills||0)+1;
 if(source==='wake')s.stats.wakeKills=(s.stats.wakeKills||0)+1;
 if(source==='wake-flash')s.stats.wakeFlashKills=(s.stats.wakeFlashKills||0)+1;
 if(e.type==='officer'){
  if(s.player.hp>0&&moduleRank(s,'medic')&&!(s.medicCd>0)){
   const heal=Math.min(12,s.player.maxHp-s.player.hp);
   s.player.hp+=heal;s.medicCd=12;s.stats.medicRecovered=(s.stats.medicRecovered||0)+heal;
   if(heal>0)emit(s,'heal',e.x,e.y,{text:`정예 제압 · 체력 +${Math.round(heal*10)/10}`});
  }
  s.stats.elites++;if(s.stats.elites<=8)s.stats.score+=100;
 }else{s.stats.kills++;if(s.stats.kills<=(s.operation?900:300))s.stats.score+=10;}
 if(s.operator!=='marco')s.player.charge=Math.min(100,s.player.charge+1*(1+Math.min(.2,s.level*.01)));
 if(source==='focus')s.stats.focusKills=(s.stats.focusKills||0)+1;
 s.combo++;s.comboTime=2;s.stats.bestCombo=Math.max(s.combo,s.stats.bestCombo);
 const xpType=e.coastResponse?'rifle':e.type;
 const xp=xpType==='rifle'&&s.operation?RULES.campaignDirector.rifleXp[s.operation.region]:RULES.enemies[xpType]?.xp||1;dropXp(s,e.x,e.y,xp);
 const flavor=ignitedPayload||kind==='fire'?'fire':source==='payload'?'arc':null;
 if(flavor)e.deathFlavor=flavor;
 emit(s,'kill',e.x,e.y,{angle:s.player.aim,...(flavor?{flavor}:{}),...(wake?{wake:true}:{})});
 if(wake)s.events.push('wake-kill');
 const rank=moduleRank(s,'catalyst');if(rank&&e.burn>0&&!e.burnDepth&&['native','dot','wake'].includes(source)){const others=alive(s).filter(o=>o!==e&&distance(e,o)<100).sort((a,b)=>distance(e,a)-distance(e,b)).slice(0,rank);for(const other of others){burn(other,RULES.modules.catalyst.burnDamagePerSecond[rank-1],2,1);emit(s,'fire-spread',e.x,e.y,{x2:other.x,y2:other.y,life:.25});}}
}
function recordFrontTactic(s){
 const front=s.operation.region;
 s.stats.frontTactics??={};
 s.stats.frontTactics[front]=(s.stats.frontTactics[front]||0)+1;
}
function activateFrontTactic(s,e,kind,source,owner){
 const b=s.boss,tactic=frontTactic(s),p=s.player;
 if(!tactic||source==='front-relay'||!['heat','signal'].includes(s.operation.tactic))return;
 const gap=distance(p,b),index=s.operation.region,cycle=b.cycle;
 if(index===2&&s.operation.tactic==='signal'&&portConductiveSignal(s))return;
 if(index===1&&s.operation.tactic==='signal'&&b.mode==='aim')return;
 if(b.tacticCycle===cycle)return;
 if(s.operation.tactic==='heat'){
  if(kind!=='fire'||!['native','wake'].includes(source)||gap>tactic.range||tactic.side&&Math.abs(p.x-b.x)<tactic.side)return;
  b.tacticCycle=cycle;
  emit(s,'overheat',e.x,e.y,{life:.4,text:'냉각 차단 · 장갑 과열'});
 }else{
  const linked=source==='native'&&s.weapons.some(w=>w.uid===owner&&(w.fusion||w.id==='r'&&kind==='blast'));
  if(gap<tactic.range||!(kind==='electric'||source==='payload'||linked))return;
  const connected=part=>part&&part!==e&&part.hp>0&&!lineBlocked(s,e,part);
  const lanes=index===1&&b.mode==='salvo'?s.hazards.filter(h=>h.lane&&!h.hit):[];
  if(lanes.some(h=>railLaneContains(h,p)))return;
  const gunners=lanes.sort((a,b)=>Number(!!b.tracked)-Number(!!a.tracked)).map(h=>b.parts[railGunOf(h)]);
  const target=[...gunners,...b.parts,b].find(connected);
  if(!target)return;
  b.tacticCycle=cycle;
  if(index===1&&b.mode==='recover')b.timer+=tactic.delay;
  if(index===2)b.spawnClock=Math.max(b.spawnClock,tactic.delay);
  s.effects.push({type:'lightning',x:e.x,y:e.y,x2:target.x,y2:target.y,age:0,life:.35});
  if(!(index===1&&stopRailGun(s,target,true)))emit(s,'weakpoint',target.x,target.y,{life:1,text:index===1?'포대 역송 · 재장전 지연':'포탑 역송 · 증원 호출 지연'});
  damage(s,target,tactic.hop,'electric','front-relay');
 }
 recordFrontTactic(s);
}
function coastStrikeDamage(s,target,kind,source,owner,coastSignal){
 const b=s.boss;
 if(target!==b||!b.active||b.dead)return 0;
 const plan=coastStrike(s);
 if(!plan||s.operation.coastStrikeUsed)return 0;
 if(s.operation.coastStrike==='f'){
  if(b.mode!=='recover'||!atCoastRear(s.player,b)||kind!=='fire'||source!=='native')return 0;
  b.timer+=plan.delay;
  emit(s,'break',b.x,b.y,{text:'연료관 점화 · 엔진 노출 +2초',life:1.3,coastTactic:true});
 }else{
  if(b.mode!=='windup'||kind!=='blast'||!coastSignal&&distance(s.player,b)<plan.range)return 0;
  const weapon=s.weapons.find(w=>w.uid===owner);
  if(!(source==='native'&&weapon?.id==='r'||source==='payload'&&weapon?.fusion?.secondary==='r'))return 0;
  b.mode='recover';b.timer=COAST_CHARGE.recover;
  delete b.chargePath;
  emit(s,'barrage-cancel',target.x,target.y,{text:`${coastSignal?'신호탄':'로켓'} 명중 · 돌진 차단`,life:1.3,coastTactic:true,coastSignal:!!coastSignal});
 }
 s.operation.coastStrikeUsed=true;
 return plan.damage;
}
function coastWeakHit(s,e,source){
 const coast=coastAtShore(s);
 if(!coast||s.operator!=='marco'||!['native','focus'].includes(source))return false;
 if(e===s.boss){
  if(!focusWeakPoint(s,e))return false;
  if(coast.weakCycle!==s.boss.cycle){
   coast.weakCycle=s.boss.cycle;
   advanceCoastRole(s,e,8);
  }
 }else{
  if(e.type!=='shield'||shieldFaces(e,s.player))return false;
  if(coastGrowthEnemy(s,e)){e.coastScanned=true;advanceCoastRole(s,e,6);}
 }
 return true;
}
function advanceCoastRole(s,point,xp){
 const coast=coastSalvage(s);
 if(coast.progress>=COAST_SALVAGE.steps.at(-1))return;
 coast.progress++;
 gainXp(s,xp);
 const rank=coastRoleRank(coast);
 if(s.operator==='marco')s.player.charge=Math.min(100,s.player.charge+12);
 const milestone=COAST_SALVAGE.steps.includes(coast.progress);
 const marco=s.operator==='marco',bonus=Math.round(coastRoleBonus(s.operator,rank)*100);
 emit(s,milestone?'complete':'weakpoint',point.x,point.y,{life:1.25,
  text:milestone?`${coastRole(s).name} ${rank}단계 · ${marco?`관통 피해 +${bonus}%`:`발사 간격 −${bonus}%`}`:`${marco?'약점 확인':'부품 회수'} · XP +${xp}`});
}
function damage(s,e,amount,kind='bullet',source='native',owner=null,weight=0,breachLane,coastSignal,ignitedPayload,armorCycle){
 if(e.hp<=0||e.dead)return;
 if(coastWeakHit(s,e,source))amount*=1.5;
 const catalyst=moduleRank(s,'catalyst');if(kind==='blast'&&e.burn>0&&catalyst)amount*=1+RULES.modules.catalyst.blastBonusOnBurn[catalyst-1];
 amount*=1+s.boosts.power*.01;
 const breach=s.operation?.support==='breach';
 if(e===s.boss.parts[0]&&s.operation?.region===2){
  if((source==='native'||source==='payload'||source==='focus')&&(breachLane??(portBreachFlank(s)&&!lineBlocked(s,s.player,e)))){
   amount*=PORT_SUPPORT.breach.boost;recordSupportUse(s);
   const lethal=e.hp<=amount;
   if(s.boss.mode==='salvo'&&s.boss.turretSuppressedCycle!==s.boss.cycle&&!portSignalCuts(s,s.boss.cycle,'turret')){
    const cancelled=clearPortRounds(s,'turret');
    if(!lethal)s.boss.turretSuppressedCycle=s.boss.cycle;
    if(cancelled)recordHarborPayoff(s,'salvos');
    if(cancelled||!lethal)emit(s,'barrage-cancel',e.x,e.y,{life:1.2,text:cancelled?'철갑 명중 · 포탑탄 차단':'철갑 명중 · 후속 탄막 차단'});
   }
   if(lethal){
    recordHarborPayoff(s,'turrets');
    emit(s,'weakpoint',e.x,e.y,{life:1.2,text:'철갑 급탄 · 포탑 파괴'});
   }
  }else if(portTurretShutter(s))amount*=PORT_TURRET.shutterDamage;
 }else if(e===s.boss.parts[1]&&s.operation?.region===2&&(source==='native'||source==='focus')){
  const b=s.boss,cycle=portArmorOpportunity(s);
  const instant=kind==='fire'||source==='focus';
  if(cycle&&(armorCycle===cycle||instant&&portArmorFlank(s)&&!lineBlocked(s,s.player,partPosition(s,e)))){
   recordSupportUse(s);
   if(b.mode==='aim'){
    b.armorSuppressedCycle=cycle;
    recordHarborPayoff(s,'armorPreps');
    emit(s,'barrage-cancel',e.x,e.y,{life:1.2,text:'철갑 명중 · 보조포 급탄 차단'});
   }else{
    const round=portArmorRound(s);
    const interrupted=s.hazards.filter(h=>h.portRound===round&&!h.hit).map(({x,y})=>({x,y}));
    clearPortRounds(s,round);
    recordHarborPayoff(s,'armorSalvos');
    emit(s,'barrage-cancel',e.x,e.y,{life:1.2,text:`철갑 명중 · ${round==='rake'?'가로':'세로'} 보조 포격 차단`,interrupted});
   }
  }
 }else if(e.type==='part'&&breach&&s.operation.region!==2){
  const coastSupport=carriesCoastSalvage(s);
  if(!coastSupport||source==='native'||source==='focus'){
   amount*=coastSupport?1.3:1.55;
   recordSupportUse(s);
  }
 }
 if(e.type==='boss'){
  const b=s.boss,a=Math.atan2(s.player.y-b.y,s.player.x-b.x),rear=Math.cos(a-b.body)<COAST_CHARGE.rearDot;
  const recover=b.mode==='recover',armored=b.parts.some(p=>p.hp>0);
  if(s.operation?.region===2){
   if(!recover)amount*=armored?.65:1.15;
   else if(source!=='support'&&(!armored||portCoreDisrupted(s)))amount*=1.6;
  }else if(s.operation?.region===1)amount*=armored?.5:recover?1.5:1;
  else amount*=recover&&rear?1.5:coastAtShore(s)?.plan==='capture'&&coastHullFront(s)?.46:Math.cos(a-b.body)>.35?.65:1;
 }
 const railSignal=s.operation?.region===1&&s.operation.tactic==='signal';
 if(s.boss.active&&(s.boss.mode==='recover'||railSignal)&&(e.type==='boss'||e.type==='part')){
  activateFrontTactic(s,e,kind,source,owner);
  if(e.dead)return;
  if(s.operation?.tactic==='heat'&&s.boss.tacticCycle===s.boss.cycle)amount*=frontTactic(s).boost;
 }
 if(e.type==='shield'&&kind==='bullet'&&shieldFaces(e,s.player))amount*=breach?.65:.45;
 amount+=coastStrikeDamage(s,e,kind,source,owner,coastSignal);
 const actual=e.part||e,before=actual.hp;actual.hp=Math.max(0,actual.hp-amount);e.hp=actual.hp;e.hurt=.10;actual.hurt=.1;
 if(e===s.boss&&e.hp>0&&(source==='native'||source==='payload')){
  activateHarborSignal(s,source,owner);
  relayCoreHit(s,owner);
 }
 if(s.operator==='marco'&&source==='native'&&actual.hp<before&&s.player.focusChargeAt<=s.t&&s.player.charge<100&&distance(s.player,e)<=RULES.marco.chargeReach+e.r&&!lineBlocked(s,s.player,e)){
  const p=s.player,gain=Math.min(100-p.charge,RULES.marco.directCharge);
  p.charge+=gain;p.focusChargeAt=s.t+RULES.marco.chargeInterval;s.stats.focusGained=(s.stats.focusGained||0)+gain;
 }
 if(e.cohort!=='port-battery'&&['rifle','shield','mortar','officer'].includes(e.type)){const dx=e.x-s.player.x,dy=e.y-s.player.y,d=Math.hypot(dx,dy)||1,push=(kind==='blast'?RULES.combatFeel.blastPush:RULES.combatFeel.bulletPush)*(e.type==='shield'?RULES.combatFeel.shieldPushMultiplier:1);move(s,e,dx/d*push,dy/d*push,e.r);}
 if(source==='module')s.stats.moduleDamage+=amount;
 if(kind==='electric'&&e.burn>0&&moduleRank(s,'thermal')&&moduleRank(s,'coil')&&!(s.thermalCd>0)){
  const gain=Math.min(2,100-s.player.charge);
  s.thermalCd=.25;s.player.charge+=gain;s.stats.thermalRecovered=(s.stats.thermalRecovered||0)+gain;
 }
 if(source==='native'){
  if(weight>0)feed(s,owner,weight,e,breachLane);
  if(kind==='blast'&&e.burn>0&&catalyst&&s.heatCd<=0){
   const chained=heatSynergyReady(s),config=RULES.modules.catalyst;
   s.heatCd=config.heatBurstCooldown;s.stats.heatBursts++;
   blast(s,e.x,e.y,chained?110:config.heatBurstRadius,chained?52:config.heatBurstDamage[catalyst-1],'module',null,false,'heat');
  }
 }
 if(e.dead||e.hp>0)return;
 if(e.type==='part'){
  if(s.operation?.region===1){
   stopRailGun(s,actual);
   if(carriesCoastSalvage(s))s.stats.railGunsDestroyed=(s.stats.railGunsDestroyed||0)+1;
  }
  if(s.operation?.region===2){
   const turret=actual===s.boss.parts[0];
   const cancelled=turret?clearPortRounds(s,'turret'):clearPortRounds(s,'rake','battery');
   if(cancelled)emit(s,'barrage-cancel',e.x,e.y,{life:1.1,text:turret?'포탑 파괴 · 포탑탄 차단':'측면 장갑 파괴 · 보조 포격 차단'});
  }
  emit(s,'break',e.x,e.y,{life:.7});return;
 }
 if(e.type==='boss'){s.boss.dead=true;delete s.boss.chargePath;s.stats.bossKilled=true;if(s.operation){s.operation.cleared=s.operation.region+1;if(s.weapons.some(w=>w.fusion))s.stats.fusionBosses++;if(s.weapons.some(w=>w.id==='f'&&w.evolved))s.stats.flameBosses++;}s.stats.score+=1000;emit(s,'boss-down',e.x,e.y,{r:e.r,life:1.2});return;}
 if(e===signalCourier(s)){e.dead=true;dropXp(s,e.x,e.y,24,true);emit(s,'break',e.x,e.y);return;}
 if(e.type==='courier'){
  e.dead=true;s.raid.state='success';s.stats.raidSuccess++;s.stats.score+=300;gainXp(s,12);emit(s,'break',e.x,e.y);
  const ordered=s.operation?.region===0&&s.operation.order==='convoy'&&s.raid.contract==='light'&&s.raid.wager.siteId==='arsenal';
  if(ordered)s.operation.orderDone=true;
  emit(s,'raid-success',e.x,e.y,{quality:s.raid.quality,text:ordered?'보급선 절단 · 귀환 시 지령 보상':`${QUALITY[s.raid.quality]} 보급 탈취`,life:1.4});return;
 }
 e.dead=true;e.death=.3;scoreKill(s,e,source,kind,ignitedPayload);
}
function feed(s,owner,weight,target,breachLane){
 if(moduleRank(s,'coil')){s.coil+=weight;const r=moduleRank(s,'coil'),d=RULES.modules.coil;if(s.coil>=d.threshold[r-1]&&s.coilCd<=0){s.coil-=d.threshold[r-1];s.coilCd=d.cooldown;s.stats.coilBursts++;const near=targets(s).filter(e=>e.hp>0&&distance(e,target)<150).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,d.targets[r-1]);for(const e of near){s.effects.push({type:'lightning',x:target.x,y:target.y,x2:e.x,y2:e.y,age:0,life:.18});damage(s,e,d.damage[r-1],'electric','module');}}}
 const w=s.weapons.find(w=>w.uid===owner);if(w?.fusion){const cfg=RULES.fusion;w.payload=Math.min(cfg.hitsPerPayload,w.payload+weight);if(w.payload>=cfg.hitsPerPayload&&w.payloadCd<=0){w.payload-=cfg.hitsPerPayload;w.payloadCd=cfg.payloadCooldown;
  const cut=isConductiveFusion(w)&&conduitCutTarget(s,target);
  if(cut&&launchPayload(s,w,target,cut,cfg.payloadDamage,true,breachLane,cut.waveGroup,true)){
   s.stats.payloadBursts=(s.stats.payloadBursts||0)+1;
   s.stats.payloadRelays=(s.stats.payloadRelays||0)+1;
   emit(s,'payload-relay',target.x,target.y,{x2:cut.x,y2:cut.y,life:.32,conduitCut:true});
   return;
  }
  const near=payloadTargets(s,target,42);
  const opposite=target.waveGroup==null?null:near.find(e=>e.waveGroup!=null&&(e.waveGroup^1)===target.waveGroup);
  const next=opposite||near.find(e=>distance(e,target)>=100)||near[0];
  s.stats.payloadBursts=(s.stats.payloadBursts||0)+1;
  if(next&&launchPayload(s,w,target,next,cfg.payloadDamage,false,breachLane))emit(s,'payload',target.x,target.y,{life:.25});
  else blast(s,target.x,target.y,cfg.payloadRadius,cfg.payloadDamage,'payload',w.uid,w.fusion.branch==='incendiary',undefined,breachLane);
 }}
}
function payloadTargets(s,origin,min){return targets(s).filter(e=>e.hp>0&&distance(e,origin)>=min&&distance(e,origin)<300&&!lineBlocked(s,origin,e)).sort((a,b)=>distance(a,origin)-distance(b,origin));}
export function conduitMortarCue(s){
 const round=s.hazards.find(h=>h.conduitGun&&!h.hit&&h.timer>0);
 if(!round)return null;
 const gun=s.enemies.find(e=>e.id===round.conduitGun&&!e.dead&&e.hp>0);
 const safe=distance(s.player,round)>=blastContactRadius(round);
 return {round,gun,safe,clear:safe&&!!gun&&!lineBlocked(s,s.player,gun)};
}
function conduitCutTarget(s,origin){
 const cue=conduitMortarCue(s),gun=cue?.gun;
 if(!cue?.clear||gun===origin||lineBlocked(s,origin,gun))return null;
 const gap=distance(origin,gun),time=(gap-gun.r-7)/RULES.fusion.payloadSpeed;
 if(gap>=CONDUIT_MORTAR.relayReach||time>=cue.round.timer)return null;
 return s.shots.some(q=>q.conduitGun===gun.id&&q.life>0)?null:gun;
}
function launchPayload(s,w,origin,target,amount,relay,breachLane,relayGroup,cut=false){
 const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
 const incendiary=!relay&&w.fusion.branch==='incendiary';
 return fire(s,w,target,angle,amount,{rocket:true,radius:RULES.fusion.payloadRadius,source:'payload',homing:!incendiary,incendiary,origin,ignore:origin.id,avoidGroup:origin.waveGroup!==target.waveGroup?origin.waveGroup:null,relay,breachLane,relayGroup,conduitGun:cut?target.id:undefined});
}
function blast(s,x,y,r,amount,source='native',owner=null,ignite=false,effect=source==='payload'?'payload-impact':'explosion',breachLane,coastSignal,armorCycle,railFan){
 const charge=ignite&&effect==='payload-impact';
 const reach=charge?r*EMBER_CHARGE.impactScale:r;
 const burst=emit(s,effect,x,y,{r:reach,life:.4,...(charge?{incendiary:true}:{})}),center={x,y};
 let budget=2,contactGap=Infinity;
 for(const e of (source==='support'?alive(s):targets(s,breachLane,true,armorCycle))){
  if(e.hp<=0)continue;
  const gap=distance(e,center);
  if(gap>reach+e.r||(effect==='ember-burst'?!groundLineClear(s,center,e):lineBlocked(s,center,e)))continue;
  const w=source==='native'?Math.min(.5,budget):0,before=e.hp;
  const workshopHit=railFan&&!s.stats.railFanSweep&&isRailWorkshopGuard(e)&&e.railWing!==undefined?{x:e.x,y:e.y,wing:e.railWing}:null;
  budget-=w;damage(s,e,amount,'blast',source,owner,w,breachLane,coastSignal,source==='payload'&&ignite,armorCycle);
  if(effect==='payload-impact'&&e.hp<before&&gap<contactGap){
   burst.contact={x:e.x,y:e.y};contactGap=gap;
  }
  if(effect==='shrapnel'&&e.hp<before){
   s.stats.shrapnelHits=(s.stats.shrapnelHits||0)+1;
   if(e.dead&&Object.hasOwn(RULES.enemies,e.type))s.stats.shrapnelKills=(s.stats.shrapnelKills||0)+1;
  }
  if(effect==='captured-impact'&&e.hp<before){
   if(workshopHit)recordRailFanHit(s,railFan,workshopHit);
   s.stats.turretHits=(s.stats.turretHits||0)+1;
   if(e.dead&&Object.hasOwn(RULES.enemies,e.type)){
    s.stats.turretKills=(s.stats.turretKills||0)+1;
    if(carriesCoastSalvage(s)&&s.operation.region===1)s.stats.railTurretKills=(s.stats.railTurretKills||0)+1;
   }
  }
  if(ignite&&e.hp>0)burn(e);
 }
 for(const b of s.blocks)if(b.hp>0&&Math.hypot(b.x+b.w/2-x,b.y+b.h/2-y)<reach+Math.max(b.w,b.h)/2)b.hp=Math.max(0,b.hp-amount);
 if((source==='native'||source==='payload')&&moduleRank(s,'shrapnel')&&!(s.shrapnelCd>0)){s.shrapnelCd=.65;s.stats.shrapnelBursts=(s.stats.shrapnelBursts||0)+1;for(let i=0;i<3;i++){const a=i*TAU/3;blast(s,x+Math.cos(a)*50,y+Math.sin(a)*50,42,20,'module',null,false,'shrapnel');}}
 if(charge){
  if(blocked(s,x,y,6))return burst;
  const charges=s.zones.filter(z=>z.source==='ember-charge'&&z.owner===owner);
  if(charges.length>=3)s.zones.splice(s.zones.indexOf(charges[0]),1);
  if(s.zones.length<RULES.limits.zones)s.zones.push({x,y,r,life:EMBER_CHARGE.life,tick:EMBER_CHARGE.arm,source:'ember-charge',owner,breachLane});
 }else if(ignite&&effect!=='ember-burst'&&s.zones.length<RULES.limits.zones)s.zones.push({x,y,r:r*.65,dps:12,life:2,tick:.3,source:'dot'});
 return burst;
}
function updateZones(s,dt,dashOrigin){
 igniteWakeLinks(s,dt);
 for(const z of s.zones){
  z.life-=dt;z.tick-=dt;
  if(z.source==='ember-charge'){
   if(z.life<=0||z.tick>0)continue;
   const {automatic,railTarget,canRoll,rollInReach,suppress,pending,cycle}=emberChargeCue(s,z);
   const roll=canRoll&&dashOrigin&&!s.player.emberDashSpent&&
    (rollInReach||emberPilotInReach(s,z,dashOrigin));
   if(!automatic&&!roll)continue;
   z.life=0;
   if(roll){
    s.player.emberDashSpent=true;s.stats.emberDashBursts=(s.stats.emberDashBursts||0)+1;
    if(railTarget)s.stats.emberRailBursts=(s.stats.emberRailBursts||0)+1;
    emit(s,'ember-dash',z.x,z.y,{x2:s.player.x,y2:s.player.y,rail:railTarget,life:.32});
   }
   if(suppress){
    s.boss.emberCycle=cycle;
    if(pending){clearPortRounds(s,'turret');recordPortEmberIntercept(s,z);}
    else emit(s,'weakpoint',z.x,z.y,{text:'급탄선 단선 · 다음 포탑탄 차단',life:1.2});
   }
   s.stats.emberBursts=(s.stats.emberBursts||0)+1;
   const kills=s.stats.payloadKills||0;
   blast(s,z.x,z.y,z.r,EMBER_CHARGE.damage,'payload',z.owner,true,'ember-burst',z.breachLane);
   s.stats.emberKills=(s.stats.emberKills||0)+(s.stats.payloadKills||0)-kills;
  }else if(z.tick<=0){
   z.tick=.25;
   const wake=z.source==='wake';
   if(wake&&z.life<=0)continue;
   if(wake)heatHarborCooling(s,z);
   for(const e of targets(s))if(e.hp>0&&(wake?wakeTouches(s,z,e):distance(z,e)<z.r+e.r&&!lineBlocked(s,z,e))){
    burn(e);damage(s,e,z.dps*.25,'fire',wake?'wake':'dot');
   }
  }
 }
 s.zones=s.zones.filter(z=>z.life>0);
}
function groundLineClear(s,from,to){
 const gap=distance(from,to);
 if(gap===0)return true;
 const dx=(to.x-from.x)/gap,dy=(to.y-from.y)/gap;
 return !s.blocks.some(b=>b.hp!==0&&rayBoxDistance(from,dx,dy,b)<gap);
}
const wakeTouches=(s,z,e)=>distance(z,e)<z.r+e.r&&groundLineClear(s,z,e);
export function infernoWakeLinks(s){
 const owner=s.weapons.find(isTrailInferno)?.uid;
 if(!owner)return [];
 const wakes=s.zones.filter(z=>z.source==='wake'&&z.owner===owner&&z.life>0);
 const links=[];
 for(let i=1;i<wakes.length;i++){
  const a=wakes[i-1],b=wakes[i];
  if(!a.flashed&&!b.flashed&&distance(a,b)<a.r+b.r&&groundLineClear(s,a,b))links.push([a,b]);
 }
 return links;
}
function igniteWakeLinks(s,dt){
 for(const [a,b] of infernoWakeLinks(s)){
  if(a.flashed||b.flashed||Math.min(a.life,b.life)<=dt||Math.min(a.tick,b.tick)>dt)continue;
  const first=[],second=[];
  for(const e of s.enemies){
   if(e.dead||e.hp<=0)continue;
   const nearA=wakeTouches(s,a,e),nearB=wakeTouches(s,b,e);
   if(nearA&&(!nearB||distance(e,a)<=distance(e,b)))first.push(e);
   else if(nearB)second.push(e);
  }
  if(!first.length||!second.length)continue;
  a.flashed=b.flashed=true;
  s.stats.wakeFlashes=(s.stats.wakeFlashes||0)+1;
  emit(s,'wake-flash',a.x,a.y,{x2:b.x,y2:b.y,r:a.r,life:.42});
  for(const e of [...first,...second]){
   burn(e);
   damage(s,e,INFERNO_WAKE.flashDamage,'fire','wake-flash');
  }
 }
}
function heatHarborCooling(s,z){
 const b=s.boss,mode=portWakeMode(s);
 if(!mode)return;
 const pipe=portWakePoint(b);
 if(!wakeTouches(s,z,pipe)||!s.weapons.some(w=>w.uid===z.owner&&isTrailInferno(w)))return;
 const armor=b.parts[1],armored=armor.hp>0,target=armored?Object.assign(armor,partPosition(s,armor)):b;
 const opened=mode==='overrun';
 if(opened){
  b.harborWakeCycle=b.cycle;
  s.operation.harborPayoff??={};
  recordHarborPayoff(s,armored?'wakeHits':'wakeHull');
 }else{
  b.tacticCycle=b.cycle;recordFrontTactic(s);
 }
 damage(s,target,opened?PORT_SUPPORT.overrun.wakeDamage:FRONT_TACTICS[2].wake.damage,'fire','support');
 const broken=armored&&armor.hp<=0;
 if(opened&&broken)recordHarborPayoff(s,'wakeBreaks');
 const hit=broken?'측면 장갑 파괴':armored?'측면 장갑 손상':'차체 직격';
 emit(s,'overheat',pipe.x,pipe.y,{life:1.15,text:`냉각 배관 점화 · ${hit}`,portWake:true});
}
function leaveInfernoWake(s,weapon,x,y){
 const from={x,y},plan=INFERNO_WAKE;
 if(distance(from,s.player)<.5)return;
 const wakes=s.zones.filter(z=>z.source==='wake'&&z.owner===weapon.uid&&z.life>0);
 if(wakes.some(z=>distance(from,z)<plan.spacing))return;
 if(wakes.length>=plan.limit)s.zones.splice(s.zones.indexOf(wakes[0]),1);
 if(s.zones.length<RULES.limits.zones)s.zones.push({...from,r:plan.radius,dps:plan.dps,life:plan.life,tick:.25,source:'wake',owner:weapon.uid});
}
const emberContact=(s,z,target)=>distance(z,target)<=z.r+target.r&&groundLineClear(s,z,target);
const emberPilotInReach=(s,z,p)=>distance(z,p)<z.r&&groundLineClear(s,z,p);
export function emberChargeCue(s,z){
 if(z.source!=='ember-charge'||z.tick>0||z.life<=0)return {armed:false,hostiles:0,railTarget:false,rollInReach:false};
 let hostiles=0;
 for(const e of s.enemies)if(!e.dead&&e.hp>0&&emberContact(s,z,e)&&++hostiles===2)break;
 const b=s.boss;
 const railTarget=s.operation?.region===1&&b.active&&!b.dead&&b.mode==='recover'&&(
  railDisarmed(b)?emberContact(s,z,b):b.parts.some(part=>part.hp>0&&emberContact(s,z,{...partPosition(s,part),r:part.r})));
 const turret=b.parts[0];
 const eligible=s.operation?.tactic==='ember'&&b.active&&!b.dead&&turret?.hp>0&&emberContact(s,z,{...partPosition(s,turret),r:turret.r});
 const pending=eligible&&s.hazards.some(h=>h.portRound==='turret'&&!h.hit),cycle=pending?b.cycle:b.cycle+1;
 const suppress=eligible&&b.emberCycle!==cycle,automatic=hostiles>=(suppress?1:2);
 const canRoll=!automatic&&(hostiles>0||railTarget);
 return {armed:true,hostiles,railTarget,suppress,pending,cycle,automatic,canRoll,rollInReach:canRoll&&emberPilotInReach(s,z,s.player)};
}
function recordPortEmberIntercept(s,point){
 s.boss.tacticCycle=s.boss.cycle;recordFrontTactic(s);
 s.stats.emberIntercepts=(s.stats.emberIntercepts||0)+1;
 emit(s,'barrage-cancel',point.x,point.y,{text:'급탄선 단선 · 포탑탄 차단',life:1.2});
}
function fire(s,w,target,a,amount,opts={}){
 if(s.shots.length>=320)return false;const d=weaponStats(w),rocket=opts.rocket??w.id==='r',origin=opts.origin,source=opts.source||'native',evolved=w.evolved&&!w.fusion;
 const speed=rocket?source==='payload'?RULES.fusion.payloadSpeed:opts.capturedFan?d.speed:300:700;
 const breachLane=s.operation?.region===2&&s.operation.support==='breach'?(opts.breachLane??(
  portBreachFlank(s)&&!lineBlocked(s,s.player,partPosition(s,s.boss.parts[0]))
 )):undefined;
 const armorCycle=source==='native'&&target===s.boss.parts[1]&&portArmorFlank(s)
  &&!lineBlocked(s,s.player,partPosition(s,target))?portArmorOpportunity(s):undefined;
 const wavePulse=opts.conduitGun?target.wavePulse:origin?.wavePulse;
 const payload=source==='payload'?{
  speed,arming:.12,relay:opts.relay,avoidGroup:opts.avoidGroup??null,
  ...(Number.isSafeInteger(wavePulse)?{wavePulse}:{}),
  ...(opts.relayGroup!==undefined?{relayGroup:opts.relayGroup}:{}),
  ...(opts.conduitGun?{conduitGun:opts.conduitGun}:{})
 }:null;
 const range=opts.conduitGun?Math.max(d.range,distance(origin,target)+48):d.range;
 s.shots.push({
  x:origin?origin.x:s.player.x+Math.cos(a)*22,y:origin?origin.y:s.player.y+Math.sin(a)*22,
  vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:range/speed,damage:amount,r:rocket?7:3,rocket,radius:opts.radius??d.radius,
  source,owner:w.uid,target:target?.id,homing:opts.homing??w.branch==='homing',incendiary:opts.incendiary??w.branch==='incendiary',
  bounces:Math.min(4,(w.branch==='ricochet'?1:0)+moduleRank(s,'ricochet')),hitIds:opts.ignore?[opts.ignore]:[],
  ...(opts.coastFuse?{coastFuse:opts.coastFuse}:{}),...(opts.coastCounter?{coastCounter:true}:{}),
  ...(opts.coastSignal?{coastSignal:true}:{}),...(breachLane!==undefined?{breachLane}:{}),...(armorCycle!==undefined?{armorCycle}:{}),
  ...(opts.capturedFan?{capturedFan:true,speed,...(opts.crossfire?{crossfire:opts.crossfire}:{})}:{}),
  ...(opts.railFan?{railFan:opts.railFan}:{}),
  ...(opts.railFanCut?{railFanCut:opts.railFanCut}:{}),
  ...(payload||(evolved&&!rocket?{pierce:1}:evolved&&w.id==='r'?{salvo:true}:{}))
 });
 return true;
}
export function activeManeuver(p){
 if(p.maneuver==='assault'&&p.moving&&p.assaultTime>0)return 'assault';
 if(p.maneuver==='brace'&&!p.moving&&p.stillTime>=.45)return 'brace';
 return null;
}
function salvoTargets(ordered,radius,count){
 const spread=[ordered[0]],radiusSquared=radius*radius;
 const covered=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2<radiusSquared;
 let remaining=ordered;
 while(spread.length<count){
  const last=spread.at(-1);
  remaining=remaining.filter(e=>!covered(e,last));
  if(!remaining.length)break;
  let best=remaining[0],most=0;
  for(const center of remaining){
   let hits=0;
   for(const e of remaining)if(covered(e,center))hits++;
   if(hits>most){best=center;most=hits;}
  }
  spread.push(best);
 }
 return [...spread,...ordered.filter(e=>!spread.includes(e))];
}
// Aim the two outside lanes past the hull, into the outer edges of the gun mounts.
export function railFanCutCue(s){
 const {boss:b,player:p}=s;
 const weapon=s.operation?.region===1&&s.weapons.find(isCapturedTurret);
 if(s.operation?.region!==1||!carriesCoastSalvage(s)||s.stage!=='boss'||!b.active||b.dead||s.stats.railFanCut
  ||b.parts.some(part=>part.hp<=0)||!weapon)return null;
 const x=b.x,y=b.y+244,angle=Math.atan2(b.y-p.y,b.x-p.x);
 const guns=b.parts.map(part=>partPosition(s,part));
 const edges=guns.map(gun=>({...gun,x:gun.x+Math.sign(gun.x-x)*32}));
 const inPosition=Math.abs(p.x-x)<=18&&Math.abs(p.y-y)<=8;
 const clear=inPosition&&edges.every(edge=>!lineBlocked(s,p,edge));
 const lanes=s.hazards.filter(h=>h.lane&&!h.hit&&h.timer>0);
 const flight=s.shots.some(q=>q.railFanCut?.cycle===b.cycle);
 const time=Math.min(...lanes.map(h=>h.timer));
 const travel=Math.max(...guns.map(gun=>distance(p,gun)))/CAPTURED_TURRET.speed+.035;
 const state=flight?'flying':b.mode==='recover'?'recover':!clear?'approach':b.mode==='aim'?'hold':
  lanes.length===2&&time>=travel+Math.max(0,weapon.cd)?'ready':'evade';
 return {x,y,angle,guns,edges,state};
}
function fireCapturedFan(s,w,target,angle,stats,damage,crossfire,railCut){
 const volley=(s.stats.turretVolleys||0)+1;
 const trackRail=s.operation?.region===1&&carriesCoastSalvage(s)&&!s.stats.railFanSweep&&s.sites.some(site=>site.id==='rail-cache'&&['waiting','active'].includes(site.state));
 for(let i=0;i<stats.count;i++){
  const offset=coastFanAngle(i,stats.count);
  const marking=crossfire&&offset!==0?{volley,cycle:s.boss.cycle}:null;
  const side=i-(stats.count-1)/2;
  const railFanCut=railCut&&Math.abs(side)===2?{volley,cycle:s.boss.cycle,gun:side<0?0:1}:null;
  const edge=railFanCut&&railCut.edges[railFanCut.gun];
  const aim=edge?Math.atan2(edge.y-s.player.y,edge.x-s.player.x):angle+offset;
  fire(s,w,offset===0?target:null,aim,damage,{capturedFan:true,homing:!crossfire&&offset===0&&w.branch==='homing',crossfire:marking,
   railFan:trackRail?{volley,ray:i}:null,railFanCut});
 }
 s.stats.turretVolleys=volley;
 if(volley===1)s.stats.turretFirstAt=s.t;
 const p=s.player;
 emit(s,'captured-volley',p.x,p.y,{angle,count:stats.count,life:.17});
}
function capturedFanAim(p,targets,heading,stats){
 const nearby=targets.slice(0,18).map(e=>({
  angle:Math.atan2(e.y-p.y,e.x-p.x),radius:e.r,reach:distance(e,p),wing:e.railWing
 }));
 const leftWing=nearby.find(e=>e.wing===0),rightWing=nearby.find(e=>e.wing===1);
 const workshopAim=leftWing&&rightWing?Math.atan2(Math.sin(leftWing.angle)+Math.sin(rightWing.angle),Math.cos(leftWing.angle)+Math.cos(rightWing.angle)):null;
 let best=heading,most=0,split=false;
 const edge=(stats.count-1)/2,center=edge*COAST_FAN.step;
 // The best lane can lie in the space between two groups.
 const angles=[heading,...nearby.flatMap(e=>[e.angle,e.angle-center,e.angle+center])];
 if(workshopAim!==null)angles.push(workshopAim);
 for(const aim of angles){
  let hits=0,left=0,right=0;
  for(const e of nearby){
   const offset=Math.atan2(Math.sin(e.angle-aim),Math.cos(e.angle-aim));
   const ray=clamp(Math.round(offset/COAST_FAN.step),-edge,edge);
   if(Math.abs(offset)>=Math.PI/2||Math.abs(Math.sin(offset-ray*COAST_FAN.step))*e.reach>e.radius+7)continue;
   hits++;
   if(e.wing===0)left|=1<<(ray+edge);
   if(e.wing===1)right|=1<<(ray+edge);
  }
  const rays=left|right,coversBoth=left!==0&&right!==0&&(rays&(rays-1))!==0;
  if(coversBoth&&!split||coversBoth===split&&hits>most){most=hits;best=aim;split=coversBoth;}
 }
 return best;
}
function shoot(s,w,counter){
 const d=weaponStats(w),p=s.player;
 const fan=isCapturedTurret(w),railCue=fan?railFanCutCue(s):null;
 if(railCue?.state==='hold')return false;
 const railCut=railCue?.state==='ready'?railCue:null;
 const damageScale=activeManeuver(p)==='brace'?1.25:1;
 const reply=counter?.state==='ready'?counter:null;
 const volley=w.id==='r'?coastRocketVolley(s,undefined,w):null;
 if(volley?.state==='ready'){
  const {x,y}=volley,a=Math.atan2(y-p.y,x-p.x);
  if(!fire(s,w,null,a,d.damage*damageScale,{coastFuse:{x,y}}))return false;
  p.aim=a;p.attack=.12;w.shots++;
  emit(s,'rocket-shot',p.x+Math.cos(a)*28,p.y-18+Math.sin(a)*28,{angle:a,life:.08});return true;
 }
 const lance=infernoCoreLine(s,w),candidates=attackTargets(s,d.range);
 const open=w.id==='f'&&!w.evolved&&s.operation?.region===0&&s.stage==='field'?candidates.filter(e=>!coastFlameShield(s,e)):candidates;
 const target=reply?.target||targetFor(s,w,d,open.length?open:candidates,lance);
 if(!target){const b=s.blocks.find(b=>b.hp>0&&distance({x:b.x+b.w/2,y:b.y+b.h/2},p)<150);if(b){b.hp=Math.max(0,b.hp-d.damage);p.attack=.1;emit(s,'impact',b.x+b.w/2,b.y+b.h/2);return true;}return false;}
 if(w.id!=='f'&&s.shots.length+d.count+(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7?1:0)>320)return false;
 const angle=Math.atan2(target.y-p.y,target.x-p.x);
 const crossfire=fan&&portCrossfireZone(s)?.ready&&s.boss.parts.every(part=>candidates.includes(part));
 const a=railCut?railCue.angle:crossfire?Math.atan2(s.boss.y-p.y,s.boss.x-p.x):fan?capturedFanAim(p,candidates,angle,d):angle;p.aim=a;p.attack=.12;
 if(w.id==='f'){
  const catalyst=moduleRank(s,'catalyst'),focused=w.branch==='focused';
  let flameBlocker;
  for(const e of lance?[target]:candidates){
   const angle=Math.atan2(e.y-p.y,e.x-p.x),delta=Math.atan2(Math.sin(angle-a),Math.cos(angle-a));
   if(Math.abs(delta)>=d.cone*Math.PI/360)continue;
   const shield=!w.evolved&&coastFlameShield(s,e);
   if(shield){flameBlocker??=shield;continue;}
   burn(e,w.evolved?(focused&&e===target?36:24):RULES.modules.catalyst.burnDamagePerSecond[catalyst-1]||6,w.evolved?2:1.5);
   const core=lance&&e===s.boss;
   const bypass=core&&s.boss.parts.some(part=>part.hp>0)&&!portCoreDisrupted(s);
   if(core){
    s.stats.infernoCoreHits=(s.stats.infernoCoreHits||0)+1;
    if(portCoreDisrupted(s)&&portCompressionBand(s))recordHarborPayoff(s,'compressionHits');
    const b=s.boss;
    if(s.operation.tactic==='lens'&&b.tacticCycle!==b.cycle){
     b.tacticCycle=b.cycle;b.timer+=FRONT_TACTICS[2].lens.delay;recordFrontTactic(s);
     emit(s,'weakpoint',b.x,b.y,{text:'코어 재장전 지연 · 사선 유지',life:1.2});
    }
   }
   damage(s,e,d.damage*damageScale*(core?1.4:1)*(bypass?1.6:1),'fire','native',w.uid,0);
  }
  let screen;
  if(flameBlocker){
   const gap=distance(p,flameBlocker),heading=Math.atan2(flameBlocker.y-p.y,flameBlocker.x-p.x)-a;
   screen={angle:Math.atan2(Math.sin(heading),Math.cos(heading)),half:Math.atan2(flameBlocker.r+5,gap),range:Math.max(8,gap-12)};
   emit(s,'armor-impact',flameBlocker.x,flameBlocker.y,{life:.3,angle:flameBlocker.aim,coastScreen:flameBlocker.siteId,shieldId:flameBlocker.id});
  }
  emit(s,'flame',p.x,p.y,{angle:a,r:d.range,cone:d.cone,life:.14,evolved:w.evolved,...(screen?{screen}:null),...(focused?{focused:true}:null),...(lance?{coreDistance:distance(p,target)}:null)});
  if(!w.evolved&&w.branch==='trail'&&w.shots%6===0&&p.moving&&s.zones.filter(z=>z.owner===w.uid).length<3&&s.zones.length<RULES.limits.zones)
   s.zones.push({x:p.x,y:p.y,r:50,dps:12,life:2,tick:.25,source:'dot',owner:w.uid});
 }else if(fan){
  fireCapturedFan(s,w,target,a,d,d.damage*damageScale,crossfire,railCut);
 }else{
  const nearest=[target,...candidates.filter(e=>e.id!==target.id)];
  const ordered=w.id==='r'&&w.evolved&&!w.fusion&&!reply?salvoTargets(nearest,d.radius,d.count):nearest;
  for(let i=0;i<d.count;i++){
   const t=ordered[i%ordered.length],counterShot=reply&&i===0;
   const angle=Math.atan2(t.y-p.y,t.x-p.x)+(ordered.length===1&&!counterShot?(i-(d.count-1)/2)*.035:0);
   fire(s,w,t,angle,d.damage*damageScale,counterShot?{coastCounter:true}:undefined);
  }
  if(reply){
   reply.site.counterFired=true;
   emit(s,'coast-counter',target.x,target.y,{life:.65,coastCounter:reply.site.id});
  }
  if(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7){const marked=markedBlastTarget(s,candidates,target),angle=Math.atan2(marked.y-p.y,marked.x-p.x);fire(s,w,marked,angle,60,{rocket:true,radius:100,homing:false,incendiary:false});}emit(s,w.id==='r'?'rocket-shot':'shot',p.x+Math.cos(a)*28,p.y-18+Math.sin(a)*28,{angle:a,life:.08});
 }
 w.shots++;return true;
}
function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
function registerCrossfireHit(s,impact,mark){
 const b=s.boss,index=b.parts.indexOf(impact);
 if(index<0||b.dead||b.mode!=='recover'||mark.cycle!==b.cycle||portCrossfireCuts(s,b.cycle+1))return;
 const prior=b.crossfireHit;
 if(prior?.volley>mark.volley)return;
 const mask=(prior?.volley===mark.volley?prior.mask:0)|(1<<index);
 if(mask!==3){b.crossfireHit={...mark,mask};return;}
 delete b.crossfireHit;
 b.crossfireCycle=b.cycle+1;
 s.stats.harborCrossfires=(s.stats.harborCrossfires||0)+1;
 recordFrontTactic(s);
 const [a,z]=b.parts.map(part=>partPosition(s,part));
 emit(s,'barrage-cancel',a.x,a.y,{x2:z.x,y2:z.y,crossfire:true,text:'양쪽 급탄 차단 · 다음 측면 포격 취소',life:1.2});
}
function registerRailFanCut(s,impact,mark){
 const b=s.boss;
 if(impact!==b.parts[mark.gun]||b.dead||b.mode!=='salvo'||b.cycle!==mark.cycle||s.stats.railFanCut)return;
 const prior=b.railFanCutHit;
 if(prior?.volley!==mark.volley||prior.gun===mark.gun){b.railFanCutHit=mark;return;}
 s.hazards=s.hazards.filter(h=>!(h.lane&&!h.hit&&h.timer>0));
 s.stats.railFanCut=true;
 delete b.railFanCutHit;
 b.timer=0;
 const [left,right]=b.parts.map(part=>partPosition(s,part));
 emit(s,'barrage-cancel',left.x,left.y,{x2:right.x,y2:right.y,railFanCut:true,life:1.6,text:'양쪽 포대 직격 · 포격 차단'});
}
function detonate(s,q,impact){
 const effect=q.source==='payload'?'payload-impact':q.capturedFan?'captured-impact':q.salvo?'salvo-impact':'explosion';
 const before=s.stats.payloadKills||0;
 const mortars=q.coastFuse&&s.enemies.filter(e=>!e.dead&&e.cohort==='coast-guard'&&e.type==='mortar'&&e.hp>0);
 const cut=q.conduitGun&&conduitMortarCue(s);
 const cutHit=cut?.gun&&cut.gun.id===q.conduitGun&&distance(q,cut.gun)<=q.radius+cut.gun.r&&!lineBlocked(s,q,cut.gun);
 const directHp=impact?.hp;
 const railCut=q.railFanCut;
 const liveLane=railCut&&s.hazards.some(h=>h.lane&&railGunOf(h)===railCut.gun&&!h.hit&&h.timer>0);
 const burst=blast(s,q.x,q.y,q.radius,q.damage,q.source,q.owner,q.incendiary,effect,q.breachLane,q.coastSignal,q.armorCycle,q.railFan);
 if(q.crossfire&&impact?.hp<directHp)registerCrossfireHit(s,impact,q.crossfire);
 if(liveLane&&impact?.hp<directHp)registerRailFanCut(s,impact,railCut);
 q.life=0;
 if(cutHit){
  s.hazards=s.hazards.filter(h=>h!==cut.round);
  s.stats.conduitMortarCuts=(s.stats.conduitMortarCuts||0)+1;
  emit(s,'barrage-cancel',cut.round.x,cut.round.y,{x2:cut.gun.x,y2:cut.gun.y,life:.55,conduitCut:true});
 }
 if(q.relay&&burst.contact){
  burst.relayArrival=true;
  s.events.push('payload-arrival');
 }
 if(mortars?.length===2&&mortars.every(e=>e.dead)){
  s.levelReadyAt=Math.max(s.levelReadyAt||0,s.t+COAST_MORTAR.volleyBeat);
  emit(s,'coast-volley',q.x,q.y,{life:.85});
 }
 if(q.source!=='payload'||q.incendiary||q.relay||(s.stats.payloadKills||0)-before<2)return;
 const owner=s.weapons.find(w=>w.uid===q.owner&&w.fusion),eligible=payloadTargets(s,q,q.radius+22);
 const struck=impact?.waveGroup,origin=q.avoidGroup,pulse=impact?.wavePulse;
 // Only a confirmed cross-pack hit within the same pulse can seek its remaining pack.
 const crossPack=Number.isSafeInteger(pulse)&&pulse===q.wavePulse&&Number.isSafeInteger(origin)&&Number.isSafeInteger(struck)&&struck!==origin;
 const remainingPack=e=>crossPack&&e.wavePulse===pulse&&Number.isSafeInteger(e.waveGroup)&&e.waveGroup!==struck&&e.waveGroup!==origin;
 const gun=crossPack&&conduitCutTarget(s,q);
 const direct=!!gun&&remainingPack(gun);
 const third=direct?gun:eligible.find(remainingPack);
 const next=third||eligible[0];
 const launch=third?{x:q.x,y:q.y,id:impact.id,waveGroup:struck,wavePulse:pulse}:q;
 if(owner&&next&&launchPayload(s,owner,launch,next,RULES.fusion.payloadDamage*.8,true,q.breachLane,third?.waveGroup,direct)){
  s.stats.payloadRelays=(s.stats.payloadRelays||0)+1;
  emit(s,'payload-relay',q.x,q.y,{x2:next.x,y2:next.y,life:.32,...(third?{thirdPack:true}:{}),...(direct?{conduitCut:true}:{})});
 }
}
function recordRailFanHit(s,{volley,ray},{x,y,wing}){
 const contacts=s.railFanContacts??={};
 const hits=contacts[volley]??=[null,null];
 const opposite=hits[1-wing];
 if(opposite&&opposite.ray!==ray){
  s.stats.railFanSweep=true;
  delete s.railFanContacts;
  emit(s,'rail-fan-sweep',x,y,{x2:opposite.x,y2:opposite.y,life:.72});
 }else hits[wing]??={x,y,ray};
}
function homingTarget(s,q){
 const candidates=targets(s);
 const locked=candidates.find(e=>e.id===q.target&&e.hp>0);
 if(locked)return locked;
 const eligible=candidates.filter(e=>e.hp>0&&!q.hitIds.includes(e.id)&&(q.avoidGroup==null||e.waveGroup!==q.avoidGroup))
  .sort((a,b)=>distance(a,q)-distance(b,q));
 return q.relayGroup!==undefined&&eligible.find(e=>e.wavePulse===q.wavePulse&&e.waveGroup===q.relayGroup&&!lineBlocked(s,q,e))
  ||eligible[0];
}
function updateShots(s,dt){
 for(const q of s.shots){q.life-=dt;if(q.life<=0)continue;if(q.arming>0)q.arming-=dt;const old={x:q.x,y:q.y};
  if(q.homing){const target=homingTarget(s,q);if(target){q.target=target.id;const a=Math.atan2(q.vy,q.vx),wanted=Math.atan2(target.y-q.y,target.x-q.x),delta=Math.atan2(Math.sin(wanted-a),Math.cos(wanted-a)),angle=a+clamp(delta,-dt*2.8,dt*2.8),speed=q.speed??(q.source==='payload'?Math.hypot(q.vx,q.vy):300);q.vx=Math.cos(angle)*speed;q.vy=Math.sin(angle)*speed;}}
  const atFuse=q.coastFuse&&distance(old,q.coastFuse)<=Math.hypot(q.vx,q.vy)*dt;
  q.x=atFuse?q.coastFuse.x:q.x+q.vx*dt;q.y=atFuse?q.coastFuse.y:q.y+q.vy*dt;
  const wall=blocked(s,q.x,q.y,q.r);if(wall){
   if(q.rocket){
    if(q.source==='payload'&&q.incendiary)Object.assign(q,old);
    detonate(s,q);
   }
   else{if(wall.hp>0)wall.hp=Math.max(0,wall.hp-q.damage);emit(s,'impact',q.x,q.y);}
   q.life=0;continue;
  }
  for(const e of targets(s,q.breachLane,true,q.armorCycle)){if(e.hp<=0||q.hitIds.includes(e.id)||segmentDistance(e.x,e.y,old.x,old.y,q.x,q.y)>e.r+q.r)continue;
   if(q.arming>0&&q.target!==e.id||q.avoidGroup!=null&&q.avoidGroup===e.waveGroup)continue;
   q.hitIds.push(e.id);if(q.rocket){detonate(s,q,e);break;}
   const wasBounce=q.pierce===undefined?q.hitIds.length>1:!!q.reflected;
  const angle=e===s.raid?.target?Math.atan2(-q.vy,-q.vx):null,screened=angle!=null&&raidOnNose(s,angle);
   const amount=screened?q.damage*RULES.raidContracts.armored.bulletFrontMultiplier:q.damage;
   damage(s,e,amount,'bullet',q.source,q.owner,q.hitIds.length>1?.35:1,q.breachLane,undefined,undefined,q.armorCycle);
   if(wasBounce)s.stats.ricochetHits++;
   emit(s,screened?'armor-impact':'impact',screened?q.x:e.x,screened?q.y:e.y,{life:.12,angle});
   if(q.pierce>0){q.pierce--;q.damage*=.72;emit(s,'pierce',e.x,e.y,{angle:Math.atan2(q.vy,q.vx),life:.18});break;}
   if(q.bounces>0){const next=targets(s).filter(t=>t.hp>0&&!q.hitIds.includes(t.id)&&distance(t,e)<180&&!lineBlocked(s,e,t)).sort((a,b)=>distance(a,e)-distance(b,e))[0];if(next){q.bounces--;q.reflected=true;q.damage*=.7;q.x=e.x;q.y=e.y;const a=Math.atan2(next.y-e.y,next.x-e.x);q.vx=Math.cos(a)*700;q.vy=Math.sin(a)*700;q.life=Math.max(q.life,.28);s.effects.push({type:'ricochet',x:e.x,y:e.y,x2:next.x,y2:next.y,age:0,life:.1});break;}}
   q.life=0;break;
  }
  if(atFuse&&q.life>0)detonate(s,q);
 }
 s.shots=s.shots.filter(q=>q.life>0);
 const railHit=s.boss.railFanCutHit;
 if(railHit&&!s.shots.some(q=>q.railFanCut?.volley===railHit.volley&&q.railFanCut.gun!==railHit.gun))delete s.boss.railFanCutHit;
 if(s.railFanContacts){
  const pending=new Set(s.shots.map(q=>q.railFan?.volley));
  for(const volley of Object.keys(s.railFanContacts))if(!pending.has(Number(volley)))delete s.railFanContacts[volley];
  if(!Object.keys(s.railFanContacts).length)delete s.railFanContacts;
 }
}
function hurt(s,amount,x,y){const p=s.player;if(p.invuln>0||p.dash>0||p.hp<=0)return;const actual=amount*(moduleRank(s,'overcharger')?1.15:1);p.hp=Math.max(0,p.hp-actual);s.stats.damageTaken+=actual;p.hurt=.2;p.invuln=.65;const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1;move(s,p,dx/d*RULES.combatFeel.pilotHitPush,dy/d*RULES.combatFeel.pilotHitPush,16);emit(s,'hurt',p.x,p.y);}
function enemyShot(s,e,a,portFan=false){if(s.enemyShots.length<100)s.enemyShots.push({x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,life:3,r:5,...(portFan?{portFan}:null)});}
function separateEnemies(s,dt){
 const crowd=alive(s),cells=new Map(),forces=crowd.map(()=>({x:0,y:0})),cell=56,limit=RULES.combatFeel.crowdSeparationSpeed*dt;
 crowd.forEach((e,i)=>{const key=`${Math.floor(e.x/cell)},${Math.floor(e.y/cell)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);});
 crowd.forEach((a,i)=>{const cx=Math.floor(a.x/cell),cy=Math.floor(a.y/cell);for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const j of cells.get(`${x},${y}`)||[]){if(j<=i)continue;const b=crowd[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),gap=(a.r+b.r)*.9;if(d>=gap)continue;const angle=((i+1)*2.399963+(j+1)*.7),nx=d>.001?dx/d:Math.cos(angle),ny=d>.001?dy/d:Math.sin(angle),push=Math.min(limit,(gap-d)*.5);forces[i].x-=nx*push;forces[i].y-=ny*push;forces[j].x+=nx*push;forces[j].y+=ny*push;}});
 crowd.forEach((e,i)=>{if(e.cohort==='port-battery')return;const f=forces[i],length=Math.hypot(f.x,f.y);if(length)move(s,e,f.x*Math.min(1,limit/length),f.y*Math.min(1,limit/length),e.r);});
}
const FORMATION_INGRESS={flame:.65,fusion:1.15,rocket:1.15};
function updateEnemies(s,dt){
 const p=s.player;let incoming=null;
 for(const e of s.enemies){if(e.dead){e.death-=dt;continue;}e.spawnAge+=dt;e.hurt=Math.max(0,e.hurt-dt);e.timer-=dt;e.walk+=dt*e.speed*.12;
  updateBurn(s,e,dt);if(e.dead)continue;
  const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,desired=Math.atan2(dy,dx);
  // The rescue shield covers the beach entrance before it starts tracking the pilot.
  const covering=e.coastRescueShield&&!e.coastScanned&&e.spawnAge<2.2;
  if(e.type==='shield'&&!covering){const delta=Math.atan2(Math.sin(desired-e.aim),Math.cos(desired-e.aim)),turn=RULES.enemies.shield.turnRadiansPerSecond*dt;e.aim+=clamp(delta,-turn,turn);}else if(!covering)e.aim=desired;
  if(covering)continue;
  const escort=e.cohort==='signal-guard',battery=e.cohort==='port-battery';
  if(e.type==='mortar'&&(d<COAST_MORTAR.range||escort||battery)){
   const courier=escort&&signalCourier(s);
   const cut=courier&&signalPosition(s.challenge.lane,s.challenge.timeLeft-1.55);
   const inCut=cut&&distance(p,cut)<225&&distance(e,cut)<COAST_MORTAR.range;
   if(d<COAST_MORTAR.range&&e.timer<=0&&coastMortarWait(s,e)<=0&&(!courier||inCut)){
    e.timer=2.8;
    const coast=e.cohort==='coast-guard'||e.cohort==='wire-guard'||e.coastResponse==='r';
    const duration=COAST_MORTAR.warning;
    const mark=inCut?cut:p,r=inCut?62:battery?56:48;
    const launch=coast||inCut||battery?{fromX:e.x,fromY:e.y}:null;
    s.hazards.push({x:mark.x,y:mark.y,r,timer:duration,age:0,...launch,...(coast?{coastMortar:e.coastResponse==='r'?'coast-response':e.siteId}:null),...(coast&&s.sites.some(site=>site.id===e.siteId&&site.coastPlan==='split')?{coastGun:e.id}:null),...(inCut?{signalCut:true}:null),...(battery?{portBattery:true}:null)});
    emit(s,'warning',mark.x,mark.y,{r,life:duration});
    if(coast||battery)emit(s,'mortar-fire',e.x,e.y,{life:.21});
   }
  }else{
   const before={x:e.x,y:e.y},speed=e.speed*(e.hurt>0&&e.type!=='officer'?RULES.combatFeel.hurtMoveMultiplier:1);
   const wing=e.coastWing===-1||e.coastWing===1?e.coastWing:0;
   const spread=wing*COAST_WING.offset*clamp((COAST_WING.release-e.spawnAge)/(COAST_WING.release-COAST_WING.hold),0,1);
   const ingress=Number.isFinite(e.formationHeading)&&e.spawnAge<FORMATION_INGRESS[e.showcase]&&d>=76;
   const x=dx+spread,len=spread?Math.hypot(x,dy)||1:d;
   const vx=ingress?Math.cos(e.formationHeading):x/len,vy=ingress?Math.sin(e.formationHeading):dy/len;
   if(ingress)e.aim=e.formationHeading;
   move(s,e,vx*speed*dt,vy*speed*dt,e.r);
   if(e.x===before.x&&e.y===before.y){
    if(ingress)delete e.formationHeading;
    move(s,e,-dy/len*speed*dt,x/len*speed*dt,e.r);
   }
  }
  if(e.type==='officer'&&d<420&&e.timer<=0){e.timer=2.4;for(let i=-2;i<=2;i++)enemyShot(s,e,e.aim+i*.18);emit(s,'enemy-fire',e.x,e.y,{life:.2});}
 }
 separateEnemies(s,dt);
 for(const e of alive(s))if(e.spawnAge>.5&&distance(e,p)<e.r+16){const amount=RULES.enemies[e.type].contactDamage||12;if(!incoming||amount>incoming.amount)incoming={amount,x:e.x,y:e.y};}
 for(const q of s.enemyShots){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(blocked(s,q.x,q.y,q.r))q.life=0;if(distance(q,p)<21){q.life=0;if(!incoming||incoming.amount<10)incoming={amount:10,x:q.x,y:q.y};}}
 for(const h of s.hazards){h.timer-=dt;if(h.timer<=0&&!h.hit){
  h.hit=true;emit(s,h.lane?'barrage':'explosion',h.x,h.y,{r:h.r,w:h.w,h:h.h,life:.3});s.events.push('shell-land');
  const caught=h.lane?railLaneContains(h,p):distance(h,p)<blastContactRadius(h);
  if(caught&&(!incoming||incoming.amount<14))incoming={amount:14,x:h.x,y:h.y};
 }}
 s.enemyShots=s.enemyShots.filter(q=>q.life>0);s.hazards=s.hazards.filter(h=>h.timer>-.3);s.enemies=s.enemies.filter(e=>!e.dead||e.death>0);
 if(incoming&&(!s.hitCandidate||incoming.amount>s.hitCandidate.amount))s.hitCandidate=incoming;
}

function stopRailGun(s,part,bySignal=false){
 const railGun=s.boss.parts.indexOf(part);
 if(railGun<0)return false;
 const pending=s.hazards.find(h=>h.lane&&!h.hit&&railGunOf(h)===railGun);
 if(!pending)return false;
 s.hazards=s.hazards.filter(h=>h!==pending);
 const text=bySignal?`${railGunLabel(railGun)} 역송 · 포격 차단`:`${railGun===0?'좌측':'우측'} 포대 파괴 · 포격 차단`;
 emit(s,'barrage-cancel',part.x,part.y,{life:1.1,text,...(bySignal?{railCounter:railGun}:null)});
 return true;
}
function startRailBarrage(s,warning){
 const b=s.boss;
 const duration=RAIL_BARRAGE.warning+(railHasRelay(s)?.4:0)+warning;
 b.timer=duration+.2;
 s.hazards.push(...railBarrageRounds(s,b.cycle).map(round=>({...round,timer:duration,duration})));
 emitBossWarning(s,'rail-lock',b.x,b.y,warning?{text:'선발 지원 · 첫 조준 경고 +1초',life:1}:{life:1});
}
function startPortBarrage(s,warning){
 const {boss:b,player:p}=s,plan=PORT_BARRAGE,axis=portBarrageAxis(s,b.cycle);
 const duration=plan.warning+warning,horizontal=axis==='horizontal';
 const jammed=horizontal&&b.parts[1].hp>0&&portJamsSweep(s,b.cycle);
 const rounds=portBarrageRounds(s,b.cycle);
 const crossfire=portCrossfireCuts(s,b.cycle)?portBarrageRounds(s,b.cycle,false).length-rounds.length:0;
 if(crossfire)s.stats.harborCrossfireRounds=(s.stats.harborCrossfireRounds||0)+crossfire;
 for(const round of rounds)s.hazards.push({
  ...round,timer:duration,duration,
  ...(round.portRound==='lock'?{portAxis:axis,...(jammed?{jammed:true}:{})}:{})
 });
 const mark=portBarrageMark(axis,rounds.some(h=>h.portRound==='turret')?portTurretSide(b):0);
 const rake=rounds.some(h=>h.portRound==='rake'),battery=rounds.some(h=>h.portRound==='battery');
 const suppressed=b.armorSuppressedCycle===b.cycle;
 const cut=b.emberCycle===b.cycle&&b.parts[0].hp>0;
 const relayTurret=b.parts[0].hp>0&&portRelayCuts(s,b.cycle,'turret');
 const relayArmor=b.parts[1].hp>0&&portRelayCuts(s,b.cycle,'armor');
 const signalTurret=!cut&&portSignalCuts(s,b.cycle,'turret');
 const signalArmor=portSignalCuts(s,b.cycle,'armor');
 if(signalTurret||signalArmor){
  const key=signalTurret?'harborSignalTurretCuts':'harborSignalArmorCuts';
  s.stats[key]=(s.stats[key]||0)+1;
 }
 if(relayTurret&&!cut)recordHarborPayoff(s,'arcTurretCuts');
 if(relayArmor)recordHarborPayoff(s,'arcArmorCuts');
 const message=crossfire?'양쪽 급탄 차단 · 발밑 포격':jammed?'관제소 교란 · 장갑탄 차단':rake?`가로 포격 ${mark}`:battery?`세로 포격 ${mark}`
  :suppressed?'철갑 · 보조 포격 차단':'발밑 포격';
 const signal=rake?'harbor-rake-lock':battery?'harbor-vertical-lock':'harbor-center-lock';
 if(cut)recordPortEmberIntercept(s,partPosition(s,b.parts[0]));
 const relay=relayTurret&&!cut||signalTurret?' · 전도 포탑 차단':relayArmor||signalArmor?' · 전도 보조포 차단':'';
 emitBossWarning(s,signal,p.x,p.y,{text:`${message}${cut?' · 포탑탄 차단':''}${relay}${warning?' · 선행 경보 +1초':''}`,life:1});
}
function clearPortRounds(s,...rounds){
 const before=s.hazards.length;
 s.hazards=s.hazards.filter(h=>!rounds.includes(h.portRound)||h.hit);
 return s.hazards.length!==before;
}
function dropHarborAid(s){
 const b=s.boss,kit=PORT_SUPPORT.recovery;
 if(s.operation.support!=='recovery'||b.harborSupply||b.cycle>kit.limit||b.harborSupplyCycle===b.cycle)return;
 const point=portAidPoint(b,b.cycle);
 b.harborSupply=point;b.harborSupplyCycle=b.cycle;
 emit(s,'supply-ready',point.x,point.y,{life:1.1,text:`${point.x<800?'좌측':'우측'} 구급 화물 투하`});
}
function fireHarborAidCounter(s){
 const b=s.boss,round=portAidCounterRound(s),target=portAidCounterTarget(s,round);
 if(!round&&!target)return;
 delete b.harborCounter;
 const intercept=PORT_AID_INTERCEPT[round?.portRound];
 const cleared=round?s.hazards.filter(h=>!h.hit&&h.portRound===round.portRound):[];
 if(intercept){
  clearPortRounds(s,round.portRound);
  recordHarborPayoff(s,intercept.key);
 }
 if(target){
  const hull=target===b;
  if(!hull)Object.assign(target,partPosition(s,target));
  damage(s,target,PORT_SUPPORT.recovery.counterDamage,'blast','support');
  recordHarborPayoff(s,hull?'counterHull':'counterfire');
 }
 const {x,y}=round||target;
 const result=intercept?.label||'측면 장갑 명중';
 const secondary=cleared.filter(h=>h!==round).map(({x,y})=>({x,y}));
 emit(s,'aid-counter',x,y,{life:.72,text:`지원 포격 · ${result}`,secondary});
}
function updateOperationBoss(s,dt){
 const b=s.boss,p=s.player,index=s.operation.region;
 b.timer-=dt;b.spawnClock-=dt;b.kick=Math.max(0,b.kick-dt*3);b.flash=Math.max(0,b.flash-dt);
 updateBurn(s,b,dt);
 if(b.dead)return;
 if(index===2&&b.mode!=='recover'&&b.parts[1].hp>0)b.x=clamp(b.x+Math.sin(s.operation.regionTime*.7)*35*dt,330,1270);
 b.aim=Math.atan2(p.y-b.y,p.x-b.x);b.body=Math.PI/2;
 const disarmed=index===1&&railDisarmed(b);
 if(disarmed&&b.mode!=='recover'&&!s.hazards.some(h=>h.lane&&!h.hit)){
  if(b.mode==='aim')b.cycle++;
  b.mode='salvo';b.timer=0;
 }
 if(b.timer<=0){
  if(b.mode==='aim'){
   b.cycle++;b.mode='salvo';b.timer=index===1?1.45:1.15;
   const warning=b.cycle===1&&s.operation.support==='vanguard'?FRONT_SUPPORTS.vanguard.warning:0;
   if(warning)recordSupportUse(s);
   b.timer+=warning;
   if(index===1)startRailBarrage(s,warning);
   else startPortBarrage(s,warning);
   if(index===2)dropHarborAid(s);
  }else if(b.mode==='salvo'){
   b.mode='recover';b.timer=index===1?RAIL_BARRAGE.recover:2.6;
   if(index===1&&s.operation.tactic==='signal'&&b.tacticCycle===b.cycle)b.timer+=FRONT_TACTICS[1].signal.delay;
   if(index===2&&b.parts[0].hp>0){
    if(b.turretSuppressedCycle===b.cycle)recordHarborPayoff(s,'fans');
    else if(portRelayCuts(s,b.cycle,'turret')){
     if(b.emberCycle===b.cycle)recordHarborPayoff(s,'arcTurretCuts');
    }else if(!portSignalCuts(s,b.cycle,'turret')){
     for(let i=-4;i<=4;i++)enemyShot(s,b,b.aim+i*.16,true);
     b.kick=1;b.flash=.12;
    }
   }
   emit(s,'weakpoint',b.x,b.y,{text:disarmed?'양쪽 포대 파괴 · 차체 노출':index===1?'포격 재장전 · 포대를 노려라':'노출 코어 · 집중 공격',life:1.4});
   // An older mid-salvo save or a crate carried into this salvo can still supply the reload.
   if(index===2)dropHarborAid(s);
   else if(s.operation.support==='recovery'&&b.cycle<=PORT_SUPPORT.recovery.limit){
    const x=b.cycle%2?625:975,y=470;
    dropXp(s,x,y,18,true);
    emit(s,'supply-ready',x,y,{life:1.1});
   }
  }else if(disarmed){b.cycle++;b.timer=RAIL_BARRAGE.recover;}
  else{delete b.crossfireHit;b.mode='aim';b.timer=index===1?1.4:1.7;}
 }
 if(b.spawnClock<=0){b.spawnClock=6;const count=s.operation.jammed?3:6;b.reinforcements=(b.reinforcements||0)+1;for(let i=0;i<count;i++)spawnAround(s,s.operation.jammed?(i===0?(b.reinforcements%2===0?'mortar':'shield'):'rifle'):i===0?'mortar':i===1?'shield':'rifle',{cohort:'boss'});}
 if(distance(b,p)<b.r+16&&(!s.hitCandidate||s.hitCandidate.amount<16))s.hitCandidate={amount:16,x:b.x,y:b.y};
}
function lockCoastCharge(s){
 const b=s.boss,linear=b.mode==='charge';
 const offset=linear?coastTravel(COAST_CHARGE.duration-b.timer,true):0;
 b.chargePath={...planCoastCharge(s,offset),...(linear?{linear:true}:{})};
}
function coastChargeProgress(b){
 const path=b.chargePath;
 return b.mode==='windup'?0:Math.min(path.length,Math.max(0,coastTravel(COAST_CHARGE.duration-b.timer,path.linear)-path.offset));
}
function updateCoastCharge(s){
 const b=s.boss,path=b.chargePath,plan=COAST_CHARGE;
 const distance=coastChargeProgress(b);
 const dx=Math.cos(b.body),dy=Math.sin(b.body);
 b.x=path.x+dx*distance;b.y=path.y+dy*distance;
 if(distance<path.length&&b.timer>0)return;
 const cover=path.blockId==null?null:s.blocks.find(o=>o.id===path.blockId&&o.hp!==0);
 const crushed=cover?.hp>0;
 if(crushed)cover.hp=0;
 if(cover)emit(s,'charge-impact',clamp(b.x,cover.x,cover.x+cover.w),clamp(b.y,cover.y,cover.y+cover.h),{angle:b.body,crushed,life:.42});
 b.mode='recover';b.timer=plan.recover+(b.parts[1]?.hp<=0?plan.trackBonus:0)+(cover?plan.impactBonus:0);
 delete b.chargePath;
 emit(s,'weakpoint',b.x,b.y,{text:crushed?'상자 파쇄 · 후면 엔진 노출':cover?'엄폐 충돌 · 후면 엔진 노출':'후면 엔진 노출',life:1.4});
}
function updateBoss(s,dt){
 const b=s.boss,p=s.player;
 if(!b.active||b.dead)return;
 if(s.operation?.region>0){updateOperationBoss(s,dt);return;}
 updateBurn(s,b,dt);for(const part of b.parts)updateBurn(s,part,dt);if(b.dead)return;
 if(!b.chargePath&&['windup','charge'].includes(b.mode))lockCoastCharge(s);
 b.timer-=dt;b.spawnClock-=dt;b.kick=Math.max(0,b.kick-dt*3);b.flash=Math.max(0,b.flash-dt);
 if(b.mode==='charge')updateCoastCharge(s);
 else if(b.timer<=0){
  if(b.mode==='windup'){b.mode='charge';b.timer=COAST_CHARGE.duration;emit(s,'boss-charge',b.x,b.y);}
  else if(b.mode==='recover'){
   b.mode='aim';b.timer=1.4;
   const angle=Math.atan2(p.y-b.y,p.x-b.x),count=b.parts[0].hp>0?COAST_FAN.count:COAST_FAN.brokenCount;
   for(let i=0;i<count;i++)enemyShot(s,b,angle+coastFanAngle(i,count));
   b.kick=1;b.flash=.12;
   if(coastAtShore(s))emit(s,'carrier-volley',b.x,b.y);
  }
  else{
   if(coastAtShore(s))b.cycle++;
   b.mode='windup';b.timer=COAST_CHARGE.warning;b.body=Math.atan2(p.y-b.y,p.x-b.x);
   delete b.coastSignalFired;
   lockCoastCharge(s);
   emitBossWarning(s,'coast-lock',b.x,b.y,{angle:b.body,life:COAST_CHARGE.warning});
  }
 }
 b.aim=b.mode==='charge'||b.mode==='windup'?b.body:Math.atan2(p.y-b.y,p.x-b.x);
 if(b.spawnClock<=0){b.spawnClock=5;for(let i=0;i<6;i++)spawnAround(s,i===0?'shield':'rifle');}
 if(distance(b,p)<b.r+16&&(!s.hitCandidate||s.hitCandidate.amount<16))s.hitCandidate={amount:16,x:b.x,y:b.y};
}
function frontControlCards(s){
 const index=s.operation.region,tactics=FRONT_TACTICS[index];
 const keys=index===2?portTacticKeys(s):Object.keys(tactics);
 const orders=keys.map(key=>{const t=key==='signal'&&portConductiveSignal(s)?PORT_CONDUCTIVE_SIGNAL:tactics[key];return {id:`control:${key}`,kind:'control',key,title:t.name,desc:t.impact,label:t.role,hint:t.hint};});
 const rank=infernoControlRank(s);
 const relay=railRelayInvestment(s);
 const equipment=index===1?{key:'supply',title:'중계기 보급 회수',desc:'보유 병기를 개조하거나 새 무장과 모듈을 확보합니다.',label:'일반 보급'}
  :{key:'loot',title:'시험 탄약 노획',desc:'희귀 모듈 또는 재보급 후보 3개',label:'추가 화력'};
 const supply={...equipment,id:`control:${equipment.key}`,kind:'control',...(relay.cards.length?{
  title:s.firstNew==='f'?'분사기 정비 보급':'격발망 조립 보급',desc:relay.material,
  label:'무장 개조',relayInvestment:s.firstNew
 }:rank?{
  title:'분사기 정비 보급',desc:`F L${rank-1} → L${rank} 강화 후보`,label:'인페르노 준비',infernoRank:rank
 }:null)};
 if(index===1)return [...orders,supply];
 return [...orders,
  {id:'control:jam',kind:'control',key:'jam',title:'증원 통신 교란',desc:'첫 가로 장갑탄 차단 · 증원 6명 → 3명',label:'최종전 안전'},
  supply];
}
function updateSites(s,dt){
 if(s.stage==='boss')return;
 for(const site of s.sites){
  if(site.id==='supply-b'&&site.state==='waiting'){site.baseX??=site.x;site.x=site.baseX+Math.sin(s.t*.35)*55;}
  const dock=s.operation?.region===2&&site.id==='port-landing'&&site.gantry===true;
  if(dock&&s.stage!=='field')continue;
  const garrison=s.operation?.region===1?railGarrison(site):null,wire=wireGarrison(s,site);
  const approach=dock?PORT_LANDING:garrison||wire||coastApproach(site);
  if(site.coastApproach&&s.sites[0].state!=='done'&&!site.preempt&&!s.stats.coastPreempt)continue;
  if(site.state==='waiting'&&distance(site,s.player)<(approach?.range??215)){
   const rescue=isSalvageCampaign(s)&&site.opening;
   const guards=site.preempt&&site.coastApproach==='f'?COAST_PREEMPT_ESCORT:approach?.guards;
   const count=guards?.length??(site.kind==='relay'?3:site.kind==='armory'?5:s.operation?.region===0?4:6),reserve=alive(s).length+count-160;
   if(reserve>0){const remove=new Set(alive(s).filter(e=>!e.siteId&&(!s.operation||e.cohort==='ambient')&&!s.challenge?.targets?.includes(e.id)&&distance(e,s.player)>280).sort((a,b)=>distance(b,s.player)-distance(a,s.player)).slice(0,reserve).map(e=>e.id));s.enemies=s.enemies.filter(e=>!remove.has(e.id));}
   if(alive(s).length+count>160)continue;
   site.state='active';
   if(carriesCoastSalvage(s)&&s.operation.region===1&&garrison&&!s.stats.railFirstSite)s.stats.railFirstSite=site.id;
   const mirrored=(dock||wire)&&site.x>800||garrison&&mapSeed(s.seed,1)%2===0;
   const cohort=garrison?'rail-guard':wire?'wire-guard':site.coastApproach?'coast-guard':null;
   for(let i=0;i<count;i++){
    const angle=i*TAU/6;
    const guard=site.kind==='armory'&&i===0?'officer':i===1&&!site.opening?'shield':'rifle';
    const [type,x,y,hp]=guards?guards[i]:[guard,Math.cos(angle)*85,Math.sin(angle)*65];
    const extra={...(cohort?{cohort}:{}),...(hp?{hp,maxHp:hp}:{})};
    if(s.operation?.region===1&&carriesCoastSalvage(s)&&site.id==='rail-cache'&&site.guardPlan==='spread')extra.railWing=Number((mirrored?-x:x)>0);
    if(rescue&&s.operator!=='marco'&&(i===0||i===3))extra.coastCarrier=true;
    if(isSalvageCampaign(s)&&site.preempt&&type==='shield'&&s.operator==='marco')extra.coastArmor=true;
    if(wire&&type==='mortar')extra.timer=.8;
    if(site.coastPlan==='split'&&site.coastApproach==='f')extra.coastWing=Math.sign(x);
    if(site.coastApproach==='r'&&approach.firstSalvo){
     const near=(s.player.x<=site.x)===(x<0);
     extra.timer=approach.firstSalvo[near?0:1];
    }
    spawnEnemy(s,type,site.x+(mirrored?-x:x),site.y+y,site.id,extra);
   }
   if(rescue&&s.operator==='marco'){
    const guard=spawnEnemy(s,'shield',site.x+Math.sign(site.x-800)*85,site.y,null,
     {coastArmor:true,coastRescueShield:true,aim:Math.PI/2,hp:20,maxHp:20});
    if(guard)clearCoastOverlap(s,guard,guard.r,{x:site.x,y:site.y});
   }
   emit(s,'engage',site.x,site.y);
  }
  if(site.kind==='relay'&&site.state==='active'&&distance(site,s.player)<125){
   if(!relayCrewLeft(s,site))site.progress=Math.min(5,site.progress+dt);
  }
  if(site.state==='active'&&(site.kind==='relay'?site.progress>=5:!s.enemies.some(e=>!e.dead&&e.siteId===site.id))){site.state='ready';s.stats.sitesCleared=(s.stats.sitesCleared||0)+1;s.stats.score+=400;emit(s,'supply-ready',site.x,site.y,{life:.8});}
  if(site.state==='ready'&&distance(site,s.player)<SITE_PICKUP_RANGE){
   if(site.coastApproach==='r'&&s.effects.some(f=>f.type==='coast-volley'&&f.age<COAST_MORTAR.volleyBeat))continue;
   const preempt=coastPreemptSite(s)===site&&site.preempt===true;
   site.state='done';
   if(s.operation?.region===0&&s.operation.order==='wire'&&site.id==='arsenal'){
    s.operation.orderDone=true;
    emit(s,'supply-ready',site.x,site.y,{text:wire?'교신 암호 확보 · 철도 조준 유인':'전파 절단 · 귀환 시 지령 보상',life:1.4});
   }
   if(dock){
    s.operation.portDock=true;
    emit(s,'port-hatch',site.x,site.y,{text:'측면 해치 개방 · 작전도에 통로 표시',life:1.6});
    return;
   }
   if(site.kind==='control'||site.kind==='relay'&&s.operation?.region===1)openChoice(s,'control',frontControlCards(s),site.name);
   else if(site.kind==='armory'){const quality=rollQuality(s,'normal');openChoice(s,'armory',armoryCards(s,quality),site.name,{quality,siteId:site.id});}
   else if(site.id==='rail-cache'&&s.operation?.region===1)openChoice(s,'rail-workshop',railWorkshopPlan(s).cards,site.name);
   else openChoice(s,'supply',supplyCards(s,site,preempt),site.name,site.opening&&!s.stats.coastPreempt?{opening:true}:site.coastApproach||site.opening?{siteId:site.id,...(preempt?{preempt:true}:{})}:{});
   return;
  }
 }
}
function startRaid(s,contract){
 if(s.phase!=='choice'||s.choice.type!=='armory'||s.raidUsed||!RULES.raidContracts[contract]||s.challenge?.state==='active')return false;
 const cfg=RULES.raidContracts[contract],route=raidRoute(s,contract),[start,next]=route;
 const aim=Math.atan2(next.y-start.y,next.x-start.x);
 s.raidUsed=true;s.raid={state:'active',contract,progress:0,maxProgress:cfg.routeLength,route,segment:0,quality:rollQuality(s,cfg.qualityKey),wager:snapshot(s.choice),wagerCards:clone(s.choices),target:{id:'courier',type:'courier',...start,r:35,hp:cfg.hp,maxHp:cfg.hp,aim,dead:false}};
 const escorts=[];
 for(const [type,count]of Object.entries(cfg.escort))for(let i=0;i<count;i++){
  for(let attempt=0;attempt<24;attempt++){
   const angle=rng(s,'combat')*TAU,radius=75+rng(s,'combat')*87;
   const q={x:start.x+Math.cos(angle)*radius,y:start.y+Math.sin(angle)*radius};
   if(q.x<FIELD.left+25||q.x>FIELD.right-25||q.y<FIELD.top+25||q.y>FIELD.bottom-25||blocked(s,q.x,q.y,25)||distance(s.player,q)<105||escorts.some(e=>distance(e,q)<48))continue;
   const escort=spawnEnemy(s,type,q.x,q.y,null,{cohort:'raid'});
   if(escort)escorts.push(escort);
   break;
  }
 }
 s.phase='playing';s.choice=null;s.choices=[];emit(s,'raid-start',route[0].x,route[0].y,{life:1.2});return true;
}
function updateRaid(s,dt){
 const raid=s.raid;if(!raid||raid.state!=='active')return;const cfg=RULES.raidContracts[raid.contract];raid.progress+=cfg.speed*dt;
 if(raid.progress>=raid.maxProgress){raid.state='failed';s.stats.raidFailed++;emit(s,'raid-failed',s.player.x,s.player.y,{text:'수송대 이탈 · 건 상자 소실',life:1.5});return;}updateBurn(s,raid.target,dt);if(raid.state!=='active')return;
 const {segment,fraction}=raidCursor(raid),a=raid.route[segment],b=raid.route[segment+1];
 raid.segment=segment;
 raid.target.x=a.x+(b.x-a.x)*fraction;raid.target.y=a.y+(b.y-a.y)*fraction;
 raid.target.aim=Math.atan2(b.y-a.y,b.x-a.x);
 const {x,y,r}=raid.target,amount=cfg.contactDamage;
 if(amount&&raidOnNose(s)&&distance(s.player,raid.target)<r+16)s.hitCandidate={amount,x,y};
}
function withdrawRaid(s){
 if(s.raid?.state!=='active')return false;
 s.raid.state='withdrawn';s.stats.raidFailed++;return true;
}
function spawnShowcaseWave(s,pulse,showcase,remaining){
 const p=s.player,crowd=alive(s);
 const flame=showcase==='flame';
 const fan=showcase==='rocket'&&isSalvageCampaign(s)&&s.weapons.some(w=>w.evolved&&isCapturedTurret(w));
 const trail=flame&&s.stage!=='boss'&&s.weapons.find(isTrailInferno);
 const wake=trail&&s.zones.filter(z=>z.source==='wake'&&z.owner===trail.uid&&z.life>.55&&distance(p,z)>=58&&distance(p,z)<170&&!lineBlocked(s,p,z))
  .sort((a,b)=>distance(p,b)-distance(p,a))[0];
 const approach=s.stage==='boss'?Math.atan2(p.y-s.boss.y,p.x-s.boss.x):wake?Math.atan2(wake.y-p.y,wake.x-p.x):p.aim;
 const pair=flame?[[0,190],[0,264]]:fan?[[-.29,218],[.29,218]]:[[-.34,205],[.48,248]];
 const spread=fan?[[-.4,232],[0,232],[.4,232]]:[[-.75,208],[.1,224],[.93,242]];
 const plans=!flame&&remaining-(pulse-1)*8>=12?[spread,pair]:[pair];
 const canDeployMortar=s.operation&&s.stage==='field'&&showcase==='fusion'&&!s.stats.conduitMortarDeployed&&s.weapons.some(isConductiveFusion);
 const fits=q=>q.x>=65&&q.x<=1535&&q.y>=65&&q.y<=1135&&distance(p,q)>=155&&!blocked(s,q.x,q.y,22)
  &&!lineBlocked(s,p,q)&&(!s.boss.active||distance(q,s.boss)>=s.boss.r+28)&&!crowd.some(e=>distance(q,e)<32);
 for(const lanes of plans){
  const count=lanes.length*4;
  if(crowd.length+count>160)continue;
  // Try the original eight directions first, then look between them for open ground.
  for(let i=0;i<16;i++){
   const heading=approach+(i%8+(i<8?0:.5))*TAU/8;
   const centers=lanes.map(([offset,reach])=>({x:p.x+Math.cos(heading+offset)*reach,y:p.y+Math.sin(heading+offset)*reach}));
   const cos=flame?Math.cos(heading):1,sin=flame?Math.sin(heading):0;
   const packs=centers.map(({x,y})=>[[-18,-20],[18,-20],[-18,20],[18,20]].map(([dx,dy])=>({x:x+dx*cos-dy*sin,y:y+dx*sin+dy*cos})));
   if(centers.some((q,j)=>j>0&&lineBlocked(s,centers[j-1],q))||!packs.flat().every(fits))continue;
   let mortar=null;
   if(canDeployMortar&&packs.length===3){
    const [offset,reach]=lanes[2],a=heading+offset;
    const point={x:p.x+Math.cos(a)*(reach+CONDUIT_MORTAR.setback),y:p.y+Math.sin(a)*(reach+CONDUIT_MORTAR.setback)};
    if(fits(point)&&centers.slice(0,2).some(center=>distance(center,point)<CONDUIT_MORTAR.relayReach&&!lineBlocked(s,center,point))){
     mortar=point;packs[2][3]=point;
    }
   }
   const formationHeading=heading+Math.PI;
   for(let group=0;group<packs.length;group++)for(const q of packs[group]){
    const extra={cohort:'ambient',showcase,formationHeading,...(flame?{}:{waveGroup:pulse*4+group,wavePulse:pulse})};
    if(q!==mortar){spawnEnemy(s,'rifle',q.x,q.y,null,extra);continue;}
    const gun=spawnEnemy(s,'mortar',q.x,q.y,null,{...extra,timer:2.8});
    const {warning:duration,radius:r}=CONDUIT_MORTAR;
    s.hazards.push({x:p.x,y:p.y,r,timer:duration,duration,age:0,conduitGun:gun.id,fromX:gun.x,fromY:gun.y});
    s.stats.conduitMortarDeployed=true;
    emit(s,'warning',p.x,p.y,{r,life:duration});
    emit(s,'mortar-fire',gun.x,gun.y,{life:.21});
   }
   for(const q of centers)emit(s,'formation',q.x,q.y,{life:.75,showcase,angle:formationHeading});
   return count;
  }
 }
 return 0;
}
export const showcaseWindow=s=>s.stage!=='boss'||s.boss.mode==='recover'||s.boss.cycle===0&&s.boss.mode==='aim';
function updatePowerWave(s,dt){
 const wave=s.powerWave;if(!wave)return;
 const showcase=wave.paired>0&&wave.showcase;
 if(s.stage==='boss'&&(!showcase||!showcaseWindow(s)))return;
 if(wave.delay>0){wave.delay-=dt;return;}
 wave.clock-=dt;if(wave.clock>0)return;
 if(wave.paired>0){
  const count=wave.remaining>=8?spawnShowcaseWave(s,wave.paired,wave.showcase,wave.remaining):0;
  if(count)wave.remaining-=count;
  else{
   if(!wave.retried){wave.retried=true;wave.clock=.25;return;}
   const before=wave.remaining;
   for(let i=0;i<8&&wave.remaining>0;i++)if(spawnAround(s,'rifle',{cohort:'ambient'},360))wave.remaining--;
   if(wave.remaining===before){wave.clock=.25;return;}
  }
  delete wave.retried;
  wave.paired--;wave.clock=wave.paired===1?1.55:.9;
 }else{
  wave.clock=.4;for(let i=0;i<4&&wave.remaining>0;i++)if(spawnAround(s,'rifle',{},360))wave.remaining--;
 }
 if(wave.remaining<=0)s.powerWave=null;
}
function pursuitReward(s){
 if(s.operation.region<2){
  const parts=holdoutParts(s.seed,s.operation.region).map(key=>{
   const kit=FRONT_SUPPORTS[key];
   return{id:`support:${key}`,kind:'front-support',key,title:kit.name,desc:kit.impact,label:`희귀 부품 · ${kit.role}`};
  });
  return [...parts,{id:'resupply:pursuit-mixed',kind:'resupply',title:'후방 응급 보급',heal:28,charge:35,label:'지금 회복'}];
 }
 return [
  {id:'pursuit:cargo',kind:'cargo',title:'통신 화물',label:'정산 크레딧'},
  {id:'resupply:pursuit-mixed',kind:'resupply',title:'후송 구급낭',heal:36,charge:45,label:'귀환까지 생존'}
 ];
}
function challengeObjectiveDone(s,challenge,dt){
 if(challenge.type==='defend'){
  if(s.player.hp<=0)return false;
  const round=challenge.safeTransmission&&relayDefenseRound(s);
  if(challenge.progress>=challenge.duration)return !round;
  if(distance(s.player,DEFENSE_ZONE)>DEFENSE_ZONE.r)return false;
  if(!round||distance(s.player,round)>=blastContactRadius(round))challenge.progress=Math.min(challenge.duration,challenge.progress+dt);
  if(challenge.progress>=challenge.duration)return !round;
  challenge.strike-=dt;
  if(challenge.strike<=0){
   const {x,y}=s.player;
   const {radius:r,warning:duration,interval}=RELAY_SHELL;
   s.hazards.push({x,y,r,timer:duration,duration,...(challenge.safeTransmission?{relayDefense:true}:{})});
   challenge.strike=interval;
   if(challenge.safeTransmission)emit(s,'warning',x,y,{r,life:duration});
  }
  return false;
 }else if(challenge.type==='intercept'){
  const target=challenge.target;
  updateBurn(s,target,dt);
  if(target.hp>0){
   challenge.timeLeft=Math.max(0,challenge.timeLeft-dt);
   Object.assign(target,signalPosition(challenge.lane,challenge.timeLeft));
   if(challenge.timeLeft===0){
    challenge.state='failed';
    if(challenge.recoverCargo)s.stats.signalOutcome='escaped';
    emit(s,'challenge-failed',s.player.x,s.player.y,{text:'통신 차량 이탈 · 재도전 가능',life:1.6});
   }
   return false;
  }
 }else if(challenge.type==='battery')return challenge.destroyed.length===challenge.targets.length;
 else if(challenge.targets.some(id=>s.enemies.some(e=>e.id===id&&!e.dead)))return false;
 return true;
}
function updateChallenge(s,dt){
 const challenge=s.challenge;
 if(challenge?.state!=='active')return;
 const tier=challenge.tier||1;
 if(!challenge.secured){
  if(!challengeObjectiveDone(s,challenge,dt))return;
  challenge.secured=true;
  if(challenge.recoverCargo){
   const {x,y}=challenge.target;
   emit(s,'signal-down',x,y,{text:'차량 정지 · 잔해에서 화물 회수',life:1.4});
  }
 }
 if(signalCargo(s))return;
 if(s.operation?.region<2&&tier===1&&(s.operation.holdoutKills||0)<HOLDOUT.rareKills)return;
 completeChallenge(s,challenge,tier);
}
function completeChallenge(s,challenge,tier){
 challenge.state='complete';
 delete challenge.reserveAt;
 s.stats.challenge=Math.max(s.stats.challenge,tier);s.stats.challengeWins=(s.stats.challengeWins||0)+1;
 if(challenge.type==='battery'){
  s.stats.portBatteriesCleared=(s.stats.portBatteriesCleared||0)+challenge.targets.length;
  if(tier===2&&isSalvageCampaign(s))s.stats.portCounterbatteryCargo=true;
 }
 if(s.operation){
  s.operation.challengeTier=tier;
  if(tier===1&&s.player.hp>0){
   s.player.invuln=Math.max(s.player.invuln,.5);
   openChoice(s,'pursuit-reward',pursuitReward(s),`${holdoutContract(s,tier).name} 완료 · 보급 한 가지 선택`,s.operation.region<2?{quality:'rare'}:{});
  }
 }
 s.stats.score+=500*tier;
 const text=challenge.type==='battery'&&tier===2&&s.stats.portCounterbatteryCargo?'포격 진지 제압 · 귀환해 노획품 반출':`잔류 도전 ${tier} 완료 · +${500*tier}`;
 emit(s,'challenge-clear',s.player.x,s.player.y,{text,life:1.5});
}

export function canStartChallenge(s){
 if(coastSalvage(s)&&!isSalvageCampaign(s)||s.stage!=='holdout'||s.player.hp<=0||s.raid?.state==='active'||s.challenge?.state==='active'||s.challenge&&!s.operation)return false;
 const type=holdoutContract(s).id;
 const incoming=type==='hunt'?2:type==='battery'?4:freshSignalEscort(s)?SIGNAL_ESCORT_COUNT:0;
 return !incoming||alive(s).length+incoming<=160;
}
const freshSignalEscort=s=>s.operation?.region===2&&!s.operation.challengeTier&&!s.challenge?.recoverCargo;
function deploySignalEscort(s,lane){
 for(const {type,x,y} of signalEscortPlan(lane)){
  // A field call can be made from the route itself. Keep arrivals outside contact range.
  const point=[{x,y},{x,y:y+105},{x,y:y-105}].find(p=>distance(p,s.player)>=96&&!blocked(s,p.x,p.y,24)
   &&!s.enemies.some(e=>!e.dead&&e.cohort==='signal-guard'&&distance(e,p)<40));
  if(point)spawnEnemy(s,type,point.x,point.y,null,{cohort:'signal-guard',timer:type==='mortar'?1.45:1.8});
 }
}
export function canCallGateChallenge(s){
 return !!s.operation&&s.phase==='choice'&&s.choice?.type==='clear'&&canStartChallenge(s)
  &&interaction({...s,phase:'playing'})?.id==='extract';
}
function startChallenge(s){
 if(!canStartChallenge(s))return false;
 const tier=(s.operation?.challengeTier||0)+1;
 const contract=holdoutContract(s);
 if(contract.id==='defend'){
  s.challenge={type:'defend',state:'active',tier,progress:0,strike:.8,duration:defenseSeconds(tier),safeTransmission:true};
  const reserveAt=s.holdTime+HOLDOUT.railReserveDelay;
  if(isSalvageCampaign(s)&&tier===1&&reserveAt<HOLDOUT.grace)s.challenge.reserveAt=reserveAt;
 }else if(contract.id==='battery'){
  const hp=Math.round(920*1.16**Math.min(16,(tier-2)/2));
  const targets=portBatteryPositions(s.seed).map(({x,y},index)=>{
   const gun=spawnEnemy(s,'mortar',x,y,null,{hp,maxHp:hp,cohort:'port-battery',timer:1.25+index*.75});
   spawnEnemy(s,'shield',x,y+54,null,{cohort:'battery-guard'});
   return gun.id;
  });
  s.challenge={type:'battery',state:'active',tier,targets,destroyed:[]};
 }else if(contract.id==='intercept'){
  const hp=Math.round(1050*1.22**Math.min(24,tier-1));
  const lane=signalLane(s.seed),timeLeft=SIGNAL_SECONDS;
  if(freshSignalEscort(s))deploySignalEscort(s,lane);
  if(tier===1)delete s.stats.signalOutcome;
  s.challenge={type:'intercept',state:'active',tier,lane,timeLeft,...(tier===1?{recoverCargo:true}:{}),
   target:{id:'signal',type:'courier',...signalPosition(lane,timeLeft),r:34,hp,maxHp:hp,dead:false}};
 }else{
  const ids=[],hp=Math.round(450*1.22**Math.min(24,tier-1));
  const oldId=s.id,oldCombat=s.rng.combat;
  for(const dx of [-220,220]){
   const kit={hp,maxHp:hp,cohort:'challenge'},x=clamp(s.player.x+dx,100,1500),y=clamp(s.player.y-240,100,1100);
   const enemy=blocked(s,x,y,26)?spawnAround(s,'officer',kit,null,50):spawnEnemy(s,'officer',x,y,null,kit);
   if(enemy)ids.push(enemy.id);
  }
  if(ids.length<2){s.enemies=s.enemies.filter(e=>!ids.includes(e.id));s.id=oldId;s.rng.combat=oldCombat;return false;}
  s.challenge={type:'hunt',state:'active',tier,targets:ids};
  const reserveAt=s.holdTime+HOLDOUT.coastReserveDelay;
  if(s.operation?.region===0&&tier===1&&reserveAt<HOLDOUT.grace)s.challenge.reserveAt=reserveAt;
 }
 emit(s,'challenge-start',s.player.x,s.player.y,{text:`${contract.name} · D${tier}`,life:1.25});
 return true;
}

export function interaction(s){
 if(s.phase!=='playing'||s.player.hp<=0)return null;
 if(railDecoyReady(s))return {id:'rail-decoy',label:railHasRelay(s)?'조준 유인':'암호로 조준 유인'};
 const preempt=coastPreemptSite(s);
 if(preempt?.state==='waiting'&&!preempt.preempt&&distance(s.player,preempt)<COAST_PREEMPT_RANGE&&!lineBlocked(s,s.player,preempt))
  return {id:'coast-preempt',site:preempt,label:`기습 · ${GUNS[preempt.coastApproach].short} L${COAST_SALVAGE_LEVEL} 노획`};
 const gantry=portGantry(s),partStaging=portPartStaging(s);
 if(gantry&&distance(s.player,gantry)<64)return{id:'boss',gantry,blocked:s.raid?.state==='active',label:'측면 해치 · 기습 진입'};
 if(partStaging&&distance(s.player,partStaging)<partStaging.r)
  return {id:'boss',partStaging,blocked:s.raid?.state==='active',label:`${partStaging.name}에서 교전`};
 if(s.stage==='field'&&distance(s.player,BOSS_ENTRY)<BOSS_ENTRY.r){
  const coast=s.operation?.region===0;
  if(!coast||distance(s.player,s.boss)>=s.boss.r+24){
   return {id:'boss',blocked:s.raid?.state==='active',label:coast?'여기서 교전 개시':partStaging?'정면에서 교전':`${s.operation?region(s).boss:'장갑 수송차'} 도전`};
  }
 }
 const gate=exitGate(s);
 const wreck=coastSalvageWreck(s);
 if(wreck&&coastSalvage(s).turret==='intact'&&distance(s.player,wreck)<=COAST_SALVAGE.reach)
  return {id:'secure-turret',label:'포탑 분리 시작'};
 if(gate&&distance(s.player,gate)<(s.operation?92:140))return{id:'extract',label:isSalvageCampaign(s)&&s.operation.region===1?'귀환 · 전진 선택':canAdvanceFront(s)?'전진 · 잔류 선택':'귀환 선택'};
 const cargo=signalCargo(s);
 return cargo&&distance(s.player,cargo)<=SIGNAL_CARGO_REACH&&!lineBlocked(s,s.player,cargo)?{id:'signal-cargo',label:'통신 화물 회수'}:null;
}
function focusWeakPoint(s,target){
 const b=s.boss,front=s.operation?.region;
 if(b.mode!=='recover')return false;
 if(target.type==='part')return true;
 if(target!==b)return false;
 if(front>0)return b.parts.every(p=>p.hp<=0)||portCoreDisrupted(s);
 const angle=Math.atan2(s.player.y-b.y,s.player.x-b.x);
 return Math.cos(angle-b.body)<COAST_CHARGE.rearDot;
}
export function focusPlan(s,input,candidates){
 // The support strike resolves before Marco fires and can remove the last armor plate.
 if(!candidates&&portAidCounterTarget(s)){
  s=snapshot(s);
  fireHarborAidCounter(s);
 }
 const p=s.player,lane=focusLane(s,aimFromInput(input,p.moveAim)),hits=[];
 for(const enemy of candidates??targets(s,undefined,false)){
  const point=enemy.type==='part'?partPosition(s,enemy):enemy;
  const x=point.x-p.x,y=point.y-p.y,depth=x*lane.dx+y*lane.dy,side=Math.abs(x*lane.dy-y*lane.dx);
  if(enemy.hp>0&&depth>0&&depth<=lane.length&&side<=lane.width+enemy.r&&!lineBlocked(s,p,point)){
   const roleWeak=coastAtShore(s)&&s.operator==='marco'&&enemy.type==='shield'&&!shieldFaces(enemy,p)&&coastGrowthEnemy(s,enemy);
   hits.push({enemy,point,depth,side,weak:focusWeakPoint(s,enemy),...(roleWeak?{roleWeak:true}:{})});
  }
 }
 const isArmor=hit=>hit.enemy.type==='boss'||hit.enemy.type==='part';
 const armor=hits.filter(isArmor).sort((a,b)=>Number(b.weak)-Number(a.weak)||a.side-b.side||a.depth-b.depth)[0];
 const impacts=hits.filter(hit=>!isArmor(hit)||hit===armor).sort((a,b)=>a.depth-b.depth).slice(0,skillRules(s).targets);
 return {lane,impacts};
}
function fireFocus(s,cfg,input){
 const p=s.player,{lane,impacts}=focusPlan(s,input,targets(s));
 p.moveAim=lane.angle;
 s.stats.focusUses=(s.stats.focusUses||0)+1;
 s.stats.focusHits=(s.stats.focusHits||0)+impacts.length;
 s.stats.focusWeakHits=(s.stats.focusWeakHits||0)+impacts.filter(hit=>hit.weak||hit.roleWeak).length;
 p.attack=.14;p.aim=lane.angle;
 const coast=coastSalvage(s),growth=coast?1+coastRoleBonus(s.operator,coastRoleRank(coast)):1;
 for(const {enemy,weak} of impacts){
  const screened=enemy===s.raid?.target&&raidOnNose(s,Math.atan2(-lane.dy,-lane.dx));
  damage(s,enemy,cfg.damage*growth*(weak?cfg.weakMultiplier:1)*(screened?RULES.raidContracts.armored.bulletFrontMultiplier:1),'bullet','focus');
  emit(s,'pierce',enemy.x,enemy.y,{angle:lane.angle,life:.17});
 }
 emit(s,'focus-shot',p.x,p.y,{angle:lane.angle,length:lane.length,width:lane.width,life:.22,text:impacts.some(hit=>hit.weak||hit.roleWeak)?'관통 사격 · 약점 직격':undefined});
}
export function action(s,kind,input){
 if(kind.startsWith('raid:'))return startRaid(s,kind.split(':')[1]);
 if(kind==='withdraw'){if(!withdrawRaid(s))return false;emit(s,'raid-failed',s.player.x,s.player.y,{text:'습격 철수 · 상자 소실',life:1.2});return true;}
 if(kind==='gate-upgrade'||kind==='gate-assemble'){
  const prep=gatePreparation(s);
  if(kind==='gate-upgrade'&&prep?.upgrades){openLevel(s,{gatePrep:true});return true;}
  if(kind==='gate-assemble'&&prep?.capstones.length){openAssembly(s,prep.capstones,true);return true;}
  return false;
 }
 if(kind==='gate-challenge'){
  if(!canCallGateChallenge(s)||!startChallenge(s))return false;
  closeChoice(s);return true;
 }
 if(s.phase!=='playing')return false;const p=s.player;
 if(kind==='upgrade'){if(!canOpenLevel(s))return false;openLevel(s);return true;}
 if(kind==='gear'){openAssembly(s,assemblyOptions(s));return true;}
 if(kind==='dash'){
  if(p.dashCd>0)return false;
  const b=s.boss;
  delete p.portRush;delete p.portCutX;
  if(s.operation?.region===2&&s.operation.support==='overrun'&&b.active&&!b.dead){
   if(distance(p,b)>portCoreReach(s))p.portRush=true;
   else p.portCutX=p.x;
  }
  p.dash=.18;p.dashCd=2;p.invuln=Math.max(p.invuln,.30);delete p.emberDashSpent;
  if(p.maneuver==='assault')p.assaultTime=1.25;
  emit(s,'dash',p.x,p.y,{angle:p.aim,life:.2});return true;
 }
 if(kind==='skill'){
  if(!canUseSkill(s))return false;
  if(portAidCounterReady(s))fireHarborAidCounter(s);
  const cfg=skillRules(s);p.charge-=cfg.cost;p.skillCd=cfg.cooldown;
  if(s.operator==='marco')fireFocus(s,cfg,input);
  else{p.overdrive=cfg.duration;emit(s,'skill',p.x,p.y,{text:'전탄 보급',life:.7});}
  return true;
 }
 if(kind==='challenge')return startChallenge(s);
 if(kind==='interact'){
  const item=interaction(s);if(!item||item.blocked)return false;
  if(item.id==='coast-preempt'){item.site.preempt=true;return true;}
  if(item.id==='secure-turret'){
   const coast=coastSalvage(s);
   coast.turret='securing';
   for(const type of ['shield','rifle','rifle','mortar','rifle','rifle'])spawnAround(s,type,{cohort:'holdout'},315);
   emit(s,'formation',s.boss.x,s.boss.y,{life:1.25,text:'포탑 분리 개시 · 해안 증원 접근'});
   return true;
  }
  if(item.id==='extract'){if(s.operation)openChoice(s,'clear',exitCards(s),'열린 출구');else finish(s,true);return true;}
  if(item.id==='signal-cargo'){s.stats.signalOutcome='recovered';completeChallenge(s,s.challenge,s.challenge.tier);return true;}
  if(item.id==='rail-decoy'){
   const cycle=s.boss.cycle+1;
   s.boss.railDecoy={...railBarrageAim(s,cycle),cycle};
   s.stats.railDecoys=1;
   if(!railHasRelay(s)&&railHasWire(s))s.stats.wireDecoy=1;
   emit(s,'rail-decoy',p.x,p.y,{life:.55});
   return true;
  }
  if(coastAtShore(s)){
   openChoice(s,'coast-boss',[
    {id:'coast:break',kind:'coast-boss',title:'포탑부터 파괴',desc:'포탑을 먼저 조준합니다. 파괴하면 수송차의 부채꼴 탄막이 5발에서 3발로 줄어듭니다.',label:'안전한 돌파'},
    {id:'coast:capture',kind:'coast-boss',title:'포탑을 살려 노획',desc:`차체만 조준합니다. 증원 속에서 포탑을 반출하면 +${COAST_SALVAGE.credits}C와 부채꼴 시작 무장을 얻습니다.`,label:'노획 보상'}
   ],'장갑 수송차 교전');
   return true;
  }
  return beginBoss(s,item);
 }
 return false;
}
function beginBoss(s,item={}){
 const p=s.player;
 if(item.gantry)s.operation.portEntry='gantry';
 const dock=s.operation?.region===2&&s.sites.find(site=>site.id==='port-landing');
 if(dock?.state==='active')dock.state='waiting';
 s.stage='boss';s.refits=0;s.boss.active=true;s.boss.mode='aim';s.boss.timer=1.3;
 if(s.operation?.region!==0&&!item.partStaging){
  const arrival=item.gantry||(s.operation?.region===2?PORT_CENTER:{x:800,y:470});
  p.x=arrival.x;p.y=arrival.y;
  }
 if(!(s.operation?.region>0))clearCoastOverlap(s,p,16,{x:BOSS_ENTRY.x,y:BOSS_ENTRY.y});
 p.invuln=Math.max(p.invuln,1);
 s.enemies=s.enemies.filter(e=>(!e.dead&&(e.showcase||e.siteId)||distance(e,s.boss)<400)&&(!dock||e.siteId!==dock.id));
 s.enemyShots=[];s.hazards=[];
 if(item.partStaging)recordHarborPayoff(s,'stagedEntry');
 if(item.gantry)emit(s,'port-ambush',800,250,{text:'측면 기습 · 포탑 사선 확보',life:1.3});
 else emit(s,'boss-arrival',800,250,{life:1.3});
 return true;
}
export function finish(s,won=false,reason='retreat'){
 if(s.phase==='result')return false;won=!!won&&s.stats.bossKilled&&(!s.operation||s.operation.cleared===3&&s.operation.extracted===true)&&s.player.hp>0;if(won&&!s.stats.extractionPaid){s.stats.score+=3000;s.stats.extractionPaid=true;}
 withdrawRaid(s);
 if(s.challenge?.state==='active'){
  if(s.challenge.recoverCargo)s.stats.signalOutcome=s.challenge.secured?'left-cargo':'aborted';
  s.challenge.state='withdrawn';
  delete s.challenge.reserveAt;
 }
 s.phase='result';s.result={runId:s.runId||null,...(s.operator?{operator:s.operator}:{}),balanceRevision:s.balanceRevision||'b05-campaign',won,reason:won?'prototype-complete':s.player.hp<=0?'prototype-failed':reason,seed:s.seed,seconds:s.t,score:s.stats.score,level:s.level,weapons:clone(s.weapons),modules:clone(s.modules),stats:clone(s.stats),...(s.operation?{operation:clone(s.operation)}:{})};s.choice=null;s.choices=[];return true;
}
function spawnCoastResponse(s,spawn){
 const gun=s.stats.coastPreempt,plan=COAST_RESPONSE[gun];
 if(!plan||s.stats.coastResponse||s.stage!=='field'||s.t>=s.openingFireUntil||s.raid?.state==='active')return 0;
 const p=s.player,crowd=alive(s);
 if(crowd.length+plan.guards.length>160)return 0;
 const side=p.x<800?1:-1;
 const lead=gun==='r'&&coastLead(s);
 const inland=-Math.PI/2+side*.32;
 const headings=[0,-.32,.36,-.7,.68,-1.08,1,-1.44,1.32,-1.82].map(offset=>inland+side*offset);
 if(lead){
  const route=Math.atan2(lead.y-p.y,lead.x-p.x),turn=lead.x<p.x?1:-1;
  headings.unshift(route,route+turn*.3,route+turn*.58);
 }
 for(const a of headings){
  const dx=Math.cos(a),dy=Math.sin(a);
  if(gun==='r'&&dy>.15)continue;
  for(const reach of gun==='r'?[plan.reach,280,316]:[plan.reach]){
   const pack=plan.guards.map(([type,along,across])=>({type,x:p.x+dx*(reach+along)-dy*across,y:p.y+dy*(reach+along)+dx*across}));
   if(pack.some(q=>q.x<65||q.x>1535||q.y<65||q.y>1135||blocked(s,q.x,q.y,22)||lineBlocked(s,p,q)||crowd.some(e=>distance(e,q)<29)))continue;
   for(const q of pack)spawn(q.type,q,{coastResponse:gun,...(q.type==='mortar'?{timer:1.15}:{})});
   s.stats.coastResponse=gun;
   emit(s,'formation',p.x+dx*reach,p.y+dy*reach,{life:.65,showcase:gun==='f'?'flame':'rocket',angle:a+Math.PI});
   return pack.length;
  }
 }
 return 0;
}
function updateCampaignAmbient(s,dt){
 const cfg=RULES.campaignDirector,index=s.operation.region;s.director??={pack:0,officerClock:cfg.officerInterval[index]};const director=s.director;
 const ambient=type=>alive(s).filter(e=>e.cohort==='ambient'&&e.type===type).length;
 const spawn=(type,point,extra)=>{const e=point?spawnEnemy(s,type,point.x,point.y,null,{cohort:'ambient',...extra}):spawnAround(s,type,{cohort:'ambient'});if(e){s.stats.directorSpawns??={rifle:0,shield:0,mortar:0,officer:0};s.stats.directorSpawns[type]++;}return e;};
 s.spawnClock-=dt;if(s.spawnClock<=0){
  s.spawnClock=cfg.packInterval;director.pack++;
  const special=index>0||s.pressure>0?(director.pack%2?'shield':'mortar'):null,count=Math.min(cfg.packCap,cfg.basePack[index]+s.pressure);
  const response=index===0?spawnCoastResponse(s,spawn):0;
  for(let i=response;i<count;i++){const type=i===0&&special&&ambient(special)<cfg.ambientCaps[special]?special:'rifle';spawn(type);}
 }
 director.officerClock-=dt;if(director.officerClock<=0){director.officerClock=cfg.officerInterval[index];if((index>0||s.pressure>1)&&ambient('officer')<cfg.ambientCaps.officer){const e=spawn('officer');if(e)emit(s,'officer-arrival',e.x,e.y,{text:'장교 증원 · 부채 사격 주의',life:.9});}}
 if(s.pressure>=4){s.pursuitClock=(s.pursuitClock??1)-dt;if(s.pursuitClock<=0){s.pursuitClock=Math.max(4,18-s.pressure);if(!alive(s).some(e=>e.cohort==='pursuit')){const hp=300*Math.pow(1.12,s.pressure-3);spawnAround(s,'officer',{hp,maxHp:hp,cohort:'pursuit'});}}}
}
function updateHoldout(s,dt){
 const pressure=holdoutTier(s.holdTime),challenge=s.challenge;
 const early=pressure===0&&challenge?.state==='active'&&challenge.reserveAt<=s.holdTime;
 if(!pressure&&!early)return;
 const tier=Math.max(1,pressure);
 s.spawnClock-=dt;
 if(s.spawnClock>0)return;
 s.spawnClock=Math.max(.9,2.1-tier*.2);
 if(challenge)delete challenge.reserveAt;
 const count=8+s.operation.region*2+tier*3;
 const reinforcements=alive(s).filter(e=>e.cohort==='holdout');
 const officers=reinforcements.filter(e=>e.type==='officer').length;
 const mortars=reinforcements.filter(e=>e.type==='mortar').length;
 for(let i=0;i<count&&reinforcements.length+i<150;i++){
  const type=i===0&&tier>=3&&officers<Math.min(4,tier-1)?'officer':i===1&&tier>=2&&mortars<3?'mortar':i%7===6?'shield':'rifle';
  const enemy=spawnAround(s,type,{cohort:'holdout'},null,24);
  if(!enemy)continue;
  enemy.hp=enemy.maxHp=Math.round(enemy.maxHp*(1+tier*(type==='rifle'?.035:.13)));
 }
 if(early){
  const rail=challenge.type==='defend';
  emit(s,rail?'relay-reserve':'hunt-reserve',s.player.x,s.player.y,{text:rail?'중계기 역습 · 보병 접근':'지휘부 역습 · 증원 합류',life:1.1});
 }
}
function openGate(s){
 const gate=s.operation.gate=gatePosition(s);
 s.operation.holdoutKills=0;
 s.spawnClock=0;if(!s.powerWave?.showcase||s.powerWave.paired<=0)s.powerWave=null;
 const {x,y}=s.boss;
 const xp=[4,6,9][s.operation.region];
 for(let i=0;i<8;i++){
  const a=i*TAU/8;
  const radius=i%2===0?100:76;
  const q={x:clamp(x+Math.cos(a)*radius,60,1540),y:clamp(y+Math.sin(a)*radius,60,1140)};
  if(blocked(s,q.x,q.y,12))Object.assign(q,gate);
  dropXp(s,q.x,q.y,xp,true);
 }
 emit(s,'gate-open',gate.x,gate.y,{text:`${exitGate(s).name} 개방 · ${HOLDOUT.grace}초 후 증원`,life:2.4});
}
function updateCoastSalvage(s,dt){
 const coast=coastAtShore(s);
 if(!coast)return;
 if(coast.parts.length){
  coast.parts=coast.parts.filter(part=>{
   if(distance(s.player,part)>48||lineBlocked(s,s.player,part))return true;
   advanceCoastRole(s,part,7);
   return false;
  });
  if(coast.progress===COAST_SALVAGE.steps.at(-1))coast.parts=[];
 }
 if(coast.turret!=='securing'||distance(s.player,s.boss)>COAST_SALVAGE.reach)return;
 coast.work=Math.min(COAST_SALVAGE.seconds,coast.work+dt);
 if(coast.work===COAST_SALVAGE.seconds){
  coast.turret='secured';
  const mounts=coastMountCards(s);
  if(mounts.length)openChoice(s,'coast-mount',[...mounts,{id:'carry:turret',kind:'stay',title:'전리품으로 보관',desc:'현재 무장을 유지하고 귀환 시 포탑을 반출합니다.'}],'수송차 포탑 회수');
  emit(s,'complete',s.boss.x,s.boss.y,{life:1.7,text:carriesCoastSalvage(s)?'포탑 확보 · 철도 진입 가능':'포탑 확보 · 귀환 게이트로 반출'});
 }
}
export function step(s,dt,input={x:0,y:0},view=null){
 if(s.phase!=='playing')return;dt=clamp(dt,0,1/30);if(!dt)return;if(view)s.view={w:view.w,h:view.h};s.hitCandidate=null;s.t+=dt;if(s.operation)s.operation.regionTime+=dt;const p=s.player;
 if(s.stage==='holdout')s.holdTime+=dt;const pressure=s.stage==='holdout'?s.clearPressure+(s.operation?holdoutTier(s.holdTime):Math.floor(s.holdTime/30)):Math.floor((s.operation?.regionTime??s.t)/60);if(pressure>s.pressure){s.pressure=pressure;emit(s,'pressure',p.x,p.y,{text:s.operation&&s.stage==='holdout'?`잔류 공세 ${holdoutTier(s.holdTime)}단계`:`경계 ${pressure} · 증원 강화`,life:1.3});}
 const wasDashing=p.dash>0;
 for(const key of ['invuln','hurt','attack','dash','dashCd','skillCd','pickupTime'])p[key]=Math.max(0,p[key]-dt);
 const previousOverdrive=p.overdrive;p.overdrive=Math.max(0,p.overdrive-dt);if(previousOverdrive>0&&p.overdrive===0&&moduleRank(s,'overcharger'))blast(s,p.x,p.y,180,140,'module');
 if(s.operator!=='marco')p.charge=Math.min(100,p.charge+(s.stage==='boss'?2:.5)*dt);
 s.coilCd=Math.max(0,s.coilCd-dt);s.heatCd=Math.max(0,s.heatCd-dt);for(const cd of ['medicCd','thermalCd','shrapnelCd'])s[cd]=Math.max(0,(s[cd]||0)-dt);
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.max(1,Math.hypot(ix,iy)),moving=Math.hypot(ix,iy)>.07;p.moving=moving;
 const {x:startX,y:startY}=p;
 const b=s.boss,coreDash=p.dash>0&&portCoreWindow(s),coreReach=coreDash?portCoreReach(s):0;
 const coreEntry=coreDash&&p.portRush&&distance(p,b)>coreReach;
 if(moving){
  const speed=p.dash>0?650:190*(p.pickupTime>0?1+moduleRank(s,'magnet')*.03:1);
  move(s,p,ix/len*speed*dt,iy/len*speed*dt,16);p.walk+=speed*dt*.05;
  const trail=s.weapons.find(isTrailInferno);
  if(trail)leaveInfernoWake(s,trail,startX,startY);
  if(s.operator==='marco')p.moveAim=Math.atan2(iy,ix);
 }
 const kit=PORT_SUPPORT.overrun;
 const coreCut=coreDash&&Number.isFinite(p.portCutX)&&Math.abs(p.x-p.portCutX)>=kit.sideStep;
 if((coreEntry||coreCut)&&distance(p,b)<=coreReach&&!lineBlocked(s,p,b)){
  delete p.portRush;delete p.portCutX;b.harborStrikeCycle=b.cycle;b.timer+=kit.delay;recordSupportUse(s);
  recordHarborPayoff(s,coreCut?'sidesteps':'dives');
  damage(s,b,kit.damage,'blast','support');
  emit(s,'break',b.x,b.y,{text:`${coreCut?'측면 회피':'돌격 신관'} · 코어 장갑 해제`});
 }
 if(wasDashing&&p.dash<=0&&s.operation?.support==='overrun'){
  delete p.portRush;delete p.portCutX;
  blast(s,p.x,p.y,100,85,'support');
  if(s.operation.region!==2&&b.active&&!b.dead&&b.mode==='recover'&&distance(p,b)<=100+b.r&&!lineBlocked(s,p,b)){
   const target=b.parts.filter(part=>part.hp>0).map(part=>Object.assign(part,partPosition(s,part))).sort((a,b)=>distance(p,a)-distance(p,b))[0]||b;
   recordSupportUse(s);
   damage(s,target,260,'blast','support');emit(s,'break',target.x,target.y,{text:target===b?'돌격 신관 · 코어 직격':'돌격 신관 · 부위 직격'});
  }
 }
 if(p.maneuver==='brace')p.stillTime=moving?0:Math.min(.45,(p.stillTime||0)+dt);
 if(p.assaultTime>0)p.assaultTime=Math.max(0,p.assaultTime-dt);
 updateRaid(s,dt);
 if(s.stage==='holdout'&&s.operation)updateHoldout(s,dt);
 else if(s.stage!=='boss'&&s.operation)updateCampaignAmbient(s,dt);
 else if(s.stage!=='boss'){
  s.spawnClock-=dt;if(s.spawnClock<=0){s.spawnClock=2.4;for(let i=0;i<Math.min(12,5+s.pressure);i++)spawnAround(s,(s.pressure+(s.operation?.region||0))>1&&i===0?'officer':(s.pressure+(s.operation?.region||0))>0&&i%5===1?'shield':(s.pressure+(s.operation?.region||0))>0&&i%5===3?'mortar':'rifle');}
  if(s.pressure>=4){s.pursuitClock=(s.pursuitClock??1)-dt;if(s.pursuitClock<=0){s.pursuitClock=Math.max(4,18-s.pressure);const hp=300*Math.pow(1.12,s.pressure-3);spawnAround(s,'officer',{hp,maxHp:hp});}}
 }
 updatePowerWave(s,dt);
 const coast=coastSalvage(s),fieldReload=coast&&s.operator!=='marco'?1-coastRoleBonus(s.operator,coastRoleRank(coast)):1;
 const cadence=(p.overdrive>0?.65:1)*(activeManeuver(p)==='assault'?.78:1)*fieldReload;
 for(const w of s.weapons){
  w.cd-=dt;w.payloadCd=Math.max(0,w.payloadCd-dt);
  const counter=w.id==='r'?coastRocketCounter(s,undefined,w):null;
  if(w.cd<=0||counter?.state==='ready'){
   const fired=shoot(s,w,counter);
   if(fired||w.cd<=0)w.cd=fired?weaponStats(w).interval*cadence:0;
  }
 }
 if(s.operation?.coastStrike==='r'&&s.operation.region===0&&b.mode==='windup')fireCoastSignal(s);
 updateShots(s,dt);
 const dashOrigin=p.dash>0&&moving&&Math.hypot(p.x-startX,p.y-startY)>.5?{x:startX,y:startY}:null;
 updateZones(s,dt,dashOrigin);
 // A burning gun can be destroyed on the final warning tick, before its shells land.
 if(s.operation?.region>0&&b.active&&!b.dead)for(const part of b.parts)updateBurn(s,part,dt);
 updateEnemies(s,dt);updateBoss(s,dt);if(s.hitCandidate)hurt(s,s.hitCandidate.amount,s.hitCandidate.x,s.hitCandidate.y);delete s.hitCandidate;
 if(p.hp>0)updateCoastSalvage(s,dt);
 const crate=s.boss.harborSupply;
 const aidInReach=crate&&s.boss.active&&!s.boss.dead&&p.hp>0&&distance(p,crate)<PORT_SUPPORT.recovery.reach&&!lineBlocked(s,p,crate);
 const early=aidInReach&&portAidWindow(s,p);
 // Keep a safe crate available until the pilot clears the edge of the warning.
 if(aidInReach&&(early||!portAidWindow(s))){
  const kit=PORT_SUPPORT.recovery,hp=p.hp,charge=p.charge;
  const rearmed=early&&p.dashCd>kit.dashDelay;
  p.hp=Math.min(p.maxHp,hp+kit.heal);p.charge=Math.min(100,charge+(early?kit.warningCharge:kit.charge));
  if(rearmed)p.dashCd=kit.dashDelay;
  s.boss.harborCounter=true;s.operation.harborPayoff??={};
  delete s.boss.harborSupply;recordSupportUse(s);
  recordHarborPayoff(s,early?'safeAid':'aid');
  const healed=Math.ceil(p.hp)-Math.ceil(hp),charged=Math.floor(p.charge)-Math.floor(charge);
  const text=[early?'포격 회피 보급':'구급 화물 회수'];
  if(rearmed)text.push('회피 재정비');
  if(healed)text.push(`체력 +${healed}`);
  if(charged)text.push(`${chargeLabel(s)} +${charged}`);
  emit(s,'heal',crate.x,crate.y,{life:1,text:text.join(' · ')});
 }
 let pickedXp=0,salvage=false;
 const reach=pickupReach(s);
 for(const gem of s.gems){
  gem.age+=dt;
  const d=distance(gem,p);
  if(d>=reach)continue;
  const pull=Math.min(1,dt*10);
  gem.x+=(p.x-gem.x)*pull;gem.y+=(p.y-gem.y)*pull;
  if(d<22){pickedXp+=gem.value;salvage||=!!gem.salvage;gem.collected=true;}
 }
 p.pickupBudget=Math.min(3,(p.pickupBudget??3)+dt*3);
 if(pickedXp){
  gainXp(s,pickedXp);p.pickupTime=.6;s.gems=s.gems.filter(g=>!g.collected);
  const gained=Math.min(pickedXp*.15,p.pickupBudget);
  if(s.operation?.support==='recovery'&&p.hp>0){
   p.hp=Math.min(p.maxHp,p.hp+gained);
   if(s.stage==='boss'&&salvage)recordSupportUse(s);
  }
  p.pickupBudget-=gained;if(s.operator!=='marco')p.charge=Math.min(100,p.charge+gained*(1+Math.min(.2,s.level*.01)));
  const receipt=s.effects.find(f=>f.type==='xp-pickup');
  if(receipt){receipt.value+=pickedXp;receipt.salvage||=salvage;receipt.age=0;}
  else emit(s,'xp-pickup',p.x,p.y,{value:pickedXp,salvage,life:.65});
 }
 s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;for(const fx of s.effects)fx.age+=dt;s.effects=s.effects.filter(fx=>fx.age<fx.life);
 if(s.boss.dead&&s.stage==='boss'&&p.hp>0){
  s.stage='holdout';s.boss.active=false;delete s.boss.harborSupply;delete s.boss.harborCounter;s.clearPressure=s.pressure;s.holdTime=0;s.enemyShots=[];s.hazards=[];
  if(coastAtShore(s))coast.turret=s.boss.parts[0].hp>0?'intact':'broken';
  if(s.operation){
   if(canAdvanceFront(s)||coastAtShore(s)&&!isCoastRailSortie(s)){s.tuning++;p.hp=Math.min(p.maxHp,p.hp+15);}
   openGate(s);
   return;
  }
  s.queue.unshift({type:'clear',source:'MISSION CLEAR',cards:exitCards(s)});
 }
 updateChallenge(s,dt);if(p.hp<=0){finish(s,false,'hp');return;}if(s.phase!=='playing')return;
 if(s.raid?.state==='success'&&!s.raid.rewardQueued){s.raid.rewardQueued=true;s.queue.push({type:'raid-reward',source:'습격 성공 · 새 보급',cards:crateCards(s,s.raid.quality,s.raid.contract),extra:{quality:s.raid.quality,contract:s.raid.contract,wagerQuality:s.raid.wager.quality}});}
 updateSites(s,dt);nextChoice(s);
}
export function takeEvents(s){const e=s.events;s.events=[];return e;}
