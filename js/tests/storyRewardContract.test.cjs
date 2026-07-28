const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let save = {
  currency: { coins: 0, normalTickets: 0, premiumTickets: 0 },
  rewardHistory: { rewardedSessionIds: [], firstClearStageIds: [], rewardedStarMilestones: {} }
};

const context = {
  console,
  window: {
    GugudanV2: {
      storageService: {
        loadSaveData: () => clone(save),
        saveSaveData: next => { save = clone(next); return true; }
      }
    }
  }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/config/rewardConfig.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/services/rewardService.js', 'utf8'), context);

const service = context.window.GugudanV2.rewardService;

function claim(sessionId, stageNumber) {
  return service.claimStageRewards({
    sessionId,
    stage: { id: `stage_01_${String(stageNumber).padStart(2, '0')}`, stageNumber },
    cleared: true,
    stars: 3
  });
}

let result = claim('normal_first', 1);
assert.deepStrictEqual(clone(result.reward), { coins: 20, normalTickets: 0, premiumTickets: 0, starCoins: 0, firstClear: true, label: '최초 클리어 보상' });
result = claim('normal_repeat', 1);
assert.deepStrictEqual(clone(result.reward), { coins: 20, normalTickets: 0, premiumTickets: 0, starCoins: 0, firstClear: false, label: '반복 클리어 보상' });

result = claim('mid_first', 5);
assert.deepStrictEqual(clone(result.reward), { coins: 0, normalTickets: 1, premiumTickets: 0, starCoins: 0, firstClear: true, label: '최초 클리어 보상' });
result = claim('mid_repeat', 5);
assert.deepStrictEqual(clone(result.reward), { coins: 20, normalTickets: 0, premiumTickets: 0, starCoins: 0, firstClear: false, label: '반복 클리어 보상' });

result = claim('final_first', 10);
assert.deepStrictEqual(clone(result.reward), { coins: 0, normalTickets: 0, premiumTickets: 1, starCoins: 0, firstClear: true, label: '최초 클리어 보상' });
const currencyAfterFinal = clone(save.currency);
result = claim('final_first', 10);
assert.equal(result.ok, false);
assert.equal(result.reason, 'already_claimed');
assert.deepStrictEqual(save.currency, currencyAfterFinal);
result = claim('final_repeat', 10);
assert.deepStrictEqual(clone(result.reward), { coins: 20, normalTickets: 0, premiumTickets: 0, starCoins: 0, firstClear: false, label: '반복 클리어 보상' });

const app = fs.readFileSync('js/app.js', 'utf8');
const saveStart = app.indexOf('async function saveFinalGameResult');
const saveEnd = app.indexOf('function displayResultScreen', saveStart);
const saveBody = app.slice(saveStart, saveEnd);
assert(saveBody.includes('v2.rewardService.calculateStageRewards'));
assert(saveBody.includes('previouslyCompleted'));
assert(saveBody.includes("userData.adventure.firstClearRewards[stageId] = true"));
assert(!saveBody.includes('coinsReward += 100 + (correctCount * 15)'));
assert(!saveBody.includes('coinsReward += correctCount * 5'));
assert(saveBody.indexOf('if (sessionDoc.exists)') < saveBody.indexOf('calculateStageRewards'));

const engine = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const resultStart = engine.indexOf('function showAdventureResultUI');
const resultEnd = engine.indexOf('global.showAdventureResultUI', resultStart);
const resultBody = engine.slice(resultStart, resultEnd);
assert(resultBody.includes('savedResult.adventureReward'));
assert(resultBody.includes('savedResult.levelRewardPremiumTickets'));
assert(!resultBody.includes("modeRewardService.claim('adventure'"));

console.log(JSON.stringify({
  passed: true,
  cases: [
    'normal_first_20_coins',
    'normal_repeat_20_coins',
    'midboss_first_normal_ticket_only',
    'midboss_repeat_20_coins',
    'finalboss_first_premium_ticket_only',
    'finalboss_repeat_20_coins',
    'duplicate_session_rejected',
    'legacy_completed_stage_not_first_clear',
    'level_reward_displayed_separately',
    'server_reward_rendered_without_play_reward'
  ]
}, null, 2));
