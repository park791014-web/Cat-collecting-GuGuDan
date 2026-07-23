# 모험 스토리 설정

실제 월드는 `js/data/worlds.js`, 스테이지는 `js/data/stages.js`에 있다. 스토리는 `js/data/adventureStoryData.js`에서 기존 `world_01` 및 `stage_01_01` 형식 ID에 병합한다. 새 월드/스테이지 배열을 만들지 않으며 rules, type, 보스 HP, 보상을 덮어쓰지 않는다.

- 프롤로그 1개
- 월드 인트로 3개
- 스테이지 인트로 30개
- 중간/최종 보스 인트로 6개
- 최종 보스 클리어 스토리 3개

누락된 ID는 `[Adventure Story] ... mapping missing` 경고를 남긴다.
