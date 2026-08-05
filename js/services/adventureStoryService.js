(function (global) {
  'use strict';
  var v2 = global.GugudanV2, lastFocus = null, active = false, onClose = null, onDismiss = null;
  function id(value) { return document.getElementById(value); }
  function ensureProgress(save) {
    save.adventureStory = save.adventureStory || { prologueSeen: false, seenWorldIntros: {}, seenStageIntros: {}, seenBossIntros: {}, seenClearStories: {} };
    save.adventureStory.seenWorldIntros = save.adventureStory.seenWorldIntros || {};
    save.adventureStory.seenStageIntros = save.adventureStory.seenStageIntros || {};
    save.adventureStory.seenBossIntros = save.adventureStory.seenBossIntros || {};
    save.adventureStory.seenClearStories = save.adventureStory.seenClearStories || {};
    return save.adventureStory;
  }
  function storyCat(data) { return data && data.characterId ? [].concat(v2.baseCats || [], v2.seasonCats || []).find(function (cat) { return cat.id === data.characterId; }) : null; }
  function storyVisual(data, fallbackImage, fallbackAlt) { var cat = storyCat(data); return { image: cat ? cat.image : fallbackImage, imageAlt: cat ? cat.displayName : fallbackAlt, fallbackImage: cat && cat.fallbackImage }; }
  function ensureModal() {
    if (id('adventure-story-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'adventure-story-modal'; modal.className = 'story-modal'; modal.hidden = true;
    modal.innerHTML = '<section class="story-panel" role="dialog" aria-modal="true" aria-labelledby="story-modal-title"><button id="story-modal-close" class="story-close" type="button" aria-label="이야기 닫기">×</button><p id="story-modal-eyebrow" class="story-eyebrow"></p><div id="story-modal-visual" class="story-visual"></div><h2 id="story-modal-title"></h2><p id="story-modal-description" class="story-description"></p><blockquote><strong id="story-modal-speaker"></strong><p id="story-modal-dialogue"></p></blockquote><div class="story-actions"><button id="story-modal-action" class="game-button primary" type="button"></button></div></section>';
    document.body.appendChild(modal);
    id('story-modal-close').onclick = function () { close(false); };
    modal.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); close(false); } });
  }
  function close(continueFlow) {
    if (!active) return;
    var callback = onClose, dismissCallback = onDismiss; active = false; onClose = null; onDismiss = null; id('adventure-story-modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (continueFlow && callback) callback();
    else if (!continueFlow && dismissCallback) dismissCallback();
  }
  function show(data, options, callback) {
    if (!data) { if (callback) callback(); return false; }
    ensureModal(); if (active) return false; options = options || {}; active = true; lastFocus = document.activeElement; onClose = callback || null; onDismiss = typeof options.onDismiss === 'function' ? options.onDismiss : null;
    id('story-modal-eyebrow').textContent = options.eyebrow || '구구단 대모험';
    id('story-modal-title').textContent = data.title || '새로운 이야기';
    id('story-modal-description').textContent = data.description || '';
    id('story-modal-speaker').textContent = data.speaker || options.speaker || '대장 고양이';
    id('story-modal-dialogue').textContent = data.dialogue || '';
    id('story-modal-action').textContent = data.buttonText || options.buttonText || '계속';
    var visual = id('story-modal-visual'); visual.innerHTML = '';
    if (options.image) { var image = document.createElement('img'); image.src = options.image; image.alt = options.imageAlt || ''; visual.appendChild(image); if (v2.assetLoader) v2.assetLoader.applyImageFallback(image, options.fallbackImage || 'assets/placeholders/adventure-placeholder.svg'); }
    id('story-modal-action').onclick = function () { close(true); };
    id('adventure-story-modal').hidden = false; setTimeout(function () { id('story-modal-action').focus(); }, 0); return true;
  }
  function mark(mutator) { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); mutator(progress); v2.storageService.saveSaveData(save); }
  function prologue() { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (progress.prologueSeen) return false; return show(v2.adventureStoryConfig.prologue, { eyebrow: '모험의 시작' }, function () { mark(function (value) { value.prologueSeen = true; }); }); }
  function worldIntro(world, after) { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (!world || !world.storyIntro || progress.seenWorldIntros[world.id]) { if (after) after(); return false; } return show(world.storyIntro, Object.assign({ eyebrow: 'WORLD ' + world.order }, storyVisual(world.storyIntro, world.artwork && world.artwork.thumbnail, world.title)), function () { mark(function (value) { value.seenWorldIntros[world.id] = true; }); if (after) after(); }); }
  function stageIntro(stage, start) {
    if (!stage || !stage.storyIntro) { if (start) start(); return false; }
    var save = v2.storageService.loadSaveData(), progress = ensureProgress(save), replay = save.settings && save.settings.alwaysShowStageStory;
    if (progress.seenStageIntros[stage.id] && !replay) { if (start) start(); return false; }
    return show(stage.storyIntro, Object.assign({ eyebrow: 'STAGE ' + stage.displayNumber, buttonText: '도전하기' }, storyVisual(stage.storyIntro)), function () { mark(function (value) { value.seenStageIntros[stage.id] = true; }); if (start) start(); });
  }
  function bossIntro(stage, start) { if (!stage || !stage.bossIntro) { start(); return false; } var save = v2.storageService.loadSaveData(), progress = ensureProgress(save), replay = save.settings && save.settings.alwaysShowStageStory; if (progress.seenBossIntros[stage.id] && !replay) { start(); return false; } var data = { title: stage.bossIntro.bossName, description: stage.bossIntro.entranceText, speaker: stage.bossIntro.bossName, dialogue: stage.bossIntro.dialogue, buttonText: '보스전 시작', characterId: stage.bossIntro.characterId || null }; return show(data, Object.assign({ eyebrow: '⚔ 보스 등장' }, storyVisual(data, stage.boss && stage.boss.image, stage.bossIntro.bossName)), function () { mark(function (value) { value.seenBossIntros[stage.id] = true; }); start(); }); }
  function clearStory(stage, after, dismissed, force) { if (!stage || !stage.clearStory) { if (after) after(); return false; } var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (progress.seenClearStories[stage.worldId] && !force) { if (after) after(); return false; } return show(stage.clearStory, Object.assign({ eyebrow: '보석 조각 발견', onDismiss: dismissed }, storyVisual(stage.clearStory)), function () { mark(function (value) { value.seenClearStories[stage.worldId] = true; }); if (after) after(); }); }
  function validate() { var errors = []; (v2.worlds || []).filter(function (world) { return world.enabled; }).forEach(function (world) { if (!world.storyIntro) errors.push(world.id + ':intro'); var requiredStories = world.order <= 3 ? world.stageIds.map(function (_, index) { return index; }) : [0, 3, 8]; world.stageIds.forEach(function (stageId, index) { var stage = v2.adventureService.getStage(stageId); if (requiredStories.indexOf(index) >= 0 && (!stage || !stage.storyIntro)) errors.push(stageId + ':story'); if ((index === 4 || index === 9) && (!stage || !stage.bossIntro)) errors.push(stageId + ':boss'); if (index === 9 && (!stage || !stage.clearStory)) errors.push(stageId + ':clear'); }); }); if (errors.length) console.error('[Story Mapping Missing]', errors); return { valid: !errors.length, errors: errors }; }
  function reset() { var save = v2.storageService.loadSaveData(); delete save.adventureStory; v2.storageService.saveSaveData(save); return ensureProgress(save); }
  v2.adventureStoryService = { show: show, showPrologue: prologue, showWorldIntro: worldIntro, showStageIntro: stageIntro, showBossIntro: bossIntro, showClearStory: clearStory, ensureProgress: ensureProgress, validateAdventureStoryMappings: validate, resetForTesting: reset };
  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, { previewAdventurePrologue: function () { return show(v2.adventureStoryConfig.prologue, { eyebrow: '미리보기' }); }, previewWorldIntro: function (worldId) { return worldIntro(v2.adventureService.getWorld(worldId)); }, previewStageStory: function (stageId) { return show((v2.adventureService.getStage(stageId) || {}).storyIntro, { eyebrow: '미리보기' }); }, previewBossIntro: function (stageId) { var stage = v2.adventureService.getStage(stageId); return stage && bossIntro(stage, function () {}); }, previewClearStory: function (worldId) { var stage = v2.adventureService.getStage('stage_' + worldId.slice(-2) + '_10'); return stage && show(stage.clearStory, { eyebrow: '미리보기' }); }, resetAdventureStorySeenForTesting: reset, printAdventureStoryProgress: function () { return ensureProgress(v2.storageService.loadSaveData()); }, validateAdventureStoryMappings: validate, validateAdventureStoryConfig: validate, setAlwaysShowStageStory: function (enabled) { var save = v2.storageService.loadSaveData(); save.settings = save.settings || {}; save.settings.alwaysShowStageStory = enabled !== false; v2.storageService.saveSaveData(save); return save.settings.alwaysShowStageStory; } });
  ensureModal();
})(window);
