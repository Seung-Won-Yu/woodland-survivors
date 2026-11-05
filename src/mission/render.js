import {actor,prop,environmentProp,vehicle} from './art.js';
import {HEROES,WEAPONS,BOSS_GUIDES,FRONTS,FIELD,BOSS_POSITION} from './content.js';
import {bossPartPosition} from './model.js';
const TAU=Math.PI*2,hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
const circle=(c,x,y,r,fill,stroke,width=1)=>{c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
export function createMissionRenderer(canvas,map,art){
 const c=canvas.getContext('2d'),m=map.getContext('2d');let w=1,h=1,dpr=1;
 const patterns=['#b39b70','#545054','#3b505c'].map((base,front)=>{const tile=document.createElement('canvas');tile.width=512;tile.height=512;const t=tile.getContext('2d');t.fillStyle=base;t.fillRect(0,0,512,512);for(let i=0;i<1600;i++){const x=Math.floor(hash(i,8)*512),y=Math.floor(hash(i,13)*512);t.fillStyle=i%3?'#e9dbad26':'#202e3329';t.fillRect(x,y,2+Math.floor(hash(i,6)*5),2);}t.strokeStyle=front===0?'#d1ba8a50':'#293b4244';t.lineWidth=2;for(let i=0;i<18;i++){const x=hash(i,4)*512,y=hash(i,5)*512;t.beginPath();t.moveTo(x,y);t.lineTo(x+22,y+9);t.lineTo(x+10,y+18);t.stroke();}return c.createPattern(tile,'repeat');});
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 function draw(s,{reduced=false,lobby=false,target='first'}={}){
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
  const p=s.player,zoom=Math.min(w/850,h/650),shake=reduced?0:s.shake,cx=lobby?w*.72:w/2,cy=lobby?h*.7:h*.53;
  const focusX=s.boss.active?p.x*.65+s.boss.x*.35:p.x,focusY=s.boss.active?p.y*.65+s.boss.y*.35:p.y;
  c.save();c.translate(cx+(shake?Math.sin(s.t*91)*shake:0),cy+(shake?Math.cos(s.t*117)*shake*.5:0));c.scale(zoom,zoom);c.translate(-focusX,-focusY);
  const left=focusX-cx/zoom-100,right=focusX+(w-cx)/zoom+100,top=focusY-cy/zoom-150,bottom=focusY+(h-cy)/zoom+200;
  c.fillStyle=patterns[s.front];c.fillRect(left,top,right-left,bottom-top);
  if(s.front===0){
   c.fillStyle='#8c7959';for(let y=Math.floor(top/45)*45;y<bottom;y+=45){const x=Math.sin(y/650)*130;c.fillRect(x-95,y,190,46);}c.fillStyle='#2e7883';c.fillRect(FIELD.left-600,top,530,bottom-top);c.fillRect(left,FIELD.bottom+15,right-left,600);c.strokeStyle='#c6dfbd99';c.lineWidth=5;for(let y=Math.floor(top/60)*60;y<bottom;y+=60){const wave=reduced?0:Math.sin(s.t*1.7+y)*8;c.beginPath();c.moveTo(FIELD.left-65+wave,y);c.lineTo(FIELD.left-51+wave,y+35);c.stroke();}
  }else if(s.front===1){
   for(const railX of [-300,0,300]){c.fillStyle='#4d4740';c.fillRect(railX-82,top,164,bottom-top);for(let y=Math.floor(top/42)*42;y<bottom;y+=42){c.fillStyle='#a3957d';c.fillRect(railX-75,y,150,11);}for(const x of [-55,55]){c.fillStyle='#272f32';c.fillRect(railX+x,top,8,bottom-top);c.fillStyle='#b4b5a0';c.fillRect(railX+x,top,2,bottom-top);}}
  }else{
   c.strokeStyle='#394a51';c.lineWidth=3;for(let x=Math.floor(left/200)*200;x<right;x+=200){c.beginPath();c.moveTo(x,top);c.lineTo(x,bottom);c.stroke();}for(let y=Math.floor(top/200)*200;y<bottom;y+=200){c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();}c.fillStyle='#246073';c.fillRect(FIELD.right+15,top,500,bottom-top);for(let y=Math.floor(top/110)*110;y<bottom;y+=110){c.fillStyle='#dcb36b88';c.fillRect(-220,y,10,55);c.fillRect(210,y,10,55);}
  }
  if(s.front===0){for(let y=Math.floor(top/750)*750;y<bottom;y+=750){for(const side of [-1,1]){c.fillStyle='#655c493d';c.fillRect(side*400-105,y,210,70);environmentProp(c,art,0,side<0?0:1,side*440,y,side<0?145:170,.9);}c.strokeStyle='#e5cc9566';c.lineWidth=3;c.setLineDash([24,32]);c.beginPath();c.moveTo(-110,y);c.lineTo(-110,y+400);c.moveTo(110,y);c.lineTo(110,y+400);c.stroke();c.setLineDash([]);}}
  if(s.front===1){for(let y=Math.floor(top/850)*850;y<bottom;y+=850){for(const side of [-1,1]){c.fillStyle='#292e3855';c.fillRect(side*490-100,y-170,200,390);environmentProp(c,art,1,2,side*490,y,190);environmentProp(c,art,2,1,side*640,y+180,105);}c.fillStyle='#e6b765';c.fillRect(-95,y+150,190,7);c.fillRect(-95,y+164,190,3);c.fillStyle='#202c3855';c.fillRect(-700,y+260,1400,42);}}
  if(s.front===2){for(let y=Math.floor(top/700)*700;y<bottom;y+=700){for(const side of [-1,1]){environmentProp(c,art,1,side<0?0:1,side*480,y,200);environmentProp(c,art,2,0,side*620,y-260,250);}c.fillStyle='#a4b8bc19';c.fillRect(-300,y-60,240,85);c.fillStyle='#f0c26999';for(let i=0;i<5;i++)c.fillRect(-330+i*145,y+130,70,10);c.strokeStyle='#708b9455';c.lineWidth=3;c.strokeRect(-350,y-190,700,240);}}
  c.strokeStyle='#e5c18c66';c.lineWidth=3;c.strokeRect(FIELD.left-20,FIELD.top-20,FIELD.right-FIELD.left+40,FIELD.bottom-FIELD.top+40);
  for(let gx=Math.floor(left/300)*300;gx<right;gx+=300)for(let gy=Math.floor(top/330)*330;gy<bottom;gy+=330){const n=hash(gx,gy);if(Math.abs(gx)<260||n<.3||s.sites.some(site=>Math.hypot(site.x-gx,site.y-gy)<190))continue;const row=s.front===0?(n>.65?0:3):s.front===1?1:2,col=s.front===0?(n>.65?0:n>.48?0:1):s.front===1?Math.floor(n*3):Math.floor(n*4);environmentProp(c,art,row,col,gx+n*45,gy,85+n*(s.front===0?60:80),.94);}
  if(s.stage==='boss'){c.fillStyle='#c1a47522';c.fillRect(-720,BOSS_POSITION.y-320,1440,780);c.setLineDash([15,13]);c.strokeStyle='#d9b166';c.lineWidth=3;c.strokeRect(-720,BOSS_POSITION.y-320,1440,780);c.setLineDash([]);}
  for(const site of s.sites){if(site.kind==='boss')continue;if(site.kind==='exit'){circle(c,site.x,site.y,82,'#67d0c329','#c1f7df',3);c.strokeStyle='#c1f7df';c.lineWidth=5;c.beginPath();c.moveTo(site.x-28,site.y+10);c.lineTo(site.x,site.y-18);c.lineTo(site.x+28,site.y+10);c.stroke();c.font='bold 14px Galmuri';c.fillStyle='#dcffe8';c.textAlign='center';c.fillText(s.front===2?'EVAC / 귀환':'NEXT MISSION',site.x,site.y+55);continue;}
   const done=site.state==='done',ready=site.state==='ready';
   if(site.kind==='battery')prop(c,art,3,0,site.x,site.y,145,done?.4:1);
   else if(site.kind==='garage'){if(done)environmentProp(c,art,3,3,site.x,site.y,145);else prop(c,art,0,0,site.x,site.y,125);}
   else if(site.kind==='convoy')prop(c,art,2,3,site.x,site.y,146,done?.5:1);
   else prop(c,art,2,site.rescues>0?(done?2:1):0,site.x,site.y,site.kind==='supply'?72:92,done?.7:1);
   if(!done){circle(c,site.x,site.y,site.kind==='garage'?95:75,null,ready?'#e8d494':'#acb5a366',ready?3:1);c.textAlign='center';c.font='bold 14px Galmuri';c.lineWidth=4;c.strokeStyle='#26332d';c.strokeText(site.name,site.x,site.y+28);c.fillStyle=ready?'#ffdf8e':'#f0e7ce';c.fillText(site.name,site.x,site.y+28);if(site.state==='active'){c.font='11px Galmuri';c.fillStyle='#e8c28c';c.fillText(`${site.wave}/${site.waves} · 경비 ${s.enemies.filter(e=>!e.dead&&e.siteId===site.id).length}명`,site.x,site.y+46);}if(ready){c.font='12px Galmuri';c.fillText(site.kind==='garage'?'F · 탑승':'가까이 이동 · 보급',site.x,site.y+47);}}
  }
  const b=s.boss;const broken=b.parts.filter(part=>part.hp<=0).length;
  vehicle(c,art,{x:b.x,y:b.y,width:s.front===2?230:190,enemy:true,body:b.bodyAngle,turret:s.front===2&&b.mode==='sweep'?b.angle:b.turretAngle,kick:b.kick,tread:b.tread,moving:b.drive>5,pitch:b.pitch,flash:b.flash,damaged:broken>0||b.hp<=0,wreck:b.hp<=0,reduced});
  if(s.front===1){for(const part of b.parts)if(part.hp>0){const i=b.parts.indexOf(part),a=Math.atan2(p.y-b.y-part.oy,p.x-b.x-part.ox);vehicle(c,art,{x:b.x+part.ox,y:b.y+part.oy,width:92,enemy:true,body:Math.PI/2,turret:a,kick:b.partKicks[i],flash:b.flash,reduced});}c.fillStyle='#79e4d52b';c.fillRect(b.safeX-78,b.y-170,156,610);c.strokeStyle='#9cebdd99';c.setLineDash([8,9]);c.strokeRect(b.safeX-78,b.y-170,156,610);c.setLineDash([]);c.font='bold 12px Galmuri';c.textAlign='center';c.fillStyle='#c7fff0';c.fillText('SAFE',b.safeX,b.y+395);}
  if(b.active){for(const part of b.parts)if(part.hp>0){const {x,y}=bossPartPosition(s,part);circle(c,x,y,part.r,null,'#e5bd73aa',2);c.fillStyle='#262e2b';c.fillRect(x-26,y-50,52,5);c.fillStyle='#efbd76';c.fillRect(x-26,y-50,52*Math.max(0,part.hp/part.maxHp),5);}
   if(b.mode==='windup'){c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.fillStyle='#d35d3d44';c.fillRect(0,-67,376,134);c.strokeStyle='#f9bd80';c.lineWidth=3;c.strokeRect(0,-67,376,134);c.restore();}
   if(s.front===0&&b.mode==='recover'){const rx=b.x-Math.cos(b.angle)*75,ry=b.y-Math.sin(b.angle)*75;circle(c,rx,ry,38,'#7de2d64d','#c5fff1',3);c.font='bold 12px Galmuri';c.fillStyle='#d0fff0';c.fillText('ENGINE',rx,ry-48);}
   if(s.front===2){circle(c,b.x,b.y,28,b.coreOpen>0?'#ffcb6a':'#1a3544',b.coreOpen>0?'#fff0a8':'#819ba5',3);c.font='bold 10px Galmuri';c.textAlign='center';c.fillStyle=b.coreOpen>0?'#322e26':'#c9d7d6';c.fillText(b.coreOpen>0?'OPEN':'LOCK',b.x,b.y+4);if(['sweep-windup','sweep'].includes(b.mode)){c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.strokeStyle=b.mode==='sweep'?'#ff704f':'#ffc46b';c.lineWidth=b.mode==='sweep'?24:3;c.globalAlpha=b.mode==='sweep'?.65:.9;if(b.mode==='sweep-windup')c.setLineDash([14,12]);c.beginPath();c.moveTo(140,0);c.lineTo(740,0);c.stroke();c.setLineDash([]);c.restore();}}
  }else{c.font='bold 19px Galmuri';c.textAlign='center';c.fillStyle='#f0c17e';c.fillText(FRONTS[s.front].boss,b.x,b.y-170);}
  for(const z of s.zones){const pulse=Math.sin(s.t*20+z.x);circle(c,z.x,z.y,z.r,'#d77a2740');for(let i=0;i<6;i++){const a=i*TAU/6;c.fillStyle=i%2?'#ef9b3b':'#efd781';c.fillRect(z.x+Math.cos(a)*z.r*.6,z.y+Math.sin(a)*z.r*.6,6,12+pulse*4);}}
  for(const h of s.hazards){if(h.shape==='beam'){c.save();c.translate(h.x,h.y);c.rotate(Math.atan2(h.y2-h.y,h.x2-h.x));const length=Math.hypot(h.x2-h.x,h.y2-h.y);c.fillStyle=h.hit?'#ff6f424d':'#b943304d';c.fillRect(0,-h.width,length,h.width*2);c.strokeStyle='#ffc17c';c.lineWidth=2;c.setLineDash([10,9]);c.strokeRect(0,-h.width,length,h.width*2);c.restore();continue;}circle(c,h.x,h.y,h.r,'#c45f3044','#f4bb7e',2);circle(c,h.x,h.y,h.r*Math.max(0,h.timer/1.05),null,'#f6d8a7',1);c.strokeStyle='#ffc18a';c.beginPath();c.moveTo(h.x-7,h.y);c.lineTo(h.x+7,h.y);c.moveTo(h.x,h.y-7);c.lineTo(h.x,h.y+7);c.stroke();}
  for(const g of s.gems){c.save();c.translate(g.x,g.y-6);if(g.ammo){c.fillStyle='#c5d1a2';c.fillRect(-7,-5,14,10);c.fillStyle='#535f40';c.fillRect(-3,-3,2,6);c.fillRect(2,-3,2,6);}else{c.rotate(Math.PI/4);c.fillStyle='#b5d9cc';c.fillRect(-3,-3,6,6);c.fillStyle='#fff0bf';c.fillRect(-2,-2,2,2);}c.restore();}
  for(const f of s.effects)if(f.type==='reinforce'){circle(c,f.x,f.y,60+f.age*12,'#bb633520','#efb877',2);c.font='bold 13px Galmuri';c.textAlign='center';c.fillStyle='#ffddb3';c.fillText('적 증원',f.x,f.y-80);}
  const actors=s.enemies.filter(e=>e.x>left-80&&e.x<right+80&&e.y>top-80&&e.y<bottom+100).map(e=>({y:e.y,e}));actors.push({y:p.y,hero:true});actors.sort((a,b)=>a.y-b.y);
  for(const a of actors){if(a.hero){
    circle(c,p.x,p.y,p.slug?36:18,'#1e2c2555',HEROES[s.hero].color,1.5);
    if(p.slug)vehicle(c,art,{x:p.x,y:p.y,width:120,body:p.bodyAngle,turret:p.aim,kick:p.kick,tread:p.tread,moving:p.moving,pitch:p.pitch,flash:p.flash,damaged:p.slugHp<40,reduced});
    else{const north=Math.sin(p.aim)<-.6,row=(s.hero==='fio'?2:0)+(north?1:0),frame=p.moving?Math.floor(p.walk/26)%4:0;
     c.save();if(!reduced&&p.invuln>0&&Math.sin(s.t*24)>0)c.globalAlpha=.65;actor(c,art.operators,row,frame,p.x-Math.cos(p.aim)*(p.attack>0?2:0),p.y,68,Math.cos(p.aim)<0);c.restore();
    }
    if(p.attack>0&&!p.slug){const x=p.x+Math.cos(p.aim)*(p.slug?57:26),y=p.y-26+Math.sin(p.aim)*(p.slug?40:22);c.save();c.translate(x,y);c.rotate(p.aim);c.fillStyle='#fff0b6';c.beginPath();c.moveTo(-2,-5);c.lineTo(20,0);c.lineTo(-2,5);c.fill();c.restore();}
    if(p.overdrive>0){c.strokeStyle='#ffdc95';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,23,Math.PI,s.t*8+Math.PI);c.stroke();}
   }else{const e=a.e,row=['rifle','shield','mortar','officer'].indexOf(e.type);c.save();if(e.dead){c.globalAlpha=Math.max(0,e.deathLife/.32);c.translate(e.x,e.y);c.scale(1,.5+e.deathLife*.5);c.translate(-e.x,-e.y);}if(!reduced&&e.hurt>0)c.filter='brightness(1.6)';circle(c,e.x,e.y,e.r*.7,'#1c292449');actor(c,art.enemies,row,Math.floor(e.walk/19)%4,e.x,e.y,e.type==='officer'?61:e.type==='shield'?53:47,Math.cos(e.aim)<0);c.restore();if(e.burn>0&&!e.dead){circle(c,e.x,e.y-28,7,'#ffb341b0');circle(c,e.x+5,e.y-37,4,'#ffdf8a');}if(e.exposed>0&&!e.dead)circle(c,e.x,e.y,e.r+3,null,'#a3e6e5',2);if(e.siteId&&!e.dead&&e.hp<e.maxHp){c.fillStyle='#23372c';c.fillRect(e.x-17,e.y-65,34,3);c.fillStyle='#e5bd7e';c.fillRect(e.x-17,e.y-65,34*e.hp/e.maxHp,3);}}
  }
  for(const shot of s.shots){const color=WEAPONS[shot.weapon]?.color||'#fff0c2';c.save();c.translate(shot.x,shot.y-25);c.rotate(shot.angle);
   if(shot.flame){c.globalAlpha=.7;c.fillStyle='#f87c35';c.beginPath();c.moveTo(-18,-shot.width);c.lineTo(18,0);c.lineTo(-18,shot.width);c.fill();c.fillStyle='#ffe3a0';c.fillRect(-10,-3,18,6);}
   else if(shot.rail){c.strokeStyle='#8fdfed55';c.lineWidth=15;c.beginPath();c.moveTo(-65,0);c.lineTo(8,0);c.stroke();c.strokeStyle='#e2ffff';c.lineWidth=5;c.stroke();}
   else if(shot.rocket){c.fillStyle='#efb15f66';c.beginPath();c.moveTo(-30,-6);c.lineTo(0,0);c.lineTo(-30,6);c.fill();c.fillStyle='#e5dfbc';c.fillRect(-9,-4,15,8);c.fillStyle='#a95439';c.beginPath();c.moveTo(6,-4);c.lineTo(13,0);c.lineTo(6,4);c.fill();}
   else{c.strokeStyle=color+'55';c.lineWidth=(shot.width||3)+2;c.lineCap='round';c.beginPath();c.moveTo(-27,0);c.lineTo(0,0);c.stroke();c.strokeStyle=color;c.lineWidth=shot.fragment?2:shot.width||3;c.beginPath();c.moveTo(-12,0);c.lineTo(3,0);c.stroke();}c.restore();}
  for(const shot of s.enemyShots){circle(c,shot.x,shot.y-20,7,'#553a27','#ffb16a',2);circle(c,shot.x,shot.y-20,3,'#ffe3a9');}
  for(const f of s.effects){const k=f.age/f.life;c.save();c.globalAlpha=1-k;
   if(['explosion','enemy-explosion','growth'].includes(f.type)){const r=f.r*(.2+k*.8);circle(c,f.x,f.y-15,r,f.type==='growth'?'#dfd39415':'#d7792e28',f.type==='enemy-explosion'?'#f4a76d':'#f5d184',3*(1-k)+1);
    if(f.type!=='growth')for(let i=0;i<9;i++){const a=i*TAU/9+f.x;c.fillStyle=i%3?'#f0bf60':'#fff1bf';c.fillRect(f.x+Math.cos(a)*r*.75-3,f.y-20+Math.sin(a)*r*.6-5,5+5*(1-k),9*(1-k)+2);}
   }else if(f.type==='hit'){c.save();c.translate(f.x,f.y);c.rotate(f.angle);c.strokeStyle='#fff3c7';c.lineWidth=2;c.beginPath();c.moveTo(-8,-8);c.lineTo(8,8);c.moveTo(-8,8);c.lineTo(8,-8);c.stroke();c.restore();}
   else if(f.type==='armor-hit'){for(let i=0;i<7;i++){const a=i*TAU/7;c.strokeStyle=i%2?'#a9ebff':'#ffdda2';c.lineWidth=2;c.beginPath();c.moveTo(f.x+Math.cos(a)*k*18,f.y+Math.sin(a)*k*18);c.lineTo(f.x+Math.cos(a)*(k*38+5),f.y+Math.sin(a)*(k*38+5));c.stroke();}}
   else if(f.type==='kill'){for(let i=0;i<4;i++){const a=i*TAU/4+f.x;c.fillStyle=i%2?'#d5ba85':'#a37f55';c.fillRect(f.x+Math.cos(a)*k*28,f.y+Math.sin(a)*k*20,3,3);}}
   else if(f.type==='text'){c.font='bold 20px Galmuri';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#25372b';c.strokeText(f.text,f.x,f.y-k*20);c.fillStyle='#ffe2a3';c.fillText(f.text,f.x,f.y-k*20);}
   c.restore();}
  for(const n of s.numbers){c.globalAlpha=Math.min(1,(n.life-n.age)*5);c.font='bold 20px Galmuri';c.textAlign='center';c.strokeStyle='#30362a';c.lineWidth=4;c.strokeText(n.n,n.x,n.y-n.age*42);c.fillStyle='#ffe9b5';c.fillText(n.n,n.x,n.y-n.age*42);}c.globalAlpha=1;c.restore();
  if(!lobby){const n=s.sites.find(n=>n.id===target),d=n?Math.hypot(n.x-p.x,n.y-p.y):0;if(n&&d>160&&(cx+(n.x-focusX)*zoom<30||cx+(n.x-focusX)*zoom>w-30||cy+(n.y-focusY)*zoom<100||cy+(n.y-focusY)*zoom>h-130)){const a=Math.atan2(n.y-p.y,n.x-p.x),rx=Math.min(w*.36,180),ry=Math.min(h*.25,150),x=w/2+Math.cos(a)*rx,y=h*.53+Math.sin(a)*ry;c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#efcf86';c.strokeStyle='#3f4a32';c.lineWidth=2;c.beginPath();c.moveTo(12,0);c.lineTo(-7,-8);c.lineTo(-3,0);c.lineTo(-7,8);c.closePath();c.fill();c.stroke();c.restore();c.textAlign='center';c.font='11px Galmuri';c.fillStyle='#f5e6ba';c.fillText(`${Math.round(d/10)}m`,x,y+22);}}
  if(!reduced&&p.hurt>.12){c.fillStyle=p.damageKind==='armor'?`rgba(230,171,65,${p.hurt*.22})`:`rgba(150,45,25,${p.hurt*.3})`;c.fillRect(0,0,w,h);}
  if(lobby){c.fillStyle='#12221fc2';c.fillRect(0,0,w,h);}
  if(!lobby&&s.arrival>0){c.save();c.globalAlpha=Math.min(1,s.arrival);c.fillStyle='#101e2acb';c.fillRect(w*.12,h*.36,w*.76,94);c.textAlign='center';c.font='bold 13px Galmuri';c.fillStyle='#ffce76';c.fillText(`MISSION 0${s.front+1} / ${['COASTLINE','IRON RAIL','NIGHT HARBOR'][s.front]}`,w/2,h*.36+29);c.font='bold 26px Galmuri';c.fillStyle='#fff0c5';c.fillText(FRONTS[s.front].name,w/2,h*.36+65);c.restore();}
  drawMap(s,target);
 }
 function drawMap(s,target){m.clearRect(0,0,map.width,map.height);m.fillStyle='#273831';m.fillRect(0,0,map.width,map.height);m.strokeStyle='#69735b';m.lineWidth=1;m.strokeRect(4,4,map.width-8,map.height-8);const x=v=>(v-FIELD.left)/(FIELD.right-FIELD.left)*map.width,y=v=>(v-FIELD.top)/(FIELD.bottom-FIELD.top)*map.height;
  m.fillStyle='#8d8a68';m.fillRect(x(-170),0,x(170)-x(-170),map.height);
  for(const n of s.sites){m.fillStyle=n.id===target?'#ffd992':n.state==='done'?'#556d56':n.kind==='boss'?'#e59571':'#c1d0b0';m.fillRect(x(n.x)-3,y(n.y)-3,6,6);}
  m.fillStyle='#fff4cf';circle(m,x(s.player.x),y(s.player.y),3,'#fff4cf');
 }
 resize();return{draw,resize};
}
