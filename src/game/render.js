import {createSprites,drawHero,drawEnemy} from '../art/sprites.js';
import {facing,walkPose,weaponPose} from './motion.js';
import {HEROES,WEAPONS,formatTime} from '../core/content.js';
import {orbitState} from '../core/game.js';
const TAU=Math.PI*2,INK='#302c2a';
const poly=(c,points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
const ellipse=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
function makeGround(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#4a6048';c.fillRect(0,0,256,256);let seed=193;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<360;i++){const x=Math.floor(rnd()*128)*2,y=Math.floor(rnd()*128)*2;rect(c,x,y,i%7===0?4:2,2,['#52664b','#455c46','#56694d','#405844'][i%4]);if(i%9===0){rect(c,x,y-4,2,4,'#5c704f');rect(c,x+3,y-2,2,2,'#5c704f');}}
  return canvas;
}
function tree(c,x,y,size=1,variant=0){
  c.save();c.translate(x,y);c.scale(size,size);ellipse(c,8,4,39,13,'#263e3655');
  poly(c,[[-8,4],[-7,-50],[8,-54],[10,-4],[17,3],[4,1],[-4,6]],'#363c2d');poly(c,[[-4,-1],[-4,-53],[4,-54],[6,-3]],'#786849');rect(c,0,-36,3,26,'#9a8054');
  const colors=variant%3===0?['#354b37','#405941','#506a48','#617950']:['#304c3d','#3b5943','#4b6748','#5d7650'];
  for(const [cx,cy,r] of [[-22,-57,25],[24,-59,27],[0,-86,31],[-27,-83,23],[28,-87,25],[1,-113,26]]){
    const shape=[[cx-r,cy],[cx-r+4,cy-r*.5],[cx-r*.45,cy-r],[cx+r*.35,cy-r],[cx+r-3,cy-r*.4],[cx+r,cy+3],[cx+r*.55,cy+r*.6],[cx-r*.5,cy+r*.6]];
    poly(c,shape,colors[0]);poly(c,shape.map(([xx,yy])=>[xx*.94,yy-4]),colors[1]);
    poly(c,[[cx-r+8,cy-7],[cx-r*.5,cy-r+6],[cx+7,cy-r+6],[cx+r-10,cy-9],[cx+6,cy-3],[cx-6,cy-8]],colors[2]);
    rect(c,cx-9,cy-r+8,12,3,colors[3]);rect(c,cx+10,cy-11,7,3,colors[3]);
  }
  c.restore();
}
function rock(c,a){
  const {x,y,r}=a;ellipse(c,x+6,y+2,r*.9,r*.38,'#283f3555');
  poly(c,[[x-r,y-8],[x-r*.8,y-r*.65],[x-r*.25,y-r*.95],[x+r*.55,y-r*.8],[x+r*.95,y-r*.25],[x+r*.8,y+3],[x,y+r*.18]],'#394b42');
  poly(c,[[x-r*.8,y-r*.57],[x-r*.22,y-r*.85],[x+r*.5,y-r*.7],[x+r*.68,y-r*.3],[x-r*.12,y-r*.18]],'#728075');
  poly(c,[[x-r*.12,y-r*.18],[x+r*.68,y-r*.3],[x+r*.8,y],[x,y+r*.1]],'#56695e');
  poly(c,[[x-r*.7,y-r*.4],[x-r*.3,y-r*.65],[x+r*.15,y-r*.6],[x-r*.16,y-r*.38]],'#8b9480');
  rect(c,x-r*.65,y-r*.2,12,3,'#6e8953');rect(c,x-r*.48,y-r*.28,14,3,'#82935c');
}
function siteArt(c,s,t){
  const {x,y}=s,used=s.state==='spent';ellipse(c,x,y+8,48,14,'#263c3155');
  if(s.id==='supply'){
    rect(c,x-34,y-25,60,28,'#342f28');rect(c,x-31,y-23,54,22,'#8d7046');rect(c,x-31,y-24,54,4,'#b1905a');rect(c,x-19,y-24,4,24,'#594a32');rect(c,x+7,y-24,4,24,'#594a32');
    ellipse(c,x-22,y+2,9,9,'#30332b');ellipse(c,x+20,y+2,9,9,'#30332b');ellipse(c,x-22,y+2,5,5,'#9b8252');ellipse(c,x+20,y+2,5,5,'#9b8252');
    if(!used){poly(c,[[x-24,y-29],[x-20,y-43],[x-2,y-46],[x+10,y-32],[x+7,y-23]],'#b5a779');rect(c,x-17,y-44,5,17,'#d6c68a');rect(c,x+7,y-33,17,10,'#6b875c');rect(c,x+12,y-34,4,13,'#c1b17b');}
    rect(c,x+35,y-53,4,54,'#8b7750');poly(c,[[x+39,y-51],[x+61,y-47],[x+58,y-29],[x+39,y-34]],used?'#7c8060':'#d7b76c');
  }else if(s.id==='nest'){
    for(let i=0;i<7;i++){const a=i*2.4,xx=x+Math.cos(a)*32,yy=y+Math.sin(a)*13;rect(c,xx-4,yy-17,8,19,'#a6946c');poly(c,[[xx-15,yy-14],[xx-12,yy-26],[xx,yy-34],[xx+14,yy-25],[xx+17,yy-14]],used?'#706a4b':'#975a4c');rect(c,xx-5,yy-27,5,3,'#cfb18a');}
    if(!used){ellipse(c,x,y-10,13,5,'#342c2b');for(let i=0;i<4;i++){const a=t*.5+i*1.7;rect(c,x+Math.cos(a)*36,y-25+Math.sin(a*1.4)*15,2,3,'#d5a16e');}}
  }else if(s.id==='spring'){
    ellipse(c,x,y,49,25,'#3b5048');ellipse(c,x,y-2,41,20,used?'#5e8070':'#659f93');ellipse(c,x-5,y-5,31,12,'#81b9a3');
    for(let i=0;i<8;i++){const a=i*TAU/8;rock(c,{x:x+Math.cos(a)*46,y:y+Math.sin(a)*24,r:10});}
    rect(c,x-15,y-7,20,2,'#b6d7ae');rect(c,x+10,y+1,14,2,'#99c9b1');if(!used)for(let i=0;i<5;i++){const a=t+i*2.4;rect(c,x+Math.cos(a)*32,y-20+Math.sin(a*1.2)*14,2,2,'#f0e7a4');}
  }else{
    poly(c,[[x-54,y-17],[x-27,y-68],[x+12,y-60],[x+40,y-16]],'#363e30');poly(c,[[x-49,y-19],[x-26,y-62],[x+8,y-57],[x+32,y-19]],'#a19863');poly(c,[[x-27,y-59],[x-9,y-23],[x-42,y-23]],'#c0af7d');poly(c,[[x-7,y-21],[x+3,y-48],[x+24,y-21]],'#4e5940');
    for(let i=0;i<5;i++){const a=i*2.1;rect(c,x+45+Math.cos(a)*12,y+5+Math.sin(a)*4,9,5,'#68513b');}
    const flick=Math.sin(t*9)*2;poly(c,[[x+41,y+5],[x+38,y-9],[x+45,y-22-flick],[x+48,y-9],[x+52,y-16],[x+54,y],[x+49,y+6]],'#cf9253');poly(c,[[x+43,y+3],[x+44,y-12],[x+48,y-6],[x+50,y+3]],'#efc978');
  }
  if(!used&&(s.id!=='camp'||t>=180)){const offset=s.id==='camp'?108:64;c.font='11px Galmuri, monospace';c.textAlign='center';c.fillStyle='#24362b';c.fillRect(x-49,y-offset-14,98,20);c.fillStyle=s.color;c.fillText(s.short,x,y-offset);}
}
function weapon(c,g){
  const p=g.player,id=p.attackWeapon||Object.keys(g.weapons)[0],m=weaponPose(p);if(!m)return;
  c.save();c.translate(m.handX,m.handY);c.rotate(m.angle);c.translate(-m.recoil,0);
  if(id==='acorn'||id==='returning'){
    rect(c,-8,-5,24,10,INK);rect(c,-6,-3,22,6,'#ad8749');rect(c,-1,-3,3,6,'#d2b16b');rect(c,12,-6,6,12,INK);rect(c,13,-4,4,8,'#c2a267');rect(c,15,-2,3,4,'#483e2b');rect(c,-7,2,7,6,'#725139');
    if(p.attack>.13){poly(c,[[20,-3],[25,-2],[29,-6],[27,0],[31,3],[24,2],[21,4]],'#f2dc97');}
  }else if(id==='moon'){
    poly(c,[[4,-15],[14,-11],[19,-3],[18,5],[12,13],[4,15],[10,8],[12,0],[9,-9]],INK);poly(c,[[6,-12],[13,-9],[16,-2],[15,5],[10,11],[12,3],[11,-4]],'#bdd8cf');rect(c,-6,-2,13,4,'#a68b5f');
  }else if(id==='lantern'){
    rect(c,-2,-7,10,15,INK);rect(c,-1,-5,8,11,'#69b89e');rect(c,1,-3,3,8,'#d7e4a2');rect(c,-1,-9,7,3,'#b89962');
  }else if(id==='vine'){
    c.strokeStyle='#739553';c.lineWidth=4;c.beginPath();c.moveTo(-7,2);c.lineTo(10,-2);c.lineTo(17,-9);c.stroke();poly(c,[[7,-2],[7,-9],[15,-7]],'#a1b76b');
  }else{
    rect(c,-8,-2,25,4,'#91714a');const color=id==='storm'?'#b1ccd3':id==='bees'?'#ddbb69':id==='briar'?'#a1b978':'#eee2b6';
    for(let i=0;i<5;i++){const a=i*TAU/5;rect(c,14+Math.cos(a)*5,-2+Math.sin(a)*5,5,5,color);}rect(c,15,-1,4,4,'#c69850');
  }
  c.restore();
}
export function createRenderer(canvas,mapCanvas){
  const c=canvas.getContext('2d'),atlas=createSprites(),ground=makeGround();let width=0,height=0,zoom=1,cx=0,cy=0;
  const trees=[];for(let i=0;i<95;i++){const x=((i*719+111)%2600)-1300,y=((i*983+91)%2600)-1300;if(Math.abs(x)<220&&Math.abs(y)<200)continue;if(Math.hypot(x+520,y+130)<110||Math.hypot(x-520,y+360)<110||Math.hypot(x-100,y-510)<110)continue;trees.push({x,y,size:.85+(i%5)*.08,id:i});}
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);zoom=width<600?.85:1.12;return dpr;}
  let dpr=resize();const observer=new ResizeObserver(()=>{dpr=resize();});observer.observe(canvas);
  function render(g,delta=.016){
    const p=g.player;g.view={width:width/zoom,height:height/zoom};cx+=(p.x-cx)*Math.min(1,delta*9);cy+=(p.y-cy)*Math.min(1,delta*9);
    c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=false;c.clearRect(0,0,width,height);
    c.save();c.translate(Math.round(width/2),Math.round(height/2+25));c.scale(zoom,zoom);c.translate(-Math.round(cx),-Math.round(cy));
    const left=cx-width/zoom/2-200,top=cy-height/zoom/2-200;
    c.fillStyle=c.createPattern(ground,'repeat');c.fillRect(left,top,width/zoom+400,height/zoom+400);
    // Quiet trails make a legible route between actual destinations.
    for(const points of [[[0,70],[-180,-20],[-520,-130]],[[-520,-130],[-540,-520],[-130,-550],[520,-360]],[[0,70],[170,240],[100,510]],[[0,70],[220,-40],[520,-360]]]){
      c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=64;c.strokeStyle='#5b684a';c.stroke();c.lineWidth=49;c.strokeStyle='#6d7051';c.stroke();c.lineWidth=36;c.strokeStyle='#757555';c.stroke();
    }
    for(let i=0;i<90;i++){const x=((i*173)%1800)-900,y=((i*257)%1800)-900;if(x<left||y<top||x>left+width/zoom+400||y>top+height/zoom+400)continue;rect(c,x,y,3,2,i%5?'#7b8056':'#b0a566');rect(c,x+4,y-3,2,3,'#5f754d');}
    for(const f of g.fields){ellipse(c,f.x,f.y,f.r,f.r*.65,f.hostile?'#975b5266':'#7ab39a55');if(!f.hostile){for(let i=0;i<8;i++){const a=i*2.4+g.time;rect(c,f.x+Math.cos(a)*f.r*.7,f.y+Math.sin(a)*f.r*.4,2,3,'#c9dba4');}}}
    for(const gem of [...g.gems.values(),...g.flying])poly(c,[[gem.x,gem.y-5],[gem.x+4,gem.y],[gem.x,gem.y+3],[gem.x-3,gem.y]],gem.value>8?'#c2bdde':'#99cbaa');
    for(const item of g.pickups){if(item.type==='chest'){rect(c,item.x-12,item.y-15,24,16,INK);rect(c,item.x-10,item.y-14,20,12,'#b38b4f');rect(c,item.x-11,item.y-9,22,3,'#604f35');rect(c,item.x-2,item.y-10,5,5,'#e6c67b');}else if(item.type==='heal'){rect(c,item.x-5,item.y-10,10,10,'#c48e71');rect(c,item.x-1,item.y-14,3,6,'#8eac66');}else ellipse(c,item.x,item.y-5,4,5,'#d8bd74');}
    const actors=[...g.terrain.map(a=>({y:a.y,draw:()=>rock(c,a)})),...g.expedition.sites.map(s=>({y:s.y,draw:()=>siteArt(c,s,g.time)})),...g.enemies.map(e=>({y:e.y,draw:()=>drawEnemy(c,e)})),...trees.filter(a=>Math.abs(a.x-cx)<width/zoom/2+120&&Math.abs(a.y-cy)<height/zoom/2+200).map(a=>({y:a.y,draw:()=>{c.save();if(Math.abs(a.x-p.x)<65*a.size&&p.y>a.y-160*a.size&&p.y<a.y+20)c.globalAlpha=.16;tree(c,a.x,a.y,a.size,a.id);c.restore();}}))];
    actors.push({y:p.y,draw:()=>{
      ellipse(c,p.x,p.y,17,6,'#20352b88');
      let frame=p.moving?walkPose(p.walk).frame:8;if(p.attack>0)frame=p.attack>.12?9:10;if(p.hurt>.22)frame=11;
      const angle=p.attack>0?(p.aim??0):Math.atan2(p.fy,p.fx),dir=facing(Math.cos(angle),Math.sin(angle));
      if(dir==='north')weapon(c,g);
      drawHero(c,atlas,HEROES[g.hero].row,dir,frame,p.x,p.y,80,p.moving?walkPose(p.walk).frame:frame);
      if(dir!=='north')weapon(c,g);
      if(p.hurt>.27){poly(c,[[p.x-9,p.y-39],[p.x-4,p.y-43],[p.x-2,p.y-38],[p.x+4,p.y-39],[p.x,p.y-34],[p.x+1,p.y-30],[p.x-5,p.y-33]],'#ffe4b5');}
    }});
    actors.sort((a,b)=>a.y-b.y);for(const actor of actors)actor.draw();
    for(const id of ['briar','hive']){const o=orbitState(g,id);if(o?.active)for(let i=0;i<o.count;i++){const a=g.time*o.speed+i*TAU/o.count,x=p.x+Math.cos(a)*o.radius,y=p.y+Math.sin(a)*o.radius*.8;poly(c,[[x,y-8],[x+5,y],[x,y+6],[x-5,y]],'#adc87a');rect(c,x-1,y-5,2,5,'#d7df9c');}}
    for(const q of g.projectiles){
      c.save();c.translate(Math.round(q.x),Math.round(q.y));c.rotate(q.kind==='moon'?q.age*13:Math.atan2(q.vy,q.vx));
      if(q.kind==='moon'){poly(c,[[-10,-12],[2,-12],[11,-4],[12,6],[5,13],[-4,12],[2,6],[4,0],[-1,-7]],'#c3d9d1');}
      else if(q.kind==='bee'){rect(c,-2,-6,5,4,'#d5e5c9');rect(c,-2,3,5,4,'#d5e5c9');rect(c,-5,-2,10,5,'#d5b45c');rect(c,-1,-2,2,5,INK);}
      else if(q.kind==='enemy'){ellipse(c,0,0,6,6,'#d5a5c4');rect(c,-2,-3,3,3,'#f2cde0');}
      else if(q.kind==='bottle'){rect(c,-5,-6,10,13,'#72c0a0');rect(c,-3,-8,6,4,'#b69b68');}
      else{poly(c,[[-6,-3],[4,-4],[8,0],[4,4],[-6,3]],q.evolved?'#f0d58b':'#cfab6a');rect(c,-5,-4,3,8,'#846441');}
      c.restore();
    }
    for(const fx of g.effects){const t=fx.life/fx.maxLife;c.save();c.globalAlpha=Math.min(1,t*2);c.strokeStyle=fx.color;c.lineWidth=fx.type==='bolt'?3:2;
      if(fx.type==='bolt'){c.beginPath();c.moveTo(fx.fromX,fx.fromY);c.lineTo(fx.x+10,fx.y-28);c.lineTo(fx.x-6,fx.y-15);c.lineTo(fx.x,fx.y);c.stroke();}
      else if(fx.type==='slash'){c.beginPath();c.arc(fx.x,fx.y-20,fx.r*(1-t*.3),fx.angle-fx.spread,fx.angle+fx.spread);c.stroke();}
      else if(fx.type==='ring'&&fx.r>80){c.globalAlpha=t*.5;c.beginPath();c.ellipse(fx.x,fx.y,fx.r*(1-t*.3),fx.r*.65*(1-t*.3),0,0,TAU);c.stroke();}
      else for(let i=0;i<5;i++){const a=i*2.4;rect(c,fx.x+Math.cos(a)*(1-t)*20,fx.y-12+Math.sin(a)*(1-t)*15,3,3,fx.color);}
      c.restore();}
    c.font='12px Galmuri,monospace';c.textAlign='center';for(const t of g.texts){c.globalAlpha=Math.min(1,t.life*3);c.fillStyle='#28362d';c.fillText(t.value,t.x+1,t.y+1);c.fillStyle=t.color;c.fillText(t.value,t.x,t.y);}c.globalAlpha=1;
    const guardian=g.enemies.find(e=>e.nestGuardian);if(guardian){rect(c,guardian.x-28,guardian.y-92,56,5,'#2c352a');rect(c,guardian.x-27,guardian.y-91,54*guardian.hp/guardian.maxHp,3,'#c88c6c');}
    c.restore();
    // Labels stay inside the viewport and point to world coordinates.
    for(const s of g.expedition.sites){if(g.phase==='camp'||s.state==='spent'||s.id==='camp'&&g.time<180)continue;const sx=(s.x-cx)*zoom+width/2,sy=(s.y-cy)*zoom+height/2+25;if(sx>65&&sx<width-65&&sy>100&&sy<height-100)continue;
      const x=Math.max(62,Math.min(width-62,sx)),y=Math.max(130,Math.min(height-105,sy));c.fillStyle='#26392de6';c.fillRect(x-48,y-13,96,28);c.fillStyle=s.color;c.font='11px Galmuri,monospace';c.textAlign='center';c.fillText(`${s.short} ${Math.round(Math.hypot(s.x-p.x,s.y-p.y)/10)}m`,x,y+4);c.beginPath();const a=Math.atan2(sy-y,sx-x);c.moveTo(x+Math.cos(a)*52,y+Math.sin(a)*18);c.lineTo(x+Math.cos(a+.3)*44,y+Math.sin(a+.3)*16);c.lineTo(x+Math.cos(a-.3)*44,y+Math.sin(a-.3)*16);c.fill();
    }
    if(mapCanvas){const m=mapCanvas.getContext('2d'),w=mapCanvas.width,h=mapCanvas.height,scale=w/2900;m.clearRect(0,0,w,h);m.fillStyle='#314738';m.fillRect(0,0,w,h);m.strokeStyle='#718064';m.lineWidth=1;m.strokeRect(8,8,w-16,h-16);for(const a of g.terrain){m.fillStyle='#637561';m.fillRect(w/2+a.x*scale-2,h/2+a.y*scale-2,4,3);}for(const s of g.expedition.sites){m.fillStyle=s.state==='spent'?'#6e8066':s.color;m.fillRect(w/2+s.x*scale-2,h/2+s.y*scale-2,5,5);}m.fillStyle='#f0e1b6';m.beginPath();m.arc(w/2+p.x*scale,h/2+p.y*scale,3,0,TAU);m.fill();}
  }
  return {render,atlas,dispose:()=>observer.disconnect()};
}
