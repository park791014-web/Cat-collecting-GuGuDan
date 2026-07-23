(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var backButtonHandlerInitialized = false;
  var isProcessing = false;

  function initBackButtonHandler() {
    if (backButtonHandlerInitialized) return;
    backButtonHandlerInitialized = true;

    // 가짜 히스토리 1개 적재
    history.pushState({ active: true }, null, '');

    window.addEventListener('popstate', function(event) {
      if (isProcessing) return;
      isProcessing = true;

      var activeScreen = document.querySelector('.screen.active-screen');
      var activeScreenId = activeScreen ? activeScreen.id : '';

      // 1. 게임 중인 화면인 경우 (play-screen)
      if (activeScreenId === 'play-screen') {
        var confirmClose = confirm("진행 중인 게임을 종료하시겠습니까?");
        if (confirmClose) {
          // 게임 종료 로비 이동
          if (window.exitPhase2ToMain) {
            // modeEngine 모드 게임 종료
            window.exitPhase2ToMain();
          } else {
            // app.js 클래식 게임 종료
            if (window.clearClassicRuntime) window.clearClassicRuntime();
            if (global.showScreen) global.showScreen('lobby-screen');
          }
          // 취소/종료 액션 완료 후 가짜 스테이트 재적재
          history.pushState({ active: true }, null, '');
        } else {
          // 계속하기: 히스토리 복원
          history.pushState({ active: true }, null, '');
        }
      }
      // 2. 로비 화면인 경우 (lobby-screen 또는 최초 진입 시 login-screen)
      else if (activeScreenId === 'lobby-screen' || activeScreenId === 'login-screen') {
        var confirmExit = confirm("게임을 종료하시겠습니까?");
        if (confirmExit) {
          if (navigator.app && navigator.app.exitApp) {
            navigator.app.exitApp();
          } else {
            window.close();
          }
        } else {
          // 취소 시 히스토리 복원
          history.pushState({ active: true }, null, '');
        }
      }
      // 3. 기타 서브 화면 (도감, 설정, 순위, 스테이지 선택 등)
      else {
        // 기타 서브 화면에서 뒤로가기 시 로비로 복귀
        if (global.showLobby) {
          global.showLobby();
        } else if (global.showScreen) {
          global.showScreen('lobby-screen');
        }
        history.pushState({ active: true }, null, '');
      }

      // 비동기 딜레이를 주어 popstate 추가 연속 유발 루프 방지
      setTimeout(function() {
        isProcessing = false;
      }, 100);
    });
  }

  v2.initBackButtonHandler = initBackButtonHandler;
})(window);
