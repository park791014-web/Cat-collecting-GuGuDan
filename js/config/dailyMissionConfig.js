(function (global) {
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  v2.dailyMissionConfig = {
    daily_correct_20: { title: '구구단 문제 20개 맞히기', type: 'correct', target: 20, reward: { coins: 40 } },
    daily_correct_40: { title: '구구단 문제 40개 맞히기', type: 'correct', target: 40, reward: { coins: 70, normalTickets: 1 } },
    daily_classic_2: { title: '기본 게임 2회 완료하기', type: 'classicRuns', target: 2, reward: { coins: 60 } },
    daily_timeattack_2: { title: '타임어택 2회 완료하기', type: 'timeAttackRuns', target: 2, reward: { coins: 60, normalTickets: 1 } },
    daily_adventure_3: { title: '모험 스테이지 3회 클리어하기', type: 'adventureClears', target: 3, reward: { coins: 70, normalTickets: 1 } },
    daily_boss_1: { title: '모험 보스 1회 클리어하기', type: 'bossClears', target: 1, reward: { coins: 100, premiumTickets: 1 } },
    daily_perfect_1: { title: '10문제 이상 게임에서 퍼펙트 1회', type: 'perfectRuns', target: 1, minimumQuestions: 10, reward: { coins: 80, normalTickets: 1 } },
    daily_combo_10: { title: '10콤보 달성하기', type: 'bestCombo', target: 10, reward: { coins: 60 } }
  };
})(window);
