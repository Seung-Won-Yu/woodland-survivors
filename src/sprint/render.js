import {drawHero} from '../art/sprites.js';
import {drawIllustratedEnemy,drawProp} from '../art/illustrated.js';
import {animationState} from '../game/motion.js';
const TAU=Math.PI*2;
const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
function circle(c,x,y,r,fill,stroke,width=1){c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
export function createSprintRenderer(canvas,art){
 const c=canvas.getContext('2d');let w=1,h=1,dpr=1;
 const ground=c.createPattern(art.textures.grass,'repeat'),dirt=c.createPattern(art.textures.dirt,'repeat');
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 function draw(s,{reduced=false,menu=false}={}){
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const zoom=Math.min(w/800,h/620),p=s.player,shake=reduced?0:s.shake;
  const cx=(menu?w*.7:w/2)+(shake?Math.sin(s.t*133)*shake:0),cy=h*(menu?(w<600?.18:.53):.53)+(shake?Math.cos(s.t*117)*shake*.6:0);
  c.save();c.translate(cx,cy);c.scale(zoom,zoom);c.translate(-p.x,-p.y);
  const left=p.x-cx/zoom-60,right=p.x+(w-cx)/zoom+60,top=p.y-cy/zoom-160,bottom=p.y+(h-cy)/zoom+200;
  c.fillStyle=ground;c.fillRect(left,top,right-left,bottom-top);c.fillStyle='#243d25';c.globalAlpha=.32;c.fillRect(left,top,right-left,bottom-top);c.globalAlpha=1;
  // A broad, quiet trail makes projectiles readable over the original forest art.
  c.save();c.globalAlpha=.7;c.fillStyle=dirt;c.beginPath();c.ellipse(0,30,1000,430,-.25,0,TAU);c.fill();c.restore();
  c.fillStyle='#556c3c35';for(let x=Math.floor(left/180)*180;x<right;x+=180)for(let y=Math.floor(top/180)*180;y<bottom;y+=180){
   const n=hash(x,y);if(n<.4){circle(c,x+n*130,y+hash(y,x)*130,20+n*40,'#2c4d3033');}
  }
  c.setLineDash([10,13]);circle(c,0,0,817,null,'#d0d7a966',4);c.setLineDash([]);
  if(Math.hypot(p.x,p.y)>705){c.font='bold 15px Galmuri';c.textAlign='center';c.fillStyle='#fff0b8';c.fillText('숲 가장자리 · 방향을 바꾸세요',p.x,p.y+53);}
  for(const g of s.gems){const pulse=1+Math.sin(s.t*5+g.age)*.12;c.save();c.translate(g.x,g.y-7);c.rotate(Math.PI/4);c.fillStyle='#bceaca';c.fillRect(-4*pulse,-4*pulse,8*pulse,8*pulse);c.strokeStyle='#477e63';c.strokeRect(-4*pulse,-4*pulse,8*pulse,8*pulse);c.restore();}
  for(const m of s.mines){const arm=Math.min(1,m.age/.2),warn=m.queue!==null;
   circle(c,m.x,m.y,22*arm,'#244d3977',warn?'#fff5bf':'#9cc88f',warn?3:1.4);
   c.fillStyle=warn?'#fff5bf':'#d5c28b';c.beginPath();c.ellipse(m.x,m.y-7,8,11,-.4,0,TAU);c.fill();
   c.strokeStyle='#89cba3';c.lineWidth=3;c.beginPath();c.moveTo(m.x,m.y-14);c.quadraticCurveTo(m.x-12,m.y-25,m.x-16,m.y-18);c.moveTo(m.x,m.y-14);c.quadraticCurveTo(m.x+12,m.y-27,m.x+17,m.y-20);c.stroke();
   if(m.life<1)c.globalAlpha=.5+Math.sin(s.t*18)*.3;circle(c,m.x,m.y,4,'#dbf0ba');c.globalAlpha=1;
  }
  for(const f of s.effects)if(f.type==='reinforce'){
   const k=f.age/f.life;circle(c,f.x,f.y,48+k*18,'#9c4f2333','#e4ad70',2);c.setLineDash([6,7]);circle(c,f.x,f.y,75,null,'#f2c28a',2);c.setLineDash([]);
   c.font='bold 15px Galmuri';c.textAlign='center';c.fillStyle='#ffe5b8';c.fillText('증원',f.x,f.y-84);
  }
  const boss=s.boss;
  if(boss&&!boss.dead&&boss.mode==='windup'){
   c.save();c.translate(boss.x,boss.y);c.rotate(boss.chargeAngle);c.fillStyle='#cf70444d';c.fillRect(0,-51,320,102);c.strokeStyle='#ffd3a0';c.lineWidth=3;c.strokeRect(0,-51,320,102);
   c.beginPath();c.moveTo(100,-16);c.lineTo(128,0);c.lineTo(100,16);c.moveTo(210,-16);c.lineTo(238,0);c.lineTo(210,16);c.stroke();c.restore();
  }
  if(boss&&!boss.dead&&boss.mode==='recover')circle(c,boss.x,boss.y,64,'#f8d98522','#f8d985',2);
  if(p.dash>0){circle(c,p.x-p.fx*30,p.y-p.fy*30,26,'#e4e3b829');circle(c,p.x-p.fx*70,p.y-p.fy*70,19,'#e4e3b81c');}
  circle(c,p.x,p.y,24,'#17241c55',s.path==='trail'?'#b0e0b3':s.path==='pierce'?'#edcd86':'#e4dfba',2);
  if(s.path==='pierce'){
   const a=Math.atan2(p.fy,p.fx),charged=p.straight>.45;c.save();c.translate(p.x,p.y);c.rotate(a);c.fillStyle=charged?'#f7d98d':'#ded6ad77';c.beginPath();c.moveTo(40,-6);c.lineTo(53,0);c.lineTo(40,6);c.fill();c.restore();
   if(charged)circle(c,p.x,p.y,29,null,'#f7d98d88',1);
  }
  // Ground anchors sort the original illustrated sprites front-to-back.
  const actors=s.enemies.filter(e=>e.x>left-120&&e.x<right+120&&e.y>top-100&&e.y<bottom+100).map(e=>({y:e.y,e}));actors.push({y:p.y,hero:true});
  for(let x=Math.floor(left/350)*350;x<right;x+=350)for(let y=Math.floor(top/350)*350;y<bottom;y+=350){
   const n=hash(x+9,y+7),px=x+n*190,py=y+hash(y+5,x)*200;
   if(Math.hypot(px,py)<700)continue;
   actors.push({y:py,prop:true,x:px,n});
  }
  actors.sort((a,b)=>a.y-b.y);
  for(const a of actors){
   if(a.prop){drawProp(c,art,0,Math.floor(a.n*3),a.x,a.y,120+a.n*80,Math.abs(a.x-p.x)<105&&a.y>p.y&&a.y<p.y+240?.25:.85);continue;}
   if(a.hero){const pose=animationState(p);c.save();if(!reduced&&p.invuln>0&&p.dash<=0&&Math.sin(s.t*32)>0)c.globalAlpha=.62;
    drawHero(c,art.atlas,0,pose.dir,pose.frame,p.x,p.y,150,pose.legFrame,{x:-Math.cos(pose.aim)*(p.attack>0?3:0),y:-Math.sin(pose.aim)*(p.attack>0?1.5:0)},pose.legDir);c.restore();
   }else{const e=a.e;c.save();if(e.dead){c.globalAlpha=Math.max(0,e.deadLife/.28);c.translate(e.x,e.y);c.scale(1+(.28-e.deadLife)*.7,Math.max(.4,e.deadLife/.28));c.translate(-e.x,-e.y);}circle(c,e.x,e.y,e.r*.9,'#15281b44');drawIllustratedEnemy(c,art,reduced?{...e,hurt:0}:e);c.restore();}
  }
  for(const shot of s.shots){
   const a=shot.angle,len=shot.empowered?34:16;c.save();c.translate(shot.x,shot.y-24);c.rotate(a);
   c.strokeStyle=shot.empowered?'#e4b96577':'#d9c79766';c.lineWidth=shot.wide?shot.wide+4:4;c.lineCap='round';c.beginPath();c.moveTo(-len*2,0);c.lineTo(1,0);c.stroke();
   c.strokeStyle=shot.empowered?'#fff0b3':'#f2d6a3';c.lineWidth=shot.wide?Math.max(4,shot.wide):6;c.beginPath();c.moveTo(-len,0);c.lineTo(3,0);c.stroke();c.fillStyle='#956238';c.beginPath();c.ellipse(4,0,6,4,0,0,TAU);c.fill();c.restore();
  }
  for(const f of s.effects){const k=f.age/f.life,alpha=1-k;c.save();c.globalAlpha=alpha;
   if(['blast','pierce-burst','growth','level'].includes(f.type)){
    const r=f.r*(.2+k*.8),green=f.type==='blast';circle(c,f.x,f.y,r,green?'#c3e9a820':f.type==='growth'?'#fff0b918':'#f7d69a22',green?'#d1ecaa':'#f2d390',f.type==='blast'?6*(1-k)+1:3);
    for(let i=0;i<8;i++){const a=i*TAU/8;circle(c,f.x+Math.cos(a)*r*.8,f.y+Math.sin(a)*r*.8,3+3*(1-k),green?'#d5eaa6':'#ffe5a0');}
   }else if(f.type==='hit'){
    c.translate(f.x,f.y);c.rotate(f.angle);c.strokeStyle='#fff3c7';c.lineWidth=3;c.beginPath();c.moveTo(-13*k,-12*k);c.lineTo(13*k,12*k);c.moveTo(-10*k,14*k);c.lineTo(10*k,-14*k);c.stroke();
   }else if(f.type==='kill'){
    for(let i=0;i<5;i++){const a=i*TAU/5+f.x;circle(c,f.x+Math.cos(a)*k*32,f.y-18+Math.sin(a)*k*25,3*(1-k)+1,i%2?'#d9bc78':'#9db97c');}
   }else if(f.type==='muzzle'){c.translate(f.x,f.y-24);c.rotate(f.angle);c.fillStyle='#fff4bf';c.beginPath();c.moveTo(-8,-12);c.lineTo(40*(1-k),0);c.lineTo(-8,12);c.fill();}
   if(f.text){c.textAlign='center';c.font=`bold ${f.type==='announcement'?30:19}px Galmuri`;c.strokeStyle='#203527';c.lineWidth=6;c.strokeText(f.text,f.x,f.y-k*20);c.fillStyle=f.type==='opening'?'#ffe2a1':'#fff1c9';c.fillText(f.text,f.x,f.y-k*20);}
   c.restore();
  }
  for(const n of s.numbers){c.globalAlpha=Math.min(1,(n.life-n.age)*5);c.textAlign='center';c.font=`bold ${n.big?26:18}px Galmuri`;c.lineWidth=4;c.strokeStyle='#3c3825';c.strokeText(n.n,n.x,n.y-n.age*48);c.fillStyle=n.big?'#ffdc8c':'#f4ecd0';c.fillText(n.n,n.x,n.y-n.age*48);}c.globalAlpha=1;
  c.restore();
  // The screen edge carries danger without obscuring the playable center.
  if(!reduced&&p.hurt>.12){c.fillStyle=`rgba(163,56,35,${p.hurt*.35})`;c.fillRect(0,0,w,h);}
  if(menu){const fade=c.createLinearGradient(0,0,w,0);fade.addColorStop(0,'#101e18bb');fade.addColorStop(.7,'#15281d22');c.fillStyle=fade;c.fillRect(0,0,w,h);}
 }
 resize();return{draw,resize};
}
