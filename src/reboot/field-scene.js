import {REGIONS,regionLayout,mapSeed,frontEntry,exitGate} from './campaign.js';

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
 {ground:'#59615a',grain:['#919080','#3d4844'],water:null,shapes:[
  rect(110,90,1380,230,'#414a48'),rect(655,300,100,890,'#444c47'),rect(925,270,155,920,'#414b47'),
  rect(130,620,1330,105,'#4c5550'),line([[160,1010],[1450,1010]],'#a7a084',3,[16,20])
 ],rails:[[[40,180],[1560,180]],[[40,270],[1560,270]],[[700,1190],[700,440],[890,270]],[[1000,1190],[1000,330]]],landmarks:[[2,1,24,780,100],[2,1,1572,500,110],[1,2,1534,240,160]]},
 {ground:'#61716e',grain:['#9caaa0','#3d504e'],water:'#234b5e',shapes:[
  rect(0,0,38,1200,'#234b5e'),rect(1562,0,38,1200,'#234b5e'),rect(38,0,76,1200,'#465b58'),rect(1486,0,76,1200,'#465b58'),
  rect(114,150,1372,60,'#465b59'),rect(114,830,1372,70,'#52635c'),
  line([[120,60],[120,1160]],'#d1bd7c',5,[20,16]),line([[1480,60],[1480,1160]],'#d1bd7c',5,[20,16]),
  line([[220,570],[1420,570]],'#b9b493',3,[14,12]),line([[220,1015],[1420,1015]],'#b9b493',3,[14,12])
 ],landmarks:[[2,0,15,410,165],[2,0,1590,850,160],[2,3,1570,190,105]]}
];
const mirrorPoints=points=>points.map(([x,y])=>[1600-x,y]);
const mirroredRail={...scenes[1],
 shapes:scenes[1].shapes.map(shape=>shape.type==='rect'?{...shape,x:1600-shape.x-shape.w}:{...shape,points:mirrorPoints(shape.points)}),
 rails:scenes[1].rails.map(mirrorPoints),
 landmarks:scenes[1].landmarks.map(([row,col,x,y,w])=>[row,col,1600-x,y,w])
};
export const fieldScene=(index,seed=17)=>index===1&&mapSeed(seed,index)%2===0?mirroredRail:scenes[index]||scenes[0];
export function previewLayout(seed,index){return regionLayout(mapSeed(seed,index),index);}
export function sitePresentation(n){
 if(n.kind==='relay')return{icon:'relay',name:'통신 중계기',verb:'범위 안에서 해킹'};
 if(n.kind==='control')return{icon:'control',name:'항구 관제소',verb:'경비를 제압하라'};
 if(n.kind==='armory')return{icon:'armory',name:n.name,verb:'경비를 제압하라'};
 if(n.id==='supply-a')return{icon:'rescue',name:'포로 구출',verb:'경비를 제압하라'};
 if(n.id==='supply-b')return{icon:'truck',name:'이동 보급차',verb:'경비를 제압하라'};
 if(n.coastApproach==='r')return{icon:'battery',name:n.name,verb:'박격포를 제압하라'};
 return{icon:'crate',name:n.name,verb:'경비를 제압하라'};
}
export function siteSymbol(n,x=n.x,y=n.y,size=23){
 const t=sitePresentation(n).icon,r=size,stroke=n.state==='done'?'#899b82':n.state==='ready'?'#f7d17c':n.state==='active'?'#ef9a62':'#d4cc9c',body=t==='rescue'?`<path d="M-13 11v-22h26v22m-17-22v22m8-22v22M-13 1h26"/>`:t==='relay'||t==='control'?'<path d="M0 13V-8m-10 5a14 14 0 0 1 20 0m-25-7a22 22 0 0 1 30 0"/><circle cy="-9" r="3"/>':t==='truck'?'<path d="M-16 7v-17H5v5h10v12Z"/><circle cx="-9" cy="9" r="3"/><circle cx="10" cy="9" r="3"/>':t==='battery'?'<path d="M-14 12h28M-8 12l5-9 8 9M-3 4l10-17 5 3-10 17Z"/>':'<path d="M-13-11h26v24h-26Zm0 7h26M-5-11v24m10-24v24"/>';
 return `<g transform="translate(${x} ${y}) scale(${r/18})" fill="#263d35" stroke="${stroke}" stroke-width="3" stroke-linejoin="round">${body}</g>`;
}
export function terrainSvg(index,seed){const scene=fieldScene(index,seed);return `<rect width="1600" height="1200" fill="${scene.ground}"/>${scene.shapes.map(s=>s.type==='rect'?`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}"/>`:`<${s.type==='line'?'polyline':'polygon'} points="${s.points.map(p=>p.join(',')).join(' ')}" fill="${s.fill||'none'}" ${s.stroke?`stroke="${s.stroke}" stroke-width="${s.width}" stroke-dasharray="${s.dash?.join(' ')||''}"`:''}/>`).join('')}${(scene.rails||[]).map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#adb7a5" stroke-width="16"/><polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#303e39" stroke-width="8"/>`).join('')}`;}
export function gateSymbol({x,y,name}){
 return `<g class="map-exit" transform="translate(${x} ${y})" aria-label="${name}"><rect x="-39" y="-32" width="78" height="64" rx="8" fill="#23473a" stroke="#b8efbd" stroke-width="9"/><path d="m-18 7 18-16 18 16" fill="none" stroke="#b8efbd" stroke-width="8"/></g>`;
}
export function entryRouteSvg(entry){
 return entry?.routes.map(route=>`<polyline data-approach="${route.site}" points="${route.path.map(point=>point.join(',')).join(' ')}" fill="none" stroke="${route.color}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="22 18" aria-label="${route.sign} 경로"/>`).join('')||'';
}
export function regionPreview(index,seed=17,current=null){
 const entry=frontEntry(mapSeed(seed,index),index);
 const map=current||previewLayout(seed,index),player=current?.player||entry?.arrival||{x:800,y:1040},gate=current&&exitGate(current);
 const stops=index===0&&!current?map.sites.filter(n=>n.opening||n.coastApproach):[];
 const insertion=entry?entryRouteSvg(entry):stops.length?`<path d="M800 1040L${stops[0].x} ${stops[0].y}" stroke="#ffdf8b" stroke-width="12" stroke-dasharray="20 20"/>`:'<path d="M800 1040V350" stroke="#f5d48a" stroke-width="10" stroke-dasharray="16 18"/>';
 const numbers=stops.map(site=>`<g transform="translate(${site.x+54} ${site.y-46})" aria-hidden="true"><circle r="30" fill="#f1cc79" stroke="#263d35" stroke-width="6"/><text y="12" text-anchor="middle" fill="#263d35" font-size="35" font-weight="bold">${site.coastApproach?.toUpperCase()||'1'}</text></g>`).join('');
 return `<svg class="sector-preview" viewBox="0 0 1600 1200" role="img" aria-label="${REGIONS[index].name} · 전장과 같은 지형과 보급 위치">${terrainSvg(index,seed)}${map.blocks.filter(b=>b.hp!==0).map(b=>`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#354a40" stroke="#b6b394" stroke-width="10"/>`).join('')}${gate?gateSymbol(gate):`${insertion}<path d="m800 315-40 60h80Z" fill="#e6a36a"/>`}${map.sites.map(n=>siteSymbol(n,n.x,n.y,40)).join('')}${numbers}<circle cx="${player.x}" cy="${player.y}" r="22" fill="#fff1bf" stroke="#263d35" stroke-width="10"/></svg>`;
}
