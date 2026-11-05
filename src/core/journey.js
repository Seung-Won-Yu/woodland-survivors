import {BASE_WEAPON_IDS,WEAPONS} from './content.js';
export const isJourney=g=>g.campaign?.version===3;
export const REGIONS=[
 {id:'road',name:'보급로',boss:'보급로 수문장',role:'warden',hp:5200,damage:12,recommended:9,color:'#dfc489'},
 {id:'grove',name:'군락 심부',boss:'포자 군락의 어미',role:'matriarch',hp:42000,damage:16,recommended:21,color:'#aac6ad'},
 {id:'heart',name:'수호목 공터',boss:'숲의 군주 모르가',role:'sovereign',hp:155000,damage:20,recommended:26,color:'#dfb8b1'}
];
const encounter=()=>({state:'waiting',id:null,spawnedAt:null,defeatedAt:null});
export function createJourney(difficulty='normal'){
 return {version:3,ruleset:'expedition-v09',mode:'expedition',difficulty,regionIndex:0,depth:1,stageState:'hunting',stageStartedAt:0,cleared:0,seals:0,rewardPending:false,transitionPending:false,records:[],encounter:encounter(),boosts:{force:0,tempo:0,vigor:0,overflow:0},nextHordeAt:32,hordes:0,overrunAnnounced:false,styleChosen:false};
}
export function journeyStatus(g){
 const c=g.campaign,r=REGIONS[c.regionIndex],elapsed=g.time-c.stageStartedAt;
 const overrunAt=c.regionIndex===2?Infinity:Math.min(c.stageStartedAt+180,(c.encounter.defeatedAt??Infinity)+15);
 return {...r,index:c.regionIndex,stage:c.stageState,elapsed,overrun: g.time>=overrunAt,untilOverrun:Math.max(0,overrunAt-g.time),seals:c.seals,canChallenge:c.regionIndex<2&&c.stageState==='hunting',canExit:c.regionIndex<2&&c.stageState==='cleared'&&!c.rewardPending,remainingCaches:(g.expedition?.sites||[]).filter(s=>s.kind==='armory'&&s.state!=='spent').length};
}
export function challengeJourney(g,spawn){
 if(!isJourney(g)||g.phase!=='playing'||g.campaign.stageState!=='hunting')return false;
 const c=g.campaign,r=REGIONS[c.regionIndex],hp=r.hp*(c.difficulty==='dense'?1.15:1);
 const gate=g.expedition.sites.find(s=>s.id==='gate')||{x:0,y:-150};
 const e=spawn('king',gate.x,gate.y-80,{bossRole:c.regionIndex===0?'midpoint':'final',encounterRole:r.role,hp,maxHp:hp,r:c.regionIndex===0?34:44,speed:c.regionIndex===0?38:30,damage:r.damage,xp:60,clock:1.7,bossPhase:1,cycle:0,canEvolve:false});
 if(!e)return false;c.encounter={state:'active',id:e.id,spawnedAt:g.time,defeatedAt:null};c.stageState='boss';
 g.events.push({type:'boss-arrival'});return true;
}
export function finishJourneyBoss(g,e){
 const c=g.campaign,s=c.encounter;
 if(!isJourney(g)||s.state!=='active'||s.id!==e.id)return false;
 s.state='defeated';s.id=null;s.defeatedAt=g.time;c.cleared=c.regionIndex+1;
 c.records.push({region:c.regionIndex,time:g.time,duration:g.time-s.spawnedAt,kills:g.kills});g.kingKills++;
 if(c.regionIndex===2){c.stageState='complete';g.outcome='victory';g.phase='result';g.expedition.complete=true;g.events.push({type:'victory'});}
 else{c.stageState='cleared';c.seals++;c.rewardPending=true;g.chest={source:'journey',bossLoot:true,gold:0,rewards:[],options:[],canEvolve:true,optionalUnion:true,returnPhase:'playing'};g.phase='chest';g.events.push({type:'boss-defeated'});}
 return true;
}
export function advanceJourney(g){
 const c=g.campaign;if(!isJourney(g)||g.phase!=='playing'||!c.transitionPending||c.stageState!=='cleared'||c.rewardPending||g.pendingLevels>0||c.regionIndex>=2)return false;
 c.regionIndex++;c.depth=c.regionIndex+1;c.stageStartedAt=g.time;c.stageState='hunting';c.encounter=encounter();c.transitionPending=false;c.nextHordeAt=g.time+20;c.overrunAnnounced=false;
 g.enemies=[];g.projectiles=[];g.fields=[];g.delayed=[];g.pickups=[];g.effects=[];g.texts=[];g.player.x=0;g.player.y=160;g.player.invincible=2;g.player.dash=0;g.player.still=0;g.player.stillGrace=0;g.spawn=.5;g.nextElite=g.time+90;delete g.boon;
 g.chest=null;g.relicOffer=null;g.grid=null;return true;
}
function hash(seed,salt){let h=seed>>>0;for(const ch of salt)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h;}
export function cacheDeck(seed,key){return [...BASE_WEAPON_IDS].sort((a,b)=>hash(seed,`${key}:${a}`)-hash(seed,`${key}:${b}`));}
export function cacheWeaponChoices(g,site){
 const fresh=site.deck.filter(id=>!g.weapons[id]&&!g.consumed.includes(id)&&g.pool.includes(id));
 if(Object.keys(g.weapons).length>=4||!fresh.length)return [];
 const recipePartners={acorn:'moon',moon:'acorn',briar:'bees',bees:'briar'};
 const partner=recipePartners[g.startWeapon],out=[];
 if(site.primary&&fresh.includes(partner))out.push(partner);
 for(const id of fresh)if(!out.includes(id)&&out.length<3)out.push(id);
 return out.map(id=>({id,kind:'new-weapon'}));
}
export function validJourney(c,g){
 const integer=(n,a=0,b=1e8)=>Number.isInteger(n)&&n>=a&&n<=b;
 const time=n=>Number.isFinite(n)&&n>=0&&n<=g.time;
 if(c.ruleset!=='expedition-v09'||c.mode!=='expedition'||!['normal','dense'].includes(c.difficulty)||!integer(c.regionIndex,0,2)||c.depth!==c.regionIndex+1||!['hunting','boss','cleared','complete'].includes(c.stageState)||!time(c.stageStartedAt)||!integer(c.cleared,0,3)||!integer(c.seals,0,Math.min(2,c.cleared))||typeof c.rewardPending!=='boolean'||typeof c.transitionPending!=='boolean'||typeof c.styleChosen!=='boolean'||typeof c.overrunAnnounced!=='boolean'||!Number.isFinite(c.nextHordeAt)||!integer(c.hordes))return false;
 if(c.seals+g.evolutions.length!==Math.min(2,c.cleared))return false;
 if(!c.boosts||['force','tempo','vigor','overflow'].some(k=>c.boosts[k]!==0)||!Array.isArray(c.records)||c.records.length!==c.cleared||c.records.some((r,i)=>r.region!==i||!time(r.time)||!Number.isFinite(r.duration)||r.duration<0||!integer(r.kills)))return false;
 const e=c.encounter,live=g.enemies.filter(e=>e.bossRole&&!e.dead);if(!e||!['waiting','active','defeated'].includes(e.state))return false;
 if(e.state==='waiting'&&(e.id!==null||e.spawnedAt!==null||e.defeatedAt!==null||live.length||c.stageState!=='hunting'))return false;
 if(e.state==='active'&&(!time(e.spawnedAt)||e.defeatedAt!==null||live.length!==1||e.id!==live[0].id||live[0].encounterRole!==REGIONS[c.regionIndex].role||c.stageState!=='boss'))return false;
 if(e.state==='defeated'&&(e.id!==null||live.length||!time(e.spawnedAt)||!time(e.defeatedAt)||e.defeatedAt<e.spawnedAt||!['cleared','complete'].includes(c.stageState)))return false;
 if(c.cleared!==(e.state==='defeated'?c.regionIndex+1:c.regionIndex)||c.rewardPending&&(c.regionIndex===2||c.stageState!=='cleared'||g.phase!=='chest'||(g.chest?.source!=='journey'||g.chest?.bossLoot!==true))||c.transitionPending&&(c.stageState!=='cleared'||c.rewardPending))return false;
 return !(c.stageState==='complete'&&(c.regionIndex!==2||g.phase!=='result'||g.outcome!=='victory'));
}
export function coreVariant(id,core){return id==='returning'?(core==='moon'?'focus':'spread'):(core==='bees'?'counter':'guard');}
export function transformationName(id,core){return id==='returning'?(core==='moon'?'왕복 산탄 · 귀환 집중':'왕복 산탄 · 폭발 산개'):(core==='bees'?'보호 벌떼 · 추적 출격':'보호 벌떼 · 수호 궤도');}
