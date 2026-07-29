window.__NYANKO_RUNTIME_BUILD__ = {
    version: "V3_GACHA_EVENT_SINGLE_PATH_02",
    loadedAt: new Date().toISOString(),
    href: location.href
};
console.info("[NYANKO RUNTIME BUILD]", window.__NYANKO_RUNTIME_BUILD__);

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

    console.info("[FIREBASE RUNTIME]", {
        projectId: firebase.app().options.projectId,
        authDomain: firebase.app().options.authDomain,
        uid: firebase.auth().currentUser?.uid || null
    });

    function logUserDocumentWrite(source, uid, data) {
        console.warn("[USER DOCUMENT WRITE]", {
            source,
            uid,
            fields: Object.keys(data || {}),
            stack: new Error().stack
        });
    }

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
    let classicQuestionResults = [];
    
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

    function normalizeAdventure(rawAdventure) {
        const completedStageIds = Array.from(new Set(rawAdventure?.completedStageIds || []));
        const unlockedStageIds = Array.from(new Set([
            ...(rawAdventure?.unlockedStageIds || []),
            'stage_01_01'
        ]));
        return {
            ...rawAdventure,
            completedStageIds,
            unlockedStageIds
        };
    }

    function hasValue(value) {
        return value !== undefined && value !== null;
    }

    function firstValue(candidates, fallback) {
        for (const value of candidates) {
            if (hasValue(value)) return value;
        }
        return fallback;
    }

    function isOwnedCatsMap(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    }

    // Firestore V3 표준 문서 스키마로 메모리에서만 마이그레이션 및 정규화한다.
    // 알 수 없는 확장 필드는 보존하며, 이 함수 자체는 서버에 쓰지 않는다.
    function migrateUserDataToV3(raw) {
        if (!raw) {
            return {
                schemaVersion: 3,
                profile: { loginId: "", nickname: "냥코", representativeCatId: "base_normal_01" },
                stats: { totalPoints: 0, level: 1, classicCorrect: 0, timeAttackBest: 0, adventureCorrect: 0, totalCorrect: 0, totalGames: 0 },
                currency: { coins: 1000, normalTickets: 5, premiumTickets: 1, seasonTickets: 0 },
                ownedCats: { base_normal_01: { count: 1, acquiredAt: new Date().toISOString() } },
                adventure: { completedStageIds: [], unlockedStageIds: ['stage_01_01'], completedStages: {}, unlockedWorlds: { world_01: true }, firstClearRewards: {} },
                dailyMissions: { dateKey: "", missions: {} },
                rewardState: {
                    lastRewardedLevel: 1,
                    levelCurve: { curveVersion: 2, baseLevel: 1, baseTotalPoints: 0 }
                },
                createdAt: null,
                updatedAt: null
            };
        }

        const baseCats = (window.GugudanV2 && window.GugudanV2.baseCats) || [];
        
        // 1. stats 보존
        const stats = Object.assign({
            totalPoints: 0,
            level: 1,
            classicCorrect: 0,
            timeAttackBest: 0,
            adventureCorrect: 0,
            totalCorrect: 0,
            totalGames: 0
        }, raw.stats || {});

        stats.totalPoints = firstValue([
            raw.stats?.totalPoints,
            raw.totalPoints,
            raw.progress?.totalScore
        ], 0);
        stats.level = firstValue([raw.stats?.level, raw.level], 1);
        stats.totalGames = firstValue([raw.stats?.totalGames, raw.playCount], 0);

        // 2. currency 보존
        const currency = Object.assign({
            coins: 1000,
            normalTickets: 5,
            premiumTickets: 1,
            seasonTickets: 0
        }, raw.currency || {});

        currency.coins = firstValue([
            raw.currency?.coins,
            raw.currencySnapshot?.coins,
            raw.coins
        ], 1000);
        currency.normalTickets = firstValue([
            raw.currency?.normalTickets,
            raw.currencySnapshot?.normalTickets,
            raw.normalTickets,
            raw.tickets
        ], 5);
        currency.premiumTickets = firstValue([
            raw.currency?.premiumTickets,
            raw.currencySnapshot?.premiumTickets,
            raw.premiumTickets
        ], 1);
        currency.seasonTickets = firstValue([
            raw.currency?.seasonTickets,
            raw.currencySnapshot?.seasonTickets?.season_01
        ], 0);

        // 3. profile 보존
        const profile = Object.assign({
            loginId: "",
            nickname: "냥코",
            representativeCatId: "base_normal_01"
        }, raw.profile || {});

        profile.nickname = firstValue([raw.profile?.nickname, raw.nickname], "냥코");

        // 4. ownedCats 보존
        let ownedCats = {};
        if (isOwnedCatsMap(raw.ownedCats)) {
            ownedCats = Object.keys(raw.ownedCats).reduce((result, catId) => {
                const entry = raw.ownedCats[catId];
                result[catId] = entry && typeof entry === 'object'
                    ? Object.assign({}, entry)
                    : { count: Math.max(1, Number(entry) || 1), acquiredAt: null };
                return result;
            }, {});
        } else {
            let ownedCatIds = raw.ownedCatIds || [];
            if (ownedCatIds.length === 0 && Array.isArray(raw.rewards)) {
                raw.rewards.forEach(r => { if (r && r.id) ownedCatIds.push(r.id); });
            }
            if (!ownedCatIds.includes('base_normal_01')) {
                ownedCatIds.push('base_normal_01');
            }
            ownedCatIds.forEach(id => {
                if (baseCats.some(c => c.id === id)) {
                    const dupCount = (raw.duplicateCounts && raw.duplicateCounts[id]) || 0;
                    ownedCats[id] = {
                        count: 1 + dupCount,
                        acquiredAt: raw.createdAt || null
                    };
                }
            });
        }
        if (Object.keys(ownedCats).length === 0) {
            ownedCats['base_normal_01'] = { count: 1, acquiredAt: raw.createdAt || null };
        }

        const ownedCatIds = Object.keys(ownedCats);
        const representativeCandidate = firstValue([
            raw.profile?.representativeCatId,
            raw.representativeCatId,
            raw.profile?.selectedCatId
        ], null);
        profile.representativeCatId = representativeCandidate && ownedCats[representativeCandidate]
            ? representativeCandidate
            : (ownedCats.base_normal_01 ? 'base_normal_01' : ownedCatIds[0]);

        // 5. adventure 보존
        const adventure = Object.assign({
            completedStageIds: [],
            unlockedStageIds: ['stage_01_01'],
            completedStages: {},
            unlockedWorlds: { world_01: true },
            firstClearRewards: {}
        }, raw.adventure || {});

        if (!adventure.completedStageIds || adventure.completedStageIds.length === 0) {
            adventure.completedStageIds = Object.keys(adventure.completedStages || {}).filter(k => adventure.completedStages[k].cleared);
        }
        if (!adventure.unlockedStageIds || adventure.unlockedStageIds.length === 0) {
            adventure.unlockedStageIds = ['stage_01_01'];
        }

        // 6. dailyMissions 보존
        const dailyMissions = Object.assign({
            dateKey: "",
            missions: {}
        }, raw.dailyMissions || {});

        // 7. rewardState 보존
        const rewardState = Object.assign({
            lastRewardedLevel: 1
        }, raw.rewardState || {});

        const v3 = Object.assign({}, raw, {
            schemaVersion: 3,
            profile,
            stats,
            currency,
            ownedCats,
            adventure: normalizeAdventure(adventure),
            dailyMissions,
            rewardState,
            createdAt: hasValue(raw.createdAt) ? raw.createdAt : null,
            updatedAt: hasValue(raw.updatedAt) ? raw.updatedAt : null
        });

        v3.stats.totalCorrect = (v3.stats.classicCorrect || 0) + (v3.stats.adventureCorrect || 0) + (v3.stats.timeAttackBest || 0);

        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'unknown';
        console.log("[USER DATA RELOAD]", {
            uid: uid,
            ownedCatsType: Array.isArray(v3.ownedCats) ? "array" : typeof v3.ownedCats,
            ownedCatCount: Object.keys(v3.ownedCats).length,
            representativeCatId: v3.profile?.representativeCatId,
            coins: v3.currency?.coins,
            totalPoints: v3.stats?.totalPoints
        });

        return v3;
    }

    // 기존 정식 V3 값은 건드리지 않고 누락된 경로만 채운다.
    function buildUserMigrationPatch(raw) {
        if (!raw) return {};
        const migrated = migrateUserDataToV3(raw);
        const patch = {};
        const addMissing = (path, currentValue, migratedValue) => {
            if (!hasValue(currentValue) && hasValue(migratedValue)) patch[path] = migratedValue;
        };

        addMissing('stats.totalPoints', raw.stats?.totalPoints, migrated.stats.totalPoints);
        addMissing('stats.level', raw.stats?.level, migrated.stats.level);
        addMissing('currency.coins', raw.currency?.coins, migrated.currency.coins);
        addMissing('currency.normalTickets', raw.currency?.normalTickets, migrated.currency.normalTickets);
        addMissing('currency.premiumTickets', raw.currency?.premiumTickets, migrated.currency.premiumTickets);
        addMissing('profile.nickname', raw.profile?.nickname, migrated.profile.nickname);
        addMissing('profile.representativeCatId', raw.profile?.representativeCatId, migrated.profile.representativeCatId);
        addMissing('ownedCats', isOwnedCatsMap(raw.ownedCats) ? raw.ownedCats : undefined, migrated.ownedCats);
        addMissing('adventure.completedStageIds', raw.adventure?.completedStageIds, migrated.adventure.completedStageIds);
        addMissing('adventure.unlockedStageIds', raw.adventure?.unlockedStageIds, migrated.adventure.unlockedStageIds);
        addMissing('dailyMissions', raw.dailyMissions, migrated.dailyMissions);
        addMissing('rewardState', raw.rewardState, migrated.rewardState);
        if (!hasValue(raw.createdAt)) {
            patch.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (raw.schemaVersion !== 3) patch.schemaVersion = 3;
        if (Object.keys(patch).length > 0) {
            patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        return patch;
    }

    window.NyankoUserMigration = {
        migrateUserDataToV3,
        buildUserMigrationPatch
    };

    // V3 Firestore 데이터를 로컬 스토리지 구조와 전격 동기화
    function syncFirestoreDataToLocal(v3Data, uid) {
        if (!v2.storageService) return;
        const save = v2.storageService.loadSaveData();

        save.profile.nickname = v3Data.profile.nickname ?? "냥코";
        save.profile.selectedCatId = v3Data.profile.representativeCatId ?? "base_normal_01";
        save.profile.playerId = uid;
        save.profile.rankingId = uid;

        save.level = v3Data.stats.level ?? 1;
        save.totalPoints = v3Data.stats.totalPoints ?? 0;

        save.currency.coins = v3Data.currency.coins ?? 0;
        save.currency.normalTickets = v3Data.currency.normalTickets ?? 0;
        save.currency.premiumTickets = v3Data.currency.premiumTickets ?? 0;
        save.currency.seasonTickets = { season_01: v3Data.currency.seasonTickets ?? 0 };

        const ownedCatIds = Object.keys(v3Data.ownedCats || {});
        const duplicateCounts = {};
        ownedCatIds.forEach(id => {
            duplicateCounts[id] = Math.max(0, (v3Data.ownedCats[id].count || 1) - 1);
        });
        save.collection.ownedCatIds = ownedCatIds;
        save.collection.duplicateCounts = duplicateCounts;

        // 모험 상태 복구
        const unlockedWorlds = Object.keys(v3Data.adventure.unlockedWorlds || { world_01: true });
        const clearedStages = v3Data.adventure.completedStageIds || [];
        const unlockedStages = v3Data.adventure.unlockedStageIds || ['stage_01_01'];

        save.adventureProgress = {
            unlockedWorldIds: unlockedWorlds,
            unlockedStageIds: unlockedStages,
            clearedStageIds: clearedStages,
            stageRecords: v3Data.adventure.completedStages || {},
            totalStars: clearedStages.reduce((t, sId) => t + ((v3Data.adventure.completedStages[sId] && v3Data.adventure.completedStages[sId].bestStars) || 0), 0),
            currentWorldId: unlockedWorlds[unlockedWorlds.length - 1] || 'world_01',
            currentStageId: unlockedStages[unlockedStages.length - 1] || 'stage_01_01'
        };

        save.dailyMissions = v3Data.dailyMissions || { dateKey: '', missions: {} };
        v2.storageService.saveSaveData(save);
    }

    function ensureDailyMissionState(userData, referenceDate, playerId) {
        const holder = {
            profile: Object.assign({}, userData.profile || {}, { playerId: playerId || userData.profile?.playerId || userData.profile?.userId || null }),
            dailyMissions: userData.dailyMissions || null
        };
        userData.dailyMissions = v2.dailyMissionService.ensureDailyMissions(holder, referenceDate);
        return userData.dailyMissions;
    }

    function calculateBestCombo(questionResults) {
        let currentCombo = 0;
        let bestCombo = 0;
        (questionResults || []).forEach(result => {
            currentCombo = result && result.isCorrect ? currentCombo + 1 : 0;
            bestCombo = Math.max(bestCombo, currentCombo);
        });
        return bestCombo;
    }

    // 공통 게임 세션 전역 변수
    window.gameSession = null;

    function createNewGameSession({ mode, worldId, stageNumber, stageType, stageId }) {
        resetGameRuntime();
        const session = {
            sessionId: mode + '_' + Date.now(),
            mode: mode,
            status: "preparing",
            startedAt: Date.now(),
            finishedAt: null,
            questionCount: 0,
            answeredCount: 0,
            correctCount: 0,
            wrongCount: 0,
            currentQuestion: null,
            results: [],
            worldId: worldId || null,
            stageNumber: stageNumber || null,
            stageType: stageType || null,
            stageId: stageId || null,
            success: false,
            finalized: false
        };
        window.gameSession = session;
        return session;
    }
    window.createNewGameSession = createNewGameSession;

    function stopAllGameTimers() {
        if (window.timerInterval) clearInterval(window.timerInterval);
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        window.timerInterval = null;
        window.countdownInterval = null;

        if (typeof window.clearModeEngineTimers === 'function') {
            window.clearModeEngineTimers();
        }
        if (typeof window.clearAdventureEngineTimers === 'function') {
            window.clearAdventureEngineTimers();
        }
    }
    window.stopAllGameTimers = stopAllGameTimers;

    function resetGameRuntime() {
        stopAllGameTimers();
        
        if (window.transitionTimer) clearTimeout(window.transitionTimer);
        if (window.safetyTimer) clearTimeout(window.safetyTimer);
        window.transitionTimer = null;
        window.safetyTimer = null;
        
        if (typeof window.clearModeEngineTimeouts === 'function') {
            window.clearModeEngineTimeouts();
        }
        if (typeof window.clearAdventureEngineTimeouts === 'function') {
            window.clearAdventureEngineTimeouts();
        }

        unlockAnswerInput();
        clearQuestionUI();
        clearBossUI();
        clearStoryEnemyUI();
        clearResultUI();

        window.gameSession = null;
    }
    window.resetGameRuntime = resetGameRuntime;

    function unlockAnswerInput() {
        window.answerLocked = false;
        if (window.GugudanV2 && window.GugudanV2.gameState && window.GugudanV2.gameState.state) {
            window.GugudanV2.gameState.state.inputLocked = false;
        }
        if (typeof window.unlockModeEngineInput === 'function') {
            window.unlockModeEngineInput();
        }
        if (typeof window.unlockAdventureEngineInput === 'function') {
            window.unlockAdventureEngineInput();
        }
    }
    window.unlockAnswerInput = unlockAnswerInput;

    function lockAnswerInput() {
        window.answerLocked = true;
        if (window.GugudanV2 && window.GugudanV2.gameState && window.GugudanV2.gameState.state) {
            window.GugudanV2.gameState.state.inputLocked = true;
        }
        if (typeof window.lockModeEngineInput === 'function') {
            window.lockModeEngineInput();
        }
        if (typeof window.lockAdventureEngineInput === 'function') {
            window.lockAdventureEngineInput();
        }
    }
    window.lockAnswerInput = lockAnswerInput;

    function clearQuestionUI() {
        const questionElem = document.getElementById('question');
        if (questionElem) {
            questionElem.textContent = '';
            questionElem.className = 'question-text';
        }
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            optionsContainer.innerHTML = '';
        }
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
        }
        const timerBar = document.getElementById('timer-bar');
        if (timerBar) {
            timerBar.style.width = '0%';
        }
    }
    window.clearQuestionUI = clearQuestionUI;

    function clearBossUI() {
        document.body.classList.remove('boss-mode');
        const warningScreen = document.getElementById('boss-warning');
        if (warningScreen) {
            warningScreen.style.display = 'none';
        }
        const bossHp = document.getElementById('boss-hp');
        if (bossHp) {
            bossHp.style.display = 'none';
        }
        const bossPanel = document.getElementById('boss-panel');
        if (bossPanel) {
            bossPanel.style.display = 'none';
        }
    }
    window.clearBossUI = clearBossUI;

    function clearStoryEnemyUI() {
        const bossImgEl = document.getElementById('boss-image');
        if (bossImgEl) {
            bossImgEl.src = 'assets/placeholders/cat-placeholder.svg';
        }
    }
    window.clearStoryEnemyUI = clearStoryEnemyUI;

    function clearResultUI() {
        const resultScreen = document.getElementById('result-screen');
        if (resultScreen) {
            resultScreen.style.display = 'none';
        }
        const advResultScreen = document.getElementById('adventure-result-screen');
        if (advResultScreen) {
            advResultScreen.style.display = 'none';
        }
        const rewardBox = document.getElementById('reward-box');
        if (rewardBox) {
            rewardBox.style.display = 'none';
        }
        const retryModal = document.getElementById('save-retry-modal');
        if (retryModal) {
            retryModal.remove();
        }
    }
    window.clearResultUI = clearResultUI;

    function showGameSaveRetry(error, retryCallback) {
        let oldModal = document.getElementById('save-retry-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'save-retry-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '99999';
        modal.style.color = '#fff';

        const content = document.createElement('div');
        content.style.backgroundColor = '#2c2c2c';
        content.style.padding = '30px';
        content.style.borderRadius = '10px';
        content.style.textAlign = 'center';
        content.style.border = '2px solid #ff4a4a';
        content.style.maxWidth = '400px';

        const title = document.createElement('h3');
        title.innerText = '💾 저장 실패냥! 💾';
        title.style.color = '#ff4a4a';
        title.style.margin = '0 0 15px 0';

        const desc = document.createElement('p');
        desc.innerText = '서버에 결과를 기록하지 못했다냥.\n다시 시도해주세요.';
        desc.style.fontSize = '14px';
        desc.style.lineHeight = '1.6';
        desc.style.margin = '0 0 20px 0';

        if (error) {
            const errDetail = document.createElement('small');
            errDetail.innerText = `오류 내용: ${error.message || error}`;
            errDetail.style.color = '#bbb';
            errDetail.style.display = 'block';
            errDetail.style.marginBottom = '20px';
            content.appendChild(title);
            content.appendChild(desc);
            content.appendChild(errDetail);
        } else {
            content.appendChild(title);
            content.appendChild(desc);
        }

        const retryBtn = document.createElement('button');
        retryBtn.innerText = '다시 저장하기';
        retryBtn.className = 'game-button primary';
        retryBtn.style.padding = '10px 20px';
        retryBtn.style.fontSize = '16px';
        retryBtn.style.cursor = 'pointer';
        retryBtn.onclick = () => {
            modal.remove();
            if (retryCallback) retryCallback();
        };

        content.appendChild(retryBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    async function persistDailyMissionDateIfNeeded(userRef, userData, referenceDate) {
        const before = JSON.stringify(userData.dailyMissions || null);
        ensureDailyMissionState(userData, referenceDate, userRef.id);
        if (JSON.stringify(userData.dailyMissions) !== before) {
            const patch = {
                dailyMissions: userData.dailyMissions,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            logUserDocumentWrite('persistDailyMissionDateIfNeeded', userRef.id, patch);
            await userRef.update(patch);
            return true;
        }
        return false;
    }

    async function refreshCurrentUserData() {
        if (isGuestMode) return;
        const user = auth.currentUser;
        if (!user) return;
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            currentUserData = migrateUserDataToV3(userDoc.data());
            await persistDailyMissionDateIfNeeded(userRef, currentUserData);
            syncFirestoreDataToLocal(currentUserData, user.uid);
        }
    }
    window.refreshCurrentUserData = refreshCurrentUserData;

    async function claimDailyMissionTransaction(missionId) {
        const user = auth.currentUser;
        if (isGuestMode || !user) return { ok: false, reason: 'unauthenticated' };
        const referenceDate = new Date();
        const dateKey = v2.dailyMissionService.getKoreaDateKey(referenceDate);
        const userRef = db.collection('users').doc(user.uid);
        let outcome = { ok: false, reason: 'unknown' };

        console.info('[DAILY MISSION CLAIM START]', { missionId, dateKey });
        await db.runTransaction(async transaction => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('user_document_missing');

            const userData = userDoc.data();
            userData.profile = userData.profile || {};
            userData.currency = userData.currency || {};
            const beforeDaily = JSON.stringify(userData.dailyMissions || null);
            const daily = ensureDailyMissionState(userData, referenceDate, user.uid);
            const config = v2.dailyMissionConfig[missionId];
            const state = daily.missions && daily.missions[missionId];
            let reason = null;

            if (!config || daily.dateKey !== dateKey || daily.activeMissionIds.indexOf(missionId) < 0 || !state) reason = 'missing';
            else if (!state.completed) reason = 'incomplete';
            else if (state.claimed) reason = 'claimed';

            if (reason) {
                if (JSON.stringify(daily) !== beforeDaily) {
                    transaction.update(userRef, {
                        dailyMissions: daily,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                outcome = { ok: false, reason };
                return;
            }

            const reward = config.reward || {};
            state.claimed = true;
            state.claimedAt = referenceDate.toISOString();
            transaction.update(userRef, {
                dailyMissions: daily,
                'currency.coins': (Number(userData.currency.coins) || 0) + (Number(reward.coins) || 0),
                'currency.normalTickets': (Number(userData.currency.normalTickets) || 0) + (Number(reward.normalTickets) || 0),
                'currency.premiumTickets': (Number(userData.currency.premiumTickets) || 0) + (Number(reward.premiumTickets) || 0),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            outcome = { ok: true, reward };
        });

        if (outcome.ok) console.info('[DAILY MISSION CLAIM SUCCESS]', { missionId, reward: outcome.reward });
        else console.info('[DAILY MISSION CLAIM SKIPPED]', { missionId, reason: outcome.reason });
        await refreshCurrentUserData();
        return outcome;
    }
    window.claimDailyMissionTransaction = claimDailyMissionTransaction;

    function padValue(value) { return String(value).padStart(2, '0'); }
    function getKoreaMonthKey(referenceDate) {
        return v2.rankingService.getKoreaMonthKey(referenceDate);
    }

    async function saveFinalGameResult(result) {
        if (isGuestMode) {
            console.log('[Guest Mode] saveFinalGameResult local only');
            const localRecord = v2.storageService.recordGame(result);
            const guestQuestions = result.questionResults || [];
            const guestCorrectCount = guestQuestions.filter(item => item.isCorrect).length;
            v2.dailyMissionService.recordGameResult({
                sessionId: result.sessionId,
                mode: result.mode,
                correctCount: guestCorrectCount,
                totalQuestions: guestQuestions.length,
                success: result.success,
                cleared: result.mode === 'adventure' && result.success,
                stageType: result.stageType || null,
                stageNumber: result.stageNumber || null,
                worldId: result.worldId || null,
                stageId: result.stageId || null,
                finishReason: result.reason || (result.success ? 'stage_cleared' : 'stage_failed'),
                maxCombo: calculateBestCombo(guestQuestions)
            });
            return {
                ok: true,
                guest: true,
                localRecord,
                sessionPoints: guestCorrectCount * 10,
                playCoins: 0,
                levelRewardPremiumTickets: 0
            };
        }

        const user = auth.currentUser;
        if (!user) throw new Error("인증되지 않은 사용자입니다.");

        const sessionId = result.sessionId;
        const mode = result.mode; 
        const questionResults = result.questionResults || [];
        const stageId = result.stageId;
        const success = result.success;

        const correctCount = questionResults.filter(r => r.isCorrect).length;
        const totalCount = questionResults.length;
        const userRef = db.collection('users').doc(user.uid);
        const sessionRef = db.collection('processedGameSessions').doc(user.uid + '_' + sessionId);

        const playedAt = new Date().toISOString();
        const monthKey = getKoreaMonthKey(playedAt);

        const overallAlltimeRef = db.collection('leaderboardsV3').doc(user.uid + '_overall_allTime');
        const overallMonthlyRef = db.collection('leaderboardsV3').doc(user.uid + '_overall_' + monthKey);
        const taAlltimeRef = db.collection('leaderboardsV3').doc(user.uid + '_timeAttack_allTimeBest');
        const taMonthlyRef = db.collection('leaderboardsV3').doc(user.uid + '_timeAttack_' + monthKey);

        const currentPoints = (currentUserData && currentUserData.stats ? currentUserData.stats.totalPoints : 0);
        console.log("[LEADERBOARD WRITE PLAN]", {
            mode: mode,
            uid: user.uid,
            totalPoints: currentPoints + (correctCount * 10),
            timeAttackCorrectCount: (mode === 'timeAttack') ? correctCount : null,
            boardPaths: [
                overallAlltimeRef.path,
                overallMonthlyRef.path,
                taAlltimeRef.path,
                taMonthlyRef.path
            ]
        });

        let isDuplicate = false;
        let writtenAlltimeScore = 0;
        let writtenMonthlyScore = 0;
        let writtenTimeAttackScore = null;
        let adventureReward = null;
        let adventureFirstClear = false;
        let levelRewardPremiumTickets = 0;
        let savedSessionPoints = 0;
        let playCoins = 0;

        await db.runTransaction(async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (sessionDoc.exists) {
                console.warn("세션이 이미 서버에서 처리되었습니다:", sessionId);
                console.info('[DAILY MISSION DUPLICATE SESSION]', { sessionId: sessionId });
                isDuplicate = true;
                return;
            }

            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error("user_document_missing");
            }

            const overallAlltimeDoc = await transaction.get(overallAlltimeRef);
            const overallMonthlyDoc = await transaction.get(overallMonthlyRef);
            const taAlltimeDoc = await transaction.get(taAlltimeRef);
            const taMonthlyDoc = await transaction.get(taMonthlyRef);

            let userData = userDoc.data();
            if (userData.schemaVersion !== 3) {
                userData = migrateUserDataToV3(userData);
            }

            userData.stats = userData.stats || {};
            userData.currency = userData.currency || {};
            userData.adventure = userData.adventure || {};

            const sessionPoints = correctCount * 10;
            const previousPoints = userData.stats.totalPoints || 0;
            const nextPoints = previousPoints + sessionPoints;
            savedSessionPoints = sessionPoints;
            
            userData.stats.totalPoints = nextPoints;
            userData.stats.totalGames = (userData.stats.totalGames || 0) + 1;

            if (mode === 'classic') {
                userData.stats.classicCorrect = (userData.stats.classicCorrect || 0) + correctCount;
            } else if (mode === 'adventure') {
                userData.stats.adventureCorrect = (userData.stats.adventureCorrect || 0) + correctCount;
            } else if (mode === 'timeAttack') {
                if (correctCount > (userData.stats.timeAttackBest || 0)) {
                    userData.stats.timeAttackBest = correctCount;
                }
            }
            userData.stats.totalCorrect = (userData.stats.classicCorrect || 0) + (userData.stats.adventureCorrect || 0) + (userData.stats.timeAttackBest || 0);

            let coinsReward = 0;
            let ticketsReward = 0;
            let premiumTicketsReward = 0;

            if (mode === 'classic' || mode === 'timeAttack') {
                playCoins = v2.levelProgressService.calculatePlayCoins(mode, sessionPoints, success);
                coinsReward = playCoins;
            } else if (mode === 'adventure') {
                if (success) {
                    userData.adventure.firstClearRewards = userData.adventure.firstClearRewards || {};
                    const previouslyCompleted = Array.isArray(userData.adventure.completedStageIds) && userData.adventure.completedStageIds.includes(stageId);
                    adventureFirstClear = !userData.adventure.firstClearRewards[stageId] && !previouslyCompleted;
                    const resolvedStageNumber = Number(result.stageNumber || String(stageId || '').split('_').pop());
                    const stageReward = v2.rewardService.calculateStageRewards({
                        stage: { stageNumber: resolvedStageNumber },
                        cleared: true,
                        isFirstClear: adventureFirstClear
                    });
                    userData.adventure.firstClearRewards[stageId] = true;
                    coinsReward = stageReward.coins;
                    ticketsReward = stageReward.normalTickets;
                    premiumTicketsReward = stageReward.premiumTickets;
                    adventureReward = {
                        coins: coinsReward,
                        normalTickets: ticketsReward,
                        premiumTickets: premiumTicketsReward
                    };
                }
            }

            const previousCoins = userData.currency.coins || 0;
            userData.currency.coins = previousCoins + coinsReward;
            userData.currency.normalTickets = (userData.currency.normalTickets || 0) + ticketsReward;
            userData.currency.premiumTickets = (userData.currency.premiumTickets || 0) + premiumTicketsReward;

            userData.rewardState = userData.rewardState || { lastRewardedLevel: userData.stats.level || 1 };
            const currentLevel = Math.max(1, Number(userData.stats.level) || 1);
            const levelCurve = v2.levelProgressService.normalizeBaseline(
                userData.rewardState.levelCurve,
                currentLevel,
                previousPoints
            );
            userData.rewardState.levelCurve = levelCurve;
            const previousLevel = v2.levelProgressService.resolveLevel(previousPoints, levelCurve, currentLevel);
            const newLevel = v2.levelProgressService.resolveLevel(nextPoints, levelCurve, previousLevel);
            if (newLevel > previousLevel) {
                levelRewardPremiumTickets = newLevel - previousLevel;
                userData.currency.premiumTickets = (userData.currency.premiumTickets || 0) + levelRewardPremiumTickets;
            }
            userData.stats.level = Math.max(currentLevel, newLevel);
            userData.rewardState.lastRewardedLevel = Math.max(
                Number(userData.rewardState.lastRewardedLevel) || currentLevel,
                userData.stats.level
            );

            userData.adventure.completedStageIds = userData.adventure.completedStageIds || [];
            userData.adventure.unlockedStageIds = userData.adventure.unlockedStageIds || ['stage_01_01'];

            if (mode === 'adventure' && success && stageId) {
                userData.adventure.completedStages = userData.adventure.completedStages || {};
                let stars = 1;
                const accuracy = totalCount ? Math.round(correctCount / totalCount * 100) : 0;
                if (correctCount === totalCount) stars = 3;
                else if (accuracy >= 80) stars = 2;

                const prevRecord = userData.adventure.completedStages[stageId] || {};
                userData.adventure.completedStages[stageId] = {
                    cleared: true,
                    bestStars: Math.max(prevRecord.bestStars || 0, stars),
BestScore: Math.max(prevRecord.bestScore || 0, sessionPoints),
                    bestAccuracy: Math.max(prevRecord.bestAccuracy || 0, accuracy),
                    playedAt: new Date().toISOString()
                };

                if (!userData.adventure.completedStageIds.includes(stageId)) {
                    userData.adventure.completedStageIds.push(stageId);
                }

                const parts = stageId.split('_');
                const stageOrder = parseInt(parts[1]);
                const stageNum = parseInt(parts[2]);
                
                const nextStageNum = stageNum + 1;
                if (nextStageNum <= 10) {
                    const nextStageId = `stage_${String(stageOrder).padStart(2,'0')}_${String(nextStageNum).padStart(2,'0')}`;
                    if (!userData.adventure.unlockedStageIds.includes(nextStageId)) {
                        userData.adventure.unlockedStageIds.push(nextStageId);
                    }
                } else if (stageNum === 10) {
                    const nextWorldId = 'world_' + String(stageOrder + 1).padStart(2,'0');
                    userData.adventure.unlockedWorlds = userData.adventure.unlockedWorlds || {};
                    userData.adventure.unlockedWorlds[nextWorldId] = true;
                    
                    const nextStageId = `stage_${String(stageOrder + 1).padStart(2,'0')}_01`;
                    if (!userData.adventure.unlockedStageIds.includes(nextStageId)) {
                        userData.adventure.unlockedStageIds.push(nextStageId);
                    }
                }
            }

            const dailyMissions = ensureDailyMissionState(userData, playedAt, user.uid);
            const missionChange = v2.dailyMissionService.applyDailyMissionProgress(dailyMissions, {
                sessionId: sessionId,
                mode: mode,
                correctCount: correctCount,
                totalQuestions: totalCount,
                points: sessionPoints,
                success: success,
                cleared: mode === 'adventure' && success,
                stageType: result.stageType || null,
                stageNumber: result.stageNumber || null,
                worldId: result.worldId || null,
                stageId: stageId || null,
                finishReason: result.reason || (success ? 'stage_cleared' : 'stage_failed'),
                maxCombo: calculateBestCombo(questionResults)
            });
            console.info('[DAILY MISSION PROGRESS]', {
                sessionId: sessionId,
                mode: mode,
                before: missionChange.before,
                increments: missionChange.increments,
                after: missionChange.after
            });

            userData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

            console.log("[USER UPDATE PLAN]", {
                previousPoints: previousPoints,
                sessionPoints: sessionPoints,
                nextPoints: userData.stats.totalPoints,
                previousCoins: previousCoins,
                coinsReward: coinsReward,
                nextCoins: userData.currency.coins,
                completedStageIds: userData.adventure.completedStageIds,
                unlockedStageIds: userData.adventure.unlockedStageIds
            });

            transaction.set(userRef, userData);

            transaction.set(sessionRef, {
                uid: user.uid,
                sessionId: sessionId,
                mode: mode,
                correctCount: correctCount,
                totalCount: totalCount,
                points: sessionPoints,
                coinsReward: coinsReward,
                ticketsReward: ticketsReward,

                worldId: result.worldId || null,
                stageId: result.stageId || null,
                stageNumber: result.stageNumber || null,
                stageType: result.stageType || null,
                success: success || false,
                reason: result.reason || (success ? "stage_cleared" : "stage_failed"),

                resultingTotalPoints: userData.stats.totalPoints,
                resultingCoins: userData.currency.coins,

                userUpdated: true,
                leaderboardUpdated: true,
                adventureUpdated: true,

                processedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const nickname = userData.profile.nickname || "냥코";
            const repCatId = userData.profile.representativeCatId || "base_normal_01";

            // overall 포인트 누적 문서 갱신
            writtenAlltimeScore = userData.stats.totalPoints;
            transaction.set(overallAlltimeRef, {
                rankingVersion: 'v3',
                mode: 'overall',
                periodType: 'allTime',
                playerId: user.uid,
                totalScore: userData.stats.totalPoints,
                nickname: nickname,
                representativeCatId: repCatId,
                playedAt: playedAt,
                playedAtTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // overall 월간 문서 갱신
            const prevMonthlyScore = overallMonthlyDoc.exists ? (Number(overallMonthlyDoc.data().monthlyScore) || 0) : 0;
            writtenMonthlyScore = prevMonthlyScore + sessionPoints;
            transaction.set(overallMonthlyRef, {
                rankingVersion: 'v3',
                mode: 'overall',
                periodType: 'monthly',
                monthKey: monthKey,
                playerId: user.uid,
                monthlyScore: writtenMonthlyScore,
                nickname: nickname,
                representativeCatId: repCatId,
                playedAt: playedAt,
                playedAtTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 타임어택 누적 문서 갱신
            if (mode === 'timeAttack' && correctCount > 0) {
                const prevAlltimeScore = taAlltimeDoc.exists ? (Number(taAlltimeDoc.data().score) || 0) : 0;
                if (!taAlltimeDoc.exists || correctCount > prevAlltimeScore) {
                    writtenTimeAttackScore = correctCount;
                    transaction.set(taAlltimeRef, {
                        rankingVersion: 'v3',
                        mode: 'timeAttack',
                        periodType: 'allTimeBest',
                        playerId: user.uid,
                        score: correctCount,
                        nickname: nickname,
                        representativeCatId: repCatId,
                        playedAt: playedAt,
                        playedAtTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            // 타임어택 월간 문서 갱신
            if (mode === 'timeAttack' && correctCount > 0) {
                const prevMonthlyTimeAttackScore = taMonthlyDoc.exists ? (Number(taMonthlyDoc.data().score) || 0) : 0;
                if (!taMonthlyDoc.exists || correctCount > prevMonthlyTimeAttackScore) {
                    transaction.set(taMonthlyRef, {
                        rankingVersion: 'v3',
                        mode: 'timeAttack',
                        periodType: 'monthly',
                        monthKey: monthKey,
                        playerId: user.uid,
                        score: correctCount,
                        nickname: nickname,
                        representativeCatId: repCatId,
                        playedAt: playedAt,
                        playedAtTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            currentUserData = userData;
        });

        if (!isDuplicate) {
            console.log("[LEADERBOARD WRITE SUCCESS]", {
                uid: user.uid,
                boardPaths: [
                    overallAlltimeRef.path,
                    overallMonthlyRef.path,
                    taAlltimeRef.path,
                    taMonthlyRef.path
                ],
                writtenValues: {
                    overallAlltimeScore: writtenAlltimeScore,
                    overallMonthlyScore: writtenMonthlyScore,
                    timeAttackScore: writtenTimeAttackScore
                }
            });
        }

        syncFirestoreDataToLocal(currentUserData, user.uid);
        return {
            ok: true,
            guest: false,
            duplicate: isDuplicate,
            adventureReward: adventureReward,
            adventureFirstClear: adventureFirstClear,
            levelRewardPremiumTickets: isDuplicate ? 0 : levelRewardPremiumTickets,
            sessionPoints: isDuplicate ? 0 : savedSessionPoints,
            playCoins: isDuplicate ? 0 : playCoins
        };
    }

    function displayResultScreen(mode, savedResult) {
        // 공통 보조 함수: DOM이 부재할 시 예외를 발생시킴
        function requireElement(id) {
            const el = document.getElementById(id);
            if (!el) {
                throw new Error(`required_dom_missing:${id}`);
            }
            return el;
        }

        // 모든 스크린 비활성화
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active-screen', 'active');
            s.setAttribute('hidden', 'true');
        });

        const session = window.gameSession;
        if (!session) return;

        console.log("[RESULT SCREEN INITIATING]", { mode, sessionId: session.sessionId });

        let resultScreen = null;
        let resultPointsElement = null;
        let resultCoinsElement = null;

        if (mode === 'classic') {
            document.body.classList.remove('boss-mode');
            
            resultScreen = requireElement("result-screen");
            const resCorrect = requireElement("res-correct");
            const resAccRate = requireElement("res-acc-rate");
            const resScore = requireElement("res-score");
            const resCoinsEarned = requireElement("res-coins-earned");
            const totalStats = requireElement("total-stats");
            const resLevel = requireElement("res-level");
            const resTotalPoints = requireElement("res-total-points");
            const rewardBox = requireElement("reward-box");

            const totalQuestions = session.questionCount || 20;
            const accuracyRate = totalQuestions > 0 ? (session.correctCount / totalQuestions) : 0;
            const accPercent = Math.floor(accuracyRate * 100);
            
            const totalScore = savedResult && Number.isFinite(Number(savedResult.sessionPoints))
                ? Number(savedResult.sessionPoints)
                : session.correctCount * 10;

            // DOM 바인딩
            resCorrect.innerText = `${session.correctCount} / ${totalQuestions}`;
            resAccRate.innerText = `${accPercent}%`;
            resScore.innerText = totalScore;
            
            const coinsEarned = savedResult && Number.isFinite(Number(savedResult.playCoins))
                ? Number(savedResult.playCoins)
                : Math.floor(totalScore / 2);
            resCoinsEarned.innerText = `${coinsEarned}코인`;
            if (savedResult && savedResult.levelRewardPremiumTickets) {
                rewardBox.textContent = `레벨업 보상: 고급 뽑기권 +${savedResult.levelRewardPremiumTickets}`;
                rewardBox.style.display = 'block';
            } else {
                rewardBox.textContent = '';
                rewardBox.style.display = 'none';
            }

            // 패널 노출 분기
            requireElement("classic-result-panel").style.display = 'block';
            requireElement("phase2-result-panel").style.display = 'none';
            requireElement("phase2-result-actions").style.display = 'none';
            
            if (!isGuestMode && currentUserData) {
                resLevel.innerText = currentUserData.stats.level || 1;
                resTotalPoints.innerText = currentUserData.stats.totalPoints || 0;
                totalStats.style.display = 'block';
            } else {
                totalStats.style.display = 'none';
            }

            resultPointsElement = resScore;
            resultCoinsElement = resCoinsEarned;

            resultScreen.hidden = false;
            resultScreen.removeAttribute('hidden');
            resultScreen.style.display = 'block';
            resultScreen.classList.add('active', 'active-screen');

        } else if (mode === 'timeAttack') {
            resultScreen = requireElement("result-screen");
            const phase2ResultPanel = requireElement("phase2-result-panel");
            const phase2ResultActions = requireElement("phase2-result-actions");

            requireElement("classic-result-panel").style.display = 'none';
            
            if (typeof window.showTimeAttackResultUI === 'function') {
                window.showTimeAttackResultUI(session, savedResult);
            }

            phase2ResultPanel.style.display = 'block';
            phase2ResultActions.style.display = 'block';

            resultPointsElement = document.getElementById("phase2-result-stats");
            resultCoinsElement = document.getElementById("phase2-result-stats");

            resultScreen.hidden = false;
            resultScreen.removeAttribute('hidden');
            resultScreen.style.display = 'block';
            resultScreen.classList.add('active', 'active-screen');

        } else if (mode === 'adventure') {
            resultScreen = requireElement("adventure-result-screen");
            
            if (typeof window.showAdventureResultUI === 'function') {
                window.showAdventureResultUI(session, savedResult);
            }

            resultPointsElement = document.getElementById("adventure-result-stats");
            resultCoinsElement = document.getElementById("adventure-rewards");

            resultScreen.hidden = false;
            resultScreen.removeAttribute('hidden');
            resultScreen.style.display = 'block';
            resultScreen.classList.add('active', 'active-screen');
        }

        // 결과 화면 완료 강제 확인 및 디버그 로깅
        if (resultScreen) {
            console.log("[RESULT SCREEN DISPLAY]", {
                mode: mode,
                screenId: resultScreen.id,
                screenExists: true,
                hidden: resultScreen.hidden,
                display: getComputedStyle(resultScreen).display,
                pointsElement: Boolean(resultPointsElement),
                coinsElement: Boolean(resultCoinsElement)
            });
        }
    }
    window.displayResultScreen = displayResultScreen;

    function showFallbackResultScreen(mode, savedResult, error) {
        const detail = error && error.message ? ` (${error.message})` : '';
        alert(`게임은 안전하게 저장됐지만 결과 화면을 표시하지 못했습니다냥.${detail}`);
        showLobby();
    }
    window.showFallbackResultScreen = showFallbackResultScreen;

    async function finalizeGameSession({ reason, success }) {
        if (!window.gameSession) return;

        if (
            window.gameSession.finalized ||
            window.gameSession.status === "finalizing" ||
            window.gameSession.status === "completed"
        ) {
            return;
        }

        window.gameSession.finalized = true;
        window.gameSession.status = "finalizing";
        window.gameSession.finishedAt = Date.now();
        window.gameSession.success = Boolean(success);
        window.gameSession.reason = reason;

        stopAllGameTimers();
        lockAnswerInput();

        let savedResult;

        try {
            const result = buildFinalGameResult(window.gameSession);
            savedResult = await saveFinalGameResult(result);
        } catch (error) {
            window.gameSession.finalized = false;
            window.gameSession.status = "resolving";
            toggleLoading(false);

            console.error("[GAME SAVE ERROR]", {
                mode: window.gameSession.mode,
                sessionId: window.gameSession.sessionId,
                code: error?.code || error?.name || 'unknown',
                message: error?.message || String(error)
            });

            if (typeof showGameSaveRetry === 'function') {
                showGameSaveRetry(error);
            }
            return;
        }

        try {
            await refreshCurrentUserData();

            if (window.renderDailyMissions) window.renderDailyMissions();

            window.gameSession.status = "completed";
            toggleLoading(false);

            displayResultScreen(window.gameSession.mode, savedResult);
        } catch (error) {
            console.error("[RESULT UI ERROR]", {
                mode: window.gameSession.mode,
                sessionId: window.gameSession.sessionId,
                name: error?.name || 'Error',
                message: error?.message || String(error),
                stack: error?.stack || ''
            });

            showFallbackResultScreen(window.gameSession.mode, savedResult, error);
        }
    }
    window.finalizeGameSession = finalizeGameSession;

    function buildFinalGameResult(session) {
        return {
            sessionId: session.sessionId,
            mode: session.mode,
            questionResults: session.results || [],
            stageId: session.stageId || null,
            worldId: session.worldId || null,
            stageNumber: session.stageNumber || null,
            stageType: session.stageType || null,
            success: session.success,
            reason: session.reason || (session.success ? "stage_cleared" : "stage_failed")
        };
    }

    async function performDrawCatTransaction(drawType = 'coin') {
        console.info("[AUTH GACHA ENTER]", {
            drawType,
            uid: firebase.auth().currentUser?.uid || null,
            projectId: firebase.app().options.projectId
        });
        const user = auth.currentUser;
        if (!user && isGuestMode) {
            if (drawType === 'coin') {
                return v2.coinDrawService.draw();
            } else if (drawType === 'normalTicket') {
                return v2.cardPackService.openPack('normalPack');
            } else if (drawType === 'premiumTicket') {
                return v2.cardPackService.openPack('premiumPack');
            } else if (drawType === 'seasonTicket') {
                const season = v2.seasonService.getActiveSeason();
                if (!season) throw new Error('season_inactive');
                return v2.seasonService.openSeasonPack(season.id);
            } else {
                throw new Error(`unsupported_draw_type:${drawType}`);
            }
        }

        if (!user) throw new Error("authenticated_user_required");
        
        const userRef = db.collection('users').doc(user.uid);
        console.info("[GACHA USER DOCUMENT]", {
            uid: user.uid,
            path: userRef.path
        });
        let drawResult = null;
        let expected = null;
        
        try {
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("user_document_missing");

                const rawUserData = userDoc.data();
                console.info("[GACHA SERVER BEFORE]", {
                    uid: user.uid,
                    userPath: userRef.path,
                    coins: rawUserData.currency?.coins,
                    normalTickets: rawUserData.currency?.normalTickets,
                    premiumTickets: rawUserData.currency?.premiumTickets,
                    ownedCatIds: Object.keys(rawUserData.ownedCats || {}),
                    ownedCatCount: Object.keys(rawUserData.ownedCats || {}).length
                });
                
                let cost = 0;
                let currencyKey = 'coins';
                
                if (drawType === 'coin') {
                    cost = (v2.catDrawConfig && v2.catDrawConfig.cost) || 100;
                    currencyKey = 'coins';
                } else if (drawType === 'normalTicket') {
                    cost = v2.cardPackConfig.normalPack.ticketCost;
                    currencyKey = 'normalTickets';
                } else if (drawType === 'premiumTicket') {
                    cost = v2.cardPackConfig.premiumPack.ticketCost;
                    currencyKey = 'premiumTickets';
                } else if (drawType === 'seasonTicket') {
                    const season = v2.seasonService.getActiveSeason();
                    if (!season || !season.cardPack || !season.cardPack.enabled) throw new Error('season_inactive');
                    cost = season.cardPack.ticketCost;
                    currencyKey = 'seasonTickets';
                } else {
                    throw new Error(`unsupported_draw_type:${drawType}`);
                }

                // 확률 설정 획득
                let configObj = null;
                if (drawType === 'coin') {
                    configObj = v2.catDrawConfig;
                } else if (drawType === 'normalTicket') {
                    configObj = v2.cardPackConfig.normalPack;
                } else if (drawType === 'premiumTicket') {
                    configObj = v2.cardPackConfig.premiumPack;
                } else if (drawType === 'seasonTicket') {
                    configObj = v2.seasonService.getActiveSeason().cardPack;
                }
                
                const rates = (configObj && configObj.rarityRates) || { normal: 0.5, rare: 0.3, hero: 0.15, legendary: 0.05 };
                const activeSeason = drawType === 'seasonTicket' ? v2.seasonService.getActiveSeason() : null;
                const baseCats = activeSeason
                    ? v2.seasonService.getSeasonCats(activeSeason)
                    : ((window.GugudanV2 && window.GugudanV2.baseCats) || []);
                
                const rand = Math.random();
                let chosenRarity = 'normal';
                let cumulative = 0;
                const rarities = ['normal', 'rare', 'hero', 'legendary'];
                for (let i = 0; i < rarities.length; i++) {
                    cumulative += rates[rarities[i]] || 0;
                    if (rand <= cumulative) {
                        chosenRarity = rarities[i];
                        break;
                    }
                }
                
                const catsInRarity = baseCats.filter(c => c.rarity === chosenRarity);
                if (catsInRarity.length === 0) throw new Error("no_cats_available_for_rarity");
                const chosenCat = catsInRarity[Math.floor(Math.random() * catsInRarity.length)];

                const mutation = v2.gachaPersistenceService.buildMutation(rawUserData, {
                    currencyKey,
                    cost,
                    catId: chosenCat.id,
                    acquiredAt: firebase.firestore.Timestamp.now()
                });
                const patch = {
                    currency: mutation.currency,
                    ownedCats: mutation.ownedCats,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                expected = {
                    catId: chosenCat.id,
                    currencyKey: mutation.currencyKey,
                    expectedCurrencyValue: mutation.expectedCurrencyValue,
                    expectedCount: mutation.expectedCount
                };

                logUserDocumentWrite('performDrawCatTransaction', user.uid, patch);
                transaction.update(userRef, patch);

                drawResult = {
                    ok: true,
                    cat: chosenCat,
                    rarity: chosenRarity,
                    duplicate: mutation.duplicate,
                    fragments: mutation.duplicate ? 1 : 0
                };
            });

            const verifiedSnapshot = await userRef.get({ source: "server" });
            if (!verifiedSnapshot.exists) throw new Error('gacha_server_verification_failed');
            const verified = verifiedSnapshot.data();

            console.info("[GACHA SERVER AFTER]", {
                uid: user.uid,
                catId: expected.catId,
                coins: verified.currency?.coins,
                normalTickets: verified.currency?.normalTickets,
                    premiumTickets: verified.currency?.premiumTickets,
                    seasonTickets: verified.currency?.seasonTickets,
                ownedCatIds: Object.keys(verified.ownedCats || {}),
                ownedCatCount: Object.keys(verified.ownedCats || {}).length,
                acquiredCat: verified.ownedCats?.[expected.catId] || null,
                updatedAt: verified.updatedAt || null
            });

            if (!v2.gachaPersistenceService.verifyServerResult(verified, expected)) {
                throw new Error("gacha_server_verification_failed");
            }

            currentUserData = migrateUserDataToV3(verified);
            syncFirestoreDataToLocal(currentUserData, user.uid);
            return drawResult;
        } catch (error) {
            console.error("[GACHA FIRESTORE ERROR]", {
                uid: firebase.auth().currentUser?.uid,
                projectId: firebase.app().options.projectId,
                code: error?.code,
                message: error?.message || String(error),
                stack: error?.stack
            });
            throw error;
        }
    }
    window.performDrawCatTransaction = performDrawCatTransaction;

    async function updateRepresentativeCat(catId) {
        if (isGuestMode) {
            const guestData = v2.storageService && v2.storageService.loadSaveData();
            if (!guestData || guestData.collection.ownedCatIds.indexOf(catId) < 0) return false;
            guestData.profile.selectedCatId = catId;
            return v2.storageService.saveSaveData(guestData);
        }
        const user = auth.currentUser;
        if (!user) return false;
        
        const userRef = db.collection('users').doc(user.uid);
        try {
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw new Error("사용자 문서가 존재하지 않습니다.");
            
            const userData = userDoc.data();
            const ownedCats = userData.ownedCats || {};
            if (!ownedCats[catId]) {
                throw new Error("보유하지 않은 고양이는 대표 고양이로 설정할 수 없다냥!");
            }
            
            const representativePatch = {
                "profile.representativeCatId": catId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            logUserDocumentWrite('updateRepresentativeCat', user.uid, representativePatch);
            await userRef.update(representativePatch);

            await refreshCurrentUserData();

            console.info("[REPRESENTATIVE CAT SAVED]", {
                uid: user.uid,
                catId: catId,
                serverRepresentativeCatId: currentUserData.profile?.representativeCatId
            });

            // 랭킹 프로필 동기화 시도 (A안 격리 트랙 구현)
            try {
                const rQuery = await db.collection('leaderboardsV3').where('playerId', '==', user.uid).get();
                if (!rQuery.empty) {
                    const batch = db.batch();
                    rQuery.docs.forEach(doc => {
                        batch.update(doc.ref, {
                            representativeCatId: catId,
                            nickname: userData.profile.nickname || "냥코",
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                    console.log("[LEADERBOARD PROFILE SYNC SUCCESS]", {
                        uid: user.uid,
                        catId: catId,
                        updatedDocsCount: rQuery.size
                    });
                } else {
                    console.log("[LEADERBOARD PROFILE SYNC SUCCESS] (No leaderboard entries to sync)");
                }
            } catch (syncError) {
                console.error("[LEADERBOARD PROFILE SYNC ERROR]", syncError);
            }

            return true;
        } catch(e) {
            console.error("[REPRESENTATIVE CAT ERROR]", {
                uid: user.uid,
                catId,
                ownedCatIds: Object.keys((currentUserData && currentUserData.ownedCats) || {}),
                code: e?.code,
                message: e?.message || String(e)
            });
            return false;
        }
    }
    window.updateRepresentativeCat = updateRepresentativeCat;
    window.refreshCurrentUserData = refreshCurrentUserData;

    // 화면 전환 통합 함수
    function showScreen(screenId) {
        const screenMap = {
            'boot': 'login-screen',
            'login': 'login-screen',
            'signup': 'signup-screen',
            'profile-setup': 'profile-setup-screen',
            'lobby': 'lobby-screen',
            'loading': 'loading-overlay',
            'ranking': 'ranking-screen',
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
            targetEl.style.removeProperty('display');
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
                    schemaVersion: 3,
                    profile: {
                        loginId: user.displayName || "",
                        nickname: nicknameInput,
                        representativeCatId: 'base_normal_01'
                    },
                    stats: {
                        totalPoints: 0,
                        level: 1,
                        classicCorrect: 0,
                        timeAttackBest: 0,
                        adventureCorrect: 0,
                        totalCorrect: 0,
                        totalGames: 0
                    },
                    currency: {
                        coins: 1000,
                        normalTickets: 5,
                        premiumTickets: 1,
                        seasonTickets: 0
                    },
                    ownedCats: {
                        base_normal_01: {
                            count: 1,
                            acquiredAt: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    },
                    adventure: {
                        completedStageIds: [],
                        unlockedStageIds: ['stage_01_01'],
                        completedStages: {},
                        unlockedWorlds: { world_01: true },
                        firstClearRewards: {}
                    },
                    dailyMissions: {
                        dateKey: "",
                        missions: {}
                    },
                    rewardState: {
                        lastRewardedLevel: 1,
                        levelCurve: {
                            curveVersion: 2,
                            baseLevel: 1,
                            baseTotalPoints: 0
                        }
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                logUserDocumentWrite('createInitialUserData', user.uid, initialData);
                await userRef.set(initialData);
            }

            const refreshed = await userRef.get();
            currentUserData = migrateUserDataToV3(refreshed.data());
            currentUser = currentUserData.profile.nickname;
            await persistDailyMissionDateIfNeeded(userRef, currentUserData);

            if (v2.storageService) {
                v2.storageService.handleAuthenticatedUserChanged({
                    type: 'authenticated',
                    userId: user.uid,
                    nickname: currentUser
                });
                syncFirestoreDataToLocal(currentUserData, user.uid);
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
            if (isGuestMode) return; 

            const OWNER_ADMIN_UID = "xg6wYMihYRTsF60NCLf36XigPFB3";
            window.__nyankoAdminSession = Boolean(user && user.uid === OWNER_ADMIN_UID);

            if (!user) {
                showScreen('login');
                return;
            }

            toggleLoading(true);
            try {
                const userRef = db.collection('users').doc(user.uid);
                const doc = await userRef.get();
                if (doc.exists) {
                    let rawData = doc.data();
                    currentUserData = migrateUserDataToV3(rawData);
                    currentUser = currentUserData.profile.nickname;

                    const migrationPatch = buildUserMigrationPatch(rawData);
                    if (Object.keys(migrationPatch).length > 0) {
                        logUserDocumentWrite('buildUserMigrationPatch', user.uid, migrationPatch);
                        await userRef.update(migrationPatch);
                    }

                    await persistDailyMissionDateIfNeeded(userRef, currentUserData);

                    if (v2.storageService) {
                        v2.storageService.handleAuthenticatedUserChanged({
                            type: 'authenticated',
                            userId: user.uid,
                            nickname: currentUser
                        });

                        syncFirestoreDataToLocal(currentUserData, user.uid);
                    }

                    // 펜딩 리소스 수령
                    try {
                        await receivePendingTickets(userRef, currentUserData);
                    } catch(syncError) {
                        console.warn('[Sync Error]', syncError);
                    }

                    console.log("[LOGIN DATA LOAD]", {
                        uid: user.uid,
                        coins: currentUserData.currency?.coins,
                        normalTickets: currentUserData.currency?.normalTickets,
                        premiumTickets: currentUserData.currency?.premiumTickets,
                        ownedCatsCount: Object.keys(currentUserData.ownedCats || {}).length,
                        representativeCatId: currentUserData.profile?.representativeCatId
                    });

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
        if (window.clearAdventureEngineTimers) window.clearAdventureEngineTimers();
        if (window.clearAdventureEngineTimeouts) window.clearAdventureEngineTimeouts();
        if (window.clearModeEngineTimers) window.clearModeEngineTimers();
        if (window.clearPhase2Runtime) window.clearPhase2Runtime();

        document.getElementById('lobby-name').innerText = currentUser;

        if (!isGuestMode && currentUserData) {
            document.getElementById('lobby-level').innerText = (currentUserData.stats && currentUserData.stats.level) || 1;
            document.getElementById('lobby-points').innerText = (currentUserData.stats && currentUserData.stats.totalPoints) || 0;
            document.getElementById('lobby-stats-box').style.display = 'block';
            document.getElementById('collection-box').style.display = 'block';
        } else {
            document.getElementById('lobby-stats-box').style.display = 'none';
            document.getElementById('collection-box').style.display = 'none';
        }
        showScreen('lobby-screen');
        document.getElementById('collection-box').style.display = 'block';
        document.body.classList.toggle('reduced-motion', Boolean(v2.storageService.loadSaveData().settings.reducedMotion));
        
        if (typeof window.renderPhase4Currency === 'function') window.renderPhase4Currency();
        if (window.renderBaseCollection) window.renderBaseCollection();
        if (v2.isFeatureEnabled && v2.isFeatureEnabled('seasons') && window.renderSeasonBanner) window.renderSeasonBanner();
        if (window.renderDailyMissions) window.renderDailyMissions();
        if (window.maybeShowOnboarding) window.maybeShowOnboarding();
    }

    function updateLiveAccuracy() {
        const session = window.gameSession;
        if (!session) return;
        let currentAcc = session.answeredCount > 0 ? Math.floor((session.correctCount / session.answeredCount) * 100) : 100;
        const accEl = document.getElementById('current-accuracy');
        if (accEl) accEl.innerText = `정답률: ${currentAcc}%`;
    }

    function updateLivePoints() {
        const session = window.gameSession;
        if (!session) return;
        const livePts = document.getElementById('live-points');
        if (livePts) {
            const speedScore = session.results.reduce((acc, r) => acc + (r.isCorrect ? Math.max(0, 10 - Math.floor(r.elapsedMs / 1000)) : 0), 0);
            const currentPoints = session.correctCount * 10 + speedScore;
            livePts.innerText = `현재 획득: ${currentPoints}P`;
            livePts.classList.remove('point-anim');
            void livePts.offsetWidth; 
            livePts.classList.add('point-anim');
        }
    }

    const CLASSIC_QUESTION_LIMIT = 20;

    function startMarathonGame() {
        if (window.prepareClassicUI) window.prepareClassicUI();
        initAudio(); 

        const session = createNewGameSession({
            mode: "classic",
            worldId: null,
            stageNumber: null,
            stageType: null,
            stageId: null
        });
        session.status = "playing";
        session.questionCount = CLASSIC_QUESTION_LIMIT;

        if (v2.gameState) v2.gameState.startGame('classic');
        
        classicTenComboShown = false;
        lastQuestionStr = ""; 
        document.body.classList.remove('boss-mode');
        document.getElementById('reward-box').style.display = 'none';
        updateLivePoints(); 
        
        showScreen('play-screen'); nextMarathonQuestionFlow();
    }

    function nextMarathonQuestionFlow() {
        const session = window.gameSession;
        if (!session || session.status !== "playing") return;

        if (session.answeredCount >= CLASSIC_QUESTION_LIMIT) {
            finalizeGameSession({
                reason: "question_limit",
                success: true
            });
            return;
        }
        
        if (session.answeredCount === 18) {
            triggerBossWarning();
        } else {
            generateNextQuestion();
        }
    }

    function triggerBossWarning() {
        playSound('siren');
        triggerVibration([500, 200, 500]);
        
        const warningScreen = document.getElementById('boss-warning');
        warningScreen.style.display = 'flex';
        
        setTimeout(() => {
            warningScreen.style.display = 'none';
            document.body.classList.add('boss-mode');
            generateNextQuestion();
        }, 2000);
    }

    function generateNextQuestion() {
        const session = window.gameSession;
        if (!session || session.status !== "playing") return;

        answerLocked = false;
        
        const currentQIndex = session.answeredCount + 1;
        updateLiveAccuracy();
        
        document.getElementById('q-counter').innerText = `문제: ${currentQIndex}/${CLASSIC_QUESTION_LIMIT}`;
        document.getElementById('progress-bar').style.width = `${(currentQIndex / CLASSIC_QUESTION_LIMIT) * 100}%`;
        document.getElementById('feedback').innerText = "";
        
        let optionsCount = (currentQIndex <= 18) ? 4 : 8; 
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
        
        session.currentQuestion = {
            left: m1,
            right: m2,
            answer: answerContent
        };

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
        const session = window.gameSession;
        if (!session || session.status !== "playing" || answerLocked) return;

        answerLocked = true;
        clearInterval(timerInterval); clearInterval(countdownInterval); document.getElementById('timer-bar').style.width = '0%';
        const feedback = document.getElementById('feedback'); feedback.innerText = "⏰ 시간 초과냥!"; feedback.className = "wrong-anim";
        document.getElementById('question').className = "question-text wrong-anim";
        playSound('wrong'); triggerVibration([400, 100, 400]);
        if (v2.gameState) v2.gameState.recordWrongAnswer();

        session.answeredCount += 1;
        session.wrongCount += 1;
        
        const q = session.currentQuestion;
        session.results.push({
            left: q.left,
            right: q.right,
            submittedAnswer: null,
            correctAnswer: q.answer,
            isCorrect: false,
            elapsedMs: Math.round(maxTime * 1000)
        });

        disableBtns(); setTimeout(nextMarathonQuestionFlow, 1000); 
    }

    function checkAnswer(selected) {
        const session = window.gameSession;
        if (!session || session.status !== "playing" || answerLocked) return;

        answerLocked = true;
        clearInterval(timerInterval); clearInterval(countdownInterval); const timeTaken = (Date.now() - questionStartTime) / 1000;
        const feedback = document.getElementById('feedback');
        const q = session.currentQuestion;
        const isCorrect = (selected === q.answer);

        session.answeredCount += 1;
        if (isCorrect) {
            session.correctCount += 1;
        } else {
            session.wrongCount += 1;
        }

        session.results.push({
            left: q.left,
            right: q.right,
            submittedAnswer: selected,
            correctAnswer: q.answer,
            isCorrect: isCorrect,
            elapsedMs: Math.round(timeTaken * 1000)
        });
        
        if (isCorrect) {
            sessionSpeedScore += Math.max(0, Math.floor(maxTime - timeTaken)); 
            if (v2.gameState) v2.gameState.recordCorrectAnswer(10 + Math.max(0, Math.floor(maxTime - timeTaken)));
            updateLivePoints(); 
            
            const combo = v2.gameState ? v2.gameState.state.combo : 0;
            const effectCombo = combo >= 10 && classicTenComboShown ? 0 : combo;
            let praise = '';
            try { praise = v2.effectService.playCorrect(effectCombo); }
            catch (error) { console.error('[Classic correct effect error]', error); }
            if (combo >= 10) classicTenComboShown = true;
            if (session.answeredCount % 5 === 0 && session.correctCount === session.answeredCount) praise = '퍼펙트! 완벽한 계산이다냥!';
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
        document.body.classList.remove('boss-mode');
        finalizeGameSession({ reason: "question_limit", success: true });
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
        const pendingPatch = { pendingResources: { coins: 0, normal: 0, premium: 0, season: 0 }, pendingTickets: { normal: 0, premium: 0 }, ticketsReceivedAt: firebase.firestore.FieldValue.serverTimestamp() };
        logUserDocumentWrite('receivePendingTickets', userRef.id, pendingPatch);
        await userRef.update(pendingPatch);
        alert(`관리자 선물 도착! 코인 ${coins} · 기본 ${normal} · 고급 ${premium}을 받았습니다.`);
    }

    if (v2.validators) v2.validators.validateAll();
    window.toggleGameSound = function (enabled) { if (!v2.storageService) return; const data = v2.storageService.loadSaveData(); data.settings.soundEnabled = Boolean(enabled); v2.storageService.saveSaveData(data); if (v2.soundService) v2.soundService.setSoundEnabled(enabled); };
    window.getCurrentPlayerContext = function () { return { nickname: currentUser || '', isGuest: isGuestMode, userData: currentUserData }; };
