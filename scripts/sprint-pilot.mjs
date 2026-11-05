// Input-only diagnostic. This is a model policy, not a human fun or mobile-input test.
import {
  RULES,
  createSprint,
  stepSprint,
  chooseSprint,
  sprintAction,
  takeEvents
} from '../src/sprint/model.js';

const DT=1/60;
const SEEDS=[17,71,2026];
const PATHS=['pierce','trail'];
const EVOLUTIONS=['crowd','focus'];
const round=(n,digits=1)=>Number.isFinite(n)?Number(n.toFixed(digits)):null;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const median=values=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

function segmentDistance(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}

function aliveEnemies(s){return s.enemies.filter(enemy=>!enemy.dead);}

function bossChargeDanger(s,x=s.player.x,y=s.player.y){
  const boss=s.boss;
  if(!boss||boss.dead||!['windup','charge'].includes(boss.mode))return false;
  const angle=boss.chargeAngle??Math.atan2(s.player.y-boss.y,s.player.x-boss.x);
  const reach=boss.mode==='charge'?560*Math.max(0,boss.timer):560*.5;
  return segmentDistance(x,y,boss.x,boss.y,boss.x+Math.cos(angle)*reach,boss.y+Math.sin(angle)*reach)<boss.r+30;
}

function chooseDirection(s,path){
  const p=s.player,enemies=aliveEnemies(s),boss=enemies.find(enemy=>enemy.type==='king');
  if(!enemies.length)return {x:p.fx||1,y:p.fy||0};
  const nearest=[...enemies].sort((a,b)=>distance(a,p)-distance(b,p))[0];
  let best={score:Infinity,x:p.fx||1,y:p.fy||0};
  for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,x=Math.cos(angle),y=Math.sin(angle),px=p.x+x*72,py=p.y+y*72;
    const prior=p.fx*x+p.fy*y;
    let score=(1-prior)*(path==='pierce'?12:3);
    for(const enemy of enemies){
      const d=Math.hypot(enemy.x-px,enemy.y-py),safe=enemy.type==='king'?112:enemy.type==='runner'?72:62;
      if(d<safe)score+=700+(safe-d)*18;
      else if(d<safe+78)score+=(safe+78-d)*2.2;
      if(['windup','charge'].includes(enemy.mode)){
        const chargeAngle=enemy.chargeAngle??Math.atan2(p.y-enemy.y,p.x-enemy.x);
        if(segmentDistance(px,py,enemy.x,enemy.y,enemy.x+Math.cos(chargeAngle)*330,enemy.y+Math.sin(chargeAngle)*330)<enemy.r+34)score+=900;
      }
    }
    if(path==='pierce'){
      let lane=0;
      for(const enemy of enemies){
        const d=distance(enemy,p);if(d>700)continue;
        const ex=(enemy.x-p.x)/(d||1),ey=(enemy.y-p.y)/(d||1),alignment=x*ex+y*ey;
        if(alignment>.88)lane+=(alignment-.88)*55+Math.max(0,650-d)/130;
      }
      score-=lane*8;
      if(distance(nearest,p)<125){
        const awayX=(p.x-nearest.x)/(distance(nearest,p)||1),awayY=(p.y-nearest.y)/(distance(nearest,p)||1);
        score-=(x*awayX+y*awayY)*55;
      }
      if(boss&&boss.mode==='recover'){
        const d=distance(boss,p),bx=(boss.x-p.x)/(d||1),by=(boss.y-p.y)/(d||1);
        score-=(x*bx+y*by)*34;
      }
    }else{
      const d=distance(nearest,p),away=Math.atan2(p.y-nearest.y,p.x-nearest.x);
      const tangent=away+Math.PI/2,angleDelta=Math.atan2(Math.sin(angle-tangent),Math.cos(angle-tangent));
      score+=Math.abs(angleDelta)*18+Math.abs(Math.hypot(px-nearest.x,py-nearest.y)-165)*.11;
      if(d<105)score-=Math.cos(angle-away)*70;
      if(boss){
        const bd=distance(boss,p),bossAway=Math.atan2(p.y-boss.y,p.x-boss.x),bossTangent=bossAway+Math.PI/2;
        const delta=Math.atan2(Math.sin(angle-bossTangent),Math.cos(angle-bossTangent));
        score+=Math.abs(delta)*14+Math.abs(Math.hypot(px-boss.x,py-boss.y)-185)*.07;
        if(bd<115)score-=Math.cos(angle-bossAway)*75;
      }
    }
    if(score<best.score)best={score,x,y};
  }
  return best;
}

function act(s,path){
  const p=s.player,enemies=aliveEnemies(s),boss=enemies.find(enemy=>enemy.type==='king');
  const nearest=enemies.length?Math.min(...enemies.map(enemy=>distance(enemy,p))):Infinity;
  if(p.dashCd<=0&&(nearest<48||bossChargeDanger(s)))sprintAction(s,'dash');
  if(!path||p.skillCd>0)return;
  if(path==='pierce'){
    const useful=boss||enemies.filter(enemy=>distance(enemy,p)<700).length>=4;
    if(useful)sprintAction(s,'skill');
  }else{
    const active=s.mines.filter(mine=>!mine.spent);
    const threatened=active.some(mine=>enemies.some(enemy=>distance(enemy,mine)<125));
    if(active.length>=4&&(threatened||boss))sprintAction(s,'skill');
  }
}

function runOne({seed,path,evolution,mode}){
  const s=createSprint(seed);
  const phaseKills={opening:null,branch:null,evolved:null,boss:null};
  const markers={branchKills:null,evolutionKills:null,bossKills:null,bossAt:null};
  const eventCounts={};
  const issues=[];
  let frames=0;
  while(s.phase!=='result'&&frames<RULES.duration*90){
    frames++;
    if(s.phase==='choice'){
      if(s.choice==='path'){
        markers.branchKills??=s.kills;
        if(!chooseSprint(s,path))issues.push(`path choice failed at ${round(s.t,2)}`);
      }else if(s.choice==='evolution'){
        markers.evolutionKills??=s.kills;
        if(!chooseSprint(s,evolution||'crowd'))issues.push(`evolution choice failed at ${round(s.t,2)}`);
      }else issues.push(`unknown choice ${String(s.choice)}`);
      for(const name of takeEvents(s))eventCounts[name]=(eventCounts[name]||0)+1;
      continue;
    }
    if(s.phase!=='playing'){
      issues.push(`unhandled phase ${s.phase}`);
      break;
    }
    const input=mode==='active'?chooseDirection(s,path):{x:0,y:0};
    if(mode==='active')act(s,path);
    stepSprint(s,DT,input);
    if(s.bossSpawned&&markers.bossAt===null){markers.bossAt=s.t;markers.bossKills=s.kills;}
    for(const name of takeEvents(s))eventCounts[name]=(eventCounts[name]||0)+1;
    if(!Number.isFinite(s.player.hp)||!Number.isFinite(s.player.x)||!Number.isFinite(s.player.y)){
      issues.push(`non-finite player state at ${round(s.t,2)}`);
      break;
    }
  }
  markers.branchKills??=s.kills;
  markers.evolutionKills??=s.kills;
  markers.bossKills??=s.kills;
  phaseKills.opening=markers.branchKills;
  phaseKills.branch=Math.max(0,markers.evolutionKills-markers.branchKills);
  phaseKills.evolved=Math.max(0,markers.bossKills-markers.evolutionKills);
  phaseKills.boss=Math.max(0,s.kills-markers.bossKills);
  if(frames>=RULES.duration*90&&s.phase!=='result')issues.push('frame budget exhausted');
  return {
    mode,seed,path,evolution:s.evolution,requestedEvolution:evolution,
    outcome:s.result?.won?'victory':s.phase==='result'?'defeat':'incomplete',
    reason:s.result?.reason??s.phase,
    time:round(s.result?.time??s.t,2),
    hp:round(s.player.hp),level:s.level,kills:s.kills,
    bossTtk:s.result?.won&&markers.bossAt!==null?round(s.result.time-markers.bossAt,2):null,
    phaseKills,
    stats:{...s.stats},
    actions:{skills:s.stats.skillUses,dashes:s.stats.dashes},
    eventCounts,
    issues
  };
}

function aggregate(runs){
  const groups=[];
  const keys=[
    ...PATHS.flatMap(path=>EVOLUTIONS.map(evolution=>({mode:'active',path,evolution}))),
    ...PATHS.map(path=>({mode:'afk',path,evolution:null}))
  ];
  for(const {mode,path,evolution} of keys){
    const set=runs.filter(run=>run.mode===mode&&run.path===path&&(mode==='afk'||run.evolution===evolution));
    groups.push({
      mode,path,evolution,runs:set.length,wins:set.filter(run=>run.outcome==='victory').length,
      medianTime:round(median(set.map(run=>run.time)),2),
      medianBossTtk:round(median(set.map(run=>run.bossTtk)),2),
      medianHp:round(median(set.map(run=>run.hp))),
      medianKills:round(median(set.map(run=>run.kills))),
      phaseKills:Object.fromEntries(['opening','branch','evolved','boss'].map(key=>[key,round(median(set.map(run=>run.phaseKills[key])))])),
      branchStats:{
        multiShots:round(median(set.map(run=>run.stats.multiShots))),
        trapsLaid:round(median(set.map(run=>run.stats.trapsLaid))),
        trapsTriggered:round(median(set.map(run=>run.stats.trapsTriggered))),
        trapKills:round(median(set.map(run=>run.stats.trapKills))),
        bossDamage:round(median(set.map(run=>run.stats.bossDamage)))
      }
    });
  }
  return groups;
}

const runs=[];
for(const seed of SEEDS)for(const path of PATHS)for(const evolution of EVOLUTIONS)runs.push(runOne({mode:'active',seed,path,evolution}));
for(const seed of SEEDS)for(const path of PATHS)runs.push(runOne({mode:'afk',seed,path,evolution:null}));

const report={
  rules:RULES,dt:DT,seeds:SEEDS,
  policy:{active:'24-way threat-density steering, boss charge dodge, API dash/skill',afk:'zero movement and no actions after the ordinary path choice'},
  aggregates:aggregate(runs),
  runs
};

const output=process.argv.includes('--summary')
  ?{rules:report.rules,dt:report.dt,seeds:report.seeds,policy:report.policy,aggregates:report.aggregates,issues:runs.flatMap(run=>run.issues.map(issue=>({seed:run.seed,path:run.path,evolution:run.evolution,mode:run.mode,issue})))}
  :report;
process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
