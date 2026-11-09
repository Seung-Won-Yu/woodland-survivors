import {FIELD,clamp,layout} from './content.js';

export const REGIONS=[
 {id:'beach',name:'해안 침투',mission:'장갑 수송차를 격파하고 철도로 진입하라',boss:'장갑 수송차',hp:4200,partHp:450,theme:{ground:'#a49874',tile:'#c0ae88',road:'#59584a',edge:'#415d69'},hint:'해변에서 무기를 확보하고 분화를 정하세요.'},
 {id:'rail',name:'철도 차단',mission:'포격 열차의 양쪽 포대를 부수고 항구로 진입하라',boss:'포격 열차',hp:6200,partHp:650,theme:{ground:'#64716a',tile:'#a0aaa0',road:'#343f41',edge:'#344d4c'},hint:'화차 사이를 우회하세요. 포격 예고 밖이 안전합니다.'},
 {id:'port',name:'항구 결전',mission:'지휘 병기를 파괴하고 살아서 귀환하라',boss:'지휘 병기',hp:9000,partHp:850,theme:{ground:'#4b606b',tile:'#8fa1a8',road:'#2e414c',edge:'#1b3a50'},hint:'관제소를 확보하면 최종전 증원을 줄일 수 있습니다.'}
];
export const region=s=>REGIONS[s.operation?.region||0];
export const HOLDOUT={grace:6,tierSeconds:10,maxTier:6};
export const MANEUVERS={
 assault:{name:'돌파 격발',impact:'회피 시 1.25초간 이동 사격 가속',detail:'이동 중 기본 발사 간격 −22%. 달려서 포위망에 틈을 냅니다.'},
 brace:{name:'거치 사격',impact:'0.45초 정지하면 기본 사격 피해 +25%',detail:'움직이는 즉시 해제. 포격 사이의 빈틈에 화력을 집중합니다.'}
};
export function gatePosition(s){
 const b=s.boss,offset=b.r+48;
 const points=[[0,offset],[offset,0],[-offset,0],[0,-offset],[0,0]];
 for(const [dx,dy] of points){
  const x=clamp(b.x+dx,FIELD.left+55,FIELD.right-55),y=clamp(b.y+dy,FIELD.top+55,FIELD.bottom-48);
  if(!s.blocks.some(w=>w.hp!==0&&x+52>w.x&&x-52<w.x+w.w&&y+24>w.y&&y-32<w.y+w.h))return{x,y};
 }
 return{x:b.x,y:b.y};
}
export function exitGate(s){
 if(s.stage!=='holdout')return null;
 return s.operation?{...(s.operation.gate||gatePosition(s)),name:s.operation.region<2?'전진 게이트':'귀환 게이트'}:{x:800,y:420,name:'귀환 출구'};
}
export function holdoutTier(time){
 return time<HOLDOUT.grace?0:Math.min(HOLDOUT.maxTier,1+Math.floor((time-HOLDOUT.grace)/HOLDOUT.tierSeconds));
}
export const groundXp=s=>s.gems.reduce((sum,g)=>sum+g.value,0);
export function regionLayout(seed,index=0){
 const map=layout(seed);if(index===0)return map;
 const mirror=seed%2===0,p=(x,y)=>({x:mirror?1600-x:x,y});
 const block=(id,x,y,w,h,hp=-1)=>({id,x:mirror?1600-x-w:x,y,w,h,hp,maxHp:hp});
 if(index===1)return {...map,sites:[
  {id:'rail-cache',kind:'supply',name:'화차 무기고',...p(570,850),state:'waiting'},
  {id:'rail-relay',kind:'relay',name:'통신 중계기',...p(1050,650),state:'waiting',progress:0},
  {id:'arsenal',kind:'armory',name:'선로 정비창',...p(350,430),state:'waiting'},
  {id:'rail-ammo',kind:'supply',name:'포대 탄약고',...p(1120,300),state:'waiting'}
 ],blocks:[block('r1',640,730,100,185),block('r2',640,385,100,180),block('r3',950,600,105,180),block('r4',950,250,105,160),block('r5',400,630,100,70,200)]};
 return {...map,sites:[
  {id:'port-landing',kind:'supply',name:'하역장 무장',...p(520,900),state:'waiting'},
  {id:'port-control',kind:'control',name:'항구 관제소',...p(1180,620),state:'waiting'},
  {id:'arsenal',kind:'armory',name:'시험 병기 창고',...p(330,430),state:'waiting'},
  {id:'port-ammo',kind:'supply',name:'지휘부 탄약',...p(1100,300),state:'waiting'}
 ],blocks:[block('p1',550,690,210,100),block('p2',850,470,235,100),block('p3',340,350,170,100),block('p4',1120,800,160,100),block('p5',1070,170,160,75,280)]};
}
export function regionBoss(index){const d=REGIONS[index];return{id:'boss',type:'boss',x:800,y:180,hp:d.hp,maxHp:d.hp,r:index===1?76:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:-60,hp:d.partHp,maxHp:d.partHp,r:25},{id:'part-b',type:'part',ox:60,hp:d.partHp,maxHp:d.partHp,r:25}]};}
export const RESEARCH={
 medic:{name:'응급 주사기',cost:300,condition:'첫 작전 완주',detail:'정예를 잡으면 체력12 회복 · 재사용12초. 보급 후보로 추가되며 모듈 한 칸을 씁니다.'},
 shrapnel:{name:'분열 수류탄',cost:350,condition:'전도 합체로 보스 격파',detail:'직접 폭발에 작은 파쇄 폭발3개 · 재사용0.65초. 모듈 한 칸을 씁니다.'},
 thermal:{name:'흡열 코일',cost:350,condition:'인페르노로 보스 격파',detail:'불붙은 적에 전기가 적중하면 전탄 충전+2 · 재사용0.25초. 화염과 코일이 필요합니다.'}
};
export function operationCredits(r,firstWin=false){if(!r.operation)return 0;const s=r.stats,boss=[90,120,180].slice(0,r.operation.cleared).reduce((a,b)=>a+b,0);return Math.floor(Math.min(s.kills,900)/15)+Math.min(s.elites,9)*10+Math.min(s.sitesCleared||0,6)*40+boss+(r.won?120:0)+Math.min(s.raidSuccess,3)*40+Math.min(s.challengeWins||s.challenge,3)*20+(firstWin&&r.won?200:0);}
