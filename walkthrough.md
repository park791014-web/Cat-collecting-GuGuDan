# 모바일·점수·보스전 긴급 오류 수정 패치 완료 보고서

이번 패치에서는 모바일 PWA 환경의 시스템 뒤로가기 동작 제어, 대모험 및 타임어택 스코어 가산 누락 해결, 보스전 재도전 시 발생하는 클릭 락 해소, 그리고 모바일 화면 360x800 최적화 및 보상 획득 이펙트를 추가했습니다.

## 1. 변경된 주요 사항

### 1.1. 시스템 뒤로가기 제어 (`backButtonHandler.js`)
- 브라우저 기본 `confirm` 대신 아름다운 CSS 스타일링이 적용된 **커스텀 다이얼로그 모달**을 동적으로 생성합니다.
- 게임 진행 중 뒤로가기 시 `"진행 중인 게임을 종료하시겠습니까?"` (게임 종료/계속하기)를 띄웁니다.
- 로그인/로비 첫 화면에서는 `"게임을 종료하시겠습니까?"` (종료/취소)를 띄웁니다.
- popstate 연타 및 복구 동작 시 무한 루프를 완벽히 막도록 `restoringState` 및 `confirmOpen` 가드 플래그를 세팅했습니다.

### 1.2. 점수 가산 누락 및 즉시 갱신 연동 (`app.js`, `storageService.js`, `userStorageService.js`)
- 기본 게임 외에 **타임어택**과 **대모험**의 점수/정답 결과가 로컬 스토리지 및 Firebase 랭킹에 합산되지 않던 문제를 `storageService.recordGame()`의 모드 확장 및 `finalizeCompletedGameSession(result)` 공통 연동으로 해결했습니다.
- 게임 세션 종료 시 새로고침 없이 **누적 점수, 레벨, 통계가 즉시 갱신**되도록 `refreshHomeStatsFromCurrentUser()` 및 `refreshLeaderboardSummaryIfVisible()`를 추가 구현해 실시간 연동을 완료했습니다.

### 1.3. 보스전 재도전 클릭 오류 & 피드백 잔상 제거 (`adventureEngine.js`, `adventureStoryService.js`)
- 이미 클리어한 보스전 스테이지에 재도전할 때 스토리 모달 우상단 `X` 버튼(닫기)을 누르면 모험 시작 락인 `isStarting` 플래그가 해제되지 않고 남아 버튼이 먹통이 되던 버그를 `resetStartingLock` API를 추가하여 완전히 해소했습니다.
- 새 스테이지 시작 전 `resetAdventureFeedbackState()`를 호출하여 이전 스테이지의 피드백 문구, 게이지 등을 말끔히 비워줍니다.
- 비동기 콜백 간섭을 원천 방지하기 위해 각 스테이지 세션마다 고유의 `activeStageSessionId`를 발급하고, 이와 다른 늦은 타이머 콜백은 전부 차단하게 하여 안전성을 보장했습니다.

### 1.4. 모바일 360x800 해상도 화면 높이 최적화 (`style.css`)
- 360x800 화면에서 스크롤 없이 문제와 보스전, 답안지 첫 두 줄이 한 화면에 노출되도록 미디어 쿼리를 통하여 보스 아레나 높이(`.boss-arena` min-height를 210px -> 110px)와 보스 이미지 크기를 대폭 축소하였습니다.
- 로비 "도감 열기" 버튼의 줄바꿈 버그를 `white-space: nowrap !important`로 완벽하게 패치했습니다.

### 1.5. 미션 보상 수령 이펙트 (`app.js`, `dailyMissionController.js`)
- 오늘의 미션 보상을 정상적으로 수령 시, 버튼 기준 좌우로 흩날리는 아기자기한 파티클 및 획득 가이드 말풍선인 `playMissionClaimEffect`를 800ms 길이로 수려하게 연출했습니다.
- 연타로 인한 중복 수령 방지 처리가 적용되었습니다.

## 2. 검증 결과
- 모든 수정한 파일은 실제 PWA 배포 경로인 `Cat-collecting-GuGuDan/` 하위 디렉토리에 정확하게 대칭 복사 및 동기화되었습니다.
- PWA `manifest.json` 의 scope 및 start_url 경로는 `/Cat-collecting-GuGuDan/` 으로 안전하게 유지됩니다.
