const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
global.GugudanV2 = {};
let save = {
  adventureProgress: {
    unlockedWorldIds: ['world_01'],
    unlockedStageIds: ['stage_01_01'],
    clearedStageIds: [],
    stageRecords: {},
    totalStars: 0,
    currentWorldId: 'world_01',
    currentStageId: 'stage_01_01'
  }
};
GugudanV2.storageService = {
  defaults: JSON.parse(JSON.stringify(save)),
  loadSaveData() { return JSON.parse(JSON.stringify(save)); },
  saveSaveData(next) { save = JSON.parse(JSON.stringify(next)); return true; }
};

['js/data/worlds.js', 'js/data/stages.js', 'js/services/adventureService.js'].forEach(file => {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
});

const service = GugudanV2.adventureService;
assert.strictEqual(GugudanV2.worlds.length, 8);
assert(GugudanV2.worlds.every(world => world.enabled && world.stageIds.length === 10));
assert.strictEqual(GugudanV2.stages.length, 80);
assert(GugudanV2.stages.filter(stage => stage.stageNumber === 5 || stage.stageNumber === 10).every(stage => stage.boss && stage.boss.image));

assert.strictEqual(service.getNextStageId('stage_03_09'), 'stage_03_10');
assert.strictEqual(service.getNextStageId('stage_03_10'), 'stage_04_01');
assert.strictEqual(service.getNextStageId('stage_04_10'), 'stage_05_01');
assert.strictEqual(service.getNextStageId('stage_05_10'), 'stage_06_01');
assert.strictEqual(service.getNextStageId('stage_06_10'), 'stage_07_01');
assert.strictEqual(service.getNextStageId('stage_07_10'), 'stage_08_01');
assert.strictEqual(service.getNextStageId('stage_08_10'), null);
assert.strictEqual(service.getStage('stage_03_11'), undefined);

const locked = service.normalizeProgress({ completedStageIds: ['stage_03_09'] });
assert(!locked.unlockedWorldIds.includes('world_04'));
const legacy = service.normalizeProgress({ completedStages: { '3-10': { cleared: true, bestStars: 3 } } });
assert(legacy.unlockedWorldIds.includes('world_04'));
assert(legacy.unlockedStageIds.includes('stage_04_01'));
assert.strictEqual(legacy.currentStageId, 'stage_04_01');
assert(legacy.stageRecords.stage_03_10.cleared);
assert(!legacy.unlockedWorldIds.includes('world_05'));

save.adventureProgress = legacy;
const reloaded = service.loadProgress();
assert(reloaded.unlockedWorldIds.includes('world_04'));
assert(reloaded.unlockedStageIds.includes('stage_04_01'));

const engine = fs.readFileSync('js/game/adventureEngine.js', 'utf8');
assert(engine.includes('v2.worlds.slice().sort'));
assert(engine.includes('button.dataset.stageId = stageId'));
assert(engine.includes('v2.adventureService.getNextStageId(stage)'));
assert(!engine.includes("'stage_' + String(stageOrder).padStart(2, '0') + '_' + String(stageNum + 1)"));

console.log(JSON.stringify({
  passed: true,
  worlds: GugudanV2.worlds.length,
  stages: GugudanV2.stages.length,
  transitions: ['3-9>3-10', '3-10>4-1', '4>5', '5>6', '6>7', '7>8', '8>complete'],
  legacyRecovery: true,
  reloadPersistence: true,
  stageButtonDelegation: true,
  noStage11: true
}, null, 2));
