import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createJourneyExpedition,interact,updateExpedition} from '../src/game/expedition.js';
import {takeJourneyCache,leaveJourneyCache} from '../src/game/journey-world.js';
import {stepGame,applyChoice,claimBossReward,closeChest,selectChest,openForge} from '../src/core/game.js';
import {journeyStatus,REGIONS} from '../src/core/journey.js';
import {WEAPONS} from '../src/core/content.js';
import {equipRelic,leaveRelicCache} from '../src/core/relics.js';
import {fieldContains,chargeProfile} from '../src/core/patterns.js';

// Examples:
//   node scripts/journey-pilot.mjs
//   node scripts/journey-pilot.mjs --hero bram --style counter --no-union
//   node scripts/journey-pilot.mjs --hero pip --style spread --core moon --partner acorn
//   node scripts/journey-pilot.mjs --hero pip --trial --seed 1437 --seconds 900
//   node scripts/journey-pilot.mjs --hero bram --no-union --out work/journey-results/bram.json
const DT=1/60;
const SAMPLE_TIMES=[20,60,120,180,240,300,420,600,900];
const DEFAULTS={
  seed:1437,
  seconds:900,
  takeTrial:false,
  view:{width:390,height:720}
};
const BUILDS={
  pip:{weapon:'acorn',union:'returning',core:'acorn',partner:'moon',style:'focus',radius:220},
  bram:{weapon:'briar',union:'hive',core:'briar',partner:'bees',style:'guard',radius:105}
};
const round=n=>Math.round(n*10)/10;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const siteKey=(g,site)=>`${g.campaign.regionIndex}:${site.id}`;

function targetRanks(g,build){
  return Object.fromEntries([build.core,build.partner].map(id=>[id,g.weapons[id]?.rank||0]));
}
function hasUnion(g,build){return !!(build.union&&g.weapons[build.union]);}
function targetComplete(g,build){return build.union?hasUnion(g,build):[build.core,build.partner].every(id=>g.weapons[id]?.evolved);}
function targetRecipes(build){return [...new Set([build.core,...(build.union?[]:[build.partner])].map(id=>WEAPONS[id].recipe))];}
function canTransform(g,build){
  const core=g.weapons[build.core],partner=g.weapons[build.partner];
  if(!core||!partner)return false;
  const evolutionTargets=build.union?[build.core]:[build.core,build.partner];
  const canEvolve=evolutionTargets.some(id=>g.weapons[id].rank===8&&!g.weapons[id].evolved&&g.passives[WEAPONS[id].recipe]&&g.campaign.seals>0);
  const canUnion=build.union&&!hasUnion(g,build)&&core.rank===8&&partner.rank===8&&(core.evolved||partner.evolved);
  return !!(canEvolve||canUnion);
}
function weaponDamage(g){
  return Object.fromEntries(Object.entries(g.metrics.weapons||{}).map(([id,stages])=>[id,Math.round(Object.values(stages).reduce((sum,s)=>sum+(s.damage||0),0))]));
}
function actionLog(state,g,type,data={}){state.timeline.push({time:round(g.time),region:g.campaign.regionIndex,type,...data});}
function bug(state,g,message){
  const text=`t=${round(g.time)} r${g.campaign.regionIndex+1} ${message}`;
  if(!state.runtimeBugs.includes(text))state.runtimeBugs.push(text);
}
function warn(state,g,message){
  const text=`t=${round(g.time)} r${g.campaign.regionIndex+1} ${message}`;
  if(!state.warnings.includes(text))state.warnings.push(text);
}

function choiceScore(g,build,choice){
  if(choice.kind==='style')return choice.id===build.style?10000:1;
  if([build.core,build.partner].includes(choice.id))return 5000+(8-(g.weapons[choice.id]?.rank||0))*100;
  if(targetRecipes(build).includes(choice.id)&&!g.passives[choice.id])return 4200;
  const useful=build.hero==='pip'?['twin','feather','berry','stone','swift']:['leaf','bark','dew','berry','stone'];
  if(choice.kind==='boon')return choice.id==='heal'&&g.player.hp<g.player.maxHp*.55?900:choice.id==='power'?500:100;
  return 700-Math.max(0,useful.indexOf(choice.id))*40+(choice.owned?50:0);
}
function handleChoice(g,build,state){
  const ranked=g.choices.map((choice,index)=>({choice,index,score:choiceScore(g,{...build,hero:g.hero},choice)})).sort((a,b)=>b.score-a.score);
  const pick=ranked[0];
  if(!pick||!applyChoice(g,pick.index)){bug(state,g,`성장 선택 실패 (${pick?.choice?.id||'없음'})`);return false;}
  actionLog(state,g,pick.choice.kind==='style'?'style':'level',{id:pick.choice.id,level:g.level});return true;
}
function handleCache(g,build,state){
  const offer=g.cacheOffer,site=g.expedition.sites.find(s=>s.id===offer?.siteId);
  if(!offer||!site){bug(state,g,'보급 메뉴에 유효한 site가 없음');return false;}
  const ranked=offer.options.map((choice,index)=>({choice,index,score:[build.partner,build.core].includes(choice.id)?1000:choice.id===WEAPONS[build.core].recipe?800:0})).sort((a,b)=>b.score-a.score);
  const pick=ranked[0];
  if(pick?.score>0){
    if(!takeJourneyCache(g,pick.index)){bug(state,g,`보급 선택 실패 (${pick.choice.id})`);return false;}
    actionLog(state,g,'cache-take',{site:site.id,id:pick.choice.id,kind:pick.choice.kind});return true;
  }
  state.inspectedCaches.add(siteKey(g,site));
  if(!leaveJourneyCache(g)){bug(state,g,`보급 보류 실패 (${site.id})`);return false;}
  actionLog(state,g,'cache-leave',{site:site.id,options:offer.options.map(o=>o.id)});return true;
}
function rewardId(g,build){
  const recipe=targetRecipes(build).find(id=>!g.passives[id]);
  if(recipe){
    if(Object.keys(g.passives).length<4)return `catalyst:${recipe}`;
    const replace=Object.keys(g.passives).find(id=>id!==recipe&&!Object.values(g.weapons).some(w=>WEAPONS[w.core||'']?.recipe===id));
    if(replace)return `catalyst:${recipe}:${replace}`;
  }
  const rankTarget=[build.core,build.partner].filter(id=>g.weapons[id]&&!g.weapons[id].evolved&&g.weapons[id].rank<8).sort((a,b)=>g.weapons[a].rank-g.weapons[b].rank)[0];
  if(rankTarget)return `weapon:${rankTarget}`;
  return g.player.hp<g.player.maxHp*.75?'heal':'skip';
}
function preferredTransform(g,build){
  const options=g.chest?.options||[];
  return (build.union&&options.find(o=>o.kind==='union'&&o.weapon===build.union&&o.core===build.core))
    ||options.find(o=>o.kind==='evolution'&&(build.union?o.weapon===build.core:[build.core,build.partner].includes(o.weapon)));
}
function handleChest(g,build,state){
  if(g.campaign.rewardPending){
    const id=rewardId(g,build);
    if(!claimBossReward(g,id)){bug(state,g,`보스 보조 보상 실패 (${id})`);if(!claimBossReward(g,'skip'))return false;}
    actionLog(state,g,'boss-reward',{id});return true;
  }
  const transform=preferredTransform(g,build);
  if(transform){
    if(!selectChest(g,transform.id)){bug(state,g,`변환 실패 (${transform.id})`);return false;}
    actionLog(state,g,transform.kind,{id:transform.weapon,core:transform.core||transform.weapon});return true;
  }
  if(!closeChest(g)){bug(state,g,'정비 패널 닫기 실패');return false;}
  actionLog(state,g,'forge-close');return true;
}
function handleRelic(g,state){
  const offer=g.relicOffer;if(!offer)return false;
  const preference=['shell','thorn','wind','thread','seed','tide'];
  const id=[...offer.options].sort((a,b)=>preference.indexOf(a)-preference.indexOf(b))[0];
  const replace=g.relics.items.length>=2?g.relics.items.at(-1):null;
  if(equipRelic(g,id,replace)){actionLog(state,g,'relic',{id,replace});return true;}
  if(leaveRelicCache(g)){actionLog(state,g,'relic-leave');return true;}
  return false;
}

function hazardAt(g,x,y){
  for(const q of g.projectiles)if(q.hostile&&Math.hypot(x-q.x-q.vx*.22,y-q.y-q.vy*.22)<34)return true;
  for(const f of g.fields)if(f.hostile&&f.warning<.65&&fieldContains({...f,r:f.r+16},{x,y}))return true;
  for(const e of g.enemies)if(!e.dead&&e.mode==='charge'){
    const profile=chargeProfile(e),along=(x-e.x)*e.dx+(y-e.y)*e.dy,across=Math.abs((x-e.x)*e.dy-(y-e.y)*e.dx);
    if(along>0&&along<profile.speed*profile.duration+30&&across<e.r+28)return true;
  }
  return false;
}
function steer(g,target,build){
  const p=g.player,desired=Math.atan2(target.y-p.y,target.x-p.x);let best={score:Infinity,x:0,y:0};
  for(let i=-4;i<=4;i++){
    const a=desired+i*Math.PI/8,x=Math.cos(a),y=Math.sin(a),px=p.x+x*46,py=p.y+y*46;
    let score=Math.hypot(target.x-px,target.y-py)*.1+Math.abs(i)*.35;
    for(const rock of g.terrain){const d=Math.hypot(px-rock.x,py-rock.y);if(d<rock.r*.78+20)score+=700+(rock.r*.78+20-d)*8;}
    for(const e of g.enemies){
      if(e.dead)continue;const d=Math.hypot(px-e.x,py-e.y),safe=e.bossRole?build.radius*.55:e.targetRole==='support-flower'?70:g.hero==='bram'?58:86;
      if(d<safe)score+=(safe-d)*(e.bossRole?2.2:1.5);
    }
    if(hazardAt(g,px,py))score+=900;
    for(const gem of g.gems.values()){const d=Math.hypot(px-gem.x,py-gem.y);if(d<100)score-=Math.min(3,gem.value*.18)*(1-d/100);}
    if(score<best.score)best={score,x,y};
  }
  const nearby=g.enemies.some(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<150),hold=g.hero==='bram'&&nearby&&!hazardAt(g,p.x,p.y)&&g.time%3.2<.7;
  return hold?{x:0,y:0}:best;
}
function gemTarget(g,maxDistance=440){
  const p=g.player;return [...g.gems.values()].filter(x=>Math.hypot(x.x-p.x,x.y-p.y)<maxDistance).sort((a,b)=>b.value/(50+distance(p,b))-a.value/(50+distance(p,a)))[0]||null;
}
function combatTarget(g,enemy,build){
  const p=g.player,a=Math.atan2(p.y-enemy.y,p.x-enemy.x)+(g.hero==='pip'?.24:.12),r=enemy.targetRole==='support-flower'?(g.hero==='pip'?180:90):build.radius;
  return {x:enemy.x+Math.cos(a)*r,y:enemy.y+Math.sin(a)*r,kind:'combat'};
}
function navigationTarget(g,build,state){
  const status=journeyStatus(g),p=g.player,boss=g.enemies.find(e=>e.bossRole&&!e.dead);
  if(boss){const flower=g.enemies.find(e=>e.targetRole==='support-flower'&&!e.dead);return combatTarget(g,flower||boss,build);}
  const spring=g.expedition.sites.find(s=>s.kind==='spring'&&s.state==='ready');
  if(spring&&p.hp<p.maxHp*.42)return {...spring,action:'interact'};
  if(g.campaign.stageState==='cleared'){
    const waitingForBuild=g.campaign.regionIndex===1&&!targetComplete(g,build)&&g.time-(g.campaign.encounter.defeatedAt||g.time)<90;
    if(waitingForBuild){const gem=gemTarget(g,700);if(gem)return gem;}
    const exit=g.expedition.sites.find(s=>s.kind==='exit'&&s.state==='ready');if(exit)return {...exit,action:'interact'};
  }
  const trial=g.expedition.sites.find(s=>s.kind==='trial');
  if(state.takeTrial&&trial?.state==='active'){const a=g.time*.55;return {x:trial.x+Math.cos(a)*125,y:trial.y+Math.sin(a)*125};}
  if(state.takeTrial&&trial?.state==='ready'&&!state.trialAttempted){return {...trial,action:'interact'};}
  const relic=state.takeTrial?g.pickups.find(item=>item.type==='relic'&&!state.ignoredRelics.has(item.id)):null;
  if(relic)return {...relic,action:'interact',relic:true};
  const caches=g.expedition.sites.filter(s=>s.kind==='armory'&&['ready','guarded'].includes(s.state)&&!state.inspectedCaches.has(siteKey(g,s)));
  const wanted=caches.find(s=>!g.weapons[build.partner]&&s.primary)||caches[0];if(wanted)return {...wanted,action:'interact'};
  const regionElapsed=g.time-g.campaign.stageStartedAt,targetLevel=g.campaign.regionIndex===0?9:21;
  const prepared=g.campaign.regionIndex===1&&(state.prepare||!build.union)?targetComplete(g,build)||[build.core,build.partner].every(id=>(g.weapons[id]?.rank||0)>=8):g.level>=targetLevel||regionElapsed>=150;
  if(status.canChallenge&&prepared){
    const gate=g.expedition.sites.find(s=>s.kind==='gate');return {...gate,action:'interact',challenge:true};
  }
  const gem=gemTarget(g);if(gem)return gem;
  const sites=g.expedition.sites.filter(s=>!['nest','exit'].includes(s.kind));
  const points=[...sites,{x:-620,y:0},{x:620,y:80},{x:0,y:580},{x:0,y:-350}];
  const point=points[state.patrol%points.length];if(Math.hypot(point.x-p.x,point.y-p.y)<70)state.patrol++;return points[state.patrol%points.length];
}

export function runJourneyPilot(options={}){
  const config={...DEFAULTS,...options},base=BUILDS[config.hero||'pip'];if(!base)throw new Error(`Unsupported hero: ${config.hero}`);
  const build={...base,...config.build},g=createJourneyExpedition(config.hero||'pip',base.weapon,config.seed,{difficulty:'normal'});
  g.view={...config.view};
  const state={prepare:!!config.prepare,takeTrial:config.takeTrial,trialAttempted:false,inspectedCaches:new Set(),ignoredRelics:new Set(),patrol:0,lastRegion:0,timeline:[],runtimeBugs:[],warnings:[],samples:[],sampleIndex:0};
  let menuFrames=0,frame=0;
  for(;frame<config.seconds*60+20000&&g.time<config.seconds&&g.phase!=='result';frame++){
    if(g.campaign.regionIndex!==state.lastRegion){state.lastRegion=g.campaign.regionIndex;state.patrol=0;state.inspectedCaches.clear();actionLog(state,g,'region',{name:REGIONS[g.campaign.regionIndex].name});}
    if(g.phase==='choice'){menuFrames++;if(!handleChoice(g,build,state))break;continue;}
    if(g.phase==='cache'){menuFrames++;if(!handleCache(g,build,state))break;continue;}
    if(g.phase==='chest'){menuFrames++;if(!handleChest(g,build,state))break;continue;}
    if(g.phase==='relic'){menuFrames++;if(!handleRelic(g,state))break;continue;}
    if(g.phase!=='playing'){bug(state,g,`처리하지 못한 phase ${g.phase}`);break;}
    if(g.campaign.transitionPending){updateExpedition(g);continue;}
    if(canTransform(g,build)){
      if(!openForge(g))bug(state,g,'공방 열기 실패');
      else{actionLog(state,g,'forge-open');continue;}
    }
    const target=navigationTarget(g,build,state),p=g.player;
    if(target.action==='interact'&&Math.hypot(target.x-p.x,target.y-p.y)<68){
      const before=g.phase,ok=interact(g);
      if(target.kind==='trial')state.trialAttempted=true;
      if(target.relic&&!ok)state.ignoredRelics.add(target.id);
      if(target.challenge&&ok)actionLog(state,g,'boss-challenge',{boss:REGIONS[g.campaign.regionIndex].boss,level:g.level});
      if(target.kind==='trial'&&ok)actionLog(state,g,'trial-start');
      if(!ok&&before===g.phase&&target.kind!=='armory'&&target.kind!=='spring')bug(state,g,`상호작용 실패 (${target.id||target.kind})`);
      if(ok||g.phase!==before){updateExpedition(g);continue;}
    }
    const input=steer(g,target,build),danger=hazardAt(g,p.x,p.y)||g.enemies.some(e=>e.mode==='charge'&&Math.hypot(e.x-p.x,e.y-p.y)<115);
    stepGame(g,DT,{x:input.x,y:input.y,skill:p.charge>=100,dash:danger&&p.dashCooldown<=0});updateExpedition(g);g.events=[];
    if(!Number.isFinite(p.hp)||!Number.isFinite(p.x)||!Number.isFinite(p.y)){bug(state,g,'비정상 플레이어 수치');break;}
    if(g.time>=SAMPLE_TIMES[state.sampleIndex]){state.samples.push({time:SAMPLE_TIMES[state.sampleIndex++],region:g.campaign.regionIndex+1,level:g.level,hp:Math.round(p.hp),kills:g.kills,damage:Math.round(g.damage),xpCollected:round(g.metrics.xpCollected||0),ranks:targetRanks(g,build),union:hasUnion(g,build)});}
  }
  if(frame>=config.seconds*60+20000&&g.time<config.seconds&&g.phase!=='result')warn(state,g,'프레임 예산 소진');
  if(g.time>=config.seconds&&g.phase!=='result')warn(state,g,`${config.seconds}초 상한 도달`);
  if(g.level>=10&&!g.mastery.branch)warn(state,g,'Lv.10 이후 스타일 미선택');
  if(!targetComplete(g,build))warn(state,g,build.union?`목표 합체 ${build.union} 미완성`:'목표 양쪽 진화 미완성');
  const firstCache=state.timeline.find(item=>item.type==='cache-take');
  const result={
    hero:g.hero,seed:config.seed,target:build.union?`${build.core} -> ${build.union}`:`${build.core} + ${build.partner} (양쪽 진화)`,outcome:g.outcome||'incomplete',elapsed:round(g.time),firstCacheAt:firstCache?.time??null,level:g.level,hp:round(g.player.hp),kills:g.kills,
    cleared:g.campaign.cleared,region:g.campaign.regionIndex+1,style:g.mastery.branch,union:g.weapons[build.union]?{id:build.union,core:g.weapons[build.union].core,branch:g.weapons[build.union].branch}:null,
    bossRecords:g.campaign.records.map(r=>({region:r.region+1,boss:REGIONS[r.region].boss,at:round(r.time),duration:round(r.duration),kills:r.kills})),
    weapons:Object.fromEntries(Object.entries(g.weapons).map(([id,w])=>[id,{rank:w.rank,evolved:w.evolved,core:w.core,branch:w.branch}])),maxRanks:{...g.maxRanks},passives:{...g.passives},seals:g.campaign.seals,
    damage:Math.round(g.damage),weaponDamage:weaponDamage(g),damageTaken:Math.round(g.metrics.damageTaken),blocked:Math.round(g.mastery.blocked||0),multiHits:g.mastery.multiHits||0,
    xpDropped:round(g.metrics.xpDropped||0),xpCollected:round(g.metrics.xpCollected||0),targetComplete:targetComplete(g,build),runtimeBugs:state.runtimeBugs,warnings:state.warnings,timeline:state.timeline,samples:state.samples,menuFrames
  };
  return result;
}

export function runRequiredJourneys(options={}){
  return [runJourneyPilot({...options,hero:'pip'}),runJourneyPilot({...options,hero:'bram'})];
}

function cliOptions(args){
  const value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined;};
  const hero=value('--hero'),seed=Number(value('--seed')),seconds=Number(value('--seconds')),style=value('--style'),core=value('--core'),partner=value('--partner'),union=value('--union');
  const build={...(style?{style}:{}),...(core?{core}:{}),...(partner?{partner}:{}),...(union?{union}:{}),...(args.includes('--no-union')?{union:null}:{})};
  return {...(hero?{hero}:{}),...(Number.isFinite(seed)?{seed}:{}),...(Number.isFinite(seconds)?{seconds}:{}),...(args.includes('--trial')?{takeTrial:true}:{}),...(args.includes('--prepare')?{prepare:true}:{}),...(Object.keys(build).length?{build}:{})};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const args=process.argv.slice(2),options=cliOptions(args),result=options.hero?runJourneyPilot(options):runRequiredJourneys(options),json=JSON.stringify(result,null,2),outIndex=args.indexOf('--out'),out=outIndex>=0?args[outIndex+1]:null;
  if(out){mkdirSync(dirname(out),{recursive:true});writeFileSync(out,`${json}\n`);console.log(out);}
  else console.log(json);
}
