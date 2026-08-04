const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
['js/data/cats.js', 'js/data/seasonCats.js', 'js/services/adminValidationService.js', 'js/services/adminFirestoreService.js'].forEach(file => {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
});

const validation = global.GugudanV2.adminValidationService;
const service = global.GugudanV2.adminFirestoreService;
const catalog = [].concat(global.GugudanV2.baseCats, global.GugudanV2.seasonCats);
const adminAuth = { currentUser: { uid: validation.ADMIN_UID } };
const normalAuth = { currentUser: { uid: 'normal_user_001' } };
const validActionId = 'f5a5e6f1-2c49-4c57-b23d-9e7626aa9134';

assert.equal(validation.isCurrentUserAdmin(adminAuth), true);
assert.equal(validation.isCurrentUserAdmin(normalAuth), false);
assert.throws(() => validation.assertCurrentUserAdmin(normalAuth), /admin_forbidden/);
assert(validation.validateActionId(validActionId).valid);
assert(!validation.validateActionId('Date.now()').valid);
assert(!validation.validateActionId('short').valid);
assert(validation.validateSearchRequest({ searchType: 'uid', query: 'target_user_001' }).valid);
assert.equal(validation.validateSearchRequest({ searchType: 'loginId', query: '  CAT01 ' }).query, 'cat01');
assert(!validation.validateSearchRequest({ searchType: 'email', query: 'cat@example.com' }).valid);
assert(!validation.validateSearchRequest({ searchType: 'loginId', query: '' }).valid);
assert(!validation.validateSearchRequest({ searchType: 'uid', query: '../invalid' }).valid);

function grant(overrides) {
  return Object.assign({ actionId: validActionId, targetUid: 'target_user_001', grantType: 'coins', amount: 100, catId: null, note: 'verification' }, overrides || {});
}
assert(validation.validateGrantRequest(grant(), catalog).valid);
[0, -1, 1.5, '10', Infinity, 100001].forEach(amount => assert(!validation.validateGrantRequest(grant({ amount }), catalog).valid));
assert(validation.validateGrantRequest(grant({ grantType: 'normalTickets', amount: 100 }), catalog).valid);
assert(!validation.validateGrantRequest(grant({ grantType: 'normalTickets', amount: 101 }), catalog).valid);
assert.equal(validation.CAT_GRANTS_ENABLED, false);
assert.equal(validation.validateGrantRequest(grant({ grantType: 'cat', amount: null, catId: 'summer_2026_watermelon_cat' }), catalog).code, 'cat_grants_disabled');
assert(!validation.validateGrantRequest(grant({ note: 'x'.repeat(101) }), catalog).valid);

const user = {
  profile: { loginId: 'target01', nickname: 'Target' },
  stats: { level: 7 },
  currency: { coins: 10, normalTickets: 2, premiumTickets: 3, seasonTickets: 4 },
  ownedCats: { base_normal_01: { count: 1 } }
};
const actionStore = {};
const writes = [];
const db = {
  collection(name) {
    return {
      doc(id) {
        return {
          path: name + '/' + id,
          id,
          collection: name,
          get: async () => name === 'users' && id === 'target_user_001'
            ? { exists: true, id, data: () => user }
            : { exists: false, id, data: () => undefined }
        };
      },
      where(field, operator, query) {
        return {
          limit() {
            return {
              get: async () => {
                assert.equal(field, 'profile.loginId');
                assert.equal(operator, '==');
                return query === 'target01'
                  ? { empty: false, size: 1, docs: [{ id: 'target_user_001', data: () => user }] }
                  : { empty: true, size: 0, docs: [] };
              }
            };
          }
        };
      }
    };
  },
  runTransaction(callback) {
    const tx = {
      get(ref) {
        if (ref.collection === 'adminActions') return Promise.resolve({ exists: Boolean(actionStore[ref.id]), data: () => actionStore[ref.id] });
        return Promise.resolve({ exists: true, data: () => user });
      },
      update(ref, value) { writes.push({ kind: 'update', ref, value }); },
      set(ref, value) { actionStore[ref.id] = value; writes.push({ kind: 'set', ref, value }); }
    };
    return callback(tx);
  }
};
const firebase = { firestore: { FieldValue: { serverTimestamp: () => '__server_timestamp__' } } };

(async () => {
  const byUid = await service.searchAdminUser({ searchType: 'uid', query: 'target_user_001' }, { auth: adminAuth, db });
  assert.deepStrictEqual(byUid, { uid: 'target_user_001', loginId: 'target01', nickname: 'Target', level: 7, currency: { coins: 10, normalTickets: 2, premiumTickets: 3 }, ownedCatCount: 1, ownedCatRarityCounts: { legendary: 0, hero: 0, rare: 0, normal: 1 } });
  const byLoginId = await service.searchAdminUser({ searchType: 'loginId', query: ' target01 ' }, { auth: adminAuth, db });
  assert.equal(byLoginId.uid, 'target_user_001');
  assert.equal(await service.searchAdminUser({ searchType: 'loginId', query: 'missing' }, { auth: adminAuth, db }), null);
  assert.throws(() => service.searchAdminUser({ searchType: 'uid', query: 'target_user_001' }, { auth: normalAuth, db }), /admin_forbidden/);
  const first = await service.grantAdminResource(grant(), { auth: adminAuth, db, firebase, catalog });
  assert.equal(first.idempotentReplay, false);
  assert.equal(writes.length, 2);
  assert.deepStrictEqual(writes[0].value.currency, { coins: 110, normalTickets: 2, premiumTickets: 3, seasonTickets: 4 });
  assert.equal(writes[1].value.adminUid, validation.ADMIN_UID);
  assert.equal(writes[1].value.status, 'applied');
  const replay = await service.grantAdminResource(grant(), { auth: adminAuth, db, firebase, catalog });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(writes.length, 2, 'identical action replay must not write');
  await assert.rejects(() => service.grantAdminResource(grant({ amount: 101 }), { auth: adminAuth, db, firebase, catalog }), /action_id_conflict/);
  await assert.rejects(() => service.grantAdminResource(grant({ actionId: 'a6b9f0f9-3d5d-4cd7-9cdd-0a975f725cab', grantType: 'cat', amount: null, catId: 'base_normal_01' }), { auth: adminAuth, db, firebase, catalog }), /cat_grants_disabled/);
  assert.throws(() => service.grantAdminResource(grant(), { auth: normalAuth, db, firebase, catalog }), /admin_forbidden/);

  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/adminActions\/\{actionId\}/);
  assert.match(rules, /allow update, delete: if false/);
  assert.match(rules, /validAdminCurrencyGrant/);
  assert.doesNotMatch(rules, /validAdminCatGrant/);
  const index = fs.readFileSync('index.html', 'utf8');
  assert.match(index, /adminValidationService\.js\?v=phase66-spark-admin/);
  assert.match(index, /adminFirestoreService\.js\?v=phase66-spark-admin/);
  console.log(JSON.stringify({ passed: true, cases: ['admin_auth', 'exact_uid_search', 'exact_login_id_search', 'search_validation', 'resource_limits', 'cat_grants_explicitly_disabled', 'transaction_shape', 'idempotent_replay', 'action_conflict', 'production_service_load'] }));
})().catch(error => { console.error(error); process.exitCode = 1; });
