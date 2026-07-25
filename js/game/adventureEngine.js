(function (global) {
  'use strict';
  var v2 = global.GugudanV2, worldId = null, stage = null, run = null, timer = null, transitionTimer = null, safetyTimer = null;
  function byId(id) { return document.getElementById(id); }
  function cats() { return [].concat(v2.baseCats || [], v2.seasonCats || []); }
  function selectedCat() { return v2.releasePolicyService.getSelectedCat(); }
  function img(src, cls, alt) { return '<img src="' + src + '" class="' + cls + '" alt="' + (alt || '') + '">'; }
  function fallback(node, path) { if (node && v2.assetLoader) v2.assetLoader.applyImageFallback(node, path || 'assets/placeholders/adventure-placeholder.svg'); }
  function focus(id) { setTimeout(function () { var node = byId(id); if (node) node.focus(); }, 0); }
  function stop() { if (timer) clearInterval(timer); if (transitionTimer) clearTimeout(transitionTimer); if (safetyTimer) clearTimeout(safetyTimer); timer = null; transitionTimer = null; safetyTimer = null; }

  function openAdventureMap() {
    stop(); var progress = v2.adventureService.loadProgress(), list = byId('world-list');
    byId('adventure-total-stars').textContent = progress.totalStars; list.innerHTML = '';
    var activeId=worldId||progress.currentWorldId,enabled=v2.worlds.filter(function(w){return w.enabled&&progress.unlockedWorldIds.indexOf(w.id)>=0;});if(!enabled.some(function(w){return w.id===activeId;}))activeId=enabled[0]&&enabled[0].id;var ordered=v2.worlds.slice().sort(function(a,b){if(a.id===activeId)return-1;if(b.id===activeId)return 1;return a.order-b.order;});
    ordered.forEach(function (world) {
      var unlocked = progress.unlockedWorldIds.indexOf(world.id) >= 0, available = world.enabled && unlocked;
      var cleared = world.stageIds.filter(function (id) { return progress.clearedStageIds.indexOf(id) >= 0; }).length;
      var card = document.createElement('article'); card.className = 'world-card theme-' + world.theme + (world.id===activeId?' active-world':' compact-world') + (available ? '' : ' locked');
      card.innerHTML = img(available ? world.artwork.thumbnail : 'assets/adventure/worlds/world_locked.svg', 'world-card__background', '') + '<div class="world-card__overlay"></div><div class="world-card__content"><div class="world-order">WORLD ' + world.order + '</div><h3>' + world.title + '</h3><p>' + world.multiplicationTables.join(' · ') + '단</p><div class="world-progress"><span>진행 ' + cleared + '/10</span></div>' + (available ? '<button class="game-button primary">시작하기</button>' : '<div class="locked-copy">아직 잠겨 있어요</div>') + '</div>';
      fallback(card.querySelector('img')); if (available) card.querySelector('button').onclick = function () { openStageSelect(world.id); }; list.appendChild(card);
    });
    global.showScreen('adventure-map-screen'); focus('adventure-map-title');try{if(v2.adventureStoryService)v2.adventureStoryService.showPrologue();}catch(error){console.warn('[Story prologue failed]',error);}
  }

  function openStageSelect(id) {
    worldId = id; var world = v2.adventureService.getWorld(id), progress = v2.adventureService.loadProgress(), grid = byId('stage-grid'); if (!world) return openAdventureMap();
    byId('stage-select-title').textContent = world.title; byId('stage-select-subtitle').textContent = world.subtitle; grid.innerHTML = '';
    world.stageIds.forEach(function (stageId) { var item = v2.adventureService.getStage(stageId), unlocked = progress.unlockedStageIds.indexOf(stageId) >= 0, record = progress.stageRecords[stageId] || {}; var button = document.createElement('button'); button.className = 'stage-node ' + item.type + (unlocked ? '' : ' locked'); button.disabled = !unlocked; button.innerHTML = '<strong>' + item.displayNumber + '</strong><span>' + item.title + '</span><em>' + '★'.repeat(record.bestStars || 0) + '☆'.repeat(3 - (record.bestStars || 0)) + '</em>'; if (unlocked) button.onclick = function () { openStageReady(stageId); }; grid.appendChild(button); });
    global.showScreen('stage-select-screen'); focus('stage-select-title');try{if(v2.adventureStoryService)v2.adventureStoryService.showWorldIntro(world);}catch(error){console.warn('[World intro failed]',error);}
  }

  function openStageReady(id) {
    stage = v2.adventureService.getStage(id); if (!stage) return;
    byId('ready-stage-number').textContent = 'STAGE ' + stage.displayNumber; byId('stage-ready-title').textContent = stage.title;
    byId('stage-ready-card').innerHTML = '<p>구구단: ' + stage.rules.tables.join(', ') + '단</p><p>문제 수: ' + stage.rules.questionCount + ' · 목숨: ' + stage.rules.lives + '</p>' + (stage.boss ? '<p>보스: ' + stage.boss.name + '</p>' : '');
    global.showScreen('stage-ready-screen'); focus('stage-ready-title');try{if(v2.adventureStoryService){v2.adventureStoryService.showStageIntro(stage,function(){startAdventureStage(false);});}else startAdventureStage(false);}catch(error){console.warn('[Stage intro failed]',error);startAdventureStage(false);}
  }
  function backToStageSelect() { openStageSelect(worldId || (stage && stage.worldId)); }

  function question() {
    var table = stage.rules.tables[Math.floor(Math.random() * stage.rules.tables.length)], multiplier = 1 + Math.floor(Math.random() * 9), answer = table * multiplier;
    return { text: table + ' × ' + multiplier + ' = ?', answer: answer, options: v2.questionGenerator.createOptions(answer, stage.rules.answerOptionCount, stage.rules.answerOptionCount >= 6) };
  }
  function renderHud() {
    byId('live-points').textContent = run.score; byId('q-counter').textContent = run.total + '/' + stage.rules.questionCount; byId('current-accuracy').textContent = run.total ? Math.round(run.correct / run.total * 100) + '%' : '100%'; byId('progress-bar').style.width = Math.min(100, run.total / stage.rules.questionCount * 100) + '%';
    if (stage.boss) { var hpBar=byId('boss-hp-bar'); byId('boss-hp-text').textContent = run.bossHp + '/' + stage.boss.maximumHp; if(hpBar)hpBar.style.width = run.bossHp / stage.boss.maximumHp * 100 + '%'; }
  }
  function nextQuestion() {
    if (!run || run.total >= stage.rules.questionCount || run.lives <= 0 || run.bossHp <= 0) return finishStage();
    try {
      run.status='questionActive';run.locked=false;run.current = question(); byId('question').textContent = run.current.text; var box = byId('options-container'); box.innerHTML = '';
      run.current.options.forEach(function (value) { var button = document.createElement('button'); button.type = 'button'; button.className = 'option-btn btn-answer game-answer-button game-answer-button--adventure'; button.textContent = value; button.onclick = function () { answer(value, button); }; box.appendChild(button); }); renderHud();
    } catch (error) { console.error('[Adventure next question error]', error); if (run) run.locked = false; }
  }
  function answer(value, selectedButton) {
    if (!run || run.locked) return;
    run.locked = true; run.status='answerFeedback'; run.total += 1;
    var correct = value === run.current.answer, feedbackText = '';
    document.querySelectorAll('#options-container .btn-answer').forEach(function (button) { button.disabled = true; if (Number(button.textContent) === Number(run.current.answer)) button.classList.add('answer-choice-correct'); });
    if (selectedButton && !correct) selectedButton.classList.add('answer-choice-wrong');
    if (correct) {
      try{if(v2.soundService)v2.soundService.playCorrectSound();if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('correct');}catch(soundError){}
      run.correct += 1; run.combo += 1; run.bestCombo = Math.max(run.bestCombo, run.combo); run.score += 10 + run.combo;
      if (stage.boss) run.bossHp = Math.max(0, run.bossHp - 1);
      feedbackText = '정답이다냥!';
    } else {
      try{if(v2.soundService)v2.soundService.playWrongSound();if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('wrong');}catch(soundError){}
      run.wrong += 1; run.combo = 0; run.lives = Math.max(0, run.lives - 1);
      feedbackText = '아쉬워요. 정답은 ' + run.current.answer;
    }
    byId('feedback').textContent = feedbackText;
    try{renderHud();}catch(hudError){console.warn('[Adventure HUD error]',hudError);}
    var activeRun = run, answeredQuestion = run.current;
    function advance() { if (run === activeRun && run.current === answeredQuestion && run.locked) { run.locked = false; nextQuestion(); } }
    transitionTimer = global.setTimeout(advance, 700);
    safetyTimer = global.setTimeout(advance, 1800);
    if (correct && v2.effectService && typeof v2.effectService.playCorrect === 'function') {
      try { byId('feedback').textContent = v2.effectService.playCorrect(run.combo) || feedbackText; }
      catch (error) { console.error('[Adventure correct effect error]', error); }
    }
  }
  function startAdventureStage(storyConfirmed) {
    if(!storyConfirmed&&stage&&stage.boss&&v2.adventureStoryService){try{return v2.adventureStoryService.showBossIntro(stage,function(){startAdventureStage(true);});}catch(storyError){console.warn('[Boss intro failed]',storyError);}}
    if (!stage) return; if(global.clearClassicRuntime)global.clearClassicRuntime();if (global.clearPhase2Runtime) global.clearPhase2Runtime(); stop(); var cat = selectedCat(); run = { sessionId: 'adventure_' + Date.now(), status:'stageIntro', total: 0, correct: 0, wrong: 0, score: 0, combo: 0, bestCombo: 0, lives: stage.rules.lives, bossHp: stage.boss ? stage.boss.maximumHp : 1, remainingSeconds: stage.rules.timeLimitSeconds || 0, locked: false };
    byId('skill-hud').style.display = 'flex'; byId('skill-cat-image').src = cat.image; fallback(byId('skill-cat-image'), cat.fallbackImage); byId('skill-status').textContent = cat.skill ? cat.skill.name : '장착 고양이와 함께 모험 중'; byId('manual-skill-button').style.display = 'none'; byId('phase2-exit-button').style.display = 'none'; byId('mode-status').textContent = '구구단 대모험';
    byId('boss-panel').style.display = stage.boss ? '' : 'none'; if (stage.boss) {var playerImage=byId('player-cat-image'),playerName=byId('player-cat-name');byId('boss-panel').className='boss-panel boss-world-'+stage.chapter+(cat.legendarySkill?' legendary-companion':'');byId('boss-name').textContent = stage.boss.name; byId('boss-image').src = stage.boss.image;byId('boss-image').alt=stage.boss.name; fallback(byId('boss-image'));playerImage.src=cat.image||cat.fallbackImage;playerImage.alt=cat.displayName;fallback(playerImage,cat.fallbackImage);playerName.innerHTML='<strong>'+cat.displayName+'</strong><small>'+({normal:'일반',rare:'희귀',hero:'영웅',legendary:'전설'}[cat.rarity])+(cat.description?' · '+cat.description:'')+'</small>'+(cat.presentationSkill?'<em>효과 '+cat.presentationSkill.effectThemeId+' · 소리 '+cat.presentationSkill.soundThemeId+'</em>':'')+(cat.legendarySkill?'<b>'+cat.legendarySkill.specialOption+'</b>':''); }
    global.showScreen('play-screen'); nextQuestion();
    if (stage.rules.timeLimitSeconds) timer = setInterval(function () { run.remainingSeconds -= 1; byId('timer-bar').style.width = Math.max(0, run.remainingSeconds / stage.rules.timeLimitSeconds * 100) + '%'; if (run.remainingSeconds <= 0) finishStage(); }, 1000);
  }
  function finishStage() {
    if (!run) return; stop(); var result = { sessionId: run.sessionId, mode: 'adventure', score: run.score, correctCount: run.correct, wrongCount: run.wrong, totalQuestions: run.total, accuracy: run.total ? Math.round(run.correct / run.total * 100) : 0, bestCombo: run.bestCombo, remainingLives: run.lives, remainingSeconds: run.remainingSeconds, bossHp: run.bossHp };
    var completion = v2.adventureService.completeStage(stage.id, result), claim = v2.rewardService.claimStageRewards({ sessionId: run.sessionId, stage: stage, cleared: completion.cleared, stars: completion.stars }), playReward = v2.modeRewardService.claim('adventure', result, { cleared: completion.cleared });
    if (v2.seasonService && v2.isFeatureEnabled('seasonMissions')) v2.seasonService.recordGameResult(Object.assign({}, result, { cleared: completion.cleared, isBoss: Boolean(stage.boss) }));
    if (v2.dailyMissionService) v2.dailyMissionService.recordGameResult(Object.assign({}, result, { cleared: completion.cleared, isBoss: Boolean(stage.boss) }));
    if(completion.cleared&&stage.clearStory&&v2.adventureStoryService)setTimeout(function(){try{v2.adventureStoryService.showClearStory(stage);}catch(error){console.warn('[Clear story failed]',error);}},120);
    var cat = selectedCat(); byId('adventure-result-number').textContent = 'STAGE ' + stage.displayNumber; byId('adventure-result-title').textContent = completion.cleared ? '스테이지 클리어!' : '다시 도전해 보세요'; byId('adventure-result-cat').innerHTML = img(cat.image, '', cat.displayName) + '<span>함께한 고양이<br><strong>' + cat.displayName + '</strong></span>'; fallback(byId('adventure-result-cat').querySelector('img'), cat.fallbackImage); byId('adventure-result-stars').textContent = '★'.repeat(completion.stars || 0) + '☆'.repeat(3 - (completion.stars || 0)); byId('adventure-result-stats').innerHTML = '<span>점수 <b>' + result.score + '</b></span><span>정답 <b>' + result.correctCount + '</b></span><span>정확도 <b>' + result.accuracy + '%</b></span>'; byId('adventure-rewards').textContent = (claim.ok ? '스테이지 보상 코인 ' + claim.reward.coins + ' · 일반 티켓 ' + claim.reward.normalTickets : '') + (playReward.ok ? ' · 플레이 보상 +' + playReward.parts.total + '코인' : ''); byId('adventure-unlock-copy').textContent = completion.unlockedStageId ? '다음 스테이지가 열렸어요!' : ''; byId('adventure-result-actions').innerHTML = '<button class="game-button primary" onclick="openStageReady(\'' + stage.id + '\')">다시 도전</button><button class="game-button secondary" onclick="backToStageSelect()">스테이지 목록</button>'; run = null; global.showScreen('adventure-result-screen'); focus('adventure-result-card');
  }
  function useManualCatSkill() { return false; }
  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, { validateAdventureProgress: function () { return v2.adventureService.validateAdventureProgress(v2.adventureService.loadProgress()); }, printAdventureProgress: function () { return v2.adventureService.loadProgress(); },printAdventureState:function(){return run?{stageId:stage.id,status:run.status,questionIndex:run.total+1,answeredCount:run.total,bossHp:run.bossHp,bossMaximumHp:stage.boss&&stage.boss.maximumHp,lives:run.lives,isInputLocked:run.locked}:null;},startAdventureStage:function(id){openStageReady(id);startAdventureStage();return debug.printAdventureState();},simulateAdventureAnswer:function(correct){if(!run||!run.current)return false;var value=correct?run.current.answer:run.current.options.find(function(x){return Number(x)!==Number(run.current.answer);});answer(value,null);return true;},validateAdventureStageConfig:function(id){var s=v2.adventureService.getStage(id),errors=[];if(!s)return{valid:false,errors:['missing']};if(!Number.isInteger(s.rules.questionCount)||s.rules.questionCount<2)errors.push('questionCount');if(s.boss&&s.boss.maximumHp!==s.rules.questionCount)errors.push('bossHp');return{valid:!errors.length,errors:errors,questionCount:s.rules.questionCount,bossHp:s.boss&&s.boss.maximumHp};},validateAdventureStateTransition:function(){return{valid:!run||['stageIntro','questionActive','answerFeedback'].indexOf(run.status)>=0&&!(!run.locked&&run.status==='answerFeedback'),state:debug.printAdventureState()};},unlockStage: v2.adventureService.unlockStage, unlockWorld: v2.adventureService.unlockWorld, resetAdventureProgressForTesting: v2.adventureService.resetForTesting, completeStageForTesting: function (id) { var target = v2.adventureService.getStage(id); return target && v2.adventureService.completeStage(id, { score: 100, correctCount: target.rules.questionCount, wrongCount: 0, totalQuestions: target.rules.questionCount, accuracy: 100, bestCombo: target.rules.questionCount, remainingLives: 3, remainingSeconds: target.rules.timeLimitSeconds || 0, bossHp: 0 }); } });
  global.openAdventureMap = openAdventureMap; global.openStageSelect = openStageSelect; global.openStageReady = openStageReady; global.backToStageSelect = backToStageSelect; global.startAdventureStage = startAdventureStage; global.useManualCatSkill = useManualCatSkill;
})(window);
