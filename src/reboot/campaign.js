import {FIELD,clamp,layout} from './content.js';

export const REGIONS=[
 {id:'beach',name:'해안 침투',mission:'장갑 수송차를 격파하고 철도로 진입하라',boss:'장갑 수송차',hp:4200,partHp:450,theme:{ground:'#a49874',tile:'#c0ae88',road:'#59584a',edge:'#415d69'},hint:'해변에서 무기를 확보하고 분화를 정하세요.'},
 {id:'rail',name:'철도 차단',mission:'포격 열차의 양쪽 포대를 부수고 항구로 진입하라',boss:'포격 열차',hp:6200,partHp:650,theme:{ground:'#64716a',tile:'#a0aaa0',road:'#343f41',edge:'#344d4c'},hint:'화차 사이를 우회하세요. 포격 예고 밖이 안전합니다.'},
 {id:'port',name:'항구 결전',mission:'지휘 병기를 파괴하고 살아서 귀환하라',boss:'지휘 병기',hp:9000,partHp:850,theme:{ground:'#4b606b',tile:'#8fa1a8',road:'#2e414c',edge:'#1b3a50'},hint:'관제소를 확보하면 최종전 증원을 줄일 수 있습니다.'}
];
export const region=s=>REGIONS[s.operation?.region||0];
export const HOLDOUT={grace:6,tierSeconds:10,maxTier:6,rareKills:8};
export const HOLDOUT_CONTRACTS=[
 {id:'hunt',name:'지휘부 소탕',goal:'지휘관 2명 제압',risk:'양쪽에서 오는 장교의 부채꼴 사격'},
 {id:'defend',name:'중계기 방어',goal:'중계기 반경 안에서 8초 버티기',risk:'범위 안에 포격이 떨어집니다.'},
 {id:'intercept',name:'탈출 차량 저지',goal:'18초 안에 통신 차량 파괴',risk:'차량이 북쪽 검문선을 넘으면 실패합니다.'}
];
export const FRONT_SUPPORTS={
 breach:{name:'철갑 급탄',role:'부위 조준',art:'ammo',impact:'보스 부위 우선 조준 · 피해 +55%',detail:'측면에서 부위가 사거리에 들어오면 차체보다 먼저 조준합니다.',tactics:['양쪽 포대를 부숴 측면 포격 차선을 지우세요.','포탑을 먼저 파괴하면 재장전 직전 부채꼴 사격이 멈춥니다.']},
 overrun:{name:'돌격 신관',role:'재장전 돌입',art:'coil',impact:'회피 충격파 · 빈틈에 기본 피해 260',detail:'회피가 끝날 때 일반 적을 폭파하고, 재장전 중인 보스에도 근접 충격을 줍니다.',tactics:['포격이 끝나면 차선 밖에서 열차 쪽으로 회피하세요.','집중 포격을 벗어난 뒤 노출 코어 쪽으로 회피하세요.']},
 recovery:{name:'회수 의무 장비',role:'측면 순환',art:'medic',impact:'XP 회수 반경 +55 · 측면 구조 화물',detail:'보스의 첫 세 번 재장전 때 측면에 XP 18이 떨어집니다. XP를 회수해 체력을 회복합니다.',tactics:['재장전 때 좌우 선로 밖으로 돌아 구조 화물을 회수하세요.','포격 직후 컨테이너 앞 측면의 구조 화물을 주우세요.']},
 vanguard:{name:'선발 지원',role:'첫 포격 선행 경보',art:'medic',heal:20,charge:20,warning:1,tactics:['첫 차선 경고가 1초 길어집니다. 빈 차선으로 이동하세요.','첫 집중 포격 경고가 1초 길어집니다. 포격원을 보고 이동하세요.']}
};
const RARE_PARTS=['breach','overrun','recovery'];
export function holdoutParts(seed,front){
 const missing=(((seed^(seed>>>16))>>>0)+front*2+2)%RARE_PARTS.length;
 return RARE_PARTS.filter((_,index)=>index!==missing);
}
export const canAdvanceWithVanguard=s=>s.operation?.region<2&&s.stage==='holdout'&&s.holdTime<HOLDOUT.grace&&!s.challenge&&!s.operation.nextSupport;
export const supportTactic=(id,index)=>FRONT_SUPPORTS[id]?.tactics[index-1]||'';
export const FRONT_TACTICS={
 1:{
  heat:{name:'냉각 밸브 차단',role:'화염 · 측면 진입',impact:'재장전 중 측면에 붙어 분사하면 포대와 차체 피해 +45%',hint:'차선 포격 뒤 열차 옆에 붙어 불을 쏘세요.',range:176,side:55,boost:1.45},
  signal:{name:'포대 신호 역송',role:'전도 · 원거리 연쇄',impact:'원거리 적중으로 포대 사이 전류 도약 · 재장전 +0.8초',hint:'차선 밖에서 로켓·전기·전도 격발망으로 포대를 끊으세요.',range:220,hop:220,delay:.8}
 },
 2:{
  heat:{name:'코어 냉각 차단',role:'화염 · 근접 돌파',impact:'붉은 원을 피해 접근한 뒤 분사하면 코어와 장갑 피해 +55%',hint:'집중 포격과 포탑 사격을 피해 노출 코어에 붙으세요.',range:168,boost:1.55},
  signal:{name:'포탑 교신 탈취',role:'전도 · 원거리 제압',impact:'원거리 적중이 포탑으로 도약 · 다음 증원까지 최소 3초',hint:'붉은 원 바깥에서 로켓·전기·전도 격발망으로 포탑을 끊으세요.',range:220,hop:280,delay:3}
 }
};
export const frontTactic=s=>FRONT_TACTICS[s.operation?.region]?.[s.operation?.tactic];
export const holdoutContract=s=>HOLDOUT_CONTRACTS[s.operation?.region||0];
export const signalCourier=s=>s.challenge?.type==='intercept'&&s.challenge.state==='active'?s.challenge.target:null;
export const DEFENSE_ZONE={x:800,y:560,r:108,seconds:8};
export const defenseSeconds=tier=>DEFENSE_ZONE.seconds+Math.min(8,(tier-1)*2);
export const SIGNAL_ROUTE={x:800,start:920,end:95,seconds:18};
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
const BEACH_ROUTES=[
 {name:'서쪽 난파선',gun:'r',points:[[590,920],[385,650],[1165,530],[1000,900]]},
 {name:'동쪽 포대',gun:'f',points:[[1010,920],[1240,650],[355,510],[590,900]]},
 {name:'방파제 횡단',gun:'r',points:[[600,890],[1070,885],[1245,490],[340,645]]},
 {name:'벙커 횡단',gun:'f',points:[[1000,890],[555,875],[355,450],[1230,645]]}
];
export const beachRoute=seed=>BEACH_ROUTES[(seed>>>0)%BEACH_ROUTES.length];
export const COAST_APPROACHES={
 f:{name:'이동 보급차',label:'화염 · 근접 돌파',hint:'차량 쪽으로 붙어 밀집 보병을 태운다',module:'catalyst',range:215,
  guards:[['shield',0,54],['rifle',-33,26],['rifle',33,26],['rifle',-40,-13],['rifle',40,-13],['rifle',0,-30]]},
 r:{name:'박격포 진지',label:'전도 · 원거리 제압',hint:'거리를 두고 박격포부터 끊는다',module:'coil',range:300,
  guards:[['mortar',-47,-42],['mortar',47,-42]]}
};
export function regionLayout(seed,index=0){
 const map=layout(seed);
 if(index===0){
  const route=beachRoute(seed);
  return {...map,sites:map.sites.map((site,i)=>{
   const approach=i===1?'f':i===3?'r':null;
   return {...site,x:route.points[i][0],y:route.points[i][1],...(i===0?{gun:route.gun,opening:true}:approach?{coastApproach:approach,name:COAST_APPROACHES[approach].name,module:COAST_APPROACHES[approach].module}:{})};
  })};
 }
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
 shrapnel:{name:'분열 수류탄',cost:350,condition:'전도 합체로 보스 격파',detail:'유탄·로켓·합체 연쇄탄에서 파쇄 폭발 3개 · 재사용 0.65초. 모듈 한 칸을 씁니다.'},
 thermal:{name:'흡열 코일',cost:350,condition:'인페르노로 보스 격파',detail:'불붙은 적에 전기가 적중하면 전탄 충전+2 · 재사용0.25초. 화염과 코일이 필요합니다.'}
};
export const CARGO_CREDITS=70;
export function operationCredits(r,firstWin=false){if(!r.operation)return 0;const s=r.stats,boss=[90,120,180].slice(0,r.operation.cleared).reduce((a,b)=>a+b,0);return Math.floor(Math.min(s.kills,900)/15)+Math.min(s.elites,9)*10+Math.min(s.sitesCleared||0,6)*40+boss+(r.won?120:0)+Math.min(s.raidSuccess,3)*40+Math.min(s.challengeWins||s.challenge,3)*20+(s.holdoutCargo?CARGO_CREDITS:0)+(firstWin&&r.won?200:0);}
