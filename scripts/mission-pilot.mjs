import {createProfile,beginRun} from '../src/mission/profile.js';
import {createMission,stepMission,chooseMission,missionAction,takeMissionEvents} from '../src/mission/model.js';
import {BOSS_GATE} from '../src/mission/content.js';

const DT=1/60,MAX_SECONDS=600,SEEDS=[17,71],RUSH=process.argv.includes('--rush');
const round=(n,d=1)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

function threatAt(s,x,y){
  let score=0;
  for(const enemy of s.enemies){
    if(enemy.dead)continue;const d=Math.hypot(x-enemy.x,y-enemy.y),safe=enemy.type==='officer'?105:enemy.type==='shield'?75:62;
    if(d<safe)score+=500+(safe-d)*12;else if(d<safe+85)score+=(safe+85-d)*1.8;
  }
  for(const hazard of s.hazards){
    if(hazard.hit)continue;const d=Math.hypot(x-hazard.x,y-hazard.y),soon=hazard.timer<.55;
    if(d<hazard.r+25)score+=(soon?1200:250)+(hazard.r+25-d)*8;
  }
  for(const shot of s.enemyShots){
    const px=shot.x+shot.vx*.25,py=shot.y+shot.vy*.25,d=Math.hypot(x-px,y-py);
    if(d<38)score+=800+(38-d)*10;
  }
  if(s.boss.active&&['windup','charge'].includes(s.boss.mode)){
    const boss=s.boss,a=s.boss.angle,reach=s.boss.mode==='charge'?420*Math.max(0,boss.timer):300;
    const dx=Math.cos(a)*reach,dy=Math.sin(a)*reach,t=Math.max(0,Math.min(1,((x-boss.x)*dx+(y-boss.y)*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(x-(boss.x+t*dx),y-(boss.y+t*dy))<105)score+=1500;
  }
  return score;
}

function directionTo(s,target){
  const p=s.player,desired=Math.atan2(target.y-p.y,target.x-p.x);let best={score:Infinity,x:0,y:0};
  for(let i=-8;i<=8;i++){
    const a=desired+i*Math.PI/10,x=Math.cos(a),y=Math.sin(a),px=p.x+x*58,py=p.y+y*58;
    let score=Math.hypot(target.x-px,target.y-py)*.12+Math.abs(i)*.6+threatAt(s,px,py);
    if(s.stage==='boss'){
      const d=Math.hypot(px-s.boss.x,py-s.boss.y),ideal=p.slug?245:s.hero==='marco'?300:250;
      score+=Math.abs(d-ideal)*.12;
      if(s.boss.mode==='recover')score-=Math.max(0,360-d)*.04;
    }
    if(score<best.score)best={score,x,y};
  }
  return best;
}

function danger(s){
  const p=s.player;if(threatAt(s,p.x,p.y)>700)return true;
  return s.enemies.some(enemy=>!enemy.dead&&distance(enemy,p)<(p.slug?45:38));
}

function weaponState(s,id){return s.weapons.find(w=>w?.id===id);}

function scoreChoice(s,build,choice){
  if(choice.kind==='sabotage')return choice.key==='plunder'?19000:1000;
  if(choice.kind==='tactic')return choice.key===(s.front===0?(build.hero==='fio'?'fusion':'assault'):'barrage')?30000:10000;
  if(choice.kind==='union')return build.hero==='fio'?20000:100;
  if(choice.kind==='evolve'){
    const weapon=s.weapons[choice.slot]?.id;
    return build.hero==='marco'&&weapon==='p'?18000:build.hero==='fio'&&['h','r'].includes(weapon)?13000:3000;
  }
  if(choice.kind==='weapon'){
    if(build.hero==='fio'&&choice.weapon==='r')return 17000;
    if(build.hero==='fio'&&choice.weapon==='h')return 12000;
    if(build.hero==='marco'&&choice.weapon==='p')return 9000;
    return choice.weapon==='r'?3500:2500;
  }
  if(choice.kind==='rank'){
    const weapon=s.weapons[choice.slot];if(!weapon)return -1;
    if(build.hero==='marco')return weapon.id==='p'?15000+(3-weapon.rank)*100:2500;
    if(['h','r'].includes(weapon.id))return 14000+(3-weapon.rank)*200+(weapon.id==='r'?50:0);
    return 1000;
  }
  if(choice.kind==='mod')return 7000;
  if(choice.kind==='resupply')return s.player.hp<s.player.maxHp*.5?9000:1200;
  if(choice.kind==='utility')return ({projectile:6000,power:5500,tempo:5000,vitality:s.player.hp<s.player.maxHp*.55?6500:1800,magnet:1200})[choice.key]??500;
  return 0;
}

function handleChoice(s,build,state){
  const ranked=s.choices.map(choice=>({choice,score:scoreChoice(s,build,choice)})).sort((a,b)=>b.score-a.score);
  const pick=ranked[0]?.choice;
  if(!pick||!chooseMission(s,pick.id)){state.issues.push(`t=${round(s.t)} choice failed: ${pick?.id||'none'}`);return false;}
  state.choices.push({time:round(s.t),type:s.choiceType||pick.kind,id:pick.id,title:pick.title});return true;
}

function nextTarget(s,build,state){
  if(s.stage==='boss'){
    const b=s.boss,p=s.player,a=Math.atan2(p.y-b.y,p.x-b.x)+(build.hero==='marco'?.38:.72),radius=p.slug?245:build.hero==='marco'?300:250;
    return {x:b.x+Math.cos(a)*radius,y:b.y+Math.sin(a)*radius,id:'boss-combat'};
  }
  const route=RUSH?['first','convoy']:['first','camp','convoy','prison',...(build.useSlug?['garage']:[]),...(s.front>0?['battery']:[])];
  for(const id of route){const site=s.sites.find(x=>x.id===id);if(site&&site.state!=='done')return {...site,id};}
  return {...BOSS_GATE,id:'boss-gate'};
}

function maybeAct(s,build,state,target){
  const p=s.player;
  if(danger(s)&&p.dashCd<=0)missionAction(s,'dash');
  const enemies=s.enemies.filter(e=>!e.dead);
  const shouldSkill=s.boss.active||enemies.filter(e=>distance(e,p)<700).length>=5;
  if(shouldSkill&&p.skillCd<=0){
    const before=p.skillCd;if(missionAction(s,'skill')&&before<=0)state.actions.skills++;
  }
  if(s.stage==='field'){
    if(target.id==='garage'&&target.state==='ready'&&distance(p,target)<115){
      if(missionAction(s,'interact'))state.actions.interactions++;
      else state.issues.push(`t=${round(s.t)} garage interaction failed`);
    }else if(target.id==='boss-gate'&&distance(p,BOSS_GATE)<175){
      const rodeSlug=p.slug;
      if(missionAction(s,'interact')){
        state.actions.interactions++;
        if(s.stage==='boss'){
          state.bossAt=s.t;state.bossStarts[s.front]=s.t;
          state.slugAtBoss=rodeSlug;
        }else if(rodeSlug){
          state.issues.push(`t=${round(s.t)} boss gate interaction dismounted Slug instead of starting boss`);
        }
      }
      else state.issues.push(`t=${round(s.t)} boss interaction failed`);
    }
  }
}

function runMission({hero,seed,useSlug}){
  const started=beginRun(createProfile(`pilot-${hero}-${seed}-${useSlug?'slug':'foot'}`),{hero,difficulty:'normal',seed});
  if(!started.ok)throw new Error(started.reason);
  const s=createMission(started.descriptor),build={hero,useSlug};
  const state={bossAt:null,bossStarts:{},slugAtBoss:false,choices:[],nodeTimes:{},issues:[],actions:{skills:0,interactions:0,dashes:0},events:{}};
  let frames=0,previousDash=0;
  while(s.phase!=='result'&&s.t<MAX_SECONDS&&frames<MAX_SECONDS*60+5000){
    frames++;
    if(s.phase==='choice'){
      const type=s.choiceType;if(!handleChoice(s,build,state))break;
      state.choices.at(-1).type=type;for(const event of takeMissionEvents(s))state.events[event]=(state.events[event]||0)+1;continue;
    }
    if(s.phase!=='playing'){state.issues.push(`t=${round(s.t)} unhandled phase ${s.phase}`);break;}
    const target=nextTarget(s,build,state);maybeAct(s,build,state,target);
    const input=directionTo(s,target);stepMission(s,DT,input);
    if(s.player.dashCd>previousDash+.5)state.actions.dashes++;previousDash=s.player.dashCd;
    if(s.boss.active&&state.bossStarts[s.front]===undefined){state.bossAt=s.t;state.bossStarts[s.front]=s.t;}
    for(const site of s.sites)if(site.state==='done'&&state.nodeTimes[`${s.front}:${site.id}`]===undefined)state.nodeTimes[`${s.front}:${site.id}`]=round(s.t);
    for(const event of takeMissionEvents(s))state.events[event]=(state.events[event]||0)+1;
    if(!Number.isFinite(s.player.hp)||!Number.isFinite(s.player.x)||!Number.isFinite(s.player.y)){state.issues.push(`t=${round(s.t)} non-finite player state`);break;}
  }
  if(s.t>=MAX_SECONDS&&s.phase!=='result')state.issues.push(`${MAX_SECONDS}s model cap reached without result`);
  if(frames>=MAX_SECONDS*60+5000&&s.phase!=='result')state.issues.push('frame budget exhausted');
  const result=s.result;
  return {
    hero,seed,useSlug,outcome:result?.won?'victory':result?'defeat':'incomplete',reason:result?.reason??s.phase,
    time:round(result?.seconds??s.t),hp:round(s.player.hp),level:s.level,kills:s.stats.kills,elites:s.stats.elites,rescues:s.stats.rescues,outposts:s.stats.outposts,
    bossTtk:result?.won&&state.bossAt!==null?round(result.seconds-state.bossAt):null,slugAtBoss:state.slugAtBoss,bossHp:round(s.boss.hp),parts:Object.fromEntries(s.boss.parts.map(p=>[p.id,round(p.hp)])),
    frontBattles:[...s.frontHistory.map(f=>({front:f.front,seconds:round(f.at-state.bossStarts[f.front])})),...(result?.won?[{front:2,seconds:round(result.seconds-state.bossStarts[2])}]:[])],frontHistory:s.frontHistory,bossStarts:state.bossStarts,tactics:s.tactics,nodeTimes:state.nodeTimes,unionAt:state.choices.find(c=>c.id==='union')?.time??null,choices:state.choices,weapons:s.weapons.map(w=>w&&({id:w.id,rank:w.rank,evolved:w.evolved,mods:w.mods})),cores:s.cores,
    stats:{...s.stats},actions:state.actions,events:state.events,issues:state.issues
  };
}

const runs=[];
for(const seed of SEEDS)for(const hero of ['marco','fio'])for(const useSlug of (RUSH?[false]:[false,true]))runs.push(runMission({hero,seed,useSlug}));

const aggregates=[];
for(const hero of ['marco','fio'])for(const useSlug of (RUSH?[false]:[false,true])){
  const set=runs.filter(r=>r.hero===hero&&r.useSlug===useSlug);
  aggregates.push({hero,useSlug,wins:set.filter(r=>r.outcome==='victory').length,runs:set.length,medianTime:round(median(set.map(r=>r.time))),medianBossTtk:round(median(set.map(r=>r.bossTtk))),medianKills:round(median(set.map(r=>r.kills))),medianHp:round(median(set.map(r=>r.hp))),issues:set.flatMap(r=>r.issues)});
}

const report={rules:{dt:DT,maxSeconds:MAX_SECONDS,seeds:SEEDS,route:RUSH?'rush first/convoy/boss':'all field supplies and artillery positions'},policy:'public API only; state-aware threat steering, objective navigation, ordinary dash/skill/interact inputs',aggregates,runs};
const output=process.argv.includes('--summary')?{rules:report.rules,policy:report.policy,aggregates,runs:runs.map(({choices,events,...run})=>({...run,choiceCount:choices.length}))}:report;
process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
