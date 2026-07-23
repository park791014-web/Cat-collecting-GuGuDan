// 🔥 파이어베이스 접속 키 🔥
    const firebaseConfig = {
      apiKey: "AIzaSyAiU-wOOXF-ZGsdPtsS1hUpxEZQit8IZbI",
      authDomain: "gugu-cat-adventrue.firebaseapp.com",
      projectId: "gugu-cat-adventrue",
      storageBucket: "gugu-cat-adventrue.firebasestorage.app",
      messagingSenderId: "380583801039",
      appId: "1:380583801039:web:cfeda57a40a01985ccc7ba"
    };

    const v2 = window.GugudanV2 || {};
    const gameConfig = v2.gameConfig || {};
    let db = null;
    try {
        if (window.firebase) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
        } else {
            console.warn('[Firebase] SDK를 불러오지 못했습니다. 게스트 게임은 계속 이용할 수 있습니다.');
        }
    } catch (error) {
        console.warn('[Firebase] 초기화에 실패했습니다. 게스트 게임은 계속 이용할 수 있습니다.', error);
    }
    if (v2.rankingService) v2.rankingService.setDatabase(db, window.firebase);

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
            // 🔥 보스 등장 사이렌 사운드 🔥
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

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById(screenId).classList.add('active-screen');
        document.body.classList.toggle('is-admin-mode', screenId === 'admin-screen');
    }
    function toggleLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
    function clearClassicRuntime() { clearInterval(timerInterval); clearInterval(countdownInterval); timerInterval = null; countdownInterval = null; }
    window.clearClassicRuntime = clearClassicRuntime;

    async function handleAuth(type) {
        initAudio();
        const username = document.getElementById('username-input').value.trim();
        const password = document.getElementById('password-input').value.trim();
        if(!username || !password) return alert("이름과 비밀번호를 입력해 주세요!");

        if (username === 'admin' && password === 'admin1234') { currentUser = 'admin'; window.__nyankoAdminSession = true; showAdminScreen(); return; }

        toggleLoading(true);
        try {
            const userRef = db.collection('users').doc(username);
            const doc = await userRef.get();

            if (type === 'signup') {
                if (username === 'admin') { alert("사용할 수 없는 이름입니다."); toggleLoading(false); return; }
                if (doc.exists) { alert("이미 등록된 이름입니다."); toggleLoading(false); return; }
                
                const migrationId = v2.releaseResetMigrationService.RESET_MIGRATION_ID;
                const newData = { password: password, totalPoints: 0, level: 1, playCount: 0, rewards: [], migrations: {} };
                newData.migrations[migrationId] = { completed: true, previousRank: 0, premiumTicketsGranted: 0, completedAt: firebase.firestore.FieldValue.serverTimestamp(), migrationNoticeSeen: true };
                await userRef.set(newData);
                alert("가입 완료냥! 로그인을 진행해달라냥.");
            } else {
                if (!doc.exists || doc.data().password !== password) { alert("정보가 맞지 않다냥."); toggleLoading(false); return; }
                currentUser = username;
                currentUserData = doc.data(); 
                isGuestMode = false;
                v2.storageService.handleAuthenticatedUserChanged({ type:'authenticated', userId:username, nickname:username });
                let resetMigration = null;
                try {
                    resetMigration = await v2.releaseResetMigrationService.run({ db: db, firebase: firebase, userRef: userRef, userId: username, userData: currentUserData });
                    if (resetMigration && resetMigration.userData) currentUserData = resetMigration.userData;
                } catch (migrationError) {
                    console.error('[Release reset migration error]', migrationError);
                }
                await receivePendingTickets(userRef, currentUserData);
                await syncCurrentCurrencyToFirebase(userRef);
                showLobby();
                if (resetMigration && resetMigration.ok) {
                    v2.releaseResetMigrationService.showNoticeIfNeeded({ userRef: userRef, userData: currentUserData, migration: resetMigration.migration });
                }
            }
        } catch (error) {
            alert("서버 연결에 실패했다냥! 설정 코드를 확인해라냥!");
            console.error(error);
        }
        toggleLoading(false);
    }

    async function showAdminScreen() {
        toggleLoading(true);
        const listDiv = document.getElementById('admin-list');
        listDiv.innerHTML = '';
        try {
            const snapshot = await db.collection('users').get();
            if(snapshot.empty) { listDiv.innerHTML = '<p style="text-align:center;">등록된 학생이 없습니다.</p>'; } 
            else {
                snapshot.forEach(doc => {
                    let u = doc.id; let data = doc.data();
                    const div = document.createElement('div'); div.className = 'ranking-item';
                    const pending = data.pendingResources || data.pendingTickets || {};
                    const resources = [{key:'coins',label:'코인',internal:'currency.coins'},{key:'normal',label:'기본 뽑기권',internal:'currency.normalTickets'},{key:'premium',label:'고급 뽑기권',internal:'currency.premiumTickets'},{key:'season',label:'시즌 뽑기권',internal:'currency.seasonTickets.season_01'}];
                    div.innerHTML = `<div class="admin-user-heading"><b>${u}</b><span>Lv.${data.level || 1} · ${data.totalPoints || 0}P</span></div><div class="admin-resource-header"><b>재화</b><b>내부 ID</b><b>수량</b><b>지급</b></div><div class="admin-resource-grid">${resources.map(resource=>`<div class="admin-resource-row"><span class="admin-resource-label">${resource.label}</span><code class="admin-resource-id">${resource.internal}</code><input class="admin-resource-amount" id="resource-${resource.key}-${u}" type="number" min="1" max="10000" value="1" aria-label="${u} ${resource.label} 수량"><button class="btn btn-small" onclick="grantResource('${u}','${resource.key}')">지급</button></div>`).join('')}</div><small>대기: 코인 ${pending.coins || 0} · 기본 ${pending.normal || 0} · 고급 ${pending.premium || 0} · 시즌 ${pending.season || 0}</small><div class="admin-user-actions"><button class="btn btn-small" onclick="resetUser('${u}')">초기화</button><button class="btn btn-danger btn-small" onclick="deleteUser('${u}')">삭제</button></div>`;
                    listDiv.appendChild(div);
                });
            }
        } catch(e) { alert("데이터를 불러오지 못했다냥!"); }
        toggleLoading(false);
        showScreen('admin-screen');
    }
    
    async function resetUser(u) {
        if(confirm(`${u}의 점수를 초기화 하시겠습니까?`)) {
            toggleLoading(true); await db.collection('users').doc(u).update({ totalPoints: 0, level: 1, playCount: 0, rewards: [] }); showAdminScreen(); 
        }
    }
    async function deleteUser(u) {
        if(confirm(`${u}의 계정을 완전히 삭제하시겠습니까?`)) {
            toggleLoading(true); await db.collection('users').doc(u).delete(); showAdminScreen(); 
        }
    }

    function playAsGuest() { initAudio(); currentUser = "GUEST"; isGuestMode = true; v2.storageService.setUserContext({ type:'guest' }); showLobby(); }
    function logout() { window.__nyankoAdminSession = false; if (v2.storageService) { var currentSave=v2.storageService.loadSaveData(); v2.storageService.saveSaveData(currentSave); v2.storageService.clearInMemoryUserState(); } currentUser = null; currentUserData = null; isGuestMode = false; document.getElementById('lobby-selected-cat').innerHTML=''; document.getElementById('collection-grid').innerHTML=''; document.getElementById('username-input').value = ""; document.getElementById('password-input').value = ""; showScreen('login-screen'); }

    function showLobby() {
        clearClassicRuntime();
        if (window.clearPhase2Runtime) window.clearPhase2Runtime();
        document.getElementById('lobby-name').innerText = currentUser;
        // 기존 Firebase 보상 목록은 새 도감 DOM에 섞지 않는다.
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
                    { id: 'UR', title: '🌟 전설 (Legend)' },
                    { id: 'SR', title: '⭐⭐⭐ 영웅 (Super Rare)' },
                    { id: 'R',  title: '⭐⭐ 희귀 (Rare)' },
                    { id: 'N',  title: '⭐ 일반 (Normal)' }
                ];

                rankInfo.forEach(r => {
                    const catsInThisRank = currentUserData.rewards.filter(cat => cat.rank === r.id);
                    if (catsInThisRank.length > 0) {
                        const titleDiv = document.createElement('div');
                        titleDiv.style.width = '100%'; titleDiv.style.textAlign = 'left'; titleDiv.style.fontSize = '14px'; titleDiv.style.fontWeight = 'bold'; titleDiv.style.color = '#333'; titleDiv.style.margin = '15px 0 5px 0'; titleDiv.style.borderBottom = '2px dashed #DDD';
                        titleDiv.innerText = `${r.title} (${catsInThisRank.length}마리)`;
                        grid.appendChild(titleDiv);

                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'collection-grid'; groupDiv.style.marginTop = '0'; groupDiv.style.justifyContent = 'flex-start';

                        catsInThisRank.forEach(cat => {
                            const item = document.createElement('div'); item.className = 'collection-item';
                            item.style.backgroundColor = cat.bg; item.style.borderColor = cat.border;
                            
                            const badge = document.createElement('div'); badge.className = 'rarity-badge'; badge.innerText = cat.rank; badge.style.backgroundColor = cat.border;
                            item.appendChild(badge);
                            
                            const img = document.createElement('img'); img.src = `https://robohash.org/${cat.id}.png?set=set4&size=100x100`; img.alt = `${r.title} 고양이`;
                            if (v2.assetLoader) v2.assetLoader.applyImageFallback(img, '');
                            item.appendChild(img);
                            groupDiv.appendChild(item);
                        });
                        grid.appendChild(groupDiv);
                    }
                });
            } else { grid.innerHTML = '<p style="color:#999; margin:10px; font-size:14px;">아직 모은 고양이가 없다냥. 레벨업을 해보라냥!</p>'; }
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

    async function saveCompletedGameResult(result) {
        if (!result || !result.sessionId) return;
        try {
            var save = v2.storageService.loadSaveData();
            var history = save.rewardHistory.processedOverallSessionIds || (save.rewardHistory.processedOverallSessionIds = []);
            if (history.indexOf(result.sessionId) >= 0) {
                console.warn('[Session Duplicate] already processed:', result.sessionId);
                return;
            }
            history.push(result.sessionId);
            save.rewardHistory.processedOverallSessionIds = history.slice(-100);
            
            // 로컬 기록 데이터 누적
            v2.storageService.recordGame(result);
            
            // 게스트 모드가 아닐 때 Firebase 누적
            if (!isGuestMode && currentUser && currentUserData) {
                var todayTotal = Number(result.score || result.overallPoints || (result.correctCount * 10) || 0);
                if (result.mode === 'classic') {
                    todayTotal += (currentUserData.playCount * 2);
                }
                
                currentUserData.playCount = (Number(currentUserData.playCount) || 0) + 1;
                currentUserData.totalPoints = (Number(currentUserData.totalPoints) || 0) + todayTotal;
                currentUserData.level = Math.floor(currentUserData.totalPoints / 150) + 1;
                
                try {
                    await db.collection('users').doc(currentUser).set(currentUserData);
                    
                    // Firebase Overall 랭킹 제출
                    await v2.rankingService.submitOverall({
                        playerId: save.profile.playerId,
                        nickname: currentUser,
                        score: todayTotal,
                        correctCount: result.correctCount,
                        totalQuestions: result.totalQuestions || result.answeredCount || result.correctCount,
                        accuracy: result.accuracy,
                        sessionId: result.sessionId,
                        playedAt: new Date().toISOString()
                    });
                } catch(firebaseError) {
                    console.warn('[Firebase overall stats save failed]', firebaseError);
                }
            }
        } catch (error) {
            console.warn('[saveCompletedGameResult failed]', error);
        }
    }

    function refreshHomeStatsFromCurrentUser() {
        try {
            if (!currentUser) return;
            if (!isGuestMode && currentUserData) {
                var levelElem = document.getElementById('lobby-level');
                var pointsElem = document.getElementById('lobby-points');
                if (levelElem) levelElem.innerText = currentUserData.level || 1;
                if (pointsElem) pointsElem.innerText = currentUserData.totalPoints || 0;
            }
        } catch (error) {
            console.warn('[refreshHomeStats failed]', error);
        }
    }

    function refreshLeaderboardSummaryIfVisible() {
        try {
            var rankingBox = document.getElementById('ranking-box');
            var isVisible = rankingBox && rankingBox.style.display !== 'none';
            if (isVisible) {
                updateGlobalRanking();
            }
        } catch (error) {
            console.warn('[refreshLeaderboard failed]', error);
        }
    }

    async function finalizeCompletedGameSession(result) {
        if (!result || !result.sessionId) return;
        try {
            const correctCount = Number(result.correctCount) || 0;
            const wrongCount = Number(result.wrongCount) || 0;
            const total = Number(result.totalQuestions || result.answeredCount || (correctCount + wrongCount)) || 0;
            const accuracy = total ? Math.round(correctCount / total * 100) : 0;
            const overallPoints = Number(result.score || result.overallPoints || (correctCount * 10)) || 0;
            
            const cleanResult = {
                sessionId: result.sessionId,
                mode: result.mode,
                correctCount: correctCount,
                wrongCount: wrongCount,
                totalQuestions: total,
                answeredCount: total,
                accuracy: accuracy,
                overallPoints: overallPoints,
                score: overallPoints,
                playedAt: result.playedAt || new Date().toISOString(),
                completedAt: result.completedAt || new Date().toISOString(),
                stageId: result.stageId || null,
                finishReason: result.finishReason || 'completed'
            };

            await saveCompletedGameResult(cleanResult);
            refreshHomeStatsFromCurrentUser();
            refreshLeaderboardSummaryIfVisible();
        } catch (error) {
            console.warn('[finalizeCompletedGameSession failed]', error);
        }
    }

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
            
            var text = "🎁 보상 획득! ";
            if (rewards.coins) text += "코인 +" + rewards.coins + " ";
            if (rewards.normalTickets) text += "일반 뽑기권 +" + rewards.normalTickets + " ";
            if (rewards.premiumTickets) text += "고급 뽑기권 +" + rewards.premiumTickets + " ";
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
    v2.refreshLeaderboardSummaryIfVisible = refreshLeaderboardSummaryIfVisible;
    v2.finalizeCompletedGameSession = finalizeCompletedGameSession;
    global.playMissionClaimEffect = playMissionClaimEffect;

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
        listDiv.innerHTML = '<p style="text-align:center;">랭킹 불러오는 중...</p>';
        
        try {
            const snapshot = await db.collection('users')
                                     .orderBy('totalPoints', 'desc')
                                     .limit(10)
                                     .get();
            
            listDiv.innerHTML = '';
            if(snapshot.empty) {
                listDiv.innerHTML = '<p style="text-align:center;">아직 랭킹이 없습니다.</p>';
                return;
            }

            let index = 0;
            snapshot.forEach(doc => {
                let u = doc.id; let data = doc.data();
                const div = document.createElement('div'); div.className = 'ranking-item';
                const rankIcon = index === 0 ? '👑' : `${index + 1}위`;
                
                const highlightMe = (u === currentUser) ? 'color: #FF69B4; font-weight: bold;' : '';
                
                div.innerHTML = `<span style="${highlightMe}"><b>${rankIcon} ${u}</b> (Lv.${data.level})</span> <span style="${highlightMe}">${data.totalPoints}P</span>`;
                listDiv.appendChild(div);
                index++;
            });
            document.getElementById('ranking-box').style.display = 'block';
        } catch(e) {
            console.error(e);
            const code = e && e.code ? e.code : '';
            const guide = code.includes('permission') ? 'Firebase에서 users 읽기 권한을 확인해 주세요.' : '인터넷 연결과 Firebase 설정을 확인해 주세요.';
            listDiv.innerHTML = `<p style="text-align:center; color:#B00020;">순위를 불러오지 못했어요.<br><small>${guide}</small></p>`;
        }
    }

    async function grantResource(userId, type) {
        const input = document.getElementById(`resource-${type}-${userId}`);
        const count = Math.max(1, Math.min(10000, Math.floor(Number(input && input.value) || 1)));
        const field = 'pendingResources.' + type;
        try {
            toggleLoading(true);
            await db.collection('users').doc(userId).update({ [field]: firebase.firestore.FieldValue.increment(count) });
            alert(`${userId}님에게 재화 ${count}개를 지급했습니다. 다음 로그인 때 자동 수령됩니다.`);
            await showAdminScreen();
        } catch (error) { console.error('[Admin ticket grant error]', error); alert('티켓 지급에 실패했습니다.'); toggleLoading(false); }
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

    if (v2.initBackButtonHandler) v2.initBackButtonHandler();
    if (v2.initPwaManager) v2.initPwaManager();
