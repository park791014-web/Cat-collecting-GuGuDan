# Phase 5.6.1 분석

- 뽑기 등급 배지는 공통 `.rarity-badge`의 `position:absolute`를 상속해 결과 카드 오른쪽 위에 붙었다.
- 결과 공개 타이머는 문 애니메이션과 독립적인 2.4초 고정값이어서 문이 열린 직후 고양이가 나타났다.
- 스킵 버튼은 `phase54Controller`가 동적으로 생성하고 `reveal()`을 직접 연결했다.
- 도감은 Phase 5.6에서 4열 Grid와 설명 2줄을 강제하여 이미지와 카드가 다시 커졌다. 공통 별 이미지 CSS도 도감 별에 영향을 주었다.
- 가로 overflow 원인은 작은 화면에서도 4열을 고정한 Grid와 카드 내부 요소의 최소 너비였다.
- 미션 제목은 조건 문장을 제목에 모두 넣어 길어졌다.

수정 파일: `phase54Controller.js`, `phase56Runtime.js`, `phase561Runtime.js`, `phase561.css`, `index.html`.
