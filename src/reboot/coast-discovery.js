import {regionLayout} from './campaign.js';
import {distance} from './content.js';

export const FIELD_KITS={
 burst:{name:'파열탄',detail:'무기 처치 시 파편 2발',color:'#ffc88d',range:132,damage:34,reload:.55},
 stride:{name:'기동 급탄',detail:'이동 중 XP 회수 · 연사 2.5초',color:'#a8eadc',duration:2.5,interval:.68}
};

const POCKETS=[
 [[510,970],[460,865],[368,932],[500,742]],
 [[1090,970],[1140,865],[1232,932],[1100,742]]
];

export function coastDiscovery(seed){
 const {sites,blocks}=regionLayout(seed);
 const slots=POCKETS.map((side,i)=>{
  const start=(seed>>>(i?5:3))&3;
  for(let j=0;j<side.length;j++){
   const [x,y]=side[(start+j)%side.length],point={x,y};
   if(sites.some(site=>distance(site,point)<104))continue;
   if(blocks.some(b=>x+35>b.x&&x-35<b.x+b.w&&y+35>b.y&&y-35<b.y+b.h))continue;
   return point;
  }
  const [x,y]=side[2];return {x,y};
 });
 const keys=(seed>>>2&1)?['stride','burst']:['burst','stride'];
 return {caches:slots.map((point,i)=>({...point,kit:keys[i],seen:false})),kit:null};
}

export function validCoastDiscovery(s){
 const d=s.operation.exploration;
 if(!s.operation.roaming||!d||!Array.isArray(d.caches))return false;
 const expected=coastDiscovery(s.seed).caches;
 if(d.caches.length!==expected.length||!d.caches.every((c,i)=>c&&typeof c.seen==='boolean'
  &&c.x===expected[i].x&&c.y===expected[i].y&&c.kit===expected[i].kit))return false;
 if(d.kit!==null&&!d.caches.some(c=>c.kit===d.kit&&c.seen))return false;
 return d.until===undefined||d.kit!==null&&Number.isFinite(d.until)&&d.until>=0
  &&d.until<=s.t+FIELD_KITS.stride.duration+.01;
}

export const coastCaches=s=>s.operation?.region===0&&s.stage==='field'&&!s.operation.exploration?.kit
 ?s.operation.exploration?.caches||[]:[];
export const movingReload=s=>s.operation?.exploration?.kit==='stride'&&s.player.pickupSweep
 &&s.t<s.operation.exploration.until;
