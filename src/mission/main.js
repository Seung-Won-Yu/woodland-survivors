import {routeMarkup,regionPreview} from './route.js';
import {weaponIcon} from './icons.js';
import {HEROES,WEAPONS,TRAINING,RESEARCH,DOCTRINES,FRONTS,ORDERS,BASE_WEAPONS,UNIONS,BOSS_GUIDES,buildSynergies,RULESET,calculateSettlement,researchReady} from './content.js';
import {createProfile,parseProfile,recoverActiveRun,createProfileStore,PROFILE_KEY,beginRun,checkpointRun,settleRun,buyTraining,refundTraining,buyResearch,doctrineReady} from './profile.js';
import {createMission,restoreMission,packMission,stepMission,chooseMission,rerollMission,pauseMission,resumeMission,endMission,missionAction,interaction,takeMissionEvents,xpNeeded,bossStatus,holdoutDanger,missionScore} from './model.js';
import {loadMissionArt,operatorPortrait} from './art.js';
import {createMissionRenderer} from './render.js';
import {bindTouchControls} from '../game/touch-controls.js';
import {createAudio} from '../game/audio.js';
const $=id=>document.getElementById(id),ui=$('mission-ui'),audio=createAudio(),keys=new Set(),clone=x=>JSON.parse(JSON.stringify(x));
const touchQuery=matchMedia('(pointer:coarse)'),narrow=matchMedia('(max-width:700px)'),isTouch=()=>touchQuery.matches||narrow.matches;
const fmt=n=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
let store,art,renderer,run,preview,mode='loading',tab='operation',lastPhase='',lastFrame=0,saveClock=0,noticeTimer=0,touch={x:0,y:0},controls,pendingSave=null,mapOpen=false;
const profile=()=>store.get();
function announce(text){$('ui-notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('ui-notice').textContent='',4200);}
function settings(){const p=profile();return `<div class="settings-row"><label><input type="checkbox" data-setting="sound" ${p.settings.sound?'checked':''}>효과음</label><label><input type="checkbox" data-setting="reduced" ${p.settings.reduced?'checked':''}>흔들림·플래시 줄이기</label><a href="./woodland.html">이전 숲 원정</a><span>팬 시제품 0.15</span></div>`;}
function setPanel(html,modal=false){ui.classList.toggle('modal',modal);ui.innerHTML=html;ui.scrollTop=0;if(modal){controls?.reset();requestAnimationFrame(()=>ui.querySelector('button:not(:disabled)')?.focus({preventScroll:true}));}}
function commit(next,after=()=>{}){
 const result=store.commit(next);if(result.ok){after();return true;}
 pendingSave={next,after,mode};mode='saving';setPanel(`<section class="save-sheet" role="dialog" aria-modal="true" aria-labelledby="save-title"><span class="eyebrow">SAVE INTERRUPTED</span><h2 id="save-title">기록을 저장하지 못했습니다.</h2><p>구매·정산은 아직 확정되지 않았습니다. 저장 공간을 확인한 뒤 같은 기록을 다시 저장해 주세요.</p><button class="primary" data-action="retry-save">다시 저장</button></section>`,true);return false;
}
function checkpoint(after=()=>{}){if(!run)return false;const result=checkpointRun(profile(),packMission(run));if(!result.ok){announce(result.reason);return false;}return commit(result.profile,()=>{saveClock=0;after();});}
function nextGoal(p){
 if(p.activeRun)return '진행 중인 작전이 있습니다. 저장한 지점부터 이어갈 수 있습니다.';
 const fresh=p.freshMods[0];if(fresh)return `${RESEARCH[fresh].name} 연구 완료 · 해당 총의 첫 개조 후보에서 시험하세요.`;
 if(!p.firstReport)return '첫 전투 보고 · 50처치 또는 구출 성과를 남기면 최초 100C 보너스';
 if(!p.firstClear.breakwater)return '지휘전차 첫 격파 · 완주 수당과 첫 완주 200C 보너스';
 const available=Object.entries(RESEARCH).find(([id,r])=>!p.researched.includes(id)&&researchReady(p,id));
 if(available)return `${available[1].name} 연구 · ${available[1].cost}C로 새 개조 후보를 여세요.`;
 const order=ORDERS.find(o=>!p.orders.includes(o.id));if(order)return `${order.title} · ${order.desc} · 최초 ${order.reward}C`;
 if(!p.achievements.includes('rescue-all'))return '구조 훈장 · 포로 5명을 모두 구출하고 작전을 완주하세요.';
 return '다른 대원·과밀 도전 · 완성한 빌드로 더 높은 작전 기록을 노려보세요.';
}
function operationMarkup(p){
 const h=HEROES[p.selectedHero],record=p.records[`${RULESET}:breakwater:${p.difficulty}:${p.selectedHero}`];
 return `<div class="operation-layout"><section class="mission-brief"><span class="mission-stamp">MISSION 01 <i>BREAKWATER</i></span><h1>교두보 탈환</h1><p>해안 → 철도 → 항구. 세 미션을 돌파하라.<br>클리어 뒤 더 싸울지, 다음 맵으로 갈지 결정하라.</p><div class="operation-stats"><div><span>작전</span><b>세 전선 돌파</b></div><div><span>최고 점수</span><b>${(record?.score||0).toLocaleString()}</b></div><div><span>최고 기록</span><b>${record?.bestTime!=null?fmt(record.bestTime):'미완주'}</b></div></div><ol class="frontline-steps"><li><b>01</b><span>해안 침투<small>돌진을 피하고 후면 엔진 공략</small></span></li><li><b>02</b><span>철도 보급선<small>포대 제거 · 안전 통로 확보</small></span></li><li><b>03</b><span>항구 총공세<small>부위 파괴 뒤 노출 코어 집중</small></span></li></ol><div class="difficulty"><button data-difficulty="normal" class="${p.difficulty==='normal'?'selected':''}" ${p.activeRun?'disabled':''}>일반 작전</button><button data-difficulty="dense" class="${p.difficulty==='dense'?'selected':''}" ${!p.firstClear.breakwater||p.activeRun?'disabled':''}>${p.firstClear.breakwater?'과밀 · 수당 +15%':'과밀 · 첫 완주 해금'}</button></div></section><div class="hangar-stage"><span class="hangar-caption">FORWARD HANGAR <b>04</b><small>노획 병기 정비 중 / 출격 준비</small></span><section class="operator-stage"><canvas data-portrait="${p.selectedHero}" aria-label="${h.name} 출전 모습"></canvas><div class="operator-info"><span class="english-name">${h.english}</span><h2>${h.name}</h2><p>${h.detail}</p><div class="starter">${weaponIcon(h.weapon)}<div><span>STARTING ARMS</span><b>${WEAPONS[h.weapon].name}</b><small>${h.skill}</small></div></div><div class="hero-toggle">${Object.entries(HEROES).map(([id,h])=>`<button data-hero="${id}" class="${p.selectedHero===id?'selected':''}" ${p.activeRun?'disabled':''}>${h.name}</button>`).join('')}</div></div></section><div class="recipe-rack" aria-label="전장에서 만들 수 있는 합체">${Object.keys(UNIONS).map(id=>`<div class="${p.progress.fusions.includes(id)?'discovered':''}">${weaponIcon(id)}<b>${p.progress.fusions.includes(id)?'✓ ':''}${WEAPONS[id].short}</b><small>${WEAPONS[id].name}</small></div>`).join('')}</div></div></div>`;
}
function personnelMarkup(p){return `<div class="panel-heading"><div><span class="eyebrow">PERSONNEL</span><h2>같은 전장, 다른 돌파.</h2><p>출전 총과 고유 운용은 시작부터 다릅니다. 기초 훈련은 두 대원에게 공통 적용됩니다.</p></div></div><div class="personnel-grid">${Object.entries(HEROES).map(([id,h])=>`<section class="personnel-card ${p.selectedHero===id?'selected':''}"><canvas data-portrait="${id}" aria-label="${h.name}"></canvas><div><span class="eyebrow">${h.english}</span><h3>${h.name}</h3><p>${h.detail}</p><button class="secondary" data-hero="${id}" ${p.activeRun?'disabled':''}>${p.selectedHero===id?'출전 대원':'선택'}</button></div></section>`).join('')}</div><div class="doctrine-row">${DOCTRINES[p.selectedHero].map(d=>`<button data-doctrine="${d.id}" class="${p.doctrines[p.selectedHero]===d.id?'selected':''}" ${p.activeRun||!doctrineReady(p,p.selectedHero,d.id)?'disabled':''}><b>${d.name} 교범</b><small>${d.desc}${doctrineReady(p,p.selectedHero,d.id)?'':`<br>해금: ${d.locked}`}</small></button>`).join('')}</div><div class="orders-board">${ORDERS.map(o=>`<article><b>${p.orders.includes(o.id)?"✓ ":""}${o.title}</b><small>${o.desc}</small><span>${p.orders.includes(o.id)?"지급 완료":`최초 +${o.reward}C`}</span></article>`).join("")}</div><div class="records-strip"><span>P 숙련 기록<b>${p.progress.pMastery?'완료':'P 3단계 달성'}</b></span><span>H 누적 처치<b>${p.progress.weaponKills.h}/200</b></span><span>R 누적 처치<b>${p.progress.weaponKills.r}/100</b></span><span>S 누적 처치<b>${p.progress.weaponKills.s}/150</b></span><span>F 누적 처치<b>${p.progress.weaponKills.f}/150</b></span><span>피오 강화 처치<b>${p.progress.overdriveKills}/300</b></span></div>`;}
function researchMarkup(p){return `<div class="panel-heading"><div><span class="eyebrow">ARMORY / RESEARCH</span><h2>다음 판에 시도할 한 수.</h2><p>연구는 영구 해금입니다. 해당 총을 얻고, 전장에서 개조를 선택해야 작동합니다.</p></div></div><div class="research-grid">${Object.entries(RESEARCH).map(([id,r])=>{const owned=p.researched.includes(id),ready=researchReady(p,id);return `<section class="research-card ${owned?'owned':''}"><span class="eyebrow">${owned?'RESEARCH COMPLETE':'FIELD MODIFICATION'}</span><div class="weapon-letter">${weaponIcon(r.weapon)}<b>${r.weapon.toUpperCase()}</b></div><h3>${r.name}</h3><p>${r.desc}</p><small>${owned?(p.freshMods.includes(id)?'다음 적합한 전용 후보에 첫 체험 제공':'전장 개조 후보로 사용 가능'):ready?'연구 조건 달성':`${r.requirement}${id==='h-ricochet'?` · ${p.progress.weaponKills.h}/200`:id==='r-incendiary'?` · ${p.progress.weaponKills.r}/100`:['s-flechette','f-catalyst'].includes(id)?` · ${p.progress.weaponKills[r.weapon]}/150`:id==='r-conductor'?` · ${p.progress.weaponKills.r}/300`:''}`}</small><button data-research="${id}" ${owned||!ready||p.wallet<r.cost||p.activeRun?'disabled':''}>${owned?'연구 완료':!ready?'조건 필요':'연구하기'}<span>${owned?'✓':`${r.cost}C`}</span></button></section>`;}).join('')}</div>`;}
function trainingMarkup(p){const total=Object.values(p.training).flatMap(e=>e.paid).reduce((a,b)=>a+b,0);return `<div class="panel-heading"><div><span class="eyebrow">TRAINING GROUND</span><h2>다음 시도를 조금 더 단단하게.</h2><p>상한이 있는 기초 보정입니다. 큰 화력은 매판 전장에서 완성하세요.</p></div><button class="secondary" data-action="refund" ${!total||p.activeRun?'disabled':''}>훈련 환불 · ${total}C</button></div><div class="training-list">${Object.entries(TRAINING).map(([id,t])=>{const e=p.training[id],cost=t.prices[e.rank];return `<section class="training-row"><div><h3>${t.name}</h3><small>${t.unit}</small></div><p>${t.desc}</p><div class="rank-dots" aria-label="${e.rank}/${t.prices.length}단계">${t.prices.map((_,i)=>`<i class="${i<e.rank?'filled':''}"></i>`).join('')}</div><button data-training="${id}" data-rank="${e.rank}" ${cost==null||p.wallet<cost||p.activeRun?'disabled':''}>${cost==null?'훈련 완료':`${cost}C · 훈련`}</button></section>`;}).join('')}</div><div class="records-strip"><span>최대 HP<b>${Math.round(100*(1+p.training.vitality.rank*.05))}</b></span><span>무기 피해<b>+${p.training.firepower.rank*3}%</b></span><span>새 판 리롤<b>${1+p.training.reroll.rank}회</b></span><span>환불<b>실지불액 100%</b></span></div>`;}
function showLobby(focusTab=false){
 mode='lobby';keys.clear();controls.reset();mapOpen=false;lastPhase='';const p=profile();
 const descriptor={id:'preview',sequence:0,hero:p.selectedHero,difficulty:'normal',seed:17,snapshot:{training:{},researched:[],freshMods:[],doctrine:p.doctrines[p.selectedHero]}};preview=createMission(descriptor);
 const labels={operation:'작전실',personnel:'병영',research:'무기고',training:'훈련장'};
 setPanel(`<section class="lobby"><header class="lobby-header"><div class="brand-lockup"><div class="brand-symbol" aria-hidden="true">PF</div><div><span class="eyebrow">OPERATION BREAKWATER</span><strong>전선 격납고</strong></div></div><div class="wallet"><strong>${p.wallet.toLocaleString()} <small style="display:inline;font-size:12px">C</small></strong><small>보급 크레딧 · 기지 저장</small></div></header><nav class="lobby-nav" role="tablist" aria-label="기지 준비">${Object.entries(labels).map(([id,name],i)=>`<button role="tab" data-tab="${id}" aria-selected="${id===tab}" aria-controls="lobby-panel" tabindex="${id===tab?0:-1}"><i aria-hidden="true">0${i+1}</i>${name}</button>`).join('')}</nav><div class="lobby-content" role="tabpanel" id="lobby-panel" tabindex="-1">${tab==='operation'?operationMarkup(p):tab==='personnel'?personnelMarkup(p):tab==='research'?researchMarkup(p):trainingMarkup(p)}</div><footer class="lobby-footer"><div class="next-step"><span>NEXT OBJECTIVE</span><b>${nextGoal(p)}</b>${p.lastReceipt&&!p.activeRun?'<button class="subtle" data-action="last-report">최근 전투 보고서</button>':''}</div><div class="launch-area"><button class="primary" data-action="${p.activeRun?'resume-run':'launch'}">${p.activeRun?'저장한 작전 이어하기':`${HEROES[p.selectedHero].name}로 출격`} →</button>${p.activeRun?'<button class="secondary" data-action="retreat-saved">확보분 정산하고 귀환</button>':`<small>${isTouch()?'왼손 이동 · 오른손 회피 / 전술기':'WASD 이동 · SPACE 회피 · E 전술기 · F 상호작용'}</small>`}</div></footer>${settings()}</section>`);
 ui.querySelectorAll('[data-portrait]').forEach(canvas=>operatorPortrait(canvas,art,canvas.dataset.portrait,tab==='personnel'?145:210));
 if(focusTab)ui.querySelector(`[data-tab="${tab}"]`)?.focus();
}
function startMission(seed){
 const p=profile();if(p.activeRun){resumeSaved();return;}const started=beginRun(p,{seed:seed??crypto.getRandomValues(new Uint32Array(1))[0]});if(!started.ok){announce(started.reason);return;}
 const candidate=createMission(started.descriptor);started.profile.activeRun.checkpoint=packMission(candidate);
 commit(started.profile,()=>{run=candidate;enterBattle();});
}
function enterBattle(){mode='battle';lastPhase='';saveClock=0;keys.clear();controls.reset();mapOpen=false;ui.innerHTML='';ui.classList.remove('modal');if(profile().settings.sound)audio.unlock();syncPhase();}
function resumeSaved(){const active=profile().activeRun;if(!active)return;try{run=active.checkpoint?restoreMission(active.checkpoint):createMission(active);if(run.phase==='playing')pauseMission(run);enterBattle();}catch(error){const updated=active.rules!==RULESET;setPanel(`<section class="save-sheet" role="dialog" aria-modal="true"><span class="eyebrow">${updated?'OPERATION UPDATED':'CHECKPOINT RECOVERY'}</span><h2>${updated?'새 전선 작전으로 업데이트됐습니다.':'작전 저장을 복구할 수 없습니다.'}</h2><p>기지의 재화·구매 기록은 유지됩니다. ${updated?'이전 규칙의 전투 성과를 정산하고 세 전선 작전을 시작하세요.':'마지막으로 저장한 성과를 정산하고 새 작전을 시작하세요.'}</p><button class="primary" data-action="recover-run">저장 성과 정산 · 기지로</button></section>`,true);}}
function finishRun(){
 const result=settleRun(profile(),run);if(!result.ok){announce(result.reason);return;}commit(result.profile,()=>showResult(result.receipt));
}
function showResult(receipt){
 if(!receipt){showLobby();return;}mode='result';keys.clear();controls.reset();const r=receipt.result,a=receipt.award,h=HEROES[receipt.hero];
 const lines=[...(a.orders||[]).map(o=>[o.title,o.credits]),['처치 수당',a.components.kills],['전선 돌파',a.components.midbosses||0],['정예·구출·거점',a.components.elites+a.components.rescues+a.components.outposts],['보스 부위 파괴',a.components.armorBreaks],['완주 수당',a.components.clear],...(a.oneTime.report?[['첫 전투 보고',a.oneTime.report]]:[]),...(a.oneTime.clear?[['첫 작전 완주',a.oneTime.clear]]:[])];
 setPanel(`<section class="result-sheet" role="dialog" aria-modal="true" aria-labelledby="result-title"><span class="eyebrow">${r.won?'MISSION COMPLETE':'MISSION REPORT'}</span><h2 id="result-title">${r.won?'교두보를 탈환했습니다.':r.reason==='retreat'?'확보한 성과로, 다시 준비.':'이번 전투는 여기까지.'}</h2><p>${h.name} · ${fmt(r.seconds)} · ${r.won?`${a.grade}등급 / `:'작전 미완료 · '}${a.score.toLocaleString()}점${receipt.record?.newBest?' · ★ 최고 점수 갱신':''}</p><div class="result-overview"><div><b>${r.stats.kills}</b><span>일반 적 처치</span></div><div><b>${r.stats.rescues}/5</b><span>포로 구출</span></div><div><b>${r.stats.midbosses||0}/2</b><span>중간 보스 격파</span></div></div><div class="receipt-lines">${lines.filter(([,n])=>n>0).map(([name,n])=>`<span>${name}</span><b>+${n}C</b>`).join('')}${a.multiplier>1?`<span>과밀 수당</span><b>반복분 ×1.15</b>`:''}<span>지급 후 보유</span><b>${receipt.balance}C</b></div><div class="receipt-total"><span>이번 획득</span><strong>+${a.totalCredits}C</strong></div><p class="run-build">${(r.stats.supplyPicks||[]).map(id=>({assault:"관통 탄두",fusion:"합체 조립선",armor:"기갑 지원",barrage:"지원 포격",repair:"정비반",requisition:"시험 개조",silence:"포격 교란",plunder:"시험 탄약"})[id]).join(" → ")||"다음 판에는 전술 보급을 확보하세요."}<br>진화·합체 후 ${r.stats.evolvedKills||0}처치<br>잔류 ${fmt(r.stats.holdoutSeconds||0)} · 위험 ${r.stats.bestDanger||0} · 추가 ${(r.stats.holdoutScore||0).toLocaleString()}점</p><p class="result-next">${receipt.newly.includes('marco-fan')?'산개 교범 해금 · 병영에서 마르코의 새 전술을 고를 수 있습니다.':receipt.newly.includes('fio-quick')?'신속 교범 해금 · 병영에서 피오의 새 전술을 고를 수 있습니다.':nextGoal(profile())}</p><div class="result-buttons"><button class="primary" data-action="lobby">기지에서 정비 →</button><button class="secondary" data-action="relaunch">같은 대원 재출격</button></div></section>`,true);
}
function choiceArtwork(c){const id=c.recipe||c.weapon||RESEARCH[c.mod]?.weapon||run.weapons[c.slot]?.id||({armor:'tank',repair:'med',fusion:'v',barrage:'r',requisition:'gear',vitality:'med',tempo:'gear',magnet:'gear',power:'h',projectile:'r'})[c.key]||run.weapons[0].id;return weaponIcon(id);}
function choiceDetail(c){
 if(c.kind==='weapon-offer')return '다음 선택에서 주무기 / 지원무기 교체 위치 지정';
 if(c.kind==='union')return `${WEAPONS[c.recipe||'u'].short} · 핵심 1개 소비 · 개조 계승`;
 if(c.kind==='rank'){const w=run.weapons[c.slot];return `${WEAPONS[w.id].short} ${w.rank}/3 → ${w.rank+1}/3`;}if(c.kind==='evolve')return '숙련 3/3 → 진화 · 핵심 1개 소비';
 if(c.kind==='weapon'){const old=run.weapons[c.slot];const hint=Object.entries(UNIONS).find(([,u])=>u.parts.includes(c.weapon)&&u.parts.some(id=>run.weapons.some(w=>w?.id===id)));return `${old?`${WEAPONS[old.id].short} 교체 · 투자 초기화`:'빈 지원 슬롯에 장착'}${hint?` · ${WEAPONS[hint[0]].short} 합체 경로`:''}`;}
 return c.kind==='mod'?'이번 판 장착 · 기지 연구는 유지':'이번 작전의 다음 전선까지 유지';
}
function showChoices(){
 if(run.choiceType==='route'){showRoute();return;}
 const level=run.choiceType==='level',tactic=run.choiceType==='tactic',replace=run.choiceType==='replace';setPanel(`<section class="supply-sheet" role="dialog" aria-modal="true" aria-labelledby="choice-title"><header class="modal-head"><div><span class="supply-stamp">${level?'LEVEL UP':replace?'LOADOUT':tactic?'BOSS CLEAR':'SUPPLY DROP'}</span><h2 id="choice-title">${level?'화력을 선택하라':replace?'교체할 무장을 선택':tactic?'전술 보급 도착':'보급품 확보'}</h2><p>${level?`LEVEL ${run.level} · 보유 무기 강화 또는 연구 개조`:run.choiceSite}</p></div><span class="paused-label">Ⅱ 전투 정지</span></header><div class="upgrade-grid">${run.choices.map((c,i)=>`<button class="upgrade-card ${['evolve','union'].includes(c.kind)?'capstone':''} type-${c.kind}" data-choice="${c.id}"><div class="crate-top"><span>${c.label}</span><kbd>${i+1}</kbd></div><div class="crate-art">${choiceArtwork(c)}</div><h3>${c.title}</h3><p>${c.desc}</p><small class="choice-detail">${choiceDetail(c)}</small><div class="crate-select"><span>${c.kind==='weapon'?'EQUIP':c.kind==='union'?'FUSION':c.kind==='mod'?'INSTALL':'SELECT'}</span><b>선택 →</b></div></button>`).join('')}</div><footer class="modal-foot"><span>${level?'새 총은 전장 보급에서 확보':tactic?'보급 선택 뒤 다음 맵 진입 / 현 전장 잔류를 결정':`포로 ${run.stats.rescues}/5 · 진화 핵심 ${run.cores}개`}<br>${buildSynergies(run.weapons).join(' / ')||'P+S 관통 파쇄 · H+R 미사일 · F+R 네이팜'}</span>${level?`<button class="secondary" data-action="reroll" ${run.rerolls<=0?'disabled':''}>리롤 ${run.rerolls}회</button>`:'<span class="key-guide">1 / 2 / 3 · 카드 선택</span>'}</footer></section>`,true);
}
function showRoute(){setPanel(routeMarkup(run),true);regionPreview($('route-preview'),art,run.front<2?run.front+1:run.front);}
function showPause(){setPanel(`<section class="pause-sheet" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">OPERATION PAUSED</span><h2 id="pause-title">전선은 기다립니다.</h2><p>해안 → 철도 보급선 → 항구의 지휘전차를 돌파하세요.<br>보스를 잡으면 출구가 열립니다. 잔류하면 20초마다 적과 점수가 강화됩니다.<br>${isTouch()?'왼쪽 스틱 이동 · 회피 / 전술기 · 상황 버튼':'WASD 이동 · SPACE 회피 · E 전술기 · F 상호작용'}</p><button class="primary" data-action="continue">전투 이어하기 →</button>${settings()}<div class="pause-actions"><button class="secondary" data-action="map">전술 지도 · 목표 선택</button><button class="secondary" data-action="keep-lobby">작전 저장 · 기지 보기</button><button class="secondary" data-action="retreat">확보분 정산 · 귀환</button></div></section>`,true);}
function showMap(){setPanel(`<section class="target-sheet" role="dialog" aria-modal="true" aria-labelledby="map-title"><header class="modal-head"><div><span class="eyebrow">TACTICAL MAP</span><h2 id="map-title">다음 돌파 지점을 고르세요.</h2></div></header><div class="target-grid">${run.sites.map(n=>`<button data-target="${n.id}"><b>${n.state==='done'?'✓ ':''}${n.name}</b><span>${n.tip}<br>${Math.round(Math.hypot(n.x-run.player.x,n.y-run.player.y)/10)}m · ${n.state==='done'?'확보 완료':n.state==='ready'?'보급 준비':'접근 가능'}</span></button>`).join('')}</div><button class="secondary" data-action="continue">전투로 돌아가기</button></section>`,true);}
function syncPhase(){
 if(mode!=='battle')return;
 if(run.phase===lastPhase)return;lastPhase=run.phase;
 if(run.phase==='result'){finishRun();return;}
 if(run.phase==='choice'){checkpoint(showChoices);return;}
 if(run.phase==='paused'){checkpoint(()=>mapOpen?showMap():showPause());return;}
 ui.innerHTML='';ui.classList.remove('modal');
}
function pause(){if(mode!=='battle')return;if(run.phase==='paused'){mapOpen=false;resumeMission(run);if(profile().settings.sound)audio.unlock();lastPhase='';syncPhase();}else if(pauseMission(run)){keys.clear();syncPhase();}}
function updateCombat(){
 document.body.classList.toggle('lobby-mode',mode==='lobby');
 const battle=mode==='battle';for(const id of ['combat-hud','combat-map','combat-objective','combat-loadout','mission-actions'])$(id).hidden=!battle;
 const active=battle&&run.phase==='playing';$('mission-stick').hidden=!active||!isTouch();$('combat-combo').hidden=!active||run.combo<8;const isBoss=battle&&run.boss.active;$('boss-panel').hidden=!isBoss;document.body.classList.toggle('boss-active',isBoss);if(!battle){$('mission-interact').hidden=true;return;}
 const p=run.player,h=HEROES[run.hero];$('combat-hero').textContent=h.name;$('combat-level').textContent=`LV.${run.level}`;$('combat-hp-fill').style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;$('combat-hp').textContent=`대원 ${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;$('combat-slug').hidden=!p.slug;$('combat-armor-fill').style.width=`${Math.max(0,p.slugHp/(run.tactics.includes('armor')?160:120)*100)}%`;$('combat-armor').textContent=`${Math.ceil(p.slugHp)} / ${run.tactics.includes('armor')?160:120}`;
 $('combat-trait').textContent=run.hero==='marco'?`집중 ${Math.floor(p.focus)}/3 · 약점 관통`:p.overdrive>0?`강화 탄창 ${p.overdrive.toFixed(1)}초`:`보급 충전 ${Math.floor(p.charge)}%`;
 $('combat-stage').textContent=run.cleared?`MISSION 0${run.front+1} CLEAR`:isBoss?FRONTS[run.front].boss:`${run.front+1}/3 ${FRONTS[run.front].name}`;$('combat-time').textContent=fmt(run.t);$('combat-kills').textContent=`${run.stats.kills} 처치`;
 $('combat-score').textContent=`${missionScore(run).toLocaleString()}점${run.cleared?` · 위험 ${holdoutDanger(run)}`:''}`;
 $('combat-credits').textContent=`확보 ${calculateSettlement({...run.stats,rules:run.rules}).repeatCredits}C`;$('combat-combo').textContent=`${run.combo} 연속 처치`;
 const b=run.boss;$('boss-name').textContent=FRONTS[run.front].boss;$('combat-objective').querySelector('span').textContent=run.cleared?`클리어 · 잔류 위험 ${holdoutDanger(run)} / 다음 증원 ${Math.ceil(20-run.holdoutTime%20)}초`:`${run.front+1}/3 · ${FRONTS[run.front].brief}`;$('boss-hp-fill').style.width=`${Math.max(0,b.hp/b.maxHp*100)}%`;$('boss-state').textContent=bossStatus(run);$('boss-parts').textContent=BOSS_GUIDES[run.front].parts.map((label,i)=>`${label} ${b.parts[i].hp<=0?'파괴':'가동'}`).join(' · ');
 let target=run.sites.find(n=>n.id===run.targetId);if(!target||target.state==='done'){target=run.cleared?run.sites.find(n=>n.id==='exit'):isBoss?run.sites.find(n=>n.id==='boss'):run.sites.filter(n=>n.state!=='done'&&n.kind!=='boss').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||run.sites.find(n=>n.id==='boss');run.targetId=target.id;}
 $('target-name').textContent=`${target.name} · ${Math.round(Math.hypot(target.x-p.x,target.y-p.y)/10)}m`;const guards=run.enemies.filter(e=>!e.dead&&e.siteId===target.id).length;$('target-reward').textContent=target.state==='active'?`호위대 ${target.wave}/${target.waves} · 경비 ${guards}명 → ${target.tip}`:target.kind==='exit'?`${(20*(run.front+1)*holdoutDanger(run)).toLocaleString()} 추가점 / 처치 · 출구에서 F로 진입 결정`:target.state==='ready'?'가까이 이동해 보급을 확보하세요':target.tip;
 const weaponKey=JSON.stringify(run.weapons.map(w=>w&&[w.id,w.rank,w.evolved,w.mods]));if($('combat-weapons').dataset.key!==weaponKey){$('combat-weapons').dataset.key=weaponKey;$('combat-weapons').innerHTML=run.weapons.map(w=>w?`<div class="battle-gun">${weaponIcon(w.id)}<b>${WEAPONS[w.id].short} ${w.evolved?'✦':''}</b><small>${UNIONS[w.id]?'최종 합체':`${w.rank}/3 숙련${w.mods.length?' · 연구 개조':''}`}</small></div>`:'<div class="battle-gun empty"><b>지원 무기</b><small>보급에서 확보</small></div>').join('');}
 $('combat-xp').style.width=`${Math.min(100,run.xp/xpNeeded(run)*100)}%`;$('evolution-ready').textContent=run.cores>0&&run.weapons.some(w=>w&&!UNIONS[w.id]&&w.rank===3&&!w.evolved)?`진화 준비 · 다음 성장 선택 · 핵심 ${run.cores}`:run.weapons.some(w=>w?.evolved)?`완성 화력 ${run.stats.evolvedKills}처치 · 전술 지원 ${run.tactics.length}/2`:`진화 핵심 ${run.cores} · XP를 회수해 화력을 키우세요`;
 $('combat-build').textContent=buildSynergies(run.weapons).join(' / ')||Object.entries(UNIONS).filter(([,r])=>r.parts.some(id=>run.weapons.some(w=>w?.id===id))).map(([id,r])=>`${WEAPONS[id].short} ${r.parts.map(part=>`${part.toUpperCase()} ${run.weapons.find(w=>w?.id===part)?.rank??'—'}/3`).join(' + ')}`).slice(0,1).join('')||'합체 완성 · 다른 무기와 연구 조합을 시험하세요';
 $('mission-dash').disabled=!active||p.dashCd>0;$('mission-dash').querySelector('b').textContent=p.slug?'돌파':'회피';$('mission-dash').querySelector('span').textContent=p.dashCd>0?`${p.dashCd.toFixed(1)}초`:'준비';
 $('mission-skill').disabled=!active||p.skillCd>0||(!p.slug&&run.hero==='fio'&&p.charge<60);$('mission-skill').querySelector('b').textContent=p.slug?'주포':h.skill;$('mission-skill').querySelector('span').textContent=p.skillCd>0?`${p.skillCd.toFixed(1)}초`:!p.slug&&run.hero==='fio'&&p.charge<60?`${Math.floor(p.charge)}% / 60%`:'준비';
 const interact=active?interaction(run):null;$('mission-interact').hidden=!interact;if(interact){$('mission-interact').querySelector('b').textContent=interact.title;$('mission-interact').querySelector('span').textContent=interact.detail;}
}
function input(){const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);return x||y?{x,y}:touch;}
function act(action){if(mode!=='battle')return;if(profile().settings.sound)audio.unlock();missionAction(run,action);}
ui.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;const data=button.dataset,p=profile();
 if(data.tab){tab=data.tab;showLobby(true);return;}
 if(data.hero&&HEROES[data.hero]&&!p.activeRun){const next=clone(p);next.selectedHero=data.hero;commit(next,()=>showLobby());return;}
 if(data.difficulty&&!p.activeRun){if(data.difficulty==='dense'&&!p.firstClear.breakwater)return;const next=clone(p);next.difficulty=data.difficulty;commit(next,()=>showLobby());return;}
 if(data.doctrine&&!p.activeRun&&doctrineReady(p,p.selectedHero,data.doctrine)){const next=clone(p);next.doctrines[p.selectedHero]=data.doctrine;commit(next,()=>showLobby());return;}
 if(data.training){if(p.training[data.training]?.rank!==Number(data.rank))return;const result=buyTraining(p,data.training);if(result.ok)commit(result.profile,()=>{showLobby();announce(`${TRAINING[data.training].name} 훈련 완료 · 다음 출격에 적용됩니다.`);});else announce(result.reason);return;}
 if(data.research){const result=buyResearch(p,data.research);if(result.ok)commit(result.profile,()=>{showLobby();announce(`${RESEARCH[data.research].name} 연구 완료 · 다음 적합한 전용 후보에 등장합니다.`);});else announce(result.reason);return;}
 if(data.choice){if(chooseMission(run,data.choice)){lastPhase='';if(run.phase==='result')syncPhase();else checkpoint(syncPhase);}return;}
 if(data.target){run.targetId=data.target;mapOpen=false;resumeMission(run);lastPhase='';checkpoint(syncPhase);return;}
 const action=data.action;
 if(action==='launch'){startMission();return;}
 if(action==='relaunch'){const next=clone(p);next.selectedHero=p.lastReceipt?.hero||p.selectedHero;commit(next,()=>startMission());return;}
 if(action==='last-report'){showResult(p.lastReceipt);return;}
 if(action==='resume-run'){resumeSaved();return;}
 if(action==='recover-run'){const recovered=recoverActiveRun(p);if(recovered.ok)commit(recovered.profile,()=>showResult(recovered.receipt));else announce(recovered.reason);return;}
 if(action==='lobby'){tab='operation';showLobby();return;}
 if(action==='refund'){const result=refundTraining(p);if(result.ok)commit(result.profile,()=>{showLobby();announce(`훈련 비용 ${result.amount}C를 환불했습니다.`);});return;}
 if(action==='retry-save'&&pendingSave){const pending=pendingSave,result=store.commit(pending.next);if(result.ok){pendingSave=null;mode=pending.mode;pending.after();if(mode==='battle'){lastPhase='';syncPhase();}}else announce(result.reason);return;}
 if(action==='continue'){mapOpen=false;resumeMission(run);if(p.settings.sound)audio.unlock();lastPhase='';syncPhase();return;}
 if(action==='reroll'){if(rerollMission(run))checkpoint(showChoices);return;}
 if(action==='keep-lobby'){checkpoint(()=>showLobby());return;}
 if(action==='map'){mapOpen=true;showMap();return;}
 if(action==='retreat-saved'){const recovered=recoverActiveRun(p,'retreat');if(recovered.ok)commit(recovered.profile,()=>showResult(recovered.receipt));return;}
 if(action==='retreat'){endMission(run,'retreat');finishRun();}
});
ui.addEventListener('change',event=>{const key=event.target.dataset.setting;if(!['sound','reduced'].includes(key))return;const next=clone(profile());next.settings[key]=event.target.checked;commit(next);if(key==='sound'){if(next.settings.sound)audio.unlock();else audio.suspend();}});
$('combat-pause').onclick=pause;$('mission-interact').onclick=()=>act('interact');$('target-map').onclick=()=>{if(mode!=='battle')return;mapOpen=true;if(pauseMission(run)){keys.clear();lastPhase='';syncPhase();}else showMap();};
controls=bindTouchControls({stick:$('mission-stick'),actions:{dash:$('mission-dash'),skill:$('mission-skill')},canPlay:()=>mode==='battle'&&run?.phase==='playing',onMove:v=>{touch=v;},onAction:act,onUnlock:()=>{if(profile()?.settings.sound)audio.unlock();}});
document.addEventListener('keydown',event=>{
 const key=event.key.toLowerCase();
 if(key==='tab'&&ui.classList.contains('modal')){const list=[...ui.querySelectorAll('button:not(:disabled),a,input')],first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;}
 if(event.target.matches('[role="tab"]')&&['arrowleft','arrowright'].includes(key)){event.preventDefault();const tabs=['operation','personnel','research','training'];tab=tabs[(tabs.indexOf(tab)+(key==='arrowright'?1:3))%4];showLobby(true);return;}
 if(event.target instanceof HTMLInputElement)return;
 if(mode!=='battle')return;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();keys.add(key);if(event.repeat)return;
 if(key==='escape'){event.preventDefault();pause();return;}
 if(run.phase==='choice'&&['1','2','3'].includes(key)){ui.querySelectorAll('[data-choice]')[Number(key)-1]?.click();return;}
 if(run.phase!=='playing')return;
 if(key===' ')act('dash');else if(key==='e')act('skill');else if(key==='f')act('interact');else if(key==='m')$('target-map').click();
});
document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
function release(){keys.clear();controls.reset();if(mode==='battle'&&pauseMission(run)){lastPhase='';syncPhase();}}
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();audio.suspend();}});window.addEventListener('resize',()=>{controls.reset();renderer?.resize();});
function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;
 if(mode==='battle'){stepMission(run,dt,input());syncPhase();if(mode==='battle'&&run.phase==='playing'){saveClock+=dt;if(saveClock>=5)checkpoint();}}
 const scene=mode==='lobby'?preview:run||preview;if(scene)renderer.draw(scene,{reduced:profile().settings.reduced,lobby:mode==='lobby',target:scene.targetId||'first'});
 updateCombat();if(run&&mode!=='lobby'){const events=new Set(takeMissionEvents(run));if(profile().settings.sound)for(const event of events)audio.play(event,'acorn',run.weapons.some(w=>w?.evolved));}
 requestAnimationFrame(frame);
}
try{
 let loaded,raw=null;
 try{raw=window.localStorage.getItem(PROFILE_KEY);loaded=parseProfile(raw);}catch(error){
  if(raw)try{window.localStorage.setItem(PROFILE_KEY+'-backup',raw);}catch{}
  announce('기지 기록을 읽지 못했습니다. 저장 공간을 확인해 주세요. 기존 기록의 백업을 시도했습니다.');
 }
 if(loaded?.recoveryNotice){if(raw)try{window.localStorage.setItem(PROFILE_KEY+'-backup',raw);}catch{}announce(loaded.recoveryNotice);}
 const initial=loaded||createProfile(`${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`);if(!loaded)initial.settings.reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 store=createProfileStore({setItem:(key,value)=>window.localStorage.setItem(key,value)},initial);art=await loadMissionArt();renderer=createMissionRenderer($('mission-world'),$('tactical-map'),art);showLobby();requestAnimationFrame(frame);
}catch(error){console.error(error);setPanel('<section class="loading"><span class="eyebrow">LOAD INTERRUPTED</span><h1>작전실을 불러오지 못했습니다.</h1><p>네트워크 또는 브라우저 저장 공간을 확인해 주세요.</p><button class="primary" id="reload-mission">다시 불러오기</button></section>');$('reload-mission').onclick=()=>location.reload();}
