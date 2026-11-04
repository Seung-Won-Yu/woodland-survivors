import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpedition,interact,takeSupply,updateExpedition,nearestSite} from '../src/game/expedition.js';
import {stepGame,spawnEnemy,healPlayer,packRun,unpackRun,useSignature,applyChoice} from '../src/core/game.js';
import {RELICS,RELIC_IDS,createRelicCache,openRelicCache,equipRelic,leaveRelicCache,onRelicWeaponHit,onRelicWeaponKill,onRelicHealing,tickRelics,absorbRelicShield} from '../src/core/relics.js';
import {normalizeJournal,recordRun,discoverRelics} from '../src/game/journal.js';
import {LANDMARKS} from '../src/game/terrain.js';
import {selectAudioEvents} from '../src/game/audio.js';
import {pilot} from './pilot.mjs';

// Isolated rule fixtures only. The final pilot test uses ordinary movement and rewards.
function arena(ids=[],weapon='acorn'){
  const g=createExpedition('pip',weapon,1437);g.enemies=[];g.terrain=null;g.spawn=g.nextSurge=g.nextElite=1e6;g.relics.items=[...ids];updateExpedition(g);return g;
}
function advance(g,seconds,input={}){for(let i=0;i<seconds*60&&g.phase==='playing';i++)stepGame(g,1/60,input);}
function cacheWith(g,first,source='supply'){const c=createRelicCache(g,source,g.player.x,g.player.y);c.deck=[...first,...RELIC_IDS.filter(id=>!first.includes(id))];return c;}

test('supply leaves an optional physical cache; walking across it never forces another modal',()=>{
  const g=arena();Object.assign(g.player,LANDMARKS.supply);assert.ok(interact(g));assert.ok(takeSupply(g,'boots'));
  const c=g.pickups.find(p=>p.type==='relic');assert.ok(c);Object.assign(g.player,{x:c.x,y:c.y});advance(g,.1);assert.equal(g.phase,'playing');assert.equal(nearestSite(g).type,'relic');assert.ok(interact(g));assert.equal(g.phase,'relic');
  const options=[...g.relicOffer.options];assert.ok(leaveRelicCache(g));assert.ok(g.pickups.includes(c));assert.ok(interact(g));assert.deepEqual(g.relicOffer.options,options);assert.ok(equipRelic(g,options[0]));assert.equal(g.phase,'playing');assert.equal(g.pickups.includes(c),false);
});
test('two relic slots require an explicit replacement and reset removed charges',()=>{
  const g=arena();for(const id of ['wind','thread']){openRelicCache(g,cacheWith(g,[id]));assert.ok(equipRelic(g,id));}
  g.relics.wind.distance=240;g.relics.stats.wind.procs=3;openRelicCache(g,cacheWith(g,['shell']));assert.equal(equipRelic(g,'shell'),false);assert.deepEqual(g.relics.items,['wind','thread']);assert.equal(g.relicOffer.selected,'shell');assert.equal(equipRelic(g,'shell','missing'),false);assert.ok(equipRelic(g,'shell','wind'));assert.deepEqual(g.relics.items,['thread','shell']);assert.equal(g.relics.wind.distance,0);assert.equal(g.relics.stats.wind.procs,3,'historical contribution remains in the result');
});
test('seeded offers and three clearings vary between runs without consuming combat RNG',()=>{
  const locations=new Set(),offers=new Set();for(let seed=1;seed<=20;seed++){
    const g=createExpedition('pip',undefined,seed),same=createExpedition('pip',undefined,seed),before=g.seed,c=createRelicCache(g,'supply',0,0),c2=createRelicCache(same,'supply',0,0);
    assert.equal(g.seed,before);assert.deepEqual(c.deck,c2.deck);assert.equal(c.deck.length,6);assert.ok(['wind','thread'].includes(c.deck[0]));assert.ok(['shell','thorn'].includes(c.deck[1]));offers.add(c.deck.slice(0,2).join());const t=g.expedition.sites.find(s=>s.id==='trial');locations.add(`${t.x},${t.y}`);
  }assert.equal(locations.size,3);assert.ok(offers.size>=3);
});
test('wind charges from resolved travel and emits real piercing damage once per charge',()=>{
  const g=arena(['wind']);advance(g,1,{x:1});const e=spawnEnemy(g,'elite',g.player.x+90,0,{hp:10000,maxHp:10000,speed:0,clock:100});g.weapons.acorn.clock=100;
  assert.equal(onRelicWeaponHit(g,e,{source:'weapon'},false,0).length,0);advance(g,.3,{x:1});assert.equal(g.relics.wind.distance,240);g.weapons.acorn.clock=0;advance(g,.4);
  assert.equal(g.relics.stats.wind.procs,1);assert.ok(g.relics.stats.wind.damage>0);assert.ok(g.projectiles.filter(p=>p.kind==='wind').every(p=>p.context.source==='relic'));
  const wall=arena(['wind']);wall.terrain=[{x:40,y:0,r:25}];advance(wall,2,{x:1});assert.ok(wall.relics.wind.distance<10,'walking into terrain does not charge a full wind burst');
});
test('thread marks a surviving weapon target and pays off only after enough movement',()=>{
  const g=arena(['thread']);const e=spawnEnemy(g,'elite',90,0,{hp:10000,maxHp:10000,speed:0,clock:100});advance(g,.5);assert.equal(g.relics.thread.target,e.id);g.weapons={};advance(g,.5,{y:1});assert.equal(g.relics.stats.thread.procs,0);advance(g,.2,{y:1});assert.equal(g.relics.stats.thread.procs,1);assert.ok(g.relics.stats.thread.damage>0);
  onRelicWeaponHit(g,e,{source:'weapon'},false,0);g.time+=2;onRelicWeaponHit(g,e,{source:'weapon'},false,0);e.dead=true;tickRelics(g,0);assert.equal(g.relics.thread.target,0);
});
test('shell blocks actual damage, records only absorption and recharges after its cooldown',()=>{
  const g=arena(['shell']);g.weapons={};advance(g,.8);assert.equal(g.relics.shell.shield,12);g.player.invincible=0;spawnEnemy(g,'shroom',g.player.x,g.player.y,{speed:0,damage:20});const hp=g.player.hp;stepGame(g,1/60);assert.equal(g.player.hp,hp-8);assert.equal(g.metrics.damageTaken,8);assert.equal(g.relics.stats.shell.absorbed,12);assert.equal(g.relics.tide.healing,0);
  g.enemies=[];advance(g,7);assert.equal(g.relics.shell.shield,0);advance(g,1.1);assert.equal(g.relics.shell.shield,12);
  const b=arena(['shell']);b.relics.shell.shield=12;assert.equal(absorbRelicShield(b,7),7);assert.equal(b.relics.shell.shield,5);assert.equal(b.relics.shell.readyAt,0);
});
test('thorn reacts to a repeated weapon hit after knockback and deals bounded splash damage',()=>{
  const g=arena(['thorn']);spawnEnemy(g,'elite',110,0,{hp:10000,maxHp:10000,speed:0,clock:100});advance(g,3);assert.ok(g.relics.stats.thorn.procs>=1);assert.ok(g.relics.stats.thorn.procs<=3);assert.ok(g.relics.stats.thorn.damage>0);
  const count=g.relics.stats.thorn.procs,e=g.enemies[0];assert.equal(onRelicWeaponHit(g,e,{source:'relic',relic:'wind'},true,0).length,0);assert.equal(g.relics.stats.thorn.procs,count);
});
test('seed drops real heal pickups, respects cap, waits at full HP and expires',()=>{
  const g=arena(['seed'],'bloom');g.weapons.bloom.clock=0;for(let i=0;i<12;i++)spawnEnemy(g,'shroom',30+i,0,{hp:1,maxHp:1,speed:0});advance(g,.2);
  const seed=g.pickups.find(p=>p.relicId==='seed');assert.ok(seed);assert.equal(seed.amount,8);assert.equal(g.relics.stats.seed.procs,1);while(g.phase==='choice')applyChoice(g,0);g.pickups=g.pickups.filter(p=>p.relicId==='seed');Object.assign(g.player,{x:seed.x,y:seed.y});g.weapons={};advance(g,.1);assert.ok(g.pickups.includes(seed),'full HP leaves the seed in the world');g.player.hp-=20;advance(g,.1);assert.equal(g.relics.stats.seed.healed,8);assert.equal(g.pickups.includes(seed),false);
  g.pickups=[{id:++g.id,type:'heal',x:0,y:0,amount:8,relicId:'seed',expiresAt:g.time+.05},{id:++g.id,type:'heal',x:0,y:0,amount:8,relicId:'seed',expiresAt:g.time+16}];g.relics.seed.readyAt=0;for(let i=0;i<24;i++)assert.equal(onRelicWeaponKill(g,{x:0,y:0},{source:'weapon'}).length,0);g.player.hp=g.player.maxHp;advance(g,.1);assert.equal(g.pickups.length,1);
});
test('tide uses actual ordinary healing, excludes overheal and relic healing, and pushes enemies',()=>{
  const g=arena(['tide']);g.weapons={};Object.assign(g.player,LANDMARKS.spring);const e=spawnEnemy(g,'elite',g.player.x+80,g.player.y,{speed:0,hp:1000,maxHp:1000,clock:100});stepGame(g,1/60);assert.equal(healPlayer(g,40),0);assert.equal(g.relics.stats.tide.procs,0);
  g.player.hp-=30;assert.equal(healPlayer(g,10,'relic','seed'),10);assert.equal(g.relics.tide.healing,0);assert.ok(interact(g));assert.equal(g.relics.stats.tide.procs,1);assert.ok(g.relics.stats.tide.damage>0);assert.ok(e.kx>0);assert.equal(g.player.hp,g.player.maxHp);
  assert.equal(onRelicHealing(g,0,'world').length,0);assert.equal(onRelicHealing(g,30,'relic').length,0);
});
test('relic and signature damage never charge weapon hit or kill chains',()=>{
  const g=arena(['wind','seed']);g.relics.wind.distance=240;for(const source of ['relic','signature']){
    assert.equal(onRelicWeaponHit(g,{id:1,x:10,y:0,dead:false},{source},true,0).length,0);for(let i=0;i<12;i++)assert.equal(onRelicWeaponKill(g,{x:0,y:0},{source}).length,0);
  }assert.equal(g.relics.seed.kills,0);assert.equal(g.relics.wind.distance,240);
  g.player.charge=100;spawnEnemy(g,'shroom',70,0,{hp:1,maxHp:1,speed:0});assert.ok(useSignature(g));g.weapons={};advance(g,.5);assert.ok(g.kills>0);assert.equal(g.relics.seed.kills,0);assert.equal(g.relics.stats.wind.procs,0);
});
test('a trial needs explicit interaction, freezes with menus and rewards only once after twenty seconds',()=>{
  const g=arena();g.weapons={};const t=g.expedition.sites.find(s=>s.id==='trial');Object.assign(g.player,{x:t.x,y:t.y});advance(g,1);updateExpedition(g);assert.equal(t.state,'ready');assert.ok(interact(g));const before=g.time;g.phase='paused';advance(g,2);updateExpedition(g);assert.equal(g.time,before);assert.equal(t.state,'active');g.phase='playing';
  g.player.invincible=100;for(let i=0;i<1250;i++){stepGame(g,1/60);updateExpedition(g);}
  assert.equal(t.state,'spent');assert.ok(g.expedition.milestones.trialClearedAt-before>=20);assert.equal(g.pickups.filter(p=>p.type==='relic'&&p.source==='trial').length,1);assert.equal(g.expedition.trial.wave,3);assert.equal(g.enemies.filter(e=>e.trialWave).length,9);updateExpedition(g);assert.equal(g.pickups.filter(p=>p.type==='relic').length,1);
});
test('leaving a trial for 1.5 seconds cancels it without a reward or blocking the expedition',()=>{
  const g=arena();g.weapons={};const t=g.expedition.sites.find(s=>s.id==='trial');Object.assign(g.player,{x:t.x,y:t.y});interact(g);g.player.x+=300;
  for(let i=0;i<100;i++){stepGame(g,1/60);updateExpedition(g);}assert.equal(t.state,'abandoned');assert.equal(g.pickups.filter(p=>p.type==='relic').length,0);assert.equal(g.phase,'playing');
});
test('trial reinforcements show a warning before they appear',()=>{
  const g=arena();g.weapons={};const t=g.expedition.sites.find(s=>s.id==='trial');Object.assign(g.player,{x:t.x,y:t.y});interact(g);updateExpedition(g);assert.equal(g.enemies.length,0);assert.equal(g.effects.length,3);assert.equal(g.expedition.trial.pending.length,3);
  advance(g,.6);updateExpedition(g);assert.equal(g.enemies.length,0);advance(g,.1);updateExpedition(g);assert.equal(g.enemies.filter(e=>e.trialWave).length,3);
});
test('clearing a trial recovers only earned nearby XP through visible flying gems',()=>{
  const g=arena();g.weapons={};g.player.invincible=100;const t=g.expedition.sites.find(s=>s.id==='trial');Object.assign(g.player,{x:t.x,y:t.y});g.gems.set('near',{x:t.x+250,y:t.y,value:5,age:1});g.gems.set('far',{x:t.x+600,y:t.y,value:7,age:1});interact(g);
  let sawFlying=false;for(let i=0;i<1280;i++){stepGame(g,1/60);updateExpedition(g);if(g.flying.some(gem=>gem.value===5))sawFlying=true;}
  assert.ok(sawFlying);assert.equal(g.metrics.xpCollected,5);assert.equal(g.xp,5);assert.equal(g.gems.get('far').value,7);assert.equal(g.level,1);assert.equal(g.gems.has('near'),false);
});
test('an in-flight hostile shot does not inherit a player relic context and restores correctly',()=>{
  const g=arena(['wind']);g.weapons={acorn:{rank:1,evolved:false,clock:10}};spawnEnemy(g,'spore',350,0,{clock:0,speed:0});advance(g,.8);assert.ok(g.projectiles.some(p=>p.hostile));assert.ok(g.projectiles.filter(p=>p.hostile).every(p=>p.context===undefined));assert.ok(unpackRun(packRun(g)));
});
test('relic choices and in-flight provenance survive packing; malformed state is rejected',()=>{
  const g=arena();openRelicCache(g,cacheWith(g,['wind','shell']));const packed=packRun(g),restored=unpackRun(packed);assert.ok(restored);assert.deepEqual(restored.relicOffer.options,['wind','shell']);
  for(const change of [s=>s.relicOffer.source='nest',s=>s.relicOffer.options=['thread','shell'],s=>delete s.relics.shell.readyAt,s=>s.relics.items=['wind','wind'],s=>s.relics.thread.target=s.id+1]){const s=JSON.parse(packed);change(s);assert.equal(unpackRun(JSON.stringify(s)),null);}
  equipRelic(g,'wind');advance(g,1.3,{x:1});spawnEnemy(g,'elite',g.player.x+80,0,{hp:1000,maxHp:1000,speed:0,clock:100});g.weapons.acorn.clock=0;advance(g,.1);assert.ok(unpackRun(packRun(g)));const s=JSON.parse(packRun(g));s.projectiles[0].context={source:'relic',relic:'unknown'};assert.equal(unpackRun(JSON.stringify(s)),null);
});
test('local journal keeps twelve unique runs, discoveries and replay seeds without granting power',()=>{
  const j=normalizeJournal({discovered:['wind','wind','bad'],runs:[{id:'bad'}],returns:-1,bestLevel:NaN});assert.deepEqual(j.discovered,['wind']);assert.equal(j.runs.length,0);
  const g=arena();g.phase='result';g.outcome='scouted';g.relics.items=['wind'];g.relics.discovered=['wind','thread'];for(let i=0;i<15;i++){g.runId=`run-${i}`;assert.ok(recordRun(j,g));assert.equal(recordRun(j,g),false);}assert.equal(j.runs.length,12);assert.equal(j.returns,15);assert.equal(j.runs[0].seed,1437);assert.deepEqual(j.discovered,['wind','thread']);assert.deepEqual(normalizeJournal(JSON.parse(JSON.stringify(j))),j);discoverRelics(j,['tide','invalid']);assert.ok(j.discovered.includes('tide'));
});
test('relic cue stays subordinate to damage and bounded to one voice selection per event batch',()=>{
  assert.deepEqual(selectAudioEvents(new Set(['relic-proc','hurt','wood-impact'])),['hurt']);assert.deepEqual(selectAudioEvents(new Set(['relic-proc','wood-impact','acorn-shot'])),['relic-proc','wood-impact']);
});
test('an ordinary no-nest route can complete the trial, use two relics and return',()=>{
  const r=pilot({takeNest:false,takeTrial:true,takeRelics:true});assert.equal(r.outcome,'scouted');assert.equal(r.nestActivated,false);assert.equal(r.trial,'spent');assert.equal(r.relics.length,2);assert.equal(r.relicChoices.length,2);assert.ok(r.milestones.trialClearedAt-r.milestones.trialAt>=20);assert.ok(r.relicStats.wind.procs>0);assert.ok(r.relicStats.wind.damage>0);assert.ok(r.level>=12);
});
