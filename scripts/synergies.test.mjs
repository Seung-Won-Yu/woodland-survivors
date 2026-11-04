import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpedition,updateExpedition} from '../src/game/expedition.js';
import {stepGame,spawnEnemy,healPlayer,packRun,unpackRun,draftChoices} from '../src/core/game.js';
import {RELIC_IDS} from '../src/core/relics.js';
import {SYNERGIES,SYNERGY_IDS,activeSynergies} from '../src/core/synergies.js';
import {GUARDIANS,fieldContains} from '../src/core/patterns.js';
import {BASE_WEAPON_IDS} from '../src/core/content.js';
import {normalizeJournal,recordRun} from '../src/game/journal.js';

// Isolated rule fixtures. Full unmodified-input runs live in scripts/pilot.mjs.
function arena(relic=null,weapon='acorn'){
  const g=createExpedition('pip',weapon,1437);g.enemies=[];g.terrain=null;g.spawn=g.nextSurge=g.nextElite=1e6;g.relics.items=relic?[relic]:[];updateExpedition(g);return g;
}
function advance(g,seconds,input={}){for(let i=0;i<seconds*60&&g.phase==='playing';i++)stepGame(g,1/60,input);}
const target=(g,x=110,y=0)=>spawnEnemy(g,'elite',x,y,{hp:10000,maxHp:10000,speed:0,clock:100});

test('six optional synergies cover every base weapon and survive unions without consuming a slot',()=>{
  assert.deepEqual([...new Set(Object.values(SYNERGIES).map(s=>s.relic))].sort(),[...RELIC_IDS].sort());assert.ok(BASE_WEAPON_IDS.every(w=>Object.values(SYNERGIES).some(s=>s.weapons.includes(w))));
  for(const id of SYNERGY_IDS){const s=SYNERGIES[id],g=arena(s.relic,s.weapons[0]);assert.deepEqual(activeSynergies(g),[id]);g.relics.items=[];assert.equal(activeSynergies(g).length,0);}
  const g=arena();g.relics.items=['shell','thread'];g.weapons={hive:{rank:1,evolved:true,clock:1}};assert.deepEqual(activeSynergies(g),['swarm','bastion']);assert.equal(g.relics.items.length,2);
});
test('gale returns to the player, resets its hit list once and deals real return damage',()=>{
  const g=arena('wind');target(g);g.relics.wind.distance=240;g.weapons.acorn.clock=0;let turned=false;
  for(let i=0;i<60;i++){stepGame(g,1/60);const q=g.projectiles.find(q=>q.returnSynergy==='gale');if(q?.turned){turned=true;assert.ok(q.vx<0);}}
  assert.ok(turned);assert.equal(g.synergies.stats.gale.procs,1);assert.ok(g.synergies.stats.gale.damage>0);assert.equal(g.relics.stats.wind.procs,1);assert.ok(g.relics.stats.wind.damage>g.synergies.stats.gale.damage);
  const plain=arena('wind','lantern');target(plain);plain.relics.wind.distance=240;plain.weapons.lantern.clock=0;advance(plain,.8);assert.equal(plain.synergies.stats.gale.procs,0);assert.ok(plain.relics.stats.wind.procs>0);
});
test('thread payoff with bees launches exactly two additional relic bees after actual movement',()=>{
  const g=arena('thread','bees'),e=target(g);g.weapons.bees.clock=0;advance(g,.5);assert.equal(g.relics.thread.target,e.id);g.weapons.bees.clock=10;advance(g,.65,{y:1});assert.equal(g.synergies.stats.swarm.procs,1);
  assert.equal(g.projectiles.filter(q=>q.context?.synergy==='swarm').length,2);advance(g,.8);assert.ok(g.synergies.stats.swarm.damage>0);assert.equal(g.relics.stats.thread.procs,1);
});
test('bastion retaliates only when the shield is fully consumed, with actual area damage',()=>{
  const g=arena('shell','briar');advance(g,.8);const e=spawnEnemy(g,'shroom',20,0,{hp:1000,maxHp:1000,speed:0,damage:5});g.player.invincible=0;stepGame(g,1/60);assert.equal(g.synergies.stats.bastion.procs,0);assert.equal(g.relics.shell.shield,7);
  e.damage=20;g.player.invincible=0;stepGame(g,1/60);assert.equal(g.relics.shell.shield,0);assert.equal(g.synergies.stats.bastion.procs,1);assert.ok(g.synergies.stats.bastion.damage>0);assert.ok(e.kx!==0||e.ky!==0);g.player.invincible=0;stepGame(g,1/60);assert.equal(g.synergies.stats.bastion.procs,1);
});
test('vine and thorn leave a bounded slowing patch without generating new hit chains',()=>{
  const g=arena('thorn','vine'),e=target(g,70);g.weapons.vine.clock=0;advance(g,1.4);const f=g.fields.find(f=>f.context?.synergy==='bramble');assert.ok(f);assert.equal(f.damage,0);assert.ok(f.life<=1.5);assert.ok(e.slow>0);assert.equal(g.synergies.stats.bramble.procs,1);assert.equal(g.synergies.stats.bramble.damage,0);
  g.weapons.vine.clock=10;const procs=g.relics.stats.thorn.procs;advance(g,2);assert.equal(g.fields.some(f=>f.context?.synergy==='bramble'),false);assert.equal(g.relics.stats.thorn.procs,procs);
});
test('garden grows a real damage field at a dropped healing seed and never feeds the kill loop',()=>{
  const g=arena('seed','bloom');for(let i=0;i<12;i++)spawnEnemy(g,'shroom',45+i,0,{hp:1,maxHp:1,speed:0,xp:0});g.weapons.bloom.clock=0;advance(g,.1);const seed=g.pickups.find(p=>p.relicId==='seed'),f=g.fields.find(f=>f.context?.synergy==='garden');assert.ok(seed);assert.ok(f);assert.equal(g.synergies.stats.garden.procs,1);assert.equal(g.relics.seed.kills,0);
  g.weapons.bloom.clock=10;const e=target(g,seed.x+20,seed.y);advance(g,.5);assert.ok(e.hp<e.maxHp);assert.ok(g.synergies.stats.garden.damage>0);assert.equal(g.relics.seed.kills,0);advance(g,3);assert.equal(g.fields.some(f=>f.context?.synergy==='garden'),false);
});
test('conductor chains to three actual enemies, but neither overheal nor seed healing fires it',()=>{
  const g=arena('tide','storm');g.weapons.storm.clock=10;const enemies=[target(g,150),target(g,260),target(g,400)];assert.equal(healPlayer(g,15),0);assert.equal(g.synergies.stats.conductor.procs,0);g.player.hp-=30;healPlayer(g,15,'relic','seed');assert.equal(g.synergies.stats.conductor.procs,0);healPlayer(g,15);assert.equal(g.synergies.stats.conductor.procs,1);assert.ok(enemies.every(e=>e.hp<e.maxHp));assert.equal(g.effects.filter(f=>f.type==='bolt').length,3);assert.ok(g.synergies.stats.conductor.damage>0);assert.equal(g.relics.stats.tide.procs,1);
});
test('warden warns with a locked frontal cone and leaves its rear safe',()=>{
  const g=arena();g.weapons={};g.player.invincible=0;const e=spawnEnemy(g,'warden',100,0,{clock:0,speed:0});stepGame(g,1/60);const f=g.fields[0];assert.equal(e.mode,'windup');assert.equal(f.shape,'cone');assert.ok(fieldContains(f,{x:0,y:0}));assert.equal(fieldContains(f,{x:200,y:0}),false);const angle=f.angle;g.player.x=200;advance(g,.6);assert.equal(g.player.hp,100);assert.equal(f.angle,angle);advance(g,.4);assert.equal(g.player.hp,100);assert.equal(e.mode,'recover');
  const front=arena();front.weapons={};front.player.invincible=0;spawnEnemy(front,'warden',100,0,{clock:0,speed:0});advance(front,1.05);assert.equal(front.player.hp,93);
});
test('frontal bracing reduces weapon shots while flank shots keep full damage',()=>{
  function shoot(x){const g=arena();g.weapons.acorn.clock=10;const e=spawnEnemy(g,'warden',100,0,{hp:10000,maxHp:10000,clock:0,speed:0});stepGame(g,1/60);g.player.x=x;g.weapons.acorn.clock=0;advance(g,.25);return g.damage;}
  const front=shoot(0),rear=shoot(200);assert.ok(front>0);assert.ok(rear>front);assert.ok(Math.abs(front/rear-.6)<.01);
});
test('fan spores wait before three fixed-angle shots; lob spores mark a fixed position',()=>{
  const g=arena();g.weapons={};const e=spawnEnemy(g,'spore',300,0,{clock:0,speed:0,shotPattern:'fan'});stepGame(g,1/60);const dx=e.dx,dy=e.dy;advance(g,.7,{y:1});assert.equal(g.projectiles.length,0);advance(g,.2);assert.equal(g.projectiles.filter(q=>q.hostile).length,3);assert.equal(e.dx,dx);assert.equal(e.dy,dy);
  const b=arena();b.weapons={};spawnEnemy(b,'spore',300,0,{clock:0,speed:0,shotPattern:'lob'});stepGame(b,1/60);const f=b.fields[0],point=[f.x,f.y];advance(b,.6,{y:1});assert.deepEqual([f.x,f.y],point);assert.ok(f.warning>0);advance(b,.3);assert.equal(b.projectiles.length,0);assert.equal(b.player.hp,100);
});
test('three guardian orders use every pattern, transition once, and retain the locked charge direction',()=>{
  for(const style of Object.keys(GUARDIANS)){
    const g=arena();g.weapons.acorn.clock=20;g.player.invincible=100;const e=spawnEnemy(g,'elite',200,0,{nestGuardian:true,guardianStyle:style,bossPhase:1,cycle:0,clock:0,speed:0,hp:10000,maxHp:10000});stepGame(g,1/60);assert.equal(e.attack,GUARDIANS[style].order[0]);assert.equal(e.mode,'windup');assert.equal(g.projectiles.length,0);e.hp=4900;advance(g,18);assert.equal(e.bossPhase,2);assert.equal(g.metrics.enemyPatterns['guardian:phase2'],1);assert.equal(g.enemies.filter(e=>e.type==='runner').length,2);for(const id of ['spores','charge','fan'])assert.ok(g.metrics.enemyPatterns[`guardian:${id}`]>0,`${style} ${id}`);
  }
  const g=arena();g.weapons.acorn.clock=10;g.player.invincible=100;const e=spawnEnemy(g,'elite',250,0,{nestGuardian:true,guardianStyle:'rush',clock:0,speed:0});stepGame(g,1/60);const aim=[e.dx,e.dy];advance(g,.6,{y:1});assert.deepEqual([e.dx,e.dy],aim);advance(g,.4);assert.equal(e.mode,'charge');assert.deepEqual([e.dx,e.dy],aim);
});
test('hit stop freezes owned warnings, and killing the owner cancels its unspent attack',()=>{
  const g=arena();g.weapons.acorn.clock=10;const e=spawnEnemy(g,'warden',100,0,{clock:0,speed:0,hp:1,maxHp:1,xp:0});stepGame(g,1/60);const warning=g.fields[0].warning;e.hitstop=.2;advance(g,.1);assert.equal(g.fields[0].warning,warning);e.hitstop=0;g.weapons.acorn.clock=0;advance(g,.3);assert.equal(g.enemies.includes(e),false);assert.equal(g.fields.some(f=>f.ownerId===e.id),false);
});
test('new fields, synergies and boss state roundtrip; invalid attack/context data is rejected',()=>{
  const g=arena('thorn','vine');g.weapons.vine.clock=10;spawnEnemy(g,'warden',100,0,{clock:0,speed:0});stepGame(g,1/60);const saved=packRun(g);assert.ok(unpackRun(saved));
  for(const change of [s=>s.enemies[0].attack='unknown',s=>s.enemies[0].guardianStyle='unknown',s=>s.fields[0].angle=20,s=>s.synergies.stats.gale.damage=-1]){const s=JSON.parse(saved);change(s);assert.equal(unpackRun(JSON.stringify(s)),null);}
  const legacy=JSON.parse(saved);delete legacy.synergies;assert.ok(unpackRun(JSON.stringify(legacy)));
  const boss=arena();boss.weapons.acorn.clock=10;spawnEnemy(boss,'elite',200,0,{nestGuardian:true,guardianStyle:'spore',clock:0,speed:0});advance(boss,1.1);assert.ok(boss.projectiles.length>0);assert.ok(unpackRun(packRun(boss)));
});
test('journal records tested builds without losing old records or accepting unknown synergies',()=>{
  const j=normalizeJournal({runs:[],discovered:['wind'],synergies:['gale','gale','unknown']});assert.deepEqual(j.synergies,['gale']);const g=arena();g.phase='result';g.synergies.discovered=['bastion'];assert.ok(recordRun(j,g));assert.deepEqual(j.runs[0].synergies,['bastion']);assert.deepEqual(normalizeJournal(JSON.parse(JSON.stringify(j))),j);assert.equal(recordRun(j,g),false);
});
test('every third growth offer can complete a missing relic link without bypassing weapon limits',()=>{
  const g=arena('thread');g.drafts=2;assert.ok(draftChoices(g).some(c=>c.id==='bees'&&!c.owned));g.banished=['bees'];g.drafts=2;assert.equal(draftChoices(g).some(c=>c.id==='bees'),false);
  g.banished=[];g.weapons={acorn:{rank:1,evolved:false,clock:0},moon:{rank:1,evolved:false,clock:0},briar:{rank:1,evolved:false,clock:0},storm:{rank:1,evolved:false,clock:0},lantern:{rank:1,evolved:false,clock:0},bloom:{rank:1,evolved:false,clock:0}};g.drafts=2;assert.equal(draftChoices(g).some(c=>c.kind==='weapon'&&!c.owned),false);
});
test('an owner killed earlier in the same projectile or field iterator cancels its pending damage',()=>{
  const g=arena();g.weapons.acorn.clock=10;g.player.invincible=0;const boss=spawnEnemy(g,'elite',80,0,{nestGuardian:true,hp:1,maxHp:1,xp:0,speed:0,clock:100});
  g.projectiles=[{kind:'acorn',x:70,y:0,vx:600,vy:0,damage:10,r:6,life:1,age:0,pierce:0,hits:[],context:{source:'weapon',weapon:'acorn'}},{kind:'enemy',x:8,y:0,vx:-60,vy:0,damage:15,r:7,life:1,age:0,pierce:0,hits:[],hostile:true,ownerId:boss.id}];stepGame(g,1/60);assert.equal(boss.dead,true);assert.equal(g.player.hp,100);
  const b=arena('seed','bloom');b.weapons.bloom.clock=10;b.player.invincible=0;const beetle=spawnEnemy(b,'warden',80,0,{hp:1,maxHp:1,xp:0,speed:0,clock:100});b.fields=[{x:80,y:0,r:30,damage:10,life:1,tick:0,context:{source:'relic',relic:'seed',synergy:'garden'}},{x:0,y:0,r:45,damage:7,life:1,tick:0,warning:0,hostile:true,ownerId:beetle.id}];stepGame(b,1/60);assert.equal(beetle.dead,true);assert.equal(b.player.hp,100);
});
test('phase two charge travels at most its promised center distance and cannot hit beyond the end cap',()=>{
  const g=arena();g.weapons.acorn.clock=10;g.player.x=270;g.player.invincible=0;const e=spawnEnemy(g,'elite',0,0,{nestGuardian:true,guardianStyle:'rush',bossPhase:2,reinforced:true,hp:4900,maxHp:10000,speed:0,clock:0});advance(g,2);assert.ok(Math.abs(e.x-216)<.001);assert.ok(Math.abs(e.y)<.001);assert.equal(g.player.hp,100);
});
test('new windup saves require complete finite aim data before resuming',()=>{
  const g=arena();g.weapons.acorn.clock=10;spawnEnemy(g,'elite',200,0,{nestGuardian:true,guardianStyle:'rush',clock:0,speed:0});stepGame(g,1/60);const packed=packRun(g);assert.ok(unpackRun(packed));for(const key of ['dx','dy','patternPower','patternAngle']){const s=JSON.parse(packed);delete s.enemies[0][key];assert.equal(unpackRun(JSON.stringify(s)),null,key);}
});
test('synergy damage reports supplemental effects rather than the original tide burst',()=>{
  const g=arena('tide','storm');g.weapons.storm.clock=10;target(g,150);target(g,260);target(g,400);g.player.hp=70;healPlayer(g,15);assert.ok(Math.abs(g.synergies.stats.conductor.damage-32.4)<.001);assert.ok(g.relics.stats.tide.damage>g.synergies.stats.conductor.damage);
});
test('the first guardian charge movement frame counts as charge damage',()=>{
  const g=arena();g.weapons.acorn.clock=10;g.player.x=40;g.player.invincible=0;spawnEnemy(g,'elite',0,0,{nestGuardian:true,guardianStyle:'rush',bossPhase:2,reinforced:true,mode:'windup',windup:.001,attack:'charge',dx:1,dy:0,patternPower:2,patternAngle:0,clock:100});stepGame(g,1/60);assert.equal(g.metrics.damageBySource.contact,0);assert.equal(g.metrics.damageBySource.charge,15);
});
test('normal telegraphs have a shared hazard budget even when a crowd attacks together',()=>{
  const g=arena();g.weapons.acorn.clock=20;g.player.invincible=100;for(let i=0;i<8;i++){spawnEnemy(g,'warden',120,i*3,{clock:0,speed:0});spawnEnemy(g,'spore',300,i*3,{clock:0,speed:0,shotPattern:'lob'});}for(let i=0;i<100;i++){stepGame(g,1/60);assert.ok(g.fields.filter(f=>['brace','lob'].includes(f.pattern)).length<=3);assert.ok(g.fields.filter(f=>f.pattern==='brace').length<=2);}
});
