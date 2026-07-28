const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
global.NyankoDebug = {};
global.GugudanV2 = {};

let context = { type: 'guest', userId: 'guest_test' };
let persisted = {
  profile: { playerId: 'guest_test' },
  currency: { coins: 0, normalTickets: 0, premiumTickets: 0 },
  dailyMissions: null
};
const clone = value => JSON.parse(JSON.stringify(value));

GugudanV2.storageService = {
  loadSaveData() { return clone(persisted); },
  saveSaveData(value) { persisted = clone(value); return true; },
  getCurrentUserContext() { return Object.assign({}, context); }
};

vm.runInThisContext(fs.readFileSync('js/config/dailyMissionConfig.js', 'utf8'), { filename: 'dailyMissionConfig.js' });
vm.runInThisContext(fs.readFileSync('js/services/dailyMissionService.js', 'utf8'), { filename: 'dailyMissionService.js' });

const service = GugudanV2.dailyMissionService;
const config = GugudanV2.dailyMissionConfig;
const expected = {
  daily_correct_20: { target: 20, reward: { coins: 200 } },
  daily_correct_50: { target: 50, reward: { normalTickets: 1 } },
  daily_correct_100: { target: 100, reward: { premiumTickets: 1 } },
  daily_classic_1: { target: 1, reward: { normalTickets: 1 } },
  daily_timeattack_1: { target: 1, reward: { normalTickets: 1 } },
  daily_classic_2: { target: 2, reward: { premiumTickets: 1 } },
  daily_timeattack_2: { target: 2, reward: { premiumTickets: 1 } },
  daily_adventure_3: { target: 3, reward: { normalTickets: 1 } },
  daily_adventure_5: { target: 5, reward: { premiumTickets: 1 } },
  daily_boss_3: { target: 3, reward: { premiumTickets: 1 } },
  daily_classic_perfect_1: { target: 1, reward: { premiumTickets: 1 } },
  daily_combo_25: { target: 1, reward: { premiumTickets: 1 } }
};

function stateFor(id) {
  return { progress: 0, target: config[id].target, reward: clone(config[id].reward), completed: false, claimed: false, claimedAt: null };
}

function allMissions(dateKey = '2026-07-22') {
  const activeMissionIds = Object.keys(config);
  const missions = {};
  activeMissionIds.forEach(id => { missions[id] = stateFor(id); });
  return { dateKey, activeMissionIds, missions };
}

function apply(daily, overrides) {
  return service.applyDailyMissionProgress(daily, Object.assign({
    sessionId: 'session_test', mode: 'classic', correctCount: 0, totalCount: 20,
    success: true, finishReason: 'question_limit', maxCombo: 0
  }, overrides));
}

function assertSelection(daily) {
  assert.equal(daily.activeMissionIds.length, 3);
  assert.equal(new Set(daily.activeMissionIds).size, 3);
  const selected = daily.activeMissionIds.map(id => config[id]);
  assert.equal(selected.filter(item => item.reward.premiumTickets).length, 1);
  assert.equal(selected.filter(item => !item.reward.premiumTickets).length, 2);
  assert.equal(new Set(selected.map(item => item.family)).size, 3);
  assert(service.validateDailyMissions(daily));
}

(async () => {
  assert.equal(Object.keys(config).length, 12);
  Object.keys(expected).forEach(id => {
    assert(config[id], `missing config: ${id}`);
    assert.equal(config[id].target, expected[id].target);
    assert.deepStrictEqual(config[id].reward, expected[id].reward);
    assert.equal(Object.keys(config[id].reward).length, 1);
  });

  const sameA = service.createDailyMissions('2026-07-22', 'user_a');
  const sameB = service.createDailyMissions('2026-07-22', 'user_a');
  assert.deepStrictEqual(sameA.activeMissionIds, sameB.activeMissionIds);
  assertSelection(sameA);
  const dateSelections = new Set();
  for (let day = 22; day <= 28; day += 1) {
    const daily = service.createDailyMissions(`2026-07-${day}`, 'user_a');
    assertSelection(daily);
    dateSelections.add(daily.activeMissionIds.join(','));
  }
  assert(dateSelections.size > 1);

  assert.equal(service.getKoreaDateKey('2026-07-21T15:30:00.000Z'), '2026-07-22');
  const sameDaySave = { profile: { playerId: 'user_a' }, dailyMissions: clone(sameA) };
  const preservedId = sameDaySave.dailyMissions.activeMissionIds[0];
  sameDaySave.dailyMissions.missions[preservedId].progress = 1;
  service.ensureDailyMissions(sameDaySave, '2026-07-21T15:30:00.000Z');
  assert.equal(sameDaySave.dailyMissions.missions[preservedId].progress, 1);
  service.ensureDailyMissions(sameDaySave, '2026-07-22T15:30:00.000Z');
  assert.equal(sameDaySave.dailyMissions.dateKey, '2026-07-23');
  sameDaySave.dailyMissions.activeMissionIds.forEach(id => {
    assert.equal(sameDaySave.dailyMissions.missions[id].progress, 0);
    assert.equal(sameDaySave.dailyMissions.missions[id].completed, false);
    assert.equal(sameDaySave.dailyMissions.missions[id].claimed, false);
  });

  const legacySave = {
    profile: { playerId: 'legacy_user' },
    dailyMissions: {
      dateKey: service.getKoreaDateKey(),
      activeMissionIds: ['daily_correct_40', 'daily_boss_1', 'daily_combo_10'],
      missions: { daily_correct_40: { progress: 40, target: 40, completed: true, claimed: true } }
    }
  };
  service.ensureDailyMissions(legacySave);
  assertSelection(legacySave.dailyMissions);
  legacySave.dailyMissions.activeMissionIds.forEach(id => assert.deepStrictEqual(legacySave.dailyMissions.missions[id], stateFor(id)));

  const correct = allMissions();
  apply(correct, { correctCount: 100, totalCount: 100, maxCombo: 100 });
  assert.equal(correct.missions.daily_correct_20.progress, 20);
  assert.equal(correct.missions.daily_correct_50.progress, 50);
  assert.equal(correct.missions.daily_correct_100.progress, 100);

  const classic = allMissions();
  apply(classic, { correctCount: 19, totalCount: 20 });
  apply(classic, { sessionId: 'classic_2', correctCount: 19, totalCount: 20 });
  assert.equal(classic.missions.daily_classic_1.progress, 1);
  assert.equal(classic.missions.daily_classic_2.progress, 2);
  assert.equal(classic.missions.daily_classic_perfect_1.progress, 0);
  apply(classic, { sessionId: 'classic_perfect', correctCount: 20, totalCount: 20 });
  assert.equal(classic.missions.daily_classic_perfect_1.progress, 1);

  const timeattack = allMissions();
  apply(timeattack, { mode: 'timeattack', correctCount: 10, totalCount: 12, maxCombo: 24, finishReason: 'time_expired' });
  apply(timeattack, { sessionId: 'ta_2', mode: 'timeAttack', correctCount: 25, totalCount: 27, maxCombo: 25, finishReason: 'time_expired' });
  assert.equal(timeattack.missions.daily_timeattack_1.progress, 1);
  assert.equal(timeattack.missions.daily_timeattack_2.progress, 2);
  assert.equal(timeattack.missions.daily_combo_25.progress, 1);

  const adventure = allMissions();
  for (let run = 0; run < 5; run += 1) apply(adventure, { sessionId: `adv_${run}`, mode: 'adventure', success: true, stageNumber: 1, finishReason: 'stage_cleared' });
  assert.equal(adventure.missions.daily_adventure_3.progress, 3);
  assert.equal(adventure.missions.daily_adventure_5.progress, 5);
  assert.equal(adventure.missions.daily_boss_3.progress, 0);
  apply(adventure, { sessionId: 'boss_1', mode: 'adventure', success: true, stageNumber: 5, finishReason: 'stage_cleared' });
  apply(adventure, { sessionId: 'boss_2', mode: 'adventure', success: true, stageNumber: 10, finishReason: 'stage_cleared' });
  apply(adventure, { sessionId: 'boss_3', mode: 'adventure', success: true, stageNumber: 5, finishReason: 'stage_cleared' });
  assert.equal(adventure.missions.daily_boss_3.progress, 3);

  const rejected = allMissions();
  apply(rejected, { mode: 'adventure', success: false, correctCount: 10, totalCount: 10, stageNumber: 5, finishReason: 'stage_failed' });
  assert.equal(rejected.missions.daily_correct_20.progress, 0);
  assert.equal(rejected.missions.daily_adventure_3.progress, 0);
  assert.equal(rejected.missions.daily_boss_3.progress, 0);
  apply(rejected, { mode: 'adventure', success: true, correctCount: 10, totalCount: 10, stageNumber: 1, maxCombo: 25, finishReason: 'stage_cleared' });
  assert.equal(rejected.missions.daily_classic_perfect_1.progress, 0);
  assert.equal(rejected.missions.daily_combo_25.progress, 0);

  const today = service.getKoreaDateKey();
  persisted.dailyMissions = service.createDailyMissions(today, 'guest_test');
  assertSelection(persisted.dailyMissions);
  const premiumId = persisted.dailyMissions.activeMissionIds.find(id => config[id].reward.premiumTickets);
  const activeBeforeClaim = persisted.dailyMissions.activeMissionIds.slice();
  let result = service.claimMission(premiumId);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'incomplete');
  persisted.dailyMissions.missions[premiumId].progress = persisted.dailyMissions.missions[premiumId].target;
  persisted.dailyMissions.missions[premiumId].completed = true;
  result = service.claimMission(premiumId);
  assert.equal(result.ok, true);
  assert.equal(persisted.currency.premiumTickets, 1);
  assert.deepStrictEqual(persisted.dailyMissions.activeMissionIds, activeBeforeClaim);
  const currencyAfterClaim = clone(persisted.currency);
  result = service.claimMission(premiumId);
  assert.equal(result.reason, 'claimed');
  assert.deepStrictEqual(persisted.currency, currencyAfterClaim);

  const dailyBeforeUnknownClaim = clone(persisted.dailyMissions);
  result = service.claimMission('daily_unknown_mission');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing');
  assert.deepStrictEqual(persisted.currency, currencyAfterClaim);
  assert.deepStrictEqual(persisted.dailyMissions, dailyBeforeUnknownClaim);

  context = { type: 'authenticated', userId: 'auth_test' };
  let transactionCalls = 0;
  global.claimDailyMissionTransaction = () => new Promise(resolve => {
    transactionCalls += 1;
    setTimeout(() => resolve({ ok: true }), 10);
  });
  const clickResults = await Promise.all([service.claimMission(premiumId), service.claimMission(premiumId)]);
  assert.equal(transactionCalls, 1);
  assert.equal(clickResults[1].reason, 'busy');

  const app = fs.readFileSync('js/app.js', 'utf8');
  const duplicateIndex = app.indexOf('if (sessionDoc.exists)');
  const progressIndex = app.indexOf('applyDailyMissionProgress', duplicateIndex);
  assert(duplicateIndex >= 0 && progressIndex > duplicateIndex);
  assert(app.slice(duplicateIndex, progressIndex).includes('[DAILY MISSION DUPLICATE SESSION]'));
  const claimStart = app.indexOf('async function claimDailyMissionTransaction');
  const claimEnd = app.indexOf('function padValue', claimStart);
  const claimBody = app.slice(claimStart, claimEnd);
  assert(claimBody.includes('db.runTransaction'));
  assert(claimBody.includes('transaction.update(userRef'));
  assert(!claimBody.includes('transaction.set(userRef'));
  assert(claimBody.includes("'currency.coins'"));
  assert(claimBody.includes("'currency.normalTickets'"));
  assert(claimBody.includes("'currency.premiumTickets'"));
  assert(!claimBody.includes('currencySnapshot'));
  assert(!claimBody.includes('representativeCatId'));

  console.log(JSON.stringify({ passed: true, missionCount: 12, cases: [
    'premium_one_normal_two', 'deterministic_selection', 'family_deduplication',
    'legacy_contract_regenerated', 'all_twelve_targets_and_rewards',
    'correct_progress', 'classic_runs', 'timeattack_runs', 'adventure_runs',
    'stage_5_and_10_bosses', 'classic_perfect_only', 'timeattack_combo_only',
    'failed_games_rejected', 'processed_session_guard', 'claim_once', 'unknown_claim_rejected',
    'rapid_click_guard', 'canonical_currency_only'
  ] }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
