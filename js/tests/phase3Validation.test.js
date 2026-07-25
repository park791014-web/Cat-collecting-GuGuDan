(function (global) {
  'use strict';

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function successfulResult() {
    return {
      score: 100,
      correctCount: 10,
      wrongCount: 0,
      totalQuestions: 10,
      accuracy: 100,
      bestCombo: 10,
      remainingLives: 3,
      remainingSeconds: 30,
      bossHp: 0
    };
  }

  function runPhase3Validation() {
    var v2 = global.GugudanV2;
    var validators = v2.validators;
    var service = v2.adventureService;
    var modes = validators.validateActiveGameModes(v2.gameConfig);
    var worldErrors = validators.validateWorldData(v2.worlds);
    var stageErrors = validators.validateStageData(v2.stages, v2.worlds);

    assert(modes.valid, '활성 모드 구성이 올바르지 않습니다.');
    assert(!worldErrors.length, '월드 데이터 오류: ' + worldErrors);
    assert(!stageErrors.length, '스테이지 데이터 오류: ' + stageErrors);
    assert(v2.worlds.length === 8 && v2.worlds.filter(function (world) { return world.enabled; }).length === 3, '월드 개수가 올바르지 않습니다.');
    assert(v2.stages.length === 30, '스테이지 개수가 올바르지 않습니다.');
    assert(v2.baseCats.filter(function (cat) { return cat.collection === 'base'; }).length === 20, '기본 고양이 수가 올바르지 않습니다.');

    var reset = service.resetForTesting();
    assert(reset.unlockedWorldIds.length === 1 && reset.unlockedStageIds[0] === 'stage_01_01', '초기 잠금 상태가 올바르지 않습니다.');

    var fail = service.completeStage('stage_01_01', {
      score: 10, correctCount: 1, wrongCount: 4, totalQuestions: 5,
      accuracy: 20, bestCombo: 1, remainingLives: 0, remainingSeconds: 0, bossHp: null
    });
    assert(!fail.cleared && fail.progress.unlockedStageIds.indexOf('stage_01_02') < 0, '실패한 스테이지가 다음 스테이지를 열었습니다.');

    var clear = service.completeStage('stage_01_01', {
      score: 50, correctCount: 5, wrongCount: 0, totalQuestions: 5,
      accuracy: 100, bestCombo: 5, remainingLives: 3, remainingSeconds: 0, bossHp: null
    });
    assert(clear.cleared && clear.stars === 3 && clear.progress.unlockedStageIds.indexOf('stage_01_02') >= 0, '클리어·별·다음 스테이지 해제가 올바르지 않습니다.');

    var lower = service.completeStage('stage_01_01', {
      score: 40, correctCount: 4, wrongCount: 1, totalQuestions: 5,
      accuracy: 80, bestCombo: 2, remainingLives: 2, remainingSeconds: 0, bossHp: null
    });
    assert(lower.record.bestStars === 3, '재도전 후 최고 별 개수가 감소했습니다.');

    service.resetForTesting();
    [1, 2].forEach(function (worldNumber) {
      for (var stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
        var stageId = 'stage_' + String(worldNumber).padStart(2, '0') + '_' + String(stageNumber).padStart(2, '0');
        service.completeStage(stageId, successfulResult());
      }
    });
    var worldProgress = service.loadProgress();
    assert(worldProgress.unlockedWorldIds.indexOf('world_02') >= 0, '월드 1 완료 후 월드 2가 열리지 않았습니다.');
    assert(worldProgress.unlockedWorldIds.indexOf('world_03') >= 0, '월드 2 완료 후 월드 3이 열리지 않았습니다.');

    return {
      passed: true,
      activeModes: modes.active,
      worlds: v2.worlds.length,
      stages: v2.stages.length,
      baseCats: 20,
      unlockVerified: true,
      worldUnlockVerified: true
    };
  }

  global.runPhase3Validation = runPhase3Validation;
})(window);
