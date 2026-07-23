(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {}, database = null, firebaseSdk = null;
  var COLLECTION = 'rankings_v4';
  var VERSION = 'v4';

  function setDatabase(db, sdk) {
    database = db || null;
    firebaseSdk = sdk || null;
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function kstParts(referenceDate) {
    var date = referenceDate ? new Date(referenceDate) : new Date(),
        parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date),
        values = {};
    parts.forEach(function(part) { values[part.type] = part.value; });
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  }

  function getKoreaMonthKey(referenceDate) {
    var value = kstParts(referenceDate);
    return value.year + '-' + pad(value.month);
  }

  function isBetterTimeAttackResult(candidate, currentBest) {
    if (!currentBest) return true;
    var nextVal = Number(candidate.bestCorrectCount || candidate.correctCount || 0);
    var curVal = Number(currentBest.bestCorrectCount || currentBest.correctCount || 0);
    if (nextVal !== curVal) return nextVal > curVal;

    var nextAcc = Number(candidate.accuracy || 0);
    var curAcc = Number(currentBest.accuracy || 0);
    if (nextAcc !== curAcc) return nextAcc > curAcc;

    var nextWrong = Number(candidate.wrongCount || 0);
    var curWrong = Number(currentBest.wrongCount || 0);
    if (nextWrong !== curWrong) return nextWrong < curWrong;

    var nextTime = new Date(candidate.achievedAt || candidate.playedAt || new Date()).getTime() || 0;
    var curTime = new Date(currentBest.achievedAt || currentBest.playedAt || new Date()).getTime() || 0;
    return nextTime < curTime;
  }
  v2.isBetterTimeAttackResult = isBetterTimeAttackResult;

  // V4 타임어택 최고기록 제출 (월간 & 전체 문서 각각 트랜잭션 갱신)
  function submitScore(result) {
    if (!database || !firebaseSdk) return Promise.resolve({ ok: false, reason: 'firebase_unavailable' });
    
    var playedAt = result.playedAt || result.completedAt || new Date().toISOString();
    var monthKey = getKoreaMonthKey(playedAt);
    var playerId = String(result.playerId);

    var monthlyRef = database.collection(COLLECTION).doc('timeAttack_monthly_' + monthKey + '_' + playerId);
    var allTimeRef = database.collection(COLLECTION).doc('timeAttack_allTime_' + playerId);

    var baseCandidate = {
      rankingVersion: VERSION,
      category: 'timeAttack',
      userId: playerId,
      nickname: result.nickname,
      bestCorrectCount: Number(result.correctCount || result.bestCorrectCount || 0),
      accuracy: Number(result.accuracy || 0),
      wrongCount: Number(result.wrongCount || 0),
      bestCombo: Number(result.bestCombo || 0),
      achievedAt: firebaseSdk.firestore.FieldValue.serverTimestamp()
    };

    return database.runTransaction(function(tx) {
      return Promise.all([tx.get(monthlyRef), tx.get(allTimeRef)]).then(function(docs) {
        var mDoc = docs[0].exists ? docs[0].data() : null;
        var aDoc = docs[1].exists ? docs[1].data() : null;

        var updateMonthly = isBetterTimeAttackResult(baseCandidate, mDoc);
        var updateAllTime = isBetterTimeAttackResult(baseCandidate, aDoc);

        if (updateMonthly) {
          tx.set(monthlyRef, Object.assign({}, baseCandidate, {
            periodType: 'monthly',
            monthKey: monthKey
          }));
        }
        if (updateAllTime) {
          tx.set(allTimeRef, Object.assign({}, baseCandidate, {
            periodType: 'allTime'
          }));
        }
      });
    }).then(function() {
      return { ok: true, monthKey: monthKey };
    }).catch(function(error) {
      console.error('[TimeAttack V4 ranking write error]', error);
      return { ok: false, error: error };
    });
  }

  // V4 포인트 제출 (월간 & 전체 문서 트랜잭션 갱신)
  function submitOverall(input) {
    if (!database || !firebaseSdk || !input || !input.playerId) return Promise.resolve({ ok: false, reason: 'firebase_unavailable' });

    var playedAt = input.playedAt || new Date().toISOString();
    var monthKey = getKoreaMonthKey(playedAt);
    var playerId = String(input.playerId);

    var monthlyRef = database.collection(COLLECTION).doc('points_monthly_' + monthKey + '_' + playerId);
    var allTimeRef = database.collection(COLLECTION).doc('points_allTime_' + playerId);

    return database.runTransaction(function(tx) {
      return Promise.all([tx.get(monthlyRef), tx.get(allTimeRef)]).then(function(docs) {
        // 대입 갱신
        var mPoints = Number(input.monthlyPoints || input.score || 0);
        var aPoints = Number(input.points || input.totalScore || input.score || 0);

        tx.set(monthlyRef, {
          rankingVersion: VERSION,
          category: 'points',
          periodType: 'monthly',
          monthKey: monthKey,
          userId: playerId,
          nickname: input.nickname,
          points: mPoints,
          updatedAt: firebaseSdk.firestore.FieldValue.serverTimestamp()
        });

        tx.set(allTimeRef, {
          rankingVersion: VERSION,
          category: 'points',
          periodType: 'allTime',
          userId: playerId,
          nickname: input.nickname,
          points: aPoints,
          updatedAt: firebaseSdk.firestore.FieldValue.serverTimestamp()
        });
      });
    }).then(function() {
      return { ok: true, monthKey: monthKey };
    }).catch(function(error) {
      console.error('[Points V4 ranking write error]', error);
      return { ok: false, error: error };
    });
  }

  // V4 리더보드 조회 함수
  function getLeaderboard(options) {
    options = options || {};
    var category = options.category;
    if (category === 'overall') category = 'points';
    if (category !== 'points' && category !== 'timeAttack') category = 'points';

    var period = options.period;
    if (period === 'weeklyBest' || period === 'weekly') period = 'monthly';
    if (period !== 'monthly' && period !== 'allTime') period = 'monthly';

    var query = database && database.collection(COLLECTION)
                                 .where('rankingVersion', '==', VERSION)
                                 .where('category', '==', category)
                                 .where('periodType', '==', period);

    if (!query) return Promise.resolve({ ok: false, reason: 'firebase_unavailable', records: [] });

    if (period === 'monthly') {
      var monthKey = getKoreaMonthKey(options.referenceDate);
      query = query.where('monthKey', '==', monthKey);
    }

    if (category === 'timeAttack') {
      query = query.orderBy('bestCorrectCount', 'desc')
                   .orderBy('accuracy', 'desc')
                   .orderBy('wrongCount', 'asc')
                   .orderBy('achievedAt', 'asc')
                   .limit(10);
    } else {
      query = query.orderBy('points', 'desc')
                   .orderBy('updatedAt', 'asc')
                   .limit(10);
    }

    return query.get().then(function(snapshot) {
      return {
        ok: true,
        records: snapshot.docs.map(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.score = category === 'timeAttack' ? data.bestCorrectCount : data.points;
          data.displayScore = data.score;
          data.correctCount = category === 'timeAttack' ? data.bestCorrectCount : (data.correctCount || 0);
          return data;
        })
      };
    }).catch(function(error) {
      console.error('[V4 query error]', error);
      return { ok: false, records: [], error: error };
    });
  }

  function getPlayerRecord(options) {
    options = options || {};
    if (!database || !options.playerId) return Promise.resolve(null);
    var category = options.category;
    if (category === 'overall') category = 'points';
    if (category !== 'points' && category !== 'timeAttack') category = 'points';

    var period = options.period;
    if (period === 'weeklyBest' || period === 'weekly') period = 'monthly';
    if (period !== 'monthly' && period !== 'allTime') period = 'allTime';

    var docId = '';
    if (category === 'points') {
      if (period === 'monthly') {
        docId = 'points_monthly_' + getKoreaMonthKey(options.referenceDate) + '_' + options.playerId;
      } else {
        docId = 'points_allTime_' + options.playerId;
      }
    } else {
      if (period === 'monthly') {
        docId = 'timeAttack_monthly_' + getKoreaMonthKey(options.referenceDate) + '_' + options.playerId;
      } else {
        docId = 'timeAttack_allTime_' + options.playerId;
      }
    }

    return database.collection(COLLECTION).doc(docId).get().then(function(doc) {
      if (!doc.exists) return null;
      var data = doc.data();
      data.id = doc.id;
      data.score = category === 'timeAttack' ? data.bestCorrectCount : data.points;
      data.displayScore = data.score;
      data.correctCount = category === 'timeAttack' ? data.bestCorrectCount : (data.correctCount || 0);
      return data;
    }).catch(function(error) {
      console.error('[Player V4 record query error]', error);
      return null;
    });
  }

  function alias(category, period, options) {
    options = options || {};
    return getLeaderboard(Object.assign({}, options, { category: category, period: period }));
  }

  v2.rankingService = {
    LEADERBOARD_VERSION: VERSION,
    collectionName: COLLECTION,
    allowedModes: ['points', 'timeAttack'],
    setDatabase: setDatabase,
    getKoreaMonthKey: getKoreaMonthKey,
    isBetterTimeAttackResult: isBetterTimeAttackResult,
    submitScore: submitScore,
    submitOverall: submitOverall,
    getLeaderboard: getLeaderboard,
    getPlayerRecord: getPlayerRecord,
    getMonthlyRanking: function(o) { return alias('points', 'monthly', o); },
    getAllTimeRanking: function(o) { return alias(o && o.mode === 'timeAttack' ? 'timeAttack' : 'points', 'allTime', o); },
    getWeeklyRanking: function(o) { return alias('timeAttack', 'monthly', o); }
  };
})(window);
