import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyView,reportView,replayBriefingView,gatePace,railHandoff,railTransferBrief} from '../src/reboot/interface.js';
import {emptyProfile,beginProfile,settleProfile,createStore,freshSortie,buyResearch,parseProfile} from '../src/reboot/profile.js';
import {createOperation,finish} from '../src/reboot/model.js';
import {aidBearingPosition,coastCuePosition,coveredCombatPanels} from '../src/reboot/render.js';
import {portEscapeLanes,portBuildApproach,frontTactic,portTacticKeys} from '../src/reboot/campaign.js';
import {makeWeapon} from '../src/reboot/content.js';

test('rail handoff distinguishes a weapon from cargo, an unrecovered wreck and a destroyed mount',()=>{
 const s=createOperation(27,[],null,null,'fio','standard');
 const coast=s.operation.coastSalvage;
 s.stage='holdout';
 coast.turret='intact';
 assert.equal(railHandoff(s).state,'wreck');
 coast.turret='secured';
 assert.match(railHandoff(s).detail,/현재 무장으로 교전.*철도 생존 귀환/);
 assert.equal(railHandoff(s).state,'cargo');
 assert.equal(railHandoff(s).gateNote,'노획 포탑 운반 중');
 assert.equal(railHandoff(s).route,undefined);
 s.weapons.push({id:'r',level:6,branch:'homing',evolved:true,capturedTurret:true});
 assert.equal(railHandoff(s).title,'광각 포탑 L6 이월');
 assert.match(railHandoff(s).detail,/7발/);
 assert.equal(railHandoff(s).route,'rail-cache');
 assert.match(railHandoff(s).gateNote,/포탑 L6.*화차 정비대/);
 s.weapons.pop();
 coast.turret='broken';
 assert.equal(railHandoff(s).state,'broken');
 assert.equal(railHandoff(s).route,'rail-relay');
 s.operation.nextSupport='vanguard';
 assert.match(railHandoff(s).detail,/후송 정비.*이월/);
});

test('the rail transfer briefing mirrors the first move and keeps carried cargo distinct from a mount',()=>{
 const s=createOperation(27,[],null,null,'fio','standard');
 s.stage='holdout';
 s.operation.coastSalvage.turret='secured';
 const cargo=railHandoff(s);
 assert.equal(railTransferBrief(27,cargo), '');
 const mount={title:'노획 포탑 L4'};
 assert.match(railTransferBrief(27,cargo,mount),/data-transfer-route="rail-cache".*<\/i> 화차 정비대/s);
 assert.match(railTransferBrief(27,cargo,mount),/aria-label="오른쪽">→<\/i>.*양쪽 대열에 일제사격/s);
 assert.match(railTransferBrief(27,cargo,mount),/data-rail-transfer-pad.*양쪽 대열에 일제사격.*열차 정면에서 양쪽 포격 차단/s);
 assert.match(railTransferBrief(28,cargo,mount),/aria-label="왼쪽">←<\/i>.*양쪽 대열에 일제사격/s);
 s.operation.coastSalvage.turret='broken';
 const broken=railHandoff(s);
 assert.match(railTransferBrief(27,broken),/data-transfer-route="rail-relay".*↖<\/i>.*교신으로 열차 조준 유인/s);
 assert.match(railTransferBrief(27,broken),/후방 박격포 먼저 제압.*교신으로 열차 조준 유인/s);
 assert.doesNotMatch(railTransferBrief(27,broken),/data-rail-transfer-pad/);
 assert.match(railTransferBrief(28,broken),/↗<\/i>.*교신으로 열차 조준 유인/s);
});

test('the harbor forecast matches the mounted build and the actual control tactic',()=>{
 const s=createOperation(27,[],null,null,'fio','turret');
 s.operation.region=1;
 assert.equal(portBuildApproach(s),null);
 Object.assign(s.weapons[0],{level:6,branch:'homing',evolved:true});
 const wide=portBuildApproach(s);
 assert.equal(wide.key,'crossfire');
 assert.match(wide.position,/정면 20m/);
 s.operation.region=2;
 assert.ok(portTacticKeys(s).includes(wide.key));
 assert.equal(frontTactic(s,wide.key).name,wide.name);

 s.weapons=[{...makeWeapon('h'),level:6,branch:'ricochet',evolved:true,fusion:{secondary:'r',branch:'homing',overflow:0}}];
 const fusion=portBuildApproach(s);
 assert.equal(fusion.key,'signal');
 assert.match(fusion.position,/측면 22m 이상/);
 assert.notEqual(fusion.color,wide.color);
 assert.ok(portTacticKeys(s).includes(fusion.key));
 s.operation.tactic='signal';
 assert.equal(frontTactic(s).name,fusion.name);
 assert.match(frontTactic(s).hint,/좌우로 이동/);
 s.weapons[0].fusion.branch='incendiary';
 assert.equal(portBuildApproach(s),null);
 assert.equal(frontTactic(s).name,'포탑 교신 탈취');
});

test('portrait HUD clearance uses confirmed contact and live warning shapes without covering holdout actions',()=>{
 const box=(id,left,top,right,bottom)=>({id,rect:{left,top,right,bottom}});
 const panels=[box('map-panel',224,112,308,192),box('weapons',12,324,102,372),box('field-objective',12,112,202,208),box('field-feedback',122,280,254,314)];
 const project=(x,y)=>({x,y});
 const relay={type:'payload-impact',relayArrival:true,contact:{x:306,y:190},age:.03,life:.4};
 const mortar={x:133,y:230,r:30,timer:.4};
 const covered=(effects,hazards,stage='field')=>coveredCombatPanels({stage,effects,hazards},panels,project,1);
 assert.deepEqual(covered([relay],[mortar]),['map-panel','field-objective']);
 assert.deepEqual(covered([relay],[mortar],'holdout'),['map-panel']);
 assert.deepEqual(covered([{...relay,age:.3}],[{...mortar,hit:true}]),[]);
 assert.deepEqual(covered([{...relay,relayArrival:false}],[]),[]);
 assert.deepEqual(covered([{...relay,contact:{x:328,y:207}}],[]),[]);
 assert.deepEqual(covered([{type:'fire-spread',x2:82,y2:364,age:.04,life:.25}],[]),['weapons']);
 assert.deepEqual(covered([{type:'quad-contact',x:102,y:371,age:.03,life:.24}],[]),['weapons']);
 assert.deepEqual(covered([{type:'quad-contact',x:102,y:371,age:.16,life:.24}],[]),[]);
 assert.deepEqual(covered([{type:'formation',x:92,y:360,age:.2},{type:'formation',x:225,y:135,age:.2}],[]),['weapons']);
 assert.deepEqual(covered([{type:'formation',x:225,y:135,age:.2,focused:true}],[]),['map-panel','field-objective']);
 assert.deepEqual(covered([{type:'formation',x:92,y:360,age:.5}],[]),[]);
 assert.deepEqual(covered([{type:'wake-flash',x:24,y:348,x2:136,y2:272,r:21,age:.02,life:.42}],[]),['weapons','field-feedback']);
 assert.deepEqual(covered([],[{x:280,y:230,w:20,h:220,lane:true,timer:.7}]),['map-panel']);
});

test('harbor escape chevrons follow live rounds and omit paths through cover',()=>{
 const s={player:{x:800,y:450},blocks:[],boss:null};
 const round=(portRound,dx,dy)=>({portRound,x:800+dx,y:450+dy,r:58});
 const lock=round('lock',0,0);
 const vertical=[lock,round('battery',0,-114),round('battery',0,114)];
 const turrets=[round('turret',116,-54),round('turret',116,54)];
 const horizontal=[lock,round('rake',-114,0),round('rake',114,0)];
 const labels=rounds=>portEscapeLanes(s,rounds).map(lane=>lane.label);
 assert.deepEqual(labels([...vertical,...turrets]),['왼쪽']);
 assert.deepEqual(labels(vertical),['왼쪽','오른쪽']);
 assert.deepEqual(labels([...horizontal,...turrets]),['위','아래']);
 assert.deepEqual(labels(vertical.slice(1)),[]);
 assert.deepEqual(labels([lock]),['왼쪽']);
 s.boss={active:true,x:690,y:498,r:65};
 assert.deepEqual(labels([...vertical,...turrets]),['왼쪽 위']);
 s.boss=null;
 s.blocks=[{x:740,y:405,w:22,h:90,hp:-1}];
 assert.deepEqual(labels([...vertical,...turrets]),[]);
 assert.deepEqual(labels(vertical),['오른쪽']);
 s.player.x=885;
 assert.deepEqual(labels(vertical),[]);
});

test('harbor escape points clear every remaining circle without entering a fresh one',()=>{
 const round=(portRound,x,y)=>({portRound,x,y,r:58});
 const lock=round('lock',800,450),rake=round('rake',914,450);
 const s={player:{x:850,y:450},blocks:[],boss:null};
 const [afterCounter]=portEscapeLanes(s,[rake]);
 assert.equal(afterCounter.label,'왼쪽');
 assert.equal(afterCounter.reach,20);
 assert.deepEqual(portEscapeLanes({...s,player:{x:840,y:450}},[rake]),[]);
 const outer=round('turret',833,415),inner=round('turret',850,450);
 const [outsideBoth]=portEscapeLanes(s,[outer,inner]);
 assert.ok([outer,inner].every(h=>Math.hypot(s.player.x+outsideBoth.dx*outsideBoth.reach-h.x,s.player.y+outsideBoth.dy*outsideBoth.reach-h.y)>74));
 const next={x:783,y:450,r:48};
 assert.notEqual(portEscapeLanes(s,[rake,next])[0].label,'왼쪽');
 const cover={x:790,y:432,w:30,h:35,hp:-1};
 assert.notEqual(portEscapeLanes({...s,blocks:[cover]},[rake])[0].label,'왼쪽');
 const atEdge={player:{x:60,y:450},blocks:[],boss:null};
 assert.notEqual(portEscapeLanes(atEdge,[round('battery',126,450)])[0].label,'왼쪽');
 assert.equal(portEscapeLanes(s,[lock,rake]).length,2);
});

test('harbor escape chevrons never point deeper into the drifting hull and respect stick or keys',()=>{
 const round=(portRound,x,y)=>({portRound,x,y,r:58});
 const s={player:{x:752,y:250},blocks:[],boss:{active:true,x:800,y:180,r:65}};
 const vertical=[round('lock',792,250),round('battery',792,136),round('battery',792,364),round('turret',676,196),round('turret',676,304)];
 assert.ok(!portEscapeLanes(s,vertical).some(lane=>lane.label==='오른쪽'));

 Object.assign(s.player,{x:630.36,y:132.72});
 s.boss.x=777.88;
 const hatch=[round('lock',630.36,132.72),round('battery',630.36,40),round('battery',630.36,246.72),round('turret',514.36,78.72),round('turret',514.36,186.72)];
 assert.deepEqual(portEscapeLanes(s,hatch),[]);
 assert.deepEqual(portEscapeLanes(s,hatch,true).map(lane=>lane.label),['오른쪽 위']);
});

test('mobile harbor cues move around HUD masks and live warning boxes',()=>{
 const size={w:360,h:640};
 const map={left:12,right:104,top:222,bottom:306};
 const warning={left:12,right:115,top:306,bottom:392};
 const topHud={left:12,right:348,top:112,bottom:240};
 const cue=aidBearingPosition(size,{x:41,y:234},18,80,[map,topHud],[warning]);
 assert.ok(cue&&cue.x-40>=map.right);
 assert.equal(aidBearingPosition(size,{x:155,y:234},18,80,[map],[]),null);
 const above=aidBearingPosition(size,{x:180,y:192},18,80,[topHud],[]);
 assert.ok(above&&above.y-12>=topHud.bottom);
});

test('the coastal bearing stays on the goal side of the screen and clears the real HUD',()=>{
 const size={w:320,h:568},target={x:-86,y:368},width=112;
 const masks=[{left:12,right:95,top:324,bottom:378},{left:12,right:137,top:385,bottom:433}];
 const cue=coastCuePosition(size,target,width,masks,[],46);
 assert.ok(cue.x<90&&cue.y>290);
 assert.ok(masks.every(box=>cue.y+13<=box.top||cue.y-13>=box.bottom));
 assert.deepEqual(coastCuePosition(size,{x:244,y:342},width,masks,[],46),{x:244,y:296});
 const warning={left:12,right:140,top:287,bottom:326};
 const dodged=coastCuePosition(size,target,width,masks,[warning],46);
 assert.ok(dodged.y+13<=warning.top||dodged.y-13>=warning.bottom||dodged.x-width/2>=warning.right);
});

test('mission briefing does not select a later starting map, and saved operations offer a fresh sortie',()=>{
 const p=emptyProfile(),html=lobbyView(p,{brief:2});
 assert.match(html,/heading|작전 지령/);assert.match(html,/data-action="launch">피오 · 새 출격/);
 const run=createOperation(17);run.operation.region=1;const active=beginProfile(p,run),view=lobbyView(active);
 assert.match(view,/data-action="launch"><span>피오 · 새 출격<small class="launch-checkpoint">이전 판 정산 후 시작/);
 assert.doesNotMatch(view,/data-action="resume-run"/);
});
test('the next coast map reflects research that will settle when the active run ends',()=>{
 const p={...emptyProfile(),research:['thermal'],trials:['thermal']};
 for(const recovered of [7,8]){
  const run=createOperation(17,p.research,p.trials);
  Object.assign(run.stats,{researchTrialPicked:'thermal',thermalRecovered:recovered});
  const active=beginProfile(p,run),next=freshSortie(active,19).run;
  const map=lobbyView(active,{seed:19});
  assert.equal(map.includes('data-coast-opening="preempt"'),recovered===8);
  assert.equal(!!coastOpeningGuide(next),recovered===8);
  assert.deepEqual(active.trials,['thermal']);
 }
});
test('research makes condition, funds, active-run block and owned trial explicit',()=>{
 const p=emptyProfile();let html=lobbyView(p,{tab:'research'});assert.match(html,/실증 조건 미달/);
 p.milestones.medic=true;p.credits=299;html=lobbyView(p,{tab:'research'});assert.match(html,/1C 부족/);
 p.credits=300;html=lobbyView(p,{tab:'research'});assert.match(html,/<button  class="primary" data-research="medic">300C · 연구/);
 p.research=['medic'];p.trials=['medic'];html=lobbyView(p,{tab:'research'});assert.match(html,/새 연구 · 조건에 맞는 첫 보급에서 제시/);assert.match(html,/disabled[^>]*data-research="medic"/);
 assert.match(html,/실전 배치 지령/);assert.match(html,/data-action="trial-brief">해안 브리핑 보기/);
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
 assert.match(html,/같은 전장 · 출격 준비/);
 assert.doesNotMatch(replayBriefingView(settled.recent[0],settled),/data-requisition=/);
});
test('research briefs identify both the coast delivery and the prerequisite route',()=>{
 const p=emptyProfile();p.research=['thermal','shrapnel','medic'];p.trials=['thermal'];p.credits=500;
 const research=lobbyView(p,{tab:'research'});
 assert.match(research,/data-reserve="shrapnel" data-requisition-at="coast"/);
 assert.doesNotMatch(research,/data-reserve="(?:medic|thermal)" data-requisition-at="coast"/);
 const trial=lobbyView(p);
 assert.match(trial,/class="thermal-route"[\s\S]*화염 F 확보[\s\S]*축전 코일 장착[\s\S]*흡열 코일 장착/);
 const coastal=lobbyView(p,{requisition:'shrapnel',requisitionAt:'coast'});
 assert.match(coastal,/박격포 진지 예약 · 분열 수류탄/);
 assert.match(coastal,/data-requisition="shrapnel" data-requisition-at="coast"/);
 assert.match(coastal,/예약 · 분열 수류탄/);
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
 const html=reportView(p.recent[0],p);assert.match(html,/data-target="research"/);assert.match(html,/data-action="replay-brief" data-replay-from="1"/);assert.match(replayBriefingView(p.recent[0],p),/data-action="same-seed" data-seed="17"/);assert.match(html,/첫 완주 \+200C 포함/);
 assert.match(html,/data-research="medic" data-debrief-research[^>]*>300C · 응급 주사기 연구/);
 assert.ok(html.indexOf('debrief-actions')<html.indexOf('debrief-summary'));
 assert.match(html,/전선 보스 격파<\/dt><dd>\+390C/);
 assert.match(html,/이번에 지급<\/dt><dd>\+710C/);
 assert.ok(html.indexOf('debrief-actions')<html.indexOf('debrief-details'));
 const old={...p.recent[0],balanceRevision:'old-rules',creditBreakdown:undefined};
 assert.match(reportView(old,p),/\+710/);
 assert.doesNotMatch(reportView(old,p),/첫 완주|보급 크레딧 지급 내역|최단 기록 갱신/);
 const oldSameRules=reportView({...old,balanceRevision:p.recordScope},p);
 assert.match(oldSameRules,/첫 완주 \+200C 포함/);
 assert.doesNotMatch(oldSameRules,/보급 크레딧 지급 내역/);
 assert.doesNotMatch(reportView({...p.recent[0],creditBreakdown:{...p.recent[0].creditBreakdown,firstClear:400}},p),/보급 크레딧 지급 내역/);
 assert.match(reportView(p.recent[0],p,{archived:true}),/data-target="archive"/);
 const withActive=beginProfile(p,createOperation(18)),archived=reportView(p.recent[0],withActive,{archived:true});
 assert.match(archived,/data-action="replay-brief" data-replay-from="1"/);assert.doesNotMatch(archived,/저장한 작전 계속/);
 assert.doesNotMatch(archived,/data-debrief-research|data-trial-focus|data-dispatch="requisition/);
});
test('the research experiment follows one module through trial briefing, payout and optional reservation',()=>{
 const base=emptyProfile();base.credits=500;base.research=['shrapnel'];base.trials=['shrapnel'];
 const run=createOperation(23,base.research,base.trials),active=beginProfile(base,run);
 run.stats.researchTrialsPicked=['shrapnel'];run.stats.shrapnelHits=7;
 finish(run,false);
 const pending=settleProfile(active,run),r=pending.recent[0];
 assert.match(reportView(r,pending),/이번 판 7\/8 · 파편 적중 8회/);
 assert.match(reportView(r,pending),/data-trial-focus="shrapnel"/);
 const briefing=replayBriefingView(r,pending,'standard','shrapnel');
 assert.match(briefing,/id="replay-brief-title">분열 수류탄/);
 assert.match(briefing,/파편 적중 8회 · 실증 \+120C/);
 assert.match(briefing,/data-action="same-seed" data-seed="23"/);
 assert.doesNotMatch(briefing,/data-requisition=/);
 const experiment={...pending,milestones:{coastTurret:true}};
 assert.match(lobbyView(experiment,{seed:27,loadout:'turret'}),/포로 구출 · F \/ H 보급[\s\S]*포탑으로 즉시 실증/);
 const freshBrief=replayBriefingView(r,experiment,'standard','shrapnel',{freshSeed:27,starter:'turret'});
 assert.match(freshBrief,/data-brief-route="fresh" aria-pressed="true"/);
 assert.match(freshBrief,/data-brief-starter="turret" aria-pressed="true"/);
 assert.match(freshBrief,/포로 구출 · F \/ H 보급[\s\S]*포탑으로 즉시 실증[\s\S]*박격포 진지 · 분열 수류탄 장착/);
 assert.match(freshBrief,/data-action="launch" data-actor="fio" data-coast-loadout="turret">새 전장 출격/);
 assert.doesNotMatch(freshBrief,/data-requisition=|data-replay-from=/);
 const multiple={...experiment,trials:['medic','shrapnel'],research:['medic','shrapnel']};
 const delayed=replayBriefingView(r,multiple,'standard','shrapnel',{freshSeed:28,starter:'turret'});
 assert.match(delayed,/H를 고르면 격발망 재료 확보[\s\S]*박격포 진지 · 분열 수류탄 장착/);
 assert.doesNotMatch(delayed,/포탑으로 즉시 실증/);
 const sameBrief=replayBriefingView(r,experiment,'standard','shrapnel',{freshSeed:27,route:'same'});
 assert.match(sameBrief,/포로 구출 · 로켓 R 확보/);
 assert.match(sameBrief,/data-action="same-seed" data-seed="23" data-actor="fio">같은 전장 출격/);
 const wonTrial=createOperation(23,base.research,base.trials),newActive=beginProfile(pending,wonTrial);
 wonTrial.stats.researchTrialsPicked=['shrapnel'];wonTrial.stats.shrapnelHits=8;
 finish(wonTrial,false);
 const tested=settleProfile(newActive,wonTrial),report=tested.recent[0];
 const html=reportView(report,tested);
 assert.match(html,/data-dispatch="requisition:shrapnel:coast"/);
 assert.match(html,/연구 실증<\/dt><dd>\+120C/);
 assert.match(html,/실증 \+120C<\/em>/);
 const reservation=replayBriefingView(report,tested,'requisition:shrapnel:coast');
 assert.match(reservation,/data-requisition="shrapnel" data-requisition-at="coast"/);
 assert.match(reservation,/재출격 · 120C/);
 const freshReservation=replayBriefingView(report,tested,'requisition:shrapnel:coast',null,{freshSeed:27});
 assert.match(freshReservation,/data-action="launch" data-actor="fio" data-requisition="shrapnel" data-requisition-at="coast">새 전장 출격 · 120C/);
 const turretReservation=replayBriefingView(report,{...tested,milestones:{coastTurret:true}},'requisition:shrapnel:coast',null,{freshSeed:27,starter:'turret'});
 assert.match(turretReservation,/박격포 진지 예약 · 분열 수류탄[\s\S]*data-coast-loadout="turret" data-requisition="shrapnel"/);
});
test('a comparable repeat shows independent time and score changes and the actual sector splits',()=>{
 const complete=(run,fronts,score)=>{
  Object.assign(run.operation,{region:2,cleared:3,extracted:true,regionTime:fronts[2],history:fronts.slice(0,2).map((time,region)=>({time,region}))});
  run.stats.score=score;run.stats.bossKilled=true;run.t=fronts.reduce((sum,time)=>sum+time,0);finish(run,true);
 };
 const a=createOperation(23),first=beginProfile(emptyProfile(),a);complete(a,[50.25,33.4,25.3],9620);
 a.result.weapons=[{id:'f',evolved:true,branch:'focused',level:6}];
 a.result.operation.support='vanguard';
 const p=settleProfile(first,a),report=p.recent[0];
 const firstHtml=reportView(report,p);
 assert.match(firstHtml,/data-action="replay-brief" data-replay-from="1"[^>]*>같은 전장 · 기록 도전<small>1:49\.0 · 12,620점/);
 const briefing=replayBriefingView(report,p);
 assert.match(briefing,/지난 완주<\/strong> 압축 인페르노 · 선발 지원/);
 assert.match(briefing,/data-coast="r" data-suggested/);
 assert.match(briefing,/중계기 방어 8초 · 증원 8명 제압/);
 assert.match(briefing,/돌격 신관/);
 assert.match(briefing,/회수 의무 장비/);
 assert.doesNotMatch(briefing,/철갑 급탄/);
 assert.match(briefing,/data-action="same-seed" data-seed="23" data-actor="fio" data-replay-from="1"/);
 const withResearch={...p,research:['shrapnel','thermal'],trials:['thermal']};
 const wire=replayBriefingView(report,withResearch,'order:wire');
 assert.match(wire,/value="order:wire" selected/);
 assert.match(wire,/data-action="same-seed" data-seed="23" data-actor="fio" data-sortie="wire">재출격 · 70C/);
 assert.match(wire,/박격포 제압 · 5초 해킹 · 철도 조준 유인/);
 assert.doesNotMatch(wire,/data-replay-from/);
 const paid=replayBriefingView(report,withResearch,'requisition:shrapnel:coast');
 assert.match(paid,/data-action="same-seed" data-seed="23" data-actor="fio" data-requisition="shrapnel" data-requisition-at="coast">재출격 · 120C/);
 assert.match(paid,/예약 · 분열 수류탄/);
 assert.match(paid,/실전 시험 대기 · 흡열 코일/);
 assert.doesNotMatch(paid,/value="requisition:thermal:|data-replay-from/);
 const unaffordable=replayBriefingView(report,{...withResearch,credits:0},'order:wire');
 assert.doesNotMatch(unaffordable,/data-sortie=|data-requisition=/);
 assert.match(unaffordable,/data-replay-from="1"/);
 assert.match(lobbyView(p,{brief:1,seed:23}),/중계기 방어 8초 · 증원 8명 제압/);
 for(const unsupported of [{...report,balanceRevision:'previous'}, {...report,operation:{...report.operation,requisition:'thermal'}}]){
  const html=reportView(unsupported,p);
  assert.match(html,/같은 전장 · 출격 준비/);
  assert.doesNotMatch(replayBriefingView(unsupported,p),/data-replay-from/);
 }
 const {run,next}=freshSortie(p,23,null,'fio',null,1);
 assert.equal(gatePace(run.operation,null),'');
 assert.match(gatePace({region:1,regionTime:43.3},next.active.reference),/#1 대비 · 지금 전진 시.*9\.9초 지연/);
 assert.match(gatePace({region:1,regionTime:10.049},{sequence:1,fronts:[0,9.951]}),/기록과 동일/);
 complete(run,[50.25,43.3,23.9],10270);
 run.result.weapons=[{id:'h',level:6,fusion:{secondary:'r',branch:'homing'}}];
 run.result.operation.support='recovery';
 const final=settleProfile(next,run),html=reportView(final.recent[0],final);
 assert.match(html,/같은 전장 #1 대비.*전체 8\.5초 지연.*\+650점/);
 assert.match(html,/항구 결전<\/span><small>돌파 · 0:23\.9<\/small><small class="front-pace" data-trend="ahead">1\.4초 단축/);
 assert.match(html,/완성 무장<\/dt><dd>압축 인페르노 <span>→<\/span> <strong>전도 격발망/);
 assert.match(html,/항구 장비<\/dt><dd>선발 지원 <span>→<\/span> <strong>회수 의무 장비/);
 const early=reportView({...final.recent[0],won:false,operation:{...run.operation,region:1,extracted:false,cleared:1}},final);
 assert.match(early,/같은 전장 #1 대비<\/span><b>미완주/);
 assert.doesNotMatch(early,/전체 8\.5초 지연|\+650점/);
});
test('harbor reports show the part actions actually recorded during the sortie',()=>{
 const run=createOperation(18),active=beginProfile(emptyProfile(),run);
 Object.assign(run.operation,{region:2,cleared:3,extracted:true,support:'recovery',harborPayoff:{safeAid:1,aid:2}});
 run.stats.bossKilled=true;run.stats.supportUses={2:9};finish(run,true);
 const p=settleProfile(active,run),saved=p.recent[0];
 const render=operation=>reportView({...saved,operation},p,{archived:true});
 assert.match(render(saved.operation),/회수 의무 장비.*경고 중 안전 회수 1회 \/ 일반 회수 2회/);
 assert.match(render({...saved.operation,harborPayoff:{batteries:1}}),/회수 의무 장비.*세로 장갑탄 차단 1회/);
 assert.match(render({...saved.operation,support:'overrun',harborPayoff:{dives:2,sidesteps:1}}),/코어 돌입 2회 \/ 측면 회피 1회/);
 assert.match(render({...saved.operation,support:'overrun',harborPayoff:{compressionHits:5}}),/장갑 해제 중 중거리 압축 직격 5회/);
 assert.match(render({...saved.operation,support:'overrun',harborPayoff:{wakeHits:1,wakeBreaks:1,wakeHull:2}}),/배관 점화로 측면 장갑 타격 1회 \/ 배관 점화로 측면 장갑 파괴 1회 \/ 배관 점화로 차체 직격 2회/);
 assert.match(render({...saved.operation,support:'breach',harborPayoff:{salvos:1,fans:0}}),/포탑탄 차단 1회/);
 assert.match(render({...saved.operation,support:'breach',harborPayoff:{turrets:1}}),/철갑 급탄.*측면 포탑 파괴 1회/);
 assert.match(render({...saved.operation,support:'breach',harborPayoff:{armorPreps:1,armorSalvos:2}}),/보조포 선제 급탄 차단 1회 \/ 예고 중 보조 포격 차단 2회/);
 assert.match(render({...saved.operation,harborPayoff:{locks:1,safeAid:1}}),/발밑 조준탄 차단 1회 \/ 경고 중 안전 회수 1회/);
 assert.doesNotMatch(render({...saved.operation,harborPayoff:undefined}),/harbor-payoff/);
 assert.doesNotMatch(render({...saved.operation,harborPayoff:{safeAid:'<img>',aid:-1}}),/harbor-payoff/);
 assert.match(render({...saved.operation,history:[{region:1,time:34.88}]}),/철도 차단<\/span><small>돌파 · 0:34/);
});
test('dispatch reports separate the real payout from the fee charged at launch',()=>{
 const run=createOperation(19,[],null,'convoy'),active=beginProfile(emptyProfile(),run);
 Object.assign(run.operation,{region:2,cleared:2});
 run.player.hp=0;finish(run,false);
 const p=settleProfile(active,run),html=reportView(p.recent[0],p);
 assert.equal(p.credits,210);
 assert.match(html,/이번에 지급<\/dt><dd>\+210C/);
 assert.match(html,/출격비 제외 순수익<\/dt><dd>\+140C/);
 assert.match(html,/출격 시 −70C/);
 assert.match(html,/다음 목표 · 항구 결전/);
 const immediate=createOperation(19,[],null,'convoy'),newActive=beginProfile(p,immediate);
 finish(immediate,false);const early=settleProfile(newActive,immediate);
 assert.match(reportView(early.recent[0],early),/출격비 제외 순수익<\/dt><dd>-70C/);
});
test('valid old reports without a sequence or campaign data open by their actual archive index',()=>{
 const run=createOperation(17),active=beginProfile(emptyProfile(),run);
 finish(run,false);
 const p=settleProfile(active,run),legacy={...p.recent[0],sequence:undefined,credits:undefined,operation:undefined,won:true};
 p.recent=[null,p.recent[0],legacy];
 assert.match(lobbyView(p,{tab:'archive'}),/data-report="2"/);
 assert.doesNotMatch(lobbyView(p,{tab:'archive'}),/data-report="0"|#undefined/);
 const html=reportView(legacy,p,{archived:true});
 assert.match(html,/작전 완수/);
 assert.doesNotMatch(html,/지급 크레딧|항구 돌파|전선별 진행 기록/);
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
import {fieldScene,sitePresentation,regionPreview,previewLayout,coastOpeningGuide,entryRouteSvg} from '../src/reboot/field-scene.js';
import {paintBlock,coverDepth,coverMasksPilot} from '../src/reboot/field-art.js';
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
 assert.match(rail,/data-approach="rail-center"/);
 assert.match(port,/data-approach="port-landing"/);
 assert.match(port,/data-approach="port-control"/);
 assert.match(port,/<circle cx="720" cy="1040"/);
 assert.deepEqual(fieldScene(1,19).rails[2][0],[900,1190]);
 assert.deepEqual(fieldScene(1,58).rails[2][0],[700,1190]);
 const rail17=lobbyView(emptyProfile(),{brief:1,seed:17}),rail19=lobbyView(emptyProfile(),{brief:1,seed:19});
 for(const html of [rail17,rail19]){
  assert.match(html,/화차 정비대 · 갈라진 보병/);
  assert.match(html,/통신 중계기 · 집중 박격포/);
 }
});
test('a rail report can start a new sortie or replay with the turret originally selected',()=>{
 const p=emptyProfile();p.milestones.coastTurret=true;
 const {run,next}=freshSortie(p,17,null,'fio',null,null,null,'turret',true);
 Object.assign(run.operation,{region:1,cleared:2});
 Object.assign(run.operation.coastSalvage,{turret:'broken',extracted:true});
 finish(run,false,'rail-return');
 const saved=settleProfile(next,run),r=saved.recent[0];
 const lobby=lobbyView(saved,{seed:r.seed,loadout:'turret'});
 assert.equal([...lobby.matchAll(/data-action="launch"/g)].length,1);
 assert.match(lobby,/data-starter="turret" aria-pressed="true"/);
 const result=reportView(r,saved);
 assert.match(result,/철도 돌파[\s\S]*data-replay-route="fresh"[\s\S]*새 전장 준비/);
 assert.doesNotMatch(result,/data-action="launch"/);
 assert.match(replayBriefingView(r,saved),/data-action="same-seed"[^>]*data-coast-loadout="turret"/);
 assert.doesNotMatch(replayBriefingView(r,saved),/박격포 진지 기습/);
});
test('rail debrief shows the tactical result and the next sortie reward from each route',()=>{
 for(const capture of [false,true]){
  const {run,next}=freshSortie(emptyProfile(),27,null,'fio',null,null,null,'standard',true);
  Object.assign(run.operation,{region:1,cleared:2});
  Object.assign(run.operation.coastSalvage,{turret:capture?'secured':'broken',extracted:true});
  Object.assign(run.stats,capture?{railFirstSite:'rail-cache',railFanSweep:true,railFanCut:true,railTurretKills:8}
   :{railFirstSite:'rail-relay',railDecoys:1,railGunsDestroyed:2});
  finish(run,false,'rail-return');
  const saved=settleProfile(next,run),r=saved.recent[0],view=reportView(r,saved);
  assert.equal(r.creditBreakdown.extraction,60);
  if(capture){
   assert.equal(r.creditBreakdown.turret,40);
   assert.match(view,/노획 포탑 반출[\s\S]*정비대 양쪽 대열 명중 · 열차 양쪽 포격 차단[\s\S]*\+40C · 새 전장에서 포탑 L1 선택[\s\S]*철도 포탑 제압<\/dt><dd>8명/);
   assert.match(replayBriefingView(r,saved,'standard',null,{sortie:true,freshSeed:28,starter:'turret'}),/data-action="launch"[^>]+data-coast-loadout="turret"/);
  }else{
   assert.equal(r.creditBreakdown.turret,undefined);
   assert.match(view,/중계기 교신으로 돌파[\s\S]*열차 조준 유인 1회[\s\S]*열차 포대 파괴<\/dt><dd>2 \/ 2문/);
   assert.match(view,/data-replay-route="fresh" data-dispatch="order:wire"[\s\S]*전파 절단 준비/);
   const wire=replayBriefingView(r,saved,'order:wire',null,{sortie:true,freshSeed:28});
   assert.match(wire,/data-order-pin="wire"[\s\S]*5초 해킹[\s\S]*진입 시 장착 무장 정비[\s\S]*중계기 경유 없이 열차 조준 유인/);
   assert.match(wire,/data-brief-order="wire" aria-pressed="true"/);
   assert.match(wire,/data-action="launch"[^>]*data-sortie="wire"[^>]*>새 전장 출격 · 70C/);
   assert.doesNotMatch(wire,/data-replay-from=|data-brief-opening/);
   const standard=replayBriefingView(r,saved,'standard',null,{sortie:true,freshSeed:28});
   assert.match(standard,/data-brief-order="standard" aria-pressed="true"[\s\S]*항구 보스 격파 후 귀환/);
   assert.doesNotMatch(standard,/data-sortie=|data-order-pin=/);
   assert.doesNotMatch(view,/새 전장에서 포탑 L1 선택/);
   assert.match(reportView({...r,stats:{...r.stats,wireDecoy:1}},saved),/교신 암호로 돌파/);
  }
 }
});
test('a standard railway return sets an actionable same-seed target for its two fronts',()=>{
 const source=freshSortie(emptyProfile(),27,null,'fio',null,null,null,'standard',true);
 const complete=(run,coastTime,railTime,score)=>{
  Object.assign(run.operation,{region:1,cleared:2,history:[{region:0,time:coastTime}],regionTime:railTime});
  Object.assign(run.operation.coastSalvage,{turret:'secured',extracted:true});
  Object.assign(run.stats,{bossKilled:true,score});
  run.t=coastTime+railTime;
  finish(run,false,'rail-return');
 };
 complete(source.run,32,21.2,4500);
 const saved=settleProfile(source.next,source.run),report=saved.recent[0],options={sortie:true,freshSeed:28,route:'same'};
 assert.match(reportView(report,saved),/data-rail-record><span><b>철도 기록 도전<\/b><small>0:53\.2 · 4,500점/);
 const same=replayBriefingView(report,saved,'standard',null,options);
 assert.match(same,/철도 귀환 0:53\.2 \/ 4,500점/);
 assert.match(same,/data-replay-rail="field"[\s\S]*R이면 ↖ 통신 중계기 · 포탑이면 화차 정비대/);
 assert.match(same,/data-seed="27"[^>]+data-replay-from="1"/);
 const turret=replayBriefingView(report,saved,'standard',null,{...options,starter:'turret'});
 assert.match(turret,/data-replay-rail="rail-cache"[\s\S]*철도 → 화차 정비대/);
 assert.doesNotMatch(turret,/data-replay-from/);
 const fresh=replayBriefingView(report,saved,'standard',null,{...options,starter:'turret',route:'fresh'});
 assert.match(fresh,/data-replay-rail="rail-cache"[\s\S]*철도 ← 화차 정비대/);
 assert.doesNotMatch(fresh,/data-replay-from/);
 const retry=freshSortie(saved,27,null,'fio',null,1,null,'standard',true);
 const reference=retry.next.active.reference;
 assert.equal(reference.goal,'rail-return');
 assert.deepEqual(reference.fronts,[32,21.2]);
 assert.deepEqual(parseProfile(JSON.stringify(retry.next)).active.reference,reference);
 assert.equal(freshSortie(saved,27,null,'fio',null,1,null,'turret',true).next.active.reference,undefined);
 assert.equal(freshSortie({...saved,research:['thermal'],trials:['thermal']},27,null,'fio',null,1,null,'standard',true).next.active.reference,undefined);
 assert.match(gatePace({region:1,regionTime:25,history:[{region:0,time:27}]},reference),/철도 귀환 시.*1\.2초 단축/);
 complete(retry.run,27,25,4700);
 const final=settleProfile(retry.next,retry.run),html=reportView(final.recent[0],final);
 assert.match(html,/철도 귀환 #1 대비.*전체 1\.2초 단축.*\+200점/);
 assert.match(html,/철도 차단<\/span><small>돌파 · 0:25\.0<\/small><small class="front-pace" data-trend="behind">3\.8초 지연/);
 const onward={...final.recent[0],won:true,reason:'prototype-complete',operation:{...final.recent[0].operation,region:2,cleared:3,extracted:true}};
 assert.match(reportView(onward,final),/철도 귀환 #1 대비<\/span><b>항구로 전진/);
 assert.doesNotMatch(reportView(onward,final),/전체 1\.2초 단축/);
});
test('a canonical report previews the chosen beach and starter and only compares matching records',()=>{
 const p=emptyProfile(),run=createOperation(27,[],null,null,'fio','standard'),active=beginProfile(p,run);
 Object.assign(run.operation,{region:2,cleared:3,extracted:true,history:[{region:0,time:20},{region:1,time:40}],regionTime:30});
 Object.assign(run.operation.coastSalvage,{turret:'secured',extracted:true});
 run.stats.bossKilled=true;run.t=90;finish(run,true);
 const saved=settleProfile(active,run),r=saved.recent[0];
 assert.match(reportView(r,saved),/반출한 포탑으로 새 동선 시험/);
 const fresh=replayBriefingView(r,saved,'standard',null,{sortie:true,freshSeed:28,starter:'turret'});
 assert.match(fresh,/새 전장<small>서쪽 난파선/);
 assert.match(fresh,/같은 전장<small>벙커 횡단/);
 assert.match(fresh,/class="replay-landing"><b>↖ 포로 구출/);
 assert.match(fresh,/철도[^<]*화차 정비대/);
 assert.doesNotMatch(fresh,/박격포 진지 기습|data-replay-from/);
 assert.match(fresh,/data-action="launch"[^>]+data-coast-loadout="turret"/);
 const options={sortie:true,freshSeed:28,route:'same'};
 const same=replayBriefingView(r,saved,'standard',null,options);
 assert.match(same,/철도 · 해안에서 고른 무장으로 공략/);
 assert.match(same,/data-seed="27"[^>]+data-replay-from="1"/);
 assert.match(same,/data-brief-opening="auto" aria-pressed="true"/);
 for(const [gun,text] of [['f','이동 보급차 · 30m · 방패 측면 공략'],['r','박격포 진지 · 64m · 박격포 2문']]){
  const planned=replayBriefingView(r,saved,'standard',null,{...options,openingGun:gun});
  assert.ok(planned.includes(text));
  assert.match(planned,new RegExp(`data-brief-opening="${gun}" aria-pressed="true"`));
  assert.match(planned,new RegExp(`data-seed="27"[^>]+data-opening-gun="${gun}"`));
  assert.doesNotMatch(planned,/data-replay-from/);
  assert.match(planned,gun==='r'?/로켓 R을 유지하면 후방 박격포/:/화염 F를 유지하면 분사기 강화/);
  const {run:nextRun,next}=freshSortie(saved,27,null,'fio',null,1,null,'standard',true,gun);
  assert.equal(nextRun.operation.openingGun,gun);
  assert.equal(next.active.reference,undefined);
 }
 const alternate=replayBriefingView(r,saved,'standard',null,{...options,starter:'turret'});
 assert.match(alternate,/data-seed="27"[^>]+data-coast-loadout="turret"/);
 assert.doesNotMatch(alternate,/data-replay-from/);
 assert.doesNotMatch(replayBriefingView(r,saved,'standard',null,{...options,starter:'turret',openingGun:'f'}),/data-brief-opening|data-opening-gun/);
 const plan=createOperationPlan(()=>27,28);
 assert.equal(plan.seed,27);
 assert.notEqual(plan.forReport(27)%4,27%4);
 assert.notEqual(plan.forReport(27)%4,28%4);
 assert.notDeepEqual(holdoutParts(plan.forReport(27),0),holdoutParts(27,0));
 assert.equal(plan.seed,27);
});
test('a returned rail part appears in the receipt and the selected replay map previews its own pair',()=>{
 const {run,next}=freshSortie(emptyProfile(),27,null,'fio',null,null,null,'standard',true);
 Object.assign(run.operation,{region:1,cleared:2,nextSupport:'recovery'});
 Object.assign(run.operation.coastSalvage,{turret:'broken',extracted:true});
 run.stats.challenge=1;
 run.stats.challengeWins=1;
 finish(run,false,'rail-return');
 const saved=settleProfile(next,run),report=saved.recent[0];
 assert.match(reportView(report,saved),/rail-part-receipt" data-part="recovery"[^]*회수 의무 장비<\/b><p>항구 투입 전 작전 종료 · 잔류 \+20C/);
 const fresh=replayBriefingView(report,saved,'standard',null,{sortie:true,freshSeed:28,route:'fresh'});
 const same=replayBriefingView(report,saved,'standard',null,{sortie:true,freshSeed:28,route:'same'});
 assert.match(fresh,/data-rail-options><summary><b>철도 잔류 보급<\/b><small>철갑 급탄 · 돌격 신관/);
 assert.match(fresh,/이번 전장에서는 위 두 부품 중 선택/);
 assert.match(same,/data-rail-options><summary><b>철도 잔류 보급<\/b><small>철갑 급탄 · 회수 의무 장비/);
 assert.match(same,/이번 전장의 방어 보상으로 다시 확보 가능/);
});
test('harbor wins show the final build and put its unlocked research before optional replays',()=>{
 const p=emptyProfile(),run=createOperation(27,[],null,null,'fio','standard'),active=beginProfile(p,run);
 Object.assign(run.operation,{region:2,cleared:3,extracted:true,history:[{region:0,time:20},{region:1,time:40}],regionTime:30});
 run.operation.coastSalvage.turret='broken';
 run.weapons.push({id:'f',level:6,branch:'trail',evolved:true});
 Object.assign(run.stats,{bossKilled:true,wakeKills:20,infernoCoreHits:3,flameBosses:1});
 run.t=90;finish(run,true);
 const saved=settleProfile(active,run),html=reportView(saved.recent[0],saved);
 assert.match(html,/data-build-summary[\s\S]*인페르노[\s\S]*잔불 제압 20명 · 코어 직격 3회/);
 assert.match(html,/data-research-next[\s\S]*data-research="thermal" data-debrief-research[\s\S]*data-replay-route="fresh"/);
 const captured={...saved.recent[0],operation:{...saved.recent[0].operation,coastSalvage:{...saved.recent[0].operation.coastSalvage,turret:'secured'}},stats:{...saved.recent[0].stats,railFirstSite:'rail-cache',railFanCut:true,railTurretKills:20},creditBreakdown:{...saved.recent[0].creditBreakdown,turret:40}};
 assert.match(reportView(captured,saved),/data-build-summary data-outcome="returned"[\s\S]*인페르노[\s\S]*포탑 반출 \+40C[\s\S]*화차 정비대 · 양쪽 포격 차단 · 포탑 제압 20명/);
 const study=buyResearch(saved,'thermal'),after=reportView(saved.recent[0],study);
 assert.match(after,/data-trial-focus="thermal"[\s\S]*data-replay-route="fresh"/);
 const brief=replayBriefingView(saved.recent[0],study,'standard','thermal',{freshSeed:28});
 assert.match(brief,/포로 구출 · 화염 F 확보[\s\S]*박격포 진지 · 축전 코일 장착[\s\S]*이동 보급차 · 흡열 코일 장착[\s\S]*data-action="launch"/);
 assert.doesNotMatch(brief,/data-requisition=/);
 const tested={...study,trials:[]};
 const paid=replayBriefingView(saved.recent[0],tested,'requisition:thermal:coast',null,{freshSeed:28});
 assert.match(paid,/박격포 진지 · 축전 코일 장착[\s\S]*이동 보급차 · 흡열 코일 장착[\s\S]*data-requisition="thermal" data-requisition-at="coast"/);
 const rail=replayBriefingView(saved.recent[0],tested,'requisition:thermal:rail',null,{freshSeed:28,sortie:true});
 assert.match(rail,/박격포 진지 · 축전 코일 장착[\s\S]*화차 정비대 · 흡열 코일 장착/);
 const replay=replayBriefingView(saved.recent[0],study,'standard',null,{freshSeed:28,sortie:true});
 assert.match(replay,/이동 보급차 · 흡열 코일 장착/);
 assert.doesNotMatch(replay,/class="replay-rail-target"|class="replay-route-hint"/);
 assert.match(lobbyView(study,{seed:28}),/class="thermal-route"/);
});
test('briefings share distinct field terrain and recognizable site symbols',()=>{
 assert.ok(fieldScene(0).water&&fieldScene(2).water&&fieldScene(0).water!==fieldScene(2).water);
 assert.ok(fieldScene(1).rails.length);assert.equal(fieldScene(1).water,null);
 const run=createOperation(17),html=regionPreview(0,17);for(const site of run.sites)assert.ok(html.includes(`translate(${site.x} ${site.y})`));
 assert.equal(sitePresentation(run.sites[0]).name,'포로 구출');assert.equal(sitePresentation(run.sites[1]).icon,'truck');
});
test('coastal tracks connect the actual sites through clear ground and water starts at the field edge',()=>{
 for(let seed=16;seed<20;seed++){
  const {tracks,shapes,water}=fieldScene(0,seed),{sites,blocks}=previewLayout(seed,0),html=regionPreview(0,seed),run=createOperation(seed);
  const [rescue,truck,,battery]=sites.map(({x,y})=>[x,y]);
  const preempt=seed%4<2?battery:truck;
  assert.deepEqual(tracks,[[[800,1040],rescue],[rescue,truck],[rescue,battery],[[800,1040],preempt]]);
  const live=coastOpeningGuide(run),brief=entryRouteSvg(live);
  assert.deepEqual(live.routes.map(route=>route.path),[tracks[0],tracks[3]]);
  assert.ok(html.includes(brief));
  assert.equal((html.match(/data-coast-opening=/g)||[]).length,2);
  assert.doesNotMatch(regionPreview(0,seed,null,null,false),/data-coast-opening=/);
  assert.ok(shapes.some(s=>s.type==='rect'&&s.y===FIELD.bottom&&s.fill===water&&s.w===1600));
  assert.ok(shapes.some(s=>s.type==='rect'&&s.x===0&&s.fill===water&&s.w===FIELD.left));
  for(const track of tracks){
   const [[ax,ay],[bx,by]]=track,steps=Math.ceil(Math.hypot(bx-ax,by-ay)/8);
   for(let i=0;i<=steps;i++){
    const x=ax+(bx-ax)*i/steps,y=ay+(by-ay)*i/steps;
    assert.ok(!blocks.some(b=>x+23>b.x&&x-23<b.x+b.w&&y+23>b.y&&y-23<b.y+b.h),`track on seed ${seed}`);
   }
  }
  assert.doesNotMatch(regionPreview(0,seed,run),/data-approach=/);
  run.sites[0].state='active';
  assert.equal(coastOpeningGuide(run),null);
  run.sites[0].state='waiting';live.preempt.preempt=true;
  assert.equal(coastOpeningGuide(run),null);
 }
});
test('the launch briefing offers rescue or either raid and matches the selected battlefield route',()=>{
 const p=emptyProfile(),lobby=lobbyView(p,{seed:27});
 assert.match(lobby,/data-lobby-opening="auto" aria-pressed="true"/);
 assert.match(lobby,/감옥에서 화염 F \/ 로켓 R 선택/);
 assert.ok(lobby.indexOf('data-lobby-opening="r"')<lobby.indexOf('data-action="launch"'));
 assert.doesNotMatch(lobby,/data-action="launch"[^>]+data-opening-gun/);
 for(const openingGun of ['f','r']){
  const selected=lobbyView(p,{seed:27,openingGun});
  assert.match(selected,new RegExp(`data-lobby-opening="${openingGun}" aria-pressed="true"`));
  assert.match(selected,new RegExp(`data-action="launch"[^>]+data-opening-gun="${openingGun}"`));
  const {run}=freshSortie(p,27,null,'fio',null,null,null,'standard',true,openingGun);
  assert.ok(selected.includes(entryRouteSvg(coastOpeningGuide(run))));
  assert.match(lobbyView(p,{seed:27,brief:1,openingGun}),new RegExp(`data-action="launch"[^>]+data-opening-gun="${openingGun}"`));
 }
 const unlocked=emptyProfile();unlocked.milestones.coastTurret=true;
 for(const brief of [1,2]){
  const turret=lobbyView(unlocked,{seed:22,brief,loadout:'turret',openingGun:'f'});
  assert.match(turret,/첫 목표 · 포로 구출<\/b><small>화염 F \/ 기관총 H 선택/);
  assert.doesNotMatch(turret,/data-lobby-opening|data-opening-gun/);
 }
 const trial=emptyProfile();trial.research=['thermal'];trial.trials=['thermal'];
 assert.doesNotMatch(lobbyView(trial,{seed:27,openingGun:'r'}),/data-lobby-opening|data-opening-gun/);
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
test('rail wagon art projects north of its footprint and fades on the walkable side',()=>{
 for(const seed of [17,18]){
  const b=previewLayout(seed,1).blocks.find(block=>block.id==='r1');
  const sprite={},draws=[];
  const context={save(){},restore(){},drawImage(...args){draws.push(args);}};
  paintBlock(context,b,1,{railWagon:sprite});
  const depth=coverDepth(b,1);
  assert.deepEqual(draws,[[sprite,b.x,b.y-depth,b.w,b.h+depth]]);
  assert.ok(coverMasksPilot(b,1,{x:b.x+b.w/2,y:b.y-20}));
  assert.equal(coverMasksPilot(b,1,{x:b.x+b.w+20,y:b.y-20}),false);
  assert.equal(coverMasksPilot(b,1,{x:b.x+b.w/2,y:b.y-depth-1}),false);
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
 const early={...p,credits:69,milestones:{wireOrder:true}};
 const earlyBoard=lobbyView(early,{order:'wire'});
 assert.match(earlyBoard,/data-order="wire"[^>]*disabled[\s\S]*1C 부족/);
 assert.doesNotMatch(earlyBoard,/data-order="convoy"|data-sortie=/);
 assert.match(lobbyView({...early,credits:70},{order:'wire'}),/data-sortie="wire"/);
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
 assert.match(marco,/마르코 · 지령 출격/);assert.match(marco,/사격 버튼을 끌어 조준한 뒤 놓으세요/);
 assert.match(marco,/관통 사격 E/);assert.match(marco,/마르코 출격 준비 모습/);
});
