import {createGame,spawnEnemy,deriveStats} from '../core/game.js';
import {normalizeProfile} from '../core/profile.js';
import {BASE_WEAPON_IDS,HEROES,WEAPONS,SLOT_LIMIT} from '../core/content.js';
import {ROCKS,TREE_TRUNKS,LANDMARKS} from './terrain.js';
export const SAVE_KEY='woodland-independent-settings-v1';
export const SITES=[
  {id:'supply',name:'잃어버린 보급',short:'보급',...LANDMARKS.supply,color:'#e5b76a',hint:'주변 버섯 제거 → 장비와 시작 무기 +1'},
  {id:'nest',name:'가시버섯 둥지',short:'위험 둥지',...LANDMARKS.nest,color:'#e58f71',hint:'둥지를 깨우면 정예 등장 · 진화 상자'},
  {id:'spring',name:'반딧불 샘',short:'회복 샘',...LANDMARKS.spring,color:'#9bd6cd',hint:'한 번 회복 +40 · 아직 남겨둘 수 있음'},
  {id:'camp',name:'수호대 야영지',short:'귀환',...LANDMARKS.camp,color:'#ebdca5',hint:'3분 생존 후 이곳으로 귀환'}
];
export function createExpedition(hero='pip',weapon=HEROES[hero].weapon,seed=1437){
  const profile=normalizeProfile({bestTime:120,kills:500,elites:1,evolved:['acorn'],lanternRank:4,stormRank:4});
  const g=createGame(profile,hero,false,seed);
  g.weapons={[weapon]:{rank:1,evolved:false,clock:.15}};g.discovered=[weapon];g.maxRanks={[weapon]:1};g.pool=[...BASE_WEAPON_IDS];
  g.startWeapon=weapon;g.terrain=[...ROCKS,...TREE_TRUNKS];g.gear=null;g.nextElite=105;g.player.charge=35;
  g.expedition={sites:SITES.map(s=>({...s,state:'ready'})),nestKills:0,complete:false,log:[],milestones:{},toast:'서쪽은 보급, 남쪽은 회복 샘. 길을 골라 경험치를 모으세요.',toastUntil:8};
  g.enemies=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',Math.cos(a)*280,Math.sin(a)*240);}
  const supply=g.expedition.sites.find(s=>s.id==='supply');supply.state='guarded';
  for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',supply.x+Math.cos(a)*76,supply.y+Math.sin(a)*65,{supplyGuard:true,home:{x:supply.x,y:supply.y},patrolAngle:a,hp:42,maxHp:42,xp:4,damage:6,speed:46});}
  return g;
}
export function message(g,text){g.expedition.toast=text;g.expedition.toastUntil=g.time+5;g.expedition.log.push({time:Math.round(g.time),text});}
export function nearestSite(g){return g.expedition.sites.find(s=>['ready','guarded'].includes(s.state)&&Math.hypot(s.x-g.player.x,s.y-g.player.y)<76);}
export function interact(g){
  if(g.phase!=='playing')return false;
  const s=nearestSite(g);if(!s)return false;
  if(s.id==='supply'){if(s.state==='guarded'){message(g,'보급 주위 버섯을 물리치면 꾸러미를 회수할 수 있습니다.');return false;}g.phase='supply';return true;}
  if(s.id==='spring'){if(g.player.hp>=g.player.maxHp){message(g,'지금은 건강합니다. 샘을 남겨두세요.');return false;}g.player.hp=Math.min(g.player.maxHp,g.player.hp+40);s.state='spent';g.expedition.milestones.springAt=g.time;message(g,'반딧불 샘 · 체력 +40');g.events.push({type:'heal'});return true;}
  if(s.id==='nest'){
    const hp=360+g.time*3;s.state='active';const boss=spawnEnemy(g,'elite',s.x,s.y+105,{hp,maxHp:hp,speed:42,clock:2.4,canEvolve:true,nestGuardian:true});
    g.expedition.guardianId=boss.id;
    g.expedition.milestones.nestAt=g.time;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;spawnEnemy(g,'shroom',s.x+Math.cos(a)*145,s.y+Math.sin(a)*130);}
    message(g,'둥지가 깨어났습니다! 붉은 포자 예고에서 벗어나세요.');return true;
  }
  if(s.id==='camp'){
    if(g.time<180){message(g,`귀환까지 ${Math.ceil(180-g.time)}초 · 보급과 둥지를 탐색하세요.`);return false;}
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
  g.phase='playing';g.stats=deriveStats(g);message(g,`${gear==='boots'?'순찰 장화':'나무껍질 망토'} 장착 · 시작 무기 +1, 진화 촉매 획득`);return true;
}
export function updateExpedition(g){
  const ex=g.expedition,nest=ex.sites.find(s=>s.id==='nest');
  const supply=ex.sites.find(s=>s.id==='supply');if(supply.state==='guarded'&&!g.enemies.some(e=>e.supplyGuard&&!e.dead)){supply.state='ready';message(g,'보급로를 확보했습니다. 꾸러미에서 장비를 선택하세요.');}
  if(nest.state==='active'&&!g.enemies.some(e=>e.id===ex.guardianId)){
    nest.state='cleared';ex.milestones.nestClearedAt=g.time;message(g,'지휘관 처치! 황금 상자를 회수하세요 · 시작 무기 +2 / 진화');
  }
  if(nest.state==='cleared'&&g.chest?.source==='nest'){nest.state='spent';ex.milestones.nestRewardAt=g.time;message(g,'둥지 보상을 확보했습니다. 새 힘으로 경험치를 모아 귀환하세요.');}
  if(g.time>=150&&!ex.beaconCalled){ex.beaconCalled=true;message(g,'귀환까지 30초. 마지막 공세의 틈을 타 야영지로 돌아갈 길을 고르세요.');}
  if(g.time>=180&&!ex.returnCalled){ex.returnCalled=true;message(g,'3분 정찰 완료! 야영지로 돌아가 F를 눌러 귀환하세요.');}
}
export function expeditionObjective(g){
  const ex=g.expedition,supply=ex.sites.find(s=>s.id==='supply'),nest=ex.sites.find(s=>s.id==='nest'),spring=ex.sites.find(s=>s.id==='spring');
  const healing=spring.state==='spent'?'샘 사용 완료':`남쪽 샘: 체력 +40${g.player.hp<g.player.maxHp*.55?' · 회복이 필요합니다':''}`;
  if(g.time>=180)return {title:'야영지로 귀환하기',detail:'중앙 야영지에서 F · 정찰을 마무리하세요.'};
  if(nest.state==='cleared')return {title:'황금 상자 회수하기',detail:`지휘관이 쓰러진 곳 · 시작 무기 +2 / 진화 · ${healing}`};
  if(nest.state==='active')return {title:'포자 예고를 피하며 지휘관 처치',detail:`체력 절반에서 돌격병 합류 · ${healing}`};
  if(g.time>=150)return {title:'야영지로 돌아갈 길 확보',detail:`귀환까지 ${Math.ceil(180-g.time)}초 · ${healing}`};
  if(supply.state!=='spent')return {title:'보급과 회복 샘, 길을 고르세요',detail:`서쪽 보급: ${supply.state==='guarded'?`경비 ${g.enemies.filter(e=>e.supplyGuard&&!e.dead).length}마리`:'장비 선택'} · ${healing}`};
  const id=Object.hasOwn(g.weapons,g.startWeapon)?g.startWeapon:Object.keys(g.weapons)[0],w=g.weapons[id],d=WEAPONS[id];
  return {title:nest.state==='spent'?'새 힘으로 경험치를 회수하세요':'경험치를 모으거나 둥지에 도전하세요',detail:`${w.evolved?d.evo:`${d.name} ${w.rank}/8 · 촉매 ${g.passives[d.recipe]?'✓':'필요'}`} · ${nest.state==='ready'?'둥지는 +2 / 진화 · ':''}${healing}`};
}
export function expeditionMarkers(g){
  return [...g.expedition.sites.filter(s=>!(s.id==='nest'&&s.state==='cleared')),
    ...g.pickups.filter(item=>item.type==='chest').map(item=>({...item,short:item.source==='nest'?'둥지 상자':'전리품 상자',color:'#f0d48a'}))];
}
