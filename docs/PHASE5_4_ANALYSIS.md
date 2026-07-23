# Phase 5.4 사전 분석

## 확인 결과

- 관리자 정렬: 사용자 ID와 지급 버튼이 하나의 flex 행에 섞여 ID 길이에 따라 위치가 달라졌다. 재화별 고정 Grid 행이 없었다.
- 재화 저장: `coins`, `normalTickets`, `premiumTickets`, `seasonTickets.season_01`가 존재한다. 원격 지급은 Firestore `pendingResources`를 로그인 때 계정별 로컬 저장소로 수령한다.
- 기존 확률: 직전 버전은 세 뽑기 모두 45/38/14/3이었다. Phase 5.4에서는 코인·기본 60/30/9/1, 고급·시즌 45/35/17/3이다.
- 저장 흐름: 뽑기 서비스가 재화 차감·소유권/중복·조각을 한 저장 객체에 반영한 뒤 한 번 저장한다. 연출 전에 `pendingDrawReveal`을 추가 저장해 새로고침 시 결과만 복구한다.
- 후보: 기본 뽑기는 `baseCats`에서 base, available, obtainable 조건으로 제한한다. 시즌 후보는 별도 배열이다.
- 카드 데이터: 소유권은 ID 기준이며 이름은 정적 데이터의 `displayName`을 사용한다. 중복은 `duplicateCounts[catId]`, 조각은 등급별 `catFragments`이다.
- 효과 차이 원인: 기본·모드 엔진·모험 엔진이 서로 다른 버튼 클래스와 피드백 함수를 사용했다. 공통 `game-answer-button`과 `GameFeedback` 진입점을 추가했다.
- 1-10 정확한 원인: `renderHud()`가 `#boss-hp.textContent`를 설정해 자식 `#boss-hp-bar`를 삭제한 뒤 삭제된 노드의 `style.width`에 접근했다. 첫 답 처리 중 예외가 다음 문제 타이머 등록 전에 발생했다.
- 마이그레이션: ID 변경이나 초기화는 없다. 설명·연출 스킬은 정적 데이터 기본값이며 별은 기존 중복 횟수에서 계산한다. `pendingDrawReveal`만 선택적 저장 필드다.

## 수정 파일

설정, 고양이 데이터, 모험 엔진, 관리자 화면, 도감 상세, Phase 5.4 UI 컨트롤러, CSS, 로컬 SVG 및 검증 문서.
