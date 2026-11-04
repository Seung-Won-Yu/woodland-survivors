import {synergyAction,synergyReady} from './synergies.js';
export const RELIC_LIMIT=2;
export const RELICS={
  wind:{name:'바람 방울',tag:'이동 · 관통',color:'#bce0bc',description:'24m 이동하면 충전. 다음 무기 적중에서 관통 돌풍이 나갑니다.',pair:'motion'},
  thread:{name:'매듭 실타래',tag:'이동 · 추격',color:'#dfb58c',description:'살아남은 적 하나에 실을 묶습니다. 12m 이동하면 그 적에게 추가 피해.',pair:'motion'},
  shell:{name:'도토리 갑주',tag:'정지 · 방어',color:'#ddc28b',description:'0.7초 멈추면 피해 12를 막는 보호막. 소진 후 재생성 간격 8초.',pair:'anchor'},
  thorn:{name:'가시 매듭',tag:'밀침 · 광역',color:'#b2cd8a',description:'무기로 밀쳐낸 적을 2초 안에 다시 맞히면 주변에 가시 파열. 간격 1.2초.',pair:'anchor'},
  seed:{name:'생명씨 주머니',tag:'처치 · 회수',color:'#b7d695',description:'무기로 12마리 처치하면 회복 +8 씨앗이 떨어집니다. 최대 2개, 16초 유지.',pair:'recovery'},
  tide:{name:'물결 조개',tag:'회복 · 돌파',color:'#a5d8db',description:'일반 회복으로 실제 체력 15를 채우면 밀쳐내는 파동. 간격 6초. 유물 회복은 제외.',pair:'recovery'}
};
export const RELIC_IDS=Object.keys(RELICS);
export function relicHash(seed,salt=''){
  let n=seed>>>0;for(const ch of salt)n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;return n>>>0;
}
export function createRelics(){return {items:[],wind:{distance:0,readyAt:0},thread:{target:0,walk:0,expiresAt:0,readyAt:0},shell:{shield:0,readyAt:0},thorn:{readyAt:0},seed:{kills:0,readyAt:0},tide:{healing:0,readyAt:0},stats:Object.fromEntries(RELIC_IDS.map(id=>[id,{procs:0,damage:0,healed:0,absorbed:0}])),discovered:[],history:[]};}
export function createRelicCache(g,source,x,y){
  const seed=g.expedition?.seed??g.initialSeed??0,roll=relicHash(seed,source);
  const motion=roll%2?'wind':'thread',anchor=roll%4<2?'shell':'thorn';
  const front=source==='supply'?[motion,anchor]:source==='trial'?[roll%2?'seed':'tide',roll%4<2?'wind':'thorn']:[];
  const rest=RELIC_IDS.filter(id=>!front.includes(id)).sort((a,b)=>relicHash(roll,a)-relicHash(roll,b));
  const cache={id:++g.id,type:'relic',source,x,y,deck:[...front,...rest]};g.pickups.push(cache);return cache;
}
export function openRelicCache(g,cache){
  if(g.phase!=='playing'||cache?.type!=='relic'||!g.pickups.includes(cache))return false;
  const options=cache.deck.filter(id=>!g.relics.items.includes(id)).slice(0,2);
  if(!options.length)return false;
  g.relicOffer={cacheId:cache.id,source:cache.source,options,selected:null};g.phase='relic';return true;
}
export function equipRelic(g,id,replace=null){
  const offer=g.relicOffer;if(g.phase!=='relic'||!offer?.options.includes(id)||!Object.hasOwn(RELICS,id)||g.relics.items.includes(id))return false;
  if(g.relics.items.length>=RELIC_LIMIT){if(!g.relics.items.includes(replace)){offer.selected=id;return false;}g.relics.items.splice(g.relics.items.indexOf(replace),1);}
  const fresh=createRelics();if(replace)g.relics[replace]=fresh[replace];g.relics[id]=fresh[id];g.relics.items.push(id);
  if(!g.relics.discovered.includes(id))g.relics.discovered.push(id);
  g.relics.history.push({time:Math.round(g.time),source:offer.source,id,replace});g.relics.history=g.relics.history.slice(-12);
  g.pickups=g.pickups.filter(p=>p.id!==offer.cacheId);g.relicOffer=null;g.phase='playing';g.player.invincible=Math.max(g.player.invincible,.8);g.events.push({type:'upgrade',id});return true;
}
export function leaveRelicCache(g){if(g.phase!=='relic')return false;g.relicOffer=null;g.phase='playing';return true;}

function proc(g,id,action){g.relics.stats[id].procs++;g.events.push({type:'relic-proc',relic:id});return {...action,relicId:id};}
export function tickRelics(g,moved){
  const r=g.relics,actions=[];if(!r.items.length)return actions;
  if(r.items.includes('wind'))r.wind.distance=Math.min(240,r.wind.distance+moved);
  if(r.items.includes('shell')&&r.shell.shield===0&&g.player.still>=.7&&g.time>=r.shell.readyAt){r.shell.shield=12;actions.push(proc(g,'shell',{kind:'shield'}));}
  if(r.items.includes('thread')&&r.thread.target){
    const target=g.enemies.find(e=>e.id===r.thread.target&&!e.dead);
    if(!target||g.time>=r.thread.expiresAt||Math.hypot(target.x-g.player.x,target.y-g.player.y)>700){r.thread.target=0;r.thread.readyAt=g.time+.6;}
    else if(g.player.walk-r.thread.walk>=120){actions.push(proc(g,'thread',synergyAction(g,'swarm',{kind:'target',target:target.id,damage:(24+g.level*1.6)*g.stats.damage})));r.thread.target=0;r.thread.readyAt=g.time+1.8;}
  }
  return actions;
}
export function onRelicWeaponHit(g,e,{source},wasKnocked,angle){
  const r=g.relics,actions=[];if(source!=='weapon'||!r.items.length)return actions;
  if(r.items.includes('wind')&&r.wind.distance>=240&&g.time>=r.wind.readyAt){r.wind.distance=0;r.wind.readyAt=g.time+.8;actions.push(proc(g,'wind',synergyAction(g,'gale',{kind:'wind',x:e.x,y:e.y,angle,damage:(18+g.level*1.2)*g.stats.damage})));}
  if(r.items.includes('thread')&&!e.dead&&!r.thread.target&&g.time>=r.thread.readyAt){r.thread={target:e.id,walk:g.player.walk,expiresAt:g.time+4.5,readyAt:r.thread.readyAt};}
  if(r.items.includes('thorn')&&wasKnocked&&g.time>=r.thorn.readyAt){r.thorn.readyAt=g.time+1.2;actions.push(proc(g,'thorn',synergyAction(g,'bramble',{kind:'burst',x:e.x,y:e.y,r:75,damage:(10+g.level*.7)*g.stats.damage,knock:25})));}
  return actions;
}
export function onRelicWeaponKill(g,e,{source}){
  const r=g.relics;if(source!=='weapon'||!r.items.includes('seed'))return [];
  r.seed.kills=Math.min(12,r.seed.kills+1);
  if(r.seed.kills>=12&&g.time>=r.seed.readyAt&&g.pickups.filter(p=>p.relicId==='seed').length<2){r.seed.kills=0;r.seed.readyAt=g.time+5;return [proc(g,'seed',synergyAction(g,'garden',{kind:'seed',x:e.x,y:e.y}))];}
  return [];
}
export function onRelicHealing(g,actual,source){
  const r=g.relics;if(actual<=0||source==='relic'||!r.items.includes('tide'))return [];
  r.tide.healing=Math.min(15,r.tide.healing+actual);
  if(r.tide.healing>=15&&g.time>=r.tide.readyAt){r.tide.healing=0;r.tide.readyAt=g.time+6;return [proc(g,'tide',synergyAction(g,'conductor',{kind:'burst',x:g.player.x,y:g.player.y,r:170,damage:(20+g.level*1.2)*g.stats.damage,knock:220}))];}
  return [];
}
export function absorbRelicShield(g,value){
  if(!g.relics.items.includes('shell')||g.relics.shell.shield<=0)return 0;
  const absorbed=Math.min(value,g.relics.shell.shield);g.relics.shell.shield-=absorbed;g.relics.stats.shell.absorbed+=absorbed;
  if(g.relics.shell.shield===0)g.relics.shell.readyAt=g.time+8;return absorbed;
}
export function onRelicShieldBreak(g){return synergyReady(g,'bastion')?[{...synergyAction(g,'bastion',{kind:'burst',x:g.player.x,y:g.player.y,r:115,damage:(12+g.level*.8)*g.stats.damage,knock:160}),relicId:'shell'}]:[];}
export function relicReadout(g,id){
  const r=g.relics,n=r.stats[id].procs;
  if(id==='wind')return r.wind.distance>=240?'돌풍 준비':`충전 ${Math.floor(r.wind.distance/2.4)}%`;
  if(id==='thread')return r.thread.target?'이동하면 결산':`${n}회 발동`;
  if(id==='shell')return r.shell.shield>0?`보호막 ${Math.ceil(r.shell.shield)}`:g.time<r.shell.readyAt?`${Math.ceil(r.shell.readyAt-g.time)}초`:'멈추면 충전';
  if(id==='seed')return `${r.seed.kills}/12 처치`;
  if(id==='tide')return `${Math.floor(r.tide.healing)}/15 회복`;
  return `${n}회 파열`;
}
export function validRelics(r){
  if(!r||!Array.isArray(r.items)||r.items.length>2||new Set(r.items).size!==r.items.length||r.items.some(id=>!Object.hasOwn(RELICS,id)))return false;
  const number=(n,max=1e8)=>Number.isFinite(n)&&n>=0&&n<=max;
  const fields={wind:['distance','readyAt'],thread:['target','walk','expiresAt','readyAt'],shell:['shield','readyAt'],thorn:['readyAt'],seed:['kills','readyAt'],tide:['healing','readyAt']};
  for(const id of RELIC_IDS){if(!r[id]||!r.stats?.[id]||fields[id].some(k=>!number(r[id][k]))||['procs','damage','healed','absorbed'].some(k=>!number(r.stats[id][k])))return false;}
  return Number.isInteger(r.thread.target)&&Number.isInteger(r.seed.kills)&&r.wind.distance<=240&&r.shell.shield<=12&&r.seed.kills<=12&&r.tide.healing<=15&&Array.isArray(r.discovered)&&r.discovered.length<=6&&new Set(r.discovered).size===r.discovered.length&&r.discovered.every(id=>Object.hasOwn(RELICS,id))&&Array.isArray(r.history)&&r.history.length<=12&&r.history.every(h=>Object.hasOwn(RELICS,h.id)&&number(h.time,1800)&&['supply','trial','nest'].includes(h.source)&&(h.replace===null||Object.hasOwn(RELICS,h.replace)));
}
