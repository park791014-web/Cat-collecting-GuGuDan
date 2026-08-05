const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
['js/data/worlds.js', 'js/data/stages.js'].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));
const before = Object.fromEntries(GugudanV2.stages.map(stage => [stage.id, {
  questions: stage.rules.questionCount,
  hp: stage.boss && stage.boss.maximumHp,
  type: stage.type
}]));
vm.runInThisContext(fs.readFileSync('js/data/adventureStoryData.js', 'utf8'), { filename: 'adventureStoryData.js' });

const v2 = GugudanV2;
const enabled = v2.worlds.filter(world => world.enabled);
const storyStages = v2.stages.filter(stage => stage.storyIntro);
const bossStories = v2.stages.filter(stage => stage.bossIntro);
const clearStories = v2.stages.filter(stage => stage.clearStory);
assert.equal(enabled.length, 8);
assert.equal(enabled.filter(world => world.storyIntro).length, 8);
assert.equal(storyStages.length, 45);
assert.equal(bossStories.length, 16);
assert.equal(clearStories.length, 8);
v2.stages.forEach(stage => {
  assert.equal(stage.rules.questionCount, before[stage.id].questions);
  assert.equal(stage.boss && stage.boss.maximumHp, before[stage.id].hp);
  assert.equal(stage.type, before[stage.id].type);
  if (stage.chapter <= 3) assert(stage.storyIntro.buttonText);
});
[5, 10].forEach(number => [1, 2, 3].forEach(world => {
  assert(v2.stages.find(stage => stage.id === `stage_0${world}_${String(number).padStart(2, '0')}`).bossIntro);
}));

console.log(JSON.stringify({
  passed: true,
  enabledWorlds: 8,
  worldIntros: 8,
  stageIntros: storyStages.length,
  bossIntros: bossStories.length,
  clearStories: clearStories.length,
  gameplaySettingsPreserved: true,
  idFormat: 'stage_01_01'
}, null, 2));
