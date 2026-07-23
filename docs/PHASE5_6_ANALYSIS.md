# Phase 5.6 분석

- 30개 스테이지에는 모두 `storyIntro`가 병합되어 있었다. `seenStageIntros` 및 클리어 여부를 검사해 재생을 생략하던 조건이 실제 원인이었다.
- 결과 화면은 다시 도전/스테이지 목록 두 버튼만 하드코딩되어 다음 스테이지 진입 경로가 없었다.
- 정답 파티클은 화면 일부 범위와 낮은 고정 개수를 사용했고 오답은 공통 파티클 호출이 없었다. 고양이 테마 값은 DOM 속성에만 기록되어 실제 색과 소리에 충분히 연결되지 않았다.
- 관리자 화면의 폭 제한은 자식 화면이 아니라 상위 `#game-container`에서 상속되었다.
- 도감의 등급별 그룹 컨트롤러가 가로 트랙을 생성했고, 공통 별 CSS가 도감에도 큰 크기로 적용되었다.
- 뽑기 문은 0.65초에 열리고 결과 카드가 집과 겹치며 나타났다.

수정 파일은 `adventureStoryService.js`, `adventureEngine.js`, `effectService.js`, `phase56Runtime.js`, `phase56SoundService.js`, `phase56.css`, `app.js`, `index.html`이다.
