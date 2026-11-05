import {relicHash} from './relics.js';
const TAU=Math.PI*2;
export const GUARDIANS={
  briar:{name:'가시 숲지기',order:['spores','fan','charge']},
  rush:{name:'돌진 숲지기',order:['charge','spores','fan']},
  spore:{name:'포자 숲지기',order:['fan','charge','spores']}
};
export const PATTERN_NAMES={spores:'포자 길목',fan:'갈라지는 포자',charge:'뿌리 돌진',brace:'갑각 충격파',lob:'포자 낙하',volley:'수문장 부채 사격',crown:'왕관 포자 · 열린 틈',roots:'새벽 봉쇄'};
export const guardianStyle=seed=>Object.keys(GUARDIANS)[relicHash(seed,'guardian')%3];
function record(g,id){g.metrics.enemyPatterns??={};g.metrics.enemyPatterns[id]=(g.metrics.enemyPatterns[id]||0)+1;}
export function chargeProfile(e){return e.bossRole==='midpoint'?{speed:290,duration:e.patternPower===2?.65:.55}:e.bossRole==='final'?{speed:e.patternPower===2?360:330,duration:e.patternPower===2?.72:.65}:{speed:e.patternPower===2?360:320,duration:e.patternPower===2?.6:.48};}
export function bossShotProfile(e){const speed=e.attack==='volley'?135:e.patternPower===2?145:120,life=3.5;return {speed,life,range:speed*life+18};}
function chargeStep(e,dt){const duration=Math.min(dt,e.charge);e.charge=Math.max(0,e.charge-duration);const speed=chargeProfile(e).speed*duration/dt;if(e.charge<1e-8){e.mode='recover';e.recover=e.encounterRole?1.35:e.bossRole?1.1:.95;e.clock=e.bossRole?(e.bossPhase===2?3.6:4.6):e.bossPhase===2?3.1:4.1;}return {d:{x:e.dx,y:e.dy},speed};}
export function bossShotAngles(e){
  if(e.attack==='volley'){const n=e.patternPower===2?7:5;return Array.from({length:n},(_,i)=>e.patternAngle+(i-(n-1)/2)*.22);}
  if(e.attack==='crown'){const n=e.patternPower===2?20:16;return Array.from({length:n},(_,i)=>e.patternAngle+i*TAU/n).filter(a=>Math.abs(Math.atan2(Math.sin(a-e.patternAngle),Math.cos(a-e.patternAngle)))>.42);}
  return [];
}
export function fieldContains(f,p){
  if(Math.hypot(p.x-f.x,p.y-f.y)>f.r+10)return false;
  if(f.shape!=='cone')return true;
  const angle=Math.atan2(p.y-f.y,p.x-f.x)-f.angle;
  return Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<=f.spread;
}
export function beetleBehavior(g,e,dt,d,speed,distance,api){
  if(e.mode==='windup'){
    d={x:e.dx??d.x,y:e.dy??d.y};speed=0;e.windup-=dt;
    if(e.windup<=0){e.mode='recover';e.recover=.7;e.clock=5;}
  }else if(e.mode==='recover'){
    speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';
  }else if(e.clock<=0&&distance<175&&g.fields.filter(f=>f.pattern==='brace').length<2&&g.fields.filter(f=>['brace','lob'].includes(f.pattern)).length<3){
    e.mode='windup';e.windup=.9;e.attack='brace';e.dx=d.x;e.dy=d.y;speed=0;
    api.field({hostile:true,ownerId:e.id,pattern:'brace',shape:'cone',angle:Math.atan2(d.y,d.x),spread:.75,x:e.x,y:e.y,r:145,life:1.12,warning:.9,tick:0,damage:7});record(g,'warden:brace');
  }
  return {d,speed};
}
export function sporeBehavior(g,e,dt,d,speed,distance,api){
  if(distance<220)speed=-speed*.5;else if(distance<340)speed=0;
  if(e.mode==='windup'){
    d={x:e.dx??d.x,y:e.dy??d.y};speed=0;e.windup-=dt;
    if(e.windup<=0){
      e.mode='recover';e.recover=.4;e.clock=4.1;
      if(e.attack!=='lob')for(const a of [-.25,0,.25])api.shot(e,Math.atan2(e.dy,e.dx)+a,110);
      api.effect('muzzle',e.x,e.y,10,'#d4a2e6',.12,{angle:Math.atan2(e.dy,e.dx),hostile:true});
    }
  }else if(e.mode==='recover'){
    speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';
  }else if(e.clock<=0&&distance<450){
    e.shotPattern??=(e.id+(g.initialSeed||0))%2?'fan':'lob';
    if(e.shotPattern==='lob'&&g.fields.filter(f=>['brace','lob'].includes(f.pattern)).length>=3){e.clock=.6;return {d,speed};}
    e.mode='windup';e.dx=d.x;e.dy=d.y;e.attack=e.shotPattern;e.windup=e.attack==='lob'?1:.85;speed=0;
    if(e.attack==='lob')api.field({hostile:true,ownerId:e.id,pattern:'lob',x:g.player.x,y:g.player.y,r:32,life:1.28,warning:1,tick:0,damage:6});
    record(g,`spore:${e.attack}`);
  }
  return {d,speed};
}
export function guardianBehavior(g,e,dt,d,speed,distance,api){
  e.guardianStyle??=guardianStyle(g.initialSeed||0);e.bossPhase??=e.reinforced?2:1;
  if(!e.reinforced&&e.hp<=e.maxHp*.5){
    e.reinforced=true;e.bossPhase=2;e.clock=Math.min(e.clock,.8);
    for(let i=0;i<2;i++){const a=i*Math.PI+e.age;api.spawn('runner',e.x+Math.cos(a)*180,e.y+Math.sin(a)*180,{clock:.8});}
    api.effect('ring',e.x,e.y,100,'#e2b17a',.65);api.emit('boss-warning');record(g,'guardian:phase2');
  }
  if(e.mode==='windup'){
    d={x:e.dx??d.x,y:e.dy??d.y};speed=0;e.windup-=dt;
    if(e.windup<=0){
      if(e.attack==='charge'){e.mode='charge';e.charge=e.patternPower===2?.6:.48;return chargeStep(e,dt);}
      else{
        if(e.attack==='fan'){
          const n=e.patternPower===2?10:8;for(let i=0;i<n;i++)api.shot(e,e.patternAngle+i*TAU/n,e.patternPower===2?115:100);
        }
        e.mode='recover';e.recover=.85;e.clock=e.bossPhase===2?3.1:4.1;
      }
    }
  }else if(e.mode==='charge'){
    return chargeStep(e,dt);
  }else if(e.mode==='recover'){
    speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';
  }else if(e.clock<=0&&distance<600){
    e.cycle=(e.cycle||0)+1;e.attack=GUARDIANS[e.guardianStyle].order[(e.cycle-1)%3];e.mode='windup';e.windup=e.attack==='charge'?.9:1;e.patternPower=e.bossPhase;e.patternAngle=Math.atan2(d.y,d.x);e.dx=d.x;e.dy=d.y;speed=0;
    if(e.attack==='spores'){
      const count=e.patternPower===2?5:3;
      for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*92;api.field({hostile:true,ownerId:e.id,pattern:'spores',x:g.player.x-d.y*offset,y:g.player.y+d.x*offset,r:40,life:1.35,warning:1,tick:0,damage:11});}
    }
    api.emit('boss-warning');record(g,`guardian:${e.attack}`);
  }
  return {d,speed};
}
export function scheduledBossBehavior(g,e,dt,d,speed,distance,api){
  e.bossPhase??=1;
  if(e.bossPhase===1&&e.hp<=e.maxHp*.5){e.bossPhase=2;e.clock=Math.min(e.clock,.8);api.effect('ring',e.x,e.y,e.r+50,'#d7bd88',.7);api.emit('boss-warning');record(g,`${e.bossRole}:phase2`);}
  if(e.mode==='windup'){
    d={x:e.dx,y:e.dy};speed=0;e.windup-=dt;
    if(e.windup<=0){
      if(e.attack==='charge'){e.mode='charge';e.charge=chargeProfile(e).duration;return chargeStep(e,dt);}
      for(const a of bossShotAngles(e))api.shot(e,a,bossShotProfile(e).speed);
      e.mode='recover';e.recover=e.encounterRole?1.35:1.1;e.clock=e.bossPhase===2?3.6:4.6;
    }
  }else if(e.mode==='charge')return chargeStep(e,dt);
  else if(e.mode==='recover'){speed=0;e.recover-=dt;if(e.recover<=0)e.mode='walk';}
  else if(e.clock<=0&&distance<760){
    const order=e.encounterRole==='matriarch'?['roots','volley','roots']:e.bossRole==='midpoint'?['volley','charge']:['crown','roots','charge'];
    e.attack=order[(e.cycle||0)%order.length];e.cycle=(e.cycle||0)+1;e.mode='windup';e.windup=e.attack==='charge'?1:1.1;e.patternPower=e.bossPhase;e.patternAngle=Math.atan2(d.y,d.x);e.dx=d.x;e.dy=d.y;speed=0;
    if(e.attack==='roots'){
      const count=e.patternPower===2?5:3;
      for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*100;api.field({hostile:true,ownerId:e.id,pattern:'roots',x:g.player.x-d.y*offset,y:g.player.y+d.x*offset,r:44,life:1.45,warning:1.1,tick:0,damage:e.patternPower===2?16:14});}
    }
    api.emit('boss-warning');record(g,`${e.bossRole}:${e.attack}`);
  }
  return {d,speed};
}
