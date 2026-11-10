import {OPERATORS,operatorOf,operatorId,skillRules,canUseSkill,chargeLabel} from './operator.js';
import {createOperationPlan} from './operation-plan.js';
import {choiceDetails,growthForecast,isQuickMod} from './choice-details.js';
import {terrainSvg,siteSymbol,sitePresentation,gateSymbol,entryRouteSvg,escapeRouteSvg,orderPinSvg,raidRouteSvg,raidPreview} from './field-scene.js';
import {RAID_MARKS,raidSeconds,raidTimeLeft,raidAhead,raidOnNose} from './raid.js';
import {coastChargeLane} from './coast-charge.js';
import {lobbyView,reportView,isReport,loadoutChips,itemArt,moduleIcon} from './interface.js';
import {REGIONS,HOLDOUT,MANEUVERS,FRONT_SUPPORTS,PORT_SUPPORT,RESEARCH,requisitionSite,CARGO_CREDITS,DEFENSE_ZONE,SIGNAL_COLOR,signalRoute,signalLane,signalLaneLabel,sortieOrder,orderTarget,COAST_APPROACHES,coastStrike,coastStrikeArmed,claimedCoastLead,coastApproach,activeEntry,entryWaypoint,railGarrison,railCrewLeft,coastLead,coastLeadColor,coastEncounterCue,frontTactic,railDisarmed,railGunOf,portBreachFlank,portFlankPoint,portCoreWindow,portCoreDisrupted,portCoreReach,portTurretShutter,portGantry,portGantryBypass,portTurretSide,portBarrageAxis,portBarrageMark,portRakeReady,portAidCue,portAidCounterReady,holdoutParts,canAdvanceWithVanguard,beachRoute,supportTactic,defenseSeconds,holdoutContract,signalCourier,exitGate,groundXp,holdoutTier,region,operationCredits} from './campaign.js';
import {GUNS,MODULES,QUALITY,RULES,buildPaths,distance,blastContactRadius,evolutionParts,heatSynergyReady,moduleRank,refitWeapons} from './content.js';
import {restore,snapshot,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,assemblyOptions,gatePreparation,canOpenLevel,activeManeuver,interaction,xpNeeded,takeEvents,portTurretInSight,showcaseWindow} from './model.js';
import {createStore,buyResearch,canLaunchOrder,canReserveResearch,freshSortie,checkpointProfile,settleProfile,STORAGE_KEY} from './profile.js';
import {createRenderer} from './render.js';
import {loadFioPortrait,loadOperatorPortrait,loadMissionArt,missionImageUrl,MISSION_ART_COUNT,operatorPortrait} from '../mission/art.js';
import {bindTouchControls} from '../game/touch-controls.js';
import {createAudio,selectAudioEvents} from '../game/audio.js';
const $=id=>document.getElementById(id),ui=$('ui'),keys=new Set(),audio=createAudio(),esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const touchLayout=matchMedia('(max-width:700px), (pointer:coarse)');
const combatHud={rects:[]};
function watchCombatHud(){
 if(typeof ResizeObserver!=='function')return;
 const panels=[$('boss-hud'),$('map-panel'),document.querySelector('.arsenal'),$('stick'),document.querySelector('.action-buttons')];
 const measure=()=>{combatHud.rects=panels.map(panel=>panel.getBoundingClientRect()).filter(rect=>rect.width&&rect.height);};
 const observer=new ResizeObserver(measure);
 panels.forEach(panel=>observer.observe(panel));
 window.addEventListener('resize',measure);
}
let store,run,operationPlan,renderer,controls,mode='home',busy=false,committingPlay=false,pauseQueued=false,pending=null,stamp='',inventoryStamp='',mapStamp='',lastFrame=0,accumulator=0,saveClock=0,touch={x:0,y:0},selectedDoctrine='reserve',subpanel=null,noticeTimer,bannerUntil=0,bannerRunId=null,lobbyTab='mission',briefRegion=null,sortieOrderSelection=null,requisitionSelection=null,selectedOperator='fio',nextPanelFocus=null,choiceOrigin=null,settingsOrigin=null,reportOrigin=null,equippedUntil=0,equippedWeapon=null;
let battleArt=null,portraitArt=null,marcoArt=null,marcoArtWork=null,artWork=null,launchPreparation=null,kitPreloaded=false,firstBattleFrame=false;
const profile=()=>store.get();
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4500);}
function setBusy(on){busy=on;document.body.classList.toggle('is-saving',on);ui.setAttribute('aria-busy',String(on));for(const b of ui.querySelectorAll('button')){if(on&&!b.disabled){b.dataset.saving='true';b.disabled=true;}else if(!on&&b.dataset.saving){b.disabled=false;delete b.dataset.saving;}}}
function panel(html){const origin=nextPanelFocus;nextPanelFocus=null;ui.innerHTML=html;ui.scrollTop=origin?.scroll||0;keys.clear();controls?.reset();requestAnimationFrame(()=>{const target=origin?.selector&&ui.querySelector(origin.selector)||ui.querySelector('h1,h2')||ui.querySelector('button:not(:disabled)');if(target){if(!target.matches('button,a,input'))target.tabIndex=-1;target.focus({preventScroll:true});}});}
function settings(){const p=profile();return `<div class="settings"><label><input type="checkbox" data-setting="sound" ${p.settings.sound?'checked':''}><span>전투 효과음<small>사격 · 적중 · 보급 알림</small></span></label><label><input type="checkbox" data-setting="reduced" ${p.settings.reduced?'checked':''}><span>플래시·흔들림 줄이기<small>강한 폭발 효과와 화면 반동을 줄입니다.</small></span></label></div>`;}
function drawPortrait(){
 const canvas=$('portrait'),id=selectedOperator;
 if(!canvas)return;
 const art=id==='marco'?battleArt||marcoArt:portraitArt||battleArt;
 if(art){requestAnimationFrame(()=>{if(mode==='home'&&canvas.isConnected)operatorPortrait(canvas,art,id,240);});return;}
 if(id==='marco'&&!marcoArtWork)marcoArtWork=loadOperatorPortrait().then(loaded=>{marcoArt=loaded;drawPortrait();}).catch(()=>{}).finally(()=>{marcoArtWork=null;});
}
function showHome(){mode='home';subpanel=null;stamp='home';document.body.dataset.scene='lobby';panel(lobbyView(profile(),{tab:lobbyTab,brief:briefRegion,seed:operationPlan.seed,order:sortieOrderSelection,operator:selectedOperator,requisition:requisitionSelection}));drawPortrait();}
function doctrineChoices(){
 if(run.choice.type!=='level'||run.level<6||run.player.branchChosen)return '';
 const actor=operatorOf(run);
 return `<div class="doctrine" role="group" aria-label="${actor.name} 운용"><b>${actor.name} 운용</b>${Object.entries(actor.stances).map(([id,[name,detail]])=>`<label><input type="radio" name="doctrine" value="${id}" ${selectedDoctrine===id?'checked':''}> ${name} · ${detail}</label>`).join('')}</div>`;
}
function showSettings(){if(!settingsOrigin)settingsOrigin={mode,scroll:ui.scrollTop,subpanel};subpanel={type:'settings'};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="settings-title"><span class="eyebrow">야전 환경 설정</span><h2 id="settings-title">전투를 편하게.</h2>${settings()}<p class="stat-note">이동 WASD · 회피 SPACE<br>${mode==='home'?OPERATORS[selectedOperator].skill:operatorOf(run).skill} E · 상황 행동 F<br>대기 개조 R · 진화·합체 G<br>전투는 자동 사격합니다. 메뉴에서는 정지합니다.</p><button class="primary" data-action="settings-back">설정 완료</button></section>`);}
function closeSettings(){const origin=settingsOrigin;settingsOrigin=null;subpanel=origin?.subpanel||null;nextPanelFocus={scroll:origin?.scroll||0,selector:'[data-action="settings-menu"]'};if(mode==='home')showHome();else present(true);}
function showRetreat(fromHome=false){subpanel={type:'retreat',fromHome};const secured=operationCredits({operation:run.operation,stats:run.stats,won:false}),cleared=run.operation?.cleared||0;panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="retreat-title"><span class="eyebrow">작전 종료</span><h2 id="retreat-title">확보한 성과로 귀환할까요?</h2><p>${cleared}/3 전선 돌파 · ${fmt(run.t)} · LV.${run.level}<br>지금 귀환하면 <strong>${secured}C</strong>를 정산합니다. 이번 무장과 레벨은 다음 판에 초기화됩니다.</p><p class="inline-note">${run.raid?.state==='active'?'진행 중인 습격과 걸었던 상자는 포기합니다. ':''}최종 보스 뒤 출구로 탈출해야 완주로 기록됩니다.</p><div class="buttons"><button class="primary" data-action="retreat-cancel">작전 유지</button><button class="danger" data-action="retreat-confirm">종료하고 ${secured}C 정산</button></div></section>`);}

function choiceCards(cards=run.choices){return cards.map((c,i)=>{const d=choiceDetails(run,c),forecast=d.blocked?null:growthForecast(run,c),art=d.art?itemArt(d.art):`<span class="module-engraving">${moduleIcon(c.module||(({advance:'route',extract:'extract',stay:'stay'})[c.kind]||'gear'))}</span>`;return `<button class="upgrade-card ${['evolve','fusion'].includes(c.kind)?'capstone':''}" data-choice="${esc(c.id)}"${d.blocked?' disabled':''}${c.trial?' data-trial="true"':''}><span class="upgrade-category">${esc(c.label||'전술 결정')}</span>${i<9?`<kbd>${i+1}</kbd>`:''}<span class="upgrade-illustration">${art}</span><span class="upgrade-copy"><h3>${esc(d.title)}</h3><strong class="upgrade-impact">${esc(d.impact)}</strong>${d.detail?`<span class="upgrade-detail">${esc(d.detail)}</span>`:''}</span>${d.before?`<span class="upgrade-levels" aria-label="레벨 ${d.before}에서 ${d.after}로">${Array.from({length:6},(_,i)=>`<i class="${i<d.before?'owned':i<d.after?'added':''}"></i>`).join('')}<b>L${d.before} → ${d.after}</b></span>`:''}<span class="upgrade-link${forecast?` forecast-${forecast.kind}`:''}">${esc(forecast?.text||d.link)}</span><span class="upgrade-cost">${esc(d.cost)}</span><span class="install-label">${c.kind==='back'?'돌아가기':['advance','stay','extract'].includes(c.kind)?'결정':c.kind==='permit'?'확보':c.kind==='resupply'?'보급 받기':'장착'} <span>↵</span></span></button>`;}).join('');}
function equippedFeedback(c,d,openingGun,heatActivated){
 if(!['rank','gun','module','tune','repair','evolve','fusion','maneuver','permit','resupply','front-support','cargo','calibrate','coast-strike'].includes(c.kind))return;
 equippedUntil=performance.now()+1900;
 equippedWeapon=c.weapon||c.primary||null;
 const feedback=$('field-feedback');
 if(c.kind==='fusion'||c.kind==='evolve'&&c.weapon==='f'){
  feedback.replaceChildren();feedback.hidden=true;return;
 }
 feedback.classList.toggle('opening-receipt',openingGun);
 if(heatActivated){
  feedback.innerHTML=`${moduleIcon('catalyst')}<div><span>전투 연계 개방</span><b>열압 연계 가동</b><small>불붙은 적에 폭발을 맞히세요.</small></div>`;
 }else if(openingGun){
  feedback.innerHTML=`<div><b>${esc(d.title)} 장착</b><small>${esc(COAST_APPROACHES[c.weapon].name)}로 이동</small></div>`;
 }else{
  const label=c.kind==='coast-strike'?'장갑 수송차 공략 확보':c.kind==='calibrate'?'화차 개장 완료':c.kind==='front-support'?'다음 전선 장비 확보':c.kind==='cargo'?'정산 화물 확보':c.kind==='permit'?'조율권 확보':['repair','resupply'].includes(c.kind)?'현장 보급 완료':'현장 장착 완료';
  feedback.innerHTML=`${d.art?itemArt(d.art):moduleIcon(c.module||'gear')}<div><span>${label}</span><b>${esc(d.title)}${c.kind==='rank'?` L${d.after}`:''}</b><small>${esc(d.impact)}</small></div>`;
 }
 feedback.hidden=false;
}
function workshopBlueprints(){
 const paths=buildPaths(run).filter(p=>p.id!=='fusion:h:r'||p.ready||run.weapons.some(w=>w.id==='r'&&!w.fusion));
 const labels={ready:'조립 가능',active:'장착·가동 중',permit:'조율권 필요',blocked:'조립 제한',progress:'재료 확인'};
 const ready=paths.filter(p=>p.ready).length;
 const tiles=paths.map(p=>{
  const state=p.id==='heat'&&p.ready?'촉매 조율 가능':p.id==='heat'&&p.status==='permit'?'촉매 3 필요':labels[p.status];
  const missing=p.missing&&['progress','permit'].includes(p.status)?`<em>필요 · ${esc(p.missing)}</em>`:'';
  return `<div data-workshop-path="${esc(p.id)}" class="path-${p.status}"><span>${state}</span><b>${esc(p.title)}</b><small>${esc(p.detail)}</small>${missing}</div>`;
 }).join('');
 return `<details class="workshop-blueprints" ${ready?'':'open'}><summary>병기 도면 <small>${ready?`바로 작업할 수 있는 조합 ${ready}개`:'보유 재료와 남은 조건'}</small></summary><div class="build-paths">${tiles}</div></details>`;
}
function gatePreparationView(){
 const prep=gatePreparation(run);
 if(!prep)return '';
 const recipes=buildPaths(run);
 const target=recipes.find(p=>p.id===(run.firstNew==='f'?'evolve:f':run.firstNew==='r'?'fusion:h:r':'evolve:h'));
 const equipped=run.weapons.find(w=>w.evolved&&(w.id===run.firstNew||w.fusion?.secondary===run.firstNew));
 const installed=equipped?.fusion?`전도 격발망 ${GUNS[equipped.id].short}+${GUNS[equipped.fusion.secondary].short}`:equipped?GUNS[equipped.id].evolution:recipes.find(p=>p.complete&&p.id!=='heat')?.title;
 const remaining=!equipped&&target?.missing&&(target.remaining===1&&target.status==='progress'||target.status==='permit')?target:null;
 const capstones=prep.capstones;
 const build=capstones.length
  ?`<button data-action="gate-assemble" aria-keyshortcuts="G"><small>조립 가능 · 조율권 1개</small><b>${esc(capstones.length===1?capstones[0].title:`완성 병기 ${capstones.length}종`)} <span aria-hidden="true">→</span></b></button>`
  :remaining?`<div><small>${esc(remaining.title)}까지</small><b>${esc(remaining.missing)}</b></div>`
  :installed?`<div><small>다음 전선 장착</small><b>${esc(installed)}</b></div>`:'';
 const xp=prep.upgrades?`<button data-action="gate-upgrade" aria-keyshortcuts="R"><small>획득한 XP · 1회 사용</small><b>대기 개조 ${prep.upgrades}회 <span aria-hidden="true">→</span></b></button>`:'';
 return build||xp?`<div class="gate-prep" role="group" aria-label="전진 전 정비">${build}${xp}</div>`:'';
}
function gateChoices(){
 const final=run.operation.region===2,vanguard=canAdvanceWithVanguard(run);
 const orders=run.choices.map((card,index)=>{
  const d=choiceDetails(run,card);
  const lines=card.kind==='advance'?[d.impact,d.detail,d.link,vanguard?d.cost:'']
   :card.kind==='stay'?[d.detail,d.link,vanguard?d.cost:'']
   :[final?'완주 보상과 기록 확정':'확보 보상 정산 · 완주 보너스 없음',d.link];
  const icon={advance:'route',stay:'stay',extract:'extract'}[card.kind];
  return `<button class="gate-order" data-choice="${esc(card.id)}"><span class="gate-order-icon" aria-hidden="true">${moduleIcon(icon)}</span><span class="gate-order-copy"><strong>${esc(d.title)}</strong>${lines.filter(Boolean).map(text=>`<small>${esc(text)}</small>`).join('')}</span><kbd>${index+1}</kbd></button>`;
 }).join('');
 return `<div class="gate-deck" data-count="${run.choices.length}">${orders}</div>`;
}
function showChoices(){
 const coastOptions=run.choices.some(c=>c.kind==='coast-strike');
 const type=run.choice.type,quick=isQuickMod(run),atGate=type==='clear'&&!!run.operation,atPursuit=type==='pursuit-reward',workshop=type==='rail-workshop',title=({level:'야전 개조',supply:run.choice.opening?'첫 무장을 골라라':'노획 병기를 골라라',armory:'확보할까, 걸어볼까','raid-reward':'습격 성공 · 전리품','pursuit-reward':'잔류 보급 선택',assembly:'야전 병기 작업대',clear:run.operation&&run.operation.region<2?'다음 전선이 열렸다':'작전 목표 달성',control:'보스 공략을 골라라','rail-workshop':'화차 정비대'})[type];
 const gateAssembly=type==='assembly'&&run.choice.gatePrep,gateLevel=type==='level'&&run.choice.gatePrep;
 const cards=gateAssembly?run.choices.filter(c=>c.kind!=='back'):run.choices;
 const quality=run.choice.quality,receipt=type==='raid-reward'?`<div class="loot-receipt"><span>걸었던 ${QUALITY[run.choice.wagerQuality]||'기존'} 상자</span><b>→ ${QUALITY[quality]} 보급 탈취</b><small>${run.choice.contract==='light'?'보급차 작업대 · 무기의 발사 방식을 바꿀 기회':'장갑 수송대 · 미완성 병기의 부품을 노린다'}</small></div>`:'',paths=type==='assembly'&&!gateAssembly?workshopBlueprints():'';
 const orderArmory=type==='armory'&&run.choice.siteId==='arsenal'&&run.operation?.region===0&&run.operation.order==='convoy'&&!run.raidUsed;
 const gateIntel=atGate?`<div class="gate-intel"><span><small>돌파 전선</small><b>${esc(region(run).name)}</b></span><span><small>목적지</small><b>${esc(REGIONS[run.operation.region+1]?.name||'작전실')}</b></span><span><small>미회수 XP</small><b>${groundXp(run)}</b></span></div>`:'';
 const tools=atGate?gateIntel+gatePreparationView():run.choice.opening&&!banishOptions(run).length?'':`<div class="choice-tools"><span>공격 ${run.weapons.length}/3 · 모듈 ${run.modules.length}/4 · 조율권 ${run.tuning}</span><div>${['level','supply','armory','raid-reward'].includes(type)?`<button data-action="reroll" ${run.rerolls<=0||run.choice.opening?'disabled':''}>${run.choice.opening?'고정 보급':`재추첨 ${run.rerolls}`}</button><button data-action="banish-menu" ${run.banishes<=0?'disabled':''}>후보 제외 ${run.banishes}</button>`:''}</div></div>`;
 const lead=gateLevel?'개조 한 번을 확정하면 게이트로 돌아갑니다.':gateAssembly?'조립을 마치면 같은 전진 게이트로 돌아갑니다.':type==='level'?(run.pendingLevels?`이번 개조를 골라 장착하세요. 대기 중인 개조 ${run.pendingLevels}회는 전장에 남습니다.`:'한 가지를 골라 전투에 바로 투입하세요.'):atGate?(run.operation.region<2?'전진하거나 현장에 남아 XP를 회수하세요.':'귀환하거나 남아서 추가 점수를 노리세요.'):workshop?'회수한 공구로 이번 판의 무장을 정비하세요.':coastOptions?'무장을 강화하거나 보스 공략을 고르세요.':type==='assembly'?'조립과 정비에 쓸 조율권을 배분하세요.':run.choice.opening?'포로가 건넨 무장으로 해안의 첫 길을 뚫으세요.':run.choice.source.replace('전방 구조 보급','포로 구출 보상').replace('이동 보급대','이동 보급차');
 const gateNote=run.pendingLevels?run.operation?.region===2?`귀환 시 미사용 개조 ${run.pendingLevels}회 소멸`:`대기 개조 ${run.pendingLevels}회 · 전진하면 이월`:'잔류하면 증원군이 강해집니다. 게이트는 계속 열려 있습니다.';
 const deck=atGate?gateChoices():`<div class="upgrade-deck${cards.length===2?' two-options':''}">${choiceCards(cards)}</div>`;
 panel(`<section class="sheet field-menu${gateAssembly?' gate-assembly':''}${coastOptions?' coast-options':''}${type==='level'?' level-draft':''} ${quick?'quick-mod':''}${atGate?' gate-menu':atPursuit?' pursuit-menu':type==='control'?' control-menu':workshop?' rail-workshop':run.choice.opening?' opening-supply':''}" role="dialog" aria-modal="true" aria-labelledby="choice-title"><header><div><span class="eyebrow">${type==='level'?`LV.${run.level} · 현장 정비`:type==='assembly'?'병기 조립':type==='clear'?'게이트 통과':atPursuit?'잔류 도전 D1':workshop?'철도 · 현장 정비':'노획 · 현장 보급'} ${quality?' / '+QUALITY[quality]:''}</span><h2 id="choice-title">${title}</h2><p>${esc(lead)}</p></div><span class="paused">${atGate?'Ⅱ 전투 정지':'Ⅱ 정비 중'}</span></header>${coastOptions?'':tools}${doctrineChoices()}${receipt}${paths}${orderArmory?'<p class="armory-order-note">보급선 절단 · 경량 보급차를 저지해야 지령을 완료합니다. 여기서 보급을 받거나 건너뛰면 지령 기회를 잃습니다.</p>':''}${deck}${coastOptions?tools:''}<footer class="choice-footer"><small>${gateAssembly?'조립 한 번에 조율권 1개를 사용합니다.':type==='assembly'?`조율권 ${run.tuning}개 · ${run.tuning?'정비와 진화가 같은 조율권을 사용합니다.':(run.operation?.cleared||0)<2?'중간 보스 격파 시 1개를 확보합니다.':'중간 보스의 조율권을 모두 사용했습니다.'}`:type==='control'?'하나를 선택하세요. 이번 전선의 보스전에 적용됩니다.':type==='clear'?gateNote:atPursuit?(run.operation.region<2?'선택한 장비는 다음 전선 한 곳에서 작동합니다.':'화물을 정산하거나 후송 보급을 써서 더 버티세요.'):workshop?'정비 보급은 한 가지 · 변경한 발사 방식은 항구까지 유지':'새 총은 필드에서 · XP는 보유 공격과 모듈에 투자'}</small><div class="buttons">${gateAssembly?`<button data-choice="back">게이트로 돌아가기 <kbd>${run.choices.length}</kbd></button>`:''}${type==='armory'&&!run.raidUsed?'<button class="primary" data-action="raid-menu">상자를 걸고 습격</button>':''}${!['assembly','clear','control','pursuit-reward'].includes(type)?'<button class="subtle" data-action="skip">건너뛰기 · 소량 회복</button>':''}</div></footer></section>`);
}
function showPause(){panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">작전 일시정지</span><h2 id="pause-title">다음 한 수를 준비하라.</h2><p>${run.operation?`${run.operation.region+1}/3 ${region(run).name} · ${fmt(run.t)} · LV.${run.level}`:'전투 중'}<br>${run.stage==='holdout'?'게이트 개방. 남아서 XP를 회수하거나 게이트로 이동하세요.':region(run).mission}</p>${loadoutChips(run.weapons,run.modules)}<div class="pause-actions"><button class="primary" data-action="continue">전투 이어하기 ▶</button><button data-action="retreat">작전 정산</button></div><div class="pause-secondary">${run.raid?.state==='active'?'<button data-action="withdraw">습격 철수 · 건 상자 소실</button>':''}${run.stage==='holdout'&&(!run.challenge||run.operation&&['complete','failed'].includes(run.challenge.state))?`<button data-action="challenge">${holdoutContract(run).name} · D ${(run.operation?.challengeTier||0)+1}</button>`:''}<button class="text-button" data-action="settings-menu">환경 설정</button></div></section>`);}
function showResult(r=run.result,archived=false){
 const p=profile();
 if(!archived&&r?.runId)r=p.recent.find(x=>x?.runId===r.runId&&isReport(x))||r;
 document.body.dataset.scene=archived||!renderer?'lobby':'battle';
 panel(reportView(r,p,{archived}));
}
function closeArchivedReport(){
 lobbyTab='archive';nextPanelFocus=reportOrigin;reportOrigin=null;showHome();
}

function showRaid(){
 subpanel={type:'raid'};
 const contracts=Object.entries(RAID_MARKS).map(([id,mark])=>{
  const cfg=RULES.raidContracts[id],odds=RULES.quality[cfg.qualityKey];
  const counts=id==='light'&&run.operation?.region===0&&run.operation.order==='convoy';
  return `<button class="raid-contract" data-action="raid:${id}" style="--route-ink:${mark.color}"><strong>${mark.name} 습격</strong><span>내구 ${cfg.hp.toLocaleString()} · ${Math.ceil(raidSeconds(id))}초</span><span>${mark.move}</span><small>${mark.reward}</small>${counts?'<small class="raid-order-tag">보급선 절단 지령 대상</small>':''}<small>희귀 ${Math.round(odds.rare*100)}% · 원형 ${Math.round(odds.prototype*100)}%</small></button>`;
 }).join('');
 panel(`<section class="sheet compact raid-brief" role="dialog" aria-modal="true" aria-labelledby="raid-title"><header><div><span class="eyebrow">무기고 · 선택 임무</span><h2 id="raid-title">수송대 습격</h2></div><span class="paused">Ⅱ 전투 정지</span></header><p>현재 <b>${QUALITY[run.choice.quality]} 보급</b>을 겁니다. 차량이 탈출하거나 철수하면 상자를 잃습니다.</p><div class="raid-brief-map">${raidPreview(run)}<div class="raid-legend"><span>● 현재 위치</span><span>○ 차량 출발</span><span>▥ 탈출 검문선</span></div></div><div class="raid-contracts">${contracts}</div><footer><small>장갑차는 완성 무장 권장 · 정면 탄환 피해 절반<br>정면 충돌 주의 · 확률은 성공 기준</small><button data-action="choice-back">현재 보급 유지</button></footer></section>`);
}
function showBranches(c,args){
 subpanel={type:'branch',card:c,args};
 const branches=Object.entries(GUNS[c.weapon].branches).map(([id,[name,desc]])=>{
  const forecast=growthForecast(run,c,{...args,branch:id});
  const parts=evolutionParts({id:c.weapon},id).map(part=>`${MODULES[part].name} 2`).join(' 또는 ');
  const materials=forecast?.text.includes(parts)?'':`<small>진화 재료 · ${parts}</small>`;
  return `<button data-branch="${id}"><b>${name}</b><small>${desc}</small>${materials}${forecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}</button>`;
 }).join('');
 panel(`<section class="sheet compact branch-sheet" role="dialog" aria-modal="true" aria-labelledby="branch-title"><span class="eyebrow">${c.kind==='rank'?'야전 개조 · LV.4':'야전 개장 · 분화'}</span><h2 id="branch-title">${GUNS[c.weapon].name} · 분화</h2><p>발사 방식과 이어갈 조합을 고르세요.</p><div class="branch-list">${branches}</div><button data-action="choice-back">선택으로 돌아가기</button></section>`);
}
function showRefits(c){
 subpanel={type:'refit',card:c};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="refit-title"><span class="eyebrow">FIELD WORKSHOP</span><h2 id="refit-title">같은 투자, 다른 발사 방식.</h2><p>미완성 총 하나의 분화를 전환합니다. 무기 레벨·모듈·조율권은 그대로 유지됩니다.</p><div class="branch-list">${refitWeapons(run).map(w=>{const next=Object.keys(GUNS[w.id].branches).find(id=>id!==w.branch);const forecast=growthForecast(run,c,{weapon:w.id,branch:next});return `<button data-refit="${w.id}"><b>${GUNS[w.id].name} L${w.level} · ${GUNS[w.id].branches[next][0]}</b><small>${GUNS[w.id].branches[w.branch][0]} → ${GUNS[w.id].branches[next][0]}<br>${GUNS[w.id].branches[next][1]}</small>${forecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}</button>`;}).join('')}</div><button data-action="choice-back">취소 · 전리품으로 돌아가기</button></section>`);
}
function showSlots(c){
 subpanel={type:'slots',card:c};const gun=c.kind==='gun';
 panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="slot-title"><span class="eyebrow">LOADOUT / REFIT</span><h2 id="slot-title">${esc(c.title)}</h2><p>${gun?'빈칸에 더하거나 기존 총을 개장합니다.':'한 모듈을 교체합니다. 기존 효과와 강화는 잃습니다.'}</p><div class="branch-list">${gun&&run.weapons.length<3?'<button data-slot="empty"><b>빈 무기 칸에 장착</b><small>현재 공격과 투자를 유지합니다.</small></button>':''}${(gun?run.weapons:run.modules).map((w,i)=>{if(gun&&(w.evolved||w.fusion))return'';const level=gun?(run.refits>0&&run.stage==='field'?Math.min(5,w.level):Math.min(5,1+(run.operation?.region||0)+Math.floor(Math.max(0,w.level-1-(run.operation?.region||0))/2))):null;const forecast=gun&&level>=4?null:growthForecast(run,c,{slot:i});const allowed=gun||canReplaceModule(run,c.module,i);return `<button data-slot="${i}" ${allowed?'':'disabled'}><b>${gun?`${GUNS[w.id].name} L${w.level} → ${GUNS[c.weapon].short} L${level}`:`${MODULES[w.id].name} ${w.rank}강화 교체`}</b><small>${gun&&run.refits>0&&run.stage==='field'?'무료 개장 1회 소비 · 분화 재선택':gun?'일부 투자만 이전 · 분화 재선택':allowed?'기존 모듈 효과 소멸':'흡열 코일에 필요한 축전 코일'}</small>${forecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}</button>`;}).join('')}</div><button data-action="choice-back">취소 · 무장 유지</button></section>`);
}
function present(force=false){
 if(mode==='home'){if(force)showHome();return;}
 const key=`${run.phase}:${JSON.stringify(run.choice)}:${JSON.stringify(run.choices.map(c=>[c.id,c.title,c.rank]))}`;if(!force&&key===stamp)return;stamp=key;subpanel=null;
 if(run.phase==='choice')showChoices();else if(run.phase==='paused')showPause();else if(run.phase==='result')showResult();else ui.innerHTML='';
}
function savingError(error,next,draft,launchMode){pending={next,draft,launchMode};const conflict=error.code==='CONFLICT';panel(`<section class="sheet compact" role="alertdialog" aria-modal="true" aria-labelledby="save-error-title"><span class="eyebrow">${conflict?'SAVE CHANGED':'SAVE INTERRUPTED'}</span><h2 id="save-error-title">${conflict?'최신 기록을 불러와 주세요.':'기록을 확정하지 못했습니다.'}</h2><p>${esc(error.message)}<br>${conflict?'다른 탭의 최신 기록을 불러올 수 있습니다.':'후보·장비·기록은 같은 결과로 다시 저장합니다.'}</p><button class="primary" data-action="${conflict?'reload-latest':'retry'}">${conflict?'최신 저장 불러오기':'같은 기록 다시 저장'}</button></section>`);}
async function commitDraft(draft,next,launchMode){
 if(busy)return false;setBusy(true);committingPlay=draft.phase==='playing';if(!committingPlay){controls?.reset();keys.clear();}
 try{
  const previous=profile();await store.commit(next);operationPlan.committed(previous,next,draft);
  run=draft;saveClock=0;pending=null;
  if(launchMode){
   mode='battle';sortieOrderSelection=null;requisitionSelection=null;document.body.dataset.scene='battle';selectedOperator=operatorId(draft);selectedDoctrine=draft.player.doctrine;$('world').setAttribute('aria-label',`${operatorOf(draft).name}의 빌드 서바이버 전투`);firstBattleFrame=true;pauseQueued||=document.hidden;
   if(launchMode==='fallback')notice('전장 원화를 불러오지 못해 기본 표시로 실행합니다.');
  }
  setBusy(false);committingPlay=false;present(true);
  if(pauseQueued){pauseQueued=false;if(run.phase!=='result')await mutate(d=>{pause(d);return true;});}
  return true;
 }catch(error){setBusy(false);committingPlay=false;pauseQueued=false;savingError(error,next,draft,launchMode);return false;}
}
async function mutate(fn){if(busy||pending||!run)return;const draft=snapshot(run);if(fn(draft)===false)return;const p=profile(),next=draft.result?settleProfile(p,draft):checkpointProfile(p,draft);await commitDraft(draft,next);}
async function persistCurrent(){if(busy||pending||!run)return;if(!profile().active&&run.phase!=='result')return;await commitDraft(snapshot(run),run.result?settleProfile(profile(),run):checkpointProfile(profile(),run));}
function updatePreparation(count){
 if(!launchPreparation)return;
 const {overlay}=launchPreparation;
 overlay.querySelector('progress').value=count;
 overlay.querySelector('.prep-count').textContent=`전장 원화 ${count}/${MISSION_ART_COUNT} 준비`;
}
function prepareBattleArt(priority='low'){
 if(artWork)return artWork.promise;
 if(!kitPreloaded){
  kitPreloaded=true;
  const link=document.createElement('link');
  Object.assign(link,{rel:'preload',as:'image',type:'image/webp',href:missionImageUrl('field-kit-v018'),fetchPriority:priority});
  document.head.append(link);
 }
 const work={completed:0,promise:null};
 artWork=work;
 work.promise=loadMissionArt({priority,onProgress:count=>{
  if(artWork!==work)return;
  work.completed=count;updatePreparation(count);
 }}).then(art=>{
  battleArt=art;
  drawPortrait();
  return art;
 }).catch(()=>{
  artWork=null;
  return null;
 });
 return work.promise;
}
function showPreparation(source){
 const overlay=document.createElement('div');
 overlay.className='sortie-prep';
 overlay.innerHTML=`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="prep-title"><span class="eyebrow">01 / 해안 침투</span><h2 id="prep-title" tabindex="-1">해안 상륙 준비</h2><p>전장 원화를 불러오는 중입니다.</p><progress max="${MISSION_ART_COUNT}" value="0" aria-label="전장 원화 준비"></progress><small class="prep-count" role="status"></small><button data-action="cancel-launch">출격 취소</button></section>`;
 const covered=[...ui.children].map(node=>({node,inert:node.inert}));
 for(const {node} of covered)node.inert=true;
 ui.prepend(overlay);
 const ticket=launchPreparation={overlay,source,covered};
 updatePreparation(artWork?.completed||0);
 overlay.querySelector('h2').focus({preventScroll:true});
 return ticket;
}
function closePreparation(cancelled=false){
 const {overlay,source,covered}=launchPreparation;
 launchPreparation=null;
 overlay.remove();
 for(const {node,inert} of covered)node.inert=inert;
 if(cancelled)source.focus({preventScroll:true});
}
async function launch(source,seed=operationPlan.seed,order=source.dataset.sortie||null){
 const actor=source.dataset.actor||selectedOperator,requisition=source.dataset.requisition||null;
 if(!Object.hasOwn(OPERATORS,actor))return;
 if(busy||pending||launchPreparation)return;
 if(order&&!canLaunchOrder(profile(),order)){notice('지령 출격 조건을 확인하세요.');return;}
 if(requisition&&!canReserveResearch(profile(),requisition)){notice('정비대 예약 조건을 확인하세요.');return;}
 audio.unlock();
 let art=battleArt;
 if(!art){
  const ticket=showPreparation(source);
  art=await prepareBattleArt('high');
  if(launchPreparation!==ticket)return;
  closePreparation();
 }
 const {run:draft,next}=freshSortie(profile(),seed,order,actor,requisition);
 renderer=createRenderer($('world'),art,combatHud);
 await commitDraft(draft,next,art?'art':'fallback');
}
async function selectCard(id,args={}){const c=run.choices.find(c=>c.id===id);if(!c)return;const details=choiceDetails(run,c);if(details.blocked)return;if(!subpanel)choiceOrigin={scroll:ui.scrollTop,selector:`[data-choice="${CSS.escape(c.id)}"]`};
 if(c.kind==='refit'&&!args.weapon){showRefits(c);return;}
 if(c.kind==='rank'&&run.weapons.find(w=>w.id===c.weapon&&!w.fusion)?.level===3&&!args.branch){showBranches(c,args);return;}
 if(c.kind==='gun'&&args.slot===undefined&&(run.weapons.length>=3||!run.choice.opening&&run.refits>0&&run.weapons.some(w=>w.level>1&&!w.evolved))){showSlots(c);return;}
 if(c.kind==='module'&&!moduleRank(run,c.module)&&run.modules.length>=4&&args.slot===undefined){showSlots(c);return;}
 const before=run.stats.choices.length,hadHeat=heatSynergyReady(run);
 const openingGun=!!(run.choice.opening&&c.kind==='gun'&&COAST_APPROACHES[c.weapon]);
 await mutate(d=>choose(d,id,{...args,doctrine:selectedDoctrine}));
 if(run.stats.choices.length>before&&!pending)equippedFeedback(c,details,openingGun,!hadHeat&&heatSynergyReady(run));
}
ui.addEventListener('change',async e=>{if(e.target.name==='doctrine'){selectedDoctrine=e.target.value;return;}const key=e.target.dataset.setting;if(!key||busy)return;const p=profile();p.settings[key]=e.target.checked;setBusy(true);try{await store.commit(p);if(!p.settings.sound)audio.suspend();}catch(error){notice(error.message);}finally{setBusy(false);nextPanelFocus={selector:`[data-setting="${key}"]`};showSettings();}});
ui.addEventListener('keydown',e=>{const dialog=ui.querySelector('[role="dialog"],[role="alertdialog"]');if(!dialog)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(launchPreparation){closePreparation(true);return;}if(busy||pending)return;if(subpanel?.type==='settings')closeSettings();else if(subpanel?.type==='retreat'){if(subpanel.fromHome)showHome();else present(true);}else if(subpanel){nextPanelFocus=choiceOrigin;subpanel=null;present(true);}else if(run?.phase==='choice'&&run.choice.gatePrep&&run.choice.type==='assembly')selectCard('back');else if(mode==='report')closeArchivedReport();else if(run?.phase==='result'){lobbyTab='mission';showHome();}else if(run?.phase==='paused')pauseButton();return;}if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input,a[href],summary')].filter(n=>n.getClientRects().length);if(!nodes.length){e.preventDefault();return;}const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first.focus();}}});
ui.addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button||busy||pending&&!['retry','reload-latest'].includes(button.dataset.action))return;
 if(launchPreparation){if(button.dataset.action==='cancel-launch')closePreparation(true);return;}
 if(button.dataset.tab){lobbyTab=button.dataset.tab;nextPanelFocus={selector:`.command-nav [data-tab="${CSS.escape(lobbyTab)}"]`};showHome();return;}
 if(button.dataset.brief!==undefined){briefRegion=Number(button.dataset.brief);nextPanelFocus={selector:`[data-brief="${briefRegion}"]`};showHome();return;}
 if(Object.hasOwn(OPERATORS,button.dataset.pilot)){
  selectedOperator=button.dataset.pilot;
  nextPanelFocus={scroll:ui.scrollTop,selector:`[data-pilot="${selectedOperator}"]`};showHome();return;
 }
 if(button.dataset.order!==undefined){
  const id=button.dataset.order;
  if(id&&!canLaunchOrder(profile(),id))return;
  sortieOrderSelection=id||null;requisitionSelection=null;briefRegion=0;
  nextPanelFocus={scroll:ui.scrollTop,selector:id?`[data-order="${id}"]`:'[data-action="launch"]'};showHome();return;
 }
 if(button.dataset.reserve!==undefined){
  const id=button.dataset.reserve;
  if(id&&!canReserveResearch(profile(),id))return;
  requisitionSelection=id||null;sortieOrderSelection=null;lobbyTab='mission';briefRegion=id?1:0;
  nextPanelFocus={selector:'[data-action="launch"]'};showHome();return;
 }
 if(button.dataset.report!==undefined){
  const index=Number(button.dataset.report),r=profile().recent[index];
  if(isReport(r)){reportOrigin={scroll:ui.scrollTop,selector:`[data-report="${index}"]`};mode='report';showResult(r,true);}
  return;
 }
 if(button.dataset.research){const next=buyResearch(profile(),button.dataset.research);if(!next)return;setBusy(true);try{await store.commit(next);setBusy(false);lobbyTab='research';nextPanelFocus={selector:'#trial-dispatch-title'};showHome();}catch(error){notice(error.message);}finally{setBusy(false);}return;}
 if(button.dataset.choice){await selectCard(button.dataset.choice);return;}
 if(button.dataset.refit){const w=refitWeapons(run).find(w=>w.id===button.dataset.refit);if(w)await selectCard(subpanel.card.id,{weapon:w.id,branch:Object.keys(GUNS[w.id].branches).find(id=>id!==w.branch)});return;}
 if(button.dataset.branch){const {card,args}=subpanel;await selectCard(card.id,{...args,branch:button.dataset.branch});return;}
 if(button.dataset.slot!==undefined){const c=subpanel.card,slot=button.dataset.slot==='empty'?undefined:Number(button.dataset.slot),args={slot};if(c.kind==='gun'&&slot!==undefined){const old=run.weapons[slot],level=run.refits>0&&run.stage==='field'?Math.min(5,old.level):Math.min(5,1+(run.operation?.region||0)+Math.floor(Math.max(0,old.level-1-(run.operation?.region||0))/2));if(level>=4){showBranches(c,args);return;}}await selectCard(c.id,{...args,slot:slot===undefined?-1:slot});return;}
 if(button.dataset.exclude){await mutate(d=>banish(d,button.dataset.exclude));return;}
 const a=button.dataset.action;if(a==='launch'){await launch(button);return;}if(a==='same-seed'){const seed=Number(button.dataset.seed);if(Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295)await launch(button,seed);else notice('지난 전장의 코드를 읽지 못했습니다.');return;}if(a==='home'){if(mode==='report'){closeArchivedReport();return;}lobbyTab=button.dataset.target||'mission';briefRegion=null;showHome();return;}if(a==='settings-menu'){showSettings();return;}if(a==='settings-back'){closeSettings();return;}if(a==='last-report'){const report=profile().recent[0];if(!report?.stats||!Array.isArray(report.weapons)||!Array.isArray(report.modules)){notice('전투 보고서를 읽지 못했습니다.');return;}reportOrigin=null;mode='report';showResult(report,true);return;}
 if(a==='end-saved'){run=restore(profile().active.run);showRetreat(true);return;}
 if(a==='retreat'){showRetreat();return;}if(a==='retreat-cancel'){if(subpanel?.fromHome)showHome();else present(true);return;}if(a==='retreat-confirm'){mode='battle';document.body.dataset.scene='battle';await mutate(d=>d.result?true:finish(d,false));return;}
 if(a==='retry'){const {next,draft,launchMode}=pending;pending=null;await commitDraft(draft,next,launchMode);return;}
 if(a==='reload-latest'){location.reload();return;}
 if(a==='choice-back'){nextPanelFocus=choiceOrigin;subpanel=null;present(true);return;}if(a==='raid-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="raid-menu"]'};showRaid();return;}
 if(a==='banish-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="banish-menu"]'};subpanel={type:'banish'};const options=banishOptions(run);panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="banish-title"><span class="eyebrow">BANISH / 이번 판에서 제외</span><h2 id="banish-title">보급 후보 하나를 바꾼다</h2><div class="branch-list">${options.map(c=>`<button data-exclude="${esc(c.id)}">${esc(c.title)}${c.module&&moduleRank(run,c.module)?' · 이 상자만 교체':' · 이번 판 후보 제외'}</button>`).join('')}</div><small>${options.length?'미보유 후보는 이번 판에서 제외합니다. 보유 모듈은 이 상자의 후보만 교체하고 기존 투자를 유지합니다.':'현재 제외할 후보가 없습니다. 첫 두 보급의 새 총 기회는 보호됩니다.'}</small><button data-action="choice-back">돌아가기</button></section>`);return;}
 await mutate(d=>{if(a==='continue'){resume(d);return true;}if(a==='reroll')return reroll(d);if(a==='skip')return skip(d);if(a==='gate-assemble'||a==='gate-upgrade')return action(d,a);if(a==='withdraw'){const ok=action(d,'withdraw');if(ok)resume(d);return ok;}if(a==='challenge'){resume(d);return action(d,'challenge');}if(a?.startsWith('raid:'))return action(d,a);return false;});
});
async function pauseButton(){if(!run||mode!=='battle'||pending)return;if(busy){if(committingPlay||run.phase==='playing')pauseQueued=true;return;}await mutate(d=>{if(d.phase==='paused')resume(d);else pause(d);return true;});}
$('pause').addEventListener('click',pauseButton);$('gear').addEventListener('click',()=>mutate(d=>action(d,'gear')));
$('field-upgrade').addEventListener('click',()=>mutate(d=>action(d,'upgrade')));
$('pursuit').addEventListener('click',()=>mutate(d=>action(d,'challenge')));
const movementInput=()=>({x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+touch.x,y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+touch.y});
window.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key.toLowerCase(),moving=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k);
 // Keep physical movement state across asynchronous choice/save commits.
 if(mode==='battle'&&run&&moving&&(run.phase==='playing'||committingPlay)){keys.add(k);e.preventDefault();}
 if(e.repeat)return;if(mode!=='battle'||!run||pending)return;
 if(e.key==='Escape'){e.preventDefault();pauseButton();return;}
 if(busy)return;
 if(run.phase==='choice'&&!subpanel&&/^[1-9]$/.test(e.key)){e.preventDefault();const c=run.choices[Number(e.key)-1];if(c)selectCard(c.id);return;}
 if(run.phase==='choice'&&run.choice.type==='clear'&&!subpanel&&['g','r'].includes(k)){e.preventDefault();mutate(d=>action(d,k==='g'?'gate-assemble':'gate-upgrade'));return;}
 if(run.phase!=='playing')return;if(k===' ')e.preventDefault();const a=({' ':'dash',e:'skill',f:'interact',g:'gear',r:'upgrade',q:'challenge'})[k];if(a){audio.unlock();mutate(d=>action(d,a,a==='skill'?movementInput():undefined));}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&mode==='battle'&&run.phase==='playing')mutate(d=>{pause(d);return true;});});
window.addEventListener('blur',()=>{keys.clear();controls?.reset();if(run&&mode==='battle'&&run.phase==='playing'&&!busy)mutate(d=>{pause(d);return true;});});
function bearing(p,x,y){return ['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(Math.atan2(y-p.y,x-p.x)/(Math.PI/4))+8)%8];}
function updateMap(lead,entry,gantry,dispatch,reserved,aid){
 const warnings=run.hazards.filter(h=>!h.hit);
 const activeFire=warnings.filter(h=>h.lane||h.portRound).map(h=>`${h.portRound||'lane'}:${h.x}:${h.y}`).join();
 const key=`${run.seed}:${Math.floor(run.t*5)}:${run.stage}:${run.boss.active?run.boss.mode:''}:${run.operation?.region}:${run.operation?.order}:${run.raid?.state}:${run.challenge?.state}:${lead?.id}:${!!dispatch}:${!!reserved}:${!!entry}:${!!gantry}:${aid?.state}:${activeFire}:${run.sites.map(n=>n.state).join()}`;if(key===mapStamp)return;mapStamp=key;
 const dot=(cls,x,y,r,color,label='')=>`<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"${label?` aria-label="${esc(label)}"`:''}/>`;
 let map=terrainSvg(run.operation?.region||0,run.seed)+entryRouteSvg(entry)+warnings.map(h=>h.lane?`<rect class="map-danger-lane" x="${h.x-h.w/2}" y="${h.y-h.h/2}" width="${h.w}" height="${h.h}" fill="${h.tracked?'#ef9a6799':'#ee975e66'}" stroke="#ffda99" stroke-width="8"/>`:dot('map-danger',h.x,h.y,h.portRound?blastContactRadius(h):h.r,h.portRound==='rake'?'#f99354bb':h.portRound==='turret'?'#f9bf83b0':'#f77e778c',h.portRound==='lock'?'집중 포격 조준점':h.portRound==='rake'?'측면 장갑 가로 포격':h.portRound==='turret'?'포탑 측면 포격':'')).join('');
 map+=run.blocks.filter(b=>b.hp!==0).map(b=>`<rect class="map-block" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#71837e"/>`).join('');
 map+=run.gems.map(g=>dot('map-xp',g.x,g.y,g.salvage?14:9,g.salvage?'#f5d487':'#a5ddcc')).join('');
 map+=run.enemies.filter(e=>!e.dead).map(e=>dot('map-enemy',e.x,e.y,e.cohort==='challenge'?24:e.type==='officer'?19:13,e.cohort==='challenge'?'#efb6ff':e.type==='officer'?'#f7b58d':'#d28257')).join('');
 map+=run.sites.filter(n=>n.state!=='done').map(n=>dot('map-site',n.x,n.y,n.state==='ready'?36:25,n.kind==='armory'?'#c5a8f5':'#ffe0a1',`${n.name} · ${n.state==='ready'?'회수 가능':n.state==='active'?n.kind==='relay'?`해킹 ${Math.round(n.progress/5*100)}%`:'경비 교전':'미확보'}`)).join('');
 map+=run.sites.filter(n=>n.state!=='done').map(n=>siteSymbol(n,n.x,n.y,22)).join('');
 if(lead){const {x,y}=lead;map+=`<path d="M${x} ${y-51}l51 51 -51 51 -51 -51Z" fill="none" stroke="${coastLeadColor(lead)}" stroke-width="14" aria-label="${esc(sitePresentation(lead).name)} · 다음 표적"/>`;}
 if(dispatch)map+=orderPinSvg(dispatch,run.operation.order);
 if(reserved)map+=`<circle cx="${reserved.x}" cy="${reserved.y}" r="56" fill="none" stroke="#b6e1c5" stroke-width="12" aria-label="예약 장비 · 화차 정비대"/>`;
 if(run.stage==='field')map+=dot('map-boss-entry',800,350,34,'#ef8e64','보스 진입');
 if(run.boss.active){const b=run.boss;map+=dot('map-boss',b.x,b.y,50,'#ef8e64',run.operation?region(run).boss:'장갑 수송차')+`<line class="map-boss-facing" x1="${b.x}" y1="${b.y}" x2="${b.x+Math.cos(b.body)*120}" y2="${b.y+Math.sin(b.body)*120}" stroke="#ef8e64" stroke-width="16"/>`;}
 const boss=run.boss;
 const charge=coastChargeLane(run);
 if(charge){
  const x=boss.mode==='charge'?boss.x:charge.x,y=boss.mode==='charge'?boss.y:charge.y;
  map+=`<path class="map-charge-lane" d="M${x} ${y}L${charge.endX} ${charge.endY}" stroke="#e6aa6780" stroke-width="${charge.r*2}" stroke-linecap="round" aria-label="장갑 수송차 돌진 범위"/><path d="M${x} ${y}L${charge.endX} ${charge.endY}" stroke="#ffdd9d" stroke-width="10" stroke-dasharray="26 18"/>`;
 }
 if(boss.active&&run.operation?.region===2){
  if(run.operation.support==='breach'&&boss.parts[0].hp>0){
   const {x,y}=portFlankPoint(boss);
   map+=dot('map-flank',x,y,39,'#c8f4ff','철갑 포탑 사선');
  }
  if(portCoreWindow(run))map+=`<circle cx="${boss.x}" cy="${boss.y}" r="${portCoreReach(boss)}" fill="none" stroke="#ffd0a1" stroke-width="12" stroke-dasharray="24 20" aria-label="회피로 넘을 코어 경계"/>`;
  if(aid?.preview)map+=`<circle cx="${aid.point.x}" cy="${aid.point.y}" r="42" fill="none" stroke="#d7f0b8" stroke-width="9" stroke-dasharray="14 10" aria-label="다음 구급 화물 투하 지점"/>`;
  else if(aid)map+=dot('map-crate',aid.point.x,aid.point.y,42,aid.state==='blocked'?'#ffae86':'#d7f0b8',aid.state==='blocked'?'포격 중인 구급 화물':'구급 화물');
 }
 if(gantry){
  map+=entryRouteSvg({routes:[gantry]});
  map+=`<path class="map-gantry" d="M${gantry.x-31} ${gantry.y+22}v-45h62v45m-47-9 16-14 16 14" fill="none" stroke="${gantry.color}" stroke-width="10" aria-label="측면 해치 · 보스 입구"/>`;
 }
 const gate=exitGate(run);if(gate)map+=gateSymbol(gate);
 if(run.raid?.state==='active'){
  const {contract,target}=run.raid;
  map+=raidRouteSvg(raidAhead(run.raid),contract)+dot('map-courier',target.x,target.y,34,RAID_MARKS[contract].color,RAID_MARKS[contract].name);
 }
 if(run.challenge?.state==='active'&&run.challenge.type==='defend'){
  const {x,y,r}=DEFENSE_ZONE;
  map+=`<circle class="map-defense" cx="${x}" cy="${y}" r="${r}" fill="#cfa5e344" stroke="#f1c8fb" stroke-width="12" aria-label="중계기 방어 구역"/>`;
 }
 const signal=signalCourier(run);
 if(signal)map+=escapeRouteSvg(signalRoute(run),'data-signal-route',SIGNAL_COLOR,'통신 차량')+dot('map-signal',signal.x,signal.y,34,SIGNAL_COLOR,'탈출 차량');
 else if(gate&&run.operation?.region===2&&!run.challenge)map+=`<g opacity=".65">${escapeRouteSvg(signalRoute(run),'data-signal-route',SIGNAL_COLOR,'잔류 시 통신 차량')}</g>`;
 map+=dot('map-player',run.player.x,run.player.y,30,'#fff7d9',operatorOf(run).name);$('tactical-map').innerHTML=map;
}
function updateHud(){
 const battle=mode==='battle'&&renderer&&run;$('hud').hidden=!battle;$('hud').inert=!!battle&&run.phase!=='playing';$('controls').hidden=!battle||run.phase!=='playing'||!!pending;if(!battle){$('field-feedback').hidden=true;return;}const p=run.player,actor=operatorOf(run),coastSite=coastLead(run),entry=activeEntry(run),gantry=portGantry(run),dispatch=orderTarget(run),reserved=requisitionSite(run),order=sortieOrder(run.operation?.order);const aid=portAidCue(run);updateMap(coastSite,entry,gantry,dispatch,reserved,aid);$('map-panel').querySelector('span').textContent=`${region(run).name} · 작전도`;
 document.body.classList.toggle('coast-lead',!!coastSite);
 $('operator-name').textContent=actor.short;$('level').textContent=`LV.${run.level}`;$('hp').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;document.body.classList.toggle('low-hp',p.hp/p.maxHp<.3);$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('charge').textContent=p.overdrive>0?`전탄 보급 ${p.overdrive.toFixed(1)}초`:`${actor.meter} ${Math.floor(p.charge)}%`;
 $('kills').textContent=`${run.stats.kills} K.O.`;$('score').textContent=`${run.stats.score.toLocaleString()}점 · 확보 ${operationCredits({operation:run.operation,stats:run.stats,won:false})}C`;$('time').textContent=fmt(run.t);$('xp-fill').style.width=`${run.xp/xpNeeded(run)*100}%`;
 const front=run.operation?.region;
 const localSite=run.stage!=='boss'?run.sites.filter(n=>['active','ready'].includes(n.state)&&distance(n,p)<260).sort((a,b)=>distance(a,p)-distance(b,p))[0]:null;
 const gate=exitGate(run),holdout=!!(gate&&run.operation),interact=interaction(run);
 document.body.classList.toggle('gantry-near',!!interact?.gantry);
 const bossName=run.operation?region(run).boss:'장갑 수송차';
 const bossTarget={name:bossName,x:run.boss.active?run.boss.x:800,y:run.boss.active?run.boss.y:350};
 const tactic=frontTactic(run);
 const orderSite=run.stage==='field'&&front>0&&!tactic
  ?run.sites.find(n=>['rail-relay','port-control'].includes(n.id)&&n.state!=='done'):null;
 const entrance=interact?.id==='boss'&&!interact.blocked?(interact.gantry||bossTarget):null;
 const focusBoss=run.boss.active||entrance||run.stats.completedBuild&&!localSite&&!orderSite&&!reserved;
 const raid=run.raid?.state==='active'?run.raid:null;
 const convoy=raid&&{name:RAID_MARKS[raid.contract].name,x:raid.target.x,y:raid.target.y};
 const prepared=run.stage==='field'&&claimedCoastLead(run),coastPlan=coastStrike(run),coastArmed=coastPlan&&coastStrikeArmed(run);
 const next=convoy||gate||(front>0?entrance:null)||(coastSite?.opening?coastSite:dispatch||coastSite)||(prepared&&coastArmed?bossTarget:null)||localSite||reserved||gantry||(focusBoss?bossTarget:orderSite||run.sites.filter(n=>n.state!=='done').sort((a,b)=>distance(a,p)-distance(b,p))[0]||bossTarget);
 const choosingEntry=entry&&!raid&&!localSite&&!focusBoss&&!gantry;
 const direction=bearing(p,...(next.path?entryWaypoint(next.path,p):[next.x,next.y]));
 $('operation-track').textContent=run.operation?REGIONS.map((d,i)=>`${i<run.operation.region?'✓':i===run.operation.region?'▶':'○'} ${d.name}`).join('  /  '):'';
 $('stage').textContent=run.operation?`${run.operation.region+1}/3 ${region(run).name}${run.stage==='holdout'?' · 돌파 완료':run.stage==='boss'?' · 보스 교전':''}`:run.powerWave&&run.stage==='field'?'POWER TEST / 완성 화력 전개':run.stage==='holdout'?'MISSION CLEAR / 잔류 가능':run.stage==='boss'?'ARMORED CARRIER':'BEACHHEAD / 해안 침투';
 const wave=run.powerWave,showcase=wave?.showcase&&wave.paired>0;
 const reinforcements=showcase?showcaseWindow(run)?' · 시험 편대 접근':' · 재장전 때 시험 공세':wave&&run.stage==='field'?` · 증원 ${wave.remaining}명 남음`:'';
 $('objective').textContent=choosingEntry?(entry.routes.length===1?'남은 선택 경로':front===1?'선로 갈림길':'하역장 갈림길'):`${direction} ${next.kind?sitePresentation(next).name:next.name} · ${Math.round(distance(p,next)/10)}m`;
 const guards=next.state==='active'?run.enemies.filter(e=>!e.dead&&e.siteId===next.id).length:0;
 const garrison=railGarrison(next),crew=next.state==='active'&&next.kind==='relay'?railCrewLeft(run,next):0;
 const hacking=crew?`${garrison.crew} ${crew}${garrison.unit} 제압 후 해킹`:`범위 안에서 해킹 ${Math.round(next.progress/5*100)}%`;
 const coastFight=next===coastSite&&!!coastSite?.coastApproach;
 const siteHint=coastFight?'':next.state==='active'?next.kind==='relay'?` · ${hacking}`:` · 경비 ${guards}명, 이동하며 제압`:next.state==='ready'?next.kind==='relay'?' · 해킹 완료, 접근해 회수':' · 제압 완료, 접근해 회수':'';
 $('threat').textContent=`경계 ${run.pressure}${siteHint}${run.challenge?` · 도전${run.challenge.tier||1} ${run.challenge.state==='complete'?'완료':'진행'}`:''}${reinforcements}`;
 const fieldIntel=$('field-intel'),direct=$('field-direct');
 const armory=prepared&&next===bossTarget?run.sites.find(site=>site.kind==='armory'&&site.state!=='done'):null;
 const alternate=armory||(gantry&&next===bossTarget?gantry:bossTarget);
 const alternateLabel=armory?'무기고 경유':alternate===gantry?'측면 해치':gantry?'정면 진입':'보스 직행';
 direct.hidden=!((front>0||prepared)&&run.stage==='field'&&!raid&&next!==alternate);
 direct.textContent=`${bearing(p,...(alternate.path?entryWaypoint(alternate.path,p):[alternate.x,alternate.y]))} ${alternateLabel} · ${Math.round(distance(p,alternate)/10)}m`;
 let intel='';
 if(raid)intel='';
 else if(choosingEntry)intel=entry.routes.map(route=>{
  const plan=railGarrison(run.sites.find(site=>site.id===route.site));
  const sign=route.site==='rail-cache'?(reserved?`정비대 · ${RESEARCH[run.operation.requisition].name}`:'정비대'):route.site==='rail-relay'?'중계기':route.sign;
  return `${bearing(p,...entryWaypoint(route.path,p))} ${sign}${plan?` · ${plan.name}`:''}`;
 }).join('\n');
 else if(reserved&&next===reserved)intel=`예약 · ${RESEARCH[run.operation.requisition].name} · ${reserved.state==='ready'?'접근해 회수':garrison?.hint||'경비 제압'}`;
 else if(dispatch&&next===dispatch)intel=`${order.name} · ${dispatch.state==='ready'?'접근해 회수':order.action}`;
 else if(next.site==='port-gantry')intel='측면 해치로 진입하면 첫 포격 동안 포탑 측면을 노릴 수 있습니다.';
 else if(next.id==='port-landing'&&next.gantry)intel='방패병 뒤 박격포까지 제압하면 측면 해치가 열립니다.';
 else if(next.id==='rail-cache'||crew)intel=garrison&&next.state!=='ready'?garrison.hint:next.id==='rail-cache'?'경비 제압 뒤 무장 강화 또는 개장':'범위 안에서 해킹하세요.';
 else if(orderSite&&next===orderSite)intel='확보하면 보스 공략을 고를 수 있습니다.';
 else if(prepared&&coastArmed&&next===bossTarget)intel=`${coastPlan.name} 준비 · ${coastPlan.hint}`;
 else if(prepared&&coastPlan&&!coastArmed)intel=`${coastPlan.name} · 필요한 무장 미장착`;
 else if(tactic&&run.stage==='field')intel=`${tactic.name} 확보 · 보스전에 적용`;
 else if(coastSite&&next===coastSite){
  if(coastSite.opening){
   const move=touchLayout.matches?'스틱 이동':'WASD 이동';
   intel=coastSite.state==='ready'?'감옥에 가까이 가면 구출됩니다.':`${move} · 사격은 자동`;
  }else if(run.operation?.requisition==='thermal'&&coastSite.coastApproach==='r'&&!moduleRank(run,'coil'))intel='흡열 코일 준비 · 이 진지에서 축전 코일 확보';
  else intel=coastEncounterCue(run,coastSite)||coastApproach(coastSite).hint;
 }
 else if(front===0&&run.sites[0]?.state!=='done'){
  const rescue=run.sites[0],route=beachRoute(run.seed).name;
  if(rescue?.opening)intel=`${route} · 구출 후 F / R 선택`;
  else if(rescue?.gun)intel=`${route} · ${GUNS[rescue.gun].name} 보급`;
 }else if(front===1&&run.sites.some(site=>site.kind==='relay'&&site.state==='done'))intel='중계기 연결 · 차선 예고 +0.4초';
 else if(front===2&&run.operation.jammed)intel='통신 교란 중 · 증원 6 → 3';
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
  const rare=!finalFront&&rewardTier===1;
  const kills=Math.min(run.operation.holdoutKills||0,HOLDOUT.rareKills);
  let detail=contract.risk;
  if(active&&challenge.type==='defend'){
   const inside=distance(p,DEFENSE_ZONE)<=DEFENSE_ZONE.r;
   detail=`${inside?'방어 중':`중계기 ${Math.round(distance(p,DEFENSE_ZONE)/10)}m`} · ${Math.min(challenge.progress,challenge.duration).toFixed(1)} / ${challenge.duration}초`;
  }else if(active&&challenge.type==='intercept'){
   const target=challenge.target;
   detail=`${bearing(p,target.x,target.y)} 차량 ${Math.round(distance(p,target)/10)}m · 이탈 ${Math.ceil(challenge.timeLeft)}초 · HP ${Math.ceil(target.hp)}`;
  }else if(active){
   const left=run.enemies.filter(e=>!e.dead&&challenge.targets.includes(e.id)).length;
   detail=`지휘관 ${2-left}/2명 제압`;
  }else if(challenge?.state==='failed')detail='차량 이탈 · 같은 단계 재도전 가능';
  else if(finalFront)detail=`${signalLaneLabel[signalLane(run.seed)]} · ${contract.risk}`;
  if(rare&&active)detail=`${challenge.secured?'목표 확보':detail} · 증원 ${kills}/${HOLDOUT.rareKills}`;
  if(run.raid?.state==='active')detail='습격 종료 후 잔류 도전 가능';
  $('objective').textContent=nearGate?finalFront?'게이트 · 귀환 또는 잔류':'게이트 · 전진 또는 잔류':`${direction} ${finalFront?'귀환':'전진'} 게이트 · ${Math.round(distance(p,gate)/10)}m`;
  $('threat').textContent=tier===0?`첫 증원까지 ${nextWave}초`:tier===HOLDOUT.maxTier?`공세 ${tier}/${HOLDOUT.maxTier} · 최대 증원`:`공세 ${tier}/${HOLDOUT.maxTier} · 강화까지 ${nextWave}초`;
  const steps=$('holdout-steps');
  for(let i=0;i<steps.children.length;i++)steps.children[i].classList.toggle('active',i<tier);
  $('ground-xp').textContent=groundXp(run);
  $('pursuit-goal').textContent=active?`D${challenge.tier} · ${contract.name}`:contract.id==='defend'?`중계기 반경 안에서 ${defenseSeconds(contractTier)}초 버티기`:contract.goal;
  $('pursuit-intel').textContent=detail;
  const parts=rare?holdoutParts(run.seed,front).map(id=>FRONT_SUPPORTS[id].name).join(' / '):'';
  $('pursuit-pay').textContent=rare?`희귀 부품 · ${parts}${canAdvanceWithVanguard(run)?' · 지금 전진 시 선발 지원':''}`:rewardTier===1?`보상 · 화물 ${CARGO_CREDITS}C 또는 후송 보급`:`완료 점수 +${rewardTier*500}`;
  $('pursuit-label').textContent=pursuit.disabled?'도전 대기 · 적 밀집':`D${contractTier} · ${contract.name}`;
 }
 const maneuver=$('maneuver-status'),active=activeManeuver(p);
 maneuver.hidden=!p.maneuver;maneuver.classList.toggle('active',!!active);
 if(p.maneuver)maneuver.textContent=`${MANEUVERS[p.maneuver].name} · ${active?'가동':p.maneuver==='assault'?'회피하며 이동':'정지해 조준'}`;
 const support=FRONT_SUPPORTS[run.operation?.support];
 $('support-status').hidden=!support;
 if(support)$('support-status').textContent=front===2&&Object.hasOwn(PORT_SUPPORT,run.operation.support)&&!run.boss.active&&run.stage==='field'
  ?supportTactic(run.operation.support,front):`${support.name} · ${support.role}`;
 $('combo').textContent=run.combo>=8?`${run.combo} 연속 처치`:'';
 const key=JSON.stringify([run.weapons.map(w=>[w.id,w.level,w.branch,w.evolved,w.fusion]),run.modules,run.tuning]);if(key!==inventoryStamp){inventoryStamp=key;$('weapons').innerHTML=run.weapons.map(w=>`<div class="weapon ${w.evolved?'evolved':''}" data-weapon-id="${w.id}">${itemArt(w.id)}<b>${w.fusion?`${GUNS[w.id].short}+${GUNS[w.fusion.secondary].short}`:GUNS[w.id].short}</b><small>${w.fusion?'전도 격발망':w.evolved?GUNS[w.id].evolution:`L${w.level}/6 ${w.branch?GUNS[w.id].branches[w.branch][0]:''}`}</small></div>`).join('')+Array.from({length:3-run.weapons.length},()=>'<div class="weapon empty"><b>＋</b><small>미확보</small></div>').join('');$('modules').innerHTML=run.modules.map(m=>`<span class="module">${MODULES[m.id].name} ${m.rank}</span>`).join('');}
 const fusion=run.weapons.find(w=>w.fusion),synergy=$('synergy');
 synergy.classList.toggle('conductive',!!fusion);
 synergy.textContent=fusion?`연쇄탄 ${Math.min(RULES.fusion.hitsPerPayload,Math.floor(fusion.payload))}/${RULES.fusion.hitsPerPayload} · 도약 ${run.stats.payloadRelays||0}회`:moduleRank(run,'catalyst')?`점화 ${[...run.enemies,...(run.boss.active?[run.boss,...run.boss.parts]:[]),...(run.raid?.state==='active'?[run.raid.target]:[])].filter(e=>!e.dead&&e.hp>0&&e.burn>0).length} · 열압 ${run.stats.heatBursts}회`:'';
 if(moduleRank(run,'shrapnel'))synergy.textContent+=`${synergy.textContent?' · ':''}파쇄 ${run.stats.shrapnelBursts||0}회`;
 if(moduleRank(run,'thermal')&&run.stats.thermalRecovered>=1)synergy.textContent+=`${synergy.textContent?' · ':''}흡열 +${Math.floor(run.stats.thermalRecovered)}충전`;
 const options=assemblyOptions(run),ready=options.find(o=>['evolve','fusion'].includes(o.kind));
 const heatReady=heatSynergyReady(run,2)&&moduleRank(run,'catalyst')===2&&options.some(o=>o.id==='tune:catalyst');
 const upgrade=$('field-upgrade');
 upgrade.hidden=run.pendingLevels===0||run.phase!=='playing';
 upgrade.disabled=!canOpenLevel(run);
 if(!upgrade.hidden){
  const count=String(run.pendingLevels),badge=$('field-upgrade-count');
  if(badge.textContent!==count){
   badge.textContent=count;
   upgrade.setAttribute('aria-label',`야전 개조 ${count}회 대기`);
  }
 }
 const gear=$('gear');
 const gearMode=ready||heatReady?'ready':options.some(o=>o.kind==='maneuver')?'maneuver':'idle';
 const gearTitle=ready?ready.title:heatReady?'열압 연계':gearMode==='maneuver'?'노획 교범':'병기 작업대';
 const gearHint=ready?'조립 가능':heatReady?'조율 가능':`조율권 ${run.tuning}`;
 const gearKey=`${gearMode}:${gearTitle}:${gearHint}`;
 if(gear.dataset.view!==gearKey){
  gear.dataset.view=gearKey;
  gear.dataset.mode=gearMode;
  gear.setAttribute('aria-label',`${gearTitle} · ${gearHint}`);
  gear.setAttribute('aria-keyshortcuts','G');
  gear.innerHTML=`<b>${esc(gearTitle)}</b><small>${gearHint}</small><kbd class="key-hint" aria-hidden="true">G</kbd>`;
 }
 for(const el of $('weapons').children)el.classList.toggle('just-equipped',performance.now()<equippedUntil&&el.dataset.weaponId===equippedWeapon);const feedback=$('field-feedback');feedback.hidden=!feedback.childElementCount||run.phase!=='playing'||performance.now()>equippedUntil;
 $('interact').hidden=!interact||!!interact.blocked;$('interact-label').textContent=interact?.label||'';
 const skill=skillRules(run),counter=portAidCounterReady(run),skillButton=$('skill');
 const skillStatus=p.overdrive>0?`${p.overdrive.toFixed(1)}초 가동`:p.skillCd>0?`${p.skillCd.toFixed(1)}초`:`${Math.floor(p.charge)}/${skill.cost}`;
 skillButton.disabled=!canUseSkill(run);
 skillButton.dataset.counter=counter?'ready':'';
 if(counter)skillButton.setAttribute('aria-label',`지원 포격 · ${actor.skill} 동시 발동 · ${skillStatus}`);
 else skillButton.removeAttribute('aria-label');
 skillButton.innerHTML=`${counter?'지원 포격':actor.skill}<small>${skillStatus}</small>`;
 $('dash').disabled=p.dashCd>0;$('dash').innerHTML=`회피<small>${p.dashCd>0?`${p.dashCd.toFixed(1)}초`:'준비<span class="key-hint"> · SPACE</span>'}</small>`;
 $('raid-hud').hidden=!raid;document.body.classList.toggle('raid-active',!!raid);
 if(raid){
  const {target,contract}=raid;
  $('raid-time').textContent=`탈출까지 ${Math.ceil(raidTimeLeft(raid))}초`;
  $('raid-progress').max=target.maxHp;$('raid-progress').value=target.hp;
  $('raid-hp').textContent=`${bearing(p,target.x,target.y)} ${RAID_MARKS[contract].name} ${Math.ceil(target.hp).toLocaleString()}`;
  $('raid-angle').textContent=contract==='light'?'이탈로를 따라 추격':raidOnNose(run)?'전면 장갑 · 측면으로 우회':'측후면 · 탄환 피해 정상';
 }
 $('boss-hud').hidden=!run.boss.active;
 document.body.classList.toggle('boss-active',run.boss.active);
 document.body.classList.toggle('harbor-boss',run.boss.active&&front===2);
 if(run.boss.active){
  const boss=run.boss,recovering=boss.mode==='recover';
  const railRounds=front===1?run.hazards.filter(h=>h.lane&&!h.hit):[];
  const railOpen=front===1&&recovering&&railDisarmed(boss);
  $('boss-hp').max=boss.maxHp;$('boss-hp').value=boss.hp;
  if(front===1){
   const countdown=railRounds.length?(Math.ceil(Math.min(...railRounds.map(h=>h.timer))*10)/10).toFixed(1):null;
   $('boss-state').textContent=railOpen?'양쪽 포대 파괴 · 차체 노출':recovering?'재장전 · 반격 기회':countdown?`조준 고정 · ${countdown}초 뒤 포격`:boss.mode==='salvo'?'포격 종료 · 반격 준비':'포격 열차 · 조준 준비';
  }else if(front===2){
   const lock=run.hazards.find(h=>!h.hit&&h.portRound==='lock');
   const countdown=lock&&(Math.ceil(lock.timer*10)/10).toFixed(1);
   const rake=run.hazards.some(h=>h.portRound==='rake'&&!h.hit);
   const turret=run.hazards.some(h=>h.portRound==='turret'&&!h.hit)?portTurretSide(boss):0;
   const warning=rake?'가로 포격 ↑↓':lock?.portAxis==='vertical'?`세로 포격 ${portBarrageMark(lock.portAxis,turret)}`:lock?.jammed?'교란 성공 · 발밑 포격':lock?.portAxis==='horizontal'?'장갑탄 차단 · 발밑 포격':'발밑 조준 고정';
   const nextCycle=boss.cycle+1,axis=portBarrageAxis(run,nextCycle);
   const ready=axis==='vertical'?'세로 포격 준비':portRakeReady(run,nextCycle)?'측면 장갑 · 가로 포격 준비':'발밑 포격 준비';
   $('boss-state').textContent=recovering?'코어 노출 · 집중 공격':countdown?`${warning} · ${countdown}초`:boss.mode==='salvo'?'포격 종료 · 반격 준비':ready;
  }
  else $('boss-state').textContent=recovering?'후면 엔진 노출 · 주황 표식으로':boss.mode==='windup'?`돌진 방향 고정 · ${(Math.ceil(boss.timer*10)/10).toFixed(1)}초`:boss.mode==='charge'?'돌진 중 · 진행선 밖으로':'장갑 수송차 · 측후면을 노려라';
  const names=front===1?['좌측 포대','우측 포대']:front===2?['포탑','측면 장갑']:['포탑','궤도'];
  $('boss-parts').textContent=names.map((name,i)=>`${name} ${boss.parts[i].hp<=0?'파괴':railRounds.some(h=>railGunOf(h)===i)?'조준':i===0&&portGantryBypass(run)?'측면 노출':i===0&&portTurretShutter(run)?'포격 장갑':'가동'}`).join(' / ');
  const active=tactic&&recovering&&boss.tacticCycle===boss.cycle;
  const supportId=run.operation?.support;
  const harborPart=front===2&&Object.hasOwn(PORT_SUPPORT,supportId);
  const firstWarning=supportId==='vanguard'&&(boss.cycle===0&&boss.mode==='aim'||boss.cycle===1&&boss.mode==='salvo');
  const dashWindow=!harborPart&&supportId==='overrun'&&recovering;
  const supportHint=supportTactic(supportId,front);
  const harborHint=tactic&&(run.operation.tactic==='heat'?'재장전 · 코어 가까이에서 분사':'원거리 로켓·전기 · 포탑 역송');
  let hint=(front===2?harborHint:tactic?.hint)||(supportId==='vanguard'||harborPart?'':supportHint);
  if(active&&run.operation.tactic==='heat')hint='장갑 과열 · 지금 집중 공격';
  else if(railOpen)hint='';
  else if(front===2&&run.operation.tactic==='signal'&&boss.parts[0].hp<=0)hint=boss.parts[1].hp>0?'측면 장갑 파괴로 장갑탄 차단':'';
  else if(active)hint='전류 연결 완료 · 남은 부위 사격';
  else if(firstWarning||dashWindow)hint=supportHint;
  if(!(front>0)&&boss.mode==='windup'){
   const blockId=boss.chargePath?.blockId;
   hint=blockId&&run.blocks.some(b=>b.id===blockId&&b.hp!==0)?'엄폐까지 돌진 · 진행선 옆으로 빠지세요.':'고정된 돌진선 밖으로 빠지세요.';
  }
  if(coastPlan&&!run.operation.coastStrikeUsed){
   if(!coastArmed)hint=`${coastPlan.name} · 필요한 무장 미장착`;
   else if(run.operation.coastStrike==='r'){
    if(boss.mode==='windup')hint='신호탄 · 떨어져 차체에 로켓 명중';
    else hint='신호탄 · 돌진 예고를 기다려라';
   }else if(recovering)hint='연료관 · 뒤로 돌아 엔진에 분사';
   else if(boss.mode!=='windup')hint='연료관 · 돌진 뒤 후면을 노려라';
  }
  $('boss-tactic').hidden=!hint;$('boss-tactic').textContent=hint;
  const line=$('boss-support');
  line.hidden=!harborPart;
  line.classList.toggle('aid-alert',supportId==='recovery'&&!!(aid?.endangered||aid?.state==='blocked'));
  if(harborPart){
   line.dataset.part=supportId;
   if(supportId==='breach'){
    const turret=boss.parts[0],incoming=run.shots.some(q=>q.breachLane&&q.target===turret.id);
    if(turret.hp<=0)line.textContent='철갑 · 포탑 정지';
    else if(boss.turretSuppressedCycle===boss.cycle&&boss.mode==='salvo')line.textContent='철갑 · 포탑 제압 · 발밑 포격 회피';
    else if(boss.turretSuppressedCycle===boss.cycle&&recovering)line.textContent='철갑 · 후속 탄막 차단 · 측면 사격';
    else if(boss.mode==='salvo'&&incoming)line.textContent='철갑탄 발사 · 지금 발밑 회피';
    else if(portTurretInSight(run))line.textContent='철갑 · 포탑 사선 확보 · 자동 사격';
    else if(portBreachFlank(run))line.textContent='철갑 · 엄폐를 돌아 포탑 사거리로';
    else line.textContent=`철갑 · ${portTurretSide(boss)<0?'왼쪽':'오른쪽'} 포탑 사선으로`;
   }else if(supportId==='overrun'){
    const gap=distance(p,boss)-portCoreReach(boss);
    line.textContent=portCoreDisrupted(run)?'돌격 · 장갑 해제 · 집중 사격':!portCoreWindow(run)?'돌격 · 포격 뒤 회피 준비':p.dash>0&&p.portRush?'돌격 · 경계 안으로 이동':p.dash>0&&Number.isFinite(p.portCutX)?'돌격 · 좌우 이동 유지':p.dashCd>0?'돌격 · 회피 재사용 대기':gap<=0?'돌격 · ↔ 이동 + 회피':gap>110?'돌격 · 코어 경계까지 접근':'돌격 · 코어 쪽 이동 + 회피';
   }else{
    const kit=PORT_SUPPORT.recovery;
    const rake=run.hazards.some(h=>h.portRound==='rake'&&!h.hit);
    if(aid?.endangered)line.textContent='구급 · 피격 범위 밖으로 회피';
    else if(counter&&!skillButton.disabled&&rake)line.textContent='지원 포격 · 지금 눌러 가로 포격 차단';
    else if(aid&&!aid.preview){
     const direction=bearing(p,aid.point.x,aid.point.y);
     const time=(Math.ceil(aid.timer*10)/10).toFixed(1);
     const status=aid.state==='blocked'?'착탄 뒤 회수'
      :aid.state==='safe'?`원을 돌아 회수 ${time}초`
      :`회수 · ${chargeLabel(run)} +${kit.charge}`;
     line.textContent=`구급 ${direction} 화물 · ${status}`;
    }else if(counter)line.textContent=skillButton.disabled?'지원 포격 대기 · 스킬 충전 중':'지원 포격 · 측면 장갑 타격 / 가로 포격 대기';
    else if(aid){
     const axis=portBarrageAxis(run,boss.cycle+1);
     const bait=axis==='horizontal'?'화물 위·아래에서 조준 유도':'화물 좌우에서 조준 유도';
     const next=boss.mode==='salvo'?'다음 포격에 투하':aid.state==='bait'?bait:'여기서 조준 고정 대기';
     line.textContent=`구급 ${bearing(p,aid.point.x,aid.point.y)} ${next}`;
    }else line.textContent='구급 · 화물 투하 완료';
   }
  }
 }
}
const fieldCues={shot:'swarm-shot','rocket-shot':'scatter-shot','focus-shot':'focus-shot',flame:'flame-loop',heat:'heat-break','fire-spread':'fire-spread',kill:'wood-kill',explosion:'power-kill',barrage:'slam','charge-impact':'slam','salvo-impact':'power-kill','payload-impact':'conduit-impact','payload-relay':'conduit-hop',hurt:'hurt',complete:'forge-evolve',skill:'burst',choose:'choose','boss-warning':'boss-warning','mortar-fire':'warning','boss-charge':'boss-charge','port-hatch':'front-entry','boss-down':'armor-collapse','challenge-clear':'rampage','region-entry':'front-entry','raid-success':'forge-evolve','armor-impact':'guard-block',heal:'heal',break:'crowd-break','aid-counter':'crowd-break'};
const bannerPriority=['gate-open','port-hatch','region-entry'];
function processEvents(){
 const banner=$('banner'),events=new Set(takeEvents(run));
 if(banner.dataset.kind&&(mode!=='battle'||bannerRunId!==run.runId||run.t>=bannerUntil)){
  banner.textContent='';delete banner.dataset.kind;
 }
 if(mode!=='battle'||!events.size)return;
 if(store.settings().sound){
  const cues=new Set([...events].map(event=>fieldCues[event]).filter(Boolean));
  if(cues.has('flame-loop')&&run.weapons.some(w=>w.id==='f'&&w.evolved)){cues.delete('flame-loop');cues.add('inferno-jet');}
  if(cues.has('heat-break')){cues.delete('power-kill');cues.delete('wood-kill');}
  for(const cue of selectAudioEvents(cues))audio.play(cue,0,run.weapons.some(w=>w.evolved));
  if(events.has('xp-pickup')&&!cues.has('hurt')&&!cues.has('armor-collapse'))audio.play('xp',0);
 }
 const priority=bannerPriority.find(type=>events.has(type));
 const capstone=events.has('complete')&&run.effects.findLast(f=>f.type==='complete'&&f.showcase);
 if(!priority&&!capstone&&bannerPriority.includes(banner.dataset.kind))return;
 const counter=!priority&&events.has('aid-counter')&&run.effects.findLast(f=>f.type==='aid-counter');
 const fx=capstone||counter||run.effects.findLast(f=>priority?f.type===priority:events.has(f.type)&&(f.text||['boss-arrival','boss-down','raid-start'].includes(f.type)));
 if(!fx)return;
 bannerRunId=run.runId;banner.dataset.kind=fx.type;
 bannerUntil=run.t+(bannerPriority.includes(fx.type)?2.1:1.5);
 if(fx.type==='region-entry'){
  const kit=FRONT_SUPPORTS[run.operation.support];
  banner.innerHTML=`<span>전선 ${String(run.operation.region+1).padStart(2,'0')} / 03</span><strong>${esc(region(run).name)}</strong><small>${esc(kit?`${kit.name} 장착 · ${kit.role}`:region(run).mission)}</small>`;
 }else if(fx.type==='port-hatch'){
  banner.innerHTML='<span>하역장 경비 제압</span><strong>측면 해치 개방</strong><small>초록 경로를 따라 포탑 쪽으로</small>';
 }else if(fx.type==='gate-open'){
  banner.innerHTML=`<span>${esc(region(run).boss)} 격파</span><strong>${esc(exitGate(run).name)} 개방</strong><small>현장 XP 회수 · ${HOLDOUT.grace}초 후 증원</small>`;
 }else{
  banner.textContent=fx.text||({'boss-arrival':region(run).boss,'boss-down':`${region(run).name} 돌파`,'raid-start':'수송대 습격 시작'})[fx.type];
 }
}

function frame(now){
 const elapsed=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
 if(mode!=='battle'||!renderer||!run){
  if(!$('hud').hidden)updateHud();
  requestAnimationFrame(frame);return;
 }
 const starting=firstBattleFrame;
 if(starting){firstBattleFrame=false;accumulator=0;}
 if(!starting&&run.phase==='playing'&&!busy&&!pending){if(elapsed>.5){mutate(d=>{pause(d);return true;});accumulator=0;}else{const previousStage=run.stage;accumulator+=Math.min(.1,elapsed);const input=movementInput();while(accumulator>=1/60&&run.phase==='playing'){step(run,1/60,input,renderer.view());accumulator-=1/60;saveClock+=1/60;}if(run.phase!=='playing'){persistCurrent();accumulator=0;}else if(saveClock>=5||previousStage==='boss'&&run.stage==='holdout')persistCurrent();}}
 renderer.draw(run,store.settings().reduced||reduceMotion.matches);updateHud();
 if(!busy&&!pending)processEvents();
 requestAnimationFrame(frame);
}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
function boot(){
 try{watchCombatHud();const lock=navigator.locks?fn=>navigator.locks.request(`${STORAGE_KEY}:write`,fn):null;store=createStore(localStorage,lock);controls=bindTouchControls({stick:$('stick'),actions:{dash:$('dash'),skill:$('skill'),interact:$('interact')},canPlay:()=>mode==='battle'&&run?.phase==='playing'&&!busy&&!pending,onMove:v=>{touch=v;},onAction:a=>mutate(d=>action(d,a,a==='skill'?movementInput():undefined)),onUnlock:()=>{if(profile().settings.sound)audio.unlock();}});
  const p=profile();selectedOperator=p.lastOperator||'fio';operationPlan=createOperationPlan(()=>crypto.getRandomValues(new Uint32Array(1))[0],p.active?.run.seed??p.recent[0]?.seed);
  showHome();requestAnimationFrame(frame);
  loadFioPortrait().then(art=>{portraitArt=art;drawPortrait();}).catch(()=>{});
  // Paint the lobby before starting the larger combat downloads.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!battleArt&&!artWork)prepareBattleArt();}));
 }catch(error){panel(`<section class="sheet compact"><span class="eyebrow">LOAD INTERRUPTED</span><h2>작전 기록을 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button data-action="reload-latest">기록 다시 불러오기</button></section>`);}
}
boot();
