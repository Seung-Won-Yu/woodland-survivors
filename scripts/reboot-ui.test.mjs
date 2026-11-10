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
 assert.match(html,/실전 배치 지령/);assert.match(html,/data-action="launch">실전 시험 출격/);
 const active=beginProfile(emptyProfile(),createOperation(17));assert.match(lobbyView(active,{tab:'research'}),/이전 판을 정산한 뒤/);
});
test('field-tested equipment can be reserved on the rail briefing without adding fees to replay',()=>{
 const p=emptyProfile();p.research=['shrapnel'];p.credits=119;
 assert.match(lobbyView(p,{tab:'research'}),/data-reserve="shrapnel" disabled>1C 부족/);
 p.credits=120;
 assert.match(lobbyView(p,{tab:'research'}),/정비대 예약 · 120C/);
 const briefing=lobbyView(p,{brief:1,requisition:'shrapnel'});
 assert.match(briefing,/data-requisition="shrapnel"/);assert.match(briefing,/출격 시 −120C/);
 assert.doesNotMatch(lobbyView(p),/data-requisition=/);
 const run=createOperation(17,['shrapnel']);run.operation.requisition='shrapnel';
 const active=beginProfile(p,run);finish(run,false);
 const settled=settleProfile(active,run),html=reportView(settled.recent[0],settled);
 assert.match(html,/철도 정비대 · 미회수/);assert.match(html,/다음 장비 예약/);
 assert.match(html,/같은 전장 · 표준 작전/);assert.doesNotMatch(html,/data-requisition=/);
});
test('reports distinguish this sortie unlocks from prior availability and show first field results',()=>{
 const run=createOperation(17);let p=beginProfile(emptyProfile(),run);
 run.operation.cleared=1;run.stats.fusionBosses=1;finish(run,false);p=settleProfile(p,run);
 const html=reportView(p.recent[0],p);
 assert.match(html,/이 작전에서 해금/);assert.match(html,/분열 수류탄/);assert.match(html,/260C 부족/);
 const next=createOperation(18);p=beginProfile({...p,credits:400},next);next.stats.researchTrialsPicked=['thermal','shrapnel'];
 next.stats.shrapnelHits=11;next.stats.shrapnelKills=3;next.stats.thermalRecovered=1.25;
 finish(next,false);p=settleProfile(p,next);
 const report=reportView(p.recent[0],p);
 assert.doesNotMatch(report,/이 작전에서 해금/);
 assert.match(report,/파편 적중 11회 · 처치 3명/);assert.match(report,/전탄 충전 \+1\.3/);
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
import {fieldScene,sitePresentation,regionPreview,previewLayout} from '../src/reboot/field-scene.js';
import {paintBlock} from '../src/reboot/field-art.js';
import {FIELD} from '../src/reboot/content.js';
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
test('briefings show matching seeded arrival routes and mirror the railway',()=>{
 const rail=regionPreview(1,19),port=regionPreview(2,19);
 assert.match(rail,/data-approach="rail-cache"/);
 assert.match(rail,/data-approach="rail-relay"/);
 assert.match(port,/data-approach="port-landing"/);
 assert.match(port,/data-approach="port-control"/);
 assert.match(port,/<circle cx="720" cy="1040"/);
 assert.deepEqual(fieldScene(1,19).rails[2][0],[900,1190]);
 assert.deepEqual(fieldScene(1,58).rails[2][0],[700,1190]);
 const rail17=lobbyView(emptyProfile(),{brief:1,seed:17}),rail19=lobbyView(emptyProfile(),{brief:1,seed:19});
 assert.match(rail17,/화차 정비대 · 방패 검문/);assert.match(rail17,/통신 중계기 · 박격포 경계/);
 assert.match(rail19,/화차 정비대 · 박격포 경계/);assert.match(rail19,/통신 중계기 · 방패 검문/);
});
test('briefings share distinct field terrain and recognizable site symbols',()=>{
 assert.equal(fieldScene(0).water,'#365766');assert.ok(fieldScene(1).rails.length);assert.equal(fieldScene(1).water,null);assert.equal(fieldScene(2).water,'#234b5e');
 const run=createOperation(17),html=regionPreview(0,17);for(const site of run.sites)assert.ok(html.includes(`translate(${site.x} ${site.y})`));
 assert.equal(sitePresentation(run.sites[0]).name,'포로 구출');assert.equal(sitePresentation(run.sites[1]).icon,'truck');
});
test('coastal tracks connect the actual sites through clear ground and water starts at the field edge',()=>{
 for(let seed=16;seed<20;seed++){
  const {tracks,shapes,water}=fieldScene(0,seed),{sites,blocks}=previewLayout(seed,0),html=regionPreview(0,seed);
  const [rescue,truck,,battery]=sites.map(({x,y})=>[x,y]);
  assert.deepEqual(tracks,[[[800,1040],rescue],[rescue,truck],[rescue,battery]]);
  assert.ok(shapes.some(s=>s.type==='rect'&&s.y===FIELD.bottom&&s.fill===water&&s.w===1600));
  assert.ok(shapes.some(s=>s.type==='rect'&&s.x===0&&s.fill===water&&s.w===FIELD.left));
  for(const track of tracks){
   assert.ok(html.includes(`points="${track.map(p=>p.join(',')).join(' ')}"`));
   const [[ax,ay],[bx,by]]=track,steps=Math.ceil(Math.hypot(bx-ax,by-ay)/8);
   for(let i=0;i<=steps;i++){
    const x=ax+(bx-ax)*i/steps,y=ay+(by-ay)*i/steps;
    assert.ok(!blocks.some(b=>x+23>b.x&&x-23<b.x+b.w&&y+23>b.y&&y-23<b.y+b.h),`track on seed ${seed}`);
   }
  }
 }
});
test('the harbor quay follows the field boundary and bay marks follow mirrored loading sites',()=>{
 const port=fieldScene(2,19),mirror=fieldScene(2,18);
 for(const scene of [port,mirror])assert.ok(scene.shapes.some(s=>s.type==='rect'&&s.y===FIELD.bottom&&s.fill===scene.water&&s.w===1600));
 assert.deepEqual(mirror.marks,port.marks.map(([x,y,label])=>[1600-x,y,label]));
 const landing=previewLayout(19,2).sites.find(s=>s.id==='port-landing'),bay=port.marks.find(m=>m[2]==='01');
 assert.ok(Math.abs(bay[0]-landing.x)<25&&Math.abs(bay[1]-landing.y)<70);
});
test('the same harbor container uses the same art and depth limit on both mirrors',()=>{
 const calls=[],context=new Proxy({scale(x,y){calls.push({scale:y});},drawImage(...args){calls.push({sprite:args[1],height:args.at(-1)});}},{get:(o,k)=>o[k]||(()=>{})});
 const cell={sx:0,sy:0,w:100,h:90},art={environment:{image:{},rows:[null,{cells:[cell,{...cell,sx:100}]}]}};
 for(const seed of [19,18]){
  const b=previewLayout(seed,2).blocks.find(block=>block.id==='p2');
  paintBlock(context,b,2,art);
  const [scale,draw]=calls.splice(0);
  assert.equal(draw.sprite,100);
  assert.ok(Math.abs(draw.height*scale.scale-(b.h+40))<1e-9);
 }
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
  run.operation.region=1;run.player.x=800;run.player.y=650;run.enemies=[];run.sites=[{id:'test',kind:'supply',x:1100,y:700,state:'waiting'}];run.blocks=[{x:1000,y:580,w:100,h:80,hp:-1},{x:760,y:620,w:100,h:70,hp:0}];fills.length=0;renderer.draw(run);assert.equal(caches,2);
  const index=(x,y)=>fills.findIndex(a=>a[0]===x&&a[1]===y);
  assert.ok(index(764,625)>=0);assert.ok(index(764,625)<index(787,606));assert.ok(index(787,606)<index(1000,562));assert.ok(index(1000,562)<index(1075,670));
  renderer.draw(run);assert.equal(caches,2);
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

test('the post-clear order dock previews the correct field site and never silently opts in',()=>{
 const p=emptyProfile();assert.doesNotMatch(lobbyView(p),/추가 작전 지령/);
 p.records.wins=1;p.credits=600;
 const normal=lobbyView(p);assert.match(normal,/추가 작전 지령/);assert.doesNotMatch(normal,/data-sortie=/);
 const wire=lobbyView(p,{seed:19,order:'wire'});assert.match(wire,/data-sortie="wire"/);
 assert.match(wire,/data-order-pin="wire"/);assert.match(wire,/해안 통신소/);assert.match(wire,/70C 선납.*최종 귀환 \+180C/);
 const convoy=lobbyView(p,{seed:19,order:'convoy'});assert.match(convoy,/data-sortie="convoy"/);
 assert.match(convoy,/data-order-pin="convoy"/);assert.match(convoy,/경량 보급차 저지/);
 p.credits=69;const poor=lobbyView(p,{order:'wire'});assert.doesNotMatch(poor,/data-sortie=/);assert.match(poor,/1C 부족/);
});

test('the sortie board exposes both operators and the selected specialist and avoids resetting order records',()=>{
 const p=emptyProfile();
 const fio=lobbyView(p);assert.match(fio,/data-pilot="fio" aria-pressed="true"/);assert.match(fio,/피오 · 새 출격/);
 p.records.wins=1;p.credits=100;
 const marco=lobbyView(p,{operator:'marco',order:'wire'});
 assert.match(marco,/data-pilot="marco" aria-pressed="true"/);
 assert.ok(marco.indexOf('data-pilot=')<marco.indexOf('data-action="launch"'));
 assert.match(marco,/마르코 · 지령 출격/);assert.match(marco,/마지막 방향을 유지/);
 assert.match(marco,/관통 사격 E/);assert.match(marco,/마르코 출격 준비 모습/);
});
