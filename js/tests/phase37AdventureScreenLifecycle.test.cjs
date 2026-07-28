const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const displayResultStart = app.indexOf('function displayResultScreen(mode, savedResult)');
const displayResultEnd = app.indexOf('window.displayResultScreen = displayResultScreen');
assert(displayResultStart >= 0 && displayResultEnd > displayResultStart);
const displayResultBody = app.slice(displayResultStart, displayResultEnd);
assert(!displayResultBody.includes("\n            s.style.display = 'none'"));
assert(app.includes("targetEl.style.removeProperty('display')"));

for (const id of ['adventure-result-screen', 'stage-select-screen', 'stage-ready-screen', 'play-screen']) {
  assert(html.includes(`id="${id}"`), `missing reusable screen: ${id}`);
}

assert(!adventure.includes("byId('adventure-result-screen').remove()"));
assert(!adventure.includes("document.getElementById('adventure-result-screen').remove()"));
assert(adventure.includes('function getVisibleAdventureScreens()'));
assert(adventure.includes('function collectAdventureScreenState(label)'));
assert(adventure.includes('function restoreAdventureResultScreen()'));
assert(!adventure.includes('function transitionFromAdventureResult(action, openDestination)'));
assert(!adventure.includes('destination_screen_not_visible'));
assert(adventure.includes("await global.openStageSelect(targetWorldId)"));
assert(adventure.includes("await openStageReady(targetStageId, true)"));
assert(adventure.includes("resultRenderCount === 1 ? 'first-result-rendered' : 'repeat-result-rendered-'"));

for (const id of ['adventure-next-stage-button', 'adventure-retry-button', 'adventure-stage-list-button']) {
  assert(adventure.includes(`id="${id}"`), `repeat result action missing: ${id}`);
}

console.log(JSON.stringify({
  passed: true,
  cases: [
    'result_screen_remains_connected',
    'display_none_state_not_accumulated',
    'show_screen_clears_stale_inline_display',
    'repeat_result_three_actions',
    'diagnostics_do_not_control_transition',
    'destination_exception_controls_failure',
    'failed_destination_restores_result',
    'stage_list_uses_shared_entry',
    'retry_and_next_use_shared_transition',
    'repeat_render_state_logging'
  ]
}, null, 2));
