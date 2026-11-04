import {HEROES,WEAPONS,PASSIVES,formatTime} from './core/content.js';
import {stepGame,applyChoice,reroll,selectChest,closeChest,pauseGame,resumeGame,xpCost} from './core/game.js';
import {createExpedition,interact,nearestSite,takeSupply,updateExpedition,expeditionObjective,SAVE_KEY} from './game/expedition.js';
import {createRenderer} from './game/render.js';
import {loadIllustratedArt} from './art/illustrated.js';
import {drawHero} from './art/sprites.js';
import {createAudio,selectAudioEvents} from './game/audio.js';
const $=id=>document.getElementById(id),overlay=$('overlay'),canvas=$('world'),audio=createAudio();
overlay.innerHTML='<div class="loading-art" role="status">수호대와 새벽숲을 준비하고 있습니다…</div>';
const art=await loadIllustratedArt().catch(error=>{overlay.innerHTML='<div class="loading-art" role="alert">그림을 읽지 못했습니다. 새로고침해 주세요.</div>';throw error;});
const renderer=createRenderer(canvas,$('map'),art);
let selected='pip',selectedWeapon='acorn',muted=false;
try{const settings=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');if(Object.hasOwn(HEROES,settings.hero))selected=settings.hero;selectedWeapon=Object.hasOwn(WEAPONS,settings.weapon)&&!WEAPONS[settings.weapon].union?settings.weapon:HEROES[selected].weapon;muted=settings.muted===true;}catch{}
let game=createExpedition(selected,selectedWeapon);game.phase='camp';game.enemies=[];
let lastPhase='',keys=new Set(),touch={x:0,y:0},pulse={skill:false,dash:false},hudClock=0,last=performance.now(),runNumber=0,pointer=null;
const touchMode=()=>matchMedia('(pointer:coarse)').matches||innerWidth<600;
function clearInput(){keys.clear();touch={x:0,y:0};pulse={skill:false,dash:false};if(pointer!==null){try{$('joystick').releasePointerCapture(pointer);}catch{}pointer=null;}$('joystick').firstElementChild.style.transform='';}
function settings(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({hero:selected,weapon:selectedWeapon,muted}));}catch{}}
function sound(type){if(!muted)audio.play(type);}
function drawPortrait(target,id){const c=target.getContext('2d'),b=renderer.atlas.portraitBounds[HEROES[id].row],scale=Math.min((target.width-6)/b.w,(target.height-4)/b.h);c.clearRect(0,0,target.width,target.height);c.imageSmoothingEnabled=true;c.drawImage(renderer.atlas,b.x,b.y,b.w,b.h,(target.width-b.w*scale)/2,target.height-b.h*scale-1,b.w*scale,b.h*scale);}
function icon(target,id){
  const c=target.getContext('2d'),w=target.width;c.clearRect(0,0,w,w);c.save();c.translate(w/2,w/2);c.fillStyle=WEAPONS[id]?.color||PASSIVES[id]?.color||'#ccb680';
  if(id==='acorn'){c.fillRect(-5,-4,10,12);c.fillStyle='#886345';c.fillRect(-7,-7,14,5);c.fillStyle='#cfca8b';c.fillRect(-1,-10,2,4);}
  else if(id==='moon'||id==='returning'){c.beginPath();c.moveTo(-3,-10);c.lineTo(7,-6);c.lineTo(11,2);c.lineTo(6,10);c.lineTo(-3,11);c.lineTo(2,4);c.lineTo(2,-3);c.fill();}
  else if(id==='briar'){for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.fillRect(5,-2,5,5);}c.fillRect(-3,-3,6,6);}
  else if(id==='lantern'){c.fillRect(-6,-5,12,15);c.fillStyle='#ddc78f';c.fillRect(-4,-9,8,4);c.fillStyle='#d3e8b0';c.fillRect(-2,-2,3,8);}
  else if(id==='storm'){c.beginPath();c.moveTo(1,-11);c.lineTo(-7,2);c.lineTo(0,2);c.lineTo(-3,12);c.lineTo(9,-3);c.lineTo(2,-3);c.fill();}
  else if(id==='bees'||id==='hive'){c.fillStyle='#c5daba';c.fillRect(-5,-10,6,6);c.fillRect(2,-10,6,6);c.fillStyle='#d9b762';c.fillRect(-6,-3,14,8);c.fillStyle='#514c35';c.fillRect(-1,-3,3,8);}
  else{for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.fillRect(3,-3,6,6);}c.fillStyle='#d6b866';c.fillRect(-3,-3,6,6);}
  c.restore();
}
function start(){settings();game=createExpedition(selected,selectedWeapon,1437+runNumber++);lastPhase='';clearInput();audio.unlock();sound('choose');syncPhase();canvas.focus();}
function camp(){selectedWeapon=game.startWeapon||selectedWeapon;game=createExpedition(selected,selectedWeapon);game.phase='camp';game.enemies=[];lastPhase='';clearInput();syncPhase();}
function campMarkup(){return `<section class="camp"><div class="camp-content"><div class="brand">WOODLAND SURVIVORS</div><h1>동물 수호대</h1><p class="subtitle">새벽숲 정찰 원정</p><div class="party" role="group" aria-label="출전 대원 선택">${Object.entries(HEROES).map(([id,h])=>`<button data-hero="${id}" aria-label="${h.name} 선택" aria-pressed="${id===selected}"><canvas width="72" height="72" data-portrait="${id}"></canvas></button>`).join('')}</div><div class="character-name"><h2>${HEROES[selected].name}</h2><span>${HEROES[selected].trait}</span></div><p class="character-text">${HEROES[selected].detail}<br><span style="color:#ddc88d">E · ${HEROES[selected].skill}</span></p><div class="loadout"><label for="starting-weapon">공용 시작 무기</label><select id="starting-weapon">${Object.entries(WEAPONS).filter(([,w])=>!w.union).map(([id,w])=>`<option value="${id}" ${selectedWeapon===id?'selected':''}>${w.name}</option>`).join('')}</select></div><button class="primary" id="start">숲으로 출발 <span>→</span></button><div class="camp-notes"><span>3분 생존 후 야영지로 귀환<br>갈림길 탐색 · 교전 · 성장</span><span>WASD 이동 · 자동 공격<br>SPACE 구르기 · E 고유기</span></div></div><div class="camp-location"><span>첫 번째 원정지</span><b>새벽숲, 잃어버린 보급로</b></div><span class="version">전투 개발판 0.4 · 여섯 대원 / 여덟 공용 무기</span></section>`;}
function dialog(title,eyebrow,body,actions=''){return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2>${body}${actions?`<div class="dialog-actions">${actions}</div>`:''}</section></div>`;}
function inventory(){return `<div class="inventory">${Object.entries(game.weapons).map(([id,w])=>`<div class="inventory-row"><span>${w.evolved?WEAPONS[id].evo:WEAPONS[id].name}</span><span>${w.evolved?'✦ 진화':`${w.rank} / ${WEAPONS[id].max}단계`}</span><small>${WEAPONS[id].union?'합체 무기':`진화: 8단계 + ${PASSIVES[WEAPONS[id].recipe].name} ${game.passives[WEAPONS[id].recipe]?'✓':'필요'} → 둥지 상자`}</small></div>`).join('')}${Object.entries(game.passives).map(([id,n])=>`<div class="inventory-row"><span>${PASSIVES[id].name}</span><span>${n}단계</span><small>${PASSIVES[id].description}</small></div>`).join('')}</div>`;}
function expeditionSummary(){
  const ex=game.expedition,nest=ex.sites.find(s=>s.id==='nest'),spring=ex.sites.find(s=>s.id==='spring');
  return `<div class="expedition-summary"><span>보급 장비 <b>${game.gear==='boots'?'순찰 장화':game.gear==='bark'?'나무껍질 망토':'남겨둠'}</b></span><span>위험 둥지 <b>${nest.state==='spent'?'상자 확보':nest.state==='cleared'?'처치 · 상자 미회수':nest.state==='active'?'지휘관 미처치':'도전하지 않음'}</b></span><span>회복 샘 <b>${spring.state==='spent'?'사용함':'남겨둠'}</b></span></div>`;
}
function syncPhase(){
  if(lastPhase===game.phase)return;
  lastPhase=game.phase;clearInput();
  const inCamp=game.phase==='camp';for(const id of ['hud','objective','controls'])$(id).hidden=inCamp;$('joystick').hidden=inCamp||!touchMode();
  for(const id of ['hud','controls','joystick'])$(id).inert=game.phase!=='playing';
  if(game.phase==='playing'){overlay.innerHTML='';return;}
  $('interact-wrap').hidden=true;
  if(inCamp){
    overlay.innerHTML=campMarkup();for(const target of document.querySelectorAll('[data-portrait]'))drawPortrait(target,target.dataset.portrait);
    document.querySelectorAll('[data-hero]').forEach(button=>button.onclick=()=>{selected=button.dataset.hero;selectedWeapon=HEROES[selected].weapon;game.hero=selected;game.startWeapon=selectedWeapon;game.weapons={[selectedWeapon]:{rank:1,evolved:false,clock:0}};game.player.aim=0;lastPhase='';syncPhase();settings();document.querySelector(`[data-hero="${selected}"]`).focus();});
    $('starting-weapon').onchange=e=>{selectedWeapon=e.target.value;game.weapons={[selectedWeapon]:{rank:1,evolved:false,clock:0}};game.startWeapon=selectedWeapon;settings();};$('start').onclick=start;return;
  }
  if(game.phase==='choice'){
    overlay.innerHTML=dialog('숲의 힘을 빌리세요',`성장 · LEVEL ${game.level}`,`<p>공격을 더하거나, 지금의 무기를 강하게 만드세요.</p><div class="choices">${game.choices.map((choice,i)=>{const d=(choice.kind==='weapon'?WEAPONS:PASSIVES)[choice.id],rank=choice.kind==='weapon'?game.weapons[choice.id]?.rank||0:game.passives[choice.id]||0;return `<button class="choice" data-choice="${i}"><kbd>${i+1}</kbd><span><b>${d.name}</b><small>${d.description}</small></span><em>${rank?`${rank} → ${rank+1}단계`:'새로 장착'}</em></button>`;}).join('')}</div>`,`<button class="quiet" id="reroll" ${game.rerolls?'':'disabled'}>다시 찾기 · ${game.rerolls}회</button><span class="eyebrow">시간이 멈췄습니다</span>`);
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));$('reroll').onclick=()=>{reroll(game);lastPhase='';syncPhase();};
  }else if(game.phase==='supply'){
    if(game.pendingSupplyGear){
      overlay.innerHTML=dialog('촉매를 넣을 자리를 고르세요','보조 장비 · 6칸 사용 중',`<p>${PASSIVES[WEAPONS[game.startWeapon].recipe].name} 촉매와 바꿀 보조 하나를 고르세요.</p><div class="choices">${Object.entries(game.passives).map(([id,n],i)=>`<button class="choice" data-replace="${id}"><kbd>${i+1}</kbd><span><b>${PASSIVES[id].name} · ${n}단계</b><small>${PASSIVES[id].description}</small></span><em>교체</em></button>`).join('')}</div>`,`<button class="quiet" id="later">보급을 남겨두기</button>`);
      document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>supplyChoice(game.pendingSupplyGear,b.dataset.replace));$('later').onclick=()=>{delete game.pendingSupplyGear;game.phase='playing';syncPhase();};
      overlay.querySelector('.choice')?.focus();return;
    }
    overlay.innerHTML=dialog('남겨진 보급 꾸러미','탐색 보상 · 장비 하나 선택',`<p>공통 보상: ${WEAPONS[game.startWeapon].name} +1단계와 진화 촉매.<br>어떻게 숲을 돌파할지 장비를 고르세요.</p><div class="choices"><button class="choice" data-gear="boots"><kbd>1</kbd><span><b>순찰 장화</b><small>이동 속도 +12% · 이동 중 공격 주기 −10%<br>계속 움직이며 경험치를 회수하기 좋습니다.</small></span><em>기동</em></button><button class="choice" data-gear="bark"><kbd>2</kbd><span><b>나무껍질 망토</b><small>0.5초 멈춘 뒤 받는 피해 −3<br>좁은 길에서 버티며 적을 모으기 좋습니다.</small></span><em>진지</em></button></div>`,`<button class="quiet" id="later">보급을 남겨두기</button>`);
    document.querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>supplyChoice(b.dataset.gear));$('later').onclick=()=>{game.phase='playing';syncPhase();};
  }else if(game.phase==='chest'){
    const chest=game.chest,options=chest.options;
    overlay.innerHTML=dialog(options.length?'모인 힘이 깨어납니다':'숲이 내어준 전리품',options.length?'진화 / 합체':'보상 확보',options.length?`${chest.rewards.length?`<p>${chest.rewards.map(r=>`${WEAPONS[r.id].name} +${r.amount||1}단계`).join(' · ')} · 둥지 보상</p>`:''}<div class="choices">${options.map((o,i)=>`<button class="choice" data-evolve="${o.id}"><kbd>${i+1}</kbd><span><b>${o.name}</b><small>${o.description}</small></span><em>${o.kind==='union'?'합체':'진화'}</em></button>`).join('')}</div>`:`<p>${chest.rewards.map(r=>`${r.evolved?WEAPONS[r.id].evo:WEAPONS[r.id].name} ${r.evolved?'✦':`+${r.amount||1}단계`}`).join('<br>')||'무기 보상을 모두 익혔습니다.'}<br>보급 금화 +${chest.gold}</p>`,options.length?'':`<button class="primary" id="close-chest">다시 전장으로 →</button>`);
    document.querySelectorAll('[data-evolve]').forEach(b=>b.onclick=()=>{selectChest(game,b.dataset.evolve);sound('evolve');lastPhase='';syncPhase();});if($('close-chest'))$('close-chest').onclick=()=>{closeChest(game);syncPhase();};
  }else if(game.phase==='paused'){
    overlay.innerHTML=dialog('잠깐, 숲의 숨을 고르며','원정 일시정지',`<p>${game.pauseReason==='focus'?'창을 떠나 전투를 멈췄습니다.':`${formatTime(game.time)} · ${game.kills} 처치 · ${game.gear?game.gear==='boots'?'순찰 장화':'나무껍질 망토':'장비 미획득'}`}</p>${inventory()}`,`<div><button class="quiet" id="leave">야영지로 돌아가기</button><button class="quiet" id="mute" style="margin-left:15px">소리 ${muted?'켜기':'끄기'}</button></div><button class="primary" id="resume">계속 원정 →</button>`);
    $('resume').onclick=()=>{audio.unlock();resumeGame(game);syncPhase();};$('leave').onclick=camp;$('mute').onclick=()=>{muted=!muted;if(muted)audio.suspend();else audio.unlock();settings();lastPhase='';syncPhase();};
  }else if(game.phase==='result'){
    const success=game.outcome==='scouted';overlay.innerHTML=dialog(success?'모두 무사히, 야영지로':'숲에 잠시 발을 내딛었습니다',success?'3분 정찰 완료':'원정 종료',`<p>${success?'수호대가 보급로를 확인했습니다. 다른 대원과 공용 무기 조합으로 다시 출발할 수 있습니다.':'경험치를 회수하며 성장하고, 보급과 샘을 활용해 다음 길을 찾아보세요.'}</p><div class="result-stats"><span>원정 시간<b>${formatTime(game.time)}</b></span><span>처치<b>${game.kills}</b></span><span>성장<b>Lv.${game.level}</b></span></div>${expeditionSummary()}${inventory()}`,`<button class="quiet" id="return">대원 바꾸기</button><button class="primary" id="retry">다시 출발 →</button>`);$('return').onclick=camp;$('retry').onclick=start;
  }
  const focus=overlay.querySelector('.choice,.primary');if(focus)focus.focus({preventScroll:true});
}
function choose(index){if(applyChoice(game,index)){sound('choose');lastPhase='';syncPhase();}}
function supplyChoice(gear,replace=null){if(takeSupply(game,gear,replace))sound('choose');lastPhase='';syncPhase();}
function pause(reason='manual'){if(pauseGame(game,reason)){audio.suspend();syncPhase();}}
function togglePause(){if(game.phase==='playing')pause();else if(game.phase==='paused'){audio.unlock();resumeGame(game);syncPhase();}}
$('pause').onclick=togglePause;$('interact').onclick=()=>{interact(game);syncPhase();};$('skill').onclick=()=>{pulse.skill=true;audio.unlock();};$('dash').onclick=()=>{pulse.dash=true;audio.unlock();};
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(e.target.tagName==='SELECT')return;
  if(k==='tab'&&overlay.querySelector('[role="dialog"]')){const focusable=[...overlay.querySelectorAll('button:not(:disabled),select')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','escape'].includes(k))e.preventDefault();
  if(e.repeat)return;if(k==='escape'){togglePause();return;}
  if(game.phase==='choice'&&['1','2','3'].includes(k)){choose(Number(k)-1);return;}
  if(game.phase==='supply'&&game.pendingSupplyGear&&['1','2','3','4','5','6'].includes(k)){supplyChoice(game.pendingSupplyGear,Object.keys(game.passives)[Number(k)-1]);return;}
  if(game.phase==='supply'&&['1','2'].includes(k)){supplyChoice(k==='1'?'boots':'bark');return;}
  if(game.phase==='playing'){
    if(k==='f'){interact(game);syncPhase();return;}if(k==='e')pulse.skill=true;if(k===' ')pulse.dash=true;
    keys.add(k);
  }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInput();pause('focus');});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause('focus');}});
window.addEventListener('resize',()=>{clearInput();$('joystick').hidden=game.phase==='camp'||!touchMode();});window.addEventListener('orientationchange',clearInput);
const joystick=$('joystick');
function moveTouch(e){if(e.pointerId!==pointer)return;const box=joystick.getBoundingClientRect(),x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2,l=Math.hypot(x,y),r=Math.min(32,l);touch={x:l>4?x/(l||1)*Math.min(1,l/30):0,y:l>4?y/(l||1)*Math.min(1,l/30):0};joystick.firstElementChild.style.transform=`translate(${x/(l||1)*r}px,${y/(l||1)*r}px)`;}
joystick.addEventListener('pointerdown',e=>{if(game.phase!=='playing')return;pointer=e.pointerId;joystick.setPointerCapture(pointer);moveTouch(e);audio.unlock();});joystick.addEventListener('pointermove',moveTouch);
for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,()=>{pointer=null;touch={x:0,y:0};joystick.firstElementChild.style.transform='';});
const xp=document.createElement('div');xp.className='xp-track';xp.innerHTML='<i></i>';document.body.append(xp);
function updateHUD(){
  const p=game.player;drawPortrait($('avatar'),game.hero);
  $('hero-name').textContent=HEROES[game.hero].name;$('level').textContent=`Lv.${game.level}`;$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('time').textContent=formatTime(game.time);$('kills').textContent=`${game.kills} 처치`;
  xp.hidden=game.phase==='camp';xp.firstElementChild.style.width=`${game.xp/xpCost(game.level)*100}%`;
  const signature=HEROES[game.hero].skill;$('skill').querySelector('b').textContent=signature;$('skill').querySelector('span').textContent=p.charge>=100?'준비 완료':`${Math.floor(p.charge)}%`;$('skill').classList.toggle('ready',p.charge>=100);$('skill').disabled=game.phase!=='playing'||p.charge<100;
  $('dash').querySelector('span').textContent=p.dashCooldown>0?`${p.dashCooldown.toFixed(1)}초`:'준비 완료';$('dash').disabled=game.phase!=='playing'||p.dashCooldown>0;
  const slots=Object.entries(game.weapons),signatureKey=slots.map(([id,w])=>`${id}${w.rank}${w.evolved}`).join();
  if($('weapons').dataset.signature!==signatureKey){$('weapons').dataset.signature=signatureKey;$('weapons').innerHTML=Array.from({length:6},(_,i)=>slots[i]?`<div class="weapon-slot" title="${WEAPONS[slots[i][0]].name} ${slots[i][1].rank}단계"><canvas width="28" height="28" data-item="${slots[i][0]}"></canvas><small>${slots[i][1].evolved?'✦':slots[i][1].rank}</small></div>`:'<div class="weapon-slot empty"></div>').join('');document.querySelectorAll('[data-item]').forEach(c=>icon(c,c.dataset.item));}
  const {title,detail}=expeditionObjective(game);
  $('objective-title').textContent=title;$('objective-detail').textContent=detail;
  const site=nearestSite(game);$('interact-wrap').hidden=!site||game.phase!=='playing';if(site)$('interact').querySelector('span').textContent=site.id==='camp'?(game.time>=180?'원정 마치기':'야영지 확인'):site.id==='nest'?'둥지 깨우기':site.id==='spring'?'샘에서 회복':site.state==='guarded'?'보급 주위 버섯 제거':'보급 열기';
  const toast=game.expedition.toast&&game.time<game.expedition.toastUntil&&game.phase==='playing';$('message').hidden=!toast;if(toast)$('message').textContent=game.expedition.toast;
}
function frame(now){
  const dt=Math.min((now-last)/1000,.04);last=now;
  if(game.phase==='playing'){
    const x=touch.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y=touch.y+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    stepGame(game,dt,{x,y,...pulse});pulse={skill:false,dash:false};updateExpedition(game);
    if(!muted){const aliases={shot:'acorn-shot',impact:'wood-impact',slash:'swing',zap:'rune-hit',signature:'burst',eliteDown:'elite-break',evolution:'evolve',union:'evolve'};const events=new Set(game.events.map(e=>aliases[e.type]||e.type));for(const event of selectAudioEvents(events))audio.play(event);}
    game.events=[];
  }
  syncPhase();renderer.render(game,dt);hudClock-=dt;if(hudClock<=0){updateHUD();hudClock=.07;}
  requestAnimationFrame(frame);
}
// Read-only instrumentation for local browser verification; gameplay uses the same model.
window.__woodland={snapshot:()=>({phase:game.phase,time:game.time,hero:game.hero,hp:game.player.hp,x:game.player.x,y:game.player.y,walk:game.player.walk,level:game.level,kills:game.kills,weapons:structuredClone(game.weapons),gear:game.gear,sites:game.expedition.sites.map(s=>({id:s.id,state:s.state})),audio:audio.state()}),atlas:()=>renderer.atlas.toDataURL()};
syncPhase();updateHUD();requestAnimationFrame(frame);
