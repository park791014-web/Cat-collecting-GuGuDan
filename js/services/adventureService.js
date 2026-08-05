(function (global) {
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  function unique(list) { return Array.from(new Set(list)); }
  function getWorld(id) { return v2.worlds.find(function (world) { return world.id === id; }); }
  function getStage(id) { return v2.stages.find(function (stage) { return stage.id === id; }); }
  function normalizeStageId(value) {
    var match = String(value || '').match(/^(?:stage[_-]?)?(\d{1,2})[-_](\d{1,2})$/i);
    if (!match) return null;
    var id = 'stage_' + String(Number(match[1])).padStart(2, '0') + '_' + String(Number(match[2])).padStart(2, '0');
    return getStage(id) ? id : null;
  }
  function getNextStageId(value) {
    var stage = typeof value === 'string' ? getStage(normalizeStageId(value)) : value;
    if (!stage) return null;
    var world = getWorld(stage.worldId), index = world ? world.stageIds.indexOf(stage.id) : -1;
    if (world && index >= 0 && index + 1 < world.stageIds.length) return world.stageIds[index + 1];
    var worlds = v2.worlds.filter(function (item) { return item.enabled; }).slice().sort(function (a, b) { return a.order - b.order; });
    var worldIndex = worlds.findIndex(function (item) { return item.id === stage.worldId; });
    return worldIndex >= 0 && worlds[worldIndex + 1] && worlds[worldIndex + 1].stageIds[0] || null;
  }
  function normalizeProgress(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var records = {}, completed = [], unlockedStages = ['stage_01_01'], unlockedWorlds = ['world_01'];
    [raw.completedStages || {}, raw.stageRecords || {}].forEach(function (recordMap) {
      Object.keys(recordMap).forEach(function (legacyId) {
        var id = normalizeStageId(legacyId), record = recordMap[legacyId];
        if (!id || !record || typeof record !== 'object') return;
        records[id] = Object.assign({}, records[id] || {}, record);
        if (record.cleared || record.completed) completed.push(id);
      });
    });
    [].concat(raw.completedStageIds || [], raw.clearedStageIds || []).forEach(function (legacyId) { var id = normalizeStageId(legacyId); if (id) completed.push(id); });
    [].concat(raw.unlockedStageIds || []).forEach(function (legacyId) { var id = normalizeStageId(legacyId); if (id) unlockedStages.push(id); });
    var rawWorlds = [].concat(raw.unlockedWorldIds || []);
    if (Array.isArray(raw.unlockedWorlds)) rawWorlds = rawWorlds.concat(raw.unlockedWorlds);
    else Object.keys(raw.unlockedWorlds || {}).forEach(function (id) { if (raw.unlockedWorlds[id]) rawWorlds.push(id); });
    rawWorlds.forEach(function (id) { if (getWorld(id)) unlockedWorlds.push(id); });
    completed = unique(completed);
    completed.forEach(function (id) {
      unlockedStages.push(id);
      var stage = getStage(id), nextId = getNextStageId(stage);
      if (nextId) unlockedStages.push(nextId);
      if (stage) unlockedWorlds.push(stage.worldId);
      if (nextId) unlockedWorlds.push(getStage(nextId).worldId);
    });
    unlockedStages.forEach(function (id) { var stage = getStage(id); if (stage) unlockedWorlds.push(stage.worldId); });
    unlockedStages = unique(unlockedStages);
    unlockedWorlds = unique(unlockedWorlds).filter(function (id) { return Boolean(getWorld(id)); });
    var currentStageId = normalizeStageId(raw.currentStageId || raw.currentStage) || unlockedStages[unlockedStages.length - 1] || 'stage_01_01';
    var currentNextId = completed.indexOf(currentStageId) >= 0 ? getNextStageId(currentStageId) : null;
    if (currentNextId && unlockedStages.indexOf(currentNextId) >= 0) currentStageId = currentNextId;
    var currentStage = getStage(currentStageId);
    return {
      unlockedWorldIds: unlockedWorlds,
      unlockedStageIds: unlockedStages,
      clearedStageIds: completed,
      stageRecords: records,
      totalStars: Object.keys(records).reduce(function (total, id) { return total + (Number(records[id].bestStars) || 0); }, 0),
      currentWorldId: currentStage ? currentStage.worldId : 'world_01',
      currentStageId: currentStageId
    };
  }
  function loadProgress() { return normalizeProgress(v2.storageService.loadSaveData().adventureProgress); }
  function saveProgress(progress) { var data = v2.storageService.loadSaveData(); data.adventureProgress = normalizeProgress(progress); return v2.storageService.saveSaveData(data); }
  function starsForResult(stage, result, cleared) { if (!cleared) return 0; var stars = 1; if (stage.type === 'timed') { if (result.remainingSeconds >= stage.rules.timeLimitSeconds * .2) stars = 2; } else if (stage.type === 'combo' || stage.type === 'midBoss' || stage.type === 'boss') { if (result.remainingLives >= 2) stars = 2; } else if (result.accuracy >= 80) stars = 2; if (result.wrongCount === 0) stars = 3; return stars; }
  function completeStage(stageId, result) {
    var stage = getStage(stageId); if (!stage) return { ok: false, reason: 'missing_stage' }; var progress = loadProgress(), isBoss = stage.type === 'midBoss' || stage.type === 'boss';
    var cleared = isBoss ? result.bossHp <= 0 && result.remainingLives > 0 : stage.type === 'combo' ? result.bestCombo >= stage.rules.targetCombo : stage.type === 'timed' ? result.correctCount >= stage.clearCondition.minimumCorrect : result.correctCount >= stage.clearCondition.minimumCorrect && result.accuracy >= stage.clearCondition.minimumAccuracy;
    var stars = starsForResult(stage, result, cleared), previous = progress.stageRecords[stageId] || {}, now = new Date().toISOString();
    progress.stageRecords[stageId] = { cleared: cleared || Boolean(previous.cleared), bestStars: Math.max(previous.bestStars || 0, stars), bestScore: Math.max(previous.bestScore || 0, result.score), bestAccuracy: Math.max(previous.bestAccuracy || 0, result.accuracy), bestCombo: Math.max(previous.bestCombo || 0, result.bestCombo), bestRemainingLives: Math.max(previous.bestRemainingLives || 0, result.remainingLives), clearCount: (previous.clearCount || 0) + (cleared ? 1 : 0), firstClearedAt: previous.firstClearedAt || (cleared ? now : null), lastPlayedAt: now };
    var unlockedStageId = null, unlockedWorldId = null;
    if (cleared) { progress.clearedStageIds = unique(progress.clearedStageIds.concat(stageId)); var next = getStage(getNextStageId(stage)); if (next) { progress.unlockedStageIds = unique(progress.unlockedStageIds.concat(next.id)); unlockedStageId = next.id; if (next.worldId !== stage.worldId) { progress.unlockedWorldIds = unique(progress.unlockedWorldIds.concat(next.worldId)); unlockedWorldId = next.worldId; } } }
    progress.totalStars = Object.keys(progress.stageRecords).reduce(function (total, id) { return total + (progress.stageRecords[id].bestStars || 0); }, 0); progress.currentWorldId = stage.worldId; progress.currentStageId = stage.id; saveProgress(progress); return { ok: true, cleared: cleared, stars: stars, progress: progress, unlockedStageId: unlockedStageId, unlockedWorldId: unlockedWorldId, record: progress.stageRecords[stageId] };
  }
  function validateAdventureProgress(progress) { var errors = [], stageIds = v2.stages.map(function (stage) { return stage.id; }), worldIds = v2.worlds.map(function (world) { return world.id; }); (progress.unlockedStageIds || []).forEach(function (id) { if (stageIds.indexOf(id) < 0) errors.push('없는 스테이지 해제: ' + id); }); (progress.unlockedWorldIds || []).forEach(function (id) { if (worldIds.indexOf(id) < 0) errors.push('없는 월드 해제: ' + id); }); Object.keys(progress.stageRecords || {}).forEach(function (id) { var stars = progress.stageRecords[id].bestStars; if (stageIds.indexOf(id) < 0 || stars < 0 || stars > 3) errors.push('잘못된 스테이지 기록: ' + id); }); return errors; }
  function unlockStage(id) { var progress = loadProgress(); if (getStage(id)) progress.unlockedStageIds = unique(progress.unlockedStageIds.concat(id)); saveProgress(progress); return progress; }
  function unlockWorld(id) { var progress = loadProgress(), world = getWorld(id); if (world && world.enabled) { progress.unlockedWorldIds = unique(progress.unlockedWorldIds.concat(id)); if (world.stageIds[0]) progress.unlockedStageIds = unique(progress.unlockedStageIds.concat(world.stageIds[0])); } saveProgress(progress); return progress; }
  function resetForTesting() { var data = v2.storageService.loadSaveData(); data.adventureProgress = JSON.parse(JSON.stringify(v2.storageService.defaults.adventureProgress)); v2.storageService.saveSaveData(data); return data.adventureProgress; }
  v2.adventureService = { loadProgress: loadProgress, saveProgress: saveProgress, normalizeProgress: normalizeProgress, normalizeStageId: normalizeStageId, getNextStageId: getNextStageId, getWorld: getWorld, getStage: getStage, completeStage: completeStage, starsForResult: starsForResult, validateAdventureProgress: validateAdventureProgress, unlockStage: unlockStage, unlockWorld: unlockWorld, resetForTesting: resetForTesting };
})(window);
