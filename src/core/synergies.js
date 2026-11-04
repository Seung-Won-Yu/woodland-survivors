export const SYNERGIES={
  gale:{name:'왕복 기류',relic:'wind',weapons:['acorn','moon','returning'],description:'충전 돌풍이 대원에게 돌아오며 한 번 더 관통합니다.'},
  swarm:{name:'실타래 군집',relic:'thread',weapons:['bees','hive'],description:'표식 결산 때 추적벌 두 마리가 추가 출격합니다.'},
  bastion:{name:'가시 방벽',relic:'shell',weapons:['briar','hive'],description:'보호막이 모두 소진되면 주변에 가시 반격을 터뜨립니다.'},
  bramble:{name:'붙잡는 덩굴',relic:'thorn',weapons:['vine'],description:'가시 파열 자리에 적을 느리게 하는 덤불이 남습니다.'},
  garden:{name:'생명 정원',relic:'seed',weapons:['lantern','bloom'],description:'회복 씨앗이 떨어질 때 3초 동안 빛의 지대가 자랍니다.'},
  conductor:{name:'천둥 물결',relic:'tide',weapons:['storm'],description:'회복 파동 뒤 가까운 적 최대 세 마리에게 번개가 이어집니다.'}
};
export const SYNERGY_IDS=Object.keys(SYNERGIES);
export const createSynergies=()=>({stats:Object.fromEntries(SYNERGY_IDS.map(id=>[id,{procs:0,damage:0}])),discovered:[]});
export const synergyReady=(g,id)=>g.relics.items.includes(SYNERGIES[id].relic)&&SYNERGIES[id].weapons.some(w=>Object.hasOwn(g.weapons,w));
export const activeSynergies=g=>SYNERGY_IDS.filter(id=>synergyReady(g,id));
export const synergyMastered=(g,id)=>synergyReady(g,id)&&SYNERGIES[id].weapons.some(w=>g.weapons[w]?.evolved);
export const masteredSynergies=g=>SYNERGY_IDS.filter(id=>synergyMastered(g,id));
export const MASTERY_TEXT={gale:'쌍돌풍이 돌아오며 더 넓게 관통',swarm:'추적벌 4마리 · 관통과 지속 강화',bastion:'보호막 20 · 소진 시 이중 가시 파동',bramble:'넓어진 덤불이 적을 끌어모음',garden:'8처치 발아 · 회복 +12 · 넓고 오래가는 정원',conductor:'넓어진 회복 파동 · 번개 최대 5연결'};
export function synergyAction(g,id,action){
  if(!synergyReady(g,id))return action;
  g.synergies??=createSynergies();g.synergies.stats[id].procs++;
  if(!g.synergies.discovered.includes(id))g.synergies.discovered.push(id);
  return {...action,synergy:id,mastered:synergyMastered(g,id)};
}
export function validSynergies(s){return !!s&&Array.isArray(s.discovered)&&s.discovered.length<=6&&new Set(s.discovered).size===s.discovered.length&&s.discovered.every(id=>SYNERGY_IDS.includes(id))&&SYNERGY_IDS.every(id=>s.stats?.[id]&&['procs','damage'].every(k=>Number.isFinite(s.stats[id][k])&&s.stats[id][k]>=0&&s.stats[id][k]<=1e12));}
