import {RULESET,HEROES,WEAPONS,RESEARCH,BASE_WEAPONS,UNIONS,weaponTags,acceptsMod,BOSS_GUIDES,FRONTS,TACTICS,frontSites,FIELD,BOSS_POSITION,BOSS_GATE,TRAINING,calculateSettlement,clamp} from './content.js';
import {vehicleMotion,drivePlayer,turnToward,carrierTravel} from './motion.js';
const TAU=Math.PI*2,copy=x=>JSON.parse(JSON.stringify(x)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const emptyStats=()=>({kills:0,elites:0,rescues:0,outposts:0,armorBreaks:0,weaponKills:Object.fromEntries(BASE_WEAPONS.map(id=>[id,0])),pMastery:false,overdriveKills:0,evolved:[],union:false,unionIds:[],bestCombo:0,midbosses:0,evolvedKills:0,fronts:[],supplyPicks:[],holdoutKills:0,holdoutScore:0,holdoutSeconds:0,bestDanger:0});
function rand(s){s.rngState=(s.rngState+0x6d2b79f5)>>>0;let t=s.rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
const pick=(s,items)=>items[Math.floor(rand(s)*items.length)];
const weapon=id=>({id,rank:0,evolved:false,mods:[],cd:.1,shots:0});
function makeBoss(front){const hp=[10000,16000,24000][front],partHp=[1500,1800,2200][front];return{...BOSS_POSITION,...vehicleMotion(Math.PI/2),turretAngle:Math.PI/2,partKicks:[0,0],drive:0,hp,maxHp:hp,r:65,active:false,mode:'idle',timer:2,angle:Math.PI/2,cycle:0,coreOpen:0,safeX:0,parts:[{id:'battery',ox:front===1?-155:-65,oy:-3,hp:partHp,maxHp:partHp,r:28},{id:'armor',ox:front===1?155:65,oy:-3,hp:partHp,maxHp:partHp,r:28}]};}
export const holdoutDanger=s=>s.stage==='holdout'?1+Math.floor(s.holdoutTime/20):0;
export const missionScore=s=>calculateSettlement({...s.stats,rules:s.rules,seconds:s.t,won:false}).score;
export function bossPartPosition(s,part){const b=s.boss,a=s.front===0?b.bodyAngle-Math.PI/2:0;return{x:b.x+part.ox*Math.cos(a)-part.oy*Math.sin(a),y:b.y+part.ox*Math.sin(a)+part.oy*Math.cos(a)};}
function routeChoices(s){
 s.phase='choice';s.choiceType='route';s.choiceSite=FRONTS[s.front].name+' · 미션 클리어';
 s.choices=[{id:s.front===2?'travel:extract':'travel:advance',kind:'travel',key:s.front===2?'extract':'advance',title:s.front===2?'작전 완주 · 귀환':FRONTS[s.front+1].name+' 진입',label:s.front===2?'성과 확정':'다음 미션',desc:s.front===2?'확보한 점수와 보급 크레딧을 정산합니다.':'레벨·무기·개조·Slug 내구를 유지하고 다음 맵으로 이동합니다.'},{id:'travel:stay',kind:'travel',key:'stay',title:'이 전장에 더 남는다',label:'위험을 감수하고 성장',desc:'제한 시간 없이 레벨·점수를 더 벌 수 있습니다. 20초마다 증원 위험과 처치 점수가 상승합니다.'}];
}
function completeFront(s){
 s.boss.active=false;s.stage='holdout';s.cleared=true;s.holdoutTime=0;s.targetId='exit';
 if(s.front<2){s.stats.midbosses++;s.stats.fronts.push(s.front);}s.frontHistory.push({front:s.front,at:s.t,seconds:s.t-s.frontStarted,kills:s.stats.kills});
 s.sites.push({id:'exit',name:s.front===2?'귀환 헬기':'다음 미션 출구',kind:'exit',x:BOSS_GATE.x,y:BOSS_GATE.y,state:'ready',tip:s.front===2?'F · 완주 정산 / 잔류':'F · 다음 맵 진입 / 잔류'});
 s.shots=[];s.enemyShots=[];s.hazards=[];s.zones=[];s.player.invuln=2;fx(s,'explosion',s.boss.x,s.boss.y,{r:180,life:1});emit(s,'boss-defeated');
 if(s.front===2){routeChoices(s);return;}
 s.phase='choice';s.choiceType='tactic';s.choiceSite=`${FRONTS[s.front].boss} 격파 · 전술 보급`;
 const keys=s.front===0?['assault','fusion','armor']:['barrage','repair','requisition'];s.choices=keys.map(key=>({id:`tactic:${key}`,kind:'tactic',key,...TACTICS[key],title:TACTICS[key].title}));
}
function advanceFront(s){
 s.front++;s.frontStarted=s.t;s.stage='field';s.cleared=false;s.holdoutTime=0;s.arrival=3.2;Object.assign(s.player,vehicleMotion(s.player.bodyAngle));s.targetId='first';s.player.x=0;s.player.y=510;s.player.invuln=2;s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);s.player.charge=100;s.enemies=[];s.shots=[];s.enemyShots=[];s.gems=[];s.hazards=[];s.zones=[];s.effects=[];s.numbers=[];s.boss=makeBoss(s.front);s.spawnClock=.2;s.waveClock=12;s.sites=frontSites(s.front).map(n=>({...n,wave:0,state:n.kind==='boss'?'dormant':'waiting'}));
 if(s.armorVoucher){s.armorVoucher=false;const garage=s.sites.find(n=>n.id==='garage');garage.state='ready';garage.x=140;garage.y=340;}
 for(let i=0;i<22;i++)spawn(s,'rifle',Math.cos(i*TAU/22)*340,510+Math.sin(i*TAU/22)*340);
 emit(s,'horde');
}
export function createMission(d){
 const hp=100*(1+(d.snapshot.training.vitality||0)*.05);
 const s={id:d.id,sequence:d.sequence,rules:RULESET,operation:'breakwater',hero:d.hero,difficulty:d.difficulty,seed:d.seed,rngState:d.seed>>>0,snapshot:copy(d.snapshot),
 phase:'playing',stage:'field',cleared:false,holdoutTime:0,arrival:3.2,front:0,frontStarted:0,frontHistory:[],tactics:[],armorVoucher:false,barrageAt:0,surge:0,t:0,level:1,xp:0,pendingLevels:0,rerolls:1+(d.snapshot.training.reroll||0),cores:0,
 player:{...vehicleMotion(),damageKind:'pilot',x:0,y:510,fx:0,fy:-1,aim:-Math.PI/2,hp,maxHp:hp,walk:0,moving:false,attack:0,hurt:0,invuln:0,dash:0,dashCd:0,skillCd:0,charge:70,overdrive:0,focus:0,focusId:null,focusTime:0,slug:false,slugHp:0},
 weapons:[weapon(HEROES[d.hero].weapon),null],boosts:{power:0,tempo:0,magnet:0,projectile:0,vitality:0},stats:emptyStats(),combo:0,comboTime:0,
 enemies:[],shots:[],enemyShots:[],gems:[],hazards:[],zones:[],effects:[],numbers:[],events:[],sites:frontSites(0).map(n=>({...n,wave:0,state:n.kind==='boss'?'dormant':'waiting'})),
 boss:makeBoss(0),
 choiceType:null,choices:[],researchPresented:[],idCounter:0,spawnClock:.8,waveClock:22,alarm:0,shake:0,hitstop:0,impactCd:0,pendingWin:false,result:null,notice:'전방'};
 for(let i=0;i<12;i++)spawn(s,'rifle',Math.cos(i*TAU/12)*250,510+Math.sin(i*TAU/12)*250);
 return s;
}
export function restoreMission(raw){
 const s=copy(raw),finite=n=>Number.isFinite(n),fail=()=>{throw Error('이 작전의 저장 형식을 읽을 수 없습니다.');};
 if(s.rules!==RULESET||!HEROES[s.hero]||!finite(s.t)||!s.player||!s.snapshot?.training||!s.boss||!s.stats?.weaponKills)fail();
 if(!Number.isInteger(s.front)||!FRONTS[s.front]||!Array.isArray(s.tactics)||s.tactics.some(id=>!TACTICS[id])||!Array.isArray(s.frontHistory))fail();
 if(!['playing','paused','choice','result'].includes(s.phase)||!['field','boss','holdout'].includes(s.stage)||(!Array.isArray(s.snapshot.researched)||!s.snapshot.researched.every(id=>RESEARCH[id]))||!Array.isArray(s.snapshot.freshMods))fail();
 for(const [id,t]of Object.entries(TRAINING)){const n=s.snapshot.training[id];if(n!==undefined&&(!Number.isInteger(n)||n<0||n>t.prices.length))fail();}
 for(const key of ['x','y','hp','maxHp','aim','walk','charge','overdrive','dash','dashCd','skillCd','invuln','focus'])if(!finite(s.player[key]))fail();
 for(const entity of [s.player,s.boss])for(const [key,value]of Object.entries(vehicleMotion(entity.aim??entity.angle))){if(entity[key]===undefined)entity[key]=value;else if(!finite(entity[key]))fail();}
 if(s.boss.turretAngle===undefined)s.boss.turretAngle=s.boss.angle;if(s.boss.drive===undefined)s.boss.drive=0;if(s.boss.partKicks===undefined)s.boss.partKicks=[0,0];if(!finite(s.boss.turretAngle)||!finite(s.boss.drive)||!Array.isArray(s.boss.partKicks)||s.boss.partKicks.length!==2||s.boss.partKicks.some(n=>!finite(n)))fail();
 if(typeof s.cleared!=='boolean'||!finite(s.holdoutTime)||s.holdoutTime<0||s.cleared!==(s.stage==='holdout'))fail();
 for(const key of ['holdoutKills','holdoutScore','holdoutSeconds','bestDanger'])if(!finite(s.stats[key])||s.stats[key]<0)fail();
 for(const key of ['enemies','shots','enemyShots','gems','hazards','zones','effects','numbers','events','sites','choices','researchPresented','weapons'])if(!Array.isArray(s[key]))fail();
 if(s.weapons.length!==2||s.weapons.some(w=>w&&(!WEAPONS[w.id]||!Number.isInteger(w.rank)||w.rank<0||w.rank>3||!Array.isArray(w.mods)||!finite(w.cd))))fail();
 if(['x','y','hp','maxHp','r','timer','angle','coreOpen','cycle','safeX'].some(key=>!finite(s.boss[key]))||!['idle','walk','charge','windup','recover','sweep-windup','sweep','expose','reload'].includes(s.boss.mode)||!Array.isArray(s.boss.parts)||s.boss.parts.length!==2||s.boss.parts.some(p=>['hp','maxHp','ox','oy','r'].some(key=>!finite(p[key]))))fail();
 if(s.hazards.some(h=>h.shape==='beam'&&(['x2','y2','width','r','timer','life'].some(key=>!finite(h[key]))||typeof h.hit!=='boolean')))fail();
 for(const list of [s.enemies,s.shots,s.enemyShots,s.gems,s.hazards,s.zones])if(list.some(o=>!finite(o.x)||!finite(o.y)))fail();
 if(s.enemies.some(e=>!['rifle','shield','mortar','officer'].includes(e.type)||!finite(e.hp)||!finite(e.speed)||!finite(e.timer)))fail();
 for(const key of ['level','xp','pendingLevels','rerolls','cores','idCounter','waveClock'])if(!finite(s[key]))fail();
 if(s.shots.some(o=>!Array.isArray(o.hits)||!Array.isArray(o.tags)||!finite(o.vx)||!finite(o.vy)||!finite(o.life)||!finite(o.damage)))fail();
 if(!Array.isArray(s.stats.evolved)||!finite(s.stats.kills)||!finite(s.level)||!finite(s.rngState)||!finite(s.spawnClock))fail();
 if(s.phase==='result')fail();
 if(s.phase==='choice'){
  if(!['level','supply','tactic','replace','route'].includes(s.choiceType)||!s.choices.length||s.choices.some(c=>typeof c.id!=='string'||!['rank','weapon','mod','evolve','union','utility','resupply','tactic','sabotage','weapon-offer','keep','travel'].includes(c.kind)))fail();
  for(const c of s.choices){if(c.kind==='travel'&&(!s.cleared||!['advance','stay','extract'].includes(c.key)||c.key==='advance'&&s.front===2||c.key==='extract'&&s.front!==2))fail();if(c.kind==='tactic'&&!TACTICS[c.key])fail();if((c.kind==='weapon'||c.kind==='weapon-offer')&&!WEAPONS[c.weapon])fail();if(c.kind==='weapon'&&![0,1].includes(c.slot))fail();if(c.kind==='mod'&&!RESEARCH[c.mod])fail();if(c.kind==='utility'&&!['power','vitality','magnet','tempo','projectile'].includes(c.key))fail();try{if(!chooseMission(copy(s),c.id))fail();}catch{fail();}}
 }
 return s;
}
export const packMission=s=>copy(s);
export const takeMissionEvents=s=>s.events.splice(0);
const emit=(s,type)=>{if(s.events.length<120)s.events.push(type);};
function fx(s,type,x,y,extra={}){if(s.effects.length>=160)s.effects.shift();s.effects.push({type,x,y,age:0,life:.4,...extra});}
export function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
function xpCost(level){return 8+level*5+Math.max(0,level-6)*7+Math.max(0,level-10)**2*6;}
export const xpNeeded=s=>xpCost(s.level);
function gainXp(s,n){s.xp+=n;while(s.xp>=xpCost(s.level)){s.xp-=xpCost(s.level);s.level++;s.pendingLevels++;s.player.hp=Math.min(s.player.maxHp,s.player.hp+3);}}
function spawn(s,type,x,y,siteId=null){
 if(s.enemies.filter(e=>!e.dead).length>=200)return null;
 const guard=!!siteId,officer=type==='officer',shield=type==='shield',mortar=type==='mortar';
 const baseHp=officer?500:guard?shield?150:95:shield?62:mortar?40:25+Math.min(20,s.front*7+s.t*.025);
 const danger=holdoutDanger(s),hp=baseHp*(1+danger*.25);
 const e={id:++s.idCounter,type,x,y,hp,maxHp:hp,r:officer?23:shield?19:15,speed:(officer?60:mortar?48:shield?58:79+rand(s)*12)*(1+Math.min(danger,10)*.06),siteId,age:0,walk:0,aim:0,hurt:0,slow:0,mode:'walk',timer:1+rand(s)*3,dead:false,deathLife:0};s.enemies.push(e);return e;
}
function targets(s){
 const list=s.enemies.filter(e=>!e.dead);
 if(s.boss.active){const b=s.boss;for(const part of b.parts)if(part.hp>0)list.push({id:part.id,type:'part',part,...bossPartPosition(s,part),r:part.r});list.push({id:'core',type:'core',x:b.x,y:b.y,r:51});}
 return list;
}
function targetFor(s,bossPriority=false){let best=null,score=Infinity;const p=s.player;for(const e of targets(s)){const d=dist(e,p);if(d>760)continue;let cost=d;if(e.siteId){const site=s.sites.find(n=>n.id===e.siteId);if(site&&dist(site,p)<270)cost*=.25;}if(e.type==='part')cost*=bossPriority?.2:.65;if(e.type==='core')cost*=bossPriority?.3:.8;if(cost<score){score=cost;best=e;}}return best;}
function projectile(s,w,angle,damage,pierce=1,extra={}){
 if(s.shots.length>=280)return;
 const p=s.player,reach=p.slug?57:26;if(!extra.rocket&&s.tactics.includes('assault'))pierce+=2;if(UNIONS[w.id]&&s.tactics.includes('fusion'))damage*=1.15;s.shots.push({id:++s.idCounter,x:p.x+Math.cos(angle)*reach,y:p.y+Math.sin(angle)*reach,vx:Math.cos(angle)*(extra.speed||760),vy:Math.sin(angle)*(extra.speed||760),angle,weapon:w.id,tags:weaponTags(w.id),damage,pierce,hits:[],life:extra.rocket?1.5:.85,rocket:false,blast:0,...extra});
}
function fireWeapon(s,w){
 const p=s.player,target=targetFor(s);if(!target)return;const a=Math.atan2(target.y-p.y,target.x-p.x);p.aim=a;p.attack=.12;if(p.slug){p.kick=Math.max(p.kick,w.id==='r'?.8:.25);p.flash=Math.max(p.flash,.07);}w.shots++;
 const grown=w.rank,training=1+(s.snapshot.training.firepower||0)*.03,power=(1+s.boosts.power*.12)*training,over=p.overdrive>0;
 if(w.id==='s'||w.id==='v'){
  const count=(w.id==='v'?8:6+grown*2)+(w.mods.includes('s-flechette')?2:0);for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*.085,(w.id==='v'?25:15+grown*4)*power,w.evolved?3:grown>=2?2:1,{life:.32,speed:820,width:4,pellet:true,shred:w.mods.includes('s-flechette')});
  if(w.id==='v')for(const side of [-1,1])projectile(s,w,a+side*.025,100*power,14,{width:9,speed:1200,life:.7,rail:true,split:w.mods.includes('p-split')});emit(s,'burst');s.shake=Math.max(s.shake,2);
 }else if(w.id==='f'||w.id==='n'){
  const count=w.id==='n'||grown>=3||w.evolved?3:1;for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*.19,(w.id==='n'?26:9+grown*3)*power,6,{life:.42+(grown>=1?.1:0),speed:480,width:13,flame:true,burn:grown>=2?2.1:1.4});
  if(w.id==='n')projectile(s,w,a,95*power,1,{rocket:true,homing:true,speed:470,blast:102,fire:true});emit(s,'whoosh');
 }else if(w.id==='r'){
  const count=1+(grown>=2?1:0)+(w.evolved?1:0);for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*.12,(58+grown*15)*(w.evolved?1.45:1)*power,1,{rocket:true,speed:390,blast:68+(grown>=1?22:0)+(w.evolved?20:0),fire:w.mods.includes('r-incendiary')});emit(s,'throw');
 }else{
  const count=(w.id==='p'?(grown>=2?2:1):grown>=1?2:1)+(w.evolved?(w.id==='p'?3:1):0)+(over&&s.hero==='fio'?1:0)+Math.min(1,s.boosts.projectile);
  const damage=(WEAPONS[w.id].damage+grown*(w.id==='p'?8:4))*(w.evolved?1.35:1)*power;
  for(let i=0;i<count;i++){const spread=w.id==='p'?(w.evolved?.075:.035):w.id==='u'?.075:.065;projectile(s,w,a+(i-(count-1)/2)*spread,damage,w.id==='p'?(grown>=1?4:2)+(w.evolved?3:0):grown>=3?3:1,{split:w.mods.includes('p-split'),ricochet:w.mods.includes('h-ricochet'),width:w.evolved?5:3});}
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
  if(b.mode==='recover'||b.mode==='expose')amount*=1.4;
  if(b.burn>0&&s.weapons.some(w=>w?.mods.includes('f-catalyst'))&&(source==='blast'||tags.includes('s')))amount*=1.35;
  if(b.exposed>0&&source==='bullet'&&tags.some(t=>['p','h','s'].includes(t)))amount*=1.25;
  if(e.type==='part'){
   e.part.hp-=amount;
   if(e.part.hp<=0){s.stats.armorBreaks++;if(s.front===2&&b.parts.every(part=>part.hp<=0)){b.mode='expose';b.timer=3.6;b.coreOpen=3.6;emit(s,'boss-warning');}fx(s,'explosion',e.x,e.y,{r:100,life:.65});emit(s,'crowd-break');s.shake=6;}
  }else{const broken=b.parts.filter(part=>part.hp<=0).length;
   if(s.front===0){const d=dist(p,b)||1,rear=((p.x-b.x)*Math.cos(b.angle)+(p.y-b.y)*Math.sin(b.angle))/d<-.35;amount*=b.mode==='recover'?(rear?2.8:.65):.12;}
   else if(s.front===1)amount*=broken===2?1.35:broken===1?.4:.08;
   else amount*=b.coreOpen>0||b.mode==='expose'?2:0;
   b.hp-=amount;if(b.hp<=0)s.pendingWin=true;}
  if(s.numbers.length<30)s.numbers.push({x:e.x,y:e.y-65,n:Math.round(amount),age:0,life:.55});return;
 }
 if(e.dead)return;
 if(e.burn>0&&s.weapons.some(w=>w?.mods.includes('f-catalyst'))&&(source==='blast'||tags.includes('s')))amount*=1.35;
 if(e.exposed>0&&source==='bullet'&&tags.some(t=>['p','h','s'].includes(t)))amount*=1.25;
 if(e.type==='shield'&&source==='bullet'){const face=Math.atan2(p.y-e.y,p.x-e.x);if(Math.cos(face-angle-Math.PI)>.65)amount*=.45;}
 e.hp-=amount;e.hurt=.12;const push=source==='blast'?10:3;e.x+=Math.cos(angle)*push;e.y+=Math.sin(angle)*push;
 if(e.hp>0){emit(s,'wood-impact');return;}
 e.dead=true;e.deathLife=.32;
 if(e.type==='officer')s.stats.elites++;else{
  s.stats.kills++;if(s.weapons.some(w=>w?.evolved))s.stats.evolvedKills++;for(const tag of new Set(tags))if(tag in s.stats.weaponKills)s.stats.weaponKills[tag]++;
 }
 if(s.stage==='holdout'){const danger=holdoutDanger(s);s.stats.holdoutKills++;s.stats.holdoutScore+=(e.type==='officer'?100:20)*(s.front+1)*danger;}
 if(p.overdrive>0&&s.hero==='fio')s.stats.overdriveKills++;
 p.charge=Math.min(100,p.charge+(s.hero==='fio'?2.2:.6));
 s.combo++;s.comboTime=2;s.stats.bestCombo=Math.max(s.stats.bestCombo,s.combo);
 s.gems.push({x:e.x,y:e.y,value:e.type==='officer'?20:1,age:0,ammo:e.type==='officer'});
 if(s.gems.length>220){const g=s.gems[0];g.value+=s.gems.pop().value;}
 fx(s,'kill',e.x,e.y-16,{life:.32,angle});emit(s,'wood-kill');
 const execution=tags.includes('p')&&s.weapons.some(w=>w?.mods.includes('p-execution'));
 if(execution&&source!=='execution'){fx(s,'explosion',e.x,e.y,{r:65,life:.3});for(const other of s.enemies.slice())if(!other.dead&&dist(other,e)<65)damage(s,other,35,tags,'execution',angle);}
 if(s.tactics.includes('barrage')&&Math.floor(s.stats.kills/35)>(s.barrageAt||0)){s.barrageAt=Math.floor(s.stats.kills/35);for(let i=-1;i<=1;i++)blast(s,p.x+p.fx*180+i*80,p.y+p.fy*180,85,95,['h','r']);}
 if(s.combo%12===0&&s.impactCd<=0){s.impactCd=.6;s.hitstop=.025;s.shake=Math.max(s.shake,2);emit(s,'crowd-break');}
}
function blast(s,x,y,r,amount,tags,fire=false){
 fx(s,'explosion',x,y,{r,life:.5});emit(s,'power-kill');s.shake=Math.max(s.shake,3);
 for(const e of targets(s))if(dist(e,{x,y})<r+e.r){damage(s,e,amount,tags,'blast',Math.atan2(e.y-y,e.x-x));if(tags.includes('r')&&s.weapons.some(w=>w?.mods.includes('r-conductor'))){const marked=['part','core'].includes(e.type)?s.boss:e;marked.exposed=2.5;}}
 if(fire&&s.zones.length<20)s.zones.push({x,y,r:r*.7,damage:amount*.18,tags,life:2.5,tick:.2});
}
function hurtPlayer(s,amount,x,y){
 const p=s.player;if(p.invuln>0||p.dash>0)return;p.invuln=1.05;p.hurt=.3;p.damageKind=p.slug?'armor':'pilot';amount*=1+holdoutDanger(s)*.12;s.shake=5;emit(s,'hurt');
 if(p.slug){p.slugHp=Math.max(0,p.slugHp-amount);fx(s,'armor-hit',p.x,p.y-25,{r:40,life:.3});if(p.slugHp<=0){p.slug=false;p.slugHp=0;p.invuln=1.8;Object.assign(p,vehicleMotion(p.bodyAngle));blast(s,p.x,p.y,120,150,['h','r']);fx(s,'text',p.x,p.y-95,{text:'긴급 이탈',life:1});}}
 else p.hp=Math.max(0,p.hp-amount);
 const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1;p.x+=dx/d*15;p.y+=dy/d*15;
}
function emitEnemyShot(s,x,y,a,speed=190){if(s.enemyShots.length>=100)return;s.enemyShots.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:3,r:6});}
function hazard(s,x,y,r=52,delay=.9){if(s.hazards.length<20)s.hazards.push({x,y,r,timer:delay,life:delay+.2,hit:false});}
function siteChoices(s,site){
 if(site.kind==='battery')return[{id:'sabotage:silence',kind:'sabotage',key:'silence',title:'포격 통신 교란',label:'보스 공략 지원',desc:s.stage==='holdout'?'현재 맵의 잔류 증원 포격·탄막을 줄입니다. 다음 맵에서는 초기화됩니다.':'이번 전선 보스의 포격을 한 발로 줄입니다. 지금 무장을 유지합니다.'},{id:'sabotage:plunder',kind:'sabotage',key:'plunder',title:'시험 탄약 회수',label:'완성 화력 지원',desc:'주무기 숙련 +1. 이미 3단계면 피해 +12% · HP +20. 보스 포격은 유지됩니다.'}];
 const slots=s.weapons,primary=slots[0],all=BASE_WEAPONS.filter(id=>!slots.some(w=>acceptsMod(w,id))),partner=Object.values(UNIONS).find(u=>u.parts.includes(primary.id))?.parts.find(id=>id!==primary.id),pool=[...all];
 const candidates=[];if(all.includes(partner)){candidates.push(partner);pool.splice(pool.indexOf(partner),1);}while(candidates.length<2&&pool.length){const id=pick(s,pool);pool.splice(pool.indexOf(id),1);candidates.push(id);}const newGun=slots.some(w=>!w)?candidates[0]:(all.length?pick(s,all):null);
 const cards=[];
 if(s.cores>0){const recipe=readyUnion(s);if(recipe)cards.push(unionCard(recipe));}
 if(cards.some(c=>c.kind==='union')){}else if(UNIONS[primary.id])cards.push(utilityCard('power'));else if(primary.rank<3)cards.push(upgradeCard(primary,0));else if(!primary.evolved&&s.cores>0)cards.push(evolveCard(primary,0));else cards.push(utilityCard('power'));
 const empty=slots.findIndex(w=>!w);
 if(empty>=0)for(const id of candidates)cards.push({id:`weapon:${id}:${empty}`,kind:'weapon',weapon:id,slot:empty,title:`${WEAPONS[id].name} 확보`,label:'새 지원 무기',desc:WEAPONS[id].desc});
 else if(newGun)cards.push({id:`offer:${newGun}`,kind:'weapon-offer',weapon:newGun,title:`${WEAPONS[newGun].name} 확보`,label:'무장 교체 · 위치 선택',desc:WEAPONS[newGun].desc+' · 다음 선택에서 교체할 슬롯을 고릅니다.'});
 if(empty<0||site.kind!=='supply')cards.push({id:'resupply',kind:'resupply',title:'현재 무장 정비',label:'무장 유지 · 체력 +35',desc:'총을 바꾸지 않고 회복·강화 탄창을 보급합니다.'});
 return cards.slice(0,3);
}
const readyUnion=s=>Object.keys(UNIONS).find(id=>UNIONS[id].parts.every(part=>s.weapons.some(w=>w?.id===part&&w.rank===3)));
const unionCard=(id='u')=>({id:id==='u'?'union':`union:${id}`,kind:'union',recipe:id,title:WEAPONS[id].name,label:`${WEAPONS[id].short} 최종 합체 · 핵심 1`,desc:UNIONS[id].desc+' · 두 무기를 한 칸으로, 연구 개조 유지.'});
const upgradeCard=(w,slot)=>({id:`rank:${slot}`,kind:'rank',slot,title:`${WEAPONS[w.id].name} ${w.rank+1}단계`,label:'무기 숙련',desc:WEAPONS[w.id].ranks[w.rank]});
const evolveCard=(w,slot)=>({id:`evolve:${slot}`,kind:'evolve',slot,title:WEAPONS[w.id].evolution,label:'무기 진화 · 핵심 1',desc:'탄 수·관통·폭발이 크게 강화됩니다. 지금 장비의 투자를 유지합니다.'});
function utilityCard(key){const map={power:['화력 집중','모든 무기 피해 +12%'],vitality:['야전 응급처치','이번 판 최대 HP +10 · 체력 +25'],magnet:['전장 회수','경험치 회수 반경 +25%'],tempo:['속사 기동','모든 무기 공격 간격 −7%'],projectile:['추가 탄환','사격 무기 탄 수 +1']};return{id:`utility:${key}`,kind:'utility',key,title:map[key][0],label:'전술 보조',desc:map[key][1]};}
export function availableUpgrades(s){
 const cards=[],recipe=readyUnion(s);if(recipe&&s.cores>0)cards.push(unionCard(recipe));
 s.weapons.forEach((w,slot)=>{if(w&&!UNIONS[w.id]&&w.rank===3&&!w.evolved&&s.cores>0)cards.push(evolveCard(w,slot));});
 const mods=[];
 for(const id of s.snapshot.researched){const def=RESEARCH[id],slot=s.weapons.findIndex(w=>acceptsMod(w,def.weapon)&&w.rank>=1&&!w.mods.includes(id));if(slot>=0)mods.push({id:`mod:${id}`,kind:'mod',mod:id,slot,title:def.name,label:'연구한 개조',desc:def.desc,fresh:s.snapshot.freshMods.includes(id)&&!s.researchPresented.includes(id)});}
 const fresh=mods.find(c=>c.fresh);if(fresh)cards.unshift(fresh);
 const ranked=s.weapons.map((w,i)=>w&&!UNIONS[w.id]&&w.rank<3?upgradeCard(w,i):null).filter(Boolean);if(ranked.length)cards.push(pick(s,ranked));
 if(mods.length)cards.push(pick(s,mods));
 const utilities=['power','vitality','magnet','tempo','projectile'].filter(k=>(s.boosts[k]||0)<(s.stage==='holdout'&&['power','vitality'].includes(k)?Infinity:k==='projectile'?1:3));
 while(cards.length<6&&utilities.length){const key=pick(s,utilities);utilities.splice(utilities.indexOf(key),1);cards.push(utilityCard(key));}
 if(!cards.length)cards.push({id:'resupply',kind:'resupply',title:'전투 정비',label:'완성 빌드 · 야전 보급',desc:'체력 +35 · 강화 탄창 충전. 완성한 무장을 유지합니다.'});
 const unique=[...new Map(cards.map(c=>[c.id,c])).values()].slice(0,3);
 for(const c of unique)if(c.kind==='mod'&&!s.researchPresented.includes(c.mod))s.researchPresented.push(c.mod);
 return unique;
}
function openLevel(s){if(s.pendingLevels<=0||s.phase!=='playing')return;s.pendingLevels--;s.phase='choice';s.choiceType='level';s.choices=availableUpgrades(s);emit(s,'level');}
export function rerollMission(s){if(s.phase!=='choice'||s.choiceType!=='level'||s.rerolls<=0)return false;s.rerolls--;s.choices=availableUpgrades(s);emit(s,'choose');return true;}
export function chooseMission(s,id){
 if(s.phase!=='choice')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 if(c.kind==='travel'){if(!s.cleared||!['advance','stay','extract'].includes(c.key))return false;if(c.key==='advance'){if(s.front>=2)return false;advanceFront(s);}else if(c.key==='extract'){if(s.front!==2)return false;endMission(s,'victory');return true;}else{s.stage='holdout';s.targetId='exit';}s.phase='playing';s.choices=[];s.choiceType=null;return true;}
 if(c.kind==='weapon-offer'){if(!WEAPONS[c.weapon])return false;s.choiceType='replace';s.choiceSite=`${WEAPONS[c.weapon].name} · 교체 위치`;s.choices=s.weapons.map((w,slot)=>({id:`weapon:${c.weapon}:${slot}`,kind:'weapon',weapon:c.weapon,slot,title:`${slot===0?'주무기':'지원무기'} 교체`,label:`${WEAPONS[w.id].short} → ${WEAPONS[c.weapon].short}`,desc:`${WEAPONS[w.id].name} ${w.rank}단계와 개조를 교체합니다.`}));s.choices.push({id:'keep',kind:'keep',title:'현재 무장 유지',label:'교체 취소',desc:'총과 개조를 그대로 유지하고 전투로 돌아갑니다.'});return true;}
 if(c.kind==='rank'){const w=s.weapons[c.slot];if(!w||w.rank>=3)return false;w.rank++;if(w.id==='p'&&w.rank===3)s.stats.pMastery=true;}
 else if(c.kind==='weapon')s.weapons[c.slot]=weapon(c.weapon);
 else if(c.kind==='mod'){const w=s.weapons[c.slot];if(!w||w.mods.includes(c.mod))return false;w.mods.push(c.mod);}
 else if(c.kind==='evolve'){const w=s.weapons[c.slot];if(!w||w.rank<3||w.evolved||s.cores<=0)return false;s.cores--;w.evolved=true;if(!s.stats.evolved.includes(w.id))s.stats.evolved.push(w.id);s.surge+=60;blast(s,s.player.x,s.player.y,190,160,[w.id]);s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);emit(s,'forge-evolve');}
 else if(c.kind==='union'){
  const recipe=c.recipe||'u';if(s.cores<=0||!UNIONS[recipe]||!UNIONS[recipe].parts.every(part=>s.weapons.some(w=>w?.id===part&&w.rank===3)))return false;
  s.cores--;const mods=[...new Set(s.weapons.flatMap(w=>w?.mods||[]))];s.weapons=[{...weapon(recipe),rank:3,evolved:true,mods},null];s.stats.union=true;s.stats.unionIds.push(recipe);s.surge+=100;blast(s,s.player.x,s.player.y,230,210,weaponTags(recipe));emit(s,'forge-union');
 }else if(c.kind==='tactic'){
  if(!TACTICS[c.key]||s.tactics.includes(c.key))return false;s.tactics.push(c.key);s.stats.supplyPicks.push(c.key);s.cores++;
  if(c.key==='assault'){const w=s.weapons[0];if(!UNIONS[w.id]&&w.rank<3)w.rank++;if(w.id==='p'&&w.rank===3)s.stats.pMastery=true;}
  if(c.key==='fusion')for(const w of s.weapons)if(w&&BASE_WEAPONS.includes(w.id)&&w.rank<3)w.rank++;
  if(c.key==='armor'){s.armorVoucher=true;if(s.player.slug)s.player.slugHp=160;}
  if(c.key==='barrage')s.barrageAt=Math.floor(s.stats.kills/35);
  if(c.key==='repair'){s.player.maxHp+=20;s.player.hp=s.player.maxHp;}
  if(c.key==='requisition'){const w=s.weapons.find(w=>w&&s.snapshot.researched.some(id=>acceptsMod(w,RESEARCH[id].weapon)&&!w.mods.includes(id)));if(w){const id=s.snapshot.researched.find(id=>acceptsMod(w,RESEARCH[id].weapon)&&!w.mods.includes(id));w.mods.push(id);s.researchPresented.push(id);}else if(!UNIONS[s.weapons[0].id]&&s.weapons[0].rank<3)s.weapons[0].rank++;else s.boosts.power++;}
  if(s.weapons.some(w=>w?.id==='p'&&w.rank===3))s.stats.pMastery=true;routeChoices(s);return true;
 }else if(c.kind==='sabotage'){
  if(!['silence','plunder'].includes(c.key))return false;if(c.key==='silence')s.boss.suppressed=true;else{const w=s.weapons[0];if(!UNIONS[w.id]&&w.rank<3)w.rank++;else s.boosts.power++;s.player.hp=Math.min(s.player.maxHp,s.player.hp+20);}s.stats.supplyPicks.push(c.key);
 }else if(c.kind==='utility'){
  if(c.key==='vitality'){s.boosts.vitality=(s.boosts.vitality||0)+1;s.player.maxHp+=10;s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);}else s.boosts[c.key]++;
 }else if(c.kind==='resupply'){s.player.hp=Math.min(s.player.maxHp,s.player.hp+35);s.player.charge=100;s.player.overdrive=Math.max(3,s.player.overdrive);}
 if(s.weapons.some(w=>w?.id==='p'&&w.rank===3))s.stats.pMastery=true;
 s.player.invuln=Math.max(.6,s.player.invuln);s.phase='playing';s.choices=[];s.choiceType=null;emit(s,'choose');fx(s,'growth',s.player.x,s.player.y,{r:110,life:.7});return true;
}
export function pauseMission(s){if(s.phase!=='playing')return false;s.phase='paused';return true;}
export function resumeMission(s){if(s.phase!=='paused')return false;s.phase='playing';return true;}
export function endMission(s,reason='retreat'){
 if(s.phase==='result')return false;if(reason==='retreat'&&s.front===2&&s.cleared&&s.player.hp>0)reason='victory';s.phase='result';s.result={won:reason==='victory',reason,seconds:s.t,hero:s.hero,stats:copy(s.stats),weapons:copy(s.weapons),training:copy(s.snapshot.training),doctrine:s.snapshot.doctrine};emit(s,reason==='victory'?'boss-defeated':'hurt');return true;
}
export function interaction(s){
 const p=s.player;if(s.cleared&&dist(p,BOSS_GATE)<190)return{id:'route',title:s.front===2?'귀환 / 계속 전투':'다음 미션 / 계속 전투',detail:'F · 진입 결정 전에는 현재 맵 유지'};if(p.slug&&s.stage==='field'&&dist(p,BOSS_GATE)<190)return{id:'boss',title:`Slug로 ${FRONTS[s.front].boss} 교전`,detail:'현재 무장과 병기를 유지하고 진입'};if(p.slug)return {id:'exit-slug',title:'하차',detail:'현재 무기와 체력을 유지합니다'};
 const garage=s.sites.find(n=>n.id==='garage');if(garage.state==='ready'&&dist(p,garage)<120)return{id:'slug',title:'Slug 탑승',detail:`내구 ${s.tactics.includes('armor')?160:120} · E 주포 · F 하차`};
 if(s.stage==='field'&&dist(p,BOSS_GATE)<190)return{id:'boss',title:`${FRONTS[s.front].boss} 교전`,detail:'지금 화력으로 도전 · 언제든 진입'};
 return null;
}
export function missionAction(s,action){
 if(s.phase!=='playing')return false;const p=s.player;
 if(action==='interact'){
  const item=interaction(s);if(!item)return false;
  if(item.id==='route'){routeChoices(s);return true;}
  if(item.id==='exit-slug'){p.slug=false;Object.assign(p,vehicleMotion(p.bodyAngle));p.invuln=1;fx(s,'text',p.x,p.y-65,{text:'하차',life:.7});}
  if(item.id==='slug'){Object.assign(p,vehicleMotion(Math.atan2(p.fy,p.fx)));p.slug=true;p.slugHp=s.tactics.includes('armor')?160:120;p.invuln=1;s.sites.find(n=>n.id==='garage').state='done';s.stats.slugCaptured=(s.stats.slugCaptured||0)+1;emit(s,'forge-evolve');}
  if(item.id==='boss'){
   s.stage='boss';s.boss.active=true;s.boss.mode='walk';s.boss.timer=1.7;p.x=0;p.y=BOSS_POSITION.y+300;p.vx=0;p.vy=0;p.invuln=1.5;
   s.enemies=s.enemies.filter(e=>dist(e,s.boss)<500);s.enemyShots=[];s.hazards=[];fx(s,'text',0,BOSS_POSITION.y+230,{text:`${FRONTS[s.front].boss} · 전선 돌파`,life:2});emit(s,'boss-arrival');
  }
  return true;
 }
 if(action==='dash'){if(p.dashCd>0)return false;p.dash=.18;p.dashCd=2.3;p.invuln=.42;fx(s,'dash',p.x,p.y,{life:.25,angle:Math.atan2(p.fy,p.fx)});emit(s,'whoosh');return true;}
 if(action!=='skill'||p.skillCd>0)return false;
 const target=targetFor(s,true),a=target?Math.atan2(target.y-p.y,target.x-p.x):p.aim;
 if(p.slug){if(s.hero==='fio'&&p.charge>=60){p.charge-=60;p.overdrive=s.snapshot.doctrine==='quick'?4:7;}p.skillCd=s.tactics.includes('armor')?2.5:3.2;p.aim=a;p.attack=.2;p.flash=.12;p.kick=1;projectile(s,{id:'u'},a,220,1,{rocket:true,speed:550,blast:140});emit(s,'burst');}
 else if(s.hero==='fio'){
  if(p.charge<60)return false;p.charge=0;p.overdrive=s.snapshot.doctrine==='quick'?4:7;p.skillCd=s.snapshot.doctrine==='quick'?3:5;emit(s,'burst');fx(s,'text',p.x,p.y-85,{text:'전탄 보급!',life:1});
 }else{
  const fan=s.snapshot.doctrine==='fan',w=s.weapons[0],count=fan?9:5;
  for(let i=0;i<count;i++)projectile(s,w,a+(i-(count-1)/2)*(fan?.11:.025),(fan?55:88)*(1+s.level*.035),18,{width:8,speed:1050,skill:true});p.skillCd=7;p.attack=.25;emit(s,'burst');s.shake=4;
 }
 return true;
}
function spawnGuards(s,site){
 const reserve=site.guards,alive=s.enemies.filter(e=>!e.dead);if(alive.length+reserve>200){const remove=new Set(alive.filter(e=>!e.siteId).sort((a,b)=>dist(b,s.player)-dist(a,s.player)).slice(0,alive.length+reserve-200).map(e=>e.id));s.enemies=s.enemies.filter(e=>!remove.has(e.id));}
 site.wave++;const count=site.guards;for(let i=0;i<count;i++){const a=i*TAU/count,heavy=site.wave>1;const type=i===0&&['camp','garage'].includes(site.id)?'officer':i%5===1?'mortar':i%3===0?'shield':'rifle';spawn(s,type,site.x+Math.cos(a)*(heavy?220:95),site.y+Math.sin(a)*(heavy?190:75),site.id);}emit(s,'horde');
}
function updateSites(s){
 if(!['field','holdout'].includes(s.stage))return;
 for(const site of s.sites){
  if(['boss','exit'].includes(site.kind))continue;
  if(site.state==='waiting'&&dist(s.player,site)<270){site.state='active';spawnGuards(s,site);}
  if(site.state==='active'&&!s.enemies.some(e=>e.siteId===site.id&&!e.dead)){
   if(site.wave<site.waves){spawnGuards(s,site);fx(s,'text',site.x,site.y-75,{text:`호위대 ${site.wave}/${site.waves}`,life:1.3});}
   else{site.state='ready';fx(s,'growth',site.x,site.y,{life:1,r:100});emit(s,'level');}
  }
  if(site.state==='ready'&&site.kind!=='garage'&&dist(s.player,site)<115){
   site.state='done';s.stats.rescues+=site.rescues;
   if(['camp','convoy'].includes(site.kind))s.stats.outposts++;
   if(site.kind!=='supply')s.cores++;
   s.player.hp=Math.min(s.player.maxHp,s.player.hp+14);s.player.charge=100;if(s.hero==='fio')s.player.overdrive=3;
   gainXp(s,s.front===0?15:8);s.phase='choice';s.choiceType='supply';s.choiceSite=site.name;s.choices=siteChoices(s,site);emit(s,'heal');return;
  }
 }
}
function lane(s,x,y,x2,y2,width=62,delay=1.1){if(s.hazards.length<20)s.hazards.push({shape:'beam',x,y,x2,y2,width,r:width,timer:delay,life:delay+.25,hit:false});}
export function bossStatus(s){const b=s.boss;if(s.front===0)return b.mode==='windup'?'돌진 예고! 옆으로 회피':b.mode==='charge'?'돌진 중 · 경로를 벗어나세요':b.mode==='recover'?'후면 엔진 노출 · 뒤에서 피해 ×2.8':'전면 장갑 · 돌진을 유도하세요';if(s.front===1)return b.parts.every(p=>p.hp<=0)?'포대 정지 · 본체 집중 사격':`안전 통로 ${b.safeX<0?'왼쪽':b.safeX>0?'오른쪽':'중앙'} · 남은 포대부터 파괴`;return b.coreOpen>0?'코어 노출! 완성 화력을 집중하세요':b.mode==='sweep-windup'?'레이저 예고 · 옆으로 이동':b.mode==='sweep'?'회전 레이저 · 빔을 가로질러 회피':'코어 잠김 · 포탑과 궤도부터 파괴';}
function updateBoss(s,dt){
 const b=s.boss,p=s.player;if(!b.active)return;b.timer-=dt;b.coreOpen=Math.max(0,b.coreOpen-dt);b.exposed=Math.max(0,(b.exposed||0)-dt);
 if(b.burn>0){b.burn-=dt;b.burnTick=(b.burnTick||0)-dt;if(b.burnTick<=0){b.burnTick=.3;damage(s,{id:'core',type:'core',x:b.x,y:b.y,r:51},b.burnDamage||9,b.burnTags||['f'],'fire');}}
 b.kick*=Math.exp(-dt*12);b.flash=Math.max(0,b.flash-dt);b.partKicks=b.partKicks.map(n=>n*Math.exp(-dt*12));b.turretAngle=turnToward(b.turretAngle,b.mode==='sweep-windup'?b.angle:Math.atan2(p.y-b.y,p.x-b.x),dt*3.8);if(s.front===0){b.bodyAngle=turnToward(b.bodyAngle,b.angle,dt*4);if(b.mode!=='charge'){b.drive=0;b.pitch*=Math.exp(-dt*10);}
  if(b.mode==='charge'){const elapsed=.96-b.timer,t=clamp(elapsed,0,.96),move=carrierTravel(t)-carrierTravel(elapsed-dt);b.drive=move/dt;b.x+=Math.cos(b.angle)*move;b.y+=Math.sin(b.angle)*move;b.tread+=move;b.pitch=clamp((t<.16?-.07:t>.8?.08:0),-.1,.1);if(b.timer<=0){b.mode='recover';b.timer=3;b.drive=0;fx(s,'text',b.x,b.y-105,{text:'후면 엔진 노출!',life:1.6});}}
  else if(b.mode==='windup'){if(b.timer<=0){b.mode='charge';b.timer=.96;b.kick=.6;emit(s,'boss-charge');}}
  else if(b.timer<=0){if(b.mode==='recover'){b.mode='walk';b.timer=1;}else{b.mode='windup';b.timer=1;b.angle=Math.atan2(p.y-b.y,p.x-b.x);emit(s,'boss-warning');}}
 }else if(s.front===1){
  if(b.timer<=0){b.kick=.8;b.flash=.12;b.partKicks=b.parts.map(part=>part.hp>0?1:0);b.cycle++;b.safeX=[-210,0,210][b.cycle%3];const active=b.parts.map(p=>p.hp>0);let emitted=0;for(const n of [-2,-1,0,1,2]){const x=n*210;if(Math.abs(x-b.safeX)<100||n<0&&!active[0]||n>0&&!active[1]||b.suppressed&&emitted>=1)continue;emitted++;lane(s,x,b.y-170,x,b.y+440,58,1.15);}for(const part of b.parts)if(part.hp>0){const a=Math.atan2(p.y-(b.y+part.oy),p.x-(b.x+part.ox));for(const offset of [-.17,.17])emitEnemyShot(s,b.x+part.ox,b.y+part.oy,a+offset,150);}b.mode='recover';b.timer=3.4;emit(s,'boss-warning');}
 }else{
  const broken=b.parts.every(part=>part.hp<=0);
  if(b.mode==='sweep'){b.angle+=dt*1.25;b.turretAngle=b.angle;if(segmentDistance(p.x,p.y,b.x+Math.cos(b.angle)*140,b.y+Math.sin(b.angle)*140,b.x+Math.cos(b.angle)*740,b.y+Math.sin(b.angle)*740)<(p.slug?45:29))hurtPlayer(s,13,b.x,b.y);}
  if(b.timer<=0){
   if(broken){if(b.mode==='expose'){b.mode='reload';b.timer=1.4;for(const dx of (b.suppressed?[0]:[-100,0,100]))hazard(s,p.x+dx,p.y,45,1);}else{b.mode='expose';b.timer=3.6;b.coreOpen=3.6;}}
   else if(b.mode==='sweep-windup'){b.mode='sweep';b.timer=1.4;b.kick=.5;emit(s,'boss-charge');}
   else if(b.mode==='sweep'){b.mode='recover';b.timer=1.8;}
   else{b.cycle++;if(b.cycle%2===0&&b.parts[0].hp>0){b.mode='sweep-windup';b.timer=1.05;b.angle=Math.atan2(p.y-b.y,p.x-b.x)-.65;}else{const a=Math.atan2(p.y-b.y,p.x-b.x);b.turretAngle=a;b.kick=1;b.flash=.15;for(let i=-4;i<=4;i++)emitEnemyShot(s,b.x,b.y,a+i*.19,180);if(b.parts[1].hp>0)for(const dx of (b.suppressed?[0]:[-90,0,90]))hazard(s,p.x+dx,p.y,50,1.1);b.mode='recover';b.timer=2.1;}emit(s,'boss-warning');}
  }
 }
 b.x=clamp(b.x,-600,600);b.y=clamp(b.y,BOSS_POSITION.y-210,BOSS_POSITION.y+210);if(dist(p,b)<b.r+15)hurtPlayer(s,18,b.x,b.y);
}
function updateHoldout(s,dt){
 const previous=holdoutDanger(s),p=s.player;
 s.holdoutTime+=dt;s.stats.holdoutSeconds+=dt;
 const danger=holdoutDanger(s);s.stats.bestDanger=Math.max(s.stats.bestDanger,danger);
 if(danger<=previous)return;
 for(let i=0;i<2;i++){const a=rand(s)*TAU;spawn(s,i?'mortar':'officer',p.x+Math.cos(a)*370,p.y+Math.sin(a)*370);}
 if(danger>=3){
  const suppressed=s.boss.suppressed;
  if(s.front===0){for(const dx of (suppressed?[0]:[-90,0,90]))hazard(s,p.x+dx,p.y,52,1.25);}
  else if(s.front===1){for(const dx of (suppressed?[-150]:[-150,150]))lane(s,p.x+dx,p.y-280,p.x+dx,p.y+280,48,1.2);}
  else{
   for(const dx of (suppressed?[0]:[-100,0,100]))hazard(s,p.x+dx,p.y,50,1.2);
   const fan=suppressed?1:3;for(let i=-fan;i<=fan;i++)emitEnemyShot(s,p.x,p.y-350,Math.PI/2+i*.2,190);
  }
 }
 emit(s,'horde');fx(s,'text',p.x,p.y-120,{text:`증원 위험 ${danger} · 처치 점수 상승`,life:1.7});
}
export function stepMission(s,dt,input={x:0,y:0}){
 if(s.phase!=='playing')return;dt=clamp(dt,0,.05);if(!dt)return;
 if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);return;}
 s.t+=dt;s.arrival=Math.max(0,(s.arrival||0)-dt);if(s.stage==='holdout')updateHoldout(s,dt);
 const p=s.player;p.kick*=Math.exp(-dt*15);p.flash=Math.max(0,p.flash-dt);
 for(const key of ['hurt','invuln','dash','dashCd','skillCd','overdrive','attack','focusTime'])p[key]=Math.max(0,p[key]-dt);
 if(p.focusTime<=0)p.focus=0;
 s.shake=Math.max(0,s.shake-dt*24);s.impactCd=Math.max(0,s.impactCd-dt);if(s.hero==='fio')p.charge=Math.min(100,p.charge+dt*(s.snapshot.doctrine==='quick'?4:2));
 const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.hypot(ix,iy),force=Math.min(1,len);
 if(len>.05){p.fx=ix/len;p.fy=iy/len;}p.moving=len>.05||p.dash>0;
 const speed=p.dash>0?670:p.slug?175:205,movement=speed*dt*(p.dash>0?1:force);
 if(p.slug)drivePlayer(p,dt,{x:p.fx,y:p.fy,force:p.dash>0?1:force});else if(p.moving){p.x+=p.fx*movement;p.y+=p.fy*movement;p.walk+=movement;}
 p.x=clamp(p.x,s.stage==='boss'?-700:FIELD.left,s.stage==='boss'?700:FIELD.right);p.y=clamp(p.y,s.stage==='boss'?BOSS_POSITION.y-300:FIELD.top,s.stage==='boss'?BOSS_POSITION.y+440:FIELD.bottom);
 if(p.x===(s.stage==='boss'?-700:FIELD.left)&&p.vx<0||p.x===(s.stage==='boss'?700:FIELD.right)&&p.vx>0)p.vx=0;if(p.y===(s.stage==='boss'?BOSS_POSITION.y-300:FIELD.top)&&p.vy<0||p.y===(s.stage==='boss'?BOSS_POSITION.y+440:FIELD.bottom)&&p.vy>0)p.vy=0;
 updateSites(s);if(s.phase!=='playing')return;
 for(const w of s.weapons){if(!w)continue;w.cd-=dt;if(w.cd<=0){fireWeapon(s,w);const def=WEAPONS[w.id],base=def.interval*(w.rank>=2&&w.id==='h'?.78:1)*(w.evolved?.78:1);w.cd=base*(1-(s.snapshot.training.cycling||0)*.02)*(1-s.boosts.tempo*.07)*(p.overdrive>0?.7:1);}}
 s.spawnClock-=dt;
 if(s.spawnClock<=0){const late=s.level>=7||s.t>80,count=s.stage==='holdout'?Math.min(18,7+holdoutDanger(s)*2):s.stage==='boss'?2:s.front===2?8:s.front===1?6:late?5:3;
  for(let i=0;i<count;i++){const a=rand(s)*TAU,r=370+rand(s)*75;let x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(s.stage==='boss')y=clamp(y,BOSS_POSITION.y-270,BOSS_POSITION.y+420);spawn(s,s.stage==='holdout'&&holdoutDanger(s)>=3&&i===0?'officer':rand(s)<.14?'shield':rand(s)<(s.stage==='holdout'?.16:.08)?'mortar':'rifle',x,y);}
  s.spawnClock=s.stage==='holdout'?Math.max(.16,.5-holdoutDanger(s)*.025):s.stage==='boss'?1.2:s.front===2?.32:s.front===1?.4:late?.36:s.t>25?.7:1.3;if(s.difficulty==='dense')s.spawnClock*=.8;
 }
 if(s.surge>0&&s.enemies.filter(e=>!e.dead).length<150){const amount=Math.min(10,s.surge);s.surge-=amount;for(let i=0;i<amount;i++){const a=rand(s)*TAU;spawn(s,'rifle',p.x+Math.cos(a)*330,p.y+Math.sin(a)*330);}}
 s.waveClock-=dt;if(s.waveClock<=0){s.waveClock=22;const a=Math.atan2(p.fy,p.fx)+(rand(s)>.5?.7:-.7);fx(s,'reinforce',p.x+Math.cos(a)*250,p.y+Math.sin(a)*250,{life:1.5,pending:true,angle:a});emit(s,'horde');}
 for(const e of s.enemies){
  if(e.dead){e.deathLife-=dt;continue;}e.age+=dt;e.hurt=Math.max(0,e.hurt-dt);e.slow=Math.max(0,e.slow-dt);e.exposed=Math.max(0,(e.exposed||0)-dt);if(e.burn>0){e.burn-=dt;e.burnTick=(e.burnTick||0)-dt;if(e.burnTick<=0){e.burnTick=.3;damage(s,e,e.burnDamage||9,e.burnTags||['f'],'fire');if(e.dead)continue;}}e.timer-=dt;
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
  if(shot.homing){let nearest=null,best=600;for(const target of targets(s)){const d=dist(shot,target);if(d<best){best=d;nearest=target;}}if(nearest){const desired=Math.atan2(nearest.y-shot.y,nearest.x-shot.x),turn=Math.atan2(Math.sin(desired-shot.angle),Math.cos(desired-shot.angle)),speed=Math.hypot(shot.vx,shot.vy);shot.angle+=clamp(turn,-dt*6,dt*6);shot.vx=Math.cos(shot.angle)*speed;shot.vy=Math.sin(shot.angle)*speed;}}
  const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
  for(const e of targets(s)){
   if(shot.hits.includes(e.id)||segmentDistance(e.x,e.y,ox,oy,shot.x,shot.y)>e.r+(shot.width||4))continue;
   shot.hits.push(e.id);
   if(shot.rocket){blast(s,shot.x,shot.y,shot.blast,shot.damage,shot.tags,shot.fire);shot.life=0;break;}
   if(shot.flame){const burning=['part','core'].includes(e.type)?s.boss:e;burning.burn=shot.burn;burning.burnDamage=shot.damage*.45;burning.burnTags=shot.tags;}
   const close=shot.pellet&&dist(s.player,e)<240;let impact=shot.damage*(close?1.6:1);if(shot.shred&&close&&e.type==='part')impact*=1.25;
   damage(s,e,impact*(shot.skill&&['part','core'].includes(e.type)?.65:1),shot.tags,'bullet',shot.angle);fx(s,'hit',e.x,e.y-23,{life:.15,angle:shot.angle});
   if(shot.split&&!shot.fragment){for(const side of [-1,1])if(s.shots.length<280)s.shots.push({...shot,id:++s.idCounter,x:e.x,y:e.y,vx:Math.cos(shot.angle+side*.65)*640,vy:Math.sin(shot.angle+side*.65)*640,angle:shot.angle+side*.65,damage:shot.damage*.5,pierce:2,hits:[e.id],life:.35,split:false,fragment:true});}
   if(shot.ricochet&&!shot.bounced){const other=targets(s).filter(o=>!shot.hits.includes(o.id)&&dist(o,e)<230).sort((a,b)=>dist(a,e)-dist(b,e))[0];if(other){shot.angle=Math.atan2(other.y-e.y,other.x-e.x);shot.vx=Math.cos(shot.angle)*800;shot.vy=Math.sin(shot.angle)*800;shot.pierce++;shot.bounced=true;}}
   if(shot.tags.includes('h')&&!shot.fragment&&s.weapons.some(w=>w?.mods.includes('h-capacitor'))){s.capacitor=(s.capacitor||0)+1;if(s.capacitor>=18){s.capacitor=0;p.charge=Math.min(100,p.charge+12);blast(s,e.x,e.y,100,70,['h']);}}
   if(shot.weapon==='u'&&!shot.fragment){const u=s.weapons.find(w=>w?.id==='u');u.proc=(u.proc||0)+1;if(u.proc>=6){u.proc=0;const t=targetFor(s,true);if(t)projectile(s,u,Math.atan2(t.y-p.y,t.x-p.x),85,1,{rocket:true,homing:true,speed:540,blast:85,fire:u.mods.includes('r-incendiary')});}}
   if(shot.hits.length>=shot.pierce){shot.life=0;break;}
  }
 }
 for(const shot of s.enemyShots){const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;if(segmentDistance(p.x,p.y,ox,oy,shot.x,shot.y)<(p.slug?28:13)){hurtPlayer(s,7,shot.x-shot.vx*.1,shot.y-shot.vy*.1);shot.life=0;}}
 for(const h of s.hazards){h.timer-=dt;h.life-=dt;if(!h.hit&&h.timer<=0){h.hit=true;fx(s,'enemy-explosion',h.x,h.y,{r:h.r,life:.35});if((h.shape==='beam'?segmentDistance(p.x,p.y,h.x,h.y,h.x2,h.y2)<h.width+(p.slug?22:9):dist(p,h)<h.r+(p.slug?22:9)))hurtPlayer(s,12,h.x,h.y);}}
 for(const z of s.zones){z.life-=dt;z.tick-=dt;if(z.tick<=0){z.tick=.3;for(const e of targets(s))if(dist(z,e)<z.r+e.r){const burning=['part','core'].includes(e.type)?s.boss:e;burning.burn=Math.max(burning.burn||0,.6);burning.burnTags=z.tags;burning.burnDamage=z.damage*.3;damage(s,e,z.damage,z.tags,'fire');}}}
 for(const g of s.gems){g.age+=dt;const d=dist(g,p),range=135*(1+(s.snapshot.training.pickup||0)*.1+s.boosts.magnet*.25);if(d<range||g.age>8){const step=Math.min(d,(360+g.age*12)*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<25){gainXp(s,g.value);g.done=true;if(g.ammo){p.charge=100;if(s.hero==='fio')p.overdrive=Math.max(p.overdrive,3);}emit(s,'xp');}}
 for(const f of s.effects){f.age+=dt;if(f.pending&&f.type==='reinforce'&&f.age>=1.25){f.pending=false;for(let i=0;i<12;i++)spawn(s,i%5?'rifle':'shield',f.x+Math.cos(f.angle+Math.PI/2)*(i-5.5)*22,f.y+Math.sin(f.angle+Math.PI/2)*(i-5.5)*22);}}
 for(const n of s.numbers)n.age+=dt;
 s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;
 s.enemies=s.enemies.filter(e=>e.dead?e.deathLife>0:e.siteId||dist(e,p)<950);s.shots=s.shots.filter(o=>o.life>0).slice(-280);s.enemyShots=s.enemyShots.filter(o=>o.life>0);s.hazards=s.hazards.filter(o=>o.life>0);s.zones=s.zones.filter(o=>o.life>0);s.gems=s.gems.filter(g=>!g.done);s.effects=s.effects.filter(o=>o.age<o.life);s.numbers=s.numbers.filter(o=>o.age<o.life);
 if(p.hp<=0){s.pendingWin=false;endMission(s,'hp');}else if(s.pendingWin){s.pendingWin=false;completeFront(s);}else openLevel(s);
}
