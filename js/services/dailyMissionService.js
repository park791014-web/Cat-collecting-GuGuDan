(function (global) {
  'use strict';
  var v2 = global.GugudanV2, claiming = {};

  function getKoreaDateKey(referenceDate) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(referenceDate ? new Date(referenceDate) : new Date());
    var values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }

  function hash(text) {
    var value = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function orderIds(ids, seedText) {
    var seed = hash(seedText);
    return ids.map(function (id) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return { id: id, order: seed };
    }).sort(function (a, b) { return a.order - b.order; }).map(function (item) { return item.id; });
  }

  function isPremium(config) { return Boolean(config && config.reward && config.reward.premiumTickets); }

  function selectIds(dateKey, playerId) {
    var ids = Object.keys(v2.dailyMissionConfig || {}), identity = dateKey + ':' + (playerId || 'guest');
    var premiumIds = ids.filter(function (id) { return isPremium(v2.dailyMissionConfig[id]); });
    var normalIds = ids.filter(function (id) { return !isPremium(v2.dailyMissionConfig[id]); });
    var premiumId = orderIds(premiumIds, identity + ':premium')[0];
    var selected = [premiumId], usedFamilies = {};
    usedFamilies[v2.dailyMissionConfig[premiumId].family] = true;
    orderIds(normalIds, identity + ':normal').some(function (id) {
      var family = v2.dailyMissionConfig[id].family;
      if (usedFamilies[family]) return false;
      selected.push(id);
      usedFamilies[family] = true;
      return selected.length === 3;
    });
    return selected;
  }

  function copyReward(reward) {
    var result = {};
    ['coins', 'normalTickets', 'premiumTickets'].forEach(function (key) {
      if (reward && Number(reward[key])) result[key] = Number(reward[key]);
    });
    return result;
  }

  function rewardSignature(reward) {
    var value = copyReward(reward);
    return ['coins', 'normalTickets', 'premiumTickets'].map(function (key) { return key + ':' + (value[key] || 0); }).join('|');
  }

  function newMissionState(config) {
    return { progress: 0, target: config.target, reward: copyReward(config.reward), completed: false, claimed: false, claimedAt: null };
  }

  function isValidDaily(daily) {
    var activeIds = daily && daily.activeMissionIds;
    if (!Array.isArray(activeIds) || activeIds.length !== 3 || new Set(activeIds).size !== 3) return false;
    var configs = activeIds.map(function (id) { return v2.dailyMissionConfig[id]; });
    if (configs.some(function (config) { return !config; })) return false;
    if (configs.filter(isPremium).length !== 1 || configs.filter(function (config) { return !isPremium(config); }).length !== 2) return false;
    if (new Set(configs.map(function (config) { return config.family; })).size !== 3) return false;
    return activeIds.every(function (id) {
      var state = daily.missions && daily.missions[id], config = v2.dailyMissionConfig[id];
      return Boolean(state) && Number(state.target) === Number(config.target) && rewardSignature(state.reward) === rewardSignature(config.reward);
    });
  }

  function fresh(dateKey, playerId) {
    var result = { dateKey: dateKey, activeMissionIds: selectIds(dateKey, playerId), missions: {} };
    result.activeMissionIds.forEach(function (id) {
      var config = v2.dailyMissionConfig[id];
      result.missions[id] = newMissionState(config);
    });
    return result;
  }

  function ensure(save, referenceDate) {
    var todayDateKey = getKoreaDateKey(referenceDate);
    var storedDateKey = save.dailyMissions && save.dailyMissions.dateKey || '';
    var resetRequired = storedDateKey !== todayDateKey || !isValidDaily(save.dailyMissions);
    console.info('[DAILY MISSION DATE CHECK]', { storedDateKey: storedDateKey, todayDateKey: todayDateKey, resetRequired: resetRequired });
    if (resetRequired) {
      save.dailyMissions = fresh(todayDateKey, save.profile && (save.profile.playerId || save.profile.userId));
      console.info('[DAILY MISSION RESET]', { previousDateKey: storedDateKey, newDateKey: todayDateKey, missionIds: save.dailyMissions.activeMissionIds.slice() });
    }
    save.dailyMissions.missions = save.dailyMissions.missions || {};
    save.dailyMissions.activeMissionIds.forEach(function (id) {
      var config = v2.dailyMissionConfig[id];
      if (!config) return;
      if (!save.dailyMissions.missions[id]) save.dailyMissions.missions[id] = newMissionState(config);
      var state = save.dailyMissions.missions[id];
      state.target = config.target;
      state.reward = copyReward(config.reward);
      state.progress = Math.min(config.target, Math.max(0, Number(state.progress) || 0));
      state.completed = state.progress >= config.target;
      state.claimed = state.claimed === true;
      if (state.claimed) { state.progress = config.target; state.completed = true; }
      state.claimedAt = state.claimedAt || null;
    });
    return save.dailyMissions;
  }

  function snapshot(daily) {
    var result = {};
    (daily.activeMissionIds || []).forEach(function (id) {
      var state = daily.missions[id];
      if (state) result[id] = { progress: state.progress, target: state.target, completed: state.completed, claimed: state.claimed };
    });
    return result;
  }

  function add(state, amount) {
    if (!state) return 0;
    var increment = Math.max(0, Number(amount) || 0);
    var before = Math.max(0, Number(state.progress) || 0);
    state.target = Math.max(0, Number(state.target) || 0);
    state.progress = Math.min(state.target, before + increment);
    state.completed = state.progress >= state.target;
    if (state.claimed !== true) state.claimed = false;
    return state.progress - before;
  }

  function applyProgress(daily, result) {
    result = result || {};
    var before = snapshot(daily), increments = {};
    var finishReason = result.finishReason || result.reason || '';
    var mode = result.mode === 'timeAttack' ? 'timeattack' : result.mode;
    var totalQuestions = Number(result.totalQuestions != null ? result.totalQuestions : result.totalCount) || 0;
    var correctCount = Math.max(0, Number(result.correctCount) || 0);
    var cleared = result.cleared != null ? Boolean(result.cleared) : Boolean(result.success);
    var success = result.success != null ? Boolean(result.success) : cleared;
    var normalCompleted = success && finishReason !== 'manual_exit' && finishReason !== 'error';
    var stageNumber = Number(result.stageNumber) || 0;
    var maxCombo = Number(result.maxCombo != null ? result.maxCombo : result.bestCombo) || 0;

    (daily.activeMissionIds || []).forEach(function (id) {
      var config = v2.dailyMissionConfig[id], state = daily.missions[id], amount = 0;
      if (!config || !state) return;
      if (config.type === 'correct' && normalCompleted && ['classic', 'timeattack', 'adventure'].indexOf(mode) >= 0) amount = correctCount;
      else if (config.type === 'classicRuns' && mode === 'classic' && normalCompleted) amount = 1;
      else if (config.type === 'timeAttackRuns' && mode === 'timeattack' && normalCompleted) amount = 1;
      else if (config.type === 'adventureClears' && mode === 'adventure' && normalCompleted && cleared) amount = 1;
      else if (config.type === 'bossClears' && mode === 'adventure' && normalCompleted && cleared && (stageNumber === 5 || stageNumber === 10)) amount = 1;
      else if (config.type === 'classicPerfect' && mode === 'classic' && normalCompleted && totalQuestions > 0 && correctCount === totalQuestions) amount = 1;
      else if (config.type === 'timeAttackCombo' && mode === 'timeattack' && normalCompleted && maxCombo >= (config.minimumCombo || config.target)) amount = 1;
      increments[id] = add(state, amount);
    });
    return { before: before, increments: increments, after: snapshot(daily) };
  }

  function recordGameResult(result) {
    if (!result) return false;
    var save = v2.storageService.loadSaveData(), daily = ensure(save);
    var change = applyProgress(daily, result);
    console.info('[DAILY MISSION PROGRESS]', { sessionId: result.sessionId || null, mode: result.mode || null, before: change.before, increments: change.increments, after: change.after });
    return v2.storageService.saveSaveData(save);
  }

  function claimLocal(id) {
    var config = v2.dailyMissionConfig[id], save = v2.storageService.loadSaveData(), daily = ensure(save), state = daily.missions[id];
    console.info('[DAILY MISSION CLAIM START]', { missionId: id, dateKey: daily.dateKey });
    if (!config || daily.activeMissionIds.indexOf(id) < 0 || !state) {
      console.info('[DAILY MISSION CLAIM SKIPPED]', { missionId: id, reason: 'missing' });
      return { ok: false, reason: 'missing' };
    }
    if (!state.completed || state.claimed) {
      var reason = state.claimed ? 'claimed' : 'incomplete';
      console.info('[DAILY MISSION CLAIM SKIPPED]', { missionId: id, reason: reason });
      return { ok: false, reason: reason };
    }
    var reward = config.reward || {};
    save.currency.coins = (save.currency.coins || 0) + (reward.coins || 0);
    save.currency.normalTickets = (save.currency.normalTickets || 0) + (reward.normalTickets || 0);
    save.currency.premiumTickets = (save.currency.premiumTickets || 0) + (reward.premiumTickets || 0);
    state.claimed = true;
    state.claimedAt = new Date().toISOString();
    if (!v2.storageService.saveSaveData(save)) return { ok: false, reason: 'save_failed' };
    console.info('[DAILY MISSION CLAIM SUCCESS]', { missionId: id, reward: reward });
    return { ok: true, reward: reward };
  }

  function claim(id) {
    if (claiming[id]) return Promise.resolve({ ok: false, reason: 'busy' });
    var context = v2.storageService.getCurrentUserContext ? v2.storageService.getCurrentUserContext() : { type: 'guest' };
    if (context.type === 'authenticated' && typeof global.claimDailyMissionTransaction === 'function') {
      claiming[id] = true;
      return Promise.resolve().then(function () { return global.claimDailyMissionTransaction(id); }).finally(function () { claiming[id] = false; });
    }
    claiming[id] = true;
    try { return claimLocal(id); }
    finally { claiming[id] = false; }
  }

  function get() {
    var save = v2.storageService.loadSaveData();
    ensure(save);
    v2.storageService.saveSaveData(save);
    return save.dailyMissions;
  }

  function reset() {
    var save = v2.storageService.loadSaveData();
    save.dailyMissions = fresh(getKoreaDateKey(), save.profile && (save.profile.playerId || save.profile.userId));
    v2.storageService.saveSaveData(save);
    return save.dailyMissions;
  }

  function complete(id) {
    var save = v2.storageService.loadSaveData(), daily = ensure(save), state = daily.missions[id];
    if (!state) return null;
    state.progress = state.target;
    state.completed = true;
    v2.storageService.saveSaveData(save);
    return state;
  }

  v2.dailyMissionService = {
    getKoreaDateKey: getKoreaDateKey,
    createDailyMissions: fresh,
    validateDailyMissions: isValidDaily,
    ensureDailyMissions: ensure,
    applyDailyMissionProgress: applyProgress,
    recordGameResult: recordGameResult,
    claimMission: claim,
    getDailyMissions: get,
    resetDailyMissions: reset
  };
  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, { printDailyMissions: get, completeDailyMissionForTesting: complete, resetDailyMissionsForTesting: reset });
})(window);
