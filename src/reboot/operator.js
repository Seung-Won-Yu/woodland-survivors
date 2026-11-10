import {FIELD,RULES,rayBoxDistance} from './content.js';

export const OPERATORS={
 fio:{name:'피오',short:'FIO',row:2,skill:'전탄 보급',meter:'전탄 보급',start:'reserve',brief:'처치와 XP로 충전. 60을 써서 6초 동안 모든 무장의 연사를 가속합니다.',stances:{reserve:['비축','6초 연사 · 충전 60'],quick:['신속','4초 연사 · 충전 50']}},
 marco:{name:'마르코',short:'MARCO',row:0,skill:'관통 사격',meter:'집중',start:'focus',brief:'가까운 적을 직접 맞혀 집중을 채웁니다. 이동 방향으로 쏘며, 정지 중에는 마지막 방향을 유지합니다.',stances:{focus:['집중 조준','좁고 길게 · 보스 약점 피해 강화'],sweep:['산개 관통','넓고 짧게 · 밀집 보병 제압']}}
};
export const operatorId=s=>s.operator==='marco'?'marco':'fio';
export const operatorOf=s=>OPERATORS[operatorId(s)];
export const chargeLabel=s=>s.operator==='marco'?'집중':'전탄';
export function skillRules(s){
 const id=operatorId(s),actor=OPERATORS[id],doctrine=s.player.doctrine;
 return RULES[id][Object.hasOwn(actor.stances,doctrine)?doctrine:actor.start];
}
export const canUseSkill=s=>s.player.charge>=skillRules(s).cost&&s.player.skillCd<=0&&s.player.overdrive<=0;

export function aimFromInput(input,fallback){
 const x=Number.isFinite(input?.x)?input.x:0,y=Number.isFinite(input?.y)?input.y:0;
 return Math.hypot(x,y)>.07?Math.atan2(y,x):fallback;
}

export function focusLane(s){
 const p=s.player,cfg=skillRules(s),angle=p.moveAim,dx=Math.cos(angle),dy=Math.sin(angle);
 const edgeX=dx>=0?FIELD.right:FIELD.left,edgeY=dy>=0?FIELD.bottom:FIELD.top;
 const xLimit=Math.abs(dx)<1e-9?Infinity:(edgeX-p.x)/dx,yLimit=Math.abs(dy)<1e-9?Infinity:(edgeY-p.y)/dy;
 let length=Math.min(cfg.range,xLimit,yLimit);
 for(const cover of s.blocks)if(cover.hp!==0)length=Math.min(length,rayBoxDistance(p,dx,dy,cover));
 return {angle,dx,dy,length:Math.max(0,length),width:cfg.halfWidth};
}
