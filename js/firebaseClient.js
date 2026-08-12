(function (global) {
  'use strict';

  let app;
  let auth;
  let db;

  try {
    if (global.firebase) {
      // Firebase 초기화는 프로젝트 전체에서 한 번만 실행
      if (!global.firebase.apps.length) {
        throw new Error('Firebase Hosting 자동 초기화 설정이 로드되지 않았습니다.');
      } else {
        app = global.firebase.app();
      }
      auth = global.firebase.auth();
      db = global.firebase.firestore();
      console.log('[FirebaseClient] 새 파이어베이스 프로젝트 연결 완료냥!', app.options.projectId);
      if (auth) {
        auth.onAuthStateChanged(function (user) {
          console.log("[Firebase Environment]", {
            projectId: app.options.projectId,
            uid: user ? user.uid : null,
            hostname: location.hostname
          });
        });
      }
    } else {
      console.error('[FirebaseClient] Firebase SDK가 정의되지 않았다냥!');
    }
  } catch (error) {
    console.error('[FirebaseClient] 초기화 에러 발생했다냥:', error);
  }

  // 글로벌 컨텍스트에 등록
  global.firebaseClient = {
    app: app || null,
    auth: auth || null,
    db: db || null
  };
})(window);
