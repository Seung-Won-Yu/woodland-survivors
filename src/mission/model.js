import {RULESET,HEROES,WEAPONS,RESEARCH,SITES,FIELD,BOSS_POSITION,BOSS_GATE,TRAINING,clamp} from './content.js';
const TAU=Math.PI*2,copy=x=>JSON.parse(JSON.stringify(x)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const emptyStats=()=>({kills:0,elites:0,rescues:0,outposts:0,armorBreaks:0,weaponKills:{p:0,h:0,r:0},pMastery:false,overdriveKills:0,evolved:[],union:false,bestCombo:0});
function rand(s){s.rngState=(s.rngState+0x6d2b79f5)>>>0;let t=s.rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
const pick=(s,items)=>items[Math.floor(rand(s)*items.length)];
const weapon=id=>({id,rank:0,evolved:false,mods:[],cd:.1,shots:0});
export function createMission(d){
 const hp=100*(1+(d.snapshot.training.vitality||0)*.05);
 const s={id:d.id,sequence:d.sequence,rules:RULESET,operation:'breakwater',hero:d.hero,difficulty:d.difficulty,seed:d.seed,rngState:d.seed>>>0,snapshot:copy(d.snapshot),
 phase:'playing',stage:'field',t:0,level:1,xp:0,pendingLevels:0,rerolls:1+(d.snapshot.training.reroll||0),cores:0,
 player:{x:0,y:510,fx:0,fy:-1,aim:-Math.PI/2,hp,maxHp:hp,walk:0,moving:false,attack:0,hurt:0,invuln:0,dash:0,dashCd:0,skillCd:0,charge:70,overdrive:0,focus:0,focusId:null,focusTime:0,slug:false,slugHp:0},
 weapons:[weapon(HEROES[d.hero].weapon),null],boosts:{power:0,tempo:0,magnet:0,projectile:0},stats:emptyStats(),combo:0,comboTime:0,
 enemies:[],shots:[],enemyShots:[],gems:[],hazards:[],zones:[],effects:[],numbers:[],events:[],sites:SITES.map(n=>({...n,state:n.kind==='boss'?'dormant':'waiting'})),
 boss:{...BOSS_POSITION,hp:24000,maxHp:24000,r:65,active:false,mode:'idle',timer:2,angle:0,parts:[{id:'battery',ox:-65,oy:-3,hp:2200,maxHp:2200,r:28},{id:'armor',ox:65,oy:-3,hp:2200,maxHp:2200,r:28}]},
 choiceType:null,choices:[],researchPresented:[],idCounter:0,spawnClock:.8,waveClock:22,alarm:0,shake:0,hitstop:0,impactCd:0,pendingWin:false,result:null,notice:'전방'};
 for(let i=0;i<12;i++)spawn(s,'rifle',Math.cos(i*TAU/12)*250,510+Math.sin(i*TAU/12)*250);
 return s;
}
export function restoreMission(raw){
 const s=copy(raw),finite=n=>Number.isFinite(n),fail=()=>{throw Error('이 작전의 저장 형식을 읽을 수 없습니다.');};
 if(s.rules!==RULESET||!HEROES[s.hero]||!finite(s.t)||!s.player||!s.snapshot?.training||!s.boss||!s.stats?.weaponKills)fail();
 if(!['playing','paused','choice','result'].includes(s.phase)||!['field','boss'].includes(s.stage)||(!Array.isArray(s.snapshot.researched)||!s.snapshot.researched.every(id=>RESEARCH[id]))||!Array.isArray(s.snapshot.freshMods))fail();
 for(const [id,t]of Object.entries(TRAINING)){const n=s.snapshot.training[id];if(n!==undefined&&(!Number.isInteger(n)||n<0||n>t.prices.length))fail();}
 for(const key of ['x','y','hp','maxHp','aim','walk','charge','overdrive','dash','dashCd','skillCd','invuln','focus'])if(!finite(s.player[key]))fail();
 for(const key of ['enemies','shots','enemyShots','gems','hazards','zones','effects','numbers','events','sites','choices','researchPresented','weapons'])if(!Array.isArray(s[key]))fail();
 if(s.weapons.length!==2||s.weapons.some(w=>w&&(!WEAPONS[w.id]||!Number.isInteger(w.rank)||w.rank<0||w.rank>3||!Array.isArray(w.mods)||!finite(w.cd))))fail();
 if(!finite(s.boss.x)||!finite(s.boss.y)||!finite(s.boss.hp)||!Array.isArray(s.boss.parts)||s.boss.parts.length!==2||s.boss.parts.some(p=>!finite(p.hp)))fail();
 for(const list of [s.enemies,s.shots,s.enemyShots,s.gems,s.hazards,s.zones])if(list.some(o=>!finite(o.x)||!finite(o.y)))fail();
 if(s.enemies.some(e=>!['rifle','shield','mortar','officer'].includes(e.type)||!finite(e.hp)||!finite(e.speed)||!finite(e.timer)))fail();
 for(const key of ['level','xp','pendingLevels','rerolls','cores','idCounter','waveClock'])if(!finite(s[key]))fail();
 if(s.shots.some(o=>!Array.isArray(o.hits)||!Array.isArray(o.tags)||!finite(o.vx)||!finite(o.vy)||!finite(o.life)||!finite(o.damage)))fail();
 if(!Array.isArray(s.stats.evolved)||!finite(s.stats.kills)||!finite(s.level)||!finite(s.rngState)||!finite(s.spawnClock))fail();
 if(s.phase==='result')fail();
 if(s.phase==='choice'){
  if(!['level','supply'].includes(s.choiceType)||!s.choices.length||s.choices.some(c=>typeof c.id!=='string'||!['rank','weapon','mod','evolve','union','utility','resupply'].includes(c.kind)))fail();
  for(const c of s.choices){if(c.kind==='weapon'&&(!WEAPONS[c.weapon]||![0,1].includes(c.slot)))fail();if(c.kind==='mod'&&!RESEARCH[c.mod])fail();if(c.kind==='utility'&&!['power','vitality','magnet','tempo','projectile'].includes(c.key))fail();try{if(!chooseMission(copy(s),c.id))fail();}catch{fail();}}
 }
 return s;
}
export const packMission=s=>copy(s);
export const takeMissionEvents=s=>s.events.splice(0);
const emit=(s,type)=>{if(s.events.length<120)s.events.push(type);};
function fx(s,type,x,y,extra={}){if(s.effects.length>=160)s.effects.shift();s.effects.push({type,x,y,age:0,life:.4,...extra});}
export function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
function xpCost(level){return 8+level*5+Math.max(0,level-6)*7;}
export const xpNeeded=s=>xpCost(s.level);
function gainXp(s,n){s.xp+=n;while(s.xp>=xpCost(s.level)){s.xp-=xpCost(s.level);s.level++;s.pendingLevels++;s.player.hp=Math.min(s.player.maxHp,s.player.hp+3);}}
function spawn(s,type,x,y,siteId=null){
 if(s.enemies.filter(e=>!e.dead).length>=200)return null;
 const guard=!!siteId,officer=type==='officer',shield=type==='shield',mortar=type==='mortar';
 const hp=officer?500:guard?shield?150:95:shield?62:mortar?40:25+Math.min(18,s.t*.07);
 const e={id:++s.idCounter,type,x,y,hp,maxHp:hp,r:officer?23:shield?19:15,speed:officer?60:mortar?48:shield?58:79+rand(s)*12,siteId,age:0,walk:0,aim:0,hurt:0,slow:0,mode:'walk',timer:1+rand(s)*3,dead:false,deathLife:0};s.enemies.push(e);return e;
}
function targets(s){
 const list=s.enemies.filter(e=>!e.dead);
 if(s.boss.active){const b=s.boss;for(const part of b.parts)if(part.hp>0)list.push({id:part.id,type:'part',part,x:b.x+part.ox,y:b.y+part.oy,r:part.r});list.push({id:'core',type:'core',x:b.x,y:b.y,r:51});}
 return list;
}
function targetFor(s,bossPriority=false){let best=null,score=Infinity;const p=s.player;for(const e of targets(s)){const d=dist(e,p);if(d>760)continue;let cost=d;if(e.siteId){const site=s.sites.find(n=>n.id===e.siteId);if(site&&dist(site,p)<240)cost*=.55;}if(e.type==='part')cost*=bossPriority?.2:.65;if(e.type==='core')cost*=bossPriority?.3:.8;if(cost<score){score=cost;best=e;}}return best;}
function projectile(s,w,angle,damage,pierce=1,extra={}){
 if(s.shots.length>=280)return;
 const p=s.player,reach=p.slug?57:26;s.shots.push({id:++s.idCounter,x:p.x+Math.cos(angle)*reach,y:p.y+Math.sin(angle)*reach,vx:Math.cos(angle)*(extra.speed||760),vy:Math.sin(angle)*(extra.speed||760),angle,weapon:w.id,tags:w.id==='u'?['h','r']:[w.id],damage,pierce,hits:[],life:extra.rocket?1.5:.85,rocket:false,blast:0,...extra});
}
function fireWeapon(s,w){
 const p=s.player,target=targetFor(s);if(!target)return;const a=Math.atan2(target.y-p.y,target.x-p.x);p.aim=a;p.attack=.12;w.shots++;
 const grown=w.rank,training=1+(s.snapshot.training.firepower||0)*.03,power=(1+s.boosts.power*.12)*training,over=p.overdrive>0;
 if(w.id==='r'){
  const count=1+(grown>=2?1:0)+(w.evolved?1:0);for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*.12,(58+grown*15)*(w.evolved?1.45:1)*power,1,{rocket:true,speed:390,blast:68+(grown>=1?22:0)+(w.evolved?20:0),fire:w.mods.includes('r-incendiary')});emit(s,'throw');
 }else{
  const count=(w.id==='p'?(grown>=2?2:1):grown>=1?2:1)+(w.evolved?1:0)+(over&&s.hero==='fio'?1:0)+Math.min(1,s.boosts.projectile);
  const damage=(WEAPONS[w.id].damage+grown*(w.id==='p'?8:4))*(w.evolved?1.35:1)*power;
  for(let i=0;i<count;i++){const spread=w.id==='p'?.035:w.id==='u'?.075:.065;projectile(s,w,a+(i-(count-1)/2)*spread,damage,w.id==='p'?(grown>=1?4:2)+(w.evolved?3:0):grown>=3?3:1,{split:w.mods.includes('p-split'),ricochet:w.mods.includes('h-ricochet'),width:w.evolved?5:3});}
  emit(s,w.id==='p'?'acorn-shot':'scatter-shot');
 }
 if(s.hero==='fio')p.charge=Math.min(100,p.charge+.35);
}
function damage(s,e,amount,tags,source='bullet',angle=0){
 const p=s.player;
 if(e.type==='part'||e.type==='core'){
  const b=s.boss;if(!b.active||b.hp<=0)return;
  if(e.type==='part'&&e.part.hp<=0)return;
  if(s.hero==='marco'){if(p.focusId===e.id)p.focus=Math.min(3,p.focus+.14);else{p.focusId=e.id;p.focus=.3;}p.focusTime=2;amount*=1+p.focus*.12;}
  amount*=source==='blast'?.55:.28;
  if(s.hero==='marco'&&tags.includes('p'))amount*=1.8;
  if(b.mode==='recover')amount*=1.4;
  if(e.type==='part'){
   e.part.hp-=amount;
   if(e.part.hp<=0){s.stats.armorBreaks++;fx(s,'explosion',e.x,e.y,{r:100,life:.65});emit(s,'crowd-break');s.shake=6;}
  }else{const broken=b.parts.filter(part=>part.hp<=0).length;amount*=broken===0?.35:broken===1?.7:1.1;b.hp-=amount;if(b.hp<=0)s.pendingWin=true;}
  if(s.numbers.length<30)s.numbers.push({x:e.x,y:e.y-65,n:Math.round(amount),age:0,life:.55});return;
 }
 if(e.dead)return;
 if(e.type==='shield'&&source==='bullet'){const face=Math.atan2(p.y-e.y,p.x-e.x);if(Math.cos(face-angle-Math.PI)>.65)amount*=.45;}
 e.hp-=amount;e.hurt=.12;const push=source==='blast'?10:3;e.x+=Math.cos(angle)*push;e.y+=Math.sin(angle)*push;
 if(e.hp>0){emit(s,'wood-impact');return;}
 e.dead=true;e.deathLife=.32;
 if(e.type==='officer')s.stats.elites++;else{
  s.stats.kills++;for(const tag of new Set(tags))if(tag in s.stats.weaponKills)s.stats.weaponKills[tag]++;
 }
 if(p.overdrive>0&&s.hero==='fio')s.stats.overdriveKills++;
 p.charge=Math.min(100,p.charge+(s.hero==='fio'?2.2:.6));
 s.combo++;s.comboTime=2;s.stats.bestCombo=Math.max(s.stats.bestCombo,s.combo);
 s.gems.push({x:e.x,y:e.y,value:e.type==='officer'?20:1,age:0,ammo:e.type==='officer'});
 if(s.gems.length>220){const g=s.gems[0];g.value+=s.gems.pop().value;}
 fx(s,'kill',e.x,e.y-16,{life:.32,angle});emit(s,'wood-kill');
 if(s.combo%12===0&&s.impactCd<=0){s.impactCd=.6;s.hitstop=.025;s.shake=Math.max(s.shake,2);emit(s,'crowd-break');}
}
function blast(s,x,y,r,amount,tags,fire=false){
 fx(s,'explosion',x,y,{r,life:.5});emit(s,'power-kill');s.shake=Math.max(s.shake,3);
 for(const e of targets(s))if(dist(e,{x,y})<r+e.r)damage(s,e,amount,tags,'blast',Math.atan2(e.y-y,e.x-x));
 if(fire&&s.zones.length<20)s.zones.push({x,y,r:r*.7,damage:amount*.18,tags,life:2.5,tick:.2});
}
function hurtPlayer(s,amount,x,y){
 const p=s.player;if(p.invuln>0||p.dash>0)return;p.invuln=1.05;p.hurt=.3;s.shake=5;emit(s,'hurt');
 if(p.slug){p.slugHp-=amount;if(p.slugHp<=0){p.slug=false;p.slugHp=0;p.invuln=1.8;blast(s,p.x,p.y,120,150,['h','r']);fx(s,'text',p.x,p.y-95,{text:'긴급 이탈',life:1});}}
 else p.hp=Math.max(0,p.hp-amount);
 const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1;p.x+=dx/d*15;p.y+=dy/d*15;
}
function emitEnemyShot(s,x,y,a,speed=190){if(s.enemyShots.length>=100)return;s.enemyShots.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:3,r:6});}
function hazard(s,x,y,r=52,delay=.9){if(s.hazards.length<20)s.hazards.push({x,y,r,timer:delay,life:delay+.2,hit:false});}
function siteChoices(s,site){
 const slots=s.weapons,primary=slots[0],candidates=['p','h','r'].filter(id=>!slots.some(w=>w?.id===id||w?.id==='u'&&['h','r'].includes(id)));const newGun=candidates.length?pick(s,candidates):null;
 const cards=[];
 if(primary.rank<3)cards.push(upgradeCard(primary,0));else if(!primary.evolved&&s.cores>0)cards.push(evolveCard(primary,0));else cards.push(utilityCard('power'));
 const empty=slots.findIndex(w=>!w);
 if(empty>=0)for(const id of candidates)cards.push({id:`weapon:${id}:${empty}`,kind:'weapon',weapon:id,slot:empty,title:`${WEAPONS[id].name} 확보`,label:'새 지원 무기',desc:WEAPONS[id].desc});
 else if(newGun)for(let i=0;i<2;i++)cards.push({id:`weapon:${newGun}:${i}`,kind:'weapon',weapon:newGun,slot:i,title:`${WEAPONS[newGun].name} 장착`,label:`${i?'지원':'주'}무기 교체`,desc:`${WEAPONS[slots[i].id].name} ${slots[i].rank}단계와 해당 총 개조를 교체합니다.`});
 if(site.kind!=='supply')cards.push({id:'resupply',kind:'resupply',title:'전투 정비',label:'체력 +35 · 강화 탄창',desc:'지금 총을 유지하고 회복합니다. 피오는 강화 사격도 이어집니다.'});
 return cards.slice(0,3);
}
const upgradeCard=(w,slot)=>({id:`rank:${slot}`,kind:'rank',slot,title:`${WEAPONS[w.id].name} ${w.rank+1}단계`,label:'무기 숙련',desc:WEAPONS[w.id].ranks[w.rank]});
const evolveCard=(w,slot)=>({id:`evolve:${slot}`,kind:'evolve',slot,title:WEAPONS[w.id].evolution,label:'무기 진화 · 핵심 1',desc:'탄 수·관통·폭발이 크게 강화됩니다. 지금 장비의 투자를 유지합니다.'});
function utilityCard(key){const map={power:['화력 집중','모든 무기 피해 +12%'],vitality:['야전 응급처치','이번 판 최대 HP +10 · 체력 +25'],magnet:['전장 회수','경험치 회수 반경 +25%'],tempo:['속사 기동','모든 무기 공격 간격 −7%'],projectile:['추가 탄환','사격 무기 탄 수 +1']};return{id:`utility:${key}`,kind:'utility',key,title:map[key][0],label:'전술 보조',desc:map[key][1]};}
export function availableUpgrades(s){
 const cards=[];const h=s.weapons.find(w=>w?.id==='h'),r=s.weapons.find(w=>w?.id==='r');
 if(h?.rank===3&&r?.rank===3&&s.cores>0)cards.push({id:'union',kind:'union',title:WEAPONS.u.name,label:'H + R 최종 합체 · 핵심 1',desc:'두 무기를 한 칸으로. 관통 사격의 적중이 유도 로켓을 발사합니다.'});
 s.weapons.forEach((w,slot)=>{if(w&&w.id!=='u'&&w.rank===3&&!w.evolved&&s.cores>0)cards.push(evolveCard(w,slot));});
 const mods=[];
 for(const id of s.snapshot.researched){const def=RESEARCH[id],slot=s.weapons.findIndex(w=>w?.id===def.weapon&&w.rank>=1&&!w.mods.includes(id));if(slot>=0)mods.push({id:`mod:${id}`,kind:'mod',mod:id,slot,title:def.name,label:'연구한 개조',desc:def.desc,fresh:s.snapshot.freshMods.includes(id)&&!s.researchPresented.includes(id)});}
 const fresh=mods.find(c=>c.fresh);if(fresh)cards.unshift(fresh);
 const ranked=s.weapons.map((w,i)=>w&&w.id!=='u'&&w.rank<3?upgradeCard(w,i):null).filter(Boolean);if(ranked.length)cards.push(pick(s,ranked));
 if(mods.length)cards.push(pick(s,mods));
 const utilities=['power','vitality','magnet','tempo','projectile'].filter(k=>k==='vitality'||s.boosts[k]<(k==='projectile'?1:3));
 while(cards.length<6&&utilities.length){const key=pick(s,utilities);utilities.splice(utilities.indexOf(key),1);cards.push(utilityCard(key));}
 const unique=[...new Map(cards.map(c=>[c.id,c])).values()].slice(0,3);
 for(const c of unique)if(c.kind==='mod'&&!s.researchPresented.includes(c.mod))s.researchPresented.push(c.mod);
 return unique;
}
function openLevel(s){if(s.pendingLevels<=0||s.phase!=='playing')return;s.pendingLevels--;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);emit(s,'level');}
export function rerollMission(s){if(s.phase!=='choice'||s.choiceType!=='level'||s.rerolls<=0)return false;s.rerolls--;s.choices=availableUpgrades(s);emit(s,'choose');return true;}
export function chooseMission(s,id){
 if(s.phase!=='choice')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 if(c.kind==='rank'){const w=s.weapons[c.slot];if(!w||w.rank>=3)return false;w.rank++;if(w.id==='p'&&w.rank===3)s.stats.pMastery=true;}
 else if(c.kind==='weapon')s.weapons[c.slot]=weapon(c.weapon);
 else if(c.kind==='mod'){const w=s.weapons[c.slot];if(!w||w.mods.includes(c.mod))return false;w.mods.push(c.mod);}
 else if(c.kind==='evolve'){const w=s.weapons[c.slot];if(!w||w.rank<3||w.evolved||s.cores<=0)return false;s.cores--;w.evolved=true;if(!s.stats.evolved.includes(w.id))s.stats.evolved.push(w.id);blast(s,s.player.x,s.player.y,190,160,[w.id]);s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);emit(s,'forge-evolve');}
 else if(c.kind==='union'){
  if(s.cores<=0||!s.weapons.some(w=>w?.id==='h'&&w.rank===3)||!s.weapons.some(w=>w?.id==='r'&&w.rank===3))return false;
  s.cores--;const mods=s.weapons.flatMap(w=>w?.mods||[]);s.weapons=[{...weapon('u'),rank:3,evolved:true,mods},null];s.stats.union=true;blast(s,s.player.x,s.player.y,230,210,['h','r']);emit(s,'forge-union');
 }else if(c.kind==='utility'){
  if(c.key==='vitality'){s.player.maxHp+=10;s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);}else s.boosts[c.key]++;
 }else if(c.kind==='resupply'){s.player.hp=Math.min(s.player.maxHp,s.player.hp+35);s.player.charge=100;s.player.overdrive=Math.max(3,s.player.overdrive);}
 s.player.invuln=Math.max(.6,s.player.invuln);s.phase='playing';s.choices=[];s.choiceType=null;emit(s,'choose');fx(s,'growth',s.player.x,s.player.y,{r:110,life:.7});return true;
}
export function pauseMission(s){if(s.phase!=='playing')return false;s.phase='paused';return true;}
export function resumeMission(s){if(s.phase!=='paused')return false;s.phase='playing';return true;}
export function endMission(s,reason='retreat'){
 if(s.phase==='result')return false;s.phase='result';s.result={won:reason==='victory',reason,seconds:s.t,hero:s.hero,stats:copy(s.stats),weapons:copy(s.weapons),training:copy(s.snapshot.training),doctrine:s.snapshot.doctrine};emit(s,reason==='victory'?'boss-defeated':'hurt');return true;
}
export function interaction(s){
 const p=s.player;if(p.slug&&s.stage==='field'&&dist(p,BOSS_GATE)<190)return{id:'boss',title:'Slug로 지휘전차 교전',detail:'현재 무장과 병기를 유지하고 진입'};if(p.slug)return {id:'exit-slug',title:'하차',detail:'현재 무기와 체력을 유지합니다'};
 const garage=s.sites.find(n=>n.id==='garage');if(garage.state==='ready'&&dist(p,garage)<120)return{id:'slug',title:'Slug 탑승',detail:'내구 120 · E 주포 · F 하차'};
 if(s.stage==='field'&&dist(p,BOSS_GATE)<190)return{id:'boss',title:'지휘전차 교전',detail:'지금 화력으로 도전 · 언제든 진입'};
 return null;
}
export function missionAction(s,action){
 if(s.phase!=='playing')return false;const p=s.player;
 if(action==='interact'){
  const item=interaction(s);if(!item)return false;
  if(item.id==='exit-slug'){p.slug=false;p.invuln=1;fx(s,'text',p.x,p.y-65,{text:'하차',life:.7});}
  if(item.id==='slug'){p.slug=true;p.slugHp=120;p.invuln=1;s.sites.find(n=>n.id==='garage').state='done';s.stats.slugCaptured=(s.stats.slugCaptured||0)+1;emit(s,'forge-evolve');}
  if(item.id==='boss'){
   s.stage='boss';s.boss.active=true;s.boss.mode='walk';s.boss.timer=1.7;p.x=0;p.y=BOSS_POSITION.y+300;p.invuln=1.5;
   s.enemies=s.enemies.filter(e=>dist(e,s.boss)<500);s.enemyShots=[];s.hazards=[];fx(s,'text',0,BOSS_POSITION.y+230,{text:'지휘전차를 파괴하라',life:2});emit(s,'boss-arrival');
  }
  return true;
 }
 if(action==='dash'){if(p.dashCd>0)return false;p.dash=.18;p.dashCd=2.3;p.invuln=.42;fx(s,'dash',p.x,p.y,{life:.25,angle:Math.atan2(p.fy,p.fx)});emit(s,'whoosh');return true;}
 if(action!=='skill'||p.skillCd>0)return false;
 const target=targetFor(s,true),a=target?Math.atan2(target.y-p.y,target.x-p.x):p.aim;
 if(p.slug){if(s.hero==='fio'&&p.charge>=60){p.charge-=60;p.overdrive=s.snapshot.doctrine==='quick'?4:7;}p.skillCd=3.2;projectile(s,{id:'u'},a,220,1,{rocket:true,speed:550,blast:140});emit(s,'burst');}
 else if(s.hero==='fio'){
  if(p.charge<60)return false;p.charge=0;p.overdrive=s.snapshot.doctrine==='quick'?4:7;p.skillCd=s.snapshot.doctrine==='quick'?3:5;emit(s,'burst');fx(s,'text',p.x,p.y-85,{text:'전탄 보급!',life:1});
 }else{
  const fan=s.snapshot.doctrine==='fan',w=s.weapons[0],count=fan?9:5;
  for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*(fan?.11:.025),(fan?55:88)*(1+s.level*.035),18,{width:8,speed:1050,skill:true});p.skillCd=7;p.attack=.25;emit(s,'burst');s.shake=4;
 }
 return true;
}
function updateSites(s){
 if(s.stage!=='field')return;
 for(const site of s.sites){
  if(site.kind==='boss')continue;
  if(site.state==='waiting'&&dist(s.player,site)<270){
   site.state='active';for(let i=0;i<site.guards;i++){const a=i*TAU/site.guards,type=i===0&&['camp','garage'].includes(site.id)?'officer':i===1?'mortar':i%3===0?'shield':'rifle';spawn(s,type,site.x+Math.cos(a)*90,site.y+Math.sin(a)*70,site.id);}emit(s,'horde');
  }
  if(site.state==='active'&&!s.enemies.some(e=>e.siteId===site.id&&!e.dead)){site.state='ready';fx(s,'growth',site.x,site.y,{life:1,r:100});emit(s,'level');}
  if(site.state==='ready'&&site.kind!=='garage'&&dist(s.player,site)<115){
   site.state='done';s.stats.rescues+=site.rescues;
   if(['camp','convoy'].includes(site.kind))s.stats.outposts++;
   if(site.kind!=='supply')s.cores++;
   s.player.hp=Math.min(s.player.maxHp,s.player.hp+14);s.player.charge=100;if(s.hero==='fio')s.player.overdrive=3;
   gainXp(s,15);s.phase='choice';s.choiceType='supply';s.choiceSite=site.name;s.choices=siteChoices(s,site);emit(s,'heal');return;
  }
 }
}
function updateBoss(s,dt){
 const b=s.boss,p=s.player;if(!b.active)return;b.timer-=dt;
 if(b.mode==='charge'){b.x+=Math.cos(b.angle)*420*dt;b.y+=Math.sin(b.angle)*420*dt;if(b.timer<=0){b.mode='recover';b.timer=2.3;fx(s,'text',b.x,b.y-100,{text:'빈틈! 피해 ×1.4',life:1.2});}}
 else if(b.mode==='windup'){if(b.timer<=0){b.mode='charge';b.timer=.62;emit(s,'boss-charge');}}
 else if(b.mode==='recover'){if(b.timer<=0){b.mode='walk';b.timer=1.6;}}
 else if(b.timer<=0){
  if(b.hp<b.maxHp*.55&&rand(s)<.55){b.mode='windup';b.timer=.9;b.angle=Math.atan2(p.y-b.y,p.x-b.x);emit(s,'boss-warning');}
  else{const battery=b.parts[0].hp>0,count=battery?3:1;for(let i=0;i<count;i++)hazard(s,p.x+(i-1)*75,p.y+(i%2)*45,54,1.05);
   const a=Math.atan2(p.y-b.y,p.x-b.x);for(let i=-2;i<=2;i++)emitEnemyShot(s,b.x,b.y+25,a+i*.23,160);
   b.mode='recover';b.timer=2.2;emit(s,'boss-warning');}
 }
 b.x=clamp(b.x,-600,600);b.y=clamp(b.y,BOSS_POSITION.y-210,BOSS_POSITION.y+210);
 if(dist(p,b)<b.r+15)hurtPlayer(s,18,b.x,b.y);
}
export function stepMission(s,dt,input={x:0,y:0}){
 if(s.phase!=='playing')return;dt=clamp(dt,0,.05);if(!dt)return;
 if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);return;}
 s.t+=dt;const p=s.player;
 for(const key of ['hurt','invuln','dash','dashCd','skillCd','overdrive','attack','focusTime'])p[key]=Math.max(0,p[key]-dt);
 if(p.focusTime<=0)p.focus=0;
 s.shake=Math.max(0,s.shake-dt*24);s.impactCd=Math.max(0,s.impactCd-dt);if(s.hero==='fio')p.charge=Math.min(100,p.charge+dt*(s.snapshot.doctrine==='quick'?4:2));
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.hypot(ix,iy),force=Math.min(1,len);
 if(len>.05){p.fx=ix/len;p.fy=iy/len;}p.moving=len>.05||p.dash>0;
 const speed=p.dash>0?670:p.slug?175:205,movement=speed*dt*(p.dash>0?1:force);
 if(p.moving){p.x+=p.fx*movement;p.y+=p.fy*movement;p.walk+=movement;}
 p.x=clamp(p.x,s.stage==='boss'?-700:FIELD.left,s.stage==='boss'?700:FIELD.right);p.y=clamp(p.y,s.stage==='boss'?BOSS_POSITION.y-300:FIELD.top,s.stage==='boss'?BOSS_POSITION.y+440:FIELD.bottom);
 updateSites(s);if(s.phase!=='playing')return;
 for(const w of s.weapons){if(!w)continue;w.cd-=dt;if(w.cd<=0){fireWeapon(s,w);const def=WEAPONS[w.id],base=def.interval*(w.rank>=2&&w.id==='h'?.78:1)*(w.evolved?.78:1);w.cd=base*(1-(s.snapshot.training.cycling||0)*.02)*(1-s.boosts.tempo*.07)*(p.overdrive>0?.7:1);}}
 s.spawnClock-=dt;
 if(s.spawnClock<=0){const late=s.level>=7||s.t>80,count=s.stage==='boss'?2:late?5:3;
  for(let i=0;i<count;i++){const a=rand(s)*TAU,r=370+rand(s)*75;let x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(s.stage==='boss')y=clamp(y,BOSS_POSITION.y-270,BOSS_POSITION.y+420);spawn(s,rand(s)<.14?'shield':rand(s)<.08?'mortar':'rifle',x,y);}
  s.spawnClock=s.stage==='boss'?1.2:late?.36:s.t>25?.7:1.3;if(s.difficulty==='dense')s.spawnClock*=.8;
 }
 s.waveClock-=dt;if(s.waveClock<=0){s.waveClock=22;const a=Math.atan2(p.fy,p.fx)+(rand(s)>.5?.7:-.7);fx(s,'reinforce',p.x+Math.cos(a)*250,p.y+Math.sin(a)*250,{life:1.5,pending:true,angle:a});emit(s,'horde');}
 for(const e of s.enemies){
  if(e.dead){e.deathLife-=dt;continue;}e.age+=dt;e.hurt=Math.max(0,e.hurt-dt);e.slow=Math.max(0,e.slow-dt);e.timer-=dt;
  const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.aim=Math.atan2(dy,dx);
  let speed=e.speed*(e.slow>0?.45:1);if(e.type==='mortar'&&d<230)speed=0;
  if(e.mode==='windup'){speed=0;if(e.timer<=0){hazard(s,p.x,p.y,43,1);e.mode='walk';e.timer=4.5;}}
  else if(e.type==='mortar'&&e.timer<=0&&d<440){e.mode='windup';e.timer=.65;}
  else if(e.type==='rifle'&&e.timer<=0&&d<230){emitEnemyShot(s,e.x,e.y,e.aim,170);e.timer=4+rand(s)*3;}
  else if(e.type==='officer'&&e.timer<=0){e.timer=6;for(let i=0;i<3;i++)spawn(s,'rifle',e.x+(i-1)*34,e.y+35);}
  if(d>e.r+10){e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;e.walk+=speed*dt;}
  if(d<e.r+(p.slug?27:11))hurtPlayer(s,e.type==='officer'?10:5,e.x,e.y);
 }
 if(p.hp<=0){endMission(s,'hp');return;}
 // Coarse separation; distance squared avoids expensive roots for distant pairs.
 for(let i=0;i<s.enemies.length;i++){const a=s.enemies[i];if(a.dead)continue;for(let j=i+1;j<s.enemies.length;j++){const b=s.enemies[j];if(b.dead)continue;const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,gap=(a.r+b.r)*.7;if(d2>1&&d2<gap*gap){const d=Math.sqrt(d2),push=(gap-d)*.15;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;}}}
 updateBoss(s,dt);
 for(const shot of [...s.shots]){
  const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
  for(const e of targets(s)){
   if(shot.hits.includes(e.id)||segmentDistance(e.x,e.y,ox,oy,shot.x,shot.y)>e.r+(shot.width||4))continue;
   shot.hits.push(e.id);
   if(shot.rocket){blast(s,shot.x,shot.y,shot.blast,shot.damage,shot.tags,shot.fire);shot.life=0;break;}
   damage(s,e,shot.damage*(shot.skill&&['part','core'].includes(e.type)?.65:1),shot.tags,'bullet',shot.angle);fx(s,'hit',e.x,e.y-23,{life:.15,angle:shot.angle});
   if(shot.split&&!shot.fragment){for(const side of [-1,1])if(s.shots.length<280)s.shots.push({...shot,id:++s.idCounter,x:e.x,y:e.y,vx:Math.cos(shot.angle+side*.65)*640,vy:Math.sin(shot.angle+side*.65)*640,angle:shot.angle+side*.65,damage:shot.damage*.5,pierce:2,hits:[e.id],life:.35,split:false,fragment:true});}
   if(shot.ricochet&&!shot.bounced){const other=targets(s).filter(o=>!shot.hits.includes(o.id)&&dist(o,e)<230).sort((a,b)=>dist(a,e)-dist(b,e))[0];if(other){shot.angle=Math.atan2(other.y-e.y,other.x-e.x);shot.vx=Math.cos(shot.angle)*800;shot.vy=Math.sin(shot.angle)*800;shot.pierce++;shot.bounced=true;}}
   if(shot.weapon==='u'&&!shot.fragment){const u=s.weapons.find(w=>w?.id==='u');u.proc=(u.proc||0)+1;if(u.proc>=6){u.proc=0;const t=targetFor(s,true);if(t)projectile(s,u,Math.atan2(t.y-p.y,t.x-p.x),85,1,{rocket:true,speed:540,blast:85,fire:u.mods.includes('r-incendiary')});}}
   if(shot.hits.length>=shot.pierce){shot.life=0;break;}
  }
 }
 for(const shot of s.enemyShots){const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;if(segmentDistance(p.x,p.y,ox,oy,shot.x,shot.y)<(p.slug?28:13)){hurtPlayer(s,7,shot.x-shot.vx*.1,shot.y-shot.vy*.1);shot.life=0;}}
 for(const h of s.hazards){h.timer-=dt;h.life-=dt;if(!h.hit&&h.timer<=0){h.hit=true;fx(s,'enemy-explosion',h.x,h.y,{r:h.r,life:.35});if(dist(p,h)<h.r+(p.slug?22:9))hurtPlayer(s,12,h.x,h.y);}}
 for(const z of s.zones){z.life-=dt;z.tick-=dt;if(z.tick<=0){z.tick=.3;for(const e of targets(s))if(dist(z,e)<z.r+e.r)damage(s,e,z.damage,z.tags,'fire');}}
 for(const g of s.gems){g.age+=dt;const d=dist(g,p),range=135*(1+(s.snapshot.training.pickup||0)*.1+s.boosts.magnet*.25);if(d<range||g.age>8){const step=Math.min(d,(360+g.age*12)*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<25){gainXp(s,g.value);g.done=true;if(g.ammo){p.charge=100;if(s.hero==='fio')p.overdrive=Math.max(p.overdrive,3);}emit(s,'xp');}}
 for(const f of s.effects){f.age+=dt;if(f.pending&&f.type==='reinforce'&&f.age>=1.25){f.pending=false;for(let i=0;i<12;i++)spawn(s,i%5?'rifle':'shield',f.x+Math.cos(f.angle+Math.PI/2)*(i-5.5)*22,f.y+Math.sin(f.angle+Math.PI/2)*(i-5.5)*22);}}
 for(const n of s.numbers)n.age+=dt;
 s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;
 s.enemies=s.enemies.filter(e=>e.dead?e.deathLife>0:e.siteId||dist(e,p)<950);s.shots=s.shots.filter(o=>o.life>0).slice(-280);s.enemyShots=s.enemyShots.filter(o=>o.life>0);s.hazards=s.hazards.filter(o=>o.life>0);s.zones=s.zones.filter(o=>o.life>0);s.gems=s.gems.filter(g=>!g.done);s.effects=s.effects.filter(o=>o.age<o.life);s.numbers=s.numbers.filter(o=>o.age<o.life);
 if(s.pendingWin)endMission(s,'victory');else if(p.hp<=0)endMission(s,'hp');else openLevel(s);
}
