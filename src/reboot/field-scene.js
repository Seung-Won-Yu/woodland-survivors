import {REGIONS,regionLayout,mapSeed,frontEntry,railCenterRoute,portCenterRoute,exitGate,sortieOrder,beachRoute,coastLeadColor,coastPreemptGun,coastPreemptSite,isOpeningGun,RAIL_SALVAGE_ROUTES,railWorkshopEntry} from './campaign.js';
import {coastFanPosition,coastFanRescue} from './coast-salvage.js';
import {RAID_MARKS,raidRoute} from './raid.js';
import {FIELD} from './content.js';

// One geography for canvas terrain, tactical maps and operation briefings.
const rect=(x,y,w,h,fill)=>({type:'rect',x,y,w,h,fill});
const path=(points,fill,stroke=null,width=1)=>({type:'path',points,fill,stroke,width});
const line=(points,stroke,width=1,dash=[])=>({type:'line',points,stroke,width,dash});
const scenes=[
 {ground:'#b49562',grain:['#d5b584','#6e5b3d'],water:'#285669',shapes:[
  path([[40,970],[168,986],[278,1052],[421,1084],[596,1079],[774,1104],[964,1082],[1144,1095],[1340,1054],[1560,1080],[1600,1069],[1600,1160],[40,1160]],'#957c55'),
  path([[40,1050],[169,1061],[291,1115],[465,1111],[594,1115],[777,1131],[968,1119],[1145,1128],[1350,1098],[1519,1110],[1600,1093],[1600,1160],[40,1160]],'#7e7354'),
  path([[650,1075],[720,915],[716,750],[751,526],[748,321],[777,0],[1044,0],[1034,327],[992,526],[994,746],[1044,944],[1058,1075],[970,1140],[710,1137]],'#a5895d'),
  path([[704,1089],[769,925],[769,747],[805,522],[791,320],[826,0],[1009,0],[990,310],[954,524],[944,746],[997,939],[1018,1093],[948,1139],[750,1136]],'#817257'),
  line([[852,1114],[873,932],[854,748],[878,524],[886,322],[918,0]],'#c6ad78',3,[22,28]),
  rect(160,62,1280,182,'#726c57'),line([[160,244],[1440,244]],'#d1b783',4,[18,12])
 ],landmarks:[[0,0,18,800,96],[0,0,14,420,80],[0,3,1622,188,120],[0,0,1587,804,86],[0,0,518,1113,136],[0,0,1099,1140,155],[3,1,1109,1133,78]]},
 {ground:'#53544c',grain:['#a89873','#252d2d'],water:null,shapes:[
  rect(80,122,1440,206,'#32382f'),rect(642,300,116,900,'#41392e'),rect(941,270,120,930,'#41392e'),
  path([[763,1190],[933,1190],[930,478],[804,505]],'#615b49'),
  rect(429,787,179,160,'#8b7f60'),rect(439,795,158,142,'#646b5b'),
  rect(1080,528,120,130,'#5c6f68'),line([[1090,650],[1189,650]],'#aaa17c',3),
  rect(135,599,495,25,'#59513f'),rect(1070,598,393,25,'#59513f'),
  line([[429,947],[608,947]],'#b8a56b',4),line([[617,810],[617,927]],'#a99461',3,[17,12]),
  line([[770,1156],[940,1156]],'#827759',3,[19,16])
 ],rails:[[[40,180],[1560,180]],[[40,270],[1560,270]],[[700,1190],[700,440],[890,270]],[[1000,1190],[1000,330]]],
 marks:[[510,926,'02'],[1135,634,'04']],landmarks:[[2,1,24,780,100],[2,1,1572,500,110],[1,2,1534,240,160],[2,1,596,1080,82],[2,1,1065,975,87],[2,2,1084,983,57]]},
 {ground:'#415662',grain:['#9eb6b9','#263744'],water:'#204b61',shapes:[
  rect(38,0,81,1160,'#344a54'),rect(1481,0,81,1160,'#344a54'),
  rect(38,943,1524,217,'#536d73'),rect(570,103,460,305,'#607473'),
  rect(440,855,180,117,'#5b7778'),rect(1115,572,144,156,'#527275'),
  rect(763,210,79,950,'#354951'),
  line([[768,421],[768,1152]],'#8a987e',3,[22,25]),line([[837,432],[837,1152]],'#82947d',3,[22,25]),
  line([[573,407],[766,407]],'#95a08a',3),line([[840,407],[1027,407]],'#95a08a',3),
  line([[438,854],[619,854],[619,959]],'#a8a787',4),line([[1115,729],[1259,729],[1259,578]],'#a8a787',4),
  line([[129,1008],[430,1008]],'#7e9290',2),line([[885,1030],[1465,1030]],'#7e9290',2),
  line([[229,698],[518,698],[518,803]],'#738883',2),line([[1070,416],[1450,416]],'#738883',2),
  rect(0,0,38,1200,'#204b61'),rect(1562,0,38,1200,'#204b61'),rect(0,FIELD.bottom,1600,1200-FIELD.bottom,'#204b61'),
  rect(38,FIELD.bottom-14,1524,14,'#768d8b'),rect(38,FIELD.bottom-3,1524,3,'#20383f')
 ],marks:[[530,950,'01'],[1187,713,'02'],[971,394,'03']],
 landmarks:[[2,0,15,410,165],[2,0,1590,850,160],[2,3,1570,190,105],[2,0,448,1151,186],[2,1,1021,1118,88],[2,2,1002,1130,76]]}
];
const mirrorPoints=points=>points.map(([x,y])=>[1600-x,y]);
const COAST_INSERTION=[800,1040];
// On the longer approach, steer past the cage's pickup radius before turning inland.
const COAST_BYPASS=[[680,800],[920,800],[700,780],[900,780]];
function coastOpeningRoutes(seed,rescue,preempt,planned){
 const bypass=planned&&preempt.coastApproach!==coastPreemptGun(seed)?[COAST_BYPASS[(seed>>>0)%COAST_BYPASS.length]]:[];
 return [
  {site:rescue.id,kind:'rescue',sign:'포로 구출',color:coastLeadColor(rescue),path:[COAST_INSERTION,[rescue.x,rescue.y]]},
  {site:preempt.id,kind:'preempt',sign:`${preempt.name} 기습`,color:coastLeadColor(preempt),path:[COAST_INSERTION,...bypass,[preempt.x,preempt.y]],recommended:!!planned}
 ];
}
function coastFanRoute(rescue){
 const fan=coastFanPosition(rescue);
 return {site:rescue.id,kind:'rescue',sign:'포탑 사격 위치',color:coastLeadColor(rescue),fan,
  path:[COAST_INSERTION,[fan.x,fan.y],[rescue.x,rescue.y]]};
}
const mirrored=scenes.map((scene,index)=>index===0?scene:{...scene,
 shapes:scene.shapes.map(shape=>shape.type==='rect'?{...shape,x:1600-shape.x-shape.w}:{...shape,points:mirrorPoints(shape.points)}),
 rails:scene.rails?.map(mirrorPoints),
 marks:scene.marks.map(([x,y,text])=>[1600-x,y,text]),
 landmarks:scene.landmarks.map(([row,col,x,y,w])=>[row,col,1600-x,y,w])
});
const coastScenes=Array.from({length:4},(_,index)=>{
 const [rescue,truck,,battery]=beachRoute(index).points,scene=scenes[0];
 const {sites}=regionLayout(index,0),preempt=sites.find(site=>site.coastApproach===coastPreemptGun(index));
 const routes=coastOpeningRoutes(index,sites[0],preempt);
 const tracks=[routes[0].path,[rescue,truck],[rescue,battery],routes[1].path];
 return {...scene,tracks,opening:{routes},shapes:[
  ...scene.shapes,...tracks.map(points=>line(points,'#65563831',46)),
  rect(0,0,FIELD.left,1200,scene.water),rect(0,FIELD.bottom,1600,1200-FIELD.bottom,scene.water),
  line([[FIELD.left,0],[FIELD.left,FIELD.bottom],[1600,FIELD.bottom]],'#8faca0',3)
 ]};
});
export const fieldScene=(index,seed=17)=>index===0?coastScenes[(seed>>>0)%coastScenes.length]:(mapSeed(seed,index)%2===0?mirrored:scenes)[index]||scenes[0];
export function coastOpeningGuide(s){
 const preempt=coastPreemptSite(s),rescue=s.sites[0];
 if(s.raid?.state!=='active'&&coastFanRescue(s,rescue)&&['waiting','active'].includes(rescue.state)&&!s.stats.rescueFanSweep){
  const routes=[coastFanRoute(rescue)];
  if(preempt?.state==='waiting'&&!preempt.preempt)routes.push(coastOpeningRoutes(s.seed,rescue,preempt,false)[1]);
  return {routes,preempt,rescue,fan:routes[0].fan};
 }
 if(!preempt||s.raid?.state==='active')return null;
 const planned=s.operation.openingGun;
 if(planned)return {routes:coastOpeningRoutes(s.seed,rescue,preempt,true),preempt,rescue};
 if(rescue.state!=='waiting'||preempt.state!=='waiting'||preempt.preempt)return null;
 return {...fieldScene(0,s.seed).opening,preempt,rescue};
}
export function coastOpeningBrief(seed,gun){
 const {sites}=previewLayout(seed,0),site=sites.find(site=>site.coastApproach===gun);
 const [,route]=coastOpeningRoutes(seed,sites[0],site,true);
 const distance=route.path.slice(1).reduce((sum,[x,y],i)=>sum+Math.hypot(x-route.path[i][0],y-route.path[i][1]),0);
 return {site,firstTurn:route.path[1],distance,detour:route.path.length>2};
}
export function previewLayout(seed,index,order=null,salvageRail=false){return regionLayout(mapSeed(seed,index),index,order,salvageRail);}
export function sitePresentation(n){
 if(n.kind==='relay')return{icon:'relay',name:n.name,verb:'범위 안에서 해킹'};
 if(n.kind==='control')return{icon:'control',name:'항구 관제소',verb:'경비를 제압하라'};
 if(n.kind==='armory')return{icon:'armory',name:n.name,verb:'경비를 제압하라'};
 if(n.id==='supply-a')return{icon:'rescue',name:'포로 구출',verb:'경비를 제압하라'};
 if(n.id==='supply-b')return{icon:'truck',name:'이동 보급차',verb:'경비를 제압하라'};
 if(n.id==='rail-cache')return{icon:'workshop',name:'화차 정비대',verb:'경비를 제압하라'};
 if(n.id==='port-landing'&&n.gantry)return{icon:'gantry',name:'하역장 해치',verb:'방패병과 박격포를 제압하라'};
 if(n.coastApproach==='r')return{icon:'battery',name:n.name,verb:'박격포를 제압하라'};
 return{icon:'crate',name:n.name,verb:'경비를 제압하라'};
}
export function siteSymbol(n,x=n.x,y=n.y,size=23){
 const t=sitePresentation(n).icon,r=size,stroke=n.state==='done'?'#899b82':n.state==='ready'?'#f7d17c':n.state==='active'?'#ef9a62':'#d4cc9c',body=t==='rescue'?`<path d="M-13 11v-22h26v22m-17-22v22m8-22v22M-13 1h26"/>`:t==='relay'||t==='control'?'<path d="M0 13V-8m-10 5a14 14 0 0 1 20 0m-25-7a22 22 0 0 1 30 0"/><circle cy="-9" r="3"/>':t==='truck'?'<path d="M-16 7v-17H5v5h10v12Z"/><circle cx="-9" cy="9" r="3"/><circle cx="10" cy="9" r="3"/>':t==='battery'?'<path d="M-14 12h28M-8 12l5-9 8 9M-3 4l10-17 5 3-10 17Z"/>':'<path d="M-13-11h26v24h-26Zm0 7h26M-5-11v24m10-24v24"/>';
 const symbol=t==='workshop'?'<path d="m-12 8 13-13-1-7 7-3-1 7 6 1 4-5 1 8-5 6-7-1-12 13Z"/>':t==='gantry'?'<path d="M-14 12V-10h28v22M-8 4 0-2l8 6M-8 11l8-6 8 6"/>':body;
 return `<g transform="translate(${x} ${y}) scale(${r/18})" fill="#263d35" stroke="${stroke}" stroke-width="3" stroke-linejoin="round">${symbol}</g>`;
}
export function terrainSvg(index,seed){
 const scene=fieldScene(index,seed);
 const shapes=scene.shapes.map(s=>{
  if(s.type==='rect')return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}"/>`;
  const tag=s.type==='line'?'polyline':'polygon';
  return `<${tag} points="${s.points.map(p=>p.join(',')).join(' ')}" fill="${s.fill||'none'}" ${s.stroke?`stroke="${s.stroke}" stroke-width="${s.width}" stroke-dasharray="${s.dash?.join(' ')||''}"`:''}/>`;
 }).join('');
 const rails=(scene.rails||[]).map(points=>{
  const geometry=points.map(p=>p.join(',')).join(' ');
  return `<polyline points="${geometry}" fill="none" stroke="#27302a" stroke-width="58" stroke-linejoin="round"/><polyline points="${geometry}" fill="none" stroke="#a2aa91" stroke-width="31" stroke-linejoin="round"/><polyline points="${geometry}" fill="none" stroke="#414439" stroke-width="18" stroke-linejoin="round"/>`;
 }).join('');
 return `<rect width="1600" height="1200" fill="${scene.ground}"/>${shapes}${rails}`;
}
function briefingCover(b,index){
 const {x,y,w,h}=b,roof=index===1?'#68877d':index===2?'#708b90':'#c3b28c';
 return `<g aria-hidden="true"><rect x="${x+12}" y="${y+11}" width="${w}" height="${h}" fill="#1a25255c"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#344843" stroke="#213533" stroke-width="9"/><path d="M${x+7} ${y+7}h${w-14}v${h-30}h-${w-14}Z" fill="${roof}"/></g>`;
}
export function gateSymbol({x,y,name},ink='#b8efbd'){
 return `<g class="map-exit" transform="translate(${x} ${y})" aria-label="${name}"><rect x="-39" y="-32" width="78" height="64" rx="8" fill="#23473a" stroke="${ink}" stroke-width="9"/><path d="m-18 7 18-16 18 16" fill="none" stroke="${ink}" stroke-width="8"/></g>`;
}
export function entryRouteSvg(entry){
 if(!entry)return '';
 const routes=entry.direct?[entry.direct,...entry.routes]:entry.routes;
 return routes.map(route=>{
  const [x,y]=route.path.at(-1),recommended=route.recommended===true;
  const line=`<polyline data-approach="${route.site}"${route.kind?` data-coast-opening="${route.kind}"`:''} points="${route.path.map(point=>point.join(',')).join(' ')}" fill="none" stroke="${route.color}" stroke-width="${recommended?30:route.kind?23:13}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${route.kind==='preempt'||recommended?'33 14':route.kind==='rescue'?'5 31':'22 18'}" aria-label="${route.sign} ${recommended?'추천 경로':'경로'}"/>`;
  if(route.fan){
   const {x,y,dx,dy}=route.fan,angle=Math.atan2(-dy,-dx)*180/Math.PI;
   const marker=route.site==='rail-cache'?'data-workshop-fan':'data-rescue-fan';
   return `${line}<g ${marker} transform="translate(${x} ${y}) rotate(${angle})" aria-label="포탑 사격 위치"><rect x="-36" y="-31" width="72" height="62" fill="#2d3629" stroke="${route.color}" stroke-width="9"/><path d="M-15 0H22M-15 0 20-17M-15 0 20 17" stroke="${route.color}" stroke-width="8"/></g>`;
  }
  return recommended?`${line}<circle cx="${x}" cy="${y}" r="65" fill="none" stroke="${route.color}" stroke-width="18" aria-hidden="true"/>`:line;
 }).join('');
}
export function railSalvagePreview(seed,selected=null,fan=true){
 const {arrival,routes}=frontEntry(mapSeed(seed,1),1);
 const track=routes.map(route=>{
  const color=RAIL_SALVAGE_ROUTES[route.site].color;
  const [x,y]=route.path.at(-1);
  const path=route.site==='rail-cache'&&fan?railWorkshopEntry(route,arrival):route.path;
  const points=path.map(point=>point.join(',')).join(' ');
  const waypoint={id:route.site,kind:route.site==='rail-relay'?'relay':'supply'};
  return `<g${selected&&route.site!==selected?' opacity=".35"':''}><polyline points="${points}" fill="none" stroke="#1b2925" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
   <polyline points="${points}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
   <rect x="${x-46}" y="${y-46}" width="92" height="92" fill="#21312e" stroke="${color}" stroke-width="11"/>
   ${siteSymbol(waypoint,x,y,35)}</g>`;
 }).join('');
 return `<svg class="rail-salvage-map" viewBox="420 478 760 640" aria-hidden="true">${terrainSvg(1,seed)}${track}<circle cx="${arrival.x}" cy="${arrival.y}" r="29" fill="#fbefc8" stroke="#21312e" stroke-width="11"/></svg>`;
}
export function escapeRouteSvg(route,marker,color,name,dash='12 16'){
 const start=route[0],end=route.at(-1),previous=route.at(-2);
 const rotation=Math.atan2(end.y-previous.y,end.x-previous.x)*180/Math.PI+90;
 const points=route.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 return `<g ${marker} aria-label="${name} 탈출 경로" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}" stroke="#233634" stroke-width="27"/><polyline points="${points}" stroke="${color}" stroke-width="15" stroke-dasharray="${dash}"/><circle cx="${start.x}" cy="${start.y}" r="26" fill="#263735" stroke="${color}" stroke-width="11"/><path transform="translate(${end.x} ${end.y}) rotate(${rotation})" d="M-27 -22h54v44h-54z M-10 -22v44 M10 -22v44" fill="#263735" stroke="${color}" stroke-width="9"/></g>`;
}
export const raidRouteSvg=(route,contract)=>escapeRouteSvg(route,`data-raid-route="${contract}"`,RAID_MARKS[contract].color,RAID_MARKS[contract].name,contract==='light'?'30 16':undefined);
export function raidPreview(s){
 const ground=terrainSvg(s.operation?.region||0,s.seed);
 const cover=s.blocks.filter(b=>b.hp!==0).map(b=>`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2a403d" stroke="#798a7f" stroke-width="8"/>`).join('');
 const paths=Object.keys(RAID_MARKS).map(id=>raidRouteSvg(raidRoute(s,id),id)).join('');
 return `<svg class="raid-preview" viewBox="0 0 1600 1200" role="img" aria-label="보급차와 장갑 수송대의 출발점과 검문선. 흰 점은 현재 위치.">${ground}${cover}${paths}<circle cx="${s.player.x}" cy="${s.player.y}" r="31" fill="#fff5d5" stroke="#243a34" stroke-width="10"/></svg>`;
}
export function orderPinSvg(site,id){
 const order=sortieOrder(id);
 return order&&site?`<path data-order-pin="${id}" d="M${site.x} ${site.y-57}l57 57 -57 57 -57 -57Z" fill="none" stroke="${order.color}" stroke-width="11" aria-label="${order.name} · ${order.site}"/>`:'';
}
export function regionPreview(index,seed=17,current=null,order=null,showPreempt=!order,openingGun=null,turret=false){
 const front=frontEntry(mapSeed(seed,index),index);
 const entry=front?{...front,direct:index===2?portCenterRoute(seed):railCenterRoute(seed)}:null;
 const map=current||previewLayout(seed,index,order),player=current?.player||entry?.arrival||{x:800,y:1040},gate=current&&exitGate(current);
 const stops=index===0&&!current?map.sites.filter(n=>n.opening||n.coastApproach):[];
 const coast=stops.length?fieldScene(0,seed):null;
 const planned=coast&&showPreempt&&isOpeningGun(openingGun)&&stops.find(site=>site.coastApproach===openingGun);
 const coastRoutes=coast&&(turret?{routes:[coastFanRoute(stops[0]),...(showPreempt?[coast.opening.routes[1]]:[])]}
  :planned?{routes:coastOpeningRoutes(seed,stops[0],planned,true)}:showPreempt?coast.opening:{routes:stops.map((site,i)=>({
  site:site.id,sign:sitePresentation(site).name,color:coastLeadColor(site),path:coast.tracks[i]
 }))});
 const insertion=entryRouteSvg(entry||coastRoutes)||'<path d="M800 1040V350" stroke="#f5d48a" stroke-width="10" stroke-dasharray="16 18"/>';
 const numbers=stops.filter(site=>!showPreempt||site.coastApproach).map(site=>`<g transform="translate(${site.x+52} ${site.y-55})" aria-hidden="true"><circle r="43" fill="${coastLeadColor(site)}" stroke="#263d35" stroke-width="8"/><text y="20" text-anchor="middle" fill="#263d35" font-size="60" font-weight="bold">${site.coastApproach?.toUpperCase()||'1'}</text></g>`).join('');
 const orderPin=index===0?orderPinSvg(map.sites.find(site=>site.id==='arsenal'),order):'';
 return `<svg class="sector-preview" viewBox="0 0 1600 1200" role="img" aria-label="${REGIONS[index].name} · 전장과 같은 지형과 보급 위치">${terrainSvg(index,seed)}${map.blocks.filter(b=>b.hp!==0).map(b=>briefingCover(b,index)).join('')}${gate?gateSymbol(gate):`${insertion}<path d="m800 315-40 60h80Z" fill="#e6a36a" stroke="#293532" stroke-width="8"/>`}${map.sites.map(n=>siteSymbol(n,n.x,n.y,40)).join('')}${numbers}${orderPin}<circle cx="${player.x}" cy="${player.y}" r="37" fill="none" stroke="#e2d5a380" stroke-width="6"/><circle cx="${player.x}" cy="${player.y}" r="22" fill="#fff1bf" stroke="#263d35" stroke-width="10"/></svg>`;
}
