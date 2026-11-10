import {RESEARCH,operationCredits,orderBonus,sortieOrder} from './campaign.js';
import {VERSION,RULES} from './content.js';
import {createOperation,restore,snapshot,finish,canResumeRun} from './model.js';
export const STORAGE_KEY='operation-rift-profile-v2';
const pickedTrials=stats=>stats.researchTrialsPicked||[stats.researchTrialPicked].filter(Boolean);
const copy=x=>JSON.parse(JSON.stringify(x));
export function emptyProfile(){return{version:1,revision:0,sequence:0,active:null,records:{score:0,time:null,challenge:0,wins:0},recent:[],recordScope:RULES.balanceRevision,recordArchive:[],credits:0,research:[],trials:[],milestones:{},settled:0,settings:{sound:true,reduced:false}};}
export function parseProfile(raw){
 if(!raw)return emptyProfile();let p=JSON.parse(raw);
 if(p.version!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!Number.isSafeInteger(p.sequence)||p.sequence<0||!Number.isSafeInteger(p.settled)||p.settled<0||p.settled>p.sequence||!p.records||!Array.isArray(p.recent)||!p.settings||typeof p.settings.sound!=='boolean'||typeof p.settings.reduced!=='boolean'||!Number.isFinite(p.records.score)||p.records.score<0||p.records.time!==null&&(!Number.isFinite(p.records.time)||p.records.time<0))throw Error('작전 저장을 읽지 못했습니다.');
 if(!Number.isSafeInteger(p.records.wins)||p.records.wins<0||!Number.isSafeInteger(p.credits)||p.credits<0||!Array.isArray(p.research)||!Array.isArray(p.trials)||!p.milestones||new Set(p.research).size!==p.research.length||new Set(p.trials).size!==p.trials.length||p.research.some(id=>!RESEARCH[id])||p.trials.some(id=>!p.research.includes(id)))throw Error('작전 연구 기록을 읽지 못했습니다.');
 if(p.recordArchive!==undefined&&!Array.isArray(p.recordArchive))throw Error('이전 작전 기록을 읽지 못했습니다.');
 if(p.orderRecords!==undefined&&(!p.orderRecords||Array.isArray(p.orderRecords)||typeof p.orderRecords!=='object'||Object.entries(p.orderRecords).some(([id,r])=>!sortieOrder(id)||!r||typeof r.scope!=='string'||!Number.isSafeInteger(r.wins)||r.wins<1||![r.score,r.time].every(v=>Number.isFinite(v)&&v>=0))))throw Error('지령 기록을 읽지 못했습니다.');
 if(p.active){
  if(p.active.version!==VERSION||p.active.sequence!==p.sequence||typeof p.active.runId!=='string'||p.active.runId!==p.active.run.runId)throw Error('다른 규칙의 저장 판입니다.');
  if(!canResumeRun(p.active.run)){const old=restore(p.active.run,{allowPrevious:true});p.recordScope??=old.balanceRevision||'b05-campaign';finish(old,false,'rules-updated');p=settleProfile(p,old);p.migrationNotice='작전 규칙이 바뀌어 저장 판의 확보 성과를 정산했습니다. 크레딧과 연구를 유지하고 새 작전에 출격할 수 있습니다.';}else p.active.run=restore(p.active.run);
 }
 if(p.recordScope!==RULES.balanceRevision){p.recordArchive??=[];p.recordArchive.push({scope:p.recordScope||'b05-campaign',records:copy(p.records)});p.records={score:0,time:null,challenge:0,wins:p.records.wins};p.recordScope=RULES.balanceRevision;}

 return p;
}
export function beginProfile(p,run){if(p.active)throw Error('이전 판을 먼저 정산하세요.');const n=copy(p);n.sequence++;n.migrationNotice=null;run.runId=`${n.sequence}:${run.seed}`;n.active={version:VERSION,sequence:n.sequence,runId:run.runId,run:snapshot(run)};return n;}
export const canLaunchOrder=(p,id)=>{const order=sortieOrder(id);return !!order&&!p.active&&p.records.wins>0&&p.credits>=order.fee;};
export function freshSortie(p,seed,order=null){
 if(order!==null){
  if(!canLaunchOrder(p,order))throw Error('지령 출격 조건을 확인하세요.');
  p={...p,credits:p.credits-sortieOrder(order).fee};
 }
 if(p.active){
  const prior=restore(p.active.run);
  finish(prior,false,'new-run');
  p=settleProfile(p,prior);
 }
 const run=createOperation(seed,p.research,p.trials,order);
 return {run,next:beginProfile(p,run)};
}
export function checkpointProfile(p,run){if(!p.active)throw Error('활성 전투가 없습니다.');if(run.runId!==p.active.runId)throw Error('다른 작전의 체크포인트입니다.');const n=copy(p);n.active.run=snapshot(run);n.trials=n.trials.filter(id=>!pickedTrials(run.stats).includes(id));return n;}
export function settleProfile(p,run){
 if(!run.result)throw Error('아직 끝나지 않은 전투입니다.');if(!p.active){if(p.settled===p.sequence)return copy(p);throw Error('정산할 전투를 찾지 못했습니다.');}
 if(run.runId!==p.active.runId||run.result.runId!==p.active.runId)throw Error('다른 작전의 정산 결과입니다.');
 const n=copy(p),r=copy(run.result);if(n.active.sequence<=n.settled)return n;
 const order=sortieOrder(r.operation?.order),sameScope=r.balanceRevision===n.recordScope;
 r.credits=operationCredits(r,!n.milestones.medic);r.newScore=false;r.newTime=false;
 if(order){
  r.orderFee=order.fee;r.orderBonus=orderBonus(r);
  if(sameScope&&r.orderBonus){
   n.orderRecords??={};const old=n.orderRecords[r.operation.order];
   const prior=old?.scope===n.recordScope?old:null;
   r.newScore=!prior||r.score>prior.score;r.newTime=!prior||r.seconds<prior.time;
   n.orderRecords[r.operation.order]={scope:n.recordScope,wins:(prior?.wins||0)+1,score:Math.max(prior?.score||0,r.score),time:Math.min(prior?.time??Infinity,r.seconds)};
  }
 }else if(sameScope){
  r.newScore=r.score>n.records.score;r.newTime=r.won&&(n.records.time===null||r.seconds<n.records.time);
  n.records.score=Math.max(n.records.score,r.score);n.records.challenge=Math.max(n.records.challenge,r.stats.challenge);
  if(r.won)n.records.time=Math.min(n.records.time??Infinity,r.seconds);
 }
 if(r.won){n.records.wins++;n.milestones.medic=true;}
 if(r.stats.fusionBosses>0)n.milestones.shrapnel=true;
 if(r.stats.flameBosses>0)n.milestones.thermal=true;
 r.researchUnlocked=Object.keys(RESEARCH).filter(id=>n.milestones[id]&&!p.milestones[id]);
 n.credits+=r.credits;n.trials=n.trials.filter(id=>!pickedTrials(r.stats).includes(id));n.recent.unshift({...r,sequence:n.sequence});n.recent=n.recent.slice(0,10);n.settled=n.sequence;n.active=null;return n;
}
export function buyResearch(p,id){const d=RESEARCH[id];if(!d||p.active||p.research.includes(id)||!p.milestones[id]||p.credits<d.cost)return null;const n=copy(p);n.credits-=d.cost;n.research.push(id);n.trials.push(id);return n;}
export function createStore(storage,lock=null){
 let p=parseProfile(storage.getItem(STORAGE_KEY));
 async function write(candidate){
  const commit=()=>{const disk=parseProfile(storage.getItem(STORAGE_KEY));if(disk.revision!==p.revision||candidate.revision!==p.revision){const error=Error('다른 탭에서 기록이 바뀌었습니다. 최신 저장을 불러와야 합니다.');error.code='CONFLICT';throw error;}const n=copy(candidate);n.revision=p.revision+1;storage.setItem(STORAGE_KEY,JSON.stringify(n));p=n;return copy(n);};
  return lock?lock(commit):commit();
 }
 return{get:()=>copy(p),settings:()=>({...p.settings}),commit:write};
}
