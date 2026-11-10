import {RULES,distance} from './content.js';

export const RAID_MARKS={
 light:{name:'보급차',color:'#efd093',move:'뒤쫓아 엄호병과 함께 제압',reward:'분화 개장 · 무기 강화'},
 armored:{name:'장갑 수송대',color:'#edab9c',move:'진로를 가로질러 측후면 사격',reward:'미완성 진화·합체 부품'}
};

// The rail and port routes mirror with their cover. Coast routes follow the local armory.
const RAIL={
 light:[[350,300],[350,170],[505,110],[960,110],[1040,85]],
 armored:[[495,560],[495,180],[735,110],[1100,110],[1170,85]]
};
const PORT={
 light:[[280,605],[280,845],[525,1040],[750,1090]],
 armored:[[155,620],[155,190],[380,105],[700,105],[765,85]]
};
const CONTROL={
 light:[[1330,650],[1410,750],[1410,970],[1065,1060],[965,1090]],
 armored:[[1350,690],[805,690],[805,330],[910,110]]
};

export function raidRoute(s,contract){
 const armory=s.sites.find(site=>site.id==='arsenal'),front=s.operation?.region||0;
 if(front===0){
  const {x,y}=armory,outside=x+(x<800?-145:145);
  const points=contract==='light'?[[x,y+125],[x,865],[800,1060],[800,1100]]:[[outside,y+135],[outside,220],[x,110],[800,100]];
  return points.map(([x,y])=>({x,y}));
 }
 const control=s.sites.find(site=>site.id==='port-control');
 const fromControl=control&&(s.choice?.siteId===control.id||!s.choice?.siteId&&distance(control,s.player)<distance(armory,s.player));
 const [paths,flip]=fromControl?[CONTROL,control.x<800]:[front===1?RAIL:PORT,armory.x>800];
 return paths[contract].map(([x,y])=>({x:flip?1600-x:x,y}));
}

export const raidSeconds=contract=>{
 const cfg=RULES.raidContracts[contract];
 return cfg.routeLength/cfg.speed;
};
export const raidTimeLeft=raid=>(raid.maxProgress-raid.progress)/RULES.raidContracts[raid.contract].speed;
export function raidOnNose(s,heading){
 const raid=s.raid;
 if(raid?.state!=='active'||raid.contract!=='armored')return false;
 const target=raid.target;
 return Math.cos((heading??Math.atan2(s.player.y-target.y,s.player.x-target.x))-target.aim)>.5;
}
export function routeCursor(route,progress){
 const legs=route.slice(1).map((p,i)=>distance(p,route[i]));
 let remaining=progress*legs.reduce((sum,n)=>sum+n,0),segment=0;
 while(segment<legs.length-1&&remaining>legs[segment])remaining-=legs[segment++];
 return {segment,fraction:Math.min(1,remaining/legs[segment])};
}
export const raidCursor=raid=>routeCursor(raid.route,raid.progress/raid.maxProgress);
export const raidAhead=raid=>[raid.target,...raid.route.slice(raid.segment+1)];
