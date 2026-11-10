import {createOperationPlan} from './operation-plan.js';
import {choiceDetails,isQuickMod} from './choice-details.js';
import {terrainSvg,siteSymbol,sitePresentation,gateSymbol} from './field-scene.js';
import {lobbyView,reportView,isReport,loadoutChips,itemArt,moduleIcon} from './interface.js';
import {REGIONS,HOLDOUT,MANEUVERS,FRONT_SUPPORTS,CARGO_CREDITS,DEFENSE_ZONE,SIGNAL_ROUTE,COAST_APPROACHES,beachRoute,supportTactic,defenseSeconds,holdoutContract,signalCourier,exitGate,groundXp,holdoutTier,region,operationCredits} from './campaign.js';
import {GUNS,MODULES,QUALITY,RULES,buildPaths,distance,moduleRank,refitWeapons} from './content.js';
import {createOperation,restore,snapshot,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,assemblyOptions,activeManeuver,interaction,xpNeeded,takeEvents} from './model.js';
import {createStore,buyResearch,freshSortie,checkpointProfile,settleProfile,STORAGE_KEY} from './profile.js';
import {createRenderer} from './render.js';
import {loadMissionArt,operatorPortrait} from '../mission/art.js';
import {bindTouchControls} from '../game/touch-controls.js';
import {createAudio,selectAudioEvents} from '../game/audio.js';
const $=id=>document.getElementById(id),ui=$('ui'),keys=new Set(),audio=createAudio(),esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
let store,run,operationPlan,art=null,renderer,controls,mode='home',busy=false,committingPlay=false,pauseQueued=false,pending=null,stamp='',inventoryStamp='',mapStamp='',lastFrame=0,accumulator=0,saveClock=0,touch={x:0,y:0},selectedDoctrine='reserve',subpanel=null,noticeTimer,bannerUntil=0,bannerRunId=null,lobbyTab='mission',briefRegion=null,nextPanelFocus=null,choiceOrigin=null,settingsOrigin=null,equippedUntil=0,equippedWeapon=null;
const profile=()=>store.get();
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4500);}
function setBusy(on){busy=on;document.body.classList.toggle('is-saving',on);ui.setAttribute('aria-busy',String(on));for(const b of ui.querySelectorAll('button')){if(on&&!b.disabled){b.dataset.saving='true';b.disabled=true;}else if(!on&&b.dataset.saving){b.disabled=false;delete b.dataset.saving;}}}
function panel(html){const origin=nextPanelFocus;nextPanelFocus=null;ui.innerHTML=html;ui.scrollTop=origin?.scroll||0;keys.clear();controls?.reset();requestAnimationFrame(()=>{const target=origin?.selector&&ui.querySelector(origin.selector)||ui.querySelector('h1,h2')||ui.querySelector('button:not(:disabled)');if(target){if(!target.matches('button,a,input'))target.tabIndex=-1;target.focus({preventScroll:true});}});}
function settings(){const p=profile();return `<div class="settings"><label><input type="checkbox" data-setting="sound" ${p.settings.sound?'checked':''}><span>전투 효과음<small>사격 · 적중 · 보급 알림</small></span></label><label><input type="checkbox" data-setting="reduced" ${p.settings.reduced?'checked':''}><span>플래시·흔들림 줄이기<small>강한 폭발 효과와 화면 반동을 줄입니다.</small></span></label></div>`;}
function showHome(){mode='home';subpanel=null;stamp='home';document.body.dataset.scene='lobby';panel(lobbyView(profile(),{tab:lobbyTab,brief:briefRegion,seed:operationPlan.seed}));if(art&&$('portrait'))requestAnimationFrame(()=>operatorPortrait($('portrait'),art,'fio',240));}
function showSettings(){if(!settingsOrigin)settingsOrigin={mode,scroll:ui.scrollTop,subpanel};subpanel={type:'settings'};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="settings-title"><span class="eyebrow">야전 환경 설정</span><h2 id="settings-title">전투를 편하게.</h2>${settings()}<p class="stat-note">이동 WASD · 회피 SPACE<br>전탄 보급 E · 상황 행동 F · 진화·합체 G<br>전투는 자동 사격합니다. 메뉴에서는 정지합니다.</p><button class="primary" data-action="settings-back">설정 완료</button></section>`);}
function closeSettings(){const origin=settingsOrigin;settingsOrigin=null;subpanel=origin?.subpanel||null;nextPanelFocus={scroll:origin?.scroll||0,selector:'[data-action="settings-menu"]'};if(mode==='home')showHome();else present(true);}
function showRetreat(fromHome=false){subpanel={type:'retreat',fromHome};const secured=operationCredits({operation:run.operation,stats:run.stats,won:false}),cleared=run.operation?.cleared||0;panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="retreat-title"><span class="eyebrow">작전 종료</span><h2 id="retreat-title">확보한 성과로 귀환할까요?</h2><p>${cleared}/3 전선 돌파 · ${fmt(run.t)} · LV.${run.level}<br>지금 귀환하면 <strong>${secured}C</strong>를 정산합니다. 이번 무장과 레벨은 다음 판에 초기화됩니다.</p><p class="inline-note">${run.raid?.state==='active'?'진행 중인 습격과 걸었던 상자는 포기합니다. ':''}최종 보스 뒤 출구로 탈출해야 완주로 기록됩니다.</p><div class="buttons"><button class="primary" data-action="retreat-cancel">작전 유지</button><button class="danger" data-action="retreat-confirm">종료하고 ${secured}C 정산</button></div></section>`);}

function choiceCards(){return run.choices.map((c,i)=>{const d=choiceDetails(run,c),art=d.art?itemArt(d.art):`<span class="module-engraving">${moduleIcon(c.module||(({advance:'route',extract:'extract',stay:'stay'})[c.kind]||'gear'))}</span>`;return `<button class="upgrade-card ${['evolve','fusion'].includes(c.kind)?'capstone':''}" data-choice="${esc(c.id)}"><span class="upgrade-category">${esc(c.label||'전술 결정')}</span>${i<9?`<kbd>${i+1}</kbd>`:''}<span class="upgrade-illustration">${art}</span><span class="upgrade-copy"><h3>${esc(d.title)}</h3><strong class="upgrade-impact">${esc(d.impact)}</strong>${d.detail?`<span class="upgrade-detail">${esc(d.detail)}</span>`:''}</span>${d.before?`<span class="upgrade-levels" aria-label="레벨 ${d.before}에서 ${d.after}로">${Array.from({length:6},(_,i)=>`<i class="${i<d.before?'owned':i<d.after?'added':''}"></i>`).join('')}<b>L${d.before} → ${d.after}</b></span>`:''}<span class="upgrade-link">${esc(d.link)}</span><span class="upgrade-cost">${esc(d.cost)}</span><span class="install-label">${c.kind==='back'?'돌아가기':['advance','stay','extract'].includes(c.kind)?'결정':c.kind==='permit'?'확보':c.kind==='resupply'?'보급 받기':'장착'} <span>↵</span></span></button>`;}).join('');}
function equippedFeedback(c,d){if(!['rank','gun','module','tune','repair','evolve','fusion','maneuver','permit','resupply','front-support','cargo'].includes(c.kind))return;equippedUntil=performance.now()+1900;equippedWeapon=c.weapon||c.primary||null;$('field-feedback').innerHTML=`${d.art?itemArt(d.art):moduleIcon(c.module||'gear')}<div><span>${c.kind==='front-support'?'다음 전선 장비 확보':c.kind==='cargo'?'정산 화물 확보':c.kind==='permit'?'조율권 확보':['repair','resupply'].includes(c.kind)?'현장 보급 완료':'현장 장착 완료'}</span><b>${esc(d.title)}${c.kind==='rank'?` L${d.after}`:''}</b><small>${esc(d.impact)}</small></div>`;$('field-feedback').hidden=false;}
function showChoices(){
 const type=run.choice.type,quick=isQuickMod(run),atGate=type==='clear'&&!!run.operation,atPursuit=type==='pursuit-reward',title=({level:'야전 개조',supply:run.choice.opening?'첫 무장을 골라라':'노획 병기를 골라라',armory:'확보할까, 걸어볼까','raid-reward':'습격 성공 · 전리품','pursuit-reward':'잔류 보급 선택',assembly:'병기를 완성하라',clear:run.operation&&run.operation.region<2?'다음 전선이 열렸다':'작전 목표 달성',control:'관제소를 어떻게 쓸까'})[type];
 const quality=run.choice.quality,receipt=type==='raid-reward'?`<div class="loot-receipt"><span>걸었던 ${QUALITY[run.choice.wagerQuality]||'기존'} 상자</span><b>→ ${QUALITY[quality]} 보급 탈취</b><small>${run.choice.contract==='light'?'보급차 작업대 · 무기의 발사 방식을 바꿀 기회':'장갑 수송대 · 미완성 병기의 부품을 노린다'}</small></div>`:'',paths=type==='assembly'?`<div class="build-paths">${buildPaths(run).map(p=>`<div class="${p.complete||p.ready?'path-ready':''}"><b>${p.complete?'✓ ':p.ready?'조립 가능 · ':''}${esc(p.title)}</b><small>${esc(p.detail)}</small></div>`).join('')}</div>`:'';
 const gateIntel=atGate?`<div class="gate-intel"><span><small>돌파한 전선</small><b>${esc(region(run).name)}</b></span><span><small>게이트 목적지</small><b>${esc(REGIONS[run.operation.region+1]?.name||'작전실')}</b></span><span><small>회수 가능한 바닥 XP</small><b>${groundXp(run)}</b></span></div>`:'';
 panel(`<section class="sheet field-menu ${quick?'quick-mod':''}${atGate?' gate-menu':atPursuit?' pursuit-menu':''}" role="dialog" aria-modal="true" aria-labelledby="choice-title"><header><div><span class="eyebrow">${type==='level'?`LV.${run.level} · 현장 정비`:type==='assembly'?'병기 조립':type==='clear'?'게이트 통과':atPursuit?'잔류 도전 D1':'노획 · 현장 보급'} ${quality?' / '+QUALITY[quality]:''}</span><h2 id="choice-title">${title}</h2><p>${esc(type==='level'?'한 가지를 골라 전투에 바로 투입하세요.':atGate?'전진하거나 현장에 남아 XP를 회수하세요.':run.choice.opening?'포로 구출 완료 · 무장에 맞는 거점을 공략하세요.':run.choice.source.replace('전방 구조 보급','포로 구출 보상').replace('이동 보급대','이동 보급차'))}</p></div><span class="paused">${atGate?'Ⅱ 전투 정지':'Ⅱ 정비 중'}</span></header>${atGate?gateIntel:`<div class="choice-tools"><span>공격 ${run.weapons.length}/3 · 모듈 ${run.modules.length}/4 · 조율권 ${run.tuning}</span><div>${['level','supply','armory','raid-reward'].includes(type)?`<button data-action="reroll" ${run.rerolls<=0||run.choice.opening?'disabled':''}>${run.choice.opening?'고정 보급':`재추첨 ${run.rerolls}`}</button><button data-action="banish-menu" ${run.banishes<=0?'disabled':''}>후보 제외 ${run.banishes}</button>`:''}</div></div>`}${type==='level'&&run.level>=6&&!run.player.branchChosen?`<div class="doctrine"><b>피오 운용</b><label><input type="radio" name="doctrine" value="reserve" ${selectedDoctrine==='reserve'?'checked':''}> 비축 · 6초/60충전</label><label><input type="radio" name="doctrine" value="quick" ${selectedDoctrine==='quick'?'checked':''}> 신속 · 4초/50충전</label></div>`:''}${receipt}${paths}<div class="upgrade-deck${run.choices.length===2?' two-options':''}">${choiceCards()}</div><footer class="choice-footer"><small>${type==='assembly'?`조율권 ${run.tuning}개 · ${run.tuning?'정비와 진화가 같은 조율권을 사용합니다.':(run.operation?.cleared||0)<2?'중간 보스 격파 시 1개를 확보합니다.':'중간 보스의 조율권을 모두 사용했습니다.'}`:type==='control'?'교란과 시험 탄약 중 하나만 선택합니다. 이번 항구 작전에 적용됩니다.':type==='clear'?'잔류하는 동안 증원군이 강해집니다. 게이트는 계속 열려 있습니다.':atPursuit?(run.operation.region<2?'선택한 장비는 다음 전선 한 곳에서 작동합니다.':'화물을 정산하거나 후송 보급을 써서 더 버티세요.'):'새 총은 필드에서 · XP는 보유 공격과 모듈에 투자'}</small><div class="buttons">${type==='armory'&&!run.raidUsed?'<button class="primary" data-action="raid-menu">상자를 걸고 습격</button>':''}${!['assembly','clear','control','pursuit-reward'].includes(type)?'<button class="subtle" data-action="skip">건너뛰기 · 소량 회복</button>':''}</div></footer></section>`);
}
function showPause(){panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">작전 일시정지</span><h2 id="pause-title">다음 한 수를 준비하라.</h2><p>${run.operation?`${run.operation.region+1}/3 ${region(run).name} · ${fmt(run.t)} · LV.${run.level}`:'전투 중'}<br>${run.stage==='holdout'?'게이트 개방. 남아서 XP를 회수하거나 게이트로 이동하세요.':region(run).mission}</p>${loadoutChips(run.weapons,run.modules)}<div class="pause-actions"><button class="primary" data-action="continue">전투 이어하기 ▶</button><button data-action="retreat">작전 정산</button></div><div class="pause-secondary">${run.raid?.state==='active'?'<button data-action="withdraw">습격 철수 · 건 상자 소실</button>':''}${run.stage==='holdout'&&(!run.challenge||run.operation&&['complete','failed'].includes(run.challenge.state))?`<button data-action="challenge">${holdoutContract(run).name} · D ${(run.operation?.challengeTier||0)+1}</button>`:''}<button class="text-button" data-action="settings-menu">환경 설정</button></div></section>`);}
function showResult(r=run.result,archived=false){r=profile().recent.find(x=>isReport(x)&&(r.runId?x.runId===r.runId:x.seed===r.seed&&x.seconds===r.seconds))||r;document.body.dataset.scene=archived?'lobby':'battle';panel(reportView(r,profile(),{archived}));}

function showRaid(){subpanel={type:'raid'};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="raid-title"><span class="eyebrow">WAGER THE SUPPLY</span><h2 id="raid-title">지금 상자를 걸겠습니까?</h2><p>현재 ${QUALITY[run.choice.quality]} 보급을 포기하고 수송대를 습격합니다.<br>탈출·철수하면 건 상자를 잃습니다. 기존 무장과 확보 기록은 유지됩니다.</p><table class="raid-table"><thead><tr><th>계약</th><th>내구 / 탈출</th><th>성공 보상 확률</th></tr></thead><tbody><tr><th>보급차</th><td>900 / 약17초</td><td>일반70 · 희귀27 · 원형3%<br><small>야전 분화 개장 / 무기 강화 후보</small></td></tr><tr><th>장갑 수송대</th><td>4,200 / 21초<br>전면 탄환 ×0.5</td><td>일반40 · 희귀45 · 원형15%<br><small>미완성 진화·연계 부품 후보</small></td></tr></tbody></table><small>장갑 계약은 완성 화력 권장 · 방패·장교·박격포 호위<br>위 확률은 습격 성공 뒤의 보상 품질입니다.</small><div class="buttons"><button data-action="raid:light">보급차 습격</button><button class="primary" data-action="raid:armored">장갑 수송대 습격</button><button data-action="choice-back">현재 보급 유지</button></div></section>`);}
function showBranches(c,args){subpanel={type:'branch',card:c,args};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="branch-title"><span class="eyebrow">WEAPON SPECIALIZATION</span><h2 id="branch-title">${GUNS[c.weapon].name} · 분화</h2><p>같은 레벨 투자 안에서 발사 방식을 결정합니다.</p><div class="branch-list">${Object.entries(GUNS[c.weapon].branches).map(([id,[name,desc]])=>`<button data-branch="${id}"><b>${name}</b><small>${desc}</small></button>`).join('')}</div><button data-action="choice-back">선택으로 돌아가기</button></section>`);}
function showRefits(c){
 subpanel={type:'refit',card:c};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="refit-title"><span class="eyebrow">FIELD WORKSHOP</span><h2 id="refit-title">같은 투자, 다른 발사 방식.</h2><p>미완성 총 하나의 분화를 전환합니다. 무기 레벨·모듈·조율권은 그대로 유지됩니다.</p><div class="branch-list">${refitWeapons(run).map(w=>{const next=Object.keys(GUNS[w.id].branches).find(id=>id!==w.branch);return `<button data-refit="${w.id}"><b>${GUNS[w.id].name} L${w.level} · ${GUNS[w.id].branches[next][0]}</b><small>${GUNS[w.id].branches[w.branch][0]} → ${GUNS[w.id].branches[next][0]}<br>${GUNS[w.id].branches[next][1]}</small></button>`;}).join('')}</div><button data-action="choice-back">취소 · 전리품으로 돌아가기</button></section>`);
}
function showSlots(c){
 subpanel={type:'slots',card:c};const gun=c.kind==='gun';
 panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="slot-title"><span class="eyebrow">LOADOUT / REFIT</span><h2 id="slot-title">${esc(c.title)}</h2><p>${gun?'빈칸에 더하거나 기존 총을 개장합니다.':'한 모듈을 교체합니다. 기존 효과와 강화는 잃습니다.'}</p><div class="branch-list">${gun&&run.weapons.length<3?'<button data-slot="empty"><b>빈 무기 칸에 장착</b><small>현재 공격과 투자를 유지합니다.</small></button>':''}${(gun?run.weapons:run.modules).map((w,i)=>{if(gun&&(w.evolved||w.fusion))return'';const level=gun?(run.refits>0&&run.stage==='field'?Math.min(5,w.level):Math.min(5,1+(run.operation?.region||0)+Math.floor(Math.max(0,w.level-1-(run.operation?.region||0))/2))):null;return `<button data-slot="${i}"><b>${gun?`${GUNS[w.id].name} L${w.level} → ${GUNS[c.weapon].short} L${level}`:`${MODULES[w.id].name} ${w.rank}강화 교체`}</b><small>${gun&&run.refits>0&&run.stage==='field'?'무료 개장 1회 소비 · 분화 재선택':gun?'일부 투자만 이전 · 분화 재선택':'기존 모듈 효과 소멸'}</small></button>`;}).join('')}</div><button data-action="choice-back">취소 · 무장 유지</button></section>`);
}
function present(force=false){
 if(mode==='home'){if(force)showHome();return;}
 const key=`${run.phase}:${JSON.stringify(run.choice)}:${JSON.stringify(run.choices.map(c=>[c.id,c.title,c.rank]))}`;if(!force&&key===stamp)return;stamp=key;subpanel=null;
 if(run.phase==='choice')showChoices();else if(run.phase==='paused')showPause();else if(run.phase==='result')showResult();else ui.innerHTML='';
}
function savingError(error,next,draft){pending={next,draft};const conflict=error.code==='CONFLICT';panel(`<section class="sheet compact" role="alertdialog" aria-modal="true" aria-labelledby="save-error-title"><span class="eyebrow">${conflict?'SAVE CHANGED':'SAVE INTERRUPTED'}</span><h2 id="save-error-title">${conflict?'최신 기록을 불러와 주세요.':'기록을 확정하지 못했습니다.'}</h2><p>${esc(error.message)}<br>${conflict?'다른 탭의 최신 기록을 불러올 수 있습니다.':'후보·장비·기록은 같은 결과로 다시 저장합니다.'}</p><button class="primary" data-action="${conflict?'reload-latest':'retry'}">${conflict?'최신 저장 불러오기':'같은 기록 다시 저장'}</button></section>`);}
async function commitDraft(draft,next){
 if(busy)return false;setBusy(true);committingPlay=draft.phase==='playing';if(!committingPlay){controls?.reset();keys.clear();}
 try{const previous=profile();await store.commit(next);operationPlan.committed(previous,next,draft);run=draft;saveClock=0;pending=null;setBusy(false);committingPlay=false;present(true);if(pauseQueued){pauseQueued=false;if(run.phase!=='result')await mutate(d=>{pause(d);return true;});}return true;}catch(error){setBusy(false);committingPlay=false;pauseQueued=false;savingError(error,next,draft);return false;}
}
async function mutate(fn){if(busy||pending||!run)return;const draft=snapshot(run);if(fn(draft)===false)return;const p=profile(),next=draft.result?settleProfile(p,draft):checkpointProfile(p,draft);await commitDraft(draft,next);}
async function persistCurrent(){if(busy||pending||!run)return;if(!profile().active&&run.phase!=='result')return;await commitDraft(snapshot(run),run.result?settleProfile(profile(),run):checkpointProfile(profile(),run));}
async function launch(seed){
 if(busy||pending)return;
 audio.unlock();
 const {run:draft,next}=freshSortie(profile(),seed??operationPlan.seed);
 mode='battle';document.body.dataset.scene='battle';selectedDoctrine='reserve';
 await commitDraft(draft,next);
}
async function selectCard(id,args={}){const c=run.choices.find(c=>c.id===id);if(!c)return;if(!subpanel)choiceOrigin={scroll:ui.scrollTop,selector:`[data-choice="${CSS.escape(c.id)}"]`};
 if(c.kind==='refit'&&!args.weapon){showRefits(c);return;}
 if(c.kind==='rank'&&run.weapons.find(w=>w.id===c.weapon&&!w.fusion)?.level===3&&!args.branch){showBranches(c,args);return;}
 if(c.kind==='gun'&&args.slot===undefined&&(run.weapons.length>=3||!run.choice.opening&&run.refits>0&&run.weapons.some(w=>w.level>1&&!w.evolved))){showSlots(c);return;}
 if(c.kind==='module'&&!moduleRank(run,c.module)&&run.modules.length>=4&&args.slot===undefined){showSlots(c);return;}
 const details=choiceDetails(run,c),before=run.stats.choices.length;await mutate(d=>choose(d,id,{...args,doctrine:selectedDoctrine}));if(run.stats.choices.length>before&&!pending)equippedFeedback(c,details);
}
ui.addEventListener('change',async e=>{if(e.target.name==='doctrine'){selectedDoctrine=e.target.value;return;}const key=e.target.dataset.setting;if(!key||busy)return;const p=profile();p.settings[key]=e.target.checked;setBusy(true);try{await store.commit(p);if(!p.settings.sound)audio.suspend();}catch(error){notice(error.message);}finally{setBusy(false);nextPanelFocus={selector:`[data-setting="${key}"]`};showSettings();}});
ui.addEventListener('keydown',e=>{const dialog=ui.querySelector('[role="dialog"],[role="alertdialog"]');if(!dialog)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(busy||pending)return;if(subpanel?.type==='settings')closeSettings();else if(subpanel?.type==='retreat'){if(subpanel.fromHome)showHome();else present(true);}else if(subpanel){nextPanelFocus=choiceOrigin;subpanel=null;present(true);}else if(mode==='report'){lobbyTab='archive';showHome();}else if(run?.phase==='paused')pauseButton();return;}if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input,a[href]')].filter(n=>n.getClientRects().length);if(!nodes.length){e.preventDefault();return;}const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first.focus();}}});
ui.addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button||busy||pending&&!['retry','reload-latest'].includes(button.dataset.action))return;
 if(button.dataset.tab){lobbyTab=button.dataset.tab;nextPanelFocus={selector:`.command-nav [data-tab="${CSS.escape(lobbyTab)}"]`};showHome();return;}
 if(button.dataset.brief!==undefined){briefRegion=Number(button.dataset.brief);nextPanelFocus={selector:`[data-brief="${briefRegion}"]`};showHome();return;}
 if(button.dataset.report){const r=profile().recent.find(r=>isReport(r)&&r.sequence===Number(button.dataset.report));if(isReport(r)){mode='report';showResult(r,true);}return;}
 if(button.dataset.research){const next=buyResearch(profile(),button.dataset.research);if(!next)return;setBusy(true);try{await store.commit(next);setBusy(false);lobbyTab='research';nextPanelFocus={selector:`[data-research-item="${CSS.escape(button.dataset.research)}"] h2`};showHome();notice('연구 완료 · 다음 작전 첫 유효 보급에 새 모듈 후보가 나타납니다.');}catch(error){notice(error.message);}finally{setBusy(false);}return;}
 if(button.dataset.choice){await selectCard(button.dataset.choice);return;}
 if(button.dataset.refit){const w=refitWeapons(run).find(w=>w.id===button.dataset.refit);if(w)await selectCard(subpanel.card.id,{weapon:w.id,branch:Object.keys(GUNS[w.id].branches).find(id=>id!==w.branch)});return;}
 if(button.dataset.branch){const {card,args}=subpanel;await selectCard(card.id,{...args,branch:button.dataset.branch});return;}
 if(button.dataset.slot!==undefined){const c=subpanel.card,slot=button.dataset.slot==='empty'?undefined:Number(button.dataset.slot),args={slot};if(c.kind==='gun'&&slot!==undefined){const old=run.weapons[slot],level=run.refits>0&&run.stage==='field'?Math.min(5,old.level):Math.min(5,1+(run.operation?.region||0)+Math.floor(Math.max(0,old.level-1-(run.operation?.region||0))/2));if(level>=4){showBranches(c,args);return;}}await selectCard(c.id,{...args,slot:slot===undefined?-1:slot});return;}
 if(button.dataset.exclude){await mutate(d=>banish(d,button.dataset.exclude));return;}
 const a=button.dataset.action;if(a==='launch'){await launch();return;}if(a==='same-seed'){const seed=Number(button.dataset.seed);if(Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295)await launch(seed);else notice('지난 전장의 코드를 읽지 못했습니다.');return;}if(a==='home'){lobbyTab=button.dataset.target||'mission';briefRegion=null;showHome();return;}if(a==='settings-menu'){showSettings();return;}if(a==='settings-back'){closeSettings();return;}if(a==='last-report'){const report=profile().recent[0];if(!report?.stats||!Array.isArray(report.weapons)||!Array.isArray(report.modules)){notice('전투 보고서를 읽지 못했습니다.');return;}mode='report';showResult(report,true);return;}
 if(a==='end-saved'){run=restore(profile().active.run);showRetreat(true);return;}
 if(a==='retreat'){showRetreat();return;}if(a==='retreat-cancel'){if(subpanel?.fromHome)showHome();else present(true);return;}if(a==='retreat-confirm'){mode='battle';document.body.dataset.scene='battle';await mutate(d=>d.result?true:finish(d,false));return;}
 if(a==='retry'){const {next,draft}=pending;pending=null;await commitDraft(draft,next);return;}
 if(a==='reload-latest'){location.reload();return;}
 if(a==='choice-back'){nextPanelFocus=choiceOrigin;subpanel=null;present(true);return;}if(a==='raid-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="raid-menu"]'};showRaid();return;}
 if(a==='banish-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="banish-menu"]'};subpanel={type:'banish'};const options=banishOptions(run);panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="banish-title"><span class="eyebrow">BANISH / 이번 판에서 제외</span><h2 id="banish-title">보급 후보 하나를 바꾼다</h2><div class="branch-list">${options.map(c=>`<button data-exclude="${esc(c.id)}">${esc(c.title)}${c.module&&moduleRank(run,c.module)?' · 이 상자만 교체':' · 이번 판 후보 제외'}</button>`).join('')}</div><small>${options.length?'미보유 후보는 이번 판에서 제외합니다. 보유 모듈은 이 상자의 후보만 교체하고 기존 투자를 유지합니다.':'현재 제외할 후보가 없습니다. 첫 두 보급의 새 총 기회는 보호됩니다.'}</small><button data-action="choice-back">돌아가기</button></section>`);return;}
 await mutate(d=>{if(a==='continue'){resume(d);return true;}if(a==='reroll'){const ok=reroll(d);if(ok)notice('새 보급 후보를 확인하세요.');return ok;}if(a==='skip')return skip(d);if(a==='withdraw'){const ok=action(d,'withdraw');if(ok)resume(d);return ok;}if(a==='challenge'){resume(d);return action(d,'challenge');}if(a?.startsWith('raid:'))return action(d,a);return false;});
});
async function pauseButton(){if(!run||mode!=='battle'||pending)return;if(busy){if(committingPlay||run.phase==='playing')pauseQueued=true;return;}await mutate(d=>{if(d.phase==='paused')resume(d);else pause(d);return true;});}
$('pause').addEventListener('click',pauseButton);$('gear').addEventListener('click',()=>mutate(d=>action(d,'gear')));
$('pursuit').addEventListener('click',()=>mutate(d=>action(d,'challenge')));
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase(),moving=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k);
 // Keep physical movement state across asynchronous choice/save commits.
 if(mode==='battle'&&run&&moving&&(run.phase==='playing'||committingPlay)){keys.add(k);e.preventDefault();}
 if(e.repeat)return;if(mode!=='battle'||!run||pending)return;
 if(e.key==='Escape'){e.preventDefault();pauseButton();return;}
 if(busy)return;
 if(run.phase==='choice'&&!subpanel&&/^[1-9]$/.test(e.key)){e.preventDefault();const c=run.choices[Number(e.key)-1];if(c)selectCard(c.id);return;}
 if(run.phase!=='playing')return;if(k===' ')e.preventDefault();const a=({' ':'dash',e:'skill',f:'interact',g:'gear',q:'challenge'})[k];if(a){audio.unlock();mutate(d=>action(d,a));}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&mode==='battle'&&run.phase==='playing')mutate(d=>{pause(d);return true;});});
window.addEventListener('blur',()=>{keys.clear();controls?.reset();if(run&&mode==='battle'&&run.phase==='playing'&&!busy)mutate(d=>{pause(d);return true;});});
function updateMap(){
 const key=`${run.seed}:${Math.floor(run.t*5)}:${run.stage}:${run.operation?.region}:${run.raid?.state}:${run.challenge?.state}:${run.sites.map(n=>n.state).join()}`;if(key===mapStamp)return;mapStamp=key;
 const dot=(cls,x,y,r,color,label='')=>`<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"${label?` aria-label="${esc(label)}"`:''}/>`;
 let map=terrainSvg(run.operation?.region||0)+run.hazards.filter(h=>!h.hit).map(h=>h.lane?`<rect class="map-danger-lane" x="${h.x-h.w/2}" y="${h.y-h.h/2}" width="${h.w}" height="${h.h}" fill="#ee975e66" stroke="#ffda99" stroke-width="8"/>`:dot('map-danger',h.x,h.y,h.r,'#f77e778c')).join('');
 map+=run.blocks.filter(b=>b.hp!==0).map(b=>`<rect class="map-block" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#71837e"/>`).join('');
 map+=run.gems.map(g=>dot('map-xp',g.x,g.y,g.salvage?14:9,g.salvage?'#f5d487':'#a5ddcc')).join('');
 map+=run.enemies.filter(e=>!e.dead).map(e=>dot('map-enemy',e.x,e.y,e.cohort==='challenge'?24:e.type==='officer'?19:13,e.cohort==='challenge'?'#efb6ff':e.type==='officer'?'#f7b58d':'#d28257')).join('');
 map+=run.sites.filter(n=>n.state!=='done').map(n=>dot('map-site',n.x,n.y,n.state==='ready'?36:25,n.kind==='armory'?'#c5a8f5':'#ffe0a1',`${n.name} · ${n.state==='ready'?'회수 가능':n.state==='active'?n.kind==='relay'?`해킹 ${Math.round(n.progress/5*100)}%`:'경비 교전':'미확보'}`)).join('');
 map+=run.sites.filter(n=>n.state!=='done').map(n=>siteSymbol(n,n.x,n.y,22)).join('');
 if(run.stage==='field')map+=dot('map-boss-entry',800,350,34,'#ef8e64','보스 진입');
 if(run.boss.active){const b=run.boss;map+=dot('map-boss',b.x,b.y,50,'#ef8e64',run.operation?region(run).boss:'장갑 수송차')+`<line class="map-boss-facing" x1="${b.x}" y1="${b.y}" x2="${b.x+Math.cos(b.body)*120}" y2="${b.y+Math.sin(b.body)*120}" stroke="#ef8e64" stroke-width="16"/>`;}
 const gate=exitGate(run);if(gate)map+=gateSymbol(gate);
 if(run.raid?.state==='active')map+=dot('map-courier',run.raid.target.x,run.raid.target.y,35,'#d7afff','습격 수송대');
 if(run.challenge?.state==='active'&&run.challenge.type==='defend'){
  const {x,y,r}=DEFENSE_ZONE;
  map+=`<circle class="map-defense" cx="${x}" cy="${y}" r="${r}" fill="#cfa5e344" stroke="#f1c8fb" stroke-width="12" aria-label="중계기 방어 구역"/>`;
 }
 const signal=signalCourier(run);
 if(signal)map+=`<path d="M${SIGNAL_ROUTE.x} ${SIGNAL_ROUTE.end}V${signal.y}" stroke="#e4bbeb" stroke-width="13" stroke-dasharray="22 14"/>`+dot('map-signal',signal.x,signal.y,42,'#e8b8fb','탈출 차량');
 map+=dot('map-player',run.player.x,run.player.y,30,'#fff7d9','피오');$('tactical-map').innerHTML=map;
}
function updateHud(){
 const battle=mode==='battle'&&run;$('hud').hidden=!battle;$('hud').inert=!!battle&&run.phase!=='playing';$('controls').hidden=!battle||run.phase!=='playing'||!!pending;if(!battle){$('field-feedback').hidden=true;return;}const p=run.player;updateMap();$('map-panel').querySelector('span').textContent=`${region(run).name} · 작전도`;
 $('level').textContent=`LV.${run.level}`;$('hp').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;document.body.classList.toggle('low-hp',p.hp/p.maxHp<.3);$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('charge').textContent=p.overdrive>0?`전탄 보급 ${p.overdrive.toFixed(1)}초`:`전탄 보급 ${Math.floor(p.charge)}%`;
 $('kills').textContent=`${run.stats.kills} K.O.`;$('score').textContent=`${run.stats.score.toLocaleString()}점 · 확보 ${operationCredits({operation:run.operation,stats:run.stats,won:false})}C`;$('time').textContent=fmt(run.t);$('xp-fill').style.width=`${run.xp/xpNeeded(run)*100}%`;
 const front=run.operation?.region;
 const coastSite=front===0&&run.stage==='field'&&run.weapons.some(w=>w.id===run.firstNew)
  ?run.sites.find(n=>n.coastApproach&&n.coastApproach===run.firstNew&&n.state!=='done'):null;
 const localSite=run.stage!=='boss'?run.sites.filter(n=>['active','ready'].includes(n.state)&&distance(n,p)<260).sort((a,b)=>distance(a,p)-distance(b,p))[0]:null;
 const gate=exitGate(run),holdout=!!(gate&&run.operation),interact=interaction(run);
 const bossName=run.operation?region(run).boss:'장갑 수송차';
 const bossTarget={name:bossName,x:run.boss.active?run.boss.x:800,y:run.boss.active?run.boss.y:350};
 const focusBoss=run.boss.active||(interact?.id==='boss'&&!interact.blocked)||run.stats.completedBuild&&!localSite;
 const next=gate||(focusBoss?bossTarget:coastSite||localSite||run.sites.filter(n=>n.state!=='done').sort((a,b)=>distance(a,p)-distance(b,p))[0]||bossTarget);
 const direction=['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(Math.atan2(next.y-p.y,next.x-p.x)/(Math.PI/4))+8)%8];
 $('operation-track').textContent=run.operation?REGIONS.map((d,i)=>`${i<run.operation.region?'✓':i===run.operation.region?'▶':'○'} ${d.name}`).join('  /  '):'';
 $('stage').textContent=run.operation?`${run.operation.region+1}/3 ${region(run).name}${run.stage==='holdout'?' · 돌파 완료':run.stage==='boss'?' · 보스 교전':''}`:run.powerWave&&run.stage==='field'?'POWER TEST / 완성 화력 전개':run.stage==='holdout'?'MISSION CLEAR / 잔류 가능':run.stage==='boss'?'ARMORED CARRIER':'BEACHHEAD / 해안 침투';
 const wave=run.powerWave,showcase=wave?.showcase&&wave.paired>0;
 const reinforcements=showcase?run.stage==='boss'&&run.boss.mode!=='recover'?' · 재장전 때 시험 공세':` · 화력 시험 ${wave.paired}회 남음`:wave&&run.stage==='field'?` · 증원 ${wave.remaining}명 남음`:'';
 $('objective').textContent=`${direction} ${next.kind?sitePresentation(next).name:next.name} · ${Math.round(distance(p,next)/10)}m`;const siteHint=next.state==='active'?next.kind==='relay'?` · 범위 안에서 해킹 ${Math.round(next.progress/5*100)}%`:` · 경비 ${run.enemies.filter(e=>!e.dead&&e.siteId===next.id).length}명, 이동하며 제압`:next.state==='ready'?' · 제압 완료, 접근해 회수':'';$('threat').textContent=`경계 ${run.pressure}${siteHint}${run.challenge?` · 도전${run.challenge.tier||1} ${run.challenge.state==='complete'?'완료':'진행'}`:''}${reinforcements}`;
 const fieldIntel=$('field-intel');
 const intel=coastSite&&next===coastSite?COAST_APPROACHES[coastSite.coastApproach].hint:front===0&&run.sites[0]?.state!=='done'&&run.sites[0]?.opening?`${beachRoute(run.seed).name} · 구출 후 F / R 선택`:front===0&&run.sites[0]?.state!=='done'&&run.sites[0]?.gun?`${beachRoute(run.seed).name} · ${GUNS[run.sites[0].gun].name} 보급`:front===1&&run.sites.some(site=>site.kind==='relay'&&site.state==='done')?'중계기 연결 · 차선 예고 +0.4초':front===2&&run.operation.jammed?'통신 교란 중 · 증원 6 → 3':front===2&&run.stage==='field'?'관제소 교란으로 후방 박격포 감소':'';
 fieldIntel.hidden=!intel||holdout;fieldIntel.textContent=intel;
 document.body.classList.toggle('holdout-active',holdout);
 $('holdout-intel').hidden=!holdout;
 const pursuit=$('pursuit');
 pursuit.hidden=!holdout||run.raid?.state==='active'||run.challenge?.state==='active';
 if(holdout){
  const contract=holdoutContract(run),challenge=run.challenge;
  pursuit.disabled=contract.id==='hunt'&&run.enemies.filter(e=>!e.dead).length>158;
  const tier=holdoutTier(run.holdTime),nextWave=Math.ceil(HOLDOUT.grace+tier*HOLDOUT.tierSeconds-run.holdTime);
  const nearGate=interact?.id==='extract',finalFront=run.operation.region===REGIONS.length-1;
  const contractTier=(run.operation.challengeTier||0)+1;
  const active=challenge?.state==='active';
  const rewardTier=active?challenge.tier:contractTier;
  let detail=contract.risk;
  if(active&&challenge.type==='defend'){
   const inside=distance(p,DEFENSE_ZONE)<=DEFENSE_ZONE.r;
   detail=`${inside?'방어 중':`중계기 ${Math.round(distance(p,DEFENSE_ZONE)/10)}m`} · ${Math.min(challenge.progress,challenge.duration).toFixed(1)} / ${challenge.duration}초`;
  }else if(active&&challenge.type==='intercept'){
   detail=`이탈까지 ${Math.ceil(challenge.timeLeft)}초 · 차량 HP ${Math.ceil(challenge.target.hp)}`;
  }else if(active){
   const left=run.enemies.filter(e=>!e.dead&&challenge.targets.includes(e.id)).length;
   detail=`지휘관 ${2-left}/2명 제압`;
  }else if(challenge?.state==='failed')detail='차량 이탈 · 같은 단계 재도전 가능';
  if(run.raid?.state==='active')detail='습격 종료 후 잔류 도전 가능';
  $('objective').textContent=nearGate?finalFront?'게이트 · 귀환 또는 잔류':'게이트 · 전진 또는 잔류':`${direction} ${finalFront?'귀환':'전진'} 게이트 · ${Math.round(distance(p,gate)/10)}m`;
  $('threat').textContent=tier===0?`첫 증원까지 ${nextWave}초`:tier===HOLDOUT.maxTier?`공세 ${tier}/${HOLDOUT.maxTier} · 최대 증원`:`공세 ${tier}/${HOLDOUT.maxTier} · 강화까지 ${nextWave}초`;
  const steps=$('holdout-steps');
  for(let i=0;i<steps.children.length;i++)steps.children[i].classList.toggle('active',i<tier);
  $('ground-xp').textContent=groundXp(run);
  $('pursuit-goal').textContent=active?`D${challenge.tier} · ${contract.name}`:contract.id==='defend'?`중계기 반경 안에서 ${defenseSeconds(contractTier)}초 버티기`:contract.goal;
  $('pursuit-intel').textContent=detail;
  $('pursuit-pay').textContent=rewardTier===1?(finalFront?`보상 · 화물 ${CARGO_CREDITS}C 또는 후송 보급`:'다음 전선 보급 · 철갑 / 돌격 / 회수 중 택 1'):`완료 점수 +${rewardTier*500}`;
  $('pursuit-label').textContent=pursuit.disabled?'도전 대기 · 적 밀집':`D${contractTier} · ${contract.name}`;
 }
 const maneuver=$('maneuver-status'),active=activeManeuver(p);
 maneuver.hidden=!p.maneuver;maneuver.classList.toggle('active',!!active);
 if(p.maneuver)maneuver.textContent=`${MANEUVERS[p.maneuver].name} · ${active?'가동':p.maneuver==='assault'?'회피하며 이동':'정지해 조준'}`;
 const support=FRONT_SUPPORTS[run.operation?.support];
 $('support-status').hidden=!support;
 if(support)$('support-status').textContent=`${support.name} · ${support.role}`;
 $('combo').textContent=run.combo>=8?`${run.combo} 연속 처치`:'';
 const key=JSON.stringify([run.weapons.map(w=>[w.id,w.level,w.branch,w.evolved,w.fusion]),run.modules,run.tuning]);if(key!==inventoryStamp){inventoryStamp=key;$('weapons').innerHTML=run.weapons.map(w=>`<div class="weapon ${w.evolved?'evolved':''}" data-weapon-id="${w.id}">${itemArt(w.id)}<b>${w.fusion?`${GUNS[w.id].short}+${GUNS[w.fusion.secondary].short}`:GUNS[w.id].short}</b><small>${w.fusion?'전도 격발망':w.evolved?'단일 진화':`L${w.level}/6 ${w.branch?GUNS[w.id].branches[w.branch][0]:''}`}</small></div>`).join('')+Array.from({length:3-run.weapons.length},()=>'<div class="weapon empty"><b>＋</b><small>미확보</small></div>').join('');$('modules').innerHTML=run.modules.map(m=>`<span class="module">${MODULES[m.id].name} ${m.rank}</span>`).join('');}
 const fusion=run.weapons.find(w=>w.fusion),synergy=$('synergy');
 synergy.classList.toggle('conductive',!!fusion);
 synergy.textContent=fusion?`연쇄탄 ${Math.min(RULES.fusion.hitsPerPayload,Math.floor(fusion.payload))}/${RULES.fusion.hitsPerPayload} · 도약 ${run.stats.payloadRelays||0}회`:moduleRank(run,'catalyst')?`점화 ${[...run.enemies,...(run.boss.active?[run.boss,...run.boss.parts]:[]),...(run.raid?.state==='active'?[run.raid.target]:[])].filter(e=>!e.dead&&e.hp>0&&e.burn>0).length} · 열압 ${run.stats.heatBursts}회`:'';
 if(moduleRank(run,'shrapnel'))synergy.textContent+=`${synergy.textContent?' · ':''}파쇄 ${run.stats.shrapnelBursts||0}회`;
 const options=assemblyOptions(run),ready=options.find(o=>['evolve','fusion'].includes(o.kind));$('gear').textContent=`${options.some(o=>o.kind==='maneuver')?'노획 교범 선택':ready?`${ready.title} 조립 가능`:'병기 개조'} · 조율권 ${run.tuning} [G]`;
 for(const el of $('weapons').children)el.classList.toggle('just-equipped',performance.now()<equippedUntil&&el.dataset.weaponId===equippedWeapon);$('field-feedback').hidden=mode!=='battle'||run.phase!=='playing'||performance.now()>equippedUntil;
 $('interact').hidden=!interact||!!interact.blocked;$('interact-label').textContent=interact?.label||'';
 const skill=RULES.fio[p.doctrine];$('skill').disabled=p.charge<skill.cost||p.skillCd>0||p.overdrive>0;$('skill').innerHTML=`전탄 보급<small>${p.overdrive>0?`${p.overdrive.toFixed(1)}초 가동`:p.skillCd>0?`${p.skillCd.toFixed(1)}초`:`${Math.floor(p.charge)}/${skill.cost}`}</small>`;$('dash').disabled=p.dashCd>0;$('dash').innerHTML=`회피<small>${p.dashCd>0?`${p.dashCd.toFixed(1)}초`:'준비 · SPACE'}</small>`;
 const raid=run.raid?.state==='active';$('raid-hud').hidden=!raid;document.body.classList.toggle('raid-active',raid);if(raid){$('raid-progress').value=run.raid.progress/run.raid.maxProgress;$('raid-hp').textContent=`${run.raid.contract==='armored'?'장갑 수송대':'보급차'} ${Math.ceil(run.raid.target.hp)} / ${run.raid.target.maxHp}`;}
 $('boss-hud').hidden=!run.boss.active;document.body.classList.toggle('boss-active',run.boss.active);if(run.boss.active){$('boss-hp').max=run.boss.maxHp;$('boss-hp').value=run.boss.hp;$('boss-state').textContent=front===1?(run.boss.mode==='recover'?'재장전 · 반격 기회':'포격 열차 · 예고 차선 밖으로 이동'):front===2?(run.boss.mode==='recover'?'코어 노출 · 집중 공격':'지휘 병기 · 붉은 원 밖으로 회피'):run.boss.mode==='recover'?'후면 엔진 노출 · 뒤를 노려라':run.boss.mode==='windup'?'돌진 예고 · 옆으로 회피':'장갑 수송차 · 측후면을 노려라';const names=front===1?['좌측 포대','우측 포대']:front===2?['포탑','측면 장갑']:['포탑','궤도'];$('boss-parts').textContent=names.map((name,i)=>`${name} ${run.boss.parts[i].hp>0?'가동':'파괴'}`).join(' / ');const tactic=supportTactic(run.operation?.support,front);$('boss-tactic').hidden=!tactic;$('boss-tactic').textContent=tactic;}
}
const fieldCues={shot:'swarm-shot','rocket-shot':'scatter-shot',flame:'flame-loop',heat:'heat-break','fire-spread':'fire-spread',kill:'wood-kill',explosion:'power-kill','salvo-impact':'power-kill','payload-impact':'burst',hurt:'hurt',complete:'forge-evolve',skill:'burst',choose:'choose','boss-warning':'boss-warning','boss-down':'armor-collapse','challenge-clear':'rampage','region-entry':'front-entry','raid-success':'forge-evolve',heal:'heal',break:'crowd-break'};
const bannerPriority=['region-entry','gate-open'];
function processEvents(){
 const banner=$('banner'),events=new Set(takeEvents(run));
 if(banner.dataset.kind&&(mode!=='battle'||bannerRunId!==run.runId||run.t>=bannerUntil)){
  banner.textContent='';delete banner.dataset.kind;
 }
 if(mode!=='battle'||!events.size)return;
 if(store.settings().sound){
  const cues=new Set([...events].map(event=>fieldCues[event]).filter(Boolean));
  if(cues.has('heat-break')){cues.delete('power-kill');cues.delete('wood-kill');}
  for(const cue of selectAudioEvents(cues))audio.play(cue,0,run.weapons.some(w=>w.evolved));
  if(events.has('xp-pickup')&&!cues.has('hurt')&&!cues.has('armor-collapse'))audio.play('xp',0);
 }
 const priority=bannerPriority.find(type=>events.has(type));
 if(!priority&&bannerPriority.includes(banner.dataset.kind))return;
 const fx=run.effects.findLast(f=>priority?f.type===priority:events.has(f.type)&&(f.text||['boss-arrival','boss-down','raid-start'].includes(f.type)));
 if(!fx)return;
 bannerRunId=run.runId;banner.dataset.kind=fx.type;
 bannerUntil=run.t+(priority?2.1:1.5);
 if(fx.type==='region-entry'){
  const kit=FRONT_SUPPORTS[run.operation.support];
  banner.innerHTML=`<span>전선 ${String(run.operation.region+1).padStart(2,'0')} / 03</span><strong>${esc(region(run).name)}</strong><small>${esc(kit?`${kit.name} 장착 · ${kit.role}`:region(run).mission)}</small>`;
 }else if(fx.type==='gate-open'){
  banner.innerHTML=`<span>${esc(region(run).boss)} 격파</span><strong>${esc(exitGate(run).name)} 개방</strong><small>현장 XP 회수 · ${HOLDOUT.grace}초 후 증원</small>`;
 }else{
  banner.textContent=fx.text||({'boss-arrival':region(run).boss,'boss-down':`${region(run).name} 돌파`,'raid-start':'수송대 습격 시작'})[fx.type];
 }
}

function frame(now){
 const elapsed=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
 if(run&&mode==='battle'&&run.phase==='playing'&&!busy&&!pending){if(elapsed>.5){mutate(d=>{pause(d);return true;});accumulator=0;}else{const previousStage=run.stage;accumulator+=Math.min(.1,elapsed);const input={x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+touch.x,y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+touch.y};while(accumulator>=1/60&&run.phase==='playing'){step(run,1/60,input,renderer.view());accumulator-=1/60;saveClock+=1/60;}if(run.phase!=='playing'){persistCurrent();accumulator=0;}else if(saveClock>=5||previousStage==='boss'&&run.stage==='holdout')persistCurrent();}}
 if(renderer&&run)renderer.draw(run,store.settings().reduced||reduceMotion.matches);if(store&&run){updateHud();if(!busy&&!pending)processEvents();}requestAnimationFrame(frame);
}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
async function boot(){
 try{const lock=navigator.locks?fn=>navigator.locks.request(`${STORAGE_KEY}:write`,fn):null;store=createStore(localStorage,lock);controls=bindTouchControls({stick:$('stick'),actions:{dash:$('dash'),skill:$('skill'),interact:$('interact')},canPlay:()=>mode==='battle'&&run?.phase==='playing'&&!busy&&!pending,onMove:v=>{touch=v;},onAction:a=>mutate(d=>action(d,a)),onUnlock:()=>{if(profile().settings.sound)audio.unlock();}});
  try{art=await loadMissionArt();}catch{notice('전장 원화를 불러오지 못해 기본 표시로 실행합니다.');}
  const p=profile();operationPlan=createOperationPlan(()=>crypto.getRandomValues(new Uint32Array(1))[0],p.active?.run.seed??p.recent[0]?.seed);
  run=createOperation(17);renderer=createRenderer($('world'),art);showHome();requestAnimationFrame(frame);
 }catch(error){panel(`<section class="sheet compact"><span class="eyebrow">LOAD INTERRUPTED</span><h2>작전 기록을 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button data-action="reload-latest">기록 다시 불러오기</button></section>`);}
}
boot();
