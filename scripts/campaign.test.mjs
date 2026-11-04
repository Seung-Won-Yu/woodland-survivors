import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignExpedition,interact,updateExpedition} from '../src/game/expedition.js';
import {stepGame,spawnEnemy,packRun,unpackRun,openChest,selectChest,closeChest,continueCampaign,pauseGame,resumeGame,healPlayer,unionCandidates,draftChoices} from '../src/core/game.js';
import {updateCampaign,finishCampaignBoss,bankCampaign} from '../src/core/campaign.js';
import {bossShotAngles,chargeProfile} from '../src/core/patterns.js';
import {SYNERGIES,synergyMastered} from '../src/core/synergies.js';
import {BASE_WEAPON_IDS,PASSIVES} from '../src/core/content.js';
import {normalizeJournal,recordRun} from '../src/game/journal.js';
import {unionBench} from './weapon-bench.mjs';
// Isolated rule fixtures; scripts/pilot.mjs separately runs ordinary full campaigns.
function arena(weapon='acorn',relic=null){const g=createCampaignExpedition('pip',weapon,1437);g.enemies=[];g.terrain=null;g.campaign.nextHordeAt=1000;g.spawn=g.nextSurge=g.nextElite=1e6;g.relics.items=relic?[relic]:[];return g;}
const advance=(g,seconds,input={})=>{for(let i=0;i<seconds*60&&g.phase==='playing';i++)stepGame(g,1/60,input);};
function schedule(g,time){g.time=time;updateCampaign(g,(...args)=>spawnEnemy(g,...args));return g.enemies.find(e=>e.bossRole);}
function defeatMid(g){const e=schedule(g,180);g.enemies=[];finishCampaignBoss(g,e);return e;}
const dummy=(g,x=110,y=0)=>spawnEnemy(g,'elite',x,y,{hp:1e6,maxHp:1e6,speed:0,clock:1e6});

test('campaign schedules one midpoint boss, one armory and a gated final boss',()=>{
 const g=arena();schedule(g,179.99);assert.equal(g.enemies.length,0);const mid=schedule(g,180);assert.equal(mid.bossRole,'midpoint');schedule(g,500);assert.equal(g.enemies.length,1);assert.equal(g.campaign.final.state,'waiting');
 g.enemies=[];finishCampaignBoss(g,mid);schedule(g,500);assert.equal(g.enemies.length,0);schedule(g,590);assert.equal(g.enemies.length,1);assert.equal(g.enemies[0].bossRole,'final');assert.equal(g.pickups.filter(p=>p.source==='armory').length,1);schedule(g,591);assert.equal(g.enemies.length,1);assert.equal(g.pickups.filter(p=>p.source==='armory').length,1);
});
test('three minutes and the camp cannot end a campaign; only the final boss clears it',()=>{
 const g=arena();g.time=181;g.player.x=0;g.player.y=70;interact(g);updateExpedition(g);assert.equal(g.outcome,null);assert.equal(g.phase,'playing');assert.equal(g.expedition.milestones.scoutedAt,undefined);
 defeatMid(g);assert.equal(g.outcome,null);g.pickups=[];const final=schedule(g,420);g.enemies=[];finishCampaignBoss(g,final);assert.equal(g.outcome,null);assert.equal(g.phase,'crossroads');assert.equal(g.campaign.cleared,1);bankCampaign(g);assert.equal(g.outcome,'victory');assert.equal(g.phase,'result');assert.equal(g.expedition.complete,true);
 const cap=arena();cap.time=1799.99;stepGame(cap,1/60);assert.equal(cap.outcome,null);assert.ok(cap.time>1800);
});
test('menus and pause freeze the campaign scheduler; save restoration does not duplicate a boss',()=>{
 const g=arena();g.time=179.99;pauseGame(g);stepGame(g,1/60);assert.equal(g.time,179.99);assert.equal(g.campaign.mid.state,'waiting');resumeGame(g);stepGame(g,1/60);assert.equal(g.campaign.mid.state,'active');const restored=unpackRun(packRun(g));assert.ok(restored);resumeGame(restored);stepGame(restored,1/60);assert.equal(restored.enemies.filter(e=>e.bossRole).length,1);
});
test('campaign saves reject mismatched, duplicated and impossible boss states',()=>{
 const g=arena();schedule(g,180);const packed=packRun(g);assert.ok(unpackRun(packed));
 for(const change of [s=>s.campaign.mid.id++,s=>s.campaign.mid.state='defeated',s=>s.campaign.final.state='active',s=>s.campaign.armoryDropped=true,s=>s.enemies[0].bossRole='unknown',s=>s.campaign.mid.spawnedAt=179]){const s=JSON.parse(packed);change(s);assert.equal(unpackRun(JSON.stringify(s)),null);}
});
test('milestone awakening is explicit, fills rank eight and uses no passive slot',()=>{
 const g=arena();defeatMid(g);g.pickups=[];g.passives=Object.fromEntries(Object.keys(PASSIVES).slice(0,6).map(id=>[id,1]));const before={...g.passives};openChest(g,{source:'midpoint',canEvolve:true});assert.equal(g.weapons.acorn.evolved,false);assert.equal(closeChest(g),false);assert.ok(g.chest.options.some(o=>o.id==='awaken:acorn'));assert.ok(unpackRun(packRun(g)));assert.equal(selectChest(g,'awaken:storm'),false);assert.equal(selectChest(g,'awaken:acorn'),true);assert.equal(g.weapons.acorn.rank,8);assert.equal(g.weapons.acorn.evolved,true);assert.deepEqual(g.passives,before);assert.equal(selectChest(g,'awaken:acorn'),false);assert.equal(closeChest(g),true);assert.equal(g.campaign.midpointClaimed,true);assert.equal(closeChest(g),false);
});
test('ordinary chests retain catalyst rules and the armory can awaken a second weapon',()=>{
 const g=arena();openChest(g,{source:'elite',canEvolve:true});assert.equal(g.chest.options.some(o=>o.kind==='awakening'),false);closeChest(g);defeatMid(g);g.pickups=[];g.weapons.acorn={rank:8,evolved:true,clock:0};g.weapons.bees={rank:1,evolved:false,clock:0};schedule(g,300);g.enemies=[];openChest(g,{source:'armory',canEvolve:true});assert.equal(selectChest(g,'awaken:bees'),true);closeChest(g);assert.equal(g.campaign.armoryClaimed,true);assert.equal(g.weapons.bees.rank,8);assert.ok(unpackRun(packRun(g)));
});
test('midpoint volley locks its aim and fires only after its visible warning',()=>{
 const g=arena();g.weapons={};const e=schedule(g,180);e.x=250;e.y=0;e.clock=0;stepGame(g,1/60);assert.equal(e.attack,'volley');assert.equal(e.mode,'windup');const angles=bossShotAngles(e),aim=e.patternAngle;advance(g,.8,{y:1});assert.equal(g.projectiles.filter(q=>q.hostile).length,0);assert.equal(e.patternAngle,aim);advance(g,.35);assert.equal(g.projectiles.filter(q=>q.hostile).length,angles.length);assert.equal(e.mode,'recover');
});
test('final crown keeps a real safe gap and roots remain at their warned positions',()=>{
 const g=arena();defeatMid(g);g.pickups=[];g.weapons={};const e=schedule(g,420);e.x=250;e.y=0;e.clock=0;stepGame(g,1/60);assert.equal(e.attack,'crown');const a=e.patternAngle;for(const angle of bossShotAngles(e))assert.ok(Math.abs(Math.atan2(Math.sin(angle-a),Math.cos(angle-a)))>=.42);advance(g,1.2,{y:1});assert.ok(g.projectiles.some(q=>q.hostile));e.mode='walk';e.clock=0;stepGame(g,1/60);assert.equal(e.attack,'roots');const positions=g.fields.filter(f=>f.ownerId===e.id).map(f=>[f.x,f.y]);assert.equal(positions.length,3);advance(g,.8,{x:1});assert.deepEqual(g.fields.filter(f=>f.ownerId===e.id).map(f=>[f.x,f.y]),positions);assert.ok(g.fields.every(f=>f.warning>0));
});
test('both boss charges use exactly the previewed maximum center distance',()=>{
 for(const role of ['midpoint','final'])for(const power of [1,2]){const g=arena();g.weapons={};g.time=role==='midpoint'?180:420;g.player.x=600;g.player.invincible=100;const e=spawnEnemy(g,'king',0,0,{bossRole:role,bossPhase:power,patternPower:power,patternAngle:0,hp:power===1?10000:4900,maxHp:10000,mode:'windup',windup:.001,attack:'charge',dx:1,dy:0,clock:100});const profile=chargeProfile(e);advance(g,1);assert.ok(Math.abs(e.x-profile.speed*profile.duration)<1e-6,`${role} ${power}`);assert.equal(g.player.hp,100);}
});
test('killing a mandatory boss cancels its warning and hostile shots in the same frame',()=>{
 const g=arena();g.weapons.acorn.clock=10;g.player.invincible=0;const e=schedule(g,180);e.x=80;e.y=0;e.hp=1;e.clock=100;e.speed=0;
 g.fields=[{x:0,y:0,r:40,damage:50,life:1,tick:0,warning:0,hostile:true,ownerId:e.id}];g.projectiles=[{kind:'acorn',x:70,y:0,vx:600,vy:0,damage:10,r:6,life:1,age:0,pierce:0,hits:[],context:{source:'weapon',weapon:'acorn'}},{kind:'enemy',x:8,y:0,vx:-60,vy:0,damage:15,r:7,life:1,age:0,pierce:0,hits:[],hostile:true,ownerId:e.id}];stepGame(g,1/60);assert.equal(g.campaign.mid.state,'defeated');assert.equal(g.player.hp,100);assert.equal(g.fields.some(f=>f.ownerId===e.id),false);assert.equal(g.projectiles.some(q=>q.ownerId===e.id),false);
});
test('mastered links require a matching evolved weapon, including unions',()=>{
 for(const [id,s] of Object.entries(SYNERGIES)){const g=arena(s.weapons[0],s.relic);assert.equal(synergyMastered(g,id),false);g.weapons[s.weapons[0]]={rank:8,evolved:true,clock:0};assert.equal(synergyMastered(g,id),true);g.relics.items=[];assert.equal(synergyMastered(g,id),false);}
 const g=arena('bees','shell');g.weapons={hive:{rank:1,evolved:true,clock:0}};assert.equal(synergyMastered(g,'bastion'),true);
});
test('mastered gale launches two bounded returning wind shots',()=>{
 const g=arena('acorn','wind');g.weapons.acorn={rank:8,evolved:true,clock:0};dummy(g);g.relics.wind.distance=240;advance(g,.1);assert.equal(g.projectiles.filter(q=>q.returnSynergy==='gale').length,2);assert.equal(g.synergies.stats.gale.procs,1);advance(g,3);assert.ok(g.synergies.stats.gale.damage>0);assert.ok(g.projectiles.filter(q=>q.returnSynergy==='gale').length<=2);
});
test('mastered swarm launches four bees and bramble adds bounded pull',()=>{
 const g=arena('bees','thread');g.weapons.bees={rank:8,evolved:true,clock:0};dummy(g);advance(g,.5);g.weapons.bees.clock=10;advance(g,.65,{y:1});assert.equal(g.projectiles.filter(q=>q.context?.synergy==='swarm').length,4);
 const b=arena('vine','thorn');b.weapons.vine={rank:8,evolved:true,clock:0};dummy(b,70);advance(b,1.4);const f=b.fields.find(f=>f.context?.synergy==='bramble');assert.ok(f);assert.equal(f.r,125);assert.equal(f.pull,70);assert.ok(f.life<=2);assert.equal(f.damage,0);
});
test('mastered bastion has twenty shield and exactly one delayed second retaliation',()=>{
 const g=arena('briar','shell');g.weapons.briar={rank:8,evolved:true,clock:0};advance(g,.8);assert.equal(g.relics.shell.shield,20);const e=spawnEnemy(g,'shroom',20,0,{hp:10000,maxHp:10000,speed:0,damage:25});g.player.invincible=0;stepGame(g,1/60);assert.equal(g.synergies.stats.bastion.procs,1);assert.equal(g.delayed.filter(d=>d.context?.synergy==='bastion').length,1);advance(g,.3);assert.equal(g.delayed.filter(d=>d.context?.synergy==='bastion').length,0);assert.ok(e.hp<e.maxHp);
});
test('mastered garden produces a twelve point seed after eight weapon kills; conductor links five',()=>{
 const g=arena('bloom','seed');g.weapons.bloom={rank:8,evolved:true,clock:0};for(let i=0;i<8;i++)spawnEnemy(g,'shroom',45+i,0,{hp:1,maxHp:1,speed:0,xp:0});advance(g,.1);const seed=g.pickups.find(p=>p.relicId==='seed');assert.equal(seed.amount,12);assert.equal(g.fields.find(f=>f.context?.synergy==='garden').r,105);assert.ok(unpackRun(packRun(g)));
 const b=arena('storm','tide');b.weapons.storm={rank:8,evolved:true,clock:10};const enemies=[140,240,340,440,540].map(x=>dummy(b,x));b.player.hp=70;healPlayer(b,15);assert.equal(b.effects.filter(f=>f.type==='bolt').length,5);assert.ok(enemies.every(e=>e.hp<e.maxHp));assert.equal(b.synergies.stats.conductor.procs,1);
});
test('every evolved base weapon deals more actual damage than rank one in a controlled arena',()=>{
 for(const id of BASE_WEAPON_IDS){const damage=evolved=>{const g=arena(id);g.weapons[id]={rank:evolved?8:1,evolved,clock:0};dummy(g,id==='briar'?60:100);advance(g,10);return Object.values(g.metrics.weapons?.[id]||{}).reduce((sum,s)=>sum+s.damage,0);};const opening=damage(false),complete=damage(true);assert.ok(opening>0,`${id} opening`);assert.ok(complete>opening*2,`${id}: ${opening} → ${complete}`);}
});
test('a cleared forest offers a frozen continuation with a preserved build and delayed stronger boss',()=>{
 const g=arena();defeatMid(g);g.pickups=[];const e=schedule(g,420);g.enemies=[];finishCampaignBoss(g,e);const weapons=JSON.stringify(g.weapons),time=g.time;stepGame(g,.04);assert.equal(g.time,time);assert.ok(unpackRun(packRun(g)));assert.equal(continueCampaign(g,'unknown'),false);assert.equal(continueCampaign(g,'force'),true);assert.equal(continueCampaign(g,'force'),false);assert.equal(g.campaign.depth,2);assert.equal(g.campaign.cleared,1);assert.equal(JSON.stringify(g.weapons),weapons);assert.ok(g.stats.damage>1);schedule(g,509);assert.equal(g.enemies.some(e=>e.bossRole==='final'),false);schedule(g,510);assert.equal(g.enemies.find(e=>e.bossRole==='final').maxHp,45000*1.45);assert.ok(unpackRun(packRun(g)));
});
test('campaign continues beyond thirty minutes instead of automatically winning',()=>{
 const g=arena();g.time=1800;stepGame(g,1/60);assert.ok(g.time>1800);assert.equal(g.outcome,null);assert.equal(g.phase,'playing');assert.ok(unpackRun(packRun(g)));
});
test('late death preserves the cleared stage in the journal and records are idempotent',()=>{
 const g=arena();defeatMid(g);g.pickups=[];const e=schedule(g,420);g.enemies=[];finishCampaignBoss(g,e);continueCampaign(g,'vigor');g.phase='result';g.outcome='defeat';g.metrics.bestStreak=60;const j=normalizeJournal(null);assert.equal(recordRun(j,g),true);assert.equal(recordRun(j,g),false);assert.equal(j.bestStage,1);assert.equal(j.runs[0].stage,1);assert.equal(j.bestStreak,60);assert.equal(j.clears,1);assert.deepEqual(normalizeJournal(JSON.parse(JSON.stringify(j))),j);
});
test('hordes are spatial, bounded, repeatable and suppressed during boss combat',()=>{
 const g=arena();defeatMid(g);g.pickups=[];g.campaign.nextHordeAt=225;schedule(g,225);const horde=g.enemies.filter(e=>e.horde);assert.equal(horde.length,76);assert.ok(horde.every(e=>Math.hypot(e.x-g.player.x,e.y-g.player.y)>=580));schedule(g,225);assert.equal(g.enemies.filter(e=>e.horde).length,76);schedule(g,420);const count=g.campaign.hordes;schedule(g,460);assert.equal(g.campaign.hordes,count);assert.ok(g.enemies.length<=601);
});
test('incomplete weapon metrics cannot crash a restored first cast',()=>{
 const g=arena();stepGame(g,1/60);const s=JSON.parse(packRun(g));s.metrics.weapons={acorn:{}};assert.equal(unpackRun(JSON.stringify(s)),null);
});
test('a midpoint chest dropped in a rock is moved to a reachable edge',()=>{
 const g=arena();g.terrain=[{x:0,y:0,r:49}];const e=schedule(g,180);e.x=e.y=0;g.enemies=[];finishCampaignBoss(g,e);const q=g.pickups.find(p=>p.source==='midpoint');assert.ok(Math.hypot(q.x,q.y)>=49*.78+32);
});
test('awakening never invalidates a union material, while a required awakening remains required',()=>{
 const g=arena();g.weapons={acorn:{rank:8,evolved:true,clock:0},moon:{rank:8,evolved:true,clock:0}};assert.ok(unionCandidates(g).some(r=>r.id==='returning'));
 g.weapons={briar:{rank:8,evolved:false,clock:0},bees:{rank:8,evolved:true,clock:0}};assert.equal(unionCandidates(g).length,0);g.weapons.briar.evolved=true;assert.ok(unionCandidates(g).some(r=>r.id==='hive'));
});
test('the armory offers a newly completed union after awakening, or lets the player retain both weapons',()=>{
 for(const fuse of [true,false]){const g=arena();defeatMid(g);g.pickups=[];schedule(g,300);g.weapons={acorn:{rank:8,evolved:true,clock:0},moon:{rank:3,evolved:false,clock:0}};openChest(g,{source:'armory',canEvolve:true});assert.equal(selectChest(g,'awaken:moon'),true);assert.equal(g.chest.optionalUnion,true);assert.deepEqual(g.chest.options.map(o=>o.id),['union:returning']);assert.ok(unpackRun(packRun(g)));if(fuse){assert.equal(selectChest(g,'union:returning'),true);assert.equal(g.weapons.acorn,undefined);assert.equal(g.weapons.moon,undefined);assert.ok(g.weapons.returning);assert.ok(g.projectiles.some(q=>q.union==='returning'));assert.ok(unpackRun(packRun(g)));}assert.equal(closeChest(g),true);assert.equal(g.campaign.armoryClaimed,true);assert.equal(Object.keys(g.weapons).length,fuse?1:2);}
});
test('a planned companion is offered without bypassing player choice or inventory limits',()=>{
 const g=arena();assert.ok(draftChoices(g).some(c=>c.id==='moon'));assert.equal(g.weapons.moon,undefined);g.pool=g.pool.filter(id=>id!=='moon');g.drafts=0;assert.equal(draftChoices(g).some(c=>c.id==='moon'),false);
});
test('hive bees return and apply a real defense pulse without creating recursive projectiles',()=>{
 const g=arena();g.weapons={hive:{rank:1,evolved:true,clock:0}};dummy(g,230);advance(g,.1);g.weapons.hive.clock=10;advance(g,1);assert.ok(g.projectiles.some(q=>q.union==='hive'&&q.hiveReturning));const e=dummy(g,70);const damage=g.damage;advance(g,.7);assert.ok(e.hp<e.maxHp);assert.ok(g.damage>damage);advance(g,2);assert.equal(g.projectiles.some(q=>q.union==='hive'),false);assert.ok(unpackRun(packRun(g)));
});
test('continuing preserves optional encounter owners and their warnings rather than faking completion',()=>{
 const g=arena();defeatMid(g);g.pickups=[];const final=schedule(g,420);g.enemies=[];finishCampaignBoss(g,final);const nest=g.expedition.sites.find(s=>s.id==='nest'),supply=g.expedition.sites.find(s=>s.id==='supply');nest.state='active';supply.state='guarded';const guardian=spawnEnemy(g,'elite',600,-400,{nestGuardian:true}),guard=spawnEnemy(g,'shroom',-760,-180,{supplyGuard:true});g.expedition.guardianId=guardian.id;g.fields=[{hostile:true,ownerId:guardian.id,x:600,y:-400,r:40,life:2,warning:1,tick:0,damage:1}];const position=[g.player.x,g.player.y];continueCampaign(g,'force');updateExpedition(g);assert.equal(nest.state,'active');assert.equal(supply.state,'guarded');assert.ok(g.enemies.includes(guardian));assert.ok(g.enemies.includes(guard));assert.ok(g.fields.some(f=>f.ownerId===guardian.id));assert.deepEqual([g.player.x,g.player.y],position);
});
test('each final union has measured boss and crowd output above its two evolved materials',()=>{
 const results=unionBench().results;for(const recipe of ['returning','hive'])for(const kind of ['boss','crowd']){const pair=results.find(r=>r.recipe===recipe&&r.kind===kind&&r.setup==='evolved-materials'),union=results.find(r=>r.recipe===recipe&&r.kind===kind&&r.setup==='union');assert.ok(union.damagePerSecond>pair.damagePerSecond*1.1,`${recipe} ${kind}`);assert.equal(union.slots,1);assert.equal(pair.slots,2);assert.ok(union.peakProjectiles<420);}
});
test('union reward restoration rejects missing or forged consumed-material data',()=>{
 const g=arena();g.weapons={acorn:{rank:8,evolved:true,clock:0},moon:{rank:8,evolved:true,clock:0}};openChest(g,{canEvolve:true});selectChest(g,'union:returning');const saved=packRun(g);assert.ok(unpackRun(saved));for(const change of [r=>delete r.consumed,r=>r.consumed=null,r=>r.consumed=['acorn','unknown'],r=>r.union='yes',r=>r.consumed=['moon','acorn']]){const s=JSON.parse(saved);change(s.chest.rewards[0]);assert.equal(unpackRun(JSON.stringify(s)),null);}
});
test('a saturated friendly projectile pool replaces older shots and continues primary fire',()=>{
 const g=arena();dummy(g);g.weapons.acorn.clock=0;g.projectiles=Array.from({length:420},()=>({kind:'acorn',x:5000,y:5000,vx:0,vy:0,damage:1,life:10,age:2,r:6,pierce:0,hits:[],context:{source:'weapon',weapon:'acorn'}}));stepGame(g,1/60);assert.ok(g.projectiles.some(q=>q.age<.05&&q.context?.weapon==='acorn'));assert.ok(g.projectiles.length<=420);
});
