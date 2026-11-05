import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RULESET,BOSS_GATE,calculateSettlement,TRAINING,researchReady} from '../src/mission/content.js';
import {createProfile,parseProfile,recoverActiveRun,beginRun,settleRun,buyTraining,refundTraining,buyResearch,checkpointRun,createProfileStore} from '../src/mission/profile.js';
import {createMission,restoreMission,packMission,stepMission,chooseMission,rerollMission,missionAction,endMission,pauseMission,resumeMission,availableUpgrades,interaction} from '../src/mission/model.js';
const dt=1/60;
function begun(hero='marco',seed=17,p=createProfile('test')){const start=beginRun(p,{hero,seed});assert.ok(start.ok);return{profile:start.profile,run:createMission(start.descriptor)};}
function step(s,seconds,input={x:0,y:0}){for(let i=0;i<Math.ceil(seconds/dt);i++)stepMission(s,dt,input);}
// Explicit fixtures isolate economy/physics. Input-only full journeys are tested
// separately by mission-pilot.mjs, without changing HP, weapons, or clock.
function quiet(s){s.enemies=[];s.spawnClock=999;s.waveClock=999;s.sites.forEach(n=>{if(n.kind!=='boss')n.state='done';});}
function fixtureResult(hero='marco'){const b=begun(hero);b.run.stats={...b.run.stats,kills:200,rescues:2};b.run.t=120;endMission(b.run,'hp');return b;}
test('runtime currency and score match every independently recorded design fixture',async()=>{
 const examples=JSON.parse(await readFile('docs/design/meta-economy-examples.json','utf8'));
 for(const s of examples.samples){assert.deepEqual(calculateSettlement(s),s.repeat,s.id);assert.deepEqual(calculateSettlement(s,{firstReport:true,firstClear:true}),s.newProfile,s.id);}
});
test('first failure pays once, survives reload, and older run sequences cannot be paid again',()=>{
 const b=fixtureResult();const settled=settleRun(b.profile,b.run);assert.ok(settled.ok);assert.equal(settled.profile.wallet,180);assert.equal(settled.profile.activeRun,null);
 const loaded=parseProfile(JSON.stringify(settled.profile)),again=settleRun(loaded,b.run);assert.ok(again.alreadySettled);assert.equal(again.profile.wallet,180);assert.deepEqual(again.receipt,settled.receipt);
 const second=begun('marco',71,loaded);endMission(second.run,'retreat');const final=settleRun(second.profile,second.run);assert.equal(final.profile.wallet,180);assert.ok(settleRun(final.profile,b.run).alreadySettled);assert.equal(final.profile.wallet,180);
});
test('first-clear bonus belongs to the operation, and dense only multiplies repeat credits',()=>{
 const b=begun();b.run.stats={...b.run.stats,kills:1000,elites:2,rescues:3,outposts:1,armorBreaks:2};b.run.t=360;endMission(b.run,'victory');const one=settleRun(b.profile,b.run);assert.equal(one.profile.wallet,990);
 const second=beginRun(one.profile,{hero:'fio',difficulty:'dense',seed:71});assert.ok(second.ok);const run=createMission(second.descriptor);run.stats={...run.stats,kills:1000,elites:2,rescues:3,outposts:1,armorBreaks:2};run.t=360;endMission(run,'victory');const two=settleRun(second.profile,run);assert.equal(two.receipt.award.oneTime.clear,0);assert.equal(two.receipt.award.oneTime.report,0);assert.equal(two.receipt.award.repeatCredits,Math.floor(690*1.15));
});
test('training purchase, limits, snapshot, and refunds use actually paid amounts',()=>{
 const b=fixtureResult(),paid=settleRun(b.profile,b.run).profile;const result=buyTraining(paid,'reroll');assert.ok(result.ok);assert.equal(result.profile.wallet,20);assert.equal(result.profile.training.reroll.rank,1);
 assert.equal(buyTraining(result.profile,'reroll').ok,false);const next=begun('fio',3,result.profile);assert.equal(next.run.rerolls,2);assert.equal(buyTraining(next.profile,'vitality').ok,false);assert.equal(refundTraining(next.profile).ok,false);
 const refunded=refundTraining(result.profile);assert.equal(refunded.amount,160);assert.equal(refunded.profile.wallet,180);assert.equal(refundTraining(refunded.profile).amount,0);assert.equal(next.run.rerolls,2);
});
test('a failed storage commit changes no in-memory wallet or flags; retry saves exactly once',()=>{
 const b=fixtureResult(),next=settleRun(b.profile,b.run).profile;let fail=true,blob=null;const storage={setItem(key,value){if(fail)throw Error('quota');blob=value;}};const store=createProfileStore(storage,b.profile);
 assert.equal(store.commit(next).ok,false);assert.equal(store.get().wallet,0);assert.ok(store.get().activeRun);fail=false;assert.ok(store.commit(next).ok);assert.equal(parseProfile(blob).wallet,180);assert.equal(settleRun(store.get(),b.run).profile.wallet,180);
});
test('research requires achievement and credits, is single-purchase, and reaches a real weapon candidate',()=>{
 const b=fixtureResult();b.run.result.stats.pMastery=true;b.run.result.stats.kills=400;const earned=settleRun(b.profile,b.run).profile;
 assert.ok(researchReady(earned,'p-split'));assert.equal(buyResearch(createProfile(),'p-split').ok,false);const research=buyResearch(earned,'p-split');assert.ok(research.ok);assert.equal(research.profile.wallet,20);assert.equal(buyResearch(research.profile,'p-split').ok,false);
 const next=begun('marco',4,research.profile);next.run.weapons[0].rank=1;const cards=availableUpgrades(next.run);assert.equal(cards[0].id,'mod:p-split');next.run.phase='choice';next.run.choiceType='level';next.run.choices=cards;assert.ok(chooseMission(next.run,cards[0].id));assert.ok(next.run.weapons[0].mods.includes('p-split'));
 assert.equal(availableUpgrades(next.run).some(c=>c.mod==='p-split'),false);
});
test('unused new research survives another hero run and research first display is consumed on settlement',()=>{
 const p=createProfile();p.wallet=500;p.progress.pMastery=true;const researched=buyResearch(p,'p-split').profile;
 const fio=begun('fio',1,researched);endMission(fio.run,'retreat');const returned=settleRun(fio.profile,fio.run).profile;assert.ok(returned.freshMods.includes('p-split'));
 const marco=begun('marco',2,returned);marco.run.weapons[0].rank=1;availableUpgrades(marco.run);endMission(marco.run,'retreat');assert.equal(settleRun(marco.profile,marco.run).profile.freshMods.includes('p-split'),false);
});
test('Marco starts P with focused burst; Fio starts H and activates both weapons overdrive',()=>{
 const a=begun('marco').run,b=begun('fio').run;assert.equal(a.weapons[0].id,'p');assert.equal(b.weapons[0].id,'h');assert.ok(missionAction(a,'skill'));assert.ok(a.shots.length>=5);assert.equal(a.player.overdrive,0);assert.ok(missionAction(b,'skill'));assert.ok(b.player.overdrive>0);assert.equal(b.player.charge,0);
});
test('pause and all choice screens freeze combat and checkpoint restores deterministic continuation',()=>{
 const s=begun().run;step(s,.5,{x:.5,y:-1});pauseMission(s);const raw=packMission(s);step(s,3);assert.deepEqual(packMission(s),raw);assert.equal(missionAction(s,'skill'),false);resumeMission(s);
 const restored=restoreMission(packMission(s));for(let i=0;i<120;i++){stepMission(s,dt,{x:1,y:0});stepMission(restored,dt,{x:1,y:0});}assert.deepEqual(packMission(s),packMission(restored));
 s.phase='choice';const now=s.t;step(s,10);assert.equal(s.t,now);
});
test('supply follows clearing actual guards, grants rescue once, and gives a meaningful equipment choice',()=>{
 const s=begun().run;const node=s.sites[0];s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);assert.equal(node.state,'active');assert.equal(s.stats.rescues,0);
 for(const e of s.enemies)if(e.siteId===node.id){e.dead=true;e.deathLife=0;}
 stepMission(s,dt);assert.equal(s.phase,'choice');assert.equal(s.stats.rescues,1);assert.ok(s.choices.some(c=>c.kind==='weapon'));const choice=s.choices.find(c=>c.kind==='weapon');chooseMission(s,choice.id);assert.ok(s.weapons[1]);step(s,.2);assert.equal(s.stats.rescues,1);
});
test('ordinary levels guarantee an owned weapon investment and rerolls spend per-run charges only',()=>{
 const s=begun().run;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);assert.ok(s.choices.some(c=>c.kind==='rank'));assert.equal(chooseMission(s,'invalid'),false);assert.ok(rerollMission(s));assert.equal(s.rerolls,0);assert.equal(rerollMission(s),false);
});
test('an empty support slot offers its fusion partner and a seeded alternative',()=>{
 for(const seed of [17,71]){const s=begun('fio',seed).run,node=s.sites[0];s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);for(const e of s.enemies)if(e.siteId===node.id){e.dead=true;e.deathLife=0;}stepMission(s,dt);assert.equal(s.choices.filter(c=>c.kind==='weapon').length,2);assert.ok(s.choices.some(c=>c.weapon==='r'));assert.ok(chooseMission(s,'weapon:r:1'));assert.equal(s.weapons[1].id,'r');}
});
test('base evolution and H/R union need no lobby research and keep prior modifications',()=>{
 const s=begun('fio').run;s.weapons=[{id:'h',rank:3,evolved:true,mods:['h-ricochet'],cd:1},{id:'r',rank:3,evolved:false,mods:['r-incendiary'],cd:1}];s.cores=1;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);assert.ok(s.choices.some(c=>c.kind==='union'));assert.ok(chooseMission(s,'union'));assert.equal(s.weapons[0].id,'u');assert.equal(s.weapons[1],null);assert.equal(s.cores,0);assert.deepEqual(s.weapons[0].mods,['h-ricochet','r-incendiary']);
});
test('Slug can enter boss arena without dismounting; foot entry has no level gate',()=>{
 for(const slug of [false,true]){const s=begun().run;s.player.x=BOSS_GATE.x;s.player.y=BOSS_GATE.y;s.player.slug=slug;s.player.slugHp=120;assert.equal(interaction(s).id,'boss');assert.ok(missionAction(s,'interact'));assert.equal(s.stage,'boss');assert.equal(s.player.slug,slug);assert.ok(s.boss.active);}
});
test('a union kill advances both research tags but currency kill count only once',()=>{
 const s=begun('fio').run;quiet(s);const base=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.weapons=[{id:'u',rank:3,evolved:true,mods:[],cd:0},null];s.enemies=[{...base,id:991,x:80,y:0,hp:1,speed:0,timer:999}];step(s,.2);assert.equal(s.stats.kills,1);assert.equal(s.stats.weaponKills.h,1);assert.equal(s.stats.weaponKills.r,1);
});
test('P split cannot recursively split; arrays remain bounded during dense collisions',()=>{
 const s=begun().run;quiet(s);s.player.x=0;s.player.y=0;s.player.invuln=100;s.weapons[0]={id:'p',rank:3,evolved:true,mods:['p-split'],cd:0};const template=begun().run.enemies[0];s.enemies=Array.from({length:45},(_,i)=>({...template,id:100+i,x:70+(i%10)*13,y:(Math.floor(i/10)-2)*15,hp:1000,speed:0,timer:999}));step(s,2);
 assert.ok(s.shots.length<=280);assert.ok(s.shots.filter(o=>o.fragment).every(o=>!o.split));assert.ok(s.effects.length<=160);
});
test('boss victory snapshots all same-tick kills and is terminal',()=>{
 const s=begun().run;quiet(s);s.front=2;s.stage='boss';s.boss.active=true;s.boss.hp=1;s.boss.parts.forEach(p=>p.hp=0);s.boss.mode=s.front===2?'expose':'recover';s.boss.coreOpen=s.front===2?4:0;s.boss.timer=9;s.player.x=s.boss.x+110;s.player.y=s.boss.y;s.player.invuln=99;s.weapons[0].rank=3;s.weapons[0].evolved=true;s.weapons[0].cd=0;
 const template=begun().run.enemies[0];s.enemies=[{...template,id:999,x:s.boss.x+30,y:s.boss.y,hp:1,speed:0,timer:999}];step(s,.5);assert.equal(s.result.won,true);assert.deepEqual(s.result.stats,s.stats);const raw=packMission(s);step(s,5);assert.deepEqual(packMission(s),raw);
});
test('time passing beyond six minutes never causes an automatic loss or XP cutoff',()=>{
 const s=begun().run;quiet(s);s.t=600;stepMission(s,dt,{x:0,y:0});assert.equal(s.phase,'playing');assert.ok(s.t>600);
});
test('invalid profile formats are detected and paid ledgers cannot refund nonexistent ranks',()=>{
 const p=createProfile();p.training.vitality.paid=[80];assert.throws(()=>parseProfile(JSON.stringify(p)));assert.throws(()=>parseProfile('{bad json'));assert.equal(parseProfile(null),null);
});

test('Fio keeps overdrive when firing a Slug cannon',()=>{
 const s=begun('fio').run;s.player.slug=true;s.player.slugHp=120;s.player.charge=100;assert.ok(missionAction(s,'skill'));assert.ok(s.player.overdrive>0);assert.equal(s.player.charge,40);assert.ok(s.shots.some(shot=>shot.rocket));
});
test('a union counts as owning its component guns when later supplies are generated',()=>{
 const s=begun('fio').run;quiet(s);s.weapons=[{id:'u',rank:3,evolved:true,mods:[],cd:99},null];const node=s.sites[0];node.state='ready';s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);const gun=s.choices.find(c=>c.kind==='weapon');assert.equal(gun.weapon,'p');
});

test('missing optional profile fields normalize without losing currency or training',()=>{
 const p=createProfile();p.wallet=320;delete p.settings;delete p.freshMods;delete p.progress;p.selectedHero='unknown';const loaded=parseProfile(JSON.stringify(p));assert.equal(loaded.wallet,320);assert.equal(loaded.selectedHero,'marco');assert.deepEqual(loaded.freshMods,[]);assert.equal(loaded.settings.sound,true);assert.equal(loaded.progress.weaponKills.h,0);
});
test('a damaged checkpoint rejects resume but can settle saved progress without resetting the base',()=>{
 const b=begun();b.run.stats.kills=200;b.run.stats.rescues=2;b.run.t=120;const saved=checkpointRun(b.profile,b.run).profile;delete saved.activeRun.checkpoint.snapshot.training;assert.throws(()=>restoreMission(saved.activeRun.checkpoint));const recovered=recoverActiveRun(saved);assert.ok(recovered.ok);assert.equal(recovered.profile.wallet,180);assert.equal(recovered.profile.activeRun,null);assert.equal(recovered.receipt.result.reason,'recovery');assert.ok(settleRun(recovered.profile,{...b.run,sequence:b.run.sequence}).alreadySettled);
});
test('invalid saved choice cards and active result snapshots recover instead of trapping the UI',()=>{
 const s=begun().run;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);assert.doesNotThrow(()=>restoreMission(packMission(s)));
 for(const cards of [[{id:'x',kind:'rank'}],[{id:'x',kind:'unknown'}],[{id:'x',kind:'utility',key:'unknown'}]]){const raw=packMission(s);raw.choices=cards;assert.throws(()=>restoreMission(raw));}
 const bad=packMission(s);bad.choiceType='unknown';assert.throws(()=>restoreMission(bad));endMission(s,'retreat');assert.throws(()=>restoreMission(packMission(s)));
});
function beatFront(s){quiet(s);s.stage='boss';s.boss.active=true;s.boss.hp=1;s.boss.parts.forEach(p=>p.hp=0);s.boss.mode=s.front===2?'expose':'recover';s.boss.coreOpen=s.front===2?4:0;s.boss.timer=9;s.player.x=s.boss.x+150;s.player.y=s.boss.y;s.player.invuln=99;s.weapons[0].rank=3;s.weapons[0].evolved=true;s.weapons[0].cd=0;step(s,1);}
test('two midboss rewards carry the build across fronts, only the third boss ends the mission',()=>{
 const s=begun().run;s.xp=7;beatFront(s);assert.equal(s.result,null);assert.equal(s.phase,'choice');assert.equal(s.choiceType,'tactic');assert.equal(s.stats.midbosses,1);const time=s.t,rank=s.weapons[0].rank;assert.doesNotThrow(()=>restoreMission(packMission(s)));assert.ok(chooseMission(s,'tactic:assault'));assert.equal(s.front,1);assert.equal(s.t,time);assert.equal(s.weapons[0].rank,rank);assert.equal(s.xp,7);assert.ok(s.tactics.includes('assault'));assert.ok(s.sites.some(n=>n.id==='battery'));
 beatFront(s);assert.equal(s.stats.midbosses,2);assert.ok(chooseMission(s,'tactic:barrage'));assert.equal(s.front,2);beatFront(s);assert.ok(s.result.won);assert.deepEqual(s.stats.fronts,[0,1]);assert.equal(s.frontHistory.length,2);
});
test('armor tactical supply prepares a real Slug and keeps its durability across the next front',()=>{
 const s=begun('fio').run;beatFront(s);chooseMission(s,'tactic:armor');const g=s.sites.find(n=>n.id==='garage');assert.equal(g.state,'ready');s.player.x=g.x;s.player.y=g.y;assert.ok(missionAction(s,'interact'));assert.equal(s.player.slugHp,160);s.player.skillCd=0;missionAction(s,'skill');assert.equal(s.player.skillCd,2.5);beatFront(s);chooseMission(s,'tactic:repair');assert.ok(s.player.slug);assert.equal(s.player.slugHp,160);
});
test('fusion tactical supply invests in both weapons and final union can receive researched H modifications',()=>{
 const s=begun('fio').run;s.weapons[1]={id:'r',rank:1,evolved:false,mods:[],cd:1};beatFront(s);chooseMission(s,'tactic:fusion');assert.equal(s.weapons[1].rank,2);s.weapons[1].rank=3;s.phase='choice';s.choices=availableUpgrades(s);assert.ok(chooseMission(s,'union'));s.snapshot.researched=['h-capacitor'];s.snapshot.freshMods=['h-capacitor'];const choices=availableUpgrades(s);assert.equal(choices[0].id,'mod:h-capacitor');
});
test('fortified supplies spawn their second escort wave and never complete after only wave one',()=>{
 const s=begun().run,node=s.sites.find(n=>n.id==='camp');s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);assert.equal(node.wave,1);for(const e of s.enemies)if(e.siteId===node.id)e.dead=true;stepMission(s,dt);assert.equal(node.wave,2);assert.equal(node.state,'active');assert.ok(s.enemies.some(e=>e.siteId===node.id&&!e.dead));
});
test('guard waves reserve capacity even when the ambient horde is at its cap',()=>{
 const s=begun().run,template=s.enemies[0],node=s.sites.find(n=>n.id==='camp');s.enemies=Array.from({length:200},(_,i)=>({...template,id:1000+i,x:node.x+500+i,y:node.y}));s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);assert.equal(s.enemies.filter(e=>e.siteId===node.id).length,node.guards);assert.ok(s.enemies.length<=200);
});
test('artillery supply makes a real boss pattern choice instead of awarding a cosmetic label',()=>{
 const s=begun().run;beatFront(s);chooseMission(s,'tactic:assault');s.phase='choice';s.choiceType='supply';s.choices=[{id:'sabotage:silence',kind:'sabotage',key:'silence'}];assert.ok(chooseMission(s,'sabotage:silence'));quiet(s);s.boss.active=true;s.boss.mode='walk';s.boss.timer=0;stepMission(s,dt);assert.equal(s.hazards.length,1);assert.ok(s.hazards.every(h=>h.shape==='beam'));
});
test('midboss and union research unlock from settled performance, and new profile fields survive reload',()=>{
 const b=begun();b.run.stats.midbosses=1;b.run.stats.union=true;b.run.stats.kills=500;endMission(b.run,'retreat');const paid=settleRun(b.profile,b.run).profile;assert.ok(researchReady(paid,'p-execution'));assert.ok(researchReady(paid,'h-capacitor'));assert.equal(parseProfile(JSON.stringify(paid)).progress.midbossMarco,1);assert.equal(parseProfile(JSON.stringify(paid)).progress.unions,1);
});
test('field orders pay their first completion once and are separate from repeat kill farming',()=>{
 const b=begun('fio');b.run.stats={...b.run.stats,kills:2000,midbosses:2,evolvedKills:1000,union:true};endMission(b.run,'victory');const one=settleRun(b.profile,b.run);assert.equal(one.receipt.award.orderCredits,440);assert.equal(one.profile.orders.length,3);const second=begun('fio',71,parseProfile(JSON.stringify(one.profile)));second.run.stats={...b.run.stats};endMission(second.run,'victory');const two=settleRun(second.profile,second.run);assert.equal(two.receipt.award.orderCredits,0);assert.equal(two.profile.orders.length,3);
});
test('completed guns cannot accumulate attack-speed utility beyond the level cap from supply choices',()=>{
 const s=begun('fio').run;quiet(s);s.weapons=[{id:'u',rank:3,evolved:true,mods:[],cd:0},null];s.boosts.tempo=3;s.boosts.vitality=3;s.boosts.power=3;s.boosts.magnet=3;s.boosts.projectile=1;const cards=availableUpgrades(s);assert.equal(cards[0].kind,'resupply');assert.ok(cards.every(c=>c.key!=='tempo'&&c.key!=='vitality'));
});
test('evolution and union clear the same dense formation faster than the starting gun',()=>{
 function count(kind){const s=begun('fio').run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.player.invuln=99;s.weapons=[{id:kind==='union'?'u':'h',rank:kind==='base'?0:3,evolved:kind!=='base',mods:[],cd:0,shots:0},null];s.enemies=Array.from({length:60},(_,i)=>({...template,id:500+i,x:80+(i%10)*18,y:(Math.floor(i/10)-2.5)*22,hp:30,maxHp:30,speed:0,timer:999,siteId:null}));step(s,1.5);return s.stats.kills;}
 const base=count('base'),evolved=count('evolved'),union=count('union');assert.ok(evolved>base*1.5,`${base} -> ${evolved}`);assert.ok(union>base*1.5,`${base} -> ${union}`);
});
test('three-front repeat rewards and score keep growing after 800 kills, with a finite farming ceiling',()=>{
 const base={rules:RULESET,kills:800,midbosses:1,elites:2,outposts:2,armorBreaks:2};const a=calculateSettlement(base),b=calculateSettlement({...base,kills:3000,midbosses:2,elites:6,outposts:6,armorBreaks:6});assert.ok(b.repeatCredits>a.repeatCredits);assert.ok(b.score>a.score);assert.equal(b.components.midbosses,150);assert.equal(b.components.armorBreaks,180);assert.equal(calculateSettlement({...base,kills:9000}).repeatCredits,calculateSettlement({...base,kills:8000}).repeatCredits);
});
test('barrage triggers only on a new normal-kill threshold, never again for officers at the same count',()=>{
 function scene(kills,threshold,type){const s=begun('fio').run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.player.invuln=99;s.tactics=['barrage'];s.barrageAt=threshold;s.stats.kills=kills;s.weapons[0]={id:'h',rank:3,evolved:true,mods:[],cd:0,shots:0};s.enemies=[{...template,id:900,x:80,y:0,hp:1,maxHp:1,type,speed:0,timer:999}];step(s,.3);return s;}
 const elite=scene(35,1,'officer');assert.equal(elite.stats.kills,35);assert.equal(elite.effects.filter(f=>f.type==='explosion').length,0);const normal=scene(34,0,'rifle');assert.equal(normal.barrageAt,1);assert.equal(normal.effects.filter(f=>f.type==='explosion').length,3);
});
test('trial requisition equips union-compatible research and gives a real fallback to a maxed gun',()=>{
 const s=begun('fio').run;beatFront(s);chooseMission(s,'tactic:fusion');s.weapons=[{id:'u',rank:3,evolved:true,mods:[],cd:0,shots:0},null];s.snapshot.researched=['h-capacitor'];beatFront(s);assert.ok(chooseMission(s,'tactic:requisition'));assert.ok(s.weapons[0].mods.includes('h-capacitor'));
 const p=begun().run;beatFront(p);chooseMission(p,'tactic:assault');beatFront(p);const power=p.boosts.power;chooseMission(p,'tactic:requisition');assert.equal(p.boosts.power,power+1);
});
test('armor supply repairs an existing Slug and its free garage voucher is consumed once',()=>{
 const s=begun().run;s.player.slug=true;s.player.slugHp=20;beatFront(s);chooseMission(s,'tactic:armor');assert.equal(s.player.slugHp,160);assert.equal(s.sites.find(n=>n.id==='garage').state,'ready');beatFront(s);chooseMission(s,'tactic:barrage');assert.equal(s.sites.find(n=>n.id==='garage').state,'waiting');
});
test('P execution research kills an off-axis target without recursively multiplying the blast',()=>{
 function scene(mod){const s=begun().run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.weapons[0].cd=0;s.weapons[0].mods=mod?['p-execution']:[];s.enemies=[{...template,id:801,x:80,y:0,hp:1,speed:0,timer:999},{...template,id:802,x:80,y:50,hp:30,speed:0,timer:999},{...template,id:803,x:80,y:105,hp:30,speed:0,timer:999}];step(s,.14);return s;}
 assert.equal(scene(false).stats.kills,1);const researched=scene(true);assert.equal(researched.stats.kills,2);assert.ok(!researched.enemies.find(e=>e.id===803).dead);
});
test('H capacitor research turns its hit threshold into real charge and splash damage',()=>{
 const s=begun('fio').run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.player.charge=0;s.capacitor=17;s.weapons[0].mods=['h-capacitor'];s.weapons[0].cd=0;s.enemies=[{...template,id:811,x:80,y:0,hp:1000,speed:0,timer:999},{...template,id:812,x:120,y:65,hp:30,speed:0,timer:999}];step(s,.14);assert.ok(s.player.charge>=12);assert.equal(s.capacitor,0);assert.ok(s.enemies.find(e=>e.id===812).dead);
});
test('union missiles turn toward a moving target with bounded steering rather than remaining straight rockets',()=>{
 const s=begun('fio').run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.player.invuln=99;s.weapons=[{id:'u',rank:3,evolved:true,mods:[],cd:0,shots:0,proc:5},null];s.enemies=[{...template,id:901,x:170,y:0,hp:10000,speed:0,timer:999}];step(s,.2);const missile=s.shots.find(o=>o.homing);assert.ok(missile);const before=missile.angle;s.enemies[0].y=170;stepMission(s,dt);assert.ok(missile.angle>before);assert.ok(missile.angle-before<=dt*6+.0001);
});
test('P/S and F/R unions consume both guns, inherit research, and restore their distinct identities',()=>{
 for(const [recipe,parts] of [['v',['p','s']],['n',['f','r']]]){const s=begun().run;s.weapons=parts.map(id=>({id,rank:3,evolved:true,mods:id==='s'?['s-flechette']:id==='f'?['f-catalyst']:[],cd:0,shots:0}));s.cores=1;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);assert.ok(chooseMission(s,`union:${recipe}`));assert.equal(s.weapons[0].id,recipe);assert.equal(s.weapons[1],null);assert.deepEqual(s.stats.unionIds,[recipe]);assert.equal(restoreMission(packMission(s)).weapons[0].id,recipe);assert.ok(s.weapons[0].mods.length);}
});
test('seeded supplies expose new weapons and an occupied loadout can pivot to another fusion path',()=>{
 const offered=new Set(),pivots=new Set();for(let seed=1;seed<=20;seed++){for(const full of [false,true]){const s=begun('marco',seed).run;if(full)s.weapons[1]={id:'h',rank:1,evolved:false,mods:[],cd:0,shots:0};const node=s.sites[0];s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);for(const e of s.enemies)if(e.siteId===node.id)e.dead=true;stepMission(s,dt);for(const c of s.choices)if(['weapon','weapon-offer'].includes(c.kind))(full?pivots:offered).add(c.weapon);}}
 assert.ok(offered.has('s'));assert.ok(offered.has('f'));assert.ok(pivots.has('s'));assert.ok(pivots.has('f'));assert.ok(pivots.has('r'));
});
test('shotgun bursts have a short range and flamethrowers leave real persistent burns',()=>{
 function scene(id,x){const s=begun().run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.player.invuln=99;s.weapons[0]={id,rank:0,evolved:false,mods:[],cd:0,shots:0};s.enemies=[{...template,id:777,x,y:0,hp:1000,speed:0,timer:999}];step(s,.45);return s;}
 assert.ok(scene('s',130).enemies[0].hp<1000);assert.equal(scene('s',370).enemies[0].hp,1000);const flame=scene('f',120);assert.ok(flame.enemies[0].burn>0);assert.ok(flame.enemies[0].hp<1000);assert.ok(flame.shots.some(o=>o.flame));
});
test('catalyst research makes burning targets amplify the other gun rather than just renaming a flame',()=>{
 function hp(mod){const s=begun().run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.weapons=[{id:'f',rank:1,evolved:false,mods:mod?['f-catalyst']:[],cd:99,shots:0},null];s.enemies=[{...template,id:770,x:90,y:0,hp:1000,speed:0,timer:999,burn:2,burnTick:99}];s.shots=[{id:1,x:70,y:0,vx:1000,vy:0,angle:0,weapon:'s',tags:['s'],damage:20,pierce:1,hits:[],life:1,pellet:true}];stepMission(s,.02);return s.enemies[0].hp;}
 assert.ok(hp(true)<hp(false));
});
test('new S/F kill counters and fusion discoveries persist through payout and reload',()=>{
 const b=begun();b.run.stats.weaponKills.s=160;b.run.stats.weaponKills.f=170;b.run.stats.union=true;b.run.stats.unionIds=['n'];endMission(b.run,'retreat');const p=settleRun(b.profile,b.run).profile,loaded=parseProfile(JSON.stringify(p));assert.equal(loaded.progress.weaponKills.s,160);assert.equal(loaded.progress.weaponKills.f,170);assert.deepEqual(loaded.progress.fusions,['n']);assert.ok(researchReady(loaded,'s-flechette'));assert.ok(researchReady(loaded,'f-catalyst'));assert.equal(loaded.progress.unions,0);
});
test('new recipe research remains compatible after fusion and ingredients are excluded from later supplies',()=>{
 const s=begun().run;s.weapons=[{id:'n',rank:3,evolved:true,mods:[],cd:0,shots:0},null];s.snapshot.researched=['f-catalyst'];s.snapshot.freshMods=['f-catalyst'];assert.equal(availableUpgrades(s)[0].id,'mod:f-catalyst');const node=s.sites[0];s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);for(const e of s.enemies)if(e.siteId===node.id)e.dead=true;stepMission(s,dt);assert.ok(s.choices.filter(c=>c.kind==='weapon').every(c=>!['f','r'].includes(c.weapon)));
});
test('carrier rewards attacking the exposed rear while the final core rejects damage until it opens',()=>{
 function loss(front,mode,rear){const s=begun().run;quiet(s);s.front=front;s.stage='boss';s.boss.active=true;s.boss.hp=10000;s.boss.parts.forEach(p=>p.hp=0);s.boss.mode=mode;s.boss.timer=9;s.boss.coreOpen=mode==='expose'?4:0;s.boss.angle=Math.PI/2;s.player.x=s.boss.x;s.player.y=s.boss.y+(rear?-180:180);s.player.invuln=99;s.weapons[0].rank=3;s.weapons[0].evolved=true;s.weapons[0].cd=0;step(s,.25);return 10000-s.boss.hp;}
 assert.ok(loss(0,'recover',true)>loss(0,'recover',false)*3);assert.equal(loss(2,'walk',false),0);assert.ok(loss(2,'expose',false)>0);
});
test('artillery lanes preserve the advertised safe corridor and losing a side cannon removes its lanes',()=>{
 function scene(broken){const s=begun().run;quiet(s);s.front=1;s.stage='boss';s.boss.active=true;s.boss.mode='walk';s.boss.timer=0;if(broken)s.boss.parts[0].hp=0;s.player.invuln=99;stepMission(s,dt);return s;}
 const both=scene(false),one=scene(true);assert.ok(both.hazards.length>one.hazards.length);assert.ok(both.hazards.every(h=>h.shape==='beam'&&Math.abs(h.x-both.boss.safeX)>h.width));
});
test('each boss runs a different attack state sequence without adding waiting gates to the map',()=>{
 const seen=[];for(let front=0;front<3;front++){const s=begun().run;quiet(s);s.front=front;s.stage='boss';s.boss.active=true;s.boss.mode='walk';s.boss.timer=0;s.player.x=450;s.player.y=s.boss.y+280;s.player.invuln=99;s.weapons[0].cd=99;const modes=new Set();for(let i=0;i<720;i++){stepMission(s,dt);modes.add(s.boss.mode);}seen.push(modes);}
 assert.ok(seen[0].has('charge'));assert.ok(!seen[1].has('charge'));assert.ok(!seen[1].has('sweep'));assert.ok(seen[2].has('sweep-windup'));assert.ok(seen[2].has('sweep'));
});
test('0.13 recovery retains its extended economic contract after the ruleset changes',()=>{
 const input={rules:'operation-0.13.0',kills:3000,midbosses:2,armorBreaks:6,outposts:6};assert.deepEqual(calculateSettlement(input),calculateSettlement({...input,rules:RULESET}));const old=createProfile();old.progress.unions=1;delete old.progress.fusions;assert.deepEqual(parseProfile(JSON.stringify(old)).progress.fusions,['u']);
});
test('a weapon offer lets the player choose a slot or cancel without deleting an invested gun',()=>{
 const s=begun().run;s.weapons[0].rank=3;s.weapons[1]={id:'h',rank:2,evolved:false,mods:['h-capacitor'],cd:0,shots:0};s.phase='choice';s.choiceType='supply';s.choices=[{id:'offer:f',kind:'weapon-offer',weapon:'f'}];const before=structuredClone(s.weapons);assert.ok(chooseMission(s,'offer:f'));assert.equal(s.choiceType,'replace');assert.equal(s.choices.length,3);assert.doesNotThrow(()=>restoreMission(packMission(s)));assert.ok(chooseMission(s,'keep'));assert.deepEqual(s.weapons,before);
 s.phase='choice';s.choices=[{id:'offer:f',kind:'weapon-offer',weapon:'f'}];chooseMission(s,'offer:f');assert.ok(chooseMission(s,'weapon:f:0'));assert.equal(s.weapons[0].id,'f');assert.deepEqual(s.weapons[1],before[1]);
});
test('conductor research marks a rocket target and increases the other gun damage',()=>{
 function damageAfter(mod){const s=begun().run;quiet(s);const template=begun().run.enemies[0];s.player.x=0;s.player.y=0;s.weapons=[{id:'r',rank:0,evolved:false,mods:mod?['r-conductor']:[],cd:99,shots:0},null];s.enemies=[{...template,id:790,x:90,y:0,hp:1000,speed:0,timer:999}];const shot={id:1,x:70,y:0,vx:1000,vy:0,angle:0,weapon:'r',tags:['r'],damage:1,pierce:1,hits:[],life:1,rocket:true,blast:50};s.shots=[shot];stepMission(s,.02);const before=s.enemies[0].hp;s.shots=[{...shot,id:2,weapon:'p',tags:['p'],rocket:false,damage:20,hits:[]}];stepMission(s,.02);return before-s.enemies[0].hp;}
 assert.equal(damageAfter(false),20);assert.equal(damageAfter(true),25);
});
test('new fusion clear orders pay once and their discoveries survive profile reload',()=>{
 const b=begun();b.run.stats.union=true;b.run.stats.unionIds=['v'];endMission(b.run,'victory');const one=settleRun(b.profile,b.run);assert.ok(one.profile.orders.includes('breacher-clear'));assert.ok(!one.profile.orders.includes('napalm-clear'));assert.ok(one.receipt.award.orders.some(o=>o.id==='breacher-clear'&&o.credits===180));assert.ok(parseProfile(JSON.stringify(one.profile)).progress.fusions.includes('v'));
});
test('incomplete boss physics and beam saves are rejected instead of resuming a frozen fight',()=>{
 const s=begun().run;for(const key of ['timer','angle','coreOpen','cycle','maxHp']){const raw=packMission(s);delete raw.boss[key];assert.throws(()=>restoreMission(raw));}const raw=packMission(s);delete raw.boss.parts[0].ox;assert.throws(()=>restoreMission(raw));for(const field of ['r','hit']){const saved=packMission(s);saved.hazards=[{shape:'beam',x:0,y:0,x2:0,y2:300,width:60,r:60,timer:1,life:1.2,hit:false}];delete saved.hazards[0][field];assert.throws(()=>restoreMission(saved));}
});
test('carrier side shots do not receive the rear engine bonus',()=>{
 function loss(side){const s=begun().run;quiet(s);s.stage='boss';s.boss.active=true;s.boss.hp=10000;s.boss.parts.forEach(p=>p.hp=0);s.boss.mode='recover';s.boss.timer=9;s.boss.angle=Math.PI/2;s.player.x=side?180:0;s.player.y=s.boss.y+(side?0:-180);s.player.invuln=99;s.weapons[0].rank=3;s.weapons[0].cd=0;step(s,.25);return 10000-s.boss.hp;}assert.ok(loss(false)>loss(true)*3);
});
test('artillery core becomes progressively weaker after one and two cannon breaks',()=>{
 function loss(broken){const s=begun().run;quiet(s);s.front=1;s.stage='boss';s.boss.active=true;s.boss.hp=10000;s.boss.parts.forEach((p,i)=>{p.hp=i<broken?0:p.maxHp;p.ox=i===0?-500:500;});s.boss.mode='recover';s.boss.timer=9;s.player.x=0;s.player.y=s.boss.y+180;s.player.invuln=99;s.weapons[0].cd=99;s.shots=[{id:1,x:0,y:s.boss.y+80,vx:0,vy:-1000,angle:-Math.PI/2,weapon:'p',tags:['p'],damage:100,pierce:1,hits:[],life:1}];step(s,.05);return 10000-s.boss.hp;}assert.ok(loss(0)<loss(1));assert.ok(loss(1)<loss(2));
});
test('suppression also reduces final-boss mortar salvos, not only the railway lanes',()=>{
 function count(suppressed){const s=begun().run;quiet(s);s.front=2;s.stage='boss';s.boss.active=true;s.boss.mode='walk';s.boss.timer=0;s.boss.suppressed=suppressed;s.player.invuln=99;stepMission(s,dt);return s.hazards.length;}assert.equal(count(false),3);assert.equal(count(true),1);
});
