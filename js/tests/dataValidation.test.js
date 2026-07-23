(function (global) {
  'use strict';
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function runPhase1Validation() {
    var v2 = global.GugudanV2, result = v2.validators.validateAll(), cats = v2.baseCats;
    assert(result.valid, result.errors.join('\n'));
    assert(cats.length === 20, '기본 고양이는 20마리여야 합니다.');
    assert(result.counts.normal === 8, '일반 고양이는 8마리여야 합니다.');
    assert(result.counts.rare === 6, '희귀 고양이는 6마리여야 합니다.');
    assert(result.counts.hero === 4, '영웅 고양이는 4마리여야 합니다.');
    assert(result.counts.legendary === 2, '전설 고양이는 2마리여야 합니다.');
    assert(cats.filter(function (cat) { return cat.rarity === 'normal' || cat.rarity === 'rare'; }).every(function (cat) { return cat.skill === null; }), '일반/희귀 고양이에는 스킬이 없어야 합니다.');
    assert(cats.filter(function (cat) { return cat.rarity === 'hero' || cat.rarity === 'legendary'; }).every(function (cat) { return cat.skill && cat.skill.id; }), '영웅/전설 고양이에는 스킬이 하나 있어야 합니다.');
    var four = v2.questionGenerator.createOptions(42, 4, false), eight = v2.questionGenerator.createOptions(42, 8, true);
    assert(four.length === 4 && new Set(four).size === 4 && four.indexOf(42) >= 0, '4지선다 생성 실패');
    assert(eight.length === 8 && new Set(eight).size === 8 && eight.indexOf(42) >= 0, '8지선다 생성 실패');
    assert(four.every(function (value, index) { return index === 0 || four[index - 1] < value; }), '보기 오름차순 정렬 실패');
    var migrated = v2.storageService.migrateSaveData({ username: '냥이', totalPoints: 321, bestCombo: 7, rewards: [{ id: 'Cat_1', rank: 'N' }] });
    assert(migrated.schemaVersion === 7 && migrated.profile.nickname === '냥이' && migrated.progress.totalScore === 321 && migrated.collection.legacyRewards.length === 1, '기존 저장 데이터 마이그레이션 실패');
    v2.gameState.startGame('classic'); v2.gameState.recordCorrectAnswer(12); v2.gameState.recordWrongAnswer(); v2.gameState.finishGame();
    assert(v2.gameState.state.correctCount === 1 && v2.gameState.state.wrongCount === 1 && v2.gameState.state.status === 'finished', '게임 상태 전이 실패');
    return { passed: true, catCounts: result.counts, fourOptions: four, eightOptions: eight, migratedSchemaVersion: migrated.schemaVersion };
  }
  global.runPhase1Validation = runPhase1Validation;
})(window);
