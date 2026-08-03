const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const shell = fs.readFileSync('js/ui/portraitGameShell.js', 'utf8');
const css = fs.readFileSync('css/phase61.css', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const mode = fs.readFileSync('js/game/modeEngine.js', 'utf8');
const adventure = fs.readFileSync('js/game/adventureEngine.js', 'utf8');

assert.match(html, /class="portrait-game-shell"/);
['game-hud', 'game-status-panel', 'game-visual-stage', 'game-question-card', 'game-answer-panel', 'game-feedback-panel'].forEach((className) => {
  assert.match(html, new RegExp('class="' + className + '"'));
});
['q-counter', 'current-accuracy', 'live-points', 'mode-status', 'skill-hud', 'boss-panel', 'question', 'options-container', 'feedback'].forEach((id) => {
  assert.match(html, new RegExp('id="' + id + '"'));
});

assert.match(shell, /function renderGameShell\(options\)/);
assert.match(shell, /showBossHp/);
assert.match(shell, /enemyImage/);
assert.match(shell, /bossMaxHp/);
assert.match(app, /renderGameShell\(\{[\s\S]*mode: 'classic'/);
assert.match(mode, /renderGameShell\(\{[\s\S]*mode: mode/);
assert.match(adventure, /renderGameShell\(\{[\s\S]*mode: 'adventure'/);
assert.match(adventure, /bossPanel\.style\.display = bossUiVisible \? '' : 'none'/);

assert.match(css, /width:min\(100%,520px\)/);
assert.match(css, /100dvh/);
assert.match(css, /object-fit:contain/);
assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
assert.match(css, /\.portrait-game-shell \.boss-image\{position:static!important/);

console.log(JSON.stringify({
  passed: true,
  shell: 'portrait-game-shell',
  modes: ['classic', 'timeAttack', 'adventure-normal', 'adventure-midBoss', 'adventure-finalBoss']
}));
