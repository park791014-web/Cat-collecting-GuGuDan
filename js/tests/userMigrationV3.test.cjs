const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const end = source.indexOf('// V3 Firestore 데이터를 로컬 스토리지 구조와 전격 동기화');
assert(end > 0, 'migration source boundary missing');

const context = {
  console: { log() {}, warn() {}, error() {}, info() {} },
  navigator: {},
  location: { href: 'http://test.local/', hostname: 'test.local' },
  window: {
    GugudanV2: {
      gameConfig: {},
      baseCats: [
        { id: 'base_normal_01' },
        { id: 'base_rare_02' }
      ]
    }
  },
  firebase: {
    app() { return { options: { projectId: 'cat-gugudan', authDomain: 'cat-gugudan.firebaseapp.com' } }; },
    auth() { return { currentUser: null }; },
    firestore: { FieldValue: { serverTimestamp() { return '__SERVER_TIMESTAMP__'; } } }
  }
};
context.window.firebase = context.firebase;
vm.createContext(context);
vm.runInContext(source.slice(0, end), context, { filename: 'app.js:migration' });

const { migrateUserDataToV3, buildUserMigrationPatch } = context.window.NyankoUserMigration;
const plain = value => JSON.parse(JSON.stringify(value));

const latest = migrateUserDataToV3({
  schemaVersion: 3,
  stats: { totalPoints: 0, level: 1 },
  totalPoints: 900,
  currency: { coins: 2200, normalTickets: 0, premiumTickets: 0 },
  currencySnapshot: { coins: 300 },
  coins: 100,
  profile: { nickname: '최신', representativeCatId: 'base_normal_01' },
  ownedCats: { base_normal_01: { count: 1, acquiredAt: '2026-01-01', custom: true } },
  adventure: { completedStageIds: [], unlockedStageIds: ['stage_01_01'] },
  dailyMissions: { dateKey: 'x', missions: { a: 1 } },
  rewardState: { lastRewardedLevel: 3 },
  extension: { keep: true },
  createdAt: 'created',
  updatedAt: 'updated'
});
assert.strictEqual(latest.currency.coins, 2200, 'V3 coins must win');
assert.strictEqual(latest.stats.totalPoints, 0, 'zero V3 points must win');
assert.deepStrictEqual(plain(latest.extension), { keep: true });

assert.strictEqual(migrateUserDataToV3({ currencySnapshot: { coins: 450 } }).currency.coins, 450);
assert.strictEqual(migrateUserDataToV3({ coins: 125 }).currency.coins, 125);

const mapped = migrateUserDataToV3({
  ownedCats: { base_rare_02: { count: 4, acquiredAt: 'kept', extra: 'yes' } },
  profile: { representativeCatId: 'base_rare_02' }
});
assert.deepStrictEqual(plain(mapped.ownedCats), {
  base_rare_02: { count: 4, acquiredAt: 'kept', extra: 'yes' }
});

const legacyCats = migrateUserDataToV3({ ownedCatIds: ['base_rare_02'], duplicateCounts: { base_rare_02: 2 } });
assert.strictEqual(legacyCats.ownedCats.base_rare_02.count, 3);
assert.deepStrictEqual(plain(migrateUserDataToV3({ ownedCats: {} }).ownedCats), {
  base_normal_01: { count: 1, acquiredAt: null }
});

const representative = migrateUserDataToV3({
  profile: { representativeCatId: 'base_rare_02', selectedCatId: 'base_normal_01' },
  ownedCats: {
    base_normal_01: { count: 1 },
    base_rare_02: { count: 1 }
  }
});
assert.strictEqual(representative.profile.representativeCatId, 'base_rare_02');

const twice = migrateUserDataToV3(latest);
assert.deepStrictEqual(plain(twice), plain(latest), 'migration must be idempotent');
assert.deepStrictEqual(plain(twice.dailyMissions), plain(latest.dailyMissions));
assert.deepStrictEqual(plain(twice.adventure), plain(latest.adventure));
assert.deepStrictEqual(plain(twice.rewardState), plain(latest.rewardState));
assert.strictEqual(twice.createdAt, 'created');

const patch = buildUserMigrationPatch({
  schemaVersion: 2,
  stats: { totalPoints: 0 },
  coins: 77,
  ownedCatIds: ['base_normal_01']
});
assert.strictEqual(patch['stats.totalPoints'], undefined, 'existing zero must not be patched');
assert.strictEqual(patch['currency.coins'], 77);
assert.strictEqual(patch.schemaVersion, 3);
assert.strictEqual(patch.createdAt, '__SERVER_TIMESTAMP__');

const collectionSource = fs.readFileSync('js/ui/collectionController.js', 'utf8');
const skillSource = fs.readFileSync('js/ui/catSkillDetailController.js', 'utf8');
assert(/global\.openCatDetail\s*=\s*openCatDetail/.test(collectionSource));
assert(!skillSource.includes('global.openCatDetail='), 'skill helper must not replace openCatDetail');
assert(skillSource.includes('equipButton.dataset.catId'));
assert(skillSource.includes('global.updateRepresentativeCat(equipButton.dataset.catId)'));

console.log(JSON.stringify({
  passed: true,
  fixtures: ['latest_v3', 'snapshot_fallback', 'legacy_fallback', 'owned_map', 'owned_ids', 'representative_priority', 'idempotent', 'nested_preservation', 'missing_only_patch']
}, null, 2));
