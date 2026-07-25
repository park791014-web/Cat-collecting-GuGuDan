(function (global) {
  'use strict';
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function runPhase3VisualValidation() {
    var v2 = global.GugudanV2;
    var base = v2.baseCats.filter(function (cat) { return cat.collection === 'base' && cat.visible !== false; });
    var counts = base.reduce(function (result, cat) { result[cat.rarity] += 1; return result; }, { normal:0, rare:0, hero:0, legendary:0 });
    assert(base.length === 20, '표시 기본 고양이는 정확히 20마리여야 합니다.');
    assert(counts.normal === 8 && counts.rare === 6 && counts.hero === 4 && counts.legendary === 2, '등급별 고양이 수가 올바르지 않습니다.');
    var enabledWorlds = v2.worlds.filter(function (world) { return world.enabled; });
    assert(enabledWorlds.length === 3, '시각화 대상 월드는 3개여야 합니다.');
    enabledWorlds.forEach(function (world) {
      assert(world.artwork && world.artwork.background && world.artwork.background.indexOf('assets/') === 0, world.id + ' 배경 경로 누락');
      assert(world.midBoss && world.midBoss.image && world.finalBoss && world.finalBoss.image, world.id + ' 보스 이미지 경로 누락');
    });
    v2.stages.filter(function (stage) { return stage.boss; }).forEach(function (stage) { assert(stage.boss.image && stage.boss.bossType, stage.id + ' 보스 이미지 데이터 누락'); });
    return { passed:true, visibleBaseCats:base.length, rarityCounts:counts, illustratedWorlds:enabledWorlds.length, bossImages:enabledWorlds.length * 2 };
  }
  global.runPhase3VisualValidation = runPhase3VisualValidation;
})(window);
