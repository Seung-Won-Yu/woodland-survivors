import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyView,reportView} from '../src/reboot/interface.js';
import {emptyProfile,beginProfile,settleProfile,createStore} from '../src/reboot/profile.js';
import {createOperation,finish} from '../src/reboot/model.js';

test('mission briefing does not select a later starting map, and saved operations offer a fresh sortie',()=>{
 const p=emptyProfile(),html=lobbyView(p,{brief:2});
 assert.match(html,/heading|작전 지령/);assert.match(html,/data-action="launch">피오 · 새 출격/);
 const run=createOperation(17);run.operation.region=1;const active=beginProfile(p,run),view=lobbyView(active);
 assert.match(view,/data-action="launch">피오 · 새 출격/);
 assert.match(view,/이전 판은 확보 성과를 정산/);assert.doesNotMatch(view,/data-action="resume-run"/);
});
test('research makes condition, funds, active-run block and owned trial explicit',()=>{
 const p=emptyProfile();let html=lobbyView(p,{tab:'research'});assert.match(html,/실증 조건 미달/);
 p.milestones.medic=true;p.credits=299;html=lobbyView(p,{tab:'research'});assert.match(html,/1C 부족/);
 p.credits=300;html=lobbyView(p,{tab:'research'});assert.match(html,/<button  class="primary" data-research="medic">300C · 연구/);
 p.research=['medic'];p.trials=['medic'];html=lobbyView(p,{tab:'research'});assert.match(html,/새 연구 · 조건에 맞는 첫 보급에서 제시/);assert.match(html,/disabled[^>]*data-research="medic"/);
 const active=beginProfile(emptyProfile(),createOperation(17));assert.match(lobbyView(active,{tab:'research'}),/이전 판을 정산한 뒤/);
});
test('settled reports lead to affordable research and preserve exact replay seed',()=>{
 const run=createOperation(17);let p=beginProfile(emptyProfile(),run);run.operation.cleared=3;run.operation.extracted=true;run.stats.bossKilled=true;finish(run,true);p=settleProfile(p,run);
 const html=reportView(p.recent[0],p);assert.match(html,/data-target="research"/);assert.match(html,/data-action="same-seed" data-seed="17"/);assert.match(html,/첫 완주 보너스 200C 포함/);
 const old={...p.recent[0],balanceRevision:'old-rules'};assert.doesNotMatch(reportView(old,p),/첫 완주 보너스/);
 assert.match(reportView(p.recent[0],p,{archived:true}),/data-target="archive"/);
 const withActive=beginProfile(p,createOperation(18)),archived=reportView(p.recent[0],withActive,{archived:true});
 assert.match(archived,/data-action="same-seed" data-seed="17"/);assert.doesNotMatch(archived,/저장한 작전 계속/);
});
test('history handles empty states and escapes externally readable migration notes',()=>{
 const p=emptyProfile();assert.match(lobbyView(p,{tab:'archive'}),/첫 보고서를 기다립니다/);
 p.migrationNotice='<img src=x onerror=alert(1)>';const html=lobbyView(p);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
 assert.doesNotMatch(html,/<main/);
});

test('unreadable historical reports cannot crash archive or report navigation',()=>{
 const p=emptyProfile();p.recent=[null,{sequence:1,weapons:null},{sequence:2,weapons:[]}];
 const html=lobbyView(p,{tab:'archive'});assert.match(html,/읽을 수 없는 이전 보고서/);assert.match(html,/첫 보고서를 기다립니다/);
 assert.match(reportView(p.recent[1],p),/이 보고서를 읽지 못했습니다/);
});

import {choiceDetails,isQuickMod} from '../src/reboot/choice-details.js';
import {fieldScene,sitePresentation,regionPreview} from '../src/reboot/field-scene.js';
import {snapshot} from '../src/reboot/model.js';

test('upgrade previews expose the opening rifle breakpoint without mutating the run',()=>{
 const run=createOperation(17),before=snapshot(run),d=choiceDetails(run,{id:'rank:h',kind:'rank',weapon:'h',title:'H L2',desc:'피해12→14'});
 assert.equal(d.impact,'연사 화력 +17%');assert.match(d.detail,/일반병 직격 3 → 2발/);assert.match(d.link,/L4 분화까지 2회/);assert.deepEqual(run,before);
 run.pressure=2;assert.doesNotMatch(choiceDetails(run,{kind:'rank',weapon:'h'}).detail,/3 → 2발/);
});
test('field supply previews show the firing role, branch and real slot consequence',()=>{
 const run=createOperation(17),d=choiceDetails(run,{id:'gun:f',kind:'gun',weapon:'f',title:'F',desc:'새 공격'});
 assert.match(d.impact,/부채 화염/);assert.match(d.link,/연료 살포.*압축 분사/);assert.match(d.cost,/공격 한 칸/);
 run.weapons.push({id:'r',level:1},{id:'f',level:1});assert.match(choiceDetails(run,{kind:'gun',weapon:'f'}).cost,/기존 총 교체/);
});
test('medical and ammunition previews respect current health and charge caps',()=>{
 const run=createOperation(17);run.player.hp=68;run.player.charge=97;
 assert.equal(choiceDetails(run,{id:'utility:health',kind:'utility'}).detail,'68/100 → 74/106');
 assert.equal(choiceDetails(run,{id:'utility:charge',kind:'utility'}).impact,'전탄 충전 +3');
 run.player.charge=100;assert.equal(choiceDetails(run,{id:'utility:charge',kind:'utility'}).impact,'전탄 충전 최대');
});
test('only simple opening levels use the compact field menu',()=>{
 const run=createOperation(17);run.choice={type:'level'};run.level=2;assert.equal(isQuickMod(run),true);
 run.modules=[{id:'coil',rank:1}];assert.equal(isQuickMod(run),false);run.modules=[];run.level=4;assert.equal(isQuickMod(run),false);
});
test('briefings share distinct field terrain and recognizable site symbols',()=>{
 assert.equal(fieldScene(0).water,'#365766');assert.ok(fieldScene(1).rails.length);assert.equal(fieldScene(1).water,null);assert.equal(fieldScene(2).water,'#234b5e');
 const run=createOperation(17),html=regionPreview(0,17);for(const site of run.sites)assert.ok(html.includes(`translate(${site.x} ${site.y})`));
 assert.equal(sitePresentation(run.sites[0]).name,'포로 구출');assert.equal(sitePresentation(run.sites[1]).icon,'truck');
});

test('all weapon level previews describe the changed firing property and branch-specific evolution',()=>{
 const run=createOperation(17);
 for(const id of ['h','r','f'])for(let level=1;level<6;level++){const branch=id==='h'?'ricochet':id==='r'?'homing':'trail';run.weapons=[{id,level,branch:level>=4?branch:null}];const d=choiceDetails(run,{kind:'rank',weapon:id});assert.ok(d.impact);assert.ok(!d.impact.includes('undefined'));}
 run.weapons=[{id:'r',level:1,branch:null}];assert.match(choiceDetails(run,{kind:'rank',weapon:'r'}).impact,/폭발 반경/);
 run.weapons=[{id:'r',level:5,branch:'incendiary'}];assert.match(choiceDetails(run,{kind:'rank',weapon:'r'}).link,/코일2 또는 촉매 연료2/);
 run.weapons[0].branch='homing';assert.doesNotMatch(choiceDetails(run,{kind:'rank',weapon:'r'}).link,/촉매/);
});
test('mixed supply and planned lobby geography show the actual capped outcome',()=>{
 const run=createOperation(18);run.player.hp=95;run.player.charge=97;const d=choiceDetails(run,{kind:'resupply',id:'resupply:mixed',heal:20,charge:20});assert.equal(d.impact,'체력 +5 · 충전 +3');
 for(const seed of [17,18]){const html=lobbyView(emptyProfile(),{seed});const actual=createOperation(seed);for(const n of actual.sites)assert.ok(html.includes(`translate(${n.x} ${n.y})`));}
});

test('browser terrain caches rebuild per region and physical objects sort around the player',async()=>{
 const {createRenderer}=await import('../src/reboot/render.js'),saved={innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight,devicePixelRatio:globalThis.devicePixelRatio},fills=[];let caches=0;
 const context=record=>new Proxy({fillRect(...args){if(record)fills.push(args);},measureText:t=>({width:t.length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),main=context(true),canvas={getContext:()=>main,ownerDocument:{createElement:()=>{caches++;return{getContext:()=>context(false)};}}};
 try{Object.assign(globalThis,{innerWidth:960,innerHeight:540,devicePixelRatio:1});const renderer=createRenderer(canvas,null),run=createOperation(17);renderer.draw(run);renderer.draw(run);assert.equal(caches,1);
  run.operation.region=1;run.player.x=800;run.player.y=650;run.enemies=[];run.sites=[{id:'test',kind:'supply',x:1100,y:700,state:'waiting'}];run.blocks=[{x:1000,y:580,w:100,h:80,hp:-1}];fills.length=0;renderer.draw(run);assert.equal(caches,2);const index=(x,y)=>fills.findIndex(a=>a[0]===x&&a[1]===y);assert.ok(index(787,606)>=0);assert.ok(index(787,606)<index(1000,562));assert.ok(index(1000,562)<index(1075,670));renderer.draw(run);assert.equal(caches,2);
 }finally{for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});

import {createOperationPlan} from '../src/reboot/operation-plan.js';
import {holdoutParts} from '../src/reboot/campaign.js';
test('a failed launch keeps its briefing, and retry success consumes the plan exactly once',async()=>{
 let value=null,fail=true,calls=0;const store=createStore({getItem:()=>value,setItem(k,v){if(fail){fail=false;throw Error('disk full');}value=v;}}),plan=createOperationPlan(()=>[17,18,19][calls++]),run=createOperation(plan.seed),previous=store.get(),next=beginProfile(previous,run);
 await assert.rejects(store.commit(next),/disk full/);assert.equal(plan.seed,17);
 await store.commit(next);plan.committed(previous,next,run);assert.equal(plan.seed,18);
 finish(run,false);const beforeSettle=store.get(),settled=settleProfile(beforeSettle,run);await store.commit(settled);plan.committed(beforeSettle,settled,run);assert.equal(plan.seed,18);assert.equal(createOperation(plan.seed).seed,18);assert.equal(calls,2);
});

test('lobby briefing uses the new operation plan even with a prior active checkpoint',()=>{
 const s=createOperation(17);s.player.x=900;s.player.y=990;s.operation.region=1;s.weapons[0].level=5;
 const html=lobbyView(beginProfile(emptyProfile(),s),{seed:18});
 assert.match(html,/투입 지점/);assert.doesNotMatch(html,/현재 위치|<small>L5<\/small>/);
 for(const site of createOperation(18).sites)assert.ok(html.includes(`translate(${site.x} ${site.y})`));
});
test('fresh launch avoids the previous beach route, including after reload and same-seed replay',()=>{
 const plan=createOperationPlan(()=>21,17);
 assert.notEqual(plan.seed%4,17%4);
 const replay=createOperation(17),previous=emptyProfile(),next=beginProfile(previous,replay);
 plan.committed(previous,next,replay);
 assert.notEqual(plan.seed%4,replay.seed%4);
 assert.notDeepEqual(holdoutParts(plan.seed,0),holdoutParts(replay.seed,0));
 const sameDraft=createOperationPlan(()=>19,16);
 assert.notDeepEqual(holdoutParts(sameDraft.seed,0),holdoutParts(16,0));
 assert.notDeepEqual(holdoutParts(sameDraft.seed,1),holdoutParts(16,1));
 assert.ok(plan.seed>=0&&plan.seed<=0xffffffff);
});
