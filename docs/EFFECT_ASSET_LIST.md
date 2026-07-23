# 정답 이펙트 자산

- `assets/effects/cat-face.svg`
- `assets/effects/cat-paw.svg`
- `assets/effects/star.svg`
- `assets/effects/fish.svg`
- `assets/effects/sparkle.svg`

모두 배경과 텍스트가 없는 프로젝트 내부 오리지널 SVG다. 장식 이미지는 빈 alt, `aria-hidden`, `pointer-events:none`을 사용한다. 로딩 실패 시 요소를 제거한다. 화면 폭별 7~14개, 콤보 시 최대 4개를 추가하되 동시 20개 이하이며 종료 뒤 DOM을 제거한다. 모션 감소 설정에서는 3개와 투명도 중심의 짧은 효과를 사용한다.
