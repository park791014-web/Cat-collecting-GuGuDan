(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  function world(order, title, subtitle, theme, enabled, tables, midBoss, finalBoss) {
    var id = 'world_' + String(order).padStart(2, '0');
    var backgroundNames = { 1:'world_01_grassland.svg', 2:'world_02_harbor.svg', 3:'world_03_toy_forest.svg' };
    var background = enabled ? 'assets/adventure/worlds/' + backgroundNames[order] : 'assets/adventure/worlds/world_locked.svg';
    return { id: id, order: order, title: title, subtitle: subtitle, theme: theme, enabled: enabled,
      artwork: { background: background, thumbnail: background },
      multiplicationTables: tables, stageIds: enabled ? Array.from({ length: 10 }, function (_, index) { return 'stage_' + String(order).padStart(2, '0') + '_' + String(index + 1).padStart(2, '0'); }) : [],
      decoration: enabled ? ['assets/adventure/decorations/yarn_ball.svg','assets/adventure/decorations/fish_crate.svg','assets/adventure/decorations/toy_gear.svg'][order - 1] : 'assets/adventure/decorations/stage_lock.svg',
      midBoss: midBoss ? { id:id + '_mid_boss', name: midBoss, image:'assets/adventure/bosses/' + id + '_mid_boss.svg' } : null,
      finalBoss: finalBoss ? { id:id + '_final_boss', name: finalBoss, image:'assets/adventure/bosses/' + id + '_final_boss.svg' } : null };
  }
  global.GugudanV2.worlds = [
    world(1, '고양이 초원', '2단과 3단을 정복하세요.', 'grassland', true, [2, 3], '장난꾸러기 두더지', '거대 털실 뭉치'),
    world(2, '생선 항구', '4단과 5단을 정복하세요.', 'harbor', true, [4, 5], '집게발 경비대', '황금 참치'),
    world(3, '장난감 숲', '6단과 7단을 정복하세요.', 'toyforest', true, [6, 7], '태엽 병정', '태엽 장난감 왕'),
    world(4, '냥코 화산', '8단 지역 · 준비 중', 'volcano', false, [8]),
    world(5, '얼음 왕국', '9단 지역 · 준비 중', 'ice', false, [9]),
    world(6, '기계 도시', '종합 지역 · 준비 중', 'machine', false, [2,3,4,5,6,7,8,9]),
    world(7, '별빛 우주', '종합 지역 · 준비 중', 'space', false, [2,3,4,5,6,7,8,9]),
    world(8, '마왕의 성', '최종 종합 · 준비 중', 'castle', false, [2,3,4,5,6,7,8,9])
  ];
})(window);
