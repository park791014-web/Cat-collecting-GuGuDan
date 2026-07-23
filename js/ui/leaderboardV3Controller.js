(function (global) {
  'use strict';
  var v2 = global.GugudanV2 || {};
  var category = 'overall';
  var period = 'monthly';

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) { var node = document.createElement('span'); node.textContent = value == null ? '' : String(value); return node.innerHTML; }
  function context() { return typeof global.getCurrentPlayerContext === 'function' ? global.getCurrentPlayerContext() : {}; }
  function playerId() { var save = v2.storageService && v2.storageService.loadSaveData(); return save && save.profile && save.profile.playerId; }

  function buildControls() {
    var controls = byId('ranking-controls');
    controls.innerHTML = '<div class="ranking-tab-row ranking-tab-row--main">' +
      '<button data-category="overall" type="button">전체 성적</button><button data-category="timeAttack" type="button">타임어택</button></div>' +
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
    row.innerHTML = category === 'overall'
      ? '<button data-period="monthly" type="button">월간</button><button data-period="allTime" type="button">누적</button>'
      : '<button data-period="weeklyBest" type="button">주간 최고기록</button><button data-period="allTimeBest" type="button">누적 최고기록</button>';
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
    if (category === 'overall' && period === 'monthly') label.textContent = v2.rankingService.getKoreaMonthKey() + ' · 한국 시간';
    else if (category === 'timeAttack' && period === 'weeklyBest') label.textContent = v2.rankingService.getKoreanWeekRange().weekKey + ' · 한국 시간';
    else label.textContent = '랭킹 v3 적용 이후 누적';
  }

  function setRankingMode(next) {
    category = next === 'timeAttack' ? 'timeAttack' : 'overall';
    period = category === 'overall' ? 'monthly' : 'weeklyBest';
    renderPeriodButtons();
    loadModeRanking();
  }

  function setRankingPeriod(next) {
    var allowed = category === 'overall' ? ['monthly', 'allTime'] : ['weeklyBest', 'allTimeBest'];
    if (allowed.indexOf(next) < 0) return;
    period = next;
    updateButtons();
    loadModeRanking();
  }

  function render(records, ownRecord) {
    var list = byId('ranking-list');
    var me = context();
    list.innerHTML = '';
    if (!records.length) list.innerHTML = '<p class="ranking-empty">아직 등록된 기록이 없어요.</p>';
    records.forEach(function (record, index) {
      var item = document.createElement('div');
      item.className = 'mode-ranking-item' + (record.playerId === playerId() ? ' is-me' : '');
      item.innerHTML = '<span><b>' + (index + 1) + '위</b> ' + escapeHtml(record.nickname || '익명') + '</span><strong>' + record.displayScore + 'P</strong>';
      list.appendChild(item);
    });
    var inTopTen = ownRecord && records.some(function (record) { return record.id === ownRecord.id; });
    if (ownRecord && !inTopTen) {
      var own = document.createElement('div');
      own.className = 'mode-ranking-item ranking-own-outside';
      own.innerHTML = '<span><b>10위 밖 · 내 기록</b> ' + escapeHtml(ownRecord.nickname || me.nickname || '') + '</span><strong>' + ownRecord.displayScore + 'P</strong>';
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
      list.innerHTML = '<p class="ranking-error">순위를 불러오지 못했어요.<br><small>개발자 콘솔에서 Firebase 인덱스 안내를 확인해 주세요.</small></p>';
      retry.style.display = 'inline-block';
      return;
    }
    render(results[0].records, results[1]);
  }

  function openRankings() {
    if (typeof global.clearPhase2Runtime === 'function') global.clearPhase2Runtime();
    if (typeof global.prepareClassicUI === 'function') global.prepareClassicUI();
    category = 'overall'; period = 'monthly';
    byId('phase2-result-panel').style.display = 'none';
    byId('phase2-result-actions').style.display = 'none';
    byId('legacy-result-actions').style.display = 'block';
    byId('ranking-box').style.display = 'block';
    document.querySelector('#result-screen > h1').textContent = '🏆 냥코 순위';
    document.querySelector('#ranking-box > h3').textContent = '새롭게 시작된 랭킹';
    buildControls();
    if (typeof global.showScreen === 'function') global.showScreen('result-screen');
    loadModeRanking();
  }

  global.openRankings = openRankings;
  global.setRankingMode = setRankingMode;
  global.setRankingPeriod = setRankingPeriod;
  global.loadModeRanking = loadModeRanking;
})(window);
