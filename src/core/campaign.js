import {isJourney,finishJourneyBoss,validJourney} from './journey.js';
import {moveActor} from '../game/terrain.js';
import {isFrontier,frontierStatus,finishFrontier,advanceFrontier,validFrontier} from './frontier.js';
export const MIDPOINT_AT=180,ARMORY_AT=300,FINAL_AT=420;
export const CAMPAIGN_BOSSES={midpoint:{name:'보급로 수문장',hp:4800,r:34,speed:38,damage:12,xp:65},final:{name:'새벽의 버섯왕 모르가',hp:45000,r:44,speed:32,damage:16,xp:120}};
const encounter=()=>({state:'waiting',id:null,spawnedAt:null,defeatedAt:null});
export const createCampaign=()=>({version:1,depth:1,cleared:0,firstClearedAt:null,challengeAt:null,boosts:{force:0,tempo:0,vigor:0,overflow:0},records:[],mid:encounter(),final:encounter(),midpointClaimed:false,armoryDropped:false,armoryClaimed:false,nextHordeAt:225,hordes:0});
export const finalArrival=g=>g.campaign.depth>1?g.campaign.challengeAt:Math.max(FINAL_AT,(g.campaign?.mid.defeatedAt??0)+90);
export function campaignStage(g){
  if(isJourney(g))return g.campaign.regionIndex===0?'opening':g.campaign.regionIndex===1?'build':'final';
  if(isFrontier(g)){const s=frontierStatus(g);return s.stage==='boss'?(g.campaign.depth===1?'midpoint':'final'):s.stage==='cleared'?'cleared':g.campaign.depth>1?'build':'opening';}
  const c=g.campaign;if(!c)return 'scout';
  if(c.final.state==='defeated')return 'cleared';
  if(c.final.state==='active')return 'final';
  if(c.mid.state==='active')return 'midpoint';
  if(c.mid.state==='defeated')return 'build';return 'opening';
}
export function campaignMessage(g,text){const ex=g.expedition;if(!ex)return;ex.toast=text;ex.toastUntil=g.time+6;ex.log.push({time:Math.round(g.time),text});ex.log=ex.log.slice(-64);}
export function updateCampaign(g,spawn){
  if(isJourney(g))return;
  if(isFrontier(g))return;
  const c=g.campaign;if(!c)return;
  const arrive=(role,state)=>{
    const data=CAMPAIGN_BOSSES[role],hp=role==='final'?data.hp*Math.pow(1.45,Math.min(14,c.depth-1)):data.hp,e=spawn('king',0,-100,{bossRole:role,hp,maxHp:hp,r:data.r,speed:data.speed,damage:Math.min(800,data.damage*(1+(c.depth-1)*.12)),xp:data.xp,bossPhase:1,cycle:(c.depth-1)%3,clock:1.4,canEvolve:false});
    state.state='active';state.id=e.id;state.spawnedAt=g.time;g.events.push({type:'boss-arrival'});g.shake=4;
    campaignMessage(g,`${data.name} 등장! 야영지의 보스 표식으로 이동해 공격 뒤 빈틈을 노리세요.`);
  };
  if(g.time>=MIDPOINT_AT&&c.mid.state==='waiting')arrive('midpoint',c.mid);
  if(g.time>=ARMORY_AT&&c.mid.state==='defeated'&&!c.armoryDropped){
    c.armoryDropped=true;g.pickups.push({id:++g.id,type:'chest',source:'armory',x:55,y:95,canEvolve:true});campaignMessage(g,'후반 정비 보급 도착! 야영지의 푸른 상자에서 두 번째 무기를 각성할 수 있습니다.');
  }
  if(g.time>=finalArrival(g)&&c.mid.state==='defeated'&&c.final.state==='waiting')arrive('final',c.final);
  if(g.time>=c.nextHordeAt&&c.mid.state==='defeated'&&c.final.state==='waiting'){
    c.nextHordeAt=g.time+32;c.hordes++;const count=Math.min(120,64+c.hordes*12),radius=Math.max(580,Math.hypot(g.view.width,g.view.height)/2+60),angle=c.hordes*2.4;
    for(let i=0;i<count;i++){const a=angle+(i/count-.5)*2.5,r=radius+(i%3)*28;spawn(i%9===0?'beetle':'shroom',g.player.x+Math.cos(a)*r,g.player.y+Math.sin(a)*r,{horde:true});}
    g.events.push({type:'horde'});campaignMessage(g,'버섯 군락 대공세! 완성한 무기로 길을 뚫으세요.');
  }
}
export function finishCampaignBoss(g,e){
  if(isJourney(g))return finishJourneyBoss(g,e);
  if(isFrontier(g))return finishFrontier(g,e);
  const role=e.bossRole,state=role==='midpoint'?g.campaign.mid:g.campaign.final;
  state.state='defeated';state.id=null;state.defeatedAt=g.time;g.kingKills++;
  if(role==='midpoint'){
    const reward={id:++g.id,type:'chest',source:'midpoint',x:e.x,y:e.y,canEvolve:true};moveActor(g,reward,0,0,32);g.pickups.push(reward);
    campaignMessage(g,'수문장 격파! 각성 상자에서 무기 하나를 8단계로 완성하고 진화시키세요.');g.events.push({type:'boss-defeated'});
  }else{const c=g.campaign;c.cleared=c.depth;c.firstClearedAt??=g.time;c.records.push({depth:c.depth,time:g.time,duration:g.time-state.spawnedAt,kills:g.kills});c.records=c.records.slice(-32);g.expedition.complete=true;g.phase='crossroads';g.events.push({type:'victory'});g.shake=6;}
}
export function advanceCampaign(g,reward){
  if(isJourney(g))return false;
  if(isFrontier(g))return advanceFrontier(g);
  const c=g.campaign;if(g.phase!=='crossroads'||!c||c.final.state!=='defeated'||!['force','tempo','vigor'].includes(reward))return false;
  c.boosts[reward]++;if(reward==='vigor')g.player.maxHp+=20;
  c.depth++;c.final=encounter();c.challengeAt=g.time+90;c.nextHordeAt=g.time+5;g.expedition.complete=false;
  g.enemies=g.enemies.filter(e=>e.nestGuardian||e.supplyGuard||e.trialWave);const owners=new Set(g.enemies.map(e=>e.id));
  g.projectiles=g.projectiles.filter(q=>q.hostile&&owners.has(q.ownerId));g.fields=g.fields.filter(f=>f.hostile&&owners.has(f.ownerId));g.delayed=[];g.effects=[];g.player.invincible=2;g.phase='playing';
  campaignMessage(g,`${c.depth}단계 공세 · 빌드를 이어갑니다. 90초 뒤 강화된 버섯왕 등장!`);return true;
}
export function bankCampaign(g){if(g.phase!=='crossroads'||!g.campaign?.cleared)return false;g.phase='result';g.outcome='victory';return true;}
export function validCampaign(c,g){
  if(c?.version===3)return validJourney(c,g);
  if(c?.version===2)return validFrontier(c,g);
  if(!c||c.version!==1||!['midpointClaimed','armoryDropped','armoryClaimed'].every(k=>typeof c[k]==='boolean')||!Number.isFinite(c.nextHordeAt)||c.nextHordeAt<225||c.nextHordeAt>1e9+32||!Number.isInteger(c.hordes)||c.hordes<0||c.hordes>1e8)return false;
  if(!Number.isInteger(c.depth)||c.depth<1||c.depth>1e6||!Number.isInteger(c.cleared)||c.cleared!==(c.final?.state==='defeated'?c.depth:c.depth-1)||!c.boosts||!['force','tempo','vigor','overflow'].every(k=>Number.isInteger(c.boosts[k])&&c.boosts[k]>=0&&c.boosts[k]<=1e6)||c.boosts.force+c.boosts.tempo+c.boosts.vigor!==c.depth-1)return false;
  if(c.cleared===0?c.firstClearedAt!==null:!Number.isFinite(c.firstClearedAt)||c.firstClearedAt<420||c.firstClearedAt>g.time)return false;
  if(c.depth===1?c.challengeAt!==null:!Number.isFinite(c.challengeAt)||c.challengeAt<420||c.challengeAt>g.time+90)return false;
  if(!Array.isArray(c.records)||c.records.length!==Math.min(32,c.cleared)||c.records.some((r,i)=>!r||r.depth!==c.cleared-c.records.length+i+1||!Number.isFinite(r.time)||r.time>g.time||!Number.isFinite(r.duration)||r.duration<0||!Number.isInteger(r.kills)||r.kills<0))return false;
  for(const [key,role] of [['mid','midpoint'],['final','final']]){
    const s=c[key];if(!s||!['waiting','active','defeated'].includes(s.state))return false;
    const live=g.enemies.filter(e=>e.bossRole===role&&!e.dead);
    if(s.state==='waiting'){if(s.id!==null||s.spawnedAt!==null||s.defeatedAt!==null||live.length)return false;}
    else if(!Number.isFinite(s.spawnedAt)||s.spawnedAt<(key==='mid'?MIDPOINT_AT:FINAL_AT)||s.spawnedAt>g.time)return false;
    if(s.state==='active'&&(live.length!==1||s.id!==live[0].id||s.defeatedAt!==null))return false;
    if(s.state==='defeated'&&(s.id!==null||live.length||!Number.isFinite(s.defeatedAt)||s.defeatedAt<s.spawnedAt||s.defeatedAt>g.time))return false;
  }
  return !(c.final.state!=='waiting'&&(c.mid.state!=='defeated'||c.final.spawnedAt<finalArrival(g)))&&!(c.midpointClaimed&&c.mid.state!=='defeated')&&!(c.armoryClaimed&&!c.armoryDropped)&&!(c.armoryDropped&&(g.time<ARMORY_AT||c.mid.state!=='defeated'));
}
