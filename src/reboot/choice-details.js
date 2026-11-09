import {GUNS,MODULES,RULES,MODULE_LINKS,weaponStats,moduleGain} from './content.js';
import {MANEUVERS,groundXp,holdoutTier} from './campaign.js';
const pct=(a,b)=>Math.round((b/a-1)*100),num=n=>Number(n.toFixed(2));
export function choiceDetails(s,c){
 const w=s.weapons.find(w=>w.id===c.weapon&&!w.fusion),out={art:c.weapon||null,title:c.title,impact:c.desc||'',detail:'',link:'',cost:'선택 즉시 적용',before:0,after:0};
 if(c.kind==='rank'&&w){
  const a=weaponStats(w),b=weaponStats({...w,level:w.level+1});out.before=w.level;out.after=w.level+1;out.title=GUNS[w.id].name;
  const rate=pct(a.damage*a.count/a.interval,b.damage*b.count/b.interval);out.impact=w.level===3?'발사 방식 분화':b.count>a.count?`동시 사격 ${a.count} → ${b.count}발`:b.radius>a.radius?`폭발 반경 +${pct(a.radius,b.radius)}%`:b.range>a.range?`사거리 ${a.range} → ${b.range}`:b.cone>a.cone?`분사각 ${num(a.cone)}° → ${num(b.cone)}°`:rate?`연사 화력 +${rate}%`:'발사 성능 개조';
  out.detail=c.desc||'';const hp=RULES.enemies.rifle.hp*(s.operation?[1,1.35,1.8][s.operation.region]:1)*1.05**Math.min(s.pressure,12),power=1+s.boosts.power*.01,before=Math.ceil(hp/(a.damage*power)),after=Math.ceil(hp/(b.damage*power));
  if(w.id==='h'&&before!==after&&!(s.operation&&s.stage==='holdout'&&holdoutTier(s.holdTime)))out.detail=`일반병 직격 ${before} → ${after}발 · 피해 ${num(a.damage)} → ${num(b.damage)}`;
  const requirements=RULES.weapons[w.id].evolution.moduleByBranch,modules=(w.branch?requirements[w.branch]:[...new Set(Object.values(requirements).flat())]).map(id=>`${MODULES[id].name}2`).join(' 또는 ');
  out.link=out.after<4?`L4 분화까지 ${4-out.after}회 강화`:out.after===4?'다음 화면에서 발사 방식을 고릅니다.':`진화 · L6 + ${modules} + 조율권1`;
  out.cost=`L${w.level} → L${out.after} · 무기 칸 유지`;
 }else if(c.kind==='gun'){
  out.title=GUNS[c.weapon].name;out.impact=c.weapon==='r'?'무리째 날리는 광역 폭발':c.weapon==='f'?'가까운 적을 태우는 부채 화염':'끊임없이 쏟는 실탄 연사';out.detail=c.weapon==='r'?'높은 한 발 피해 · 느린 발사':c.weapon==='f'?'연소를 남겨 폭발 연계를 준비':'도탄 또는 유탄으로 분화';out.link=`L4 · ${Object.values(GUNS[c.weapon].branches).map(b=>b[0]).join(' / ')}`;out.cost=s.weapons.length<3?`새 총 L${1+(s.operation?.region||0)} · 공격 한 칸 사용`:s.refits>0&&s.stage==='field'?'기존 총 교체 · 무료 개장으로 L5까지 유지':'기존 총 교체 · 투자 일부 이전';
 }else if(c.module){
  const g=moduleGain(s,c.module,c.kind==='tune'?1:c.rank),m=MODULES[c.module];out.title=m.name;out.impact=m.detail(g.next);out.detail=m.desc;out.link=MODULE_LINKS[c.module];out.art=['coil','thermal'].includes(c.module)?'coil':c.module==='medic'?'medic':c.module==='shrapnel'?'ammo':null;
  out.cost=c.kind==='tune'?'조율권 1개 사용':g.current?`${g.current} → ${g.next}강화 · 같은 칸 유지${g.charge?` · 초과 충전 +${g.charge}`:''}`:`새 모듈 ${g.next}강화 · ${s.modules.length<4?'모듈 한 칸 사용':'기존 모듈 교체'}`;
 }else if(c.id==='utility:health'||c.kind==='repair'||c.id==='resupply:medical'){
  const extra=c.kind==='repair'?15:c.kind==='utility'?6:0,heal=c.kind==='repair'?35:c.kind==='utility'?6:c.heal;out.art='medic';out.impact=extra?`최대 체력 +${extra}`:`체력 +${Math.min(heal,s.player.maxHp-s.player.hp)}`;out.detail=`${Math.ceil(s.player.hp)}/${s.player.maxHp} → ${Math.ceil(Math.min(s.player.maxHp+extra,s.player.hp+heal))}/${s.player.maxHp+extra}`;out.link=c.kind==='repair'?'최대 체력과 체력을 함께 정비':'';out.cost=c.kind==='repair'?'조율권 1개 사용':'';
 }else if(c.id==='utility:charge'||c.kind==='resupply'){
  const amount=c.charge??10,before=Math.floor(s.player.charge),after=Math.min(100,before+amount),hpBefore=s.player.hp,hpAfter=Math.min(s.player.maxHp,hpBefore+(c.heal||0)),healed=Math.ceil(hpAfter)-Math.ceil(hpBefore);
  out.art='ammo';out.impact=healed?`체력 +${healed}${after>before?` · 충전 +${after-before}`:''}`:after>before?`전탄 충전 +${after-before}`:'전탄 충전 최대';out.detail=`${c.heal?`체력 ${Math.ceil(hpBefore)}/${s.player.maxHp} → ${Math.ceil(hpAfter)}/${s.player.maxHp} · `:''}충전 ${before} → ${after} / 100`;out.link='';out.cost='';
 }else if(c.kind==='evolve'){
  out.impact='최종 진화';out.link='발사 구조 확장 · 모듈 유지';out.cost='조율권 1개 사용';out.before=6;out.after=6;
 }else if(c.kind==='fusion'){
  out.art=c.primary;out.impact=`${c.primary.toUpperCase()} + ${c.secondary.toUpperCase()} 합체`;out.detail='사격에 폭발을 계승';out.link='총 두 개를 합치고 무기 한 칸 회수';out.cost='조율권 1개 사용';
 }else if(c.kind==='maneuver'){
  const m=MANEUVERS[c.key];out.art=c.key==='assault'?'ammo':'h';out.impact=m.impact;out.detail=m.detail;out.link='다음 전선에도 이어집니다.';out.cost='이번 작전에 하나 · 조율권 소비 없음';
 }else if(c.kind==='permit'){
  out.impact=`조율권 ${s.tuning} → ${s.tuning+1}`;out.detail='진화·합체·모듈 강화 또는 응급 정비에 사용합니다.';out.link='병기 개조에서 사용';out.cost='다음 전선까지 보관';
 }else if(c.kind==='advance'){out.impact='무장과 레벨을 이어 전진';out.detail=`남겨둘 바닥 XP ${groundXp(s)} · 미회수 보급`;out.link=s.raid?.state==='active'?'진행 중인 습격 철수 · 건 상자 소실':s.challenge?.state==='active'?'진행 중인 지휘관 도전 종료':'새 전선에 도착';out.cost='현재 무장·모듈·체력·XP 유지';}
 else if(c.kind==='stay'){out.impact='바닥 XP와 증원군을 노린다';out.detail='공세 단계가 오를수록 물량과 내구가 증가합니다.';out.link=s.operation?.challengeTier?'추가 지휘관 도전 · 기록 점수':'지휘관 2명 제압 · 노획 보급';out.cost='열린 게이트에서 다시 선택';}
 else if(c.kind==='back'){out.impact='장비를 유지하고 전투 계속';out.detail='';out.cost='조율권 소비 없음';}
 else if(c.kind==='extract'){out.impact='이번 작전을 정산';out.detail=c.desc||'';out.link=s.raid?.state==='active'?'진행 중인 습격 철수 · 건 상자 소실':s.challenge?.state==='active'?'진행 중인 지휘관 도전 종료':'크레딧·연구·기록 유지';out.cost='무장과 레벨은 다음 판에 초기화';}
 return out;
}
export const isQuickMod=s=>s.choice.type==='level'&&s.level<4&&s.weapons.length===1&&!s.modules.length;
