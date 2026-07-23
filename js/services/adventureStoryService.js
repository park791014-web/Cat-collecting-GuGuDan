(function (global) {
  'use strict';
  var v2 = global.GugudanV2, lastFocus = null, active = false, onClose = null;
  function id(value) { return document.getElementById(value); }
  function ensureProgress(save) {
    save.adventureStory = save.adventureStory || { prologueSeen: false, seenWorldIntros: {}, seenStageIntros: {}, seenClearStories: {} };
    save.adventureStory.seenWorldIntros = save.adventureStory.seenWorldIntros || {};
    save.adventureStory.seenStageIntros = save.adventureStory.seenStageIntros || {};
    save.adventureStory.seenClearStories = save.adventureStory.seenClearStories || {};
    return save.adventureStory;
  }
  function ensureModal() {
    if (id('adventure-story-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'adventure-story-modal'; modal.className = 'story-modal'; modal.hidden = true;
    modal.innerHTML = '<section class="story-panel" role="dialog" aria-modal="true" aria-labelledby="story-modal-title"><button id="story-modal-close" class="story-close" type="button" aria-label="이야기 닫기">×</button><p id="story-modal-eyebrow" class="story-eyebrow"></p><div id="story-modal-visual" class="story-visual"></div><h2 id="story-modal-title"></h2><p id="story-modal-description" class="story-description"></p><blockquote><strong id="story-modal-speaker"></strong><p id="story-modal-dialogue"></p></blockquote><div class="story-actions"><button id="story-modal-action" class="game-button primary" type="button"></button><button id="story-modal-skip" class="game-button secondary" type="button">스토리 건너뛰기</button></div></section>';
    document.body.appendChild(modal);
    id('story-modal-close').onclick = function () { close(false); };
    id('story-modal-skip').onclick = function () { close(true); };
    modal.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); close(false); } });
  }
  function close(continueFlow) {
    if (!active) return;
    var callback = onClose; active = false; onClose = null; id('adventure-story-modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (global.NyankoDebug && global.NyankoDebug.resetAdventureStartingLock) {
      global.NyankoDebug.resetAdventureStartingLock();
    }
    if (v2.adventureEngine && v2.adventureEngine.resetStartingLock) {
      v2.adventureEngine.resetStartingLock();
    }
    if (continueFlow && callback) callback();
    else {
      if (global.backToStageSelect) {
        global.backToStageSelect();
      }
    }
  }
  function show(data, options, callback) {
    if (!data) { if (callback) callback(); return false; }
    ensureModal(); if (active) return false; options = options || {}; active = true; lastFocus = document.activeElement; onClose = callback || null;
    id('story-modal-eyebrow').textContent = options.eyebrow || '구구단 대모험';
    id('story-modal-title').textContent = data.title || '새로운 이야기';
    id('story-modal-description').textContent = data.description || '';
    id('story-modal-speaker').textContent = data.speaker || options.speaker || '대장 고양이';
    id('story-modal-dialogue').textContent = data.dialogue || '';
    id('story-modal-action').textContent = data.buttonText || options.buttonText || '계속';
    id('story-modal-skip').hidden = !options.allowSkip;
    var visual = id('story-modal-visual'); visual.innerHTML = '';
    if (options.image) { var image = document.createElement('img'); image.src = options.image; image.alt = options.imageAlt || ''; visual.appendChild(image); if (v2.assetLoader) v2.assetLoader.applyImageFallback(image, options.fallbackImage || 'assets/placeholders/adventure-placeholder.svg'); }
    id('story-modal-action').onclick = function () { close(true); };
    id('adventure-story-modal').hidden = false; setTimeout(function () { id('story-modal-action').focus(); }, 0); return true;
  }
  function mark(mutator) { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); mutator(progress); v2.storageService.saveSaveData(save); }
  function prologue() { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (progress.prologueSeen) return false; return show(v2.adventureStoryConfig.prologue, { eyebrow: '모험의 시작' }, function () { mark(function (value) { value.prologueSeen = true; }); }); }
  function worldIntro(world) { var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (!world || !world.storyIntro || progress.seenWorldIntros[world.id]) return false; return show(world.storyIntro, { eyebrow: 'WORLD ' + world.order, image: world.artwork && world.artwork.thumbnail, imageAlt: world.title }, function () { mark(function (value) { value.seenWorldIntros[world.id] = true; }); }); }
  function stageIntro(stage, start) {
    if (!stage || !stage.storyIntro) { if (start) start(); return false; }
    return show(stage.storyIntro, { eyebrow: 'STAGE ' + stage.displayNumber, buttonText: '도전하기', allowSkip: true }, function () { mark(function (value) { value.seenStageIntros[stage.id] = true; }); if (start) start(); });
  }
  function bossIntro(stage, start) { if (!stage || !stage.bossIntro) { start(); return false; } var data = { title: stage.bossIntro.bossName, description: stage.bossIntro.entranceText, speaker: stage.bossIntro.bossName, dialogue: stage.bossIntro.dialogue, buttonText: '보스전 시작' }; return show(data, { eyebrow: '⚔ 보스 등장', image: stage.boss && stage.boss.image, imageAlt: stage.bossIntro.bossName }, start); }
  function clearStory(stage) { if (!stage || !stage.clearStory) return false; var save = v2.storageService.loadSaveData(), progress = ensureProgress(save); if (progress.seenClearStories[stage.worldId]) return false; return show(stage.clearStory, { eyebrow: '보석 조각 발견' }, function () { mark(function (value) { value.seenClearStories[stage.worldId] = true; }); }); }
  function validate() { var errors = []; (v2.worlds || []).filter(function (world) { return world.enabled; }).forEach(function (world) { if (!world.storyIntro) errors.push(world.id + ':intro'); world.stageIds.forEach(function (stageId, index) { var stage = v2.adventureService.getStage(stageId); if (!stage || !stage.storyIntro) errors.push(stageId + ':story'); if ((index === 4 || index === 9) && (!stage || !stage.bossIntro)) errors.push(stageId + ':boss'); if (index === 9 && (!stage || !stage.clearStory)) errors.push(stageId + ':clear'); }); }); if (errors.length) console.error('[Story Mapping Missing]', errors); return { valid: !errors.length, errors: errors }; }
  function reset() { var save = v2.storageService.loadSaveData(); delete save.adventureStory; v2.storageService.saveSaveData(save); return ensureProgress(save); }
  v2.adventureStoryService = { show: show, showPrologue: prologue, showWorldIntro: worldIntro, showStageIntro: stageIntro, showBossIntro: bossIntro, showClearStory: clearStory, ensureProgress: ensureProgress, validateAdventureStoryMappings: validate, resetForTesting: reset };
  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, { previewAdventurePrologue: function () { return show(v2.adventureStoryConfig.prologue, { eyebrow: '미리보기' }); }, previewWorldIntro: function (worldId) { return worldIntro(v2.adventureService.getWorld(worldId)); }, previewStageStory: function (stageId) { return show((v2.adventureService.getStage(stageId) || {}).storyIntro, { eyebrow: '미리보기', allowSkip: true }); }, previewBossIntro: function (stageId) { var stage = v2.adventureService.getStage(stageId); return stage && bossIntro(stage, function () {}); }, previewClearStory: function (worldId) { var stage = v2.adventureService.getStage('stage_' + worldId.slice(-2) + '_10'); return stage && show(stage.clearStory, { eyebrow: '미리보기' }); }, resetAdventureStorySeenForTesting: reset, printAdventureStoryProgress: function () { return ensureProgress(v2.storageService.loadSaveData()); }, validateAdventureStoryMappings: validate, validateAdventureStoryConfig: validate, setAlwaysShowStageStory: function (enabled) { var save = v2.storageService.loadSaveData(); save.settings = save.settings || {}; save.settings.alwaysShowStageStory = enabled !== false; v2.storageService.saveSaveData(save); return save.settings.alwaysShowStageStory; } });
  ensureModal();
})(window);
