(function (global) {
  'use strict';
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function runPhase2Validation() {
    var v2=global.GugudanV2, storage=v2.storageService, ranking=v2.rankingService;
    var schema3={schemaVersion:3,profile:{nickname:'기존냥',selectedCatId:'base_normal_02'},progress:{totalScore:777,bestCombo:9},personalBests:{classic:{bestScore:30},timeAttack:{bestScore:50},endless:{bestScore:90}},collection:{ownedCatIds:['base_normal_02']},settings:{soundEnabled:false}};
    var migrated=storage.migrateSaveDataToSchema5(schema3); assert(migrated.schemaVersion===7&&migrated.profile.nickname==='기존냥'&&migrated.progress.totalScore===777,'스키마 3→5 실패'); assert(migrated.personalBests.timeAttack.bestScore===50&&migrated.legacy.endlessPersonalBest.bestScore===90,'기록 보존 실패'); assert(migrated.collection.ownedCatIds.indexOf('base_normal_02')>=0&&migrated.settings.soundEnabled===false,'설정 보존 실패');
    var week=ranking.getKoreanWeekRange(new Date('2026-07-21T03:00:00Z')); assert(week.weekKey==='2026-07-20','주간 키 실패'); assert(JSON.stringify(ranking.allowedModes)===JSON.stringify(['classic','timeAttack']),'랭킹 모드 실패');
    return {passed:true,schemaVersion:migrated.schemaVersion,weekKey:week.weekKey,rankingModes:ranking.allowedModes};
  }
  global.runPhase2Validation=runPhase2Validation;
})(window);
