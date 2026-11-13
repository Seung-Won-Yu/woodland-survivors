import {CAPTURED_TURRET,distance,isCapturedTurret} from './content.js';

export const COAST_SALVAGE = {
  reach: 92,
  seconds: 5,
  openingRifles: 6,
  steps: [2, 4, 6],
  credits: 40,
  turretName: CAPTURED_TURRET.name,
  roles: {
    marco: {name: '약점 교범', target: '장갑 경비 측후면', brief: '방패 옆을 돌아 약점에 적중 · 관통 사격 피해 증가', rescue: '방패병 옆으로 돌아 약점 타격', weapon: 'r', pairing: '박격포를 멀리서 제압하고 측면 방패병의 약점을 타격'},
    fio: {name: '야전 조립', target: '수송 호위 부품', brief: '표식이 있는 호위 제압 후 부품 회수 · 모든 무장 연사 가속', rescue: '호위가 떨어뜨린 부품 회수', weapon: 'f', pairing: '보급차 호위 두 명의 부품을 회수해 연사 가속'}
  }
};

export const coastSalvage = s => s.operation?.coastSalvage;
export const isCoastRailSortie = s => coastSalvage(s)?.fronts === 2;
export const isSalvageCampaign = s => coastSalvage(s)?.fronts === 3;
export const carriesCoastSalvage = s => isCoastRailSortie(s) || isSalvageCampaign(s);
export const coastAtShore = s => s.operation?.region === 0 && coastSalvage(s);
export const sortieFrontCount = s => coastSalvage(s)?.fronts ?? (coastSalvage(s) ? 1 : 3);
export const canAdvanceFront = s => !!s.operation && s.operation.region + 1 < sortieFrontCount(s);
export const COAST_TURRET_STARTER = 'w-r0';
export const COAST_TURRET_RECOVERED = 'w-captured0';
export const RESCUE_COIL = 'rescue:coil';
export function coastTurretOwner(s,uid) {
  const coast = coastSalvage(s);
  return uid === COAST_TURRET_STARTER && coast?.loadout === 'turret' ||
    uid === COAST_TURRET_RECOVERED && carriesCoastSalvage(s) && coast.turret === 'secured' && coast.mounted === true;
}
export const coastRole = s => COAST_SALVAGE.roles[s.operator === 'marco' ? 'marco' : 'fio'];
export const coastRoleRank = coast => COAST_SALVAGE.steps.filter(step => step <= coast.progress).length;
export const coastRoleBonus = (operator,rank) => (operator==='marco'?.2:.08)*rank;
export function coastRoleSite(s,site){
 const coast=coastAtShore(s);
 return !!(isSalvageCampaign(s)&&coast&&s.stage==='field'&&coast.progress<COAST_SALVAGE.steps.at(-1)
   &&site?.coastApproach===coastRole(s).weapon&&!site.preempt&&s.sites[0]?.state==='done');
}
export const COAST_FAN_ENTRY={depth:194,hold:1.45,ready:.55,guards:[[-66,18],[-79,20],[66,18],[79,20]]};
export function coastFanPosition(site){
 const angle=Math.atan2(1040-site.y,800-site.x)+Math.sign(800-site.x)*.62;
 const dx=Math.cos(angle),dy=Math.sin(angle);
 return {x:site.x+dx*COAST_FAN_ENTRY.depth,y:site.y+dy*COAST_FAN_ENTRY.depth,dx,dy};
}
export function coastFanRescue(s,site=s.sites[0]){
 return s.operation?.region===0&&s.stage==='field'&&coastSalvage(s)?.fanRescue===true&&site?.opening&&site.id==='supply-a'
  &&s.weapons.some(w=>w.uid===COAST_TURRET_STARTER&&isCapturedTurret(w));
}
export const coastGrowthEnemy = (s,e) => s.operator === 'marco'
  ? e.type === 'shield' && !e.coastScanned
  : e.coastCarrier || e.type === 'mortar' || e.type === 'officer';

export function coastRoleTarget(s) {
  const coast = coastAtShore(s);
  if (!coast || s.stage !== 'field' || coastRoleRank(coast) === COAST_SALVAGE.steps.length) return null;
  const marco = s.operator === 'marco';
  const enemies = s.enemies.filter(e => !e.dead && e.hp > 0 && coastGrowthEnemy(s,e));
  const marked = enemies.filter(e => marco ? e.coastArmor : e.coastCarrier);
  const rescueGuards = isSalvageCampaign(s)&&s.sites[0]?.state!=='done' ? marked.filter(e=>e.coastRescueShield||e.siteId==='supply-a') : [];
  const fieldGuards = marked.filter(e=>marco?e.coastBatteryShield:e.siteId==='supply-b');
  const parts = !marco && coast.parts.length>0;
  const points = parts ? coast.parts : rescueGuards.length ? rescueGuards : fieldGuards.length ? fieldGuards : marked.length ? marked : enemies;
  const nearest = points.reduce((best, point) =>
    !best || distance(s.player, point) < distance(s.player, best) ? point : best, null);
  return nearest ? {...nearest, name: parts?'회수할 부품':coastRole(s).target} : null;
}

export function coastTurretLane(s) {
  return coastAtShore(s)?.plan === 'break' && s.boss.active && !s.boss.dead && s.boss.parts[0].hp > 0;
}

export function coastHullFront(s) {
  const {boss, player} = s;
  return Math.cos(Math.atan2(player.y - boss.y, player.x - boss.x) - boss.body) > .36;
}

export function coastSalvageWreck(s) {
  const coast = coastAtShore(s);
  return s.stage === 'holdout' && ['intact', 'securing'].includes(coast?.turret) ? s.boss : null;
}

export const railSortieReturned = r => carriesCoastSalvage(r) && r.reason === 'rail-return' &&
  r.operation.region === 1 && r.operation.cleared === 2 && coastSalvage(r).extracted === true;
export const coastTurretReturned = r => coastSalvage(r)?.turret === 'secured' && (railSortieReturned(r) || (isSalvageCampaign(r)
  ? r.won === true && r.operation.extracted === true && r.operation.cleared === 3
  : !isCoastRailSortie(r) && r.reason === 'coast-return' && coastSalvage(r).extracted === true));
