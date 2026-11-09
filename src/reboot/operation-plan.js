import {beachRoute} from './campaign.js';

// A briefing is stable until a new operation is durably accepted, including retry.
export function createOperationPlan(randomSeed,previousSeed){
 const roll=last=>{
  const candidate=randomSeed();
  return last!=null&&beachRoute(last)===beachRoute(candidate)?(candidate+1+(candidate>>>2)%3)>>>0:candidate;
 };
 let seed=roll(previousSeed);
 return {get seed(){return seed;},committed(previous,next,draft){
  if(next.active?.runId===draft.runId&&previous.active?.runId!==draft.runId)seed=roll(draft.seed);
 }};
}
