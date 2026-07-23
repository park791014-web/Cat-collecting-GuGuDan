# Phase 4 사전 분석

확인 날짜: 2026-07-22

## 재사용할 기존 코드

- 기본 고양이 20종: `js/data/cats.js`
- 도감과 대표 고양이 필드: `js/app.js`, `profile.selectedCatId`
- 로컬 저장과 마이그레이션: `js/services/storageService.js`
- 모험 최초 기록·별 갱신·해제: `adventureService.completeStage()`
- 모험 결과 화면: `adventureEngine.showResult()`
- 정답 처리: 기본 `checkAnswer()`, 타임어택·모험의 `submitAnswer()`
- 순위 제출: `rankingService.submitScore()`
- 사운드·이미지 fallback 및 Phase 3 카드 CSS

## 수정·추가 구조

확률·보상·스킬 정책은 각각 `cardPackConfig`, `rewardConfig`, `skillConfig`에 분리합니다. 계산과 실제 저장은 `rewardService`, 카드 추첨·획득은 `cardPackService`, 모드별 스킬 판정은 `skillEngine`이 담당합니다. 화면은 기존 카드 DOM과 공통 플레이 화면을 재사용합니다.

## 카드 획득 데이터

스키마 5에서 `currency`, `collection.catFragments`, `collection.catProgress`, `rewardHistory`를 추가합니다. `ownedCatIds`는 중복 제거하며 기본 고양이 이외의 legacy ID는 신규 카드팩 후보나 장착 대상으로 사용하지 않습니다.

## 보상 중복 방지

모험 세션마다 `sessionId`를 만들고 최근 100개의 지급 ID를 저장합니다. 최초 클리어는 `firstClearStageIds`, 별 보상은 스테이지별 최고 지급 별을 별도로 기록합니다. 계산 후 한 번의 저장으로 재화와 이력을 함께 반영합니다.

## 스킬 실행 구조

선택 고양이와 모드로 세션을 초기화하고 공통 trigger를 전달합니다. 소비형 스킬은 세션의 `consumed`, 번개는 `triggeredCombos`로 중복 실행을 막습니다. 화면 코드는 고양이 ID별 분기 대신 스킬 ID·타입과 공통 반환 효과를 사용합니다.

## 타임어택 공정성

공식 타임어택은 `isRankedRun: true`, 정책은 `cosmetic_only`입니다. 번개의 시각·소리만 허용하며 시간 증가, 오답 방어, 보기 제거, 부활, 점수 변경은 활성화 검사에서 차단합니다. Firebase 점수 계산과 제출 경로는 변경하지 않습니다.

## 마이그레이션과 위험 요소

스키마 1~4의 프로필, 기록, 모험 진행, 별, 획득 고양이, 설정, legacy 무제한 기록을 병합한 뒤 새 필드만 기본값으로 채웁니다. 손상된 재화·조각 값은 0 이상 정수로 정규화합니다. 주요 위험은 결과 중복 호출, 팩 연타, 미보유 대표 고양이, 부활과 종료 경쟁이며 각각 세션 ID, 입력 잠금, 저장 정규화, 종료 전 부활 판정으로 방지합니다.
