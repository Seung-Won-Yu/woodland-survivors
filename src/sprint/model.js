// A separate, deterministic two-minute combat loop. No expedition/forge rules.
export const RULES = Object.freeze({duration:120, branchAt:7, evolveAt:50, bossAt:90, maxEnemies:160});
export const PATHS = {
 pierce:{name:'관통 사수',verb:'앞을 뚫어라',skill:'숲길 관통',color:'#f5c979'},
 trail:{name:'씨앗 덫꾼',verb:'지나온 길로 유인하라',skill:'연쇄 기폭',color:'#a8e2bd'}
};
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function random(seed){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createSprint(seed=Date.now()>>>0){
 const s={seed:seed>>>0,rng:random(seed),phase:'playing',t:0,path:null,evolution:null,choice:null,
 player:{x:0,y:0,fx:1,fy:0,aim:0,walk:0,moving:false,attack:0,attackWindup:0,hurt:0,hp:100,maxHp:100,invuln:0,dash:0,dashCd:0,skillCd:0,straight:0},
 enemies:[],shots:[],mines:[],gems:[],effects:[],numbers:[],events:[],id:0,spawnClock:0,shotClock:.15,mineDistance:0,level:1,xp:0,combo:0,comboClock:0,
 kills:0,bestCombo:0,boss:null,bossSpawned:false,pendingWin:false,result:null,shake:0,hitstop:0,impactCd:0,wave:0,
 stats:{pierceHits:0,multiShots:0,trapKills:0,trapsLaid:0,trapsTriggered:0,skillUses:0,dashes:0,bossDamage:0},notice:''};
 for(let i=0;i<10;i++)spawnEnemy(s,'shroom',TAU*i/10,220+(i%3)*34);
 return s;
}
function event(s,type){s.events.push(type);}
export function takeEvents(s){return s.events.splice(0);}
function effect(s,type,x,y,extra={}){s.effects.push({type,x,y,age:0,life:.45,...extra});if(s.effects.length>180)s.effects.shift();}
export function pauseSprint(s){if(s.phase!=='playing')return false;s.phase='paused';return true;}
export function resumeSprint(s){if(s.phase!=='paused')return false;s.phase='playing';return true;}
export function chooseSprint(s,key){
 if(s.phase!=='choice')return false;
 if(s.choice==='path'){
  if(!PATHS[key])return false;s.path=key;s.player.skillCd=0;
 }else{
  if(!['crowd','focus'].includes(key))return false;s.evolution=key;s.player.hp=Math.min(100,s.player.hp+40);s.player.skillCd=0;
 }
 s.phase='playing';s.choice=null;s.shotClock=0;event(s,'forge-evolve');effect(s,'growth',s.player.x,s.player.y,{life:1.1,r:180});
 if(s.evolution){for(const e of s.enemies)if(!e.dead&&distance(e,s.player)<190)damageEnemy(s,e,85,'growth');}
 // A free first cast makes the new weapon visible before another cooldown.
 if(s.path==='trail'){
  for(let i=0;i<4;i++){const a=i*TAU/4;layMine(s,s.player.x+Math.cos(a)*65,s.player.y+Math.sin(a)*65);}
 }else fireVolley(s,true);
 return true;
}
function finish(s,won,reason){if(s.phase==='result')return;s.phase='result';s.result={won,reason,time:s.t,kills:s.kills,bestCombo:s.bestCombo,path:s.path,evolution:s.evolution,stats:{...s.stats}};event(s,won?'boss-defeated':'hurt');}
export function spawnEnemy(s,type='shroom',angle=s.rng()*TAU,radius=370+s.rng()*70){
 if(s.enemies.filter(e=>!e.dead).length>=RULES.maxEnemies)return null;
 const p=s.player,late=s.t>=50,runner=type==='runner',boss=type==='king',hp=boss?1440:runner?(late?30:21):(late?39:22);
 const e={id:++s.id,type,x:p.x+Math.cos(angle)*radius,y:p.y+Math.sin(angle)*radius,px:0,py:0,
 hp,maxHp:hp,r:boss?39:runner?15:17,speed:boss?46:runner?112:65+s.rng()*15,damage:boss?18:runner?6:5,
 age:0,walk:0,fx:1,hurt:0,slow:0,dead:false,mode:'walk',timer:boss?1.7:0,hitIds:new Set(),bossRole:boss?'final':null};
 e.px=e.x;e.py=e.y;s.enemies.push(e);return e;
}
function aimTarget(s){
 const p=s.player,dir=Math.atan2(p.fy,p.fx);let best=null,score=Infinity;
 for(const e of s.enemies){if(e.dead)continue;const d=distance(e,p),a=Math.atan2(e.y-p.y,e.x-p.x),alignment=Math.cos(a-dir);
  const cost=d+(s.path==='pierce'&&p.moving?Math.max(0,.5-alignment)*280:0);
  if(cost<score){score=cost;best=e;}
 }
 return best;
}
function shoot(s,angle,damage,pierce,speed=650,wide=0){
 const p=s.player;s.shots.push({id:++s.id,x:p.x+Math.cos(angle)*27,y:p.y+Math.sin(angle)*27,px:p.x,py:p.y,
 vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle,damage,pierce,hits:new Set(),life:.83,wide,empowered:pierce>2});
}
function fireVolley(s,free=false){
 const p=s.player,target=aimTarget(s);if(!target)return;
 p.aim=Math.atan2(target.y-p.y,target.x-p.x);p.attack=.19;
 const grown=!!s.evolution,power=1+(s.level-1)*.085;
 if(s.path==='pierce'){
  const charge=p.straight>.45,lanes=grown&&s.evolution==='crowd'?[-.14,0,.14]:[-.035,.035];
  for(const offset of lanes)shoot(s,p.aim+offset,(grown?30:18)*power,charge?7:4,charge?800:650,grown?5:3);
 }else shoot(s,p.aim,(grown?19:16)*power,1,570,0);
 if(!free)event(s,s.path==='pierce'?'scatter-shot':'acorn-shot');
}
function layMine(s,x,y){
 const max=s.evolution==='crowd'?15:s.evolution?10:9;
 const active=s.mines.filter(m=>!m.spent);if(active.some(m=>Math.hypot(m.x-x,m.y-y)<44))return false;
 if(active.length>=max){const old=active[0];old.spent=true;effect(s,'seed-fade',old.x,old.y,{life:.25});}
 s.mines.push({id:++s.id,x,y,age:0,life:10,spent:false,queue:null});s.stats.trapsLaid++;return true;
}
function triggerMine(s,m,manual=false){
 if(m.spent)return;m.spent=true;s.stats.trapsTriggered++;
 const radius=s.evolution==='crowd'?104:s.evolution?90:78,damage=(s.evolution?62:34)*(1+(s.level-1)*.06);
 effect(s,'blast',m.x,m.y,{r:radius,life:.48});event(s,'wood-impact');
 for(const e of s.enemies){if(e.dead||distance(e,m)>radius+e.r)continue;e.slow=.8;damageEnemy(s,e,damage*(e.type==='king'?1.6:1),'trap');
  if(e.type==='king'&&s.evolution==='focus')effect(s,'echo',m.x,m.y,{r:radius,life:.72,pending:true,damage:damage*1.15});
 }
 if(s.evolution==='crowd'||manual)for(const next of s.mines)if(!next.spent&&next.queue===null&&distance(next,m)<180)next.queue=.075;
}
export function sprintAction(s,action){
 if(s.phase!=='playing')return false;const p=s.player;
 if(action==='dash'){
  if(p.dashCd>0)return false;p.dash=.2;p.invuln=.3;p.dashCd=2.1;s.stats.dashes++;event(s,'whoosh');effect(s,'dash',p.x,p.y,{life:.3,angle:Math.atan2(p.fy,p.fx)});return true;
 }
 if(action!=='skill'||!s.path||p.skillCd>0)return false;
 if(s.path==='trail'){
  const active=s.mines.filter(m=>!m.spent);if(!active.length)return false;
  active.forEach((m,i)=>{m.queue=Math.min(m.queue??Infinity,i*.055);});p.skillCd=3.4;event(s,'burst');
 }else{
  const target=aimTarget(s),angle=p.moving?Math.atan2(p.fy,p.fx):target?Math.atan2(target.y-p.y,target.x-p.x):p.aim;
  p.aim=angle;p.attack=.23;p.skillCd=4.2;
  const grown=!!s.evolution;
  for(const offset of [-.16,-.08,0,.08,.16])shoot(s,angle+offset,grown?76:42,20,950,9);
  effect(s,'muzzle',p.x+Math.cos(angle)*28,p.y+Math.sin(angle)*28,{angle,life:.2});event(s,'burst');s.shake=Math.max(s.shake,4);
 }
 s.stats.skillUses++;return true;
}
function damageEnemy(s,e,amount,source){
 if(e.dead)return;
 if(e.type==='king'){
  if(source==='shot')amount*=.28;
  if(e.mode==='recover')amount*=1.5;
  if(s.evolution==='focus'&&source==='shot')amount*=1.75;
  s.stats.bossDamage+=Math.min(e.hp,amount);
 }
 e.hp-=amount;e.hurt=.13;
 if(s.numbers.length<40&&(e.type==='king'||amount>=40))s.numbers.push({x:e.x,y:e.y-45,n:Math.round(amount),age:0,life:.65,big:amount>=70});
 if(e.hp>0){event(s,'wood-impact');return;}
 e.dead=true;e.deadLife=.28;s.kills++;s.combo++;s.comboClock=1.8;s.bestCombo=Math.max(s.bestCombo,s.combo);
 if(source==='trap')s.stats.trapKills++;
 effect(s,'kill',e.x,e.y,{life:.35,r:e.r});
 if(e.type==='king'){s.pendingWin=true;return;}
 s.gems.push({x:e.x,y:e.y,value:e.type==='runner'?2:1,age:0});
 if(s.gems.length>160){const old=s.gems.shift();gainXp(s,old.value);}
 event(s,'wood-kill');
 if(s.combo%8===0){if(s.impactCd<=0){s.impactCd=.65;s.hitstop=.035;s.shake=Math.max(s.shake,3);event(s,'crowd-break');}}
}
function gainXp(s,amount){s.xp+=amount;const cost=8+s.level*5;if(s.xp<cost)return;s.xp-=cost;s.level++;s.player.hp=Math.min(100,s.player.hp+2);event(s,'level');effect(s,'level',s.player.x,s.player.y,{life:.7,text:`성장 ${s.level}`,r:90});}
function damagePlayer(s,e){
 const p=s.player;if(p.invuln>0||p.dash>0||e.dead)return;p.hp=Math.max(0,p.hp-e.damage);p.invuln=1.05;p.hurt=.3;s.shake=6;event(s,'hurt');
 const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;p.x+=dx/d*19;p.y+=dy/d*19;
 if(p.hp<=0)finish(s,false,'hp');
}
function updateBoss(s,e,dt){
 const p=s.player;e.timer-=dt;
 if(e.mode==='windup'){
  if(e.timer<=0){e.mode='charge';e.timer=.5;event(s,'boss-charge');}
 }else if(e.mode==='charge'){
  e.x+=Math.cos(e.chargeAngle)*560*dt;e.y+=Math.sin(e.chargeAngle)*560*dt;
  if(e.timer<=0){e.mode='recover';e.timer=1.85;event(s,'boss-warning');effect(s,'opening',e.x,e.y-115,{life:1.5,text:'지금! 피해 ×1.5'});}
 }else if(e.mode==='recover'){
  if(e.timer<=0){e.mode='walk';e.timer=1.1;}
 }else{
  const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;
  if(e.timer<=0){e.mode='windup';e.timer=.95;e.chargeAngle=Math.atan2(p.y-e.y,p.x-e.x);e.windup=.95;event(s,'boss-warning');}
 }
 e.windup=e.mode==='windup'?e.timer:0;e.recover=e.mode==='recover'?e.timer:0;
}
export function stepSprint(s,dt,input={x:0,y:0}){
 if(s.phase!=='playing')return;dt=clamp(dt,0,.05);if(!dt)return;
 if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);return;}
 s.t+=dt;const p=s.player;s.impactCd=Math.max(0,s.impactCd-dt);s.shake=Math.max(0,s.shake-dt*25);
 if(!s.path&&s.t>=RULES.branchAt){s.phase='choice';s.choice='path';event(s,'level');return;}
 if(!s.evolution&&s.t>=RULES.evolveAt){s.phase='choice';s.choice='evolution';event(s,'level');return;}
 if(!s.bossSpawned&&s.t>=RULES.bossAt){
  s.bossSpawned=true;s.boss=spawnEnemy(s,'king',Math.atan2(p.fy,p.fx),285);
  // Always reserve a boss slot even when the horde cap was reached.
  if(!s.boss){const victim=s.enemies.find(e=>!e.dead);victim.dead=true;victim.deadLife=.1;s.boss=spawnEnemy(s,'king',0,285);}
  p.hp=Math.min(100,p.hp+18);effect(s,'announcement',p.x,p.y-135,{life:2,text:'큰뿔 수문장'});event(s,'boss-arrival');
 }
 if(s.t>=RULES.duration){s.t=RULES.duration;finish(s,false,'time');return;}
 for(const key of ['attack','hurt','invuln','dash','dashCd','skillCd'])p[key]=Math.max(0,p[key]-dt);
 const rawX=Number.isFinite(input.x)?input.x:0,rawY=Number.isFinite(input.y)?input.y:0,len=Math.hypot(rawX,rawY),force=Math.min(1,len),dx=rawX/(len||1),dy=rawY/(len||1);
 p.moving=len>.05||p.dash>0;
 if(len>.05){const align=dx*p.fx+dy*p.fy;p.straight=align>.94?p.straight+dt:0;p.fx=dx;p.fy=dy;}else p.straight=0;
 const moved=(p.dash>0?680:205*force)*dt;
 if(p.moving){p.x+=p.fx*moved;p.y+=p.fy*moved;p.walk+=moved;s.mineDistance+=moved;}
 const edge=Math.hypot(p.x,p.y);if(edge>800){p.x=p.x/edge*800;p.y=p.y/edge*800;}
 if(s.path==='trail'&&s.mineDistance>=57){if(layMine(s,p.x-p.fx*23,p.y-p.fy*23))s.mineDistance=0;else s.mineDistance=Math.min(s.mineDistance,70);}
 s.shotClock-=dt;if(s.shotClock<=0){fireVolley(s);s.shotClock=(s.path==='pierce'?(s.evolution?.36:.58):(s.path?.65:.48))/Math.min(1.35,1+(s.level-1)*.035);}
 s.spawnClock-=dt;
 if(s.spawnClock<=0){
  const count=s.bossSpawned?3:s.t>=50?6:2;
  for(let i=0;i<count;i++)spawnEnemy(s,s.rng()<(s.t>35?.27:.12)?'runner':'shroom');
  s.spawnClock=s.bossSpawned?5.3:s.t>=50?.28:s.t>25?.48:.72;
 }
 // A visible advance marker precedes each flank group, never a contact spawn.
 const nextWave=Math.floor((s.t-18)/16);
 if(!s.bossSpawned&&nextWave>=0&&nextWave>s.wave){s.wave=nextWave;const a=Math.atan2(p.fy,p.fx)+(nextWave%2?1:-1)*.65;
  const x=p.x+Math.cos(a)*245,y=p.y+Math.sin(a)*245;effect(s,'reinforce',x,y,{life:1.4,pending:true,angle:a});event(s,'horde');}
 for(const e of s.enemies){
  if(e.dead){e.deadLife-=dt;continue;}e.px=e.x;e.py=e.y;e.age+=dt;e.hurt=Math.max(0,e.hurt-dt);e.slow=Math.max(0,e.slow-dt);
  if(e.type==='king')updateBoss(s,e,dt);else{
   const ex=p.x-e.x,ey=p.y-e.y,d=Math.hypot(ex,ey)||1,speed=e.speed*(e.slow>0?.5:1);e.x+=ex/d*speed*dt;e.y+=ey/d*speed*dt;
  }
  e.fx=p.x<e.x?-1:1;e.walk+=Math.hypot(e.x-e.px,e.y-e.py);
  if(segmentDistance(p.x,p.y,e.px,e.py,e.x,e.y)<e.r+12)damagePlayer(s,e);
 }
 if(s.phase==='result')return;
 // Light separation gives mobs readable silhouettes without stopping the horde.
 for(let i=0;i<s.enemies.length;i++){const a=s.enemies[i];if(a.dead||a.type==='king')continue;
  for(let j=i+1;j<s.enemies.length;j++){const b=s.enemies[j];if(b.dead||b.type==='king')continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),gap=(a.r+b.r)*.75;
   if(d<gap&&d>.01){const push=(gap-d)*.17;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;}
  }
 }
 for(const shot of s.shots){
  shot.px=shot.x;shot.py=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
  for(const e of s.enemies){
   if(e.dead||shot.hits.has(e.id)||segmentDistance(e.x,e.y,shot.px,shot.py,shot.x,shot.y)>e.r+5+shot.wide)continue;
   shot.hits.add(e.id);damageEnemy(s,e,shot.damage,'shot');s.stats.pierceHits++;
   if(shot.hits.size===3){s.stats.multiShots++;if(s.evolution==='crowd'&&s.path==='pierce'){
    effect(s,'pierce-burst',e.x,e.y,{r:66,life:.3});for(const nearby of s.enemies)if(!nearby.dead&&distance(nearby,e)<66)damageEnemy(s,nearby,22,'shot');
   }}
   effect(s,'hit',e.x,e.y-24,{angle:shot.angle,life:.14});
   if(shot.hits.size>=shot.pierce){shot.life=0;break;}
  }
 }
 for(const m of s.mines){if(m.spent)continue;m.age+=dt;m.life-=dt;
  if(m.life<=0){m.spent=true;continue;}
  if(m.queue!==null){m.queue-=dt;if(m.queue<=0)triggerMine(s,m,true);}
  else if(m.age>.18&&s.enemies.some(e=>!e.dead&&segmentDistance(m.x,m.y,e.px,e.py,e.x,e.y)<e.r+36))triggerMine(s,m);
 }
 for(const g of s.gems){g.age+=dt;const d=distance(p,g);if(d<125||g.age>8){const pull=(300+g.age*20)*dt;g.x+=(p.x-g.x)/(d||1)*Math.min(d,pull);g.y+=(p.y-g.y)/(d||1)*Math.min(d,pull);}
  if(d<24){gainXp(s,g.value);g.collected=true;event(s,'xp');}}
 for(const f of s.effects){f.age+=dt;if(f.pending&&f.type==='echo'&&f.age>=.45){f.pending=false;effect(s,'blast',f.x,f.y,{r:f.r,life:.35});for(const e of s.enemies)if(!e.dead&&distance(e,f)<f.r+e.r)damageEnemy(s,e,f.damage,'trap');}
  if(f.pending&&f.type==='reinforce'&&f.age>=1.2){f.pending=false;for(let i=0;i<(s.t>=50?18:10);i++){const e=spawnEnemy(s,i%3?'shroom':'runner',f.angle,245);if(e){e.x=f.x+Math.cos(f.angle+Math.PI/2)*(i-(s.t>=50?8.5:4.5))*20;e.y=f.y+Math.sin(f.angle+Math.PI/2)*(i-(s.t>=50?8.5:4.5))*20;e.px=e.x;e.py=e.y;}}}}
 for(const n of s.numbers)n.age+=dt;
 s.comboClock-=dt;if(s.comboClock<=0)s.combo=0;
 s.enemies=s.enemies.filter(e=>e.dead?e.deadLife>0:e.type==='king'||distance(e,p)<1000);
 s.shots=s.shots.filter(o=>o.life>0).slice(-160);s.mines=s.mines.filter(m=>!m.spent);s.gems=s.gems.filter(g=>!g.collected);
 s.effects=s.effects.filter(f=>f.age<f.life);s.numbers=s.numbers.filter(n=>n.age<n.life);
 if(s.pendingWin){s.pendingWin=false;finish(s,true,'warden');}
}
