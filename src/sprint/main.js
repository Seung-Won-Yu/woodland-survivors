import {loadIllustratedArt} from '../art/illustrated.js';
import {createAudio} from '../game/audio.js';
import {bindTouchControls} from '../game/touch-controls.js';
import {createSprint,stepSprint,chooseSprint,sprintAction,pauseSprint,resumeSprint,takeEvents,PATHS,RULES} from './model.js';
import {createSprintRenderer} from './render.js';
const $=id=>document.getElementById(id),panel=$('panel'),audio=createAudio(),keys=new Set();
const touchQuery=matchMedia('(pointer:coarse)'),narrowQuery=matchMedia('(max-width:700px)');
let s=createSprint(),view='intro',renderer,touch={x:0,y:0},controls,rendered='',last=0,forcedPath=null,done=false;
const storageKey='woodland-sprint-v1';let saved={settings:{sound:true,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches},records:{}};
try{const raw=JSON.parse(localStorage.getItem(storageKey));if(raw&&typeof raw==='object'){saved.settings={...saved.settings,...raw.settings};saved.records=raw.records||{};}}catch{}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}}
const time=n=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
function say(text){$('announcement').textContent=text;}
function settings(){return `<div class="settings"><label><input id="sound-toggle" type="checkbox" ${saved.settings.sound?'checked':''}>효과음</label><label><input id="motion-toggle" type="checkbox" ${saved.settings.reduced?'checked':''}>흔들림·플래시 줄이기</label></div>`;}
function bindSettings(){const sound=$('sound-toggle'),motion=$('motion-toggle');if(sound)sound.onchange=()=>{saved.settings.sound=sound.checked;if(sound.checked)audio.unlock();else audio.suspend();save();};if(motion)motion.onchange=()=>{saved.settings.reduced=motion.checked;save();};}
function showPanel(html,modal=true){panel.classList.toggle('modal',modal);panel.innerHTML=html;controls?.reset();bindSettings();requestAnimationFrame(()=>panel.querySelector('button')?.focus({preventScroll:true}));}
function intro(){
 view='intro';rendered='intro';s=createSprint();panel.classList.remove('modal');
 showPanel(`<section class="intro"><span class="eyebrow">WOODLAND SURVIVORS · 전투 시제품 01</span><h1>도토리 한 발,<br><em>숲길 두 갈래.</em></h1><p>적을 꿰뚫는 사수, 지나온 길을 터뜨리는 덫꾼.<br>이번엔 어떤 다람쥐로 숲을 돌파할까요?</p><div class="path-tease"><span><b>관통 사수 ↗</b>곧게 달려, 앞을 연다</span><span><b>씨앗 덫꾼 ◉</b>돌아 나와, 길을 터뜨린다</span></div><button class="start" id="start">2분 전투 시작 <span>→</span></button><div class="control-hint">목표: 90초에 나타나는 수문장을 2분 안에 격파<br>${isTouch()?'왼손 이동 · 오른손 구르기 / 고유기 · 공격은 자동':'WASD / 방향키 이동 · SPACE 구르기 · E 고유기 · 자동 공격'}</div><div class="intro-footer">${settings()}<a class="quiet-link" href="./index.html">기존 긴 원정 ↗</a></div></section>`,false);
 $('start').onclick=()=>start();updateHud();
}
function isTouch(){return touchQuery.matches||narrowQuery.matches;}
function start({seed=crypto.getRandomValues(new Uint32Array(1))[0],path=null}={}){
 s=createSprint(seed);forcedPath=path;view='run';rendered='';done=false;keys.clear();controls.reset();panel.innerHTML='';panel.classList.remove('modal');audio.unlock();say('전투 시작. 7초 뒤 성장 경로를 고릅니다.');
}
function select(key){if(chooseSprint(s,key)){rendered='';panel.innerHTML='';panel.classList.remove('modal');say(`${s.evolution?'무기 진화':'성장 경로'}: ${PATHS[s.path].name}. 전투를 이어갑니다.`);}}
function showChoice(){
 const path=s.choice==='path';let options;
 if(path)options=[
  {key:'pierce',type:'정면 돌파',name:'관통 사수',mark:'➞ ➞ ➞',verb:'곧게 달려, 앞을 연다',body:'이동 방향의 적을 우선 사격합니다.<br>곧게 달리면 더 많은 적을 꿰뚫습니다.',cast:'<b>E 숲길 관통</b> · 정면에 다섯 줄 일제 사격'},
  {key:'trail',type:'유인 · 연쇄',name:'씨앗 덫꾼',mark:'◉ · ◉',verb:'돌아 나와, 길을 터뜨린다',body:'이동한 자리에 폭발 씨앗을 남깁니다.<br>지나온 길로 적을 유인하세요.',cast:'<b>E 연쇄 기폭</b> · 깔아 둔 씨앗을 차례로 폭발'}
 ];else if(s.path==='pierce')options=[
  {key:'crowd',type:'대군 진화',name:'갈래바람 포',mark:'➚ ➞ ➘',verb:'세 줄로 숲을 쓸어 담는다',body:'자동 사격이 넓은 세 줄로 퍼집니다.<br>세 마리를 꿰뚫으면 추가 파열.',cast:'<b>무리가 많을수록 더 큰 연속 처치</b>'},
  {key:'focus',type:'보스 진화',name:'큰뿔 파쇄포',mark:'➞ ➞',verb:'한 줄에 모든 힘을 모은다',body:'좁게 모은 관통탄으로 집중 사격.<br>수문장에게 사격 피해 +75%.',cast:'<b>돌진을 피한 뒤 빈틈에 일제 사격</b>'}
 ];else options=[
  {key:'crowd',type:'대군 진화',name:'만개하는 숲길',mark:'◉ ◉ ◉',verb:'씨앗 하나가 연쇄의 시작',body:'씨앗이 15개까지 남고 넓게 터집니다.<br>가까운 씨앗도 함께 연쇄 폭발.',cast:'<b>커다란 원으로 돌아 무리를 가둔다</b>'},
  {key:'focus',type:'보스 진화',name:'깊은뿌리 폭탄',mark:'◉ ◎',verb:'큰 적의 발밑에서 두 번',body:'씨앗이 수문장에게 맞으면 재폭발.<br>돌진 경로에 길게 깔아 두세요.',cast:'<b>보스가 지나갈 길을 미리 만든다</b>'}
 ];
 showPanel(`<section class="choice" role="dialog" aria-modal="true" aria-labelledby="choice-title"><div class="choice-head"><div><span class="eyebrow">${path?'첫 갈림길 / 01':'무기 진화 / 02'}</span><h2 id="choice-title">${path?'어떤 길을 만들까요?':'더 크게, 더 강하게.'}</h2></div><span>전투가 멈췄습니다</span></div><div class="cards">${options.map((o,i)=>`<button class="path-card ${i===1?'trail':''}" data-choice="${o.key}"><span class="number">${i+1}</span><div class="type">${o.type}</div><div class="card-mark" aria-hidden="true">${o.mark}</div><h3>${o.name}</h3><div class="verb">${o.verb}</div><p>${o.body}</p><div class="cast">${o.cast}</div></button>`).join('')}</div><div class="choice-foot"><span>${path?'재료 없이 바로 바뀝니다':'진화 충격파 · 체력 +40 · 고유기 즉시 준비'}</span><span><strong>${path?'7초':'50초'}</strong> / 2분</span></div></section>`);
 panel.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>select(button.dataset.choice));say(path?'전투 일시정지. 관통 사수 또는 씨앗 덫꾼을 고르세요.':'무기 진화. 대군 처리 또는 보스 집중을 고르세요.');
}
function showPause(){showPanel(`<section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">잠깐, 숨 고르기</span><h2 id="pause-title">숲은 기다립니다.</h2><p>목표: 2분 안에 큰뿔 수문장 격파.<br>${s.path?PATHS[s.path].verb:'7초에 첫 성장 경로를 고릅니다.'}<br>${isTouch()?'왼쪽 스틱 이동 · 오른쪽 구르기 / 고유기':'WASD 이동 · SPACE 구르기 · E 고유기 · ESC 이어하기'}</p><button class="primary" id="resume">전투 이어하기 →</button>${settings()}<div class="result-actions"><button class="secondary" id="restart">처음부터</button><button class="secondary" id="leave">시작 화면</button></div></section>`);$('resume').onclick=unpause;$('restart').onclick=()=>start({seed:s.seed,path:s.path});$('leave').onclick=intro;}
function unpause(){if(resumeSprint(s)){if(saved.settings.sound)audio.unlock();panel.innerHTML='';panel.classList.remove('modal');rendered='';}}
function togglePause(){if(view!=='run')return;if(pauseSprint(s)){keys.clear();rendered='';}else unpause();}
function showResult(){
 const r=s.result,key=`${r.path||'base'}:${r.evolution||'base'}`,prev=saved.records[key],improved=!prev||r.kills>prev.kills,firstWin=r.won&&!prev?.won;
 if(!done){saved.records[key]={kills:Math.max(prev?.kills||0,r.kills),won:!!prev?.won||r.won,bestTime:r.won?Math.min(prev?.bestTime||Infinity,r.time):prev?.bestTime||null};save();done=true;}
 const other=s.path==='trail'?'pierce':'trail',metric=s.path==='trail'?r.stats.trapKills:r.stats.multiShots;
 showPanel(`<section class="result-panel" role="dialog" aria-modal="true" aria-labelledby="result-title"><span class="eyebrow">${r.won?'수문장 격파 / 길이 열렸습니다':'다시, 다른 길로'}</span><h2 id="result-title">${r.won?'숲을 뚫었습니다.':r.reason==='time'?'조금 더 강한 한 수.':'여기서 끝은 아니죠.'}</h2><p class="result-note">${r.won?`${time(r.time)} 만에 큰뿔 수문장 격파`:r.reason==='time'?`2분 종료 · 수문장 체력 ${Math.max(0,Math.ceil((s.boss?.hp||0)/(s.boss?.maxHp||1)*100))}% 남음`:'체력이 소진되었습니다. 구르기로 포위를 빠져나와 보세요.'}</p><div class="result-path">${PATHS[s.path]?.name||'도토리 사격'}${s.evolution?` · ${s.evolution==='crowd'?'대군 진화':'보스 진화'}`:''}</div><div class="result-stats"><div><strong>${r.kills}</strong><span>처치</span></div><div><strong>${r.bestCombo}</strong><span>최대 연속</span></div><div><strong>${metric}</strong><span>${s.path==='trail'?'씨앗으로 처치':'3마리 이상 관통'}</span></div></div><p class="result-record">${firstWin?'첫 돌파 기록! · ':improved?'처치 신기록 · ':''}이 경로 최고 ${saved.records[key].kills} 처치${saved.records[key].bestTime?` / ${time(saved.records[key].bestTime)} 돌파`:''}<br>같은 숲을 다른 성장으로 다시 공략해 보세요.</p><button class="primary" id="other-path">${PATHS[other].name}${other==='trail'?'으로':'로'} 바로 재도전 →</button><div class="result-actions"><button class="secondary" id="same-path">같은 경로 · 같은 숲</button><button class="secondary" id="new-run">새 숲에서 선택</button><button class="secondary" id="leave">시작 화면</button></div></section>`);
 const seed=s.seed,path=s.path;$('other-path').onclick=()=>start({seed,path:other});$('same-path').onclick=()=>start({seed,path});$('new-run').onclick=()=>start();$('leave').onclick=intro;say(r.won?'수문장 격파. 다른 성장 경로로 재도전할 수 있습니다.':'전투 종료. 다른 성장 경로로 재도전할 수 있습니다.');
}
function updateHud(){
 const run=view==='run',active=run&&s.phase==='playing';for(const id of ['battle-hud','branch-hud','actions'])$(id).hidden=!run;
 $('stick').hidden=!active||!isTouch();$('boss-hud').hidden=!run||!s.boss||s.boss.dead;$('combo').hidden=!active||s.combo<5;
 $('rank').textContent=`성장 ${s.level}`;$('hp-fill').style.width=`${s.player.hp}%`;$('hp-text').textContent=`${Math.ceil(s.player.hp)} / 100`;
 $('clock').textContent=time(Math.ceil(RULES.duration-s.t));$('stage').textContent=s.bossSpawned?'수문장을 쓰러뜨려라':`수문장까지 ${time(Math.ceil(RULES.bossAt-s.t))}`;$('kills').textContent=s.kills;
 if(s.boss){$('boss-fill').style.width=`${Math.max(0,s.boss.hp/s.boss.maxHp*100)}%`;$('boss-hint').textContent=s.boss.mode==='windup'?'돌진 예고 · 옆으로 피하세요':s.boss.mode==='recover'?'빈틈! 지금은 피해 ×1.5':'길을 비켜라 · 돌진 뒤가 기회';}
 $('branch-name').textContent=s.path?`${PATHS[s.path].name}${s.evolution?' · 진화':''}`:'도토리 사격';
 $('branch-tip').textContent=s.path==='trail'?`씨앗 ${s.mines.length}개 · 지나온 길로 적을 유인하세요`:s.path==='pierce'?(s.player.straight>.45?'관통 충전 · 앞을 뚫으세요':'곧게 달리면 관통이 강해집니다'):'경험치를 모으세요 · 7초에 첫 갈림길';
 $('xp-fill').style.width=`${Math.min(100,s.xp/(8+s.level*5)*100)}%`;$('combo').textContent=`${s.combo} 연속 처치`;
 $('dash').disabled=!active||s.player.dashCd>0;$('dash').querySelector('span').textContent=s.player.dashCd>0?`${s.player.dashCd.toFixed(1)}초`:'준비';
 const usable=s.path&&(s.path!=='trail'||s.mines.length>0);$('skill').disabled=!active||!usable||s.player.skillCd>0;$('skill').querySelector('b').textContent=s.path?PATHS[s.path].skill:'성장 대기';$('skill').querySelector('span').textContent=!s.path?'7초에 개방':s.player.skillCd>0?`${s.player.skillCd.toFixed(1)}초`:!usable?'씨앗을 남기세요':'준비';
 $('skill').setAttribute('aria-label',`${s.path?PATHS[s.path].skill:'성장 대기'}, ${$('skill').querySelector('span').textContent}`);
}
function input(){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);return x||y?{x,y}:touch;}
function act(action){if(saved.settings.sound)audio.unlock();sprintAction(s,action);}
function frame(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;
 if(view==='run'){
  stepSprint(s,dt,input());
  if(s.phase==='choice'&&s.choice==='path'&&forcedPath){chooseSprint(s,forcedPath);forcedPath=null;}
  if(rendered!==s.phase){rendered=s.phase;if(s.phase==='choice')showChoice();else if(s.phase==='paused')showPause();else if(s.phase==='result')showResult();}
 }
 renderer.draw(s,{reduced:saved.settings.reduced,menu:view==='intro'});updateHud();const events=new Set(takeEvents(s));if(saved.settings.sound)for(const event of events)audio.play(event,'acorn',!!s.evolution);requestAnimationFrame(frame);
}
controls=bindTouchControls({stick:$('stick'),actions:{dash:$('dash'),skill:$('skill')},canPlay:()=>view==='run'&&s.phase==='playing',onMove:v=>{touch=v;},onAction:act,onUnlock:()=>{if(saved.settings.sound)audio.unlock();}});
$('pause').onclick=togglePause;
document.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
 if(e.key==='Tab'&&panel.classList.contains('modal')){const list=[...panel.querySelectorAll('button,a,input')].filter(el=>!el.disabled),first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
 if(e.target instanceof HTMLInputElement)return;
 keys.add(key);if(e.repeat)return;
 if(key==='escape'){e.preventDefault();togglePause();}
 if(view==='run'&&s.phase==='choice'&&['1','2'].includes(key)){panel.querySelectorAll('[data-choice]')[Number(key)-1]?.click();return;}
 if(view==='run'&&s.phase==='playing'){if(key===' '){e.preventDefault();act('dash');}else if(key==='e')act('skill');}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function release(){keys.clear();controls.reset();if(view==='run')pauseSprint(s);}
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();audio.suspend();}});
window.addEventListener('resize',()=>{controls.reset();renderer?.resize();});
try{const art=await loadIllustratedArt();renderer=createSprintRenderer($('sprint'),art);intro();requestAnimationFrame(frame);}catch(error){console.error(error);showPanel('<section class="pause-panel"><h2>숲을 불러오지 못했습니다.</h2><p>원화 파일을 불러오지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.</p><button class="primary" id="reload">다시 불러오기</button></section>');$('reload').onclick=()=>location.reload();}
