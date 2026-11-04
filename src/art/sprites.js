// The frame atlas is assembled from the reference-based PNG sheets in illustrated.js.
// Lower-body walking remains independent while the upper body attacks or recoils.
export function drawHero(c,atlas,id,dir,frame,x,y,size=160,legFrame=frame,upperOffset={x:0,y:0},legDir=dir){
  const row=['south','east','north','west'].indexOf(dir),cell=atlas.spriteCell,pivot=atlas.pivot,cut=Math.round(cell*.75);
  const dx=Math.round(x-pivot.x*size/cell),dy=Math.round(y-pivot.y*size/cell),sy=(id*4+row)*cell,legSy=(id*4+['south','east','north','west'].indexOf(legDir))*cell;
  if(frame===legFrame&&dir===legDir&&!upperOffset.x&&!upperOffset.y)c.drawImage(atlas,frame*cell,sy,cell,cell,dx,dy,size,size);
  else{
    // Keep the long tail and equipment intact; replace only the leg region.
    const lx=dx+size*.28,ly=dy+size*cut/cell,lw=size*.44,lh=size*(cell-cut)/cell;
    c.save();c.beginPath();c.rect(dx-4,dy-4,size+8,size+8);c.rect(lx,ly,lw,lh+4);c.clip('evenodd');
    c.drawImage(atlas,frame*cell,sy,cell,cell,dx+upperOffset.x,dy+upperOffset.y,size,size);c.restore();
    c.save();c.beginPath();c.rect(lx,ly,lw,lh+4);c.clip();c.drawImage(atlas,legFrame*cell,legSy,cell,cell,dx,dy,size,size);c.restore();
  }
}
