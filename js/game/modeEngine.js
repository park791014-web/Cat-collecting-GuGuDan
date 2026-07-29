(function (global) {
  'use strict';
  var v2 = global.GugudanV2, stateApi = v2.gameState, state = stateApi.state, config = v2.gameConfig;
  var modeTimer = null, modeEndAt = null, transitionTimer = null, activeMode = null, lastMode = 'timeAttack';
  var rankingMode = 'overall', rankingPeriod = 'allTime';
  var GAME_MODES = { CLASSIC: 'classic', TIME_ATTACK: 'timeAttack', ENDLESS: 'endless', ADVENTURE: 'adventure' };
  var questionStartTime = 0;

  function byId(id) { return document.getElementById(id); }
  
  function clearTimers() { 
    if (modeTimer) clearInterval(modeTimer); 
    if (transitionTimer) clearTimeout(transitionTimer); 
    modeTimer = null; 
    transitionTimer = null; 
    modeEndAt = null; 
  }
  global.clearModeEngineTimers = clearTimers;

  function clearTimeouts() {
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  global.clearModeEngineTimeouts = clearTimeouts;

  function unlockInput() {
    state.inputLocked = false;
  }
  global.unlockModeEngineInput = unlockInput;

  function lockInput() {
    state.inputLocked = true;
  }
  global.lockModeEngineInput = lockInput;

  function playerContext() { return global.getCurrentPlayerContext ? global.getCurrentPlayerContext() : { nickname: 'GUEST', isGuest: true }; }
  function setVisible(selector, visible) { document.querySelectorAll(selector).forEach(function (element) { element.style.display = visible ? '' : 'none'; }); }
  function prepareResultLayout(isPhase2) { setVisible('.legacy-result', !isPhase2); byId('total-stats').style.display = isPhase2 ? 'none' : byId('total-stats').style.display; byId('reward-box').style.display = 'none'; byId('phase2-result-panel').style.display = isPhase2 ? 'block' : 'none'; byId('phase2-result-actions').style.display = isPhase2 ? 'block' : 'none'; byId('legacy-result-actions').style.display = isPhase2 ? 'none' : 'block'; byId('ranking-controls').style.display = isPhase2 ? 'block' : 'none'; }
  function prepareClassicUI() { clearTimers(); activeMode = null; byId('mode-status').className = 'mode-status'; byId('mode-status').innerHTML = ''; byId('phase2-exit-button').style.display = 'none'; byId('timer-bar').parentElement.style.display = ''; byId('progress-bar').parentElement.style.display = ''; prepareResultLayout(false); document.querySelector('#result-screen > h1').textContent = '🎉 모험 끝냥! 🎉'; }
  
  function clearPhase2Runtime() { 
    clearTimers(); 
    if (activeMode && state.status === 'playing') stateApi.finishGame('manual_exit'); 
    activeMode = null; 
    byId('phase2-exit-button').style.display = 'none'; 
    document.body.classList.remove('time-warning-mode','time-attack-critical'); 
  }
  global.clearPhase2Runtime = clearPhase2Runtime;

  function startPhase2Mode(mode, overrides) {
    if (mode !== GAME_MODES.TIME_ATTACK && mode !== GAME_MODES.ENDLESS) return;
    if (!config.modes[mode] || !config.modes[mode].enabled) return;
    
    var session = global.createNewGameSession({
      mode: mode,
      worldId: null,
      stageNumber: null,
      stageType: null
    });
    session.status = "playing";

    clearTimers(); 
    prepareResultLayout(true); 
    activeMode = mode; 
    lastMode = mode; 
    var rules = config.modes[mode], options = {};
    
    if (mode === GAME_MODES.TIME_ATTACK) {
      options.durationSeconds = overrides && overrides.durationSeconds || rules.defaultSeconds;
    }
    if (mode === GAME_MODES.ENDLESS) {
      options.lives = rules.defaultLives;
    }
    
    stateApi.startGame(mode, options); 
    state.selectedCatId = v2.storageService.loadSaveData().profile.selectedCatId;

    var context = playerContext(), save = v2.storageService.loadSaveData(); 
    if (!context.isGuest && context.nickname) save.profile.nickname = context.nickname; 
    v2.storageService.saveSaveData(save);
    
    byId('phase2-exit-button').style.display = 'inline-block'; 
    byId('mode-status').className = 'mode-status active'; 
    byId('feedback').textContent = '';
    byId('timer-bar').parentElement.style.display = mode === GAME_MODES.TIME_ATTACK ? '' : 'none'; 
    byId('progress-bar').parentElement.style.display = mode === GAME_MODES.TIME_ATTACK ? '' : 'none';
    
    showScreen('play-screen'); 
    renderModeStatus(); 
    nextModeQuestion();
    
    if (mode === GAME_MODES.TIME_ATTACK) {
      startModeTimer(options.durationSeconds);
    }
  }

  function startModeTimer(seconds) { 
    clearInterval(modeTimer); 
    modeEndAt = Date.now() + seconds * 1000; 
    updateModeTimer(); 
    modeTimer = setInterval(updateModeTimer, 100); 
  }

  function updateModeTimer() {
    const session = global.gameSession;
    if (!session || session.status !== "playing" || activeMode !== GAME_MODES.TIME_ATTACK) {
      clearInterval(modeTimer);
      return;
    }
    var remainingMs = Math.max(0, modeEndAt - Date.now()), remaining = Math.ceil(remainingMs / 1000); 
    state.remainingSeconds = remaining;
    
    var percent = Math.max(0, remainingMs / (state.durationSeconds * 1000) * 100); 
    byId('timer-bar').style.width = percent + '%';
    
    var warning = remaining <= config.modes.timeAttack.warningSeconds; 
    byId('mode-status').classList.toggle('time-warning', warning);
    byId('mode-status').classList.toggle('time-critical', remaining <= 5);
    document.body.classList.toggle('time-attack-critical', remaining <= 5); 
    byId('timer-bar').style.backgroundColor = warning ? '#F44336' : '#FFB347'; 
    
    renderModeStatus();
    
    if (remainingMs <= 0) {
      clearInterval(modeTimer);
      global.finalizeGameSession({
        reason: "time_expired",
        success: true
      });
    }
  }

  function difficultyRules() { var level = state.difficultyLevel; if (activeMode === GAME_MODES.TIME_ATTACK) return { min: 2, max: 9, options: 4, reverse: .25, memory: 5, trap: state.correctCount >= 20 }; if (level === 1) return { min: 2, max: 5, options: 4, reverse: .1, memory: 5, trap: false }; if (level === 2) return { min: 2, max: 9, options: 4, reverse: .35, memory: 7, trap: false }; return { min: 2, max: 9, options: 6, reverse: .5, memory: 10, trap: true }; }
  function createQuestion() { var rules = difficultyRules(), attempts = 0, a, b, key; do { a = Math.floor(Math.random() * (rules.max - rules.min + 1)) + rules.min; b = Math.floor(Math.random() * 9) + 1; key = a + 'x' + b; attempts += 1; } while (state.recentQuestions.indexOf(key) >= 0 && attempts < 30); state.recentQuestions.push(key); state.recentQuestions = state.recentQuestions.slice(-rules.memory); var reverse = Math.random() < rules.reverse, left = reverse ? b : a, right = reverse ? a : b; return { left: left, right: right, answer: a * b, key: key, optionsCount: rules.options, trap: rules.trap }; }
  
  function nextModeQuestion() { 
    const session = global.gameSession;
    if (!session || session.status !== 'playing') return; 
    try { 
      state.inputLocked = false; 
      var question = createQuestion(); 
      state.currentQuestion = question; 
      questionStartTime = Date.now(); 
      byId('question').textContent = question.left + ' X ' + question.right + ' = ?'; 
      byId('question').className = 'question-text'; 
      byId('feedback').textContent = ''; 
      renderAnswers(question); 
      renderModeStatus(); 
    } catch (error) { 
      console.error('[mode] 문제 생성 실패', error); 
      global.finalizeGameSession({ reason: "error", success: false });
    } 
  }

  function renderAnswers(question) { var options = v2.questionGenerator.createOptions(question.answer, question.optionsCount, question.trap), container = byId('options-container'); container.innerHTML = ''; options.forEach(function (option) { var button = document.createElement('button'); button.className = 'btn btn-answer'; if (question.optionsCount > 4) button.classList.add('btn-answer-small'); button.textContent = option; button.type = 'button'; button.onclick = function () { submitModeAnswer(option, button); }; container.appendChild(button); }); }
  function markAnswerButtons(selectedButton, correctAnswer, correct) { document.querySelectorAll('#options-container .btn-answer').forEach(function (button) { button.disabled = true; if (Number(button.textContent) === Number(correctAnswer)) button.classList.add('answer-choice-correct'); }); if (selectedButton && !correct) selectedButton.classList.add('answer-choice-wrong'); }
  
  function submitModeAnswer(answer, selectedButton) { 
    const session = global.gameSession;
    if (!session || session.status !== 'playing' || state.inputLocked) return; 

    state.inputLocked = true; 
    var correct = answer === state.currentQuestion.answer; 

    session.answeredCount += 1;
    if (correct) {
      session.correctCount += 1;
    } else {
      session.wrongCount += 1;
    }

    session.results.push({
      left: state.currentQuestion.left,
      right: state.currentQuestion.right,
      submittedAnswer: answer,
      correctAnswer: state.currentQuestion.answer,
      isCorrect: correct,
      elapsedMs: Math.round(Date.now() - questionStartTime)
    });

    markAnswerButtons(selectedButton, state.currentQuestion.answer, correct); 
    if (correct) handleModeCorrect(); 
    else handleModeWrong(); 
  }

  function playModeSound(correct) { try { if(v2.soundService){if (correct) v2.soundService.playCorrectSound(); else v2.soundService.playWrongSound();}else playSound(correct ? 'correct' : 'wrong'); if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback(correct?'correct':'wrong'); } catch (error) { playSound(correct ? 'correct' : 'wrong'); } }
  
  function handleModeCorrect() { 
    var nextCombo = state.combo + 1, rules = config.modes[activeMode], points = v2.scoreManager.calculateModeAnswerScore(nextCombo, rules); 
    stateApi.recordCorrectAnswer(points); 
    playModeSound(true); 
    var praise = ''; 
    try { praise = v2.effectService.playCorrect(nextCombo); } 
    catch (error) { console.error('[Mode correct effect error]', error); } 
    byId('feedback').textContent = activeMode === GAME_MODES.TIME_ATTACK ? '' : praise + ' +' + points + 'P'; 
    byId('feedback').className = activeMode === GAME_MODES.TIME_ATTACK ? '' : 'correct-anim'; 
    byId('question').className = 'question-text correct-anim'; 
    
    if (activeMode === GAME_MODES.ENDLESS && state.correctCount % rules.difficultyIncreaseInterval === 0) { 
      stateApi.increaseDifficulty(); 
      byId('feedback').textContent = '난이도 상승! Lv.' + state.difficultyLevel; 
    } 
    continueAfterAnswer(activeMode === GAME_MODES.TIME_ATTACK ? 360 : 450); 
  }

  function handleModeWrong() { 
    stateApi.recordWrongAnswer(); 
    playModeSound(false); 
    byId('feedback').textContent = activeMode === GAME_MODES.TIME_ATTACK ? '' : '💦 오답! 정답은 ' + state.currentQuestion.answer; 
    byId('feedback').className = activeMode === GAME_MODES.TIME_ATTACK ? '' : 'wrong-anim'; 
    byId('question').className = 'question-text wrong-anim'; 
    
    if (activeMode === GAME_MODES.ENDLESS) { 
      state.lives = Math.max(0, state.lives - 1); 
      renderModeStatus(); 
      if (state.lives === 0) { 
        transitionTimer = setTimeout(function () { 
          global.finalizeGameSession({ reason: "no_lives", success: false }); 
        }, 550); 
        return; 
      } 
    } 
    continueAfterAnswer(activeMode === GAME_MODES.TIME_ATTACK ? 420 : 550); 
  }

  function continueAfterAnswer(delay) { 
    renderModeStatus(); 
    transitionTimer = setTimeout(function () { 
      const session = global.gameSession;
      if (session && session.status === 'playing') nextModeQuestion(); 
    }, delay); 
  }

  function renderModeStatus() { 
    if (!activeMode) return; 
    const session = global.gameSession || { totalQuestions: 0, correctCount: 0 };
    var accuracy = session.answeredCount ? Math.round(session.correctCount / session.answeredCount * 100) : 0; 
    byId('q-counter').textContent = activeMode === GAME_MODES.TIME_ATTACK ? '푼 문제: ' + session.answeredCount : '맞힌 문제: ' + session.correctCount; 
    byId('current-accuracy').textContent = '정확도: ' + accuracy + '%'; 
    byId('live-points').textContent = '현재 획득: ' + (session.correctCount * 10) + 'P'; 
    
    if (activeMode === GAME_MODES.TIME_ATTACK) {
      byId('mode-status').innerHTML = '<span>⏱️ 남은 시간 <strong>' + state.remainingSeconds + '초</strong></span><span>콤보 ' + state.combo + '</span><span>최고 ' + state.bestCombo + '</span>'; 
    } else {
      byId('mode-status').innerHTML = '<span>🐾 남은 목숨 <strong>' + state.lives + '</strong></span><span>콤보 ' + state.combo + '</span><span>최고 ' + state.bestCombo + '</span><span>난이도 Lv.' + state.difficultyLevel + '</span>'; 
    }
  }

  function showTimeAttackResultUI(session, savedResult) {
    prepareResultLayout(true);
    var title = '⏱️ 타임어택 종료';
    
    var correctCount = session.correctCount;
    var score = correctCount * 10;
    var wrongCount = session.wrongCount;
    var accuracy = session.answeredCount ? Math.round(correctCount / session.answeredCount * 100) : 0;
    var bestCombo = state.bestCombo || 0;

    var coinsEarned = savedResult && Number.isFinite(Number(savedResult.playCoins))
      ? Number(savedResult.playCoins)
      : Math.floor(score / 2);
    var levelReward = savedResult && Number(savedResult.levelRewardPremiumTickets) > 0
      ? '<small>레벨업 보상: 고급 뽑기권 +' + Number(savedResult.levelRewardPremiumTickets) + '</small>'
      : '';
    var rewardHtml = '<div class="mode-coin-reward"><strong>획득 포인트: +' + score + 'P</strong><span>플레이 보상: 코인 +' + coinsEarned + '</span>' + levelReward + '</div>';
    
    document.querySelector('#result-screen > h1').textContent = title;
    byId('phase2-result-title').textContent = title;
    byId('phase2-result-stats').innerHTML = '<div class="phase2-result-grid"><span>최종 점수 <b>' + score + 'P</b></span><span>정답 <b>' + correctCount + '</b></span><span>오답 <b>' + wrongCount + '</b></span><span>정확도 <b>' + accuracy + '%</b></span><span>최고 콤보 <b>' + bestCombo + '</b></span></div>' + rewardHtml;
    
    byId('phase2-ranking-status').textContent = '결과가 성공적으로 저장되었습니다냥!';
    showScreen('result-screen');
    byId('phase2-result-panel').focus();
  }
  global.showTimeAttackResultUI = showTimeAttackResultUI;

  function exitPhase2ToMain() { 
    if (!activeMode || state.status !== 'playing') return showLobby(); 
    if (global.confirm && !global.confirm('진행 중인 도전을 끝내고 메인으로 돌아갈까요?')) return; 
    global.finalizeGameSession({ reason: "manual_exit", success: false }).then(function() {
      showLobby();
    });
  }
  function restartPhase2Mode() { startPhase2Mode(lastMode); }
  function showModeSelection() { showLobby(); var first = document.querySelector('.mode-card:not([disabled])'); if (first) first.focus(); }
  
  function openRankings() { 
    clearTimers(); 
    prepareResultLayout(true); 
    byId('phase2-result-panel').style.display = 'none'; 
    byId('phase2-result-actions').style.display = 'none'; 
    byId('legacy-result-actions').style.display = 'block'; 
    byId('legacy-result-actions').querySelector('.btn-success').textContent = '메인으로'; 
    byId('ranking-box').style.display = 'block'; 
    byId('ranking-controls').style.display = 'block'; 
    rankingMode = 'overall'; 
    rankingPeriod = 'allTime'; 
    document.querySelector('#result-screen > h1').textContent = '🏆 냥코 순위'; 
    showScreen('result-screen'); 
    loadModeRanking(); 
  }

  function setRankingMode(mode) { rankingMode = mode; loadModeRanking(); }
  function setRankingPeriod(period) { rankingPeriod = period; loadModeRanking(); }
  
  function updateRankingButtons() { 
    document.querySelectorAll('[data-category]').forEach(function (button) { 
      button.classList.toggle('active', button.dataset.category === rankingMode); 
    }); 
    document.querySelectorAll('[data-period]').forEach(function (button) { 
      button.classList.toggle('active', button.dataset.period === rankingPeriod); 
    }); 
  }
  
  function loadModeRanking() { 
    updateRankingButtons(); 
    var list = byId('ranking-list'), retry = byId('ranking-retry'); 
    retry.style.display = 'none'; 
    
    list.replaceChildren();
    list.innerHTML = '<p style="text-align:center;">순위를 불러오는 중...</p>'; 
    
    var category = rankingMode; 
    var period = rankingPeriod;   
    
    var collectionPath = ''; 
    var label = ''; 
    var today = new Date(); 
    var year = today.getFullYear(); 
    var month = String(today.getMonth() + 1).padStart(2, '0'); 
    var monthKey = year + '_' + month; 
    
    if (category === 'overall') { 
      if (period === 'monthly') { 
        collectionPath = 'leaderboards/points_monthly_' + monthKey + '/entries'; 
        label = year + '년 ' + month + '월 월간 포인트 순위'; 
      } else { 
        collectionPath = 'leaderboards/points_alltime/entries'; 
        label = '전체 포인트 순위'; 
      } 
    } else { 
      if (period === 'monthly') { 
        collectionPath = 'leaderboards/timeattack_monthly_' + monthKey + '/entries'; 
        label = year + '년 ' + month + '월 월간 타임어택 순위'; 
      } else { 
        collectionPath = 'leaderboards/timeattack_alltime/entries'; 
        label = '전체 타임어택 최고 기록 순위'; 
      } 
    } 
    
    byId('ranking-period-label').textContent = label; 
    
    if (global.isGuestMode) { 
      list.innerHTML = '<p style="text-align:center; color:#888;">게스트 모드에서는 순위를 볼 수 없다냥!</p>'; 
      return; 
    } 
    
    if (!global.firebaseClient || !global.firebaseClient.db) { 
      list.innerHTML = '<p style="text-align:center; color:#F44336;">Firebase를 사용할 수 없습니다.</p>'; 
      return; 
    } 
    
    var db = global.firebaseClient.db; 
    var currentUid = global.firebaseClient.auth.currentUser ? global.firebaseClient.auth.currentUser.uid : null;

    console.log("[RANKING QUERY PLAN - INITIATED]", {
      boardId: category,
      collectionPath: collectionPath,
      orderByField: "points"
    });

    db.collection(collectionPath)
      .orderBy('points', 'desc')
      .limit(100)
      .get()
      .then(function(querySnapshot) { 
        list.innerHTML = ''; 
        
        console.log("[RANKING QUERY PLAN]", {
          boardId: category,
          collectionPath: collectionPath,
          orderByField: 'points',
          resultCount: querySnapshot.size
        });

        if (querySnapshot.empty) { 
          list.innerHTML = '<p style="text-align:center; color:#888;">아직 등록된 기록이 없습니다.</p>'; 
          return; 
        } 
        
        // 1. 데이터를 배열에 복사
        var items = [];
        querySnapshot.forEach(function(doc) {
          var record = doc.data() || {};
          record.docId = doc.id;
          items.push(record);
        });

        // 2. 동점자 정렬 (points 내림차순, points가 같으면 updatedAt 오름차순)
        items.sort(function(a, b) {
          var diff = (b.points || 0) - (a.points || 0);
          if (diff !== 0) return diff;
          var timeA = a.updatedAt ? (a.updatedAt.seconds || new Date(a.updatedAt).getTime()) : 0;
          var timeB = b.updatedAt ? (b.updatedAt.seconds || new Date(b.updatedAt).getTime()) : 0;
          return timeA - timeB;
        });

        var index = 1; 
        var baseCats = v2.baseCats || []; 
        var inTop100 = false;
        
        items.forEach(function(record) { 
          var isCurrentUser = (currentUid && record.uid === currentUid);
          if (isCurrentUser) {
            inTop100 = true;
          }

          var item = document.createElement('div'); 
          item.className = 'mode-ranking-item'; 
          
          if (isCurrentUser) { 
            item.style.background = '#FFF3E0'; 
            item.style.borderLeft = '4px solid #FF9800'; 
          } 
          
          var catId = record.representativeCatId || 'base_normal_01'; 
          var cat = baseCats.find(function(c) { return c.id === catId; }); 
          var catImage = cat ? cat.image : 'assets/placeholders/cat-placeholder.svg'; 
          
          var suffix = (category === 'overall') ? 'P' : '개'; 
          var pointsText = (record.points || 0).toLocaleString('ko-KR') + suffix; 
          
          item.innerHTML = '<div class="mode-ranking-main" style="display:flex; align-items:center; justify-content:space-between; width:100%;">' + 
                           '  <div style="display:flex; align-items:center; gap:10px;">' + 
                           '    <span style="font-weight:bold; font-size:16px; min-width:30px;">' + index + '위</span>' + 
                           '    <img src="' + catImage + '" style="width:36px; height:36px; object-fit:contain; background:#fff; border-radius:50%; border:1px solid #eee;">' + 
                           '    <b style="font-size:15px;">' + escapeHtml(record.nickname || '익명') + '</b>' + 
                           '  </div>' + 
                           '  <strong style="color:#E65100; font-size:16px;">' + pointsText + '</strong>' + 
                           '</div>'; 
          
          list.appendChild(item); 
          index++; 
        });

        if (!inTop100 && currentUid) {
          db.collection(collectionPath).doc(currentUid).get().then(function(myDoc) {
            if (myDoc.exists) {
              var record = myDoc.data();
              var baseCats = v2.baseCats || [];
              var catId = record.representativeCatId || 'base_normal_01'; 
              var cat = baseCats.find(function(c) { return c.id === catId; }); 
              var catImage = cat ? cat.image : 'assets/placeholders/cat-placeholder.svg'; 
              var suffix = (category === 'overall') ? 'P' : '개'; 
              var pointsText = (record.points || 0).toLocaleString('ko-KR') + suffix;

              var divider = document.createElement('div');
              divider.style.height = '1px';
              divider.style.background = '#ccc';
              divider.style.margin = '15px 0';
              list.appendChild(divider);

              var myItem = document.createElement('div'); 
              myItem.className = 'mode-ranking-item'; 
              myItem.style.background = '#E3F2FD'; 
              myItem.style.borderLeft = '4px solid #2196F3';
              myItem.innerHTML = '<div class="mode-ranking-main" style="display:flex; align-items:center; justify-content:space-between; width:100%;">' + 
                               '  <div style="display:flex; align-items:center; gap:10px;">' + 
                               '    <span style="font-weight:bold; font-size:16px; min-width:30px;">내 순위</span>' + 
                               '    <img src="' + catImage + '" style="width:36px; height:36px; object-fit:contain; background:#fff; border-radius:50%; border:1px solid #eee;">' + 
                               '    <b style="font-size:15px;">' + escapeHtml(record.nickname || '익명') + '</b>' + 
                               '  </div>' + 
                               '  <strong style="color:#1565C0; font-size:16px;">' + pointsText + '</strong>' + 
                               '</div>'; 
              list.appendChild(myItem);
            }
          });
        }
      }) 
      .catch(function(error) { 
        console.error("[RANKING QUERY ERROR]", error); 
        console.error("[RANKING QUERY DETAILS]", {
          code: error?.code,
          message: error?.message,
          boardId: category,
          collectionPath: collectionPath
        });
        list.innerHTML = '<p style="text-align:center; color:#F44336;">순위를 불러오지 못했습니다냥.<br><small>인덱스 설정 또는 권한을 확인해주세요.</small></p>'; 
        retry.style.display = 'inline-block'; 
      }); 
  }
  
  function escapeHtml(value) { var div = document.createElement('div'); div.textContent = String(value); return div.innerHTML; }
  function validateGameConfig() { var errors = []; if (!config.modes.timeAttack.enabled || config.modes.timeAttack.defaultSeconds <= 0) errors.push('타임어택 설정 오류'); if (config.modes.endless.enabled && config.modes.endless.defaultLives < 1) errors.push('무제한 설정 오류'); return { valid: !errors.length, errors: errors }; }
  function validateSaveData() { var data = v2.storageService.loadSaveData(); return { valid: data.schemaVersion === 3 && Array.isArray(data.gameHistory) && data.gameHistory.length <= 50, data: data }; }
  function validateRankingResult(result) { return v2.rankingService.validateScoreSubmission(result); }
  function simulate(mode, reason) { var snapshot = JSON.parse(JSON.stringify(state)); stateApi.startGame(mode, mode === 'timeAttack' ? { durationSeconds: 5 } : { lives: 3 }); stateApi.recordCorrectAnswer(10); stateApi.recordWrongAnswer(); if (mode === 'endless') state.lives = 0; stateApi.finishGame(reason); var simulated = JSON.parse(JSON.stringify(state)); Object.keys(state).forEach(function (key) { delete state[key]; }); Object.assign(state, snapshot); return simulated; }
  global.startPhase2Mode = startPhase2Mode; global.clearPhase2Runtime = clearPhase2Runtime; global.prepareClassicUI = prepareClassicUI; global.exitPhase2ToMain = exitPhase2ToMain; global.restartPhase2Mode = restartPhase2Mode; global.showModeSelection = showModeSelection; global.openRankings = openRankings; global.setRankingMode = setRankingMode; global.setRankingPeriod = setRankingPeriod; global.loadModeRanking = loadModeRanking;
  global.NyankoDebug = { validateGameConfig: validateGameConfig, validateSaveData: validateSaveData, validateRankingResult: validateRankingResult, getKoreanWeekRange: v2.rankingService.getKoreanWeekRange, simulateTimeAttackEnd: function () { return simulate('timeAttack','time_up'); }, simulateEndlessGameOver: function () { return simulate('endless','no_lives'); }, printCurrentGameState: function () { console.table(state); return JSON.parse(JSON.stringify(state)); } };
})(window);
