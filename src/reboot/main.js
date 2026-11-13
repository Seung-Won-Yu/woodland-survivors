import {OPERATORS,operatorOf,operatorId,skillRules,canUseSkill,chargeLabel} from './operator.js';
import {createOperationPlan} from './operation-plan.js';
import {choiceDetails,growthForecast,branchBuildPreview,isQuickMod,gateContractDetails,gateActiveContract,HARBOR_PART_ACTION} from './choice-details.js';
import {terrainSvg,siteSymbol,sitePresentation,gateSymbol,entryRouteSvg,escapeRouteSvg,orderPinSvg,raidRouteSvg,raidPreview,coastOpeningGuide,railSalvagePreview} from './field-scene.js';
import {RAID_MARKS,raidSeconds,raidTimeLeft,raidAhead,raidOnNose} from './raid.js';
import {coastChargeLane} from './coast-charge.js';
import {COAST_SALVAGE,coastSalvage,coastAtShore,isCoastRailSortie,isSalvageCampaign,carriesCoastSalvage,sortieFrontCount,canAdvanceFront,coastRole,coastRoleRank,coastRoleBonus,coastRoleTarget,coastTurretLane,coastHullFront,coastSalvageWreck,coastTurretReturned} from './coast-salvage.js';
import {lobbyView,reportView,replayBriefingView,isReport,gatePace,loadoutChips,itemArt,moduleIcon,coastRescueReward,railHandoff} from './interface.js';
import {REGIONS,BOSS_ENTRY,HOLDOUT,COUNTERBATTERY_CREDITS,MANEUVERS,FRONT_SUPPORTS,PORT_SUPPORT,PORT_AID_INTERCEPT,FRONT_TACTICS,RESEARCH,RESEARCH_PROOF_CREDITS,completedResearchProofs,researchProofProgress,requisitionSite,CARGO_CREDITS,DEFENSE_ZONE,relayDefenseRound,SIGNAL_COLOR,SIGNAL_SECONDS,SIGNAL_CARGO_REACH,signalCargo,signalGuardCount,signalEscortPlan,signalRoute,signalLane,signalLaneLabel,sortieOrder,orderTarget,COAST_APPROACHES,COAST_SALVAGE_LEVEL,coastFork,coastPreemptSite,isOpeningGun,coastResponseCue,coastCrossGun,coastTacticalLootAvailable,coastStagingPoint,coastStrike,coastStrikeArmed,coastStrikeForSite,claimedCoastLead,coastApproach,coastService,COAST_SERVICE_COST,activeEntry,entryWaypoint,railGarrison,wireGarrison,relayCrewLeft,coastLead,coastalThermalPrep,coastLeadColor,coastEncounterCue,frontTactic,railDisarmed,railGunOf,railGunLabel,railLaneLabel,portBreachFlank,portArmorExposed,portFlankPoint,portCoreWindow,portCoreDisrupted,portCoreReach,portCompressionBand,portCompressionRange,portWakeBreach,portWakeMode,portTurretShutter,portGantry,portPartStaging,portSideName,portTacticKeys,portGantryBypass,portTurretSide,portBarrageAxis,portAuxiliaryRound,portCrossfireCuts,portCrossfireZone,portJamsSweep,portRelayCuts,portSignalCuts,portConductiveSignal,portAidCue,portAidCounterReady,portAidCounterRound,portEscapeLanes,holdoutParts,canAdvanceWithVanguard,beachRoute,supportTactic,defenseSeconds,holdoutContract,signalCourier,exitGate,groundXp,holdoutTier,portBatteryPositions,portBatterySide,portBatteries,region,operationCredits,operationPayout,railLaneBounds,railBossGuide,railHasRelay,railHasWire,RAIL_GUN_COLORS} from './campaign.js';
import {GUNS,MODULES,QUALITY,RULES,INFERNO_CORE_DISTANCE,isFocusedInferno,isTrailInferno,isConductiveFusion,buildPaths,bearing,distance,blastContactRadius,gunEquipLevel,rankChoiceLevel,heatSynergyReady,moduleRank,moduleGain,compatible,railCalibration,refitWeapons,weaponStats,capstoneName,fusionTitle,isCapturedTurret,coastFanAngle} from './content.js';
import {restore,snapshot,step,choose,action,reroll,banish,banishOptions,skip,pause,resume,finish,assemblyOptions,gatePreparation,railWorkshopPlan,railRelayInvestment,infernoControlRank,canOpenLevel,activeManeuver,interaction,focusPlan,xpNeeded,takeEvents,infernoCoreLine,portTurretInSight,portArmorLine,harborArcTarget,harborSignalLine,coastRocketVolley,coastRocketCounter,coastSignalPlan,coastFlameLine,emberChargeCue,canStartChallenge,canCallGateChallenge,conduitMortarCue,railFanCutCue,armoredRaidPart} from './model.js';
import {createStore,buyResearch,canLaunchOrder,canReserveResearch,freshSortie,checkpointProfile,settleProfile,STORAGE_KEY} from './profile.js';
import {createRenderer} from './render.js';
import {loadFioPortrait,loadOperatorPortrait,loadMissionArt,loadFieldArt,missionImageUrl,FIELD_ART_COUNT,operatorPortrait} from '../mission/art.js';
import {bindTouchControls} from '../game/touch-controls.js';
import {createAudio} from '../game/audio.js';
import {selectRiftAudioEvents} from './sound.js';
import {RAIL_SALVAGE_ROUTES} from './campaign.js';
import {railInfernoPlan,railAmmoInvestment,focusStudyAvailable} from './model.js';
const $=id=>document.getElementById(id),ui=$('ui'),keys=new Set(),audio=createAudio({fieldMix:true}),esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const touchLayout=matchMedia('(max-width:700px), (pointer:coarse)');
const passiveHudIds=['map-panel','weapons','field-objective','field-feedback'];
const combatHud={rects:[],passive:[],railFrame:null,get analog(){return touchLayout.matches;}};
const hudHold=new Map();
function revealCombatHud(covered,now,reduced=false,stage){
 $('hud').toggleAttribute('data-reduced-motion',reduced);
 for(const id of passiveHudIds){
  if(!covered||id==='field-objective'&&stage!=='field')hudHold.delete(id);
  else if(covered.includes(id))hudHold.set(id,now+240);
  else if((hudHold.get(id)||0)<=now)hudHold.delete(id);
  $(id).toggleAttribute('data-field-clear',hudHold.has(id));
 }
}
function watchCombatHud(){
 if(typeof ResizeObserver!=='function')return;
 const panels=[...document.querySelectorAll('.vitals,.score,#boss-hud,#map-panel,#weapons,#field-objective,#field-feedback,#synergy,#maneuver-status,#support-status,.field-workbench,#stick,#dash,#skill,#interact')];
 let pendingMeasure=false,bodyClass=document.body.className;
 const measure=()=>{
  pendingMeasure=false;
  const measured=panels.flatMap(panel=>{
   const rect=panel.getBoundingClientRect();
   return rect.width&&rect.height&&getComputedStyle(panel).visibility==='visible'?[{id:panel.id||panel.className,rect}]:[];
  });
  combatHud.rects=measured.map(({rect})=>rect);
  combatHud.passive=measured.filter(({id})=>passiveHudIds.includes(id));
  const bounds=id=>measured.find(panel=>panel.id===id)?.rect;
  const boss=bounds('boss-hud');
  combatHud.railFrame=boss?{
   top:Math.max(boss.bottom,bounds('map-panel')?.bottom??0),
   bottom:Math.min(bounds('weapons')?.top??innerHeight,bounds('field-workbench')?.top??innerHeight),
  }:null;
 };
 const schedule=()=>{if(!pendingMeasure){pendingMeasure=true;requestAnimationFrame(measure);}};
 const observer=new ResizeObserver(schedule);
 [...panels,...document.querySelectorAll('.field-stack,.arsenal,.action-buttons')].forEach(panel=>observer.observe(panel));
 new MutationObserver(()=>{
  const next=document.body.className;
  if(next!==bodyClass){bodyClass=next;schedule();}
 }).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 schedule();
}
let store,run,operationPlan,renderer,controls,mode='home',busy=false,committingPlay=false,pauseQueued=false,pending=null,stamp='',inventoryStamp='',mapStamp='',lastFrame=0,accumulator=0,saveClock=0,touch={x:0,y:0},selectedDoctrine='reserve',subpanel=null,noticeTimer,bannerUntil=0,bannerRunId=null,lobbyTab='mission',briefRegion=null,sortieOrderSelection=null,requisitionSelection=null,requisitionAt=null,selectedOperator='fio',selectedStarter='standard',nextPanelFocus=null,choiceOrigin=null,settingsOrigin=null,reportOrigin=null,equippedUntil=0,equippedWeapon=null;
let focusGesture=null,queuedFocus=null,coastGuideId=null,panelPointerButton=null,selectedOpening=null;
let battleArt=null,portraitArt=null,marcoArt=null,marcoArtWork=null,artWork=null,launchPreparation=null,kitPreloaded=false,firstBattleFrame=false;
const profile=()=>store.get();
const unlockSound=()=>{if(store?.settings().sound)audio.unlock();};
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4500);}
function setBusy(on){busy=on;document.body.classList.toggle('is-saving',on);ui.setAttribute('aria-busy',String(on));for(const b of ui.querySelectorAll('button')){if(on&&!b.disabled){b.dataset.saving='true';b.disabled=true;}else if(!on&&b.dataset.saving){b.disabled=false;delete b.dataset.saving;}}}
function panel(html){const origin=nextPanelFocus;nextPanelFocus=null;panelPointerButton=null;ui.innerHTML=html;ui.scrollTop=origin?.scroll||0;keys.clear();controls?.reset();requestAnimationFrame(()=>{const target=origin?.selector&&ui.querySelector(origin.selector)||ui.querySelector('h1,h2')||ui.querySelector('button:not(:disabled)');if(target){if(!target.matches('button,a,input,select,summary'))target.tabIndex=-1;target.focus({preventScroll:true});}});}
function settings(){const p=profile();return `<div class="settings"><label><input type="checkbox" data-setting="sound" ${p.settings.sound?'checked':''}><span>전투 효과음<small>사격 · 적중 · 보스 포격 예고</small></span></label><label><input type="checkbox" data-setting="reduced" ${p.settings.reduced?'checked':''}><span>플래시·흔들림 줄이기<small>강한 폭발 효과와 화면 반동을 줄입니다.</small></span></label></div>`;}
function drawPortrait(){
 const canvas=$('portrait'),id=selectedOperator;
 if(!canvas)return;
 const art=id==='marco'?battleArt||marcoArt:portraitArt||battleArt;
 if(art){requestAnimationFrame(()=>{if(mode==='home'&&canvas.isConnected)operatorPortrait(canvas,art,id,240);});return;}
 if(id==='marco'&&!marcoArtWork)marcoArtWork=loadOperatorPortrait().then(loaded=>{marcoArt=loaded;drawPortrait();}).catch(()=>{}).finally(()=>{marcoArtWork=null;});
}
function showHome(){mode='home';subpanel=null;stamp='home';document.body.dataset.scene='lobby';panel(lobbyView(profile(),{tab:lobbyTab,brief:briefRegion,seed:operationPlan.seed,order:sortieOrderSelection,operator:selectedOperator,requisition:requisitionSelection,requisitionAt,loadout:selectedStarter,openingGun:selectedOpening}));drawPortrait();}
function doctrineChoices(){
 if(run.choice.type!=='level'||run.level<6||run.player.branchChosen)return '';
 const actor=operatorOf(run);
 return `<div class="doctrine" role="group" aria-label="${actor.name} 운용"><b>${actor.name} 운용</b>${Object.entries(actor.stances).map(([id,[name,detail]])=>`<label><input type="radio" name="doctrine" value="${id}" ${selectedDoctrine===id?'checked':''}> ${name} · ${detail}</label>`).join('')}</div>`;
}
function showSettings(){if(!settingsOrigin)settingsOrigin={mode,scroll:ui.scrollTop,subpanel};subpanel={type:'settings'};panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="settings-title"><span class="eyebrow">야전 환경 설정</span><h2 id="settings-title">전투를 편하게.</h2>${settings()}<p class="stat-note">이동 WASD · 회피 SPACE<br>${mode==='home'?OPERATORS[selectedOperator].skill:operatorOf(run).skill} E · 상황 행동 F<br>대기 개조 R · 진화·합체 G<br>전투는 자동 사격합니다. 메뉴에서는 정지합니다.</p><button class="primary" data-action="settings-back">설정 완료</button></section>`);}
function closeSettings(){const origin=settingsOrigin;settingsOrigin=null;subpanel=origin?.subpanel||null;nextPanelFocus={scroll:origin?.scroll||0,selector:'[data-action="settings-menu"]'};if(mode==='home')showHome();else present(true);}
function showRetreat(fromHome=false){
 subpanel={type:'retreat',fromHome};
 const secured=operationCredits({operation:run.operation,stats:run.stats,won:false}),cleared=run.operation?.cleared||0;
 const condition=isCoastRailSortie(run)?'포격 열차 격파 후 귀환 게이트를 통과하면 생존 귀환 수당을 받습니다.':'최종 보스 뒤 출구로 탈출해야 완주로 기록됩니다.';
 panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="retreat-title"><span class="eyebrow">작전 종료</span><h2 id="retreat-title">확보한 성과로 귀환할까요?</h2><p>${cleared}/${sortieFrontCount(run)} 전선 돌파 · ${fmt(run.t)} · LV.${run.level}<br>지금 귀환하면 <strong>${secured}C</strong>를 정산합니다. 이번 무장과 레벨은 다음 판에 초기화됩니다.</p><p class="inline-note">${run.raid?.state==='active'?'진행 중인 습격과 걸었던 상자는 포기합니다. ':''}${condition}</p><div class="buttons"><button class="primary" data-action="retreat-cancel">작전 유지</button><button class="danger" data-action="retreat-confirm">종료하고 ${secured}C 정산</button></div></section>`);
}

const isCapstone=c=>c.kind==='evolve'||c.kind==='fusion';
function choiceKey(c){
 const key=run.choices.indexOf(c)+1;
 return key>0&&key<=9?`<kbd>${key}</kbd>`:'';
}
function choiceCards(cards){
 return cards.map(c=>{
  const d=choiceDetails(run,c),forecast=d.blocked?null:growthForecast(run,c);
  const art=d.art?itemArt(d.art):`<span class="module-engraving">${moduleIcon(c.module||({advance:'route',extract:'extract',stay:'stay'})[c.kind]||'gear')}</span>`;
  const consequence=d.consequence?.length?`<span class="upgrade-consequence">${d.consequence.map(note=>`<small>${esc(note)}</small>`).join('')}</span>`:'';
  const levels=d.before?`<span class="upgrade-levels" aria-label="레벨 ${d.before}에서 ${d.after}로">${Array.from({length:6},(_,i)=>`<i class="${i<d.before?'owned':i<d.after?'added':''}"></i>`).join('')}<b>L${d.before} → ${d.after}</b></span>`:'';
  const verb=({evolve:'진화',fusion:'합체',advance:'결정',stay:'결정',extract:'결정','coast-boss':'교전',permit:'확보',resupply:'보급 받기'})[c.kind]||'장착';
  return `<button class="upgrade-card${isCapstone(c)?' capstone':''}" data-choice="${esc(c.id)}"${d.blocked?' disabled':''}${c.trial?' data-trial="true"':''}${c.workshopFinish?' data-finish="true"':''}>
   <span class="upgrade-category">${esc(c.label||'전술 결정')}</span>${choiceKey(c)}<span class="upgrade-illustration">${art}</span>
   <span class="upgrade-copy"><h3>${esc(d.title)}</h3><strong class="upgrade-impact">${esc(d.impact)}</strong>${d.detail?`<span class="upgrade-detail">${esc(d.detail)}</span>`:''}</span>
   ${levels}<span class="upgrade-link${forecast?` forecast-${forecast.kind}`:''}">${esc(forecast?.text||d.link)}</span>${consequence}
   <span class="upgrade-cost">${esc(d.cost)}</span><span class="install-label">${verb} <span>↵</span></span>
  </button>`;
 }).join('');
}
function choiceDeck(cards){
 return `<div class="upgrade-deck${cards.length===2?' two-options':''}">${choiceCards(cards)}</div>`;
}
function ordnanceDeck(){
 const railway=carriesCoastSalvage(run);
 const cards=run.choices.map(c=>{
  const d=choiceDetails(run,c),broken=c.id==='coast:break',carry=c.id==='carry:turret';
  const count=c.fanCount===7?7:5;
  const route=railway&&!carry&&RAIL_SALVAGE_ROUTES[broken?'rail-relay':'rail-cache'];
  const art=`${itemArt('turret')} ${carry?`<span class="ordnance-crate">${moduleIcon('crate')}</span>`:`<span class="ordnance-rays">${Array.from({length:count},(_,i)=>
   `<i${broken&&(i===0||i===count-1)?' data-cut':''} style="--angle:${coastFanAngle(i,count)}rad"></i>`).join('')}</span>`}`;
  return `<button class="ordnance-card" data-choice="${esc(c.id)}" data-ordnance="${broken?'break':carry?'carry':c.kind==='coast-mount'?'mount':'capture'}"${!broken&&!carry?' data-salvage':''}>
   <span class="ordnance-preview" aria-hidden="true">${art}</span>
   <span class="ordnance-copy"><small>${esc(c.label||'귀환 보상')}</small><strong>${esc(d.title)}</strong>
    <b>${esc(d.impact)}</b>${d.detail?`<span>${esc(d.detail)}</span>`:''}${d.link&&(c.kind!=='coast-mount'||!route)?`<span>${esc(d.link)}</span>`:''}
    ${route?`<span class="ordnance-route" style="--route-ink:${route.color}"><strong>${route.name}</strong><span>${route.fight}</span></span>`:''}</span>${choiceKey(c)}
  </button>`;
 }).join('');
 return `<div class="ordnance-deck">${cards}</div>`;
}
function openingChoiceDeck(cards){
 const guns=cards.filter(c=>c.kind==='gun');
 if(!guns.length)return choiceDeck(cards);
 const role=isSalvageCampaign(run)?coastRole(run):null;
 const rack=guns.map(c=>{
  const d=choiceDetails(run,c);
  const planned=c.weapon===run.operation?.openingGun;
  const pairing=run.weapons.some(isCapturedTurret)&&c.weapon==='h'?'철도 중계기 · 격발망 조립 재료':c.weapon===role?.weapon?role.pairing:'';
  return `<button class="opening-weapon" data-weapon="${c.weapon}"${planned?' data-opening-goal':''} data-choice="${esc(c.id)}"${d.blocked?' disabled':''}>
   <span class="opening-weapon-tray">${itemArt(c.weapon)}${choiceKey(c)}</span>
   <span class="opening-weapon-copy"><strong>${esc(d.title)}</strong>${planned?'<small class="opening-goal">작전 목표 무장</small>':''}<small>${c.weapon==='f'?'근접 분사':c.weapon==='r'?'원거리 폭발':'직선 관통'}</small>
   <b>${esc(d.impact)}</b><span>${esc(d.detail)}</span>${pairing?`<small class="opening-pairing">${esc(pairing)}</small>`:''}${d.link?`<small>${esc(d.link)}</small>`:''}</span>
  </button>`;
 }).join('');
 const alternatives=cards.filter(c=>!guns.includes(c)).map(c=>{
  const d=choiceDetails(run,c);
  const title=c.kind==='rank'?`${d.title} L${d.after} 강화`:d.title;
  const turretRank=c.kind==='rank'&&c.weapon==='r'&&run.weapons.some(isCapturedTurret);
  return `<button class="opening-alternative" data-choice="${esc(c.id)}"${d.blocked?' disabled':''}>
   ${d.art?itemArt(d.art):moduleIcon(c.module||'gear')}<span><strong>${esc(title)}</strong><small>${esc(d.impact)}${turretRank?' · 광각 포탑 준비':''}</small>${c.trial&&d.detail?`<small>${esc(d.detail)}</small>`:''}</span>${choiceKey(c)}
  </button>`;
 }).join('');
 return `<div class="opening-rack${guns.length===1?' single-weapon':''}" role="group" aria-label="노획 무장">${rack}</div>${alternatives?`<div class="opening-alternatives" role="group" aria-label="기타 구출 보급">${alternatives}</div>`:''}`;
}
function assemblyMaintenance(cards){
 if(!cards.length)return '';
 const rows=cards.map(c=>{
  const d=choiceDetails(run,c),forecast=growthForecast(run,c);
  return `<button class="maintenance-row" data-choice="${esc(c.id)}">
   ${choiceKey(c)}<span><b>${esc(d.title)}</b><small>${esc(d.impact)}${d.detail?` · ${esc(d.detail)}`:''}</small>
   ${forecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}</span>
   <small class="maintenance-cost">${c.kind==='maneuver'?'무료':'조율권 1개'}</small>
  </button>`;
 });
 return `<div class="assembly-maintenance" role="group" aria-label="기타 정비">${rows.join('')}</div>`;
}
function equippedFeedback(c,d,openingGun,heatActivated){
 if(!['rank','gun','module','tune','repair','evolve','fusion','maneuver','permit','resupply','front-support','cargo','calibrate','coast-strike'].includes(c.kind))return;
 equippedUntil=performance.now()+1900;
 equippedWeapon=c.weapon||c.primary||null;
 const feedback=$('field-feedback');
 if(c.kind==='fusion'||c.kind==='evolve'&&c.weapon==='f'){
  feedback.replaceChildren();feedback.hidden=true;return;
 }
 if(openingGun||c.coastLevel){feedback.replaceChildren();feedback.hidden=true;return;}
 if(heatActivated){
  feedback.innerHTML=`${moduleIcon('catalyst')}<div><span>전투 연계 개방</span><b>열압 연계 가동</b><small>불붙은 적에 폭발을 맞히세요.</small></div>`;
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
 const fan=run.weapons.find(isCapturedTurret);
 const targetId=fan?'evolve:r':(run.stats.railRebuild||run.firstNew==='r')?'fusion:h:r':run.firstNew==='f'?'evolve:f':'evolve:h';
 const target=recipes.find(p=>p.id===targetId);
 const equipped=fan?.evolved?fan:run.weapons.find(w=>w.evolved&&(w.id===run.firstNew||w.fusion?.secondary===run.firstNew));
 const installed=equipped?.fusion?fusionTitle(equipped.id,equipped.fusion.secondary,equipped.fusion.branch):equipped?capstoneName(equipped):recipes.find(p=>p.complete&&p.id!=='heat')?.title;
 const remaining=!equipped&&target?.missing&&['progress','permit'].includes(target.status)?target:null;
 const capstones=prep.capstones;
 const build=capstones.length
  ?`<button data-action="gate-assemble" aria-keyshortcuts="G"><small>조립 가능 · 조율권 1개</small><b>${esc(capstones.length===1?capstones[0].title:`완성 병기 ${capstones.length}종`)} <span aria-hidden="true">→</span></b></button>`
  :remaining?`<div><small>${esc(remaining.title)}까지</small><b>${esc(remaining.missing)}</b></div>`
  :installed?`<div><small>다음 전선 장착</small><b>${esc(installed)}</b></div>`:'';
 const xp=prep.upgrades?`<button data-action="gate-upgrade" aria-keyshortcuts="R"><small>획득한 XP · 1회 사용</small><b>대기 개조 ${prep.upgrades}회 <span aria-hidden="true">→</span></b></button>`:'';
 return build||xp?`<div class="gate-prep" role="group" aria-label="전진 전 정비">${build}${xp}</div>`:'';
}
function gateChoices(){
 const coast=coastSalvage(run),final=run.operation.region===2,vanguard=canAdvanceWithVanguard(run);
 const active=gateActiveContract(run);
 const railReturn=carriesCoastSalvage(run)&&run.operation.region===1;
 const part=railReturn&&Object.hasOwn(HARBOR_PART_ACTION,run.operation.nextSupport)?FRONT_SUPPORTS[run.operation.nextSupport]:null;
 const operation={...run.operation,extracted:final,...(coast?{coastSalvage:{...coast,extracted:final||railReturn||!isSalvageCampaign(run)}}:{})};
 const payout={operation,stats:run.stats,won:final,reason:railReturn?'rail-return':coast&&!isSalvageCampaign(run)?'coast-return':'retreat'};
 const p=profile(),proofs=completedResearchProofs(payout).filter(id=>p.trials.includes(id));
 const extraction=operationPayout(payout,!p.milestones.medic,proofs);
 const {counterbattery,turret}=extraction.lines;
 const payoutNote=counterbattery?`진지 노획품 +${counterbattery}C`:turret?`포탑 반출 +${turret}C`:railReturn?'생존 귀환 +60C':'';
 const unlock=railReturn&&turret&&!p.milestones.coastTurret?'새 출격의 시작 무장 해금':'';
 const orders=run.choices.map((card,index)=>{
  const d=choiceDetails(run,card);
  if(card.kind==='stay'&&canCallGateChallenge(run)){
   const {title,goal,reward,cost,parts}=gateContractDetails(run);
   const prize=parts.length?`<span class="gate-part-choices">${parts.map(part=>`<span>${itemArt(FRONT_SUPPORTS[part.id].art)}<small><b>${esc(part.title)}</b> · ${esc(part.detail)}</small></span>`).join('')}</span><small>또는 현장 체력 +28 · ${esc(chargeLabel(run))} +35</small>`:`<small class="gate-contract-prize">${esc(reward)}</small>`;
   return `<div class="gate-holdout"><button class="gate-order gate-contract" data-action="gate-challenge" aria-keyshortcuts="Q"><span class="gate-order-icon" aria-hidden="true">${moduleIcon('stay')}</span><span class="gate-order-copy"><strong>${esc(title)}</strong><small>${esc(goal)}</small>${prize}${cost?`<small>${esc(cost)}</small>`:''}</span><kbd>Q</kbd></button><button class="gate-passive" data-choice="stay">${esc(d.title)} <kbd>${index+1}</kbd></button></div>`;
  }
  const lines=card.kind==='advance'&&carriesCoastSalvage(run)&&coastAtShore(run)?[card.desc]
   :card.kind==='advance'?[d.impact,d.link,vanguard?d.cost:'',run.operation.region===0&&run.operation.coastStrikeUsed?'수송차 노획 보급 이월':'']
   :card.kind==='stay'?[d.detail,d.link]
   :[`${extraction.credits.toLocaleString()}C 정산${payoutNote?` · ${payoutNote} 포함`:''}`,active?.leaving||unlock||(part?'':coast?card.desc:d.link),active?unlock:'',part?`${part.name} 항구 지원 종료`:''];
  const art=card.kind==='extract'&&extraction.lines.turret?'turret':card.kind==='advance'&&part?part.art:null;
  const icon={advance:'route',stay:'stay',extract:'extract'}[card.kind];
  return `<button class="gate-order" data-choice="${esc(card.id)}"><span class="gate-order-icon" aria-hidden="true">${art?itemArt(art):moduleIcon(icon)}</span><span class="gate-order-copy"><strong>${esc(d.title)}</strong>${lines.filter(Boolean).map(text=>`<small>${esc(text)}</small>`).join('')}</span><kbd>${index+1}</kbd></button>`;
 }).join('');
 return `<div class="gate-deck" data-count="${run.choices.length}">${orders}</div>`;
}
function showChoices(){
 const coastOptions=run.choices.some(c=>c.kind==='coast-strike');
 const coastalService=run.choices.some(c=>c.coastLevel);
 const railAmmo=run.choice.siteId==='rail-ammo';
 const toolsAfterDeck=coastOptions||coastalService;
 const thermalPrep=run.choice.siteId==='supply-c'&&coastalThermalPrep(run)&&run.choices.some(c=>c.module==='coil');
 const salvage=!thermalPrep&&run.choices.find(c=>c.salvageLevel);
 const tacticalLoot=salvage&&run.choices.some(c=>c.salvageLevel===1);
 const relaySupply=run.choice.type==='supply'&&run.choice.relayRepair===true;
 const type=run.choice.type,quick=isQuickMod(run),atGate=type==='clear'&&!!run.operation,atPursuit=type==='pursuit-reward',workshop=type==='rail-workshop';
 const shoreGate=atGate&&coastAtShore(run)&&carriesCoastSalvage(run),mount=type==='coast-mount',carrier=type==='coast-boss';
 const carrierPrep=carrier&&isSalvageCampaign(run)&&run.pendingLevels>0;
 const earnedLevel=run.level-run.pendingLevels;
 const railGate=atGate&&carriesCoastSalvage(run)&&run.operation.region===1;
 const title=({level:'야전 개조',supply:run.choice.opening?'첫 무장을 골라라':run.choice.preempt?'전방 보급 선점':thermalPrep?'박격포 진지 보급':railAmmo||coastalService?esc(run.choice.source):relaySupply?'중계기 정비 보급':salvage?'노획 무장 인수':'노획 병기를 골라라',armory:'확보할까, 걸어볼까','raid-reward':'습격 성공 · 전리품','pursuit-reward':'잔류 보급 선택',assembly:'야전 병기 작업대',clear:shoreGate?'철도 전진로 개방':railGate?'철도 돌파':canAdvanceFront(run)?'다음 전선이 열렸다':'귀환로 개방','coast-boss':'파괴할까, 노획할까','coast-mount':'노획 포탑 확보',control:run.choices.some(c=>c.infernoRank||c.relayInvestment)?'열차 전술 또는 무장 정비':'보스 공략을 골라라','rail-workshop':'화차 정비대'})[type];
 const rescueReceipt=run.stats.rescueFanSweep?'포로 구출 · 양쪽 대열 명중':'포로 구출 완료';
 const assembly=type==='assembly',gateAssembly=assembly&&run.choice.gatePrep,gateLevel=type==='level'&&run.choice.gatePrep;
 const back=assembly?run.choices.find(c=>c.kind==='back'):null;
 const capstones=assembly?run.choices.filter(isCapstone):[];
 const other=assembly?run.choices.filter(c=>c!==back&&!isCapstone(c)):[];
 const quality=run.choice.quality,receipt=type==='raid-reward'?raidReceipt(quality):'',paths=assembly&&!gateAssembly?workshopBlueprints():'';
 const orderArmory=type==='armory'&&run.choice.siteId==='arsenal'&&run.operation?.region===0&&run.operation.order==='convoy'&&!run.raidUsed;
 const gateIntel=atGate?`<div class="gate-intel"><span><small>돌파 전선</small><b>${esc(region(run).name)}</b></span><span><small>다음 전선</small><b>${canAdvanceFront(run)?esc(REGIONS[run.operation.region+1].name):'작전실'}</b></span><span><small>미회수 XP</small><b>${groundXp(run)}</b></span></div>`:'';
 const handoff=shoreGate?railHandoff(run):null;
 const fitTurret=shoreGate&&gatePreparation(run)?.mounts.length;
 const transfer=handoff?`<div class="front-transfer" data-transfer="${handoff.state}">${itemArt(handoff.art)}<div><b>${fitTurret?'노획 포탑 확보':esc(handoff.title)}</b><small>${fitTurret?'철도에서 즉시 사격':esc(handoff.detail)}</small></div>${fitTurret?'<button data-action="gate-mount">포탑 장착 <span aria-hidden="true">›</span></button>':''}</div>`:'';
 const railPreview=carrier&&carriesCoastSalvage(run)?`<aside class="rail-salvage-brief" aria-label="다음 전선 철도 공략">${railSalvagePreview(run.seed)}
  <div>${['rail-relay','rail-cache'].map(id=>{
   const route=RAIL_SALVAGE_ROUTES[id];
   return `<span style="--route-ink:${route.color}"><b>${route.name}</b><small>${route.boss}</small></span>`;
  }).join('')}</div></aside>`:'';
 const currentKit=type==='level'?`<span class="draft-loadout" aria-label="보유 무장">${run.weapons.map(w=>`<b>${GUNS[w.id].short}${w.fusion?`+${GUNS[w.fusion.secondary].short}`:` L${w.level}`}</b>`).join('')}<small>모듈 ${run.modules.length}/4 · 조율권 ${run.tuning}</small></span>`
  :`<span>공격 ${run.weapons.length}/3 · 모듈 ${run.modules.length}/4 · 조율권 ${run.tuning}</span>`;
 const compactSkip=coastalService?'<button data-action="skip" aria-label="건너뛰기 · 소량 회복">건너뛰기</button>':'';
 const gatePrep=atGate?gatePreparationView():'';
 const tools=atGate?(shoreGate?transfer:gateIntel)+gatePace(run.operation,profile().active?.reference)+(railGate?'':gatePrep):carrier||mount||assembly||run.choice.preempt||run.choice.opening&&!banishOptions(run).length?'':`<div class="choice-tools">${currentKit}<div>${['level','supply','armory','raid-reward'].includes(type)?`<button data-action="reroll" ${run.rerolls<=0||run.choice.opening?'disabled':''}>${run.choice.opening?'고정 보급':`재추첨 ${run.rerolls}`}</button><button data-action="banish-menu" ${run.banishes<=0?'disabled':''}>후보 제외 ${run.banishes}</button>${compactSkip}`:''}</div></div>`;
 const lead=carrier||mount?'':run.choice.coastPrep?'선택 후 수송차 전술로 돌아갑니다.':gateLevel?'개조를 확정하면 게이트로 돌아갑니다.':type==='level'?(run.pendingLevels?`대기 개조 ${run.pendingLevels}회 · 전장에서 이어서 사용`:''):atGate?(shoreGate?`해안 → 철도 · 미회수 XP ${groundXp(run)}`:railGate?'':canAdvanceFront(run)?'전진하거나 현장에 남아 보급을 회수하세요.':'귀환하거나 남아서 추가 점수를 노리세요.'):workshop?'회수한 공구로 이번 판의 무장을 정비하세요.':thermalPrep?'흡열 코일에 필요한 축전 코일을 장착할 수 있습니다.':coastalService?'보급 한 가지 선택':run.choice.preempt?'노획 무장 또는 현장 정비':coastOptions?'무장을 강화하거나 보스 공략을 고르세요.':tacticalLoot?'L2 무장 또는 L1 무장과 수송차 전술':salvage?`${run.choice.source} · 빈 무기 칸에 L${salvage.salvageLevel} 장착`:assembly?'':type==='control'&&run.operation?.region===1&&run.stage==='field'?'중계기 확보 · 포대 조준 중 유인 신호 1회':run.choice.opening?`${beachRoute(run.seed).name} · 현재 위치 기준`:run.choice.source.replace('전방 구조 보급','포로 구출 보상').replace('이동 보급대','이동 보급차');
 const gateNote=run.pendingLevels?!canAdvanceFront(run)?`귀환 시 미사용 개조 ${run.pendingLevels}회 소멸`:`대기 개조 ${run.pendingLevels}회 · 전진하면 이월`:run.challenge?.state==='active'?'':'잔류하면 증원군이 강해집니다. 게이트는 계속 열려 있습니다.';
 const deck=carrier||mount?ordnanceDeck():atGate?gateChoices():assembly?`${capstones.length?choiceDeck(capstones):paths}${assemblyMaintenance(other)}`:run.choice.opening?openingChoiceDeck(run.choices):choiceDeck(run.choices);
 const footer=gateAssembly?'조립을 마치면 같은 게이트로 돌아갑니다.':assembly?(run.tuning?'조립과 정비는 조율권을 공유합니다.':(run.operation?.cleared||0)<2?'중간 보스 격파 시 조율권 1개 확보':'보유 조율권 없음'):type==='control'?'이번 전선에서 쓸 전술 또는 보급 한 가지':type==='clear'?gateNote:atPursuit?(run.operation.region<2?'선택한 장비는 다음 전선 한 곳에서 작동합니다.':'다음 D2 · 양쪽 박격포 제압 +1,000점 · 귀환로 개방'):workshop?'정비 보급은 한 가지 · 변경한 발사 방식은 항구까지 유지':type==='level'||run.choice.opening||coastalService?'':'새 총은 필드에서 · XP는 보유 공격과 모듈에 투자';
 panel(`<section class="sheet field-menu${carrier||mount?' field-ordnance':''}${assembly?' assembly-menu':''}${gateAssembly?' gate-assembly':''}${coastOptions?' coast-options':salvage?' coast-salvage':''}${coastalService?' coast-service-menu':relaySupply?' relay-supply-menu':''}${type==='level'?' level-draft':''} ${quick?'quick-mod':''}${atGate?' gate-menu':atPursuit?' pursuit-menu':type==='control'?' control-menu':workshop?' rail-workshop':run.choice.opening?' opening-supply':''}" role="dialog" aria-modal="true" aria-labelledby="choice-title">
  <header><div><span class="eyebrow">${carrier?'해안 · 장갑 수송차':mount?esc(run.choice.source):run.choice.opening?rescueReceipt:run.choice.preempt?'기습 성공':type==='level'?`LV.${earnedLevel} 보상 · XP 개조`:assembly?`조율권 ${run.tuning}개`:type==='clear'?(railGate?'귀환로 개방':'게이트 통과'):atPursuit?'잔류 도전 D1':workshop||relaySupply?'철도 · 현장 정비':'노획 · 현장 보급'} ${quality?' / '+QUALITY[quality]:''}</span><h2 id="choice-title">${title}</h2>${lead?`<p>${esc(lead)}</p>`:''}</div><span class="paused">${atGate||carrier||mount?'Ⅱ 전투 정지':'Ⅱ 정비 중'}</span></header>
  ${toolsAfterDeck?'':tools}${doctrineChoices()}${receipt}${orderArmory?'<p class="armory-order-note">보급선 절단 · 경량 보급차를 저지해야 지령을 완료합니다. 여기서 보급을 받거나 건너뛰면 지령 기회를 잃습니다.</p>':''}${railPreview}${carrierPrep?`<button class="carrier-prep" data-action="coast-upgrade" aria-keyshortcuts="R"><span>${moduleIcon('gear')}<b>XP 개조</b> <small>${run.pendingLevels}회 대기</small></span><span>교전 전 사용 <i aria-hidden="true">›</i></span></button>`:''}${deck}${railGate?gatePrep:''}${toolsAfterDeck?tools:''}
  ${coastalService||carrier||mount?'':`<footer class="choice-footer">${footer?`<small>${footer}</small>`:''}<div class="buttons">${back?`<button data-choice="back">${gateAssembly?'게이트로 돌아가기':'전투로 돌아가기'} ${choiceKey(back)}</button>`:''}${type==='armory'&&!run.raidUsed?'<button class="primary" data-action="raid-menu">상자를 걸고 습격</button>':''}${!['assembly','clear','control','pursuit-reward'].includes(type)?'<button class="subtle" data-action="skip">건너뛰기 · 소량 회복</button>':''}</div></footer>`}
  ${capstones.length?paths:''}
 </section>`);
}
function showPause(){panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">작전 일시정지</span><h2 id="pause-title">다음 한 수를 준비하라.</h2><p>${run.operation?`${run.operation.region+1}/${sortieFrontCount(run)} ${region(run).name} · ${fmt(run.t)} · LV.${run.level}`:'전투 중'}<br>${run.stage==='holdout'?'게이트 개방. 남아서 XP를 회수하거나 게이트로 이동하세요.':region(run).mission}</p>${loadoutChips(run.weapons,run.modules)}<div class="pause-actions"><button class="primary" data-action="continue">전투 이어하기 ▶</button><button data-action="retreat">작전 정산</button></div><div class="pause-secondary">${run.raid?.state==='active'?'<button data-action="withdraw">습격 철수 · 건 상자 소실</button>':''}${run.stage==='holdout'&&(!coastSalvage(run)||isSalvageCampaign(run))&&(!run.challenge||run.operation&&['complete','failed'].includes(run.challenge.state))?`<button data-action="challenge">${holdoutContract(run).name} · D ${(run.operation?.challengeTier||0)+1}</button>`:''}<button class="text-button" data-action="settings-menu">환경 설정</button></div></section>`);}
function showResult(r=run.result,archived=false){
 const p=profile();
 if(!archived&&r?.runId)r=p.recent.find(x=>x?.runId===r.runId&&isReport(x))||r;
 document.body.dataset.scene=archived||!renderer?'lobby':'battle';
 panel(reportView(r,p,{archived}));
}
function closeArchivedReport(){
 lobbyTab='archive';nextPanelFocus=reportOrigin;reportOrigin=null;showHome();
}
function openReplayBriefing(source){
 const p=profile(),sequence=Number(source.dataset.replayFrom);
 const report=p.recent.find(r=>r?.sequence===sequence&&isReport(r));
 const trial=source.dataset.trialFocus;
 const experiment=source.hasAttribute('data-experiment'),route=source.dataset.replayRoute;
 if(!report){notice('지난 전장의 작전 보고서를 읽지 못했습니다.');return;}
 const options=experiment||route?{freshSeed:operationPlan.forReport(report.seed),route,sortie:!!route}:{};
 if(route==='fresh'&&coastTurretReturned(report)&&p.milestones.coastTurret)options.starter='turret';
 const html=replayBriefingView(report,p,source.dataset.dispatch,trial,options);
 if(!html){notice('지난 전장의 작전 보고서를 읽지 못했습니다.');return;}
 const selector=experiment?'[data-experiment]':route?`[data-replay-route="${route}"]`:'[data-action="replay-brief"]:not([data-experiment])';
 subpanel={type:'replay-briefing',report,trial,dispatch:source.dataset.dispatch,options,origin:{scroll:ui.scrollTop,selector}};
 panel(html);
}
function refreshReplayBriefing(selector){
 const {report,trial,dispatch,options}=subpanel;
 nextPanelFocus={scroll:ui.scrollTop,selector};
 panel(replayBriefingView(report,profile(),dispatch,trial,options));
}
function closeReplayBriefing(){
 if(subpanel?.type!=='replay-briefing')return;
 const {report,origin}=subpanel;
 subpanel=null;nextPanelFocus=origin;
 showResult(report,mode==='report');
}

function raidReceipt(quality){
 const {part}=run.raid||{};
 const cargo=part&&run.choices.find(c=>c.support&&c.module===part.module);
 const exchange=part&&run.choices.find(c=>c.label==='노획 부품 교환 보급');
 const note=cargo?`${MODULES[part.module].name} ${part.rank}강화 확보 가능`:exchange?'지정 부품을 교환 보급으로 전환':run.choice.contract==='light'?'야전 개장 또는 무기 강화 보급':'장갑 수송대 보급';
 return `<div class="loot-receipt"><span>${QUALITY[run.choice.wagerQuality]||'기존'} 상자</span><b>→ ${QUALITY[quality]} 보급</b><small>${esc(note)}</small></div>`;
}
function showRaid(){
 subpanel={type:'raid'};
 const part=armoredRaidPart(run),quality=QUALITY[run.choice.quality];
 const stock=run.choices.map(card=>{
  if(card.kind!=='module')return choiceDetails(run,card).title;
  const gain=moduleGain(run,card.module,card.rank);
  return `${MODULES[card.module].name}${gain.next>gain.current?` ${gain.next}강화`:''}`;
 });
 const alreadyOffered=part&&run.choices.some(c=>c.kind==='module'&&c.module===part.module&&moduleGain(run,c.module,c.rank).next>=part.rank);
 const contracts=Object.entries(RAID_MARKS).map(([id,mark])=>{
  const cfg=RULES.raidContracts[id],odds=RULES.quality[cfg.qualityKey];
  const counts=id==='light'&&run.operation?.region===0&&run.operation.order==='convoy';
  const armored=id==='armored';
  const reward=armored?(part?`${MODULES[part.module].name} ${part.rank}강화 확보`:isSalvageCampaign(run)?'무작위 보급 후보':mark.reward)
   :refitWeapons(run).length?'분화 개장 후보 확보':run.weapons.some(w=>!w.evolved&&!w.fusion&&w.level<6)?'보유 무기 강화 후보 확보':'무작위 보급 후보';
  const goal=armored&&part?[part.goal,part.closes?(part.permit?'재료 충족 · 조율권 필요':part.path==='heat'?'장착 시 발동':'조립에 조율권 1개'):'재료 확보',part.replace?'모듈 교체 필요':''].filter(Boolean).join(' · '):'';
  return `<button class="raid-contract" data-action="raid:${id}" style="--route-ink:${mark.color}"><strong>${mark.name} 습격</strong><span class="raid-risk">${Math.ceil(raidSeconds(id))}초 · 내구 ${cfg.hp.toLocaleString()}</span><span>${armored?'측후면 사격 · 정면 실탄 피해 절반':mark.move}</span><b class="raid-prize">${esc(reward)}</b>${goal?`<small class="raid-goal">${esc(goal)}</small>`:''}${armored&&alreadyOffered?'<small class="raid-stock-match">현재 상자에서도 선택 가능</small>':''}${counts?'<small class="raid-order-tag">보급선 절단 지령 대상</small>':''}<small>일반 ${Math.round(odds.common*100)}% · 희귀 ${Math.round(odds.rare*100)}% · 원형 ${Math.round(odds.prototype*100)}%</small></button>`;
 }).join('');
 panel(`<section class="sheet compact raid-brief" role="dialog" aria-modal="true" aria-labelledby="raid-title"><header><div><span class="eyebrow">무기고 · 보급 선택</span><h2 id="raid-title">수송대 습격</h2></div><span class="paused">Ⅱ 전투 정지</span></header><button class="raid-keep" data-action="choice-back">${moduleIcon('crate')}<span><strong>현재 ${quality} 보급 유지</strong><small>${stock.map(esc).join(' · ')}</small></span><i aria-hidden="true">›</i></button><p class="raid-stake">차량이 탈출하거나 철수하면 현재 상자를 잃습니다. 성공 보급의 품질은 다시 추첨합니다.</p><div class="raid-contracts">${contracts}</div><div class="raid-brief-map">${raidPreview(run)}<div class="raid-legend"><span>● 현재 위치</span><span>○ 차량 출발</span><span>▥ 탈출 검문선</span></div></div></section>`);
}
function branchOutcome(c,branch,args){
 const result=branchBuildPreview(run,c,branch,args);
 const forecast=growthForecast(run,c,{...args,branch});
 const showForecast=forecast&&(forecast.kind==='cost'||forecast.ids?.includes('heat')||forecast.text.startsWith('열압 연계 발동'));
 return `${result?`<span class="branch-outcome" data-state="${result.status}"><b>${esc(result.title)}</b><small>${esc(result.payoff)}</small><small class="branch-need">${esc(result.need)}</small></span>`:''}
  ${showForecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}`;
}
function showBranches(c,args){
 subpanel={type:'branch',card:c,args};
 const gun=GUNS[c.weapon],rank=c.kind==='rank',current=rank&&run.weapons.find(w=>w.id===c.weapon&&!w.fusion),level=rank?rankChoiceLevel(current,c):gunEquipLevel(run,c,run.weapons[args.slot]);
 const branches=Object.entries(gun.branches).map(([id,[name,desc]])=>
  `<button data-branch="${id}" data-branch-style="${id}">
   <strong>${name}</strong><small>${isCapturedTurret(current)&&id==='homing'?'가운데 탄만 추적합니다. 바깥 탄은 부채꼴 사선을 유지합니다.':desc}</small>${branchOutcome(c,id,args)}
  </button>`).join('');
 panel(`<section class="sheet branch-sheet" role="dialog" aria-modal="true" aria-labelledby="branch-title">
  <header class="branch-heading">${itemArt(isCapturedTurret(current)?'turret':c.weapon)}<div><span class="eyebrow">${rank?`L${current.level} → L${level}${c.railDonor?' · F 분해':c.coastLevel?` · 조율권 ${COAST_SERVICE_COST}개 사용`:''}`:`개장 · L${level}`}</span><h2 id="branch-title">${isCapturedTurret(current)?COAST_SALVAGE.turretName:gun.name} 분화</h2></div><span class="paused">Ⅱ 정비 중</span></header>
  <div class="branch-list branch-compare">${branches}</div>
  <footer class="branch-footer"><button data-action="choice-back">← 후보로 돌아가기</button></footer>
 </section>`);
}
function showRefits(c){
 subpanel={type:'refit',card:c};
 const branches=refitWeapons(run).map(w=>{
  const gun=GUNS[w.id],next=Object.keys(gun.branches).find(id=>id!==w.branch);
  return `<button data-refit="${w.id}" data-branch-style="${next}"><strong>${gun.name} L${w.level}</strong>
   <small>${gun.branches[w.branch][0]} → ${gun.branches[next][0]}</small>${branchOutcome(c,next,{weapon:w.id})}</button>`;
 }).join('');
 panel(`<section class="sheet branch-sheet" role="dialog" aria-modal="true" aria-labelledby="refit-title">
  <header><div><span class="eyebrow">무기 레벨 유지</span><h2 id="refit-title">발사 방식 개장</h2></div><span class="paused">Ⅱ 정비 중</span></header>
  <div class="branch-list branch-compare">${branches}</div>
  <footer class="branch-footer"><button data-action="choice-back">← 전리품으로 돌아가기</button></footer>
 </section>`);
}
function showSlots(c){
 subpanel={type:'slots',card:c};const gun=c.kind==='gun';
 panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="slot-title"><span class="eyebrow">LOADOUT / REFIT</span><h2 id="slot-title">${esc(c.title)}</h2><p>${gun?'빈칸에 더하거나 기존 총을 개장합니다.':'한 모듈을 교체합니다. 기존 효과와 강화는 잃습니다.'}</p><div class="branch-list">${gun&&run.weapons.length<3?`<button data-slot="empty"><b>빈 무기 칸에 L${gunEquipLevel(run,c)} 장착</b><small>현재 공격과 투자를 유지합니다.</small></button>`:''}${(gun?run.weapons:run.modules).map((w,i)=>{if(gun&&(w.evolved||w.fusion))return'';const level=gun?(gunEquipLevel(run,c,w)):null;const forecast=gun&&level>=4?null:growthForecast(run,c,{slot:i});const allowed=gun||canReplaceModule(run,c.module,i);return `<button data-slot="${i}" ${allowed?'':'disabled'}><b>${gun?`${GUNS[w.id].name} L${w.level} → ${GUNS[c.weapon].short} L${level}`:`${MODULES[w.id].name} ${w.rank}강화 교체`}</b><small>${gun&&run.refits>0&&run.stage==='field'?'무료 개장 1회 소비 · 분화 재선택':gun?'일부 투자만 이전 · 분화 재선택':allowed?'기존 모듈 효과 소멸':'흡열 코일에 필요한 축전 코일'}</small>${forecast?`<small class="forecast-${forecast.kind}">${esc(forecast.text)}</small>`:''}</button>`;}).join('')}</div><button data-action="choice-back">취소 · 무장 유지</button></section>`);
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
   selectedOpening=null;
   mode='battle';sortieOrderSelection=null;requisitionSelection=null;requisitionAt=null;document.body.dataset.scene='battle';selectedOperator=operatorId(draft);selectedDoctrine=draft.player.doctrine;$('world').setAttribute('aria-label',`${operatorOf(draft).name}의 빌드 서바이버 전투`);firstBattleFrame=true;pauseQueued||=document.hidden;
   equippedUntil=0;equippedWeapon=null;
   const feedback=$('field-feedback');feedback.replaceChildren();feedback.hidden=true;
   if(launchMode==='fallback')notice('전장 원화를 불러오지 못해 기본 표시로 실행합니다.');
  }
  setBusy(false);committingPlay=false;present(true);
  const fire=queuedFocus;queuedFocus=null;
  if(pauseQueued){pauseQueued=false;if(run.phase!=='result')await mutate(d=>{pause(d);return true;});}
  else if(fire&&run.phase==='playing')await mutate(d=>action(d,'skill',fire));
  return true;
 }catch(error){setBusy(false);committingPlay=false;pauseQueued=false;queuedFocus=null;savingError(error,next,draft,launchMode);return false;}
}
async function mutate(fn){if(busy||pending||!run)return;const draft=snapshot(run);if(fn(draft)===false)return;const p=profile(),next=draft.result?settleProfile(p,draft):checkpointProfile(p,draft);await commitDraft(draft,next);}
async function persistCurrent(){if(busy||pending||!run)return;if(!profile().active&&run.phase!=='result')return;await commitDraft(snapshot(run),run.result?settleProfile(profile(),run):checkpointProfile(profile(),run));}
function updatePreparation(count){
 if(!launchPreparation)return;
 const {overlay}=launchPreparation;
 overlay.querySelector('progress').value=count;
 overlay.querySelector('.prep-count').textContent=`전장 원화 ${count}/${FIELD_ART_COUNT} 준비`;
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
 const onProgress=()=>{
  if(artWork!==work)return;
  updatePreparation(++work.completed);
 };
 work.promise=Promise.all([loadMissionArt({priority,onProgress}),loadFieldArt(priority,onProgress)]).then(([art,fieldArt])=>{
  Object.assign(art,fieldArt);
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
 overlay.innerHTML=`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="prep-title"><span class="eyebrow">01 / 해안 침투</span><h2 id="prep-title" tabindex="-1">해안 상륙 준비</h2><p>전장 원화를 불러오는 중입니다.</p><progress max="${FIELD_ART_COUNT}" value="0" aria-label="전장 원화 준비"></progress><small class="prep-count" role="status"></small><button data-action="cancel-launch">출격 취소</button></section>`;
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
 const delivery=source.dataset.requisitionAt||null;
 const coastLoadout=source.dataset.coastLoadout||null,openingGun=source.dataset.openingGun||null;
 const fullCampaign=source.dataset.action!=='coast-launch'&&!source.hasAttribute('data-legacy-coast');
 if(!Object.hasOwn(OPERATORS,actor))return;
 if(busy||pending||launchPreparation)return;
 if(order&&!canLaunchOrder(profile(),order)){notice('지령 출격 조건을 확인하세요.');return;}
 if(requisition&&!canReserveResearch(profile(),requisition,delivery)){notice('장비 예약 조건을 확인하세요.');return;}
 unlockSound();
 let art=battleArt;
 if(!art){
  const ticket=showPreparation(source);
  art=await prepareBattleArt('high');
  if(launchPreparation!==ticket)return;
  closePreparation();
 }
 const replayFrom=source.dataset.action==='same-seed'&&source.dataset.replayFrom?Number(source.dataset.replayFrom):null;
 const {run:draft,next}=freshSortie(profile(),seed,order,actor,requisition,replayFrom,delivery,coastLoadout,fullCampaign,openingGun);
 renderer=createRenderer($('world'),art,combatHud);
 await commitDraft(draft,next,art?'art':'fallback');
}
async function selectCard(id,args={}){const c=run.choices.find(c=>c.id===id);if(!c)return;const details=choiceDetails(run,c);if(details.blocked)return;if(!subpanel)choiceOrigin={scroll:ui.scrollTop,selector:`[data-choice="${CSS.escape(c.id)}"]`};
 if(c.kind==='refit'&&!args.weapon){showRefits(c);return;}
 const ranked=c.kind==='rank'&&run.weapons.find(w=>w.id===c.weapon&&!w.fusion);
 if(ranked&&rankChoiceLevel(ranked,c)===4&&!args.branch){showBranches(c,args);return;}
 if(c.kind==='gun'&&!c.salvageLevel&&args.slot===undefined&&(run.weapons.length>=3||!run.choice.opening&&run.refits>0&&run.weapons.some(w=>w.level>1&&!w.evolved))){showSlots(c);return;}
 if(c.kind==='module'&&!moduleRank(run,c.module)&&run.modules.length>=4&&args.slot===undefined){showSlots(c);return;}
 const before=run.stats.choices.length,hadHeat=heatSynergyReady(run);
 const openingGun=!!((run.choice.opening||run.choice.preempt)&&c.kind==='gun'&&COAST_APPROACHES[c.weapon]);
 unlockSound();
 await mutate(d=>choose(d,id,{...args,doctrine:selectedDoctrine}));
 if(run.stats.choices.length>before&&!pending)equippedFeedback(c,details,openingGun,!hadHeat&&heatSynergyReady(run));
}
ui.addEventListener('change',async e=>{
 if(e.target.name==='doctrine'){selectedDoctrine=e.target.value;return;}
 if(e.target.id==='replay-dispatch'&&subpanel?.type==='replay-briefing'){
  if(busy||pending)return;
  subpanel.dispatch=e.target.value;
  subpanel.options.showDispatch=true;
  refreshReplayBriefing('#replay-dispatch');
  return;
 }
 const key=e.target.dataset.setting;
 if(!key||busy)return;
 const p=profile();p.settings[key]=e.target.checked;
 if(key==='sound'){if(p.settings.sound)audio.unlock();else audio.suspend();}
 setBusy(true);
 try{await store.commit(p);}
 catch(error){
  if(key==='sound'){if(store.settings().sound)audio.unlock();else audio.suspend();}
  notice(error.message);
 }finally{setBusy(false);nextPanelFocus={selector:`[data-setting="${key}"]`};showSettings();}
});
ui.addEventListener('keydown',e=>{const dialog=ui.querySelector('[role="dialog"],[role="alertdialog"]');if(!dialog)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(launchPreparation){closePreparation(true);return;}if(busy||pending)return;if(subpanel?.type==='settings')closeSettings();else if(subpanel?.type==='replay-briefing')closeReplayBriefing();else if(subpanel?.type==='retreat'){if(subpanel.fromHome)showHome();else present(true);}else if(subpanel){nextPanelFocus=choiceOrigin;subpanel=null;present(true);}else if(run?.phase==='choice'&&run.choice.type==='assembly')selectCard('back');else if(mode==='report')closeArchivedReport();else if(run?.phase==='result'){lobbyTab='mission';showHome();}else if(run?.phase==='paused')pauseButton();return;}if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input,select,a[href],summary')].filter(n=>n.getClientRects().length);if(!nodes.length){e.preventDefault();return;}const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first.focus();}}});
ui.addEventListener('pointerdown',e=>{panelPointerButton=e.target.closest('button');},true);
ui.addEventListener('pointercancel',()=>{panelPointerButton=null;},true);
ui.addEventListener('click',async e=>{
 const button=e.target.closest('button'),startedHere=button===panelPointerButton;
 panelPointerButton=null;
 // A stick release can land on a choice that opened during the gesture.
 if(!button||e.isTrusted&&(e.detail>0||e.pointerType)&&!startedHere||busy||pending&&!['retry','reload-latest'].includes(button.dataset.action))return;
 if(launchPreparation){if(button.dataset.action==='cancel-launch')closePreparation(true);return;}
 if(button.dataset.action==='trial-brief'){
  lobbyTab='mission';briefRegion=0;nextPanelFocus={selector:'.command-nav [data-tab="mission"]'};showHome();return;
 }
 if(button.dataset.tab){lobbyTab=button.dataset.tab;nextPanelFocus={selector:`.command-nav [data-tab="${CSS.escape(lobbyTab)}"]`};showHome();return;}
 if(button.dataset.brief!==undefined){briefRegion=Number(button.dataset.brief);nextPanelFocus={selector:`[data-brief="${briefRegion}"]`};showHome();return;}
 const opening=button.dataset.lobbyOpening;
 if(mode==='home'&&(opening==='auto'||isOpeningGun(opening))){
  selectedOpening=isOpeningGun(opening)?opening:null;
  nextPanelFocus={scroll:ui.scrollTop,selector:`[data-lobby-opening="${opening}"]`};showHome();return;
 }
 if(Object.hasOwn(OPERATORS,button.dataset.pilot)){
  selectedOperator=button.dataset.pilot;
  nextPanelFocus={scroll:ui.scrollTop,selector:`[data-pilot="${selectedOperator}"]`};showHome();return;
 }
 if(['standard','turret'].includes(button.dataset.starter)){
  if(button.dataset.starter==='turret'&&!profile().milestones.coastTurret)return;
  selectedStarter=button.dataset.starter;
  nextPanelFocus={scroll:ui.scrollTop,selector:`[data-starter="${selectedStarter}"]`};showHome();return;
 }
 if(button.dataset.order!==undefined){
  const id=button.dataset.order;
  if(id&&!canLaunchOrder(profile(),id))return;
  sortieOrderSelection=id||null;requisitionSelection=null;requisitionAt=null;briefRegion=0;
  nextPanelFocus={scroll:ui.scrollTop,selector:id?`[data-order="${id}"]`:'[data-action="launch"]'};showHome();return;
 }
 if(button.dataset.reserve!==undefined){
  const id=button.dataset.reserve,at=button.dataset.requisitionAt||null;
  if(id&&!canReserveResearch(profile(),id,at))return;
  requisitionSelection=id||null;requisitionAt=at;sortieOrderSelection=null;lobbyTab='mission';briefRegion=id&&!at?1:0;
  nextPanelFocus={selector:'[data-action="launch"]'};showHome();return;
 }
 if(button.dataset.report!==undefined){
  const index=Number(button.dataset.report),r=profile().recent[index];
  if(isReport(r)){reportOrigin={scroll:ui.scrollTop,selector:`[data-report="${index}"]`};mode='report';showResult(r,true);}
  return;
 }
 if(button.dataset.research){
  const fromReport=button.hasAttribute('data-debrief-research');
  if(fromReport&&(mode!=='battle'||run?.phase!=='result'))return;
  const next=buyResearch(profile(),button.dataset.research);
  if(!next)return;
  setBusy(true);
  try{
   await store.commit(next);setBusy(false);
   if(fromReport){nextPanelFocus={selector:'[data-experiment]'};showResult();}
   else{lobbyTab='research';nextPanelFocus={selector:'#trial-dispatch-title'};showHome();}
  }catch(error){notice(error.message);}finally{setBusy(false);}
  return;
 }
 if(button.dataset.choice){await selectCard(button.dataset.choice);return;}
 if(button.dataset.refit){const w=refitWeapons(run).find(w=>w.id===button.dataset.refit);if(w)await selectCard(subpanel.card.id,{weapon:w.id,branch:Object.keys(GUNS[w.id].branches).find(id=>id!==w.branch)});return;}
 if(button.dataset.branch){const {card,args}=subpanel;await selectCard(card.id,{...args,branch:button.dataset.branch});return;}
 if(button.dataset.slot!==undefined){const c=subpanel.card,slot=button.dataset.slot==='empty'?undefined:Number(button.dataset.slot),args={slot};if(c.kind==='gun'&&slot!==undefined){const old=run.weapons[slot],level=gunEquipLevel(run,c,old);if(level>=4){showBranches(c,args);return;}}await selectCard(c.id,{...args,slot:slot===undefined?-1:slot});return;}
 if(button.dataset.exclude){await mutate(d=>banish(d,button.dataset.exclude));return;}
 const a=button.dataset.action;
 if(subpanel?.type==='replay-briefing'&&Number.isSafeInteger(subpanel.options.freshSeed)){
  const {briefRoute,briefStarter,briefOpening}=button.dataset;
  if(briefOpening==='auto'||isOpeningGun(briefOpening)){
   subpanel.options.openingGun=briefOpening==='auto'?null:briefOpening;refreshReplayBriefing(`[data-brief-opening="${briefOpening}"]`);return;
  }
  if(briefRoute==='fresh'||briefRoute==='same'){
   subpanel.options.route=briefRoute;refreshReplayBriefing(`[data-brief-route="${briefRoute}"]`);return;
  }
  if(briefStarter==='standard'||briefStarter==='turret'&&profile().milestones.coastTurret){
   subpanel.options.starter=briefStarter;refreshReplayBriefing(`[data-brief-starter="${briefStarter}"]`);return;
  }
 }
 if(a==='replay-brief'){openReplayBriefing(button);return;}
 if(a==='replay-brief-back'){closeReplayBriefing();return;}
 if(a==='launch'||a==='coast-launch'){await launch(button,subpanel?.type==='replay-briefing'?subpanel.options.freshSeed:undefined);return;}if(a==='same-seed'){const seed=Number(button.dataset.seed);if(Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295)await launch(button,seed);else notice('지난 전장의 코드를 읽지 못했습니다.');return;}if(a==='home'){if(mode==='report'){closeArchivedReport();return;}lobbyTab=button.dataset.target||'mission';briefRegion=null;showHome();return;}if(a==='settings-menu'){showSettings();return;}if(a==='settings-back'){closeSettings();return;}if(a==='last-report'){const report=profile().recent[0];if(!report?.stats||!Array.isArray(report.weapons)||!Array.isArray(report.modules)){notice('전투 보고서를 읽지 못했습니다.');return;}reportOrigin=null;mode='report';showResult(report,true);return;}
 if(a==='end-saved'){run=restore(profile().active.run);showRetreat(true);return;}
 if(a==='retreat'){showRetreat();return;}if(a==='retreat-cancel'){if(subpanel?.fromHome)showHome();else present(true);return;}if(a==='retreat-confirm'){mode='battle';document.body.dataset.scene='battle';await mutate(d=>d.result?true:finish(d,false));return;}
 if(a==='retry'){const {next,draft,launchMode}=pending;pending=null;await commitDraft(draft,next,launchMode);return;}
 if(a==='reload-latest'){location.reload();return;}
 if(a==='gate-challenge'){await callGateChallenge();return;}
 if(a==='choice-back'){nextPanelFocus=choiceOrigin;subpanel=null;present(true);return;}if(a==='raid-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="raid-menu"]'};showRaid();return;}
 if(a==='banish-menu'){choiceOrigin={scroll:ui.scrollTop,selector:'[data-action="banish-menu"]'};subpanel={type:'banish'};const options=banishOptions(run);panel(`<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="banish-title"><span class="eyebrow">BANISH / 이번 판에서 제외</span><h2 id="banish-title">보급 후보 하나를 바꾼다</h2><div class="branch-list">${options.map(c=>`<button data-exclude="${esc(c.id)}">${esc(c.title)}${c.module&&moduleRank(run,c.module)?' · 이 상자만 교체':' · 이번 판 후보 제외'}</button>`).join('')}</div><small>${options.length?'미보유 후보는 이번 판에서 제외합니다. 보유 모듈은 이 상자의 후보만 교체하고 기존 투자를 유지합니다.':'현재 제외할 후보가 없습니다. 첫 두 보급의 새 총 기회는 보호됩니다.'}</small><button data-action="choice-back">돌아가기</button></section>`);return;}
 if(['continue','withdraw','challenge','skip'].includes(a))unlockSound();
 await mutate(d=>{if(a==='continue'){resume(d);return true;}if(a==='reroll')return reroll(d);if(a==='skip')return skip(d);if(['gate-assemble','gate-upgrade','gate-mount','coast-upgrade'].includes(a))return action(d,a);if(a==='withdraw'){const ok=action(d,'withdraw');if(ok)resume(d);return ok;}if(a==='challenge'){resume(d);return action(d,'challenge');}if(a?.startsWith('raid:'))return action(d,a);return false;});
});
async function pauseButton(){if(!run||mode!=='battle'||pending)return;if(busy){if(committingPlay||run.phase==='playing')pauseQueued=true;return;}if(run.phase==='paused')unlockSound();await mutate(d=>{if(d.phase==='paused')resume(d);else pause(d);return true;});}
async function callGateChallenge(){unlockSound();await mutate(d=>action(d,'gate-challenge'));}
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
 if(k==='r'&&run.phase==='choice'&&run.choice.type==='coast-boss'&&!subpanel){e.preventDefault();mutate(d=>action(d,'coast-upgrade'));return;}
 if(k==='q'&&!subpanel&&canCallGateChallenge(run)){e.preventDefault();callGateChallenge();return;}
 if(run.phase!=='playing')return;if(k===' ')e.preventDefault();const a=({' ':'dash',e:'skill',f:'interact',g:'gear',r:'upgrade',q:'challenge'})[k];if(a||moving)unlockSound();if(a)mutate(d=>action(d,a,a==='skill'?movementInput():undefined));
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function pauseWhenAway(){
 if(mode!=='battle'||!run||pending)return;
 if(busy){if(committingPlay)pauseQueued=true;return;}
 if(run.phase==='playing')pauseButton();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.suspend();pauseWhenAway();}});
window.addEventListener('blur',()=>{keys.clear();controls?.reset();pauseWhenAway();});
function updateMap(lead,entry,gantry,dispatch,reserved,aid,otherCoast,conduit,opening,response,rail,gateInk){
 const warnings=run.hazards.filter(h=>!h.hit);
 const railLocked=rail?.locked;
 const railBait=rail?.bait;
 const railGuns=rail?run.boss.parts.map(part=>part.hp>0):null;
 const activeFire=warnings.filter(h=>h.lane||h.portRound||h.signalCut||h.portBattery||h.conduitGun||h.coastMortar==='coast-response').map(h=>`${h.portRound||h.conduitGun||h.coastMortar||(h.signalCut?'cut':h.portBattery?'battery':'lane')}:${h.x}:${h.y}`).join();
 const key=`${run.seed}:${Math.floor(run.t*5)}:${run.stage}:${run.boss.active?run.boss.mode:''}:${run.operation?.region}:${run.operation?.order}:${run.raid?.state}:${run.challenge?.state}:${!!run.challenge?.secured}:${lead?.id}:${otherCoast?.id}:${!!dispatch}:${!!reserved}:${!!entry}:${!!gantry}:${aid?.state}:${railLocked}:${railGuns?.join()}:${rail?.pad?.state}:${!!rail?.slot}:${activeFire}:${!!conduit?.gun}:${!!conduit?.clear}:${!!opening}:${response?.target.id}:${run.sites.map(n=>n.state).join()}:${gateInk||''}`;if(key===mapStamp)return;mapStamp=key;
 const dot=(cls,x,y,r,color,label='')=>`<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"${label?` aria-label="${esc(label)}"`:''}/>`;
 const railLane=(h,forecast=false)=>{
  const {left,top,width,height}=railLaneBounds(h);
  const bait=h===railBait;
  const paint=forecast?`fill="none" stroke="${bait?'#f0cf9c':'#a8dec9'}" stroke-dasharray="24 18" aria-label="${bait?'유인으로 고정한 포격선':'조준 예상선'}"`
   :`fill="${h.tracked?'#ef9a6799':'#ee975e66'}" stroke="#ffda99"`;
  return `<rect class="${forecast?'map-forecast-lane':'map-danger-lane'}" x="${left}" y="${top}" width="${width}" height="${height}" ${paint} stroke-width="8"><title>${railLaneLabel(h,bait)}</title></rect>`;
 };
 let map=terrainSvg(run.operation?.region||0,run.seed)+entryRouteSvg(entry||opening)+(rail?.forecast||[]).map(h=>railLane(h,true)).join('')
  +warnings.map(h=>h.lane?railLane(h):dot('map-danger',h.x,h.y,h.portRound||h.signalCut||h.portBattery||h.conduitGun||h.coastMortar==='coast-response'?blastContactRadius(h):h.r,h.portRound==='rake'?'#f99354bb':h.portRound==='turret'?'#f9bf83b0':'#f77e778c',h.signalCut?'차량 진로 포격':h.portBattery||h.conduitGun||h.coastMortar==='coast-response'?'박격포 탄착 범위':h.portRound==='lock'?'집중 포격 조준점':h.portRound==='rake'?'측면 장갑 가로 포격':h.portRound==='battery'?'측면 장갑 세로 포격':h.portRound==='turret'?'포탑 측면 포격':'')).join('');
 map+=run.blocks.filter(b=>b.hp!==0).map(b=>`<rect class="map-block" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#71837e"/>`).join('');
 map+=run.gems.map(g=>dot('map-xp',g.x,g.y,g.salvage?14:9,g.salvage?'#f5d487':'#a5ddcc')).join('');
 const target=coastRoleTarget(run)||coastSalvageWreck(run);
 if(target)map+=dot('map-coast-role',target.x,target.y,37,'#f5d487',target.name||'포탑 노획 지점');
 map+=run.enemies.filter(e=>!e.dead).map(e=>dot('map-enemy',e.x,e.y,e.cohort==='challenge'?24:e.type==='officer'?19:13,e.cohort==='challenge'?'#efb6ff':e.type==='officer'?'#f7b58d':'#d28257')).join('');
 if(response)map+=dot('map-coast-response',response.target.x,response.target.y,26,'#f4a275',response.name);
 if(conduit?.gun){const {gun,clear}=conduit;map+=dot('map-conduit-gun',gun.x,gun.y,34,clear?'#a4e3e3':'#ffcf9a',clear?'도약 목표 · 박격포':'포격 중인 박격포');}
 map+=run.sites.filter(n=>n.state!=='done').map(n=>dot('map-site',n.x,n.y,n.state==='ready'?36:25,n.kind==='armory'?'#c5a8f5':'#ffe0a1',`${n.name} · ${n.state==='ready'?'회수 가능':n.state==='active'?n.kind==='relay'?`해킹 ${Math.round(n.progress/5*100)}%`:'경비 교전':'미확보'}`)).join('');
 map+=run.sites.filter(n=>n.state!=='done').map(n=>siteSymbol(n,n.x,n.y,22)).join('');
 if(lead){const {x,y}=lead;map+=`<path d="M${x} ${y-51}l51 51 -51 51 -51 -51Z" fill="none" stroke="${coastLeadColor(lead)}" stroke-width="14" aria-label="${esc(sitePresentation(lead).name)} · 다음 표적"/>`;}
 if(otherCoast){const {x,y}=otherCoast;map+=`<circle cx="${x}" cy="${y}" r="51" fill="none" stroke="${coastLeadColor(otherCoast)}" stroke-width="10" stroke-dasharray="15 12" aria-label="${esc(sitePresentation(otherCoast).name)} · 선택 경로"/>`;}
 if(dispatch)map+=orderPinSvg(dispatch,run.operation.order);
 if(reserved)map+=`<circle cx="${reserved.x}" cy="${reserved.y}" r="56" fill="none" stroke="#b6e1c5" stroke-width="12" aria-label="예약 장비 · ${esc(sitePresentation(reserved).name)}"/>`;
 if(run.stage==='field'){
  const point=coastStagingPoint(run)||BOSS_ENTRY,part=portPartStaging(run);
  map+=dot('map-boss-entry',point.x,point.y,34,point.color||'#ef8e64',point.name||'보스 진입');
  if(part)map+=dot('map-boss-entry',part.x,part.y,32,part.color,`${part.name} · ${part.sign}`);
 }
 const boss=run.boss;
 if(railGuns){
  map+=`<g class="map-boss map-train" transform="translate(${boss.x} ${boss.y})" aria-label="포격 열차">
   <rect x="-152" y="-42" width="304" height="84" rx="15" fill="#21302b" stroke="#d0a786" stroke-width="13"/>
   ${boss.parts.map((part,i)=>`<rect x="${part.ox-38}" y="-23" width="76" height="46" fill="${railGuns[i]?RAIL_GUN_COLORS[i]:'#52615b'}"><title>${railGunLabel(i)} · ${railGuns[i]?'가동':'파괴'}</title></rect>`).join('')}
  </g>`;
 }else if(boss.active){
  map+=dot('map-boss',boss.x,boss.y,50,'#ef8e64',run.operation?region(run).boss:'장갑 수송차')+`<line class="map-boss-facing" x1="${boss.x}" y1="${boss.y}" x2="${boss.x+Math.cos(boss.body)*120}" y2="${boss.y+Math.sin(boss.body)*120}" stroke="#ef8e64" stroke-width="16"/>`;
 }
 if(railBait)map+=`<path class="map-rail-bait" transform="translate(${railBait.x} ${railBait.y})" d="M0 -48 48 0 0 48 -48 0Z" fill="#f3cd90" stroke="#372a22" stroke-width="15" aria-label="포격 유인 차선"/>`;
 const fanLane=rail?.pad;
 if(fanLane){
  const {x,y,edges,inPosition}=fanLane;
  map+=`<g data-map-fan-pad aria-label="노획 포탑 사격 위치">${edges.map((edge,i)=>`<path d="M${x} ${y}L${edge.x} ${edge.y}" stroke="${RAIL_GUN_COLORS[i]}" stroke-width="9" stroke-dasharray="16 13"/>`).join('')}<rect x="${x-30}" y="${y-26}" width="60" height="52" fill="${inPosition?'#f4d18e':'#263732'}" stroke="#f4d18e" stroke-width="11"/></g>`;
 }
 if(rail?.slot)map+=dot('map-rail-escape',rail.slot.x,rail.slot.y,23,'#c8eee3','포격 회피 위치');
 const crossfire=portCrossfireZone(run);
 if(crossfire&&!portCrossfireCuts(run,boss.mode==='salvo'?boss.cycle:boss.cycle+1)){
  const {x,y,halfWidth,halfDepth}=crossfire;
  map+=`<rect x="${x-halfWidth}" y="${y-halfDepth}" width="${2*halfWidth}" height="${2*halfDepth}" fill="#f2cb8f40" stroke="#f2cb8f" stroke-width="8" aria-label="노획 포탑 사격 위치"/>`;
 }
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
  if(portCoreWindow(run))map+=`<circle cx="${boss.x}" cy="${boss.y}" r="${portCoreReach(run)}" fill="none" stroke="#ffd0a1" stroke-width="12" stroke-dasharray="24 20" aria-label="회피로 넘을 코어 경계"/>`;
  if(aid?.preview)map+=`<circle cx="${aid.point.x}" cy="${aid.point.y}" r="42" fill="none" stroke="#d7f0b8" stroke-width="9" stroke-dasharray="14 10" aria-label="다음 구급 화물 투하 지점"/>`;
  else if(aid)map+=dot('map-crate',aid.point.x,aid.point.y,42,aid.state==='blocked'?'#ffae86':'#d7f0b8',aid.state==='blocked'?'포격 중인 구급 화물':'구급 화물');
 }
 if(gantry){
  map+=entryRouteSvg({routes:[gantry]});
  map+=`<path class="map-gantry" d="M${gantry.x-31} ${gantry.y+22}v-45h62v45m-47-9 16-14 16 14" fill="none" stroke="${gantry.color}" stroke-width="10" aria-label="측면 해치 · 보스 입구"/>`;
 }
 const gate=exitGate(run);if(gate)map+=gateSymbol(gate,gateInk);
 if(run.raid?.state==='active'){
  const {contract,target}=run.raid;
  map+=raidRouteSvg(raidAhead(run.raid),contract)+dot('map-courier',target.x,target.y,34,RAID_MARKS[contract].color,RAID_MARKS[contract].name);
 }
 if(run.challenge?.state==='active'&&run.challenge.type==='defend'&&!run.challenge.secured){
  const {x,y,r}=DEFENSE_ZONE;
  map+=`<circle class="map-defense" cx="${x}" cy="${y}" r="${r}" fill="#b6cba638" stroke="#dcebc4" stroke-width="12" aria-label="중계기 송신 범위"/>`;
  const round=relayDefenseRound(run);
  if(round)map+=`<circle cx="${round.x}" cy="${round.y}" r="${blastContactRadius(round)}" fill="#e87555a0" stroke="#ffc097" stroke-width="9" aria-label="포격으로 송신이 끊기는 범위"/>`;
 }
 const signal=signalCourier(run);
 const cargo=signalCargo(run);
 if(signal)map+=escapeRouteSvg(signalRoute(run),'data-signal-route',SIGNAL_COLOR,'통신 차량')+dot('map-signal',signal.x,signal.y,34,SIGNAL_COLOR,'탈출 차량');
 else if(cargo)map+=`<circle class="map-cargo" cx="${cargo.x}" cy="${cargo.y}" r="${SIGNAL_CARGO_REACH}" fill="#edce8e30" stroke="#f4d894" stroke-width="8" aria-label="통신 화물 회수 범위"/>`+dot('map-signal-cargo',cargo.x,cargo.y,30,'#f4d894','정지 차량 · 통신 화물');
 else if(gate&&run.operation?.region===2){
  const battery=holdoutContract(run).id==='battery';
  const active=run.challenge?.state==='active';
  if(battery){
   const points=active?portBatteries(run):portBatteryPositions(run.seed);
   map+=points.map(point=>`<circle class="map-battery" cx="${point.x}" cy="${point.y}" r="45" fill="${active?'#ffc98c88':'none'}" stroke="#ffcf9a" stroke-width="12" aria-label="${portBatterySide(point)} 박격포 진지"/>`).join('');
  }else{
   map+=`<g opacity=".65">${escapeRouteSvg(signalRoute(run),'data-signal-route',SIGNAL_COLOR,'잔류 시 통신 차량')}</g>`;
   if(!run.operation.challengeTier&&!run.challenge?.recoverCargo)map+=signalEscortPlan(signalLane(run.seed)).map(e=>dot('map-signal-escort',e.x,e.y,19,'#f2a877',e.type==='mortar'?'차량 호위 박격포':'차량 호위 경비')).join('');
  }
 }
 map+=dot('map-player',run.player.x,run.player.y,30,'#fff7d9',operatorOf(run).name);$('tactical-map').innerHTML=map;
}
const workshopForecasts=new WeakMap();
let railForkMarkup='';
function fieldEntry(s){
 const entry=activeEntry(s),inferno=entry&&infernoControlRank(s);
 if(s.operation?.region===2&&entry){
  const keys=portTacticKeys(s),key=keys.includes('crossfire')?'crossfire':keys.find(id=>['lens','wake','ember'].includes(id));
  const signal=keys.includes('signal')&&portConductiveSignal(s);
  const part=s.operation.support;
  const routes=entry.routes.map(route=>{
   if(route.site==='port-control'&&inferno)return {...route,sign:'관제소 · F L6 또는 보스 전술'};
   if(route.site==='port-control'&&key)return {...route,sign:`관제소 · ${FRONT_TACTICS[2][key].name}`};
   if(route.site==='port-control'&&signal)return {...route,sign:'관제소 · 측면 교신 역송',color:'#9cdde1',recommended:true};
   if(route.site==='port-landing'&&part==='breach'&&s.sites.find(site=>site.id===route.site)?.gantry)
    return {...route,sign:`${portSideName(portTurretSide(s.boss))} 포탑 · 측면 해치`};
   return route;
  });
  return {...entry,routes};
 }
 if(s.operation?.region!==1||!entry)return entry;
 const relayRank=infernoControlRank(s);
 const relay=entry.routes.some(route=>route.site==='rail-relay')?railRelayInvestment(s):null;
 const salvageRoutes=carriesCoastSalvage(s)&&requisitionSite(s)?.id!=='rail-cache',fan=salvageRoutes&&s.weapons.find(isCapturedTurret);
 const rocket=salvageRoutes&&!fan&&s.weapons.some(w=>w.id==='r'),fusion=salvageRoutes&&!fan&&s.weapons.some(w=>w.fusion);
 const ammo=entry.routes.some(route=>route.site==='rail-ammo')?railAmmoInvestment(s):null;
 const ammoMaterial=ammo&&(ammo.kind==='rank'?'F L6':'촉매 연료 +1');
 const workshopOpen=entry.routes.some(route=>route.site==='rail-cache');
 const routes=entry.routes.map(route=>{
  if(route.site==='rail-ammo'&&ammoMaterial){
   return {...route,sign:`탄약고 · ${ammoMaterial}`,summary:ammoMaterial,tactical:ammoMaterial,supplyHint:route.warning,
    build:{supply:ammoMaterial},recommended:!workshopOpen||ammo.kind==='rank'&&moduleRank(s,'catalyst')>=2};
  }
  if(route.site!=='rail-relay')return route;
  const rank=relay?.material?`중계기 · ${relay.material}`:relayRank&&`중계기 · 유인 + F L${relayRank} 후보`;
  return {...route,...(rank?{supplyHint:rank}:null),...(salvageRoutes?{color:RAIL_SALVAGE_ROUTES['rail-relay'].color,recommended:!!(relay?.turret||!fan&&(rocket||fusion||rank)),tactical:relay?.turret?'격발망 재료 · 포탑 분해 준비':rocket?'후방 박격포 → 조준 유인':fusion?'박격포 제압 → 열차 전술':'확보하면 열차 조준 유인'}:null),
   sign:rank||(rocket?'중계기 · 로켓 사선':salvageRoutes?'중계기 · 후방 박격포':'중계기 · 조준 유인'),
   summary:rank||(rocket?'중계기 · 로켓 원거리 공략':salvageRoutes?'중계기 · 원거리 박격포':'중계기 · 조준 유인 1회')};
 });
 if(!workshopOpen)return {...entry,routes};
 // Upgrade choices replace the live run, and the field tick doesn't change the loadout.
 let plan=workshopForecasts.get(s);
 if(!plan){plan=railWorkshopPlan(s);workshopForecasts.set(s,plan);}
 const {cards,finish}=plan,reserved=cards.find(c=>c.id.startsWith('requisition:'));
 const infernoPlan=railInfernoPlan(s,plan);
 const fireRoute=infernoPlan?.action==='workshop'&&!reserved&&!fan?infernoPlan:null;
 const calibration=cards.find(c=>c.kind==='calibrate');
 const rebuild=cards.find(c=>c.railDonor),stock=cards.find(c=>c.kind==='module'&&c!==reserved);
 const investment=finish?.card||cards.find(c=>c.kind==='rank')||cards.find(c=>c.kind==='module');
 const ranked=investment?.kind==='rank'?s.weapons.find(w=>w.id===investment.weapon&&!w.fusion):null;
 const material=ranked?`${investment.railDonor?'F 분해 → ':''}${isCapturedTurret(ranked)?'포탑':GUNS[ranked.id].short} L${rankChoiceLevel(ranked,investment)}`
  :investment?.kind==='module'?`${MODULES[investment.module].name} +1`:'';
 const target=finish?.recipe.title;
 let sign='정비대 · 응급 보급',summary='정비대 · 체력·충전 회복',note='응급 보급으로 체력과 충전을 회복합니다.';
 if(finish){
  sign='정비대 · 조립 재료';
  summary=`정비대 · ${material} → ${target}`;
  const condition=[ranked&&rankChoiceLevel(ranked,investment)===4?'분화 선택':'',finish.needsPermit?'조율권 필요':''].filter(Boolean).join(' · ')||'조립 가능';
  note=`${material} → ${target} · ${condition}`;
  if(stock&&stock.id!==finish.card.id){
   const other=MODULES[stock.module].name;
   summary+=` / ${other}`;
   note+=`\n${other} 보급 가능`;
  }
 }else if(calibration){
  const w=s.weapons.find(gun=>gun.uid===calibration.uid),change=railCalibration(s,w);
  const title=capstoneName(w);
  const branch=GUNS[change.gun].branches[change.to][0];
  sign='정비대 · 병기 개장';
  summary=`정비대 · ${branch} 개장`;
  note=`${title} · ${branch} 전환`;
 }else if(investment){
  const stockLabel=stock&&stock!==investment?MODULES[stock.module].name:'';
  const options=[material,stockLabel].filter(Boolean).join(' · ');
  sign='정비대 · 무장 강화';summary=`정비대 · ${options}`;note=`${options} · 응급 보급`;
 }
 if(rebuild&&finish?.card.id!==rebuild.id){
  const strip=`F 분해 → ${GUNS[rebuild.weapon].short} L${rebuild.railLevel}`;
  if(!finish){sign='정비대 · 보조 무장 분해';summary=`정비대 · ${strip}${stock?` / ${MODULES[stock.module].name}`:''}`;}
  note+=`\n${strip}`;
 }
 if(reserved){
  sign='정비대 · 예약품';
  summary=`정비대 · 예약 ${reserved.title}`;
  note=finish?`예약품 또는 ${target} 재료`:compatible(s,reserved.module)?`예약 ${reserved.title} 장착`:`예약 ${reserved.title} · 장착 후 대기`;
 }
 if(salvageRoutes&&!finish&&!fireRoute){
  sign=fan?'정비대 · 부채꼴 사선':'정비대 · 갈라진 보병';
  summary=fan?'정비대 · 부채꼴 포탑 사선':'정비대 · 양쪽 보병';
 }
 if(fireRoute){
  sign=`정비대 · ${fireRoute.supply}`;
  summary=fireRoute.supply;
  note=`${fireRoute.supply} · ${fireRoute.missing}`;
 }
 return {...entry,routes:routes.map(route=>route.site==='rail-cache'?{...route,sign,summary,note,
  ...(salvageRoutes?{color:RAIL_SALVAGE_ROUTES['rail-cache'].color,recommended:!!(fan||(finish||fireRoute)&&!rocket&&!fusion),tactical:fan?RAIL_SALVAGE_ROUTES['rail-cache'].fight:fireRoute?.supply}:null),
  ...(fan?{fanCount:weaponStats(fan).count,...(material?{supplyHint:finish?`${material} → ${target}`:`정비대 · ${material}`}:null)}:null),
  ...(fireRoute?{supplyHint:fireRoute.missing,build:fireRoute}:null)}:route)};
}
function railForkRows(routes,pilot){
 return routes.map(route=>{
  const name=route.site==='rail-cache'?'화차 정비대':route.site==='rail-relay'?'통신 중계기':'포대 탄약고';
  const direction=bearing(pilot,...entryWaypoint(route.path,pilot));
  const payoff=(route.supplyHint||route.summary||'').replace(/^(정비대|중계기) · /,'');
  const tip=route.tactical||payoff||'경비 제압 후 보급';
  const marker=route.fanCount?`<small class="rail-route-weapon">${itemArt('turret')} ${route.fanCount}발</small>`:route.recommended?'<small>추천</small>':'';
  return `<span class="rail-route-row" data-rail-route="${route.site}"${route.recommended?' data-recommended':''} style="--route-ink:${route.color}"><span class="rail-route-arrow">${direction}</span><span><b>${name}${marker}</b><span>${esc(tip)}</span>${route.supplyHint&&route.tactical?`<small>${esc(payoff)}</small>`:''}</span></span>`;
 }).join('');
}
function updateHud(entry,focus=null,coast={},rail=null,handoff=null,gateInk){
 const battle=mode==='battle'&&renderer&&run;$('hud').hidden=!battle;$('hud').inert=!!battle&&run.phase!=='playing';$('controls').hidden=!battle||run.phase!=='playing'||!!pending;if(!battle){$('field-feedback').hidden=true;return;}
 const {primary:primaryCoast,fork,lead:coastSite,opening}=coast;
 const p=run.player,actor=operatorOf(run),gantry=portGantry(run),dispatch=orderTarget(run),reserved=requisitionSite(run),order=sortieOrder(run.operation?.order);
 const salvage=coastSalvage(run),roleTarget=coastRoleTarget(run);
 document.body.classList.toggle('coast-salvage-run',!!salvage);
 const aid=portAidCue(run),conduit=run.stage==='field'?conduitMortarCue(run):null;
 const preempt=coastPreemptSite(run),rescue=preempt&&run.sites[0],response=coastResponseCue(run);
 const openingAlternate=preempt&&(coastSite===preempt?rescue:preempt);
 updateMap(coastSite,entry,gantry,dispatch,reserved,aid,fork?.other||openingAlternate,conduit,opening,response,rail,gateInk);$('map-panel').querySelector('span').textContent=`${region(run).name} · 작전도`;
 const firstFire=run.operation?.region===0&&run.stage==='field'&&run.t<(run.openingFireUntil||0);
 document.body.classList.toggle('rescue-approach',!!(coastSite?.opening&&coastSite.state==='waiting'&&!run.firstNew
  &&run.t<4&&p.hp===p.maxHp&&!run.pendingLevels&&!run.enemies.some(e=>!e.dead&&distance(e,p)<155)));
 document.body.classList.toggle('coast-insertion',!!opening||firstFire);
 document.body.classList.toggle('coast-lead',!!coastSite);
 document.body.classList.toggle('coast-contact',!!coastSite?.coastApproach&&coastSite.state==='active');
 document.body.classList.toggle('coast-warning',run.operation?.region===0&&run.hazards.some(h=>h.coastMortar&&!h.hit));
 $('operator-name').textContent=actor.short;$('level').textContent=`LV.${run.level}`;$('hp').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;document.body.classList.toggle('low-hp',p.hp/p.maxHp<.3);$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('charge').textContent=p.overdrive>0?`전탄 보급 ${p.overdrive.toFixed(1)}초`:`${actor.meter} ${Math.floor(p.charge)}%`;
 $('kills').textContent=`${run.stats.kills} K.O.`;$('score').textContent=`${run.stats.score.toLocaleString()}점 · 확보 ${operationCredits({operation:run.operation,stats:run.stats,won:false})}C`;$('time').textContent=fmt(run.t);$('xp-fill').style.width=`${run.xp/xpNeeded(run)*100}%`;
 const front=run.operation?.region;
 const localSite=run.stage!=='boss'?run.sites.filter(n=>['active','ready'].includes(n.state)
  &&distance(n,p)<Math.max(260,front===1&&n.state==='active'?railGarrison(n)?.range||0:0)).sort((a,b)=>distance(a,p)-distance(b,p))[0]:null;
 const railPickup=carriesCoastSalvage(run)&&localSite?.state==='ready';
 document.body.classList.toggle('rail-contact',front===1&&(localSite?.state==='active'||railPickup));
 const gate=exitGate(run),holdout=!!(gate&&run.operation),interact=interaction(run);
 const nearGate=holdout&&interact?.id==='extract'&&run.challenge?.state!=='active';
 const shoreTransfer=nearGate&&handoff?.gateNote?handoff:null;
 document.body.classList.toggle('gate-near',nearGate);
 document.body.classList.toggle('shore-transfer',!!shoreTransfer);
 document.body.classList.toggle('gantry-near',!!interact?.gantry);
 const bossName=run.operation?region(run).boss:'장갑 수송차';
 const staging=coastStagingPoint(run),partStaging=portPartStaging(run);
 const bossPoint=run.boss.active?run.boss:staging||partStaging||BOSS_ENTRY;
 const bossTarget={name:entry?.direct?.name||bossName,x:bossPoint.x,y:bossPoint.y,path:entry?.direct?.path};
 const tactic=frontTactic(run);
 const orderSite=run.stage==='field'&&front>0&&!tactic
  ?run.sites.find(n=>['rail-relay','port-control'].includes(n.id)&&n.state!=='done'):null;
 const entrance=interact?.id==='boss'&&!interact.blocked?(interact.gantry||bossTarget):null;
 const workshopRoute=entry?.routes.find(route=>route.site==='rail-cache');
 const workshopSite=workshopRoute?.build&&run.sites.find(site=>site.id===workshopRoute.site);
 const ammoRoute=entry?.routes.find(route=>route.site==='rail-ammo'&&route.build);
 const ammoSite=ammoRoute&&run.sites.find(site=>site.id===ammoRoute.site);
 const tuneInferno=front===1&&railInfernoPlan(run);
 const seekingInferno=workshopSite||ammoSite||front===1&&run.firstNew==='f'&&workshopRoute&&infernoControlRank(run);
 const focusBoss=run.boss.active||entrance||run.stats.completedBuild&&!seekingInferno&&!localSite&&!orderSite&&!reserved;
 const raid=run.raid?.state==='active'?run.raid:null;
 const convoy=raid&&{name:RAID_MARKS[raid.contract].name,x:raid.target.x,y:raid.target.y};
 const prepared=run.stage==='field'&&claimedCoastLead(run),coastPlan=coastStrike(run),coastArmed=coastPlan&&coastStrikeArmed(run);
 const crossDone=primaryCoast?.coastApproach&&primaryCoast.coastApproach===run.firstNew&&run.sites.some(site=>
  site.coastApproach&&site.coastApproach!==run.firstNew&&site.state==='done'&&coastStrikeArmed(run,site.coastApproach));
 const partGap=partStaging?distance(p,partStaging):Infinity;
 const nearPart=partGap<145&&(!localSite||partGap<distance(p,localSite));
 const next=convoy||gate||(front>0||run.stats.coastPreempt?entrance:null)||(nearPart?bossTarget:null)||(coastSite?.opening?coastSite:dispatch||coastSite)||(prepared&&coastArmed?bossTarget:null)||localSite||reserved||gantry||(focusBoss||prepared&&fork?bossTarget:workshopSite||ammoSite||orderSite||run.sites.filter(n=>n.state!=='done').sort((a,b)=>distance(a,p)-distance(b,p))[0]||bossTarget);
 const choosingEntry=entry?.routes.length&&!raid&&!localSite&&!focusBoss&&!gantry;
 const railFork=front===1&&choosingEntry;
 document.body.classList.toggle('rail-fork',front===1&&!!choosingEntry);
 document.body.classList.toggle('harbor-fork',front===2&&(!!choosingEntry||!!partStaging&&next===bossTarget));
 const trackedRoute=next.path?next:(entry||opening)?.routes.find(route=>route.site===next.id);
 const waypoint=trackedRoute&&entryWaypoint(trackedRoute.path,p);
 const direction=bearing(p,...(waypoint||[next.x,next.y]));
 const track=$('operation-track'),trackKey=run.operation?`${run.runId}:${front}`:'';
 if(track.dataset.front!==trackKey){
  track.dataset.front=trackKey;
  track.innerHTML=run.operation?REGIONS.slice(0,sortieFrontCount(run)).map((d,i)=>
   `<span class="track-stop"${i===front?' aria-current="step"':i<front?' data-cleared':''}><i aria-hidden="true"></i>${d.name}</span>`).join(''):'';
 }
 $('stage').textContent=run.operation?`${run.operation.region+1}/${sortieFrontCount(run)} ${region(run).name}${run.stage==='holdout'?' · 돌파 완료':run.stage==='boss'?' · 보스 교전':''}`:run.powerWave&&run.stage==='field'?'POWER TEST / 완성 화력 전개':run.stage==='holdout'?'MISSION CLEAR / 잔류 가능':run.stage==='boss'?'ARMORED CARRIER':'BEACHHEAD / 해안 침투';
 const wave=run.powerWave,forming=wave?.paired>0&&wave.showcase;
 const showcase=forming||run.enemies.findLast(e=>e.showcase&&!e.dead&&e.hp>0)?.showcase;
 const capstoneField=run.stage==='field'&&!!showcase;
 document.body.classList.toggle('capstone-approach',capstoneField);
 const showcaseGun=showcase&&run.weapons.find(w=>w.evolved&&(showcase==='fusion'?w.fusion:!w.fusion&&w.id===(showcase==='flame'?'f':'r')));
 let contact=null,contactGap=Infinity;
 if(showcase&&run.stage==='field')for(const e of run.enemies){
  if(e.showcase!==showcase||e.dead||e.type==='mortar')continue;
  const gap=distance(p,e);
  if(gap<contactGap){contact=e;contactGap=gap;}
 }
 const focusedFormation=front===2&&isFocusedInferno(showcaseGun);
 const formation=focusedFormation?'횡대 보병':showcase==='flame'?'밀집 보병':showcase==='rocket'&&isCapturedTurret(showcaseGun)?'갈라진 대열':'분산 편대';
 const formationMove=!showcaseGun?'':showcase==='flame'?(isFocusedInferno(showcaseGun)?'중거리에서 멈춰 분사':'잔불로 유인')
  :isConductiveFusion(showcaseGun)?'앞 대열부터 연쇄':showcaseGun.fusion?'적을 모아 유폭':isCapturedTurret(showcaseGun)?'중거리 양쪽 사격':'대열마다 일제사격';
 const showcaseHint=contact?`${bearing(p,contact.x,contact.y)} ${formation} · ${Math.round(contactGap/10)}m`
  :`${formation} 접근`;
 const incoming=capstoneField?`${showcaseHint}${front===2&&formationMove?` · ${formationMove}`:''}`:'';
 const reserve=wave&&run.stage==='field'?` · 증원 ${wave.remaining}명 남음`:'';
 const objectiveName=next===preempt&&run.operation?.openingGun?`${GUNS[preempt.coastApproach].short} 기습 · ${sitePresentation(preempt).name}`:next.opening&&run.stats.coastPreempt?'포로 구출 · 선택':next.kind?sitePresentation(next).name:next.name;
 const railCargo=railFork&&salvage?.turret==='secured'&&!run.weapons.some(isCapturedTurret);
 const railTurret=railFork&&run.weapons.find(isCapturedTurret);
 const railRocket=railFork&&!railTurret&&run.weapons.find(w=>w.id==='r');
 const fan=trackedRoute?.fan,fanGap=fan?distance(p,fan):Infinity;
 const detour=next===preempt&&trackedRoute?.recommended&&waypoint!==trackedRoute.path.at(-1);
 const goalRange=detour?Math.hypot(p.x-waypoint[0],p.y-waypoint[1]):distance(p,next);
 $('objective').textContent=fan?(fanGap<34?'포탑 사격 위치 · 양쪽 대열':`${bearing(p,fan.x,fan.y)} 포탑 사격 위치 · ${Math.ceil(fanGap/10)}m`)
  :choosingEntry?(front===1?(railTurret?`포탑 L${railTurret.level} · 부채꼴 ${weaponStats(railTurret).count}발`:railCargo?'포탑 운반 중':railRocket?`로켓 R L${railRocket.level} · 철도 경로`:'철도 진입 경로')
  :front===2&&showcaseGun?`항구 · ${capstoneName(showcaseGun)}`:entry.routes.length===1?'남은 선택 경로':'하역장 갈림길'):`${direction} ${detour?`${GUNS[preempt.coastApproach].short} 기습 · 우회 지점`:objectiveName} · ${Math.round(goalRange/10)}m`;
 const guards=next.state==='active'?run.enemies.filter(e=>!e.dead&&e.siteId===next.id).length:0;
 const garrison=railGarrison(next)||wireGarrison(run,next),crew=next.state==='active'&&next.kind==='relay'?relayCrewLeft(run,next):0;
 const hacking=crew?`${garrison.crew} ${crew}${garrison.unit} 제압 후 해킹`:`범위 안에서 해킹 ${Math.round(next.progress/5*100)}%`;
 const coastFight=next===coastSite&&!!coastSite?.coastApproach;
 const siteHint=coastFight?'':next.state==='active'?next.kind==='relay'?` · ${hacking}`:` · 경비 ${guards}명, 이동하며 제압`:next.state==='ready'?next.kind==='relay'?' · 해킹 완료, 접근해 회수':' · 제압 완료, 접근해 회수':'';
 const cut=run.effects.some(f=>f.conduitCut&&f.type==='barrage-cancel');
 const mortarTime=conduit&&(Math.ceil(conduit.round.timer*10)/10).toFixed(1);
 const threat=$('threat');
 const formationTone=capstoneField&&!conduit&&!cut&&!response?showcase:'';
 if(threat.dataset.formation!==formationTone)threat.dataset.formation=formationTone;
 const pressure=run.pressure>0?`경계 ${run.pressure}`:'';
 threat.textContent=conduit?`박격포 ${mortarTime}초 · ${conduit.safe?'탄착원 밖':'원 밖으로 회피'}`:cut?'전도 도약 · 포격 차단':response?`${response.name} · ${response.count}명`:incoming||
  `${pressure}${siteHint}${run.challenge?` · 도전${run.challenge.tier||1} ${run.challenge.state==='complete'?'완료':'진행'}`:''}${reserve}`.replace(/^ · /,'');
 const fieldIntel=$('field-intel'),direct=$('field-direct');
 const armory=prepared&&next===bossTarget?run.sites.find(site=>site.kind==='armory'&&site.state!=='done'):null;
 const coastDelivery=front===0&&reserved&&next!==reserved&&!primaryCoast?.opening?reserved:null;
 const alternateCoast=fork?.other||coastDelivery||openingAlternate;
 const alternate=alternateCoast||armory||(gantry&&next===bossTarget?gantry:bossTarget);
 const wireReady=railHasWire(run)&&!railHasRelay(run);
 const part=front===2?run.operation.support:null;
 const coastReward=site=>{
  if(site===reserved)return `${RESEARCH[run.operation.requisition].name} 예약`;
  const cross=coastCrossGun(run,site);
  if(cross)return `${cross.toUpperCase()} L${COAST_SALVAGE_LEVEL} 노획${coastTacticalLootAvailable(run,site)?' · 수송차 전술':''}`;
  const plan=coastStrikeForSite(run,site);
  if(plan&&site.coastApproach!==run.firstNew)return plan.name;
  const {module}=coastApproach(site);
  const available=module!==run.operation?.requisition&&!run.excluded.includes(module)&&compatible(run,module)&&moduleRank(run,module)<3;
  const service=coastService(run,site);
  const rewards=[service&&`${isCapturedTurret(service.weapon)?'포탑':GUNS[service.weapon.id].short} L${service.level} 정비`,available&&`${MODULES[module].name} 후보`];
  return rewards.filter(Boolean).join(' · ')||'현장 보급';
 };
 const alternateLabel=preempt&&alternate===preempt?`${sitePresentation(preempt).name} 기습 · ${GUNS[preempt.coastApproach].short} L${COAST_SALVAGE_LEVEL}`
  :rescue&&alternate===rescue?`포로 구출 · ${rescue.state==='ready'?'접근해 회수':run.weapons.some(isCapturedTurret)?'F/H 선택':'F/R 선택'}`:alternateCoast?`${sitePresentation(alternate).name} · ${coastReward(alternate)}`:armory?'무기고 경유':alternate===gantry?part==='breach'?'철갑 권장 · 측면 해치':'측면 해치':wireReady?'열차 직행 · 교신 암호':entry?.direct?.sign||(crossDone&&!run.stats.completedBuild?'수송차 직행 · 조립 전':'보스 직행');
 direct.hidden=!((front>0||prepared||fork||crossDone||coastDelivery||openingAlternate)&&run.stage==='field'&&!raid&&next!==alternate)
  ||!!(next===rescue&&openingAlternate&&rescue.state!=='done');
 direct.dataset.coast=alternateCoast?.coastApproach||'';
 direct.textContent=`${bearing(p,...(alternate.path?entryWaypoint(alternate.path,p):[alternate.x,alternate.y]))} ${alternateLabel} · ${Math.round(distance(p,alternate)/10)}m`;
 let intel='';
 if(raid)intel='';
 else if(railFork)intel=railForkRows(entry.routes,p);
 else if(choosingEntry)intel=entry.routes.map(route=>{
  const plan=railGarrison(run.sites.find(site=>site.id===route.site));
 return `${bearing(p,...entryWaypoint(route.path,p))} ${route.summary||route.sign}${route.recommended?' · 추천':plan?` · ${plan.crew}`:''}`;
 }).join('\n');
 else if(next===reserved&&front===0){
  const shipment=RESEARCH[run.operation.requisition];
  intel=next.state==='ready'?`${shipment.name} 예약품 · 접근해 회수`:`예약 · ${shipment.name}${next.state==='active'?' · 경비 제압':''}`;
 }
 else if(next.id==='rail-cache'&&workshopRoute){
  const fan=run.weapons.some(isCapturedTurret);
  const status=fan&&run.stats.railFanSweep?'양쪽 대열 동시 명중':fan&&next.state==='active'?'남쪽 열린 길에서 두 대열을 함께 겨냥':garrison?.hint||'경비 제압';
  intel=next.state==='ready'?`${status}\n접근해 보급 회수`:next.state==='active'&&fan?status:`${workshopRoute.note}\n${status}`;
 }
 else if(next.id==='rail-relay'){
  const cue=next.state==='ready'?'접근해 회수':next.state==='active'&&!crew?'범위 안에서 해킹'
   :crew&&garrison.type==='mortar'?'후방 박격포 먼저 제압':garrison?.hint||'범위 안에서 해킹';
  const relay=entry?.routes.find(route=>route.site==='rail-relay');
  intel=`${relay?.supplyHint?`${relay.supplyHint} 중 하나`:'확보 시 조준 유인 1회'}\n${cue}`;
 }
 else if(next.id==='rail-ammo')intel=next.state==='ready'?`${ammoRoute?.build.supply||'추가 보급'} · 접근해 회수`:ammoRoute?`경비 제압 → ${ammoRoute.build.supply}`:'경비 제압 후 무장 강화·모듈 보급';
 else if(next===bossTarget&&tuneInferno?.action==='tune')intel=`${tuneInferno.title} · ${tuneInferno.missing}`;
 else if(next===bossTarget&&workshopSite)intel=`${bearing(p,...entryWaypoint(workshopRoute.path,p))} 정비대 · ${workshopRoute.build.supply}\n${workshopRoute.build.missing}`;
 else if(next===bossTarget&&ammoSite)intel=`${bearing(p,...entryWaypoint(ammoRoute.path,p))} 탄약고 · ${ammoRoute.build.supply}`;
 else if(next===bossTarget&&wireReady)intel='교신 암호 · 열차 조준 유인 1회';
 else if(next===bossTarget&&workshopRoute)intel=`${bearing(p,...entryWaypoint(workshopRoute.path,p))} ${workshopRoute.summary}`;
 else if(dispatch&&next===dispatch){
  const cue=dispatch.state==='ready'?'접근해 회수':run.operation.order==='wire'
   ?dispatch.state==='active'?hacking:garrison?garrison.hint:'범위 안에서 해킹한 뒤 회수':order.action;
  intel=`${order.name} · ${cue}`;
 }
 else if(next.site==='port-gantry')intel=`${portSideName(portTurretSide(run.boss))} 포탑 측면 · 첫 포격은 세로`;
 else if(next.id==='port-landing'&&next.gantry)intel='방패병 뒤 박격포까지 제압하면 측면 해치가 열립니다.';
 else if(orderSite&&next===orderSite)intel=entry?.routes.find(route=>route.site==='port-control')?.sign||'확보하면 보스 공략을 고를 수 있습니다.';
 else if(staging&&next===bossTarget)intel=entrance&&distance(p,staging)<40
  ?`${staging.name} · 현재 위치에서 교전`:coastArmed?`${coastPlan.name} · ${staging.name}`:`${staging.name} · 위치를 잡고 교전 개시`;
 else if(prepared&&coastArmed&&next===bossTarget)intel=`${coastPlan.name} 준비 · ${coastPlan.hint}`;
 else if(prepared&&coastPlan&&!coastArmed)intel=`${coastPlan.name} · 필요한 무장 미장착`;
 else if(partStaging&&next===bossTarget)intel=partStaging.hint;
 else if(tactic&&run.stage==='field')intel=`${tactic.name} 확보 · 보스전에 적용`;
 else if(next===bossTarget&&entry?.direct&&PORT_SUPPORT[part])intel=PORT_SUPPORT[part].hint;
 else if(coastSite&&next===coastSite){
  if(coastSite===preempt&&preempt.state==='waiting'&&!preempt.preempt)intel=interact?.id==='coast-preempt'
   ?`${touchLayout.matches?'기습 버튼을':'F 키를'} 눌러 교전 시작 · 제압 후 노획`
   :run.operation.openingGun?`${detour?'감옥 옆 우회로로 이동':'거점 가까이 이동'} · ${GUNS[preempt.coastApproach].short} L${COAST_SALVAGE_LEVEL} 노획`:'엄폐를 돌아 거점에 접근';
  else if(coastSite.opening){
   const move=touchLayout.matches?'스틱':'WASD';
   const role=isSalvageCampaign(run)&&roleTarget&&coastRole(run);
   const parts=role&&run.operator!=='marco'&&salvage.parts.length;
   const cue=parts?`${bearing(p,roleTarget.x,roleTarget.y)} 부품 회수 · ${Math.ceil(distance(p,roleTarget)/10)}m`
    :role&&run.operator==='marco'&&coastSite.state==='active'?'방패 옆에서 자동 사격 · 약점 타격':role?.rescue||'';
   const reward=isSalvageCampaign(run)?coastRescueReward(run.weapons.some(isCapturedTurret),!!run.stats.coastPreempt):'';
   intel=fan?(fanGap<34?'두 대열에 자동 일제사격':'추천 사선 · 양쪽 경비를 겨냥'):
    coastSite.state==='ready'?[reward?`감옥에 접근 · ${reward}`:'감옥에 접근해 구출',parts&&cue].filter(Boolean).join('\n')
    :coastSite.state==='active'?[`경비 ${guards}명 · 제압 후 감옥 접근`,cue].filter(Boolean).join('\n')
    :[`감옥으로 이동 · ${move} · 사격 자동`,reward||cue].filter(Boolean).join('\n');
  }else{
   intel=coastEncounterCue(run,coastSite,coastRocketVolley(run,coastSite),coastRocketCounter(run,coastSite))||(fork?`${coastReward(coastSite)} · ${coastApproach(coastSite).formation}`:coastApproach(coastSite).hint);
   const service=coastService(run,coastSite);
   if(service&&isCapturedTurret(service.weapon)&&coastSite.state!=='active')intel+=`\n포탑 L${service.level} 정비 · 조율권 1개`;
   if(coastSite.coastApproach==='r'&&coastSite.state!=='active'&&coastalThermalPrep(run))intel+=`\n흡열 준비 · 보급에서 축전 코일 선택`;
  }
 }
 else if(front===0&&run.sites[0]?.state!=='done'){
  const rescue=run.sites[0],route=beachRoute(run.seed).name;
  if(rescue?.opening)intel=`${route} · 구출 후 F / R 선택`;
  else if(rescue?.gun)intel=`${route} · ${GUNS[rescue.gun].name} 보급`;
 }else if(front===1&&railHasRelay(run))intel='중계기 연결 · 조준 유인 1회';
 else if(front===2&&run.operation.jammed)intel='통신 교란 중 · 증원 6 → 3';
 const otherMortar=front===0&&run.stage==='field'&&run.hazards.find(h=>h.coastMortar&&h.coastMortar!==coastSite?.id&&!h.hit&&distance(p,h)<blastContactRadius(h));
 if(otherMortar)intel=`박격포 · 탄착원 밖으로 ${(Math.ceil(otherMortar.timer*10)/10).toFixed(1)}초`;
 else if(response)intel=`${bearing(p,response.target.x,response.target.y)} ${response.hint}`;
 else if(conduit?.gun){
  const direction=bearing(p,conduit.gun.x,conduit.gun.y);
  const flight=run.shots.some(q=>q.conduitGun===conduit.gun.id);
  intel=`${direction} 박격포 · ${flight?'도약탄 비행 중':conduit.clear?'사선 확보 · 자동 조준':conduit.safe?'엄폐 옆으로':'회피 후 사선 확보'}`;
 }
 else if(cut)intel='';
 else if(!intel&&incoming&&next.state==='ready')intel='접근해 회수';
 fieldIntel.hidden=!intel||holdout;
 fieldIntel.toggleAttribute('data-rail-fork',!!railFork);
 if(railFork){
  if(railForkMarkup!==intel){fieldIntel.innerHTML=intel;railForkMarkup=intel;}
 }else{
  if(fieldIntel.textContent!==intel||fieldIntel.firstElementChild)fieldIntel.textContent=intel;
  railForkMarkup='';
 }
 document.body.classList.toggle('holdout-active',holdout);
 const portHoldout=holdout&&front===2;
 const relayDefense=holdout&&run.challenge?.type==='defend'&&run.challenge.state==='active'&&!run.challenge.secured;
 const relayRound=relayDefense&&relayDefenseRound(run);
 const relayInterrupted=relayRound&&distance(p,relayRound)<blastContactRadius(relayRound);
 const signalWarning=portHoldout&&run.hazards.some(h=>(h.signalCut||h.portBattery)&&!h.hit&&distance(p,h)<blastContactRadius(h));
 document.body.classList.toggle('port-holdout',portHoldout);
 document.body.classList.toggle('rail-defense',!!relayDefense);
 document.body.classList.toggle('relay-interrupted',!!relayInterrupted);
 document.body.classList.toggle('signal-warning',signalWarning);
 $('holdout-intel').hidden=!holdout;
 const wreck=coastSalvageWreck(run),recovery=$('salvage-progress');
 const recoveringTurret=!!wreck&&salvage.turret==='securing';
 recovery.hidden=!recoveringTurret;
 document.body.classList.toggle('turret-recovery',recoveringTurret);
 document.body.classList.toggle('turret-recovery-only',recoveringTurret&&run.challenge?.state!=='active');
 if(recoveringTurret){
  const meter=recovery.firstElementChild;
  meter.max=COAST_SALVAGE.seconds;meter.value=salvage.work;
  recovery.lastElementChild.textContent=`${(Math.floor(salvage.work*10)/10).toFixed(1)} / ${COAST_SALVAGE.seconds}초`;
 }
 const pursuit=$('pursuit');
 pursuit.hidden=!holdout||run.raid?.state==='active'||run.challenge?.state==='active';
 if(holdout){
  const challenge=run.challenge,active=challenge?.state==='active';
  const contract=holdoutContract(run,active?challenge.tier:undefined);
  pursuit.disabled=!canStartChallenge(run);
  const tier=holdoutTier(run.holdTime),nextWave=Math.ceil(HOLDOUT.grace+tier*HOLDOUT.tierSeconds-run.holdTime);
  const nearGate=interact?.id==='extract',finalFront=!canAdvanceFront(run);
  const contractTier=(run.operation.challengeTier||0)+1;
  const rewardTier=active?challenge.tier:contractTier;
  const rare=!finalFront&&rewardTier===1;
  const kills=Math.min(run.operation.holdoutKills||0,HOLDOUT.rareKills);
  let detail=contract.risk;
  const defending=relayDefense;
  const quarry=active&&challenge.type==='hunt'&&!challenge.secured?run.enemies.filter(e=>!e.dead&&challenge.targets.includes(e.id)).sort((a,b)=>distance(p,a)-distance(p,b))[0]:null;
  const batteries=portBatteries(run),battery=batteries.reduce((best,gun)=>!best||distance(p,gun)<distance(p,best)?gun:best,null);
  const courier=signalCourier(run);
  const cargo=signalCargo(run),escort=active&&challenge.recoverCargo?signalGuardCount(run):0;
  const relayGap=defending?distance(p,DEFENSE_ZONE):0;
  const relayTime=defending?`${challenge.progress.toFixed(1)} / ${challenge.duration}초`:'';
  const relayComplete=defending&&challenge.progress>=challenge.duration;
  if(defending){
   detail=relayInterrupted?`${relayComplete?'송신 완료':'송신 끊김'} · 탄착원 밖으로`:relayComplete?'송신 완료 · 착탄 대기'
    :relayGap<=DEFENSE_ZONE.r?'송신 중':'방어 범위로 이동';
  }else if(cargo){
   detail=interact?.id==='signal-cargo'?'화물 회수 가능 · 행동 버튼':'잔해에 접근해 화물 회수';
  }else if(courier){
   const target=challenge.target;
   detail=`이탈 ${Math.ceil(challenge.timeLeft)}초 · 차량 HP ${Math.ceil(target.hp)}${signalWarning?' · 진로 포격':escort?` · 호위 ${escort}`:''}`;
  }else if(battery){
   detail=`박격포 ${2-batteries.length}/2 · ${signalWarning?'탄착 범위 밖으로':`${portBatterySide(battery)} 포대 HP ${Math.ceil(battery.hp)}`}`;
  }else if(active&&challenge.type==='hunt'){
   const left=run.enemies.filter(e=>!e.dead&&challenge.targets.includes(e.id)).length;
   detail=`지휘관 ${2-left}/2명 제압`;
  }else if(challenge?.state==='failed')detail='차량 이탈 · 같은 단계 재도전 가능';
  else if(finalFront&&contract.id==='intercept')detail=`${signalLaneLabel[signalLane(run.seed)]} · ${rewardTier===1?contract.risk:`${SIGNAL_SECONDS}초 내 차량 저지`}`;
  if(portHoldout&&signalWarning&&!active)detail='남은 탄착 범위 밖으로';
  if(rare&&active)detail=`${challenge.secured?'목표 확보':detail} · 증원 ${kills}/${HOLDOUT.rareKills}`;
  if(run.raid?.state==='active')detail='습격 종료 후 잔류 도전 가능';
  const target=defending?DEFENSE_ZONE:cargo||courier||battery||quarry;
  const targetName=defending?'중앙 중계기':cargo?'통신 화물':courier?'통신 차량':battery?`${portBatterySide(battery)} 포대`:'지휘관';
  const gatePrompt=shoreTransfer?'철도 전진로 개방':isSalvageCampaign(run)&&front===1?'게이트 · 귀환 또는 전진':finalFront?'게이트 · 귀환 또는 잔류':'게이트 · 전진 또는 잔류';
  $('objective').textContent=defending&&(relayGap<=DEFENSE_ZONE.r||relayComplete)?`중계기 송신 · ${relayTime}`:target?`${bearing(p,target.x,target.y)} ${targetName} · ${Math.round(distance(p,target)/10)}m`:nearGate?gatePrompt:`${direction} ${gate.name} · ${Math.round(distance(p,gate)/10)}m`;
  const reserveAt=active?challenge.reserveAt:null;
  $('threat').textContent=relayRound&&(relayInterrupted||relayComplete)?`착탄까지 ${(Math.ceil(relayRound.timer*10)/10).toFixed(1)}초`:reserveAt>run.holdTime?`${defending?'중계기':'지휘부'} 역습까지 ${Math.ceil(reserveAt-run.holdTime)}초`:tier===0?`${active&&challenge.type==='hunt'?'정규 공세':'첫 증원'}까지 ${nextWave}초`:tier===HOLDOUT.maxTier?`공세 ${tier}/${HOLDOUT.maxTier} · 최대 증원`:`공세 ${tier}/${HOLDOUT.maxTier} · 강화까지 ${nextWave}초`;
  const steps=$('holdout-steps');
  for(let i=0;i<steps.children.length;i++)steps.children[i].classList.toggle('active',i<tier);
  $('ground-xp').textContent=groundXp(run);
  $('pursuit-goal').textContent=cargo?'D1 · 차량 정지, 화물 미회수':active?`D${challenge.tier} · ${contract.name}`:contract.id==='defend'?`안전한 방어 범위에서 ${defenseSeconds(contractTier)}초 송신`:contract.goal;
  $('pursuit-intel').textContent=detail;
  const parts=rare?holdoutParts(run.seed,front).map(id=>FRONT_SUPPORTS[id].name).join(' / '):'';
  const earned=run.operation.nextSupport;
  const pay=$('pursuit-pay'),pendingCargo=portHoldout&&run.stats.portCounterbatteryCargo;
  pay.toggleAttribute('data-extraction-reward',!!pendingCargo||portHoldout&&rewardTier===2);
  pay.textContent=pendingCargo?`진지 노획품 확보 · 생존 귀환 +${COUNTERBATTERY_CREDITS}C`
   :earned&&!active?`${FRONT_SUPPORTS[earned].name} 확보 · ${supportTactic(earned,front+1)}`
   :rare?`희귀 부품 · ${parts}${canAdvanceWithVanguard(run)?' · 지금 전진 시 선발 지원':''}`
   :cargo||courier||battery?`${bearing(p,gate.x,gate.y)} 귀환 게이트 ${Math.round(distance(p,gate)/10)}m`
   :rewardTier===1?`보상 · 화물 ${CARGO_CREDITS}C 또는 후송 보급`:portHoldout&&rewardTier===2&&isSalvageCampaign(run)?`진지 제압 후 생존 귀환 +${COUNTERBATTERY_CREDITS}C`
   :`완료 +${(rewardTier*500).toLocaleString()}점${portHoldout&&run.stats.holdoutCargo?` · 화물 +${CARGO_CREDITS}C 확보`:''}`;
  $('pursuit-label').textContent=pursuit.disabled?'도전 대기 · 적 밀집':`D${contractTier} · ${contract.name}`;
 }
 const maneuver=$('maneuver-status'),active=activeManeuver(p);
 maneuver.hidden=!p.maneuver;maneuver.classList.toggle('active',!!active);
 if(p.maneuver)maneuver.textContent=`${MANEUVERS[p.maneuver].name} · ${active?'가동':p.maneuver==='assault'?'회피하며 이동':'정지해 조준'}`;
 const support=FRONT_SUPPORTS[run.operation?.support];
 $('support-status').hidden=!support;
 if(support)$('support-status').textContent=carriesCoastSalvage(run)&&front===1&&run.operation.support==='vanguard'?'후송 정비 · 첫 경보 +1초'
  :front===2&&part!=='breach'&&Object.hasOwn(PORT_SUPPORT,part)&&!run.boss.active&&run.stage==='field'
   ?supportTactic(run.operation.support,front):`${support.name} · ${support.role}`;
 if(salvage){
  const rank=coastRoleRank(salvage),bonus=Math.round(coastRoleBonus(run.operator,rank)*100),turret=run.boss.parts[0];
  const name=coastRole(run).name,marco=run.operator==='marco';
  if(coastAtShore(run)||!support){
   $('support-status').hidden=false;
   $('support-status').textContent=`${name} ${salvage.progress}/${COAST_SALVAGE.steps.at(-1)}${rank?marco?` · 관통 피해 +${bonus}%`:` · 발사 간격 −${bonus}%`:''}`;
  }
  if(roleTarget&&!isSalvageCampaign(run)){
   $('objective').textContent=`${bearing(p,roleTarget.x,roleTarget.y)} ${roleTarget.name} · ${Math.round(distance(p,roleTarget)/10)}m`;
   fieldIntel.hidden=false;
   fieldIntel.textContent=run.operator==='marco'?'측면으로 돌아 방패 뒤를 쏘세요.':salvage.parts.length?'떨어진 부품에 다가가 회수하세요.':'수송 호위를 제압해 부품을 떨구세요.';
  }
  if(coastAtShore(run)&&run.stage==='boss'){
   $('objective').textContent=coastTurretLane(run)?`포탑 우선 조준 · HP ${Math.ceil(turret.hp/turret.maxHp*100)}%`:'차체 조준 · 측후면 공략';
   fieldIntel.hidden=false;
   fieldIntel.textContent=coastTurretLane(run)?'포탑 파괴 시 재장전 탄막 약화':turret.hp>0?coastHullFront(run)?'포탑 보존 중 · 측면으로 돌아 장갑 우회':'포탑 보존 중 · 재장전 때 약점 공략':'포탑 파괴 · 재장전 탄막 약화';
  }
  if(gate&&(!isSalvageCampaign(run)||wreck)){
   pursuit.hidden=true;
   $('objective').textContent=wreck?(recoveringTurret?'포탑 분리 중':`${bearing(p,wreck.x,wreck.y)} 수송차 잔해 · 포탑 분리`):
    `${bearing(p,gate.x,gate.y)} ${gate.name} · ${Math.round(distance(p,gate)/10)}m`;
   $('pursuit-goal').textContent=wreck?'포탑 노획':canAdvanceFront(run)?salvage.turret==='secured'?'포탑 확보':'철도 전진 가능':'귀환 가능';
   $('pursuit-intel').textContent=wreck?salvage.turret==='intact'?'잔해에서 행동 · 증원 속 5초 분리':'잔해 가까이에서 분리 진행':canAdvanceFront(run)?'전진 게이트에서 철도로 이동하세요.':'귀환 게이트에서 생존 귀환을 확정하세요.';
   $('pursuit-pay').textContent=canAdvanceFront(run)?wreck?'분리 후 이번 판 장착':salvage.turret==='secured'?'포탑을 확보한 상태로 철도 진입':'철도 전진 시 현재 무장 이월':wreck?`반출 +${COAST_SALVAGE.credits}C · 부채꼴 포탑`:salvage.turret==='secured'?`게이트로 반출 +${COAST_SALVAGE.credits}C · 부채꼴 포탑`:'';
   if(recoveringTurret)$('threat').textContent=distance(p,wreck)<=COAST_SALVAGE.reach?'범위 안에서 증원군을 막으세요.':'분리 일시 중단 · 잔해 범위로 복귀';
  }
 }
 $('combo').textContent=run.combo>=8?`${run.combo} 연속 처치`:'';
 const key=JSON.stringify([run.weapons.map(w=>[w.id,w.level,w.branch,w.evolved,w.fusion,isCapturedTurret(w)]),run.modules,run.tuning]);
 if(key!==inventoryStamp){
  inventoryStamp=key;
  $('weapons').innerHTML=run.weapons.map(w=>{
   const captured=isCapturedTurret(w);
   const label=w.fusion?`${GUNS[w.id].short}+${GUNS[w.fusion.secondary].short}`:captured?'포탑':GUNS[w.id].short;
   const detail=w.evolved?capstoneName(w):captured?`L${w.level} · 부채꼴`:`L${w.level}/6 ${w.branch?GUNS[w.id].branches[w.branch][0]:''}`;
   return `<div class="weapon ${w.evolved?'evolved':''}" data-weapon-id="${w.id}"${captured?' data-captured':''}>${itemArt(captured?'turret':w.id)}<b>${label}</b><small>${detail}</small></div>`;
  }).join('')+Array.from({length:3-run.weapons.length},()=>'<div class="weapon empty"><b>＋</b><small>미확보</small></div>').join('');
  $('modules').innerHTML=run.modules.map(m=>`<span class="module">${MODULES[m.id].name} ${m.rank}</span>`).join('');
 }
 const fusion=run.weapons.find(w=>w.fusion),focused=run.weapons.find(isFocusedInferno),synergy=$('synergy');
 synergy.classList.toggle('conductive',!!fusion);
 synergy.textContent=fusion?.fusion.branch==='incendiary'?`화약탄 ${Math.min(RULES.fusion.hitsPerPayload,Math.floor(fusion.payload))}/${RULES.fusion.hitsPerPayload} · 유폭 ${run.stats.emberBursts||0}회`:fusion?`연쇄탄 ${Math.min(RULES.fusion.hitsPerPayload,Math.floor(fusion.payload))}/${RULES.fusion.hitsPerPayload} · 도약 ${run.stats.payloadRelays||0}회`:moduleRank(run,'catalyst')?`점화 ${[...run.enemies,...(run.boss.active?[run.boss,...run.boss.parts]:[]),...(run.raid?.state==='active'?[run.raid.target]:[])].filter(e=>!e.dead&&e.hp>0&&e.burn>0).length} · 열압 ${run.stats.heatBursts}회`:'';
 const trial=run.modules.map(m=>researchProofProgress(run,m.id)).find(proof=>proof&&!proof.done);
 const proved=completedResearchProofs(run).length;
 if(trial||proved){
  const thermalWaiting=trial?.counter==='thermalRecovered'&&run.player.charge===100;
  const status=trial?`${trial.short} 실증 ${Math.floor(trial.progress)}/${trial.amount}${thermalWaiting?' · 스킬 사용 후 충전':''}`:`실증 완료 · 정산 +${proved*RESEARCH_PROOF_CREDITS}C`;
  synergy.textContent=[synergy.textContent,status].filter(Boolean).join(' · ');
 }else{
  if(moduleRank(run,'shrapnel'))synergy.textContent+=`${synergy.textContent?' · ':''}파쇄 ${run.stats.shrapnelBursts||0}회`;
  if(moduleRank(run,'thermal')&&run.stats.thermalRecovered>=1)synergy.textContent+=`${synergy.textContent?' · ':''}흡열 +${Math.floor(run.stats.thermalRecovered)}충전`;
 }
 const options=assemblyOptions(run),ready=(run.firstNew==='f'&&options.find(o=>o.id==='evolve:f'))||options.find(o=>['evolve','fusion'].includes(o.kind));
 const heatReady=heatSynergyReady(run,2)&&moduleRank(run,'catalyst')===2&&options.some(o=>o.id==='tune:catalyst');
 const upgrade=$('field-upgrade');
 upgrade.hidden=run.pendingLevels===0||run.phase!=='playing';
 upgrade.disabled=!canOpenLevel(run);
 if(!upgrade.hidden){
  const count=String(run.pendingLevels),badge=$('field-upgrade-count');
  if(badge.textContent!==count)badge.textContent=count;
  const label=`XP 개조 ${count}회${upgrade.disabled?' 대기':' 사용 가능'}`;
  if(upgrade.getAttribute('aria-label')!==label)upgrade.setAttribute('aria-label',label);
 }
 const gear=$('gear');
 const tuneReady=tuneInferno?.action==='tune';
 const gearMode=ready||heatReady||tuneReady?'ready':options.some(o=>o.kind==='maneuver')?'maneuver':'idle';
 const gearTitle=ready?ready.title:tuneReady?'촉매 조율':heatReady?'열압 연계':gearMode==='maneuver'?'노획 교범':'병기 작업대';
 const gearHint=ready?'조립 가능':tuneReady?'조율 후 진화':heatReady?'조율 가능':`조율권 ${run.tuning}`;
 const gearKey=`${gearMode}:${gearTitle}:${gearHint}`;
 if(gear.dataset.view!==gearKey){
  gear.dataset.view=gearKey;
  gear.dataset.mode=gearMode;
  gear.setAttribute('aria-label',`${gearTitle} · ${gearHint}`);
  gear.setAttribute('aria-keyshortcuts','G');
  const short=ready?'조립':heatReady||tuneReady?'조율':gearMode==='maneuver'?'교범':'작업대';
  gear.innerHTML=`<b>${esc(gearTitle)}</b><small>${gearHint}</small><b class="gear-short" aria-hidden="true">${short}</b><kbd class="key-hint" aria-hidden="true">G</kbd>`;
 }
 const railLocked=rail?.locked;
 for(const el of $('weapons').children)el.classList.toggle('just-equipped',performance.now()<equippedUntil&&el.dataset.weaponId===equippedWeapon);
 const feedback=$('field-feedback');
 feedback.hidden=railLocked||!!shoreTransfer||!feedback.childElementCount||run.phase!=='playing'||performance.now()>equippedUntil;
 const actionButton=$('interact'),actionDetail=$('interact-detail');
 actionButton.hidden=!interact||!!interact.blocked;
 actionButton.dataset.kind=interact?.id||'';
 const transferState=shoreTransfer?.state||'';
 if((actionButton.dataset.shoreHandoff||'')!==transferState){
  if(transferState)actionButton.dataset.shoreHandoff=transferState;
  else delete actionButton.dataset.shoreHandoff;
  actionButton.style.setProperty('--transfer-ink',shoreTransfer&&gateInk||'');
 }
 $('interact-label').textContent=shoreTransfer?'철도 게이트 열기':interact?.label||'';
 const actionNote=shoreTransfer?.gateNote||'';
 actionDetail.hidden=!actionNote;
 if(actionDetail.textContent!==actionNote)actionDetail.textContent=actionNote;
 const skill=skillRules(run),counter=portAidCounterReady(run),counterRound=portAidCounterRound(run),skillButton=$('skill');
 const counterAvailable=counter&&(counterRound||run.boss.parts[1].hp>0);
 const skillStatus=p.overdrive>0?`${p.overdrive.toFixed(1)}초 가동`:p.skillCd>0?`${p.skillCd.toFixed(1)}초`:`${Math.floor(p.charge)}/${skill.cost}`;
 skillButton.disabled=!canUseSkill(run);
 const aimReady=run.operator==='marco'&&!skillButton.disabled;
 const study=focus?.impacts.some(hit=>hit.study);
 const aimHint=focusGesture?.canceled?'놓아서 취소':study?`약점 · 집중 +${RULES.marco.studyRefund}`
  :focus?focus.impacts.length?`발사 · 표적 ${focus.impacts.length}`:focus.lane.blocked?'엄폐 차단':'표적 없음'
  :aimReady&&focusStudyAvailable(run)?'약점 드래그 조준':'드래그 조준';
 skillButton.dataset.aim=run.operator==='marco'?'marco':'';
 skillButton.dataset.counter=counterAvailable?'ready':'';
 const intercept=PORT_AID_INTERCEPT[counterRound?.portRound];
 const counterTarget=intercept?.label||'측면 장갑 타격';
 const counterShort=intercept?.short;
 const counterPart=counterRound?.portRound==='lock'?'차체':'장갑';
 const readyCounter=counterRound&&!skillButton.disabled;
 const counterHit=front===2&&run.boss.active&&run.effects.findLast(f=>f.type==='aid-counter');
 document.body.classList.toggle('port-counter-aim',!!(readyCounter||counterHit));
 if(counterAvailable)skillButton.setAttribute('aria-label',`지원 포격 · ${counterTarget}${intercept?` · ${counterPart} 반격`:''} · ${actor.skill} 동시 발동 · ${skillStatus}`);
 else if(aimReady)skillButton.setAttribute('aria-label',`${actor.skill} · ${aimHint} · 집중 ${skillStatus}`);
 else skillButton.removeAttribute('aria-label');
 skillButton.innerHTML=`${counterAvailable?'지원 포격':actor.skill}<small>${readyCounter?counterShort:aimReady&&!counterAvailable?aimHint:skillStatus}</small>`;
 const dash=$('dash'),dashEmber=p.dashCd<=0&&run.zones.some(z=>emberChargeCue(run,z).rollInReach);
 dash.disabled=p.dashCd>0;dash.classList.toggle('ember-ready',dashEmber);
 dash.innerHTML=`${dashEmber?'유폭 회피':'회피'}<small>${dashEmber?'이동 + 회피':p.dashCd>0?`${p.dashCd.toFixed(1)}초`:'준비<span class="key-hint"> · SPACE</span>'}</small>`;
 $('raid-hud').hidden=!raid;document.body.classList.toggle('raid-active',!!raid);
 if(raid){
  const {target,contract}=raid;
  $('raid-time').textContent=`탈출까지 ${Math.ceil(raidTimeLeft(raid))}초`;
  $('raid-progress').max=target.maxHp;$('raid-progress').value=target.hp;
  $('raid-hp').textContent=`${bearing(p,target.x,target.y)} ${RAID_MARKS[contract].name} ${Math.ceil(target.hp).toLocaleString()}`;
  const nose=raidOnNose(run);
  const angle=$('raid-angle');
  angle.toggleAttribute('data-raid-nose',nose);
  angle.textContent=contract==='light'?'이탈로를 따라 추격':nose?'전면 장갑 · 진로 옆으로 이동':'측후면 · 사격을 유지하세요';
 }
 $('boss-hud').hidden=!run.boss.active;
 const harborWarnings=front===2&&run.boss.active?run.hazards.filter(h=>!h.lane&&!h.hit):[];
 const railLanes=rail?.lanes||[];
 const railCounter=front===1?run.effects.findLast(f=>f.railCounter!==undefined):null;
 const railFan=rail?.fan;
 const railCutHit=front===1&&run.effects.some(f=>f.railFanCut);
 document.body.classList.toggle('boss-active',run.boss.active);
 document.body.classList.toggle('coast-boss',run.boss.active&&front===0);
 document.body.classList.toggle('coast-danger',front===0&&run.boss.active&&['windup','charge'].includes(run.boss.mode));
 document.body.classList.toggle('rail-boss',run.boss.active&&front===1);
 document.body.classList.toggle('rail-escape',!!rail?.slot);
 document.body.classList.toggle('harbor-boss',run.boss.active&&front===2);
 document.body.classList.toggle('harbor-warning',harborWarnings.length>0);
 if(run.boss.active){
  const boss=run.boss,recovering=boss.mode==='recover';
  const rounds=harborWarnings.filter(h=>h.portRound);
  const dangerousRounds=harborWarnings.filter(h=>distance(p,h)<blastContactRadius(h));
  const portDanger=dangerousRounds.length>0;
  const counterCovers=readyCounter&&dangerousRounds.some(h=>h.portRound===counterRound.portRound);
  const counterLeavesDanger=counterCovers&&dangerousRounds.some(h=>h.portRound!==counterRound.portRound);
  const bossState=$('boss-state');
  const chargeDanger=!(front>0)&&(boss.mode==='windup'||boss.mode==='charge');
  bossState.classList.toggle('salvo-danger',portDanger||!!rail?.escape||!!rail?.mortar||chargeDanger);
  bossState.dataset.rail=rail?.mortar||rail?.escape?'':railCutHit?'cut':rail?.wait||rail?.pad?.state==='hold'?'fan':railLocked?'decoy':'';
  const bossName=$('boss-name'),name=region(run).boss;
  if(bossName.textContent!==name)bossName.textContent=name;
  const railOpen=front===1&&recovering&&railDisarmed(boss);
  $('boss-hp').max=boss.maxHp;$('boss-hp').value=boss.hp;
  if(rail){
   const time=seconds=>`${(Math.ceil(seconds*10)/10).toFixed(1)}초`;
   const side=rail.slot&&(rail.slot.x<p.x?'왼쪽':'오른쪽');
   const dodge=side?`${side} 차선 밖으로`:'포격 범위 밖으로';
   const evade=railFan?.state==='flying'?`포탑 발사 · ${dodge}`:dodge;
   if(rail.mortar&&(!rail.slot||rail.time===null||rail.mortar.timer<=rail.time))
    bossState.textContent=`박격포 · ${side?`${side} 안전 위치로`:'원 밖으로'} ${time(rail.mortar.timer)}`;
   else if(rail.wait)bossState.textContent='양쪽 포대 조준 · 발사 대기';
   else if(rail.escape)bossState.textContent=railLocked?`유인 고정 · ${dodge}`:`${evade} · ${time(rail.time)}`;
   else if(railCutHit)bossState.textContent='양쪽 포대 직격 · 포격 차단';
   else if(railOpen)bossState.textContent='양쪽 포대 파괴 · 차체 노출';
   else if(recovering)bossState.textContent='재장전 · 반격 기회';
   else if(rail.time!==null)bossState.textContent=`차선 밖 · 착탄까지 ${time(rail.time)}`;
   else if(railLocked)bossState.textContent='조준 고정 · 차선 밖에서 대기';
   else if(rail.pad?.state==='hold')bossState.textContent='사격 위치 확보 · 발사 대기';
   else if(boss.mode==='salvo')bossState.textContent='포격 종료 · 반격 준비';
   else if(interact?.id==='rail-decoy')bossState.textContent='조준 중 · 이 위치에 유인';
   else bossState.textContent=railHasRelay(run)?'중계기 · 조준 예상선':'포격 조준 준비';
  }else if(front===2){
   const lock=rounds.find(h=>h.portRound==='lock');
   const timed=portDanger?dangerousRounds:rounds;
   const countdown=timed.length&&(Math.ceil(Math.min(...timed.map(h=>h.timer))*10)/10).toFixed(1);
   const rake=rounds.some(h=>h.portRound==='rake');
   const cut=boss.armorSuppressedCycle===boss.cycle;
   const warning=!lock?'포격 범위 밖 · 착탄 대기':rake?'가로 포격':rounds.some(h=>h.portRound==='battery')?'세로 포격'
    :portCrossfireCuts(run,boss.cycle)?'측면 차단 · 발밑 포격':lock.jammed?'관제소 · 발밑 포격':portRelayCuts(run,boss.cycle,'armor')||portSignalCuts(run,boss.cycle,'armor')?'전도 · 발밑 포격':cut?'철갑 · 발밑 포격':'발밑 조준 고정';
   const lanes=portDanger?portEscapeLanes(run,harborWarnings,combatHud.analog):[];
   const escape=lanes.length?`${lanes.map(lane=>lane.label).join('·')}${lanes[0].dy?'로':'으로'} 회피`:'탄착 범위 밖으로';
   const lead=counterCovers&&!counterLeavesDanger?`스킬 · ${counterShort}`:portDanger?escape:warning;
   const nextCycle=boss.cycle+1,nextRound=portAuxiliaryRound(run,nextCycle);
   const ready=nextRound==='battery'?'측면 장갑 · 세로 포격 준비':nextRound==='rake'?'측면 장갑 · 가로 포격 준비':'발밑 포격 준비';
   bossState.textContent=countdown?`${lead} · ${countdown}초`:recovering?'코어 노출 · 집중 공격':boss.mode==='salvo'?'포격 종료 · 반격 준비':ready;
  }
  else $('boss-state').textContent=recovering
   ?coastArmed&&run.operation.coastStrike==='r'&&!run.operation.coastStrikeUsed?'수송차 재장전 · 다음 돌진 준비':'후면 엔진 노출 · 주황 표식으로':boss.mode==='windup'?`옆으로 회피 · ${(Math.ceil(boss.timer*10)/10).toFixed(1)}초`:boss.mode==='charge'?'돌진 중 · 진행선 밖으로':'측후면을 노려라';
  const names=front===1?[railGunLabel(0),railGunLabel(1)]:front===2?['포탑','측면 장갑']:['포탑','궤도'];
  const turretCut=rounds.length&&(boss.emberCycle===boss.cycle||boss.turretSuppressedCycle===boss.cycle);
  const relayCycle=boss.mode==='salvo'?boss.cycle:boss.cycle+1;
  const parts=$('boss-parts');
  if(front===1){
   if(!parts.hasAttribute('data-rail-parts')){
    parts.setAttribute('data-rail-parts','');
    parts.innerHTML=names.map((label,i)=>`<span class="rail-gun" style="--gun-ink:${RAIL_GUN_COLORS[i]}"><b>${label}</b><span></span><progress aria-label="${label} 내구" max="1" value="0"></progress></span>`).join('');
   }
   boss.parts.forEach((part,i)=>{
    const lane=railLanes.find(h=>railGunOf(h)===i),gun=parts.children[i],meter=gun.lastElementChild;
    const status=part.hp<=0?'파괴':railCutHit||railCounter?.railCounter===i?'차단':lane?.tracked?(lane===rail.bait?'유인':'추적'):lane?'측면':recovering?'재장전':'가동';
    if(gun.dataset.state!==status){gun.dataset.state=status;gun.children[1].textContent=status;}
    meter.max=part.maxHp;meter.value=Math.max(0,part.hp);
   });
  }else{
   parts.removeAttribute('data-rail-parts');
   parts.textContent=coastAtShore(run)?(boss.parts[0].hp<=0?'포탑 파괴 · 3발 사격':
    salvage.plan==='capture'?'포탑 보존 · 격파 후 분리':'포탑 우선 조준 · 5발 사격'):names.map((name,i)=>{
    if(boss.parts[i].hp<=0)return `${name} 파괴`;
    if(front===2&&portCrossfireCuts(run,relayCycle))return `${name} 급탄 차단`;
    const side=i===0?'turret':'armor';
    if(front===2&&(portRelayCuts(run,relayCycle,side)||portSignalCuts(run,relayCycle,side)))return `${i===0?'포탑':'보조포'} ${boss.mode==='salvo'?'전도 차단':'다음 사격 정지'}`;
    if(i===0&&turretCut)return '포탑탄 차단';
    if(front===2&&i===1&&!recovering&&boss.armorSuppressedCycle===(boss.mode==='aim'?boss.cycle+1:boss.cycle))return '보조포 급탄 차단';
    const state=i===0&&portGantryBypass(run)?'측면 노출':i===0&&portTurretShutter(run)?'포격 장갑':'가동';
    return `${name} ${state}`;
   }).join(' / ');
  }
  const active=tactic&&recovering&&boss.tacticCycle===boss.cycle;
  const supportId=run.operation?.support;
  const harborPart=front===2&&Object.hasOwn(PORT_SUPPORT,supportId);
  const coreGap=distance(p,boss)-portCoreReach(run);
  const compression=focused&&supportId==='overrun'&&front===2;
  const coreOpen=compression&&portCoreDisrupted(run);
  const compressionBand=compression&&portCompressionBand(run);
  const dashLead=compression&&portCoreWindow(run)&&(p.dash>0||p.dashCd<=0&&coreGap<=110);
  const focusLead=compression&&recovering&&!dashLead&&!coreOpen;
  const firstWarning=supportId==='vanguard'&&(boss.cycle===0&&boss.mode==='aim'||boss.cycle===1&&boss.mode==='salvo');
  const dashWindow=!harborPart&&supportId==='overrun'&&recovering;
  const supportHint=supportTactic(supportId,front);
  const portTactic=front===2?run.operation.tactic:null;
  const harborHint=tactic&&({heat:'재장전 · 코어 가까이에서 분사',signal:'원거리 로켓·전기 · 포탑 역송',lens:'재장전 · 중거리에서 정지해 코어 조준',ember:'포탑탄 예고 · 화약 지대에 보병 유도'})[portTactic];
  let hint=(front===2?harborHint:tactic?.hint)||(supportId==='vanguard'||harborPart?'':supportHint);
  if(active&&run.operation.tactic==='heat')hint='장갑 과열 · 지금 집중 공격';
  else if(railOpen)hint='';
  else if(front===2&&run.operation.tactic==='signal'&&boss.parts[0].hp<=0)hint=boss.parts[1].hp>0?'측면 장갑 파괴로 장갑탄 차단':'';
  else if(active&&run.operation.tactic==='signal')hint='전류 연결 완료 · 남은 부위 사격';
  else if(firstWarning||dashWindow)hint=front===1&&firstWarning?'선발 지원 · 첫 경고 +1초':supportHint;
  if(front===2&&recovering&&focused&&!portCoreDisrupted(run)&&!portTurretInSight(run)){
   const gap=distance(p,boss);
   if(infernoCoreLine(run,focused))hint=portTactic==='lens'&&active?'재장전 지연 · 압축 사선 유지':'압축 분사 · 코어 직격 사선';
   else if(gap<INFERNO_CORE_DISTANCE)hint=`압축 분사 · 코어에서 ${INFERNO_CORE_DISTANCE/10}m 이상 거리 확보`;
   else if(gap>=weaponStats(focused).range+boss.r)hint='압축 분사 · 코어 사거리까지 접근';
   else hint=p.moving?'압축 분사 · 사선에서 멈춰 조준':'압축 분사 · 엄폐 밖 코어 사선으로';
  }
  if(portTactic==='ember'){
   if(boss.parts[0].hp<=0)hint='포탑 파괴 · 보병 둘로 화약 유폭';
   else if(boss.mode==='salvo'&&boss.tacticCycle===boss.cycle)hint='급탄선 단선 · 남은 포격 회피';
   else if(boss.emberCycle===boss.cycle+1)hint='급탄선 단선 · 다음 포탑탄 차단';
   else hint='포탑 근처 화약에 보병 한 명 유도';
  }
  if(portTactic==='wake'){
   const hit=run.effects.findLast(f=>f.portWake);
   hint=hit?.text||(active?'냉각 배관 점화 완료':recovering?`${boss.parts[1].ox<0?'왼쪽':'오른쪽'} 배관 옆을 달려 불길 남기기`:'포격 뒤 측면 냉각 배관으로');
  }
  if(portTactic==='signal'&&portConductiveSignal(run)){
   const signal=harborSignalLine(run),part=signal?.part==='turret'?'포탑':'보조포';
   const spent=signal?.state==='spent'&&portSignalCuts(run,boss.cycle+1,signal.part);
   hint=({wait:'포격 회피 후 끊을 포대 쪽으로',side:signal?.side===0?'좌우로 이동해 끊을 포대 선택':`${signal?.side<0?'왼쪽':'오른쪽'} 살아 있는 포대 쪽으로`,near:'차체와 22m 이상 거리 확보',far:'전도 격발망 사거리까지 접근',blocked:'엄폐 밖으로 이동해 차체 사선 확보',ready:`사선 확보 · 명중하면 다음 ${part} 차단`,spent:spent?`역송 완료 · 다음 ${part} 차단`:'역송 완료 · 남은 장갑 공격'})[signal?.state]||'';
  }
  if(portTactic==='crossfire'){
   const zone=portCrossfireZone(run);
   if(portCrossfireCuts(run,relayCycle))hint=boss.mode==='salvo'?'양쪽 포격 차단 · 발밑 원 회피':'급탄 차단 · 다음 발밑 포격 대비';
   else if(!zone)hint=boss.parts.some(part=>part.hp<=0)?'남은 장갑을 깨고 차체를 노리세요.':'노획 포탑 장착 필요';
   else if(!recovering)hint='포격 회피 후 차체 앞 사격선으로';
   else if(zone.inside)hint=zone.ready?'사선 확보 · 바깥 탄으로 양쪽 직격':'다음 재장전 준비';
   else hint=`${bearing(p,zone.x,zone.y)} 사격선까지 ${Math.ceil(distance(p,zone)/10)}m · 정면 20m`;
  }
  if(!(front>0)&&boss.mode==='windup'){
   const blockId=boss.chargePath?.blockId;
   hint=blockId&&run.blocks.some(b=>b.id===blockId&&b.hp!==0)?'엄폐 충돌 예상 · 후면 반격 준비':'';
  }
  if(coastPlan&&!run.operation.coastStrikeUsed){
   if(!coastArmed)hint=`${coastPlan.name} · 필요한 무장 미장착`;
   else if(run.operation.coastStrike==='r'){
    const signal=coastSignalPlan(run);
    hint=({
     escape:'신호탄 · 먼저 돌진선 밖으로',near:`신호탄 · 차체에서 ${coastPlan.range/10}m 거리 확보`,
     late:'신호탄 · 다음 예고 전에 가까이',blocked:'신호탄 · 엄폐 옆에서 사선 열기',
     ready:'신호탄 · 차체 사선 확보',spent:'신호탄 · 다음 예고에 재장전',
     wait:boss.mode==='charge'?'':'신호탄 · 16m 이상 거리에서 다음 예고 대기'
    })[signal?.state]||'';
    if(signal?.state==='flying')hint=signal.danger?'신호탄 비행 중 · 돌진선 밖으로':'신호탄 비행 중 · 돌진선 밖 유지';
   }else if(recovering)hint=({
    rear:'연료관 · 주황 표식 뒤로',range:'연료관 · 엔진 사거리까지 접근',
    blocked:'연료관 · 엄폐 옆에서 사선 열기',ready:'연료관 · 분사 사선 확보'
   })[coastFlameLine(run)]||'';
   else if(boss.mode!=='windup')hint='연료관 · 돌진 뒤 후면을 노려라';
  }
  const coastHit=front===0&&run.effects.findLast(f=>f.coastTactic);
  if(coastHit)hint=coastHit.text;
  if(front===1){
   if(railCounter)hint=railCounter.text;
   else if(run.operation.tactic==='signal'&&boss.mode==='aim')hint='포격 예고 전 · 22m 이상 거리 확보';
   else if(run.operation.tactic==='signal'&&rail?.rounds.length&&boss.tacticCycle!==boss.cycle)
    hint=distance(p,boss)>=tactic.range?'사선 밖 · 포대에 역송':'사선 밖 · 열차에서 22m 거리 확보';
   const emberHit=run.effects.findLast(f=>f.type==='ember-dash');
   if(emberHit)hint=emberHit.rail?'회피 유폭 · 철도 병기 명중':'회피 유폭';
   else if(dashEmber)hint='화약 원 안에서 이동 + 회피';
   if(rail?.pad){
    const pad=rail.pad,position=`${bearing(p,pad.x,pad.y)} 금색 사격 위치까지 ${Math.ceil(distance(p,pad)/10)}m`;
    hint=pad.clear?(rail.wait?'자동 발사 직후 차선 밖으로':'포격 예고에 자동 발사'):pad.inPosition?'엄폐 옆에서 사선 확보':position;
   }
   if(railCutHit)hint='재장전 · 반격 기회';
   else if(railOpen)hint='증원과 거리를 벌리며 차체 사격';
  }
  const tacticLine=$('boss-tactic');
  tacticLine.hidden=!hint||portDanger||!!rail?.escape||!!rail?.mortar||dashLead||coreOpen;
  tacticLine.textContent=hint;
  tacticLine.toggleAttribute('data-fan-line',!!rail?.pad||railCutHit);
  const line=$('boss-support');
  const armorHit=supportId==='breach'&&run.effects.findLast(f=>f.interrupted);
  const armorLine=supportId==='breach'?portArmorLine(run):null;
  line.hidden=!harborPart||focusLead||portDanger&&!armorHit&&armorLine!=='ready'&&!counterHit&&(!readyCounter||counterCovers&&!counterLeavesDanger);
  line.classList.toggle('aid-alert',supportId==='recovery'&&!!(aid?.endangered||aid?.state==='blocked'));
  if(harborPart){
   line.dataset.part=supportId;
   if(supportId==='breach'){
    const turret=boss.parts[0],incoming=run.shots.some(q=>q.breachLane&&q.target===turret.id);
    const armor=portArmorExposed(run);
    const prepared=!recovering&&boss.armorSuppressedCycle===(boss.mode==='aim'?boss.cycle+1:boss.cycle);
    const jammed=boss.mode==='aim'&&portJamsSweep(run,boss.cycle+1);
    const turretSide=portSideName(portTurretSide(boss));
    const armorSide=portSideName(-portTurretSide(boss));
    if(armorHit)line.textContent=armorHit.text;
    else if(armor&&prepared)line.textContent=boss.mode==='aim'?'철갑 · 다음 보조 포격 차단':'철갑 · 보조포 차단 · 남은 포격 회피';
    else if(armorLine&&(turret.hp<=0||armorLine!=='flank')){
     line.textContent=({
      ready:boss.mode==='aim'?'철갑 · 장갑 사선 확보 · 선제 차단':'철갑 · 회피하며 장갑 사격',
      flank:`철갑 · ${armorSide} 장갑 측면으로`,
      blocked:'철갑 · 엄폐를 돌아 장갑 사선 확보',
      range:'철갑 · 장갑 사거리까지 접근'
     })[armorLine];
    }
    else if(turret.hp<=0)line.textContent=armor
     ?jammed?'관제소 · 이번 보조 포격 차단':`철갑 · ${armorSide} 장갑에서 다음 조준 대기`
     :'철갑 · 포탑과 측면 장갑 파괴';
    else if(boss.turretSuppressedCycle===boss.cycle&&boss.mode==='salvo')line.textContent='철갑 · 포탑 제압 · 발밑 포격 회피';
    else if(boss.turretSuppressedCycle===boss.cycle&&recovering)line.textContent='철갑 · 후속 탄막 차단 · 측면 사격';
    else if(boss.mode==='salvo'&&incoming)line.textContent='철갑탄 발사 · 지금 발밑 회피';
    else if(portTurretInSight(run))line.textContent='철갑 · 포탑 사선 확보 · 자동 사격';
    else if(portBreachFlank(run))line.textContent='철갑 · 엄폐를 돌아 포탑 사거리로';
    else line.textContent=jammed?`관제소 · 보조포 차단 / ${turretSide} 포탑 사선`
     :armor?`철갑 · ${turretSide} 포탑 / ${armorSide} 보조포`:`철갑 · ${turretSide} 포탑 사선으로`;
   }else if(supportId==='overrun'){
    const arc=run.weapons.some(isConductiveFusion);
    const relay=arc?harborArcTarget(run):null;
    const relayName=relay===boss.parts[0]?'포탑':'보조포';
    if(portWakeMode(run)==='overrun')line.textContent=`장갑 해제 · ${portTurretSide(boss)<0?'오른쪽':'왼쪽'} 배관 옆을 달려 점화`;
    else if(portCoreDisrupted(run)&&boss.harborWakeCycle===boss.cycle)line.textContent=run.effects.findLast(f=>f.portWake)?.text||'배관 점화 완료 · 열린 코어 집중 사격';
    else if(relay&&portCoreDisrupted(run))line.textContent=`코어 명중 → ${relayName} 역송`;
    else if(relay&&p.dashCd<=0&&coreGap<=110)line.textContent=`${coreGap<=0?'↔ 회피':'코어 쪽 회피'} → ${relayName} 역송`;
    else if(arc&&portCoreDisrupted(run)&&boss.harborArcCycle===boss.cycle)line.textContent='전도 역송 완료 · 코어 집중 사격';
    else if(coreOpen){
     line.textContent=infernoCoreLine(run,focused)?'장갑 해제 · 압축 분사 직격'
      :distance(p,boss)<INFERNO_CORE_DISTANCE?`장갑 해제 · 코어에서 ${INFERNO_CORE_DISTANCE/10}m 거리 확보`
      :p.moving?'장갑 해제 · 멈춰 압축 분사':'장갑 해제 · 엄폐 밖 코어 사선으로';
    }else if(compressionBand&&portCoreWindow(run)&&p.dashCd<=0){
     line.textContent='원 안에서 ↔ 회피 후 정지';
    }else if(compression&&coreGap>0&&portCoreWindow(run)&&p.dashCd<=0){
     line.textContent=`압축 인페르노 · ${portCompressionRange}에서 회피`;
    }else if(!recovering&&portWakeBreach(run)){
     line.textContent='돌격 · 포격 뒤 회피로 배관 열기';
    }else{
     line.textContent=portCoreDisrupted(run)?'돌격 · 장갑 해제 · 집중 사격':!portCoreWindow(run)?'돌격 · 포격 뒤 회피 준비':p.dash>0&&p.portRush?'돌격 · 경계 안으로 이동':p.dash>0&&Number.isFinite(p.portCutX)?'돌격 · 좌우 이동 유지':p.dashCd>0?'돌격 · 회피 재사용 대기':coreGap<=0?'돌격 · ↔ 이동 + 회피':coreGap>110?'돌격 · 코어 경계까지 접근':'돌격 · 코어 쪽 이동 + 회피';
    }
   }else{
    const kit=PORT_SUPPORT.recovery;
    if(counterHit)line.textContent=counterHit.text;
    else if(readyCounter)line.textContent=`${counterShort} → ${counterPart} 반격${portDanger?' · 남은 포격 회피':''}`;
    else if(aid?.endangered)line.textContent='구급 · 피격 범위 밖으로 회피';
    else if(aid&&!aid.preview){
     const direction=bearing(p,aid.point.x,aid.point.y);
     const time=(Math.ceil(aid.timer*10)/10).toFixed(1);
     const status=aid.state==='blocked'?'착탄 뒤 회수'
      :aid.state==='safe'?`원을 돌아 회수 ${time}초`
      :`회수 · ${chargeLabel(run)} +${kit.charge}`;
     line.textContent=`구급 ${direction} 화물 · ${status}`;
    }else if(counter)line.textContent=skillButton.disabled?'지원 포격 대기 · 스킬 충전 중':counterAvailable?'스킬로 장갑 타격 · 조준 중엔 탄 차단':'지원 포격 장전 · 다음 조준까지 대기';
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
const bannerPriority=['gate-open','port-hatch','region-entry'];
function processEvents(){
 const banner=$('banner'),events=new Set(takeEvents(run));
 if(banner.dataset.kind&&(mode!=='battle'||bannerRunId!==run.runId||run.t>=bannerUntil)){
  banner.textContent='';delete banner.dataset.kind;
 }
 if(mode!=='battle'||!events.size)return;
 const completed=events.has('complete')&&run.effects.findLast(f=>f.type==='complete');
 const capstone=completed?.showcase?completed:null;
 if(capstone)$('capstone-announcement').textContent=capstone.text?.split(' · ')[0]||'';
 if(store.settings().sound){
  const inferno=run.weapons.some(w=>w.id==='f'&&w.evolved);
  for(const cue of selectRiftAudioEvents(events,{inferno,showcase:capstone?.showcase}))audio.play(cue);
 }
 const priority=bannerPriority.find(type=>events.has(type));
 if(!priority&&bannerPriority.includes(banner.dataset.kind))return;
 const counter=!priority&&events.has('aid-counter')&&run.effects.findLast(f=>f.type==='aid-counter');
 const fx=counter||run.effects.findLast(f=>priority?f.type===priority:!f.interrupted&&f.railCounter===undefined&&(f.type!=='complete'||!capstone)
  &&events.has(f.type)&&(f.text||['boss-arrival','boss-down','raid-start'].includes(f.type)));
 if(!fx||fx.coastTactic||fx.portWake||fx.portRelay||fx.type==='aid-counter')return;
 bannerRunId=run.runId;banner.dataset.kind=fx.type;
 bannerUntil=run.t+(bannerPriority.includes(fx.type)?2.1:1.5);
 if(fx.type==='region-entry'){
  const kit=FRONT_SUPPORTS[run.operation.support];
  const railArrival=carriesCoastSalvage(run)&&run.operation.region===1;
  const handoff=railArrival?railHandoff(run):null;
  bannerUntil=run.t+1.15;
  const message=handoff?.state==='mounted'?`${handoff.title} · 화차 정비대`:handoff?.state==='cargo'?`${handoff.title} · 생존 귀환 시 반출`:kit?`${kit.name} 장착 · ${kit.role}`:region(run).mission;
  banner.innerHTML=`<span>전선 ${String(run.operation.region+1).padStart(2,'0')} / ${String(sortieFrontCount(run)).padStart(2,'0')}</span><strong>${esc(region(run).name)}</strong><small>${esc(message)}</small>`;
 }else if(fx.type==='port-hatch'){
  banner.innerHTML='<span>하역장 경비 제압</span><strong>측면 해치 개방</strong><small>초록 경로를 따라 포탑 쪽으로</small>';
 }else if(fx.type==='gate-open'){
  banner.dataset.kind='gate-notice';
  bannerUntil=run.t+1.1;
  banner.textContent=coastSalvageWreck(run)?'수송차 격파 · 포탑 분리 가능':`${region(run).boss} 격파 · ${exitGate(run).name} 개방`;
 }else{
  banner.textContent=fx.text||({'boss-arrival':region(run).boss,'boss-down':`${region(run).name} 돌파`,'raid-start':'수송대 습격 시작'})[fx.type];
 }
}

function frame(now){
 const elapsed=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
 if(mode!=='battle'||!renderer||!run){
  if(!$('hud').hidden)updateHud();
  if(hudHold.size)revealCombatHud(null,now);
  requestAnimationFrame(frame);return;
 }
 const starting=firstBattleFrame;
 if(starting){firstBattleFrame=false;accumulator=0;coastGuideId=null;$('capstone-announcement').textContent='';}
 if(!starting&&run.phase==='playing'&&!busy&&!pending){if(elapsed>.5){mutate(d=>{pause(d);return true;});accumulator=0;}else{const previousStage=run.stage;accumulator+=Math.min(.1,elapsed);const input=movementInput();while(accumulator>=1/60&&run.phase==='playing'){step(run,1/60,input,renderer.view());accumulator-=1/60;saveClock+=1/60;}if(run.phase!=='playing'){persistCurrent();accumulator=0;}else if(saveClock>=5||previousStage==='boss'&&run.stage==='holdout')persistCurrent();}}
 const entry=fieldEntry(run);
 const aiming=focusGesture&&!focusGesture.canceled&&run.phase==='playing'&&!busy&&!pending&&canUseSkill(run);
 const focus=aiming?focusPlan(run,focusGesture.input||movementInput()):null;
 const reduced=store.settings().reduced||reduceMotion.matches;
 const primary=coastLead(run),fork=coastFork(run,primary,coastGuideId),lead=fork?.lead||primary;
 coastGuideId=lead?.id||null;
 const opening=coastOpeningGuide(run);
 const fan=railFanCutCue(run),rail=railBossGuide(run,fan);
 const handoff=run.stage==='holdout'&&coastAtShore(run)&&carriesCoastSalvage(run)?railHandoff(run):null;
 const gateInk=RAIL_SALVAGE_ROUTES[handoff?.route||(handoff?.state==='cargo'?'rail-cache':'')]?.color;
 const covered=renderer.draw(run,reduced,entry,focus,lead,opening,rail,gateInk);updateHud(entry,focus,{primary,fork,lead,opening},rail,handoff,gateInk);
 revealCombatHud(run.phase==='playing'?covered:null,now,reduced,run.stage);
 if(!busy&&!pending)processEvents();
 requestAnimationFrame(frame);
}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
function boot(){
 try{watchCombatHud();const lock=navigator.locks?fn=>navigator.locks.request(`${STORAGE_KEY}:write`,fn):null;store=createStore(localStorage,lock);
  controls=bindTouchControls({
   stick:$('stick'),actions:{dash:$('dash'),skill:$('skill'),interact:$('interact')},
   canPlay:()=>mode==='battle'&&run?.phase==='playing'&&!busy&&!pending,
   canMove:()=>mode==='battle'&&run?.phase==='playing'&&!pending&&(!busy||committingPlay),
   canAim:a=>a==='skill'&&run?.operator==='marco',
   canCompleteAim:()=>mode==='battle'&&run?.phase==='playing'&&!pending&&(!busy||committingPlay),
   onMove:v=>{touch=v;},onAim:aim=>{focusGesture=aim;},
   onAction:(a,input)=>{
    const direction=a==='skill'?input||movementInput():undefined;
    if(busy&&a==='skill'&&input!==undefined){queuedFocus=direction;return;}
    return mutate(d=>action(d,a,direction));
   },
   onUnlock:unlockSound
  });
  const p=profile();selectedOperator=p.lastOperator||'fio';operationPlan=createOperationPlan(()=>crypto.getRandomValues(new Uint32Array(1))[0],p.active?.run.seed??p.recent[0]?.seed);
  showHome();requestAnimationFrame(frame);
  loadFioPortrait().then(art=>{portraitArt=art;drawPortrait();}).catch(()=>{});
  // Paint the lobby before starting the larger combat downloads.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!battleArt&&!artWork)prepareBattleArt();}));
 }catch(error){panel(`<section class="sheet compact"><span class="eyebrow">LOAD INTERRUPTED</span><h2>작전 기록을 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button data-action="reload-latest">기록 다시 불러오기</button></section>`);}
}
boot();
