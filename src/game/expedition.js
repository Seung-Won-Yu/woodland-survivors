import {createGame,spawnEnemy,deriveStats,healPlayer,LIMITS} from '../core/game.js';
import {createRelicCache,openRelicCache,relicHash} from '../core/relics.js';
import {guardianStyle,GUARDIANS,PATTERN_NAMES} from '../core/patterns.js';
import {createCampaign,campaignStage,MIDPOINT_AT,ARMORY_AT,finalArrival,CAMPAIGN_BOSSES} from '../core/campaign.js';
import {normalizeProfile} from '../core/profile.js';
import {BASE_WEAPON_IDS,HEROES,WEAPONS,SLOT_LIMIT,formatTime} from '../core/content.js';
import {ROCKS,TREE_TRUNKS,LANDMARKS,TRIAL_SPOTS} from './terrain.js';
export const SAVE_KEY='woodland-independent-settings-v1';
export const SITES=[
  {id:'supply',name:'잃어버린 보급',short:'보급',...LANDMARKS.supply,color:'#e5b76a',hint:'주변 버섯 제거 → 장비와 시작 무기 +1'},
  {id:'nest',name:'가시버섯 둥지',short:'위험 둥지',...LANDMARKS.nest,color:'#e58f71',hint:'둥지를 깨우면 정예 등장 · 진화 상자'},
  {id:'spring',name:'반딧불 샘',short:'회복 샘',...LANDMARKS.spring,color:'#9bd6cd',hint:'한 번 회복 +40 · 아직 남겨둘 수 있음'},
  {id:'camp',name:'수호대 야영지',short:'귀환',...LANDMARKS.camp,color:'#ebdca5',hint:'3분 생존 후 이곳으로 귀환'}
];
export function createExpedition(hero='pip',weapon=HEROES[hero].weapon,seed=1437,{mode='scout'}={}){
  const profile=normalizeProfile({bestTime:120,kills:500,elites:1,evolved:['acorn'],lanternRank:4,stormRank:4});
  const g=createGame(profile,hero,false,seed);
  g.weapons={[weapon]:{rank:1,evolved:false,clock:.15}};g.discovered=[weapon];g.maxRanks={[weapon]:1};g.pool=[...BASE_WEAPON_IDS];
  g.startWeapon=weapon;g.terrain=[...ROCKS,...TREE_TRUNKS];g.gear=null;g.nextElite=105;g.player.charge=35;
  if(mode==='campaign')g.campaign=createCampaign();
  const trial={id:'trial',name:'바람숲 제단',short:'20초 도전',...TRIAL_SPOTS[relicHash(seed,'clearing')%TRIAL_SPOTS.length],color:'#b5d5a3',hint:'F로 시작 · 원 안에서 20초 버티면 유물',state:'ready'};
  g.expedition={seed:seed>>>0,sites:[...SITES.map(s=>({...s,state:'ready'})),trial],trial:{startedAt:null,lastAt:0,outside:0,wave:0,pending:[]},nestKills:0,complete:false,log:[],milestones:{},toast:'서쪽은 보급, 남쪽은 회복 샘. 길을 골라 경험치를 모으세요.',toastUntil:8};
  if(g.campaign){const camp=g.expedition.sites.find(s=>s.id==='camp');camp.short='야영지';camp.hint='3분 수문장 · 5분 정비 보급 · 7분 최종전';g.expedition.toast='새벽까지 한 판! 3분 수문장, 5분 정비 보급, 7분 버섯왕. 먼저 빌드를 준비하세요.';}
  g.enemies=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',Math.cos(a)*280,Math.sin(a)*240);}
  const supply=g.expedition.sites.find(s=>s.id==='supply');supply.state='guarded';
  for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',supply.x+Math.cos(a)*76,supply.y+Math.sin(a)*65,{supplyGuard:true,home:{x:supply.x,y:supply.y},patrolAngle:a,hp:42,maxHp:42,xp:4,damage:6,speed:46});}
  return g;
}
export function createCampaignExpedition(hero='pip',weapon=HEROES[hero].weapon,seed=1437){return createExpedition(hero,weapon,seed,{mode:'campaign'});}
export function message(g,text){g.expedition.toast=text;g.expedition.toastUntil=g.time+5;g.expedition.log.push({time:Math.round(g.time),text});}
export function nearestSite(g){return [...g.expedition.sites.filter(s=>['ready','guarded'].includes(s.state)),...g.pickups.filter(p=>p.type==='relic').map(p=>({...p,name:'숲의 유물 꾸러미',short:'유물',hint:'두 개 중 하나 선택 · 장착은 두 칸'}))].filter(s=>Math.hypot(s.x-g.player.x,s.y-g.player.y)<76).sort((a,b)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(b.x-g.player.x,b.y-g.player.y))[0];}
export function interact(g){
  if(g.phase!=='playing')return false;
  const s=nearestSite(g);if(!s)return false;
  if(s.type==='relic')return openRelicCache(g,g.pickups.find(p=>p.id===s.id));
  if(s.id==='supply'){if(s.state==='guarded'){message(g,'보급 주위 버섯을 물리치면 꾸러미를 회수할 수 있습니다.');return false;}g.phase='supply';return true;}
  if(s.id==='spring'){if(g.player.hp>=g.player.maxHp){message(g,'지금은 건강합니다. 샘을 남겨두세요.');return false;}const actual=healPlayer(g,40);s.state='spent';g.expedition.milestones.springAt=g.time;message(g,`반딧불 샘 · 체력 +${Math.ceil(actual)}`);g.events.push({type:'heal'});return true;}
  if(s.id==='trial'){
    s.state='active';g.expedition.trial={startedAt:g.time,lastAt:g.time,outside:0,wave:0,pending:[]};g.expedition.milestones.trialAt=g.time;
    message(g,'바람숲 도전 · 원 안에서 20초! 1.5초 넘게 벗어나면 도전이 끝납니다.');return true;
  }
  if(s.id==='nest'){
    const hp=360+g.time*3;s.state='active';const boss=spawnEnemy(g,'elite',s.x,s.y+105,{hp,maxHp:hp,speed:42,clock:2.4,canEvolve:true,nestGuardian:true,guardianStyle:guardianStyle(g.expedition.seed),bossPhase:1,cycle:0});
    g.expedition.guardianId=boss.id;
    g.expedition.milestones.nestAt=g.time;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',s.x+Math.cos(a)*145,s.y+Math.sin(a)*130);}
    message(g,`${GUARDIANS[boss.guardianStyle].name} 등장! 공격 예고를 피하고 회복 중인 빈틈을 노리세요.`);return true;
  }
  if(s.id==='camp'){
    if(g.campaign){message(g,g.campaign.mid.state==='active'?'야영지의 보급로 수문장을 처치하세요.':g.campaign.final.state==='active'?'버섯왕을 쓰러뜨리면 원정을 완주합니다.':g.time<MIDPOINT_AT?`수문장 등장까지 ${Math.ceil(MIDPOINT_AT-g.time)}초 · 빌드를 준비하세요.`:`최종전은 7분부터 · 5분 정비 상자와 무기 각성을 챙기세요.`);return false;}
    if(g.time<180){message(g,`귀환까지 ${Math.ceil(180-g.time)}초 · 경험치를 모으거나 유물에 도전하세요.`);return false;}
    g.expedition.milestones.returnAt=g.time;g.expedition.complete=true;g.phase='result';g.outcome='scouted';return true;
  }
  return false;
}
export function takeSupply(g,gear,replace=null){
  if(g.phase!=='supply'||!['boots','bark'].includes(gear))return false;
  const s=g.expedition.sites.find(s=>s.id==='supply');if(s.state!=='ready')return false;
  const recipe=WEAPONS[g.startWeapon].recipe;
  if(!g.passives[recipe]&&Object.keys(g.passives).length>=SLOT_LIMIT){
    if(!replace||!Object.hasOwn(g.passives,replace)){g.pendingSupplyGear=gear;return false;}
    delete g.passives[replace];
  }
  delete g.pendingSupplyGear;
  g.gear=gear;s.state='spent';g.expedition.milestones.supplyAt=g.time;const w=g.weapons[g.startWeapon];
  if(w&&!w.evolved){w.rank=Math.min(WEAPONS[g.startWeapon].max,w.rank+1);g.maxRanks[g.startWeapon]=w.rank;}
  g.passives[recipe]=Math.max(g.passives[recipe]||0,1);
  createRelicCache(g,'supply',s.x+60,s.y-20);
  g.phase='playing';g.stats=deriveStats(g);message(g,`${gear==='boots'?'순찰 장화':'나무껍질 망토'} 장착 · 옆에 남은 유물 꾸러미는 F로 확인`);return true;
}
export function updateExpedition(g){
  const ex=g.expedition,nest=ex.sites.find(s=>s.id==='nest');
  const trial=ex.sites.find(s=>s.id==='trial'),t=ex.trial;
  if(trial?.state==='active'&&g.phase!=='result'){
    const dt=Math.max(0,g.time-t.lastAt);t.lastAt=g.time;
    t.outside=Math.hypot(g.player.x-trial.x,g.player.y-trial.y)>240?t.outside+dt:0;
    const elapsed=g.time-t.startedAt;
    if(t.outside>=1.5){trial.state='abandoned';t.pending=[];message(g,'제단을 벗어나 도전이 끝났습니다. 경험치를 모아 원정을 이어가세요.');}
    else if(elapsed>=20){
      trial.state='spent';ex.milestones.trialClearedAt=g.time;createRelicCache(g,'trial',trial.x,trial.y+45);
      // Recover earned XP around the held clearing; never create or teleport XP.
      for(const [key,gem] of g.gems)if(Math.hypot(gem.x-trial.x,gem.y-trial.y)<=360){g.gems.delete(key);g.flying.push({...gem,speed:150});}
      message(g,'바람숲 도전 완료! 주변 경험치를 회수합니다 · 유물 꾸러미는 F로 확인');
    }
    else if(elapsed>=t.wave*6&&t.wave<3){
      const wave=t.wave++;for(let i=0;i<3;i++){
        const a=relicHash(ex.seed,`trial-${wave}-${i}`)/4294967296*Math.PI*2,x=trial.x+Math.cos(a)*285,y=trial.y+Math.sin(a)*285;
        t.pending.push({type:i===2?(wave===2?'spore':'runner'):'shroom',x,y,at:g.time+.65});
        g.effects.push({type:'ring',x,y,r:32,color:'#d7bc83',life:.65,maxLife:.65});
        if(g.effects.length>LIMITS.effects)g.effects.shift();
      }
    }
    for(const entry of t.pending)if(entry.at<=g.time){spawnEnemy(g,entry.type,entry.x,entry.y,{trialWave:true});entry.done=true;}
    t.pending=t.pending.filter(entry=>!entry.done);
  }
  const supply=ex.sites.find(s=>s.id==='supply');if(supply.state==='guarded'&&!g.enemies.some(e=>e.supplyGuard&&!e.dead)){supply.state='ready';message(g,'보급로를 확보했습니다. 꾸러미에서 장비를 선택하세요.');}
  if(nest.state==='active'&&!g.enemies.some(e=>e.id===ex.guardianId)){
    nest.state='cleared';ex.milestones.nestClearedAt=g.time;message(g,'지휘관 처치! 황금 상자를 회수하세요 · 시작 무기 +2 / 진화');
  }
  if(nest.state==='cleared'&&g.chest?.source==='nest'){nest.state='spent';ex.milestones.nestRewardAt=g.time;message(g,'둥지 보상을 확보했습니다. 새 힘으로 경험치를 모아 귀환하세요.');}
  if(g.time>=150&&!ex.beaconCalled){ex.beaconCalled=true;message(g,g.campaign?'3분 수문장 등장까지 30초. 야영지 쪽으로 길을 열어두세요.':'귀환까지 30초. 마지막 공세의 틈을 타 야영지로 돌아갈 길을 고르세요.');}
  if(!g.campaign&&g.time>=180&&!ex.returnCalled){ex.returnCalled=true;message(g,'3분 정찰 완료! 야영지로 돌아가 F를 눌러 귀환하세요.');}
}
export function expeditionObjective(g){
  const ex=g.expedition,supply=ex.sites.find(s=>s.id==='supply'),nest=ex.sites.find(s=>s.id==='nest'),spring=ex.sites.find(s=>s.id==='spring');
  const healing=spring.state==='spent'?'샘 사용 완료':`남쪽 샘: 체력 +40${g.player.hp<g.player.maxHp*.55?' · 회복이 필요합니다':''}`;
  if(!g.campaign&&g.time>=180)return {title:'야영지로 귀환하기',detail:'중앙 야영지에서 F · 정찰을 마무리하세요.'};
  if(g.campaign){
    const stage=campaignStage(g),boss=g.enemies.find(e=>e.bossRole&&!e.dead);
    if(boss)return {title:`${CAMPAIGN_BOSSES[boss.bossRole].name} · ${boss.bossPhase===2?'2페이즈':'1페이즈'} · ${Math.ceil(boss.hp/boss.maxHp*100)}%`,detail:`${boss.mode==='windup'?`${PATTERN_NAMES[boss.attack]} 예고`:boss.mode==='recover'?'공격 뒤 빈틈 · 지금 몰아치세요':'야영지 보스 표식으로 이동'} · ${healing}`};
    if(g.campaign.depth>1)return {title:`${g.campaign.depth}단계 · 강화 공세 돌파`,detail:`다음 버섯왕까지 ${Math.max(0,Math.ceil(finalArrival(g)-g.time))}초 · 최고 돌파 기록에 도전 · ${healing}`};
    const cache=g.pickups.find(p=>p.type==='chest'&&['midpoint','armory'].includes(p.source));
    if(cache)return {title:cache.source==='midpoint'?'수문장의 각성 상자 회수':'후반 정비 상자 회수',detail:'무기 하나를 8단계로 완성·진화 · 원래 전투 위치의 상자 표식'};
    if(stage==='build')return {title:'각성과 연계를 완성하고 최종전 준비',detail:`${g.time<ARMORY_AT?`5분 정비 보급까지 ${Math.ceil(ARMORY_AT-g.time)}초`:g.campaign.armoryClaimed?'정비 완료':'야영지 정비 보급'} · 최종전 ${formatTime(finalArrival(g))}부터 · ${healing}`};
  }
  const trial=ex.sites.find(s=>s.id==='trial');
  if(trial?.state==='active')return {title:`바람숲 도전 · ${Math.max(0,Math.ceil(20-g.time+ex.trial.startedAt))}초`,detail:ex.trial.outside>0?`원 안으로 돌아가세요 · 이탈 ${ex.trial.outside.toFixed(1)} / 1.5초`:'초록 원 안에서 버티세요 · 구르기와 밀치기로 틈 만들기'};
  if(nest.state==='cleared')return {title:'황금 상자 회수하기',detail:`지휘관이 쓰러진 곳 · 시작 무기 +2 / 진화 · ${healing}`};
  if(nest.state==='active'){const boss=g.enemies.find(e=>e.nestGuardian&&!e.dead);return {title:`${GUARDIANS[boss?.guardianStyle]?.name||'둥지 숲지기'} · ${boss?.bossPhase===2?'2페이즈':'1페이즈'}`,detail:`${boss?.mode==='windup'?`${PATTERN_NAMES[boss.attack]} 예고 · `:boss?.mode==='recover'?'공격 뒤 빈틈을 노리세요 · ':'체력 절반에서 패턴 강화 · '}${healing}`};}
  if(g.time>=150)return {title:g.campaign?'수문장 전투를 준비하세요':'야영지로 돌아갈 길 확보',detail:`${g.campaign?'수문장 등장':'귀환'}까지 ${Math.ceil(180-g.time)}초 · ${healing}`};
  if(supply.state!=='spent')return {title:'보급과 회복 샘, 길을 고르세요',detail:`서쪽 보급: ${supply.state==='guarded'?`경비 ${g.enemies.filter(e=>e.supplyGuard&&!e.dead).length}마리`:'장비 선택'} · ${healing}`};
  const id=Object.hasOwn(g.weapons,g.startWeapon)?g.startWeapon:Object.keys(g.weapons)[0],w=g.weapons[id],d=WEAPONS[id];
  return {title:nest.state==='spent'?'새 힘으로 경험치를 회수하세요':'경험치 사냥 · 유물 도전 · 위험 둥지',detail:`${w.evolved?d.evo:`${d.name} ${w.rank}/8 · 촉매 ${g.passives[d.recipe]?'✓':'필요'}`} · ${trial?.state==='ready'?'초록 제단: 20초 도전 · ':''}${healing}`};
}
export function expeditionMarkers(g){
  return [...g.expedition.sites.filter(s=>!(s.id==='nest'&&s.state==='cleared')&&!['spent','abandoned'].includes(s.state)),
    ...g.pickups.filter(item=>['chest','relic'].includes(item.type)).map(item=>({...item,short:item.type==='relic'?'유물 꾸러미':item.source==='nest'?'둥지 상자':item.source==='midpoint'?'각성 상자':item.source==='armory'?'정비 상자':'전리품 상자',color:item.type==='relic'?'#b5d5a3':'#f0d48a'})),
    ...g.enemies.filter(e=>e.bossRole&&!e.dead).map(e=>({id:e.id,x:e.x,y:e.y,short:e.bossRole==='midpoint'?'수문장':'최종 보스',color:e.bossRole==='midpoint'?'#e6c084':'#dfb2c3'}))];
}
