const assert = require('assert');
const fs = require('fs');

const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const story = fs.readFileSync('js/services/adventureStoryService.js', 'utf8');

function bodyBetween(start, end) {
  const from = adventure.indexOf(start);
  const to = adventure.indexOf(end, from);
  assert(from >= 0 && to > from, `missing section: ${start}`);
  return adventure.slice(from, to);
}

const resultBody = bodyBetween('function showAdventureResultUI(session)', 'global.showAdventureResultUI');
const endingBody = bodyBetween('function handleNextWorldStoryFromResult(currentStage)', 'function question()');
const nextWorldListBody = bodyBetween('async function openNextWorldStageList(nextWorldNumber)', 'function handleNextWorldStoryFromResult');

assert(!resultBody.includes('setTimeout(function () {\n        try { v2.adventureStoryService.showClearStory(stage); }'));
assert(resultBody.includes("stageOrder < 8 ? '다음 이야기' : '모험 완료'"));
assert(resultBody.includes("if (stageNum === 10) return handleNextWorldStoryFromResult(resultStage)"));
assert(endingBody.includes("console.info('[WORLD ENDING STORY START]'"));
assert(endingBody.includes("console.info('[WORLD ENDING STORY OPEN]'"));
assert(endingBody.includes('showClearStory(currentStage, async function ()'));
assert(endingBody.includes("console.info('[WORLD ENDING STORY CONTINUE]'"));
assert(endingBody.includes("console.info('[WORLD ENDING STORY CLOSE]'"));
assert(endingBody.includes('currentWorldNumber < 8 ? currentWorldNumber + 1 : currentWorldNumber'));
assert(!endingBody.includes('showWorldIntro'));
assert(!endingBody.includes('openStageReady'));
assert(!endingBody.includes('showAdventureResult'));
assert(!endingBody.includes('saveFinalGameResult'));
assert(!endingBody.includes('world_09'));
assert(nextWorldListBody.includes("await openStageSelect(nextWorldId, { skipWorldIntro: true })"));
assert(nextWorldListBody.includes("if (global.refreshCurrentUserData) await global.refreshCurrentUserData({ renderLobby: false })"));
assert(nextWorldListBody.includes('global.clearResultUI && global.clearResultUI()'));
assert(!nextWorldListBody.includes('openStageReady'));
assert(!nextWorldListBody.includes('showLobby'));
assert(!nextWorldListBody.includes('restoreAdventureResultScreen'));
assert(adventure.includes('if (v2.adventureStoryService && !options.skipWorldIntro) v2.adventureStoryService.showWorldIntro(world)'));
assert(story.includes("onDismiss = typeof options.onDismiss === 'function' ? options.onDismiss : null"));
assert(story.includes('else if (!continueFlow && dismissCallback) dismissCallback()'));
assert(story.includes('function clearStory(stage, after, dismissed, force)'));

console.log(JSON.stringify({
  passed: true,
  cases: [
    'result_does_not_auto_open_clear_story',
    'world_1_to_7_button_is_next_story',
    'world_8_button_is_adventure_complete',
    'current_world_ending_story_is_used',
    'continue_opens_next_world_list',
    'next_world_intro_is_suppressed',
    'continue_does_not_start_stage',
    'continue_does_not_restore_or_rerender_result',
    'dismiss_keeps_existing_result',
    'final_world_never_constructs_world_09',
    'result_is_not_saved_again'
  ]
}, null, 2));
