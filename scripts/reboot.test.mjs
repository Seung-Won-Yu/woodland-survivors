import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {beachRoute,regionLayout,exitGate,holdoutTier,holdoutParts,HOLDOUT,RAIL_BARRAGE,DEFENSE_ZONE,CARGO_CREDITS,SORTIE_ORDERS,orderBonus,orderTarget,coastApproach,operationCredits,regionBoss,mapSeed,frontEntry,activeEntry,entryWaypoint,railCrewLeft,portGantry,portGantryBypass,portTurretShutter,portBarrageMark,portAidPreview,portAidBaitRisk,signalRoute,SIGNAL_SECONDS} from '../src/reboot/campaign.js';
import {RULES,FIELD,makeWeapon,weaponStats,buildPaths} from '../src/reboot/content.js';
import {createRun,createOperation,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,snapshot,restore,takeEvents,activeManeuver,assemblyOptions,interaction,pickupReach,partPosition,portTurretInSight} from '../src/reboot/model.js';
import {STORAGE_KEY,buyResearch,emptyProfile,beginProfile,checkpointProfile,settleProfile,createStore,parseProfile,canLaunchOrder,freshSortie} from '../src/reboot/profile.js';
import {pilot} from './reboot-pilot.mjs';
import {choiceDetails,growthForecast} from '../src/reboot/choice-details.js';
import {raidRoute,raidOnNose,raidAhead} from '../src/reboot/raid.js';
import {COAST_CHARGE,coastChargeLane,planCoastCharge} from '../src/reboot/coast-charge.js';
const dt=1/60;
function quiet(){const s=createRun(17);s.sites.forEach(n=>n.state='done');s.blocks=[];s.enemies=[];s.shots=[];s.enemyShots=[];s.spawnClock=999;s.boss.spawnClock=999;s.player.x=800;s.player.y=800;s.weapons[0].cd=999;return s;}
function tick(s,seconds,input={x:0,y:0}){for(let i=0;i<Math.round(seconds/dt);i++)step(s,dt,input);}
function supply(s,id='supply-a'){const n=s.sites.find(n=>n.id===id);n.state='ready';s.player.x=n.x;s.player.y=n.y;step(s,dt);assert.equal(s.phase,'choice');return s.choices;}
function enemy(id,x,y,type='rifle',hp=100){const d=RULES.enemies[type];return{id,type,x,y,r:17,hp,maxHp:hp,speed:0,timer:999,aim:0,hurt:0,walk:0,spawnAge:1,dead:false,death:0,burn:0};}
function bullet(s,e,damage=100){return{x:e.x,y:e.y,vx:0,vy:0,life:1,damage,r:3,rocket:false,radius:0,source:'native',owner:s.weapons[0].uid,target:e.id,homing:false,incendiary:false,bounces:0,hitIds:[]};}
function memory(){const values=new Map();let fail=false;return{values,getItem:k=>values.get(k)||null,setItem(k,v){if(fail)throw Error('quota');values.set(k,v);},setFail:v=>{fail=v;}};}

test('reboot runtime data stays identical to the reviewed design baseline',async()=>{assert.deepEqual(RULES,JSON.parse(await readFile('docs/design/reboot-rules.json','utf8')));});
test('opening enemies respect distance and cover even near the southern boundary',()=>{
 for(const seed of [17,71,109,214,3470268883]){const s=createRun(seed);assert.equal(s.enemies.length,10);for(const e of s.enemies){assert.ok(Math.hypot(e.x-s.player.x,e.y-s.player.y)>300);assert.ok(s.enemies.every(other=>e===other||Math.hypot(e.x-other.x,e.y-other.y)>=RULES.spawn.openingGap));assert.ok(!s.blocks.some(b=>e.x+e.r>b.x&&e.x-e.r<b.x+b.w&&e.y+e.r>b.y&&e.y-e.r<b.y+b.h));}}
});
test('shield facing has a readable turn limit so movement can expose its side',()=>{
 const s=quiet(),e=enemy('shield',800,700,'shield',90);s.enemies=[e];s.player.x=700;s.player.y=700;step(s,dt);assert.ok(Math.abs(e.aim)<=RULES.enemies.shield.turnRadiansPerSecond*dt+.00001);assert.ok(Math.abs(e.aim-Math.PI)>1);
});
test('crowd separation opens readable gaps without teleporting into nearby cover',()=>{
 const s=quiet();s.enemies=Array.from({length:6},(_,i)=>enemy(`packed-${i}`,1100,800));const before=snapshot(s.enemies);step(s,dt);for(let i=0;i<6;i++)assert.ok(Math.hypot(s.enemies[i].x-before[i].x,s.enemies[i].y-before[i].y)<=RULES.combatFeel.crowdSeparationSpeed*dt+.001);tick(s,2);for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(Math.hypot(s.enemies[i].x-s.enemies[j].x,s.enemies[i].y-s.enemies[j].y)>25);
});
test('auto aim holds a valid target briefly and immediately releases a dead target',()=>{
 const s=quiet(),w=s.weapons[0];s.enemies=[enemy('held',1000,780,'rifle',1000),enemy('closer',1010,840,'rifle',1000)];w.cd=0;step(s,dt);assert.equal(w.targetId,'held');s.enemies[1].x=980;w.cd=0;step(s,dt);assert.equal(w.targetId,'held');tick(s,.17);w.cd=0;step(s,dt);assert.equal(w.targetId,'closer');s.enemies[1].hp=0;w.cd=0;step(s,dt);assert.equal(w.targetId,'held');
});
test('evolved H and R allocate their simultaneous projectiles to distinct living targets',()=>{
 for(const id of ['h','r']){const s=quiet(),w={...makeWeapon(id),uid:'fan',level:6,evolved:true,branch:id==='h'?'ricochet':'homing',cd:0};s.weapons=[w];s.enemies=Array.from({length:6},(_,i)=>enemy(`spread-${i}`,1000+Math.cos(i)*40,800+Math.sin(i)*60,'rifle',1000));step(s,dt);assert.equal(new Set(s.shots.map(q=>q.target)).size,weaponStats(w).count);}
});
test('muzzle artwork height cannot turn a small sideways target movement into a miss',()=>{
 const s=quiet(),w=s.weapons[0];w.cd=0;s.enemies=[enemy('moving',1000,800,'rifle',1000)];step(s,dt);w.cd=999;s.enemies[0].y+=12;tick(s,.4);assert.ok(s.enemies[0].hp<1000);
});
test('flame auto aim prioritizes a reachable crowd over a closer isolated soldier',()=>{
 const s=quiet();s.weapons=[{...makeWeapon('f'),uid:'flame',cd:0,level:6,evolved:true,branch:'trail'}];s.enemies=[enemy('isolated',900,800,'rifle',1000),...Array.from({length:10},(_,i)=>enemy(`crowd-${i}`,650,775+i*5,'rifle',1000))];step(s,dt);assert.equal(s.enemies[0].hp,1000);assert.ok(s.enemies.slice(1).every(e=>e.hp<1000));
});
test('fusion payload starts at its triggering impact and does not charge itself',()=>{
 const s=quiet(),w=s.weapons[0];w.level=6;w.evolved=true;w.fusion={secondary:'r',branch:'homing',overflow:0};w.payload=9;s.enemies=[enemy('impact',1000,800,'rifle',1),enemy('next',1100,800,'rifle',1000)];s.shots=[bullet(s,s.enemies[0],2)];step(s,dt);const payload=s.shots.find(q=>q.source==='payload');assert.ok(payload);assert.ok(payload.x>=1000);assert.equal(payload.target,'next');assert.ok(Math.abs(Math.hypot(payload.vx,payload.vy)-RULES.fusion.payloadSpeed)<1e-6);assert.equal(s.stats.payloadBursts,1);tick(s,.5);assert.equal(s.stats.payloadBursts,1);assert.equal(w.payload,0);
});
test('fusion flies past a surviving trigger and detonates in a second pack',()=>{
 const s=quiet(),w=s.weapons[0];Object.assign(w,{level:6,evolved:true,fusion:{secondary:'r',branch:'homing',overflow:0},payload:9});
 const first=enemy('survivor',960,800,'rifle',1000),crowd=[enemy('second-a',1160,800,'rifle',65),enemy('second-b',1185,825,'rifle',65)];
 s.enemies=[first,...crowd];s.shots=[bullet(s,first,2)];step(s,dt);
 const q=s.shots.find(q=>q.source==='payload');assert.ok(q);assert.equal(q.target,'second-a');assert.deepEqual(q.hitIds,['survivor']);assert.equal(first.hp,998);
 tick(s,.75);assert.ok(crowd.every(e=>e.dead&&e.deathFlavor==='arc'));assert.equal(s.stats.payloadKills,2);assert.equal(s.stats.payloadBursts,1);assert.ok(takeEvents(s).includes('payload-impact'));
});
test('a saved in-flight homing payload keeps its launch speed and lifetime',()=>{
 const s=quiet(),target=enemy('ahead',1140,800,'rifle',1000);s.enemies=[target];
 s.shots=[{...bullet(s,target,80),x:920,vx:420,life:.5,rocket:true,radius:130,source:'payload',homing:true}];
 const loaded=restore(snapshot(s));step(loaded,dt);
 const [shot]=loaded.shots;
 assert.ok(Math.abs(Math.hypot(shot.vx,shot.vy)-420)<1e-6);
 assert.ok(Math.abs(shot.life-(.5-dt))<1e-6);
});
test('two payload kills send a single relay into another pack without feeding the launcher',()=>{
 const s=quiet(),w=s.weapons[0];Object.assign(w,{level:6,evolved:true,fusion:{secondary:'r',branch:'homing',overflow:0},payload:9});
 const trigger=enemy('trigger',800,800,'rifle',1000),groups=[
  [enemy('a',960,800,'rifle',65),enemy('b',975,833,'rifle',65)],
  [enemy('c',1160,800,'rifle',60),enemy('d',1175,833,'rifle',60)],
  [enemy('e',1360,800,'rifle',60),enemy('f',1375,833,'rifle',60)]
 ];
 s.enemies=[trigger,...groups.flat()];s.shots=[bullet(s,trigger,2)];tick(s,1.1);
 assert.ok(groups.slice(0,2).flat().every(e=>e.dead));assert.ok(groups[2].every(e=>!e.dead));
 assert.equal(s.stats.payloadRelays,1);assert.equal(s.stats.payloadBursts,1);assert.equal(w.payload,0);
});
test('first fusion primes the launcher and stages three legal packs when there is room',()=>{
 const s=quiet();Object.assign(s.weapons[0],{level:4,branch:'ricochet'});s.weapons.push({...makeWeapon('r'),uid:'r',level:4,branch:'homing'});s.modules=[{id:'coil',rank:2}];
 s.powerDone=true;s.stats.completedBuild={kind:'synergy',t:0};
 assert.ok(action(s,'gear'));assert.ok(choose(s,'fusion:h:r'));assert.equal(s.weapons[0].payload,RULES.fusion.hitsPerPayload);
 const resumed=restore(snapshot(s));tick(resumed,.72);
 const groups=[...new Set(resumed.enemies.map(e=>e.waveGroup))];
 assert.deepEqual(groups.map(id=>resumed.enemies.filter(e=>e.waveGroup===id).length),[4,4,4]);assert.ok(groups.every(Number.isInteger));assert.equal(resumed.powerWave.remaining,12);
 assert.ok(resumed.enemies.every(e=>Math.hypot(e.x-resumed.player.x,e.y-resumed.player.y)>150));
});
test('evolved sweeping fire leaves a forward wake while focused fire builds a stronger burn',()=>{
 const fixture=branch=>{const s=quiet();s.weapons=[{...makeWeapon('f'),uid:'flame',cd:0,level:6,evolved:true,branch}];s.enemies=[enemy('guard',970,800,'rifle',1000)];step(s,dt,{x:1,y:0});return s;};
 const sweep=fixture('trail'),jet=fixture('focused'),patch=sweep.zones[0];
 assert.equal(patch.source,'wake');assert.ok(patch.x>sweep.player.x+90);assert.equal(patch.r,74);
 assert.equal(jet.zones.length,0);assert.ok(jet.enemies[0].burnDps>sweep.enemies[0].burnDps);
 const victim=enemy('crossing',patch.x,patch.y+50,'rifle',10);sweep.enemies.push(victim);sweep.weapons[0].cd=999;tick(sweep,.3);assert.equal(sweep.stats.wakeKills,1);
});
test('assembly progress distinguishes a ready recipe from an already completed weapon',()=>{
 const s=quiet();assert.ok(buildPaths(s).every(p=>!p.ready&&!p.complete));s.weapons[0].level=6;s.weapons[0].branch='ricochet';s.modules=[{id:'ricochet',rank:2}];assert.ok(buildPaths(s).some(p=>p.ready&&p.title.includes('사중')));action(s,'gear');choose(s,'evolve:h');assert.ok(buildPaths(s).some(p=>p.complete&&p.title.includes('사중')));assert.ok(buildPaths(s).every(p=>!p.ready));
});
test('workshop explains permit shortage and blocks an identical installed fusion',()=>{
 const s=quiet();Object.assign(s.weapons[0],{level:4,branch:'ricochet'});
 s.weapons.push({...makeWeapon('r'),uid:'rocket',level:4,branch:'homing'});
 s.modules=[{id:'coil',rank:2}];s.tuning=0;
 const fusion=()=>buildPaths(s).find(path=>path.id==='fusion:h:r');
 assert.equal(fusion().status,'permit');assert.equal(fusion().missing,'조율권 1개');
 s.tuning=1;s.weapons.unshift({...makeWeapon('h'),uid:'fused',level:6,branch:'ricochet',evolved:true,fusion:{secondary:'r',branch:'homing',overflow:0}});
 assert.equal(fusion().status,'blocked');assert.ok(!assemblyOptions(s).some(card=>card.id===fusion().id));
 s.weapons[1].branch='grenade';
 assert.equal(fusion().status,'ready');assert.ok(assemblyOptions(s).some(card=>card.id===fusion().id));
});
test('growth preview predicts the exact branch or rank without mutating the run',()=>{
 const s=quiet();Object.assign(s.weapons[0],{level:3});
 s.weapons.push({...makeWeapon('f'),uid:'flame',level:5,branch:'trail'});
 s.modules=[{id:'catalyst',rank:3}];s.phase='choice';s.choice={type:'level'};
 const rank=weapon=>({id:`rank:${weapon}`,kind:'rank',weapon});
 const [machine,flame]=s.choices=[rank('h'),rank('f')];const before=snapshot(s);
 assert.equal(growthForecast(s,machine).text,'유탄 급탄 선택 시 열압 연계 발동');
 assert.equal(growthForecast(s,machine,{branch:'grenade'}).text,'열압 연계 발동');
 assert.notEqual(growthForecast(s,machine,{branch:'ricochet'})?.kind,'ready');
 assert.equal(growthForecast(s,flame).text,'인페르노 조립 가능');
 assert.deepEqual(snapshot(s),before);
 assert.ok(choose(s,flame.id));assert.ok(assemblyOptions(s).some(card=>card.id==='evolve:f'));
 action(s,'gear');const repair=s.choices.find(card=>card.kind==='repair');
 assert.equal(growthForecast(s,repair).text,'조율권을 쓰면 인페르노 대기');
});
test('replacing a full module slot previews the recipe gained and the recipe lost',()=>{
 const s=quiet();Object.assign(s.weapons[0],{level:4,branch:'ricochet'});
 s.weapons.push({...makeWeapon('r'),uid:'rocket',level:4,branch:'homing'},
  {...makeWeapon('f'),uid:'flame',level:6,branch:'trail'});
 s.modules=[{id:'catalyst',rank:2},{id:'magnet',rank:1},{id:'ricochet',rank:1},{id:'overcharger',rank:1}];
 s.phase='choice';s.choice={type:'armory'};
 const [coil]=s.choices=[{id:'module:coil',kind:'module',module:'coil',rank:2}];
 assert.equal(growthForecast(s,coil),null);
 assert.equal(growthForecast(s,coil,{slot:0}).text,'전도 격발망 H+R 조립 가능 · 인페르노 · 열압 연계 대기');
 assert.equal(growthForecast(s,coil,{slot:1}).text,'전도 격발망 H+R 조립 가능');
 s.modules[0].rank=3;
 assert.equal(growthForecast(s,coil,{slot:0}).text,'전도 격발망 H+R 조립 가능 · 인페르노 대기 · 열압 연계 해제');
});
test('same-seed ordinary inputs and checkpoint restoration produce identical continuation',()=>{
 const s=createRun(71);tick(s,1,{x:1,y:-1});takeEvents(s);const r=restore(snapshot(s));tick(s,.8,{x:-1,y:0});tick(r,.8,{x:-1,y:0});assert.deepEqual(snapshot(s),snapshot(r));
});
test('pause and every choice freeze attacks, clocks, carrier progress and charge',()=>{
 const s=createRun();pause(s);const before=snapshot(s);tick(s,2);assert.deepEqual(snapshot(s),before);resume(s);supply(s);const chosen=snapshot(s);tick(s,2);assert.deepEqual(snapshot(s),chosen);
});
test('first supplies show different new guns and keep an owned investment and useful module',()=>{
 const offers=new Set();for(const seed of [17,71,109,214,357]){const s=quiet();s.seed=seed;s.rng.supply=seed;const a=supply(s),first=a.find(c=>c.kind==='gun');assert.ok(first);assert.ok(a.some(c=>c.kind==='rank'));assert.ok(a.some(c=>c.kind==='module'));offers.add(first.weapon);choose(s,a.find(c=>c.kind==='module').id);const b=supply(s,'supply-b').find(c=>c.kind==='gun');assert.ok(b);assert.notEqual(b.weapon,first.weapon);}assert.equal(offers.size,2);
});
test('L4 specialization is mandatory and a rejected choice mutates nothing',()=>{
 const s=quiet();s.weapons[0].level=3;supply(s);const before=snapshot(s);assert.equal(choose(s,'rank:h'),false);assert.deepEqual(snapshot(s),before);assert.ok(choose(s,'rank:h',{branch:'grenade'}));assert.equal(s.weapons[0].branch,'grenade');
});
test('the free level-six doctrine choice cannot consume a level before it is valid',()=>{
 const s=quiet();s.level=6;s.pendingLevels=1;step(s,dt);const before=snapshot(s),c=s.choices.find(c=>c.kind==='rank');assert.equal(choose(s,c.id),false);assert.deepEqual(snapshot(s),before);assert.ok(choose(s,c.id,{doctrine:'quick'}));assert.equal(s.player.doctrine,'quick');assert.ok(s.player.branchChosen);
});
test('empty-slot equip preserves H, while opening refit preserves investment and reselects specialization',()=>{
 const s=quiet();const c=supply(s).find(c=>c.kind==='gun');assert.ok(choose(s,c.id,{slot:-1}));assert.equal(s.weapons.length,2);assert.equal(s.weapons[0].id,'h');
 const a=quiet();a.weapons[0].level=5;a.weapons[0].branch='ricochet';const n=supply(a).find(c=>c.kind==='gun'),before=snapshot(a);assert.equal(choose(a,n.id,{slot:0}),false);assert.deepEqual(snapshot(a),before);assert.ok(choose(a,n.id,{slot:0,branch:n.weapon==='r'?'homing':'trail'}));assert.equal(a.weapons[0].level,5);assert.equal(a.refits,0);
});
test('module swapping needs an explicit slot and max/unique modules cannot be upgraded',()=>{
 const s=quiet();s.modules=[{id:'coil',rank:1},{id:'catalyst',rank:1},{id:'magnet',rank:1},{id:'overcharger',rank:1}];s.phase='choice';s.choice={type:'armory'};s.choices=[{id:'module:ricochet',kind:'module',module:'ricochet',rank:2}];const before=snapshot(s);assert.equal(choose(s,'module:ricochet'),false);assert.deepEqual(snapshot(s),before);assert.ok(choose(s,'module:ricochet',{slot:0}));assert.equal(s.modules[0].rank,2);
});
test('initial tuning can finish H before a boss, but the same token cannot finish twice',()=>{
 const s=quiet();s.weapons[0].level=6;s.weapons[0].branch='ricochet';s.modules=[{id:'ricochet',rank:2}];assert.ok(action(s,'gear'));assert.ok(choose(s,'evolve:h'));assert.equal(s.tuning,0);assert.ok(s.weapons[0].evolved);assert.ok(s.powerWave);action(s,'gear');assert.equal(s.choices.some(c=>c.kind==='evolve'),false);
});
test('fusion retains H grammar, R specialization and overflow while freeing one slot',()=>{
 const s=quiet();s.weapons[0].level=5;s.weapons[0].branch='grenade';s.weapons.push({...makeWeapon('r'),uid:'test-r',level:4,branch:'incendiary'});s.modules=[{id:'coil',rank:2},{id:'catalyst',rank:1}];action(s,'gear');assert.ok(choose(s,'fusion:h:r'));assert.equal(s.weapons.length,1);assert.equal(s.weapons[0].id,'h');assert.equal(s.weapons[0].branch,'grenade');assert.equal(s.weapons[0].fusion.branch,'incendiary');assert.equal(s.weapons[0].fusion.overflow,1);assert.equal(s.modules.length,2);
});
test('synergy completion uses a token to tune a module without forcing a fusion',()=>{
 const s=quiet();s.weapons[0].level=4;s.weapons[0].branch='grenade';s.weapons.push({...makeWeapon('f'),uid:'test-f',level:4,branch:'trail'});s.modules=[{id:'catalyst',rank:2}];action(s,'gear');assert.ok(choose(s,'tune:catalyst'));assert.equal(s.stats.completedBuild.kind,'synergy');assert.equal(s.weapons.length,2);assert.equal(s.tuning,0);
});
test('a utility module or a lone incendiary weapon cannot masquerade as heat synergy',()=>{
 const s=quiet();s.weapons[0].level=4;s.weapons[0].branch='ricochet';s.weapons.push({...makeWeapon('r'),uid:'second',level:4,branch:'homing'});s.modules=[{id:'magnet',rank:2}];action(s,'gear');choose(s,'tune:magnet');assert.equal(s.stats.completedBuild,null);assert.equal(s.powerWave,null);
 const a=quiet();a.weapons=[{...makeWeapon('r'),uid:'burn-and-blast',level:4,branch:'incendiary'}];a.modules=[{id:'catalyst',rank:3}];assert.ok(!buildPaths(a).find(p=>p.title.includes('열압')).complete);
});
test('refresh preserves finite controls and banish replaces only the selected slot',()=>{
 const s=quiet();supply(s);assert.ok(reroll(s));assert.equal(s.rerolls,1);const c=s.choices.find(c=>c.kind==='module');assert.ok(c);const other=s.choices.filter(x=>x!==c);assert.ok(banishOptions(s).some(x=>x.id===c.id));assert.ok(banish(s,c.id));assert.ok(s.excluded.includes(c.module));assert.equal(s.banishes,0);for(const a of other)assert.ok(s.choices.some(b=>JSON.stringify(a)===JSON.stringify(b)));assert.ok(s.choices.some(x=>x.kind==='module'));assert.ok(!s.choices.some(x=>x.id===c.id));
});
test('the first two new-gun opportunities cannot be eliminated by banish',()=>{const s=quiet();supply(s);const c=s.choices.find(c=>c.kind==='gun');assert.equal(banish(s,c.id),false);assert.equal(s.banishes,1);});
test('module-crate refresh and banish preserve its quality and upgrade amount',()=>{
 const s=quiet();s.weapons[0].level=4;s.weapons[0].branch='grenade';s.weapons.push({...makeWeapon('f'),uid:'fire',level:4,branch:'trail'});s.phase='choice';s.choice={type:'armory',quality:'rare'};s.choices=[{id:'module:magnet',kind:'module',module:'magnet',rank:2}];assert.ok(banish(s,'module:magnet'));assert.equal(s.choices[0].rank,2);assert.ok(reroll(s));assert.equal(s.choice.quality,'rare');assert.ok(s.choices.filter(c=>c.kind==='module').every(c=>c.rank===2));assert.equal(s.rerolls,1);assert.equal(s.banishes,0);
});
test('wager start persists an actual escrow and deterministic result through restoration',()=>{
 const s=quiet();supply(s,'arsenal');const old=snapshot(s.choices);assert.ok(action(s,'raid:armored'));assert.equal(s.raid.target.hp,4200);assert.deepEqual(s.raid.wagerCards,old);takeEvents(s);const r=restore(snapshot(s));tick(s,1,{x:.5,y:0});tick(r,1,{x:.5,y:0});assert.deepEqual(snapshot(s),snapshot(r));
});
test('both convoy contracts start near every crate source and clear mirrored cover along the whole lane',()=>{
 for(const seed of [16,17,18,19]){
  for(const [front,siteId] of [[0,'arsenal'],[1,'arsenal'],[2,'arsenal'],[2,'port-control']]){
   const s=createOperation(seed);
   Object.assign(s,regionLayout(mapSeed(seed,front),front));s.operation.region=front;
   const site=s.sites.find(n=>n.id===siteId);
   Object.assign(s.player,{x:site.x,y:site.y});
   s.phase='choice';s.choice={type:'armory',quality:'rare',siteId};
   for(const contract of ['light','armored']){
    const r=snapshot(s),route=raidRoute(r,contract),[start]=route;
    assert.ok(Math.hypot(start.x-site.x,start.y-site.y)<240);
    const clear=(p,margin)=>r.blocks.every(b=>p.x+margin<=b.x||p.x-margin>=b.x+b.w||p.y+margin<=b.y||p.y-margin>=b.y+b.h);
    for(const [i,a] of route.slice(0,-1).entries()){
     const b=route[i+1],samples=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);
     for(let j=0;j<=samples;j++){
      const f=j/samples;
      assert.ok(clear({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f},45),`${seed} ${front} ${siteId} ${contract} segment ${i}`);
     }
    }
    assert.ok(action(r,`raid:${contract}`));assert.deepEqual(r.raid.route,route);
    assert.equal(raidOnNose(r),contract==='armored');
    const escorts=r.enemies.filter(e=>e.cohort==='raid');
    assert.equal(escorts.length,5);
    assert.ok(escorts.every(e=>clear(e,e.r)&&Math.hypot(e.x-r.player.x,e.y-r.player.y)>=105));
   }
  }
 }
});
test('convoy armor reads the arriving bullet angle and a frontal collision can hurt',()=>{
 const s=quiet();supply(s,'arsenal');assert.ok(action(s,'raid:armored'));s.enemies=[];
 const shot=(r,angle)=>{
  const target=r.raid.target,x=Math.cos(angle),y=Math.sin(angle);
  r.shots=[{...bullet(r,target),x:target.x+x*44,y:target.y+y*44,vx:-700*x,vy:-700*y}];
  step(r,dt);
 };
 const front=snapshot(s),flank=snapshot(s);
 shot(front,front.raid.target.aim);shot(flank,flank.raid.target.aim+Math.PI/2);
 assert.equal(front.raid.target.hp,4150);assert.equal(flank.raid.target.hp,4100);
 assert.ok(takeEvents(front).includes('armor-impact'));assert.ok(!takeEvents(flank).includes('armor-impact'));
 const {x,y,aim}=s.raid.target;
 Object.assign(s.player,{x:x+Math.cos(aim)*44,y:y+Math.sin(aim)*44});
 const hp=s.player.hp;step(s,dt);
 assert.equal(s.player.hp,hp-RULES.raidContracts.armored.contactDamage);
});
test('an in-flight b24 convoy resumes its saved route and wager',()=>{
 const s=quiet();supply(s,'arsenal');assert.ok(action(s,'raid:light'));
 s.balanceRevision='b24-harbor-counterplay';
 s.raid.route=[{x:340,y:470},{x:630,y:300},{x:1000,y:470},{x:1340,y:700}];
 s.raid.progress=s.raid.maxProgress*.72;Object.assign(s.raid.target,{x:1080,y:525});delete s.raid.segment;
 pause(s);const resumed=restore(snapshot(s));
 assert.deepEqual(resumed.raid.route,s.raid.route);
 assert.deepEqual(resumed.raid.wagerCards,s.raid.wagerCards);
 assert.deepEqual(raidAhead(resumed.raid),[resumed.raid.target,resumed.raid.route[3]]);
 resume(resumed);step(resumed,dt);
 assert.ok(resumed.raid.progress>s.raid.progress);assert.equal(resumed.raid.segment,2);
});
test('checkpoint rejects incomplete convoy display or reward data before resuming',()=>{
 const s=quiet();supply(s,'arsenal');assert.ok(action(s,'raid:light'));
 for(const corrupt of [r=>delete r.target.maxHp,r=>delete r.wager,r=>r.quality='missing',r=>r.target.aim='invalid']){
  const broken=snapshot(s);corrupt(broken.raid);
  assert.throws(()=>restore(broken),/체크포인트/);
 }
});
test('a courier that crosses its exit cannot be killed by a later collision in that tick',()=>{
 const s=quiet();supply(s,'arsenal');action(s,'raid:light');s.raid.progress=s.raid.maxProgress-.1;s.shots=[bullet(s,s.raid.target,9999)];step(s,dt);assert.equal(s.raid.state,'failed');assert.equal(s.stats.raidFailed,1);assert.equal(s.stats.raidSuccess,0);
});
test('withdrawal loses only the offered crate and leaves escort pressure, not a free screen wipe',()=>{
 const s=quiet();supply(s,'arsenal');action(s,'raid:light');const count=s.enemies.length,weapons=snapshot(s.weapons),hp=s.player.hp;assert.ok(action(s,'withdraw'));assert.deepEqual(s.weapons,weapons);assert.equal(s.enemies.length,count);assert.equal(s.player.hp,hp);assert.ok(s.raidUsed);
});
test('secondary electric kills cannot recursively charge themselves or double-count a death',()=>{
 const s=quiet();s.coil=17;s.modules=[{id:'coil',rank:1}];s.enemies=[enemy('a',900,800,'rifle',1),enemy('b',920,800,'rifle',1),enemy('c',940,800,'rifle',1)];s.shots=[bullet(s,s.enemies[0])];step(s,dt);assert.equal(s.stats.kills,3);assert.equal(s.stats.coilBursts,1);assert.equal(s.stats.score,30);
});
test('boss burn wears off and damages the real body rather than a temporary target copy',()=>{
 const s=quiet();s.stage='boss';s.boss.active=true;s.boss.mode='recover';s.boss.timer=999;s.boss.x=1000;s.boss.y=800;s.boss.burn=1;s.boss.burnTick=.5;s.boss.burnDps=6;const hp=s.boss.hp;tick(s,1.2);assert.ok(s.boss.hp<hp);assert.ok(s.boss.burn<=0);const after=s.boss.hp;tick(s,.5);assert.equal(s.boss.hp,after);
});
test('D1 completion in the same tick as pilot death preserves its earned record',()=>{
 const s=quiet();s.stage='holdout';s.clearPressure=0;s.player.hp=1;const e=enemy('officer',900,800,'officer',1);s.enemies=[e];s.challenge={state:'active',targets:[e.id]};s.shots=[bullet(s,e)];s.enemyShots=[{x:800,y:800,vx:0,vy:0,life:1,r:5}];step(s,dt);assert.equal(s.phase,'result');assert.equal(s.result.won,false);assert.equal(s.result.stats.challenge,1);assert.equal(s.result.score,600);
});
test('boss and pilot simultaneous death earns kill credit but cannot revive or extract',()=>{
 const s=quiet();s.player.hp=1;s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.hp=1;s.shots=[bullet(s,s.boss)];s.enemyShots=[{x:800,y:800,vx:0,vy:0,life:1,r:5}];step(s,dt);assert.ok(s.stats.bossKilled);assert.equal(s.phase,'result');assert.equal(s.result.won,false);assert.equal(s.player.hp,0);assert.equal(s.stats.score,1000);
});
test('living extraction grants completion score once and result cannot resume',()=>{
 const s=quiet();s.stats.bossKilled=true;s.stats.score=1000;assert.ok(finish(s,true));assert.equal(s.result.score,4000);assert.equal(finish(s,true),false);assert.equal(s.result.score,4000);const raw=snapshot(s);tick(s,2);resume(s);assert.deepEqual(snapshot(s),raw);
});
test('field guards reserve slots and never auto-award a supply at the population cap',()=>{
 const s=quiet(),node=s.sites[0];node.state='waiting';s.player.x=node.x;s.player.y=node.y;s.enemies=Array.from({length:160},(_,i)=>enemy(`ambient-${i}`,1400,100));step(s,dt);assert.equal(node.state,'active');assert.equal(s.enemies.filter(e=>e.siteId===node.id&&!e.dead).length,6);assert.notEqual(s.phase,'choice');assert.ok(s.enemies.length<=160);
});
test('failed saves do not mutate the current profile and retry settles a result once',async()=>{
 const mem=memory(),store=createStore(mem),s=quiet();await store.commit(beginProfile(store.get(),s));s.stats.bossKilled=true;finish(s,true);const next=settleProfile(store.get(),s);mem.setFail(true);await assert.rejects(store.commit(next));assert.equal(store.get().records.score,0);assert.ok(store.get().active);mem.setFail(false);await store.commit(next);assert.equal(store.get().records.score,3000);assert.equal(store.get().active,null);const again=settleProfile(store.get(),s);assert.equal(again.recent.length,1);assert.equal(again.records.score,3000);
});
test('stale tabs are rejected distinctly so the UI can reload the newer active run',async()=>{
 const mem=memory(),a=createStore(mem),b=createStore(mem);await a.commit(beginProfile(a.get(),createRun(17)));await assert.rejects(b.commit(beginProfile(b.get(),createRun(71))),e=>e.code==='CONFLICT');const newest=createStore(mem);assert.equal(newest.get().active.run.seed,17);
});
test('prototype storage never touches the legacy wallet or gameplay checkpoint',async()=>{
 const mem=memory();mem.values.set('operation-breakwater-profile-v1','legacy-data');const store=createStore(mem);await store.commit(beginProfile(store.get(),createRun()));assert.equal(mem.values.get('operation-breakwater-profile-v1'),'legacy-data');assert.ok(mem.values.has(STORAGE_KEY));assert.equal(store.get().wallet,undefined);
});
test('ordinary input pilots can complete three distinct investment paths',()=>{
 const runs=['single','fusion','fire'].map(p=>pilot(17,p));assert.ok(runs.every(r=>r.won&&!r.stalled));assert.ok(runs[0].weapons.some(w=>w.evolved&&!w.fusion));assert.ok(runs[1].weapons.some(w=>w.fusion));assert.ok(runs[2].weapons.some(w=>w.id==='f'));assert.ok(runs[2].modules.some(m=>m.id==='catalyst'&&m.rank===3));
});
test('malformed pending choices and duplicate unique modules fail restoration without silently resetting records',()=>{
 const s=quiet();supply(s);s.choices=[{id:'invalid',kind:'unknown'}];assert.throws(()=>restore(s));const a=quiet();a.modules=[{id:'overcharger',rank:3}];assert.throws(()=>restore(a));const p=emptyProfile();p.records.score='invalid';assert.throws(()=>parseProfile(JSON.stringify(p)));
});
test('broken terminal and impossible assembly checkpoints are rejected before rendering',()=>{
 const s=quiet();s.phase='result';s.result=null;assert.throws(()=>restore(s));const a=quiet();a.phase='choice';a.choice={type:'assembly'};a.choices=[{id:'evolve:h',kind:'evolve',weapon:'h',title:'invalid'}];assert.throws(()=>restore(a));a.choices.push({id:'back',kind:'back',title:'back'});assert.throws(()=>restore(a));action(quiet(),'gear');
});

function raidLoot(contract='light',configure=()=>{}){
 const s=quiet();configure(s);supply(s,'arsenal');action(s,`raid:${contract}`);s.raid.target.hp=1;s.shots=[bullet(s,s.raid.target,10000)];step(s,dt);assert.equal(s.choice.type,'raid-reward');return s;
}
test('successful contracts keep distinct workshop and completion roles through reroll and restoration',()=>{
 const configure=s=>{s.weapons[0].level=4;s.weapons[0].branch='grenade';s.weapons.push({...makeWeapon('f'),uid:'fire',level:4,branch:'trail'});};
 const light=raidLoot('light',configure);assert.ok(light.choices.some(c=>c.kind==='refit'));takeEvents(light);const saved=restore(snapshot(light));assert.ok(reroll(light));assert.ok(reroll(saved));assert.deepEqual(snapshot(light),snapshot(saved));assert.ok(light.choices.some(c=>c.kind==='refit'));assert.equal(light.choice.contract,'light');
 const armor=raidLoot('armored',configure),quality=armor.choice.quality;assert.ok(armor.choices.some(c=>c.support&&['coil','catalyst'].includes(c.module)));assert.ok(!armor.choices.some(c=>c.kind==='refit'));reroll(armor);assert.equal(armor.choice.quality,quality);assert.ok(armor.choices.some(c=>c.support));
 const early=raidLoot('light');assert.ok(early.choices.some(c=>c.kind==='rank'));assert.ok(!early.choices.some(c=>c.kind==='refit'));
});
test('field workshop changes one unfinished specialization without consuming investment or tuning',()=>{
 const s=raidLoot('light',s=>{Object.assign(s.weapons[0],{level:5,branch:'ricochet',cd:.32,shots:14});s.modules=[{id:'coil',rank:2}];});
 const before=snapshot(s);for(const args of [{},{weapon:'h',branch:'ricochet'},{weapon:'h',branch:'trail'},{weapon:'f',branch:'trail'}]){assert.equal(choose(s,'refit:field',args),false);assert.deepEqual(snapshot(s),before);}
 assert.ok(choose(s,'refit:field',{weapon:'h',branch:'grenade'}));assert.equal(s.weapons[0].branch,'grenade');for(const key of ['level','cd','shots','uid'])assert.equal(s.weapons[0][key],before.weapons[0][key]);assert.equal(s.tuning,before.tuning);assert.equal(s.refits,before.refits);assert.deepEqual(s.modules,before.modules);assert.equal(s.stats.fieldRefits,1);
});
test('crate overflow is explicit charge and full module loadouts receive quality-scaled packets',()=>{
 for(const [quality,rank] of [['rare',2],['prototype',3]]){const s=quiet();s.modules=[{id:'coil',rank:2}];s.player.charge=0;s.phase='choice';s.choice={type:'armory',quality};s.choices=[{id:'module:coil',kind:'module',module:'coil',rank}];assert.ok(choose(s,'module:coil'));assert.equal(s.modules[0].rank,3);assert.equal(s.player.charge,(rank-1)*20);assert.equal(s.stats.overflowCharge,(rank-1)*20);}
 for(const [i,quality] of ['common','rare','prototype'].entries()){const s=quiet();s.weapons.push({...makeWeapon('f'),uid:'fire'});s.modules=['ricochet','coil','catalyst','magnet'].map(id=>({id,rank:3}));s.phase='choice';s.choice={type:'armory',quality};s.choices=[{id:'placeholder',kind:'resupply',heal:0,charge:0}];reroll(s);assert.equal(s.choices.length,3);assert.ok(s.choices.every(c=>c.kind==='resupply'||c.module==='overcharger'));const card=s.choices.find(c=>c.id==='resupply:medical');assert.equal(card.heal,RULES.crateRewards.medicalHeal[i]);s.player.hp=50;const max=s.player.maxHp;choose(s,card.id);assert.equal(s.player.hp,50+card.heal);assert.equal(s.player.maxHp,max);}
});
test('armored support banish preserves another reachable incomplete component',()=>{
 const s=raidLoot('armored',s=>{s.weapons[0].level=4;s.weapons[0].branch='grenade';s.weapons.push({...makeWeapon('f'),uid:'fire',level:4,branch:'trail'});});
 const c=s.choices.find(c=>c.support);const other=snapshot(s.choices.filter(x=>x!==c));assert.ok(banish(s,c.id));assert.ok(s.excluded.includes(c.module));for(const card of other)assert.ok(s.choices.some(x=>JSON.stringify(x)===JSON.stringify(card)));assert.ok(s.choices.every(c=>c.kind!=='utility'));
});
test('catalyst flame selects unburned groups while explosive aim selects a burning group',()=>{
 const make=()=>{const s=quiet();s.modules=[{id:'catalyst',rank:3}];s.enemies=[enemy('fresh',960,800,'rifle',1000),enemy('hot-a',640,790,'rifle',1000),enemy('hot-b',640,810,'rifle',1000)];for(const e of s.enemies.slice(1)){e.burn=2;e.burnDps=6;}return s;};
 const f=make();f.weapons=[{...makeWeapon('f'),uid:'flame',level:4,branch:'trail',cd:0}];step(f,dt);assert.equal(f.weapons[0].targetId,'fresh');
 const r=make();r.weapons=[{...makeWeapon('r'),uid:'rocket',level:4,branch:'homing',cd:0}];step(r,dt);assert.ok(r.weapons[0].targetId.startsWith('hot'));assert.ok(takeEvents(r).includes('rocket-shot'));
 const close=make();close.enemies[0].x=850;close.weapons=[{...makeWeapon('r'),uid:'rocket',cd:0}];step(close,dt);assert.equal(close.weapons[0].targetId,'fresh');
});
test('native explosion on burning targets emits a bounded distinct heat effect',()=>{
 const s=quiet();s.modules=[{id:'catalyst',rank:3}];s.enemies=[enemy('hot',940,800,'rifle',1000),enemy('near',955,800,'rifle',1000)];s.enemies.forEach(e=>{e.burn=2;e.burnDps=6;});s.shots=[{...bullet(s,s.enemies[0],50),rocket:true,radius:100}];step(s,dt);assert.equal(s.stats.heatBursts,1);assert.equal(s.effects.filter(e=>e.type==='heat').length,1);assert.ok(takeEvents(s).includes('heat'));assert.ok(s.stats.moduleDamage>0);tick(s,.2);assert.equal(s.stats.heatBursts,1);
});
test('heat ignition is independent of the first four targets using the coil hit budget',()=>{
 const s=quiet();s.modules=[{id:'catalyst',rank:3}];const hot=enemy('last-hot',1040,800,'rifle',1000);hot.burn=1;
 s.enemies=[...Array.from({length:4},(_,i)=>enemy(`cold-${i}`,940,760+i*27,'rifle',1000)),hot];
 s.shots=[{...bullet(s,s.enemies[0],30),rocket:true,radius:140}];step(s,dt);
 assert.equal(s.stats.heatBursts,1);assert.ok(Math.abs(s.effects.find(e=>e.type==='heat').x-hot.x)<12);
});

 test('exhausted crate banish stays quality-scaled and owned support may be excluded',()=>{
 const s=quiet();s.excluded=['coil','magnet'];s.phase='choice';s.choice={type:'armory',quality:'prototype'};s.choices=[{id:'module:ricochet',kind:'module',module:'ricochet',rank:3}];assert.ok(banish(s,'module:ricochet'));assert.equal(s.choices[0].kind,'resupply');assert.equal(s.choices[0].heal,36);
 const a=quiet();a.modules=[{id:'coil',rank:1}];a.phase='choice';a.choice={type:'raid-reward',quality:'rare',contract:'armored'};a.choices=[{id:'module:coil',kind:'module',module:'coil',rank:2,support:true}];assert.ok(banish(a,'module:coil'));assert.equal(a.modules[0].rank,1);assert.ok(!a.excluded.includes('coil'));assert.ok(!a.choices.some(c=>c.module==='coil'));
 });
 test('burning strategic targets keep flame attention and malformed packet checkpoints fail early',()=>{
 for(const type of ['boss','courier']){const s=quiet();s.modules=[{id:'catalyst',rank:3}];s.weapons=[{...makeWeapon('f'),uid:'flame',level:4,branch:'trail',cd:0}];const target=enemy('strategic',950,800,'rifle',1000);target.type=type;target.burn=2;target.burnDps=6;if(type==='boss'){s.boss.active=true;s.stage='boss';Object.assign(s.boss,target,{timer:99,parts:[],mode:'recover'});}else s.raid={state:'active',contract:'light',target,route:[{x:950,y:800},{x:1000,y:800}],progress:0,maxProgress:1400,quality:'common'};s.enemies=[enemy('a',650,780,'rifle',1000),enemy('b',650,820,'rifle',1000)];step(s,dt);assert.equal(s.weapons[0].targetId,'strategic');}
 const s=quiet();s.phase='choice';s.choice={type:'armory',quality:'rare'};s.choices=[{id:'bad',kind:'resupply',heal:-1,charge:0}];assert.throws(()=>restore(s));
 });

test('capstone contacts use the same bounded sound lanes as other weapons',async()=>{
 const {selectAudioEvents}=await import('../src/game/audio.js');
 assert.deepEqual(selectAudioEvents(new Set(['conduit-impact','power-kill','swarm-shot'])),['swarm-shot','conduit-impact']);
 assert.deepEqual(selectAudioEvents(new Set(['conduit-impact','conduit-hop','inferno-jet','flame-loop'])),['inferno-jet','conduit-hop']);
 assert.deepEqual(selectAudioEvents(new Set(['conduit-impact','inferno-jet','hurt'])),['hurt']);
});
test('heat audio stays distinct while hurt keeps foreground priority',async()=>{const {selectAudioEvents}=await import('../src/game/audio.js');assert.deepEqual(selectAudioEvents(new Set(['heat-break','power-kill'])),['heat-break']);assert.deepEqual(selectAudioEvents(new Set(['heat-break','flame-loop','hurt'])),['hurt']);});

function quietOperation(operator='fio'){const s=createOperation(17,[],null,null,operator);s.sites.forEach(n=>n.state='done');s.blocks=[];s.enemies=[];s.spawnClock=999;s.player.x=800;s.player.y=800;s.weapons[0].cd=999;return s;}
function downBoss(s){s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.hp=1;s.boss.timer=999;s.boss.spawnClock=999;s.boss.parts=[];s.enemies=[];s.spawnClock=999;s.player.x=800;s.player.y=800;s.shots=[bullet(s,s.boss)];step(s,dt);}
function clearRegion(s){downBoss(s);assert.equal(s.phase,'playing');assert.equal(s.stage,'holdout');Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.equal(s.choice.type,'clear');}
test('the fusion showcase waits through the boss attack and survives a quick gate transition',()=>{
 const s=quietOperation();Object.assign(s.weapons[0],{level:4,branch:'ricochet'});s.weapons.push({...makeWeapon('r'),uid:'r',level:4,branch:'homing',cd:999});s.modules=[{id:'coil',rank:2}];
 assert.ok(action(s,'gear'));assert.ok(choose(s,'fusion:h:r'));Object.assign(s.player,{x:800,y:350});assert.ok(action(s,'interact'));
 s.boss.mode='charge';s.boss.cycle=1;s.boss.timer=99;s.boss.spawnClock=99;tick(s,1);
 assert.equal(s.powerWave.paired,3);assert.ok(s.enemies.every(e=>e.waveGroup==null));
 s.boss.mode='recover';tick(s,.72);assert.equal(s.powerWave.paired,2);
 assert.ok(s.enemies.filter(e=>e.waveGroup!=null).length>=8);
 clearRegion(s);assert.ok(choose(s,'advance'));assert.equal(s.powerWave.showcase,'fusion');assert.equal(s.powerWave.paired,2);
});
test('entering a boss keeps the staged infantry and lets a pending wave approach from behind during opening aim',()=>{
 const s=quietOperation();Object.assign(s.player,{aim:Math.PI/2});
 Object.assign(s.weapons[0],{level:4,branch:'ricochet'});s.weapons.push({...makeWeapon('r'),uid:'r',level:4,branch:'homing',cd:999});s.modules=[{id:'coil',rank:2}];
 assert.ok(action(s,'gear'));assert.ok(choose(s,'fusion:h:r'));tick(s,.72);
 const first=s.enemies.filter(e=>e.showcase==='fusion').map(e=>e.id);
 assert.equal(first.length,12);
 s.enemies.push(enemy('ordinary',800,1060));
 Object.assign(s.player,{x:800,y:350});assert.ok(action(s,'interact'));
 assert.ok(first.every(id=>s.enemies.some(e=>e.id===id)));
 assert.ok(!s.enemies.some(e=>e.id==='ordinary'));
 tick(s,.95);
 assert.equal(s.boss.mode,'aim');assert.equal(s.powerWave.paired,1);
 const second=s.enemies.filter(e=>e.showcase==='fusion'&&!first.includes(e.id));
 assert.ok(second.length>=8&&second.every(e=>e.y>s.player.y+80));
});
test('Inferno forms a dense lane even when heat synergy was completed earlier',()=>{
 const s=quiet();s.powerDone=true;s.stats.completedBuild={kind:'synergy',t:0};s.weapons=[{...makeWeapon('f'),uid:'inferno',level:6,branch:'trail',cd:999}];s.modules=[{id:'catalyst',rank:2}];
 assert.ok(action(s,'gear'));assert.ok(choose(s,'evolve:f'));assert.equal(s.powerWave.showcase,'flame');tick(s,.72);
 const markers=s.effects.filter(e=>e.type==='formation');assert.equal(markers.length,2);assert.ok(markers.every(e=>e.showcase==='flame'));
 assert.ok(Math.abs(Math.hypot(markers[0].x-markers[1].x,markers[0].y-markers[1].y)-74)<1e-6);
 assert.equal(s.stats.completedBuild.kind,'synergy');assert.equal(s.enemies.length,8);
});
test('campaign advances real maps while retaining gear, HP, XP, tokens and earned choices',()=>{
 const s=quietOperation();s.weapons[0].level=4;s.weapons[0].branch='grenade';s.modules=[{id:'coil',rank:2}];s.player.hp=50;s.xp=4;clearRegion(s);assert.equal(s.operation.cleared,1);assert.equal(s.player.hp,65);assert.equal(s.tuning,2);const gear=snapshot(s.weapons),modules=snapshot(s.modules),hp=s.player.hp,xp=s.xp;assert.ok(choose(s,'stay'));assert.equal(s.operation.region,0);s.player.x=800;s.player.y=420;assert.equal(action(s,'interact'),false);Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.ok(choose(s,'advance'));assert.equal(s.operation.region,1);assert.equal(s.operation.regionTime,0);assert.equal(s.pressure,0);assert.deepEqual(s.weapons,gear);assert.deepEqual(s.modules,modules);assert.equal(s.player.hp,hp+20);assert.equal(s.operation.support,'vanguard');assert.equal(s.xp,xp);assert.ok(s.sites.some(n=>n.kind==='relay'));assert.ok(s.blocks.some(b=>b.id==='r1'));assert.deepEqual(restore(snapshot(s)).operation,s.operation);
});
test('intermediate return is partial and only the third clear permits full extraction once',()=>{
 const partial=quietOperation();clearRegion(partial);choose(partial,'extract');assert.equal(partial.result.won,false);assert.equal(partial.result.operation.cleared,1);
 const s=quietOperation();for(let i=0;i<3;i++){clearRegion(s);if(i<2)assert.ok(choose(s,'advance'));}assert.equal(s.tuning,3);assert.equal(s.operation.cleared,3);assert.ok(!s.choices.some(c=>c.kind==='advance'));assert.ok(choose(s,'extract'));assert.ok(s.result.won);const score=s.stats.score;assert.equal(finish(s,true),false);assert.equal(s.stats.score,score);
});
test('a simultaneous intermediate boss death cannot heal or advance a dead pilot',()=>{
 const s=quietOperation();s.player.hp=1;s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.hp=1;s.boss.timer=999;s.boss.spawnClock=999;s.boss.parts=[];s.shots=[bullet(s,s.boss)];s.enemyShots=[{x:800,y:800,vx:0,vy:0,life:1,r:5}];step(s,dt);assert.equal(s.phase,'result');assert.equal(s.player.hp,0);assert.equal(s.tuning,1);assert.equal(s.result.operation.cleared,1);assert.equal(s.result.won,false);
});
const overlapsCover=(s,e,r)=>s.blocks.some(b=>b.hp!==0&&e.x+r>b.x&&e.x-r<b.x+b.w&&e.y+r>b.y&&e.y-r<b.y+b.h);
function coastEncounter(hp){
 const s=quietOperation();
 s.stage='boss';Object.assign(s.boss,{active:true,timer:0});
 Object.assign(s.player,{x:800,y:470});
 s.blocks=hp===undefined?[]:[{id:'test-cover',x:740,y:350,w:120,h:60,hp,maxHp:hp}];
 return s;
}
function runLockedCharge(s){
 let ticks=0;
 while(['windup','charge'].includes(s.boss.mode)&&ticks++<120)step(s,dt);
 assert.equal(s.boss.mode,'recover');
}
test('coast boss entry is clear on both mirrored shores with live cover',()=>{
 for(const seed of [17,18,19,22]){
  const s=createOperation(seed);
  Object.assign(s.player,{x:800,y:350});
  assert.ok(action(s,'interact'));assert.equal(s.stage,'boss');
  assert.ok(!overlapsCover(s,s.player,16));
  assert.ok(s.blocks.find(b=>b.id==='b2').hp>0);
 }
});
test('a locked coast charge stops at its preview against permanent cover and leaves the rear open',()=>{
 const s=coastEncounter(-1);step(s,dt);
 const lane=coastChargeLane(s);
 assert.equal(lane.blockId,'test-cover');assert.equal(lane.r,s.boss.r+16);
 assert.ok(Math.abs(lane.endY-(350-s.boss.r))<.1);
 s.player.x=1040;
 runLockedCharge(s);
 assert.ok(Math.hypot(s.boss.x-lane.endX,s.boss.y-lane.endY)<.01);
 assert.ok(!overlapsCover(s,s.boss,s.boss.r));
 assert.equal(s.blocks[0].hp,-1);
 assert.equal(s.boss.timer,COAST_CHARGE.recover+COAST_CHARGE.impactBonus);
 assert.ok(takeEvents(s).includes('charge-impact'));
});
test('coast cover breaks on impact, and an early break does not lengthen the locked lane',()=>{
 for(const clearedEarly of [false,true]){
  const s=coastEncounter(240);step(s,dt);
  const lane=coastChargeLane(s);assert.equal(lane.blockId,'test-cover');
  if(clearedEarly)s.blocks[0].hp=0;
  runLockedCharge(s);
  assert.equal(s.blocks[0].hp,0);
  assert.ok(Math.hypot(s.boss.x-lane.endX,s.boss.y-lane.endY)<.01);
  assert.equal(s.boss.timer,COAST_CHARGE.recover+(clearedEarly?0:COAST_CHARGE.impactBonus));
  assert.equal(takeEvents(s).includes('charge-impact'),!clearedEarly);
 }
});
test('a coast charge brakes at the edge and b26 embedded checkpoints keep their remaining charge',()=>{
 const edge=coastEncounter();
 Object.assign(edge.boss,{x:1430,y:400});Object.assign(edge.player,{x:1520,y:400});
 step(edge,dt);const limit=FIELD.right-edge.boss.r-25;
 assert.equal(coastChargeLane(edge).endX,limit);runLockedCharge(edge);
 assert.equal(edge.boss.x,limit);assert.equal(edge.boss.timer,COAST_CHARGE.recover);
 const old=createOperation(18);old.balanceRevision='b26-rail-gun-lock';old.stage='boss';
 Object.assign(old.boss,{active:true,mode:'charge',x:800,y:445,body:Math.PI/2,timer:.4});
 Object.assign(old.player,{x:800,y:470});
 const restored=restore(snapshot(old));
 assert.ok(!overlapsCover(restored,restored.player,16));assert.ok(!overlapsCover(restored,restored.boss,restored.boss.r));
 assert.equal(restored.boss.body,Math.PI/2);assert.equal(restored.boss.timer,.4);
 assert.equal(restored.boss.chargePath.offset,150);
 runLockedCharge(restored);assert.ok(!overlapsCover(restored,restored.boss,restored.boss.r));
 const clear=coastEncounter();Object.assign(clear.boss,{mode:'charge',timer:.4,body:Math.PI/2});
 const resumed=restore(snapshot(clear)),start=resumed.boss.y;
 runLockedCharge(resumed);assert.equal(resumed.boss.y-start,150);
 Object.assign(clear.boss,{mode:'windup',timer:.4,chargePath:{x:-10000,y:-10000,length:100,offset:0}});
 assert.throws(()=>restore(snapshot(clear)),/체크포인트/);
 const through=coastEncounter(-1);step(through,dt);
 assert.deepEqual(restore(snapshot(through)).boss.chargePath,through.boss.chargePath);
 Object.assign(through.boss.chargePath,{length:300,blockId:null});
 assert.throws(()=>restore(snapshot(through)),/체크포인트/);
});
test('rail and harbor use different telegraphs and disabled rail parts open permanent safe lanes',()=>{
 const s=quietOperation();s.operation.region=1;s.stage='boss';s.boss.active=true;s.boss.timer=0;s.boss.parts[0].hp=0;step(s,dt);assert.ok(s.hazards.some(h=>h.lane));assert.ok(!s.hazards.some(h=>h.lane&&h.x===500));assert.equal(s.boss.mode,'salvo');
 const p=quietOperation();p.operation.region=2;p.stage='boss';p.boss.active=true;p.boss.timer=0;step(p,dt);assert.ok(p.hazards.length>=3);assert.ok(p.hazards.every(h=>!h.lane));
});
function railEncounter(x=800){
 const s=quietOperation();
 s.operation.region=1;s.stage='boss';
 s.boss={...regionBoss(1,s.seed),active:true,timer:0,spawnClock:999};
 Object.assign(s.player,{x,y:470});
 return s;
}
test('rail artillery locks the first position, leaves a path out and clips the map boundary',()=>{
 const s=railEncounter(),hold=railEncounter();
 for(const r of [s,hold])step(r,dt);
 const lane=s.hazards.find(h=>h.tracked);
 assert.equal(lane.x,800);assert.equal(lane.w,RAIL_BARRAGE.width);
 assert.notEqual(lane.railGun,s.hazards.find(h=>!h.tracked).railGun);
 tick(s,.7,{x:1,y:0});
 assert.equal(lane.x,800);assert.ok(s.player.x>906);
 tick(s,.6);tick(hold,1.3);
 assert.equal(s.player.hp,100);assert.equal(hold.player.hp,86);
 const edge=railEncounter(FIELD.left+16);step(edge,dt);
 const clipped=edge.hazards.find(h=>h.tracked);
 assert.equal(clipped.x-clipped.w/2,FIELD.left);
 assert.equal(clipped.x+clipped.w/2,edge.player.x+RAIL_BARRAGE.width/2);
});
test('direct hits cancel only the destroyed gun and leave the disarmed train open',()=>{
 const s=railEncounter();step(s,dt);
 const first=s.hazards.find(h=>h.tracked),other=s.hazards.find(h=>!h.tracked);
 const breakGun=i=>{
  const part=s.boss.parts[i];
  part.hp=1;
  s.shots=[bullet(s,{id:part.id,x:s.boss.x+part.ox+Math.sign(part.ox)*22,y:s.boss.y},5)];
  step(s,dt);
  assert.equal(part.hp,0);
 };
 breakGun(first.railGun);
 assert.deepEqual(s.hazards,[other]);
 assert.ok(takeEvents(s).includes('barrage-cancel'));
 breakGun(other.railGun);
 assert.equal(s.boss.mode,'recover');assert.equal(s.hazards.length,0);
 tick(s,6);
 assert.equal(s.player.hp,100);assert.equal(s.boss.mode,'recover');assert.equal(s.hazards.length,0);
});
test('a burning rail gun that breaks on the final warning tick cannot hit its lane',()=>{
 const s=railEncounter();step(s,dt);
 const lane=s.hazards.find(h=>h.tracked),part=s.boss.parts[lane.railGun];
 Object.assign(part,{hp:1,burn:1,burnTick:.01,burnDps:10,x:s.boss.x+part.ox,y:s.boss.y});
 lane.timer=.02;
 step(s,1/30);
 assert.equal(part.hp,0);assert.equal(s.player.hp,100);assert.ok(!s.hazards.includes(lane));
 assert.ok(takeEvents(s).includes('barrage-cancel'));
});
test('b25 checkpoint drops a dead gun warning while preserving a live and a fired lane',()=>{
 const s=railEncounter();
 Object.assign(s,regionLayout(mapSeed(s.seed,1),1));
 s.balanceRevision='b25-convoy-routes';s.boss.mode='salvo';s.boss.timer=.9;s.boss.parts[0].hp=0;
 const lane=x=>({x,y:600,w:220,h:900,r:0,lane:true,timer:.7});
 s.hazards=[lane(500),lane(800),lane(1100),{...lane(500),hit:true,timer:-.1}];
 const r=restore(snapshot(s));
 assert.deepEqual(r.hazards.map(h=>[h.x,!!h.hit]),[[800,false],[1100,false],[500,true]]);
 assert.equal(r.boss.timer,.9);
});
test('relay progresses only while in range and port control offers a real safety or loot trade',()=>{
 const s=quietOperation();s.operation.region=1;s.sites=[{id:'relay',kind:'relay',name:'relay',state:'active',x:800,y:800,progress:0}];tick(s,1);assert.ok(s.sites[0].progress>.9);s.player.x=1100;const before=s.sites[0].progress;tick(s,1);assert.equal(s.sites[0].progress,before);
 const p=quietOperation();p.operation.region=2;p.sites=[{id:'control',kind:'control',name:'control',state:'ready',x:800,y:800}];step(p,dt);assert.equal(p.choice.type,'control');const loot=restore(snapshot(p));assert.ok(choose(p,'control:jam'));assert.equal(p.operation.jammed,true);assert.ok(choose(loot,'control:loot'));assert.equal(loot.choice.type,'armory');assert.equal(loot.choice.quality,'rare');
});
test('campaign rewards settle once and research adds a future slotted candidate rather than free damage',()=>{
 const s=quietOperation();let p=beginProfile(emptyProfile(),s);for(let i=0;i<3;i++){clearRegion(s);if(i<2)choose(s,'advance');}choose(s,'extract');p=settleProfile(p,s);assert.equal(p.credits,710);assert.ok(p.milestones.medic);assert.equal(p.records.wins,1);const again=settleProfile(p,s);assert.equal(again.credits,710);const researched=buyResearch(p,'medic');assert.equal(researched.credits,410);assert.deepEqual(researched.research,['medic']);assert.deepEqual(researched.trials,['medic']);assert.equal(buyResearch(researched,'medic'),null);assert.equal(p.credits,710);
 const next=createOperation(71,researched.research,'medic');next.sites.forEach(n=>n.state='done');next.enemies=[];next.spawnClock=999;supply(next);assert.ok(next.choices.some(c=>c.module==='medic'));assert.equal(next.modules.length,0);assert.ok(choose(next,'module:medic'));assert.equal(next.modules[0].rank,1);assert.equal(next.stats.researchTrialPicked,'medic');
});
test('a settled fusion unlocks shrapnel in a fresh sortie and its payload uses the equipped research',()=>{
 const s=quietOperation(),profile=beginProfile(emptyProfile(),s);s.weapons[0].fusion={secondary:'r',branch:'homing',overflow:0};
 for(let i=0;i<3;i++){clearRegion(s);if(i<2)choose(s,'advance');}choose(s,'extract');
 const settled=settleProfile(profile,s),researched=buyResearch(settled,'shrapnel');
 assert.deepEqual(settled.recent[0].researchUnlocked,['medic','shrapnel']);
 assert.equal(settled.credits-researched.credits,350);
 const {run,next}=freshSortie(researched,16);run.enemies=[];run.spawnClock=999;run.sites.forEach(site=>site.state='done');
 assert.deepEqual(run.weapons.map(w=>[w.id,w.level]),[['h',1]]);assert.equal(run.modules.length,0);
 assert.ok(supply(run).every(c=>c.id!=='module:shrapnel'));assert.ok(choose(run,'gun:r'));
 assert.equal(supply(run,'supply-b').find(c=>c.id==='module:shrapnel')?.label,'새 연구 · 첫 실전');assert.ok(choose(run,'module:shrapnel'));
 const checkpoint=checkpointProfile(next,run);assert.deepEqual(checkpoint.research,['shrapnel']);assert.deepEqual(checkpoint.trials,[]);
 Object.assign(run.weapons[0],{level:4,branch:'ricochet',cd:999});Object.assign(run.weapons[1],{level:4,branch:'homing',cd:999});run.modules.push({id:'coil',rank:2});assert.ok(action(run,'gear'));assert.ok(choose(run,'fusion:h:r'));
 const dummy=enemy('fused-hit',run.player.x,run.player.y-100,'rifle',1000);run.enemies=[dummy];run.shots=[bullet(run,dummy,1)];step(run,dt);
 assert.equal(run.stats.payloadBursts,1);assert.equal(run.stats.shrapnelBursts,1);assert.equal(run.effects.filter(f=>f.type==='shrapnel').length,3);
 assert.equal(run.effects.filter(f=>f.type==='payload-impact').length,1);
 assert.ok(!run.effects.some(f=>f.type==='payload'));
 tick(run,.3);assert.equal(run.stats.shrapnelBursts,1);
});
test('a pending route trial keeps the signature module and prioritizes the matching experiment',()=>{
 for(const [gun,site,signature,experiment] of [
  ['r','supply-c','coil','shrapnel'],['f','supply-b','catalyst','thermal']
 ]){
  const s=quietOperation();s.research=['medic',experiment];s.trials=[...s.research];
  supply(s);assert.ok(choose(s,`gun:${gun}`));
  if(gun==='f')s.modules.push({id:'coil',rank:1});
  for(const cards of [supply(s,site),null]){
   if(!cards)assert.ok(reroll(s));
   assert.equal(s.choices.length,4);
   assert.ok(s.choices.some(c=>c.id===`coast:${gun}`));
   assert.ok(s.choices.some(c=>c.module===signature&&c.label==='이 동선의 특화 모듈'));
   assert.ok(s.choices.some(c=>c.module===experiment&&c.label==='새 연구 · 첫 실전'));
  }
  assert.ok(choose(s,`module:${signature}`));
  assert.deepEqual(s.trials,['medic',experiment]);
 }
});
test('the equipped thermal module retains its prerequisite coil until it is removed',()=>{
 const s=quietOperation();s.research=['thermal','medic'];s.trials=[...s.research];
 s.weapons.push({...makeWeapon('f'),uid:'fire'});
 s.modules=['coil','magnet','ricochet','catalyst'].map(id=>({id,rank:1}));
 supply(s,'supply-b');
 assert.equal(choose(s,'module:thermal',{slot:0}),false);
 assert.deepEqual(s.trials,['thermal','medic']);assert.equal(s.modules[0].id,'coil');
 assert.ok(choose(s,'module:thermal',{slot:1}));
 assert.equal(s.modules[1].id,'thermal');assert.deepEqual(s.trials,['medic']);
 supply(s,'supply-c');
 assert.equal(choose(s,'module:medic',{slot:0}),false);
 assert.ok(choose(s,'module:medic',{slot:1}));
 assert.equal(s.modules[0].id,'coil');assert.equal(s.modules[1].id,'medic');
});
test('researched effects are conditional, capped and cannot recursively trigger themselves',()=>{
 const s=quiet();s.modules=[{id:'shrapnel',rank:1}];s.enemies=[enemy('burst',940,800,'rifle',1000),enemy('fringe',1012,800,'rifle',5)];s.shots=[{...bullet(s,s.enemies[0],50),rocket:true,radius:50}];step(s,dt);assert.equal(s.stats.shrapnelBursts,1);assert.equal(s.effects.filter(f=>f.type==='shrapnel').length,3);assert.equal(s.stats.shrapnelKills,1);assert.ok(s.stats.shrapnelHits>1);
 const m=quiet();m.modules=[{id:'medic',rank:1}];m.player.hp=m.player.maxHp-4;m.enemies=[enemy('elite-a',940,800,'officer',1),enemy('elite-b',960,800,'officer',1)];m.shots=m.enemies.map(e=>bullet(m,e));step(m,dt);assert.equal(m.player.hp,m.player.maxHp);assert.equal(m.stats.medicRecovered,4);assert.ok(m.medicCd>0);
 const t=quiet();t.modules=[{id:'thermal',rank:1},{id:'coil',rank:1}];t.player.charge=100;t.coil=18;
 const burning={...enemy('burning',940,800,'rifle',1000),burn:2,burnTick:1,burnDps:10};t.enemies=[burning];t.shots=[bullet(t,burning,1)];
 step(t,dt);assert.equal(t.stats.thermalRecovered,0);
 t.player.charge=99;t.coil=18;t.coilCd=t.thermalCd=0;t.shots=[bullet(t,burning,1)];
 step(t,dt);assert.equal(t.player.charge,100);assert.ok(t.stats.thermalRecovered>.9&&t.stats.thermalRecovered<1);
});
test('final stay and menu retreat remain partial until the exit extraction decision',()=>{
 const s=quietOperation();s.operation.region=2;clearRegion(s);choose(s,'stay');const partial=snapshot(s);assert.ok(finish(partial,true,'retreat'));assert.equal(partial.result.won,false);assert.ok(!partial.stats.extractionPaid);Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.ok(choose(s,'extract'));assert.ok(s.result.won);assert.ok(s.operation.extracted);
});
test('seed 19 can extract after all three fronts with evolved fire and no checkpoint edits',()=>{
 const run=pilot(19,'fire',{operation:true,pursuit:'all',maxSeconds:240});
 assert.ok(run.won&&!run.stalled);assert.equal(run.regions,3);assert.ok(run.hp>0);assert.ok(run.weapons.some(w=>w.id==='f'&&w.evolved));
});
test('checkpoints and settlements reject a different run instance including same-seed replay',()=>{
 const a=quietOperation(),p=beginProfile(emptyProfile(),a),other=quietOperation();const q=beginProfile({...emptyProfile(),sequence:1},other);assert.notEqual(a.runId,other.runId);for(let i=0;i<3;i++){clearRegion(other);if(i<2)choose(other,'advance');}choose(other,'extract');const before=snapshot(p);assert.throws(()=>checkpointProfile(p,other));assert.throws(()=>settleProfile(p,other));assert.deepEqual(p,before);assert.equal(q.active.runId,other.runId);
});
test('campaign holdout opens D2 after D1 with rising score and finite credit basis',()=>{
 const s=quietOperation();clearRegion(s);choose(s,'stay');assert.ok(action(s,'challenge'));assert.equal(s.challenge.tier,1);s.operation.holdoutKills=HOLDOUT.rareKills;s.challenge.targets.forEach(id=>{s.enemies.find(e=>e.id===id).dead=true;});step(s,dt);assert.equal(s.challenge.state,'complete');assert.equal(s.stats.challenge,1);const score=s.stats.score;assert.ok(choose(s,'support:breach'));assert.ok(action(s,'challenge'));assert.equal(s.challenge.tier,2);s.challenge.targets.forEach(id=>{s.enemies.find(e=>e.id===id).dead=true;});step(s,dt);assert.equal(s.stats.challenge,2);assert.equal(s.stats.score-score,1000);assert.equal(s.stats.challengeWins,2);
});
test('rare parts wait for actual reinforcements and match the fixed seed preview',()=>{
 const s=quietOperation();clearRegion(s);assert.ok(choose(s,'stay'));assert.ok(action(s,'challenge'));
 s.enemies.filter(e=>e.cohort==='challenge').forEach(e=>e.dead=true);step(s,dt);
 assert.ok(s.challenge.secured);assert.equal(s.phase,'playing');assert.equal(s.stats.challengeWins,undefined);
 s.operation.holdoutKills=HOLDOUT.rareKills-1;
 const guard={...enemy('reinforcement',1150,850,'rifle',10),cohort:'holdout'};
 s.enemies=[guard];s.shots=[bullet(s,guard)];step(s,dt);
 assert.equal(s.operation.holdoutKills,HOLDOUT.rareKills);assert.equal(s.stats.holdoutDefeated,1);
 assert.equal(s.choice.quality,'rare');
 assert.deepEqual(s.choices.filter(c=>c.kind==='front-support').map(c=>c.key),holdoutParts(s.seed,0));
 assert.ok(s.choices.some(c=>c.kind==='resupply'));
});
test('fast advance gives one longer warning, while late advance skips the early kit',()=>{
 const warning=holdTime=>{
  const s=quietOperation();clearRegion(s);s.holdTime=holdTime;assert.ok(choose(s,'advance'));
  s.stage='boss';Object.assign(s.boss,{active:true,mode:'aim',timer:0});step(s,dt);
  const first=s.hazards.find(h=>h.lane).timer;
  s.hazards=[];Object.assign(s.boss,{mode:'aim',timer:0});step(s,dt);
  return {first,second:s.hazards.find(h=>h.lane).timer,uses:s.stats.supportUses?.[1]||0};
 };
 const early=warning(0),late=warning(HOLDOUT.grace);
 assert.equal(early.uses,1);assert.equal(late.uses,0);assert.equal(early.first-late.first,1);assert.equal(early.second,late.second);
});
test('advance preview matches emergency stabilization and preserves tuning',()=>{
 for(const [hp,expected] of [[25,60],[43,63],[95,100]]){
  const s=quietOperation();clearRegion(s);
  Object.assign(s.player,{hp,charge:90});
  const card=s.choices.find(c=>c.id==='advance'),tuning=s.tuning;
  assert.equal(choiceDetails(s,card).cost,`도착 시 체력 ${hp} → ${expected} · 전탄 90 → 100`);
  assert.ok(choose(s,'advance'));assert.equal(s.player.hp,expected);
  assert.equal(s.player.charge,100);assert.equal(s.tuning,tuning);
 }
});
test('a holdout reward carries only to the next front and survives a checkpoint',()=>{
 const s=quietOperation(),profile=beginProfile(emptyProfile(),s);
 clearRegion(s);choose(s,'stay');assert.ok(action(s,'challenge'));
 const resumed=restore(checkpointProfile(profile,s).active.run);
 resumed.operation.holdoutKills=HOLDOUT.rareKills;
 for(const target of resumed.enemies)if(resumed.challenge.targets.includes(target.id))target.dead=true;
 step(resumed,dt);assert.equal(resumed.choice.type,'pursuit-reward');assert.equal(resumed.choices.length,3);
 const offered=restore(checkpointProfile(profile,resumed).active.run),reach=pickupReach(offered);
 assert.ok(choose(offered,'support:recovery'));assert.equal(pickupReach(offered),reach);
 assert.equal(choose(offered,'support:breach'),false);
 assert.ok(action(offered,'interact'));assert.ok(choose(offered,'advance'));
 assert.equal(pickupReach(restore(snapshot(offered))),reach+55);
 clearRegion(offered);assert.ok(choose(offered,'advance'));assert.equal(pickupReach(offered),reach);
});
test('front support changes the actual damage path for armor and crowd builds',()=>{
 const armor=quietOperation();armor.operation.region=1;armor.stage='boss';armor.boss.active=true;
 armor.boss.x=1000;armor.boss.y=800;armor.boss.timer=999;armor.boss.spawnClock=999;
 armor.shots=[bullet(armor,{x:920,y:800})];
 const breach=restore(snapshot(armor));breach.operation.support='breach';
 step(armor,dt);step(breach,dt);
 assert.equal(armor.boss.parts[0].hp,350);assert.equal(breach.boss.parts[0].hp,295);

 const crowd=quietOperation();crowd.operation.support='overrun';crowd.player.dash=.01;
 crowd.enemies=[enemy('near',850,800,'rifle',100),enemy('far',1000,800,'rifle',100)];
 step(crowd,dt);assert.deepEqual(crowd.enemies.map(e=>e.hp),[15,100]);
});
function supportArena(index,support,mode){
 const s=quietOperation();Object.assign(s.operation,{region:index,support});s.stage='boss';
 Object.assign(s.boss,{active:true,x:800,y:250,mode,cycle:1,timer:999,spawnClock:999});return s;
}
test('rail parts retain the part hit, dash and XP routes',()=>{
 const opening=supportArena(1,'overrun','recover');Object.assign(opening.player,{x:800,y:400,dash:.01});step(opening,dt);
 assert.equal(opening.boss.parts[0].hp,190);
 const recovery=supportArena(1,'recovery','salvo');recovery.boss.timer=0;step(recovery,dt);
 assert.deepEqual(recovery.gems.map(g=>[g.x,g.y,g.value,g.salvage]),[[625,470,18,true]]);
});
test('a coastal strike trades the first matching supply for a single attack window',()=>{
 const s=quietOperation();
 supply(s);assert.ok(choose(s,'gun:f'));
 assert.ok(!supply(s,'supply-c').some(c=>c.kind==='coast-strike'));assert.ok(choose(s,s.choices[0].id));
 supply(s,'supply-b');
 const candidate=restore(snapshot(s));assert.ok(choose(candidate,'coast:f'));
 const battle=restore(snapshot(candidate));assert.equal(battle.operation.coastStrike,'f');
 const premature=snapshot(battle);premature.operation.coastStrikeUsed=true;
 assert.throws(()=>restore(premature),/체크포인트/);
 Object.assign(battle.boss,{active:true,x:800,y:250,body:Math.PI/2,mode:'recover',timer:3,spawnClock:999});
 battle.stage='boss';battle.enemies=[];battle.blocks=[];
 const flame=battle.weapons.find(w=>w.id==='f');
 Object.assign(battle.player,{x:800,y:382});flame.cd=0;step(battle,dt);
 assert.equal(battle.operation.coastStrikeUsed,undefined);
 Object.assign(battle.player,{x:800,y:122});flame.cd=0;
 const before=battle.boss.hp,timer=battle.boss.timer;
 step(battle,dt);
 assert.ok(before-battle.boss.hp>=560);
 assert.ok(battle.boss.timer>timer+1.9);
 assert.equal(battle.operation.coastStrikeUsed,true);
 const resumed=restore(snapshot(battle)),hp=resumed.boss.hp;
 resumed.weapons.find(w=>w.id==='f').cd=0;step(resumed,dt);
 assert.ok(hp-resumed.boss.hp<100);
 downBoss(resumed);Object.assign(resumed.player,exitGate(resumed));
 assert.ok(action(resumed,'interact'));assert.ok(choose(resumed,'advance'));
 assert.equal(resumed.choice.source,'장갑 수송차 노획');
 assert.equal(restore(snapshot(resumed)).choice.coastRecovery,true);
 const duplicate=snapshot(resumed);
 duplicate.queue.push({type:'supply',source:resumed.choice.source,cards:duplicate.choices,extra:{coastRecovery:true}});
 assert.throws(()=>restore(duplicate),/체크포인트/);
 assert.ok(resumed.choices.some(c=>c.id==='module:catalyst'));
 assert.ok(reroll(resumed));assert.ok(resumed.choices.some(c=>c.id==='module:catalyst'));
});
test('a long-range rocket interrupts the fixed coastal charge, once and only during warning',()=>{
 function shot(gap,mode,weapon){
  const s=supportArena(0,null,mode);
  s.firstNew='r';s.operation.coastStrike='r';
  Object.assign(s.player,{x:800,y:250+gap});
  s.weapons=[{...makeWeapon(weapon),uid:'test',cd:999}];
  s.boss.timer=.85;step(s,dt);
  s.shots=[{...bullet(s,s.boss,20),rocket:true,radius:60}];
  step(s,dt);return s;
 }
 const applied=shot(205,'windup','r');
 assert.equal(applied.operation.coastStrikeUsed,true);
 assert.equal(applied.boss.mode,'recover');assert.equal(applied.boss.chargePath,undefined);
 assert.ok(applied.boss.maxHp-applied.boss.hp>=780);
 for(const refused of [shot(130,'windup','r'),shot(205,'aim','r'),shot(205,'windup','h')])assert.equal(refused.operation.coastStrikeUsed,undefined);
});
test('harbor armor support rewards a flank and disables the turret fan',()=>{
 const front=supportArena(2,'breach','salvo'),flank=restore(snapshot(front));
 for(const [s,x] of [[front,800],[flank,650]]){
  Object.assign(s.player,{x,y:410});s.shots=[bullet(s,{x:743,y:250},300)];step(s,dt);
  s.boss.timer=0;step(s,dt);
 }
 assert.equal(front.boss.parts[0].hp,450);assert.equal(front.enemyShots.length,9);
 assert.equal(flank.boss.parts[0].hp,0);assert.equal(flank.enemyShots.length,0);assert.equal(flank.stats.supportUses[2],1);
});
test('harbor artillery fixes its opening axis by entry and leaves a perpendicular escape',()=>{
 for(const seed of [17,18])for(const hatch of [false,true]){
  const s=supportArena(2,null,'aim');
  s.boss={...regionBoss(2,seed),active:true,timer:0,spawnClock:999};
  if(hatch){s.operation.portEntry='gantry';s.operation.portDock=true;s.sites=[{id:'port-landing',state:'done'}];}
  Object.assign(s.player,{x:800,y:470});step(s,dt);
  const aim=s.hazards.find(h=>h.portRound==='lock'),side=Math.sign(s.boss.parts[0].ox);
  assert.deepEqual([aim.x,aim.y],[800,470]);
  assert.equal(aim.portAxis,hatch?'vertical':'horizontal');
  assert.equal(portBarrageMark(aim.portAxis,side),hatch?(side>0?'←':'→'):'↑↓');
  assert.equal(s.hazards.filter(h=>h.portRound==='turret'&&(h.x-aim.x)*side>0).length,2);
  const cross=hatch?{x:-side,y:0}:{x:0,y:1},parallel=hatch?{x:0,y:1}:{x:-side,y:0};
  const escape=restore(snapshot(s)),bad=restore(snapshot(s)),hp=s.player.hp;
  tick(s,1);tick(escape,1,cross);tick(bad,1,parallel);
  assert.equal(s.player.hp,hp-14);assert.equal(escape.player.hp,hp);assert.equal(bad.player.hp,hp-14);
  assert.deepEqual([escape.hazards.find(h=>h.portRound==='lock').x,aim.y],[800,470]);
 }
});
test('harbor jamming cancels the first rake and breaking the plate clears only unfired rake rounds',()=>{
 for(const hatch of [false,true]){
  const s=supportArena(2,null,'aim');
  s.boss={...regionBoss(2,17),active:true,timer:0,spawnClock:999};
  s.operation.jammed=true;
  if(hatch)s.operation.portEntry='gantry';
  s.boss.cycle=hatch?1:0;step(s,dt);
  const lock=s.hazards.find(h=>h.portRound==='lock');
  assert.equal(lock.jammed,true);assert.equal(lock.portAxis,'horizontal');
  assert.equal(s.hazards.filter(h=>h.portRound==='rake').length,0);
  assert.equal(s.hazards.filter(h=>h.portRound==='turret').length,2);
  s.hazards=[];Object.assign(s.boss,{mode:'aim',timer:0,cycle:hatch?3:2});step(s,dt);
  assert.equal(s.hazards.filter(h=>h.portRound==='rake').length,2);
  const plate=partPosition(s,s.boss.parts[1]);
  s.shots=[bullet(s,{x:plate.x+22,y:plate.y},10000)];step(s,dt);
  assert.equal(s.boss.parts[1].hp,0);
  assert.deepEqual(s.hazards.map(h=>h.portRound),['lock','turret','turret']);
  assert.ok(s.effects.some(f=>f.type==='barrage-cancel'&&f.text.includes('측면 장갑')));
 }
});
test('existing harbor warnings keep their stored geometry across restore',()=>{
 const s=supportArena(2,null,'salvo');
 s.hazards=[{x:800,y:470,r:58,timer:.45,duration:.95,portRound:'lock'},
  {x:800,y:584,r:58,timer:.45,duration:.95,portRound:'battery'}];
 const loaded=restore(snapshot(s));
 assert.deepEqual(loaded.hazards,s.hazards);
 step(loaded,dt);assert.deepEqual(loaded.hazards.map(h=>h.portRound),['lock','battery']);
});
function harborLanding(seed){
 const s=createOperation(seed);s.operation.region=2;
 Object.assign(s,regionLayout(mapSeed(seed,2),2));
 s.boss=regionBoss(2,seed);s.enemies=[];s.spawnClock=999;s.weapons[0].cd=999;
 for(const site of s.sites)if(site.id!=='port-landing')site.state='done';
 return s;
}
test('the harbor landing opens a mirrored, traversable hatch only after its defenders are cleared',()=>{
 for(const seed of [17,18]){
  const s=harborLanding(seed),dock=s.sites[0];
  Object.assign(s.player,{x:dock.x,y:dock.y+200});
  assert.equal(portGantry(s),null);
  step(s,dt);
  const guards=s.enemies.filter(e=>e.siteId===dock.id);
  assert.deepEqual(guards.map(e=>e.type),['shield','shield','rifle','rifle','mortar','mortar']);
  assert.ok(guards.every(e=>!overlapsCover(s,e,e.r)));
  guards.forEach(e=>e.dead=true);
  Object.assign(s.player,dock);step(s,dt);
  assert.equal(s.phase,'playing');
  assert.equal(s.stats.sitesCleared,1);
  const gantry=portGantry(s);
  assert.ok(gantry);assert.equal(Math.sign(gantry.x-800),seed===17?-1:1);
  for(let i=1;i<gantry.path.length;i++)for(let j=0;j<=20;j++){
   const [ax,ay]=gantry.path[i-1],[bx,by]=gantry.path[i];
   assert.ok(!overlapsCover(s,{x:ax+(bx-ax)*j/20,y:ay+(by-ay)*j/20},16));
  }
  const center=restore(snapshot(s));
  Object.assign(center.player,{x:800,y:350});
  assert.ok(action(center,'interact'));assert.equal(center.operation.portEntry,undefined);
  Object.assign(s.player,{x:gantry.x,y:gantry.y});
  assert.equal(interaction(s).gantry.x,gantry.x);
  assert.ok(action(s,'interact'));assert.equal(s.operation.portEntry,'gantry');
  assert.deepEqual([s.player.x,s.player.y],[gantry.x,gantry.y]);
  assert.ok(portGantryBypass(restore(snapshot(s))));
  assert.ok(portTurretShutter(center));
  for(const state of [s,center]){
   const turret=state.boss.parts[0],x=state.boss.x+turret.ox+Math.sign(turret.ox)*14;
   state.shots=[bullet(state,{x,y:state.boss.y})];step(state,dt);
  }
  assert.equal(s.boss.parts[0].hp,750);
  assert.equal(center.boss.parts[0].hp,834);
  s.player.x=800;assert.ok(portTurretShutter(s));
 }
});
test('an abandoned harbor landing cannot clear for free after the boss',()=>{
 const s=harborLanding(17),dock=s.sites[0];
 Object.assign(s.player,{x:dock.x,y:dock.y+200});step(s,dt);assert.equal(dock.state,'active');
 Object.assign(s.player,{x:800,y:350});assert.ok(action(s,'interact'));
 assert.equal(dock.state,'waiting');assert.ok(!s.enemies.some(e=>e.siteId===dock.id));
 s.stage='holdout';s.boss.active=false;s.boss.dead=true;s.operation.gate={x:800,y:400};
 Object.assign(s.player,dock);step(s,dt);
 assert.equal(dock.state,'waiting');assert.equal(s.operation.portDock,undefined);assert.equal(s.stats.sitesCleared,0);
});
test('a legacy harbor checkpoint preserves its earned but uncollected landing supply',()=>{
 const old=harborLanding(17);old.balanceRevision='b29-rail-workshop';
 const dock=old.sites[0];
 delete dock.gantry;dock.name='하역장 보급';
 for(const state of ['waiting','active','ready','done']){
  dock.state=state;
  const s=restore(snapshot(old));
  Object.assign(s.player,dock);step(s,dt);
  assert.equal(s.operation.portDock,undefined);
  assert.equal(portGantry(s),null);
  if(state==='waiting')assert.deepEqual(s.enemies.map(e=>e.type),['rifle','shield','rifle','rifle','rifle','rifle']);
  if(state==='active'||state==='ready')assert.equal(s.choice.type,'supply');
  if(state==='done')assert.equal(s.phase,'playing');
 }
 const early=harborLanding(18),earlyDock=early.sites[0];
 early.balanceRevision='b30-port-gantry';delete earlyDock.gantry;earlyDock.state='ready';
 const resumed=restore(snapshot(early));
 Object.assign(resumed.player,earlyDock);step(resumed,dt);
 assert.equal(resumed.operation.portDock,true);
 assert.equal(resumed.phase,'playing');
});
test('breaching the harbor turret cancels only its pending rounds and opens its flank',()=>{
 const s=supportArena(2,'breach','aim');
 Object.assign(s.boss,{cycle:0,timer:0});
 Object.assign(s.player,{x:650,y:410});
 step(s,dt);
 const turret=s.boss.parts[0],pending=s.hazards.filter(h=>h.portRound!=='turret');
 assert.equal(s.hazards.length,5);
 s.shots=[bullet(s,{x:s.boss.x+turret.ox,y:s.boss.y},300)];
 step(s,dt);
 assert.equal(turret.hp,0);assert.deepEqual(s.hazards,pending);
 assert.ok(takeEvents(s).includes('barrage-cancel'));
 assert.ok(s.hazards.some(h=>h.portRound==='lock'));
 s.boss.timer=0;step(s,dt);
 assert.equal(s.enemyShots.length,0);
});
test('harbor opening shutter resists normal damage and armor only pierces from the mirrored turret flank',()=>{
 for(const seed of [17,18]){
  const b=regionBoss(2,seed),side=seed%2===0?1:-1;
  assert.equal(Math.sign(b.parts[0].ox),side);
  const probe=(support,offset,mode='salvo')=>{
   const s=supportArena(2,support,mode);
   s.boss.parts=b.parts.map(part=>({...part}));
   Object.assign(s.player,{x:800+offset*180,y:370});
   s.weapons[0].cd=0;tick(s,.4);
   return s;
  };
  const pierce=probe('breach',side),wrong=probe('breach',-side);
  const screened=probe(null,side),open=probe(null,side,'recover');
  assert.ok(pierce.stats.supportUses[2]>0);
  assert.equal(wrong.stats.supportUses?.[2]||0,0);
  assert.ok(screened.boss.parts[0].hp<b.parts[0].hp);
  assert.ok(screened.boss.parts[0].hp>open.boss.parts[0].hp);
  assert.equal(probe(null,side,'aim').boss.parts[0].hp,open.boss.parts[0].hp);
  assert.ok(pierce.boss.parts[0].hp<open.boss.parts[0].hp);
 }
});
test('harbor flank only confirms a clear shot and puts the turret ahead of a nearby rifleman',()=>{
 const s=supportArena(2,'breach','salvo');
 Object.assign(s.player,{x:650,y:900});
 assert.equal(portTurretInSight(s),false);
 s.player.y=380;
 s.blocks=[{x:670,y:285,w:68,h:35,hp:-1}];
 assert.equal(portTurretInSight(s),false);
 s.blocks=[];
 s.enemies=[enemy('closer',645,338)];
 Object.assign(s.weapons[0],{cd:0,targetId:'closer',targetUntil:1});
 assert.equal(portTurretInSight(s),true);
 step(s,dt);
 assert.equal(s.shots[0].target,s.boss.parts[0].id);
});
test('harbor breach suppresses a live turret for one barrage and leaves the main guns active',()=>{
 for(const seed of [17,18]){
  const s=supportArena(2,'breach','aim');
  s.operation.harborPayoff={};
  Object.assign(s.boss,regionBoss(2,seed),{active:true,cycle:0,timer:0,spawnClock:999});
  step(s,dt);
  const side=Math.sign(s.boss.parts[0].ox);
  const hit=x=>{
   Object.assign(s.player,{x,y:370});
   s.shots=[bullet(s,partPosition(s,s.boss.parts[0]),15)];step(s,dt);
  };
  hit(800-side*175);
  assert.equal(s.hazards.length,5);
  const missed=restore(snapshot(s));
  hit(800+side*175);
  assert.ok(s.boss.parts[0].hp>0);
  assert.equal(s.boss.turretSuppressedCycle,s.boss.cycle);
  assert.deepEqual(s.hazards.map(h=>h.portRound),['lock','rake','rake']);
  const resumed=restore(snapshot(s));
  tick(resumed,1.2);tick(missed,1.2);
  assert.equal(resumed.boss.mode,'recover');
  assert.equal(resumed.enemyShots.length,0);
  assert.equal(missed.enemyShots.length,9);
  assert.deepEqual(resumed.operation.harborPayoff,{salvos:1,fans:1});
  assert.deepEqual(missed.operation.harborPayoff,{});
  assert.ok(resumed.hazards.some(h=>h.portRound==='lock'&&h.hit));
  tick(resumed,5.5);
  assert.equal(resumed.boss.cycle,2);
  assert.equal(resumed.boss.mode,'recover');
  assert.equal(resumed.enemyShots.length,9);
  assert.deepEqual(resumed.operation.harborPayoff,{salvos:1,fans:1});
 }
});
test('a flank shot after the shell impacts still stops the live turret follow-up',()=>{
 const s=supportArena(2,'breach','aim');
 s.operation.harborPayoff={};
 Object.assign(s.boss,{cycle:0,timer:0});
 step(s,dt);tick(s,1);
 assert.equal(s.boss.mode,'salvo');
 assert.ok(s.hazards.every(h=>h.hit));
 Object.assign(s.player,{x:625,y:370});
 s.shots=[bullet(s,partPosition(s,s.boss.parts[0]),15)];
 step(s,dt);tick(s,.3);
 assert.ok(s.boss.parts[0].hp>0);
 assert.equal(s.boss.mode,'recover');
 assert.equal(s.enemyShots.length,0);
 assert.deepEqual(s.operation.harborPayoff,{fans:1});
});
test('a lethal armor-piercing hit records the pending salvo it actually cancels',()=>{
 const s=supportArena(2,'breach','aim');
 s.operation.harborPayoff={};
 Object.assign(s.boss,{cycle:0,timer:0});
 step(s,dt);
 Object.assign(s.player,{x:625,y:370});
 const turret=s.boss.parts[0];turret.hp=20;
 s.shots=[bullet(s,partPosition(s,turret),15)];
 step(s,dt);tick(s,1.2);
 assert.equal(turret.hp,0);
 assert.deepEqual(s.operation.harborPayoff,{salvos:1});
 assert.equal(s.enemyShots.length,0);
 assert.ok(s.hazards.some(h=>h.portRound==='lock'&&h.hit));
});
test('a harbor rocket keeps the flank it was fired from when the player sidesteps',()=>{
 const launch=(x,direction)=>{
  const s=supportArena(2,'breach','aim');
  Object.assign(s.boss,{cycle:0,timer:0,parts:regionBoss(2,19).parts});
  s.sites=regionLayout(mapSeed(s.seed,2),2).sites;
  Object.assign(s.player,{x,y:440});
  step(s,dt);
  const rocket={...makeWeapon('r'),uid:'rocket',cd:0};
  s.weapons=[rocket];
  step(s,dt);
  const shot=s.shots[0],turret=s.boss.parts[0];
  assert.equal(shot.target,turret.id);
  assert.equal(shot.breachLane,x<695);
  const loaded=restore(snapshot(s));
  tick(loaded,.1,{x:direction,y:0});
  assert.equal(loaded.player.x<695,x>=695);
  tick(loaded,.7);
  return loaded;
 };
 const flank=launch(690,1),center=launch(700,-1);
 assert.equal(flank.boss.parts[0].hp,flank.boss.parts[0].maxHp-weaponStats(flank.weapons[0]).damage*1.65);
 assert.ok(center.boss.parts[0].hp>flank.boss.parts[0].hp);
 assert.deepEqual(flank.hazards.map(h=>h.portRound),['lock','rake','rake']);
 assert.equal(center.hazards.filter(h=>h.portRound==='turret').length,2);
});
test('harbor dash must enter the exposed core range and strikes once per recovery window',()=>{
 const aim=supportArena(2,'overrun','aim'),opening=supportArena(2,'overrun','recover');
 const rush=(s,y,input)=>{
  Object.assign(s.player,{x:800,y,dashCd:0});assert.ok(action(s,'dash'));tick(s,.2,input);
 };
 rush(aim,470,{x:0,y:-1});
 rush(opening,400,{x:0,y:0});
 assert.equal(aim.boss.hp,aim.boss.maxHp);assert.equal(opening.boss.hp,opening.boss.maxHp);
 rush(opening,470,{x:0,y:-1});
 assert.equal(opening.boss.hp,opening.boss.maxHp-320);
 assert.equal(opening.boss.parts[0].hp,450);assert.ok(opening.boss.timer>999);
 rush(opening,470,{x:0,y:-1});assert.equal(opening.stats.supportUses[2],1);
 opening.boss.cycle++;rush(opening,470,{x:0,y:-1});assert.equal(opening.stats.supportUses[2],2);
});
test('late harbor dash registers on entry and core exposure expires with the extended reload',()=>{
 const s=supportArena(2,'overrun','recover');
 Object.assign(s.player,{x:800,y:447});
 s.boss.timer=.08;
 assert.ok(action(s,'dash'));tick(s,.067,{x:0,y:-1});
 assert.ok(s.player.dash>0);
 assert.equal(s.boss.hp,s.boss.maxHp-320);
 assert.ok(s.boss.timer>.9&&s.boss.timer<1);
 assert.ok(s.boss.parts.every(p=>p.hp>0));
 s.shots=[bullet(s,s.boss)];step(s,dt);
 assert.equal(s.boss.hp,s.boss.maxHp-320-160);
 s.boss.timer=0;step(s,dt);
 assert.equal(s.boss.mode,'aim');
 s.shots=[bullet(s,s.boss)];step(s,dt);
 assert.equal(s.boss.hp,s.boss.maxHp-320-160-65);
});
test('a harbor sidestep opens the core inside the ring but vertical or blocked dashes do not',()=>{
 const arena=()=>{
  const s=supportArena(2,'overrun','recover');
  s.operation.harborPayoff={};
  Object.assign(s.player,{x:760,y:400});
  return s;
 };
 const vertical=arena();
 assert.ok(action(vertical,'dash'));tick(vertical,.18,{x:0,y:-1});
 assert.equal(vertical.boss.hp,vertical.boss.maxHp);
 const blocked=arena();
 blocked.blocks=[{x:720,y:326,w:150,h:18}];
 assert.ok(action(blocked,'dash'));tick(blocked,.18,{x:1,y:0});
 assert.equal(blocked.boss.hp,blocked.boss.maxHp);
 const s=arena();
 assert.ok(action(s,'dash'));tick(s,.05,{x:1,y:0});
 assert.equal(s.boss.hp,s.boss.maxHp);
 const loaded=restore(snapshot(s));tick(loaded,.13,{x:1,y:0});
 assert.equal(loaded.boss.hp,loaded.boss.maxHp-320);
 assert.equal(loaded.stats.supportUses[2],1);
 assert.deepEqual(loaded.operation.harborPayoff,{sidesteps:1});
 assert.ok(loaded.effects.some(e=>e.text==='측면 회피 · 코어 장갑 해제'));
 Object.assign(loaded.player,{x:760,y:400,dashCd:0});
 assert.ok(action(loaded,'dash'));tick(loaded,.18,{x:1,y:0});
 assert.equal(loaded.stats.supportUses[2],1);
 assert.deepEqual(loaded.operation.harborPayoff,{sidesteps:1});
});
test('harbor medical crates alternate flanks, survive saving and require a physical pickup',()=>{
 const s=supportArena(2,'recovery','aim');Object.assign(s.boss,{cycle:0,timer:0});Object.assign(s.player,{x:700,y:335,hp:80,charge:40});
 step(s,dt);assert.equal(s.boss.mode,'salvo');assert.deepEqual(s.boss.harborSupply,{x:975,y:335});assert.equal(s.player.hp,80);assert.equal(s.gems.length,0);
 const loaded=restore(snapshot(s));
 Object.assign(loaded.boss,{mode:'salvo',cycle:2,timer:0});step(loaded,dt);
 assert.deepEqual(loaded.boss.harborSupply,{x:975,y:335});
 Object.assign(loaded.player,loaded.boss.harborSupply);step(loaded,dt);
 assert.equal(loaded.player.hp,92);assert.equal(Math.floor(loaded.player.charge),60);assert.equal(loaded.stats.supportUses[2],1);assert.equal(loaded.boss.harborSupply,undefined);
 Object.assign(s.player,s.boss.harborSupply);step(s,dt);
 s.boss.timer=0;step(s,dt);assert.equal(s.boss.harborSupply,undefined);
 Object.assign(s.boss,{mode:'salvo',cycle:2,timer:0});step(s,dt);assert.deepEqual(s.boss.harborSupply,{x:625,y:335});
 delete loaded.boss.harborSupply;Object.assign(loaded.boss,{mode:'salvo',cycle:4,timer:0});step(loaded,dt);assert.equal(loaded.boss.harborSupply,undefined);
});
test('every harbor medical drop is previewed and can be claimed during its salvo',()=>{
 const s=supportArena(2,'recovery','aim');
 s.boss.cycle=0;
 for(const [i,x] of [975,625,975].entries()){
  Object.assign(s.boss,{mode:'aim',timer:0});
  Object.assign(s.player,{x:800,y:i%2===0?435:335,hp:80,charge:10});
  assert.deepEqual(portAidPreview(s),{x,y:335});
  step(s,dt);
  assert.equal(s.boss.mode,'salvo');
  assert.deepEqual(s.boss.harborSupply,{x,y:335});
  assert.equal(portAidPreview(s),null);
  Object.assign(s.player,s.boss.harborSupply);
  step(s,dt);
  assert.equal(s.player.hp,92);
  assert.equal(Math.floor(s.player.charge),55);
  assert.equal(s.stats.supportUses[2],i+1);
 }
 assert.equal(portAidPreview(s),null);
 assert.equal(portAidPreview(supportArena(1,'recovery','aim')),null);
});
test('a b23 harbor recovery checkpoint still gets its first crate at the end of the salvo',()=>{
 const s=supportArena(2,'recovery','salvo');
 s.balanceRevision='b23-front-approaches';
 Object.assign(s,regionLayout(mapSeed(s.seed,2),2));
 s.boss.timer=0;
 const loaded=restore(snapshot(s));
 assert.deepEqual(portAidPreview(loaded),{x:975,y:335});
 step(loaded,dt);
 assert.deepEqual(loaded.boss.harborSupply,{x:975,y:335});
 assert.equal(loaded.boss.harborSupplyCycle,1);
});
test('only a fresh safe harbor pickup grants bonus charge and shortens the next dodge',()=>{
 function claim(lockX,lockY,{afterWarning=false,stale=false,full=false}={}){
  const s=supportArena(2,'recovery','aim');
  s.operation.harborPayoff={};
  Object.assign(s.boss,{cycle:0,timer:0});
  Object.assign(s.player,{x:lockX,y:lockY,hp:80,charge:10});
  const risk=portAidBaitRisk(s,portAidPreview(s));
  assert.equal(risk,lockY===335);
  step(s,dt);
  if(afterWarning)tick(s,1);
  if(stale)s.boss.cycle++;
  Object.assign(s.player,s.boss.harborSupply,{dashCd:1.8,charge:full?100:10});
  const invuln=s.player.invuln;
  step(s,dt);
  assert.equal(s.boss.harborSupply,undefined);
  assert.equal(s.stats.supportUses[2],1);
  assert.equal(s.player.invuln,Math.max(0,invuln-dt));
  return {charge:Math.floor(s.player.charge),dashCd:s.player.dashCd,payoff:s.operation.harborPayoff};
 }
 assert.deepEqual(claim(800,435),{charge:55,dashCd:.35,payoff:{safeAid:1}});
 assert.deepEqual(claim(800,435,{full:true}),{charge:100,dashCd:.35,payoff:{safeAid:1}});
 for(const regular of [claim(920,335),claim(800,435,{afterWarning:true}),claim(800,435,{stale:true})]){
  assert.deepEqual(regular,{charge:30,dashCd:1.8-dt,payoff:{aid:1}});
 }
});
test('claiming the rail relay extends the actual attack warning by 0.4 seconds',()=>{
 const warning=state=>{const s=quietOperation();s.operation.region=1;s.sites=[{kind:'relay',state}];s.stage='boss';Object.assign(s.boss,{active:true,timer:0});step(s,dt);return s.hazards.find(h=>h.lane).timer;};
 assert.ok(Math.abs(warning('done')-warning('waiting')-.4)<1e-9);
});
test('rail defense pauses outside the zone and harbor interception can fail and retry',()=>{
 const rail=quietOperation();rail.operation.region=1;downBoss(rail);
 rail.spawnClock=999;rail.player.invuln=999;assert.ok(action(rail,'challenge'));
 tick(rail,1);assert.equal(rail.challenge.progress,0);assert.equal(rail.phase,'playing');
 Object.assign(rail.player,{x:DEFENSE_ZONE.x,y:DEFENSE_ZONE.y});
 const saved=restore(snapshot(rail));tick(saved,8.2);assert.ok(saved.challenge.secured);assert.equal(saved.phase,'playing');
 saved.operation.holdoutKills=HOLDOUT.rareKills;step(saved,dt);assert.equal(saved.choice.type,'pursuit-reward');
 const port=quietOperation();port.operation.region=2;downBoss(port);
 port.spawnClock=999;port.player.invuln=999;assert.ok(action(port,'challenge'));
 const y=port.challenge.target.y;tick(port,1);assert.ok(port.challenge.target.y<y);
 tick(port,17.2);assert.equal(port.challenge.state,'failed');assert.equal(port.phase,'playing');
 assert.ok(action(port,'challenge'));assert.equal(port.challenge.tier,1);
 port.shots=[bullet(port,port.challenge.target,1200)];step(port,dt);
 assert.equal(port.choice.type,'pursuit-reward');const before=operationCredits(port);
 assert.ok(choose(port,'pursuit:cargo'));assert.equal(operationCredits(port),before+CARGO_CREDITS);
});
test('new harbor vehicles take mirrored cover-free paths while older interceptions resume in place',()=>{
 const routes=[];
 for(const seed of [19,22]){
  const s=createOperation(seed);clearRegion(s);assert.ok(choose(s,'advance'));
  clearRegion(s);assert.ok(choose(s,'advance'));
  downBoss(s);
  const path=signalRoute(s);routes.push(path);
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];
   for(let j=0;j<=20;j++){
    const x=a.x+(b.x-a.x)*j/20,y=a.y+(b.y-a.y)*j/20,r=34;
    assert.ok(!s.blocks.some(w=>w.hp!==0&&x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h));
   }
  }
  assert.ok(action(s,'challenge'));
  assert.equal(s.challenge.target.x,path[0].x);
  tick(s,5);
  assert.ok(Math.abs(s.challenge.target.x-path[0].x)>4);
  const resumed=restore(snapshot(s));
  assert.deepEqual(signalRoute(resumed),signalRoute(s));
  step(resumed,dt);step(s,dt);assert.deepEqual(resumed.challenge,s.challenge);
  const old=snapshot(s);old.balanceRevision='b30-port-gantry';delete old.challenge.lane;
  old.challenge.target.x=800;old.challenge.target.y=95+825*old.challenge.timeLeft/SIGNAL_SECONDS;
  const legacy=restore(old),previousY=legacy.challenge.target.y;
  assert.deepEqual(signalRoute(legacy).at(-1),{x:800,y:95});
  step(legacy,dt);
  assert.equal(legacy.challenge.target.x,800);assert.ok(legacy.challenge.target.y<previousY);
 }
 assert.deepEqual(routes[0].map(({x,y})=>({x:1600-x,y})),routes[1]);
});
test('starting a fresh sortie settles a previous run once and survives a failed write',async()=>{
 const mem=memory(),store=createStore(mem),p=store.get(),old=quietOperation();
 p.research=['medic'];p.trials=['medic'];old.research=['medic'];old.trials=['medic'];
 old.stats.researchTrialsPicked=['medic'];old.weapons[0].level=5;old.operation.cleared=1;
 await store.commit(beginProfile(p,old));
 const previous=store.get(),{run,next}=freshSortie(previous,old.seed);
 assert.equal(run.operation.region,0);assert.equal(run.weapons[0].level,1);
 assert.deepEqual(run.research,['medic']);assert.deepEqual(run.trials,[]);
 assert.notEqual(run.runId,old.runId);assert.equal(next.recent[0].reason,'new-run');assert.equal(next.credits,90);
 mem.setFail(true);await assert.rejects(store.commit(next));assert.deepEqual(store.get(),previous);
 mem.setFail(false);await store.commit(next);assert.equal(store.get().active.runId,run.runId);assert.equal(store.get().recent.length,1);
});
test('all region supplies and boss entrances stay reachable around permanent geometry',()=>{
 for(const seed of [16,17,18,19])for(let index=0;index<3;index++){const m=regionLayout(seed,index),free=(x,y)=>x>55&&x<1545&&y>55&&y<1145&&!m.blocks.some(b=>b.hp!==0&&x+16>b.x&&x-16<b.x+b.w&&y+16>b.y&&y-16<b.y+b.h),key=(x,y)=>`${x},${y}`,queue=[[800,1040]],seen=new Set(['800,1040']);for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[20,0],[-20,0],[0,20],[0,-20]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(seen.has(k)||!free(nx,ny))continue;seen.add(k);queue.push([nx,ny]);}}for(const goal of [...m.sites,{x:800,y:350}])assert.ok(queue.some(([x,y])=>Math.hypot(x-goal.x,y-goal.y)<55),`${index}/${seed} ${goal.id||'boss'}`);}
});
test('marked later-front approaches and actual guard formations clear collision geometry',()=>{
 const clear=(s,x,y,r)=>!s.blocks.some(b=>b.hp!==0&&x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
 for(const seed of [19,58]){
  const s=createOperation(seed);
  for(const index of [1,2]){
   clearRegion(s);assert.ok(choose(s,'advance'));
   const entry=frontEntry(mapSeed(seed,index),index);
   assert.deepEqual([s.player.x,s.player.y],[entry.arrival.x,entry.arrival.y]);
   assert.deepEqual(activeEntry(s),entry);
   for(const route of entry.routes){
    const site=s.sites.find(n=>n.id===route.site);
    assert.deepEqual(route.path.at(-1),[site.x,site.y]);
    for(let i=1;i<route.path.length;i++){
     const [ax,ay]=route.path[i-1],[bx,by]=route.path[i],steps=Math.ceil(Math.hypot(bx-ax,by-ay)/8);
     for(let j=0;j<=steps;j++)assert.ok(clear(s,ax+(bx-ax)*j/steps,ay+(by-ay)*j/steps,16),route.site);
    }
   }
   for(const site of s.sites){
    assert.ok(clear(s,site.x,site.y,16),site.id);
    const probe=restore(snapshot(s));Object.assign(probe.player,{x:site.x,y:site.y});
    probe.enemies=[];probe.spawnClock=999;step(probe,dt);
    const guards=probe.enemies.filter(e=>e.siteId===site.id);
    assert.equal(guards.length,site.kind==='armory'?5:6);
    assert.ok(guards.every(e=>clear(probe,e.x,e.y,e.r)),site.id);
   }
  }
 }
});
test('rail garrisons swap by seed without changing their entry side and block hacking until the crew is down',()=>{
 const arrive=seed=>{
  const s=createOperation(seed);
  clearRegion(s);assert.ok(choose(s,'advance'));
  s.spawnClock=999;s.player.invuln=999;s.weapons[0].cd=999;
  for(const site of s.sites)if(site.id!=='rail-relay')site.state='done';
  return s;
 };
 for(const [seed,crew] of [[17,'mortar'],[19,'shield']]){
  const s=arrive(seed),relay=s.sites.find(site=>site.id==='rail-relay');
  assert.equal(relay.x,480);assert.equal(relay.guardPlan,crew);
  assert.notEqual(s.sites[0].guardPlan,crew);
  Object.assign(s.player,{x:relay.x,y:relay.y,hp:100});
  step(s,dt);
  assert.equal(railCrewLeft(s,relay),2);
  tick(s,1);assert.equal(relay.progress,0);
  s.shots=s.enemies.filter(e=>e.type===crew&&e.siteId===relay.id).map(e=>bullet(s,e,1000));
  step(s,dt);
  assert.equal(railCrewLeft(s,relay),0);
  tick(s,5);
  assert.equal(s.choice?.type,'control');
 }
 const legacy=arrive(17),relay=legacy.sites.find(site=>site.id==='rail-relay');
 delete relay.guardPlan;
 Object.assign(legacy.player,{x:relay.x,y:relay.y});
 const loaded=restore(snapshot(legacy));
 step(loaded,dt);assert.equal(loaded.enemies.filter(e=>e.siteId==='rail-relay').length,3);
 assert.ok(loaded.sites.find(site=>site.id==='rail-relay').progress>0);
});
test('entering a boss arena does not erase the surviving guards of an unfinished site',()=>{
 const s=createOperation(17);
 clearRegion(s);assert.ok(choose(s,'advance'));
 const relay=s.sites.find(site=>site.id==='rail-relay');
 s.spawnClock=999;s.weapons[0].cd=999;
 Object.assign(s.player,{x:relay.x,y:relay.y});step(s,dt);
 assert.equal(railCrewLeft(s,relay),2);
 Object.assign(s.player,{x:800,y:350});assert.ok(action(s,'interact'));
 assert.equal(relay.state,'active');
 assert.equal(railCrewLeft(s,relay),2);
 assert.equal(restore(snapshot(s)).enemies.filter(e=>!e.dead&&e.siteId===relay.id).length,6);
});
test('route bearings advance past traversed corners and unfinished routes remain after a detour',()=>{
 const s=createOperation(18);
 clearRegion(s);assert.ok(choose(s,'advance'));
 s.operation.regionTime=45;
 Object.assign(s.player,{x:985,y:950});
 const entry=activeEntry(s);
 const relay=entry.routes.find(route=>route.site==='rail-relay');
 assert.deepEqual(entryWaypoint(relay.path,s.player),[1120,835]);
 s.sites.find(site=>site.id==='rail-cache').state='done';
 assert.deepEqual(activeEntry(s).routes,[relay]);
 s.sites.find(site=>site.id==='rail-relay').state='done';
 assert.equal(activeEntry(s),null);
});
test('previous later-front placements are settled once with earned credits',()=>{
 const s=createOperation(19);
 clearRegion(s);assert.ok(choose(s,'advance'));
 s.balanceRevision='b22-capstone-impact';
 assert.doesNotThrow(()=>restore(snapshot(s)));
 const relay=s.sites.find(n=>n.id==='rail-relay');
 Object.assign(relay,{x:550,y:650});
 const p=beginProfile(emptyProfile(),s);
 assert.throws(()=>restore(p.active.run),/이전 규칙/);
 const migrated=parseProfile(JSON.stringify(p));
 assert.equal(migrated.active,null);
 assert.equal(migrated.recent[0].reason,'rules-updated');
 assert.ok(migrated.credits>=90);
 assert.equal(parseProfile(JSON.stringify(migrated)).credits,migrated.credits);
});
test('every beach and garrison combination offers both opening guns, safe guards and the matching module',()=>{
 for(let seed=16;seed<32;seed++)for(const weapon of ['f','r']){
  const s=createOperation(seed),route=beachRoute(seed);
  assert.deepEqual(s.sites.map(site=>[site.x,site.y]),route.points);
  const [first,truck]=s.sites;
  assert.ok(Math.abs(Math.hypot(first.x-800,first.y-1040)-245)<10);
  for(const site of s.sites){
   const drift=site===truck?55:0;
   const formation=coastApproach(site)?.guards||Array.from({length:site.kind==='armory'?5:4},(_,i)=>['rifle',Math.cos(i*Math.PI/3)*85,Math.sin(i*Math.PI/3)*65]);
   for(const [type,dx,dy] of formation){
    const x=site.x+dx,y=site.y+dy,r=type==='shield'?21:19;
    assert.ok(!s.blocks.some(b=>x+r+drift>b.x&&x-r-drift<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h),site.id);
   }
  }
  s.sites.forEach(site=>site.state='done');s.enemies=[];s.spawnClock=999;
  assert.deepEqual(supply(s).filter(c=>c.kind==='gun').map(c=>c.weapon),[route.gun,route.gun==='r'?'f':'r']);
  const site=s.sites.find(n=>n.coastApproach===weapon),approach=coastApproach(site);
  assert.ok(choiceDetails(s,s.choices.find(c=>c.id===`gun:${weapon}`)).link.includes(approach.formation));
  assert.equal(reroll(s),false);assert.ok(choose(s,`gun:${weapon}`));
  site.state='waiting';s.player.x=site.x;s.player.y=site.y+160;step(s,dt);
  assert.deepEqual(s.enemies.filter(e=>e.siteId===site.id).map(e=>e.type),approach.guards.map(([type])=>type));
  assert.ok(supply(s,site.id).some(c=>c.id===`module:${approach.module}`));
 }
});
test('spaced garrisons survive an opening shot that hits all guards in the packed deployment',()=>{
 for(const [id,splitSeed,range,affected] of [['f',21,130,[6,3]],['r',25,155,[2,1]]]){
  const shot=(seed,legacy=false)=>{
   const s=createOperation(seed);
   s.enemies=[];s.spawnClock=999;
   s.sites.forEach(site=>site.state='done');
   const site=s.sites.find(site=>site.coastApproach===id);
   if(legacy)delete site.coastPlan;
   site.state='waiting';
   Object.assign(s.player,{x:site.x,y:site.y+range});
   s.weapons=[{...makeWeapon(id),uid:id,cd:999}];
   const loaded=restore(snapshot(s));step(loaded,dt);
   loaded.weapons[0].cd=0;
   step(loaded,dt);loaded.weapons[0].cd=999;
   tick(loaded,.7);
   assert.equal(loaded.weapons[0].shots,1);
   return loaded.enemies.filter(e=>e.siteId===site.id&&(id==='f'?e.burn>0:e.dead)).length;
  };
  assert.deepEqual(beachRoute(17),beachRoute(splitSeed));
  assert.deepEqual([shot(17),shot(splitSeed),shot(splitSeed,true)],[...affected,affected[0]]);
 }
});
test('opening combat reserves earned upgrades through the rescue and a short weapon window',()=>{
 const run=quietOperation();
 const rescue=run.sites.find(site=>site.opening);
 rescue.state='waiting';
 Object.assign(run.player,{x:rescue.x,y:rescue.y+140});
 Object.assign(run,{level:2,pendingLevels:1});
 step(run,dt);
 assert.equal(rescue.state,'active');
 assert.ok(run.enemies.length>0&&run.enemies.every(guard=>guard.type==='rifle'));
 assert.equal(run.phase,'playing');
 assert.equal(run.pendingLevels,1);
 const urgent=restore(snapshot(run));urgent.player.hp=44;step(urgent,dt);
 assert.equal(urgent.choice.type,'level');
 const late=restore(snapshot(run));late.t=15;step(late,dt);
 assert.equal(late.choice.type,'level');
 run.enemies=[];Object.assign(run.player,{x:rescue.x,y:rescue.y});step(run,dt);
 assert.equal(run.choice.opening,true);
 assert.ok(choose(run,'gun:f'));
 assert.equal(run.phase,'playing');
 assert.equal(run.pendingLevels,1);
 const resumed=restore(snapshot(run));tick(resumed,2.4);
 assert.equal(resumed.phase,'playing');
 assert.equal(action(resumed,'upgrade'),false);
 tick(resumed,.2);
 assert.equal(resumed.phase,'playing');
 const immediate=restore(snapshot(resumed));
 assert.ok(action(immediate,'upgrade'));
 assert.equal(immediate.choice.type,'level');
 tick(resumed,.5);
 assert.equal(resumed.choice.type,'level');
 assert.equal(resumed.pendingLevels,0);
});
test('the first coastal engagement defers only automatic drafts until the brief grace ends',()=>{
 const run=quietOperation();
 assert.ok(supply(run).some(c=>c.id==='gun:f'));assert.ok(choose(run,'gun:f'));
 const truck=run.sites.find(site=>site.coastApproach==='f');truck.state='active';
 Object.assign(run.player,{x:truck.x,y:truck.y+175});
 run.enemies=[{...enemy('truck-guard',truck.x,truck.y,'shield'),siteId:truck.id}];
 run.level=2;run.pendingLevels=1;run.t=run.openingFireUntil+.6;
 for(const weapon of run.weapons)weapon.cd=999;
 const ready=restore(snapshot(run));step(run,dt);
 assert.equal(run.phase,'playing');assert.equal(run.pendingLevels,1);
 assert.ok(action(run,'upgrade'));assert.equal(run.choice.type,'level');
 const limit=restore(snapshot(ready));limit.t=limit.openingFireUntil+3.5;step(limit,dt);
 assert.equal(limit.choice.type,'level');
 const hurt=restore(snapshot(ready));hurt.player.hp=44;step(hurt,dt);
 assert.equal(hurt.choice.type,'level');
 const leave=restore(snapshot(ready));Object.assign(leave.player,{x:120,y:1050});step(leave,dt);
 assert.equal(leave.choice.type,'level');
 const cleared=restore(snapshot(ready));cleared.enemies=[];step(cleared,dt);
 assert.equal(cleared.choice.type,'level');
});
test('campaign level drafts leave combat time between choices without consuming banked XP',()=>{
 const s=quietOperation();s.level=4;s.pendingLevels=2;
 step(s,dt);
 assert.equal(s.choice.type,'level');
 assert.equal(s.pendingLevels,1);
 assert.ok(choose(s,'rank:h'));
 const next=restore(snapshot(s)),x=next.player.x;
 tick(next,1,{x:1,y:0});
 assert.equal(next.phase,'playing');
 assert.ok(next.player.x>x);
 assert.equal(next.pendingLevels,1);
 const manual=restore(snapshot(next));
 assert.ok(action(manual,'upgrade'));
 assert.equal(manual.choice.type,'level');
 assert.equal(manual.pendingLevels,0);
 assert.equal(action(manual,'upgrade'),false);
 tick(next,RULES.levelChoiceSpacing-1+.1);
 assert.equal(next.choice.type,'level');
 assert.equal(next.pendingLevels,0);
});
test('field supplies still open while routine level drafts are banked',()=>{
 const s=quietOperation();s.level=2;s.pendingLevels=1;
 const site=s.sites.find(site=>site.id==='supply-b');site.state='ready';
 Object.assign(s.player,{x:site.x,y:site.y+95});
 step(s,dt);
 assert.equal(s.phase,'playing');
 assert.equal(s.pendingLevels,1);
 supply(s,site.id);
 assert.equal(s.choice.type,'supply');
 assert.equal(s.pendingLevels,1);
 assert.ok(choose(s,s.choices[0].id));
 assert.equal(s.phase,'playing');
 assert.equal(s.pendingLevels,1);
});
test('a gate carries banked upgrades into the next front',()=>{
 const s=quietOperation();clearRegion(s);
 assert.ok(choose(s,'stay'));
 s.level=4;s.pendingLevels=2;s.levelReadyAt=s.t;
 const gate=exitGate(s);
 Object.assign(s.player,{x:gate.x,y:gate.y});
 step(s,dt);
 assert.equal(s.phase,'playing');
 assert.ok(action(s,'interact'));
 assert.ok(choose(s,'advance'));
 const loaded=restore(snapshot(s));
 assert.equal(loaded.operation.region,1);
 assert.equal(loaded.pendingLevels,2);
 assert.ok(action(loaded,'upgrade'));
 assert.equal(loaded.choice.type,'level');
 assert.equal(loaded.pendingLevels,1);
});
test('coast rockets interrupt the battery at range and address enemies that close the gap',()=>{
 for(const gap of [75,140]){
  const s=quietOperation(),rocket={...makeWeapon('r'),uid:'r',cd:0};
  s.weapons.push(rocket);
  const p=s.player,rifle=enemy('rifle',p.x+gap,p.y),mortar=enemy('battery',p.x+225,p.y-100,'mortar',45);
  Object.assign(mortar,{cohort:'coast-guard',siteId:'supply-c'});
  s.enemies=[rifle,mortar];step(s,dt);
  assert.equal(s.shots.find(q=>q.owner==='r')?.target,gap<90?rifle.id:mortar.id);
 }
});
test('rail tactics are chosen at the relay and heat rewards a close flank during reload',()=>{
 const base=quietOperation();base.operation.region=1;
 base.sites=[{id:'rail-relay',kind:'relay',name:'중계기',state:'ready',x:800,y:800}];
 step(base,dt);
 assert.deepEqual(base.choices.map(c=>c.id),['control:heat','control:signal','control:supply']);
 assert.ok(choose(base,'control:heat'));
 const hit=(x,y,mode,heat=true)=>{
  const s=restore(snapshot(base));s.stage='boss';
  if(!heat)delete s.operation.tactic;
  Object.assign(s.player,{x,y});Object.assign(s.boss,{active:true,mode,timer:99,spawnClock:99});
  s.weapons.push({...makeWeapon('f'),uid:'inferno',level:6,branch:'trail',evolved:true,cd:0});
  step(s,dt);return {count:s.stats.frontTactics?.[1]||0,damage:s.boss.maxHp-s.boss.hp,events:takeEvents(s)};
 };
 const hot=hit(685,267,'recover'),cold=hit(685,267,'recover',false);
 assert.equal(hot.count,1);
 assert.ok(hot.events.includes('overheat')&&!hot.events.includes('heat'));
 assert.ok(cold.damage>0&&Math.abs(hot.damage-cold.damage*1.45)<1e-6);
 assert.equal(hit(800,325,'recover').count,0);
 assert.equal(hit(685,267,'salvo').count,0);
});
function quietRailWorkshop(){
 const s=quietOperation();s.operation.region=1;
 Object.assign(s,regionLayout(mapSeed(s.seed,1),1));s.blocks=[];s.boss=regionBoss(1,s.seed);
 s.sites.forEach(site=>site.state='done');
 return s;
}
test('rail workshop protects a weak build from a random new weapon and provides the needed part',()=>{
 const s=quietRailWorkshop();s.firstNew='f';
 s.weapons.push({...makeWeapon('f'),uid:'fire',level:6,branch:'trail',cd:999});
 s.modules=[{id:'catalyst',rank:1}];const ready=s.tuning;
 assert.deepEqual(supply(s,'rail-cache').map(c=>c.id),['module:catalyst','rank:h','resupply:rail-workshop']);
 assert.equal(s.choice.type,'rail-workshop');
 assert.equal(reroll(s),false);
 assert.ok(choose(s,'module:catalyst'));assert.equal(s.tuning,ready);
 assert.ok(assemblyOptions(s).some(c=>c.id==='evolve:f'));
});
test('a paid rail reservation competes with workshop supplies and survives checkpoint and settlement',()=>{
 const base=emptyProfile();Object.assign(base,{credits:500,research:['thermal'],trials:['thermal']});base.records.wins=1;
 assert.throws(()=>freshSortie(base,17,null,'fio','thermal'),/예약 조건/);
 base.trials=[];
 assert.throws(()=>freshSortie(base,17,'wire','fio','thermal'),/예약 조건/);
 const {run,next}=freshSortie(base,17,null,'fio','thermal');
 assert.equal(base.credits,500);assert.equal(next.credits,380);
 assert.deepEqual(run.modules,[]);assert.equal(run.level,1);
 assert.equal(parseProfile(JSON.stringify(next)).active.run.operation.requisition,'thermal');
 assert.throws(()=>freshSortie(next,18,null,'fio','thermal'),/예약 조건/);
 clearRegion(run);assert.ok(choose(run,'advance'));
 run.enemies=[];run.spawnClock=999;run.weapons[0].cd=999;
 const cards=supply(run,'rail-cache');
 assert.deepEqual(cards.map(c=>c.id),['requisition:thermal','module:ricochet','resupply:rail-workshop']);
 assert.match(choiceDetails(run,cards[0]).link,/장착 후 대기 · 축전 코일과 연소 무장 필요/);
 const invalid=snapshot(run);invalid.choices[0].rank=3;
 assert.throws(()=>restore(invalid),/체크포인트/);assert.equal(choose(invalid,'requisition:thermal'),false);
 const fitted=restore(snapshot(run));assert.ok(choose(fitted,'requisition:thermal'));
 assert.deepEqual(fitted.modules,[{id:'thermal',rank:1}]);assert.equal(fitted.operation.requisitionClaimed,true);
 assert.ok(choose(run,'resupply:rail-workshop'));assert.equal(run.operation.requisitionClaimed,undefined);
 for(const [s,claimed] of [[run,false],[fitted,true]]){
  finish(s,false);
  const settled=settleProfile(next,s);
  assert.equal(settled.credits,380+settled.recent[0].credits);
  assert.equal(settled.recent[0].requisitionFee,120);
  assert.equal(!!settled.recent[0].operation.requisitionClaimed,claimed);
 }
});
test('rail refit retains fire evolution and changes the actual reach of the next shot',()=>{
 const s=quietRailWorkshop();s.firstNew='f';
 s.weapons.push({...makeWeapon('f'),uid:'fire',level:6,branch:'trail',evolved:true,cd:999});
 const oldRange=weaponStats(s.weapons[1]).range;
 const c=supply(s,'rail-cache').find(c=>c.kind==='calibrate');
 const kept=restore(snapshot(s)),swapped=restore(snapshot(s)),tuning=swapped.tuning;
 assert.match(choiceDetails(swapped,c).impact,/연료 살포 → 압축 분사/);
 assert.ok(choose(kept,'resupply:rail-workshop'));
 assert.ok(choose(swapped,c.id));assert.equal(swapped.tuning,tuning);
 assert.equal(swapped.weapons[1].evolved,true);
 assert.equal(swapped.weapons[1].branch,'focused');
 assert.equal(weaponStats(swapped.weapons[1]).range,oldRange+70);
 for(const state of [kept,swapped]){
  const p=state.player;
  state.weapons[1].cd=0;state.enemies=[enemy('far',p.x+oldRange+45,p.y,'rifle',500)];
  step(state,dt);
 }
 assert.ok(!kept.effects.some(f=>f.type==='flame'));
 assert.ok(swapped.effects.some(f=>f.type==='flame'&&f.r===oldRange+70));
});
test('rail refit converts the inherited rocket, while guarding against duplicate fusion',()=>{
 const s=quietRailWorkshop();s.firstNew='r';
 Object.assign(s.weapons[0],{level:6,evolved:true,branch:'ricochet',fusion:{secondary:'r',branch:'homing',overflow:2},payload:10});
 const duplicate=restore(snapshot(s));
 duplicate.weapons.push({...duplicate.weapons[0],uid:'other-fusion',fusion:{...duplicate.weapons[0].fusion,branch:'incendiary'}});
 assert.ok(supply(duplicate,'rail-cache').every(c=>c.kind!=='calibrate'));
 const c=supply(s,'rail-cache').find(c=>c.kind==='calibrate');
 assert.ok(choose(s,c.id));assert.equal(s.weapons[0].fusion.overflow,2);assert.equal(s.weapons[0].branch,'ricochet');
 assert.equal(s.weapons[0].fusion.branch,'incendiary');
 const p=s.player,a=enemy('hit',p.x,p.y-110,'rifle',500),b=enemy('relay',p.x,p.y-230,'rifle',500);
 s.enemies=[a,b];s.shots=[bullet(s,a,1)];step(s,dt);
 assert.ok(s.shots.some(q=>q.source==='payload'&&q.incendiary&&!q.homing));
});
test('a ranged signal arcs once to the other part and changes the next boss action',()=>{
 for(const index of [1,2]){
  const s=quietOperation();s.operation.region=index;s.operation.tactic='signal';s.stage='boss';
  Object.assign(s.player,{x:800,y:445});
  Object.assign(s.boss,{active:true,mode:index===1?'aim':'recover',timer:99,spawnClock:1,parts:s.boss.parts.map(p=>({...p,hp:500,maxHp:500}))});
  s.weapons[0].fusion={secondary:'r',branch:'homing',overflow:0};
  const hit=()=>{s.shots=[bullet(s,s.boss,20)];step(s,dt);};
  hit();hit();
  assert.equal(s.stats.frontTactics[index],1);
  assert.equal(s.boss.parts[0].hp,index===1?280:220);
  assert.equal(s.boss.parts[1].hp,500);
  if(index===1){Object.assign(s.boss,{mode:'salvo',cycle:1,timer:0});step(s,dt);assert.equal(s.boss.timer,3);}
  else assert.ok(s.boss.spawnClock>2.9);
 }
});
test('harbor armor parts change actual body vulnerability and rare unique banish keeps crate quality',()=>{
 const hit=broken=>{const s=quietOperation();s.operation.region=2;s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.mode='aim';s.boss.timer=999;s.boss.spawnClock=999;if(broken)s.boss.parts.forEach(p=>p.hp=0);const hp=s.boss.hp;s.shots=[bullet(s,s.boss,100)];step(s,dt);return hp-s.boss.hp;};assert.ok(hit(true)>hit(false)*1.5);
 const s=quietOperation();s.research=['medic'];s.phase='choice';s.choice={type:'armory',quality:'rare'};s.choices=[{id:'module:medic',kind:'module',module:'medic',rank:1}];assert.ok(banish(s,'module:medic'));assert.equal(s.choices[0].rank,2);
});

test('research trial selection checkpoints atomically and two holdout completions add exactly forty credits',async()=>{
 const {operationCredits}=await import('../src/reboot/campaign.js');const s=createOperation(17,['medic'],'medic'),base=emptyProfile();base.research=['medic'];base.trials=['medic'];const p=beginProfile(base,s);s.sites.forEach(n=>n.state='done');s.enemies=[];s.spawnClock=999;supply(s);choose(s,'module:medic');const next=checkpointProfile(p,s);assert.deepEqual(next.trials,[]);assert.deepEqual(p.trials,['medic']);
 const r={operation:{cleared:1},stats:{kills:0,elites:0,sitesCleared:0,raidSuccess:0,challenge:2,challengeWins:2},won:false};assert.equal(operationCredits(r),130);r.stats.challengeWins=0;r.stats.challenge=0;assert.equal(operationCredits(r),90);
});
function directorFixture(index){const s=quietOperation();for(let i=0;i<index;i++){clearRegion(s);choose(s,'advance');}s.enemies=[];s.sites.forEach(n=>n.state='done');s.blocks=[];s.player.x=800;s.player.y=800;s.player.invuln=1000;s.weapons[0].cd=999;s.spawnClock=0;s.pendingLevels=0;return s;}
test('campaign swarm packets are mostly infantry with separately capped ambient specialists',()=>{
 const s=directorFixture(2);tick(s,30);const c=t=>s.enemies.filter(e=>!e.dead&&e.cohort==='ambient'&&e.type===t).length;assert.ok(c('rifle')>s.enemies.length*.7);for(const id of ['officer','mortar','shield'])assert.ok(c(id)<=RULES.campaignDirector.ambientCaps[id]);assert.ok(s.enemies.length<=160);assert.ok(s.stats.directorSpawns.rifle>70);
});
test('pressure adds infantry density while specialist cadence and restoration stay deterministic',()=>{
 const a=directorFixture(1),b=directorFixture(1);b.pressure=2;b.operation.regionTime=120;tick(a,8);tick(b,8);assert.ok(b.stats.directorSpawns.rifle>a.stats.directorSpawns.rifle);assert.equal(b.stats.directorSpawns.mortar,a.stats.directorSpawns.mortar);assert.equal(b.stats.directorSpawns.shield,a.stats.directorSpawns.shield);takeEvents(a);const r=restore(snapshot(a));tick(a,5);tick(r,5);assert.deepEqual(snapshot(a),snapshot(r));
});
test('ambient population caps do not remove protected encounter targets',()=>{
 const s=directorFixture(2);s.enemies=Array.from({length:158},(_,i)=>enemy(`protected-${i}`,1400,100,'rifle',999));s.enemies.forEach(e=>{e.siteId='guarded';e.cohort='guard';});step(s,dt);assert.equal(s.enemies.filter(e=>e.cohort==='guard').length,158);assert.ok(s.enemies.length<=160);s.sites=[{id:'new-site',kind:'supply',name:'supply',state:'waiting',x:800,y:800}];step(s,dt);assert.equal(s.enemies.filter(e=>e.cohort==='guard').length,158);assert.equal(s.sites[0].state,'waiting');
});
test('jam reduces the actual mortar pressure and final infantry has a fixed XP value',()=>{
 const probe=jam=>{const s=directorFixture(2);s.operation.jammed=jam;s.stage='boss';s.boss.active=true;s.boss.timer=999;s.boss.spawnClock=0;tick(s,6.1);return s.enemies.filter(e=>e.cohort==='boss');};const jam=probe(true),normal=probe(false);assert.equal(jam.length,normal.length/2);assert.equal(jam.filter(e=>e.type==='mortar').length,1);assert.equal(normal.filter(e=>e.type==='mortar').length,2);
 const s=directorFixture(2),previousXp=s.stats.xpGenerated;s.spawnClock=999;s.enemies=[enemy('rifle',950,800,'rifle',1)];s.shots=[bullet(s,s.enemies[0])];step(s,dt);assert.equal(s.stats.xpGenerated-previousXp,2);assert.equal(s.gems[0].value,2);
});
test('previous active revisions settle secured rewards once without entering the new director or records',async()=>{
 const s=quietOperation();let p=beginProfile(emptyProfile(),s);s.stats.kills=30;clearRegion(s);p=checkpointProfile(p,s);p.recordScope='b05-campaign';delete p.active.run.balanceRevision;delete p.active.run.director;p.active.run.enemies.forEach(e=>delete e.cohort);const raw=JSON.stringify(p);assert.throws(()=>restore(p.active.run));const migrated=parseProfile(raw);assert.equal(migrated.active,null);assert.equal(migrated.credits,92);assert.equal(migrated.recordScope,RULES.balanceRevision);assert.equal(migrated.records.score,0);assert.equal(migrated.recent[0].reason,'rules-updated');assert.equal(migrated.recent[0].won,false);assert.ok(migrated.migrationNotice);assert.equal(parseProfile(JSON.stringify(migrated)).credits,92);
 const mem=memory();mem.values.set(STORAGE_KEY,raw);const store=createStore(mem);await store.commit(store.get());assert.equal(createStore(mem).get().credits,92);
});
test('record revision changes preserve credits, research and lifetime wins without repeating first-win cash',()=>{
 const old=emptyProfile();old.recordScope='previous';old.records={score:1234,time:100,challenge:2,wins:1};old.sequence=1;old.settled=1;old.credits=500;old.milestones.medic=true;old.research=['medic'];const p=parseProfile(JSON.stringify(old));assert.equal(p.records.score,0);assert.equal(p.records.wins,1);assert.equal(p.recordArchive[0].records.score,1234);assert.equal(p.credits,500);assert.deepEqual(p.research,['medic']);const s=quietOperation();let next=beginProfile(p,s);for(let i=0;i<3;i++){clearRegion(s);if(i<2)choose(s,'advance');}choose(s,'extract');next=settleProfile(next,s);assert.equal(next.credits,1010);assert.equal(next.records.wins,2);
});
test('multiple new researches each appear at their first compatible supply and checkpoint independently',()=>{
 const s=createOperation(17,['thermal','medic'],['thermal','medic']),base=emptyProfile();base.research=['thermal','medic'];base.trials=['thermal','medic'];let p=beginProfile(base,s);s.sites.forEach(n=>n.state='done');s.enemies=[];s.spawnClock=999;supply(s);assert.ok(s.choices.some(c=>c.module==='medic'));assert.ok(choose(s,'module:medic'));p=checkpointProfile(p,s);assert.deepEqual(p.trials,['thermal']);s.weapons.push({...makeWeapon('f'),uid:'fire'});s.modules.push({id:'coil',rank:1});supply(s,'supply-b');assert.ok(s.choices.some(c=>c.module==='thermal'));assert.ok(choose(s,'module:thermal'));p=checkpointProfile(p,s);assert.deepEqual(p.trials,[]);assert.deepEqual(s.stats.researchTrialsPicked,['medic','thermal']);
});
test('boss telegraphs render safely from their first warning frame through impact',async()=>{
 const {createRenderer}=await import('../src/reboot/render.js'),saved={innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight,devicePixelRatio:globalThis.devicePixelRatio};let arcs=0;
 const gradient={addColorStop(){}},context=new Proxy({arc(x,y,r){assert.ok(Number.isFinite(r)&&r>=0,`unsafe canvas radius ${r}`);arcs++;},createRadialGradient:()=>gradient},{get:(target,key)=>key in target?target[key]:()=>{}});
 try{Object.assign(globalThis,{innerWidth:960,innerHeight:540,devicePixelRatio:1});const canvas={getContext:()=>context},renderer=createRenderer(canvas,null),s=createOperation(17);s.operation.region=2;s.stage='boss';s.boss.active=true;s.hazards=[{x:800,y:500,r:58,timer:.95,duration:.95},{x:500,y:600,r:48,timer:1.2}];for(const timer of [.95,.94,.5,0]){s.hazards[0].timer=timer;renderer.draw(s);renderer.draw(s,true);}assert.ok(arcs>0);}finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('the cleared boss opens a physical gate and recoverable XP without pausing',()=>{
 const s=quietOperation(),profile=beginProfile(emptyProfile(),s);downBoss(s);
 const gate=exitGate(s),drop=s.gems.reduce((n,g)=>n+g.value,0);
 assert.equal(s.phase,'playing');assert.equal(s.choice,null);assert.equal(s.stage,'holdout');
 assert.ok(Math.hypot(gate.x-s.boss.x,gate.y-s.boss.y)<130);assert.equal(drop,32);
 assert.equal(action(s,'interact'),false);assert.equal(choose(s,'advance'),false);
 const loaded=parseProfile(JSON.stringify(checkpointProfile(profile,s))).active.run;
 assert.deepEqual(exitGate(loaded),gate);assert.equal(loaded.operation.cleared,1);
 assert.equal(loaded.tuning,s.tuning);assert.deepEqual(loaded.gems,s.gems);assert.deepEqual(loaded.events,[]);
 loaded.player.x=s.gems[0].x;loaded.player.y=s.gems[0].y;step(loaded,dt);
 assert.ok(loaded.gems.reduce((n,g)=>n+g.value,0)<drop);
 while(loaded.phase==='choice')assert.ok(skip(loaded));
 loaded.player.x=gate.x;loaded.player.y=gate.y;assert.ok(action(loaded,'interact'));assert.ok(choose(loaded,'advance'));
 assert.equal(exitGate(loaded),null);assert.equal(loaded.holdTime,0);assert.equal(loaded.gems.length,0);
});
test('XP picked up together displays its exact total and plays a single cue per streak',()=>{
 const s=quietOperation(),{x,y}=s.player;
 s.gems=[{x,y,age:0,value:2},{x:x+1,y,age:0,value:3,salvage:true}];step(s,dt);
 assert.equal(s.xp,5);assert.equal(s.gems.length,0);
 assert.deepEqual(takeEvents(s),['xp-pickup']);
 s.gems.push({x,y,age:0,value:1});step(s,dt);
 assert.equal(s.xp,6);assert.equal(s.effects.find(f=>f.type==='xp-pickup').value,6);
 assert.equal(s.effects.find(f=>f.type==='xp-pickup').salvage,true);assert.deepEqual(takeEvents(s),[]);
 tick(s,.7);assert.equal(s.effects.some(f=>f.type==='xp-pickup'),false);
});
test('staying at the gate keeps an active wager while departing counts its withdrawal once',()=>{
 const s=quietOperation();downBoss(s);Object.assign(s.player,exitGate(s));
 s.raidUsed=true;s.raid={state:'active'};
 assert.ok(action(s,'interact'));assert.ok(choose(s,'stay'));
 assert.equal(s.raid.state,'active');assert.equal(s.stats.raidFailed,0);
 assert.ok(action(s,'interact'));assert.ok(choose(s,'advance'));
 assert.equal(s.raid,null);assert.equal(s.stats.raidFailed,1);
});
test('remaining on the field escalates waves, armor and mortars on the same clock after stay or resume',()=>{
 const s=quietOperation();downBoss(s);s.player.invuln=200;
 tick(s,HOLDOUT.grace-.1);assert.equal(s.enemies.length,0);
 tick(s,.2);const first=s.enemies.filter(e=>e.cohort==='holdout');
 assert.ok(first.length>=10);assert.equal(holdoutTier(s.holdTime),1);assert.ok(first.every(e=>e.type!=='mortar'));
 const lightHp=first.find(e=>e.type==='rifle').maxHp;
 s.player.x=exitGate(s).x;s.player.y=exitGate(s).y;assert.ok(action(s,'interact'));
 const time=s.holdTime;tick(s,3);assert.equal(s.holdTime,time);assert.ok(choose(s,'stay'));
 assert.equal(s.holdTime,time);const r=restore(snapshot(s));assert.deepEqual(r.operation.gate,s.operation.gate);
 r.enemies=[];r.holdTime=HOLDOUT.grace+HOLDOUT.tierSeconds*2;r.spawnClock=0;step(r,dt);
 assert.equal(holdoutTier(r.holdTime),3);assert.ok(r.enemies.length>first.length);
 assert.ok(r.enemies.some(e=>e.type==='officer'));assert.ok(r.enemies.some(e=>e.type==='mortar'));
 assert.ok(r.enemies.find(e=>e.type==='rifle').maxHp>lightHp);assert.deepEqual(exitGate(r),exitGate(s));
});
test('last-version boss clear checkpoints resume at the physical gate without removing earned supplies',()=>{
 const s=quietOperation();clearRegion(s);s.balanceRevision='b06-swarms';delete s.operation.gate;
 pause(s);const previous=emptyProfile();previous.recordScope=s.balanceRevision;previous.records.score=456;
 const p=parseProfile(JSON.stringify(beginProfile(previous,s)));const loaded=p.active.run;
 assert.equal(loaded.phase,'paused');assert.equal(loaded.resumePhase,'playing');assert.equal(loaded.choice,null);
 assert.ok(loaded.operation.gate);assert.equal(loaded.tuning,2);assert.equal(p.recordArchive[0].records.score,456);
 resume(loaded);assert.ok(action(loaded,'interact'));assert.ok(choose(loaded,'advance'));
});
test('opening XP levels can pick a working module ahead of a gun rank',()=>{
 const candidates=new Set();
 for(const seed of [17,71,109,214,300]){
  const s=quietOperation();s.rng.supply=seed;s.gems=[{x:s.player.x,y:s.player.y,age:0,value:8}];step(s,dt);
  assert.equal(s.choice.type,'level');assert.ok(s.choices.some(c=>c.id==='rank:h'));
  const module=s.choices.find(c=>c.kind==='module');assert.ok(module);candidates.add(module.id);
  assert.ok(choose(s,module.id));assert.equal(s.weapons[0].level,1);assert.deepEqual(s.modules,[{id:module.module,rank:1}]);
 }
 assert.ok(candidates.size>=2);
});
test('a level draft can finish an assembled recipe without taking away the ordinary rank or sustain',()=>{
 for(const seed of [17,18,19,21]){
  const s=quietOperation();s.rng.supply=seed;s.level=8;s.player.branchChosen=true;s.pendingLevels=1;
  Object.assign(s.weapons[0],{level:2});
  s.weapons.push({...makeWeapon('r'),uid:'r',level:2},{...makeWeapon('f'),uid:'f',level:5,branch:'trail'});
  s.modules=[{id:'catalyst',rank:2},{id:'magnet',rank:1}];
  s.offeredWeapons=[['f'],['f']];
  assert.ok(action(s,'upgrade'));
  assert.equal(s.choices[0].kind,'rank');
  assert.notEqual(s.choices[0].weapon,'f');
  assert.ok(s.choices.some(c=>c.id==='rank:f'));
  assert.equal(s.choices[2].kind,'utility');
  const resumed=restore(snapshot(s));
  assert.deepEqual(resumed.choices,s.choices);
  assert.ok(choose(resumed,'rank:f'));
  assert.ok(assemblyOptions(resumed).some(c=>c.id==='evolve:f'));
  assert.ok(choose(s,s.choices[0].id));
  assert.ok(!assemblyOptions(s).some(c=>c.id==='evolve:f'));
 }
});
test('a new draft replaces incompatible and padding cards while keeping a saved draft intact',()=>{
 const s=quietOperation();s.level=7;s.player.branchChosen=true;s.pendingLevels=2;s.boosts.pickup=3;
 s.modules=[{id:'catalyst',rank:1},{id:'magnet',rank:3}];
 s.phase='choice';s.choice={type:'level',source:'LEVEL 7'};
 const saved={id:'module:catalyst',kind:'module',module:'catalyst',rank:1};
 s.choices=[saved,{id:'utility:health',kind:'utility',key:'health'}];
 const resumed=restore(snapshot(s));
 assert.deepEqual(resumed.choices,s.choices);
 assert.equal(choiceDetails(resumed,saved).impact,'호환 무장 필요');
 assert.equal(choiceDetails(resumed,saved).cost,'');
 assert.equal(choose(resumed,saved.id),false);
 assert.ok(choose(resumed,'utility:health'));
 assert.ok(resumed.choices.some(c=>c.id==='rank:h'));
 assert.ok(resumed.choices.some(c=>c.id==='module:ricochet'||c.id==='module:coil'));
 assert.ok(!resumed.choices.some(c=>c.id===saved.id));
 assert.equal(resumed.choices.filter(c=>c.kind==='utility').length,1);
});
test('a closing draft offers the installed module that completes a recipe with every slot full',()=>{
 const s=quietOperation();s.level=8;s.player.branchChosen=true;s.pendingLevels=1;
 s.weapons.push({...makeWeapon('f'),uid:'f',level:6,branch:'focused'});
 s.modules=['catalyst','magnet','ricochet','coil'].map(id=>({id,rank:1}));
 assert.ok(action(s,'upgrade'));
 assert.ok(s.choices.some(c=>c.id==='module:catalyst'));
 assert.ok(choose(s,'module:catalyst'));
 assert.equal(s.modules.length,4);
 assert.equal(s.modules[0].rank,2);
 assert.ok(assemblyOptions(s).some(c=>c.id==='evolve:f'));
});
test('a cleared pursuit unlocks one free maneuver with distinct stationary and moving effects',()=>{
 const s=quietOperation();downBoss(s);s.tuning=0;
 assert.equal(assemblyOptions(s).length,0);assert.ok(action(s,'challenge'));
 s.enemies.filter(e=>e.cohort==='challenge').forEach(e=>e.dead=true);s.operation.holdoutKills=HOLDOUT.rareKills;step(s,dt);
 assert.equal(s.stats.challengeWins,1);assert.ok(choose(s,'support:breach'));assert.ok(action(s,'gear'));
 const assault=restore(snapshot(s));assert.ok(choose(s,'maneuver:brace'));assert.ok(choose(assault,'maneuver:assault'));
 assert.equal(s.tuning,0);assert.equal(assemblyOptions(s).length,0);assert.equal(activeManeuver(s.player),null);
 s.enemies=[enemy('range',1100,800)];tick(s,.5);assert.equal(activeManeuver(s.player),'brace');
 s.weapons[0].cd=0;step(s,dt);assert.equal(s.shots[0].damage,weaponStats(s.weapons[0]).damage*1.25);
 step(s,dt,{x:1,y:0});assert.equal(activeManeuver(s.player),null);
 assault.enemies=[enemy('range',1100,800)];assert.ok(action(assault,'dash'));assault.weapons[0].cd=0;step(assault,dt,{x:1,y:0});
 assert.equal(activeManeuver(assault.player),'assault');assert.equal(assault.weapons[0].cd,weaponStats(assault.weapons[0]).interval*.78);
 step(assault,dt);assert.equal(activeManeuver(assault.player),null);
});

test('coast orders are optional, debit once on committed launch, and keep a fresh loadout',async()=>{
 const base=emptyProfile(),fee=SORTIE_ORDERS.wire.fee;
 assert.equal(canLaunchOrder({...base,credits:900},'wire'),false);
 const p={...base,records:{...base.records,wins:1},credits:900, research:['medic'],trials:['medic'],milestones:{medic:true}};
 assert.throws(()=>freshSortie(p,19,'bogus'));
 assert.throws(()=>freshSortie({...p,credits:fee-1},19,'wire'));
 const {run,next}=freshSortie(p,19,'wire');
 assert.equal(run.level,1);assert.deepEqual(run.weapons.map(w=>[w.id,w.level]),[['h',1]]);
 assert.deepEqual(run.trials,['medic']);assert.equal(next.credits,900-fee);assert.equal(p.credits,900);
 assert.equal(orderTarget(run).kind,'relay');assert.equal(restore(snapshot(run)).operation.order,'wire');
 assert.equal(freshSortie(p,19).run.sites.find(n=>n.id==='arsenal').kind,'armory');
 assert.equal(canLaunchOrder(next,'convoy'),false);
 const mem=memory();mem.setItem(STORAGE_KEY,JSON.stringify(p));const store=createStore(mem);
 mem.setFail(true);await assert.rejects(store.commit(next));assert.equal(store.get().credits,900);
 mem.setFail(false);await store.commit(next);assert.equal(store.get().credits,900-fee);
 const saved=checkpointProfile(store.get(),run);await store.commit(saved);assert.equal(store.get().credits,900-fee);
});

test('wire order requires recovering the completed relay and pays only after the final gate',()=>{
 const base=emptyProfile(),p={...base,records:{...base.records,wins:1,score:999},credits:900,milestones:{medic:true}};
 const {run:s,next}=freshSortie(p,19,'wire'),relay=orderTarget(s);
 s.blocks=[];s.enemies=[];s.spawnClock=999;s.player.invuln=999;
 for(const n of s.sites)if(n!==relay)n.state='done';
 Object.assign(s.player,{x:relay.x+100,y:relay.y});tick(s,5.1);
 assert.equal(relay.state,'ready');assert.equal(s.operation.orderDone,false);
 Object.assign(s.player,relay);step(s,dt);
 assert.equal(s.operation.orderDone,true);assert.equal(orderTarget(s),null);
 const abandoned=restore(snapshot(s));finish(abandoned,false);
 const partial=settleProfile(next,abandoned);
 assert.equal(partial.recent[0].orderBonus,0);assert.equal(partial.orderRecords,undefined);
 assert.equal(partial.records.score,999);
 assert.ok(skip(s));
 for(let i=0;i<3;i++){clearRegion(s);if(i<2)assert.ok(choose(s,'advance'));}
 assert.ok(choose(s,'extract'));assert.equal(orderBonus(s.result),SORTIE_ORDERS.wire.bonus);
 const complete=settleProfile(next,s),r=complete.recent[0];
 assert.equal(complete.credits,next.credits+r.credits);assert.equal(complete.records.score,999);
 assert.equal(complete.orderRecords.wire.wins,1);assert.equal(complete.orderRecords.wire.score,r.score);
 assert.equal(r.orderFee,70);assert.equal(r.orderBonus,180);assert.ok(r.newTime);
 assert.deepEqual(settleProfile(complete,s),complete);
 assert.equal(parseProfile(JSON.stringify(complete)).orderRecords.wire.time,r.seconds);
});

test('only the designated light coast convoy secures the convoy order',()=>{
 for(const contract of ['light','armored']){
  const s=createOperation(22,[],null,'convoy'),site=orderTarget(s);
  s.enemies=[];s.blocks=[];s.spawnClock=999;
  for(const n of s.sites)n.state=n===site?'ready':'done';
  Object.assign(s.player,site);step(s,dt);
  assert.equal(s.choice.type,'armory');assert.ok(action(s,`raid:${contract}`));
  const loaded=restore(snapshot(s));loaded.shots=[bullet(loaded,loaded.raid.target,10000)];step(loaded,dt);
  assert.equal(loaded.raid.state,'success');
  assert.equal(loaded.operation.orderDone,contract==='light');
  assert.equal(restore(snapshot(loaded)).operation.orderDone,contract==='light');
 }
});

test('missing the coast objective still permits standard extraction without an order bonus',()=>{
 const base=emptyProfile(),p={...base,records:{...base.records,wins:1},credits:900,milestones:{medic:true}};
 const {run:s,next}=freshSortie(p,17,'convoy');
 for(let i=0;i<3;i++){clearRegion(s);if(i<2)assert.ok(choose(s,'advance'));}
 assert.ok(choose(s,'extract'));assert.equal(s.result.won,true);
 const settled=settleProfile(next,s);
 assert.equal(settled.recent[0].orderBonus,0);assert.equal(settled.orderRecords,undefined);
 assert.equal(settled.records.wins,2);assert.equal(settled.records.time,null);
});

test('Marco earns a single bounded charge from nearby direct hits and keeps that charge through saving',()=>{
 const s=quietOperation('marco'),p=s.player;
 assert.equal(p.charge,RULES.marco.initialCharge);assert.equal(p.doctrine,'focus');
 tick(s,.5);assert.equal(p.charge,40);
 const close=enemy('close',900,800,'rifle',1000),second=enemy('second',920,810,'rifle',1000),far=enemy('far',1200,800,'rifle',1000);
 s.enemies=[close,second,far];s.shots=[bullet(s,close,1),bullet(s,second,1)];step(s,dt);
 assert.equal(p.charge,45);
 const saved=restore(snapshot(s));saved.shots=[bullet(saved,close,1)];step(saved,dt);
 assert.equal(saved.player.charge,45);
 tick(s,.35);s.shots=[bullet(s,far,1)];step(s,dt);assert.equal(p.charge,45);
 s.blocks=[{x:850,y:780,w:15,h:45,hp:-1}];s.shots=[bullet(s,close,1)];step(s,dt);assert.equal(p.charge,45);
 s.blocks=[];s.shots=[{...bullet(s,close,1),source:'payload'}];step(s,dt);assert.equal(p.charge,45);
 s.shots=[bullet(s,close,1)];step(s,dt);assert.equal(p.charge,50);
});

test('Marco shoots along movement, clips the first cover and pays charge even on a missed shot',()=>{
 const s=quietOperation('marco'),p=s.player;
 const front=enemy('front',925,800),side=enemy('side',925,860),behind=enemy('behind',1060,800),rear=enemy('rear',700,800);
 s.enemies=[front,side,behind,rear];
 s.blocks=[{id:'cover',x:985,y:770,w:40,h:60,hp:-1}];
 step(s,dt,{x:1,y:0});p.aim=Math.PI;p.charge=60;
 assert.ok(action(s,'skill'));assert.equal(p.charge,0);assert.equal(p.overdrive,0);
 assert.equal(front.hp,0);assert.equal(side.hp,100);assert.equal(behind.hp,100);assert.equal(rear.hp,100);
 const shot=s.effects.find(f=>f.type==='focus-shot');assert.equal(shot.angle,0);assert.ok(Math.abs(shot.x+shot.length-985)<1e-9);
 assert.equal(s.stats.focusHits,1);assert.equal(s.stats.focusKills,1);assert.equal(s.stats.focusGained,undefined);
 assert.equal(action(s,'skill'),false);
 p.charge=60;p.skillCd=0;p.moveAim=Math.PI/2;assert.ok(action(s,'skill'));assert.equal(p.charge,0);assert.equal(s.stats.focusHits,1);
});

test('Marco uses current input before the first movement tick and can save a charge interrupt',()=>{
 const s=quietOperation('marco');
 Object.assign(s.player,{x:600,y:800,charge:60});
 Object.assign(s.boss,{x:800,y:800,hp:1,active:true,mode:'windup',body:0});
 s.stage='boss';
 s.boss.chargePath=planCoastCharge(s);
 assert.equal(s.player.moveAim,-Math.PI/2);
 assert.ok(action(s,'skill',{x:1,y:0}));
 assert.equal(s.player.moveAim,0);
 assert.equal(s.boss.dead,true);
 assert.equal(s.boss.chargePath,undefined);
 const loaded=restore(snapshot(s));
 step(loaded,dt);
 assert.equal(loaded.stage,'holdout');
 assert.ok(exitGate(loaded));
});
test('focused aim hits one exposed boss plate and sweep covers a wider infantry line',()=>{
 const railShot=(x,mode,doctrine='focus')=>{
  const s=quietOperation('marco');s.operation.region=1;s.stage='boss';
  Object.assign(s.boss,regionBoss(1,19),{active:true,mode,x:800,y:620});
  Object.assign(s.player,{x,y:800,charge:60,doctrine});
  const before=s.boss.hp,gun=s.boss.parts[0],gunHp=gun.hp;
  assert.ok(action(s,'skill',{x:0,y:-1}));
  return [before-s.boss.hp,gunHp-gun.hp,s.stats.focusWeakHits];
 };
 assert.deepEqual(railShot(800,'recover'),[55,0,0]);
 assert.deepEqual(railShot(740,'aim'),[0,110,0]);
 assert.deepEqual(railShot(740,'recover'),[0,297,1]);
 const sweep=railShot(740,'recover','sweep');
 assert.ok(Math.abs(sweep[1]-150.8)<1e-6);assert.equal(sweep[2],1);
 const wider=quietOperation('marco'),e=enemy('side',852,680);
 wider.enemies=[e];wider.player.doctrine='sweep';wider.player.charge=60;
 assert.ok(action(wider,'skill'));assert.equal(e.hp,0);
});

test('Marco wins keep a separate standard and order record and preserve Fio marks',()=>{
 const base=emptyProfile();base.records.score=1111;base.records.time=88;base.records.wins=1;base.credits=500;base.milestones.medic=true;
 function played(p,order){
  const {run:s,next}=freshSortie(p,17,order,'marco');
  if(order){s.sites.find(site=>site.id==='arsenal').state='done';s.operation.orderDone=true;}
  for(let i=0;i<3;i++){clearRegion(s);if(i<2)assert.ok(choose(s,'advance'));}
  assert.ok(choose(s,'extract'));
  return settleProfile(next,s);
 }
 const standard=played(base,null),ordered=played(standard,'convoy');
 assert.equal(ordered.records.score,1111);assert.equal(ordered.records.time,88);assert.equal(ordered.records.wins,3);
 assert.equal(ordered.marcoRecords.wins,1);assert.equal(ordered.marcoRecords.orders.convoy.wins,1);assert.equal(ordered.orderRecords,undefined);
 assert.equal(ordered.recent[0].operator,'marco');assert.equal(parseProfile(JSON.stringify(ordered)).lastOperator,'marco');
 assert.equal(freshSortie(ordered,17).run.operator,undefined);
});
