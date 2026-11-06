import {VERSION} from './content.js';
import {restore,snapshot} from './model.js';
export const STORAGE_KEY='operation-reboot-prototype-v1';
const copy=x=>JSON.parse(JSON.stringify(x));
export function emptyProfile(){return{version:1,revision:0,sequence:0,active:null,records:{score:0,time:null,challenge:0},recent:[],settled:0,settings:{sound:true,reduced:false}};}
export function parseProfile(raw){
 if(!raw)return emptyProfile();const p=JSON.parse(raw);
 if(p.version!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!Number.isSafeInteger(p.sequence)||p.sequence<0||!Number.isSafeInteger(p.settled)||p.settled<0||p.settled>p.sequence||!p.records||!Array.isArray(p.recent)||!p.settings||typeof p.settings.sound!=='boolean'||typeof p.settings.reduced!=='boolean'||!Number.isFinite(p.records.score)||p.records.score<0||p.records.time!==null&&(!Number.isFinite(p.records.time)||p.records.time<0))throw Error('독립 시제품 저장을 읽지 못했습니다.');
 if(p.active){if(p.active.version!==VERSION||p.active.sequence!==p.sequence)throw Error('다른 규칙의 저장 판입니다.');restore(p.active.run);}
 return p;
}
export function beginProfile(p,run){if(p.active)throw Error('저장한 전투를 먼저 이어가세요.');const n=copy(p);n.sequence++;n.active={version:VERSION,sequence:n.sequence,run:snapshot(run)};return n;}
export function checkpointProfile(p,run){if(!p.active)throw Error('활성 전투가 없습니다.');const n=copy(p);n.active.run=snapshot(run);return n;}
export function settleProfile(p,run){
 if(!run.result)throw Error('아직 끝나지 않은 전투입니다.');if(!p.active){if(p.settled===p.sequence)return copy(p);throw Error('정산할 전투를 찾지 못했습니다.');}
 const n=copy(p),r=copy(run.result);if(n.active.sequence<=n.settled)return n;n.records.score=Math.max(n.records.score,r.score);n.records.challenge=Math.max(n.records.challenge,r.stats.challenge);
 if(r.won)n.records.time=n.records.time===null?r.seconds:Math.min(n.records.time,r.seconds);n.recent.unshift({...r,sequence:n.sequence});n.recent=n.recent.slice(0,10);n.settled=n.sequence;n.active=null;return n;
}
export function createStore(storage,lock=null){
 let p=parseProfile(storage.getItem(STORAGE_KEY));
 async function write(candidate){
  const commit=()=>{const disk=parseProfile(storage.getItem(STORAGE_KEY));if(disk.revision!==p.revision||candidate.revision!==p.revision){const error=Error('다른 탭에서 기록이 바뀌었습니다. 최신 저장을 불러와야 합니다.');error.code='CONFLICT';throw error;}const n=copy(candidate);n.revision=p.revision+1;storage.setItem(STORAGE_KEY,JSON.stringify(n));p=n;return copy(n);};
  return lock?lock(commit):commit();
 }
 return{get:()=>copy(p),settings:()=>({...p.settings}),commit:write};
}
