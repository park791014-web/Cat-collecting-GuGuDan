# Firebase 랭킹 인덱스

실제 컬렉션: `modeRankings`

## 현재 필요한 인덱스

| 조회 | 필드 |
|---|---|
| 타임어택 월간 | `mode ASC`, `monthKey ASC`, `score DESC` |
| 타임어택 전체 | `mode ASC`, `score DESC` |
| 기존 주간 호환 | `mode ASC`, `weekKey ASC`, `score DESC` |

신규 기록에는 `mode`, `monthKey`, `weekKey`, `score`, `playedAt`, `playedAtTimestamp`, `userId`, `playerId`, `nickname`을 저장한다. 인덱스가 없으면 앱은 계속 실행하고 콘솔에 `[Ranking query error]`와 Firebase 생성 URL을 출력한다.

시즌 글로벌 순위는 현재 Firestore에 시즌 점수를 제출하는 데이터 계약이 없어 가짜 기록을 만들지 않았다. 도입 시 `seasonId ASC, monthKey ASC, score DESC`와 `seasonId ASC, score DESC` 인덱스가 필요하다.
