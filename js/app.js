// 오래된 캐시 및 Service Worker 강제 해제
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister().then(success => {
                    if (success) console.log('[Service Worker] Unregistered successfully');
                });
            }
        });
    }
    if ('caches' in window) {
        caches.keys().then(keys => {
            keys.forEach(key => {
                caches.delete(key).then(success => {
                    if (success) console.log('[Cache] Deleted old cache:', key);
                });
            });
        });
    }

    const v2 = window.GugudanV2 || {};
    const gameConfig = v2.gameConfig || {};

    // firebaseClient.js에서 주입한 인스턴스 사용
    const db = window.firebaseClient ? window.firebaseClient.db : null;
    const auth = window.firebaseClient ? window.firebaseClient.auth : null;

    let audioCtx;
    function initAudio() {
        if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    }
    function playSound(type) {
        if (v2.storageService && !v2.storageService.loadSaveData().settings.soundEnabled) return;
        initAudio();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'correct') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'legend') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.2); osc.frequency.linearRampToValueAtTime(1320, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.6, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
            osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.6);
        } else if (type === 'siren') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
            osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 1.0);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1.5);
            osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 2.0);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 2.0);
            osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 2.0);
        }
    }
    function triggerVibration(pattern) { if ("vibrate" in navigator) { navigator.vibrate(pattern); } }

    let currentUser = null; 
    let currentUserData = null; 
    let isGuestMode = false;
    let currentQIndex = 0; const totalQuestions = gameConfig.classic ? gameConfig.classic.totalQuestions : 20; let answerContent = 0; let questionStartTime = 0;
    const maxTime = gameConfig.classic ? gameConfig.classic.secondsPerQuestion : 5; let timeLeft = 0; let timerInterval = null; let countdownInterval = null;
    let sessionCorrect = 0; let sessionSpeedScore = 0; let classicTenComboShown = false;
    let answerLocked = false;
    
    let lastQuestionStr = ""; 

    // 아이디 정규화
    function normalizeLoginId(value) {
        return String(value || "")
          .normalize("NFKC")
          .trim()
          .toLowerCase();
    }

    // 아이디 검증 (한글, 영문 소문자, 숫자 2~16자)
    function validateLoginId(loginId) {
        const regex = /^[a-z0-9가-힣]{2,16}$/;
        return regex.test(loginId);
    }

    // 비동기 SHA-256 해시 함수
    async function getSha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // 내부 인증 이메일 생성
    async function makeInternalEmail(normalizedId) {
        const hash = await getSha256(normalizedId);
        return `u_${hash}@nyanko.invalid`;
    }

    // 고양이 데이터 안전 정규화 (유효한 ID 필터링 및 복구)
    function normalizeOwnedCats(userData) {
        let ownedCatIds = [];
        let duplicateCounts = {};
        const baseCats = (window.GugudanV2 && window.GugudanV2.baseCats) || [];
        
        if (userData) {
            if (Array.isArray(userData.ownedCatIds)) {
                ownedCatIds = userData.ownedCatIds.filter(id => {
                    const exists = baseCats.some(c => c.id === id);
                    if (!exists) console.warn("[CAT NORMALIZATION WARNING] 유효하지 않은 고양이 ID 무시:", id);
                    return exists;
                });
            } else if (Array.isArray(userData.rewards)) {
                userData.rewards.forEach(r => {
                    if (r && r.id) {
                        const exists = baseCats.some(c => c.id === r.id);
                        if (exists) {
                            if (!ownedCatIds.includes(r.id)) {
                                ownedCatIds.push(r.id);
                            }
                        } else {
                            console.warn("[CAT NORMALIZATION WARNING] 유효하지 않은 고양이 ID 무시:", r.id);
                        }
                    }
                });
            }
        }
        
        if (!ownedCatIds.includes('base_normal_01')) {
            ownedCatIds.push('base_normal_01');
        }
        
        if (userData && userData.duplicateCounts) {
            duplicateCounts = Object.assign({}, userData.duplicateCounts);
        }
        
        return {
            ownedCatIds: ownedCatIds,
            duplicateCounts: duplicateCounts
        };
    }

    // 유효한 대표 고양이 ID 검증 및 대체
    function getValidRepresentativeCatId(userData, ownedCatIds) {
        let repId = userData ? userData.representativeCatId : null;
        const baseCats = (window.GugudanV2 && window.GugudanV2.baseCats) || [];
        
        const isValid = repId && baseCats.some(c => c.id === repId) && ownedCatIds.includes(repId);
        if (isValid) return repId;
        
        if (ownedCatIds && ownedCatIds.length > 0) return ownedCatIds[0];
        return 'base_normal_01';
    }

    // 화면 전환 통합 함수
    function showScreen(screenId) {
        const screenMap = {
            'boot': 'login-screen',
            'login': 'login-screen',
            'signup': 'signup-screen',
            'profile-setup': 'profile-setup-screen',
            'lobby': 'lobby-screen',
            'loading': 'loading-overlay',
            'error': 'result-screen'
        };

        const targetId = screenMap[screenId] || screenId;
        const authScreens = ['login-screen', 'signup-screen', 'profile-setup-screen'];

        // 전체 화면 비활성화 및 숨김
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active-screen', 'active');
            s.setAttribute('hidden', 'true');
        });

        // 인증 화면들 명시적 active 제거 및 hidden 부여
        authScreens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.setAttribute('hidden', 'true');
                el.classList.remove('active');
            }
        });

        // 대상 화면 출력
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.removeAttribute('hidden');
            targetEl.classList.add('active-screen');
            if (authScreens.includes(targetId)) {
                targetEl.classList.add('active');
            }
            document.body.classList.toggle('is-admin-mode', targetId === 'admin-screen');
        } else {
            console.error(`화면을 찾을 수 없다냥: ${screenId} (targetId: ${targetId})`);
        }
    }

    function toggleLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
    function clearClassicRuntime() { clearInterval(timerInterval); clearInterval(countdownInterval); timerInterval = null; countdownInterval = null; }
    window.clearClassicRuntime = clearClassicRuntime;

    // 폼 로그인 제출
    async function handleLoginSubmit(event) {
        if (event) event.preventDefault();
        const rawId = document.getElementById('login-id-input').value;
        const password = document.getElementById('login-password-input').value;
        const errorMsg = document.getElementById('login-error-message');
        errorMsg.style.display = 'none';

        const loginId = normalizeLoginId(rawId);
        if (!validateLoginId(loginId)) {
            errorMsg.innerText = "아이디는 2~16자 한글, 영문 소문자, 숫자만 가능합니다 (특수문자/공백 불가).";
            errorMsg.style.display = 'block';
            return;
        }
        if (!password) {
            errorMsg.innerText = "비밀번호를 입력해주세요.";
            errorMsg.style.display = 'block';
            return;
        }

        toggleLoading(true);
        isGuestMode = false;
        try {
            const email = await makeInternalEmail(loginId);
            await auth.signInWithEmailAndPassword(email, password);
        } catch(error) {
            console.error('[Login Error]', error);
            errorMsg.innerText = "정보가 맞지 않다냥. 아이디와 비밀번호를 확인해라냥!";
            errorMsg.style.display = 'block';
        } finally {
            toggleLoading(false);
        }
    }

    // 폼 회원가입 제출
    async function handleSignupSubmit(event) {
        if (event) event.preventDefault();
        const rawId = document.getElementById('signup-id-input').value;
        const password = document.getElementById('signup-password-input').value;
        const confirmPw = document.getElementById('signup-password-confirm-input').value;
        const errorMsg = document.getElementById('signup-error-message');
        errorMsg.style.display = 'none';

        const loginId = normalizeLoginId(rawId);
        if (!validateLoginId(loginId)) {
            errorMsg.innerText = "아이디는 2~16자 한글, 영문 소문자, 숫자만 가능합니다 (특수문자/공백 불가).";
            errorMsg.style.display = 'block';
            return;
        }
        if (!password || password.length < 6) {
            errorMsg.innerText = "비밀번호는 최소 6자 이상이어야 합니다.";
            errorMsg.style.display = 'block';
            return;
        }
        if (password !== confirmPw) {
            errorMsg.innerText = "비밀번호 확인이 일치하지 않습니다.";
            errorMsg.style.display = 'block';
            return;
        }

        toggleLoading(true);
        isGuestMode = false;
        try {
            const email = await makeInternalEmail(loginId);
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: loginId });
            alert("가입 완료냥! 프로필 설정을 해달라냥.");
        } catch(error) {
            console.error('[Signup Error]', error);
            errorMsg.innerText = "이미 존재하는 아이디거나 가입에 실패했다냥!";
            errorMsg.style.display = 'block';
        } finally {
            toggleLoading(false);
        }
    }

    // 프로필 만들기 및 users/{uid} 생성
    async function handleProfileSetup() {
        const user = auth.currentUser;
        if (!user) {
            alert("인증 정보가 없습니다. 로그인 화면으로 이동합니다.");
            showScreen('login');
            return;
        }
        const nicknameInput = document.getElementById('profile-nickname-input').value.trim();
        const errorMsg = document.getElementById('profile-setup-error');
        errorMsg.style.display = 'none';

        // 닉네임 조건: 2~12자 한글, 영문, 숫자
        const nicknameRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
        if (!nicknameRegex.test(nicknameInput)) {
            errorMsg.innerText = "닉네임은 2~12자 한글, 영문, 숫자만 가능합니다 (공백 제외).";
            errorMsg.style.display = 'block';
            return;
        }

        toggleLoading(true);
        try {
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            
            if (!doc.exists) {
                // 완전히 초기 상태로 생성
                const initialData = {
                    nickname: nicknameInput,
                    level: 1,
                    totalPoints: 0,
                    playCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ownedCatIds: ['base_normal_01'],
                    representativeCatId: 'base_normal_01',
                    duplicateCounts: {},
                    currencySnapshot: {
                        coins: 1000,
                        normalTickets: 5,
                        premiumTickets: 1,
                        seasonTickets: { season_01: 0 },
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                };
                await userRef.set(initialData);
            }

            const refreshed = await userRef.get();
            currentUserData = refreshed.data();
            currentUser = currentUserData.nickname;

            if (v2.storageService) {
                v2.storageService.handleAuthenticatedUserChanged({
                    type: 'authenticated',
                    userId: user.uid,
                    nickname: currentUser
                });

                const save = v2.storageService.loadSaveData();
                save.level = 1;
                save.totalPoints = 0;
                save.currency.coins = 1000;
                save.currency.normalTickets = 5;
                save.currency.premiumTickets = 1;
                save.currency.seasonTickets = { season_01: 0 };
                save.collection.ownedCatIds = ['base_normal_01'];
                save.profile.selectedCatId = 'base_normal_01';
                save.profile.nickname = currentUser;
                save.profile.playerId = user.uid;
                save.profile.rankingId = user.uid;
                save.adventureProgress = {
                    unlockedWorldIds: ['world_01'],
                    unlockedStageIds: ['stage_01_01'],
                    clearedStageIds: [],
                    stageRecords: {},
                    totalStars: 0,
                    currentWorldId: 'world_01',
                    currentStageId: 'stage_01_01'
                };
                save.dailyMissions = { dateKey: '', missions: {} };
                save.rewardHistory = { rewardedSessionIds: [], firstClearStageIds: [], rewardedStarMilestones: {} };
                save.seasonProgress = {};
                
                v2.storageService.saveSaveData(save);
            }

            showLobby();
        } catch(error) {
            console.error('[Profile Setup Error]', error);
            errorMsg.innerText = "서버 저장 실패! 다시 시도해 주세요.";
            errorMsg.style.display = 'block';
        } finally {
            toggleLoading(false);
        }
    }

    // 게스트 모드로 시작
    async function playAsGuest() {
        initAudio();
        isGuestMode = true;

        toggleLoading(true);
        try {
            if (auth && auth.currentUser) {
                await auth.signOut();
            }
        } catch(e) {
            console.warn('[Guest Mode] signOut error:', e);
        } finally {
            toggleLoading(false);
        }

        currentUser = "GUEST";
        currentUserData = null;

        if (v2.storageService) {
            v2.storageService.setUserContext({ type: 'guest', regenerate: true });
        }
        showLobby();
    }

    // 로그아웃
    async function logout() {
        window.__nyankoAdminSession = false;
        if (v2.storageService) {
            var currentSave = v2.storageService.loadSaveData();
            v2.storageService.saveSaveData(currentSave);
            v2.storageService.clearInMemoryUserState();
        }
        currentUser = null;
        currentUserData = null;
        isGuestMode = false;

        const catSummary = document.getElementById('lobby-selected-cat');
        if (catSummary) catSummary.innerHTML = '';
        const colGrid = document.getElementById('collection-grid');
        if (colGrid) colGrid.innerHTML = '';
        
        const loginIdIn = document.getElementById('login-id-input');
        if (loginIdIn) loginIdIn.value = '';
        const loginPwIn = document.getElementById('login-password-input');
        if (loginPwIn) loginPwIn.value = '';

        toggleLoading(true);
        try {
            if (auth) {
                await auth.signOut();
            }
        } catch(error) {
            console.error('[Logout Error]', error);
        } finally {
            toggleLoading(false);
        }
        showScreen('login');
    }

    // 인증 감시자 1개 등록
    function initAuthListener() {
        if (!auth) return;
        auth.onAuthStateChanged(async (user) => {
            if (isGuestMode) return; // 게스트 모드일 때는 감시하지 않음

            if (!user) {
                showScreen('login');
                return;
            }

            toggleLoading(true);
            try {
                const userRef = db.collection('users').doc(user.uid);
                const doc = await userRef.get();
                if (doc.exists) {
                    currentUserData = doc.data();
                    currentUser = currentUserData.nickname || user.displayName || "냥코";

                    if (v2.storageService) {
                        v2.storageService.handleAuthenticatedUserChanged({
                            type: 'authenticated',
                            userId: user.uid,
                            nickname: currentUser
                        });

                        const normalized = normalizeOwnedCats(currentUserData);
                        const validRepId = getValidRepresentativeCatId(currentUserData, normalized.ownedCatIds);

                        const save = v2.storageService.loadSaveData();
                        save.collection.ownedCatIds = normalized.ownedCatIds;
                        save.collection.duplicateCounts = normalized.duplicateCounts;
                        save.profile.selectedCatId = validRepId;
                        if (currentUserData.level) save.level = currentUserData.level;
                        if (currentUserData.totalPoints) save.totalPoints = currentUserData.totalPoints;
                        v2.storageService.saveSaveData(save);
                    }

                    // 펜딩 리소스 수령 및 캐시 스냅샷 싱크
                    try {
                        await receivePendingTickets(userRef, currentUserData);
                        await syncCurrentCurrencyToFirebase(userRef);
                    } catch(syncError) {
                        console.warn('[Sync Error]', syncError);
                    }

                    showLobby();
                } else {
                    // 문서가 없으면 프로필 설정
                    showScreen('profile-setup');
                }
            } catch (error) {
                console.error('[Auth state change error]', error);
                showScreen('login');
            } finally {
                toggleLoading(false);
            }
        });
    }

    // Event Listener 바인딩 및 초기화
    document.addEventListener('DOMContentLoaded', () => {
        // UI 이벤트 바인딩 (인라인 onclick 대체)
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

        const openSignupBtn = document.getElementById('open-signup-button');
        if (openSignupBtn) openSignupBtn.addEventListener('click', () => showScreen('signup'));

        const signupForm = document.getElementById('signup-form');
        if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);

        const backToLoginBtn = document.getElementById('back-to-login-button');
        if (backToLoginBtn) backToLoginBtn.addEventListener('click', () => showScreen('login'));

        const guestStartBtn = document.getElementById('guest-start-button');
        if (guestStartBtn) guestStartBtn.addEventListener('click', playAsGuest);

        const profileStartBtn = document.getElementById('profile-start-button');
        if (profileStartBtn) profileStartBtn.addEventListener('click', handleProfileSetup);

        const lobbyLogoutBtn = document.getElementById('lobby-logout-button');
        if (lobbyLogoutBtn) lobbyLogoutBtn.addEventListener('click', logout);

        const resultLogoutBtn = document.getElementById('result-logout-button');
        if (resultLogoutBtn) resultLogoutBtn.addEventListener('click', logout);

        // 감시자 기동
        initAuthListener();
    });

    function showLobby() {
        clearClassicRuntime();
        if (window.clearPhase2Runtime) window.clearPhase2Runtime();
        document.getElementById('lobby-name').innerText = currentUser;
        const grid = document.createElement('div');
        const soundToggle = document.getElementById('sound-enabled-toggle');
        if (soundToggle && v2.storageService) soundToggle.checked = v2.storageService.loadSaveData().settings.soundEnabled;

        if (!isGuestMode && currentUserData) {
            document.getElementById('lobby-level').innerText = currentUserData.level || 1;
            document.getElementById('lobby-points').innerText = currentUserData.totalPoints || 0;
            document.getElementById('lobby-stats-box').style.display = 'block';
            document.getElementById('collection-box').style.display = 'block';
        } else {
            document.getElementById('lobby-stats-box').style.display = 'none';
            document.getElementById('collection-box').style.display = 'none';
        }
        showScreen('lobby-screen');
        document.getElementById('collection-box').style.display = 'block';
        document.body.classList.toggle('reduced-motion', Boolean(v2.storageService.loadSaveData().settings.reducedMotion));
        if (window.renderBaseCollection) window.renderBaseCollection();
        if (v2.isFeatureEnabled && v2.isFeatureEnabled('seasons') && window.renderSeasonBanner) window.renderSeasonBanner();
        if (window.renderDailyMissions) window.renderDailyMissions();
        if (window.maybeShowOnboarding) window.maybeShowOnboarding();
    }

    function updateLiveAccuracy() {
        let currentAcc = currentQIndex > 1 ? Math.floor((sessionCorrect / (currentQIndex - 1)) * 100) : 100;
        document.getElementById('current-accuracy').innerText = `정답률: ${currentAcc}%`;
    }

    function updateLivePoints() {
        const livePts = document.getElementById('live-points');
        const currentPoints = sessionCorrect * 10 + sessionSpeedScore;
        livePts.innerText = `현재 획득: ${currentPoints}P`;
        
        livePts.classList.remove('point-anim');
        void livePts.offsetWidth; 
        livePts.classList.add('point-anim');
    }

    function startMarathonGame() {
        if (window.prepareClassicUI) window.prepareClassicUI();
        initAudio(); 
        if (v2.gameState) v2.gameState.startGame('classic');
        currentQIndex = 0; sessionCorrect = 0; sessionSpeedScore = 0; classicTenComboShown = false;
        lastQuestionStr = ""; 
        document.body.classList.remove('boss-mode'); // 보스 모드 해제
        document.getElementById('reward-box').style.display = 'none';
        updateLivePoints(); 
        
        showScreen('play-screen'); nextMarathonQuestionFlow();
    }

    // 🔥 보스전 흐름 제어 함수 🔥
    function nextMarathonQuestionFlow() {
        if (currentQIndex >= totalQuestions) return endMarathonGame();
        
        // 18번 문제를 막 끝내고 19번으로 넘어갈 차례일 때 보스 경고 발생!
        if (currentQIndex === 18) {
            triggerBossWarning();
        } else {
            generateNextQuestion();
        }
    }

    // 🚨 보스 경고 이벤트 발동 🚨
    function triggerBossWarning() {
        playSound('siren');
        triggerVibration([500, 200, 500]);
        
        const warningScreen = document.getElementById('boss-warning');
        warningScreen.style.display = 'flex';
        
        // 2초 후 경고창 닫고 보스 테마 적용 후 19번 문제 시작
        setTimeout(() => {
            warningScreen.style.display = 'none';
            document.body.classList.add('boss-mode');
            generateNextQuestion();
        }, 2000);
    }

    // 실제 문제 생성 로직
    function generateNextQuestion() {
        currentQIndex++; updateLiveAccuracy();
        answerLocked = false;
        document.getElementById('q-counter').innerText = `문제: ${currentQIndex}/${totalQuestions}`;
        document.getElementById('progress-bar').style.width = `${(currentQIndex / totalQuestions) * 100}%`;
        document.getElementById('feedback').innerText = "";
        
        // 1~18번은 4지선다, 19~20번(보스전)은 8지선다
        let optionsCount = (currentQIndex <= 18) ? 4 : 8; 
        // 16~20번 구간부터는 일의 자리 함정 적용
        let needsTrap = (currentQIndex >= 16); 

        let m1, m2; let loopCount = 0;
        
        do {
            if (currentQIndex <= 5) { 
                if (Math.random() < 0.2) { m1 = [6,7,8][Math.floor(Math.random()*3)]; m2 = 1; } 
                else { m1 = Math.floor(Math.random()*4)+2; m2 = Math.floor(Math.random()*9)+1; }
            } else if (currentQIndex <= 10) { 
                if (Math.random() < 0.2) { m1 = [6,7,8][Math.floor(Math.random()*3)]; m2 = 2; } 
                else { m1 = [4,5,9][Math.floor(Math.random()*3)]; m2 = Math.floor(Math.random()*9)+1; }
            } else if (currentQIndex <= 15) { 
                m1 = Math.floor(Math.random()*3)+6; m2 = Math.floor(Math.random()*7)+3;
            } else { 
                m1 = Math.floor(Math.random()*5)+11; m2 = Math.floor(Math.random()*8)+2; 
            }
            loopCount++;
        } while (`${m1}x${m2}` === lastQuestionStr && loopCount < 10); 
        
        lastQuestionStr = `${m1}x${m2}`; 
        answerContent = m1 * m2;
        
        const qElem = document.getElementById('question'); qElem.innerText = `${m1} X ${m2} = ?`; qElem.className = "question-text";
        
        generateOptions(answerContent, optionsCount, needsTrap); 
        startTimer();
    }

    function generateOptions(ans, count, needsTrap) {
        let opts = v2.questionGenerator ? v2.questionGenerator.createOptions(ans, count, needsTrap) : [ans];
        
        const container = document.getElementById('options-container'); 
        container.innerHTML = "";
        
        opts.forEach(opt => {
            const btn = document.createElement('button'); 
            btn.className = 'btn btn-answer'; 
            if (count === 8) { btn.classList.add('btn-answer-small'); }
            btn.innerText = opt;
            btn.onclick = () => checkAnswer(opt); 
            container.appendChild(btn);
        });
    }

    function startTimer() {
        clearInterval(timerInterval); clearInterval(countdownInterval); timeLeft = maxTime; questionStartTime = Date.now();
        const timerBar = document.getElementById('timer-bar'); timerBar.style.width = '100%'; timerBar.style.backgroundColor = '#FFB347';
        countdownInterval = setInterval(() => {
            let passed = (Date.now() - questionStartTime) / 1000; let ratio = Math.max(0, (maxTime - passed) / maxTime) * 100;
            timerBar.style.width = `${ratio}%`; if(ratio < 30) timerBar.style.backgroundColor = '#F44336';
        }, 50);
        timerInterval = setInterval(() => { timeLeft--; if (timeLeft <= 0) handleTimeOver(); }, 1000);
    }

    function handleTimeOver() {
        if (answerLocked) return;
        answerLocked = true;
        clearInterval(timerInterval); clearInterval(countdownInterval); document.getElementById('timer-bar').style.width = '0%';
        const feedback = document.getElementById('feedback'); feedback.innerText = "⏰ 시간 초과냥!"; feedback.className = "wrong-anim";
        document.getElementById('question').className = "question-text wrong-anim";
        playSound('wrong'); triggerVibration([400, 100, 400]);
        if (v2.gameState) v2.gameState.recordWrongAnswer();
        disableBtns(); setTimeout(nextMarathonQuestionFlow, 1000); 
    }

    function checkAnswer(selected) {
        if (answerLocked) return;
        answerLocked = true;
        clearInterval(timerInterval); clearInterval(countdownInterval); const timeTaken = (Date.now() - questionStartTime) / 1000;
        const feedback = document.getElementById('feedback');
        
        if (selected === answerContent) {
            sessionCorrect++; 
            sessionSpeedScore += Math.max(0, Math.floor(maxTime - timeTaken)); 
            if (v2.gameState) v2.gameState.recordCorrectAnswer(10 + Math.max(0, Math.floor(maxTime - timeTaken)));
            updateLivePoints(); 
            
            const combo = v2.gameState ? v2.gameState.state.combo : 0;
            const effectCombo = combo >= 10 && classicTenComboShown ? 0 : combo;
            let praise = '';
            try { praise = v2.effectService.playCorrect(effectCombo); }
            catch (error) { console.error('[Classic correct effect error]', error); }
            if (combo >= 10) classicTenComboShown = true;
            if (currentQIndex % 5 === 0 && sessionCorrect === currentQIndex) praise = '퍼펙트! 완벽한 계산이다냥!';
            feedback.innerText = praise; feedback.className = "correct-anim"; document.getElementById('question').className = "question-text correct-anim";
            try { if (v2.soundService) v2.soundService.playCorrectSound(); else playSound('correct'); if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('correct'); } catch(e) { playSound('correct'); } triggerVibration([100, 50, 100]); 
        } else {
            if (v2.gameState) v2.gameState.recordWrongAnswer();
            feedback.innerText = "💦 틀렸다냥!"; feedback.className = "wrong-anim"; document.getElementById('question').className = "question-text wrong-anim";
            try { if (v2.soundService) v2.soundService.playWrongSound(); else playSound('wrong'); if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('wrong'); } catch(e) { playSound('wrong'); } triggerVibration([300, 100, 300, 100, 300]); 
        }
        disableBtns(); setTimeout(nextMarathonQuestionFlow, 1000);
    }

    function disableBtns() { document.querySelectorAll('.btn-answer').forEach(b => b.disabled = true); }

    async function endMarathonGame() {
        if (v2.gameState) v2.gameState.finishGame();
        document.body.classList.remove('boss-mode'); // 게임 종료 시 보스 테마 해제
        toggleLoading(true); 
        const baseScore = sessionCorrect * 10;
        let todayTotal = baseScore + sessionSpeedScore;
        let accuracyRate = sessionCorrect / totalQuestions;
        let accPercent = Math.floor(accuracyRate * 100);
        const classicMissionResult = {
            sessionId: v2.gameState && v2.gameState.state.sessionId,
            mode: 'classic', score: todayTotal, correctCount: sessionCorrect,
            wrongCount: totalQuestions - sessionCorrect, totalQuestions: totalQuestions,
            accuracy: accPercent, bestCombo: v2.gameState ? v2.gameState.state.bestCombo : 0,
            finishReason: 'completed'
        };
        const localRecord = v2.storageService.recordGame(classicMissionResult);
        const coinReward = v2.classicRewardService.claim(classicMissionResult, localRecord.isPersonalBest);
        if (v2.seasonService && v2.isFeatureEnabled('seasonMissions')) v2.seasonService.recordGameResult(classicMissionResult);
        if (v2.dailyMissionService) v2.dailyMissionService.recordGameResult(classicMissionResult);

        if (!isGuestMode && auth && auth.currentUser) {
            todayTotal += ((currentUserData.playCount || 0) * 2); 
            currentUserData.playCount = (currentUserData.playCount || 0) + 1;
            currentUserData.totalPoints = (currentUserData.totalPoints || 0) + todayTotal;
            currentUserData.level = Math.floor(currentUserData.totalPoints / 150) + 1; 
            
            if (v2.storageService) {
                const save = v2.storageService.loadSaveData();
                currentUserData.ownedCatIds = save.collection.ownedCatIds || ['base_normal_01'];
                currentUserData.representativeCatId = save.profile.selectedCatId || 'base_normal_01';
                currentUserData.duplicateCounts = save.collection.duplicateCounts || {};
                currentUserData.rewards = [];
            }

            try {
                await db.collection('users').doc(auth.currentUser.uid).set(currentUserData);
                document.getElementById('res-level').innerText = currentUserData.level;
                document.getElementById('res-total-points').innerText = currentUserData.totalPoints;
                document.getElementById('total-stats').style.display = 'block';
            } catch(e) {
                console.error("점수 저장 실패:", e);
                alert("점수 저장에 실패했다냥!");
            }
        } else {
            document.getElementById('total-stats').style.display = 'none';
            document.getElementById('ranking-box').style.display = 'none';
        }

        document.getElementById('res-correct').innerText = sessionCorrect;
        document.getElementById('res-acc-rate').innerText = accPercent;
        document.getElementById('res-today').innerText = todayTotal;
        
        toggleLoading(false); 

        const rewardBox = document.getElementById('reward-box');
        if (coinReward.ok) {
            const p = coinReward.parts;
            rewardBox.innerHTML = '<h3>획득 보상</h3><ul><li>기본 완료 보상 +'+p.completion+'코인</li><li>정답 보상 +'+p.correct+'코인</li>'+(p.perfect?'<li>완벽한 정확도 +'+p.perfect+'코인</li>':'')+(p.personalBest?'<li>개인 최고 기록 +'+p.personalBest+'코인</li>':'')+'</ul><strong>총 획득 코인 +'+p.total+'코인</strong>';
            rewardBox.style.display = 'block';
        }

        showScreen('result-screen');
    }

    async function updateGlobalRanking() {
        const listDiv = document.getElementById('ranking-list');
        listDiv.innerHTML = '<p style="text-align:center; color:#888;">랭킹은 임시 비활성화 상태다냥!</p>';
        document.getElementById('ranking-box').style.display = 'block';
    }

    async function grantResource(userId, type) {
        alert('관리자 기능은 비활성화 상태다냥!');
    }

    async function receivePendingTickets(userRef, userData) {
        const pending = (userData && (userData.pendingResources || userData.pendingTickets)) || {};
        const coins = Math.max(0, Math.floor(Number(pending.coins) || 0));
        const normal = Math.max(0, Math.floor(Number(pending.normal) || 0));
        const premium = Math.max(0, Math.floor(Number(pending.premium) || 0));
        const season = Math.max(0, Math.floor(Number(pending.season) || 0));
        if (!coins && !normal && !premium && !season) return;
        const save = v2.storageService.loadSaveData();
        save.currency.coins += coins;
        save.currency.normalTickets += normal;
        save.currency.premiumTickets += premium;
        save.currency.seasonTickets.season_01 = (save.currency.seasonTickets.season_01 || 0) + season;
        if (!v2.storageService.saveSaveData(save)) throw new Error('로컬 티켓 저장 실패');
        await userRef.update({ pendingResources: { coins: 0, normal: 0, premium: 0, season: 0 }, pendingTickets: { normal: 0, premium: 0 }, ticketsReceivedAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert(`관리자 선물 도착! 코인 ${coins} · 기본 ${normal} · 고급 ${premium}을 받았습니다.`);
    }

    async function syncCurrentCurrencyToFirebase(userRef) {
        if (!userRef || !v2.storageService) return;
        const currency = v2.storageService.loadSaveData().currency;
        try {
            await userRef.set({ currencySnapshot: { coins: currency.coins || 0, normalTickets: currency.normalTickets || 0, premiumTickets: currency.premiumTickets || 0, seasonTickets: currency.seasonTickets || {}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
        } catch (error) { console.warn('[Currency snapshot sync skipped]', error); }
    }

    if (v2.validators) v2.validators.validateAll();
    window.toggleGameSound = function (enabled) { if (!v2.storageService) return; const data = v2.storageService.loadSaveData(); data.settings.soundEnabled = Boolean(enabled); v2.storageService.saveSaveData(data); if (v2.soundService) v2.soundService.setSoundEnabled(enabled); };
    window.getCurrentPlayerContext = function () { return { nickname: currentUser || '', isGuest: isGuestMode, userData: currentUserData }; };
