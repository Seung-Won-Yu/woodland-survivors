export const WORLD_LIMIT=1350;
export const LANDMARKS={supply:{x:-760,y:-180},nest:{x:650,y:-480},spring:{x:140,y:620},camp:{x:0,y:70}};
export const TRAILS=[[[0,70],[-210,-40],[-760,-180]],[[-760,-180],[-710,-560],[-260,-660],[650,-480]],[[0,70],[200,290],[140,620]],[[140,620],[630,330],[800,-120],[650,-480]]];
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
export const TREE_PROPS=Array.from({length:95},(_,i)=>({x:((i*719+111)%2600)-1300,y:((i*983+91)%2600)-1300,size:.83+(i%5)*.07,variant:i%3,id:i})).filter(a=>{
  if(Math.abs(a.x)<225&&Math.abs(a.y)<230)return false;
  if(Object.values(LANDMARKS).some(({x,y})=>Math.hypot(a.x-x,a.y-y)<180))return false;
  return !TRAILS.some(path=>path.slice(1).some((b,i)=>segmentDistance(a.x,a.y,path[i],b)<92));
});
export const TREE_TRUNKS=TREE_PROPS.map(a=>({x:a.x,y:a.y,r:23*a.size,kind:'tree',id:a.id}));
export const ROCKS=[
  [-280,-160,42],[-310,-230,49],[-340,-310,46],[-370,-390,44],
  [250,-100,47],[300,-140,42],[350,-180,50],[405,-220,42],
  [-165,240,40],[-225,275,46],[-290,305,36],[310,330,48],[360,390,38],
  [150,-620,55],[215,-660,43],[-170,-740,48],[-240,-790,38],
  [-760,150,55],[-820,190,40],[710,-550,50],[770,-600,43],
  [-570,600,45],[600,700,50]
].map(([x,y,r],i)=>({x,y,r,id:i}));
export function moveActor(g,a,dx,dy,r=12){
  if(!g.terrain){a.x+=dx;a.y+=dy;return;}
  // Sweep in short steps so dashes and charges cannot tunnel through rock ridges.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
  for(let i=0;i<n;i++){
    a.x=Math.max(-WORLD_LIMIT+r,Math.min(WORLD_LIMIT-r,a.x+dx/n));
    a.y=Math.max(-WORLD_LIMIT+r,Math.min(WORLD_LIMIT-r,a.y+dy/n));
    for(const rock of g.terrain){const x=a.x-rock.x,y=a.y-rock.y,d=Math.hypot(x,y),reach=r+rock.r*.78;if(d<reach){a.x=rock.x+(d?x/d:1)*reach;a.y=rock.y+(d?y/d:0)*reach;}}
  }
}
