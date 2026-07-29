(function (global) {
  'use strict';
  var v2 = global.GugudanV2 || {};
  var category = 'overall';
  var period = 'monthly';
  var activeRequest = null;
  var requestSequence = 0;

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) { var node = document.createElement('span'); node.textContent = value == null ? '' : String(value); return node.innerHTML; }
  function context() { return typeof global.getCurrentPlayerContext === 'function' ? global.getCurrentPlayerContext() : {}; }
  function playerId() { var save = v2.storageService && v2.storageService.loadSaveData(); return save && save.profile && save.profile.playerId; }

  function buildControls() {
    var controls = byId('ranking-controls');
    if (!controls) return;
    controls.innerHTML = '<div class="ranking-tab-row ranking-tab-row--main">' +
      '<button data-category="overall" type="button">전체 성적</button><button data-category="timeAttack" type="button">타임어택</button></div>' +
      '<div class="ranking-tab-row ranking-tab-row--period"></div><small id="ranking-period-label"></small>';
    controls.style.display = 'block';
    controls.querySelectorAll('[data-category]').forEach(function (button) {
      button.onclick = function() { setRankingMode(button.dataset.category); };
    });
    renderPeriodButtons();
  }

  function renderPeriodButtons() {
    var row = document.querySelector('.ranking-tab-row--period');
    if (!row) return;
    row.innerHTML = category === 'overall'
      ? '<button data-period="monthly" type="button">월간</button><button data-period="allTime" type="button">누적</button>'
      : '<button data-period="monthly" type="button">월간 최고기록</button><button data-period="allTimeBest" type="button">누적 최고기록</button>';
    row.querySelectorAll('[data-period]').forEach(function (button) {
      button.onclick = function() { setRankingPeriod(button.dataset.period); };
    });
    updateButtons();
  }

  function updateButtons() {
    document.querySelectorAll('[data-category]').forEach(function (button) { button.classList.toggle('active', button.dataset.category === category); });
    document.querySelectorAll('[data-period]').forEach(function (button) { button.classList.toggle('active', button.dataset.period === period); });
    var label = byId('ranking-period-label');
    if (!label) return;
    if (period === 'monthly') label.textContent = v2.rankingService.getKoreaMonthKey() + ' · 한국 시간';
    else label.textContent = '누적 랭킹';
  }

  function setRankingMode(next) {
    category = next === 'timeAttack' ? 'timeAttack' : 'overall';
    period = 'monthly';
    renderPeriodButtons();
    loadModeRanking();
  }

  function setRankingPeriod(next) {
    var allowed = category === 'overall' ? ['monthly', 'allTime'] : ['monthly', 'allTimeBest'];
    if (allowed.indexOf(next) < 0) return;
    period = next;
    updateButtons();
    loadModeRanking();
  }

  function render(records, ownRecord) {
    var list = byId('ranking-list');
    var me = context();
    if (!list) return;
    list.innerHTML = '';
    
    if (!records.length) {
      list.innerHTML = '<p class="ranking-empty">아직 등록된 기록이 없습니다.</p>';
      return;
    }

    // Firestore limit(100) 이후 정렬하므로 100위 경계 동점은 서버 집계 없이는 완전히 결정적이지 않다.
    records.sort(function(a, b) {
      if (b.displayScore !== a.displayScore) {
        return b.displayScore - a.displayScore;
      }
      var tA = a.playedAtTimestamp && Number.isFinite(Number(a.playedAtTimestamp.seconds))
        ? Number(a.playedAtTimestamp.seconds) * 1000
        : new Date(a.playedAt).getTime();
      var tB = b.playedAtTimestamp && Number.isFinite(Number(b.playedAtTimestamp.seconds))
        ? Number(b.playedAtTimestamp.seconds) * 1000
        : new Date(b.playedAt).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.playerId || '').localeCompare(String(b.playerId || ''));
    });

    records.forEach(function (record, index) {
      var item = document.createElement('div');
      item.className = 'mode-ranking-item' + (record.playerId === playerId() ? ' is-me' : '');
      
      // 대표 고양이 이미지 바인딩
      var cat = v2.releasePolicyService.getVisibleCats().find(function(c) { return c.id === record.representativeCatId; });
      var catImgSrc = cat ? cat.image : 'assets/placeholders/cat-placeholder.svg';

      var suffix = category === 'overall' ? 'P' : '개';

      item.innerHTML = '<div class="leaderboard-player-line">' +
                       '<img class="ranking-cat-thumb" src="' + catImgSrc + '" alt="">' +
                       '<span class="leaderboard-rank">' + (index + 1) + '위</span>' +
                       '<span class="leaderboard-nickname">' + escapeHtml(record.nickname || '익명') + '</span></div>' +
                       '<strong>' + Number(record.displayScore).toLocaleString('ko-KR') + suffix + '</strong>';
      list.appendChild(item);
    });

    var inTopTen = ownRecord && records.some(function (record) { return record.playerId === ownRecord.playerId; });
    if (ownRecord && !inTopTen) {
      var own = document.createElement('div');
      own.className = 'mode-ranking-item ranking-own-outside';
      
      var ownCat = v2.releasePolicyService.getVisibleCats().find(function(c) { return c.id === ownRecord.representativeCatId; });
      var ownCatImgSrc = ownCat ? ownCat.image : 'assets/placeholders/cat-placeholder.svg';

      var suffix = category === 'overall' ? 'P' : '개';

      own.innerHTML = '<div class="leaderboard-player-line">' +
                       '<img class="ranking-cat-thumb" src="' + ownCatImgSrc + '" alt="">' +
                       '<span class="leaderboard-rank">100위 밖 · 내 기록</span>' +
                       '<span class="leaderboard-nickname">' + escapeHtml(ownRecord.nickname || me.nickname || '') + '</span></div>' +
                       '<strong>' + Number(ownRecord.displayScore).toLocaleString('ko-KR') + suffix + '</strong>';
      list.appendChild(own);
    }
  }

  function renderLoadError(result) {
    var list = byId('ranking-list');
    if (!list) return;
    list.innerHTML = '<p class="ranking-error">순위를 불러오지 못했습니다.</p>' +
      '<button class="ranking-retry-button" type="button">재시도</button>';
    var retryButton = list.querySelector('.ranking-retry-button');
    if (retryButton) {
      retryButton.onclick = function () {
        if (activeRequest) return;
        retryButton.disabled = true;
        loadModeRanking();
      };
    }
    if (result && result.error) console.error('[LEADERBOARD LOAD ERROR DETAIL]', result.error);
    if (result && result.indexUrl) console.error('[LEADERBOARD INDEX CREATION URL]', result.indexUrl);
  }

  function loadModeRanking() {
    updateButtons();
    var list = byId('ranking-list');
    if (!list) return Promise.resolve();
    var options = { category: category, period: period };
    var requestKey = category + ':' + period;
    if (activeRequest && activeRequest.key === requestKey) return activeRequest.promise;

    list.innerHTML = '<p class="ranking-empty">순위를 불러오는 중입니다.</p>';
    var currentRequest = ++requestSequence;
    var promise = Promise.all([
        v2.rankingService.getLeaderboard(options),
        v2.rankingService.getPlayerRecord(Object.assign({ playerId: playerId() }, options))
      ]).then(function (results) {
      if (currentRequest !== requestSequence) return;
      if (!results[0].ok) {
        renderLoadError(results[0]);
        return;
      }
      render(results[0].records, results[1]);
    }).catch(function (error) {
      if (currentRequest !== requestSequence) return;
      renderLoadError({ error: error });
      console.error('[LEADERBOARD LOAD EXCEPTION]', error);
    }).finally(function () {
      if (activeRequest && activeRequest.sequence === currentRequest) activeRequest = null;
    });
    activeRequest = { key: requestKey, sequence: currentRequest, promise: promise };
    return promise;
  }

  function openRankings() {
    if (typeof global.clearPhase2Runtime === 'function') global.clearPhase2Runtime();
    if (typeof global.prepareClassicUI === 'function') global.prepareClassicUI();
    category = 'overall'; period = 'monthly';
    activeRequest = null;
    requestSequence += 1;
    
    buildControls();
    
    var guideText = byId('ranking-guideline-text');
    if (guideText) {
      guideText.textContent = '※ 순위는 매 게임 종료 후 실시간으로 반영된다냥!';
    }
    
    if (typeof global.showScreen === 'function') global.showScreen('ranking');
    loadModeRanking();
  }

  global.openRankings = openRankings;
  global.setRankingMode = setRankingMode;
  global.setRankingPeriod = setRankingPeriod;
  global.loadModeRanking = loadModeRanking;
})(window);
