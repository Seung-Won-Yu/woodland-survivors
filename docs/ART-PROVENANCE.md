# 아트 제작 기록

동물 수호대는 프로젝트의 동물 모험가 원화와 야영지 원화를 기준으로 따뜻한 픽셀 일러스트를 제작했습니다. 2026-11-03 내장 ImageGen으로 보행·공격·적·환경 시트를 생성했으며, 런타임에서는 주요 실루엣 분리, 발 피벗 정렬과 방향별 합성을 적용합니다.

## 현재 사용하는 자산

| 파일 · `public/art/v2/` | 용도 |
| :-- | :-- |
| `party-walk-side.png` | 여섯 대원의 측면 보행 8포즈 |
| `party-walk-front-back.png` | 정면·후면 보행 각 4포즈 |
| `party-combat.png` | 측면·정면 공격 준비·발사·복귀·피격 |
| `party-combat-back.png` | 후면 공격·피격 |
| `enemy-motion.png` | 버섯·돌격병·포자 사수·딱정벌레 모션 |
| `forest-atlas.png` | 풀·흙 등의 지면 텍스처 |
| `forest-props.png` | 수목·바위·야영지·보급·둥지·샘 등 |
| `camp-reference.png` | 기존 야영지 원화, 대원 선택 배경 |

파일별 프롬프트, 참조 파일과 SHA-256은 [생성 기록](../public/art/v2/generation-record.json)에 있습니다. 모든 경로는 저장소 기준입니다. 원본 PNG는 유지하고 런타임에서 정렬합니다.

## 참고 자료와 이전 버전

- [대원 원화](reference/party-base.png)
- [0.1 전투 아틀라스](reference/combat-atlas.png): 현재 런타임에서는 사용하지 않는 이전 버전 기록
- [원화 생성 프롬프트](REFERENCE-ART-PROMPTS.md)

외부 게임의 코드나 아트를 가져오지 않았습니다. 코드와 게임 아트에 대한 별도 재사용 라이선스는 아직 정하지 않았습니다.

## 폰트와 사운드

- **Galmuri 2.40.3** — Lee Minseo, SIL Open Font License 1.1. [프로젝트](https://github.com/quiple/galmuri) · [동봉 라이선스](../public/fonts/woodland/LICENSE.txt)
- **사운드** — `src/game/audio.js`의 Web Audio 합성. 외부 음원 파일이나 재생 CDN에 의존하지 않습니다.
