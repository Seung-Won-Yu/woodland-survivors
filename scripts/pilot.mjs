import {pathToFileURL} from 'node:url';
import {createExpedition,interact,takeSupply,updateExpedition} from '../src/game/expedition.js';
import {stepGame,applyChoice,closeChest,selectChest} from '../src/core/game.js';
import {WEAPONS} from '../src/core/content.js';
import {LANDMARKS} from '../src/game/terrain.js';
const point=id=>[LANDMARKS[id].x,LANDMARKS[id].y];
const route=[point('supply'),[-710,-560],[-260,-660],point('nest'),[950,-360],[920,-780],[100,-980],[-600,-850],[-950,-100],[-450,120],[0,100],[260,310],point('spring'),[-100,850],[460,850],[900,150],[800,-300]];
export function pilot({hero='pip',seed=1437,seconds=215,takeNest=true,view=null}={}){
 const g=createExpedition(hero,undefined,seed),start=g.startWeapon;let waypoint=0,supply=false,nestActivated=false,firstSupply=null,phaseCounts={},steps=0,dashes=0,choices=[],samples=[];
 if(view)g.view={...view};
 for(let frame=0;frame<seconds*60+5000&&g.time<seconds&&g.phase!=='result';frame++){
  if(g.phase==='choice'){
   const close=['briar','bloom','vine'],weapons=Object.keys(g.weapons);
   const score=c=>c.kind==='weapon'&&!c.owned&&weapons.length===1?120+(close.includes(start)!==close.includes(c.id)?10:0):c.id===start?100:c.kind==='weapon'&&c.owned?45:c.id===WEAPONS[start].recipe?50:c.id==='bark'?40:c.id==='feather'?35:c.kind==='weapon'?20:10;
   const ranked=g.choices.map((c,i)=>({i,score:score(c)})).sort((a,b)=>b.score-a.score);choices.push({time:Math.round(g.time*10)/10,id:g.choices[ranked[0].i].id});applyChoice(g,ranked[0].i);continue;
  }
  if(g.phase==='supply'){takeSupply(g,'boots');supply=true;firstSupply??=g.time;waypoint=1;continue;}
  if(g.phase==='chest'){if(g.chest.options.length)selectChest(g,g.chest.options[0].id);closeChest(g);continue;}
  const p=g.player,returning=g.time>=180,target=returning?point('camp'):route[waypoint%route.length];
  if(returning&&Math.hypot(p.x,p.y-70)<68){interact(g);continue;}
  if(!returning&&Math.hypot(p.x-target[0],p.y-target[1])<55){
   if(waypoint===0){if(g.expedition.sites.find(s=>s.id==='supply').state==='ready'&&interact(g))continue;}
   else{
    if(waypoint===3&&takeNest&&g.time>=50){nestActivated=interact(g)||nestActivated;}
    if(waypoint===12&&p.hp<70)interact(g);
    if(waypoint!==3||!takeNest||g.time>=50)waypoint++;
   }
  }
  let next=returning?point('camp'):route[waypoint%route.length];
  const guards=g.enemies.filter(e=>e.supplyGuard&&!e.dead);
  if(!returning&&waypoint===0&&guards.length&&Math.hypot(p.x-target[0],p.y-target[1])<230){
   const guard=guards.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],a=Math.atan2(p.y-guard.y,p.x-guard.x);next=[guard.x+Math.cos(a+.3)*67,guard.y+Math.sin(a+.3)*67];
  }
  const nest=g.expedition.sites.find(s=>s.id==='nest'),reward=g.pickups.find(item=>item.type==='chest'&&item.source==='nest');
  if(!returning&&reward)next=[reward.x,reward.y];
  else if(!returning&&nest.state==='active'){
   const guardian=g.enemies.find(e=>e.nestGuardian);if(guardian){const a=Math.atan2(p.y-guardian.y,p.x-guardian.x)+.25,r=['briar','bloom','vine'].includes(start)?85:155;next=[guardian.x+Math.cos(a)*r,guardian.y+Math.sin(a)*r];}
  }else if(!returning&&takeNest&&waypoint===3&&g.time<50){const a=g.time*.25;next=[nest.x+Math.cos(a)*220,nest.y+Math.sin(a)*180];}
  const spring=g.expedition.sites.find(s=>s.id==='spring');
  if(!returning&&waypoint>0&&nest.state!=='active'&&!reward){
   const gem=[...g.gems.values()].filter(gem=>Math.hypot(gem.x-p.x,gem.y-p.y)<230).sort((a,b)=>b.value/(30+Math.hypot(b.x-p.x,b.y-p.y))-a.value/(30+Math.hypot(a.x-p.x,a.y-p.y)))[0];
   if(gem&&(g.time<50||nestActivated||!takeNest))next=[gem.x,gem.y];
   if(spring.state==='ready'&&p.hp<p.maxHp*.6){next=point('spring');if(Math.hypot(p.x-spring.x,p.y-spring.y)<65)interact(g);}
  }
  if(!returning&&takeNest&&!nestActivated&&g.time>=55){next=point('nest');if(Math.hypot(p.x-nest.x,p.y-nest.y)<65){nestActivated=interact(g);if(nestActivated)waypoint=4;}}
  const desired=Math.atan2(next[1]-p.y,next[0]-p.x);
  let best={score:Infinity,x:0,y:0};
  for(let i=-4;i<=4;i++){
   const a=desired+i*Math.PI/8,x=Math.cos(a),y=Math.sin(a),px=p.x+x*45,py=p.y+y*45;
   let score=Math.hypot(next[0]-px,next[1]-py)*.12+Math.abs(i)*.3;
   for(const r of g.terrain){const d=Math.hypot(px-r.x,py-r.y);if(d<r.r*.78+20)score+=500;}
   for(const e of g.enemies){const d=Math.hypot(px-e.x,py-e.y),reach=e.r+27;if(d<reach)score+=(reach-d)*4;
    const safe=(waypoint===0||nest.state==='active')&&['briar','bloom','vine'].includes(start)?60:85;if(d<safe)score+=(safe-d)*1.3;
    if(['windup','charge'].includes(e.mode)&&e.type==='runner'){const along=(px-e.x)*e.dx+(py-e.y)*e.dy,across=Math.abs((px-e.x)*e.dy-(py-e.y)*e.dx);if(along>0&&along<150&&across<35)score+=(35-across)*3;}
   }
   for(const q of g.projectiles)if(q.hostile){const d=Math.hypot(px-q.x-q.vx*.2,py-q.y-q.vy*.2);if(d<32)score+=(32-d)*3;}
   for(const f of g.fields)if(f.hostile){const d=Math.hypot(px-f.x,py-f.y);if(d<f.r+25)score+=(f.r+25-d)*3;}
   for(const gem of g.gems.values()){const d=Math.hypot(px-gem.x,py-gem.y);if(d<80)score-=Math.min(1.5,gem.value*.15)*(1-d/80);}
   if(score<best.score)best={score,x,y};
  }
  const danger=g.enemies.some(e=>e.mode==='charge'&&Math.hypot(p.x-e.x,p.y-e.y)<100)||g.projectiles.some(q=>q.hostile&&Math.hypot(p.x-q.x,p.y-q.y)<35),dash=danger&&p.dashCooldown<=0;if(dash)dashes++;
  stepGame(g,1/60,{x:best.x,y:best.y,skill:p.charge>=100,dash});updateExpedition(g);g.events=[];steps++;
  if(g.time>=(samples.length+1)*30)samples.push({time:Math.round(g.time),level:g.level,hp:Math.round(p.hp),kills:g.kills,xpDropped:g.metrics.xpDropped,xpCollected:g.metrics.xpCollected,damageTaken:Math.round(g.metrics.damageTaken),damageBySource:{...g.metrics.damageBySource},x:Math.round(p.x),y:Math.round(p.y),weapons:Object.fromEntries(Object.entries(g.weapons).map(([id,w])=>[id,{rank:w.rank,evolved:w.evolved}]))});
  for(const e of g.enemies)phaseCounts[e.type+':'+e.mode]=(phaseCounts[e.type+':'+e.mode]||0)+1;
 }
 return {hero,seed,takeNest,elapsed:Math.round(g.time*10)/10,hp:Math.round(g.player.hp),level:g.level,kills:g.kills,damage:Math.round(g.damage),supply,firstSupply,firstLevelAt:g.metrics.firstLevelAt,firstEvolutionAt:g.metrics.firstEvolutionAt,nestActivated,nest:g.expedition.sites.find(s=>s.id==='nest').state,milestones:g.expedition.milestones,choices,dashes,damageTaken:Math.round(g.metrics.damageTaken),xpDropped:g.metrics.xpDropped,xpCollected:g.metrics.xpCollected,xpRemaining:[...g.gems.values(),...g.flying].reduce((sum,gem)=>sum+gem.value,0),blockedSeconds:Math.round(g.metrics.blockedSeconds*10)/10,damageBySource:g.metrics.damageBySource,samples,weapons:g.weapons,evolutions:g.evolutions,phaseCounts,steps,waypoint,outcome:g.outcome};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){console.log(JSON.stringify(['pip','lune','bram','fox','mole','otter'].map(hero=>pilot({hero})),null,2));}
