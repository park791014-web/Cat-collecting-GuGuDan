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
      : '<button data-period="weeklyBest" type="button">주간 최고기록</button><button data-period="allTimeBest" type="button">누적 최고기록</button>';
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
    if (category === 'overall' && period === 'monthly') label.textContent = v2.rankingService.getKoreaMonthKey() + ' · 한국 시간';
    else if (category === 'timeAttack' && period === 'weeklyBest') label.textContent = v2.rankingService.getKoreanWeekRange().weekKey + ' · 한국 시간';
    else label.textContent = '누적 랭킹';
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
    if (!list) return;
    list.innerHTML = '';
    
    if (!records.length) {
      list.innerHTML = '<p class="ranking-empty">아직 등록된 기록이 없습니다.</p>';
      return;
    }

    // 클라이언트 메모리 정렬 (주 점수 내림차순 -> KST 갱신일playedAtTimestamp/playedAt 오름차순)
    records.sort(function(a, b) {
      if (b.displayScore !== a.displayScore) {
        return b.displayScore - a.displayScore;
      }
      var tA = a.playedAtTimestamp ? (a.playedAtTimestamp.seconds || new Date(a.playedAt).getTime()) : new Date(a.playedAt).getTime();
      var tB = b.playedAtTimestamp ? (b.playedAtTimestamp.seconds || new Date(b.playedAt).getTime()) : new Date(b.playedAt).getTime();
      return tA - tB;
    });

    records.forEach(function (record, index) {
      var item = document.createElement('div');
      item.className = 'mode-ranking-item' + (record.playerId === playerId() ? ' is-me' : '');
      
      // 대표 고양이 이미지 바인딩
      var cat = v2.releasePolicyService.getVisibleCats().find(function(c) { return c.id === record.representativeCatId; });
      var catImgSrc = cat ? cat.image : 'assets/placeholders/cat-placeholder.svg';

      var suffix = category === 'overall' ? 'P' : '개';

      item.innerHTML = '<span style="display:flex; align-items:center;">' +
                       '<img class="ranking-cat-thumb" src="' + catImgSrc + '" style="width:30px; height:30px; border-radius:50%; margin-right:8px; object-fit:contain; background-color:#eee; border:1px solid #ddd;" alt="">' +
                       '<b>' + (index + 1) + '위</b> ' + escapeHtml(record.nickname || '익명') + '</span>' +
                       '<strong>' + record.displayScore + suffix + '</strong>';
      list.appendChild(item);
    });

    var inTopTen = ownRecord && records.some(function (record) { return record.playerId === ownRecord.playerId; });
    if (ownRecord && !inTopTen) {
      var own = document.createElement('div');
      own.className = 'mode-ranking-item ranking-own-outside';
      
      var ownCat = v2.releasePolicyService.getVisibleCats().find(function(c) { return c.id === ownRecord.representativeCatId; });
      var ownCatImgSrc = ownCat ? ownCat.image : 'assets/placeholders/cat-placeholder.svg';

      var suffix = category === 'overall' ? 'P' : '개';

      own.innerHTML = '<span style="display:flex; align-items:center;">' +
                       '<img class="ranking-cat-thumb" src="' + ownCatImgSrc + '" style="width:30px; height:30px; border-radius:50%; margin-right:8px; object-fit:contain; background-color:#eee; border:1px solid #ddd;" alt="">' +
                       '<b>10위 밖 · 내 기록</b> ' + escapeHtml(ownRecord.nickname || me.nickname || '') + '</span>' +
                       '<strong>' + ownRecord.displayScore + suffix + '</strong>';
      list.appendChild(own);
    }
  }

  async function loadModeRanking() {
    updateButtons();
    var list = byId('ranking-list');
    if (!list) return;
    list.innerHTML = '<p class="ranking-empty">순위를 불러오는 중...</p>';
    var options = { category: category, period: period };
    
    try {
      var results = await Promise.all([
        v2.rankingService.getLeaderboard(options),
        v2.rankingService.getPlayerRecord(Object.assign({ playerId: playerId() }, options))
      ]);
      
      if (!results[0].ok) {
        list.innerHTML = '<p class="ranking-error">순위를 불러오지 못했습니다.</p>';
        console.error("[LEADERBOARD LOAD ERROR DETAIL]", results[0].error);
        if (results[0].indexUrl) {
          console.error("[LEADERBOARD INDEX CREATION URL]", results[0].indexUrl);
        }
        return;
      }
      render(results[0].records, results[1]);
    } catch(err) {
      list.innerHTML = '<p class="ranking-error">순위를 불러오지 못했습니다.</p>';
      console.error("[LEADERBOARD LOAD EXCEPTION]", err);
    }
  }

  function openRankings() {
    if (typeof global.clearPhase2Runtime === 'function') global.clearPhase2Runtime();
    if (typeof global.prepareClassicUI === 'function') global.prepareClassicUI();
    category = 'overall'; period = 'monthly';
    
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
