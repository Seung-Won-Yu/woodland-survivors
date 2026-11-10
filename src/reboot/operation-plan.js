import {beachRoute,holdoutParts} from './campaign.js';

// A briefing is stable until a new operation is durably accepted, including retry.
export function createOperationPlan(randomSeed,previousSeed){
 const roll=last=>{
  let candidate=randomSeed()>>>0;
  if(last==null)return candidate;
  const route=beachRoute(last),parts=holdoutParts(last,0).join();
  while(beachRoute(candidate)===route||holdoutParts(candidate,0).join()===parts)candidate=(candidate+1)>>>0;
  return candidate;
 };
 let seed=roll(previousSeed);
 return {get seed(){return seed;},committed(previous,next,draft){
  if(next.active?.runId===draft.runId&&previous.active?.runId!==draft.runId)seed=roll(draft.seed);
 }};
}
