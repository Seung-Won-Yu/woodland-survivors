import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTouchControls} from '../src/game/touch-controls.js';
class Surface extends EventTarget{
 constructor(){super();this.disabled=false;this.captured=new Set();this.classes=new Set();this.classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};this.firstElementChild={style:{transform:''}};}
 getBoundingClientRect(){return {left:0,top:0,width:112,height:112};}
 setPointerCapture(id){this.captured.add(id);}releasePointerCapture(id){this.captured.delete(id);}
 send(type,props={}){const event=Object.assign(new Event(type,{cancelable:true}),{pointerId:1,clientX:56,clientY:56,button:0,...props});this.dispatchEvent(event);return event;}
}
function setup(options={}){const stick=new Surface(),dash=new Surface(),skill=new Surface(),moves=[],actions=[];let playing=true;const controls=bindTouchControls({stick,actions:{dash,skill},canPlay:()=>playing,onMove:m=>moves.push(m),onAction:a=>actions.push(a),...options});return {stick,dash,skill,moves,actions,controls,setPlaying:v=>playing=v};}
test('movement keeps its pointer while a second finger taps an action immediately',()=>{const q=setup();q.stick.send('pointerdown',{pointerId:10,clientX:90});assert.ok(q.moves.at(-1).x>0.8);q.dash.send('pointerdown',{pointerId:11});assert.deepEqual(q.actions,['dash']);assert.ok(q.moves.at(-1).x>0.8);q.dash.send('pointerup',{pointerId:11});q.dash.send('click',{detail:1,pointerType:'touch'});assert.equal(q.actions.length,1);q.stick.send('pointermove',{pointerId:10,clientY:20});assert.ok(q.moves.at(-1).y<0);q.stick.send('pointerup',{pointerId:10});assert.deepEqual(q.moves.at(-1),{x:0,y:0});});
test('an extra joystick finger or unrelated cancel cannot steal or stop movement',()=>{const q=setup();q.stick.send('pointerdown',{pointerId:4,clientX:95});q.stick.send('pointerdown',{pointerId:5,clientX:0});q.stick.send('pointercancel',{pointerId:5});assert.ok(q.moves.at(-1).x>0);q.stick.send('lostpointercapture',{pointerId:4});assert.deepEqual(q.moves.at(-1),{x:0,y:0});assert.equal(q.stick.firstElementChild.style.transform,'');});
test('phase reset releases movement and action presses; menus and disabled skills reject input',()=>{const q=setup();q.stick.send('pointerdown',{clientX:99});q.skill.send('pointerdown',{pointerId:2});q.controls.reset();assert.deepEqual(q.moves.at(-1),{x:0,y:0});assert.equal(q.stick.captured.size,0);assert.equal(q.skill.captured.size,0);assert.equal(q.skill.classes.has('pressed'),false);q.setPlaying(false);q.dash.send('pointerdown');assert.deepEqual(q.actions,['skill']);q.setPlaying(true);q.skill.disabled=true;q.skill.send('pointerdown',{pointerId:3});assert.deepEqual(q.actions,['skill']);});
test('keyboard activation remains available and thumb dead zone avoids accidental drift',()=>{const q=setup();q.dash.send('click',{detail:0});assert.deepEqual(q.actions,['dash']);q.stick.send('pointerdown',{clientX:60,clientY:59});assert.deepEqual(q.moves.at(-1),{x:0,y:0});});
test('movement can latch during a checkpoint while actions remain suspended',()=>{
 const q=setup({canMove:()=>true});
 q.setPlaying(false);
 q.stick.send('pointerdown',{pointerId:10,clientX:99});
 q.dash.send('pointerdown',{pointerId:20});
 assert.deepEqual(q.actions,[]);
 q.setPlaying(true);
 q.stick.send('pointermove',{pointerId:10,clientY:20});
 assert.ok(q.moves.at(-1).y<-.8);
});
test('a skill drag aims on release without taking the movement pointer',()=>{
 const aims=[],shots=[],q=setup({canAim:a=>a==='skill',onAim:a=>aims.push(a),onAction:(a,input)=>shots.push({a,input})});
 q.stick.send('pointerdown',{pointerId:10,clientX:94});
 q.skill.send('pointerdown',{pointerId:20});
 assert.deepEqual(shots,[]);
 q.skill.send('pointermove',{pointerId:20,clientY:20});
 assert.deepEqual(aims.at(-1),{input:{x:0,y:-1},canceled:false});
 q.skill.send('pointerdown',{pointerId:21});
 q.skill.send('pointerup',{pointerId:21});
 assert.deepEqual(shots,[]);
 q.skill.send('pointerup',{pointerId:20,clientY:20});
 q.skill.send('click',{detail:1,pointerType:'touch'});
 assert.deepEqual(shots,[{a:'skill',input:{x:0,y:-1}}]);
 assert.equal(aims.at(-1),null);
 assert.ok(q.moves.at(-1).x>.8);
 q.skill.send('pointerdown',{pointerId:22});
 q.skill.send('pointerup',{pointerId:22,clientY:52});
 assert.deepEqual(shots.at(-1),{a:'skill',input:null});
});
test('returning to the drag origin or losing the pointer cancels without firing',()=>{
 const aims=[],shots=[],q=setup({canAim:()=>true,onAim:a=>aims.push(a),onAction:a=>shots.push(a)});
 q.skill.send('pointerdown');
 q.skill.send('pointermove',{clientY:20});
 q.skill.send('pointermove');
 assert.deepEqual(aims.at(-1),{input:null,canceled:true});
 q.skill.send('pointerup');
 q.skill.send('pointerdown');
 q.skill.send('lostpointercapture');
 q.skill.send('pointerup');
 q.skill.send('pointerdown');
 q.controls.reset();
 q.skill.send('pointerup');
 assert.equal(aims.at(-1),null);
 assert.deepEqual(shots,[]);
 assert.equal(q.skill.classes.has('pressed'),false);
});
test('only an aim already in progress can complete while gameplay input is suspended',()=>{
 const shots=[];
 let canComplete=true;
 const q=setup({canAim:()=>true,canCompleteAim:()=>canComplete,onAction:(a,input)=>shots.push({a,input})});
 q.skill.send('pointerdown',{pointerId:20});
 q.skill.send('pointermove',{pointerId:20,clientY:20});
 q.setPlaying(false);
 q.skill.send('pointerup',{pointerId:20,clientY:20});
 q.skill.send('pointerdown',{pointerId:21});
 q.skill.send('pointerup',{pointerId:21});
 assert.deepEqual(shots,[{a:'skill',input:{x:0,y:-1}}]);
 q.setPlaying(true);
 q.skill.send('pointerdown',{pointerId:22});
 q.setPlaying(false);canComplete=false;
 q.skill.send('pointerup',{pointerId:22,clientY:20});
 assert.equal(shots.length,1);
});
