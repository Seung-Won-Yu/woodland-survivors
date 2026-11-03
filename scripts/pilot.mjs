import {pathToFileURL} from 'node:url';
import {createExpedition,interact,takeSupply,updateExpedition} from '../src/game/expedition.js';
import {stepGame,applyChoice,closeChest,selectChest} from '../src/core/game.js';
import {WEAPONS} from '../src/core/content.js';
const route=[[-520,-130],[-540,-540],[-100,-550],[520,-360],[800,-360],[800,-780],[100,-980],[-600,-850],[-800,-100],[-450,120],[0,100],[160,310],[100,510],[-100,750],[460,760],[800,150],[700,-300]];
export function pilot({hero='pip',seed=1437,seconds=215}={}){
 const g=createExpedition(hero,undefined,seed),start=g.startWeapon;let waypoint=0,supply=false,nestActivated=false,firstSupply=null,phaseCounts={},steps=0;
 for(let frame=0;frame<seconds*60+5000&&g.time<seconds&&g.phase!=='result';frame++){
  if(g.phase==='choice'){
   const score=c=>c.id===start?100:c.kind==='weapon'&&g.weapons[c.id]?45:c.id==='briar'?70:c.id==='bloom'?55:c.id===WEAPONS[start].recipe?50:c.id==='bark'?40:c.id==='feather'?35:c.kind==='weapon'?20:10;
   const ranked=g.choices.map((c,i)=>({i,score:score(c)})).sort((a,b)=>b.score-a.score);applyChoice(g,ranked[0].i);continue;
  }
  if(g.phase==='supply'){takeSupply(g,'boots');supply=true;firstSupply??=g.time;waypoint=1;continue;}
  if(g.phase==='chest'){if(g.chest.options.length)selectChest(g,g.chest.options[0].id);closeChest(g);continue;}
  const p=g.player,returning=g.time>=180,target=returning?[0,70]:route[waypoint%route.length];
  if(returning&&Math.hypot(p.x,p.y-70)<68){interact(g);continue;}
  if(!returning&&Math.hypot(p.x-target[0],p.y-target[1])<55){
   if(waypoint===0){interact(g);continue;}
   if(waypoint===3){interact(g);nestActivated=true;}
   if(waypoint===12&&p.hp<70)interact(g);
   waypoint++;
  }
  const next=returning?[0,70]:route[waypoint%route.length],desired=Math.atan2(next[1]-p.y,next[0]-p.x);
  let best={score:Infinity,x:0,y:0};
  for(let i=-4;i<=4;i++){
   const a=desired+i*Math.PI/8,x=Math.cos(a),y=Math.sin(a),px=p.x+x*45,py=p.y+y*45;
   let score=Math.hypot(next[0]-px,next[1]-py)*.12+Math.abs(i)*.3;
   for(const r of g.terrain){const d=Math.hypot(px-r.x,py-r.y);if(d<r.r*.78+20)score+=500;}
   for(const e of g.enemies){const d=Math.hypot(px-e.x,py-e.y);if(d<85)score+=(85-d)*1.6;}
   for(const gem of g.gems.values()){const d=Math.hypot(px-gem.x,py-gem.y);if(d<80)score-=Math.min(1.5,gem.value*.15)*(1-d/80);}
   if(score<best.score)best={score,x,y};
  }
  stepGame(g,1/60,{x:best.x,y:best.y,skill:p.charge>=100,dash:false});updateExpedition(g);g.events=[];steps++;
  for(const e of g.enemies)phaseCounts[e.type+':'+e.mode]=(phaseCounts[e.type+':'+e.mode]||0)+1;
 }
 return {hero,seed,elapsed:Math.round(g.time*10)/10,hp:Math.round(g.player.hp),level:g.level,kills:g.kills,damage:Math.round(g.damage),supply,firstSupply,firstLevelAt:g.metrics.firstLevelAt,firstEvolutionAt:g.metrics.firstEvolutionAt,nestActivated,nest:g.expedition.sites.find(s=>s.id==='nest').state,weapons:g.weapons,evolutions:g.evolutions,phaseCounts,steps,waypoint,outcome:g.outcome};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){console.log(JSON.stringify(['pip','lune','bram','fox','mole','otter'].map(hero=>pilot({hero})),null,2));}
