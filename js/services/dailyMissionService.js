(function (global) {
  'use strict';
  var v2 = global.GugudanV2, claiming = {};
  function getKoreaDateKey(referenceDate) { var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(referenceDate ? new Date(referenceDate) : new Date()), values = {}; parts.forEach(function (p) { values[p.type] = p.value; }); return values.year + '-' + values.month + '-' + values.day; }
  function hash(text) { var value = 2166136261; for (var i = 0; i < text.length; i += 1) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); } return value >>> 0; }
  function selectIds(dateKey, playerId) { var ids = Object.keys(v2.dailyMissionConfig), seed = hash(dateKey + ':' + (playerId || 'guest')); return ids.map(function (id) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return { id: id, order: seed }; }).sort(function (a, b) { return a.order - b.order; }).slice(0, 3).map(function (item) { return item.id; }); }
  function fresh(dateKey, playerId) { var result = { dateKey: dateKey, activeMissionIds: selectIds(dateKey, playerId), missions: {} }; result.activeMissionIds.forEach(function (id) { var config = v2.dailyMissionConfig[id]; result.missions[id] = { progress: 0, target: config.target, completed: false, claimed: false, claimedAt: null }; }); return result; }
  function ensure(save, referenceDate) { var key = getKoreaDateKey(referenceDate); if (!save.dailyMissions || save.dailyMissions.dateKey !== key || !Array.isArray(save.dailyMissions.activeMissionIds) || save.dailyMissions.activeMissionIds.length !== 3) save.dailyMissions = fresh(key, save.profile && save.profile.playerId); save.dailyMissions.activeMissionIds.forEach(function (id) { var config = v2.dailyMissionConfig[id]; if (config && !save.dailyMissions.missions[id]) save.dailyMissions.missions[id] = { progress: 0, target: config.target, completed: false, claimed: false, claimedAt: null }; }); return save.dailyMissions; }
  function add(state, amount) { if (!state) return; state.progress = Math.min(state.target, state.progress + Math.max(0, Number(amount) || 0)); state.completed = state.progress >= state.target; }
  function recordGameResult(result) { if (!result) return false; var save = v2.storageService.loadSaveData(), daily = ensure(save); daily.activeMissionIds.forEach(function (id) { var config = v2.dailyMissionConfig[id], state = daily.missions[id], amount = 0; if (config.type === 'correct') amount = result.correctCount || 0; else if (config.type === 'classicRuns' && result.mode === 'classic' && result.finishReason !== 'manual_exit' && result.finishReason !== 'error') amount = 1; else if (config.type === 'timeAttackRuns' && result.mode === 'timeAttack' && result.totalQuestions > 0 && result.finishReason !== 'manual_exit' && result.finishReason !== 'error') amount = 1; else if (config.type === 'adventureClears' && result.mode === 'adventure' && result.cleared) amount = 1; else if (config.type === 'bossClears' && result.mode === 'adventure' && result.cleared && result.isBoss) amount = 1; else if (config.type === 'perfectRuns' && result.accuracy === 100 && result.totalQuestions >= (config.minimumQuestions || 1)) amount = 1; else if (config.type === 'bestCombo') amount = Math.max(0, (result.bestCombo || 0) - state.progress); add(state, amount); }); return v2.storageService.saveSaveData(save); }
  
  async function recordDailyMissionProgress(input) {
    if (!input || !input.uid) return false;
    var save = v2.storageService.loadSaveData();
    var daily = ensure(save);
    
    save.rewardHistory = save.rewardHistory || {};
    var processedMissions = save.rewardHistory.processedMissionSessions || (save.rewardHistory.processedMissionSessions = []);
    if (processedMissions.indexOf(input.sessionId) >= 0) {
        console.warn('[Session Duplicate Mission] already processed:', input.sessionId);
        return false;
    }
    processedMissions.push(input.sessionId);
    save.rewardHistory.processedMissionSessions = processedMissions.slice(-100);

    daily.activeMissionIds.forEach(function (id) {
      var config = v2.dailyMissionConfig[id], state = daily.missions[id], amount = 0;
      if (config.type === 'correct') {
          amount = input.correctCount || 0;
      } else if (config.type === 'classicRuns' && input.mode === 'classic') {
          amount = 1;
      } else if (config.type === 'timeAttackRuns' && input.mode === 'timeAttack') {
          amount = 1;
      } else if (config.type === 'adventureClears' && input.mode === 'adventure' && input.success) {
          amount = 1;
      } else if (config.type === 'bossClears' && input.mode === 'adventure' && input.success && input.isBoss) {
          amount = 1;
      } else if (config.type === 'perfectRuns' && input.accuracy === 100 && input.answeredCount >= (config.minimumQuestions || 1)) {
          amount = 1;
      } else if (config.type === 'bestCombo') {
          amount = Math.max(0, (input.bestCombo || 0) - state.progress);
      }
      add(state, amount);
    });
    
    v2.storageService.saveSaveData(save);

    console.debug("[Mission Progress]", {
        sessionId: input.sessionId,
        mode: input.mode,
        missionDateKey: daily.dateKey,
        updates: daily.missions
    });

    if (typeof global.syncLocalSaveToFirestore === 'function') {
        await global.syncLocalSaveToFirestore();
    }
    return true;
  }

  async function claim(id) {
    if (claiming[id]) return { ok: false, reason: 'busy' };
    claiming[id] = true;
    try {
      var config = v2.dailyMissionConfig[id], save = v2.storageService.loadSaveData(), daily = ensure(save), state = daily.missions[id];
      if (!config || daily.activeMissionIds.indexOf(id) < 0 || !state) return { ok: false, reason: 'missing' };
      if (!state.completed || state.claimed) return { ok: false, reason: state.claimed ? 'claimed' : 'incomplete' };
      var reward = config.reward || {};
      
      var context = window.getCurrentPlayerContext ? window.getCurrentPlayerContext() : { isGuest: true };
      if (context.isGuest) {
          save.currency.coins += reward.coins || 0;
          save.currency.normalTickets += reward.normalTickets || 0;
          save.currency.premiumTickets += reward.premiumTickets || 0;
          state.claimed = true;
          state.claimedAt = new Date().toISOString();
          v2.storageService.saveSaveData(save);
          return { ok: true, reward: reward };
      }

      var uid = (global.auth && global.auth.currentUser) ? global.auth.currentUser.uid : global.currentUser;
      if (!uid) return { ok: false, reason: 'unauthorized' };

      var success = false;
      var db = global.db || (global.firebase && global.firebase.firestore());
      if (db) {
          var userRef = db.collection('users').doc(uid);
          await db.runTransaction(async function(tx) {
              var snap = await tx.get(userRef);
              if (!snap.exists) throw new Error('missing_user');
              var uData = snap.data() || {};
              uData.dailyMissions = uData.dailyMissions || {};
              uData.dailyMissions.missions = uData.dailyMissions.missions || {};
              var dbState = uData.dailyMissions.missions[id];
              if (!dbState || !dbState.completed || dbState.claimed) {
                  throw new Error('already_claimed_or_incomplete');
              }
              uData.currency = uData.currency || {};
              uData.currency.coins = (Number(uData.currency.coins) || 0) + (reward.coins || 0);
              uData.currency.normalTickets = (Number(uData.currency.normalTickets) || 0) + (reward.normalTickets || 0);
              uData.currency.premiumTickets = (Number(uData.currency.premiumTickets) || 0) + (reward.premiumTickets || 0);
              dbState.claimed = true;
              dbState.claimedAt = firebase.firestore.FieldValue.serverTimestamp();
              tx.set(userRef, uData, { merge: true });
              success = true;
          });
      }

      if (success) {
          save.currency.coins += reward.coins || 0;
          save.currency.normalTickets += reward.normalTickets || 0;
          save.currency.premiumTickets += reward.premiumTickets || 0;
          state.claimed = true;
          state.claimedAt = new Date().toISOString();
          v2.storageService.saveSaveData(save);
          if (typeof global.reloadCurrentUserStats === 'function') {
              await global.reloadCurrentUserStats();
          }
          console.debug("[Reward Applied]", {
              source: "dailyMission",
              rewardId: id,
              rewardTypes: Object.keys(reward),
              saved: true
          });
          return { ok: true, reward: reward };
      }
      return { ok: false, reason: 'transaction_failed' };
    } catch (err) {
      console.error('[claimMission error]', err);
      return { ok: false, reason: err.message || 'error' };
    } finally {
      claiming[id] = false;
    }
  }

  function get() { var save = v2.storageService.loadSaveData(); ensure(save); v2.storageService.saveSaveData(save); return save.dailyMissions; }
  function reset() { var save = v2.storageService.loadSaveData(); save.dailyMissions = fresh(getKoreaDateKey(), save.profile && save.profile.playerId); v2.storageService.saveSaveData(save); return save.dailyMissions; }
  function complete(id) { var save = v2.storageService.loadSaveData(), daily = ensure(save), state = daily.missions[id]; if (!state) return null; state.progress = state.target; state.completed = true; v2.storageService.saveSaveData(save); return state; }
  v2.dailyMissionService = { getKoreaDateKey: getKoreaDateKey, ensureDailyMissions: ensure, recordGameResult: recordGameResult, recordDailyMissionProgress: recordDailyMissionProgress, claimMission: claim, getDailyMissions: get, resetDailyMissions: reset };
  var debug = global.NyankoDebug = global.NyankoDebug || {}; Object.assign(debug, { printDailyMissions: get, completeDailyMissionForTesting: complete, resetDailyMissionsForTesting: reset });
})(window);
