import {GUNS,MODULES,RULES,MODULE_LINKS,isFocusedInferno,isConductiveFusion,bearing,distance,makeWeapon,moduleRank,weaponStats,gunEquipLevel,moduleGain,buildPaths,evolutionParts,railCalibration,compatible} from './content.js';
import {REGIONS,RESEARCH,MANEUVERS,FRONT_SUPPORTS,PORT_SUPPORT,FRONT_TACTICS,CARGO_CREDITS,COAST_APPROACHES,COAST_STRIKES,COAST_SALVAGE_LEVEL,coastApproach,coastCrossGun,HOLDOUT,holdoutParts,canAdvanceWithVanguard,vanguardAid,holdoutContract,groundXp,holdoutTier,supportTactic,portCompressionRange,signalLane,signalLaneLabel,defenseSeconds,SIGNAL_SECONDS,SIGNAL_ESCORT_COUNT,signalCargo,signalGuardCount} from './campaign.js';
import {choose,snapshot} from './model.js';
import {chargeLabel} from './operator.js';
const pct=(a,b)=>Math.round((b/a-1)*100),num=n=>Number(n.toFixed(2));
const coastBearing=(s,site)=>`${bearing(s.player,site.x,site.y)} ${Math.round(distance(s.player,site)/10)}m`;
function openingGunRoute(s,gun){
 const site=s.sites.find(n=>n.coastApproach===gun&&n.state!=='done');
 const approach=coastApproach(site);
 if(!approach||s.weapons.length>=3)return null;
 if(s.firstNew&&s.firstNew!==gun){
  return s.weapons.some(w=>w.id===s.firstNew)&&COAST_APPROACHES[s.firstNew]
   ?{link:`첫 노획 ${GUNS[s.firstNew].short} · ${COAST_APPROACHES[s.firstNew].name} 경로 유지`}:null;
 }
 const equipped={...s,firstNew:gun,weapons:[...s.weapons,makeWeapon(gun)]};
 const other=s.sites.find(n=>n.coastApproach&&n.coastApproach!==gun&&n.state!=='done');
 const cross=coastCrossGun(equipped,other),module=approach.module;
 const supply=!s.excluded.includes(module)&&moduleRank(s,module)<3&&compatible(equipped,module)
  ?MODULES[module].name:s.stage==='field'&&!s.operation.coastStrike?COAST_STRIKES[gun].name:'';
 return {impact:`${coastBearing(s,site)} · ${approach.name}`,detail:`${approach.formation} · ${approach.hint}`,
  link:supply?`맞춤 보급 · ${supply} 후보`:'',cost:cross?`${coastBearing(s,other)} · ${GUNS[cross].short} L${COAST_SALVAGE_LEVEL} 교차 노획 후보`:''};
}
export function gateContractDetails(s){
 const front=s.operation.region,tier=(s.operation.challengeTier||0)+1,contract=holdoutContract(s);
 const rare=front<2&&tier===1;
 const goal=contract.id==='defend'?`중계기 방어 ${defenseSeconds(tier)}초`:contract.id==='intercept'?`${signalLaneLabel[signalLane(s.seed)]} · ${SIGNAL_SECONDS}초 안에 차량 저지`:contract.goal;
 const quota=rare?` · 증원 ${Math.min(s.operation.holdoutKills||0,HOLDOUT.rareKills)}/${HOLDOUT.rareKills}`:'';
 const reward=rare?holdoutParts(s.seed,front).map(id=>FRONT_SUPPORTS[id].name).join(' / ')
  :tier===1?`화물 ${CARGO_CREDITS}C 또는 후송 구급낭`:`완료 점수 +${tier*500}`;
 const escort=s.challenge?.recoverCargo?signalGuardCount(s):SIGNAL_ESCORT_COUNT;
 const cost=front===2&&tier===1?`${escort?`호위 ${escort}명 · `:''}정지 후 잔해에서 회수`:canAdvanceWithVanguard(s)?'호출 시 선발 지원 포기':'';
 return {title:`D${tier} · ${contract.name} 호출`,goal:goal+quota,reward,cost};
}

function projectedGrowth(s,c,args,before){
 const draft=snapshot(s);
 if(!choose(draft,c.id,{doctrine:draft.player.doctrine,...args}))return null;
 const paths=buildPaths(draft);
 const delayed=paths.filter(p=>before.get(p.id)?.ready&&!p.ready&&!p.complete);
 const lost=[delayed.length?`${delayed.map(p=>p.title).join(' · ')} 대기`:'',
  before.get('heat')?.complete&&!paths.find(p=>p.id==='heat')?.complete?'열압 연계 해제':''].filter(Boolean).join(' · ');
 const suffix=lost?` · ${lost}`:'';
 const gained=paths.filter(p=>!before.get(p.id)?.complete&&p.complete);
 if(gained.length)return {kind:'ready',text:`${gained[0].title} 발동${suffix}`};
 const ready=paths.filter(p=>!before.get(p.id)?.ready&&p.ready);
 if(ready.length)return {kind:'ready',text:ready.map(p=>`${p.title} ${p.id==='heat'?'조율로 발동 가능':'조립 가능'}`).join(' · ')+suffix};
 if(lost){
  const reason=c.kind==='refit'?'개장하면':['module','gun'].includes(c.kind)?'교체하면':'조율권을 쓰면';
  return {kind:'cost',text:`${reason} ${lost}`};
 }
 const advanced=paths.filter(p=>p.remaining<(before.get(p.id)?.remaining??0)&&p.status!=='blocked');
 if(!advanced.length)return null;
 const closest=advanced.sort((a,b)=>a.remaining-b.remaining)[0];
 return {kind:'progress',text:`${closest.title}까지 ${closest.missing||'분화 조건 확인'}`};
}

export function growthForecast(s,c,args={}){
 if(!['rank','module','tune','repair','gun','refit','calibrate'].includes(c.kind)||s.phase!=='choice'||!s.choices.some(card=>card.id===c.id))return null;
 if(c.kind==='gun'&&!Number.isInteger(args.slot)||c.kind==='refit'&&!args.weapon)return null;
 if(c.kind==='rank'&&s.weapons.length===1&&!s.modules.length)return null;
 const before=new Map(buildPaths(s).map(path=>[path.id,path]));
 const weapon=c.kind==='rank'&&s.weapons.find(w=>w.id===c.weapon&&!w.fusion);
 if(weapon?.level===3&&!args.branch){
  const results=Object.entries(GUNS[weapon.id].branches).map(([branch,[name]])=>({name,result:projectedGrowth(s,c,{branch},before)}));
  const first=results[0].result;
  if(first&&results.every(({result})=>result?.text===first.text))return first;
  const branch=results.find(({result})=>result?.kind==='ready');
  return branch?{kind:'progress',text:`${branch.name} 선택 시 ${branch.result.text}`}:null;
 }
 return projectedGrowth(s,c,args,before);
}

export function choiceDetails(s,c){
 const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion),out={art:c.weapon||null,title:c.title,impact:c.desc||'',detail:'',link:'',cost:'선택 즉시 적용',before:0,after:0};
 if(c.kind==='rank'&&w){
  const a=weaponStats(w),b=weaponStats({...w,level:w.level+1});out.before=w.level;out.after=w.level+1;out.title=GUNS[w.id].name;
  const rate=pct(a.damage*a.count/a.interval,b.damage*b.count/b.interval);out.impact=w.level===3?'발사 방식 분화':b.count>a.count?`동시 사격 ${a.count} → ${b.count}발`:b.radius>a.radius?`폭발 반경 +${pct(a.radius,b.radius)}%`:b.range>a.range?`사거리 ${a.range} → ${b.range}`:b.cone>a.cone?`분사각 ${num(a.cone)}° → ${num(b.cone)}°`:rate?`연사 화력 +${rate}%`:'발사 성능 개조';
  out.detail=c.desc||'';const hp=RULES.enemies.rifle.hp*(s.operation?[1,1.35,1.8][s.operation.region]:1)*1.05**Math.min(s.pressure,12),power=1+s.boosts.power*.01,before=Math.ceil(hp/(a.damage*power)),after=Math.ceil(hp/(b.damage*power));
  if(w.id==='h'&&before!==after&&!(s.operation&&s.stage==='holdout'&&holdoutTier(s.holdTime)))out.detail=`일반병 직격 ${before} → ${after}발 · 피해 ${num(a.damage)} → ${num(b.damage)}`;
  const modules=evolutionParts(w).map(id=>`${MODULES[id].name}2`).join(' 또는 ');
  out.link=out.after<4?`L4 분화까지 ${4-out.after}회 강화`:out.after===4?'다음 화면에서 발사 방식을 고릅니다.':`진화 · L6 + ${modules} + 조율권1`;
  out.cost=`L${w.level} → L${out.after} · 무기 칸 유지`;
 }else if(c.kind==='gun'){
  out.title=GUNS[c.weapon].name;out.impact=c.weapon==='r'?'무리째 날리는 광역 폭발':c.weapon==='f'?'가까운 적을 태우는 부채 화염':'끊임없이 쏟는 실탄 연사';out.detail=c.weapon==='r'?'높은 한 발 피해 · 느린 발사':c.weapon==='f'?'연소를 남겨 폭발 연계를 준비':'도탄 또는 유탄으로 분화';out.link=`L4 · ${Object.values(GUNS[c.weapon].branches).map(b=>b[0]).join(' / ')}`;out.cost=s.weapons.length<3?`새 총 L${1+(s.operation?.region||0)} · 공격 한 칸 사용`:s.refits>0&&s.stage==='field'?'기존 총 교체 · 무료 개장으로 L5까지 유지':'기존 총 교체 · 투자 일부 이전';
  if(c.salvageLevel){
   const other=s.weapons.find(gun=>gun.id===s.firstNew);
   out.detail=c.weapon==='r'?'화염에 로켓 폭발 추가':'로켓에 연소를 더해 열압 재료 확보';
   out.link='';
   if(other)out.cost=`빈칸에 L${gunEquipLevel(s,c)} · ${GUNS[other.id].short} 유지`;
  }
  if(s.choice?.opening&&s.operation?.region===0)Object.assign(out,openingGunRoute(s,c.weapon));
 }else if(c.module){
  const g=moduleGain(s,c.module,c.kind==='tune'?1:c.rank),m=MODULES[c.module];out.title=m.name;out.impact=m.detail(g.next);out.detail=m.desc;out.link=MODULE_LINKS[c.module];out.art=['coil','thermal'].includes(c.module)?'coil':c.module==='medic'?'medic':c.module==='shrapnel'?'ammo':null;
  if(c.kind==='module'&&!c.id?.startsWith('requisition:')&&!compatible(s,c.module)){
   return {...out,blocked:true,impact:'호환 무장 필요',detail:'현재 무장으로 장착할 수 없습니다.',link:'',cost:''};
  }
  if(c.module==='shrapnel'){out.impact='폭발 외곽에 파쇄탄 3발';out.detail='로켓·유탄·합체 연쇄탄 · 파편당 피해 20 · 재사용 0.65초';}
  out.cost=c.kind==='tune'?'조율권 1개 사용':g.current?`${g.current} → ${g.next}강화 · 같은 칸 유지${g.charge?` · 초과 충전 +${g.charge}`:''}`:`새 모듈 ${g.next}강화 · ${s.modules.length<4?'모듈 한 칸 사용':'기존 모듈 교체'}`;
  if(s.choice?.type==='rail-workshop'&&s.operation?.requisition===c.module&&!compatible(s,c.module))out.link=`장착 후 대기 · ${RESEARCH[c.module].fitting}`;
 }else if(c.id==='utility:health'||c.kind==='repair'||c.id==='resupply:medical'){
  const extra=c.kind==='repair'?15:c.kind==='utility'?6:0,heal=c.kind==='repair'?35:c.kind==='utility'?6:c.heal;out.art='medic';out.impact=extra?`최대 체력 +${extra}`:`체력 +${Math.min(heal,s.player.maxHp-s.player.hp)}`;out.detail=`${Math.ceil(s.player.hp)}/${s.player.maxHp} → ${Math.ceil(Math.min(s.player.maxHp+extra,s.player.hp+heal))}/${s.player.maxHp+extra}`;out.link=c.kind==='repair'?'최대 체력과 체력을 함께 정비':'';out.cost=c.kind==='repair'?'조율권 1개 사용':'';
 }else if(c.id==='utility:charge'||c.kind==='resupply'){
  const amount=c.charge??10,before=Math.floor(s.player.charge),after=Math.min(100,before+amount),hpBefore=s.player.hp,hpAfter=Math.min(s.player.maxHp,hpBefore+(c.heal||0)),healed=Math.ceil(hpAfter)-Math.ceil(hpBefore);
  out.art='ammo';out.impact=healed?`체력 +${healed}${after>before?` · 충전 +${after-before}`:''}`:after>before?`${chargeLabel(s)} 충전 +${after-before}`:`${chargeLabel(s)} 충전 최대`;out.detail=`${c.heal?`체력 ${Math.ceil(hpBefore)}/${s.player.maxHp} → ${Math.ceil(hpAfter)}/${s.player.maxHp} · `:''}충전 ${before} → ${after} / 100`;out.link='';out.cost='';
 }else if(c.kind==='calibrate'){
  const installed=s.weapons.find(weapon=>weapon.uid===c.uid);
  const change=installed&&railCalibration(s,installed);
  if(change){
   const branches=GUNS[change.gun].branches;
   out.title=installed.fusion?'전도 격발망':GUNS[installed.id].evolution;
   out.impact=`${branches[change.from][0]} → ${branches[change.to][0]}`;
   if(installed.fusion){
    out.detail=change.to==='incendiary'?'직선 탄착 뒤 화약을 남깁니다. 보병 둘이 모이면 지연 폭발.':'살아 있는 표적을 추적하고 한 폭발로 둘을 잡으면 도약합니다.';
    out.link=change.to==='incendiary'?'도약 대신 보병을 화약 쪽으로 유도':'움직이는 적과 떨어진 두 무리에 유리';
   }
   else if(installed.id==='f'){
    const before=weaponStats(installed),after=weaponStats({...installed,branch:change.to});
    out.detail=`사거리 ${before.range} → ${after.range} · 분사각 ${num(before.cone)}° → ${num(after.cone)}°`;
    out.link=change.to==='focused'?'항구 재장전 중 · 중거리에서 멈춰 코어 직격':'달린 자리에 불길 · 항구에서 냉각 배관 점화';
   }else out.detail=branches[change.to][1];
   out.cost='완성·투자 유지 · 귀환까지 적용';
  }
 }else if(c.kind==='evolve'){
  out.impact=c.weapon==='f'?w.branch==='focused'?'멀리 닿는 고열 분사':'지나간 전선에 화염 장판':c.weapon==='h'?'동시 사격 · 탄환 첫 표적 관통':'다탄두가 여러 무리를 폭격';
  out.link=c.weapon==='f'?w.branch==='focused'?'항구 재장전 중 · 중거리에서 멈춰 코어 직격':'달린 자리에 불길 · 추격병을 불길로 유도':'강화한 모듈과 발사 방식을 유지합니다.';if(c.weapon==='f')out.detail='진화 후 밀집 보병이 접근합니다.';out.cost='조율권 1개 사용';
 }else if(c.kind==='fusion'){
  const incendiary=s.weapons.find(w=>w.id===c.secondary&&!w.fusion)?.branch==='incendiary';
  out.art=c.primary;out.impact=incendiary?'화약 지대에 보병 둘이 모이면 폭발':'연쇄탄이 두 명을 잡으면 한 번 더 도약';out.detail=incendiary?'합체 직후 첫 화약탄 장전 · 보병 두 무리씩 접근':'합체 직후 첫 연쇄탄 장전 · 보병 두 무리씩 접근';out.link='총 두 개를 합치고 무기 한 칸 회수';out.cost='조율권 1개 사용';
 }else if(c.kind==='maneuver'){
  const m=MANEUVERS[c.key];out.art=c.key==='assault'?'ammo':'h';out.impact=m.impact;out.detail=m.detail;out.link='다음 전선에도 이어집니다.';out.cost='이번 작전에 하나 · 조율권 소비 없음';
 }else if(c.kind==='permit'){
  out.impact=`조율권 ${s.tuning} → ${s.tuning+1}`;out.detail='진화·합체·모듈 강화 또는 응급 정비에 사용합니다.';out.link='병기 개조에서 사용';out.cost='다음 전선까지 보관';
 }else if(c.kind==='coast-strike'){
  const plan=COAST_STRIKES[c.key];
  if(plan){out.art=c.key;out.impact=plan.impact;out.detail=plan.hint;out.link=plan.detail;out.cost=`지금 모듈 대신 선택 · 성공 시 철도에서 ${MODULES[COAST_APPROACHES[c.key].module].name} 보급 후보`;}
 }else if(c.kind==='control'){
  const tactic=FRONT_TACTICS[s.operation?.region]?.[c.key];
  out.art=c.infernoRank||['heat','lens','wake'].includes(c.key)?'f':c.key==='signal'||c.key==='ember'?'coil':'ammo';
  out.cost='';
  if(tactic){out.detail=tactic.hint;out.link='포격 주기마다 1회';}
  if(c.infernoRank){
   out.detail='이 보급을 고르면 이번 전선의 보스 전술을 포기합니다.';
   out.link=c.infernoRank===6?'L6 장착 후 조율권 1개로 인페르노 조립':'F L5 장착 · 인페르노까지 한 단계';
  }
 }else if(c.kind==='front-support'){
  const kit=FRONT_SUPPORTS[c.key];
  const index=s.operation.region+1;
  const effect=index===2?PORT_SUPPORT[c.key]||kit:kit;
  out.art=kit.art;out.impact=effect.impact.replaceAll('전탄',chargeLabel(s));out.detail=effect.detail.replaceAll('전탄',chargeLabel(s));out.link=supportTactic(c.key,index);out.cost=`${REGIONS[index].name}에서만 장착`;
  if(index===2&&c.key==='overrun'&&s.weapons.some(isFocusedInferno)){
   out.detail=`압축 인페르노 장착 중 · 코어에서 ${portCompressionRange} 떨어져 좌우 회피한 뒤 멈춰 분사하세요.`;
   out.link='장갑 해제 · 재장전 +0.9초';
  }else if(index===2&&c.key==='overrun'&&s.weapons.some(isConductiveFusion)){
   out.detail='회피로 코어를 열고 전도 격발망으로 맞히면 측면 장갑이나 포탑에 역송합니다.';
   out.link=`기본 피해 ${effect.arcDamage} · 재장전마다 한 번`;
  }
 }else if(c.kind==='cargo'){
  out.impact=`정산 +${CARGO_CREDITS}C`;out.detail='통신 화물을 확보해 이번 작전 정산에 더합니다.';out.cost='이번 판의 무장과 체력 유지';
 }else if(c.kind==='advance'){
  const support=FRONT_SUPPORTS[s.operation?.nextSupport];
  const vanguard=canAdvanceWithVanguard(s);
  out.impact=support?`${support.name} 장착 후 전진`:vanguard?'선발 지원 받고 전진':'무장과 레벨을 이어 전진';
  out.detail=vanguard?`첫 증원까지 ${Math.ceil(HOLDOUT.grace-s.holdTime)}초 · 남겨둘 XP ${groundXp(s)}`:`남겨둘 바닥 XP ${groundXp(s)} · 미회수 보급`;
  out.link=s.raid?.state==='active'?'진행 중인 습격 철수 · 건 상자 소실':s.challenge?.state==='active'?'진행 중인 잔류 도전 종료':vanguard?'다음 보스 첫 포격 경고 +1초':supportTactic(s.operation?.nextSupport,s.operation.region+1)||'새 전선에 도착';
  if(s.operation.region===0&&s.operation.coastStrikeUsed)out.detail+=' · 수송차 노획 보급 이월';
  if(s.operation?.region===0&&s.operation.order&&!s.operation.orderDone)out.link=s.raid?.state==='active'?'습격 철수 · 상자 소실 · 지령 보너스 없음':'해안 지령 미완료 · 전진 시 추가 보상 없음';
  const aid=vanguard?vanguardAid(s.player):null;
  const changes=aid?[Math.ceil(aid.hp)>Math.ceil(s.player.hp)?`체력 ${Math.ceil(s.player.hp)} → ${Math.ceil(aid.hp)}`:'',Math.floor(aid.charge)>Math.floor(s.player.charge)?`충전 ${Math.floor(s.player.charge)} → ${Math.floor(aid.charge)}`:''].filter(Boolean):[];
  out.cost=aid?changes.join(' · '):'현재 무장·모듈·체력·XP 유지';
 }
 else if(c.kind==='stay'){
  const active=s.challenge?.state==='active';
  out.title=active?'진행 중인 도전 계속':'전장 복귀 · XP 회수';
  out.impact=active?holdoutContract(s).name:'바닥 XP 회수';
  out.detail=active?`D${s.challenge.tier} · ${out.impact}`:`남은 바닥 XP ${groundXp(s)}`;
  out.link='게이트는 계속 열려 있습니다.';out.cost='';
 }
 else if(c.kind==='back'){out.impact='장비를 유지하고 전투 계속';out.detail='';out.cost='조율권 소비 없음';}
 else if(c.kind==='extract'){out.impact='이번 작전을 정산';out.detail=c.desc||'';out.link=s.raid?.state==='active'?'진행 중인 습격 철수 · 건 상자 소실':signalCargo(s)?'잔해의 미회수 화물을 두고 귀환':s.challenge?.state==='active'?'진행 중인 잔류 도전 종료':'크레딧·연구·기록 유지';out.cost='다음 판은 해안 · LV.1에서 시작';}
 return out;
}
export const isQuickMod=s=>s.choice.type==='level'&&s.level<4&&s.weapons.length<=2&&!s.modules.length;
