import {RESEARCH,REQUISITION_FEE,operationPayout,completedResearchProofs,pickedResearchTrials,sortieOrder,orderRecordScope} from './campaign.js';
import {VERSION,RULES} from './content.js';
import {createOperation,restore,snapshot,finish,canResumeRun} from './model.js';
import {operatorId} from './operator.js';
import {replayReference,referenceMatches} from './replay.js';
export const STORAGE_KEY='operation-rift-profile-v2';
const copy=x=>JSON.parse(JSON.stringify(x));
const validOrderRecords=records=>records&&typeof records==='object'&&!Array.isArray(records)&&Object.entries(records).every(([id,r])=>sortieOrder(id)&&r&&typeof r.scope==='string'&&Number.isSafeInteger(r.wins)&&r.wins>=1&&[r.score,r.time].every(v=>Number.isFinite(v)&&v>=0));
export const marcoRecord=p=>p.marcoRecords?.scope===p.recordScope?p.marcoRecords:null;
export function emptyProfile(){return{version:1,revision:0,sequence:0,active:null,records:{score:0,time:null,challenge:0,wins:0},recent:[],recordScope:RULES.balanceRevision,recordArchive:[],credits:0,research:[],trials:[],milestones:{},settled:0,settings:{sound:true,reduced:false}};}
export function parseProfile(raw){
 if(!raw)return emptyProfile();let p=JSON.parse(raw);
 if(p.version!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!Number.isSafeInteger(p.sequence)||p.sequence<0||!Number.isSafeInteger(p.settled)||p.settled<0||p.settled>p.sequence||!p.records||!Array.isArray(p.recent)||!p.settings||typeof p.settings.sound!=='boolean'||typeof p.settings.reduced!=='boolean'||!Number.isFinite(p.records.score)||p.records.score<0||p.records.time!==null&&(!Number.isFinite(p.records.time)||p.records.time<0))throw Error('작전 저장을 읽지 못했습니다.');
 if(!Number.isSafeInteger(p.records.wins)||p.records.wins<0||!Number.isSafeInteger(p.credits)||p.credits<0||!Array.isArray(p.research)||!Array.isArray(p.trials)||!p.milestones||new Set(p.research).size!==p.research.length||new Set(p.trials).size!==p.trials.length||p.research.some(id=>!RESEARCH[id])||p.trials.some(id=>!p.research.includes(id)))throw Error('작전 연구 기록을 읽지 못했습니다.');
 if(p.recordArchive!==undefined&&!Array.isArray(p.recordArchive))throw Error('이전 작전 기록을 읽지 못했습니다.');
 if(p.orderRecords!==undefined&&!validOrderRecords(p.orderRecords))throw Error('지령 기록을 읽지 못했습니다.');
 const marco=p.marcoRecords;
 if(p.lastOperator!==undefined&&p.lastOperator!=='marco'||marco!==undefined&&(!marco||typeof marco.scope!=='string'||![marco.score,marco.challenge,marco.wins].every(v=>Number.isSafeInteger(v)&&v>=0)||marco.time!==null&&(!Number.isFinite(marco.time)||marco.time<0)||!validOrderRecords(marco.orders)))throw Error('대원 기록을 읽지 못했습니다.');
 if(p.active){
  if(p.active.version!==VERSION||p.active.sequence!==p.sequence||typeof p.active.runId!=='string'||p.active.runId!==p.active.run.runId)throw Error('다른 규칙의 저장 판입니다.');
  if(!canResumeRun(p.active.run)){const old=restore(p.active.run,{allowPrevious:true});p.recordScope??=old.balanceRevision||'b05-campaign';finish(old,false,'rules-updated');p=settleProfile(p,old);p.migrationNotice='작전 규칙이 바뀌어 저장 판의 확보 성과를 정산했습니다. 크레딧과 연구를 유지하고 새 작전에 출격할 수 있습니다.';}else p.active.run=restore(p.active.run);
 }
 if(p.recordScope!==RULES.balanceRevision){p.recordArchive??=[];p.recordArchive.push({scope:p.recordScope||'b05-campaign',records:copy(p.records)});p.records={score:0,time:null,challenge:0,wins:p.records.wins};p.recordScope=RULES.balanceRevision;}
 if(p.active&&Object.hasOwn(p.active,'reference')&&(p.active.reference?.scope!==p.recordScope||!referenceMatches(p.active.reference,p.active.run,p.active.sequence)))delete p.active.reference;

 return p;
}
export function beginProfile(p,run,reference=null){
 if(p.active)throw Error('이전 판을 먼저 정산하세요.');
 const n=copy(p);n.sequence++;n.migrationNotice=null;
 if(run.operator==='marco')n.lastOperator='marco';else delete n.lastOperator;
 run.runId=`${n.sequence}:${run.seed}`;
 n.active={version:VERSION,sequence:n.sequence,runId:run.runId,run:snapshot(run)};
 if(referenceMatches(reference,run,n.sequence))n.active.reference=copy(reference);
 return n;
}
export const canLaunchOrder=(p,id)=>{const order=sortieOrder(id);return !!order&&!p.active&&p.records.wins>0&&p.credits>=order.fee;};
export const canReserveResearch=(p,id,at=null)=>Object.hasOwn(RESEARCH,id)&&!p.active&&p.research.includes(id)
 &&!p.trials.includes(id)&&p.credits>=REQUISITION_FEE&&(at===null||at==='coast'&&!!RESEARCH[id].fieldGun);
const clearedResearchTrials=(run,proofs)=>run.operation?.trialProof?proofs??completedResearchProofs(run):pickedResearchTrials(run.stats);
export function sortieResearchTrials(p){
 if(!p.active)return p.trials;
 const cleared=clearedResearchTrials(p.active.run);
 return p.trials.filter(id=>!cleared.includes(id));
}
export function freshSortie(p,seed,order=null,operator='fio',requisition=null,replayFrom=null,requisitionAt=null){
 const priorReport=replayFrom===null?null:p.recent.find(report=>report?.sequence===replayFrom);
 const reference=replayReference(priorReport,p.recordScope);
 if(requisition!==null||requisitionAt!==null){
  if(order!==null||!canReserveResearch(p,requisition,requisitionAt))throw Error('장비 예약 조건을 확인하세요.');
  p={...p,credits:p.credits-REQUISITION_FEE};
 }
 if(order!==null){
  if(!canLaunchOrder(p,order))throw Error('지령 출격 조건을 확인하세요.');
  p={...p,credits:p.credits-sortieOrder(order).fee};
 }
 if(p.active){
  const prior=restore(p.active.run);
  finish(prior,false,'new-run');
  p=settleProfile(p,prior);
 }
 const run=createOperation(seed,p.research,p.trials,order,operator);
 if(requisition)run.operation.requisition=requisition;
 if(requisitionAt)run.operation.requisitionAt=requisitionAt;
 return {run,next:beginProfile(p,run,reference)};
}
export function checkpointProfile(p,run){
 if(!p.active)throw Error('활성 전투가 없습니다.');
 if(run.runId!==p.active.runId)throw Error('다른 작전의 체크포인트입니다.');
 const n=copy(p);n.active.run=snapshot(run);
 if(!run.operation?.trialProof)n.trials=n.trials.filter(id=>!pickedResearchTrials(run.stats).includes(id));
 return n;
}
export function settleProfile(p,run){
 if(!run.result)throw Error('아직 끝나지 않은 전투입니다.');if(!p.active){if(p.settled===p.sequence)return copy(p);throw Error('정산할 전투를 찾지 못했습니다.');}
 if(run.runId!==p.active.runId||run.result.runId!==p.active.runId)throw Error('다른 작전의 정산 결과입니다.');
 const n=copy(p),r=copy(run.result);if(n.active.sequence<=n.settled)return n;
 const order=sortieOrder(r.operation?.order),sameScope=r.balanceRevision===n.recordScope,marco=operatorId(r)==='marco';
 delete r.reference;
 if(sameScope&&r.reason!=='rules-updated'&&referenceMatches(n.active.reference,r,n.sequence))r.reference=n.active.reference;
 const proofs=completedResearchProofs(r).filter(id=>n.trials.includes(id));
 const {credits,lines}=operationPayout(r,!n.milestones.medic,proofs);
 if(proofs.length)r.researchProven=proofs;
 r.credits=credits;r.creditBreakdown=lines;r.newScore=false;r.newTime=false;
 if(order){
  r.orderFee=order.fee;r.orderBonus=lines.order;
 }
 if(r.operation?.requisition)r.requisitionFee=REQUISITION_FEE;
 if(sameScope&&(!order||r.orderBonus)){
  const record=marco?(n.marcoRecords=marcoRecord(n)||{scope:n.recordScope,score:0,time:null,challenge:0,wins:0,orders:{}}):n.records;
  if(order){
   const orders=marco?record.orders:(n.orderRecords??={}),id=r.operation.order;
   const scope=orderRecordScope(n.recordScope,r.operation.orderRevision),prior=orders[id]?.scope===scope?orders[id]:null;
   r.newScore=!prior||r.score>prior.score;r.newTime=!prior||r.seconds<prior.time;
   orders[id]={scope,wins:(prior?.wins||0)+1,score:Math.max(prior?.score||0,r.score),time:Math.min(prior?.time??Infinity,r.seconds)};
  }else{
   r.newScore=r.score>record.score;r.newTime=r.won&&(record.time===null||r.seconds<record.time);
   record.score=Math.max(record.score,r.score);record.challenge=Math.max(record.challenge,r.stats.challenge);
   if(r.won){record.time=Math.min(record.time??Infinity,r.seconds);if(marco)record.wins++;}
  }
 }
 if(r.won){n.records.wins++;n.milestones.medic=true;}
 if(r.stats.fusionBosses>0)n.milestones.shrapnel=true;
 if(r.stats.flameBosses>0)n.milestones.thermal=true;
 r.researchUnlocked=Object.keys(RESEARCH).filter(id=>n.milestones[id]&&!p.milestones[id]);
 const clearedTrials=clearedResearchTrials(r,proofs);
 n.credits+=r.credits;n.trials=n.trials.filter(id=>!clearedTrials.includes(id));n.recent.unshift({...r,sequence:n.sequence});n.recent=n.recent.slice(0,10);n.settled=n.sequence;n.active=null;return n;
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
