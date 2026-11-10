import {REGIONS,RESEARCH,MANEUVERS,FRONT_SUPPORTS,PORT_SUPPORT,PORT_TURRET,PORT_BARRAGE,portBarrageAxis,portJamsSweep,portBarrageRounds,portBarrageMark,PORT_LANDING,railGarrison,railCrewLeft,portGantry,FRONT_TACTICS,RAIL_BARRAGE,railDisarmed,railGunOf,DEFENSE_ZONE,SIGNAL_SECONDS,signalLane,signalPosition,COAST_APPROACHES,COAST_WING,COAST_MORTAR,coastMortarWait,COAST_STRIKES,coastStrike,coastStrikeArmed,claimedCoastLead,coastApproach,coastLead,frontTactic,portBreachFlank,portCoreWindow,portCoreDisrupted,portCoreReach,portTurretShutter,portTurretSide,portAidPoint,portAidWindow,portAidCounterReady,defenseSeconds,holdoutContract,signalCourier,region,regionLayout,mapSeed,frontEntry,regionBoss,gatePosition,exitGate,sortieOrder,holdoutTier,holdoutParts,canAdvanceWithVanguard,vanguardAid,HOLDOUT} from './campaign.js';
import {RULES,VERSION,FIELD,GUNS,MODULES,QUALITY,makeWeapon,tags,moduleRank,moduleGain,compatible,canReplaceModule,completionModules,railCalibration,refitWeapons,canEvolve,canFuse,heatSynergyReady,weaponStats,distance,blastContactRadius,clamp,layout} from './content.js';
import {raidRoute,raidOnNose,raidCursor} from './raid.js';
import {COAST_CHARGE,coastTravel,planCoastCharge,coastChargeLane} from './coast-charge.js';
import {OPERATORS,operatorOf,skillRules,canUseSkill,focusLane,aimFromInput,chargeLabel} from './operator.js';
const TAU=Math.PI*2,clone=x=>JSON.parse(JSON.stringify(x));
const rng=(s,key)=>{let a=s.rng[key]=(s.rng[key]+0x6d2b79f5)>>>0;a=Math.imul(a^(a>>>15),a|1);a^=a+Math.imul(a^(a>>>7),a|61);return((a^(a>>>14))>>>0)/4294967296;};
const pick=(s,key,items)=>items[Math.floor(rng(s,key)*items.length)];
const alive=s=>s.enemies.filter(e=>!e.dead);
const emit=(s,type,x=s.player.x,y=s.player.y,extra={})=>{s.events.push(type);s.effects.push({type,x,y,age:0,life:.45,...extra});if(s.effects.length>180)s.effects.shift();};
const freshStats=()=>({kills:0,elites:0,score:0,damageTaken:0,ricochetHits:0,coilBursts:0,heatBursts:0,raidSuccess:0,raidFailed:0,bestCombo:0,completedBuild:null,bossKilled:false,challenge:0,choices:[],moduleDamage:0});
export function createRun(seed=17){
 const map=layout(seed),s={version:VERSION,balanceRevision:RULES.balanceRevision,seed:seed>>>0,rng:{map:seed>>>0,supply:(seed^0x12345678)>>>0,combat:(seed^0xa5f31021)>>>0,loot:(seed^0xdecafe11)>>>0},phase:'playing',stage:'field',t:0,level:1,xp:0,pendingLevels:0,tuning:1,rerolls:2,banishes:1,refits:1,excluded:[],seenGuns:[],offeredWeapons:[],supplyCount:0,firstNew:null,choice:null,choices:[],queue:[],id:0,
 player:{x:800,y:1040,hp:100,maxHp:100,aim:-Math.PI/2,walk:0,moving:false,attack:0,hurt:0,invuln:0,dash:0,dashCd:0,charge:60,overdrive:0,skillCd:0,doctrine:'reserve',pickup:0,pickupTime:0},weapons:[{...makeWeapon('h'),uid:'w-h0'}],modules:[],boosts:{power:0,vitality:0,pickup:0},...map,enemies:[],shots:[],enemyShots:[],gems:[],zones:[],hazards:[],effects:[],events:[],combo:0,comboTime:0,spawnClock:1,pressure:0,lastPressure:0,coil:0,coilCd:0,heatCd:0,powerWave:null,powerDone:false,view:{w:880,h:500},stats:freshStats(),raid:null,raidUsed:false,challenge:null,boss:{id:'boss',type:'boss',x:800,y:180,hp:6000,maxHp:6000,r:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:-60,hp:450,maxHp:450,r:25},{id:'part-b',type:'part',ox:60,hp:450,maxHp:450,r:25}]},holdTime:0,result:null};
 for(let i=0;i<RULES.spawn.initialCount;i++)spawnAround(s,'rifle',{},340,RULES.spawn.openingGap);
 return s;
}
export function createOperation(seed=17,research=[],trial=null,order=null,operator='fio'){
 if(order!==null&&!sortieOrder(order))throw Error('작전 지령을 확인할 수 없습니다.');
 if(!Object.hasOwn(OPERATORS,operator))throw Error('출전 대원을 확인할 수 없습니다.');
 const s=createRun(seed);s.operation={region:0,cleared:0,regionTime:0,history:[],jammed:false,...(order?{order,orderDone:false}:{})};s.research=[...research];s.trials=(Array.isArray(trial)?[...trial]:[trial]).filter(Boolean);s.trial=s.trials[0]||null;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[0]};for(const e of s.enemies)e.cohort='ambient';s.stats.sitesCleared=0;s.stats.fusionBosses=0;s.stats.flameBosses=0;Object.assign(s,regionLayout(seed,0,order));s.boss=regionBoss(0);
 if(operator==='marco'){
  s.operator=operator;
  Object.assign(s.player,{charge:RULES.marco.initialCharge,doctrine:OPERATORS.marco.start,moveAim:-Math.PI/2,focusChargeAt:0});
 }
 return s;
}
function advanceRegion(s){
 if(!s.operation||s.stage!=='holdout'||!s.boss.dead||s.operation.region>=2)return false;
 withdrawRaid(s);
 const recoverStrike=s.operation.region===0&&s.operation.coastStrikeUsed;
 const support=s.operation.nextSupport||(canAdvanceWithVanguard(s)?'vanguard':null);
 s.operation.history.push({region:s.operation.region,time:s.operation.regionTime,pressure:s.pressure,holdTime:s.holdTime,holdoutKills:s.operation.holdoutKills||0,nextSupport:support,sites:s.sites.filter(n=>n.state==='done').length});
 s.operation.support=support;delete s.operation.nextSupport;delete s.operation.tactic;
 if(support==='vanguard')Object.assign(s.player,vanguardAid(s.player));
 s.operation.region++;s.operation.regionTime=0;s.operation.jammed=false;s.operation.challengeTier=0;s.operation.holdoutKills=0;delete s.operation.gate;delete s.pursuitClock;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[s.operation.region]};
 if(s.operation.region===2&&Object.hasOwn(PORT_SUPPORT,support))s.operation.harborPayoff={};
 const sectorSeed=mapSeed(s.seed,s.operation.region),arrival=frontEntry(sectorSeed,s.operation.region).arrival;
 Object.assign(s,regionLayout(sectorSeed,s.operation.region));s.boss=regionBoss(s.operation.region,s.seed);s.stage='field';s.pressure=0;s.holdTime=0;s.challenge=null;s.raid=null;s.raidUsed=false;s.enemies=[];s.shots=[];s.enemyShots=[];s.hazards=[];s.zones=[];s.gems=[];s.effects=[];s.events=[];s.spawnClock=1;Object.assign(s.player,arrival);s.player.invuln=1;s.player.dash=0;s.choice=null;s.choices=[];s.phase='playing';
 if(s.powerWave?.showcase&&s.powerWave.paired>0){
  s.powerWave.remaining=Math.max(s.powerWave.remaining,60);s.powerWave.delay=1;
 }else if(s.stats.completedBuild)s.powerWave={delay:3,remaining:60,clock:0};
 if(recoverStrike)s.queue.unshift({type:'supply',source:'장갑 수송차 노획',cards:supplyCards(s,coastRecovery(s)),extra:{coastRecovery:true}});
 for(let i=0;i<10;i++)spawnAround(s,i===0?'officer':'rifle',{cohort:'ambient'},360,30);emit(s,'region-entry',arrival.x,arrival.y,{text:`${s.operation.region+1}/3 · ${region(s).name}`,life:1.6});nextChoice(s);return true;
}
function exitCards(s){
 const rare=s.operation?.region<2&&!s.operation.challengeTier;
 const stay={id:'stay',kind:'stay',title:rare?'남아서 희귀 부품 노리기':'남아서 더 성장',desc:'바닥 XP를 회수하고 증원군을 상대합니다. 게이트는 계속 열려 있습니다.',label:rare?'희귀 부품 추적':'잔류 성장'};
 if(s.operation&&s.operation.region<2)return [{id:'advance',kind:'advance',title:`${REGIONS[s.operation.region+1].name} 진입`,desc:'무장·체력·XP 유지. 남은 상자와 바닥 XP는 두고 전진합니다.',label:'다음 전선'},stay,{id:'extract',kind:'extract',title:'확보 보상으로 중도귀환',desc:'현재까지의 크레딧을 정산합니다. 최종 완주 보너스는 없습니다.',label:'작전 중단'}];
 return [{id:'extract',kind:'extract',title:'살아서 귀환',desc:'최종 작전 보상과 기록을 확정합니다.',label:'작전 완수'},stay];
}
function atForwardGate(s){
 const gate=exitGate(s);
 return !!(gate&&s.operation?.region<2&&s.boss.dead&&s.player.hp>0&&distance(s.player,gate)<92);
}
export const snapshot=s=>clone(s);
const validRailReservation=(s,c)=>s.choice?.type==='rail-workshop'&&s.operation?.region===1&&s.stage!=='boss'
 &&c.kind==='module'&&c.rank===1&&s.operation.requisition===c.module&&c.id===`requisition:${c.module}`
 &&!s.operation.requisitionClaimed&&s.sites.some(site=>site.id==='rail-cache'&&site.state==='done');
function validCoastStrike(s,c){
 const lead=claimedCoastLead(s);
 return !!lead&&s.choice?.type==='supply'&&s.stage==='field'&&!s.operation.coastStrike
  &&c.id===`coast:${s.firstNew}`&&c.key===s.firstNew&&lead.id===s.choice.siteId&&coastStrikeArmed(s,c.key);
}
export const canResumeRevision=revision=>[RULES.balanceRevision,'b31-harbor-counterattack','b30-port-gantry','b29-rail-workshop','b28-research-dispatch','b27-boss-counterplay','b26-rail-gun-lock','b25-convoy-routes','b24-harbor-counterplay','b23-front-approaches','b22-capstone-impact','b21-field-rhythm','b20-harbor-shutter','b19-coast-opening','b18-harbor-parts','b17-vanguard-triage','b16-holdout-draft','b15-front-tactics','b14-coast-approaches','b13-capstone-showcase','b12-fusion-relay','b11-capstone-combat','b10-beach-routes','b09-front-contracts','b08-pursuit-supply','b07-open-gates','b06-swarms'].includes(revision);
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
 for(const w of s.weapons)if(!GUNS[w.id]||!Number.isInteger(w.level)||w.level<1||w.level>6||w.branch&&!GUNS[w.id].branches[w.branch])throw Error('무장 저장이 손상됐습니다.');
 for(const m of s.modules)if(!MODULES[m.id]||!Number.isInteger(m.rank)||m.rank<1||m.rank>3)throw Error('모듈 저장이 손상됐습니다.');
 if(!Number.isFinite(s.player.hp)||s.player.hp<0||!Number.isFinite(s.player.maxHp)||s.player.maxHp<=0||s.player.hp>s.player.maxHp||!Number.isFinite(s.t)||s.t<0||s.tuning<0||s.rerolls<0||s.banishes<0)throw Error('작전 저장이 손상됐습니다.');
 const fail=()=>{throw Error('전투 체크포인트가 손상됐습니다.');};
 if(s.operator!==undefined&&(s.operator!=='marco'||!s.operation||!Object.hasOwn(OPERATORS.marco.stances,s.player.doctrine)||![s.player.moveAim,s.player.focusChargeAt].every(Number.isFinite)))fail();
 if(s.levelReadyAt!=null&&(!Number.isFinite(s.levelReadyAt)||s.levelReadyAt<0))fail();
 if(!['field','boss','holdout'].includes(s.stage)||!Array.isArray(s.boss?.parts)||!Array.isArray(s.queue)||!Array.isArray(s.choices)||!['map','supply','combat','loot'].every(k=>Number.isInteger(s.rng[k])))fail();
 const chargePath=s.boss.chargePath;
 if(chargePath&&(![chargePath.x,chargePath.y,chargePath.length,chargePath.offset].every(Number.isFinite)||chargePath.length<0||chargePath.offset<0||chargePath.length+chargePath.offset>COAST_CHARGE.distance+.001||chargePath.linear!=null&&typeof chargePath.linear!=='boolean'||chargePath.blockId!=null&&typeof chargePath.blockId!=='string'))fail();
 for(const key of ['blocks','enemies','shots','enemyShots','gems','zones','hazards','effects','excluded','seenGuns','offeredWeapons'])if(!Array.isArray(s[key]))fail();
 if(new Set(s.modules.map(m=>m.id)).size!==s.modules.length||s.modules.some(m=>RULES.modules[m.id].unique&&m.rank!==1)||new Set(s.weapons.map(w=>w.uid)).size!==s.weapons.length||s.weapons.some(w=>typeof w.uid!=='string'))fail();
 if(s.operation&&(!Array.isArray(s.research)||s.research.some(id=>!RESEARCH[id])||s.trial&&!s.research.includes(s.trial)||s.trials&&(!Array.isArray(s.trials)||s.trials.some(id=>!s.research.includes(id)))||!Number.isInteger(s.operation.region)||s.operation.region<0||s.operation.region>2||!Number.isInteger(s.operation.cleared)||s.operation.cleared<0||s.operation.cleared>3||!Number.isFinite(s.operation.regionTime)||!Array.isArray(s.operation.history)))fail();
 if(s.operation){
  const order=s.operation.order;
  if(order!==undefined&&(!sortieOrder(order)||typeof s.operation.orderDone!=='boolean')||order===undefined&&s.operation.orderDone!==undefined)fail();
  if(order&&s.operation.region===0){
   const site=s.sites.find(site=>site.id==='arsenal');
   if(!site||site.kind!==(order==='wire'?'relay':'armory')||s.operation.orderDone&&site.state!=='done')fail();
  }
  s.trials??=s.trial?[s.trial]:[];
  const {requisition,requisitionClaimed}=s.operation;
  if(requisition!==undefined&&(order!==undefined||!Object.hasOwn(RESEARCH,requisition)||!s.research.includes(requisition)||s.trials?.includes(requisition)))fail();
  if(requisitionClaimed!==undefined&&(requisitionClaimed!==true||!requisition||s.operation.region===0))fail();
  if(requisitionClaimed&&s.operation.region===1&&!s.sites.some(site=>site.id==='rail-cache'&&site.state==='done'))fail();
  // The first b30 release opened the hatch before the site stored its variant.
  if(s.operation.region===2&&s.balanceRevision==='b30-port-gantry'){
   const dock=s.sites.find(site=>site.id==='port-landing');
   if(dock)dock.gantry=true;
  }
  if(s.operation.portDock!==undefined&&(s.operation.portDock!==true||s.operation.region!==2||!s.sites.some(site=>site.id==='port-landing'&&site.state==='done')))fail();
  if(s.operation.portEntry!==undefined&&(s.operation.portEntry!=='gantry'||!s.operation.portDock||s.stage==='field'))fail();
  if([s.operation.support,s.operation.nextSupport].some(id=>id!=null&&!Object.hasOwn(FRONT_SUPPORTS,id)))fail();
  const payoff=s.operation.harborPayoff;
  if(payoff!=null&&(typeof payoff!=='object'||Array.isArray(payoff)||s.operation.region!==2||!Object.hasOwn(PORT_SUPPORT,s.operation.support)||Object.values(payoff).some(n=>!Number.isSafeInteger(n)||n<0)))fail();
  const supply=s.boss.harborSupply;
  if(supply!=null&&(s.operation.region!==2||s.operation.support!=='recovery'||!PORT_SUPPORT.recovery.lanes.includes(supply.x)||supply.y!==PORT_SUPPORT.recovery.y))fail();
  if(s.boss.harborSupplyCycle!=null&&(!Number.isInteger(s.boss.harborSupplyCycle)||s.boss.harborSupplyCycle<1||s.boss.harborSupplyCycle>PORT_SUPPORT.recovery.limit))fail();
  if(s.boss.harborCounter!==undefined&&(s.boss.harborCounter!==true||s.operation.region!==2||s.operation.support!=='recovery'||s.stage!=='boss'))fail();
  if(s.operation.holdoutKills!=null&&(!Number.isSafeInteger(s.operation.holdoutKills)||s.operation.holdoutKills<0))fail();
  const {coastStrike:planned,coastStrikeUsed}=s.operation;
  if(planned!==undefined&&(!Object.hasOwn(COAST_STRIKES,planned)||planned!==s.firstNew||s.operation.region===0&&!claimedCoastLead(s)))fail();
  if(coastStrikeUsed!==undefined&&(coastStrikeUsed!==true||planned===undefined||s.operation.region===0&&s.stage==='field'))fail();
  if(s.operation.tactic!=null&&!Object.hasOwn(FRONT_TACTICS[s.operation.region]||{},s.operation.tactic))fail();
  if(s.stage==='boss'){
   if(s.operation.region===1)s.hazards=s.hazards.filter(h=>!h.lane||h.hit||!(s.boss.parts[railGunOf(h)]?.hp<=0));
   if(s.operation.region===2){
    if(s.boss.parts[0]?.hp<=0)clearPortRounds(s,'turret');
    if(s.boss.parts[1]?.hp<=0)clearPortRounds(s,'rake');
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
 const kinds=new Set(['advance','control','rank','module','gun','evolve','fusion','tune','repair','utility','refit','calibrate','resupply','back','stay','extract','maneuver','permit','front-support','cargo','coast-strike']);
 const cardsOk=cards=>Array.isArray(cards)&&cards.length>0&&cards.every(c=>(c.kind!=='resupply'||Number.isFinite(c.heal)&&Number.isFinite(c.charge)&&c.heal>=0&&c.charge>=0)&&typeof c.id==='string'&&kinds.has(c.kind)&&(!c.weapon||GUNS[c.weapon])&&(!c.module||MODULES[c.module])&&(!['rank','gun','evolve'].includes(c.kind)||!!GUNS[c.weapon])&&(!['module','tune'].includes(c.kind)||!!MODULES[c.module])&&(c.kind!=='module'||Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=3));
 if((s.phase==='choice'||s.resumePhase==='choice')&&(!s.choice||!['level','supply','armory','raid-reward','pursuit-reward','assembly','clear','control','rail-workshop'].includes(s.choice.type)||!cardsOk(s.choices)))fail();
 if(s.choice?.type==='rail-workshop'&&(s.operation?.region!==1||s.stage==='boss'||s.choices.some(c=>c.kind==='calibrate'&&(c.id!==`calibrate:${c.uid}`||!s.weapons.some(w=>w.uid===c.uid&&railCalibration(s,w))))))fail();
 const reservations=s.choices.filter(c=>typeof c?.id==='string'&&c.id.startsWith('requisition:'));
 if(reservations.length>1||reservations.some(c=>!validRailReservation(s,c)))fail();
 const strikes=s.choices.filter(c=>c?.kind==='coast-strike');
 if(strikes.length>1||strikes.some(c=>!validCoastStrike(s,c)))fail();
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
 if(s.queue.some(q=>!cardsOk(q.cards)||q.extra?.coastRecovery||q.cards.some(c=>c.kind==='coast-strike')))fail();
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
 if(s.challenge?.type==='defend'&&(!Number.isFinite(s.challenge.progress)||!Number.isFinite(s.challenge.duration)||!Number.isFinite(s.challenge.strike)))fail();
 if(s.challenge?.type==='intercept'){
  const {lane,timeLeft,target}=s.challenge;
  if(![timeLeft,target?.x,target?.y,target?.hp,target?.maxHp].every(Number.isFinite)||timeLeft<0||timeLeft>SIGNAL_SECONDS||lane!==undefined&&lane!==signalLane(s.seed))fail();
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
const utility=(key)=>({id:`utility:${key}`,kind:'utility',key,title:({health:'야전 응급처치',pickup:'회수 숙련',power:'추가 화력',charge:'탄약 보급'})[key],desc:({health:'최대 HP +6 · 체력 +6',pickup:'XP 회수 반경 +10 (최대 3회)',power:'기본 화력 +1% 가산',charge:'전탄 보급 충전 +10'})[key],label:'전술 보조'});
const upgradeable=s=>s.weapons.filter(w=>!w.evolved&&!w.fusion&&w.level<6);
function modulePool(s){
 const reserved=s.operation?.region<2?s.operation.requisition:null;
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
function supplyCards(s,site){
 const guns=upgradeable(s),rank=guns.length?gunCard(pick(s,'supply',guns)):currentInvestments(s)[0]||utility('health');
 const pool=modulePool(s),trial=trialModule(s,pool,site?.coastApproach);
 if(site?.opening){
  const opening=[site.gun,site.gun==='r'?'f':'r'].filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id));
  return fillCards(s,[...opening.map(id=>newGun(id,COAST_APPROACHES[id].label)),trial?trialCard(trial):rank]);
 }
 const key=site?.coastApproach;
 const plan=key===s.firstNew&&s.operation?.region===0&&!s.operation.coastStrike&&coastStrikeArmed(s,key)?COAST_STRIKES[key]:null;
 const addStrike=cards=>plan?[...cards,{id:`coast:${key}`,kind:'coast-strike',key,title:plan.name,desc:plan.impact,label:'장갑 수송차 공략'}]:cards;
 const signature=pool.includes(site?.module)?{...moduleCard(site.module),label:'이 동선의 특화 모듈'}:null;
 if(site?.coastApproach&&signature&&trial)return addStrike(fillCards(s,[rank,signature,trialCard(trial)]));
 const cards=[rank];
 const unseen=['h','r','f'].filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id)&&!(s.supplyCount<2&&s.seenGuns.includes(id)));
 if(unseen.length){const id=unseen.includes(site?.gun)?site.gun:pick(s,'supply',unseen);cards.push(newGun(id,id===site?.gun?'이 동선의 주력 무장':'새 무기'));if(!s.seenGuns.includes(id))s.seenGuns.push(id);}
 let favored=pool;
 if(s.supplyCount<2){const focus=s.weapons.find(w=>w.id===s.firstNew)||s.weapons[0],requirements=Object.values(RULES.weapons[focus.id].evolution.moduleByBranch).flat();const useful=pool.filter(id=>requirements.includes(id));if(useful.length)favored=useful;}
 if(pool.length)cards.push(trial?trialCard(trial):signature||moduleCard(pick(s,'supply',favored)));
 return addStrike(fillCards(s,cards));
}
function railWorkshopCards(s){
 const focus=s.firstNew||'h';
 const parts=completionModules(s),preferred=({f:'catalyst',r:'coil',h:'ricochet'})[focus];
 const part=parts.includes(preferred)?preferred:parts[0];
 const upgrades=upgradeable(s),gun=upgrades.find(w=>w.id===focus)||upgrades[0];
 const installed=s.weapons.map(w=>({w,change:railCalibration(s,w)})).filter(x=>x.change);
 const pivot=installed.find(x=>x.change.gun===focus)||installed[0];
 const cards=[];
 if(pivot)cards.push({id:`calibrate:${pivot.w.uid}`,kind:'calibrate',weapon:pivot.w.id,uid:pivot.w.uid,title:'완성 병기 재개장',label:'전선 공방'});
 if(part)cards.push({...moduleCard(part),label:'완성 병기 조립 재료'});
 if(gun&&cards.length<2)cards.push(gunCard(gun));
 const reserved=s.operation.requisition;
 if(reserved&&!s.operation.requisitionClaimed){
  cards.splice(1);
  cards.unshift({...moduleCard(reserved),id:`requisition:${reserved}`,label:'예약품 · 이번 작전 장착'});
 }
 return [...cards,{id:'resupply:rail-workshop',kind:'resupply',title:'차내 응급 보급',heal:20,charge:15,label:'생존 투자'}];
}
function fillCards(s,cards){const unique=[...new Map(cards.filter(Boolean).map(c=>[c.id,c])).values()];for(const key of ['health','charge','power'])if(unique.length<3&&!unique.some(c=>c.id===`utility:${key}`))unique.push(utility(key));return unique.slice(0,3);}
function closingInvestment(s,offered,rest){
 if(!s.operation||s.tuning<=0||!s.weapons.some(w=>w.level>=3&&!w.evolved&&!w.fusion))return null;
 const already=new Set(assemblyOptions(s).map(c=>c.id));
 const opens=draft=>assemblyOptions(draft).some(c=>(c.kind==='evolve'||c.kind==='fusion')&&!already.has(c.id));
 const closes=c=>{
  if(c?.kind==='module'){
   if(!moduleRank(s,c.module))return false;
   return opens({...s,modules:s.modules.map(m=>m.id===c.module?{...m,rank:m.rank+1}:m)});
  }
  if(c?.kind!=='rank')return false;
  const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);
  if(!w||w.level<3)return false;
  const branches=w.level===3?Object.keys(GUNS[w.id].branches):[w.branch];
  return branches.some(branch=>opens({...s,weapons:s.weapons.map(other=>other===w?{...w,level:w.level+1,branch}:other)}));
 };
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
 return s.sites.some(site=>site.opening&&['active','ready'].includes(site.state)&&distance(site,s.player)<300);
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
 if(s.operation&&s.stage==='holdout'&&interaction(s)?.id==='extract')return;
 if(s.operation&&s.stage!=='boss'&&s.sites.some(site=>site.state==='ready'&&distance(site,s.player)<LEVEL_PICKUP_PRIORITY))return;
 openLevel(s);
}
export function assemblyOptions(s){
 const options=s.operation&&s.stats.challengeWins>0&&!s.player.maneuver?Object.entries(MANEUVERS).map(([key,m])=>({id:`maneuver:${key}`,kind:'maneuver',key,title:m.name,desc:m.impact,label:'노획 교범 · 한 판에 하나'})):[];
 if(s.tuning<=0)return options;
 for(const w of s.weapons)if(canEvolve(s,w))options.push({id:`evolve:${w.id}`,kind:'evolve',weapon:w.id,title:GUNS[w.id].evolution,desc:'발사 구조 확장 · 조율권 1 · 모듈 유지',label:'단일 진화'});
 if(moduleRank(s,'coil')>=2)for(const a of s.weapons)for(const b of s.weapons){if(!canFuse(s,a,b))continue;options.push({id:`fusion:${a.id}:${b.id}`,kind:'fusion',primary:a.id,secondary:b.id,title:`전도 격발망 ${GUNS[a.id].short}+${GUNS[b.id].short}`,desc:`${GUNS[a.id].short} 사격 유지 + ${GUNS[b.id].short} 폭발 계승 · 총 2개 → 1칸`,label:'태그 합체'});}
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
 if(reserved&&!validRailReservation(s,c))return false;
 if(c.kind==='advance'){if(!s.operation||s.stage!=='holdout'||!s.boss.dead||s.operation.region>=2)return false;s.stats.choices.push({id:'advance',region:s.operation.region,t:s.t});return advanceRegion(s);}
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen&&!Object.hasOwn(operatorOf(s).stances,doctrine))return false;
 if(c.kind==='rank'){const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);if(!w||w.level>=6||w.evolved)return false;if(w.level===3&&!GUNS[w.id].branches[branch])return false;w.level++;if(w.level===4)w.branch=branch;}
 else if(c.kind==='module'){
  if(!MODULES[c.module]||!reserved&&!compatible(s,c.module))return false;let m=s.modules.find(m=>m.id===c.module);
  const gain=moduleGain(s,c.module,c.rank);
  if(m){if(m.rank>=3||RULES.modules[m.id].unique)return false;m.rank=gain.next;}else{m={id:c.module,rank:gain.next};if(s.modules.length>=4){if(!canReplaceModule(s,c.module,slot))return false;s.modules[slot]=m;}else s.modules.push(m);}
  if(reserved)s.operation.requisitionClaimed=true;
  if((s.trials||[s.trial]).includes(c.module)){s.stats.researchTrialPicked=c.module;(s.stats.researchTrialsPicked??=[]).push(c.module);s.trials=(s.trials||[s.trial]).filter(id=>id!==c.module);s.trial=s.trials[0]||null;}
  if(gain.charge){const before=s.player.charge;s.player.charge=Math.min(100,before+gain.charge);s.stats.overflowCharge=(s.stats.overflowCharge||0)+s.player.charge-before;}
 }
 else if(c.kind==='gun'){
  if(s.weapons.some(w=>w.id===c.weapon&&!w.fusion))return false;let w=makeWeapon(c.weapon);const base=1+(s.operation?.region||0);w.level=base;
  if(s.weapons.length>=3||Number.isInteger(slot)&&slot>=0){const old=s.weapons[slot];if(!old||old.evolved||old.fusion)return false;w.level=s.refits>0&&s.stage==='field'?Math.min(5,old.level):Math.min(5,base+Math.floor(Math.max(0,old.level-base)/2));if(w.level>=4){if(!GUNS[w.id].branches[branch])return false;w.branch=branch;}if(s.refits>0&&s.stage==='field')s.refits--;w.uid=`w-${++s.id}`;s.weapons[slot]=w;}else{w.uid=`w-${++s.id}`;s.weapons.push(w);}
  if(!s.firstNew)s.firstNew=w.id;
  if(s.operation?.region===0&&s.choice.opening)s.openingFireUntil=s.t+OPENING_WEAPON_SECONDS;
 }
 else if(c.kind==='evolve'){if(!assemblyOptions(s).some(o=>o.id===id))return false;const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion&&!w.evolved);w.evolved=true;s.tuning--;buildCompleted(s,'single',w.id);}
 else if(c.kind==='fusion'){
  if(!assemblyOptions(s).some(o=>o.id===id))return false;const a=s.weapons.find(w=>w.id===c.primary&&!w.fusion),b=s.weapons.find(w=>w.id===c.secondary&&!w.fusion);a.fusion={secondary:b.id,branch:b.branch,overflow:Math.min(4,a.level+b.level-8)};a.level=6;a.evolved=true;a.payload=RULES.fusion.hitsPerPayload;s.weapons.splice(s.weapons.indexOf(b),1);s.tuning--;buildCompleted(s,'fusion');
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
  if(c.key==='jam')s.operation.jammed=true;
  else if(c.key==='loot')s.queue.push({type:'armory',source:'관제소 시험 탄약',cards:armoryCards(s,'rare'),extra:{quality:'rare',siteId:'port-control'}});
  else if(c.key==='supply')s.queue.push({type:'supply',source:s.choice.source,cards:supplyCards(s)});
  else if(Object.hasOwn(FRONT_TACTICS[s.operation?.region]||{},c.key)&&!s.operation.tactic)s.operation.tactic=c.key;
  else return false;
 }
 else if(c.kind==='extract'){if(s.operation&&s.operation.cleared===3)s.operation.extracted=true;finish(s,true);return true;}
 else if(c.kind==='stay'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else return false;
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen){if(!Object.hasOwn(operatorOf(s).stances,doctrine))return false;s.player.doctrine=doctrine;s.player.branchChosen=true;}
 s.stats.choices.push({t:Math.round(s.t*10)/10,id,branch:branch||null,weapon:weapon||null,source:s.choice.type,contract:s.choice.contract||null,quality:s.choice.quality||null});if(s.choice.type==='supply')s.supplyCount++;
 if(heatSynergyReady(s))buildCompleted(s,'synergy');
 emit(s,'choose');closeChoice(s,true);return true;
}
export function reroll(s){if(s.phase!=='choice'||s.choice.opening||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.rerolls<=0)return false;s.rerolls--;s.choices=s.choice.type==='level'?levelCards(s):s.choice.type==='supply'?supplyCards(s,s.choice.coastRecovery?coastRecovery(s):s.sites.find(site=>site.id===s.choice.siteId)):crateCards(s,s.choice.quality,s.choice.type==='raid-reward'?(s.choice.contract||s.raid?.contract):null);return true;}
export function banishOptions(s){if(s.phase!=='choice'||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.banishes<=0)return[];return s.choices.filter(c=>{const id=c.kind==='gun'?c.weapon:c.kind==='module'?c.module:null;return id&&!s.weapons.some(w=>w.id===id&&!w.fusion)&&(!moduleRank(s,id)||c.support)&&id!=='overcharger'&&!(c.kind==='gun'&&s.supplyCount<2&&['r','f'].filter(id=>!s.excluded.includes(id)).length<=2);});}
export function banish(s,id){const c=banishOptions(s).find(c=>c.id===id);if(!c)return false;const target=c.kind==='gun'?c.weapon:c.module,index=s.choices.indexOf(c);if(!moduleRank(s,target))s.excluded.push(target);s.banishes--;
 const used=new Set([...s.choices.filter(card=>card!==c).map(card=>card.id),c.id]);let replacement;
 if(c.kind==='gun'){const pool=['h','r','f'].filter(g=>!s.excluded.includes(g)&&!s.weapons.some(w=>w.id===g&&!w.fusion)&&!used.has(`gun:${g}`));if(pool.length){const g=pick(s,'supply',pool);replacement={id:`gun:${g}`,kind:'gun',weapon:g,title:`${GUNS[g].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:'새 무기'};}}
 const rank=['armory','raid-reward'].includes(s.choice.type)?({common:1,rare:2,prototype:3})[s.choice.quality]:c.kind==='module'?c.rank:1;
 if(!replacement){let pool=modulePool(s).filter(m=>!used.has(`module:${m}`)),support=false;if(c.support){const needed=completionModules(s).filter(m=>pool.includes(m));if(needed.length){pool=needed;support=true;}}if(pool.length)replacement={...moduleCard(pick(s,'supply',pool),rank),...(support?{support:true,label:'장갑 수송대 · 완성 부품'}:{})};}
 if(!replacement)replacement=(['armory','raid-reward'].includes(s.choice.type)?fillCrate([],s.choice.quality):['health','charge','power'].map(utility)).find(card=>!used.has(card.id));s.choices[index]=replacement;return true;
}
export function skip(s){if(s.phase!=='choice'||['assembly','clear','pursuit-reward'].includes(s.choice.type))return false;if(s.player.hp<s.player.maxHp)s.player.hp=Math.min(s.player.maxHp,s.player.hp+s.player.maxHp*.05);else s.player.charge=Math.min(100,s.player.charge+5);if(s.choice.type==='supply')s.supplyCount++;closeChoice(s,true);return true;}

function buildCompleted(s,kind,weapon){
 if(!s.stats.completedBuild)s.stats.completedBuild={kind,t:s.t};
 const showcase=kind==='fusion'?'fusion':weapon==='f'?'flame':null;
 const revealed=showcase==='fusion'?'fusionReveal':'flameReveal';
 if(showcase&&!s.stats[revealed]){
  s.stats[revealed]=true;
  s.powerWave={delay:.65,remaining:s.powerDone?Math.max(24,s.powerWave?.remaining||0):60,clock:0,paired:3,showcase};
  s.powerDone=true;
  emit(s,'complete',s.player.x,s.player.y,{life:1.2,showcase,text:showcase==='fusion'?'전도 격발망 가동 · 첫 연쇄탄 장전':'인페르노 가동 · 밀집 보병 접근'});
 }else if(!s.powerDone){
  s.powerDone=true;s.powerWave={delay:4,remaining:60,clock:0};
  emit(s,'complete',s.player.x,s.player.y,{life:1.2,text:kind==='single'?'무기 진화 완료':'발동 연계 완성'});
 }
}
export function partPosition(s,part){const b=s.boss;if(s.operation?.region===1)return{x:b.x+part.ox,y:b.y};return{x:b.x+Math.cos(b.body-Math.PI/2)*part.ox,y:b.y+Math.sin(b.body-Math.PI/2)*part.ox};}
function targets(s,breachLane){const list=alive(s),signal=signalCourier(s);if(signal?.hp>0)list.push(signal);if(s.raid?.state==='active'&&s.raid.target.hp>0)list.push(s.raid.target);if(s.boss.active&&!s.boss.dead){const breach=s.operation?.region===2?(breachLane??portBreachFlank(s)):s.operation?.support==='breach';if(!breach)list.push(s.boss);for(const part of s.boss.parts)if(part.hp>0){Object.assign(part,partPosition(s,part));list.push(part);}if(breach)list.push(s.boss);}return list;}
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
export function portTurretInSight(s){
 if(!portBreachFlank(s))return false;
 const turret=s.boss.parts[0],point=partPosition(s,turret);
 return s.weapons.some(w=>distance(s.player,point)<weaponStats(w).range+turret.r)&&!lineBlocked(s,s.player,point);
}
function targetFor(s,w,d,candidates){
 const priority=portBreachFlank(s)?s.boss.parts[0]:portCoreDisrupted(s)?s.boss:null;
 if(priority&&candidates.includes(priority))return priority;
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
  const mortar=selected&&distance(s.player,selected)>90&&candidates.find(e=>e.type==='mortar'&&(e.cohort==='rail-guard'||e.siteId==='supply-c'&&e.cohort==='coast-guard'));
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
function scoreKill(s,e,source,kind){
 if(s.operation&&s.stage==='holdout'&&e.cohort==='holdout'){
  s.operation.holdoutKills=(s.operation.holdoutKills||0)+1;
  s.stats.holdoutDefeated=(s.stats.holdoutDefeated||0)+1;
 }
 if(source==='payload'||source==='wake'){const key=source==='payload'?'payloadKills':'wakeKills';s.stats[key]=(s.stats[key]||0)+1;}
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
 const xp=e.type==='rifle'&&s.operation?RULES.campaignDirector.rifleXp[s.operation.region]:RULES.enemies[e.type]?.xp||1;dropXp(s,e.x,e.y,xp);
 const flavor=source==='payload'?'arc':kind==='fire'?'fire':null;
 if(flavor)e.deathFlavor=flavor;
 emit(s,'kill',e.x,e.y,{angle:s.player.aim,...(flavor?{flavor}:{})});
 const rank=moduleRank(s,'catalyst');if(rank&&e.burn>0&&!e.burnDepth&&['native','dot','wake'].includes(source)){const others=alive(s).filter(o=>o!==e&&distance(e,o)<100).sort((a,b)=>distance(e,a)-distance(e,b)).slice(0,rank);for(const other of others){burn(other,RULES.modules.catalyst.burnDamagePerSecond[rank-1],2,1);emit(s,'fire-spread',e.x,e.y,{x2:other.x,y2:other.y,life:.25});}}
}
function activateFrontTactic(s,e,kind,source,owner){
 const b=s.boss,tactic=frontTactic(s),p=s.player;
 if(!tactic||source==='front-relay')return;
 const gap=distance(p,b),index=s.operation.region;
 const cycle=index===1&&s.operation.tactic==='signal'&&b.mode==='aim'?b.cycle+1:b.cycle;
 if(b.tacticCycle===cycle)return;
 if(s.operation.tactic==='heat'){
  if(kind!=='fire'||!['native','wake'].includes(source)||gap>tactic.range||tactic.side&&Math.abs(p.x-b.x)<tactic.side)return;
  b.tacticCycle=cycle;
  emit(s,'overheat',e.x,e.y,{life:.4,text:'냉각 차단 · 장갑 과열'});
 }else{
  const linked=source==='native'&&s.weapons.some(w=>w.uid===owner&&(w.fusion||w.id==='r'&&kind==='blast'));
  if(gap<tactic.range||!(kind==='electric'||source==='payload'||linked))return;
  const target=[...b.parts,b].find(part=>part!==e&&part.hp>0&&!lineBlocked(s,e,part));
  if(!target)return;
  b.tacticCycle=cycle;
  if(index===1&&b.mode==='recover')b.timer+=tactic.delay;
  if(index===2)b.spawnClock=Math.max(b.spawnClock,tactic.delay);
  s.effects.push({type:'lightning',x:e.x,y:e.y,x2:target.x,y2:target.y,age:0,life:.35});
  emit(s,'weakpoint',target.x,target.y,{life:1,text:index===1?'포대 역송 · 재장전 지연':'포탑 역송 · 증원 호출 지연'});
  damage(s,target,tactic.hop,'electric','front-relay');
 }
 s.stats.frontTactics??={};
 s.stats.frontTactics[index]=(s.stats.frontTactics[index]||0)+1;
}
function coastStrikeDamage(s,target,kind,source,owner){
 const b=s.boss;
 if(target!==b||!b.active||b.dead)return 0;
 const plan=coastStrike(s);
 if(!plan||s.operation.coastStrikeUsed)return 0;
 if(s.operation.coastStrike==='f'){
  const rear=Math.cos(Math.atan2(s.player.y-b.y,s.player.x-b.x)-b.body)<COAST_CHARGE.rearDot;
  if(b.mode!=='recover'||!rear||kind!=='fire'||source!=='native')return 0;
  b.timer+=plan.delay;
  emit(s,'break',b.x,b.y,{text:'연료관 점화 · 엔진 노출 연장',life:1.3});
 }else{
  if(b.mode!=='windup'||kind!=='blast'||distance(s.player,b)<plan.range)return 0;
  const weapon=s.weapons.find(w=>w.uid===owner);
  if(!(source==='native'&&weapon?.id==='r'||source==='payload'&&weapon?.fusion?.secondary==='r'))return 0;
  b.mode='recover';b.timer=COAST_CHARGE.recover;
  delete b.chargePath;
  emit(s,'barrage-cancel',target.x,target.y,{text:'신호탄 명중 · 돌진 차단',life:1.3});
 }
 s.operation.coastStrikeUsed=true;
 return plan.damage;
}
function damage(s,e,amount,kind='bullet',source='native',owner=null,weight=0,breachLane){
 if(e.hp<=0||e.dead)return;
 const catalyst=moduleRank(s,'catalyst');if(kind==='blast'&&e.burn>0&&catalyst)amount*=1+RULES.modules.catalyst.blastBonusOnBurn[catalyst-1];
 amount*=1+s.boosts.power*.01;
 const breach=s.operation?.support==='breach';
 if(e===s.boss.parts[0]&&s.operation?.region===2){
  if((source==='native'||source==='payload'||source==='focus')&&(breachLane??(portBreachFlank(s)&&!lineBlocked(s,s.player,e)))){
   amount*=PORT_SUPPORT.breach.boost;recordSupportUse(s);
   const lethal=e.hp<=amount;
   if(s.boss.mode==='salvo'&&s.boss.turretSuppressedCycle!==s.boss.cycle){
    const cancelled=clearPortRounds(s,'turret');
    if(!lethal)s.boss.turretSuppressedCycle=s.boss.cycle;
    if(cancelled)recordHarborPayoff(s,'salvos');
    if(cancelled||!lethal)emit(s,'barrage-cancel',e.x,e.y,{life:1.2,text:cancelled?'철갑 명중 · 포탑탄 차단':'철갑 명중 · 후속 탄막 차단'});
   }
   if(lethal)emit(s,'weakpoint',e.x,e.y,{life:1.2,text:'철갑 급탄 · 포탑 파괴'});
  }else if(portTurretShutter(s))amount*=PORT_TURRET.shutterDamage;
 }else if(e.type==='part'&&breach&&s.operation.region!==2){
  amount*=1.55;recordSupportUse(s);
 }
 if(e.type==='boss'){
  const b=s.boss,a=Math.atan2(s.player.y-b.y,s.player.x-b.x),rear=Math.cos(a-b.body)<COAST_CHARGE.rearDot;
  const recover=b.mode==='recover',armored=b.parts.some(p=>p.hp>0);
  if(s.operation?.region===2){
   if(!recover)amount*=armored?.65:1.15;
   else if(source!=='support'&&(!armored||portCoreDisrupted(s)))amount*=1.6;
  }else if(s.operation?.region===1)amount*=armored?.5:recover?1.5:1;
  else amount*=recover&&rear?1.5:Math.cos(a-b.body)>.35?.65:1;
 }
 const railSignal=s.operation?.region===1&&s.operation.tactic==='signal';
 if(s.boss.active&&(s.boss.mode==='recover'||railSignal)&&(e.type==='boss'||e.type==='part')){
  activateFrontTactic(s,e,kind,source,owner);
  if(e.dead)return;
  if(s.operation?.tactic==='heat'&&s.boss.tacticCycle===s.boss.cycle)amount*=frontTactic(s).boost;
 }
 if(e.type==='shield'&&kind==='bullet'&&Math.cos(Math.atan2(s.player.y-e.y,s.player.x-e.x)-e.aim)>.45)amount*=breach?.65:.45;
 amount+=coastStrikeDamage(s,e,kind,source,owner);
 const actual=e.part||e,before=actual.hp;actual.hp=Math.max(0,actual.hp-amount);e.hp=actual.hp;e.hurt=.10;actual.hurt=.1;
 if(s.operator==='marco'&&source==='native'&&actual.hp<before&&s.player.focusChargeAt<=s.t&&s.player.charge<100&&distance(s.player,e)<=RULES.marco.chargeReach+e.r&&!lineBlocked(s,s.player,e)){
  const p=s.player,gain=Math.min(100-p.charge,RULES.marco.directCharge);
  p.charge+=gain;p.focusChargeAt=s.t+RULES.marco.chargeInterval;s.stats.focusGained=(s.stats.focusGained||0)+gain;
 }
 if(['rifle','shield','mortar','officer'].includes(e.type)){const dx=e.x-s.player.x,dy=e.y-s.player.y,d=Math.hypot(dx,dy)||1,push=(kind==='blast'?RULES.combatFeel.blastPush:RULES.combatFeel.bulletPush)*(e.type==='shield'?RULES.combatFeel.shieldPushMultiplier:1);move(s,e,dx/d*push,dy/d*push,e.r);}
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
  if(s.operation?.region===1)stopRailGun(s,actual);
  if(s.operation?.region===2){
   const turret=actual===s.boss.parts[0];
   if(!turret)delete s.boss.harborCounter;
   if(clearPortRounds(s,turret?'turret':'rake'))emit(s,'barrage-cancel',e.x,e.y,{life:1.1,text:turret?'포탑 파괴 · 포탑탄 차단':'측면 장갑 파괴 · 가로 포격 차단'});
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
 e.dead=true;e.death=.3;scoreKill(s,e,source,kind);
}
function feed(s,owner,weight,target,breachLane){
 if(moduleRank(s,'coil')){s.coil+=weight;const r=moduleRank(s,'coil'),d=RULES.modules.coil;if(s.coil>=d.threshold[r-1]&&s.coilCd<=0){s.coil-=d.threshold[r-1];s.coilCd=d.cooldown;s.stats.coilBursts++;const near=targets(s).filter(e=>e.hp>0&&distance(e,target)<150).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,d.targets[r-1]);for(const e of near){s.effects.push({type:'lightning',x:target.x,y:target.y,x2:e.x,y2:e.y,age:0,life:.18});damage(s,e,d.damage[r-1],'electric','module');}}}
 const w=s.weapons.find(w=>w.uid===owner);if(w?.fusion){const cfg=RULES.fusion;w.payload=Math.min(cfg.hitsPerPayload,w.payload+weight);if(w.payload>=cfg.hitsPerPayload&&w.payloadCd<=0){w.payload-=cfg.hitsPerPayload;w.payloadCd=cfg.payloadCooldown;
  const near=payloadTargets(s,target,42);
  const opposite=target.waveGroup==null?null:near.find(e=>e.waveGroup!=null&&(e.waveGroup^1)===target.waveGroup);
  const next=opposite||near.find(e=>distance(e,target)>=100)||near[0];
  s.stats.payloadBursts=(s.stats.payloadBursts||0)+1;
  if(next&&launchPayload(s,w,target,next,cfg.payloadDamage,false,breachLane))emit(s,'payload',target.x,target.y,{life:.25});
  else blast(s,target.x,target.y,cfg.payloadRadius,cfg.payloadDamage,'payload',w.uid,w.fusion.branch==='incendiary',undefined,breachLane);
 }}
}
function payloadTargets(s,origin,min){return targets(s).filter(e=>e.hp>0&&distance(e,origin)>=min&&distance(e,origin)<300&&!lineBlocked(s,origin,e)).sort((a,b)=>distance(a,origin)-distance(b,origin));}
function launchPayload(s,w,origin,target,amount,relay,breachLane){
 const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
 return fire(s,w,target,angle,amount,{rocket:true,radius:RULES.fusion.payloadRadius,source:'payload',homing:w.fusion.branch==='homing',incendiary:w.fusion.branch==='incendiary',origin,ignore:origin.id,avoidGroup:origin.waveGroup!==target.waveGroup?origin.waveGroup:null,relay,breachLane});
}
function blast(s,x,y,r,amount,source='native',owner=null,ignite=false,effect=source==='payload'?'payload-impact':'explosion',breachLane){
 emit(s,effect,x,y,{r,life:.4});let budget=2;
 for(const e of (source==='support'?alive(s):targets(s,breachLane))){
  if(e.hp<=0||distance(e,{x,y})>r+e.r||lineBlocked(s,{x,y},e))continue;
  const w=source==='native'?Math.min(.5,budget):0,before=e.hp;
  budget-=w;damage(s,e,amount,'blast',source,owner,w,breachLane);
  if(effect==='shrapnel'&&e.hp<before){
   s.stats.shrapnelHits=(s.stats.shrapnelHits||0)+1;
   if(e.dead&&Object.hasOwn(RULES.enemies,e.type))s.stats.shrapnelKills=(s.stats.shrapnelKills||0)+1;
  }
  if(ignite&&e.hp>0)burn(e);
 }
 for(const b of s.blocks)if(b.hp>0&&Math.hypot(b.x+b.w/2-x,b.y+b.h/2-y)<r+Math.max(b.w,b.h)/2)b.hp=Math.max(0,b.hp-amount);
 if((source==='native'||source==='payload')&&moduleRank(s,'shrapnel')&&!(s.shrapnelCd>0)){s.shrapnelCd=.65;s.stats.shrapnelBursts=(s.stats.shrapnelBursts||0)+1;for(let i=0;i<3;i++){const a=i*TAU/3;blast(s,x+Math.cos(a)*50,y+Math.sin(a)*50,42,20,'module',null,false,'shrapnel');}}
 if(ignite&&s.zones.length<12)s.zones.push({x,y,r:r*.65,dps:12,life:2,tick:.3,source:'dot'});
}
function fire(s,w,target,a,amount,opts={}){
 if(s.shots.length>=320)return false;const d=weaponStats(w),rocket=opts.rocket??w.id==='r',origin=opts.origin,source=opts.source||'native',evolved=w.evolved&&!w.fusion;
 const speed=rocket?source==='payload'?RULES.fusion.payloadSpeed:300:700;
 const breachLane=s.operation?.region===2&&s.operation.support==='breach'?(opts.breachLane??(
  portBreachFlank(s)&&!lineBlocked(s,s.player,partPosition(s,s.boss.parts[0]))
 )):undefined;
 s.shots.push({x:origin?origin.x:s.player.x+Math.cos(a)*22,y:origin?origin.y:s.player.y+Math.sin(a)*22,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:d.range/speed,damage:amount,r:rocket?7:3,rocket,radius:opts.radius??d.radius,source,owner:w.uid,target:target?.id,homing:opts.homing??w.branch==='homing',incendiary:opts.incendiary??w.branch==='incendiary',bounces:Math.min(4,(w.branch==='ricochet'?1:0)+moduleRank(s,'ricochet')),hitIds:opts.ignore?[opts.ignore]:[],...(breachLane!==undefined?{breachLane}:{}),...(source==='payload'?{speed,arming:.12,relay:opts.relay,avoidGroup:opts.avoidGroup??null}:evolved&&!rocket?{pierce:1}:evolved&&w.id==='r'?{salvo:true}:{})});return true;
}
export function activeManeuver(p){
 if(p.maneuver==='assault'&&p.moving&&p.assaultTime>0)return 'assault';
 if(p.maneuver==='brace'&&!p.moving&&p.stillTime>=.45)return 'brace';
 return null;
}
function shoot(s,w){
 const d=weaponStats(w),p=s.player,candidates=attackTargets(s,d.range),target=targetFor(s,w,d,candidates);if(!target){const b=s.blocks.find(b=>b.hp>0&&distance({x:b.x+b.w/2,y:b.y+b.h/2},p)<150);if(b){b.hp=Math.max(0,b.hp-d.damage);p.attack=.1;emit(s,'impact',b.x+b.w/2,b.y+b.h/2);return true;}return false;}if(w.id!=='f'&&s.shots.length+d.count+(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7?1:0)>320)return false;
 const damageScale=activeManeuver(p)==='brace'?1.25:1;
 const a=Math.atan2(target.y-p.y,target.x-p.x);p.aim=a;p.attack=.12;
 if(w.id==='f'){
  const catalyst=moduleRank(s,'catalyst'),focused=w.branch==='focused';
  for(const e of candidates){
   const angle=Math.atan2(e.y-p.y,e.x-p.x),delta=Math.atan2(Math.sin(angle-a),Math.cos(angle-a));
   if(Math.abs(delta)>=d.cone*Math.PI/360)continue;
   burn(e,w.evolved?(focused&&e===target?36:24):RULES.modules.catalyst.burnDamagePerSecond[catalyst-1]||6,w.evolved?2:1.5);
   damage(s,e,d.damage*damageScale,'fire','native',w.uid,0);
  }
  emit(s,'flame',p.x,p.y,{angle:a,r:d.range,cone:d.cone,life:.14,evolved:w.evolved});
  if(w.branch==='trail'&&w.shots%6===0&&p.moving&&s.zones.filter(z=>z.owner===w.uid).length<(w.evolved?4:3)){
   const reach=w.evolved?Math.min(120,distance(p,target)*.65):0;
   s.zones.push({x:p.x+Math.cos(a)*reach,y:p.y+Math.sin(a)*reach,r:w.evolved?74:50,dps:w.evolved?56:12,life:w.evolved?2.3:2,tick:.25,source:w.evolved?'wake':'dot',owner:w.uid});
  }
 }else{
  const ordered=[target,...candidates.filter(e=>e.id!==target.id)];
  for(let i=0;i<d.count;i++){const t=ordered[i%ordered.length],angle=Math.atan2(t.y-p.y,t.x-p.x)+(ordered.length===1?(i-(d.count-1)/2)*.035:0);fire(s,w,t,angle,d.damage*damageScale);}
  if(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7){const marked=markedBlastTarget(s,candidates,target),angle=Math.atan2(marked.y-p.y,marked.x-p.x);fire(s,w,marked,angle,60,{rocket:true,radius:100,homing:false,incendiary:false});}emit(s,w.id==='r'?'rocket-shot':'shot',p.x+Math.cos(a)*28,p.y-18+Math.sin(a)*28,{angle:a,life:.08});
 }
 w.shots++;return true;
}
function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
function detonate(s,q){
 const effect=q.source==='payload'?'payload-impact':q.salvo?'salvo-impact':'explosion';
 const before=s.stats.payloadKills||0;
 blast(s,q.x,q.y,q.radius,q.damage,q.source,q.owner,q.incendiary,effect,q.breachLane);q.life=0;
 if(q.source!=='payload'||q.relay||(s.stats.payloadKills||0)-before<2)return;
 const owner=s.weapons.find(w=>w.uid===q.owner&&w.fusion),next=payloadTargets(s,q,q.radius+22)[0];
 if(owner&&next&&launchPayload(s,owner,q,next,RULES.fusion.payloadDamage*.8,true,q.breachLane)){
  s.stats.payloadRelays=(s.stats.payloadRelays||0)+1;
  emit(s,'payload-relay',q.x,q.y,{x2:next.x,y2:next.y,life:.32});
 }
}
function updateShots(s,dt){
 for(const q of s.shots){q.life-=dt;if(q.life<=0)continue;if(q.arming>0)q.arming-=dt;const old={x:q.x,y:q.y};
  if(q.homing){let target=targets(s).find(e=>e.id===q.target&&e.hp>0);if(!target)target=targets(s).filter(e=>e.hp>0&&!q.hitIds.includes(e.id)&&(q.avoidGroup==null||e.waveGroup!==q.avoidGroup)).sort((a,b)=>distance(a,q)-distance(b,q))[0];if(target){q.target=target.id;const a=Math.atan2(q.vy,q.vx),wanted=Math.atan2(target.y-q.y,target.x-q.x),delta=Math.atan2(Math.sin(wanted-a),Math.cos(wanted-a)),angle=a+clamp(delta,-dt*2.8,dt*2.8),speed=q.source==='payload'?(q.speed??Math.hypot(q.vx,q.vy)):300;q.vx=Math.cos(angle)*speed;q.vy=Math.sin(angle)*speed;}}
  q.x+=q.vx*dt;q.y+=q.vy*dt;
  const wall=blocked(s,q.x,q.y,q.r);if(wall){
   if(q.rocket)detonate(s,q);
   else{if(wall.hp>0)wall.hp=Math.max(0,wall.hp-q.damage);emit(s,'impact',q.x,q.y);}
   q.life=0;continue;
  }
  for(const e of targets(s,q.breachLane)){if(e.hp<=0||q.hitIds.includes(e.id)||segmentDistance(e.x,e.y,old.x,old.y,q.x,q.y)>e.r+q.r)continue;
   if(q.arming>0&&q.target!==e.id||q.avoidGroup!=null&&q.avoidGroup===e.waveGroup)continue;
   q.hitIds.push(e.id);if(q.rocket){detonate(s,q);break;}
   const wasBounce=q.pierce===undefined?q.hitIds.length>1:!!q.reflected;
  const angle=e===s.raid?.target?Math.atan2(-q.vy,-q.vx):null,screened=angle!=null&&raidOnNose(s,angle);
   const amount=screened?q.damage*RULES.raidContracts.armored.bulletFrontMultiplier:q.damage;
   damage(s,e,amount,'bullet',q.source,q.owner,q.hitIds.length>1?.35:1,q.breachLane);
   if(wasBounce)s.stats.ricochetHits++;
   emit(s,screened?'armor-impact':'impact',screened?q.x:e.x,screened?q.y:e.y,{life:.12,angle});
   if(q.pierce>0){q.pierce--;q.damage*=.72;emit(s,'pierce',e.x,e.y,{angle:Math.atan2(q.vy,q.vx),life:.18});break;}
   if(q.bounces>0){const next=targets(s).filter(t=>t.hp>0&&!q.hitIds.includes(t.id)&&distance(t,e)<180&&!lineBlocked(s,e,t)).sort((a,b)=>distance(a,e)-distance(b,e))[0];if(next){q.bounces--;q.reflected=true;q.damage*=.7;q.x=e.x;q.y=e.y;const a=Math.atan2(next.y-e.y,next.x-e.x);q.vx=Math.cos(a)*700;q.vy=Math.sin(a)*700;q.life=Math.max(q.life,.28);s.effects.push({type:'ricochet',x:e.x,y:e.y,x2:next.x,y2:next.y,age:0,life:.1});break;}}
   q.life=0;break;
  }
 }
 s.shots=s.shots.filter(q=>q.life>0);
}
function hurt(s,amount,x,y){const p=s.player;if(p.invuln>0||p.dash>0||p.hp<=0)return;const actual=amount*(moduleRank(s,'overcharger')?1.15:1);p.hp=Math.max(0,p.hp-actual);s.stats.damageTaken+=actual;p.hurt=.2;p.invuln=.65;const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1;move(s,p,dx/d*RULES.combatFeel.pilotHitPush,dy/d*RULES.combatFeel.pilotHitPush,16);emit(s,'hurt',p.x,p.y);}
function enemyShot(s,e,a){if(s.enemyShots.length<100)s.enemyShots.push({x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,life:3,r:5});}
function separateEnemies(s,dt){
 const crowd=alive(s),cells=new Map(),forces=crowd.map(()=>({x:0,y:0})),cell=56,limit=RULES.combatFeel.crowdSeparationSpeed*dt;
 crowd.forEach((e,i)=>{const key=`${Math.floor(e.x/cell)},${Math.floor(e.y/cell)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);});
 crowd.forEach((a,i)=>{const cx=Math.floor(a.x/cell),cy=Math.floor(a.y/cell);for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const j of cells.get(`${x},${y}`)||[]){if(j<=i)continue;const b=crowd[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),gap=(a.r+b.r)*.9;if(d>=gap)continue;const angle=((i+1)*2.399963+(j+1)*.7),nx=d>.001?dx/d:Math.cos(angle),ny=d>.001?dy/d:Math.sin(angle),push=Math.min(limit,(gap-d)*.5);forces[i].x-=nx*push;forces[i].y-=ny*push;forces[j].x+=nx*push;forces[j].y+=ny*push;}});
 crowd.forEach((e,i)=>{const f=forces[i],length=Math.hypot(f.x,f.y);if(length)move(s,e,f.x*Math.min(1,limit/length),f.y*Math.min(1,limit/length),e.r);});
}
function updateEnemies(s,dt){
 const p=s.player;let incoming=null;
 for(const e of s.enemies){if(e.dead){e.death-=dt;continue;}e.spawnAge+=dt;e.hurt=Math.max(0,e.hurt-dt);e.timer-=dt;e.walk+=dt*e.speed*.12;
  updateBurn(s,e,dt);if(e.dead)continue;
  const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,desired=Math.atan2(dy,dx);
  if(e.type==='shield'){const delta=Math.atan2(Math.sin(desired-e.aim),Math.cos(desired-e.aim)),turn=RULES.enemies.shield.turnRadiansPerSecond*dt;e.aim+=clamp(delta,-turn,turn);}else e.aim=desired;
  if(e.type==='mortar'&&d<COAST_MORTAR.range){
   if(e.timer<=0&&coastMortarWait(s,e)<=0){
    e.timer=2.8;
    const coast=e.cohort==='coast-guard';
    const duration=COAST_MORTAR.warning;
    s.hazards.push({x:p.x,y:p.y,r:48,timer:duration,age:0,...(coast?{coastMortar:e.siteId,fromX:e.x,fromY:e.y}:null)});
    emit(s,'warning',p.x,p.y,{r:48,life:duration});
    if(coast)emit(s,'mortar-fire',e.x,e.y,{life:.21});
   }
  }else{
   const before={x:e.x,y:e.y},speed=e.speed*(e.hurt>0&&e.type!=='officer'?RULES.combatFeel.hurtMoveMultiplier:1);
   const wing=e.coastWing===-1||e.coastWing===1?e.coastWing:0;
   const spread=wing*COAST_WING.offset*clamp((COAST_WING.release-e.spawnAge)/(COAST_WING.release-COAST_WING.hold),0,1);
   const x=dx+spread,len=spread?Math.hypot(x,dy)||1:d;
   move(s,e,x/len*speed*dt,dy/len*speed*dt,e.r);
   if(e.x===before.x&&e.y===before.y)move(s,e,-dy/len*speed*dt,x/len*speed*dt,e.r);
  }
  if(e.type==='officer'&&d<420&&e.timer<=0){e.timer=2.4;for(let i=-2;i<=2;i++)enemyShot(s,e,e.aim+i*.18);emit(s,'enemy-fire',e.x,e.y,{life:.2});}
 }
 separateEnemies(s,dt);
 for(const e of alive(s))if(e.spawnAge>.5&&distance(e,p)<e.r+16){const amount=RULES.enemies[e.type].contactDamage||12;if(!incoming||amount>incoming.amount)incoming={amount,x:e.x,y:e.y};}
 for(const q of s.enemyShots){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(blocked(s,q.x,q.y,q.r))q.life=0;if(distance(q,p)<21){q.life=0;if(!incoming||incoming.amount<10)incoming={amount:10,x:q.x,y:q.y};}}
 for(const h of s.hazards){h.timer-=dt;if(h.timer<=0&&!h.hit){h.hit=true;emit(s,h.lane?'barrage':'explosion',h.x,h.y,{r:h.r,w:h.w,h:h.h,life:.3});if((h.lane?Math.abs(p.x-h.x)<h.w/2+16&&Math.abs(p.y-h.y)<h.h/2+16:distance(h,p)<blastContactRadius(h))&&(!incoming||incoming.amount<14))incoming={amount:14,x:h.x,y:h.y};}}
 s.enemyShots=s.enemyShots.filter(q=>q.life>0);s.hazards=s.hazards.filter(h=>h.timer>-.3);s.enemies=s.enemies.filter(e=>!e.dead||e.death>0);
 if(incoming&&(!s.hitCandidate||incoming.amount>s.hitCandidate.amount))s.hitCandidate=incoming;
}

function stopRailGun(s,part){
 const railGun=s.boss.parts.indexOf(part);
 if(railGun<0)return;
 const pending=s.hazards.find(h=>h.lane&&!h.hit&&railGunOf(h)===railGun);
 if(!pending)return;
 s.hazards=s.hazards.filter(h=>h!==pending);
 emit(s,'barrage-cancel',part.x,part.y,{life:1.1,text:`${railGun===0?'좌측':'우측'} 포대 파괴 · 포격 차단`});
}
function startRailBarrage(s,warning){
 const b=s.boss,p=s.player,plan=RAIL_BARRAGE;
 const early=s.sites.some(site=>site.kind==='relay'&&site.state==='done')?.4:0;
 const duration=plan.warning+early+warning;
 b.timer=duration+.2;
 const near=p.x===b.x?b.cycle%2:p.x<b.x?0:1;
 const lead=b.parts[near]?.hp>0?near:1-near,wing=1-lead;
 const left=Math.max(FIELD.left,p.x-plan.width/2),right=Math.min(FIELD.right,p.x+plan.width/2);
 const push=(x,w,railGun,tracked)=>s.hazards.push({x,y:plan.y,w,h:plan.depth,r:0,lane:true,railGun,tracked,timer:duration,duration});
 push((left+right)/2,right-left,lead,true);
 if(b.parts[wing]?.hp>0)push(b.x+(wing===0?-1:1)*plan.outerOffset,plan.width,wing,false);
 emit(s,'boss-warning',b.x,b.y,warning?{text:'선발 지원 · 첫 조준 경고 +1초',life:1}:{life:1});
}
function startPortBarrage(s,warning){
 const {boss:b,player:p}=s,plan=PORT_BARRAGE,axis=portBarrageAxis(s,b.cycle);
 const duration=plan.warning+warning,horizontal=axis==='horizontal';
 const jammed=horizontal&&b.parts[1].hp>0&&portJamsSweep(s,b.cycle);
 const rounds=portBarrageRounds(s,b.cycle);
 for(const round of rounds)s.hazards.push({
  ...round,timer:duration,duration,
  ...(round.portRound==='lock'?{portAxis:axis,...(jammed?{jammed:true}:{})}:{})
 });
 const mark=portBarrageMark(axis,b.parts[0].hp>0?portTurretSide(b):0);
 const message=jammed?'관제소 교란 · 장갑탄 차단':rounds.some(h=>h.portRound==='rake')?`가로 포격 ${mark}`:horizontal?'장갑탄 차단 · 발밑 포격':`세로 포격 ${mark}`;
 emit(s,'boss-warning',p.x,p.y,{text:warning?`${message} · 선행 경보 +1초`:message,life:1});
}
function clearPortRounds(s,round){
 const before=s.hazards.length;
 s.hazards=s.hazards.filter(h=>h.portRound!==round||h.hit);
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
 const b=s.boss,armor=b.parts[1];
 delete b.harborCounter;
 const cancelled=clearPortRounds(s,'rake');
 Object.assign(armor,partPosition(s,armor));
 damage(s,armor,PORT_SUPPORT.recovery.counterDamage,'blast','support');
 recordHarborPayoff(s,'counterfire');
 if(cancelled)recordHarborPayoff(s,'rakes');
 emit(s,'aid-counter',armor.x,armor.y,{life:.72,text:cancelled?'지원 포격 · 가로 포격 차단':'지원 포격 · 측면 장갑 명중'});
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
    else{
     for(let i=-4;i<=4;i++)enemyShot(s,b,b.aim+i*.16);
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
  else{b.mode='aim';b.timer=index===1?1.4:1.7;}
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
  else if(b.mode==='recover'){b.mode='aim';b.timer=1.4;const angle=Math.atan2(p.y-b.y,p.x-b.x),count=b.parts[0].hp>0?5:3;for(let i=0;i<count;i++)enemyShot(s,b,angle+(i-(count-1)/2)*.19);b.kick=1;b.flash=.12;}
  else{
   b.mode='windup';b.timer=COAST_CHARGE.warning;b.body=Math.atan2(p.y-b.y,p.x-b.x);
   lockCoastCharge(s);
   emit(s,'boss-warning',b.x,b.y,{angle:b.body,life:COAST_CHARGE.warning});
  }
 }
 b.aim=b.mode==='charge'||b.mode==='windup'?b.body:Math.atan2(p.y-b.y,p.x-b.x);
 if(b.spawnClock<=0){b.spawnClock=5;for(let i=0;i<6;i++)spawnAround(s,i===0?'shield':'rifle');}
 if(distance(b,p)<b.r+16&&(!s.hitCandidate||s.hitCandidate.amount<16))s.hitCandidate={amount:16,x:b.x,y:b.y};
}
function frontControlCards(index){
 const orders=Object.entries(FRONT_TACTICS[index]).map(([key,t])=>({id:`control:${key}`,kind:'control',key,title:t.name,desc:t.impact,label:t.role}));
 if(index===1)return [...orders,{id:'control:supply',kind:'control',key:'supply',title:'중계기 보급 회수',desc:'보유 병기를 개조하거나 새 무장과 모듈을 확보합니다.',label:'일반 보급'}];
 return [...orders,
  {id:'control:jam',kind:'control',key:'jam',title:'증원 통신 교란',desc:'첫 가로 포격의 장갑탄을 차단하고, 보스 증원과 포격병 투입을 절반으로 줄입니다.',label:'최종전 안전'},
  {id:'control:loot',kind:'control',key:'loot',title:'시험 탄약 노획',desc:'희귀 모듈·재보급 3후보 중 하나를 받습니다.',label:'추가 화력'}];
}
function updateSites(s,dt){
 if(s.stage==='boss')return;
 for(const site of s.sites){
  if(site.id==='supply-b'&&site.state==='waiting'){site.baseX??=site.x;site.x=site.baseX+Math.sin(s.t*.35)*55;}
  const dock=s.operation?.region===2&&site.id==='port-landing'&&site.gantry===true;
  if(dock&&s.stage!=='field')continue;
  const garrison=s.operation?.region===1?railGarrison(site):null;
  const approach=dock?PORT_LANDING:garrison||coastApproach(site);
  if(site.coastApproach&&s.sites[0].state!=='done')continue;
  if(site.state==='waiting'&&distance(site,s.player)<(approach?.range??215)){
   const count=approach?.guards.length??(site.kind==='relay'?3:site.kind==='armory'?5:s.operation?.region===0?4:6),reserve=alive(s).length+count-160;
   if(reserve>0){const remove=new Set(alive(s).filter(e=>!e.siteId&&(!s.operation||e.cohort==='ambient')&&!s.challenge?.targets?.includes(e.id)&&distance(e,s.player)>280).sort((a,b)=>distance(b,s.player)-distance(a,s.player)).slice(0,reserve).map(e=>e.id));s.enemies=s.enemies.filter(e=>!remove.has(e.id));}
   if(alive(s).length+count>160)continue;
   site.state='active';
   const mirrored=dock&&site.x>800||garrison&&mapSeed(s.seed,1)%2===0;
   const cohort=garrison?'rail-guard':site.coastApproach?'coast-guard':null;
   for(let i=0;i<count;i++){
    const angle=i*TAU/6;
    const guard=site.kind==='armory'&&i===0?'officer':i===1&&!site.opening?'shield':'rifle';
    const [type,x,y]=approach?approach.guards[i]:[guard,Math.cos(angle)*85,Math.sin(angle)*65];
    const extra=cohort?{cohort}:{};
    if(site.coastPlan==='split'&&site.coastApproach==='f')extra.coastWing=Math.sign(x);
    if(site.coastApproach==='r'&&approach.firstSalvo){
     const near=(s.player.x<=site.x)===(x<0);
     extra.timer=approach.firstSalvo[near?0:1];
    }
    spawnEnemy(s,type,site.x+(mirrored?-x:x),site.y+y,site.id,extra);
   }
   emit(s,'engage',site.x,site.y);
  }
  if(site.kind==='relay'&&site.state==='active'&&distance(site,s.player)<125){
   if(!railCrewLeft(s,site))site.progress=Math.min(5,site.progress+dt);
  }
  if(site.state==='active'&&(site.kind==='relay'?site.progress>=5:!s.enemies.some(e=>!e.dead&&e.siteId===site.id))){site.state='ready';s.stats.sitesCleared=(s.stats.sitesCleared||0)+1;s.stats.score+=400;emit(s,'supply-ready',site.x,site.y,{life:.8});}
  if(site.state==='ready'&&distance(site,s.player)<SITE_PICKUP_RANGE){site.state='done';
   if(s.operation?.region===0&&s.operation.order==='wire'&&site.id==='arsenal'){
    s.operation.orderDone=true;
    emit(s,'supply-ready',site.x,site.y,{text:'전파 절단 · 귀환 시 지령 보상',life:1.4});
   }
   if(dock){
    s.operation.portDock=true;
    emit(s,'port-hatch',site.x,site.y,{text:'측면 해치 개방 · 작전도에 통로 표시',life:1.6});
    return;
   }
   if(site.kind==='control'||site.kind==='relay'&&s.operation?.region===1)openChoice(s,'control',frontControlCards(s.operation.region),site.name);
   else if(site.kind==='armory'){const quality=rollQuality(s,'normal');openChoice(s,'armory',armoryCards(s,quality),site.name,{quality,siteId:site.id});}
   else if(site.id==='rail-cache'&&s.operation?.region===1)openChoice(s,'rail-workshop',railWorkshopCards(s),site.name);
   else openChoice(s,'supply',supplyCards(s,site),site.name,site.opening?{opening:true}:site.coastApproach?{siteId:site.id}:{});
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
 const flame=showcase==='flame',approach=s.stage==='boss'?Math.atan2(p.y-s.boss.y,p.x-s.boss.x):p.aim;
 const pair=flame?[[0,190],[0,264]]:[[-.34,205],[.48,248]];
 const plans=!flame&&remaining>=12?[[[-.75,208],[.1,224],[.93,242]],pair]:[pair];
 for(const lanes of plans){
  const count=lanes.length*4;
  if(crowd.length+count>160)continue;
  for(let i=0;i<8;i++){
   const heading=approach+i*TAU/8;
   const centers=lanes.map(([offset,reach])=>({x:p.x+Math.cos(heading+offset)*reach,y:p.y+Math.sin(heading+offset)*reach}));
   const cos=flame?Math.cos(heading):1,sin=flame?Math.sin(heading):0;
   const packs=centers.map(({x,y})=>[[-18,-20],[18,-20],[-18,20],[18,20]].map(([dx,dy])=>({x:x+dx*cos-dy*sin,y:y+dx*sin+dy*cos})));
   if(centers.some((q,j)=>j>0&&lineBlocked(s,centers[j-1],q))||packs.flat().some(q=>q.x<65||q.x>1535||q.y<65||q.y>1135||distance(p,q)<155||blocked(s,q.x,q.y,22)||lineBlocked(s,p,q)||s.boss.active&&distance(q,s.boss)<s.boss.r+28||crowd.some(e=>distance(q,e)<32)))continue;
   for(let group=0;group<packs.length;group++)for(const q of packs[group])spawnEnemy(s,'rifle',q.x,q.y,null,{cohort:'ambient',showcase,...(flame?{}:{waveGroup:pulse*4+group})});
   for(const q of centers)emit(s,'formation',q.x,q.y,{life:.75,showcase,angle:Math.atan2(p.y-q.y,p.x-q.x)});
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
   const before=wave.remaining;
   for(let i=0;i<8&&wave.remaining>0;i++)if(spawnAround(s,'rifle',{cohort:'ambient'},360))wave.remaining--;
   if(wave.remaining===before){wave.clock=.25;return;}
  }
  wave.paired--;wave.clock=.9;
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
  if(s.player.hp<=0||distance(s.player,DEFENSE_ZONE)>DEFENSE_ZONE.r)return false;
  challenge.progress+=dt;challenge.strike-=dt;
  if(challenge.progress<challenge.duration){
   if(challenge.strike<=0){
    const {x,y}=s.player;
    s.hazards.push({x,y,r:42,timer:.95,duration:.95});
    challenge.strike=2.7;
   }
   return false;
  }
 }else if(challenge.type==='intercept'){
  const target=challenge.target;
  updateBurn(s,target,dt);
  if(target.hp>0){
   challenge.timeLeft=Math.max(0,challenge.timeLeft-dt);
   Object.assign(target,signalPosition(challenge.lane,challenge.timeLeft));
   if(challenge.timeLeft===0){challenge.state='failed';emit(s,'challenge-failed',s.player.x,s.player.y,{text:'통신 차량 이탈 · 재도전 가능',life:1.6});}
   return false;
  }
 }else if(challenge.targets.some(id=>s.enemies.some(e=>e.id===id&&!e.dead)))return false;
 return true;
}
function updateChallenge(s,dt){
 const challenge=s.challenge;
 if(challenge?.state!=='active')return;
 const tier=challenge.tier||1;
 if(!challenge.secured){
  if(!challengeObjectiveDone(s,challenge,dt))return;
  challenge.secured=true;
 }
 if(s.operation?.region<2&&tier===1&&(s.operation.holdoutKills||0)<HOLDOUT.rareKills)return;
 challenge.state='complete';
 s.stats.challenge=Math.max(s.stats.challenge,tier);s.stats.challengeWins=(s.stats.challengeWins||0)+1;
 if(s.operation){
  s.operation.challengeTier=tier;
  if(tier===1&&s.player.hp>0){
   s.player.invuln=Math.max(s.player.invuln,.5);
   openChoice(s,'pursuit-reward',pursuitReward(s),`${holdoutContract(s).name} 완료 · 보급 한 가지 선택`,s.operation.region<2?{quality:'rare'}:{});
  }
 }
 s.stats.score+=500*tier;
 emit(s,'challenge-clear',s.player.x,s.player.y,{text:`잔류 도전 ${tier} 완료 · +${500*tier}`,life:1.5});
}

function startChallenge(s){
 if(s.stage!=='holdout'||s.raid?.state==='active'||s.challenge?.state==='active'||s.challenge&&!s.operation)return false;
 const tier=(s.operation?.challengeTier||0)+1;
 const contract=holdoutContract(s);
 if(contract.id==='defend'){
  s.challenge={type:'defend',state:'active',tier,progress:0,strike:.8,duration:defenseSeconds(tier)};
 }else if(contract.id==='intercept'){
  const hp=Math.round(1050*1.22**Math.min(24,tier-1));
  const lane=signalLane(s.seed),timeLeft=SIGNAL_SECONDS;
  s.challenge={type:'intercept',state:'active',tier,lane,timeLeft,target:{id:'signal',type:'courier',...signalPosition(lane,timeLeft),r:34,hp,maxHp:hp,dead:false}};
 }else{
  const ids=[],hp=Math.round(450*1.22**Math.min(24,tier-1));
  for(const dx of [-220,220]){
   const kit={hp,maxHp:hp,cohort:'challenge'},x=clamp(s.player.x+dx,100,1500),y=clamp(s.player.y-240,100,1100);
   const enemy=blocked(s,x,y,26)?spawnAround(s,'officer',kit,null,50):spawnEnemy(s,'officer',x,y,null,kit);
   if(enemy)ids.push(enemy.id);
  }
  if(ids.length<2){s.enemies=s.enemies.filter(e=>!ids.includes(e.id));return false;}
  s.challenge={type:'hunt',state:'active',tier,targets:ids};
 }
 emit(s,'challenge-start',s.player.x,s.player.y,{text:`${contract.name} · D${tier}`,life:1.25});
 return true;
}

export function interaction(s){
 if(s.phase!=='playing'||s.player.hp<=0)return null;
 const gantry=portGantry(s);
 if(gantry&&distance(s.player,gantry)<64)return{id:'boss',gantry,blocked:s.raid?.state==='active',label:'측면 해치 · 기습 진입'};
 if(s.stage==='field'&&distance(s.player,{x:800,y:350})<130)return{id:'boss',blocked:s.raid?.state==='active',label:`${s.operation?region(s).boss:'장갑 수송차'} 도전`};
 const gate=exitGate(s);
 return gate&&distance(s.player,gate)<(s.operation?92:140)?{id:'extract',label:s.operation?.region===2?'귀환 선택':'전진 · 잔류 선택'}:null;
}
function focusWeakPoint(s,target){
 const b=s.boss,front=s.operation.region;
 if(b.mode!=='recover')return false;
 if(target.type==='part')return true;
 if(target!==b)return false;
 if(front>0)return b.parts.every(p=>p.hp<=0)||portCoreDisrupted(s);
 const angle=Math.atan2(s.player.y-b.y,s.player.x-b.x);
 return Math.cos(angle-b.body)<COAST_CHARGE.rearDot;
}
function fireFocus(s,cfg){
 const p=s.player,lane=focusLane(s),hits=[];
 for(const enemy of targets(s)){
  const x=enemy.x-p.x,y=enemy.y-p.y,depth=x*lane.dx+y*lane.dy,side=Math.abs(x*lane.dy-y*lane.dx);
  if(enemy.hp>0&&depth>0&&depth<=lane.length&&side<=lane.width+enemy.r&&!lineBlocked(s,p,enemy))hits.push({enemy,depth,side,weak:focusWeakPoint(s,enemy)});
 }
 const isArmor=hit=>hit.enemy.type==='boss'||hit.enemy.type==='part';
 const armor=hits.filter(isArmor).sort((a,b)=>Number(b.weak)-Number(a.weak)||a.side-b.side||a.depth-b.depth)[0];
 const impacts=hits.filter(hit=>!isArmor(hit)||hit===armor).sort((a,b)=>a.depth-b.depth).slice(0,cfg.targets);
 s.stats.focusUses=(s.stats.focusUses||0)+1;
 s.stats.focusHits=(s.stats.focusHits||0)+impacts.length;
 s.stats.focusWeakHits=(s.stats.focusWeakHits||0)+impacts.filter(hit=>hit.weak).length;
 p.attack=.14;p.aim=lane.angle;
 for(const {enemy,weak} of impacts){
  const screened=enemy===s.raid?.target&&raidOnNose(s,Math.atan2(-lane.dy,-lane.dx));
  damage(s,enemy,cfg.damage*(weak?cfg.weakMultiplier:1)*(screened?RULES.raidContracts.armored.bulletFrontMultiplier:1),'bullet','focus');
  emit(s,'pierce',enemy.x,enemy.y,{angle:lane.angle,life:.17});
 }
 emit(s,'focus-shot',p.x,p.y,{angle:lane.angle,length:lane.length,width:lane.width,life:.22,text:impacts.some(hit=>hit.weak)?'관통 사격 · 약점 직격':undefined});
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
 if(s.phase!=='playing')return false;const p=s.player;
 if(kind==='upgrade'){if(!canOpenLevel(s))return false;openLevel(s);return true;}
 if(kind==='gear'){openAssembly(s,assemblyOptions(s));return true;}
 if(kind==='dash'){
  if(p.dashCd>0)return false;
  const b=s.boss;
  delete p.portRush;delete p.portCutX;
  if(s.operation?.region===2&&s.operation.support==='overrun'&&b.active&&!b.dead){
   if(distance(p,b)>portCoreReach(b))p.portRush=true;
   else p.portCutX=p.x;
  }
  p.dash=.18;p.dashCd=2;p.invuln=Math.max(p.invuln,.30);
  if(p.maneuver==='assault')p.assaultTime=1.25;
  emit(s,'dash',p.x,p.y,{angle:p.aim,life:.2});return true;
 }
 if(kind==='skill'){
  if(!canUseSkill(s))return false;
  if(portAidCounterReady(s))fireHarborAidCounter(s);
  const cfg=skillRules(s);p.charge-=cfg.cost;p.skillCd=cfg.cooldown;
  if(s.operator==='marco'){p.moveAim=aimFromInput(input,p.moveAim);fireFocus(s,cfg);}
  else{p.overdrive=cfg.duration;emit(s,'skill',p.x,p.y,{text:'전탄 보급',life:.7});}
  return true;
 }
 if(kind==='challenge')return startChallenge(s);
 if(kind==='interact'){
  const item=interaction(s);if(!item||item.blocked)return false;
  if(item.id==='extract'){if(s.operation)openChoice(s,'clear',exitCards(s),'열린 출구');else finish(s,true);return true;}
  if(item.gantry)s.operation.portEntry='gantry';
  const dock=s.operation?.region===2&&s.sites.find(site=>site.id==='port-landing');
  if(dock?.state==='active')dock.state='waiting';
  s.stage='boss';s.refits=0;s.boss.active=true;s.boss.mode='aim';s.boss.timer=1.3;
  p.x=item.gantry?.x??800;p.y=item.gantry?.y??470;
  if(!(s.operation?.region>0))clearCoastOverlap(s,p,16,{x:800,y:350});
  p.invuln=Math.max(p.invuln,1);
  s.enemies=s.enemies.filter(e=>(!e.dead&&(e.showcase||e.siteId)||distance(e,s.boss)<400)&&(!dock||e.siteId!==dock.id));
  s.enemyShots=[];s.hazards=[];
  if(item.gantry)emit(s,'port-ambush',800,250,{text:'측면 기습 · 포탑 사선 확보',life:1.3});
  else emit(s,'boss-arrival',800,250,{life:1.3});
  return true;
 }
 return false;
}
export function finish(s,won=false,reason='retreat'){
 if(s.phase==='result')return false;won=!!won&&s.stats.bossKilled&&(!s.operation||s.operation.cleared===3&&s.operation.extracted===true)&&s.player.hp>0;if(won&&!s.stats.extractionPaid){s.stats.score+=3000;s.stats.extractionPaid=true;}
 withdrawRaid(s);if(s.challenge?.state==='active')s.challenge.state='withdrawn';
 s.phase='result';s.result={runId:s.runId||null,...(s.operator?{operator:s.operator}:{}),balanceRevision:s.balanceRevision||'b05-campaign',won,reason:won?'prototype-complete':s.player.hp<=0?'prototype-failed':reason,seed:s.seed,seconds:s.t,score:s.stats.score,level:s.level,weapons:clone(s.weapons),modules:clone(s.modules),stats:clone(s.stats),...(s.operation?{operation:clone(s.operation)}:{})};s.choice=null;s.choices=[];return true;
}
function updateCampaignAmbient(s,dt){
 const cfg=RULES.campaignDirector,index=s.operation.region;s.director??={pack:0,officerClock:cfg.officerInterval[index]};const director=s.director;
 const ambient=type=>alive(s).filter(e=>e.cohort==='ambient'&&e.type===type).length;
 const spawn=type=>{const e=spawnAround(s,type,{cohort:'ambient'});if(e){s.stats.directorSpawns??={rifle:0,shield:0,mortar:0,officer:0};s.stats.directorSpawns[type]++;}return e;};
 s.spawnClock-=dt;if(s.spawnClock<=0){s.spawnClock=cfg.packInterval;director.pack++;const special=index>0||s.pressure>0?(director.pack%2?'shield':'mortar'):null,count=Math.min(cfg.packCap,cfg.basePack[index]+s.pressure);for(let i=0;i<count;i++){const type=i===0&&special&&ambient(special)<cfg.ambientCaps[special]?special:'rifle';spawn(type);}}
 director.officerClock-=dt;if(director.officerClock<=0){director.officerClock=cfg.officerInterval[index];if((index>0||s.pressure>1)&&ambient('officer')<cfg.ambientCaps.officer){const e=spawn('officer');if(e)emit(s,'officer-arrival',e.x,e.y,{text:'장교 증원 · 부채 사격 주의',life:.9});}}
 if(s.pressure>=4){s.pursuitClock=(s.pursuitClock??1)-dt;if(s.pursuitClock<=0){s.pursuitClock=Math.max(4,18-s.pressure);if(!alive(s).some(e=>e.cohort==='pursuit')){const hp=300*Math.pow(1.12,s.pressure-3);spawnAround(s,'officer',{hp,maxHp:hp,cohort:'pursuit'});}}}
}
function updateHoldout(s,dt){
 const tier=holdoutTier(s.holdTime);
 if(tier===0)return;
 s.spawnClock-=dt;
 if(s.spawnClock>0)return;
 s.spawnClock=Math.max(.9,2.1-tier*.2);
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
export function step(s,dt,input={x:0,y:0},view=null){
 if(s.phase!=='playing')return;dt=clamp(dt,0,1/30);if(!dt)return;if(view)s.view={w:view.w,h:view.h};s.hitCandidate=null;s.t+=dt;if(s.operation)s.operation.regionTime+=dt;const p=s.player;
 if(s.stage==='holdout')s.holdTime+=dt;const pressure=s.stage==='holdout'?s.clearPressure+(s.operation?holdoutTier(s.holdTime):Math.floor(s.holdTime/30)):Math.floor((s.operation?.regionTime??s.t)/60);if(pressure>s.pressure){s.pressure=pressure;emit(s,'pressure',p.x,p.y,{text:s.operation&&s.stage==='holdout'?`잔류 공세 ${holdoutTier(s.holdTime)}단계`:`경계 ${pressure} · 증원 강화`,life:1.3});}
 const wasDashing=p.dash>0;
 for(const key of ['invuln','hurt','attack','dash','dashCd','skillCd','pickupTime'])p[key]=Math.max(0,p[key]-dt);
 const previousOverdrive=p.overdrive;p.overdrive=Math.max(0,p.overdrive-dt);if(previousOverdrive>0&&p.overdrive===0&&moduleRank(s,'overcharger'))blast(s,p.x,p.y,180,140,'module');
 if(s.operator!=='marco')p.charge=Math.min(100,p.charge+(s.stage==='boss'?2:.5)*dt);
 s.coilCd=Math.max(0,s.coilCd-dt);s.heatCd=Math.max(0,s.heatCd-dt);for(const cd of ['medicCd','thermalCd','shrapnelCd'])s[cd]=Math.max(0,(s[cd]||0)-dt);
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.max(1,Math.hypot(ix,iy)),moving=Math.hypot(ix,iy)>.07;p.moving=moving;
 const b=s.boss,coreDash=p.dash>0&&portCoreWindow(s),coreReach=portCoreReach(b);
 const coreEntry=coreDash&&p.portRush&&distance(p,b)>coreReach;
 if(moving){const speed=p.dash>0?650:190*(p.pickupTime>0?1+moduleRank(s,'magnet')*.03:1);move(s,p,ix/len*speed*dt,iy/len*speed*dt,16);p.walk+=speed*dt*.05;if(s.operator==='marco')p.moveAim=Math.atan2(iy,ix);}
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
 const cadence=(p.overdrive>0?.65:1)*(activeManeuver(p)==='assault'?.78:1);
 for(const w of s.weapons){w.cd-=dt;w.payloadCd=Math.max(0,w.payloadCd-dt);if(w.cd<=0){const fired=shoot(s,w);w.cd=fired?weaponStats(w).interval*cadence:0;}}
 updateShots(s,dt);
 for(const z of s.zones){z.life-=dt;z.tick-=dt;if(z.tick<=0){z.tick=.25;for(const e of targets(s))if(e.hp>0&&distance(z,e)<z.r+e.r&&!lineBlocked(s,z,e)){burn(e);damage(s,e,z.dps*.25,'fire',z.source==='wake'?'wake':'dot');}}}s.zones=s.zones.filter(z=>z.life>0);
 // A burning gun can be destroyed on the final warning tick, before its shells land.
 if(s.operation?.region>0&&b.active&&!b.dead)for(const part of b.parts)updateBurn(s,part,dt);
 updateEnemies(s,dt);updateBoss(s,dt);if(s.hitCandidate)hurt(s,s.hitCandidate.amount,s.hitCandidate.x,s.hitCandidate.y);delete s.hitCandidate;
 const crate=s.boss.harborSupply;
 const aidInReach=crate&&s.boss.active&&!s.boss.dead&&p.hp>0&&distance(p,crate)<PORT_SUPPORT.recovery.reach&&!lineBlocked(s,p,crate);
 const early=aidInReach&&portAidWindow(s,p);
 // Keep a safe crate available until the pilot clears the edge of the warning.
 if(aidInReach&&(early||!portAidWindow(s))){
  const kit=PORT_SUPPORT.recovery,hp=p.hp,charge=p.charge;
  const rearmed=early&&p.dashCd>kit.dashDelay;
  p.hp=Math.min(p.maxHp,hp+kit.heal);p.charge=Math.min(100,charge+(early?kit.warningCharge:kit.charge));
  if(rearmed)p.dashCd=kit.dashDelay;
  if(s.boss.parts[1].hp>0){s.boss.harborCounter=true;s.operation.harborPayoff??={};}
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
  if(s.operation){
   if(s.operation.region<2){s.tuning++;p.hp=Math.min(p.maxHp,p.hp+15);}
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
