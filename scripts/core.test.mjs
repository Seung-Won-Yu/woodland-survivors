import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawnEnemy,stepGame,applyChoice,deriveStats,openChest,selectChest,closeChest,draftChoices,pauseGame,resumeGame,packRun,unpackRun,useSignature} from '../src/core/game.js';
import {normalizeProfile,PROFILE_KEY,RUN_KEY} from '../src/core/profile.js';
import {HEROES,WEAPONS,BASE_WEAPON_IDS,UNIONS} from '../src/core/content.js';
import {createExpedition,interact,takeSupply,nearestSite,updateExpedition,expeditionObjective,expeditionMarkers,SAVE_KEY} from '../src/game/expedition.js';
import {weaponPose,walkPose,STRIDE,animationState} from '../src/game/motion.js';
import {moveActor,LANDMARKS} from '../src/game/terrain.js';
import {pilot} from './pilot.mjs';
import {isolateActorPixels} from '../src/art/frame-mask.js';
import {createAudio,selectAudioEvents} from '../src/game/audio.js';
function arena(hero='pip',weapon='acorn'){
 const g=createExpedition(hero,weapon,13);g.enemies=[];g.spawn=1e6;g.nextSurge=1e6;g.nextElite=1e6;g.terrain=null;updateExpedition(g);return g;
}
function advance(g,seconds,input={}){for(let i=0;i<seconds*60&&g.phase==='playing';i++)stepGame(g,1/60,input);}
test('atlas normalization removes neighbouring-frame fragments and preserves the actor edge',()=>{
 const width=12,height=12,pixels=new Uint8ClampedArray(width*height*4),set=(x,y,a)=>pixels[(y*width+x)*4+3]=a;
 for(let y=4;y<=9;y++)for(let x=4;x<=8;x++)set(x,y,250);set(3,6,60);set(0,0,250);set(1,0,250);set(11,11,250);
 const result=isolateActorPixels(pixels,width,height);assert.equal(result[(6*width+3)*4+3],60);assert.equal(result[(6*width+5)*4+3],250);assert.equal(result[3],0);assert.equal(result[(11*width+11)*4+3],0);assert.equal(pixels[3],250,'source pixels remain untouched');
});
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
 for(let i=0;i<4;i++){const distance=i*STRIDE/8,pose=walkPose(distance);assert.equal(distance+pose.left.x,STRIDE/4,'planted foot stays fixed in world space');}
});
test('a dash cannot tunnel through a rock and pauses freeze gait and combat',()=>{
 const g=arena();g.terrain=[{x:80,y:0,r:35}];stepGame(g,.04,{x:1,dash:true});advance(g,.4,{x:1});assert.ok(g.player.x<80);
 pauseGame(g);const before=packRun(g);advance(g,2,{x:1,skill:true});assert.equal(packRun(g),before);resumeGame(g);assert.equal(g.phase,'playing');
});
test('the first real projectile starts at the same recoil-adjusted muzzle as rendering',()=>{
 const g=arena();spawnEnemy(g,'shroom',180,0,{hp:1000,maxHp:1000,speed:0});g.weapons.acorn.clock=0;stepGame(g,1/60);
 const q=g.projectiles[0],m=weaponPose(g.player);
 assert.ok(Math.abs(q.x-q.vx/60-m.x)<.001);assert.ok(Math.abs(q.y-q.vy/60-m.y)<.001);
 assert.equal(m.drawY,m.y-24,'render height is independent of ground-plane collision coordinates');
});
test('signature fan shots share one visible muzzle and an actual attack state',()=>{
 const g=arena();g.player.charge=100;assert.equal(useSignature(g),true);assert.ok(g.player.attack>0);assert.equal(g.player.attackWeapon,'acorn');const muzzle=weaponPose(g.player);
 assert.equal(g.projectiles.length,15);for(const q of g.projectiles){assert.equal(q.x,muzzle.x);assert.equal(q.y,muzzle.y);}
});
test('runner prepares, charges in a locked direction, then recovers; spore warns before firing',()=>{
 const g=arena();g.weapons={};const e=spawnEnemy(g,'runner',200,0,{clock:0});stepGame(g,1/60);assert.equal(e.mode,'windup');const x=e.x;
 advance(g,.3);assert.equal(e.x,x);advance(g,.3);assert.equal(e.mode,'charge');const dx=e.dx;g.player.y=160;advance(g,.15);assert.equal(e.dx,dx);advance(g,.25);assert.equal(e.mode,'recover');
 const s=arena();s.weapons={};const spore=spawnEnemy(s,'spore',280,0,{clock:0,shotPattern:'fan'});stepGame(s,1/60);assert.equal(spore.mode,'windup');assert.equal(s.projectiles.length,0);advance(s,.5);assert.equal(s.projectiles.length,0);advance(s,.4);assert.equal(spore.mode,'recover');assert.equal(s.projectiles.filter(p=>p.hostile).length,3);
 pauseGame(g);assert.ok(unpackRun(packRun(g))===null,'incomplete weapon fixture is intentionally not a valid save');
});
test('supply is an actual proximity interaction, a one-time reward, and conditional gear changes stats',()=>{
 const g=createExpedition();assert.equal(interact(g),false);Object.assign(g.player,LANDMARKS.supply);assert.equal(nearestSite(g).id,'supply');assert.equal(interact(g),false,'guarded supplies cannot be collected by rushing through enemies');g.enemies=g.enemies.filter(e=>!e.supplyGuard);updateExpedition(g);assert.equal(interact(g),true);assert.equal(g.phase,'supply');assert.equal(takeSupply(g,'boots'),true);assert.equal(g.weapons.acorn.rank,2);assert.equal(g.passives.twin,1);assert.equal(takeSupply(g,'boots'),false);
 g.player.moving=true;g.stats=deriveStats(g);assert.ok(g.stats.speed>192);assert.ok(g.stats.cooldown<1);
 const b=arena();b.gear='bark';b.player.still=1;assert.equal(deriveStats(b).armor,3);b.player.still=0;assert.equal(deriveStats(b).armor,0);
});
test('supply guards patrol their clearing, do not recycle on mobile, and cannot be auto-targeted from camp',()=>{
 const g=createExpedition();g.enemies=g.enemies.filter(e=>e.supplyGuard);g.spawn=g.nextSurge=g.nextElite=1e6;g.terrain=null;g.view={width:390,height:844};
 advance(g,5);assert.equal(g.damage,0);assert.equal(g.projectiles.length,0);assert.ok(g.enemies.every(e=>Math.hypot(e.x-e.home.x,e.y-e.home.y)<110));
 Object.assign(g.player,{x:LANDMARKS.supply.x+190,y:LANDMARKS.supply.y});advance(g,2);assert.ok(g.damage>0,'approaching the clearing activates ordinary auto-attacks');
 g.weapons={};Object.assign(g.player,{x:1100,y:1100});advance(g,5);assert.ok(g.enemies.every(e=>Math.hypot(e.x-e.home.x,e.y-e.home.y)<235));
});
test('the first two drafts offer both starting-weapon growth and a new shared weapon',()=>{
 for(const hero of Object.keys(HEROES))for(const seed of [1437,9011]){
  const g=createExpedition(hero,undefined,seed);
  for(let i=0;i<2;i++){const choices=draftChoices(g);assert.equal(choices.length,3);assert.ok(choices.some(c=>c.id===g.startWeapon&&c.owned));assert.ok(choices.some(c=>c.kind==='weapon'&&!c.owned));assert.equal(new Set(choices.map(c=>c.id)).size,3);}
 }
});
test('nest warns before fixed-position spore bursts and calls its two reinforcements only once',()=>{
 const g=arena();Object.assign(g.player,LANDMARKS.nest);g.player.invincible=100;interact(g);const e=g.enemies.find(e=>e.nestGuardian);g.enemies=[e];g.weapons={};e.clock=0;e.guardianStyle='briar';
 stepGame(g,1/60);assert.equal(e.mode,'windup');assert.equal(g.fields.length,3);assert.ok(g.fields.every(f=>f.warning>0));const positions=g.fields.map(f=>[f.x,f.y]);
 advance(g,.5,{x:1});assert.deepEqual(g.fields.map(f=>[f.x,f.y]),positions);assert.equal(e.mode,'windup');advance(g,.6);assert.equal(e.mode,'recover');assert.ok(g.fields.every(f=>f.warning<0));
 e.hp=e.maxHp*.49;stepGame(g,1/60);assert.equal(g.enemies.filter(e=>e.type==='runner').length,2);advance(g,1);assert.equal(g.enemies.filter(e=>e.type==='runner').length,2);
});
test('a defeated nest leaves a physical marked chest and is complete only after its reward is collected',()=>{
 const g=arena('fox','storm');Object.assign(g.player,LANDMARKS.nest);interact(g);const e=g.enemies.find(e=>e.nestGuardian);g.enemies=[e];e.x=g.player.x+65;e.hp=1;e.xp=0;g.weapons.storm.clock=0;
 stepGame(g,1/60);updateExpedition(g);assert.equal(g.expedition.sites.find(s=>s.id==='nest').state,'cleared');assert.match(expeditionObjective(g).title,/상자/);const drop=g.pickups.find(p=>p.source==='nest');assert.ok(drop);assert.equal(g.phase,'playing');
 Object.assign(g.player,{x:drop.x,y:drop.y});stepGame(g,1/60);updateExpedition(g);assert.equal(g.phase,'chest');assert.equal(g.chest.source,'nest');assert.equal(g.weapons.storm.rank,3);assert.equal(g.expedition.sites.find(s=>s.id==='nest').state,'spent');assert.ok(g.expedition.milestones.nestRewardAt>0);
});
test('a lured guardian reward marks the actual chest instead of the empty nest',()=>{
 const g=arena(),nest=g.expedition.sites.find(s=>s.id==='nest');nest.state='cleared';g.pickups.push({id:++g.id,type:'chest',source:'nest',x:-450,y:600,canEvolve:true});
 const markers=expeditionMarkers(g);assert.equal(markers.filter(m=>m.id==='nest').length,0);assert.deepEqual(markers.filter(m=>m.source==='nest').map(m=>[m.x,m.y]),[[-450,600]]);
});
test('older independent v2 runs normalize expedition milestones before interactions',()=>{
 const g=createExpedition();delete g.expedition.milestones;const restored=unpackRun(packRun(g));assert.ok(restored);resumeGame(restored);Object.assign(restored.player,LANDMARKS.spring);restored.player.hp=30;assert.equal(interact(restored),true);assert.equal(restored.expedition.milestones.springAt,0);
});
test('objectives keep healing visible and announce the return route without ending combat early',()=>{
 const g=arena();assert.match(expeditionObjective(g).detail,/샘/);g.time=150;updateExpedition(g);assert.equal(g.phase,'playing');assert.match(expeditionObjective(g).title,/돌아갈/);assert.equal(g.expedition.beaconCalled,true);
});
test('simultaneous support weapons preserve the primary attack pose and emit separate origins',()=>{
 const g=arena();g.weapons.moon={rank:1,evolved:false,clock:0};g.weapons.acorn.clock=0;spawnEnemy(g,'shroom',180,0,{hp:1000,maxHp:1000,speed:0});stepGame(g,1/60);
 assert.equal(g.player.attackWeapon,'acorn');const attacks=g.events.filter(e=>e.type==='attack');assert.deepEqual(attacks.map(e=>e.weapon),['acorn','moon']);assert.equal(attacks[0].primary,true);assert.equal(attacks[1].primary,false);assert.ok(attacks.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));assert.equal(g.castOrigin,undefined);
});
test('moving attacks keep walking legs while the illustrated upper body faces the actual aim',()=>{
 const p={x:0,y:0,moving:true,fx:0,fy:-1,aim:0,walk:18,attack:.2,attackWindup:0,hurt:0};
 const pose=animationState(p);assert.equal(pose.dir,'east');assert.equal(pose.legDir,'north');assert.equal(pose.frame,9);assert.equal(pose.legFrame,walkPose(18).frame);
 p.attack=0;p.attackWindup=.05;assert.equal(animationState(p).frame,12);p.attackWindup=0;assert.equal(animationState(p).dir,'north');
});
test('brief world hit-stop never freezes movement input',()=>{
 const g=arena();g.weapons={};const e=spawnEnemy(g,'shroom',200,0,{clock:100});g.hitstop=.04;const x=e.x;stepGame(g,.02,{x:1});assert.ok(g.player.x>0);assert.equal(e.x,x);assert.equal(g.time,0);assert.equal(g.hitstop,.02);advance(g,.1,{x:1});assert.ok(e.x<x);
});
test('swept projectile impacts push along travel even when the projectile ends past the enemy',()=>{
 const g=arena();g.weapons={};const e=spawnEnemy(g,'shroom',50,0,{hp:1000,maxHp:1000,speed:0,clock:100});
 g.projectiles.push({kind:'acorn',x:0,y:0,vx:6000,vy:0,damage:4,life:1,age:0,r:6,pierce:1,hits:[]});stepGame(g,1/60);
 assert.ok(e.hp<e.maxHp);assert.ok(e.kx>0,'the enemy is pushed forward, not pulled toward the shooter');advance(g,.1);assert.ok(e.x>50);
});
test('ordinary impact pulses are bounded across a crowd while player movement stays responsive',()=>{
 const g=arena('mole','bloom');for(let i=0;i<10;i++)spawnEnemy(g,'shroom',50+i,0,{hp:10000,maxHp:10000,speed:0,clock:100});
 let pulses=0;for(let i=0;i<18;i++){g.weapons.bloom.clock=0;stepGame(g,1/60,{x:1});if(g.hitstop>0)pulses++;assert.ok(g.hitstop<=.0071);}
 assert.ok(pulses>=1&&pulses<=3,`one pulse per 120ms, got ${pulses}`);assert.ok(g.player.x>50,'hit-stop never consumes movement input');
});
test('a burst of ordinary kills produces one crowd confirmation and physical XP remains conserved',()=>{
 const g=arena('mole','bloom');for(let i=0;i<5;i++)spawnEnemy(g,'shroom',65,i*3,{hp:1,maxHp:1,speed:0,clock:100});g.weapons.bloom.clock=0;stepGame(g,1/60);
 assert.equal(g.kills,5);assert.equal(g.events.filter(e=>e.type==='crowd-break').length,1);assert.equal(g.metrics.xpDropped,10);advance(g,.5);assert.equal(g.metrics.xpCollected,10);assert.equal(g.gems.size,0);assert.equal(g.flying.length,0);
 if(g.phase==='choice')applyChoice(g,0);
 const far=spawnEnemy(g,'shroom',210,0,{hp:1,maxHp:1,speed:0,clock:100});g.weapons={acorn:{rank:1,evolved:false,clock:0}};advance(g,.5);assert.ok(far.dead);assert.equal(g.metrics.xpDropped,12);assert.equal(g.metrics.xpCollected,10,'distant XP is not granted automatically');
 const remaining=[...g.gems.values(),...g.flying].reduce((sum,gem)=>sum+gem.value,0);assert.equal(g.metrics.xpDropped,g.metrics.xpCollected+remaining);
});
test('weapon casts retain their own sound alongside contact and hurt keeps foreground priority',()=>{
 for(const cast of ['acorn-shot','whoosh','throw','buzz','swing','rune-hit','pulse'])assert.deepEqual(selectAudioEvents(new Set([cast,'wood-impact'])),[cast,'wood-impact']);
 assert.deepEqual(selectAudioEvents(new Set(['acorn-shot','wood-impact','kill'])),['acorn-shot','wood-kill']);
 assert.deepEqual(selectAudioEvents(new Set(['whoosh','wood-impact','kill','crowd-break'])),['crowd-break']);
 assert.deepEqual(selectAudioEvents(new Set(['hurt','crowd-break','wood-impact','rune-hit'])),['hurt']);
});
test('hurt audio stays in the foreground across following crowd and elite events',()=>{
 let context,voices=0;const previous=globalThis.window,param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({connect(){return this;},disconnect(){},start(){voices++;},stop(){}});
 class AudioContext{constructor(){context=this;this.currentTime=0;this.state='running';this.sampleRate=8000;this.destination={};}createOscillator(){return {...node(),frequency:param()};}createGain(){return {...node(),gain:param()};}createBufferSource(){return node();}createBiquadFilter(){return {...node(),frequency:{value:0},Q:{value:0}};}createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}}
 try{globalThis.window={AudioContext};const audio=createAudio();audio.unlock();audio.play('hurt');const hurtVoices=voices;assert.ok(hurtVoices>0);context.currentTime=.06;audio.play('crowd-break');audio.play('elite-break');assert.equal(voices,hurtVoices);context.currentTime=.2;audio.play('crowd-break');assert.ok(voices>hurtVoices);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('the final charge movement tick stays classified as charge damage for runners and the king',()=>{
 for(const [type,x] of [['runner',28],['king',64]]){const g=arena();g.weapons={};g.player.invincible=0;spawnEnemy(g,type,x,0,{mode:'charge',charge:.005,dx:-1,dy:0,clock:100});stepGame(g,1/60);assert.ok(g.metrics.damageBySource.charge>0);assert.equal(g.metrics.damageBySource.contact,0);}
});
test('narrow views preserve approach distance instead of placing new enemies beside the player',()=>{
 const g=arena();g.weapons={};g.view={width:487.5,height:1055};g.spawn=0;stepGame(g,1/60);assert.equal(g.enemies.length,1);const e=g.enemies[0];assert.ok(Math.abs(e.x)>550||Math.abs(e.y)>590,JSON.stringify(e));
 const s=arena();s.weapons={};const e2=spawnEnemy(s,'spore',560,0,{clock:0});stepGame(s,1/60);assert.equal(e2.mode,'walk','a spore shooter approaches until its bullet can actually reach');
});
test('the return interval leaves a smaller final surge regardless of nest choice',()=>{
 const count=(time,spent=false)=>{const g=arena();g.weapons={};g.time=time;g.nextSurge=time;if(spent)g.expedition.sites.find(s=>s.id==='nest').state='spent';stepGame(g,1/60);return g.enemies.length;};
 assert.ok(count(170)<count(125));assert.equal(count(170),count(170,true));
});
test('the scouting wave limits simultaneous spore shooters and their bullets expire in four seconds',()=>{
 const g=arena();g.weapons={};g.time=125;g.player.invincible=100;
 for(let i=0;i<4;i++)spawnEnemy(g,'spore',280+i*10,0,{clock:100,speed:0});g.seed=1972;g.spawn=0;stepGame(g,1/60);assert.equal(g.enemies.filter(e=>e.type==='spore').length,4);assert.ok(g.enemies.some(e=>e.type==='shroom'));
 g.spawn=1e6;g.enemies[0].clock=0;g.enemies[0].shotPattern='fan';advance(g,1);const bullet=g.projectiles.find(p=>p.hostile);assert.ok(bullet);assert.ok(bullet.life<=4&&bullet.life>3);
});
test('nest chest gives a readable two-rank starting-weapon reward before evolution readiness',()=>{
 const g=arena();openChest(g,{canEvolve:true,forgeWeapon:'acorn'});assert.equal(g.weapons.acorn.rank,3);assert.equal(g.chest.rewards[0].amount,2);assert.equal(closeChest(g),true);
});
test('an unrelated ready evolution never removes the guardian starting-weapon reward',()=>{
 const g=arena();g.weapons.moon={rank:8,evolved:false,clock:0};g.passives.feather=1;openChest(g,{canEvolve:true,forgeWeapon:'acorn'});
 assert.equal(g.weapons.acorn.rank,3);assert.ok(g.chest.rewards.some(r=>r.id==='acorn'&&r.amount===2));assert.ok(g.chest.options.some(o=>o.id==='evolve:moon'));assert.equal(selectChest(g,'evolve:moon'),true);assert.equal(g.weapons.acorn.rank,3);
});
test('vine visual aim and damage cone stay aligned while strafing',()=>{
 const g=arena('pip','vine');g.player.fx=0;g.player.fy=-1;const east=spawnEnemy(g,'shroom',90,0,{hp:1000,maxHp:1000,speed:0}),north=spawnEnemy(g,'shroom',0,-115,{hp:1000,maxHp:1000,speed:0});g.weapons.vine.clock=0;stepGame(g,1/60,{y:-1});
 assert.ok(east.hp<east.maxHp);assert.equal(north.hp,north.maxHp);const swing=g.effects.find(e=>e.type==='slash');assert.ok(Math.abs(swing.angle-g.player.aim)<.001);
});
test('spring can be saved at full HP; nest creates a killable guardian with evolution eligibility',()=>{
 const g=createExpedition();Object.assign(g.player,LANDMARKS.spring);assert.equal(interact(g),false);assert.equal(g.expedition.sites.find(s=>s.id==='spring').state,'ready');g.player.hp=30;assert.equal(interact(g),true);assert.equal(g.player.hp,70);assert.equal(interact(g),false);
 Object.assign(g.player,LANDMARKS.nest);assert.equal(interact(g),true);const e=g.enemies.find(e=>e.nestGuardian);assert.ok(e);assert.equal(e.canEvolve,true);assert.equal(g.expedition.sites.find(s=>s.id==='nest').state,'active');
});
test('late supply requires a chosen replacement when all six passive slots are occupied',()=>{
 const g=arena();Object.assign(g.player,LANDMARKS.supply);g.passives={berry:1,feather:1,leaf:1,dew:1,stone:1,bark:1};interact(g);
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
test('the previously failing builds can grow and return without activating the nest',()=>{
 for(const [hero,view] of [['pip',null],['fox',null],['mole',{width:487.5,height:1055}]]){const r=pilot({hero,seed:1437,takeNest:false,view});assert.equal(r.nestActivated,false);assert.equal(r.nest,'ready');assert.equal(r.milestones.nestRewardAt,undefined);assert.ok(r.level>=12,JSON.stringify(r));assert.equal(r.outcome,'scouted',JSON.stringify(r));assert.ok(r.elapsed>=180);assert.ok(r.xpCollected>500);}
});
