import {REGIONS,regionLayout,mapSeed,frontEntry,exitGate} from './campaign.js';
import {RAID_MARKS,raidRoute} from './raid.js';
import {FIELD} from './content.js';

// One geography for canvas terrain, tactical maps and operation briefings.
const rect=(x,y,w,h,fill)=>({type:'rect',x,y,w,h,fill});
const path=(points,fill,stroke=null,width=1)=>({type:'path',points,fill,stroke,width});
const line=(points,stroke,width=1,dash=[])=>({type:'line',points,stroke,width,dash});
const scenes=[
 {ground:'#9b8d66',grain:['#c3b082','#665e48'],water:'#365766',shapes:[
  rect(0,0,38,1200,'#365766'),rect(38,0,42,1200,'#b2a17a'),
  path([[710,1200],[1030,1200],[960,700],[1040,0],[800,0],[750,650]],'#6d6b58'),
  line([[865,1200],[850,700],[915,0]],'#bdb28a',3,[22,24]),
  rect(120,60,1360,190,'#8b8265'),line([[120,260],[1480,260]],'#c6b17b',3,[12,16])
 ],landmarks:[[0,0,22,800,110],[0,0,28,420,95],[0,3,1538,180,125],[0,2,1540,1100,100]]},
 {ground:'#4b4840',grain:['#a99873','#282c2a'],water:null,shapes:[
  rect(80,122,1440,206,'#3c3c33'),rect(642,300,116,900,'#403a2e'),rect(941,270,120,930,'#403a2e'),
  path([[763,1190],[933,1190],[930,478],[804,505]],'#504b3e'),
  rect(429,787,179,160,'#6a6551'),rect(439,795,158,142,'#575546'),
  rect(1080,528,120,130,'#53564c'),line([[1090,650],[1189,650]],'#9a9272',3),
  rect(135,599,495,25,'#59513f'),rect(1070,598,393,25,'#59513f'),
  line([[429,947],[608,947]],'#b8a56b',4),line([[617,810],[617,927]],'#a99461',3,[17,12]),
  line([[770,1156],[940,1156]],'#827759',3,[19,16])
 ],rails:[[[40,180],[1560,180]],[[40,270],[1560,270]],[[700,1190],[700,440],[890,270]],[[1000,1190],[1000,330]]],
 marks:[[510,926,'02'],[1135,634,'04']],landmarks:[[2,1,24,780,100],[2,1,1572,500,110],[1,2,1534,240,160]]},
 {ground:'#43575f',grain:['#a0b4af','#293c45'],water:'#234b5e',shapes:[
  rect(38,0,81,1160,'#3a5059'),rect(1481,0,81,1160,'#3a5059'),
  rect(38,943,1524,217,'#4d6468'),rect(570,103,460,305,'#4e6164'),
  rect(440,855,180,117,'#546b6e'),rect(1115,572,144,156,'#536a6b'),
  rect(763,210,79,950,'#354951'),
  line([[768,421],[768,1152]],'#8a987e',3,[22,25]),line([[837,432],[837,1152]],'#82947d',3,[22,25]),
  line([[573,407],[766,407]],'#95a08a',3),line([[840,407],[1027,407]],'#95a08a',3),
  line([[438,854],[619,854],[619,959]],'#a8a787',4),line([[1115,729],[1259,729],[1259,578]],'#a8a787',4),
  line([[129,1008],[430,1008]],'#7e9290',2),line([[885,1030],[1465,1030]],'#7e9290',2),
  line([[229,698],[518,698],[518,803]],'#738883',2),line([[1070,416],[1450,416]],'#738883',2),
  rect(0,0,38,1200,'#234b5e'),rect(1562,0,38,1200,'#234b5e'),rect(0,FIELD.bottom,1600,1200-FIELD.bottom,'#234b5e'),
  rect(38,FIELD.bottom-14,1524,14,'#768d8b'),rect(38,FIELD.bottom-3,1524,3,'#20383f')
 ],marks:[[530,950,'01'],[1187,713,'02'],[971,394,'03']],
 landmarks:[[2,0,15,410,165],[2,0,1590,850,160],[2,3,1570,190,105]]}
];
const mirrorPoints=points=>points.map(([x,y])=>[1600-x,y]);
const mirrored=scenes.map((scene,index)=>index===0?scene:{...scene,
 shapes:scene.shapes.map(shape=>shape.type==='rect'?{...shape,x:1600-shape.x-shape.w}:{...shape,points:mirrorPoints(shape.points)}),
 rails:scene.rails?.map(mirrorPoints),
 marks:scene.marks.map(([x,y,text])=>[1600-x,y,text]),
 landmarks:scene.landmarks.map(([row,col,x,y,w])=>[row,col,1600-x,y,w])
});
export const fieldScene=(index,seed=17)=>(mapSeed(seed,index)%2===0?mirrored:scenes)[index]||scenes[0];
export function previewLayout(seed,index){return regionLayout(mapSeed(seed,index),index);}
export function sitePresentation(n){
 if(n.kind==='relay')return{icon:'relay',name:'통신 중계기',verb:'범위 안에서 해킹'};
 if(n.kind==='control')return{icon:'control',name:'항구 관제소',verb:'경비를 제압하라'};
 if(n.kind==='armory')return{icon:'armory',name:n.name,verb:'경비를 제압하라'};
 if(n.id==='supply-a')return{icon:'rescue',name:'포로 구출',verb:'경비를 제압하라'};
 if(n.id==='supply-b')return{icon:'truck',name:'이동 보급차',verb:'경비를 제압하라'};
 if(n.id==='rail-cache')return{icon:'workshop',name:'화차 정비대',verb:'경비를 제압하라'};
 if(n.id==='port-landing')return{icon:'gantry',name:'하역장 해치',verb:'방패병과 박격포를 제압하라'};
 if(n.coastApproach==='r')return{icon:'battery',name:n.name,verb:'박격포를 제압하라'};
 return{icon:'crate',name:n.name,verb:'경비를 제압하라'};
}
export function siteSymbol(n,x=n.x,y=n.y,size=23){
 const t=sitePresentation(n).icon,r=size,stroke=n.state==='done'?'#899b82':n.state==='ready'?'#f7d17c':n.state==='active'?'#ef9a62':'#d4cc9c',body=t==='rescue'?`<path d="M-13 11v-22h26v22m-17-22v22m8-22v22M-13 1h26"/>`:t==='relay'||t==='control'?'<path d="M0 13V-8m-10 5a14 14 0 0 1 20 0m-25-7a22 22 0 0 1 30 0"/><circle cy="-9" r="3"/>':t==='truck'?'<path d="M-16 7v-17H5v5h10v12Z"/><circle cx="-9" cy="9" r="3"/><circle cx="10" cy="9" r="3"/>':t==='battery'?'<path d="M-14 12h28M-8 12l5-9 8 9M-3 4l10-17 5 3-10 17Z"/>':'<path d="M-13-11h26v24h-26Zm0 7h26M-5-11v24m10-24v24"/>';
 const symbol=t==='workshop'?'<path d="m-12 8 13-13-1-7 7-3-1 7 6 1 4-5 1 8-5 6-7-1-12 13Z"/>':t==='gantry'?'<path d="M-14 12V-10h28v22M-8 4 0-2l8 6M-8 11l8-6 8 6"/>':body;
 return `<g transform="translate(${x} ${y}) scale(${r/18})" fill="#263d35" stroke="${stroke}" stroke-width="3" stroke-linejoin="round">${symbol}</g>`;
}
export function terrainSvg(index,seed){const scene=fieldScene(index,seed);return `<rect width="1600" height="1200" fill="${scene.ground}"/>${scene.shapes.map(s=>s.type==='rect'?`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}"/>`:`<${s.type==='line'?'polyline':'polygon'} points="${s.points.map(p=>p.join(',')).join(' ')}" fill="${s.fill||'none'}" ${s.stroke?`stroke="${s.stroke}" stroke-width="${s.width}" stroke-dasharray="${s.dash?.join(' ')||''}"`:''}/>`).join('')}${(scene.rails||[]).map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#adb7a5" stroke-width="16"/><polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#303e39" stroke-width="8"/>`).join('')}`;}
export function gateSymbol({x,y,name}){
 return `<g class="map-exit" transform="translate(${x} ${y})" aria-label="${name}"><rect x="-39" y="-32" width="78" height="64" rx="8" fill="#23473a" stroke="#b8efbd" stroke-width="9"/><path d="m-18 7 18-16 18 16" fill="none" stroke="#b8efbd" stroke-width="8"/></g>`;
}
export function entryRouteSvg(entry){
 return entry?.routes.map(route=>`<polyline data-approach="${route.site}" points="${route.path.map(point=>point.join(',')).join(' ')}" fill="none" stroke="${route.color}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="22 18" aria-label="${route.sign} 경로"/>`).join('')||'';
}
export function raidRouteSvg(route,contract){
 const {color,name}=RAID_MARKS[contract],start=route[0],end=route.at(-1);
 const points=route.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 return `<g data-raid-route="${contract}" aria-label="${name} 탈출 경로" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}" stroke="#233634" stroke-width="27"/><polyline points="${points}" stroke="${color}" stroke-width="15" stroke-dasharray="${contract==='light'?'30 16':'12 16'}"/><circle cx="${start.x}" cy="${start.y}" r="26" fill="#263735" stroke="${color}" stroke-width="11"/><path transform="translate(${end.x} ${end.y})" d="M-27 -22h54v44h-54z M-10 -22v44 M10 -22v44" fill="#263735" stroke="${color}" stroke-width="9"/></g>`;
}
export function raidPreview(s){
 const ground=terrainSvg(s.operation?.region||0,s.seed);
 const cover=s.blocks.filter(b=>b.hp!==0).map(b=>`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2a403d" stroke="#798a7f" stroke-width="8"/>`).join('');
 const paths=Object.keys(RAID_MARKS).map(id=>raidRouteSvg(raidRoute(s,id),id)).join('');
 return `<svg class="raid-preview" viewBox="0 0 1600 1200" role="img" aria-label="보급차와 장갑 수송대의 출발점과 검문선. 흰 점은 현재 위치.">${ground}${cover}${paths}<circle cx="${s.player.x}" cy="${s.player.y}" r="31" fill="#fff5d5" stroke="#243a34" stroke-width="10"/></svg>`;
}
export function regionPreview(index,seed=17,current=null){
 const entry=frontEntry(mapSeed(seed,index),index);
 const map=current||previewLayout(seed,index),player=current?.player||entry?.arrival||{x:800,y:1040},gate=current&&exitGate(current);
 const stops=index===0&&!current?map.sites.filter(n=>n.opening||n.coastApproach):[];
 const insertion=entry?entryRouteSvg(entry):stops.length?`<path d="M800 1040L${stops[0].x} ${stops[0].y}" stroke="#ffdf8b" stroke-width="12" stroke-dasharray="20 20"/>`:'<path d="M800 1040V350" stroke="#f5d48a" stroke-width="10" stroke-dasharray="16 18"/>';
 const numbers=stops.map(site=>`<g transform="translate(${site.x+54} ${site.y-46})" aria-hidden="true"><circle r="30" fill="#f1cc79" stroke="#263d35" stroke-width="6"/><text y="12" text-anchor="middle" fill="#263d35" font-size="35" font-weight="bold">${site.coastApproach?.toUpperCase()||'1'}</text></g>`).join('');
 return `<svg class="sector-preview" viewBox="0 0 1600 1200" role="img" aria-label="${REGIONS[index].name} · 전장과 같은 지형과 보급 위치">${terrainSvg(index,seed)}${map.blocks.filter(b=>b.hp!==0).map(b=>`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#354a40" stroke="#b6b394" stroke-width="10"/>`).join('')}${gate?gateSymbol(gate):`${insertion}<path d="m800 315-40 60h80Z" fill="#e6a36a"/>`}${map.sites.map(n=>siteSymbol(n,n.x,n.y,40)).join('')}${numbers}<circle cx="${player.x}" cy="${player.y}" r="22" fill="#fff1bf" stroke="#263d35" stroke-width="10"/></svg>`;
}
