(function (global) {
  'use strict';
  var v2 = global.GugudanV2 || {};
  var category = 'points'; // V4 category: points / timeAttack
  var period = 'monthly';   // V4 period: monthly / allTime

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) { var node = document.createElement('span'); node.textContent = value == null ? '' : String(value); return node.innerHTML; }
  function context() { return typeof global.getCurrentPlayerContext === 'function' ? global.getCurrentPlayerContext() : {}; }
  function playerId() { var save = v2.storageService && v2.storageService.loadSaveData(); return save && save.profile && save.profile.playerId; }

  function buildControls() {
    var controls = byId('ranking-controls');
    controls.innerHTML = '<div class="ranking-tab-row ranking-tab-row--main">' +
      '<button data-category="points" type="button">전체 성적</button><button data-category="timeAttack" type="button">타임어택</button></div>' +
      '<div class="ranking-tab-row ranking-tab-row--period"></div><small id="ranking-period-label"></small>';
    controls.style.display = 'block';
    controls.querySelectorAll('[data-category]').forEach(function (button) {
      button.addEventListener('click', function () { setRankingMode(button.dataset.category); });
    });
    renderPeriodButtons();
  }

  function renderPeriodButtons() {
    var row = document.querySelector('.ranking-tab-row--period');
    if (!row) return;
    row.innerHTML = '<button data-period="monthly" type="button">월간</button><button data-period="allTime" type="button">누적</button>';
    row.querySelectorAll('[data-period]').forEach(function (button) {
      button.addEventListener('click', function () { setRankingPeriod(button.dataset.period); });
    });
    updateButtons();
  }

  function updateButtons() {
    document.querySelectorAll('[data-category]').forEach(function (button) { button.classList.toggle('active', button.dataset.category === category); });
    document.querySelectorAll('[data-period]').forEach(function (button) { button.classList.toggle('active', button.dataset.period === period); });
    var label = byId('ranking-period-label');
    if (!label) return;
    var monthStr = v2.rankingService.getKoreaMonthKey();
    if (category === 'points') {
      if (period === 'monthly') label.textContent = monthStr + ' 월간 포인트 랭킹';
      else label.textContent = '통합 전체 포인트 랭킹 (V4)';
    } else {
      if (period === 'monthly') label.textContent = monthStr + ' 월간 타임어택 최고기록';
      else label.textContent = '전체 타임어택 최고기록 (V4)';
    }
  }

  function setRankingMode(next) {
    category = next === 'timeAttack' ? 'timeAttack' : 'points';
    updateButtons();
    loadModeRanking();
  }

  function setRankingPeriod(next) {
    if (next !== 'monthly' && next !== 'allTime') return;
    period = next;
    updateButtons();
    loadModeRanking();
  }

  function render(records, ownRecord) {
    var list = byId('ranking-list');
    var me = context();
    list.innerHTML = '';
    if (!records.length) list.innerHTML = '<p class="ranking-empty">아직 등록된 기록이 없어요.</p>';
    
    var suffix = category === 'timeAttack' ? '개' : 'P';
    
    records.forEach(function (record, index) {
      var item = document.createElement('div');
      item.className = 'mode-ranking-item' + (record.playerId === playerId() ? ' is-me' : '');
      item.innerHTML = '<span><b>' + (index + 1) + '위</b> ' + escapeHtml(record.nickname || '익명') + '</span><strong>' + record.displayScore + suffix + '</strong>';
      list.appendChild(item);
    });
    var inTopTen = ownRecord && records.some(function (record) { return record.id === ownRecord.id; });
    if (ownRecord && !inTopTen) {
      var own = document.createElement('div');
      own.className = 'mode-ranking-item ranking-own-outside';
      own.innerHTML = '<span><b>10위 밖 · 내 기록</b> ' + escapeHtml(ownRecord.nickname || me.nickname || '') + '</span><strong>' + ownRecord.displayScore + suffix + '</strong>';
      list.appendChild(own);
    }
  }

  async function loadModeRanking() {
    updateButtons();
    var list = byId('ranking-list');
    var retry = byId('ranking-retry');
    retry.style.display = 'none';
    list.innerHTML = '<p class="ranking-empty">순위를 불러오는 중...</p>';
    var options = { category: category, period: period };
    var results = await Promise.all([
      v2.rankingService.getLeaderboard(options),
      v2.rankingService.getPlayerRecord(Object.assign({ playerId: playerId() }, options))
    ]);
    if (!results[0].ok) {
      list.innerHTML = '<p class="ranking-error">순위를 불러오지 못했어요.<br><small>Firebase 설정을 확인해 주세요.</small></p>';
      retry.style.display = 'inline-block';
      return;
    }
    render(results[0].records, results[1]);
  }

  function openRankings() {
    if (typeof global.clearPhase2Runtime === 'function') global.clearPhase2Runtime();
    if (typeof global.prepareClassicUI === 'function') global.prepareClassicUI();
    category = 'points'; period = 'monthly';
    byId('phase2-result-panel').style.display = 'none';
    byId('phase2-result-actions').style.display = 'none';
    byId('legacy-result-actions').style.display = 'block';
    byId('ranking-box').style.display = 'block';
    document.querySelector('#result-screen > h1').textContent = '🏆 냥코 순위';
    var subtitle = document.querySelector('#ranking-box > h3');
    if (subtitle) subtitle.textContent = '새로운 랭킹 시즌 V4';
    buildControls();
    if (typeof global.showScreen === 'function') global.showScreen('result-screen');
    loadModeRanking();
  }

  global.openRankings = openRankings;
  global.setRankingMode = setRankingMode;
  global.setRankingPeriod = setRankingPeriod;
  global.loadModeRanking = loadModeRanking;
})(window);
