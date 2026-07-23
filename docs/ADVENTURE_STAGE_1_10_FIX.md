# 모험 1-10 수정

## 원인

보스 HUD 갱신이 HP 컨테이너의 `textContent`를 덮어 자식 막대 노드를 삭제했다. 이어지는 null `style.width` 접근 예외가 답 처리 흐름을 중단했다.

## 수정

- HP 텍스트는 `boss-hp-text`, 너비는 존재 확인한 `boss-hp-bar`에만 쓴다.
- 상태를 `stageIntro`, `questionActive`, `answerFeedback`으로 기록한다.
- HUD·효과 오류는 핵심 전환과 분리한다.
- 700ms 정상 전환과 1800ms 안전 전환을 둔다.
- `printAdventureState`, `startAdventureStage`, `simulateAdventureAnswer`, 설정·전환 검증 함수를 제공한다.
- 최종 보스는 문제 수 12, HP 12이며 정답마다 HP 1 감소, HP 0 또는 문제/목숨 종료 조건에서만 결과로 이동한다.
