(function (global) {
  'use strict';

  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var database = null;
  var firebaseSdk = null;
  var submitted = {};
  var COLLECTION = 'leaderboardsV3';
  var VERSION = 'v3';

  function setDatabase(db, sdk) {
    database = db || null;
    firebaseSdk = sdk || null;
  }

  function initializeDatabase() {
    var client = global.firebaseClient;
    if (client && client.db && global.firebase) {
      v2.rankingService.setDatabase(client.db, global.firebase);
      console.info('[LEADERBOARD SERVICE READY]', {
        databaseReady: true,
        firebaseReady: true
      });
      return true;
    }

    console.info('[LEADERBOARD SERVICE NOT READY]', {
      reason: 'firebase_unavailable'
    });
    return false;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function kstParts(referenceDate) {
    var date = referenceDate ? new Date(referenceDate) : new Date();
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) {
      values[part.type] = part.value;
    });
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day)
    };
  }

  function getKoreaMonthKey(referenceDate) {
    var value = kstParts(referenceDate);
    return value.year + '-' + pad(value.month);
  }

  function validateScoreSubmission(result) {
    var errors = [];
    if (!result || result.mode !== 'timeAttack') errors.push('지원하지 않는 랭킹 모드');
    ['score', 'correctCount', 'wrongCount', 'totalQuestions', 'accuracy', 'bestCombo'].forEach(function (key) {
      if (!Number.isFinite(Number(result && result[key])) || Number(result[key]) < 0) errors.push(key + ' 값 오류');
    });
    if (!result || !result.sessionId) errors.push('세션 ID 누락');
    if (!result || !String(result.playerId || '').trim()) errors.push('playerId 누락');
    if (!result || !String(result.nickname || '').trim()) errors.push('nickname 누락');
    if (result && submitted[result.sessionId]) errors.push('이미 제출한 세션');
    return { valid: !errors.length, errors: errors };
  }

  function isHigherScore(next, current) {
    return !current || Number(next.score) > (Number(current.score) || 0);
  }

  function submitScore(result) {
    var validation = validateScoreSubmission(result);
    if (!validation.valid) return Promise.resolve({ ok: false, reason: 'validation', errors: validation.errors });
    if (!database || !firebaseSdk) return Promise.resolve({ ok: false, reason: 'firebase_unavailable' });

    submitted[result.sessionId] = true;
    var playedAt = result.playedAt || new Date().toISOString();
    var monthKey = getKoreaMonthKey(playedAt);
    var playerId = String(result.playerId);
    var base = {
      rankingVersion: VERSION,
      mode: 'timeAttack',
      nickname: result.nickname,
      playerId: playerId,
      score: Number(result.correctCount),
      correctCount: Number(result.correctCount),
      accuracy: Number(result.accuracy),
      wrongCount: Number(result.wrongCount),
      bestCombo: Number(result.bestCombo),
      playedAt: playedAt,
      playedAtTimestamp: firebaseSdk.firestore.FieldValue.serverTimestamp()
    };
    var monthlyRef = database.collection(COLLECTION).doc(playerId + '_timeAttack_' + monthKey);
    var allRef = database.collection(COLLECTION).doc(playerId + '_timeAttack_allTimeBest');

    return database.runTransaction(function (tx) {
      return Promise.all([tx.get(monthlyRef), tx.get(allRef)]).then(function (docs) {
        var monthly = Object.assign({}, base, {
          periodType: 'monthly',
          monthKey: monthKey
        });
        var all = Object.assign({}, base, { periodType: 'allTimeBest' });
        if (isHigherScore(monthly, docs[0].exists && docs[0].data())) tx.set(monthlyRef, monthly);
        if (isHigherScore(all, docs[1].exists && docs[1].data())) tx.set(allRef, all);
      });
    }).then(function () {
      return { ok: true, monthKey: monthKey };
    }).catch(function (error) {
      delete submitted[result.sessionId];
      console.error('[Ranking write error]', error);
      return { ok: false, error: error };
    });
  }

  function submitOverall(input) {
    if (!database || !firebaseSdk || !input || !input.playerId) {
      return Promise.resolve({ ok: false, reason: 'firebase_unavailable' });
    }
    var monthKey = getKoreaMonthKey(input.playedAt);
    var playerId = String(input.playerId);
    var monthlyRef = database.collection(COLLECTION).doc(playerId + '_overall_' + monthKey);
    var allRef = database.collection(COLLECTION).doc(playerId + '_overall_allTime');

    return database.runTransaction(function (tx) {
      return Promise.all([tx.get(monthlyRef), tx.get(allRef)]).then(function (docs) {
        function value(doc, period) {
          var old = doc.exists ? doc.data() : {};
          var scoreField = period === 'monthly' ? 'monthlyScore' : 'totalScore';
          var score = (Number(old[scoreField]) || 0) + (Number(input.score) || 0);
          var correct = (Number(old.correctCount) || 0) + (Number(input.correctCount) || 0);
          var questions = (Number(old.totalQuestions) || 0) + (Number(input.totalQuestions) || 0);
          return {
            rankingVersion: VERSION,
            mode: 'overall',
            periodType: period === 'monthly' ? 'monthly' : 'allTime',
            monthKey: period === 'monthly' ? monthKey : null,
            nickname: input.nickname,
            playerId: playerId,
            monthlyScore: period === 'monthly' ? score : 0,
            totalScore: period === 'allTime' ? score : 0,
            correctCount: correct,
            totalQuestions: questions,
            accuracy: questions ? Math.round(correct / questions * 10000) / 100 : 0,
            playedAt: old.playedAt || input.playedAt || new Date().toISOString(),
            playedAtTimestamp: old.playedAtTimestamp || firebaseSdk.firestore.FieldValue.serverTimestamp()
          };
        }
        tx.set(monthlyRef, value(docs[0], 'monthly'));
        tx.set(allRef, value(docs[1], 'allTime'));
      });
    }).then(function () {
      return { ok: true, monthKey: monthKey };
    }).catch(function (error) {
      console.error('[Overall ranking write error]', error);
      return { ok: false, error: error };
    });
  }

  function indexUrl(error) {
    if (!error || error.code !== 'failed-precondition') return null;
    var match = String(error.message || '').match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/);
    return match ? match[0].replace(/[),.;]+$/, '') : null;
  }

  function queryError(error, fields) {
    console.error('[Ranking query error]', error);
    console.error('[Required Firestore index fields]', fields.join(' → '));
    var url = indexUrl(error);
    if (url) console.error('[Firebase index creation URL]', url);
    return url;
  }

  function getLeaderboard(options) {
    options = options || {};
    var category = options.category === 'timeAttack' ? 'timeAttack' : 'overall';
    var period = options.period || (category === 'timeAttack' ? 'monthly' : 'monthly');
    var field = category === 'overall'
      ? (period === 'monthly' ? 'monthlyScore' : 'totalScore')
      : 'score';
    var fields = ['rankingVersion', 'mode', 'periodType'];
    var query = database && database.collection(COLLECTION)
      .where('rankingVersion', '==', VERSION)
      .where('mode', '==', category)
      .where('periodType', '==', period);

    if (!query) return Promise.resolve({ ok: false, reason: 'firebase_unavailable', records: [] });

    if (period === 'monthly') {
      var monthKey = getKoreaMonthKey(options.referenceDate);
      query = query.where('monthKey', '==', monthKey);
      fields.push('monthKey');
    }

    fields.push(field + ' desc');
    query = query.orderBy(field, 'desc').limit(100);
    return query.get().then(function (snapshot) {
      return {
        ok: true,
        records: snapshot.docs.map(function (doc) {
          var data = doc.data();
          data.id = doc.id;
          data.displayScore = Number(data[field]) || 0;
          return data;
        })
      };
    }).catch(function (error) {
      return {
        ok: false,
        records: [],
        error: error,
        indexUrl: queryError(error, fields)
      };
    });
  }

  function getPlayerRecord(options) {
    options = options || {};
    if (!database || !options.playerId) return Promise.resolve(null);

    var category = options.category === 'timeAttack' ? 'timeAttack' : 'overall';
    var period = options.period || 'monthly';
    var id = String(options.playerId);
    if (category === 'overall') {
      id += '_overall_' + (period === 'monthly' ? getKoreaMonthKey(options.referenceDate) : 'allTime');
    } else {
      id += '_timeAttack_' + (period === 'monthly' ? getKoreaMonthKey(options.referenceDate) : 'allTimeBest');
    }

    return database.collection(COLLECTION).doc(id).get().then(function (doc) {
      if (!doc.exists) return null;
      var data = doc.data();
      var field = category === 'overall'
        ? (period === 'monthly' ? 'monthlyScore' : 'totalScore')
        : 'score';
      data.id = doc.id;
      data.displayScore = Number(data[field]) || 0;
      return data;
    }).catch(function (error) {
      console.error('[Player ranking query error]', error);
      return null;
    });
  }

  function alias(category, period, options) {
    options = options || {};
    return getLeaderboard(Object.assign({}, options, {
      category: category,
      period: period
    }));
  }

  v2.rankingService = {
    LEADERBOARD_VERSION: VERSION,
    collectionName: COLLECTION,
    allowedModes: ['overall', 'timeAttack'],
    setDatabase: setDatabase,
    getKoreaMonthKey: getKoreaMonthKey,
    getIndexCreationUrl: indexUrl,
    validateScoreSubmission: validateScoreSubmission,
    submitScore: submitScore,
    submitOverall: submitOverall,
    getLeaderboard: getLeaderboard,
    getPlayerRecord: getPlayerRecord,
    getMonthlyRanking: function (options) {
      return alias(options && options.mode === 'timeAttack' ? 'timeAttack' : 'overall', 'monthly', options);
    },
    getAllTimeRanking: function (options) {
      return alias(options && options.mode === 'timeAttack' ? 'timeAttack' : 'overall', options && options.mode === 'timeAttack' ? 'allTimeBest' : 'allTime', options);
    }
  };

  initializeDatabase();
})(window);
