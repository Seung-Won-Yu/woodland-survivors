import {HEROES,WEAPONS,BASE_WEAPON_IDS,PASSIVES,UPGRADES,GOALS} from './content.js';
// Isolated from both the public Ash profile and the discarded v1 prototype.
export const PROFILE_KEY='woodland-independent-profile-v2';
export const RUN_KEY='woodland-independent-run-v2';
const count=(v,max=1e9)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const array=(v,valid,max=100)=>[...new Set(Array.isArray(v)?v.filter(valid).slice(0,max):[])];
export function normalizeProfile(raw){
  const p=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const known=new Set([...Object.keys(WEAPONS),...Object.keys(PASSIVES)]);
  return {version:2,bankedRuns:array(p.bankedRuns,id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id),50),gold:count(p.gold),runs:count(p.runs),kills:count(p.kills),elites:count(p.elites),kingKills:count(p.kingKills),wins:count(p.wins),bestTime:count(p.bestTime,1800),lanternRank:count(p.lanternRank,8),stormRank:count(p.stormRank,8),
    upgrades:Object.fromEntries(Object.entries(UPGRADES).map(([id,u])=>[id,count(p.upgrades?.[id],u.max)])),
    seen:array(p.seen,id=>known.has(id)),evolved:array(p.evolved,id=>BASE_WEAPON_IDS.includes(id)),unions:array(p.unions,id=>WEAPONS[id]?.union===true),
    records:(Array.isArray(p.records)?p.records:[]).slice(0,12).filter(r=>r&&Object.hasOwn(HEROES,r.hero)).map(r=>({hero:r.hero,time:count(r.time,1800),kills:count(r.kills),level:count(r.level,999),gold:count(r.gold),win:r.win===true,hard:r.hard===true,weapons:array(r.weapons,id=>Object.hasOwn(WEAPONS,id),6),evolved:array(r.evolved,id=>BASE_WEAPON_IDS.includes(id),8),unions:array(r.unions,id=>WEAPONS[id]?.union===true,2)}))};
}
export function unlocked(p,id){
  if(id==='pip')return true;
  const goal=GOALS.find(g=>g.id===id);
  return goal?goal.value(p)>=goal.target:false;
}
export function weaponPool(p){return BASE_WEAPON_IDS.filter(id=>id!=='storm'||unlocked(p,'storm'));}
export function upgradeCost(p,id){return Math.round(UPGRADES[id].base*(1+(p.upgrades[id]||0)*.8));}
export function buyUpgrade(p,id){
  if(!Object.hasOwn(UPGRADES,id))return false;
  const cost=upgradeCost(p,id);
  if(p.upgrades[id]>=UPGRADES[id].max||p.gold<cost)return false;
  p.gold-=cost;p.upgrades[id]++;return true;
}
export function refundUpgrades(p){let gold=0;for(const [id,u] of Object.entries(UPGRADES)){for(let rank=0;rank<p.upgrades[id];rank++)gold+=Math.round(u.base*(1+rank*.8));p.upgrades[id]=0;}p.gold+=gold;return gold;}
export function bankRun(p,g){
  if(g.banked||!g.outcome||(g.runId&&p.bankedRuns.includes(g.runId)))return {gold:0,newGoals:[]};
  const before=new Set(GOALS.filter(goal=>unlocked(p,goal.id)).map(goal=>goal.id));
  const gold=Math.floor(g.gold+g.kills/120+g.time/20+(g.outcome==='victory'?180:0));
  if(g.runId){p.bankedRuns.unshift(g.runId);p.bankedRuns=p.bankedRuns.slice(0,50);}
  p.gold+=gold;p.kills+=g.kills;p.elites+=g.elites;p.kingKills+=g.kingKills||0;p.runs++;p.bestTime=Math.max(p.bestTime,Math.floor(g.time));p.wins+=Number(g.outcome==='victory');
  p.lanternRank=Math.max(p.lanternRank,g.maxRanks?.lantern||g.weapons.lantern?.rank||0);
  p.stormRank=Math.max(p.stormRank,g.maxRanks?.storm||g.weapons.storm?.rank||0);
  p.seen=[...new Set([...p.seen,...(g.discovered||Object.keys(g.weapons)),...Object.keys(g.passives)])];
  const evolved=g.evolutions||Object.keys(g.weapons).filter(id=>BASE_WEAPON_IDS.includes(id)&&g.weapons[id].evolved);
  p.evolved=[...new Set([...p.evolved,...evolved])];p.unions=[...new Set([...p.unions,...(g.unions||[])])];
  p.records.unshift({hero:g.hero,time:Math.floor(g.time),kills:g.kills,level:g.level,gold,win:g.outcome==='victory',hard:g.hard,weapons:Object.keys(g.weapons),evolved:[...evolved],unions:[...(g.unions||[])]});
  p.records=p.records.slice(0,12);g.banked=true;
  return {gold,newGoals:GOALS.filter(goal=>!before.has(goal.id)&&unlocked(p,goal.id)).map(goal=>goal.id)};
}
