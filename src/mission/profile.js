import {RULESET,HEROES,TRAINING,RESEARCH,DOCTRINES,ORDERS,orderReady,calculateSettlement,researchReady} from './content.js';
export const PROFILE_KEY='operation-breakwater-profile-v1';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createProfile(id='local'){
 return {version:1,id,wallet:0,selectedHero:'marco',difficulty:'normal',doctrines:{marco:'focus',fio:'reserve'},settings:{sound:true,reduced:false},
 training:Object.fromEntries(Object.keys(TRAINING).map(k=>[k,{rank:0,paid:[]}])),researched:[],freshMods:[],
 progress:{weaponKills:{p:0,h:0,r:0},pMastery:false,overdriveKills:0,midbossMarco:0,unions:0,bestEvolvedKills:0},orders:[],achievements:[],firstReport:false,firstClear:{},records:{},
 nextSequence:1,lastSettledSequence:0,lastReceipt:null,activeRun:null};
}
const nonnegative=(v,fallback=0)=>Number.isFinite(v)&&v>=0?Math.floor(v):fallback;
export function parseProfile(raw){
 if(!raw)return null;const source=JSON.parse(raw);if(source.version!==1||typeof source.id!=='string'||!Number.isSafeInteger(source.wallet)||source.wallet<0||!source.training)throw Error('저장 형식을 읽을 수 없습니다.');
 const p={...createProfile(source.id),...source};
 for(const [id,t]of Object.entries(TRAINING)){const e=p.training[id];if(!e||!Number.isInteger(e.rank)||e.rank<0||e.rank>t.prices.length||!Array.isArray(e.paid)||e.paid.length!==e.rank||e.paid.some(n=>!Number.isFinite(n)||n<0))throw Error('훈련 저장을 읽을 수 없습니다.');}
 if(!Array.isArray(p.researched)||p.researched.some(id=>!RESEARCH[id]))throw Error('연구 저장을 읽을 수 없습니다.');
 p.researched=[...new Set(p.researched)];p.freshMods=Array.isArray(source.freshMods)?source.freshMods.filter(id=>p.researched.includes(id)):[];
 p.selectedHero=HEROES[source.selectedHero]?source.selectedHero:'marco';p.difficulty=source.difficulty==='dense'?'dense':'normal';
 p.settings={sound:source.settings?.sound!==false,reduced:source.settings?.reduced===true};
 p.doctrines={marco:source.doctrines?.marco==='fan'?'fan':'focus',fio:source.doctrines?.fio==='quick'?'quick':'reserve'};
 p.progress={weaponKills:Object.fromEntries(['p','h','r'].map(id=>[id,nonnegative(source.progress?.weaponKills?.[id])])),pMastery:source.progress?.pMastery===true,overdriveKills:nonnegative(source.progress?.overdriveKills),midbossMarco:nonnegative(source.progress?.midbossMarco),unions:nonnegative(source.progress?.unions),bestEvolvedKills:nonnegative(source.progress?.bestEvolvedKills)};
 p.orders=Array.isArray(source.orders)?[...new Set(source.orders.filter(id=>ORDERS.some(o=>o.id===id)))]:[];
 p.achievements=Array.isArray(source.achievements)?source.achievements.filter(id=>['first-clear','rescue-all','marco-fan','fio-quick','s-rank'].includes(id)):[];
 p.firstReport=source.firstReport===true;p.firstClear={breakwater:source.firstClear?.breakwater===true};
 p.records=Object.fromEntries(Object.entries(source.records||{}).filter(([key,r])=>key.startsWith('operation-')&&r&&Number.isFinite(r.kills)&&Number.isFinite(r.score)).map(([key,r])=>[key,{kills:nonnegative(r.kills),score:nonnegative(r.score),bestTime:Number.isFinite(r.bestTime)&&r.bestTime>=0?r.bestTime:null}]));
 p.lastSettledSequence=nonnegative(source.lastSettledSequence);p.nextSequence=Math.max(p.lastSettledSequence+1,nonnegative(source.nextSequence,1));
 const a=source.activeRun;
 if(a){if(typeof a.id!=='string'||!Number.isSafeInteger(a.sequence)||a.sequence<=p.lastSettledSequence||!HEROES[a.hero]||!a.snapshot||!Number.isFinite(a.seed)){
   p.activeRun=null;p.recoveryNotice='손상된 진행 작전을 분리했습니다. 기지의 재화·훈련은 유지됩니다.';
  }else{p.activeRun=a;p.nextSequence=Math.max(p.nextSequence,a.sequence+1);}}
 if(p.lastReceipt&&(!HEROES[p.lastReceipt.hero]||!p.lastReceipt.result?.stats||!p.lastReceipt.award?.components||!Number.isFinite(p.lastReceipt.balance)))p.lastReceipt=null;
 return p;
}
export function recoverActiveRun(p,reason='recovery'){
 const a=p.activeRun;if(!a)return{ok:false,reason:'복구할 작전이 없습니다.'};const c=a.checkpoint||{},old=c.stats||{};
 const stats={kills:nonnegative(old.kills),elites:nonnegative(old.elites),rescues:nonnegative(old.rescues),outposts:nonnegative(old.outposts),armorBreaks:nonnegative(old.armorBreaks),weaponKills:Object.fromEntries(['p','h','r'].map(id=>[id,nonnegative(old.weaponKills?.[id])])),pMastery:old.pMastery===true,overdriveKills:nonnegative(old.overdriveKills),evolved:Array.isArray(old.evolved)?old.evolved.filter(id=>['p','h','r'].includes(id)):[],union:old.union===true,bestCombo:nonnegative(old.bestCombo)};
 stats.midbosses=nonnegative(old.midbosses);stats.evolvedKills=nonnegative(old.evolvedKills);stats.fronts=Array.isArray(old.fronts)?old.fronts.filter(n=>[0,1].includes(n)):[];stats.supplyPicks=Array.isArray(old.supplyPicks)?old.supplyPicks.filter(id=>typeof id==='string'):[];
 return settleRun(p,{...a,researchPresented:Array.isArray(c.researchPresented)?c.researchPresented.filter(id=>RESEARCH[id]):[],result:{won:false,reason,seconds:nonnegative(c.t),hero:a.hero,stats,weapons:[],training:a.snapshot.training||{},doctrine:a.snapshot.doctrine}});
}
export function snapshotProfile(p){return {training:Object.fromEntries(Object.entries(p.training).map(([id,e])=>[id,e.rank])),researched:[...p.researched],freshMods:[...p.freshMods],doctrine:p.doctrines[p.selectedHero]};}
export function beginRun(p,{hero=p.selectedHero,difficulty=p.difficulty,seed=1}={}){
 if(p.activeRun)return {ok:false,reason:'이어갈 작전이 있습니다.'};if(!HEROES[hero])return {ok:false,reason:'대원을 확인해 주세요.'};if(difficulty==='dense'&&!p.firstClear.breakwater)return{ok:false,reason:'첫 완주 뒤 과밀 도전이 열립니다.'};
 const next=copy(p);next.selectedHero=hero;next.difficulty=difficulty;const seq=next.nextSequence++;
 next.activeRun={id:`${p.id}:${seq}`,sequence:seq,rules:RULESET,operation:'breakwater',hero,difficulty,seed:seed>>>0,snapshot:snapshotProfile(next),checkpoint:null};return {ok:true,profile:next,descriptor:next.activeRun};
}
export function checkpointRun(p,run){if(p.activeRun?.id!==run.id)return {ok:false,reason:'현재 작전과 일치하지 않습니다.'};const next=copy(p);next.activeRun.checkpoint=copy(run);return {ok:true,profile:next};}
export function settleRun(p,run){
 if(run.sequence<=p.lastSettledSequence)return {ok:true,alreadySettled:true,profile:p,receipt:p.lastReceipt?.runId===run.id?p.lastReceipt:null};
 if(!run.result||p.activeRun?.id!==run.id||p.activeRun.sequence!==run.sequence)return {ok:false,reason:'정산할 작전이 일치하지 않습니다.'};
 const next=copy(p),r=run.result,input={...r.stats,kills:r.stats.kills,seconds:r.seconds,won:r.won,difficulty:run.difficulty,rules:run.rules};
 const award=calculateSettlement(input,{firstReport:!p.firstReport,firstClear:!p.firstClear[run.operation]});
 const completedOrders=ORDERS.filter(o=>!next.orders.includes(o.id)&&orderReady(o.id,r));award.orders=completedOrders.map(o=>({id:o.id,title:o.title,credits:o.reward}));award.orderCredits=completedOrders.reduce((n,o)=>n+o.reward,0);award.totalCredits+=award.orderCredits;next.orders.push(...completedOrders.map(o=>o.id));
 next.wallet+=award.totalCredits;if(award.oneTime.report)next.firstReport=true;if(r.won)next.firstClear[run.operation]=true;
 for(const id of ['p','h','r'])next.progress.weaponKills[id]=(next.progress.weaponKills[id]||0)+(r.stats.weaponKills[id]||0);
 next.progress.pMastery ||= !!r.stats.pMastery;next.progress.overdriveKills+=r.stats.overdriveKills||0;
 next.progress.midbossMarco=(next.progress.midbossMarco||0)+(run.hero==='marco'?(r.stats.midbosses||0):0);next.progress.unions=(next.progress.unions||0)+(r.stats.union?1:0);next.progress.bestEvolvedKills=Math.max(next.progress.bestEvolvedKills||0,r.stats.evolvedKills||0);
 next.freshMods=next.freshMods.filter(id=>!run.researchPresented.includes(id));
 const newly=[];const grant=(id,condition)=>{if(condition&&!next.achievements.includes(id)){next.achievements.push(id);newly.push(id);}};
 grant('first-clear',r.won);grant('rescue-all',r.won&&r.stats.rescues===5);grant('marco-fan',r.won&&run.hero==='marco'&&r.stats.evolved.includes('p'));grant('fio-quick',next.progress.overdriveKills>=300);grant('s-rank',r.won&&award.grade==='S');
 const key=`${RULESET}:${run.operation}:${run.difficulty}:${run.hero}`,old=next.records[key]||{score:0,kills:0,bestTime:null};
 next.records[key]={score:r.won?Math.max(old.score,award.score):old.score,kills:Math.max(old.kills,r.stats.kills),bestTime:r.won?Math.min(old.bestTime??Infinity,r.seconds):old.bestTime};
 next.lastSettledSequence=run.sequence;next.activeRun=null;
 next.lastReceipt={runId:run.id,sequence:run.sequence,hero:run.hero,difficulty:run.difficulty,result:copy(r),award,balance:next.wallet,newly,seed:run.seed};
 return {ok:true,profile:next,receipt:next.lastReceipt};
}
export function buyTraining(p,id){const t=TRAINING[id],entry=p.training[id];if(!t||!entry)return{ok:false,reason:'훈련을 확인해 주세요.'};if(p.activeRun)return{ok:false,reason:'작전 정산 후 훈련할 수 있습니다.'};if(entry.rank>=t.prices.length)return{ok:false,reason:'훈련을 모두 완료했습니다.'};const cost=t.prices[entry.rank];if(p.wallet<cost)return{ok:false,reason:`${cost-p.wallet}C가 더 필요합니다.`};const next=copy(p);next.wallet-=cost;next.training[id].rank++;next.training[id].paid.push(cost);return{ok:true,profile:next};}
export function refundTraining(p){if(p.activeRun)return{ok:false,reason:'작전 정산 후 환불할 수 있습니다.'};const next=copy(p);let amount=0;for(const e of Object.values(next.training)){amount+=e.paid.reduce((a,b)=>a+b,0);e.rank=0;e.paid=[];}next.wallet+=amount;return {ok:true,profile:next,amount};}
export function buyResearch(p,id){const r=RESEARCH[id];if(!r)return{ok:false,reason:'연구를 확인해 주세요.'};if(p.activeRun)return{ok:false,reason:'작전 정산 후 연구할 수 있습니다.'};if(p.researched.includes(id))return{ok:false,reason:'이미 연구했습니다.'};if(!researchReady(p,id))return{ok:false,reason:r.requirement};if(p.wallet<r.cost)return{ok:false,reason:`${r.cost-p.wallet}C가 더 필요합니다.`};const next=copy(p);next.wallet-=r.cost;next.researched.push(id);next.freshMods.push(id);return{ok:true,profile:next};}
export function doctrineReady(p,hero,id){const entry=DOCTRINES[hero]?.find(d=>d.id===id);return !!entry&&(!entry.locked||p.achievements.includes(hero==='marco'?'marco-fan':'fio-quick'));}
// Only replace the in-memory profile after the complete blob was saved.
export function createProfileStore(storage,initial,key=PROFILE_KEY){let current=initial;return{get:()=>current,commit(next){try{storage.setItem(key,JSON.stringify(next));current=next;return {ok:true};}catch(error){return {ok:false,reason:'저장 공간에 기록하지 못했습니다. 다시 저장해 주세요.'};}}};}
