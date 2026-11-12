// Each control owns its pointer. A right-thumb tap must never release movement.
export function bindTouchControls({stick,actions,canPlay,onMove,onAction,onUnlock=()=>{},canAim=()=>false,onAim=()=>{},canCompleteAim=canPlay}){
 let owner=null;const removers=[];
 const listen=(el,type,handler)=>{el.addEventListener(type,handler);removers.push(()=>el.removeEventListener(type,handler));};
 function update(event){if(event.pointerId!==owner)return;const box=stick.getBoundingClientRect(),x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2,length=Math.hypot(x,y),force=Math.min(1,Math.max(0,(length-7)/31)),reach=Math.min(34,length);stick.firstElementChild.style.transform=`translate(${x/(length||1)*reach}px,${y/(length||1)*reach}px)`;onMove({x:x/(length||1)*force,y:y/(length||1)*force});}
 function release(event){if(event&&event.pointerId!==owner)return;const old=owner;owner=null;stick.classList.remove('active');stick.firstElementChild.style.transform='';onMove({x:0,y:0});if(old!==null)try{stick.releasePointerCapture(old);}catch{}}
 listen(stick,'pointerdown',event=>{if(!canPlay()||owner!==null||event.button>0)return;event.preventDefault();owner=event.pointerId;try{stick.setPointerCapture(owner);}catch{}stick.classList.add('active');update(event);onUnlock();});
 listen(stick,'pointermove',event=>{if(event.pointerId===owner){event.preventDefault();update(event);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,release);
 const resets=[release];
 for(const [action,button]of Object.entries(actions)){
  const pointers=new Set();
  let gesture=null;
  function aimAt(event){
   const x=event.clientX-gesture.x,y=event.clientY-gesture.y,length=Math.hypot(x,y);
   const input=length>=12?{x:x/length,y:y/length}:null;
   if(input)gesture.dragged=true;
   return {input,canceled:gesture.dragged&&!input};
  }
  function end(event,fire=false){
   pointers.delete(event.pointerId);
   button.classList.toggle('pressed',pointers.size>0);
   if(!gesture||event.pointerId!==gesture.id)return;
   const shot=fire?aimAt(event):null;
   gesture=null;onAim(null);
   if(shot&&!shot.canceled&&canCompleteAim()&&!button.disabled)onAction(action,shot.input);
  }
  listen(button,'pointerdown',event=>{
   if(!canPlay()||button.disabled||event.button>0||gesture||pointers.has(event.pointerId))return;
   event.preventDefault();pointers.add(event.pointerId);button.classList.add('pressed');
   try{button.setPointerCapture(event.pointerId);}catch{}
   onUnlock();
   if(canAim(action)){
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dragged:false};
    onAim({input:null,canceled:false});
   }else onAction(action);
  });
  listen(button,'pointermove',event=>{
   if(!gesture||event.pointerId!==gesture.id)return;
   event.preventDefault();onAim(aimAt(event));
  });
  listen(button,'pointerup',event=>end(event,true));
  for(const type of ['pointercancel','lostpointercapture'])listen(button,type,end);
  // Keyboard and assistive technology use click. Captured pointers use the handlers above.
  listen(button,'click',event=>{if(event.detail||event.pointerType||gesture||!canPlay()||button.disabled)return;onUnlock();onAction(action);});
  resets.push(()=>{
   if(gesture){gesture=null;onAim(null);}
   for(const id of pointers)try{button.releasePointerCapture(id);}catch{}
   pointers.clear();button.classList.remove('pressed');
  });
 }
 return {reset(){for(const reset of resets)reset();},destroy(){for(const remove of removers)remove();for(const reset of resets)reset();}};
}
