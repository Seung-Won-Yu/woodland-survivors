import test from 'node:test';
import assert from 'node:assert/strict';
import {createSprint,stepSprint,chooseSprint,sprintAction,pauseSprint,resumeSprint,spawnEnemy,segmentDistance,takeEvents,RULES} from '../src/sprint/model.js';
const dt=1/60;
function advance(s,seconds,input={x:1,y:0}){for(let i=0;i<Math.ceil(seconds/dt);i++)stepSprint(s,dt,input);}
function branch(path){const s=createSprint(17);advance(s,7.1);assert.equal(s.choice,'path');assert.equal(chooseSprint(s,path),true);return s;}
// Fixtures below isolate collision contracts. Ordinary input-only runs live in
// sprint-pilot.mjs and must not be confused with these controlled arrangements.
function clear(s){s.player.x=0;s.player.y=0;s.enemies=[];s.shots=[];s.mines=[];s.gems=[];s.spawnClock=999;}
test('same seed and ordinary inputs reproduce opening and one atomic branch choice',()=>{
 const a=createSprint(71),b=createSprint(71);advance(a,7.1);advance(b,7.1);
 assert.equal(a.phase,'choice');assert.deepEqual(a.enemies,b.enemies);assert.equal(a.t,b.t);
 const t=a.t;advance(a,10);assert.equal(a.t,t);assert.equal(chooseSprint(a,'nope'),false);assert.equal(a.phase,'choice');
 assert.equal(chooseSprint(a,'pierce'),true);assert.equal(chooseSprint(a,'trail'),false);assert.equal(a.path,'pierce');
});
test('pause freezes combat, effects, cooldowns and the deadline',()=>{
 const s=branch('pierce');sprintAction(s,'dash');assert.equal(pauseSprint(s),true);const before=JSON.stringify(s);
 advance(s,5);assert.equal(JSON.stringify(s),before);assert.equal(sprintAction(s,'skill'),false);assert.equal(resumeSprint(s),true);stepSprint(s,dt);assert.ok(s.t>7);
});
test('piercing shots hit each enemy once and travel through a line of targets',()=>{
 const s=branch('pierce');clear(s);s.player.x=0;s.player.y=0;s.player.fx=1;s.player.fy=0;s.player.straight=1;s.shotClock=0;
 for(const x of [90,130,170,210]){const e=spawnEnemy(s,'shroom',0,x);e.hp=e.maxHp=1000;e.speed=0;}
 advance(s,.45);assert.ok(s.stats.multiShots>=1);assert.ok(s.enemies.every(e=>e.hp<1000));
 assert.ok(s.enemies.every(e=>e.hp>940),'one projectile must not damage the same enemy again on later frames');
 assert.equal(s.mines.length,0);
});
test('trail growth requires distance, cannot stack at rest, and uses a different active skill',()=>{
 const s=branch('trail');clear(s);s.mineDistance=0;advance(s,.8,{x:0,y:0});assert.equal(s.stats.trapsLaid,4);assert.equal(s.mines.length,0);
 advance(s,1.2);assert.ok(s.mines.length>=3);const before=s.mines.length;
 for(let i=0;i<before;i++)for(let j=i+1;j<before;j++)assert.ok(Math.hypot(s.mines[i].x-s.mines[j].x,s.mines[i].y-s.mines[j].y)>=44);
 assert.equal(sprintAction(s,'skill'),true);advance(s,.8,{x:0,y:0});assert.equal(s.mines.length,0);assert.ok(s.stats.trapsTriggered>=before);assert.equal(sprintAction(s,'skill'),false);
});
test('swept collision catches a boss charging across a seed between frames',()=>{
 assert.equal(segmentDistance(0,0,-100,0,100,0),0);assert.equal(segmentDistance(0,25,-100,0,100,0),25);
 const s=branch('trail');clear(s);s.player.x=100;s.player.y=160;s.shotClock=999;
 s.mines.push({id:100,x:0,y:0,age:1,life:5,spent:false,queue:null});
 const e=spawnEnemy(s,'king',0,1);e.x=-25;e.y=0;e.mode='charge';e.timer=.5;e.chargeAngle=0;
 stepSprint(s,.05,{x:0,y:0});assert.ok(s.stats.trapsTriggered>0);assert.ok(e.hp<e.maxHp);
});
test('evolution adds distinct projectiles or a bounded trail and heals once',()=>{
 for(const path of ['pierce','trail'])for(const evolution of ['crowd','focus']){
  const s=branch(path);clear(s);s.phase='choice';s.choice='evolution';s.t=50;s.player.hp=50;
  spawnEnemy(s,'shroom',0,250);assert.ok(chooseSprint(s,evolution));assert.equal(s.evolution,evolution);assert.equal(s.player.hp,90);
  assert.equal(chooseSprint(s,evolution),false);assert.equal(s.player.hp,90);
  if(path==='pierce')assert.equal(s.shots.length,evolution==='crowd'?3:2);else{advance(s,5);assert.ok(s.mines.length<=(evolution==='crowd'?15:10));}
 }
});
test('boss arrival is guaranteed at the horde cap and exposes a readable attack cycle',()=>{
 const s=branch('pierce');clear(s);s.t=90-dt;s.evolution='crowd';
 for(let i=0;i<RULES.maxEnemies;i++)spawnEnemy(s,'shroom',0,500);
 stepSprint(s,dt);assert.ok(s.boss);assert.equal(s.boss.maxHp,1440);assert.ok(takeEvents(s).includes('boss-arrival'));
 s.shotClock=999;s.player.x=-600;advance(s,2);assert.equal(s.boss.mode,'windup');advance(s,1.1);assert.equal(s.boss.mode,'charge');advance(s,.5);assert.equal(s.boss.mode,'recover');
});
test('boss recovery rewards attack and death ends the run immediately, without post-result mutations',()=>{
 const s=branch('pierce');clear(s);s.evolution='focus';s.bossSpawned=true;
 const e=spawnEnemy(s,'king',0,65);s.boss=e;e.mode='recover';e.timer=2;e.hp=1;
 s.shotClock=0;advance(s,.1,{x:0,y:0});assert.equal(s.phase,'result');assert.equal(s.result.won,true);
 const result=JSON.stringify(s);advance(s,2);assert.equal(JSON.stringify(s),result);assert.equal(sprintAction(s,'dash'),false);
});
test('120 second deadline is terminal and never opens another upgrade menu',()=>{
 const s=branch('trail');clear(s);s.evolution='crowd';s.bossSpawned=true;s.t=119.99;stepSprint(s,.03);
 assert.equal(s.phase,'result');assert.equal(s.result.reason,'time');assert.equal(s.t,120);assert.equal(s.result.won,false);
});
test('dash is invulnerable, cooldown gated, finite, and independent of path',()=>{
 for(const path of ['pierce','trail']){const s=branch(path);clear(s);const x=s.player.x;
  assert.ok(sprintAction(s,'dash'));assert.equal(sprintAction(s,'dash'),false);assert.ok(s.player.invuln>0);advance(s,.15);assert.ok(s.player.x-x>80);advance(s,2.2);assert.ok(sprintAction(s,'dash'));}
});
test('fresh runs reset growth, results, and path stats without carrying permanent power',()=>{
 const a=branch('trail');advance(a,3);const b=createSprint(a.seed);assert.equal(b.path,null);assert.equal(b.evolution,null);assert.equal(b.level,1);assert.equal(b.kills,0);assert.equal(b.stats.trapsLaid,0);assert.equal(b.player.hp,100);
});

test('boss finishing tick settles all simultaneous hits before taking the result snapshot',()=>{
 const s=branch('pierce');clear(s);s.evolution='focus';s.bossSpawned=true;s.shotClock=999;
 const before=s.kills;const boss=spawnEnemy(s,'king',0,90);s.boss=boss;boss.hp=1;boss.mode='recover';boss.timer=2;
 const mob=spawnEnemy(s,'shroom',0,90);mob.hp=1;mob.speed=0;
 s.shots.push({x:60,y:0,px:60,py:0,vx:1200,vy:0,angle:0,damage:100,pierce:10,hits:new Set(),life:1,wide:5});
 stepSprint(s,.05,{x:0,y:0});assert.equal(s.result.won,true);assert.equal(s.result.kills,s.kills);assert.deepEqual(s.result.stats,s.stats);assert.equal(s.kills,before+2);
});
