const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
vm.runInThisContext(fs.readFileSync('js/services/levelProgressService.js', 'utf8'), { filename: 'levelProgressService.js' });
vm.runInThisContext(fs.readFileSync('js/services/rewardService.js', 'utf8'), { filename: 'rewardService.js' });

const rewards = GugudanV2.rewardService;
const playCoins = GugudanV2.levelProgressService.calculatePlayCoins;
function clear(stageNumber, previousBestStars, previousClaimedStars, currentStars, correctCount = 10, legacy = false) {
  return rewards.calculateAdventureClearRewards({
    stage: { id: `stage_01_${String(stageNumber).padStart(2, '0')}`, stageNumber },
    success: true,
    correctCount,
    previousBestStars,
    previousClaimedStars,
    currentStars,
    isLegacyCompletedStage: legacy
  });
}

const normalNew = clear(1, 0, 0, 3);
assert.deepStrictEqual(normalNew.rewardTotals, { coins: 100, normalTickets: 0, premiumTickets: 0 });
assert.equal(normalNew.sessionPoints, 100);
assert.deepStrictEqual(normalNew.newlyEarnedStarLevels, [1, 2, 3]);
assert.equal(playCoins('adventure', 0, true), 0);
assert.equal(playCoins('adventure', 40, true), 20);
assert.equal(playCoins('adventure', 80, true), 40);
assert.equal(playCoins('adventure', 100, true), 50);
assert.equal(playCoins('adventure', 100, false), 0);
assert.equal(playCoins('classic', 100, true), 50);
assert.equal(playCoins('timeAttack', 100, true), 50);
assert.equal(playCoins('divisionExact', 100, true), 50);
assert.equal(playCoins('divisionRemainder', 100, true), 50);
assert.equal(playCoins('adventure', normalNew.sessionPoints, true) + normalNew.rewardTotals.coins, 150);

const normalUpgrade = clear(1, 1, 1, 3);
assert.deepStrictEqual(normalUpgrade.rewardTotals, { coins: 80, normalTickets: 0, premiumTickets: 0 });
assert.deepStrictEqual(normalUpgrade.newlyEarnedStarLevels, [2, 3]);

const sameStars = clear(1, 3, 3, 3);
assert.deepStrictEqual(sameStars.rewardTotals, { coins: 0, normalTickets: 0, premiumTickets: 0 });
assert.deepStrictEqual(sameStars.newlyEarnedStarLevels, []);
assert.equal(playCoins('adventure', 80, true) + sameStars.rewardTotals.coins, 40);

const lowerStars = clear(1, 3, 3, 2);
assert.equal(lowerStars.nextBestStars, 3);
assert.equal(lowerStars.nextClaimedStars, 3);
assert.deepStrictEqual(lowerStars.starRewards, []);

const midBossNew = clear(5, 0, 0, 3);
assert.deepStrictEqual(midBossNew.rewardTotals, { coins: 80, normalTickets: 1, premiumTickets: 0 });
assert.equal(playCoins('adventure', midBossNew.sessionPoints, true) + midBossNew.rewardTotals.coins, 130);
const finalBossNew = clear(10, 0, 0, 3);
assert.deepStrictEqual(finalBossNew.rewardTotals, { coins: 50, normalTickets: 1, premiumTickets: 1 });
assert.equal(playCoins('adventure', finalBossNew.sessionPoints, true) + finalBossNew.rewardTotals.coins, 100);
const finalBossUpgrade = clear(10, 2, 2, 3);
assert.deepStrictEqual(finalBossUpgrade.rewardTotals, { coins: 0, normalTickets: 0, premiumTickets: 1 });

const legacyWithStars = clear(1, 2, 2, 3);
assert.deepStrictEqual(legacyWithStars.newlyEarnedStarLevels, [3]);
const legacyWithoutStars = clear(1, 0, 3, 3, 10, true);
assert.deepStrictEqual(legacyWithoutStars.starRewards, []);
assert.equal(legacyWithoutStars.rewardTotals.coins, 0);

const failed = rewards.calculateAdventureClearRewards({ success: false, previousBestStars: 2, previousClaimedStars: 2 });
assert.equal(failed.sessionPoints, 0);
assert.deepStrictEqual(failed.rewardTotals, { coins: 0, normalTickets: 0, premiumTickets: 0 });
assert.equal(failed.nextBestStars, 2);
assert.equal(failed.nextClaimedStars, 2);

const appSource = fs.readFileSync('js/app.js', 'utf8');
assert.match(appSource, /calculateAdventureClearRewards\(/, 'authenticated and guest saves must share the reward service');
assert.match(appSource, /claimed\[stageId\] = previousBestStars \|\| currentStars/, 'authenticated legacy clears must establish a no-backpay baseline');
assert.match(appSource, /claimed\[result\.stageId\] = Number\(previous\.bestStars\) \|\| stars/, 'guest legacy clears must establish a no-backpay baseline');
assert.match(appSource, /processed\.includes\(result\.sessionId\)/, 'guest saves must guard processed session ids');
assert.match(appSource, /calculatePlayCoins\('adventure', reward\.sessionPoints, true\)/, 'guest adventure must use the canonical play coin calculator');
assert.match(appSource, /playCoins = v2\.levelProgressService\.calculatePlayCoins\(mode, sessionPoints, success\)/, 'authenticated adventure must use the canonical play coin calculator');

console.log(JSON.stringify({
  passed: true,
  cases: [
    'normal_new_three_stars', 'normal_one_to_three', 'same_or_lower_star_no_repeat',
    'midboss_ticket_contract', 'finalboss_ticket_contract', 'legacy_no_backpay',
    'failure_zero', 'all_mode_play_coin_contract', 'shared_transaction_and_guest_contract', 'guest_session_guard'
  ]
}));
