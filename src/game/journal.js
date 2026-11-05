import {RULESET} from '../core/journey.js';
import {HEROES,BASE_WEAPON_IDS} from '../core/content.js';
import {RELIC_IDS} from '../core/relics.js';
import {SYNERGY_IDS} from '../core/synergies.js';
export const JOURNAL_KEY='woodland-expedition-journal-v1';
const knownRuleset=r=>['expedition-v09',RULESET].includes(r);
const recordKey=r=>`${r.ruleset||'expedition-v09'}:${r.hero}:${r.style||'none'}:${r.difficulty}`;
const uint=n=>Number.isInteger(n)&&n>=0&&n<=4294967295;
export function normalizeJournal(raw){
  const j={discovered:[],synergies:[],runs:[],returns:0,clears:0,bestLevel:0,bestStage:0,bestKills:0,bestStreak:0,fastestClear:null,frontierHeroes:{},journeyRuns:[],journeyBest:{}};
  if(!raw||typeof raw!=='object')return j;
  for(const id of Object.keys(HEROES)){const r=raw.frontierHeroes?.[id];if(r&&['stage','kills','level'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<=1e8))j.frontierHeroes[id]={stage:r.stage,kills:r.kills,level:r.level,fastest:Number.isFinite(r.fastest)&&r.fastest>0&&r.fastest<=1e9?r.fastest:null};}
  j.discovered=[...new Set(Array.isArray(raw.discovered)?raw.discovered.filter(id=>RELIC_IDS.includes(id)):[])];
  j.synergies=[...new Set(Array.isArray(raw.synergies)?raw.synergies.filter(id=>SYNERGY_IDS.includes(id)):[])];
  j.returns=Number.isSafeInteger(raw.returns)&&raw.returns>=0?raw.returns:0;
  j.clears=Number.isSafeInteger(raw.clears)&&raw.clears>=0?raw.clears:0;
  for(const k of ['bestStage','bestKills','bestStreak'])j[k]=Number.isSafeInteger(raw[k])&&raw[k]>=0?Math.min(1e8,raw[k]):0;
  j.fastestClear=Number.isFinite(raw.fastestClear)&&raw.fastestClear>=420&&raw.fastestClear<=1e9?raw.fastestClear:null;
  j.bestLevel=Number.isSafeInteger(raw.bestLevel)&&raw.bestLevel>=0?Math.min(9999,raw.bestLevel):0;
  j.journeyRuns=(Array.isArray(raw.journeyRuns)?raw.journeyRuns:[]).filter(r=>r&&typeof r.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(r.id)&&knownRuleset(r.ruleset)&&Object.hasOwn(HEROES,r.hero)&&BASE_WEAPON_IDS.includes(r.weapon)&&['normal','dense'].includes(r.difficulty)&&Number.isFinite(r.time)&&r.time>=0&&r.time<1e9&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<=3&&Number.isInteger(r.level)&&r.level>=1&&r.level<10000&&Number.isInteger(r.kills)&&r.kills>=0&&r.kills<1e8&&[null,'spread','focus','guard','counter'].includes(r.style)).slice(0,24).map(r=>({...r,cleared:r.stage===3&&r.cleared===true,finalized:r.finalized===true}));
  for(const r of Object.values(raw.journeyBest||{}))if(r&&knownRuleset(r.ruleset||'expedition-v09')&&Object.hasOwn(HEROES,r.hero)&&[null,'spread','focus','guard','counter'].includes(r.style)&&['normal','dense'].includes(r.difficulty)&&['stage','kills','level'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<=1e8)&&(r.fastest===null||Number.isFinite(r.fastest)&&r.fastest>0&&r.fastest<1e9))j.journeyBest[recordKey(r)]={ruleset:r.ruleset||'expedition-v09',hero:r.hero,style:r.style,difficulty:r.difficulty,stage:Math.min(3,r.stage),kills:r.kills,level:r.level,fastest:r.fastest};
  for(const r of j.journeyRuns)mergeJourneyBest(j,r);
  const seen=new Set();
  for(const r of Array.isArray(raw.runs)?raw.runs:[]){
    if(j.runs.length===12)break;
    if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(r.id)||seen.has(r.id)||!uint(r.seed)||!Object.hasOwn(HEROES,r.hero)||!BASE_WEAPON_IDS.includes(r.weapon)||!Number.isFinite(r.time)||r.time<0||r.time>1e9||!Number.isInteger(r.level)||r.level<1||r.level>9999||!Number.isInteger(r.kills)||r.kills<0||r.kills>1e8)continue;
    seen.add(r.id);j.runs.push({id:r.id,seed:r.seed,hero:r.hero,weapon:r.weapon,time:Math.round(r.time),level:r.level,kills:r.kills,returned:r.returned===true,cleared:r.cleared===true,stage:Number.isInteger(r.stage)?Math.max(0,Math.min(1e6,r.stage)):r.cleared?1:0,mode:r.mode==='frontier'?'frontier':r.mode==='campaign'?'campaign':'scout',...(r.mode==='frontier'?{finalized:r.finalized===true}:{}),trial:r.trial===true,relics:[...new Set(Array.isArray(r.relics)?r.relics.filter(id=>RELIC_IDS.includes(id)):[])].slice(0,2),synergies:[...new Set(Array.isArray(r.synergies)?r.synergies.filter(id=>SYNERGY_IDS.includes(id)):[])]});
  }
  return j;
}
export function discoverRelics(j,ids){j.discovered=[...new Set([...j.discovered,...ids.filter(id=>RELIC_IDS.includes(id))])];return j;}
export function recordRun(j,g){
  if(g.campaign?.version===3)return g.phase==='result'?checkpointJourney(j,g):false;
  if(g.campaign?.version===2)return g.phase==='result'?checkpointRun(j,g):false;
  if(g.phase!=='result'||j.runs.some(r=>r.id===g.runId))return false;
  const returned=g.outcome==='scouted',cleared=!!g.campaign?.cleared;
  j.runs.unshift({id:g.runId,seed:g.expedition.seed,hero:g.hero,weapon:g.startWeapon,time:Math.round(g.time),level:g.level,kills:g.kills,returned,cleared,stage:g.campaign?.cleared||0,mode:g.campaign?'campaign':'scout',trial:!!g.expedition.milestones.trialClearedAt,relics:[...g.relics.items],synergies:[...g.synergies.discovered]});j.runs=j.runs.slice(0,12);
  j.synergies=[...new Set([...j.synergies,...g.synergies.discovered])];
  if(returned)j.returns++;if(cleared)j.clears++;j.bestStage=Math.max(j.bestStage,g.campaign?.cleared||0);j.bestKills=Math.max(j.bestKills,g.kills);j.bestStreak=Math.max(j.bestStreak,g.metrics.bestStreak||0);const first=g.campaign?.firstClearedAt;if(first!==undefined&&first!==null)j.fastestClear=Math.min(j.fastestClear??Infinity,first);j.bestLevel=Math.max(j.bestLevel,g.level);discoverRelics(j,g.relics.discovered);return true;
}
// Upsert at each boss: a later defeat or a closed tab cannot erase a cleared boss.
export function checkpointRun(j,g){
  if(g.campaign?.version===3)return checkpointJourney(j,g);
  if(g.campaign?.version!==2||!['crossroads','result'].includes(g.phase))return false;
  const old=j.runs.find(r=>r.id===g.runId);if(old?.finalized)return false;
  const stage=Math.max(old?.stage||0,g.campaign.cleared),finalized=g.phase==='result';
  const r={id:g.runId,seed:g.expedition.seed,hero:g.hero,weapon:g.startWeapon,time:Math.round(g.time),level:g.level,kills:g.kills,returned:false,cleared:stage>=2,stage,mode:'frontier',finalized,trial:!!g.expedition.milestones.trialClearedAt,relics:[...g.relics.items],synergies:[...g.synergies.discovered]};
  j.runs=j.runs.filter(r=>r.id!==g.runId);j.runs.unshift(r);j.runs=j.runs.slice(0,12);
  j.frontierHeroes??={};const h=j.frontierHeroes[g.hero]||{stage:0,kills:0,level:0,fastest:null},finish=g.campaign.records.find(r=>r.depth===2)?.time;
  j.frontierHeroes[g.hero]={stage:Math.max(h.stage,stage),kills:Math.max(h.kills,g.kills),level:Math.max(h.level,g.level),fastest:finish?Math.min(h.fastest??Infinity,finish):h.fastest};
  discoverRelics(j,g.relics.discovered);j.synergies=[...new Set([...j.synergies,...g.synergies.discovered])];return true;
}

function checkpointJourney(j,g){
 if(g.phase!=='result'&&!(g.phase==='chest'&&g.chest?.bossLoot))return false;
 j.journeyRuns??=[];const old=j.journeyRuns.find(r=>r.id===g.runId);if(old?.finalized)return false;
 const stage=Math.max(old?.stage||0,g.campaign.cleared),finalized=g.phase==='result';if(old&&old.stage===stage&&!finalized)return false;
 const r={id:g.runId,ruleset:g.campaign.ruleset,difficulty:g.campaign.difficulty,hero:g.hero,weapon:g.startWeapon,style:g.mastery.branch,build:Object.entries(g.weapons).map(([id,w])=>({id,rank:w.rank,evolved:w.evolved,core:w.core||null})),passives:{...g.passives},relics:[...g.relics.items],seed:g.initialSeed,time:Math.round(g.time),level:g.level,kills:g.kills,stage,cleared:stage===3&&g.outcome==='victory',finalized};
 j.journeyRuns=j.journeyRuns.filter(r=>r.id!==g.runId);j.journeyRuns.unshift(r);j.journeyRuns=j.journeyRuns.slice(0,24);mergeJourneyBest(j,r);discoverRelics(j,g.relics.discovered);return true;
}

export function journeyUnlocked(j){return Object.values(j.journeyBest||{}).some(r=>r.fastest!==null);}
function mergeJourneyBest(j,r){
 j.journeyBest??={};const key=recordKey(r),old=j.journeyBest[key]||{stage:0,kills:0,level:0,fastest:null};
 j.journeyBest[key]={ruleset:r.ruleset||'expedition-v09',hero:r.hero,style:r.style,difficulty:r.difficulty,stage:Math.max(old.stage,r.stage),kills:Math.max(old.kills,r.kills),level:Math.max(old.level,r.level),fastest:r.cleared?Math.min(old.fastest??Infinity,r.time):old.fastest};
}
