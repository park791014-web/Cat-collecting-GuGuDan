(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.scoreManager = {
    calculateLiveScore: function (correct, speed) { return correct * 10 + speed; },
    calculateFinalScore: function (correct, speed, playCount, guest) { return correct * 10 + speed + (guest ? 0 : playCount * 2); },
    calculateComboBonus: function (combo) { if (combo >= 20) return 8; if (combo >= 10) return 5; if (combo >= 5) return 2; return 0; },
    calculateModeAnswerScore: function (combo, config) { var base = Number(config.correctPoints) || 10; return base + (config.comboBonusEnabled ? this.calculateComboBonus(combo) : 0); }
  };
})(window);
