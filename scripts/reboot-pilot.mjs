// Normal-input model pilot. It never edits HP, gear, XP, world time or RNG.
import {pathToFileURL} from 'node:url';
import {createRun,step,choose,action,assemblyOptions,interaction,reroll,banish,banishOptions} from '../src/reboot/model.js';
import {moduleRank,distance,compatible} from '../src/reboot/content.js';
function free(s,x,y){return x>=60&&x<=1540&&y>=60&&y<=1140&&!s.blocks.some(b=>b.hp!==0&&x+22>b.x&&x-22<b.x+b.w&&y+22>b.y&&y-22<b.y+b.h);}
function path(s,goal){
 const start=[Math.round((s.player.x-60)/40),Math.round((s.player.y-60)/40)],end=[Math.round((goal.x-60)/40),Math.round((goal.y-60)/40)],key=([x,y])=>`${x},${y}`;
 const queue=[start],previous=new Map([[key(start),null]]);let found=start,best=Infinity;
 for(let i=0;i<queue.length;i++){const p=queue[i],d=Math.hypot(p[0]-end[0],p[1]-end[1]);if(d<best){best=d;found=p;}if(d<.8){found=p;break;}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q=[p[0]+dx,p[1]+dy],k=key(q);if(previous.has(k)||!free(s,q[0]*40+60,q[1]*40+60))continue;previous.set(k,p);queue.push(q);}}
 const route=[];for(let p=found;p&&key(p)!==key(start);p=previous.get(key(p)))route.unshift({x:p[0]*40+60,y:p[1]*40+60});return route;
}
function movement(s,goal,ctx,avoid=true){
 const cell=`${Math.round(goal.x/40)},${Math.round(goal.y/40)}`;if(!ctx.path||ctx.goal!==cell||s.t>ctx.pathAt+1){ctx.path=path(s,goal);ctx.goal=cell;ctx.pathAt=s.t;}
 while(ctx.path.length&&distance(ctx.path[0],s.player)<32)ctx.path.shift();const q=ctx.path[0]||goal;let x=q.x-s.player.x,y=q.y-s.player.y;const len=Math.hypot(x,y)||1;x/=len;y/=len;
 if(avoid)for(const e of s.enemies){if(e.dead)continue;const d=distance(e,s.player);if(d<80&&d>0){x+=(s.player.x-e.x)/d*(80-d)/80*1.5;y+=(s.player.y-e.y)/d*(80-d)/80*1.5;}}
 return{x,y};
}
function priority(s,c,policy){
 if(c.kind==='extract')return 1000;if(c.kind==='stay')return -1;
 if(c.kind==='gun'){if(policy==='fusion'&&c.weapon==='r'&&!s.weapons.some(w=>w.id==='r'))return 140;if(policy==='fire'&&c.weapon==='f'&&!s.weapons.some(w=>w.id==='f'))return 140;return s.weapons.length<3?35:0;}
 if(c.kind==='module'){
  const r=moduleRank(s,c.module);if(policy==='single'&&c.module==='ricochet')return r<2?130:45;
  if(policy==='fusion'&&c.module==='coil')return r<2?135:50;
  if(policy==='fire'&&c.module==='catalyst')return r<2?135:50;
  if(c.module==='overcharger')return 75;if(c.module==='magnet'&&!r)return 24;return 15;
 }
 if(c.kind==='rank'){const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion);if(policy==='single')return c.weapon==='h'?110:30;if(policy==='fusion')return ['h','r'].includes(c.weapon)&&w.level<4?100-w.level:25;if(policy==='fire')return ['h','f'].includes(c.weapon)&&w.level<4?100-w.level:25;}
 if(c.kind==='utility')return c.key==='health'&&s.player.hp<50?70:c.key==='power'?14:10;return 0;
}
export function pilot(seed=17,policy='single',{maxSeconds=360}={}){
 const s=createRun(seed),ctx={};let decisions=0,stalled=null;
 for(let tick=0;tick<maxSeconds*80&&s.t<maxSeconds&&s.phase!=='result';tick++){
  if(s.phase==='choice'){
   const wanted=policy==='fusion'?'coil':policy==='fire'?'catalyst':null;
   if(wanted&&['armory','raid-reward'].includes(s.choice.type)&&compatible(s,wanted)&&!s.choices.some(c=>c.module===wanted)){
    const unwanted=banishOptions(s).find(c=>c.kind==='module'&&c.module!==wanted);if(unwanted){banish(s,unwanted.id);continue;}
   }
   const c=[...s.choices].sort((a,b)=>priority(s,b,policy)-priority(s,a,policy))[0];
   if(['level','armory','raid-reward'].includes(s.choice.type)&&policy!=='single'&&priority(s,c,policy)<70&&s.rerolls>0){reroll(s);continue;}
   if(s.choice.type==='armory'&&s.choice.quality==='common'&&s.player.hp>75&&s.stats.completedBuild&&!s.raidUsed){action(s,'raid:light');continue;}
   const branch=c.weapon==='h'?(policy==='fire'?'grenade':'ricochet'):c.weapon==='r'?'homing':'trail';
   const args={branch,doctrine:'reserve'};if(c.kind==='gun'&&s.weapons.length>=3)args.slot=s.weapons.findIndex(w=>!w.evolved&&!w.fusion);if(c.kind==='module'&&s.modules.length>=4&&!moduleRank(s,c.module))args.slot=0;
   if(!choose(s,c.id,args)){stalled={choice:s.choice,card:c};break;}decisions++;continue;
  }
  const options=assemblyOptions(s),wanted=policy==='single'?options.find(c=>c.kind==='evolve'&&c.weapon==='h'):policy==='fusion'?options.find(c=>c.kind==='fusion'):options.find(c=>c.kind==='tune'&&c.module==='catalyst'&&moduleRank(s,'catalyst')===2&&s.weapons.filter(w=>w.level>=4).length>=2);
  if(wanted){action(s,'gear');choose(s,wanted.id);continue;}
  action(s,'skill');
  if(s.stage==='boss'){
   const b=s.boss,p=s.player;let goal;
   if(b.mode==='recover'){const angles=[Math.PI,Math.PI-.65,Math.PI+.65].map(a=>b.body+a);goal=angles.map(a=>({x:b.x+Math.cos(a)*185,y:b.y+Math.sin(a)*185})).filter(g=>free(s,g.x,g.y)).sort((a,b)=>distance(a,p)-distance(b,p))[0];}
   if(!goal){const a=Math.atan2(p.y-b.y,p.x-b.x)+.7;goal={x:b.x+Math.cos(a)*220,y:b.y+Math.sin(a)*220};goal.x=Math.max(80,Math.min(1520,goal.x));goal.y=Math.max(80,Math.min(1120,goal.y));}
   if(b.mode==='windup'&&b.timer<.25)action(s,'dash');step(s,1/60,movement(s,goal,ctx,false));continue;
  }
  if(s.raid?.state==='active'){step(s,1/60,movement(s,s.raid.target,ctx));continue;}
  if(s.stage==='holdout'){if(interaction(s)?.id==='extract'){action(s,'interact');continue;}step(s,1/60,movement(s,{x:800,y:420},ctx));continue;}
  const sites=s.sites.filter(n=>n.state!=='done'),target=sites[0];
  if(!target&&!s.stats.completedBuild&&s.t<130){const gem=[...s.gems].sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0],goal=gem||{x:800+Math.cos(s.t*.6)*170,y:650+Math.sin(s.t*.6)*140};step(s,1/60,movement(s,goal,ctx));continue;}
  if(!target||s.stats.completedBuild&&s.level>=8){if(interaction(s)?.id==='boss'){action(s,'interact');continue;}step(s,1/60,movement(s,{x:800,y:350},ctx));continue;}
  let goal=target;
  if(target.state==='active'&&distance(s.player,target)<220){const a=s.t*.9;goal={x:target.x+Math.cos(a)*105,y:target.y+Math.sin(a)*105};}
  const nearby=s.gems.filter(g=>distance(g,s.player)<130).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];if(nearby)goal=nearby;
  if(s.enemies.some(e=>!e.dead&&distance(e,s.player)<50))action(s,'dash');step(s,1/60,movement(s,goal,ctx));
 }
 return{seed,policy,won:s.result?.won||false,seconds:Number(s.t.toFixed(1)),level:s.level,hp:Number(s.player.hp.toFixed(1)),kills:s.stats.kills,completed:s.stats.completedBuild,weapons:s.weapons.map(w=>({id:w.id,level:w.level,branch:w.branch,evolved:w.evolved,fusion:w.fusion})),modules:s.modules,score:s.stats.score,raids:[s.stats.raidSuccess,s.stats.raidFailed],controls:{rerollsUsed:2-s.rerolls,banishesUsed:1-s.banishes},decisions,stalled};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const seeds=process.argv.includes('--all')?[17,71,109,214]:[17],reports=[];for(const seed of seeds)for(const policy of ['single','fusion','fire'])reports.push(pilot(seed,policy));process.stdout.write(JSON.stringify(reports,null,2)+'\n');}
