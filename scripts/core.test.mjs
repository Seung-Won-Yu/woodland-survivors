import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawnEnemy,stepGame,applyChoice,deriveStats,openChest,selectChest,closeChest,pauseGame,resumeGame,packRun,unpackRun,useSignature} from '../src/core/game.js';
import {normalizeProfile,PROFILE_KEY,RUN_KEY} from '../src/core/profile.js';
import {HEROES,WEAPONS,BASE_WEAPON_IDS,UNIONS} from '../src/core/content.js';
import {createExpedition,interact,takeSupply,nearestSite,updateExpedition,SAVE_KEY} from '../src/game/expedition.js';
import {weaponPose,walkPose,STRIDE} from '../src/game/motion.js';
import {moveActor} from '../src/game/terrain.js';
import {pilot} from './pilot.mjs';
function arena(hero='pip',weapon='acorn'){
 const g=createExpedition(hero,weapon,13);g.enemies=[];g.spawn=1e6;g.nextSurge=1e6;g.nextElite=1e6;g.terrain=null;return g;
}
function advance(g,seconds,input={}){for(let i=0;i<seconds*60&&g.phase==='playing';i++)stepGame(g,1/60,input);}
test('independent keys and six playable heroes preserve composable traits',()=>{
 assert.ok(PROFILE_KEY.startsWith('woodland-independent-'));assert.ok(RUN_KEY.startsWith('woodland-independent-'));assert.equal(SAVE_KEY,'woodland-independent-settings-v1');
 for(const id of Object.keys(HEROES)){const g=createExpedition(id,'moon');assert.equal(g.hero,id);assert.equal(Object.keys(g.weapons)[0],'moon');assert.equal(g.pool.length,8);}
 assert.equal(arena('pip').stats.amount,1);assert.equal(arena('bram').stats.armor,2);assert.equal(arena('fox').stats.eliteDamage,1.2);assert.equal(arena('otter').stats.duration,1.25);
 const rabbit=arena('lune');advance(rabbit,3.1,{x:1});assert.ok(Math.abs(rabbit.stats.cooldown-.85)<1e-8);
 const mole=arena('mole');advance(mole,.7);assert.equal(mole.stats.area,1.25);
});
test('all eight shared weapons deal actual damage using ordinary casts',()=>{
 for(const id of BASE_WEAPON_IDS){const g=arena('pip',id);spawnEnemy(g,'elite',id==='briar'?60:100,0,{hp:1e5,maxHp:1e5,speed:0,damage:0,clock:1e6});g.player.invincible=100;advance(g,4);assert.ok(g.damage>0,`${id} must hit`);}
});
test('walking progresses by resolved distance, stops against terrain, and diagonal speed is bounded',()=>{
 const a=arena(),b=arena();advance(a,1,{x:1});advance(b,1,{x:1,y:1});assert.ok(Math.abs(a.player.walk-192)<.01);assert.ok(Math.abs(b.player.walk-192)<.01);
 const stopped=a.player.walk;advance(a,1);assert.equal(a.player.walk,stopped);
 const wall=arena();wall.terrain=[{x:40,y:0,r:25}];advance(wall,1,{x:1});assert.ok(wall.player.x<=40-(12+25*.78)+.001);assert.ok(wall.player.walk<10);
 for(let i=0;i<8;i++){const pose=walkPose(i*STRIDE/8);assert.equal(pose.frame,i);assert.ok(pose.left.contact||pose.right.contact);assert.ok(pose.left.lift===0||pose.right.lift===0);}
 for(let i=0;i<4;i++){const distance=i*STRIDE/8,pose=walkPose(distance);assert.equal(distance+pose.left.x,12,'planted foot stays fixed in world space');}
});
test('a dash cannot tunnel through a rock and pauses freeze gait and combat',()=>{
 const g=arena();g.terrain=[{x:80,y:0,r:35}];stepGame(g,.04,{x:1,dash:true});advance(g,.4,{x:1});assert.ok(g.player.x<80);
 pauseGame(g);const before=packRun(g);advance(g,2,{x:1,skill:true});assert.equal(packRun(g),before);resumeGame(g);assert.equal(g.phase,'playing');
});
test('the first real projectile starts at the same recoil-adjusted muzzle as rendering',()=>{
 const g=arena();spawnEnemy(g,'shroom',180,0,{hp:1000,maxHp:1000,speed:0});g.weapons.acorn.clock=0;stepGame(g,1/60);
 const q=g.projectiles[0],m=weaponPose(g.player);
 assert.ok(Math.abs(q.x-q.vx/60-m.x)<.001);assert.ok(Math.abs(q.y-q.vy/60-m.y)<.001);
});
test('signature fan shots share one visible muzzle and an actual attack state',()=>{
 const g=arena();g.player.charge=100;assert.equal(useSignature(g),true);assert.ok(g.player.attack>0);assert.equal(g.player.attackWeapon,'acorn');const muzzle=weaponPose(g.player);
 assert.equal(g.projectiles.length,15);for(const q of g.projectiles){assert.equal(q.x,muzzle.x);assert.equal(q.y,muzzle.y);}
});
test('runner prepares, charges in a locked direction, then recovers; spore warns before firing',()=>{
 const g=arena();g.weapons={};const e=spawnEnemy(g,'runner',200,0,{clock:0});stepGame(g,1/60);assert.equal(e.mode,'windup');const x=e.x;
 advance(g,.3);assert.equal(e.x,x);advance(g,.3);assert.equal(e.mode,'charge');const dx=e.dx;g.player.y=160;advance(g,.15);assert.equal(e.dx,dx);advance(g,.25);assert.equal(e.mode,'recover');
 const s=arena();s.weapons={};const spore=spawnEnemy(s,'spore',280,0,{clock:0});stepGame(s,1/60);assert.equal(spore.mode,'windup');assert.equal(s.projectiles.length,0);advance(s,.5);assert.equal(s.projectiles.length,0);advance(s,.3);assert.equal(spore.mode,'recover');assert.equal(s.projectiles.filter(p=>p.hostile).length,1);
 pauseGame(g);assert.ok(unpackRun(packRun(g))===null,'incomplete weapon fixture is intentionally not a valid save');
});
test('supply is an actual proximity interaction, a one-time reward, and conditional gear changes stats',()=>{
 const g=createExpedition();assert.equal(interact(g),false);g.player.x=-520;g.player.y=-130;assert.equal(nearestSite(g).id,'supply');assert.equal(interact(g),true);assert.equal(g.phase,'supply');assert.equal(takeSupply(g,'boots'),true);assert.equal(g.weapons.acorn.rank,3);assert.equal(g.passives.twin,1);assert.equal(takeSupply(g,'boots'),false);
 g.player.moving=true;g.stats=deriveStats(g);assert.ok(g.stats.speed>192);assert.ok(g.stats.cooldown<1);
 const b=arena();b.gear='bark';b.player.still=1;assert.equal(deriveStats(b).armor,3);b.player.still=0;assert.equal(deriveStats(b).armor,0);
});
test('spring can be saved at full HP; nest creates a killable guardian with evolution eligibility',()=>{
 const g=createExpedition();g.player.x=100;g.player.y=510;assert.equal(interact(g),false);assert.equal(g.expedition.sites.find(s=>s.id==='spring').state,'ready');g.player.hp=30;assert.equal(interact(g),true);assert.equal(g.player.hp,70);assert.equal(interact(g),false);
 g.player.x=520;g.player.y=-360;assert.equal(interact(g),true);const e=g.enemies.find(e=>e.nestGuardian);assert.ok(e);assert.equal(e.canEvolve,true);assert.equal(g.expedition.sites.find(s=>s.id==='nest').state,'active');
});
test('late supply requires a chosen replacement when all six passive slots are occupied',()=>{
 const g=arena();g.player.x=-520;g.player.y=-130;g.passives={berry:1,feather:1,leaf:1,dew:1,stone:1,bark:1};interact(g);
 assert.equal(takeSupply(g,'bark'),false);assert.equal(g.phase,'supply');assert.equal(Object.keys(g.passives).length,6);assert.equal(g.gear,null);
 assert.equal(takeSupply(g,'bark','berry'),true);assert.equal(g.passives.berry,undefined);assert.equal(g.passives.twin,1);assert.equal(Object.keys(g.passives).length,6);
});
test('pending levels create new choices on each application and consume exactly one level',()=>{
 const g=arena();g.pendingLevels=3;g.phase='choice';g.choices=[{id:'acorn',kind:'weapon',owned:true}];const before=g.weapons.acorn.rank;
 assert.ok(applyChoice(g,0));assert.equal(g.pendingLevels,2);assert.equal(g.phase,'choice');assert.equal(g.weapons.acorn.rank,before+1);assert.equal(g.choices.length,3);
 assert.ok(applyChoice(g,0));assert.equal(g.pendingLevels,1);assert.equal(g.phase,'choice');assert.ok(applyChoice(g,0));assert.equal(g.phase,'playing');
});
test('all eight evolution recipes and both unions preserve real weapon ownership',()=>{
 for(const id of BASE_WEAPON_IDS){const g=arena('pip',id);g.weapons[id].rank=8;g.passives[WEAPONS[id].recipe]=1;openChest(g,{canEvolve:true});assert.ok(g.chest.options.some(o=>o.id===`evolve:${id}`));assert.equal(selectChest(g,`evolve:${id}`),true);assert.equal(g.weapons[id].evolved,true);assert.equal(closeChest(g),true);}
 for(const recipe of Object.values(UNIONS)){const g=arena();g.weapons={};for(const input of recipe.inputs)g.weapons[input.id]={rank:input.rank,evolved:input.evolved,clock:0};openChest(g,{canEvolve:true});assert.equal(selectChest(g,`union:${recipe.id}`),true);for(const input of recipe.inputs)assert.ok(!g.weapons[input.id]);assert.ok(g.weapons[recipe.id]);assert.equal(closeChest(g),true);}
});
test('return requires three minutes and explicit proximity interaction',()=>{
 const g=createExpedition();g.player.y=70;assert.equal(interact(g),false);g.time=180;updateExpedition(g);assert.equal(g.phase,'playing');assert.equal(interact(g),true);assert.equal(g.outcome,'scouted');assert.equal(g.expedition.complete,true);
});
test('ordinary first-three-minute route earns supply, levels and kills without stat/time grants',()=>{
 const report=pilot({hero:'pip',seed:1437,seconds:215});assert.equal(report.supply,true);assert.ok(report.level>=5,JSON.stringify(report));assert.ok(report.kills>=50,JSON.stringify(report));assert.ok(report.elapsed>=180,JSON.stringify(report));assert.ok(report.nestActivated,JSON.stringify(report));assert.equal(report.outcome,'scouted',JSON.stringify(report));
});
