import {drawHero} from '../art/sprites.js';
import {drawProp,drawIllustratedEnemy} from '../art/illustrated.js';
import {animationState,weaponPose} from './motion.js';
import {HEROES} from '../core/content.js';
import {orbitState} from '../core/game.js';
import {TREE_PROPS,TRAILS} from './terrain.js';
import {expeditionMarkers} from './expedition.js';
const TAU=Math.PI*2,INK='#392c25';
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function drawWeapon(c,g){
  const p=g.player,id=p.attackWeapon||g.startWeapon||Object.keys(g.weapons)[0],m=weaponPose(p);
  c.save();c.translate(m.handX,m.handY);c.rotate(m.angle);if(Math.cos(m.angle)<0)c.scale(1,-1);c.translate(-m.recoil,0);
  if(id==='acorn'||id==='returning'){
    rect(c,-10,-6,27,12,INK);rect(c,-7,-4,23,8,'#947047');rect(c,-6,-3,21,2,'#c9a369');rect(c,-7,2,21,2,'#67482e');
    for(const x of [-4,6]){rect(c,x,-5,3,10,'#d0ab64');rect(c,x,-3,1,6,'#f0cd85');}
    rect(c,13,-7,6,14,INK);rect(c,14,-5,4,10,'#c5a165');rect(c,16,-3,3,6,'#4a3426');rect(c,15,-5,2,2,'#efd28b');
    poly(c,[[-10,1],[-3,3],[-5,11],[-9,11]],'#69432c');rect(c,-10,-4,3,8,'#ad804a');
  }else if(id==='moon'){
    poly(c,[[3,-19],[14,-16],[23,-5],[23,8],[15,18],[4,21],[12,12],[15,2],[11,-11]],INK);
    poly(c,[[6,-16],[14,-12],[20,-4],[20,7],[13,15],[15,6],[15,-2],[11,-12]],'#bbd8d6');
    poly(c,[[7,-15],[13,-11],[17,-4],[17,6],[15,9],[16,0],[12,-10]],'#f2e5ba');rect(c,-9,-3,16,6,'#937047');rect(c,-6,-3,2,6,'#dabd7c');
  }else if(id==='lantern'){
    rect(c,-3,-9,14,21,INK);rect(c,-1,-6,10,15,'#68b39c');rect(c,1,-4,3,11,'#c7e1b2');rect(c,7,-3,1,9,'#3b857c');rect(c,-1,-11,10,4,'#bb945b');rect(c,2,0,4,5,'#e8d785');
  }else if(id==='vine'){
    c.strokeStyle=INK;c.lineWidth=6;c.beginPath();c.moveTo(-9,3);c.quadraticCurveTo(10,3,21,-10);c.stroke();c.strokeStyle='#8da565';c.lineWidth=3;c.stroke();poly(c,[[5,-1],[5,-11],[15,-8]],'#b1bb77');
  }else{
    rect(c,-10,-3,29,6,INK);rect(c,-9,-1,28,3,'#99734a');const color=id==='storm'?'#afc6e4':id==='bees'||id==='hive'?'#e2bb65':id==='briar'?'#a5bb70':'#e9dca9';
    for(let i=0;i<5;i++){const a=i*TAU/5;ellipse(c,16+Math.cos(a)*6,Math.sin(a)*6,4,4,color);}ellipse(c,16,0,3,3,'#c38e50');rect(c,-4,-3,2,6,'#d0af70');
  }
  // The gripping hand is at the same point as the shared model's weapon pose.
  ellipse(c,-6,4,4,3,'#b78c61');rect(c,-7,2,3,2,'#e4be88');c.restore();
}
function drawShot(c,q){
  const height=q.kind==='bottle'?24+Math.sin(Math.min(1,q.age/(q.flight||.32))*Math.PI)*30:24;
  const x=q.x,y=q.y-height,a=Math.atan2(q.vy,q.vx);
  c.save();c.translate(x,y);c.rotate(q.kind==='moon'?q.age*15:a);
  if(q.kind==='wind'){
    c.strokeStyle='#d5e5bc';c.lineWidth=2;c.globalAlpha=.7;
    for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(-42,i*8);c.quadraticCurveTo(-10,i*13,12,i*5);c.stroke();}
    c.globalAlpha=.4;poly(c,[[-20,-7],[17,0],[-20,7],[-6,0]],'#c7d9a9');
  }else if(q.kind==='moon'){
    c.globalAlpha=.2;poly(c,[[-20,-11],[-9,-15],[4,-12],[12,0],[2,13],[-12,15],[-20,10],[-10,8],[-3,0],[-10,-8]],'#b3e0e0');c.globalAlpha=1;
    poly(c,[[-8,-12],[3,-12],[12,-4],[13,6],[5,13],[-4,12],[2,6],[4,0],[-1,-7]],INK);poly(c,[[-6,-10],[2,-10],[9,-3],[10,5],[4,10],[5,3],[2,-4]],'#c0dedc');
  }else if(q.kind==='bee'){
    ellipse(c,0,-5,4,3,'#dfecd3');ellipse(c,0,5,4,3,'#dfecd3');ellipse(c,0,0,7,4,INK);rect(c,-5,-2,10,5,'#e1b967');rect(c,-1,-2,3,5,'#5b472a');rect(c,4,-1,2,2,'#fff0b7');
  }else if(q.kind==='enemy'){
    ellipse(c,-4,0,11,6,'#c99dc72b');ellipse(c,0,0,7,7,'#4f354e');ellipse(c,0,0,5,5,'#cfa8c8');rect(c,-1,-3,3,3,'#ffe0dd');
  }else if(q.kind==='bottle'){
    rect(c,-5,-7,11,15,INK);rect(c,-3,-5,7,11,'#81c8a6');rect(c,-1,-3,2,8,'#e9edba');rect(c,-3,-9,7,3,'#b2935d');
  }else{
    c.globalAlpha=.35;poly(c,[[-26,-1],[-5,-3],[4,0],[-5,3]],q.evolved?'#f5db94':'#ddb777');c.globalAlpha=1;
    poly(c,[[-6,-4],[3,-5],[9,-1],[9,2],[3,5],[-6,4]],INK);poly(c,[[-4,-2],[3,-3],[7,0],[3,3],[-4,2]],q.evolved?'#edcf84':'#cd9d5a');rect(c,-6,-4,3,8,'#795035');rect(c,-3,-3,6,1,'#e4bf77');
  }
  c.restore();
}
function drawEffect(c,art,fx){
  const t=fx.life/fx.maxLife,age=1-t;c.save();c.globalAlpha=Math.min(1,t*2);c.strokeStyle=fx.color;c.lineWidth=2;
  if(fx.type==='relic'){
    c.globalAlpha=t*.65;c.lineWidth=2;c.beginPath();c.ellipse(fx.x,fx.y,fx.r*(.4+age*.6),fx.r*(fx.relicId==='shell'?1:.7)*(.4+age*.6),0,0,TAU);c.stroke();
    for(let i=0;i<6;i++){const a=i*TAU/6;poly(c,[[fx.x+Math.cos(a)*fx.r*age,fx.y+Math.sin(a)*fx.r*.7*age-4],[fx.x+Math.cos(a)*fx.r*age+3,fx.y+Math.sin(a)*fx.r*.7*age],[fx.x+Math.cos(a)*fx.r*age,fx.y+Math.sin(a)*fx.r*.7*age+4],[fx.x+Math.cos(a)*fx.r*age-3,fx.y+Math.sin(a)*fx.r*.7*age]],fx.color);}
  }else if(fx.type==='impact'){
    c.translate(fx.x,fx.y);c.rotate(fx.angle);c.lineWidth=fx.crit?3:2;
    for(let i=0;i<5;i++){const a=(i-2)*.55,r=6+age*18;c.beginPath();c.moveTo(Math.cos(a)*r*.35,Math.sin(a)*r*.35);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}
    if(t>.65)poly(c,[[-4,-1],[0,-7],[3,-2],[9,0],[3,3],[0,7],[-2,2]],'#fff1c3');
  }else if(fx.type==='muzzle'){
    c.translate(fx.x,fx.y-24);c.rotate(fx.angle||0);if(fx.hostile){ellipse(c,3,0,10*age+3,6*age+2,'#d6b0d1a0');}else{poly(c,[[-2,-3],[6,-2],[11,-7],[9,-1],[17,1],[8,3],[7,7],[2,3]],'#e9c47c');poly(c,[[0,-1],[9,0],[3,3]],'#fff0bd');}
  }else if(fx.type==='death'){
    c.globalAlpha=t*.8;c.translate(fx.x+Math.cos(fx.angle||0)*age*13,fx.y);c.rotate((fx.angle>0?1:-1)*age*.32);c.scale(1+age*.08,1-age*.28);
    drawIllustratedEnemy(c,art,{type:fx.enemyType||'shroom',x:0,y:0,walk:0,age:0,mode:'dead',dead:true,fx:Math.cos(fx.angle||0),hurt:0});
    c.globalAlpha=t;
    for(let i=0;i<6;i++){const a=i*2.4,r=age*(15+fx.r*.4);rect(c,Math.cos(a)*r,-17+Math.sin(a)*r*.6-Math.sin(age*Math.PI)*9,2+i%2,2,i%2?'#e1c28d':fx.color);}
  }else if(fx.type==='bolt'){
    c.lineWidth=4;c.strokeStyle='#677a9870';c.beginPath();c.moveTo(fx.fromX,fx.fromY-24);c.lineTo(fx.x+9,fx.y-48);c.lineTo(fx.x-7,fx.y-35);c.lineTo(fx.x,fx.y-24);c.stroke();c.strokeStyle='#e0e5c7';c.lineWidth=2;c.stroke();
  }else if(fx.type==='slash'){
    c.lineWidth=7;c.strokeStyle='#a4bc7150';c.beginPath();c.ellipse(fx.x,fx.y-22,fx.r*(.8+age*.2),fx.r*.65*(.8+age*.2),0,fx.angle-fx.spread,fx.angle+fx.spread);c.stroke();c.lineWidth=2;c.strokeStyle='#d8dda4';c.stroke();
  }else if(fx.type==='ring'){
    c.globalAlpha=t*.5;c.beginPath();c.ellipse(fx.x,fx.y,fx.r*(.65+age*.35),fx.r*.65*(.65+age*.35),0,0,TAU);c.stroke();
  }else{for(let i=0;i<6;i++){const a=i*2.4;rect(c,fx.x+Math.cos(a)*age*20,fx.y-15+Math.sin(a)*age*15,2,3,fx.color);}}
  c.restore();
}
export function createRenderer(canvas,mapCanvas,art){
  const c=canvas.getContext('2d'),atlas=art.atlas;let width=0,height=0,zoom=1,cx=0,cy=0,lastRun=null;
  const grass=c.createPattern(art.textures.grass,'repeat'),dirt=c.createPattern(art.textures.dirt,'repeat');
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);zoom=width<600?.8:1;return ratio;}
  let dpr=resize();const observer=new ResizeObserver(()=>{dpr=resize();});observer.observe(canvas);
  function visible(x,y,r=180){return Math.abs(x-cx)<width/zoom/2+r&&Math.abs(y-cy)<height/zoom/2+r;}
  function render(g,delta=.016){
    const p=g.player;g.view={width:width/zoom,height:height/zoom};
    if(g.runId!==lastRun){cx=p.x;cy=p.y;lastRun=g.runId;}cx+=(p.x-cx)*Math.min(1,delta*12);cy+=(p.y-cy)*Math.min(1,delta*12);
    c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=true;c.clearRect(0,0,width,height);
    if(g.phase==='camp'){
      const scale=Math.max(width/art.camp.width,height/art.camp.height),w=art.camp.width*scale,h=art.camp.height*scale;
      c.drawImage(art.camp,(width-w)/2,(height-h)/2,w,h);
      const x=width<600?width*.77:width*.66,y=height*.74;ellipse(c,x,y+3,28,8,'#312a2466');drawHero(c,atlas,HEROES[g.hero].row,'east',8,x,y,width<600?180:248);return;
    }
    const shake=Math.min(2.8,g.shake),sx=Math.sin(g.time*83)*shake,sy=Math.sin(g.time*109+1)*shake*.65;
    c.save();c.translate(width/2+sx,height/2+30+sy);c.scale(zoom,zoom);c.translate(-cx,-cy);
    const left=cx-width/zoom/2-220,top=cy-height/zoom/2-220;
    c.fillStyle=grass;c.fillRect(left,top,width/zoom+440,height/zoom+440);
    for(const points of TRAILS){c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=dirt;c.globalAlpha=.25;c.lineWidth=138;c.stroke();c.globalAlpha=.55;c.lineWidth=122;c.stroke();c.globalAlpha=1;c.lineWidth=106;c.stroke();}
    c.fillStyle='#364a3733';c.fillRect(left,top,width/zoom+440,height/zoom+440);
    const trial=g.expedition.sites.find(s=>s.id==='trial');
    if(trial&&['ready','active'].includes(trial.state)&&visible(trial.x,trial.y,260)){
      const active=trial.state==='active',radius=active?240:64;
      ellipse(c,trial.x,trial.y,radius,radius,active?'#b2ce8c0d':'#b2ce8c15');c.strokeStyle=active?(g.expedition.trial.outside>0?'#e1ad7a':'#b8c995'):'#9caf7b66';c.lineWidth=2;c.setLineDash([8,12]);c.beginPath();c.arc(trial.x,trial.y,radius,0,TAU);c.stroke();c.setLineDash([]);
      if(active){c.strokeStyle='#e3d79d';c.lineWidth=3;c.beginPath();c.arc(trial.x,trial.y,240,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,(g.time-g.expedition.trial.startedAt)/20));c.stroke();}
    }
    for(let i=0;i<60;i++){const x=((i*317+33)%2500)-1250,y=((i*677+55)%2500)-1250;if(visible(x,y)&&Math.hypot(x,y)>220)drawProp(c,art,2,i%3,x,y,i%3===1?27:50,.8);}
    for(const f of g.fields){
      if(f.hostile){
        const warning=f.warning>0,pulse=.55+Math.sin(g.time*18)*.12;
        ellipse(c,f.x,f.y,f.r,f.r,warning?'#b47c5930':'#dc946f80');c.strokeStyle=warning?'#f0c68e':'#efab83';c.lineWidth=warning?2:3;
        c.beginPath();c.arc(f.x,f.y,f.r,0,TAU);c.stroke();
        if(warning){c.globalAlpha=pulse;c.beginPath();c.arc(f.x,f.y,f.r*Math.max(.08,1-f.warning/.9),0,TAU);c.stroke();c.globalAlpha=1;rect(c,f.x-1,f.y-7,2,9,'#f1cf9b');rect(c,f.x-1,f.y+5,2,2,'#f1cf9b');}
        else for(let i=0;i<8;i++){const a=i*2.4;ellipse(c,f.x+Math.cos(a)*f.r*.65,f.y-10-Math.sin(g.time*13+i)*12+Math.sin(a)*f.r*.5,2,3,'#e8c292');}
      }else{ellipse(c,f.x,f.y,f.r,f.r*.65,'#80c5ae36');for(let i=0;i<7;i++){const a=g.time*.7+i*2.4;rect(c,f.x+Math.cos(a)*f.r*.7,f.y+Math.sin(a)*f.r*.4,2,2,'#dbedb2');}}
    }
    for(const gem of [...g.gems.values(),...g.flying]){
      if(!visible(gem.x,gem.y,20))continue;const x=gem.x,y=gem.y-5-Math.sin(Math.min(1,(gem.age??1)/.25)*Math.PI)*10;ellipse(c,x,gem.y+2,4,2,'#3d57384d');poly(c,[[x,y-7],[x+6,y],[x,y+6],[x-5,y]],'#315e57');poly(c,[[x,y-6],[x+4,y],[x,y+4],[x-3,y]],gem.value>8?'#e9cc8e':'#a4e5c9');rect(c,x-1,y-5,2,3,'#ecf7d6');
    }
    const actors=[];
    for(const a of g.terrain)if(a.kind!=='tree'&&visible(a.x,a.y))actors.push({y:a.y,draw:()=>drawProp(c,art,0,a.id%3===0?4:3,a.x,a.y,a.r*2.25)});
    for(const a of TREE_PROPS)if(visible(a.x,a.y))actors.push({y:a.y,draw:()=>{const obscures=Math.abs(a.x-p.x)<100*a.size&&p.y>a.y-220*a.size&&p.y<a.y+20;drawProp(c,art,0,a.variant,a.x,a.y,205*a.size,obscures?.17:1);}});
    for(const s of g.expedition.sites)actors.push({y:s.y,draw:()=>{
      const occludes=Math.abs(s.x-p.x)<90&&p.y>s.y-145&&p.y<s.y+10;
      if(s.id==='camp'){const tentX=s.x-165,behindTent=Math.abs(tentX-p.x)<105&&p.y>s.y-195&&p.y<s.y+10;drawProp(c,art,1,0,tentX,s.y,185,behindTent?.24:1);drawProp(c,art,1,1,s.x+76,s.y+13,70);}
      else if(s.id==='supply')drawProp(c,art,1,2,s.x,s.y,152,occludes?.28:s.state==='spent'?.65:1);
      else if(s.id==='nest'){drawProp(c,art,1,3,s.x,s.y,166,occludes?.3:s.state==='active'?.55:['spent','cleared'].includes(s.state)?.58:1);if(s.state==='active')ellipse(c,s.x,s.y-25,12,5,'#e9ab6c55');}
      else if(s.id==='trial'){
        drawProp(c,art,0,4,s.x,s.y,64,['spent','abandoned'].includes(s.state)?.45:1);
        if(['ready','active'].includes(s.state)){c.strokeStyle='#d7d8a2';c.lineWidth=2;c.beginPath();c.moveTo(s.x-12,s.y-27);c.quadraticCurveTo(s.x+22,s.y-38,s.x+7,s.y-48);c.quadraticCurveTo(s.x-4,s.y-53,s.x-7,s.y-43);c.stroke();}
      }
      else{drawProp(c,art,1,4,s.x,s.y,156,s.state==='spent'?.7:1);if(s.state!=='spent')for(let i=0;i<5;i++){const a=g.time*.7+i*2.4;ellipse(c,s.x+Math.cos(a)*43,s.y-24+Math.sin(a)*17,1.5,1.5,'#ecedac');}}
      if(!['spent','cleared','abandoned'].includes(s.state)&&(s.id!=='camp'||g.time>=150)&&(s.id!=='trial'||s.state==='ready'||Math.hypot(s.x-p.x,s.y-p.y)>110)){c.font='11px Galmuri,monospace';c.textAlign='center';c.fillStyle='#eee0b4';c.shadowColor='#30432b';c.shadowBlur=4;c.fillText(s.short,s.x,s.y-(s.id==='camp'?165:s.id==='supply'?123:s.id==='trial'?75:116));c.shadowBlur=0;}
    }});
    for(const item of g.pickups)actors.push({y:item.y,draw:()=>{if(['chest','relic'].includes(item.type)){drawProp(c,art,2,3,item.x,item.y,item.type==='relic'?35:41);if(item.type==='relic'){rect(c,item.x-2,item.y-22,4,17,'#b7ce99');poly(c,[[item.x,item.y-31],[item.x+4,item.y-26],[item.x,item.y-21],[item.x-4,item.y-26]],'#e6e0af');}else if(item.canEvolve){ellipse(c,item.x,item.y-20,22,12,'#e9d69322');}}else if(item.type==='heal'){ellipse(c,item.x,item.y-7,6,5,item.relicId?'#9cbb75':'#c27c68');rect(c,item.x-1,item.y-15,2,5,'#bcc68c');}else ellipse(c,item.x,item.y-5,4,5,'#e1c483');}});
    for(const e of g.enemies)if(visible(e.x,e.y,100))actors.push({y:e.y,draw:()=>{
      ellipse(c,e.x,e.y+1,e.r*1.05,e.r*.33,'#293b2e50');drawIllustratedEnemy(c,art,e);
      if(e.nestGuardian&&e.mode==='windup'){c.strokeStyle='#ebc296';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y-65,26,-Math.PI/2,-Math.PI/2+TAU*(1-e.windup/.9));c.stroke();}
      if(e.supplyGuard)poly(c,[[e.x,e.y-74],[e.x+4,e.y-70],[e.x,e.y-66],[e.x-4,e.y-70]],'#e9ca84');
      if(!e.nestGuardian&&e.hurt>0&&e.hp<e.maxHp){const w=24,y=e.y-(e.type==='elite'?105:67);rect(c,e.x-w/2,y,w,4,'#344333');rect(c,e.x-w/2+1,y+1,(w-2)*e.hp/e.maxHp,2,'#d89b79');}
    }});
    actors.push({y:p.y,draw:()=>{
      ellipse(c,p.x,p.y+1,19,6,'#293b2e75');
      const {dir,legDir,frame,legFrame,aim}=animationState(p);
      if(Math.sin(aim)<-.5)drawWeapon(c,g);
      const recoil=p.attack>.15?1.8:0;
      drawHero(c,atlas,HEROES[g.hero].row,dir,frame,p.x,p.y,160,legFrame,{x:-Math.cos(aim)*recoil,y:-Math.sin(aim)*recoil*.5},legDir);
      if(Math.sin(aim)>=-.5)drawWeapon(c,g);
    }});
    for(const q of g.projectiles)if(visible(q.x,q.y,80))actors.push({y:q.y,draw:()=>drawShot(c,q)});
    for(const id of ['briar','hive']){const o=orbitState(g,id);if(o?.active)for(let i=0;i<o.count;i++){const a=g.time*o.speed+i*TAU/o.count,x=p.x+Math.cos(a)*o.radius,y=p.y+Math.sin(a)*o.radius*.8;actors.push({y,draw:()=>{c.save();c.translate(x,y-22);c.rotate(a);poly(c,[[-8,-2],[-3,-6],[0,-11],[4,-5],[9,-2],[4,3],[0,8],[-4,3]],INK);poly(c,[[-6,-1],[0,-7],[6,-1],[0,5]],'#a8bd77');rect(c,-1,-5,1,6,'#e0dba3');c.restore();}});}}
    actors.sort((a,b)=>a.y-b.y);for(const actor of actors)actor.draw();
    if(g.relics.shell.shield>0){c.strokeStyle='#e3cf98a0';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y-29,31,42,0,0,TAU);c.stroke();}
    if(g.relics.thread.target){const e=g.enemies.find(e=>e.id===g.relics.thread.target&&!e.dead);if(e){c.strokeStyle='#dfb58c90';c.lineWidth=1.5;c.setLineDash([3,5]);c.beginPath();c.moveTo(p.x,p.y-26);c.quadraticCurveTo((p.x+e.x)/2,(p.y+e.y)/2-50,e.x,e.y-27);c.stroke();c.setLineDash([]);}}
    for(const e of g.enemies)if(e.nestGuardian&&visible(e.x,e.y,100)){
      const w=90,y=e.y-108;rect(c,e.x-w/2-1,y-1,w+2,8,'#ead19b');rect(c,e.x-w/2,y,w,6,'#343f2c');rect(c,e.x-w/2+1,y+1,(w-2)*e.hp/e.maxHp,4,'#d78f69');
      c.font='10px Galmuri,monospace';c.textAlign='center';c.fillStyle='#f4dfaf';c.shadowColor='#29362b';c.shadowBlur=4;c.fillText('둥지 지휘관',e.x,y-7);c.shadowBlur=0;
    }
    for(const fx of g.effects)drawEffect(c,art,fx);
    c.font='12px Galmuri,monospace';c.textAlign='center';for(const t of g.texts){c.globalAlpha=Math.min(1,t.life*4);c.fillStyle='#352e27';c.fillText(t.value,t.x+1,t.y+1);c.fillStyle=t.color;c.fillText(t.value,t.x,t.y);}c.globalAlpha=1;
    c.restore();
    const markers=expeditionMarkers(g);
    const priority=s=>s.id==='camp'&&g.time>=150?0:s.type==='relic'||s.type==='chest'?1:s.id==='spring'&&p.hp<p.maxHp*.6?2:s.id==='supply'?3:s.id==='trial'?4:5;
    let markerCount=0;const markerPositions=[];
    for(const s of [...markers].sort((a,b)=>priority(a)-priority(b)||Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))){
      if(s.state==='spent'||s.id==='camp'&&g.time<150)continue;const sx=(s.x-cx)*zoom+width/2,sy=(s.y-cy)*zoom+height/2+30;if(sx>75&&sx<width-75&&sy>100&&sy<height-110)continue;
      if(markerCount>=3)break;
      const x=Math.max(64,Math.min(width-64,sx));let y=Math.max(190,Math.min(height-150,sy));
      for(let i=0;i<4&&markerPositions.some(pos=>Math.abs(pos.x-x)<105&&Math.abs(pos.y-y)<34);i++)y=y+36<height-130?y+36:y-72;
      if(markerPositions.some(pos=>Math.abs(pos.x-x)<105&&Math.abs(pos.y-y)<34))continue;
      markerCount++;markerPositions.push({x,y});const a=Math.atan2(sy-y,sx-x);c.fillStyle='#2d412de8';c.fillRect(x-50,y-13,100,27);c.fillStyle=s.color;c.font='10px Galmuri,monospace';c.textAlign='center';c.fillText(`${s.short} ${Math.round(Math.hypot(s.x-p.x,s.y-p.y)/10)}m`,x,y+4);poly(c,[[x+Math.cos(a)*56,y+Math.sin(a)*20],[x+Math.cos(a+.25)*48,y+Math.sin(a+.25)*17],[x+Math.cos(a-.25)*48,y+Math.sin(a-.25)*17]],s.color);
    }
    if(mapCanvas){const m=mapCanvas.getContext('2d'),w=mapCanvas.width,h=mapCanvas.height,scale=w/2900;m.fillStyle='#344a35';m.fillRect(0,0,w,h);m.strokeStyle='#778366';m.lineWidth=1;m.strokeRect(7,7,w-14,h-14);for(const a of g.terrain){m.fillStyle=a.kind==='tree'?'#526b49':'#8b9477';m.fillRect(w/2+a.x*scale-1,h/2+a.y*scale-1,3,2);}for(const s of markers){m.fillStyle=s.state==='spent'?'#718467':s.color;m.fillRect(w/2+s.x*scale-2,h/2+s.y*scale-2,5,5);}ellipse(m,w/2+p.x*scale,h/2+p.y*scale,3,3,'#fff0bf');}
  }
  return {render,atlas,dispose:()=>observer.disconnect()};
}
