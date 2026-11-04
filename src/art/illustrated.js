// Original reference-based image assets. No single-pose cutout is used as a walk cycle.
import {isolateActorPixels} from './frame-mask.js';
export const ART_CELL=160, ART_PIVOT={x:80,y:144};
const HEIGHTS=[89,101,80,94,77,87];
const loadImage=async path=>{const image=new Image();image.src=path;await image.decode();return image;};
function bounds(context,x,y,w,h){
  const data=context.getImageData(x,y,w,h).data;let left=w,top=h,right=0,bottom=0;
  for(let py=0;py<h;py++)for(let px=0;px<w;px++)if(data[(py*w+px)*4+3]>80){left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
  let footX=0,footN=0;for(let py=Math.max(top,bottom-8);py<=bottom;py++)for(let px=left;px<=right;px++)if(data[(py*w+px)*4+3]>80){footX+=px;footN++;}
  return {x:x+left,y:y+top,w:right-left+1,h:bottom-top+1,localX:left,localY:top,bottom,footX:footX/(footN||1)};
}
function sheet(image,cols,rows,isolate=false){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
  const w=Math.floor(image.width/cols),h=Math.floor(image.height/rows),cells=[];
  for(let row=0;row<rows;row++){cells[row]=[];for(let col=0;col<cols;col++){
    if(isolate){const pixels=c.getImageData(col*w,row*h,w,h);pixels.data.set(isolateActorPixels(pixels.data,w,h));c.putImageData(pixels,col*w,row*h);}
    cells[row][col]=bounds(c,col*w,row*h,w,h);
  }}
  return {image:canvas,cols,rows,w,h,cells};
}
export async function loadIllustratedArt(){
  const names=['party-walk-side','party-walk-front-back','party-combat','party-combat-back','forest-atlas','forest-props','enemy-motion','camp-reference'];
  const images=await Promise.all(names.map(name=>loadImage(new URL(`../../art/v2/${name}.png`,import.meta.url).href)));
  const source=Object.fromEntries(names.map((name,i)=>[name,images[i]]));
  const side=sheet(source['party-walk-side'],8,6,true),vertical=sheet(source['party-walk-front-back'],8,6,true),combat=sheet(source['party-combat'],8,6,true);
  const rear=sheet(source['party-combat-back'],4,6,true);
  // The repaired cutout sheet preserves the original atlas's empty top band.
  const props=sheet(source['forest-props'],6,4),enemies=sheet(source['enemy-motion'],8,4,true);props.cells=props.cells.slice(1);props.rows=3;
  const atlas=document.createElement('canvas');atlas.width=ART_CELL*13;atlas.height=ART_CELL*24;atlas.spriteCell=ART_CELL;atlas.pivot=ART_PIVOT;
  const c=atlas.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  for(let hero=0;hero<6;hero++){
    const reference=side.cells[hero][1],scale=HEIGHTS[hero]/reference.h;
    // Match each drawing's hip/ground anchor without stretching it to a new bounding box.
    for(let dir=0;dir<4;dir++)for(let frame=0;frame<13;frame++){
      const verticalView=dir===0||dir===2,back=dir===2,mirror=dir===3;let sourceSheet=side,col=0;
      if(frame<8){sourceSheet=verticalView?vertical:side;col=verticalView?(back?4:0)+Math.floor(frame/2):frame;}
      else if(frame===8){sourceSheet=verticalView?vertical:side;col=verticalView?(back?4:0):1;}
      else if(back){sourceSheet=rear;col=frame===9?1:frame===10?2:frame===11?3:0;}
      else{sourceSheet=combat;col=(dir===0?4:0)+(frame===9?1:frame===10?2:frame===11?3:0);}
      const b=sourceSheet.cells[hero][col];
      const groupStart=sourceSheet===vertical?(back?4:0):sourceSheet===combat&&dir===0?4:0;
      const group=sourceSheet.cells[hero].slice(groupStart,groupStart+(sourceSheet===side?8:4));
      const rowMedianHeight=sourceSheet===side?reference.h:group[0].h;
      const localScale=HEIGHTS[hero]/rowMedianHeight;
      const ground=Math.max(...group.map(b=>b.bottom));
      const feet=group.map(b=>b.footX).sort((a,b)=>a-b),anchorX=feet[Math.floor(feet.length/2)];
      const drawX=ART_PIVOT.x+(b.localX-anchorX)*localScale,drawY=ART_PIVOT.y+(b.localY-ground)*localScale;
      c.save();c.translate(frame*ART_CELL,(hero*4+dir)*ART_CELL);c.beginPath();c.rect(0,0,ART_CELL,ART_CELL);c.clip();if(mirror){c.translate(ART_CELL,0);c.scale(-1,1);}
      c.drawImage(sourceSheet.image,b.x,b.y,b.w,b.h,drawX,drawY,b.w*localScale,b.h*localScale);c.restore();
    }
  }
  atlas.portraitBounds=Array.from({length:6},(_,hero)=>bounds(c,8*ART_CELL,(hero*4+1)*ART_CELL,ART_CELL,ART_CELL));
  const textures={};
  for(const [name,col] of [['grass',0],['dirt',1],['moss',2],['leaf',3]]){
    const tile=document.createElement('canvas');tile.width=256;tile.height=256;const t=tile.getContext('2d');t.fillStyle=name==='dirt'?'#92734b':'#68704b';t.fillRect(0,0,256,256);t.drawImage(source['forest-atlas'],col*256+12,12,232,232,0,0,256,256);
    t.fillStyle=name==='dirt'?'#8e79551b':'#66734b66';t.fillRect(0,0,256,256);textures[name]=tile;
  }
  return {atlas,props,enemies,textures,camp:source['camp-reference'],source};
}
export function drawProp(c,art,row,col,x,y,width,alpha=1){
  const b=art.props.cells[row][col],height=width*b.h/b.w;c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;c.drawImage(art.props.image,b.x,b.y,b.w,b.h,Math.round(x-width/2),Math.round(y-height),width,height);c.restore();
}
export function drawIllustratedEnemy(c,art,e){
  const row=['beetle','warden'].includes(e.type)?3:e.type==='spore'?2:e.type==='runner'?1:0;
  let frame=Math.floor((e.walk||0)/9)%6;
  if(row===1){frame=Math.floor((e.walk||0)/11)%4;if(e.mode==='windup')frame=4;else if(e.mode==='charge')frame=5+Math.floor(e.age*13)%2;else if(e.mode==='recover')frame=7;}
  if(row===2){frame=Math.floor((e.walk||0)/13)%4;if(e.mode==='windup')frame=e.windup>.3?4:5;else if(e.mode==='recover')frame=e.recover>.2?6:7;}
  if(e.hurt>.07&&(row===0||row===3))frame=6;
  else if(row===3&&e.mode==='windup')frame=4;
  if(e.dead&&(row===0||row===3))frame=7;
  const b=art.enemies.cells[row][frame],ref=art.enemies.cells[row][0],height=e.bossRole==='midpoint'?118:e.type==='king'?152:e.type==='elite'?92:e.type==='warden'?59:row===3?51:row===2?64:58;
  const scale=height/ref.h,w=b.w*scale,h=b.h*scale,ground=Math.max(...art.enemies.cells[row].slice(0,6).map(b=>b.bottom));
  c.save();c.translate(e.x,e.y);if((e.fx||1)<0)c.scale(-1,1);if(e.hurt>0){c.filter='brightness(1.65)';c.transform(1,0,-.08,.95,0,0);}
  c.imageSmoothingEnabled=true;c.drawImage(art.enemies.image,b.x,b.y,b.w,b.h,(b.localX-art.enemies.w/2)*scale,(b.localY-ground)*scale,w,h);
  if(e.type==='warden'){c.strokeStyle='#dfd3a2';c.lineWidth=2;c.beginPath();c.moveTo(-9,-39);c.quadraticCurveTo(0,-54,11,-40);c.moveTo(0,-48);c.lineTo(0,-31);c.stroke();}
  if(e.type==='elite'||e.type==='king'){
    c.fillStyle=e.bossPhase===2?'#d9956f':'#d9b970';c.beginPath();c.moveTo(-12,-height+8);c.lineTo(-15,-height-5);c.lineTo(-5,-height);c.lineTo(0,-height-10);c.lineTo(5,-height);c.lineTo(15,-height-5);c.lineTo(12,-height+8);c.fill();
  }
  c.restore();
}
