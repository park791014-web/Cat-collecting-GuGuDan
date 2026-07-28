(function (global) {
  'use strict';
  var v2 = global.GugudanV2, pendingClaims = {};

  function rewardText(reward) {
    var parts = [];
    if (reward.coins) parts.push('🪙 ' + reward.coins + '코인');
    if (reward.normalTickets) parts.push('🎫 일반 뽑기권 ' + reward.normalTickets + '장');
    if (reward.premiumTickets) parts.push('🌟 고급 뽑기권 ' + reward.premiumTickets + '장');
    return parts.join(' · ') || '보상 없음';
  }

  async function claimAndRender(id, button) {
    if (pendingClaims[id]) return;
    pendingClaims[id] = true;
    button.disabled = true;
    try {
      await Promise.resolve(v2.dailyMissionService.claimMission(id));
    } catch (error) {
      console.error('[DAILY MISSION CLAIM ERROR]', { missionId: id, message: error && error.message });
    } finally {
      pendingClaims[id] = false;
      render();
      if (global.renderPhase4Currency) global.renderPhase4Currency();
    }
  }

  function render() {
    var root = document.getElementById('daily-missions');
    if (!root) return;
    var daily = v2.dailyMissionService.getDailyMissions();
    root.innerHTML = '<div class="daily-title"><div><h3>오늘의 미션</h3><small>' + daily.dateKey + ' · 매일 3개 · 한국 시간</small></div></div><div class="daily-grid"></div>';
    var grid = root.querySelector('.daily-grid');
    daily.activeMissionIds.forEach(function (id) {
      var config = v2.dailyMissionConfig[id], state = daily.missions[id];
      if (!config || !state) return;
      var card = document.createElement('article');
      card.className = 'daily-mission-card';
      card.innerHTML = '<strong>' + config.title + '</strong><small class="daily-mission-reward">보상: ' + rewardText(config.reward || {}) + '</small><progress max="' + state.target + '" value="' + state.progress + '" aria-label="' + config.title + ' ' + state.progress + ' / ' + state.target + '"></progress><span>' + state.progress + ' / ' + state.target + '</span><button type="button" ' + (!state.completed || state.claimed || pendingClaims[id] ? 'disabled' : '') + '>' + (state.claimed ? '수령 완료' : state.completed ? '보상 받기' : '진행 중') + '</button>';
      var button = card.querySelector('button');
      button.onclick = function () { claimAndRender(id, button); };
      grid.appendChild(card);
    });
  }

  global.renderDailyMissions = render;
})(window);
