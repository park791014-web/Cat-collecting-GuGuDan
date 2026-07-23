(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var deferredPrompt = null;

  function initPwaManager() {
    var installBtn = document.getElementById('pwa-install-btn');
    if (!installBtn) return;

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var isStandalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

    // 1. iOS Safari 대응
    if (isIOS && !isStandalone) {
      // iOS Safari 환경이면서 아직 설치되지 않은 경우 설치 안내 버튼 노출
      installBtn.style.display = 'block';
      installBtn.onclick = function() {
        alert("💡 iOS Safari에서 이 앱을 홈 화면에 추가하려면:\n1. 브라우저 하단의 [공유] (내보내기) 버튼을 터치하세요.\n2. 메뉴를 아래로 스크롤하여 [홈 화면에 추가]를 선택해주세요냥!");
      };
    }

    // 2. Android 및 Chromium 브라우저 대응 (beforeinstallprompt)
    window.addEventListener('beforeinstallprompt', function(e) {
      // 기본 설치 프롬프트 방지
      e.preventDefault();
      deferredPrompt = e;
      
      // 이미 설치된 상태(standalone)가 아닐 때만 버튼 노출
      if (!isStandalone) {
        installBtn.style.display = 'block';
      }

      installBtn.onclick = function() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted the install prompt');
          } else {
            console.log('[PWA] User dismissed the install prompt');
          }
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      };
    });

    // 3. PWA 설치 성공 이벤트 감지
    window.addEventListener('appinstalled', function() {
      console.log('[PWA] App installed successfully!');
      installBtn.style.display = 'none';
      deferredPrompt = null;
    });

    // 4. 서비스 워커 등록 (GitHub Pages 서브디렉토리 경로 지원)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/Cat-collecting-GuGuDan/sw.js', { scope: '/Cat-collecting-GuGuDan/' })
        .then(function(reg) {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch(function(error) {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    }
  }

  v2.initPwaManager = initPwaManager;
})(window);
