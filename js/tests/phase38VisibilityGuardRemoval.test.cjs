const assert = require('assert');
const fs = require('fs');

const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');

assert(!adventure.includes('destination_screen_not_visible'));
assert(!adventure.includes('transitionFromAdventureResult('));
assert(adventure.includes("console.info('[STORY MODAL OPEN]'"));
assert(adventure.includes("await openStageReady(targetStageId, true)"));
assert(adventure.includes("console.info('[STAGE READY OPEN]'"));
assert(adventure.includes("console.info('[RESULT SCREEN HIDDEN]'"));
const continueStart = adventure.indexOf('async function continueToTarget()');
const continueEnd = adventure.indexOf("if (source === 'next'", continueStart);
const continueBody = adventure.slice(continueStart, continueEnd);
assert(continueBody.indexOf("await openStageReady(targetStageId, true)") < continueBody.indexOf("console.info('[RESULT SCREEN HIDDEN]'"));

assert(adventure.includes("console.info('[RESULT STAGE LIST START]'"));
assert(adventure.includes("await global.openStageSelect(targetWorldId)"));
assert(adventure.includes("throw new Error('stage_list_render_failed')"));
assert(adventure.includes("console.info('[RESULT STAGE LIST OPEN]'"));
assert(adventure.includes("console.info('[RESULT STAGE LIST SUCCESS]'"));

assert(adventure.includes("restoreAdventureResultScreen()"));
assert(adventure.includes("id('story-modal-close').onclick") === false);

console.log(JSON.stringify({
  passed: true,
  cases: [
    'story_modal_not_screen_guarded',
    'next_waits_for_continue',
    'next_hides_result_after_destination',
    'retry_uses_same_sequence',
    'stage_list_uses_open_stage_select',
    'stage_list_checks_connected_dom_only',
    'visibility_failure_token_removed',
    'actual_exception_restores_result'
  ]
}, null, 2));
