import {RULES,VERSION,FIELD,GUNS,MODULES,makeWeapon,tags,moduleRank,compatible,heatSynergyReady,weaponStats,distance,clamp,layout} from './content.js';
const TAU=Math.PI*2,clone=x=>JSON.parse(JSON.stringify(x));
const rng=(s,key)=>{let a=s.rng[key]=(s.rng[key]+0x6d2b79f5)>>>0;a=Math.imul(a^(a>>>15),a|1);a^=a+Math.imul(a^(a>>>7),a|61);return((a^(a>>>14))>>>0)/4294967296;};
const pick=(s,key,items)=>items[Math.floor(rng(s,key)*items.length)];
const alive=s=>s.enemies.filter(e=>!e.dead);
const emit=(s,type,x=s.player.x,y=s.player.y,extra={})=>{s.events.push(type);s.effects.push({type,x,y,age:0,life:.45,...extra});if(s.effects.length>180)s.effects.shift();};
const freshStats=()=>({kills:0,elites:0,score:0,damageTaken:0,ricochetHits:0,coilBursts:0,heatBursts:0,raidSuccess:0,raidFailed:0,bestCombo:0,completedBuild:null,bossKilled:false,challenge:0,choices:[],moduleDamage:0});
export function createRun(seed=17){
 const map=layout(seed),s={version:VERSION,seed:seed>>>0,rng:{map:seed>>>0,supply:(seed^0x12345678)>>>0,combat:(seed^0xa5f31021)>>>0,loot:(seed^0xdecafe11)>>>0},phase:'playing',stage:'field',t:0,level:1,xp:0,pendingLevels:0,tuning:1,rerolls:2,banishes:1,refits:1,excluded:[],seenGuns:[],offeredWeapons:[],supplyCount:0,firstNew:null,choice:null,choices:[],queue:[],id:0,
 player:{x:800,y:1040,hp:100,maxHp:100,aim:-Math.PI/2,walk:0,moving:false,attack:0,hurt:0,invuln:0,dash:0,dashCd:0,charge:60,overdrive:0,skillCd:0,doctrine:'reserve',pickup:0,pickupTime:0},weapons:[{...makeWeapon('h'),uid:'w-h0'}],modules:[],boosts:{power:0,vitality:0,pickup:0},...map,enemies:[],shots:[],enemyShots:[],gems:[],zones:[],hazards:[],effects:[],events:[],combo:0,comboTime:0,spawnClock:1,pressure:0,lastPressure:0,coil:0,coilCd:0,heatCd:0,powerWave:null,powerDone:false,view:{w:880,h:500},stats:freshStats(),raid:null,raidUsed:false,challenge:null,boss:{id:'boss',type:'boss',x:800,y:180,hp:6000,maxHp:6000,r:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:-60,hp:450,maxHp:450,r:25},{id:'part-b',type:'part',ox:60,hp:450,maxHp:450,r:25}]},holdTime:0,result:null};
 for(let i=0;i<RULES.spawn.initialCount;i++)spawnAround(s,'rifle',{},340,RULES.spawn.openingGap);
 return s;
}
export const snapshot=s=>clone(s);
export function restore(raw){
 const s=clone(raw);if(s.version!==VERSION||!Number.isSafeInteger(s.seed)||!s.rng||!s.player||!Array.isArray(s.weapons)||s.weapons.length<1||s.weapons.length>3||!Array.isArray(s.modules)||s.modules.length>4||!Array.isArray(s.sites)||!s.stats||!['playing','choice','paused','result'].includes(s.phase))throw Error('저장 형식을 확인할 수 없습니다.');
 for(const w of s.weapons)if(!GUNS[w.id]||!Number.isInteger(w.level)||w.level<1||w.level>6||w.branch&&!GUNS[w.id].branches[w.branch])throw Error('무장 저장이 손상됐습니다.');
 for(const m of s.modules)if(!MODULES[m.id]||!Number.isInteger(m.rank)||m.rank<1||m.rank>3)throw Error('모듈 저장이 손상됐습니다.');
 if(!Number.isFinite(s.player.hp)||s.player.hp<0||!Number.isFinite(s.player.maxHp)||s.player.maxHp<=0||s.player.hp>s.player.maxHp||!Number.isFinite(s.t)||s.t<0||s.tuning<0||s.rerolls<0||s.banishes<0)throw Error('작전 저장이 손상됐습니다.');
 const fail=()=>{throw Error('전투 체크포인트가 손상됐습니다.');};
 if(!['field','boss','holdout'].includes(s.stage)||!Array.isArray(s.boss?.parts)||!Array.isArray(s.queue)||!Array.isArray(s.choices)||!['map','supply','combat','loot'].every(k=>Number.isInteger(s.rng[k])))fail();
 for(const key of ['enemies','shots','enemyShots','gems','zones','hazards','effects','excluded','seenGuns','offeredWeapons'])if(!Array.isArray(s[key]))fail();
 if(new Set(s.modules.map(m=>m.id)).size!==s.modules.length||s.modules.some(m=>RULES.modules[m.id].unique&&m.rank!==1)||new Set(s.weapons.map(w=>w.uid)).size!==s.weapons.length||s.weapons.some(w=>typeof w.uid!=='string'))fail();
 const kinds=new Set(['rank','module','gun','evolve','fusion','tune','repair','utility','back','stay','extract']);
 const cardsOk=cards=>Array.isArray(cards)&&cards.length>0&&cards.every(c=>typeof c.id==='string'&&kinds.has(c.kind)&&(!c.weapon||GUNS[c.weapon])&&(!c.module||MODULES[c.module])&&(!['rank','gun','evolve'].includes(c.kind)||!!GUNS[c.weapon])&&(!['module','tune'].includes(c.kind)||!!MODULES[c.module]));
 if((s.phase==='choice'||s.resumePhase==='choice')&&(!s.choice||!['level','supply','armory','raid-reward','assembly','clear'].includes(s.choice.type)||!cardsOk(s.choices)))fail();
 if(s.phase==='result'&&(!s.result||typeof s.result.won!=='boolean'||!Number.isFinite(s.result.score)||!Number.isFinite(s.result.seconds)||!s.result.stats||!Array.isArray(s.result.weapons)||!Array.isArray(s.result.modules)||s.result.weapons.some(w=>!GUNS[w.id])||s.result.modules.some(m=>!MODULES[m.id])))fail();
 if(s.choice?.type==='assembly'){const ids=new Set([...assemblyOptions(s).map(c=>c.id),'back']);if(!s.choices.some(c=>c.id==='back'&&c.kind==='back')||s.choices.some(c=>!ids.has(c.id)))fail();}
 if(s.choice?.type==='clear'&&!s.stats.bossKilled)fail();
 if(s.queue.some(q=>!cardsOk(q.cards)))fail();if(s.raid&&(!['active','success','failed','withdrawn'].includes(s.raid.state)||!RULES.raidContracts[s.raid.contract]||!Number.isFinite(s.raid.progress)||!Number.isFinite(s.raid.target?.hp)))fail();
 s.events=[];return s;
}
export function pause(s){if(s.phase==='result'||s.phase==='paused')return;s.resumePhase=s.phase;s.phase='paused';}
export function resume(s){if(s.phase==='paused'){s.phase=s.resumePhase||'playing';delete s.resumePhase;}}
export function xpNeeded(s){return s.level<=17?RULES.xpCosts[s.level-1]:90+(s.level-18)*7;}
function gainXp(s,n){s.xp+=n;while(s.xp>=xpNeeded(s)){s.xp-=xpNeeded(s);s.level++;s.pendingLevels++;}}
const gunCard=(w)=>{const before=weaponStats(w),after=weaponStats({...w,level:w.level+1}),changes=[];if(before.count!==after.count)changes.push(`사격 ${before.count} → ${after.count}발`);if(before.damage!==after.damage)changes.push(`피해 ${before.damage} → ${after.damage}`);if(before.interval!==after.interval)changes.push(`간격 ${before.interval.toFixed(2)} → ${after.interval.toFixed(2)}초`);if(before.range!==after.range)changes.push(`사거리 ${before.range} → ${after.range}`);if(before.radius!==after.radius)changes.push(`폭발 범위 ${before.radius} → ${after.radius}`);return{id:`rank:${w.id}`,kind:'rank',weapon:w.id,title:`${GUNS[w.id].name} L${w.level+1}`,desc:w.level===3?'발사 방식을 선택해 전투를 바꿉니다.':changes.join(' · ')||'보유 공격의 위력을 확장합니다.',label:'보유 무기 투자'};};
const moduleCard=(id,rank=1)=>({id:`module:${id}`,kind:'module',module:id,rank,title:MODULES[id].name,desc:MODULES[id].desc,label:'조건부 모듈'});
const utility=(key)=>({id:`utility:${key}`,kind:'utility',key,title:({health:'야전 응급처치',pickup:'회수 숙련',power:'추가 화력',charge:'탄약 보급'})[key],desc:({health:'최대 HP +6 · 체력 +6',pickup:'XP 회수 반경 +10 (최대 3회)',power:'기본 화력 +1% 가산',charge:'전탄 보급 충전 +10'})[key],label:'전술 보조'});
const upgradeable=s=>s.weapons.filter(w=>!w.evolved&&!w.fusion&&w.level<6);
function modulePool(s){return ['ricochet','coil','catalyst','magnet'].filter(id=>!s.excluded.includes(id)&&compatible(s,id)&&moduleRank(s,id)<3);}
function currentInvestments(s){return[...upgradeable(s).map(gunCard),...s.modules.filter(m=>!RULES.modules[m.id].unique&&m.rank<3).map(m=>moduleCard(m.id,1))];}
function supplyCards(s){
 const guns=upgradeable(s),cards=[guns.length?gunCard(pick(s,'supply',guns)):currentInvestments(s)[0]||utility('health')];
 const unseen=['h','r','f'].filter(id=>!s.weapons.some(w=>w.id===id&&!w.fusion)&&!s.excluded.includes(id)&&!(s.supplyCount<2&&s.seenGuns.includes(id)));
 if(unseen.length){const id=pick(s,'supply',unseen);cards.push({id:`gun:${id}`,kind:'gun',weapon:id,title:`${GUNS[id].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:'새 무기'});if(!s.seenGuns.includes(id))s.seenGuns.push(id);}
 const pool=modulePool(s);let favored=pool;
 if(s.supplyCount<2){const focus=s.weapons.find(w=>w.id===s.firstNew)||s.weapons[0],requirements=Object.values(RULES.weapons[focus.id].evolution.moduleByBranch).flat();const useful=pool.filter(id=>requirements.includes(id));if(useful.length)favored=useful;}
 if(pool.length)cards.push(moduleCard(pick(s,'supply',favored)));
 return fillCards(s,cards);
}
function fillCards(s,cards){const unique=[...new Map(cards.filter(Boolean).map(c=>[c.id,c])).values()];for(const key of ['health','charge','power'])if(unique.length<3&&!unique.some(c=>c.id===`utility:${key}`))unique.push(utility(key));return unique.slice(0,3);}
function levelCards(s){
 const guns=upgradeable(s),missed=guns.filter(w=>!s.offeredWeapons.slice(-2).some(ids=>ids.includes(w.id))),a=guns.length?gunCard(pick(s,'supply',missed.length?missed:guns)):currentInvestments(s)[0];
 const rest=currentInvestments(s).filter(c=>c.id!==a?.id),b=rest.length?pick(s,'supply',rest):null;
 const cards=fillCards(s,[a,b,utility(s.boosts.pickup<3&&rng(s,'supply')<.45?'pickup':'health')]);
 if(!currentInvestments(s).length)return [utility('power'),utility('health'),utility('charge')];
 s.offeredWeapons.push(cards.filter(c=>c.kind==='rank').map(c=>c.weapon));return cards;
}
function rollQuality(s,key){const p=RULES.quality[key],r=rng(s,'loot');return r<p.common?'common':r<p.common+p.rare?'rare':'prototype';}
function armoryCards(s,quality){
 const cards=[],pool=modulePool(s),amount=quality==='common'?1:quality==='rare'?2:3;
 if(quality==='prototype'&&!moduleRank(s,'overcharger'))cards.push(moduleCard('overcharger',1));
 while(cards.length<3&&pool.length){const id=pick(s,'loot',pool);pool.splice(pool.indexOf(id),1);cards.push(moduleCard(id,amount));}
 return fillCards(s,cards);
}
function openChoice(s,type,cards,source='',extra={}){s.phase='choice';s.choice={type,source,...extra};s.choices=cards;}
function nextChoice(s){if(s.phase!=='playing')return;if(s.queue.length){const item=s.queue.shift();openChoice(s,item.type,item.cards,item.source,item.extra);return;}if(s.pendingLevels>0){s.pendingLevels--;openChoice(s,'level',levelCards(s),`LEVEL ${s.level}`);}}
export function assemblyOptions(s){
 if(s.tuning<=0)return[];const options=[];
 for(const w of s.weapons){if(w.level!==6||w.evolved||w.fusion||!w.branch)continue;const ms=RULES.weapons[w.id].evolution.moduleByBranch[w.branch];if(ms.some(id=>moduleRank(s,id)>=2))options.push({id:`evolve:${w.id}`,kind:'evolve',weapon:w.id,title:GUNS[w.id].evolution,desc:'발사 구조 확장 · 조율권 1 · 모듈 유지',label:'단일 진화'});}
 if(moduleRank(s,'coil')>=2)for(const a of s.weapons)for(const b of s.weapons){if(a===b||a.level<4||b.level<4||a.evolved||b.evolved||a.fusion||b.fusion||!tags(a).includes('bullet')||!tags(b).includes('blast')||s.weapons.some(w=>w.fusion&&w.id===a.id&&w.branch===a.branch&&w.fusion.secondary===b.id&&w.fusion.branch===b.branch))continue;options.push({id:`fusion:${a.id}:${b.id}`,kind:'fusion',primary:a.id,secondary:b.id,title:`전도 격발망 ${GUNS[a.id].short}+${GUNS[b.id].short}`,desc:`${GUNS[a.id].short} 사격 유지 + ${GUNS[b.id].short} 폭발 계승 · 총 2개 → 1칸`,label:'태그 합체'});}
 for(const m of s.modules)if(!RULES.modules[m.id].unique&&m.rank<3)options.push({id:`tune:${m.id}`,kind:'tune',module:m.id,title:`${MODULES[m.id].name} 조율`,desc:`${m.rank} → ${m.rank+1}강화 · 조율권 1`,label:'발동 시너지'});
 options.push({id:'tune:repair',kind:'repair',title:'응급 정비',desc:'최대 HP +15 · 체력 +35 · 조율권 1',label:'생존 투자'});return options;
}
export function choose(s,id,{branch,slot,doctrine}={}){
 if(s.phase!=='choice')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen&&!['reserve','quick'].includes(doctrine))return false;
 if(c.kind==='rank'){const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);if(!w||w.level>=6||w.evolved)return false;if(w.level===3&&!GUNS[w.id].branches[branch])return false;w.level++;if(w.level===4)w.branch=branch;}
 else if(c.kind==='module'){
  if(!MODULES[c.module]||!compatible(s,c.module))return false;let m=s.modules.find(m=>m.id===c.module);
  if(m){if(m.rank>=3||RULES.modules[m.id].unique)return false;m.rank=Math.min(3,m.rank+c.rank);}else{m={id:c.module,rank:Math.min(3,c.rank)};if(s.modules.length>=4){if(!Number.isInteger(slot)||!s.modules[slot])return false;s.modules[slot]=m;}else s.modules.push(m);}
 }
 else if(c.kind==='gun'){
  if(s.weapons.some(w=>w.id===c.weapon&&!w.fusion))return false;let w=makeWeapon(c.weapon);
  if(s.weapons.length>=3||Number.isInteger(slot)&&slot>=0){const old=s.weapons[slot];if(!old||old.evolved||old.fusion)return false;w.level=s.refits>0&&s.stage==='field'?Math.min(5,old.level):1+Math.floor((old.level-1)/2);if(w.level>=4){if(!GUNS[w.id].branches[branch])return false;w.branch=branch;}if(s.refits>0&&s.stage==='field')s.refits--;w.uid=`w-${++s.id}`;s.weapons[slot]=w;}else{w.uid=`w-${++s.id}`;s.weapons.push(w);}
  if(!s.firstNew)s.firstNew=w.id;
 }
 else if(c.kind==='evolve'){if(!assemblyOptions(s).some(o=>o.id===id))return false;const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion&&!w.evolved);w.evolved=true;s.tuning--;buildCompleted(s,'single');}
 else if(c.kind==='fusion'){
  if(!assemblyOptions(s).some(o=>o.id===id))return false;const a=s.weapons.find(w=>w.id===c.primary&&!w.fusion),b=s.weapons.find(w=>w.id===c.secondary&&!w.fusion);a.fusion={secondary:b.id,branch:b.branch,overflow:Math.min(4,a.level+b.level-8)};a.level=6;a.evolved=true;s.weapons.splice(s.weapons.indexOf(b),1);s.tuning--;buildCompleted(s,'fusion');
 }else if(c.kind==='tune'){const m=s.modules.find(m=>m.id===c.module);if(s.tuning<1||!m||m.rank>=3)return false;m.rank++;s.tuning--;}
 else if(c.kind==='repair'){if(s.tuning<1)return false;s.tuning--;s.player.maxHp+=15;s.player.hp=Math.min(s.player.maxHp,s.player.hp+35);}
 else if(c.kind==='utility'){if(c.key==='health'){s.player.maxHp+=6;s.player.hp=Math.min(s.player.maxHp,s.player.hp+6);}if(c.key==='pickup'){if(s.boosts.pickup>=3)return false;s.boosts.pickup++;}if(c.key==='power')s.boosts.power++;if(c.key==='charge')s.player.charge=Math.min(100,s.player.charge+10);}
 else if(c.kind==='back'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else if(c.kind==='extract'){finish(s,true);return true;}
 else if(c.kind==='stay'){s.phase='playing';s.choice=null;s.choices=[];return true;}
 else return false;
 if(s.choice.type==='level'&&s.level>=6&&!s.player.branchChosen){if(!['reserve','quick'].includes(doctrine))return false;s.player.doctrine=doctrine;s.player.branchChosen=true;}
 s.stats.choices.push({t:Math.round(s.t*10)/10,id,branch:branch||null});if(s.choice.type==='supply')s.supplyCount++;s.phase='playing';s.choice=null;s.choices=[];
 if(heatSynergyReady(s))buildCompleted(s,'synergy');
 emit(s,'choose');nextChoice(s);return true;
}
export function reroll(s){if(s.phase!=='choice'||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.rerolls<=0)return false;s.rerolls--;s.choices=s.choice.type==='level'?levelCards(s):s.choice.type==='supply'?supplyCards(s):armoryCards(s,s.choice.quality);return true;}
export function banishOptions(s){if(s.phase!=='choice'||!['level','supply','armory','raid-reward'].includes(s.choice.type)||s.banishes<=0)return[];return s.choices.filter(c=>{const id=c.kind==='gun'?c.weapon:c.kind==='module'?c.module:null;return id&&!s.weapons.some(w=>w.id===id&&!w.fusion)&&!moduleRank(s,id)&&id!=='overcharger'&&!(c.kind==='gun'&&s.supplyCount<2&&['r','f'].filter(id=>!s.excluded.includes(id)).length<=2);});}
export function banish(s,id){const c=banishOptions(s).find(c=>c.id===id);if(!c)return false;const target=c.kind==='gun'?c.weapon:c.module,index=s.choices.indexOf(c);s.excluded.push(target);s.banishes--;
 const used=new Set(s.choices.filter(card=>card!==c).map(card=>card.id));let replacement;
 if(c.kind==='gun'){const pool=['h','r','f'].filter(g=>!s.excluded.includes(g)&&!s.weapons.some(w=>w.id===g&&!w.fusion)&&!used.has(`gun:${g}`));if(pool.length){const g=pick(s,'supply',pool);replacement={id:`gun:${g}`,kind:'gun',weapon:g,title:`${GUNS[g].name} 확보`,desc:'새 공격을 얻습니다. 빈칸 장착 또는 기존 총 개장.',label:'새 무기'};}}
 if(!replacement){const pool=modulePool(s).filter(m=>!used.has(`module:${m}`));if(pool.length)replacement=moduleCard(pick(s,'supply',pool),c.kind==='module'?c.rank:1);}
 if(!replacement)replacement=['health','charge','power'].map(utility).find(card=>!used.has(card.id));s.choices[index]=replacement;return true;
}
export function skip(s){if(s.phase!=='choice'||s.choice.type==='assembly'||s.choice.type==='clear')return false;if(s.player.hp<s.player.maxHp)s.player.hp=Math.min(s.player.maxHp,s.player.hp+s.player.maxHp*.05);else s.player.charge=Math.min(100,s.player.charge+5);if(s.choice.type==='supply')s.supplyCount++;s.phase='playing';s.choice=null;s.choices=[];nextChoice(s);return true;}

function buildCompleted(s,kind){if(!s.stats.completedBuild)s.stats.completedBuild={kind,t:s.t};if(!s.powerDone){s.powerDone=true;s.powerWave={delay:4,remaining:60,clock:0};emit(s,'complete',s.player.x,s.player.y,{life:1.2,text:kind==='fusion'?'전도 격발망 가동':kind==='single'?'무기 진화 완료':'발동 연계 완성'});}}
export function partPosition(s,part){const b=s.boss;return{x:b.x+Math.cos(b.body-Math.PI/2)*part.ox,y:b.y+Math.sin(b.body-Math.PI/2)*part.ox};}
function targets(s){const list=alive(s);if(s.raid?.state==='active'&&s.raid.target.hp>0)list.push(s.raid.target);if(s.boss.active&&!s.boss.dead){list.push(s.boss);for(const part of s.boss.parts)if(part.hp>0){Object.assign(part,partPosition(s,part));list.push(part);}}return list;}
const blocked=(s,x,y,r=0)=>s.blocks.find(b=>b.hp!==0&&x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
function move(s,e,dx,dy,r){const x=clamp(e.x+dx,FIELD.left+r,FIELD.right-r),y=clamp(e.y+dy,FIELD.top+r,FIELD.bottom-r);if(!blocked(s,x,e.y,r))e.x=x;if(!blocked(s,e.x,y,r))e.y=y;}
function lineBlocked(s,a,b){const n=Math.ceil(distance(a,b)/20);for(let i=1;i<=n;i++)if(blocked(s,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return true;return false;}
function attackTargets(s,range){return targets(s).filter(e=>e.hp>0&&distance(e,s.player)<range+e.r&&!lineBlocked(s,s.player,e)).sort((a,b)=>distance(a,s.player)-distance(b,s.player));}
function targetFor(s,w,d,candidates){
 const locked=candidates.find(e=>e.id===w.targetId);if(locked&&s.t<(w.targetUntil||0))return locked;
 let selected=candidates[0];
 if(w.id==='f'){
  let best=-1;for(const candidate of candidates.slice(0,24)){const a=Math.atan2(candidate.y-s.player.y,candidate.x-s.player.x);let score=0;
   for(const e of candidates){const b=Math.atan2(e.y-s.player.y,e.x-s.player.x);if(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))<d.cone*Math.PI/360)score+=1+Math.min(e.hp,d.damage)/d.damage*.1;}
   if(score>best){best=score;selected=candidate;}
  }
 }
 w.targetId=selected?.id||null;w.targetUntil=s.t+RULES.player.targetHoldSeconds;return selected;
}
function spawnEnemy(s,type,x,y,siteId=null,extra={}){
 if(alive(s).length>=160)return null;const d=RULES.enemies[type],hp=d.hp*Math.pow(1.05,Math.min(s.pressure,12)),e={id:`e-${++s.id}`,type,x:clamp(x,60,1540),y:clamp(y,60,1140),r:type==='officer'?24:type==='shield'?21:17,hp,maxHp:hp,speed:d.speed*Math.min(1.3,1+s.pressure*.03),timer:1+rng(s,'combat')*2,aim:Math.atan2(s.player.y-clamp(y,60,1140),s.player.x-clamp(x,60,1540)),hurt:0,walk:0,spawnAge:0,siteId,dead:false,death:0,burn:0,...extra};s.enemies.push(e);return e;
}
function spawnAround(s,type='rifle',extra={},radius=null,minGap=0){
 const p=s.player;let point;
 for(let i=0;i<(minGap?64:16);i++){const a=rng(s,'combat')*TAU,r=radius??Math.max(340,Math.min(520,Math.max(s.view.w,s.view.h)*.54));const q={x:clamp(p.x+Math.cos(a)*r,65,1535),y:clamp(p.y+Math.sin(a)*r,65,1135)};if(distance(q,p)>300&&!blocked(s,q.x,q.y,22)&&(!minGap||alive(s).every(e=>distance(q,e)>=minGap))){point=q;break;}}
 if(!point)return null;return spawnEnemy(s,type,point.x,point.y,null,extra);
}
function burn(e,dps=6,life=1.5,depth=0){e.burn=Math.max(e.burn||0,life);e.burnDps=Math.max(e.burnDps||0,dps);e.burnDepth=depth;e.burnTick=e.burnTick??.5;}
function updateBurn(s,e,dt){if(!(e.burn>0)||e.hp<=0)return;e.burn-=dt;e.burnTick=(e.burnTick??.5)-dt;if(e.burnTick<=0){e.burnTick=.5;damage(s,e,e.burnDps*.5,'fire','dot');}if(e.burn<=0)e.burnDps=0;}
function scoreKill(s,e,source){
 if(e.type==='officer'){s.stats.elites++;if(s.stats.elites<=8)s.stats.score+=100;}else{s.stats.kills++;if(s.stats.kills<=300)s.stats.score+=10;}
 s.player.charge=Math.min(100,s.player.charge+1*(1+Math.min(.2,s.level*.01)));s.combo++;s.comboTime=2;s.stats.bestCombo=Math.max(s.combo,s.stats.bestCombo);
 const xp=RULES.enemies[e.type]?.xp||1;s.gems.push({x:e.x,y:e.y,value:xp,age:0});
 if(s.gems.length>220){s.gems[0].value+=s.gems.pop().value;}emit(s,'kill',e.x,e.y,{angle:s.player.aim});
 const rank=moduleRank(s,'catalyst');if(rank&&e.burn>0&&!e.burnDepth&&['native','dot'].includes(source)){const others=alive(s).filter(o=>o!==e&&distance(e,o)<100).sort((a,b)=>distance(e,a)-distance(e,b)).slice(0,rank);for(const other of others)burn(other,RULES.modules.catalyst.burnDamagePerSecond[rank-1],2,1);}
}
function damage(s,e,amount,kind='bullet',source='native',owner=null,weight=0){
 if(e.hp<=0||e.dead)return;
 const catalyst=moduleRank(s,'catalyst');if(kind==='blast'&&e.burn>0&&catalyst)amount*=1+RULES.modules.catalyst.blastBonusOnBurn[catalyst-1];
 amount*=1+s.boosts.power*.01;
 if(e.type==='boss'){const b=s.boss,a=Math.atan2(s.player.y-b.y,s.player.x-b.x),rear=Math.cos(a-b.body)<-.35;amount*=b.mode==='recover'&&rear?1.5:Math.cos(a-b.body)>.35?.65:1;}
 if(e.type==='shield'&&kind==='bullet'&&Math.cos(Math.atan2(s.player.y-e.y,s.player.x-e.x)-e.aim)>.45)amount*=.45;
 if(e.type==='courier'&&kind==='bullet'&&s.raid?.contract==='armored'&&Math.cos(Math.atan2(s.player.y-e.y,s.player.x-e.x)-e.aim)>.5)amount*=.5;
 const actual=e.part||e;actual.hp=Math.max(0,actual.hp-amount);e.hp=actual.hp;e.hurt=.10;actual.hurt=.1;
 if(['rifle','shield','mortar','officer'].includes(e.type)){const dx=e.x-s.player.x,dy=e.y-s.player.y,d=Math.hypot(dx,dy)||1,push=(kind==='blast'?RULES.combatFeel.blastPush:RULES.combatFeel.bulletPush)*(e.type==='shield'?RULES.combatFeel.shieldPushMultiplier:1);move(s,e,dx/d*push,dy/d*push,e.r);}
 if(source==='module')s.stats.moduleDamage+=amount;
 if(source==='native'&&weight>0){feed(s,owner,weight,e);if(kind==='blast'&&e.burn>0&&catalyst&&s.heatCd<=0){s.heatCd=.5;s.stats.heatBursts++;blast(s,e.x,e.y,80,RULES.modules.catalyst.heatBurstDamage[catalyst-1],'module');}}
 if(e.dead||e.hp>0)return;
 if(e.type==='part'){emit(s,'break',e.x,e.y,{life:.7});return;}
 if(e.type==='boss'){s.boss.dead=true;s.stats.bossKilled=true;s.stats.score+=1000;emit(s,'boss-down',e.x,e.y,{life:1.2});return;}
 if(e.type==='courier'){e.dead=true;s.raid.state='success';s.stats.raidSuccess++;s.stats.score+=300;gainXp(s,12);emit(s,'break',e.x,e.y);return;}
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
function blast(s,x,y,r,amount,source='native',owner=null,ignite=false){
 emit(s,'explosion',x,y,{r,life:.4});let budget=2;
 for(const e of targets(s)){if(e.hp<=0||distance(e,{x,y})>r+e.r||lineBlocked(s,{x,y},e))continue;const w=source==='native'?Math.min(.5,budget):0;budget-=w;damage(s,e,amount,'blast',source,owner,w);if(ignite&&e.hp>0)burn(e);}
 for(const b of s.blocks)if(b.hp>0&&Math.hypot(b.x+b.w/2-x,b.y+b.h/2-y)<r+Math.max(b.w,b.h)/2)b.hp=Math.max(0,b.hp-amount);
 if(ignite&&s.zones.length<12)s.zones.push({x,y,r:r*.65,dps:12,life:2,tick:.3,source:'dot'});
}
function fire(s,w,target,a,amount,opts={}){
 if(s.shots.length>=320)return false;const d=weaponStats(w),rocket=opts.rocket??w.id==='r',origin=opts.origin;s.shots.push({x:origin?origin.x:s.player.x+Math.cos(a)*22,y:origin?origin.y:s.player.y+Math.sin(a)*22,vx:Math.cos(a)*(rocket?300:700),vy:Math.sin(a)*(rocket?300:700),life:d.range/(rocket?300:700),damage:amount,r:rocket?7:3,rocket,radius:opts.radius??d.radius,source:opts.source||'native',owner:w.uid,target:target?.id,homing:opts.homing??w.branch==='homing',incendiary:opts.incendiary??w.branch==='incendiary',bounces:Math.min(4,(w.branch==='ricochet'?1:0)+moduleRank(s,'ricochet')),hitIds:[]});return true;
}
function shoot(s,w){
 const d=weaponStats(w),p=s.player,candidates=attackTargets(s,d.range),target=targetFor(s,w,d,candidates);if(!target){const b=s.blocks.find(b=>b.hp>0&&distance({x:b.x+b.w/2,y:b.y+b.h/2},p)<150);if(b){b.hp=Math.max(0,b.hp-d.damage);p.attack=.1;emit(s,'impact',b.x+b.w/2,b.y+b.h/2);return true;}return false;}if(w.id!=='f'&&s.shots.length+d.count+(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7?1:0)>320)return false;
 const a=Math.atan2(target.y-p.y,target.x-p.x);p.aim=a;p.attack=.12;
 if(w.id==='f'){
  for(const e of targets(s)){const angle=Math.atan2(e.y-p.y,e.x-p.x),delta=Math.atan2(Math.sin(angle-a),Math.cos(angle-a));if(distance(p,e)<d.range+e.r&&Math.abs(delta)<d.cone*Math.PI/360&&!lineBlocked(s,p,e)){burn(e);damage(s,e,d.damage,'fire','native',w.uid,0);}}
  emit(s,'flame',p.x,p.y,{angle:a,r:d.range,cone:d.cone,life:.14});
  if(w.branch==='trail'&&w.shots%6===0&&p.moving&&s.zones.filter(z=>z.owner===w.uid).length<3)s.zones.push({x:p.x,y:p.y,r:50,dps:12,life:2,tick:.25,source:'dot',owner:w.uid});
 }else{
  const ordered=[target,...candidates.filter(e=>e.id!==target.id)];
  for(let i=0;i<d.count;i++){const t=ordered[i%ordered.length],angle=Math.atan2(t.y-p.y,t.x-p.x)+(ordered.length===1?(i-(d.count-1)/2)*.035:0);fire(s,w,t,angle,d.damage);}
  if(w.id==='h'&&w.branch==='grenade'&&w.shots%8===7)fire(s,w,target,a,60,{rocket:true,radius:100,homing:false,incendiary:false});emit(s,'shot',p.x+Math.cos(a)*28,p.y-18+Math.sin(a)*28,{angle:a,life:.08});
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
 for(const h of s.hazards){h.timer-=dt;if(h.timer<=0&&!h.hit){h.hit=true;emit(s,'explosion',h.x,h.y,{r:h.r,life:.3});if(distance(h,p)<h.r+16&&(!incoming||incoming.amount<14))incoming={amount:14,x:h.x,y:h.y};}}
 s.enemyShots=s.enemyShots.filter(q=>q.life>0);s.hazards=s.hazards.filter(h=>h.timer>-.3);s.enemies=s.enemies.filter(e=>!e.dead||e.death>0);
 if(incoming&&(!s.hitCandidate||incoming.amount>s.hitCandidate.amount))s.hitCandidate=incoming;
}

function updateBoss(s,dt){
 const b=s.boss,p=s.player;if(!b.active||b.dead)return;updateBurn(s,b,dt);for(const part of b.parts)updateBurn(s,part,dt);if(b.dead)return;b.timer-=dt;b.spawnClock-=dt;b.kick=Math.max(0,b.kick-dt*3);b.flash=Math.max(0,b.flash-dt);
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
function updateSites(s){
 if(s.stage==='boss')return;
 for(const site of s.sites){
  if(site.id==='supply-b'&&site.state==='waiting'){site.baseX??=site.x;site.x=site.baseX+Math.sin(s.t*.35)*55;}
  if(site.state==='waiting'&&distance(site,s.player)<215){const count=site.kind==='armory'?5:6,reserve=alive(s).length+count-160;if(reserve>0){const remove=new Set(alive(s).filter(e=>!e.siteId&&!s.challenge?.targets.includes(e.id)&&distance(e,s.player)>280).sort((a,b)=>distance(b,s.player)-distance(a,s.player)).slice(0,reserve).map(e=>e.id));s.enemies=s.enemies.filter(e=>!remove.has(e.id));}if(alive(s).length+count>160)continue;site.state='active';for(let i=0;i<count;i++){const angle=i*TAU/6;spawnEnemy(s,site.kind==='armory'&&i===0?'officer':i===1?'shield':'rifle',site.x+Math.cos(angle)*85,site.y+Math.sin(angle)*65,site.id);}emit(s,'engage',site.x,site.y);}
  if(site.state==='active'&&!s.enemies.some(e=>!e.dead&&e.siteId===site.id)){site.state='ready';s.stats.score+=400;emit(s,'supply-ready',site.x,site.y,{life:.8});}
  if(site.state==='ready'&&distance(site,s.player)<74){site.state='done';
   if(site.kind==='armory'){const quality=rollQuality(s,'normal');openChoice(s,'armory',armoryCards(s,quality),site.name,{quality});}
   else openChoice(s,'supply',supplyCards(s),site.name);
   return;
  }
 }
}
function startRaid(s,contract){
 if(s.phase!=='choice'||s.choice.type!=='armory'||s.raidUsed||!RULES.raidContracts[contract]||s.challenge?.state==='active')return false;
 const cfg=RULES.raidContracts[contract],route=s.seed%2===0?[{x:1260,y:470},{x:970,y:300},{x:600,y:470},{x:260,y:700}]:[{x:340,y:470},{x:630,y:300},{x:1000,y:470},{x:1340,y:700}];
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
function updatePowerWave(s,dt){const wave=s.powerWave;if(!wave||s.stage==='boss')return;if(wave.delay>0){wave.delay-=dt;return;}wave.clock-=dt;if(wave.clock<=0&&wave.remaining>0){wave.clock=.4;for(let i=0;i<4&&wave.remaining>0;i++)if(spawnAround(s,'rifle',{},360))wave.remaining--;}if(wave.remaining<=0)s.powerWave=null;}
function updateChallenge(s){if(s.challenge?.state==='active'&&s.challenge.targets.every(id=>!s.enemies.some(e=>e.id===id&&!e.dead))){s.challenge.state='complete';s.stats.challenge=1;s.stats.score+=500;emit(s,'challenge-clear',s.player.x,s.player.y,{text:'잔류 도전 1 완료 · +500',life:1.5});}}
export function interaction(s){if(s.phase!=='playing')return null;if(s.stage==='field'&&distance(s.player,{x:800,y:350})<130)return{id:'boss',label:s.raid?.state==='active'?'습격 종료 후 보스 도전':'F · 장갑 수송차 도전'};if(s.stage==='holdout'&&distance(s.player,{x:800,y:420})<140)return{id:'extract',label:'F · 살아서 귀환'};return null;}
export function action(s,kind){
 if(kind.startsWith('raid:'))return startRaid(s,kind.split(':')[1]);
 if(kind==='withdraw'){if(s.raid?.state!=='active')return false;s.raid.state='withdrawn';s.stats.raidFailed++;emit(s,'raid-failed',s.player.x,s.player.y,{text:'습격 철수 · 상자 소실',life:1.2});return true;}
 if(s.phase!=='playing')return false;const p=s.player;
 if(kind==='gear'){openChoice(s,'assembly',[...assemblyOptions(s),{id:'back',kind:'back',title:'전투로 돌아가기',desc:'조율권과 무장을 유지합니다.'}],'병기 조립');return true;}
 if(kind==='dash'){if(p.dashCd>0)return false;p.dash=.18;p.dashCd=2;p.invuln=Math.max(p.invuln,.30);emit(s,'dash',p.x,p.y,{angle:p.aim,life:.2});return true;}
 if(kind==='skill'){const cfg=RULES.fio[p.doctrine];if(p.skillCd>0||p.overdrive>0||p.charge<cfg.cost)return false;p.charge-=cfg.cost;p.overdrive=cfg.duration;p.skillCd=cfg.cooldown;emit(s,'skill',p.x,p.y,{text:'전탄 보급',life:.7});return true;}
 if(kind==='challenge'){if(s.stage!=='holdout'||s.challenge||s.raid?.state==='active')return false;const ids=[];for(const dx of [-220,220]){const e=spawnEnemy(s,'officer',clamp(p.x+dx,100,1500),clamp(p.y-240,100,1100),null,{hp:450,maxHp:450});if(e)ids.push(e.id);}if(ids.length<2){s.enemies=s.enemies.filter(e=>!ids.includes(e.id));return false;}s.challenge={state:'active',targets:ids};emit(s,'challenge-start',p.x,p.y,{text:'지휘관 2기 처치 · 도전 1',life:1});return true;}
 if(kind==='interact'){const item=interaction(s);if(!item)return false;if(item.id==='extract'){finish(s,true);return true;}if(s.raid?.state==='active')return false;s.stage='boss';s.refits=0;s.boss.active=true;s.boss.mode='aim';s.boss.timer=1.3;p.x=800;p.y=470;p.invuln=Math.max(p.invuln,1);s.enemies=s.enemies.filter(e=>distance(e,s.boss)<400);s.enemyShots=[];s.hazards=[];emit(s,'boss-arrival',800,250,{life:1.3});return true;}
 return false;
}
export function finish(s,won=false,reason='retreat'){
 if(s.phase==='result')return false;won=!!won&&s.stats.bossKilled&&s.player.hp>0;if(won&&!s.stats.extractionPaid){s.stats.score+=3000;s.stats.extractionPaid=true;}
 if(s.raid?.state==='active'){s.raid.state='withdrawn';s.stats.raidFailed++;}if(s.challenge?.state==='active')s.challenge.state='withdrawn';
 s.phase='result';s.result={won,reason:won?'prototype-complete':s.player.hp<=0?'prototype-failed':reason,seed:s.seed,seconds:s.t,score:s.stats.score,level:s.level,weapons:clone(s.weapons),modules:clone(s.modules),stats:clone(s.stats)};s.choice=null;s.choices=[];return true;
}
export function step(s,dt,input={x:0,y:0},view=null){
 if(s.phase!=='playing')return;dt=clamp(dt,0,1/30);if(!dt)return;if(view)s.view={w:view.w,h:view.h};s.hitCandidate=null;s.t+=dt;const p=s.player;
 if(s.stage==='holdout')s.holdTime+=dt;const pressure=s.stage==='holdout'?s.clearPressure+Math.floor(s.holdTime/30):Math.floor(s.t/60);if(pressure>s.pressure){s.pressure=pressure;emit(s,'pressure',p.x,p.y,{text:`경계 ${pressure} · 증원 강화`,life:1.3});}
 for(const key of ['invuln','hurt','attack','dash','dashCd','skillCd','pickupTime'])p[key]=Math.max(0,p[key]-dt);
 const previousOverdrive=p.overdrive;p.overdrive=Math.max(0,p.overdrive-dt);if(previousOverdrive>0&&p.overdrive===0&&moduleRank(s,'overcharger'))blast(s,p.x,p.y,180,140,'module');
 p.charge=Math.min(100,p.charge+(s.stage==='boss'?2:.5)*dt);s.coilCd=Math.max(0,s.coilCd-dt);s.heatCd=Math.max(0,s.heatCd-dt);
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.max(1,Math.hypot(ix,iy)),moving=Math.hypot(ix,iy)>.07;p.moving=moving;
 if(moving){const speed=p.dash>0?650:190*(p.pickupTime>0?1+moduleRank(s,'magnet')*.03:1);move(s,p,ix/len*speed*dt,iy/len*speed*dt,16);p.walk+=speed*dt*.05;}
 updateRaid(s,dt);
 if(s.stage!=='boss'){
  s.spawnClock-=dt;if(s.spawnClock<=0){s.spawnClock=2.4;for(let i=0;i<Math.min(12,5+s.pressure);i++)spawnAround(s,s.pressure>1&&i===0?'officer':s.pressure>0&&i%5===1?'shield':s.pressure>0&&i%5===3?'mortar':'rifle');}
  if(s.pressure>=4){s.pursuitClock=(s.pursuitClock??1)-dt;if(s.pursuitClock<=0){s.pursuitClock=Math.max(4,18-s.pressure);const hp=300*Math.pow(1.12,s.pressure-3);spawnAround(s,'officer',{hp,maxHp:hp});}}
 }
 updatePowerWave(s,dt);
 for(const w of s.weapons){w.cd-=dt;w.payloadCd=Math.max(0,w.payloadCd-dt);if(w.cd<=0){const fired=shoot(s,w);w.cd=fired?weaponStats(w).interval*(p.overdrive>0?.65:1):0;}}
 updateShots(s,dt);
 for(const z of s.zones){z.life-=dt;z.tick-=dt;if(z.tick<=0){z.tick=.25;for(const e of targets(s))if(e.hp>0&&distance(z,e)<z.r+e.r&&!lineBlocked(s,z,e)){burn(e);damage(s,e,z.dps*.25,'fire','dot');}}}s.zones=s.zones.filter(z=>z.life>0);
 updateEnemies(s,dt);updateBoss(s,dt);if(s.hitCandidate)hurt(s,s.hitCandidate.amount,s.hitCandidate.x,s.hitCandidate.y);delete s.hitCandidate;
 let pickupCharge=0;p.pickupBudget=Math.min(3,(p.pickupBudget??3)+dt*3);
 for(const gem of s.gems){gem.age+=dt;const d=distance(gem,p),reach=65+s.boosts.pickup*10+moduleRank(s,'magnet')*30;if(d<reach){const f=Math.min(1,dt*10);gem.x+=(p.x-gem.x)*f;gem.y+=(p.y-gem.y)*f;if(d<22){gainXp(s,gem.value);pickupCharge+=gem.value*.15;gem.collected=true;p.pickupTime=.6;}}}s.gems=s.gems.filter(g=>!g.collected);const gained=Math.min(pickupCharge,p.pickupBudget);p.pickupBudget-=gained;p.charge=Math.min(100,p.charge+gained*(1+Math.min(.2,s.level*.01)));
 s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;for(const fx of s.effects)fx.age+=dt;s.effects=s.effects.filter(fx=>fx.age<fx.life);
 if(s.boss.dead&&s.stage==='boss'){s.stage='holdout';s.boss.active=false;s.clearPressure=s.pressure;s.holdTime=0;s.enemyShots=[];s.hazards=[];s.queue.unshift({type:'clear',source:'MISSION CLEAR',cards:[{id:'stay',kind:'stay',title:'화력을 더 쓴다',desc:'남은 보급·대군·잔류 도전. 출구에서 언제든 귀환.'},{id:'extract',kind:'extract',title:'살아서 귀환',desc:'이번 전투의 기록을 확정합니다.'}]});}
 updateChallenge(s);if(p.hp<=0){finish(s,false,'hp');return;}
 if(s.raid?.state==='success'&&!s.raid.rewardQueued){s.raid.rewardQueued=true;s.queue.push({type:'raid-reward',source:'습격 성공 · 새 보급',cards:armoryCards(s,s.raid.quality),extra:{quality:s.raid.quality}});}
 updateSites(s);nextChoice(s);
}
export function takeEvents(s){const e=s.events;s.events=[];return e;}
