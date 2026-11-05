// Design calculator only. Not imported by the game and not a measured player model.
// These are proposed v0.1 economy values, not copied reference-game formulas.
import assert from 'node:assert/strict';
const count=(n,max)=>Math.min(max,Math.max(0,Math.floor(n||0)));
export const TRAINING={
 vitality:{prices:[80,160,240],perRank:.05},
 firepower:{prices:[120,200,320],perRank:.03},
 pickup:{prices:[80,160],perRank:.10},
 cycling:{prices:[140,240,360],perRank:.02},
 reroll:{prices:[160,280],perRank:1}
};
export const RESEARCH=[
 {id:'p-focus',cost:200},{id:'h-ricochet',cost:240},{id:'r-incendiary',cost:280}
];
export const EXPANSION_RESEARCH=[
 {id:'p-return',operation:2,cost:400},{id:'h-incendiary',operation:2,cost:500},{id:'r-bounce',operation:2,cost:600},
 {id:'p-weakpoint-echo',operation:3,cost:600},{id:'h-suppression',operation:3,cost:700},{id:'r-cluster-pattern',operation:3,cost:800}
];
export function settle(input,{firstReport=false,firstClear=false}={}){
 const k=count(input.kills,Number.MAX_SAFE_INTEGER),e=count(input.elites,2),p=count(input.rescues,5),o=count(input.outposts,2),b=count(input.armorBreaks,2),won=!!input.won;
 const multiplier=input.difficulty==='dense'?1.15:1;
 const components={kills:Math.floor(Math.min(k,800)/5),elites:e*25,rescues:p*20,outposts:o*50,armorBreaks:b*30,clear:won?300:0};
 const repeatBase=Object.values(components).reduce((a,b)=>a+b,0),repeatCredits=Math.floor(repeatBase*multiplier);
 const reportEligible=k>=50||p>0||o>0||b>0||won;
 const oneTime={report:firstReport&&reportEligible?100:0,clear:firstClear&&won?200:0};
 const timeBonus=won?Math.max(0,600-count(input.seconds,Number.MAX_SAFE_INTEGER))*20:0;
 const score=Math.min(k,800)*10+e*250+p*300+o*800+b*1500+(won?10000:0)+timeBonus;
 return {components,multiplier,repeatCredits,oneTime,totalCredits:repeatCredits+oneTime.report+oneTime.clear,score,
 grade:won?(score>=30000?'S':score>=24000?'A':score>=18000?'B':'C'):'미완료'};
}
const samples=[
 {id:'opening-failure',seconds:45,kills:60,elites:0,rescues:0,outposts:0,armorBreaks:0,won:false},
 {id:'first-report-failure',seconds:120,kills:200,elites:0,rescues:2,outposts:0,armorBreaks:0,won:false},
 {id:'midrun-failure',seconds:210,kills:450,elites:1,rescues:2,outposts:1,armorBreaks:0,won:false},
 {id:'boss-failure',seconds:360,kills:950,elites:2,rescues:3,outposts:1,armorBreaks:2,won:false},
 {id:'fast-clear',seconds:240,kills:600,elites:2,rescues:1,outposts:0,armorBreaks:2,won:true},
 {id:'normal-clear',seconds:360,kills:1000,elites:2,rescues:3,outposts:1,armorBreaks:2,won:true},
 {id:'rescue-clear',seconds:420,kills:1200,elites:2,rescues:5,outposts:2,armorBreaks:2,won:true},
 {id:'dense-clear',seconds:420,kills:1200,elites:2,rescues:5,outposts:2,armorBreaks:2,won:true,difficulty:'dense'},
 {id:'fast-resource-retreat',seconds:90,kills:300,elites:1,rescues:2,outposts:1,armorBreaks:0,won:false},
 {id:'stress-resource-retreat',seconds:60,kills:400,elites:2,rescues:3,outposts:2,armorBreaks:0,won:false},
 {id:'one-minute-retreat',seconds:60,kills:160,elites:0,rescues:1,outposts:0,armorBreaks:0,won:false},
 {id:'afk',seconds:360,kills:0,elites:0,rescues:0,outposts:0,armorBreaks:0,won:false}
];
const resolved=samples.map(s=>({...s,repeat:settle(s),newProfile:settle(s,{firstReport:true,firstClear:true})}));
const byId=id=>samples.find(s=>s.id===id);
const totalTraining=Object.values(TRAINING).flatMap(t=>t.prices).reduce((a,b)=>a+b,0);
const totalResearch=RESEARCH.reduce((a,b)=>a+b.cost,0);
function progression(sequence){let earned=0,firstReport=true,firstClear=true;const rows=[];
 for(const id of sequence){const run=byId(id),r=settle(run,{firstReport,firstClear});if(r.oneTime.report)firstReport=false;if(r.oneTime.clear)firstClear=false;earned+=r.totalCredits;rows.push({run:id,reward:r.totalCredits,totalEarned:earned});}
 return {rows,trainingBudgetCovered:earned>=totalTraining,trainingAndResearchCovered:earned>=totalTraining+totalResearch};}
const progressionExamples={
 learning:progression(['first-report-failure','midrun-failure','boss-failure','normal-clear','normal-clear','rescue-clear','normal-clear','rescue-clear']),
 skilled:progression(['fast-clear','normal-clear','rescue-clear','normal-clear','rescue-clear']),
 repeatedFailure:progression(Array(10).fill('first-report-failure'))
};
// Arithmetic checks, not claims that either economy or gameplay is fun/balanced.
assert.equal(settle(byId('normal-clear')).repeatCredits,680);
assert.equal(settle(byId('normal-clear'),{firstReport:true,firstClear:true}).totalCredits,980);
assert.equal(settle(byId('afk'),{firstReport:true,firstClear:true}).totalCredits,0);
assert.equal(settle({...byId('normal-clear'),kills:999999}).repeatCredits,680);
assert.equal(settle(byId('first-report-failure'),{firstReport:true}).totalCredits,180);
assert.equal(settle(byId('first-report-failure')).totalCredits,80);
assert.equal(settle(byId('dense-clear')).repeatCredits,Math.floor(770*1.15));
assert.equal(settle(byId('boss-failure')).grade,'미완료');
assert.ok(settle(byId('fast-clear')).repeatCredits/4>settle(byId('one-minute-retreat')).repeatCredits);
const directDamageMultiplier=(1+TRAINING.firepower.prices.length*TRAINING.firepower.perRank)/(1-TRAINING.cycling.prices.length*TRAINING.cycling.perRank);
assert.ok(directDamageMultiplier<1.16);
const report={version:'design-v0.1',notice:'Proposed arithmetic fixtures, not gameplay simulation or implementation.',trainingBudget:totalTraining,researchBudget:totalResearch,expandedResearchBudget:totalResearch+EXPANSION_RESEARCH.reduce((a,b)=>a+b.cost,0),fullTrainingAndResearchBudget:totalTraining+totalResearch+EXPANSION_RESEARCH.reduce((a,b)=>a+b.cost,0),directDamageMultiplier,creditRatesWith30SecondLobby:{normalClear:settle(byId('normal-clear')).repeatCredits/6.5,fastClear:settle(byId('fast-clear')).repeatCredits/4.5,fastRetreat:settle(byId('fast-resource-retreat')).repeatCredits/2,stressRetreat:settle(byId('stress-resource-retreat')).repeatCredits/1.5},samples:resolved,progressionExamples};
console.log(JSON.stringify(report,null,2));
