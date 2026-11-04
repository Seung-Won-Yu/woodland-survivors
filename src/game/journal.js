import {HEROES,BASE_WEAPON_IDS} from '../core/content.js';
import {RELIC_IDS} from '../core/relics.js';
export const JOURNAL_KEY='woodland-expedition-journal-v1';
const uint=n=>Number.isInteger(n)&&n>=0&&n<=4294967295;
export function normalizeJournal(raw){
  const j={discovered:[],runs:[],returns:0,bestLevel:0};
  if(!raw||typeof raw!=='object')return j;
  j.discovered=[...new Set(Array.isArray(raw.discovered)?raw.discovered.filter(id=>RELIC_IDS.includes(id)):[])];
  j.returns=Number.isSafeInteger(raw.returns)&&raw.returns>=0?raw.returns:0;
  j.bestLevel=Number.isSafeInteger(raw.bestLevel)&&raw.bestLevel>=0?Math.min(9999,raw.bestLevel):0;
  const seen=new Set();
  for(const r of Array.isArray(raw.runs)?raw.runs:[]){
    if(j.runs.length===12)break;
    if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(r.id)||seen.has(r.id)||!uint(r.seed)||!Object.hasOwn(HEROES,r.hero)||!BASE_WEAPON_IDS.includes(r.weapon)||!Number.isFinite(r.time)||r.time<0||r.time>1800||!Number.isInteger(r.level)||r.level<1||r.level>9999||!Number.isInteger(r.kills)||r.kills<0||r.kills>1e8)continue;
    seen.add(r.id);j.runs.push({id:r.id,seed:r.seed,hero:r.hero,weapon:r.weapon,time:Math.round(r.time),level:r.level,kills:r.kills,returned:r.returned===true,trial:r.trial===true,relics:[...new Set(Array.isArray(r.relics)?r.relics.filter(id=>RELIC_IDS.includes(id)):[])].slice(0,2)});
  }
  return j;
}
export function discoverRelics(j,ids){j.discovered=[...new Set([...j.discovered,...ids.filter(id=>RELIC_IDS.includes(id))])];return j;}
export function recordRun(j,g){
  if(g.phase!=='result'||j.runs.some(r=>r.id===g.runId))return false;
  const returned=g.outcome==='scouted';
  j.runs.unshift({id:g.runId,seed:g.expedition.seed,hero:g.hero,weapon:g.startWeapon,time:Math.round(g.time),level:g.level,kills:g.kills,returned,trial:!!g.expedition.milestones.trialClearedAt,relics:[...g.relics.items]});j.runs=j.runs.slice(0,12);
  if(returned)j.returns++;j.bestLevel=Math.max(j.bestLevel,g.level);discoverRelics(j,g.relics.discovered);return true;
}
