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
 ricochet:{name:'도탄기',color:'#e7c97a',desc:'탄환이 무리 사이를 튕깁니다.',detail:r=>`추가 도탄 ${r}회 · 다음 피해 70%`},
 coil:{name:'축전 코일',color:'#92e4e5',desc:'탄환·폭발 적중이 전기 연쇄를 만듭니다.',detail:r=>`가중 적중 ${RULES.modules.coil.threshold[r-1]} → 전기 ${RULES.modules.coil.targets[r-1]}명`},
 catalyst:{name:'촉매 연료',color:'#ff9f69',desc:'연소가 번지고 폭발이 열압으로 이어집니다.',detail:r=>`연소 전파 ${r}명 · 연소 표적 폭발 +${Math.round(RULES.modules.catalyst.blastBonusOnBurn[r-1]*100)}%`},
 magnet:{name:'자기 회수기',color:'#b9d697',desc:'XP 회수 범위와 수집 중 이동이 좋아집니다.',detail:r=>`회수 반경 +${r*30} · 이동 회수 속도 +${r*3}%`},
 overcharger:{name:'불안정 과급기',color:'#d7b5ff',desc:'전탄 보급 종료 때 강한 방출. 받는 피해 +15%.',detail:()=> '종료 방출 140 · 받는 피해 ×1.15'}
};
export const QUALITY={common:'일반',rare:'희귀',prototype:'원형품'};
export const makeWeapon=id=>({id,level:1,branch:null,evolved:false,fusion:null,cd:.12,shots:0,payload:0,payloadCd:0});
export function tags(w){const d=RULES.weapons[w.id],b=[d.branchA,d.branchB].find(b=>b.id===w.branch);return [...new Set([...d.tags,...(b?.tags||[]),...(w.fusion?['bullet','blast','conductive']:[])])];}
export const moduleRank=(s,id)=>s.modules.find(m=>m.id===id)?.rank||0;
export const compatible=(s,id)=>RULES.modules[id].universal||s.weapons.some(w=>tags(w).some(t=>RULES.modules[id].compatibleAny?.includes(t)));
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
