const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const serviceSource = fs.readFileSync('js/services/rankingService.js', 'utf8');
const controllerSource = fs.readFileSync('js/ui/leaderboardV3Controller.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createFirestore(initialDocuments) {
  const documents = new Map(Object.entries(initialDocuments || {}));
  const queries = [];

  function docSnapshot(path) {
    return {
      exists: documents.has(path),
      data: () => clone(documents.get(path))
    };
  }

  function createQuery(collectionName) {
    const operations = [];
    const query = {
      where(field, operator, value) {
        operations.push(['where', field, operator, value]);
        return query;
      },
      orderBy(field, direction) {
        operations.push(['orderBy', field, direction]);
        return query;
      },
      limit(value) {
        operations.push(['limit', value]);
        return query;
      },
      get() {
        queries.push({ collectionName, operations: clone(operations) });
        return Promise.resolve({ docs: [] });
      }
    };
    return query;
  }

  const database = {
    collection(collectionName) {
      const query = createQuery(collectionName);
      query.doc = function (id) {
        const path = collectionName + '/' + id;
        return {
          id,
          path,
          get: () => Promise.resolve(docSnapshot(path))
        };
      };
      return query;
    },
    runTransaction(handler) {
      const transaction = {
        get: ref => Promise.resolve(docSnapshot(ref.path)),
        set(ref, value) {
          documents.set(ref.path, clone(value));
        }
      };
      return Promise.resolve(handler(transaction));
    }
  };

  return { database, documents, queries };
}

function loadRankingService(options) {
  const firestore = options && options.firestore;
  const logs = [];
  const context = {
    Intl,
    Date,
    Promise,
    console: {
      info: (...args) => logs.push(args),
      error: () => {}
    },
    window: {
      GugudanV2: {}
    }
  };
  context.window.window = context.window;
  if (firestore) {
    context.window.firebaseClient = { db: firestore.database };
    context.window.firebase = {
      firestore: {
        FieldValue: {
          serverTimestamp: () => ({ serverTimestamp: true })
        }
      }
    };
  }
  vm.createContext(context);
  vm.runInContext(serviceSource, context, { filename: 'rankingService.js' });
  return {
    service: context.window.GugudanV2.rankingService,
    logs
  };
}

async function testDatabaseBootstrapAndQueries() {
  const unavailable = loadRankingService();
  const unavailableResult = await unavailable.service.getLeaderboard();
  assert.equal(unavailableResult.reason, 'firebase_unavailable');
  assert.equal(unavailable.logs.filter(entry => entry[0] === '[LEADERBOARD SERVICE NOT READY]').length, 1);

  const firestore = createFirestore();
  const ready = loadRankingService({ firestore });
  assert.equal(ready.logs.filter(entry => entry[0] === '[LEADERBOARD SERVICE READY]').length, 1);
  assert.equal((serviceSource.match(/rankingService\.setDatabase\(client\.db, global\.firebase\)/g) || []).length, 1);

  const cases = [
    {
      options: { category: 'overall', period: 'allTime' },
      expected: [
        ['where', 'rankingVersion', '==', 'v3'],
        ['where', 'mode', '==', 'overall'],
        ['where', 'periodType', '==', 'allTime'],
        ['orderBy', 'totalScore', 'desc'],
        ['limit', 100]
      ]
    },
    {
      options: { category: 'overall', period: 'monthly', referenceDate: '2026-07-31T16:00:00.000Z' },
      expected: [
        ['where', 'rankingVersion', '==', 'v3'],
        ['where', 'mode', '==', 'overall'],
        ['where', 'periodType', '==', 'monthly'],
        ['where', 'monthKey', '==', '2026-08'],
        ['orderBy', 'monthlyScore', 'desc'],
        ['limit', 100]
      ]
    },
    {
      options: { category: 'timeAttack', period: 'allTimeBest' },
      expected: [
        ['where', 'rankingVersion', '==', 'v3'],
        ['where', 'mode', '==', 'timeAttack'],
        ['where', 'periodType', '==', 'allTimeBest'],
        ['orderBy', 'score', 'desc'],
        ['limit', 100]
      ]
    },
    {
      options: { category: 'timeAttack', period: 'monthly', referenceDate: '2026-07-31T16:00:00.000Z' },
      expected: [
        ['where', 'rankingVersion', '==', 'v3'],
        ['where', 'mode', '==', 'timeAttack'],
        ['where', 'periodType', '==', 'monthly'],
        ['where', 'monthKey', '==', '2026-08'],
        ['orderBy', 'score', 'desc'],
        ['limit', 100]
      ]
    }
  ];

  for (const testCase of cases) {
    const result = await ready.service.getLeaderboard(testCase.options);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(firestore.queries.at(-1).operations, testCase.expected);
    assert.equal(firestore.queries.at(-1).collectionName, 'leaderboardsV3');
  }
}

function timeAttackResult(sessionId, playedAt, correctCount) {
  return {
    sessionId,
    playedAt,
    mode: 'timeAttack',
    playerId: 'player_a',
    nickname: '테스트 냥코',
    score: correctCount,
    correctCount,
    wrongCount: 0,
    totalQuestions: correctCount,
    accuracy: 100,
    bestCombo: correctCount
  };
}

async function testMonthlyTimeAttackWrites() {
  const firestore = createFirestore({
    'leaderboardsV3/player_a_timeAttack_2026-07': { score: 20, periodType: 'monthly', monthKey: '2026-07' },
    'leaderboardsV3/player_a_timeAttack_allTimeBest': { score: 30, periodType: 'allTimeBest' }
  });
  const { service } = loadRankingService({ firestore });

  await service.submitScore(timeAttackResult('lower', '2026-07-20T03:00:00.000Z', 15));
  assert.equal(firestore.documents.get('leaderboardsV3/player_a_timeAttack_2026-07').score, 20);
  assert.equal(firestore.documents.get('leaderboardsV3/player_a_timeAttack_allTimeBest').score, 30);

  await service.submitScore(timeAttackResult('higher', '2026-07-20T03:00:00.000Z', 25));
  assert.equal(firestore.documents.get('leaderboardsV3/player_a_timeAttack_2026-07').score, 25);
  assert.equal(firestore.documents.get('leaderboardsV3/player_a_timeAttack_allTimeBest').score, 30);

  await service.submitScore(timeAttackResult('new_month', '2026-07-31T16:00:00.000Z', 12));
  const august = firestore.documents.get('leaderboardsV3/player_a_timeAttack_2026-08');
  assert.equal(august.score, 12);
  assert.equal(august.periodType, 'monthly');
  assert.equal(august.monthKey, '2026-08');
}

function createControllerContext() {
  class Element {
    constructor(id) {
      this.id = id;
      this.children = [];
      this.dataset = {};
      this.className = '';
      this.disabled = false;
      this._innerHTML = '';
      this.retryButton = null;
      this.classList = { toggle() {} };
    }
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
      this.retryButton = value.includes('ranking-retry-button') ? new Element('retry') : null;
    }
    get innerHTML() {
      return this._innerHTML;
    }
    set textContent(value) {
      this._innerHTML = String(value == null ? '' : value);
    }
    get textContent() {
      return this._innerHTML;
    }
    appendChild(child) {
      this.children.push(child);
    }
    querySelector(selector) {
      if (selector === '.ranking-retry-button') return this.retryButton;
      return null;
    }
    querySelectorAll() {
      return [];
    }
  }

  const elements = {
    'ranking-list': new Element('ranking-list'),
    'ranking-period-label': new Element('ranking-period-label')
  };
  let attempts = 0;
  const context = {
    console: { error() {} },
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => new Element()
    },
    window: {
      GugudanV2: {
        rankingService: {
          getKoreaMonthKey: () => '2026-07',
          getLeaderboard: () => {
            attempts += 1;
            if (attempts === 1) return Promise.resolve({ ok: false, reason: 'test_error', records: [] });
            return Promise.resolve({
              ok: true,
              records: [{
                playerId: 'player_a',
                nickname: '테스트 냥코',
                representativeCatId: 'base_normal_01',
                displayScore: 4893,
                playedAt: '2026-07-20T00:00:00.000Z'
              }]
            });
          },
          getPlayerRecord: () => Promise.resolve(null)
        },
        storageService: {
          loadSaveData: () => ({ profile: { playerId: 'player_a' } })
        },
        releasePolicyService: {
          getVisibleCats: () => [{
            id: 'base_normal_01',
            image: 'cat.png'
          }]
        }
      },
      getCurrentPlayerContext: () => ({ nickname: '테스트 냥코' })
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(controllerSource, context, { filename: 'leaderboardV3Controller.js' });
  return { context, elements, getAttempts: () => attempts };
}

async function testErrorRetryAndRendering() {
  const fixture = createControllerContext();
  await fixture.context.window.loadModeRanking();
  const list = fixture.elements['ranking-list'];
  assert(list.innerHTML.includes('순위를 불러오지 못했습니다.'));
  assert(list.retryButton);

  const retryButton = list.retryButton;
  retryButton.onclick();
  retryButton.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.getAttempts(), 2);
  assert.equal(list.children.length, 1);
  assert(list.children[0].innerHTML.includes('4,893P'));
  assert(list.children[0].className.includes('is-me'));
  assert(list.children[0].innerHTML.includes('테스트 냥코'));

  fixture.context.window.GugudanV2.rankingService.getLeaderboard = () => Promise.resolve({
    ok: true,
    records: []
  });
  await fixture.context.window.loadModeRanking();
  assert(list.innerHTML.includes('아직 등록된 기록이 없습니다.'));
}

function testStaticContracts() {
  const saveStart = appSource.indexOf('async function saveFinalGameResult');
  const saveEnd = appSource.indexOf('function displayResultScreen', saveStart);
  const saveBody = appSource.slice(saveStart, saveEnd);
  assert(saveBody.includes("user.uid + '_timeAttack_' + monthKey"));
  assert(saveBody.includes("periodType: 'monthly'"));
  assert(saveBody.includes('monthKey: monthKey'));
  assert(saveBody.includes('correctCount > prevMonthlyTimeAttackScore'));
  assert(!saveBody.includes('weekKey'));
  assert(!saveBody.includes('weeklyBest'));
  assert(!controllerSource.includes('weeklyBest'));
  assert(!controllerSource.includes('weekKey'));
  assert(controllerSource.includes('월간 최고기록'));
  assert(controllerSource.includes('순위를 불러오는 중입니다.'));
  assert(controllerSource.includes('아직 등록된 기록이 없습니다.'));

  const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
  const v3Indexes = indexes.indexes.filter(index => index.collectionGroup === 'leaderboardsV3');
  assert.equal(v3Indexes.length, 4);
  assert.equal(indexes.indexes.filter(index => index.collectionGroup === 'entries').length, 1);
}

(async () => {
  await testDatabaseBootstrapAndQueries();
  await testMonthlyTimeAttackWrites();
  await testErrorRetryAndRendering();
  testStaticContracts();
  console.log(JSON.stringify({
    passed: true,
    cases: [
      'firebase_unavailable_without_database',
      'database_bootstrap_once',
      'four_v3_query_contracts',
      'kst_month_boundary',
      'monthly_time_attack_lower_kept',
      'monthly_time_attack_higher_updated',
      'monthly_time_attack_new_month_created',
      'weekly_runtime_contract_removed',
      'error_retry_deduplicated',
      'retry_success_rendered',
      'empty_state_rendered_without_error',
      'nickname_representative_cat_current_user_score_rendered',
      'four_v3_indexes_preserved_with_legacy_index'
    ]
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
