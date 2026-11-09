import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {exitGate,holdoutTier,HOLDOUT,DEFENSE_ZONE,CARGO_CREDITS,operationCredits} from '../src/reboot/campaign.js';
import {RULES,makeWeapon,weaponStats,buildPaths} from '../src/reboot/content.js';
import {createRun,createOperation,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,snapshot,restore,takeEvents,activeManeuver,assemblyOptions,pickupReach} from '../src/reboot/model.js';
import {STORAGE_KEY,buyResearch,emptyProfile,beginProfile,checkpointProfile,settleProfile,createStore,parseProfile,freshSortie} from '../src/reboot/profile.js';
import {pilot} from './reboot-pilot.mjs';
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
 const s=quiet(),w=s.weapons[0];w.level=6;w.evolved=true;w.fusion={secondary:'r',branch:'homing',overflow:0};w.payload=9;s.enemies=[enemy('impact',1000,800,'rifle',1),enemy('next',1100,800,'rifle',1000)];s.shots=[bullet(s,s.enemies[0],2)];step(s,dt);const payload=s.shots.find(q=>q.source==='payload');assert.ok(payload);assert.ok(payload.x>=1000);assert.equal(payload.target,'next');assert.equal(s.stats.payloadBursts,1);tick(s,.5);assert.equal(s.stats.payloadBursts,1);assert.equal(w.payload,0);
});
test('assembly progress distinguishes a ready recipe from an already completed weapon',()=>{
 const s=quiet();assert.ok(buildPaths(s).every(p=>!p.ready&&!p.complete));s.weapons[0].level=6;s.weapons[0].branch='ricochet';s.modules=[{id:'ricochet',rank:2}];assert.ok(buildPaths(s).some(p=>p.ready&&p.title.includes('사중')));action(s,'gear');choose(s,'evolve:h');assert.ok(buildPaths(s).some(p=>p.complete&&p.title.includes('사중')));assert.ok(buildPaths(s).every(p=>!p.ready));
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

 test('exhausted crate banish stays quality-scaled and owned support may be excluded',()=>{
 const s=quiet();s.excluded=['coil','magnet'];s.phase='choice';s.choice={type:'armory',quality:'prototype'};s.choices=[{id:'module:ricochet',kind:'module',module:'ricochet',rank:3}];assert.ok(banish(s,'module:ricochet'));assert.equal(s.choices[0].kind,'resupply');assert.equal(s.choices[0].heal,36);
 const a=quiet();a.modules=[{id:'coil',rank:1}];a.phase='choice';a.choice={type:'raid-reward',quality:'rare',contract:'armored'};a.choices=[{id:'module:coil',kind:'module',module:'coil',rank:2,support:true}];assert.ok(banish(a,'module:coil'));assert.equal(a.modules[0].rank,1);assert.ok(!a.excluded.includes('coil'));assert.ok(!a.choices.some(c=>c.module==='coil'));
 });
 test('burning strategic targets keep flame attention and malformed packet checkpoints fail early',()=>{
 for(const type of ['boss','courier']){const s=quiet();s.modules=[{id:'catalyst',rank:3}];s.weapons=[{...makeWeapon('f'),uid:'flame',level:4,branch:'trail',cd:0}];const target=enemy('strategic',950,800,'rifle',1000);target.type=type;target.burn=2;target.burnDps=6;if(type==='boss'){s.boss.active=true;s.stage='boss';Object.assign(s.boss,target,{timer:99,parts:[],mode:'recover'});}else s.raid={state:'active',contract:'light',target,route:[{x:950,y:800},{x:1000,y:800}],progress:0,maxProgress:1400,quality:'common'};s.enemies=[enemy('a',650,780,'rifle',1000),enemy('b',650,820,'rifle',1000)];step(s,dt);assert.equal(s.weapons[0].targetId,'strategic');}
 const s=quiet();s.phase='choice';s.choice={type:'armory',quality:'rare'};s.choices=[{id:'bad',kind:'resupply',heal:-1,charge:0}];assert.throws(()=>restore(s));
 });

test('heat audio stays distinct while hurt keeps foreground priority',async()=>{const {selectAudioEvents}=await import('../src/game/audio.js');assert.deepEqual(selectAudioEvents(new Set(['heat-break','power-kill'])),['heat-break']);assert.deepEqual(selectAudioEvents(new Set(['heat-break','flame-loop','hurt'])),['hurt']);});

function quietOperation(){const s=createOperation(17);s.sites.forEach(n=>n.state='done');s.blocks=[];s.enemies=[];s.spawnClock=999;s.player.x=800;s.player.y=800;s.weapons[0].cd=999;return s;}
function downBoss(s){s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.hp=1;s.boss.timer=999;s.boss.spawnClock=999;s.boss.parts=[];s.enemies=[];s.spawnClock=999;s.player.x=800;s.player.y=800;s.shots=[bullet(s,s.boss)];step(s,dt);}
function clearRegion(s){downBoss(s);assert.equal(s.phase,'playing');assert.equal(s.stage,'holdout');Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.equal(s.choice.type,'clear');}
test('campaign advances real maps while retaining gear, HP, XP, tokens and earned choices',()=>{
 const s=quietOperation();s.weapons[0].level=4;s.weapons[0].branch='grenade';s.modules=[{id:'coil',rank:2}];s.player.hp=50;s.xp=4;clearRegion(s);assert.equal(s.operation.cleared,1);assert.equal(s.player.hp,65);assert.equal(s.tuning,2);const gear=snapshot(s.weapons),modules=snapshot(s.modules),hp=s.player.hp,xp=s.xp;assert.ok(choose(s,'stay'));assert.equal(s.operation.region,0);s.player.x=800;s.player.y=420;assert.equal(action(s,'interact'),false);Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.ok(choose(s,'advance'));assert.equal(s.operation.region,1);assert.equal(s.operation.regionTime,0);assert.equal(s.pressure,0);assert.deepEqual(s.weapons,gear);assert.deepEqual(s.modules,modules);assert.equal(s.player.hp,hp);assert.equal(s.xp,xp);assert.ok(s.sites.some(n=>n.kind==='relay'));assert.ok(s.blocks.some(b=>b.id==='r1'));assert.deepEqual(restore(snapshot(s)).operation,s.operation);
});
test('intermediate return is partial and only the third clear permits full extraction once',()=>{
 const partial=quietOperation();clearRegion(partial);choose(partial,'extract');assert.equal(partial.result.won,false);assert.equal(partial.result.operation.cleared,1);
 const s=quietOperation();for(let i=0;i<3;i++){clearRegion(s);if(i<2)assert.ok(choose(s,'advance'));}assert.equal(s.tuning,3);assert.equal(s.operation.cleared,3);assert.ok(!s.choices.some(c=>c.kind==='advance'));assert.ok(choose(s,'extract'));assert.ok(s.result.won);const score=s.stats.score;assert.equal(finish(s,true),false);assert.equal(s.stats.score,score);
});
test('a simultaneous intermediate boss death cannot heal or advance a dead pilot',()=>{
 const s=quietOperation();s.player.hp=1;s.stage='boss';s.boss.active=true;s.boss.x=1000;s.boss.y=800;s.boss.hp=1;s.boss.timer=999;s.boss.spawnClock=999;s.boss.parts=[];s.shots=[bullet(s,s.boss)];s.enemyShots=[{x:800,y:800,vx:0,vy:0,life:1,r:5}];step(s,dt);assert.equal(s.phase,'result');assert.equal(s.player.hp,0);assert.equal(s.tuning,1);assert.equal(s.result.operation.cleared,1);assert.equal(s.result.won,false);
});
test('rail and harbor use different telegraphs and disabled rail parts open permanent safe lanes',()=>{
 const s=quietOperation();s.operation.region=1;s.stage='boss';s.boss.active=true;s.boss.timer=0;s.boss.parts[0].hp=0;step(s,dt);assert.ok(s.hazards.some(h=>h.lane));assert.ok(!s.hazards.some(h=>h.lane&&h.x===500));assert.equal(s.boss.mode,'salvo');
 const p=quietOperation();p.operation.region=2;p.stage='boss';p.boss.active=true;p.boss.timer=0;step(p,dt);assert.ok(p.hazards.length>=3);assert.ok(p.hazards.every(h=>!h.lane));
});
test('relay progresses only while in range and port control offers a real safety or loot trade',()=>{
 const s=quietOperation();s.operation.region=1;s.sites=[{id:'relay',kind:'relay',name:'relay',state:'active',x:800,y:800,progress:0}];tick(s,1);assert.ok(s.sites[0].progress>.9);s.player.x=1100;const before=s.sites[0].progress;tick(s,1);assert.equal(s.sites[0].progress,before);
 const p=quietOperation();p.operation.region=2;p.sites=[{id:'control',kind:'control',name:'control',state:'ready',x:800,y:800}];step(p,dt);assert.equal(p.choice.type,'control');const loot=restore(snapshot(p));assert.ok(choose(p,'control:jam'));assert.equal(p.operation.jammed,true);assert.ok(choose(loot,'control:loot'));assert.equal(loot.choice.type,'armory');assert.equal(loot.choice.quality,'rare');
});
test('campaign rewards settle once and research adds a future slotted candidate rather than free damage',()=>{
 const s=quietOperation();let p=beginProfile(emptyProfile(),s);for(let i=0;i<3;i++){clearRegion(s);if(i<2)choose(s,'advance');}choose(s,'extract');p=settleProfile(p,s);assert.equal(p.credits,710);assert.ok(p.milestones.medic);assert.equal(p.records.wins,1);const again=settleProfile(p,s);assert.equal(again.credits,710);const researched=buyResearch(p,'medic');assert.equal(researched.credits,410);assert.deepEqual(researched.research,['medic']);assert.deepEqual(researched.trials,['medic']);assert.equal(buyResearch(researched,'medic'),null);assert.equal(p.credits,710);
 const next=createOperation(71,researched.research,'medic');next.sites.forEach(n=>n.state='done');next.enemies=[];next.spawnClock=999;supply(next);assert.ok(next.choices.some(c=>c.module==='medic'));assert.equal(next.modules.length,0);assert.ok(choose(next,'module:medic'));assert.equal(next.modules[0].rank,1);assert.equal(next.stats.researchTrialPicked,'medic');
});
test('researched effects are conditional, capped and cannot recursively trigger themselves',()=>{
 const s=quiet();s.modules=[{id:'shrapnel',rank:1}];s.enemies=[enemy('burst',940,800,'rifle',1000)];s.shots=[{...bullet(s,s.enemies[0],50),rocket:true,radius:100}];step(s,dt);assert.equal(s.stats.shrapnelBursts,1);assert.equal(s.effects.filter(f=>f.type==='shrapnel').length,3);
 const m=quiet();m.modules=[{id:'medic',rank:1}];m.player.hp=20;m.enemies=[enemy('elite-a',940,800,'officer',1),enemy('elite-b',960,800,'officer',1)];m.shots=m.enemies.map(e=>bullet(m,e));step(m,dt);assert.equal(m.player.hp,32);assert.ok(m.medicCd>0);
});
test('final stay and menu retreat remain partial until the exit extraction decision',()=>{
 const s=quietOperation();s.operation.region=2;clearRegion(s);choose(s,'stay');const partial=snapshot(s);assert.ok(finish(partial,true,'retreat'));assert.equal(partial.result.won,false);assert.ok(!partial.stats.extractionPaid);Object.assign(s.player,exitGate(s));assert.ok(action(s,'interact'));assert.ok(choose(s,'extract'));assert.ok(s.result.won);assert.ok(s.operation.extracted);
});
test('checkpoints and settlements reject a different run instance including same-seed replay',()=>{
 const a=quietOperation(),p=beginProfile(emptyProfile(),a),other=quietOperation();const q=beginProfile({...emptyProfile(),sequence:1},other);assert.notEqual(a.runId,other.runId);for(let i=0;i<3;i++){clearRegion(other);if(i<2)choose(other,'advance');}choose(other,'extract');const before=snapshot(p);assert.throws(()=>checkpointProfile(p,other));assert.throws(()=>settleProfile(p,other));assert.deepEqual(p,before);assert.equal(q.active.runId,other.runId);
});
test('campaign holdout opens D2 after D1 with rising score and finite credit basis',()=>{
 const s=quietOperation();clearRegion(s);choose(s,'stay');assert.ok(action(s,'challenge'));assert.equal(s.challenge.tier,1);s.challenge.targets.forEach(id=>{s.enemies.find(e=>e.id===id).dead=true;});step(s,dt);assert.equal(s.challenge.state,'complete');assert.equal(s.stats.challenge,1);const score=s.stats.score;assert.ok(choose(s,'support:breach'));assert.ok(action(s,'challenge'));assert.equal(s.challenge.tier,2);s.challenge.targets.forEach(id=>{s.enemies.find(e=>e.id===id).dead=true;});step(s,dt);assert.equal(s.stats.challenge,2);assert.equal(s.stats.score-score,1000);assert.equal(s.stats.challengeWins,2);
});
test('a holdout reward carries only to the next front and survives a checkpoint',()=>{
 const s=quietOperation(),profile=beginProfile(emptyProfile(),s);
 clearRegion(s);choose(s,'stay');assert.ok(action(s,'challenge'));
 const resumed=restore(checkpointProfile(profile,s).active.run);
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
test('rail defense pauses outside the zone and harbor interception can fail and retry',()=>{
 const rail=quietOperation();rail.operation.region=1;downBoss(rail);
 rail.spawnClock=999;rail.player.invuln=999;assert.ok(action(rail,'challenge'));
 tick(rail,1);assert.equal(rail.challenge.progress,0);assert.equal(rail.phase,'playing');
 Object.assign(rail.player,{x:DEFENSE_ZONE.x,y:DEFENSE_ZONE.y});
 const saved=restore(snapshot(rail));tick(saved,8.2);assert.equal(saved.choice.type,'pursuit-reward');
 const port=quietOperation();port.operation.region=2;downBoss(port);
 port.spawnClock=999;port.player.invuln=999;assert.ok(action(port,'challenge'));
 const y=port.challenge.target.y;tick(port,1);assert.ok(port.challenge.target.y<y);
 tick(port,17.2);assert.equal(port.challenge.state,'failed');assert.equal(port.phase,'playing');
 assert.ok(action(port,'challenge'));assert.equal(port.challenge.tier,1);
 port.shots=[bullet(port,port.challenge.target,1200)];step(port,dt);
 assert.equal(port.choice.type,'pursuit-reward');const before=operationCredits(port);
 assert.ok(choose(port,'pursuit:cargo'));assert.equal(operationCredits(port),before+CARGO_CREDITS);
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
test('all region supplies and boss entrances stay reachable around permanent geometry',async()=>{
 const {regionLayout}=await import('../src/reboot/campaign.js');for(const seed of [17,18])for(let index=0;index<3;index++){const m=regionLayout(seed,index),free=(x,y)=>x>55&&x<1545&&y>55&&y<1145&&!m.blocks.some(b=>b.hp!==0&&x+16>b.x&&x-16<b.x+b.w&&y+16>b.y&&y-16<b.y+b.h),key=(x,y)=>`${x},${y}`,queue=[[800,1040]],seen=new Set(['800,1040']);for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[20,0],[-20,0],[0,20],[0,-20]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(seen.has(k)||!free(nx,ny))continue;seen.add(k);queue.push([nx,ny]);}}for(const goal of [...m.sites,{x:800,y:350}])assert.ok(queue.some(([x,y])=>Math.hypot(x-goal.x,y-goal.y)<55),`${index}/${seed} ${goal.id||'boss'}`);}
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
test('a cleared pursuit unlocks one free maneuver with distinct stationary and moving effects',()=>{
 const s=quietOperation();downBoss(s);s.tuning=0;
 assert.equal(assemblyOptions(s).length,0);assert.ok(action(s,'challenge'));
 s.enemies.filter(e=>e.cohort==='challenge').forEach(e=>e.dead=true);step(s,dt);
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
