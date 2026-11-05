export const STYLE_DATA={
 pip:[['spread','산개 포격','탄 +2 · 넓은 발사각 · 탄당 피해 −15%','Lv.18: 명중 지점에서 관통 파편'],['focus','집중 포격','좁은 탄도 · 정예·보스 무기 피해 +20%','Lv.18: 보스 반복 적중 뒤 집중 창']],
 bram:[['guard','굳건한 방벽','가드 용량 +8 · 재정비 1.8초','Lv.18: 가까운 적을 늦추는 보호 공간'],['counter','가시 반격','방벽 소진 뒤 넓은 반격 · 재정비 4초','Lv.18: 반격 뒤 귀환 가시']]
};
export const createHeroGrowth=()=>({version:2,branch:null,tier:0,milestone:0,serial:0,casts:[],signatureWindow:[],focusHits:[],focusUntil:0,nextFocusAt:0,nextProcAt:0,guardValue:0,guardMax:12,extraGuard:0,guardReadyAt:0,lastBossAt:-10,bossAttacks:[],multiHits:0,blocked:0});
export function growthCharge(g,amount){const m=g.mastery,at=Math.floor(g.time*20);m.signatureWindow=m.signatureWindow.filter(b=>b.at>=at-20);const used=m.signatureWindow.reduce((s,b)=>s+b.value,0),gain=Math.max(0,Math.min(amount,7-used));if(gain){const b=m.signatureWindow.find(b=>b.at===at);if(b)b.value+=gain;else m.signatureWindow.push({at,value:gain});g.player.charge=Math.min(100,g.player.charge+gain);}return gain;}
export function growthCast(g){if(g.hero!=='pip')return undefined;const m=g.mastery,id=++m.serial;m.casts.push({id,at:g.time,targets:[],first:false,multi:false});if(m.casts.length>96)m.casts.shift();return id;}
export function growthHit(g,e,context){
 if(g.hero!=='pip'||context.source!=='weapon')return false;const m=g.mastery,c=m.casts.find(c=>c.id===context.castId);if(!c||c.targets.includes(e.id))return false;
 if(!c.first){c.first=true;growthCharge(g,.5);}if(c.targets.length<2)c.targets.push(e.id);
 if(m.branch==='focus'&&g.level>=18&&['elite','king'].includes(e.type)&&!m.focusHits.some(h=>h.enemy===e.id&&h.cast===c.id)){
  m.focusHits.push({enemy:e.id,cast:c.id,at:g.time});m.focusHits=m.focusHits.filter(h=>g.time-h.at<6).slice(-12);
  if(g.time>=m.nextFocusAt&&m.focusHits.filter(h=>h.enemy===e.id).length>=3){m.focusUntil=g.time+1.2;m.nextFocusAt=g.time+4;m.focusHits=[];}
 }
 if(c.targets.length>=2&&!c.multi){c.multi=true;m.multiHits++;growthCharge(g,2);if(m.branch==='spread'&&g.level>=18&&g.time>=m.nextProcAt){m.nextProcAt=g.time+1.2;return true;}}
 return false;
}
export function growthTick(g,dt){
 const m=g.mastery,p=g.player,previous=m.milestone;m.milestone=Math.min(3,Math.floor(g.level/6));m.tier=g.level>=18?3:m.branch?2:g.level>=6?1:0;m.casts=m.casts.filter(c=>g.time-c.at<7);m.focusHits=m.focusHits.filter(h=>g.time-h.at<6);
 if(g.enemies.some(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<650))growthCharge(g,dt*.5);
 if(g.hero==='bram'){
  m.guardMax=12+m.milestone*4+(m.branch==='guard'?8:0);const braced=p.still>=.55||p.stillGrace>0;
  if(!braced)m.guardValue=0;else if(m.guardValue<=0&&g.time>=m.guardReadyAt)m.guardValue=m.guardMax;
  if(p.guard<=0)m.extraGuard=0;
 }
 return m.milestone>previous;
}
export function growthBlock(g,enemy,amount,cycle=0){
 if(g.hero!=='bram'||!enemy||amount<=0)return 0;const m=g.mastery,token=`${enemy.id}:${cycle}`;
 if(enemy.bossRole&&(cycle<1||g.time-m.lastBossAt<2||m.bossAttacks.includes(token)))return 0;
 m.blocked+=amount;let charge=amount*.35;
 if(!enemy.bossRole){charge=Math.min(charge,Math.max(0,4-(enemy.guardCharge||0)));enemy.guardCharge=(enemy.guardCharge||0)+charge;}
 else{m.lastBossAt=g.time;m.bossAttacks.push(token);m.bossAttacks=m.bossAttacks.slice(-24);}
 return growthCharge(g,charge);
}
export function growthKill(g,e,context){if(context.source!=='weapon')return;if(g.hero==='bram'&&Math.hypot(e.x-g.player.x,e.y-g.player.y)<=150&&(g.player.still>=.55||g.player.stillGrace>0||g.player.guard>0))growthCharge(g,e.type==='elite'?3:1);else if(!['pip','bram'].includes(g.hero))growthCharge(g,.9);}
export function styleChoices(g){return !g.mastery.branch&&STYLE_DATA[g.hero]&&g.level>=10?STYLE_DATA[g.hero].map(([id,name,description,later])=>({id,kind:'style',name,description,later})):[];}
export function validHeroGrowth(m,g){
 if(!m||m.version!==2||!Number.isInteger(m.serial)||m.serial<0||m.serial>1e12||!Number.isInteger(m.milestone)||m.milestone<0||m.milestone>3||![0,1,2,3].includes(m.tier))return false;
 if(m.milestone>Math.min(3,Math.floor(g.level/6))||m.tier>(g.level>=18?3:m.branch?2:g.level>=6?1:0))return false;
 if(m.branch!==null&&(!STYLE_DATA[g.hero]?.some(b=>b[0]===m.branch)||g.level<10)||g.campaign.styleChosen!==(m.branch!==null))return false;
 if(!['focusUntil','nextFocusAt','nextProcAt','guardValue','guardMax','extraGuard','guardReadyAt','multiHits','blocked'].every(k=>Number.isFinite(m[k])&&m[k]>=0&&m[k]<=1e9)||!Number.isFinite(m.lastBossAt)||m.lastBossAt< -10||m.lastBossAt>g.time||m.guardValue>m.guardMax||m.guardMax>32||m.extraGuard>28)return false;
 if(m.focusUntil>g.time+1.21||m.nextFocusAt>g.time+4.01||m.nextProcAt>g.time+1.21||m.guardReadyAt>g.time+4.01||(m.nextCounterAt!==undefined&&(!Number.isFinite(m.nextCounterAt)||m.nextCounterAt>g.time+3.01)))return false;
 if(!Array.isArray(m.casts)||m.casts.length>96||m.casts.some(c=>!Number.isInteger(c.id)||c.id<=0||c.id>m.serial||!Number.isFinite(c.at)||c.at>g.time||!Array.isArray(c.targets)||c.targets.length>2||c.targets.some(id=>!Number.isInteger(id)||id<1||id>g.id)||typeof c.first!=='boolean'||typeof c.multi!=='boolean'))return false;
 if(!Array.isArray(m.signatureWindow)||m.signatureWindow.length>21||m.signatureWindow.some(b=>!Number.isInteger(b.at)||b.at<0||b.at>Math.floor(g.time*20)||!Number.isFinite(b.value)||b.value<0||b.value>7))return false;
 if(new Set(m.signatureWindow.map(b=>b.at)).size!==m.signatureWindow.length||m.signatureWindow.reduce((s,b)=>s+b.value,0)>7.000001)return false;
 return Array.isArray(m.focusHits)&&m.focusHits.length<=12&&m.focusHits.every(h=>Number.isInteger(h.enemy)&&h.enemy>0&&h.enemy<=g.id&&Number.isInteger(h.cast)&&h.cast>0&&h.cast<=m.serial&&Number.isFinite(h.at)&&h.at<=g.time)&&Array.isArray(m.bossAttacks)&&m.bossAttacks.length<=24&&m.bossAttacks.every(t=>typeof t==='string'&&/^\d+:\d+$/.test(t));
}
