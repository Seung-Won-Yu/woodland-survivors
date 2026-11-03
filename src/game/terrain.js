export const WORLD_LIMIT=1350;
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
