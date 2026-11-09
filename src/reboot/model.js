import {REGIONS,RESEARCH,MANEUVERS,FRONT_SUPPORTS,DEFENSE_ZONE,SIGNAL_ROUTE,defenseSeconds,holdoutContract,signalCourier,region,regionLayout,regionBoss,gatePosition,exitGate,holdoutTier,HOLDOUT} from './campaign.js';
import {RULES,VERSION,FIELD,GUNS,MODULES,QUALITY,makeWeapon,tags,moduleRank,moduleGain,compatible,completionModules,refitWeapons,heatSynergyReady,weaponStats,distance,clamp,layout} from './content.js';
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
export function createOperation(seed=17,research=[],trial=null){
 const s=createRun(seed);s.operation={region:0,cleared:0,regionTime:0,history:[],jammed:false};s.research=[...research];s.trials=(Array.isArray(trial)?[...trial]:[trial]).filter(Boolean);s.trial=s.trials[0]||null;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[0]};for(const e of s.enemies)e.cohort='ambient';s.stats.sitesCleared=0;s.stats.fusionBosses=0;s.stats.flameBosses=0;Object.assign(s,regionLayout(seed,0));s.boss=regionBoss(0);return s;
}
function advanceRegion(s){
 if(!s.operation||s.stage!=='holdout'||!s.boss.dead||s.operation.region>=2)return false;
 withdrawRaid(s);
 s.operation.support=s.operation.nextSupport||null;delete s.operation.nextSupport;
 s.operation.history.push({region:s.operation.region,time:s.operation.regionTime,pressure:s.pressure,holdTime:s.holdTime,sites:s.sites.filter(n=>n.state==='done').length});s.operation.region++;s.operation.regionTime=0;s.operation.jammed=false;s.operation.challengeTier=0;delete s.operation.gate;delete s.pursuitClock;s.director={pack:0,officerClock:RULES.campaignDirector.officerInterval[s.operation.region]};
 Object.assign(s,regionLayout(s.seed+s.operation.region*7919,s.operation.region));s.boss=regionBoss(s.operation.region);s.stage='field';s.pressure=0;s.holdTime=0;s.challenge=null;s.raid=null;s.raidUsed=false;s.enemies=[];s.shots=[];s.enemyShots=[];s.hazards=[];s.zones=[];s.gems=[];s.effects=[];s.events=[];s.spawnClock=1;s.player.x=800;s.player.y=1040;s.player.invuln=1;s.player.dash=0;s.choice=null;s.choices=[];s.phase='playing';
 if(s.stats.completedBuild)s.powerWave={delay:3,remaining:60,clock:0};
 for(let i=0;i<10;i++)spawnAround(s,i===0?'officer':'rifle',{cohort:'ambient'},360,30);emit(s,'region-entry',800,1040,{text:`${s.operation.region+1}/3 · ${region(s).name}`,life:1.6});nextChoice(s);return true;
}
function exitCards(s){
 const stay={id:'stay',kind:'stay',title:'남아서 더 성장',desc:'바닥 XP를 회수하고 증원군을 상대합니다. 게이트는 계속 열려 있습니다.',label:'잔류 성장'};
 if(s.operation&&s.operation.region<2)return [{id:'advance',kind:'advance',title:`${REGIONS[s.operation.region+1].name} 진입`,desc:'무장·체력·XP 유지. 남은 상자와 바닥 XP는 두고 전진합니다.',label:'다음 전선'},stay,{id:'extract',kind:'extract',title:'확보 보상으로 중도귀환',desc:'현재까지의 크레딧을 정산합니다. 최종 완주 보너스는 없습니다.',label:'작전 중단'}];
 return [{id:'extract',kind:'extract',title:'살아서 귀환',desc:'최종 작전 보상과 기록을 확정합니다.',label:'작전 완수'},stay];
}
export const snapshot=s=>clone(s);
export const canResumeRevision=revision=>[RULES.balanceRevision,'b09-front-contracts','b08-pursuit-supply','b07-open-gates','b06-swarms'].includes(revision);
export function restore(raw,{allowPrevious=false}={}){
 const s=clone(raw);if(!allowPrevious&&!canResumeRevision(s.balanceRevision))throw Error('이전 규칙의 저장 판은 확보 성과를 정산한 뒤 새로 출격해야 합니다.');if(s.version!==VERSION||!Number.isSafeInteger(s.seed)||!s.rng||!s.player||!Array.isArray(s.weapons)||s.weapons.length<1||s.weapons.length>3||!Array.isArray(s.modules)||s.modules.length>4||!Array.isArray(s.sites)||!s.stats||!['playing','choice','paused','result'].includes(s.phase))throw Error('저장 형식을 확인할 수 없습니다.');
 for(const w of s.weapons)if(!GUNS[w.id]||!Number.isInteger(w.level)||w.level<1||w.level>6||w.branch&&!GUNS[w.id].branches[w.branch])throw Error('무장 저장이 손상됐습니다.');
 for(const m of s.modules)if(!MODULES[m.id]||!Number.isInteger(m.rank)||m.rank<1||m.rank>3)throw Error('모듈 저장이 손상됐습니다.');
 if(!Number.isFinite(s.player.hp)||s.player.hp<0||!Number.isFinite(s.player.maxHp)||s.player.maxHp<=0||s.player.hp>s.player.maxHp||!Number.isFinite(s.t)||s.t<0||s.tuning<0||s.rerolls<0||s.banishes<0)throw Error('작전 저장이 손상됐습니다.');
 const fail=()=>{throw Error('전투 체크포인트가 손상됐습니다.');};
 if(!['field','boss','holdout'].includes(s.stage)||!Array.isArray(s.boss?.parts)||!Array.isArray(s.queue)||!Array.isArray(s.choices)||!['map','supply','combat','loot'].every(k=>Number.isInteger(s.rng[k])))fail();
 for(const key of ['enemies','shots','enemyShots','gems','zones','hazards','effects','excluded','seenGuns','offeredWeapons'])if(!Array.isArray(s[key]))fail();
 if(new Set(s.modules.map(m=>m.id)).size!==s.modules.length||s.modules.some(m=>RULES.modules[m.id].unique&&m.rank!==1)||new Set(s.weapons.map(w=>w.uid)).size!==s.weapons.length||s.weapons.some(w=>typeof w.uid!=='string'))fail();
 if(s.operation&&(!Array.isArray(s.research)||s.research.some(id=>!RESEARCH[id])||s.trial&&!s.research.includes(s.trial)||s.trials&&(!Array.isArray(s.trials)||s.trials.some(id=>!s.research.includes(id)))||!Number.isInteger(s.operation.region)||s.operation.region<0||s.operation.region>2||!Number.isInteger(s.operation.cleared)||s.operation.cleared<0||s.operation.cleared>3||!Number.isFinite(s.operation.regionTime)||!Array.isArray(s.operation.history)))fail();
 if(s.operation){
  s.trials??=s.trial?[s.trial]:[];
  if([s.operation.support,s.operation.nextSupport].some(id=>id!=null&&!Object.hasOwn(FRONT_SUPPORTS,id)))fail();
 }
 if(s.player.maneuver&&!Object.hasOwn(MANEUVERS,s.player.maneuver))fail();
 const kinds=new Set(['advance','control','rank','module','gun','evolve','fusion','tune','repair','utility','refit','resupply','back','stay','extract','maneuver','permit','front-support','cargo']);
 const cardsOk=cards=>Array.isArray(cards)&&cards.length>0&&cards.every(c=>(c.kind!=='resupply'||Number.isFinite(c.heal)&&Number.isFinite(c.charge)&&c.heal>=0&&c.charge>=0)&&typeof c.id==='string'&&kinds.has(c.kind)&&(!c.weapon||GUNS[c.weapon])&&(!c.module||MODULES[c.module])&&(!['rank','gun','evolve'].includes(c.kind)||!!GUNS[c.weapon])&&(!['module','tune'].includes(c.kind)||!!MODULES[c.module])&&(c.kind!=='module'||Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=3));
 if((s.phase==='choice'||s.resumePhase==='choice')&&(!s.choice||!['level','supply','armory','raid-reward','pursuit-reward','assembly','clear','control'].includes(s.choice.type)||!cardsOk(s.choices)))fail();
 if(s.phase==='result'&&(!s.result||typeof s.result.won!=='boolean'||!Number.isFinite(s.result.score)||!Number.isFinite(s.result.seconds)||!s.result.stats||!Array.isArray(s.result.weapons)||!Array.isArray(s.result.modules)||s.result.weapons.some(w=>!GUNS[w.id])||s.result.modules.some(m=>!MODULES[m.id])))fail();
 if(s.choice?.type==='assembly'){const ids=new Set([...assemblyOptions(s).map(c=>c.id),'back']);if(!s.choices.some(c=>c.id==='back'&&c.kind==='back')||s.choices.some(c=>!ids.has(c.id)))fail();}
 if(s.choice?.type==='clear'&&!s.stats.bossKilled)fail();
 if(s.queue.some(q=>!cardsOk(q.cards)))fail();if(s.raid&&(!['active','success','failed','withdrawn'].includes(s.raid.state)||!RULES.raidContracts[s.raid.contract]||!Number.isFinite(s.raid.progress)||!Number.isFinite(s.raid.target?.hp)))fail();
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
 if(s.challenge?.type==='intercept'&&(!Number.isFinite(s.challenge.timeLeft)||!Number.isFinite(s.challenge.target?.hp)||!Number.isFinite(s.challenge.target?.maxHp)))fail();
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
function modulePool(s){return ['ricochet','coil','catalyst','magnet',...(s.research||[])].filter(id=>!s.excluded.includes(id)&&compatible(s,id)&&moduleRank(s,id)<(RULES.modules[id].unique?1:3));}
function currentInvestments(s){return[...upgradeable(s).map(gunCard),...s.modules.filter(m=>!RULES.modules[m.id].unique&&m.rank<3).map(m=>moduleCard(m.id,1))];}
const trialModule=(s,pool)=>(s.trials||[s.trial]).find(id=>pool.includes(id));
function supplyCards(s,site){
 const guns=upgradeable(s),cards=[guns.length?gunCard(pick(s,'supply',guns)):currentInvestments(s)[0]||utility('health')];
 const unseen=['h','r','f'].filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id)&&!(s.supplyCount<2&&s.seenGuns.includes(id)));
 if(unseen.length){const id=unseen.includes(site?.gun)?site.gun:pick(s,'supply',unseen);cards.push({id:`gun:${id}`,kind:'gun',weapon:id,title:`${GUNS[id].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:id===site?.gun?'이 동선의 주력 무장':'새 무기'});if(!s.seenGuns.includes(id))s.seenGuns.push(id);}
 const pool=modulePool(s);let favored=pool;
 if(s.supplyCount<2){const focus=s.weapons.find(w=>w.id===s.firstNew)||s.weapons[0],requirements=Object.values(RULES.weapons[focus.id].evolution.moduleByBranch).flat();const useful=pool.filter(id=>requirements.includes(id));if(useful.length)favored=useful;}
 if(pool.length){const trial=trialModule(s,pool),id=trial||(pool.includes(site?.module)?site.module:pick(s,'supply',favored));cards.push({...moduleCard(id),...(id===trial?{label:'새 연구 · 첫 실전'}:id===site?.module?{label:'이 동선의 특화 모듈'}:{})});}
 return fillCards(s,cards);
}
function fillCards(s,cards){const unique=[...new Map(cards.filter(Boolean).map(c=>[c.id,c])).values()];for(const key of ['health','charge','power'])if(unique.length<3&&!unique.some(c=>c.id===`utility:${key}`))unique.push(utility(key));return unique.slice(0,3);}
function levelCards(s){
 const investments=currentInvestments(s),guns=upgradeable(s),missed=guns.filter(w=>!s.offeredWeapons.slice(-2).some(ids=>ids.includes(w.id))),a=guns.length?gunCard(pick(s,'supply',missed.length?missed:guns)):investments[0];
 const rest=investments.filter(c=>c.id!==a?.id);
 const newModules=s.operation&&s.modules.length<4&&(!a||s.modules.length===0||s.level%3===0)?modulePool(s).filter(id=>!moduleRank(s,id)):[];
 const trial=trialModule(s,newModules);
 const b=newModules.length?{...moduleCard(trial||pick(s,'supply',newModules)),label:trial?'새 연구 · 첫 실전':'새 발동 모듈'}:rest.length?pick(s,'supply',rest):null;
 const cards=fillCards(s,[a,b,utility(s.boosts.pickup<3&&rng(s,'supply')<.45?'pickup':'health')]);
 if(!a&&!b)return [utility('power'),utility('health'),utility('charge')];
 s.offeredWeapons.push(cards.filter(c=>c.kind==='rank').map(c=>c.weapon));return cards;
}
function rollQuality(s,key){const p=RULES.quality[key],r=rng(s,'loot');return r<p.common?'common':r<p.common+p.rare?'rare':'prototype';}
function armoryCards(s,quality){
 const cards=[],pool=modulePool(s),amount=quality==='common'?1:quality==='rare'?2:3;
 if(quality==='prototype'&&!moduleRank(s,'overcharger'))cards.push(moduleCard('overcharger',1));
 const trial=trialModule(s,pool);if(trial){cards.push({...moduleCard(trial,amount),label:'새 연구 · 첫 실전'});pool.splice(pool.indexOf(trial),1);}
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
function openChoice(s,type,cards,source='',extra={}){s.phase='choice';s.choice={type,source,...extra};s.choices=cards;}
function nextChoice(s){if(s.phase!=='playing')return;if(s.queue.length){const item=s.queue.shift();openChoice(s,item.type,item.cards,item.source,item.extra);return;}if(s.pendingLevels>0){s.pendingLevels--;openChoice(s,'level',levelCards(s),`LEVEL ${s.level}`);}}
export function assemblyOptions(s){
 const options=s.operation&&s.stats.challengeWins>0&&!s.player.maneuver?Object.entries(MANEUVERS).map(([key,m])=>({id:`maneuver:${key}`,kind:'maneuver',key,title:m.name,desc:m.impact,label:'노획 교범 · 한 판에 하나'})):[];
 if(s.tuning<=0)return options;
 for(const w of s.weapons){if(w.level!==6||w.evolved||w.fusion||!w.branch)continue;const ms=RULES.weapons[w.id].evolution.moduleByBranch[w.branch];if(ms.some(id=>moduleRank(s,id)>=2))options.push({id:`evolve:${w.id}`,kind:'evolve',weapon:w.id,title:GUNS[w.id].evolution,desc:'발사 구조 확장 · 조율권 1 · 모듈 유지',label:'단일 진화'});}
 if(moduleRank(s,'coil')>=2)for(const a of s.weapons)for(const b of s.weapons){if(a===b||a.level<4||b.level<4||a.evolved||b.evolved||a.fusion||b.fusion||!tags(a).includes('bullet')||!tags(b).includes('blast')||s.weapons.some(w=>w.fusion&&w.id===a.id&&w.branch===a.branch&&w.fusion.secondary===b.id&&w.fusion.branch===b.branch))continue;options.push({id:`fusion:${a.id}:${b.id}`,kind:'fusion',primary:a.id,secondary:b.id,title:`전도 격발망 ${GUNS[a.id].short}+${GUNS[b.id].short}`,desc:`${GUNS[a.id].short} 사격 유지 + ${GUNS[b.id].short} 폭발 계승 · 총 2개 → 1칸`,label:'태그 합체'});}
 for(const m of s.modules)if(!RULES.modules[m.id].unique&&m.rank<3)options.push({id:`tune:${m.id}`,kind:'tune',module:m.id,title:`${MODULES[m.id].name} 조율`,desc:`${m.rank} → ${m.rank+1}강화 · 조율권 1`,label:'발동 시너지'});
 options.push({id:'tune:repair',kind:'repair',title:'응급 정비',desc:'최대 HP +15 · 체력 +35 · 조율권 1',label:'생존 투자'});return options;
}
export function choose(s,id,{branch,slot,doctrine,weapon}={}){
 if(s.phase!=='choice')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 if(c.kind==='advance'){if(!s.operation||s.stage!=='holdout'||!s.boss.dead||s.operation.region>=2)return false;s.stats.choices.push({id:'advance',region:s.operation.region,t:s.t});return advanceRegion(s);}
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen&&!['reserve','quick'].includes(doctrine))return false;
 if(c.kind==='rank'){const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);if(!w||w.level>=6||w.evolved)return false;if(w.level===3&&!GUNS[w.id].branches[branch])return false;w.level++;if(w.level===4)w.branch=branch;}
 else if(c.kind==='module'){
  if(!MODULES[c.module]||!compatible(s,c.module))return false;let m=s.modules.find(m=>m.id===c.module);
  const gain=moduleGain(s,c.module,c.rank);
  if(m){if(m.rank>=3||RULES.modules[m.id].unique)return false;m.rank=gain.next;}else{m={id:c.module,rank:gain.next};if(s.modules.length>=4){if(!Number.isInteger(slot)||!s.modules[slot])return false;s.modules[slot]=m;}else s.modules.push(m);}
  if((s.trials||[s.trial]).includes(c.module)){s.stats.researchTrialPicked=c.module;(s.stats.researchTrialsPicked??=[]).push(c.module);s.trials=(s.trials||[s.trial]).filter(id=>id!==c.module);s.trial=s.trials[0]||null;}
  if(gain.charge){const before=s.player.charge;s.player.charge=Math.min(100,before+gain.charge);s.stats.overflowCharge=(s.stats.overflowCharge||0)+s.player.charge-before;}
 }
 else if(c.kind==='gun'){
  if(s.weapons.some(w=>w.id===c.weapon&&!w.fusion))return false;let w=makeWeapon(c.weapon);const base=1+(s.operation?.region||0);w.level=base;
  if(s.weapons.length>=3||Number.isInteger(slot)&&slot>=0){const old=s.weapons[slot];if(!old||old.evolved||old.fusion)return false;w.level=s.refits>0&&s.stage==='field'?Math.min(5,old.level):Math.min(5,base+Math.floor(Math.max(0,old.level-base)/2));if(w.level>=4){if(!GUNS[w.id].branches[branch])return false;w.branch=branch;}if(s.refits>0&&s.stage==='field')s.refits--;w.uid=`w-${++s.id}`;s.weapons[slot]=w;}else{w.uid=`w-${++s.id}`;s.weapons.push(w);}
  if(!s.firstNew)s.firstNew=w.id;
 }
 else if(c.kind==='evolve'){if(!assemblyOptions(s).some(o=>o.id===id))return false;const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion&&!w.evolved);w.evolved=true;s.tuning--;buildCompleted(s,'single');}
 else if(c.kind==='fusion'){
  if(!assemblyOptions(s).some(o=>o.id===id))return false;const a=s.weapons.find(w=>w.id===c.primary&&!w.fusion),b=s.weapons.find(w=>w.id===c.secondary&&!w.fusion);a.fusion={secondary:b.id,branch:b.branch,overflow:Math.min(4,a.level+b.level-8)};a.level=6;a.evolved=true;s.weapons.splice(s.weapons.indexOf(b),1);s.tuning--;buildCompleted(s,'fusion');
 }else if(c.kind==='maneuver'){if(s.choice.type!=='assembly'||!assemblyOptions(s).some(o=>o.id===id&&o.key===c.key))return false;s.player.maneuver=c.key;s.stats.maneuver=c.key;}
 else if(c.kind==='permit'){if(s.choice.type!=='pursuit-reward'||c.id!=='pursuit:permit'||s.stage!=='holdout'||s.challenge?.state!=='complete'||s.challenge.tier!==1)return false;s.tuning++;}
 else if(c.kind==='front-support'){
  if(s.choice.type!=='pursuit-reward'||!s.operation||s.operation.region>=REGIONS.length-1||!Object.hasOwn(FRONT_SUPPORTS,c.key)||s.operation.nextSupport)return false;
  s.operation.nextSupport=c.key;
 }
 else if(c.kind==='cargo'){
  if(s.choice.type!=='pursuit-reward'||s.operation?.region!==2||s.stats.holdoutCargo)return false;
  s.stats.holdoutCargo=true;
 }
 else if(c.kind==='tune'){const m=s.modules.find(m=>m.id===c.module);if(s.tuning<1||!m||m.rank>=3)return false;m.rank++;s.tuning--;}
 else if(c.kind==='repair'){if(s.tuning<1)return false;s.tuning--;s.player.maxHp+=15;s.player.hp=Math.min(s.player.maxHp,s.player.hp+35);}
 else if(c.kind==='utility'){if(c.key==='health'){s.player.maxHp+=6;s.player.hp=Math.min(s.player.maxHp,s.player.hp+6);}if(c.key==='pickup'){if(s.boosts.pickup>=3)return false;s.boosts.pickup++;}if(c.key==='power')s.boosts.power++;if(c.key==='charge')s.player.charge=Math.min(100,s.player.charge+10);}
 else if(c.kind==='refit'){const w=refitWeapons(s).find(w=>w.id===weapon);if(!w||!GUNS[w.id].branches[branch]||w.branch===branch)return false;w.branch=branch;w.targetId=null;s.stats.fieldRefits=(s.stats.fieldRefits||0)+1;}
 else if(c.kind==='resupply'){if(!Number.isFinite(c.heal)||!Number.isFinite(c.charge)||c.heal<0||c.charge<0)return false;s.player.hp=Math.min(s.player.maxHp,s.player.hp+c.heal);s.player.charge=Math.min(100,s.player.charge+c.charge);}
 else if(c.kind==='back'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else if(c.kind==='control'){if(c.key==='jam')s.operation.jammed=true;else s.queue.push({type:'armory',source:'관제소 시험 탄약',cards:armoryCards(s,'rare'),extra:{quality:'rare'}});}
 else if(c.kind==='extract'){if(s.operation&&s.operation.cleared===3)s.operation.extracted=true;finish(s,true);return true;}
 else if(c.kind==='stay'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else return false;
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen){if(!['reserve','quick'].includes(doctrine))return false;s.player.doctrine=doctrine;s.player.branchChosen=true;}
 s.stats.choices.push({t:Math.round(s.t*10)/10,id,branch:branch||null,weapon:weapon||null,source:s.choice.type,contract:s.choice.contract||null,quality:s.choice.quality||null});if(s.choice.type==='supply')s.supplyCount++;s.phase='playing';s.choice=null;s.choices=[];
 if(heatSynergyReady(s))buildCompleted(s,'synergy');
 emit(s,'choose');nextChoice(s);return true;
}
export function reroll(s){if(s.phase!=='choice'||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.rerolls<=0)return false;s.rerolls--;s.choices=s.choice.type==='level'?levelCards(s):s.choice.type==='supply'?supplyCards(s):crateCards(s,s.choice.quality,s.choice.type==='raid-reward'?(s.choice.contract||s.raid?.contract):null);return true;}
export function banishOptions(s){if(s.phase!=='choice'||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.banishes<=0)return[];return s.choices.filter(c=>{const id=c.kind==='gun'?c.weapon:c.kind==='module'?c.module:null;return id&&!s.weapons.some(w=>w.id===id&&!w.fusion)&&(!moduleRank(s,id)||c.support)&&id!=='overcharger'&&!(c.kind==='gun'&&s.supplyCount<2&&['r','f'].filter(id=>!s.excluded.includes(id)).length<=2);});}
export function banish(s,id){const c=banishOptions(s).find(c=>c.id===id);if(!c)return false;const target=c.kind==='gun'?c.weapon:c.module,index=s.choices.indexOf(c);if(!moduleRank(s,target))s.excluded.push(target);s.banishes--;
 const used=new Set([...s.choices.filter(card=>card!==c).map(card=>card.id),c.id]);let replacement;
 if(c.kind==='gun'){const pool=['h','r','f'].filter(g=>!s.excluded.includes(g)&&!s.weapons.some(w=>w.id===g&&!w.fusion)&&!used.has(`gun:${g}`));if(pool.length){const g=pick(s,'supply',pool);replacement={id:`gun:${g}`,kind:'gun',weapon:g,title:`${GUNS[g].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:'새 무기'};}}
 const rank=['armory','raid-reward'].includes(s.choice.type)?({common:1,rare:2,prototype:3})[s.choice.quality]:c.kind==='module'?c.rank:1;
 if(!replacement){let pool=modulePool(s).filter(m=>!used.has(`module:${m}`)),support=false;if(c.support){const needed=completionModules(s).filter(m=>pool.includes(m));if(needed.length){pool=needed;support=true;}}if(pool.length)replacement={...moduleCard(pick(s,'supply',pool),rank),...(support?{support:true,label:'장갑 수송대 · 완성 부품'}:{})};}
 if(!replacement)replacement=(['armory','raid-reward'].includes(s.choice.type)?fillCrate([],s.choice.quality):['health','charge','power'].map(utility)).find(card=>!used.has(card.id));s.choices[index]=replacement;return true;
}
export function skip(s){if(s.phase!=='choice'||['assembly','clear','pursuit-reward'].includes(s.choice.type))return false;if(s.player.hp<s.player.maxHp)s.player.hp=Math.min(s.player.maxHp,s.player.hp+s.player.maxHp*.05);else s.player.charge=Math.min(100,s.player.charge+5);if(s.choice.type==='supply')s.supplyCount++;s.phase='playing';s.choice=null;s.choices=[];nextChoice(s);return true;}

function buildCompleted(s,kind){if(!s.stats.completedBuild)s.stats.completedBuild={kind,t:s.t};if(!s.powerDone){s.powerDone=true;s.powerWave={delay:4,remaining:60,clock:0};emit(s,'complete',s.player.x,s.player.y,{life:1.2,text:kind==='fusion'?'전도 격발망 가동':kind==='single'?'무기 진화 완료':'발동 연계 완성'});}}
export function partPosition(s,part){const b=s.boss;if(s.operation?.region===1)return{x:b.x+part.ox,y:b.y};return{x:b.x+Math.cos(b.body-Math.PI/2)*part.ox,y:b.y+Math.sin(b.body-Math.PI/2)*part.ox};}
function targets(s){const list=alive(s),signal=signalCourier(s);if(signal?.hp>0)list.push(signal);if(s.raid?.state==='active'&&s.raid.target.hp>0)list.push(s.raid.target);if(s.boss.active&&!s.boss.dead){const breach=s.operation?.support==='breach';if(!breach)list.push(s.boss);for(const part of s.boss.parts)if(part.hp>0){Object.assign(part,partPosition(s,part));list.push(part);}if(breach)list.push(s.boss);}return list;}
const blocked=(s,x,y,r=0)=>s.blocks.find(b=>b.hp!==0&&x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
function move(s,e,dx,dy,r){const x=clamp(e.x+dx,FIELD.left+r,FIELD.right-r),y=clamp(e.y+dy,FIELD.top+r,FIELD.bottom-r);if(!blocked(s,x,e.y,r))e.x=x;if(!blocked(s,e.x,y,r))e.y=y;}
function lineBlocked(s,a,b){const n=Math.ceil(distance(a,b)/20);for(let i=1;i<=n;i++)if(blocked(s,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return true;return false;}
function attackTargets(s,range){return targets(s).filter(e=>e.hp>0&&distance(e,s.player)<range+e.r&&!lineBlocked(s,s.player,e)).sort((a,b)=>distance(a,s.player)-distance(b,s.player));}
function targetFor(s,w,d,candidates){
 const locked=candidates.find(e=>e.id===w.targetId);if(locked&&s.t<(w.targetUntil||0))return locked;
 let selected=candidates[0];
 const part=s.operation?.support==='breach'&&candidates.find(e=>e.type==='part');
 if(part&&selected?.type==='boss')selected=part;
 if(w.id==='f'){
  let best=-1;for(const candidate of candidates.slice(0,24)){const a=Math.atan2(candidate.y-s.player.y,candidate.x-s.player.x);let score=0;
   for(const e of candidates){const b=Math.atan2(e.y-s.player.y,e.x-s.player.x);if(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))<d.cone*Math.PI/360)score+=(1+Math.min(e.hp,d.damage)/d.damage*.1)*(['boss','part','courier'].includes(e.type)?6:moduleRank(s,'catalyst')&&e.burn>0?.3:1);}
   if(score>best){best=score;selected=candidate;}
  }
 }else if(w.id==='r')selected=markedBlastTarget(s,candidates,selected,d.radius);
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
function scoreKill(s,e,source){
 if(e.type==='officer'){if(s.player.hp>0&&moduleRank(s,'medic')&&!(s.medicCd>0)){s.player.hp=Math.min(s.player.maxHp,s.player.hp+12);s.medicCd=12;emit(s,'heal',e.x,e.y,{text:'정예 제압 · 체력 +12'});}s.stats.elites++;if(s.stats.elites<=8)s.stats.score+=100;}else{s.stats.kills++;if(s.stats.kills<=(s.operation?900:300))s.stats.score+=10;}
 s.player.charge=Math.min(100,s.player.charge+1*(1+Math.min(.2,s.level*.01)));s.combo++;s.comboTime=2;s.stats.bestCombo=Math.max(s.combo,s.stats.bestCombo);
 const xp=e.type==='rifle'&&s.operation?RULES.campaignDirector.rifleXp[s.operation.region]:RULES.enemies[e.type]?.xp||1;dropXp(s,e.x,e.y,xp);emit(s,'kill',e.x,e.y,{angle:s.player.aim});
 const rank=moduleRank(s,'catalyst');if(rank&&e.burn>0&&!e.burnDepth&&['native','dot'].includes(source)){const others=alive(s).filter(o=>o!==e&&distance(e,o)<100).sort((a,b)=>distance(e,a)-distance(e,b)).slice(0,rank);for(const other of others){burn(other,RULES.modules.catalyst.burnDamagePerSecond[rank-1],2,1);emit(s,'fire-spread',e.x,e.y,{x2:other.x,y2:other.y,life:.25});}}
}
function damage(s,e,amount,kind='bullet',source='native',owner=null,weight=0){
 if(e.hp<=0||e.dead)return;
 const catalyst=moduleRank(s,'catalyst');if(kind==='blast'&&e.burn>0&&catalyst)amount*=1+RULES.modules.catalyst.blastBonusOnBurn[catalyst-1];
 amount*=1+s.boosts.power*.01;
 const breach=s.operation?.support==='breach';
 if(e.type==='part'&&breach)amount*=1.55;
 if(e.type==='boss'){const b=s.boss,a=Math.atan2(s.player.y-b.y,s.player.x-b.x),rear=Math.cos(a-b.body)<-.35;amount*=s.operation?.region===1?(b.parts.some(p=>p.hp>0)?.5:b.mode==='recover'?1.5:1):s.operation?.region===2?(b.parts.some(p=>p.hp>0)?b.mode==='recover'?1:.65:b.mode==='recover'?1.6:1.15):b.mode==='recover'&&rear?1.5:Math.cos(a-b.body)>.35?.65:1;}
 if(e.type==='shield'&&kind==='bullet'&&Math.cos(Math.atan2(s.player.y-e.y,s.player.x-e.x)-e.aim)>.45)amount*=breach?.65:.45;
 if(e.type==='courier'&&kind==='bullet'&&s.raid?.contract==='armored'&&Math.cos(Math.atan2(s.player.y-e.y,s.player.x-e.x)-e.aim)>.5)amount*=.5;
 const actual=e.part||e;actual.hp=Math.max(0,actual.hp-amount);e.hp=actual.hp;e.hurt=.10;actual.hurt=.1;
 if(['rifle','shield','mortar','officer'].includes(e.type)){const dx=e.x-s.player.x,dy=e.y-s.player.y,d=Math.hypot(dx,dy)||1,push=(kind==='blast'?RULES.combatFeel.blastPush:RULES.combatFeel.bulletPush)*(e.type==='shield'?RULES.combatFeel.shieldPushMultiplier:1);move(s,e,dx/d*push,dy/d*push,e.r);}
 if(source==='module')s.stats.moduleDamage+=amount;
 if(kind==='electric'&&e.burn>0&&moduleRank(s,'thermal')&&!(s.thermalCd>0)){s.thermalCd=.25;s.player.charge=Math.min(100,s.player.charge+2);s.stats.thermalCharges=(s.stats.thermalCharges||0)+2;}
 if(source==='native'&&weight>0){feed(s,owner,weight,e);if(kind==='blast'&&e.burn>0&&catalyst&&s.heatCd<=0){s.heatCd=.5;s.stats.heatBursts++;blast(s,e.x,e.y,80,RULES.modules.catalyst.heatBurstDamage[catalyst-1],'module',null,false,'heat');}}
 if(e.dead||e.hp>0)return;
 if(e.type==='part'){emit(s,'break',e.x,e.y,{life:.7});return;}
 if(e.type==='boss'){s.boss.dead=true;s.stats.bossKilled=true;if(s.operation){s.operation.cleared=s.operation.region+1;if(s.weapons.some(w=>w.fusion))s.stats.fusionBosses++;if(s.weapons.some(w=>w.id==='f'&&w.evolved))s.stats.flameBosses++;}s.stats.score+=1000;emit(s,'boss-down',e.x,e.y,{r:e.r,life:1.2});return;}
 if(e===signalCourier(s)){e.dead=true;dropXp(s,e.x,e.y,24,true);emit(s,'break',e.x,e.y);return;}
 if(e.type==='courier'){e.dead=true;s.raid.state='success';s.stats.raidSuccess++;s.stats.score+=300;gainXp(s,12);emit(s,'break',e.x,e.y);emit(s,'raid-success',e.x,e.y,{quality:s.raid.quality,text:`${QUALITY[s.raid.quality]} 보급 탈취`,life:1.4});return;}
 e.dead=true;e.death=.3;scoreKill(s,e,source);
}
function feed(s,owner,weight,target){
 if(moduleRank(s,'coil')){s.coil+=weight;const r=moduleRank(s,'coil'),d=RULES.modules.coil;if(s.coil>=d.threshold[r-1]&&s.coilCd<=0){s.coil-=d.threshold[r-1];s.coilCd=d.cooldown;s.stats.coilBursts++;const near=targets(s).filter(e=>e.hp>0&&distance(e,target)<150).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,d.targets[r-1]);for(const e of near){s.effects.push({type:'lightning',x:target.x,y:target.y,x2:e.x,y2:e.y,age:0,life:.18});damage(s,e,d.damage[r-1],'electric','module');}}}
 const w=s.weapons.find(w=>w.uid===owner);if(w?.fusion){w.payload+=weight;if(w.payload>=10&&w.payloadCd<=0){w.payload-=10;w.payloadCd=.6;const near=targets(s).filter(e=>e.hp>0&&distance(e,target)<300&&!lineBlocked(s,target,e)).sort((a,b)=>distance(a,target)-distance(b,target)),next=near[0];s.stats.payloadBursts=(s.stats.payloadBursts||0)+1;
  emit(s,'payload',target.x,target.y,{life:.25});
  if(next)fire(s,w,next,Math.atan2(next.y-target.y,next.x-target.x),80,{rocket:true,radius:130,source:'payload',homing:w.fusion.branch==='homing',incendiary:w.fusion.branch==='incendiary',origin:target});
  else blast(s,target.x,target.y,130,80,'payload',w.uid,w.fusion.branch==='incendiary');
 }}
}
function blast(s,x,y,r,amount,source='native',owner=null,ignite=false,effect='explosion'){
 emit(s,effect,x,y,{r,life:.4});let budget=2;
 for(const e of (source==='support'?alive(s):targets(s))){if(e.hp<=0||distance(e,{x,y})>r+e.r||lineBlocked(s,{x,y},e))continue;const w=source==='native'?Math.min(.5,budget):0;budget-=w;damage(s,e,amount,'blast',source,owner,w);if(ignite&&e.hp>0)burn(e);}
 for(const b of s.blocks)if(b.hp>0&&Math.hypot(b.x+b.w/2-x,b.y+b.h/2-y)<r+Math.max(b.w,b.h)/2)b.hp=Math.max(0,b.hp-amount);
 if(source==='native'&&moduleRank(s,'shrapnel')&&!(s.shrapnelCd>0)){s.shrapnelCd=.65;s.stats.shrapnelBursts=(s.stats.shrapnelBursts||0)+1;for(let i=0;i<3;i++){const a=i*TAU/3;blast(s,x+Math.cos(a)*50,y+Math.sin(a)*50,42,20,'module',null,false,'shrapnel');}}
 if(ignite&&s.zones.length<12)s.zones.push({x,y,r:r*.65,dps:12,life:2,tick:.3,source:'dot'});
}
function fire(s,w,target,a,amount,opts={}){
 if(s.shots.length>=320)return false;const d=weaponStats(w),rocket=opts.rocket??w.id==='r',origin=opts.origin;s.shots.push({x:origin?origin.x:s.player.x+Math.cos(a)*22,y:origin?origin.y:s.player.y+Math.sin(a)*22,vx:Math.cos(a)*(rocket?300:700),vy:Math.sin(a)*(rocket?300:700),life:d.range/(rocket?300:700),damage:amount,r:rocket?7:3,rocket,radius:opts.radius??d.radius,source:opts.source||'native',owner:w.uid,target:target?.id,homing:opts.homing??w.branch==='homing',incendiary:opts.incendiary??w.branch==='incendiary',bounces:Math.min(4,(w.branch==='ricochet'?1:0)+moduleRank(s,'ricochet')),hitIds:[]});return true;
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
  for(const e of targets(s)){const angle=Math.atan2(e.y-p.y,e.x-p.x),delta=Math.atan2(Math.sin(angle-a),Math.cos(angle-a));if(distance(p,e)<d.range+e.r&&Math.abs(delta)<d.cone*Math.PI/360&&!lineBlocked(s,p,e)){burn(e);damage(s,e,d.damage*damageScale,'fire','native',w.uid,0);}}
  emit(s,'flame',p.x,p.y,{angle:a,r:d.range,cone:d.cone,life:.14});
  if(w.branch==='trail'&&w.shots%6===0&&p.moving&&s.zones.filter(z=>z.owner===w.uid).length<3)s.zones.push({x:p.x,y:p.y,r:50,dps:12,life:2,tick:.25,source:'dot',owner:w.uid});
 }else{
  const ordered=[target,...candidates.filter(e=>e.id!==target.id)];
  for(let i=0;i<d.count;i++){const t=ordered[i%ordered.length],angle=Math.atan2(t.y-p.y,t.x-p.x)+(ordered.length===1?(i-(d.count-1)/2)*.035:0);fire(s,w,t,angle,d.damage*damageScale);}
  if(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7){const marked=markedBlastTarget(s,candidates,target),angle=Math.atan2(marked.y-p.y,marked.x-p.x);fire(s,w,marked,angle,60,{rocket:true,radius:100,homing:false,incendiary:false});}emit(s,w.id==='r'?'rocket-shot':'shot',p.x+Math.cos(a)*28,p.y-18+Math.sin(a)*28,{angle:a,life:.08});
 }
 w.shots++;return true;
}
function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
function updateShots(s,dt){
 for(const q of s.shots){q.life-=dt;if(q.life<=0)continue;const old={x:q.x,y:q.y};
  if(q.homing){let target=targets(s).find(e=>e.id===q.target&&e.hp>0);if(!target)target=targets(s).filter(e=>e.hp>0).sort((a,b)=>distance(a,q)-distance(b,q))[0];if(target){q.target=target.id;const a=Math.atan2(q.vy,q.vx),wanted=Math.atan2(target.y-q.y,target.x-q.x),delta=Math.atan2(Math.sin(wanted-a),Math.cos(wanted-a)),angle=a+clamp(delta,-dt*2.8,dt*2.8);q.vx=Math.cos(angle)*300;q.vy=Math.sin(angle)*300;}}
  q.x+=q.vx*dt;q.y+=q.vy*dt;
  const wall=blocked(s,q.x,q.y,q.r);if(wall){if(q.rocket)blast(s,q.x,q.y,q.radius,q.damage,q.source,q.owner,q.incendiary);else if(wall.hp>0)wall.hp=Math.max(0,wall.hp-q.damage);q.life=0;emit(s,'impact',q.x,q.y);continue;}
  for(const e of targets(s)){if(e.hp<=0||q.hitIds.includes(e.id)||segmentDistance(e.x,e.y,old.x,old.y,q.x,q.y)>e.r+q.r)continue;
   q.hitIds.push(e.id);if(q.rocket){blast(s,q.x,q.y,q.radius,q.damage,q.source,q.owner,q.incendiary);q.life=0;break;}
   const wasBounce=q.hitIds.length>1;damage(s,e,q.damage,'bullet',q.source,q.owner,wasBounce?.35:1);if(wasBounce)s.stats.ricochetHits++;emit(s,'impact',e.x,e.y,{life:.12});
   if(q.bounces>0){const next=targets(s).filter(t=>t.hp>0&&!q.hitIds.includes(t.id)&&distance(t,e)<180&&!lineBlocked(s,e,t)).sort((a,b)=>distance(a,e)-distance(b,e))[0];if(next){q.bounces--;q.damage*=.7;q.x=e.x;q.y=e.y;const a=Math.atan2(next.y-e.y,next.x-e.x);q.vx=Math.cos(a)*700;q.vy=Math.sin(a)*700;q.life=Math.max(q.life,.28);s.effects.push({type:'ricochet',x:e.x,y:e.y,x2:next.x,y2:next.y,age:0,life:.1});break;}}
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
  if(e.type==='mortar'&&d<400){if(e.timer<=0){e.timer=2.8;s.hazards.push({x:p.x,y:p.y,r:48,timer:.9,age:0});emit(s,'warning',p.x,p.y,{r:48,life:.9});}}
  else{const before={x:e.x,y:e.y},speed=e.speed*(e.hurt>0&&e.type!=='officer'?RULES.combatFeel.hurtMoveMultiplier:1);move(s,e,dx/d*speed*dt,dy/d*speed*dt,e.r);if(e.x===before.x&&e.y===before.y)move(s,e,-dy/d*speed*dt,dx/d*speed*dt,e.r);}
  if(e.type==='officer'&&d<420&&e.timer<=0){e.timer=2.4;for(let i=-2;i<=2;i++)enemyShot(s,e,e.aim+i*.18);emit(s,'enemy-fire',e.x,e.y,{life:.2});}
 }
 separateEnemies(s,dt);
 for(const e of alive(s))if(e.spawnAge>.5&&distance(e,p)<e.r+16){const amount=RULES.enemies[e.type].contactDamage||12;if(!incoming||amount>incoming.amount)incoming={amount,x:e.x,y:e.y};}
 for(const q of s.enemyShots){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(blocked(s,q.x,q.y,q.r))q.life=0;if(distance(q,p)<21){q.life=0;if(!incoming||incoming.amount<10)incoming={amount:10,x:q.x,y:q.y};}}
 for(const h of s.hazards){h.timer-=dt;if(h.timer<=0&&!h.hit){h.hit=true;emit(s,h.lane?'barrage':'explosion',h.x,h.y,{r:h.r,w:h.w,h:h.h,life:.3});if((h.lane?Math.abs(p.x-h.x)<h.w/2+16&&Math.abs(p.y-h.y)<h.h/2+16:distance(h,p)<h.r+16)&&(!incoming||incoming.amount<14))incoming={amount:14,x:h.x,y:h.y};}}
 s.enemyShots=s.enemyShots.filter(q=>q.life>0);s.hazards=s.hazards.filter(h=>h.timer>-.3);s.enemies=s.enemies.filter(e=>!e.dead||e.death>0);
 if(incoming&&(!s.hitCandidate||incoming.amount>s.hitCandidate.amount))s.hitCandidate=incoming;
}

function updateOperationBoss(s,dt){
 const b=s.boss,p=s.player,index=s.operation.region;b.timer-=dt;b.spawnClock-=dt;b.kick=Math.max(0,b.kick-dt*3);b.flash=Math.max(0,b.flash-dt);updateBurn(s,b,dt);for(const part of b.parts)updateBurn(s,part,dt);if(b.dead)return;
 if(index===2&&b.mode!=='recover'&&b.parts[1].hp>0)b.x=clamp(b.x+Math.sin(s.operation.regionTime*.7)*35*dt,330,1270);
 b.aim=Math.atan2(p.y-b.y,p.x-b.x);b.body=Math.PI/2;
 if(b.timer<=0){
  if(b.mode==='aim'){
   b.cycle++;b.mode='salvo';b.timer=index===1?1.45:1.15;
   if(index===1){const safe=b.cycle%3,early=s.sites.some(site=>site.kind==='relay'&&site.state==='done')?.4:0;b.timer+=early;for(let lane=0;lane<3;lane++){if(lane===safe||lane===0&&b.parts[0].hp<=0||lane===2&&b.parts[1].hp<=0)continue;s.hazards.push({x:500+lane*300,y:600,w:220,h:900,lane:true,r:0,timer:1.25+early});}emit(s,'boss-warning',b.x,b.y,{text:'포격 차선 예고 · 표시 밖으로 이동',life:1});}
   else{for(let i=0;i<(b.parts[0].hp>0?5:3);i++){const a=i*TAU/5;s.hazards.push({x:clamp(p.x+Math.cos(a)*95,90,1510),y:clamp(p.y+Math.sin(a)*95,90,1110),r:58,timer:.95,duration:.95});}emit(s,'boss-warning',p.x,p.y,{text:'집중 포격 · 포탑 사격',life:1});}
  }else if(b.mode==='salvo'){
   b.mode='recover';b.timer=index===1?2.2:2.6;
   if(index===2&&b.parts[0].hp>0){for(let i=-4;i<=4;i++)enemyShot(s,b,b.aim+i*.16);b.kick=1;b.flash=.12;}
   emit(s,'weakpoint',b.x,b.y,{text:index===1?'포격 재장전 · 포대를 노려라':'노출 코어 · 집중 공격',life:1.4});
   if(s.operation.support==='recovery'&&b.cycle<=3){
    const side=b.cycle%2?-1:1,x=800+side*(index===1?175:200),y=index===1?470:335;
    dropXp(s,x,y,18,true);emit(s,'supply-ready',x,y,{life:1.1});
   }
  }else{b.mode='aim';b.timer=index===1?1.4:1.7;}
 }
 if(b.spawnClock<=0){b.spawnClock=6;const count=s.operation.jammed?3:6;b.reinforcements=(b.reinforcements||0)+1;for(let i=0;i<count;i++)spawnAround(s,s.operation.jammed?(i===0?(b.reinforcements%2===0?'mortar':'shield'):'rifle'):i===0?'mortar':i===1?'shield':'rifle',{cohort:'boss'});}
 if(distance(b,p)<b.r+16&&(!s.hitCandidate||s.hitCandidate.amount<16))s.hitCandidate={amount:16,x:b.x,y:b.y};
}
function updateBoss(s,dt){
 const b=s.boss,p=s.player;if(!b.active||b.dead)return;if(s.operation?.region>0){updateOperationBoss(s,dt);return;}updateBurn(s,b,dt);for(const part of b.parts)updateBurn(s,part,dt);if(b.dead)return;b.timer-=dt;b.spawnClock-=dt;b.kick=Math.max(0,b.kick-dt*3);b.flash=Math.max(0,b.flash-dt);
 if(b.mode==='charge'){b.x=clamp(b.x+Math.cos(b.body)*375*dt,130,1470);b.y=clamp(b.y+Math.sin(b.body)*375*dt,130,1070);if(b.timer<=0){b.mode='recover';b.timer=2.4+(b.parts[1].hp<=0?.6:0);emit(s,'weakpoint',b.x,b.y,{text:'후면 엔진 노출',life:1.4});}}
 else if(b.timer<=0){
  if(b.mode==='windup'){b.mode='charge';b.timer=.8;emit(s,'boss-charge',b.x,b.y);}
  else if(b.mode==='recover'){b.mode='aim';b.timer=1.4;const angle=Math.atan2(p.y-b.y,p.x-b.x),count=b.parts[0].hp>0?5:3;for(let i=0;i<count;i++)enemyShot(s,b,angle+(i-(count-1)/2)*.19);b.kick=1;b.flash=.12;}
  else{b.mode='windup';b.timer=.9;b.body=Math.atan2(p.y-b.y,p.x-b.x);emit(s,'boss-warning',b.x,b.y,{angle:b.body,life:.9});}
 }
 b.aim=b.mode==='charge'||b.mode==='windup'?b.body:Math.atan2(p.y-b.y,p.x-b.x);
 if(b.spawnClock<=0){b.spawnClock=5;for(let i=0;i<6;i++)spawnAround(s,i===0?'shield':'rifle');}
 if(distance(b,p)<b.r+16&&(!s.hitCandidate||s.hitCandidate.amount<16))s.hitCandidate={amount:16,x:b.x,y:b.y};
}
function updateSites(s,dt){
 if(s.stage==='boss')return;
 for(const site of s.sites){
  if(site.id==='supply-b'&&site.state==='waiting'){site.baseX??=site.x;site.x=site.baseX+Math.sin(s.t*.35)*55;}
  if(site.state==='waiting'&&distance(site,s.player)<215){const count=site.kind==='relay'?3:site.kind==='armory'?5:s.operation?.region===0?4:6,reserve=alive(s).length+count-160;if(reserve>0){const remove=new Set(alive(s).filter(e=>!e.siteId&&(!s.operation||e.cohort==='ambient')&&!s.challenge?.targets?.includes(e.id)&&distance(e,s.player)>280).sort((a,b)=>distance(b,s.player)-distance(a,s.player)).slice(0,reserve).map(e=>e.id));s.enemies=s.enemies.filter(e=>!remove.has(e.id));}if(alive(s).length+count>160)continue;site.state='active';for(let i=0;i<count;i++){const angle=i*TAU/6;spawnEnemy(s,site.kind==='armory'&&i===0?'officer':i===1?'shield':'rifle',site.x+Math.cos(angle)*85,site.y+Math.sin(angle)*65,site.id);}emit(s,'engage',site.x,site.y);}
  if(site.kind==='relay'&&site.state==='active'&&distance(site,s.player)<125)site.progress=Math.min(5,site.progress+dt);
  if(site.state==='active'&&(site.kind==='relay'?site.progress>=5:!s.enemies.some(e=>!e.dead&&e.siteId===site.id))){site.state='ready';s.stats.sitesCleared=(s.stats.sitesCleared||0)+1;s.stats.score+=400;emit(s,'supply-ready',site.x,site.y,{life:.8});}
  if(site.state==='ready'&&distance(site,s.player)<74){site.state='done';
   if(site.kind==='control'){openChoice(s,'control',[{id:'control:jam',kind:'control',key:'jam',title:'증원 통신 교란',desc:'이번 항구 보스전의 증원을 절반으로, 포격병 투입을 절반 빈도로 줄입니다.',label:'최종전 안전'},{id:'control:loot',kind:'control',key:'loot',title:'시험 탄약 노획',desc:'희귀 모듈·재보급 3후보 중 하나를 받습니다.',label:'추가 화력'}],site.name);}
   else if(site.kind==='armory'){const quality=rollQuality(s,'normal');openChoice(s,'armory',armoryCards(s,quality),site.name,{quality});}
   else openChoice(s,'supply',supplyCards(s,site),site.name);
   return;
  }
 }
}
function startRaid(s,contract){
 if(s.phase!=='choice'||s.choice.type!=='armory'||s.raidUsed||!RULES.raidContracts[contract]||s.challenge?.state==='active')return false;
 const cfg=RULES.raidContracts[contract],route=s.operation?.region===1?[{x:800,y:950},{x:800,y:680},{x:800,y:400},{x:800,y:120}]:s.operation?.region===2?[{x:1380,y:950},{x:1380,y:680},{x:1380,y:400},{x:1380,y:120}]:s.seed%2===0?[{x:1260,y:470},{x:970,y:300},{x:600,y:470},{x:260,y:700}]:[{x:340,y:470},{x:630,y:300},{x:1000,y:470},{x:1340,y:700}];
 s.raidUsed=true;s.raid={state:'active',contract,progress:0,maxProgress:cfg.routeLength,route,quality:rollQuality(s,cfg.qualityKey),wager:snapshot(s.choice),wagerCards:clone(s.choices),target:{id:'courier',type:'courier',...route[0],r:35,hp:cfg.hp,maxHp:cfg.hp,aim:0,dead:false}};
 for(const [type,n]of Object.entries(cfg.escort))for(let i=0;i<n;i++)spawnEnemy(s,type,route[0].x+(rng(s,'combat')-.5)*190,route[0].y+(rng(s,'combat')-.5)*170);
 s.phase='playing';s.choice=null;s.choices=[];emit(s,'raid-start',route[0].x,route[0].y,{life:1.2});return true;
}
function updateRaid(s,dt){
 const raid=s.raid;if(!raid||raid.state!=='active')return;const cfg=RULES.raidContracts[raid.contract];raid.progress+=cfg.speed*dt;
 if(raid.progress>=raid.maxProgress){raid.state='failed';s.stats.raidFailed++;emit(s,'raid-failed',s.player.x,s.player.y,{text:'수송대 이탈 · 건 상자 소실',life:1.5});return;}updateBurn(s,raid.target,dt);if(raid.state!=='active')return;
 const lengths=raid.route.slice(1).map((p,i)=>distance(p,raid.route[i])),total=lengths.reduce((a,b)=>a+b,0);let at=raid.progress/raid.maxProgress*total;
 for(let i=0;i<lengths.length;i++){if(at<=lengths[i]){const a=raid.route[i],b=raid.route[i+1],f=at/lengths[i];raid.target.x=a.x+(b.x-a.x)*f;raid.target.y=a.y+(b.y-a.y)*f;raid.target.aim=Math.atan2(b.y-a.y,b.x-a.x);break;}at-=lengths[i];}
}
function withdrawRaid(s){
 if(s.raid?.state!=='active')return false;
 s.raid.state='withdrawn';s.stats.raidFailed++;return true;
}
function updatePowerWave(s,dt){const wave=s.powerWave;if(!wave||s.stage==='boss')return;if(wave.delay>0){wave.delay-=dt;return;}wave.clock-=dt;if(wave.clock<=0&&wave.remaining>0){wave.clock=.4;for(let i=0;i<4&&wave.remaining>0;i++)if(spawnAround(s,'rifle',{},360))wave.remaining--;}if(wave.remaining<=0)s.powerWave=null;}
function pursuitReward(s){
 if(s.operation.region<2)return Object.entries(FRONT_SUPPORTS).map(([key,kit])=>({id:`support:${key}`,kind:'front-support',key,title:kit.name,desc:kit.impact,label:kit.role}));
 return [
  {id:'pursuit:cargo',kind:'cargo',title:'통신 화물',label:'정산 크레딧'},
  {id:'resupply:pursuit-mixed',kind:'resupply',title:'후송 구급낭',heal:36,charge:45,label:'귀환까지 생존'}
 ];
}
function updateChallenge(s,dt){
 const challenge=s.challenge;
 if(challenge?.state!=='active')return;
 if(challenge.type==='defend'){
  if(s.player.hp<=0||distance(s.player,DEFENSE_ZONE)>DEFENSE_ZONE.r)return;
  challenge.progress+=dt;challenge.strike-=dt;
  if(challenge.progress<challenge.duration){
   if(challenge.strike<=0){
    const {x,y}=s.player;
    s.hazards.push({x,y,r:42,timer:.95,duration:.95});
    challenge.strike=2.7;
   }
   return;
  }
 }else if(challenge.type==='intercept'){
  const target=challenge.target;
  updateBurn(s,target,dt);
  if(target.hp>0){
   challenge.timeLeft=Math.max(0,challenge.timeLeft-dt);
   target.y=SIGNAL_ROUTE.end+(SIGNAL_ROUTE.start-SIGNAL_ROUTE.end)*(challenge.timeLeft/SIGNAL_ROUTE.seconds);
   if(challenge.timeLeft===0){challenge.state='failed';emit(s,'challenge-failed',target.x,target.y,{text:'통신 차량 이탈 · 재도전 가능',life:1.6});}
   return;
  }
 }else if(challenge.targets.some(id=>s.enemies.some(e=>e.id===id&&!e.dead)))return;
 challenge.state='complete';
 const tier=challenge.tier||1;
 s.stats.challenge=Math.max(s.stats.challenge,tier);s.stats.challengeWins=(s.stats.challengeWins||0)+1;
 if(s.operation){
  s.operation.challengeTier=tier;
  if(tier===1&&s.player.hp>0){
   s.player.invuln=Math.max(s.player.invuln,.5);
   openChoice(s,'pursuit-reward',pursuitReward(s),`${holdoutContract(s).name} 완료 · 보급 한 가지 선택`);
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
  s.challenge={type:'intercept',state:'active',tier,timeLeft:SIGNAL_ROUTE.seconds,target:{id:'signal',type:'courier',x:SIGNAL_ROUTE.x,y:SIGNAL_ROUTE.start,r:34,hp,maxHp:hp,aim:-Math.PI/2,dead:false}};
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
 if(s.stage==='field'&&distance(s.player,{x:800,y:350})<130)return{id:'boss',blocked:s.raid?.state==='active',label:`${s.operation?region(s).boss:'장갑 수송차'} 도전`};
 const gate=exitGate(s);
 return gate&&distance(s.player,gate)<(s.operation?92:140)?{id:'extract',label:s.operation?.region===2?'귀환 선택':'전진 · 잔류 선택'}:null;
}
export function action(s,kind){
 if(kind.startsWith('raid:'))return startRaid(s,kind.split(':')[1]);
 if(kind==='withdraw'){if(!withdrawRaid(s))return false;emit(s,'raid-failed',s.player.x,s.player.y,{text:'습격 철수 · 상자 소실',life:1.2});return true;}
 if(s.phase!=='playing')return false;const p=s.player;
 if(kind==='gear'){openChoice(s,'assembly',[...assemblyOptions(s),{id:'back',kind:'back',title:'전투로 돌아가기',desc:'조율권과 무장을 유지합니다.'}],'병기 조립');return true;}
 if(kind==='dash'){if(p.dashCd>0)return false;p.dash=.18;p.dashCd=2;p.invuln=Math.max(p.invuln,.30);if(p.maneuver==='assault')p.assaultTime=1.25;emit(s,'dash',p.x,p.y,{angle:p.aim,life:.2});return true;}
 if(kind==='skill'){const cfg=RULES.fio[p.doctrine];if(p.skillCd>0||p.overdrive>0||p.charge<cfg.cost)return false;p.charge-=cfg.cost;p.overdrive=cfg.duration;p.skillCd=cfg.cooldown;emit(s,'skill',p.x,p.y,{text:'전탄 보급',life:.7});return true;}
 if(kind==='challenge')return startChallenge(s);
 if(kind==='interact'){const item=interaction(s);if(!item)return false;if(item.id==='extract'){if(s.operation){openChoice(s,'clear',exitCards(s),'열린 출구');}else finish(s,true);return true;}if(s.raid?.state==='active')return false;s.stage='boss';s.refits=0;s.boss.active=true;s.boss.mode='aim';s.boss.timer=1.3;p.x=800;p.y=470;p.invuln=Math.max(p.invuln,1);s.enemies=s.enemies.filter(e=>distance(e,s.boss)<400);s.enemyShots=[];s.hazards=[];emit(s,'boss-arrival',800,250,{life:1.3});return true;}
 return false;
}
export function finish(s,won=false,reason='retreat'){
 if(s.phase==='result')return false;won=!!won&&s.stats.bossKilled&&(!s.operation||s.operation.cleared===3&&s.operation.extracted===true)&&s.player.hp>0;if(won&&!s.stats.extractionPaid){s.stats.score+=3000;s.stats.extractionPaid=true;}
 withdrawRaid(s);if(s.challenge?.state==='active')s.challenge.state='withdrawn';
 s.phase='result';s.result={runId:s.runId||null,balanceRevision:s.balanceRevision||'b05-campaign',won,reason:won?'prototype-complete':s.player.hp<=0?'prototype-failed':reason,seed:s.seed,seconds:s.t,score:s.stats.score,level:s.level,weapons:clone(s.weapons),modules:clone(s.modules),stats:clone(s.stats),...(s.operation?{operation:clone(s.operation)}:{})};s.choice=null;s.choices=[];return true;
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
 s.spawnClock=0;s.powerWave=null;
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
 p.charge=Math.min(100,p.charge+(s.stage==='boss'?2:.5)*dt);s.coilCd=Math.max(0,s.coilCd-dt);s.heatCd=Math.max(0,s.heatCd-dt);for(const cd of ['medicCd','thermalCd','shrapnelCd'])s[cd]=Math.max(0,(s[cd]||0)-dt);
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.max(1,Math.hypot(ix,iy)),moving=Math.hypot(ix,iy)>.07;p.moving=moving;
 if(moving){const speed=p.dash>0?650:190*(p.pickupTime>0?1+moduleRank(s,'magnet')*.03:1);move(s,p,ix/len*speed*dt,iy/len*speed*dt,16);p.walk+=speed*dt*.05;}
 if(wasDashing&&p.dash<=0&&s.operation?.support==='overrun'){
  blast(s,p.x,p.y,100,85,'support');
  const b=s.boss;
  if(b.active&&!b.dead&&b.mode==='recover'&&distance(p,b)<=100+b.r&&!lineBlocked(s,p,b)){
   const target=b.parts.filter(part=>part.hp>0).map(part=>Object.assign(part,partPosition(s,part))).sort((a,b)=>distance(p,a)-distance(p,b))[0]||b;
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
 for(const z of s.zones){z.life-=dt;z.tick-=dt;if(z.tick<=0){z.tick=.25;for(const e of targets(s))if(e.hp>0&&distance(z,e)<z.r+e.r&&!lineBlocked(s,z,e)){burn(e);damage(s,e,z.dps*.25,'fire','dot');}}}s.zones=s.zones.filter(z=>z.life>0);
 updateEnemies(s,dt);updateBoss(s,dt);if(s.hitCandidate)hurt(s,s.hitCandidate.amount,s.hitCandidate.x,s.hitCandidate.y);delete s.hitCandidate;
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
  if(s.operation?.support==='recovery'&&p.hp>0)p.hp=Math.min(p.maxHp,p.hp+gained);
  p.pickupBudget-=gained;p.charge=Math.min(100,p.charge+gained*(1+Math.min(.2,s.level*.01)));
  const receipt=s.effects.find(f=>f.type==='xp-pickup');
  if(receipt){receipt.value+=pickedXp;receipt.salvage||=salvage;receipt.age=0;}
  else emit(s,'xp-pickup',p.x,p.y,{value:pickedXp,salvage,life:.65});
 }
 s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;for(const fx of s.effects)fx.age+=dt;s.effects=s.effects.filter(fx=>fx.age<fx.life);
 if(s.boss.dead&&s.stage==='boss'&&p.hp>0){
  s.stage='holdout';s.boss.active=false;s.clearPressure=s.pressure;s.holdTime=0;s.enemyShots=[];s.hazards=[];
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
