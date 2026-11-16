import {beachRoute,holdoutParts} from './campaign.js';

// A briefing is stable until a new operation is durably accepted, including retry.
export function createOperationPlan(randomSeed,previousSeed){
 const distinct=(candidate,...previous)=>{
  const routes=previous.filter(value=>value!=null).map(value=>[beachRoute(value),holdoutParts(value,0).join()]);
  while(routes.some(([route,parts])=>beachRoute(candidate)===route||holdoutParts(candidate,0).join()===parts))candidate=(candidate+1)>>>0;
  return candidate;
 };
 let last=previousSeed,seed=distinct(randomSeed()>>>0,last);
 return {get seed(){return seed;},forReport(previous){return distinct(seed,last,previous);},committed(previous,next,draft){
  if(next.active?.runId===draft.runId&&previous.active?.runId!==draft.runId){last=draft.seed;seed=distinct(randomSeed()>>>0,last);}
 }};
}
