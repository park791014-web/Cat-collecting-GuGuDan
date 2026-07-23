# Firebase 랭킹 인덱스 요구사항

확인 날짜: 2026-07-21

## 코드에서 확인한 실제 컬렉션

- 기존 기본 도전 전체 순위: `users`
- 타임어택 신규 순위: `modeRankings`

`rankings`, `rankings_v2`, `timeAttackRankings`는 현재 코드에서 사용하지 않습니다. 신규 랭킹 컬렉션명은 `js/services/rankingService.js`의 `COLLECTION = 'modeRankings'`에서 확인했습니다.

## 실제 쿼리

### 타임어택 전체 순위

```javascript
db.collection("modeRankings")
  .where("mode", "==", selectedMode)
  .orderBy("score", "desc")
  .limit(100)
```

필요한 복합 인덱스:

| 컬렉션 | 필드 1 | 필드 2 | 사용 모드 |
|---|---|---|---|
| `modeRankings` | `mode` 오름차순 | `score` 내림차순 | `timeAttack` |

Phase 3에서는 타임어택 기록에만 이 인덱스를 사용합니다. 과거 인덱스와 문서는 삭제하지 않습니다.

### 타임어택 주간 순위

```javascript
db.collection("modeRankings")
  .where("mode", "==", selectedMode)
  .where("weekKey", "==", currentWeekKey)
  .orderBy("score", "desc")
  .limit(100)
```

필요한 복합 인덱스:

| 컬렉션 | 필드 1 | 필드 2 | 필드 3 | 사용 모드 |
|---|---|---|---|---|
| `modeRankings` | `mode` 오름차순 | `weekKey` 오름차순 | `score` 내림차순 | `timeAttack` |

## weekKey 정의

`weekKey`는 한국 시간 기준 해당 주 월요일 날짜를 `YYYY-MM-DD`로 저장합니다. 예를 들어 2026년 7월 20일 월요일부터 7월 26일 일요일까지는 `2026-07-20`입니다.

기존 `modeRankings` 문서에 `weekKey`가 없다면 새 주간 쿼리에 포함되지 않습니다. 기존 문서를 자동 변경하지 않으며, 신규 제출 기록에는 `rankingService.submitScore()`가 `weekKey`를 반드시 추가합니다.

## 신규 문서 필수 필드

신규 제출 코드가 다음 필드를 명시적으로 저장합니다.

- `mode`: 현재 순위에 저장하는 `classic` 또는 `timeAttack` (`adventure`는 로컬 진행 전용이며, 기존 `endless` 문서는 삭제하지 않고 현재 조회에서 제외)
- `score`: 숫자
- `weekKey`: 한국 시간 주간 키
- `playedAt`: ISO 날짜 문자열
- `playedAtTimestamp`: Firebase `serverTimestamp()`
- `playerId`: 로컬 익명 식별자
- `nickname`: 현재 로그인 닉네임

추가로 세션 ID, 정오답 수, 정확도, 최고 콤보, 난이도, 앱 버전 등을 저장합니다.

## 오류 확인

랭킹 쿼리 실패 시 콘솔에 다음 로그가 출력됩니다.

```text
[Ranking query error] <Firebase 오류 전체>
[Firebase index creation URL] <Firebase 콘솔 인덱스 생성 링크>
```

두 번째 로그는 `error.code === "failed-precondition"`이고 오류 메시지에서 Firebase 인덱스 생성 URL을 찾았을 때만 출력됩니다. 앱은 오류 후에도 계속 실행되며 화면에는 재시도 버튼이 표시됩니다.

## 보안 규칙 확인

기존 Firebase 설정값과 규칙은 수정하지 않았습니다. Firebase 콘솔에서 로그인 사용자가 `modeRankings/{sessionId}`를 생성하고 읽을 수 있는지 별도로 확인해야 합니다. 인덱스가 있어도 규칙에서 거부하면 순위 저장·조회는 실패합니다.
