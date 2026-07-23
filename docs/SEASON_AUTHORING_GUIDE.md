# 시즌 제작 가이드

1. `js/data/seasons.js`에 고유한 시즌 ID, `startAt`/`endAt`의 `+09:00` 시각, 팩 확률과 고양이 ID를 등록한다.
2. `js/data/seasonCats.js`에 같은 `seasonId`를 쓰는 고양이를 등록한다. 이미지가 없어도 `fallbackImage`는 반드시 지정한다.
3. `js/data/seasonMissions.js`에 고유 ID, 목표값, 보상을 등록한다.
4. 팩 등급 확률의 합은 정확히 1이어야 한다.
5. 콘솔에서 `NyankoDebug.validateSeasonData()`, `validateSeasonCatData()`, `validateSeasonMissionData()`를 실행한다.
6. `NyankoDebug.previewSeason(id)`와 `setSeasonDateForTesting(isoDate)`로 출시 전 화면과 날짜 경계를 확인한다. 미리보기 상태는 새로고침 뒤 유지되지 않는다.

종료 시즌의 고양이는 획득 사용자에게 계속 보이며 장착할 수 있다. 재등장 정책은 시즌 데이터의 `returnPolicy`로 명시하고, 기존 ID를 재사용해 소유권을 보존한다.
