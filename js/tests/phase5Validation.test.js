(function (global) {
  'use strict';
  function assert(ok, message) { if (!ok) throw new Error('[Phase5] ' + message); }
  function runPhase5Validation() {
    var v2 = global.GugudanV2, service = v2.seasonService, debug = global.NyankoDebug, season = v2.seasons[0];
    v2.storageService.resetSaveData();
    assert(v2.validators.validateReleaseState().valid, '출시 버전/스키마 검증 실패');
    assert(v2.validators.validateSeasonData().valid, '시즌 설정 검증 실패');
    assert(v2.validators.validateSeasonCatData().valid, '시즌 고양이 검증 실패');
    assert(v2.validators.validateSeasonMissionData().valid, '시즌 미션 검증 실패');
    assert(service.getSeasonStatus(season, new Date(season.startAt).getTime() - 1).status === 'upcoming', '시작 경계 실패');
    assert(service.getSeasonStatus(season, season.startAt).status === 'active', '시작 시각 실패');
    assert(service.getSeasonStatus(season, season.endAt).status === 'active', '종료 시각 실패');
    assert(service.getSeasonStatus(season, new Date(season.endAt).getTime() + 1).status === 'ended', '종료 경계 실패');
    debug.setSeasonDateForTesting('2026-08-01T12:00:00+09:00');
    assert(service.getActiveSeason().id === season.id, '활성 시즌 탐색 실패');
    assert(service.claimEntryReward(season.id).ok && !service.claimEntryReward(season.id).ok, '입장 보상 중복 방지 실패');
    service.recordGameResult({ mode:'classic', correctCount:30, totalQuestions:30, accuracy:100 });
    var mission = service.getSeasonMissions(season)[0]; assert(service.claimMission(mission.id).ok && !service.claimMission(mission.id).ok, '미션 수령 중복 방지 실패');
    debug.grantSeasonTicket(season.id, 2); var first = service.openSeasonPack(season.id, 0.01, 0), second = service.openSeasonPack(season.id, 0.01, 0); assert(first.ok && second.ok && second.duplicate, '시즌 팩/중복 처리 실패');
    var acquiredId = first.cat.id, save = v2.storageService.loadSaveData(); save.profile.selectedCatId = acquiredId; v2.storageService.saveSaveData(save); debug.setSeasonDateForTesting('2027-01-01T00:00:00+09:00'); assert(!service.getActiveSeason(), '비시즌 상태 실패'); assert(service.getVisibleSeasonCats().some(function(cat){return cat.id===acquiredId;}), '종료 시즌 보유 고양이 유지 실패'); assert(v2.storageService.loadSaveData().profile.selectedCatId === acquiredId, '시즌 고양이 장착 유지 실패'); debug.resetSeasonDateForTesting();
    return { passed:true, schemaVersion:7, appVersion:v2.APP_VERSION, contentVersion:v2.CONTENT_VERSION, seasonId:season.id };
  }
  global.runPhase5Validation = runPhase5Validation;
})(window);
