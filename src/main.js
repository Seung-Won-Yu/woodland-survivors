import {HEROES,WEAPONS,UNIONS,PASSIVES,formatTime} from './core/content.js';
import {stepGame,applyChoice,reroll,selectChest,closeChest,pauseGame,resumeGame,continueCampaign,retreat,xpCost} from './core/game.js';
import {createCampaignExpedition as createExpedition,interact,nearestSite,takeSupply,updateExpedition,expeditionObjective,SAVE_KEY} from './game/expedition.js';
import {createRenderer} from './game/render.js';
import {loadIllustratedArt} from './art/illustrated.js';
import {drawHero} from './art/sprites.js';
import {createAudio,selectAudioEvents} from './game/audio.js';
import {RELICS,RELIC_IDS,equipRelic,leaveRelicCache,relicReadout} from './core/relics.js';
import {JOURNAL_KEY,normalizeJournal,discoverRelics,recordRun} from './game/journal.js';
import {SYNERGIES,activeSynergies,masteredSynergies,synergyMastered,MASTERY_TEXT} from './core/synergies.js';
import {relicCard,relicChoicesBody,fusionBook,fusionHint,chestView} from './game/reward-ui.js';
import {campaignStage,bankCampaign} from './core/campaign.js';
const $=id=>document.getElementById(id),overlay=$('overlay'),canvas=$('world'),audio=createAudio();
overlay.innerHTML='<div class="loading-art" role="status">수호대와 새벽숲을 준비하고 있습니다…</div>';
const art=await loadIllustratedArt().catch(error=>{overlay.innerHTML='<div class="loading-art" role="alert">그림을 읽지 못했습니다. 새로고침해 주세요.</div>';throw error;});
const renderer=createRenderer(canvas,$('map'),art);
let selected='pip',selectedWeapon='acorn',muted=false;
let journal=normalizeJournal(null);try{journal=normalizeJournal(JSON.parse(localStorage.getItem(JOURNAL_KEY)));}catch{}
try{const settings=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');if(Object.hasOwn(HEROES,settings.hero))selected=settings.hero;selectedWeapon=Object.hasOwn(WEAPONS,settings.weapon)&&!WEAPONS[settings.weapon].union?settings.weapon:HEROES[selected].weapon;muted=settings.muted===true;}catch{}
let game=createExpedition(selected,selectedWeapon);game.phase='camp';game.enemies=[];
let lastPhase='',keys=new Set(),touch={x:0,y:0},pulse={skill:false,dash:false},hudClock=0,last=performance.now(),pointer=null;
const touchMode=()=>matchMedia('(pointer:coarse)').matches||innerWidth<600;
function clearInput(){keys.clear();touch={x:0,y:0};pulse={skill:false,dash:false};if(pointer!==null){try{$('joystick').releasePointerCapture(pointer);}catch{}pointer=null;}$('joystick').firstElementChild.style.transform='';}
function settings(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({hero:selected,weapon:selectedWeapon,muted}));}catch{}}
function saveJournal(){try{localStorage.setItem(JOURNAL_KEY,JSON.stringify(journal));}catch{}}
function weaponHint(id){return Object.values(SYNERGIES).filter(s=>s.weapons.includes(id)&&game.relics.items.includes(s.relic)).map(s=>`<small class="build-hint complete">${game.weapons[id]?'연계 중':'선택하면 연계 완성'} · ${s.name}<br>${s.description}</small>`).join('')+fusionHint(game,id);}
function loadoutHint(){const recipe=Object.values(UNIONS).find(r=>r.inputs.some(i=>i.id===selectedWeapon));return `연계 유물 · ${Object.values(SYNERGIES).filter(s=>s.weapons.includes(selectedWeapon)).map(s=>RELICS[s.relic].name).join(' / ')}${recipe?`<br>${recipe.inputs.map(i=>WEAPONS[i.id].name).join(' ＋ ')} → ${recipe.name}`:''}`;}
function synergyInventory(){const ids=activeSynergies(game);return ids.length?`<div class="build-summary"><span class="eyebrow">완성된 무기 · 유물 연계</span>${ids.map(id=>`<p><b>${synergyMastered(game,id)?'✦ 각성 · ':''}${SYNERGIES[id].name}</b> · ${game.synergies.stats[id].procs}회<br><small>${synergyMastered(game,id)?MASTERY_TEXT[id]:SYNERGIES[id].description}</small></p>`).join('')}</div>`:'';}
function synergyReport(){const ids=game.synergies.discovered;return ids.length?`<div class="build-summary"><span class="eyebrow">이번 원정에서 시험한 연계</span>${ids.map(id=>`<p><b>${SYNERGIES[id].name}</b> · ${game.synergies.stats[id].procs}회 · ${id==='bramble'?'감속 지대':`추가 피해 ${Math.round(game.synergies.stats[id].damage)}`}</p>`).join('')}</div>`:'';}
function campaignReport(){const c=game.campaign,top=Object.entries(game.metrics.weapons||{}).map(([id,stages])=>({id,damage:Object.values(stages).reduce((sum,s)=>sum+s.damage,0)})).sort((a,b)=>b.damage-a.damage).slice(0,3);return `<div class="campaign-report"><div><span>수문장</span><b>${c.mid.defeatedAt!==null?formatTime(c.mid.defeatedAt):'미격파'}</b></div><div><span>버섯왕</span><b>${c.final.defeatedAt!==null?formatTime(c.final.defeatedAt):'미격파'}</b></div><div><span>각성 무기 / 연계</span><b>${Object.values(game.weapons).filter(w=>w.evolved).length} / ${masteredSynergies(game).length}</b></div></div>${top.length?`<div class="build-summary"><span class="eyebrow">가장 활약한 무기</span>${top.map(w=>`<p>${game.weapons[w.id]?.evolved?WEAPONS[w.id].evo:WEAPONS[w.id].name} · 피해 ${Math.round(w.damage)}</p>`).join('')}</div>`:''}`;}
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
function start(seed=null){settings();const fresh=Number.isInteger(seed)?seed>>>0:crypto.getRandomValues(new Uint32Array(1))[0];game=createExpedition(selected,selectedWeapon,fresh);lastPhase='';clearInput();audio.unlock();sound('choose');syncPhase();canvas.focus();}
function camp(){selectedWeapon=game.startWeapon||selectedWeapon;game=createExpedition(selected,selectedWeapon);game.phase='camp';game.enemies=[];lastPhase='';clearInput();syncPhase();}
function campMarkup(){return `<section class="camp"><div class="camp-content"><div class="brand">WOODLAND SURVIVORS</div><h1>동물 수호대</h1><p class="subtitle">새벽을 지키는 원정</p><div class="party" role="group" aria-label="출전 대원 선택">${Object.entries(HEROES).map(([id,h])=>`<button data-hero="${id}" aria-label="${h.name} 선택" aria-pressed="${id===selected}"><canvas width="72" height="72" data-portrait="${id}"></canvas></button>`).join('')}</div><div class="character-name"><h2>${HEROES[selected].name}</h2><span>${HEROES[selected].trait}</span></div><p class="character-text">${HEROES[selected].detail}<br><span style="color:#ddc88d">E · ${HEROES[selected].skill}</span></p><div class="loadout"><label for="starting-weapon">공용 시작 무기</label><select id="starting-weapon">${Object.entries(WEAPONS).filter(([,w])=>!w.union).map(([id,w])=>`<option value="${id}" ${selectedWeapon===id?'selected':''}>${w.name}</option>`).join('')}</select></div><p class="loadout-hint" id="loadout-hint">${loadoutHint()}</p><button class="primary" id="start">숲으로 출발 <span>→</span></button><p class="journal-note">최고 ${journal.bestStage}단계 · 최다 ${journal.bestKills}처치 · 유물 발견 ${journal.discovered.length}/6 · 연계 ${journal.synergies.length}/6${journal.bestLevel?` · 최고 Lv.${journal.bestLevel}`:''}<br><span>첫 목표: 수문장 → 무기 각성 → 버섯왕 격파</span></p>${journalMarkup()}<div class="camp-notes"><span>첫 숲 약 8분 · 버섯왕을 잡아 돌파<br>그다음은 시간제한 없는 강화 공세와 기록 도전</span><span>WASD 이동 · 자동 공격<br>SPACE 구르기 · E 고유기</span></div></div><div class="camp-location"><span>첫 번째 원정지</span><b>새벽숲, 잃어버린 보급로</b></div><span class="version">원정 개발판 0.7 · 첫 돌파, 그리고 다음 한계</span></section>`;}
function dialog(title,eyebrow,body,actions=''){return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2>${body}${actions?`<div class="dialog-actions">${actions}</div>`:''}</section></div>`;}
function journalMarkup(){return journal.runs.length?`<details class="journal-history"><summary>원정 수첩 · 최근 ${journal.runs.length}회</summary><ol>${journal.runs.map(r=>`<li>${HEROES[r.hero].name} · ${r.cleared?`${r.stage}단계 돌파`:r.returned?'정찰 귀환':'종료'} · Lv.${r.level} · ${formatTime(r.time)}<br><small>${r.relics.map(id=>RELICS[id].name).join(' + ')||'유물 없이'}${r.synergies.length?` · ${r.synergies.map(id=>SYNERGIES[id].name).join(' / ')}`:''} · 시드 ${r.seed}</small></li>`).join('')}</ol><p>발견한 유물: ${journal.discovered.map(id=>RELICS[id].name).join(' · ')||'아직 없음'}<br>이 브라우저에 기록합니다. 다음 원정은 같은 기본 능력으로 시작합니다.</p></details>`:'';}
function inventory(){return `<div class="inventory">${Object.entries(game.weapons).map(([id,w])=>`<div class="inventory-row"><span>${w.evolved?WEAPONS[id].evo:WEAPONS[id].name}</span><span>${w.evolved?'✦ 진화':`${w.rank} / ${WEAPONS[id].max}단계`}</span><small>${WEAPONS[id].union?'합체 무기':`진화: 8단계 + ${PASSIVES[WEAPONS[id].recipe].name} ${game.passives[WEAPONS[id].recipe]?'✓':'필요'} → 진화 상자 · 보스 보상은 촉매 없이 각성`}</small></div>`).join('')}${Object.entries(game.passives).map(([id,n])=>`<div class="inventory-row"><span>${PASSIVES[id].name}</span><span>${n}단계</span><small>${PASSIVES[id].description}</small></div>`).join('')}${game.relics.items.map(id=>`<div class="inventory-row relic-row"><span>◇ ${RELICS[id].name}</span><span>${game.relics.stats[id].procs}회 발동</span><small>${RELICS[id].description}</small></div>`).join('')}</div>`;}
function relicSummary(){const used=RELIC_IDS.filter(id=>game.relics.stats[id].procs>0||game.relics.discovered.includes(id));return `<div class="relic-report"><span class="eyebrow">이번 원정의 유물</span>${used.length?used.map(id=>{const s=game.relics.stats[id];return `<p><b>${RELICS[id].name}</b> · ${s.procs?`${s.procs}회`:'미발동'}${s.damage?` · 피해 ${Math.round(s.damage)}`:''}${s.healed?` · 회복 ${Math.round(s.healed)}`:''}${s.absorbed?` · 방어 ${Math.round(s.absorbed)}`:''}</p>`;}).join(''):'<p>유물을 남겨둔 원정 · 다음에는 보급 옆 꾸러미를 확인해 보세요.</p>'}<small>제단 도전 ${game.expedition.milestones.trialClearedAt?'완료':game.expedition.trial.startedAt!==null?'미완료':'건너뜀'} · 원정 시드 ${game.expedition.seed}</small></div>`;}
function expeditionSummary(){
  const ex=game.expedition,nest=ex.sites.find(s=>s.id==='nest'),spring=ex.sites.find(s=>s.id==='spring');
  return `<div class="expedition-summary"><span>보급 장비 <b>${game.gear==='boots'?'순찰 장화':game.gear==='bark'?'나무껍질 망토':'남겨둠'}</b></span><span>위험 둥지 <b>${nest.state==='spent'?'상자 확보':nest.state==='cleared'?'처치 · 상자 미회수':nest.state==='active'?'지휘관 미처치':'도전하지 않음'}</b></span><span>회복 샘 <b>${spring.state==='spent'?'사용함':'남겨둠'}</b></span></div>`;
}
function syncPhase(){
  if(lastPhase===game.phase)return;
  lastPhase=game.phase;clearInput();
  const inCamp=game.phase==='camp';for(const id of ['hud','objective','controls'])$(id).hidden=inCamp;$('joystick').hidden=inCamp||!touchMode();$('rampage').hidden=inCamp;
  for(const id of ['hud','controls','joystick'])$(id).inert=game.phase!=='playing';
  if(game.phase==='playing'){overlay.innerHTML='';return;}
  $('interact-wrap').hidden=true;
  if(inCamp){
    overlay.innerHTML=campMarkup();for(const target of document.querySelectorAll('[data-portrait]'))drawPortrait(target,target.dataset.portrait);
    document.querySelectorAll('[data-hero]').forEach(button=>button.onclick=()=>{selected=button.dataset.hero;selectedWeapon=HEROES[selected].weapon;game.hero=selected;game.startWeapon=selectedWeapon;game.weapons={[selectedWeapon]:{rank:1,evolved:false,clock:0}};game.player.aim=0;lastPhase='';syncPhase();settings();document.querySelector(`[data-hero="${selected}"]`).focus();});
    $('starting-weapon').onchange=e=>{selectedWeapon=e.target.value;game.weapons={[selectedWeapon]:{rank:1,evolved:false,clock:0}};game.startWeapon=selectedWeapon;$('loadout-hint').innerHTML=loadoutHint();settings();};$('start').onclick=()=>start();return;
  }
  if(game.phase==='choice'){
    overlay.innerHTML=dialog('숲의 힘을 빌리세요',`성장 · LEVEL ${game.level}`,`<p>공격을 더하거나, 지금의 무기를 강하게 만드세요.</p><div class="choices">${game.choices.map((choice,i)=>{const d=(choice.kind==='weapon'?WEAPONS:PASSIVES)[choice.id],rank=choice.kind==='weapon'?game.weapons[choice.id]?.rank||0:game.passives[choice.id]||0;return `<button class="choice" data-choice="${i}"><kbd>${i+1}</kbd><span><b>${d.name}</b><small>${d.description}</small>${choice.kind==='weapon'?weaponHint(choice.id):''}</span><em>${rank?`${rank} → ${rank+1}단계`:'새로 장착'}</em></button>`;}).join('')}</div>`,`<button class="quiet" id="reroll" ${game.rerolls?'':'disabled'}>다시 찾기 · ${game.rerolls}회</button><span class="eyebrow">시간이 멈췄습니다</span>`);
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));$('reroll').onclick=()=>{reroll(game);lastPhase='';syncPhase();};
  }else if(game.phase==='supply'){
    if(game.pendingSupplyGear){
      overlay.innerHTML=dialog('촉매를 넣을 자리를 고르세요','보조 장비 · 6칸 사용 중',`<p>${PASSIVES[WEAPONS[game.startWeapon].recipe].name} 촉매와 바꿀 보조 하나를 고르세요.</p><div class="choices">${Object.entries(game.passives).map(([id,n],i)=>`<button class="choice" data-replace="${id}"><kbd>${i+1}</kbd><span><b>${PASSIVES[id].name} · ${n}단계</b><small>${PASSIVES[id].description}</small></span><em>교체</em></button>`).join('')}</div>`,`<button class="quiet" id="later">보급을 남겨두기</button>`);
      document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>supplyChoice(game.pendingSupplyGear,b.dataset.replace));$('later').onclick=()=>{delete game.pendingSupplyGear;game.phase='playing';syncPhase();};
      overlay.querySelector('.choice')?.focus();return;
    }
    overlay.innerHTML=dialog('남겨진 보급 꾸러미','탐색 보상 · 장비 하나 선택',`<p>공통 보상: ${WEAPONS[game.startWeapon].name} +1단계와 진화 촉매.<br>어떻게 숲을 돌파할지 장비를 고르세요.</p><div class="choices"><button class="choice" data-gear="boots"><kbd>1</kbd><span><b>순찰 장화</b><small>이동 속도 +12% · 이동 중 공격 주기 −10%<br>계속 움직이며 경험치를 회수하기 좋습니다.</small></span><em>기동</em></button><button class="choice" data-gear="bark"><kbd>2</kbd><span><b>나무껍질 망토</b><small>0.5초 멈춘 뒤 받는 피해 −3<br>좁은 길에서 버티며 적을 모으기 좋습니다.</small></span><em>진지</em></button></div>`,`<button class="quiet" id="later">보급을 남겨두기</button>`);
    document.querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>supplyChoice(b.dataset.gear));$('later').onclick=()=>{game.phase='playing';syncPhase();};
  }else if(game.phase==='relic'){
    const offer=game.relicOffer,full=game.relics.items.length===2;
    if(offer.selected){
      overlay.innerHTML=dialog('어느 유물을 남길까요?','유물 · 두 칸 사용 중',`<p>새 유물: <b>${RELICS[offer.selected].name}</b><br>${RELICS[offer.selected].description}</p><div class="choices relic-choices">${game.relics.items.map((id,i)=>relicCard(game,id,i,{replace:true})).join('')}</div>`,`<button class="quiet" id="relic-back">다시 고르기</button><button class="quiet" id="leave-relic">꾸러미 남겨두기</button>`);
      document.querySelectorAll('[data-relic-replace]').forEach(b=>b.onclick=()=>relicChoice(offer.selected,b.dataset.relicReplace));$('relic-back').onclick=()=>{offer.selected=null;lastPhase='';syncPhase();};
    }else{
      overlay.innerHTML=dialog('숲이 건넨 두 가지 힘',`유물 발견 · ${game.relics.items.length} / 2칸 장착`,relicChoicesBody(game),`<button class="quiet" id="leave-relic">지금은 남겨두기 →</button><span class="eyebrow">1 · 2 선택</span>`);
      document.querySelectorAll('[data-relic]').forEach(b=>b.onclick=()=>relicChoice(b.dataset.relic));
    }
    $('leave-relic').onclick=()=>{leaveRelicCache(game);syncPhase();};
  }else if(game.phase==='chest'){
    const chest=game.chest,options=chest.options,milestone=['midpoint','armory'].includes(chest.source);
    overlay.innerHTML=dialog(...chestView(game));
    document.querySelectorAll('[data-evolve]').forEach(b=>b.onclick=()=>{selectChest(game,b.dataset.evolve);sound('evolve');lastPhase='';syncPhase();});if($('close-chest'))$('close-chest').onclick=()=>{closeChest(game);syncPhase();};
  }else if(game.phase==='paused'){
    overlay.innerHTML=dialog('잠깐, 숲의 숨을 고르며','원정 일시정지',`<p>${game.pauseReason==='focus'?'창을 떠나 전투를 멈췄습니다.':`${formatTime(game.time)} · ${game.kills} 처치 · ${game.gear?game.gear==='boots'?'순찰 장화':'나무껍질 망토':'장비 미획득'}`}</p>${fusionBook(game)}${synergyInventory()}${inventory()}`,`<div><button class="quiet" id="leave">야영지로 돌아가기</button><button class="quiet" id="mute" style="margin-left:15px">소리 ${muted?'켜기':'끄기'}</button></div><button class="primary" id="resume">계속 원정 →</button>`);
    $('resume').onclick=()=>{audio.unlock();resumeGame(game);syncPhase();};$('leave').onclick=()=>{retreat(game);syncPhase();};$('mute').onclick=()=>{muted=!muted;if(muted)audio.suspend();else audio.unlock();settings();lastPhase='';syncPhase();};
  }else if(game.phase==='crossroads'){
    overlay.innerHTML=dialog(`${game.campaign.depth}단계 돌파 · 다음 한계를 향해`,'버섯왕 격파 · 빌드 유지',`<p>${game.campaign.depth===1?'첫 숲을 돌파했습니다.':`${game.campaign.depth}단계 버섯왕을 격파했습니다.`} 전리품 하나를 골라 같은 빌드로 다음 공세에 도전하세요.<br>다음 버섯왕은 90초 뒤 등장합니다. 보스 체력 ×1.45 · 공격력 추가 +12%p.</p><div class="result-stats"><span>돌파 기록<b>${game.campaign.cleared}단계</b></span><span>누적 처치<b>${game.kills}</b></span><span>최고 연속 처치<b>${game.metrics.bestStreak||0}</b></span></div><div class="choices">${[['force','무성한 힘','피해 배율 +0.18 · 공격 범위 배율 +0.05'],['tempo','몰아치는 박자','공격 속도 배율 +0.10'],['vigor','깊은 숲의 생명','최대 체력 +20']].map(([id,name,text],i)=>`<button class="choice" data-continue="${id}"><kbd>${i+1}</kbd><span><b>${name}</b><small>${text} · 공통: 최대 체력의 25% 회복</small></span><em>${game.campaign.depth+1}단계로 →</em></button>`).join('')}</div>`,`<button class="quiet" id="bank-run">여기까지의 기록으로 원정 마치기</button><span class="eyebrow">시간이 멈췄습니다</span>`);
    overlay.querySelectorAll('[data-continue]').forEach(b=>b.onclick=()=>{continueCampaign(game,b.dataset.continue);sound('choose');syncPhase();});$('bank-run').onclick=()=>{bankCampaign(game);syncPhase();};
  }else if(game.phase==='result'){
    if(recordRun(journal,game))saveJournal();
    const success=game.outcome==='victory';overlay.innerHTML=dialog(success?'새벽을 지켜냈습니다':'다음 새벽을 준비하며',success?`${game.campaign.cleared}단계 돌파 · 기록 확정`:'원정 종료',`<p>${success?'완성한 빌드로 버섯왕을 쓰러뜨렸습니다. 다음에는 더 높은 단계, 더 많은 처치, 더 빠른 첫 돌파에 도전해 보세요.':'보급과 경험치로 성장하고, 수문장의 각성 상자와 후반 정비 보급으로 다음 힘을 완성하세요.'}</p><div class="result-stats"><span>원정 시간<b>${formatTime(game.time)}</b></span><span>처치<b>${game.kills}</b></span><span>성장<b>Lv.${game.level}</b></span></div>${campaignReport()}${expeditionSummary()}${relicSummary()}${synergyReport()}${journalMarkup()}${inventory()}`,`<button class="quiet" id="return">대원 바꾸기</button><button class="quiet" id="same-seed">같은 숲 재도전</button><button class="primary" id="retry">새로운 숲으로 →</button>`);$('return').onclick=camp;$('retry').onclick=()=>start();$('same-seed').onclick=()=>start(game.expedition.seed);
  }
  const focus=overlay.querySelector('.choice,.primary');if(focus)focus.focus({preventScroll:true});
}
function choose(index){if(applyChoice(game,index)){sound('choose');lastPhase='';syncPhase();}}
function supplyChoice(gear,replace=null){if(takeSupply(game,gear,replace))sound('choose');lastPhase='';syncPhase();}
function relicChoice(id,replace=null){if(equipRelic(game,id,replace)){discoverRelics(journal,game.relics.discovered);saveJournal();sound('choose');}lastPhase='';syncPhase();}
function pause(reason='manual'){if(pauseGame(game,reason)){audio.suspend();syncPhase();}}
function togglePause(){if(game.phase==='playing')pause();else if(game.phase==='paused'){audio.unlock();resumeGame(game);syncPhase();}}
$('pause').onclick=togglePause;$('interact').onclick=()=>{interact(game);syncPhase();};$('skill').onclick=()=>{pulse.skill=true;audio.unlock();};$('dash').onclick=()=>{pulse.dash=true;audio.unlock();};
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(e.target.tagName==='SELECT')return;
  if(k==='tab'&&overlay.querySelector('[role="dialog"]')){const focusable=[...overlay.querySelectorAll('button:not(:disabled),select,summary')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','escape'].includes(k))e.preventDefault();
  if(e.repeat)return;if(k==='escape'){togglePause();return;}
  if(game.phase==='choice'&&['1','2','3'].includes(k)){choose(Number(k)-1);return;}
  if(game.phase==='supply'&&game.pendingSupplyGear&&['1','2','3','4','5','6'].includes(k)){supplyChoice(game.pendingSupplyGear,Object.keys(game.passives)[Number(k)-1]);return;}
  if(game.phase==='supply'&&['1','2'].includes(k)){supplyChoice(k==='1'?'boots':'bark');return;}
  if(game.phase==='crossroads'&&['1','2','3'].includes(k)){continueCampaign(game,['force','tempo','vigor'][Number(k)-1]);syncPhase();return;}
  if(game.phase==='relic'&&['1','2'].includes(k)){const n=Number(k)-1,o=game.relicOffer;if(o.selected)relicChoice(o.selected,game.relics.items[n]);else relicChoice(o.options[n]);return;}
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
  const streak=game.time<=(game.feedback.streakUntil||0)?game.feedback.streak||0:0;$('rampage').hidden=streak<8;if(streak>=8){$('rampage').querySelector('b').textContent=`${streak} 연속`;$('rampage').querySelector('span').textContent=streak>=60?'숲을 휩쓰는 중':streak>=30?'멈추지 않는 기세':'몰아치는 연격';$('rampage').querySelector('i').style.transform=`scaleX(${Math.max(0,(game.feedback.streakUntil-game.time)/2)})`;}
  const stage=campaignStage(game),chapter=stage==='opening'?0:stage==='final'||stage==='cleared'?2:1;
  $('chapter-name').textContent=game.campaign.depth>1?`${game.campaign.depth}단계 · 강화 ${stage==='final'?'버섯왕':'공세'}`:stage==='midpoint'?'3분 · 수문장 전투':stage==='final'?'최종전 · 버섯왕':stage==='build'?'각성과 연계 완성':'새벽숲 · 성장과 탐색';
  [...$('chapter-track').children].forEach((el,i)=>el.classList.toggle('active',i===chapter));
  $('hero-name').textContent=HEROES[game.hero].name;$('level').textContent=`Lv.${game.level}`;$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('time').textContent=formatTime(game.time);$('kills').textContent=`${game.kills} 처치`;
  xp.hidden=game.phase==='camp';xp.firstElementChild.style.width=`${game.xp/xpCost(game.level)*100}%`;
  const signature=HEROES[game.hero].skill;$('skill').querySelector('b').textContent=signature;$('skill').querySelector('span').textContent=p.charge>=100?'준비 완료':`${Math.floor(p.charge)}%`;$('skill').classList.toggle('ready',p.charge>=100);$('skill').disabled=game.phase!=='playing'||p.charge<100;
  $('dash').querySelector('span').textContent=p.dashCooldown>0?`${p.dashCooldown.toFixed(1)}초`:'준비 완료';$('dash').disabled=game.phase!=='playing'||p.dashCooldown>0;
  const slots=Object.entries(game.weapons),signatureKey=slots.map(([id,w])=>`${id}${w.rank}${w.evolved}`).join();
  if($('weapons').dataset.signature!==signatureKey){$('weapons').dataset.signature=signatureKey;$('weapons').innerHTML=Array.from({length:6},(_,i)=>slots[i]?`<div class="weapon-slot" title="${WEAPONS[slots[i][0]].name} ${slots[i][1].rank}단계"><canvas width="28" height="28" data-item="${slots[i][0]}"></canvas><small>${slots[i][1].evolved?'✦':slots[i][1].rank}</small></div>`:'<div class="weapon-slot empty"></div>').join('');document.querySelectorAll('[data-item]').forEach(c=>icon(c,c.dataset.item));}
  $('relics').hidden=!game.relics.items.length;document.body.classList.toggle('has-relics',!!game.relics.items.length);
  const active=activeSynergies(game),relicText=game.relics.items.map(id=>`<span class="${active.some(s=>SYNERGIES[s].relic===id)?'linked':''}" title="${RELICS[id].description}"><b>${active.some(s=>SYNERGIES[s].relic===id)?'◇ ':''}${RELICS[id].name}</b><small>${relicReadout(game,id)}</small></span>`).join('');if($('relics').innerHTML!==relicText)$('relics').innerHTML=relicText;
  const mastered=masteredSynergies(game).length;$('objective').querySelector('.eyebrow').textContent=`원정 수첩${active.length?` · 연계 ${active.length}${mastered?` / 각성 ${mastered}`:''}`:''}`;
  const {title,detail}=expeditionObjective(game);
  $('objective-title').textContent=title;$('objective-detail').textContent=detail;
  const boss=game.enemies.find(e=>e.bossRole&&!e.dead);$('boss-health').hidden=!boss;if(boss){$('boss-health').firstElementChild.style.width=`${boss.hp/boss.maxHp*100}%`;$('boss-health').lastElementChild.textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;}
  const site=nearestSite(game);$('interact-wrap').hidden=!site||game.phase!=='playing';if(site)$('interact').querySelector('span').textContent=site.type==='relic'?'유물 두 개 살펴보기':site.id==='camp'?'야영지 확인':site.id==='nest'?'둥지 깨우기':site.id==='trial'?'20초 도전 시작':site.id==='spring'?'샘에서 회복':site.state==='guarded'?'보급 주위 버섯 제거':'보급 열기';
  const toast=game.expedition.toast&&game.time<game.expedition.toastUntil&&game.phase==='playing';$('message').hidden=!toast;if(toast)$('message').textContent=game.expedition.toast;
}
function frame(now){
  const dt=Math.min((now-last)/1000,.04);last=now;
  if(game.phase==='playing'){
    const x=touch.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y=touch.y+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    stepGame(game,dt,{x,y,...pulse});pulse={skill:false,dash:false};updateExpedition(game);
    const freshSynergies=game.synergies.discovered.filter(id=>!journal.synergies.includes(id));if(freshSynergies.length){journal.synergies.push(...freshSynergies);saveJournal();}
    if(!muted){const aliases={shot:'acorn-shot',impact:'wood-impact',slash:'swing',zap:'rune-hit',signature:'burst',eliteDown:'elite-break',evolution:'evolve',union:'evolve'};const events=new Set(game.events.map(e=>aliases[e.type]||e.type));for(const event of selectAudioEvents(events))audio.play(event);}
    game.events=[];
  }
  syncPhase();renderer.render(game,dt);hudClock-=dt;if(hudClock<=0){updateHUD();hudClock=.07;}
  requestAnimationFrame(frame);
}
// Read-only instrumentation for local browser verification; gameplay uses the same model.
window.__woodland={snapshot:()=>({phase:game.phase,time:game.time,hero:game.hero,hp:game.player.hp,x:game.player.x,y:game.player.y,walk:game.player.walk,level:game.level,kills:game.kills,weapons:structuredClone(game.weapons),gear:game.gear,sites:game.expedition.sites.map(s=>({id:s.id,state:s.state})),audio:audio.state()}),atlas:()=>renderer.atlas.toDataURL()};
syncPhase();updateHUD();requestAnimationFrame(frame);
