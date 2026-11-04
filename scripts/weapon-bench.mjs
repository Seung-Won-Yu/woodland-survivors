import {pathToFileURL} from 'node:url';
import {createCampaignExpedition} from '../src/game/expedition.js';
import {stepGame,spawnEnemy} from '../src/core/game.js';
// Controlled comparisons, not ordinary runs. Fixed invulnerability and targets isolate weapon output.
export function unionBench(){const results=[];
 for(const kind of ['boss','crowd','clear'])for(const recipe of ['returning','hive'])for(const setup of ['materials','evolved-materials','union']){
  const g=createCampaignExpedition('pip','acorn',1437);g.enemies=[];g.terrain=null;g.spawn=g.nextElite=g.nextSurge=1e6;g.player.invincible=1000;
  g.weapons=setup==='union'?{[recipe]:{rank:1,evolved:true,clock:0}}:Object.fromEntries((recipe==='returning'?['acorn','moon']:['briar','bees']).map(id=>[id,{rank:8,evolved:setup==='evolved-materials'||id==='briar',clock:0}]));
  const n=kind==='boss'?1:kind==='clear'?120:24;
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n,r=recipe==='hive'?75:180,hp=kind==='clear'?75:1e6;spawnEnemy(g,'elite',Math.cos(a)*r,Math.sin(a)*r,{hp,maxHp:hp,speed:0,clock:1e6,damage:0,xp:0});}
  let peakProjectiles=0;for(let i=0;i<(kind==='clear'?1200:600)&&g.enemies.length;i++){stepGame(g,1/60);g.events=[];peakProjectiles=Math.max(peakProjectiles,g.projectiles.length);}
  const hits=Object.values(g.metrics.weapons||{}).flatMap(x=>Object.values(x)).reduce((sum,x)=>sum+x.hits,0);
  results.push({kind,recipe,setup,seconds:g.time,damage:g.damage,damagePerSecond:g.damage/g.time,hits,kills:g.kills,remaining:g.enemies.length,slots:Object.keys(g.weapons).length,peakProjectiles});
 }
 return {type:'isolated-rule-fixture-not-a-normal-run',hero:'pip',seed:1437,results};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)console.log(JSON.stringify(unionBench(),null,2));
