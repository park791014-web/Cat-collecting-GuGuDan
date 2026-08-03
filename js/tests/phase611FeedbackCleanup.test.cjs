const fs = require('fs');
const assert = require('assert');

const shell = fs.readFileSync('js/ui/portraitGameShell.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const mode = fs.readFileSync('js/game/modeEngine.js', 'utf8');
const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const css = fs.readFileSync('css/phase61.css', 'utf8');

assert.match(shell, /function setGameAnswerFeedback\(kind, message\)/);
assert.match(shell, /game-answer-feedback is-/);
assert.match(app, /setGameAnswerFeedback\('correct'/);
assert.match(app, /setGameAnswerFeedback\('wrong'/);
assert.match(mode, /function showModeFeedback\(kind, message\)/);
assert.match(adventure, /function showAdventureFeedback\(kind, message\)/);
assert.match(css, /#feedback\.game-answer-feedback/);
assert.match(css, /font-size:clamp\(23px,6\.5vw,28px\)!important/);
assert.match(app, /function showLobby\(\)[\s\S]*clearQuestionUI\(\)[\s\S]*clearResultUI\(\)[\s\S]*clearPortraitGameShell/);
assert.match(app, /effectLayer\.replaceChildren\(\)/);
assert.match(app, /adventureActions\.replaceChildren\(\)/);
assert.doesNotMatch(shell, /correct-particle|effect-particle/);

console.log(JSON.stringify({
  passed: true,
  cases: ['shared-feedback-class', 'story-no-10px-fallback', 'lobby-cleans-game-state', 'effects-unchanged']
}));
