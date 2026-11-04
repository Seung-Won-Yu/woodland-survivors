// Raster atlas cells can contain a neighbouring row's stray toes or cape pixels.
// Keep the actor's connected silhouette plus its antialiased edge, without redrawing it.
export function isolateActorPixels(data,width,height){
  const count=width*height,labels=new Int32Array(count),queue=new Int32Array(count);let label=0,best=0,bestSize=0;
  for(let index=0;index<count;index++){
    if(labels[index]||data[index*4+3]<=80)continue;
    label++;let head=0,tail=1;queue[0]=index;labels[index]=label;
    while(head<tail){const at=queue[head++],x=at%width,y=Math.floor(at/width);
      for(const next of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1]){
        if(next<0||labels[next]||data[next*4+3]<=80)continue;labels[next]=label;queue[tail++]=next;
      }
    }
    if(tail>bestSize){bestSize=tail;best=label;}
  }
  const keep=new Uint8Array(count);
  for(let at=0;at<count;at++)if(labels[at]===best&&best){const x=at%width,y=Math.floor(at/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height)keep[ny*width+nx]=1;}}
  const result=new Uint8ClampedArray(data);
  for(let at=0;at<count;at++)if(!keep[at])result[at*4+3]=0;
  return result;
}
