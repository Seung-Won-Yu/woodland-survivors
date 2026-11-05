const image=async name=>{const im=new Image();im.src=new URL(`../../art/mission/${name}.png`,import.meta.url).href;await im.decode();return im;};
function sheet(im){
 const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);const cell=Math.floor(im.width/4),rows=[];
 for(let row=0;row<4;row++){const cells=[];for(let col=0;col<4;col++){const data=c.getImageData(col*cell,row*cell,cell,cell).data;let left=cell,top=cell,right=0,bottom=0;
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(data[(y*cell+x)*4+3]>70){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  let footX=0,n=0;for(let y=Math.max(top,bottom-10);y<=bottom;y++)for(let x=left;x<=right;x++)if(data[(y*cell+x)*4+3]>70){footX+=x;n++;}
  cells.push({sx:col*cell+left,sy:row*cell+top,w:right-left+1,h:bottom-top+1,left,top,bottom,footX:footX/(n||1)});
 }const feet=cells.map(b=>b.footX).sort((a,b)=>a-b);rows.push({cells,ground:Math.max(...cells.map(b=>b.bottom)),anchor:feet[2],height:Math.max(...cells.map(b=>b.h))});}
 return {image:im,rows,cell};
}
export async function loadMissionArt(){const [operators,enemies,vehicles,environment]=await Promise.all(['operators','enemies','vehicles','environment-v014'].map(image));return{operators:sheet(operators),enemies:sheet(enemies),vehicles:sheet(vehicles),environment:sheet(environment)};}
export function actor(c,atlas,row,frame,x,y,height,mirror=false){const r=atlas.rows[row],b=r.cells[frame%4],scale=height/r.height;c.save();c.translate(Math.round(x),Math.round(y));if(mirror)c.scale(-1,1);c.drawImage(atlas.image,b.sx,b.sy,b.w,b.h,(b.left-r.anchor)*scale,(b.top-r.ground)*scale,b.w*scale,b.h*scale);c.restore();}
export function prop(c,art,row,col,x,y,width,alpha=1){const b=art.vehicles.rows[row].cells[col];c.save();c.globalAlpha*=alpha;c.drawImage(art.vehicles.image,b.sx,b.sy,b.w,b.h,x-width/2,y-b.h/b.w*width,width,b.h/b.w*width);c.restore();}
export function operatorPortrait(canvas,art,hero,height=190){const c=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||200,h=canvas.clientHeight||210;canvas.width=w*dpr;canvas.height=h*dpr;c.scale(dpr,dpr);c.imageSmoothingEnabled=false;actor(c,art.operators,hero==='fio'?2:0,0,w*.45,h*.94,Math.min(height,h*.9));}

export function environmentProp(c,art,row,col,x,y,width,alpha=1){const atlas=art.environment,b=atlas.rows[row].cells[col];c.save();c.globalAlpha*=alpha;c.drawImage(atlas.image,b.sx,b.sy,b.w,b.h,x-width/2,y-b.h/b.w*width,width,b.h/b.w*width);c.restore();}
