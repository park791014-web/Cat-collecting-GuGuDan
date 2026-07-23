(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  function world(order, title, subtitle, theme, enabled, tables, midBoss, finalBoss) {
    var id = 'world_' + String(order).padStart(2, '0');
    var backgroundNames = {
      1: 'world_01_grassland.svg',
      2: 'world_02_harbor.svg',
      3: 'world_03_toy_forest.svg',
      4: 'world_04_volcano.svg',
      5: 'world_05_ice.svg',
      6: 'world_06_machine.svg',
      7: 'world_07_space.svg',
      8: 'world_08_castle.svg'
    };
    var background = enabled ? 'assets/adventure/worlds/' + (backgroundNames[order] || 'world_locked.svg') : 'assets/adventure/worlds/world_locked.svg';
    
    var decoNames = [
      'yarn_ball.svg',
      'fish_crate.svg',
      'toy_gear.svg',
      'volcano_stone.svg',
      'ice_crystal.svg',
      'machinery_cog.svg',
      'stardust.svg',
      'demon_horn.svg'
    ];
    var decoration = enabled ? 'assets/adventure/decorations/' + (decoNames[order - 1] || 'stage_lock.svg') : 'assets/adventure/decorations/stage_lock.svg';

    return { id: id, order: order, title: title, subtitle: subtitle, theme: theme, enabled: enabled,
      artwork: { background: background, thumbnail: background },
      multiplicationTables: tables, stageIds: enabled ? Array.from({ length: 10 }, function (_, index) { return 'stage_' + String(order).padStart(2, '0') + '_' + String(index + 1).padStart(2, '0'); }) : [],
      decoration: decoration,
      midBoss: midBoss ? { id:id + '_mid_boss', name: midBoss, image:'assets/adventure/bosses/' + id + '_mid_boss.svg' } : null,
      finalBoss: finalBoss ? { id:id + '_final_boss', name: finalBoss, image:'assets/adventure/bosses/' + id + '_final_boss.svg' } : null };
  }
  global.GugudanV2.worlds = [
    world(1, '고양이 초원', '2단과 3단을 정복하세요.', 'grassland', true, [2, 3], '장난꾸러기 두더지', '거대 털실 뭉치'),
    world(2, '생선 항구', '4단과 5단을 정복하세요.', 'harbor', true, [4, 5], '집게발 경비대', '황금 참치'),
    world(3, '장난감 숲', '6단과 7단을 정복하세요.', 'toyforest', true, [6, 7], '태엽 병정', '태엽 장난감 왕'),
    world(4, '냥코 화산', '8단을 마스터해 보세요.', 'volcano', true, [8], '불씨 도마뱀', '마그마 사자'),
    world(5, '얼음 왕국', '9단을 정복해 보세요.', 'ice', true, [9], '서리 펭귄 대장', '빙하 여왕'),
    world(6, '기계 도시', '종합 문제를 연습하세요.', 'machine', true, [2, 3, 4, 5, 6, 7, 8, 9], '톱니 경비 로봇', '메가 계산 로봇'),
    world(7, '별빛 우주', '속도와 정확도를 테스트하세요.', 'space', true, [2, 3, 4, 5, 6, 7, 8, 9], '운석 문어', '은하 고래'),
    world(8, '마왕의 성', '최종 도전을 완료하세요.', 'castle', true, [2, 3, 4, 5, 6, 7, 8, 9], '그림자 기사', '구구단 마왕')
  ];
})(window);
