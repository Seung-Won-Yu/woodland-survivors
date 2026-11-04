export const CELL=80, PIVOT={x:40,y:70}, STRIDE=64;
export function facing(x,y){return Math.abs(y)>Math.abs(x)?(y<0?'north':'south'):(x<0?'west':'east');}
// One shared hand/muzzle contract for the rendered weapon and real projectiles.
export function weaponPose(p,angle=p.aim??Math.atan2(p.fy,p.fx)){
  const recoil=p.attack>.095?3:0,reach=30-recoil;
  const x=p.x+Math.cos(angle)*reach,y=p.y+Math.sin(angle)*reach;
  return {angle,handX:p.x+Math.cos(angle)*12,handY:p.y-24+Math.sin(angle)*12,
    x,y,drawX:x,drawY:y-24,recoil};
}
export function walkPose(distance=0){
  const frame=((Math.floor(distance/STRIDE*8)%8)+8)%8,phase=frame*Math.PI/4;
  // Grounded foot moves backward relative to the body; the other lifts and swings.
  const foot=offset=>{const t=(frame/8+offset)%1,contact=t<.5;return {x:contact?16-t*64:-16+(t-.5)*64,lift:contact?0:Math.sin((t-.5)*Math.PI*2)*6,contact};};
  return {frame,phase,left:foot(0),right:foot(.5),bob:Math.abs(Math.sin(phase))*1.5,tail:Math.sin(phase-Math.PI/2)*3};
}
export function animationState(p){
  const moveDir=facing(p.fx,p.fy),aim=p.aim??Math.atan2(p.fy,p.fx),aimDir=facing(Math.cos(aim),Math.sin(aim));
  const legFrame=p.moving?walkPose(p.walk).frame:8;
  let frame=legFrame;
  if(p.attackWindup>0)frame=12;else if(p.attack>0)frame=p.attack>.14?9:10;
  if(p.hurt>.22)frame=11;
  const attacking=p.attackWindup>0||p.attack>0,dir=attacking||!p.moving?aimDir:moveDir;
  return {frame,legFrame:p.moving?legFrame:frame,dir,legDir:p.moving?moveDir:dir,aim};
}
