import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RULES,makeWeapon,weaponStats,buildPaths} from '../src/reboot/content.js';
import {createRun,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,snapshot,restore,takeEvents} from '../src/reboot/model.js';
import {STORAGE_KEY,emptyProfile,beginProfile,checkpointProfile,settleProfile,createStore,parseProfile} from '../src/reboot/profile.js';
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
