import {RULES} from './rules.js';
export {RULES};
export const VERSION='reboot-0.1-b01';
export const FIELD={left:40,top:40,right:1560,bottom:1160};
export const GUNS={
 h:{name:'기관총 H',short:'H',color:'#ffcf75',branches:{ricochet:['산개 도탄','탄이 다른 적에게 한 번 더 튕깁니다.'],grenade:['유탄 급탄','8번 발사마다 폭발 유탄을 함께 발사합니다.']},evolution:'사중 기관포'},
 r:{name:'로켓 R',short:'R',color:'#ff9567',branches:{homing:['추적 다탄두','탄두가 살아 있는 적을 추적합니다.'],incendiary:['점화 탄두','폭발한 자리에 연소 구역을 남깁니다.']},evolution:'폭풍 발사대'},
 f:{name:'화염방사기 F',short:'F',color:'#ff7148',branches:{trail:['연료 살포','움직인 자리에 화염 지대를 남깁니다.'],focused:['압축 분사','더 멀리, 좁고 강하게 분사합니다.']},evolution:'인페르노'}
};
export const MODULES={
 medic:{name:'응급 주사기',color:'#b9d697',desc:'정예를 처치해 생존을 회수합니다.',detail:()=> '정예 처치 체력+12 · 재사용12초'},
 shrapnel:{name:'분열 수류탄',color:'#ffca88',desc:'로켓·유탄과 합체 연쇄탄이 작은 파쇄 폭발 3개로 번집니다.',detail:()=> '파쇄 피해20×3 · 재사용0.65초 · 추가 발동 없음'},
 thermal:{name:'흡열 코일',color:'#92e4e5',desc:'연소 중인 적에 전기가 적중하면 전탄을 회수합니다.',detail:()=> '전탄 충전+2 · 재사용0.25초 · 화염+축전 코일 필요'},
 ricochet:{name:'도탄기',color:'#e7c97a',desc:'탄환이 무리 사이를 튕깁니다.',detail:r=>`추가 도탄 ${r}회 · 다음 피해 70%`},
 coil:{name:'축전 코일',color:'#92e4e5',desc:'탄환·폭발 적중이 전기 연쇄를 만듭니다.',detail:r=>`가중 적중 ${RULES.modules.coil.threshold[r-1]} → 전기 ${RULES.modules.coil.targets[r-1]}명`},
 catalyst:{name:'촉매 연료',color:'#ff9f69',desc:'연소가 번지고 폭발이 열압으로 이어집니다.',detail:r=>`연소 전파 ${r}명 · 연소 표적 폭발 +${Math.round(RULES.modules.catalyst.blastBonusOnBurn[r-1]*100)}%`},
 magnet:{name:'자기 회수기',color:'#b9d697',desc:'XP 회수 범위와 수집 중 이동이 좋아집니다.',detail:r=>`회수 반경 +${r*30} · 이동 회수 속도 +${r*3}%`},
 overcharger:{name:'불안정 과급기',color:'#d7b5ff',desc:'전탄 보급 종료 때 강한 방출. 받는 피해 +15%.',detail:()=> '종료 방출 140 · 받는 피해 ×1.15'}
};
export const QUALITY={common:'일반',rare:'희귀',prototype:'원형품'};
export const GUN_BRIEFS={h:'빠른 실탄 연사 · L4: 산개 도탄 / 유탄 급탄',r:'넓은 폭발로 무리 정리 · L4: 추적 다탄두 / 점화 탄두',f:'가까운 무리를 태우는 부채 화염 · L4: 연료 살포 / 압축 분사'};
export const MODULE_LINKS={medic:'안전성을 얻는 대신 모듈 한 칸 사용',shrapnel:'유탄·로켓·전도 격발망의 군집 피해 확장',thermal:'연소+전기 → 전탄 보급 순환',ricochet:'H L6 + 도탄2 → 사중 기관포',coil:'H·R 각 L4 + 코일2 → 전도 합체',catalyst:'화염으로 점화 → 유탄·로켓으로 열압 폭발',magnet:'위험한 XP 회수 동선을 짧게',overcharger:'전탄 보급 종료 방출 · 받는 피해 +15%'};
export function buildPaths(s){
 const paths=s.weapons.filter(w=>!w.fusion).map(w=>{const requirements=w.branch?RULES.weapons[w.id].evolution.moduleByBranch[w.branch]:[...new Set(Object.values(RULES.weapons[w.id].evolution.moduleByBranch).flat())],rank=Math.max(...requirements.map(id=>moduleRank(s,id))),ready=w.level===6&&rank>=2&&!w.evolved;return{title:`단일 진화 · ${GUNS[w.id].evolution}`,detail:`${GUNS[w.id].short} L${w.level}/6 · ${requirements.map(id=>MODULES[id].name).join(' 또는 ')} ${rank}/2`,ready:ready&&s.tuning>0,complete:w.evolved};});
 const h=s.weapons.find(w=>w.id==='h'&&!w.fusion),r=s.weapons.find(w=>w.id==='r'&&!w.fusion),fused=s.weapons.some(w=>w.fusion);paths.push({title:'전도 합체 · H+R',detail:`H ${h?`L${h.level}/4`:'미보유'} · R ${r?`L${r.level}/4`:'미보유'} · 코일 ${moduleRank(s,'coil')}/2`,ready:!!(h&&r&&!h.evolved&&!r.evolved&&h.level>=4&&r.level>=4&&moduleRank(s,'coil')>=2&&s.tuning>0),complete:fused});
 const fire=s.weapons.some(w=>w.level>=4&&tags(w).includes('burn')),blast=s.weapons.some(w=>w.level>=4&&tags(w).includes('blast')),rank=moduleRank(s,'catalyst');paths.push({title:'열압 연계 · 화염+폭발',detail:`서로 다른 두 총 L4 · 연소 ${fire?'확보':'필요'} · 폭발 ${blast?'확보':'필요'} · 촉매 ${rank}/3`,ready:rank===2&&heatSynergyReady(s,2)&&s.tuning>0,complete:heatSynergyReady(s)});return paths;
}
export const makeWeapon=id=>({id,level:1,branch:null,evolved:false,fusion:null,cd:.12,shots:0,payload:0,payloadCd:0});
export function tags(w){const d=RULES.weapons[w.id],b=[d.branchA,d.branchB].find(b=>b.id===w.branch),secondary=w.fusion?RULES.weapons[w.fusion.secondary]:null,branch=secondary?[secondary.branchA,secondary.branchB].find(b=>b.id===w.fusion.branch):null;return [...new Set([...d.tags,...(b?.tags||[]),...(w.fusion?['bullet','blast','conductive',...(branch?.tags||[])]:[])])];}
export function heatSynergyReady(s,rank=3){return moduleRank(s,'catalyst')>=rank&&s.weapons.some(a=>a.level>=4&&tags(a).includes('burn')&&s.weapons.some(b=>b!==a&&b.level>=4&&tags(b).includes('blast')));}
export const moduleRank=(s,id)=>s.modules.find(m=>m.id===id)?.rank||0;
export const compatible=(s,id)=>(id!=='thermal'||moduleRank(s,'coil')>0)&&(RULES.modules[id].universal||s.weapons.some(w=>tags(w).some(t=>RULES.modules[id].compatibleAny?.includes(t))));
export function moduleGain(s,id,amount){const current=moduleRank(s,id),next=Math.min(3,current+amount),overflow=Math.max(0,current+amount-3);return{current,next,overflow,charge:overflow*RULES.crateRewards.overflowChargePerRank};}
export const refitWeapons=s=>s.weapons.filter(w=>w.level>=4&&!w.evolved&&!w.fusion&&GUNS[w.id].branches[w.branch]);
export function completionModules(s){
 const needs=new Map(),add=(id,rank)=>{if(moduleRank(s,id)<rank&&!s.excluded.includes(id)&&compatible(s,id))needs.set(id,Math.max(rank,needs.get(id)||0));};
 for(const w of s.weapons)if(!w.evolved&&!w.fusion){const d=RULES.weapons[w.id].evolution.moduleByBranch;for(const id of w.branch?d[w.branch]:new Set(Object.values(d).flat()))add(id,2);}
 if(s.weapons.some(a=>!a.evolved&&!a.fusion&&tags(a).includes('bullet')&&s.weapons.some(b=>b!==a&&!b.evolved&&!b.fusion&&tags(b).includes('blast'))))add('coil',2);
 if(s.weapons.some(a=>tags(a).includes('burn')&&s.weapons.some(b=>b!==a&&tags(b).includes('blast'))))add('catalyst',3);
 return [...needs.keys()];
}
export function weaponStats(w){
 const d=RULES.weapons[w.id],i=(w.fusion?6:w.level)-1,e=w.evolved&&!w.fusion?d.evolution:null;
 let damage=e?.damage??d.damage[i],interval=e?.interval??d.interval[i],count=e?.count??d.count[i],range=Array.isArray(d.range)?d.range[i]:d.range,cone=d.coneDegrees||0;
 if(w.id==='f'){range+=e?.rangeAdded||0;cone+=e?.coneAdded||0;if(w.branch==='focused'){range+=d.branchB.rangeAdded;cone*=d.branchB.coneMultiplier;damage*=d.branchB.damageMultiplier;}}
 if(w.fusion)interval*=1-w.fusion.overflow*.03;
 return{damage,interval,count,range,cone,radius:e?.radius??d.radius?.[i]??0,speed:d.projectileSpeed||0};
}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function layout(seed){
 const flip=seed%2===0,point=(x,y)=>({x:flip?1600-x:x,y});
 return{
  sites:[{id:'supply-a',kind:'supply',name:'전방 구조 보급',...point(590,920),state:'waiting'},{id:'supply-b',kind:'supply',name:'이동 보급대',...point(1090,690),state:'waiting'},{id:'arsenal',kind:'armory',name:'노획 무기고',...point(340,510),state:'waiting'},{id:'supply-c',kind:'supply',name:'후방 탄약고',...point(1190,350),state:'waiting'}],
  blocks:[{id:'b1',...point(680,700),w:140,h:85,hp:240,maxHp:240},{id:'b2',...point(900,440),w:130,h:90,hp:240,maxHp:240},{id:'b3',...point(500,330),w:145,h:70,hp:-1,maxHp:-1}],
  decorations:Array.from({length:20},(_,i)=>({x:90+(i*347+seed%211)%1420,y:120+(i*211+seed%107)%960,row:i%4,col:(i*3)%4}))
 };
}
