import {weaponPose} from '../game/motion.js';
import {moveActor} from '../game/terrain.js';
import {createRelics,createRelicCache,tickRelics,onRelicWeaponHit,onRelicWeaponKill,onRelicHealing,absorbRelicShield,validRelics,RELICS} from './relics.js';
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
    initialSeed:seed>>>0,relics:createRelics(),relicOffer:null,
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
  const p=g.passives,h=HEROES[g.hero],u=g.boosts;
  return {damage:1+(p.berry||0)*.12+(u.might||0)*.05,
    eliteDamage:g.hero==='fox'?1.2:1,
    area:(1+(p.leaf||0)*.12)*(g.hero==='mole'&&(g.player.still>=.6||g.player.stillGrace>0)?1.25:1),
    duration:(1+(p.dew||0)*.2)*(g.hero==='otter'?1.25:1),
    cooldown:(g.gear==='boots'&&g.player.moving?.9:1)*(1-(p.feather||0)*.07)*(1-(g.hero==='lune'?g.player.wind*.05:0)),
    amount:(p.twin||0)+(g.hero==='pip'?1:0),projectileSpeed:1+(p.swift||0)*.15,
    speed:h.speed*(g.gear==='boots'?1.12:1),armor:(g.hero==='bram'?2:0)+(p.bark||0)+(g.gear==='bark'&&g.player.still>.5?3:0),magnet:94+(u.magnet||0)*12+(p.stone||0)*22,
    growth:1+(u.growth||0)*.05+(p.stone||0)*.06,regen:(u.recovery||0)*.08,knock:1};
}
function emit(g,type,data={}){g.events.push({type,...data});}
function effect(g,type,x,y,r,color='#ebc780',life=.35,extra={}) {
  if(g.effects.length>=LIMITS.effects)g.effects.shift();
  g.effects.push({type,x,y,r,color,life,maxLife:life,...extra});
}
function floating(g,x,y,value,color='#f2dfb5',large=false) {
  if(g.texts.length>=LIMITS.texts)g.texts.shift();g.texts.push({x,y,value,color,large,life:large?.85:.55});
}
const specs={shroom:[15,51,7,12,2],runner:[12,109,9,11,3],beetle:[51,40,13,18,5],spore:[26,47,8,13,4],elite:[480,48,15,27,30],king:[104000,43,22,46,100]};
export function spawnEnemy(g,type,x,y,extra={}) {
  if(g.enemies.length>=LIMITS.enemies&&type!=='king')return null;
  const [baseHp,speed,damage,r,xp]=specs[type];
  const scaling=type==='king'?1:type==='elite'?1+g.time/80:Math.pow(1+g.time/75,1.05);
  const hp=baseHp*scaling*(g.hard?1.35:1);
  const e={id:++g.id,type,x,y,hp,maxHp:hp,canEvolve:g.time>=600,speed:speed*(1+Math.min(.35,g.time/2200))*(g.hard?1.12:1),damage:damage+g.time/180,r,xp,hurt:0,slow:0,kx:0,ky:0,clock:2+random(g)*2,age:0,mode:'walk',dead:false,...extra};
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
  if(t>70&&r<.30)return 'beetle';
  if(t>28&&r<.50)return 'runner';
  return 'shroom';
}
function updateDirector(g,dt) {
  const returning=!!g.expedition&&g.time>=150;
  const cap=Math.min(520,24+g.time*.45),rate=Math.min(27,1.7+g.time*.026)*(g.hard?1.2:1)*(returning?.75:1);
  g.spawn-=dt;
  while(g.spawn<=0){g.spawn+=1/rate;if(g.enemies.length<cap)edgeSpawn(g,enemyType(g));}
  const wave=Math.floor(g.time/30);
  if(wave!==g.wave){g.wave=wave;if(wave%2===0)emit(g,'wave',{wave});}
  if(g.time>=g.nextSurge&&g.time<RUN_SECONDS) {
    g.nextSurge+=45;
    const angle=random(g)*TAU,count=Math.round(Math.min(48,14+Math.floor(g.time/25))*(returning?.6:1));
    const radius=Math.hypot(g.view.width,g.view.height)/2+80;
    for(let i=0;i<count;i++){
      const a=angle+(i/count-.5)*1.1;
      spawnEnemy(g,g.time>120&&i%4===0?'runner':'shroom',g.player.x+Math.cos(a)*radius,g.player.y+Math.sin(a)*radius);
    }
    emit(g,'surge');
  }
  if(g.time>=g.nextElite&&g.time<RUN_SECONDS) {
    g.nextElite+=75;const e=edgeSpawn(g,'elite');
    if(e){if(Math.round(g.time)%300<2){e.hp*=2;e.maxHp=e.hp;e.ancient=true;}emit(g,'elite');}
  }
  if(g.time>=BOSS_SECONDS&&!g.finalSpawned) {
    g.finalSpawned=true;
    const e=spawnEnemy(g,'king',g.player.x,g.player.y-g.view.height/2-80);g.bossId=e.id;
    emit(g,'boss');g.shake=7;
  }
  g.peakEnemies=Math.max(g.peakEnemies,g.enemies.length);
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
function addGem(g,x,y,value) {
  g.metrics.xpDropped=(g.metrics.xpDropped||0)+value;
  // Only merge inside the same small world cell. Distant XP never teleports.
  const key=`${Math.floor(x/30)},${Math.floor(y/30)}`,existing=g.gems.get(key);
  if(existing)existing.value+=value;else g.gems.set(key,{x,y,value,age:0});
}
function trimPickups(g){while(g.pickups.length>LIMITS.pickups){let index=g.pickups.findIndex(p=>!['chest','relic'].includes(p.type));if(index<0)index=0;const [old]=g.pickups.splice(index,1);if(old.type==='coin')g.gold+=2;}}
function resolveRelics(g,actions){
  for(const action of actions){
    const {relicId:id}=action,context={source:'relic',relic:id};
    if(action.kind==='wind'){projectile(g,'wind',action.x,action.y,Math.cos(action.angle)*720,Math.sin(action.angle)*720,action.damage,{r:16,pierce:99,life:.4,context});}
    else if(action.kind==='target'){const e=g.enemies.find(e=>e.id===action.target&&!e.dead);if(e){hit(g,e,action.damage,0,g.player,false,context);effect(g,'relic',e.x,e.y-25,32,RELICS[id].color,.35,{relicId:id});}}
    else if(action.kind==='burst'){areaHit(g,action.x,action.y,action.r,action.damage,action.knock,context);effect(g,'relic',action.x,action.y,action.r,RELICS[id].color,.4,{relicId:id});}
    else if(action.kind==='seed'){g.pickups.push({id:++g.id,type:'heal',x:action.x,y:action.y,amount:8,relicId:'seed',expiresAt:g.time+16});}
    else if(action.kind==='shield')effect(g,'relic',g.player.x,g.player.y-25,35,RELICS[id].color,.35,{relicId:id});
  }
}
function kill(g,e,context={source:'weapon'}) {
  if(e.dead)return;e.dead=true;g.kills++;g.player.charge=clamp(g.player.charge+.9,0,100);
  addGem(g,e.x,e.y,e.xp*(1+Math.floor(g.time/180)));
  effect(g,'death',e.x,e.y,e.r,e.type==='beetle'?'#5dbfb3':'#e5b78b',.28,{enemyType:e.type,angle:Math.atan2(e.ky,e.kx)});
  emit(g,'kill');
  resolveRelics(g,onRelicWeaponKill(g,e,context));
  if(e.type!=='elite'&&e.type!=='king'){
    const f=g.feedback;
    if(g.time-f.killWindowAt>.12){f.killWindowAt=g.time;f.killCount=0;}
    if(++f.killCount>=3&&g.time>=f.nextCrowdAt){f.nextCrowdAt=g.time+.4;f.killCount=0;g.shake=Math.max(g.shake,1.4);g.hitstop=Math.max(g.hitstop,.018);emit(g,'crowd-break');}
  }
  if(e.type==='king'){g.kingKills++;g.gold+=120;g.pickups.push({id:++g.id,type:'chest',x:e.x,y:e.y,canEvolve:true});g.shake=6;emit(g,'bossDown');trimPickups(g);return;}
  if(e.type==='elite'){
    g.elites++;g.pickups.push({id:++g.id,type:'chest',x:e.x,y:e.y,canEvolve:e.canEvolve,forgeWeapon:e.nestGuardian?g.startWeapon:null,source:e.nestGuardian?'nest':'elite'});if(e.nestGuardian)createRelicCache(g,'nest',e.x+60,e.y-15);g.fields=g.fields.filter(f=>f.ownerId!==e.id);g.hitstop=.04;g.shake=3;emit(g,'eliteDown');
  }else{
    const r=random(g);
    if(r<.013)g.pickups.push({id:++g.id,type:'heal',x:e.x,y:e.y});
    else if(r<.016)g.pickups.push({id:++g.id,type:'magnet',x:e.x,y:e.y});
    else if(r<.028)g.pickups.push({id:++g.id,type:'coin',x:e.x,y:e.y});
  }
  trimPickups(g);
}
function hit(g,e,amount,knock=0,origin=g.player,crit=false,context=origin.context??g.castContext??{source:'weapon'}) {
  if(e.dead)return;
  amount*=e.type==='elite'||e.type==='king'?g.stats.eliteDamage:1;
  const dealt=Math.min(e.hp,amount);e.hp-=amount;g.damage+=dealt;e.hurt=.13;e.hitstop=crit?.035:.018;
  if(context.source==='relic'&&Object.hasOwn(RELICS,context.relic))g.relics.stats[context.relic].damage+=dealt;
  const wasKnocked=e.lastKnockedAt!==undefined&&g.time-e.lastKnockedAt<=2;
  // A fast projectile can finish beyond its target. Its velocity, not its final position, defines the impulse.
  const impulse=origin.kind&&Math.hypot(origin.vx||0,origin.vy||0)>0?direction(origin.vx,origin.vy):direction(e.x-origin.x,e.y-origin.y);
  if(knock){const mass=e.type==='king'?.1:e.type==='elite'?.35:1;e.kx+=impulse.x*knock*g.stats.knock*mass;e.ky+=impulse.y*knock*g.stats.knock*mass;if(context.source==='weapon')e.lastKnockedAt=g.time;}
  effect(g,'impact',e.x,e.y-25,crit?14:8,crit?'#ffe6a1':'#f7dda8',.14,{angle:Math.atan2(impulse.y,impulse.x),crit});
  if(g.time>=g.feedback.nextImpactAt){g.feedback.nextImpactAt=g.time+.12;g.hitstop=Math.max(g.hitstop,crit?.018:.007);g.shake=Math.max(g.shake,crit?1.1:.38);}
  else if(crit)g.shake=Math.max(g.shake,1.1);
  if(crit||g.texts.length<16||random(g)<.1)floating(g,e.x,e.y-48,Math.round(amount),crit?'#ffdf78':'#f4e9cb',crit);
  if(!g.hitEvent){emit(g,'impact');g.hitEvent=true;}
  if(e.hp<=0)kill(g,e,context);
  resolveRelics(g,onRelicWeaponHit(g,e,context,wasKnocked,Math.atan2(impulse.y,impulse.x)));
}
function areaHit(g,x,y,r,damage,knock=0,context=g.castContext??{source:'weapon'}) {nearby(g,x,y,r,e=>hit(g,e,damage,knock,{x,y},false,context));}
function projectile(g,kind,x,y,vx,vy,damage,extra={}) {
  if(g.projectiles.length>=LIMITS.projectiles)return;
  if(!extra.hostile&&Math.hypot(x-g.player.x,y-g.player.y)<26){
    const m=g.castOrigin||weaponPose(g.player);x=m.x;y=m.y;
    if(kind==='bottle'){extra.ox=x;extra.oy=y;}
  }
  g.projectiles.push({kind,x,y,vx,vy,damage,life:2,age:0,r:6,pierce:0,hits:[],context:extra.hostile?undefined:g.castContext??{source:'weapon',weapon:kind},...extra});
}
export function weaponStats(g,id,rank=g.weapons[id]?.rank||1){const w=g.weapons[id],d=WEAPONS[id],evo=!!w?.evolved&&!d.union;return {damage:(d.damage+(rank-1)*3.3)*g.stats.damage*(evo?1.65:1),cooldown:d.cooldown*g.stats.cooldown*(1-Math.min(.28,(rank-1)*.035)),rank,evolved:evo};}
function damageFor(g,id){return weaponStats(g,id).damage;}
function cast(g,id) {
  const p=g.player,w=g.weapons[id],s=g.stats,rank=w.rank,evo=w.evolved,target=nearest(g),amount=s.amount;
  if(!target&&id!=='bloom'&&id!=='briar')return;
  g.castContext={source:'weapon',weapon:id};
  const damage=damageFor(g,id),angle=target?Math.atan2(target.y-p.y,target.x-p.x):Math.atan2(p.fy,p.fx);
  const primary=Object.hasOwn(g.weapons,g.startWeapon)?g.startWeapon:Object.keys(g.weapons)[0];
  const ownsPose=id===primary||p.attack<=0;
  if(ownsPose){p.attack=.24;p.attackWindup=0;p.aim=angle;p.attackWeapon=id;}
  const muzzle=weaponPose({...p,attack:.24},angle);g.castOrigin=muzzle;
  emit(g,'attack',{weapon:id,angle,x:muzzle.x,y:muzzle.y,primary:ownsPose});
  if(['acorn','moon','bees','returning'].includes(id))effect(g,'muzzle',muzzle.x,muzzle.y,9,WEAPONS[id].color,.085,{angle,weapon:id});
  if(id==='acorn'){
    const count=Math.min(11,1+amount+Math.floor(rank/4)+(evo?3:0));
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(evo?.15:.10);projectile(g,'acorn',p.x,p.y-7,Math.cos(a)*580*s.projectileSpeed,Math.sin(a)*580*s.projectileSpeed,damage,{r:6*s.area,pierce:Math.floor(rank/3)+(evo?5:0),evolved:evo,life:1.7});}
    emit(g,'shot');
  }else if(id==='moon'){
    emit(g,'whoosh');
    const count=1+amount+Math.floor(rank/4)+(evo?2:0);
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.3;projectile(g,'moon',p.x,p.y,Math.cos(a)*460*s.projectileSpeed,Math.sin(a)*460*s.projectileSpeed,damage,{r:(evo?25:15)*s.area,pierce:999,life:2.2*s.duration,evolved:evo,turned:false,returnAfter:.65*s.duration,flySpeed:540*s.projectileSpeed});}
  }else if(id==='bees'){
    emit(g,'buzz');
    const count=1+amount+Math.floor(rank/3)+(evo?3:0);
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.5;projectile(g,'bee',p.x,p.y-18,Math.cos(a)*240*s.projectileSpeed,Math.sin(a)*240*s.projectileSpeed,damage,{r:8,life:3*s.duration,pierce:evo?3:0,target:target.id,evolved:evo,flySpeed:390*s.projectileSpeed});}
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
    const count=5+amount;
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.17;projectile(g,'moon',p.x,p.y,Math.cos(a)*600*s.projectileSpeed,Math.sin(a)*600*s.projectileSpeed,damage,{r:13*s.area,pierce:999,life:2.5*s.duration,evolved:true,turned:false,returnAfter:.65*s.duration,flySpeed:630*s.projectileSpeed,union:'returning'});}
    emit(g,'shot');
  }else if(id==='hive'){
    const count=4+amount;
    for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.55;projectile(g,'bee',p.x+Math.cos(a)*60,p.y+Math.sin(a)*48,Math.cos(a)*300*s.projectileSpeed,Math.sin(a)*300*s.projectileSpeed,damage,{r:9,life:3.5*s.duration,pierce:3,target:target.id,evolved:true,flySpeed:440*s.projectileSpeed,union:'hive'});}
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
    for(let i=0;i<15;i++){const a=face+(i-7)*.085;projectile(g,'acorn',p.x,p.y,Math.cos(a)*650,Math.sin(a)*650,damage,{life:1.6,pierce:8,r:9,evolved:true});}
    areaHit(g,p.x,p.y,95,damage,160);effect(g,'ring',p.x,p.y,130,'#ffd489',.4);
  }else if(g.hero==='lune'){
    p.dash=.3;p.invincible=1;
    for(let i=0;i<3;i++){const a=face+(i-1)*.24;projectile(g,'moon',p.x,p.y,Math.cos(a)*620,Math.sin(a)*620,damage,{r:25,pierce:999,life:2,evolved:true,returnAfter:.6,flySpeed:580});}
  }else if(g.hero==='bram'){
    p.guard=2;p.invincible=2;areaHit(g,p.x,p.y,220,damage*1.5,350);effect(g,'ring',p.x,p.y,240,'#b8e0af',.65);
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
  return {active,count:(hive?4:2)+Math.floor(rank/3)+g.stats.amount+(evolved?2:0),radius:(57+rank*3)*g.stats.area,speed:(evolved?2.5:1.9)*g.stats.projectileSpeed,hive};
}
function updateWeapons(g,dt) {
  if(g.player.signature>0)return;
  for(const [id,w] of Object.entries(g.weapons)){
    if(id==='briar'||id==='hive'){
      const orbit=orbitState(g,id),damage=damageFor(g,id)*(id==='hive'?.72:1);
      if(orbit.active)for(let i=0;i<orbit.count;i++){
        const a=g.time*orbit.speed+i*TAU/orbit.count,x=g.player.x+Math.cos(a)*orbit.radius,y=g.player.y+Math.sin(a)*orbit.radius*.8;
        nearby(g,x,y,20*g.stats.area,e=>{if((e.orbitHit||0)>g.time)return;e.orbitHit=g.time+(w.evolved?.24:.42);hit(g,e,damage,45);if(w.evolved)e.slow=.8;});
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
function hostileShot(g,e,a,speed=120) {projectile(g,'enemy',e.x,e.y,Math.cos(a)*speed,Math.sin(a)*speed,e.damage,{hostile:true,r:7,life:e.type==='spore'?4:6});}
function updateEnemies(g,dt) {
  const p=g.player;
  for(const e of g.enemies){
    if(e.dead)continue;e.age+=dt;e.clock-=dt;e.hurt=Math.max(0,e.hurt-dt);e.slow=Math.max(0,e.slow-dt);
    if(e.hitstop>0){e.hitstop=Math.max(0,e.hitstop-dt);continue;}
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
    if(e.type==='spore'){
      if(distance<220)speed=-speed*.5;else if(distance<340)speed=0;
      if(e.mode==='windup'){speed=0;e.windup-=dt;if(e.windup<=0){e.mode='recover';e.recover=.35;e.clock=3.1;hostileShot(g,e,Math.atan2(e.dy,e.dx));effect(g,'muzzle',e.x,e.y,10,'#d4a2e6',.12,{angle:Math.atan2(e.dy,e.dx),hostile:true});}}
      else if(e.mode==='recover'){speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';}
      else if(e.clock<=0&&distance<450){e.mode='windup';e.windup=.7;e.dx=d.x;e.dy=d.y;speed=0;}
    }
    if(e.nestGuardian){
      if(!e.reinforced&&e.hp<=e.maxHp*.5){
        e.reinforced=true;
        for(let i=0;i<2;i++){const a=i*Math.PI+e.age;spawnEnemy(g,'runner',e.x+Math.cos(a)*180,e.y+Math.sin(a)*180,{clock:.8});}
        emit(g,'surge');
      }
      if(e.mode==='windup'){speed=0;e.windup-=dt;if(e.windup<=0){e.mode='recover';e.recover=.45;e.clock=5.5;}}
      else if(e.mode==='recover'){speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';}
      else if(e.clock<=0&&distance<600){
        e.mode='windup';e.windup=.9;speed=0;
        const a=Math.atan2(p.y-e.y,p.x-e.x);
        for(let i=-1;i<=1;i++)if(g.fields.length<LIMITS.fields)g.fields.push({hostile:true,ownerId:e.id,x:p.x+Math.cos(a+Math.PI/2)*i*92,y:p.y+Math.sin(a+Math.PI/2)*i*92,r:43,life:1.45,warning:.9,tick:0,damage:12});
      }
    }else if(e.type==='elite'&&e.clock<=0){e.clock=7;for(let i=0;i<4;i++){const a=i*TAU/4;spawnEnemy(g,'shroom',e.x+Math.cos(a)*55,e.y+Math.sin(a)*55);}effect(g,'ring',e.x,e.y,65,'#d3a1a0',.6);}
    if(e.type==='king'){
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
    // A gentle local separation keeps the horde legible without O(n²) pairs.
    let sx=0,sy=0;
    const bucket=g.grid?.get(`${Math.floor(e.x/96)},${Math.floor(e.y/96)}`);
    if(bucket&&bucket.length<35)for(const other of bucket){if(e===other||other.dead)continue;const dx=e.x-other.x,dy=e.y-other.y,l2=dx*dx+dy*dy,reach=(e.r+other.r)*.62;if(l2>0&&l2<reach*reach){const l=Math.sqrt(l2);sx+=dx/l*12;sy+=dy/l*12;}}
    const oldX=e.x,oldY=e.y;moveActor(g,e,(d.x*speed+e.kx+sx)*dt,(d.y*speed+e.ky+sy)*dt,e.r*.7);e.walk=(e.walk||0)+Math.hypot(e.x-oldX,e.y-oldY);e.fx=d.x;e.fy=d.y;e.kx*=Math.exp(-8*dt);e.ky*=Math.exp(-8*dt);
    if(dist(e,p)<e.r+12)hurtPlayer(g,e.damage,e,wasCharging?'charge':'contact');
    // Recycle stragglers at a screen edge; no rewards or off-screen kills.
    if(distance>Math.max(g.view.width,g.view.height)*1.8&&!e.supplyGuard&&e.type!=='elite'&&e.type!=='king'){
      const a=random(g)*TAU;e.x=p.x+Math.cos(a)*Math.max(560,g.view.width*.65+80);e.y=p.y+Math.sin(a)*Math.max(420,g.view.height*.65+80);
    }
  }
}
function hurtPlayer(g,damage,origin,source=null) {
  const p=g.player;if(p.invincible>0||g.phase!=='playing')return;
  const incoming=Math.max(1,damage-g.stats.armor),absorbed=absorbRelicShield(g,incoming),value=incoming-absorbed;
  if(absorbed>0){emit(g,'guard-block');effect(g,'relic',p.x,p.y-25,36,RELICS.shell.color,.25,{relicId:'shell'});p.invincible=.3;}
  if(value<=0)return;
  p.hp-=value;g.metrics.damageTaken+=value;p.hurt=.35;p.invincible=.65;g.shake=4;
  source??=origin?.kind==='enemy'?'projectile':origin?.hostile?'field':'contact';
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
    if(p.kind==='moon'&&p.age>(p.returnAfter||.65)){
      if(!p.turned){p.turned=true;p.hits=[];}
      const d=direction(g.player.x-p.x,g.player.y-p.y);p.vx=d.x*(p.flySpeed||540);p.vy=d.y*(p.flySpeed||540);
      if(dist(p,g.player)<18&&p.age>.9){p.life=0;continue;}
    }
    if(p.kind==='bee'){
      let target=g.enemies.find(e=>e.id===p.target&&!e.dead);if(!target)target=nearest(g,p,500);
      if(target){p.target=target.id;const d=direction(target.x-p.x,target.y-p.y);p.vx+=(d.x*(p.flySpeed||390)-p.vx)*Math.min(1,dt*6);p.vy+=(d.y*(p.flySpeed||390)-p.vy)*Math.min(1,dt*6);}
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
      if(p.pierce--<=0)p.life=0;
    });
  }
  g.projectiles=g.projectiles.filter(p=>p.life>0);
}
function updateFields(g,dt) {
  for(const f of g.fields){
    f.life-=dt;f.tick-=dt;
    if(f.evolved&&!f.hostile){const d=direction(g.player.x-f.x,g.player.y-f.y);if(dist(f,g.player)>10){f.x+=d.x*30*dt;f.y+=d.y*30*dt;}}
    if(f.hostile){f.warning-=dt;if(f.warning<=0&&dist(f,g.player)<f.r+10)hurtPlayer(g,f.damage,f);}
    else if(f.tick<=0){f.tick=.32;nearby(g,f.x,f.y,f.r,e=>{hit(g,e,f.damage,0,g.player,false,f.context??{source:'weapon'});if(f.evolved){const d=direction(f.x-e.x,f.y-e.y);e.kx+=d.x*18;e.ky+=d.y*18;}});}
  }
  g.fields=g.fields.filter(f=>f.life>0);
  for(const d of g.delayed)if(!d.done&&d.at<=g.time){d.done=true;areaHit(g,d.x,d.y,d.r,d.damage,d.knock,d.context??{source:'weapon'});effect(g,'ring',d.x,d.y,d.r,d.color,.45);}
  g.delayed=g.delayed.filter(d=>!d.done);
}
function gainXP(g,value) {
  g.metrics.xpCollected=(g.metrics.xpCollected||0)+value;g.metrics.xpGranted=(g.metrics.xpGranted||0)+value*g.stats.growth;
  g.xp+=value*g.stats.growth;
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
  for(const gem of g.flying){gem.age=(gem.age??1)+dt;const d=direction(p.x-gem.x,p.y-gem.y);gem.speed+=1300*dt;gem.x+=d.x*gem.speed*dt;gem.y+=d.y*gem.speed*dt;if(dist(gem,p)<18+gem.speed*dt){gem.collected=true;gainXP(g,gem.value);emit(g,'xp');}}
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
  if(g.pendingLevels>0&&g.phase==='playing')offerLevel(g);
}
export function upgradeCandidates(g) {
  const entries=[],ids=[...new Set([...Object.keys(g.weapons),...g.pool])];
  for(const id of ids){
    const w=g.weapons[id],data=WEAPONS[id];
    if(!data||data.union||g.consumed.includes(id)||g.banished.includes(id))continue;
    if(w&&w.rank<data.max&&!w.evolved)entries.push({id,kind:'weapon',owned:true});
    else if(!w&&g.pool.includes(id)&&Object.keys(g.weapons).length<SLOT_LIMIT)entries.push({id,kind:'weapon',owned:false});
  }
  for(const [id,data] of Object.entries(PASSIVES)){
    const rank=g.passives[id]||0;
    if(g.banished.includes(id)||rank>=data.max)continue;
    if(rank||Object.keys(g.passives).length<SLOT_LIMIT)entries.push({id,kind:'passive',owned:rank>0});
  }
  return entries;
}
export function draftChoices(g,excluded=[],advance=true) {
  let pool=upgradeCandidates(g);const out=[];
  if(advance)g.drafts++;
  const add=choice=>{if(choice){out.push(choice);pool=pool.filter(c=>c.id!==choice.id);}};
  const eligible=list=>{const fresh=list.filter(c=>!excluded.includes(c.id));return fresh.length?fresh:list;};
  if(g.drafts<=2){
    const primary=pool.find(c=>c.kind==='weapon'&&c.owned&&c.id===g.startWeapon);add(primary);
    const fresh=eligible(pool.filter(c=>c.kind==='weapon'&&!c.owned));if(fresh.length)add(fromPool(g,fresh));
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
  g.choices=draftChoices(g);
  if(!g.choices.length){g.gold+=g.pendingLevels*2;g.pendingLevels=0;g.phase='playing';if(!g.mastered){g.mastered=true;emit(g,'mastery');}return;}
  g.phase='choice';emit(g,'level');
}
function recordRank(g,id){g.maxRanks[id]=Math.max(g.maxRanks[id]||0,g.weapons[id].rank);if(!g.discovered.includes(id))g.discovered.push(id);}
export function applyChoice(g,index) {
  if(g.phase!=='choice'||!Number.isInteger(index)||!g.choices[index])return false;
  const choice=g.choices[index],{id,kind}=choice;
  if(!upgradeCandidates(g).some(c=>c.id===id&&c.kind===kind))return false;
  if(kind==='weapon'){
    if(g.weapons[id]){g.weapons[id].rank++;g.weapons[id].clock=0;}
    else g.weapons[id]={rank:1,evolved:false,clock:0};
    recordRank(g,id);
  }else if(kind==='passive')g.passives[id]=(g.passives[id]||0)+1;
  g.stats=deriveStats(g);g.pendingLevels=Math.max(0,g.pendingLevels-1);g.choices=[];
  if(g.pendingLevels>0)offerLevel(g);else g.phase='playing';
  emit(g,'upgrade',{id});return true;
}
export function reroll(g){
  if(g.phase!=='choice'||g.rerolls<=0)return false;
  const previous=g.choices.map(c=>c.id);if(!upgradeCandidates(g).some(c=>!previous.includes(c.id)))return false;
  g.rerolls--;g.choices=draftChoices(g,previous,false);emit(g,'reroll');return true;
}
// Kept as inert compatibility exports. The approved initial game only uses reroll.
export function banish(){return false;}
export function skipChoice(){return false;}
export function evolutionCandidates(g){return Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&g.weapons[id].rank===WEAPONS[id].max&&(g.passives[WEAPONS[id].recipe]||0)>0);}
export function unionCandidates(g){return Object.values(UNIONS).filter(recipe=>!g.weapons[recipe.id]&&!g.consumed.includes(recipe.id)&&recipe.inputs.every(input=>{const w=g.weapons[input.id];return w&&w.rank>=input.rank&&w.evolved===input.evolved;}));}
export function chestCandidates(g){
  return [...unionCandidates(g).map(r=>({id:`union:${r.id}`,weapon:r.id,kind:'union',name:r.name,description:r.description,consumes:r.inputs.map(i=>i.id),catalyst:null})),
    ...evolutionCandidates(g).map(id=>({id:`evolve:${id}`,weapon:id,kind:'evolution',name:WEAPONS[id].evo,description:WEAPONS[id].evoText,consumes:[id],catalyst:WEAPONS[id].recipe}))];
}
export function openChest(g,drop={canEvolve:true}) {
  if(g.phase!=='playing')return false;
  const gold=35+Math.floor(random(g)*35),rewards=[];
  const forged=drop.forgeWeapon&&g.weapons[drop.forgeWeapon]&&!g.weapons[drop.forgeWeapon].evolved&&g.weapons[drop.forgeWeapon].rank<WEAPONS[drop.forgeWeapon].max?drop.forgeWeapon:null;
  if(forged){const before=g.weapons[forged].rank;g.weapons[forged].rank=Math.min(WEAPONS[forged].max,before+2);g.weapons[forged].clock=0;recordRank(g,forged);rewards.push({id:forged,evolved:false,amount:g.weapons[forged].rank-before});}
  const options=drop.canEvolve===true?chestCandidates(g):[];
  if(!options.length){
    const available=Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&!g.weapons[id].evolved&&g.weapons[id].rank<WEAPONS[id].max);
    const amount=forged?0:random(g)<.2?3:1;
    for(let i=0;i<amount&&available.length;i++){const id=available.splice(Math.floor(random(g)*available.length),1)[0];g.weapons[id].rank++;g.weapons[id].clock=0;recordRank(g,id);rewards.push({id,evolved:false});}
  }
  g.gold+=gold;g.metrics.chests++;g.chest={gold,rewards,options,canEvolve:drop.canEvolve===true,source:drop.source||'elite'};g.phase='chest';emit(g,'chest');return true;
}
export function selectChest(g,id){
  if(g.phase!=='chest'||!g.chest?.canEvolve||!g.chest.options.some(o=>o.id===id))return false;
  const option=chestCandidates(g).find(o=>o.id===id);if(!option)return false;
  if(option.kind==='union'){
    for(const consumed of option.consumes){delete g.weapons[consumed];if(!g.consumed.includes(consumed))g.consumed.push(consumed);}
    g.weapons[option.weapon]={rank:1,evolved:true,clock:0};g.unions.push(option.weapon);g.discovered.push(option.weapon);
    if(g.metrics.firstUnionAt===null)g.metrics.firstUnionAt=g.time;
  }else{
    g.weapons[option.weapon].evolved=true;g.weapons[option.weapon].clock=0;
    if(!g.evolutions.includes(option.weapon))g.evolutions.push(option.weapon);
    if(g.metrics.firstEvolutionAt===null)g.metrics.firstEvolutionAt=g.time;
  }
  g.chest.rewards=[{id:option.weapon,evolved:true,union:option.kind==='union',consumed:[...option.consumes]}];g.chest.options=[];g.shake=6;
  emit(g,option.kind==='union'?'union':'evolution',{id:option.weapon});return true;
}
export function closeChest(g){if(g.phase!=='chest'||g.chest?.options.length)return false;g.chest=null;g.phase='playing';g.player.invincible=Math.max(g.player.invincible,1);return true;}
export function pauseGame(g,reason='manual'){if(g.phase!=='playing')return false;g.phase='paused';g.pauseReason=reason;return true;}
export function resumeGame(g){if(g.phase!=='paused')return false;g.phase='playing';return true;}
export function retreat(g){if(g.phase!=='paused')return false;g.outcome='retreat';g.phase='result';return true;}

export function stepGame(g,dt,input={}) {
  if(g.phase!=='playing')return;
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=clamp(dt,0,.04);g.hitEvent=false;
  g.feedback??={nextImpactAt:0,killWindowAt:0,killCount:0,nextCrowdAt:0};
  g.relics??=createRelics();
  const worldDt=Math.max(0,dt-Math.min(dt,g.hitstop));g.hitstop=Math.max(0,g.hitstop-dt);
  g.time=Math.min(RUN_SECONDS,g.time+worldDt);
  if(g.time>=RUN_SECONDS){g.phase='result';g.outcome='victory';emit(g,'victory');return;}
  const p=g.player;
  p.hurt=Math.max(0,p.hurt-dt);p.invincible=Math.max(0,p.invincible-dt);p.guard=Math.max(0,p.guard-dt);p.attack=Math.max(0,p.attack-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  p.signature=Math.max(0,(p.signature||0)-dt);
  p.attackWindup=Math.max(0,(p.attackWindup||0)-dt);
  p.charge=clamp(p.charge+dt*.8,0,100);g.shake=Math.max(0,g.shake-dt*16);
  let x=Number.isFinite(input.x)?clamp(input.x,-1,1):0,y=Number.isFinite(input.y)?clamp(input.y,-1,1):0;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  p.moving=length>.05;if(p.moving){p.fx=x/(Math.hypot(x,y)||1);p.fy=y/(Math.hypot(x,y)||1);if(p.attack<=0)p.aim=Math.atan2(p.fy,p.fx);}
  p.wind=clamp(p.wind+(p.moving?dt:-dt*3),0,3);
  if(p.moving){p.still=0;p.stillGrace=Math.max(0,p.stillGrace-dt);}else{p.still+=dt;if(p.still>=.6)p.stillGrace=.35;}
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
const validContext=c=>c===undefined||(plain(c)&&['weapon','signature','relic'].includes(c.source)&&(c.weapon===undefined||Object.hasOwn(WEAPONS,c.weapon))&&(c.source!=='relic'||Object.hasOwn(RELICS,c.relic)));
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
    if(!plain(g)||!validTree(g)||g.version!==2||!Object.hasOwn(HEROES,g.hero)||g.outcome!==null||g.banked!==false||!['paused','choice','chest','relic'].includes(g.phase))return null;
    g.relics??=createRelics();if(!validRelics(g.relics))return null;
    if(!finite(g.time,0,RUN_SECONDS-.00001)||!integer(g.seed,0,4294967295)||!integer(g.id)||!integer(g.level,1,9999)||!finite(g.xp,0,1e8)||!integer(g.pendingLevels,0,1000))return null;
    if(!integer(g.relics.thread.target,0,g.id))return null;
    g.initialSeed??=g.expedition?.seed??g.seed;if(!integer(g.initialSeed,0,4294967295))return null;
    if(g.runId!==undefined&&(typeof g.runId!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(g.runId)))return null;
    g.runId??=`legacy-${g.hero}-${g.seed}-${g.id}`;
    if(!['hard','finalSpawned','mastered'].every(k=>typeof g[k]==='boolean'))return null;
    for(const key of ['kills','elites','kingKills','gold','peakEnemies','rerolls','banishes','skips','drafts','upgradeMisses'])if(!integer(g[key],0,1e8))return null;
    if(!finite(g.damage,0,1e12)||!timers(g,['spawn','nextSurge','nextElite','wave','shake','hitstop']))return null;
    const p=g.player;
    if(!vector(p)||!finite(p.fx,-1,1)||!finite(p.fy,-1,1)||!finite(p.hp,.0001,1000)||!finite(p.maxHp,1,1000)||p.hp>p.maxHp||typeof p.moving!=='boolean'||!finite(p.charge,0,100)||!timers(p,['hurt','invincible','walk','wind','still','stillGrace','dash','dashCooldown','attack','guard']))return null;
    if(!plain(g.view)||!finite(g.view.width,200,5000)||!finite(g.view.height,200,5000))return null;
    if(!plain(g.boosts)||Object.entries(UPGRADES).some(([id,u])=>!integer(g.boosts[id],0,u.max)))return null;
    if(!plain(g.weapons)||!Object.keys(g.weapons).length||Object.keys(g.weapons).length>SLOT_LIMIT||!plain(g.passives)||Object.keys(g.passives).length>SLOT_LIMIT)return null;
    for(const [id,w] of Object.entries(g.weapons))if(!weaponIds.includes(id)||!plain(w)||!integer(w.rank,1,WEAPONS[id].max)||typeof w.evolved!=='boolean'||!finite(w.clock,-1,20)||(w.evolved&& !WEAPONS[id].union&&w.rank!==WEAPONS[id].max)||(WEAPONS[id].union&&!w.evolved))return null;
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
      enemyIds.add(e.id);
    }
    for(const shot of g.projectiles){
      if(!validContext(shot.context))return null;
      if(!vector(shot)||!['acorn','moon','bee','enemy','seed','bottle','wind'].includes(shot.kind)||!finite(shot.vx,-5000,5000)||!finite(shot.vy,-5000,5000)||!finite(shot.damage,0,1e7)||!finite(shot.life,0,100)||!finite(shot.age,0,100)||!finite(shot.r,0,200)||!integer(shot.pierce,-1,1000)||!Array.isArray(shot.hits)||shot.hits.length>1000||shot.hits.some(id=>!integer(id,1,g.id)))return null;
      if(shot.kind==='bottle'&&(!['tx','ty','ox','oy','fieldRadius','fieldLife'].every(k=>finite(shot[k]))))return null;
    }
    for(const f of g.fields)if(!validContext(f.context)||!vector(f)||!finite(f.r,1,1000)||!finite(f.life,0,100)||!finite(f.tick,-1,100)||!finite(f.damage,0,1e7)||(f.hostile&&!finite(f.warning,-10,10)))return null;
    for(const item of g.pickups){
      if(!vector(item)||!integer(item.id,1,g.id)||!['chest','coin','heal','magnet','relic'].includes(item.type)||(item.type==='chest'&&typeof item.canEvolve!=='boolean'))return null;
      if(item.type==='relic'&&(!Array.isArray(item.deck)||item.deck.length!==6||new Set(item.deck).size!==6||item.deck.some(id=>!Object.hasOwn(RELICS,id))||!['supply','trial','nest'].includes(item.source)))return null;
      if(item.relicId!==undefined&&(item.type!=='heal'||item.relicId!=='seed'||item.amount!==8||!finite(item.expiresAt,0,RUN_SECONDS+16)))return null;
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
    for(const d of g.delayed)if(!validContext(d.context)||!vector(d)||!finite(d.at,0,RUN_SECONDS+10)||!finite(d.r,0,2000)||!finite(d.damage,0,1e7)||!finite(d.knock,0,1000))return null;
    if(g.decoy!==null&&(!vector(g.decoy)||!finite(g.decoy.life,0,3)))return null;
    if(!plain(g.metrics)||!integer(g.metrics.chests)||!integer(g.metrics.signatures)||!finite(g.metrics.damageTaken,0,1e9)||['firstLevelAt','firstEvolutionAt','firstUnionAt'].some(k=>g.metrics[k]!==null&&!finite(g.metrics[k],0,g.time)))return null;
    if(g.phase==='choice'){
      if(g.pendingLevels<1||!g.choices.length||new Set(g.choices.map(c=>c.id)).size!==g.choices.length)return null;
      const valid=upgradeCandidates(g);if(g.choices.some(c=>!plain(c)||!valid.some(v=>v.id===c.id&&v.kind===c.kind)))return null;
    }else if(g.choices.length)return null;
    if(g.phase==='chest'){
      if(!plain(g.chest)||!integer(g.chest.gold,0,10000)||!Array.isArray(g.chest.options)||!Array.isArray(g.chest.rewards)||typeof g.chest.canEvolve!=='boolean')return null;
      const options=chestCandidates(g),available=new Set(options.map(o=>o.id));
      if(g.chest.options.length>10||g.chest.options.some(o=>!plain(o)||!available.has(o.id))||(g.chest.options.length&&!g.chest.canEvolve))return null;
      if(g.chest.rewards.length>3||g.chest.rewards.some(r=>!plain(r)||!weaponIds.includes(r.id)||!g.weapons[r.id]||typeof r.evolved!=='boolean'))return null;
      // Reconstruct labels and requirements from trusted content, not save text.
      g.chest.options=options.filter(o=>g.chest.options.some(saved=>saved.id===o.id));
    }else if(g.chest!==undefined&&g.chest!==null)return null;
    if(g.expedition)g.expedition.milestones??={};
    g.feedback??={nextImpactAt:0,killWindowAt:0,killCount:0,nextCrowdAt:0};
    g.gems=new Map(g.gems);g.events=[];g.stats=deriveStats(g);return g;
  }catch{return null;}
}
