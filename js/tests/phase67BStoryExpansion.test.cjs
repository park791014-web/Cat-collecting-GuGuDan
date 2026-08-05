const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
global.GugudanV2 = {};

class Element {
  constructor(id) { this.id = id || ''; this.hidden = false; this.children = []; this.style = {}; this.className = ''; this.textContent = ''; }
  set innerHTML(value) {
    this._html = value;
    this.children = [];
    const pattern = /id="([^"]+)"/g;
    let match;
    while ((match = pattern.exec(value || ''))) elements[match[1]] = new Element(match[1]);
  }
  get innerHTML() { return this._html || ''; }
  appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; }
  addEventListener() {}
  focus() {}
}

const elements = {};
global.document = {
  activeElement: null,
  body: new Element('body'),
  getElementById(id) { return elements[id] || null; },
  createElement() { return new Element(); }
};

let save = { settings: {}, adventureProgress: {}, adventureStory: null };
GugudanV2.storageService = {
  defaults: { adventureProgress: {} },
  loadSaveData() { return JSON.parse(JSON.stringify(save)); },
  saveSaveData(value) { save = JSON.parse(JSON.stringify(value)); return true; }
};
GugudanV2.assetLoader = { applyImageFallback() {} };

[
  'js/data/cats.js',
  'js/data/worlds.js',
  'js/data/stages.js',
  'js/data/adventureStoryData.js',
  'js/services/adventureService.js',
  'js/services/adventureStoryService.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));

const v2 = GugudanV2;
const service = v2.adventureStoryService;
const engineSource = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
const characterIds = new Set(v2.baseCats.map(cat => cat.id));
const sparseStoryStages = [1, 4, 9];
const ordinaryStages = [2, 3, 6, 7, 8];

[4, 5, 6, 7, 8].forEach(worldNumber => {
  const worldId = `world_${String(worldNumber).padStart(2, '0')}`;
  const world = v2.adventureService.getWorld(worldId);
  assert(world.storyIntro, `${worldId} intro missing`);
  assert(characterIds.has(world.storyIntro.characterId), `${worldId} character missing`);
  sparseStoryStages.forEach(stageNumber => {
    const stage = v2.adventureService.getStage(`stage_${String(worldNumber).padStart(2, '0')}_${String(stageNumber).padStart(2, '0')}`);
    assert(stage.storyIntro, `${stage.id} story missing`);
    assert(characterIds.has(stage.storyIntro.characterId), `${stage.id} character missing`);
  });
  ordinaryStages.forEach(stageNumber => {
    const stage = v2.adventureService.getStage(`stage_${String(worldNumber).padStart(2, '0')}_${String(stageNumber).padStart(2, '0')}`);
    assert.strictEqual(stage.storyIntro, undefined, `${stage.id} must start without forced story`);
  });
  [5, 10].forEach(stageNumber => {
    const stage = v2.adventureService.getStage(`stage_${String(worldNumber).padStart(2, '0')}_${String(stageNumber).padStart(2, '0')}`);
    assert(stage.bossIntro, `${stage.id} boss story missing`);
  });
  assert(v2.adventureService.getStage(`stage_${String(worldNumber).padStart(2, '0')}_10`).clearStory, `${worldId} clear story missing`);
});

assert.equal(v2.worlds.filter(world => world.storyIntro).length, 8);
assert.equal(v2.stages.filter(stage => stage.storyIntro).length, 45);
assert.equal(v2.stages.filter(stage => stage.bossIntro).length, 16);
assert.equal(v2.stages.filter(stage => stage.clearStory).length, 8);
assert.strictEqual(v2.worlds[0].storyIntro.title, '월드 1 · 고양이 초원');
assert(v2.adventureService.getWorld('world_05').storyIntro.title.includes('얼음 왕국'));
assert(v2.adventureService.getWorld('world_06').storyIntro.title.includes('기계 도시'));
assert(v2.adventureService.getWorld('world_07').storyIntro.title.includes('별빛 우주'));
assert(v2.adventureService.getWorld('world_08').storyIntro.title.includes('마왕의 성'));
assert.strictEqual(v2.adventureService.getStage('stage_03_10').clearStory.title, '장난감 숲의 보석 조각');
assert.strictEqual(v2.adventureService.getNextStageId('stage_03_10'), 'stage_04_01');
assert.strictEqual(v2.adventureService.getNextStageId('stage_08_10'), null);
assert.strictEqual(v2.adventureService.getStage('stage_08_10').clearStory.title, '구구단의 힘이 돌아오다');
assert(service.validateAdventureStoryMappings().valid);
assert(engineSource.includes("['localhost', '127.0.0.1'].indexOf(global.location.hostname) < 0"));
assert(engineSource.includes("new URLSearchParams(global.location.search || '').get('adventureFixture')"));
assert(engineSource.includes('v2.adventureStoryService.showStageIntro(stage, function () {\n          startAdventureStage(false);'));

let starts = 0;
const stage41 = v2.adventureService.getStage('stage_04_01');
assert.strictEqual(service.showStageIntro(stage41, () => { starts += 1; }), true);
assert.strictEqual(elements['story-modal-visual'].children[0].src, 'assets/cats/base/base_hero_04-transparent.png');
elements['story-modal-action'].onclick();
assert.strictEqual(service.showStageIntro(stage41, () => { starts += 1; }), false);
assert.strictEqual(starts, 2);

let bossStarts = 0;
const stage45 = v2.adventureService.getStage('stage_04_05');
assert.strictEqual(service.showBossIntro(stage45, () => { bossStarts += 1; }), true);
elements['story-modal-action'].onclick();
assert.strictEqual(service.showBossIntro(stage45, () => { bossStarts += 1; }), false);
assert.strictEqual(bossStarts, 2);

let clearContinues = 0;
const stage410 = v2.adventureService.getStage('stage_04_10');
assert.strictEqual(service.showClearStory(stage410, () => { clearContinues += 1; }), true);
elements['story-modal-action'].onclick();
assert.strictEqual(service.showClearStory(stage410, () => { clearContinues += 1; }), false);
assert.strictEqual(clearContinues, 2);

console.log(JSON.stringify({
  passed: true,
  worldStories: 8,
  stageStories: 45,
  bossStories: 16,
  clearStories: 8,
  sparseWorld4To8: true,
  catalogCharacters: true,
  repeatPrevention: true,
  finalEnding: true,
  progressionPreserved: true
}, null, 2));
