(function (global) {
  'use strict';

  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var CURVE_VERSION = 2;

  function integer(value, fallback) {
    var number = Math.floor(Number(value));
    return Number.isFinite(number) ? number : fallback;
  }

  function requiredPointsForNextLevel(levelsEarnedInV2) {
    return 500 * (Math.max(0, integer(levelsEarnedInV2, 0)) + 2);
  }

  function createBaseline(level, totalPoints) {
    return {
      curveVersion: CURVE_VERSION,
      baseLevel: Math.max(1, integer(level, 1)),
      baseTotalPoints: Math.max(0, integer(totalPoints, 0))
    };
  }

  function normalizeBaseline(baseline, level, totalPoints) {
    if (!baseline || integer(baseline.curveVersion, 0) !== CURVE_VERSION) {
      return createBaseline(level, totalPoints);
    }
    return createBaseline(baseline.baseLevel, baseline.baseTotalPoints);
  }

  function resolveLevel(totalPoints, baseline, minimumLevel) {
    var normalized = normalizeBaseline(baseline, minimumLevel, totalPoints);
    var remaining = Math.max(0, integer(totalPoints, 0) - normalized.baseTotalPoints);
    var levelsEarnedInV2 = 0;

    while (remaining >= requiredPointsForNextLevel(levelsEarnedInV2)) {
      remaining -= requiredPointsForNextLevel(levelsEarnedInV2);
      levelsEarnedInV2 += 1;
    }

    return Math.max(
      normalized.baseLevel + levelsEarnedInV2,
      integer(minimumLevel, normalized.baseLevel)
    );
  }

  function calculatePlayCoins(mode, sessionPoints, completed) {
    if (!completed || ['classic', 'timeAttack', 'adventure', 'divisionExact', 'divisionRemainder'].indexOf(mode) < 0) return 0;
    return Math.floor(Math.max(0, Number(sessionPoints) || 0) / 2);
  }

  v2.levelProgressService = {
    CURVE_VERSION: CURVE_VERSION,
    requiredPointsForNextLevel: requiredPointsForNextLevel,
    createBaseline: createBaseline,
    normalizeBaseline: normalizeBaseline,
    resolveLevel: resolveLevel,
    calculatePlayCoins: calculatePlayCoins
  };
})(typeof window !== 'undefined' ? window : globalThis);
