import {createGame,spawnEnemy,deriveStats,openChest} from '../core/game.js';
import {normalizeProfile} from '../core/profile.js';
import {BASE_WEAPON_IDS,HEROES,WEAPONS,SLOT_LIMIT} from '../core/content.js';
import {ROCKS} from './terrain.js';
export const SAVE_KEY='woodland-independent-settings-v1';
export const SITES=[
  {id:'supply',name:'잃어버린 보급',short:'보급',x:-520,y:-130,color:'#e5b76a',hint:'장비를 고르고 시작 무기 +2'},
  {id:'nest',name:'가시버섯 둥지',short:'위험 둥지',x:520,y:-360,color:'#e58f71',hint:'둥지를 깨우면 정예 등장 · 진화 상자'},
  {id:'spring',name:'반딧불 샘',short:'회복 샘',x:100,y:510,color:'#9bd6cd',hint:'한 번 회복 +40 · 아직 남겨둘 수 있음'},
  {id:'camp',name:'수호대 야영지',short:'귀환',x:0,y:70,color:'#ebdca5',hint:'3분 생존 후 이곳으로 귀환'}
];
export function createExpedition(hero='pip',weapon=HEROES[hero].weapon,seed=1437){
  const profile=normalizeProfile({bestTime:120,kills:500,elites:1,evolved:['acorn'],lanternRank:4,stormRank:4});
  const g=createGame(profile,hero,false,seed);
  g.weapons={[weapon]:{rank:1,evolved:false,clock:.15}};g.discovered=[weapon];g.maxRanks={[weapon]:1};g.pool=[...BASE_WEAPON_IDS];
  g.startWeapon=weapon;g.terrain=ROCKS;g.gear=null;g.nextElite=105;g.player.charge=45;
  g.expedition={sites:SITES.map(s=>({...s,state:'ready'})),nestKills:0,complete:false,log:[],toast:'보급 연기가 보입니다. 서쪽 길을 따라가세요.',toastUntil:8};
  return g;
}
export function message(g,text){g.expedition.toast=text;g.expedition.toastUntil=g.time+5;g.expedition.log.push({time:Math.round(g.time),text});}
export function nearestSite(g){return g.expedition.sites.find(s=>s.state==='ready'&&Math.hypot(s.x-g.player.x,s.y-g.player.y)<76);}
export function interact(g){
  if(g.phase!=='playing')return false;
  const s=nearestSite(g);if(!s)return false;
  if(s.id==='supply'){g.phase='supply';return true;}
  if(s.id==='spring'){if(g.player.hp>=g.player.maxHp){message(g,'지금은 건강합니다. 샘을 남겨두세요.');return false;}g.player.hp=Math.min(g.player.maxHp,g.player.hp+40);s.state='spent';message(g,'반딧불 샘 · 체력 +40');g.events.push({type:'heal'});return true;}
  if(s.id==='nest'){
    s.state='active';const boss=spawnEnemy(g,'elite',s.x,s.y,{hp:300,maxHp:300,canEvolve:true,nestGuardian:true});
    g.expedition.guardianId=boss.id;
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;spawnEnemy(g,i%3===0?'runner':'shroom',s.x+Math.cos(a)*140,s.y+Math.sin(a)*130);}
    message(g,'둥지가 깨어났습니다! 붉은 지휘관을 처치하세요.');return true;
  }
  if(s.id==='camp'){
    if(g.time<180){message(g,`귀환까지 ${Math.ceil(180-g.time)}초 · 보급과 둥지를 탐색하세요.`);return false;}
    g.expedition.complete=true;g.phase='result';g.outcome='scouted';return true;
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
  g.gear=gear;s.state='spent';const w=g.weapons[g.startWeapon];
  if(w&&!w.evolved){w.rank=Math.min(WEAPONS[g.startWeapon].max,w.rank+2);g.maxRanks[g.startWeapon]=w.rank;}
  g.passives[recipe]=Math.max(g.passives[recipe]||0,1);
  g.phase='playing';g.stats=deriveStats(g);message(g,`${gear==='boots'?'순찰 장화':'나무껍질 망토'} 장착 · 시작 무기 +2, 진화 촉매 획득`);return true;
}
export function updateExpedition(g){
  const ex=g.expedition,nest=ex.sites.find(s=>s.id==='nest');
  if(nest.state==='active'&&!g.enemies.some(e=>e.id===ex.guardianId)){
    nest.state='spent';message(g,'둥지 정리 완료 · 상자는 무기 8단계 + 촉매일 때 진화합니다.');
  }
  if(g.time>=180&&!ex.returnCalled){ex.returnCalled=true;message(g,'3분 정찰 완료! 야영지로 돌아가 F를 눌러 귀환하세요.');}
}
