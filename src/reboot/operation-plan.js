// A briefing is stable until a new operation is durably accepted, including retry.
export function createOperationPlan(randomSeed){
 let seed=randomSeed();
 return {get seed(){return seed;},committed(previous,next,draft){
  if(next.active?.runId===draft.runId&&previous.active?.runId!==draft.runId)seed=randomSeed();
 }};
}
