const artNames=['operators','enemies','vehicles','environment-v014','vehicle-layers-v015'];
export const missionImageUrl=name=>new URL(`../../art/mission/${name}.webp`,import.meta.url).href;
export const MISSION_ART_COUNT=artNames.length;
async function image(name,priority){
 const im=new Image();
 im.fetchPriority=priority;
 im.src=missionImageUrl(name);
 await im.decode();
 return im;
}
function sheet(im,rowCount=4){
 const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;
 const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);
 const cell=Math.floor(im.width/4),stride=cell*4,rows=[];
 const data=c.getImageData(0,0,stride,cell*rowCount).data;
 for(let row=0;row<rowCount;row++){const cells=[];for(let col=0;col<4;col++){
  const start=(row*cell*stride+col*cell)*4+3;
  let left=cell,top=cell,right=0,bottom=0;
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(data[start+(y*stride+x)*4]>70){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  let footX=0,n=0;for(let y=Math.max(top,bottom-10);y<=bottom;y++)for(let x=left;x<=right;x++)if(data[start+(y*stride+x)*4]>70){footX+=x;n++;}
  cells.push({sx:col*cell+left,sy:row*cell+top,w:right-left+1,h:bottom-top+1,left,top,bottom,footX:footX/(n||1)});
 }const feet=cells.map(b=>b.footX).sort((a,b)=>a-b);rows.push({cells,ground:Math.max(...cells.map(b=>b.bottom)),anchor:feet[2],height:Math.max(...cells.map(b=>b.h))});}
 return {image:im,rows,cell};
}
let operatorAtlas=null;
function loadOperators(priority){
 if(!operatorAtlas)operatorAtlas=image('operators',priority).then(im=>sheet(im)).catch(error=>{operatorAtlas=null;throw error;});
 return operatorAtlas;
}
export async function loadOperatorPortrait(){return {operators:await loadOperators('high')};}
export async function loadMissionArt({priority='auto',onProgress}={}){
 let ready=0;
 const [operators,enemies,vehicles,environment,vehicleLayers]=await Promise.all(artNames.map(async(name,index)=>{
  const im=index===0?await loadOperators(priority):await image(name,priority);
  const asset=index===0||index===artNames.length-1?im:sheet(im);
  onProgress?.(++ready);
  return asset;
 }));
 return {operators,enemies,vehicles,environment,vehicleLayers};
}
export async function loadFioPortrait(){
 const atlas=sheet(await image('fio-hangar-v033','high'),1);
 return {operators:{...atlas,rows:[null,null,atlas.rows[0]]}};
}
export function actor(c,atlas,row,frame,x,y,height,mirror=false){const r=atlas.rows[row],b=r.cells[frame%4],scale=height/r.height;c.save();c.translate(Math.round(x),Math.round(y));if(mirror)c.scale(-1,1);c.drawImage(atlas.image,b.sx,b.sy,b.w,b.h,(b.left-r.anchor)*scale,(b.top-r.ground)*scale,b.w*scale,b.h*scale);c.restore();}
export function prop(c,art,row,col,x,y,width,alpha=1){const b=art.vehicles.rows[row].cells[col];c.save();c.globalAlpha*=alpha;c.drawImage(art.vehicles.image,b.sx,b.sy,b.w,b.h,x-width/2,y-b.h/b.w*width,width,b.h/b.w*width);c.restore();}
export function operatorPortrait(canvas,art,hero,height=190){const c=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||200,h=canvas.clientHeight||210;canvas.width=w*dpr;canvas.height=h*dpr;c.scale(dpr,dpr);c.imageSmoothingEnabled=false;actor(c,art.operators,hero==='fio'?2:0,0,w*.45,h*.94,Math.min(height,h*.9));}

export function environmentProp(c,art,row,col,x,y,width,alpha=1){const atlas=art.environment,b=atlas.rows[row].cells[col];c.save();c.globalAlpha*=alpha;c.drawImage(atlas.image,b.sx,b.sy,b.w,b.h,x-width/2,y-b.h/b.w*width,width,b.h/b.w*width);c.restore();}

// Layers keep separate pivots: a tank can steer its hull while aiming its cannon.
export function vehicle(c,art,{x,y,width=120,enemy=false,body=0,turret=0,kick=0,tread=0,moving=false,pitch=0,flash=0,damaged=false,wreck=false,reduced=false}){
 const im=art.vehicleLayers,cell=im.width/2,row=enemy?1:0,scale=width/(cell*(enemy?.9:.76));
 const pivots=enemy?[[.495,.50],[.32,.49]]:[[.5,.52],[.43,.52]];
 c.save();c.translate(x,y);c.fillStyle='#101b2255';c.beginPath();c.ellipse(0,1,width*.52,width*.35,0,0,Math.PI*2);c.fill();
 c.save();c.rotate(body);c.translate((reduced?0:pitch)*width,0);if(damaged)c.filter=wreck?'brightness(.35) saturate(.3)':'brightness(.65) saturate(.6)';
 c.drawImage(im,0,row*cell,cell,cell,-pivots[0][0]*cell*scale,-pivots[0][1]*cell*scale,cell*scale,cell*scale);
 if(moving){c.fillStyle='#17212690';for(const side of [-1,1])for(let i=-3;i<=3;i++){const tx=((i*13+tread*.7)%84+84)%84-42;c.fillRect(tx,side*width*.29-2,5,4);}if(!reduced){c.fillStyle='#cec1a15a';for(const side of [-1,1])for(let i=0;i<3;i++)c.fillRect(-width*.5-i*7,side*width*.26+Math.sin(tread*.11+i)*5,10-i*2,6-i);}}
 c.restore();
 c.save();c.translate(wreck?width*.08:0,wreck?-5:-15);c.rotate(turret+(wreck?.18:0));c.translate(reduced?0:-kick*width*.06,0);if(damaged)c.filter=wreck?'brightness(.4) saturate(.3)':'brightness(.75) saturate(.6)';
 c.drawImage(im,cell,row*cell,cell,cell,-pivots[1][0]*cell*scale,-pivots[1][1]*cell*scale,cell*scale,cell*scale);
 if(flash>0){c.translate(width*(enemy?.68:.54),0);c.fillStyle='#ffe9a1';c.beginPath();c.moveTo(-5,-8);c.lineTo(25,0);c.lineTo(-5,8);c.fill();}c.restore();c.restore();
}
