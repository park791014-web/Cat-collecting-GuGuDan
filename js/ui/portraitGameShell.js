(function (global) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function selectedCatImage() {
    var v2 = global.GugudanV2;
    var cat = v2 && v2.releasePolicyService && v2.releasePolicyService.getSelectedCat
      ? v2.releasePolicyService.getSelectedCat()
      : null;
    return cat ? { src: cat.image || cat.fallbackImage || '', label: cat.displayName || '냥코' } : { src: '', label: '' };
  }

  function renderGameShell(options) {
    options = options || {};
    var shell = document.querySelector('.portrait-game-shell');
    if (!shell) return;

    var isAdventure = options.mode === 'adventure';
    var isBoss = Boolean(options.showBossHp);
    var visual = byId('game-visual-card');
    var visualImage = byId('game-visual-image');
    var visualLabel = byId('game-visual-label');
    var bossPanel = byId('boss-panel');
    var timer = byId('timer-bar');
    var title = byId('game-shell-title');
    var stageLabel = byId('game-shell-stage-label');
    var cat = selectedCatImage();
    var image = options.enemyImage || cat.src;

    shell.dataset.gameMode = options.mode || 'classic';
    shell.dataset.enemyType = options.enemyType || 'cat';
    shell.classList.toggle('portrait-game-shell--boss', isBoss);
    document.body.classList.add('portrait-game-active');

    if (title) title.textContent = options.title || '구구단 게임';
    if (stageLabel) {
      stageLabel.textContent = options.stageLabel || '';
      stageLabel.hidden = !options.stageLabel;
    }
    if (timer && timer.parentElement) timer.parentElement.style.display = options.showTimer ? '' : 'none';

    if (visual) visual.hidden = isBoss;
    if (visualImage) {
      visualImage.src = isBoss ? '' : image;
      visualImage.alt = isBoss ? '' : (options.enemyType === 'enemy' ? '스테이지 적' : cat.label || '선택한 고양이');
    }
    if (visualLabel) visualLabel.textContent = isBoss ? '' : (options.enemyLabel || cat.label || '');
    if (bossPanel) bossPanel.style.display = isBoss ? '' : 'none';

    if (isBoss) {
      var hpBar = byId('boss-hp-bar');
      var hpText = byId('boss-hp-text');
      var hp = Number(options.bossHp);
      var maxHp = Number(options.bossMaxHp);
      if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0) {
        if (hpBar) hpBar.style.width = Math.max(0, Math.min(100, hp / maxHp * 100)) + '%';
        if (hpText) hpText.textContent = hp + '/' + maxHp;
      }
    }

    if (!isAdventure) {
      var skillHud = byId('skill-hud');
      if (skillHud) skillHud.style.display = 'none';
    }
  }

  function setGameAnswerFeedback(kind, message) {
    var feedback = byId('feedback');
    if (!feedback) return;
    feedback.className = 'game-answer-feedback is-' + (kind === 'correct' ? 'correct' : 'wrong');
    feedback.textContent = message == null ? (kind === 'correct' ? '정답이다냥!' : '아쉽다냥!') : message;
  }

  function clearPortraitGameShell() {
    var shell = document.querySelector('.portrait-game-shell');
    var feedback = byId('feedback');
    var visual = byId('game-visual-card');
    var visualImage = byId('game-visual-image');
    var visualLabel = byId('game-visual-label');
    if (feedback) {
      feedback.className = '';
      feedback.textContent = '';
    }
    if (shell) {
      shell.dataset.gameMode = 'idle';
      shell.dataset.enemyType = '';
      shell.classList.remove('portrait-game-shell--boss');
    }
    if (visual) visual.hidden = false;
    if (visualImage) {
      visualImage.removeAttribute('src');
      visualImage.alt = '';
    }
    if (visualLabel) visualLabel.textContent = '';
    document.body.classList.remove('portrait-game-active');
  }

  global.renderGameShell = renderGameShell;
  global.setGameAnswerFeedback = setGameAnswerFeedback;
  global.clearPortraitGameShell = clearPortraitGameShell;
})(window);
