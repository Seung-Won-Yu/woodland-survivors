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
 const b=begun();b.run.stats={...b.run.stats,kills:1000,elites:2,rescues:3,outposts:1,armorBreaks:2};b.run.t=360;endMission(b.run,'victory');const one=settleRun(b.profile,b.run);assert.equal(one.profile.wallet,980);
 const second=beginRun(one.profile,{hero:'fio',difficulty:'dense',seed:71});assert.ok(second.ok);const run=createMission(second.descriptor);run.stats={...run.stats,kills:1000,elites:2,rescues:3,outposts:1,armorBreaks:2};run.t=360;endMission(run,'victory');const two=settleRun(second.profile,run);assert.equal(two.receipt.award.oneTime.clear,0);assert.equal(two.receipt.award.oneTime.report,0);assert.equal(two.receipt.award.repeatCredits,Math.floor(680*1.15));
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
test('an empty support slot always offers both missing guns, so Fio can deliberately build H/R',()=>{
 for(const seed of [17,71]){const s=begun('fio',seed).run,node=s.sites[0];s.player.x=node.x;s.player.y=node.y;stepMission(s,dt);for(const e of s.enemies)if(e.siteId===node.id){e.dead=true;e.deathLife=0;}stepMission(s,dt);assert.deepEqual(s.choices.filter(c=>c.kind==='weapon').map(c=>c.weapon),['p','r']);assert.ok(chooseMission(s,'weapon:r:1'));assert.equal(s.weapons[1].id,'r');}
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
 const s=begun().run;quiet(s);s.stage='boss';s.boss.active=true;s.boss.hp=1;s.boss.parts.forEach(p=>p.hp=0);s.boss.mode='recover';s.boss.timer=9;s.player.x=s.boss.x+110;s.player.y=s.boss.y;s.player.invuln=99;s.weapons[0].rank=3;s.weapons[0].evolved=true;s.weapons[0].cd=0;
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
