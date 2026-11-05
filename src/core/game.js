import {isJourney,journeyStatus,coreVariant,cacheWeaponChoices,cacheDeck,transformationName} from './journey.js';
import {createHeroGrowth,growthCharge,growthCast,growthHit,growthTick,growthKill,growthBlock,styleChoices,validHeroGrowth} from './hero-growth.js';
import {isFrontier,recordHunt} from './frontier.js';
import {MASTERY,WEAPON_BRANCHES,beginCast,pipHit,bramAward,tickMastery,chargeSignature,unlockMastery,branchChoices,selectBranch,validMastery} from './mastery.js';
import {weaponPose} from '../game/motion.js';
import {moveActor} from '../game/terrain.js';
import {createRelics,createRelicCache,tickRelics,onRelicWeaponHit,onRelicWeaponKill,onRelicHealing,absorbRelicShield,onRelicShieldBreak,validRelics,RELICS,RELIC_SOURCES} from './relics.js';
import {createSynergies,validSynergies,SYNERGIES} from './synergies.js';
import {beetleBehavior,sporeBehavior,guardianBehavior,scheduledBossBehavior,fieldContains,bossShotProfile,GUARDIANS} from './patterns.js';
import {updateCampaign,finishCampaignBoss,validCampaign,advanceCampaign} from './campaign.js';
import {HEROES,WEAPONS,BASE_WEAPON_IDS,UNIONS,PASSIVES,UPGRADES,ENEMIES,SLOT_LIMIT,RUN_SECONDS,BOSS_SECONDS} from './content.js';
import {weaponPool,unlocked,normalizeProfile} from './profile.js';

export const LIMITS={enemies:600,projectiles:420,effects:180,fields:60,texts:64,pickups:500};
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=(x,y)=>{const l=Math.hypot(x,y)||1;return {x:x/l,y:y/l};};
const fromPool=(g,list)=>list[Math.floor(random(g)*list.length)];
export function random(g){g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;}
export function xpCost(level){return level===1?10:12+level*8-Math.min(24,Math.max(0,level-3)*2)+Math.floor(Math.pow(Math.max(0,level-10),1.6)*1.2);}
export function createGame(profile,hero='pip',hard=false,seed=Date.now()) {
  profile=normalizeProfile(profile);
  if(!Object.hasOwn(HEROES,hero)||!unlocked(profile,hero))hero='pip';
  const h=HEROES[hero],u=profile.upgrades;
  const g={version:2,runId:`${Date.now()}-${seed>>>0}-${hero}`,seed:seed>>>0,id:0,hero,hard:!!hard&&profile.wins>0,phase:'playing',time:0,level:1,xp:0,pendingLevels:0,kills:0,elites:0,kingKills:0,gold:0,damage:0,peakEnemies:0,
    initialSeed:seed>>>0,relics:createRelics(),relicOffer:null,synergies:createSynergies(),
    player:{x:0,y:0,fx:1,fy:0,hp:h.hp+u.vitality*10,maxHp:h.hp+u.vitality*10,hurt:0,invincible:1.5,walk:0,moving:false,wind:0,still:0,stillGrace:0,charge:0,dash:0,dashCooldown:0,attack:0,guard:0},
    weapons:{[h.weapon]:{rank:1,evolved:false,clock:.15}},passives:{},pool:weaponPool(profile),boosts:{...u},
    consumed:[],discovered:[h.weapon],maxRanks:{[h.weapon]:1},evolutions:[],unions:[],drafts:0,upgradeMisses:0,mastered:false,
    metrics:{firstLevelAt:null,firstEvolutionAt:null,firstUnionAt:null,chests:0,signatures:0,damageTaken:0,xpDropped:0,xpCollected:0,xpGranted:0,blockedSeconds:0,damageBySource:{contact:0,charge:0,projectile:0,field:0}},
    enemies:[],projectiles:[],gems:new Map(),flying:[],pickups:[],fields:[],effects:[],texts:[],delayed:[],events:[],choices:[],decoy:null,
    rerolls:2+u.reroll,banishes:0,skips:0,banished:[],spawn:.1,nextSurge:35,nextElite:75,wave:0,finalSpawned:false,bossId:null,
    view:{width:1200,height:760},feedback:{nextImpactAt:0,killWindowAt:0,killCount:0,nextCrowdAt:0},shake:0,hitstop:0,pauseReason:'',outcome:null,banked:false};
  for(let i=0;i<8;i++){const a=i*TAU/8;spawnEnemy(g,'shroom',Math.cos(a)*350,Math.sin(a)*300);}
  g.stats=deriveStats(g);return g;
}
export function deriveStats(g) {
  const p=g.passives,h=HEROES[g.hero],u=g.boosts,c=g.campaign?.boosts||{};
  return {damage:(g.boon?.until>g.time?1.35:1)*(1+(p.berry||0)*.12+(u.might||0)*.05)*(1+(c.force||0)*.18+(c.overflow||0)*.025),
    eliteDamage:g.hero==='fox'?1.2:1,
    area:(1+(p.leaf||0)*.12)*(g.hero==='mole'&&(g.player.still>=.6||g.player.stillGrace>0)?1.25:1)*(1+(c.force||0)*.05),
    duration:(1+(p.dew||0)*.2)*(g.hero==='otter'?1.25:1),
    cooldown:Math.max(.12,(g.gear==='boots'&&g.player.moving?.9:1)*(1-(p.feather||0)*.07)*(1-(g.hero==='lune'?g.player.wind*.05:0))/(1+(c.tempo||0)*.1)),
    amount:(p.twin||0)+(g.hero==='pip'?1:0)+(isJourney(g)&&g.hero==='pip'&&g.mastery.branch==='spread'?2:0),projectileSpeed:1+(p.swift||0)*.15,
    speed:((isFrontier(g)||isJourney(g))&&g.hero==='bram'?166:h.speed)*(g.gear==='boots'?1.12:1),armor:(g.hero==='bram'?2:0)+(p.bark||0)+(g.gear==='bark'&&g.player.still>.5?3:0),magnet:94+(u.magnet||0)*12+(p.stone||0)*22,
    growth:1+(u.growth||0)*.05+(p.stone||0)*.06,regen:(u.recovery||0)*.08,knock:1};
}
function emit(g,type,data={}){g.events.push({type,...data});}
function weaponMetric(g,id,kind,value=1){
  if(!Object.hasOwn(WEAPONS,id))return;
  g.metrics.weapons??={};g.metrics.weapons[id]??=Object.fromEntries(['opening','build','final'].map(key=>[key,{damage:0,hits:0,casts:0}]));
  const phase=isJourney(g)?['opening','build','final'][g.campaign.regionIndex]:g.time<180?'opening':g.time<420?'build':'final';g.metrics.weapons[id][phase][kind]+=value;
}
function effect(g,type,x,y,r,color='#ebc780',life=.35,extra={}) {
  if(g.effects.length>=LIMITS.effects)g.effects.shift();
  g.effects.push({type,x,y,r,color,life,maxLife:life,...extra});
}
function floating(g,x,y,value,color='#f2dfb5',large=false) {
  if(g.texts.length>=LIMITS.texts)g.texts.shift();g.texts.push({x,y,value,color,large,life:large?.85:.55});
}
const specs={shroom:[15,51,7,12,2],runner:[12,109,9,11,3],beetle:[51,40,13,18,5],warden:[51,40,13,18,5],spore:[26,47,8,13,4],elite:[480,48,15,27,30],king:[104000,43,22,46,100]};
export function spawnEnemy(g,type,x,y,extra={}) {
  if(g.enemies.length>=LIMITS.enemies&&type!=='king')return null;
  const [baseHp,speed,damage,r,xp]=specs[type];
  const scaling=isJourney(g)?(type==='king'?1:(type==='elite'?2:1)*(1+g.campaign.regionIndex*1.5+Math.min(180,g.time-g.campaign.stageStartedAt)/180)):isFrontier(g)?(type==='king'?1:type==='elite'?1+Math.min(g.time,600)/180:1+Math.min(g.time,540)/135):type==='king'?1:type==='elite'?1+g.time/(g.campaign?150:80):Math.pow(1+Math.min(g.time,g.campaign?480:RUN_SECONDS)/75,1.05);
  const hp=Math.min(1e7,baseHp*scaling*(g.hard?1.35:1)*(g.campaign&&!isJourney(g)?Math.pow(1.18,Math.min(40,g.campaign.depth-1)):1));
  const e={id:++g.id,type,x,y,hp,maxHp:hp,canEvolve:g.time>=(g.campaign?180:600),speed:speed*(1+Math.min(.35,g.time/2200))*(g.hard?1.12:1),damage:damage+(g.campaign?Math.min(g.time,480):g.time)/180,r,xp,hurt:0,slow:0,kx:0,ky:0,clock:2+random(g)*2,age:0,mode:'walk',dead:false,...extra};
  g.enemies.push(e);return e;
}
function edgeSpawn(g,type) {
  // Narrow screens must keep the same approach distance instead of spawning a pincer beside the player.
  const p=g.player,w=Math.max(560,g.view.width/2+75),h=Math.max(420,g.view.height/2+75),side=Math.floor(random(g)*4);
  const x=p.x+(side<2?(side===0?-w:w):(random(g)*2-1)*w);
  const y=p.y+(side>=2?(side===2?-h:h):(random(g)*2-1)*h);
  return spawnEnemy(g,type,x,y);
}
function enemyType(g) {
  const r=random(g),t=g.time;
  if(t>120&&r<.13)return g.expedition&&g.enemies.filter(e=>e.type==='spore'&&!e.dead).length>=4?'shroom':'spore';
  if(t>70&&r<.30)return t>85&&r<.10?'warden':'beetle';
  if(t>28&&r<.50)return 'runner';
  return 'shroom';
}
function updateDirector(g,dt) {
  if(isJourney(g)){updateJourneyDirector(g,dt);return;}
  if(g.campaign)updateCampaign(g,(...args)=>spawnEnemy(g,...args));
  const bossFight=!!g.campaign&&(g.campaign.mid.state==='active'||g.campaign.final.state==='active');
  const returning=!g.campaign&&!!g.expedition&&g.time>=150;
  if(isFrontier(g)){updateFrontierDirector(g,dt,bossFight);return;}
  const awakened=!!g.campaign&&g.campaign.mid.state==='defeated';
  const cap=g.campaign?(bossFight?65:awakened?280:Math.min(170,24+g.time*.3)):Math.min(520,24+g.time*.45);
  const rate=(g.campaign?(bossFight?2.2:awakened?Math.min(26,14+(g.time-180)*.05):Math.min(11,1.7+g.time*.022)):Math.min(27,1.7+g.time*.026))*(g.hard?1.2:1)*(returning?.75:1);
  g.spawn-=dt;
  while(g.spawn<=0){g.spawn+=1/rate;if(g.enemies.length<cap)edgeSpawn(g,enemyType(g));}
  const wave=Math.floor(g.time/30);
  if(wave!==g.wave){g.wave=wave;if(wave%2===0)emit(g,'wave',{wave});}
  if(g.time>=g.nextSurge&&(g.campaign||g.time<RUN_SECONDS)) {
    g.nextSurge+=45;
    if(!bossFight){
    const angle=random(g)*TAU,count=Math.round(Math.min(48,14+Math.floor(g.time/25))*(returning?.6:1));
    const radius=Math.hypot(g.view.width,g.view.height)/2+80;
    for(let i=0;i<count;i++){
      const a=angle+(i/count-.5)*1.1;
      spawnEnemy(g,g.time>120&&i%4===0?'runner':'shroom',g.player.x+Math.cos(a)*radius,g.player.y+Math.sin(a)*radius);
    }
    emit(g,'surge');
    }
  }
  if(g.time>=g.nextElite&&(g.campaign||g.time<RUN_SECONDS)) {
    g.nextElite+=75;const e=bossFight?null:edgeSpawn(g,'elite');
    if(e){if(Math.round(g.time)%300<2){e.hp*=2;e.maxHp=e.hp;e.ancient=true;}emit(g,'elite');}
  }
  if(!g.campaign&&g.time>=BOSS_SECONDS&&!g.finalSpawned) {
    g.finalSpawned=true;
    const e=spawnEnemy(g,'king',g.player.x,g.player.y-g.view.height/2-80);g.bossId=e.id;
    emit(g,'boss');g.shake=7;
  }
  g.peakEnemies=Math.max(g.peakEnemies,g.enemies.length);
}
function updateFrontierDirector(g,dt,bossFight){
  const c=g.campaign,later=c.depth>1,threat=Math.floor(g.time/45),rate=bossFight?1.8:later?Math.min(24,11+threat):Math.min(8,2.8+g.time*.022),cap=bossFight?45:later?300:160;
  g.spawn-=dt;while(g.spawn<=0){g.spawn+=1/rate;if(g.enemies.length<cap)edgeSpawn(g,enemyType(g));}
  if(!bossFight&&g.time>=c.nextHordeAt){c.nextHordeAt=g.time+(later?23:35);c.hordes++;const count=later?95:28,radius=Math.max(580,Math.hypot(g.view.width,g.view.height)/2+80),angle=random(g)*TAU;for(let i=0;i<count&&g.enemies.length<cap;i++){const a=angle+(i/count-.5)*2.8;spawnEnemy(g,i%11===0?'beetle':'shroom',g.player.x+Math.cos(a)*radius,g.player.y+Math.sin(a)*radius);}emit(g,'surge');}
  if(g.time>=g.nextElite){g.nextElite=g.time+80;if(!bossFight)edgeSpawn(g,'elite');}
  g.peakEnemies=Math.max(g.peakEnemies,g.enemies.length);
}
function pipSupport(g,target){
  const m=g.mastery,spread=m.tier===3&&m.branch==='spread',count=spread?3:1,angle=Math.atan2(target.y-g.player.y,target.x-g.player.x);
  for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.5;projectile(g,'acorn',g.player.x,g.player.y-12,Math.cos(a)*620,Math.sin(a)*620,(12+g.level)*g.stats.damage,{r:5,pierce:spread?2:0,life:.75,context:{source:'mastery',weapon:'acorn'}});}
}
function bramCounter(g){
  const m=g.mastery,p=g.player,strong=m.branch==='counter',r=strong?195:110,damage=(12+g.level*1.6)*g.stats.damage*(strong?1.8:.7),context={source:'mastery',weapon:'briar'};
  // Queue retaliation after the incoming collision finishes; no recursive block/hit loop.
  g.delayed.push({at:g.time+.08,x:p.x,y:p.y,r,damage,knock:strong?180:80,color:'#badaaa',context});
  if(strong&&m.tier===3)for(let i=0;i<6;i++){const a=i*TAU/6;projectile(g,'moon',p.x,p.y,Math.cos(a)*380,Math.sin(a)*380,damage*.65,{r:9,pierce:5,life:1.7,returnAfter:.5,context});}
}
function offerBranch(g){if(!isFrontier(g)||g.phase!=='playing')return;const choices=branchChoices(g);if(choices.length){g.choices=choices;g.choiceMode=choices[0].kind;g.phase='choice';emit(g,'level');}}
export function frontierForgeCandidates(g){
  if(isJourney(g))return journeyForgeCandidates(g);
  if(!isFrontier(g))return [];
  const out=evolutionCandidates(g).filter(()=>g.campaign.seals>0).map(id=>({id:`evolve:${id}`,weapon:id,kind:'evolution',name:WEAPONS[id].evo,description:`${WEAPONS[id].evoText} 인장 1개 소비 · 촉매 유지`,consumes:[id],catalyst:WEAPONS[id].recipe}));
  for(const r of unionCandidates(g))for(const input of r.inputs.filter(i=>g.weapons[i.id].evolved)){const branch=g.weapons[input.id].branch||'기본';out.unshift({id:`union:${r.id}:${input.id}`,weapon:r.id,kind:'union',core:input.id,name:r.name,description:`계승: ${WEAPONS[input.id].evo} · ${branchLabel(input.id,branch)}. 인장 추가 소비 없음.`,consumes:r.inputs.map(i=>i.id),catalyst:null});}
  return out;
}
export function branchLabel(id,branch){return (WEAPON_BRANCHES[id]||WEAPON_BRANCHES[id==='returning'?'acorn':'briar']||[]).find(b=>b[0]===branch)?.[1]||'기본 궤적';}
export function openForge(g){if(isJourney(g)){if(!['playing','paused'].includes(g.phase))return false;const returnPhase=g.phase;g.chest={source:'journey',bossLoot:false,gold:0,rewards:[],options:journeyForgeCandidates(g),canEvolve:true,optionalUnion:true,returnPhase};g.phase='chest';return true;}if(!isFrontier(g)||!['playing','paused','crossroads'].includes(g.phase)||g.campaign.rewardPending)return false;const returnPhase=g.phase;g.chest={gold:0,rewards:[],options:frontierForgeCandidates(g),canEvolve:true,source:'forge',optionalUnion:true,returnPhase};g.phase='chest';return true;}
export function claimBossReward(g,id){
  if(isJourney(g))return claimJourneyReward(g,id);
  if(!isFrontier(g)||g.phase!=='crossroads'||!g.campaign.rewardPending)return false;
  if(id==='heal')healPlayer(g,g.player.maxHp*.5);
  else if(id.startsWith('weapon:')){const key=id.slice(7),w=g.weapons[key];if(!w||w.evolved||w.rank>=8)return false;w.rank++;w.clock=0;recordRank(g,key);}
  else if(id.startsWith('catalyst:')){const key=id.slice(9);if(!Object.values(g.weapons).length||!Object.keys(g.weapons).some(w=>WEAPONS[w].recipe===key)||!PASSIVES[key]||g.passives[key]||Object.keys(g.passives).length>=4)return false;g.passives[key]=1;}
  else return false;
  g.campaign.rewardPending=false;g.stats=deriveStats(g);return true;
}
function buildGrid(g) {
  g.grid=new Map();
  for(const e of g.enemies)if(!e.dead){const key=`${Math.floor(e.x/96)},${Math.floor(e.y/96)}`;let b=g.grid.get(key);if(!b){b=[];g.grid.set(key,b);}b.push(e);}
}
function nearby(g,x,y,r,visit) {
  if(!g.grid){for(const e of g.enemies)if(!e.dead&&Math.hypot(e.x-x,e.y-y)<=r+e.r)visit(e);return;}
  const reach=r+50;
  for(let cx=Math.floor((x-reach)/96);cx<=Math.floor((x+reach)/96);cx++)for(let cy=Math.floor((y-reach)/96);cy<=Math.floor((y+reach)/96);cy++){
    const b=g.grid.get(`${cx},${cy}`);if(b)for(const e of b)if(!e.dead&&Math.hypot(e.x-x,e.y-y)<=r+e.r)visit(e);
  }
}
function guardAlert(g,e){return !e.supplyGuard||!e.home||dist(g.player,e.home)<285||e.hp<e.maxHp;}
function nearest(g,point=g.player,range=900) {
  let target=null,best=range;
  for(const e of g.enemies)if(!e.dead&&guardAlert(g,e)){const d=dist(point,e);if(d<best){target=e;best=d;}}
  return target;
}
function addGem(g,x,y,value,unlimited=false) {
  g.metrics.xpDropped=(g.metrics.xpDropped||0)+value;
  // Only merge inside the same small world cell. Distant XP never teleports.
  const epoch=!unlimited&&isFrontier(g)&&g.campaign.readyAt!==null?g.campaign.epoch:0;
  const key=`${Math.floor(x/30)},${Math.floor(y/30)}${epoch?`:${epoch}`:''}`,existing=g.gems.get(key);
  if(existing)existing.value+=value;else g.gems.set(key,{x,y,value,age:0,epoch});
}
function trimPickups(g){while(g.pickups.length>LIMITS.pickups){let index=g.pickups.findIndex(p=>!['chest','relic'].includes(p.type));if(index<0)index=0;const [old]=g.pickups.splice(index,1);if(old.type==='coin')g.gold+=2;}}
function resolveRelics(g,actions){
  for(const action of actions){
    const {relicId:id,synergy,mastered}=action,baseContext={source:'relic',relic:id},context={...baseContext,...(synergy?{synergy}:{})};
    if(action.kind==='wind'){for(const offset of mastered?[-.18,.18]:[0]){const angle=action.angle+offset;projectile(g,'wind',action.x,action.y,Math.cos(angle)*720,Math.sin(angle)*720,action.damage*(mastered?1.05:1),{r:mastered?20:16,pierce:99,life:synergy==='gale'?1.25:.4,returning:synergy==='gale',returnSynergy:synergy==='gale'?'gale':undefined,returnAfter:.32,flySpeed:640,context:baseContext});}}
    else if(action.kind==='target'){const e=g.enemies.find(e=>e.id===action.target&&!e.dead);if(e){hit(g,e,action.damage,0,g.player,false,baseContext);effect(g,'relic',e.x,e.y-25,32,RELICS[id].color,.35,{relicId:id});if(synergy==='swarm')for(let i=0;i<(mastered?4:2);i++){const a=Math.atan2(e.y-g.player.y,e.x-g.player.x)+(i-(mastered?3:1)/2)*.35;projectile(g,'bee',g.player.x,g.player.y,Math.cos(a)*250,Math.sin(a)*250,action.damage*(mastered?.36:.3),{r:mastered?9:7,pierce:mastered?2:1,life:mastered?2.2:1.8,target:e.id,flySpeed:390,context});}}}
    else if(action.kind==='burst'){
      areaHit(g,action.x,action.y,action.r,action.damage,action.knock,synergy==='bastion'?context:baseContext);effect(g,'relic',action.x,action.y,action.r,RELICS[id].color,.4,{relicId:id});
      if(synergy==='bramble')relicField(g,action.x,action.y,mastered?125:95,mastered?2:1.5,0,mastered?1.2:.8,context,mastered?70:0);
      if(synergy==='bastion'&&mastered)g.delayed.push({at:g.time+.25,x:action.x,y:action.y,r:180,damage:action.damage*.7,knock:220,color:RELICS.shell.color,context});
      if(synergy==='conductor'){
        let from={x:action.x,y:action.y};const visited=new Set();
        for(let i=0;i<(mastered?5:3);i++){const target=g.enemies.filter(e=>!e.dead&&!visited.has(e.id)&&dist(e,from)<(i?(mastered?240:200):360)).sort((a,b)=>dist(a,from)-dist(b,from))[0];if(!target)break;visited.add(target.id);effect(g,'bolt',target.x,target.y,20,'#bddcdb',.28,{fromX:from.x,fromY:from.y});hit(g,target,(10+g.level*.8)*g.stats.damage*(mastered?1.4:1),35,from,false,context);from=target;}
      }
    }
    else if(action.kind==='seed'){g.pickups.push({id:++g.id,type:'heal',x:action.x,y:action.y,amount:mastered?12:8,relicId:'seed',expiresAt:g.time+16});if(synergy==='garden')relicField(g,action.x,action.y,mastered?105:75,mastered?4.5:3,(4+g.level*.25)*g.stats.damage*(mastered?1.3:1),0,context);}
    else if(action.kind==='shield')effect(g,'relic',g.player.x,g.player.y-25,35,RELICS[id].color,.35,{relicId:id});
  }
}
function relicField(g,x,y,r,life,damage,slow,context,pull=0){if(g.fields.length>=LIMITS.fields)g.fields.shift();g.fields.push({x,y,r,life,tick:0,damage,slow,pull,context});}
function kill(g,e,context={source:'weapon'}) {
  if(e.dead)return;e.dead=true;g.kills++;if(isJourney(g))growthKill(g,e,context);else if(isFrontier(g))chargeSignature(g,.9);else g.player.charge=clamp(g.player.charge+.9,0,100);
  if(isFrontier(g)){recordHunt(g,e,xpCost);if(g.hero==='bram'&&['weapon','signature'].includes(context.source)&&dist(e,g.player)<=150&&(g.player.still>=.55||g.player.guard>0||g.player.stillGrace>0))bramAward(g,e,e.type==='elite'?8:2);}
  if(g.campaign){const f=g.feedback;f.streak=g.time<=(f.streakUntil||0)?(f.streak||0)+1:1;f.streakUntil=g.time+2;g.metrics.bestStreak=Math.max(g.metrics.bestStreak||0,f.streak);if([12,30,60,100].includes(f.streak))emit(g,'rampage',{count:f.streak});}
  for(const f of g.fields)if(f.ownerId===e.id)f.life=0;
  g.fields=g.fields.filter(f=>f.life>0);
  if(e.nestGuardian||e.bossRole){for(const q of g.projectiles)if(q.hostile&&q.ownerId===e.id)q.life=0;g.projectiles=g.projectiles.filter(q=>q.life>0);}
  addGem(g,e.x,e.y,e.xp*(isJourney(g)?.85:isFrontier(g)?.65:1+Math.floor(g.time/180)),!!e.bossRole);
  effect(g,'death',e.x,e.y,e.r,e.type==='beetle'?'#5dbfb3':'#e5b78b',.28,{enemyType:e.type,angle:Math.atan2(e.ky,e.kx)});
  emit(g,'kill');
  resolveRelics(g,onRelicWeaponKill(g,e,context));
  if(e.type!=='elite'&&e.type!=='king'){
    const f=g.feedback;
    if(g.time-f.killWindowAt>.12){f.killWindowAt=g.time;f.killCount=0;}
    if(++f.killCount>=3&&g.time>=f.nextCrowdAt){f.nextCrowdAt=g.time+.4;f.killCount=0;g.shake=Math.max(g.shake,1.4);g.hitstop=Math.max(g.hitstop,.018);emit(g,'crowd-break');}
  }
  if(e.bossRole){finishCampaignBoss(g,e);if(isJourney(g)&&g.chest)g.chest.options=journeyForgeCandidates(g);if(!isJourney(g)&&e.bossRole==='midpoint')createRelicCache(g,'midpoint',e.x+65,e.y-10);trimPickups(g);return;}
  if(e.type==='king'){g.kingKills++;g.gold+=120;g.pickups.push({id:++g.id,type:'chest',x:e.x,y:e.y,canEvolve:true});g.shake=6;emit(g,'bossDown');trimPickups(g);return;}
  if(e.type==='elite'){
    g.elites++;g.pickups.push({id:++g.id,type:'chest',x:e.x,y:e.y,canEvolve:e.canEvolve,forgeWeapon:e.nestGuardian?g.startWeapon:null,source:e.nestGuardian?'nest':'elite'});if(e.nestGuardian)createRelicCache(g,'nest',e.x+60,e.y-15);g.fields=g.fields.filter(f=>f.ownerId!==e.id);g.hitstop=.04;g.shake=3;emit(g,'eliteDown');
  }else{
    const r=random(g);
    if(r<.013)g.pickups.push({id:++g.id,type:'heal',x:e.x,y:e.y});
    else if(r<.016)g.pickups.push({id:++g.id,type:'magnet',x:e.x,y:e.y});
    else if(r<.028&&!isJourney(g))g.pickups.push({id:++g.id,type:'coin',x:e.x,y:e.y});
  }
  trimPickups(g);
}
function hit(g,e,amount,knock=0,origin=g.player,crit=false,context=origin.context??g.castContext??{source:'weapon'}) {
  if(e.dead)return;
  if(isJourney(g)&&growthHit(g,e,context))journeySplinters(g,e);
  if(isJourney(g)&&g.hero==='pip'&&context.source==='weapon'){if(g.mastery.branch==='focus'&&['elite','king'].includes(e.type))amount*=1.2;if(g.mastery.focusUntil>g.time)amount*=1.3;}
  if(isFrontier(g)&&pipHit(g,e,context))pipSupport(g,e);
  if(isFrontier(g)&&g.weapons[context.weapon]?.branch==='focus'&&['elite','king'].includes(e.type))amount*=1.25;
  if(e.type==='warden'&&e.mode==='windup'&&e.attack==='brace'&&context.source==='weapon'){
    const incoming=direction(origin.x-e.x,origin.y-e.y);if(incoming.x*e.dx+incoming.y*e.dy>.35)amount*=.6;
  }
  amount*=e.type==='elite'||e.type==='king'?g.stats.eliteDamage:1;
  const dealt=Math.min(e.hp,amount);e.hp-=amount;g.damage+=dealt;e.hurt=.13;e.hitstop=crit?.035:.018;
  if(context.source==='weapon'&&context.weapon){weaponMetric(g,context.weapon,'damage',dealt);weaponMetric(g,context.weapon,'hits');}
  if(context.source==='relic'&&Object.hasOwn(RELICS,context.relic))g.relics.stats[context.relic].damage+=dealt;
  if(context.synergy&&Object.hasOwn(SYNERGIES,context.synergy))g.synergies.stats[context.synergy].damage+=dealt;
  const wasKnocked=e.lastKnockedAt!==undefined&&g.time-e.lastKnockedAt<=2;
  // A fast projectile can finish beyond its target. Its velocity, not its final position, defines the impulse.
  const impulse=origin.kind&&Math.hypot(origin.vx||0,origin.vy||0)>0?direction(origin.vx,origin.vy):direction(e.x-origin.x,e.y-origin.y);
  if(knock){const mass=e.type==='king'?.1:e.type==='elite'?.35:1;e.kx+=impulse.x*knock*g.stats.knock*mass;e.ky+=impulse.y*knock*g.stats.knock*mass;if(context.source==='weapon')e.lastKnockedAt=g.time;}
  effect(g,'impact',e.x,e.y-25,crit?14:8,crit?'#ffe6a1':WEAPONS[context.weapon]?.color||RELICS[context.relic]?.color||'#f7dda8',crit?.17:.14,{angle:Math.atan2(impulse.y,impulse.x),crit,weapon:context.weapon||null});
  if(g.time>=g.feedback.nextImpactAt){g.feedback.nextImpactAt=g.time+.12;g.hitstop=Math.max(g.hitstop,crit?.018:.007);g.shake=Math.max(g.shake,crit?1.1:.38);}
  else if(crit)g.shake=Math.max(g.shake,1.1);
  if(crit||g.texts.length<16||random(g)<.1)floating(g,e.x,e.y-48,Math.round(amount),crit?'#ffdf78':'#f4e9cb',crit);
  if(!g.hitEvent){emit(g,'impact');g.hitEvent=true;}
  if(e.hp<=0)kill(g,e,context);
  resolveRelics(g,onRelicWeaponHit(g,e,context,wasKnocked,Math.atan2(impulse.y,impulse.x)));
}
function areaHit(g,x,y,r,damage,knock=0,context=g.castContext??{source:'weapon'}) {nearby(g,x,y,r,e=>hit(g,e,damage,knock,{x,y},false,context));}
function projectile(g,kind,x,y,vx,vy,damage,extra={}) {
  if(g.projectiles.length>=LIMITS.projectiles){const old=g.projectiles.findIndex(q=>!q.hostile&&q.context?.source==='relic'),fallback=old>=0?old:g.projectiles.findIndex(q=>!q.hostile);if(fallback<0)return;g.projectiles.splice(fallback,1);}
  if(!extra.hostile&&Math.hypot(x-g.player.x,y-g.player.y)<26){
    const m=g.castOrigin||weaponPose(g.player);x=m.x;y=m.y;
    if(kind==='bottle'){extra.ox=x;extra.oy=y;}
  }
  g.projectiles.push({kind,x,y,vx,vy,damage,life:2,age:0,r:6,pierce:0,hits:[],context:extra.hostile?undefined:g.castContext??{source:'weapon',weapon:kind},...extra});
}
export function weaponStats(g,id,rank=g.weapons[id]?.rank||1){const w=g.weapons[id],d=WEAPONS[id],evo=!!w?.evolved&&!d.union;return {damage:(d.damage+(rank-1)*3.3)*g.stats.damage*(evo?(isJourney(g)?1.9:1.65):1),cooldown:d.cooldown*g.stats.cooldown*(1-Math.min(.28,(rank-1)*.035))*(g.campaign&&w?.evolved?.85:1),rank,evolved:evo};}
function damageFor(g,id){return weaponStats(g,id).damage;}
function cast(g,id) {
  const p=g.player,w=g.weapons[id],s=g.stats,rank=w.rank,evo=w.evolved,target=nearest(g),amount=s.amount;
  if(!target&&id!=='bloom'&&id!=='briar'&&!WEAPONS[id].union)return;
  weaponMetric(g,id,'casts');
  g.castContext={source:'weapon',weapon:id,...(isJourney(g)?{castId:growthCast(g)}:isFrontier(g)?{castId:beginCast(g)}:{})};
  const branch=isJourney(g)&&WEAPONS[id].union?coreVariant(id,w.core):isFrontier(g)?w.branch:null,heroBranch=isJourney(g)?null:g.mastery?.branch;
  const damage=damageFor(g,id)*(isJourney(g)&&g.hero==='pip'&&g.mastery.branch==='spread'?.85:1)*(branch==='spread'?(id==='moon'?.85:.8):branch==='counter'?1.25:1)*(heroBranch==='spread'?.87:heroBranch==='focus'&&g.mastery.focusUntil>g.time?1.3:1),angle=target?Math.atan2(target.y-p.y,target.x-p.x):Math.atan2(p.fy,p.fx);
  const primary=Object.hasOwn(g.weapons,g.startWeapon)?g.startWeapon:Object.keys(g.weapons)[0];
  const ownsPose=id===primary||p.attack<=0;
  if(ownsPose){p.attack=.24;p.attackWindup=0;p.aim=angle;p.attackWeapon=id;}
  const muzzle=weaponPose({...p,attack:.24},angle);g.castOrigin=muzzle;
  emit(g,'attack',{weapon:id,angle,x:muzzle.x,y:muzzle.y,primary:ownsPose});
  if(['acorn','moon','bees','returning','lantern'].includes(id))effect(g,'muzzle',muzzle.x,muzzle.y,9,WEAPONS[id].color,.085,{angle,weapon:id});
  if(id==='acorn'){
    const count=Math.min(15,1+amount+Math.floor(rank/4)+(evo?3:0)+(branch==='spread'?2:0)+(heroBranch==='spread'?2:0));
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(branch==='focus'||heroBranch==='focus'||isJourney(g)&&g.mastery.branch==='focus'?.035:branch==='spread'||heroBranch==='spread'||isJourney(g)&&g.hero==='pip'&&g.mastery.branch==='spread'?.19:evo?.15:.10);projectile(g,'acorn',p.x,p.y-7,Math.cos(a)*580*s.projectileSpeed,Math.sin(a)*580*s.projectileSpeed,damage,{r:6*s.area,pierce:Math.floor(rank/3)+(evo?5:0)+(isJourney(g)&&g.hero==='pip'?g.mastery.milestone:0),evolved:evo,life:1.7});}
    emit(g,'shot');
  }else if(id==='moon'){
    emit(g,'whoosh');
    const count=1+amount+Math.floor(rank/4)+(evo?2:0)+(branch==='spread'?1:0)+(heroBranch==='spread'?1:0);
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(branch==='focus'||isJourney(g)&&g.hero==='pip'&&g.mastery.branch==='focus'?.08:.3);projectile(g,'moon',p.x,p.y,Math.cos(a)*460*s.projectileSpeed,Math.sin(a)*460*s.projectileSpeed,damage,{r:(evo?25:15)*s.area,pierce:999,life:2.2*s.duration,evolved:evo,turned:false,returnAfter:.65*s.duration,flySpeed:(branch==='focus'?675:540)*s.projectileSpeed});}
  }else if(id==='bees'){
    emit(g,'buzz');
    const count=1+amount+Math.floor(rank/3)+(evo?3:0)+(branch==='guard'?1:0);
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(isJourney(g)&&g.hero==='pip'&&g.mastery.branch==='focus'?.12:.5);projectile(g,'bee',p.x,p.y-18,Math.cos(a)*240*s.projectileSpeed,Math.sin(a)*240*s.projectileSpeed,damage,{r:8,life:3*s.duration,pierce:(evo?3:0)+(isJourney(g)&&g.hero==='pip'?g.mastery.milestone:0),target:target.id,evolved:evo,flySpeed:(branch==='counter'?510:390)*s.projectileSpeed,defender:branch==='guard'});}
  }else if(id==='storm'){
    const targets=g.enemies.filter(e=>!e.dead&&guardAlert(g,e)&&dist(e,p)<650).sort((a,b)=>dist(a,p)-dist(b,p));
    const count=Math.min(targets.length,1+amount+Math.floor(rank/3)+(evo?3:0));
    for(let i=0;i<count;i++){
      const e=targets[i];if(!e)continue;
      areaHit(g,e.x,e.y,(24+rank*2)*s.area,damage,15);effect(g,'bolt',e.x,e.y,100,'#d7f5ff',.22,{fromX:e.x+18,fromY:e.y-180});
      if(evo){let previous=e;const visited=new Set([e.id]);for(let n=0;n<4;n++){let next=null;nearby(g,previous.x,previous.y,150,q=>{if(!visited.has(q.id)&&!next)next=q;});if(!next)break;visited.add(next.id);effect(g,'bolt',next.x,next.y,20,'#bbd7ff',.24,{fromX:previous.x,fromY:previous.y});hit(g,next,damage*.7,10);previous=next;}}
    }
    emit(g,'zap');
  }else if(id==='lantern'){
    emit(g,'throw');
    const count=1+Math.floor(rank/4)+Math.floor(amount/2);
    for(let i=0;i<count;i++){const a=i*2.4+g.time,x=target.x+Math.cos(a)*i*65,y=target.y+Math.sin(a)*i*65;projectile(g,'bottle',p.x,p.y,0,0,damage,{life:.32,flight:.32,tx:x,ty:y,ox:p.x,oy:p.y,fieldRadius:(65+rank*5)*(evo?1.45:1)*s.area,fieldLife:(2.5+rank*.12)*s.duration,evolved:evo});}
  }else if(id==='returning'){
    const count=Math.min(16,7+amount+(branch==='spread'?4:0));
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(branch==='focus'?.035:.18);projectile(g,'moon',p.x,p.y,Math.cos(a)*600*s.projectileSpeed,Math.sin(a)*600*s.projectileSpeed,damage,{r:17*s.area,pierce:999,life:2.5*s.duration,evolved:true,turned:false,returnAfter:.65*s.duration,flySpeed:630*s.projectileSpeed,union:'returning',core:w.core});}
    emit(g,'shot');
  }else if(id==='hive'){
    const count=Math.min(16,6+(isJourney(g)&&branch==='guard'?0:amount)+(branch==='guard'?2:0));
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.45;projectile(g,'bee',p.x+Math.cos(a)*60,p.y+Math.sin(a)*48,Math.cos(a)*300*s.projectileSpeed,Math.sin(a)*300*s.projectileSpeed,damage,{r:10,life:2.8,pierce:5,target:target?.id||0,evolved:true,flySpeed:(branch==='counter'?570:480)*s.projectileSpeed,union:'hive',core:w.core,defender:branch==='guard',returnAfter:branch==='counter'?1.55:.8});}
  }else if(id==='vine'){
    const r=(112+rank*8)*s.area,spread=evo?Math.PI:1.15,face=angle;
    nearby(g,p.x,p.y,r,e=>{const a=Math.atan2(e.y-p.y,e.x-p.x),diff=Math.atan2(Math.sin(a-face),Math.cos(a-face));if(Math.abs(diff)<=spread)hit(g,e,damage,110);});
    effect(g,'slash',p.x,p.y,r,evo?'#f3b8cc':'#b8db8f',.26,{angle:face,spread});
    if(evo)g.delayed.push({at:g.time+.2,x:p.x,y:p.y,r:r*.85,damage:damage*.65,knock:45,color:'#e79fb6',context:g.castContext});
    emit(g,'slash');
  }else if(id==='bloom'){
    const r=(100+rank*12)*s.area;areaHit(g,p.x,p.y,r,damage,95);
    effect(g,'ring',p.x,p.y,r,'#f3e3ab',.55);
    if(evo){g.delayed.push({at:g.time+.3,x:p.x,y:p.y,r:r*1.25,damage:damage*.75,knock:60,color:'#f1d6a0',context:g.castContext});for(let i=0;i<8+amount;i++){const a=i*TAU/(8+amount)+g.time;projectile(g,'seed',p.x,p.y,Math.cos(a)*280*s.projectileSpeed,Math.sin(a)*280*s.projectileSpeed,damage*.5,{life:1.6,pierce:2,r:6});}}
    emit(g,'pulse');
  }
  delete g.castOrigin;
  delete g.castContext;
}
export function useSignature(g) {
  if(g.phase!=='playing'||g.player.charge<100)return false;
  g.castContext={source:'signature',weapon:HEROES[g.hero].weapon};
  const p=g.player;p.charge=0;p.invincible=Math.max(p.invincible,.7);g.shake=4;g.metrics.signatures++;
  const damage=(26+g.level*2.2)*g.stats.damage,face=Math.atan2(p.fy,p.fx);
  p.attack=.24;p.signature=.24;p.aim=face;p.attackWeapon=HEROES[g.hero].weapon;
  if(g.hero==='pip'){
    const spread=g.mastery?.branch==='spread',count=spread?23:15;
    for(let i=0;i<count;i++){const a=face+(i-(count-1)/2)*(spread?.12:.045);projectile(g,'acorn',p.x,p.y,Math.cos(a)*650,Math.sin(a)*650,damage,{life:1.6,pierce:8,r:9,evolved:true});}
    areaHit(g,p.x,p.y,95,damage,160);effect(g,'ring',p.x,p.y,130,'#ffd489',.4);
  }else if(g.hero==='lune'){
    p.dash=.3;p.invincible=1;
    for(let i=0;i<3;i++){const a=face+(i-1)*.24;projectile(g,'moon',p.x,p.y,Math.cos(a)*620,Math.sin(a)*620,damage,{r:25,pierce:999,life:2,evolved:true,returnAfter:.6,flySpeed:580});}
  }else if(g.hero==='bram'){
    p.guard=isJourney(g)?2:g.mastery?.branch==='guard'?3:2;p.invincible=isFrontier(g)||isJourney(g)?0:2;if(isJourney(g)){g.mastery.extraGuard=28;effect(g,'ring',p.x,p.y,95,'#b8e0af',.45);}else areaHit(g,p.x,p.y,220,damage*1.5,350);effect(g,'ring',p.x,p.y,240,'#b8e0af',.65);
  }else if(g.hero==='fox'){
    g.decoy={x:p.x,y:p.y,life:3};effect(g,'ring',p.x,p.y,60,'#dba077',.5);p.invincible=1;
  }else if(g.hero==='mole'){
    p.dash=.25;p.invincible=1.1;areaHit(g,p.x,p.y,150,damage,200);effect(g,'ring',p.x,p.y,180,'#c8b98d',.5);
  }else if(g.hero==='otter'){
    for(const [key,gem] of g.gems)if(dist(gem,p)<300){g.gems.delete(key);g.flying.push({...gem,speed:200});}
    areaHit(g,p.x,p.y,240,damage,220);effect(g,'ring',p.x,p.y,260,'#a5dce0',.7);
  }
  delete g.castContext;emit(g,'signature');return true;
}
export function dash(g) {
  if(g.phase!=='playing'||g.player.dashCooldown>0)return false;
  g.player.dash=.17;g.player.dashCooldown=4;g.player.invincible=Math.max(g.player.invincible,.28);effect(g,'dash',g.player.x,g.player.y,30,'#e2eac7',.3);return true;
}
export function orbitState(g,id='briar') {
  const w=g.weapons[id];if(!w)return null;
  const hive=id==='hive',rank=hive?8:w.rank,evolved=hive||w.evolved;
  const activeFor=(4+rank*.15)*g.stats.duration,rest=.55*g.stats.cooldown;
  const active=evolved||g.time%(activeFor+rest)<activeFor;
  const branch=isJourney(g)&&hive?coreVariant(id,w.core):isFrontier(g)?w.branch:null;
  return {active,count:Math.min(isJourney(g)?10:40,(hive?4:2)+(branch==='guard'?2:0)+Math.floor(rank/3)+(isJourney(g)&&hive&&branch==='counter'?0:g.stats.amount)+(evolved?2:0)),radius:(57+rank*3)*(branch==='guard'?1.25:branch==='counter'?.85:1)*g.stats.area,speed:(evolved?2.5:1.9)*(branch==='counter'?1.35:1)*g.stats.projectileSpeed,hive};
}
function updateWeapons(g,dt) {
  if(g.player.signature>0)return;
  for(const [id,w] of Object.entries(g.weapons)){
    if(id==='briar'||id==='hive'){
      const orbit=orbitState(g,id),damage=damageFor(g,id)*(id==='hive'?.72:1)*(isFrontier(g)?w.branch==='guard'?.85:w.branch==='counter'?1.3:1:1);
      if((isFrontier(g)||isJourney(g))&&g.hero==='pip'&&g.time>=(w.masteryCastAt||0)){w.masteryCastId=isJourney(g)?growthCast(g):beginCast(g);w.masteryCastAt=g.time+.7;}
      if(orbit.active)for(let i=0;i<orbit.count;i++){
        const a=g.time*orbit.speed+i*TAU/orbit.count,x=g.player.x+Math.cos(a)*orbit.radius,y=g.player.y+Math.sin(a)*orbit.radius*.8;
        nearby(g,x,y,20*g.stats.area,e=>{if((e.orbitHit||0)>g.time)return;e.orbitHit=g.time+(w.evolved?.24:.42);hit(g,e,damage,45,g.player,false,{source:'weapon',weapon:id,...((isFrontier(g)||isJourney(g))?{castId:w.masteryCastId}:{})});if(w.evolved)e.slow=.8;});
      }
      if(w.evolved)nearby(g,g.player.x,g.player.y,orbit.radius+30,e=>{e.slow=.5;});
      if(id==='briar')continue;
    }
    w.clock-=dt;
    const primary=Object.hasOwn(g.weapons,g.startWeapon)?g.startWeapon:Object.keys(g.weapons)[0];
    if(id===primary&&w.clock>0&&w.clock<.085&&g.player.attack<=0){const target=nearest(g);if(target){g.player.attackWindup=w.clock;g.player.attackWeapon=id;g.player.aim=Math.atan2(target.y-g.player.y,target.x-g.player.x);}}
    if(w.clock>0)continue;
    cast(g,id);w.clock=weaponStats(g,id).cooldown;
  }
}
function hostileShot(g,e,a,speed=120) {projectile(g,'enemy',e.x,e.y,Math.cos(a)*speed,Math.sin(a)*speed,e.damage,{hostile:true,ownerId:e.id,attackCycle:e.cycle||0,r:7,life:e.bossRole?bossShotProfile(e).life:e.nestGuardian?3.5:e.type==='spore'?4:6});}
function enemyField(g,field){if(g.fields.length<LIMITS.fields)g.fields.push({...field,attackCycle:g.enemies.find(e=>e.id===field.ownerId)?.cycle||0,warningMax:field.warning});}
function updateEnemies(g,dt) {
  const p=g.player;
  const api={field:f=>enemyField(g,f),shot:(e,a,s)=>hostileShot(g,e,a,s),effect:(...args)=>effect(g,...args),emit:type=>emit(g,type),spawn:(...args)=>spawnEnemy(g,...args)};
  for(const e of g.enemies){
    if(e.dead)continue;e.age+=dt;e.clock-=dt;e.hurt=Math.max(0,e.hurt-dt);e.slow=Math.max(0,e.slow-dt);
    e.freezeFrame=false;if(e.hitstop>0){e.hitstop=Math.max(0,e.hitstop-dt);e.freezeFrame=true;continue;}
    if(isJourney(g)&&e.targetRole==='support-flower'){if(e.clock<=0){e.clock=5;e.cycle=(e.cycle||0)+1;enemyField(g,{hostile:true,ownerId:e.id,pattern:'roots',x:p.x,y:p.y,r:58,life:1.65,warning:1.1,tick:0,damage:12});}continue;}
    const wasCharging=e.mode==='charge';
    const destination=g.decoy&&e.type!=='king'?g.decoy:p;
    let d=direction(destination.x-e.x,destination.y-e.y),speed=e.speed*(e.slow>0?.62:1),distance=dist(e,p);
    if(e.supplyGuard&&e.home){
      // Territorial guards keep the supply encounter in its clearing, including on small screens.
      const chasing=guardAlert(g,e)&&dist(p,e.home)<340&&dist(e,e.home)<225;
      if(!chasing){const a=e.patrolAngle+e.age*.18,target={x:e.home.x+Math.cos(a)*70,y:e.home.y+Math.sin(a)*58};d=direction(target.x-e.x,target.y-e.y);speed=dist(e,target)>7?24:0;}
    }
    if(e.type==='runner'){
      if(e.mode==='windup'){speed=0;e.windup-=dt;if(e.windup<=0){e.mode='charge';e.charge=.32;}}
      else if(e.mode==='charge'){d={x:e.dx,y:e.dy};speed=340;e.charge-=dt;if(e.charge<=0){e.mode='recover';e.recover=.65;}}
      else if(e.mode==='recover'){speed=0;e.recover-=dt;if(e.recover<=0){e.mode='walk';e.clock=1.8;}}
      else if(distance<370&&e.clock<=0){e.mode='windup';e.windup=.55;e.dx=d.x;e.dy=d.y;speed=0;}
    }
    if(e.type==='warden')({d,speed}=beetleBehavior(g,e,dt,d,speed,distance,api));
    if(e.type==='spore')({d,speed}=sporeBehavior(g,e,dt,d,speed,distance,api));
    if(e.nestGuardian)({d,speed}=guardianBehavior(g,e,dt,d,speed,distance,api));
    else if(e.type==='elite'&&e.clock<=0){e.clock=7;for(let i=0;i<4;i++){const a=i*TAU/4;spawnEnemy(g,'shroom',e.x+Math.cos(a)*55,e.y+Math.sin(a)*55);}effect(g,'ring',e.x,e.y,65,'#d3a1a0',.6);}
    if(e.bossRole)({d,speed}=scheduledBossBehavior(g,e,dt,d,speed,distance,api));
    else if(e.type==='king'){
      const enraged=e.hp<e.maxHp*.45||g.time>BOSS_SECONDS+100;
      if(e.mode==='windup'){
        speed=0;e.windup-=dt;
        if(e.windup<=0){e.mode='charge';e.charge=.7;e.dx=d.x;e.dy=d.y;effect(g,'ring',e.x,e.y,80,'#f5ac79',.3);}
      }else if(e.mode==='charge'){
        d={x:e.dx,y:e.dy};speed=470;e.charge-=dt;if(e.charge<=0){e.mode='walk';e.clock=1.5;}
      }else if(e.clock<=0){
        e.cycle=(e.cycle||0)+1;e.clock=enraged?2.5:3.6;
        if(e.cycle%3===0){e.mode='windup';e.windup=.9;emit(g,'bossCharge');}
        else if(e.cycle%3===1){for(let i=0;i<(enraged?20:14);i++)hostileShot(g,e,i*TAU/(enraged?20:14)+e.age*.1,enraged?155:125);effect(g,'ring',e.x,e.y,80,'#d6a6d7',.4);}
        else{
          for(let i=0;i<7;i++){const a=i*2.4,x=p.x+Math.cos(a)*60*(i%3),y=p.y+Math.sin(a)*60*(i%3);g.fields.push({hostile:true,x,y,r:38,life:1.6,warning:1,tick:0,damage:20});}
          for(let i=0;i<8;i++){const a=i*TAU/8;spawnEnemy(g,'runner',e.x+Math.cos(a)*100,e.y+Math.sin(a)*100);}
        }
      }
    }
    if((e.nestGuardian||e.bossRole)&&(e.mode==='charge'||wasCharging))e.kx=e.ky=0;
    // A gentle local separation keeps the horde legible without O(n²) pairs.
    let sx=0,sy=0;
    const bucket=g.grid?.get(`${Math.floor(e.x/96)},${Math.floor(e.y/96)}`);
    if(bucket&&bucket.length<35)for(const other of bucket){if(e===other||other.dead)continue;const dx=e.x-other.x,dy=e.y-other.y,l2=dx*dx+dy*dy,reach=(e.r+other.r)*.62;if(l2>0&&l2<reach*reach){const l=Math.sqrt(l2);sx+=dx/l*12;sy+=dy/l*12;}}
    if((e.nestGuardian||e.bossRole)&&(e.mode==='charge'||wasCharging))sx=sy=0;
    const oldX=e.x,oldY=e.y;moveActor(g,e,(d.x*speed+e.kx+sx)*dt,(d.y*speed+e.ky+sy)*dt,e.r*.7);e.walk=(e.walk||0)+Math.hypot(e.x-oldX,e.y-oldY);e.fx=d.x;e.fy=d.y;e.kx*=Math.exp(-8*dt);e.ky*=Math.exp(-8*dt);
    if(dist(e,p)<e.r+12)hurtPlayer(g,e.damage,e,wasCharging||e.mode==='charge'?'charge':'contact');
    // Recycle stragglers at a screen edge; no rewards or off-screen kills.
    if(distance>Math.max(g.view.width,g.view.height)*1.8&&!e.supplyGuard&&e.type!=='elite'&&e.type!=='king'){
      const a=random(g)*TAU;e.x=p.x+Math.cos(a)*Math.max(560,g.view.width*.65+80);e.y=p.y+Math.sin(a)*Math.max(420,g.view.height*.65+80);
    }
  }
}
function hurtPlayer(g,damage,origin,source=null) {
  const p=g.player;if(g.phase!=='playing'||p.invincible>0)return;let defenseCredited=false,journeyBlocked=0,journeyEnemy=origin?.ownerId?g.enemies.find(e=>e.id===origin.ownerId):origin?.id?origin:null;
  if(isJourney(g)&&g.hero==='bram'){const result=consumeJourneyGuard(g,damage,origin);damage=result.damage;journeyBlocked=result.blocked;journeyEnemy=result.enemy;}
  if(isFrontier(g)&&g.hero==='bram'){
    const m=g.mastery,front=origin?((origin.x-p.x)*p.fx+(origin.y-p.y)*p.fy)/(dist(origin,p)||1)>-.1:false;
    const braced=p.still>=.55||p.stillGrace>0,ready=g.time>=m.guardReadyAt;
    if(p.guard>0||(p.invincible<=0&&braced&&front&&ready)){
      const enemy=origin?.ownerId?g.enemies.find(e=>e.id===origin.ownerId):origin?.id?origin:null,prevented=p.guard>0?damage:damage*.7;
      const gain=bramAward(g,enemy,clamp(prevented,2,12),{boss:!!enemy?.bossRole,attackCycle:origin?.attackCycle??(enemy?.mode==='charge'?enemy.cycle:0)});defenseCredited=true;
      if(ready){m.guardReadyAt=g.time+(m.branch==='counter'?4.2:m.branch==='guard'?1.7:2.5);if(m.tier>=1)bramCounter(g);effect(g,'ring',p.x,p.y,85,'#badac0',.3);emit(g,'guard-block');}
      if(p.guard>0)return;damage*=.3;if(gain>0)p.stillGrace=.5;
    }
  }
  if(p.invincible>0)return;
  const incoming=damage<=0?0:Math.max(1,damage-g.stats.armor),shieldBefore=g.relics.shell.shield,absorbed=absorbRelicShield(g,incoming),value=incoming-absorbed;
  if(isFrontier(g)&&g.hero==='bram'&&!defenseCredited){const enemy=origin?.ownerId?g.enemies.find(e=>e.id===origin.ownerId):origin?.id?origin:null,prevented=Math.min(damage,g.stats.armor)+absorbed;if(prevented>0)bramAward(g,enemy,Math.min(12,prevented),{boss:!!enemy?.bossRole,attackCycle:origin?.attackCycle??(enemy?.mode==='charge'?enemy.cycle:0)});}
  if(isJourney(g)&&g.hero==='bram'&&journeyBlocked>0){growthBlock(g,journeyEnemy,journeyBlocked,origin?.attackCycle??(journeyEnemy?.mode==='charge'?journeyEnemy.cycle:0));emit(g,'guard-block');effect(g,'ring',p.x,p.y,42,'#bfd9ae',.18);}
  if(shieldBefore>0&&g.relics.shell.shield===0)resolveRelics(g,onRelicShieldBreak(g));
  if(absorbed>0){emit(g,'guard-block');effect(g,'relic',p.x,p.y-25,36,RELICS.shell.color,.25,{relicId:'shell'});p.invincible=.3;}
  if(value<=0){if(journeyBlocked>0)p.invincible=Math.max(p.invincible,.22);return;}
  p.hp-=value;g.metrics.damageTaken+=value;p.hurt=.35;p.invincible=.65;g.shake=4;
  source??=origin?.kind==='enemy'?'projectile':origin?.hostile?'field':'contact';
  if(origin?.pattern){g.metrics.patternDamage??={};g.metrics.patternDamage[origin.pattern]=(g.metrics.patternDamage[origin.pattern]||0)+value;}
  g.metrics.damageBySource??={contact:0,charge:0,projectile:0,field:0};g.metrics.damageBySource[source]+=value;
  if(origin){const d=direction(p.x-origin.x,p.y-origin.y);moveActor(g,p,d.x*9,d.y*9,12);}
  floating(g,p.x,p.y-45,`−${Math.ceil(value)}`,'#ff9f9b',true);effect(g,'pop',p.x,p.y-20,16,'#f1a096',.16);emit(g,'hurt');
  if(p.hp<=0){p.hp=0;g.outcome='defeat';g.phase='result';emit(g,'defeat');}
}
function updateProjectiles(g,dt) {
  for(const p of g.projectiles){
    p.age+=dt;p.life-=dt;if(p.life<=0&&p.kind!=='bottle')continue;
    if(p.kind==='bottle'){
      const t=clamp(p.age/(p.flight||.32),0,1);p.x=p.ox+(p.tx-p.ox)*t;p.y=p.oy+(p.ty-p.oy)*t;
      if(p.life<=0){if(g.fields.length>=LIMITS.fields)g.fields.shift();g.fields.push({x:p.tx,y:p.ty,r:p.fieldRadius,life:p.fieldLife,tick:0,damage:p.damage,evolved:p.evolved,context:p.context});effect(g,'splash',p.tx,p.ty,p.fieldRadius,'#81d6b5',.45);p.life=0;}
      continue;
    }
    if((p.kind==='moon'||p.returning)&&p.age>(p.returnAfter||.65)){
      if(!p.turned){p.turned=true;p.hits=[];if(p.returnSynergy)p.context={...p.context,synergy:p.returnSynergy};}
      const d=direction(g.player.x-p.x,g.player.y-p.y);p.vx=d.x*(p.flySpeed||540);p.vy=d.y*(p.flySpeed||540);
      if(dist(p,g.player)<18&&(p.returning||p.age>.9)){p.life=0;continue;}
    }
    if(p.kind==='bee'){
      // An evolved companion can sting twice; a finite second pass avoids idle homing at an already-hit boss.
      if(isJourney(g)&&p.evolved&&!p.union&&p.context?.source==='weapon'&&p.context.weapon==='bees'&&!p.restrike&&p.age>=1){p.restrike=true;p.hits=[];}
      if(p.union==='hive'&&p.age>(p.returnAfter||1.05)){
        if(!p.hiveReturning){p.hiveReturning=true;p.hits=[];}const d=direction(g.player.x-p.x,g.player.y-p.y);p.vx=d.x*p.flySpeed;p.vy=d.y*p.flySpeed;
        if(dist(p,g.player)<24+p.flySpeed*dt){areaHit(g,g.player.x,g.player.y,100*g.stats.area,p.damage*.35,80,p.context);effect(g,'ring',g.player.x,g.player.y,100*g.stats.area,'#e5d39b',.25);p.life=0;continue;}
      }else{
      let target=g.enemies.find(e=>e.id===p.target&&!e.dead);if(p.defender)target=nearest(g,g.player,240);if(!target)target=nearest(g,p,500);
      if(target){p.target=target.id;const d=direction(target.x-p.x,target.y-p.y);p.vx+=(d.x*(p.flySpeed||390)-p.vx)*Math.min(1,dt*6);p.vy+=(d.y*(p.flySpeed||390)-p.vy)*Math.min(1,dt*6);}
      }
    }
    const oldX=p.x,oldY=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.hostile){if(dist(p,g.player)<p.r+11){hurtPlayer(g,p.damage,p);p.life=0;}continue;}
    // Query the swept segment as well as its end, so fast bolts cannot tunnel.
    const dx=p.x-oldX,dy=p.y-oldY,l2=dx*dx+dy*dy;
    nearby(g,(oldX+p.x)/2,(oldY+p.y)/2,Math.hypot(dx,dy)/2+p.r,e=>{
      if(p.life<=0||p.hits.includes(e.id))return;
      const t=l2?clamp(((e.x-oldX)*dx+(e.y-oldY)*dy)/l2,0,1):0;
      if(Math.hypot(e.x-oldX-dx*t,e.y-oldY-dy*t)>e.r+p.r)return;
      p.hits.push(e.id);const crit=random(g)<.08;
      hit(g,e,p.damage*(crit?1.8:1),p.kind==='moon'?135:p.kind==='bee'?35:85,p,crit);
      if(p.evolved&&p.kind==='acorn'){areaHit(g,p.x,p.y,36*g.stats.area,p.damage*.3,12,p.context);effect(g,'pop',p.x,p.y,30,'#eab66c',.2);}
      if(p.union==='returning'){areaHit(g,e.x,e.y,42*g.stats.area,p.damage*.22,18,p.context);effect(g,'pop',e.x,e.y,28,'#edcc8c',.18);}
      if(p.pierce--<=0)p.life=0;
    });
  }
  g.projectiles=g.projectiles.filter(p=>p.life>0);
}
function updateFields(g,dt) {
  const frozen=new Set(g.enemies.filter(e=>e.freezeFrame&&!e.dead).map(e=>e.id));
  for(const f of g.fields){
    if(f.life<=0)continue;
    if(f.hostile&&f.warning>0&&frozen.has(f.ownerId))continue;
    f.life-=dt;f.tick-=dt;if(f.life<=0)continue;
    if(f.evolved&&!f.hostile){const d=direction(g.player.x-f.x,g.player.y-f.y);if(dist(f,g.player)>10){f.x+=d.x*30*dt;f.y+=d.y*30*dt;}}
    if(f.hostile){f.warning-=dt;if(f.warning<=0&&fieldContains(f,g.player))hurtPlayer(g,f.damage,f);}
    else if(f.tick<=0){f.tick=.32;nearby(g,f.x,f.y,f.r,e=>{if(f.damage>0)hit(g,e,f.damage,0,g.player,false,f.context??{source:'weapon'});if(f.slow)e.slow=Math.max(e.slow,f.slow);if(f.evolved||f.pull){const d=direction(f.x-e.x,f.y-e.y),pull=(f.pull||18)*(e.type==='king'?.1:e.type==='elite'?.35:1);e.kx+=d.x*pull;e.ky+=d.y*pull;}});}
  }
  g.fields=g.fields.filter(f=>f.life>0);
  for(const d of g.delayed)if(!d.done&&d.at<=g.time){d.done=true;areaHit(g,d.x,d.y,d.r,d.damage,d.knock,d.context??{source:'weapon'});effect(g,'ring',d.x,d.y,d.r,d.color,.45);}
  g.delayed=g.delayed.filter(d=>!d.done);
}
function gainXP(g,value,epoch=0) {
  g.metrics.xpCollected=(g.metrics.xpCollected||0)+value;let awarded=value*g.stats.growth;
  if(isFrontier(g)&&epoch){const c=g.campaign;awarded=Math.min(awarded,c.budgets[epoch]||0);if(c.budgets[epoch]!==undefined)c.budgets[epoch]-=awarded;if(epoch===c.epoch)c.xpBudget=c.budgets[epoch]||0;}
  g.metrics.xpGranted=(g.metrics.xpGranted||0)+awarded;g.xp+=awarded;
  while(g.xp>=xpCost(g.level)){g.xp-=xpCost(g.level);g.level++;g.pendingLevels++;if(g.metrics.firstLevelAt===null)g.metrics.firstLevelAt=g.time;}
}
export function healPlayer(g,amount,source='world',relicId=null){
  const actual=Math.max(0,Math.min(amount,g.player.maxHp-g.player.hp));g.player.hp+=actual;
  if(relicId&&Object.hasOwn(RELICS,relicId))g.relics.stats[relicId].healed+=actual;
  resolveRelics(g,onRelicHealing(g,actual,source));return actual;
}
function updateLoot(g,dt) {
  const p=g.player,magnet=g.stats.magnet;
  for(const gem of g.gems.values())gem.age=(gem.age??1)+dt;
  for(const [key,gem] of g.gems)if(dist(gem,p)<magnet){g.gems.delete(key);g.flying.push({...gem,speed:150});}
  for(const gem of g.flying){gem.age=(gem.age??1)+dt;const d=direction(p.x-gem.x,p.y-gem.y);gem.speed+=1300*dt;gem.x+=d.x*gem.speed*dt;gem.y+=d.y*gem.speed*dt;if(dist(gem,p)<18+gem.speed*dt){gem.collected=true;gainXP(g,gem.value,gem.epoch);emit(g,'xp');}}
  g.flying=g.flying.filter(gem=>!gem.collected);
  for(const item of g.pickups){
    if(item.type==='relic')continue;
    if(item.expiresAt!==undefined&&g.time>=item.expiresAt){item.collected=true;continue;}
    if(item.collected||dist(item,p)>(item.type==='coin'?magnet:28))continue;
    if(item.relicId==='seed'&&p.hp>=p.maxHp)continue;
    if(item.type==='chest'){
      if(g.pendingLevels>0||g.phase!=='playing')continue;
      item.collected=true;openChest(g,item);break;
    }
    item.collected=true;
    if(item.type==='coin'){g.gold+=2;emit(g,'coin');}
    if(item.type==='heal'){const actual=healPlayer(g,item.amount||25,item.relicId?'relic':'world',item.relicId);if(actual>0)floating(g,p.x,p.y-30,`+${Math.ceil(actual)}`,'#b6df98',true);emit(g,'heal');}
    if(item.type==='magnet'){for(const gem of g.gems.values())g.flying.push({...gem,speed:250});g.gems.clear();emit(g,'magnet');}
  }
  g.pickups=g.pickups.filter(item=>!item.collected);
  if(g.phase==='playing'){if(g.pendingLevels>0)offerLevel(g);else offerBranch(g);}
}
export function upgradeCandidates(g) {
  if(isJourney(g))return journeyUpgradeCandidates(g);
  const entries=[],ids=[...new Set([...Object.keys(g.weapons),...g.pool])];
  for(const id of ids){
    const w=g.weapons[id],data=WEAPONS[id];
    if(!data||data.union||g.consumed.includes(id)||g.banished.includes(id))continue;
    if(w&&w.rank<data.max&&!w.evolved)entries.push({id,kind:'weapon',owned:true});
    else if(!w&&g.pool.includes(id)&&Object.keys(g.weapons).length<(isFrontier(g)?4:SLOT_LIMIT))entries.push({id,kind:'weapon',owned:false});
  }
  for(const [id,data] of Object.entries(PASSIVES)){
    const rank=g.passives[id]||0;
    if(g.banished.includes(id)||rank>=data.max)continue;
    if(rank||Object.keys(g.passives).length<(isFrontier(g)?4:SLOT_LIMIT))entries.push({id,kind:'passive',owned:rank>0});
  }
  return entries;
}
export function draftChoices(g,excluded=[],advance=true) {
  if(isJourney(g))return draftJourneyChoices(g,excluded,advance);
  let pool=upgradeCandidates(g);const out=[];
  if(advance)g.drafts++;
  const add=choice=>{if(choice){out.push(choice);pool=pool.filter(c=>c.id!==choice.id);}};
  const eligible=list=>{const fresh=list.filter(c=>!excluded.includes(c.id));return fresh.length?fresh:list;};
  if(g.drafts<=2){
    const primary=pool.find(c=>c.kind==='weapon'&&c.owned&&c.id===g.startWeapon);add(primary);
    const fresh=eligible(pool.filter(c=>c.kind==='weapon'&&!c.owned)),partner=Object.values(UNIONS).find(r=>r.inputs.some(i=>i.id===g.startWeapon))?.inputs.find(i=>i.id!==g.startWeapon)?.id;if(fresh.length)add(fresh.find(c=>c.id===partner)||fromPool(g,fresh));
  }
  if(g.drafts>2&&g.drafts%3===0&&out.length<3){
    const partner=pool.find(c=>c.kind==='weapon'&&!c.owned&&!excluded.includes(c.id)&&Object.values(UNIONS).some(r=>!g.weapons[r.id]&&r.inputs.some(i=>i.id===c.id)&&r.inputs.some(i=>g.weapons[i.id])));if(partner)add(partner);
    const linked=pool.filter(c=>c.kind==='weapon'&&!c.owned&&!excluded.includes(c.id)&&Object.values(SYNERGIES).some(s=>g.relics.items.includes(s.relic)&&s.weapons.includes(c.id)&&!s.weapons.some(w=>g.weapons[w])));
    if(linked.length&&out.length<3)add(fromPool(g,linked));
  }
  if(isFrontier(g)&&!out.some(c=>c.kind==='weapon'&&c.owned)){
    const owned=pool.filter(c=>c.kind==='weapon'&&c.owned),recipe=Object.values(UNIONS).find(r=>r.inputs.some(i=>i.id===g.startWeapon));
    const partner=owned.find(c=>recipe?.inputs.some(i=>i.id===c.id)&&c.id!==g.startWeapon);
    const preferred=g.campaign.cleared>0?partner:owned.find(c=>c.id===g.startWeapon);
    add(preferred||fromPool(g,owned));
  }
  if(g.upgradeMisses>=2&&out.length<3&&!out.some(c=>c.kind==='weapon'&&c.owned)){const owned=eligible(pool.filter(c=>c.kind==='weapon'&&c.owned));if(owned.length)add(fromPool(g,owned));}
  while(out.length<3&&pool.length){
    const candidates=eligible(pool),owned=candidates.filter(c=>c.kind==='weapon'&&c.owned),fresh=candidates.filter(c=>c.kind==='weapon'&&!c.owned),passive=candidates.filter(c=>c.kind==='passive');
    const bags=[...[owned,owned,owned],...[fresh,fresh],...[passive,passive,passive]].filter(b=>b.length);
    add(fromPool(g,fromPool(g,bags)));
  }
  if(advance)g.upgradeMisses=out.some(c=>c.kind==='weapon'&&c.owned)?0:g.upgradeMisses+1;
  return out;
}
function offerLevel(g){
  if(isJourney(g)&&g.level-g.pendingLevels+1>=10&&g.level>=10&&!g.campaign.styleChosen&&styleChoices(g).length){g.choiceMode='style';g.choices=styleChoices(g);g.phase='choice';emit(g,'level');return;}
  g.choices=draftChoices(g);
  if(!g.choices.length){g.gold+=g.pendingLevels*2;if(g.campaign&&!isFrontier(g)&&!isJourney(g))g.campaign.boosts.overflow+=g.pendingLevels;g.pendingLevels=0;g.phase='playing';if(!g.mastered){g.mastered=true;emit(g,'mastery');}return;}
  g.phase='choice';emit(g,'level');
}
function recordRank(g,id){g.maxRanks[id]=Math.max(g.maxRanks[id]||0,g.weapons[id].rank);if(!g.discovered.includes(id))g.discovered.push(id);}
export function applyChoice(g,index) {
  if(g.phase!=='choice'||!Number.isInteger(index)||!g.choices[index])return false;
  const choice=g.choices[index],{id,kind}=choice;
  if(isJourney(g)&&kind==='style'){if(!styleChoices(g).some(c=>c.id===id)||g.choiceMode!=='style')return false;g.mastery.branch=id;g.campaign.styleChosen=true;growthTick(g,0);g.stats=deriveStats(g);g.pendingLevels=Math.max(0,g.pendingLevels-1);g.choices=[];delete g.choiceMode;g.phase='playing';if(g.pendingLevels>0)offerLevel(g);emit(g,'upgrade');return true;}
  if(isFrontier(g)&&['mastery','branch'].includes(kind)){const legal=branchChoices(g).find(c=>c.id===id&&c.kind===kind);if(!legal)return false;selectBranch(g,legal);g.choices=[];g.phase='playing';delete g.choiceMode;offerBranch(g);return true;}
  if(!upgradeCandidates(g).some(c=>c.id===id&&c.kind===kind))return false;
  if(kind==='weapon'){
    if(g.weapons[id]){g.weapons[id].rank++;g.weapons[id].clock=0;}
    else g.weapons[id]={rank:1,evolved:false,clock:0};
    recordRank(g,id);
  }else if(kind==='passive')g.passives[id]=(g.passives[id]||0)+1;else if(kind==='boon'){if(id==='heal')healPlayer(g,g.player.maxHp*.25);else if(id==='power')g.boon={until:g.time+8};else g.metrics.bonusScore=(g.metrics.bonusScore||0)+25;}
  if(isJourney(g))growthTick(g,0);g.stats=deriveStats(g);g.pendingLevels=Math.max(0,g.pendingLevels-1);g.choices=[];
  if(g.pendingLevels>0)offerLevel(g);else{g.phase='playing';offerBranch(g);}
  emit(g,'upgrade',{id});return true;
}
export function reroll(g){
  if(g.phase!=='choice'||g.choiceMode||g.rerolls<=0)return false;
  const previous=g.choices.map(c=>c.id);if(!upgradeCandidates(g).some(c=>!previous.includes(c.id)))return false;
  g.rerolls--;g.choices=draftChoices(g,previous,false);emit(g,'reroll');return true;
}
// Kept as inert compatibility exports. The approved initial game only uses reroll.
export function banish(){return false;}
export function skipChoice(){return false;}
export function evolutionCandidates(g){return Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&g.weapons[id].rank===WEAPONS[id].max&&(g.passives[WEAPONS[id].recipe]||0)>0);}
export function unionCandidates(g){if(isJourney(g))return Object.values(UNIONS).filter(r=>!g.weapons[r.id]&&r.inputs.every(i=>g.weapons[i.id]?.rank===8)&&r.inputs.some(i=>g.weapons[i.id]?.evolved));if(isFrontier(g))return Object.values(UNIONS).filter(r=>!g.weapons[r.id]&&r.inputs.every(i=>g.weapons[i.id]?.rank===8)&&r.inputs.some(i=>g.weapons[i.id]?.evolved)&&r.inputs.every(i=>!WEAPON_BRANCHES[i.id]||g.weapons[i.id].branch));return Object.values(UNIONS).filter(recipe=>!g.weapons[recipe.id]&&!g.consumed.includes(recipe.id)&&recipe.inputs.every(input=>{const w=g.weapons[input.id];return w&&w.rank>=input.rank&&(!input.evolved||w.evolved);}));}
export function chestCandidates(g,source=g.chest?.source){
  if(isJourney(g))return source==='journey'?journeyForgeCandidates(g):[];
  if(isFrontier(g)){if(source!=='forge')return [];return frontierForgeCandidates(g);}
  const normal=[...unionCandidates(g).map(r=>({id:`union:${r.id}`,weapon:r.id,kind:'union',name:r.name,description:r.description,consumes:r.inputs.map(i=>i.id),catalyst:null})),
    ...evolutionCandidates(g).map(id=>({id:`evolve:${id}`,weapon:id,kind:'evolution',name:WEAPONS[id].evo,description:WEAPONS[id].evoText,consumes:[id],catalyst:WEAPONS[id].recipe}))];
  if(['midpoint','armory'].includes(source))for(const id of Object.keys(g.weapons).sort((a,b)=>Number(b===g.startWeapon)-Number(a===g.startWeapon))){
    if(BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&!normal.some(o=>o.weapon===id))normal.push({id:`awaken:${id}`,weapon:id,kind:'awakening',name:`각성 · ${WEAPONS[id].evo}`,description:`${WEAPONS[id].name}을 8단계로 완성하고 진화합니다. 보스의 각성 재료를 사용해 보조 칸을 소비하지 않습니다.`,consumes:[id],catalyst:null});
  }
  return normal;
}
export function openChest(g,drop={canEvolve:true}) {
  if(isJourney(g))return openJourneyDrop(g,drop);
  if(g.phase!=='playing')return false;
  const gold=35+Math.floor(random(g)*35),rewards=[];
  const forged=drop.forgeWeapon&&g.weapons[drop.forgeWeapon]&&!g.weapons[drop.forgeWeapon].evolved&&g.weapons[drop.forgeWeapon].rank<WEAPONS[drop.forgeWeapon].max?drop.forgeWeapon:null;
  if(forged){const before=g.weapons[forged].rank;g.weapons[forged].rank=Math.min(WEAPONS[forged].max,before+2);g.weapons[forged].clock=0;recordRank(g,forged);rewards.push({id:forged,evolved:false,amount:g.weapons[forged].rank-before});}
  const options=drop.canEvolve===true?chestCandidates(g,drop.source):[];
  if(!options.length){
    const available=Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&g.weapons[id].rank<WEAPONS[id].max);
    const amount=forged?0:random(g)<.2?3:1;
    for(let i=0;i<amount&&available.length;i++){const id=available.splice(Math.floor(random(g)*available.length),1)[0];g.weapons[id].rank++;g.weapons[id].clock=0;recordRank(g,id);rewards.push({id,evolved:false});}
  }
  if(['midpoint','armory'].includes(drop.source))healPlayer(g,drop.source==='midpoint'?25:20);
  g.gold+=gold;g.metrics.chests++;g.chest={gold,rewards,options,canEvolve:drop.canEvolve===true,source:drop.source||'elite'};g.phase='chest';emit(g,'chest');return true;
}
export function selectChest(g,id){
  if(isJourney(g))return transformJourneyWeapon(g,id);
  if(g.phase!=='chest'||!g.chest?.canEvolve||!g.chest.options.some(o=>o.id===id))return false;
  const option=chestCandidates(g).find(o=>o.id===id);if(!option)return false;
  if(isFrontier(g)&&option.kind==='evolution'){if(g.campaign.seals<1)return false;g.campaign.seals--;}
  const inherited=option.core?g.weapons[option.core].branch:null;
  if(option.kind==='union'){
    for(const consumed of option.consumes){delete g.weapons[consumed];if(!g.consumed.includes(consumed))g.consumed.push(consumed);}
    g.weapons[option.weapon]={rank:1,evolved:true,clock:0,...(inherited?{branch:inherited,core:option.core}:{})};g.unions.push(option.weapon);g.discovered.push(option.weapon);
    if(g.metrics.firstUnionAt===null)g.metrics.firstUnionAt=g.time;
  }else{
    if(option.kind==='awakening'){g.weapons[option.weapon].rank=WEAPONS[option.weapon].max;recordRank(g,option.weapon);}
    g.weapons[option.weapon].evolved=true;g.weapons[option.weapon].clock=0;
    if(!g.evolutions.includes(option.weapon))g.evolutions.push(option.weapon);
    if(g.metrics.firstEvolutionAt===null)g.metrics.firstEvolutionAt=g.time;
  }
  g.chest.rewards=[{id:option.weapon,evolved:true,union:option.kind==='union',consumed:[...option.consumes]}];g.chest.options=[];g.chest.optionalUnion=false;g.shake=6;
  if(option.kind==='union'&&!isFrontier(g)){buildGrid(g);cast(g,option.weapon);g.weapons[option.weapon].clock=weaponStats(g,option.weapon).cooldown;}
  else if(g.chest.source==='armory'){g.chest.options=chestCandidates(g).filter(o=>o.kind==='union');g.chest.optionalUnion=g.chest.options.length>0;}
  if(isFrontier(g)&&g.chest.source==='forge'){g.chest.options=frontierForgeCandidates(g);g.chest.optionalUnion=true;}
  emit(g,option.kind==='union'?'union':'evolution',{id:option.weapon});return true;
}
export function closeChest(g){if(isJourney(g)){if(g.phase!=='chest'||g.chest?.source!=='journey'||g.campaign.rewardPending)return false;const phase=g.chest.returnPhase;g.chest=null;g.phase=phase;g.player.invincible=Math.max(g.player.invincible,1);return true;}if(g.chest?.source==='forge'){if(g.phase!=='chest')return false;g.phase=g.chest.returnPhase;g.chest=null;return true;}if(g.phase!=='chest'||g.chest?.options.length&&!g.chest.optionalUnion)return false;if(g.campaign&&g.chest?.source==='midpoint')g.campaign.midpointClaimed=true;if(g.campaign&&g.chest?.source==='armory')g.campaign.armoryClaimed=true;g.chest=null;g.phase='playing';g.player.invincible=Math.max(g.player.invincible,1);return true;}
export function continueCampaign(g,reward){if(!advanceCampaign(g,reward))return false;healPlayer(g,g.player.maxHp*.25);g.stats=deriveStats(g);return true;}
export function pauseGame(g,reason='manual'){if(g.phase!=='playing')return false;g.phase='paused';g.pauseReason=reason;return true;}
export function resumeGame(g){if(g.phase!=='paused')return false;g.phase='playing';return true;}
export function retreat(g){if(g.phase!=='paused')return false;g.outcome='retreat';g.phase='result';return true;}

export function stepGame(g,dt,input={}) {
  if(g.phase!=='playing'||isJourney(g)&&g.campaign.transitionPending)return;
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=clamp(dt,0,.04);g.hitEvent=false;
  g.feedback??={nextImpactAt:0,killWindowAt:0,killCount:0,nextCrowdAt:0};
  g.relics??=createRelics();
  g.synergies??=createSynergies();
  const worldDt=Math.max(0,dt-Math.min(dt,g.hitstop));g.hitstop=Math.max(0,g.hitstop-dt);
  g.time=g.campaign?g.time+worldDt:Math.min(RUN_SECONDS,g.time+worldDt);
  if(!g.campaign&&g.time>=RUN_SECONDS){g.phase='result';g.outcome='victory';emit(g,'victory');return;}
  const p=g.player;
  p.hurt=Math.max(0,p.hurt-dt);p.invincible=Math.max(0,p.invincible-dt);p.guard=Math.max(0,p.guard-dt);p.attack=Math.max(0,p.attack-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  p.signature=Math.max(0,(p.signature||0)-dt);
  p.attackWindup=Math.max(0,(p.attackWindup||0)-dt);
  if(isJourney(g)){if(growthTick(g,worldDt)){emit(g,'mastery');floating(g,p.x,p.y-60,'특성 강화',HEROES[g.hero].color,true);}if(g.hero==='bram'&&g.level>=18&&g.mastery.branch==='guard'&&(p.still>=.55||p.stillGrace>0))nearby(g,p.x,p.y,145,e=>{e.slow=.35;});}else if(isFrontier(g))chargeSignature(g,worldDt*.5);else p.charge=clamp(p.charge+dt*.8,0,100);
  if(isFrontier(g)){tickMastery(g);if(unlockMastery(g)){emit(g,'mastery');floating(g,p.x,p.y-60,`숙련 ${g.mastery.tier}`,HEROES[g.hero].color,true);}if(g.hero==='bram'&&g.mastery.tier===3&&g.mastery.branch==='guard'&&p.still>=.55)nearby(g,p.x,p.y,145,e=>{e.slow=.25;});}g.shake=Math.max(0,g.shake-dt*16);
  let x=Number.isFinite(input.x)?clamp(input.x,-1,1):0,y=Number.isFinite(input.y)?clamp(input.y,-1,1):0;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  p.moving=length>.05;if(p.moving){p.fx=x/(Math.hypot(x,y)||1);p.fy=y/(Math.hypot(x,y)||1);if(p.attack<=0)p.aim=Math.atan2(p.fy,p.fx);}
  p.wind=clamp(p.wind+(p.moving?dt:-dt*3),0,3);
  if(p.moving){p.still=0;p.stillGrace=Math.max(0,p.stillGrace-dt);}else{p.still+=dt;if(p.still>=.6)p.stillGrace=(isFrontier(g)||isJourney(g))&&g.hero==='bram'?(isJourney(g)?1.2:1.4):.35;}
  if(g.decoy){g.decoy.life-=dt;if(g.decoy.life<=0)g.decoy=null;}
  g.stats=deriveStats(g);
  if(input.skill)useSignature(g);if(input.dash)dash(g);
  const oldX=p.x,oldY=p.y;
  if(p.dash>0){moveActor(g,p,p.fx*750*dt,p.fy*750*dt,15);p.dash-=dt;}else{moveActor(g,p,x*g.stats.speed*dt,y*g.stats.speed*dt,15);}
  const moved=Math.hypot(p.x-oldX,p.y-oldY);p.walk+=moved;p.moving=moved>.01;
  if(g.terrain&&length>.05&&moved<g.stats.speed*dt*Math.min(1,length)*.2)g.metrics.blockedSeconds=(g.metrics.blockedSeconds||0)+dt;
  if(g.stats.regen>0)healPlayer(g,g.stats.regen*dt);
  resolveRelics(g,tickRelics(g,moved));
  if(worldDt>0){updateDirector(g,worldDt);buildGrid(g);updateWeapons(g,worldDt);updateEnemies(g,worldDt);buildGrid(g);updateProjectiles(g,worldDt);updateFields(g,worldDt);}
  g.enemies=g.enemies.filter(e=>!e.dead);
  if(g.phase==='playing')updateLoot(g,dt);
  for(const fx of g.effects)fx.life-=dt;g.effects=g.effects.filter(fx=>fx.life>0);
  for(const text of g.texts){text.life-=dt;text.y-=dt*24;}g.texts=g.texts.filter(text=>text.life>0);
  if(g.events.length>120)g.events=g.events.slice(-120);
}
export function packRun(g) {
  const {grid,events,stats,hitEvent,...data}=g;
  return JSON.stringify({...data,gems:[...g.gems.entries()],phase:g.phase==='playing'?'paused':g.phase,pauseReason:'restored',events:[]});
}
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const finite=(value,min=-1e8,max=1e8)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const integer=(value,min=0,max=1e8)=>Number.isInteger(value)&&finite(value,min,max);
const vector=value=>plain(value)&&finite(value.x)&&finite(value.y);
const uniqueKnown=(values,known,max)=>Array.isArray(values)&&values.length<=max&&new Set(values).size===values.length&&values.every(id=>typeof id==='string'&&known.includes(id));
const timers=(object,keys)=>keys.every(key=>finite(object[key],-10,1e6));
const validContext=c=>c===undefined||(plain(c)&&['weapon','signature','relic','mastery'].includes(c.source)&&(c.weapon===undefined||Object.hasOwn(WEAPONS,c.weapon))&&(c.source!=='relic'||Object.hasOwn(RELICS,c.relic))&&(c.synergy===undefined||(c.source==='relic'&&Object.hasOwn(SYNERGIES,c.synergy)&&SYNERGIES[c.synergy].relic===c.relic)));
function validTree(value,depth=0,budget={n:0}){
  if(depth>16||++budget.n>250000)return false;
  if(value===null||typeof value==='boolean'||typeof value==='string')return typeof value!=='string'||value.length<500;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.every(v=>validTree(v,depth+1,budget));
  if(plain(value))return Object.keys(value).every(k=>!['__proto__','prototype','constructor'].includes(k)&&validTree(value[k],depth+1,budget));
  return false;
}
export function unpackRun(text) {
  try{
    if(typeof text!=='string'||text.length>4e6)return null;
    const g=JSON.parse(text),weaponIds=Object.keys(WEAPONS),passiveIds=Object.keys(PASSIVES);
    if(!plain(g)||!validTree(g)||g.version!==2||!Object.hasOwn(HEROES,g.hero)||g.outcome!==null||g.banked!==false||!['paused','choice','chest','relic','crossroads','cache'].includes(g.phase))return null;
    g.relics??=createRelics();if(!validRelics(g.relics))return null;
    g.synergies??=createSynergies();if(!validSynergies(g.synergies))return null;
    if(!finite(g.time,0,g.campaign?1e9:RUN_SECONDS-.00001)||!integer(g.seed,0,4294967295)||!integer(g.id)||!integer(g.level,1,9999)||!finite(g.xp,0,1e8)||!integer(g.pendingLevels,0,1000))return null;
    if(!integer(g.relics.thread.target,0,g.id))return null;
    g.initialSeed??=g.expedition?.seed??g.seed;if(!integer(g.initialSeed,0,4294967295))return null;
    if(g.runId!==undefined&&(typeof g.runId!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(g.runId)))return null;
    g.runId??=`legacy-${g.hero}-${g.seed}-${g.id}`;
    if(!['hard','finalSpawned','mastered'].every(k=>typeof g[k]==='boolean'))return null;
    for(const key of ['kills','elites','kingKills','gold','peakEnemies','rerolls','banishes','skips','drafts','upgradeMisses'])if(!integer(g[key],0,1e8))return null;
    if(!finite(g.damage,0,1e12)||!timers(g,['spawn','nextSurge','nextElite','wave','shake','hitstop']))return null;
    const p=g.player;
    if(!vector(p)||!finite(p.fx,-1,1)||!finite(p.fy,-1,1)||!finite(p.hp,.0001,g.campaign?1e8:1000)||!finite(p.maxHp,1,g.campaign?1e8:1000)||p.hp>p.maxHp||typeof p.moving!=='boolean'||!finite(p.charge,0,100)||!timers(p,['hurt','invincible','walk','wind','still','stillGrace','dash','dashCooldown','attack','guard']))return null;
    if(!plain(g.view)||!finite(g.view.width,200,5000)||!finite(g.view.height,200,5000))return null;
    if(!plain(g.boosts)||Object.entries(UPGRADES).some(([id,u])=>!integer(g.boosts[id],0,u.max)))return null;
    if(!plain(g.weapons)||!Object.keys(g.weapons).length||Object.keys(g.weapons).length>SLOT_LIMIT||!plain(g.passives)||Object.keys(g.passives).length>SLOT_LIMIT)return null;
    for(const [id,w] of Object.entries(g.weapons))if(!weaponIds.includes(id)||!plain(w)||!integer(w.rank,1,WEAPONS[id].max)||typeof w.evolved!=='boolean'||!finite(w.clock,-1,20)||(w.evolved&& !WEAPONS[id].union&&w.rank!==WEAPONS[id].max)||(WEAPONS[id].union&&!w.evolved))return null;
    for(const [id,w] of Object.entries(g.weapons))if(w.branch!==undefined&&!(WEAPON_BRANCHES[id]||WEAPON_BRANCHES[id==='returning'?'acorn':'briar']||[]).some(b=>b[0]===w.branch))return null;
    for(const [id,rank] of Object.entries(g.passives))if(!passiveIds.includes(id)||!integer(rank,1,PASSIVES[id].max))return null;
    if(!uniqueKnown(g.pool,BASE_WEAPON_IDS,8)||!uniqueKnown(g.consumed,BASE_WEAPON_IDS,8)||!uniqueKnown(g.discovered,weaponIds,10)||!uniqueKnown(g.evolutions,BASE_WEAPON_IDS,8)||!uniqueKnown(g.unions,Object.keys(UNIONS),2)||!uniqueKnown(g.banished,[...BASE_WEAPON_IDS,...passiveIds],16))return null;
    if(g.consumed.some(id=>Object.hasOwn(g.weapons,id)))return null;
    if(!plain(g.maxRanks)||Object.entries(g.maxRanks).some(([id,rank])=>!BASE_WEAPON_IDS.includes(id)||!integer(rank,1,8)))return null;
    for(const key of ['enemies','projectiles','fields','effects','texts','pickups','flying','delayed','choices'])if(!Array.isArray(g[key]))return null;
    if(g.enemies.length>LIMITS.enemies+1||g.projectiles.length>LIMITS.projectiles||g.fields.length>LIMITS.fields+14||g.effects.length>LIMITS.effects||g.texts.length>LIMITS.texts||g.pickups.length>LIMITS.pickups||g.flying.length>25000||g.delayed.length>100||g.choices.length>3)return null;
    const enemyIds=new Set();
    for(const e of g.enemies){
      if(!vector(e)||!Object.hasOwn(ENEMIES,e.type)||!integer(e.id,1,g.id)||enemyIds.has(e.id)||!finite(e.hp,.0001,1e7)||!finite(e.maxHp,1,1e7)||e.hp>e.maxHp||!finite(e.r,1,100)||!finite(e.speed,0,1000)||!finite(e.damage,0,1000)||!finite(e.xp,0,1000)||!['walk','windup','charge','recover'].includes(e.mode)||typeof e.dead!=='boolean'||e.dead||typeof e.canEvolve!=='boolean'||!timers(e,['hurt','slow','age'])||!finite(e.clock,-RUN_SECONDS,1e6)||!finite(e.kx,-1e5,1e5)||!finite(e.ky,-1e5,1e5))return null;
      if(e.mode==='windup'&&!finite(e.windup,0,2))return null;
      if(e.mode==='recover'&&!finite(e.recover,0,2))return null;
      if(e.mode==='charge'&&(!finite(e.charge,0,2)||!finite(e.dx,-1,1)||!finite(e.dy,-1,1)))return null;
      if(e.attack!==undefined&&!['brace','lob','fan','spores','charge','volley','crown','roots'].includes(e.attack))return null;
      if(e.attack!==undefined&&['windup','charge'].includes(e.mode)&&(!finite(e.dx,-1,1)||!finite(e.dy,-1,1)))return null;
      if((e.nestGuardian||e.bossRole)&&e.attack!==undefined&&['windup','charge'].includes(e.mode)&&(![1,2].includes(e.patternPower)||!finite(e.patternAngle,-Math.PI,Math.PI)))return null;
      if(e.bossRole!==undefined&&(!['midpoint','final'].includes(e.bossRole)||e.type!=='king'||!g.campaign))return null;
      if(e.masteryAwarded!==undefined&&!finite(e.masteryAwarded,0,12))return null;
      if(e.guardianStyle!==undefined&&!Object.hasOwn(GUARDIANS,e.guardianStyle))return null;
      if(e.bossPhase!==undefined&&![1,2].includes(e.bossPhase))return null;
      if(e.patternPower!==undefined&&![1,2].includes(e.patternPower))return null;
      if(e.patternAngle!==undefined&&!finite(e.patternAngle,-Math.PI,Math.PI))return null;
      if(e.shotPattern!==undefined&&!['fan','lob'].includes(e.shotPattern))return null;
      if(e.cycle!==undefined&&!integer(e.cycle,0,10000))return null;
      enemyIds.add(e.id);
    }
    if(g.campaign!==undefined&&!validCampaign(g.campaign,g))return null;
    if(g.phase==='crossroads'&&(isJourney(g)||!g.campaign||(isFrontier(g)?g.campaign.cleared!==g.campaign.depth:g.campaign.final.state!=='defeated')))return null;
    if(isJourney(g)){if(!validHeroGrowth(g.mastery,g)||Object.keys(g.weapons).length>4||Object.keys(g.passives).length>4||g.phase==='crossroads')return null;for(const [id,w] of Object.entries(g.weapons))if(WEAPONS[id].union&&(!UNIONS[id].inputs.some(i=>i.id===w.core)||!g.evolutions.includes(w.core)))return null;
      if(!g.expedition||!Array.isArray(g.expedition.sites)||g.expedition.sites.length>9||g.expedition.sites.some(s=>!vector(s)||!['ready','guarded','active','cleared','spent','abandoned','locked'].includes(s.state)||s.kind==='armory'&&!uniqueKnown(s.deck,BASE_WEAPON_IDS,8)))return null;
      const expectedSites=g.campaign.regionIndex===2?['gate']:['camp','gate','exit','supply','armory-b','spring','nest','trial'];if(g.expedition.sites.length!==expectedSites.length||new Set(g.expedition.sites.map(s=>s.id)).size!==expectedSites.length||g.expedition.sites.some(s=>!expectedSites.includes(s.id)||(s.id==='supply'||s.id==='armory-b')&&(s.kind!=='armory'||JSON.stringify(s.deck)!==JSON.stringify(cacheDeck(g.initialSeed,`${g.campaign.regionIndex}:${s.id==='supply'?0:1}`)))))return null;
      if(g.boon&&(!finite(g.boon.until,0,g.time+8.01)))return null;
      if(g.phase==='cache'){const site=g.expedition.sites.find(s=>s.id===g.cacheOffer?.siteId);if(!site||site.kind!=='armory'||site.state!=='ready'||!Array.isArray(g.cacheOffer.options))return null;const choices=cacheWeaponChoices(g,site),expected=choices.length?choices:journeyUpgradeCandidates(g).slice(0,3);if(JSON.stringify(g.cacheOffer.options)!==JSON.stringify(expected))return null;}else if(g.cacheOffer)return null;
    }else if(g.phase==='cache')return null;
    if(isFrontier(g)){if(!validMastery(g.mastery,g)||Object.keys(g.weapons).length>4||Object.keys(g.passives).length>4)return null;
      for(const [id,w] of Object.entries(g.weapons)){if(WEAPON_BRANCHES[id]&&w.rank>=4&&!w.branch&&!['choice','chest'].includes(g.phase))return null;if(WEAPONS[id].union&&(!UNIONS[id].inputs.some(i=>i.id===w.core)||!g.evolutions.includes(w.core)||!WEAPON_BRANCHES[w.core]?.some(b=>b[0]===w.branch)))return null;}
    }
    for(const shot of g.projectiles){
      if(!validContext(shot.context))return null;
      if(shot.union!==undefined&&(!['returning','hive'].includes(shot.union)||shot.kind!==(shot.union==='hive'?'bee':'moon')||shot.context?.weapon!==shot.union))return null;
      if(shot.hiveReturning!==undefined&&(shot.union!=='hive'||typeof shot.hiveReturning!=='boolean'))return null;
      if(shot.returnSynergy!==undefined&&(shot.returnSynergy!=='gale'||shot.kind!=='wind'||shot.returning!==true))return null;
      if(!vector(shot)||!['acorn','moon','bee','enemy','seed','bottle','wind'].includes(shot.kind)||!finite(shot.vx,-5000,5000)||!finite(shot.vy,-5000,5000)||!finite(shot.damage,0,1e7)||!finite(shot.life,0,100)||!finite(shot.age,0,100)||!finite(shot.r,0,200)||!integer(shot.pierce,-1,1000)||!Array.isArray(shot.hits)||shot.hits.length>1000||shot.hits.some(id=>!integer(id,1,g.id)))return null;
      if(shot.kind==='bottle'&&(!['tx','ty','ox','oy','fieldRadius','fieldLife'].every(k=>finite(shot[k]))))return null;
    }
    for(const f of g.fields){
      if(!validContext(f.context)||!vector(f)||!finite(f.r,1,1000)||!finite(f.life,0,100)||!finite(f.tick,-1,100)||!finite(f.damage,0,1e7)||(f.hostile&&!finite(f.warning,-10,10)))return null;
      if(f.shape!==undefined&&(f.shape!=='cone'||!finite(f.angle,-Math.PI,Math.PI)||!finite(f.spread,.1,Math.PI)))return null;
      if(f.slow!==undefined&&!finite(f.slow,0,5))return null;
      if(f.pull!==undefined&&!finite(f.pull,0,150))return null;
      if(f.ownerId!==undefined&&!integer(f.ownerId,1,g.id))return null;
    }
    for(const item of g.pickups){
      if(!vector(item)||!integer(item.id,1,g.id)||!['chest','coin','heal','magnet','relic'].includes(item.type)||(item.type==='chest'&&typeof item.canEvolve!=='boolean'))return null;
      if(item.type==='relic'&&(!Array.isArray(item.deck)||item.deck.length!==6||new Set(item.deck).size!==6||item.deck.some(id=>!Object.hasOwn(RELICS,id))||!RELIC_SOURCES.includes(item.source)))return null;
      if(item.relicId!==undefined&&(item.type!=='heal'||item.relicId!=='seed'||![8,12].includes(item.amount)||!finite(item.expiresAt,0,g.campaign?1e9+16:RUN_SECONDS+16)))return null;
    }
    if(g.phase==='relic'){
      const offer=g.relicOffer,cache=g.pickups.find(p=>p.type==='relic'&&p.id===offer?.cacheId);if(!cache||offer.source!==cache.source||!Array.isArray(offer.options)||offer.options.length!==2||new Set(offer.options).size!==2||offer.options.some(id=>!Object.hasOwn(RELICS,id)||g.relics.items.includes(id))||(offer.selected!==null&&!offer.options.includes(offer.selected)))return null;
      const expected=cache.deck.filter(id=>!g.relics.items.includes(id)).slice(0,2);if(offer.options.some((id,i)=>id!==expected[i]))return null;
    }else if(g.relicOffer!==undefined&&g.relicOffer!==null)return null;
    const gemValid=gem=>vector(gem)&&finite(gem.value,.0001,1e8);
    if(!Array.isArray(g.gems)||g.gems.length>25000)return null;
    const gemKeys=new Set();for(const entry of g.gems){if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||entry[0].length>50||gemKeys.has(entry[0])||!gemValid(entry[1]))return null;gemKeys.add(entry[0]);}
    for(const gem of g.flying)if(!gemValid(gem)||!finite(gem.speed,0,1e6))return null;
    for(const fx of g.effects)if(!vector(fx)||!['death','ring','pop','slash','bolt','dash','muzzle','splash','impact','relic'].includes(fx.type)||!finite(fx.r,0,2000)||!finite(fx.life,0,10)||!finite(fx.maxLife,0,10)||typeof fx.color!=='string')return null;
    for(const t of g.texts)if(!vector(t)||!finite(t.life,0,5)||!['string','number'].includes(typeof t.value)||typeof t.color!=='string')return null;
    for(const d of g.delayed)if(!validContext(d.context)||!vector(d)||!finite(d.at,0,g.campaign?1e9+10:RUN_SECONDS+10)||!finite(d.r,0,2000)||!finite(d.damage,0,1e7)||!finite(d.knock,0,1000))return null;
    if(g.decoy!==null&&(!vector(g.decoy)||!finite(g.decoy.life,0,3)))return null;
    if(!plain(g.metrics)||!integer(g.metrics.chests)||!integer(g.metrics.signatures)||!finite(g.metrics.damageTaken,0,1e9)||['firstLevelAt','firstEvolutionAt','firstUnionAt'].some(k=>g.metrics[k]!==null&&!finite(g.metrics[k],0,g.time)))return null;
    if(g.metrics.weapons!==undefined&&(!plain(g.metrics.weapons)||Object.entries(g.metrics.weapons).some(([id,stages])=>!weaponIds.includes(id)||!plain(stages)||Object.keys(stages).some(k=>!['opening','build','final'].includes(k))||['opening','build','final'].some(stage=>!plain(stages[stage])||['damage','hits','casts'].some(k=>!finite(stages[stage][k],0,1e12))))))return null;
    if(g.phase==='choice'){
      if((!g.choiceMode&&g.pendingLevels<1)||!g.choices.length||new Set(g.choices.map(c=>c.id)).size!==g.choices.length)return null;
      if(g.choiceMode&&!['mastery','branch','style'].includes(g.choiceMode))return null;
      const valid=g.choiceMode==='style'&&isJourney(g)?styleChoices(g):g.choiceMode?branchChoices(g):upgradeCandidates(g);if(g.choices.some(c=>!plain(c)||!valid.some(v=>v.id===c.id&&v.kind===c.kind)))return null;
    if(g.choiceMode)g.choices=valid.filter(v=>g.choices.some(c=>c.id===v.id));
    }else if(g.choices.length||g.choiceMode)return null;
    if(g.phase==='chest'){
      if(isJourney(g)&&(g.chest?.source!=='journey'||!['playing','paused'].includes(g.chest.returnPhase)||typeof g.chest.bossLoot!=='boolean'))return null;
      if(!plain(g.chest)||!integer(g.chest.gold,0,10000)||!Array.isArray(g.chest.options)||!Array.isArray(g.chest.rewards)||typeof g.chest.canEvolve!=='boolean')return null;
      if(g.chest.source==='forge'&&(!isFrontier(g)||!['playing','paused','crossroads'].includes(g.chest.returnPhase)))return null;
      if(!isJourney(g)&&g.chest.source!=='forge'&&g.chest.optionalUnion!==undefined&&(typeof g.chest.optionalUnion!=='boolean'||g.chest.optionalUnion&&(g.chest.source!=='armory'||!g.chest.options.length||g.chest.options.some(o=>o.kind!=='union'))))return null;
      const options=chestCandidates(g),available=new Set(options.map(o=>o.id));
      if(!isJourney(g)&&g.chest.optionalUnion&&g.chest.options.some(saved=>!options.some(o=>o.id===saved.id&&o.kind==='union')))return null;
      if(g.chest.options.length>10||g.chest.options.some(o=>!plain(o)||!available.has(o.id))||(g.chest.options.length&&!g.chest.canEvolve))return null;
      if(g.chest.rewards.length>3||g.chest.rewards.some(r=>{
        if(!plain(r)||!weaponIds.includes(r.id)||(!g.weapons[r.id]&&!(['forge','journey'].includes(g.chest.source)&&g.consumed.includes(r.id)))||typeof r.evolved!=='boolean'||r.union!==undefined&&typeof r.union!=='boolean')return true;
        if(r.union){const recipe=UNIONS[r.id];return !recipe||!r.evolved||!g.unions.includes(r.id)||!Array.isArray(r.consumed)||r.consumed.length!==recipe.inputs.length||recipe.inputs.some((input,i)=>r.consumed[i]!==input.id);}
        return !!WEAPONS[r.id].union||r.consumed!==undefined&&(!Array.isArray(r.consumed)||r.consumed.length!==1||r.consumed[0]!==r.id);
      }))return null;
      // Reconstruct labels and requirements from trusted content, not save text.
      g.chest.options=options.filter(o=>g.chest.options.some(saved=>saved.id===o.id));
    }else if(g.chest!==undefined&&g.chest!==null)return null;
    if(g.expedition)g.expedition.milestones??={};
    g.feedback??={nextImpactAt:0,killWindowAt:0,killCount:0,nextCrowdAt:0};
    g.gems=new Map(g.gems);g.events=[];g.stats=deriveStats(g);return g;
  }catch{return null;}
}

// Expedition 0.9 keeps field acquisition, XP growth and transformation separate.
function updateJourneyDirector(g,dt){
 const c=g.campaign,s=journeyStatus(g),boss=c.stageState==='boss',dense=c.difficulty==='dense'?1.25:1;
 if(s.overrun&&!c.overrunAnnounced){c.overrunAnnounced=true;g.expedition.toast=s.canExit?'숲이 들끓습니다 · 추가 사냥은 위험합니다. 열린 출구로 이동하세요.':'숲이 들끓습니다 · 보스를 처치해 다음 구역 출구를 여세요.';g.expedition.toastUntil=g.time+6;emit(g,'surge');}
 const clearingGrace=c.stageState==='cleared'&&!s.overrun;const cap=boss?90:[180,310,140][s.index],rate=(clearingGrace?1.2:boss?[2.2,3.8,4][s.index]:s.index===0?Math.min(10,3+s.elapsed*.035):Math.min(24,11+s.elapsed*.045))*dense*(s.overrun?1.5:1);
 g.spawn-=dt;while(g.spawn<=0){g.spawn+=1/rate;if(g.enemies.length<cap){const roll=random(g),type=s.index===0?(s.elapsed>85&&roll<.06?'beetle':s.elapsed>40&&roll<.25?'runner':'shroom'):roll<.035&&g.enemies.filter(e=>e.type==='spore').length<3?'spore':roll<.12?'warden':roll<.24?'beetle':roll<.45?'runner':'shroom';edgeSpawn(g,type);}}
 if(!boss&&!clearingGrace&&g.time>=c.nextHordeAt){c.nextHordeAt=g.time+(s.index?25:35);c.hordes++;const count=Math.round((s.index?95:32)*dense),radius=Math.max(580,Math.hypot(g.view.width,g.view.height)/2+80),angle=random(g)*TAU;for(let i=0;i<count&&g.enemies.length<cap;i++){const a=angle+(i/count-.5)*2.8;spawnEnemy(g,i%13===0?'beetle':'shroom',g.player.x+Math.cos(a)*radius,g.player.y+Math.sin(a)*radius);}emit(g,'surge');}
 if(g.time>=g.nextElite){g.nextElite=g.time+90;if(!boss&&!clearingGrace)edgeSpawn(g,'elite');}
 const sovereign=g.enemies.find(e=>e.encounterRole==='sovereign'&&!e.dead);
 if(sovereign&&sovereign.hp<=sovereign.maxHp*.5&&!sovereign.flowersSpawned){sovereign.flowersSpawned=true;for(const x of [-230,230]){const hp=2200;spawnEnemy(g,'spore',x,-100,{targetRole:'support-flower',hp,maxHp:hp,speed:0,damage:0,xp:12,r:26,clock:3,cycle:0});effect(g,'ring',x,-100,70,'#dfb2c3',1);}g.expedition.toast='치유 꽃이 피어났습니다 · 꽃부터 제거하거나 군주에게 화력을 집중하세요.';g.expedition.toastUntil=g.time+7;}
 if(sovereign)sovereign.hp=Math.min(sovereign.maxHp,sovereign.hp+g.enemies.filter(e=>e.targetRole==='support-flower'&&!e.dead).length*280*dt);
 const matriarch=g.enemies.find(e=>e.encounterRole==='matriarch'&&!e.dead);
 if(matriarch&&matriarch.age>=(matriarch.nextBrood??12)){matriarch.nextBrood=matriarch.age+15;for(let i=0;i<8;i++){const a=i*TAU/8;spawnEnemy(g,'shroom',matriarch.x+Math.cos(a)*380,matriarch.y+Math.sin(a)*380,{hp:40,maxHp:40});}emit(g,'surge');}
 g.peakEnemies=Math.max(g.peakEnemies,g.enemies.length);
}
function journeySplinters(g,e){const context={source:'mastery',weapon:'acorn'};for(let i=0;i<3;i++){const a=i*TAU/3;projectile(g,'acorn',e.x,e.y,Math.cos(a)*520,Math.sin(a)*520,(12+g.level)*g.stats.damage,{r:4,pierce:2,life:.55,context});}}
function consumeJourneyGuard(g,damage,origin){
 const p=g.player,m=g.mastery,enemy=origin?.ownerId?g.enemies.find(e=>e.id===origin.ownerId):origin?.id?origin:null;
 let blocked=0;const front=origin&&((origin.x-p.x)*p.fx+(origin.y-p.y)*p.fy)/(dist(origin,p)||1)>0,braced=p.still>=.55||p.stillGrace>0;
 if(p.guard>0&&m.extraGuard>0){const take=Math.min(damage,m.extraGuard);m.extraGuard-=take;damage-=take;blocked+=take;}
 if(damage>0&&braced&&front&&m.guardValue>0){const take=Math.min(damage,m.guardValue);m.guardValue-=take;damage-=take;blocked+=take;
  if(m.guardValue<=0){m.guardReadyAt=g.time+(m.branch==='guard'?1.8:m.branch==='counter'?4:2.6);const strong=m.branch==='counter',r=strong?195:95,value=(12+g.level*1.6)*g.stats.damage*(strong?1.8:.7),context={source:'mastery',weapon:'briar'};g.delayed.push({at:g.time+.08,x:p.x,y:p.y,r,damage:value,knock:strong?180:80,color:'#badaaa',context});if(strong&&g.level>=18&&g.time>=(m.nextCounterAt||0)){m.nextCounterAt=g.time+3;for(let i=0;i<6;i++){const a=i*TAU/6;projectile(g,'moon',p.x,p.y,Math.cos(a)*380,Math.sin(a)*380,value*.65,{r:8,pierce:4,life:1.5,returnAfter:.5,context});}}}
 }
 return {damage,blocked,enemy};
}
function journeyUpgradeCandidates(g){
 const out=[];for(const [id,w]of Object.entries(g.weapons))if(BASE_WEAPON_IDS.includes(id)&&!w.evolved&&w.rank<8)out.push({id,kind:'weapon',owned:true});
 for(const [id,d]of Object.entries(PASSIVES))if((g.passives[id]||0)<d.max&&(g.passives[id]||Object.keys(g.passives).length<4))out.push({id,kind:'passive',owned:!!g.passives[id]});
 return out.length?out:['heal','power','score'].map(id=>({id,kind:'boon',owned:false}));
}
function draftJourneyChoices(g,excluded,advance){
 let pool=journeyUpgradeCandidates(g);const out=[];if(advance)g.drafts++;
 const add=c=>{if(c){out.push(c);pool=pool.filter(x=>x.id!==c.id);}};
 if(g.drafts<=2)add(pool.find(c=>c.id===g.startWeapon));
 if(g.upgradeMisses>=2&&!out.some(c=>c.kind==='weapon'))add(fromPool(g,pool.filter(c=>c.kind==='weapon')));
 if(g.drafts%4===0)add(pool.find(c=>c.kind==='passive'&&Object.keys(g.weapons).some(id=>g.weapons[id].rank>=6&&WEAPONS[id].recipe===c.id)));
 while(pool.length&&out.length<3){const fresh=pool.filter(c=>!excluded.includes(c.id)),eligible=fresh.length?fresh:pool,weighted=eligible.flatMap(c=>Array(c.kind==='weapon'?4:3).fill(c));add(fromPool(g,weighted));}
 if(advance)g.upgradeMisses=out.some(c=>c.kind==='weapon')?0:g.upgradeMisses+1;return out;
}
function journeyForgeCandidates(g){
 const out=evolutionCandidates(g).filter(()=>g.campaign.seals>0).map(id=>({id:`evolve:${id}`,weapon:id,kind:'evolution',name:WEAPONS[id].evo,description:`${WEAPONS[id].evoText} · 인장 1개`,consumes:[id],catalyst:WEAPONS[id].recipe}));
 for(const recipe of unionCandidates(g))for(const input of recipe.inputs.filter(i=>g.weapons[i.id].evolved))out.unshift({id:`union:${recipe.id}:${input.id}`,weapon:recipe.id,kind:'union',core:input.id,name:transformationName(recipe.id,input.id),description:recipe.id==='returning'?(input.id==='moon'?'좁은 왕복 탄도 · 귀환 화력 집중':'넓은 폭발 산탄 · 밀집한 적 관통'):(input.id==='bees'?'벌떼가 멀리 출격 · 가까운 방어는 줄어듭니다':'가까운 수호 궤도 · 짧은 벌떼 귀환'),consumes:recipe.inputs.map(i=>i.id),catalyst:null});return out;
}
function claimJourneyReward(g,id){
 if(g.phase!=='chest'||!g.chest?.bossLoot||!g.campaign.rewardPending)return false;
 if(id==='heal')healPlayer(g,g.player.maxHp*.5);
 else if(id.startsWith('weapon:')){const key=id.slice(7),w=g.weapons[key];if(!w||w.evolved||w.rank>=8)return false;w.rank++;w.clock=0;recordRank(g,key);}
 else if(id.startsWith('catalyst:')){const [key,replace]=id.slice(9).split(':');if(!PASSIVES[key]||g.passives[key]||!Object.keys(g.weapons).some(w=>WEAPONS[w].recipe===key))return false;if(Object.keys(g.passives).length>=4){if(!replace||!g.passives[replace])return false;delete g.passives[replace];}g.passives[key]=1;}
 else if(id!=='skip')return false;
 g.campaign.rewardPending=false;g.chest.options=journeyForgeCandidates(g);g.stats=deriveStats(g);return true;
}
function transformJourneyWeapon(g,id){
 if(g.phase!=='chest'||g.chest?.source!=='journey')return false;const o=journeyForgeCandidates(g).find(o=>o.id===id);if(!o)return false;
 if(o.kind==='union'){for(const input of o.consumes){delete g.weapons[input];if(!g.consumed.includes(input))g.consumed.push(input);}g.weapons[o.weapon]={rank:1,evolved:true,clock:0,core:o.core,branch:coreVariant(o.weapon,o.core)};g.unions.push(o.weapon);if(!g.discovered.includes(o.weapon))g.discovered.push(o.weapon);g.metrics.firstUnionAt??=g.time;}
 else{g.campaign.seals--;g.weapons[o.weapon].evolved=true;g.weapons[o.weapon].clock=0;if(!g.evolutions.includes(o.weapon))g.evolutions.push(o.weapon);g.metrics.firstEvolutionAt??=g.time;}
 g.chest.rewards=[{id:o.weapon,evolved:true,union:o.kind==='union',consumed:[...o.consumes]}];g.chest.options=journeyForgeCandidates(g);emit(g,o.kind==='union'?'union':'evolution',{id:o.weapon});return true;
}
function openJourneyDrop(g,drop){
 if(g.phase!=='playing')return false;const available=Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&g.weapons[id].rank<8),id=available.includes(drop.forgeWeapon)?drop.forgeWeapon:available[0],rewards=[];
 if(id){const before=g.weapons[id].rank;g.weapons[id].rank=Math.min(8,before+(drop.source==='nest'?2:1));g.weapons[id].clock=0;recordRank(g,id);rewards.push({id,evolved:false,amount:g.weapons[id].rank-before});}else healPlayer(g,g.player.maxHp*.15);
 g.metrics.chests++;g.chest={source:'journey',bossLoot:false,gold:0,rewards,options:journeyForgeCandidates(g),canEvolve:true,optionalUnion:true,returnPhase:'playing'};g.phase='chest';emit(g,'chest');return true;
}
export function requestJourneyExit(g){
 if(!isJourney(g)||g.phase!=='playing'||!journeyStatus(g).canExit)return false;
 const value=[...g.gems.values(),...g.flying].reduce((s,gem)=>s+gem.value,0);g.gems.clear();g.flying=[];if(value)gainXP(g,value);g.campaign.transitionPending=true;if(g.pendingLevels)offerLevel(g);return true;
}
