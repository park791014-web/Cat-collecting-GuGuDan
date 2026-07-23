(function (global) {
  'use strict';

  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var RESET_MIGRATION_ID = 'v2_release_score_reset_2026_07';

  function normalizeRank(savedRank) {
    var rank = Number(savedRank);
    return Number.isFinite(rank) ? Math.max(0, Math.floor(rank)) : 0;
  }

  function calculateReward(previousRank) {
    return Math.min(20, Math.floor(normalizeRank(previousRank) / 2));
  }

  function migrationFrom(data) {
    return data && data.migrations && data.migrations[RESET_MIGRATION_ID];
  }

  function resetLocalRankingData(remoteData, migration) {
    if (!v2.storageService) return;
    var save = v2.storageService.loadSaveData();
    var localMigration = save.migrations && save.migrations[RESET_MIGRATION_ID];
    if (localMigration && localMigration.completed) return;
    save.level = 1;
    save.experience = 0;
    save.xp = 0;
    save.monthlyScore = 0;
    save.rankingScore = 0;
    save.progress.totalScore = 0;
    save.progress.totalGames = 0;
    save.progress.totalCorrect = 0;
    save.progress.totalWrong = 0;
    save.progress.bestCombo = 0;
    save.personalBests.classic = { bestScore: 0, bestCombo: 0, achievedAt: null };
    save.personalBests.timeAttack = { bestScore: 0, bestCorrectCount: 0, bestCombo: 0, lowestWrongCount: null, achievedAt: null };
    save.gameHistory = [];
    save.rankingStats = { rankingVersion: 'v3', totalScore: 0, monthlyScore: 0, correctCount: 0, totalQuestions: 0 };
    save.migrations = save.migrations || {};
    save.migrations[RESET_MIGRATION_ID] = {
      completed: true,
      previousRank: normalizeRank(migration && migration.previousRank),
      premiumTicketsGranted: Math.max(0, Number(migration && migration.premiumTicketsGranted) || 0),
      migrationNoticeSeen: Boolean(migration && migration.migrationNoticeSeen)
    };
    var snapshot = remoteData && remoteData.currencySnapshot;
    if (snapshot) {
      save.currency.coins = Math.max(save.currency.coins || 0, Number(snapshot.coins) || 0);
      save.currency.normalTickets = Math.max(save.currency.normalTickets || 0, Number(snapshot.normalTickets) || 0);
      save.currency.premiumTickets = Math.max(save.currency.premiumTickets || 0, Number(snapshot.premiumTickets) || 0);
    }
    v2.storageService.saveSaveData(save);
  }

  async function run(options) {
    var db = options.db;
    var firebase = options.firebase;
    var userRef = options.userRef;
    if (!db || !firebase || !userRef) return { ok: false, skipped: true, userData: options.userData || null };

    var transactionResult = await db.runTransaction(async function (transaction) {
      var snapshot = await transaction.get(userRef);
      if (!snapshot.exists) throw new Error('user_not_found');
      var data = snapshot.data() || {};
      var existing = migrationFrom(data);
      if (existing && existing.completed) {
        return { alreadyCompleted: true, migration: existing };
      }

      var previousRank = normalizeRank(data.rank != null ? data.rank : data.level);
      var rewardPremiumTickets = calculateReward(previousRank);
      var pending = data.pendingResources || {};
      var migrations = Object.assign({}, data.migrations || {});
      migrations[RESET_MIGRATION_ID] = {
        completed: true,
        previousRank: previousRank,
        premiumTicketsGranted: rewardPremiumTickets,
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        migrationNoticeSeen: false
      };

      transaction.set(userRef, {
        level: 1,
        experience: 0,
        xp: 0,
        totalPoints: 0,
        totalScore: 0,
        monthlyScore: 0,
        rankingScore: 0,
        timeAttackWeeklyBest: 0,
        timeAttackAllTimeBest: 0,
        rankingPersonalBests: {},
        pendingResources: Object.assign({}, pending, {
          premium: Math.max(0, Number(pending.premium) || 0) + rewardPremiumTickets
        }),
        migrations: migrations
      }, { merge: true });
      return { alreadyCompleted: false, migration: migrations[RESET_MIGRATION_ID] };
    });

    var refreshed = await userRef.get();
    var userData = refreshed.exists ? refreshed.data() : (options.userData || {});
    var migration = migrationFrom(userData) || transactionResult.migration;
    resetLocalRankingData(userData, migration);
    return { ok: true, userData: userData, migration: migration, alreadyCompleted: transactionResult.alreadyCompleted };
  }

  function showNoticeIfNeeded(options) {
    var userRef = options.userRef;
    var migration = migrationFrom(options.userData || {}) || options.migration;
    if (!migration || !migration.completed || migration.migrationNoticeSeen) return;
    if (document.getElementById('release-reset-notice')) return;
    var reward = Math.max(0, Number(migration.premiumTicketsGranted) || 0);
    var overlay = document.createElement('div');
    overlay.id = 'release-reset-notice';
    overlay.className = 'release-reset-notice';
    overlay.innerHTML = '<div class="release-reset-notice__card" role="dialog" aria-modal="true" aria-labelledby="release-reset-title">' +
      '<h2 id="release-reset-title">새로운 버전으로 업데이트되었어요!</h2>' +
      '<p>게임 개편으로 기존 점수와 레벨이 초기화되었습니다.<br>이용에 불편을 드려 죄송하며 너른 양해 부탁드립니다.</p>' +
      '<p>' + (reward > 0 ? '이전 랭크를 기준으로 고급 뽑기권 <strong>' + reward + '장</strong>을 지급해 드렸습니다.' : '이전 랭크를 기준으로 보상 지급이 처리되었습니다.') + '<br>새롭게 시작된 랭킹에도 도전해 보세요!</p>' +
      '<button type="button" class="btn btn-success">확인</button></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', async function () {
      try {
        var field = 'migrations.' + RESET_MIGRATION_ID + '.migrationNoticeSeen';
        await userRef.update({ [field]: true });
        var save = v2.storageService && v2.storageService.loadSaveData();
        if (save && save.migrations && save.migrations[RESET_MIGRATION_ID]) {
          save.migrations[RESET_MIGRATION_ID].migrationNoticeSeen = true;
          v2.storageService.saveSaveData(save);
        }
        overlay.remove();
      } catch (error) {
        console.error('[Migration notice update error]', error);
      }
    });
  }

  v2.releaseResetMigrationService = {
    RESET_MIGRATION_ID: RESET_MIGRATION_ID,
    normalizeRank: normalizeRank,
    calculateReward: calculateReward,
    run: run,
    showNoticeIfNeeded: showNoticeIfNeeded
  };
})(window);
