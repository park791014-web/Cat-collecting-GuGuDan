(function (global) {
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  v2.dailyMissionConfig = {
    daily_correct_20: { title: '구구단 문제 20개 맞히기', type: 'correct', family: 'correct', target: 20, reward: { coins: 200 } },
    daily_correct_50: { title: '구구단 문제 50개 맞히기', type: 'correct', family: 'correct', target: 50, reward: { normalTickets: 1 } },
    daily_correct_100: { title: '구구단 문제 100개 맞히기', type: 'correct', family: 'correct', target: 100, reward: { premiumTickets: 1 } },
    daily_classic_1: { title: '기본 게임 1회 완료하기', type: 'classicRuns', family: 'classic', target: 1, reward: { normalTickets: 1 } },
    daily_timeattack_1: { title: '타임어택 1회 완료하기', type: 'timeAttackRuns', family: 'timeattack', target: 1, reward: { normalTickets: 1 } },
    daily_classic_2: { title: '기본 게임 2회 완료하기', type: 'classicRuns', family: 'classic', target: 2, reward: { premiumTickets: 1 } },
    daily_timeattack_2: { title: '타임어택 2회 완료하기', type: 'timeAttackRuns', family: 'timeattack', target: 2, reward: { premiumTickets: 1 } },
    daily_adventure_3: { title: '모험 스테이지 3회 클리어하기', type: 'adventureClears', family: 'adventure', target: 3, reward: { normalTickets: 1 } },
    daily_adventure_5: { title: '모험 스테이지 5회 클리어하기', type: 'adventureClears', family: 'adventure', target: 5, reward: { premiumTickets: 1 } },
    daily_boss_3: { title: '모험 보스 3회 클리어하기', type: 'bossClears', family: 'boss', target: 3, reward: { premiumTickets: 1 } },
    daily_classic_perfect_1: { title: '기본 게임 퍼펙트 1회 달성하기', type: 'classicPerfect', family: 'classic', target: 1, reward: { premiumTickets: 1 } },
    daily_combo_25: { title: '타임어택에서 25콤보 달성하기', type: 'timeAttackCombo', family: 'timeattack', target: 1, minimumCombo: 25, reward: { premiumTickets: 1 } }
  };
})(window);
