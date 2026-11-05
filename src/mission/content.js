export const RULESET='operation-0.14.0';
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
WEAPONS.s={name:'샷건 S',evolution:'브리치 샷건',short:'S',color:'#ffc88c',interval:.65,damage:15,desc:'근거리 산탄 · 접근해서 장갑과 무리를 함께 파쇄',ranks:['산탄 2발 추가','넓은 관통 산탄','근접 장갑 피해 증가']};
WEAPONS.f={name:'화염방사기 F',evolution:'인페르노',short:'F',color:'#ff8e51',interval:.095,damage:9,desc:'짧은 화염 부채 · 적을 태우고 지역을 장악',ranks:['화염 범위 확대','잔류 화상 강화','세 줄 화염 분사']};
WEAPONS.v={name:'레일 브리처',evolution:'레일 브리처',short:'P+S',color:'#9edee8',interval:.43,damage:68,desc:'긴 관통 레일과 근접 산탄을 동시에 발사',ranks:[]};
WEAPONS.n={name:'네이팜 스웜',evolution:'네이팜 스웜',short:'F+R',color:'#ff9b65',interval:.32,damage:26,desc:'화염 부채와 추적 네이팜탄 · 불붙은 적에게 폭발 증폭',ranks:[]};
export const BASE_WEAPONS=['p','h','r','s','f'];
export const UNIONS={u:{parts:['h','r'],desc:'관통 연사 적중 → 유도 미사일'},v:{parts:['p','s'],desc:'관통 레일 + 근접 산탄 · 장갑 파쇄'},n:{parts:['f','r'],desc:'화염 부채 + 추적 네이팜 · 연소 폭발'}};
export const weaponTags=id=>UNIONS[id]?.parts||[id];
export const acceptsMod=(w,base)=>!!w&&weaponTags(w.id).includes(base);
export const BOSS_GUIDES=[
 {tag:'BAIT & FLANK',goal:'돌진 유도 → 옆으로 회피 → 후면 엔진 공략',parts:['전면 장갑','엔진 덮개']},
 {tag:'BREAK THE GUNS',goal:'좌우 포대 제압 → 표시된 안전 통로로 이동',parts:['좌측 포대','우측 포대']},
 {tag:'EXPOSE THE CORE',goal:'궤도·포탑 파괴 → 재장전 중 노출 코어에 집중',parts:['포탑','궤도 장갑']}
];
export function buildSynergies(weapons){const has=id=>weapons.some(w=>acceptsMod(w,id)),mod=id=>weapons.some(w=>w?.mods.includes(id));return[
 ...(mod('h-capacitor')&&mod('h-ricochet')?['도탄 전력망 · 도탄 적중도 축전 충전']:[]),
 ...(mod('f-catalyst')&&(has('r')||has('s'))?['열압 반응 · 연소 대상 폭발·산탄 +35%']:[]),
 ...(mod('r-conductor')&&(has('p')||has('h')||has('s'))?['전도 파쇄 · 폭발 표식에 탄환 +25%']:[])
 ];}
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
RESEARCH['p-execution']={name:'P 약점 파열',weapon:'p',cost:360,requirement:'마르코로 중간 보스 격파',desc:'P로 처치한 적이 작은 관통 파열을 남깁니다. 연쇄 재발동은 없습니다.'};
RESEARCH['h-capacitor']={name:'H 축전 탄창',weapon:'h',cost:360,requirement:'H+R 최종 합체 달성',desc:'H 또는 H+R 적중 18회마다 보급 충전 +12, 근처 적에게 전기 충격.'};
RESEARCH['s-flechette']={name:'S 플레셰트',weapon:'s',cost:220,requirement:'S로 누적 일반 적 150처치',desc:'산탄 +2 · 가까이서 보스 부위에 +25% 피해. P+S에도 적용.'};
RESEARCH['f-catalyst']={name:'F 촉매 연료',weapon:'f',cost:260,requirement:'F로 누적 일반 적 150처치',desc:'불붙은 적에게 산탄·로켓 피해 +35%. F+R 합체에도 유지.'};
RESEARCH['r-conductor']={name:'R 전도 탄두',weapon:'r',cost:300,requirement:'R로 누적 일반 적 300처치',desc:'R 폭발이 표식을 남깁니다. 표식 대상에 P/H/S 탄환 피해 +25%.'};
export const FRONTS=[
 {name:'해안 침투',label:'01 / BEACHHEAD',boss:'장갑 수송차',brief:'보급을 확보하고 호위대장의 장갑을 깨뜨리세요.',color:'#b5b08a'},
 {name:'철도 보급선',label:'02 / SUPPLY LINE',boss:'철도 포격대',brief:'포로와 탄약을 회수하고 포격 진지를 돌파하세요.',color:'#b39b75'},
 {name:'항구 총공세',label:'03 / FINAL ASSAULT',boss:'지휘전차',brief:'완성한 무기로 추격대를 쓸고 지휘전차를 파괴하세요.',color:'#9baeb1'}
];
export const TACTICS={
 assault:{title:'관통 탄두 보급',desc:'주무기 숙련 +1 · 사격 관통 +2 · 진화 핵심 +1',label:'즉시 진화에 투자'},
 fusion:{title:'합체 조립선',desc:'보유 기본 무기 숙련 각각 +1 · 합체 무기 피해 +15% · 핵심 +1',label:'두 무기를 완성'},
 armor:{title:'기갑 지원 요청',desc:'다음 전선 차고 즉시 확보 · Slug 내구 160 · 주포 재사용 2.5초 · 핵심 +1',label:'노획 병기로 돌파'},
 barrage:{title:'섬멸 지원 포격',desc:'35처치마다 전방에 포격 3발 · 진화 핵심 +1',label:'대군 처치가 다음 포격으로'},
 repair:{title:'야전 정비반',desc:'최대 체력 +20 · 전부 회복 · 진화 핵심 +1',label:'안전하게 완주'},
 requisition:{title:'시험 개조 수령',desc:'연구한 보유 총 개조 하나를 즉시 장착. 없으면 주무기 숙련 +1 (최대면 피해 +12%) · 핵심 +1',label:'연구한 빌드 시험'}
};
export const ORDERS=[
 {id:'frontline-clear',title:'세 전선 돌파',desc:'중간 보스 2기와 지휘전차 격파',reward:120},
 {id:'evolution-sweep',title:'완성 화력 실증',desc:'진화·합체 상태로 900처치하고 완주',reward:160},
 {id:'fusion-clear',title:'융합 병기 실증',desc:'최종 합체로 세 전선 완주',reward:160},
 {id:'breacher-clear',title:'근접 파쇄 실증',desc:'P+S 레일 브리처로 작전 완주',reward:180},
 {id:'napalm-clear',title:'소이 병기 실증',desc:'F+R 네이팜 스웜으로 작전 완주',reward:180}
];
export function orderReady(id,result){return result.won&&(id==='frontline-clear'?(result.stats.midbosses||0)>=2:id==='evolution-sweep'?(result.stats.evolvedKills||0)>=900:id==='fusion-clear'?result.stats.union&&(result.stats.midbosses||0)>=2:id==='breacher-clear'?result.stats.unionIds?.includes('v'):id==='napalm-clear'?result.stats.unionIds?.includes('n'):false);}
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
export function frontSites(front){
 const sites=SITES.map(n=>({...n}));
 if(front>0)sites.splice(sites.length-1,0,{id:'battery',name:front===1?'철로 포격 진지':'항구 관제소',kind:'battery',x:front===1?-1750:1750,y:-3100,rescues:0,guards:16,tip:'포격을 교란하거나 시험 탄약 회수'});
 const layouts=[null,{first:[-1050,260],camp:[1700,-650],convoy:[-1650,-1000],prison:[950,-2200],garage:[-1650,-2480]},{first:[850,160],camp:[-1700,-750],convoy:[1650,-1350],prison:[-950,-2350],garage:[1600,-2620]}];
 for(const n of sites){
  if(layouts[front]?.[n.id])[n.x,n.y]=layouts[front][n.id];
  n.rescues=front===0?(n.id==='first'?1:n.id==='camp'?1:0):front===1?(n.id==='first'||n.id==='prison'?1:0):(n.id==='prison'?1:0);
  n.guards=n.kind==='boss'?0:n.guards+front*5;n.waves=n.kind==='supply'?1:n.kind==='garage'?1:2;
  if(n.id==='first')n.name=['전방 포로','철로 정비반','돌파 탄약고'][front];
  if(n.id==='camp')n.name=['해안 통신소','철도 통신소','항구 방어선'][front];
  if(n.id==='prison'){n.name=['의무 보급소','후방 포로','정비반 구출'][front];if(front===0)n.tip='정비 보급·진화 핵심';}
  if(n.id==='boss'){n.name=FRONTS[front].boss;n.tip=front===2?'주목표 · 지휘전차 격파':'전선 돌파 · 전술 보급 선택';}
 }
 return sites;
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const count=(n,max)=>clamp(Number.isFinite(n)?Math.floor(n):0,0,max);
export function calculateSettlement(input,{firstReport=false,firstClear=false}={}){
 const extended=['operation-0.13.0',RULESET].includes(input.rules),k=count(input.kills,Number.MAX_SAFE_INTEGER),e=count(input.elites,extended?6:2),p=count(input.rescues,5),o=count(input.outposts,extended?6:2),b=count(input.armorBreaks,extended?6:2),won=!!input.won;
 const components={kills:Math.floor(Math.min(k,800)/5)+(extended?Math.floor(Math.max(0,Math.min(k,4000)-800)/20)+Math.floor(Math.max(0,Math.min(k,8000)-4000)/50):0),...(extended?{midbosses:count(input.midbosses,2)*75}:{}),elites:e*25,rescues:p*20,outposts:o*50,armorBreaks:b*30,clear:won?300:0};
 const multiplier=input.difficulty==='dense'?1.15:1,repeatCredits=Math.floor(Object.values(components).reduce((a,b)=>a+b,0)*multiplier);
 const eligible=k>=50||p>0||o>0||b>0||won,oneTime={report:firstReport&&eligible?100:0,clear:firstClear&&won?200:0};
 const timeBonus=won?Math.max(0,600-count(input.seconds,Number.MAX_SAFE_INTEGER))*20:0;
 const score=Math.min(k,extended?8000:800)*10+(extended?count(input.midbosses,2)*5000:0)+e*250+p*300+o*800+b*1500+(won?10000:0)+timeBonus;
 return {components,multiplier,repeatCredits,oneTime,totalCredits:repeatCredits+oneTime.report+oneTime.clear,score,grade:won?(score>=(extended?64000:30000)?'S':score>=(extended?50000:24000)?'A':score>=(extended?36000:18000)?'B':'C'):'미완료'};
}
export function researchReady(profile,id){const r=RESEARCH[id];if(!r)return false;if(id==='p-execution')return profile.progress.midbossMarco>0;if(id==='h-capacitor')return profile.progress.unions>0;return id==='p-split'?profile.progress.pMastery:(profile.progress.weaponKills[r.weapon]||0)>=(id==='r-conductor'?300:['s','f'].includes(r.weapon)?150:r.weapon==='h'?200:100);}
