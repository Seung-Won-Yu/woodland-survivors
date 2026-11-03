export const CELL=80, PIVOT={x:40,y:70}, STRIDE=48;
export function facing(x,y){return Math.abs(y)>Math.abs(x)?(y<0?'north':'south'):(x<0?'west':'east');}
// One shared hand/muzzle contract for the rendered weapon and real projectiles.
export function weaponPose(p,angle=p.aim??Math.atan2(p.fy,p.fx)){
  const recoil=p.attack>.095?3:0,reach=30-recoil;
  return {angle,handX:p.x+Math.cos(angle)*12,handY:p.y-24+Math.sin(angle)*12,
    x:p.x+Math.cos(angle)*reach,y:p.y-24+Math.sin(angle)*reach,recoil};
}
export function walkPose(distance=0){
  const frame=((Math.floor(distance/STRIDE*8)%8)+8)%8,phase=frame*Math.PI/4;
  // Grounded foot moves backward relative to the body; the other lifts and swings.
  const foot=offset=>{const t=(frame/8+offset)%1,contact=t<.5;return {x:contact?12-t*48:-12+(t-.5)*48,lift:contact?0:Math.sin((t-.5)*Math.PI*2)*6,contact};};
  return {frame,phase,left:foot(0),right:foot(.5),bob:Math.abs(Math.sin(phase))*1.5,tail:Math.sin(phase-Math.PI/2)*3};
}
