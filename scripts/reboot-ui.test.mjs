import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyView,reportView} from '../src/reboot/interface.js';
import {emptyProfile,beginProfile,settleProfile} from '../src/reboot/profile.js';
import {createOperation,finish} from '../src/reboot/model.js';

test('mission briefing does not select a later starting map, and saved operations offer resume',()=>{
 const p=emptyProfile(),html=lobbyView(p,{brief:2});
 assert.match(html,/heading|작전 지령/);assert.match(html,/data-action="launch">피오 · 해안에 출격/);
 const run=createOperation(17);run.operation.region=1;const active=beginProfile(p,run),view=lobbyView(active);
 assert.match(view,/data-action="resume-run">저장한 작전 계속/);
 assert.match(view,/이어서 2\/3 철도 차단/);assert.doesNotMatch(view,/data-action="launch"/);
});
test('research makes condition, funds, active-run block and owned trial explicit',()=>{
 const p=emptyProfile();let html=lobbyView(p,{tab:'research'});assert.match(html,/실증 조건 미달/);
 p.milestones.medic=true;p.credits=299;html=lobbyView(p,{tab:'research'});assert.match(html,/1C 부족/);
 p.credits=300;html=lobbyView(p,{tab:'research'});assert.match(html,/<button  class="primary" data-research="medic">300C · 연구/);
 p.research=['medic'];p.trials=['medic'];html=lobbyView(p,{tab:'research'});assert.match(html,/새 연구 · 조건에 맞는 첫 보급에서 제시/);assert.match(html,/disabled[^>]*data-research="medic"/);
 const active=beginProfile(emptyProfile(),createOperation(17));assert.match(lobbyView(active,{tab:'research'}),/진행 중인 작전을 귀환·정산한 뒤/);
});
test('settled reports lead to affordable research and preserve exact replay seed',()=>{
 const run=createOperation(17);let p=beginProfile(emptyProfile(),run);run.operation.cleared=3;run.operation.extracted=true;run.stats.bossKilled=true;finish(run,true);p=settleProfile(p,run);
 const html=reportView(p.recent[0],p);assert.match(html,/data-target="research"/);assert.match(html,/data-action="same-seed" data-seed="17"/);assert.match(html,/첫 완주 보너스 200C 포함/);
 const old={...p.recent[0],balanceRevision:'old-rules'};assert.doesNotMatch(reportView(old,p),/첫 완주 보너스/);
 assert.match(reportView(p.recent[0],p,{archived:true}),/data-target="archive"/);
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
