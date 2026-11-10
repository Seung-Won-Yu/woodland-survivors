import {RULES} from './rules.js';
export {RULES};
export const VERSION='reboot-0.1-b01';
export const FIELD={left:40,top:40,right:1560,bottom:1160};
export const INFERNO_CORE_DISTANCE=200;
export const EMBER_CHARGE={impactScale:.65,arm:.45,life:3.2,damage:105};
export const GUNS={
 h:{name:'기관총 H',short:'H',color:'#ffcf75',branches:{ricochet:['산개 도탄','탄이 다른 적에게 한 번 더 튕깁니다.'],grenade:['유탄 급탄','8번 발사마다 폭발 유탄을 함께 발사합니다.']},evolution:'사중 기관포'},
 r:{name:'로켓 R',short:'R',color:'#ff9567',branches:{homing:['추적 다탄두','탄두가 살아 있는 적을 추적합니다.'],incendiary:['점화 탄두','폭발한 자리에 연소 구역을 남깁니다.']},evolution:'폭풍 발사대'},
 f:{name:'화염방사기 F',short:'F',color:'#ff7148',branches:{trail:['연료 살포','움직인 자리에 화염 지대를 남깁니다.'],focused:['압축 분사','더 멀리, 좁고 강하게 분사합니다.']},evolution:'인페르노'}
};
export function capstoneName(w){
 if(w.fusion)return w.fusion.branch==='incendiary'?'점화 격발망':'전도 격발망';
 return w.id==='f'&&w.branch==='focused'?'압축 인페르노':GUNS[w.id].evolution;
}
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
export function evolutionParts(weapon,branch=weapon.branch){
 const byBranch=RULES.weapons[weapon.id].evolution.moduleByBranch;
 return branch?byBranch[branch]:[...new Set(Object.values(byBranch).flat())];
}
export function canEvolve(state,weapon){
 return weapon.level===6&&!weapon.evolved&&!weapon.fusion&&!!weapon.branch&&
  evolutionParts(weapon).some(id=>moduleRank(state,id)>=2);
}
function sameFusion(state,primary,secondary){
 return state.weapons.some(w=>w.fusion&&w.id===primary.id&&w.branch===primary.branch&&
  w.fusion.secondary===secondary.id&&w.fusion.branch===secondary.branch);
}
export function canFuse(state,primary,secondary){
 return primary!==secondary&&primary.level>=4&&secondary.level>=4&&
  !primary.evolved&&!secondary.evolved&&!primary.fusion&&!secondary.fusion&&
  tags(primary).includes('bullet')&&tags(secondary).includes('blast')&&
  moduleRank(state,'coil')>=2&&!sameFusion(state,primary,secondary);
}
function requirement(detail,missing,remaining){
 return {detail,missing,remaining:Math.max(0,remaining)};
}
function gunRequirement(id,weapon,rank){
 return requirement(weapon?`${GUNS[id].short} L${weapon.level}/${rank}`:`${GUNS[id].short} 미보유`,
  weapon?`${GUNS[id].short} L${rank}`:`${GUNS[id].short} 확보`,rank-(weapon?.level||0));
}
function moduleRequirement(state,ids,rank){
 const current=Math.max(...ids.map(id=>moduleRank(state,id)));
 const names=ids.map(id=>MODULES[id].name).join(' 또는 ');
 return requirement(`${names} ${current}/${rank}`,`${names} ${rank}`,rank-current);
}
function recipe(id,title,requirements,{complete=false,available=false,tuning=1,blocked=''}={}){
 const remaining=requirements.reduce((count,item)=>count+item.remaining,0);
 const ready=available&&tuning>0&&!complete&&!blocked;
 const status=complete?'active':ready?'ready':blocked?'blocked':available?'permit':'progress';
 return {id,title,ready,complete,status,remaining,
  detail:blocked||requirements.map(item=>item.detail).join(' · '),
  missing:status==='permit'?'조율권 1개':requirements.filter(item=>item.remaining>0).map(item=>item.missing).join(' · ')};
}
function heatPair(state){
 let pair=null;
 for(const burn of state.weapons.filter(w=>tags(w).includes('burn'))){
  for(const blast of state.weapons.filter(w=>w!==burn&&tags(w).includes('blast'))){
   const items=[gunRequirement(burn.id,burn,4),gunRequirement(blast.id,blast,4)];
   const remaining=items.reduce((total,item)=>total+item.remaining,0);
   if(!pair||remaining<pair.remaining)pair={items,remaining};
  }
 }
 return pair?.items||[requirement('서로 다른 연소·폭발 무기 L4','서로 다른 연소·폭발 무기 L4',8)];
}
export function buildPaths(state){
 const {tuning,weapons}=state;
 const paths=weapons.filter(w=>!w.fusion).map(w=>{
  const materials=[gunRequirement(w.id,w,6),moduleRequirement(state,evolutionParts(w),2)];
  return recipe(`evolve:${w.id}`,GUNS[w.id].evolution,materials,{complete:w.evolved,available:canEvolve(state,w),tuning});
 });
 for(const w of weapons.filter(w=>w.fusion)){
  const pair=`${GUNS[w.id].short}+${GUNS[w.fusion.secondary].short}`;
  paths.push(recipe(`installed:${w.uid}`,`전도 격발망 ${pair}`,[requirement('무기 두 칸을 한 칸으로 합쳤습니다.','',0)],{complete:true}));
 }
 const h=weapons.find(w=>w.id==='h'&&!w.fusion&&!w.evolved);
 const r=weapons.find(w=>w.id==='r'&&!w.fusion&&!w.evolved);
 if(r||!weapons.some(w=>w.fusion)){
  const materials=[gunRequirement('h',h,4),gunRequirement('r',r,4),moduleRequirement(state,['coil'],2)];
  const duplicate=h&&r&&sameFusion(state,h,r);
  const evolved=weapons.find(w=>w.evolved&&!w.fusion&&((w.id==='h'&&!h)||(w.id==='r'&&!r)));
  const blocked=duplicate?'같은 분화의 전도 격발망을 장착 중입니다.':evolved?`${GUNS[evolved.id].name} 단일 진화 완료`:'';
  paths.push(recipe('fusion:h:r','전도 격발망 H+R',materials,{
   available:!!(h&&r&&canFuse(state,h,r)),tuning,blocked
  }));
 }
 const heat=recipe('heat','열압 연계',[...heatPair(state),moduleRequirement(state,['catalyst'],3)],{
  complete:heatSynergyReady(state),available:moduleRank(state,'catalyst')===2&&heatSynergyReady(state,2),tuning
 });
 if(heat.status==='permit')heat.missing='촉매 연료 3 또는 조율권 1개로 촉매 조율';
 paths.push(heat);
 return paths;
}
export const makeWeapon=id=>({id,level:1,branch:null,evolved:false,fusion:null,cd:.12,shots:0,payload:0,payloadCd:0});
export function tags(w){const d=RULES.weapons[w.id],b=[d.branchA,d.branchB].find(b=>b.id===w.branch),secondary=w.fusion?RULES.weapons[w.fusion.secondary]:null,branch=secondary?[secondary.branchA,secondary.branchB].find(b=>b.id===w.fusion.branch):null;return [...new Set([...d.tags,...(b?.tags||[]),...(w.fusion?['bullet','blast','conductive',...(branch?.tags||[])]:[])])];}
export function heatSynergyReady(s,rank=3){return moduleRank(s,'catalyst')>=rank&&s.weapons.some(a=>a.level>=4&&tags(a).includes('burn')&&s.weapons.some(b=>b!==a&&b.level>=4&&tags(b).includes('blast')));}
export const moduleRank=(s,id)=>s.modules.find(m=>m.id===id)?.rank||0;
export const compatible=(s,id)=>(id!=='thermal'||moduleRank(s,'coil')>0)&&(RULES.modules[id].universal||s.weapons.some(w=>tags(w).some(t=>RULES.modules[id].compatibleAny?.includes(t))));
export function canReplaceModule(s,id,slot){
 if(!Number.isInteger(slot)||!s.modules[slot])return false;
 return s.modules[slot].id!=='coil'||(id!=='thermal'&&!moduleRank(s,'thermal'));
}
export function moduleGain(s,id,amount){const current=moduleRank(s,id),next=Math.min(3,current+amount),overflow=Math.max(0,current+amount-3);return{current,next,overflow,charge:overflow*RULES.crateRewards.overflowChargePerRank};}
export function gunEquipLevel(s,card,old){
 const base=card.salvageLevel||1+(s.operation?.region||0);
 if(!old)return base;
 if(s.refits>0&&s.stage==='field')return Math.min(5,old.level);
 return Math.min(5,base+Math.floor(Math.max(0,old.level-base)/2));
}
export const refitWeapons=s=>s.weapons.filter(w=>w.level>=4&&!w.evolved&&!w.fusion&&GUNS[w.id].branches[w.branch]);
export function railCalibration(s,w){
 if(!w.evolved)return null;
 const gun=w.fusion?.secondary||w.id,from=w.fusion?.branch||w.branch;
 const branches=GUNS[gun].branches;
 if(!Object.hasOwn(branches,from))return null;
 const to=Object.keys(branches).find(branch=>branch!==from);
 if(w.fusion&&s.weapons.some(other=>other!==w&&other.id===w.id&&other.branch===w.branch&&other.fusion?.secondary===gun&&other.fusion.branch===to))return null;
 return {gun,from,to};
}
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
export const blastContactRadius=hazard=>hazard.r+16;
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function rayBoxDistance(origin,dx,dy,block,padding=0){
 let enter=-Infinity,exit=Infinity;
 for(const [position,velocity,min,max] of [
  [origin.x,dx,block.x-padding,block.x+block.w+padding],
  [origin.y,dy,block.y-padding,block.y+block.h+padding]
 ]){
  if(Math.abs(velocity)<1e-9){
   if(position<=min||position>=max)return Infinity;
   continue;
  }
  const a=(min-position)/velocity,b=(max-position)/velocity;
  enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
 }
 return exit<=0||exit<=enter?Infinity:Math.max(0,enter);
}
export function layout(seed){
 const flip=seed%2===0,point=(x,y)=>({x:flip?1600-x:x,y});
 return{
  sites:[{id:'supply-a',kind:'supply',name:'전방 구조 보급',...point(590,920),state:'waiting'},{id:'supply-b',kind:'supply',name:'이동 보급대',...point(1090,690),state:'waiting'},{id:'arsenal',kind:'armory',name:'노획 무기고',...point(340,510),state:'waiting'},{id:'supply-c',kind:'supply',name:'후방 탄약고',...point(1190,350),state:'waiting'}],
  blocks:[{id:'b1',...point(680,700),w:140,h:85,hp:240,maxHp:240},{id:'b2',...point(900,440),w:130,h:90,hp:240,maxHp:240},{id:'b3',...point(500,330),w:145,h:70,hp:-1,maxHp:-1}],
  decorations:Array.from({length:20},(_,i)=>({x:90+(i*347+seed%211)%1420,y:120+(i*211+seed%107)%960,row:i%4,col:(i*3)%4}))
 };
}
