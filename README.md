<h1 align="center">★ 서바이버 작전실</h1>
<p align="center"><strong>OPERATION BREAKWATER · 교두보 탈환</strong><br>마르코의 집중 사격, 피오의 강화 탄창.<br>전장에서 무기를 완성하고, 확보한 성과로 다음 출격을 준비하는 팬 시제품.</p>
<p align="center">
<a href="https://github.com/yu-reka/woodland-survivors/actions/workflows/pages.yml"><img alt="검사와 Pages 배포" src="https://github.com/yu-reka/woodland-survivors/actions/workflows/pages.yml/badge.svg?branch=main"></a>
<img alt="0.12 작전 시제품" src="https://img.shields.io/badge/version-0.12-d5b77b?style=flat-square">
<img alt="Canvas와 JavaScript" src="https://img.shields.io/badge/HTML_Canvas-JavaScript-6d8b63?style=flat-square">
<img alt="런타임 의존성 없음" src="https://img.shields.io/badge/runtime_dependencies-0-779b87?style=flat-square">
</p>
<p align="center"><a href="https://yu-reka.github.io/woodland-survivors/"><strong>▶ 작전실에서 출격</strong></a> · <a href="docs/METAL-SLUG-SURVIVORS-CONCEPT.md">게임 기획</a> · <a href="docs/META-PROGRESSION-ECONOMY.md">기지와 경제</a> · <a href="docs/VALIDATION-V012.md">구현·검증 기록</a></p>

![기지에서 대원과 작전을 준비하는 화면](docs/images/v012-lobby.png)

### 준비 → 전투 → 정산 → 연구 → 재출격

**무엇을 위해 싸우나요?** 포로와 시험 병기를 탈환하고 지휘전차를 파괴합니다. 구출·거점·처치·보스 부위 파괴가 보급 크레딧과 기록으로 돌아옵니다. 전투를 중단하거나 쓰러져도 확보한 성과를 정산합니다.

| 기지에서 | 전장에서 | 귀환한 뒤 |
| :-- | :-- | :-- |
| 마르코 / 피오와 교범 선택 | 포로 경비 제압 → 총기 보급 | 수당·첫 보고·첫 완주 정산 |
| 상한 있는 기초 훈련 | XP로 무기 3단계 → 핵심으로 진화 | 조건 달성한 개조 연구 |
| 성과로 새 개조 해금 | H + R 최종 합체 / 선택 Slug 노획 | 연구 개조를 새 판에서 선택 |
| 다음 목표·최고 기록 확인 | 준비되면 직접 지휘전차에 도전 | 다른 대원·교범·과밀 도전 |

시간이 지나면 자동 실패하는 규칙은 없습니다. 진화 핵심은 수용소·수송대·후방 포로에서 얻습니다. 빈 지원 슬롯의 보급은 두 종류 총을 함께 제시하므로 합체 재료를 직접 선택할 수 있습니다.

### 두 대원, 다른 성장

| | 마르코 | 피오 |
| :-- | :-- | :-- |
| 시작 무장 | 권총 P | 기관총 H |
| 고유 성장 | 같은 표적 연속 적중 → 집중 3단계 | 사격·처치·보급 → 강화 탄창 충전 |
| 전술기 E | 관통 집중 사격 | 두 무기 강화 사격 |
| 주력 완성 예 | P 3단계 → 장갑 관통 권총 | H·R 3단계 + 핵심 → 미사일 호위 기관포 |
| 재도전 해금 | P 진화로 완주 → 산개 교범 | 강화 중 누적 300처치 → 신속 교범 |

P·H·R 모두 진화할 수 있습니다. 연구는 P 관통 분열·H 도탄·R 점화 탄두 후보를 영구 해금합니다. 새로 연구한 개조는 해당 총을 1단계 이상 강화하면 첫 적합한 성장 후보에 등장합니다. 매판 총기와 XP는 다시 성장시키며, 완성 무기를 기지에서 구매하지 않습니다.

전장은 보병·방패병·박격포병·증원 장교로 구성했습니다. 지휘전차는 포격·확산 사격·돌진 뒤 회복 빈틈을 드러내고, 부위 파괴에 따라 약해집니다. 진화·합체에는 주변 폭발, 관통·다탄두·유도탄, 적 경직과 짧은 타격 정지를 적용했습니다.

### 조작

| 행동 | 키보드 | 모바일 |
| :-- | :-- | :-- |
| 이동 | WASD · 방향키 | 왼쪽 스틱 |
| 회피 | Space | 오른쪽 작은 버튼 |
| 대원 전술기 / Slug 주포 | E | 오른쪽 큰 버튼 |
| 탑승·하차·보스 진입 | F | 상황 버튼 |
| 목표 선택 | M | 미니맵 아래 버튼 |
| 성장 선택 | 1 · 2 · 3 / 클릭 | 카드 터치 |
| 일시정지 | Esc | 상단 Ⅱ |

공격은 자동입니다. 성장 선택·지도·일시정지는 전투를 멈춥니다. 5초마다 진행을 저장하고 선택·일시정지에서도 저장합니다. 기지에 저장된 작전을 이어가거나 확보 성과를 정산할 수 있습니다. 저장 공간 오류가 나면 구매·정산을 확정하지 않고 재시도 화면을 표시합니다. 브라우저·사이트별 로컬 저장이며 기기 간 동기화는 없습니다.

### 현재 범위와 확인할 것

0.12는 **두 대원과 첫 작전의 전체 순환을 구현한 개발 버전**입니다. 다음 지역·에리·타마는 아직 구현하지 않았습니다. 이상적인 입력 주행은 약 75~124초에 완주해 기획의 4~6분 분량에는 미달합니다. 기록과 과밀 도전은 동작하지만 장기 반복의 다양성과 실제 플레이 재미는 계속 검증해야 합니다. 390px·320px 화면과 단일 포인터 스틱을 확인했고, 실기기 두 손 동시 조작은 추가 확인 대상입니다.

### 로컬 실행

Node.js 20 이상. 외부 런타임 패키지 없이 실행합니다.

```sh
git clone https://github.com/yu-reka/woodland-survivors.git
cd woodland-survivors
npm run dev
```

**http://127.0.0.1:5200/**

| 명령 | 용도 |
| :-- | :-- |
| `npm test` | 기존 게임 + 작전 규칙 190개 검사 |
| `npm run test:mission` | 작전·경제·저장·진화 검사 24개 |
| `node scripts/mission-pilot.mjs --summary` | 초기 계정 8회 입력 주행 |
| `npm run build` | 정적 배포 파일 생성 |
| `npm run test:pages` | 저장소 하위 경로·자산·모듈 버전 검사 |
| `npm run preview` | `http://127.0.0.1:5201/woodland-survivors/` |

`src/mission/`가 새 모델·화면·렌더·저장을 소유합니다. 기존 원정의 전투 모델을 가져오지 않고 오디오·터치 입력만 재사용합니다. `main` 푸시 시 [GitHub Actions](.github/workflows/pages.yml)가 검사 → 빌드 → Pages 검사 → 배포를 실행합니다. `dist/`는 커밋하지 않습니다. 포크 배포는 **Settings → Pages → Source → GitHub Actions**입니다.

### 이전 실험

- [다람쥐 2분 전투](https://yu-reka.github.io/woodland-survivors/prototype.html) · [0.11 기록](docs/VALIDATION-V011.md)
- [기존 숲 원정](https://yu-reka.github.io/woodland-survivors/woodland.html) · [원정 기획](docs/GAME-DESIGN.md)

별도 주소에서 기존 원화·게임을 보존했습니다. 저장 키도 분리했습니다.

메탈슬러그 캐릭터·설정에서 착안한 비공식 팬 시제품입니다. 게임에서 추출한 자산·코드는 사용하지 않았습니다. [새 아트 제작 기록](docs/MISSION-ART-V012.md) · [기존 아트 기록](docs/ART-PROVENANCE.md). 코드·아트 재사용 라이선스는 아직 정하지 않았습니다. Galmuri는 동봉된 [SIL OFL 1.1](public/fonts/woodland/LICENSE.txt)을 따릅니다.
