// Fit the moving boss and player inside the space left by the combat HUD.
export function missionCamera(s,w,h,{lobby=false,compact=w<=700}={}){
 const base=Math.min(w/850,h/650),p=s.player;
 if(lobby||!s.boss.active)return{zoom:base,focusX:p.x,focusY:p.y,cx:lobby?w*.72:w/2,cy:lobby?h*.7:h*.53};
 const b=s.boss,bossWidth=s.front===1?220:s.front===2?150:130;
 const minX=Math.min(p.x-80,b.x-bossWidth),maxX=Math.max(p.x+80,b.x+bossWidth);
 const minY=Math.min(p.y-85,b.y-145),maxY=Math.max(p.y+65,b.y+100);
 const top=Math.min(h*.32,compact?(p.slug?258:210):185),bottom=Math.min(h*.25,compact?205:85);
 return{zoom:Math.min(base,Math.max(1,w-64)/(maxX-minX),Math.max(1,h-top-bottom)/(maxY-minY)),focusX:(minX+maxX)/2,focusY:(minY+maxY)/2,cx:w/2,cy:(top+h-bottom)/2};
}
