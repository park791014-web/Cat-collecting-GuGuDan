// ?î• ?åÏù¥?¥Î≤†?¥Ïä§ ?ëÏÜç ???î•
    const firebaseConfig = {
      apiKey: "AIzaSyAiU-w0OXF-ZGsdPtsS1hUpxEZQit8IZbI",
      authDomain: "gugu-cat-adventrue.firebaseapp.com",
      projectId: "gugu-cat-adventrue",
      storageBucket: "gugu-cat-adventrue.firebasestorage.app",
      messagingSenderId: "380583801039",
      appId: "1:380583801039:web:cfeda57a40a01985ccc7ba"
    };

    const v2 = window.GugudanV2 || {};
    const gameConfig = v2.gameConfig || {};
    let db = null;
    let auth = null;
    try {
        if (window.firebase) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            v2.auth = auth;
        } else {
            console.warn('[Firebase] SDKÎ•?Î∂àÎü¨?§Ï? Î™ªÌñà?µÎãà?? Í≤åÏä§??Í≤åÏûÑ?Ä Í≥ÑÏÜç ?¥Ïö©?????àÏäµ?àÎã§.');
        }
    } catch (error) {
        console.warn('[Firebase] Ï¥àÍ∏∞?îÏóê ?§Ìå®?àÏäµ?àÎã§. Í≤åÏä§??Í≤åÏûÑ?Ä Í≥ÑÏÜç ?¥Ïö©?????àÏäµ?àÎã§.', error);
    }
    if (v2.rankingService) v2.rankingService.setDatabase(db, window.firebase);

    window.NYANKO_APP_INFO = {
        version: "2.1.1",
        buildDate: "2026-07-25",
        buildTime: "08:02",
        dataResetversion: "2.1.1"
    };

    // Í≥ºÍ±∞ ?àÍ±∞??Í≥µÌÜµ ???êÎèô Î≥µÍµ¨ Î∞©Ï? Ï≤?Üå Î∞?Í∞ïÏ†ú ?ÑÏ≤¥ ?∞Ïù¥??Ï¥àÍ∏∞??
    const DATA_RESET_VERSION = window.NYANKO_APP_INFO.dataResetVersion;
    const storedResetVersion = localStorage.getItem("nyanko:data-reset-version");
    if (storedResetVersion !== DATA_RESET_VERSION) {
        const keysToDelete = [
            'saveData', 'userData', 'playerData', 'nyankoSave', 'currentUser', 'playerId', 'guestData',
            'rewardHistory', 'processedV4Sessions', 'gugudanV2Save', 'gugudanV2AdminConfig',
            'nyanko:google-user:',
            'nyanko:v4:guest:cache'
        ];
        
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && keysToDelete.some(k => key === k || key.startsWith(k))) {
                try { localStorage.removeItem(key); } catch(e){}
            }
        }
        
        localStorage.setItem("nyanko:data-reset-version", DATA_RESET_VERSION);
        console.log("[Data Reset] Game storage initialized to reset version: "2.1.1"vibrate" in navigator) { navigator.vibrate(pattern); } }

    let currentUser = null; 
    let currentUserData = null; 
    let isGuestMode = false;
    let currentSession = null;
    let currentProfile = null;
    let currentQIndex = 0; const totalQuestions = gameConfig.classic ? gameConfig.classic.totalQuestions : 20; let answerContent = 0; let questionStartTime = 0;
    const maxTime = gameConfig.classic ? gameConfig.classic.secondsPerQuestion : 5; let timeLeft = 0; let timerInterval = null; let countdownInterval = null;
    let sessionCorrect = 0; let sessionSpeedScore = 0; let classicTenComboShown = false;
    let answerLocked = false;
    
    let lastQuestionStr = ""; 
    let unsubscribeUserDoc = null;

    // 4-5. Í∏∞Ï°¥ Í∏∞Í∏∞Î≥??∞Ïù¥???àÏ†Ñ Î≥ëÌï© ?®Ïàò (Î©±Îì± Î∞©Ïãù)
    function mergeLegacyData(remote, local) {
        if (!remote) return local;
        if (!local) return remote;
        
        const merged = JSON.parse(JSON.stringify(remote));
        
        // 1. Î≥¥Ïú† Í≥†Ïñë??(?©Ïßë??
        const remoteOwned = remote.collection?.ownedCatIds || ['base_normal_01'];
        const localOwned = local.collection?.ownedCatIds || ['base_normal_01'];
        const mergedOwnedSet = new Set([...remoteOwned, ...localOwned]);
        if (!merged.collection) merged.collection = {};
        merged.collection.ownedCatIds = Array.from(mergedOwnedSet);
        
        // 2. Ï§ëÎ≥µ ?üÏàò?Ä Ï°∞Í∞Å (Math.max)
        const remoteDup = remote.collection?.duplicateCounts || {};
        const localDup = local.collection?.duplicateCounts || {};
        const mergedDup = {};
        const allCatIds = new Set([...Object.keys(remoteDup), ...Object.keys(localDup)]);
        allCatIds.forEach(catId => {
            mergedDup[catId] = Math.max(Number(remoteDup[catId]) || 0, Number(localDup[catId]) || 0);
        });
        merged.collection.duplicateCounts = mergedDup;
        
        const remoteFrags = remote.collection?.catFragments || {};
        const localFrags = local.collection?.catFragments || {};
        const mergedFrags = {};
        ['normal', 'rare', 'hero', 'legendary'].forEach(rarity => {
            mergedFrags[rarity] = Math.max(Number(remoteFrags[rarity]) || 0, Number(localFrags[rarity]) || 0);
        });
        merged.collection.catFragments = mergedFrags;
        
        // 3. ÏΩîÏù∏, ÎΩëÍ∏∞Í∂? ?¨Ïù∏??(Math.max)
        if (!merged.currency) merged.currency = {};
        const remoteCoins = remote.currency?.coins || 0;
        const localCoins = local.currency?.coins || 0;
        merged.currency.coins = Math.max(Number(remoteCoins) || 0, Number(localCoins) || 0);
        
        const remoteNormal = remote.currency?.normalTickets || 0;
        const localNormal = local.currency?.normalTickets || 0;
        merged.currency.normalTickets = Math.max(Number(remoteNormal) || 0, Number(localNormal) || 0);
        
        const remotePremium = remote.currency?.premiumTickets || 0;
        const localPremium = local.currency?.premiumTickets || 0;
        merged.currency.premiumTickets = Math.max(Number(remotePremium) || 0, Number(localPremium) || 0);
        
        const remotePoints = remote.totalPoints || 0;
        const localPoints = local.totalPoints || 0;
        merged.totalPoints = Math.max(Number(remotePoints) || 0, Number(localPoints) || 0);
        
        // 4. ?ÄÎ™®Ìóò ÏßÑÌñâ??
        if (!merged.adventureProgress) merged.adventureProgress = { unlockedWorldIds: ['world_01'], unlockedStageIds: ['stage_01_01'], clearedStageIds: [], stageRecords: {} };
        const remoteAdv = remote.adventureProgress || {};
        const localAdv = local.adventureProgress || {};
        
        const remoteCleared = remoteAdv.clearedStageIds || [];
        const localCleared = localAdv.clearedStageIds || [];
        merged.adventureProgress.clearedStageIds = Array.from(new Set([...remoteCleared, ...localCleared]));
        
        const remoteUnlockedW = remoteAdv.unlockedWorldIds || ['world_01'];
        const localUnlockedW = localAdv.unlockedWorldIds || ['world_01'];
        merged.adventureProgress.unlockedWorldIds = Array.from(new Set([...remoteUnlockedW, ...localUnlockedW]));
        
        const remoteUnlockedS = remoteAdv.unlockedStageIds || ['stage_01_01'];
        const localUnlockedS = localAdv.unlockedStageIds || ['stage_01_01'];
        merged.adventureProgress.unlockedStageIds = Array.from(new Set([...remoteUnlockedS, ...localUnlockedS]));
        
        const remoteRecords = remoteAdv.stageRecords || {};
        const localRecords = localAdv.stageRecords || {};
        const mergedRecords = {};
        const allStageIds = new Set([...Object.keys(remoteRecords), ...Object.keys(localRecords)]);
        allStageIds.forEach(stageId => {
            const rRec = remoteRecords[stageId] || {};
            const lRec = localRecords[stageId] || {};
            mergedRecords[stageId] = {
                cleared: Boolean(rRec.cleared || lRec.cleared),
                bestStars: Math.max(Number(rRec.bestStars) || 0, Number(lRec.bestStars) || 0),
                bestScore: Math.max(Number(rRec.bestScore) || 0, Number(lRec.bestScore) || 0),
                bestAccuracy: Math.max(Number(rRec.bestAccuracy) || 0, Number(lRec.bestAccuracy) || 0),
                bestCombo: Math.max(Number(rRec.bestCombo) || 0, Number(lRec.bestCombo) || 0),
                bestRemainingLives: Math.max(Number(rRec.bestRemainingLives) || 0, Number(lRec.bestRemainingLives) || 0),
                clearCount: (Number(rRec.clearCount) || 0) + (Number(lRec.clearCount) || 0),
                firstClearedAt: rRec.firstClearedAt || lRec.firstClearedAt || null,
                lastPlayedAt: rRec.lastPlayedAt || lRec.lastPlayedAt || null
            };
        });
        merged.adventureProgress.stageRecords = mergedRecords;
        
        // 5. ?Ä??Í≥†Ïñë??
        let selectedCat = remote.profile?.selectedCatId || '';
        if (!selectedCat || merged.collection.ownedCatIds.indexOf(selectedCat) < 0) {
            selectedCat = local.profile?.selectedCatId || '';
        }
        if (!selectedCat || merged.collection.ownedCatIds.indexOf(selectedCat) < 0) {
            selectedCat = 'base_normal_01';
        }
        if (!merged.profile) merged.profile = {};
        merged.profile.selectedCatId = selectedCat;
        
        return merged;
    }

    if (auth) {
        auth.getRedirectResult().catch(function(err) {
            console.error("[Firebase Redirect Auth Error]", err);
            if (err.code === 'auth/unauthorized-domain') {
                alert("Firebase ?πÏù∏???ÑÎ©î???§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??");
            } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                alert("Google Î°úÍ∑∏?∏Ïù¥ Ï∑®ÏÜå?òÏóà?µÎãà??");
            }
        });

        auth.onAuthStateChanged(async function(user) {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
                unsubscribeUserDoc = null;
            }

            currentUser = null;
            currentUserData = null;
            isGuestMode = false;
            currentSession = null;
            currentProfile = null;
            window.currentSession = null;
            window.currentProfile = null;

            if (!user) {
                const guestSessionStr = sessionStorage.getItem("nyanko:guest:temporary-session");
                if (guestSessionStr) {
                    try {
                        const guestSession = JSON.parse(guestSessionStr);
                        applyGuestState(guestSession);
                        showLobby();
                        return;
                    } catch (e) {
                        console.warn("[Guest Session Restore Error]", e);
                    }
                }
                v2.storageService.setStorageKey("nyanko:v4:guest:cache");
                showScreen('login-screen');
                return;
            }

            const uid = user.uid;
            console.debug("[Google Authenticated User]", { uid: uid, email: user.email });
            console.debug("[Admin UID Verification Check]", {
                currentUid: uid,
                targetAdminUid: OWNER_ADMIN_UID,
                isMatch: uid === OWNER_ADMIN_UID
            });

            currentSession = {
                uid: user.uid,
                email: user.email,
                isGuest: false,
                isAdmin: isOwnerAdmin(user)
            };
            window.currentSession = currentSession;

            const cacheKey = `nyanko:google-user:${uid}:cache`;
            v2.storageService.setStorageKey(cacheKey);
            toggleLoading(true);

            try {
                const userRef = db.collection('users').doc(uid);
                const doc = await userRef.get();

                if (doc.exists) {
                    const remoteData = doc.data();
                    if (remoteData.profile && remoteData.profile.nickname) {
                        currentUser = uid;
                        currentUserData = remoteData;
                        currentProfile = {
                            ...remoteData,
                            uid: uid
                        };
                        window.currentProfile = currentProfile;
                        v2.storageService.saveSaveData(remoteData);
                        refreshAdminAccessUI(user);
                        showLobby();
                        connectRealtimeListener(userRef, uid);
                    } else {
                        currentUser = uid;
                        showScreen('profile-setup-screen');
                    }
                } else {
                    currentUser = uid;
                    showScreen('profile-setup-screen');
                }
            } catch (err) {
                console.error("[Auth Load Failed]", err);
                alert("?¨Ïö©???ïÎ≥¥Î•?Í∞Ä?∏Ïò§???ÑÏ§ë ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
            } finally {
                toggleLoading(false);
            }
        });
    }

    function connectRealtimeListener(userRef, uid) {
        unsubscribeUserDoc = userRef.onSnapshot(function(snapshot) {
            if (snapshot.exists) {
                const nextData = snapshot.data();
                const activeScreen = document.querySelector('.screen.active-screen');
                const isPlaying = activeScreen && (activeScreen.id === 'play-screen' || activeScreen.id === 'adventure-screen' || (window.NyankoGameState && window.NyankoGameState.isPlaying));

                if (!isPlaying) {
                    currentUserData = nextData;
                    v2.storageService.saveSaveData(nextData);
                    
                    if (typeof refreshHomeStatsFromCurrentUser === 'function') {
                        refreshHomeStatsFromCurrentUser();
                    }
                    if (typeof renderPhase4Currency === 'function') {
                        renderPhase4Currency();
                    }
                    console.debug("[User Sync]", {
                        uid: uid,
                        source: "firebase",
                        ownedCatCount: nextData.collection?.ownedCatIds?.length || 0,
                        totalPoints: nextData.totalPoints || 0,
                        level: nextData.level || 1,
                        representativeCatId: nextData.profile?.selectedCatId || 'base_normal_01'
                    });
                }
            }
        });
    }

    async function loginWithGoogle() {
        initAudio();
        if (!auth) {
            return alert("Firebase AuthÎ•??¨Ïö©?????ÜÏäµ?àÎã§. SDK Ï¥àÍ∏∞???§Î•ò?ÖÎãà??");
        }
        if (loginWithGoogle.inProgress) return;
        loginWithGoogle.inProgress = true;
        toggleLoading(true);

        const provider = new firebase.auth.GoogleAuthProvider();
        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

        try {
            if (isMobile) {
                await auth.signInWithRedirect(provider);
            } else {
                await auth.signInWithPopup(provider);
            }
        } catch (err) {
            console.error("[Google Login Error]", {
                code: err?.code,
                message: err?.message
            });
            if (err.code === 'auth/popup-blocked') {
                try {
                    await auth.signInWithRedirect(provider);
                } catch (redirErr) {
                    console.error("[Google Redirect Retry Error]", redirErr);
                    alert("Î°úÍ∑∏??Ï≤òÎ¶¨ Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
                }
            } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                alert("Google Î°úÍ∑∏?∏Ïù¥ Ï∑®ÏÜå?òÏóà?µÎãà??");
            } else if (err.code === 'auth/unauthorized-domain') {
                alert("Firebase ?πÏù∏???ÑÎ©î???§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??");
            } else {
                alert("Î°úÍ∑∏??Ï≤òÎ¶¨ Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
            }
        } finally {
            loginWithGoogle.inProgress = false;
            toggleLoading(false);
        }
    }

    async function setupNewProfile() {
        const nicknameInput = document.getElementById('new-nickname-input');
        if (!nicknameInput) return;
        const nickname = nicknameInput.value.trim();

        if (nickname.length < 2 || nickname.length > 12) {
            return alert("?âÎÑ§?ÑÏ? 2???¥ÏÉÅ 12???¥ÌïòÎ°??ëÏÑ±??Ï£ºÏÑ∏?îÎÉ•!");
        }
        if (!/^[a-zA-Z0-9Í∞Ä-?£„Ñ±-?é„Öè-??s]+$/.test(nickname)) {
            return alert("?âÎÑ§?ÑÏóê???úÍ?, ?ÅÎ¨∏, ?´ÏûêÎß??¨Ïö©?????àÏäµ?àÎã§??");
        }

        if (!currentUser) {
            return alert("?∏Ï¶ù ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§. Î°úÍ∑∏?∏ÏùÑ ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏?îÎÉ•.");
        }

        toggleLoading(true);
        try {
            const uid = currentUser;
            const userRef = db.collection('users').doc(uid);
            
            let finalData = null;

            await db.runTransaction(async function(transaction) {
                const snapshot = await transaction.get(userRef);
                if (snapshot.exists) {
                    const currentData = snapshot.data() || {};
                    const updatedProfile = currentData.profile || {};
                    updatedProfile.nickname = nickname;
                    updatedProfile.selectedCatId = updatedProfile.selectedCatId || 'base_normal_01';
                    
                    transaction.set(userRef, {
                        profile: updatedProfile,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } else {
                    const defaults = JSON.parse(JSON.stringify(v2.storageService.defaults || {
                        profile: { selectedCatId: 'base_normal_01', nickname: nickname },
                        collection: { ownedCatIds: ['base_normal_01'], duplicateCounts: {} },
                        currency: { coins: 1000, normalTickets: 3, premiumTickets: 0, seasonTickets: {} },
                        classicRecord: { totalPoints: 0, bestCombo: 0, bestAccuracy: 0, playedCount: 0 },
                        timeAttackRecord: { bestCorrectCount: 0, bestAccuracy: 0, playedCount: 0 },
                        adventureProgress: { clearedStageIds: [], unlockedWorldIds: ['world_01'], unlockedStageIds: ['stage_01_01'], stageRecords: {} },
                        settings: { soundEnabled: true },
                        unclaimedAchievements: [],
                        completedAchievements: []
                    }));

                    defaults.profile.nickname = nickname;
                    defaults.profile.selectedCatId = defaults.profile.selectedCatId || 'base_normal_01';
                    defaults.scoringVersion = 4;
                    defaults.totalPoints = 0;
                    defaults.level = 1;
                    defaults.lastRewardedLevel = 1;
                    defaults.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    defaults.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    transaction.set(userRef, defaults);
                }
            });

            const refreshedDoc = await userRef.get();
            finalData = refreshedDoc.data();

            currentUserData = finalData;
            currentProfile = {
                ...finalData,
                uid: uid
            };
            window.currentProfile = currentProfile;
            v2.storageService.saveSaveData(finalData);

            console.log("[New User Profile Created/Merged]", uid, nickname);
            nicknameInput.value = '';

            refreshAdminAccessUI(auth ? auth.currentUser : null);
            showLobby();
            connectRealtimeListener(userRef, uid);

        } catch (err) {
            console.error("[Profile Setup Failed]", err);
            alert("?ÑÎ°ú???ùÏÑ± Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§. ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏?îÎÉ•.");
        } finally {
            toggleLoading(false);
        }
    }

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active-screen');
        }
        document.body.classList.toggle('is-admin-mode', screenId === 'admin-screen');
    }

    function toggleLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
        const googleBtn = document.querySelector('.btn-google');
        if (googleBtn) {
            googleBtn.disabled = Boolean(show);
            const labelSpan = googleBtn.querySelector('.google-btn-label');
            if (labelSpan) {
                labelSpan.textContent = show ? "Google Î°úÍ∑∏??Ï§?.." : "Google Í≥ÑÏ†ï?ºÎ°ú ?úÏûë?òÍ∏∞";
            }
        }
    }

    function clearClassicRuntime() {
        clearInterval(timerInterval);
        clearInterval(countdownInterval);
        timerInterval = null;
        countdownInterval = null;
    }
    window.clearClassicRuntime = clearClassicRuntime;

    function safelyClearClassicRuntime() {
        if (typeof clearClassicRuntime === 'function') {
            try {
                clearClassicRuntime();
                return;
            } catch (e) {
                console.warn("[Lobby] Classic runtime cleanup failed", e);
            }
        }
        console.debug("[Lobby] Classic runtime cleanup skipped: no active runtime");
    }

    const OWNER_ADMIN_UID = "9K1X8FA8MvYLOycqZrc6Iw0s5cC3";

    function isOwnerAdmin(user) {
        return Boolean(
            user &&
            user.isAnonymous !== true &&
            user.uid === OWNER_ADMIN_UID
        );
    }
    window.isOwnerAdmin = isOwnerAdmin;

    function refreshAdminAccessUI(user) {
        const allowed = isOwnerAdmin(user);
        document.querySelectorAll("[data-owner-admin-only]").forEach(element => {
            element.hidden = !allowed;
            element.style.display = allowed ? "" : "none";
        });
        const currentSession = window.currentSession || {};
        currentSession.isAdmin = allowed;
        window.currentSession = currentSession;
    }
    window.refreshAdminAccessUI = refreshAdminAccessUI;

    async function openOwnerAdminPage() {
        const user = auth ? auth.currentUser : null;
        if (!isOwnerAdmin(user)) {
            alert("Í¥ÄÎ¶¨Ïûê Í∂åÌïú???ÜÏäµ?àÎã§.");
            return;
        }
        if (typeof window.showAdminScreen === 'function') {
            window.showAdminScreen();
        }
    }
    window.openOwnerAdminPage = openOwnerAdminPage;
    window.openAdminPage = openOwnerAdminPage; // fallback

    async function showAdminScreen() {
        const userToCheck = auth ? auth.currentUser : null;
        if (!isOwnerAdmin(userToCheck)) {
            alert("Í¥ÄÎ¶¨Ïûê Í∂åÌïú???ÜÏäµ?àÎã§.");
            showLobby();
            return;
        }
        listDiv.innerHTML = '';
        try {
            const snapshot = await db.collection('users').get();
            if(snapshot.empty) { listDiv.innerHTML = '<p style="text-align:center;">?±Î°ù???ôÏÉù???ÜÏäµ?àÎã§.</p>'; } 
            else {
                snapshot.forEach(doc => {
                    let u = doc.id; let data = doc.data();
                    const div = document.createElement('div'); div.className = 'ranking-item';
                    const pending = data.pendingResources || data.pendingTickets || {};
                    const resources = [{key:'coins',label:'ÏΩîÏù∏',internal:'currency.coins'},{key:'normal',label:'Í∏∞Î≥∏ ÎΩëÍ∏∞Í∂?,internal:'currency.normalTickets'},{key:'premium',label:'Í≥†Í∏â ÎΩëÍ∏∞Í∂?,internal:'currency.premiumTickets'},{key:'season',label:'?úÏ¶å ÎΩëÍ∏∞Í∂?,internal:'currency.seasonTickets.season_01'}];
                    div.innerHTML = `<div class="admin-user-heading"><b>${u}</b><span>Lv.${data.level || 1} ¬∑ ${data.totalPoints || 0}P</span></div><div class="admin-resource-header"><b>?¨Ìôî</b><b>?¥Î? ID</b><b>?òÎüâ</b><b>ÏßÄÍ∏?/b></div><div class="admin-resource-grid">${resources.map(resource=>`<div class="admin-resource-row"><span class="admin-resource-label">${resource.label}</span><code class="admin-resource-id">${resource.internal}</code><input class="admin-resource-amount" id="resource-${resource.key}-${u}" type="number" min="1" max="10000" value="1" aria-label="${u} ${resource.label} ?òÎüâ"><button class="btn btn-small" onclick="grantResource('${u}','${resource.key}')">ÏßÄÍ∏?/button></div>`).join('')}</div><small>?ÄÍ∏? ÏΩîÏù∏ ${pending.coins || 0} ¬∑ Í∏∞Î≥∏ ${pending.normal || 0} ¬∑ Í≥†Í∏â ${pending.premium || 0} ¬∑ ?úÏ¶å ${pending.season || 0}</small><div class="admin-user-actions"><button class="btn btn-small" onclick="resetUser('${u}')">Ï¥àÍ∏∞??/button><button class="btn btn-danger btn-small" onclick="deleteUser('${u}')">??†ú</button></div>`;
                    listDiv.appendChild(div);
                });
            }
        } catch(e) { alert("?∞Ïù¥?∞Î? Î∂àÎü¨?§Ï? Î™ªÌñà?§ÎÉ•!"); }
        toggleLoading(false);
        showScreen('admin-screen');
    }
    
    async function resetUser(u) {
        const user = auth ? auth.currentUser : null;
        if (!isOwnerAdmin(user)) {
            alert("Í¥ÄÎ¶¨Ïûê Í∂åÌïú???ÜÏäµ?àÎã§.");
            return;
        }
        if(confirm(`${u}???êÏàòÎ•?Ï¥àÍ∏∞???òÏãúÍ≤†Ïäµ?àÍπå?`)) {
            toggleLoading(true); await db.collection('users').doc(u).update({ totalPoints: 0, level: 1, playCount: 0, rewards: [] }); showAdminScreen(); 
        }
    }
    async function deleteUser(u) {
        const user = auth ? auth.currentUser : null;
        if (!isOwnerAdmin(user)) {
            alert("Í¥ÄÎ¶¨Ïûê Í∂åÌïú???ÜÏäµ?àÎã§.");
            return;
        }
        if(confirm(`${u}??Í≥ÑÏ†ï???ÑÏ†Ñ????†ú?òÏãúÍ≤†Ïäµ?àÍπå?`)) {
            toggleLoading(true); await db.collection('users').doc(u).delete(); showAdminScreen(); 
        }
    }

    const GUEST_SESSION_KEY = "nyanko:guest:temporary-session";

    function applyGuestState(session) {
        currentUser = session.id;
        currentUserData = {
            profile: { nickname: session.nickname, selectedCatId: session.representativeCatId },
            collection: { ownedCatIds: session.ownedCats, duplicateCounts: {} },
            currency: { coins: session.coins, normalTickets: 0, premiumTickets: 0, seasonTickets: {} },
            totalPoints: session.totalPoints,
            level: session.level,
            classicRecord: { totalPoints: session.totalPoints, bestCombo: 0, bestAccuracy: 0, playedCount: 0 },
            timeAttackRecord: { bestCorrectCount: 0, bestAccuracy: 0, playedCount: 0 },
            adventureProgress: { clearedStageIds: [], unlockedWorldIds: ['world_01'], unlockedStageIds: ['stage_01_01'], stageRecords: {} },
            settings: { soundEnabled: true }
        };
        isGuestMode = true;
        currentSession = {
            uid: session.id,
            email: "",
            isGuest: true,
            isAdmin: false
        };
        currentProfile = {
            ...currentUserData,
            uid: session.id
        };
        window.currentSession = currentSession;
        window.currentProfile = currentProfile;
        v2.storageService.setStorageKey("nyanko:v4:guest:cache");
        v2.storageService.saveSaveData(currentUserData);
    }

    function createFreshGuestSession() {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        const guestSession = {
            id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'guest_' + Math.random().toString(36).substring(2, 15),
            nickname: "Í≤åÏä§??,
            totalPoints: 0,
            level: 1,
            coins: 1000,
            ownedCats: ['base_normal_01'],
            representativeCatId: 'base_normal_01',
            createdAt: Date.now()
        };
        sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestSession));
        applyGuestState(guestSession);
    }

    function clearGuestState() {
        currentUser = null;
        currentUserData = null;
        isGuestMode = false;
        currentSession = null;
        currentProfile = null;
        window.currentSession = null;
        window.currentProfile = null;
        if (v2.storageService && typeof v2.storageService.clearInMemoryUserState === 'function') {
            v2.storageService.clearInMemoryUserState();
        }
    }

    async function playAsGuest() {
        initAudio();
        toggleLoading(true);
        try {
            if (auth && auth.currentUser) {
                await auth.signOut();
            }
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
                unsubscribeUserDoc = null;
            }
            clearGuestState();
            refreshAdminAccessUI(null);
            createFreshGuestSession();
            showLobby();
        } catch (error) {
            console.error("[Guest Mode Start Error]", error);
            alert("Í≤åÏä§??Î°úÍ∑∏??Ï≤òÎ¶¨ Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
        } finally {
            toggleLoading(false);
        }
    }
    async function logout() {
        window.__nyankoAdminSession = false;
        sessionStorage.removeItem("nyanko:guest:temporary-session");
        refreshAdminAccessUI(null);
        const adminBtnContainer = document.getElementById('admin-button-container');
        if (adminBtnContainer) adminBtnContainer.innerHTML = '';

        if (v2.storageService) {
            var currentSave = v2.storageService.loadSaveData();
            v2.storageService.saveSaveData(currentSave);
            if (typeof v2.storageService.clearInMemoryUserState === 'function') {
                v2.storageService.clearInMemoryUserState();
            }
        }
        currentUser = null;
        currentUserData = null;
        isGuestMode = false;
        document.getElementById('lobby-selected-cat').innerHTML = '';
        document.getElementById('collection-grid').innerHTML = '';
        const uIn = document.getElementById('username-input');
        if (uIn) uIn.value = "";
        const pIn = document.getElementById('password-input');
        if (pIn) pIn.value = "";

        if (auth && auth.currentUser) {
            try {
                await auth.signOut();
            } catch (err) {
                console.error("[Logout signout error]", err);
            }
        }
        showScreen('login-screen');
    }

    function showLobby() {
        refreshAdminAccessUI(auth ? auth.currentUser : null);
        try {
            safelyClearClassicRuntime();
        } catch (error) {
            console.warn("[Lobby Runtime Cleanup Warning]", error);
        }
        try {
            if (window.clearPhase2Runtime) window.clearPhase2Runtime();
        } catch (error) {
            console.warn("[Lobby Phase2 Runtime Cleanup Warning]", error);
        }
        const nickname = (currentUserData && currentUserData.profile && currentUserData.profile.nickname) || currentUser;
        document.getElementById('lobby-name').innerText = nickname;
        // Í∏∞Ï°¥ Firebase Î≥¥ÏÉÅ Î™©Î°ù?Ä ???ÑÍ∞ê DOM???ûÏ? ?äÎäî??
        const grid = document.createElement('div');
        const soundToggle = document.getElementById('sound-enabled-toggle');
        if (soundToggle && v2.storageService) soundToggle.checked = v2.storageService.loadSaveData().settings.soundEnabled;

        if (!isGuestMode) {
            document.getElementById('lobby-level').innerText = currentUserData.level;
            document.getElementById('lobby-points').innerText = currentUserData.totalPoints;
            document.getElementById('lobby-stats-box').style.display = 'block';
            document.getElementById('collection-box').style.display = 'block';

            if (currentUserData.rewards && currentUserData.rewards.length > 0) {
                const rankInfo = [
                    { id: 'UR', title: '?åü ?ÑÏÑ§ (Legend)' },
                    { id: 'SR', title: '‚≠ê‚≠ê‚≠??ÅÏõÖ (Super Rare)' },
                    { id: 'R',  title: '‚≠ê‚≠ê ?¨Í? (Rare)' },
                    { id: 'N',  title: '‚≠??ºÎ∞ò (Normal)' }
                ];

                rankInfo.forEach(r => {
                    const catsInThisRank = currentUserData.rewards.filter(cat => cat.rank === r.id);
                    if (catsInThisRank.length > 0) {
                        const titleDiv = document.createElement('div');
                        titleDiv.style.width = '100%'; titleDiv.style.textAlign = 'left'; titleDiv.style.fontSize = '14px'; titleDiv.style.fontWeight = 'bold'; titleDiv.style.color = '#333'; titleDiv.style.margin = '15px 0 5px 0'; titleDiv.style.borderBottom = '2px dashed #DDD';
                        titleDiv.innerText = `${r.title} (${catsInThisRank.length}ÎßàÎ¶¨)`;
                        grid.appendChild(titleDiv);

                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'collection-grid'; groupDiv.style.marginTop = '0'; groupDiv.style.justifyContent = 'flex-start';

                        catsInThisRank.forEach(cat => {
                            const item = document.createElement('div'); item.className = 'collection-item';
                            item.style.backgroundColor = cat.bg; item.style.borderColor = cat.border;
                            
                            const badge = document.createElement('div'); badge.className = 'rarity-badge'; badge.innerText = cat.rank; badge.style.backgroundColor = cat.border;
                            item.appendChild(badge);
                            
                            const img = document.createElement('img'); img.src = `https://robohash.org/${cat.id}.png?set=set4&size=100x100`; img.alt = `${r.title} Í≥†Ïñë??;
                            if (v2.assetLoader) v2.assetLoader.applyImageFallback(img, '');
                            item.appendChild(img);
                            groupDiv.appendChild(item);
                        });
                        grid.appendChild(groupDiv);
                    }
                });
            } else { grid.innerHTML = '<p style="color:#999; margin:10px; font-size:14px;">?ÑÏßÅ Î™®Ï? Í≥†Ïñë?¥Í? ?ÜÎã§?? ?àÎ≤®?ÖÏùÑ ?¥Î≥¥?ºÎÉ•!</p>'; }
        } else {
            document.getElementById('lobby-stats-box').style.display = 'none'; document.getElementById('collection-box').style.display = 'none';
        }
        showScreen('lobby-screen');
        document.getElementById('collection-box').style.display = 'block';
        document.body.classList.toggle('reduced-motion', Boolean(v2.storageService.loadSaveData().settings.reducedMotion));
        if (window.renderBaseCollection) window.renderBaseCollection();
        if (v2.isFeatureEnabled && v2.isFeatureEnabled('seasons') && window.renderSeasonBanner) window.renderSeasonBanner();
        if (window.renderDailyMissions) window.renderDailyMissions();
    }

    function updateLiveAccuracy() {
        let currentAcc = currentQIndex > 1 ? Math.floor((sessionCorrect / (currentQIndex - 1)) * 100) : 100;
        document.getElementById('current-accuracy').innerText = `?ïÎãµÎ•? ${currentAcc}%`;
    }

    function updateLivePoints() {
        const livePts = document.getElementById('live-points');
        const currentPoints = sessionCorrect * 10 + sessionSpeedScore;
        livePts.innerText = `?ÑÏû¨ ?çÎìù: ${currentPoints}P`;
        
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
        document.body.classList.remove('boss-mode'); // Î≥¥Ïä§ Î™®Îìú ?¥Ï†ú
        document.getElementById('reward-box').style.display = 'none';
        updateLivePoints(); 
        
        showScreen('play-screen'); nextMarathonQuestionFlow();
    }

    // ?î• Î≥¥Ïä§???êÎ¶Ñ ?úÏñ¥ ?®Ïàò ?î•
    function nextMarathonQuestionFlow() {
        if (currentQIndex >= totalQuestions) return endMarathonGame();
        
        // 18Î≤?Î¨∏Ï†úÎ•?Îß??ùÎÇ¥Í≥?19Î≤àÏúºÎ°??òÏñ¥Í∞?Ï∞®Î?????Î≥¥Ïä§ Í≤ΩÍ≥† Î∞úÏÉù!
        if (currentQIndex === 18) {
            triggerBossWarning();
        } else {
            generateNextQuestion();
        }
    }

    // ?ö® Î≥¥Ïä§ Í≤ΩÍ≥† ?¥Î≤§??Î∞úÎèô ?ö®
    function triggerBossWarning() {
        playSound('siren');
        triggerVibration([500, 200, 500]);
        
        const warningScreen = document.getElementById('boss-warning');
        warningScreen.style.display = 'flex';
        
        // 2Ï¥???Í≤ΩÍ≥†Ï∞??´Í≥† Î≥¥Ïä§ ?åÎßà ?ÅÏö© ??19Î≤?Î¨∏Ï†ú ?úÏûë
        setTimeout(() => {
            warningScreen.style.display = 'none';
            document.body.classList.add('boss-mode');
            generateNextQuestion();
        }, 2000);
    }

    // ?§Ï†ú Î¨∏Ï†ú ?ùÏÑ± Î°úÏßÅ
    function generateNextQuestion() {
        currentQIndex++; updateLiveAccuracy();
        answerLocked = false;
        document.getElementById('q-counter').innerText = `Î¨∏Ï†ú: ${currentQIndex}/${totalQuestions}`;
        document.getElementById('progress-bar').style.width = `${(currentQIndex / totalQuestions) * 100}%`;
        document.getElementById('feedback').innerText = "";
        
        // 1~18Î≤àÏ? 4ÏßÄ?†Îã§, 19~20Î≤?Î≥¥Ïä§???Ä 8ÏßÄ?†Îã§
        let optionsCount = (currentQIndex <= 18) ? 4 : 8; 
        // 16~20Î≤?Íµ¨Í∞ÑÎ∂Ä?∞Îäî ?ºÏùò ?êÎ¶¨ ?®Ï†ï ?ÅÏö©
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
        const feedback = document.getElementById('feedback'); feedback.innerText = "???úÍ∞Ñ Ï¥àÍ≥º??"; feedback.className = "wrong-anim";
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
            if (currentQIndex % 5 === 0 && sessionCorrect === currentQIndex) praise = '?ºÌéô?? ?ÑÎ≤Ω??Í≥ÑÏÇ∞?¥Îã§??';
            feedback.innerText = praise; feedback.className = "correct-anim"; document.getElementById('question').className = "question-text correct-anim";
            try { if (v2.soundService) v2.soundService.playCorrectSound(); else playSound('correct'); if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('correct'); } catch(e) { playSound('correct'); } triggerVibration([100, 50, 100]); 
        } else {
            if (v2.gameState) v2.gameState.recordWrongAnswer();
            feedback.innerText = "?í¶ ?Ä?∏Îã§??"; feedback.className = "wrong-anim"; document.getElementById('question').className = "question-text wrong-anim";
            try { if (v2.soundService) v2.soundService.playWrongSound(); else playSound('wrong'); if(v2.catPresentationRuntime)v2.catPresentationRuntime.playFeedback('wrong'); } catch(e) { playSound('wrong'); } triggerVibration([300, 100, 300, 100, 300]); 
        }
        disableBtns(); setTimeout(nextMarathonQuestionFlow, 1000);
    }

    function disableBtns() { document.querySelectorAll('.btn-answer').forEach(b => b.disabled = true); }

    const SCORING_SCHEMA_VERSION = 4;
    const LEVEL_BASE_POINTS = 2000;
    const LEVEL_GROWTH_POINTS = 500;

    function requiredTotalPointsForLevel(level) {
        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        const completedLevels = safeLevel - 1;
        return completedLevels * LEVEL_BASE_POINTS + (completedLevels * (completedLevels - 1) / 2) * LEVEL_GROWTH_POINTS;
    }
    v2.requiredTotalPointsForLevel = requiredTotalPointsForLevel;

    function calculateLevelFromPoints(totalPoints) {
        let level = 1;
        while (totalPoints >= requiredTotalPointsForLevel(level + 1)) {
            level += 1;
        }
        return Math.min(level, 999);
    }
    v2.calculateLevelFromPoints = calculateLevelFromPoints;

    const POINTS_PER_CORRECT = 10;
    function calculateSessionPoints(correctCount) {
        const safeCorrectCount = Math.max(0, Math.floor(Number(correctCount) || 0));
        return safeCorrectCount * POINTS_PER_CORRECT;
    }
    v2.calculateSessionPoints = calculateSessionPoints;

    // V4 ?àÎ≤®???åÎ¶º ?ùÏóÖ
    function showLevelUpAlertV4(newLevel, ticketCount) {
        alert("?éâ ?àÎ≤® ?? ?éâ\n\n?àÎ≤® " + newLevel + "???¨ÏÑ±?àÎã§??\nÍ≥†Í∏â ÎΩëÍ∏∞Í∂?" + ticketCount + "?•ÏùÑ Î∞õÏïò?¥Ïöî.");
    }

    // V4 Í≥µÌÜµ Í≤∞Í≥º Ï≤òÎ¶¨ ?®Ïàò
    async function finalizeGameResultV4(result) {
        if (!result || !result.sessionId) return;
        v2.finalizingSessionIdsV4 = v2.finalizingSessionIdsV4 || {};
        if (v2.finalizingSessionIdsV4[result.sessionId]) {
            console.warn('[Session V4 finalization locked] already running:', result.sessionId);
            return;
        }
        v2.finalizingSessionIdsV4[result.sessionId] = true;

        try {
            var mode = result.mode;
            var correctCount = Number(result.correctCount) || 0;
            var wrongCount = Number(result.wrongCount) || 0;
            var answeredCount = Number(result.answeredCount || result.totalQuestions || (correctCount + wrongCount)) || 0;
            var earnedPoints = calculateSessionPoints(correctCount);
            var completedAt = result.completedAt || result.playedAt || new Date().toISOString();
            var stageId = result.stageId || null;

            // 1. LocalStorage Ï§ëÎ≥µ Í≤ÄÏ¶?
            var save = v2.storageService.loadSaveData();
            save.rewardHistory = save.rewardHistory || {};
            var processedV4 = save.rewardHistory.processedV4Sessions || (save.rewardHistory.processedV4Sessions = []);
            if (processedV4.indexOf(result.sessionId) >= 0) {
                console.warn('[Session Duplicate Local V4] already processed:', result.sessionId);
                delete v2.finalizingSessionIdsV4[result.sessionId];
                return;
            }
            processedV4.push(result.sessionId);
            save.rewardHistory.processedV4Sessions = processedV4.slice(-100);

            var cleanResult = {
                sessionId: result.sessionId,
                mode: mode,
                correctCount: correctCount,
                wrongCount: wrongCount,
                totalQuestions: answeredCount,
                answeredCount: answeredCount,
                accuracy: answeredCount ? Math.round(correctCount / answeredCount * 100) : 0,
                score: earnedPoints,
                playedAt: completedAt,
                completedAt: completedAt,
                stageId: stageId,
                bestCombo: Number(result.bestCombo) || 0
            };
            v2.storageService.recordGame(cleanResult);

            // ?ºÏùº ÎØ∏ÏÖò ÏßÑÌñâ??Í≥ÑÏÇ∞ Î∞?Í∞±Ïã† (?îÍµ¨?¨Ìï≠ 6)
            if (window.recordDailyMissionProgress && currentUser) {
                var isSuccess = false;
                if (mode === 'adventure') {
                    isSuccess = Boolean(result.cleared || result.success);
                }
                try {
                    await window.recordDailyMissionProgress({
                        uid: currentUser,
                        sessionId: result.sessionId,
                        mode: mode,
                        correctCount: correctCount,
                        answeredCount: answeredCount,
                        accuracy: answeredCount ? Math.round(correctCount / answeredCount * 100) : 0,
                        completedAt: completedAt,
                        success: isSuccess,
                        isBoss: Boolean(result.isBoss || (result.bossHp !== undefined && result.bossHp <= 0)),
                        bestCombo: Number(result.bestCombo) || 0
                    });
                } catch (missionError) {
                    console.error("[Daily Mission Progress Record Error]", {
                        code: missionError?.code || 'unknown',
                        message: missionError?.message || String(missionError)
                    });
                }
            }

            // 2. FirebaseÍ∞Ä ?®Îùº?∏Ïù¥Í≥?Î°úÍ∑∏???ÅÌÉú?????µÌï© ?ÖÎç∞?¥Ìä∏
            if (!isGuestMode && currentUser) {
                var userRef = db.collection('users').doc(currentUser);
                var sessionRef = db.collection('processedGameSessions_v4').doc(currentUser + '_' + result.sessionId);

                var gainedLevels = 0;
                var premiumTicketsToGrant = 0;
                var newLevel = 1;

                await db.runTransaction(async function(transaction) {
                    var sessionDoc = await transaction.get(sessionRef);
                    if (sessionDoc.exists) {
                        throw new Error('session_already_processed');
                    }

                    var userSnap = await transaction.get(userRef);
                    var uData = userSnap.exists ? userSnap.data() : {};

                    // stats V4 Ï¥àÍ∏∞??Î≥¥Ïû•
                    uData.scoringVersion = 4;
                    uData.totalPoints = Number(uData.totalPoints) || 0;
                    uData.monthlyScore = Number(uData.monthlyScore) || 0;
                    uData.level = Number(uData.level) || 1;
                    uData.lastRewardedLevel = Number(uData.lastRewardedLevel) || 1;

                    uData.modePoints = uData.modePoints || { classic: 0, timeAttack: 0, adventure: 0 };
                    ['classic', 'timeAttack', 'adventure'].forEach(function(m) {
                        uData.modePoints[m] = Number(uData.modePoints[m]) || 0;
                    });

                    // ?¨Ïù∏???ÑÏ†Å
                    uData.totalPoints += earnedPoints;
                    uData.monthlyScore += earnedPoints;
                    uData.modePoints[mode] += earnedPoints;

                    // ?àÎ≤® ?¨Í≥Ñ??
                    newLevel = calculateLevelFromPoints(uData.totalPoints);

                    // ?àÎ≤®??Î≥¥ÏÉÅ (V4 Î£?
                    gainedLevels = Math.max(0, newLevel - uData.lastRewardedLevel);
                    if (gainedLevels > 0) {
                        premiumTicketsToGrant = gainedLevels;
                        uData.premiumTickets = (Number(uData.premiumTickets) || 0) + premiumTicketsToGrant;
                        uData.lastRewardedLevel = newLevel;
                    }
                    uData.level = newLevel;

                    if (mode === 'timeAttack') {
                        var currentBestObj = uData.timeAttackBestObjV4 || null;
                        var candidate = {
                            bestCorrectCount: correctCount,
                            accuracy: answeredCount ? (correctCount / answeredCount) : 0,
                            wrongCount: wrongCount,
                            achievedAt: completedAt,
                            bestCombo: Number(result.bestCombo) || 0
                        };
                        var isNewBest = !currentBestObj || v2.rankingService.isBetterTimeAttackResult(candidate, currentBestObj);
                        if (isNewBest) {
                            uData.timeAttackBestObjV4 = candidate;
                        }
                    }

                    uData.totalScore = uData.totalPoints;
                    uData.playCount = (Number(uData.playCount) || 0) + 1;

                    var localData = v2.storageService.loadSaveData();
                    uData.adventureProgress = localData.adventureProgress;
                    uData.collection = localData.collection;
                    uData.currency = localData.currency;
                    uData.dailyMissions = localData.dailyMissions;
                    uData.rewardHistory = localData.rewardHistory;
                    uData.profile = localData.profile;

                    transaction.set(userRef, uData, { merge: true });
                    transaction.set(sessionRef, { processedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    currentUserData = uData;
                });

                // V4 ??Çπ ?úÏ∂ú (?¨Ïö©??Í≥†Ïú† UID Í∏∞Ï? ?ôÍ∏∞??
                const uid = (auth && auth.currentUser) ? auth.currentUser.uid : currentUser;
                const targetNickname = (currentUserData.profile && currentUserData.profile.nickname) || currentUser;
                await v2.rankingService.submitOverall({
                    playerId: uid,
                    nickname: targetNickname,
                    points: currentUserData.totalPoints,
                    monthlyPoints: currentUserData.monthlyScore,
                    score: earnedPoints,
                    playedAt: completedAt
                });

                if (mode === 'timeAttack' && currentUserData.timeAttackBestObjV4) {
                    var bestObj = currentUserData.timeAttackBestObjV4;
                    await v2.rankingService.submitScore({
                        playerId: uid,
                        nickname: targetNickname,
                        correctCount: bestObj.bestCorrectCount,
                        wrongCount: bestObj.wrongCount,
                        accuracy: bestObj.accuracy,
                        bestCombo: bestObj.bestCombo,
                        completedAt: bestObj.achievedAt,
                        sessionId: result.sessionId
                    });
                }

                // ?àÎ≤®???ùÏóÖ ?∏Ï∂ú
                if (gainedLevels > 0) {
                    setTimeout(function() {
                        showLevelUpAlertV4(newLevel, premiumTicketsToGrant);
                    }, 100);
                }
            }

            // 12. Ï≤??îÎ©¥ Ï¶âÏãú Í∞±Ïã†
            await reloadCurrentUserStats();
            refreshHomeStatsFromCurrentUser();
            if (typeof refreshLeaderboardSummaryIfVisible === 'function') {
                refreshLeaderboardSummaryIfVisible();
            }

            if (mode === 'timeAttack') {
                const finalUid = (auth && auth.currentUser) ? auth.currentUser.uid : currentUser;
                console.debug("[Time Attack Finalized]", {
                    sessionId: result.sessionId,
                    uid: finalUid,
                    correctCount: correctCount,
                    sessionPoints: earnedPoints,
                    totalPointsAfter: currentUserData.totalPoints,
                    monthlyBestAfter: (currentUserData.timeAttackBestObjV4 ? currentUserData.timeAttackBestObjV4.bestCorrectCount : 0),
                    allTimeBestAfter: (currentUserData.timeAttackBestObjV4 ? currentUserData.timeAttackBestObjV4.bestCorrectCount : 0)
                });
            }

        } catch (error) {
            if (error.message === 'session_already_processed') {
                console.warn('[Session already processed by server V4]', result.sessionId);
            } else {
                console.error('[finalizeGameResultV4 failed]', error);
            }
        } finally {
            delete v2.finalizingSessionIdsV4[result.sessionId];
        }
    }
    v2.finalizeGameResultV4 = finalizeGameResultV4;

    // ?òÏúÑ ?∏Ìôò?±Ïö© ?òÌçº
    async function finalizeCompletedGameSession(result) {
        return finalizeGameResultV4(result);
    }
    v2.finalizeCompletedGameSession = finalizeCompletedGameSession;

    async function saveCompletedGameResult(result) {
        return finalizeGameResultV4(result);
    }
    v2.saveCompletedGameResult = saveCompletedGameResult;

    async function reloadCurrentUserStats() {
        if (isGuestMode || !currentUser) return;
        try {
            const uid = (auth && auth.currentUser) ? auth.currentUser.uid : currentUser;
            var doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                currentUserData = doc.data();
            }
        } catch (e) {
            console.warn('[reloadCurrentUserStats failed]', e);
        }
    }
    v2.reloadCurrentUserStats = reloadCurrentUserStats;

    async function syncLocalSaveToFirestore() {
        if (isGuestMode || !currentUser) return;
        try {
            const uid = (auth && auth.currentUser) ? auth.currentUser.uid : currentUser;
            const localData = v2.storageService.loadSaveData();
            const userRef = db.collection('users').doc(uid);
            
            console.debug("[User Context]", {
                uid: uid,
                isGuest: false,
                profileLoaded: Boolean(currentUserData)
            });

            await userRef.set({
                adventureProgress: localData.adventureProgress,
                collection: localData.collection,
                currency: localData.currency,
                dailyMissions: localData.dailyMissions,
                rewardHistory: localData.rewardHistory,
                profile: localData.profile,
                totalPoints: localData.totalPoints || 0,
                level: localData.level || 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            currentUserData = localData;
            currentProfile = {
                ...localData,
                uid: uid
            };
            window.currentProfile = currentProfile;
        } catch (e) {
            console.error("[syncLocalSaveToFirestore] Sync failed", e);
        }
    }
    v2.syncLocalSaveToFirestore = syncLocalSaveToFirestore;
    window.syncLocalSaveToFirestore = syncLocalSaveToFirestore;

    async function recordDailyMissionProgress(input) {
        if (v2.dailyMissionService) {
            return await v2.dailyMissionService.recordDailyMissionProgress(input);
        }
        return false;
    }
    window.recordDailyMissionProgress = recordDailyMissionProgress;

    function refreshHomeStatsFromCurrentUser() {
        try {
            if (!currentUser) return;
            if (!isGuestMode && currentUserData) {
                var totalPoints = Number(currentUserData.totalPoints) || 0;
                var level = Number(currentUserData.level) || 1;
                
                var currentLevelStart = requiredTotalPointsForLevel(level);
                var nextLevelStart = requiredTotalPointsForLevel(level + 1);
                var progressHtml = '';
                
                if (nextLevelStart > currentLevelStart) {
                    var percent = Math.min(100, Math.max(0, ((totalPoints - currentLevelStart) / (nextLevelStart - currentLevelStart)) * 100));
                    progressHtml = 
                        '<div class="level-progress-container" style="margin-top: 8px; background: #e0e0e0; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;">' +
                            '<div class="level-progress-bar" style="background: #FF69B4; width: ' + percent + '%; height: 100%; transition: width 0.3s ease;"></div>' +
                        '</div>' +
                        '<div style="font-size: 0.75em; color: #666; margin-top: 4px; text-align: right;">' +
                            totalPoints.toLocaleString() + ' / ' + nextLevelStart.toLocaleString() + 'P' +
                        '</div>';
                }

                var box = document.getElementById('lobby-stats-box');
                if (box) {
                    box.innerHTML = 
                        '<div style="text-align: left; padding: 5px;">' +
                            '<p style="margin: 3px 0; font-size: 1.1em; font-weight: bold; color: #4b3565;">?èÜ ???àÎ≤®: <span class="highlight" id="lobby-level">Lv.' + level + '</span></p>' +
                            '<p style="margin: 3px 0; font-size: 1.1em; font-weight: bold; color: #4b3565;">?í∞ ?ÑÏ≤¥ ?¨Ïù∏?? <span class="highlight" id="lobby-points">' + totalPoints.toLocaleString() + 'P</span></p>' +
                            progressHtml +
                        '</div>';
                }
            }
        } catch (error) {
            console.warn('[refreshHomeStats failed]', error);
        }
    }
    v2.refreshHomeStatsFromCurrentUser = refreshHomeStatsFromCurrentUser;

    function playMissionClaimEffect(options) {
        try {
            var anchor = options.anchorElement;
            var rewards = options.rewards || {};
            if (!anchor) return;
            
            var pop = document.createElement('div');
            pop.style.position = 'fixed';
            var rect = anchor.getBoundingClientRect();
            pop.style.left = (rect.left + rect.width / 2) + 'px';
            pop.style.top = (rect.top - 20) + 'px';
            pop.style.transform = 'translate(-50%, -50%)';
            pop.style.backgroundColor = '#ffd166';
            pop.style.color = '#4b3565';
            pop.style.padding = '8px 16px';
            pop.style.borderRadius = '12px';
            pop.style.fontWeight = 'bold';
            pop.style.fontSize = '14px';
            pop.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)';
            pop.style.zIndex = '100000';
            pop.style.pointerEvents = 'none';
            pop.style.transition = 'all 0.8s ease-out';
            pop.style.opacity = '1';
            
            var text = "?éÅ Î≥¥ÏÉÅ ?çÎìù! ";
            if (rewards.coins) text += "ÏΩîÏù∏ +" + rewards.coins + " ";
            if (rewards.normalTickets) text += "?ºÎ∞ò ÎΩëÍ∏∞Í∂?+" + rewards.normalTickets + " ";
            if (rewards.premiumTickets) text += "Í≥†Í∏â ÎΩëÍ∏∞Í∂?+" + rewards.premiumTickets + " ";
            pop.innerText = text;
            document.body.appendChild(pop);
            
            for (var i = 0; i < 15; i++) {
                var p = document.createElement('div');
                p.style.position = 'fixed';
                p.style.left = (rect.left + rect.width / 2) + 'px';
                p.style.top = (rect.top + rect.height / 2) + 'px';
                p.style.width = '8px';
                p.style.height = '8px';
                p.style.borderRadius = '50%';
                p.style.backgroundColor = ['#ffd166', '#ff4081', '#00e5ff', '#ffeb3b'][Math.floor(Math.random() * 4)];
                p.style.zIndex = '100001';
                p.style.pointerEvents = 'none';
                p.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                document.body.appendChild(p);
                
                var angle = Math.random() * Math.PI * 2;
                var dist = 30 + Math.random() * 60;
                var dx = Math.cos(angle) * dist;
                var dy = Math.sin(angle) * dist - 20;
                
                (function(el, x, y) {
                    setTimeout(function() {
                        el.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(0)';
                        el.style.opacity = '0';
                    }, 10);
                    setTimeout(function() {
                        if (el.parentNode) el.parentNode.removeChild(el);
                    }, 700);
                })(p, dx, dy);
            }
            
            setTimeout(function() {
                pop.style.top = (rect.top - 60) + 'px';
                pop.style.opacity = '0';
            }, 50);
            
            setTimeout(function() {
                if (pop.parentNode) pop.parentNode.removeChild(pop);
            }, 800);
        } catch (error) {
            console.warn('[playMissionClaimEffect failed]', error);
        }
    }

    v2.saveCompletedGameResult = saveCompletedGameResult;
    v2.refreshHomeStatsFromCurrentUser = refreshHomeStatsFromCurrentUser;
    v2.refreshLeaderboardSummaryIfVisible = (typeof refreshLeaderboardSummaryIfVisible === 'function') ? refreshLeaderboardSummaryIfVisible : undefined;
    v2.finalizeCompletedGameSession = finalizeCompletedGameSession;
    globalThis.playMissionClaimEffect = playMissionClaimEffect;

    async function endMarathonGame() {
        if (v2.gameState) v2.gameState.finishGame();
        document.body.classList.remove('boss-mode'); // Í≤åÏûÑ Ï¢ÖÎ£å ??Î≥¥Ïä§ ?åÎßà ?¥Ï†ú
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
        
        toggleLoading(false); 

        const rewardBox = document.getElementById('reward-box');
        if (coinReward.ok) {
            const p = coinReward.parts;
            rewardBox.innerHTML = '<h3>?çÎìù Î≥¥ÏÉÅ</h3><ul><li>Í∏∞Î≥∏ ?ÑÎ£å Î≥¥ÏÉÅ +'+p.completion+'ÏΩîÏù∏</li><li>?ïÎãµ Î≥¥ÏÉÅ +'+p.correct+'ÏΩîÏù∏</li>'+(p.perfect?'<li>?ÑÎ≤Ω???ïÌôï??+'+p.perfect+'ÏΩîÏù∏</li>':'')+(p.personalBest?'<li>Í∞úÏù∏ ÏµúÍ≥† Í∏∞Î°ù +'+p.personalBest+'ÏΩîÏù∏</li>':'')+'</ul><strong>Ï¥??çÎìù ÏΩîÏù∏ +'+p.total+'ÏΩîÏù∏</strong>';
            rewardBox.style.display = 'block';
        }

        if (v2.finalizeCompletedGameSession) {
            v2.finalizeCompletedGameSession(classicMissionResult).catch(function(e) {
                console.error('[Classic end completed game session failed]', e);
            });
        }
        showScreen('result-screen');
    }

    async function updateGlobalRanking() {
        try {
            const snapshot = await db.collection('users')
                                     .orderBy('totalPoints', 'desc')
                                     .limit(10)
                                     .get();
            
            listDiv.innerHTML = '';
            if(snapshot.empty) {
                listDiv.innerHTML = '<p style="text-align:center;">?ÑÏßÅ ??Çπ???ÜÏäµ?àÎã§.</p>';
                return;
            }

            let index = 0;
            snapshot.forEach(doc => {
                let u = doc.id; let data = doc.data();
                const div = document.createElement('div'); div.className = 'ranking-item';
                const rankIcon = index === 0 ? '?ëë' : `${index + 1}??;
                
                const highlightMe = (u === currentUser) ? 'color: #FF69B4; font-weight: bold;' : '';
                
                div.innerHTML = `<span style="${highlightMe}"><b>${rankIcon} ${u}</b> (Lv.${data.level})</span> <span style="${highlightMe}">${data.totalPoints}P</span>`;
                listDiv.appendChild(div);
                index++;
            });
            document.getElementById('ranking-box').style.display = 'block';
        } catch(e) {
            console.error(e);
            const code = e && e.code ? e.code : '';
            const guide = code.includes('permission') ? 'Firebase?êÏÑú users ?ΩÍ∏∞ Í∂åÌïú???ïÏù∏??Ï£ºÏÑ∏??' : '?∏ÌÑ∞???∞Í≤∞Í≥?Firebase ?§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??';
            listDiv.innerHTML = `<p style="text-align:center; color:#B00020;">?úÏúÑÎ•?Î∂àÎü¨?§Ï? Î™ªÌñà?¥Ïöî.<br><small>${guide}</small></p>`;
        }
    }

    async function grantResource(userId, type) {
        const input = document.getElementById(`resource-${type}-${userId}`);
        const count = Math.max(1, Math.min(10000, Math.floor(Number(input && input.value) || 1)));
        const field = 'pendingResources.' + type;
        try {
            toggleLoading(true);
            await db.collection('users').doc(userId).update({ [field]: firebase.firestore.FieldValue.increment(count) });
            alert(`${userId}?òÏóêÍ≤??¨Ìôî ${count}Í∞úÎ? ÏßÄÍ∏âÌñà?µÎãà?? ?§Ïùå Î°úÍ∑∏?????êÎèô ?òÎ†π?©Îãà??`);
            await showAdminScreen();
        } catch (error) { console.error('[Admin ticket grant error]', error); alert('?∞Ïºì ÏßÄÍ∏âÏóê ?§Ìå®?àÏäµ?àÎã§.'); toggleLoading(false); }
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
        if (!v2.storageService.saveSaveData(save)) throw new Error('Î°úÏª¨ ?∞Ïºì ?Ä???§Ìå®');
        await userRef.update({ pendingResources: { coins: 0, normal: 0, premium: 0, season: 0 }, pendingTickets: { normal: 0, premium: 0 }, ticketsReceivedAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert(`Í¥ÄÎ¶¨Ïûê ?†Î¨º ?ÑÏ∞©! ÏΩîÏù∏ ${coins} ¬∑ Í∏∞Î≥∏ ${normal} ¬∑ Í≥†Í∏â ${premium}??Î∞õÏïò?µÎãà??`);
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
    window.getCurrentPlayerContext = function () { return { nickname: (currentUserData && currentUserData.profile && currentUserData.profile.nickname) ? currentUserData.profile.nickname : (isGuestMode ? 'Í≤åÏä§?? : (currentUser || '')), isGuest: isGuestMode, userData: currentUserData }; };

    window.loginWithGoogle = loginWithGoogle;
    window.setupNewProfile = setupNewProfile;
    window.playAsGuest = playAsGuest;
    window.logout = logout;
    window.showLobby = showLobby;
    window.grantResource = grantResource;
    window.resetUser = resetUser;
    window.deleteUser = deleteUser;
    window.showAdminScreen = showAdminScreen;

    if (v2.initBackButtonHandler) v2.initBackButtonHandler();
    if (v2.initPwaManager) v2.initPwaManager();

    function initVersionDisplay() {
        const info = window.NYANKO_APP_INFO;
        if (!info) return;
        
        const vLabel = document.getElementById('version-label');
        if (vLabel) {
            vLabel.textContent = "Ver. " + info.version;
        }
        
        const vText = document.getElementById('version-text');
        if (vText) {
            vText.textContent = `Î≤ÑÏ†Ñ ${info.version} ¬∑ ?ÖÎç∞?¥Ìä∏ ${info.buildDate.replace(/-/g, '.')} ${info.buildTime}`;
        }
        
        const LAST_SEEN_VERSION_KEY = "nyanko:last-seen-version";
        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        const badge = document.getElementById('version-new-badge');
        
        if (badge) {
            if (!lastSeen || lastSeen !== info.version) {
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
        
        localStorage.setItem(LAST_SEEN_VERSION_KEY, info.version);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVersionDisplay);
    } else {
        initVersionDisplay();
    }

