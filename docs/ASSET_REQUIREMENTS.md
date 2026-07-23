# 수동 에셋 요구사항

현재 에셋이 없어도 CSS 고양이 플레이스홀더와 무음 실패 처리로 게임은 계속 실행됩니다.

## 고양이 이미지

- `assets/cats/base/`에 기본 고양이 WebP 이미지 20개
- 파일명은 `base_normal_01.webp`부터 각 고양이 ID와 동일하게 지정
- 권장 크기: 정사각형 512×512 이상, 투명 배경

## 정답 사운드

- `assets/sounds/correct/meow_01.mp3`
- `assets/sounds/correct/meow_02.mp3`
- `assets/sounds/correct/meow_03.mp3`

## 오답 사운드

- `assets/sounds/wrong/angry_meow_01.mp3`
- `assets/sounds/wrong/angry_meow_02.mp3`

## 영웅·전설 및 보상 사운드

- 영웅 10콤보 고양이 소리
- 전설 보스 포효 소리
- 카드 획득 소리
- 향후 `soundConfig.js`의 `skills`, `boss`, `reward` 목록에 등록

음원 파일을 추가한 뒤 해당 항목의 `enabled`를 `true`로 변경해야 합니다.
