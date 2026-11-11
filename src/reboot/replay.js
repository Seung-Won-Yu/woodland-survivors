import {REGIONS,FRONT_SUPPORTS} from './campaign.js';
import {GUNS,capstoneName} from './content.js';
import {operatorId} from './operator.js';

const nonnegative=value=>Number.isFinite(value)&&value>=0;
const standard=operation=>!!operation&&!operation.order&&!operation.requisition;
const capstones=new Set([...Object.values(GUNS).map(gun=>gun.evolution),'압축 인페르노','전도 격발망','점화 격발망']);
export const installedCapstones=weapons=>Array.isArray(weapons)
 ?[...new Set(weapons.filter(w=>typeof w?.id==='string'&&Object.hasOwn(GUNS,w.id)&&(w.fusion||w.evolved)).map(capstoneName))]:[];
const isHarborSupport=id=>typeof id==='string'&&Object.hasOwn(FRONT_SUPPORTS,id);
export const harborLoadout=operation=>isHarborSupport(operation?.support)?operation.support:null;
// Fixed simulation steps can land just below an exact rounding boundary.
export const tenthsOfSecond=time=>Math.round(time*10+1e-8);

export function frontElapsed(operation,index){
 if(operation.region===index)return operation.regionTime;
 return Array.isArray(operation.history)?operation.history.find(step=>step?.region===index)?.time:undefined;
}

function validReference(ref){
 return !!ref&&Number.isSafeInteger(ref.sequence)&&ref.sequence>0&&Number.isSafeInteger(ref.seed)&&ref.seed>=0&&ref.seed<=0xffffffff
  &&['fio','marco'].includes(ref.operator)&&typeof ref.scope==='string'&&nonnegative(ref.score)&&nonnegative(ref.seconds)&&ref.seconds>0
  &&Array.isArray(ref.fronts)&&ref.fronts.length===REGIONS.length&&Array.from(ref.fronts).every(nonnegative)
  &&(ref.capstones===undefined||Array.isArray(ref.capstones)&&ref.capstones.length<=3&&Array.from(ref.capstones).every(name=>capstones.has(name)))
  &&(ref.harborSupport==null||isHarborSupport(ref.harborSupport))
  &&Math.abs(ref.fronts.reduce((sum,time)=>sum+time,0)-ref.seconds)<.1;
}

export function replayReference(report,scope){
 const operation=report?.operation;
 if(report?.won!==true||report.balanceRevision!==scope||!standard(operation)||operation.extracted!==true
   ||operation.cleared!==REGIONS.length||operation.region!==REGIONS.length-1)return null;
 const reference={sequence:report.sequence,seed:report.seed,operator:operatorId(report),scope,score:report.score,seconds:report.seconds,
  fronts:REGIONS.map((_,index)=>frontElapsed(operation,index)),
  capstones:installedCapstones(report.weapons),harborSupport:harborLoadout(operation)};
 return validReference(reference)?reference:null;
}

export function referenceMatches(reference,run,sequence){
 return validReference(reference)&&standard(run.operation)&&Number.isSafeInteger(sequence)&&reference.sequence<sequence&&reference.scope===run.balanceRevision
  &&reference.seed===run.seed&&reference.operator===operatorId(run);
}

export function timeDifference(current,reference){
 if(!nonnegative(current)||!nonnegative(reference))return null;
 const delta=tenthsOfSecond(current)-tenthsOfSecond(reference);
 if(!delta)return {trend:'even',text:'기록과 동일'};
 return {trend:delta<0?'ahead':'behind',text:`${(Math.abs(delta)/10).toFixed(1)}초 ${delta<0?'단축':'지연'}`};
}
