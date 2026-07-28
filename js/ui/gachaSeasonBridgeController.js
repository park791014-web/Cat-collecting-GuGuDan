(function (global) {
  'use strict';

  var openSeasonScreen = global.openSeasonScreen;
  if (typeof openSeasonScreen !== 'function') return;

  function bindSeasonDrawButton(seasonId) {
    var actions = document.getElementById('season-actions');
    var button = actions && actions.querySelector('button.game-button.primary');
    if (!button) return;

    button.dataset.drawType = 'seasonTicket';
    button.onclick = async function () {
      if (button.disabled) return;
      console.info('[GACHA BUTTON CLICK]', {
        drawType: button.dataset.drawType,
        uid: firebase.auth().currentUser?.uid || null,
        buttonText: button.innerText,
        buttonHtml: button.outerHTML
      });

      button.disabled = true;
      try {
        var result = await global.handleDrawRequest(button.dataset.drawType);
        if (!result || !result.ok) throw new Error(result?.reason || 'gacha_failed');
        global.openCatDetail(result.cat.id);
        global.openSeasonScreen(seasonId);
      } catch (error) {
        console.error('[SEASON GACHA ERROR]', error);
        alert('뽑기 결과를 서버에 저장하지 못했습니다. 재화는 차감되지 않았습니다.');
        button.disabled = false;
      }
    };
  }

  global.openSeasonScreen = function (seasonId) {
    var result = openSeasonScreen(seasonId);
    bindSeasonDrawButton(seasonId);
    return result;
  };
})(window);
