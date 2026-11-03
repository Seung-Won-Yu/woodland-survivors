import {CELL,PIVOT,STRIDE,walkPose} from '../game/motion.js';
const INK='#302c2a',CREAM='#f4dfb8';
const COLORS=[
  ['#c7733e','#efad62','#597552','#8c4b2d'],['#d9d5bd','#fff1d2','#42828a','#a99b85'],
  ['#ba9b71','#e9cca2','#6a7850','#6f4938'],['#cd7545','#f1a260','#964e50','#843e2f'],
  ['#80717d','#ac9199','#b08a45','#504851'],['#95674d','#c69b70','#3f7b7c','#604837']
];
function tools(c){return {
  r:(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));},
  p:(pts,color)=>{c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();},
  line:(pts,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='butt';c.lineJoin='miter';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.stroke();}
};}
function hero(c,id,dir,frame){
  const {r,p,line}=tools(c),[fur,light,coat,shade]=COLORS[id];
  const moving=frame<8,pose=walkPose(moving?frame*STRIDE/8:0),bob=moving?Math.round(pose.bob):0;
  const side=dir==='east'||dir==='west',back=dir==='north';
  c.save();if(dir==='west'){c.translate(80,0);c.scale(-1,1);}
  const hurt=frame===11,attacking=frame===9||frame===10;
  const lean=hurt?-3:attacking?1:0;
  const hx=40+lean,hy=30-bob;
  // Species silhouette is drawn separately from coat and common equipment.
  if(id===0){
    const sway=moving?pose.tail:0;
    p([[30,59],[18,60],[10+sway,52],[7+sway,37],[9+sway,23],[16+sway,15],[27+sway,16],[32+sway,25],[29+sway,36],[22+sway,42],[23+sway,49],[33,51]],INK);
    p([[28,56],[19,56],[13+sway,49],[11+sway,36],[13+sway,25],[18+sway,19],[26+sway,20],[28+sway,26],[25+sway,33],[18+sway,37],[17+sway,47],[24,52]],fur);
    line([[16+sway,50],[14+sway,37],[18+sway,27],[25+sway,26]],light,3);line([[24+sway,21],[19+sway,22],[14+sway,29]],shade,3);
  }
  if(id===2){
    const quills=[[18,23],[23,14],[28,20],[30,10],[36,19],[40,12],[46,22],[52,19],[56,29],[61,32],[58,48],[51,59],[25,57],[17,44]];
    p(quills,INK);p(quills.map(([x,y])=>[x+(x<38?3:-3),y+3]),shade);
    for(let i=0;i<7;i++)p([[20+i*5,28+(i%2)*5],[22+i*5,19+(i%2)*5],[28+i*4,34+(i%2)*5]],i%2?'#b58b63':'#896346');
  }
  if(id===3||id===5){
    const t=pose.tail;
    p([[34,54],[26,58],[17,62+t],[7,61+t],[4,56+t],[14,48+t],[23,48],[31,48]],INK);
    p([[31,54],[23,57],[15,59+t],[8,58+t],[15,52+t],[24,51]],fur);
    if(id===3)p([[7,58+t],[14,52+t],[18,52+t],[15,57+t],[15,59+t]],CREAM);
  }
  // Two actual joint chains. A grounded foot has no vertical lift.
  for(let i=0;i<2;i++){
    const f=moving?(i?pose.right:pose.left):{x:i?2:-2,lift:0};
    const hip=side?(i?45:34):(i?48:31),footX=hip+(side?f.x:Math.round(f.x*.15)),footY=side?69-f.lift:66+(back?-f.x:f.x)-f.lift;
    const kneeX=(hip+footX)/2,kneeY=(50+footY)/2;
    p([[hip-4,49],[hip+5,49],[kneeX+4,kneeY],[footX+5,footY-4],[footX+7,footY],[footX-6,footY],[footX-5,footY-5],[kneeX-4,kneeY+2]],INK);
    p([[hip-2,51],[hip+3,51],[kneeX+2,kneeY],[footX+2,footY-5],[footX-3,footY-4],[kneeX-2,kneeY+1]],fur);
    p([[footX-5,footY-6],[footX+3,footY-7],[footX+7,footY-2],[footX+7,footY],[footX-5,footY]],id===1?shade:'#664b39');
    r(footX-3,footY-3,8,1,id===1?light:'#997350');
  }
  // Torso: shaded tunic, lapels, straps, belt and pouches.
  p([[29,36-bob],[45,34-bob],[53,42-bob],[52,57-bob],[43,61-bob],[29,59-bob],[25,49-bob]],INK);
  p([[30,38-bob],[44,37-bob],[50,43-bob],[49,55-bob],[42,58-bob],[29,56-bob],[28,48-bob]],coat);
  p([[31,39-bob],[36,42-bob],[35,56-bob],[30,54-bob]],'#ffffff1c');
  if(!back){p([[36,37-bob],[42,38-bob],[43,53-bob],[35,53-bob]],CREAM);r(28,53-bob,23,4,shade);r(39,53-bob,6,5,'#d7ad61');r(41,54-bob,2,3,INK);}
  if(back||side){
    p([[25,36-bob],[35,36-bob],[39,42-bob],[37,56-bob],[26,56-bob],[22,50-bob]],INK);
    p([[26,38-bob],[34,38-bob],[36,43-bob],[34,53-bob],[26,53-bob],[25,48-bob]],'#8e704c');
    r(25,40-bob,11,3,'#b59b66');r(26,46-bob,8,2,'#604c36');r(27,49-bob,7,2,'#604c36');
    if(id===0)for(let j=0;j<3;j++){r(26+j*3,36-bob,3,4,'#c58d45');r(26+j*3,35-bob,3,2,'#6f4e30');}
  }
  if(id===3){p([[28,33-bob],[45,33-bob],[50,46-bob],[45,53-bob],[29,48-bob],[23,51-bob]],'#713c43');line([[29,35-bob],[34,46-bob],[46,49-bob]],'#b66e5a');}
  const ay=attacking?(frame===9?43:46):47-bob+(moving?Math.round(Math.sin(pose.phase)*2):0);
  if(side){p([[48,39-bob],[54,42-bob],[56,ay],[52,ay+6],[47,ay+3],[45,44-bob]],INK);p([[49,41-bob],[52,43-bob],[53,ay],[51,ay+3],[48,ay+1]],fur);}
  else if(!back){p([[47,40-bob],[51,45-bob],[47,53],[43,59],[37,58],[38,53],[44,48],[44,43-bob]],INK);p([[47,43-bob],[48,46-bob],[44,52],[42,56],[39,56],[40,54],[46,47]],fur);}
  // Ears have their own delayed motion and are not a translated full image.
  if(id===1){
    const lag=moving?Math.round(Math.sin(pose.phase-.8)*2):0;
    p([[31,26-bob],[25+lag,10-bob],[27+lag,2],[33+lag,4],[38,24-bob]],INK);
    p([[32,23-bob],[28+lag,10-bob],[29+lag,5],[32+lag,7],[35,24-bob]],light);
    line([[30+lag,8],[33,22-bob]],'#d29c91',2);
    p([[41,23-bob],[44-lag,5],[49-lag,3],[53-lag,9],[48,27-bob]],INK);p([[44,24-bob],[46-lag,8],[49-lag,7],[50-lag,11],[46,25-bob]],light);
  }else if(id===0||id===3){
    p([[30,27-bob],[29,13-bob],[35,16-bob],[39,26-bob]],INK);p([[32,25-bob],[32,17-bob],[35,20-bob],[36,26-bob]],light);
    p([[44,25-bob],[47,13-bob],[52,23-bob],[51,29-bob]],INK);p([[46,25-bob],[48,18-bob],[50,24-bob]],'#d39b83');
  }else if(id!==4){r(29,21-bob,8,8,INK);r(31,22-bob,5,5,light);r(46,21-bob,7,8,INK);r(47,23-bob,4,4,light);}
  // Angular face and muzzle, distinct front/back/side drawings.
  p([[31+lean,24-bob],[42+lean,20-bob],[51+lean,24-bob],[54+lean,33-bob],[50+lean,39-bob],[37+lean,42-bob],[29+lean,35-bob],[27+lean,29-bob]],INK);
  p([[32+lean,25-bob],[42+lean,23-bob],[49+lean,26-bob],[51+lean,33-bob],[47+lean,37-bob],[37+lean,39-bob],[31+lean,34-bob],[30+lean,29-bob]],fur);
  p([[32+lean,26-bob],[41+lean,24-bob],[46+lean,26-bob],[38+lean,29-bob],[32+lean,31-bob]],light);
  if(!back){
    if(side){
      p([[42+lean,32-bob],[51+lean,31-bob],[58+lean,34-bob],[55+lean,38-bob],[43+lean,38-bob],[39+lean,35-bob]],CREAM);
      r(55+lean,33-bob,4,3,id===4?'#da9a97':INK);r(47+lean,27-bob,4,6,INK);r(47+lean,27-bob,2,2,'#fff5d9');r(45+lean,26-bob,6,2,shade);
    }else{
      p([[33+lean,33-bob],[49+lean,33-bob],[50+lean,37-bob],[42+lean,40-bob],[33+lean,37-bob]],CREAM);
      r(33+lean,28-bob,3,5,INK);r(46+lean,28-bob,3,5,INK);r(33+lean,28-bob,1,1,'#fff');r(46+lean,28-bob,1,1,'#fff');r(39+lean,34-bob,4,3,INK);
    }
  }else{p([[31,33-bob],[38,36-bob],[48,34-bob],[46,39-bob],[36,40-bob]],shade);}
  // Personal gear remains readable when equipping another shared weapon.
  if(id===1){p([[28,36-bob],[48,36-bob],[49,41-bob],[35,42-bob],[28,40-bob]],'#3c6d78');p([[28,39-bob],[22,42-bob],[14,41-bob],[18,46-bob],[28,44-bob]],'#407e87');r(29,36-bob,17,2,'#6caaa8');}
  if(id===2){p([[20,46],[28,41],[34,45],[33,58],[27,64],[20,58]],INK);p([[22,47],[28,44],[31,47],[30,57],[27,61],[23,56]],'#7c924c');line([[27,47],[27,58]],'#c4ba70',2);}
  if(id===4){p([[27,25-bob],[28,18-bob],[34,14-bob],[46,15-bob],[51,22-bob],[54,24-bob],[53,28-bob],[26,28-bob]],INK);p([[29,24-bob],[30,19-bob],[35,17-bob],[44,18-bob],[48,24-bob]],'#bc9148');r(36,15-bob,8,10,'#5d513c');r(38,17-bob,5,5,'#f6d48a');r(39,18-bob,2,2,'#fff4c8');r(48,44-bob,9,7,'#bb9050');r(49,45-bob,6,2,'#ddba70');}
  if(id===5){r(29,36-bob,20,4,'#d9c8a0');r(32,37-bob,4,4,coat);r(43,37-bob,4,4,coat);r(27,51-bob,6,9,INK);r(28,53-bob,4,5,'#9ac7a2');r(29,54-bob,2,2,'#ecdc82');}
  c.restore();
}
export function createSprites(){
  const atlas=document.createElement('canvas');atlas.width=CELL*12;atlas.height=CELL*24;
  const c=atlas.getContext('2d');c.imageSmoothingEnabled=false;
  for(let id=0;id<6;id++)for(const [d,dir] of ['south','east','north','west'].entries())for(let f=0;f<12;f++){
    c.save();c.translate(f*CELL,(id*4+d)*CELL);hero(c,id,dir,f);c.restore();
  }
  return atlas;
}
export function drawHero(c,atlas,id,dir,frame,x,y,size=80,legFrame=frame){
  const row=['south','east','north','west'].indexOf(dir);
  const dx=Math.round(x-PIVOT.x*size/CELL),dy=Math.round(y-PIVOT.y*size/CELL),sy=(id*4+row)*CELL;
  if(frame===legFrame)c.drawImage(atlas,frame*CELL,sy,CELL,CELL,dx,dy,size,size);
  else{
    c.drawImage(atlas,frame*CELL,sy,CELL,53,dx,dy,size,size*53/CELL);
    c.drawImage(atlas,legFrame*CELL,sy+53,CELL,27,dx,dy+size*53/CELL,size,size*27/CELL);
  }
}
export function drawEnemy(c,e){
  const {r,p,line}=tools(c),scale=e.type==='king'?2.5:e.type==='elite'?1.55:e.type==='beetle'?1.1:.9;
  c.save();c.translate(Math.round(e.x),Math.round(e.y));c.scale(scale,scale);
  const walk=walkPose((e.walk||0)*1.2),wind=e.mode==='windup',charge=e.mode==='charge',recover=e.mode==='recover';
  const bob=Math.round(walk.bob),squash=wind?5:recover?2:0,lean=charge?6:0;
  c.fillStyle='#172d2866';c.beginPath();c.ellipse(0,-1,17,6,0,0,Math.PI*2);c.fill();
  for(let i=0;i<2;i++){const f=i?walk.right:walk.left,x=(i?8:-9)+(e.type==='beetle'?0:f.x*.4);r(x-3,-9-f.lift/2,7,10-f.lift/2,INK);r(x-2,-4-f.lift/2,7,3,'#927a51');}
  if(e.hurt>0){c.filter='brightness(1.55)';c.transform(1,0,-Math.sign(e.kx||1)*.12,.91,0,0);}
  if(e.type==='beetle'){
    for(let i=0;i<3;i++){line([[-14,-8-i*6],[-23,-5-i*5+Math.sin(walk.phase+i)*3]],INK,3);line([[14,-8-i*6],[23,-5-i*5-Math.sin(walk.phase+i)*3]],INK,3);}
    p([[-17,-11],[-20,-25],[-12,-38],[3,-42],[17,-34],[21,-20],[14,-8],[-4,-5]],INK);p([[-14,-13],[-17,-25],[-10,-35],[3,-38],[14,-31],[17,-20],[11,-11],[-3,-8]],'#46766e');line([[0,-36],[-1,-10]],'#253f3c',3);p([[-11,-30],[-7,-34],[-6,-17],[-10,-16]],'#739787');r(9,-15,4,3,'#d5c77a');
  }else if(e.type==='spore'){
    const puff=wind?Math.round((.7-e.windup)*7):0;
    p([[-13-puff,-8],[-16-puff,-25],[-12,-40],[0,-45],[13,-39],[18+puff,-24],[13+puff,-7],[3,-4]],INK);
    p([[-10-puff,-10],[-13-puff,-24],[-9,-37],[0,-41],[10,-36],[14+puff,-24],[10+puff,-10],[2,-8]],wind?'#b28aaf':'#846889');
    r(-13-puff,-30,27+puff*2,4,'#b490b1');r(-7,-25,4,5,'#eee0b2');r(6,-25,4,5,'#eee0b2');p([[-3,-18],[3,-18],[6,-13],[0,-10],[-5,-13]],wind?'#f4ccdb':INK);
    for(let i=0;i<3;i++){r(-9+i*8,-35+(i%2)*3,3,3,'#d6b6c6');}
  }else{
    const runner=e.type==='runner',elite=e.type==='elite'||e.type==='king',cap=runner?'#b49142':elite?'#a35e50':'#aa715e';
    const yy=-bob+squash;
    p([[-11,-7+yy],[-12,-25+yy],[10,-25+yy],[13,-9+yy],[6,-4+yy],[-6,-4+yy]],INK);p([[-8,-9+yy],[-9,-23+yy],[8,-23+yy],[10,-10+yy],[5,-7+yy],[-5,-7+yy]],'#d4c398');r(-5,-19+yy,3,4,INK);r(5,-19+yy,3,4,INK);
    p([[-23+lean,-23+yy],[-20+lean,-34+yy],[-11+lean,-43+yy],[2+lean,-46+yy],[15+lean,-39+yy],[23+lean,-30+yy],[24+lean,-22+yy],[11+lean,-19+yy],[-12+lean,-20+yy]],INK);
    p([[-20+lean,-25+yy],[-17+lean,-33+yy],[-10+lean,-39+yy],[2+lean,-42+yy],[13+lean,-36+yy],[19+lean,-29+yy],[20+lean,-24+yy],[9+lean,-23+yy],[-10+lean,-23+yy]],cap);
    p([[-15+lean,-32+yy],[-10+lean,-37+yy],[-4+lean,-36+yy],[-4+lean,-31+yy]],'#e0c28c');p([[5+lean,-38+yy],[10+lean,-35+yy],[9+lean,-30+yy],[4+lean,-31+yy]],'#e0c28c');r(12+lean,-28+yy,5,3,'#dbc38e');
    line([[-18+lean,-25+yy],[-5+lean,-24+yy],[10+lean,-25+yy]],'#d79a76',2);
    if(runner){p([[-4+lean,-43+yy],[0+lean,-52+yy],[6+lean,-43+yy]],INK);r(-1+lean,-47+yy,4,5,'#dac361');}
    if(elite){p([[-11,-43],[-14,-55],[-5,-51],[0,-58],[5,-50],[13,-53],[10,-42]],INK);p([[-9,-45],[-10,-51],[-4,-48],[0,-54],[4,-47],[10,-50],[8,-44]],'#d3b06a');}
    if(wind){r(-7,-17+yy,4,2,'#f6e4ac');r(5,-17+yy,4,2,'#f6e4ac');}
  }
  if(e.hurt>0){p([[-9,-29],[-4,-33],[-1,-28],[5,-29],[1,-23],[3,-20],[-4,-23]],'#fff1c7');}
  c.restore();
}
