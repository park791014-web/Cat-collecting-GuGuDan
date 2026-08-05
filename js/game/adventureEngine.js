(function (global) {
  'use strict';
  var v2 = global.GugudanV2, worldId = null, stage = null, run = null, timer = null, transitionTimer = null, safetyTimer = null, resultRenderCount = 0;
  
  function byId(id) { return document.getElementById(id); }
  function showAdventureFeedback(kind, message) { if (global.setGameAnswerFeedback) global.setGameAnswerFeedback(kind, message); else { var feedback = byId('feedback'); feedback.className = 'game-answer-feedback is-' + kind; feedback.textContent = message; } }
  function cats() { return [].concat(v2.baseCats || [], v2.seasonCats || []); }
  function selectedCat() { return v2.releasePolicyService.getSelectedCat(); }
  function img(src, cls, alt) { return '<img src="' + src + '" class="' + cls + '" alt="' + (alt || '') + '">'; }
  function fallback(node, path) { if (node && v2.assetLoader) v2.assetLoader.applyImageFallback(node, path || 'assets/placeholders/adventure-placeholder.svg'); }
  function focus(id) { setTimeout(function () { var node = byId(id); if (node) node.focus(); }, 0); }
  
  function stop() { 
    if (timer) clearInterval(timer); 
    if (transitionTimer) clearTimeout(transitionTimer); 
    if (safetyTimer) clearTimeout(safetyTimer); 
    timer = null; 
    transitionTimer = null; 
    safetyTimer = null; 
  }
  global.clearAdventureEngineTimers = stop;

  function clearTimeouts() {
    if (transitionTimer) clearTimeout(transitionTimer);
    if (safetyTimer) clearTimeout(safetyTimer);
    transitionTimer = null;
    safetyTimer = null;
  }
  global.clearAdventureEngineTimeouts = clearTimeouts;

  function unlockInput() {
    if (run) run.locked = false;
  }
  global.unlockAdventureEngineInput = unlockInput;

  function lockInput() {
    if (run) run.locked = true;
  }
  global.lockAdventureEngineInput = lockInput;

  function getStageType(stageNumber) {
    const stageNum = Number(stageNumber);
    if (stageNum === 5) {
      return "midBoss";
    }
    if (stageNum === 10) {
      return "finalBoss";
    }
    return "normal";
  }
  global.getStageType = getStageType;

  function makeStageId(worldNumber, stageNumber) {
    return 'stage_' + String(worldNumber).padStart(2, '0') + '_' + String(stageNumber).padStart(2, '0');
  }
  global.makeStageId = makeStageId;

  function isStageUnlocked(worldNumber, stageNumber, adventure) {
    if (Number(worldNumber) === 1 && Number(stageNumber) === 1) {
      return true;
    }
    const stageId = makeStageId(worldNumber, stageNumber);
    const unlocked = adventure?.unlockedStageIds || [];
    const completed = adventure?.completedStageIds || [];
    return unlocked.includes(stageId) || completed.includes(stageId);
  }
  global.isStageUnlocked = isStageUnlocked;

  function resolveStoryEnemyAsset(worldId, stageNumber) {
    const stageType = getStageType(stageNumber);
    const world = v2.adventureService.getWorld(worldId);
    if (!world) {
      throw new Error(`story_assets_missing:${worldId}`);
    }
    const stageConfig = v2.adventureService.getStage(makeStageId(Number(worldId.split('_')[1]), stageNumber));
    if ((stageType === "midBoss" || stageType === "finalBoss") && stageConfig && stageConfig.boss) {
      return stageConfig.boss.image;
    }
    if (stageType === "midBoss" && world.midBoss) {
      return world.midBoss.image;
    }
    if (stageType === "finalBoss" && world.finalBoss) {
      return world.finalBoss.image;
    }

    var normalEnemies = {
      // [임시 상태] 초원 월드 일반 몬스터 전용 에셋(world_01_normal_enemy.svg)이 리소스 번들에 누락되어 임시 플레이스홀더를 사용합니다.
      // 향후 정식 에셋 제공 시 'assets/adventure/enemies/world_01_normal_enemy.svg' 등으로 대치 연동하세요.
      // 절대로 최종보스용 에셋인 'world_01_final_boss.svg'를 일반 스테이지에 재사용하지 마세요.
      world_01: 'assets/placeholders/cat-placeholder.svg', 
      world_02: 'assets/adventure/decorations/fish_crate.svg',
      world_03: 'assets/adventure/decorations/toy_gear.svg',
      world_04: 'assets/adventure/decorations/volcano_stone.svg',
      world_05: 'assets/adventure/decorations/ice_crystal.svg',
      world_06: 'assets/adventure/decorations/machinery_cog.svg',
      world_07: 'assets/adventure/decorations/stardust.svg',
      world_08: 'assets/adventure/decorations/demon_horn.svg'
    };
    return normalEnemies[worldId] || 'assets/placeholders/cat-placeholder.svg';
  }
  global.resolveStoryEnemyAsset = resolveStoryEnemyAsset;

  var localFixtureApplied = false;
  function applyLocalAdventureFixture() {
    if (localFixtureApplied || !global.location || ['localhost', '127.0.0.1'].indexOf(global.location.hostname) < 0) return;
    var fixtureStageId = new URLSearchParams(global.location.search || '').get('adventureFixture');
    var target = fixtureStageId && v2.adventureService.getStage(fixtureStageId);
    if (!target) return;
    localFixtureApplied = true;
    var completed = [], targetWorld = v2.adventureService.getWorld(target.worldId);
    v2.worlds.filter(function (world) { return world.order < targetWorld.order; }).forEach(function (world) { if (world.stageIds.length) completed.push(world.stageIds[world.stageIds.length - 1]); });
    var targetIndex = targetWorld.stageIds.indexOf(target.id);
    if (targetIndex > 0) completed.push(targetWorld.stageIds[targetIndex - 1]);
    var progress = v2.adventureService.normalizeProgress({ completedStageIds: completed, currentStage: target.id });
    progress.currentWorldId = target.worldId;
    progress.currentStageId = target.id;
    v2.adventureService.saveProgress(progress);
    var save = v2.storageService.loadSaveData(); delete save.adventureStory; v2.storageService.saveSaveData(save);
  }

  function openAdventureMap() {
    stop(); applyLocalAdventureFixture(); var progress = v2.adventureService.loadProgress(), list = byId('world-list');
    byId('adventure-total-stars').textContent = progress.totalStars; list.innerHTML = '';
    var activeId=worldId||progress.currentWorldId,enabled=v2.worlds.filter(function(w){return w.enabled&&progress.unlockedWorldIds.indexOf(w.id)>=0;});if(!enabled.some(function(w){return w.id===activeId;}))activeId=enabled[0]&&enabled[0].id;var ordered=v2.worlds.slice().sort(function(a,b){if(a.id===activeId)return-1;if(b.id===activeId)return 1;return a.order-b.order;});
    ordered.forEach(function (world) {
      var unlocked = progress.unlockedWorldIds.indexOf(world.id) >= 0, available = world.enabled && unlocked;
      var cleared = world.stageIds.filter(function (id) { return progress.clearedStageIds.indexOf(id) >= 0; }).length;
      var card = document.createElement('article'); card.className = 'world-card theme-' + world.theme + (world.id===activeId?' active-world':' compact-world') + (available ? '' : ' locked');
      card.innerHTML = img(available ? world.artwork.thumbnail : 'assets/adventure/worlds/world_locked.svg', 'world-card__background', '') + '<div class="world-card__overlay"></div><div class="world-card__content"><div class="world-order">WORLD ' + world.order + '</div><h3>' + world.title + '</h3><p>' + world.multiplicationTables.join(' · ') + '단</p><div class="world-progress"><span>진행 ' + cleared + '/' + world.stageIds.length + '</span></div>' + (available ? '<button class="game-button primary">시작하기</button>' : '<div class="locked-copy">아직 잠겨 있어요</div>') + '</div>';
      fallback(card.querySelector('img')); if (available) card.querySelector('button').onclick = function () { openStageSelect(world.id); }; list.appendChild(card);
    });
    global.showScreen('adventure-map-screen'); focus('adventure-map-title');try{if(v2.adventureStoryService)v2.adventureStoryService.showPrologue();}catch(error){console.warn('[Story prologue failed]',error);}
  }

  function openStageSelect(id, options) {
    options = options || {};
    worldId = id; var world = v2.adventureService.getWorld(id), progress = v2.adventureService.loadProgress(), grid = byId('stage-grid'); if (!world) return openAdventureMap();
    byId('stage-select-title').textContent = world.title; byId('stage-select-subtitle').textContent = world.subtitle; 
    
    const worldNum = parseInt(world.id.split('_')[1]);
    const stageButtons = [];
    
    world.stageIds.forEach(function (stageId) { 
      var item = v2.adventureService.getStage(stageId);
      var stageNum = parseInt(item.id.split('_')[2]);
      
      var unlocked = isStageUnlocked(worldNum, stageNum, progress);
      var record = progress.stageRecords[stageId] || {}; 
      var completed = record.cleared || progress.clearedStageIds.includes(stageId);
      
      var statusClass = 'locked';
      if (completed) statusClass = 'completed';
      else if (unlocked) statusClass = 'unlocked';
      
      var button = document.createElement('button'); 
      button.className = 'stage-node ' + item.type + ' ' + statusClass; 
      button.disabled = !unlocked; 
      
      button.dataset.stageId = stageId;
      button.dataset.worldId = world.id;
      button.dataset.stageNumber = String(stageNum);
      
      button.innerHTML = '<strong style="pointer-events: none;">' + item.displayNumber + '</strong>' +
                         '<span style="pointer-events: none;">' + item.title + '</span>' +
                         '<em style="pointer-events: none;">' + '★'.repeat(record.bestStars || 0) + '☆'.repeat(3 - (record.bestStars || 0)) + '</em>'; 
      
      console.log("[STAGE BUTTON BIND]", {
        worldId: world.id,
        stageNumber: stageNum,
        stageId: stageId,
        unlocked: unlocked,
        completed: completed,
        disabled: !unlocked,
        hasClickHandler: false
      });

      stageButtons.push(button);
    });
    
    if (!grid.dataset.stageClickBound) {
      grid.addEventListener('click', function(event) {
        var button = event.target.closest('.stage-node');
        if (!button || button.disabled) return;
        
        var stageId = button.dataset.stageId;
        var worldId = button.dataset.worldId;
        var stageNum = Number(button.dataset.stageNumber);
        
        console.log("[STAGE BUTTON CLICK]", {
          worldId: worldId,
          stageNumber: stageNum,
          stageId: stageId
        });
        
        openStageReady(stageId);
      });
      grid.dataset.stageClickBound = 'true';
    }
    
    grid.replaceChildren(...stageButtons);

    global.showScreen('stage-select-screen'); 
    focus('stage-select-title');
    try {
      if (v2.adventureStoryService && !options.skipWorldIntro) v2.adventureStoryService.showWorldIntro(world);
    } catch(error) {
      console.warn('[World intro failed]', error);
    }
  }

  function openStageReady(id, storyConfirmed) {
    stage = v2.adventureService.getStage(id); if (!stage) return;
    
    global.clearBossUI && global.clearBossUI();
    global.clearStoryEnemyUI && global.clearStoryEnemyUI();

    byId('ready-stage-number').textContent = 'STAGE ' + stage.displayNumber; byId('stage-ready-title').textContent = stage.title;
    byId('stage-ready-card').innerHTML = '<p>구구단: ' + stage.rules.tables.join(', ') + '단</p><p>문제 수: ' + stage.rules.questionCount + ' · 목숨: ' + stage.rules.lives + '</p>' + (stage.boss ? '<p>보스: ' + stage.boss.name + '</p>' : '');
    
    global.showScreen('stage-ready-screen'); focus('stage-ready-title');
    
    try {
      if (storyConfirmed) {
        startAdventureStage(false);
      } else if (v2.adventureStoryService) {
        v2.adventureStoryService.showStageIntro(stage, function () {
          startAdventureStage(false);
        });
      } else {
        startAdventureStage(false);
      }
    } catch (error) {
      console.warn('[Stage intro failed]', error);
      startAdventureStage(false);
    }
  }
  function backToStageSelect() { openStageSelect(worldId || (stage && stage.worldId)); }

  var adventureScreenSelectors = [
    '#adventure-result-screen',
    '#stage-select-screen',
    '#stage-ready-screen',
    '#play-screen'
  ];

  function getVisibleAdventureScreens() {
    return adventureScreenSelectors.filter(function (selector) {
      var element = document.querySelector(selector);
      if (!element || !element.isConnected) return false;
      var style = global.getComputedStyle(element);
      return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
    });
  }

  function collectAdventureScreenState(label) {
    var selectors = adventureScreenSelectors.concat('#adventure-story-modal');
    var screens = selectors.map(function (selector) {
      var element = document.querySelector(selector);
      if (!element) return { selector: selector, exists: false };
      var style = global.getComputedStyle(element);
      return {
        selector: selector,
        exists: true,
        connected: element.isConnected,
        hidden: element.hidden,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        className: element.className,
        childCount: element.children.length
      };
    });
    console.info('[ADVENTURE SCREEN STATE]', {
      label: label,
      screens: screens,
      lastAdventureResult: global.lastAdventureResult || null,
      currentAdventureSession: global.currentAdventureSession || null
    });
    return screens;
  }

  function restoreAdventureResultScreen() {
    var resultScreen = byId('adventure-result-screen');
    if (!resultScreen) return;
    resultScreen.style.display = 'block';
    resultScreen.hidden = false;
    resultScreen.removeAttribute('hidden');
    resultScreen.classList.add('active', 'active-screen');
  }

  async function returnToAdventureStageList() {
    var targetWorldId = worldId || (stage && stage.worldId) || 'world_01';
    console.info('[RESULT STAGE LIST START]', { worldId: targetWorldId });
    try {
      await global.openStageSelect(targetWorldId);
      var destination = byId('stage-select-screen');
      if (!destination || !destination.isConnected) throw new Error('stage_list_render_failed');
      console.info('[RESULT STAGE LIST OPEN]', { worldId: targetWorldId });
      global.clearResultUI && global.clearResultUI();
      console.info('[RESULT SCREEN HIDDEN]', { source: 'stageList' });
      console.info('[RESULT STAGE LIST SUCCESS]', { worldId: targetWorldId });
    } catch (error) {
      console.error('[RESULT STAGE LIST ERROR]', { worldId: targetWorldId, message: error && error.message, stack: error && error.stack });
      global.showScreen('adventure-result-screen');
    }
  }

  function openResultStory(targetStageId, source) {
    var target = v2.adventureService.getStage(targetStageId);
    if (!target) return;
    if (source === 'next') console.info('[NEXT ACTION START]', { targetStageId: targetStageId });
    async function continueToTarget() {
      console.info('[STORY CONTINUE]', { source: source, targetStageId: targetStageId });
      try {
        await openStageReady(targetStageId, true);
        console.info('[STAGE READY OPEN]', { source: source, targetStageId: targetStageId });
        global.clearResultUI && global.clearResultUI();
        console.info('[RESULT SCREEN HIDDEN]', { source: source });
      } catch (error) {
        restoreAdventureResultScreen();
        console.error('[STORY CONTINUE ERROR]', { source: source, targetStageId: targetStageId, message: error && error.message });
      }
    }
    if (v2.adventureStoryService) {
      console.info('[STORY MODAL OPEN]', { source: source, targetStageId: targetStageId });
      return v2.adventureStoryService.showStageIntro(target, continueToTarget);
    }
    continueToTarget();
  }

  function normalizeAdventureWorldId(worldNumber) {
    return 'world_' + String(worldNumber).padStart(2, '0');
  }

  async function openNextWorldStageList(nextWorldNumber) {
    var nextWorldId = normalizeAdventureWorldId(nextWorldNumber);
    console.info('[NEXT WORLD LIST START]', { nextWorldNumber: nextWorldNumber, nextWorldId: nextWorldId });
    if (global.refreshCurrentUserData) await global.refreshCurrentUserData({ renderLobby: false });
    await openStageSelect(nextWorldId, { skipWorldIntro: true });
    var destination = byId('stage-select-screen');
    if (!destination || !destination.isConnected) throw new Error('next_world_stage_list_render_failed');
    console.info('[NEXT WORLD LIST SUCCESS]', { nextWorldId: nextWorldId });
    global.clearResultUI && global.clearResultUI();
    console.info('[RESULT SCREEN HIDDEN]', { source: 'worldEnding', nextWorldId: nextWorldId });
  }

  function handleNextWorldStoryFromResult(currentStage) {
    var currentWorldNumber = Number(currentStage.worldId.split('_')[1]);
    var nextStageId = v2.adventureService.getNextStageId(currentStage);
    var nextStage = nextStageId && v2.adventureService.getStage(nextStageId);
    var nextWorldNumber = nextStage ? Number(nextStage.worldId.split('_')[1]) : null;
    var storyCompleted = false;
    console.info('[WORLD ENDING STORY START]', { currentWorldNumber: currentWorldNumber, nextWorldNumber: nextWorldNumber });
    async function continueAfterWorld() {
      storyCompleted = true;
      console.info('[WORLD ENDING STORY CONTINUE]', { currentWorldNumber: currentWorldNumber, nextWorldNumber: nextWorldNumber });
      try {
        if (nextWorldNumber) await openNextWorldStageList(nextWorldNumber);
        else { global.clearResultUI && global.clearResultUI(); openAdventureMap(); }
      } catch (error) {
        restoreAdventureResultScreen();
        console.error('[NEXT WORLD LIST ERROR]', { nextWorldNumber: nextWorldNumber, message: error && error.message, stack: error && error.stack });
      }
    }
    if (!v2.adventureStoryService || !currentStage.clearStory) return continueAfterWorld();
    console.info('[WORLD ENDING STORY OPEN]', { worldId: currentStage.worldId, stageId: currentStage.id });
    return v2.adventureStoryService.showClearStory(currentStage, continueAfterWorld, function () {
      if (!storyCompleted) console.info('[WORLD ENDING STORY CLOSE]', { currentWorldNumber: currentWorldNumber });
    });
  }

  function question() {
    var table = stage.rules.tables[Math.floor(Math.random() * stage.rules.tables.length)], multiplier = 1 + Math.floor(Math.random() * 9), answer = table * multiplier;
    return { text: table + ' × ' + multiplier + ' = ?', answer: answer, options: v2.questionGenerator.createOptions(answer, stage.rules.answerOptionCount, stage.rules.answerOptionCount >= 6) };
  }
  
  function renderHud() {
    const session = global.gameSession;
    if (!session) return;
    byId('live-points').textContent = session.correctCount * 10; 
    byId('q-counter').textContent = session.answeredCount + '/' + stage.rules.questionCount; 
    byId('current-accuracy').textContent = session.answeredCount ? Math.round(session.correctCount / session.answeredCount * 100) + '%' : '100%'; 
    byId('progress-bar').style.width = Math.min(100, session.answeredCount / stage.rules.questionCount * 100) + '%';
    
    if (stage.boss) { 
      var hpBar = byId('boss-hp-bar'); 
      byId('boss-hp-text').textContent = run.bossHp + '/' + stage.boss.maximumHp; 
      if (hpBar) hpBar.style.width = run.bossHp / stage.boss.maximumHp * 100 + '%'; 
    }
  }

  function nextQuestion() {
    const session = global.gameSession;
    if (!session || session.status !== 'playing') return;
    
    if (session.answeredCount >= stage.rules.questionCount || run.lives <= 0 || run.bossHp <= 0) {
      var isBoss = stage.boss || stage.type === 'midBoss' || stage.type === 'finalBoss';
      var cleared = isBoss ? (run.bossHp <= 0 && run.lives > 0) : (session.answeredCount >= stage.rules.questionCount && run.lives > 0);
      global.finalizeGameSession({
        reason: cleared ? "stage_cleared" : "stage_failed",
        success: cleared
      });
      return;
    }

    try {
      run.locked = false; 
      run.current = question(); 
      session.currentQuestion = run.current;
      byId('question').textContent = run.current.text; 
      byId('feedback').className = '';
      byId('feedback').textContent = '';
      var box = byId('options-container'); 
      box.innerHTML = '';
      
      run.current.options.forEach(function (value) { 
        var button = document.createElement('button'); 
        button.type = 'button'; 
        button.className = 'option-btn btn-answer game-answer-button game-answer-button--adventure'; 
        button.textContent = value; 
        button.onclick = function () { answer(value, button); }; 
        box.appendChild(button); 
      }); 
      renderHud();
    } catch (error) { 
      console.error('[Adventure next question error]', error); 
      run.locked = false; 
    }
  }
  
  function answer(value, selectedButton) {
    const session = global.gameSession;
    if (!session || session.status !== 'playing' || run.locked) return;
    
    run.locked = true; 
    session.answeredCount += 1;
    
    var correct = value === run.current.answer, feedbackText = '';
    
    if (correct) {
      session.correctCount += 1;
      run.combo += 1; 
      run.bestCombo = Math.max(run.bestCombo, run.combo);
      if (stage.boss) {
        run.bossHp = Math.max(0, run.bossHp - 1);
      }
    } else {
      session.wrongCount += 1;
      run.combo = 0; 
      run.lives = Math.max(0, run.lives - 1);
    }

    var leftVal = 0, rightVal = 0;
    try {
      var match = run.current.text.match(/(\d+)\s*[\xD7x\*\s]\s*(\d+)/i);
      if (match) {
        leftVal = parseInt(match[1]);
        rightVal = parseInt(match[2]);
      }
    } catch (err) {}
    session.results.push({
      left: leftVal,
      right: rightVal,
      submittedAnswer: value,
      correctAnswer: run.current.answer,
      isCorrect: correct,
      elapsedMs: 1000
    });

    document.querySelectorAll('#options-container .btn-answer').forEach(function (button) { button.disabled = true; if (Number(button.textContent) === Number(run.current.answer)) button.classList.add('answer-choice-correct'); });
    if (selectedButton && !correct) selectedButton.classList.add('answer-choice-wrong');
    
    if (correct) {
      try{if(v2.soundService)v2.soundService.playCorrectSound();if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('correct');}catch(soundError){}
      feedbackText = '정답이다냥!';
    } else {
      try{if(v2.soundService)v2.soundService.playWrongSound();if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('wrong');}catch(soundError){}
      feedbackText = '아쉬워요. 정답은 ' + run.current.answer;
    }
    
    try{renderHud();}catch(hudError){console.warn('[Adventure HUD error]',hudError);}
    
    if (correct && v2.effectService && typeof v2.effectService.playCorrect === 'function') {
      try { feedbackText = v2.effectService.playCorrect(run.combo) || feedbackText; }
      catch (error) { console.error('[Adventure correct effect error]', error); }
    }
    showAdventureFeedback(correct ? 'correct' : 'wrong', feedbackText);

    var isBoss = stage.boss || stage.type === 'midBoss' || stage.type === 'finalBoss';
    var cleared = isBoss ? (run.bossHp <= 0 && run.lives > 0) : (session.answeredCount >= stage.rules.questionCount && run.lives > 0);
    var failed = (run.lives <= 0);

    if (cleared || failed) {
      transitionTimer = global.setTimeout(function() {
        global.finalizeGameSession({
          reason: cleared ? "stage_cleared" : "stage_failed",
          success: cleared
        });
      }, 700);
      return;
    }

    var activeRun = run, answeredQuestion = run.current;
    function advance() { 
      if (run === activeRun && run.current === answeredQuestion && run.locked) { 
        run.locked = false; 
        nextQuestion(); 
      } 
    }
    transitionTimer = global.setTimeout(advance, 700);
    safetyTimer = global.setTimeout(advance, 1800);
  }

  function startAdventureStage(storyConfirmed) {
    if (!stage) return;
    
    var stageType = getStageType(stage.stageNumber);
    var bossUiVisible = (stageType === 'midBoss' || stageType === 'finalBoss');

    if (!storyConfirmed && bossUiVisible && v2.adventureStoryService) {
      try {
        return v2.adventureStoryService.showBossIntro(stage, function () {
          startAdventureStage(true);
        });
      } catch (storyError) {
        console.warn('[Boss intro failed]', storyError);
      }
    }

    if (global.clearClassicRuntime) global.clearClassicRuntime();
    if (global.clearPhase2Runtime) global.clearPhase2Runtime(); 
    stop(); 
    
    var cat = selectedCat(); 
    
    var session = global.createNewGameSession({
      mode: "adventure",
      worldId: stage.worldId,
      stageNumber: stage.stageNumber,
      stageType: stageType,
      stageId: stage.id
    });
    session.status = "playing";
    session.questionCount = stage.rules.questionCount;

    run = { 
      status: 'playing', 
      total: 0, 
      lives: stage.rules.lives, 
      bossHp: bossUiVisible ? (stage.boss ? stage.boss.maximumHp : 5) : 1, 
      combo: 0, 
      bestCombo: 0, 
      locked: false 
    };

    // UI 엘리먼트 초기화 및 셋업
    byId('skill-hud').style.display = 'flex'; 
    byId('skill-cat-image').src = cat.image; 
    fallback(byId('skill-cat-image'), cat.fallbackImage); 
    byId('skill-status').textContent = cat.skill ? cat.skill.name : '장착 고양이와 함께 모험 중'; 
    byId('manual-skill-button').style.display = 'none'; 
    byId('phase2-exit-button').style.display = 'none'; 
    byId('mode-status').textContent = '구구단 대모험';
    
    var world = v2.adventureService.getWorld(stage.worldId);
    var bgImage = world ? world.artwork.background : 'assets/adventure/worlds/world_locked.svg';
    var playScreen = byId('play-screen');
    if (playScreen) {
      playScreen.style.backgroundImage = 'url(' + bgImage + ')';
      playScreen.style.backgroundSize = 'cover';
      playScreen.style.backgroundPosition = 'center';
      
      // The portrait shell owns the arena.  Keep the legacy class off the whole
      // screen so only the visual-stage arena receives boss styling.
      playScreen.classList.remove('boss-arena');
    }

    // 보스 판넬 제어
    var bossPanel = byId('boss-panel');
    if (bossPanel) {
      bossPanel.style.display = bossUiVisible ? '' : 'none';
      if (bossUiVisible) {
        bossPanel.classList.add('boss-active-frame');
      } else {
        bossPanel.classList.remove('boss-active-frame');
      }
    }

    var bossImgEl = byId('boss-image');
    if (bossImgEl) {
      bossImgEl.onerror = function () {
        console.warn("[STORY ASSET MISSING]", {
          worldId: stage.worldId,
          stageId: stage.id,
          attemptedPath: bossImgEl.src
        });
        fallback(bossImgEl);
      };
    }

    var playerImage = byId('player-cat-image'), playerName = byId('player-cat-name');
    playerImage.src = cat.image || cat.fallbackImage;
    playerImage.alt = cat.displayName;
    fallback(playerImage, cat.fallbackImage);
    playerName.innerHTML = '<strong>' + cat.displayName + '</strong><small>' + ({normal:'일반',rare:'희귀',hero:'영웅',legendary:'전설'}[cat.rarity]) + (cat.description ? ' · ' + cat.description : '') + '</small>';

    var enemyAsset = resolveStoryEnemyAsset(stage.worldId, stage.stageNumber);
    if (global.renderGameShell) {
      global.renderGameShell({
        mode: 'adventure',
        title: '구구단 대모험',
        stageLabel: '스테이지 ' + stage.stageNumber,
        showTimer: Boolean(stage.rules.timeLimitSeconds),
        showCombo: true,
        showBossHp: bossUiVisible,
        enemyType: bossUiVisible ? 'boss' : 'enemy',
        enemyImage: enemyAsset,
        enemyLabel: bossUiVisible ? '' : '스테이지 적',
        bossHp: run.bossHp,
        bossMaxHp: stage.boss ? stage.boss.maximumHp : 0
      });
    }
    
    if (bossUiVisible) {
      byId('boss-hp').style.display = ''; 
      byId('boss-panel').className = 'boss-panel boss-world-' + stage.chapter + (cat.legendarySkill ? ' legendary-companion' : '') + ' boss-active-frame';
      byId('boss-name').textContent = stage.boss ? stage.boss.name : (stageType === 'midBoss' ? '중간보스' : '최종보스');
      bossImgEl.src = enemyAsset;
      bossImgEl.alt = stage.boss ? stage.boss.name : '보스 몬스터';
      fallback(bossImgEl);
    } else {
      byId('boss-hp').style.display = 'none';
      byId('boss-panel').className = 'boss-panel boss-world-' + stage.chapter;
      byId('boss-name').textContent = ''; // 야생 몬스터 임시 문구 완전 제거
      bossImgEl.src = enemyAsset;
      bossImgEl.alt = '일반 몬스터';
      fallback(bossImgEl);
    }

    console.log("[STORY BATTLE SETUP]", {
      worldId: stage.worldId,
      stageNumber: stage.stageNumber,
      stageType: stageType,
      enemyAsset: enemyAsset,
      bossUiVisible: bossUiVisible
    });

    global.showScreen('play-screen'); 
    nextQuestion();
    
    if (stage.rules.timeLimitSeconds) {
      timer = setInterval(function () { 
        if (session.status !== 'playing') {
          clearInterval(timer);
          return;
        }
        session.remainingSeconds -= 1; 
        byId('timer-bar').style.width = Math.max(0, session.remainingSeconds / stage.rules.timeLimitSeconds * 100) + '%'; 
        if (session.remainingSeconds <= 0) {
          clearInterval(timer);
          global.finalizeGameSession({ reason: "stage_failed", success: false }); 
        }
      }, 1000);
    }
  }

  function showAdventureResultUI(session) {
    var savedResult = arguments[1];
    resultRenderCount += 1;
    var isStageCleared = session.success;
    var correctCount = session.correctCount;
    var wrongCount = session.wrongCount;
    var totalQuestions = session.questionCount;
    var accuracy = session.answeredCount ? Math.round(correctCount / session.answeredCount * 100) : 0;
    
    var stars = 1;
    if (correctCount === totalQuestions) stars = 3;
    else if (accuracy >= 80) stars = 2;
    if (!isStageCleared) stars = 0;

    var claim = { ok: isStageCleared && savedResult && !savedResult.duplicate, reward: (savedResult && savedResult.adventureReward) || { coins: 0, normalTickets: 0, premiumTickets: 0, starRewards: [] }, firstClear: false };
    
    var cat = selectedCat(); 
    byId('adventure-result-number').textContent = 'STAGE ' + stage.displayNumber; 
    byId('adventure-result-title').textContent = isStageCleared ? '스테이지 클리어!' : '다시 도전해 보세요'; 
    byId('adventure-result-cat').innerHTML = img(cat.image, '', cat.displayName) + '<span>함께한 고양이<br><strong>' + cat.displayName + '</strong></span>'; 
    fallback(byId('adventure-result-cat').querySelector('img'), cat.fallbackImage); 
    
    byId('adventure-result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); 
    var awardedPoints = savedResult && Number.isFinite(Number(savedResult.sessionPoints)) ? Number(savedResult.sessionPoints) : 0;
    byId('adventure-result-stats').innerHTML = '<span>점수 <b>' + awardedPoints + '</b></span><span>정답 <b>' + correctCount + '</b></span><span>정확도 <b>' + accuracy + '%</b></span>';
    
    var rewardParts = [];
    if (claim.ok && savedResult && savedResult.playCoins) rewardParts.push('<div>플레이 보상: 코인 +' + savedResult.playCoins + '</div>');
    if (claim.ok && claim.reward.starRewards && claim.reward.starRewards.length) {
      var starParts = claim.reward.starRewards.map(function(r) {
        return '★'.repeat(r.star) + ' ' + (r.coins ? '코인 +' + r.coins : r.normalTickets ? '일반 뽑기권 +' + r.normalTickets : '고급 뽑기권 +' + r.premiumTickets);
      });
      rewardParts.push('<div>새로 달성한 별 보상: ' + starParts.join(' · ') + '</div>');
    }
    if (savedResult && savedResult.levelRewardPremiumTickets) rewardParts.push('<div>레벨업 보상: 고급 뽑기권 +' + savedResult.levelRewardPremiumTickets + '</div>');
    byId('adventure-rewards').innerHTML = claim.ok ? rewardParts.join('') : '';
    
    var stageNum = Number(stage.stageNumber);
    var resultStage = stage;
    var nextStageIdStr = v2.adventureService.getNextStageId(stage);
    var nextStage = nextStageIdStr && v2.adventureService.getStage(nextStageIdStr);
    var isWorldEnd = !nextStage || nextStage.worldId !== stage.worldId;
    
    var nextBtnHtml = '';
    if (isStageCleared) {
      byId('adventure-unlock-copy').textContent = '다음 스테이지가 열렸어요!'; 
      var nextButtonText = !isWorldEnd ? '다음 스테이지' : (nextStage ? '다음 월드로' : '스토리 완료');
      nextBtnHtml = '<button id="adventure-next-stage-button" class="game-button primary" type="button">' + nextButtonText + '</button>';
    } else {
      byId('adventure-unlock-copy').textContent = ''; 
    }

    byId('adventure-result-actions').innerHTML = nextBtnHtml +
      '<button id="adventure-retry-button" class="game-button secondary" type="button">다시 하기</button>' +
      '<button id="adventure-stage-list-button" class="game-button secondary" type="button">스테이지 목록</button>';
    var nextButton = byId('adventure-next-stage-button');
    if (nextButton) nextButton.onclick = function () {
      if (isWorldEnd) return handleNextWorldStoryFromResult(resultStage);
      openResultStory(nextStageIdStr, 'next');
    };
    byId('adventure-retry-button').onclick = function () { openResultStory(resultStage.id, 'retry'); };
    byId('adventure-stage-list-button').onclick = returnToAdventureStageList;
    
    run = null; 
    global.showScreen('adventure-result-screen'); 
    focus('adventure-result-card');
    global.setTimeout(function () {
      collectAdventureScreenState(resultRenderCount === 1 ? 'first-result-rendered' : 'repeat-result-rendered-' + resultRenderCount);
      console.info('[VISIBLE ADVENTURE SCREENS]', getVisibleAdventureScreens());
    }, 0);
  }
  global.showAdventureResultUI = showAdventureResultUI;

  global.startNextAdventureStage = function(nextStageId) {
    global.clearResultUI && global.clearResultUI();
    global.openStageReady(nextStageId);
  };

  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, { validateAdventureProgress: function () { return v2.adventureService.validateAdventureProgress(v2.adventureService.loadProgress()); }, printAdventureProgress: function () { return v2.adventureService.loadProgress(); },printAdventureState:function(){return run?{stageId:stage.id,status:run.status,questionIndex:session.answeredCount+1,answeredCount:session.answeredCount,bossHp:run.bossHp,bossMaximumHp:stage.boss&&stage.boss.maximumHp,lives:run.lives,isInputLocked:run.locked}:null;},startAdventureStage:function(id){openStageReady(id);startAdventureStage();return debug.printAdventureState();},simulateAdventureAnswer:function(correct){if(!run||!run.current)return false;var value=correct?run.current.answer:run.current.options.find(function(x){return Number(x)!==Number(run.current.answer);});answer(value,null);return true;},validateAdventureStageConfig:function(id){var s=v2.adventureService.getStage(id),errors=[];if(!s)return{valid:false,errors:['missing']};if(!Number.isInteger(s.rules.questionCount)||s.rules.questionCount<2)errors.push('questionCount');if(s.boss&&s.boss.maximumHp!==s.rules.questionCount)errors.push('bossHp');return{valid:!errors.length,errors:errors,questionCount:s.rules.questionCount,bossHp:s.boss&&s.boss.maximumHp};},validateAdventureStateTransition:function(){return{valid:!run||['stageIntro','questionActive','answerFeedback'].indexOf(run.status)>=0&&!(!run.locked&&run.status==='answerFeedback'),state:debug.printAdventureState()};},unlockStage: v2.adventureService.unlockStage, unlockWorld: v2.adventureService.unlockWorld, resetAdventureProgressForTesting: v2.adventureService.resetForTesting, completeStageForTesting: function (id) { var target = v2.adventureService.getStage(id); return target && v2.adventureService.completeStage(id, { score: 100, correctCount: target.rules.questionCount, wrongCount: 0, totalQuestions: target.rules.questionCount, accuracy: 100, bestCombo: target.rules.questionCount, remainingLives: 3, remainingSeconds: target.rules.timeLimitSeconds || 0, bossHp: 0 }); } });
  global.openAdventureMap = openAdventureMap; global.openStageSelect = openStageSelect; global.openStageReady = openStageReady; global.backToStageSelect = backToStageSelect; global.returnToAdventureStageList = returnToAdventureStageList; global.collectAdventureScreenState = collectAdventureScreenState; global.getVisibleAdventureScreens = getVisibleAdventureScreens; global.startAdventureStage = startAdventureStage;
})(window);
