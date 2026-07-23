(function (global) {
  'use strict';

  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.APP_VERSION = '2.0.0';
  global.GugudanV2.CONTENT_VERSION = '2026.07.22';
  global.GugudanV2.gameConfig = Object.freeze({
    version: '2.0.0',
    multiplication: {
      minimumDan: 2,
      maximumDan: 15,
      enabledDans: [2, 3, 4, 5, 6, 7, 8, 9],
      allowReverseQuestions: false,
      preventImmediateDuplicates: true,
      recentQuestionMemory: 1
    },
    answerOptions: { defaultCount: 4, bossCount: 8, sortAscending: true },
    scoring: {
      correctPoints: 10,
      speedBonusEnabled: true,
      playCountBonusEnabled: true,
      wrongPenalty: 0,
      pointsPerLevel: 150
    },
    classic: { totalQuestions: 20, secondsPerQuestion: 5, bossStartsAt: 19, trapStartsAt: 16 },
    modes: {
      classic: { enabled: true, title: '기본 도전' },
      timeAttack: { enabled: true, title: '타임어택', defaultSeconds: 60, warningSeconds: 10, correctPoints: 10, wrongPenaltyPoints: 0, wrongPenaltySeconds: 0, comboBonusEnabled: true },
      adventure: { enabled: true, title: '구구단 대모험' }
    },
    ranking: { allTimeEnabled: true, weeklyEnabled: false, limit: 5 },
    audio: { enabled: true, bgmVolume: 0.5, effectVolume: 0.8, catVoiceEnabled: true }
  });
})(window);
