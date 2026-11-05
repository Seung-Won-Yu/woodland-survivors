import {actor,prop} from './art.js';
import {HEROES,WEAPONS,FRONTS,FIELD,BOSS_POSITION} from './content.js';
const TAU=Math.PI*2,hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
const circle=(c,x,y,r,fill,stroke,width=1)=>{c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
export function createMissionRenderer(canvas,map,art){
 const c=canvas.getContext('2d'),m=map.getContext('2d');let w=1,h=1,dpr=1;
 const tile=document.createElement('canvas');tile.width=512;tile.height=512;const t=tile.getContext('2d');t.fillStyle='#64685a';t.fillRect(0,0,512,512);
 for(let i=0;i<1800;i++){const x=Math.floor(hash(i,8)*512),y=Math.floor(hash(i,13)*512);t.fillStyle=i%3?'#95927b24':'#323d362b';t.fillRect(x,y,2+Math.floor(hash(i,6)*5),2);}
 t.strokeStyle='#424c3f';t.lineWidth=1;for(let i=0;i<14;i++){const x=hash(i,4)*512,y=hash(i,5)*512;t.beginPath();t.moveTo(x,y);t.lineTo(x+14,y+9);t.lineTo(x+7,y+18);t.stroke();}
 const pattern=c.createPattern(tile,'repeat');
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 function draw(s,{reduced=false,lobby=false,target='first'}={}){
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
  const p=s.player,zoom=Math.min(w/850,h/650),shake=reduced?0:s.shake,cx=lobby?w*.72:w/2,cy=lobby?h*.7:h*.53;
  c.save();c.translate(cx+(shake?Math.sin(s.t*91)*shake:0),cy+(shake?Math.cos(s.t*117)*shake*.5:0));c.scale(zoom,zoom);c.translate(-p.x,-p.y);
  const left=p.x-cx/zoom-100,right=p.x+(w-cx)/zoom+100,top=p.y-cy/zoom-150,bottom=p.y+(h-cy)/zoom+200;
  c.fillStyle=pattern;c.fillRect(left,top,right-left,bottom-top);
  if(s.front===1){c.fillStyle='#6e4e3026';c.fillRect(left,top,right-left,bottom-top);}if(s.front===2){c.fillStyle='#374d642a';c.fillRect(left,top,right-left,bottom-top);}
  c.fillStyle='#383e37';c.fillRect(-170,FIELD.top,340,FIELD.bottom-FIELD.top);c.fillStyle='#555a4b';c.fillRect(-155,FIELD.top,310,FIELD.bottom-FIELD.top);
  if(s.front===1){for(const x of [-105,105]){c.fillStyle='#272e2d';c.fillRect(x,top,8,bottom-top);}c.fillStyle='#858575';for(let y=Math.floor(top/45)*45;y<bottom;y+=45)c.fillRect(-125,y,260,9);}
  if(s.front===2){c.fillStyle='#304e58';c.fillRect(FIELD.right-120,top,400,bottom-top);for(let y=Math.floor(top/120)*120;y<bottom;y+=120){c.fillStyle='#9e977d';c.fillRect(FIELD.right-190,y,280,25);}}
  c.fillStyle='#c3bd863f';for(let y=Math.floor(top/100)*100;y<bottom;y+=100)c.fillRect(-4,y,8,42);
  c.fillStyle='#384c4d';c.fillRect(FIELD.left-600,top,470,bottom-top);c.strokeStyle='#8e9a8a55';c.lineWidth=2;for(let y=Math.floor(top/30)*30;y<bottom;y+=30){c.beginPath();c.moveTo(FIELD.left-150,y);c.lineTo(FIELD.left-120,y+10);c.stroke();}
  c.strokeStyle='#b3ab7a66';c.lineWidth=3;c.strokeRect(FIELD.left-30,FIELD.top-40,FIELD.right-FIELD.left+60,FIELD.bottom-FIELD.top+80);
  for(let gx=Math.floor(left/220)*220;gx<right;gx+=220)for(let gy=Math.floor(top/220)*220;gy<bottom;gy+=220){const n=hash(gx,gy);if(Math.abs(gx)<190||n<.55)continue;prop(c,art,3,n>.8?2:1,gx+n*50,gy,65+n*22,.65);}
  if(s.stage==='boss'){c.fillStyle='#c1a47522';c.fillRect(-720,BOSS_POSITION.y-320,1440,780);c.setLineDash([15,13]);c.strokeStyle='#d9b166';c.lineWidth=3;c.strokeRect(-720,BOSS_POSITION.y-320,1440,780);c.setLineDash([]);}
  for(const site of s.sites){if(site.kind==='boss')continue;
   const done=site.state==='done',ready=site.state==='ready';
   if(site.kind==='battery')prop(c,art,3,0,site.x,site.y,145,done?.4:1);
   else if(site.kind==='garage')prop(c,art,0,done?3:0,site.x,site.y,125);
   else if(site.kind==='convoy')prop(c,art,2,3,site.x,site.y,146,done?.5:1);
   else prop(c,art,2,site.rescues>0?(done?2:1):0,site.x,site.y,site.kind==='supply'?72:92,done?.7:1);
   if(!done){circle(c,site.x,site.y,site.kind==='garage'?95:75,null,ready?'#e8d494':'#acb5a366',ready?3:1);c.textAlign='center';c.font='bold 14px Galmuri';c.lineWidth=4;c.strokeStyle='#26332d';c.strokeText(site.name,site.x,site.y+28);c.fillStyle=ready?'#ffdf8e':'#f0e7ce';c.fillText(site.name,site.x,site.y+28);if(site.state==='active'){c.font='11px Galmuri';c.fillStyle='#e8c28c';c.fillText(`${site.wave}/${site.waves} · 경비 ${s.enemies.filter(e=>!e.dead&&e.siteId===site.id).length}명`,site.x,site.y+46);}if(ready){c.font='12px Galmuri';c.fillText(site.kind==='garage'?'F · 탑승':'가까이 이동 · 보급',site.x,site.y+47);}}
  }
  const b=s.boss;const broken=b.parts.filter(part=>part.hp<=0).length;
  c.save();if(s.front===0)c.filter='sepia(.4)';if(s.front===1)c.filter='saturate(.5)';prop(c,art,1,b.hp<=0?3:broken,b.x,b.y+45,s.front===2?260:210);c.restore();
  if(s.front===1){prop(c,art,3,0,b.x-105,b.y+35,95);prop(c,art,3,0,b.x+105,b.y+35,95);}
  if(b.active){for(const part of b.parts)if(part.hp>0){const x=b.x+part.ox,y=b.y+part.oy;circle(c,x,y,part.r,null,'#e5bd73aa',2);c.fillStyle='#262e2b';c.fillRect(x-26,y-50,52,5);c.fillStyle='#efbd76';c.fillRect(x-26,y-50,52*Math.max(0,part.hp/part.maxHp),5);}
   if(b.mode==='windup'){c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.fillStyle='#d35d3d44';c.fillRect(0,-67,300,134);c.strokeStyle='#f9bd80';c.lineWidth=3;c.strokeRect(0,-67,300,134);c.restore();}
   if(b.mode==='recover')circle(c,b.x,b.y,100,null,'#ead59299',2);
  }else{c.font='bold 19px Galmuri';c.textAlign='center';c.fillStyle='#f0c17e';c.fillText(FRONTS[s.front].boss,b.x,b.y-170);}
  for(const z of s.zones){const pulse=Math.sin(s.t*20+z.x);circle(c,z.x,z.y,z.r,'#d77a2740');for(let i=0;i<6;i++){const a=i*TAU/6;c.fillStyle=i%2?'#ef9b3b':'#efd781';c.fillRect(z.x+Math.cos(a)*z.r*.6,z.y+Math.sin(a)*z.r*.6,6,12+pulse*4);}}
  for(const h of s.hazards){circle(c,h.x,h.y,h.r,'#c45f3044','#f4bb7e',2);circle(c,h.x,h.y,h.r*Math.max(0,h.timer/1.05),null,'#f6d8a7',1);c.strokeStyle='#ffc18a';c.beginPath();c.moveTo(h.x-7,h.y);c.lineTo(h.x+7,h.y);c.moveTo(h.x,h.y-7);c.lineTo(h.x,h.y+7);c.stroke();}
  for(const g of s.gems){c.save();c.translate(g.x,g.y-6);if(g.ammo){c.fillStyle='#c5d1a2';c.fillRect(-7,-5,14,10);c.fillStyle='#535f40';c.fillRect(-3,-3,2,6);c.fillRect(2,-3,2,6);}else{c.rotate(Math.PI/4);c.fillStyle='#b5d9cc';c.fillRect(-3,-3,6,6);c.fillStyle='#fff0bf';c.fillRect(-2,-2,2,2);}c.restore();}
  for(const f of s.effects)if(f.type==='reinforce'){circle(c,f.x,f.y,60+f.age*12,'#bb633520','#efb877',2);c.font='bold 13px Galmuri';c.textAlign='center';c.fillStyle='#ffddb3';c.fillText('적 증원',f.x,f.y-80);}
  const actors=s.enemies.filter(e=>e.x>left-80&&e.x<right+80&&e.y>top-80&&e.y<bottom+100).map(e=>({y:e.y,e}));actors.push({y:p.y,hero:true});actors.sort((a,b)=>a.y-b.y);
  for(const a of actors){if(a.hero){
    circle(c,p.x,p.y,p.slug?36:18,'#1e2c2555',HEROES[s.hero].color,1.5);
    if(p.slug)prop(c,art,0,p.attack>0?1:p.slugHp<40?2:0,p.x,p.y,120);
    else{const north=Math.sin(p.aim)<-.6,row=(s.hero==='fio'?2:0)+(north?1:0),frame=p.moving?Math.floor(p.walk/26)%4:0;
     c.save();if(!reduced&&p.invuln>0&&Math.sin(s.t*24)>0)c.globalAlpha=.65;actor(c,art.operators,row,frame,p.x-Math.cos(p.aim)*(p.attack>0?2:0),p.y,68,Math.cos(p.aim)<0);c.restore();
    }
    if(p.attack>0){const x=p.x+Math.cos(p.aim)*(p.slug?57:26),y=p.y-26+Math.sin(p.aim)*(p.slug?40:22);c.save();c.translate(x,y);c.rotate(p.aim);c.fillStyle='#fff0b6';c.beginPath();c.moveTo(-2,-5);c.lineTo(20,0);c.lineTo(-2,5);c.fill();c.restore();}
    if(p.overdrive>0){c.strokeStyle='#ffdc95';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,23,Math.PI,s.t*8+Math.PI);c.stroke();}
   }else{const e=a.e,row=['rifle','shield','mortar','officer'].indexOf(e.type);c.save();if(e.dead){c.globalAlpha=Math.max(0,e.deathLife/.32);c.translate(e.x,e.y);c.scale(1,.5+e.deathLife*.5);c.translate(-e.x,-e.y);}if(!reduced&&e.hurt>0)c.filter='brightness(1.6)';circle(c,e.x,e.y,e.r*.7,'#1c292449');actor(c,art.enemies,row,Math.floor(e.walk/19)%4,e.x,e.y,e.type==='officer'?61:e.type==='shield'?53:47,Math.cos(e.aim)<0);c.restore();if(e.siteId&&!e.dead&&e.hp<e.maxHp){c.fillStyle='#23372c';c.fillRect(e.x-17,e.y-65,34,3);c.fillStyle='#e5bd7e';c.fillRect(e.x-17,e.y-65,34*e.hp/e.maxHp,3);}}
  }
  for(const shot of s.shots){const color=WEAPONS[shot.weapon]?.color||'#fff0c2';c.save();c.translate(shot.x,shot.y-25);c.rotate(shot.angle);
   if(shot.rocket){c.fillStyle='#efb15f66';c.beginPath();c.moveTo(-30,-6);c.lineTo(0,0);c.lineTo(-30,6);c.fill();c.fillStyle='#e5dfbc';c.fillRect(-9,-4,15,8);c.fillStyle='#a95439';c.beginPath();c.moveTo(6,-4);c.lineTo(13,0);c.lineTo(6,4);c.fill();}
   else{c.strokeStyle=color+'55';c.lineWidth=(shot.width||3)+2;c.lineCap='round';c.beginPath();c.moveTo(-27,0);c.lineTo(0,0);c.stroke();c.strokeStyle=color;c.lineWidth=shot.fragment?2:shot.width||3;c.beginPath();c.moveTo(-12,0);c.lineTo(3,0);c.stroke();}c.restore();}
  for(const shot of s.enemyShots){circle(c,shot.x,shot.y-20,7,'#553a27','#ffb16a',2);circle(c,shot.x,shot.y-20,3,'#ffe3a9');}
  for(const f of s.effects){const k=f.age/f.life;c.save();c.globalAlpha=1-k;
   if(['explosion','enemy-explosion','growth'].includes(f.type)){const r=f.r*(.2+k*.8);circle(c,f.x,f.y-15,r,f.type==='growth'?'#dfd39415':'#d7792e28',f.type==='enemy-explosion'?'#f4a76d':'#f5d184',3*(1-k)+1);
    if(f.type!=='growth')for(let i=0;i<9;i++){const a=i*TAU/9+f.x;c.fillStyle=i%3?'#f0bf60':'#fff1bf';c.fillRect(f.x+Math.cos(a)*r*.75-3,f.y-20+Math.sin(a)*r*.6-5,5+5*(1-k),9*(1-k)+2);}
   }else if(f.type==='hit'){c.save();c.translate(f.x,f.y);c.rotate(f.angle);c.strokeStyle='#fff3c7';c.lineWidth=2;c.beginPath();c.moveTo(-8,-8);c.lineTo(8,8);c.moveTo(-8,8);c.lineTo(8,-8);c.stroke();c.restore();}
   else if(f.type==='kill'){for(let i=0;i<4;i++){const a=i*TAU/4+f.x;c.fillStyle=i%2?'#d5ba85':'#a37f55';c.fillRect(f.x+Math.cos(a)*k*28,f.y+Math.sin(a)*k*20,3,3);}}
   else if(f.type==='text'){c.font='bold 20px Galmuri';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#25372b';c.strokeText(f.text,f.x,f.y-k*20);c.fillStyle='#ffe2a3';c.fillText(f.text,f.x,f.y-k*20);}
   c.restore();}
  for(const n of s.numbers){c.globalAlpha=Math.min(1,(n.life-n.age)*5);c.font='bold 20px Galmuri';c.textAlign='center';c.strokeStyle='#30362a';c.lineWidth=4;c.strokeText(n.n,n.x,n.y-n.age*42);c.fillStyle='#ffe9b5';c.fillText(n.n,n.x,n.y-n.age*42);}c.globalAlpha=1;c.restore();
  if(!lobby){const n=s.sites.find(n=>n.id===target),d=n?Math.hypot(n.x-p.x,n.y-p.y):0;if(n&&d>160){const a=Math.atan2(n.y-p.y,n.x-p.x),rx=Math.min(w*.36,180),ry=Math.min(h*.25,150),x=w/2+Math.cos(a)*rx,y=h*.53+Math.sin(a)*ry;c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#efcf86';c.strokeStyle='#3f4a32';c.lineWidth=2;c.beginPath();c.moveTo(12,0);c.lineTo(-7,-8);c.lineTo(-3,0);c.lineTo(-7,8);c.closePath();c.fill();c.stroke();c.restore();c.textAlign='center';c.font='11px Galmuri';c.fillStyle='#f5e6ba';c.fillText(`${Math.round(d/10)}m`,x,y+22);}}
  if(!reduced&&p.hurt>.12){c.fillStyle=`rgba(150,45,25,${p.hurt*.3})`;c.fillRect(0,0,w,h);}
  if(lobby){c.fillStyle='#12221fc2';c.fillRect(0,0,w,h);}
  drawMap(s,target);
 }
 function drawMap(s,target){m.clearRect(0,0,map.width,map.height);m.fillStyle='#273831';m.fillRect(0,0,map.width,map.height);m.strokeStyle='#69735b';m.lineWidth=1;m.strokeRect(4,4,map.width-8,map.height-8);const x=v=>(v-FIELD.left)/(FIELD.right-FIELD.left)*map.width,y=v=>(v-FIELD.top)/(FIELD.bottom-FIELD.top)*map.height;
  m.fillStyle='#8d8a68';m.fillRect(x(-170),0,x(170)-x(-170),map.height);
  for(const n of s.sites){m.fillStyle=n.id===target?'#ffd992':n.state==='done'?'#556d56':n.kind==='boss'?'#e59571':'#c1d0b0';m.fillRect(x(n.x)-3,y(n.y)-3,6,6);}
  m.fillStyle='#fff4cf';circle(m,x(s.player.x),y(s.player.y),3,'#fff4cf');
 }
 resize();return{draw,resize};
}
