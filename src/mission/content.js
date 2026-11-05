export const RULESET='operation-0.12.0';
export const HEROES={
 marco:{name:'마르코',english:'MARCO ROSSI',role:'정면을 여는 집중 사격',weapon:'p',color:'#edb36b',detail:'같은 표적을 연속 적중하면 집중 3단계. 관통과 보스 약점 피해가 강해집니다.',skill:'집중 사격'},
 fio:{name:'피오',english:'FIO GERMI',role:'보급으로 이어가는 압도적 연사',weapon:'h',color:'#a7c6a0',detail:'기관총으로 출발. 처치·탄약으로 충전하고 두 총의 강화 탄창을 함께 가동합니다.',skill:'전탄 보급'}
};
export const WEAPONS={
 p:{name:'권총 P',evolution:'장갑 관통 권총',short:'P',color:'#f3dfaa',interval:.34,damage:24,desc:'곧고 강한 탄 · 관통과 약점 공략',ranks:['탄이 적 3마리를 관통','두 발 집중 사격','피해·탄속 상승']},
 h:{name:'기관총 H',evolution:'쌍열 기관포',short:'H',color:'#ffd079',interval:.17,damage:13,desc:'끊임없는 연사 · 무리 사이에 길을 만듭니다',ranks:['두 줄 연사','공격 간격 감소','여러 적을 꿰뚫는 탄']},
 r:{name:'로켓 R',evolution:'다탄두 발사기',short:'R',color:'#ef996a',interval:1.05,damage:58,desc:'느린 중탄 · 큰 폭발로 밀집한 적을 파괴',ranks:['폭발 반경 확대','로켓 두 발 발사','폭발 피해 상승']},
 u:{name:'미사일 호위 기관포',evolution:'미사일 호위 기관포',short:'H+R',color:'#cbe5b4',interval:.115,damage:21,desc:'관통 연사의 적중이 유도 미사일을 발사합니다',ranks:[]}
};
export const TRAINING={
 vitality:{name:'기초 체력',prices:[80,160,240],perRank:.05,desc:'최대 체력 +5%',unit:'최대 +15%'},
 firepower:{name:'사격 기초',prices:[120,200,320],perRank:.03,desc:'기본 무기 피해 +3%',unit:'최대 +9%'},
 pickup:{name:'회수 훈련',prices:[80,160],perRank:.1,desc:'경험치 회수 반경 +10%',unit:'최대 +20%'},
 cycling:{name:'작동 숙련',prices:[140,240,360],perRank:.02,desc:'무기 공격 간격 −2%',unit:'최대 −6%'},
 reroll:{name:'전술 판단',prices:[160,280],perRank:1,desc:'판마다 리롤 +1회',unit:'기본 1회 + 추가 2회'}
};
export const RESEARCH={
 'p-split':{name:'P 관통 분열',weapon:'p',cost:200,requirement:'P를 한 판에서 3단계까지 강화',desc:'P 적중 뒤 좌우로 분열탄. 분열탄은 다시 분열하지 않습니다.'},
 'h-ricochet':{name:'H 도탄',weapon:'h',cost:240,requirement:'H로 누적 일반 적 200처치',desc:'H 탄이 근처의 다른 적에게 한 번 더 튕깁니다.'},
 'r-incendiary':{name:'R 점화 탄두',weapon:'r',cost:280,requirement:'R로 누적 일반 적 100처치',desc:'폭발 지점에 화염 지대를 남겨 적을 계속 태웁니다.'}
};
export const DOCTRINES={marco:[{id:'focus',name:'집중',desc:'좁은 관통 난사 · 약점 집중'},{id:'fan',name:'산개',desc:'넓은 일제 사격 · 낮은 집중 피해',locked:'P 진화로 작전 완주'}],fio:[{id:'reserve',name:'비축',desc:'강화 탄창 7초 유지'},{id:'quick',name:'신속',desc:'강화 4초 · 충전이 더 빠름',locked:'강화 탄창 중 누적 300처치'}]};
export const FIELD={left:-2200,right:2200,top:-3750,bottom:780};
export const BOSS_POSITION={x:0,y:-3400};
export const BOSS_GATE={x:0,y:-3140};
export const SITES=[
 {id:'first',name:'전방 포로',kind:'supply',x:-100,y:280,rescues:1,guards:8,tip:'첫 총기 또는 주무기 개조'},
 {id:'camp',name:'포로 수용소',kind:'camp',x:-1750,y:-650,rescues:2,guards:14,tip:'숙련·진화 핵심·회복'},
 {id:'convoy',name:'탄약 수송대',kind:'convoy',x:1650,y:-250,rescues:0,guards:14,tip:'새 총·강화 탄창·핵심'},
 {id:'prison',name:'후방 포로',kind:'prison',x:-900,y:-2100,rescues:2,guards:10,tip:'포로 구출·진화 핵심'},
 {id:'garage',name:'Slug 차고',kind:'garage',x:1750,y:-2350,rescues:0,guards:14,tip:'선택 병기 · 제한 내구'},
 {id:'boss',name:'지휘전차',kind:'boss',x:0,y:-3400,rescues:0,guards:0,tip:'주목표 · 언제든 도전'}
];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const count=(n,max)=>clamp(Number.isFinite(n)?Math.floor(n):0,0,max);
export function calculateSettlement(input,{firstReport=false,firstClear=false}={}){
 const k=count(input.kills,Number.MAX_SAFE_INTEGER),e=count(input.elites,2),p=count(input.rescues,5),o=count(input.outposts,2),b=count(input.armorBreaks,2),won=!!input.won;
 const components={kills:Math.floor(Math.min(k,800)/5),elites:e*25,rescues:p*20,outposts:o*50,armorBreaks:b*30,clear:won?300:0};
 const multiplier=input.difficulty==='dense'?1.15:1,repeatCredits=Math.floor(Object.values(components).reduce((a,b)=>a+b,0)*multiplier);
 const eligible=k>=50||p>0||o>0||b>0||won,oneTime={report:firstReport&&eligible?100:0,clear:firstClear&&won?200:0};
 const timeBonus=won?Math.max(0,600-count(input.seconds,Number.MAX_SAFE_INTEGER))*20:0;
 const score=Math.min(k,800)*10+e*250+p*300+o*800+b*1500+(won?10000:0)+timeBonus;
 return {components,multiplier,repeatCredits,oneTime,totalCredits:repeatCredits+oneTime.report+oneTime.clear,score,grade:won?(score>=30000?'S':score>=24000?'A':score>=18000?'B':'C'):'미완료'};
}
export function researchReady(profile,id){const r=RESEARCH[id];if(!r)return false;return id==='p-split'?profile.progress.pMastery:(profile.progress.weaponKills[r.weapon]||0)>=(r.weapon==='h'?200:100);}
