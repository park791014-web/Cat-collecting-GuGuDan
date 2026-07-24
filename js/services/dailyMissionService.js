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
      if (!config || daily.activeMissionIds.indexOf(id) < 0 || !state) {
        console.error("[Daily Mission Claim Error]", { code: "mission_not_found", message: "Mission config or state not found for: " + id });
        return { ok: false, reason: 'missing' };
      }
      if (!state.completed || state.claimed) {
        var errCode = state.claimed ? 'mission_already_claimed' : 'mission_not_completed';
        console.error("[Daily Mission Claim Error]", { code: errCode, message: "Mission cannot be claimed" });
        return { ok: false, reason: errCode };
      }
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

      var user = global.auth && global.auth.currentUser;
      if (!user || user.isAnonymous) {
          console.error("[Daily Mission Claim Error]", { code: "authenticated_user_required", message: "User must be authenticated to claim online rewards" });
          return { ok: false, reason: 'authenticated_user_required' };
      }
      var uid = user.uid;
      var db = global.db || (global.firebase && global.firebase.firestore());
      if (!db) {
          console.error("[Daily Mission Claim Error]", { code: "database_unavailable", message: "Firestore database is not available" });
          return { ok: false, reason: 'database_unavailable' };
      }

      var userRef = db.collection('users').doc(uid);
      var success = false;

      await db.runTransaction(async function(tx) {
          var snap = await tx.get(userRef);
          if (!snap.exists) {
              throw { code: "missing_user", message: "User document does not exist in Firestore" };
          }
          var uData = snap.data() || {};
          uData.dailyMissions = uData.dailyMissions || {};
          uData.dailyMissions.missions = uData.dailyMissions.missions || {};
          var dbState = uData.dailyMissions.missions[id];
          if (!dbState || !dbState.completed || dbState.claimed) {
              var tErrCode = (dbState && dbState.claimed) ? 'mission_already_claimed' : 'mission_not_completed';
              throw { code: tErrCode, message: "Firestore state does not allow claim: " + tErrCode };
          }

          var updates = {};
          if (reward.coins) {
              updates["currency.coins"] = firebase.firestore.FieldValue.increment(reward.coins);
          }
          if (reward.normalTickets) {
              updates["currency.normalTickets"] = firebase.firestore.FieldValue.increment(reward.normalTickets);
          }
          if (reward.premiumTickets) {
              updates["currency.premiumTickets"] = firebase.firestore.FieldValue.increment(reward.premiumTickets);
          }
          updates["dailyMissions.missions." + id + ".claimed"] = true;
          updates["dailyMissions.missions." + id + ".claimedAt"] = firebase.firestore.FieldValue.serverTimestamp();
          
          tx.update(userRef, updates);
          success = true;
      });

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

          console.debug("[Mission Reward Applied]", {
              missionId: id,
              uid: uid,
              rewardCoins: reward.coins || 0,
              rewardNormal: reward.normalTickets || 0,
              rewardPremium: reward.premiumTickets || 0
          });

          return { ok: true, reward: reward };
      }
      return { ok: false, reason: 'transaction_failed' };
    } catch (err) {
      console.error('[claimMission error]', {
          code: err.code || 'unknown',
          message: err.message || String(err)
      });
      return { ok: false, reason: err.code || 'error' };
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
