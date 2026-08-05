const assert = require('assert');
const fs = require('fs');

const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const story = fs.readFileSync('js/services/adventureStoryService.js', 'utf8');
const runtime = fs.readFileSync('js/ui/phase56Runtime.js', 'utf8');

assert(!story.includes('story-modal-skip'));
assert(!story.includes('allowSkip'));
assert(story.includes("id('story-modal-close').onclick = function () { close(false); }"));
assert(story.includes("id('story-modal-action').onclick = function () { close(true); }"));

assert(adventure.includes('id="adventure-stage-list-button"'));
assert(adventure.includes("byId('adventure-stage-list-button').onclick = returnToAdventureStageList"));
assert(adventure.includes("await global.openStageSelect(targetWorldId)"));
assert(adventure.includes("throw new Error('stage_list_render_failed')"));
assert(adventure.includes("global.showScreen('adventure-result-screen')"));

assert(adventure.includes("openResultStory(nextStageIdStr, 'next')"));
assert(adventure.includes("openResultStory(resultStage.id, 'retry')"));
assert(adventure.includes("openStageReady(targetStageId, true)"));
assert(adventure.includes("nextStage ? '다음 월드로' : '스토리 완료'"));
assert(adventure.includes('handleNextWorldStoryFromResult(resultStage)'));
assert(adventure.includes('showClearStory(currentStage, continueAfterWorld'));

assert(!runtime.includes('renderResultButtons'));
assert(!runtime.includes("document.getElementById('adventure-result-actions')"));

console.log(JSON.stringify({
  passed: true,
  cases: [
    'story_close_does_not_continue',
    'story_skip_removed',
    'story_continue_single_callback',
    'stage_list_direct_binding',
    'stage_list_failure_keeps_result',
    'next_and_retry_story_flow',
    'world_ending_existing_story_flow',
    'phase56_result_override_removed'
  ]
}, null, 2));
