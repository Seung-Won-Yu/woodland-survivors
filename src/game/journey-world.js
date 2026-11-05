import {spawnEnemy,deriveStats,upgradeCandidates,requestJourneyExit,healPlayer} from '../core/game.js';
import {REGIONS,journeyStatus,challengeJourney,advanceJourney,cacheDeck,cacheWeaponChoices} from '../core/journey.js';
import {WEAPONS,PASSIVES} from '../core/content.js';
import {createRelicCache,openRelicCache} from '../core/relics.js';
import {ROCKS,TREE_TRUNKS,TREE_PROPS,TRAILS} from './terrain.js';
export function setupJourneyRegion(g){
 const c=g.campaign,index=c.regionIndex,seed=g.expedition.seed;
 const layout=index===0?{gate:[0,-520],caches:[[-480,-100],[500,280]],spring:[140,620],nest:[690,-460],trial:[-400,420]}:{gate:[0,-650],caches:[[510,-220],[-520,340]],spring:[-550,-380],nest:[650,470],trial:[440,410]};
 const [gx,gy]=index===2?[0,-100]:layout.gate;
 const sites=[{id:'camp',kind:'camp',x:0,y:160,state:'spent',short:'야영지',color:'#d3bc89'},
  {id:'gate',kind:'gate',x:gx,y:gy,state:'ready',short:index===2?'숲의 군주':`${index===0?'수문장':'군락 보스'} 도전`,color:'#e3a890'},
  {id:'exit',kind:'exit',x:gx+130,y:gy+100,state:'locked',short:index===0?'군락 심부로':'수호목 공터로',color:'#bdd9c2'}];
 if(index<2){
  for(let i=0;i<2;i++){const [x,y]=layout.caches[i];sites.push({id:i===0?'supply':'armory-b',kind:'armory',x,y,state:i===0?'guarded':'ready',short:'무기 보급',color:'#e3c482',primary:i===0,deck:cacheDeck(seed,`${index}:${i}`)});}
  sites.push({id:'spring',kind:'spring',x:layout.spring[0],y:layout.spring[1],state:'ready',short:'회복 샘',color:'#9bd6cd'},
   {id:'nest',kind:'nest',x:layout.nest[0],y:layout.nest[1],state:'ready',short:'위험 둥지',color:'#df9c7d'},
   {id:'trial',kind:'trial',x:layout.trial[0],y:layout.trial[1],state:'ready',short:'바람숲 제단',color:'#b8cd9a'});
 }
 if(index===2)sites.splice(0,sites.length,sites.find(s=>s.id==='gate'));g.expedition.sites=sites;g.expedition.trial={startedAt:null,lastAt:g.time,outside:0,wave:0,pending:[]};delete g.expedition.guardianId;
 const nearSite=a=>sites.some(s=>Math.hypot(a.x-s.x,a.y-s.y)<145)||Math.hypot(a.x,a.y-160)<135;
 const mapPoint=a=>index===1?{...a,x:-a.y*.92,y:a.x*.92}:a;
 g.terrain=index===2?Array.from({length:22},(_,i)=>({x:Math.cos(i*Math.PI/11)*760,y:Math.sin(i*Math.PI/11)*760,r:35,kind:'rock',id:i})):[...ROCKS,...TREE_TRUNKS].map(mapPoint).filter(a=>!nearSite(a));
 g.world={region:index,...(index===2?{arenaRadius:640}:{}),props:index===2?TREE_PROPS.filter((_,i)=>i%3===0).map(a=>({...a,x:a.x*1.1,y:a.y*1.1})).filter(a=>Math.hypot(a.x,a.y)>800):TREE_PROPS.map(mapPoint).filter(a=>!nearSite(a)),trails:index===2?[]:index===1?[[[0,160],[180,-80],[510,-220]],[[0,160],[-220,230],[-520,340]],[[0,160],[0,-350],[0,-650]]]:[...TRAILS,[[0,160],[0,-240],[0,-520]]],enteredAt:g.time};
 g.enemies=[];
 if(index<2){
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;spawnEnemy(g,'shroom',Math.cos(a)*300,160+Math.sin(a)*240);}
  const s=sites.find(s=>s.id==='supply');for(let i=0;i<3;i++){const a=i*Math.PI*2/3;spawnEnemy(g,'shroom',s.x+Math.cos(a)*64,s.y+Math.sin(a)*60,{supplyGuard:true,cacheGuard:s.id,home:{x:s.x,y:s.y},patrolAngle:a,hp:index?70:24,maxHp:index?70:24,xp:5,damage:6,speed:42});}
 }else challengeJourney(g,(...args)=>spawnEnemy(g,...args));
 g.expedition.toast=`${REGIONS[index].name} · ${index===0?'무기 보급을 찾아 주력을 키우세요':index===1?'진화와 합체로 군락을 돌파하세요':'완성한 빌드로 숲의 군주를 쓰러뜨리세요'}`;g.expedition.toastUntil=g.time+7;g.events.push({type:'region-arrival'});g.stats=deriveStats(g);
}
export function journeyCacheChoices(g,site){const weapons=cacheWeaponChoices(g,site);if(weapons.length)return weapons;return upgradeCandidates(g).filter(c=>c.owned||c.kind==='passive'||c.kind==='boon').slice(0,3);}
export function openJourneyCache(g,site){if(g.phase!=='playing'||site.kind!=='armory'||site.state!=='ready')return false;g.cacheOffer={siteId:site.id,options:journeyCacheChoices(g,site)};g.phase='cache';return true;}
export function takeJourneyCache(g,index){
 if(g.phase!=='cache'||!Number.isInteger(index))return false;const site=g.expedition.sites.find(s=>s.id===g.cacheOffer?.siteId),choice=g.cacheOffer?.options[index];if(!site||site.state!=='ready'||!choice||!journeyCacheChoices(g,site).some(c=>c.id===choice.id&&c.kind===choice.kind))return false;
 const {id,kind}=choice;
 if(kind==='new-weapon')g.weapons[id]={rank:1,evolved:false,clock:0};else if(kind==='weapon'){g.weapons[id].rank++;g.weapons[id].clock=0;}else if(kind==='passive')g.passives[id]=(g.passives[id]||0)+1;else if(id==='heal')healPlayer(g,g.player.maxHp*.25);else if(id==='power')g.boon={until:g.time+8};else g.metrics.bonusScore=(g.metrics.bonusScore||0)+25;
 if(['new-weapon','weapon'].includes(kind)){g.maxRanks[id]=Math.max(g.maxRanks[id]||0,g.weapons[id].rank);if(!g.discovered.includes(id))g.discovered.push(id);}
 site.state='spent';g.cacheOffer=null;g.phase='playing';g.stats=deriveStats(g);g.events.push({type:'upgrade',id});return true;
}
export function leaveJourneyCache(g){if(g.phase!=='cache')return false;g.cacheOffer=null;g.phase='playing';return true;}
export function journeyInteract(g,site){
 if(site.type==='relic')return openRelicCache(g,g.pickups.find(p=>p.id===site.id));
 if(site.kind==='armory'){if(site.state==='guarded'){g.expedition.toast='보급 경비를 처치하고 무기를 고르세요.';g.expedition.toastUntil=g.time+4;return false;}return openJourneyCache(g,site);}
 if(site.id==='gate'){const started=challengeJourney(g,(...args)=>spawnEnemy(g,...args));if(started){g.expedition.toast=`${REGIONS[g.campaign.regionIndex].boss} · 공격 예고 뒤 빈틈을 노리세요.`;g.expedition.toastUntil=g.time+5;}return started;}
 if(site.id==='exit')return requestJourneyExit(g);
 return null;
}
export function updateJourneyWorld(g){
 const c=g.campaign,ex=g.expedition;
 if(c.transitionPending&&g.phase==='playing'&&g.pendingLevels===0){if(advanceJourney(g))setupJourneyRegion(g);return;}
 for(const s of ex.sites)if(s.kind==='armory'&&s.state==='guarded'&&!g.enemies.some(e=>e.cacheGuard===s.id&&!e.dead)){s.state='ready';ex.toast='보급로 확보 · F로 새 무기를 고르세요.';ex.toastUntil=g.time+5;}
 const exit=ex.sites.find(s=>s.id==='exit'),gate=ex.sites.find(s=>s.id==='gate');if(exit)exit.state=journeyStatus(g).canExit?'ready':'locked';if(gate&&c.stageState!=='hunting')gate.state='spent';
 const nest=ex.sites.find(s=>s.id==='nest');if(nest?.state==='active'&&!g.enemies.some(e=>e.id===ex.guardianId&&!e.dead))nest.state='cleared';
 const trial=ex.sites.find(s=>s.id==='trial'),t=ex.trial;if(trial?.state!=='active'||g.phase!=='playing')return;
 const dt=Math.max(0,g.time-t.lastAt);t.lastAt=g.time;t.outside=Math.hypot(g.player.x-trial.x,g.player.y-trial.y)>240?t.outside+dt:0;
 if(t.outside>1.5){trial.state='abandoned';return;}
 if(g.time-t.startedAt>=20){trial.state='spent';ex.milestones.trialClearedAt=g.time;createRelicCache(g,'trial',trial.x,trial.y+45);return;}
 if(g.time-t.startedAt>=t.wave*6&&t.wave<3){t.wave++;for(let i=0;i<3;i++){const a=(t.wave+i)*2.4;spawnEnemy(g,i===2?'runner':'shroom',trial.x+Math.cos(a)*300,trial.y+Math.sin(a)*300,{trialWave:true});}}
}
