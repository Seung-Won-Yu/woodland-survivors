import {FIELD,clamp,rayBoxDistance} from './content.js';

export const COAST_CHARGE={warning:.9,duration:.8,distance:300,recover:2.4,trackBonus:.6,impactBonus:.6,rearDot:-.35};
const CLEARANCE=.04;

// The first fifth ramps up the tracks. The full .8 seconds still covers 300.
export function coastTravel(elapsed,linear=false){
 const p=clamp(elapsed/COAST_CHARGE.duration,0,1),ramp=.2;
 if(linear)return COAST_CHARGE.distance*p;
 return COAST_CHARGE.distance*(p<ramp?p*p/(2*ramp):p-ramp/2)/(1-ramp/2);
}
export function planCoastCharge(s,offset=0,origin=s.boss){
 const b={x:origin.x,y:origin.y,r:s.boss.r},dx=Math.cos(s.boss.body),dy=Math.sin(s.boss.body),inset=b.r+25;
 const xEnd=dx>=0?FIELD.right-inset:FIELD.left+inset;
 const yEnd=dy>=0?FIELD.bottom-inset:FIELD.top+inset;
 const xLimit=Math.abs(dx)<1e-9?Infinity:(xEnd-b.x)/dx;
 const yLimit=Math.abs(dy)<1e-9?Infinity:(yEnd-b.y)/dy;
 let length=Math.max(0,Math.min(COAST_CHARGE.distance-offset,xLimit,yLimit)),blockId=null;
 for(const cover of s.blocks){
  if(cover.hp===0)continue;
  const hit=rayBoxDistance(b,dx,dy,cover,b.r);
  if(hit<length||hit===length&&blockId===null){length=hit;blockId=cover.id;}
 }
 return {x:b.x,y:b.y,length:blockId===null?length:Math.max(0,length-CLEARANCE),offset,blockId};
}
export function coastChargeLane(s){
 const b=s.boss,path=b.chargePath;
 if(s.operation?.region>0||!b.active||b.dead||!path||!['windup','charge'].includes(b.mode))return null;
 return {...path,endX:path.x+Math.cos(b.body)*path.length,endY:path.y+Math.sin(b.body)*path.length,r:b.r+16};
}
