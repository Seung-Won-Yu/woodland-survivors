// Original content. The reference is the continuous-survival decision loop.
export const RUN_SECONDS = 1800;
export const BOSS_SECONDS = 1620;
export const SLOT_LIMIT = 6;
const hero = (name, species, row, weapon, color, trait, detail, skill, skillText, unlock) => ({name,species,row,weapon,hp:100,speed:192,armor:0,color,trait,detail,description:detail,skill,skillText,unlock});
export const HEROES = {
  pip:hero('다람쥐','공격 수',0,'acorn','#eab56b','공격 수 +1','공격 수가 적용되는 공용 무기마다 발사체가 하나 추가됩니다.','집중 난사','바라보는 방향에 관통 도토리를 집중 발사합니다.','처음부터 사용 가능'),
  lune:hero('토끼','이동 속공',1,'moon','#b2c6ef','이동 중 재사용 시간 −15%','이동을 유지하면 재사용 시간이 최대 15% 감소합니다. 멈추면 서서히 풀립니다.','회피 질주','바라보는 방향으로 짧게 무적 질주하며 반달을 던집니다.','한 번의 원정에서 2분 생존'),
  bram:hero('고슴도치','생존',2,'briar','#a6cdb9','받는 피해 −2','모든 받는 피해가 2 감소합니다. 단단한 껍질의 방어 효과와 합쳐집니다.','긴급 방벽','잠시 무적 상태가 되고 가까운 적을 강하게 밀어냅니다.','누적 500마리 처치'),
  fox:hero('여우','정예 사냥',3,'storm','#df9a70','정예·보스 피해 +20%','모든 무기가 정예와 거대 적에게 20% 더 큰 피해를 줍니다.','잔상 미끼','현재 위치에 잔상을 남겨 잠깐 적을 유인합니다.','정예 1마리 처치'),
  mole:hero('두더지','범위',4,'bloom','#c2af91','정지 중 공격 범위 +25%','잠깐 멈추면 공격 범위가 커집니다. 이동을 시작하면 보너스가 서서히 풀립니다.','땅굴 탈출','짧게 무적 이동하며 가까운 적을 밀어냅니다.','첫 일반 진화 달성'),
  otter:hero('수달','지속',5,'lantern','#9fcad2','효과 지속시간 +25%','지속이 적용되는 장판·왕복탄·꿀벌·회전 가시가 더 오래 유지됩니다.','물결 회수','근처의 경험치를 끌어모으고 파도로 적을 밀어냅니다.','반딧불 병 4단계 달성')
};
export const WEAPONS = {
  acorn:{name:'도토리 탄',tag:'투사체 · 관통',color:'#efbe76',max:8,damage:17,cooldown:.72,recipe:'twin',evo:'도토리 폭풍',evoText:'부채꼴 관통탄이 적을 뚫고 연쇄 폭발합니다.',description:'가까운 적에게 도토리를 발사합니다.'},
  moon:{name:'반달 부메랑',tag:'왕복 · 관통',color:'#c5d5ff',max:8,damage:18,cooldown:1.55,recipe:'feather',evo:'은하의 궤적',evoText:'여러 개의 큰 반달이 왕복하며 전장을 가릅니다.',description:'앞으로 날아갔다 돌아오는 반달을 던집니다.'},
  briar:{name:'회전 가시',tag:'궤도 · 공간 확보',color:'#b6df9b',max:8,damage:13,cooldown:.55,recipe:'leaf',evo:'가시 성채',evoText:'촘촘한 가시가 쉬지 않고 회전하며 적을 밀어내고 느리게 만듭니다.',description:'몸 주변을 도는 가시로 접근하는 적을 공격합니다.'},
  bees:{name:'꿀벌 동료',tag:'추적 · 소환',color:'#ffda7d',max:8,damage:13,cooldown:1.18,recipe:'dew',evo:'여왕의 행진',evoText:'벌떼가 오래 머무르며 먼 적까지 추적합니다.',description:'꿀벌이 가까운 적을 찾아 공격합니다.'},
  storm:{name:'번개 꽃',tag:'낙뢰 · 연쇄',color:'#b3dcf3',max:8,damage:29,cooldown:1.85,recipe:'berry',evo:'뇌우 정원',evoText:'적 사이를 건너뛰는 연쇄 낙뢰가 쏟아집니다.',description:'주변 적에게 범위 낙뢰를 떨어뜨립니다.'},
  lantern:{name:'반딧불 병',tag:'장판 · 지속 피해',color:'#90ead1',max:8,damage:10,cooldown:1.75,recipe:'stone',evo:'별빛 연못',evoText:'넓어진 빛의 장판이 몸을 향해 모여들며 적을 끌어당깁니다.',description:'병이 깨진 자리에 피해를 주는 빛의 장판이 남습니다.'},
  vine:{name:'덩굴 채찍',tag:'부채꼴 · 밀쳐내기',color:'#eaa6af',max:8,damage:24,cooldown:1.2,recipe:'bark',evo:'장미 폭풍',evoText:'전방위 덩굴 뒤 장미 폭발이 이어집니다.',description:'바라보는 방향으로 넓게 휘둘러 적을 밀어냅니다.'},
  bloom:{name:'민들레 파동',tag:'파동 · 광역',color:'#e7dcad',max:8,damage:22,cooldown:1.65,recipe:'swift',evo:'만개한 봄',evoText:'겹겹의 꽃 파동과 날아가는 홀씨가 사방으로 퍼집니다.',description:'몸을 중심으로 적을 밀쳐내는 꽃 파동을 만듭니다.'},
  returning:{name:'왕복 산탄',tag:'합체 · 왕복 관통',color:'#f2d39d',max:1,damage:66,cooldown:.7,union:true,icon:'moon',evo:'왕복 산탄',evoText:'관통 산탄이 넓게 퍼졌다 돌아오며 앞뒤를 함께 공격합니다.',description:'도토리와 부메랑을 합친 왕복 관통 산탄.'},
  hive:{name:'보호 추적 벌떼',tag:'합체 · 궤도 추적',color:'#dce2a4',max:1,damage:65,cooldown:.95,union:true,icon:'bees',evo:'보호 추적 벌떼',evoText:'보호 궤도에서 벌떼가 출격하고 돌아와 주변을 지킵니다.',description:'진화 가시와 꿀벌을 합친 보호·추적 군체.'}
};
export const BASE_WEAPON_IDS=Object.keys(WEAPONS).filter(id=>!WEAPONS[id].union);
export const UNIONS={
  returning:{id:'returning',name:'왕복 산탄',inputs:[{id:'acorn',rank:8,evolved:false},{id:'moon',rank:8,evolved:false}],description:WEAPONS.returning.evoText},
  hive:{id:'hive',name:'보호 추적 벌떼',inputs:[{id:'briar',rank:8,evolved:true},{id:'bees',rank:8,evolved:false}],description:WEAPONS.hive.evoText}
};
export const PASSIVES={
  berry:{name:'붉은 열매',tag:'공격력',color:'#ec8e8e',max:5,description:'모든 무기의 피해량 +12%'},
  feather:{name:'바람 깃털',tag:'공격 주기',color:'#b8d6eb',max:5,description:'무기의 재사용 시간 −7%'},
  leaf:{name:'넓은 잎',tag:'공격 범위',color:'#a9d28c',max:5,description:'적용되는 공격 범위 +12%'},
  twin:{name:'쌍둥이 씨앗',tag:'공격 수',color:'#e4c787',max:2,description:'적용되는 무기의 공격 수 +1'},
  dew:{name:'이슬 방울',tag:'지속시간',color:'#92d6de',max:5,description:'적용되는 효과 지속시간 +20%'},
  stone:{name:'반짝 돌',tag:'수집 · 경험치',color:'#c9b5ed',max:5,description:'수집 범위 +22 · 경험치 +6%'},
  bark:{name:'단단한 껍질',tag:'방어력',color:'#bcaa8c',max:5,description:'받는 피해 −1'},
  swift:{name:'순풍 부적',tag:'투사체 속도',color:'#a9d5db',max:5,description:'적용되는 탄환·회전·꿀벌 속도 +15%'}
};
export const ENEMIES={
  shroom:{name:'꼬마 버섯',row:0,hp:15,speed:51,damage:7,r:12,xp:2,description:'군단의 전열. 많이 모일수록 무섭지만 광역 공격에 약합니다.'},
  runner:{name:'돌격 버섯',row:0,hp:12,speed:109,damage:9,r:11,xp:3,description:'노란 갓의 빠른 추격자. 탄막 사이로 파고듭니다.'},
  beetle:{name:'돌껍질 딱정벌레',row:1,hp:51,speed:40,damage:13,r:18,xp:5,description:'튼튼한 몸으로 이동 경로를 막습니다. 관통과 광역 공격으로 전열을 열어보세요.'},
  warden:{name:'갑각 파수꾼',row:1,hp:51,speed:40,damage:13,r:18,xp:5,description:'등의 밝은 잎무늬가 표식. 웅크려 전방을 막고 충격파를 준비하니 옆이나 뒤를 노리세요.'},
  spore:{name:'포자 사수',row:2,hp:26,speed:47,damage:8,r:13,xp:4,description:'거리를 유지하며 부채꼴 사격이나 고정 위치 낙하 포자를 예고합니다.'},
  elite:{name:'버섯 지휘관',row:3,hp:480,speed:48,damage:15,r:27,xp:30,description:'군단을 불러내는 정예. 10분 이후 등장한 지휘관은 진화 가능 상자를 남깁니다.'},
  king:{name:'버섯왕 모르가',row:3,hp:104000,speed:43,damage:22,r:46,xp:100,description:'27분에 군단과 함께 등장합니다. 처치하면 추가 보상을 얻으며, 30분 생존이 기본 목표입니다.'}
};
export const UPGRADES={
  might:{name:'튼튼한 도토리',icon:'berry',description:'시작 공격력 +5%',max:5,base:70},
  vitality:{name:'든든한 아침',icon:'heart',description:'시작 체력 +10',max:5,base:55},
  growth:{name:'숲의 지혜',icon:'stone',description:'경험치 획득 +5%',max:5,base:85},
  magnet:{name:'수집 주머니',icon:'lantern',description:'시작 수집 범위 +12',max:5,base:50},
  recovery:{name:'따뜻한 차',icon:'dew',description:'매초 체력 +0.08 회복',max:5,base:70},
  reroll:{name:'다시 고르는 용기',icon:'moon',description:'원정마다 다시 뽑기 +1',max:3,base:100}
};
export const GOALS=[
  {id:'lune',name:'새 길잡이',text:'한 번의 원정에서 2분 생존',reward:'토끼 합류',target:120,value:p=>p.bestTime},
  {id:'bram',name:'단단한 신뢰',text:'누적 500마리 처치',reward:'고슴도치 합류',target:500,value:p=>p.kills},
  {id:'fox',name:'지휘를 끊어라',text:'정예 1마리 처치',reward:'여우 합류',target:1,value:p=>p.elites},
  {id:'otter',name:'빛의 발자취',text:'반딧불 병 4단계 달성',reward:'수달 합류',target:4,value:p=>p.lanternRank},
  {id:'mole',name:'깨어난 숲의 힘',text:'첫 일반 진화 달성',reward:'두더지 합류',target:1,value:p=>p.evolved.length},
  {id:'storm',name:'번개를 다루는 법',text:'번개 꽃 4단계 달성',reward:'번개 꽃 공용화',target:4,value:p=>p.stormRank},
  {id:'dawn',name:'새벽의 귀환로',text:'30분 생존',reward:'밤의 숲 · 어려움 개방',target:1,value:p=>p.wins}
];
export const WAVE_NAMES=['숲의 가장자리','버섯 떼의 행진','돌진하는 노란 갓','갑각 군단','포자의 비','빈틈없는 포위','지휘관의 부름','거센 추격','검게 물든 숲','군단의 총공세','몰려오는 물결','마지막 방어선','거인의 발자국','왕의 전령','새벽을 향해','버섯왕 모르가'];
export const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
