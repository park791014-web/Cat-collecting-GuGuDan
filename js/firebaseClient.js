(function (global) {
  'use strict';

  // 새 Firebase 설정값 (사용자 제공 설정값 그대로 입력)
  const firebaseConfig = {
  apiKey: "AIzaSyCs4Gyco9lXjbJC1b1X1y24wIHS2SFkVM0",
  authDomain: "cat-gugudan.firebaseapp.com",
  projectId: "cat-gugudan",
  storageBucket: "cat-gugudan.firebasestorage.app",
  messagingSenderId: "338733919082",
  appId: "1:338733919082:web:f0a24da56694d0cfe7d313",
  measurementId: "G-V1ZMR8H6YP"
  };

  let app;
  let auth;
  let db;

  try {
    if (global.firebase) {
      // Firebase 초기화는 프로젝트 전체에서 한 번만 실행
      if (!global.firebase.apps.length) {
        app = global.firebase.initializeApp(firebaseConfig);
      } else {
        app = global.firebase.app();
      }
      auth = global.firebase.auth();
      db = global.firebase.firestore();
      console.log('[FirebaseClient] 새 파이어베이스 프로젝트 연결 완료냥!', firebaseConfig.projectId);
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
