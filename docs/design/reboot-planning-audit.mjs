// Executable planning arithmetic. This does not run or test the game.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d = JSON.parse(readFileSync(new URL('./reboot-rules.json', import.meta.url), 'utf8'));
const round = n => Math.round(n * 10000) / 10000;
const sum = xs => xs.reduce((a,b) => a+b,0);
for (const probabilities of [d.quality.normal,d.quality.raidSuccess,d.quality.lightRaidSuccess]) {
  assert.ok(Object.values(probabilities).every(p=>Number.isFinite(p)&&p>=0&&p<=1));
  assert.ok(Math.abs(sum(Object.values(probabilities))-1)<1e-9);
}
assert.equal(d.tuning.initial+sum(d.tuning.operationBossRewards),3);
assert.equal(d.tuning.initial+d.tuning.prototypeBossReward,1);
assert.deepEqual(d.tuning.operationBossHeal,[15,15,0]);
assert.equal(d.tuning.prototypeBossHeal,0);
for(const id of [...d.prototypeWeapons,...d.expansionWeapons]){
  const w=d.weapons[id];
  assert.ok(w);
  for(const key of ['damage','interval','count']){
    assert.equal(w[key].length,d.inventory.weaponMax);
    assert.ok(w[key].every(n=>Number.isFinite(n)&&n>0));
  }
  for(const branch of [w.branchA.id,w.branchB.id]){
    assert.ok(w.evolution.moduleByBranch[branch].length);
    const def = [w.branchA,w.branchB].find(b=>b.id===branch);
    const tags = new Set([...w.tags,...def.tags]);
    assert.ok(w.evolution.moduleByBranch[branch].every(id=>d.modules[id]));
    for(const moduleId of w.evolution.moduleByBranch[branch]){
      const module=d.modules[moduleId];
      assert.ok(module.universal||module.compatibleAny.some(tag=>tags.has(tag)),`${id}/${branch}: incompatible evolution module ${moduleId}`);
    }
  }
}
assert.equal(d.xpCosts.length,17);
assert.ok(d.xpCosts.every((n,i)=>Number.isInteger(n)&&n>0&&(!i||n>d.xpCosts[i-1])));
const cumulativeXp = level => sum(d.xpCosts.slice(0,level-1));
const templates = [
  {id:'h-single',supplyWeapon:'r',module:'ricochet',investments:[['h',5],['ricochet',1]],completion:'single'},
  {id:'h-r-conductive',supplyWeapon:'r',module:'coil',investments:[['h',3],['r',3],['coil',1]],completion:'fusion'},
  {id:'h-f-catalyst',supplyWeapon:'f',module:'catalyst',investments:[['h',3],['f',3],['catalyst',1]],completion:'module'}
];
const witnesses=templates.map(t=>{
  const weapons={h:1,[t.supplyWeapon]:1}, modules={[t.module]:1};
  let points=0,tokens=d.tuning.initial;
  for(const [id,n]of t.investments){
    if(id in weapons)weapons[id]+=n;else modules[id]+=n;
    points+=n;
  }
  assert.ok(Object.values(weapons).every(n=>n<=d.inventory.weaponMax));
  assert.ok(Object.values(modules).every(n=>n<=d.inventory.moduleMax));
  if(t.completion==='single'){
    assert.equal(weapons.h,6);assert.ok(modules[t.module]>=2);
  }else if(t.completion==='fusion'){
    assert.ok(weapons.h>=d.fusion.weaponLevel&&weapons.r>=d.fusion.weaponLevel);
    assert.ok(modules.coil>=d.fusion.moduleRank);
  }else{
    assert.ok(weapons.h>=4&&weapons.f>=4);modules.catalyst++;
    assert.equal(modules.catalyst,3);
  }
  tokens-=d.tuning.completionCost;assert.equal(tokens,0);
  return{id:t.id,assumption:'two specified normal supplies and a legal XP choice sequence, not an RNG guarantee',xpInvestments:points,minimumPlayerLevel:points+1,cumulativeXp:cumulativeXp(points+1),weapons,modules,tuningRemaining:tokens};
});
let swapCases=0;
const swap=(old,base)=>Math.min(5,base+Math.floor(Math.max(0,old-base)/2));
for(const base of [1,2,3])for(let original=1;original<=6;original++){
  let current=original;
  for(let i=0;i<10;i++){
    const next=swap(current,base);
    assert.ok(next<=Math.max(base,current));
    if(i>0)assert.ok(next<=current);
    assert.ok(next>=base&&next<=5);
    current=next;swapCases++;
  }
}
const c=d.credits;
const credits=(x,{first=false}={})=>Math.floor(Math.min(x.kills||0,c.killCap)/c.killsPerCredit)+Math.min(x.elites||0,c.eliteCap)*c.elite+Math.min(x.events||0,c.eventCap)*c.uniqueEvent+sum(c.bosses.slice(0,x.bosses||0))+(x.extracted?c.extraction:0)+Math.min(x.raids||0,c.raidCap)*c.raid+Math.min(x.challenges||0,c.challengeCap)*c.challenge+(first&&x.extracted?c.firstClear:0);
const max={kills:900,elites:9,events:6,bosses:3,extracted:true,raids:3,challenges:3};
const ordinary={kills:400,elites:3,events:2,bosses:3,extracted:true,raids:1};
const failure={kills:150,elites:1,events:1,bosses:1,extracted:false};
assert.equal(credits(max),1080);assert.equal(credits(max,{first:true}),1280);
assert.equal(credits(ordinary),686);assert.equal(credits(ordinary,{first:true}),886);
assert.equal(credits(failure,{first:true}),150);assert.equal(credits({}),0);
assert.ok(credits(ordinary,{first:true})>=Math.min(...Object.values(d.researchPrices)));
assert.ok(d.powerWave.oncePerRun&&d.powerWave.count<=d.spawn.aliveCap);
const directDamage=Object.fromEntries(d.prototypeWeapons.map(id=>{
  const w=d.weapons[id],base=w.damage[0]*w.count[0]/w.interval[0],end=w.damage[5]*w.count[5]/w.interval[5],e=w.evolution;
  return[id,{base:round(base),level6:round(end),singleEvolution:round(e.damage*(e.count||w.count[5])/e.interval),excludes:'branches, modules, hero skill, armor, misses and multiple targets'}];
}));
const raidTimeBounds=Object.fromEntries(Object.entries(d.raidContracts).map(([id,contract])=>[id,{
  escapeSeconds:round(contract.routeLength/contract.speed),
  rawHStarterDamageTime:round(contract.hp/directDamage.h.base),
  rawHEvolutionDamageTime:round(contract.hp/directDamage.h.singleEvolution),
  excludes:'travel, armor, skill, escort pressure and misses; not a success-rate prediction'
}]));
process.stdout.write(JSON.stringify({
  ruleset:d.ruleset,balanceRevision:d.balanceRevision,status:'planning arithmetic only; no gameplay, RNG distribution, performance or human-fun validation',
  verified:['three probability distributions','five weapon arrays and branch-specific evolution compatibility','tuning and boss-heal budgets','three normal-reward investment witnesses','180 repeated-swap transitions','credit cap and example sums','first-clear purchasing power'],
  witnesses,swapTransitions:swapCases,xpMilestones:Object.fromEntries([7,8,9,14,18].map(l=>[l,cumulativeXp(l)])),
  credits:{maxRepeat:credits(max),maxFirstClear:credits(max,{first:true}),exampleFirstClear:credits(ordinary,{first:true}),exampleFailure:credits(failure,{first:true})},directDamage,raidTimeBounds,
  notVerified:['candidate generation implementation','20-seed ordinary input play','combat balance','save atomicity','browser UI','human choice and replay desire']
},null,2)+'\n');
