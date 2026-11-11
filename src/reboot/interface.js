import {regionPreview,previewLayout,sitePresentation,siteSymbol} from './field-scene.js';
import {REGIONS,RESEARCH,REQUISITION_FEE,MANEUVERS,FRONT_SUPPORTS,COAST_STRIKES,HOLDOUT,HOLDOUT_CONTRACTS,coastApproach,beachRoute,railGarrison,holdoutParts,SORTIE_ORDERS,sortieOrder,orderBonus,operationCredits} from './campaign.js';
import {GUNS,MODULES,RULES,bearing,distance,makeWeapon,weaponStats,capstoneName} from './content.js';
import {canLaunchOrder,canReserveResearch,marcoRecord} from './profile.js';
import {OPERATORS,operatorOf,operatorId} from './operator.js';
export const escapeHtml=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml,n=v=>(Number(v)||0).toLocaleString();
export const clockText=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const svg=(body,box='0 0 160 100')=>`<svg viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
export function itemArt(id,extra=''){return `<span class="kit-sprite kit-${id} ${extra}" aria-hidden="true"></span>`;}
export function moduleIcon(id){
 const body=({
 medic:'<path d="M26 9h12v17h17v12H38v17H26V38H9V26h17z"/>',
 catalyst:'<path d="M31 4c6 14-2 17 6 23 0-9 8-12 8-12 0 12 11 17 11 28 0 23-47 24-47 0 0-15 18-19 22-39Z"/><path class="icon-cut" d="M32 31c-2 10-11 11-10 19 1 13 23 12 23 0 0-7-7-9-7-15-3 3-2 6-6 7z"/>',
 coil:'<path d="m39 3-25 32h15l-4 26 25-35H35z"/>',
 thermal:'<path d="m38 5-20 29h14l-5 25 23-33H36z"/><path fill="none" stroke="currentColor" stroke-width="3" d="M12 15C0 25 0 42 12 51m43-36c12 10 12 27 0 36"/>',
 ricochet:'<path fill="none" stroke="currentColor" stroke-width="6" d="M7 52 27 32l12 13 17-29m-17 0h17v18"/>',
 magnet:'<path d="M9 9h15v27c0 12 16 12 16 0V9h15v28C55 65 9 65 9 37Z"/><path class="icon-cut" d="M12 19h9v6h-9zm31 0h9v6h-9z"/>',
 shrapnel:'<path d="m26 18 12-8 14 20-12 8zm-8 17 12 16-10 8L7 42zm23 10 10-6 8 14-9 6z"/><path fill="none" stroke="currentColor" stroke-width="4" d="m9 16 7 6M30 2v9m25 2-6 7"/>',
 overcharger:'<path d="M16 14h32v42H16zM25 6h14v7H25z"/><path class="icon-cut" d="m35 19-13 19h9l-3 13 14-20h-9z"/>',
 crate:'<path fill="none" stroke="currentColor" stroke-width="4" d="M9 16h46v40H9zm0 12h46M20 16v40m24-40v40"/>',
 route:'<path fill="none" stroke="currentColor" stroke-width="5" d="M8 48h16V30h18V12h14m-9-5 9 5-8 8"/>',
 stay:'<path fill="none" stroke="currentColor" stroke-width="4" d="M15 24V13h11m12 0h11v11m0 16v11H38m-12 0H15V40"/><path d="m32 22 10 10-10 10-10-10z"/>',
 extract:'<path fill="none" stroke="currentColor" stroke-width="4" d="M29 10H12v44h17M23 32h29m-10-10 10 10-10 10"/>',
 archive:'<path fill="none" stroke="currentColor" stroke-width="4" d="M15 7h27l9 10v41H15zm10 17h18M25 35h18M25 46h12"/>',
 gear:'<path fill="none" stroke="currentColor" stroke-width="5" d="M23 9h18l3 9 9 4v19l-9 3-3 10H23l-3-10-10-3V22l10-4z"/><circle cx="32" cy="32" r="9" fill="none" stroke="currentColor" stroke-width="4"/>'
 })[id]||'<path fill="none" stroke="currentColor" stroke-width="5" d="M12 32h40m-15-15 15 15-15 15"/>';
 return svg(`<g fill="currentColor">${body}</g>`,'0 0 64 64');
}
export const readyResearch=p=>Object.entries(RESEARCH).filter(([id,d])=>!p.active&&!p.research.includes(id)&&p.milestones[id]&&p.credits>=d.cost);
export function nextOrder(p){
 if(p.trials.length){const first=RESEARCH[p.trials[0]];return{title:'새 연구를 실전에',text:p.trials.length===1?first.fieldBrief:`${p.trials.map(id=>RESEARCH[id].name).join(' / ')} 실전 배치 대기`,target:'research',label:'실전 배치 지령'};}
 const available=readyResearch(p);if(available.length)return{title:`${available[0][1].name} 연구 가능`,text:`${available[0][1].cost}C로 다음 작전에 새로운 모듈 후보를 여세요.`,target:'research',label:'병기 연구실로'};
 if(!p.records.wins)return{title:'첫 작전을 완수하라',text:'세 전선의 보스를 격파하고 살아서 귀환하세요. 첫 완주에는 추가 200C가 지급됩니다.',target:'weapons',label:'성장 경로 보기'};
 if(!p.milestones.shrapnel)return{title:'다음은 전도 합체',text:'H+R 전도 합체로 보스를 격파해 분열 수류탄 연구를 여세요.',target:'weapons',label:'합체 조건 보기'};
 if(!p.milestones.thermal)return{title:'인페르노를 실증하라',text:'진화한 F로 보스를 격파해 흡열 코일 연구를 여세요.',target:'weapons',label:'진화 조건 보기'};
 if(p.research.some(id=>canReserveResearch(p,id)))return{title:'다음 항구전의 장비를 골라라',text:'연구 모듈 하나를 철도 정비대에 예약하고 현장에서 장착하세요.',target:'research',label:'정비대 예약'};
 return{title:'기록에 도전하라',text:'다른 빌드로 더 빠르게 돌파하거나, 잔류 도전에서 최고 단계를 올리세요.',target:'archive',label:'내 전투 기록'};
}
const briefCopy=[
 {terrain:'열린 해변과 벙커 우회로',supply:'구조 보급 · 이동 보급대',tactic:'돌진을 옆으로 피하고 후면 엔진을 노려라.'},
 {terrain:'화차 사이의 측면 통로',supply:'중계기 해킹 · 선로 정비창',tactic:'포격 차선을 피하고 양쪽 포대를 파괴하라.'},
 {terrain:'컨테이너 길목과 하역장',supply:'관제소 교란 · 시험 병기',tactic:'부위를 파괴한 뒤 노출된 코어에 집중하라.'}
];
function operationMap(selected,seed,order){const map=previewLayout(seed,selected,order);
 return `<div class="operation-chart"><nav class="sector-selector" aria-label="전선 브리핑">${REGIONS.map((d,i)=>`<button class="sector-pin ${selected===i?'selected':''}" data-brief="${i}" aria-pressed="${selected===i}" aria-label="${d.name} 브리핑 보기"><span>${`0${i+1}`}</span><b>${d.name}</b><small>${i===0?'해안 교두보':i===1?'물자 수송로':'지휘 병기'}</small></button>`).join('')}</nav><div class="field-chart">${regionPreview(selected,seed,null,order)}<span class="chart-direction">N ↑</span><div class="chart-legend"><strong>${REGIONS[selected].name}</strong><span class="chart-key"><i></i>투입 지점</span><span class="chart-key boss"><i></i>보스 진입</span>${map.sites.map(n=>`<span class="chart-site ${n.state==='done'?'done':''}"><svg viewBox="-30 -30 60 60" aria-hidden="true">${siteSymbol(n,0,0,21)}</svg><span>${sitePresentation(n).name}${n.state==='done'?'<small>확보 완료</small>':''}</span></span>`).join('')}</div></div></div>`;
}

function coastPlan(seed,order){
 const {sites}=previewLayout(seed,0,order),rescue=sites.find(site=>site.opening);
 const stops=sites.filter(site=>site.coastApproach).map(site=>{
  const id=site.coastApproach,approach=coastApproach(site);
  return `<li data-coast="${id}"><span class="coast-plan-mark">${GUNS[id].short}</span><div><strong>${approach.name}</strong><span>${bearing(rescue,site.x,site.y)} 약 ${Math.round(distance(rescue,site)/10)}m · ${approach.formation}</span><small>${MODULES[approach.module].name} 후보</small></div></li>`;
 }).join('');
 return `<section class="coast-plan" aria-label="해안 첫 보급"><header><b>포로 구출 → F / R 선택</b><span>${beachRoute(seed).name}</span></header><ul>${stops}</ul></section>`;
}

function frontIntel(index,seed){
 const rail=index===1?previewLayout(seed,index).sites.slice(0,2).map(railGarrison):null;
 const [cache,order,task]=rail?[`화차 정비대 · ${rail[0].name}`,`통신 중계기 · ${rail[1].name}`,`${rail[1].crew} 제압 후 해킹 · 포대 공략`]:['해치 · 측면 기습','관제소 · 전술 선택','첫 장갑탄 교란 또는 화력 전술'];
 return `<div class="front-intel"><div class="front-intel-heading"><span>투입 지점의 두 갈래</span><strong>${REGIONS[index].boss}</strong></div><div class="front-intel-stop"><span>${cache}</span><b>${index===1?'장착 무장 강화 · 완성 병기 개장':'방패와 박격포 제압 · 포탑 측면 진입'}</b></div><div class="front-intel-stop"><span>${order}</span><b>${task}</b></div></div>`;
}

function launchDock(profile,id,operator,requisition,plan){
 const actor=OPERATORS[operator];
 const order=sortieOrder(id),request=RESEARCH[requisition];
 const title=request?`철도 예약 · ${request.name}`:order?`지령 · ${order.name}`:'첫 목표 · 포로 구출';
 const briefing=request?`출격 시 −${REQUISITION_FEE}C · 철도 화차 정비대에서 선택 · ${request.fitting}`:order?`${order.fee}C 선납 · 목표 확보 후 최종 귀환 +${order.bonus}C`:'포로를 구출해 화염방사기나 로켓을 확보하세요.';
 const note=!plan||order||request?`<div class="launch-note"><b>${title}</b><small>${briefing}</small>${request?'<button class="text-button cancel-requisition" data-reserve="">예약 취소</button>':''}</div>`:'';
 const label=`${actor.name} · ${request?'예약 출격':order?'지령 출격':'새 출격'}`;
 const action=profile.active?`<span>${label}<small class="launch-checkpoint">이전 판 정산 후 시작</small></span>`:label;
 return `<div class="launch-dock${plan?' has-coast-plan':''}"><div class="launch-briefing">${plan}${note}</div><div class="launch-controls">${operatorSelector(operator)}<button class="primary launch-button" data-action="launch"${order?` data-sortie="${id}"`:request?` data-requisition="${requisition}"`:''}>${action}<span aria-hidden="true">▶</span></button></div></div>`;
}
function orderOptions(p,selected,operator,reserved){
 if(!p.records.wins||p.active)return '';
 const cards=Object.entries(SORTIE_ORDERS).map(([id,order])=>{
  const record=(operator==='marco'?marcoRecord(p)?.orders:p.orderRecords)?.[id],short=Math.max(0,order.fee-p.credits);
  return `<button type="button" class="order-slip" data-order="${id}" aria-pressed="${id===selected}" ${short?'disabled':''}><span class="order-stamp" aria-hidden="true">${moduleIcon(id==='wire'?'coil':'route')}</span><span class="order-copy"><strong>${order.name}</strong><small>${order.action}</small><small>${short?`${short}C 부족`:record?.scope===p.recordScope?`최단 ${clockText(record.time)} · 최고 ${n(record.score)}점`:`${order.fee}C 선납 · 귀환 시 +${order.bonus}C`}</small></span></button>`;
 }).join('');
 return `<section class="sortie-orders" aria-labelledby="orders-title"><header><div><span class="section-index">${reserved?'선택하면 철도 예약을 취소합니다.':'해안 · 선택 목표'}</span><h2 id="orders-title">추가 작전 지령</h2></div>${selected?'<button class="text-button" data-order="">표준 작전으로</button>':''}</header><div class="order-options">${cards}</div></section>`;
}

function operatorSelector(operator){
 return `<div class="operator-selector" role="group" aria-label="출전 대원 선택">${Object.entries(OPERATORS).map(([id,d])=>`<button data-pilot="${id}" aria-pressed="${id===operator}"><span>${d.short}</span><b>${d.name}</b><small>${d.skill}</small></button>`).join('')}</div>`;
}
function missionPanel(p,brief,previewSeed,requested,operator,requisition){const actor=OPERATORS[operator],order=canLaunchOrder(p,requested)?requested:null,reserved=!order&&canReserveResearch(p,requisition)?requisition:null,selected=brief??0,d=REGIONS[selected],copy=briefCopy[selected],goal=nextOrder(p),weapons=[makeWeapon('h')];
 return `<div class="mission-layout"><section class="mission-board"><header class="board-heading"><div><span class="section-index">작전 지령</span><h1>시험 병기 수송을 차단하라</h1></div></header>${launchDock(p,order,operator,reserved,selected===0?coastPlan(previewSeed,order):'')}${orderOptions(p,order,operator,reserved)}${operationMap(selected,previewSeed,order)}${selected?frontIntel(selected,previewSeed):''}<div class="sector-brief"><div><span class="sector-number">0${selected+1}</span><div><h2>${d.name}</h2><p>${copy.terrain} · ${copy.supply}</p></div></div><p class="tactic"><b>${d.boss}</b>${copy.tactic}</p></div><p class="brief-contract"><b>잔류 · ${HOLDOUT_CONTRACTS[selected].name}</b><span>${HOLDOUT_CONTRACTS[selected].goal}${selected<2?` + 증원 ${HOLDOUT.rareKills}명 제압`:''}</span></p></section><aside class="deployment"><section class="operator-station" data-operator="${operator}"><div class="operator-heading"><span>출전 대원</span><h2>${actor.name}</h2><b>${actor.skill}</b></div><canvas class="portrait" id="portrait" aria-label="${actor.name} 출격 준비 모습"></canvas><div class="operator-platform"></div><div class="starting-kit"><span>시작 무장</span><div>${weapons.map(w=>`<b>${e(w.fusion?`${w.id.toUpperCase()}+${w.fusion.secondary.toUpperCase()}`:w.id.toUpperCase())}<small>L${w.level}</small></b>`).join('')}</div><p>${actor.brief}</p></div></section><section class="next-assignment"><span>다음 목표</span><h3>${e(goal.title)}</h3><p>${e(goal.text)}</p><button class="text-button" data-tab="${goal.target}">${goal.label} ↗</button></section>${p.active?'<button class="danger-text" data-action="end-saved">이전 판 정산</button>':''}</aside></div>`;
}
function trialDispatch(p){
 if(p.active||!p.trials.length)return '';
 return `<section class="trial-dispatch" aria-labelledby="trial-dispatch-title"><div><span class="section-index">다음 출격 · 현장 시험</span><h2 id="trial-dispatch-title">실전 배치 지령</h2><ul>${p.trials.map(id=>`<li><b>${RESEARCH[id].name}</b><span>${RESEARCH[id].fieldBrief}</span></li>`).join('')}</ul></div><button class="primary" data-action="launch">실전 시험 출격 <span aria-hidden="true">▶</span></button></section>`;
}
function researchPanel(p){
 const cards=Object.entries(RESEARCH).map(([id,d])=>{
  const owned=p.research.includes(id),met=p.milestones[id],afford=p.credits>=d.cost,trial=p.trials.includes(id);
  const blocked=p.active||owned||!met||!afford;
  const label=owned?'연구 완료':p.active?'작전 정산 후 연구':!met?'실증 조건 미달':!afford?`${n(d.cost-p.credits)}C 부족`:`${n(d.cost)}C · 연구`;
  const state=owned?'complete':met&&afford&&!p.active?'ready':'locked';
  const reserve=owned&&!trial&&!p.active,short=Math.max(0,REQUISITION_FEE-p.credits);
  const action=reserve?`<small class="trial-note">${d.fitting}</small><button class="research-reserve" aria-label="${d.name} ${short?`${n(short)}C 부족`:`정비대 예약 · ${REQUISITION_FEE}C`}" data-reserve="${id}" ${short?'disabled':''}>${short?`${n(short)}C 부족`:`정비대 예약 · ${REQUISITION_FEE}C`}</button>`
   :`<button ${blocked?'disabled':''} class="${state==='ready'?'primary':''}" data-research="${id}">${label}</button>`;
  return `<article class="research-docket ${state}" data-research-item="${id}"><div class="docket-art">${moduleIcon(id)}<span>${owned?'개발 완료':met?'실증 완료':'실증 대기'}</span></div><div class="docket-paper"><h2>${d.name}</h2><p>${d.detail}</p><div class="research-condition"><span>${met?'✓':'○'}</span>${d.condition}</div>${trial?'<small class="trial-note">새 연구 · 조건에 맞는 첫 보급에서 제시</small>':''}${action}</div></article>`;
 }).join('');
 const reservationNote=p.research.some(id=>!p.trials.includes(id))?'<p class="inline-note">한 번 장착해 본 연구 모듈을 다음 판에 한 개 예약할 수 있습니다. 출격 시 결제되며 철도 정비대에서 다른 보급과 함께 한 가지를 고릅니다. 지나치면 비용은 돌아오지 않습니다.</p>':'';
 return `<section class="lobby-page research-page"><header class="page-heading"><div><span class="section-index">격납고 · 병기 정비</span><h1>병기 연구실</h1><p>연구한 모듈은 전장에서 보급을 열어 한 칸에 장착합니다.</p></div><span class="paper-tag">${p.research.length}/3 연구 완료</span></header>${p.active?'<p class="inline-note">출격 화면에서 이전 판을 정산한 뒤 연구할 수 있습니다.</p>':''}${trialDispatch(p)}${reservationNote}<div class="research-deck">${cards}</div><p class="page-note">모든 기본 총·분화·진화·합체는 처음부터 가능합니다. 연구 모듈도 네 칸 중 한 칸을 사용합니다.</p></section>`;
}
function weaponsPanel(){return `<section class="lobby-page"><header class="page-heading"><div><span class="section-index">병기 자료실</span><h1>어떤 화력으로 돌파할 것인가</h1><p>출격은 H로 시작합니다. 새 총은 전장에서 노획하고, 레벨4에서 발사 방식을 고릅니다.</p></div><span class="paper-tag">공격 3칸 / 모듈 4칸</span></header><div class="weapon-deck">${Object.entries(GUNS).map(([id,d])=>{const stats=weaponStats(makeWeapon(id));return `<article class="weapon-docket"><div class="weapon-blueprint"><span>${d.short}</span>${itemArt(id)}<small>${id==='h'?'빠른 연사':id==='r'?'광역 폭발':'근접 부채 화염'}</small></div><div class="weapon-spec"><h2>${d.name}</h2><p>시작 피해 ${stats.damage} · 간격 ${stats.interval.toFixed(2)}초</p><dl>${Object.values(d.branches).map(([name,desc],i)=>`<div><dt><span>${i?'B':'A'}</span>${name}</dt><dd>${desc}</dd></div>`).join('')}</dl><div class="evolution-recipe"><span>단일 진화</span><h3>${d.evolution}</h3><p>${d.short} L6 + ${id==='h'?'도탄기2':id==='f'?'촉매2':'코일2 · 점화는 촉매2도 가능'} + 조율권1</p></div></div></article>`;}).join('')}</div><div class="recipe-strip"><article><b>전도 합체 · H+R</b><p>H·R 각 L4 + 축전 코일2 + 조율권1</p><small>H 사격에 R 폭발을 계승하고 무기 한 칸을 돌려받습니다.</small></article><article><b>열압 연계 · 점화 후 기폭</b><p>서로 다른 연소·폭발 총 L4 + 촉매3</p><small>F로 점화하고 유탄 H·R로 폭파합니다. 총 두 개를 유지합니다.</small></article></div></section>`;}
export function isReport(r){return !!(r&&Number.isSafeInteger(r.seed)&&r.seed>=0&&r.seed<=4294967295&&(r.sequence===undefined||Number.isSafeInteger(r.sequence))&&(!r.operation||Number.isInteger(r.operation.cleared)&&r.operation.cleared>=0&&r.operation.cleared<=3)&&Number.isFinite(r.seconds)&&r.seconds>=0&&Number.isFinite(r.score)&&Number.isFinite(r.level)&&r.stats&&['kills','challenge','raidSuccess','raidFailed','bestCombo'].every(k=>Number.isFinite(r.stats[k])&&r.stats[k]>=0)&&(!r.stats.completedBuild||Number.isFinite(r.stats.completedBuild.t))&&Array.isArray(r.weapons)&&r.weapons.every(w=>w&&GUNS[w.id]&&Number.isFinite(w.level)&&(!w.branch||GUNS[w.id].branches[w.branch])&&(!w.fusion||GUNS[w.fusion.secondary]))&&Array.isArray(r.modules)&&r.modules.every(m=>m&&MODULES[m.id]&&Number.isFinite(m.rank)));}
function archivePanel(p){const marco=marcoRecord(p);const reports=p.recent.map((r,index)=>({r,index})).filter(({r})=>isReport(r));const priorScore=Math.max(0,...(p.recordArchive||[]).map(entry=>Number(entry?.records?.score)||0));return `<section class="lobby-page"><header class="page-heading"><div><span class="section-index">전투 기록실</span><h1>다음 판에는 무엇을 바꿀까</h1><p>최근 열 번의 작전과 완성한 빌드를 비교하세요.</p></div></header><div class="archive-records"><div><b>${n(p.records.score)}</b><span>피오 최고 점수</span></div><div><b>${p.records.time===null?'—':clockText(p.records.time)}</b><span>피오 최단 완주</span></div><div><b>D${p.records.challenge}</b><span>피오 최고 잔류</span></div><div><b>${p.records.wins}</b><span>누적 완주</span></div></div>${marco?`<p class="operator-record"><b>마르코</b><span>최고 ${n(marco.score)}점</span><span>최단 ${marco.time===null?'—':clockText(marco.time)}</span><span>잔류 D${marco.challenge}</span></p>`:''}${priorScore?`<p class="inline-note">이전 규칙 최고 점수 ${n(priorScore)}점</p>`:''}${p.recent.length!==reports.length?'<p class="inline-note">읽을 수 없는 이전 보고서는 표시하지 않습니다. 크레딧과 연구는 유지됩니다.</p>':''}${reports.length?`<div class="report-list">${reports.map(({r,index})=>`<article class="report-row"><span class="report-stamp ${r.won?'won':r.reason==='prototype-failed'?'lost':''}">${r.won?'완주':r.reason==='prototype-failed'?'전사':'귀환'}</span><div><h2>작전 ${r.sequence?`#${r.sequence}`:'보고'} · ${operatorOf(r).name} <small>${r.operation?`${r.operation.cleared}/3 돌파 · `:''}${clockText(r.seconds)}</small></h2><p>${r.weapons.map(w=>`${w.fusion?`${w.id.toUpperCase()}+${w.fusion.secondary.toUpperCase()}`:w.id.toUpperCase()} L${w.level}`).join(' / ')}${sortieOrder(r.operation?.order)?` · ${sortieOrder(r.operation.order).name}`:''}${r.balanceRevision!==p.recordScope?' · 이전 규칙 기록':''}</p></div><div class="report-numbers"><b>${n(r.score)}점</b>${hasPayout(r)?`<small>+${n(r.credits)}C</small>`:''}</div><button data-report="${index}">보고서</button></article>`).join('')}</div>`:'<div class="empty-archive">'+moduleIcon('archive')+'<h2>첫 보고서를 기다립니다.</h2><p>출격해 노획한 무기와 이번 선택을 기록하세요.</p><button class="primary" data-tab="mission">출격 준비</button></div>'}</section>`;}
export function lobbyView(p,{tab='mission',brief=null,seed=17,order=null,operator='fio',requisition=null}={}){const tabs=[['mission','출격','route'],['weapons','병기','crate'],['research','연구','gear'],['archive','기록','archive']],available=readyResearch(p).length,content=tab==='research'?researchPanel(p):tab==='weapons'?weaponsPanel():tab==='archive'?archivePanel(p):missionPanel(p,brief,seed,order,operator,requisition);
 return `<section class="hangar-shell"><header class="command-header"><a class="rift-brand" href="./index.html" aria-label="RIFT 작전실"><b>RIFT</b><span>야전 작전실</span></a><nav class="command-nav" aria-label="작전실 메뉴">${tabs.map(([id,label,icon])=>`<button data-tab="${id}" ${tab===id?'aria-current="page"':''}>${moduleIcon(icon)}<span>${label}</span>${id==='research'&&(available||p.trials.length)?'<i aria-label="새 연구 소식"></i>':''}</button>`).join('')}</nav><div class="credit-counter"><span>보급 크레딧</span><b>${n(p.credits)}<small>C</small></b></div><button class="settings-button" data-action="settings-menu" aria-label="환경 설정">${moduleIcon('gear')}</button></header><div class="command-content" id="lobby-panel">${p.migrationNotice?`<p class="inline-note">${e(p.migrationNotice)}</p>`:''}${content}</div><footer class="command-footer"><span>이동 WASD · 회피 SPACE · ${OPERATORS[operator].skill} E · 상황 행동 F</span><span>노획한 무기로 매판 새롭게</span></footer></section>`;
}
export function loadoutChips(weapons,modules){return `<div class="loadout-chips">${weapons.map(w=>`<span><b>${e(w.fusion?`${w.id.toUpperCase()}+${w.fusion.secondary.toUpperCase()}`:w.id.toUpperCase())}</b>${e(w.evolved?capstoneName(w):`L${w.level} ${w.branch?GUNS[w.id].branches[w.branch][0]:''}`)}</span>`).join('')}${modules.map(m=>`<span class="module-chip">${e(MODULES[m.id].name)} ${m.rank}</span>`).join('')}</div>`;}
function unlockedResearch(r,p){
 const ids=Array.isArray(r.researchUnlocked)?r.researchUnlocked.filter(id=>Object.hasOwn(RESEARCH,id)):[];
 if(!ids.length)return '';
 return `<section class="research-receipt" aria-label="이 작전에서 해금"><span class="section-index">이 작전에서 해금</span><ul>${ids.map(id=>{
  const d=RESEARCH[id],shortfall=Math.max(0,d.cost-p.credits);
  const status=p.research.includes(id)?'연구 완료':shortfall?`${n(d.cost)}C · ${n(shortfall)}C 부족`:`${n(d.cost)}C · 연구 가능`;
  return `<li><b>${d.name}</b><small>${status}</small></li>`;
 }).join('')}</ul></section>`;
}
function researchFieldReport(r){
 const stats=r.stats,tried=Array.isArray(stats.researchTrialsPicked)?stats.researchTrialsPicked:[stats.researchTrialPicked];
 const evidence={
  shrapnel:stats.shrapnelHits>0?`파편 적중 ${n(stats.shrapnelHits)}회 · 처치 ${n(stats.shrapnelKills)}명`:stats.shrapnelBursts>0?`파쇄 발동 ${n(stats.shrapnelBursts)}회`:null,
  thermal:stats.thermalRecovered>0?`전탄 충전 +${n(Math.round(stats.thermalRecovered*10)/10)}`:null,
  medic:stats.medicRecovered>0?`체력 회복 +${n(Math.round(stats.medicRecovered*10)/10)}`:null
 };
 const ids=Object.keys(RESEARCH).filter(id=>evidence[id]||tried.includes(id));
 if(!ids.length)return '';
 return `<section class="research-receipt field-receipt" aria-label="연구 실전 기록"><span class="section-index">연구 실전 기록</span><ul>${ids.map(id=>`<li><b>${RESEARCH[id].name}${tried.includes(id)?' <em>첫 실전</em>':''}</b><small>${evidence[id]||'장착 · 효과 기록 없음'}</small></li>`).join('')}</ul></section>`;
}
function railWorkshopReport(stats){
 const change=stats.railCalibration,branches=GUNS[change?.gun]?.branches;
 const from=branches?.[change?.from]?.[0],to=branches?.[change?.to]?.[0];
 return from&&to?`<p class="rail-workshop-record"><span>화차 개장</span><b>${e(from)} → ${e(to)}</b></p>`:'';
}
function orderReceipt(r){
 const order=sortieOrder(r.operation?.order);
 if(!order)return '';
 const reward=Number.isSafeInteger(r.orderBonus)&&r.orderBonus>=0?r.orderBonus:orderBonus(r),done=r.operation.orderDone;
 const fee=Number.isSafeInteger(r.orderFee)&&r.orderFee>=0?r.orderFee:order.fee;
 return `<section class="sortie-receipt" aria-label="지령 정산"><span class="order-stamp" aria-hidden="true">${moduleIcon(r.operation.order==='wire'?'coil':'route')}</span><div><span class="section-index">해안 지령 · ${reward?'완수':done?'목표 확보':'미완료'}</span><b>${order.name}</b><small>${reward?'목표 확보 후 최종 귀환':done?'최종 귀환 조건 미달':'해안 목표 미확보'}</small></div><div class="sortie-pay"><b>${reward?`+${n(reward)}C`:'보너스 0C'}</b><small>출격 시 −${n(fee)}C</small></div></section>`;
}
function requisitionReceipt(r){
 const id=r.operation?.requisition;
 if(!Object.hasOwn(RESEARCH,id))return '';
 const picked=r.operation.requisitionClaimed;
 return `<section class="sortie-receipt" aria-label="정비대 예약 정산"><span class="order-stamp" aria-hidden="true">${moduleIcon(id)}</span><div><span class="section-index">철도 정비대 · ${picked?'예약품 장착':'미회수'}</span><b>${RESEARCH[id].name}</b><small>${picked?'이번 작전에서 장착':'이번 판에 장착하지 않음'}</small></div><div class="sortie-pay"><small>출격 시 −${n(r.requisitionFee??REQUISITION_FEE)}C</small></div></section>`;
}
function harborPayoff(r){
 const part=r.operation?.support,log=r.operation?.harborPayoff;
 const labels={
  breach:[['turrets','측면 포탑 파괴'],['salvos','포탑탄 차단'],['fans','후속 탄막 차단']],
  overrun:[['dives','코어 돌입'],['sidesteps','측면 회피'],['compressionHits','장갑 해제 중 중거리 압축 직격']],
  recovery:[['locks','발밑 조준탄 차단'],['rakes','가로 포격 차단'],['counterfire','측면 장갑 타격'],['safeAid','경고 중 안전 회수'],['aid','일반 회수']]
 };
 if(!log||!Object.hasOwn(labels,part))return '';
 const results=labels[part].filter(([key])=>Number.isSafeInteger(log[key])&&log[key]>0)
  .map(([key,label])=>`${label} ${n(log[key])}회`);
 if(!results.length)return '';
 return `<section class="harbor-payoff" data-part="${part}"><span>철도 부품 · 항구 전과</span><b>${FRONT_SUPPORTS[part].name}</b><p>${results.join(' / ')}</p></section>`;
}
const payoutLabels={
 fronts:'전선 보스 격파',extraction:'생존 귀환',combat:'적 제압',supply:'보급 거점',raids:'습격 성공',
 holdout:'잔류 도전',cargo:'노획 화물',firstClear:'첫 완주 보너스',order:'추가 지령 완수'
};
function hasPayout(r){return Number.isSafeInteger(r.credits)&&r.credits>=0;}
function payoutLines(r){
 const lines=r.creditBreakdown,entries=Object.entries(payoutLabels);
 if(!hasPayout(r)||!lines||entries.some(([id])=>!Number.isSafeInteger(lines[id])||lines[id]<0))return null;
 if(entries.reduce((sum,[id])=>sum+lines[id],0)!==r.credits)return null;
 return entries.filter(([id])=>lines[id]>0).map(([id,label])=>({id,label,value:lines[id]}));
}
function debriefRoute(operation,stats){
 if(!operation)return '';
 const history=Array.isArray(operation.history)?operation.history:[];
 const front=Number.isInteger(operation.region)?operation.region:-1;
 return `<ol class="debrief-route" aria-label="전선별 진행 기록">${REGIONS.map((d,i)=>{
  const entry=history.find(step=>step?.region===i);
  const cleared=i<operation.cleared,elapsed=entry?.time??(front===i?operation.regionTime:null);
  const state=cleared?'돌파':front===i?'도달':'미도달';
  const time=(cleared||front===i)&&Number.isFinite(elapsed)&&elapsed>=0?` · ${clockText(elapsed)}`:'';
  const part=Object.hasOwn(FRONT_SUPPORTS,entry?.nextSupport)?FRONT_SUPPORTS[entry.nextSupport]:null;
  const signal=i===2&&({recovered:stats.holdoutCargo?'차량 저지 · 통신 화물':'차량 저지 · 후송 구급낭',
   'left-cargo':'차량 저지 · 화물 미회수',aborted:'차량 추격 중단',escaped:'차량 이탈'})[stats.signalOutcome];
  const wager=signal||(entry?.nextSupport==='vanguard'?'선발 지원 전진':part?`잔류 · ${part.name}`:entry?.holdoutKills>0?`잔류 · 증원 ${n(entry.holdoutKills)}명 제압`:'');
  return `<li class="${cleared?'done':''}"><span>${d.name}</span><small>${state}${time}</small>${wager?`<small class="debrief-wager">${e(wager)}</small>`:''}</li>`;
 }).join('')}</ol>`;
}
function debriefNext(r,p,archived){
 if(archived)return {title:'다른 작전과 비교',label:'기록실로 돌아가기',target:'archive'};
 const unlocked=Array.isArray(r.researchUnlocked)?r.researchUnlocked:[];
 const available=readyResearch(p);
 const gun=r.weapons.some(w=>w.fusion)?'r':r.weapons.some(w=>w.id==='f'&&w.evolved)?'f':null;
 const ready=available.find(([id,d])=>unlocked.includes(id)&&d.fieldGun===gun)
  ||available.find(([id])=>unlocked.includes(id))||available[0];
 if(ready){
  const [,d]=ready;
  return {title:`${d.name} 연구 가능`,text:`${n(d.cost)}C · ${d.fitting}`,label:'병기 연구실로',target:'research'};
 }
 if(!p.active&&p.trials.length)return {title:`${RESEARCH[p.trials[0]].name} 실전 배치`,text:RESEARCH[p.trials[0]].fieldBrief,label:'현장 시험 준비',target:'research'};
 if(p.research.some(id=>canReserveResearch(p,id)))return {title:'철도 정비대에 장비 예약',text:'다음 작전에서 연구 모듈을 정비대 보급으로 받으세요.',label:'다음 장비 예약',target:'research'};
 if(r.operation&&!r.won){
  const front=REGIONS[r.operation.cleared];
  return {title:front?`다음 목표 · ${front.name}`:'다음 목표 · 귀환 게이트',text:front?'해안부터 무장을 다시 모아 다음 전선을 돌파하세요.':'항구를 격파하고 열린 게이트에서 생존 귀환을 확정하세요.',label:'다음 작전 준비',target:'mission'};
 }
 return nextOrder(p);
}
function debriefActions(r,p,archived){
 const next=debriefNext(r,p,archived),support=r.operation?.region===2?r.operation.support:null;
 const parts=r.balanceRevision===p.recordScope?holdoutParts(r.seed,1):[];
 const other=parts.includes(support)?parts.find(id=>id!==support):null;
 return `<section class="debrief-actions" aria-labelledby="debrief-next">
  <span class="section-index">다음 행동</span><h2 id="debrief-next">${e(next.title)}</h2>${next.text?`<p>${e(next.text)}</p>`:''}
  <button class="primary" data-action="home" data-target="${next.target}">${e(next.label)} <span aria-hidden="true">▶</span></button>
  <p class="report-footnote">${p.active?'진행 중인 작전을 정산한 뒤 출격합니다. ':''}표준 작전 · 현재 연구로 해안 LV.1 시작</p>
  <div class="debrief-replays">
   <button data-action="same-seed" data-seed="${r.seed}" data-actor="${operatorId(r)}">같은 전장 · 표준 작전${other?`<small>${FRONT_SUPPORTS[other].name} 노리기</small>`:''}</button>
   <button data-action="launch" data-actor="${operatorId(r)}">새 전장 출격</button>
  </div>
 </section>`;
}
function debriefDetails(r,p,lines){
 const lensUses=r.operation?.region===2&&r.operation?.tactic==='lens'?r.stats.frontTactics?.[2]:0;
 const procs=[['도탄 적중',r.stats.ricochetHits],['전기 연쇄',r.stats.coilBursts],['열압 폭발',r.stats.heatBursts],
  ['합체 격발',r.stats.payloadBursts],['연쇄 도약',r.stats.payloadRelays],['합체 탄약 처치',r.stats.payloadKills],
  ['화약 유폭',r.stats.emberBursts],['화약 유폭 처치',r.stats.emberKills],['압축 코어 직격',r.stats.infernoCoreHits],
  ['코어 재장전 지연',lensUses],['화약 포탑탄 차단',r.stats.emberIntercepts],
  ['인페르노 장판 처치',r.stats.wakeKills],['관통 사격 명중',r.stats.focusHits],['약점 직격',r.stats.focusWeakHits]].filter(([,v])=>v>0);
 const fee=r.orderFee??r.requisitionFee,paid=Number.isSafeInteger(fee)&&fee>0,net=r.credits-fee;
 const ledger=lines?`<section class="payout-ledger"><h2>보급 크레딧 지급 내역</h2><dl>
  ${lines.map(({label,value})=>`<div><dt>${label}</dt><dd>+${n(value)}C</dd></div>`).join('')}
  <div class="payout-total"><dt>이번에 지급</dt><dd>+${n(r.credits)}C</dd></div>
  ${paid?`<div><dt>출격비 제외 순수익</dt><dd>${net>0?'+':''}${n(net)}C</dd></div>`:''}
  </dl></section>`:'';
 return `<details class="debrief-details"><summary><span>작전 상세</span><small>무장 · 보급 · 연구</small></summary>
  <div class="debrief-detail-grid">
   <div>${ledger}${orderReceipt(r)}${requisitionReceipt(r)}${unlockedResearch(r,p)}${researchFieldReport(r)}</div>
   <section class="build-report"><h2>이번 작전의 화력</h2>
    ${loadoutChips(r.weapons,r.modules)}
    ${Object.hasOwn(COAST_STRIKES,r.operation?.coastStrike)?`<p class="rail-workshop-record"><span>수송차 공략</span><b>${COAST_STRIKES[r.operation.coastStrike].name} · ${r.operation.coastStrikeUsed?'성공':'미발동'}</b></p>`:''}
    ${railWorkshopReport(r.stats)}
    ${r.operation?.portEntry==='gantry'?'<p class="rail-workshop-record"><span>항구 진입</span><b>측면 해치 기습</b></p>':''}
    ${Object.hasOwn(MANEUVERS,r.stats.maneuver)?`<small class="inline-note">노획 교범 · ${MANEUVERS[r.stats.maneuver].name}</small>`:''}
    ${procs.length?`<div class="proc-list">${procs.map(([label,v])=>`<span>${label}<b>${n(v)}회</b></span>`).join('')}</div>`:''}
    <small>${r.stats.completedBuild?`첫 완성 ${clockText(r.stats.completedBuild.t)} · `:''}습격 ${r.stats.raidSuccess}승 / ${r.stats.raidFailed}실패 · 최고 연속 처치 ${r.stats.bestCombo}</small>
   </section>
  </div></details>`;
}
export function reportView(r,p,{archived=false}={}){
 if(!isReport(r))return '<section class="sheet compact" role="dialog" aria-modal="true" aria-labelledby="report-error"><h2 id="report-error">이 보고서를 읽지 못했습니다.</h2><p>크레딧과 연구는 유지됩니다. 다른 작전 기록을 확인하세요.</p><button class="primary" data-action="home" data-target="archive">기록실로 돌아가기</button></section>';
 const failed=r.reason==='prototype-failed',title=r.won?(r.operation?'항구 돌파':'작전 완수'):failed?'작전 중 전사':'전선에서 복귀';
 const sameScope=r.balanceRevision===p.recordScope,lines=payoutLines(r);
 const legacyFirst=r.creditBreakdown==null&&r.won&&sameScope&&hasPayout(r)&&r.credits-operationCredits(r)===200;
 const first=lines?.find(line=>line.id==='firstClear')?.value??(legacyFirst?200:0);
 return `<section class="sheet report-sheet" role="dialog" aria-modal="true" aria-labelledby="result-title">
  <header class="debrief-header"><div><span class="section-index">작전 보고${r.sequence?` / #${r.sequence}`:''}</span>
   <h1 id="result-title">${title}</h1><p>${operatorOf(r).name} · ${clockText(r.seconds)} · LV.${r.level}${r.newTime&&sameScope?' · 최단 기록 갱신':''}</p></div>
   <span class="debrief-stamp ${r.won?'won':failed?'lost':''}">${r.won?'생존 귀환':failed?'전사':'중도 귀환'}</span>
  </header>
  <div class="debrief-overview">
   <section class="debrief-summary" aria-label="작전 성과">
    <div class="debrief-scorecard">
     ${hasPayout(r)?`<div class="earned-pay"><span>지급 크레딧</span><b>+${n(r.credits)}<small>C</small></b>${first?`<small class="first-clear">첫 완주 +${n(first)}C 포함</small>`:''}</div>`:''}
     <div class="debrief-points"><span>작전 점수${r.newScore&&sameScope?' · 갱신':''}</span><b>${n(r.score)}</b><small>일반 적 ${n(r.stats.kills)}명 · 잔류 D${r.stats.challenge}</small></div>
    </div>
    ${debriefRoute(r.operation,r.stats)}${harborPayoff(r)}
   </section>
   ${debriefActions(r,p,archived)}
  </div>
  ${debriefDetails(r,p,lines)}
 </section>`;
}
