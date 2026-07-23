(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  var initial = { mode: 'classic', status: 'ready', sessionId: null, startedAt: null, finishedAt: null,
    currentQuestion: null, recentQuestions: [], score: 0, combo: 0, bestCombo: 0, correctCount: 0,
    wrongCount: 0, totalQuestions: 0, lives: null, initialLives: null, remainingSeconds: null,
    durationSeconds: null, difficultyLevel: 1, selectedCatId: null, activeSkill: null,
    currentEpisode: null, currentStage: null, inputLocked: false, finishReason: null };
  var state = {};
  function createSessionId() { return 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10); }
  function resetGameState(mode) { Object.keys(state).forEach(function (key) { delete state[key]; }); Object.assign(state, JSON.parse(JSON.stringify(initial))); state.mode = mode || 'classic'; return state; }
  function startGame(mode, options) { options = options || {}; resetGameState(mode); state.status = 'playing'; state.sessionId = createSessionId(); state.startedAt = new Date().toISOString(); state.durationSeconds = options.durationSeconds == null ? null : options.durationSeconds; state.remainingSeconds = state.durationSeconds; state.initialLives = options.lives == null ? null : options.lives; state.lives = state.initialLives; return state; }
  function pauseGame() { if (state.status === 'playing') state.status = 'paused'; return state; }
  function finishGame(reason) { if (state.status === 'finished') return false; state.status = 'finished'; state.finishedAt = new Date().toISOString(); state.finishReason = reason || 'completed'; state.inputLocked = true; return true; }
  function recordCorrectAnswer(points) { state.correctCount += 1; state.totalQuestions += 1; state.combo += 1; state.bestCombo = Math.max(state.bestCombo, state.combo); state.score += Number(points) || 0; return state; }
  function recordWrongAnswer() { state.wrongCount += 1; state.totalQuestions += 1; state.combo = 0; return state; }
  resetGameState();
  function increaseDifficulty() { state.difficultyLevel += 1; return state.difficultyLevel; }
  global.GugudanV2.gameState = { state: state, resetGameState: resetGameState, startGame: startGame, pauseGame: pauseGame, finishGame: finishGame, recordCorrectAnswer: recordCorrectAnswer, recordWrongAnswer: recordWrongAnswer, increaseDifficulty: increaseDifficulty };
})(window);
