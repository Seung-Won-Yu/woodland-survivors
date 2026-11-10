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
 breach:{name:'철갑 급탄',role:'부위 조준',art:'ammo',impact:'보스 부위 우선 조준 · 피해 +55%',detail:'측면에서 부위가 사거리에 들어오면 차체보다 먼저 조준합니다.',tactics:['조준 중인 포대를 부수면 해당 포격이 멈춥니다.','포탑을 먼저 파괴하면 재장전 직전 부채꼴 사격이 멈춥니다.']},
 overrun:{name:'돌격 신관',role:'재장전 돌입',art:'coil',impact:'회피 충격파 · 빈틈에 기본 피해 260',detail:'회피가 끝날 때 일반 적을 폭파하고, 재장전 중인 보스에도 근접 충격을 줍니다.',tactics:['포격이 끝나면 차선 밖에서 열차 쪽으로 회피하세요.','집중 포격을 벗어난 뒤 노출 코어 쪽으로 회피하세요.']},
 recovery:{name:'회수 의무 장비',role:'측면 순환',art:'medic',impact:'XP 회수 반경 +55 · 측면 구조 화물',detail:'보스의 첫 세 번 재장전 때 측면에 XP 18이 떨어집니다. XP를 회수해 체력을 회복합니다.',tactics:['재장전 때 좌우 선로 밖으로 돌아 구조 화물을 회수하세요.','포격 직후 컨테이너 앞 측면의 구조 화물을 주우세요.']},
 vanguard:{name:'선발 지원',role:'첫 포격 선행 경보',art:'medic',heal:20,stabilize:.6,charge:20,warning:1,tactics:['첫 차선 경고가 1초 길어집니다. 빈 차선으로 이동하세요.','첫 집중 포격 경고가 1초 길어집니다. 포격원을 보고 이동하세요.']}
};
const RARE_PARTS=['breach','overrun','recovery'];
export function holdoutParts(seed,front){
 const missing=(((seed^(seed>>>16))>>>0)+front*2+2)%RARE_PARTS.length;
 return RARE_PARTS.filter((_,index)=>index!==missing);
}
export const canAdvanceWithVanguard=s=>s.operation?.region<2&&s.stage==='holdout'&&s.holdTime<HOLDOUT.grace&&!s.challenge&&!s.operation.nextSupport;
export function vanguardAid(player){
 const kit=FRONT_SUPPORTS.vanguard;
 return {
  hp:Math.min(player.maxHp,Math.max(player.hp+kit.heal,Math.ceil(player.maxHp*kit.stabilize))),
  charge:Math.min(100,player.charge+kit.charge)
 };
}
export const PORT_TURRET={shutterDamage:.16};
export const PORT_SUPPORT={
 breach:{impact:'포탑 쪽 사선에서 장갑 관통 · 피해 +65%',detail:'측면에서 포탑이 사거리에 들어오면 자동 사격을 집중합니다. 포탑 파괴 시 부채꼴 사격이 멈춥니다.',hint:'작전도에 표시된 포탑 쪽 측면으로 이동하세요.',flank:105,boost:1.65},
 overrun:{impact:'회피 돌입으로 코어 직격 320 · 장갑 해제',detail:'재장전 중 표시된 경계를 회피로 넘으세요. 남은 노출 동안 코어가 피해를 더 받고, 노출이 0.9초 늘어납니다.',hint:'포격을 피한 뒤 코어 경계 밖에서 안으로 회피하세요.',reach:100,damage:320,delay:.9},
 recovery:{impact:'측면 구급 화물 · 체력 +12 / 전탄 +20',detail:'첫 포격 예고에 포탑 반대편으로 화물이 옵니다. 이후 재장전 때 좌우로 투하하며, 남은 화물은 그 자리에 있습니다.',hint:'집중 포격을 피해 측면 화물을 밟고 전탄을 충전하세요.',heal:12,charge:20,reach:36,limit:3,lanes:[625,975],y:335}
};
export const supportTactic=(id,index)=>(index===2&&PORT_SUPPORT[id]?.hint)||FRONT_SUPPORTS[id]?.tactics[index-1]||'';
export const portTurretSide=boss=>Math.sign(boss.parts[0]?.ox)||-1;
export const portFlankPoint=boss=>({x:boss.x+portTurretSide(boss)*142,y:boss.y+95});
export const portTurretShutter=s=>s.operation?.region===2&&s.boss.active&&!s.boss.dead&&s.boss.parts[0]?.hp>0&&(s.boss.cycle===0&&s.boss.mode==='aim'||s.boss.cycle===1&&s.boss.mode==='salvo');
export const portBreachFlank=s=>s.operation?.region===2&&s.operation.support==='breach'&&s.boss.active&&!s.boss.dead&&s.boss.parts[0]?.hp>0&&(s.player.x-s.boss.x)*portTurretSide(s.boss)>=PORT_SUPPORT.breach.flank;
export const portCoreWindow=s=>s.operation?.region===2&&s.operation.support==='overrun'&&s.boss.active&&!s.boss.dead&&s.boss.mode==='recover'&&s.boss.harborStrikeCycle!==s.boss.cycle;
export const portCoreDisrupted=s=>s.operation?.region===2&&s.operation.support==='overrun'&&s.boss.active&&!s.boss.dead&&s.boss.mode==='recover'&&s.boss.harborStrikeCycle===s.boss.cycle;
export const portCoreReach=boss=>boss.r+PORT_SUPPORT.overrun.reach;
export const RAIL_BARRAGE={width:180,depth:900,y:600,outerOffset:300,warning:1.25,recover:2.2};
export const railDisarmed=boss=>boss.parts.every(part=>part.hp<=0);
// Fixed outer lanes in old checkpoints also belong to a gun.
export const railGunOf=hazard=>hazard.railGun??(hazard.x===500?0:hazard.x===1100?1:null);
export const FRONT_TACTICS={
 1:{
  heat:{name:'냉각 밸브 차단',role:'화염 · 측면 진입',impact:'재장전 중 측면에 붙어 분사하면 포대와 차체 피해 +45%',hint:'고정된 조준선을 피한 뒤 열차 옆에 붙어 불을 쏘세요.',range:176,side:55,boost:1.45},
  signal:{name:'포대 신호 역송',role:'전도 · 원거리 연쇄',impact:'원거리 적중으로 포대 사이 전류 도약 · 재장전 +0.8초',hint:'차선 밖에서 전류를 이어 조준 중인 포대를 끊으세요.',range:220,hop:220,delay:.8}
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
 f:{name:'이동 보급차',label:'화염 · 근접 돌파',hint:'보급차에 붙어 방패병과 보병을 함께 태우세요.',module:'catalyst',range:215,
  guards:[['shield',0,54],['rifle',-33,26],['rifle',33,26],['rifle',-40,-13],['rifle',40,-13],['rifle',0,-30]]},
 r:{name:'박격포 진지',label:'로켓 · 원거리 제압',hint:'열린 사선에서 박격포를 먼저 끊으세요.',module:'coil',range:300,
  guards:[['mortar',-47,-42],['mortar',47,-42]]}
};
export function coastLead(s){
 if(s.operation?.region!==0||s.stage!=='field')return null;
 const rescue=s.sites.find(site=>site.opening&&site.state!=='done');
 if(rescue)return rescue;
 if(!s.firstNew||!s.weapons.some(w=>w.id===s.firstNew))return null;
 return s.sites.find(site=>site.coastApproach===s.firstNew&&site.state!=='done')||null;
}
export const coastLeadColor=site=>site.coastApproach==='f'?'#ffd0a0':site.coastApproach==='r'?'#bcece4':'#f6d58b';
export const mapSeed=(seed,index)=>seed+index*7919;
const ENTRY={
 1:{arrival:{x:800,y:1040},routes:[
  {site:'rail-cache',sign:'화차 보급',color:'#edce8e',path:[[800,1040],[665,1002],[562,947],[535,850]]},
  {site:'rail-relay',sign:'중계기 해킹',color:'#b1dfcb',path:[[800,1040],[936,980],[1120,835],[1120,580]]}
 ]},
 2:{arrival:{x:720,y:1040},routes:[
  {site:'port-landing',sign:'하역장 보급',color:'#edce8e',path:[[720,1040],[620,992],[520,900]]},
  {site:'port-control',sign:'관제소 돌파',color:'#b5dce7',path:[[720,1040],[875,1010],[995,929],[1030,821],[1090,740],[1180,690],[1180,620]]}
 ]}
};
const MIRRORED_ENTRY=Object.fromEntries(Object.entries(ENTRY).map(([index,entry])=>[index,{
 arrival:{x:1600-entry.arrival.x,y:entry.arrival.y},
 routes:entry.routes.map(route=>({...route,path:route.path.map(([x,y])=>[1600-x,y])}))
}]));
export const frontEntry=(sectorSeed,index)=>(sectorSeed%2===0?MIRRORED_ENTRY:ENTRY)[index];
export function activeEntry(s){
 const index=s.operation?.region;
 if(!index||s.stage!=='field'||s.operation.regionTime>15)return null;
 const entry=frontEntry(mapSeed(s.seed,index),index);
 if(!entry||Math.hypot(s.player.x-entry.arrival.x,s.player.y-entry.arrival.y)>525)return null;
 return entry.routes.every(route=>{
  const [x,y]=route.path.at(-1);
  return s.sites.some(n=>n.id===route.site&&n.x===x&&n.y===y&&n.state!=='done');
 })?entry:null;
}
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
 const entry=frontEntry(seed,index),landing=i=>{const [x,y]=entry.routes[i].path.at(-1);return {x,y};};
 const block=(id,x,y,w,h,hp=-1)=>({id,x:mirror?1600-x-w:x,y,w,h,hp,maxHp:hp});
 if(index===1)return {...map,sites:[
  {id:'rail-cache',kind:'supply',name:'화차 보급',...landing(0),state:'waiting'},
  {id:'rail-relay',kind:'relay',name:'통신 중계기',...landing(1),state:'waiting',progress:0},
  {id:'arsenal',kind:'armory',name:'선로 정비창',...p(350,430),state:'waiting'},
  {id:'rail-ammo',kind:'supply',name:'포대 탄약고',...p(1160,300),state:'waiting'}
 ],blocks:[block('r1',640,730,100,185),block('r2',640,385,100,180),block('r3',950,600,105,180),block('r4',950,250,105,160),block('r5',400,630,100,70,200)]};
 return {...map,sites:[
  {id:'port-landing',kind:'supply',name:'하역장 보급',...landing(0),state:'waiting'},
  {id:'port-control',kind:'control',name:'항구 관제소',...landing(1),state:'waiting'},
  {id:'arsenal',kind:'armory',name:'시험 병기 창고',...p(280,475),state:'waiting'},
  {id:'port-ammo',kind:'supply',name:'지휘부 탄약',...p(1100,320),state:'waiting'}
 ],blocks:[block('p1',550,690,210,100),block('p2',850,470,235,100),block('p3',340,350,170,100),block('p4',1120,800,160,100),block('p5',1070,170,160,75,280)]};
}
export function regionBoss(index,seed=1){const d=REGIONS[index],turretSide=index===2&&seed%2===0?1:-1;return{id:'boss',type:'boss',x:800,y:180,hp:d.hp,maxHp:d.hp,r:index===1?76:65,active:false,dead:false,body:Math.PI/2,aim:Math.PI/2,mode:'aim',timer:1.3,cycle:0,spawnClock:4,kick:0,flash:0,parts:[{id:'part-a',type:'part',ox:60*turretSide,hp:d.partHp,maxHp:d.partHp,r:25},{id:'part-b',type:'part',ox:-60*turretSide,hp:d.partHp,maxHp:d.partHp,r:25}]};}
export const RESEARCH={
 medic:{name:'응급 주사기',cost:300,condition:'첫 작전 완주',detail:'정예를 잡으면 체력12 회복 · 재사용12초. 보급 후보로 추가되며 모듈 한 칸을 씁니다.'},
 shrapnel:{name:'분열 수류탄',cost:350,condition:'전도 합체로 보스 격파',detail:'유탄·로켓·합체 연쇄탄에서 파쇄 폭발 3개 · 재사용 0.65초. 모듈 한 칸을 씁니다.'},
 thermal:{name:'흡열 코일',cost:350,condition:'인페르노로 보스 격파',detail:'불붙은 적에 전기가 적중하면 전탄 충전+2 · 재사용0.25초. 화염과 코일이 필요합니다.'}
};
export const CARGO_CREDITS=70;
export function operationCredits(r,firstWin=false){if(!r.operation)return 0;const s=r.stats,boss=[90,120,180].slice(0,r.operation.cleared).reduce((a,b)=>a+b,0);return Math.floor(Math.min(s.kills,900)/15)+Math.min(s.elites,9)*10+Math.min(s.sitesCleared||0,6)*40+boss+(r.won?120:0)+Math.min(s.raidSuccess,3)*40+Math.min(s.challengeWins||s.challenge,3)*20+(s.holdoutCargo?CARGO_CREDITS:0)+(firstWin&&r.won?200:0);}
