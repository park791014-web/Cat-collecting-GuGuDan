(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  
  var guard = {
    initialized: false,
    confirmOpen: false,
    allowExitOnce: false,
    restoringState: false
  };

  // 모달 엘리먼트 동적 템플릿 생성
  function showCustomConfirm(message, confirmText, cancelText, onConfirm, onCancel) {
    if (guard.confirmOpen) return;
    guard.confirmOpen = true;

    var overlay = document.createElement('div');
    overlay.id = 'back-guard-confirm-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';

    var container = document.createElement('div');
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '24px';
    container.style.borderRadius = '16px';
    container.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
    container.style.width = '100%';
    container.style.maxWidth = '320px';
    container.style.textAlign = 'center';
    container.style.fontFamily = 'sans-serif';
    container.style.boxSizing = 'border-box';

    var text = document.createElement('p');
    text.innerText = message;
    text.style.fontSize = '16px';
    text.style.color = '#333333';
    text.style.fontWeight = 'bold';
    text.style.margin = '0 0 20px 0';
    text.style.lineHeight = '1.4';
    container.appendChild(text);

    var buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '10px';
    buttonGroup.style.justifyContent = 'center';

    var cancelBtn = document.createElement('button');
    cancelBtn.innerText = cancelText;
    cancelBtn.style.padding = '12px 20px';
    cancelBtn.style.border = '1px solid #cccccc';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.backgroundColor = '#f5f5f5';
    cancelBtn.style.color = '#333333';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.flex = '1';
    cancelBtn.onclick = function() {
      document.body.removeChild(overlay);
      guard.confirmOpen = false;
      onCancel();
    };
    buttonGroup.appendChild(cancelBtn);

    var confirmBtn = document.createElement('button');
    confirmBtn.innerText = confirmText;
    confirmBtn.style.padding = '12px 20px';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.backgroundColor = '#ff4081';
    confirmBtn.style.color = '#ffffff';
    confirmBtn.style.fontSize = '14px';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.flex = '1';
    confirmBtn.onclick = function() {
      document.body.removeChild(overlay);
      guard.confirmOpen = false;
      onConfirm();
    };
    buttonGroup.appendChild(confirmBtn);

    container.appendChild(buttonGroup);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  function initBackButtonHandler() {
    if (guard.initialized) return;
    guard.initialized = true;

    // 가짜 히스토리 스테이트 추가
    history.pushState({ guardActive: true }, null, '');

    window.addEventListener('popstate', function(event) {
      if (guard.allowExitOnce) {
        // 이미 종료를 선택하여 빠져나가는 중인 경우 검사 해제
        return;
      }

      // 복구 상태에서는 무시
      if (guard.restoringState) {
        guard.restoringState = false;
        return;
      }

      var activeScreen = document.querySelector('.screen.active-screen');
      var activeScreenId = activeScreen ? activeScreen.id : '';

      // 1. 게임 진행 중 화면 (play-screen)
      if (activeScreenId === 'play-screen') {
        // 가짜 상태를 다시 적재해서 뒤로가기 방어 상태 복원
        guard.restoringState = true;
        history.pushState({ guardActive: true }, null, '');

        showCustomConfirm(
          "진행 중인 게임을 종료하시겠습니까?",
          "게임 종료",
          "계속하기",
          function() {
            // 게임 종료 선택: 현재 세션을 안전하게 종료 (결과/보상 없이 로비로 이동)
            if (window.exitPhase2ToMain) {
              window.exitPhase2ToMain();
            } else {
              if (window.clearClassicRuntime) window.clearClassicRuntime();
              if (global.showLobby) global.showLobby();
              else if (global.showScreen) global.showScreen('lobby-screen');
            }
          },
          function() {
            // 계속하기 선택: 현재 화면 유지 및 타이머 흐름 계속 보존 (아무 작업 안 함)
          }
        );
      }
      // 2. 로그인 화면 또는 대기실 로비 화면 (최초 화면)
      else if (activeScreenId === 'login-screen' || activeScreenId === 'lobby-screen') {
        guard.restoringState = true;
        history.pushState({ guardActive: true }, null, '');

        showCustomConfirm(
          "게임을 종료하시겠습니까?",
          "종료",
          "취소",
          function() {
            guard.allowExitOnce = true;
            // Guard를 풀고 실제 브라우저의 뒤로가기(종료) 허용
            history.back();
            setTimeout(function() {
              if (navigator.app && navigator.app.exitApp) {
                navigator.app.exitApp();
              } else {
                window.close();
              }
            }, 100);
          },
          function() {
            // 취소 선택 시 홈 화면 유지
          }
        );
      }
      // 3. 기타 인앱 서브 화면 (도감, 랭킹, 미션, 설정, 대모험 월드맵 등)
      else {
        // 뒤로가기 누르면 이전 앱 화면 또는 첫 화면(로비)으로 이동
        guard.restoringState = true;
        history.pushState({ guardActive: true }, null, '');

        if (activeScreenId === 'stage-select-screen') {
          if (global.openAdventureMap) global.openAdventureMap();
          else if (global.showScreen) global.showScreen('adventure-map-screen');
        } else if (activeScreenId === 'stage-ready-screen') {
          if (global.backToStageSelect) global.backToStageSelect();
          else if (global.showScreen) global.showScreen('stage-select-screen');
        } else {
          if (global.showLobby) global.showLobby();
          else if (global.showScreen) global.showScreen('lobby-screen');
        }
      }
    });
  }

  v2.initBackButtonHandler = initBackButtonHandler;
})(window);
