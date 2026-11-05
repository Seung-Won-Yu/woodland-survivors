import {clamp} from './content.js';
export const turnToward=(from,to,step)=>from+clamp(Math.atan2(Math.sin(to-from),Math.cos(to-from)),-step,step);
export const vehicleMotion=(angle=-Math.PI/2)=>({vx:0,vy:0,bodyAngle:angle,kick:0,tread:0,pitch:0,flash:0});
// Integrate a trapezoid: .16s acceleration + .64s cruise + .16s braking.
// The 376px travel and 470px/s maximum match the original attack's reach/speed.
export function carrierTravel(t){t=clamp(t,0,.96);if(t<.16)return 470*t*t/.32;if(t<.8)return 37.6+470*(t-.16);const u=t-.8;return 338.4+470*(u-u*u/.32);}
export function drivePlayer(p,dt,{x,y,force}){
 const before=Math.hypot(p.vx,p.vy),speed=p.dash>0?670:175,tx=x*speed*force,ty=y*speed*force;
 if(p.dash>0){p.vx=tx;p.vy=ty;}else{const dx=tx-p.vx,dy=ty-p.vy,d=Math.hypot(dx,dy),rate=force>.05?950:1400,k=Math.min(1,rate*dt/(d||1));p.vx+=dx*k;p.vy+=dy*k;}
 const moved=Math.hypot(p.vx,p.vy)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.walk+=moved;p.tread+=moved;p.moving=moved>.02;
 if(Math.hypot(p.vx,p.vy)>12)p.bodyAngle=turnToward(p.bodyAngle,Math.atan2(p.vy,p.vx),5.5*dt);
 const target=clamp((before-Math.hypot(p.vx,p.vy))*.002,-.09,.09);p.pitch+=(target-p.pitch)*Math.min(1,dt*12);
}
