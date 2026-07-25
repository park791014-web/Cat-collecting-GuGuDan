(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  var STAGE_TYPES = { NORMAL: 'normal', TIMED: 'timed', COMBO: 'combo', MID_BOSS: 'midBoss', BOSS: 'boss' };
  var titles = ['첫 번째 발자국','조금 더 멀리','빠른 걸음','뒤집힌 문제','중간 수문장','힘찬 전진','정교한 선택','연속 정답','지역 종합','최종 결전'];
  function buildStage(world, number) {
    var type = number === 3 ? STAGE_TYPES.TIMED : number === 5 ? STAGE_TYPES.MID_BOSS : number === 8 ? STAGE_TYPES.COMBO : number === 10 ? STAGE_TYPES.BOSS : STAGE_TYPES.NORMAL;
    var isBoss = type === STAGE_TYPES.MID_BOSS || type === STAGE_TYPES.BOSS;
    var questionCount = isBoss ? (type === STAGE_TYPES.BOSS ? 12 : 8) : number === 1 ? 5 : number >= 6 ? 10 : 7;
    var boss = type === STAGE_TYPES.MID_BOSS ? world.midBoss : type === STAGE_TYPES.BOSS ? world.finalBoss : null;
    return { id: 'stage_' + String(world.order).padStart(2,'0') + '_' + String(number).padStart(2,'0'), worldId: world.id,
      chapter: world.order, stageNumber: number, displayNumber: world.order + '-' + number, title: titles[number - 1], type: type,
      rules: { tables: world.multiplicationTables.slice(), questionCount: questionCount, answerOptionCount: isBoss ? (type === STAGE_TYPES.BOSS ? 8 : 6) : number >= 7 ? 6 : 4,
        timeLimitSeconds: type === STAGE_TYPES.TIMED ? 35 : null, lives: 3, reverseQuestionRate: number >= 4 ? .35 : 0, targetCombo: type === STAGE_TYPES.COMBO ? 6 : null },
      clearCondition: { minimumCorrect: type === STAGE_TYPES.COMBO ? 6 : isBoss ? questionCount : Math.ceil(questionCount * .7), minimumAccuracy: 70 },
      boss: boss ? { id: boss.id, name: boss.name, image: boss.image, bossType: type === STAGE_TYPES.MID_BOSS ? 'midBoss' : 'finalBoss', maximumHp: questionCount, damagePerCorrectAnswer: 1 } : null,
      starConditions: [{ star: 1, type: 'clear' }, { star: 2, type: type === STAGE_TYPES.TIMED ? 'timeRemaining' : isBoss || type === STAGE_TYPES.COMBO ? 'remainingLives' : 'accuracy', value: type === STAGE_TYPES.TIMED ? 20 : isBoss || type === STAGE_TYPES.COMBO ? 2 : 80 }, { star: 3, type: 'noWrong' }] };
  }
  var enabledWorlds = (global.GugudanV2.worlds || []).filter(function (world) { return world.enabled; });
  global.GugudanV2.STAGE_TYPES = STAGE_TYPES;
  global.GugudanV2.stages = enabledWorlds.reduce(function (all, world) { for (var number = 1; number <= 10; number += 1) all.push(buildStage(world, number)); return all; }, []);
})(window);
